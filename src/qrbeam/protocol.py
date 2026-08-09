from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import re
import secrets
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

PROTOCOL_VERSION = "QRB1"
MAX_FILE_SIZE = 5 * 1024 * 1024
MANIFEST_INTERVAL = 20


@dataclass(frozen=True)
class Profile:
    name: str
    chunk_size: int
    fps: int
    error_correction: Literal["L", "M"]


PROFILES: dict[str, Profile] = {
    "safe": Profile("safe", chunk_size=480, fps=6, error_correction="M"),
    "fast": Profile("fast", chunk_size=900, fps=10, error_correction="L"),
}


@dataclass(frozen=True)
class ParsedFrame:
    version: str
    kind: Literal["M", "D"]
    session_id: str
    payload: bytes
    crc32: str
    index: int | None = None
    total: int | None = None


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def crc32_hex(data: bytes) -> str:
    return f"{zlib.crc32(data) & 0xFFFFFFFF:08x}"


def sanitize_filename(value: str) -> str:
    name = Path(value).name
    name = re.sub(r"[\x00-\x1f\x7f/\\:*?\"<>|]", "_", name)
    name = name.strip(" .")
    return name[:180] or "received-file"


def _manifest_frame(session_id: str, manifest: dict[str, Any]) -> str:
    raw = json.dumps(
        manifest,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return f"{PROTOCOL_VERSION}|M|{session_id}|{b64url_encode(raw)}|{crc32_hex(raw)}"


def _data_frame(session_id: str, index: int, total: int, chunk: bytes) -> str:
    return (
        f"{PROTOCOL_VERSION}|D|{session_id}|{index}|{total}|"
        f"{b64url_encode(chunk)}|{crc32_hex(chunk)}"
    )


def parse_frame(value: str) -> ParsedFrame:
    parts = value.split("|")
    if len(parts) < 5 or parts[0] != PROTOCOL_VERSION:
        raise ValueError("not a QRB1 frame")
    kind = parts[1]
    session_id = parts[2]
    if not re.fullmatch(r"[0-9a-f]{16}", session_id):
        raise ValueError("invalid session id")

    if kind == "M" and len(parts) == 5:
        payload = b64url_decode(parts[3])
        crc = parts[4]
        frame = ParsedFrame(PROTOCOL_VERSION, "M", session_id, payload, crc)
    elif kind == "D" and len(parts) == 7:
        try:
            index = int(parts[3])
            total = int(parts[4])
        except ValueError as exc:
            raise ValueError("invalid chunk position") from exc
        if index < 0 or total < 1 or index >= total:
            raise ValueError("chunk position out of range")
        payload = b64url_decode(parts[5])
        crc = parts[6]
        frame = ParsedFrame(
            PROTOCOL_VERSION,
            "D",
            session_id,
            payload,
            crc,
            index=index,
            total=total,
        )
    else:
        raise ValueError("invalid QRB1 frame shape")

    if not re.fullmatch(r"[0-9a-f]{8}", frame.crc32):
        raise ValueError("invalid crc32")
    if crc32_hex(frame.payload) != frame.crc32:
        raise ValueError("crc32 mismatch")
    return frame


class TransferSession:
    def __init__(
        self,
        file_path: Path,
        profile: Profile,
        *,
        session_id: str | None = None,
    ) -> None:
        self.file_path = Path(file_path)
        self.profile = profile
        self.data = self.file_path.read_bytes()
        if len(self.data) > MAX_FILE_SIZE:
            raise ValueError(f"file exceeds {MAX_FILE_SIZE} byte limit")
        self.session_id = session_id or secrets.token_hex(8)
        if not re.fullmatch(r"[0-9a-f]{16}", self.session_id):
            raise ValueError("session_id must be 16 lowercase hex characters")

        self.chunks = [
            self.data[offset : offset + profile.chunk_size]
            for offset in range(0, len(self.data), profile.chunk_size)
        ]
        mime = mimetypes.guess_type(self.file_path.name)[0] or "application/octet-stream"
        self.manifest: dict[str, Any] = {
            "chunkSize": profile.chunk_size,
            "fileName": sanitize_filename(self.file_path.name),
            "fileSize": len(self.data),
            "mime": mime,
            "protocol": PROTOCOL_VERSION,
            "sha256": hashlib.sha256(self.data).hexdigest(),
            "totalChunks": len(self.chunks),
        }
        self.manifest_frame = _manifest_frame(self.session_id, self.manifest)
        self.data_frames = [
            _data_frame(self.session_id, index, len(self.chunks), chunk)
            for index, chunk in enumerate(self.chunks)
        ]
        self.frames = self._build_cycle()

    def _build_cycle(self) -> list[str]:
        if not self.data_frames:
            return [self.manifest_frame]
        cycle = [self.manifest_frame]
        for index, frame in enumerate(self.data_frames, start=1):
            cycle.append(frame)
            if index % MANIFEST_INTERVAL == 0 and index < len(self.data_frames):
                cycle.append(self.manifest_frame)
        return cycle

    def frame_at(self, position: int) -> str:
        if position < 0:
            raise ValueError("position must be non-negative")
        return self.frames[position % len(self.frames)]

    @property
    def cycle_length(self) -> int:
        return len(self.frames)
