import fs from "node:fs/promises";

const briefPath = process.argv[2];

if (!briefPath) {
  console.error("Usage: node scripts/extract-feature-image-prompt.mjs <image-brief.md>");
  process.exit(2);
}

const brief = await fs.readFile(briefPath, "utf8");
const match = brief.match(/## Gemini Image Prompt\s+```text\n([\s\S]*?)\n```/);

if (!match) {
  console.error(`Could not find the Gemini Image Prompt block in ${briefPath}`);
  process.exit(1);
}

process.stdout.write(`${match[1]}\n`);
