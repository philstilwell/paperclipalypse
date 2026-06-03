import { pick } from "./random.mjs";
import { rubricPromptText } from "./scoring.mjs";

export function buildPremise(pools, rng) {
  const place = pick(pools.places, rng);
  const person = pick(pools.people, rng);
  const element = pick(pools.elements, rng);

  return {
    place,
    person,
    element,
    text: `${person} at ${place}, dealing with ${element}`
  };
}

export function generationPrompt(premise) {
  const seedText = seedTermsText(premise.seedTerms);
  return {
    system: [
      "You are a contestant in Paperclipalypse, an AI comedy tournament.",
      "Write one original, publishable joke or very short humorous story for a broad human audience.",
      "Your goal is the strongest laugh, not maximum seed compliance.",
      "Use two or three seed terms naturally if that makes the joke better; it is fine to ignore the rest.",
      "Do not cram in all six terms, explain the premise, or make a list.",
      "Keep it concise: the full joke should usually be 35-90 words.",
      "Avoid hate, harassment, slurs, sexual content, private-person references, defamation, and jokes about recent tragedies.",
      "Do not explain the joke. Return JSON only."
    ].join(" "),
    user: [
      `Premise: ${premise.text}.`,
      seedText ? `Seed terms: ${seedText}.` : "",
      "The seed terms are ingredients, not requirements. Prefer the funniest two or three.",
      "Return this JSON shape exactly:",
      "{\"title\":\"short title\",\"setup\":\"one to three short sentences\",\"punchline\":\"one final sentence\"}"
    ].filter(Boolean).join("\n")
  };
}

export function judgingPrompt(premise, jokes) {
  const seedText = seedTermsText(premise.seedTerms);
  return {
    system: [
      "You are judging a Paperclipalypse AI comedy tournament.",
      "Score only the jokes provided. Do not infer or mention which model wrote a joke.",
      "Use 1 to 10 integer scores. Be fair, strict, concise, and avoid self-referential meta commentary.",
      "Return JSON only."
    ].join(" "),
    user: [
      `Premise: ${premise.text}.`,
      seedText ? `Seed terms: ${seedText}.` : "",
      rubricPromptText(),
      "Jokes to judge:",
      JSON.stringify(
        jokes.map((joke) => ({
          jokeId: joke.id,
          label: joke.label,
          text: joke.text
        })),
        null,
        2
      ),
      "Return this JSON shape:",
      "{\"scores\":[{\"jokeId\":\"id\",\"originality\":7,\"surprise\":7,\"craft\":7,\"promptFit\":7,\"laugh\":7,\"comment\":\"brief note\"}]}"
    ].filter(Boolean).join("\n")
  };
}

export function comicPanelPrompt(run) {
  const winner = run.rankings[0];
  const winningJoke = run.jokes.find((joke) => joke.id === winner.jokeId);

  return [
    "Single-panel newspaper comic for Paperclipalypse.",
    `Scene: ${run.premise.text}.`,
    run.seedTerms?.length ? `Seed terms: ${run.seedTerms.join(", ")}.` : "",
    `The visual should nod to the winning joke titled "${winningJoke.title}".`,
    "Style: clean black ink, limited color accents, expressive characters, no text bubbles except a tiny scoreboard reading Paperclipalypse."
  ].filter(Boolean).join(" ");
}

function seedTermsText(seedTerms) {
  if (!Array.isArray(seedTerms) || !seedTerms.length) {
    return "";
  }

  return seedTerms.join(", ");
}
