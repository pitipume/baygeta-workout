# ธรรมชาติลงโทษ — Natty Gains Tracker

A mobile-first web app version of [P'Bay / Baygeta](https://www.youtube.com/@BAYGETA)'s
"ธรรมชาติลงโทษ" workout + diet Google Sheets template. All exercise programming,
diet-macro logic, and supplement guidance is Baygeta's own — this project just
converts it into a phone-friendly app with actual workout logging, instead of
filling in a spreadsheet.

**License** (per the original sheet): free to copy, edit, and redistribute — not
for sale or commercial use.

## What this actually is

- 100% static — plain HTML/CSS/JS, no framework, no build step, no backend.
- All your data (bodyweight, 1RM maxes, logged sets) stays in your browser's
  `localStorage`. Nothing is sent anywhere. Nothing syncs between devices.
- `data/program.json` holds the extracted workout days, diet-plan formulas, and
  changelog — generated from the `.xlsx`, not hand-written.

## Updating to a new template version

When Baygeta ships a new version of the sheet:

1. Download the new `.xlsx` into this project's root folder (any filename ending
   in `.xlsx` works — `scripts/extract-data.js` picks whichever one it finds).
2. Run:
   ```bash
   node scripts/extract-data.js
   ```
3. Commit + redeploy. The HTML/CSS/JS almost never need to change for a
   content-only update — only `data/program.json` regenerates.

This is the whole "how do we keep this in sync" answer: re-extract, don't
hand-edit. (A live-sync version — pointing the extraction script at Baygeta's
public sheet URL directly, on a schedule — is a possible future upgrade if
manual re-downloading becomes annoying; not built yet.)

## Running locally

Needs a static file server (plain `file://` won't work — `fetch()` of
`data/program.json` needs `http://`):

```bash
python3 -m http.server 8765
# then open http://localhost:8765/
```

## Two things worth knowing about the underlying formulas

While porting the diet calculator's formulas from the original sheet, found two
issues in Baygeta's own spreadsheet (not introduced here):

1. **Calorie formula bug (fixed here):** the "current calories/day" formula
   compares against cell `E2` on the diet-calc sheet expecting an experience
   bracket ("0-2"/"2-5"/"5+"), but `E2` on that sheet actually holds a food name
   ("อกไก่") — a stale reference left over from a template reorg. The Q&A
   sheet's own experience-years field holds exactly those bracket strings, so
   this app wires the calorie formula to *that* instead of the dead cell —
   meaning the estimate here actually varies by training experience, unlike the
   original file as currently structured.
2. **Magnesium dose range (omitted here, not replicated):** the original
   formula computes a supplement range as `dailyCalories × 4` to
   `dailyCalories × 5.5` mg. For a normal calorie intake that produces a range
   in the **thousands of mg** — 10-20x any real supplemental magnesium dose
   (RDA is a few hundred mg). This looks like a genuine formula error (wrong
   cell reference or wrong multiplier), and reproducing it risked presenting
   a wrong number as real dosing advice. This app shows the sheet's qualitative
   guidance ("1 tablet before bed") without the broken numeric range.

## Design

Dark theme with red/gold accents and bold "impact" typography — aiming for a
gym-bro-who-loves-shonen-anime mood (One Piece / One Punch Man / HxH / MHA /
Gantz / Tokyo Revengers / Tokyo Ghoul), not any specific character or IP.

## Credits

All exercise programming, diet philosophy, and supplement guidance: **P'Bay
(Baygeta)** — [YouTube](https://www.youtube.com/@BAYGETA/featured).
This web version: built to make his template easier to use on a phone.
