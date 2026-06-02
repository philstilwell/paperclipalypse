import fs from "node:fs";
import path from "node:path";

export function renderSite({ run, historyDir, siteDir }) {
  fs.mkdirSync(siteDir, { recursive: true });
  fs.mkdirSync(path.join(siteDir, "runs"), { recursive: true });

  const runs = readRuns(historyDir);
  for (const archivedRun of runs) {
    fs.writeFileSync(
      path.join(siteDir, "runs", `${archivedRun.slug}.html`),
      renderRunPage(archivedRun),
      "utf8"
    );
  }

  fs.writeFileSync(path.join(siteDir, "index.html"), renderHome(run, runs), "utf8");
  fs.writeFileSync(path.join(siteDir, "styles.css"), renderCss(), "utf8");
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
  const archive = runs
    .slice(0, 12)
    .map(
      (archivedRun) => `
        <li>
          <a href="./runs/${escapeHtml(archivedRun.slug)}.html">
            ${escapeHtml(shortDate(archivedRun.createdAt))}: ${escapeHtml(archivedRun.premise.text)}
          </a>
        </li>`
    )
    .join("");

  return pageShell({
    title: "Paperclipalypse",
    body: `
      <section class="masthead">
        <div class="brand-lockup">
          <div class="mark" aria-hidden="true"><span></span></div>
          <div>
            <p class="eyebrow">AI Comedy Tournament</p>
            <h1>Paperclipalypse</h1>
          </div>
        </div>
        <p class="lede">Five contestants enter. One joke survives the spreadsheet.</p>
      </section>
      ${renderRun(run)}
      <section class="archive">
        <h2>Recent Episodes</h2>
        <ol>${archive}</ol>
      </section>`
  });
}

function renderRunPage(run) {
  return pageShell({
    title: `Paperclipalypse - ${shortDate(run.createdAt)}`,
    stylesheetPath: "../styles.css",
    body: `
      <nav class="topnav"><a href="../index.html">Paperclipalypse</a></nav>
      ${renderRun(run)}`
  });
}

function renderRun(run) {
  const winner = run.rankings[0];
  const rankingRows = run.rankings
    .map(
      (ranking) => `
        <tr>
          <td>${ranking.rank}</td>
          <td>${escapeHtml(ranking.contestantName)}</td>
          <td>${escapeHtml(ranking.label)}</td>
          <td>${formatScore(ranking.score)}</td>
          <td>${ranking.judgeCount}</td>
        </tr>`
    )
    .join("");

  const jokes = run.jokes
    .map((joke) => {
      const ranking = run.rankings.find((entry) => entry.jokeId === joke.id);
      const comments = ranking.comments
        .slice(0, 2)
        .map(
          (comment) => `<li>${escapeHtml(comment.judgeName)}: ${escapeHtml(comment.comment)}</li>`
        )
        .join("");

      return `
        <article class="joke-card">
          <div class="joke-meta">
            <span>${escapeHtml(joke.label)}</span>
            <strong>${escapeHtml(joke.contestantName)}</strong>
            <span>${formatScore(ranking.score)}</span>
          </div>
          <h3>${escapeHtml(joke.title)}</h3>
          <p>${escapeHtml(joke.setup)}</p>
          <p class="punchline">${escapeHtml(joke.punchline)}</p>
          <ul>${comments}</ul>
        </article>`;
    })
    .join("");

  return `
    <main>
      <section class="episode">
        <div>
          <p class="eyebrow">${escapeHtml(shortDate(run.createdAt))}</p>
          <h2>${escapeHtml(run.premise.text)}</h2>
        </div>
        <aside>
          <span>Winner</span>
          <strong>${escapeHtml(winner.contestantName)}</strong>
          <em>${formatScore(winner.score)}</em>
        </aside>
      </section>
      ${renderSeedTerms(run.seedTerms)}
      <section class="scoreboard">
        <h2>Scoreboard</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Contestant</th>
              <th>Joke</th>
              <th>Score</th>
              <th>Judges</th>
            </tr>
          </thead>
          <tbody>${rankingRows}</tbody>
        </table>
      </section>
      <section class="jokes">
        <h2>Jokes</h2>
        <div class="joke-grid">${jokes}</div>
      </section>
      <section class="comic-brief">
        <h2>Comic Brief</h2>
        <p>${escapeHtml(run.comicPanelPrompt)}</p>
      </section>
    </main>`;
}

function renderSeedTerms(seedTerms) {
  if (!Array.isArray(seedTerms) || !seedTerms.length) {
    return "";
  }

  const terms = seedTerms
    .map((term) => `<li>${escapeHtml(term)}</li>`)
    .join("");

  return `
      <section class="seed-terms">
        <h2>Seed Terms</h2>
        <ul>${terms}</ul>
      </section>`;
}

function pageShell({ title, body, stylesheetPath = "./styles.css" }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${escapeHtml(stylesheetPath)}">
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function renderCss() {
  return `:root {
  color-scheme: light;
  --ink: #15171a;
  --muted: #5d6570;
  --paper: #f7f7f2;
  --panel: #ffffff;
  --line: #d8d9d2;
  --teal: #2f7d8c;
  --red: #d34f3f;
  --gold: #edbd3b;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

a {
  color: inherit;
}

.masthead,
main,
.topnav {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
}

.masthead {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  border-bottom: 3px solid var(--ink);
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 20px;
}

.mark {
  width: 76px;
  height: 76px;
  border: 4px solid var(--ink);
  border-radius: 8px;
  background:
    linear-gradient(135deg, transparent 52%, var(--gold) 52% 62%, transparent 62%),
    var(--panel);
  position: relative;
}

.mark span {
  position: absolute;
  inset: 16px 22px;
  border: 5px solid var(--teal);
  border-left-color: transparent;
  border-radius: 22px;
  transform: rotate(-25deg);
}

.eyebrow {
  color: var(--red);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
  margin: 0 0 8px;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  font-size: clamp(2.5rem, 8vw, 5.8rem);
  line-height: 0.92;
  margin-bottom: 0;
}

.lede {
  max-width: 340px;
  font-size: 1.2rem;
  color: var(--muted);
}

main {
  padding: 28px 0 56px;
}

.topnav {
  padding: 24px 0;
  font-weight: 800;
}

.episode {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 24px;
  align-items: stretch;
  border-bottom: 1px solid var(--line);
  padding-bottom: 24px;
}

.episode h2 {
  font-size: clamp(1.7rem, 4vw, 3.5rem);
  line-height: 1;
  max-width: 850px;
}

.episode aside {
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: var(--panel);
  padding: 18px;
  display: grid;
  align-content: center;
  gap: 8px;
}

.episode aside span {
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
}

.episode aside strong {
  font-size: 1.8rem;
}

.episode aside em {
  color: var(--teal);
  font-size: 1.5rem;
  font-style: normal;
  font-weight: 900;
}

.seed-terms,
.scoreboard,
.jokes,
.comic-brief,
.archive {
  padding: 30px 0 0;
}

.seed-terms ul {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 0;
}

.seed-terms li {
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--panel);
  padding: 8px 12px;
  font-weight: 800;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel);
  border: 2px solid var(--ink);
  border-radius: 8px;
  overflow: hidden;
}

th,
td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid var(--line);
}

th {
  background: var(--ink);
  color: #fff;
  font-size: 0.8rem;
  text-transform: uppercase;
}

.joke-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.joke-card {
  min-height: 280px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: var(--panel);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.joke-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
  font-size: 0.85rem;
}

.joke-card h3 {
  color: var(--teal);
  margin-bottom: 0;
}

.punchline {
  font-weight: 800;
}

.joke-card ul {
  margin: auto 0 0;
  padding-left: 18px;
  color: var(--muted);
  font-size: 0.9rem;
}

.comic-brief p,
.archive ol {
  border-left: 5px solid var(--gold);
  background: var(--panel);
  padding: 18px;
}

.archive {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto 56px;
}

.archive li + li {
  margin-top: 10px;
}

@media (max-width: 760px) {
  .masthead,
  .brand-lockup,
  .episode {
    display: block;
  }

  .mark {
    margin-bottom: 18px;
  }

  .lede {
    margin-top: 16px;
  }

  .episode aside {
    margin-top: 18px;
  }

  table {
    font-size: 0.88rem;
  }

  th,
  td {
    padding: 10px 8px;
  }
}
`;
}

function formatScore(score) {
  return Number(score).toFixed(1);
}

function shortDate(value) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
