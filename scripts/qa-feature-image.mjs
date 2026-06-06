import { qaFeatureImageFile, formatFeatureImageQaFailure } from "./lib/image-qa.mjs";

const args = parseArgs(process.argv.slice(2));
const imagePath = args.get("image") || args.get("feature-image") || process.argv.slice(2).find((item) => !item.startsWith("--"));

if (!imagePath) {
  console.error("Usage: node scripts/qa-feature-image.mjs --image /path/to/image.png [--approved] [--allow-preview]");
  process.exit(2);
}

const qa = qaFeatureImageFile(imagePath, {
  visualApproved: args.has("approved"),
  allowWebPreview: args.has("allow-preview") || args.has("allow-web-preview")
});

if (!qa.passed) {
  console.error(formatFeatureImageQaFailure(qa));
  process.exit(1);
}

console.log(`Feature image QA passed: ${imagePath}`);
console.log(`Dimensions: ${qa.dimensions.width}x${qa.dimensions.height} ${qa.dimensions.format.toUpperCase()}`);
console.log(`Asset type: ${qa.assetType}`);
if (qa.warnings.length) {
  console.log("Warnings:");
  for (const warning of qa.warnings) {
    console.log(`- ${warning}`);
  }
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
