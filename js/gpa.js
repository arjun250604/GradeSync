/* ═══════════════════════════════════════════════════
   gpa.js  –  SGPA / CGPA Calculator
   ─────────────────────────────────────────────────
   GPA MATH (10-Point Indian University Scale):
   ─────────────────────────────────────────────────
   SGPA (Semester GPA):
     SGPA = Σ(credit_i × grade_point_i) / Σ(credit_i)
     where grade_point_i = numeric value mapped from
     the letter grade (O=10, A+=9, A=8, B+=7, B=6,
     C=5, P=4, F=0).

   CGPA (Cumulative GPA):
     CGPA = Σ(sgpa_s × total_credits_s) / Σ(total_credits_s)
     Weighted average across all semesters by credit load.

   Target SGPA Estimator:
     Required avg SGPA = (target_CGPA × total_future_credits
                          - current_CGPA × past_credits)
                         / future_credits
     Simplified (assuming equal credit load per semester):
     Required = (target × (past + future) - cgpa × past) / future
     We use: Required = target + ((target - cgpa) × past) / future
════════════════════════════════════════════════════ */

// ── Grade Scale (10-point) ───────────────────────
// Can be switched to 4-point from Settings.
let GPA_SCALE = 10;

const GRADE_SCALES = {
  10: [
    { letter: 'O',   points: 10, range: '90–100%',   color: 'text-emerald-600 dark:text-emerald-400' },
    { letter: 'A+',  points: 9,  range: '80–89%',    color: 'text-emerald-500 dark:text-emerald-400' },
    { letter: 'A',   points: 8,  range: '70–79%',    color: 'text-blue-600 dark:text-blue-400' },
    { letter: 'B+',  points: 7,  range: '60–69%',    color: 'text-blue-500 dark:text-blue-400' },
    { letter: 'B',   points: 6,  range: '50–59%',    color: 'text-amber-600 dark:text-amber-400' },
    { letter: 'C',   points: 5,  range: '45–49%',    color: 'text-amber-500 dark:text-amber-400' },
    { letter: 'P',   points: 4,  range: '40–44%',    color: 'text-orange-500 dark:text-orange-400' },
    { letter: 'F',   points: 0,  range: 'Below 40%', color: 'text-rose-600 dark:text-rose-400' },
  ],
  4: [
    { letter: 'A',   points: 4.0, range: '90–100%',  color: 'text-emerald-600 dark:text-emerald-400' },
    { letter: 'A-',  points: 3.7, range: '85–89%',   color: 'text-emerald-500 dark:text-emerald-400' },
    { letter: 'B+',  points: 3.3, range: '80–84%',   color: 'text-blue-600 dark:text-blue-400' },
    { letter: 'B',   points: 3.0, range: '75–79%',   color: 'text-blue-500 dark:text-blue-400' },
    { letter: 'B-',  points: 2.7, range: '70–74%',   color: 'text-amber-600 dark:text-amber-400' },
    { letter: 'C+',  points: 2.3, range: '65–69%',   color: 'text-amber-500 dark:text-amber-400' },
    { letter: 'C',   points: 2.0, range: '60–64%',   color: 'text-orange-500 dark:text-orange-400' },
    { letter: 'D',   points: 1.0, range: '50–59%',   color: 'text-orange-600 dark:text-orange-400' },
    { letter: 'F',   points: 0,   range: 'Below 50%', color: 'text-rose-600 dark:text-rose-400' },
  ],
};

// ── Semester data store ───────────────────────────
// Array of semester objects stored in localStorage
// Each semester: { id, name, courses: [{id, name, credits, grade, gradePoints}] }
let semesters = [];

// ══════════════════════════════════════════════════
//  Init GPA module
// ══════════════════════════════════════════════════
function initGPA() {
  GPA_SCALE = parseInt(localStorage.getItem('gradesync_gpa_scale') || localStorage.getItem('grasdesync_gpa_scale') || localStorage.getItem('acadplan_gpa_scale') || '10');
  loadSemesters();
  renderGradeScaleTable();
  renderAllSemesters();
  updateGPAScorecard();
}

// ══════════════════════════════════════════════════
//  Persistence helpers
// ══════════════════════════════════════════════════
function loadSemesters() {
  try {
    semesters = JSON.parse(localStorage.getItem('gradesync_semesters') || localStorage.getItem('grasdesync_semesters') || localStorage.getItem('acadplan_semesters') || '[]');
  } catch { semesters = []; }
}

function saveSemesters() {
  localStorage.setItem('gradesync_semesters', JSON.stringify(semesters));
}

// ══════════════════════════════════════════════════
//  Semester CRUD
// ══════════════════════════════════════════════════
function addSemester() {
  const semNum = semesters.length + 1;
  const sem = {
    id:      `sem-${Date.now()}`,
    name:    `Semester ${semNum}`,
    courses: [],
  };
  semesters.push(sem);
  saveSemesters();
  renderAllSemesters();
  updateGPAScorecard();

  // Scroll to new semester card after render
  setTimeout(() => {
    const el = document.getElementById(`card-${sem.id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);

  showToast(`Semester ${semNum} added`, 'success');
}

function deleteSemester(semId) {
  showConfirm(
    'Delete Semester',
    'All courses in this semester will be permanently removed.',
    () => {
      semesters = semesters.filter(s => s.id !== semId);
      saveSemesters();
      renderAllSemesters();
      updateGPAScorecard();
      showToast('Semester deleted', 'success');
    }
  );
}

function renameSemester(semId, newName) {
  const sem = semesters.find(s => s.id === semId);
  if (sem) {
    sem.name = newName || sem.name;
    saveSemesters();
  }
}

// ══════════════════════════════════════════════════
//  Course CRUD
// ══════════════════════════════════════════════════
function addCourse(semId) {
  const sem = semesters.find(s => s.id === semId);
  if (!sem) return;

  const course = {
    id:          `course-${Date.now()}`,
    name:        '',
    credits:     3,
    grade:       'O',
    gradePoints: getGradePoints('O'),
  };
  sem.courses.push(course);
  saveSemesters();
  renderSemesterBody(sem);
  updateGPAScorecard();
}

function updateCourse(semId, courseId, field, value) {
  const sem    = semesters.find(s => s.id === semId);
  const course = sem?.courses.find(c => c.id === courseId);
  if (!course) return;

  if (field === 'credits') {
    course.credits = Math.max(0, parseFloat(value) || 0);
  } else if (field === 'grade') {
    course.grade       = value;
    course.gradePoints = getGradePoints(value);
  } else if (field === 'name') {
    course.name = value;
  }

  saveSemesters();
  // Recalculate SGPA display for this semester
  updateSGPADisplay(sem);
  updateGPAScorecard();
}

function deleteCourse(semId, courseId) {
  const sem = semesters.find(s => s.id === semId);
  if (!sem) return;
  sem.courses = sem.courses.filter(c => c.id !== courseId);
  saveSemesters();
  renderSemesterBody(sem);
  updateGPAScorecard();
}

// ══════════════════════════════════════════════════
//  GPA Math
// ══════════════════════════════════════════════════

/** Map a letter grade to its numeric grade points on the active scale */
function getGradePoints(letter) {
  const scale = GRADE_SCALES[GPA_SCALE] || GRADE_SCALES[10];
  const entry = scale.find(g => g.letter === letter);
  return entry ? entry.points : 0;
}

/**
 * Calculate SGPA for a single semester.
 * Formula: Σ(credits × gradePoints) / Σ(credits)
 * Returns 0 if no credits or courses.
 */
function calcSGPA(courses) {
  let weightedSum  = 0;
  let totalCredits = 0;
  for (const c of courses) {
    const cr = parseFloat(c.credits) || 0;
    const gp = parseFloat(c.gradePoints) || 0;
    weightedSum  += cr * gp;
    totalCredits += cr;
  }
  if (totalCredits === 0) return 0;
  return weightedSum / totalCredits;
}

/**
 * Calculate CGPA across all semesters.
 * Formula: Σ(sgpa_s × credits_s) / Σ(credits_s)
 * This is a credit-weighted average, not a simple mean of SGPAs.
 */
function calcCGPA() {
  let totalWeighted = 0;
  let totalCredits  = 0;

  for (const sem of semesters) {
    const semCredits = sem.courses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0);
    const sgpa       = calcSGPA(sem.courses);
    totalWeighted   += sgpa * semCredits;
    totalCredits    += semCredits;
  }

  if (totalCredits === 0) return 0;
  return totalWeighted / totalCredits;
}

function getTotalCredits() {
  return semesters.reduce((total, sem) =>
    total + sem.courses.reduce((s, c) => s + (parseFloat(c.credits) || 0), 0), 0);
}

/**
 * Target CGPA Estimator
 * Required avg SGPA for remaining semesters:
 *   required = (target × (pastCredits + futureCredits) - cgpa × pastCredits) / futureCredits
 * We approximate future credits as average past credits per semester × remaining semesters.
 */
function calcTargetGPA() {
  const targetInput    = document.getElementById('target-cgpa-input');
  const remInput       = document.getElementById('remaining-semesters-input');
  const resultEl       = document.getElementById('target-result');
  const resultValueEl  = document.getElementById('target-result-value');
  const resultMsgEl    = document.getElementById('target-result-msg');

  const target   = parseFloat(targetInput.value);
  const remSems  = parseInt(remInput.value);

  if (!target || !remSems || isNaN(target) || isNaN(remSems)) {
    resultEl.classList.add('hidden');
    return;
  }

  const max          = GPA_SCALE;
  const pastCredits  = getTotalCredits();
  const currentCGPA  = calcCGPA();

  // Estimate average credits per semester from past data
  const pastSems     = semesters.length;
  const avgCredits   = pastSems > 0 ? pastCredits / pastSems : 20; // default 20 credits/sem
  const futureCredits = avgCredits * remSems;

  // Required SGPA = (target * (past + future) - currentCGPA * past) / future
  let required;
  if (pastCredits === 0) {
    required = target; // No past data, just need target every semester
  } else {
    required = (target * (pastCredits + futureCredits) - currentCGPA * pastCredits) / futureCredits;
  }

  resultEl.classList.remove('hidden');

  if (required > max) {
    resultValueEl.textContent = 'Not Achievable';
    resultValueEl.className = 'text-xl font-bold text-rose-500 dark:text-rose-400 mt-0.5';
    resultMsgEl.textContent = `Even a perfect ${max}.0 every semester won't reach ${target.toFixed(1)}.`;
  } else if (required <= 0) {
    resultValueEl.textContent = 'Already Achieved! 🎉';
    resultValueEl.className = 'text-xl font-bold text-emerald-500 dark:text-emerald-400 mt-0.5';
    resultMsgEl.textContent = `Your CGPA (${currentCGPA.toFixed(2)}) already meets or exceeds your target.`;
  } else {
    const pct = (required / max) * 100;
    const level = pct >= 90 ? '🔴 Very challenging' : pct >= 70 ? '🟡 Moderate' : '🟢 Feasible';
    resultValueEl.textContent = required.toFixed(2);
    resultValueEl.className = 'text-2xl font-bold text-indigo-600 dark:text-indigo-300 mt-0.5';
    resultMsgEl.textContent = `${level} – avg per semester over ${remSems} remaining.`;
  }
}

// ══════════════════════════════════════════════════
//  Rendering
// ══════════════════════════════════════════════════

function renderAllSemesters() {
  const container = document.getElementById('semesters-container');
  const emptyState = document.getElementById('gpa-empty-state');

  container.innerHTML = '';

  if (semesters.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  semesters.forEach((sem, index) => {
    container.appendChild(createSemesterCard(sem, index));
  });
}

function createSemesterCard(sem, index) {
  const sgpa       = calcSGPA(sem.courses);
  const sgpaStr    = sem.courses.length > 0 ? sgpa.toFixed(2) : '—';
  const totalCr    = sem.courses.reduce((s, c) => s + (parseFloat(c.credits) || 0), 0);
  const badgeClass = getSGPABadgeClass(sgpa);

  const card = document.createElement('div');
  card.className = 'semester-card';
  card.id = `card-${sem.id}`;

  card.innerHTML = `
    <div class="semester-header" onclick="toggleSemester('${sem.id}')">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
          <span class="text-indigo-600 dark:text-indigo-400 font-bold text-sm">${index + 1}</span>
        </div>
        <div class="min-w-0">
          <input type="text" value="${escapeHtml(sem.name)}"
            class="bg-transparent font-semibold text-slate-900 dark:text-white text-base border-none outline-none focus:bg-slate-50 dark:focus:bg-slate-800 rounded px-1 -ml-1 w-full max-w-xs"
            onclick="event.stopPropagation()"
            onblur="renameSemester('${sem.id}', this.value)" />
          <p class="text-xs text-slate-400">${sem.courses.length} course(s) · ${totalCr} credits</p>
        </div>
      </div>
      <div class="flex items-center gap-3 flex-shrink-0">
        <span id="sgpa-badge-${sem.id}" class="sgpa-badge ${badgeClass}">
          SGPA: ${sgpaStr}
        </span>
        <button onclick="event.stopPropagation(); deleteSemester('${sem.id}')"
          class="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 transition-colors">
          <i class="fa-solid fa-trash-can text-sm"></i>
        </button>
        <i id="chevron-${sem.id}" class="fa-solid fa-chevron-down text-slate-400 text-sm transition-transform duration-300"></i>
      </div>
    </div>
    <div id="body-${sem.id}" class="semester-body">
      <div id="courses-${sem.id}"></div>
      <button onclick="addCourse('${sem.id}')" class="mt-3 w-full py-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2">
        <i class="fa-solid fa-plus text-xs"></i> Add Course
      </button>
    </div>
  `;

  // Render body content
  renderSemesterBody(sem, card.querySelector(`#courses-${sem.id}`));

  return card;
}

function renderSemesterBody(sem, container) {
  container = container || document.getElementById(`courses-${sem.id}`);
  if (!container) return;

  const scale = GRADE_SCALES[GPA_SCALE] || GRADE_SCALES[10];
  const gradeOptions = scale.map(g => `<option value="${g.letter}">${g.letter} (${g.points})</option>`).join('');

  if (sem.courses.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-slate-400 dark:text-slate-500 text-sm">
        <i class="fa-solid fa-book-open text-2xl mb-2 opacity-40"></i>
        <p>No courses yet. Click "Add Course" below.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="grade-table">
        <thead>
          <tr>
            <th class="w-5/12">Course Name</th>
            <th class="w-1/12">Credits</th>
            <th class="w-2/12">Grade</th>
            <th class="w-2/12">Grade Pts</th>
            <th class="w-2/12">Weighted</th>
            <th class="w-1"></th>
          </tr>
        </thead>
        <tbody>
          ${sem.courses.map(course => {
            const weighted = ((parseFloat(course.credits) || 0) * (parseFloat(course.gradePoints) || 0)).toFixed(1);
            return `
              <tr class="group">
                <td>
                  <input type="text" value="${escapeHtml(course.name)}" placeholder="Course name…"
                    class="form-input text-sm py-1.5 px-2"
                    onblur="updateCourse('${sem.id}', '${course.id}', 'name', this.value)" />
                </td>
                <td>
                  <input type="number" value="${course.credits}" min="0" max="10" step="0.5"
                    class="form-input text-sm py-1.5 px-2 text-center"
                    oninput="updateCourse('${sem.id}', '${course.id}', 'credits', this.value)" />
                </td>
                <td>
                  <select class="form-input text-sm py-1.5 px-2"
                    onchange="updateCourse('${sem.id}', '${course.id}', 'grade', this.value)">
                    ${scale.map(g => `<option value="${g.letter}" ${g.letter === course.grade ? 'selected' : ''}>${g.letter}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <div class="text-sm font-semibold text-center text-slate-700 dark:text-slate-300 py-1.5">${parseFloat(course.gradePoints).toFixed(1)}</div>
                </td>
                <td>
                  <div class="text-sm font-bold text-center text-indigo-600 dark:text-indigo-400 py-1.5">${weighted}</div>
                </td>
                <td>
                  <button onclick="deleteCourse('${sem.id}', '${course.id}')"
                    class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-300 hover:text-rose-500 transition-all">
                    <i class="fa-solid fa-xmark text-sm"></i>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="border-t border-slate-100 dark:border-slate-700">
            <td class="pt-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Totals</td>
            <td class="pt-2 text-sm font-bold text-slate-700 dark:text-slate-300 text-center">
              ${sem.courses.reduce((s, c) => s + (parseFloat(c.credits) || 0), 0)}
            </td>
            <td></td>
            <td></td>
            <td class="pt-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 text-center">
              ${sem.courses.reduce((s, c) => s + ((parseFloat(c.credits) || 0) * (parseFloat(c.gradePoints) || 0)), 0).toFixed(1)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function updateSGPADisplay(sem) {
  const sgpa      = calcSGPA(sem.courses);
  const badgeEl   = document.getElementById(`sgpa-badge-${sem.id}`);
  const totalCr   = sem.courses.reduce((s, c) => s + (parseFloat(c.credits) || 0), 0);

  if (badgeEl) {
    badgeEl.className = `sgpa-badge ${getSGPABadgeClass(sgpa)}`;
    badgeEl.textContent = `SGPA: ${sem.courses.length > 0 ? sgpa.toFixed(2) : '—'}`;
  }

  // Update subtitle
  const card = document.getElementById(`card-${sem.id}`);
  if (card) {
    const subtitle = card.querySelector('.text-xs.text-slate-400');
    if (subtitle) subtitle.textContent = `${sem.courses.length} course(s) · ${totalCr} credits`;
  }
}

function updateGPAScorecard() {
  const cgpa       = calcCGPA();
  const latestSem  = semesters[semesters.length - 1];
  const sgpa       = latestSem ? calcSGPA(latestSem.courses) : 0;
  const totalCr    = getTotalCredits();
  const max        = GPA_SCALE;

  // Update text displays
  const cgpaEl = document.getElementById('cgpa-display');
  const sgpaEl = document.getElementById('sgpa-display');
  if (cgpaEl) cgpaEl.textContent = semesters.length > 0 ? cgpa.toFixed(2) : '—';
  if (sgpaEl) sgpaEl.textContent = latestSem && latestSem.courses.length > 0 ? sgpa.toFixed(2) : '—';

  const crEl = document.getElementById('total-credits-display');
  const semEl = document.getElementById('total-semesters-display');
  if (crEl) crEl.textContent = totalCr;
  if (semEl) semEl.textContent = semesters.length;

  // Update SVG arcs (circumference = 2π × r = 2π × 34 ≈ 213.6)
  const circumference = 213.6;
  const cgpaArc = document.getElementById('cgpa-arc');
  const sgpaArc = document.getElementById('sgpa-arc');

  if (cgpaArc) {
    const pct = semesters.length > 0 ? Math.min(cgpa / max, 1) : 0;
    cgpaArc.style.strokeDashoffset = circumference - (pct * circumference);
  }
  if (sgpaArc) {
    const pct = latestSem && latestSem.courses.length > 0 ? Math.min(sgpa / max, 1) : 0;
    sgpaArc.style.strokeDashoffset = circumference - (pct * circumference);
  }

  // Update dashboard CGPA card
  const dashCGPA = document.getElementById('dash-cgpa');
  const dashCourses = document.getElementById('dash-courses');
  if (dashCGPA) dashCGPA.textContent = semesters.length > 0 ? cgpa.toFixed(2) : '—';
  if (dashCourses) {
    const total = semesters.reduce((s, sem) => s + sem.courses.length, 0);
    dashCourses.textContent = total;
  }
}

/** Returns CSS class for SGPA badge based on value */
function getSGPABadgeClass(sgpa) {
  if (sgpa === 0)   return '';
  if (sgpa >= 8.5)  return 'excellent';
  if (sgpa >= 7.0)  return 'good';
  if (sgpa >= 5.0)  return 'average';
  return 'poor';
}

function toggleSemester(semId) {
  const body    = document.getElementById(`body-${semId}`);
  const chevron = document.getElementById(`chevron-${semId}`);
  const isOpen  = body.style.maxHeight && body.style.maxHeight !== '0px';

  if (isOpen) {
    body.style.maxHeight = '0px';
    body.style.paddingBottom = '0';
    chevron.style.transform = 'rotate(0deg)';
  } else {
    body.style.maxHeight = body.scrollHeight + 500 + 'px';
    body.style.paddingBottom = '';
    chevron.style.transform = 'rotate(180deg)';
  }
}

/** Open all semester accordions by default on first render */
function openAllSemesters() {
  semesters.forEach(sem => {
    const body = document.getElementById(`body-${sem.id}`);
    const chevron = document.getElementById(`chevron-${sem.id}`);
    if (body) {
      body.style.maxHeight = '1000px';
      chevron && (chevron.style.transform = 'rotate(180deg)');
    }
  });
}

function renderGradeScaleTable() {
  const tbody = document.getElementById('grade-scale-table');
  if (!tbody) return;
  const scale = GRADE_SCALES[GPA_SCALE] || GRADE_SCALES[10];
  tbody.innerHTML = scale.map(g => `
    <tr>
      <td class="py-1.5 pr-4 font-bold ${g.color}">${g.letter}</td>
      <td class="py-1.5 pr-4 font-semibold text-slate-700 dark:text-slate-300">${g.points}</td>
      <td class="py-1.5 text-slate-500 dark:text-slate-400">${g.range}</td>
    </tr>
  `).join('');
}

function setGpaScale(scale) {
  GPA_SCALE = scale;
  localStorage.setItem('gradesync_gpa_scale', scale);
  // Recalculate all gradePoints with new scale mapping
  semesters.forEach(sem => {
    sem.courses.forEach(course => {
      course.gradePoints = getGradePoints(course.grade);
    });
  });
  saveSemesters();
  renderGradeScaleTable();
  renderAllSemesters();
  updateGPAScorecard();
  setTimeout(openAllSemesters, 50);
  showToast(`Switched to ${scale}-point GPA scale`, 'success');
}

// ── Escape HTML to prevent XSS ───────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
