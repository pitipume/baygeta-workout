// Shared by index.html (js/app.js) and my-program.html (js/my-program.js):
// storage helpers and the exercise-card/set-logging UI. Both pages resolve
// their day's exercises down to the same {no, exercise, sets, reps, rest,
// tips, muscleGroup} shape, so logging (and its "last time" hints) behaves
// identically regardless of which page — and which data source — it came from.

const STORAGE_KEYS = {
  inputs: 'bgw:inputs',
  dietPlan: 'bgw:dietPlan',
  logs: 'bgw:logs', // { [dayId]: { [date]: { [exerciseNo]: [{w,r}, ...] } } }
  myKit: 'bgw:myKit',
};

function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private mode etc.) — logging silently no-ops rather than crashing the page.
  }
}
function getInputs() { return loadJSON(STORAGE_KEYS.inputs, {}); }
function setInputs(v) { saveJSON(STORAGE_KEYS.inputs, v); }
function getDietPlan() { return loadJSON(STORAGE_KEYS.dietPlan, 'B'); }
function setDietPlan(v) { saveJSON(STORAGE_KEYS.dietPlan, v); }
function getLogs() { return loadJSON(STORAGE_KEYS.logs, {}); }
function setLogs(v) { saveJSON(STORAGE_KEYS.logs, v); }

function todayStr() {
  return new Intl.DateTimeFormat('en-CA').format(new Date());
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderExerciseList(container, exercises, dayId) {
  container.innerHTML = '';

  const logs = getLogs();
  const dayLogs = logs[dayId] || {};
  const today = todayStr();
  const previousDates = Object.keys(dayLogs).filter((d) => d !== today).sort();
  const lastSession = previousDates.length ? dayLogs[previousDates[previousDates.length - 1]] : null;

  for (const ex of exercises) {
    const card = document.createElement('div');
    card.className = 'exercise-card';

    const numSets = parseInt(ex.sets, 10);
    const isLoggable = !Number.isNaN(numSets) && numSets > 0;

    const head = document.createElement('div');
    head.className = 'exercise-head';
    head.innerHTML = `
      <div>
        <div class="exercise-name">${escapeHtml(ex.no)}. ${escapeHtml(ex.exercise)}</div>
        <div class="exercise-meta">${
          isLoggable
            ? `${escapeHtml(ex.sets)} เซต × ${escapeHtml(ex.reps)} ครั้ง${ex.rest ? ' · พัก ' + escapeHtml(ex.rest) : ''}${ex.weight ? ' · ' + escapeHtml(ex.weight) : ''}`
            : 'คำแนะนำ / ตัวเลือกท่า'
        }</div>
        ${ex.muscleGroup ? `<span class="muscle-chip">${escapeHtml(ex.muscleGroup)}</span>` : ''}
      </div>
      <span class="exercise-chevron">▶</span>
    `;
    head.addEventListener('click', () => card.classList.toggle('open'));

    const body = document.createElement('div');
    body.className = 'exercise-body';

    if (ex.tips) {
      const tips = document.createElement('div');
      tips.className = 'exercise-tips';
      tips.textContent = ex.tips;
      body.appendChild(tips);
    }

    if (isLoggable) {
      const lastEx = lastSession?.[ex.no];
      const todayEx = dayLogs[today]?.[ex.no] || [];
      for (let i = 0; i < numSets; i++) {
        const row = document.createElement('div');
        row.className = 'set-row';

        const no = document.createElement('span');
        no.className = 'set-no';
        no.textContent = String(i + 1);

        const wInput = document.createElement('input');
        wInput.type = 'number';
        wInput.inputMode = 'decimal';
        wInput.step = '0.5';
        wInput.placeholder = lastEx?.[i]?.w != null ? `ครั้งก่อน ${lastEx[i].w}kg` : 'น้ำหนัก kg';
        wInput.value = todayEx[i]?.w ?? '';
        wInput.dataset.field = 'w';

        const rInput = document.createElement('input');
        rInput.type = 'number';
        rInput.inputMode = 'numeric';
        rInput.placeholder = lastEx?.[i]?.r != null ? `ครั้งก่อน ${lastEx[i].r} ครั้ง` : 'จำนวนครั้ง';
        rInput.value = todayEx[i]?.r ?? '';
        rInput.dataset.field = 'r';

        row.append(no, wInput, rInput);
        body.appendChild(row);
      }

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'log-save-btn';
      saveBtn.textContent = 'บันทึกเซตนี้ 💾';
      saveBtn.addEventListener('click', () => {
        const sets = [];
        body.querySelectorAll('.set-row').forEach((row) => {
          const w = row.querySelector('[data-field="w"]').value;
          const r = row.querySelector('[data-field="r"]').value;
          sets.push({ w: w ? Number(w) : null, r: r ? Number(r) : null });
        });
        const logs = getLogs();
        logs[dayId] = logs[dayId] || {};
        logs[dayId][today] = logs[dayId][today] || {};
        logs[dayId][today][ex.no] = sets;
        setLogs(logs);
        saveBtn.textContent = 'บันทึกแล้ว ✅ เจ๋งอ่ะ';
        saveBtn.classList.add('saved');
        setTimeout(() => {
          saveBtn.textContent = 'บันทึกเซตนี้ 💾';
          saveBtn.classList.remove('saved');
        }, 1500);
      });
      body.appendChild(saveBtn);
    }

    card.append(head, body);
    container.appendChild(card);
  }
}
