/* ============================================
 * checklist.js - 每日清单模块
 * 四象限看板 · 跨象限拖拽 · 循环任务 · 归档
 * ============================================ */

const Checklist = (function () {

  const QUADRANTS = [
    { id: 0, name: '重要且紧急', icon: '🔴', color: 'var(--danger)', desc: '立即处理' },
    { id: 1, name: '重要不紧急', icon: '🟡', color: 'var(--warning)', desc: '计划安排' },
    { id: 2, name: '不重要但紧急', icon: '🟠', color: '#D4855E', desc: '委托或快速完成' },
    { id: 3, name: '不重要不紧急', icon: '🟢', color: 'var(--bean-green)', desc: '闲暇时做' }
  ];

  let draggedTaskId = null;

  function render(container) {
    const date = Store.getCurrentDate();
    container.innerHTML = `
      <div class="module-header">
        <h2>📋 每日清单</h2>
        <div class="module-subtitle">四象限看板 · 拖拽排序 · 循环任务 · ${App.formatDate(date)}</div>
      </div>

      <div class="flex-between mb-16">
        <div class="flex-row">
          <button class="btn btn-primary" id="addChecklistTaskBtn">+ 新增任务</button>
          <button class="btn" id="showArchivedBtn">查看已完成</button>
        </div>
        <div class="text-sm text-muted" id="checklistSummary"></div>
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
            <div class="quadrant-drop-zone" data-quadrant="${q.id}" id="qZone_${q.id}">
            </div>
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

    let total = tasks.length;
    let completed = Store.getArchivedTasks(date).length;

    document.getElementById('checklistSummary').textContent = `今日 ${total} 项待办，已完成 ${completed} 项`;

    QUADRANTS.forEach(q => {
      const zone = document.getElementById('qZone_' + q.id);
      const qTasks = tasks.filter(t => t.quadrant === q.id);

      document.getElementById('qCount_' + q.id).textContent = qTasks.length;

      if (qTasks.length === 0) {
        zone.innerHTML = '<div class="quadrant-empty text-xs text-muted">拖拽任务到此象限</div>';
      } else {
        zone.innerHTML = qTasks.map(t => {
          const recurringLabel = t.recurring === 'daily' ? '每日' : (t.recurring === 'weekly' ? '每周' : '');
          return `
            <div class="task-card" draggable="true" data-id="${t.id}" data-quadrant="${t.quadrant}">
              <div class="flex-row">
                <div class="checkbox task-complete-btn" data-id="${t.id}"></div>
                <span class="task-text">${App.escapeHtml(t.text)}</span>
              </div>
              <div class="flex-between mt-8">
                <div>
                  ${recurringLabel ? `<span class="tag" style="font-size:10px;cursor:default;">🔁 ${recurringLabel}</span>` : ''}
                </div>
                <div class="flex-row">
                  <button class="btn-text edit-task-btn" data-id="${t.id}" style="font-size:12px;">编辑</button>
                  <button class="btn-text danger delete-task-btn" data-id="${t.id}" style="font-size:12px;">删除</button>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }

      // 绑定拖放
      zone.addEventListener('dragover', function (e) {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', function () {
        zone.classList.remove('drag-over');
      });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (draggedTaskId) {
          const newQuadrant = parseInt(this.dataset.quadrant);
          Store.updateChecklistTask(draggedTaskId, { quadrant: newQuadrant });
          App.toast('已移动到「' + QUADRANTS[newQuadrant].name + '」', 'success');
          draggedTaskId = null;
          renderTasks();
        }
      });
    });

    // 绑定拖拽
    document.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', function (e) {
        draggedTaskId = this.dataset.id;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function () {
        this.classList.remove('dragging');
      });
    });

    // 绑定完成
    document.querySelectorAll('.task-complete-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        Store.updateChecklistTask(this.dataset.id, { completed: true });
        App.toast('任务已完成，已归档', 'success');
        renderTasks();
      });
    });

    // 绑定编辑
    document.querySelectorAll('.edit-task-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        showEditTaskModal(this.dataset.id);
      });
    });

    // 绑定删除
    document.querySelectorAll('.delete-task-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (confirm('确定删除该任务？')) {
          Store.deleteChecklistTask(this.dataset.id);
          App.toast('已删除', 'success');
          renderTasks();
        }
      });
    });
  }

  function showEditTaskModal(id) {
    const tasks = Store.getChecklistTasks(Store.getCurrentDate());
    const task = id ? tasks.find(t => t.id === id) : null;

    App.modal(task ? '编辑任务' : '新增任务', `
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
      {
        label: '保存',
        primary: true,
        onClick: function (body) {
          const text = body.querySelector('#taskText').value.trim();
          if (!text) {
            App.toast('请输入任务内容', 'warning');
            return false;
          }
          const data = {
            text: text,
            quadrant: parseInt(body.querySelector('#taskQuadrant').value),
            recurring: body.querySelector('#taskRecurring').value
          };
          if (task) {
            Store.updateChecklistTask(id, data);
          } else {
            Store.addChecklistTask(data);
          }
          App.toast('已保存', 'success');
          renderTasks();
        }
      }
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
            </div>
          `).join('')
      }
    `, [{ label: '关闭' }]);
  }

  function bindEvents() {
    document.getElementById('addChecklistTaskBtn').addEventListener('click', function () {
      showEditTaskModal(null);
    });

    document.getElementById('showArchivedBtn').addEventListener('click', showArchivedModal);
  }

  return { render };
})();
