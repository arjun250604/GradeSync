/* ═══════════════════════════════════════════════════
   tasks.js  –  Assignment & Exam Tracker
   Kanban board with CRUD, priority, and deadline logic
════════════════════════════════════════════════════ */

// ── Task store ────────────────────────────────────
let tasks = [];

// ID of the task being edited (null = new task)
let editingTaskId = null;

// Current active Kanban filter
let currentFilter   = 'all';
let currentPriority = '';

// ══════════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════════
function initTasks() {
  loadTasks();
  renderTasks();
  updateTaskBadge();
}

// ══════════════════════════════════════════════════
//  Persistence
// ══════════════════════════════════════════════════
function loadTasks() {
  try {
    tasks = JSON.parse(localStorage.getItem('gradesync_tasks') || localStorage.getItem('grasdesync_tasks') || localStorage.getItem('acadplan_tasks') || '[]');
  } catch { tasks = []; }
}

function saveTasks() {
  localStorage.setItem('gradesync_tasks', JSON.stringify(tasks));
}

// ══════════════════════════════════════════════════
//  Modal open/close
// ══════════════════════════════════════════════════
function openTaskModal(taskId = null) {
  editingTaskId = taskId;
  const modal = document.getElementById('task-modal');
  const title = document.getElementById('task-modal-title');
  const saveTxt = document.getElementById('task-save-btn-text');

  if (taskId) {
    // Edit existing task – pre-fill form
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    title.textContent   = 'Edit Task';
    saveTxt.textContent = 'Update Task';

    document.getElementById('task-title-input').value    = task.title;
    document.getElementById('task-subject-input').value  = task.subject || '';
    document.getElementById('task-type-input').value     = task.type || 'assignment';
    document.getElementById('task-priority-input').value = task.priority;
    document.getElementById('task-status-input').value   = task.status;
    document.getElementById('task-due-input').value      = task.due ? toLocalDatetime(task.due) : '';
    document.getElementById('task-notes-input').value    = task.notes || '';
  } else {
    // New task – reset form
    title.textContent   = 'Add New Task';
    saveTxt.textContent = 'Save Task';
    document.getElementById('task-title-input').value    = '';
    document.getElementById('task-subject-input').value  = '';
    document.getElementById('task-type-input').value     = 'assignment';
    document.getElementById('task-priority-input').value = 'medium';
    document.getElementById('task-status-input').value   = 'todo';
    document.getElementById('task-due-input').value      = '';
    document.getElementById('task-notes-input').value    = '';
  }

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('task-title-input').focus(), 100);
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.add('hidden');
  editingTaskId = null;
}

// ══════════════════════════════════════════════════
//  Save Task (Create / Update)
// ══════════════════════════════════════════════════
function saveTask() {
  const title    = document.getElementById('task-title-input').value.trim();
  const subject  = document.getElementById('task-subject-input').value.trim();
  const type     = document.getElementById('task-type-input').value;
  const priority = document.getElementById('task-priority-input').value;
  const status   = document.getElementById('task-status-input').value;
  const dueRaw   = document.getElementById('task-due-input').value;
  const notes    = document.getElementById('task-notes-input').value.trim();

  if (!title) {
    showToast('Task title is required', 'error');
    document.getElementById('task-title-input').focus();
    return;
  }

  const dueISO = dueRaw ? new Date(dueRaw).toISOString() : null;

  if (editingTaskId) {
    // Update existing
    const task = tasks.find(t => t.id === editingTaskId);
    if (task) {
      task.title    = title;
      task.subject  = subject;
      task.type     = type;
      task.priority = priority;
      task.status   = status;
      task.due      = dueISO;
      task.notes    = notes;
      task.updatedAt = new Date().toISOString();
    }
    showToast('Task updated!', 'success');
  } else {
    // Create new
    tasks.push({
      id:        `task-${Date.now()}`,
      title,
      subject,
      type,
      priority,
      status,
      due:       dueISO,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    showToast('Task added!', 'success');
  }

  saveTasks();
  closeTaskModal();
  renderTasks();
  updateTaskBadge();
  updateDashboardTaskStats();
}

// ══════════════════════════════════════════════════
//  Delete Task
// ══════════════════════════════════════════════════
function deleteTask(taskId) {
  showConfirm('Delete Task', 'This task will be permanently removed.', () => {
    tasks = tasks.filter(t => t.id !== taskId);
    saveTasks();
    renderTasks();
    updateTaskBadge();
    updateDashboardTaskStats();
    showToast('Task deleted', 'success');
  });
}

// ══════════════════════════════════════════════════
//  Quick status toggle (checkbox)
// ══════════════════════════════════════════════════
function toggleTaskDone(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  if (task.status === 'done') {
    task.status = 'todo';
    showToast('Task reopened', 'info');
  } else {
    task.status = 'done';
    showToast('Task marked done! ✅', 'success');
  }
  task.updatedAt = new Date().toISOString();
  saveTasks();
  renderTasks();
  updateTaskBadge();
  updateDashboardTaskStats();
}

// ══════════════════════════════════════════════════
//  Move task between Kanban columns
// ══════════════════════════════════════════════════
function moveTask(taskId, newStatus) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  task.status = newStatus;
  task.updatedAt = new Date().toISOString();
  saveTasks();
  renderTasks();
  updateTaskBadge();
  updateDashboardTaskStats();
  showToast(`Moved to "${newStatus.replace('-', ' ')}"`, 'info');
}

// ══════════════════════════════════════════════════
//  Filtering
// ══════════════════════════════════════════════════
function filterTasks(status) {
  currentFilter = status;
  currentPriority = document.getElementById('priority-filter')?.value || '';

  // Update filter button styles
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === status);
  });

  renderTasks();
}

function getFilteredTasks() {
  return tasks.filter(t => {
    const statusMatch   = currentFilter === 'all' || t.status === currentFilter;
    const priorityMatch = !currentPriority || t.priority === currentPriority;
    return statusMatch && priorityMatch;
  });
}

// ══════════════════════════════════════════════════
//  Render
// ══════════════════════════════════════════════════
function renderTasks() {
  const filtered = getFilteredTasks();

  const todoTasks       = filtered.filter(t => t.status === 'todo');
  const inProgressTasks = filtered.filter(t => t.status === 'in-progress');
  const doneTasks       = filtered.filter(t => t.status === 'done');

  renderColumn('todo-col',       todoTasks,       'todo');
  renderColumn('inprogress-col', inProgressTasks, 'in-progress');
  renderColumn('done-col',       doneTasks,       'done');

  // Update counts
  document.getElementById('todo-count').textContent       = tasks.filter(t => t.status === 'todo').length;
  document.getElementById('inprogress-count').textContent = tasks.filter(t => t.status === 'in-progress').length;
  document.getElementById('done-count').textContent       = tasks.filter(t => t.status === 'done').length;

  // Empty state
  const emptyState = document.getElementById('tasks-empty-state');
  emptyState.classList.toggle('hidden', tasks.length > 0);

  // Urgent banner
  renderUrgentBanner();
  renderUrgentWidget();
}

function renderColumn(colId, colTasks, colStatus) {
  const col = document.getElementById(colId);
  if (!col) return;

  if (colTasks.length === 0) {
    col.innerHTML = `
      <div class="text-center py-8 text-slate-300 dark:text-slate-600 text-sm">
        <i class="fa-solid fa-inbox text-2xl mb-2 opacity-50"></i>
        <p>No tasks here</p>
      </div>`;
    return;
  }

  col.innerHTML = colTasks.map(task => createTaskCardHTML(task)).join('');
}

function createTaskCardHTML(task) {
  const isOverdue = task.due && new Date(task.due) < new Date() && task.status !== 'done';
  const isDone    = task.status === 'done';
  const dueStr    = task.due ? formatDue(task.due, task.status) : null;
  const typeIcon  = getTypeIcon(task.type);

  const statusOptions = `
    <option value="todo"        ${task.status === 'todo'        ? 'selected' : ''}>To Do</option>
    <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
    <option value="done"        ${task.status === 'done'        ? 'selected' : ''}>Done</option>
  `;

  return `
    <div class="task-card priority-${task.priority} ${isDone ? 'done-card' : ''}" id="task-card-${task.id}">
      <div class="flex items-start gap-2.5">
        <!-- Checkbox -->
        <button onclick="toggleTaskDone('${task.id}')"
          class="mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all
                 ${isDone ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'}">
          ${isDone ? '<i class="fa-solid fa-check text-white text-xs"></i>' : ''}
        </button>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <p class="task-title-text text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">${escapeHtml(task.title)}</p>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button onclick="openTaskModal('${task.id}')"
                class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <i class="fa-solid fa-pen-to-square text-xs"></i>
              </button>
              <button onclick="deleteTask('${task.id}')"
                class="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 transition-colors">
                <i class="fa-solid fa-trash-can text-xs"></i>
              </button>
            </div>
          </div>

          <!-- Meta row 1 -->
          <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span class="badge badge-${task.priority}">${task.priority.toUpperCase()}</span>
            <span class="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-full px-2 py-0.5">
              <i class="${typeIcon} text-xs"></i> ${capitalize(task.type)}
            </span>
            ${task.subject ? `<span class="text-xs text-slate-400 font-medium">${escapeHtml(task.subject)}</span>` : ''}
          </div>

          <!-- Due date -->
          ${dueStr ? `
            <div class="flex items-center gap-1 mt-1.5">
              <i class="fa-solid fa-clock text-xs ${isOverdue ? 'text-rose-500' : 'text-slate-400'}"></i>
              <span class="text-xs font-medium ${isOverdue ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}">${dueStr}</span>
              ${isOverdue ? '<span class="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded-full">OVERDUE</span>' : ''}
            </div>
          ` : ''}

          <!-- Notes -->
          ${task.notes ? `<p class="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">${escapeHtml(task.notes)}</p>` : ''}

          <!-- Move dropdown -->
          <div class="mt-2">
            <select onchange="moveTask('${task.id}', this.value)" class="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none cursor-pointer">
              ${statusOptions}
            </select>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════
//  Urgent Banner (within 48h, not done)
// ══════════════════════════════════════════════════
function renderUrgentBanner() {
  const urgent = getUrgentTasks();
  const banner = document.getElementById('urgent-banner');
  const countEl = document.getElementById('urgent-count');
  const namesEl = document.getElementById('urgent-task-names');

  if (urgent.length === 0) {
    banner.classList.add('hidden');
  } else {
    banner.classList.remove('hidden');
    countEl.textContent = urgent.length;
    namesEl.textContent = urgent.map(t => t.title).join(' · ');
  }
}

function renderUrgentWidget() {
  const urgent = getUrgentTasks();
  const el = document.getElementById('urgent-tasks-list');
  if (!el) return;

  if (urgent.length === 0) {
    el.innerHTML = `
      <div class="text-center py-6">
        <i class="fa-solid fa-party-horn text-3xl text-emerald-400 mb-2 opacity-70"></i>
        <p class="text-sm text-slate-400 dark:text-slate-500">Nothing urgent right now!</p>
      </div>`;
    return;
  }

  el.innerHTML = urgent.slice(0, 5).map(task => `
    <div class="flex items-center gap-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800">
      <div class="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 animate-pulse"></div>
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(task.title)}</p>
        <p class="text-xs text-rose-500">${formatDue(task.due, task.status)}</p>
      </div>
    </div>
  `).join('');
}

function getUrgentTasks() {
  const now     = new Date();
  const limit   = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  return tasks.filter(t =>
    t.due && t.status !== 'done' && new Date(t.due) <= limit && new Date(t.due) >= now
  ).sort((a, b) => new Date(a.due) - new Date(b.due));
}

// ══════════════════════════════════════════════════
//  Dashboard Stats
// ══════════════════════════════════════════════════
function updateDashboardTaskStats() {
  const dueEl  = document.getElementById('dash-tasks-due');
  const doneEl = document.getElementById('dash-tasks-done');
  if (dueEl)  dueEl.textContent  = getUrgentTasks().length;
  if (doneEl) doneEl.textContent = tasks.filter(t => t.status === 'done').length;
  renderUrgentWidget();
}

// ══════════════════════════════════════════════════
//  Task badge in sidebar nav
// ══════════════════════════════════════════════════
function updateTaskBadge() {
  const urgent = getUrgentTasks().length;
  const badge  = document.getElementById('task-badge');
  if (!badge) return;
  if (urgent > 0) {
    badge.textContent = urgent > 9 ? '9+' : urgent;
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }
}

// ══════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════

/** Format a due date string for display */
function formatDue(isoStr, status) {
  if (!isoStr) return '';
  const due  = new Date(isoStr);
  const now  = new Date();
  const diff = due - now;
  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);

  if (status === 'done') {
    return `Completed · was due ${due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  }
  if (diff < 0) {
    const ago = Math.abs(hrs);
    return `Overdue by ${ago < 24 ? ago + 'h' : Math.abs(days) + ' day(s)'}`;
  }
  if (hrs < 1)  return `Due in ${mins}m`;
  if (hrs < 24) return `Due in ${hrs}h`;
  if (days < 7) return `Due in ${days} day(s)`;
  return `Due ${due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function toLocalDatetime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getTypeIcon(type) {
  const icons = {
    assignment: 'fa-solid fa-file-pen',
    exam:       'fa-solid fa-graduation-cap',
    project:    'fa-solid fa-diagram-project',
    quiz:       'fa-solid fa-circle-question',
    lab:        'fa-solid fa-flask',
    other:      'fa-solid fa-bookmark',
  };
  return icons[type] || icons.other;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
