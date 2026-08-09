/* eslint-disable no-bitwise */
import {fromByteArray, toByteArray} from 'base64-js';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';

export const PROTOCOL_VERSION = 'QRB1';
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MANIFEST_INTERVAL = 20;

export type ProfileName = 'safe' | 'fast';

export interface TransferProfile {
  name: ProfileName;
  chunkSize: number;
  fps: number;
  errorCorrection: 'L' | 'M';
}

export const TRANSFER_PROFILES: Record<ProfileName, TransferProfile> = {
  safe: {name: 'safe', chunkSize: 480, fps: 6, errorCorrection: 'M'},
  fast: {name: 'fast', chunkSize: 900, fps: 10, errorCorrection: 'L'},
};

export interface Manifest {
  protocol: 'QRB1';
  fileName: string;
  mime: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  sha256: string;
}

export type ParsedFrame =
  | {
      kind: 'manifest';
      sessionId: string;
      payload: Uint8Array;
      manifest: Manifest;
    }
  | {
      kind: 'data';
      sessionId: string;
      payload: Uint8Array;
      index: number;
      total: number;
    };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32Hex(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

export function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new Error('invalid base64url payload');
  }
  const standard = value.replace(/-/g, '+').replace(/_/g, '/');
  return toByteArray(standard + '='.repeat((4 - (standard.length % 4)) % 4));
}

export function encodeBase64Url(value: Uint8Array): string {
  return fromByteArray(value).replace(/\+/g, '-').replace(/\//g, '_').replace(new RegExp('=+$'), '');
}

export function sanitizeFilename(value: string): string {
  const basename = value.split(/[\\/]/).pop() ?? '';
  const sanitized = basename
    // The protocol must remove ASCII control characters from filesystem names.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/:*?"<>|\\]/g, '_')
    .replace(/^[ .]+|[ .]+$/g, '')
    .slice(0, 180);
  return sanitized || 'received-file';
}

function decodeUtf8(bytes: Uint8Array): string {
  let escaped = '';
  for (const byte of bytes) {
    escaped += `%${byte.toString(16).padStart(2, '0')}`;
  }
  return decodeURIComponent(escaped);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function validateManifest(value: unknown): Manifest {
  if (value == null || typeof value !== 'object') {
    throw new Error('manifest must be an object');
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.protocol !== PROTOCOL_VERSION) {
    throw new Error('unsupported protocol');
  }
  if (typeof candidate.fileName !== 'string' || candidate.fileName.length === 0) {
    throw new Error('invalid file name');
  }
  if (typeof candidate.mime !== 'string' || candidate.mime.length === 0) {
    throw new Error('invalid mime type');
  }
  if (
    !isSafeInteger(candidate.fileSize) ||
    candidate.fileSize < 0 ||
    candidate.fileSize > MAX_FILE_SIZE
  ) {
    throw new Error('invalid file size');
  }
  if (!isSafeInteger(candidate.chunkSize) || candidate.chunkSize < 1 || candidate.chunkSize > 4096) {
    throw new Error('invalid chunk size');
  }
  if (!isSafeInteger(candidate.totalChunks) || candidate.totalChunks < 0) {
    throw new Error('invalid total chunks');
  }
  const expectedChunks =
    candidate.fileSize === 0 ? 0 : Math.ceil(candidate.fileSize / candidate.chunkSize);
  if (candidate.totalChunks !== expectedChunks) {
    throw new Error('manifest chunk count does not match file size');
  }
  if (typeof candidate.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(candidate.sha256)) {
    throw new Error('invalid sha256');
  }
  return {
    protocol: PROTOCOL_VERSION,
    fileName: sanitizeFilename(candidate.fileName),
    mime: candidate.mime,
    fileSize: candidate.fileSize,
    chunkSize: candidate.chunkSize,
    totalChunks: candidate.totalChunks,
    sha256: candidate.sha256,
  };
}

function assertSessionId(value: string): void {
  if (!/^[0-9a-f]{16}$/.test(value)) {
    throw new Error('invalid session id');
  }
}

function decodeCheckedPayload(payloadValue: string, crc: string): Uint8Array {
  if (!/^[0-9a-f]{8}$/.test(crc)) {
    throw new Error('invalid crc32');
  }
  const payload = decodeBase64Url(payloadValue);
  if (crc32Hex(payload) !== crc) {
    throw new Error('crc32 mismatch');
  }
  return payload;
}

export function parseFrame(raw: string): ParsedFrame {
  const parts = raw.split('|');
  if (parts[0] !== PROTOCOL_VERSION) {
    throw new Error('not a QRB1 frame');
  }
  if (parts[1] === 'M' && parts.length === 5) {
    const sessionId = parts[2];
    assertSessionId(sessionId);
    const payload = decodeCheckedPayload(parts[3], parts[4]);
    const manifest = validateManifest(JSON.parse(decodeUtf8(payload)));
    return {kind: 'manifest', sessionId, payload, manifest};
  }
  if (parts[1] === 'D' && parts.length === 7) {
    const sessionId = parts[2];
    assertSessionId(sessionId);
    const index = Number(parts[3]);
    const total = Number(parts[4]);
    if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) || total < 1 || index < 0 || index >= total) {
      throw new Error('invalid chunk position');
    }
    const payload = decodeCheckedPayload(parts[5], parts[6]);
    return {kind: 'data', sessionId, payload, index, total};
  }
  throw new Error('invalid QRB1 frame shape');
}

function encodePayloadFrame(prefix: string, payload: Uint8Array): string {
  return `${prefix}|${encodeBase64Url(payload)}|${crc32Hex(payload)}`;
}

function stableManifestJson(manifest: Manifest): string {
  // Python uses sort_keys=True. Keep the exact key order so deterministic
  // cross-language fixtures produce byte-identical manifest frames.
  return JSON.stringify({
    chunkSize: manifest.chunkSize,
    fileName: manifest.fileName,
    fileSize: manifest.fileSize,
    mime: manifest.mime,
    protocol: manifest.protocol,
    sha256: manifest.sha256,
    totalChunks: manifest.totalChunks,
  });
}

export function encodeManifestFrame(sessionId: string, manifest: Manifest): string {
  assertSessionId(sessionId);
  const validated = validateManifest(manifest);
  const payload = utf8ToBytes(stableManifestJson(validated));
  return encodePayloadFrame(`${PROTOCOL_VERSION}|M|${sessionId}`, payload);
}

export function encodeDataFrame(
  sessionId: string,
  index: number,
  total: number,
  payload: Uint8Array,
): string {
  assertSessionId(sessionId);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) || total < 1 || index < 0 || index >= total) {
    throw new Error('invalid chunk position');
  }
  return encodePayloadFrame(`${PROTOCOL_VERSION}|D|${sessionId}|${index}|${total}`, payload);
}

function randomSessionId(): string {
  const bytes = new Uint8Array(8);
  const cryptoObject = (globalThis as unknown as {
    crypto?: {getRandomValues?: (value: Uint8Array) => Uint8Array};
  }).crypto;
  if (cryptoObject?.getRandomValues != null) {
    cryptoObject.getRandomValues(bytes);
  } else {
    // Session IDs isolate concurrent streams; they are not cryptographic keys.
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

export interface SenderFile {
  bytes: Uint8Array;
  fileName: string;
  mime: string;
}

export class QRB1SenderSession {
  readonly sessionId: string;
  readonly profile: TransferProfile;
  readonly manifest: Manifest;
  readonly cycleLength: number;
  readonly manifestFrame: string;

  private readonly bytes: Uint8Array;
  private readonly schedule: number[];

  constructor(file: SenderFile, profileName: ProfileName, sessionId = randomSessionId()) {
    if (file.bytes.length > MAX_FILE_SIZE) {
      throw new Error(`file exceeds ${MAX_FILE_SIZE} byte limit`);
    }
    assertSessionId(sessionId);
    this.bytes = file.bytes;
    this.sessionId = sessionId;
    this.profile = TRANSFER_PROFILES[profileName];
    const totalChunks = file.bytes.length === 0 ? 0 : Math.ceil(file.bytes.length / this.profile.chunkSize);
    this.manifest = {
      protocol: PROTOCOL_VERSION,
      fileName: sanitizeFilename(file.fileName),
      mime: file.mime || 'application/octet-stream',
      fileSize: file.bytes.length,
      chunkSize: this.profile.chunkSize,
      totalChunks,
      sha256: bytesToHex(sha256(file.bytes)),
    };
    this.manifestFrame = encodeManifestFrame(sessionId, this.manifest);
    this.schedule = [-1];
    for (let index = 0; index < totalChunks; index += 1) {
      this.schedule.push(index);
      if ((index + 1) % MANIFEST_INTERVAL === 0 && index + 1 < totalChunks) {
        this.schedule.push(-1);
      }
    }
    this.cycleLength = this.schedule.length;
  }

  frameAt(position: number): string {
    if (!Number.isSafeInteger(position) || position < 0) {
      throw new Error('position must be a non-negative integer');
    }
    const entry = this.schedule[position % this.cycleLength];
    if (entry === -1) {
      return this.manifestFrame;
    }
    const start = entry * this.profile.chunkSize;
    const payload = this.bytes.slice(start, start + this.profile.chunkSize);
    return encodeDataFrame(this.sessionId, entry, this.manifest.totalChunks, payload);
  }
}
