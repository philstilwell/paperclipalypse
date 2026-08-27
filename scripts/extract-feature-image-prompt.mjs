import fs from "node:fs/promises";
import { extractGeminiImagePrompt } from "./lib/feature-image-prompt.mjs";

const briefPath = process.argv[2];

if (!briefPath) {
  console.error("Usage: node scripts/extract-feature-image-prompt.mjs <image-brief.md>");
  process.exit(2);
}

try {
  const brief = await fs.readFile(briefPath, "utf8");
  process.stdout.write(extractGeminiImagePrompt(brief, briefPath));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
