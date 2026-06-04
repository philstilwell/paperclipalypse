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
    "Create a 2:1 horizontal feature image for Paperclipalypse, an AI comedy tournament website.",
    "Use a dark gothic newspaper-comic style with clean black ink, smoky stage lighting, crisp highlights, expressive but readable characters, and a restrained but real color palette.",
    "Do not make it monochrome or sepia-only. Use warm stage gold, dark bronze paperclip metal, muted olive park/block-party greens, dusty blue-gray shadows, cream text, and a few deep red accent lights.",
    "Composition: the left third shows a charming paperclip stand-up comic at a vintage microphone under stage spotlights. The paperclip should look metallic, dark bronze/silver, and related to the Paperclipalypse logo.",
    "The middle third shows the winning joke's scene as visual comedy props and action.",
    "The right half is a clean dark framed text panel with the winning joke set in large, crisp, readable cream-white type. A small tasteful header with the winner or joke title is acceptable if it improves the poster. Keep generous margins and balanced line breaks so the text is legible on web devices.",
    `Winning contestant: ${winner?.contestantName || "Unknown"}.`,
    `Winning joke title: ${title}.`,
    jokeText ? `Exact joke text to render in the right text panel: "${jokeText}"` : "",
    premise ? `Scene/premise cues for the background: ${premise}.` : "",
    seedTerms ? `Seed terms for visual motifs: ${seedTerms}.` : "",
    "For this scene, use the joke's elements as background comedy props rather than clutter: the stand-up stage may blend into the joke's setting, with small visual nods to the winning joke behind the comic.",
    "Do not add speech bubbles, fake captions, logos from other companies, signatures, watermarks, or extra text beyond the exact joke text, an optional small winner/title header, and one tiny stage sign reading Paperclipalypse.",
    "Avoid monochrome, sepia-only color, misspellings, tiny cramped text, distorted hands, horror gore, photoreal faces, and purely abstract AI-glow decoration.",
    "Output one polished web-ready image with the illustration and joke text integrated in one generation."
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
  const prompt = buildFeatureImagePrompt(run);
  const episodeArg = episodeFile ? ` --episode-file ${episodeFile}` : " --episode-file data/inbox/<external-episode>.json";

  return `# Paperclipalypse Feature Image Brief

Run: ${run.slug}
Winner: ${run.rankings?.[0]?.contestantName || "Unknown"}
Winning joke: ${winningJoke?.title || "Unknown"}

## OpenAI Image Prompt

\`\`\`text
${prompt}
\`\`\`

## Attach The Approved Image

Use OpenAI image generation for the bitmap. After approval, save the image locally and render the episode with:

\`\`\`sh
node scripts/run-tournament.mjs${episodeArg} --feature-image /absolute/path/to/approved-image.png
\`\`\`

The runner will copy the approved one-shot image into \`site/assets/feature-images/\`, attach it to the run JSON, and render it on the home and episode pages.
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
