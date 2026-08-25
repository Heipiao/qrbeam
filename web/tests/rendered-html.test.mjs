import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});

test("privacy language switch uses native navigation", async () => {
  const [response, languageMenu, home, siteComponents, reviewDemo] = await Promise.all([
    render("/privacy"),
    readFile(new URL("app/language-menu.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/site-components.tsx", root), "utf8"),
    readFile(new URL("app/review-demo/review-demo.tsx", root), "utf8"),
  ]);

  assert.equal(response.status, 200);
  const html = await response.text();
  for (const href of ["/privacy", "/en/privacy", "/ja/privacy", "/ko/privacy", "/fr/privacy", "/de/privacy"]) {
    assert.match(html, new RegExp(`href="${href}"`));
  }
  assert.match(languageMenu, /<a\b/);
  assert.match(languageMenu, /window\.localStorage\.setItem/);
  assert.match(languageMenu, /navigator\.languages/);
  assert.match(languageMenu, /window\.location\.replace/);
  for (const source of [languageMenu, home, siteComponents, reviewDemo]) {
    assert.doesNotMatch(source, /next\/link|<Link\b/);
  }
});

test("serves the unlinked App Review demo and exact public fixture", async () => {
  const [response, fixture] = await Promise.all([
    render("/review-demo"),
    readFile(new URL("public/review-demo/fixture.txt", root)),
  ]);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /App Review Demo/);
  assert.match(html, /fixture\.txt/);
  assert.match(html, /764a2dca7d4481299879e4059ad2bd73cf5fa762571ac4a3174372a0ffb83aec/);
  assert.equal(createHash("sha256").update(fixture).digest("hex"), "764a2dca7d4481299879e4059ad2bd73cf5fa762571ac4a3174372a0ffb83aec");
});
