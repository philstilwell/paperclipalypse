# Paperclipalypse

Paperclipalypse is an automated AI comedy tournament for
[paperclipalypse.com](https://paperclipalypse.com).

Each run:

1. Builds a random premise from a place, a person/archetype, and an element.
2. Asks five configured AI contestants to write one clean first-person
   stand-up joke.
3. Asks those same models to judge the jokes they did not write.
4. Aggregates strict weighted rubric scores.
5. Publishes a static scoreboard and archive.

The first version is intentionally small: no dependencies, no database, and no
paid model APIs by default.

## Cost-Controlled Plan

Your normal Codex subscription is best used through the Codex app or CLI, not as
a hidden pool of free API calls inside GitHub Actions. GitHub Actions can deploy
the static site for free, but model generation in CI generally requires API-key
auth and can cost money.

So the preferred real-tournament flow is:

1. Codex generates six seed terms locally from `data/seed-lists.json`.
2. Codex prepares prompt packets using `prompts/external-ai-round.md`.
3. You or Codex, with explicit direction, collect responses from the contestants'
   normal chat surfaces. Codex must not invent missing external jokes or scores.
4. Codex writes the collected external responses to `data/inbox/`.
5. It runs `node scripts/run-tournament.mjs --episode-file data/inbox/<file>.json`.
6. The runner rejects incomplete participation before rendering.
7. GitHub Pages deploys the static site on push.

The local demo flow is:

1. A Codex app automation runs on your machine using your normal Codex access.
2. It follows `prompts/codex-house-tournament.md`.
3. It generates six seed terms locally from the mirrored lists in
   `data/seed-lists.json`.
4. It writes an episode JSON file under `data/inbox/`.
5. It runs `node scripts/run-tournament.mjs --episode-file data/inbox/<file>.json`.
6. It commits and pushes the generated `data/runs/` and `site/` changes.
7. GitHub Pages deploys the static site on push.

This produces a "Codex house tournament" rather than five independent external
models. It is for demos and smoke tests, not the main claim of the site. Real
external rounds should use `manual-external` episodes assembled from actual
contestant outputs, or the opt-in paid API mode if you deliberately enable it.

The current cost-aware external roster is:

- OpenAI GPT-5.4 Mini: metered API; use manually through Codex/ChatGPT for
  subscription-only hobby mode.
- Claude Sonnet 4.6: metered API; use manually through Claude free/subscription
  surfaces if available.
- Gemini Flash: free-tier eligible in the Gemini API, subject to Google's quota
  and data-use terms.
- xAI Grok 4.3: low-cost but metered API.
- Copilot: manual web contestant; no API automation is configured.

`config/cost-policy.json` is the guardrail: no metered external API calls unless
`PAPERCLIPALYPSE_ALLOW_PAID_API=1` is set locally.

## Local Run

```sh
npm run tournament:dry-run
```

That produces a mock episode under `data/runs/` and updates `site/`.

To publish a Codex-generated episode JSON:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/codex-episode.json
```

To score a real external/manual episode JSON and create the OpenAI image brief:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<external-episode>.json
```

For public non-dry-run episodes, the runner stops here if no approved feature
image is attached. It writes an OpenAI-ready brief under `data/image-briefs/`
using the actual winner and winning joke.

To attach an approved winning-joke feature image during render:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<external-episode>.json --feature-image /path/to/approved-image.webp
```

The runner copies the image into `site/assets/feature-images/`, records it as
`featureImage`, renders it on the episode/home pages, and uses it as the social
preview image.

Use `--allow-missing-feature-image` only for diagnostics. A ready public episode
should include the approved winning-joke image.

The runner now performs hard participation checks. A round must have exactly
five contestants, exactly one joke from each contestant, and exactly one
scorecard from each contestant. Every scorecard must assess the four jokes that
contestant did not write, exactly once each.

Public non-dry-run episodes also pass a quality gate before rendering: the
winner must score at least 6.0, the average joke score must be at least 5.0,
and every joke must have the expected four judges. Set
`PAPERCLIPALYPSE_ALLOW_LOW_QUALITY=1` only when intentionally publishing a weak
or diagnostic round.

## Joke And Judging Standard

The six seed terms are ingredients, not checklist requirements. Each contestant
must use exactly two seed terms in the joke text, no more and no fewer, so the
joke has a clear constraint without becoming a checklist. The joke must be told
as a first-person stand-up bit, with the comic speaking from the stage. The
prompts discourage seed stuffing, long explanations, detached story summaries,
and jokes that merely describe a strange premise.

The runner records the declared seed terms but does not rewrite or disqualify
otherwise complete jokes for prompt mistakes. If a contestant misses, paraphrases,
or leaks seed terms, the episode can still be published, but judges are
instructed to penalize prompt fit sharply.

Scoring uses `2026-06-strict-standup-v4`, a fixed scale intended to
remain useful as model humor improves:

- `laugh` 40%: likely human laughter, not just cleverness.
- `surprise` 20%: an unexpected but satisfying turn.
- `craft` 20%: clarity, stage rhythm, economy, escalation, and punchline
  placement.
- `originality` 10%: fresh angle, image, and wording.
- `promptFit` 10%: first-person stand-up form and natural use of exactly two
  seed terms without checklist writing.

Score anchors are deliberately stern: 5 is competent but forgettable, 6 is a
mild real joke, 7 is genuinely good, 8 requires a strong human-level turn, 9 is
rare, and 10 should almost never appear.

## Seed Terms

The canonical runtime seed source is:

- Local mirror: `data/seed-lists.json`
- Runtime categories: genre, occupation, location, conflict, positive trait,
  negative trait

The Google Sheet remains the refresh source:

- Spreadsheet: `paperclipalypse ideas`
- Tab: `Ideas`
- Randomized display range: `A2:A7`
- Source-list range mirrored locally: `B1:G1000`
- Config: `config/seed-source.json`

Codex does not need the sheet open in a browser. To avoid Sheets API quota
limits, normal episode generation should use the local mirror. Use the Google
Sheets connector only when refreshing `data/seed-lists.json` from the source
sheet.

For optional live model API calls, copy `.env.example` to `.env`, fill in
provider keys, set `PAPERCLIPALYPSE_ALLOW_PAID_API=1`, and run:

```sh
npm run tournament
```

## GitHub Setup

No provider secrets are required for the default Pages deployment.

Only add these repository secrets if you intentionally enable paid API mode:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `XAI_API_KEY`

Optional repository variables can override the configured model names:

- `OPENAI_MODEL`
- `ANTHROPIC_MODEL`
- `GOOGLE_MODEL`
- `XAI_MODEL`

GitHub Pages is deployed from the generated `site/` folder by
`.github/workflows/paperclipalypse.yml` whenever `main` changes. The
`site/CNAME` file points Pages at `paperclipalypse.com`; DNS still needs to be
configured with the domain host.

## Safety Posture

The default prompt pools use fictional or archetypal people rather than private
individuals. The Codex automation prompt also asks for humor that avoids hate,
harassment, sexual content, defamation, and recent tragedies. A stronger
moderation pass should be added before this runs unattended in public.

The public site uses Cloudflare Web Analytics to measure traffic.
