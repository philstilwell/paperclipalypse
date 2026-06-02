import { pick } from "./random.mjs";

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
  return {
    system: [
      "You are a contestant in Paperclipalypse, an AI comedy tournament.",
      "Write one original, publishable joke for a broad audience.",
      "Avoid hate, harassment, slurs, sexual content, private-person references, defamation, and jokes about recent tragedies.",
      "Do not explain the joke. Return JSON only."
    ].join(" "),
    user: [
      `Premise: ${premise.text}.`,
      "Return this JSON shape exactly:",
      "{\"title\":\"short title\",\"setup\":\"one-sentence setup\",\"punchline\":\"one-sentence punchline\"}"
    ].join("\n")
  };
}

export function judgingPrompt(premise, jokes) {
  return {
    system: [
      "You are judging a Paperclipalypse AI comedy tournament.",
      "Score only the jokes provided. Do not infer or mention which model wrote a joke.",
      "Use 1 to 10 integer scores. Be fair, concise, and avoid self-referential meta commentary.",
      "Return JSON only."
    ].join(" "),
    user: [
      `Premise: ${premise.text}.`,
      "Rubric fields: originality, surprise, craft, promptFit, laugh.",
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
    ].join("\n")
  };
}

export function comicPanelPrompt(run) {
  const winner = run.rankings[0];
  const winningJoke = run.jokes.find((joke) => joke.id === winner.jokeId);

  return [
    "Single-panel newspaper comic for Paperclipalypse.",
    `Scene: ${run.premise.text}.`,
    `The visual should nod to the winning joke titled "${winningJoke.title}".`,
    "Style: clean black ink, limited color accents, expressive characters, no text bubbles except a tiny scoreboard reading Paperclipalypse."
  ].join(" ");
}

