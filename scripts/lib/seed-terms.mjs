import { pick } from "./random.mjs";
import { normalizePremiseForDisplay } from "./premise-display.mjs";

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

export function buildPromptContextFromSeedTerms(seedTerms) {
  if (!Array.isArray(seedTerms) || !seedTerms.length) {
    return null;
  }

  return normalizePremiseForDisplay({
    text: `Seed terms: ${seedTerms.join(", ")}`,
    seedTerms
  }, seedTerms);
}
