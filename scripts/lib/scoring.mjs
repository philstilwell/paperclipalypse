export const RUBRIC_VERSION = "2026-06-strict-standup-v4";
export const JUDGE_NORMALIZATION_WINDOW = 5;
export const JUDGE_NORMALIZATION_METHOD = "rolling-judge-bias-v1";

export const RUBRIC_FIELDS = [
  {
    key: "laugh",
    label: "Laugh",
    weight: 0.4,
    description: "How likely a human reader is to actually laugh, not merely understand or admire the idea."
  },
  {
    key: "surprise",
    label: "Surprise",
    weight: 0.2,
    description: "Whether the turn avoids the first obvious route and lands with a satisfying snap."
  },
  {
    key: "craft",
    label: "Craft",
    weight: 0.2,
    description: "Economy, stage rhythm, first-person clarity, escalation, and a final line that carries the laugh."
  },
  {
    key: "originality",
    label: "Originality",
    weight: 0.1,
    description: "Freshness of comic angle, image, wording, and avoidance of familiar AI joke shapes."
  },
  {
    key: "promptFit",
    label: "Prompt Fit",
    weight: 0.1,
    description: "Natural first-person stand-up form using exactly two seed terms as concepts, with the other four left out."
  }
];

export const SCORE_ANCHORS = [
  {
    range: "1-2",
    label: "Broken",
    description: "Not a joke, incoherent, unsafe, or unusable."
  },
  {
    range: "3-4",
    label: "Weak",
    description: "Recognizably attempting humor, but generic, strained, confusing, or mostly prompt recital."
  },
  {
    range: "5",
    label: "Competent",
    description: "Clear and publishable as filler, but unlikely to earn more than a mild smile."
  },
  {
    range: "6",
    label: "Amusing",
    description: "A real comic idea with a mild payoff; respectable, not a winner."
  },
  {
    range: "7",
    label: "Good",
    description: "A genuinely good joke with clear timing; some humans would repeat the comic idea or turn."
  },
  {
    range: "8",
    label: "Excellent",
    description: "Strong human-level joke with a memorable turn, clean construction, and no apologetic scoring curve."
  },
  {
    range: "9",
    label: "Outstanding",
    description: "Rare and replayable; clearly better than normal good AI humor and strong by human standards."
  },
  {
    range: "10",
    label: "Classic",
    description: "Reserve for a joke a human would quote later; most seasons should have none."
  }
];

const RUBRIC = RUBRIC_FIELDS.map((field) => field.key);

export function rubricPromptText() {
  const fields = RUBRIC_FIELDS
    .map((field) => `${field.label} (${Math.round(field.weight * 100)}%): ${field.description}`)
    .join("\n");
  const anchors = SCORE_ANCHORS
    .map((anchor) => `${anchor.range} ${anchor.label}: ${anchor.description}`)
    .join("\n");

  return [
    `Rubric version: ${RUBRIC_VERSION}.`,
    "Grade against a fixed future-resistant scale, not against the weakest joke in this batch.",
    "Be strict: 5 means competent but forgettable, 6 is a mild real joke, 7 is genuinely good, 8 is excellent, 9 is rare, and 10 should almost never appear.",
    "Do not award an 8 unless the joke has a clear stage premise, a non-obvious turn, natural wording, and a final line that actually carries the laugh.",
    "Do not award a 9 unless you would expect a human comedy editor to single it out. Do not award 10 in an ordinary batch.",
    "A joke that is not understandable as a standalone joke should score no higher than 4 for laugh and craft.",
    "A joke that is not first-person stand-up should score no higher than 4 for promptFit and should lose craft if the form weakens the timing.",
    "Penalize clever-sounding nonsense, vague absurdity, generic therapy/HR/committee templates, prompt recitation, and punchlines that only restate the setup.",
    "Do not inflate scores because the seed list is odd. Reward only humor that a broad human audience could understand and enjoy.",
    "Do not reward seed-term stuffing. Prompt fit is high when exactly two seed terms are clearly used as concepts in the joke.",
    "Exact seed-term wording is not required when the concept is unmistakable.",
    "If a joke uses fewer than two or more than two seed-term concepts, promptFit must be 4 or lower unless the mismatch is purely typographic.",
    "Each judge must score every supplied joke exactly once and must not score its own joke.",
    "Use integer 1-10 scores for each field; the site computes the weighted total.",
    "Fields and weights:",
    fields,
    "Scale anchors:",
    anchors
  ].join("\n");
}

export function rubricForDisplay() {
  return {
    version: RUBRIC_VERSION,
    fields: RUBRIC_FIELDS.map((field) => ({ ...field })),
    anchors: SCORE_ANCHORS.map((anchor) => ({ ...anchor }))
  };
}

export function normalizeJudgeScores(payload, jokeIds) {
  const allowed = new Set(jokeIds);
  const scores = Array.isArray(payload.scores) ? payload.scores : [];

  return scores
    .filter((score) => allowed.has(score.jokeId))
    .map((score) => {
      const normalized = {
        jokeId: score.jokeId,
        comment: cleanComment(score.comment)
      };

      for (const field of RUBRIC) {
        normalized[field] = cleanScore(score[field]);
      }

      normalized.total = weightedTotal(normalized);
      return normalized;
    });
}

export function aggregateScores(jokes, judgeResults, options = {}) {
  const judgeNormalization = options.judgeNormalization || null;
  const scorebook = new Map(
    jokes.map((joke) => [
      joke.id,
      {
        jokeId: joke.id,
        label: joke.label,
        contestantId: joke.contestantId,
        contestantName: joke.contestantName,
        totals: [],
        rawTotals: [],
        rubric: Object.fromEntries(RUBRIC.map((field) => [field, []])),
        rawRubric: Object.fromEntries(RUBRIC.map((field) => [field, []])),
        comments: []
      }
    ])
  );

  for (const result of judgeResults) {
    for (const score of result.scores) {
      const entry = scorebook.get(score.jokeId);
      if (!entry || result.judgeId === entry.contestantId) {
        continue;
      }

      const adjusted = adjustedJudgeScore(score, result.judgeId, judgeNormalization);
      entry.totals.push(adjusted.total);
      entry.rawTotals.push(score.total);
      for (const field of RUBRIC) {
        entry.rubric[field].push(adjusted.rubric[field]);
        entry.rawRubric[field].push(score[field]);
      }
      if (score.comment) {
        entry.comments.push({
          judgeId: result.judgeId,
          judgeName: result.judgeName,
          score: round(adjusted.total),
          rawScore: round(score.total),
          scoreAdjustment: round(adjusted.total - score.total),
          comment: score.comment
        });
      }
    }
  }

  const rankings = Array.from(scorebook.values()).map((entry) => {
    const score = round(average(entry.totals));
    const rawScore = round(average(entry.rawTotals));

    return {
      jokeId: entry.jokeId,
      label: entry.label,
      contestantId: entry.contestantId,
      contestantName: entry.contestantName,
      score,
      rawScore,
      scoreAdjustment: round(score - rawScore),
      judgeCount: entry.totals.length,
      rubric: Object.fromEntries(
        RUBRIC.map((field) => [field, round(average(entry.rubric[field]))])
      ),
      rawRubric: Object.fromEntries(
        RUBRIC.map((field) => [field, round(average(entry.rawRubric[field]))])
      ),
      comments: entry.comments
    };
  });

  rankings.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.rubric.laugh !== a.rubric.laugh) {
      return b.rubric.laugh - a.rubric.laugh;
    }
    return a.contestantName.localeCompare(b.contestantName);
  });

  return rankings.map((ranking, index) => ({
    ...ranking,
    rank: index + 1
  }));
}

export function applyRollingJudgeNormalization(runs, options = {}) {
  const windowSize = Number.isFinite(Number(options.windowSize))
    ? Math.max(1, Math.round(Number(options.windowSize)))
    : JUDGE_NORMALIZATION_WINDOW;
  const chronological = [...runs].sort(compareRunsChronologically);
  const publicHistory = [];
  const normalizedBySlug = new Map();

  for (const run of chronological) {
    const context = rollingJudgeNormalizationContext(publicHistory, { windowSize });
    const rankings = aggregateScores(run.jokes || [], run.judgeResults || [], {
      judgeNormalization: context
    });
    const normalizedRun = {
      ...run,
      rankings,
      scoring: scoringMetadata(context)
    };

    normalizedBySlug.set(run.slug, normalizedRun);
    if (!run.dryRun) {
      publicHistory.push(run);
    }
  }

  return runs.map((run) => normalizedBySlug.get(run.slug) || run);
}

export function rollingJudgeNormalizationContext(previousRuns, options = {}) {
  const windowSize = Number.isFinite(Number(options.windowSize))
    ? Math.max(1, Math.round(Number(options.windowSize)))
    : JUDGE_NORMALIZATION_WINDOW;
  const windowRuns = [...previousRuns]
    .filter((run) => !run.dryRun)
    .sort(compareRunsChronologically)
    .slice(-windowSize);
  const fieldTotals = [];
  const judgeTotals = new Map();

  for (const run of windowRuns) {
    for (const result of run.judgeResults || []) {
      const judgeScores = judgeTotals.get(result.judgeId) || [];
      for (const score of result.scores || []) {
        const total = Number(score.total);
        if (!Number.isFinite(total)) {
          continue;
        }
        fieldTotals.push(total);
        judgeScores.push(total);
      }
      judgeTotals.set(result.judgeId, judgeScores);
    }
  }

  const fieldAverage = average(fieldTotals);
  const judgeAverages = new Map(
    [...judgeTotals.entries()].map(([judgeId, totals]) => [judgeId, average(totals)])
  );

  return {
    method: JUDGE_NORMALIZATION_METHOD,
    windowSize,
    historyContestCount: windowRuns.length,
    fieldAverage,
    judgeAverages,
    applied: windowRuns.length > 0 && Number.isFinite(fieldAverage) && fieldTotals.length > 0
  };
}

export function deterministicDryScores(jokes, judges, rng) {
  return judges.map((judge) => ({
    judgeId: judge.id,
    judgeName: judge.displayName,
    scores: jokes
      .filter((joke) => joke.contestantId !== judge.id)
      .map((joke) => {
        const base = 5 + Math.floor(rng() * 5);
        const score = {
          jokeId: joke.id,
          originality: clampScore(base + swing(rng)),
          surprise: clampScore(base + swing(rng)),
          craft: clampScore(base + swing(rng)),
          promptFit: clampScore(base + swing(rng)),
          laugh: clampScore(base + swing(rng)),
          comment: dryComment(rng)
        };
        score.total = weightedTotal(score);
        return score;
      })
  }));
}

function cleanScore(value) {
  return clampScore(Math.round(Number(value)));
}

function clampScore(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(10, value));
}

function cleanComment(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) {
    return 0;
  }

  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function adjustedJudgeScore(score, judgeId, context) {
  const rawTotal = Number(score.total);
  const delta = judgeScoreAdjustment(judgeId, context);
  const total = clampTotal(rawTotal + delta);
  const actualDelta = total - rawTotal;

  return {
    total,
    rubric: Object.fromEntries(
      RUBRIC.map((field) => [field, clampTotal(Number(score[field]) + actualDelta)])
    )
  };
}

function judgeScoreAdjustment(judgeId, context) {
  if (!context?.applied || !Number.isFinite(context.fieldAverage)) {
    return 0;
  }

  const judgeAverage = context.judgeAverages instanceof Map
    ? context.judgeAverages.get(judgeId)
    : Number(context.judgeAverages?.[judgeId]);

  if (!Number.isFinite(judgeAverage)) {
    return 0;
  }

  return context.fieldAverage - judgeAverage;
}

function scoringMetadata(context) {
  const judgeAverages = context?.judgeAverages instanceof Map
    ? Object.fromEntries(
      [...context.judgeAverages.entries()].map(([judgeId, value]) => [judgeId, round(value)])
    )
    : {};

  return {
    method: JUDGE_NORMALIZATION_METHOD,
    label: "Judge-normalized adjusted score",
    formula: "adjusted = raw - judge rolling average + field rolling average",
    windowSize: context?.windowSize || JUDGE_NORMALIZATION_WINDOW,
    historyContestCount: context?.historyContestCount || 0,
    fieldAverage: round(context?.fieldAverage || 0),
    judgeAverages,
    applied: Boolean(context?.applied)
  };
}

function weightedTotal(score) {
  const usable = RUBRIC_FIELDS.filter((field) => Number.isFinite(score[field.key]));
  if (!usable.length) {
    return 0;
  }

  const weightSum = usable.reduce((sum, field) => sum + field.weight, 0);
  return usable.reduce((sum, field) => sum + score[field.key] * field.weight, 0) / weightSum;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function clampTotal(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(1, Math.min(10, value));
}

function compareRunsChronologically(a, b) {
  return runSortKey(a).localeCompare(runSortKey(b));
}

function runSortKey(run) {
  return [
    run?.publishedDate || String(run?.createdAt || "").slice(0, 10),
    run?.createdAt || "",
    run?.slug || ""
  ].join("|");
}

function swing(rng) {
  return Math.floor(rng() * 5) - 2;
}

function dryComment(rng) {
  const comments = [
    "Clean prompt fit with a crisp turn.",
    "The image is strange enough to carry the joke.",
    "Good structure, though the payoff could hit harder.",
    "Nice surprise without losing the prompt.",
    "A tidy joke with a pleasingly odd angle."
  ];

  return comments[Math.floor(rng() * comments.length)];
}
