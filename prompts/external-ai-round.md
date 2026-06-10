# Paperclipalypse External AI Round

Use this workflow when Paperclipalypse should feature real submissions and
real scorecards from five separate AI contestants while avoiding paid APIs.
Codex may prepare prompts, collect pasted responses, validate the JSON, render
the site, and publish the result. Codex must not write missing jokes or invent
missing judge assessments.

## Contestants

Use `config/contestants.json` unless the user explicitly changes the roster.
The default roster is OpenAI/ChatGPT, Claude, Gemini, Grok, and Copilot. Each
contestant must submit exactly one joke and exactly one scorecard.

## Joke Prompt

Paste this prompt into each contestant's normal chat surface. Replace
`{{SEED_TERMS}}` with the six terms for the round. Do not provide a separate
premise; contestants must invent their own concrete stage situation from the two
terms they choose.

```text
You are a contestant in Paperclipalypse, an AI comedy tournament.

Write one original, publishable, standalone first-person stand-up joke for a
broad human audience.

Seed terms: {{SEED_TERMS}}

Rules:
- Use exactly two seed terms as concepts, no more and no fewer.
- Exact seed-term wording is optional if the concept is clear in the joke.
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
{"title":"short title","seedTermsUsed":["term one","term two"],"joke":"complete standalone first-person stand-up joke"}
```

## Judging Prompt

After all five jokes are collected, paste this prompt into each contestant's
normal chat surface. Remove that contestant's own joke from `{{JOKES_JSON}}`.
Every joke object in `{{JOKES_JSON}}` must include a `text` field containing the
complete joke humans will read. If a judge responds as if joke text was missing,
fix the packet and resubmit the judging prompt. If a judge echoes the example
JSON with `jokeId` set to `"id"`, reject it as a non-scorecard and send a short
repair prompt naming the exact four joke IDs it must score.

```text
You are judging a Paperclipalypse AI comedy tournament.

Seed terms: {{SEED_TERMS}}

Score every supplied joke exactly once. Do not score your own joke. Do not infer
or mention which model wrote a joke. Use strict integer 1-10 scores.

Rubric:
- laugh 40%: likely human laughter, not just cleverness.
- surprise 20%: an unexpected but satisfying turn.
- craft 20%: clarity, stage rhythm, economy, escalation, and punchline placement.
- originality 10%: fresh angle, image, and wording.
- promptFit 10%: first-person stand-up form and natural use of exactly two seed
  terms as concepts.

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
{"scores":[{"jokeId":"id","originality":7,"surprise":7,"craft":7,"promptFit":7,"laugh":7,"comment":"brief note"}]}
```

## Publishing

1. Put the five real joke responses and five real scorecards into an episode
   JSON under `data/inbox/`.
2. Set `source` to `manual-external`.
3. Run:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/<episode>.json --allow-missing-feature-image
```

The runner rejects incomplete rounds. It fails if any contestant is missing a
joke, any contestant is missing a scorecard, any judge scores itself, any judge
omits another contestant, or any joke fails the first-person/two-seed structural
checks.

4. Open a fresh Chrome window for Gemini image generation, then generate the
   feature image from the written Gemini brief. Save Gemini's 1024x506
   generated chat-preview image, visually inspect it, and reject/regenerate weak
   images until the image is polished, on-brief, and free of distracting text or
   prompt-label artifacts. If Gemini leaves the prompt in the composer after a
   send-button click, focus the composer and submit with `Control+Enter`.
   Prefer the browser media-download action on Gemini's visible 1024x506
   generated image preview over the full-size export or a native save dialog.

```sh
node scripts/qa-feature-image.mjs --image /absolute/path/to/approved-image.png --approved
node scripts/run-tournament.mjs --episode-file data/inbox/<episode>.json --feature-image /absolute/path/to/approved-image.png --feature-image-qa-approved
```
