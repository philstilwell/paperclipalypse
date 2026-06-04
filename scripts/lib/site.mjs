import fs from "node:fs";
import path from "node:path";
import { normalizePremiseForDisplay } from "./premise-display.mjs";
import { rubricForDisplay } from "./scoring.mjs";

const cloudflareAnalytics = `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "e6dc8afcaf3243dcbc00f4e43a7fa62e"}'></script><!-- End Cloudflare Web Analytics -->`;
const processPopoverLabel = [
  "How Paperclipalypse works.",
  "Codex picks six random seed terms.",
  "The same prompt goes to five AI contestants.",
  "Each contestant writes one short first-person stand-up joke using exactly two seed terms.",
  "Each contestant then scores the four jokes it did not write.",
  "Codex checks that nothing is missing and no contestant judged itself.",
  "The site averages the rubric scores and publishes the ranked results."
].join(" ");

export function renderSite({ run, historyDir, siteDir }) {
  fs.mkdirSync(siteDir, { recursive: true });
  fs.mkdirSync(path.join(siteDir, "runs"), { recursive: true });

  const runs = readRuns(historyDir);
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
  fs.writeFileSync(path.join(siteDir, "styles.css"), cleanGeneratedText(renderCss()), "utf8");
  fs.writeFileSync(path.join(siteDir, "404.html"), cleanGeneratedText(renderNotFound()), "utf8");
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
            <span>${escapeHtml(shortDate(archivedRun.createdAt))}</span>
            <strong>${escapeHtml(roundDisplayTitle(archivedRun))}</strong>
            <small>${escapeHtml(meta)}</small>
          </a>
        </li>`;
      }
    )
    .join("");

  return pageShell({
    title: "Paperclipalypse",
    socialImage: socialImageForRun(run),
    body: `
      ${renderHero(run)}
      ${renderRun(run, { showEpisodeHeader: false, showIntro: true })}
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
    title: "Paperclipalypse - About",
    description: "About Paperclipalypse, an AI humor tournament tracking how model humor improves over time.",
    canonicalPath: "/about.html",
    body: `
      ${renderTopnav({ homePath: "./index.html", aboutPath: "./about.html", label: "Origin Story" })}
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

function renderRunPage(run, publicRuns) {
  return pageShell({
    title: `Paperclipalypse - ${shortDate(run.createdAt)}`,
    stylesheetPath: "../styles.css",
    canonicalPath: `/runs/${run.slug}.html`,
    socialImage: socialImageForRun(run),
    body: `
      ${renderTopnav({ homePath: "../index.html", aboutPath: "../about.html", label: shortDate(run.createdAt) })}
      ${renderRun(run, {
        assetBase: "../",
        memoryNav: renderMemoryNav(run, publicRuns, "Memory Bank navigation"),
        memoryNavEnd: renderMemoryNav(run, publicRuns, "Memory Bank navigation end")
      })}`
  });
}

function renderTopnav({ homePath, aboutPath, label }) {
  return `
      <nav class="topnav">
        <a href="${escapeHtml(homePath)}" class="nav-brand"><span class="mini-mark" aria-hidden="true"></span>Paperclipalypse</a>
        <span class="topnav-links"><a href="${escapeHtml(aboutPath)}">About</a><span>${escapeHtml(label)}</span></span>
      </nav>`;
}

function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: https://paperclipalypse.com/sitemap.xml
`;
}

function renderSitemap(runs) {
  const urls = [
    { loc: "https://paperclipalypse.com/", lastmod: latestDate(runs) },
    { loc: "https://paperclipalypse.com/about.html", lastmod: latestDate(runs) },
    ...runs.map((run) => ({
      loc: `https://paperclipalypse.com/runs/${run.slug}.html`,
      lastmod: dateOnly(run.createdAt)
    }))
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${escapeXml(url.lastmod)}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>
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
            <img class="mark" src="./assets/paperclip-face-mark.png" alt="">
            <div class="brand-title">
              <p class="eyebrow">AI Comedy Tournament</p>
              <h1>Paperclipalypse</h1>
            </div>
            <a class="hero-about-link" href="./about.html">About</a>
          </div>
          <div class="hero-copy">
            <p class="episode-date">${escapeHtml(shortDate(run.createdAt))}</p>
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
          <td>${escapeHtml(ranking.label)}</td>
          <td>${formatScore(ranking.score)}</td>
          <td>${ranking.judgeCount}</td>
        </tr>`
    )
    .join("");

  const jokes = run.jokes
    .map((joke) => {
      const ranking = run.rankings.find((entry) => entry.jokeId === joke.id);
      const jokeText = fullJokeText(joke);
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
          <p class="standalone-joke">${escapeHtml(jokeText)}</p>
          <ul>${comments}</ul>
        </article>`;
    })
    .join("");
  const rubric = run.rubric ? renderRubric(run.rubric) : "";

  return `
    <main>
      ${showIntro ? renderIntro() : ""}
      ${showEpisodeHeader ? renderEpisodeHeader(run, winner) : ""}${memoryNav}
      ${renderFeatureImage(run, assetBase)}
      ${renderSeedTerms(run.seedTerms)}
      <section class="scoreboard">
        <div class="section-heading">
          <p class="eyebrow">Judgment Matrix</p>
          <h2>Scoreboard ${renderProcessPopover()} ${renderJudgingPromptPopover(run)}</h2>
        </div>
        <div class="table-scroll">
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
        </div>
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
    shortDate(targetRun.createdAt),
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
        </figure>
      </section>`;
}

function renderIntro() {
  return `
      <section class="intro-panel" aria-label="What this site is">
        <p class="eyebrow">What This Is</p>
        <p>Five AI models get the same six seed terms, write one short joke, then judge each other's jokes. Codex checks the round and publishes the results here.</p>
        <p class="ai-process-note"><strong>AI process note:</strong> Codex orchestrates most of this site: prompts, contest assembly, score checks, static-page generation, and publishing. The other AIs serve as contestants and judges, and Codex prompts Gemini to create the featured image for each winning joke.</p>
      </section>`;
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
          <p class="eyebrow">${escapeHtml(shortDate(run.createdAt))}</p>
          <h2>${escapeHtml(roundDisplayTitle(run))}</h2>
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
          <h2>Seed Terms <span class="rule-popover" tabindex="0" aria-label="Contestants must use exactly two seed terms.">2-term rule<span class="info-popover">Each contestant must pick exactly two seed terms for the joke. The other four are deliberately ignored so the joke stays natural.</span></span></h2>
        </div>
        <ul>${terms}</ul>
      </section>`;
}

function renderProcessPopover() {
  return `<span class="process-popover" tabindex="0" aria-label="${escapeHtml(processPopoverLabel)}">Process<span class="info-popover process-info"><strong>How it works</strong><span>1. Codex picks six random seed terms.</span><span>2. The same prompt goes to five AI contestants.</span><span>3. Each contestant writes one short first-person stand-up joke using exactly two seed terms.</span><span>4. Each contestant scores the four jokes it did not write.</span><span>5. Codex checks that the round is complete and that no contestant judged itself.</span><span>6. The site averages the rubric scores and publishes the ranking.</span></span></span>`;
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
- Use exactly two seed terms in the joke text, no more and no fewer.
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
  terms in the joke text.

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
  const normalized = normalizePremiseForDisplay(run.premise, run.seedTerms);
  return normalized.displayText || cleanDisplayText(run.premise?.text) || run.slug || "Untitled round";
}

function rubricDisplayText(value) {
  return cleanDisplayText(value)
    .replace(/\bpremise recital\b/gi, "prompt recital")
    .replace(/\bpremise recitation\b/gi, "prompt recitation")
    .replace(/\bthe premise is odd\b/gi, "the seed list is odd")
    .replace(/\bthe premise or turn\b/gi, "the comic idea or turn");
}

function pageShell({
  title,
  body,
  stylesheetPath = "./styles.css",
  canonicalPath = "/",
  description = "Paperclipalypse is an AI comedy tournament where five models write jokes from the same six seed terms and judge each other.",
  socialImage = "https://paperclipalypse.com/assets/paperclipalypse-avalanche.webp"
}) {
  const faviconPath = stylesheetPath.startsWith("../") ? "../favicon.png" : "./favicon.png";
  const aboutPath = stylesheetPath.startsWith("../") ? "../about.html" : "./about.html";
  const canonicalUrl = `https://paperclipalypse.com${canonicalPath}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <meta property="og:image" content="${escapeHtml(socialImage)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(socialImage)}">
    <link rel="icon" href="${escapeHtml(faviconPath)}" type="image/png">
    <link rel="stylesheet" href="${escapeHtml(stylesheetPath)}">
  </head>
  <body>
    ${body}
    ${renderFooter({ aboutPath })}
    ${cloudflareAnalytics}
  </body>
</html>`;
}

function renderFooter({ aboutPath }) {
  return `
    <footer class="site-footer">
      <span>Paperclipalypse is an experimental AI humor tournament.</span>
      <span><a href="${escapeHtml(aboutPath)}">About</a> / Traffic is measured with Cloudflare Web Analytics.</span>
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

.intro-panel p:last-child {
  max-width: 820px;
  color: var(--ink);
  font-size: 1.08rem;
  font-weight: 800;
  line-height: 1.5;
  margin: 0;
}

.intro-panel .ai-process-note,
.ai-process-account {
  border: 1px solid rgba(194, 138, 87, 0.28);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(194, 138, 87, 0.11), transparent 64%),
    rgba(12, 13, 15, 0.72);
}

.intro-panel .ai-process-note {
  max-width: 940px;
  color: var(--muted);
  font-size: 0.98rem;
  font-weight: 800;
  line-height: 1.55;
  margin: 14px 0 0;
  padding: 14px;
}

.intro-panel .ai-process-note strong {
  color: var(--bone);
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
  align-items: center;
  font-weight: 850;
}

.table-scroll {
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

.joke-card ul {
  margin: auto 0 0;
  padding-left: 18px;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.38;
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

  .joke-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

  h1 {
    font-size: 2rem;
    line-height: 1;
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

@media (max-width: 380px) {
  h1 {
    font-size: 1.72rem;
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
    return "A real external-model round: Codex prepared the prompts and page, while the jokes and scorecards were collected from the contestants' normal chat surfaces.";
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
    return "https://paperclipalypse.com/assets/paperclipalypse-avalanche.webp";
  }
  if (/^https?:\/\//.test(cleaned)) {
    return cleaned;
  }

  return `https://paperclipalypse.com/${cleaned.replace(/^\.?\//, "")}`;
}

function socialImageForRun(run) {
  return run.featureImage?.src
    ? absoluteAssetUrl(run.featureImage.src)
    : "https://paperclipalypse.com/assets/paperclipalypse-avalanche.webp";
}

function featureImageAlt(run) {
  const winner = run.rankings?.[0];
  const winningJoke = run.jokes?.find((joke) => joke.id === winner?.jokeId);
  const title = winningJoke?.title ? ` titled ${winningJoke.title}` : "";

  return `Paperclipalypse winning joke feature image${title}: a paperclip stand-up comic, joke text, and the joke scene.`;
}

function shortDate(value) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function latestDate(runs) {
  return dateOnly(runs[0]?.createdAt || "2026-06-03T00:00:00.000Z");
}

function dateOnly(value) {
  return String(value || "").slice(0, 10) || "2026-06-03";
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
