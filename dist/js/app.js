/* ============================================
 * app.js - 核心应用框架
 * 导航路由 · 日期切换 · 全局搜索 · 导出 · 初始化
 * ============================================ */

const App = (function () {

  let currentModule = 'dashboard';

  // 获取可见导航项
  function getNavItems() {
    return Store.getModules().filter(m => m.visible !== false);
  }

  // 初始化
  function init() {
    Store.init();

    // 应用主题
    applyTheme(Store.getTheme());

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

    // 导出数据
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        Store.exportData('json');
        toast('数据已导出为文件，请妥善保存', 'success');
      });
    }

    // 导入数据
    const importBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');
    if (importBtn && importFileInput) {
      importBtn.addEventListener('click', function () {
        importFileInput.click();
      });
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

  // 导出弹窗
  function showExportModal() {
    const html = `
      <div class="modal-overlay" id="exportModal">
        <div class="modal">
          <div class="modal-title">数据备份导出</div>
          <p class="text-muted mb-16">选择导出格式，备份你的全部数据：</p>
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
    getCurrentDate: () => Store.getCurrentDate()
  };
})();

// 启动应用
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
