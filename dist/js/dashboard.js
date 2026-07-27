/* ============================================
 * dashboard.js - 总览面板模块
 * 今日待办 · 学习/运动时长 · 收支汇总 · 目标管理
 * ============================================ */

const Dashboard = (function () {

  function render(container) {
    const date = Store.getCurrentDate();
    const d = new Date(date);
    const monthStr = date.slice(0, 7);

    // 获取各模块数据
    const checklistTasks = Store.getChecklistTasks(date);
    const archivedTasks = Store.getArchivedTasks(date);
    const exerciseCheckins = Store.getExerciseCheckins(date);
    const studyTodos = Store.getStudyTodosByDate(date);
    const transactions = Store.getTransactions(date);

    // 计算今日运动时长
    let exerciseDuration = 0;
    exerciseCheckins.forEach(c => {
      (c.timerIds || []).forEach(id => {
        const t = Store.getTimer(id);
        if (t) exerciseDuration += t.duration;
      });
    });

    // 计算今日学习时长
    let studyDuration = 0;
    studyTodos.forEach(t => {
      (t.timerIds || []).forEach(id => {
        const timer = Store.getTimer(id);
        if (timer) studyDuration += timer.duration;
      });
    });

    // 收支
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // 目标
    const goals = Store.getGoals();

    // 本月运动时长
    let monthExerciseDuration = 0;
    Store.getAllCheckins().forEach(c => {
      if (c.date.startsWith(monthStr)) {
        (c.timerIds || []).forEach(id => {
          const t = Store.getTimer(id);
          if (t) monthExerciseDuration += t.duration;
        });
      }
    });

    // 本月学习时长
    let monthStudyDuration = 0;
    Store.getStudyTodos().forEach(t => {
      (t.timerIds || []).forEach(id => {
        const timer = Store.getTimer(id);
        if (timer && timer.date.startsWith(monthStr)) {
          monthStudyDuration += timer.duration;
        }
      });
    });

    // 本月储蓄（收入-支出）
    const monthTxs = Store.getTransactionsByMonth(monthStr);
    const monthIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const monthSavings = monthIncome - monthExpense;

    container.innerHTML = `
      <div class="module-header">
        <h2>◈ 总览面板</h2>
        <div class="module-subtitle">${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${'日一二三四五六'[d.getDay()]}</div>
      </div>

      <!-- 今日概览卡片 -->
      <div class="grid-4 mb-20">
        <div class="dashboard-card">
          <div class="dashboard-card-icon">📋</div>
          <div class="dashboard-card-value">${checklistTasks.length}</div>
          <div class="dashboard-card-label">今日待办</div>
          <div class="dashboard-card-sub">${archivedTasks.length} 已完成</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-card-icon">🏃</div>
          <div class="dashboard-card-value">${Timer.formatTime(exerciseDuration)}</div>
          <div class="dashboard-card-label">今日运动时长</div>
          <div class="dashboard-card-sub">${exerciseCheckins.length} 次训练</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-card-icon">📚</div>
          <div class="dashboard-card-value">${Timer.formatTime(studyDuration)}</div>
          <div class="dashboard-card-label">今日学习时长</div>
          <div class="dashboard-card-sub">${studyTodos.filter(t => t.completed).length}/${studyTodos.length} 任务完成</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-card-icon">💰</div>
          <div class="dashboard-card-value" style="color:${expense > income ? 'var(--danger)' : 'var(--celadon-dark)'};">
            ${App.formatMoney(expense)}
          </div>
          <div class="dashboard-card-label">今日支出</div>
          <div class="dashboard-card-sub">收入 ${App.formatMoney(income)}</div>
        </div>
      </div>

      <!-- 今日待办概览 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">📋</span>
          今日待办概览
          <button class="btn-text" id="goChecklistBtn" style="margin-left:auto;">前往清单 →</button>
        </div>
        ${checklistTasks.length === 0
          ? '<div class="empty-state"><div class="empty-state-icon">📋</div>今日暂无待办事项</div>'
          : `<div class="dashboard-todo-preview">
              ${checklistTasks.slice(0, 5).map(t => {
                const qColors = ['var(--danger)', 'var(--warning)', '#D4855E', 'var(--bean-green)'];
                return `
                  <div class="list-item">
                    <span style="width:8px;height:8px;border-radius:50%;background:${qColors[t.quadrant]};flex-shrink:0;"></span>
                    <span class="flex-1 text-sm">${App.escapeHtml(t.text)}</span>
                    ${t.recurring !== 'none' ? '<span class="text-xs text-muted">🔁</span>' : ''}
                  </div>
                `;
              }).join('')}
              ${checklistTasks.length > 5 ? `<div class="text-center text-sm text-muted mt-8">还有 ${checklistTasks.length - 5} 项…</div>` : ''}
            </div>`
        }
      </div>

      <!-- 目标管理 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">🎯</span>
          目标管理
          <button class="btn btn-sm" id="editGoalsBtn" style="margin-left:auto;">设置目标</button>
        </div>
        <div class="grid-3">
          ${renderGoalCard('exercise', '月度运动目标', Timer.formatTime(monthExerciseDuration), goals.exercise.monthlyMinutes ? Timer.formatTime(goals.exercise.monthlyMinutes * 60) : '未设置', monthExerciseDuration, goals.exercise.monthlyMinutes * 60, '分')}
          ${renderGoalCard('reading', '月度阅读目标', Timer.formatTime(monthStudyDuration), goals.reading.monthlyMinutes ? Timer.formatTime(goals.reading.monthlyMinutes * 60) : '未设置', monthStudyDuration, goals.reading.monthlyMinutes * 60, '分')}
          ${renderGoalCard('savings', '月度储蓄目标', App.formatMoney(monthSavings), goals.savings.monthlyTarget ? App.formatMoney(goals.savings.monthlyTarget) : '未设置', monthSavings, goals.savings.monthlyTarget, '元')}
        </div>
      </div>

      <!-- 快捷入口 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">⚡</span>
          快捷入口
        </div>
        <div class="grid-4">
          <div class="quick-action" data-module="exercise">
            <span style="font-size:28px;">🏃</span>
            <span class="text-sm">开始锻炼</span>
          </div>
          <div class="quick-action" data-module="study">
            <span style="font-size:28px;">📚</span>
            <span class="text-sm">学习计时</span>
          </div>
          <div class="quick-action" data-module="accounting">
            <span style="font-size:28px;">💰</span>
            <span class="text-sm">记一笔</span>
          </div>
          <div class="quick-action" data-module="records">
            <span style="font-size:28px;">✏️</span>
            <span class="text-sm">写记录</span>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function renderGoalCard(key, label, currentValue, targetValue, current, target, unit) {
    const percent = target > 0 ? Math.min(100, (current / target * 100)).toFixed(0) : 0;
    const isMoney = unit === '元';
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
          const contentArea = document.getElementById('contentArea');
          render(contentArea);
        }
      }
    ]);
  }

  function bindEvents() {
    document.getElementById('goChecklistBtn').addEventListener('click', function () {
      App.loadModule('checklist');
    });

    document.getElementById('editGoalsBtn').addEventListener('click', showEditGoalsModal);

    document.querySelectorAll('.quick-action').forEach(el => {
      el.addEventListener('click', function () {
        App.loadModule(this.dataset.module);
      });
    });
  }

  return { render };
})();
