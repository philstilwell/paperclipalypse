import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allowsPaidApi, envFlag, loadDotEnv, configuredModel } from "./lib/env.mjs";
import { buildPremise, comicPanelPrompt, generationPrompt, judgingPrompt } from "./lib/prompt.mjs";
import { callContestant, parseModelJson } from "./lib/providers.mjs";
import { aggregateScores, deterministicDryScores, normalizeJudgeScores, rubricForDisplay } from "./lib/scoring.mjs";
import { seededRng } from "./lib/random.mjs";
import { renderSite } from "./lib/site.mjs";
import { buildPremiseFromSeedTerms, buildSeedTerms } from "./lib/seed-terms.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(path.join(rootDir, ".env"));

const args = parseArgs(process.argv.slice(2));
const dryRun = args.has("dry-run") || envFlag("PAPERCLIPALYPSE_DRY_RUN");
const seed = args.get("seed") || process.env.PAPERCLIPALYPSE_SEED || todaySeed();
const rng = seededRng(seed);

const paidContestants = readJson(path.join(rootDir, "config", "contestants.json")).contestants;
const houseContestants = readJson(path.join(rootDir, "config", "house-contestants.json")).contestants;
const promptPools = readJson(path.join(rootDir, "data", "prompt-pools.json"));
const seedListsPath = path.join(rootDir, "data", "seed-lists.json");
const historyDir = path.join(rootDir, "data", "runs");
const siteDir = path.join(rootDir, "site");
const episodeFile = args.get("episode-file");
const contestants = dryRun ? houseContestants : paidContestants;

if (episodeFile) {
  const run = buildRunFromEpisodeFile(path.resolve(rootDir, episodeFile), seed);
  writeAndRender(run);
  printSummary(run);
  process.exit(0);
}

if (!dryRun) {
  assertPaidApiAllowed(paidContestants);
  assertApiKeys(paidContestants);
}

const seedTerms = fs.existsSync(seedListsPath)
  ? buildSeedTerms(readJson(seedListsPath), rng)
  : [];
const premise = buildPremiseFromSeedTerms(seedTerms) || buildPremise(promptPools, rng);
const createdAt = new Date().toISOString();
const slug = `${createdAt.slice(0, 10)}-${seed.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24)}`;
const jokes = dryRun
  ? makeDryJokes(contestants, premise, rng)
  : await generateJokes(contestants, premise);

const judgeResults = dryRun
  ? deterministicDryScores(jokes, contestants, rng)
  : await judgeJokes(contestants, premise, jokes);

const rankings = aggregateScores(jokes, judgeResults);
const run = {
  version: 1,
  slug,
  seed,
  dryRun,
  source: dryRun ? "dry-run" : "paid-api",
  createdAt,
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
  const shapes = [
    {
      title: "Terms And Conditions",
      setup: `${runPremise.person} arrived at ${runPremise.place} and found ${runPremise.element} waiting at the front desk.`,
      punchline: "The paperclips said they were not hostile, they were just here to optimize the apology."
    },
    {
      title: "Quarterly Results",
      setup: `${runPremise.place} had one rule: never let ${runPremise.person} near ${runPremise.element}.`,
      punchline: "By lunch, the quarterly forecast was just a pie chart labeled somehow worse."
    },
    {
      title: "Official Minutes",
      setup: `${runPremise.person} tried to explain ${runPremise.element} to the manager of ${runPremise.place}.`,
      punchline: "The manager nodded, opened a binder, and promoted the problem to committee."
    },
    {
      title: "Premium Plan",
      setup: `At ${runPremise.place}, ${runPremise.person} asked whether ${runPremise.element} came with support.`,
      punchline: "It did, but only if you upgraded to the plan where support stops laughing first."
    },
    {
      title: "Compliance Training",
      setup: `${runPremise.person} brought ${runPremise.element} into ${runPremise.place} for a simple demonstration.`,
      punchline: "The demonstration was so simple it immediately became mandatory training."
    }
  ];

  return modelRoster.map((contestant, index) => {
    const shape = shapes[index % shapes.length];
    const label = `Joke ${String.fromCharCode(65 + index)}`;
    const tweak = localRng() > 0.5 ? "" : " quietly";
    const punchline = shape.punchline.replace("said", `said${tweak}`);

    return {
      id: contestant.id,
      label,
      contestantId: contestant.id,
      contestantName: contestant.displayName,
      model: modelName(contestant),
      title: shape.title,
      seedTermsUsed: normalizeSeedTerms(runPremise.seedTerms).slice(0, 2),
      joke: `${shape.setup} ${punchline}`,
      setup: shape.setup,
      punchline,
      text: `${shape.setup} ${punchline}`
    };
  });
}

function buildRunFromEpisodeFile(filePath, fallbackSeed) {
  const episode = readJson(filePath);
  const createdAt = episode.createdAt || new Date().toISOString();
  const localSeed = episode.seed || fallbackSeed || createdAt.slice(0, 10);
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
  const manualRankings = aggregateScores(manualJokes, manualJudgeResults);
  const run = {
    version: 1,
    slug: episode.slug || `${createdAt.slice(0, 10)}-${localSeed.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24)}`,
    seed: localSeed,
    dryRun: false,
    source: episode.source || "codex-house",
    createdAt,
    seedTerms: normalizeSeedTerms(episode.seedTerms),
    premise: {
      ...episode.premise,
      seedTerms: normalizeSeedTerms(episode.seedTerms)
    },
    contestants: episode.contestants.map((contestant) => ({
      id: contestant.id,
      displayName: contestant.displayName,
      provider: contestant.provider || "manual-external",
      model: contestant.model || contestant.style || "external chat"
    })),
    rubric: rubricForDisplay(),
    jokes: manualJokes,
    judgeResults: manualJudgeResults,
    rankings: manualRankings
  };

  run.comicPanelPrompt = cleanText(episode.comicPanelPrompt) || comicPanelPrompt(run);
  return run;
}

function writeAndRender(run) {
  fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(path.join(historyDir, `${run.slug}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  renderSite({ run, historyDir, siteDir });
}

function printSummary(run) {
  console.log(`Paperclipalypse run complete: ${run.slug}`);
  console.log(`Premise: ${run.premise.text}`);
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

function normalizeSeedTerms(seedTerms) {
  if (!Array.isArray(seedTerms)) {
    return [];
  }

  return seedTerms.map(cleanText).filter(Boolean);
}

function todaySeed() {
  return new Date().toISOString().slice(0, 10);
}
