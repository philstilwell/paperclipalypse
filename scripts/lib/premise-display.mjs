const ARTICLE_RE = /^(a|an|the)\s+/i;

export function normalizePremiseForDisplay(premise = {}, seedTerms = []) {
  const sourcePremise = premise && typeof premise === "object" ? premise : {};
  // Protocol: contestants receive seed terms, not a prebuilt premise.
  const displayText = cleanDisplayHeadline(sourcePremise.headline)
    || cleanDisplayHeadline(sourcePremise.teaserText)
    || cleanDisplayHeadline(sourcePremise.displayText)
    || displayPremiseFromParts(sourcePremise)
    || displayPremiseFromSeedTerms(seedTerms);

  return {
    ...sourcePremise,
    displayText: displayText || cleanDisplayHeadline(sourcePremise.text)
  };
}

export function isSeedTermsDisplayText(value) {
  return /^seed terms\s*:/i.test(cleanDisplayText(value));
}

export function displaySeedTerms(seedTerms = []) {
  if (!Array.isArray(seedTerms) || !seedTerms.length) {
    return "";
  }

  return `Seed terms: ${seedTerms.map(cleanDisplayText).filter(Boolean).join(", ")}`;
}

export function displayPremiseFromSeedTerms(seedTerms = []) {
  if (!Array.isArray(seedTerms) || seedTerms.length < 6) {
    return "";
  }

  const [, occupation, location, conflict, positiveTrait, negativeTrait] = seedTerms
    .map(cleanDisplayText);
  if (!occupation || !location || !conflict) {
    return "";
  }

  const traits = [positiveTrait, negativeTrait].filter(Boolean).map(lowerPhrase).join(", ");
  const role = displayOccupation(occupation);
  const problem = displayConflict(conflict);
  const setting = displayLocation(location);
  const subject = [traits, role].filter(Boolean).join(" ");
  const description = [
    indefiniteArticle(subject),
    subject,
    "faces",
    problem,
    setting
  ].filter(Boolean).join(" ");

  return `${description}.`.replace(/\s+\./g, ".");
}

export function displayPremiseFromParts(premise = {}) {
  const person = displayOccupation(premise.person);
  const place = displayLocation(premise.place);
  const element = displayConflict(premise.element);

  if (!person || !place || !element) {
    return cleanDisplayHeadline(premise.text);
  }

  return `A ${person} faces ${element} ${place}.`;
}

function displayOccupation(value) {
  const text = cleanDisplayText(value);
  if (!text) {
    return "";
  }

  const slashParts = text.split("/").map(cleanDisplayText).filter(Boolean);
  return lowerPhrase(slashParts[slashParts.length - 1] || text);
}

function displayConflict(value) {
  const text = cleanDisplayText(value);
  if (!text) {
    return "";
  }

  const runningOut = text.match(/^running out of\s+(.+)$/i);
  if (runningOut) {
    return `a shortage of ${lowerPhrase(runningOut[1])}`;
  }

  const being = text.match(/^being\s+(.+)$/i);
  if (being) {
    return `being ${lowerPhrase(orList(being[1]))}`;
  }

  return lowerPhrase(orList(text));
}

function displayLocation(value) {
  const text = cleanDisplayText(value);
  if (!text) {
    return "";
  }

  const location = lowerPhrase(text);
  const preposition = /\b(party|festival|conference|meeting|wedding|funeral)\b/.test(location)
    ? "at"
    : "in";

  return `${preposition} ${withDefiniteArticle(location)}`;
}

function indefiniteArticle(text) {
  return /^[aeiou]/i.test(cleanDisplayText(text)) ? "An" : "A";
}

function withDefiniteArticle(text) {
  if (!text || ARTICLE_RE.test(text)) {
    return text;
  }

  return `the ${text}`;
}

function orList(text) {
  return cleanDisplayText(text).replace(/\s*\/\s*/g, " or ");
}

function lowerPhrase(value) {
  return cleanDisplayText(value).toLowerCase();
}

function cleanDisplayText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDisplayHeadline(value) {
  const text = cleanDisplayText(value);
  return isSeedTermsDisplayText(text) ? "" : text;
}
