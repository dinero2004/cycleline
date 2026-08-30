import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("production build renders the CycleLine route planner", async () => {
  const html = await readFile(
    new URL("../.next/server/app/index.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /<title>CycleLine — Better routes for every ride<\/title>/i);
  assert.match(html, /Choose your line\./);
  assert.match(html, /Find my line/);
  assert.match(html, /Pick your line/);
  assert.match(html, /Great conditions/);
  assert.match(html, /After-work loop/);
  assert.match(html, /og:image/);
  assert.doesNotMatch(html, /Personal route intelligence/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps the production surface clean and interactive", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /^"use client";/);
  assert.match(page, /aria-label="Route preference"/);
  assert.match(page, /localStorage\.setItem\("cycleline-saved-route"/);
  assert.match(layout, /VERCEL_PROJECT_PRODUCTION_URL/);
  assert.match(layout, /title: "CycleLine/);
  assert.match(packageJson, /"name": "cycleline"/);
  assert.match(packageJson, /"build": "next build"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL(".next/BUILD_ID", projectRoot));
  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});
