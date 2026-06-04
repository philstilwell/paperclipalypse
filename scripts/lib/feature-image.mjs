import fs from "node:fs";
import path from "node:path";

export function buildFeatureImagePrompt(run) {
  const winner = run.rankings?.[0];
  const winningJoke = winningJokeForRun(run);
  const title = winningJoke?.title || "Winning Joke";
  const jokeText = fullJokeText(winningJoke);
  const seedTerms = Array.isArray(run.seedTerms) ? run.seedTerms.join(", ") : "";
  const premise = run.premise?.text || "";

  return [
    "Generate one polished web feature image for Paperclipalypse.",
    "",
    "ASPECT RATIO: exactly 2:1, horizontal wide banner.",
    "",
    "Style: full-color gothic newspaper-comic illustration, darkly funny but warm, clean black ink, crisp editorial cartoon linework, cinematic stage lighting, high contrast, readable composition. Not monochrome. Not sepia-only. Use a balanced color palette: warm amber stage lights, dark bronze and silver metal paperclip, muted greens for the joke setting, dusty blue-gray shadows, cream-white text, subtle deep red accent lights.",
    "",
    "Composition:",
    "- LEFT THIRD: a charming anthropomorphic paperclip stand-up comedian at a vintage microphone on a small comedy stage. The paperclip should look metallic and expressive, related to Paperclipalypse's paperclip-comedian logo, but not identical.",
    "- CENTER THIRD: the winning joke scene, shown as visual comedy action and props. Make it energetic, funny, and non-gory.",
    "- RIGHT THIRD: a clean dark framed poster panel containing the winning joke text in large cream-white lettering. Keep the text inside the panel with generous margins and legible line breaks.",
    "",
    `Small optional header text at top of the panel: Winner: ${winner?.contestantName || "Unknown"} - ${title}`,
    "",
    jokeText ? `Exact joke text to render in the right panel:\n${jokeText}` : "",
    "",
    premise ? `Scene/premise cues: ${premise}.` : "",
    seedTerms ? `Seed terms for visual motifs: ${seedTerms}.` : "",
    "",
    "Text rules: spell every word correctly; do not crop the joke text; do not add extra captions, fake microtext, signatures, watermarks, or speech bubbles; one tiny stage sign reading Paperclipalypse is okay.",
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

Use Google Gemini image generation for the bitmap. After approval, save the image locally and render the episode with:

\`\`\`sh
node scripts/run-tournament.mjs${episodeArg} --feature-image /absolute/path/to/approved-image.png
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
