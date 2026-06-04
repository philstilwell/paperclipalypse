# Paperclipalypse One-Prompt Contest Protocol

This is the intended operator flow when Phil gives Codex a single instruction
such as:

```text
Run a Paperclipalypse contest from beginning to end with image. Use the normal
external AI web chat surfaces and Gemini image generation. Commit and push all.
```

That one instruction authorizes Codex to coordinate the whole round without
using paid model APIs.

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
   self-scoring, or "no joke text supplied" assessments must be corrected before
   rendering.
7. Write the real external episode to `data/inbox/`.
8. Run the tournament once with `--allow-missing-feature-image` to create the
   Gemini feature image brief.
9. Open a fresh Chrome window for Gemini image generation so the full browser
   save-as dialogue is accessible.
10. Prompt Google Gemini image generation for a 2:1 feature image based on the
    winning joke.
11. Download the full-size Gemini image through the normal browser save flow,
    not from a cropped screenshot or preview thumbnail.
12. QA the full-size image. Reject and regenerate low-quality images until the
    image is polished, on-brief, readable, and free of visible prompt/layout
    labels or distracting text errors.
13. Rerun the tournament with `--feature-image` and
    `--feature-image-qa-approved`.
14. Verify the rendered site, close temporary tabs/dialogues, commit, and push.

## Important Boundaries

- "One-prompt process" means one operator instruction from Phil to Codex. The AI
  contestants still receive separate joke and judge prompts because judging
  requires all jokes to exist first.
- Codex must not invent external contestant jokes or missing scorecards.
- Codex must not use paid APIs unless Phil explicitly authorizes metered API use.
- Gemini image generation is the project default for feature images.
- Gemini image generation should be run in a fresh Chrome window so Codex can
  reach the normal save-as dialogue and download the full-size generated image.
- Gemini may imperfectly render long in-image text. The site HTML remains the
  canonical exact joke text; the image prompt still asks Gemini to include the
  joke text when possible.
- The feature image is not publishable until it passes QA. If the image looks
  cheap, generic, monochrome by accident, off-brief, cropped, visibly labeled by
  prompt instructions, or badly garbles the joke text, Codex should regenerate
  instead of approving it.

## Command Helpers

Prepare a fresh prompt packet:

```sh
npm run round:prepare -- --seed external-real-YYYY-MM-DD
```

Render an external episode and create the Gemini image brief:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<episode>.json --allow-missing-feature-image
```

Attach the approved Gemini image:

```sh
node scripts/qa-feature-image.mjs --image /absolute/path/to/image.png --approved
node scripts/run-tournament.mjs --episode-file data/inbox/<episode>.json --feature-image /absolute/path/to/image.png --feature-image-qa-approved
```
