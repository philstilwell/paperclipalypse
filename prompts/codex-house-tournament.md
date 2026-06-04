# Paperclipalypse Codex House Tournament

Use this prompt only for Codex-house demo/test runs. It is designed to avoid
paid model APIs by having Codex create the episode directly, then publish the
static site. It must not be presented as a real external-model tournament.

## Task

Create one new Paperclipalypse Codex-house episode using only local files and
your normal Codex capabilities. Do not call OpenAI, Anthropic, Google, xAI,
Copilot, or any other paid model API. Do not scrape model web UIs. For a real
external-model round, use `prompts/external-ai-round.md` instead.

## Workflow

1. Read `data/seed-lists.json`.
2. Read `config/seed-source.json`.
3. Generate exactly six `seedTerms` locally by selecting one term from each
   mirrored list: genre, occupation, location, conflict, positive trait, and
   negative trait.
4. Read `config/house-contestants.json`.
5. Write five clean jokes, one in each house contestant's style. The six
   `seedTerms` are ingredients, not checklist requirements. Each contestant
   must use exactly two seed-term concepts, no more and no fewer, and
   should ignore the other four completely.
6. Each joke must be a first-person stand-up bit told by the comic on stage,
   using I, me, or my naturally. It must be standalone humor humans can
   understand without the prompt, usually 30-90 words total. Favor stage rhythm
   and a clean final turn over explaining the setup.
7. Judge the four jokes each contestant did not write. Use integer 1-10 scores
   for `originality`, `surprise`, `craft`, `promptFit`, and `laugh`.
8. Grade against a fixed future-resistant scale, not only against the current
   batch. Be strict: 5 is competent but forgettable, 6 is a mild real joke, 7
   is genuinely good, 8 is excellent, 9 is rare, and 10 should almost never
   appear.
9. Use these weighted standards when judging:
   - `laugh` 40%: likely human laughter, not just cleverness.
   - `surprise` 20%: an unexpected but satisfying turn.
   - `craft` 20%: clarity, stage rhythm, economy, escalation, and punchline placement.
   - `originality` 10%: fresh angle, image, and wording.
   - `promptFit` 10%: first-person stand-up form and natural use of exactly two
     seed terms without checklist writing.
10. Do not award an 8 unless the joke has a clear stage premise, a non-obvious
    turn, natural wording, and a final line that carries the laugh. Do not award
    a 9 unless it is strong by human comedy-editor standards. Do not award 10 in
    an ordinary batch.
11. Keep humor publishable for a broad audience. Avoid hate, harassment, slurs,
   sexual content, private-person references, defamation, and recent tragedies.
12. Save the episode JSON to `data/inbox/codex-episode.json` using the schema in
   `schemas/episode.schema.json`.
13. Run:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/codex-episode.json
```

14. The runner will fail if any contestant is missing a joke, any judge is
    missing a full scorecard, any judge scores itself, or any scorecard omits a
    contestant.
15. Review the generated `site/index.html` and latest `data/runs/*.json`.
16. Commit the generated episode and site files.

## Notes

This mode is intentionally branded as a Codex house tournament. It should not
claim that five independent external models participated.

Use the Google Sheets connector only when explicitly asked to refresh the local
mirror from the source sheet. Normal tournament runs should not call Google
Sheets.
