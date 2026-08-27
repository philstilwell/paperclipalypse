import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { extractGeminiImagePrompt } from "../scripts/lib/feature-image-prompt.mjs";
import { GEMINI_PREVIEW_DIMENSIONS, qaFeatureImageFile } from "../scripts/lib/image-qa.mjs";

const validPrompt = [
  "Generate one polished web feature image for Paperclipalypse.",
  "",
  "ASPECT RATIO: exactly 2:1, horizontal wide banner."
].join("\n");

test("extracts a valid prompt despite CRLF and a language-free fence", () => {
  const brief = `# Brief\r\n\r\n## Gemini Image Prompt\r\n\r\n\`\`\`\r\n${validPrompt.replace(/\n/g, "\r\n")}\r\n\`\`\`\r\n`;
  assert.equal(extractGeminiImagePrompt(brief), `${validPrompt}\n`);
});

test("rejects an incomplete image brief before browser automation begins", () => {
  assert.throws(
    () => extractGeminiImagePrompt("# Brief\n\n## Gemini Image Prompt\n\nNo fence"),
    /fenced Gemini prompt block/
  );
});

test("accepts only the exact Gemini preview dimensions", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclipalypse-image-qa-"));
  const previewPath = path.join(tempDir, "preview.png");
  const screenshotPath = path.join(tempDir, "screenshot.png");

  try {
    fs.writeFileSync(previewPath, pngHeader(GEMINI_PREVIEW_DIMENSIONS.width, GEMINI_PREVIEW_DIMENSIONS.height));
    fs.writeFileSync(screenshotPath, pngHeader(1556, 778));
    assert.equal(qaFeatureImageFile(previewPath, { visualApproved: true }).passed, true);
    assert.match(
      qaFeatureImageFile(screenshotPath, { visualApproved: true }).errors.join("\n"),
      /exact 1024x506 chat preview/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function pngHeader(width, height) {
  const buffer = Buffer.alloc(100_001);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}
