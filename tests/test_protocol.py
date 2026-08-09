import hashlib
import json
from pathlib import Path

import pytest

from qrbeam.protocol import (
    MAX_FILE_SIZE,
    PROFILES,
    TransferSession,
    b64url_decode,
    parse_frame,
    sanitize_filename,
)


def test_round_trip_unicode_file(tmp_path: Path) -> None:
    content = ("二维码 transfer ✅\n" * 100).encode()
    source = tmp_path / "报告 2026?.txt"
    source.write_bytes(content)
    session = TransferSession(source, PROFILES["safe"], session_id="0123456789abcdef")

    manifest_frame = parse_frame(session.manifest_frame)
    manifest = json.loads(manifest_frame.payload)
    assert manifest["fileName"] == "报告 2026_.txt"
    assert manifest["sha256"] == hashlib.sha256(content).hexdigest()

    restored = bytearray()
    for value in session.data_frames:
        restored.extend(parse_frame(value).payload)
    assert bytes(restored) == content


def test_manifest_repeats_after_each_twenty_data_frames(tmp_path: Path) -> None:
    source = tmp_path / "sample.bin"
    source.write_bytes(bytes(range(256)) * 50)
    session = TransferSession(source, PROFILES["safe"], session_id="aaaaaaaaaaaaaaaa")
    manifest_positions = [
        index for index, value in enumerate(session.frames) if value == session.manifest_frame
    ]
    assert manifest_positions[0] == 0
    assert manifest_positions[1] == 21


def test_corrupt_crc_is_rejected(tmp_path: Path) -> None:
    source = tmp_path / "sample.bin"
    source.write_bytes(b"hello")
    session = TransferSession(source, PROFILES["safe"], session_id="bbbbbbbbbbbbbbbb")
    corrupt = session.data_frames[0][:-1] + ("0" if session.data_frames[0][-1] != "0" else "1")
    with pytest.raises(ValueError, match="crc32 mismatch"):
        parse_frame(corrupt)


def test_empty_file_has_manifest_only(tmp_path: Path) -> None:
    source = tmp_path / "empty.dat"
    source.write_bytes(b"")
    session = TransferSession(source, PROFILES["safe"], session_id="cccccccccccccccc")
    assert session.manifest["totalChunks"] == 0
    assert session.frames == [session.manifest_frame]


def test_size_limit(tmp_path: Path) -> None:
    source = tmp_path / "too-large.bin"
    source.write_bytes(b"0" * (MAX_FILE_SIZE + 1))
    with pytest.raises(ValueError, match="exceeds"):
        TransferSession(source, PROFILES["fast"])


@pytest.mark.parametrize(
    ("value", "expected"),
    [("../secret.txt", "secret.txt"), ("a:b?.zip", "a_b_.zip"), ("...", "received-file")],
)
def test_filename_sanitization(value: str, expected: str) -> None:
    assert sanitize_filename(value) == expected


def test_payload_is_unpadded_base64url(tmp_path: Path) -> None:
    source = tmp_path / "tiny.bin"
    source.write_bytes(b"\xfb\xff")
    session = TransferSession(source, PROFILES["safe"], session_id="dddddddddddddddd")
    payload = session.data_frames[0].split("|")[5]
    assert "+" not in payload and "/" not in payload and "=" not in payload
    assert b64url_decode(payload) == b"\xfb\xff"


def test_shared_cross_language_fixture() -> None:
    fixture = json.loads(Path("protocol/test-vector.json").read_text(encoding="utf-8"))
    manifest = parse_frame(fixture["manifestFrame"])
    data = parse_frame(fixture["dataFrame"])
    assert manifest.session_id == fixture["sessionId"]
    assert json.loads(manifest.payload)["sha256"] == fixture["sha256"]
    assert data.payload.decode("utf-8") == fixture["sourceUtf8"]
