/* ═══════════════════════════════════════════════════
   app.js  –  SPA orchestrator
   Handles: tab routing, timetable, dark mode,
   dashboard rendering, settings, data export/import,
   toast notifications, and confirm dialogs.
════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════
//  Constants & State
// ══════════════════════════════════════════════════

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CLASS_COLORS = [
  { bg: 'bg-indigo-100 dark:bg-indigo-900/50', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500', value: 'indigo' },
  { bg: 'bg-sky-100 dark:bg-sky-900/50',       text: 'text-sky-700 dark:text-sky-300',       dot: 'bg-sky-500',    value: 'sky'    },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', value: 'emerald' },
  { bg: 'bg-amber-100 dark:bg-amber-900/50',   text: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-500',  value: 'amber'  },
  { bg: 'bg-rose-100 dark:bg-rose-900/50',     text: 'text-rose-700 dark:text-rose-300',     dot: 'bg-rose-500',   value: 'rose'   },
  { bg: 'bg-violet-100 dark:bg-violet-900/50', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500', value: 'violet' },
  { bg: 'bg-pink-100 dark:bg-pink-900/50',     text: 'text-pink-700 dark:text-pink-300',     dot: 'bg-pink-500',   value: 'pink'   },
  { bg: 'bg-teal-100 dark:bg-teal-900/50',     text: 'text-teal-700 dark:text-teal-300',     dot: 'bg-teal-500',   value: 'teal'   },
];

// Timetable class store
let classes = [];

// Selected color index in class modal
let selectedColorIndex = 0;

// Active tab
let activeTab = 'dashboard';

// Confirm dialog callback
let confirmCallback = null;

// Profile settings
let profile = { name: 'Student', university: '' };

// ══════════════════════════════════════════════════
//  Boot
// ══════════════════════════════════════════════════
function initApp() {
  loadClasses();
  loadProfile();
  applyDarkModeFromStorage();
  updateUserUI();
  renderDashboard();
  initGPA();
  initTasks();
  renderTimetable();
  renderColorPicker();
  updateDashboardTaskStats();
  switchTab('dashboard', false);
  startClock();
}

// ══════════════════════════════════════════════════
//  Tab Routing
// ══════════════════════════════════════════════════
function switchTab(tabName, animate = true) {
  activeTab = tabName;

  // Hide all panels
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.add('hidden');
    p.classList.remove('active');
  });

  // Show active panel
  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) {
    panel.classList.remove('hidden');
    if (animate) {
      requestAnimationFrame(() => panel.classList.add('active'));
    }
  }

  // Update sidebar nav active state
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Close mobile menu if open
  closeMobileMenu();

  // Tab-specific refresh
  if (tabName === 'dashboard')  renderDashboard();
  if (tabName === 'timetable')  renderTimetable();
  if (tabName === 'gpa')        { renderAllSemesters(); updateGPAScorecard(); setTimeout(openAllSemesters, 50); }
  if (tabName === 'settings')   renderSettings();
}

// ══════════════════════════════════════════════════
//  Dashboard
// ══════════════════════════════════════════════════
function renderDashboard() {
  renderDateGreeting();
  renderTodayAgenda();
  updateDashboardTaskStats();
  updateGPAScorecard();
}

function renderDateGreeting() {
  const now    = new Date();
  const hour   = now.getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const dayName = now.toLocaleDateString('en-IN', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const greetTimeEl = document.getElementById('greeting-time');
  const greetNameEl = document.getElementById('greeting-name');
  const dateEl      = document.getElementById('current-date-display');
  const todayLabelEl= document.getElementById('today-day-label');
  const ttTodayEl   = document.getElementById('tt-today-label');

  if (greetTimeEl)  greetTimeEl.textContent = greeting;
  if (greetNameEl)  greetNameEl.textContent = profile.name;
  if (dateEl)       dateEl.textContent = dateStr;
  if (todayLabelEl) todayLabelEl.textContent = dayName;
  if (ttTodayEl)    ttTodayEl.textContent = dayName;
}

function renderTodayAgenda() {
  const el = document.getElementById('today-agenda-list');
  if (!el) return;

  const now     = new Date();
  const dayAbbr = getDayAbbr(now.getDay()); // 0=Sun → skip, 1=Mon → 'Mon', etc.
  const todayClasses = classes
    .filter(c => c.days && c.days.includes(dayAbbr))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (todayClasses.length === 0) {
    el.innerHTML = `
      <div class="text-center py-10">
        <div class="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-3">
          <i class="fa-solid fa-mug-hot text-2xl text-indigo-300"></i>
        </div>
        <p class="text-sm font-semibold text-slate-600 dark:text-slate-400">No classes today!</p>
        <p class="text-xs text-slate-400 mt-1">Enjoy your free day ☀️</p>
      </div>`;
    return;
  }

  el.innerHTML = todayClasses.map(cls => {
    const color = CLASS_COLORS.find(c => c.value === cls.color) || CLASS_COLORS[0];
    const isNow = isClassNow(cls, now);
    return `
      <div class="agenda-slot ${isNow ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : ''}">
        <div class="w-9 h-9 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0">
          <i class="fa-solid fa-chalkboard-user ${color.text} text-sm"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(cls.name)}</p>
          <p class="text-xs text-slate-400">${cls.startTime} – ${cls.endTime} ${cls.room ? '· ' + escapeHtml(cls.room) : ''}</p>
        </div>
        ${isNow ? '<span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full flex-shrink-0 animate-pulse">NOW</span>' : ''}
      </div>
    `;
  }).join('');
}

function isClassNow(cls, now) {
  const [sh, sm] = cls.startTime.split(':').map(Number);
  const [eh, em] = cls.endTime.split(':').map(Number);
  const start  = sh * 60 + sm;
  const end    = eh * 60 + em;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= start && nowMin <= end;
}

/** Convert JS Date.getDay() (0=Sun) to our 'Mon'–'Sat' abbreviation */
function getDayAbbr(dayNum) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayNum] || '';
}

// ══════════════════════════════════════════════════
//  Timetable
// ══════════════════════════════════════════════════

function loadClasses() {
  try {
    classes = JSON.parse(localStorage.getItem('gradesync_classes') || localStorage.getItem('grasdesync_classes') || localStorage.getItem('acadplan_classes') || '[]');
  } catch { classes = []; }
}

function saveClasses() {
  localStorage.setItem('gradesync_classes', JSON.stringify(classes));
}

function openClassModal() {
  // Reset form
  document.getElementById('class-name-input').value  = '';
  document.getElementById('class-room-input').value  = '';
  document.getElementById('class-start-input').value = '';
  document.getElementById('class-end-input').value   = '';

  // Uncheck all day pills
  document.querySelectorAll('.day-cb').forEach(cb => {
    cb.checked = false;
    cb.closest('.day-pill').classList.remove('selected');
  });

  // Day pill toggle listeners
  document.querySelectorAll('.day-pill').forEach(pill => {
    pill.onclick = () => {
      const cb = pill.querySelector('.day-cb');
      cb.checked = !cb.checked;
      pill.classList.toggle('selected', cb.checked);
    };
  });

  // Reset color selection
  selectedColorIndex = 0;
  document.querySelectorAll('.color-swatch').forEach((s, i) => {
    s.classList.toggle('selected', i === 0);
  });

  document.getElementById('class-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('class-name-input').focus(), 100);
}

function closeClassModal() {
  document.getElementById('class-modal').classList.add('hidden');
}

function saveClass() {
  const name  = document.getElementById('class-name-input').value.trim();
  const room  = document.getElementById('class-room-input').value.trim();
  const start = document.getElementById('class-start-input').value;
  const end   = document.getElementById('class-end-input').value;

  const days = [];
  document.querySelectorAll('.day-cb:checked').forEach(cb => days.push(cb.value));

  if (!name) { showToast('Course name is required', 'error'); return; }
  if (days.length === 0) { showToast('Select at least one day', 'error'); return; }
  if (!start || !end)   { showToast('Start and end times are required', 'error'); return; }
  if (start >= end)     { showToast('End time must be after start time', 'error'); return; }

  const color = CLASS_COLORS[selectedColorIndex]?.value || 'indigo';

  classes.push({
    id:        `cls-${Date.now()}`,
    name,
    room,
    days,
    startTime: start,
    endTime:   end,
    color,
  });

  saveClasses();
  closeClassModal();
  renderTimetable();
  renderTodayAgenda();
  showToast('Class added to timetable!', 'success');
}

function deleteClass(classId) {
  showConfirm('Delete Class', 'Remove this class from the timetable?', () => {
    classes = classes.filter(c => c.id !== classId);
    saveClasses();
    renderTimetable();
    renderTodayAgenda();
    showToast('Class removed', 'success');
  });
}

function renderTimetable() {
  renderTodayClassWidget();
  renderWeekGrid();
}

function renderTodayClassWidget() {
  const el  = document.getElementById('today-classes-list');
  if (!el) return;

  const now     = new Date();
  const dayAbbr = getDayAbbr(now.getDay());
  const todayClasses = classes
    .filter(c => c.days?.includes(dayAbbr))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (todayClasses.length === 0) {
    el.innerHTML = `<p class="text-sm text-slate-400 dark:text-slate-500 py-2">No classes today. Enjoy your day! 🌴</p>`;
    return;
  }

  el.innerHTML = todayClasses.map(cls => {
    const color = CLASS_COLORS.find(c => c.value === cls.color) || CLASS_COLORS[0];
    const isNow = isClassNow(cls, now);
    return `
      <div class="inline-flex items-center gap-2 px-3 py-2 rounded-xl ${color.bg} ${color.text} text-sm font-medium ${isNow ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}">
        <span class="w-1.5 h-1.5 rounded-full ${color.dot} ${isNow ? 'animate-pulse' : ''}"></span>
        <span class="font-semibold">${escapeHtml(cls.name)}</span>
        <span class="opacity-70 text-xs">${cls.startTime}–${cls.endTime}</span>
        ${cls.room ? `<span class="opacity-60 text-xs">${escapeHtml(cls.room)}</span>` : ''}
      </div>
    `;
  }).join('');
}

function renderWeekGrid() {
  const grid = document.getElementById('timetable-grid');
  const emptyState = document.getElementById('timetable-empty-state');
  if (!grid) return;

  if (classes.length === 0) {
    grid.innerHTML = '';
    emptyState && emptyState.classList.remove('hidden');
    return;
  }
  emptyState && emptyState.classList.add('hidden');

  // Determine hour range from actual class data (or default 8–20)
  let minHour = 8, maxHour = 20;
  classes.forEach(cls => {
    const sh = parseInt(cls.startTime.split(':')[0]);
    const eh = parseInt(cls.endTime.split(':')[0]) + 1;
    if (sh < minHour) minHour = sh;
    if (eh > maxHour) maxHour = eh;
  });

  const hours = [];
  for (let h = minHour; h <= maxHour; h++) hours.push(h);

  // Header row
  let html = `
    <div class="tt-header sticky left-0 z-10 bg-white dark:bg-slate-900 text-left pl-1">Time</div>
    ${DAYS.map(d => {
      const isToday = getDayAbbr(new Date().getDay()) === d;
      return `<div class="tt-header ${isToday ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : ''}">${d}</div>`;
    }).join('')}
  `;

  // Build a quick lookup: day → sorted list of classes
  const classByDay = {};
  DAYS.forEach(d => { classByDay[d] = []; });
  classes.forEach(cls => {
    cls.days?.forEach(d => {
      if (classByDay[d]) classByDay[d].push(cls);
    });
  });

  hours.forEach(h => {
    const timeLabel = formatHour(h);
    html += `<div class="tt-time-label">${timeLabel}</div>`;
    DAYS.forEach(day => {
      const dayClasses = classByDay[day].filter(cls => {
        const sh = parseInt(cls.startTime.split(':')[0]);
        return sh === h;
      });

      html += `<div class="tt-cell p-0.5">`;
      if (dayClasses.length > 0) {
        dayClasses.forEach(cls => {
          const color = CLASS_COLORS.find(c => c.value === cls.color) || CLASS_COLORS[0];
          const durationH = calcDurationH(cls.startTime, cls.endTime);
          html += `
            <div class="tt-class-block ${color.bg} ${color.text} group relative"
                 style="min-height: ${Math.max(durationH * 50, 44)}px">
              <div class="font-bold text-xs leading-tight truncate">${escapeHtml(cls.name)}</div>
              <div class="text-xs opacity-70 mt-0.5">${cls.startTime}–${cls.endTime}</div>
              ${cls.room ? `<div class="text-xs opacity-60 truncate">${escapeHtml(cls.room)}</div>` : ''}
              <button onclick="deleteClass('${cls.id}')"
                class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full bg-black/10 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                <i class="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
          `;
        });
      }
      html += `</div>`;
    });
  });

  grid.innerHTML = html;
}

function formatHour(h) {
  if (h === 0)   return '12 AM';
  if (h < 12)    return `${h} AM`;
  if (h === 12)  return '12 PM';
  return `${h - 12} PM`;
}

function calcDurationH(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

function renderColorPicker() {
  const el = document.getElementById('color-picker');
  if (!el) return;
  el.innerHTML = CLASS_COLORS.map((c, i) => `
    <div class="color-swatch ${c.dot} ${i === 0 ? 'selected' : ''}"
      onclick="selectColor(${i})" title="${c.value}"></div>
  `).join('');
}

function selectColor(index) {
  selectedColorIndex = index;
  document.querySelectorAll('.color-swatch').forEach((s, i) => {
    s.classList.toggle('selected', i === index);
  });
}

// ══════════════════════════════════════════════════
//  Dark Mode
// ══════════════════════════════════════════════════
function applyDarkModeFromStorage() {
  const dark = (localStorage.getItem('gradesync_dark') || localStorage.getItem('grasdesync_dark') || localStorage.getItem('acadplan_dark')) === 'true';
  document.documentElement.classList.toggle('dark', dark);
  updateDarkIcons(dark);
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('gradesync_dark', isDark);
  updateDarkIcons(isDark);
}

function updateDarkIcons(isDark) {
  const icons  = ['dark-icon-mobile', 'dark-icon-sidebar'];
  const label  = document.getElementById('dark-mode-label');

  icons.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.className = isDark
        ? 'fa-solid fa-sun w-5 text-center text-amber-400'
        : 'fa-solid fa-moon w-5 text-center';
    }
  });
  if (label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
}

// ══════════════════════════════════════════════════
//  Mobile Menu
// ══════════════════════════════════════════════════
function toggleMobileMenu() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('mobile-overlay');
  const isOpen   = !sidebar.classList.contains('-translate-x-full');

  if (isOpen) {
    closeMobileMenu();
  } else {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  sidebar.classList.add('-translate-x-full');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

// ══════════════════════════════════════════════════
//  Settings
// ══════════════════════════════════════════════════

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem('gradesync_profile') || localStorage.getItem('grasdesync_profile') || localStorage.getItem('acadplan_profile') || '{}');
    profile.name       = saved.name       || (currentUser?.name) || 'Student';
    profile.university = saved.university || '';
  } catch {
    profile.name = currentUser?.name || 'Student';
  }
}

function saveProfile() {
  profile.name       = document.getElementById('settings-display-name').value.trim() || profile.name;
  profile.university = document.getElementById('settings-university').value.trim();
  localStorage.setItem('gradesync_profile', JSON.stringify(profile));

  // Update guest name if in guest mode
  if (currentUser?.isGuest) {
    localStorage.setItem('gradesync_guest_name', profile.name);
    currentUser.name = profile.name;
  }

  updateUserUI();
  renderDateGreeting();
  showToast('Profile saved!', 'success');
}

function renderSettings() {
  const nameEl  = document.getElementById('settings-display-name');
  const uniEl   = document.getElementById('settings-university');
  const nameDisp= document.getElementById('settings-name');
  const emailDisp=document.getElementById('settings-email');
  const avatarEl= document.getElementById('settings-avatar');

  if (nameEl)   nameEl.value  = profile.name;
  if (uniEl)    uniEl.value   = profile.university;
  if (nameDisp) nameDisp.textContent  = profile.name;
  if (emailDisp) emailDisp.textContent = currentUser?.email || 'guest@local';
  if (avatarEl) avatarEl.textContent  = (profile.name[0] || 'S').toUpperCase();
}

function updateUserUI() {
  const name  = profile.name || currentUser?.name || 'Student';
  const email = currentUser?.email || 'guest@local';

  const nameEls = ['user-name-display', 'greeting-name'];
  nameEls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = name;
  });

  const emailEl = document.getElementById('user-email-display');
  if (emailEl) emailEl.textContent = email;

  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl) avatarEl.textContent = name[0]?.toUpperCase() || 'S';

  // Session badge
  const sessionBadge = document.getElementById('session-type');
  const sessionMode  = document.getElementById('session-badge');
  if (sessionBadge) {
    sessionBadge.textContent = currentUser?.isGuest ? 'Guest Session' : 'Synced Session';
  }
  if (sessionMode) {
    if (currentUser?.isGuest) {
      sessionMode.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
    } else {
      sessionMode.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
    }
  }
}

// ══════════════════════════════════════════════════
//  Data Export / Import / Clear / Demo Data
// ══════════════════════════════════════════════════

function loadSampleDemoData() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  
  // Date helpers for dynamic due dates relative to today
  const inHours = h => new Date(now.getTime() + h * 3600000).toISOString();
  const inDays  = d => new Date(now.getTime() + d * 86400000).toISOString();

  // 1. Sample Semesters & Courses
  semesters = [
    {
      id: 'sem-demo-1',
      name: 'Semester 1',
      courses: [
        { id: 'c-101', name: 'Engineering Mathematics I', credits: 4, grade: 'A+', gradePoints: 9 },
        { id: 'c-102', name: 'Programming in C & C++',  credits: 4, grade: 'O',  gradePoints: 10 },
        { id: 'c-103', name: 'Digital Logic Design',      credits: 3, grade: 'A',  gradePoints: 8 },
        { id: 'c-104', name: 'Communication Skills',      credits: 2, grade: 'A+', gradePoints: 9 },
        { id: 'c-105', name: 'Computing Lab',            credits: 2, grade: 'O',  gradePoints: 10 },
      ]
    },
    {
      id: 'sem-demo-2',
      name: 'Semester 2',
      courses: [
        { id: 'c-201', name: 'Data Structures & Algorithms', credits: 4, grade: 'O',  gradePoints: 10 },
        { id: 'c-202', name: 'Computer Architecture',        credits: 3, grade: 'A',  gradePoints: 8 },
        { id: 'c-203', name: 'Discrete Mathematics',         credits: 4, grade: 'A+', gradePoints: 9 },
        { id: 'c-204', name: 'Environmental Studies',        credits: 2, grade: 'B+', gradePoints: 7 },
        { id: 'c-205', name: 'Data Structures Lab',          credits: 2, grade: 'O',  gradePoints: 10 },
      ]
    },
    {
      id: 'sem-demo-3',
      name: 'Semester 3 (Current)',
      courses: [
        { id: 'c-301', name: 'Operating Systems',            credits: 4, grade: 'A+', gradePoints: 9 },
        { id: 'c-302', name: 'Database Management Systems',  credits: 4, grade: 'O',  gradePoints: 10 },
        { id: 'c-303', name: 'Design & Analysis of Algo',    credits: 4, grade: 'A+', gradePoints: 9 },
        { id: 'c-304', name: 'Web Technologies',             credits: 3, grade: 'O',  gradePoints: 10 },
        { id: 'c-305', name: 'DBMS Lab',                     credits: 2, grade: 'O',  gradePoints: 10 },
      ]
    }
  ];

  // 2. Sample Tasks with live deadlines
  tasks = [
    {
      id: 'task-demo-1',
      title: 'DBMS Lab Project: Normalization & Triggers',
      subject: 'DBMS302',
      type: 'project',
      priority: 'high',
      status: 'todo',
      due: inHours(14), // Due today/tomorrow (under 48h for urgent banner)
      notes: 'Implement 3NF schema and insert audit triggers on SQLite/PostgreSQL.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'task-demo-2',
      title: 'Operating Systems Quiz on Deadlocks',
      subject: 'CS301',
      type: 'quiz',
      priority: 'high',
      status: 'in-progress',
      due: inHours(32), // Also within 48h banner
      notes: 'Review Banker’s Algorithm, Resource Allocation Graph, and Semaphore primitives.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'task-demo-3',
      title: 'DAA Problem Set 4: Greedy & Dynamic Programming',
      subject: 'CS303',
      type: 'assignment',
      priority: 'medium',
      status: 'in-progress',
      due: inDays(4),
      notes: 'Knapsack, Job Sequencing with Deadlines, and Dijkstra proofs.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'task-demo-4',
      title: 'Full Stack Web App Portfolio Demonstration',
      subject: 'CS304',
      type: 'project',
      priority: 'high',
      status: 'done',
      due: inDays(-1),
      notes: 'Present the Student Academic Planner & GPA Calculator to evaluation panel.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'task-demo-5',
      title: 'Mid-Term Exam Preparation: Computer Networks',
      subject: 'CS305',
      type: 'exam',
      priority: 'medium',
      status: 'todo',
      due: inDays(7),
      notes: 'Chapters 1 to 4: OSI Model, TCP/IP, IP addressing, Subnetting.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  ];

  // 3. Sample Timetable
  classes = [
    {
      id: 'cls-1',
      name: 'Operating Systems',
      room: 'Hall B-204',
      days: ['Mon', 'Wed', 'Fri'],
      startTime: '09:00',
      endTime: '10:00',
      color: 'indigo'
    },
    {
      id: 'cls-2',
      name: 'Database Management Systems',
      room: 'Lab 3 (Ground Floor)',
      days: ['Mon', 'Tue', 'Thu'],
      startTime: '10:15',
      endTime: '11:15',
      color: 'sky'
    },
    {
      id: 'cls-3',
      name: 'Design & Analysis of Algorithms',
      room: 'LH-101',
      days: ['Tue', 'Thu', 'Sat'],
      startTime: '11:30',
      endTime: '12:30',
      color: 'amber'
    },
    {
      id: 'cls-4',
      name: 'Web Technologies Lab',
      room: 'CS Lab 2',
      days: ['Wed', 'Fri'],
      startTime: '14:00',
      endTime: '16:00',
      color: 'emerald'
    },
    {
      id: 'cls-5',
      name: 'Project Mentorship Session',
      room: 'Seminar Hall 1',
      days: ['Sat'],
      startTime: '09:30',
      endTime: '11:00',
      color: 'violet'
    }
  ];

  // 4. Sample Profile
  profile.name = 'Arjun Kumar';
  profile.university = 'Institute of Technology & Science';
  localStorage.setItem('gradesync_profile', JSON.stringify(profile));

  // Persist all demo data
  saveSemesters();
  saveTasks();
  saveClasses();

  // Refresh UI
  updateUserUI();
  renderDashboard();
  renderAllSemesters();
  updateGPAScorecard();
  renderTasks();
  renderTimetable();
  updateDashboardTaskStats();
  updateTaskBadge();

  // Switch to dashboard view
  switchTab('dashboard');
  showToast('Demo data loaded successfully! ✨', 'success');
}

function exportData() {
  const data = {
    version:   '1.0',
    exportedAt: new Date().toISOString(),
    profile,
    semesters,
    tasks,
    classes,
    gpaScale:  GPA_SCALE,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href  = url;
  link.download = `gradesync-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Data exported successfully!', 'success');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!data.version) throw new Error('Invalid GradeSync backup file.');

      showConfirm(
        'Import Data',
        'This will replace all your current data. Are you sure?',
        () => {
          if (data.semesters) { semesters = data.semesters; saveSemesters(); }
          if (data.tasks)     { tasks     = data.tasks;     saveTasks(); }
          if (data.classes)   { classes   = data.classes;   saveClasses(); }
          if (data.profile)   { profile   = data.profile;   localStorage.setItem('gradesync_profile', JSON.stringify(profile)); }
          if (data.gpaScale)  { GPA_SCALE = data.gpaScale;  localStorage.setItem('gradesync_gpa_scale', GPA_SCALE); }

          updateUserUI();
          renderDashboard();
          renderAllSemesters();
          updateGPAScorecard();
          renderTasks();
          renderTimetable();
          showToast('Data imported successfully!', 'success');
        }
      );
    } catch (err) {
      showToast('Import failed: ' + (err.message || 'Invalid file'), 'error');
    }
    // Reset file input
    event.target.value = '';
  };
  reader.readAsText(file);
}

function clearAllData() {
  showConfirm(
    'Clear All Data',
    'All semesters, tasks, classes, and settings will be permanently deleted. This cannot be undone!',
    () => {
      semesters = []; tasks = []; classes = [];
      saveSemesters(); saveTasks(); saveClasses();
      localStorage.removeItem('gradesync_profile');
      localStorage.removeItem('gradesync_gpa_scale');
      localStorage.removeItem('grasdesync_profile');
      localStorage.removeItem('grasdesync_gpa_scale');
      localStorage.removeItem('acadplan_profile');
      localStorage.removeItem('acadplan_gpa_scale');
      GPA_SCALE = 10;
      profile = { name: currentUser?.name || 'Student', university: '' };

      renderDashboard();
      renderAllSemesters();
      updateGPAScorecard();
      renderTasks();
      renderTimetable();
      showToast('All data cleared', 'info');
    }
  );
}

// ══════════════════════════════════════════════════
//  Toast Notifications
// ══════════════════════════════════════════════════
let toastTimer = null;

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const inner = document.getElementById('toast-inner');
  const icon  = document.getElementById('toast-icon');
  const msg   = document.getElementById('toast-msg');

  if (!toast) return;

  const styles = {
    success: { icon: 'fa-solid fa-circle-check text-emerald-500',  border: 'border-emerald-200 dark:border-emerald-800', bg: 'bg-white dark:bg-slate-900' },
    error:   { icon: 'fa-solid fa-circle-xmark text-rose-500',     border: 'border-rose-200 dark:border-rose-800',       bg: 'bg-white dark:bg-slate-900' },
    info:    { icon: 'fa-solid fa-circle-info text-blue-500',      border: 'border-blue-200 dark:border-blue-800',       bg: 'bg-white dark:bg-slate-900' },
    warning: { icon: 'fa-solid fa-triangle-exclamation text-amber-500', border: 'border-amber-200 dark:border-amber-800', bg: 'bg-white dark:bg-slate-900' },
  };

  const s = styles[type] || styles.info;
  icon.className  = s.icon + ' text-lg';
  inner.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium max-w-xs ${s.border} ${s.bg}`;
  msg.textContent = message;

  toast.classList.remove('hidden');

  // Auto-dismiss after 3s
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ══════════════════════════════════════════════════
//  Confirm Dialog
// ══════════════════════════════════════════════════
function showConfirm(title, message, onConfirm) {
  confirmCallback = onConfirm;
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-dialog').classList.remove('hidden');

  document.getElementById('confirm-ok-btn').onclick = () => {
    closeConfirm();
    if (typeof confirmCallback === 'function') confirmCallback();
  };
}

function closeConfirm() {
  document.getElementById('confirm-dialog').classList.add('hidden');
  confirmCallback = null;
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  ['task-modal', 'class-modal', 'confirm-dialog'].forEach(id => {
    const modal = document.getElementById(id);
    if (e.target === modal) {
      if (id === 'task-modal')    closeTaskModal();
      if (id === 'class-modal')   closeClassModal();
      if (id === 'confirm-dialog') closeConfirm();
    }
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTaskModal();
    closeClassModal();
    closeConfirm();
  }
});

// ══════════════════════════════════════════════════
//  Clock – updates greeting every minute
// ══════════════════════════════════════════════════
function startClock() {
  renderDateGreeting();
  setInterval(renderDateGreeting, 60000);
}

// ══════════════════════════════════════════════════
//  Shared escape helper (also used in gpa.js / tasks.js)
// ══════════════════════════════════════════════════
// Note: escapeHtml is defined in gpa.js and shared globally.
// If loaded in isolation, define a fallback:
if (typeof escapeHtml === 'undefined') {
  window.escapeHtml = function(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  };
}
