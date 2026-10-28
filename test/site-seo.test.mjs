import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { renderSite } from "../scripts/lib/site.mjs";

test("public archive exposes all contests while search excludes dry runs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paperclipalypse-seo-"));
  try {
    const historyDir = path.join(root, "history");
    const siteDir = path.join(root, "site");
    fs.mkdirSync(historyDir);
    const fixture = JSON.parse(fs.readFileSync(new URL("../data/runs/2026-10-17-external-real-2026-10-17.json", import.meta.url), "utf8"));
    const runs = Array.from({ length: 13 }, (_, index) => ({ ...fixture, slug: `public-${index}` }));
    const demo = { ...fixture, slug: "test-only", dryRun: true };
    for (const run of [...runs, demo]) fs.writeFileSync(path.join(historyDir, `${run.slug}.json`), JSON.stringify(run));
    renderSite({ run: runs[0], historyDir, siteDir });
    const read = (file) => fs.readFileSync(path.join(siteDir, file), "utf8");
    const archive = read("archive.html");
    for (const run of runs) assert.ok(archive.includes(`href="./runs/${run.slug}.html"`));
    assert.ok(!archive.includes("test-only"));
    assert.ok(!read("sitemap.xml").includes("test-only"));
    assert.match(read("runs/test-only.html"), /content="noindex, follow"/);
    assert.match(read("runs/public-0.html"), /href="..\/archive.html"/);
    assert.match(read("index.html"), /<title>Paperclipalypse \| AI Comedy Tournament, Jokes &amp; Rankings<\/title>/);
    assert.match(read("sitemap.xml"), /<loc>https:\/\/paperclipalypse.com\/archive.html<\/loc>/);
    for (const file of ["index.html", "archive.html", "runs/public-0.html"]) {
      const html = read(file);
      assert.equal([...html.matchAll(/<h1(?:\s[^>]*)?>/g)].length, 1);
      for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("normal publishing leaves unrelated historical run pages untouched", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paperclipalypse-incremental-site-"));
  try {
    const historyDir = path.join(root, "history");
    const siteDir = path.join(root, "site");
    fs.mkdirSync(historyDir);
    const fixture = JSON.parse(fs.readFileSync(new URL("../data/runs/2026-10-17-external-real-2026-10-17.json", import.meta.url), "utf8"));
    const makeRun = (slug, createdAt) => ({ ...fixture, slug, createdAt, publishedDate: createdAt.slice(0, 10) });
    const oldest = makeRun("oldest", "2026-01-01T12:00:00.000Z");
    const middle = makeRun("middle", "2026-01-02T12:00:00.000Z");
    const latest = makeRun("latest", "2026-01-03T12:00:00.000Z");

    for (const run of [oldest, middle, latest]) {
      fs.writeFileSync(path.join(historyDir, `${run.slug}.json`), JSON.stringify(run));
    }
    renderSite({ run: latest, historyDir, siteDir, rebuildRunPages: true });

    const oldestPage = path.join(siteDir, "runs", "oldest.html");
    fs.appendFileSync(oldestPage, "<!-- preserved historical page -->\n");

    const newest = makeRun("newest", "2026-01-04T12:00:00.000Z");
    fs.writeFileSync(path.join(historyDir, `${newest.slug}.json`), JSON.stringify(newest));
    renderSite({ run: newest, historyDir, siteDir });

    assert.match(fs.readFileSync(oldestPage, "utf8"), /preserved historical page/);
    assert.match(fs.readFileSync(path.join(siteDir, "runs", "latest.html"), "utf8"), /rel="next" href="https:\/\/paperclipalypse.com\/runs\/newest.html"/);
    assert.doesNotMatch(fs.readFileSync(path.join(siteDir, "runs", "newest.html"), "utf8"), /Recent Paperclipalypse episodes/);

    renderSite({ run: newest, historyDir, siteDir, rebuildRunPages: true });
    assert.doesNotMatch(fs.readFileSync(oldestPage, "utf8"), /preserved historical page/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
