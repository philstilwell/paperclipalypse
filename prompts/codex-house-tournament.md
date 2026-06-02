# Paperclipalypse Codex House Tournament

Use this prompt for a Codex app automation. It is designed to avoid paid model
APIs by having Codex create the episode directly, then publish the static site.

## Task

Create one new Paperclipalypse episode using only local files and your normal
Codex capabilities. Do not call OpenAI, Anthropic, Google, xAI, Mistral, or any
other paid model API. Do not scrape model web UIs.

## Workflow

1. Read `data/seed-lists.json`.
2. Read `config/seed-source.json`.
3. Generate exactly six `seedTerms` locally by selecting one term from each
   mirrored list: genre, occupation, location, conflict, positive trait, and
   negative trait.
4. Read `config/house-contestants.json`.
5. Write five clean jokes, one in each house contestant's style. The six
   `seedTerms` should shape the premise, images, vocabulary, and punchlines.
   They do not all need to appear verbatim, but the episode should clearly feel
   seeded by them.
6. Judge the four jokes each contestant did not write. Use integer 1-10 scores
   for `originality`, `surprise`, `craft`, `promptFit`, and `laugh`.
7. Keep humor publishable for a broad audience. Avoid hate, harassment, slurs,
   sexual content, private-person references, defamation, and recent tragedies.
8. Save the episode JSON to `data/inbox/codex-episode.json` using the schema in
   `schemas/episode.schema.json`.
9. Run:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/codex-episode.json
```

10. Review the generated `site/index.html` and latest `data/runs/*.json`.
11. Commit the generated episode and site files.

## Notes

This mode is intentionally branded as a Codex house tournament. It should not
claim that five independent external models participated.

Use the Google Sheets connector only when explicitly asked to refresh the local
mirror from the source sheet. Normal tournament runs should not call Google
Sheets.
