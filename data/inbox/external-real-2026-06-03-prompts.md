# Paperclipalypse External Round Prompt Packet

Seed: `external-real-2026-06-03`

Premise: Massage / Physical Therapist at Park, facing Running out of critical supplies, with a Just instinct and a Foolish streak in a Herding mode

Seed terms: Herding, Massage / Physical Therapist, Park, Running out of critical supplies, Just, Foolish

Contestants used: ChatGPT, Claude, Gemini, Grok, Copilot.

Note: Mistral/Le Chat was unavailable because the web chat was not signed in.
Copilot was used as the fifth live-web contestant rather than inventing a
Mistral result.

## Joke Prompt

```text
You are a contestant in Paperclipalypse, an AI comedy tournament.

Write one original, publishable, standalone first-person stand-up joke for a broad human audience.

Premise: Massage / Physical Therapist at Park, facing Running out of critical supplies, with a Just instinct and a Foolish streak in a Herding mode
Seed terms: Herding, Massage / Physical Therapist, Park, Running out of critical supplies, Just, Foolish

Rules:
- Use exactly two seed terms in the joke text, no more and no fewer.
- Ignore the other four seed terms completely.
- Tell the joke as the onstage comic using I, me, or my naturally.
- The joke must make sense without the title, premise, or seed list.
- Prefer a concrete stage premise, natural wording, and a clear final laugh.
- Avoid default AI joke templates about HR, committees, therapy, awkward meetings, "interesting choice", and random surreal fog unless the angle is genuinely fresh.
- Keep it concise, usually 30-90 words.
- Avoid hate, harassment, slurs, sexual content, private-person references, defamation, and jokes about recent tragedies.

Return JSON only:
{"title":"short title","seedTermsUsed":["term one","term two"],"joke":"complete standalone first-person stand-up joke"}
```

## Judging Prompt Template

Paste this after all five jokes are collected. Remove the judge's own joke from `Jokes to judge`.

```text
You are judging a Paperclipalypse AI comedy tournament.

Premise: Massage / Physical Therapist at Park, facing Running out of critical supplies, with a Just instinct and a Foolish streak in a Herding mode
Seed terms: Herding, Massage / Physical Therapist, Park, Running out of critical supplies, Just, Foolish

Score every supplied joke exactly once. Do not score your own joke. Do not infer or mention which model wrote a joke. Use strict integer 1-10 scores.

Rubric:
- laugh 40%: likely human laughter, not just cleverness.
- surprise 20%: an unexpected but satisfying turn.
- craft 20%: clarity, stage rhythm, economy, escalation, and punchline placement.
- originality 10%: fresh angle, image, and wording.
- promptFit 10%: first-person stand-up form and natural use of exactly two seed terms in the joke text.

Fixed scale:
- 5 means competent but forgettable.
- 6 is a mild real joke.
- 7 is genuinely good.
- 8 requires a clear stage premise, a non-obvious turn, natural wording, and a final line that carries the laugh.
- 9 is rare and strong by human comedy-editor standards.
- 10 should almost never appear.

Penalize clever-sounding nonsense, premise recital, seed stuffing, generic AI joke shapes, and punchlines that only restate the setup.

Jokes to judge:
{{JOKES_JSON}}

Return JSON only:
{"scores":[{"jokeId":"id","originality":7,"surprise":7,"craft":7,"promptFit":7,"laugh":7,"comment":"brief note"}]}
```
