/* ============================================
 * study.js - 学习计划模块
 * 学习计时器 + 待学清单 + 学习笔记
 * ============================================ */

const Study = (function () {

  let currentCategoryId = null;

  function render(container) {
    const date = Store.getCurrentDate();
    container.innerHTML = `
      <div class="module-header">
        <h2>📚 学习计划</h2>
        <div class="module-subtitle">学习计时 · 任务管理 · 笔记积累</div>
      </div>

      <!-- 板块1：学习计时器 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">⏱</span>
          学习计时器
        </div>
        <div id="studyTimerWidget"></div>
      </div>

      <!-- 板块2：待学清单 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">📝</span>
          待学清单
          <button class="btn btn-sm" id="addStudyTodoBtn" style="margin-left:auto;">+ 新增任务</button>
        </div>
        <div id="studyTodoList"></div>
      </div>

      <!-- 板块3：学习笔记 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">📖</span>
          学习笔记
          <div style="margin-left:auto;display:flex;gap:6px;">
            <button class="btn btn-sm" id="addStudyCategoryBtn">+ 新增目录</button>
            <button class="btn btn-sm btn-primary" id="addStudyNoteBtn">+ 写笔记</button>
          </div>
        </div>
        <div class="study-notes-layout">
          <div class="study-notes-sidebar" id="studyCategoriesList"></div>
          <div class="study-notes-content" id="studyNotesList"></div>
        </div>
      </div>

      <!-- 板块4：分类时长统计 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">📊</span>
          学习时长统计
        </div>
        <div id="studyTimeStats"></div>
      </div>
    `;

    // 初始化计时器
    Timer.createTimerWidget('studyTimerWidget', 'study', function () {
      renderTodoList();
      renderTimeStats();
    });

    renderTodoList();
    renderCategories();
    renderTimeStats();
    bindEvents();
  }

  // ============ 待学清单 ============
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
      const linkedTimers = (t.timerIds || []).map(id => {
        const timer = Store.getTimer(id);
        return timer ? `<span class="tag" style="font-size:11px;cursor:pointer;" data-timer-id="${id}">${App.escapeHtml(timer.name)} (${Timer.formatTime(timer.duration)})</span>` : '';
      }).join(' ');

      const priorityColors = {
        high: 'var(--danger)',
        normal: 'var(--ink-light)',
        low: 'var(--ink-faint)'
      };
      const priorityLabels = { high: '高', normal: '中', low: '低' };

      html += `
        <div class="list-item study-todo-item" data-id="${t.id}" style="align-items:flex-start;flex-direction:column;">
          <div class="flex-between w-full">
            <div class="flex-row">
              <div class="checkbox ${t.completed ? 'checked' : ''}" data-id="${t.id}"></div>
              <span style="${t.completed ? 'text-decoration:line-through;color:var(--ink-faint);' : ''}">${App.escapeHtml(t.name)}</span>
              ${t.preset ? '<span class="tag" style="font-size:10px;cursor:default;">预置</span>' : ''}
              <span class="text-xs" style="color:${priorityColors[t.priority]};border:1px solid ${priorityColors[t.priority]};padding:1px 6px;border-radius:4px;">${priorityLabels[t.priority]}</span>
            </div>
            <div class="flex-row">
              ${t.deadline ? `<span class="text-sm text-muted">截止: ${t.deadline}</span>` : ''}
              <button class="btn-text import-timer-btn" data-id="${t.id}" title="导入计时">⏱ 导入</button>
              <button class="btn-text edit-todo-btn" data-id="${t.id}">编辑</button>
              ${!t.preset ? `<button class="btn-text danger delete-todo-btn" data-id="${t.id}">删除</button>` : ''}
            </div>
          </div>
          ${linkedTimers ? `<div class="mt-8">${linkedTimers}</div>` : ''}
        </div>
      `;
    });
    container.innerHTML = html;

    // 绑定事件
    container.querySelectorAll('.checkbox').forEach(cb => {
      cb.addEventListener('click', function () {
        const todo = Store.getStudyTodos().find(t => t.id === this.dataset.id);
        if (todo) {
          Store.updateStudyTodo(this.dataset.id, { completed: !todo.completed });
          renderTodoList();
          App.toast(todo.completed ? '已取消完成' : '打卡完成！', 'success');
        }
      });
    });

    container.querySelectorAll('.delete-todo-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (confirm('确定删除该任务？')) {
          Store.deleteStudyTodo(this.dataset.id);
          renderTodoList();
          App.toast('已删除', 'success');
        }
      });
    });

    container.querySelectorAll('.edit-todo-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        showEditTodoModal(this.dataset.id);
      });
    });

    container.querySelectorAll('.import-timer-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        showImportTimerModal(this.dataset.id);
      });
    });
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
      {
        label: '取消',
        onClick: function () {}
      },
      {
        label: '保存',
        primary: true,
        onClick: function (body) {
          const name = body.querySelector('#editTodoName').value.trim();
          if (!name) {
            App.toast('请输入任务名称', 'warning');
            return false;
          }
          Store.updateStudyTodo(id, {
            name: name,
            deadline: body.querySelector('#editTodoDeadline').value,
            priority: body.querySelector('#editTodoPriority').value
          });
          renderTodoList();
          App.toast('已更新', 'success');
        }
      }
    ]);
  }

  function showImportTimerModal(todoId) {
    const todo = Store.getStudyTodos().find(t => t.id === todoId);
    if (!todo) return;

    App.modal(`导入计时到「${todo.name}」`, `
      <p class="text-muted mb-12">从全局计时仓库中选择一段学习计时数据关联到该任务：</p>
      <div id="importTimerList" style="max-height:300px;overflow-y:auto;"></div>
    `, [
      { label: '关闭' }
    ]);

    Timer.renderTimerRepo('importTimerList', function (t) { return t.source === 'study'; }, function (timer) {
      const currentTimerIds = todo.timerIds || [];
      if (currentTimerIds.includes(timer.id)) {
        App.toast('该计时已关联', 'warning');
        return;
      }
      Store.updateStudyTodo(todoId, { timerIds: [...currentTimerIds, timer.id] });
      App.toast(`已关联"${timer.name}"`, 'success');
      App.closeModal();
      renderTodoList();
      renderTimeStats();
    });
  }

  // ============ 学习笔记 ============
  function renderCategories() {
    const container = document.getElementById('studyCategoriesList');
    const categories = Store.getStudyCategories();

    let html = `<div class="note-cat-item ${currentCategoryId === null ? 'active' : ''}" data-id="">
      <span>📚 全部</span>
      <span class="text-xs text-muted">${Store.getStudyNotes().length}</span>
    </div>`;

    categories.forEach(c => {
      const count = Store.getStudyNotes(c.id).length;
      html += `
        <div class="note-cat-item ${currentCategoryId === c.id ? 'active' : ''}" data-id="${c.id}">
          <span>${App.escapeHtml(c.name)}</span>
          <div class="flex-row">
            <span class="text-xs text-muted">${count}</span>
            <button class="btn-text danger delete-cat-btn" data-id="${c.id}" style="padding:0 4px;font-size:12px;">✕</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.note-cat-item').forEach(el => {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.delete-cat-btn')) return;
        currentCategoryId = this.dataset.id || null;
        renderCategories();
        renderNotes();
      });
    });

    container.querySelectorAll('.delete-cat-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('删除目录将同时删除该目录下所有笔记，确定？')) {
          Store.deleteStudyCategory(this.dataset.id);
          if (currentCategoryId === this.dataset.id) currentCategoryId = null;
          renderCategories();
          renderNotes();
          App.toast('已删除目录', 'success');
        }
      });
    });
  }

  function renderNotes() {
    const container = document.getElementById('studyNotesList');
    const notes = currentCategoryId ? Store.getStudyNotes(currentCategoryId) : Store.getStudyNotes();

    if (notes.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📖</div>暂无笔记，点击右上角开始写笔记</div>';
      return;
    }

    const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt);
    let html = '';
    sorted.forEach(n => {
      const cat = Store.getStudyCategories().find(c => c.id === n.categoryId);
      const linkedTodo = n.linkedTodoId ? Store.getStudyTodos().find(t => t.id === n.linkedTodoId) : null;

      html += `
        <div class="note-card" data-id="${n.id}">
          <div class="flex-between">
            <div class="fw-600 note-title">${App.escapeHtml(n.title)}</div>
            <div class="flex-row">
              <button class="btn-text edit-note-btn" data-id="${n.id}">编辑</button>
              <button class="btn-text danger delete-note-btn" data-id="${n.id}">删除</button>
            </div>
          </div>
          <div class="text-sm text-muted mt-8 note-date">
            ${cat ? App.escapeHtml(cat.name) : '未分类'} · ${n.date}
            ${linkedTodo ? ` · 关联任务: <span class="note-linked-task" data-todo-id="${linkedTodo.id}">${App.escapeHtml(linkedTodo.name)}</span>` : ''}
          </div>
          <div class="note-content mt-8">${App.escapeHtml(n.content).replace(/\n/g, '<br>')}</div>
        </div>
      `;
    });
    container.innerHTML = html;

    container.querySelectorAll('.edit-note-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        showEditNoteModal(this.dataset.id);
      });
    });

    container.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (confirm('确定删除这篇笔记？')) {
          Store.deleteStudyNote(this.dataset.id);
          renderNotes();
          renderCategories();
          App.toast('已删除', 'success');
        }
      });
    });

    container.querySelectorAll('.note-linked-task').forEach(el => {
      el.addEventListener('click', function () {
        // 滚动到对应任务
        document.querySelectorAll('.study-todo-item').forEach(item => {
          if (item.dataset.id === this.dataset.todoId) {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            item.style.transition = 'background 0.3s';
            item.style.background = 'var(--celadon-tint)';
            setTimeout(() => item.style.background = '', 1500);
          }
        });
      });
    });
  }

  function showEditNoteModal(id) {
    const note = id ? Store.getStudyNotes().find(n => n.id === id) : null;
    const categories = Store.getStudyCategories();
    const todos = Store.getStudyTodos();

    App.modal(note ? '编辑笔记' : '写笔记', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">标题</label>
        <input type="text" class="input" id="noteTitle" value="${note ? App.escapeHtml(note.title) : ''}" placeholder="输入笔记标题">
      </div>
      <div class="grid-2 mb-12">
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">所属目录</label>
          <select class="select" id="noteCategory">
            ${categories.map(c => `<option value="${c.id}" ${note && note.categoryId === c.id ? 'selected' : ''}>${App.escapeHtml(c.name)}</option>`).join('')}
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
        <textarea class="textarea" id="noteContent" rows="8" placeholder="开始记录...">${note ? App.escapeHtml(note.content) : ''}</textarea>
      </div>
    `, [
      { label: '取消' },
      {
        label: '保存',
        primary: true,
        onClick: function (body) {
          const title = body.querySelector('#noteTitle').value.trim();
          if (!title) {
            App.toast('请输入标题', 'warning');
            return false;
          }
          const data = {
            title: title,
            categoryId: body.querySelector('#noteCategory').value,
            linkedTodoId: body.querySelector('#noteLinkedTodo').value || null,
            content: body.querySelector('#noteContent').value
          };
          if (note) {
            Store.updateStudyNote(note.id, data);
          } else {
            Store.addStudyNote(data);
          }
          renderNotes();
          renderCategories();
          App.toast('已保存', 'success');
        }
      }
    ]);
  }

  // ============ 学习时长统计 ============
  function renderTimeStats() {
    const container = document.getElementById('studyTimeStats');
    const categories = Store.getStudyCategories();
    const todos = Store.getStudyTodos();

    // 按目录统计累计时长
    const stats = {};
    categories.forEach(c => { stats[c.id] = { name: c.name, duration: 0, count: 0 }; });

    todos.forEach(t => {
      (t.timerIds || []).forEach(id => {
        const timer = Store.getTimer(id);
        if (timer) {
          // 通过笔记的关联任务反查目录
          const notes = Store.getStudyNotes().filter(n => n.linkedTodoId === t.id);
          if (notes.length > 0) {
            notes.forEach(n => {
              if (stats[n.categoryId]) {
                stats[n.categoryId].duration += timer.duration;
                stats[n.categoryId].count++;
              }
            });
          } else {
            // 没有关联笔记的任务，归到"未分类"
            if (!stats['uncategorized']) {
              stats['uncategorized'] = { name: '未分类', duration: 0, count: 0 };
            }
            stats['uncategorized'].duration += timer.duration;
            stats['uncategorized'].count++;
          }
        }
      });
    });

    const entries = Object.entries(stats).filter(([k, v]) => v.duration > 0);

    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div>暂无学习时长数据，开始计时学习吧！</div>';
      return;
    }

    const totalDuration = entries.reduce((sum, [, v]) => sum + v.duration, 0);
    const maxDuration = Math.max(...entries.map(([, v]) => v.duration));

    let html = `
      <div class="stat-card mb-16" style="text-align:left;">
        <div class="flex-between">
          <div>
            <div class="stat-card-value">${Timer.formatTime(totalDuration)}</div>
            <div class="stat-card-label">累计学习总时长</div>
          </div>
          <div style="font-size:36px;opacity:0.3;">📚</div>
        </div>
      </div>
      <div class="text-sm text-muted mb-8">各学习类目累计时长</div>
      <div class="freq-chart">
    `;

    entries.sort((a, b) => b[1].duration - a[1].duration);
    entries.forEach(([, v]) => {
      const width = (v.duration / maxDuration * 100).toFixed(0);
      html += `
        <div class="freq-bar-row">
          <span class="freq-bar-label">${App.escapeHtml(v.name)}</span>
          <div class="freq-bar-track">
            <div class="freq-bar-fill" style="width:${width}%;"></div>
          </div>
          <span class="freq-bar-count">${Timer.formatTime(v.duration)}</span>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  // ============ 事件绑定 ============
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
        {
          label: '添加',
          primary: true,
          onClick: function (body) {
            const name = body.querySelector('#newTodoName').value.trim();
            if (!name) {
              App.toast('请输入任务名称', 'warning');
              return false;
            }
            Store.addStudyTodo({
              name: name,
              deadline: body.querySelector('#newTodoDeadline').value,
              priority: body.querySelector('#newTodoPriority').value
            });
            renderTodoList();
            App.toast('任务已添加', 'success');
          }
        }
      ]);
    });

    document.getElementById('addStudyCategoryBtn').addEventListener('click', function () {
      App.modal('新增笔记目录', `
        <div class="mb-12">
          <label class="text-sm text-muted mb-8" style="display:block;">目录名称</label>
          <input type="text" class="input" id="newCatName" placeholder="如：前端开发">
        </div>
      `, [
        { label: '取消' },
        {
          label: '添加',
          primary: true,
          onClick: function (body) {
            const name = body.querySelector('#newCatName').value.trim();
            if (!name) {
              App.toast('请输入目录名称', 'warning');
              return false;
            }
            Store.addStudyCategory(name);
            renderCategories();
            App.toast('目录已添加', 'success');
          }
        }
      ]);
    });

    document.getElementById('addStudyNoteBtn').addEventListener('click', function () {
      const categories = Store.getStudyCategories();
      if (categories.length === 0) {
        App.toast('请先创建一个笔记目录', 'warning');
        return;
      }
      showEditNoteModal(null);
    });
  }

  return { render };
})();
