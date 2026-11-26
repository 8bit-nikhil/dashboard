/* ============================================================
   NEXORA — Platform Upgrade Modules
   AI Assistant, Expenses, Habits, Bookmarks, QR Code,
   Color Palette, Typing Speed Test & Markdown Editor
   ============================================================ */

(() => {
  'use strict';

  const C = window.NexoraCore;
  if (!C) return;

  const {
    $,
    $$,
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
    addTaskExternal,
    addNoteExternal,
  } = C;

  const MOD_KEYS = {
    AI_CONFIG: 'nexora_ai_config',
    AI_HISTORY: 'nexora_ai_history',
    EXPENSES: 'nexora_expenses',
    HABITS: 'nexora_habits',
    BOOKMARKS: 'nexora_bookmarks',
    PALETTES: 'nexora_palettes',
    TYPING: 'nexora_typing_stats',
    MARKDOWN: 'nexora_markdown_doc',
  };

  /* ============================================================
     1. AI ASSISTANT (CONFIGURABLE API, NO FAKE RESPONSES)
     ============================================================ */
  const DEFAULT_AI_CONFIG = {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    apiKey: '',
  };

  let aiConfig = { ...DEFAULT_AI_CONFIG, ...loadJSON(MOD_KEYS.AI_CONFIG, {}) };
  let aiHistory = loadJSON(MOD_KEYS.AI_HISTORY, []);
  let aiBusy = false;

  function isAiConfigured() {
    if (!aiConfig.endpoint || !aiConfig.model) return false;
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(aiConfig.endpoint);
    return isLocal || Boolean((aiConfig.apiKey || '').trim());
  }

  function extractActionSuggestions(text) {
    const lines = String(text || '').split(/\r?\n/);
    const suggestions = [];
    for (const line of lines) {
      const m = line.match(/^\s*(?:[-*]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.+)$/);
      if (m) {
        const cleaned = m[1].replace(/\*\*/g, '').replace(/`/g, '').trim();
        if (cleaned.length >= 4 && cleaned.length <= 140) suggestions.push(cleaned);
      }
    }
    return [...new Set(suggestions)].slice(0, 6);
  }

  function renderAIView() {
    const banner = $('#aiStatusBanner');
    const configured = isAiConfigured();
    if (configured) {
      banner.innerHTML = `
        <span><strong>Connected:</strong> ${escapeHTML(aiConfig.provider.toUpperCase())} • <code>${escapeHTML(aiConfig.model)}</code></span>
        <span class="pill-badge">API Ready</span>`;
    } else {
      banner.innerHTML = `
        <span><strong>API Not Configured:</strong> Enter your OpenAI, Gemini, OpenRouter, or local Ollama API settings to start chatting.</span>
        <button class="btn btn-primary btn-sm" id="aiBannerConfigBtn" type="button">Configure API</button>`;
      $('#aiBannerConfigBtn')?.addEventListener('click', openAIConfigModal);
    }

    const msgWrap = $('#aiChatMessages');
    if (aiHistory.length === 0 && !aiBusy) {
      msgWrap.innerHTML = `
        <div class="empty-state">
          <i data-lucide="sparkles"></i>
          <h3>NEXORA AI Workspace Assistant</h3>
          <p>${
            configured
              ? 'Ask for sprint breakdowns, task prioritization, or study plans — and convert any suggestion straight into a task.'
              : 'Configure your own API key first. NEXORA never simulates fake AI answers.'
          }</p>
        </div>`;
    } else {
      msgWrap.innerHTML = aiHistory
        .map((m, idx) => {
          if (m.role === 'user') {
            return `<div class="ai-msg user">${escapeHTML(m.content)}</div>`;
          }
          const suggestions = extractActionSuggestions(m.content);
          const actionBtns = suggestions.length
            ? suggestions
                .map(
                  (s, sIdx) =>
                    `<button class="btn btn-secondary btn-sm" type="button" data-ai-add-task="${idx}:${sIdx}" title="Create task from suggestion"><i data-lucide="plus"></i><span>${escapeHTML(
                      s.length > 42 ? s.slice(0, 42) + '…' : s
                    )}</span></button>`
                )
                .join('')
            : `<button class="btn btn-secondary btn-sm" type="button" data-ai-add-summary="${idx}"><i data-lucide="plus"></i><span>Save as Task</span></button>`;

          return `
            <div class="ai-msg assistant">
              <div>${escapeHTML(m.content)}</div>
              <div class="ai-msg-actions">${actionBtns}</div>
            </div>`;
        })
        .join('');

      if (aiBusy) {
        msgWrap.innerHTML += `
          <div class="ai-msg assistant" style="min-width:240px;">
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line sm"></div>
          </div>`;
      }
      msgWrap.scrollTop = msgWrap.scrollHeight;
    }

    $('#aiSendBtn').disabled = aiBusy;
    refreshIcons();
  }

  function openAIConfigModal() {
    $('#aiProviderSelect').value = aiConfig.provider || 'openai';
    $('#aiEndpointInput').value = aiConfig.endpoint || DEFAULT_AI_CONFIG.endpoint;
    $('#aiModelInput').value = aiConfig.model || DEFAULT_AI_CONFIG.model;
    $('#aiApiKeyInput').value = aiConfig.apiKey || '';
    openModal('aiConfigModal');
  }

  function buildWorkspaceContextSummary() {
    const pending = state.tasks.filter((t) => !t.completed).slice(0, 8);
    const activeProj = state.projects.filter((p) => p.status === 'Active').slice(0, 5);
    return [
      `Pending tasks (${pending.length}): ${pending.map((t) => `${t.title} [${t.priority}, due ${t.dueDate}]`).join('; ') || 'None'}`,
      `Active projects (${activeProj.length}): ${activeProj.map((p) => `${p.name} (${p.progress}%)`).join('; ') || 'None'}`,
    ].join('\n');
  }

  async function sendAIMessage(promptText) {
    if (!isAiConfigured()) {
      showToast('Please configure your AI API key and endpoint first.', 'error');
      openAIConfigModal();
      return;
    }
    const text = promptText.trim();
    if (!text || aiBusy) return;

    aiHistory.push({ role: 'user', content: text });
    saveJSON(MOD_KEYS.AI_HISTORY, aiHistory);
    $('#aiPromptInput').value = '';
    aiBusy = true;
    renderAIView();

    const includeCtx = $('#aiIncludeContext')?.checked;
    const systemPrompt =
      'You are NEXORA AI, a concise productivity assistant. When proposing action steps, format them as clean bullet points (- Task title) so the user can convert them into tasks.' +
      (includeCtx ? '\n\nCurrent workspace snapshot:\n' + buildWorkspaceContextSummary() : '');

    try {
      let reply = '';
      if (aiConfig.provider === 'gemini') {
        const baseUrl = aiConfig.endpoint.replace(/\/+$/, '');
        const url = baseUrl.includes(':generateContent')
          ? `${baseUrl}?key=${encodeURIComponent(aiConfig.apiKey)}`
          : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(aiConfig.model)}:generateContent?key=${encodeURIComponent(
              aiConfig.apiKey
            )}`;

        const contents = aiHistory.slice(-10).map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message || `Gemini API error (${res.status})`);
        reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
      } else {
        const headers = { 'Content-Type': 'application/json' };
        if (aiConfig.apiKey) headers.Authorization = `Bearer ${aiConfig.apiKey}`;
        const messages = [{ role: 'system', content: systemPrompt }, ...aiHistory.slice(-12)];
        const res = await fetch(aiConfig.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: aiConfig.model,
            messages,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message || `API request failed (${res.status})`);
        reply = data?.choices?.[0]?.message?.content || '';
      }

      if (!reply.trim()) throw new Error('API returned an empty response.');
      aiHistory.push({ role: 'assistant', content: reply.trim() });
      saveJSON(MOD_KEYS.AI_HISTORY, aiHistory);
    } catch (err) {
      showToast(err.message || 'AI request failed.', 'error');
      aiHistory.push({
        role: 'assistant',
        content: `Error calling configured API: ${err.message || 'Unknown network or authentication error.'}`,
      });
      saveJSON(MOD_KEYS.AI_HISTORY, aiHistory);
    } finally {
      aiBusy = false;
      renderAIView();
    }
  }

  /* ============================================================
     2. EXPENSE TRACKER (INCOME, EXPENSES, BUDGETS, CHARTS)
     ============================================================ */
  const EXPENSE_CATEGORIES = ['Food', 'Housing', 'Transport', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Other'];
  const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investments', 'Other'];
  const CAT_COLORS = {
    Food: '#10b981',
    Housing: '#3b82f6',
    Transport: '#f59e0b',
    Utilities: '#8b5cf6',
    Shopping: '#ec4899',
    Entertainment: '#06b6d4',
    Health: '#14b8a6',
    Other: '#64748b',
  };

  function seedExpensesIfEmpty() {
    const existing = localStorage.getItem(MOD_KEYS.EXPENSES);
    if (existing !== null) return JSON.parse(existing);
    const month = formatDateISO().slice(0, 7);
    const initial = {
      transactions: [
        { id: uid(), type: 'income', amount: 4200, category: 'Salary', date: `${month}-01`, description: 'Monthly salary deposit' },
        { id: uid(), type: 'income', amount: 650, category: 'Freelance', date: `${month}-10`, description: 'UI audit consulting' },
        { id: uid(), type: 'expense', amount: 1150, category: 'Housing', date: `${month}-02`, description: 'Apartment rent' },
        { id: uid(), type: 'expense', amount: 245.5, category: 'Food', date: `${month}-06`, description: 'Groceries & coffee' },
        { id: uid(), type: 'expense', amount: 92, category: 'Utilities', date: `${month}-08`, description: 'Fiber internet & power' },
        { id: uid(), type: 'expense', amount: 68, category: 'Transport', date: `${month}-12`, description: 'Metro pass & rideshare' },
      ],
      budgets: {
        Food: 450,
        Housing: 1200,
        Transport: 200,
        Utilities: 200,
        Shopping: 250,
        Entertainment: 150,
        Health: 150,
        Other: 150,
      },
    };
    saveJSON(MOD_KEYS.EXPENSES, initial);
    return initial;
  }

  let expenseState = seedExpensesIfEmpty();
  let expFilterType = 'all';
  let expFilterCat = 'all';
  let expFilterSearch = '';
  let expFilterMonth = formatDateISO().slice(0, 7);

  function formatMoney(val) {
    return '$' + Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function populateExpenseCategorySelect(type, selectEl) {
    const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    selectEl.innerHTML = cats.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  function openExpenseModal(id = null) {
    $('#expenseForm').reset();
    if (id) {
      const tx = expenseState.transactions.find((t) => t.id === id);
      if (!tx) return;
      $('#expenseModalTitle').textContent = 'Edit Transaction';
      $('#expEditId').value = tx.id;
      $('#expTypeInput').value = tx.type;
      populateExpenseCategorySelect(tx.type, $('#expCatInput'));
      $('#expAmountInput').value = tx.amount;
      $('#expCatInput').value = tx.category;
      $('#expDateInput').value = tx.date;
      $('#expDescInput').value = tx.description;
    } else {
      $('#expenseModalTitle').textContent = 'Add Transaction';
      $('#expEditId').value = '';
      $('#expTypeInput').value = 'expense';
      populateExpenseCategorySelect('expense', $('#expCatInput'));
      $('#expDateInput').value = formatDateISO();
    }
    openModal('expenseModal');
  }

  function openBudgetModal() {
    const wrap = $('#budgetFieldsContainer');
    wrap.innerHTML = EXPENSE_CATEGORIES.map(
      (cat) => `
      <div class="form-row-2" style="align-items:center;margin-bottom:10px;">
        <span style="font-weight:600;">${cat}</span>
        <input type="number" class="text-input" data-budget-cat="${cat}" min="0" step="10" value="${Number(expenseState.budgets?.[cat] || 0)}" />
      </div>`
    ).join('');
    openModal('budgetModal');
  }

  function renderExpensesView() {
    const monthEl = $('#expMonthFilter');
    if (monthEl && !monthEl.value) monthEl.value = expFilterMonth;
    const catFilterEl = $('#expCategoryFilter');
    if (catFilterEl && catFilterEl.options.length <= 1) {
      const allCats = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];
      catFilterEl.innerHTML = '<option value="all">All Categories</option>' + allCats.map((c) => `<option value="${c}">${c}</option>`).join('');
      catFilterEl.value = expFilterCat;
    }

    const monthTxs = expenseState.transactions.filter((t) => !expFilterMonth || (t.date || '').startsWith(expFilterMonth));
    const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const spent = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const totalBudget = Object.values(expenseState.budgets || {}).reduce((s, v) => s + Number(v || 0), 0);
    const budgetPct = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;

    $('#expTotalIncome').textContent = formatMoney(income);
    $('#expTotalSpent').textContent = formatMoney(spent);
    $('#expNetBalance').textContent = formatMoney(income - spent);
    $('#expBudgetUsage').textContent = `${budgetPct}%`;
    $('#expBudgetDesc').textContent = `Of ${formatMoney(totalBudget)} budget`;

    // Donut SVG Chart
    const byCat = {};
    monthTxs
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
      });
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const chartWrap = $('#expCategoryChart');

    if (entries.length === 0) {
      chartWrap.innerHTML = `<div class="empty-state" style="padding:20px;"><i data-lucide="pie-chart"></i><p>No expenses recorded for this month.</p></div>`;
    } else {
      const r = 64;
      const circ = 2 * Math.PI * r;
      let offset = 0;
      const circles = entries
        .map(([cat, val]) => {
          const pct = val / spent;
          const dash = pct * circ;
          const slice = `<circle cx="85" cy="85" r="${r}" fill="none" stroke="${CAT_COLORS[cat] || '#10b981'}" stroke-width="24" stroke-dasharray="${dash} ${
            circ - dash
          }" stroke-dashoffset="${-offset}" />`;
          offset += dash;
          return slice;
        })
        .join('');

      const legend = entries
        .map(([cat, val]) => {
          const pct = Math.round((val / spent) * 100);
          return `
            <div class="exp-legend-row">
              <span><span class="exp-legend-dot" style="background:${CAT_COLORS[cat] || '#10b981'};"></span>${cat}</span>
              <strong>${formatMoney(val)} (${pct}%)</strong>
            </div>`;
        })
        .join('');

      chartWrap.innerHTML = `
        <svg width="170" height="170" viewBox="0 0 170 170" style="transform:rotate(-90deg);flex-shrink:0;">
          <circle cx="85" cy="85" r="${r}" fill="none" stroke="var(--bg-subtle)" stroke-width="24" />
          ${circles}
        </svg>
        <div class="exp-legend">${legend}</div>`;
    }

    // Budgets List
    const budgetsWrap = $('#expBudgetsList');
    budgetsWrap.innerHTML = EXPENSE_CATEGORIES.filter((cat) => Number(expenseState.budgets?.[cat] || 0) > 0 || byCat[cat] > 0)
      .map((cat) => {
        const limit = Number(expenseState.budgets?.[cat] || 0);
        const used = Number(byCat[cat] || 0);
        const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
        const cls = limit > 0 && used > limit ? 'over' : limit > 0 && used >= limit * 0.8 ? 'warn' : '';
        return `
          <div>
            <div class="budget-item-head">
              <span>${cat}</span>
              <span>${formatMoney(used)} / ${limit > 0 ? formatMoney(limit) : 'No limit'}</span>
            </div>
            <div class="project-progress-bar">
              <div class="budget-bar-fill ${cls}" style="width:${pct}%"></div>
            </div>
          </div>`;
      })
      .join('');

    // Transactions List
    const listWrap = $('#expTransactionsList');
    const q = expFilterSearch.trim().toLowerCase();
    const filtered = monthTxs
      .filter((t) => expFilterType === 'all' || t.type === expFilterType)
      .filter((t) => expFilterCat === 'all' || t.category === expFilterCat)
      .filter((t) => !q || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (filtered.length === 0) {
      listWrap.innerHTML = `
        <div class="empty-state">
          <i data-lucide="wallet"></i>
          <h3>No matching transactions</h3>
          <p>Log income or expenses to track your monthly cashflow.</p>
        </div>`;
    } else {
      listWrap.innerHTML = filtered
        .map(
          (t) => `
          <div class="todo-row">
            <span class="stat-icon-wrap" style="background:${t.type === 'income' ? 'var(--emerald-50)' : 'var(--danger-50)'};color:${
            t.type === 'income' ? 'var(--emerald-600)' : 'var(--danger-500)'
          };">
              <i data-lucide="${t.type === 'income' ? 'arrow-down-left' : 'arrow-up-right'}"></i>
            </span>
            <div class="todo-row-main">
              <div class="todo-row-title">${escapeHTML(t.description)}</div>
              <div class="todo-row-notes">${escapeHTML(t.category)} • ${formatReadableDate(t.date)}</div>
            </div>
            <div class="todo-row-meta">
              <strong style="font-size:15px;color:${t.type === 'income' ? 'var(--emerald-600)' : 'var(--danger-500)'};">${
            t.type === 'income' ? '+' : '-'
          }${formatMoney(t.amount)}</strong>
              <button class="icon-btn-sm" type="button" data-edit-exp="${t.id}" title="Edit"><i data-lucide="pencil"></i></button>
              <button class="icon-btn-sm" type="button" data-delete-exp="${t.id}" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </div>`
        )
        .join('');
    }
    refreshIcons();
  }

  function renderDashExpensesWidget() {
    const box = $('#dashExpensesBody');
    if (!box) return;
    const month = formatDateISO().slice(0, 7);
    const txs = expenseState.transactions.filter((t) => (t.date || '').startsWith(month));
    const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const spent = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const net = income - spent;
    box.innerHTML = `
      <div class="weather-details-grid">
        <div class="weather-stat-box"><span>Income</span><strong style="color:var(--emerald-600);">${formatMoney(income)}</strong></div>
        <div class="weather-stat-box"><span>Expenses</span><strong style="color:var(--danger-500);">${formatMoney(spent)}</strong></div>
      </div>
      <div class="converter-formula-bar" style="margin-top:12px;">
        <span>Monthly Net Balance</span>
        <strong>${formatMoney(net)}</strong>
      </div>`;
  }

  /* ============================================================
     3. HABIT TRACKER (STREAKS & COMPLETION CALENDARS)
     ============================================================ */
  function seedHabitsIfEmpty() {
    const raw = localStorage.getItem(MOD_KEYS.HABITS);
    if (raw !== null) return JSON.parse(raw);
    const initial = [
      {
        id: uid(),
        name: 'Deep Work (60 min)',
        category: 'Focus',
        target: 5,
        completions: {
          [addDaysISO(-3)]: true,
          [addDaysISO(-2)]: true,
          [addDaysISO(-1)]: true,
        },
      },
      {
        id: uid(),
        name: 'Read 20 Pages',
        category: 'Learning',
        target: 6,
        completions: {
          [addDaysISO(-2)]: true,
          [addDaysISO(-1)]: true,
          [formatDateISO()]: true,
        },
      },
      {
        id: uid(),
        name: 'Morning Mobility / Workout',
        category: 'Health',
        target: 5,
        completions: {
          [addDaysISO(-4)]: true,
          [addDaysISO(-1)]: true,
        },
      },
    ];
    saveJSON(MOD_KEYS.HABITS, initial);
    return initial;
  }

  let habits = seedHabitsIfEmpty();

  function computeHabitStreaks(completions = {}) {
    let current = 0;
    let cursor = new Date();
    // If today isn't completed yet, start checking from yesterday so active streaks don't vanish mid-day
    if (!completions[formatDateISO(cursor)]) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (completions[formatDateISO(cursor)]) {
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const dates = Object.keys(completions).filter((k) => completions[k]).sort();
    let best = 0;
    let run = 0;
    let prevTime = null;
    for (const d of dates) {
      const t = new Date(d + 'T00:00:00').getTime();
      if (prevTime !== null && Math.round((t - prevTime) / 86400000) === 1) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > best) best = run;
      prevTime = t;
    }
    return { current, best, total: dates.length };
  }

  function openHabitModal(id = null) {
    $('#habitForm').reset();
    if (id) {
      const h = habits.find((x) => x.id === id);
      if (!h) return;
      $('#habitModalTitle').textContent = 'Edit Habit';
      $('#habitEditId').value = h.id;
      $('#habitNameInput').value = h.name;
      $('#habitCatInput').value = h.category;
      $('#habitGoalInput').value = h.target || 5;
    } else {
      $('#habitModalTitle').textContent = 'New Habit';
      $('#habitEditId').value = '';
    }
    openModal('habitModal');
  }

  function toggleHabitDay(habitId, isoDate) {
    const h = habits.find((x) => x.id === habitId);
    if (!h) return;
    h.completions = h.completions || {};
    if (h.completions[isoDate]) delete h.completions[isoDate];
    else h.completions[isoDate] = true;
    saveJSON(MOD_KEYS.HABITS, habits);
    renderHabitsView();
    renderDashHabitsWidget();
  }

  function renderHabitsView() {
    const grid = $('#habitsGrid');
    if (habits.length === 0) {
      grid.innerHTML = `
        <div class="card" style="grid-column:1/-1;">
          <div class="empty-state">
            <i data-lucide="flame"></i>
            <h3>No habits tracked yet</h3>
            <p>Start a daily habit and build unstoppable streaks.</p>
            <button class="btn btn-primary btn-sm" id="habitsEmptyBtn" type="button">Create Habit</button>
          </div>
        </div>`;
      $('#habitsEmptyBtn')?.addEventListener('click', () => openHabitModal());
      refreshIcons();
      return;
    }

    const todayISO = formatDateISO();
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const iso = addDaysISO(-i);
      const dayNum = iso.slice(8, 10);
      last14.push({ iso, dayNum, isToday: iso === todayISO });
    }

    grid.innerHTML = habits
      .map((h) => {
        const stats = computeHabitStreaks(h.completions);
        const doneToday = Boolean(h.completions?.[todayISO]);
        const cells = last14
          .map(
            (d) => `
            <button class="habit-day-cell ${h.completions?.[d.iso] ? 'done' : ''} ${d.isToday ? 'today' : ''}" type="button" data-habit-day="${h.id}:${d.iso}" title="${formatReadableDate(
              d.iso
            )}">
              ${d.dayNum}
            </button>`
          )
          .join('');

        return `
          <article class="card habit-card">
            <div class="card-header" style="margin-bottom:0;">
              <div>
                <h3 class="card-title">${escapeHTML(h.name)}</h3>
                <span class="pill-badge" style="margin-top:6px;">${escapeHTML(h.category)} • ${h.target}d/wk goal</span>
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                <button class="btn btn-sm ${doneToday ? 'btn-primary' : 'btn-secondary'}" type="button" data-habit-day="${h.id}:${todayISO}">
                  <i data-lucide="${doneToday ? 'check' : 'circle'}"></i>
                  <span>${doneToday ? 'Done' : 'Check In'}</span>
                </button>
                <button class="icon-btn-sm" type="button" data-edit-habit="${h.id}" title="Edit"><i data-lucide="pencil"></i></button>
                <button class="icon-btn-sm" type="button" data-delete-habit="${h.id}" title="Delete"><i data-lucide="trash-2"></i></button>
              </div>
            </div>
            <div class="habit-stats-row">
              <span class="due-chip"><i data-lucide="flame"></i>${stats.current} day streak</span>
              <span class="due-chip"><i data-lucide="award"></i>Best: ${stats.best}d</span>
              <span class="due-chip"><i data-lucide="check-circle-2"></i>${stats.total} check-ins</span>
            </div>
            <div>
              <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:6px;">Last 14 days (click any day to toggle)</div>
              <div class="habit-calendar-strip">${cells}</div>
            </div>
          </article>`;
      })
      .join('');
    refreshIcons();
  }

  function renderDashHabitsWidget() {
    const list = $('#dashHabitsList');
    if (!list) return;
    if (habits.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:18px;"><p>No habits yet.</p></div>`;
      return;
    }
    const todayISO = formatDateISO();
    list.innerHTML = habits
      .slice(0, 4)
      .map((h) => {
        const done = Boolean(h.completions?.[todayISO]);
        const { current } = computeHabitStreaks(h.completions);
        return `
          <div class="dash-task-item">
            <button class="task-check ${done ? 'checked' : ''}" type="button" data-habit-day="${h.id}:${todayISO}" title="Toggle today">
              ${done ? '<i data-lucide="check"></i>' : ''}
            </button>
            <div class="dash-task-info">
              <div class="dash-task-title ${done ? 'done' : ''}">${escapeHTML(h.name)}</div>
              <div class="dash-task-meta"><span>${escapeHTML(h.category)}</span></div>
            </div>
            <span class="pill-badge">${current}d streak</span>
          </div>`;
      })
      .join('');
  }

  /* ============================================================
     4. BOOKMARK MANAGER (FOLDERS & TAGS)
     ============================================================ */
  function seedBookmarksIfEmpty() {
    const raw = localStorage.getItem(MOD_KEYS.BOOKMARKS);
    if (raw !== null) return JSON.parse(raw);
    const initial = [
      { id: uid(), title: 'MDN Web Docs', url: 'https://developer.mozilla.org', folder: 'Development', tags: ['docs', 'web', 'js'], createdAt: Date.now() },
      { id: uid(), title: 'Lucide Icons', url: 'https://lucide.dev', folder: 'Design', tags: ['icons', 'ui'], createdAt: Date.now() },
      { id: uid(), title: 'Open-Meteo API Docs', url: 'https://open-meteo.com/en/docs', folder: 'Development', tags: ['api', 'weather'], createdAt: Date.now() },
    ];
    saveJSON(MOD_KEYS.BOOKMARKS, initial);
    return initial;
  }

  let bookmarks = seedBookmarksIfEmpty();
  let bmFolderFilter = 'All';
  let bmTagFilter = 'all';
  let bmSearch = '';

  function normalizeURL(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return 'https://' + trimmed;
  }

  function openBookmarkModal(id = null) {
    $('#bookmarkForm').reset();
    if (id) {
      const bm = bookmarks.find((x) => x.id === id);
      if (!bm) return;
      $('#bookmarkModalTitle').textContent = 'Edit Bookmark';
      $('#bmEditId').value = bm.id;
      $('#bmTitleInput').value = bm.title;
      $('#bmUrlInput').value = bm.url;
      $('#bmFolderInput').value = bm.folder;
      $('#bmTagsInput').value = (bm.tags || []).join(', ');
    } else {
      $('#bookmarkModalTitle').textContent = 'Add Bookmark';
      $('#bmEditId').value = '';
    }
    openModal('bookmarkModal');
  }

  function renderBookmarksView() {
    const folders = ['All', ...new Set(bookmarks.map((b) => b.folder || 'General'))];
    if (!folders.includes(bmFolderFilter)) bmFolderFilter = 'All';

    $('#bookmarkFolderTabs').innerHTML = folders
      .map((f) => `<button class="filter-tab ${bmFolderFilter === f ? 'active' : ''}" type="button" data-bm-folder="${escapeHTML(f)}">${escapeHTML(f)}</button>`)
      .join('');

    const allTags = [...new Set(bookmarks.flatMap((b) => b.tags || []))].sort();
    const tagSel = $('#bookmarkTagFilter');
    tagSel.innerHTML = '<option value="all">All Tags</option>' + allTags.map((t) => `<option value="${escapeHTML(t)}">#${escapeHTML(t)}</option>`).join('');
    tagSel.value = allTags.includes(bmTagFilter) ? bmTagFilter : 'all';

    const q = bmSearch.trim().toLowerCase();
    const filtered = bookmarks
      .filter((b) => bmFolderFilter === 'All' || b.folder === bmFolderFilter)
      .filter((b) => bmTagFilter === 'all' || (b.tags || []).includes(bmTagFilter))
      .filter((b) => !q || b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || (b.tags || []).some((t) => t.toLowerCase().includes(q)));

    const grid = $('#bookmarksGrid');
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="card" style="grid-column:1/-1;">
          <div class="empty-state">
            <i data-lucide="bookmark"></i>
            <h3>No bookmarks found</h3>
            <p>Save your favorite documentation, tools, and links organized by folder and tags.</p>
          </div>
        </div>`;
    } else {
      grid.innerHTML = filtered
        .map((b) => {
          let host = b.url;
          try {
            host = new URL(b.url).hostname;
          } catch {}
          return `
            <article class="card bookmark-card">
              <div class="card-header" style="margin-bottom:0;">
                <div style="min-width:0;">
                  <span class="pill-badge" style="margin-bottom:6px;">${escapeHTML(b.folder || 'General')}</span>
                  <h3 class="card-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(b.title)}</h3>
                  <p class="muted-text" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(host)}</p>
                </div>
                <div style="display:flex;gap:4px;">
                  <button class="icon-btn-sm" type="button" data-copy-bm="${escapeHTML(b.url)}" title="Copy URL"><i data-lucide="copy"></i></button>
                  <button class="icon-btn-sm" type="button" data-edit-bm="${b.id}" title="Edit"><i data-lucide="pencil"></i></button>
                  <button class="icon-btn-sm" type="button" data-delete-bm="${b.id}" title="Delete"><i data-lucide="trash-2"></i></button>
                </div>
              </div>
              <div class="bookmark-tags">
                ${(b.tags || []).map((t) => `<span class="tag-pill">#${escapeHTML(t)}</span>`).join('')}
              </div>
              <a class="btn btn-secondary btn-sm" href="${escapeHTML(b.url)}" target="_blank" rel="noopener noreferrer" style="margin-top:auto;">
                <i data-lucide="external-link"></i>
                <span>Open Link</span>
              </a>
            </article>`;
        })
        .join('');
    }
    refreshIcons();
  }

  /* ============================================================
     5. QR CODE GENERATOR (100% OFFLINE PURE JS ENCODER)
     ============================================================ */
  const QRGen = (() => {
    // Minimal Reed-Solomon & QR Version 1-6 (Byte mode, ECC Level M)
    const GF_EXP = new Uint8Array(512);
    const GF_LOG = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];

    function gfMul(a, b) {
      if (a === 0 || b === 0) return 0;
      return GF_EXP[GF_LOG[a] + GF_LOG[b]];
    }

    function rsPoly(ecLen) {
      let poly = [1];
      for (let i = 0; i < ecLen; i++) {
        const next = new Array(poly.length + 1).fill(0);
        for (let j = 0; j < poly.length; j++) {
          next[j] ^= poly[j];
          next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
        }
        poly = next;
      }
      return poly;
    }

    function rsEncode(data, ecLen) {
      const gen = rsPoly(ecLen);
      const res = new Uint8Array(data.length + ecLen);
      res.set(data);
      for (let i = 0; i < data.length; i++) {
        const coef = res[i];
        if (coef !== 0) {
          for (let j = 0; j < gen.length; j++) {
            res[i + j] ^= gfMul(gen[j], coef);
          }
        }
      }
      return res.slice(data.length);
    }

    // Version specs for ECC Level M: [totalDataCodewords, ecPerBlock, blocks, alignPos]
    const VERSIONS = [
      null,
      { cap: 16, ec: 10, blocks: 1, align: [] }, // v1 (21x21)
      { cap: 28, ec: 16, blocks: 1, align: [6, 18] }, // v2 (25x25)
      { cap: 44, ec: 26, blocks: 1, align: [6, 22] }, // v3 (29x29)
      { cap: 64, ec: 18, blocks: 2, align: [6, 26] }, // v4 (33x33)
      { cap: 86, ec: 24, blocks: 2, align: [6, 30] }, // v5 (37x37)
      { cap: 108, ec: 16, blocks: 4, align: [6, 34] }, // v6 (41x41)
      { cap: 124, ec: 18, blocks: 4, align: [6, 22, 38] }, // v7 (45x45)
      { cap: 154, ec: 22, blocks: 4, align: [6, 24, 42] }, // v8 (49x49)
    ];

    function buildMatrix(text) {
      const bytes = new TextEncoder().encode(text);
      let ver = 1;
      while (ver < VERSIONS.length && bytes.length + 2 > VERSIONS[ver].cap) ver++;
      if (ver >= VERSIONS.length) throw new Error('Text too long for QR code (max ~150 chars).');

      const spec = VERSIONS[ver];
      const size = 17 + ver * 4;
      const bits = [];
      const pushBits = (val, len) => {
        for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
      };

      pushBits(0b0100, 4); // Byte mode
      pushBits(bytes.length, 8);
      for (const b of bytes) pushBits(b, 8);

      const maxBits = spec.cap * 8;
      pushBits(0, Math.min(4, maxBits - bits.length));
      while (bits.length % 8 !== 0) bits.push(0);
      const pads = [0xec, 0x11];
      let pi = 0;
      while (bits.length < maxBits) {
        pushBits(pads[pi % 2], 8);
        pi++;
      }

      const dataBytes = new Uint8Array(spec.cap);
      for (let i = 0; i < spec.cap; i++) {
        let v = 0;
        for (let b = 0; b < 8; b++) v = (v << 1) | bits[i * 8 + b];
        dataBytes[i] = v;
      }

      // Split into blocks & compute ECC
      const blockSize = Math.floor(spec.cap / spec.blocks);
      const extra = spec.cap % spec.blocks;
      const dataBlocks = [];
      const ecBlocks = [];
      let ptr = 0;
      for (let b = 0; b < spec.blocks; b++) {
        const len = blockSize + (b >= spec.blocks - extra ? 1 : 0);
        const slice = dataBytes.slice(ptr, ptr + len);
        ptr += len;
        dataBlocks.push(slice);
        ecBlocks.push(rsEncode(slice, spec.ec));
      }

      const interleaved = [];
      const maxBlockLen = Math.max(...dataBlocks.map((b) => b.length));
      for (let i = 0; i < maxBlockLen; i++) {
        for (const blk of dataBlocks) if (i < blk.length) interleaved.push(blk[i]);
      }
      for (let i = 0; i < spec.ec; i++) {
        for (const ec of ecBlocks) interleaved.push(ec[i]);
      }

      const codeBits = [];
      for (const byte of interleaved) {
        for (let i = 7; i >= 0; i--) codeBits.push((byte >> i) & 1);
      }

      const mat = Array.from({ length: size }, () => Array(size).fill(null));
      const reserved = Array.from({ length: size }, () => Array(size).fill(false));

      const setMod = (r, c, val) => {
        if (r >= 0 && r < size && c >= 0 && c < size) {
          mat[r][c] = val;
          reserved[r][c] = true;
        }
      };

      const drawFinder = (r0, c0) => {
        for (let dr = -1; dr <= 7; dr++) {
          for (let dc = -1; dc <= 7; dc++) {
            const r = r0 + dr;
            const c = c0 + dc;
            if (r < 0 || r >= size || c < 0 || c >= size) continue;
            const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
            const isBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
            const isInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
            setMod(r, c, inOuter && (isBorder || isInner) ? 1 : 0);
          }
        }
      };

      drawFinder(0, 0);
      drawFinder(0, size - 7);
      drawFinder(size - 7, 0);

      // Alignment patterns
      const ap = spec.align;
      for (const r of ap) {
        for (const c of ap) {
          if (reserved[r][c]) continue;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const v = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0) ? 1 : 0;
              setMod(r + dr, c + dc, v);
            }
          }
        }
      }

      // Timing patterns & dark module
      for (let i = 8; i < size - 8; i++) {
        if (!reserved[6][i]) setMod(6, i, i % 2 === 0 ? 1 : 0);
        if (!reserved[i][6]) setMod(i, 6, i % 2 === 0 ? 1 : 0);
      }
      setMod(size - 8, 8, 1);

      // Reserve format & version info areas
      for (let i = 0; i < 9; i++) {
        if (i !== 6) {
          reserved[8][i] = true;
          reserved[i][8] = true;
        }
      }
      for (let i = 0; i < 8; i++) {
        reserved[8][size - 1 - i] = true;
        reserved[size - 1 - i][8] = true;
      }
      if (ver >= 7) {
        // Reserve 6x3 version info blocks
        const verBits = ver === 7 ? 0x07c94 : 0x085bc;
        for (let i = 0; i < 18; i++) {
          const bit = (verBits >> i) & 1;
          const a = Math.floor(i / 3);
          const b = (i % 3) + size - 11;
          setMod(a, b, bit);
          setMod(b, a, bit);
        }
      }

      // Place data bits in zig-zag
      let bitIdx = 0;
      let dir = -1;
      for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (let rowStep = 0; rowStep < size; rowStep++) {
          const row = dir === -1 ? size - 1 - rowStep : rowStep;
          for (let d = 0; d < 2; d++) {
            const c = col - d;
            if (!reserved[row][c]) {
              const rawBit = bitIdx < codeBits.length ? codeBits[bitIdx++] : 0;
              // Use mask 0: (row + col) % 2 === 0
              mat[row][c] = rawBit ^ ((row + c) % 2 === 0 ? 1 : 0);
            }
          }
        }
        dir *= -1;
      }

      // Format info for ECC M (00) + Mask 0 (000) -> 15-bit BCH = 0b101010000010010 (0x5412)
      const fmt = 0x5412;
      for (let i = 0; i < 15; i++) {
        const bit = (fmt >> (14 - i)) & 1;
        // Horizontal
        if (i < 6) mat[8][i] = bit;
        else if (i < 8) mat[8][i + 1] = bit;
        else mat[8][size - 15 + i] = bit;
        // Vertical
        if (i < 8) mat[size - 1 - i][8] = bit;
        else if (i < 9) mat[15 - i][8] = bit;
        else mat[14 - i][8] = bit;
      }

      return mat;
    }

    return { buildMatrix };
  })();

  let lastQrMatrix = null;

  function renderQRCode() {
    const canvas = $('#qrCanvas');
    if (!canvas) return;
    const text = ($('#qrTextInput').value || '').trim() || 'https://nexora.workspace';
    const px = Number($('#qrSizeSelect').value) || 260;
    const fg = $('#qrFgColor').value || '#0f172a';
    const bg = $('#qrBgColor').value || '#ffffff';

    try {
      const mat = QRGen.buildMatrix(text);
      lastQrMatrix = mat;
      const n = mat.length;
      const quiet = 2;
      const totalModules = n + quiet * 2;
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, px, px);

      const modSize = px / totalModules;
      ctx.fillStyle = fg;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (mat[r][c]) {
            ctx.fillRect(
              Math.floor((c + quiet) * modSize),
              Math.floor((r + quiet) * modSize),
              Math.ceil(modSize),
              Math.ceil(modSize)
            );
          }
        }
      }
      $('#qrMetaInfo').textContent = `${n}×${n} matrix • ${text.length} chars`;
    } catch (err) {
      lastQrMatrix = null;
      $('#qrMetaInfo').textContent = err.message;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /* ============================================================
     6. COLOR PALETTE GENERATOR (HEX & RGB)
     ============================================================ */
  let savedPalettes = loadJSON(MOD_KEYS.PALETTES, []);
  let currentPalette = [
    { hex: '#10B981', locked: false },
    { hex: '#059669', locked: false },
    { hex: '#34D399', locked: false },
    { hex: '#0F172A', locked: false },
    { hex: '#ECFDF5', locked: false },
  ];

  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  }

  function hexToRgbString(hex) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function generatePaletteColors() {
    const harmony = $('#paletteHarmonySelect')?.value || 'analogous';
    const baseHue = Math.floor(Math.random() * 360);
    const baseSat = 60 + Math.floor(Math.random() * 25);

    currentPalette = currentPalette.map((item, idx) => {
      if (item.locked) return item;
      let h = baseHue;
      let s = baseSat;
      let l = 48;
      if (harmony === 'analogous') {
        h = (baseHue + idx * 24) % 360;
        l = 35 + idx * 10;
      } else if (harmony === 'complementary') {
        h = idx % 2 === 0 ? baseHue : (baseHue + 180) % 360;
        l = 32 + idx * 11;
      } else if (harmony === 'triadic') {
        h = (baseHue + (idx % 3) * 120) % 360;
        l = 36 + idx * 9;
      } else if (harmony === 'monochromatic') {
        h = baseHue;
        l = 22 + idx * 14;
      } else {
        h = Math.floor(Math.random() * 360);
        s = 50 + Math.floor(Math.random() * 40);
        l = 35 + Math.floor(Math.random() * 40);
      }
      return { hex: hslToHex(h, s, Math.min(88, Math.max(18, l))), locked: false };
    });

    renderPaletteView();
  }

  function renderPaletteView() {
    const grid = $('#paletteSwatchesGrid');
    grid.innerHTML = currentPalette
      .map((swatch, idx) => {
        const rgb = hexToRgbString(swatch.hex);
        return `
          <div class="palette-swatch-card">
            <div class="palette-color-block" style="background:${swatch.hex};">
              <button class="palette-lock-btn" type="button" data-lock-swatch="${idx}" title="${swatch.locked ? 'Unlock color' : 'Lock color'}">
                <i data-lucide="${swatch.locked ? 'lock' : 'unlock'}"></i>
              </button>
            </div>
            <div class="palette-info">
              <button class="palette-copy-btn" type="button" data-copy-color="${swatch.hex}">
                <span>${swatch.hex}</span>
                <i data-lucide="copy" style="width:13px;height:13px;"></i>
              </button>
              <button class="palette-copy-btn" type="button" data-copy-color="${rgb}">
                <span style="font-size:11px;">${rgb}</span>
                <i data-lucide="copy" style="width:13px;height:13px;"></i>
              </button>
            </div>
          </div>`;
      })
      .join('');

    const savedWrap = $('#savedPalettesList');
    if (savedPalettes.length === 0) {
      savedWrap.innerHTML = `<p class="muted-text">No saved palettes yet. Click "Save Palette" to keep your favorites.</p>`;
    } else {
      savedWrap.innerHTML = savedPalettes
        .map(
          (pal, idx) => `
          <div class="saved-palette-chip" data-load-palette="${idx}" title="Click to load palette">
            <div class="saved-palette-strip">
              ${pal.map((hex) => `<span style="background:${hex};"></span>`).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;">
              <span>${pal.join(' • ').slice(0, 26)}…</span>
              <button class="icon-btn-sm" type="button" data-delete-palette="${idx}" title="Remove"><i data-lucide="x"></i></button>
            </div>
          </div>`
        )
        .join('');
    }
    refreshIcons();
  }

  /* ============================================================
     7. TYPING SPEED TEST
     ============================================================ */
  const TYPING_PASSAGES = {
    productivity: [
      'Clarity precedes mastery. When you organize your tasks around clear priorities and protect deep focus blocks, meaningful progress compounds effortlessly day after day.',
      'Small consistent habits build remarkable systems. Review your calendar each morning, break ambiguous goals into concrete next actions, and finish what you start.',
    ],
    tech: [
      'Clean modular JavaScript keeps state predictable, avoids duplicated logic, and lets local-first web applications run smoothly even when the network drops offline.',
      'Semantic markup, accessible keyboard navigation, and well-structured design tokens turn a collection of utilities into a cohesive software workspace.',
    ],
    quotes: [
      'Focus is not about doing more things at once; it is about deciding what deserves your full attention right now and letting everything else wait its turn.',
      'Amateurs sit and wait for inspiration; the rest of us just get up, open our workspace, and go to work with steady discipline.',
    ],
  };

  let typingStats = loadJSON(MOD_KEYS.TYPING, { bestWpm: 0 });
  const typing = {
    duration: 30,
    remaining: 30,
    passage: '',
    started: false,
    finished: false,
    timerId: null,
    startTime: 0,
  };

  function resetTypingTest() {
    clearInterval(typing.timerId);
    typing.timerId = null;
    typing.started = false;
    typing.finished = false;
    typing.remaining = typing.duration;

    const cat = $('#typingCategorySelect')?.value || 'productivity';
    const pool = TYPING_PASSAGES[cat] || TYPING_PASSAGES.productivity;
    typing.passage = pool[Math.floor(Math.random() * pool.length)];

    const input = $('#typingHiddenInput');
    if (input) {
      input.value = '';
      input.disabled = false;
    }

    $('#typingWpmVal').textContent = '0';
    $('#typingAccVal').textContent = '100%';
    $('#typingTimeVal').textContent = `${typing.duration}s`;
    $('#typingBestVal').textContent = typingStats.bestWpm || 0;
    $('#typingStateLabel').textContent = 'Start typing to begin';
    $('#typingErrorsLabel').textContent = 'Errors: 0';
    renderTypingPrompt('');
  }

  function renderTypingPrompt(typed) {
    const box = $('#typingPromptBox');
    if (!box) return;
    box.innerHTML = typing.passage
      .split('')
      .map((ch, idx) => {
        let cls = 'typing-char';
        if (idx < typed.length) {
          cls += typed[idx] === ch ? ' correct' : ' wrong';
        } else if (idx === typed.length && !typing.finished) {
          cls += ' current';
        }
        return `<span class="${cls}">${escapeHTML(ch)}</span>`;
      })
      .join('');
  }

  function finishTypingTest() {
    clearInterval(typing.timerId);
    typing.timerId = null;
    typing.finished = true;
    $('#typingHiddenInput').disabled = true;
    $('#typingStateLabel').textContent = 'Test completed!';

    const finalWpm = Number($('#typingWpmVal').textContent) || 0;
    if (finalWpm > (typingStats.bestWpm || 0)) {
      typingStats.bestWpm = finalWpm;
      saveJSON(MOD_KEYS.TYPING, typingStats);
      $('#typingBestVal').textContent = finalWpm;
      showToast(`New Personal Best: ${finalWpm} WPM!`, 'success');
    }
  }

  function handleTypingInput() {
    if (typing.finished) return;
    const typed = $('#typingHiddenInput').value;

    if (!typing.started && typed.length > 0) {
      typing.started = true;
      typing.startTime = Date.now();
      $('#typingStateLabel').textContent = 'Typing...';
      typing.timerId = setInterval(() => {
        typing.remaining -= 1;
        $('#typingTimeVal').textContent = `${Math.max(0, typing.remaining)}s`;
        if (typing.remaining <= 0) {
          finishTypingTest();
        }
      }, 1000);
    }

    let correct = 0;
    let errors = 0;
    for (let i = 0; i < typed.length && i < typing.passage.length; i++) {
      if (typed[i] === typing.passage[i]) correct++;
      else errors++;
    }

    const elapsedMin = Math.max(1 / 60, (Date.now() - (typing.startTime || Date.now())) / 60000);
    const wpm = typing.started ? Math.round(correct / 5 / elapsedMin) : 0;
    const acc = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;

    $('#typingWpmVal').textContent = wpm;
    $('#typingAccVal').textContent = `${acc}%`;
    $('#typingErrorsLabel').textContent = `Errors: ${errors}`;
    renderTypingPrompt(typed);

    if (typed.length >= typing.passage.length) {
      finishTypingTest();
    }
  }

  /* ============================================================
     8. MARKDOWN EDITOR WITH LIVE PREVIEW
     ============================================================ */
  const DEFAULT_MARKDOWN = `# Welcome to NEXORA Markdown

Write clean notes, specs, and documentation with **live sanitized preview**.

## Key Features
- **Bold**, *italic*, and \`inline code\` formatting
- Task checklists and structured headings
- Export directly to \`.md\`, copy HTML, or save straight to **Notes**

> "Simplicity is about subtracting the obvious and adding the meaningful."

\`\`\`js
const workspace = 'NEXORA';
console.log(\`Hello from \${workspace}!\`);
\`\`\`
`;

  function parseMarkdownSafe(md) {
    let html = escapeHTML(md || '');

    // Fenced code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => `<pre><code>${code.trimEnd()}</code></pre>`);

    const lines = html.split('\n');
    const out = [];
    let inList = false;

    for (const line of lines) {
      if (line.startsWith('<pre>') || line.includes('</pre>')) {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        out.push(line);
        continue;
      }

      const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (hMatch) {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        const lvl = hMatch[1].length;
        out.push(`<h${lvl}>${formatInlineMd(hMatch[2])}</h${lvl}>`);
        continue;
      }

      if (/^---+$/.test(line.trim())) {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        out.push('<hr />');
        continue;
      }

      const bqMatch = line.match(/^&gt;\s+(.+)$/);
      if (bqMatch) {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        out.push(`<blockquote>${formatInlineMd(bqMatch[1])}</blockquote>`);
        continue;
      }

      const liMatch = line.match(/^[-*]\s+(.+)$/);
      if (liMatch) {
        if (!inList) {
          out.push('<ul>');
          inList = true;
        }
        out.push(`<li>${formatInlineMd(liMatch[1])}</li>`);
        continue;
      }

      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      if (line.trim()) out.push(`<p>${formatInlineMd(line)}</p>`);
    }
    if (inList) out.push('</ul>');
    return out.join('\n');
  }

  function formatInlineMd(str) {
    return str
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function renderMarkdownPreview() {
    const src = $('#mdSourceInput')?.value || '';
    localStorage.setItem(MOD_KEYS.MARKDOWN, src);
    $('#mdPreviewOutput').innerHTML = parseMarkdownSafe(src);
    const words = src.trim() ? src.trim().split(/\s+/).length : 0;
    $('#mdWordCount').textContent = `${words} word${words === 1 ? '' : 's'} • ${src.length} chars`;
  }

  /* ============================================================
     BIND ALL MODULE EVENTS & REGISTER CORE HOOKS
     ============================================================ */
  function bindModuleEvents() {
    // AI Assistant events
    $('#aiConfigBtn')?.addEventListener('click', openAIConfigModal);
    $('#aiProviderSelect')?.addEventListener('change', (e) => {
      if (e.target.value === 'gemini') {
        $('#aiEndpointInput').value = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        $('#aiModelInput').value = 'gemini-2.5-flash';
      } else {
        $('#aiEndpointInput').value = 'https://api.openai.com/v1/chat/completions';
        $('#aiModelInput').value = 'gpt-4o-mini';
      }
    });
    $('#aiConfigForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      aiConfig = {
        provider: $('#aiProviderSelect').value,
        endpoint: $('#aiEndpointInput').value.trim(),
        model: $('#aiModelInput').value.trim(),
        apiKey: $('#aiApiKeyInput').value.trim(),
      };
      saveJSON(MOD_KEYS.AI_CONFIG, aiConfig);
      closeModal('aiConfigModal');
      renderAIView();
      showToast('AI API configuration saved.', 'success');
    });
    $('#aiChatForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      sendAIMessage($('#aiPromptInput').value);
    });
    $('#aiClearChatBtn')?.addEventListener('click', () => {
      askConfirm({
        title: 'Clear AI Conversation',
        message: 'Remove all messages from your AI chat history?',
        confirmText: 'Clear Chat',
        onConfirm: () => {
          aiHistory = [];
          saveJSON(MOD_KEYS.AI_HISTORY, []);
          renderAIView();
        },
      });
    });

    // Expense events
    $('#addExpenseBtn')?.addEventListener('click', () => openExpenseModal());
    $('#openBudgetsBtn')?.addEventListener('click', openBudgetModal);
    $('#expTypeInput')?.addEventListener('change', (e) => populateExpenseCategorySelect(e.target.value, $('#expCatInput')));
    $('#expenseForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = $('#expEditId').value;
      const type = $('#expTypeInput').value;
      const amount = parseFloat($('#expAmountInput').value);
      const category = $('#expCatInput').value;
      const date = $('#expDateInput').value;
      const description = $('#expDescInput').value.trim();
      if (!(amount > 0) || !description) return;

      if (editId) {
        const tx = expenseState.transactions.find((t) => t.id === editId);
        if (tx) Object.assign(tx, { type, amount, category, date, description });
        showToast('Transaction updated.', 'success');
      } else {
        expenseState.transactions.unshift({ id: uid(), type, amount, category, date, description });
        showToast('Transaction logged!', 'success');
      }
      saveJSON(MOD_KEYS.EXPENSES, expenseState);
      closeModal('expenseModal');
      renderExpensesView();
      renderDashExpensesWidget();
    });
    $('#budgetForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      $$('[data-budget-cat]').forEach((inp) => {
        expenseState.budgets[inp.dataset.budgetCat] = Math.max(0, Number(inp.value) || 0);
      });
      saveJSON(MOD_KEYS.EXPENSES, expenseState);
      closeModal('budgetModal');
      renderExpensesView();
      showToast('Monthly budgets updated.', 'success');
    });
    $$('[data-exp-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('[data-exp-filter]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        expFilterType = btn.dataset.expFilter;
        renderExpensesView();
      });
    });
    $('#expMonthFilter')?.addEventListener('change', (e) => {
      expFilterMonth = e.target.value;
      renderExpensesView();
    });
    $('#expCategoryFilter')?.addEventListener('change', (e) => {
      expFilterCat = e.target.value;
      renderExpensesView();
    });
    $('#expSearchInput')?.addEventListener('input', (e) => {
      expFilterSearch = e.target.value;
      renderExpensesView();
    });

    // Habit events
    $('#addHabitBtn')?.addEventListener('click', () => openHabitModal());
    $('#habitForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = $('#habitEditId').value;
      const name = $('#habitNameInput').value.trim();
      const category = $('#habitCatInput').value;
      const target = Math.min(7, Math.max(1, Number($('#habitGoalInput').value) || 5));
      if (!name) return;

      if (editId) {
        const h = habits.find((x) => x.id === editId);
        if (h) Object.assign(h, { name, category, target });
        showToast('Habit updated.', 'success');
      } else {
        habits.unshift({ id: uid(), name, category, target, completions: {} });
        showToast('Habit created!', 'success');
      }
      saveJSON(MOD_KEYS.HABITS, habits);
      closeModal('habitModal');
      renderHabitsView();
      renderDashHabitsWidget();
    });

    // Bookmark events
    $('#addBookmarkBtn')?.addEventListener('click', () => openBookmarkModal());
    $('#bookmarkForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = $('#bmEditId').value;
      const title = $('#bmTitleInput').value.trim();
      const url = normalizeURL($('#bmUrlInput').value);
      const folder = $('#bmFolderInput').value.trim() || 'General';
      const tags = $('#bmTagsInput')
        .value.split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (!title || !url) return;

      if (editId) {
        const bm = bookmarks.find((x) => x.id === editId);
        if (bm) Object.assign(bm, { title, url, folder, tags });
        showToast('Bookmark updated.', 'success');
      } else {
        bookmarks.unshift({ id: uid(), title, url, folder, tags, createdAt: Date.now() });
        showToast('Bookmark saved!', 'success');
      }
      saveJSON(MOD_KEYS.BOOKMARKS, bookmarks);
      closeModal('bookmarkModal');
      renderBookmarksView();
    });
    $('#bookmarkTagFilter')?.addEventListener('change', (e) => {
      bmTagFilter = e.target.value;
      renderBookmarksView();
    });
    $('#bookmarkSearchInput')?.addEventListener('input', (e) => {
      bmSearch = e.target.value;
      renderBookmarksView();
    });

    // QR Code Generator events
    ['#qrTextInput', '#qrSizeSelect', '#qrFgColor', '#qrBgColor'].forEach((sel) => {
      $(sel)?.addEventListener('input', renderQRCode);
      $(sel)?.addEventListener('change', renderQRCode);
    });
    $$('[data-qr-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $('#qrTextInput').value = btn.dataset.qrPreset;
        renderQRCode();
      });
    });
    $('#qrDownloadPngBtn')?.addEventListener('click', () => {
      const canvas = $('#qrCanvas');
      if (!lastQrMatrix || !canvas) return;
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'nexora-qrcode.png';
      a.click();
      showToast('QR Code PNG downloaded.', 'success');
    });
    $('#qrDownloadSvgBtn')?.addEventListener('click', () => {
      if (!lastQrMatrix) return;
      const n = lastQrMatrix.length;
      const quiet = 2;
      const total = n + quiet * 2;
      const fg = $('#qrFgColor').value || '#0f172a';
      const bg = $('#qrBgColor').value || '#ffffff';
      let rects = `<rect width="${total}" height="${total}" fill="${bg}"/>`;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (lastQrMatrix[r][c]) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1" fill="${fg}"/>`;
        }
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">${rects}</svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nexora-qrcode.svg';
      a.click();
      URL.revokeObjectURL(url);
      showToast('QR Code SVG downloaded.', 'success');
    });

    // Color Palette events
    $('#paletteGenerateBtn')?.addEventListener('click', generatePaletteColors);
    $('#paletteHarmonySelect')?.addEventListener('change', generatePaletteColors);
    $('#paletteSaveBtn')?.addEventListener('click', () => {
      savedPalettes.unshift(currentPalette.map((s) => s.hex));
      savedPalettes = savedPalettes.slice(0, 12);
      saveJSON(MOD_KEYS.PALETTES, savedPalettes);
      renderPaletteView();
      showToast('Palette saved!', 'success');
    });
    $('#paletteCopyCssBtn')?.addEventListener('click', async () => {
      const css = `:root {\n${currentPalette.map((s, i) => `  --color-${i + 1}: ${s.hex};`).join('\n')}\n}`;
      try {
        await navigator.clipboard.writeText(css);
        showToast('CSS variables copied!', 'success');
      } catch {
        showToast('Unable to access clipboard.', 'error');
      }
    });

    // Typing Speed Test events
    $$('[data-typing-dur]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('[data-typing-dur]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        typing.duration = Number(btn.dataset.typingDur) || 30;
        resetTypingTest();
      });
    });
    $('#typingCategorySelect')?.addEventListener('change', resetTypingTest);
    $('#typingRestartBtn')?.addEventListener('click', resetTypingTest);
    $('#typingHiddenInput')?.addEventListener('input', handleTypingInput);
    $('#typingPromptBox')?.addEventListener('click', () => $('#typingHiddenInput')?.focus());

    // Markdown Editor events
    const mdSource = $('#mdSourceInput');
    if (mdSource) {
      mdSource.value = localStorage.getItem(MOD_KEYS.MARKDOWN) ?? DEFAULT_MARKDOWN;
      mdSource.addEventListener('input', renderMarkdownPreview);
    }
    $('#mdFormatBar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !mdSource) return;
      const start = mdSource.selectionStart;
      const end = mdSource.selectionEnd;
      const sel = mdSource.value.slice(start, end) || 'text';
      let insert = sel;
      if (btn.dataset.mdWrap) {
        const w = btn.dataset.mdWrap;
        insert = `${w}${sel}${w}`;
      } else if (btn.dataset.mdPrefix) {
        insert = `${btn.dataset.mdPrefix}${sel}`;
      } else if (btn.dataset.mdLink) {
        insert = `[${sel}](https://example.com)`;
      }
      mdSource.setRangeText(insert, start, end, 'select');
      mdSource.focus();
      renderMarkdownPreview();
    });
    $('#mdSaveAsNoteBtn')?.addEventListener('click', () => {
      const text = mdSource.value.trim();
      if (!text) return;
      const firstLine = text.split('\n')[0].replace(/^#+\s*/, '').trim() || 'Markdown Note';
      addNoteExternal({ title: firstLine.slice(0, 60), tag: 'General', body: text });
      showToast('Markdown saved to Notes!', 'success');
    });
    $('#mdCopyHtmlBtn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('#mdPreviewOutput').innerHTML);
        showToast('Rendered HTML copied!', 'success');
      } catch {
        showToast('Clipboard permission denied.', 'error');
      }
    });
    $('#mdDownloadBtn')?.addEventListener('click', () => {
      const blob = new Blob([mdSource.value], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexora-doc-${formatDateISO()}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Markdown file downloaded.', 'success');
    });

    // Delegated click handlers for dynamic module cards
    document.addEventListener('click', async (e) => {
      const aiTaskBtn = e.target.closest('[data-ai-add-task]');
      if (aiTaskBtn) {
        const [msgIdx, sugIdx] = aiTaskBtn.dataset.aiAddTask.split(':').map(Number);
        const suggestions = extractActionSuggestions(aiHistory[msgIdx]?.content || '');
        const title = suggestions[sugIdx];
        if (title) {
          addTaskExternal({ title, priority: 'Medium', dueDate: formatDateISO(), notes: 'Created from NEXORA AI' });
          showToast(`Task created: "${title}"`, 'success');
        }
        return;
      }

      const aiSummaryBtn = e.target.closest('[data-ai-add-summary]');
      if (aiSummaryBtn) {
        const msg = aiHistory[Number(aiSummaryBtn.dataset.aiAddSummary)]?.content || '';
        const title = msg.split('\n')[0].slice(0, 80) || 'AI Action Item';
        addTaskExternal({ title, priority: 'Medium', dueDate: formatDateISO(), notes: msg });
        showToast('Saved AI suggestion as task!', 'success');
        return;
      }

      const editExp = e.target.closest('[data-edit-exp]');
      if (editExp) {
        openExpenseModal(editExp.dataset.editExp);
        return;
      }
      const delExp = e.target.closest('[data-delete-exp]');
      if (delExp) {
        const id = delExp.dataset.deleteExp;
        askConfirm({
          title: 'Delete Transaction',
          message: 'Remove this transaction from your ledger?',
          onConfirm: () => {
            expenseState.transactions = expenseState.transactions.filter((t) => t.id !== id);
            saveJSON(MOD_KEYS.EXPENSES, expenseState);
            renderExpensesView();
            renderDashExpensesWidget();
            showToast('Transaction deleted.', 'info');
          },
        });
        return;
      }

      const habitDay = e.target.closest('[data-habit-day]');
      if (habitDay) {
        const [hid, iso] = habitDay.dataset.habitDay.split(':');
        toggleHabitDay(hid, iso);
        return;
      }
      const editHabit = e.target.closest('[data-edit-habit]');
      if (editHabit) {
        openHabitModal(editHabit.dataset.editHabit);
        return;
      }
      const delHabit = e.target.closest('[data-delete-habit]');
      if (delHabit) {
        const id = delHabit.dataset.deleteHabit;
        askConfirm({
          title: 'Delete Habit',
          message: 'Delete this habit and its streak history?',
          onConfirm: () => {
            habits = habits.filter((h) => h.id !== id);
            saveJSON(MOD_KEYS.HABITS, habits);
            renderHabitsView();
            renderDashHabitsWidget();
            showToast('Habit deleted.', 'info');
          },
        });
        return;
      }

      const folderTab = e.target.closest('[data-bm-folder]');
      if (folderTab) {
        bmFolderFilter = folderTab.dataset.bmFolder;
        renderBookmarksView();
        return;
      }
      const copyBm = e.target.closest('[data-copy-bm]');
      if (copyBm) {
        try {
          await navigator.clipboard.writeText(copyBm.dataset.copyBm);
          showToast('Bookmark URL copied!', 'success');
        } catch {}
        return;
      }
      const editBm = e.target.closest('[data-edit-bm]');
      if (editBm) {
        openBookmarkModal(editBm.dataset.editBm);
        return;
      }
      const delBm = e.target.closest('[data-delete-bm]');
      if (delBm) {
        const id = delBm.dataset.deleteBm;
        askConfirm({
          title: 'Delete Bookmark',
          message: 'Remove this bookmark from your library?',
          onConfirm: () => {
            bookmarks = bookmarks.filter((b) => b.id !== id);
            saveJSON(MOD_KEYS.BOOKMARKS, bookmarks);
            renderBookmarksView();
            showToast('Bookmark deleted.', 'info');
          },
        });
        return;
      }

      const lockBtn = e.target.closest('[data-lock-swatch]');
      if (lockBtn) {
        const idx = Number(lockBtn.dataset.lockSwatch);
        currentPalette[idx].locked = !currentPalette[idx].locked;
        renderPaletteView();
        return;
      }
      const copyColor = e.target.closest('[data-copy-color]');
      if (copyColor) {
        try {
          await navigator.clipboard.writeText(copyColor.dataset.copyColor);
          showToast(`Copied ${copyColor.dataset.copyColor}`, 'success');
        } catch {}
        return;
      }
      const delPal = e.target.closest('[data-delete-palette]');
      if (delPal) {
        e.stopPropagation();
        savedPalettes.splice(Number(delPal.dataset.deletePalette), 1);
        saveJSON(MOD_KEYS.PALETTES, savedPalettes);
        renderPaletteView();
        return;
      }
      const loadPal = e.target.closest('[data-load-palette]');
      if (loadPal) {
        const pal = savedPalettes[Number(loadPal.dataset.loadPalette)];
        if (pal) {
          currentPalette = pal.map((hex) => ({ hex, locked: false }));
          renderPaletteView();
          showToast('Saved palette loaded.', 'info');
        }
      }
    });

    // Spacebar palette generator shortcut
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (state.activeView === 'palette' && e.code === 'Space' && !isTyping) {
        e.preventDefault();
        generatePaletteColors();
      }
    });

    // Core Hooks
    hooks.viewChange.push((view) => {
      if (view === 'ai') renderAIView();
      if (view === 'expenses') renderExpensesView();
      if (view === 'habits') renderHabitsView();
      if (view === 'bookmarks') renderBookmarksView();
      if (view === 'qrcode') renderQRCode();
      if (view === 'palette') renderPaletteView();
      if (view === 'typing') resetTypingTest();
      if (view === 'markdown') renderMarkdownPreview();
    });

    hooks.dashRender.push(() => {
      renderDashHabitsWidget();
      renderDashExpensesWidget();
    });

    hooks.globalSearch.push((q) => {
      const hits = [];
      expenseState.transactions
        .filter((t) => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((t) => {
          hits.push({
            title: `${t.description} (${formatMoney(t.amount)})`,
            type: 'Expense',
            icon: 'wallet',
            action: () => navigateTo('expenses'),
          });
        });

      habits
        .filter((h) => h.name.toLowerCase().includes(q) || h.category.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((h) => {
          hits.push({
            title: h.name,
            type: 'Habit',
            icon: 'flame',
            action: () => navigateTo('habits'),
          });
        });

      bookmarks
        .filter((b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || (b.tags || []).some((t) => t.includes(q)))
        .slice(0, 3)
        .forEach((b) => {
          hits.push({
            title: b.title,
            type: 'Bookmark',
            icon: 'bookmark',
            action: () => navigateTo('bookmarks'),
          });
        });
      return hits;
    });

    hooks.cmdActions.push(() => [
      { label: 'Log Expense / Income', sub: 'Finance', icon: 'wallet', action: () => openExpenseModal() },
      { label: 'Add New Habit', sub: 'Habits', icon: 'flame', action: () => openHabitModal() },
      { label: 'Add Bookmark', sub: 'Bookmarks', icon: 'bookmark-plus', action: () => openBookmarkModal() },
      { label: 'Generate Color Palette', sub: 'Palette', icon: 'palette', action: () => { navigateTo('palette'); generatePaletteColors(); } },
    ]);

    hooks.exportData.push(() => ({
      expenses: expenseState,
      habits,
      bookmarks,
      palettes: savedPalettes,
      typingStats,
      markdownDoc: localStorage.getItem(MOD_KEYS.MARKDOWN) || '',
      aiHistory,
    }));

    hooks.importData.push((data) => {
      if (data.expenses && Array.isArray(data.expenses.transactions)) {
        expenseState = data.expenses;
        saveJSON(MOD_KEYS.EXPENSES, expenseState);
      }
      if (Array.isArray(data.habits)) {
        habits = data.habits;
        saveJSON(MOD_KEYS.HABITS, habits);
      }
      if (Array.isArray(data.bookmarks)) {
        bookmarks = data.bookmarks;
        saveJSON(MOD_KEYS.BOOKMARKS, bookmarks);
      }
      if (Array.isArray(data.palettes)) {
        savedPalettes = data.palettes;
        saveJSON(MOD_KEYS.PALETTES, savedPalettes);
      }
      if (data.typingStats && typeof data.typingStats === 'object') {
        typingStats = data.typingStats;
        saveJSON(MOD_KEYS.TYPING, typingStats);
      }
      if (typeof data.markdownDoc === 'string') {
        localStorage.setItem(MOD_KEYS.MARKDOWN, data.markdownDoc);
        if ($('#mdSourceInput')) $('#mdSourceInput').value = data.markdownDoc;
      }
      if (Array.isArray(data.aiHistory)) {
        aiHistory = data.aiHistory;
        saveJSON(MOD_KEYS.AI_HISTORY, aiHistory);
      }
    });

    hooks.dataReset.push(() => {
      Object.values(MOD_KEYS).forEach((k) => localStorage.removeItem(k));
      expenseState = seedExpensesIfEmpty();
      habits = seedHabitsIfEmpty();
      bookmarks = seedBookmarksIfEmpty();
      aiConfig = { ...DEFAULT_AI_CONFIG };
      aiHistory = [];
      savedPalettes = [];
      typingStats = { bestWpm: 0 };
      if ($('#mdSourceInput')) $('#mdSourceInput').value = DEFAULT_MARKDOWN;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindModuleEvents();
    renderDashHabitsWidget();
    renderDashExpensesWidget();
    renderQRCode();
    renderPaletteView();
    resetTypingTest();
    renderMarkdownPreview();
    refreshIcons();
  });
})();
