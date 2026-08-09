import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the QRBeam landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /QRBeam/);
  assert.match(html, /让文件/);
  assert.match(html, /Python/);
  assert.match(html, /Node\.js/);
  assert.match(html, /\/privacy/);
  assert.match(html, /\/support/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("includes the requested standalone pages and social card", async () => {
  const [install, privacy, support, i18n, localeHome] = await Promise.all([
    readFile(new URL("app/install/page.tsx", root), "utf8"),
    readFile(new URL("app/privacy/page.tsx", root), "utf8"),
    readFile(new URL("app/support/page.tsx", root), "utf8"),
    readFile(new URL("app/i18n.ts", root), "utf8"),
    readFile(new URL("app/[locale]/page.tsx", root), "utf8"),
  ]);

  assert.match(install, /pip install --upgrade qrbeam/);
  assert.match(install, /npm install --global qrbeam/);
  assert.match(privacy, /LocalizedPrivacy/);
  assert.match(support, /mailto:lsl8315@163.com/);
  assert.doesNotMatch(support, /GitHub/);
  for (const locale of ["zh", "en", "ja", "ko", "fr", "de"]) assert.match(i18n, new RegExp(`\\b${locale}:`));
  assert.match(localeHome, /generateStaticParams/);
  await access(new URL("public/og.png", root));
  await assert.rejects(access(new URL("app\/_sites-preview", root)));
});
