import fs from "node:fs";
import path from "node:path";

export const FEATURE_IMAGE_QA_VERSION = "2026-08-feature-image-v5";
export const GEMINI_PREVIEW_DIMENSIONS = { width: 1024, height: 506 };

export const FEATURE_IMAGE_QA_CHECKLIST = [
  "The image is Gemini's smaller generated preview image, saved or captured from the preview viewer. Do not use Gemini's full-size export for this project.",
  "The image is exactly Gemini's 1024x506 generated preview. Do not use a screenshot, crop, thumbnail, or full-size export.",
  "The image is visually polished: balanced composition, intentional color, clean contrast, and no obvious generation artifacts.",
  "The image clearly features the Paperclipalypse paperclip stand-up comic on or near a microphone.",
  "The image includes a visual scene inspired by the winning joke, not a generic or unrelated scene.",
  "The stage and joke scenario read as one continuous illustration without white gutters, hard section borders, or a boxy three-panel layout; the right-side joke text may remain in a distinct frame.",
  "Human and animal anatomy looks intentional and clean: no extra arms, extra hands, fused limbs, duplicated body parts, or obviously broken joints.",
  "The image is not monochrome or sepia-only unless explicitly requested for that round.",
  "The image contains no visible prompt labels, layout labels, percentages, watermarks, signatures, or fake filler text.",
  "Any joke text shown inside the image is legible enough not to distract; if Gemini garbles the text badly, reject and regenerate.",
  "The exact joke text remains available as HTML on the site even if the image includes stylized text."
];

export function qaFeatureImageFile(filePath, { visualApproved = false, allowWebPreview = true } = {}) {
  const absolutePath = path.resolve(filePath);
  const errors = [];
  const warnings = [];
  let dimensions = null;
  let sizeBytes = 0;

  if (!fs.existsSync(absolutePath)) {
    errors.push(`Feature image file does not exist: ${filePath}`);
  } else {
    const stat = fs.statSync(absolutePath);
    sizeBytes = stat.size;
    dimensions = readImageDimensions(absolutePath);

    if (!dimensions) {
      errors.push("Feature image dimensions could not be read. Use a PNG, JPEG, or WebP image.");
    } else {
      if (
        dimensions.width !== GEMINI_PREVIEW_DIMENSIONS.width ||
        dimensions.height !== GEMINI_PREVIEW_DIMENSIONS.height
      ) {
        errors.push(
          `Feature image is ${dimensions.width}x${dimensions.height}. Use Gemini's exact ${GEMINI_PREVIEW_DIMENSIONS.width}x${GEMINI_PREVIEW_DIMENSIONS.height} chat preview, not a screenshot, crop, thumbnail, or full-size export.`
        );
      }
    }

    if (sizeBytes < 100_000) {
      errors.push("Feature image file is suspiciously small; verify this is not a thumbnail or failed download.");
    }
    if (sizeBytes > 12_000_000) {
      warnings.push("Feature image file is larger than 12MB; consider optimizing after approval.");
    }
  }

  if (!visualApproved) {
    errors.push("Visual QA has not been approved. Regenerate low-quality Gemini images until the checklist passes, then rerun with --feature-image-qa-approved.");
  }

  return {
    version: FEATURE_IMAGE_QA_VERSION,
    passed: errors.length === 0,
    visualApproved,
    allowWebPreview,
    assetType: "gemini-web-preview",
    dimensions,
    sizeBytes,
    errors,
    warnings,
    checklist: [...FEATURE_IMAGE_QA_CHECKLIST]
  };
}

export function assertFeatureImageQa(filePath, options) {
  const qa = qaFeatureImageFile(filePath, options);
  if (!qa.passed) {
    throw new Error(formatFeatureImageQaFailure(qa));
  }

  return qa;
}

export function featureImageQaChecklistText() {
  return FEATURE_IMAGE_QA_CHECKLIST.map((item) => `- ${item}`).join("\n");
}

export function formatFeatureImageQaFailure(qa) {
  return [
    "Feature image QA failed:",
    ...qa.errors.map((error) => `- ${error}`),
    qa.warnings.length ? "Warnings:" : "",
    ...qa.warnings.map((warning) => `- ${warning}`),
    "QA checklist:",
    featureImageQaChecklistText()
  ].filter(Boolean).join("\n");
}

export function readImageDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  return readPngDimensions(buffer) || readJpegDimensions(buffer) || readWebpDimensions(buffer);
}

function readPngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    buffer.readUInt32BE(0) !== 0x89504e47 ||
    buffer.readUInt32BE(4) !== 0x0d0a1a0a
  ) {
    return null;
  }

  return {
    format: "png",
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (offset + 2 > buffer.length) {
      break;
    }

    const length = buffer.readUInt16BE(offset);
    if (isJpegStartOfFrame(marker) && offset + 7 < buffer.length) {
      return {
        format: "jpeg",
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3)
      };
    }
    offset += length;
  }

  return null;
}

function readWebpDimensions(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (chunk === "VP8X" && dataOffset + 10 <= buffer.length) {
      return {
        format: "webp",
        width: 1 + readUInt24LE(buffer, dataOffset + 4),
        height: 1 + readUInt24LE(buffer, dataOffset + 7)
      };
    }
    if (chunk === "VP8L" && dataOffset + 5 <= buffer.length && buffer[dataOffset] === 0x2f) {
      const b1 = buffer[dataOffset + 1];
      const b2 = buffer[dataOffset + 2];
      const b3 = buffer[dataOffset + 3];
      const b4 = buffer[dataOffset + 4];
      return {
        format: "webp",
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))
      };
    }
    if (
      chunk === "VP8 " &&
      dataOffset + 10 <= buffer.length &&
      buffer[dataOffset + 3] === 0x9d &&
      buffer[dataOffset + 4] === 0x01 &&
      buffer[dataOffset + 5] === 0x2a
    ) {
      return {
        format: "webp",
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff
      };
    }

    offset += 8 + size + (size % 2);
  }

  return null;
}

function isJpegStartOfFrame(marker) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}
