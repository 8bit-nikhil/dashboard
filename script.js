/* ============================================================
   NEXORA — All-in-One Productivity Dashboard Application
   ============================================================ */

(() => {
  'use strict';

  /* -------------------- STORAGE KEYS -------------------- */
  const KEYS = {
    INIT: 'nexora_initialized',
    TASKS: 'nexora_tasks',
    NOTES: 'nexora_notes',
    PROJECTS: 'nexora_projects',
    EVENTS: 'nexora_events',
    SETTINGS: 'nexora_settings',
    FOCUS_STATS: 'nexora_focus_stats',
    CALC_HISTORY: 'nexora_calc_history',
    NOTIFICATIONS: 'nexora_notifications',
  };

  /* -------------------- UTILITIES -------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatDateISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDaysISO(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return formatDateISO(d);
  }

  function formatReadableDate(iso) {
    if (!iso) return 'No date';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHTML(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (err) {
      console.error('Storage error:', err);
    }
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* -------------------- STATE -------------------- */
  const DEFAULT_DASHBOARD_LAYOUT = [
    { id: 'weekly', label: 'Weekly Productivity', visible: true },
    { id: 'weather', label: 'Weather', visible: true },
    { id: 'tasks', label: 'My Tasks', visible: true },
    { id: 'notes', label: 'Quick Notes', visible: true },
    { id: 'focus', label: 'Focus Timer', visible: true },
    { id: 'habits', label: 'Daily Habits', visible: true },
    { id: 'expenses', label: 'Finance Pulse', visible: true },
  ];

  const defaultSettings = {
    userName: 'Alex Morgan',
    userRole: 'Workspace Pro',
    theme: 'light',
    accent: 'emerald',
    defaultCity: 'New Delhi',
    focusMins: 25,
    shortMins: 5,
    longMins: 15,
    clock24: false,
    wc24: false,
    tempUnit: 'C',
    sidebarCollapsed: false,
    dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
  };

  let state = {
    activeView: 'dashboard',
    tasks: [],
    notes: [],
    projects: [],
    events: [],
    settings: { ...defaultSettings },
    focusStats: { date: formatDateISO(), sessions: 0 },
    calcHistory: [],
    notifications: [],
    todoFilter: 'all',
    todoPriorityFilter: 'all',
    todoSearch: '',
    activeNoteId: null,
    notesSearch: '',
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    calSelectedDate: formatDateISO(),
    weatherData: null,
    weatherLoading: false,
    weatherError: null,
    confirmCallback: null,
    dashCustomizing: false,
    deferredInstallPrompt: null,
  };

  const hooks = {
    viewChange: [],
    dashRender: [],
    globalSearch: [],
    cmdActions: [],
    exportData: [],
    importData: [],
    dataReset: [],
  };

  function seedInitialData() {
    if (localStorage.getItem(KEYS.INIT)) return;

    const initialTasks = [
      {
        id: uid(),
        title: 'Finalize Q4 product roadmap presentation',
        priority: 'High',
        dueDate: formatDateISO(),
        notes: 'Include sprint velocity metrics and design milestones.',
        completed: false,
        completedAt: null,
        createdAt: Date.now() - 86400000 * 3,
      },
      {
        id: uid(),
        title: 'Review mobile responsive layout with design team',
        priority: 'Medium',
        dueDate: addDaysISO(1),
        notes: 'Check tablet breakpoint and touch targets.',
        completed: false,
        completedAt: null,
        createdAt: Date.now() - 86400000 * 2,
      },
      {
        id: uid(),
        title: 'Audit API error handling and retry flows',
        priority: 'High',
        dueDate: addDaysISO(2),
        notes: 'Verify Open-Meteo timeout & offline states.',
        completed: false,
        completedAt: null,
        createdAt: Date.now() - 86400000,
      },
      {
        id: uid(),
        title: 'Publish weekly sprint changelog',
        priority: 'Low',
        dueDate: addDaysISO(-1),
        notes: 'Sent to engineering & product channels.',
        completed: true,
        completedAt: addDaysISO(-1),
        createdAt: Date.now() - 86400000 * 4,
      },
      {
        id: uid(),
        title: 'Morning inbox triage & priority planning',
        priority: 'Medium',
        dueDate: formatDateISO(),
        notes: 'Cleared 14 messages and flagged blockers.',
        completed: true,
        completedAt: formatDateISO(),
        createdAt: Date.now() - 86400000 * 2,
      },
      {
        id: uid(),
        title: 'Refactor reusable card components',
        priority: 'Medium',
        dueDate: addDaysISO(-2),
        notes: 'Unified spacing tokens and border radius.',
        completed: true,
        completedAt: addDaysISO(-2),
        createdAt: Date.now() - 86400000 * 5,
      },
      {
        id: uid(),
        title: 'Prepare user interview script',
        priority: 'Low',
        dueDate: addDaysISO(-4),
        notes: '5 core workflow discovery questions.',
        completed: true,
        completedAt: addDaysISO(-4),
        createdAt: Date.now() - 86400000 * 6,
      },
    ];

    const initialNotes = [
      {
        id: uid(),
        title: 'Weekly Sprint Goals',
        tag: 'Work',
        body: '1. Ship NEXORA dashboard v1\n2. Keep focus sessions consistent (4 Pomodoros/day)\n3. Document keyboard shortcuts for faster navigation.',
        updatedAt: Date.now() - 3600000,
      },
      {
        id: uid(),
        title: 'Design System Tokens',
        tag: 'Ideas',
        body: 'Primary Emerald: #10B981\nSurface: #FFFFFF / #F7F9F8\nRadii: 12px inputs, 16px stat cards, 20px containers.',
        updatedAt: Date.now() - 86400000,
      },
      {
        id: uid(),
        title: 'Reading & Learning List',
        tag: 'Personal',
        body: '- Designing Data-Intensive Applications\n- Refactoring UI\n- Deep Work by Cal Newport',
        updatedAt: Date.now() - 86400000 * 2,
      },
    ];

    const initialProjects = [
      {
        id: uid(),
        name: 'NEXORA Workspace Launch',
        status: 'Active',
        progress: 78,
        dueDate: addDaysISO(5),
        description: 'All-in-one productivity suite with tasks, notes, calendar, and live utilities.',
      },
      {
        id: uid(),
        name: 'Design System v2',
        status: 'Active',
        progress: 45,
        dueDate: addDaysISO(12),
        description: 'Unified emerald theme tokens, accessible dark mode, and responsive grids.',
      },
      {
        id: uid(),
        name: 'Q4 Analytics Refresh',
        status: 'Completed',
        progress: 100,
        dueDate: addDaysISO(-3),
        description: 'Weekly productivity telemetry and completion rate tracking.',
      },
    ];

    const initialEvents = [
      {
        id: uid(),
        title: 'Product Architecture Sync',
        date: formatDateISO(),
        time: '14:00',
        description: 'Review dashboard widgets and performance checklist.',
      },
      {
        id: uid(),
        title: 'Deep Focus Block',
        date: addDaysISO(1),
        time: '09:30',
        description: 'Two consecutive Pomodoro sprints.',
      },
    ];

    const initialNotifs = [
      {
        id: uid(),
        title: 'Welcome to NEXORA',
        message: 'Your workspace is ready. Press "/" anytime to search across tasks, notes, and tools.',
        time: 'Just now',
      },
    ];

    saveJSON(KEYS.TASKS, initialTasks);
    saveJSON(KEYS.NOTES, initialNotes);
    saveJSON(KEYS.PROJECTS, initialProjects);
    saveJSON(KEYS.EVENTS, initialEvents);
    saveJSON(KEYS.SETTINGS, defaultSettings);
    saveJSON(KEYS.NOTIFICATIONS, initialNotifs);
    saveJSON(KEYS.FOCUS_STATS, { date: formatDateISO(), sessions: 0 });
    saveJSON(KEYS.CALC_HISTORY, []);
    localStorage.setItem(KEYS.INIT, '1');
  }

  function loadAllState() {
    seedInitialData();
    state.tasks = loadJSON(KEYS.TASKS, []);
    state.notes = loadJSON(KEYS.NOTES, []);
    state.projects = loadJSON(KEYS.PROJECTS, []);
    state.events = loadJSON(KEYS.EVENTS, []);
    state.settings = { ...defaultSettings, ...loadJSON(KEYS.SETTINGS, {}) };
    state.calcHistory = loadJSON(KEYS.CALC_HISTORY, []);
    state.notifications = loadJSON(KEYS.NOTIFICATIONS, []);

    const focusStats = loadJSON(KEYS.FOCUS_STATS, { date: formatDateISO(), sessions: 0 });
    if (focusStats.date !== formatDateISO()) {
      state.focusStats = { date: formatDateISO(), sessions: 0 };
      saveJSON(KEYS.FOCUS_STATS, state.focusStats);
    } else {
      state.focusStats = focusStats;
    }

    if (state.notes.length > 0) {
      state.activeNoteId = state.notes[0].id;
    }
  }

  /* -------------------- TOAST & CONFIRMATION -------------------- */
  function showToast(message, type = 'info') {
    const container = $('#toastContainer');
    const iconMap = {
      success: 'check-circle-2',
      error: 'alert-circle',
      info: 'info',
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i data-lucide="${iconMap[type] || 'info'}"></i><span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);
    refreshIcons();
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = '0.2s ease';
      setTimeout(() => toast.remove(), 220);
    }, 3000);
  }

  function openModal(id) {
    const el = $(`#${id}`);
    if (el) el.classList.remove('hidden');
  }

  function closeModal(id) {
    const el = $(`#${id}`);
    if (el) el.classList.add('hidden');
  }

  function askConfirm({ title = 'Confirm Action', message, confirmText = 'Delete', onConfirm }) {
    $('#confirmTitle').textContent = title;
    $('#confirmMessage').textContent = message;
    $('#confirmProceedBtn').textContent = confirmText;
    state.confirmCallback = onConfirm;
    openModal('confirmModal');
  }

  /* -------------------- NOTIFICATIONS -------------------- */
  function addNotification(title, message) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    state.notifications.unshift({ id: uid(), title, message, time });
    state.notifications = state.notifications.slice(0, 15);
    saveJSON(KEYS.NOTIFICATIONS, state.notifications);
    renderNotifications();
  }

  function renderNotifications() {
    const list = $('#notificationsList');
    const dot = $('#notificationDot');
    const dueToday = state.tasks.filter((t) => !t.completed && t.dueDate === formatDateISO());

    const combined = [
      ...dueToday.map((t) => ({
        title: 'Task due today',
        message: t.title,
        time: `${t.priority} priority`,
      })),
      ...state.notifications,
    ];

    if (combined.length === 0) {
      dot.classList.add('hidden');
      list.innerHTML = `<div class="empty-state" style="padding:24px 12px;"><i data-lucide="bell-off"></i><p>You're all caught up!</p></div>`;
    } else {
      dot.classList.remove('hidden');
      list.innerHTML = combined
        .map(
          (n) => `
          <div class="notification-item">
            <strong>${escapeHTML(n.title)}</strong>
            <span>${escapeHTML(n.message)}</span>
            <span style="font-size:11px; color:var(--emerald-600);">${escapeHTML(n.time)}</span>
          </div>`
        )
        .join('');
    }
    refreshIcons();
  }

  /* -------------------- THEME, PROFILE & HEADER -------------------- */
  const ACCENT_HEX = {
    emerald: '#10b981',
    teal: '#14b8a6',
    blue: '#3b82f6',
    violet: '#8b5cf6',
    amber: '#f59e0b',
    rose: '#f43f5e',
  };

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    const accent = ACCENT_HEX[state.settings.accent] ? state.settings.accent : 'emerald';
    document.documentElement.setAttribute('data-accent', accent);
    const metaTheme = $('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', ACCENT_HEX[accent]);

    const icon = $('#themeIcon');
    if (icon) {
      icon.setAttribute('data-lucide', state.settings.theme === 'dark' ? 'sun' : 'moon');
    }
    const darkToggle = $('#settingDarkMode');
    if (darkToggle) {
      darkToggle.checked = state.settings.theme === 'dark';
    }
    $$('[data-accent]').forEach((btn) => btn.classList.toggle('active', btn.dataset.accent === accent));
    refreshIcons();
  }

  function applyProfileHeader() {
    const name = state.settings.userName || 'User';
    const parts = name.trim().split(/\s+/);
    const initials = (parts[0]?.[0] || 'N') + (parts[1]?.[0] || parts[0]?.[1] || 'X');
    $('#headerAvatar').textContent = initials.toUpperCase();
    $('#headerUserName').textContent = name;
    $('#headerUserRole').textContent = state.settings.userRole || 'Workspace';

    const now = new Date();
    const hour = now.getHours();
    let greet = 'Good Morning! Welcome Back 👋';
    if (hour >= 12 && hour < 17) greet = 'Good Afternoon! Welcome Back 👋';
    else if (hour >= 17) greet = 'Good Evening! Welcome Back 👋';
    $('#dashboardGreeting').textContent = greet;

    $('#topbarDateText').textContent = now.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function applySidebarState() {
    const shell = $('#appShell');
    const collapsed = Boolean(state.settings.sidebarCollapsed);
    shell.classList.toggle('sidebar-collapsed', collapsed);
    const btnIcon = $('#sidebarCollapseBtn i');
    if (btnIcon) {
      btnIcon.setAttribute('data-lucide', collapsed ? 'panel-left-open' : 'panel-left-close');
      refreshIcons();
    }
  }

  /* -------------------- SPA NAVIGATION -------------------- */
  const VALID_VIEWS = [
    'dashboard',
    'todo',
    'notes',
    'calendar',
    'focus',
    'projects',
    'ai',
    'expenses',
    'habits',
    'bookmarks',
    'weather',
    'calculator',
    'clock',
    'stopwatch',
    'converter',
    'worldclock',
    'qrcode',
    'palette',
    'typing',
    'markdown',
    'settings',
    'help',
  ];

  function navigateTo(viewName) {
    if (!VALID_VIEWS.includes(viewName)) viewName = 'dashboard';
    state.activeView = viewName;

    $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === viewName));
    $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.nav === viewName));

    // Close mobile drawer
    $('#appShell').classList.remove('mobile-nav-open');

    if (window.location.hash !== `#${viewName}`) {
      history.replaceState(null, '', `#${viewName}`);
    }

    if (viewName === 'dashboard') renderDashboard();
    if (viewName === 'todo') renderTodoList();
    if (viewName === 'notes') renderNotesView();
    if (viewName === 'calendar') renderCalendar();
    if (viewName === 'projects') renderProjects();
    if (viewName === 'weather') renderWeatherPage();
    if (viewName === 'clock') updateDigitalClock();
    if (viewName === 'worldclock') updateWorldClock();
    if (viewName === 'settings') populateSettingsForms();

    hooks.viewChange.forEach((fn) => fn(viewName));
    refreshIcons();
  }

  /* -------------------- GLOBAL SEARCH -------------------- */
  const TOOL_DIRECTORY = [
    { label: 'Dashboard', view: 'dashboard', type: 'Page', icon: 'layout-dashboard' },
    { label: 'To-Do List', view: 'todo', type: 'Tool', icon: 'check-square' },
    { label: 'Notes', view: 'notes', type: 'Tool', icon: 'sticky-note' },
    { label: 'Calendar', view: 'calendar', type: 'Tool', icon: 'calendar-days' },
    { label: 'Focus Timer', view: 'focus', type: 'Tool', icon: 'timer' },
    { label: 'Projects', view: 'projects', type: 'Workspace', icon: 'folder-kanban' },
    { label: 'AI Assistant', view: 'ai', type: 'Workspace', icon: 'sparkles' },
    { label: 'Expense Tracker', view: 'expenses', type: 'Workspace', icon: 'wallet' },
    { label: 'Habit Tracker', view: 'habits', type: 'Workspace', icon: 'flame' },
    { label: 'Bookmarks', view: 'bookmarks', type: 'Workspace', icon: 'bookmark' },
    { label: 'Weather', view: 'weather', type: 'Tool', icon: 'cloud-sun' },
    { label: 'Calculator', view: 'calculator', type: 'Tool', icon: 'calculator' },
    { label: 'Digital Clock', view: 'clock', type: 'Tool', icon: 'clock-4' },
    { label: 'Stopwatch', view: 'stopwatch', type: 'Tool', icon: 'watch' },
    { label: 'Unit Converter', view: 'converter', type: 'Tool', icon: 'arrow-left-right' },
    { label: 'World Clock', view: 'worldclock', type: 'Tool', icon: 'globe-2' },
    { label: 'QR Code Generator', view: 'qrcode', type: 'Tool', icon: 'qr-code' },
    { label: 'Color Palette Generator', view: 'palette', type: 'Tool', icon: 'palette' },
    { label: 'Typing Speed Test', view: 'typing', type: 'Tool', icon: 'keyboard' },
    { label: 'Markdown Editor', view: 'markdown', type: 'Tool', icon: 'file-code-2' },
    { label: 'Settings', view: 'settings', type: 'Personal', icon: 'settings' },
    { label: 'Help & Support', view: 'help', type: 'Personal', icon: 'help-circle' },
  ];

  function collectAllSearchResults(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results = [];

    state.tasks
      .filter((t) => t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((t) => {
        results.push({
          title: t.title,
          type: 'Task',
          icon: 'check-square',
          action: () => {
            state.todoSearch = q;
            $('#todoSearchInput').value = query;
            navigateTo('todo');
          },
        });
      });

    state.notes
      .filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((n) => {
        results.push({
          title: n.title || 'Untitled Note',
          type: 'Note',
          icon: 'sticky-note',
          action: () => {
            state.activeNoteId = n.id;
            navigateTo('notes');
          },
        });
      });

    state.projects
      .filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((p) => {
        results.push({
          title: p.name,
          type: 'Project',
          icon: 'folder-kanban',
          action: () => navigateTo('projects'),
        });
      });

    state.events
      .filter((ev) => ev.title.toLowerCase().includes(q) || (ev.description || '').toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((ev) => {
        results.push({
          title: `${ev.title} (${formatReadableDate(ev.date)})`,
          type: 'Event',
          icon: 'calendar-days',
          action: () => {
            state.calSelectedDate = ev.date;
            navigateTo('calendar');
          },
        });
      });

    hooks.globalSearch.forEach((fn) => {
      const extra = fn(q) || [];
      extra.forEach((item) => results.push(item));
    });

    TOOL_DIRECTORY.filter((tool) => tool.label.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((tool) => {
        results.push({
          title: tool.label,
          type: tool.type,
          icon: tool.icon,
          action: () => navigateTo(tool.view),
        });
      });

    return results;
  }

  function handleGlobalSearch(query) {
    const dropdown = $('#globalSearchResults');
    const q = query.trim().toLowerCase();
    if (!q) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }

    const results = collectAllSearchResults(query);

    if (results.length === 0) {
      dropdown.innerHTML = `<div style="padding:14px; text-align:center; color:var(--text-muted);">No matching items or tools found.</div>`;
    } else {
      dropdown.innerHTML = results
        .slice(0, 14)
        .map(
          (r, i) => `
          <div class="search-result-item" data-search-idx="${i}" role="option">
            <i data-lucide="${r.icon}" style="width:16px;height:16px;color:var(--emerald-600);"></i>
            <span>${escapeHTML(r.title)}</span>
            <span class="search-result-type">${escapeHTML(r.type)}</span>
          </div>`
        )
        .join('');

      $$('.search-result-item', dropdown).forEach((el) => {
        el.addEventListener('click', () => {
          const idx = Number(el.dataset.searchIdx);
          results[idx]?.action();
          dropdown.classList.add('hidden');
          $('#globalSearchInput').value = '';
        });
      });
    }

    dropdown.classList.remove('hidden');
    refreshIcons();
  }

  /* -------------------- DASHBOARD CUSTOMIZATION & RENDERING -------------------- */
  function getDashboardLayout() {
    const saved = Array.isArray(state.settings.dashboardLayout) ? state.settings.dashboardLayout : [];
    const map = new Map(saved.map((w) => [w.id, w]));
    const merged = [];
    saved.forEach((w) => {
      const def = DEFAULT_DASHBOARD_LAYOUT.find((d) => d.id === w.id);
      if (def) merged.push({ id: def.id, label: def.label, visible: w.visible !== false });
    });
    DEFAULT_DASHBOARD_LAYOUT.forEach((def) => {
      if (!map.has(def.id)) merged.push({ ...def });
    });
    return merged;
  }

  function applyDashboardLayout() {
    const grid = $('#dashboardGrid');
    if (!grid) return;
    const layout = getDashboardLayout();
    const widgetEls = new Map($$('.dash-widget', grid).map((el) => [el.dataset.widgetId, el]));

    layout.forEach((cfg) => {
      const el = widgetEls.get(cfg.id);
      if (!el) return;
      el.classList.toggle('hidden', !cfg.visible);
      el.setAttribute('draggable', state.dashCustomizing ? 'true' : 'false');
      grid.appendChild(el);
    });

    grid.classList.toggle('customizing', state.dashCustomizing);
    $('#dashCustomizeBar')?.classList.toggle('hidden', !state.dashCustomizing);

    const togglesWrap = $('#dashWidgetToggles');
    if (togglesWrap) {
      togglesWrap.innerHTML = layout
        .map(
          (cfg) => `
          <button class="widget-toggle-chip ${cfg.visible ? 'active' : ''}" type="button" data-toggle-widget="${cfg.id}">
            <i data-lucide="${cfg.visible ? 'eye' : 'eye-off'}" style="width:14px;height:14px;"></i>
            <span>${escapeHTML(cfg.label)}</span>
          </button>`
        )
        .join('');
    }
  }

  function renderDashboard() {
    const total = state.tasks.length;
    const completed = state.tasks.filter((t) => t.completed).length;
    const pending = total - completed;
    const activeProjects = state.projects.filter((p) => p.status === 'Active').length;
    const rate = total ? Math.round((completed / total) * 100) : 0;

    $('#statTotalTasks').textContent = total;
    $('#statCompletedTasks').textContent = completed;
    $('#statCompletedDesc').textContent = `${rate}% completion rate`;
    $('#statPendingTasks').textContent = pending;
    $('#statActiveProjects').textContent = activeProjects;
    $('#navTodoBadge').textContent = pending;

    applyDashboardLayout();
    renderWeeklyChart();
    renderDashTasks();
    renderDashNotes();
    renderDashWeatherWidget();
    hooks.dashRender.forEach((fn) => fn());
    refreshIcons();
  }

  function renderWeeklyChart() {
    const container = $('#weeklyChart');
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = formatDateISO(d);
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      const count = state.tasks.filter((t) => t.completed && t.completedAt === iso).length;
      days.push({ iso, label, count, isToday: i === 0 });
    }

    const totalWeek = days.reduce((s, x) => s + x.count, 0);
    const maxCount = Math.max(...days.map((d) => d.count), 1);
    $('#weeklyTotalBadge').textContent = `${totalWeek} completed`;

    container.innerHTML = days
      .map((d) => {
        const pct = d.count === 0 ? 4 : Math.max(14, Math.round((d.count / maxCount) * 100));
        return `
          <div class="chart-bar-col ${d.isToday ? 'today' : ''}" title="${d.label} (${d.iso}): ${d.count} task(s) completed">
            <span class="chart-bar-value">${d.count}</span>
            <div class="chart-bar-track">
              <div class="chart-bar-fill" style="height:${pct}%"></div>
            </div>
            <span class="chart-bar-day">${d.label}</span>
          </div>`;
      })
      .join('');
  }

  function renderDashTasks() {
    const container = $('#dashTasksList');
    const sorted = [...state.tasks]
      .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 5);

    if (sorted.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="check-square"></i>
          <h3>No tasks yet</h3>
          <p>Add your first task to start tracking your daily progress.</p>
          <button class="btn btn-sm btn-primary" id="dashEmptyTaskBtn" type="button">Add Task</button>
        </div>`;
      $('#dashEmptyTaskBtn')?.addEventListener('click', () => openTaskModal());
      return;
    }

    container.innerHTML = sorted
      .map(
        (t) => `
        <div class="dash-task-item">
          <button class="task-check ${t.completed ? 'checked' : ''}" type="button" data-toggle-task="${t.id}" title="${t.completed ? 'Mark as pending' : 'Mark as completed'}" aria-label="Toggle task completion">
            ${t.completed ? '<i data-lucide="check"></i>' : ''}
          </button>
          <div class="dash-task-info">
            <div class="dash-task-title ${t.completed ? 'done' : ''}">${escapeHTML(t.title)}</div>
            <div class="dash-task-meta">
              <span>${formatReadableDate(t.dueDate)}</span>
              <span>•</span>
              <span>${t.completed ? 'Completed' : 'Pending'}</span>
            </div>
          </div>
          <span class="priority-badge priority-${t.priority}">${t.priority}</span>
        </div>`
      )
      .join('');
  }

  function renderDashNotes() {
    const container = $('#dashNotesList');
    const recent = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

    if (recent.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="sticky-note"></i>
          <h3>No quick notes</h3>
          <p>Jot down ideas or meeting takeaways in seconds.</p>
          <button class="btn btn-sm btn-secondary" id="dashEmptyNoteBtn" type="button">Create Note</button>
        </div>`;
      $('#dashEmptyNoteBtn')?.addEventListener('click', () => openQuickNoteModal());
      return;
    }

    container.innerHTML = recent
      .map(
        (n) => `
        <div class="dash-note-item">
          <div class="dash-note-content">
            <div class="dash-note-title">${escapeHTML(n.title || 'Untitled Note')}</div>
            <div class="dash-note-excerpt">${escapeHTML(n.body || 'Empty note')}</div>
          </div>
          <div class="dash-note-actions">
            <button class="icon-btn-sm" type="button" data-edit-quick-note="${n.id}" title="Edit note">
              <i data-lucide="pencil"></i>
            </button>
            <button class="icon-btn-sm" type="button" data-delete-note="${n.id}" title="Delete note">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>`
      )
      .join('');
  }

  /* -------------------- TOOL 1: TO-DO LIST -------------------- */
  function openTaskModal(taskId = null) {
    const form = $('#taskForm');
    form.reset();
    if (taskId) {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return;
      $('#taskModalTitle').textContent = 'Edit Task';
      $('#taskEditId').value = task.id;
      $('#taskTitleInput').value = task.title;
      $('#taskPriorityInput').value = task.priority;
      $('#taskDueDateInput').value = task.dueDate || formatDateISO();
      $('#taskNotesInput').value = task.notes || '';
    } else {
      $('#taskModalTitle').textContent = 'Add New Task';
      $('#taskEditId').value = '';
      $('#taskDueDateInput').value = formatDateISO();
    }
    openModal('taskModal');
    setTimeout(() => $('#taskTitleInput').focus(), 50);
  }

  function toggleTaskStatus(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? formatDateISO() : null;
    saveJSON(KEYS.TASKS, state.tasks);
    showToast(task.completed ? 'Task marked as completed!' : 'Task moved back to pending.', 'success');
    renderDashboard();
    renderTodoList();
    renderNotifications();
  }

  function deleteTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    askConfirm({
      title: 'Delete Task',
      message: `Are you sure you want to delete "${task.title}"?`,
      onConfirm: () => {
        state.tasks = state.tasks.filter((t) => t.id !== id);
        saveJSON(KEYS.TASKS, state.tasks);
        showToast('Task deleted.', 'info');
        renderDashboard();
        renderTodoList();
        renderNotifications();
      },
    });
  }

  function renderTodoList() {
    const container = $('#todoListContainer');
    let items = [...state.tasks];

    if (state.todoFilter === 'pending') items = items.filter((t) => !t.completed);
    if (state.todoFilter === 'completed') items = items.filter((t) => t.completed);
    if (state.todoPriorityFilter !== 'all') items = items.filter((t) => t.priority === state.todoPriorityFilter);
    if (state.todoSearch.trim()) {
      const q = state.todoSearch.trim().toLowerCase();
      items = items.filter((t) => t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q));
    }

    items.sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate || '').localeCompare(b.dueDate || ''));

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="clipboard-list"></i>
          <h3>No matching tasks</h3>
          <p>Create a new task or adjust your current filters.</p>
          <button class="btn btn-primary btn-sm" id="todoEmptyAddBtn" type="button">Add New Task</button>
        </div>`;
      $('#todoEmptyAddBtn')?.addEventListener('click', () => openTaskModal());
      refreshIcons();
      return;
    }

    container.innerHTML = items
      .map(
        (t) => `
        <div class="todo-row">
          <button class="task-check ${t.completed ? 'checked' : ''}" type="button" data-toggle-task="${t.id}" title="Toggle completion">
            ${t.completed ? '<i data-lucide="check"></i>' : ''}
          </button>
          <div class="todo-row-main">
            <div class="todo-row-title ${t.completed ? 'done' : ''}">${escapeHTML(t.title)}</div>
            ${t.notes ? `<div class="todo-row-notes">${escapeHTML(t.notes)}</div>` : ''}
          </div>
          <div class="todo-row-meta">
            <span class="due-chip"><i data-lucide="calendar"></i>${formatReadableDate(t.dueDate)}</span>
            <span class="priority-badge priority-${t.priority}">${t.priority}</span>
            <button class="icon-btn-sm" type="button" data-edit-task="${t.id}" title="Edit task"><i data-lucide="pencil"></i></button>
            <button class="icon-btn-sm" type="button" data-delete-task="${t.id}" title="Delete task"><i data-lucide="trash-2"></i></button>
          </div>
        </div>`
      )
      .join('');
    refreshIcons();
  }

  /* -------------------- TOOL 2: NOTES -------------------- */
  function openQuickNoteModal(noteId = null) {
    $('#quickNoteForm').reset();
    if (noteId) {
      const note = state.notes.find((n) => n.id === noteId);
      if (!note) return;
      $('#noteModalTitle').textContent = 'Edit Quick Note';
      $('#quickNoteEditId').value = note.id;
      $('#quickNoteTitleInput').value = note.title;
      $('#quickNoteTagInput').value = note.tag || 'General';
      $('#quickNoteBodyInput').value = note.body;
    } else {
      $('#noteModalTitle').textContent = 'Quick Note';
      $('#quickNoteEditId').value = '';
    }
    openModal('noteModal');
    setTimeout(() => $('#quickNoteTitleInput').focus(), 50);
  }

  function createNewNote() {
    const newNote = {
      id: uid(),
      title: 'Untitled Note',
      tag: 'General',
      body: '',
      updatedAt: Date.now(),
    };
    state.notes.unshift(newNote);
    state.activeNoteId = newNote.id;
    saveJSON(KEYS.NOTES, state.notes);
    renderNotesView();
    renderDashboard();
    $('#noteTitleInput').focus();
    $('#noteTitleInput').select();
    showToast('New note created.', 'success');
  }

  function deleteNoteById(id) {
    const note = state.notes.find((n) => n.id === id);
    if (!note) return;
    askConfirm({
      title: 'Delete Note',
      message: `Delete "${note.title || 'Untitled Note'}"? This cannot be undone.`,
      onConfirm: () => {
        state.notes = state.notes.filter((n) => n.id !== id);
        if (state.activeNoteId === id) {
          state.activeNoteId = state.notes[0]?.id || null;
        }
        saveJSON(KEYS.NOTES, state.notes);
        showToast('Note deleted.', 'info');
        renderNotesView();
        renderDashboard();
      },
    });
  }

  function renderNotesView() {
    const listEl = $('#notesListContainer');
    const q = state.notesSearch.trim().toLowerCase();
    const filtered = state.notes
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding:28px 12px;">
          <i data-lucide="file-text"></i>
          <h3>No notes found</h3>
          <p>Create a new note or clear your search filter.</p>
        </div>`;
    } else {
      listEl.innerHTML = filtered
        .map(
          (n) => `
          <button class="note-list-card ${n.id === state.activeNoteId ? 'active' : ''}" type="button" data-select-note="${n.id}">
            <div class="note-list-title">${escapeHTML(n.title || 'Untitled Note')}</div>
            <div class="note-list-preview">${escapeHTML(n.body || 'No content yet...')}</div>
            <div class="note-list-foot">
              <span>${escapeHTML(n.tag || 'General')}</span>
              <span>${new Date(n.updatedAt).toLocaleDateString()}</span>
            </div>
          </button>`
        )
        .join('');
    }

    const active = state.notes.find((n) => n.id === state.activeNoteId);
    if (!active) {
      $('#notesEditorEmpty').classList.remove('hidden');
      $('#notesEditorForm').classList.add('hidden');
    } else {
      $('#notesEditorEmpty').classList.add('hidden');
      $('#notesEditorForm').classList.remove('hidden');
      $('#noteTitleInput').value = active.title;
      $('#noteBodyInput').value = active.body;
      $('#noteTagSelect').value = active.tag || 'General';
      $('#noteTimestampLabel').textContent = `Last updated ${new Date(active.updatedAt).toLocaleString()}`;
    }
    refreshIcons();
  }

  let noteSaveTimer = null;
  function handleActiveNoteEdit() {
    const active = state.notes.find((n) => n.id === state.activeNoteId);
    if (!active) return;
    active.title = $('#noteTitleInput').value;
    active.body = $('#noteBodyInput').value;
    active.tag = $('#noteTagSelect').value;
    active.updatedAt = Date.now();
    $('#noteSaveStatus').textContent = 'Saving...';

    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(() => {
      saveJSON(KEYS.NOTES, state.notes);
      $('#noteSaveStatus').textContent = 'Saved';
      $('#noteTimestampLabel').textContent = `Last updated ${new Date(active.updatedAt).toLocaleString()}`;
      // Refresh sidebar preview silently
      const card = $(`.note-list-card[data-select-note="${active.id}"]`);
      if (card) {
        $('.note-list-title', card).textContent = active.title || 'Untitled Note';
        $('.note-list-preview', card).textContent = active.body || 'No content yet...';
      }
      renderDashNotes();
    }, 220);
  }

  /* -------------------- TOOL 3: WEATHER (OPEN-METEO) -------------------- */
  function mapWeatherCode(code) {
    if (code === 0) return { label: 'Clear Sky', icon: 'sun' };
    if ([1, 2].includes(code)) return { label: 'Partly Cloudy', icon: 'cloud-sun' };
    if (code === 3) return { label: 'Overcast', icon: 'cloud' };
    if ([45, 48].includes(code)) return { label: 'Foggy', icon: 'cloud-fog' };
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { label: 'Rainy', icon: 'cloud-rain' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snowy', icon: 'snowflake' };
    if ([95, 96, 99].includes(code)) return { label: 'Thunderstorm', icon: 'cloud-lightning' };
    return { label: 'Variable Clouds', icon: 'cloud-sun' };
  }

  function formatTemp(celsius) {
    if (typeof celsius !== 'number' || Number.isNaN(celsius)) return '--';
    if (state.settings.tempUnit === 'F') {
      return `${Math.round((celsius * 9) / 5 + 32)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  }

  async function fetchWeatherForCity(cityName) {
    const city = (cityName || '').trim();
    if (!city) return;

    state.weatherLoading = true;
    state.weatherError = null;
    renderDashWeatherWidget();
    if (state.activeView === 'weather') renderWeatherPage();

    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) throw new Error('Unable to reach weather geocoding service.');
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`No location found for "${city}". Try another city name.`);
      }

      const loc = geoData.results[0];
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
      const wxRes = await fetch(forecastUrl);
      if (!wxRes.ok) throw new Error('Unable to fetch forecast data.');
      const wxData = await wxRes.json();

      state.weatherData = {
        city: loc.name,
        country: loc.country || '',
        admin: loc.admin1 || '',
        current: wxData.current,
        daily: wxData.daily,
        fetchedAt: Date.now(),
      };
      state.settings.defaultCity = loc.name;
      saveJSON(KEYS.SETTINGS, state.settings);
    } catch (err) {
      state.weatherError = err.message || 'Failed to load live weather.';
      state.weatherData = null;
    } finally {
      state.weatherLoading = false;
      renderDashWeatherWidget();
      if (state.activeView === 'weather') renderWeatherPage();
    }
  }

  function renderDashWeatherWidget() {
    const body = $('#dashWeatherBody');
    const locLabel = $('#dashWeatherLocationLabel');

    if (state.weatherLoading) {
      locLabel.textContent = 'Fetching live conditions...';
      body.innerHTML = `
        <div class="skeleton skeleton-line lg"></div>
        <div class="skeleton skeleton-line sm"></div>
        <div class="skeleton skeleton-line" style="margin-top:14px;"></div>`;
      return;
    }

    if (state.weatherError || !state.weatherData) {
      locLabel.textContent = 'Unavailable';
      body.innerHTML = `
        <div class="empty-state" style="padding:16px 10px;">
          <i data-lucide="cloud-off"></i>
          <p>${escapeHTML(state.weatherError || 'Search a city to view live weather.')}</p>
          <button class="btn btn-sm btn-secondary" id="dashWeatherRetryBtn" type="button">Retry</button>
        </div>`;
      $('#dashWeatherRetryBtn')?.addEventListener('click', () => fetchWeatherForCity(state.settings.defaultCity || 'New Delhi'));
      refreshIcons();
      return;
    }

    const w = state.weatherData;
    const cond = mapWeatherCode(w.current.weather_code);
    locLabel.textContent = `${w.city}${w.country ? ', ' + w.country : ''}`;

    body.innerHTML = `
      <div class="weather-widget-main">
        <div>
          <div class="weather-temp-lg">${formatTemp(w.current.temperature_2m)}</div>
          <div class="weather-cond-label">${cond.label}</div>
        </div>
        <div class="weather-icon-circle"><i data-lucide="${cond.icon}"></i></div>
      </div>
      <div class="weather-widget-metrics">
        <div class="weather-metric"><i data-lucide="droplets"></i><span>Humidity: <strong>${w.current.relative_humidity_2m}%</strong></span></div>
        <div class="weather-metric"><i data-lucide="wind"></i><span>Wind: <strong>${Math.round(w.current.wind_speed_10m)} km/h</strong></span></div>
      </div>`;
    refreshIcons();
  }

  function renderWeatherPage() {
    const container = $('#weatherPageContent');
    $$('[data-temp-unit]').forEach((btn) => btn.classList.toggle('active', btn.dataset.tempUnit === state.settings.tempUnit));

    if (state.weatherLoading) {
      container.innerHTML = `
        <div class="card">
          <div class="skeleton skeleton-line sm" style="width:160px;"></div>
          <div class="skeleton skeleton-line lg" style="margin-top:12px;"></div>
          <div class="skeleton skeleton-line" style="margin-top:16px;"></div>
        </div>`;
      return;
    }

    if (state.weatherError || !state.weatherData) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <i data-lucide="cloud-off"></i>
            <h3>Weather Data Unavailable</h3>
            <p>${escapeHTML(state.weatherError || 'Enter a city above to inspect live conditions.')}</p>
            <button class="btn btn-primary btn-sm" id="weatherPageRetryBtn" type="button">Retry Fetch</button>
          </div>
        </div>`;
      $('#weatherPageRetryBtn')?.addEventListener('click', () => fetchWeatherForCity(state.settings.defaultCity || 'New Delhi'));
      refreshIcons();
      return;
    }

    const w = state.weatherData;
    const cond = mapWeatherCode(w.current.weather_code);

    const forecastHTML = w.daily.time
      .map((dateStr, i) => {
        const dayCond = mapWeatherCode(w.daily.weather_code[i]);
        const label = i === 0 ? 'Today' : new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
        return `
          <div class="forecast-day-card">
            <strong style="font-size:13px;">${label}</strong>
            <i data-lucide="${dayCond.icon}" style="color:var(--emerald-600);width:26px;height:26px;"></i>
            <span style="font-size:12px;color:var(--text-muted);">${dayCond.label}</span>
            <div style="font-weight:700;font-size:14px;">${formatTemp(w.daily.temperature_2m_max[i])} <span style="color:var(--text-muted);font-weight:500;">/ ${formatTemp(w.daily.temperature_2m_min[i])}</span></div>
          </div>`;
      })
      .join('');

    container.innerHTML = `
      <div class="card weather-hero-card">
        <div>
          <span class="pill-badge"><i data-lucide="map-pin" style="width:13px;height:13px;"></i>${escapeHTML(w.city)}${w.admin ? ', ' + escapeHTML(w.admin) : ''}${w.country ? ', ' + escapeHTML(w.country) : ''}</span>
          <div class="weather-big-temp">${formatTemp(w.current.temperature_2m)}</div>
          <div style="display:flex;align-items:center;gap:10px;font-size:16px;font-weight:600;color:var(--text-secondary);">
            <i data-lucide="${cond.icon}" style="color:var(--emerald-600);"></i>
            <span>${cond.label}</span>
          </div>
        </div>
        <div class="weather-details-grid">
          <div class="weather-stat-box"><span>Feels Like</span><strong>${formatTemp(w.current.apparent_temperature)}</strong></div>
          <div class="weather-stat-box"><span>Humidity</span><strong>${w.current.relative_humidity_2m}%</strong></div>
          <div class="weather-stat-box"><span>Wind Speed</span><strong>${w.current.wind_speed_10m} km/h</strong></div>
          <div class="weather-stat-box"><span>Updated</span><strong>${new Date(w.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
        </div>
      </div>
      <div class="forecast-strip">${forecastHTML}</div>`;
    refreshIcons();
  }

  /* -------------------- TOOL 4: CALCULATOR -------------------- */
  const calc = {
    current: '0',
    previous: null,
    operator: null,
    justEvaluated: false,
  };

  function updateCalcDisplay() {
    const opSymbol = { '+': '+', '-': '−', '*': '×', '/': '÷' }[calc.operator] || '';
    $('#calcExpression').textContent = calc.previous !== null && calc.operator ? `${calc.previous} ${opSymbol}` : '\u00A0';
    $('#calcResult').textContent = calc.current;
  }

  function renderCalcHistory() {
    const list = $('#calcHistoryList');
    if (state.calcHistory.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:28px 10px;"><i data-lucide="calculator"></i><p>No calculations yet.</p></div>`;
      refreshIcons();
      return;
    }
    list.innerHTML = state.calcHistory
      .map(
        (h, i) => `
        <div class="calc-history-item" data-calc-hist="${i}">
          <span style="color:var(--text-muted);font-size:13px;">${escapeHTML(h.expr)}</span>
          <strong>${escapeHTML(h.result)}</strong>
        </div>`
      )
      .join('');
  }

  function computeCalc(a, b, op) {
    const x = parseFloat(a);
    const y = parseFloat(b);
    if (Number.isNaN(x) || Number.isNaN(y)) return 'Error';
    let res;
    if (op === '+') res = x + y;
    else if (op === '-') res = x - y;
    else if (op === '*') res = x * y;
    else if (op === '/') {
      if (y === 0) return 'Error';
      res = x / y;
    }
    return String(parseFloat(res.toFixed(10)));
  }

  function handleCalcInput(val) {
    if (calc.current === 'Error' && val !== 'clear') {
      calc.current = '0';
      calc.previous = null;
      calc.operator = null;
    }

    if (/^[0-9]$/.test(val)) {
      if (calc.justEvaluated) {
        calc.current = val;
        calc.justEvaluated = false;
      } else {
        calc.current = calc.current === '0' ? val : calc.current + val;
      }
    } else if (val === '.') {
      if (calc.justEvaluated) {
        calc.current = '0.';
        calc.justEvaluated = false;
      } else if (!calc.current.includes('.')) {
        calc.current += '.';
      }
    } else if (val === 'clear') {
      calc.current = '0';
      calc.previous = null;
      calc.operator = null;
      calc.justEvaluated = false;
    } else if (val === 'backspace') {
      if (calc.justEvaluated) {
        calc.current = '0';
        calc.justEvaluated = false;
      } else {
        calc.current = calc.current.length > 1 ? calc.current.slice(0, -1) : '0';
      }
    } else if (val === 'percent') {
      const n = parseFloat(calc.current);
      if (!Number.isNaN(n)) calc.current = String(parseFloat((n / 100).toFixed(10)));
    } else if (['+', '-', '*', '/'].includes(val)) {
      if (calc.operator && calc.previous !== null && !calc.justEvaluated) {
        const res = computeCalc(calc.previous, calc.current, calc.operator);
        calc.current = res;
        calc.previous = res === 'Error' ? null : res;
      } else {
        calc.previous = calc.current;
      }
      calc.operator = val;
      calc.justEvaluated = true;
    } else if (val === '=') {
      if (calc.operator && calc.previous !== null) {
        const sym = { '+': '+', '-': '−', '*': '×', '/': '÷' }[calc.operator];
        const expr = `${calc.previous} ${sym} ${calc.current}`;
        const res = computeCalc(calc.previous, calc.current, calc.operator);
        calc.current = res;
        calc.previous = null;
        calc.operator = null;
        calc.justEvaluated = true;
        if (res !== 'Error') {
          state.calcHistory.unshift({ expr, result: res });
          state.calcHistory = state.calcHistory.slice(0, 15);
          saveJSON(KEYS.CALC_HISTORY, state.calcHistory);
          renderCalcHistory();
        }
      }
    }
    updateCalcDisplay();
  }

  /* -------------------- TOOL 5: DIGITAL CLOCK -------------------- */
  function updateDigitalClock() {
    const now = new Date();
    const use24 = state.settings.clock24;
    $$('[data-clock-format]').forEach((b) => b.classList.toggle('active', (b.dataset.clockFormat === '24') === use24));

    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const ampmEl = $('#digitalClockAmPm');

    if (use24) {
      $('#digitalClockMain').textContent = `${String(h).padStart(2, '0')}:${m}:${s}`;
      ampmEl.textContent = '';
      ampmEl.classList.add('hidden');
    } else {
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      $('#digitalClockMain').textContent = `${String(h).padStart(2, '0')}:${m}:${s}`;
      ampmEl.textContent = ampm;
      ampmEl.classList.remove('hidden');
    }

    $('#digitalClockDate').textContent = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    try {
      $('#clockTimezoneLabel').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time';
    } catch {
      $('#clockTimezoneLabel').textContent = 'Local Time';
    }
  }

  /* -------------------- TOOL 6: STOPWATCH -------------------- */
  const stopwatch = {
    running: false,
    elapsed: 0,
    startTime: 0,
    rafId: null,
    laps: [],
    lastLapTotal: 0,
  };

  function formatStopwatchParts(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return {
      main: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      ms: `.${String(centis).padStart(2, '0')}`,
    };
  }

  function renderStopwatchDisplay() {
    const currentMs = stopwatch.running ? stopwatch.elapsed + (performance.now() - stopwatch.startTime) : stopwatch.elapsed;
    const parts = formatStopwatchParts(currentMs);
    $('#stopwatchMain').textContent = parts.main;
    $('#stopwatchMs').textContent = parts.ms;
  }

  function tickStopwatch() {
    if (!stopwatch.running) return;
    renderStopwatchDisplay();
    stopwatch.rafId = requestAnimationFrame(tickStopwatch);
  }

  function renderLaps() {
    const list = $('#swLapsList');
    $('#swLapCount').textContent = `${stopwatch.laps.length} lap${stopwatch.laps.length === 1 ? '' : 's'}`;
    if (stopwatch.laps.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:28px 10px;"><i data-lucide="flag"></i><p>Click "Lap" while running to record splits.</p></div>`;
      refreshIcons();
      return;
    }
    list.innerHTML = stopwatch.laps
      .map(
        (l) => `
        <div class="lap-item">
          <strong>Lap ${l.num}</strong>
          <span style="color:var(--emerald-600);">+${l.split}</span>
          <span>${l.total}</span>
        </div>`
      )
      .join('');
  }

  function startStopwatch() {
    if (stopwatch.running) return;
    stopwatch.running = true;
    stopwatch.startTime = performance.now();
    $('#swStartBtn').disabled = true;
    $('#swPauseBtn').disabled = false;
    $('#swLapBtn').disabled = false;
    tickStopwatch();
  }

  function pauseStopwatch() {
    if (!stopwatch.running) return;
    stopwatch.elapsed += performance.now() - stopwatch.startTime;
    stopwatch.running = false;
    cancelAnimationFrame(stopwatch.rafId);
    $('#swStartBtn').disabled = false;
    $('#swPauseBtn').disabled = true;
    $('#swLapBtn').disabled = true;
    renderStopwatchDisplay();
  }

  function resetStopwatch() {
    stopwatch.running = false;
    cancelAnimationFrame(stopwatch.rafId);
    stopwatch.elapsed = 0;
    stopwatch.laps = [];
    stopwatch.lastLapTotal = 0;
    $('#swStartBtn').disabled = false;
    $('#swPauseBtn').disabled = true;
    $('#swLapBtn').disabled = true;
    renderStopwatchDisplay();
    renderLaps();
  }

  function recordLap() {
    if (!stopwatch.running) return;
    const totalMs = stopwatch.elapsed + (performance.now() - stopwatch.startTime);
    const splitMs = totalMs - stopwatch.lastLapTotal;
    stopwatch.lastLapTotal = totalMs;
    const tParts = formatStopwatchParts(totalMs);
    const sParts = formatStopwatchParts(splitMs);
    stopwatch.laps.unshift({
      num: stopwatch.laps.length + 1,
      split: `${sParts.main}${sParts.ms}`,
      total: `${tParts.main}${tParts.ms}`,
    });
    renderLaps();
  }

  /* -------------------- TOOL 7: FOCUS TIMER (POMODORO) -------------------- */
  const FOCUS_CIRCUMFERENCE = 2 * Math.PI * 96; // 603.185

  const focusTimer = {
    mode: 'focus', // focus | short | long
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    running: false,
    intervalId: null,
  };

  function getModeDuration(mode) {
    if (mode === 'short') return (Number(state.settings.shortMins) || 5) * 60;
    if (mode === 'long') return (Number(state.settings.longMins) || 15) * 60;
    return (Number(state.settings.focusMins) || 25) * 60;
  }

  function getModeLabel(mode) {
    if (mode === 'short') return 'Short Break';
    if (mode === 'long') return 'Long Break';
    return 'Focus Session';
  }

  function playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + idx * 0.14 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.14 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.14);
        osc.stop(ctx.currentTime + idx * 0.14 + 0.55);
      });
    } catch {
      // Ignore audio block
    }
  }

  function renderFocusUI() {
    const mins = Math.floor(focusTimer.remainingSeconds / 60);
    const secs = focusTimer.remainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const label = getModeLabel(focusTimer.mode);

    $('#dashFocusDisplay').textContent = formatted;
    $('#focusViewDisplay').textContent = formatted;
    $('#sidebarTimerReadout').textContent = formatted;
    $('#dashFocusModeText').textContent = label;
    $('#focusViewModeLabel').textContent = label;
    $('#focusStatusText').textContent = focusTimer.running ? 'Session in progress...' : 'Paused / Ready';
    $('#focusSessionsBadge').textContent = `${state.focusStats.sessions} session${state.focusStats.sessions === 1 ? '' : 's'} completed today`;

    const progressRatio = focusTimer.totalSeconds > 0 ? focusTimer.remainingSeconds / focusTimer.totalSeconds : 1;
    const offset = FOCUS_CIRCUMFERENCE * (1 - progressRatio);
    const ring = $('#focusRingProgress');
    if (ring) ring.style.strokeDashoffset = String(offset);

    $('#dashFocusStartBtn').disabled = focusTimer.running;
    $('#dashFocusPauseBtn').disabled = !focusTimer.running;
    $('#focusViewStartBtn').disabled = focusTimer.running;
    $('#focusViewPauseBtn').disabled = !focusTimer.running;

    $('.focus-dot')?.classList.toggle('running', focusTimer.running);
    $$('[data-focus-mode]').forEach((btn) => btn.classList.toggle('active', btn.dataset.focusMode === focusTimer.mode));
  }

  function setFocusMode(mode) {
    pauseFocusTimer();
    focusTimer.mode = mode;
    focusTimer.totalSeconds = getModeDuration(mode);
    focusTimer.remainingSeconds = focusTimer.totalSeconds;
    renderFocusUI();
  }

  function startFocusTimer() {
    if (focusTimer.running) return;
    focusTimer.running = true;
    renderFocusUI();
    focusTimer.intervalId = setInterval(() => {
      if (focusTimer.remainingSeconds > 0) {
        focusTimer.remainingSeconds -= 1;
        renderFocusUI();
      } else {
        completeFocusSession();
      }
    }, 1000);
  }

  function pauseFocusTimer() {
    focusTimer.running = false;
    clearInterval(focusTimer.intervalId);
    focusTimer.intervalId = null;
    renderFocusUI();
  }

  function resetFocusTimer() {
    pauseFocusTimer();
    focusTimer.totalSeconds = getModeDuration(focusTimer.mode);
    focusTimer.remainingSeconds = focusTimer.totalSeconds;
    renderFocusUI();
  }

  function completeFocusSession() {
    pauseFocusTimer();
    playChime();
    const label = getModeLabel(focusTimer.mode);

    if (focusTimer.mode === 'focus') {
      if (state.focusStats.date !== formatDateISO()) {
        state.focusStats = { date: formatDateISO(), sessions: 0 };
      }
      state.focusStats.sessions += 1;
      saveJSON(KEYS.FOCUS_STATS, state.focusStats);
    }

    const msg = `${label} completed! Take a moment to recharge.`;
    showToast(msg, 'success');
    addNotification('Timer Finished', msg);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('NEXORA Focus Timer', { body: msg });
      } catch {
        // Ignore browser notification failure
      }
    }

    focusTimer.remainingSeconds = focusTimer.totalSeconds;
    renderFocusUI();
  }

  /* -------------------- TOOL 8: CALENDAR -------------------- */
  function openEventModal(dateStr = state.calSelectedDate, eventId = null) {
    $('#eventForm').reset();
    if (eventId) {
      const ev = state.events.find((e) => e.id === eventId);
      if (!ev) return;
      $('#eventModalTitle').textContent = 'Edit Event';
      $('#eventEditId').value = ev.id;
      $('#eventTitleInput').value = ev.title;
      $('#eventDateInput').value = ev.date;
      $('#eventTimeInput').value = ev.time || '10:00';
      $('#eventDescInput').value = ev.description || '';
    } else {
      $('#eventModalTitle').textContent = 'Add Calendar Event';
      $('#eventEditId').value = '';
      $('#eventDateInput').value = dateStr || formatDateISO();
      $('#eventTimeInput').value = '10:00';
    }
    openModal('eventModal');
    setTimeout(() => $('#eventTitleInput').focus(), 50);
  }

  function deleteEvent(id) {
    const ev = state.events.find((e) => e.id === id);
    if (!ev) return;
    askConfirm({
      title: 'Delete Event',
      message: `Remove "${ev.title}" from your calendar?`,
      onConfirm: () => {
        state.events = state.events.filter((e) => e.id !== id);
        saveJSON(KEYS.EVENTS, state.events);
        showToast('Event removed.', 'info');
        renderCalendar();
      },
    });
  }

  function renderCalendar() {
    const year = state.calYear;
    const month = state.calMonth;
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayISO = formatDateISO();

    $('#calMonthTitle').textContent = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const cells = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push(`<div class="cal-cell empty"></div>`);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = state.events.filter((e) => e.date === iso);
      const isToday = iso === todayISO;
      const isSelected = iso === state.calSelectedDate;
      const dots = dayEvents.slice(0, 3).map(() => `<span class="cal-dot"></span>`).join('');

      cells.push(`
        <button class="cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" type="button" data-cal-date="${iso}">
          <span class="cal-day-num">${day}</span>
          <div class="cal-event-dots">${dots}</div>
        </button>`);
    }

    $('#calendarGrid').innerHTML = cells.join('');
    renderDayEvents();
  }

  function renderDayEvents() {
    const iso = state.calSelectedDate;
    $('#selectedDateHeading').textContent = formatReadableDate(iso);
    const list = state.events
      .filter((e) => e.date === iso)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    $('#selectedDateSub').textContent = `${list.length} scheduled event${list.length === 1 ? '' : 's'}`;
    const container = $('#dayEventsList');

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="calendar"></i>
          <h3>No events scheduled</h3>
          <p>Click "+" to add an event for this date.</p>
        </div>`;
      refreshIcons();
      return;
    }

    container.innerHTML = list
      .map(
        (ev) => `
        <div class="event-card-item">
          <div>
            <span class="event-time-badge">${escapeHTML(ev.time || 'All day')}</span>
            <h4 style="font-size:14px;margin:2px 0;">${escapeHTML(ev.title)}</h4>
            ${ev.description ? `<p style="font-size:12px;color:var(--text-muted);">${escapeHTML(ev.description)}</p>` : ''}
          </div>
          <div style="display:flex;gap:4px;">
            <button class="icon-btn-sm" type="button" data-edit-event="${ev.id}" title="Edit event"><i data-lucide="pencil"></i></button>
            <button class="icon-btn-sm" type="button" data-delete-event="${ev.id}" title="Delete event"><i data-lucide="trash-2"></i></button>
          </div>
        </div>`
      )
      .join('');
    refreshIcons();
  }

  /* -------------------- TOOL 9: UNIT CONVERTER -------------------- */
  const CONVERTER_UNITS = {
    length: {
      units: {
        m: { name: 'Meter (m)', factor: 1 },
        cm: { name: 'Centimeter (cm)', factor: 0.01 },
        mm: { name: 'Millimeter (mm)', factor: 0.001 },
        in: { name: 'Inch (in)', factor: 0.0254 },
        ft: { name: 'Foot (ft)', factor: 0.3048 },
        yd: { name: 'Yard (yd)', factor: 0.9144 },
      },
      defaults: ['m', 'cm'],
    },
    weight: {
      units: {
        kg: { name: 'Kilogram (kg)', factor: 1 },
        g: { name: 'Gram (g)', factor: 0.001 },
        mg: { name: 'Milligram (mg)', factor: 0.000001 },
        lb: { name: 'Pound (lb)', factor: 0.45359237 },
        oz: { name: 'Ounce (oz)', factor: 0.0283495231 },
      },
      defaults: ['kg', 'lb'],
    },
    temperature: {
      units: {
        C: { name: 'Celsius (°C)' },
        F: { name: 'Fahrenheit (°F)' },
        K: { name: 'Kelvin (K)' },
      },
      defaults: ['C', 'F'],
    },
    distance: {
      units: {
        km: { name: 'Kilometer (km)', factor: 1000 },
        mi: { name: 'Mile (mi)', factor: 1609.344 },
        nmi: { name: 'Nautical Mile (nmi)', factor: 1852 },
        m: { name: 'Meter (m)', factor: 1 },
      },
      defaults: ['km', 'mi'],
    },
    time: {
      units: {
        s: { name: 'Second (s)', factor: 1 },
        min: { name: 'Minute (min)', factor: 60 },
        hr: { name: 'Hour (hr)', factor: 3600 },
        day: { name: 'Day', factor: 86400 },
        wk: { name: 'Week', factor: 604800 },
      },
      defaults: ['hr', 'min'],
    },
    data: {
      units: {
        B: { name: 'Byte (B)', factor: 1 },
        KB: { name: 'Kilobyte (KB)', factor: 1024 },
        MB: { name: 'Megabyte (MB)', factor: 1024 ** 2 },
        GB: { name: 'Gigabyte (GB)', factor: 1024 ** 3 },
        TB: { name: 'Terabyte (TB)', factor: 1024 ** 4 },
      },
      defaults: ['GB', 'MB'],
    },
  };

  let activeConvCategory = 'length';

  function convertValue(category, value, fromKey, toKey) {
    if (Number.isNaN(value)) return '';
    if (category === 'temperature') {
      let celsius = value;
      if (fromKey === 'F') celsius = ((value - 32) * 5) / 9;
      else if (fromKey === 'K') celsius = value - 273.15;

      if (toKey === 'C') return celsius;
      if (toKey === 'F') return (celsius * 9) / 5 + 32;
      if (toKey === 'K') return celsius + 273.15;
    }
    const units = CONVERTER_UNITS[category].units;
    const base = value * units[fromKey].factor;
    return base / units[toKey].factor;
  }

  function populateConverterUnits(category) {
    activeConvCategory = category;
    $$('[data-conv-cat]').forEach((b) => b.classList.toggle('active', b.dataset.convCat === category));
    const cfg = CONVERTER_UNITS[category];
    const optionsHTML = Object.entries(cfg.units)
      .map(([k, u]) => `<option value="${k}">${u.name}</option>`)
      .join('');
    $('#convFromUnit').innerHTML = optionsHTML;
    $('#convToUnit').innerHTML = optionsHTML;
    $('#convFromUnit').value = cfg.defaults[0];
    $('#convToUnit').value = cfg.defaults[1];
    runConversion('from');
  }

  function runConversion(direction = 'from') {
    const fromUnit = $('#convFromUnit').value;
    const toUnit = $('#convToUnit').value;
    const fromInput = $('#convFromValue');
    const toInput = $('#convToValue');

    if (direction === 'from') {
      const val = parseFloat(fromInput.value);
      const out = convertValue(activeConvCategory, val, fromUnit, toUnit);
      toInput.value = out === '' ? '' : parseFloat(out.toFixed(6));
    } else {
      const val = parseFloat(toInput.value);
      const out = convertValue(activeConvCategory, val, toUnit, fromUnit);
      fromInput.value = out === '' ? '' : parseFloat(out.toFixed(6));
    }

    const fromName = CONVERTER_UNITS[activeConvCategory].units[fromUnit].name;
    const toName = CONVERTER_UNITS[activeConvCategory].units[toUnit].name;
    $('#convFormulaText').textContent = `${fromInput.value || 0} ${fromName} = ${toInput.value || 0} ${toName}`;
  }

  /* -------------------- TOOL 10: WORLD CLOCK -------------------- */
  const WORLD_CITIES = [
    { city: 'New York', country: 'United States', tz: 'America/New_York' },
    { city: 'London', country: 'United Kingdom', tz: 'Europe/London' },
    { city: 'Tokyo', country: 'Japan', tz: 'Asia/Tokyo' },
    { city: 'Dubai', country: 'United Arab Emirates', tz: 'Asia/Dubai' },
    { city: 'Delhi', country: 'India', tz: 'Asia/Kolkata' },
    { city: 'Singapore', country: 'Singapore', tz: 'Asia/Singapore' },
  ];

  function updateWorldClock() {
    const use24 = state.settings.wc24;
    $$('[data-wc-format]').forEach((b) => b.classList.toggle('active', (b.dataset.wcFormat === '24') === use24));
    const now = new Date();
    const grid = $('#worldClockGrid');

    grid.innerHTML = WORLD_CITIES.map((item) => {
      const timeStr = new Intl.DateTimeFormat('en-US', {
        timeZone: item.tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !use24,
      }).format(now);

      const dateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: item.tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(now);

      const hour24 = Number(
        new Intl.DateTimeFormat('en-US', { timeZone: item.tz, hour: 'numeric', hour12: false }).format(now)
      );
      const isDay = hour24 >= 6 && hour24 < 18;

      return `
        <article class="card world-clock-card">
          <div class="wc-top">
            <div>
              <div class="wc-city">${item.city}</div>
              <div class="wc-zone">${item.country} • ${item.tz}</div>
            </div>
            <span class="stat-icon-wrap" title="${isDay ? 'Daytime' : 'Nighttime'}">
              <i data-lucide="${isDay ? 'sun' : 'moon'}"></i>
            </span>
          </div>
          <div class="wc-time">${timeStr}</div>
          <div class="wc-date">${dateStr}</div>
        </article>`;
    }).join('');
    refreshIcons();
  }

  /* -------------------- PROJECTS -------------------- */
  function openProjectModal(projectId = null) {
    $('#projectForm').reset();
    if (projectId) {
      const p = state.projects.find((x) => x.id === projectId);
      if (!p) return;
      $('#projectModalTitle').textContent = 'Edit Project';
      $('#projectEditId').value = p.id;
      $('#projectNameInput').value = p.name;
      $('#projectStatusInput').value = p.status;
      $('#projectProgressInput').value = p.progress;
      $('#projectDueInput').value = p.dueDate || formatDateISO();
      $('#projectDescInput').value = p.description || '';
    } else {
      $('#projectModalTitle').textContent = 'New Project';
      $('#projectEditId').value = '';
      $('#projectDueInput').value = addDaysISO(7);
      $('#projectProgressInput').value = 25;
    }
    openModal('projectModal');
  }

  function deleteProject(id) {
    const p = state.projects.find((x) => x.id === id);
    if (!p) return;
    askConfirm({
      title: 'Delete Project',
      message: `Are you sure you want to delete project "${p.name}"?`,
      onConfirm: () => {
        state.projects = state.projects.filter((x) => x.id !== id);
        saveJSON(KEYS.PROJECTS, state.projects);
        showToast('Project deleted.', 'info');
        renderProjects();
        renderDashboard();
      },
    });
  }

  function renderProjects() {
    const grid = $('#projectsGrid');
    if (state.projects.length === 0) {
      grid.innerHTML = `
        <div class="card" style="grid-column:1/-1;">
          <div class="empty-state">
            <i data-lucide="folder-kanban"></i>
            <h3>No projects created</h3>
            <p>Organize larger goals into tracked projects with milestones.</p>
            <button class="btn btn-primary btn-sm" id="projectsEmptyBtn" type="button">Create First Project</button>
          </div>
        </div>`;
      $('#projectsEmptyBtn')?.addEventListener('click', () => openProjectModal());
      refreshIcons();
      return;
    }

    grid.innerHTML = state.projects
      .map(
        (p) => `
        <article class="card project-card">
          <div class="card-header" style="margin-bottom:0;">
            <div>
              <h3 class="card-title">${escapeHTML(p.name)}</h3>
              <span class="pill-badge" style="margin-top:6px;">${escapeHTML(p.status)}</span>
            </div>
            <div style="display:flex;gap:4px;">
              <button class="icon-btn-sm" type="button" data-edit-project="${p.id}" title="Edit project"><i data-lucide="pencil"></i></button>
              <button class="icon-btn-sm" type="button" data-delete-project="${p.id}" title="Delete project"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
          <p class="muted-text">${escapeHTML(p.description || 'No description provided.')}</p>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:6px;">
              <span>Progress</span>
              <span>${p.progress}%</span>
            </div>
            <div class="project-progress-bar">
              <div class="project-progress-fill" style="width:${Math.min(100, Math.max(0, p.progress))}%"></div>
            </div>
          </div>
          <div class="project-footer">
            <span>Target Date</span>
            <strong>${formatReadableDate(p.dueDate)}</strong>
          </div>
        </article>`
      )
      .join('');
    refreshIcons();
  }

  /* -------------------- SETTINGS -------------------- */
  function populateSettingsForms() {
    $('#settingUserName').value = state.settings.userName;
    $('#settingUserRole').value = state.settings.userRole;
    $('#settingDefaultCity').value = state.settings.defaultCity;
    $('#settingDarkMode').checked = state.settings.theme === 'dark';
    $('#settingFocusMins').value = state.settings.focusMins;
    $('#settingShortMins').value = state.settings.shortMins;
    $('#settingLongMins').value = state.settings.longMins;
  }

  /* -------------------- EVENT LISTENERS -------------------- */
  function bindEvents() {
    // Sidebar navigation & view triggers
    document.addEventListener('click', (e) => {
      const navTarget = e.target.closest('[data-nav]');
      if (navTarget) {
        e.preventDefault();
        navigateTo(navTarget.dataset.nav);
        return;
      }

      const closeModalBtn = e.target.closest('[data-close-modal]');
      if (closeModalBtn) {
        closeModal(closeModalBtn.dataset.closeModal);
        return;
      }

      // Close modal on backdrop click
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
        return;
      }

      // Task actions
      const toggleBtn = e.target.closest('[data-toggle-task]');
      if (toggleBtn) {
        toggleTaskStatus(toggleBtn.dataset.toggleTask);
        return;
      }
      const editTaskBtn = e.target.closest('[data-edit-task]');
      if (editTaskBtn) {
        openTaskModal(editTaskBtn.dataset.editTask);
        return;
      }
      const deleteTaskBtn = e.target.closest('[data-delete-task]');
      if (deleteTaskBtn) {
        deleteTask(deleteTaskBtn.dataset.deleteTask);
        return;
      }

      // Note actions
      const selectNoteBtn = e.target.closest('[data-select-note]');
      if (selectNoteBtn) {
        state.activeNoteId = selectNoteBtn.dataset.selectNote;
        renderNotesView();
        return;
      }
      const editQuickNoteBtn = e.target.closest('[data-edit-quick-note]');
      if (editQuickNoteBtn) {
        openQuickNoteModal(editQuickNoteBtn.dataset.editQuickNote);
        return;
      }
      const deleteNoteBtn = e.target.closest('[data-delete-note]');
      if (deleteNoteBtn) {
        deleteNoteById(deleteNoteBtn.dataset.deleteNote);
        return;
      }

      // Calendar actions
      const calCell = e.target.closest('[data-cal-date]');
      if (calCell) {
        state.calSelectedDate = calCell.dataset.calDate;
        renderCalendar();
        return;
      }
      const editEvBtn = e.target.closest('[data-edit-event]');
      if (editEvBtn) {
        openEventModal(state.calSelectedDate, editEvBtn.dataset.editEvent);
        return;
      }
      const delEvBtn = e.target.closest('[data-delete-event]');
      if (delEvBtn) {
        deleteEvent(delEvBtn.dataset.deleteEvent);
        return;
      }

      // Project actions
      const editProjBtn = e.target.closest('[data-edit-project]');
      if (editProjBtn) {
        openProjectModal(editProjBtn.dataset.editProject);
        return;
      }
      const delProjBtn = e.target.closest('[data-delete-project]');
      if (delProjBtn) {
        deleteProject(delProjBtn.dataset.deleteProject);
        return;
      }

      // Focus mode pills
      const focusModeBtn = e.target.closest('[data-focus-mode]');
      if (focusModeBtn) {
        setFocusMode(focusModeBtn.dataset.focusMode);
        return;
      }

      // Quick weather cities
      const quickCityBtn = e.target.closest('[data-weather-city]');
      if (quickCityBtn) {
        $('#weatherPageInput').value = quickCityBtn.dataset.weatherCity;
        fetchWeatherForCity(quickCityBtn.dataset.weatherCity);
        return;
      }

      // Calculator history reuse
      const calcHistBtn = e.target.closest('[data-calc-hist]');
      if (calcHistBtn) {
        const entry = state.calcHistory[Number(calcHistBtn.dataset.calcHist)];
        if (entry) {
          calc.current = entry.result;
          calc.justEvaluated = true;
          updateCalcDisplay();
        }
        return;
      }

      // Close dropdowns when clicking outside
      if (!e.target.closest('#globalSearchWrapper')) {
        $('#globalSearchResults').classList.add('hidden');
      }
      if (!e.target.closest('.notification-wrapper')) {
        $('#notificationsDropdown').classList.add('hidden');
      }
    });

    // Sidebar collapse & mobile drawer
    $('#sidebarCollapseBtn').addEventListener('click', () => {
      state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
      saveJSON(KEYS.SETTINGS, state.settings);
      applySidebarState();
    });

    $('#mobileMenuBtn').addEventListener('click', () => {
      $('#appShell').classList.toggle('mobile-nav-open');
    });

    $('#sidebarBackdrop').addEventListener('click', () => {
      $('#appShell').classList.remove('mobile-nav-open');
    });

    // Topbar theme toggle & notifications
    $('#themeToggleBtn').addEventListener('click', () => {
      state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
      saveJSON(KEYS.SETTINGS, state.settings);
      applyTheme();
    });

    $('#notificationsBtn').addEventListener('click', () => {
      $('#notificationsDropdown').classList.toggle('hidden');
    });

    $('#clearNotificationsBtn').addEventListener('click', () => {
      state.notifications = [];
      saveJSON(KEYS.NOTIFICATIONS, []);
      renderNotifications();
      showToast('Notifications cleared.', 'info');
    });

    // Global Search
    $('#globalSearchInput').addEventListener('input', (e) => handleGlobalSearch(e.target.value));

    // Confirm modal buttons
    $('#confirmCancelBtn').addEventListener('click', () => {
      state.confirmCallback = null;
      closeModal('confirmModal');
    });
    $('#confirmProceedBtn').addEventListener('click', () => {
      if (typeof state.confirmCallback === 'function') state.confirmCallback();
      state.confirmCallback = null;
      closeModal('confirmModal');
    });

    // Dashboard Hero buttons
    $('#dashAddTaskBtn').addEventListener('click', () => openTaskModal());
    $('#todoOpenModalBtn').addEventListener('click', () => openTaskModal());
    $('#dashQuickNoteBtn').addEventListener('click', () => openQuickNoteModal());
    $('#dashAddNoteInlineBtn').addEventListener('click', () => openQuickNoteModal());

    // Task Form Submit
    $('#taskForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = $('#taskEditId').value;
      const title = $('#taskTitleInput').value.trim();
      const priority = $('#taskPriorityInput').value;
      const dueDate = $('#taskDueDateInput').value;
      const notes = $('#taskNotesInput').value.trim();
      if (!title) return;

      if (editId) {
        const task = state.tasks.find((t) => t.id === editId);
        if (task) {
          task.title = title;
          task.priority = priority;
          task.dueDate = dueDate;
          task.notes = notes;
        }
        showToast('Task updated.', 'success');
      } else {
        state.tasks.unshift({
          id: uid(),
          title,
          priority,
          dueDate,
          notes,
          completed: false,
          completedAt: null,
          createdAt: Date.now(),
        });
        showToast('Task added!', 'success');
      }
      saveJSON(KEYS.TASKS, state.tasks);
      closeModal('taskModal');
      renderDashboard();
      renderTodoList();
      renderNotifications();
    });

    // Quick Note Form Submit
    $('#quickNoteForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = $('#quickNoteEditId').value;
      const title = $('#quickNoteTitleInput').value.trim();
      const tag = $('#quickNoteTagInput').value;
      const body = $('#quickNoteBodyInput').value.trim();
      if (!title && !body) return;

      if (editId) {
        const note = state.notes.find((n) => n.id === editId);
        if (note) {
          note.title = title || 'Untitled Note';
          note.tag = tag;
          note.body = body;
          note.updatedAt = Date.now();
        }
        showToast('Note updated.', 'success');
      } else {
        const n = {
          id: uid(),
          title: title || 'Quick Note',
          tag,
          body,
          updatedAt: Date.now(),
        };
        state.notes.unshift(n);
        state.activeNoteId = n.id;
        showToast('Quick note saved!', 'success');
      }
      saveJSON(KEYS.NOTES, state.notes);
      closeModal('noteModal');
      renderDashboard();
      if (state.activeView === 'notes') renderNotesView();
    });

    // To-Do Filters
    $$('#todoStatusFilters .filter-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('#todoStatusFilters .filter-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        state.todoFilter = tab.dataset.filter;
        renderTodoList();
      });
    });
    $('#todoPriorityFilter').addEventListener('change', (e) => {
      state.todoPriorityFilter = e.target.value;
      renderTodoList();
    });
    $('#todoSearchInput').addEventListener('input', (e) => {
      state.todoSearch = e.target.value;
      renderTodoList();
    });

    // Notes View Events
    $('#notesNewBtn').addEventListener('click', createNewNote);
    $('#notesEmptyCreateBtn').addEventListener('click', createNewNote);
    $('#notesSearchInput').addEventListener('input', (e) => {
      state.notesSearch = e.target.value;
      renderNotesView();
    });
    $('#noteTitleInput').addEventListener('input', handleActiveNoteEdit);
    $('#noteBodyInput').addEventListener('input', handleActiveNoteEdit);
    $('#noteTagSelect').addEventListener('change', handleActiveNoteEdit);
    $('#noteDeleteBtn').addEventListener('click', () => {
      if (state.activeNoteId) deleteNoteById(state.activeNoteId);
    });

    // Calendar Events
    $('#calPrevMonthBtn').addEventListener('click', () => {
      state.calMonth -= 1;
      if (state.calMonth < 0) {
        state.calMonth = 11;
        state.calYear -= 1;
      }
      renderCalendar();
    });
    $('#calNextMonthBtn').addEventListener('click', () => {
      state.calMonth += 1;
      if (state.calMonth > 11) {
        state.calMonth = 0;
        state.calYear += 1;
      }
      renderCalendar();
    });
    $('#calTodayBtn').addEventListener('click', () => {
      const now = new Date();
      state.calYear = now.getFullYear();
      state.calMonth = now.getMonth();
      state.calSelectedDate = formatDateISO(now);
      renderCalendar();
    });
    $('#calendarAddEventBtn').addEventListener('click', () => openEventModal(state.calSelectedDate));
    $('#addEventForDayBtn').addEventListener('click', () => openEventModal(state.calSelectedDate));
    $('#eventForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = $('#eventEditId').value;
      const title = $('#eventTitleInput').value.trim();
      const date = $('#eventDateInput').value;
      const time = $('#eventTimeInput').value;
      const description = $('#eventDescInput').value.trim();
      if (!title || !date) return;

      if (editId) {
        const ev = state.events.find((x) => x.id === editId);
        if (ev) {
          ev.title = title;
          ev.date = date;
          ev.time = time;
          ev.description = description;
        }
        showToast('Event updated.', 'success');
      } else {
        state.events.push({ id: uid(), title, date, time, description });
        showToast('Event added to calendar!', 'success');
      }
      state.calSelectedDate = date;
      saveJSON(KEYS.EVENTS, state.events);
      closeModal('eventModal');
      renderCalendar();
    });

    // Projects
    $('#newProjectBtn').addEventListener('click', () => openProjectModal());
    $('#projectForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = $('#projectEditId').value;
      const name = $('#projectNameInput').value.trim();
      const status = $('#projectStatusInput').value;
      const progress = Math.min(100, Math.max(0, Number($('#projectProgressInput').value) || 0));
      const dueDate = $('#projectDueInput').value;
      const description = $('#projectDescInput').value.trim();
      if (!name) return;

      if (editId) {
        const p = state.projects.find((x) => x.id === editId);
        if (p) {
          p.name = name;
          p.status = status;
          p.progress = status === 'Completed' ? 100 : progress;
          p.dueDate = dueDate;
          p.description = description;
        }
        showToast('Project updated.', 'success');
      } else {
        state.projects.unshift({
          id: uid(),
          name,
          status,
          progress: status === 'Completed' ? 100 : progress,
          dueDate,
          description,
        });
        showToast('Project created!', 'success');
      }
      saveJSON(KEYS.PROJECTS, state.projects);
      closeModal('projectModal');
      renderProjects();
      renderDashboard();
    });

    // Focus Timer controls (both Dashboard widget & Focus page)
    $('#dashFocusStartBtn').addEventListener('click', startFocusTimer);
    $('#dashFocusPauseBtn').addEventListener('click', pauseFocusTimer);
    $('#dashFocusResetBtn').addEventListener('click', resetFocusTimer);
    $('#focusViewStartBtn').addEventListener('click', startFocusTimer);
    $('#focusViewPauseBtn').addEventListener('click', pauseFocusTimer);
    $('#focusViewResetBtn').addEventListener('click', resetFocusTimer);

    $('#enableBrowserNotifBtn').addEventListener('click', async () => {
      if (!('Notification' in window)) {
        showToast('Desktop notifications are not supported by this browser.', 'error');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') showToast('Desktop notifications enabled!', 'success');
      else showToast('Notification permission was not granted.', 'info');
    });

    // Weather forms & temp toggle
    $('#dashWeatherForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#dashWeatherInput').value.trim();
      if (q) fetchWeatherForCity(q);
    });
    $('#weatherPageForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#weatherPageInput').value.trim();
      if (q) fetchWeatherForCity(q);
    });
    $$('[data-temp-unit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.settings.tempUnit = btn.dataset.tempUnit;
        saveJSON(KEYS.SETTINGS, state.settings);
        renderDashWeatherWidget();
        renderWeatherPage();
      });
    });

    // Calculator
    $$('[data-calc]').forEach((btn) => {
      btn.addEventListener('click', () => handleCalcInput(btn.dataset.calc));
    });
    $('#clearCalcHistoryBtn').addEventListener('click', () => {
      state.calcHistory = [];
      saveJSON(KEYS.CALC_HISTORY, []);
      renderCalcHistory();
      showToast('Calculator history cleared.', 'info');
    });

    // Digital & World Clock format toggles
    $$('[data-clock-format]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.settings.clock24 = btn.dataset.clockFormat === '24';
        saveJSON(KEYS.SETTINGS, state.settings);
        updateDigitalClock();
      });
    });
    $$('[data-wc-format]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.settings.wc24 = btn.dataset.wcFormat === '24';
        saveJSON(KEYS.SETTINGS, state.settings);
        updateWorldClock();
      });
    });

    // Stopwatch
    $('#swStartBtn').addEventListener('click', startStopwatch);
    $('#swPauseBtn').addEventListener('click', pauseStopwatch);
    $('#swLapBtn').addEventListener('click', recordLap);
    $('#swResetBtn').addEventListener('click', resetStopwatch);

    // Unit Converter
    $$('[data-conv-cat]').forEach((btn) => {
      btn.addEventListener('click', () => populateConverterUnits(btn.dataset.convCat));
    });
    $('#convFromValue').addEventListener('input', () => runConversion('from'));
    $('#convToValue').addEventListener('input', () => runConversion('to'));
    $('#convFromUnit').addEventListener('change', () => runConversion('from'));
    $('#convToUnit').addEventListener('change', () => runConversion('from'));
    $('#convSwapBtn').addEventListener('click', () => {
      const tmp = $('#convFromUnit').value;
      $('#convFromUnit').value = $('#convToUnit').value;
      $('#convToUnit').value = tmp;
      runConversion('from');
    });
    $('#convCopyBtn').addEventListener('click', async () => {
      const text = $('#convFormulaText').textContent;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Conversion copied to clipboard!', 'success');
      } catch {
        showToast('Copied: ' + text, 'info');
      }
    });

    // Settings Forms
    $('#settingsProfileForm').addEventListener('submit', (e) => {
      e.preventDefault();
      state.settings.userName = $('#settingUserName').value.trim() || 'Alex Morgan';
      state.settings.userRole = $('#settingUserRole').value.trim() || 'Workspace Pro';
      const city = $('#settingDefaultCity').value.trim();
      if (city && city !== state.settings.defaultCity) {
        state.settings.defaultCity = city;
        fetchWeatherForCity(city);
      }
      saveJSON(KEYS.SETTINGS, state.settings);
      applyProfileHeader();
      showToast('Profile settings saved!', 'success');
    });

    $('#settingDarkMode').addEventListener('change', (e) => {
      state.settings.theme = e.target.checked ? 'dark' : 'light';
      saveJSON(KEYS.SETTINGS, state.settings);
      applyTheme();
    });

    $('#settingsPreferencesForm').addEventListener('submit', (e) => {
      e.preventDefault();
      state.settings.focusMins = Math.max(1, Math.min(120, Number($('#settingFocusMins').value) || 25));
      state.settings.shortMins = Math.max(1, Math.min(60, Number($('#settingShortMins').value) || 5));
      state.settings.longMins = Math.max(1, Math.min(60, Number($('#settingLongMins').value) || 15));
      state.settings.theme = $('#settingDarkMode').checked ? 'dark' : 'light';
      saveJSON(KEYS.SETTINGS, state.settings);
      applyTheme();
      if (!focusTimer.running) resetFocusTimer();
      showToast('Preferences updated!', 'success');
    });

    // Accent color swatches
    $$('[data-accent]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.settings.accent = btn.dataset.accent;
        saveJSON(KEYS.SETTINGS, state.settings);
        applyTheme();
        showToast(`Accent updated to ${btn.dataset.accent}.`, 'success');
      });
    });

    // Dashboard customization & drag-and-drop
    $('#dashCustomizeBtn')?.addEventListener('click', () => {
      state.dashCustomizing = !state.dashCustomizing;
      applyDashboardLayout();
      refreshIcons();
    });
    $('#dashDoneCustomizeBtn')?.addEventListener('click', () => {
      state.dashCustomizing = false;
      applyDashboardLayout();
    });
    $('#dashResetLayoutBtn')?.addEventListener('click', () => {
      state.settings.dashboardLayout = DEFAULT_DASHBOARD_LAYOUT.map((x) => ({ ...x }));
      saveJSON(KEYS.SETTINGS, state.settings);
      applyDashboardLayout();
      refreshIcons();
      showToast('Dashboard layout reset to default.', 'info');
    });

    document.addEventListener('click', (e) => {
      const toggleWidgetBtn = e.target.closest('[data-toggle-widget]');
      if (!toggleWidgetBtn) return;
      const wid = toggleWidgetBtn.dataset.toggleWidget;
      const layout = getDashboardLayout();
      const target = layout.find((w) => w.id === wid);
      if (target) {
        target.visible = !target.visible;
        state.settings.dashboardLayout = layout;
        saveJSON(KEYS.SETTINGS, state.settings);
        applyDashboardLayout();
        refreshIcons();
      }
    });

    let draggedWidgetId = null;
    const dashGrid = $('#dashboardGrid');
    if (dashGrid) {
      dashGrid.addEventListener('dragstart', (e) => {
        if (!state.dashCustomizing) return;
        const card = e.target.closest('.dash-widget');
        if (!card) return;
        draggedWidgetId = card.dataset.widgetId;
        card.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', draggedWidgetId);
        }
      });

      dashGrid.addEventListener('dragover', (e) => {
        if (!state.dashCustomizing || !draggedWidgetId) return;
        e.preventDefault();
        const overCard = e.target.closest('.dash-widget');
        $$('.dash-widget.drag-over', dashGrid).forEach((el) => el.classList.remove('drag-over'));
        if (overCard && overCard.dataset.widgetId !== draggedWidgetId) {
          overCard.classList.add('drag-over');
        }
      });

      dashGrid.addEventListener('drop', (e) => {
        if (!state.dashCustomizing || !draggedWidgetId) return;
        e.preventDefault();
        const targetCard = e.target.closest('.dash-widget');
        $$('.dash-widget.drag-over', dashGrid).forEach((el) => el.classList.remove('drag-over'));
        if (!targetCard || targetCard.dataset.widgetId === draggedWidgetId) return;

        const layout = getDashboardLayout();
        const fromIdx = layout.findIndex((w) => w.id === draggedWidgetId);
        const toIdx = layout.findIndex((w) => w.id === targetCard.dataset.widgetId);
        if (fromIdx > -1 && toIdx > -1) {
          const [moved] = layout.splice(fromIdx, 1);
          layout.splice(toIdx, 0, moved);
          state.settings.dashboardLayout = layout;
          saveJSON(KEYS.SETTINGS, state.settings);
          applyDashboardLayout();
          refreshIcons();
          showToast('Widget order saved.', 'success');
        }
      });

      dashGrid.addEventListener('dragend', () => {
        draggedWidgetId = null;
        $$('.dash-widget', dashGrid).forEach((el) => el.classList.remove('dragging', 'drag-over'));
      });
    }

    // Command Palette (Ctrl+K)
    $('#openCommandPaletteBtn')?.addEventListener('click', openCommandPalette);
    $('#cmdPaletteInput')?.addEventListener('input', (e) => renderCommandPalette(e.target.value));
    $('#cmdPaletteInput')?.addEventListener('keydown', handleCommandPaletteKeydown);

    // Export & Import JSON Backup
    $('#exportDataBtn').addEventListener('click', () => {
      const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        tasks: state.tasks,
        notes: state.notes,
        projects: state.projects,
        events: state.events,
        settings: state.settings,
        focusStats: state.focusStats,
      };
      hooks.exportData.forEach((fn) => Object.assign(payload, fn() || {}));

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexora-backup-${formatDateISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Full NEXORA backup exported.', 'success');
    });

    $('#importDataBtn')?.addEventListener('click', () => $('#importDataInput')?.click());
    $('#importDataInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result || '{}'));
          if (!data || typeof data !== 'object') throw new Error('Invalid JSON structure.');
          askConfirm({
            title: 'Import JSON Backup',
            message: 'Importing this backup will replace your current workspace data. Continue?',
            confirmText: 'Import Backup',
            onConfirm: () => {
              if (Array.isArray(data.tasks)) state.tasks = data.tasks;
              if (Array.isArray(data.notes)) state.notes = data.notes;
              if (Array.isArray(data.projects)) state.projects = data.projects;
              if (Array.isArray(data.events)) state.events = data.events;
              if (data.settings && typeof data.settings === 'object') {
                state.settings = { ...defaultSettings, ...data.settings };
              }
              if (data.focusStats && typeof data.focusStats === 'object') {
                state.focusStats = data.focusStats;
              }
              saveJSON(KEYS.TASKS, state.tasks);
              saveJSON(KEYS.NOTES, state.notes);
              saveJSON(KEYS.PROJECTS, state.projects);
              saveJSON(KEYS.EVENTS, state.events);
              saveJSON(KEYS.SETTINGS, state.settings);
              saveJSON(KEYS.FOCUS_STATS, state.focusStats);
              hooks.importData.forEach((fn) => fn(data));

              applyTheme();
              applyProfileHeader();
              applySidebarState();
              resetFocusTimer();
              renderDashboard();
              renderNotifications();
              populateSettingsForms();
              showToast('Workspace backup imported successfully!', 'success');
            },
          });
        } catch (err) {
          showToast('Import failed: ' + (err.message || 'Invalid JSON file.'), 'error');
        }
      };
      reader.readAsText(file);
    });

    $('#resetAllDataBtn').addEventListener('click', () => {
      askConfirm({
        title: 'Reset Workspace Data',
        message: 'This will erase all saved tasks, notes, projects, events, and settings. Continue?',
        confirmText: 'Reset Everything',
        onConfirm: () => {
          Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
          hooks.dataReset.forEach((fn) => fn());
          loadAllState();
          applyTheme();
          applyProfileHeader();
          applySidebarState();
          resetFocusTimer();
          renderDashboard();
          renderNotifications();
          populateSettingsForms();
          fetchWeatherForCity(state.settings.defaultCity);
          showToast('Workspace reset to fresh defaults.', 'info');
        },
      });
    });

    // Global Keyboard Shortcuts & Calculator Keyboard Support
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      if (e.key === 'Escape') {
        $$('.modal-overlay:not(.hidden)').forEach((m) => m.classList.add('hidden'));
        $('#globalSearchResults').classList.add('hidden');
        $('#notificationsDropdown').classList.add('hidden');
        if (state.activeView === 'calculator' && !isTyping) {
          handleCalcInput('clear');
        }
        return;
      }

      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        $('#globalSearchInput').focus();
        return;
      }

      if (state.activeView === 'calculator' && !isTyping) {
        if (/^[0-9]$/.test(e.key)) handleCalcInput(e.key);
        else if (['+', '-', '*', '/'].includes(e.key)) {
          e.preventDefault();
          handleCalcInput(e.key);
        } else if (e.key === '.') handleCalcInput('.');
        else if (e.key === '%') handleCalcInput('percent');
        else if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault();
          handleCalcInput('=');
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleCalcInput('backspace');
        }
      }
    });
  }

  /* -------------------- COMMAND PALETTE -------------------- */
  let cmdActiveItems = [];
  let cmdSelectedIdx = 0;

  function openCommandPalette() {
    openModal('commandPaletteModal');
    const inp = $('#cmdPaletteInput');
    inp.value = '';
    cmdSelectedIdx = 0;
    renderCommandPalette('');
    setTimeout(() => inp.focus(), 40);
  }

  function renderCommandPalette(query) {
    const container = $('#cmdPaletteResults');
    const q = (query || '').trim().toLowerCase();

    const quickActions = [
      { label: 'New Task', sub: 'Action', icon: 'plus', action: () => openTaskModal() },
      { label: 'Quick Note', sub: 'Action', icon: 'file-plus-2', action: () => openQuickNoteModal() },
      { label: 'Toggle Light / Dark Mode', sub: 'Theme', icon: 'moon', action: () => $('#themeToggleBtn').click() },
      {
        label: focusTimer.running ? 'Pause Focus Timer' : 'Start Focus Timer',
        sub: 'Focus',
        icon: 'timer',
        action: () => (focusTimer.running ? pauseFocusTimer() : startFocusTimer()),
      },
      {
        label: 'Customize Dashboard Layout',
        sub: 'Dashboard',
        icon: 'sliders-horizontal',
        action: () => {
          navigateTo('dashboard');
          state.dashCustomizing = true;
          applyDashboardLayout();
          refreshIcons();
        },
      },
    ];

    hooks.cmdActions.forEach((fn) => {
      const extra = fn() || [];
      extra.forEach((a) => quickActions.push(a));
    });

    const navActions = TOOL_DIRECTORY.map((t) => ({
      label: `Go to ${t.label}`,
      sub: t.type,
      icon: t.icon,
      action: () => navigateTo(t.view),
    }));

    let items = [];
    if (!q) {
      items = [...quickActions, ...navActions];
    } else {
      const matchedQuick = quickActions.filter((a) => a.label.toLowerCase().includes(q));
      const matchedNav = navActions.filter((a) => a.label.toLowerCase().includes(q));
      const workspaceHits = collectAllSearchResults(query).map((r) => ({
        label: r.title,
        sub: r.type,
        icon: r.icon,
        action: r.action,
      }));
      items = [...matchedQuick, ...workspaceHits, ...matchedNav];
    }

    cmdActiveItems = items.slice(0, 16);
    if (cmdSelectedIdx >= cmdActiveItems.length) cmdSelectedIdx = 0;

    if (cmdActiveItems.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:24px;"><p>No matching commands or items.</p></div>`;
      return;
    }

    container.innerHTML = cmdActiveItems
      .map(
        (item, idx) => `
        <button class="cmd-item ${idx === cmdSelectedIdx ? 'selected' : ''}" type="button" data-cmd-idx="${idx}">
          <i data-lucide="${item.icon}"></i>
          <span>${escapeHTML(item.label)}</span>
          <span class="cmd-item-sub">${escapeHTML(item.sub)}</span>
        </button>`
      )
      .join('');

    $$('.cmd-item', container).forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.cmdIdx);
        closeModal('commandPaletteModal');
        cmdActiveItems[idx]?.action();
      });
    });
    refreshIcons();
  }

  function handleCommandPaletteKeydown(e) {
    if (cmdActiveItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cmdSelectedIdx = (cmdSelectedIdx + 1) % cmdActiveItems.length;
      renderCommandPalette($('#cmdPaletteInput').value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cmdSelectedIdx = (cmdSelectedIdx - 1 + cmdActiveItems.length) % cmdActiveItems.length;
      renderCommandPalette($('#cmdPaletteInput').value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = cmdActiveItems[cmdSelectedIdx];
      closeModal('commandPaletteModal');
      chosen?.action();
    }
  }

  /* -------------------- PWA & OFFLINE SUPPORT -------------------- */
  function initPWA() {
    const updateOnlineUI = () => {
      const offline = !navigator.onLine;
      $('#offlineStatusBadge')?.classList.toggle('hidden', !offline);
    };
    window.addEventListener('online', () => {
      updateOnlineUI();
      showToast('Back online.', 'success');
    });
    window.addEventListener('offline', () => {
      updateOnlineUI();
      showToast('You are offline — NEXORA continues working locally.', 'info');
    });
    updateOnlineUI();

    const statusBadge = $('#pwaSupportStatus');
    if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      navigator.serviceWorker
        .register('./sw.js')
        .then(() => {
          if (statusBadge) statusBadge.textContent = 'Offline Ready (Service Worker Active)';
        })
        .catch(() => {
          if (statusBadge) statusBadge.textContent = 'Service Worker unavailable in this context';
        });
    } else if (statusBadge) {
      statusBadge.textContent = 'Serve over http://localhost for PWA offline cache';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      $('#pwaInstallBtn')?.classList.remove('hidden');
    });

    $('#pwaInstallBtn')?.addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      $('#pwaInstallBtn')?.classList.add('hidden');
    });
  }

  /* -------------------- SHARED API FOR MODULES -------------------- */
  function addTaskExternal({ title, priority = 'Medium', dueDate = formatDateISO(), notes = '' }) {
    if (!title || !title.trim()) return null;
    const t = {
      id: uid(),
      title: title.trim(),
      priority,
      dueDate,
      notes,
      completed: false,
      completedAt: null,
      createdAt: Date.now(),
    };
    state.tasks.unshift(t);
    saveJSON(KEYS.TASKS, state.tasks);
    renderDashboard();
    if (state.activeView === 'todo') renderTodoList();
    renderNotifications();
    return t;
  }

  function addNoteExternal({ title, tag = 'General', body = '' }) {
    const n = {
      id: uid(),
      title: (title || 'Untitled Note').trim(),
      tag,
      body,
      updatedAt: Date.now(),
    };
    state.notes.unshift(n);
    state.activeNoteId = n.id;
    saveJSON(KEYS.NOTES, state.notes);
    renderDashboard();
    if (state.activeView === 'notes') renderNotesView();
    return n;
  }

  window.NexoraCore = {
    $,
    $$,
    KEYS,
    state,
    hooks,
    uid,
    formatDateISO,
    addDaysISO,
    formatReadableDate,
    escapeHTML,
    loadJSON,
    saveJSON,
    refreshIcons,
    showToast,
    openModal,
    closeModal,
    askConfirm,
    navigateTo,
    renderDashboard,
    addTaskExternal,
    addNoteExternal,
  };

  /* -------------------- INITIALIZATION -------------------- */
  function init() {
    loadAllState();
    applyTheme();
    applyProfileHeader();
    applySidebarState();
    bindEvents();
    initPWA();

    // Initialize tools
    focusTimer.totalSeconds = getModeDuration('focus');
    focusTimer.remainingSeconds = focusTimer.totalSeconds;
    renderFocusUI();
    updateCalcDisplay();
    renderCalcHistory();
    renderLaps();
    populateConverterUnits('length');
    updateDigitalClock();
    updateWorldClock();
    renderNotifications();

    // Start live 1-second ticker for clocks
    setInterval(() => {
      if (state.activeView === 'clock') updateDigitalClock();
      if (state.activeView === 'worldclock') updateWorldClock();
    }, 1000);

    // Handle initial hash route
    const hashView = window.location.hash.replace('#', '');
    navigateTo(VALID_VIEWS.includes(hashView) ? hashView : 'dashboard');

    // Fetch real live weather from Open-Meteo
    fetchWeatherForCity(state.settings.defaultCity || 'New Delhi');
    refreshIcons();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
