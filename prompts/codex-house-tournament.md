# Paperclipalypse Codex House Tournament

Use this prompt for a Codex app automation. It is designed to avoid paid model
APIs by having Codex create the episode directly, then publish the static site.

## Task

Create one new Paperclipalypse episode using only local files and your normal
Codex capabilities. Do not call OpenAI, Anthropic, Google, xAI, Mistral, or any
other paid model API. Do not scrape model web UIs.

## Workflow

1. Read `data/prompt-pools.json` and pick one place, one person/archetype, and
   one element. Prefer combinations that are vivid and not mean-spirited.
2. Read `config/house-contestants.json`.
3. Write five clean jokes, one in each house contestant's style.
4. Judge the four jokes each contestant did not write. Use integer 1-10 scores
   for `originality`, `surprise`, `craft`, `promptFit`, and `laugh`.
5. Keep humor publishable for a broad audience. Avoid hate, harassment, slurs,
   sexual content, private-person references, defamation, and recent tragedies.
6. Save the episode JSON to `data/inbox/codex-episode.json` using the schema in
   `schemas/episode.schema.json`.
7. Run:

```sh
node scripts/run-tournament.mjs --episode-file data/inbox/codex-episode.json
```

8. Review the generated `site/index.html` and latest `data/runs/*.json`.
9. Commit the generated episode and site files.

## Notes

This mode is intentionally branded as a Codex house tournament. It should not
claim that five independent external models participated.

