import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractGeminiImagePrompt } from "./lib/feature-image-prompt.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const briefArg = args.get("brief") || process.argv.slice(2).find((item) => !item.startsWith("--"));

if (!briefArg) {
  console.error("Usage: node scripts/prepare-feature-image-prompt.mjs --brief data/image-briefs/<round>.md [--out tmp/gemini-feature-images/<round>.prompt.txt]");
  process.exit(2);
}

const briefPath = path.resolve(rootDir, briefArg);
const defaultName = `${path.basename(briefPath, path.extname(briefPath))}.prompt.txt`;
const outPath = path.resolve(rootDir, args.get("out") || path.join("tmp", "gemini-feature-images", defaultName));

try {
  const brief = await fs.readFile(briefPath, "utf8");
  const prompt = extractGeminiImagePrompt(brief, briefArg);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const tempPath = `${outPath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, prompt, "utf8");
  await fs.rename(tempPath, outPath);

  console.log(`Browser-safe Gemini prompt written: ${path.relative(rootDir, outPath)}`);
  console.log("Read this plain-text file directly in browser automation; do not parse Markdown or embed the prompt in a JavaScript string literal.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.set(key, true);
    } else {
      parsed.set(key, next);
      index += 1;
    }
  }
  return parsed;
}
