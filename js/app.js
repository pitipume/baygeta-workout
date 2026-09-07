// Storage helpers, escapeHtml, todayStr, and renderExerciseList now live in
// js/shared.js (shared with my-program.html) — this file assumes it's loaded first.

// Fixed % table the original sheet uses for 1RM estimation — a lookup table,
// not a continuous formula, so replicated as the same discrete brackets.
const ONERM_TABLE = { 1: 1.0, 3: 0.9, 5: 0.85, 8: 0.8, 10: 0.75 };

let PROGRAM = null;
let currentDayId = null;

// ---------------- view switching ----------------
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => (v.hidden = true));
  document.getElementById('view-' + name).hidden = false;
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'guide') renderGuide();
  if (name === 'workout') renderWorkoutDay(currentDayId || PROGRAM.workoutDays[0]?.id);
  if (name === 'diet') renderDiet();
  if (name === 'onerm') renderOneRmTable();
  if (name === 'changelog') renderChangelog();
}

// ---------------- guide view ----------------
function renderGuide() {
  const guide = PROGRAM.guide;
  if (!guide) return;

  document.getElementById('guide-intro').innerHTML =
    guide.intro.map((p) => `<p class="guide-intro-p">${escapeHtml(p)}</p>`).join('') +
    '<img class="guide-photo" src="assets/transformation.jpg" alt="P\'Bay ก่อน-หลัง 115kg → 85kg" loading="lazy" />';

  document.getElementById('guide-sections').innerHTML = guide.sections
    .map(
      (s) => `
    <div class="guide-section">
      <span class="guide-no">${escapeHtml(s.no)}</span><span class="guide-title">${escapeHtml(s.title)}</span>
      <div class="guide-body">${escapeHtml(s.body)}</div>
      ${s.no === '4' ? '<img class="guide-photo" src="assets/bodyfat-chart.jpg" alt="ตารางเทียบ % ไขมันในร่างกาย" loading="lazy" />' : ''}
    </div>`,
    )
    .join('');

  document.getElementById('guide-intensity').innerHTML = guide.intensityScale
    .map((r) => `<div class="intensity-row"><span class="level">${escapeHtml(r.level)}</span><span class="desc">${escapeHtml(r.description)}</span></div>`)
    .join('');
}

// ---------------- setup view ----------------
function renderSetupFields() {
  const container = document.getElementById('setup-fields');
  const inputs = getInputs();
  container.innerHTML = '';
  for (const field of PROGRAM.inputFields) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const label = document.createElement('label');
    label.textContent = field.label + (field.unit ? ` (${field.unit})` : '');
    label.setAttribute('for', 'field-' + field.no);
    row.appendChild(label);

    if (field.no === '1') {
      const select = document.createElement('select');
      select.id = 'field-1';
      for (const [value, text] of [['0-2', '0-2 ปี (มือใหม่)'], ['2-5', '2-5 ปี'], ['5+', '5+ ปี (สายเก๋า)']]) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        if (inputs.q1 === value) opt.selected = true;
        select.appendChild(opt);
      }
      row.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.type = 'number';
      input.inputMode = 'decimal';
      input.step = '0.5';
      input.id = 'field-' + field.no;
      input.value = inputs['q' + field.no] ?? '';
      row.appendChild(input);
    }
    container.appendChild(row);
  }
}

document.getElementById('save-setup-btn').addEventListener('click', () => {
  const inputs = {};
  for (const field of PROGRAM.inputFields) {
    const el = document.getElementById('field-' + field.no);
    inputs['q' + field.no] = el.value.trim();
  }
  setInputs(inputs);
  const toast = document.getElementById('setup-saved-toast');
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 2000);
});

// ---------------- workout view ----------------
function renderDayPicker() {
  const picker = document.getElementById('day-picker');
  picker.innerHTML = '';
  for (const day of PROGRAM.workoutDays) {
    const btn = document.createElement('button');
    btn.className = 'day-btn';
    btn.textContent = day.name;
    btn.dataset.dayId = day.id;
    btn.addEventListener('click', () => renderWorkoutDay(day.id));
    picker.appendChild(btn);
  }
}

function renderWorkoutDay(dayId) {
  if (!dayId) return;
  currentDayId = dayId;
  document.querySelectorAll('.day-btn').forEach((b) => b.classList.toggle('active', b.dataset.dayId === dayId));

  const day = PROGRAM.workoutDays.find((d) => d.id === dayId);
  const container = document.getElementById('workout-content');
  renderExerciseList(container, day.exercises, dayId);
}

// ---------------- diet calculator ----------------
// Faithful port of the "คำนวณการกิน" sheet's formulas — see scripts/extract-data.js
// header comment. One deliberate deviation: the original B2 formula compares
// against E2 ("0-2"/"2-5"/"5+"), but E2 on that sheet actually holds a food
// name ("อกไก่") — a stale cross-reference left over from a template
// reorganization, since the Q&A sheet's own experience field (column D, row 2)
// holds exactly those bracket strings. Wired to that intended source instead
// of the dead cell, so the estimate actually varies by experience level.
function calcDiet() {
  const inputs = getInputs();
  const bw = Number(inputs.q5) || 0;
  const target = Number(inputs.q6) || 0;
  const experience = inputs.q1 || '0-2';
  if (!bw) return null;

  let base;
  if (experience === '0-2') base = target > bw ? bw * 30 + 200 : bw * 30 - 300;
  else if (experience === '2-5') base = target > bw ? bw * 32 + 200 : bw * 32 - 300;
  else if (experience === '5+') base = bw * 34 + 200;
  else base = bw * 30;

  let delta = 0;
  if (bw && target && target !== bw) {
    delta = Math.abs(target - bw) >= 10 ? (target > bw ? 500 : -500) : target > bw ? 300 : -300;
  }
  const totalCalories = Math.round(base + delta);

  const planKey = getDietPlan();
  const plan = PROGRAM.dietPlans[planKey];
  const proteinG = Math.round((totalCalories * plan.proteinPct) / 4);
  const carbG = Math.round((totalCalories * plan.carbPct) / 4);
  const fatG = Math.round((totalCalories * plan.fatPct) / 9);

  return {
    totalCalories,
    proteinG,
    carbG,
    fatG,
    chickenPieces: Math.max(0, Math.round(((proteinG * 0.8) / 45) * 10) / 10),
    eggs: Math.max(0, Math.round((proteinG * 0.15) / 6)),
    riceTablespoons: Math.max(0, Math.round(carbG / 22)),
    peanutHandfuls: Math.round(fatG / 15),
    // Bodyweight-based supplement ranges — these check out against normal
    // dosing guidance for a 70kg reference case, replicated as-is.
    vitC: [Math.round(bw * 10), Math.round(bw * 15)],
    omega3: [Math.round(bw * 14), Math.round(bw * 28)],
    zinc: [Math.round(bw * 0.14), Math.round(bw * 0.2)],
  };
}

function renderDiet() {
  const planKey = getDietPlan();
  document.querySelectorAll('.plan-btn').forEach((b) => b.classList.toggle('active', b.dataset.plan === planKey));
  document.getElementById('plan-label').textContent = PROGRAM.dietPlans[planKey]?.label || '';

  const diet = calcDiet();
  const resultEl = document.getElementById('diet-result');
  const suppEl = document.getElementById('supplements-result');

  if (!diet) {
    resultEl.innerHTML = '<div class="empty-hint">กรอกน้ำหนักตัวในหน้าตั้งค่าก่อนนะ ไม่งั้นคำนวณไม่ได้จ้า</div>';
    suppEl.innerHTML = '';
    return;
  }

  resultEl.innerHTML = `
    <div class="calorie-hero"><div class="value">${diet.totalCalories.toLocaleString()}</div><div class="label">แคลต่อวัน</div></div>
    <div class="macro-grid">
      <div class="macro-tile protein"><div class="label">โปรตีน</div><div class="value">${diet.proteinG}g</div></div>
      <div class="macro-tile carb"><div class="label">คาร์บ</div><div class="value">${diet.carbG}g</div></div>
      <div class="macro-tile fat"><div class="label">ไขมัน</div><div class="value">${diet.fatG}g</div></div>
    </div>
    <div class="food-list">
      <div class="food-row"><span>อกไก่</span><span class="qty">${diet.chickenPieces} ชิ้น</span></div>
      <div class="food-row"><span>ไข่</span><span class="qty">${diet.eggs} ฟอง</span></div>
      <div class="food-row"><span>ข้าว</span><span class="qty">${diet.riceTablespoons} ทัพพี</span></div>
      <div class="food-row"><span>ถั่วลิสงคั่ว</span><span class="qty">${diet.peanutHandfuls} กำมือ</span></div>
    </div>
  `;

  suppEl.innerHTML = `
    <div class="supp-row"><span class="supp-name">Vitamin C</span><span class="supp-dose">${diet.vitC[0]}–${diet.vitC[1]} mg</span></div>
    <div class="supp-row"><span class="supp-name">Vitamin D</span><span class="supp-dose">2000–4000 IU</span></div>
    <div class="supp-row"><span class="supp-name">B รวม</span><span class="supp-dose">1 เม็ด</span></div>
    <div class="supp-row"><span class="supp-name">Creatine</span><span class="supp-dose">3–5g/วัน</span></div>
    <div class="supp-row"><span class="supp-name">Magnesium</span><span class="supp-dose">1 เม็ดก่อนนอน</span></div>
    <div class="supp-row"><span class="supp-name">Omega-3</span><span class="supp-dose">${diet.omega3[0]}–${diet.omega3[1]} mg</span></div>
    <div class="supp-row"><span class="supp-name">Zinc</span><span class="supp-dose">${diet.zinc[0]}–${diet.zinc[1]} mg</span></div>
  `;
}

// ---------------- 1RM calculator ----------------
function calcOneRm() {
  const weight = Number(document.getElementById('onerm-weight').value) || 0;
  const reps = Number(document.getElementById('onerm-reps').value);
  const pct = ONERM_TABLE[reps];
  const result = document.getElementById('onerm-result');
  if (!weight || !pct) {
    result.innerHTML = '';
    return;
  }
  const oneRm = Math.round(weight / pct);
  result.innerHTML = `<div class="value">${oneRm} kg</div><div class="hint">ประมาณการ 1RM จาก ${weight}kg × ${reps} ครั้ง (${pct * 100}%)</div>`;
}

function renderOneRmTable() {
  const inputs = getInputs();
  const lifts = [
    { label: 'Bench Press', max: Number(inputs.q2) || 0 },
    { label: 'Overhead Press', max: Number(inputs.q3) || 0 },
    { label: 'Squat', max: Number(inputs.q4) || 0 },
  ].filter((l) => l.max > 0);

  const container = document.getElementById('onerm-table');
  if (lifts.length === 0) {
    container.innerHTML = '<div class="empty-hint">กรอก 1RM สูงสุดในหน้าตั้งค่าก่อนนะ ถึงจะโชว์ตารางน้ำหนักแนะนำได้</div>';
    return;
  }
  const reps = Object.keys(ONERM_TABLE);
  let html = '<table class="onerm-table"><thead><tr><th>ท่า</th>' + reps.map((r) => `<th class="num">${r}RM</th>`).join('') + '</tr></thead><tbody>';
  for (const lift of lifts) {
    html +=
      `<tr><td>${escapeHtml(lift.label)}</td>` +
      reps.map((r) => `<td class="num">${Math.round(lift.max * ONERM_TABLE[r])}</td>`).join('') +
      '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---------------- changelog ----------------
function renderChangelog() {
  const container = document.getElementById('changelog-list');
  container.innerHTML = PROGRAM.changelog
    .map(
      (e) => `
    <div class="changelog-entry">
      <div class="date">${escapeHtml(e.date)}</div>
      <div class="version">${escapeHtml(e.version)}</div>
      <div class="notes">${escapeHtml(e.notes)}</div>
    </div>`,
    )
    .join('');
}

// ---------------- init ----------------
async function init() {
  const res = await fetch('data/program.json');
  PROGRAM = await res.json();

  document.getElementById('version-badge').textContent = PROGRAM.version || 'v?';
  renderGuide();
  renderSetupFields();
  renderDayPicker();
  currentDayId = PROGRAM.workoutDays[0]?.id || null;

  document.getElementById('tabbar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) showView(btn.dataset.view);
  });
  document.getElementById('plan-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('.plan-btn');
    if (!btn) return;
    setDietPlan(btn.dataset.plan);
    renderDiet();
  });
  document.getElementById('onerm-weight').addEventListener('input', calcOneRm);
  document.getElementById('onerm-reps').addEventListener('change', calcOneRm);
}

init().catch((err) => {
  console.error('App failed to start:', err);
  document.getElementById('app').innerHTML =
    '<div class="card"><h2>โหลดแอปไม่สำเร็จ 😵</h2>' +
    '<p class="hint">ลองรีเฟรชหน้าใหม่นะ ถ้ายังไม่ได้ส่งข้อความ error นี้ให้คนแก้: ' +
    escapeHtml(err.message) +
    '</p></div>';
});
