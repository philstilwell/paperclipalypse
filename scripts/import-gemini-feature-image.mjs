import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { qaFeatureImageFile, formatFeatureImageQaFailure, readImageDimensions } from "./lib/image-qa.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const targetRatio = 2;
const minOutputWidth = Number(args.get("min-width") || 1600);
const minOutputHeight = Number(args.get("min-height") || 800);
const sinceHours = Number(args.get("since-hours") || 72);

if (args.has("list")) {
  listCandidates({
    downloadsDir: path.resolve(expandHome(args.get("downloads") || process.env.PAPERCLIPALYPSE_DOWNLOADS_DIR || "~/Downloads")),
    sinceHours,
    minOutputWidth,
    minOutputHeight
  });
  process.exit(0);
}

const sourcePath = args.get("source")
  ? path.resolve(rootDir, expandHome(args.get("source")))
  : findLatestQualifiedDownload({
      downloadsDir: path.resolve(expandHome(args.get("downloads") || process.env.PAPERCLIPALYPSE_DOWNLOADS_DIR || "~/Downloads")),
      sinceHours,
      minOutputWidth,
      minOutputHeight
    });

if (!sourcePath) {
  console.error("No qualified high-resolution Gemini download found.");
  console.error("Use --source /path/to/Gemini_Generated_Image.png if the intended image is elsewhere.");
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Source image not found: ${sourcePath}`);
  process.exit(1);
}

const sourceDimensions = readImageDimensions(sourcePath);
if (!sourceDimensions) {
  console.error(`Could not read source image dimensions: ${sourcePath}`);
  process.exit(1);
}

const crop = centeredTwoToOneCrop(sourceDimensions);
if (crop.width < minOutputWidth || crop.height < minOutputHeight) {
  console.error(
    `Source image would crop to only ${crop.width}x${crop.height}; minimum is ${minOutputWidth}x${minOutputHeight}.`
  );
  console.error(`Source dimensions: ${sourceDimensions.width}x${sourceDimensions.height}`);
  process.exit(1);
}

const slug = args.get("slug") || slugFromSource(sourcePath);
const outPath = args.get("out")
  ? path.resolve(rootDir, expandHome(args.get("out")))
  : path.join(rootDir, "tmp", "gemini-feature-images", `${slug}.png`);

if (args.has("dry-run")) {
  printPlan({ sourcePath, outPath, sourceDimensions, crop, slug, wrote: false });
  process.exit(0);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const sips = spawnSync("sips", [
  "--cropToHeightWidth",
  String(crop.height),
  String(crop.width),
  sourcePath,
  "--out",
  outPath
], {
  encoding: "utf8"
});

if (sips.status !== 0) {
  console.error("sips failed while cropping the Gemini image:");
  console.error(sips.stderr || sips.stdout || "(no output)");
  process.exit(sips.status || 1);
}

const qa = qaFeatureImageFile(outPath, {
  // This checks file properties only; visual approval still happens by human review.
  visualApproved: true,
  allowWebPreview: false
});

if (!qa.passed) {
  console.error(formatFeatureImageQaFailure(qa));
  process.exit(1);
}

printPlan({ sourcePath, outPath, sourceDimensions, crop, slug, wrote: true, qa });

function findLatestQualifiedDownload({ downloadsDir, sinceHours, minOutputWidth, minOutputHeight }) {
  const candidates = scanCandidates({
    downloadsDir,
    sinceHours,
    minOutputWidth,
    minOutputHeight
  }).filter((candidate) => candidate.qualified);

  candidates.sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return b.crop.width * b.crop.height - a.crop.width * a.crop.height;
  });

  return candidates[0]?.path || null;
}

function scanCandidates({ downloadsDir, sinceHours, minOutputWidth, minOutputHeight }) {
  if (!fs.existsSync(downloadsDir)) {
    return [];
  }

  const cutoff = Date.now() - sinceHours * 60 * 60 * 1000;
  const allowedExts = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  const files = fs.readdirSync(downloadsDir)
    .map((name) => path.join(downloadsDir, name))
    .filter((filePath) => {
      const name = path.basename(filePath);
      const ext = path.extname(name).toLowerCase();
      return (
        (allowedExts.has(ext) || ext === "" || name.startsWith(".com.google.Chrome.")) &&
        !name.includes(".crdownload") &&
        !name.startsWith("Unconfirmed ")
      );
    });

  return files.map((filePath) => {
    const stat = safeStat(filePath);
    const dimensions = stat?.isFile() ? readImageDimensions(filePath) : null;
    const crop = dimensions ? centeredTwoToOneCrop(dimensions) : null;
    const reasons = [];
    if (!stat?.isFile()) reasons.push("not a regular file");
    if (stat && stat.size < 100_000) reasons.push("too small to trust as a full Gemini export");
    if (stat && stat.mtimeMs < cutoff) reasons.push(`older than ${sinceHours} hours`);
    if (!dimensions) reasons.push("dimensions unreadable");
    if (crop && (crop.width < minOutputWidth || crop.height < minOutputHeight)) {
      reasons.push(`2:1 crop would be ${crop.width}x${crop.height}, below ${minOutputWidth}x${minOutputHeight}`);
    }

    return {
      path: filePath,
      name: path.basename(filePath),
      mtimeMs: stat?.mtimeMs || 0,
      size: stat?.size || 0,
      dimensions,
      crop,
      qualified: reasons.length === 0,
      reasons
    };
  }).sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function listCandidates(options) {
  const candidates = scanCandidates(options);
  if (!candidates.length) {
    console.log("No image candidates found.");
    return;
  }

  for (const candidate of candidates.slice(0, 20)) {
    const dims = candidate.dimensions
      ? `${candidate.dimensions.width}x${candidate.dimensions.height}`
      : "unknown";
    const crop = candidate.crop ? `crop ${candidate.crop.width}x${candidate.crop.height}` : "no crop";
    const status = candidate.qualified ? "qualified" : `rejected: ${candidate.reasons.join("; ")}`;
    console.log(`${candidate.name}: ${dims}, ${crop}, ${Math.round(candidate.size / 1024)} KB, ${status}`);
  }
}

function centeredTwoToOneCrop(dimensions) {
  const width = dimensions.width;
  const height = dimensions.height;
  const ratio = width / height;

  if (Math.abs(ratio - targetRatio) < 0.001) {
    return { width, height };
  }

  if (ratio > targetRatio) {
    const cropWidth = Math.floor(height * targetRatio);
    return { width: cropWidth, height };
  }

  const cropHeight = Math.floor(width / targetRatio);
  return { width, height: cropHeight };
}

function printPlan({ sourcePath, outPath, sourceDimensions, crop, slug, wrote, qa }) {
  console.log(wrote ? "Gemini feature image imported." : "Gemini feature image import dry run.");
  console.log(`Source: ${sourcePath}`);
  console.log(`Source dimensions: ${sourceDimensions.width}x${sourceDimensions.height} ${sourceDimensions.format.toUpperCase()}`);
  console.log(`Prepared 2:1 dimensions: ${crop.width}x${crop.height}`);
  console.log(`Output: ${outPath}`);
  if (qa?.warnings?.length) {
    console.log("Warnings:");
    for (const warning of qa.warnings) {
      console.log(`- ${warning}`);
    }
  }
  console.log("");
  console.log("After visual approval, run:");
  const commandPath = commandDisplayPath(outPath);
  console.log(`node scripts/qa-feature-image.mjs --image ${shellQuote(commandPath)} --approved`);
  console.log(`node scripts/run-tournament.mjs --episode-file data/inbox/<episode>.json --feature-image ${shellQuote(commandPath)} --feature-image-qa-approved`);
  if (!args.get("slug")) {
    console.log("");
    console.log(`Tip: pass --slug ${slug} to make this output deterministic for a specific round.`);
  }
}

function slugFromSource(filePath) {
  const base = path.basename(filePath, path.extname(filePath))
    .replace(/^Gemini[_ -]Generated[_ -]Image[_ -]?/i, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return base ? `${stamp}-${base}` : `gemini-feature-${stamp}`;
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
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

function expandHome(value) {
  if (!value || value === "~") {
    return process.env.HOME || value;
  }
  if (value.startsWith("~/")) {
    return path.join(process.env.HOME || "", value.slice(2));
  }
  return value;
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function commandDisplayPath(filePath) {
  const relativePath = path.relative(rootDir, filePath);
  if (relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return filePath;
}
