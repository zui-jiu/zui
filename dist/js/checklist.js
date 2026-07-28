/* ============================================
 * checklist.js - 每日清单模块（重构）
 * 直接展示四象限 · 象限内联添加任务 · 完成/编辑/删除
 * ============================================ */

const Checklist = (function () {

  const QUADRANTS = [
    { id: 0, name: '重要且紧急', icon: '🔴', color: 'var(--danger)', desc: '立即处理' },
    { id: 1, name: '重要不紧急', icon: '🟡', color: 'var(--warning)', desc: '计划安排' },
    { id: 2, name: '不重要但紧急', icon: '🟠', color: '#D4855E', desc: '委托或快速完成' },
    { id: 3, name: '不重要不紧急', icon: '🟢', color: 'var(--bean-green)', desc: '闲暇时做' }
  ];

  let draggedTaskId = null;
  let addingQuadrant = null; // 当前正在内联添加的象限

  function render(container) {
    const date = Store.getCurrentDate();
    container.innerHTML = `
      <div class="module-header">
        <h2>📋 每日清单</h2>
        <div class="module-subtitle">四象限看板 · 象限内直接添加 · ${App.formatDate(date)}</div>
      </div>

      <div class="flex-between mb-16">
        <div class="text-sm text-muted" id="checklistSummary"></div>
        <button class="btn" id="showArchivedBtn">查看已完成</button>
      </div>

      <div class="quadrant-board" id="quadrantBoard">
        ${QUADRANTS.map(q => `
          <div class="quadrant" data-quadrant="${q.id}">
            <div class="quadrant-header" style="border-top:3px solid ${q.color};">
              <span class="quadrant-icon">${q.icon}</span>
              <span class="quadrant-name">${q.name}</span>
              <span class="quadrant-count" id="qCount_${q.id}">0</span>
            </div>
            <div class="quadrant-desc text-xs text-muted">${q.desc}</div>
            <div class="quadrant-drop-zone" data-quadrant="${q.id}" id="qZone_${q.id}"></div>
            <button class="quadrant-add-btn" data-quadrant="${q.id}">＋ 添加任务</button>
          </div>
        `).join('')}
      </div>
    `;

    renderTasks();
    bindEvents();
  }

  function renderTasks() {
    const date = Store.getCurrentDate();
    const tasks = Store.getChecklistTasks(date);
    const completed = Store.getArchivedTasks(date).length;
    document.getElementById('checklistSummary').textContent = `今日 ${tasks.length} 项待办，已完成 ${completed} 项`;

    QUADRANTS.forEach(q => {
      const zone = document.getElementById('qZone_' + q.id);
      const qTasks = tasks.filter(t => t.quadrant === q.id);
      document.getElementById('qCount_' + q.id).textContent = qTasks.length;

      let html = '';
      if (qTasks.length === 0 && addingQuadrant !== q.id) {
        html = '<div class="quadrant-empty text-xs text-muted">点击下方「＋ 添加任务」</div>';
      } else {
        html = qTasks.map(t => {
          const recurringLabel = t.recurring === 'daily' ? '每日' : (t.recurring === 'weekly' ? '每周' : '');
          return `
            <div class="task-card" draggable="true" data-id="${t.id}" data-quadrant="${t.quadrant}">
              <div class="flex-row">
                <div class="checkbox task-complete-btn" data-id="${t.id}"></div>
                <span class="task-text">${App.escapeHtml(t.text)}</span>
              </div>
              <div class="flex-between mt-8">
                <div>${recurringLabel ? `<span class="tag" style="font-size:10px;cursor:default;">🔁 ${recurringLabel}</span>` : ''}</div>
                <div class="flex-row">
                  <button class="btn-text edit-task-btn" data-id="${t.id}" style="font-size:12px;">编辑</button>
                  <button class="btn-text danger delete-task-btn" data-id="${t.id}" style="font-size:12px;">删除</button>
                </div>
              </div>
            </div>`;
        }).join('');
      }

      // 内联添加表单
      if (addingQuadrant === q.id) {
        html += `
          <div class="inline-add">
            <input type="text" class="input inline-add-input" placeholder="输入任务内容，回车保存" data-quadrant="${q.id}">
            <div class="flex-row mt-8" style="gap:6px;">
              <select class="select inline-add-recurring" style="flex:1;">
                <option value="none">不循环</option>
                <option value="daily">每日重复</option>
                <option value="weekly">每周重复</option>
              </select>
              <button class="btn btn-sm btn-primary inline-add-save" data-quadrant="${q.id}">保存</button>
              <button class="btn btn-sm inline-add-cancel">取消</button>
            </div>
          </div>`;
      }

      zone.innerHTML = html;

      // 拖放
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', function () { zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (draggedTaskId) {
          Store.updateChecklistTask(draggedTaskId, { quadrant: parseInt(this.dataset.quadrant) });
          App.toast('已移动到「' + QUADRANTS[parseInt(this.dataset.quadrant)].name + '」', 'success');
          draggedTaskId = null;
          renderTasks();
        }
      });
    });

    // 拖拽
    document.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', function (e) {
        draggedTaskId = this.dataset.id; this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function () { this.classList.remove('dragging'); });
    });

    // 完成
    document.querySelectorAll('.task-complete-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        Store.updateChecklistTask(this.dataset.id, { completed: true });
        App.toast('任务已完成，已归档', 'success');
        renderTasks();
      });
    });
    // 编辑
    document.querySelectorAll('.edit-task-btn').forEach(btn => btn.addEventListener('click', function () { showEditTaskModal(this.dataset.id); }));
    // 删除
    document.querySelectorAll('.delete-task-btn').forEach(btn => btn.addEventListener('click', function () {
      if (confirm('确定删除该任务？')) { Store.deleteChecklistTask(this.dataset.id); App.toast('已删除', 'success'); renderTasks(); }
    }));
    // 内联添加交互
    bindInlineAdd();
  }

  function bindInlineAdd() {
    document.querySelectorAll('.quadrant-add-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        addingQuadrant = parseInt(this.dataset.quadrant);
        renderTasks();
        const input = document.querySelector('.inline-add-input[data-quadrant="' + this.dataset.quadrant + '"]');
        if (input) input.focus();
      });
    });
    document.querySelectorAll('.inline-add-cancel').forEach(btn => {
      btn.addEventListener('click', function () { addingQuadrant = null; renderTasks(); });
    });
    document.querySelectorAll('.inline-add-save').forEach(btn => {
      btn.addEventListener('click', function () { commitInlineAdd(parseInt(this.dataset.quadrant)); });
    });
    document.querySelectorAll('.inline-add-input').forEach(input => {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { commitInlineAdd(parseInt(this.dataset.quadrant)); }
        else if (e.key === 'Escape') { addingQuadrant = null; renderTasks(); }
      });
    });
  }

  function commitInlineAdd(quadrant) {
    const input = document.querySelector('.inline-add-input[data-quadrant="' + quadrant + '"]');
    const recurringSel = document.querySelector('.inline-add-recurring');
    const text = input ? input.value.trim() : '';
    if (!text) { App.toast('请输入任务内容', 'warning'); return; }
    Store.addChecklistTask({ text, quadrant, recurring: recurringSel ? recurringSel.value : 'none' });
    addingQuadrant = null;
    App.toast('已添加', 'success');
    renderTasks();
  }

  function showEditTaskModal(id) {
    const tasks = Store.getChecklistTasks(Store.getCurrentDate());
    const task = id ? tasks.find(t => t.id === id) : null;
    App.modal('编辑任务', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">任务内容</label>
        <input type="text" class="input" id="taskText" value="${task ? App.escapeHtml(task.text) : ''}" placeholder="输入任务内容">
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">所属象限</label>
        <select class="select" id="taskQuadrant">
          ${QUADRANTS.map(q => `<option value="${q.id}" ${task && task.quadrant === q.id ? 'selected' : ''}>${q.icon} ${q.name}</option>`).join('')}
        </select>
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">循环设置</label>
        <select class="select" id="taskRecurring">
          <option value="none" ${task && task.recurring === 'none' ? 'selected' : ''}>不循环</option>
          <option value="daily" ${task && task.recurring === 'daily' ? 'selected' : ''}>每日重复</option>
          <option value="weekly" ${task && task.recurring === 'weekly' ? 'selected' : ''}>每周重复</option>
        </select>
      </div>
    `, [
      { label: '取消' },
      { label: '保存', primary: true, onClick: function (body) {
          const text = body.querySelector('#taskText').value.trim();
          if (!text) { App.toast('请输入任务内容', 'warning'); return false; }
          Store.updateChecklistTask(id, {
            text,
            quadrant: parseInt(body.querySelector('#taskQuadrant').value),
            recurring: body.querySelector('#taskRecurring').value
          });
          App.toast('已保存', 'success');
          renderTasks();
        } }
    ]);
  }

  function showArchivedModal() {
    const date = Store.getCurrentDate();
    const archived = Store.getArchivedTasks(date);
    App.modal(`已完成任务 · ${App.formatDate(date)}`, `
      ${archived.length === 0
        ? '<div class="empty-state"><div class="empty-state-icon">✓</div>今日暂无已完成任务</div>'
        : archived.map(t => `
            <div class="list-item">
              <div class="checkbox checked" style="cursor:default;"></div>
              <span style="flex:1;text-decoration:line-through;color:var(--ink-light);">${App.escapeHtml(t.text)}</span>
              <span class="text-xs text-muted">${QUADRANTS[t.quadrant].name}</span>
            </div>`).join('')
      }
    `, [{ label: '关闭' }]);
  }

  function bindEvents() {
    document.getElementById('showArchivedBtn').addEventListener('click', showArchivedModal);
  }

  return { render };
})();
