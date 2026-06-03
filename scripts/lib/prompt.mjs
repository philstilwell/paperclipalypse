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
      "Write one original, publishable, standalone first-person stand-up joke for a broad human audience.",
      "Tell it as the onstage comic using I, me, or my naturally; do not write a detached story summary.",
      "The joke must be understandable and funny if read by itself, without the title, premise, or seed list.",
      "Your goal is the strongest human laugh, not maximum seed compliance.",
      "Use exactly two seed terms in the joke text, no more and no fewer.",
      "Choose the two seed terms that make the funniest natural joke; ignore the other four completely.",
      "Do not cram in all six terms, explain the premise, or make a list.",
      "Silently consider several comic angles, then output only the strongest one.",
      "Prefer concrete, familiar situations, stage rhythm, and a clear final turn over whimsy, lore, or clever fog.",
      "Avoid default AI joke templates about HR, committees, therapy, awkward meetings, and 'interesting choice' unless the angle is genuinely fresh.",
      "End on the funniest phrase or sentence; do not put the real punchline only in the title.",
      "Keep it concise: usually 30-90 words.",
      "Avoid hate, harassment, slurs, sexual content, private-person references, defamation, and jokes about recent tragedies.",
      "Do not explain the joke. Return JSON only."
    ].join(" "),
    user: [
      `Premise: ${premise.text}.`,
      seedText ? `Seed terms: ${seedText}.` : "",
      "Write the joke as a first-person stand-up bit. The comic should be speaking from the stage, using I, me, or my naturally.",
      "The seed terms are ingredients, not a checklist. Use exactly two of them in the joke text and leave the other four out.",
      "The `joke` field must contain the complete standalone joke humans will read on the site, including the setup and punchline.",
      "Before returning, reject any version that is merely cute, random, pun-only, or understandable only because of the prompt.",
      "Return `seedTermsUsed` as an array containing exactly the two seed terms you used.",
      "Return this JSON shape exactly:",
      "{\"title\":\"short title\",\"seedTermsUsed\":[\"term one\",\"term two\"],\"joke\":\"complete standalone first-person stand-up joke, 30-90 words\"}"
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
          seedTermsUsed: joke.seedTermsUsed || [],
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
