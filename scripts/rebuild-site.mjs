import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite } from "./lib/site.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const historyDir = path.join(rootDir, "data", "runs");
const siteDir = path.join(rootDir, "site");

const runs = fs
  .readdirSync(historyDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(fs.readFileSync(path.join(historyDir, file), "utf8")))
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const latestPublicRun = runs.find((run) => !run.dryRun);

if (!latestPublicRun) {
  throw new Error("Cannot rebuild the site without at least one public run.");
}

renderSite({
  run: latestPublicRun,
  historyDir,
  siteDir,
  rebuildRunPages: true
});

console.log(`Rebuilt the complete site through ${latestPublicRun.slug}.`);
