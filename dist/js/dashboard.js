/* ============================================
 * dashboard.js - 总览面板模块
 * 月历组件 · 今日动态（快捷入口 + 当日汇总）· 目标管理
 * ============================================ */

const Dashboard = (function () {

  // 当前日历显示的月份（YYYY-MM），默认跟随当前日期
  let calMonth = null;

  function render(container) {
    if (!calMonth) calMonth = Store.getCurrentDate().slice(0, 7);
    const date = Store.getCurrentDate();

    container.innerHTML = `
      <div class="module-header">
        <h2>◈ 总览面板</h2>
        <div class="module-subtitle">${getWeekdayText(date)}</div>
      </div>

      <!-- 月历组件 -->
      <div class="section-block">
        <div id="calendarArea">${renderCalendar()}</div>
      </div>

      <!-- 今日动态：合并快捷入口 + 当日汇总 -->
      <div class="section-block collapsible">
        <div class="section-title">
          <span class="section-title-icon">⚡</span>
          今日动态
        </div>
        <div id="todayDynamicArea">${renderTodayDynamic()}</div>
      </div>

      <!-- 目标管理 -->
      <div class="section-block collapsible">
        <div class="section-title">
          <span class="section-title-icon">🎯</span>
          目标管理
          <button class="btn btn-sm" id="editGoalsBtn" style="margin-left:auto;">设置目标</button>
        </div>
        <div class="grid-3">
          ${renderGoalCard('exercise', '月度运动目标', Timer.formatTime(monthExerciseDuration()), goalsSummary().exercise.target ? Timer.formatTime(goalsSummary().exercise.target) : '未设置', monthExerciseDuration(), goalsSummary().exercise.target, '分')}
          ${renderGoalCard('reading', '月度阅读目标', Timer.formatTime(monthStudyDuration()), goalsSummary().reading.target ? Timer.formatTime(goalsSummary().reading.target) : '未设置', goalsSummary().reading.current, goalsSummary().reading.target, '分')}
          ${renderGoalCard('savings', '月度储蓄目标', App.formatMoney(monthSavings()), goalsSummary().savings.target ? App.formatMoney(goalsSummary().savings.target) : '未设置', monthSavings(), goalsSummary().savings.target, '元')}
        </div>
      </div>
    `;

    bindEvents();
    App.bindCollapsible(container);
  }

  // 月历渲染
  function renderCalendar() {
    const [year, month] = calMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0=周日
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);
    const curDate = Store.getCurrentDate();

    // 备注标记
    const dailyNotes = Store.getAll().dailyNotes || {};

    let cells = '';
    for (let i = 0; i < startWeekday; i++) {
      cells += '<div class="cal-cell cal-cell-empty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = ds === todayStr;
      const isSelected = ds === curDate;
      const hasNote = !!dailyNotes[ds];
      const cls = ['cal-cell'];
      if (isToday) cls.push('cal-today');
      if (isSelected) cls.push('cal-selected');
      cells += `<div class="${cls.join(' ')}" data-date="${ds}">
        <span class="cal-num">${d}</span>
        ${hasNote ? '<span class="cal-note-dot"></span>' : ''}
      </div>`;
    }

    const weekHead = ['日', '一', '二', '三', '四', '五', '六'].map(w => `<div class="cal-weekday">${w}</div>`).join('');

    return `
      <div class="calendar">
        <div class="calendar-header">
          <button class="date-nav-btn" id="calPrevBtn" title="上一月">‹</button>
          <div class="calendar-title">${year}年${month}月</div>
          <button class="date-nav-btn" id="calNextBtn" title="下一月">›</button>
          <button class="date-today-btn" id="calTodayBtn" style="margin-left:8px;">今天</button>
        </div>
        <div class="calendar-weekdays">${weekHead}</div>
        <div class="calendar-grid">${cells}</div>
      </div>
    `;
  }

  // 今日动态（快捷入口 + 当日汇总）
  function renderTodayDynamic() {
    const date = Store.getCurrentDate();

    const checklistTasks = Store.getChecklistTasks(date);
    const archivedTasks = Store.getArchivedTasks(date);
    const exerciseCheckins = Store.getExerciseCheckins(date);
    const studyTodos = Store.getStudyTodosByDate(date);
    const transactions = Store.getTransactions(date);

    let exerciseDuration = 0;
    exerciseCheckins.forEach(c => (c.timerIds || []).forEach(id => {
      const t = Store.getTimer(id); if (t) exerciseDuration += t.duration;
    }));
    let studyDuration = 0;
    studyTodos.forEach(t => (t.timerIds || []).forEach(id => {
      const tm = Store.getTimer(id); if (tm) studyDuration += tm.duration;
    }));
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const quickActions = [
      { module: 'exercise', icon: '🏃', label: '去锻炼' },
      { module: 'study', icon: '📚', label: '去学习' },
      { module: 'checklist', icon: '📋', label: '去清单' },
      { module: 'accounting', icon: '💰', label: '去记账' }
    ];

    const summaryCards = [
      { icon: '🏃', value: Timer.formatTime(exerciseDuration), label: '运动时长', sub: `${exerciseCheckins.length} 次训练` },
      { icon: '📚', value: Timer.formatTime(studyDuration), label: '学习时长', sub: `${studyTodos.filter(t => (t.checkDates || []).includes(date)).length}/${studyTodos.length} 已完成` },
      { icon: '📋', value: checklistTasks.length, label: '待办事项', sub: `${archivedTasks.length} 已完成` },
      { icon: '💰', value: App.formatMoney(expense), label: '今日支出', sub: `收入 ${App.formatMoney(income)}` }
    ];

    return `
      <div class="quick-actions-grid">
        ${quickActions.map(q => `
          <div class="quick-action" data-module="${q.module}">
            <span style="font-size:26px;">${q.icon}</span>
            <span class="text-sm">${q.label}</span>
          </div>
        `).join('')}
      </div>

      <div class="today-summary mt-16">
        ${summaryCards.map(c => `
          <div class="dashboard-card today-summary-card">
            <div class="dashboard-card-icon">${c.icon}</div>
            <div class="dashboard-card-info">
              <div class="dashboard-card-value">${c.value}</div>
              <div class="dashboard-card-label">${c.label}</div>
              <div class="dashboard-card-sub">${c.sub}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 月份维度的目标统计
  function goalsSummary() {
    const monthStr = Store.getCurrentDate().slice(0, 7);
    let monthExerciseDuration = 0;
    Store.getAllCheckins().forEach(c => {
      if (c.date.startsWith(monthStr)) (c.timerIds || []).forEach(id => {
        const t = Store.getTimer(id); if (t) monthExerciseDuration += t.duration;
      });
    });
    let monthStudyDuration = 0;
    Store.getStudyTodos().forEach(t => (t.timerIds || []).forEach(id => {
      const tm = Store.getTimer(id);
      if (tm && tm.date.startsWith(monthStr)) monthStudyDuration += tm.duration;
    }));
    const monthTxs = Store.getTransactionsByMonth(monthStr);
    const monthIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const goals = Store.getGoals();
    return {
      exercise: { current: monthExerciseDuration, target: goals.exercise.monthlyMinutes * 60 },
      reading: { current: monthStudyDuration, target: goals.reading.monthlyMinutes * 60 },
      savings: { current: monthIncome - monthExpense, target: goals.savings.monthlyTarget }
    };
  }
  function monthExerciseDuration() { return goalsSummary().exercise.current; }
  function monthStudyDuration() { return goalsSummary().reading.current; }
  function monthSavings() { return goalsSummary().savings.current; }

  function getWeekdayText(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${'日一二三四五六'[d.getDay()]}`;
  }

  function renderGoalCard(key, label, currentValue, targetValue, current, target, unit) {
    const percent = target > 0 ? Math.min(100, (current / target * 100)).toFixed(0) : 0;
    return `
      <div class="goal-card stat-card">
        <div class="text-sm text-muted mb-8">${label}</div>
        <div class="flex-between mb-8">
          <span class="fw-600" style="font-size:18px;color:var(--celadon-dark);">${currentValue}</span>
          <span class="text-sm text-muted">/ ${targetValue}</span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width:${percent}%;background:${percent >= 100 ? 'var(--celadon)' : 'var(--celadon-light)'};"></div>
        </div>
        <div class="text-xs text-muted mt-8">${percent}% ${percent >= 100 ? '🎉 已达成！' : ''}</div>
      </div>
    `;
  }

  // 编辑某日期「一句话备注」的弹窗
  function showDateNoteModal(dateStr) {
    const existing = Store.getDailyNote(dateStr);
    App.modal(`${dateStr} 的备注`, `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">一句话备注</label>
        <textarea class="textarea" id="dailyNoteInput" rows="3" placeholder="为这一天写一句话备注…">${App.escapeHtml(existing)}</textarea>
      </div>
      <div class="text-sm text-muted">该备注会显示在月历对应日期上。</div>
    `, [
      { label: '删除', onClick: function () {
          Store.deleteDailyNote(dateStr);
          App.toast('备注已删除', 'success');
          refreshCalendar();
        }
      },
      { label: '保存', primary: true, onClick: function (body) {
          const val = body.querySelector('#dailyNoteInput').value;
          Store.setDailyNote(dateStr, val);
          App.toast('备注已保存', 'success');
          refreshCalendar();
        }
      }
    ]);
  }

  function refreshCalendar() {
    const area = document.getElementById('calendarArea');
    if (area) area.innerHTML = renderCalendar();
    bindCalendarEvents();
  }

  function bindCalendarEvents() {
    const prev = document.getElementById('calPrevBtn');
    const next = document.getElementById('calNextBtn');
    const todayBtn = document.getElementById('calTodayBtn');
    if (prev) prev.addEventListener('click', function () {
      const [y, m] = calMonth.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      refreshCalendar();
    });
    if (next) next.addEventListener('click', function () {
      const [y, m] = calMonth.split('-').map(Number);
      const d = new Date(y, m, 1);
      calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      refreshCalendar();
    });
    if (todayBtn) todayBtn.addEventListener('click', function () {
      const t = new Date().toISOString().slice(0, 10);
      calMonth = t.slice(0, 7);
      Store.setCurrentDate(t);
      const di = document.getElementById('currentDate');
      if (di) di.value = t;
      render(document.getElementById('contentArea'));
    });
    document.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', function () {
        const ds = this.dataset.date;
        Store.setCurrentDate(ds);
        const di = document.getElementById('currentDate');
        if (di) di.value = ds;
        // 先刷新高亮，再弹备注
        refreshCalendar();
        showDateNoteModal(ds);
      });
    });
  }

  function showEditGoalsModal() {
    const goals = Store.getGoals();
    App.modal('设置月度目标', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">月度运动目标（分钟/月）</label>
        <input type="number" class="input" id="goalExercise" value="${goals.exercise.monthlyMinutes || ''}" placeholder="如 1000">
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">月度阅读目标（分钟/月）</label>
        <input type="number" class="input" id="goalReading" value="${goals.reading.monthlyMinutes || ''}" placeholder="如 1200">
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">月度储蓄目标（元/月）</label>
        <input type="number" class="input" id="goalSavings" value="${goals.savings.monthlyTarget || ''}" placeholder="如 3000">
      </div>
    `, [
      { label: '取消' },
      {
        label: '保存',
        primary: true,
        onClick: function (body) {
          Store.updateGoals({
            exercise: { monthlyMinutes: parseInt(body.querySelector('#goalExercise').value) || 0, label: '月度运动目标(分钟)' },
            reading: { monthlyMinutes: parseInt(body.querySelector('#goalReading').value) || 0, label: '月度阅读目标(分钟)' },
            savings: { monthlyTarget: parseFloat(body.querySelector('#goalSavings').value) || 0, label: '月度储蓄目标(元)' }
          });
          App.toast('目标已设置', 'success');
          render(document.getElementById('contentArea'));
        }
      }
    ]);
  }

  function bindEvents() {
    document.getElementById('editGoalsBtn').addEventListener('click', showEditGoalsModal);
    bindCalendarEvents();
    document.querySelectorAll('.quick-action').forEach(el => {
      el.addEventListener('click', function () {
        App.loadModule(this.dataset.module);
      });
    });
  }

  return { render };
})();
