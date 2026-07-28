/* ============================================
 * study.js - 学习计划模块（重构）
 * 紧凑待学列表 · 统计(条形/折线切换) · 笔记竖型目录 · 编辑页
 * ============================================ */

const Study = (function () {

  let currentCategoryId = null;
  let statType = 'bar'; // 'bar' | 'line'
  let statPeriod = 'month'; // 'week' | 'month'

  function render(container) {
    const date = Store.getCurrentDate();
    container.innerHTML = `
      <div class="module-header">
        <h2>📚 学习计划</h2>
        <div class="module-subtitle">任务打卡 · 学习笔记 · 数据统计</div>
      </div>

      <!-- 板块1：待学清单（紧凑） -->
      <div class="section-block collapsible">
        <div class="section-title">
          <span class="section-title-icon">📝</span>
          待学清单（每日打卡）
          <button class="btn btn-sm" id="addStudyTodoBtn" style="margin-left:auto;">+ 新增任务</button>
        </div>
        <div id="studyTodoList"></div>
      </div>

      <!-- 板块2：学习笔记（竖型目录） -->
      <div class="section-block collapsible collapsed">
        <div class="section-title">
          <span class="section-title-icon">📖</span>
          学习笔记
          <div style="margin-left:auto;display:flex;gap:6px;">
            <button class="btn btn-sm" id="addStudyCategoryBtn">+ 目录</button>
            <button class="btn btn-sm btn-primary" id="addStudyNoteBtn">+ 写笔记</button>
          </div>
        </div>
        <div id="studyNotesDir"></div>
      </div>

      <!-- 板块3：学习统计 -->
      <div class="section-block collapsible collapsed">
        <div class="section-title">
          <span class="section-title-icon">📊</span>
          学习统计
          <div style="margin-left:auto;display:flex;gap:6px;">
            <button class="btn btn-sm stat-period-btn ${statPeriod === 'week' ? 'btn-primary' : ''}" data-period="week">本周</button>
            <button class="btn btn-sm stat-period-btn ${statPeriod === 'month' ? 'btn-primary' : ''}" data-period="month">本月</button>
          </div>
        </div>
        <div class="flex-row mb-12" style="gap:6px;justify-content:flex-end;">
          <span class="text-sm text-muted">图表类型：</span>
          <button class="btn btn-sm chart-type-btn ${statType === 'bar' ? 'btn-primary' : ''}" data-type="bar">条形图</button>
          <button class="btn btn-sm chart-type-btn ${statType === 'line' ? 'btn-primary' : ''}" data-type="line">折线图</button>
        </div>
        <div id="studyStatsArea"></div>
      </div>
    `;

    renderTodoList();
    renderNotesDir();
    renderStats();
    bindEvents();
    App.bindCollapsible(container);
  }

  // ============ 待学清单（紧凑） ============
  function renderTodoList() {
    const container = document.getElementById('studyTodoList');
    const date = Store.getCurrentDate();
    const todos = Store.getStudyTodosByDate(date);

    if (todos.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div>暂无待学任务</div>';
      return;
    }

    let html = '';
    todos.forEach(t => {
      const isCheckedToday = (t.checkDates || []).includes(date);
      const linkedTimers = (t.timerIds || []).map(id => {
        const timer = Store.getTimer(id);
        return timer ? `<span class="tag" style="font-size:11px;cursor:pointer;" data-timer-id="${id}">${App.escapeHtml(timer.name)} (${Timer.formatTime(timer.duration)})</span>` : '';
      }).join(' ');
      const priorityColors = { high: 'var(--danger)', normal: 'var(--ink-light)', low: 'var(--ink-faint)' };
      const priorityLabels = { high: '高', normal: '中', low: '低' };
      let deadlineInfo = null;
      if (t.deadline) {
        const dDiff = Math.floor((new Date(t.deadline) - new Date(Store.getCurrentDate())) / 86400000);
        if (dDiff > 0) deadlineInfo = { text: '剩' + dDiff + '天', color: 'var(--celadon)' };
        else if (dDiff < 0) deadlineInfo = { text: '已过' + Math.abs(dDiff) + '天', color: 'var(--danger)' };
        else deadlineInfo = { text: '今天截止', color: '#e8a04e' };
      }

      html += `
        <div class="study-todo-row" data-id="${t.id}">
          <div class="checkbox ${isCheckedToday ? 'checked' : ''}" data-id="${t.id}"></div>
          <div class="flex-1">
            <div class="flex-row" style="gap:6px;">
              <span style="${isCheckedToday ? 'text-decoration:line-through;color:var(--ink-faint);' : ''}">${App.escapeHtml(t.name)}</span>
              <span class="text-xs" style="color:${priorityColors[t.priority]};border:1px solid ${priorityColors[t.priority]};padding:0 5px;border-radius:4px;">${priorityLabels[t.priority]}</span>
            </div>
            ${linkedTimers ? `<div class="mt-8">${linkedTimers}</div>` : ''}
          </div>
          <div class="flex-row">
            ${deadlineInfo ? `<span class="text-sm" style="color:${deadlineInfo.color};margin-right:6px;">${deadlineInfo.text}</span>` : ''}
            <button class="btn-text import-timer-btn" data-id="${t.id}" title="导入计时">⏱</button>
            <button class="btn-text edit-todo-btn" data-id="${t.id}">编辑</button>
            <button class="btn-text danger delete-todo-btn" data-id="${t.id}">✕</button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    container.querySelectorAll('.checkbox').forEach(cb => {
      cb.addEventListener('click', function () {
        const todo = Store.getStudyTodos().find(t => t.id === this.dataset.id);
        if (!todo) return;
        let dates = todo.checkDates || [];
        const today = Store.getCurrentDate();
        if (dates.includes(today)) { dates = dates.filter(d => d !== today); App.toast('已取消今日打卡', 'success'); }
        else { dates = [...dates, today]; App.toast('今日打卡完成！', 'success'); }
        Store.updateStudyTodo(this.dataset.id, { checkDates: dates, completed: dates.includes(today) });
        renderTodoList();
      });
    });
    container.querySelectorAll('.delete-todo-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (confirm('确定删除该任务？')) { Store.deleteStudyTodo(this.dataset.id); renderTodoList(); App.toast('已删除', 'success'); }
      });
    });
    container.querySelectorAll('.edit-todo-btn').forEach(btn => btn.addEventListener('click', function () { showEditTodoModal(this.dataset.id); }));
    container.querySelectorAll('.import-timer-btn').forEach(btn => btn.addEventListener('click', function () { showImportTimerModal(this.dataset.id); }));
  }

  function showEditTodoModal(id) {
    const todo = Store.getStudyTodos().find(t => t.id === id);
    if (!todo) return;
    App.modal('编辑任务', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">任务名称</label>
        <input type="text" class="input" id="editTodoName" value="${App.escapeHtml(todo.name)}">
      </div>
      <div class="grid-2 mb-12">
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">截止日期</label>
          <input type="date" class="input" id="editTodoDeadline" value="${todo.deadline || ''}">
        </div>
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">优先级</label>
          <select class="select" id="editTodoPriority">
            <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>低</option>
            <option value="normal" ${todo.priority === 'normal' ? 'selected' : ''}>中</option>
            <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>高</option>
          </select>
        </div>
      </div>
    `, [
      { label: '取消' },
      { label: '保存', primary: true, onClick: function (body) {
          const name = body.querySelector('#editTodoName').value.trim();
          if (!name) { App.toast('请输入任务名称', 'warning'); return false; }
          Store.updateStudyTodo(id, { name, deadline: body.querySelector('#editTodoDeadline').value, priority: body.querySelector('#editTodoPriority').value });
          renderTodoList(); App.toast('已更新', 'success');
        } }
    ]);
  }

  function showImportTimerModal(todoId) {
    const todo = Store.getStudyTodos().find(t => t.id === todoId);
    if (!todo) return;
    App.modal(`导入计时到「${todo.name}」`, `
      <p class="text-muted mb-12">从全局计时仓库选择一段学习计时关联：</p>
      <div id="importTimerList" style="max-height:300px;overflow-y:auto;"></div>
    `, [{ label: '关闭' }]);
    Timer.renderTimerRepo('importTimerList', function (t) { return t.source === 'study' || t.source === 'timer'; }, function (timer) {
      const cur = todo.timerIds || [];
      if (cur.includes(timer.id)) { App.toast('已关联', 'warning'); return; }
      Store.updateStudyTodo(todoId, { timerIds: [...cur, timer.id] });
      App.toast(`已关联「${timer.name}」`, 'success');
      App.closeModal(); renderTodoList(); renderStats();
    });
  }

  // ============ 学习笔记（竖型目录） ============
  function renderNotesDir() {
    const container = document.getElementById('studyNotesDir');
    const notes = currentCategoryId ? Store.getStudyNotes(currentCategoryId) : Store.getStudyNotes();
    const categories = Store.getStudyCategories();
    const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt);

    let catRow = '<div class="note-cat-row mb-12">';
    catRow += `<span class="note-cat-chip ${currentCategoryId === null ? 'active' : ''}" data-id="">📚 全部 (${Store.getStudyNotes().length})</span>`;
    categories.forEach(c => {
      catRow += `<span class="note-cat-chip ${currentCategoryId === c.id ? 'active' : ''}" data-id="${c.id}">${App.escapeHtml(c.name)} (${Store.getStudyNotes(c.id).length})</span>`;
    });
    catRow += '</div>';

    if (sorted.length === 0) {
      container.innerHTML = catRow + '<div class="empty-state"><div class="empty-state-icon">📖</div>暂无笔记，点击右上角开始写笔记</div>';
    } else {
      container.innerHTML = catRow + '<div class="dir-list">' + sorted.map(n => {
        const cat = Store.getStudyCategories().find(c => c.id === n.categoryId);
        return `
          <div class="dir-item note-dir-item" data-id="${n.id}">
            <span class="dir-item-icon">📄</span>
            <span class="dir-item-main">
              <span class="dir-item-title">${App.escapeHtml(n.title)}</span>
              <span class="dir-item-sub">${cat ? App.escapeHtml(cat.name) : '未分类'} · ${n.date}</span>
            </span>
            <span class="dir-item-arrow">›</span>
          </div>`;
      }).join('') + '</div>';
    }

    container.querySelectorAll('.note-cat-chip').forEach(chip => {
      chip.addEventListener('click', function () {
        currentCategoryId = this.dataset.id || null;
        renderNotesDir();
      });
    });
    container.querySelectorAll('.note-dir-item').forEach(item => {
      item.addEventListener('click', function () { renderNoteEditor(this.dataset.id); });
    });
  }

  // 笔记编辑页（独立页面）
  function renderNoteEditor(id) {
    const note = id ? Store.getStudyNotes().find(n => n.id === id) : null;
    const categories = Store.getStudyCategories();
    const todos = Store.getStudyTodos();
    const container = document.getElementById('contentArea');
    container.innerHTML = `
      <div class="module-header">
        <button class="btn-text" id="noteBackBtn">← 返回</button>
      </div>
      <div class="section-block">
        <div class="mb-12">
          <label class="text-sm text-muted mb-8" style="display:block;">标题</label>
          <input type="text" class="input" id="noteTitle" value="${note ? App.escapeHtml(note.title) : ''}" placeholder="输入笔记标题">
        </div>
        <div class="grid-2 mb-12">
          <div>
            <label class="text-sm text-muted mb-8" style="display:block;">所属目录</label>
            <select class="select" id="noteCategory">
              ${categories.length === 0 ? '<option value="">无目录</option>' : categories.map(c => `<option value="${c.id}" ${note && note.categoryId === c.id ? 'selected' : ''}>${App.escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-sm text-muted mb-8" style="display:block;">关联任务（可选）</label>
            <select class="select" id="noteLinkedTodo">
              <option value="">不关联</option>
              ${todos.map(t => `<option value="${t.id}" ${note && note.linkedTodoId === t.id ? 'selected' : ''}>${App.escapeHtml(t.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="mb-12">
          <label class="text-sm text-muted mb-8" style="display:block;">内容</label>
          <textarea class="textarea" id="noteContent" rows="12" placeholder="开始记录...">${note ? App.escapeHtml(note.content) : ''}</textarea>
        </div>
        <div class="flex-row" style="gap:8px;justify-content:flex-end;">
          ${note ? '<button class="btn btn-danger" id="noteDelBtn">删除</button>' : ''}
          <button class="btn" id="noteCancelBtn">取消</button>
          <button class="btn btn-primary" id="noteSaveBtn">保存</button>
        </div>
      </div>
    `;
    container.querySelector('#noteBackBtn').addEventListener('click', function () { render(container); });
    container.querySelector('#noteCancelBtn').addEventListener('click', function () { render(container); });
    if (note) {
      container.querySelector('#noteDelBtn').addEventListener('click', function () {
        if (confirm('确定删除这篇笔记？')) { Store.deleteStudyNote(note.id); App.toast('已删除', 'success'); render(container); }
      });
    }
    container.querySelector('#noteSaveBtn').addEventListener('click', function () {
      const title = container.querySelector('#noteTitle').value.trim();
      if (!title) { App.toast('请输入标题', 'warning'); return; }
      const data = {
        title,
        categoryId: container.querySelector('#noteCategory').value || null,
        linkedTodoId: container.querySelector('#noteLinkedTodo').value || null,
        content: container.querySelector('#noteContent').value
      };
      if (note) Store.updateStudyNote(note.id, data);
      else Store.addStudyNote(data);
      App.toast('已保存', 'success');
      render(container);
    });
  }

  // ============ 学习统计 ============
  function buildStatSeries() {
    const today = new Date(Store.getCurrentDate());
    let dates = [];
    if (statPeriod === 'week') {
      for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); dates.push(d.toISOString().slice(0, 10)); }
    } else {
      const y = today.getFullYear(), m = today.getMonth();
      const days = new Date(y, m + 1, 0).getDate();
      for (let i = 1; i <= days; i++) dates.push(`${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`);
    }
    const todos = Store.getStudyTodos();
    const dailyCompleted = dates.map(ds => todos.filter(t => (t.checkDates || []).includes(ds)).length);
    let cum = 0;
    const cumulative = dailyCompleted.map(v => (cum += v));
    const duration = dates.map(ds => {
      let sum = 0;
      todos.forEach(t => (t.timerIds || []).forEach(tid => {
        const tm = Store.getTimer(tid);
        if (tm && tm.date === ds) sum += tm.duration;
      }));
      return sum;
    });
    return { labels: dates.map(d => d.slice(5)), dailyCompleted, cumulative, duration };
  }

  function renderStats() {
    const el = document.getElementById('studyStatsArea');
    if (!el) return;
    const s = buildStatSeries();
    const color1 = 'var(--celadon)', color2 = 'var(--info)', color3 = 'var(--warning)';
    let html = '';
    const blocks = [
      { title: '每日完成待办数', labels: s.labels, data: s.dailyCompleted, color: color1 },
      { title: '累计完成数', labels: s.labels, data: s.cumulative, color: color2 },
      { title: '学习时长(秒)', labels: s.labels, data: s.duration, color: color3 }
    ];
    blocks.forEach(b => {
      html += `<div class="mb-16">
        <div class="text-sm text-muted mb-8">${b.title}</div>
        <div class="stat-chart-block" data-title="${b.title}"></div>
      </div>`;
    });
    el.innerHTML = html;
    blocks.forEach(b => {
      const blockEl = el.querySelector(`.stat-chart-block[data-title="${b.title}"]`);
      if (statType === 'bar') App.barChart(blockEl, { labels: b.labels, data: b.data, color: b.color });
      else App.lineChart(blockEl, { labels: b.labels, series: [{ name: b.title, color: b.color, data: b.data }] });
    });
  }

  // ============ 事件 ============
  function bindEvents() {
    document.getElementById('addStudyTodoBtn').addEventListener('click', function () {
      App.modal('新增待学任务', `
        <div class="mb-12">
          <label class="text-sm text-muted mb-8" style="display:block;">任务名称</label>
          <input type="text" class="input" id="newTodoName" placeholder="如：学习React Hooks">
        </div>
        <div class="grid-2 mb-12">
          <div>
            <label class="text-sm text-muted mb-8" style="display:block;">截止日期（可选）</label>
            <input type="date" class="input" id="newTodoDeadline">
          </div>
          <div>
            <label class="text-sm text-muted mb-8" style="display:block;">优先级</label>
            <select class="select" id="newTodoPriority">
              <option value="low">低</option>
              <option value="normal" selected>中</option>
              <option value="high">高</option>
            </select>
          </div>
        </div>
      `, [
        { label: '取消' },
        { label: '添加', primary: true, onClick: function (body) {
            const name = body.querySelector('#newTodoName').value.trim();
            if (!name) { App.toast('请输入任务名称', 'warning'); return false; }
            Store.addStudyTodo({ name, deadline: body.querySelector('#newTodoDeadline').value, priority: body.querySelector('#newTodoPriority').value });
            renderTodoList(); App.toast('任务已添加', 'success');
          } }
      ]);
    });

    document.getElementById('addStudyCategoryBtn').addEventListener('click', function () {
      App.modal('新增笔记目录', `
        <div class="mb-12"><input type="text" class="input" id="newCatName" placeholder="如：前端开发"></div>
      `, [
        { label: '取消' },
        { label: '添加', primary: true, onClick: function (body) {
            const name = body.querySelector('#newCatName').value.trim();
            if (!name) { App.toast('请输入目录名称', 'warning'); return false; }
            Store.addStudyCategory(name); renderNotesDir(); App.toast('目录已添加', 'success');
          } }
      ]);
    });

    document.getElementById('addStudyNoteBtn').addEventListener('click', function () {
      if (Store.getStudyCategories().length === 0) { App.toast('请先创建笔记目录', 'warning'); return; }
      renderNoteEditor(null);
    });

    document.querySelectorAll('.chart-type-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        statType = this.dataset.type;
        document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('btn-primary'));
        this.classList.add('btn-primary');
        renderStats();
      });
    });
    document.querySelectorAll('.stat-period-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        statPeriod = this.dataset.period;
        document.querySelectorAll('.stat-period-btn').forEach(b => b.classList.remove('btn-primary'));
        this.classList.add('btn-primary');
        renderStats();
      });
    });
  }

  return { render };
})();
