/* ============================================
 * records.js - 日常记录模块
 * 随笔 · 心情 · 图片 · 习惯打卡 · 自定义板块
 * ============================================ */

const Records = (function () {

  const MOOD_OPTIONS = ['开心', '平淡', '疲惫', '焦虑', '兴奋', '低落', '感恩', '愤怒'];

  function render(container) {
    const date = Store.getCurrentDate();
    container.innerHTML = `
      <div class="module-header">
        <h2>✏️ 日常记录</h2>
        <div class="module-subtitle">随笔 · 心情 · 图片 · 习惯打卡 · ${App.formatDate(date)}</div>
      </div>

      <div class="flex-between mb-16">
        <div class="flex-row">
          <button class="btn btn-primary" id="addRecordEntryBtn">+ 新增记录</button>
          <button class="btn" id="addRecordBoardBtn">+ 新增板块</button>
        </div>
      </div>

      <div id="recordsBoardsContainer"></div>
    `;

    renderBoards();
    bindEvents();
  }

  function renderBoards() {
    const container = document.getElementById('recordsBoardsContainer');
    const boards = Store.getRecordBoards();
    const date = Store.getCurrentDate();

    if (boards.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✏️</div>暂无板块，点击上方按钮创建</div>';
      return;
    }

    let html = '';
    boards.forEach(board => {
      const entries = Store.getRecordEntries(board.id, date);

      html += `
        <div class="section-block" data-board-id="${board.id}">
          <div class="section-title">
            <span class="section-title-icon">${getBoardIcon(board.type)}</span>
            ${App.escapeHtml(board.name)}
            <span class="text-xs text-muted" style="margin-left:4px;">(${getBoardTypeLabel(board.type)})</span>
            <div style="margin-left:auto;display:flex;gap:4px;">
              <button class="btn-text edit-board-btn" data-id="${board.id}" style="font-size:12px;">重命名</button>
              <button class="btn-text danger delete-board-btn" data-id="${board.id}" style="font-size:12px;">删除</button>
            </div>
          </div>
          <div id="boardEntries_${board.id}">
            ${renderBoardEntries(board, entries)}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // 绑定事件
    container.querySelectorAll('.edit-board-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        showEditBoardModal(this.dataset.id);
      });
    });

    container.querySelectorAll('.delete-board-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (confirm('删除板块将同时删除该板块下所有记录，确定？')) {
          Store.deleteRecordBoard(this.dataset.id);
          renderBoards();
          App.toast('已删除板块', 'success');
        }
      });
    });

    container.querySelectorAll('.delete-entry-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (confirm('确定删除该记录？')) {
          Store.deleteRecordEntry(this.dataset.id);
          renderBoards();
          App.toast('已删除', 'success');
        }
      });
    });

    // 习惯打卡
    container.querySelectorAll('.habit-check-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        handleHabitCheck(this.dataset.id);
      });
    });

    // 图片预览
    container.querySelectorAll('.record-image').forEach(img => {
      img.addEventListener('click', function () {
        showImagePreview(this.src);
      });
    });
  }

  function renderBoardEntries(board, entries) {
    if (entries.length === 0) {
      return '<div class="empty-state"><div class="empty-state-icon">' + getBoardIcon(board.type) + '</div>今日暂无记录</div>';
    }

    const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);

    return sorted.map(e => {
      let html = '<div class="list-item record-entry" style="flex-direction:column;align-items:stretch;">';
      html += '<div class="flex-between">';

      // 根据类型显示不同内容
      if (board.type === 'mood') {
        html += `<div class="flex-row"><span class="mood-tag-display">${getMoodIcon(e.mood)} ${App.escapeHtml(e.mood || '')}</span></div>`;
      } else if (board.type === 'habit') {
        const isCheckedToday = e.lastCheckDate === Store.getCurrentDate();
        html += `<div class="flex-row">
          <button class="btn ${isCheckedToday ? 'btn-primary' : ''} habit-check-btn" data-id="${e.id}">
            ${isCheckedToday ? '✓ 今日已打卡' : '打卡'}
          </button>
          <span class="fw-600">${App.escapeHtml(e.content)}</span>
          <span class="tag" style="cursor:default;">🔥 连续 ${e.habitStreak || 0} 天</span>
          <span class="text-xs text-muted">${e.habitPeriod === 'daily' ? '每日' : '每周'}</span>
        </div>`;
      } else {
        html += `<span>${App.escapeHtml(e.content).replace(/\n/g, '<br>')}</span>`;
      }

      html += `<div class="flex-row">
        <span class="text-xs text-muted">${e.date}</span>
        <button class="btn-text danger delete-entry-btn" data-id="${e.id}">删除</button>
      </div>`;
      html += '</div>';

      // 图片展示
      if (board.type === 'image' && e.images && e.images.length > 0) {
        html += '<div class="record-images mt-8">';
        e.images.forEach(src => {
          html += `<img src="${src}" class="record-image" alt="记录图片">`;
        });
        html += '</div>';
        if (e.content) {
          html += `<div class="text-sm text-muted mt-8">${App.escapeHtml(e.content).replace(/\n/g, '<br>')}</div>`;
        }
      }

      html += '</div>';
      return html;
    }).join('');
  }

  function handleHabitCheck(entryId) {
    const allEntries = Store.getRecordEntries();
    const habit = allEntries.find(e => e.id === entryId);
    if (!habit) return;

    const today = Store.getCurrentDate();
    if (habit.lastCheckDate === today) {
      App.toast('今日已打卡', 'warning');
      return;
    }

    // 计算连续天数
    let newStreak = 1;
    if (habit.lastCheckDate) {
      const lastDate = new Date(habit.lastCheckDate);
      const todayDate = new Date(today);
      const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      if (habit.habitPeriod === 'daily' && diffDays === 1) {
        newStreak = (habit.habitStreak || 0) + 1;
      } else if (habit.habitPeriod === 'weekly' && diffDays <= 7) {
        newStreak = (habit.habitStreak || 0) + 1;
      } else {
        newStreak = 1; // 断了，重新开始
      }
    }

    Store.updateRecordEntry(entryId, {
      lastCheckDate: today,
      habitStreak: newStreak
    });
    App.toast(`打卡成功！连续 ${newStreak} 天 🔥`, 'success');
    renderBoards();
  }

  function showAddEntryModal() {
    const boards = Store.getRecordBoards();
    if (boards.length === 0) {
      App.toast('请先创建一个板块', 'warning');
      return;
    }

    App.modal('新增记录', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">选择板块</label>
        <select class="select" id="entryBoard">
          ${boards.map(b => `<option value="${b.id}" data-type="${b.type}">${getBoardIcon(b.type)} ${App.escapeHtml(b.name)} (${getBoardTypeLabel(b.type)})</option>`).join('')}
        </select>
      </div>
      <div id="entryDynamicFields"></div>
    `, [
      { label: '取消' },
      {
        label: '保存',
        primary: true,
        onClick: function (body) {
          const boardId = body.querySelector('#entryBoard').value;
          const board = boards.find(b => b.id === boardId);
          if (!board) return false;

          const data = { boardId: boardId };

          if (board.type === 'mood') {
            data.mood = body.querySelector('#entryMood') ? body.querySelector('#entryMood .mood-tag.selected')?.dataset.mood : '';
            if (!data.mood) {
              App.toast('请选择心情', 'warning');
              return false;
            }
            data.content = body.querySelector('#entryContent') ? body.querySelector('#entryContent').value : '';
          } else if (board.type === 'habit') {
            data.content = body.querySelector('#habitName').value.trim();
            if (!data.content) {
              App.toast('请输入习惯名称', 'warning');
              return false;
            }
            data.habitPeriod = body.querySelector('#habitPeriod').value;
            data.habitStreak = 0;
          } else if (board.type === 'image') {
            data.content = body.querySelector('#entryContent') ? body.querySelector('#entryContent').value : '';
            const fileInput = body.querySelector('#entryImages');
            if (fileInput.files.length > 0) {
              // 读取图片为base64
              const promises = Array.from(fileInput.files).slice(0, 5).map(file => {
                return new Promise(resolve => {
                  const reader = new FileReader();
                  reader.onload = e => resolve(e.target.result);
                  reader.readAsDataURL(file);
                });
              });
              Promise.all(promises).then(images => {
                data.images = images;
                Store.addRecordEntry(data);
                App.toast('记录已保存', 'success');
                renderBoards();
                App.closeModal();
              });
              return false; // 阻止关闭，由promise处理
            }
            data.images = [];
          } else {
            data.content = body.querySelector('#entryContent').value;
            if (!data.content.trim()) {
              App.toast('请输入内容', 'warning');
              return false;
            }
          }

          Store.addRecordEntry(data);
          App.toast('记录已保存', 'success');
          renderBoards();
        }
      }
    ]);

    // 动态渲染字段
    function updateFields() {
      const select = document.getElementById('entryBoard');
      const selectedOption = select.options[select.selectedIndex];
      const type = selectedOption.dataset.type;
      const fieldsContainer = document.getElementById('entryDynamicFields');

      let html = '';
      if (type === 'mood') {
        html = `
          <div class="mb-12">
            <label class="text-sm text-muted mb-8" style="display:block;">选择心情</label>
            <div class="flex-row flex-wrap" id="entryMood">
              ${MOOD_OPTIONS.map(m => `<span class="tag mood-tag" data-mood="${m}">${getMoodIcon(m)} ${m}</span>`).join('')}
            </div>
          </div>
          <div class="mb-12">
            <label class="text-sm text-muted mb-8" style="display:block;">心情描述（可选）</label>
            <textarea class="textarea" id="entryContent" rows="3" placeholder记录此刻的心情…"></textarea>
          </div>
        `;
      } else if (type === 'habit') {
        html = `
          <div class="mb-12">
            <label class="text-sm text-muted mb-8" style="display:block;">习惯名称</label>
            <input type="text" class="input" id="habitName" placeholder="如：早起喝杯水">
          </div>
          <div class="mb-12">
            <label class="text-sm text-muted mb-8" style="display:block;">重复周期</label>
            <select class="select" id="habitPeriod">
              <option value="daily">每日</option>
              <option value="weekly">每周</option>
            </select>
          </div>
        `;
      } else if (type === 'image') {
        html = `
          <div class="mb-12">
            <label class="text-sm text-muted mb-8" style="display:block;">上传图片（最多5张）</label>
            <input type="file" class="input" id="entryImages" accept="image/*" multiple>
          </div>
          <div class="mb-12">
            <label class="text-sm text-muted mb-8" style="display:block;">图片描述（可选）</label>
            <textarea class="textarea" id="entryContent" rows="2" placeholder="为图片添加文字说明…"></textarea>
          </div>
        `;
      } else {
        html = `
          <div class="mb-12">
            <label class="text-sm text-muted mb-8" style="display:block;">内容</label>
            <textarea class="textarea" id="entryContent" rows="6" placeholder="写下你的想法…"></textarea>
          </div>
        `;
      }
      fieldsContainer.innerHTML = html;

      // 心情标签选择
      const moodContainer = document.getElementById('entryMood');
      if (moodContainer) {
        moodContainer.querySelectorAll('.mood-tag').forEach(tag => {
          tag.addEventListener('click', function () {
            moodContainer.querySelectorAll('.mood-tag').forEach(t => t.classList.remove('selected'));
            this.classList.add('selected');
          });
        });
      }
    }

    document.getElementById('entryBoard').addEventListener('change', updateFields);
    updateFields();
  }

  function showEditBoardModal(id) {
    const board = Store.getRecordBoards().find(b => b.id === id);
    if (!board) return;

    App.modal('重命名板块', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">板块名称</label>
        <input type="text" class="input" id="boardName" value="${App.escapeHtml(board.name)}">
      </div>
    `, [
      { label: '取消' },
      {
        label: '保存',
        primary: true,
        onClick: function (body) {
          const name = body.querySelector('#boardName').value.trim();
          if (!name) {
            App.toast('请输入名称', 'warning');
            return false;
          }
          Store.updateRecordBoard(id, { name: name });
          renderBoards();
          App.toast('已更新', 'success');
        }
      }
    ]);
  }

  function showAddBoardModal() {
    App.modal('新增板块', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">板块名称</label>
        <input type="text" class="input" id="newBoardName" placeholder="如：读书笔记">
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">板块类型</label>
        <select class="select" id="newBoardType">
          <option value="note">📝 随笔（纯文字）</option>
          <option value="mood">😊 心情记录（带心情标签）</option>
          <option value="image">📷 图片记录（多图+文字）</option>
          <option value="habit">🔁 习惯打卡（周期+连续天数）</option>
        </select>
      </div>
    `, [
      { label: '取消' },
      {
        label: '创建',
        primary: true,
        onClick: function (body) {
          const name = body.querySelector('#newBoardName').value.trim();
          if (!name) {
            App.toast('请输入板块名称', 'warning');
            return false;
          }
          const type = body.querySelector('#newBoardType').value;
          Store.addRecordBoard(name, type);
          renderBoards();
          App.toast('板块已创建', 'success');
        }
      }
    ]);
  }

  function showImagePreview(src) {
    App.modal('图片预览', `<img src="${src}" style="width:100%;border-radius:10px;">`, [{ label: '关闭' }]);
  }

  function getBoardIcon(type) {
    const icons = { note: '📝', mood: '😊', image: '📷', habit: '🔁' };
    return icons[type] || '📝';
  }

  function getBoardTypeLabel(type) {
    const labels = { note: '随笔', mood: '心情', image: '图片', habit: '习惯' };
    return labels[type] || '随笔';
  }

  function getMoodIcon(mood) {
    const icons = {
      '开心': '😄', '平淡': '😐', '疲惫': '😵', '焦虑': '😰',
      '兴奋': '🤩', '低落': '😢', '感恩': '🙏', '愤怒': '😡'
    };
    return icons[mood] || '😐';
  }

  function bindEvents() {
    document.getElementById('addRecordEntryBtn').addEventListener('click', function () {
      showAddEntryModal();
    });

    document.getElementById('addRecordBoardBtn').addEventListener('click', function () {
      showAddBoardModal();
    });
  }

  return { render };
})();
