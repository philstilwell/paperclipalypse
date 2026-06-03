import fs from "node:fs";
import path from "node:path";

export function renderSite({ run, historyDir, siteDir }) {
  fs.mkdirSync(siteDir, { recursive: true });
  fs.mkdirSync(path.join(siteDir, "runs"), { recursive: true });

  const runs = readRuns(historyDir);
  for (const archivedRun of runs) {
    fs.writeFileSync(
      path.join(siteDir, "runs", `${archivedRun.slug}.html`),
      cleanGeneratedText(renderRunPage(archivedRun)),
      "utf8"
    );
  }

  fs.writeFileSync(path.join(siteDir, "index.html"), cleanGeneratedText(renderHome(run, runs)), "utf8");
  fs.writeFileSync(path.join(siteDir, "styles.css"), cleanGeneratedText(renderCss()), "utf8");
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
  const archive = publicRuns
    .slice(0, 12)
    .map(
      (archivedRun) => `
        <li>
          <a href="./runs/${escapeHtml(archivedRun.slug)}.html">
            <span>${escapeHtml(shortDate(archivedRun.createdAt))}</span>
            <strong>${escapeHtml(archivedRun.premise.text)}</strong>
          </a>
        </li>`
    )
    .join("");

  return pageShell({
    title: "Paperclipalypse",
    body: `
      ${renderHero(run)}
      ${renderRun(run, { showEpisodeHeader: false })}
      <section class="archive">
        <div class="section-heading">
          <p class="eyebrow">Memory Bank</p>
          <h2>Recent Episodes</h2>
        </div>
        <ol>${archive}</ol>
      </section>`
  });
}

function renderRunPage(run) {
  return pageShell({
    title: `Paperclipalypse - ${shortDate(run.createdAt)}`,
    stylesheetPath: "../styles.css",
    body: `
      <nav class="topnav">
        <a href="../index.html" class="nav-brand"><span class="mini-mark" aria-hidden="true"></span>Paperclipalypse</a>
        <span>${escapeHtml(shortDate(run.createdAt))}</span>
      </nav>
      ${renderRun(run)}`
  });
}

function renderHero(run) {
  const winner = run.rankings[0];

  return `
      <header class="hero">
        <img class="hero-backdrop" src="./assets/paperclipalypse-avalanche.webp" alt="">
        <div class="hero-shade"></div>
        <div class="hero-inner">
          <div class="brand-row">
            <div class="mark" aria-hidden="true"><span></span></div>
            <div>
              <p class="eyebrow">AI Comedy Tournament</p>
              <h1>Paperclipalypse</h1>
            </div>
          </div>
          <div class="hero-copy">
            <p class="episode-date">${escapeHtml(shortDate(run.createdAt))}</p>
            <h2>${escapeHtml(run.premise.text)}</h2>
            <p class="lede">Five models enter the valley. One joke escapes the avalanche.</p>
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
              <dd>${escapeHtml(formatMode(run.source))}</dd>
            </div>
          </dl>
        </div>
      </header>`;
}

function renderRun(run, options = {}) {
  const showEpisodeHeader = options.showEpisodeHeader ?? true;
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
      ${showEpisodeHeader ? renderEpisodeHeader(run, winner) : ""}
      ${renderSeedTerms(run.seedTerms)}
      <section class="scoreboard">
        <div class="section-heading">
          <p class="eyebrow">Judgment Matrix</p>
          <h2>Scoreboard</h2>
        </div>
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
        <div class="section-heading">
          <p class="eyebrow">Contestant Output</p>
          <h2>Jokes</h2>
        </div>
        <div class="joke-grid">${jokes}</div>
      </section>
      <section class="comic-brief">
        <div class="section-heading">
          <p class="eyebrow">Image Prompt</p>
          <h2>Comic Brief</h2>
        </div>
        <p>${escapeHtml(run.comicPanelPrompt)}</p>
      </section>
    </main>`;
}

function renderEpisodeHeader(run, winner) {
  return `
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
      </section>`;
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
        <div class="section-heading">
          <p class="eyebrow">Prompt Genome</p>
          <h2>Seed Terms</h2>
        </div>
        <ul>${terms}</ul>
      </section>`;
}

function pageShell({ title, body, stylesheetPath = "./styles.css" }) {
  const faviconPath = stylesheetPath.startsWith("../") ? "../favicon.svg" : "./favicon.svg";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="Paperclipalypse is an AI comedy tournament where models generate jokes from random seed terms and judge each other.">
    <link rel="icon" href="${escapeHtml(faviconPath)}" type="image/svg+xml">
    <link rel="stylesheet" href="${escapeHtml(stylesheetPath)}">
  </head>
  <body>
    ${body}
  </body>
</html>`;
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

.brand-row > div:last-child {
  flex: 1;
  min-width: 0;
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

.mini-mark {
  width: 22px;
  height: 22px;
  border: 1px solid rgba(95, 101, 108, 0.72);
  border-radius: 6px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.07), rgba(0, 0, 0, 0.18)),
    #0b0c0e;
  box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.04);
  position: relative;
}

.mini-mark::before {
  content: "";
  position: absolute;
  width: 10px;
  height: 15px;
  left: 6px;
  top: 3px;
  border: 2px solid #30343a;
  border-left-color: transparent;
  border-radius: 10px;
  transform: rotate(-24deg);
  box-shadow:
    1px 1px 0 #0f1114,
    inset 1px 1px 0 rgba(184, 190, 196, 0.34);
}

.mark {
  width: 78px;
  height: 78px;
  border: 1px solid rgba(99, 105, 112, 0.64);
  border-radius: 8px;
  background:
    radial-gradient(circle at 34% 24%, rgba(255, 255, 255, 0.08), transparent 34%),
    linear-gradient(145deg, rgba(23, 25, 29, 0.95), rgba(4, 5, 6, 0.96));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.035),
    inset 0 -16px 28px rgba(0, 0, 0, 0.34),
    0 18px 48px rgba(0, 0, 0, 0.42);
  position: relative;
  flex: 0 0 auto;
}

.mark::before,
.mark::after,
.mark span {
  content: "";
  position: absolute;
}

.mark::before {
  width: 32px;
  height: 50px;
  left: 23px;
  top: 13px;
  border: 6px solid #2e3339;
  border-left-color: transparent;
  border-radius: 26px;
  transform: rotate(-28deg);
  box-shadow:
    2px 3px 0 #0d0f12,
    inset 2px 2px 0 rgba(168, 174, 181, 0.36),
    inset -2px -2px 0 rgba(0, 0, 0, 0.42);
}

.mark::after {
  width: 17px;
  height: 30px;
  left: 34px;
  top: 24px;
  border: 4px solid #111317;
  border-left-color: transparent;
  border-radius: 17px;
  transform: rotate(-28deg);
  box-shadow:
    inset 1px 1px 0 rgba(126, 134, 142, 0.28),
    1px 1px 0 rgba(100, 106, 114, 0.38);
}

.mark span {
  width: 18px;
  height: 4px;
  left: 27px;
  top: 29px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(190, 197, 204, 0.62), rgba(75, 81, 88, 0.12));
  transform: rotate(-28deg);
  opacity: 0.72;
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
  overflow-wrap: anywhere;
  text-shadow:
    0 2px 0 rgba(0, 0, 0, 0.74),
    0 0 32px rgba(255, 48, 72, 0.22);
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
.jokes,
.comic-brief,
.archive {
  padding: 32px 0 0;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin-bottom: 14px;
}

.section-heading h2 {
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
  align-items: center;
  font-weight: 850;
}

.scoreboard {
  overflow-x: auto;
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

.joke-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
  gap: 16px;
}

.joke-card {
  min-height: 330px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 48, 72, 0.075), transparent 34%),
    linear-gradient(135deg, rgba(194, 138, 87, 0.08), transparent 40%),
    var(--panel-strong);
  box-shadow: var(--shadow);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.joke-meta {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  color: var(--muted);
  font-size: 0.85rem;
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
  font-size: 1.35rem;
  margin-bottom: 0;
}

.joke-card p {
  color: var(--muted);
  line-height: 1.55;
  margin-bottom: 0;
}

.punchline {
  color: var(--ink) !important;
  font-weight: 900;
}

.joke-card ul {
  margin: auto 0 0;
  padding-left: 18px;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.45;
}

.comic-brief p,
.archive ol {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
  padding: 18px;
}

.comic-brief p {
  color: var(--muted);
  line-height: 1.6;
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

@media (max-width: 920px) {
  h1 {
    font-size: 4.1rem;
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

  h1 {
    font-size: 2.35rem;
    line-height: 0.96;
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
  .archive a {
    grid-template-columns: 1fr;
  }

  .seed-terms ul {
    grid-template-columns: 1fr;
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
  return source || "Tournament";
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

function cleanGeneratedText(value) {
  return `${value.replace(/[ \t]+$/gm, "").trim()}\n`;
}
