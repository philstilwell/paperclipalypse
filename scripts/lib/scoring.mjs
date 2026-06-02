const RUBRIC = ["originality", "surprise", "craft", "promptFit", "laugh"];

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

      normalized.total = average(RUBRIC.map((field) => normalized[field]));
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
        score.total = average(RUBRIC.map((field) => score[field]));
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
    .trim()
    .slice(0, 180);
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) {
    return 0;
  }

  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
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

