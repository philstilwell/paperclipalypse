# Paperclipalypse Runbook

Use this when publishing a real public round.

## One-Prompt Authorization

A user instruction to run a Paperclipalypse contest from beginning to end
authorizes the routine external workflow: sending contestant and judging
prompts, repairing invalid outputs, generating and regenerating Gemini images,
saving the 1024x506 preview, writing files, committing, and pushing. Do not
pause for progress approval. Stop and report only for a required login or
CAPTCHA, a paid upgrade or paid API, unexpected terms, sensitive-data
transmission, or an unrecoverable external UI failure.

## Real External Round

1. Generate or choose six seed terms from `data/seed-lists.json`.
2. Prepare the joke prompt from `prompts/external-ai-round.md`.
3. Collect one joke from each contestant: ChatGPT/OpenAI, Claude, Gemini, Grok, and Copilot.
4. Prepare the judging prompt for each contestant, omitting that contestant's own joke.
5. Collect one complete scorecard from each contestant.
6. Put the collected data in `data/inbox/<round-name>.json` with `source` set to `manual-external`.
   Include `premise.displayText` when you want an editorial round title;
   otherwise the runner will publish the winning joke title.
7. Create the browser-safe prompt file with `npm run image:prompt -- --brief data/image-briefs/<round>.md`. In the Chrome browser-automation runtime, read that plain-text file directly from disk into a variable with `node:fs/promises`. Never navigate to it with a `file://` URL, parse the Markdown brief, or embed its contents in a JavaScript string literal.
8. Open a fresh Chrome window for Gemini image generation, then generate and
   approve a winning-joke feature image after scoring. Confirm the visible
   preview's natural dimensions are exactly 1024x506, click Gemini's **Copy
   image** control, read the resulting `image/png` through the browser clipboard
   bridge, and save those bytes unchanged. Never use a screenshot, crop,
   thumbnail, page-asset bundle, or full-size export. Pass the approved preview
   file with `--feature-image`.
9. Run:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<round-name>.json --seed <round-name>
```

10. Review the generated `site/index.html`, latest `site/runs/*.html`, and `data/runs/*.json`.
11. Commit and push when the result is ready.

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
- For Gemini images, look for the visible 1024x506 generated image preview. Use
  Gemini's **Copy image** control and the browser clipboard bridge to save the
  exact preview. The preview is a temporary `blob:` image, so page-asset listing
  and generic media download are not dependable file-export paths.
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
