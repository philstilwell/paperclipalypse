export const RUBRIC_VERSION = "2026-06-first-person-standup-v3";

export const RUBRIC_FIELDS = [
  {
    key: "laugh",
    label: "Laugh",
    weight: 0.4,
    description: "How likely a human reader is to actually laugh, not merely admire the idea."
  },
  {
    key: "surprise",
    label: "Surprise",
    weight: 0.2,
    description: "Whether the turn avoids the obvious route and lands with a satisfying snap."
  },
  {
    key: "craft",
    label: "Craft",
    weight: 0.2,
    description: "Economy, stage rhythm, first-person clarity, escalation, and clean final punchline placement."
  },
  {
    key: "originality",
    label: "Originality",
    weight: 0.1,
    description: "Freshness of comic angle, image, and wording."
  },
  {
    key: "promptFit",
    label: "Prompt Fit",
    weight: 0.1,
    description: "Natural first-person stand-up form using exactly two seed terms, with the other four left out."
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
    description: "Recognizably attempting humor, but generic, strained, or confusing."
  },
  {
    range: "5",
    label: "Competent",
    description: "Clear and publishable as filler, but unlikely to earn a real laugh."
  },
  {
    range: "6",
    label: "Amusing",
    description: "A real comic idea with a mild payoff."
  },
  {
    range: "7",
    label: "Good",
    description: "Would fit a curated humor page; most readers can see why it is funny."
  },
  {
    range: "8",
    label: "Excellent",
    description: "Strong human-level joke with a memorable turn and clean construction."
  },
  {
    range: "9",
    label: "Outstanding",
    description: "Rare, replayable, and clearly better than normal good AI humor."
  },
  {
    range: "10",
    label: "Classic",
    description: "Reserve for a joke a human would quote later; most contests should have none."
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
    "Be strict: 5 means competent but forgettable, 7 means genuinely good, 8 means excellent, 9 is rare, and 10 should almost never appear.",
    "A joke that is not understandable as a standalone joke should score no higher than 4 for laugh and craft.",
    "A joke that is not first-person stand-up should score no higher than 4 for promptFit and should lose craft if the form weakens the timing.",
    "Penalize clever-sounding nonsense, vague absurdity, premise recitation, and punchlines that only restate the setup.",
    "Do not inflate scores because the premise is odd. Reward only humor that a broad human audience could understand and enjoy.",
    "Do not reward seed-term stuffing. Prompt fit is high only when exactly two seed terms are used naturally.",
    "If a joke uses fewer than two or more than two seed terms, promptFit should be 4 or lower unless the mistake is very minor.",
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

export function aggregateScores(jokes, judgeResults) {
  const scorebook = new Map(
    jokes.map((joke) => [
      joke.id,
      {
        jokeId: joke.id,
        label: joke.label,
        contestantId: joke.contestantId,
        contestantName: joke.contestantName,
        totals: [],
        rubric: Object.fromEntries(RUBRIC.map((field) => [field, []])),
        comments: []
      }
    ])
  );

  for (const result of judgeResults) {
    for (const score of result.scores) {
      const entry = scorebook.get(score.jokeId);
      if (!entry || result.judgeId === score.jokeId) {
        continue;
      }

      entry.totals.push(score.total);
      for (const field of RUBRIC) {
        entry.rubric[field].push(score[field]);
      }
      if (score.comment) {
        entry.comments.push({
          judgeId: result.judgeId,
          judgeName: result.judgeName,
          comment: score.comment
        });
      }
    }
  }

  const rankings = Array.from(scorebook.values()).map((entry) => ({
    jokeId: entry.jokeId,
    label: entry.label,
    contestantId: entry.contestantId,
    contestantName: entry.contestantName,
    score: round(average(entry.totals)),
    judgeCount: entry.totals.length,
    rubric: Object.fromEntries(
      RUBRIC.map((field) => [field, round(average(entry.rubric[field]))])
    ),
    comments: entry.comments
  }));

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
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= 180) {
    return cleaned;
  }

  return `${cleaned.slice(0, 177).replace(/\s+\S*$/, "").trim()}...`;
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) {
    return 0;
  }

  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
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

function swing(rng) {
  return Math.floor(rng() * 5) - 2;
}

function dryComment(rng) {
  const comments = [
    "Clean premise fit with a crisp turn.",
    "The image is strange enough to carry the joke.",
    "Good structure, though the payoff could hit harder.",
    "Nice surprise without losing the prompt.",
    "A tidy joke with a pleasingly odd angle."
  ];

  return comments[Math.floor(rng() * comments.length)];
}
