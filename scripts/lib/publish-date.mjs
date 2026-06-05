export const PUBLICATION_TIME_ZONE = "America/New_York";

const datePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: PUBLICATION_TIME_ZONE
});

const shortDateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC"
});

export function publicationDateOnly(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  const parts = Object.fromEntries(
    datePartsFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shortPublicationDate(value) {
  const dateOnly = normalizeDateOnly(value);
  const [year, month, day] = dateOnly.split("-").map(Number);
  return shortDateFormatter.format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function normalizeDateOnly(value) {
  if (value && typeof value === "object" && typeof value.publishedDate === "string") {
    return value.publishedDate;
  }

  const text = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return publicationDateOnly(text || new Date());
}
