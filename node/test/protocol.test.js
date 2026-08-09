import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  MAX_FILE_SIZE,
  PROFILES,
  TransferSession,
  b64urlDecode,
  parseFrame,
  sanitizeFilename,
} from "../src/protocol.js";

function temporaryFile(name, data) {
  const directory = mkdtempSync(path.join(tmpdir(), "qrbeam-node-"));
  const filePath = path.join(directory, name);
  writeFileSync(filePath, data);
  return filePath;
}

test("matches the shared Python and React Native fixture byte-for-byte", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../../protocol/test-vector.json", import.meta.url),
      "utf8"
    )
  );
  const source = temporaryFile(
    fixture.fileName,
    Buffer.from(fixture.sourceUtf8, "utf8")
  );
  const session = new TransferSession(source, PROFILES.safe, {
    sessionId: fixture.sessionId,
  });
  assert.equal(session.manifestFrame, fixture.manifestFrame);
  assert.equal(session.dataFrames[0], fixture.dataFrame);
  assert.equal(
    parseFrame(fixture.dataFrame).payload.toString("utf8"),
    fixture.sourceUtf8
  );
});

test("supports Unicode filenames and portable sanitization", () => {
  const source = temporaryFile(
    "报告 2026?.txt",
    Buffer.from("二维码 transfer ✅\n".repeat(100))
  );
  const session = new TransferSession(source, PROFILES.safe, {
    sessionId: "0123456789abcdef",
  });
  assert.equal(session.manifest.fileName, "报告 2026_.txt");
  assert.equal(sanitizeFilename("../secret.txt"), "secret.txt");
  assert.equal(sanitizeFilename("folder\\secret.txt"), "secret.txt");
  assert.equal(sanitizeFilename("a:b?.zip"), "a_b_.zip");
  assert.equal(sanitizeFilename("..."), "received-file");
});

test("inserts a manifest after each twenty data frames", () => {
  const source = temporaryFile("sample.bin", Buffer.alloc(480 * 21, 7));
  const session = new TransferSession(source, PROFILES.safe, {
    sessionId: "aaaaaaaaaaaaaaaa",
  });
  const positions = session.frames
    .map((frame, index) => (frame === session.manifestFrame ? index : -1))
    .filter((index) => index >= 0);
  assert.deepEqual(positions, [0, 21]);
});

test("rejects corrupt CRC and oversized input", () => {
  const source = temporaryFile("sample.bin", Buffer.from("hello"));
  const session = new TransferSession(source, PROFILES.fast, {
    sessionId: "bbbbbbbbbbbbbbbb",
  });
  const frame = session.dataFrames[0];
  const corrupt = `${frame.slice(0, -1)}${frame.endsWith("0") ? "1" : "0"}`;
  assert.throws(() => parseFrame(corrupt), /crc32 mismatch/);

  const oversized = temporaryFile(
    "too-large.bin",
    Buffer.alloc(MAX_FILE_SIZE + 1)
  );
  assert.throws(() => new TransferSession(oversized, PROFILES.fast), /exceeds/);
});

test("encodes empty files and unpadded Base64URL correctly", () => {
  const empty = temporaryFile("empty.dat", Buffer.alloc(0));
  const emptySession = new TransferSession(empty, PROFILES.safe, {
    sessionId: "cccccccccccccccc",
  });
  assert.equal(emptySession.manifest.totalChunks, 0);
  assert.deepEqual(emptySession.frames, [emptySession.manifestFrame]);

  const tiny = temporaryFile("tiny.bin", Buffer.from([0xfb, 0xff]));
  const tinySession = new TransferSession(tiny, PROFILES.safe, {
    sessionId: "dddddddddddddddd",
  });
  const payload = tinySession.dataFrames[0].split("|")[5];
  assert.doesNotMatch(payload, /[+/=]/);
  assert.deepEqual(b64urlDecode(payload), Buffer.from([0xfb, 0xff]));
});
