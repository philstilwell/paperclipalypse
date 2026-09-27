import { normalizeDateOnly, publicationDateOnly } from "./publish-date.mjs";

export function showcaseDateWindow(now = new Date()) {
  const endDate = publicationDateOnly(now);
  const [year, month, day] = endDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 4, 1));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(day, lastDay));

  return { startDate: start.toISOString().slice(0, 10), endDate };
}

export function rankedShowcaseRuns(runs, { limit = 7, window = showcaseDateWindow() } = {}) {
  const publicationDate = (run) => normalizeDateOnly(run.publishedDate || run.createdAt);

  return runs
    .filter((run) => (
      !run.dryRun
      && run.featureImage?.src
      && run.rankings?.[0]
      && Number.isFinite(Number(run.rankings[0].score))
      && (run.publishedDate || run.createdAt)
      && publicationDate(run) >= window.startDate
      && publicationDate(run) <= window.endDate
    ))
    .sort((a, b) => (
      Number(b.rankings[0].score) - Number(a.rankings[0].score)
      || publicationDate(b).localeCompare(publicationDate(a))
      || String(b.slug).localeCompare(String(a.slug))
    ))
    .slice(0, limit);
}
