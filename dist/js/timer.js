/* ============================================
 * timer.js - 共享计时器组件
 * 正计时 / 倒计时，记录存入全局计时仓库
 * ============================================ */

const Timer = (function () {

  // 当前活跃计时器实例
  let activeTimers = {}; // { instanceId: {intervalId, mode, seconds, target, name, source, startTime} }

  // 格式化时间
  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // 创建计时器UI
  function createTimerWidget(containerId, source, onSaved) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const instanceId = containerId + '_' + Date.now();

    container.innerHTML = `
      <div class="timer-widget" id="${instanceId}">
        <div class="timer-mode-switch">
          <button class="btn btn-sm timer-mode-btn active" data-mode="up">正计时</button>
          <button class="btn btn-sm timer-mode-btn" data-mode="down">倒计时</button>
        </div>
        <div class="timer-name-row mt-12">
          <input type="text" class="input timer-name-input" placeholder="为本次计时命名（可选）">
        </div>
        <div class="timer-countdown-setup mt-12" style="display:none;">
          <div class="flex-row">
            <input type="number" class="input timer-min-input" placeholder="分钟" min="0" style="width:80px;" value="25">
            <span class="text-muted">分</span>
            <input type="number" class="input timer-sec-input" placeholder="秒" min="0" max="59" style="width:70px;" value="0">
            <span class="text-muted">秒</span>
          </div>
        </div>
        <div class="timer-display mt-12" id="${instanceId}_display">0:00</div>
        <div class="timer-controls mt-12">
          <button class="btn btn-primary timer-start-btn" id="${instanceId}_start">开始</button>
          <button class="btn timer-stop-btn" id="${instanceId}_stop" style="display:none;">暂停</button>
          <button class="btn timer-reset-btn" id="${instanceId}_reset">重置</button>
          <button class="btn timer-save-btn" id="${instanceId}_save" style="display:none;">保存记录</button>
        </div>
        <div class="timer-status mt-8 text-sm text-muted" id="${instanceId}_status"></div>
      </div>
    `;

    const widget = document.getElementById(instanceId);
    let mode = 'up';
    let seconds = 0;
    let target = 0;
    let intervalId = null;
    let isRunning = false;
    let startTime = null;

    // 模式切换
    widget.querySelectorAll('.timer-mode-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (isRunning) return;
        mode = this.dataset.mode;
        widget.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const setup = widget.querySelector('.timer-countdown-setup');
        setup.style.display = mode === 'down' ? 'block' : 'none';
        seconds = 0;
        updateDisplay();
      });
    });

    // 更新显示
    function updateDisplay() {
      const display = document.getElementById(instanceId + '_display');
      if (mode === 'down' && target > 0) {
        const remaining = Math.max(0, target - seconds);
        display.textContent = formatTime(remaining);
      } else {
        display.textContent = formatTime(seconds);
      }
    }

    // 开始
    const startBtn = document.getElementById(instanceId + '_start');
    const stopBtn = document.getElementById(instanceId + '_stop');
    const resetBtn = document.getElementById(instanceId + '_reset');
    const saveBtn = document.getElementById(instanceId + '_save');
    const statusEl = document.getElementById(instanceId + '_status');

    startBtn.addEventListener('click', function () {
      const nameInput = widget.querySelector('.timer-name-input');
      if (mode === 'down') {
        const min = parseInt(widget.querySelector('.timer-min-input').value) || 0;
        const sec = parseInt(widget.querySelector('.timer-sec-input').value) || 0;
        target = min * 60 + sec;
        if (target === 0) {
          App.toast('请设置倒计时时长', 'warning');
          return;
        }
      }
      isRunning = true;
      startTime = Date.now();
      startBtn.style.display = 'none';
      stopBtn.style.display = 'inline-flex';
      saveBtn.style.display = 'none';
      statusEl.textContent = '计时中…';

      intervalId = setInterval(function () {
        seconds++;
        updateDisplay();
        if (mode === 'down' && seconds >= target) {
          stopTimer(true);
          App.toast('倒计时完成！', 'success');
          // 播放提示音
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1);
          } catch (e) {}
        }
      }, 1000);
    });

    function stopTimer(finished) {
      isRunning = false;
      clearInterval(intervalId);
      startBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';
      saveBtn.style.display = 'inline-flex';
      statusEl.textContent = finished ? '已完成' : '已暂停';

      // 切换按钮文字
      if (!finished) {
        startBtn.textContent = '继续';
      } else {
        startBtn.textContent = '开始';
      }
    }

    stopBtn.addEventListener('click', function () {
      stopTimer(false);
    });

    resetBtn.addEventListener('click', function () {
      clearInterval(intervalId);
      isRunning = false;
      seconds = 0;
      target = 0;
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = '开始';
      stopBtn.style.display = 'none';
      saveBtn.style.display = 'none';
      statusEl.textContent = '';
      updateDisplay();
    });

    saveBtn.addEventListener('click', function () {
      const nameInput = widget.querySelector('.timer-name-input');
      const name = nameInput.value.trim() || (source === 'exercise' ? '训练计时' : '学习计时');
      const timer = Store.addTimer({
        name: name,
        mode: mode,
        duration: seconds,
        targetDuration: target,
        source: source,
        startTime: startTime,
        endTime: Date.now()
      });
      App.toast(`计时记录"${name}"已保存到全局仓库（${formatTime(seconds)}）`, 'success');
      nameInput.value = '';
      seconds = 0;
      target = 0;
      startBtn.textContent = '开始';
      saveBtn.style.display = 'none';
      statusEl.textContent = '';
      updateDisplay();
      if (onSaved) onSaved(timer);
      App.updateTimerRepoCount();
    });

    updateDisplay();
  }

  // 渲染计时仓库列表（可嵌入任意模块）
  function renderTimerRepo(containerId, filter, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const timers = Store.getTimers();
    const sorted = [...timers].sort((a, b) => b.createdAt - a.createdAt);

    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏱</div>暂无计时记录</div>';
      return;
    }

    let html = '<div class="timer-repo-list">';
    sorted.forEach(t => {
      if (filter && !filter(t)) return;
      const mins = Math.floor(t.duration / 60);
      const secs = t.duration % 60;
      const timeStr = mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
      const sourceLabel = t.source === 'exercise' ? '锻炼' : '学习';
      html += `
        <div class="list-item timer-repo-item" data-id="${t.id}">
          <div class="flex-1">
            <div class="fw-600">${escapeHtml(t.name)}</div>
            <div class="text-sm text-muted">
              <span class="timer-source-tag">${sourceLabel}</span>
              ${t.mode === 'up' ? '正计时' : '倒计时'} · ${timeStr} · ${t.date}
            </div>
          </div>
          ${onSelect ? `<button class="btn btn-sm timer-import-btn" data-id="${t.id}">导入</button>` : ''}
          <button class="btn-text danger timer-delete-btn" data-id="${t.id}">删除</button>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;

    // 绑定事件
    if (onSelect) {
      container.querySelectorAll('.timer-import-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const timer = Store.getTimer(this.dataset.id);
          if (timer) onSelect(timer);
        });
      });
    }
    container.querySelectorAll('.timer-delete-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('确定删除这条计时记录？')) {
          Store.deleteTimer(this.dataset.id);
          App.toast('已删除', 'success');
          renderTimerRepo(containerId, filter, onSelect);
          App.updateTimerRepoCount();
        }
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 独立计时器页面
  function render(container) {
    container.innerHTML = `
      <div class="module-header">
        <h2>⏱ 计时器</h2>
        <div class="module-subtitle">正计时 / 倒计时 · 记录自动存入全局计时仓库</div>
      </div>

      <div class="section-block">
        <div id="timerMainWidget"></div>
      </div>

      <div class="section-block collapsible">
        <div class="section-title">
          <span class="section-title-icon">📜</span>
          计时记录
          <span class="text-xs text-muted" style="margin-left:4px;">（来源：计时器）</span>
        </div>
        <div id="timerRecordsList" style="max-height:320px;overflow-y:auto;"></div>
      </div>
    `;

    createTimerWidget('timerMainWidget', 'timer', function () {
      renderRecords();
    });
    renderRecords();
    App.bindCollapsible(container);
  }

  function renderRecords() {
    const el = document.getElementById('timerRecordsList');
    if (!el) return;
    renderTimerRepo('timerRecordsList', function (t) { return t.source === 'timer'; }, null);
  }

  return {
    createTimerWidget,
    renderTimerRepo,
    formatTime,
    render
  };
})();
