# Paperclipalypse Runbook

Use this when publishing a real public round.

## Real External Round

1. Generate or choose six seed terms from `data/seed-lists.json`.
2. Prepare the joke prompt from `prompts/external-ai-round.md`.
3. Collect one joke from each contestant: ChatGPT/OpenAI, Claude, Gemini, Grok, and Copilot.
4. Prepare the judging prompt for each contestant, omitting that contestant's own joke.
5. Collect one complete scorecard from each contestant.
6. Put the collected data in `data/inbox/<round-name>.json` with `source` set to `manual-external`.
7. Generate and approve a 2:1 winning-joke feature image after scoring. Store
   the approved asset under `site/assets/feature-images/` and add a
   `featureImage` object to the episode JSON, or pass it with
   `--feature-image`.
8. Run:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<round-name>.json --seed <round-name>
```

9. Review the generated `site/index.html`, latest `site/runs/*.html`, and `data/runs/*.json`.
10. Commit and push when the result is ready.

To attach a newly approved image while rendering:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<round-name>.json --seed <round-name> --feature-image /path/to/approved-image.webp
```

The runner copies that image into `site/assets/feature-images/<slug>.<ext>` and
records it as the episode's `featureImage`.

## Publish Checks

The runner blocks publication when:

- there are not exactly five contestants
- any contestant is missing a joke
- any contestant is missing a scorecard
- a contestant judges its own joke
- a scorecard omits another contestant
- a joke is not first-person stand-up
- a joke does not use exactly two seed terms
- the winner scores below 6.0
- the average joke score is below 5.0
- any joke has fewer than four judges

Use `PAPERCLIPALYPSE_ALLOW_LOW_QUALITY=1` only for an intentionally weak or diagnostic public round.

## Cost Guardrails

The default workflow is manual/subscription-based and should not call paid model APIs.

Do not add API keys to GitHub Actions for normal operation. Only run `npm run tournament` with real provider keys after deliberately setting `PAPERCLIPALYPSE_ALLOW_PAID_API=1`.

## Before Sharing Widely

- Check the page on desktop and mobile widths.
- Confirm the winning-joke feature image loads and keeps its 2:1 crop.
- Confirm the `Process`, `Mode`, and rubric popovers work by hover and keyboard focus.
- Confirm the Cloudflare analytics snippet appears once per generated HTML page.
- Keep the public language honest: manual external rounds use real chat-surface outputs, not fully autonomous provider APIs.
