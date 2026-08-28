# Paperclipalypse

Paperclipalypse is an automated AI comedy tournament for
[paperclipalypse.com](https://paperclipalypse.com).

Each run:

1. Builds six random seed terms from local mirrored lists.
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
2. Codex prepares prompt packets using `npm run round:prepare -- --seed <seed>`
   and `prompts/external-ai-round.md`.
3. You or Codex, with explicit direction, collect responses from the contestants'
   normal chat surfaces. Codex must not invent missing external jokes or scores.
4. Codex writes the collected external responses to `data/inbox/`.
   Set `premise.displayText` to the intended published round title when
   assembling the episode JSON. If omitted, the runner falls back to the
   winning joke title.
5. It runs the tournament once with `--allow-missing-feature-image` to create
   the Gemini image brief.
6. It opens a fresh Chrome window for Google Gemini image generation, prompts
   the winning-joke feature image, verifies Gemini's generated preview is
   exactly 1024x506, and saves the PNG through Gemini's **Copy image** control
   and the browser clipboard bridge. It rejects/regenerates weak images until
   the image QA checklist passes. Do not use screenshots or Gemini's full-size
   export for this project.
7. It reruns with `--feature-image` and `--feature-image-qa-approved`.
8. The runner rejects incomplete participation or unapproved images before
   rendering.
9. GitHub Pages deploys the static site on push.

The one-instruction operating version is codified in
`prompts/one-prompt-full-contest.md`: Phil can ask Codex to run the contest from
beginning to end, and Codex coordinates the external web chats, Gemini image,
render, cleanup, commit, and push without using paid APIs. That instruction
also covers routine contestant and judging sends, repair prompts, Gemini image
regeneration, and preview saving. Codex stops only for a login or CAPTCHA, a
paid upgrade or API, unexpected terms, sensitive-data transmission, or an
unrecoverable external UI failure.

Operational lesson from live rounds: chat UIs are not APIs. If Gemini leaves a
prompt in the composer, `Control+Enter` often submits it when the visible send
button does not. Placeholder scorecards such as `{"jokeId":"id", ...}` must be
rejected and repaired by the original judge. For feature images, use Gemini's
**Copy image** control and the browser clipboard bridge to save the visible
1024x506 preview without a screenshot or full-size export.

Use `npm run image:prompt -- --brief data/image-briefs/<round>.md` before opening
Gemini. It validates the image brief and writes a plain-text prompt file under
`tmp/gemini-feature-images/`. Chrome browser automation must read that file
directly from disk into a variable with `node:fs/promises`; it must not navigate
to a `file://` URL, parse Markdown fences, or embed the multi-line prompt in a
JavaScript string. Image QA accepts only the exact 1024x506 Gemini preview,
which prevents browser screenshots and full-size exports from reaching the site.

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
- Claude (Sonnet 5 Medium from August 20, 2026): metered API; use manually
  through Claude free/subscription surfaces if available. Historical rounds retain
  their recorded Claude model names.
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

To score a real external/manual episode JSON and create the Gemini image brief:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<external-episode>.json --allow-missing-feature-image
```

For public non-dry-run episodes, the runner stops here if no approved feature
image is attached. It writes a Gemini-ready brief under `data/image-briefs/`
using the actual winner and winning joke.

To attach an approved winning-joke feature image during render:

```sh
node scripts/qa-feature-image.mjs --image tmp/gemini-feature-images/<round-slug>.jpg --approved
node scripts/run-tournament.mjs --episode-file data/inbox/<external-episode>.json --feature-image tmp/gemini-feature-images/<round-slug>.jpg --feature-image-qa-approved
```

The runner copies the image into `site/assets/feature-images/`, records it as
`featureImage`, renders it on the episode/home pages, and uses it as the social
preview image. The `--feature-image-qa-approved` flag should only be used after
Gemini's smaller generated preview has been saved or captured and passed visual
QA: polished composition, recognizable paperclip comic, useful winning-joke
scene, no visible prompt labels or watermarks, and no distracting text garbling.
Low-quality images should be rejected and regenerated.

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
must use exactly two seed-term concepts, no more and no fewer, so the
joke has a clear constraint without becoming a checklist. The joke must be told
as a first-person stand-up bit, with the comic speaking from the stage. The
prompts discourage seed stuffing, long explanations, detached story summaries,
and jokes that merely recite the prompt instead of building a real comic idea.

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
