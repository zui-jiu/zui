/* ============================================
 * exercise.js - 锻炼计划模块
 * 多功能计时器 + 每日训练打卡 + 历史统计
 * ============================================ */

const Exercise = (function () {

  const TRAINING_LABELS = [
    '有氧训练', '力量训练', '练背', '练腿', '练臀',
    '练肩', '练胸', '核心训练', '拉伸放松'
  ];

  function render(container) {
    const date = Store.getCurrentDate();
    container.innerHTML = `
      <div class="module-header">
        <h2>🏃 锻炼计划</h2>
        <div class="module-subtitle">计时训练 · 每日打卡 · 历史追踪</div>
      </div>

      <!-- 板块1：多功能计时器 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">⏱</span>
          多功能计时器
        </div>
        <div id="exerciseTimerWidget"></div>
      </div>

      <!-- 板块2：每日训练打卡 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">✅</span>
          每日训练打卡
          <span class="text-muted text-sm" style="margin-left:auto;">${App.formatDate(date)}</span>
        </div>

        <div id="exerciseCheckinArea">
          ${renderCheckinForm()}
          ${renderTodayCheckins()}
        </div>
      </div>

      <!-- 板块3：训练历史统计 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">📊</span>
          训练历史统计
          <div style="margin-left:auto;display:flex;gap:6px;">
            <button class="btn btn-sm stat-period-btn active" data-period="week">本周</button>
            <button class="btn btn-sm stat-period-btn" data-period="month">本月</button>
          </div>
        </div>
        <div id="exerciseStats">${renderStats('week')}</div>
      </div>

      <!-- 板块4：体能体重录入 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">⚖️</span>
          体能与体重录入
        </div>
        <div id="bodyMetricsArea">${renderBodyMetrics()}</div>
      </div>
    `;

    // 初始化计时器
    Timer.createTimerWidget('exerciseTimerWidget', 'exercise', function () {
      refreshCheckins();
    });

    // 绑定标签选择
    bindCheckinEvents();

    // 统计周期切换
    container.querySelectorAll('.stat-period-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        container.querySelectorAll('.stat-period-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        document.getElementById('exerciseStats').innerHTML = renderStats(this.dataset.period);
      });
    });
  }

  // 渲染打卡表单
  function renderCheckinForm() {
    return `
      <div class="checkin-form">
        <div class="mb-12">
          <label class="text-sm text-muted mb-8" style="display:block;">选择训练标签（可多选）</label>
          <div class="flex-row flex-wrap" id="trainingLabelTags">
            ${TRAINING_LABELS.map((label, i) => `
              <span class="tag training-label-tag" data-label="${label}">${label}</span>
            `).join('')}
          </div>
        </div>

        <div class="mb-12">
          <label class="text-sm text-muted mb-8" style="display:block;">导入计时记录（可选）</label>
          <div id="checkinTimerRepo" class="timer-repo-container"></div>
          <div id="selectedTimersDisplay" class="mt-8"></div>
        </div>

        <div class="grid-2 mb-12">
          <div>
            <label class="text-sm text-muted mb-8" style="display:block;">当日训练备注</label>
            <textarea class="textarea" id="checkinNotes" placeholder="今天训练的感受、状态…" rows="2"></textarea>
          </div>
          <div>
            <label class="text-sm text-muted mb-8" style="display:block;">当日训练总结</label>
            <textarea class="textarea" id="checkinSummary" placeholder="训练完成情况、改进点…" rows="2"></textarea>
          </div>
        </div>

        <div class="grid-2 mb-12">
          <div>
            <label class="text-sm text-muted mb-8" style="display:block;">体重 (kg)</label>
            <input type="number" class="input" id="checkinWeight" placeholder="如 65.5" step="0.1">
          </div>
          <div>
            <label class="text-sm text-muted mb-8" style="display:block;">体能记录</label>
            <input type="text" class="input" id="checkinFitness" placeholder="如 跑步5km/俯卧撑30个">
          </div>
        </div>

        <button class="btn btn-primary" id="saveCheckinBtn">保存训练打卡</button>
      </div>
    `;
  }

  // 渲染今日打卡列表
  function renderTodayCheckins() {
    const date = Store.getCurrentDate();
    const checkins = Store.getExerciseCheckins(date);

    if (checkins.length === 0) {
      return '<div class="mt-16"><div class="empty-state"><div class="empty-state-icon">📋</div>今日暂无训练打卡记录</div></div>';
    }

    let html = '<div class="mt-16"><div class="text-sm text-muted mb-8">今日打卡记录</div>';
    checkins.forEach(c => {
      const timers = (c.timerIds || []).map(id => {
        const t = Store.getTimer(id);
        return t ? `<span class="tag" style="font-size:11px;">${App.escapeHtml(t.name)} (${Timer.formatTime(t.duration)})</span>` : '';
      }).join(' ');

      html += `
        <div class="list-item" style="align-items:flex-start;flex-direction:column;">
          <div class="flex-between w-full">
            <div class="flex-row flex-wrap">
              ${c.labels.map(l => `<span class="tag selected" style="cursor:default;">${l}</span>`).join(' ')}
            </div>
            <button class="btn-text danger delete-checkin-btn" data-id="${c.id}">删除</button>
          </div>
          ${timers ? `<div class="mt-8">${timers}</div>` : ''}
          ${c.notes ? `<div class="text-sm mt-8"><span class="text-muted">备注：</span>${App.escapeHtml(c.notes)}</div>` : ''}
          ${c.summary ? `<div class="text-sm"><span class="text-muted">总结：</span>${App.escapeHtml(c.summary)}</div>` : ''}
          ${c.weight ? `<div class="text-sm"><span class="text-muted">体重：</span>${c.weight} kg</div>` : ''}
          ${c.fitness ? `<div class="text-sm"><span class="text-muted">体能：</span>${App.escapeHtml(c.fitness)}</div>` : ''}
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  // 选中的标签和计时器
  let selectedLabels = [];
  let selectedTimerIds = [];

  function bindCheckinEvents() {
    // 标签选择
    document.querySelectorAll('.training-label-tag').forEach(tag => {
      tag.addEventListener('click', function () {
        const label = this.dataset.label;
        if (selectedLabels.includes(label)) {
          selectedLabels = selectedLabels.filter(l => l !== label);
          this.classList.remove('selected');
        } else {
          selectedLabels.push(label);
          this.classList.add('selected');
        }
      });
    });

    // 渲染计时仓库（用于导入）
    Timer.renderTimerRepo('checkinTimerRepo', function (t) { return t.source === 'exercise'; }, function (timer) {
      if (!selectedTimerIds.includes(timer.id)) {
        selectedTimerIds.push(timer.id);
        App.toast(`已导入"${timer.name}"`, 'success');
        renderSelectedTimers();
      } else {
        App.toast('该计时已导入', 'warning');
      }
    });

    // 保存打卡
    document.getElementById('saveCheckinBtn').addEventListener('click', function () {
      if (selectedLabels.length === 0 && selectedTimerIds.length === 0) {
        App.toast('请至少选择一个训练标签或导入计时记录', 'warning');
        return;
      }

      Store.addExerciseCheckin({
        labels: [...selectedLabels],
        timerIds: [...selectedTimerIds],
        notes: document.getElementById('checkinNotes').value,
        summary: document.getElementById('checkinSummary').value,
        weight: document.getElementById('checkinWeight').value,
        fitness: document.getElementById('checkinFitness').value
      });

      App.toast('训练打卡已保存！', 'success');
      selectedLabels = [];
      selectedTimerIds = [];
      refreshCheckins();
    });

    // 删除打卡
    document.querySelectorAll('.delete-checkin-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (confirm('确定删除这条打卡记录？')) {
          Store.deleteExerciseCheckin(this.dataset.id);
          App.toast('已删除', 'success');
          refreshCheckins();
        }
      });
    });
  }

  function renderSelectedTimers() {
    const container = document.getElementById('selectedTimersDisplay');
    if (selectedTimerIds.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = selectedTimerIds.map(id => {
      const t = Store.getTimer(id);
      if (!t) return '';
      return `<span class="tag selected" style="cursor:pointer;" data-id="${id}">${App.escapeHtml(t.name)} ✕</span>`;
    }).join(' ');

    container.querySelectorAll('.tag').forEach(tag => {
      tag.addEventListener('click', function () {
        selectedTimerIds = selectedTimerIds.filter(id => id !== this.dataset.id);
        renderSelectedTimers();
      });
    });
  }

  function refreshCheckins() {
    const area = document.getElementById('exerciseCheckinArea');
    if (!area) return;
    selectedLabels = [];
    selectedTimerIds = [];
    area.innerHTML = renderCheckinForm() + renderTodayCheckins();
    bindCheckinEvents();
  }

  // 渲染统计
  function renderStats(period) {
    const allCheckins = Store.getAllCheckins();
    const now = new Date(Store.getCurrentDate());

    let filtered = [];
    if (period === 'week') {
      // 本周
      const weekStart = new Date(now);
      const day = weekStart.getDay() || 7;
      weekStart.setDate(weekStart.getDate() - day + 1);
      weekStart.setHours(0, 0, 0, 0);
      filtered = allCheckins.filter(c => new Date(c.date) >= weekStart && new Date(c.date) <= now);
    } else {
      // 本月
      const monthStr = now.toISOString().slice(0, 7);
      filtered = allCheckins.filter(c => c.date.startsWith(monthStr));
    }

    if (filtered.length === 0) {
      return '<div class="empty-state"><div class="empty-state-icon">📊</div>暂无统计数据</div>';
    }

    // 统计训练频次
    const freq = {};
    filtered.forEach(c => {
      c.labels.forEach(l => {
        freq[l] = (freq[l] || 0) + 1;
      });
    });

    // 统计累计训练时长
    let totalDuration = 0;
    filtered.forEach(c => {
      (c.timerIds || []).forEach(id => {
        const t = Store.getTimer(id);
        if (t) totalDuration += t.duration;
      });
    });

    const totalMins = Math.floor(totalDuration / 60);
    const periodLabel = period === 'week' ? '本周' : '本月';

    let html = `
      <div class="grid-3 mb-16">
        <div class="stat-card">
          <div class="stat-card-value">${filtered.length}</div>
          <div class="stat-card-label">${periodLabel}训练次数</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${totalMins}<span class="text-sm" style="font-weight:400;">分</span></div>
          <div class="stat-card-label">${periodLabel}累计训练时长</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${Object.keys(freq).length}</div>
          <div class="stat-card-label">${periodLabel}训练类型数</div>
        </div>
      </div>
    `;

    // 训练频次分布
    const sortedFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const maxFreq = sortedFreq.length > 0 ? sortedFreq[0][1] : 1;

    html += '<div class="text-sm text-muted mb-8">训练频次分布</div>';
    html += '<div class="freq-chart">';
    sortedFreq.forEach(([label, count]) => {
      const width = (count / maxFreq * 100).toFixed(0);
      html += `
        <div class="freq-bar-row">
          <span class="freq-bar-label">${label}</span>
          <div class="freq-bar-track">
            <div class="freq-bar-fill" style="width:${width}%;"></div>
          </div>
          <span class="freq-bar-count">${count}次</span>
        </div>
      `;
    });
    html += '</div>';

    return html;
  }

  // 体能体重录入
  function renderBodyMetrics() {
    const date = Store.getCurrentDate();
    const checkins = Store.getExerciseCheckins(date);
    const latest = checkins.length > 0 ? checkins[checkins.length - 1] : null;

    // 历史体重记录
    const allCheckins = Store.getAllCheckins().filter(c => c.weight);
    const recentWeights = allCheckins.slice(-10).reverse();

    let html = '<div class="text-sm text-muted mb-8">最近体重记录趋势</div>';

    if (recentWeights.length === 0) {
      html += '<div class="empty-state"><div class="empty-state-icon">⚖️</div>暂无体重记录，请在上方打卡时填写</div>';
    } else {
      html += '<div class="weight-history-list">';
      recentWeights.forEach(c => {
        html += `
          <div class="list-item">
            <span class="text-muted text-sm">${c.date}</span>
            <span class="flex-1"></span>
            <span class="fw-600">${c.weight} kg</span>
          </div>
        `;
      });
      html += '</div>';
    }

    return html;
  }

  return { render };
})();
