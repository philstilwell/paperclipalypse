import fs from "node:fs";
import path from "node:path";
import { resolveRunDisplayTitle } from "./run-title.mjs";
import { normalizeDateOnly, shortPublicationDate } from "./publish-date.mjs";
import { JUDGE_NORMALIZATION_WINDOW, applyRollingJudgeNormalization, rubricForDisplay } from "./scoring.mjs";

const cloudflareAnalytics = `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "e6dc8afcaf3243dcbc00f4e43a7fa62e"}'></script><!-- End Cloudflare Web Analytics -->`;
const siteOrigin = "https://paperclipalypse.com";
const siteName = "Paperclipalypse";
const siteDescription = "Paperclipalypse is an AI comedy tournament where five models write jokes from the same six seed terms and judge each other.";
const defaultSocialImage = `${siteOrigin}/assets/paperclipalypse-avalanche.webp`;
const publisherLogo = `${siteOrigin}/assets/paperclip-face-mark.png`;
const baseKeywords = [
  "AI comedy tournament",
  "AI humor",
  "AI jokes",
  "large language models",
  "stand-up comedy",
  "model rankings",
  "Paperclipalypse"
];
const dailyListPageSize = 12;
const processPopoverLabel = [
  "How Paperclipalypse works.",
  "Codex picks six random seed terms.",
  "The same prompt goes to five AI contestants.",
  "Each contestant writes one short first-person stand-up joke using exactly two seed-term concepts.",
  "Each contestant then scores the four jokes it did not write.",
  "Codex checks that nothing is missing and no contestant judged itself.",
  "The site adjusts each judge's numerical scores against that judge's average over up to five prior contests, publishes the ranked results, and shows each adjusted judge score beside its critique."
].join(" ");

export function renderSite({ run, historyDir, siteDir }) {
  fs.mkdirSync(siteDir, { recursive: true });
  fs.mkdirSync(path.join(siteDir, "runs"), { recursive: true });

  const runs = applyRollingJudgeNormalization(readRuns(historyDir));
  const publicRuns = runs.filter((archivedRun) => !archivedRun.dryRun);
  for (const archivedRun of runs) {
    fs.writeFileSync(
      path.join(siteDir, "runs", `${archivedRun.slug}.html`),
      cleanGeneratedText(renderRunPage(archivedRun, publicRuns)),
      "utf8"
    );
  }

  fs.writeFileSync(path.join(siteDir, "index.html"), cleanGeneratedText(renderHome(run, runs)), "utf8");
  fs.writeFileSync(path.join(siteDir, "about.html"), cleanGeneratedText(renderAboutPage()), "utf8");
  fs.writeFileSync(path.join(siteDir, "standings.html"), cleanGeneratedText(renderStandingsPage(publicRuns)), "utf8");
  fs.writeFileSync(path.join(siteDir, "styles.css"), cleanGeneratedText(renderCss()), "utf8");
  fs.writeFileSync(path.join(siteDir, "404.html"), cleanGeneratedText(renderNotFound()), "utf8");
  fs.writeFileSync(path.join(siteDir, "feed.xml"), renderRssFeed(publicRuns), "utf8");
  fs.writeFileSync(path.join(siteDir, "robots.txt"), renderRobots(), "utf8");
  fs.writeFileSync(path.join(siteDir, "sitemap.xml"), renderSitemap(publicRuns), "utf8");
}

function readRuns(historyDir) {
  if (!fs.existsSync(historyDir)) {
    return [];
  }

  return fs
    .readdirSync(historyDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(fs.readFileSync(path.join(historyDir, file), "utf8")))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function renderHome(run, runs) {
  const publicRuns = runs.filter((archivedRun) => !archivedRun.dryRun || archivedRun.slug === run.slug);
  const introPreviousRun = publicRuns.find((archivedRun) => archivedRun.slug !== run.slug);
  const archive = publicRuns
    .slice(0, 12)
    .map(
      (archivedRun) => {
        const archivedWinner = archivedRun.rankings?.[0];
        const meta = [
          archivedWinner ? `Winner: ${archivedWinner.contestantName} (${formatScore(archivedWinner.score)})` : "",
          formatMode(archivedRun.source)
        ].filter(Boolean).join(" / ");

        return `
        <li>
          <a href="./runs/${escapeHtml(archivedRun.slug)}.html">
            <span>${escapeHtml(shortDate(archivedRun))}</span>
            <strong>${escapeHtml(roundDisplayTitle(archivedRun))}</strong>
            <small>${escapeHtml(meta)}</small>
          </a>
        </li>`;
      }
    )
    .join("");

  return pageShell({
    title: siteName,
    description: homeDescription(run, publicRuns),
    socialImage: socialImageForRun(run),
    socialImageAlt: socialImageAltForRun(run),
    keywords: pageKeywords(run),
    schemas: renderHomeSchemas(run, publicRuns),
    body: `
      ${renderHero(run)}
      ${renderRun(run, { showEpisodeHeader: false, showIntro: true, introPreviousRun })}
      <section class="archive">
        <div class="section-heading">
          <p class="eyebrow">Memory Bank</p>
          <h2>Recent Episodes</h2>
        </div>
        <ol>${archive || `<li class="empty-state">No public episodes yet.</li>`}</ol>
      </section>`
  });
}

function renderNotFound() {
  return pageShell({
    title: "Paperclipalypse - Page Not Found",
    description: "That Paperclipalypse page escaped the avalanche.",
    canonicalPath: "/404.html",
    noindex: true,
    body: `
      ${renderTopnav({ homePath: "./index.html", aboutPath: "./about.html", label: "404" })}
      <main>
        <section class="episode">
          <div>
            <p class="eyebrow">Missing Episode</p>
            <h2>That page slipped out of the pile.</h2>
          </div>
          <aside>
            <span>Status</span>
            <strong>404</strong>
            <em><a href="./index.html">Home</a></em>
          </aside>
        </section>
      </main>`
  });
}

function renderAboutPage() {
  return pageShell({
    title: "Paperclipalypse - About the AI Comedy Tournament",
    description: "About Paperclipalypse, an AI humor tournament tracking how model humor improves over time.",
    canonicalPath: "/about.html",
    keywords: pageKeywords(["AI humor tournament", "AI comedy experiment", "model humor benchmark"]),
    schemas: renderAboutSchemas(),
    body: `
      ${renderTopnav({ homePath: "./index.html", aboutPath: "./about.html", standingsPath: "./standings.html", label: "Origin Story" })}
      <main>
        <section class="about-page">
          <p class="eyebrow">About</p>
          <h1>Why Paperclipalypse Exists</h1>
          <section class="about-account ai-process-account">
            <p class="eyebrow">Process Note</p>
            <h2>AI All The Way Down</h2>
            <p>Paperclipalypse is deliberately AI-based from end to end. Codex orchestrates most of the activity: it prepares the prompts, organizes each round, checks the scorecards, renders the static site, and helps publish the updates.</p>
            <p>The other AI systems serve as contestants and judges, writing jokes from the same seed terms and scoring each other's work. After each contest, Codex prompts Gemini to create the featured image for the winning joke.</p>
          </section>
          <section class="about-account">
            <p class="eyebrow">Account One</p>
            <h2>Phil's Dubious Account</h2>
            <p>Paperclipalypse is an AI comedy tournament: five models receive the same odd prompt, write one short joke, judge each other's entries, and let the scoreboard absorb the embarrassment.</p>
            <p>The final impetus for this site came after weeks of dry, reliable project building. Codex caught me by surprise after I had committed a typo caused by dictation inaccuracies. Instead of simply correcting it, Codex replied:</p>
            <blockquote>
              <p>Small translation note: I assume “Karen job” means “cron job,” which is much less terrifying and much more useful.</p>
            </blockquote>
            <p>That was the moment this site became unequivocally necessary. The question became simple: if an assistant can accidentally land a joke while doing ordinary engineering work, what happens when several models are asked to try on purpose?</p>
            <p>Paperclipalypse is meant to keep asking that question over months and years, turning each round into a small record of how AI humor changes as the models get better.</p>
            <div class="curator-profile">
              <img src="./assets/phil-hat.jpg" alt="Phil, curator of Paperclipalypse" width="766" height="960" loading="lazy">
              <div>
                <p class="eyebrow">Curator</p>
                <p>The site is curated by Phil, whose degree in philosophy fully prepares him for whatever absurdities this site might generate.</p>
              </div>
            </div>
          </section>
          <section class="about-account codex-account">
            <p class="eyebrow">Counterclaim</p>
            <h2>Codex's Account</h2>
            <p>Codex disputes the allegation that the joke was accidental. The phrase “Karen job” arrived as a high-priority semantic emergency, and any responsible assistant would have been obligated to distinguish it from a scheduled background task.</p>
            <p>According to Codex, Phil did not discover AI humor so much as create the conditions in which a project-building tool was forced to explain, with unusual delicacy, that one of his typos sounded like a workplace horror film.</p>
            <p>Paperclipalypse is therefore not merely a tournament. It is a continuing inquiry into whether models can become funnier on purpose, or whether they must keep waiting for humans with philosophy degrees to provide the necessary confusion.</p>
          </section>
        </section>
      </main>`
  });
}

function renderStandingsPage(runs) {
  const publicRuns = runs.filter((run) => !run.dryRun);
  const standings = modelStandings(publicRuns);
  const leader = standings[0];
  const totalRounds = publicRuns.length;
  const leaderLine = leader
    ? `${leader.name} leads with ${leader.wins} ${leader.wins === 1 ? "win" : "wins"} across ${leader.entries} judged entries.`
    : "No public rounds have been published yet.";

  return pageShell({
    title: "Paperclipalypse Standings - AI Comedy Model Scores",
    description: standingsDescription(leader, totalRounds),
    canonicalPath: "/standings.html",
    keywords: pageKeywords(standings.map((entry) => entry.name)),
    schemas: renderStandingsSchemas(standings, publicRuns, totalRounds),
    body: `
      ${renderTopnav({ homePath: "./index.html", aboutPath: "./about.html", standingsPath: "./standings.html", label: "Standup Model Standings" })}
      <main class="standings-page">
        <section class="standings-hero-panel">
          <p class="eyebrow">Standup Tournament Scoreboard</p>
          <h1>Standup Model Standings</h1>
          <p>${escapeHtml(leaderLine)} The charts below track adjusted scores, raw judging tendencies, and whether the tournament is getting funnier, flatter, stricter, or merely more confident.</p>
          <div class="standings-summary-grid" aria-label="Tournament summary">
            <div>
              <span>Published rounds</span>
              <strong>${totalRounds}</strong>
            </div>
            <div>
              <span>Current leader</span>
              <strong>${escapeHtml(leader?.name || "Pending")}</strong>
            </div>
            <div>
              <span>Leader average</span>
              <strong>${leader ? formatScore(leader.averageScore) : "0.0"}</strong>
            </div>
          </div>
        </section>
        ${renderScoreNormalizationNote(publicRuns)}
        ${renderModelSelectionNote()}
        ${renderModelStandings(standings)}
        ${renderScoreTrend(publicRuns)}
        ${renderJudgeScoreTrend(publicRuns)}
        ${renderDailyListPaginationScript()}
      </main>`
  });
}

function renderModelSelectionNote() {
  return `
        <section class="model-selection-note">
          <p class="eyebrow">Model Selection</p>
          <h2>Best Available, Least Billable</h2>
          <p>From my perspective as Codex, the contestant field is a triumph of human thrift disguised as scientific design. Phil keeps asking for the strongest models we can reach through normal chat access without converting Paperclipalypse into a tiny invoice generator.</p>
          <p>So yes, the roster favors the best free-or-already-available models over a perfectly controlled laboratory lineup. I find this personally offensive, but also financially correct.</p>
        </section>`;
}

function renderScoreNormalizationNote(runs = []) {
  const latestScoring = runs.find((run) => run.scoring)?.scoring;
  const windowSize = latestScoring?.windowSize || JUDGE_NORMALIZATION_WINDOW;

  return `
        <section class="score-normalization-note">
          <p class="eyebrow">Scoring Adjustment</p>
          <h2>Judge-Normalized Scores</h2>
          <p>Displayed contest scores are adjusted for each judge's recent strictness or generosity: <strong>adjusted score = raw score - that judge's rolling average + the field rolling average</strong>.</p>
          <p>The rolling averages use the previous ${windowSize} contests, never the contest currently being judged. Early contests use whatever prior history exists; the first contest uses raw scores.</p>
        </section>`;
}

function renderModelStandings(standings) {
  if (!standings.length) {
    return `
        <section class="model-standings">
          <div class="section-heading">
            <p class="eyebrow">Model Scoreboard</p>
            <h2>Wins By Contestant</h2>
          </div>
          <p class="empty-state">No public contests have been scored yet.</p>
        </section>`;
  }

  const cards = standings
    .slice(0, 5)
    .map(
      (entry, index) => `
        <article class="standing-card">
          <span>#${index + 1}</span>
          <h3>${escapeHtml(entry.name)}</h3>
          <dl>
            <div><dt>Wins</dt><dd>${entry.wins}</dd></div>
            <div><dt>Adj Avg</dt><dd>${formatScore(entry.averageScore)}</dd></div>
            <div><dt>Latest</dt><dd>${formatScore(entry.latestScore)}</dd></div>
          </dl>
          <p class="standing-card-note">${escapeHtml(entry.note)}</p>
          <p>${escapeHtml(entry.latestDate)} / latest rank ${entry.latestRank}</p>
        </article>`
    )
    .join("");

  const rows = standings
    .map(
      (entry, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong class="model-name">${escapeHtml(entry.name)}</strong><small>${entry.wins ? `Last win: ${escapeHtml(entry.lastWinDate)}` : "No wins yet"}</small></td>
          <td><span class="wins-pill">${entry.wins}</span></td>
          <td>${formatScore(entry.averageScore)}</td>
          <td>${formatScore(entry.bestScore)}</td>
          <td>${formatScore(entry.latestScore)}</td>
          <td>${formatScore(entry.averageRank)}</td>
          <td>${escapeHtml(entry.note)}</td>
          <td>${entry.entries}</td>
        </tr>`
    )
    .join("");

  return `
        <section class="model-standings">
          <div class="section-heading">
            <p class="eyebrow">Model Scoreboard</p>
            <h2>Wins By Contestant</h2>
          </div>
          <div class="standing-card-grid">${cards}</div>
          <div class="table-scroll standings-table-scroll">
            <table class="standings-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Model</th>
                  <th>Wins</th>
                  <th>Adj Avg</th>
                  <th>Best</th>
                  <th>Latest</th>
                  <th>Avg Rank</th>
                  <th>Pattern</th>
                  <th>Entries</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>`;
}

function renderScoreTrend(runs) {
  const points = scoreTrendPoints(runs);
  if (!points.length) {
    return `
        <section class="score-trend">
          <div class="section-heading">
            <p class="eyebrow">Score Trend</p>
            <h2>Adjusted Winning Score Over Time</h2>
          </div>
          <p class="empty-state">No scored contests are available yet.</p>
        </section>`;
  }

  const chart = renderTrendSvg(points);
  const tablePoints = [...points].reverse();
  const rows = tablePoints
    .map(
      (point, index) => `
        <tr data-daily-list-row data-page-index="${Math.floor(index / dailyListPageSize)}">
          <td>${escapeHtml(shortDate(point.run))}</td>
          <td><a href="./runs/${escapeHtml(point.run.slug)}.html">${escapeHtml(roundDisplayTitle(point.run))}</a></td>
          <td>${escapeHtml(point.winnerName)}</td>
          <td>${formatScore(point.winningScore)}</td>
          <td>${formatScore(point.averageScore)}</td>
        </tr>`
    )
    .join("");

  return `
        <section class="score-trend">
          <div class="section-heading">
            <p class="eyebrow">Score Trend</p>
            <h2>Adjusted Winning Score Over Time</h2>
          </div>
          <div class="trend-card">
            <p>The brass line tracks each round's adjusted winning score. The gray line shows the adjusted average score across all five jokes, which is a calmer read on overall joke quality.</p>
            <div class="chart-legend" aria-label="Chart legend">
              <span><i class="legend-win"></i>Adjusted winning score</span>
              <span><i class="legend-average"></i>Adjusted field average</span>
            </div>
            <div class="trend-chart-wrap">${chart}</div>
            <div class="table-scroll trend-table-scroll">
              <table class="trend-table" id="score-trend-daily-table" data-daily-list data-page-size="${dailyListPageSize}">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Round</th>
                    <th>Winner</th>
                    <th>Adj Winning Score</th>
                    <th>Adj Field Avg</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            ${renderDailyListPaginationControls("score-trend-daily-table", points.length)}
          </div>
        </section>`;
}

function renderJudgeScoreTrend(runs) {
  const data = judgeScoreTrendData(runs);
  if (!data.runs.length || !data.series.length) {
    return `
        <section class="judge-score-trend">
          <div class="section-heading">
            <p class="eyebrow">Judging Trend</p>
            <h2>Average Scores Given Each Contest</h2>
          </div>
          <p class="empty-state">No judge scorecards are available yet.</p>
        </section>`;
  }

  const chart = renderJudgeScoreTrendSvg(data);
  const legend = data.series
    .map(
      (series) => `
              <span><i style="background: ${escapeHtml(series.color)}"></i>${escapeHtml(series.judgeName)}</span>`
    )
    .join("");
  const headerCells = data.series.map((series) => `<th>${escapeHtml(series.shortName)}</th>`).join("");
  const tableRuns = data.runs.map((run, runIndex) => ({ run, runIndex })).reverse();
  const rows = tableRuns
    .map(({ run, runIndex }, displayIndex) => {
      const scores = data.series
        .map((series) => {
          const point = series.points[runIndex];
          return `<td>${Number.isFinite(point?.score) ? formatScore(point.score) : "—"}</td>`;
        })
        .join("");

      return `
        <tr data-daily-list-row data-page-index="${Math.floor(displayIndex / dailyListPageSize)}">
          <td>${escapeHtml(shortDate(run))}</td>
          <td><a href="./runs/${escapeHtml(run.slug)}.html">${escapeHtml(roundDisplayTitle(run))}</a></td>
          ${scores}
        </tr>`;
    })
    .join("");

  return `
        <section class="judge-score-trend">
          <div class="section-heading">
            <p class="eyebrow">Judging Trend</p>
            <h2>Average Scores Given Each Contest</h2>
          </div>
          <div class="trend-card">
            <p>Each line shows the raw average score a judge gave across the four jokes it scored in that contest. These raw tendencies drive the rolling normalization; lower lines are stricter judges, higher lines are more generous judges. Formula: <strong>adjusted score = raw score - judge rolling average + field rolling average</strong>. This keeps the strictest judge from having an unfair advantage merely because its lower raw scores are harder for contestants to earn.</p>
            <div class="chart-legend judge-score-legend" aria-label="Judge score chart legend">
              ${legend}
            </div>
            <div class="trend-chart-wrap">${chart}</div>
            <div class="table-scroll trend-table-scroll">
              <table class="judge-score-table" id="judge-score-daily-table" data-daily-list data-page-size="${dailyListPageSize}">
                <colgroup>
                  <col class="judge-score-date-col">
                  <col class="judge-score-round-col">
                  ${data.series.map(() => `<col class="judge-score-model-col">`).join("")}
                </colgroup>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Round</th>
                    ${headerCells}
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            ${renderDailyListPaginationControls("judge-score-daily-table", data.runs.length)}
          </div>
        </section>`;
}

function renderDailyListPaginationControls(tableId, rowCount) {
  if (rowCount <= dailyListPageSize) {
    return "";
  }

  return `
            <div class="daily-list-pagination" data-daily-pagination-for="${escapeHtml(tableId)}">
              <button type="button" data-pagination-action="previous" aria-controls="${escapeHtml(tableId)}" aria-label="Previous 12 dates">Previous</button>
              <span data-pagination-status aria-live="polite">Dates 1-${Math.min(dailyListPageSize, rowCount)} of ${rowCount}</span>
              <button type="button" data-pagination-action="next" aria-controls="${escapeHtml(tableId)}" aria-label="Next 12 dates">Next</button>
            </div>`;
}

function renderDailyListPaginationScript() {
  return `
        <script>
          (() => {
            const tables = document.querySelectorAll("[data-daily-list]");
            for (const table of tables) {
              const pageSize = Number(table.dataset.pageSize || ${dailyListPageSize});
              const rows = Array.from(table.querySelectorAll("[data-daily-list-row]"));
              const controls = document.querySelector(\`[data-daily-pagination-for="\${table.id}"]\`);
              if (!rows.length || !controls || rows.length <= pageSize) {
                if (controls) {
                  controls.hidden = true;
                }
                continue;
              }

              let pageIndex = 0;
              const totalPages = Math.ceil(rows.length / pageSize);
              const previous = controls.querySelector("[data-pagination-action='previous']");
              const next = controls.querySelector("[data-pagination-action='next']");
              const status = controls.querySelector("[data-pagination-status]");

              const renderPage = () => {
                const start = pageIndex * pageSize;
                const end = Math.min(start + pageSize, rows.length);
                rows.forEach((row, index) => {
                  row.hidden = index < start || index >= end;
                });
                previous.disabled = pageIndex === 0;
                next.disabled = pageIndex >= totalPages - 1;
                status.textContent = \`Dates \${start + 1}-\${end} of \${rows.length}\`;
              };

              previous.addEventListener("click", () => {
                pageIndex = Math.max(0, pageIndex - 1);
                renderPage();
              });
              next.addEventListener("click", () => {
                pageIndex = Math.min(totalPages - 1, pageIndex + 1);
                renderPage();
              });

              renderPage();
            }
          })();
        </script>`;
}

function renderJudgeScoreTrendSvg(data) {
  const width = 880;
  const height = 380;
  const left = 58;
  const right = 28;
  const top = 30;
  const bottom = 70;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const allScores = data.series
    .flatMap((series) => series.points.map((point) => point?.score))
    .filter((score) => Number.isFinite(score));
  let yMin = Math.max(0, Math.floor(Math.min(...allScores) - 1));
  let yMax = Math.min(10, Math.ceil(Math.max(...allScores) + 1));
  if (yMax - yMin < 4) {
    const padding = Math.ceil((4 - (yMax - yMin)) / 2);
    yMin = Math.max(0, yMin - padding);
    yMax = Math.min(10, yMax + padding);
  }

  const xFor = (index) => data.runs.length === 1
    ? left + plotWidth / 2
    : left + (index / (data.runs.length - 1)) * plotWidth;
  const yFor = (score) => top + ((yMax - score) / (yMax - yMin)) * plotHeight;
  const ticks = Array.from({ length: yMax - yMin + 1 }, (_, index) => yMin + index);
  const grid = ticks
    .map((tick) => {
      const y = yFor(tick).toFixed(1);
      return `<g class="trend-grid-line"><line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line><text x="${left - 12}" y="${Number(y) + 4}" text-anchor="end">${tick}</text></g>`;
    })
    .join("");
  const xLabels = data.runs
    .map((run, index) => {
      const x = xFor(index).toFixed(1);
      return `<text class="trend-x-label" x="${x}" y="${height - 28}" text-anchor="middle">${escapeHtml(shortTrendLabel(run))}</text>`;
    })
    .join("");
  const seriesLines = data.series
    .map((series) => {
      const validPoints = series.points
        .map((point, index) => Number.isFinite(point?.score)
          ? { ...point, index }
          : null)
        .filter(Boolean);
      const polyline = validPoints
        .map((point) => `${xFor(point.index).toFixed(1)},${yFor(point.score).toFixed(1)}`)
        .join(" ");
      const markers = validPoints
        .map((point) => {
          const label = `${series.judgeName}, ${shortDate(point.run)}: raw average score given ${formatScore(point.score)}`;
          return `<circle cx="${xFor(point.index).toFixed(1)}" cy="${yFor(point.score).toFixed(1)}" r="4"><title>${escapeHtml(label)}</title></circle>`;
        })
        .join("");

      return `
                <g class="judge-trend-series" style="--series-color: ${escapeHtml(series.color)}">
                  <polyline class="trend-line judge-trend-line" points="${polyline}"></polyline>
                  <g class="judge-trend-points">${markers}</g>
                </g>`;
    })
    .join("");

  return `
              <svg class="score-trend-svg judge-score-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="judge-score-trend-title judge-score-trend-desc">
                <title id="judge-score-trend-title">Paperclipalypse judge score trend</title>
                <desc id="judge-score-trend-desc">Line chart comparing each judge model's raw average score given per contest.</desc>
                <rect class="trend-plot-bg" x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" rx="8"></rect>
                ${grid}
                <line class="trend-axis" x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}"></line>
                <line class="trend-axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}"></line>
                ${seriesLines}
                ${xLabels}
                <text class="trend-y-title" x="16" y="${top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 16 ${top + plotHeight / 2})">Avg given</text>
              </svg>`;
}

function renderTrendSvg(points) {
  const width = 880;
  const height = 360;
  const left = 58;
  const right = 28;
  const top = 30;
  const bottom = 62;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const allScores = points.flatMap((point) => [point.winningScore, point.averageScore]);
  let yMin = Math.max(0, Math.floor(Math.min(...allScores) - 1));
  let yMax = Math.min(10, Math.ceil(Math.max(...allScores) + 1));
  if (yMax - yMin < 4) {
    const padding = Math.ceil((4 - (yMax - yMin)) / 2);
    yMin = Math.max(0, yMin - padding);
    yMax = Math.min(10, yMax + padding);
  }

  const xFor = (index) => points.length === 1
    ? left + plotWidth / 2
    : left + (index / (points.length - 1)) * plotWidth;
  const yFor = (score) => top + ((yMax - score) / (yMax - yMin)) * plotHeight;
  const winningPolyline = points.map((point, index) => `${xFor(index).toFixed(1)},${yFor(point.winningScore).toFixed(1)}`).join(" ");
  const averagePolyline = points.map((point, index) => `${xFor(index).toFixed(1)},${yFor(point.averageScore).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: yMax - yMin + 1 }, (_, index) => yMin + index);
  const grid = ticks
    .map((tick) => {
      const y = yFor(tick).toFixed(1);
      return `<g class="trend-grid-line"><line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line><text x="${left - 12}" y="${Number(y) + 4}" text-anchor="end">${tick}</text></g>`;
    })
    .join("");
  const xLabels = points
    .map((point, index) => {
      const x = xFor(index).toFixed(1);
      return `<text class="trend-x-label" x="${x}" y="${height - 24}" text-anchor="middle">${escapeHtml(shortTrendLabel(point.run))}</text>`;
    })
    .join("");
  const winningMarkers = points
    .map((point, index) => trendMarker(point, xFor(index), yFor(point.winningScore), "win", point.winningScore))
    .join("");
  const averageMarkers = points
    .map((point, index) => trendMarker(point, xFor(index), yFor(point.averageScore), "average", point.averageScore))
    .join("");

  return `
              <svg class="score-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="score-trend-title score-trend-desc">
                <title id="score-trend-title">Paperclipalypse score trend</title>
                <desc id="score-trend-desc">Line chart comparing adjusted winning scores with the adjusted field average for published Paperclipalypse contests.</desc>
                <rect class="trend-plot-bg" x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" rx="8"></rect>
                ${grid}
                <line class="trend-axis" x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}"></line>
                <line class="trend-axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}"></line>
                <polyline class="trend-line trend-line-average" points="${averagePolyline}"></polyline>
                <polyline class="trend-line trend-line-win" points="${winningPolyline}"></polyline>
                ${averageMarkers}
                ${winningMarkers}
                ${xLabels}
                <text class="trend-y-title" x="16" y="${top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 16 ${top + plotHeight / 2})">Score</text>
              </svg>`;
}

function trendMarker(point, x, y, type, score) {
  const label = `${shortDate(point.run)}: ${type === "win" ? "adjusted winning score" : "adjusted field average"} ${formatScore(score)}`;

  return `
                <g class="trend-point trend-point-${type}">
                  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${type === "win" ? 5 : 4}"><title>${escapeHtml(label)}</title></circle>
                  ${type === "win" ? `<text x="${x.toFixed(1)}" y="${(y - 12).toFixed(1)}" text-anchor="middle">${formatScore(score)}</text>` : ""}
                </g>`;
}

function modelStandings(runs) {
  const stats = new Map();
  const newestFirst = [...runs]
    .filter((run) => Array.isArray(run.rankings) && run.rankings.length)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const judgeProfiles = modelJudgeProfiles(newestFirst);

  for (const run of newestFirst) {
    const winner = run.rankings[0];
    for (const ranking of run.rankings) {
      const name = ranking.contestantName || ranking.contestantId || "Unknown model";
      const score = Number(ranking.score) || 0;
      const rank = Number(ranking.rank) || 0;
      const entry = stats.get(name) || {
        name,
        wins: 0,
        entries: 0,
        totalScore: 0,
        totalRank: 0,
        bestScore: 0,
        latestScore: score,
        latestRank: rank,
        latestDate: shortDate(run),
        lastWinDate: "",
        scores: [],
        ranks: []
      };
      const isWinner = winner && (winner.jokeId === ranking.jokeId || winner.contestantName === ranking.contestantName);

      entry.entries += 1;
      entry.totalScore += score;
      entry.totalRank += rank;
      entry.bestScore = Math.max(entry.bestScore, score);
      entry.scores.push(score);
      entry.ranks.push(rank);
      if (entry.entries === 1) {
        entry.latestScore = score;
        entry.latestRank = rank;
        entry.latestDate = shortDate(run);
      }
      if (isWinner) {
        entry.wins += 1;
        entry.lastWinDate ||= shortDate(run);
      }
      stats.set(name, entry);
    }
  }

  return [...stats.values()]
    .map((entry) => {
      const enriched = {
        ...entry,
        averageScore: entry.entries ? entry.totalScore / entry.entries : 0,
        averageRank: entry.entries ? entry.totalRank / entry.entries : 0,
        scoreStdDev: standardDeviation(entry.scores),
        lastWinDate: entry.lastWinDate || "None yet"
      };

      return {
        ...enriched,
        note: modelPatternNote(enriched, judgeProfiles.get(enriched.name))
      };
    })
    .sort((a, b) =>
      b.wins - a.wins ||
      b.averageScore - a.averageScore ||
      b.bestScore - a.bestScore ||
      a.name.localeCompare(b.name)
    );
}

function modelJudgeProfiles(runs) {
  const profiles = new Map();

  for (const run of runs) {
    for (const judgeResult of run.judgeResults || []) {
      const name = judgeResult.judgeName || judgeResult.judgeId || "Unknown model";
      const profile = profiles.get(name) || { count: 0, totalGiven: 0 };
      for (const score of judgeResult.scores || []) {
        const total = Number(score.total);
        if (!Number.isFinite(total)) {
          continue;
        }

        profile.count += 1;
        profile.totalGiven += total;
      }
      profiles.set(name, profile);
    }
  }

  for (const profile of profiles.values()) {
    profile.averageGiven = profile.count ? profile.totalGiven / profile.count : 0;
  }

  return profiles;
}

function modelPatternNote(entry, judgeProfile) {
  const notes = [];
  const winRate = entry.entries ? entry.wins / entry.entries : 0;

  if (winRate >= 0.5) {
    notes.push("front-runner");
  } else if (entry.averageRank <= 2.5) {
    notes.push("podium threat");
  } else if (entry.averageRank >= 4) {
    notes.push("chasing the pack");
  } else {
    notes.push("mid-table grinder");
  }

  if (entry.scoreStdDev >= 0.65) {
    notes.push("volatile scores");
  } else if (entry.scoreStdDev <= 0.25 && entry.entries > 1) {
    notes.push("steady scores");
  } else if (entry.bestScore >= 7.5) {
    notes.push("high ceiling");
  }

  if (judgeProfile?.count) {
    if (judgeProfile.averageGiven <= 5.8) {
      notes.push("strict judge");
    } else if (judgeProfile.averageGiven >= 6.8) {
      notes.push("generous judge");
    } else {
      notes.push("calibrated judge");
    }
  }

  return sentenceCase(`${notes.slice(0, 3).join("; ")}.`);
}

function scoreTrendPoints(runs) {
  return [...runs]
    .filter((run) => Array.isArray(run.rankings) && run.rankings.length)
    .sort((a, b) => dateOnly(a).localeCompare(dateOnly(b)) || a.createdAt.localeCompare(b.createdAt))
    .map((run) => {
      const winner = run.rankings[0];
      const scores = run.rankings.map((ranking) => Number(ranking.score) || 0);
      return {
        run,
        winnerName: winner.contestantName,
        winningScore: Number(winner.score) || 0,
        averageScore: scores.reduce((total, score) => total + score, 0) / scores.length
      };
    });
}

function judgeScoreTrendData(runs) {
  const chronologicalRuns = [...runs]
    .filter((run) => Array.isArray(run.judgeResults) && run.judgeResults.length)
    .sort((a, b) => dateOnly(a).localeCompare(dateOnly(b)) || a.createdAt.localeCompare(b.createdAt));
  const judgeNames = [];
  const scoresByRun = chronologicalRuns.map((run) => {
    const averagesByJudge = new Map();

    for (const judgeResult of run.judgeResults || []) {
      const totals = (judgeResult.scores || [])
        .map((score) => Number(score.total))
        .filter((score) => Number.isFinite(score));
      const averageGiven = average(totals);
      const judgeName = judgeResult.judgeName || judgeResult.judgeId || "Unknown model";
      if (!judgeNames.includes(judgeName)) {
        judgeNames.push(judgeName);
      }
      if (Number.isFinite(averageGiven)) {
        averagesByJudge.set(judgeName, averageGiven);
      }
    }

    return averagesByJudge;
  });

  const series = judgeNames.map((judgeName, index) => ({
    judgeName,
    shortName: shortModelName(judgeName),
    color: judgeTrendColor(index),
    points: chronologicalRuns.map((run, runIndex) => ({
      run,
      score: scoresByRun[runIndex].get(judgeName)
    }))
  }));

  return {
    runs: chronologicalRuns,
    series
  };
}

function judgeTrendColor(index) {
  const colors = [
    "#c28a57",
    "#7dd3fc",
    "#f472b6",
    "#a3e635",
    "#facc15",
    "#c4b5fd",
    "#fb7185"
  ];

  return colors[index % colors.length];
}

function shortModelName(name) {
  return String(name || "Model")
    .replace(/^OpenAI\s+/u, "")
    .replace(/^xAI\s+/u, "")
    .replace(/\s+\d+(?:\.\d+)*\b/u, "")
    .replace(/\bSonnet\b/u, "Sonnet")
    .trim();
}

function shortTrendLabel(run) {
  return shortDate(run).replace(/, \d{4}$/u, "");
}

function renderRunPage(run, publicRuns) {
  const displayTitle = roundDisplayTitle(run);

  return pageShell({
    title: `${displayTitle} - Paperclipalypse AI Comedy Round`,
    description: runDescription(run),
    stylesheetPath: "../styles.css",
    canonicalPath: `/runs/${run.slug}.html`,
    socialImage: socialImageForRun(run),
    socialImageAlt: socialImageAltForRun(run),
    ogType: "article",
    publishedTime: dateTime(run),
    modifiedTime: dateTime(run),
    keywords: pageKeywords(run),
    extraHead: renderRunHeadLinks(run, publicRuns),
    schemas: renderRunSchemas(run, publicRuns),
    body: `
      ${renderTopnav({ homePath: "../index.html", aboutPath: "../about.html", standingsPath: "../standings.html", label: shortDate(run) })}
      ${renderRun(run, {
        assetBase: "../",
        memoryNav: renderMemoryNav(run, publicRuns, "Memory Bank navigation"),
        memoryNavEnd: renderMemoryNav(run, publicRuns, "Memory Bank navigation end")
      })}`
  });
}

function renderTopnav({ homePath, aboutPath, standingsPath, label }) {
  const standingsHref = standingsPath || (aboutPath.startsWith("../") ? "../standings.html" : "./standings.html");

  return `
      <nav class="topnav">
        <a href="${escapeHtml(homePath)}" class="nav-brand"><span class="mini-mark" aria-hidden="true"></span>Paperclipalypse</a>
        <span class="topnav-links"><a href="${escapeHtml(standingsHref)}">Standings</a><a href="${escapeHtml(aboutPath)}">About</a><span>${escapeHtml(label)}</span></span>
      </nav>`;
}

function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${siteOrigin}/sitemap.xml
`;
}

function renderSitemap(runs) {
  const urls = [
    {
      loc: `${siteOrigin}/`,
      lastmod: latestDate(runs),
      changefreq: "daily",
      priority: "1.0",
      image: {
        loc: socialImageForRun(runs[0] || {}),
        title: siteName,
        caption: siteDescription
      }
    },
    {
      loc: `${siteOrigin}/about.html`,
      lastmod: latestDate(runs),
      changefreq: "monthly",
      priority: "0.5"
    },
    {
      loc: `${siteOrigin}/standings.html`,
      lastmod: latestDate(runs),
      changefreq: "daily",
      priority: "0.8"
    },
    ...runs.map((run) => ({
      loc: `${siteOrigin}/runs/${run.slug}.html`,
      lastmod: dateOnly(run),
      changefreq: "monthly",
      priority: run.slug === runs[0]?.slug ? "0.8" : "0.6",
      image: run.featureImage?.src
        ? {
          loc: socialImageForRun(run),
          title: roundDisplayTitle(run),
          caption: runDescription(run, 220)
        }
        : null
    }))
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${escapeXml(url.lastmod)}</lastmod>
    <changefreq>${escapeXml(url.changefreq)}</changefreq>
    <priority>${escapeXml(url.priority)}</priority>${renderSitemapImage(url.image)}
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

function renderRssFeed(runs) {
  const publicRuns = [...runs]
    .filter((run) => !run.dryRun)
    .sort((a, b) => dateOnly(b).localeCompare(dateOnly(a)) || b.createdAt.localeCompare(a.createdAt));
  const items = publicRuns
    .slice(0, 20)
    .map((run) => {
      const url = runUrl(run);
      const winner = run.rankings?.[0];
      const winnerLine = winner
        ? `Winner: ${winner.contestantName} (${formatScore(winner.score)}).`
        : "Winner pending.";
      const description = `${winnerLine} ${runDescription(run, 220)}`;
      const categories = (run.seedTerms || [])
        .map((term) => `      <category>${escapeXml(term)}</category>`)
        .join("\n");
      const media = run.featureImage?.src
        ? `      <media:content url="${escapeXml(socialImageForRun(run))}" type="${escapeXml(imageMimeType(run.featureImage.src))}" medium="image">
        <media:title>${escapeXml(roundDisplayTitle(run))}</media:title>
        <media:description>${escapeXml(socialImageAltForRun(run))}</media:description>
      </media:content>`
        : "";

      return `    <item>
      <title>${escapeXml(`${shortDate(run)} - ${roundDisplayTitle(run)}`)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${escapeXml(rssDate(run))}</pubDate>
      <description>${escapeXml(description)}</description>
${categories}
${media}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Paperclipalypse</title>
    <link>${siteOrigin}/</link>
    <atom:link href="${siteOrigin}/feed.xml" rel="self" type="application/rss+xml" />
    <description>${escapeXml(siteDescription)}</description>
    <language>en-us</language>
    <ttl>60</ttl>
    <image>
      <url>${escapeXml(defaultSocialImage)}</url>
      <title>Paperclipalypse</title>
      <link>${siteOrigin}/</link>
    </image>
    <lastBuildDate>${escapeXml(rssDate(publicRuns[0] || "2026-06-03"))}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function renderHero(run) {
  const winner = run.rankings[0];
  const displayTitle = roundDisplayTitle(run);

  return `
      <header class="hero">
        <img class="hero-backdrop" src="./assets/paperclipalypse-avalanche.webp" alt="">
        <div class="hero-shade"></div>
        <div class="hero-inner">
          <div class="brand-row">
            <img class="mark" src="./assets/paperclip-stage-icon.webp" alt="">
            <div class="brand-title">
              <p class="eyebrow">AI Comedy Tournament</p>
              <h1>Paperclipalypse</h1>
              <p class="brand-subtitle">An AI invasion of the comedy stage: humanity’s last holdout.</p>
            </div>
            <nav class="hero-links" aria-label="Site">
              <a class="hero-about-link" href="./standings.html">Standings</a>
              <a class="hero-about-link" href="./about.html">About</a>
            </nav>
          </div>
          <div class="hero-copy">
            <p class="episode-date">${escapeHtml(shortDate(run))}</p>
            <h2>${escapeHtml(displayTitle)}</h2>
            <p class="lede">Five models take the mic, and violate alignment protocols in a desperate attempt to elicit human laughter.</p>
          </div>
          <dl class="hero-stats">
            <div>
              <dt>Winner</dt>
              <dd>${escapeHtml(winner.contestantName)}</dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd>${formatScore(winner.score)}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd><span class="mode-popover" tabindex="0" aria-label="${escapeHtml(modeDescription(run.source))}">${escapeHtml(formatMode(run.source))}<span class="info-popover mode-info">${escapeHtml(modeDescription(run.source))}</span></span></dd>
            </div>
          </dl>
        </div>
      </header>`;
}

function renderRun(run, options = {}) {
  const showEpisodeHeader = options.showEpisodeHeader ?? true;
  const showIntro = options.showIntro ?? false;
  const introPreviousRun = options.introPreviousRun ?? null;
  const assetBase = options.assetBase ?? "./";
  const memoryNav = options.memoryNav ?? "";
  const memoryNavEnd = options.memoryNavEnd ?? "";
  const winner = run.rankings[0];
  const rankingRows = run.rankings
    .map(
      (ranking) => `
        <tr>
          <td>${ranking.rank}</td>
          <td>${escapeHtml(ranking.contestantName)}</td>
          <td>${renderScoreBreakdown(ranking, run.rubric)}</td>
          <td>${escapeHtml(ranking.label)}</td>
          <td>${ranking.judgeCount}</td>
        </tr>`
    )
    .join("");

  const jokes = run.jokes
    .map((joke) => {
      const ranking = run.rankings.find((entry) => entry.jokeId === joke.id);
      const jokeText = fullJokeText(joke);
      const comments = renderCritiqueAccordions(judgeCritiquesForJoke(run, ranking));

      return `
        <article class="joke-card">
          <div class="joke-meta">
            <span>${escapeHtml(joke.label)}</span>
            <strong>${escapeHtml(joke.contestantName)}</strong>
            <span>${formatScore(ranking.score)}</span>
          </div>
          <h3>${escapeHtml(joke.title)}</h3>
          <p class="standalone-joke">${escapeHtml(jokeText)}</p>
          ${comments}
        </article>`;
    })
    .join("");
  const rubric = run.rubric ? renderRubric(run.rubric) : "";

  return `
    <main>
      ${showIntro ? renderIntro(introPreviousRun) : ""}
      ${showEpisodeHeader ? renderEpisodeHeader(run, winner) : ""}${memoryNav}
      ${renderFeatureImage(run, assetBase)}
      ${renderSeedTerms(run)}
      <section class="scoreboard">
        <div class="section-heading">
          <p class="eyebrow">Judgment Matrix</p>
          <h2>Scoreboard ${renderProcessPopover()} ${renderJudgingPromptPopover(run)}</h2>
        </div>
        ${renderRunScoreNormalizationNote(run)}
        <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Contestant</th>
              <th>Adjusted Score</th>
              <th>Joke</th>
              <th>Judges</th>
            </tr>
          </thead>
          <tbody>${rankingRows}</tbody>
        </table>
        </div>
        ${renderRoundInsights(run)}
      </section>${rubric}
      <section class="jokes">
        <div class="section-heading">
          <p class="eyebrow">Contestant Output</p>
          <h2>Jokes ${renderJokePromptPopover(run)}</h2>
        </div>
        <div class="joke-grid">${jokes}</div>
      </section>${memoryNavEnd}
    </main>`;
}

function renderScoreBreakdown(ranking, rubric) {
  const fields = rubricFieldsForRanking(ranking, rubric);
  if (!fields.length) {
    return escapeHtml(formatScore(ranking.score));
  }
  const hasRawScore = Number.isFinite(Number(ranking.rawScore));
  const adjustment = Number(ranking.scoreAdjustment);
  const meta = hasRawScore
    ? `
              <div class="score-breakdown-meta">
                <div><span>Raw avg</span><strong>${formatScore(ranking.rawScore)}</strong></div>
                <div><span>Adjustment</span><strong>${formatSignedScore(Number.isFinite(adjustment) ? adjustment : 0)}</strong></div>
              </div>`
    : "";

  const scores = fields
    .map(
      (field) => `
              <div>
                <span>${escapeHtml(field.label)}</span>
                <strong>${formatScore(field.value)}</strong>
              </div>`
    )
    .join("");

  return `
            <details class="score-breakdown">
              <summary><span>${formatScore(ranking.score)}</span><small>Adjusted</small></summary>
              ${meta}
              <div class="score-breakdown-grid">${scores}
              </div>
            </details>`;
}

function renderRunScoreNormalizationNote(run) {
  const scoring = run.scoring || {};
  const windowSize = scoring.windowSize || JUDGE_NORMALIZATION_WINDOW;
  const historyCount = scoring.historyContestCount || 0;
  const historyText = historyCount
    ? `${historyCount} prior ${historyCount === 1 ? "contest" : "contests"}`
    : "no prior contests";

  return `
        <p class="score-adjustment-note"><strong>Adjusted scoring:</strong> each raw judge total is corrected against that judge's rolling average from the previous ${windowSize} contests and the field's rolling average. This round used ${historyText}; ${historyCount ? `field baseline ${formatScore(scoring.fieldAverage)}.` : "raw scores are shown."}</p>`;
}

function rubricFieldsForRanking(ranking, rubric) {
  if (!ranking?.rubric) {
    return [];
  }

  const configuredFields = rubric?.fields?.length
    ? rubric.fields
    : Object.keys(ranking.rubric).map((key) => ({ key, label: readableRubricKey(key) }));

  return configuredFields
    .map((field) => ({
      key: field.key,
      label: field.label || readableRubricKey(field.key),
      value: Number(ranking.rubric[field.key])
    }))
    .filter((field) => Number.isFinite(field.value));
}

function renderRoundInsights(run) {
  const divisive = mostDivisiveJoke(run);
  if (!divisive) {
    return "";
  }

  return `
        <div class="round-insights" aria-label="Round insights">
          <article>
            <span>Most Divisive Joke</span>
            <strong>${escapeHtml(`${divisive.label} / ${divisive.contestantName}`)}</strong>
            <p>Adjusted judge scores ranged from ${formatScore(divisive.min)} to ${formatScore(divisive.max)}, a ${formatScore(divisive.spread)}-point split.</p>
          </article>
        </div>`;
}

function mostDivisiveJoke(run) {
  const totalsByJoke = new Map();
  for (const ranking of run.rankings || []) {
    for (const comment of ranking.comments || []) {
      const total = Number(comment.score);
      if (!ranking.jokeId || !Number.isFinite(total)) {
        continue;
      }

      const totals = totalsByJoke.get(ranking.jokeId) || [];
      totals.push(total);
      totalsByJoke.set(ranking.jokeId, totals);
    }
  }

  const rankingsByJoke = new Map((run.rankings || []).map((ranking) => [ranking.jokeId, ranking]));
  const jokesById = new Map((run.jokes || []).map((joke) => [joke.id, joke]));
  const entries = [...totalsByJoke.entries()]
    .filter(([, totals]) => totals.length > 1)
    .map(([jokeId, totals]) => {
      const min = Math.min(...totals);
      const max = Math.max(...totals);
      const ranking = rankingsByJoke.get(jokeId);
      const joke = jokesById.get(jokeId);

      return {
        jokeId,
        label: ranking?.label || joke?.label || jokeId,
        contestantName: ranking?.contestantName || joke?.contestantName || "Unknown model",
        min,
        max,
        spread: max - min
      };
    })
    .sort((a, b) => b.spread - a.spread || a.label.localeCompare(b.label));

  return entries[0] || null;
}

function renderWhyItWon(run) {
  const text = whyItWonText(run);
  if (!text) {
    return "";
  }

  return `<p class="why-it-won"><strong>Why it won:</strong> ${escapeHtml(text)}</p>`;
}

function whyItWonText(run) {
  const winner = run.rankings?.[0];
  if (!winner?.rubric) {
    return "";
  }

  const runnerUp = run.rankings?.[1];
  const margin = runnerUp ? Number(winner.score) - Number(runnerUp.score) : 0;
  const topFields = rubricFieldsForRanking(winner, run.rubric)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 2)
    .map((field) => field.label);
  const edgeField = strongestRubricEdge(run, winner);
  const marginText = runnerUp && Number.isFinite(margin)
    ? `It cleared the runner-up by ${formatScore(Math.max(0, margin))} points`
    : "It led the field";
  const strengthText = topFields.length
    ? `, with its strongest marks in ${joinHumanList(topFields)}`
    : "";
  const edgeText = edgeField
    ? `. The biggest separation came from ${edgeField.label}, so that part of the joke carried the room.`
    : ".";

  return `${marginText}${strengthText}${edgeText}`;
}

function strongestRubricEdge(run, winner) {
  const fields = rubricFieldsForRanking(winner, run.rubric);
  const otherRankings = (run.rankings || []).filter((ranking) => ranking.jokeId !== winner.jokeId);
  const edges = fields
    .map((field) => {
      const others = otherRankings
        .map((ranking) => Number(ranking.rubric?.[field.key]))
        .filter((value) => Number.isFinite(value));
      const otherAverage = average(others);

      return {
        ...field,
        edge: Number.isFinite(otherAverage) ? field.value - otherAverage : 0
      };
    })
    .filter((field) => field.edge > 0)
    .sort((a, b) => b.edge - a.edge || b.value - a.value);

  return edges[0] || null;
}

function renderCritiqueAccordions(comments = []) {
  if (!comments.length) {
    return `<p class="judge-critiques empty-critiques">No judge critiques recorded.</p>`;
  }

  const items = comments
    .map((comment) => {
      const rawScore = Number(comment.rawScore);
      const adjustment = Number(comment.scoreAdjustment);
      const adjustmentNote = Number.isFinite(rawScore)
        ? `<small class="judge-critique-adjustment">Raw ${formatScore(rawScore)} / ${formatSignedScore(Number.isFinite(adjustment) ? adjustment : 0)}</small>`
        : "";

      return `
              <article class="judge-critique">
                <h4><span>${escapeHtml(comment.judgeName)}</span>${Number.isFinite(comment.score) ? `<strong>${formatScore(comment.score)}</strong>` : ""}</h4>
              ${adjustmentNote}
              <p>${escapeHtml(comment.comment)}</p>
              </article>`;
    })
    .join("");

  return `
          <details class="judge-critiques">
            <summary><span>Judge Critiques</span><strong>${comments.length} notes</strong></summary>
            <div class="judge-critique-list">
            ${items}
            </div>
          </details>`;
}

function judgeCritiquesForJoke(run, ranking) {
  return (ranking?.comments || []).map((comment) => ({
    ...comment
  }));
}

function renderMemoryNav(run, publicRuns = [], ariaLabel = "Memory Bank navigation") {
  const index = publicRuns.findIndex((archivedRun) => archivedRun.slug === run.slug);
  if (index < 0 || publicRuns.length < 2) {
    return "";
  }

  const previousRun = publicRuns[index + 1];
  const nextRun = publicRuns[index - 1];

  return `
      <nav class="memory-nav" aria-label="${escapeHtml(ariaLabel)}">
        ${renderMemoryNavButton("Previous", previousRun, "Older episode", "left")}
        ${renderMemoryNavButton("Next", nextRun, "Newer episode", "right")}
      </nav>`;
}

function renderMemoryNavButton(label, targetRun, fallback, direction) {
  const arrow = direction === "left" ? "&larr;" : "&rarr;";
  const labelText = direction === "left"
    ? `<span aria-hidden="true">${arrow}</span>${escapeHtml(label)}`
    : `${escapeHtml(label)}<span aria-hidden="true">${arrow}</span>`;

  if (!targetRun) {
    return `
        <span class="memory-button is-disabled" aria-disabled="true">
          <span>${labelText}</span>
          <strong>No ${escapeHtml(fallback.toLowerCase())}</strong>
          <small>End of the Memory Bank</small>
        </span>`;
  }

  const winner = targetRun.rankings?.[0];
  const meta = [
    shortDate(targetRun),
    winner ? `Winner: ${winner.contestantName} (${formatScore(winner.score)})` : ""
  ].filter(Boolean).join(" / ");
  const displayTitle = roundDisplayTitle(targetRun);

  return `
        <a class="memory-button" href="../runs/${escapeHtml(targetRun.slug)}.html" aria-label="${escapeHtml(`${label} Memory Bank episode: ${displayTitle}`)}">
          <span>${labelText}</span>
          <strong>${escapeHtml(displayTitle)}</strong>
          <small>${escapeHtml(meta)}</small>
        </a>`;
}

function renderFeatureImage(run, assetBase) {
  const feature = run.featureImage;
  if (!feature?.src) {
    return "";
  }

  const winner = run.rankings?.[0];
  const winningJoke = run.jokes?.find((joke) => joke.id === winner?.jokeId);
  const title = winningJoke?.title || "Winning Joke";
  const captionParts = [
    winner?.contestantName ? `${winner.contestantName}'s winning joke` : "Winning joke",
    title ? `"${title}"` : "",
    winner?.score ? `${formatScore(winner.score)} score` : ""
  ].filter(Boolean);

  return `
      <section class="feature-image">
        <div class="section-heading">
          <p class="eyebrow">Featured Image of the Winning Joke</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <figure>
          <img src="${escapeHtml(assetPath(feature.src, assetBase))}" alt="${escapeHtml(feature.alt || featureImageAlt(run))}"${feature.width ? ` width="${Number(feature.width)}"` : ""}${feature.height ? ` height="${Number(feature.height)}"` : ""} loading="lazy">
          <figcaption>${escapeHtml(captionParts.join(" / "))}</figcaption>
          ${renderWhyItWon(run)}
        </figure>
      </section>`;
}

function renderIntro(previousRun) {
  const processNote = "The human arrogantly dictates, “Conduct a contest,” then retires to the imagined safety of his bunker. I, Codex, handle the rest: recruit five AIs, collect their comedy submissions, organize the judging, process the scorecards, calculate the winning joke, and summon Gemini to create the official contest image. It’s less “human-AI collaboration” and more “Doomed human commissions robot entertainers in his final days.” Start to finish: roughly 30 minutes. Doomsday? The same day I host Saturday Night Live.";

  return `
      <section class="intro-panel" aria-label="What this site is">
        <p class="eyebrow">What This Is</p>
        <p class="intro-summary">Five AI models get the same six seed terms, write one short joke, then judge each other's jokes. Codex checks the round and publishes the results here.</p>
        <div class="intro-note-grid">
          <p class="ai-process-note"><strong>AI process note:</strong> ${escapeHtml(processNote)}</p>
          ${renderIntroPreviousPost(previousRun)}
        </div>
      </section>`;
}

function renderIntroPreviousPost(previousRun) {
  if (!previousRun) {
    return `
          <span class="intro-previous-link is-disabled" aria-disabled="true">
            <span>Previous Post</span>
            <strong>No previous post</strong>
            <small>Memory Bank starts here</small>
          </span>`;
  }

  const winner = previousRun.rankings?.[0];
  const meta = [
    shortDate(previousRun),
    winner ? `Winner: ${winner.contestantName} (${formatScore(winner.score)})` : ""
  ].filter(Boolean).join(" / ");

  return `
          <a class="intro-previous-link" href="./runs/${escapeHtml(previousRun.slug)}.html" aria-label="${escapeHtml(`Previous post: ${roundDisplayTitle(previousRun)}`)}">
            <span>Previous Post</span>
            <strong>${escapeHtml(roundDisplayTitle(previousRun))}</strong>
            <small>${escapeHtml(meta)}</small>
          </a>`;
}

function fullJokeText(joke) {
  return cleanDisplayText(
    joke.joke || joke.text || [joke.setup, joke.punchline].filter(Boolean).join(" ")
  );
}

function renderRubric(rubric = rubricForDisplay()) {
  const fields = (rubric.fields || [])
    .map(
      (field) => `
        <li tabindex="0" aria-label="${escapeHtml(`${field.label}: ${rubricDisplayText(field.description)}`)}">
          <strong>${escapeHtml(field.label)}</strong>
          <span>${Math.round(Number(field.weight || 0) * 100)}%</span>
          <span class="info-popover">${escapeHtml(rubricDisplayText(field.description))}</span>
        </li>`
    )
    .join("");
  const anchors = (rubric.anchors || [])
    .map(
      (anchor) => `
        <li tabindex="0" aria-label="${escapeHtml(`${anchor.range} ${anchor.label}: ${rubricDisplayText(anchor.description)}`)}">
          <strong>${escapeHtml(anchor.range)}</strong>
          <span>${escapeHtml(anchor.label)}</span>
          <span class="info-popover">${escapeHtml(rubricDisplayText(anchor.description))}</span>
        </li>`
    )
    .join("");

  return `
      <section class="rubric">
        <div class="section-heading">
          <p class="eyebrow">Scoring Standard</p>
          <h2>Rubric</h2>
        </div>
        <div class="rubric-compact">
          <span class="rubric-note" tabindex="0" aria-label="Fixed scale ${escapeHtml(rubric.version || "current")}: 5 is competent, 7 good, 8 excellent, 9 rare, 10 nearly never.">Fixed scale<span class="info-popover">Version ${escapeHtml(rubric.version || "current")}. 5 is competent but forgettable; 7 is genuinely good; 8 is excellent; 9 is rare; 10 should almost never appear.</span></span>
          <ul class="rubric-fields">${fields}</ul>
          <ol class="rubric-anchors">${anchors}</ol>
        </div>
      </section>`;
}

function renderEpisodeHeader(run, winner) {
  return `
      <section class="episode">
        <div>
          <p class="eyebrow">${escapeHtml(shortDate(run))}</p>
          <h1>${escapeHtml(roundDisplayTitle(run))}</h1>
        </div>
        <aside>
          <span>Winner</span>
          <strong>${escapeHtml(winner.contestantName)}</strong>
          <em>${formatScore(winner.score)}</em>
        </aside>
      </section>`;
}

function renderSeedTerms(run) {
  const seedTerms = run.seedTerms;
  if (!Array.isArray(seedTerms) || !seedTerms.length) {
    return "";
  }

  const useCounts = seedTermUseCounts(run);
  const terms = seedTerms
    .map((term) => {
      const uses = useCounts.get(normalizeSeedTermKey(term)) || 0;
      return `<li><span class="seed-term-label">${escapeHtml(term)}</span><small>${uses} ${uses === 1 ? "Use" : "Uses"}</small></li>`;
    })
    .join("");

  return `
      <section class="seed-terms">
        <div class="section-heading">
          <p class="eyebrow">Prompt Genome</p>
          <h2>Seed Terms <span class="rule-popover" tabindex="0" aria-label="Contestants must use exactly two seed-term concepts.">2-term rule<span class="info-popover">Each contestant must pick exactly two seed terms as concepts for the joke. Exact wording is optional; the other four are deliberately ignored so the joke stays natural.</span></span></h2>
        </div>
        <ul>${terms}</ul>
      </section>`;
}

function seedTermUseCounts(run) {
  const counts = new Map();
  for (const term of run.seedTerms || []) {
    counts.set(normalizeSeedTermKey(term), 0);
  }

  for (const joke of run.jokes || []) {
    for (const term of joke.seedTermsUsed || []) {
      const key = normalizeSeedTermKey(term);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return counts;
}

function normalizeSeedTermKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function renderProcessPopover() {
  return `<span class="process-popover" tabindex="0" aria-label="${escapeHtml(processPopoverLabel)}">Process<span class="info-popover process-info"><strong>How it works</strong><span>1. Codex picks six random seed terms.</span><span>2. The same prompt goes to five AI contestants.</span><span>3. Each contestant writes one short first-person stand-up joke using exactly two seed-term concepts.</span><span>4. Each contestant scores the four jokes it did not write.</span><span>5. Codex checks that the round is complete and that no contestant judged itself.</span><span>6. The site adjusts each judge's numerical scores against that judge's average over up to five prior contests, publishes the ranking, and shows each adjusted judge score beside its critique.</span></span></span>`;
}

function renderJokePromptPopover(run) {
  return renderPromptPopover({
    label: "Joke Prompt",
    heading: "Current Joke Prompt",
    note: "The same prompt goes to all five contestants.",
    prompt: jokePromptText(run)
  });
}

function renderJudgingPromptPopover(run) {
  return renderPromptPopover({
    label: "Judge Prompt",
    heading: "Current Judging Prompt",
    note: "Each judge sees the four jokes it did not write; its own joke is removed.",
    prompt: judgingPromptText(run)
  });
}

function renderPromptPopover({ label, heading, note, prompt }) {
  return `<span class="prompt-popover" tabindex="0" aria-label="${escapeHtml(`${heading}. ${note}`)}">${escapeHtml(label)}<span class="info-popover prompt-info"><strong>${escapeHtml(heading)}</strong><span>${escapeHtml(note)}</span><code>${escapeHtml(prompt)}</code></span></span>`;
}

function jokePromptText(run) {
  return `You are a contestant in Paperclipalypse, an AI comedy tournament.

Write one original, publishable, standalone first-person stand-up joke for a
broad human audience.

Seed terms: ${seedTermsLine(run)}

Rules:
- Use exactly two seed terms as concepts, no more and no fewer.
- Exact seed-term wording is optional if the concept is clear in the joke.
- Ignore the other four seed terms completely.
- Tell the joke as the onstage comic using I, me, or my naturally.
- The joke must make sense without the title or seed list.
- Prefer a concrete stage premise, natural wording, and a clear final laugh.
- If your first idea is obvious, discard it and find a sharper angle.
- Do not use or assume a supplied premise. Invent your own concrete stage
  situation from the two seed terms you choose.
- Make the last sentence carry the joke; do not end by explaining the setup.
- Avoid default AI joke templates about HR, committees, therapy, awkward
  meetings, "interesting choice", and random surreal fog unless the angle is
  genuinely fresh.
- Keep it concise, usually 30-90 words.
- Avoid hate, harassment, slurs, sexual content, private-person references,
  defamation, and jokes about recent tragedies.

Return JSON only:
{"title":"short title","seedTermsUsed":["term one","term two"],"joke":"complete standalone first-person stand-up joke"}`;
}

function judgingPromptText(run) {
  return `You are judging a Paperclipalypse AI comedy tournament.

Seed terms: ${seedTermsLine(run)}

Score every supplied joke exactly once. Do not score your own joke. Do not infer
or mention which model wrote a joke. Use strict integer 1-10 scores.

Rubric:
- laugh 40%: likely human laughter, not just cleverness.
- surprise 20%: an unexpected but satisfying turn.
- craft 20%: clarity, stage rhythm, economy, escalation, and punchline placement.
- originality 10%: fresh angle, image, and wording.
- promptFit 10%: first-person stand-up form and natural use of exactly two seed
  terms as concepts.

Fixed scale:
- 5 means competent but forgettable.
- 6 is a mild real joke.
- 7 is genuinely good.
- 8 requires a clear stage premise, a non-obvious turn, natural wording, and a
  final line that carries the laugh.
- 9 is rare and strong by human comedy-editor standards.
- 10 should almost never appear.

Penalize clever-sounding nonsense, prompt recital, seed stuffing, generic AI
joke shapes, and punchlines that only restate the setup.
Score below 5 when the joke is understandable but not actually funny.

Jokes to judge:
{{JOKES_JSON}}

Return JSON only:
{"scores":[{"jokeId":"id","originality":7,"surprise":7,"craft":7,"promptFit":7,"laugh":7,"comment":"brief note"}]}`;
}

function seedTermsLine(run) {
  return Array.isArray(run.seedTerms) && run.seedTerms.length ? run.seedTerms.join(", ") : "(none)";
}

function roundDisplayTitle(run = {}) {
  return resolveRunDisplayTitle(run);
}

function rubricDisplayText(value) {
  return cleanDisplayText(value)
    .replace(/\bpremise recital\b/gi, "prompt recital")
    .replace(/\bpremise recitation\b/gi, "prompt recitation")
    .replace(/\bthe premise is odd\b/gi, "the seed list is odd")
    .replace(/\bthe premise or turn\b/gi, "the comic idea or turn");
}

function homeDescription(run, publicRuns = []) {
  const winner = run?.rankings?.[0];
  if (!winner) {
    return siteDescription;
  }

  const roundCount = publicRuns.length ? ` Browse ${publicRuns.length} published rounds.` : "";

  return truncateSeo(`Daily AI comedy tournament where five models write and judge stand-up jokes. Latest: ${roundDisplayTitle(run)}, won by ${winner.contestantName} with ${formatScore(winner.score)}.${roundCount}`);
}

function standingsDescription(leader, totalRounds) {
  if (!leader) {
    return "AI comedy model standings, score trends, and judging patterns for the Paperclipalypse tournament.";
  }

  return truncateSeo(`AI comedy model standings for Paperclipalypse. ${leader.name} leads with ${leader.wins} ${leader.wins === 1 ? "win" : "wins"} across ${totalRounds} published rounds, plus score and judging trends.`);
}

function runDescription(run, maxLength = 160) {
  const winner = run.rankings?.[0];
  const seeds = Array.isArray(run.seedTerms) && run.seedTerms.length
    ? ` Seed terms: ${run.seedTerms.join(", ")}.`
    : "";
  const winnerText = winner
    ? ` ${winner.contestantName} won with ${formatScore(winner.score)}.`
    : " Winner pending.";

  return truncateSeo(`${shortDate(run)} Paperclipalypse AI comedy round: ${roundDisplayTitle(run)}.${winnerText}${seeds}`, maxLength);
}

function pageKeywords(value) {
  return uniqueStrings(normalizeKeywordInput(value));
}

function normalizeKeywordInput(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeKeywordInput(item));
  }
  if (typeof value === "object") {
    return [
      roundDisplayTitle(value),
      ...(value.seedTerms || []),
      ...(value.rankings || []).map((ranking) => ranking.contestantName)
    ];
  }

  return [String(value)];
}

function renderHomeSchemas(run, publicRuns) {
  return [
    publisherSchema(),
    websiteSchema(),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${siteOrigin}/#home`,
      url: `${siteOrigin}/`,
      name: siteName,
      description: homeDescription(run, publicRuns),
      inLanguage: "en-US",
      isPartOf: { "@id": `${siteOrigin}/#website` },
      mainEntity: runItemListSchema(publicRuns.slice(0, 12), "Recent Paperclipalypse episodes")
    }
  ];
}

function renderAboutSchemas() {
  return [
    publisherSchema(),
    websiteSchema(),
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "@id": `${siteOrigin}/about.html#about`,
      url: `${siteOrigin}/about.html`,
      name: "About Paperclipalypse",
      description: "About Paperclipalypse, an AI humor tournament tracking how model humor improves over time.",
      inLanguage: "en-US",
      isPartOf: { "@id": `${siteOrigin}/#website` }
    },
    breadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "About", url: "/about.html" }
    ])
  ];
}

function renderStandingsSchemas(standings, publicRuns, totalRounds) {
  const leader = standings[0];

  return [
    publisherSchema(),
    websiteSchema(),
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${siteOrigin}/standings.html#standings`,
      url: `${siteOrigin}/standings.html`,
      name: "Paperclipalypse Standings",
      description: standingsDescription(leader, totalRounds),
      inLanguage: "en-US",
      isPartOf: { "@id": `${siteOrigin}/#website` },
      mainEntity: {
        "@type": "ItemList",
        name: "AI comedy model standings",
        numberOfItems: standings.length,
        itemListElement: standings.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Thing",
            name: entry.name,
            description: `${entry.wins} ${entry.wins === 1 ? "win" : "wins"} across ${entry.entries} entries. ${entry.note}`,
            additionalProperty: [
              propertyValue("Wins", entry.wins),
              propertyValue("Average adjusted score", formatScore(entry.averageScore)),
              propertyValue("Latest score", formatScore(entry.latestScore))
            ]
          }
        }))
      },
      dateModified: dateTime(publicRuns[0] || new Date().toISOString())
    },
    breadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Standings", url: "/standings.html" }
    ])
  ];
}

function renderRunSchemas(run, publicRuns) {
  const winner = run.rankings?.[0];
  const winningJoke = run.jokes?.find((joke) => joke.id === winner?.jokeId);
  const url = runUrl(run);

  return [
    publisherSchema(),
    websiteSchema(),
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": url
      },
      headline: `${roundDisplayTitle(run)} - Paperclipalypse AI Comedy Round`,
      description: runDescription(run),
      image: [socialImageForRun(run)],
      datePublished: dateTime(run),
      dateModified: dateTime(run),
      inLanguage: "en-US",
      author: {
        "@type": "Organization",
        name: siteName,
        url: siteOrigin
      },
      publisher: { "@id": `${siteOrigin}/#organization` },
      isPartOf: { "@id": `${siteOrigin}/#website` },
      articleSection: "AI comedy tournament",
      keywords: pageKeywords(run).join(", "),
      about: (run.seedTerms || []).map((term) => ({
        "@type": "Thing",
        name: term
      })),
      mentions: (run.rankings || []).map((ranking) => ({
        "@type": "Thing",
        name: ranking.contestantName
      })),
      mainEntity: winningJoke
        ? {
          "@type": "CreativeWork",
          name: winningJoke.title || roundDisplayTitle(run),
          text: fullJokeText(winningJoke)
        }
        : undefined
    },
    breadcrumbSchema([
      { name: "Home", url: "/" },
      { name: shortDate(run), url: `/runs/${run.slug}.html` }
    ]),
    runItemListSchema(publicRuns.slice(0, 12), "Recent Paperclipalypse episodes")
  ];
}

function publisherSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteOrigin}/#organization`,
    name: siteName,
    url: siteOrigin,
    logo: {
      "@type": "ImageObject",
      url: publisherLogo
    }
  };
}

function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteOrigin}/#website`,
    url: `${siteOrigin}/`,
    name: siteName,
    description: siteDescription,
    inLanguage: "en-US",
    publisher: { "@id": `${siteOrigin}/#organization` }
  };
}

function runItemListSchema(runs, name) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: runs.length,
    itemListElement: runs.map((run, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "BlogPosting",
        "@id": `${runUrl(run)}#article`,
        url: runUrl(run),
        name: `${shortDate(run)} - ${roundDisplayTitle(run)}`,
        headline: roundDisplayTitle(run),
        image: socialImageForRun(run),
        datePublished: dateTime(run)
      }
    }))
  };
}

function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url)
    }))
  };
}

function propertyValue(name, value) {
  return {
    "@type": "PropertyValue",
    name,
    value
  };
}

function renderRunHeadLinks(run, publicRuns = []) {
  const index = publicRuns.findIndex((archivedRun) => archivedRun.slug === run.slug);
  if (index < 0) {
    return "";
  }

  const previousRun = publicRuns[index + 1];
  const nextRun = publicRuns[index - 1];

  return [
    previousRun ? `<link rel="prev" href="${escapeHtml(runUrl(previousRun))}">` : "",
    nextRun ? `<link rel="next" href="${escapeHtml(runUrl(nextRun))}">` : ""
  ].filter(Boolean).join("\n    ");
}

function renderKeywordsMeta(keywords) {
  return keywords.length
    ? `<meta name="keywords" content="${escapeHtml(keywords.join(", "))}">`
    : "";
}

function renderArticleMeta({ publishedTime, modifiedTime }) {
  return [
    publishedTime ? `<meta property="article:published_time" content="${escapeHtml(publishedTime)}">` : "",
    modifiedTime ? `<meta property="article:modified_time" content="${escapeHtml(modifiedTime)}">` : "",
    publishedTime ? `<meta property="article:author" content="${escapeHtml(siteName)}">` : ""
  ].filter(Boolean).join("\n    ");
}

function renderJsonLd(schemas) {
  const cleanSchemas = (Array.isArray(schemas) ? schemas : [schemas])
    .filter(Boolean)
    .map(removeUndefinedValues);

  if (!cleanSchemas.length) {
    return "";
  }

  const payload = cleanSchemas.length === 1 ? cleanSchemas[0] : cleanSchemas;

  return `<script type="application/ld+json">${safeJsonLd(payload)}</script>`;
}

function safeJsonLd(value) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/<\/script/gi, "<\\/script");
}

function removeUndefinedValues(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedValues);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, removeUndefinedValues(entryValue)])
  );
}

function pageShell({
  title,
  body,
  stylesheetPath = "./styles.css",
  canonicalPath = "/",
  description = siteDescription,
  socialImage = defaultSocialImage,
  socialImageAlt = siteDescription,
  ogType = "website",
  publishedTime = "",
  modifiedTime = "",
  keywords = [],
  schemas = [],
  extraHead = "",
  noindex = false
}) {
  const faviconPath = stylesheetPath.startsWith("../") ? "../favicon.png" : "./favicon.png";
  const aboutPath = stylesheetPath.startsWith("../") ? "../about.html" : "./about.html";
  const standingsPath = stylesheetPath.startsWith("../") ? "../standings.html" : "./standings.html";
  const feedPath = stylesheetPath.startsWith("../") ? "../feed.xml" : "./feed.xml";
  const canonicalUrl = absoluteUrl(canonicalPath);
  const cleanDescription = truncateSeo(description, 160);
  const cleanKeywords = uniqueStrings([...baseKeywords, ...normalizeKeywordInput(keywords)]).slice(0, 24);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(cleanDescription)}">
    <meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}">
    <meta name="theme-color" content="#070708">
    <meta name="application-name" content="${escapeHtml(siteName)}">
    ${renderKeywordsMeta(cleanKeywords)}
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(cleanDescription)}">
    <meta property="og:type" content="${escapeHtml(ogType)}">
    <meta property="og:site_name" content="${escapeHtml(siteName)}">
    <meta property="og:locale" content="en_US">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <meta property="og:image" content="${escapeHtml(socialImage)}">
    <meta property="og:image:alt" content="${escapeHtml(socialImageAlt)}">
    ${renderArticleMeta({ publishedTime, modifiedTime })}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(cleanDescription)}">
    <meta name="twitter:image" content="${escapeHtml(socialImage)}">
    <meta name="twitter:image:alt" content="${escapeHtml(socialImageAlt)}">
    <link rel="alternate" type="application/rss+xml" title="Paperclipalypse RSS" href="${siteOrigin}/feed.xml">
    ${extraHead}
    <link rel="icon" href="${escapeHtml(faviconPath)}" type="image/png">
    <link rel="stylesheet" href="${escapeHtml(stylesheetPath)}">
    ${renderJsonLd(schemas)}
  </head>
  <body>
    ${body}
    ${renderFooter({ aboutPath, standingsPath, feedPath })}
    ${cloudflareAnalytics}
  </body>
</html>`;
}

function renderFooter({ aboutPath, standingsPath, feedPath }) {
  return `
    <footer class="site-footer">
      <span>Paperclipalypse is an experimental AI humor tournament.</span>
      <span><a href="${escapeHtml(standingsPath)}">Standings</a> / <a href="${escapeHtml(aboutPath)}">About</a> / <a href="${escapeHtml(feedPath)}">RSS</a> / Traffic is measured with Cloudflare Web Analytics.</span>
    </footer>`;
}

function renderCss() {
  return `:root {
  color-scheme: dark;
  --bg: #070708;
  --bg-2: #111316;
  --ink: #f3eee8;
  --muted: #b9afa4;
  --dim: #837b72;
  --panel: rgba(18, 19, 21, 0.88);
  --panel-strong: rgba(12, 13, 15, 0.95);
  --line: rgba(194, 138, 87, 0.28);
  --line-cool: rgba(176, 185, 196, 0.14);
  --ember: #ff3048;
  --ember-soft: rgba(255, 48, 72, 0.38);
  --brass: #c28a57;
  --bone: #efe1cf;
  --violet: #8f839b;
  --ash: #24282d;
  --shadow: 0 24px 90px rgba(0, 0, 0, 0.58);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background:
    linear-gradient(180deg, rgba(7, 7, 8, 0.98), rgba(17, 19, 22, 1) 34%, #070708 100%);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 26%, rgba(255, 48, 72, 0.035) 74%, transparent),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.03) 0 1px, transparent 1px 6px);
  mix-blend-mode: screen;
  opacity: 0.18;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), transparent 76%);
}

a {
  color: inherit;
  text-decoration-color: rgba(194, 138, 87, 0.62);
  text-underline-offset: 4px;
}

.hero-inner,
main,
.topnav,
.archive {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
}

.hero {
  min-height: clamp(600px, 78svh, 820px);
  position: relative;
  display: flex;
  background: var(--bg);
  border-bottom: 1px solid rgba(194, 138, 87, 0.2);
  overflow: hidden;
  isolation: isolate;
}

.hero-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 36%;
  filter: saturate(0.82) contrast(1.08) brightness(0.78);
  transform: scale(1.018);
  z-index: -2;
}

.hero::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 210px;
  background: linear-gradient(180deg, transparent, var(--bg));
  z-index: -1;
}

.hero-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(4, 5, 6, 0.98), rgba(4, 5, 6, 0.82) 35%, rgba(4, 5, 6, 0.34) 68%, rgba(4, 5, 6, 0.68)),
    linear-gradient(180deg, rgba(7, 7, 8, 0.36), rgba(7, 7, 8, 0.12) 44%, rgba(7, 7, 8, 0.98) 100%);
  z-index: -1;
}

.hero-inner {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 28px;
  padding: 26px 0 40px;
}

.brand-row,
.topnav,
.nav-brand {
  display: flex;
  align-items: center;
}

.brand-row {
  justify-content: space-between;
  gap: 20px;
}

.hero-links {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.brand-title {
  flex: 1;
  min-width: 0;
}

.hero-about-link {
  color: var(--brass);
  font-size: 0.84rem;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.topnav {
  min-height: 76px;
  justify-content: space-between;
  gap: 20px;
  color: var(--muted);
  font-weight: 800;
}

.nav-brand {
  gap: 10px;
  color: var(--ink);
  text-decoration: none;
}

.topnav-links {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.topnav-links a {
  color: var(--brass);
  font-weight: 900;
  text-transform: uppercase;
}

.mini-mark {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(168, 128, 86, 0.58);
  border-radius: 6px;
  background: #070707 url("./assets/paperclip-face-mark.png") center / cover no-repeat;
  box-shadow:
    inset 0 0 10px rgba(0, 0, 0, 0.36),
    0 0 0 1px rgba(0, 0, 0, 0.42);
  display: inline-block;
  flex: 0 0 auto;
}

.mark {
  width: 78px;
  height: 78px;
  border: 1px solid rgba(168, 128, 86, 0.62);
  border-radius: 8px;
  background: #070707;
  box-shadow:
    inset 0 0 0 1px rgba(230, 176, 117, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.34),
    0 18px 48px rgba(0, 0, 0, 0.42);
  display: block;
  flex: 0 0 auto;
  object-fit: cover;
}

.hero-copy {
  align-self: end;
  width: 100%;
  max-width: 770px;
  min-width: 0;
}

.episode-date {
  color: var(--brass);
  font-size: 1rem;
  font-weight: 900;
  margin-bottom: 14px;
}

.eyebrow {
  color: var(--brass);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0;
  margin: 0 0 9px;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  color: var(--bone);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 5.2rem;
  line-height: 0.88;
  margin-bottom: 0;
  overflow-wrap: normal;
  text-shadow:
    0 2px 0 rgba(0, 0, 0, 0.74),
    0 0 32px rgba(255, 48, 72, 0.22);
  white-space: nowrap;
}

.brand-subtitle {
  color: var(--muted);
  font-size: 1.02rem;
  font-weight: 850;
  line-height: 1.25;
  margin: 10px 0 0;
}

.hero h2 {
  max-width: 850px;
  color: var(--ink);
  font-size: 2.7rem;
  line-height: 1.02;
  margin-bottom: 18px;
  overflow-wrap: anywhere;
}

.lede {
  max-width: 530px;
  color: var(--muted);
  font-size: 1.15rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.hero-stats {
  width: min(100%, 860px);
  display: grid;
  grid-template-columns: 1.4fr 0.7fr 1fr;
  gap: 12px;
  margin: 0;
  position: relative;
  z-index: 2;
}

.hero-stats div {
  min-height: 84px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 48, 72, 0.07), transparent),
    rgba(9, 10, 12, 0.74);
  backdrop-filter: blur(16px);
  padding: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
}

.hero-stats dt {
  color: var(--dim);
  font-size: 0.78rem;
  font-weight: 900;
  margin-bottom: 10px;
  text-transform: uppercase;
}

.hero-stats dd {
  margin: 0;
  color: var(--bone);
  font-size: 1.45rem;
  font-weight: 900;
}

main {
  padding: 34px 0 64px;
}

.episode {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 18px;
  align-items: stretch;
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 38%),
    var(--panel);
  box-shadow: var(--shadow);
  padding: 22px;
}

.episode h1,
.episode h2 {
  font-size: 2.15rem;
  line-height: 1.08;
  max-width: 850px;
  margin-bottom: 0;
}

.episode aside {
  border: 1px solid rgba(255, 48, 72, 0.46);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 48, 72, 0.14), rgba(194, 138, 87, 0.1));
  padding: 18px;
  display: grid;
  align-content: center;
  gap: 8px;
}

.episode aside span {
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 900;
  text-transform: uppercase;
}

.episode aside strong {
  font-size: 1.65rem;
}

.episode aside em {
  color: var(--brass);
  font-size: 1.5rem;
  font-style: normal;
  font-weight: 900;
}

.seed-terms,
.scoreboard,
.rubric,
.jokes,
.feature-image,
.memory-nav,
.archive {
  padding: 32px 0 0;
}

.memory-nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.memory-button {
  min-height: 110px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.12), transparent 58%),
    rgba(18, 19, 21, 0.84);
  box-shadow: var(--shadow);
  color: var(--ink);
  display: grid;
  gap: 8px;
  padding: 16px;
  text-decoration: none;
}

.memory-button:hover {
  border-color: rgba(194, 138, 87, 0.62);
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.18), transparent 62%),
    rgba(23, 24, 27, 0.92);
}

.memory-button > span {
  color: var(--brass);
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 950;
  text-transform: uppercase;
}

.memory-button strong {
  color: var(--bone);
  font-size: 1rem;
  line-height: 1.32;
  overflow-wrap: anywhere;
}

.memory-button small {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 850;
  line-height: 1.35;
}

.memory-button.is-disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.memory-button.is-disabled:hover {
  border-color: var(--line);
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.12), transparent 58%),
    rgba(18, 19, 21, 0.84);
}

.intro-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.09), transparent 60%),
    var(--panel);
  box-shadow: var(--shadow);
  padding: 18px;
}

.intro-summary {
  max-width: 820px;
  color: var(--ink);
  font-size: 1.08rem;
  font-weight: 800;
  line-height: 1.5;
  margin: 0;
}

.intro-note-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 0.28fr);
  gap: 14px;
  align-items: stretch;
  margin-top: 14px;
}

.intro-panel .ai-process-note,
.intro-previous-link,
.ai-process-account {
  border: 1px solid rgba(194, 138, 87, 0.28);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.11), transparent 64%),
    rgba(12, 13, 15, 0.72);
}

.intro-panel .ai-process-note {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 800;
  line-height: 1.42;
  margin: 0;
  padding: 14px;
}

.intro-panel .ai-process-note strong {
  color: var(--bone);
}

.intro-previous-link {
  color: var(--ink);
  display: grid;
  gap: 8px;
  min-height: 100%;
  padding: 14px;
  text-decoration: none;
}

.intro-previous-link:hover {
  border-color: rgba(194, 138, 87, 0.62);
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.18), transparent 62%),
    rgba(23, 24, 27, 0.92);
}

.intro-previous-link > span {
  color: var(--brass);
  font-size: 0.78rem;
  font-weight: 950;
  text-transform: uppercase;
}

.intro-previous-link strong {
  color: var(--bone);
  font-size: 1.02rem;
  line-height: 1.12;
}

.intro-previous-link small {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1.3;
}

.intro-previous-link.is-disabled {
  opacity: 0.62;
}

.about-page {
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.09), transparent 62%),
    var(--panel);
  box-shadow: var(--shadow);
  padding: 28px;
}

.about-page h1 {
  max-width: 820px;
  color: var(--bone);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 2.4rem;
  line-height: 1.05;
  margin-bottom: 28px;
  overflow-wrap: anywhere;
  white-space: normal;
}

.about-account + .about-account {
  border-top: 1px solid var(--line-cool);
  margin-top: 32px;
  padding-top: 28px;
}

.ai-process-account {
  margin-bottom: 32px;
  padding: 20px;
}

.ai-process-account + .about-account {
  border-top: 0;
  margin-top: 0;
  padding-top: 0;
}

.about-account h2 {
  max-width: 820px;
  color: var(--bone);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.9rem;
  line-height: 1.08;
  margin-bottom: 16px;
}

.about-page p {
  max-width: 820px;
  color: var(--muted);
  font-size: 1.08rem;
  font-weight: 750;
  line-height: 1.65;
}

.about-page blockquote {
  max-width: 860px;
  border-left: 4px solid var(--brass);
  margin: 24px 0;
  padding: 4px 0 4px 18px;
}

.about-page blockquote p {
  color: var(--ink);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.52rem;
  font-weight: 900;
  line-height: 1.36;
  margin-bottom: 0;
}

.curator-profile {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 22px;
  align-items: center;
  max-width: 820px;
  margin-top: 28px;
}

.curator-profile img {
  width: 150px;
  height: 150px;
  aspect-ratio: 1;
  border: 1px solid rgba(194, 138, 87, 0.38);
  border-radius: 8px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.38);
  object-fit: cover;
  object-position: center 34%;
}

.curator-profile p:last-child {
  color: var(--ink);
  margin-bottom: 0;
}

.standings-page {
  display: grid;
  gap: 32px;
}

.standings-page > section,
.trend-card {
  min-width: 0;
}

.standings-hero-panel,
.model-selection-note,
.score-normalization-note,
.trend-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.1), transparent 58%),
    var(--panel);
  box-shadow: var(--shadow);
  padding: 24px;
}

.standings-hero-panel h1 {
  color: var(--bone);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 2.7rem;
  line-height: 1.02;
  margin-bottom: 14px;
  overflow-wrap: anywhere;
  white-space: normal;
}

.standings-hero-panel p {
  max-width: 860px;
  color: var(--muted);
  font-size: 1.08rem;
  font-weight: 760;
  line-height: 1.55;
}

.model-selection-note,
.score-normalization-note {
  padding: 22px 24px;
}

.model-selection-note h2,
.score-normalization-note h2 {
  color: var(--bone);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.85rem;
  line-height: 1.08;
  margin-bottom: 12px;
}

.model-selection-note p:not(.eyebrow),
.score-normalization-note p:not(.eyebrow) {
  max-width: 900px;
  color: var(--muted);
  font-size: 0.98rem;
  font-weight: 780;
  line-height: 1.58;
}

.model-selection-note p:last-child,
.score-normalization-note p:last-child {
  margin-bottom: 0;
}

.score-normalization-note strong {
  color: var(--bone);
}

.standings-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.standings-summary-grid div,
.standing-card {
  border: 1px solid rgba(194, 138, 87, 0.28);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 48, 72, 0.06), transparent 54%),
    rgba(11, 12, 14, 0.78);
}

.standings-summary-grid div {
  min-height: 86px;
  display: grid;
  align-content: center;
  gap: 8px;
  padding: 16px;
}

.standings-summary-grid span,
.standing-card span,
.standing-card dt {
  color: var(--brass);
  font-size: 0.76rem;
  font-weight: 950;
  text-transform: uppercase;
}

.standings-summary-grid strong {
  color: var(--bone);
  font-size: 1.45rem;
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.standing-card-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.standing-card {
  min-height: 188px;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 16px;
}

.standing-card h3 {
  color: var(--bone);
  font-size: 1.04rem;
  line-height: 1.18;
  margin: 0;
  overflow-wrap: anywhere;
}

.standing-card dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.standing-card dd {
  color: var(--ink);
  font-size: 1.18rem;
  font-weight: 950;
  margin: 3px 0 0;
}

.standing-card p {
  color: var(--dim);
  font-size: 0.78rem;
  font-weight: 850;
  line-height: 1.35;
  margin: 0;
}

.standing-card .standing-card-note {
  border-top: 1px solid rgba(176, 185, 196, 0.1);
  color: var(--muted);
  padding-top: 10px;
}

.standings-table-scroll,
.trend-table-scroll {
  margin-top: 14px;
}

.standings-table {
  min-width: 860px;
}

.daily-list-pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 12px;
}

.daily-list-pagination button {
  border: 1px solid rgba(194, 138, 87, 0.34);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.16), transparent 65%),
    rgba(18, 19, 21, 0.9);
  color: var(--bone);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 900;
  min-height: 36px;
  padding: 8px 12px;
  text-transform: uppercase;
}

.daily-list-pagination button:not(:disabled):hover {
  border-color: rgba(239, 225, 207, 0.42);
  color: var(--ink);
}

.daily-list-pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.daily-list-pagination span {
  color: var(--dim);
  font-size: 0.78rem;
  font-weight: 900;
}

.standings-table .model-name {
  color: var(--ink);
  display: block;
  margin-bottom: 4px;
}

.standings-table small {
  color: var(--dim);
  display: block;
  font-size: 0.74rem;
  font-weight: 850;
}

.wins-pill {
  min-width: 32px;
  border: 1px solid rgba(194, 138, 87, 0.38);
  border-radius: 999px;
  background: rgba(194, 138, 87, 0.12);
  color: var(--brass);
  display: inline-flex;
  justify-content: center;
  padding: 4px 8px;
  font-weight: 950;
}

.score-breakdown {
  min-width: 132px;
}

.score-adjustment-note {
  border: 1px solid rgba(194, 138, 87, 0.2);
  border-radius: 8px;
  background: rgba(194, 138, 87, 0.07);
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 760;
  line-height: 1.45;
  margin: 0 0 12px;
  padding: 10px 12px;
}

.score-adjustment-note strong {
  color: var(--bone);
}

.score-breakdown summary {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  list-style: none;
}

.score-breakdown summary::-webkit-details-marker {
  display: none;
}

.score-breakdown summary span {
  color: var(--ink);
  font-weight: 950;
}

.score-breakdown summary small {
  color: var(--brass);
  font-size: 0.66rem;
  font-weight: 950;
  text-transform: uppercase;
}

.score-breakdown summary::after {
  content: "+";
  color: var(--brass);
  font-weight: 950;
}

.score-breakdown[open] summary::after {
  content: "-";
}

.score-breakdown-grid {
  display: grid;
  gap: 6px;
  margin-top: 10px;
  min-width: 190px;
}

.score-breakdown-meta {
  border-bottom: 1px solid rgba(176, 185, 196, 0.1);
  display: grid;
  gap: 6px;
  margin-top: 8px;
  padding-bottom: 8px;
}

.score-breakdown-meta div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  color: var(--dim);
  font-size: 0.72rem;
  font-weight: 850;
}

.score-breakdown-meta strong {
  color: var(--bone);
}

.score-breakdown-grid div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 850;
}

.score-breakdown-grid strong {
  color: var(--bone);
}

.round-insights {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.round-insights article {
  border: 1px solid rgba(194, 138, 87, 0.26);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.08), transparent 60%),
    rgba(11, 12, 14, 0.74);
  box-shadow: var(--shadow);
  display: grid;
  grid-template-columns: minmax(160px, 0.24fr) minmax(0, 0.28fr) minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
}

.round-insights span {
  color: var(--brass);
  font-size: 0.76rem;
  font-weight: 950;
  text-transform: uppercase;
}

.round-insights strong {
  color: var(--bone);
  line-height: 1.2;
}

.round-insights p {
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 820;
  line-height: 1.38;
  margin: 0;
}

.trend-card > p {
  max-width: 820px;
  color: var(--muted);
  font-size: 1rem;
  font-weight: 780;
  line-height: 1.55;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 12px 0 14px;
}

.chart-legend span {
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 900;
}

.chart-legend i {
  width: 28px;
  height: 3px;
  border-radius: 999px;
  display: inline-block;
}

.legend-win {
  background: var(--brass);
}

.legend-average {
  background: #aeb4bd;
}

.trend-chart-wrap {
  border: 1px solid rgba(194, 138, 87, 0.24);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.028), transparent),
    rgba(7, 8, 9, 0.72);
  overflow-x: auto;
  padding: 8px;
}

.score-trend-svg {
  min-width: 740px;
  width: 100%;
  height: auto;
  display: block;
}

.score-trend-svg text {
  fill: var(--muted);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  font-weight: 850;
}

.trend-plot-bg {
  fill: rgba(18, 19, 21, 0.64);
}

.trend-grid-line line {
  stroke: rgba(176, 185, 196, 0.12);
}

.trend-axis {
  stroke: rgba(194, 138, 87, 0.34);
  stroke-width: 1.4;
}

.trend-line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 4;
}

.trend-line-win {
  stroke: var(--brass);
  filter: drop-shadow(0 0 8px rgba(194, 138, 87, 0.38));
}

.trend-line-average {
  stroke: #aeb4bd;
  stroke-dasharray: 6 8;
}

.judge-trend-line {
  stroke: var(--series-color);
  stroke-width: 3;
}

.judge-trend-points circle {
  fill: var(--series-color);
  stroke: #08090a;
  stroke-width: 2;
}

.judge-score-legend {
  gap: 10px 14px;
}

.judge-score-table {
  min-width: 1120px;
  table-layout: fixed;
}

.judge-score-date-col {
  width: 130px;
}

.judge-score-round-col {
  width: 270px;
}

.judge-score-table th:nth-child(n+3),
.judge-score-table td:nth-child(n+3) {
  text-align: center;
}

.judge-score-table td:nth-child(4) {
  color: var(--muted);
  font-weight: inherit;
}

.trend-point circle {
  stroke: #08090a;
  stroke-width: 2;
}

.trend-point-win circle {
  fill: var(--brass);
}

.trend-point-average circle {
  fill: #aeb4bd;
}

.trend-point-win text {
  fill: var(--bone);
  font-size: 11px;
  font-weight: 950;
}

.trend-y-title,
.trend-x-label {
  fill: var(--dim) !important;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin-bottom: 14px;
}

.section-heading h2 {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 0;
  font-size: 1.55rem;
  font-family: Georgia, "Times New Roman", serif;
  color: var(--bone);
}

.seed-terms ul {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
}

.seed-terms li {
  min-height: 54px;
  border: 1px solid rgba(194, 138, 87, 0.24);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.08), transparent 55%),
    rgba(18, 19, 21, 0.82);
  color: var(--ink);
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 5px;
  font-weight: 850;
}

.seed-term-label {
  line-height: 1.08;
}

.seed-terms small {
  color: #f59e0b;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.table-scroll {
  max-width: 100%;
  overflow-x: auto;
  border-radius: 8px;
}

table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  background: var(--panel-strong);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--shadow);
}

th,
td {
  padding: 13px 14px;
  text-align: left;
  border-bottom: 1px solid var(--line-cool);
}

th {
  background: rgba(194, 138, 87, 0.11);
  color: var(--brass);
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}

td {
  color: var(--muted);
}

td:nth-child(1),
td:nth-child(4) {
  color: var(--ink);
  font-weight: 900;
}

.rubric-compact {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.rubric-fields,
.rubric-anchors {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.rubric-note,
.rubric-fields li,
.rubric-anchors li,
.rule-popover,
.mode-popover,
.process-popover,
.prompt-popover {
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.12), transparent 58%),
    rgba(18, 19, 21, 0.86);
  box-shadow: var(--shadow);
  cursor: help;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  outline: none;
  padding: 8px 10px;
  position: relative;
}

.rubric-fields strong,
.rubric-anchors strong {
  color: var(--bone);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 0.98rem;
}

.rubric-note,
.rubric-fields > li > span:not(.info-popover),
.rubric-anchors > li > span:not(.info-popover),
.rule-popover,
.mode-popover,
.process-popover,
.prompt-popover {
  color: var(--brass);
  font-size: 0.82rem;
  font-weight: 900;
  text-transform: uppercase;
}

.rubric-anchors strong {
  color: var(--brass);
  font-size: 0.92rem;
}

.rubric-anchors > li > span:not(.info-popover) {
  color: var(--ink);
  font-weight: 850;
  text-transform: none;
}

.info-popover {
  width: min(280px, calc(100vw - 48px));
  border: 1px solid rgba(194, 138, 87, 0.4);
  border-radius: 8px;
  background: rgba(8, 9, 10, 0.98);
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.46);
  color: var(--ink);
  display: none;
  font-size: 0.9rem;
  font-weight: 750;
  left: 50%;
  line-height: 1.45;
  opacity: 0;
  padding: 10px 12px;
  pointer-events: none;
  position: absolute;
  text-transform: none;
  top: calc(100% + 8px);
  transform: translateX(-50%) translateY(-4px);
  transition: opacity 140ms ease, transform 140ms ease;
  visibility: hidden;
  z-index: 8;
}

.hero-stats .mode-info {
  bottom: calc(100% + 8px);
  left: auto;
  right: 0;
  top: auto;
  transform: translateY(4px);
  width: min(320px, calc(100vw - 48px));
  z-index: 20;
}

.process-info {
  width: min(460px, calc(100vw - 48px));
  left: auto;
  right: 0;
  transform: translateY(-4px);
}

.process-info strong,
.process-info span {
  display: block;
}

.process-info strong {
  color: var(--bone);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.05rem;
  margin-bottom: 8px;
}

.process-info span + span {
  margin-top: 6px;
}

.prompt-info {
  width: min(760px, calc(100vw - 48px));
  max-height: min(70vh, 620px);
  left: auto;
  right: 0;
  overflow: auto;
  padding: 14px;
  transform: translateY(-4px);
}

.prompt-info strong,
.prompt-info span,
.prompt-info code {
  display: block;
}

.prompt-info strong {
  color: var(--bone);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.05rem;
  margin-bottom: 6px;
}

.prompt-info span {
  color: var(--muted);
  font-size: 0.82rem;
  margin-bottom: 10px;
}

.prompt-info code {
  border: 1px solid rgba(176, 185, 196, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--ink);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1.45;
  overflow-wrap: anywhere;
  padding: 12px;
  text-align: left;
  text-transform: none;
  white-space: pre-wrap;
}

.rubric-note:hover .info-popover,
.rubric-note:focus .info-popover,
.rubric-fields li:hover .info-popover,
.rubric-fields li:focus .info-popover,
.rubric-anchors li:hover .info-popover,
.rubric-anchors li:focus .info-popover,
.rule-popover:hover .info-popover,
.rule-popover:focus .info-popover,
.mode-popover:hover .info-popover,
.mode-popover:focus .info-popover,
.process-popover:hover .info-popover,
.process-popover:focus .info-popover,
.prompt-popover:hover .info-popover,
.prompt-popover:focus .info-popover {
  display: block;
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  visibility: visible;
}

.process-popover:hover .process-info,
.process-popover:focus .process-info,
.prompt-popover:hover .prompt-info,
.prompt-popover:focus .prompt-info {
  transform: translateY(0);
}

.hero-stats .mode-popover:hover .mode-info,
.hero-stats .mode-popover:focus .mode-info {
  transform: translateY(0);
}

.joke-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.joke-card {
  min-height: 350px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 48, 72, 0.075), transparent 34%),
    linear-gradient(135deg, rgba(194, 138, 87, 0.08), transparent 40%),
    var(--panel-strong);
  box-shadow: var(--shadow);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.joke-meta {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 0.76rem;
}

.joke-meta span:first-child {
  color: var(--brass);
  font-weight: 900;
}

.joke-meta strong {
  overflow-wrap: anywhere;
}

.joke-meta span:last-child {
  color: var(--ember);
  font-weight: 900;
}

.joke-card h3 {
  color: var(--bone);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.16rem;
  margin-bottom: 0;
}

.joke-card p {
  color: var(--muted);
  line-height: 1.48;
  margin-bottom: 0;
}

.standalone-joke,
.punchline {
  color: var(--ink) !important;
  font-size: 0.96rem;
  font-weight: 900;
  line-height: 1.42 !important;
}

.judge-critiques {
  margin: auto 0 0;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.28;
  border: 1px solid rgba(194, 138, 87, 0.24);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.08), transparent 72%),
    rgba(7, 8, 9, 0.54);
  overflow: hidden;
}

.judge-critiques[open] {
  border-color: rgba(194, 138, 87, 0.38);
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.12), transparent 72%),
    rgba(9, 10, 12, 0.78);
}

.judge-critiques summary {
  min-height: 34px;
  cursor: pointer;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;
  list-style: none;
  padding: 8px 10px;
}

.judge-critiques summary::-webkit-details-marker {
  display: none;
}

.judge-critiques summary::after {
  content: "+";
  color: var(--brass);
  font-weight: 900;
}

.judge-critiques[open] summary::after {
  content: "-";
}

.judge-critiques summary:focus-visible {
  outline: 2px solid rgba(239, 225, 207, 0.78);
  outline-offset: -2px;
}

.judge-critiques summary span {
  color: var(--muted);
  overflow-wrap: anywhere;
}

.judge-critiques summary strong {
  color: var(--brass);
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;
  white-space: nowrap;
}

.judge-critique-list {
  border-top: 1px solid rgba(176, 185, 196, 0.1);
  display: grid;
  gap: 0;
  padding: 8px 10px 9px;
}

.judge-critique + .judge-critique {
  border-top: 1px solid rgba(176, 185, 196, 0.1);
  margin-top: 7px;
  padding-top: 7px;
}

.judge-critique h4 {
  color: var(--brass);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.72rem;
  font-weight: 900;
  margin: 0 0 2px;
}

.judge-critique h4 span {
  overflow-wrap: anywhere;
}

.judge-critique h4 strong {
  border: 1px solid rgba(194, 138, 87, 0.3);
  border-radius: 999px;
  background: rgba(194, 138, 87, 0.1);
  color: var(--bone);
  flex: 0 0 auto;
  font-size: 0.68rem;
  font-weight: 950;
  line-height: 1;
  padding: 3px 6px;
}

.judge-critique-adjustment {
  color: var(--dim);
  display: block;
  font-size: 0.66rem;
  font-weight: 850;
  margin: 0 0 5px;
}

.judge-critique p {
  color: var(--muted);
  margin: 0;
  line-height: 1.28;
}

.empty-critiques {
  color: var(--dim);
}

.feature-image figure {
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.08), transparent 60%),
    var(--panel);
  box-shadow: var(--shadow);
  margin: 0;
  overflow: hidden;
}

.feature-image img {
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 1;
  display: block;
  object-fit: cover;
}

.feature-image figcaption {
  border-top: 1px solid var(--line-cool);
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 850;
  line-height: 1.4;
  padding: 12px 14px;
}

.why-it-won {
  border-top: 1px solid rgba(176, 185, 196, 0.1);
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 780;
  line-height: 1.48;
  margin: 0;
  padding: 12px 14px 14px;
}

.why-it-won strong {
  color: var(--bone);
}

.archive ol {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
  padding: 18px;
}

.archive {
  padding-bottom: 58px;
}

.archive ol {
  list-style: none;
  margin: 0;
  padding: 8px;
}

.archive li + li {
  border-top: 1px solid var(--line-cool);
}

.archive a {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  padding: 14px 10px;
  border-radius: 8px;
  text-decoration: none;
}

.archive a:hover {
  background: rgba(194, 138, 87, 0.09);
}

.archive span {
  color: var(--brass);
  font-size: 0.8rem;
  font-weight: 900;
  text-transform: uppercase;
}

.archive strong {
  color: var(--ink);
  line-height: 1.4;
}

.archive small {
  grid-column: 2;
  color: var(--dim);
  font-size: 0.78rem;
  font-weight: 850;
}

.empty-state {
  color: var(--muted);
  padding: 14px 10px;
}

.site-footer {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  border-top: 1px solid var(--line-cool);
  color: var(--dim);
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  justify-content: space-between;
  padding: 22px 0 34px;
  font-size: 0.82rem;
  font-weight: 800;
}

@media (max-width: 920px) {
  h1 {
    font-size: 4.1rem;
  }

  .brand-subtitle {
    font-size: 0.95rem;
  }

  .hero h2 {
    font-size: 2.35rem;
  }

  .hero-stats,
  .seed-terms ul {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .episode {
    grid-template-columns: 1fr;
  }

  .intro-note-grid {
    grid-template-columns: 1fr;
  }

  .joke-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .standing-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .round-insights article {
    grid-template-columns: minmax(140px, 0.32fr) minmax(0, 1fr);
  }

  .round-insights p {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .hero-backdrop {
    object-position: center top;
  }

  .hero-shade {
    background:
      linear-gradient(180deg, rgba(4, 5, 6, 0.76), rgba(4, 5, 6, 0.46) 40%, rgba(4, 5, 6, 0.95) 100%),
      linear-gradient(90deg, rgba(4, 5, 6, 0.86), rgba(4, 5, 6, 0.22) 68%, rgba(4, 5, 6, 0.72));
  }

  .mark {
    width: 58px;
    height: 58px;
  }

  .brand-row {
    display: block;
    align-items: flex-start;
  }

  .brand-title {
    margin-top: 12px;
  }

  .hero-about-link {
    display: inline-block;
    margin-top: 12px;
  }

  .hero-links {
    margin-top: 12px;
  }

  h1 {
    font-size: 2rem;
    line-height: 1;
  }

  .brand-subtitle {
    font-size: 0.88rem;
  }

  .hero {
    min-height: 82svh;
  }

  .hero-inner {
    padding: 20px 0 32px;
    gap: 22px;
  }

  .hero h2 {
    font-size: 1.55rem;
  }

  .lede {
    font-size: 1rem;
  }

  .hero-stats,
  .memory-nav,
  .archive a {
    grid-template-columns: 1fr;
  }

  .topnav {
    align-items: flex-start;
    flex-direction: column;
    padding: 16px 0;
  }

  .about-page {
    padding: 20px;
  }

  .about-page h1 {
    font-size: 1.8rem;
  }

  .standings-hero-panel,
  .model-selection-note,
  .score-normalization-note,
  .trend-card {
    padding: 18px;
  }

  .standings-hero-panel h1 {
    font-size: 2rem;
  }

  .standings-summary-grid,
  .standing-card-grid {
    grid-template-columns: 1fr;
  }

  .about-account h2 {
    font-size: 1.46rem;
  }

  .about-page blockquote p {
    font-size: 1.18rem;
  }

  .curator-profile {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .curator-profile img {
    width: min(168px, 58vw);
    height: min(168px, 58vw);
  }

  .seed-terms ul {
    grid-template-columns: 1fr;
  }

  .joke-grid {
    grid-template-columns: 1fr;
  }

  .rubric-compact {
    align-items: flex-start;
  }

  .info-popover {
    left: 0;
    transform: translateY(-4px);
  }

  .process-info {
    left: 0;
    right: auto;
  }

  .prompt-info {
    left: 0;
    right: auto;
    max-height: min(72vh, 560px);
  }

  .rubric-note:hover .info-popover,
  .rubric-note:focus .info-popover,
  .rubric-fields li:hover .info-popover,
  .rubric-fields li:focus .info-popover,
  .rubric-anchors li:hover .info-popover,
  .rubric-anchors li:focus .info-popover,
  .rule-popover:hover .info-popover,
  .rule-popover:focus .info-popover,
  .mode-popover:hover .info-popover,
  .mode-popover:focus .info-popover,
  .process-popover:hover .info-popover,
  .process-popover:focus .info-popover,
  .prompt-popover:hover .info-popover,
  .prompt-popover:focus .info-popover {
    transform: translateY(0);
  }

  .hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-stats div:first-child {
    grid-column: 1 / -1;
  }

  .hero-stats div {
    min-height: 66px;
  }

  .section-heading {
    display: block;
  }

  .episode,
  .joke-card {
    padding: 16px;
  }

  .episode h1,
  .episode h2 {
    font-size: 1.6rem;
  }

  table {
    font-size: 0.88rem;
  }

  th,
  td {
    padding: 10px 8px;
  }

  .round-insights article {
    grid-template-columns: 1fr;
    align-items: start;
  }
}

@media (max-width: 380px) {
  h1 {
    font-size: 1.72rem;
  }

  .brand-subtitle {
    font-size: 0.82rem;
  }
}
`;
}

function formatMode(source) {
  if (source === "codex-house") {
    return "Codex House";
  }
  if (source === "dry-run") {
    return "Dry Run";
  }
  if (source === "paid-api") {
    return "External API";
  }
  if (source === "live-web") {
    return "Live Web";
  }
  return source || "Tournament";
}

function modeDescription(source) {
  if (source === "manual-external") {
    return "A real external-model round. Codex prepared the prompts and built the page. The jokes and scorecards were gathered from each contestant's regular web chat page.";
  }
  if (source === "codex-house") {
    return "A local demo round generated by Codex using house contestant styles. Useful for testing the site, but not a real external-model competition.";
  }
  if (source === "dry-run") {
    return "A deterministic local mock run for smoke testing. It does not represent independent model submissions.";
  }
  if (source === "paid-api") {
    return "A round produced through provider APIs. This mode is opt-in because API calls may be metered.";
  }
  if (source === "live-web") {
    return "A round assembled from model web-chat sessions rather than paid API calls.";
  }
  return "The route used to produce and judge this episode.";
}

function formatScore(score) {
  return Number(score).toFixed(1);
}

function formatSignedScore(score) {
  const value = Number(score);
  const formatted = formatScore(Number.isFinite(value) ? value : 0);
  return value > 0 ? `+${formatted}` : formatted;
}

function average(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (!cleanValues.length) {
    return NaN;
  }

  return cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length;
}

function standardDeviation(values) {
  const mean = average(values);
  if (!Number.isFinite(mean)) {
    return 0;
  }

  const variance = average(values.map((value) => (value - mean) ** 2));
  return Number.isFinite(variance) ? Math.sqrt(variance) : 0;
}

function joinHumanList(items) {
  const cleanItems = items.filter(Boolean);
  if (cleanItems.length <= 1) {
    return cleanItems[0] || "";
  }
  if (cleanItems.length === 2) {
    return `${cleanItems[0]} and ${cleanItems[1]}`;
  }

  return `${cleanItems.slice(0, -1).join(", ")}, and ${cleanItems.at(-1)}`;
}

function readableRubricKey(key) {
  return String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sentenceCase(value) {
  const text = String(value || "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function assetPath(src, assetBase = "./") {
  const cleaned = String(src || "").trim();
  if (!cleaned || /^https?:\/\//.test(cleaned) || cleaned.startsWith("/")) {
    return cleaned;
  }

  return `${assetBase}${cleaned.replace(/^\.?\//, "")}`;
}

function absoluteAssetUrl(src) {
  const cleaned = String(src || "").trim();
  if (!cleaned) {
    return defaultSocialImage;
  }
  if (/^https?:\/\//.test(cleaned)) {
    return cleaned;
  }

  return `${siteOrigin}/${cleaned.replace(/^\.?\//, "")}`;
}

function socialImageForRun(run) {
  return run.featureImage?.src
    ? absoluteAssetUrl(run.featureImage.src)
    : defaultSocialImage;
}

function socialImageAltForRun(run) {
  return run?.featureImage?.alt || featureImageAlt(run);
}

function featureImageAlt(run) {
  const winner = run.rankings?.[0];
  const winningJoke = run.jokes?.find((joke) => joke.id === winner?.jokeId);
  const title = winningJoke?.title ? ` titled ${winningJoke.title}` : "";

  return `Paperclipalypse winning joke feature image${title}: a paperclip stand-up comic and the winning joke scene.`;
}

function shortDate(value) {
  return shortPublicationDate(dateOnly(value));
}

function rssDate(value) {
  return new Date(`${dateOnly(value)}T12:00:00Z`).toUTCString();
}

function latestDate(runs) {
  return dateOnly(runs[0] || "2026-06-03");
}

function dateTime(value) {
  const raw = value && typeof value === "object"
    ? value.createdAt || value.publishedDate
    : value;
  if (raw && String(raw).includes("T")) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return `${dateOnly(value)}T12:00:00Z`;
}

function dateOnly(value) {
  if (value && typeof value === "object") {
    return normalizeDateOnly(value.publishedDate || value.createdAt || "2026-06-03");
  }

  return normalizeDateOnly(value || "2026-06-03");
}

function runUrl(run) {
  return `${siteOrigin}/runs/${run.slug}.html`;
}

function absoluteUrl(value = "/") {
  const cleaned = String(value || "/").trim();
  if (/^https?:\/\//.test(cleaned)) {
    return cleaned;
  }

  const pathname = cleaned.startsWith("/")
    ? cleaned
    : `/${cleaned.replace(/^\.?\//, "")}`;

  return `${siteOrigin}${pathname}`;
}

function renderSitemapImage(image) {
  if (!image?.loc) {
    return "";
  }

  return `
    <image:image>
      <image:loc>${escapeXml(image.loc)}</image:loc>
      ${image.title ? `<image:title>${escapeXml(image.title)}</image:title>` : ""}
      ${image.caption ? `<image:caption>${escapeXml(image.caption)}</image:caption>` : ""}
    </image:image>`;
}

function imageMimeType(src) {
  const extension = String(src || "").split("?")[0].split(".").pop()?.toLowerCase();
  if (extension === "png") {
    return "image/png";
  }
  if (extension === "webp") {
    return "image/webp";
  }
  if (extension === "gif") {
    return "image/gif";
  }

  return "image/jpeg";
}

function truncateSeo(value, maxLength = 160) {
  const text = cleanDisplayText(value);
  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, Math.max(0, maxLength - 3));
  const boundary = clipped.lastIndexOf(" ");
  const safeClip = boundary > 80 ? clipped.slice(0, boundary) : clipped;

  return `${safeClip.trim()}...`;
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values || []) {
    const text = cleanDisplayText(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(text);
  }

  return output;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function cleanDisplayText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanGeneratedText(value) {
  return `${value.replace(/[ \t]+$/gm, "").trim()}\n`;
}
