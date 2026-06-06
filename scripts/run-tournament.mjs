import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allowsPaidApi, envFlag, loadDotEnv, configuredModel } from "./lib/env.mjs";
import { buildPremise, comicPanelPrompt, generationPrompt, judgingPrompt } from "./lib/prompt.mjs";
import { callContestant, parseModelJson } from "./lib/providers.mjs";
import { buildFeatureImagePrompt, writeFeatureImageBrief } from "./lib/feature-image.mjs";
import { assertFeatureImageQa } from "./lib/image-qa.mjs";
import { assertCompleteTournament } from "./lib/participation.mjs";
import { normalizePremiseForDisplay } from "./lib/premise-display.mjs";
import { publicationDateOnly } from "./lib/publish-date.mjs";
import { aggregateScores, deterministicDryScores, normalizeJudgeScores, rubricForDisplay } from "./lib/scoring.mjs";
import { seededRng } from "./lib/random.mjs";
import { renderSite } from "./lib/site.mjs";
import { buildPromptContextFromSeedTerms, buildSeedTerms } from "./lib/seed-terms.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(path.join(rootDir, ".env"));

const args = parseArgs(process.argv.slice(2));
const dryRun = args.has("dry-run") || envFlag("PAPERCLIPALYPSE_DRY_RUN");
const seed = args.get("seed") || process.env.PAPERCLIPALYPSE_SEED || todaySeed();
const rng = seededRng(seed);
const allowMissingFeatureImage = args.has("allow-missing-feature-image") || envFlag("PAPERCLIPALYPSE_ALLOW_MISSING_FEATURE_IMAGE");

const paidContestants = readJson(path.join(rootDir, "config", "contestants.json")).contestants;
const houseContestants = readJson(path.join(rootDir, "config", "house-contestants.json")).contestants;
const promptPools = readJson(path.join(rootDir, "data", "prompt-pools.json"));
const seedListsPath = path.join(rootDir, "data", "seed-lists.json");
const historyDir = path.join(rootDir, "data", "runs");
const siteDir = path.join(rootDir, "site");
const episodeFile = args.get("episode-file");
const featureImagePath = args.get("feature-image");
const featureImageQaApproved = args.has("feature-image-qa-approved") || envFlag("PAPERCLIPALYPSE_FEATURE_IMAGE_QA_APPROVED");
const featureImageAllowPreview = args.has("feature-image-allow-preview") || envFlag("PAPERCLIPALYPSE_FEATURE_IMAGE_ALLOW_PREVIEW");
const featureImageSource = featureImageAllowPreview
  ? "Gemini image generation (web preview)"
  : "Gemini image generation (high-resolution export)";
const contestants = dryRun ? houseContestants : paidContestants;

if (episodeFile) {
  const run = buildRunFromEpisodeFile(path.resolve(rootDir, episodeFile), seed);
  attachFeatureImage(run, featureImagePath);
  assertPublishQuality(run);
  prepareFeatureImage(run, { episodeFile });
  writeAndRender(run);
  printSummary(run);
  process.exit(0);
}

if (!dryRun) {
  assertApiAutomationSupported(paidContestants);
  assertPaidApiAllowed(paidContestants);
  assertApiKeys(paidContestants);
}

const seedTerms = fs.existsSync(seedListsPath)
  ? buildSeedTerms(readJson(seedListsPath), rng)
  : [];
const premise = normalizePremiseForDisplay(buildPromptContextFromSeedTerms(seedTerms) || buildPremise(promptPools, rng), seedTerms);
const createdAt = new Date().toISOString();
const publishedDate = publicationDateOnly(createdAt);
const slug = `${publishedDate}-${seed.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24)}`;
const jokes = dryRun
  ? makeDryJokes(contestants, premise, rng)
  : await generateJokes(contestants, premise);

const judgeResults = dryRun
  ? deterministicDryScores(jokes, contestants, rng)
  : await judgeJokes(contestants, premise, jokes);

assertCompleteTournament({ contestants, jokes, judgeResults, seedTerms });
const rankings = aggregateScores(jokes, judgeResults);
const run = {
  version: 1,
  slug,
  seed,
  dryRun,
  source: dryRun ? "dry-run" : "paid-api",
  createdAt,
  publishedDate,
  seedTerms,
  premise,
  contestants: contestants.map((contestant) => ({
    id: contestant.id,
    displayName: contestant.displayName,
    provider: contestant.provider || "codex-house",
    model: modelName(contestant)
  })),
  rubric: rubricForDisplay(),
  jokes,
  judgeResults,
  rankings
};
run.comicPanelPrompt = comicPanelPrompt(run);
attachFeatureImage(run, featureImagePath);

assertPublishQuality(run);
prepareFeatureImage(run);
writeAndRender(run);
printSummary(run);

async function generateJokes(modelRoster, runPremise) {
  const prompt = generationPrompt(runPremise);

  const results = await Promise.all(
    modelRoster.map(async (contestant, index) => {
      const label = `Joke ${String.fromCharCode(65 + index)}`;
      const raw = await callContestant(contestant, prompt, {
        json: true,
        temperature: 0.95,
        maxTokens: 500
      });
      const parsed = parseModelJson(raw, {});
      const setup = cleanText(parsed.setup);
      const punchline = cleanText(parsed.punchline);
      const jokeText = cleanText(parsed.joke || parsed.text || [setup, punchline].filter(Boolean).join(" "));

      if (!jokeText) {
        throw new Error(`${contestant.displayName} returned an unusable joke payload`);
      }

      return {
        id: contestant.id,
        label,
        contestantId: contestant.id,
        contestantName: contestant.displayName,
        model: modelName(contestant),
        title: cleanText(parsed.title) || label,
        seedTermsUsed: normalizeSeedTerms(parsed.seedTermsUsed).slice(0, 2),
        joke: jokeText,
        setup,
        punchline: punchline || jokeText,
        text: jokeText
      };
    })
  );

  return results;
}

async function judgeJokes(modelRoster, runPremise, submittedJokes) {
  return Promise.all(
    modelRoster.map(async (judge) => {
      const jokesToJudge = submittedJokes.filter((joke) => joke.contestantId !== judge.id);
      const prompt = judgingPrompt(runPremise, jokesToJudge);
      const raw = await callContestant(judge, prompt, {
        json: true,
        temperature: 0.35,
        maxTokens: 1200
      });
      const parsed = parseModelJson(raw, { scores: [] });

      return {
        judgeId: judge.id,
        judgeName: judge.displayName,
        scores: normalizeJudgeScores(
          parsed,
          jokesToJudge.map((joke) => joke.id)
        )
      };
    })
  );
}

function makeDryJokes(modelRoster, runPremise, localRng) {
  const seedTerms = normalizeSeedTerms(runPremise.seedTerms);
  const seedPairs = [
    [seedTerms[0], seedTerms[1]],
    [seedTerms[1], seedTerms[2]],
    [seedTerms[2], seedTerms[3]],
    [seedTerms[3], seedTerms[4]],
    [seedTerms[4], seedTerms[5]]
  ].map(([first, second]) => [
    first || runPremise.person,
    second || runPremise.place
  ]);
  const shapes = [
    {
      title: "Terms And Conditions",
      text: (first, second) => `I tried building my new act around ${first} and ${second}. The audience got so quiet I thought I had bombed, but then I realized they were just waiting for the terms and conditions to finish scrolling.`
    },
    {
      title: "Quarterly Results",
      text: (first, second) => `I brought ${first} energy to a room full of ${second}, which sounds bold until you learn my only punchline was a quarterly forecast. It still got a laugh, mostly because the pie chart was labeled somehow worse.`
    },
    {
      title: "Official Minutes",
      text: (first, second) => `I tried to explain ${first} to someone committed to ${second}. They nodded, opened a binder, and said, "Great, we can promote this problem to committee." That is when I learned bureaucracy is just heckling with minutes.`
    },
    {
      title: "Premium Plan",
      text: (first, second) => `I asked if ${first} came with support for ${second}. They said yes, but only on the premium plan. Apparently the free tier is just someone watching me panic and saying, "Interesting choice."`
    },
    {
      title: "Compliance Training",
      text: (first, second) => `I once mixed ${first} with ${second} for what I called a simple demonstration. It went so badly HR filmed it, added a quiz, and now my worst decision has a certificate of completion.`
    }
  ];

  return modelRoster.map((contestant, index) => {
    const shape = shapes[index % shapes.length];
    const label = `Joke ${String.fromCharCode(65 + index)}`;
    const [firstSeed, secondSeed] = seedPairs[index % seedPairs.length];
    const jokeText = shape.text(firstSeed, secondSeed);
    const punchline = localRng() > 0.5 ? jokeText : jokeText.replace("I ", "I quietly ");

    return {
      id: contestant.id,
      label,
      contestantId: contestant.id,
      contestantName: contestant.displayName,
      model: modelName(contestant),
      title: shape.title,
      seedTermsUsed: [firstSeed, secondSeed],
      joke: punchline,
      setup: "",
      punchline,
      text: punchline
    };
  });
}

function buildRunFromEpisodeFile(filePath, fallbackSeed) {
  const episode = readJson(filePath);
  const createdAt = episode.createdAt || new Date().toISOString();
  const publishedDate = episode.publishedDate || publicationDateOnly(createdAt);
  const localSeed = episode.seed || fallbackSeed || publishedDate;
  const seedTerms = normalizeSeedTerms(episode.seedTerms);
  const contestants = episode.contestants.map((contestant) => ({
    id: cleanText(contestant.id),
    displayName: cleanText(contestant.displayName),
    provider: cleanText(contestant.provider || "manual-external"),
    model: cleanText(contestant.model || contestant.style || "external chat")
  }));
  const manualJokes = episode.jokes.map((joke, index) => {
    const setup = cleanText(joke.setup);
    const punchline = cleanText(joke.punchline);
    const jokeText = cleanText(joke.joke || joke.text || [setup, punchline].filter(Boolean).join(" "));

    return {
      id: cleanText(joke.id || joke.contestantId || `joke-${index + 1}`),
      label: cleanText(joke.label || `Joke ${String.fromCharCode(65 + index)}`),
      contestantId: cleanText(joke.contestantId || joke.id || `contestant-${index + 1}`),
      contestantName: cleanText(joke.contestantName || `Contestant ${index + 1}`),
      model: cleanText(joke.model || "external chat"),
      title: cleanText(joke.title || `Joke ${String.fromCharCode(65 + index)}`),
      seedTermsUsed: normalizeSeedTerms(joke.seedTermsUsed).slice(0, 2),
      joke: jokeText,
      setup,
      punchline: punchline || jokeText,
      text: jokeText
    };
  });
  const jokeIds = manualJokes.map((joke) => joke.id);
  const manualJudgeResults = episode.judgeResults.map((result) => ({
    judgeId: cleanText(result.judgeId),
    judgeName: cleanText(result.judgeName),
    scores: normalizeJudgeScores(result, jokeIds)
  }));

  assertCompleteTournament({
    contestants,
    jokes: manualJokes,
    judgeResults: manualJudgeResults,
    seedTerms
  });

  const manualRankings = aggregateScores(manualJokes, manualJudgeResults);
  const seedContext = buildPromptContextFromSeedTerms(seedTerms) || {};
  const promptContext = normalizePremiseForDisplay({
    ...seedContext,
    ...episode.premise,
    seedTerms
  }, seedTerms);
  const run = {
    version: 1,
    slug: episode.slug || `${publishedDate}-${localSeed.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24)}`,
    seed: localSeed,
    dryRun: false,
    source: episode.source || "codex-house",
    createdAt,
    publishedDate,
    seedTerms,
    premise: promptContext,
    contestants,
    rubric: rubricForDisplay(),
    jokes: manualJokes,
    judgeResults: manualJudgeResults,
    rankings: manualRankings,
    featureImage: normalizeFeatureImage(episode.featureImage),
    featureImagePrompt: cleanMultiline(episode.featureImagePrompt)
  };

  run.comicPanelPrompt = cleanText(episode.comicPanelPrompt) || comicPanelPrompt(run);
  return run;
}

function prepareFeatureImage(run, { episodeFile } = {}) {
  run.featureImagePrompt = cleanMultiline(run.featureImagePrompt) || buildFeatureImagePrompt(run);

  if (run.dryRun) {
    return;
  }

  const briefRelPath = writeFeatureImageBrief(run, {
    rootDir,
    episodeFile
  });
  run.featureImageBrief = briefRelPath;

  if (run.featureImage?.src) {
    if (!run.dryRun && !isFeatureImageQaApproved(run.featureImage.qa)) {
      throw new Error(
        [
          "Feature image exists but lacks QA approval metadata.",
          "Reject low-quality images and regenerate with Google Gemini until the QA checklist passes.",
          "Then rerun with --feature-image /absolute/path/to/approved-image.png --feature-image-qa-approved."
        ].join("\n")
      );
    }
    return;
  }

  if (allowMissingFeatureImage) {
    console.warn(`Feature image missing. Gemini image brief written: ${briefRelPath}`);
    return;
  }

  throw new Error(
    [
      "Feature image required before publishing this public episode.",
      `Gemini image brief written: ${briefRelPath}`,
      "Generate or approve the image with Google Gemini image generation, then rerun with:",
      `node scripts/run-tournament.mjs${episodeFile ? ` --episode-file ${episodeFile}` : ""} --feature-image /absolute/path/to/approved-image.png`,
      "For diagnostics only, rerun with --allow-missing-feature-image."
    ].join("\n")
  );
}

function writeAndRender(run) {
  fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(path.join(historyDir, `${run.slug}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  renderSite({ run, historyDir, siteDir });
}

function attachFeatureImage(run, sourcePath) {
  if (!sourcePath) {
    return;
  }

  const absoluteSourcePath = path.resolve(rootDir, sourcePath);
  if (!fs.existsSync(absoluteSourcePath)) {
    throw new Error(`Feature image not found: ${sourcePath}`);
  }

  const qa = run.dryRun
    ? null
    : assertFeatureImageQa(absoluteSourcePath, {
        visualApproved: featureImageQaApproved,
        allowWebPreview: featureImageAllowPreview
      });
  const ext = path.extname(absoluteSourcePath).toLowerCase() || ".png";
  const assetRelPath = path.posix.join("assets", "feature-images", `${run.slug}${ext}`);
  const assetPath = path.join(siteDir, assetRelPath);
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  if (path.resolve(assetPath) !== absoluteSourcePath) {
    fs.copyFileSync(absoluteSourcePath, assetPath);
  }
  fs.chmodSync(assetPath, 0o644);

  run.featureImage = {
    src: assetRelPath,
    originalSrc: assetRelPath,
    source: featureImageSource,
    aspectRatio: "2:1",
    width: qa?.dimensions?.width,
    height: qa?.dimensions?.height,
    qa: qa ? {
      status: "approved",
      version: qa.version,
      visualApproved: qa.visualApproved,
      assetType: qa.assetType,
      automaticChecks: "passed",
      warnings: qa.warnings
    } : undefined,
    alt: featureImageAlt(run)
  };
}

function printSummary(run) {
  console.log(`Paperclipalypse run complete: ${run.slug}`);
  console.log(`Seed terms: ${run.seedTerms.join(", ") || "(none)"}`);
  console.log(`Winner: ${run.rankings[0].contestantName} (${run.rankings[0].score.toFixed(1)})`);
  console.log(`Mode: ${run.source}`);
}

function assertApiKeys(modelRoster) {
  const missing = modelRoster
    .filter((contestant) => !process.env[contestant.apiKeyEnv])
    .map((contestant) => contestant.apiKeyEnv);

  if (missing.length) {
    throw new Error(
      `Missing API keys: ${[...new Set(missing)].join(", ")}. Run with --dry-run for local mock output.`
    );
  }
}

function assertApiAutomationSupported(modelRoster) {
  const manualOnly = modelRoster.filter((contestant) => (
    contestant.apiAutomation === false ||
    contestant.provider === "manual-web" ||
    !contestant.apiKeyEnv
  ));

  if (!manualOnly.length) {
    return;
  }

  throw new Error(
    [
      `Live API mode cannot automate manual-only contestants: ${manualOnly.map((contestant) => contestant.displayName).join(", ")}.`,
      "Use prompts/external-ai-round.md and publish a collected episode JSON instead,",
      "or replace manual-only contestants with API-backed providers before running npm run tournament."
    ].join(" ")
  );
}

function assertPublishQuality(run) {
  if (run.dryRun || envFlag("PAPERCLIPALYPSE_ALLOW_LOW_QUALITY")) {
    return;
  }

  const rankings = Array.isArray(run.rankings) ? run.rankings : [];
  const winner = rankings[0];
  const averageScore = average(rankings.map((ranking) => ranking.score));
  const expectedJudgeCount = Math.max(0, (run.contestants?.length || 0) - 1);
  const errors = [];

  if (!winner || winner.score < 6) {
    errors.push("Winner score must be at least 6.0 for a public non-dry-run episode.");
  }
  if (averageScore < 5) {
    errors.push("Average joke score must be at least 5.0 for a public non-dry-run episode.");
  }
  for (const ranking of rankings) {
    if (ranking.judgeCount !== expectedJudgeCount) {
      errors.push(`${ranking.contestantName} has ${ranking.judgeCount} judges; expected ${expectedJudgeCount}.`);
    }
  }

  if (errors.length) {
    throw new Error(
      [
        "Publish quality gate failed:",
        ...errors.map((error) => `- ${error}`),
        "Set PAPERCLIPALYPSE_ALLOW_LOW_QUALITY=1 only if you intentionally want to publish a weak or diagnostic round."
      ].join("\n")
    );
  }
}

function assertPaidApiAllowed(modelRoster) {
  const meteredContestants = modelRoster.filter((contestant) => contestant.billing === "paid-api");
  if (!meteredContestants.length || allowsPaidApi()) {
    return;
  }

  throw new Error(
    [
      "External live tournament mode includes metered provider APIs.",
      "This project is configured for no-paid-API hobby mode by default.",
      "Use npm run tournament:dry-run or publish a Codex-generated episode JSON instead.",
      "To intentionally allow paid API calls locally, set PAPERCLIPALYPSE_ALLOW_PAID_API=1."
    ].join(" ")
  );
}

function average(values) {
  const usable = values.map(Number).filter((value) => Number.isFinite(value));
  if (!usable.length) {
    return 0;
  }

  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function normalizeFeatureImage(image) {
  if (!image || typeof image !== "object" || !cleanText(image.src)) {
    return null;
  }

  return {
    src: cleanText(image.src),
    originalSrc: cleanText(image.originalSrc || image.src),
    source: cleanText(image.source || featureImageSource),
    aspectRatio: cleanText(image.aspectRatio || "2:1"),
    width: Number.isFinite(Number(image.width)) ? Number(image.width) : undefined,
    height: Number.isFinite(Number(image.height)) ? Number(image.height) : undefined,
    qa: normalizeFeatureImageQa(image.qa),
    alt: cleanText(image.alt) || featureImageAlt({ premise: { text: "" }, rankings: [], jokes: [] }),
    prompt: cleanText(image.prompt)
  };
}

function normalizeFeatureImageQa(qa) {
  if (!qa || typeof qa !== "object") {
    return undefined;
  }

  return {
    status: cleanText(qa.status || "approved"),
    version: cleanText(qa.version),
    visualApproved: Boolean(qa.visualApproved),
    automaticChecks: cleanText(qa.automaticChecks),
    warnings: Array.isArray(qa.warnings) ? qa.warnings.map(cleanText).filter(Boolean) : []
  };
}

function isFeatureImageQaApproved(qa) {
  return (
    qa &&
    typeof qa === "object" &&
    cleanText(qa.status) === "approved" &&
    qa.visualApproved === true &&
    cleanText(qa.automaticChecks) === "passed"
  );
}

function featureImageAlt(run) {
  const winner = run.rankings?.[0];
  const winningJoke = run.jokes?.find((joke) => joke.id === winner?.jokeId);
  const title = winningJoke?.title ? ` titled ${winningJoke.title}` : "";

  return `Paperclipalypse winning joke feature image${title}: a paperclip stand-up comic and the winning joke scene.`;
}

function modelName(contestant) {
  return configuredModel(contestant) || contestant.style || contestant.provider || "local";
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

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMultiline(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function normalizeSeedTerms(seedTerms) {
  if (!Array.isArray(seedTerms)) {
    return [];
  }

  return seedTerms.map(cleanText).filter(Boolean);
}

function todaySeed() {
  return publicationDateOnly(new Date());
}
