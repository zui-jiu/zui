/* ============================================
 * app.js - 核心应用框架
 * 导航路由 · 日期切换 · 全局搜索 · 导出 · 初始化
 * ============================================ */

const App = (function () {

  let currentModule = 'dashboard';
  let _pendingBgImage = null; // 背景设置弹窗中暂存的自定义图片 base64

  // 获取可见导航项
  function getNavItems() {
    return Store.getModules().filter(m => m.visible !== false);
  }

  // 初始化
  function init() {
    Store.init();

    // 应用主题
    applyTheme(Store.getTheme());

    // 应用背景主题
    applyBackground();

    // 设置日期
    document.getElementById('currentDate').value = Store.getCurrentDate();

    // 渲染导航
    renderNav();

    // 绑定事件
    bindEvents();

    // 更新计时仓库计数
    updateTimerRepoCount();

    // 加载默认模块（取第一个可见模块）
    const items = getNavItems();
    currentModule = items.length > 0 ? items[0].id : 'dashboard';
    loadModule(currentModule);
  }

  // 渲染导航
  function renderNav() {
    const navList = document.getElementById('navList');
    const items = getNavItems();
    navList.innerHTML = items.map(item => `
      <div class="nav-item ${item.id === currentModule ? 'active' : ''}" data-module="${item.id}">
        <span class="nav-item-icon">${item.icon}</span>
        <span class="nav-item-label">${item.name}</span>
      </div>
    `).join('');

    navList.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', function () {
        loadModule(this.dataset.module);
      });
    });

    // 侧边栏底部计时仓库点击
    const miniTimer = document.getElementById('globalTimerMini');
    miniTimer.addEventListener('click', function () {
      showTimerRepoModal();
    });
  }

  // 加载模块
  function loadModule(moduleId) {
    currentModule = moduleId;
    // 更新导航高亮
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.module === moduleId);
    });

    // 移动端选择后自动收起抽屉
    closeSidebar();

    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '';
    contentArea.scrollTop = 0;

    switch (moduleId) {
      case 'dashboard':
        Dashboard.render(contentArea);
        break;
      case 'exercise':
        Exercise.render(contentArea);
        break;
      case 'study':
        Study.render(contentArea);
        break;
      case 'checklist':
        Checklist.render(contentArea);
        break;
      case 'accounting':
        Accounting.render(contentArea);
        break;
      case 'records':
        Records.render(contentArea);
        break;
      case 'timer':
        Timer.render(contentArea);
        break;
      case 'countdown':
        Countdown.render(contentArea);
        break;
      default:
        // 自定义模块
        if (moduleId.indexOf('custom_') === 0) {
          renderCustomPage(contentArea, moduleId);
        }
    }
  }

  // 自定义页面小板块选中状态
  var customSectionState = {};

  // 渲染自定义页面（按日期的笔记/记录，支持小板块）
  function renderCustomPage(container, pageId) {
    var mod = Store.getModules().find(m => m.id === pageId);
    var pageName = mod ? mod.name : '自定义页面';
    var pageIcon = mod ? mod.icon : '📝';
    var date = Store.getCurrentDate();
    var sections = Store.getCustomSections(pageId);
    var activeSection = customSectionState[pageId] || 'all';
    var allEntries = Store.getCustomPageEntriesByDate(pageId, date);
    var entries = activeSection === 'all'
      ? allEntries
      : allEntries.filter(e => e.sectionId === activeSection);

    // 小板块标签栏
    var tabsHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">';
    tabsHtml += '<button class="btn btn-sm ' + (activeSection === 'all' ? 'btn-primary' : '') + '" data-section="all">全部</button>';
    sections.forEach(function (s) {
      tabsHtml += '<button class="btn btn-sm ' + (activeSection === s.id ? 'btn-primary' : '') + '" data-section="' + s.id + '">' + escapeHtml(s.name) + '</button>';
    });
    tabsHtml += '<button class="btn btn-sm" id="addSectionBtn" style="border-style:dashed;">+ 小板块</button>';
    if (activeSection !== 'all') {
      tabsHtml += '<button class="btn-text danger" id="deleteSectionBtn" data-id="' + activeSection + '" style="font-size:12px;padding:2px 8px;">删除该板块</button>';
    }
    tabsHtml += '</div>';

    // 记录列表
    var listHtml = '';
    if (entries.length === 0) {
      listHtml = '<div class="card text-muted text-center" style="padding:30px;">今天还没有记录，写点什么吧</div>';
    } else {
      listHtml = entries.map(function (e) {
        var sec = e.sectionId ? sections.find(s => s.id === e.sectionId) : null;
        return '<div class="card custom-entry" data-id="' + e.id + '">' +
          '<div class="flex-row" style="justify-content:space-between;align-items:flex-start;">' +
            '<div class="flex-1" style="white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.7;color:var(--ink);">' + escapeHtml(e.content) + '</div>' +
            '<button class="custom-entry-del" data-id="' + e.id + '" style="border:none;background:transparent;color:var(--text-muted);font-size:18px;cursor:pointer;padding:4px 8px;">✕</button>' +
          '</div>' +
          '<div class="text-sm text-muted" style="margin-top:8px;">' +
            (sec ? '<span class="tag" style="font-size:11px;">' + escapeHtml(sec.name) + '</span> · ' : '') +
            new Date(e.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) +
          '</div>' +
        '</div>';
      }).join('');
    }

    container.innerHTML =
      '<div class="module-header">' +
        '<h2>' + pageIcon + ' ' + pageName + '</h2>' +
        '<p class="module-subtitle">' + date + ' 的记录</p>' +
      '</div>' +
      tabsHtml +
      '<div class="card">' +
        '<textarea class="custom-page-input" id="customPageInput" placeholder="在这里写下内容，点击添加保存到 ' + date + '…" rows="4" style="width:100%;border:1px solid var(--divider);border-radius:var(--radius-md);padding:12px;font-size:14px;font-family:inherit;background:var(--celadon-paler);color:var(--ink);resize:vertical;"></textarea>' +
        '<div style="margin-top:10px;text-align:right;">' +
          '<button class="btn-primary" id="customPageAdd" style="padding:8px 20px;border:none;border-radius:var(--radius-md);background:var(--celadon);color:#fff;font-size:14px;cursor:pointer;">添加记录</button>' +
        '</div>' +
      '</div>' +
      '<div id="customPageList">' + listHtml + '</div>';

    // 小板块切换
    container.querySelectorAll('[data-section]').forEach(function (btn) {
      if (btn.id === 'addSectionBtn' || btn.id === 'deleteSectionBtn') return;
      btn.addEventListener('click', function () {
        customSectionState[pageId] = this.dataset.section;
        renderCustomPage(container, pageId);
      });
    });

    // 添加小板块
    var addSecBtn = container.querySelector('#addSectionBtn');
    if (addSecBtn) {
      addSecBtn.addEventListener('click', function () {
        modal('添加小板块',
          '<div class="mb-12">' +
            '<label class="text-sm text-muted mb-8" style="display:block;">小板块名称</label>' +
            '<input type="text" class="input" id="newSectionName" placeholder="如：工作记录">' +
          '</div>',
          [
            { label: '取消' },
            {
              label: '添加',
              primary: true,
              onClick: function (body) {
                var name = body.querySelector('#newSectionName').value.trim();
                if (!name) { toast('请输入小板块名称', 'warning'); return false; }
                Store.addCustomSection(pageId, name);
                toast('小板块已添加', 'success');
                renderCustomPage(container, pageId);
              }
            }
          ]
        );
      });
    }

    // 删除小板块
    var delSecBtn = container.querySelector('#deleteSectionBtn');
    if (delSecBtn) {
      delSecBtn.addEventListener('click', function () {
        if (confirm('删除小板块将同时删除该板块下所有记录，确定？')) {
          Store.deleteCustomSection(pageId, this.dataset.id);
          customSectionState[pageId] = 'all';
          toast('已删除', 'success');
          renderCustomPage(container, pageId);
        }
      });
    }

    // 添加记录
    var input = container.querySelector('#customPageInput');
    container.querySelector('#customPageAdd').addEventListener('click', function () {
      var val = input.value.trim();
      if (!val) { toast('请输入内容', 'error'); return; }
      var secId = activeSection === 'all' ? null : activeSection;
      Store.addCustomPageEntry(pageId, val, secId);
      toast('记录已添加', 'success');
      renderCustomPage(container, pageId);
    });

    // 删除记录
    container.querySelectorAll('.custom-entry-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Store.deleteCustomPageEntry(pageId, this.dataset.id);
        renderCustomPage(container, pageId);
      });
    });
  }

  // 移动端侧边栏抽屉控制
  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  }

  function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  // 绑定全局事件
  function bindEvents() {
    // 移动端目录抽屉
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

    // 日期切换
    const dateInput = document.getElementById('currentDate');
    dateInput.addEventListener('change', function () {
      Store.setCurrentDate(this.value);
      loadModule(currentModule);
    });

    document.getElementById('prevDate').addEventListener('click', function () {
      const d = new Date(dateInput.value);
      d.setDate(d.getDate() - 1);
      dateInput.value = d.toISOString().slice(0, 10);
      Store.setCurrentDate(dateInput.value);
      loadModule(currentModule);
    });

    document.getElementById('nextDate').addEventListener('click', function () {
      const d = new Date(dateInput.value);
      d.setDate(d.getDate() + 1);
      dateInput.value = d.toISOString().slice(0, 10);
      Store.setCurrentDate(dateInput.value);
      loadModule(currentModule);
    });

    document.getElementById('todayBtn').addEventListener('click', function () {
      const today = new Date().toISOString().slice(0, 10);
      dateInput.value = today;
      Store.setCurrentDate(today);
      loadModule(currentModule);
    });

    // 全局搜索
    const searchInput = document.getElementById('globalSearch');
    const searchResults = document.getElementById('searchResults');
    const searchToggle = document.getElementById('searchToggle');
    let searchTimer = null;

    // 移动端搜索展开/收起
    if (searchToggle) {
      searchToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        const box = document.querySelector('.search-box');
        box.classList.toggle('expanded');
        if (box.classList.contains('expanded')) {
          searchInput.focus();
        } else {
          searchInput.value = '';
          searchResults.classList.remove('active');
        }
      });
    }

    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      const kw = this.value.trim();
      if (!kw) {
        searchResults.classList.remove('active');
        return;
      }
      searchTimer = setTimeout(function () {
        const results = Store.search(kw);
        renderSearchResults(results);
      }, 200);
    });

    searchInput.addEventListener('focus', function () {
      if (this.value.trim()) {
        searchResults.classList.add('active');
      }
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-box')) {
        searchResults.classList.remove('active');
        const box = document.querySelector('.search-box');
        if (box) box.classList.remove('expanded');
      }
    });

    // 导出
    document.getElementById('exportBtn').addEventListener('click', function () {
      showExportModal();
    });

    // 主题切换
    document.getElementById('themeToggle').addEventListener('click', function () {
      const current = Store.getTheme();
      const next = current === 'light' ? 'dark' : 'light';
      Store.setTheme(next);
      applyTheme(next);
      toast(next === 'dark' ? '已切换至暗色护眼模式' : '已切换至亮色模式', 'success');
    });

    // 管理目录
    const manageBtn = document.getElementById('manageModulesBtn');
    if (manageBtn) {
      manageBtn.addEventListener('click', showManageModulesModal);
    }

    // 背景设置
    const bgSettingBtn = document.getElementById('bgSettingBtn');
    if (bgSettingBtn) {
      bgSettingBtn.addEventListener('click', showBgSettingModal);
    }

    // 导入数据（从数据管理弹窗触发）
    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
      importFileInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
          const fileContent = ev.target.result;
          showImportConfirmModal(fileContent, file.name);
        };
        reader.readAsText(file);
        // 重置 input，允许重复选同一文件
        importFileInput.value = '';
      });
    }
  }

  // 导入数据确认弹窗
  function showImportConfirmModal(fileContent, fileName) {
    modal('📥 确认导入数据', `
      <p style="font-size:14px;line-height:1.7;color:var(--ink);margin-bottom:8px;">
        即将导入文件：<strong>${escapeHtml(fileName)}</strong>
      </p>
      <p style="font-size:13px;color:var(--danger);margin-bottom:0;">
        ⚠️ 此操作将<strong>覆盖</strong>当前所有数据，且无法撤销。建议先导出当前数据作为备份。
      </p>
    `, [
      { label: '取消', onClick: closeModal },
      {
        label: '确认导入',
        primary: true,
        onClick: function () {
          try {
            Store.importData(fileContent);
            closeModal();
            toast('数据导入成功，正在刷新…', 'success');
            setTimeout(function () { location.reload(); }, 1200);
          } catch (err) {
            closeModal();
            toast('导入失败：' + err.message, 'error');
          }
        }
      }
    ]);
  }

  // 管理目录弹窗
  function showManageModulesModal() {
    const modules = Store.getModules();
    const iconOptions = ['📝','📋','📌','🎯','💡','🔥','⭐','🏷️','📂','🔔','🎨','🎵','🎮','☕','🌱','📅','📊','🛒','💊','🏠'];

    const html = `
      <div class="modal-overlay" id="manageModal">
        <div class="modal">
          <div class="modal-title">⚙ 管理目录</div>
          <p class="text-muted text-sm mb-16">勾选显示/隐藏，点击名称可重命名，自定义模块可删除</p>
          <div id="moduleManageList" style="max-height:50vh;overflow-y:auto;margin-bottom:16px;">
            ${modules.map(m => `
              <div class="module-manage-item" data-id="${m.id}" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:var(--radius-md);background:var(--celadon-paler);margin-bottom:8px;">
                <input type="checkbox" class="module-visible-cb" data-id="${m.id}" ${m.visible !== false ? 'checked' : ''} style="width:20px;height:20px;flex-shrink:0;">
                <span class="module-icon-display" data-id="${m.id}" style="font-size:22px;cursor:pointer;flex-shrink:0;">${m.icon}</span>
                <input type="text" class="module-name-input" data-id="${m.id}" value="${escapeHtml(m.name)}" style="flex:1;border:1px solid var(--divider);border-radius:var(--radius-sm);padding:6px 10px;font-size:14px;background:var(--bg-card);color:var(--ink);font-family:inherit;min-width:0;">
                ${m.builtin ? '<span class="text-sm text-muted" style="flex-shrink:0;">内置</span>' : '<button class="module-del-btn" data-id="' + m.id + '" style="border:none;background:transparent;color:#e74c3c;font-size:18px;cursor:pointer;flex-shrink:0;padding:4px 8px;">🗑</button>'}
              </div>
            `).join('')}
          </div>

          <div style="border-top:1px solid var(--divider);padding-top:16px;margin-bottom:16px;">
            <div class="fw-600 mb-8" style="margin-bottom:10px;">➕ 添加自定义模块</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <input type="text" id="newModuleName" placeholder="模块名称" style="flex:1;border:1px solid var(--divider);border-radius:var(--radius-md);padding:8px 12px;font-size:14px;background:var(--celadon-paler);color:var(--ink);font-family:inherit;min-width:120px;">
              <select id="newModuleIcon" style="border:1px solid var(--divider);border-radius:var(--radius-md);padding:8px;font-size:18px;background:var(--celadon-paler);color:var(--ink);">
                ${iconOptions.map(ic => `<option value="${ic}">${ic}</option>`).join('')}
              </select>
              <button id="addModuleBtn" style="padding:8px 16px;border:none;border-radius:var(--radius-md);background:var(--celadon);color:#fff;font-size:14px;cursor:pointer;white-space:nowrap;">添加</button>
            </div>
          </div>

          <div style="text-align:right;">
            <button class="icon-btn" id="closeManageModal">完成</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modalContainer').innerHTML = html;
    const overlay = document.getElementById('manageModal');

    // 关闭
    document.getElementById('closeManageModal').addEventListener('click', function () {
      overlay.remove();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    // 显示/隐藏切换
    overlay.querySelectorAll('.module-visible-cb').forEach(cb => {
      cb.addEventListener('change', function () {
        Store.updateModule(this.dataset.id, { visible: this.checked });
      });
    });

    // 重命名
    overlay.querySelectorAll('.module-name-input').forEach(inp => {
      inp.addEventListener('change', function () {
        const newName = this.value.trim();
        if (newName) {
          Store.updateModule(this.dataset.id, { name: newName });
        }
      });
    });

    // 换图标
    overlay.querySelectorAll('.module-icon-display').forEach(span => {
      span.addEventListener('click', function () {
        const id = this.dataset.id;
        const current = this.textContent;
        const idx = iconOptions.indexOf(current);
        const next = iconOptions[(idx + 1) % iconOptions.length];
        this.textContent = next;
        Store.updateModule(id, { icon: next });
      });
    });

    // 删除自定义模块
    overlay.querySelectorAll('.module-del-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.dataset.id;
        if (confirm('确定删除这个自定义模块？所有数据将丢失。')) {
          Store.deleteCustomModule(id);
          overlay.remove();
          renderNav();
          loadModule(getNavItems()[0].id);
          toast('模块已删除', 'success');
        }
      });
    });

    // 添加新模块
    document.getElementById('addModuleBtn').addEventListener('click', function () {
      const name = document.getElementById('newModuleName').value.trim();
      const icon = document.getElementById('newModuleIcon').value;
      if (!name) { toast('请输入模块名称', 'error'); return; }
      Store.addCustomModule(name, icon);
      toast('模块已添加', 'success');
      // 刷新弹窗
      overlay.remove();
      showManageModulesModal();
    });
  }

  // 渲染搜索结果
  function renderSearchResults(results) {
    const container = document.getElementById('searchResults');
    if (results.length === 0) {
      container.innerHTML = '<div class="search-result-item"><div class="search-result-content text-muted">未找到相关结果</div></div>';
    } else {
      container.innerHTML = results.slice(0, 20).map(r => `
        <div class="search-result-item" data-module="${r.module}" data-id="${r.id}" data-date="${r.date}">
          <div class="search-result-type">${r.type}</div>
          <div class="search-result-content">${escapeHtml(r.content)}</div>
        </div>
      `).join('');

      container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', function () {
          const date = this.dataset.date;
          const module = this.dataset.module;
          // 切换到对应日期
          document.getElementById('currentDate').value = date;
          Store.setCurrentDate(date);
          // 切换到对应模块
          loadModule(module);
          container.classList.remove('active');
          document.getElementById('globalSearch').value = '';
        });
      });
    }
    container.classList.add('active');
  }

  // 数据管理弹窗（导出+导入）
  function showExportModal() {
    const html = `
      <div class="modal-overlay" id="exportModal">
        <div class="modal">
          <div class="modal-title">数据管理</div>
          <p class="text-muted mb-16">导出备份或导入恢复你的数据：</p>
          <div class="flex-row" style="flex-direction:column;gap:12px;align-items:stretch;">
            <div class="list-item" style="cursor:pointer;" id="exportJson">
              <span style="font-size:24px;">📦</span>
              <div class="flex-1">
                <div class="fw-600">JSON 完整备份</div>
                <div class="text-sm text-muted">导出全部数据，可用于恢复</div>
              </div>
            </div>
            <div class="list-item" style="cursor:pointer;" id="exportCsv">
              <span style="font-size:24px;">📊</span>
              <div class="flex-1">
                <div class="fw-600">CSV 表格导出</div>
                <div class="text-sm text-muted">计时、账单、训练、清单表格格式</div>
              </div>
            </div>
            <div class="list-item" style="cursor:pointer;" id="exportTxt">
              <span style="font-size:24px;">📝</span>
              <div class="flex-1">
                <div class="fw-600">TXT 文本导出</div>
                <div class="text-sm text-muted">纯文本格式，便于阅读和打印</div>
              </div>
            </div>
            <div style="border-top:1px solid var(--divider);margin:4px 0;"></div>
            <div class="list-item" style="cursor:pointer;" id="importData">
              <span style="font-size:24px;">📥</span>
              <div class="flex-1">
                <div class="fw-600">导入数据</div>
                <div class="text-sm text-muted">从 JSON 备份文件恢复数据</div>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn" id="closeExportModal">关闭</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modalContainer').innerHTML = html;

    document.getElementById('exportJson').addEventListener('click', function () {
      Store.exportData('json');
      toast('JSON备份已下载', 'success');
      closeModal();
    });
    document.getElementById('exportCsv').addEventListener('click', function () {
      Store.exportData('csv');
      toast('CSV文件已下载', 'success');
      closeModal();
    });
    document.getElementById('exportTxt').addEventListener('click', function () {
      Store.exportData('txt');
      toast('TXT文件已下载', 'success');
      closeModal();
    });
    document.getElementById('importData').addEventListener('click', function () {
      closeModal();
      setTimeout(function () {
        document.getElementById('importFileInput').click();
      }, 200);
    });
    document.getElementById('closeExportModal').addEventListener('click', closeModal);
    document.getElementById('exportModal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  // 计时仓库弹窗
  function showTimerRepoModal() {
    const html = `
      <div class="modal-overlay" id="timerRepoModal">
        <div class="modal">
          <div class="modal-title">⏱ 全局计时仓库</div>
          <p class="text-muted mb-12 modal-desc">所有计时记录汇总于此，可在锻炼和学习模块中调取使用。</p>
          <div id="timerRepoModalList" style="max-height:400px;overflow-y:auto;"></div>
          <div class="modal-actions">
            <button class="btn" id="closeTimerRepoModal">关闭</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modalContainer').innerHTML = html;
    Timer.renderTimerRepo('timerRepoModalList', null, null);
    document.getElementById('closeTimerRepoModal').addEventListener('click', closeModal);
    document.getElementById('timerRepoModal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  function closeModal() {
    document.getElementById('modalContainer').innerHTML = '';
  }

  // 应用主题
  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
  }

  // 中国青色系 · 中国画意境背景预设
  const BG_PRESETS = [
    { id: 'none', name: '默认', css: 'transparent' },
    { id: 'qingshan', name: '青绿山水', css: 'linear-gradient(160deg, #cfe3dd 0%, #a8c8c0 45%, #6b9b95 100%)' },
    { id: 'xuanzhi', name: '米色宣纸', css: 'repeating-linear-gradient(0deg, #efe7d6, #efe7d6 38px, #e7dcc4 39px, #efe7d6 40px), linear-gradient(135deg, #f4eddd, #e7d9bd)' },
    { id: 'daicang', name: '黛青远山', css: 'linear-gradient(180deg, #2f4a45 0%, #3f5e58 55%, #6b9b95 100%)' },
    { id: 'qiuxiang', name: '秋香色', css: 'linear-gradient(135deg, #d8c9a3 0%, #c2b182 100%)' },
    { id: 'yuebai', name: '月白条纹', css: 'repeating-linear-gradient(90deg, #eef3f1, #eef3f1 24px, #e2ece9 24px, #e2ece9 26px), linear-gradient(180deg, #f4f8f6, #e8f0ed)' },
    { id: 'shiqing', name: '石青斜纹', css: 'repeating-linear-gradient(45deg, #b8d8d4, #b8d8d4 18px, #a3cdc7 18px, #a3cdc7 20px), linear-gradient(135deg, #cfe3df, #9ec3bc)' },
    { id: 'chaha', name: '茶褐', css: 'linear-gradient(135deg, #8a6f52 0%, #b89968 100%)' },
    { id: 'zhuyin', name: '竹影', css: 'repeating-linear-gradient(125deg, rgba(107,155,149,0.14) 0 2px, transparent 2px 22px), linear-gradient(160deg, #eef3f0, #dbe7e2)' },
    { id: 'qinghua', name: '青花', css: 'radial-gradient(circle at 20% 30%, rgba(123,160,184,0.25) 0 8px, transparent 8px), radial-gradient(circle at 70% 60%, rgba(123,160,184,0.2) 0 6px, transparent 6px), linear-gradient(135deg, #f2f6f8, #dce9ef)' }
  ];

  // 应用背景主题
  function applyBackground() {
    const bg = Store.getBackground();
    const layer = document.getElementById('bgLayer');
    if (!layer) return;
    if (bg.type === 'image' && bg.image) {
      layer.style.background = `url('${bg.image}') center/cover no-repeat fixed`;
    } else if (bg.type === 'preset' && bg.preset && bg.preset !== 'none') {
      const preset = BG_PRESETS.find(p => p.id === bg.preset);
      layer.style.background = preset ? preset.css : 'transparent';
    } else {
      layer.style.background = 'transparent';
    }
    layer.style.opacity = (bg.opacity != null && bg.opacity !== '') ? bg.opacity : 1;
  }

  // 背景设置弹窗
  function showBgSettingModal() {
    App._pendingBgImage = null; // 每次打开清空暂存图片，避免残留
    const cur = Store.getBackground();
    const swatches = BG_PRESETS.map(p =>
      `<div class="bg-swatch ${cur.type === 'preset' && cur.preset === p.id ? 'selected' : ''}" data-preset="${p.id}" title="${p.name}" style="background:${p.css === 'transparent' ? 'var(--celadon-pale)' : p.css};">${p.id === 'none' ? '✕' : ''}</div>`
    ).join('');

    App.modal('背景设置', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">青色意境预设（中国画 / 青色景色配色）</label>
        <div class="bg-swatch-grid" id="bgSwatchGrid">${swatches}</div>
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:flex;justify-content:space-between;">
          <span>背景透明度</span><span id="bgOpacityLabel">${Math.round((cur.opacity != null ? cur.opacity : 1) * 100)}%</span>
        </label>
        <input type="range" min="0" max="100" value="${Math.round((cur.opacity != null ? cur.opacity : 1) * 100)}" class="bg-opacity-slider" id="bgOpacitySlider">
        <div class="text-xs text-muted mt-8">透明度越低，越能透出底层青色；越高则背景越实。</div>
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">自定义图片背景</label>
        <button class="btn btn-sm" id="bgUploadBtn">📁 从相册/本地选择图片</button>
        ${cur.type === 'image' && cur.image ? '<span class="text-sm text-muted ml-8">当前：自定义图片</span>' : ''}
      </div>
    `, [
      { label: '取消' },
      { label: '保存', primary: true, onClick: function (body) {
          const sel = body.querySelector('.bg-swatch.selected');
          const preset = sel ? sel.dataset.preset : 'none';
          const opacity = parseInt(body.querySelector('#bgOpacitySlider').value) / 100;
          let bg = { type: 'preset', preset: preset, opacity: opacity, image: '' };
          // 图片已在上传时暂存到 App._pendingBgImage
          if (App._pendingBgImage) {
            bg = { type: 'image', preset: 'none', opacity: opacity, image: App._pendingBgImage };
            App._pendingBgImage = null;
          }
          Store.setBackground(bg);
          applyBackground();
          App.toast('背景已更新', 'success');
        } }
    ]);

    // 预设选择
    const grid = document.getElementById('bgSwatchGrid');
    grid.querySelectorAll('.bg-swatch').forEach(sw => {
      sw.addEventListener('click', function () {
        App._pendingBgImage = null;
        grid.querySelectorAll('.bg-swatch').forEach(s => s.classList.remove('selected'));
        this.classList.add('selected');
      });
    });

    // 透明度
    const slider = document.getElementById('bgOpacitySlider');
    slider.addEventListener('input', function () {
      document.getElementById('bgOpacityLabel').textContent = this.value + '%';
    });

    // 上传图片
    document.getElementById('bgUploadBtn').addEventListener('click', function () {
      document.getElementById('bgImageInput').click();
    });
    document.getElementById('bgImageInput').addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        App._pendingBgImage = ev.target.result;
        grid.querySelectorAll('.bg-swatch').forEach(s => s.classList.remove('selected'));
        App.toast('已选择图片，点击保存生效', 'success');
      };
      reader.readAsDataURL(file);
      this.value = '';
    });
  }

  // 更新计时仓库计数
  function updateTimerRepoCount() {
    const count = Store.getTimers().length;
    document.getElementById('timerRepoCount').textContent = count + ' 条记录';
  }

  // Toast 通知
  function toast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'all 0.3s';
      setTimeout(() => el.remove(), 300);
    }, 2800);
  }

  // 通用：创建模态框
  function modal(title, contentHtml, actions) {
    const html = `
      <div class="modal-overlay" id="dynamicModal">
        <div class="modal">
          <div class="modal-title">${title}</div>
          <div id="dynamicModalBody">${contentHtml}</div>
          <div class="modal-actions" id="dynamicModalActions"></div>
        </div>
      </div>
    `;
    document.getElementById('modalContainer').innerHTML = html;

    const actionsContainer = document.getElementById('dynamicModalActions');
    if (actions && actions.length > 0) {
      actions.forEach(a => {
        const btn = document.createElement('button');
        btn.className = a.primary ? 'btn btn-primary' : 'btn';
        btn.textContent = a.label;
        btn.addEventListener('click', function () {
          var result = undefined;
          if (a.onClick) result = a.onClick(document.getElementById('dynamicModalBody'));
          if (result !== false && a.closeAfter !== false) closeModal();
        });
        actionsContainer.appendChild(btn);
      });
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = '关闭';
      btn.addEventListener('click', closeModal);
      actionsContainer.appendChild(btn);
    }

    document.getElementById('dynamicModal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  // 工具函数
  function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function formatMoney(num) {
    return '¥' + (parseFloat(num) || 0).toFixed(2);
  }

  // 获取某月的天数范围
  function getMonthRange(dateStr) {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth();
    return {
      yearMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
      year: String(year),
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`
    };
  }

  // ============ SVG 图表工具（不依赖外部库） ============

  // 折线图：opts = { labels:[], series:[{name,color,data:[]}], height, unit }
  function lineChart(container, opts) {
    const labels = opts.labels || [];
    const series = opts.series || [];
    const height = opts.height || 220;
    const unit = opts.unit || '';
    let allVals = [];
    series.forEach(s => { allVals = allVals.concat(s.data); });
    if (allVals.length === 0 || labels.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div>暂无统计数据</div>';
      return;
    }
    const max = Math.max(...allVals, 1);
    const min = Math.min(...allVals, 0);
    const w = 360, padL = 38, padR = 14, padT = 16, padB = 30;
    const plotW = w - padL - padR;
    const plotH = height - padT - padB;
    const n = labels.length;
    const xStep = n > 1 ? plotW / (n - 1) : 0;
    const xOf = i => padL + (n > 1 ? i * xStep : plotW / 2);
    const yOf = v => padT + plotH - ((v - min) / ((max - min) || 1)) * plotH;
    const gridN = 4;
    let svg = `<svg viewBox="0 0 ${w} ${height}" width="100%" preserveAspectRatio="none" style="display:block;">`;
    // 网格线 + Y轴刻度
    for (let g = 0; g <= gridN; g++) {
      const val = min + (max - min) * (g / gridN);
      const y = yOf(val);
      svg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="var(--divider)" stroke-width="1"/>`;
      svg += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--ink-light)">${Math.round(val)}</text>`;
    }
    // X轴标签
    labels.forEach((lb, i) => {
      const show = n <= 10 || i % Math.ceil(n / 10) === 0;
      if (show) {
        svg += `<text x="${xOf(i).toFixed(1)}" y="${height - 10}" text-anchor="middle" font-size="9" fill="var(--ink-light)">${escapeHtml(String(lb))}</text>`;
      }
    });
    // 各折线
    series.forEach(s => {
      const pts = s.data.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
      svg += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      s.data.forEach((v, i) => {
        svg += `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(v).toFixed(1)}" r="2.6" fill="${s.color}"/>`;
      });
    });
    svg += '</svg>';
    // 图例
    let legend = '';
    if (series.length > 1) {
      legend = '<div class="chart-legend">' + series.map(s =>
        `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${s.color};"></span>${escapeHtml(s.name)}</span>`
      ).join('') + '</div>';
    }
    container.innerHTML = svg + legend;
  }

  // 柱状图：opts = { labels:[], data:[], color, height, unit }
  function barChart(container, opts) {
    const labels = opts.labels || [];
    const data = opts.data || [];
    const color = opts.color || 'var(--celadon)';
    const height = opts.height || 220;
    if (data.length === 0 || labels.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div>暂无统计数据</div>';
      return;
    }
    const max = Math.max(...data, 1);
    const w = 360, padL = 38, padR = 14, padT = 16, padB = 30;
    const plotW = w - padL - padR;
    const plotH = height - padT - padB;
    const n = data.length;
    const slot = plotW / n;
    const barW = Math.min(slot * 0.6, 40);
    const yOf = v => padT + plotH - (v / max) * plotH;
    let svg = `<svg viewBox="0 0 ${w} ${height}" width="100%" preserveAspectRatio="none" style="display:block;">`;
    for (let g = 0; g <= 4; g++) {
      const val = max * (g / 4);
      const y = yOf(val);
      svg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="var(--divider)" stroke-width="1"/>`;
      svg += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--ink-light)">${Math.round(val)}</text>`;
    }
    data.forEach((v, i) => {
      const x = padL + slot * i + (slot - barW) / 2;
      const y = yOf(v);
      const h = padT + plotH - y;
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="${color}"/>`;
      svg += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--ink-medium)">${v}</text>`;
      svg += `<text x="${(x + barW / 2).toFixed(1)}" y="${height - 10}" text-anchor="middle" font-size="9" fill="var(--ink-light)">${escapeHtml(String(labels[i]))}</text>`;
    });
    svg += '</svg>';
    container.innerHTML = svg;
  }

  // 绑定折叠组件：让 .section-block.collapsible 的标题可点击展开/收起
  function bindCollapsible(container, defaultCollapsed) {
    var blocks = container.querySelectorAll('.section-block.collapsible');
    blocks.forEach(function (block) {
      if (block.dataset.collapsibleBound) return;
      block.dataset.collapsibleBound = '1';
      var title = block.querySelector('.section-title');
      if (!title) return;
      // 添加折叠箭头
      var chevron = document.createElement('span');
      chevron.className = 'collapse-chevron';
      chevron.textContent = '▼';
      title.appendChild(chevron);
      // 默认折叠
      if (defaultCollapsed) block.classList.add('collapsed');
      title.addEventListener('click', function (e) {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
        block.classList.toggle('collapsed');
      });
    });
  }

  return {
    init,
    loadModule,
    toast,
    modal,
    closeModal,
    updateTimerRepoCount,
    escapeHtml,
    formatDate,
    formatMoney,
    getMonthRange,
    bindCollapsible,
    lineChart,
    barChart,
    getCurrentDate: () => Store.getCurrentDate()
  };
})();

// 启动应用
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
