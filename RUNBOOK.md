# Paperclipalypse Runbook

Use this when publishing a real public round.

## Real External Round

1. Generate or choose six seed terms from `data/seed-lists.json`.
2. Prepare the joke prompt from `prompts/external-ai-round.md`.
3. Collect one joke from each contestant: ChatGPT/OpenAI, Claude, Gemini, Grok, and Copilot.
4. Prepare the judging prompt for each contestant, omitting that contestant's own joke.
5. Collect one complete scorecard from each contestant.
6. Put the collected data in `data/inbox/<round-name>.json` with `source` set to `manual-external`.
   Include `premise.displayText` when you want an editorial round title;
   otherwise the runner will publish the winning joke title.
7. Open a fresh Chrome window for Gemini image generation, then generate and
   approve a winning-joke feature image after scoring. Save or capture Gemini's
   smaller 1024x506 generated preview. Prefer the browser media-download action
   on the visible generated image element when available; this avoids native
   save dialogs and still captures the preview. Never use the full-size export
   for this project. Pass the approved preview file with `--feature-image`.
8. Run:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<round-name>.json --seed <round-name>
```

9. Review the generated `site/index.html`, latest `site/runs/*.html`, and `data/runs/*.json`.
10. Commit and push when the result is ready.

To attach a newly approved image while rendering:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<round-name>.json --seed <round-name> --feature-image tmp/gemini-feature-images/<round-slug>.jpg --feature-image-qa-approved
```

The runner copies that image into `site/assets/feature-images/<slug>.<ext>` and
records it as the episode's `featureImage`.

## External Chat Troubleshooting

- If Gemini or another chat surface leaves a prompt sitting in the composer
  after the send button is clicked, focus the composer and try `Control+Enter`.
- Treat template echoes as failures. For example, a scorecard that returns only
  `{"jokeId":"id", ...}` has not judged the round.
- Repair bad scorecards with a shorter correction prompt that names the exact
  four `jokeId` values the judge must score.
- Do not proceed until all five judges have exactly four scores and no
  self-score.
- For Gemini images, look for the visible 1024x506 generated image preview. The
  browser media-download action on that image is preferred over full-size export
  or native save dialogs.
- Gemini may truncate tiny incidental text such as a small stage sign. That can
  pass visual QA when the main joke panel is legible, the composition is strong,
  and the error is not distracting.

## Publish Checks

The runner blocks publication when:

- there are not exactly five contestants
- any contestant is missing a joke
- any contestant is missing a scorecard
- a contestant judges its own joke
- a scorecard omits another contestant
- a joke is not first-person stand-up
- a joke does not use exactly two seed-term concepts
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
- Confirm the feature image came from Gemini's 1024x506 preview, not the full-size export.
- Confirm the `Process`, `Mode`, and rubric popovers work by hover and keyboard focus.
- Confirm the Cloudflare analytics snippet appears once per generated HTML page.
- Keep the public language honest: manual external rounds use real chat-surface outputs, not fully autonomous provider APIs.
