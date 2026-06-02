# Paperclipalypse

Paperclipalypse is an automated AI comedy tournament for
[paperclipalypse.com](https://paperclipalypse.com).

Each run:

1. Builds a random premise from a place, a person/archetype, and an element.
2. Asks five configured AI contestants to write one clean joke.
3. Asks those same models to judge the jokes they did not write.
4. Aggregates rubric scores.
5. Publishes a static scoreboard and archive.

The first version is intentionally small: no dependencies, no database, and no
paid model APIs by default.

## Cost-Controlled Plan

Your normal Codex subscription is best used through the Codex app or CLI, not as
a hidden pool of free API calls inside GitHub Actions. GitHub Actions can deploy
the static site for free, but model generation in CI generally requires API-key
auth and can cost money.

So the default flow is:

1. A Codex app automation runs on your machine using your normal Codex access.
2. It follows `prompts/codex-house-tournament.md`.
3. It generates six seed terms locally from the mirrored lists in
   `data/seed-lists.json`.
4. It writes an episode JSON file under `data/inbox/`.
5. It runs `node scripts/run-tournament.mjs --episode-file data/inbox/<file>.json`.
6. It commits and pushes the generated `data/runs/` and `site/` changes.
7. GitHub Pages deploys the static site on push.

This produces a "Codex house tournament" rather than five independent external
models. That is the honest no-surprise-bill version. If you later want five
actual external models, `config/contestants.json` and the provider adapters are
still available as an opt-in paid API mode.

The current cost-aware external roster is:

- OpenAI GPT-5.4 Mini: metered API; use manually through Codex/ChatGPT for
  subscription-only hobby mode.
- Claude Sonnet 4.6: metered API; use manually through Claude free/subscription
  surfaces if available.
- Gemini Flash: free-tier eligible in the Gemini API, subject to Google's quota
  and data-use terms.
- xAI Grok 4.3: low-cost but metered API.
- Mistral Small: low-cost but metered API.

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
- `MISTRAL_API_KEY`

Optional repository variables can override the configured model names:

- `OPENAI_MODEL`
- `ANTHROPIC_MODEL`
- `GOOGLE_MODEL`
- `XAI_MODEL`
- `MISTRAL_MODEL`

GitHub Pages is deployed from the generated `site/` folder by
`.github/workflows/paperclipalypse.yml` whenever `main` changes. The
`site/CNAME` file points Pages at `paperclipalypse.com`; DNS still needs to be
configured with the domain host.

## Safety Posture

The default prompt pools use fictional or archetypal people rather than private
individuals. The Codex automation prompt also asks for humor that avoids hate,
harassment, sexual content, defamation, and recent tragedies. A stronger
moderation pass should be added before this runs unattended in public.
