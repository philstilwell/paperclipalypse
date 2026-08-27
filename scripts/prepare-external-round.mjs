import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generationPrompt, judgingPrompt } from "./lib/prompt.mjs";
import { publicationDateOnly } from "./lib/publish-date.mjs";
import { seededRng } from "./lib/random.mjs";
import { buildPromptContextFromSeedTerms, buildSeedTerms } from "./lib/seed-terms.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const seed = args.get("seed") || todaySeed();
const createdAt = new Date().toISOString();
const publishedDate = publicationDateOnly(createdAt);
const seedLists = readJson(path.join(rootDir, "data", "seed-lists.json"));
const contestants = readJson(path.join(rootDir, "config", "contestants.json")).contestants;
const seedTerms = buildSeedTerms(seedLists, seededRng(seed));
const context = buildPromptContextFromSeedTerms(seedTerms);
const slug = `${publishedDate}-${seed.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24)}`;
const outRelPath = args.get("out") || path.join("data", "inbox", `${seed}-prompts.json`);
const outPath = path.resolve(rootDir, outRelPath);
const generation = generationPrompt(context);
const judgingTemplate = buildJudgingTemplate(context);

const packet = {
  version: 1,
  purpose: "Paperclipalypse manual-external prompt packet",
  createdAt,
  seed,
  slug,
  seedTerms,
  operatingMode: "one operator prompt, manual external AI web surfaces, no paid APIs",
  publishedDate,
  contestants: contestants.map((contestant, index) => ({
    id: contestant.id,
    label: `Joke ${String.fromCharCode(65 + index)}`,
    displayName: contestant.displayName,
    provider: contestant.provider,
    model: contestant.defaultModel || contestant.model || contestant.provider
  })),
  generationPrompt: {
    system: generation.system,
    user: generation.user,
    combined: `${generation.system}\n\n${generation.user}`
  },
  judgingPromptTemplate: judgingTemplate,
  operatorChecklist: [
    "Send the generation prompt to all five contestants through their normal web chat surfaces.",
    "If a chat surface leaves the prompt sitting in the composer after clicking send, focus the composer and try Control+Enter before treating it as a failed submission.",
    "Do not invent or repair missing contestant jokes.",
    "After all five jokes are collected, send the judging prompt to each contestant with that contestant's own joke removed.",
    "Make sure every joke object in the judging packet has a text field containing the complete joke.",
    "Reject and resubmit any scorecard that omits a joke, scores its own joke, says the joke text was missing, or merely echoes the example object with jokeId \"id\".",
    "When repairing a bad scorecard, send a shorter correction that names the exact four jokeIds the judge must score.",
    "Set episodeSkeleton.premise.displayText to the intended published round title. If left blank, the importer will use the winning joke title.",
    "Build data/inbox/<seed>.json from the real jokes and scorecards.",
    "Run the tournament once with --allow-missing-feature-image to create the Gemini image brief.",
    "Run npm run image:prompt -- --brief data/image-briefs/<round>.md to create the browser-safe plain-text Gemini prompt. Read that file directly in browser automation; do not parse the Markdown brief or embed its contents in a JavaScript string.",
    "Open a fresh Chrome tab or window for Gemini image generation and note its tab id or visible title before working there.",
    "Generate the feature image in Gemini and save the smaller 1024x506 generated preview. Prefer Chrome's media-download action on the generated image element when available; it avoids native save dialogs and full-size exports.",
    "Never use Gemini's full-size export for this project.",
    "Reject and regenerate low-quality images until the image QA checklist passes. A tiny stage-sign truncation can pass if the main joke text is readable and not distracting.",
    "Rerun with --feature-image and --feature-image-qa-approved only after visual QA approval.",
    "Verify the rendered site, close temporary tabs and dialogues, then commit and push."
  ],
  episodeSkeleton: {
    createdAt,
    publishedDate,
    seed,
    slug,
    source: "manual-external",
    seedTerms,
    premise: {
      displayText: ""
    },
    contestants: contestants.map((contestant) => ({
      id: contestant.id,
      displayName: contestant.displayName,
      provider: contestant.provider || "manual-external",
      model: contestant.defaultModel || contestant.model || contestant.provider
    })),
    jokes: [],
    judgeResults: []
  }
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
console.log(`Prompt packet written: ${path.relative(rootDir, outPath)}`);
console.log(`Seed terms: ${seedTerms.join(", ")}`);

function buildJudgingTemplate(context) {
  const prompt = judgingPrompt(context, []);
  const user = prompt.user.replace(
    "\n[]\nReturn this JSON shape:",
    "\n{{JOKES_JSON_WITH_TEXT_FIELDS}}\nReturn this JSON shape:"
  );

  return {
    system: prompt.system,
    user,
    combined: `${prompt.system}\n\n${user}`,
    jokesJsonRequirement: "Each item must include jokeId, label, seedTermsUsed, and text. The text field must contain the complete standalone joke."
  };
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function todaySeed() {
  return publicationDateOnly(new Date());
}
