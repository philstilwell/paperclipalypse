const REQUIRED_CONTESTANTS = 5;
const REQUIRED_SEED_TERMS = 6;
const SCORE_FIELDS = ["originality", "surprise", "craft", "promptFit", "laugh"];

export function assertCompleteTournament({ contestants, jokes, judgeResults, seedTerms }) {
  const errors = [];
  const contestantIds = normalizedIds(contestants, "contestant", errors);
  const seedSet = new Set(normalizeTextList(seedTerms).map(normalizeForMatch));

  if (!Array.isArray(contestants) || contestants.length !== REQUIRED_CONTESTANTS) {
    errors.push(`Expected exactly ${REQUIRED_CONTESTANTS} contestants.`);
  }

  if (!Array.isArray(seedTerms) || seedTerms.length !== REQUIRED_SEED_TERMS) {
    errors.push(`Expected exactly ${REQUIRED_SEED_TERMS} seed terms.`);
  }

  const jokesById = new Map();
  const jokeIdsByContestant = new Map();
  if (!Array.isArray(jokes) || jokes.length !== contestantIds.size) {
    errors.push(`Expected one joke from each contestant (${contestantIds.size} total).`);
  }

  for (const joke of Array.isArray(jokes) ? jokes : []) {
    const jokeId = cleanText(joke.id);
    const contestantId = cleanText(joke.contestantId);
    const jokeText = cleanText(joke.joke || joke.text || [joke.setup, joke.punchline].filter(Boolean).join(" "));

    if (!jokeId) {
      errors.push("Every joke needs a stable id.");
      continue;
    }
    if (jokesById.has(jokeId)) {
      errors.push(`Duplicate joke id: ${jokeId}.`);
    }
    jokesById.set(jokeId, joke);

    if (!contestantIds.has(contestantId)) {
      errors.push(`Joke ${jokeId} has unknown contestantId: ${contestantId || "(missing)"}.`);
    } else if (jokeIdsByContestant.has(contestantId)) {
      errors.push(`Contestant ${contestantId} submitted more than one joke.`);
    } else {
      jokeIdsByContestant.set(contestantId, jokeId);
    }

    if (!jokeText) {
      errors.push(`Joke ${jokeId} is empty.`);
    } else {
      const words = wordCount(jokeText);
      if (words < 18 || words > 110) {
        errors.push(`Joke ${jokeId} should be concise stand-up text; got ${words} words.`);
      }
      if (!hasFirstPersonVoice(jokeText)) {
        errors.push(`Joke ${jokeId} is not clearly first-person.`);
      }
    }

    const used = normalizeTextList(joke.seedTermsUsed);
    const usedSet = new Set(used.map(normalizeForMatch));
    if (used.length !== 2) {
      errors.push(`Joke ${jokeId} must declare exactly two seedTermsUsed.`);
    }
    if (new Set(used).size !== used.length) {
      errors.push(`Joke ${jokeId} repeats a seed term in seedTermsUsed.`);
    }
    for (const seed of used) {
      if (seedSet.size && !seedSet.has(normalizeForMatch(seed))) {
        errors.push(`Joke ${jokeId} uses seed term "${seed}" that is not in this round.`);
      }
    }
  }

  for (const contestantId of contestantIds) {
    if (!jokeIdsByContestant.has(contestantId)) {
      errors.push(`Missing joke from contestant ${contestantId}.`);
    }
  }

  if (!Array.isArray(judgeResults) || judgeResults.length !== contestantIds.size) {
    errors.push(`Expected one scorecard from each contestant judge (${contestantIds.size} total).`);
  }

  const judgeIds = new Set();
  for (const result of Array.isArray(judgeResults) ? judgeResults : []) {
    const judgeId = cleanText(result.judgeId);
    if (!contestantIds.has(judgeId)) {
      errors.push(`Unknown judgeId: ${judgeId || "(missing)"}.`);
      continue;
    }
    if (judgeIds.has(judgeId)) {
      errors.push(`Duplicate scorecard from judge ${judgeId}.`);
    }
    judgeIds.add(judgeId);

    const expected = new Set(
      [...jokeIdsByContestant.entries()]
        .filter(([contestantId]) => contestantId !== judgeId)
        .map(([, jokeId]) => jokeId)
    );
    const seen = new Set();
    const scores = Array.isArray(result.scores) ? result.scores : [];
    if (scores.length !== expected.size) {
      errors.push(`Judge ${judgeId} must score exactly ${expected.size} jokes; got ${scores.length}.`);
    }

    for (const score of scores) {
      const jokeId = cleanText(score.jokeId);
      const ownedByJudge = jokeIdsByContestant.get(judgeId) === jokeId;
      if (!jokesById.has(jokeId)) {
        errors.push(`Judge ${judgeId} scored unknown joke ${jokeId || "(missing)"}.`);
      } else if (ownedByJudge) {
        errors.push(`Judge ${judgeId} scored its own joke.`);
      } else if (!expected.has(jokeId)) {
        errors.push(`Judge ${judgeId} scored an unexpected joke ${jokeId}.`);
      }
      if (seen.has(jokeId)) {
        errors.push(`Judge ${judgeId} scored joke ${jokeId} more than once.`);
      }
      seen.add(jokeId);

      for (const field of SCORE_FIELDS) {
        if (!Number.isInteger(score[field]) || score[field] < 1 || score[field] > 10) {
          errors.push(`Judge ${judgeId} score for ${jokeId}.${field} must be an integer from 1 to 10.`);
        }
      }
      if (!cleanText(score.comment)) {
        errors.push(`Judge ${judgeId} score for ${jokeId} needs a brief comment.`);
      }
    }

    for (const jokeId of expected) {
      if (!seen.has(jokeId)) {
        errors.push(`Judge ${judgeId} did not score joke ${jokeId}.`);
      }
    }
  }

  for (const contestantId of contestantIds) {
    if (!judgeIds.has(contestantId)) {
      errors.push(`Missing scorecard from judge ${contestantId}.`);
    }
  }

  if (errors.length) {
    throw new Error(`Tournament participation validation failed:\n- ${errors.join("\n- ")}`);
  }
}

function normalizedIds(items, label, errors) {
  const ids = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const id = cleanText(item.id);
    if (!id) {
      errors.push(`Every ${label} needs an id.`);
      continue;
    }
    if (ids.has(id)) {
      errors.push(`Duplicate ${label} id: ${id}.`);
    }
    ids.add(id);
  }
  return ids;
}

function normalizeTextList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map(cleanText).filter(Boolean);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

function hasFirstPersonVoice(text) {
  return /\b(I|I'm|I've|I'll|I'd|me|my|mine)\b/i.test(text);
}

function normalizeForMatch(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
