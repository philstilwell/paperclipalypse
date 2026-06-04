const ARTICLE_RE = /^(a|an|the)\s+/i;

export function normalizePremiseForDisplay(premise = {}, seedTerms = []) {
  const sourcePremise = premise && typeof premise === "object" ? premise : {};
  // Protocol: premise.text is the full prompt/audit premise; displayText is the public hero teaser.
  const displayText = cleanDisplayText(sourcePremise.displayText)
    || displayPremiseFromSeedTerms(seedTerms)
    || displayPremiseFromParts(sourcePremise);

  return {
    ...sourcePremise,
    displayText: displayText || cleanDisplayText(sourcePremise.text)
  };
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
  const description = [
    "A",
    traits,
    role,
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
    return cleanDisplayText(premise.text);
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

  return `in ${withDefiniteArticle(lowerPhrase(text))}`;
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
