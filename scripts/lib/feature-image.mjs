import fs from "node:fs";
import path from "node:path";
import { featureImageQaChecklistText } from "./image-qa.mjs";

export function buildFeatureImagePrompt(run) {
  const winner = run.rankings?.[0];
  const winningJoke = winningJokeForRun(run);
  const title = winningJoke?.title || "Winning Joke";
  const jokeText = fullJokeText(winningJoke);
  const seedTerms = Array.isArray(run.seedTerms) ? run.seedTerms.join(", ") : "";
  const fallbackScene = seedTerms ? "" : run.premise?.text || "";

  return [
    "Generate one polished web feature image for Paperclipalypse.",
    "",
    "ASPECT RATIO: exactly 2:1, horizontal wide banner.",
    "",
    "Style: full-color gothic newspaper-comic illustration, darkly funny but warm, clean black ink, crisp editorial cartoon linework, cinematic stage lighting, high contrast, readable composition. Not monochrome. Not sepia-only. Use a balanced color palette: warm amber stage lights, dark bronze and silver metal paperclip, muted greens for the joke setting, dusty blue-gray shadows, cream-white text, subtle deep red accent lights.",
    "",
    "Composition instructions, not visible labels:",
    "- Put a charming anthropomorphic paperclip stand-up comedian at a vintage microphone on the left side of the image. The paperclip should look metallic and expressive, related to Paperclipalypse's paperclip-comedian logo, but not identical.",
    "- Put the winning joke scene in the middle of the image, shown as literal visual comedy action and props. Make it energetic, funny, and non-gory.",
    "- Preserve the physical scenario described by the winning joke. If the joke says a person is pinned, trapped, under, inside, holding, lifting, falling, carrying, or otherwise physically positioned in a specific way, show that exact physical relation clearly and safely instead of a nearby or symbolic version.",
    "- If the joke describes someone pinned under a vehicle or other heavy object, show the person visibly underneath that object with their body position clear and cartoon-safe. Do not place them merely beside, near, or behind the object.",
    "- Put a clean dark framed poster panel on the right side of the image. The panel should contain the winning joke text in large cream-white lettering with generous margins and legible line breaks.",
    "",
    "Visible text allowed in the entire image: the right-panel joke text, a tiny stage sign reading Paperclipalypse, and optionally a small winner/title header above the panel.",
    "Do not render layout words, percentages, prompt labels, section names, fake captions, signatures, watermarks, or filler microtext.",
    `Optional small header text above the panel: Winner: ${winner?.contestantName || "Unknown"} - ${title}`,
    "",
    jokeText ? `Exact joke text to render in the right panel:\n${jokeText}` : "",
    "",
    "Scene source: use the exact winning joke text as the primary scene brief. The illustration must depict the concrete situation that the joke describes, not a softened, adjacent, or generic version. Do not infer a separate premise from all six seed terms.",
    fallbackScene ? `Fallback scene cue: ${fallbackScene}.` : "",
    seedTerms ? `Seed terms for visual motifs: ${seedTerms}.` : "",
    "",
    "Text rules: use simple clean lettering, spell every word correctly, keep the text inside the right panel, and do not distort letter shapes. The website HTML remains the canonical exact joke text if image lettering is imperfect.",
    "",
    "The final image should feel like a finished feature image for an AI comedy tournament: funny, stylish, readable, full-color, and visually balanced across the paperclip comic, the joke scene, and the joke text."
  ].filter(Boolean).join("\n");
}

export function writeFeatureImageBrief(run, { rootDir, episodeFile } = {}) {
  const briefRelPath = path.join("data", "image-briefs", `${run.slug}.md`);
  const briefPath = path.join(rootDir, briefRelPath);
  fs.mkdirSync(path.dirname(briefPath), { recursive: true });
  fs.writeFileSync(briefPath, featureImageBrief(run, { episodeFile }), "utf8");
  return briefRelPath;
}

export function featureImageBrief(run, { episodeFile } = {}) {
  const winningJoke = winningJokeForRun(run);
  const prompt = run.featureImagePrompt || buildFeatureImagePrompt(run);
  const episodeArg = episodeFile ? ` --episode-file ${episodeFile}` : " --episode-file data/inbox/<external-episode>.json";

  return `# Paperclipalypse Feature Image Brief

Run: ${run.slug}
Winner: ${run.rankings?.[0]?.contestantName || "Unknown"}
Winning joke: ${winningJoke?.title || "Unknown"}

## Gemini Image Prompt

\`\`\`text
${prompt}
\`\`\`

## Attach The Approved Image

Use Google Gemini image generation for the bitmap. Open a fresh Chrome tab or window first and note the working tab title or id. If Gemini leaves the prompt in the composer after a click, focus the composer and use Control+Enter to submit it.

Save the smaller 1024x506 generated preview, never Gemini's full-size export. Prefer Chrome's media-download action on the visible generated image element, usually the 1024x506 image with alt text like ", AI generated"; this captures the preview directly and avoids native save dialogs. If the media-download path is unavailable, save or capture the same preview image by another non-full-export method.

Low-quality images must be rejected and regenerated until the QA checklist passes. The main joke text must be legible enough not to distract; a tiny stage sign that truncates Paperclipalypse can pass if the rest of the image is polished and on brief.

## Feature Image QA

Before approval, inspect the saved Gemini preview image against this checklist:

${featureImageQaChecklistText()}

You can run the automatic file checks with:

\`\`\`sh
node scripts/qa-feature-image.mjs --image tmp/gemini-feature-images/${run.slug}.jpg --approved
\`\`\`

After visual approval, render the episode with the approved preview image:

\`\`\`sh
node scripts/run-tournament.mjs${episodeArg} --feature-image tmp/gemini-feature-images/${run.slug}.jpg --feature-image-qa-approved
\`\`\`

The runner will copy the approved Gemini image into \`site/assets/feature-images/\`, attach it to the run JSON, and render it on the home and episode pages.
`;
}

export function winningJokeForRun(run) {
  const winner = run.rankings?.[0];
  return run.jokes?.find((joke) => joke.id === winner?.jokeId);
}

function fullJokeText(joke = {}) {
  return cleanText(
    joke.joke || joke.text || [joke.setup, joke.punchline].filter(Boolean).join(" ")
  );
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}
