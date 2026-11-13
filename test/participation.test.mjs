import assert from "node:assert/strict";
import test from "node:test";
import { assertCompleteTournament } from "../scripts/lib/participation.mjs";

const roster = ["openai", "anthropic", "google", "xai", "copilot"];
const seedTerms = ["one", "two", "three", "four", "five", "six"];

test("accepts a complete five-contestant tournament by default", () => {
  const round = makeRound(roster);
  assert.doesNotThrow(() => assertCompleteTournament(round));
});

test("rejects a four-contestant tournament without explicit outage opt-in", () => {
  const round = makeRound(roster.slice(0, 4));
  assert.throws(
    () => assertCompleteTournament({
      ...round,
      participationException: outageException(),
      expectedContestantIds: roster
    }),
    /--allow-model-outage/
  );
});

test("accepts one documented configured-model outage with explicit opt-in", () => {
  const round = makeRound(roster.slice(0, 4));
  assert.doesNotThrow(() => assertCompleteTournament({
    ...round,
    participationException: outageException(),
    allowModelOutage: true,
    expectedContestantIds: roster
  }));
});

test("rejects an outage record that names the wrong missing contestant", () => {
  const round = makeRound(roster.slice(0, 4));
  assert.throws(
    () => assertCompleteTournament({
      ...round,
      participationException: {
        ...outageException(),
        unavailableContestantIds: ["google"]
      },
      allowModelOutage: true,
      expectedContestantIds: roster
    }),
    /must match the one missing configured roster member/
  );
});

function outageException() {
  return {
    type: "model-outage",
    unavailableContestantIds: ["copilot"],
    details: "Microsoft Copilot remained unavailable after repeated attempts."
  };
}

function makeRound(ids) {
  const contestants = ids.map((id) => ({ id }));
  const jokes = ids.map((id, index) => ({
    id: `joke-${id}`,
    contestantId: id,
    seedTermsUsed: [seedTerms[index % seedTerms.length], seedTerms[(index + 1) % seedTerms.length]],
    joke: `I tried a carefully planned comedy experiment for ${id}, and my audience stayed patient until the punchline arrived with a receipt, a helmet, and an apology.`
  }));
  const judgeResults = ids.map((judgeId) => ({
    judgeId,
    scores: jokes
      .filter((joke) => joke.contestantId !== judgeId)
      .map((joke) => ({
        jokeId: joke.id,
        originality: 6,
        surprise: 6,
        craft: 6,
        promptFit: 6,
        laugh: 6,
        comment: "A complete, concise assessment."
      }))
  }));
  return { contestants, jokes, judgeResults, seedTerms };
}
