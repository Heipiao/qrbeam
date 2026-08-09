import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const wranglerDir = dirname(require.resolve("wrangler/package.json"));
let esbuildPath;

try {
  esbuildPath = require.resolve("esbuild");
} catch {
  esbuildPath = resolve(wranglerDir, "node_modules/esbuild/lib/main.js");
}

const { build } = await import(pathToFileURL(esbuildPath).href);

const root = process.cwd();
const clientDir = resolve(root, "dist/client");
const pagesDir = resolve(root, "dist/pages");

await rm(pagesDir, { recursive: true, force: true });
await mkdir(pagesDir, { recursive: true });
await cp(clientDir, pagesDir, { recursive: true });

await build({
  entryPoints: [resolve(root, "scripts/pages-worker.ts")],
  outfile: resolve(pagesDir, "_worker.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  conditions: ["workerd", "worker", "browser"],
  external: ["node:*"],
  sourcemap: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
});

// The Vite plugin points Wrangler at its Workers build. Pages commands must
// instead read the source-controlled Pages configuration at the project root.
await rm(resolve(root, ".wrangler/deploy/config.json"), { force: true });

console.log(`Cloudflare Pages output: ${pagesDir}`);
