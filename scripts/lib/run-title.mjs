import {
  displayPremiseFromSeedTerms,
  isSeedTermsDisplayText,
  normalizePremiseForDisplay
} from "./premise-display.mjs";

export function resolveRunDisplayTitle(run = {}) {
  const seedTerms = Array.isArray(run.seedTerms) ? run.seedTerms : [];
  const explicitTitle = explicitPremiseTitle(run.premise, seedTerms);
  const winnerTitle = winningJokeTitle(run);
  const fallbackText = cleanText(run.premise?.text);
  const safeFallback = isSeedDerivedRunTitle(fallbackText, seedTerms) ? "" : fallbackText;
  const normalized = normalizePremiseForDisplay(run.premise, seedTerms);
  const normalizedTitle = cleanText(normalized.displayText);
  const safeNormalized = isSeedDerivedRunTitle(normalizedTitle, seedTerms) ? "" : normalizedTitle;

  return explicitTitle || winnerTitle || safeFallback || safeNormalized || cleanText(run.slug) || "Untitled round";
}

export function isSeedDerivedRunTitle(value, seedTerms = []) {
  const title = cleanText(value);
  const derivedSeedTitle = cleanText(displayPremiseFromSeedTerms(seedTerms));

  return Boolean(
    title && (
      isSeedTermsDisplayText(title) ||
      (derivedSeedTitle && title === derivedSeedTitle)
    )
  );
}

function explicitPremiseTitle(premise = {}, seedTerms = []) {
  const sourcePremise = premise && typeof premise === "object" ? premise : {};
  const candidates = [
    sourcePremise.headline,
    sourcePremise.teaserText,
    sourcePremise.displayText
  ];

  for (const candidate of candidates) {
    const title = cleanText(candidate);
    if (title && !isSeedDerivedRunTitle(title, seedTerms)) {
      return title;
    }
  }

  return "";
}

function winningJokeTitle(run = {}) {
  const winner = Array.isArray(run.rankings) ? run.rankings[0] : null;
  const jokes = Array.isArray(run.jokes) ? run.jokes : [];
  const winningJoke = jokes.find((joke) => joke.id === winner?.jokeId);
  return cleanText(winningJoke?.title);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}
