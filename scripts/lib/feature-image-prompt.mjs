export function extractGeminiImagePrompt(brief, sourceName = "feature image brief") {
  const normalizedBrief = String(brief || "").replace(/\r\n/g, "\n");
  const heading = /^## Gemini Image Prompt\s*$/m.exec(normalizedBrief);

  if (!heading) {
    throw new Error(`Could not find the Gemini Image Prompt heading in ${sourceName}.`);
  }

  const section = normalizedBrief.slice(heading.index + heading[0].length);
  const block = /^\s*```(?:text)?[^\n]*\n([\s\S]*?)\n```/m.exec(section);

  if (!block) {
    throw new Error(`Could not find a fenced Gemini prompt block after the heading in ${sourceName}.`);
  }

  const prompt = block[1].trim();
  if (!prompt) {
    throw new Error(`The Gemini prompt block in ${sourceName} is empty.`);
  }
  if (!/^Generate one polished web feature image for Paperclipalypse\./m.test(prompt)) {
    throw new Error(`The Gemini prompt in ${sourceName} does not have the expected Paperclipalypse opening.`);
  }
  if (!/^ASPECT RATIO:\s*exactly 2:1,/m.test(prompt)) {
    throw new Error(`The Gemini prompt in ${sourceName} does not require the 2:1 feature-image ratio.`);
  }

  return `${prompt}\n`;
}
