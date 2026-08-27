# Paperclipalypse One-Prompt Contest Protocol

This is the intended operator flow when Phil gives Codex a single instruction
such as:

```text
Run a Paperclipalypse contest from beginning to end with image. Use the normal
external AI web chat surfaces and Gemini image generation. Commit and push all.
```

That one instruction authorizes Codex to coordinate the whole round without
using paid model APIs. It also authorizes all routine external contest actions:
sending contestant and judging prompts to the five named chat services,
repairing invalid contestant outputs, generating and regenerating Gemini
feature images, saving the Gemini 1024x506 preview, writing contest artifacts,
and committing and pushing the completed round. Do not pause for progress or
routine-action approval during a one-prompt run.

## What Codex Does

1. Generate six seed terms locally from `data/seed-lists.json`.
2. Create a prompt packet with:
   - the shared contestant joke prompt,
   - the judging prompt template,
   - the seed terms,
   - the current five-contestant roster.
3. Send the joke prompt to each contestant's normal web chat surface.
4. Collect exactly one real joke from each contestant.
5. Send the judging prompt back to each contestant with that contestant's own
   joke removed.
6. Require every judge to score all four eligible jokes. Missing scorecards,
   self-scoring, "no joke text supplied" assessments, and template echoes such
   as `{"jokeId":"id", ...}` must be corrected before rendering.
7. Write the real external episode to `data/inbox/`.
8. Run the tournament once with `--allow-missing-feature-image` to create the
   Gemini feature image brief.
9. Run `npm run image:prompt -- --brief data/image-briefs/<round>.md`. This
   writes the validated plain-text Gemini prompt under
   `tmp/gemini-feature-images/`; read that file directly in the browser rather
   than parsing the Markdown brief or embedding the prompt in a JavaScript
   string.
10. Open a fresh Chrome window for Gemini image generation so the full browser
   image controls are accessible.
11. Prompt Google Gemini image generation for a 2:1 feature image based on the
    winning joke.
12. Save Gemini's exact 1024x506 generated chat-preview image, not the full-size
    export and not a cropped screenshot.
13. QA the saved preview image. Reject and regenerate low-quality images until
    the image is polished, on-brief, readable at web size, and free of visible
    prompt/layout labels or distracting text errors.
14. Rerun the tournament with `--feature-image` and
    `--feature-image-qa-approved`.
15. Verify the rendered site, close temporary tabs/dialogues, commit, and push.

## Important Boundaries

- "One-prompt process" means one operator instruction from Phil to Codex. The AI
  contestants still receive separate joke and judge prompts because judging
  requires all jokes to exist first.
- Stop and report, rather than asking for routine progress approval, only when
  a login is required, a CAPTCHA appears, a paid upgrade or paid API would be
  needed, unexpected terms must be accepted, sensitive data would be sent, or
  an external UI failure prevents completion after reasonable retries.
- Codex must not invent external contestant jokes or missing scorecards.
- Codex must not use paid APIs unless Phil explicitly authorizes metered API use.
- Gemini image generation is the project default for feature images.
- Publication dates and generated slugs use Eastern time
  (`America/New_York`) unless Phil explicitly requests another date.
- Gemini image generation should be run in a fresh Chrome window so Codex can
  reach the generated image controls and save the 1024x506 chat-preview image.
- Gemini may imperfectly render long in-image text. The site HTML remains the
  canonical exact joke text; the image prompt still asks Gemini to include the
  joke text when possible.
- The feature image is not publishable until it passes QA. If the image looks
  cheap, generic, monochrome by accident, off-brief, cropped, visibly labeled by
  prompt instructions, or badly garbles the joke text, Codex should regenerate
  instead of approving it.
- Some chat surfaces, especially Gemini, can leave a prompt in the composer even
  after the visible send button is clicked. Before declaring failure, focus the
  composer and try `Control+Enter`.
- If a judge returns a placeholder scorecard instead of scoring the supplied
  jokes, send a short repair prompt naming the exact four `jokeId` values to
  score. Do not hand-score on the judge's behalf.
- For Gemini feature images, prefer downloading the visible 1024x506 generated
  image with the browser media-download action. It avoids full-size exports and
  native save dialogs while preserving the intended web preview.
- Minor incidental text errors, such as a tiny truncated stage sign, can pass QA
  if the main joke text is legible and the image is otherwise polished.

## Command Helpers

Prepare a fresh prompt packet:

```sh
npm run round:prepare -- --seed external-real-YYYY-MM-DD
```

Render an external episode and create the Gemini image brief:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<episode>.json --allow-missing-feature-image
npm run image:prompt -- --brief data/image-briefs/<round>.md
```

Attach the approved Gemini image:

```sh
node scripts/qa-feature-image.mjs --image /absolute/path/to/image.png --approved
node scripts/run-tournament.mjs --episode-file data/inbox/<episode>.json --feature-image /absolute/path/to/image.png --feature-image-qa-approved
```
