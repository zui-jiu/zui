/* ============================================
 * countdown.js - 倒数日模块（Days Matter 风格）
 * 卡片网格 · 天数计算 · 详情页 · 背景色/图 · 布局切换
 * ============================================ */

const Countdown = (function () {

  // 纯色背景选项（至少 6 色）
  const BG_COLORS = [
    '#6B9B95', '#C9786E', '#C9A24E', '#7BA0B8',
    '#9DBF9E', '#B07CC9', '#D4855E', '#5A8079'
  ];

  // 当前布局：'two' | 'one'
  let layout = 'two';

  function diffDays(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((target - today) / 86400000);
    return diff; // >=0 表示未来（倒数），<0 表示已过去
  }

  function render(container) {
    const list = Store.getCountdowns().slice().sort((a, b) => a.date.localeCompare(b.date));
    if (list.length > 0) layout = list[0].layout || 'two';

    container.innerHTML = `
      <div class="module-header flex-between" style="display:flex;align-items:center;">
        <div>
          <h2>⏳ 倒数日</h2>
          <div class="module-subtitle">重要日子的倒数与累计</div>
        </div>
        <div class="flex-row" style="gap:8px;">
          <button class="btn btn-sm" id="layoutToggleBtn" title="切换布局">${layout === 'two' ? '▦' : '▤'}</button>
          <button class="btn btn-primary btn-sm" id="addCountdownBtn">+ 添加</button>
        </div>
      </div>

      <div id="countdownListArea" class="${layout === 'two' ? 'countdown-grid grid-2' : 'countdown-grid countdown-grid-one'}">
        ${list.length === 0 ? '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">⏳</div>还没有倒数日，点击右上角添加</div>' : list.map(c => renderCard(c)).join('')}
      </div>
    `;

    bindEvents();
  }

  function renderCard(c) {
    const diff = diffDays(c.date);
    const isFuture = diff >= 0;
    const bg = c.bg || BG_COLORS[0];
    const isImage = bg && (bg.startsWith('data:') || bg.startsWith('http'));
    const style = isImage
      ? `background-image:url('${bg}');background-size:cover;background-position:center;`
      : `background:${bg};`;

    return `
      <div class="countdown-card" data-id="${c.id}" style="${style}">
        <div class="countdown-card-overlay">
          <div class="countdown-bar">${App.escapeHtml(c.title)}</div>
          <div class="countdown-body">
            <div class="countdown-days">${Math.abs(diff)}</div>
            <div class="countdown-label">${isFuture ? '距离 ' + App.escapeHtml(c.title) + ' 还有' : App.escapeHtml(c.title) + ' 已经'}</div>
            <div class="countdown-date">${c.date}</div>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    document.getElementById('addCountdownBtn').addEventListener('click', function () {
      showEditModal(null);
    });
    document.getElementById('layoutToggleBtn').addEventListener('click', function () {
      layout = layout === 'two' ? 'one' : 'two';
      // 同步到第一条记录（用于持久化布局偏好）
      const list = Store.getCountdowns();
      if (list.length > 0) Store.updateCountdown(list[0].id, { layout: layout });
      render(document.getElementById('contentArea'));
    });
    document.querySelectorAll('.countdown-card').forEach(card => {
      card.addEventListener('click', function () {
        openDetail(this.dataset.id);
      });
    });
  }

  // 详情页
  function openDetail(id) {
    const c = Store.getCountdown(id);
    if (!c) return;
    const diff = diffDays(c.date);
    const isFuture = diff >= 0;
    const bg = c.bg || BG_COLORS[0];
    const isImage = bg && (bg.startsWith('data:') || bg.startsWith('http'));
    const style = isImage
      ? `background-image:url('${bg}');background-size:cover;background-position:center;`
      : `background:${bg};`;

    const container = document.getElementById('contentArea');
    container.innerHTML = `
      <div class="module-header">
        <button class="btn-text" id="backBtn">← 返回</button>
      </div>
      <div class="countdown-detail" style="${style}">
        <div class="countdown-detail-overlay">
          <div class="countdown-detail-days">${Math.abs(diff)}</div>
          <div class="countdown-detail-title">${App.escapeHtml(c.title)}</div>
          <div class="countdown-detail-sub">${isFuture ? '距离今天还有' : '已经过去'} · ${c.date}</div>
          ${c.detail ? `<div class="countdown-detail-desc">${App.escapeHtml(c.detail)}</div>` : ''}
          <div class="countdown-detail-actions">
            <button class="btn countdown-act-btn" id="shareBtn">📤 分享</button>
            <button class="btn countdown-act-btn" id="saveImgBtn">🖼 存为图片</button>
            <button class="btn countdown-act-btn" id="bgBtn">🎨 背景</button>
            <button class="btn countdown-act-btn" id="editBtn">✏️ 编辑</button>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#backBtn').addEventListener('click', function () {
      render(container);
    });
    container.querySelector('#editBtn').addEventListener('click', function () {
      showEditModal(id, function () { render(container); });
    });
    container.querySelector('#bgBtn').addEventListener('click', function () {
      showBgModal(id, function () { openDetail(id); });
    });
    container.querySelector('#shareBtn').addEventListener('click', function () {
      App.toast('分享功能：可长按上方卡片截图分享', 'info');
    });
    container.querySelector('#saveImgBtn').addEventListener('click', function () {
      App.toast('存为图片：可长按或截图保存卡片', 'info');
    });
  }

  // 新增/编辑弹窗
  function showEditModal(id, onSaved) {
    const c = id ? Store.getCountdown(id) : null;
    App.modal(id ? '编辑倒数日' : '新增倒数日', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">事件标题</label>
        <input type="text" class="input" id="cdTitle" value="${c ? App.escapeHtml(c.title) : ''}" placeholder="如：考研倒计时">
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">目标日期</label>
        <input type="date" class="input" id="cdDate" value="${c ? c.date : Store.getCurrentDate()}">
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">详情描述（可选）</label>
        <textarea class="textarea" id="cdDetail" rows="3" placeholder="备注说明…">${c ? App.escapeHtml(c.detail || '') : ''}</textarea>
      </div>
      ${c ? `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">背景</label>
        <div class="flex-row flex-wrap" style="gap:6px;">
          ${BG_COLORS.map(col => `<span class="cd-color-swatch" data-color="${col}" style="background:${col};${c.bg === col ? 'outline:2px solid var(--celadon-dark);outline-offset:2px;' : ''}"></span>`).join('')}
          ${c.bg && c.bg.startsWith('data:') ? '<span class="text-sm text-muted">已设置图片背景</span>' : ''}
        </div>
      </div>` : ''}
    `, [
      { label: '取消' },
      {
        label: id ? '保存' : '添加',
        primary: true,
        onClick: function (body) {
          const title = body.querySelector('#cdTitle').value.trim();
          if (!title) { App.toast('请输入标题', 'warning'); return false; }
          const date = body.querySelector('#cdDate').value;
          if (!date) { App.toast('请选择日期', 'warning'); return false; }
          const detail = body.querySelector('#cdDetail').value;
          const swatch = body.querySelector('.cd-color-swatch.selected');
          let bg = c ? c.bg : BG_COLORS[0];
          if (id && swatch) bg = swatch.dataset.color;

          if (id) {
            Store.updateCountdown(id, { title, date, detail, bg, layout });
          } else {
            Store.addCountdown({ title, date, detail, bg, layout });
          }
          App.toast(id ? '已更新' : '已添加', 'success');
          if (onSaved) onSaved(); else render(document.getElementById('contentArea'));
        }
      },
      ...(id ? [{ label: '删除', onClick: function () {
          if (confirm('确定删除这个倒数日？')) {
            Store.deleteCountdown(id);
            App.toast('已删除', 'success');
            render(document.getElementById('contentArea'));
          }
        } }] : [])
    ]);

    const modalBody = document.getElementById('dynamicModalBody');
    if (modalBody && id) {
      modalBody.querySelectorAll('.cd-color-swatch').forEach(sw => {
        sw.addEventListener('click', function () {
          modalBody.querySelectorAll('.cd-color-swatch').forEach(s => s.classList.remove('selected'));
          this.classList.add('selected');
        });
      });
    }
  }

  // 背景设置弹窗（纯色 + 图片）
  function showBgModal(id, onSaved) {
    const c = Store.getCountdown(id);
    App.modal('设置背景', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">纯色背景</label>
        <div class="flex-row flex-wrap" style="gap:6px;" id="bgColorRow">
          ${BG_COLORS.map(col => `<span class="cd-color-swatch" data-color="${col}" style="background:${col};${c.bg === col ? 'outline:2px solid var(--celadon-dark);outline-offset:2px;' : ''}"></span>`).join('')}
        </div>
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">自定义图片背景</label>
        <input type="file" class="input" id="bgImageInput" accept="image/*">
        <div class="text-xs text-muted mt-8">选择图片后会转为 base64 存储（建议尺寸适中）。</div>
      </div>
    `, [
      { label: '取消' },
      {
        label: '保存',
        primary: true,
        onClick: function (body) {
          const swatch = body.querySelector('.cd-color-swatch.selected');
          const fileInput = body.querySelector('#bgImageInput');
          if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = function (e) {
              Store.updateCountdown(id, { bg: e.target.result });
              App.toast('背景已更新', 'success');
              if (onSaved) onSaved();
            };
            reader.readAsDataURL(file);
            return false; // 等待异步
          } else if (swatch) {
            Store.updateCountdown(id, { bg: swatch.dataset.color });
            App.toast('背景已更新', 'success');
            if (onSaved) onSaved();
          } else {
            App.toast('请选择颜色或图片', 'warning');
            return false;
          }
        }
      }
    ]);

    const modalBody = document.getElementById('dynamicModalBody');
    modalBody.querySelectorAll('.cd-color-swatch').forEach(sw => {
      sw.addEventListener('click', function () {
        modalBody.querySelectorAll('.cd-color-swatch').forEach(s => s.classList.remove('selected'));
        this.classList.add('selected');
      });
    });
  }

  return { render };
})();
