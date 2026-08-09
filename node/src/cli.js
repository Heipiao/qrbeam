import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import open from "open";

import { MAX_FILE_SIZE, PROFILES, TransferSession } from "./protocol.js";
import { startServer } from "./server.js";

const VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version;

function usage() {
  return `usage: qrbeam send FILE [--profile safe|fast] [--port 8765] [--no-open]

Send files as animated QR codes

commands:
  send FILE      display a file as a looping QR stream

options:
  --profile      safe (default) or fast
  --port         local HTTP port (default: 8765)
  --no-open      do not open the browser
  -h, --help     show this help message
  -v, --version  show the package version`;
}

function parseArguments(argv) {
  if (argv.includes("-h") || argv.includes("--help")) {
    return { help: true };
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    return { version: true };
  }
  if (argv[0] !== "send" || !argv[1] || argv[1].startsWith("-")) {
    throw new Error("expected: qrbeam send FILE");
  }
  const options = {
    command: "send",
    file: argv[1],
    profile: "safe",
    port: 8765,
    noOpen: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-open") {
      options.noOpen = true;
      continue;
    }
    const [flag, inlineValue] = argument.split("=", 2);
    if (flag !== "--profile" && flag !== "--port") {
      throw new Error(`unknown option: ${argument}`);
    }
    const value = inlineValue ?? argv[++index];
    if (!value) {
      throw new Error(`missing value for ${flag}`);
    }
    if (flag === "--profile") {
      if (!Object.hasOwn(PROFILES, value)) {
        throw new Error("profile must be safe or fast");
      }
      options.profile = value;
    } else {
      if (!/^\d+$/.test(value)) {
        throw new Error("port must be between 1 and 65535");
      }
      options.port = Number(value);
      if (
        !Number.isSafeInteger(options.port) ||
        options.port < 1 ||
        options.port > 65535
      ) {
        throw new Error("port must be between 1 and 65535");
      }
    }
  }
  return options;
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    console.error(`error: ${error.message}`);
    console.error(usage());
    return 2;
  }
  if (options.help) {
    console.log(usage());
    return 0;
  }
  if (options.version) {
    console.log(VERSION);
    return 0;
  }

  const filePath = path.resolve(options.file);
  let fileStat;
  try {
    fileStat = statSync(filePath);
  } catch {
    console.error(`error: file does not exist: ${filePath}`);
    return 2;
  }
  if (!fileStat.isFile()) {
    console.error(`error: file does not exist: ${filePath}`);
    return 2;
  }
  if (fileStat.size > MAX_FILE_SIZE) {
    console.error(
      `error: file is ${fileStat.size} bytes; MVP limit is ${MAX_FILE_SIZE} bytes (5 MiB)`
    );
    return 2;
  }

  let session;
  try {
    session = new TransferSession(filePath, PROFILES[options.profile]);
  } catch (error) {
    console.error(`error: could not read file: ${error.message}`);
    return 2;
  }

  let server;
  let actualPort;
  try {
    ({ server, port: actualPort } = await startServer(session, options.port));
  } catch (error) {
    console.error(
      `error: could not listen on 127.0.0.1:${options.port}: ${error.message}`
    );
    return 2;
  }

  const url = `http://127.0.0.1:${actualPort}/`;
  console.log(`QRBeam session: ${session.sessionId}`);
  console.log(`File: ${session.manifest.fileName} (${fileStat.size} bytes)`);
  console.log(
    `Profile: ${session.profile.name} — ${session.profile.chunkSize} bytes/chunk, ${session.profile.fps} fps, ECC ${session.profile.errorCorrection}`
  );
  console.log(`Frames per loop: ${session.cycleLength}`);
  console.log(`Open: ${url}`);
  console.log("Press Ctrl+C to stop.");
  if (!options.noOpen) {
    open(url, { wait: false }).catch((error) => {
      console.error(`warning: could not open browser: ${error.message}`);
    });
  }

  await new Promise((resolve) => {
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      console.log("\nStopping QRBeam…");
      await closeServer(server);
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  return 0;
}
