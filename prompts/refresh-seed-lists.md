# Refresh Paperclipalypse Seed Lists

Use this prompt only when the source Google Sheet lists have changed and the
local mirror needs to be refreshed.

## Task

Refresh `data/seed-lists.json` from the Google Sheet configured in
`config/seed-source.json`.

## Workflow

1. Use the Google Sheets connector, not a browser.
2. Read metadata for the configured spreadsheet and confirm the `Ideas` tab has
   `sheetId` `1714069989`.
3. Read the configured source-list range, currently `Ideas!B1:G1000`, in one
   bounded request when possible.
4. Treat row 1 as headers:
   - `Genre`
   - `Occupation`
   - `Location`
   - `Conflict`
   - `Positive Trait`
   - `Negative Trait`
5. Rewrite `data/seed-lists.json` with trimmed non-empty values for each list.
6. Update `source.syncedAt`.
7. Run `npm run tournament:dry-run` to confirm local seed generation still
   works.

