/* ============================================
 * exercise.js - 锻炼计划模块（重构）
 * 每日打卡方框 · 详情弹窗 · 目录式历史统计（SVG 折线图）· 数据录入
 * ============================================ */

const Exercise = (function () {

  // 历史统计视图状态
  let statView = 'menu'; // 'menu' | 'weight' | 'fitness' | 'freq' | 'all'
  let statPeriod = 'month'; // 'week' | 'month'

  // 选中的标签和计时器（详情弹窗内）
  let selectedLabels = [];
  let selectedTimerIds = [];

  function render(container) {
    const date = Store.getCurrentDate();
    const checkins = Store.getExerciseCheckins(date);
    const checkedToday = checkins.length > 0;

    container.innerHTML = `
      <div class="module-header">
        <h2>🏃 锻炼计划</h2>
        <div class="module-subtitle">每日打卡 · 历史追踪 · 数据可视化</div>
      </div>

      <!-- 板块1：每日训练打卡（横向方框） -->
      <div class="section-block collapsible">
        <div class="section-title">
          <span class="section-title-icon">✅</span>
          每日训练打卡
        </div>
        <div class="checkin-status-box ${checkedToday ? 'checked' : ''}" id="checkinStatusBox">
          <div class="checkin-status-left">
            <div class="checkin-status-date">${App.formatDate(date)}</div>
            <div class="checkin-status-text">${checkedToday ? '今日已打卡 ✓' : '今日未打卡'}</div>
          </div>
          <button class="btn ${checkedToday ? '' : 'btn-primary'}" id="openCheckinBtn">${checkedToday ? '查看/补充' : '立即打卡'}</button>
        </div>
        <div id="todayCheckinsList" class="mt-12">${renderTodayCheckins()}</div>
      </div>

      <!-- 板块2：训练历史统计（目录式） -->
      <div class="section-block collapsible collapsed">
        <div class="section-title">
          <span class="section-title-icon">📊</span>
          训练历史统计
        </div>
        <div id="exerciseStatsArea">${renderStatsArea()}</div>
      </div>

      <!-- 板块3：数据录入（目录式） -->
      <div class="section-block collapsible collapsed">
        <div class="section-title">
          <span class="section-title-icon">⚖️</span>
          体能与体重录入
        </div>
        <div class="dir-list">
          <div class="dir-item" data-action="new-checkin">
            <span class="dir-item-icon">🏋</span>
            <span class="dir-item-main">
              <span class="dir-item-title">新增训练打卡</span>
              <span class="dir-item-sub">记录今日训练标签、备注、体重、体能</span>
            </span>
            <span class="dir-item-arrow">›</span>
          </div>
          <div class="dir-item" data-action="weight-quick">
            <span class="dir-item-icon">⚖️</span>
            <span class="dir-item-main">
              <span class="dir-item-title">体重速记</span>
              <span class="dir-item-sub">快速记录今日体重</span>
            </span>
            <span class="dir-item-arrow">›</span>
          </div>
          <div class="dir-item" data-action="fitness-quick">
            <span class="dir-item-icon">🔥</span>
            <span class="dir-item-main">
              <span class="dir-item-title">体能速记</span>
              <span class="dir-item-sub">快速记录今日体能</span>
            </span>
            <span class="dir-item-arrow">›</span>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    App.bindCollapsible(container);
  }

  // 渲染今日打卡列表（紧凑）
  function renderTodayCheckins() {
    const date = Store.getCurrentDate();
    const checkins = Store.getExerciseCheckins(date);
    if (checkins.length === 0) {
      return '<div class="text-sm text-muted">今日还没有打卡记录</div>';
    }
    return checkins.map(c => {
      const timers = (c.timerIds || []).map(id => {
        const t = Store.getTimer(id);
        return t ? `<span class="tag" style="font-size:11px;">${App.escapeHtml(t.name)} (${Timer.formatTime(t.duration)})</span>` : '';
      }).join(' ');
      return `
        <div class="list-item checkin-mini" data-id="${c.id}" style="cursor:pointer;align-items:flex-start;flex-direction:column;">
          <div class="flex-between w-full">
            <div class="flex-row flex-wrap">
              ${c.labels.map(l => `<span class="tag selected" style="cursor:default;">${l}</span>`).join(' ')}
            </div>
            <button class="btn-text danger delete-checkin-btn" data-id="${c.id}">删除</button>
          </div>
          ${timers ? `<div class="mt-8">${timers}</div>` : ''}
          ${c.notes || c.summary || c.weight || c.fitness ? `
            <div class="text-sm text-muted mt-8" style="line-height:1.7;">
              ${c.weight ? '体重 ' + App.escapeHtml(c.weight) + 'kg · ' : ''}${c.fitness ? '体能 ' + App.escapeHtml(c.fitness) + ' · ' : ''}${c.notes ? App.escapeHtml(c.notes) : ''}${c.summary ? '『' + App.escapeHtml(c.summary) + '』' : ''}
            </div>` : ''}
        </div>
      `;
    }).join('');
  }

  // 历史统计区域（目录 / 图表）
  function renderStatsArea() {
    if (statView === 'menu') {
      const items = [
        { key: 'weight', icon: '⚖️', title: '体重变化', sub: '体重随时间的折线趋势' },
        { key: 'fitness', icon: '🔥', title: '体能评分', sub: '体能记录数值化折线趋势' },
        { key: 'freq', icon: '📅', title: '训练频次', sub: '每日训练次数折线' },
        { key: 'all', icon: '📈', title: '综合概览', sub: '体重 / 体能 / 频次 同图' }
      ];
      return '<div class="dir-list">' + items.map(it => `
        <div class="dir-item" data-stat="${it.key}">
          <span class="dir-item-icon">${it.icon}</span>
          <span class="dir-item-main">
            <span class="dir-item-title">${it.title}</span>
            <span class="dir-item-sub">${it.sub}</span>
          </span>
          <span class="dir-item-arrow">›</span>
        </div>
      `).join('') + '</div>';
    }

    // 子视图
    const titles = { weight: '体重变化', fitness: '体能评分', freq: '训练频次', all: '综合概览' };
    let html = `
      <div class="flex-between mb-12">
        <button class="btn-text" id="statBackBtn">← 返回目录</button>
        <div class="flex-row" style="gap:6px;">
          <button class="btn btn-sm stat-period-btn ${statPeriod === 'week' ? 'btn-primary' : ''}" data-period="week">本周</button>
          <button class="btn btn-sm stat-period-btn ${statPeriod === 'month' ? 'btn-primary' : ''}" data-period="month">本月</button>
        </div>
      </div>
      <div class="text-sm text-muted mb-8">${titles[statView]} · ${statPeriod === 'week' ? '本周' : '本月'}</div>
      <div id="statChartArea"></div>
    `;
    return html;
  }

  // 计算统计序列
  function buildSeries() {
    const all = Store.getAllCheckins();
    const today = new Date(Store.getCurrentDate());
    let dates = [];
    if (statPeriod === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
      }
    } else {
      const y = today.getFullYear(), m = today.getMonth();
      const days = new Date(y, m + 1, 0).getDate();
      for (let i = 1; i <= days; i++) {
        dates.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
      }
    }
    // 频次
    const freqData = dates.map(ds => all.filter(c => c.date === ds).length);
    // 体重 / 体能
    const wMap = {}, fMap = {};
    all.forEach(c => {
      if (c.weight && !isNaN(parseFloat(c.weight))) wMap[c.date] = parseFloat(c.weight);
      const num = extractNumber(c.fitness);
      if (num != null) fMap[c.date] = num;
    });
    const wDates = Object.keys(wMap).filter(d => dates.includes(d)).sort();
    const fDates = Object.keys(fMap).filter(d => dates.includes(d)).sort();
    return {
      freq: { labels: dates.map(d => d.slice(5)), data: freqData },
      weight: { labels: wDates.map(d => d.slice(5)), data: wDates.map(d => wMap[d]) },
      fitness: { labels: fDates.map(d => d.slice(5)), data: fDates.map(d => fMap[d]) }
    };
  }

  function extractNumber(str) {
    if (!str) return null;
    const m = str.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  function renderStatChart() {
    const el = document.getElementById('statChartArea');
    if (!el) return;
    const s = buildSeries();
    if (statView === 'weight') {
      if (s.weight.data.length < 2) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚖️</div>体重数据不足，请在打卡时填写体重</div>'; return; }
      App.lineChart(el, { labels: s.weight.labels, series: [{ name: '体重(kg)', color: 'var(--info)', data: s.weight.data }] });
    } else if (statView === 'fitness') {
      if (s.fitness.data.length < 2) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔥</div>体能数据不足，请在打卡时填写可量化的体能（如 5km）</div>'; return; }
      App.lineChart(el, { labels: s.fitness.labels, series: [{ name: '体能(数值)', color: 'var(--warning)', data: s.fitness.data }] });
    } else if (statView === 'freq') {
      App.lineChart(el, { labels: s.freq.labels, series: [{ name: '训练次数', color: 'var(--celadon)', data: s.freq.data }] });
    } else if (statView === 'all') {
      const series = [];
      if (s.weight.data.length >= 2) series.push({ name: '体重(kg)', color: 'var(--info)', data: s.weight.data });
      if (s.fitness.data.length >= 2) series.push({ name: '体能', color: 'var(--warning)', data: s.fitness.data });
      series.push({ name: '训练次数', color: 'var(--celadon)', data: s.freq.data });
      if (series.length === 0) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div>暂无足够数据</div>'; return; }
      App.lineChart(el, { labels: s.freq.labels, series: series });
    }
  }

  // 打卡详情弹窗
  function openCheckinModal(existing) {
    const isEdit = !!existing;
    if (!isEdit) { selectedLabels = []; selectedTimerIds = []; }
    else {
      selectedLabels = [...(existing.labels || [])];
      selectedTimerIds = [...(existing.timerIds || [])];
    }
    const labels = Store.getTrainingLabels();

    App.modal(isEdit ? '编辑训练打卡' : '训练打卡', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">训练标签（可多选）</label>
        <div class="flex-row flex-wrap" id="modalLabels" style="gap:6px;">
          ${labels.map(l => `<span class="tag training-label-tag ${selectedLabels.includes(l) ? 'selected' : ''}" data-label="${App.escapeHtml(l)}">${App.escapeHtml(l)}</span>`).join('')}
        </div>
        <button class="btn btn-sm mt-8" id="addTrainingLabelBtn">+ 自定义标签</button>
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">导入计时记录（可选）</label>
        <div id="checkinTimerRepo" class="timer-repo-container"></div>
        <div id="selectedTimersDisplay" class="mt-8 flex-row flex-wrap" style="gap:6px;"></div>
      </div>
      <div class="grid-2 mb-12">
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">备注</label>
          <textarea class="textarea" id="checkinNotes" rows="2" placeholder="训练感受…">${isEdit ? App.escapeHtml(existing.notes || '') : ''}</textarea>
        </div>
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">总结</label>
          <textarea class="textarea" id="checkinSummary" rows="2" placeholder="完成情况…">${isEdit ? App.escapeHtml(existing.summary || '') : ''}</textarea>
        </div>
      </div>
      <div class="grid-2 mb-12">
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">体重 (kg)</label>
          <input type="number" class="input" id="checkinWeight" step="0.1" placeholder="如 65.5" value="${isEdit ? App.escapeHtml(existing.weight || '') : ''}">
        </div>
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">体能记录</label>
          <input type="text" class="input" id="checkinFitness" placeholder="如 跑步5km/俯卧撑30" value="${isEdit ? App.escapeHtml(existing.fitness || '') : ''}">
        </div>
      </div>
    `, [
      ...(isEdit ? [{ label: '删除', onClick: function () {
          if (confirm('确定删除这条打卡？')) {
            Store.deleteExerciseCheckin(existing.id);
            App.toast('已删除', 'success');
            refreshAfterCheckin();
          }
        } }] : []),
      { label: '取消' },
      {
        label: '保存',
        primary: true,
        onClick: function (body) {
          const data = {
            labels: [...selectedLabels],
            timerIds: [...selectedTimerIds],
            notes: body.querySelector('#checkinNotes').value,
            summary: body.querySelector('#checkinSummary').value,
            weight: body.querySelector('#checkinWeight').value,
            fitness: body.querySelector('#checkinFitness').value
          };
          if (isEdit) {
            Store.updateExerciseCheckin(existing.id, data);
            App.toast('打卡已更新', 'success');
          } else {
            if (data.labels.length === 0 && data.timerIds.length === 0 && !data.notes && !data.summary && !data.weight && !data.fitness) {
              App.toast('请至少填写一项内容', 'warning');
              return false;
            }
            Store.addExerciseCheckin(data);
            App.toast('打卡已保存', 'success');
          }
          refreshAfterCheckin();
        }
      }
    ]);

    // 标签选择
    document.querySelectorAll('#modalLabels .training-label-tag').forEach(tag => {
      tag.addEventListener('click', function () {
        const l = this.dataset.label;
        if (selectedLabels.includes(l)) { selectedLabels = selectedLabels.filter(x => x !== l); this.classList.remove('selected'); }
        else { selectedLabels.push(l); this.classList.add('selected'); }
      });
    });
    const addLblBtn = document.getElementById('addTrainingLabelBtn');
    addLblBtn.addEventListener('click', function () {
      App.modal('添加训练标签', `
        <div class="mb-12"><input type="text" class="input" id="newTrainingLabel" placeholder="如：HIIT训练"></div>
      `, [
        { label: '取消' },
        { label: '添加', primary: true, onClick: function (b) {
            const name = b.querySelector('#newTrainingLabel').value.trim();
            if (!name) { App.toast('请输入名称', 'warning'); return false; }
            Store.addTrainingLabel(name);
            App.toast('已添加', 'success');
            openCheckinModal(isEdit ? existing : null);
          } }
      ]);
    });

    // 计时仓库
    Timer.renderTimerRepo('checkinTimerRepo', function (t) { return t.source === 'exercise' || t.source === 'timer'; }, function (timer) {
      if (!selectedTimerIds.includes(timer.id)) {
        selectedTimerIds.push(timer.id);
        App.toast(`已导入「${timer.name}」`, 'success');
        renderSelectedTimers();
      }
    });
    renderSelectedTimers();
  }

  function renderSelectedTimers() {
    const el = document.getElementById('selectedTimersDisplay');
    if (!el) return;
    if (selectedTimerIds.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = selectedTimerIds.map(id => {
      const t = Store.getTimer(id);
      return t ? `<span class="tag selected" style="cursor:pointer;" data-id="${id}">${App.escapeHtml(t.name)} ✕</span>` : '';
    }).join(' ');
    el.querySelectorAll('.tag').forEach(tag => {
      tag.addEventListener('click', function () {
        selectedTimerIds = selectedTimerIds.filter(x => x !== this.dataset.id);
        renderSelectedTimers();
      });
    });
  }

  // 快捷录入（体重/体能）
  function quickEntry(kind) {
    const date = Store.getCurrentDate();
    const existing = Store.getExerciseCheckins(date)[0];
    if (existing) {
      const val = prompt(kind === 'weight' ? '请输入今日体重(kg)：' : '请输入今日体能记录：');
      if (val == null) return;
      const updates = kind === 'weight' ? { weight: val } : { fitness: val };
      Store.updateExerciseCheckin(existing.id, updates);
      App.toast('已记录', 'success');
      render(document.getElementById('contentArea'));
    } else {
      const val = prompt(kind === 'weight' ? '请输入今日体重(kg)：' : '请输入今日体能记录：');
      if (val == null) return;
      const data = kind === 'weight' ? { weight: val } : { fitness: val };
      Store.addExerciseCheckin(data);
      App.toast('已打卡并记录', 'success');
      render(document.getElementById('contentArea'));
    }
  }

  function refreshAfterCheckin() {
    render(document.getElementById('contentArea'));
  }

  function bindEvents() {
    document.getElementById('openCheckinBtn').addEventListener('click', function () {
      const date = Store.getCurrentDate();
      const checkins = Store.getExerciseCheckins(date);
      openCheckinModal(checkins.length > 0 ? checkins[0] : null);
    });

    document.getElementById('checkinStatusBox').addEventListener('click', function (e) {
      if (e.target.closest('#openCheckinBtn')) return;
      const date = Store.getCurrentDate();
      const checkins = Store.getExerciseCheckins(date);
      openCheckinModal(checkins.length > 0 ? checkins[0] : null);
    });

    document.querySelectorAll('.checkin-mini').forEach(el => {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.delete-checkin-btn')) return;
        const c = Store.getExerciseCheckins(Store.getCurrentDate()).find(x => x.id === this.dataset.id);
        if (c) openCheckinModal(c);
      });
    });

    document.querySelectorAll('.delete-checkin-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('确定删除这条打卡？')) {
          Store.deleteExerciseCheckin(this.dataset.id);
          App.toast('已删除', 'success');
          render(document.getElementById('contentArea'));
        }
      });
    });

    // 历史统计目录
    document.querySelectorAll('[data-stat]').forEach(item => {
      item.addEventListener('click', function () {
        statView = this.dataset.stat;
        const area = document.getElementById('exerciseStatsArea');
        area.innerHTML = renderStatsArea();
        bindStatsArea();
        if (statView !== 'menu') renderStatChart();
      });
    });

    // 数据录入目录
    document.querySelectorAll('.dir-item[data-action]').forEach(item => {
      item.addEventListener('click', function () {
        const action = this.dataset.action;
        if (action === 'new-checkin') {
          const date = Store.getCurrentDate();
          openCheckinModal(Store.getExerciseCheckins(date)[0] || null);
        } else if (action === 'weight-quick') quickEntry('weight');
        else if (action === 'fitness-quick') quickEntry('fitness');
      });
    });
  }

  function bindStatsArea() {
    const back = document.getElementById('statBackBtn');
    if (back) back.addEventListener('click', function () {
      statView = 'menu';
      document.getElementById('exerciseStatsArea').innerHTML = renderStatsArea();
      bindStatsArea();
    });
    document.querySelectorAll('.stat-period-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        statPeriod = this.dataset.period;
        document.querySelectorAll('.stat-period-btn').forEach(b => b.classList.remove('btn-primary'));
        this.classList.add('btn-primary');
        renderStatChart();
      });
    });
  }

  return { render };
})();
