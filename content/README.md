# Content ingestion — how to load the program

This folder drives bulk content loading. You control everything from the
**manifest** (a spreadsheet). The loader validates it and stages content as
**draft** — nothing goes live until you approve it in the Console.

## 1. Fill in the manifest
Copy `manifest.sample.csv` to `manifest.csv` and add one row per source item.

Columns:
- **source_id** — a stable id you assign (e.g. `leg-asset-001`). Re-running with
  the same id updates that item instead of creating a duplicate.
- **decision** — `keep`, `revise`, or `retire`.
- **kind** — `asset`, `learning_path`, `learning_module`, `calendar_event`,
  `podcast_episode`, `instrument`, or `collection`.
- **title** (or **label** for collections) — required for keep/revise.
- **summary / description** — optional short text.
- **body_file** — path (relative to this folder) to a `.md`/`.txt` file holding
  the long text. Keeps big bodies out of the spreadsheet.
- **format** — resource / brief / scenario / guide / tool / reference.
- **proficiency_band** — emerging / applied / advanced.
- **discipline_cluster** — one of: SBS, CIS, HUM, EDU, COM, LAW, HRC, ORG, DTD.
- **visibility** — staff / consultant / internal (defaults to staff).

`retire` rows need only `source_id`, `decision`, `kind`.

## 2. Dry run (safe — no database, no changes)
```
npm run build
node scripts/ingest.mjs content/manifest.csv
```
This validates every row and reports problems (missing fields, bad values,
**any PII**, or "AI" wording — all of which block the run). Fix and repeat
until it says DRY RUN ok.

## 3. Apply (writes drafts to the live database)
```
DATABASE_URL=... node scripts/ingest.mjs content/manifest.csv --apply
```
Idempotent: unchanged rows are skipped, changed rows updated, retired rows
archived. Everything lands as **draft**; you approve in the Console.
