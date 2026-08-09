import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import mimeTypes from "mime-types";

export const PROTOCOL_VERSION = "QRB1";
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MANIFEST_INTERVAL = 20;

export const PROFILES = Object.freeze({
  safe: Object.freeze({
    name: "safe",
    chunkSize: 480,
    fps: 6,
    errorCorrection: "M",
  }),
  fast: Object.freeze({
    name: "fast",
    chunkSize: 900,
    fps: 10,
    errorCorrection: "L",
  }),
});

const CRC32_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC32_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC32_TABLE[index] = value >>> 0;
}

export function b64urlEncode(data) {
  return Buffer.from(data).toString("base64url");
}

export function b64urlDecode(value) {
  if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
    throw new Error("invalid base64url payload");
  }
  return Buffer.from(value, "base64url");
}

export function crc32Hex(data) {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(data)) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

export function sanitizeFilename(value) {
  const portablePath = String(value).replaceAll("\\", "/");
  let name = path.posix.basename(portablePath);
  name = name
    .replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, "_")
    .replace(/^[ .]+|[ .]+$/g, "");
  name = [...name].slice(0, 180).join("");
  return name || "received-file";
}

function manifestFrame(sessionId, manifest) {
  const raw = Buffer.from(JSON.stringify(manifest), "utf8");
  return `${PROTOCOL_VERSION}|M|${sessionId}|${b64urlEncode(raw)}|${crc32Hex(
    raw
  )}`;
}

function dataFrame(sessionId, index, total, chunk) {
  return `${PROTOCOL_VERSION}|D|${sessionId}|${index}|${total}|${b64urlEncode(
    chunk
  )}|${crc32Hex(chunk)}`;
}

export function parseFrame(value) {
  const parts = value.split("|");
  if (parts.length < 5 || parts[0] !== PROTOCOL_VERSION) {
    throw new Error("not a QRB1 frame");
  }
  const kind = parts[1];
  const sessionId = parts[2];
  if (!/^[0-9a-f]{16}$/.test(sessionId)) {
    throw new Error("invalid session id");
  }

  let payload;
  let crc32;
  let index = null;
  let total = null;
  if (kind === "M" && parts.length === 5) {
    payload = b64urlDecode(parts[3]);
    crc32 = parts[4];
  } else if (kind === "D" && parts.length === 7) {
    if (!/^\d+$/.test(parts[3]) || !/^\d+$/.test(parts[4])) {
      throw new Error("invalid chunk position");
    }
    index = Number(parts[3]);
    total = Number(parts[4]);
    if (
      !Number.isSafeInteger(index) ||
      !Number.isSafeInteger(total) ||
      index < 0 ||
      total < 1 ||
      index >= total
    ) {
      throw new Error("chunk position out of range");
    }
    payload = b64urlDecode(parts[5]);
    crc32 = parts[6];
  } else {
    throw new Error("invalid QRB1 frame shape");
  }

  if (!/^[0-9a-f]{8}$/.test(crc32)) {
    throw new Error("invalid crc32");
  }
  if (crc32Hex(payload) !== crc32) {
    throw new Error("crc32 mismatch");
  }
  return {
    version: PROTOCOL_VERSION,
    kind,
    sessionId,
    payload,
    crc32,
    index,
    total,
  };
}

export class TransferSession {
  constructor(filePath, profile, options = {}) {
    if (!profile || !Object.values(PROFILES).includes(profile)) {
      throw new Error("invalid transfer profile");
    }
    this.filePath = filePath;
    this.profile = profile;
    this.data = readFileSync(filePath);
    if (this.data.length > MAX_FILE_SIZE) {
      throw new Error(`file exceeds ${MAX_FILE_SIZE} byte limit`);
    }

    this.sessionId = options.sessionId ?? randomBytes(8).toString("hex");
    if (!/^[0-9a-f]{16}$/.test(this.sessionId)) {
      throw new Error("sessionId must be 16 lowercase hex characters");
    }

    this.chunks = [];
    for (
      let offset = 0;
      offset < this.data.length;
      offset += profile.chunkSize
    ) {
      this.chunks.push(this.data.subarray(offset, offset + profile.chunkSize));
    }
    const fileName = sanitizeFilename(filePath);
    this.manifest = {
      chunkSize: profile.chunkSize,
      fileName,
      fileSize: this.data.length,
      mime: mimeTypes.lookup(fileName) || "application/octet-stream",
      protocol: PROTOCOL_VERSION,
      sha256: createHash("sha256").update(this.data).digest("hex"),
      totalChunks: this.chunks.length,
    };
    this.manifestFrame = manifestFrame(this.sessionId, this.manifest);
    this.dataFrames = this.chunks.map((chunk, index) =>
      dataFrame(this.sessionId, index, this.chunks.length, chunk)
    );
    this.frames = this.buildCycle();
  }

  buildCycle() {
    if (this.dataFrames.length === 0) {
      return [this.manifestFrame];
    }
    const cycle = [this.manifestFrame];
    this.dataFrames.forEach((frame, index) => {
      cycle.push(frame);
      const sent = index + 1;
      if (sent % MANIFEST_INTERVAL === 0 && sent < this.dataFrames.length) {
        cycle.push(this.manifestFrame);
      }
    });
    return cycle;
  }

  frameAt(position) {
    if (!Number.isSafeInteger(position) || position < 0) {
      throw new Error("position must be a non-negative integer");
    }
    return this.frames[position % this.frames.length];
  }

  get cycleLength() {
    return this.frames.length;
  }
}
