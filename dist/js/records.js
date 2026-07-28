/* ============================================
 * records.js - 日常记录模块（重构）
 * 板块目录 → 按日期列表 → 富文本编辑页（contenteditable + 工具栏 + 涂鸦）
 * ============================================ */

const Records = (function () {

  const MOOD_OPTIONS = ['开心', '平淡', '疲惫', '焦虑', '兴奋', '低落', '感恩', '愤怒'];
  let savedRange = null; // 富文本选区保存

  function render(container) {
    const date = Store.getCurrentDate();
    container.innerHTML = `
      <div class="module-header">
        <h2>✏️ 日常记录</h2>
        <div class="module-subtitle">随笔 · 心情 · 图片 · 习惯 · ${App.formatDate(date)}</div>
      </div>

      <div class="flex-between mb-16">
        <div class="text-muted text-sm">选择一个板块查看记录</div>
        <button class="btn" id="addRecordBoardBtn">+ 新增板块</button>
      </div>

      <div id="recordsBoardsContainer" class="dir-list"></div>
    `;
    renderBoards();
    bindEvents();
  }

  function renderBoards() {
    const container = document.getElementById('recordsBoardsContainer');
    const boards = Store.getRecordBoards();
    if (boards.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✏️</div>暂无板块，点击右上角创建</div>';
      return;
    }
    container.innerHTML = boards.map(b => {
      const count = Store.getRecordEntries(b.id).length;
      return `
        <div class="dir-item board-dir-item" data-id="${b.id}">
          <span class="dir-item-icon">${getBoardIcon(b.type)}</span>
          <span class="dir-item-main">
            <span class="dir-item-title">${App.escapeHtml(b.name)}</span>
            <span class="dir-item-sub">${getBoardTypeLabel(b.type)} · ${count} 条记录</span>
          </span>
          <span class="dir-item-actions">
            <button class="btn-text edit-board-btn" data-id="${b.id}" style="font-size:12px;">重命名</button>
            <button class="btn-text danger delete-board-btn" data-id="${b.id}" style="font-size:12px;">删除</button>
          </span>
          <span class="dir-item-arrow">›</span>
        </div>`;
    }).join('');

    container.querySelectorAll('.board-dir-item').forEach(el => {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.edit-board-btn') || e.target.closest('.delete-board-btn')) return;
        renderBoardPage(this.dataset.id);
      });
    });
    container.querySelectorAll('.edit-board-btn').forEach(btn => btn.addEventListener('click', function () { showEditBoardModal(this.dataset.id); }));
    container.querySelectorAll('.delete-board-btn').forEach(btn => btn.addEventListener('click', function () {
      if (confirm('删除板块将同时删除该板块下所有记录，确定？')) { Store.deleteRecordBoard(this.dataset.id); renderBoards(); App.toast('已删除板块', 'success'); }
    }));
  }

  // 板块下一页：按日期排列的记录列表
  function renderBoardPage(boardId) {
    const board = Store.getRecordBoards().find(b => b.id === boardId);
    if (!board) return;
    const entries = Store.getRecordEntries(boardId).slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

    // 按日期分组
    const groups = {};
    entries.forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });

    const container = document.getElementById('contentArea');
    container.innerHTML = `
      <div class="module-header">
        <button class="btn-text" id="boardBackBtn">← 返回</button>
        <span style="margin-left:8px;">${getBoardIcon(board.type)} ${App.escapeHtml(board.name)}</span>
      </div>
      <div class="flex-between mb-16">
        <div class="text-muted text-sm">共 ${entries.length} 条记录</div>
        <button class="btn btn-primary btn-sm" id="newEntryBtn">+ 新建记录</button>
      </div>
      <div id="boardEntriesList"></div>
    `;

    const listEl = container.querySelector('#boardEntriesList');
    if (entries.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">' + getBoardIcon(board.type) + '</div>暂无记录，点击「新建记录」</div>';
    } else {
      listEl.innerHTML = Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => {
        const items = groups[date].slice().sort((a, b) => b.createdAt - a.createdAt);
        return `
          <div class="record-date-group">
            <div class="record-date-label">${App.formatDate(date)} <span class="text-xs text-muted">(${items.length})</span></div>
            ${items.map(e => renderEntryRow(board, e)).join('')}
          </div>`;
      }).join('');
    }

    container.querySelector('#boardBackBtn').addEventListener('click', function () { render(container); });
    container.querySelector('#newEntryBtn').addEventListener('click', function () { renderEditor(null, boardId); });
    listEl.querySelectorAll('.entry-row').forEach(row => {
      row.addEventListener('click', function () { renderEditor(this.dataset.id, boardId); });
    });
    listEl.querySelectorAll('.entry-del-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('确定删除该记录？')) { Store.deleteRecordEntry(this.dataset.id); App.toast('已删除', 'success'); renderBoardPage(boardId); }
      });
    });
  }

  function renderEntryRow(board, e) {
    let preview = '';
    if (board.type === 'mood') {
      preview = `<span class="mood-tag-display">${getMoodIcon(e.mood)} ${App.escapeHtml(e.mood || '')}</span>`;
    } else if (board.type === 'habit') {
      preview = `<span class="fw-600">${App.escapeHtml(e.content)}</span> <span class="tag" style="cursor:default;">🔥 ${e.habitStreak || 0} 天</span>`;
    } else if (board.type === 'image') {
      const firstImg = (e.images && e.images[0]) ? `<img src="${e.images[0]}" class="entry-thumb">` : '';
      preview = firstImg + `<span class="text-sm text-muted">${App.escapeHtml(e.content || '').slice(0, 30) || '图片记录'}</span>`;
    } else {
      const text = e.content ? e.content.replace(/<[^>]+>/g, '').slice(0, 40) : '';
      preview = `<span class="text-sm">${App.escapeHtml(text) || '<span class="text-muted">空</span>'}</span>`;
    }
    return `
      <div class="list-item entry-row" data-id="${e.id}" style="cursor:pointer;">
        <div class="flex-1">${preview}</div>
        <span class="text-xs text-muted">${e.date}</span>
        <button class="btn-text danger entry-del-btn" data-id="${e.id}" style="margin-left:6px;">删除</button>
      </div>`;
  }

  // 富文本编辑页
  function renderEditor(id, boardId) {
    const board = Store.getRecordBoards().find(b => b.id === boardId);
    const entry = id ? Store.getRecordEntries(boardId).find(e => e.id === id) : null;
    const container = document.getElementById('contentArea');

    container.innerHTML = `
      <div class="module-header">
        <button class="btn-text" id="editorBackBtn">← 返回</button>
        <span style="margin-left:8px;">${entry ? '编辑记录' : '新建记录'}</span>
      </div>

      ${board.type === 'mood' ? `
        <div class="mb-12">
          <label class="text-sm text-muted mb-8" style="display:block;">心情</label>
          <div class="flex-row flex-wrap mood-picker" id="moodPicker">
            ${MOOD_OPTIONS.map(m => `<span class="tag mood-tag ${entry && entry.mood === m ? 'selected' : ''}" data-mood="${m}">${getMoodIcon(m)} ${m}</span>`).join('')}
          </div>
        </div>` : ''}

      ${board.type === 'habit' ? `
        <div class="grid-2 mb-12">
          <div>
            <label class="text-sm text-muted mb-8" style="display:block;">习惯名称</label>
            <input type="text" class="input" id="habitName" value="${entry ? App.escapeHtml(entry.content) : ''}" placeholder="如：早起喝水">
          </div>
          <div>
            <label class="text-sm text-muted mb-8" style="display:block;">重复周期</label>
            <select class="select" id="habitPeriod">
              <option value="daily" ${(entry && entry.habitPeriod === 'daily') || !entry ? 'selected' : ''}>每日</option>
              <option value="weekly" ${entry && entry.habitPeriod === 'weekly' ? 'selected' : ''}>每周</option>
            </select>
          </div>
        </div>` : ''}

      <div class="rich-editor-toolbar">
        <button class="re-tool" data-cmd="fontSmall" title="减小字号">A-</button>
        <button class="re-tool" data-cmd="fontLarge" title="增大字号">A+</button>
        <span class="re-divider"></span>
        <input type="color" class="re-color" id="reColor" value="#2C3E3A" title="文字颜色">
        <button class="re-tool" data-cmd="bold" title="加粗"><b>B</b></button>
        <button class="re-tool" data-cmd="italic" title="斜体"><i>I</i></button>
        <button class="re-tool" data-cmd="underline" title="下划线"><u>U</u></button>
        <button class="re-tool" data-cmd="strikeThrough" title="删除线"><s>S</s></button>
        <span class="re-divider"></span>
        <button class="re-tool" data-cmd="justifyLeft" title="左对齐">⬅</button>
        <button class="re-tool" data-cmd="justifyCenter" title="居中">⬌</button>
        <button class="re-tool" data-cmd="justifyRight" title="右对齐">➡</button>
        <span class="re-divider"></span>
        <button class="re-tool" data-cmd="insertUnorderedList" title="无序列表">•≡</button>
        <button class="re-tool" data-cmd="insertOrderedList" title="有序列表">1≡</button>
        <span class="re-divider"></span>
        <button class="re-tool" data-cmd="insertImage" title="插入图片">🖼</button>
        <button class="re-tool" data-cmd="doodle" title="涂鸦">✎</button>
      </div>

      <div class="rich-editor" id="richEditor" contenteditable="true" style="${entry && entry.color ? 'color:' + App.escapeHtml(entry.color) + ';' : ''}${entry && entry.fontSize ? 'font-size:' + App.escapeHtml(entry.fontSize) + ';' : ''}${entry && entry.fontFamily ? 'font-family:' + App.escapeHtml(entry.fontFamily) + ';' : ''}">${entry ? entry.content : ''}</div>

      <div class="doodle-area" id="doodleArea" style="display:none;">
        <canvas id="doodleCanvas" width="320" height="180" class="doodle-canvas"></canvas>
        <div class="flex-row mt-8" style="gap:8px;">
          <button class="btn btn-sm" id="doodleClear">清除</button>
          <button class="btn btn-sm btn-primary" id="doodleInsert">插入到正文</button>
        </div>
      </div>

      <input type="file" id="imageFileInput" accept="image/*" style="display:none;">

      <div class="flex-row mt-16" style="gap:8px;justify-content:flex-end;">
        <button class="btn" id="editorCancelBtn">取消</button>
        <button class="btn btn-primary" id="editorSaveBtn">保存</button>
      </div>
    `;

    bindEditor(container, board, entry);
  }

  function bindEditor(container, board, entry) {
    const editor = container.querySelector('#richEditor');
    const colorInput = container.querySelector('#reColor');

    function saveSel() {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
    }
    function restoreSel() {
      editor.focus();
      if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
    }
    editor.addEventListener('keyup', saveSel);
    editor.addEventListener('mouseup', saveSel);

    // 工具栏命令
    container.querySelectorAll('.re-tool').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const cmd = this.dataset.cmd;
        restoreSel();
        if (cmd === 'fontSmall' || cmd === 'fontLarge') {
          // 调整整段或选区字号
          const cur = parseInt(getComputedStyle(editor).fontSize) || 14;
          const next = cmd === 'fontLarge' ? cur + 2 : Math.max(10, cur - 2);
          document.execCommand('fontSize', false, '7');
          // fontSize 7 是最大，需替换字体大小为具体 px
          const fonts = editor.querySelectorAll('font[size]');
          fonts.forEach(f => {
            f.removeAttribute('size');
            f.style.fontSize = next + 'px';
          });
        } else if (cmd === 'insertImage') {
          container.querySelector('#imageFileInput').click();
        } else if (cmd === 'doodle') {
          const da = container.querySelector('#doodleArea');
          da.style.display = da.style.display === 'none' ? 'block' : 'none';
          if (da.style.display === 'block') initDoodle(container);
        } else {
          document.execCommand(cmd, false, null);
        }
        saveSel();
      });
    });

    // 颜色
    colorInput.addEventListener('input', function () {
      restoreSel();
      document.execCommand('foreColor', false, this.value);
      saveSel();
    });

    // 插入图片
    container.querySelector('#imageFileInput').addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        restoreSel();
        document.execCommand('insertImage', false, ev.target.result);
        saveSel();
      };
      reader.readAsDataURL(file);
      this.value = '';
    });

    // 涂鸦
    function initDoodle(c) {
      const canvas = c.querySelector('#doodleCanvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#2C3E3A';
      ctx.lineWidth = 2;
      let drawing = false;
      const pos = e => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        return { x: x * scaleX, y: y * scaleY };
      };
      const start = e => { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
      const move = e => { if (!drawing) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
      const end = () => { drawing = false; };
      canvas.onmousedown = start; canvas.onmousemove = move; canvas.onmouseup = end; canvas.onmouseleave = end;
      canvas.ontouchstart = start; canvas.ontouchmove = move; canvas.ontouchend = end;
      c.querySelector('#doodleClear').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
      c.querySelector('#doodleInsert').onclick = () => {
        const dataUrl = canvas.toDataURL('image/png');
        restoreSel();
        document.execCommand('insertImage', false, dataUrl);
        c.querySelector('#doodleArea').style.display = 'none';
        saveSel();
      };
    }

    // 心情选择
    const moodPicker = container.querySelector('#moodPicker');
    if (moodPicker) {
      moodPicker.querySelectorAll('.mood-tag').forEach(tag => {
        tag.addEventListener('click', function () {
          moodPicker.querySelectorAll('.mood-tag').forEach(t => t.classList.remove('selected'));
          this.classList.add('selected');
        });
      });
    }

    // 保存
    container.querySelector('#editorSaveBtn').addEventListener('click', function () {
      const content = editor.innerHTML.trim();
      if (!content && board.type !== 'habit' && board.type !== 'mood') {
        App.toast('请输入内容', 'warning'); return;
      }
      // 提取图片
      const imgs = [];
      editor.querySelectorAll('img').forEach(img => { if (img.src) imgs.push(img.src); });
      const fontSize = editor.style.fontSize || '';
      const fontFamily = editor.style.fontFamily || '';
      const color = editor.style.color || '';

      const data = { boardId: board.id, content, images: imgs, fontSize, fontFamily, color };

      if (board.type === 'mood') {
        const sel = moodPicker ? moodPicker.querySelector('.mood-tag.selected') : null;
        if (!sel) { App.toast('请选择心情', 'warning'); return; }
        data.mood = sel.dataset.mood;
      } else if (board.type === 'habit') {
        const name = container.querySelector('#habitName').value.trim();
        if (!name) { App.toast('请输入习惯名称', 'warning'); return; }
        data.content = name;
        data.habitPeriod = container.querySelector('#habitPeriod').value;
        const streak = computeHabitStreak(board.id, name, entry ? entry.id : null);
        data.habitStreak = streak;
      }

      if (entry) Store.updateRecordEntry(entry.id, data);
      else Store.addRecordEntry(data);
      App.toast('已保存', 'success');
      renderBoardPage(board.id);
    });

    container.querySelector('#editorCancelBtn').addEventListener('click', function () { renderBoardPage(board.id); });
    container.querySelector('#editorBackBtn').addEventListener('click', function () { renderBoardPage(board.id); });
  }

  function computeHabitStreak(boardId, name, excludeId) {
    const today = Store.getCurrentDate();
    const others = Store.getRecordEntries(boardId).filter(e => e.id !== excludeId && e.content === name);
    if (others.length === 0) return 1;
    const latest = others.sort((a, b) => b.date.localeCompare(a.date))[0];
    if (latest.lastCheckDate === today) return latest.habitStreak || 1;
    const lastDate = new Date(latest.lastCheckDate);
    const todayDate = new Date(today);
    const diffDays = Math.round((todayDate - lastDate) / 86400000);
    if ((latest.habitPeriod || 'daily') === 'daily' && diffDays === 1) return (latest.habitStreak || 0) + 1;
    if ((latest.habitPeriod || 'daily') === 'weekly' && diffDays <= 7) return (latest.habitStreak || 0) + 1;
    return 1;
  }

  // ============ 弹窗 ============
  function showEditBoardModal(id) {
    const board = Store.getRecordBoards().find(b => b.id === id);
    if (!board) return;
    App.modal('重命名板块', `
      <div class="mb-12"><input type="text" class="input" id="boardName" value="${App.escapeHtml(board.name)}"></div>
    `, [
      { label: '取消' },
      { label: '保存', primary: true, onClick: function (body) {
          const name = body.querySelector('#boardName').value.trim();
          if (!name) { App.toast('请输入名称', 'warning'); return false; }
          Store.updateRecordBoard(id, { name });
          renderBoards(); App.toast('已更新', 'success');
        } }
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
      { label: '创建', primary: true, onClick: function (body) {
          const name = body.querySelector('#newBoardName').value.trim();
          if (!name) { App.toast('请输入板块名称', 'warning'); return false; }
          Store.addRecordBoard(name, body.querySelector('#newBoardType').value);
          renderBoards(); App.toast('板块已创建', 'success');
        } }
    ]);
  }

  function bindEvents() {
    document.getElementById('addRecordBoardBtn').addEventListener('click', showAddBoardModal);
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
    const icons = { '开心': '😄', '平淡': '😐', '疲惫': '😵', '焦虑': '😰', '兴奋': '🤩', '低落': '😢', '感恩': '🙏', '愤怒': '😡' };
    return icons[mood] || '😐';
  }

  return { render };
})();
