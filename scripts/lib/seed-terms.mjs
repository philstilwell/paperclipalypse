import { pick } from "./random.mjs";

export const SEED_CATEGORIES = [
  "genre",
  "occupation",
  "location",
  "conflict",
  "positiveTrait",
  "negativeTrait"
];

export function buildSeedTerms(seedLists, rng) {
  const lists = seedLists?.lists || {};

  return SEED_CATEGORIES.map((category) => {
    const values = Array.isArray(lists[category]) ? lists[category].filter(Boolean) : [];
    if (!values.length) {
      throw new Error(`Seed list "${category}" is empty`);
    }

    return pick(values, rng);
  });
}

export function buildPremiseFromSeedTerms(seedTerms) {
  if (!Array.isArray(seedTerms) || seedTerms.length < 6) {
    return null;
  }

  const [genre, occupation, location, conflict, positiveTrait, negativeTrait] = seedTerms;

  return {
    place: location,
    person: occupation,
    element: conflict,
    text: `${occupation} at ${location}, facing ${conflict}, with a ${positiveTrait} instinct and a ${negativeTrait} streak in a ${genre} mode`,
    seedTerms
  };
}

