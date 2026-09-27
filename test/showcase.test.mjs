import assert from "node:assert/strict";
import test from "node:test";
import { rankedShowcaseRuns, showcaseDateWindow } from "../scripts/lib/showcase.mjs";

const window = showcaseDateWindow("2026-09-27");

function winner(slug, publishedDate, score, overrides = {}) {
  return {
    slug,
    publishedDate,
    rankings: [{ score }],
    featureImage: { src: `/assets/${slug}.png` },
    ...overrides
  };
}

test("showcase uses three calendar months, clamping shorter months and crossing years", () => {
  assert.deepEqual(window, { startDate: "2026-06-27", endDate: "2026-09-27" });
  assert.equal(showcaseDateWindow("2026-05-31").startDate, "2026-02-28");
  assert.equal(showcaseDateWindow("2024-05-31").startDate, "2024-02-29");
  assert.equal(showcaseDateWindow("2026-01-31").startDate, "2025-10-31");
  assert.deepEqual(showcaseDateWindow(new Date("2026-09-28T02:00:00Z")), window);
});

test("showcase takes the seven highest scores in the window and favors newer rounds in ties", () => {
  const runs = [
    winner("too-old", "2026-06-26", 10),
    winner("future", "2026-09-28", 10),
    winner("cutoff", "2026-06-27", 8),
    winner("today", "2026-09-27", 8),
    ...Array.from({ length: 6 }, (_, index) => winner(`round-${index}`, `2026-09-0${index + 1}`, 7))
  ];
  const originalOrder = runs.map((run) => run.slug);

  assert.deepEqual(rankedShowcaseRuns(runs, { window }).map((run) => run.slug), [
    "today", "cutoff", "round-5", "round-4", "round-3", "round-2", "round-1"
  ]);
  assert.deepEqual(runs.map((run) => run.slug), originalOrder);
  assert.equal(rankedShowcaseRuns(runs, { window, limit: 1 })[0].slug, "today");
});

test("showcase uses publication dates and falls back to New York dates for older records", () => {
  const runs = [
    winner("published-on-cutoff", "2026-06-27", 8, { createdAt: "2026-06-26T18:00:00Z" }),
    winner("before-cutoff-in-new-york", undefined, 9, { createdAt: "2026-06-27T02:00:00Z" }),
    winner("cutoff-in-new-york", undefined, 7, { createdAt: "2026-06-27T15:00:00Z" }),
    winner("future-publication", "2026-09-28", 10, { createdAt: "2026-09-27T15:00:00Z" })
  ];

  assert.deepEqual(rankedShowcaseRuns(runs, { window }).map((run) => run.slug), [
    "published-on-cutoff", "cutoff-in-new-york"
  ]);
});

test("showcase excludes demos and incomplete winners without backfilling from older contests", () => {
  const runs = [
    winner("eligible", "2026-09-01", 7),
    winner("demo", "2026-09-01", 10, { dryRun: true }),
    winner("no-image", "2026-09-01", 10, { featureImage: null }),
    winner("no-winner", "2026-09-01", 10, { rankings: [] }),
    winner("invalid-score", "2026-09-01", "invalid"),
    winner("no-date", undefined, 10),
    winner("old", "2026-06-26", 10)
  ];

  assert.deepEqual(rankedShowcaseRuns(runs, { window }).map((run) => run.slug), ["eligible"]);
  assert.deepEqual(rankedShowcaseRuns(runs, { window: showcaseDateWindow("2027-01-01") }), []);
  assert.deepEqual(rankedShowcaseRuns([], { window }), []);
});
