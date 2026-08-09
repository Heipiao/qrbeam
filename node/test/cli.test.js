import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const executable = fileURLToPath(new URL("../bin/qrbeam.js", import.meta.url));
const packageVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version;

test("prints help and version", () => {
  const help = spawnSync(process.execPath, [executable, "--help"], {
    encoding: "utf8",
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /qrbeam send FILE/);

  const version = spawnSync(process.execPath, [executable, "--version"], {
    encoding: "utf8",
  });
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), packageVersion);
});

test("rejects missing files and invalid options", () => {
  const missing = spawnSync(
    process.execPath,
    [executable, "send", "does-not-exist.zip"],
    {
      encoding: "utf8",
    }
  );
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /file does not exist/);

  const invalid = spawnSync(
    process.execPath,
    [executable, "send", "x", "--profile", "turbo"],
    {
      encoding: "utf8",
    }
  );
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /profile must be safe or fast/);
});
