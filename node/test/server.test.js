import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { PROFILES, TransferSession } from "../src/protocol.js";
import { startServer } from "../src/server.js";

test("serves the local page, health endpoint, and QR PNG", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "qrbeam-node-server-"));
  const source = path.join(directory, "hello.txt");
  writeFileSync(source, "hello QRBeam");
  const session = new TransferSession(source, PROFILES.safe, {
    sessionId: "eeeeeeeeeeeeeeee",
  });
  const { server, port } = await startServer(session, 0);
  try {
    assert.equal(server.address().address, "127.0.0.1");
    const page = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /hello\.txt/);
    assert.match(page.headers.get("content-security-policy"), /default-src/);

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.deepEqual(await health.json(), { status: "ok" });

    const image = await fetch(`http://127.0.0.1:${port}/frame.png?position=0`);
    assert.equal(image.headers.get("content-type"), "image/png");
    const signature = Buffer.from(await image.arrayBuffer()).subarray(0, 8);
    assert.deepEqual(
      signature,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );

    const invalid = await fetch(
      `http://127.0.0.1:${port}/frame.png?position=nope`
    );
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
