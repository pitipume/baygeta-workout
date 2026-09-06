#!/usr/bin/env node
/**
 * Converts the Baygeta workout .xlsx template into data/program.json.
 *
 * This IS the "update to a new version" mechanism: when a new template
 * version ships, download the new .xlsx into the project root (any name
 * ending in .xlsx — the old one can stay or go, this always picks the
 * xlsx present) and re-run `node scripts/extract-data.js`. The site's
 * HTML/CSS/JS never need to change for a content-only update — only
 * this generated JSON does.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const xlsxFile = fs.readdirSync(root).find((f) => f.endsWith('.xlsx'));
if (!xlsxFile) {
  console.error('No .xlsx file found in project root — download the latest template there first.');
  process.exit(1);
}

const wb = XLSX.readFile(path.join(root, xlsxFile), { cellFormula: true });

const WORKOUT_DAYS = [
  { id: 'chest-a', sheet: 'อก A' },
  { id: 'back-a', sheet: 'หลัง A' },
  { id: 'shoulders-a', sheet: 'ไหล่ A' },
  { id: 'legs-a', sheet: 'ขา A' },
  { id: 'chest-b', sheet: 'อก B' },
  { id: 'back-b', sheet: 'หลัง B' },
  { id: 'shoulders-b', sheet: 'ไหล่ B' },
  { id: 'legs-b', sheet: 'ขา B' },
  { id: 'arms-c', sheet: 'แขน C' },
];

function extractWorkoutDay(sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.warn(`Sheet "${sheetName}" not found — skipping (template structure may have changed).`);
    return [];
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  // rows[0] = English header, rows[1] = Thai header, then exercise rows,
  // then 1-2 trailing note/license rows (identified by having no exercise name).
  const exercises = [];
  for (let i = 2; i < rows.length; i++) {
    const [no, exercise, weight, sets, reps, rest, tips, muscleGroup] = rows[i];
    if (!exercise) continue;
    exercises.push({
      no: String(no).trim(),
      exercise: String(exercise).trim(),
      weight: String(weight).trim(),
      sets: String(sets).trim(),
      reps: String(reps).trim(),
      rest: String(rest).trim(),
      tips: String(tips).trim(),
      muscleGroup: String(muscleGroup).trim(),
    });
  }
  return exercises;
}

function extractChangelog() {
  const sheet = wb.Sheets['รายระเอียดอัพเดท'];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }).map((r) => String(r[0] || ''));

  // Entries aren't consistently 3 rows each — later ones split version/notes
  // into two separate cells, older ones merge them into one. Scan for the
  // "อัพเดท" date marker as the real entry boundary instead of assuming a
  // fixed row stride, then split the collected body on the first blank line
  // to separate the version line from the notes (both formats use "\n\n"
  // after the version, whether or not notes share that same cell).
  // Anchored at the start (not just "includes") — the word "อัพเดท" also
  // shows up mid-sentence in at least one entry's own notes text, which a
  // loose substring match would misfire on as a false entry boundary.
  const DATE_MARKER = /^อัพเดท\s+(\d.*)$/;
  const changelog = [];
  let current = null;
  for (const line of rows) {
    const match = DATE_MARKER.exec(line.trim());
    if (match) {
      if (current) changelog.push(finalizeEntry(current));
      current = { date: match[1].trim(), bodyLines: [] };
    } else if (current && line.trim()) {
      current.bodyLines.push(line);
    }
  }
  if (current) changelog.push(finalizeEntry(current));
  return changelog;
}

function finalizeEntry({ date, bodyLines }) {
  const body = bodyLines.join('\n\n');
  const splitAt = body.indexOf('\n\n');
  const version = (splitAt === -1 ? body : body.slice(0, splitAt)).trim();
  const notes = (splitAt === -1 ? '' : body.slice(splitAt + 2)).trim();
  return { date, version, notes };
}

function extractInputFields() {
  const sheet = wb.Sheets['(ถามตอบก่อนเล่น) ใส่ข้อมูลเฉพาะ'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const fields = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || !row[1]) continue;
    fields.push({ no: String(row[0]).trim(), label: String(row[1]).trim(), unit: String(row[4] || '').trim() });
  }
  return fields;
}

// "เริ่มต้นอ่านก่อน" (read this first) — Baygeta's actual training philosophy
// (7 numbered principles: nutrition, daily weigh-ins, sleep, body fat %, cardio,
// progressive overload, injury management), not just file-copying instructions.
// Layout is freeform prose scattered across a sheet, not a clean table, so this
// extracts paragraph rows (rows with exactly one non-empty cell, wherever it
// sits) and skips embedded illustrative tables except the intensity scale,
// which is pulled out separately since it directly explains the "ความหนัก X/10"
// values shown in the workout day sheets' Weight column.
function extractGuide() {
  const sheet = wb.Sheets['เริ่มต้นอ่านก่อน'];
  if (!sheet) return null;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

  const nonEmpty = (row) => row.filter((c) => String(c).trim());
  const firstNonEmpty = (row) => nonEmpty(row)[0] || '';
  const HEADER = /^(\d+)\.(.+)$/;

  const intro = [];
  let i = 0;
  for (; i < rows.length; i++) {
    const cell = String(rows[i][0] || '').trim();
    if (HEADER.test(cell)) break;
    if (nonEmpty(rows[i]).length === 1 && cell) intro.push(cell);
  }

  const sections = [];
  let current = null;
  for (; i < rows.length; i++) {
    const row = rows[i];
    const cell = String(row[0] || '').trim();
    const m = HEADER.exec(cell);
    if (m) {
      if (current) sections.push(current);
      current = { no: m[1], title: m[2].trim(), body: [] };
      continue;
    }
    if (!current) continue;
    if (cell.startsWith('License') || cell.startsWith('บางคนอาจคิดว่า') || cell.startsWith('หมายเหตุ')) break;
    const txt = firstNonEmpty(row);
    if (nonEmpty(row).length === 1 && txt) current.body.push(txt);
  }
  if (current) sections.push(current);

  const intensityScale = [];
  const INTENSITY = /^ความหนัก\s+(\d+\/10)$/;
  for (const row of rows) {
    const m = INTENSITY.exec(String(row[1] || '').trim());
    if (m) intensityScale.push({ level: m[1], description: String(row[3] || '').trim() });
  }

  return {
    intro,
    sections: sections.map((s) => ({ no: s.no, title: s.title, body: s.body.join('\n\n') })),
    intensityScale,
  };
}

function extractDietPlans() {
  const sheet = wb.Sheets['คำนวณการกิน'];
  const cell = (addr) => sheet[addr]?.w ?? sheet[addr]?.v ?? '';
  // Fixed macro splits read directly off the template's own A/B/C reference table (rows 26-37) —
  // these are constants Baygeta chose, not computed, so they're hand-mapped rather than re-derived.
  return {
    A: { label: cell('H26'), proteinPct: 0.3, carbPct: 0.55, fatPct: 0.15 },
    B: { label: cell('H30'), proteinPct: 0.2, carbPct: 0.6, fatPct: 0.2 },
    C: { label: cell('H34'), proteinPct: 0.2, carbPct: 0.7, fatPct: 0.1 },
  };
}

const changelog = extractChangelog();

const program = {
  version: changelog[0]?.version || '',
  sourceFile: xlsxFile,
  extractedAt: new Date().toISOString(),
  guide: extractGuide(),
  inputFields: extractInputFields(),
  dietPlans: extractDietPlans(),
  workoutDays: WORKOUT_DAYS.map((d) => ({ id: d.id, name: d.sheet, exercises: extractWorkoutDay(d.sheet) })),
  changelog,
};

const outPath = path.join(root, 'data', 'program.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(program, null, 2), 'utf8');
console.log(
  `Wrote data/program.json — ${program.workoutDays.length} workout days, ` +
    `${program.workoutDays.reduce((s, d) => s + d.exercises.length, 0)} exercises, ` +
    `${program.changelog.length} changelog entries.`,
);
