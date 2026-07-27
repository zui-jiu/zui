/* ============================================
 * accounting.js - 每日记账模块
 * 账户管理 · 收支录入 · 数据汇总 · 占比统计
 * ============================================ */

const Accounting = (function () {

  let currentSummaryView = 'day'; // 'day' | 'month' | 'year'

  function render(container) {
    const date = Store.getCurrentDate();
    container.innerHTML = `
      <div class="module-header">
        <h2>💰 每日记账</h2>
        <div class="module-subtitle">账户管理 · 收支录入 · 数据汇总 · ${App.formatDate(date)}</div>
      </div>

      <!-- 板块1：账户管理 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">🏦</span>
          账户管理
          <button class="btn btn-sm" id="addAccountBtn" style="margin-left:auto;">+ 新增账户</button>
        </div>
        <div id="accountsList" class="grid-3"></div>
      </div>

      <!-- 板块2：收支录入 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">✍️</span>
          收支录入
          <button class="btn btn-sm btn-primary" id="addTransactionBtn" style="margin-left:auto;">+ 记一笔</button>
        </div>
        <div id="todayTransactions"></div>
      </div>

      <!-- 板块3：数据汇总 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">📊</span>
          数据汇总
          <div style="margin-left:auto;display:flex;gap:6px;">
            <button class="btn btn-sm summary-view-btn ${currentSummaryView === 'day' ? 'btn-primary' : ''}" data-view="day">日汇总</button>
            <button class="btn btn-sm summary-view-btn ${currentSummaryView === 'month' ? 'btn-primary' : ''}" data-view="month">月汇总</button>
            <button class="btn btn-sm summary-view-btn ${currentSummaryView === 'year' ? 'btn-primary' : ''}" data-view="year">年汇总</button>
          </div>
        </div>
        <div id="summaryView"></div>
      </div>

      <!-- 板块4：支出占比统计 -->
      <div class="section-block">
        <div class="section-title">
          <span class="section-title-icon">🥧</span>
          支出分类占比
        </div>
        <div id="categoryStats"></div>
      </div>
    `;

    renderAccounts();
    renderTodayTransactions();
    renderSummary();
    renderCategoryStats();
    bindEvents();
  }

  // ============ 账户管理 ============
  function renderAccounts() {
    const container = document.getElementById('accountsList');
    const accounts = Store.getAccounts();

    if (accounts.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏦</div>暂无账户</div>';
      return;
    }

    container.innerHTML = accounts.map(a => `
      <div class="account-card stat-card">
        <div class="flex-between mb-8">
          <span class="fw-600">${App.escapeHtml(a.name)}</span>
          <div>
            <button class="btn-text edit-account-btn" data-id="${a.id}" style="font-size:12px;">编辑</button>
            <button class="btn-text danger delete-account-btn" data-id="${a.id}" style="font-size:12px;">删除</button>
          </div>
        </div>
        <div class="stat-card-value">${App.formatMoney(a.balance)}</div>
        <div class="stat-card-label">当前余额</div>
      </div>
    `).join('');

    container.querySelectorAll('.edit-account-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        showEditAccountModal(this.dataset.id);
      });
    });

    container.querySelectorAll('.delete-account-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (confirm('删除账户将影响关联的账单记录，确定？')) {
          Store.deleteAccount(this.dataset.id);
          renderAccounts();
          renderTodayTransactions();
          App.toast('已删除', 'success');
        }
      });
    });
  }

  function showEditAccountModal(id) {
    const account = id ? Store.getAccounts().find(a => a.id === id) : null;
    App.modal(account ? '编辑账户' : '新增账户', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">账户名称</label>
        <input type="text" class="input" id="accountName" value="${account ? App.escapeHtml(account.name) : ''}" placeholder="如：银行卡">
      </div>
      ${account ? `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">余额调整</label>
        <input type="number" class="input" id="accountBalance" value="${account.balance}" step="0.01">
      </div>
      ` : ''}
    `, [
      { label: '取消' },
      {
        label: '保存',
        primary: true,
        onClick: function (body) {
          const name = body.querySelector('#accountName').value.trim();
          if (!name) {
            App.toast('请输入账户名称', 'warning');
            return false;
          }
          if (account) {
            Store.updateAccount(id, {
              name: name,
              balance: parseFloat(body.querySelector('#accountBalance').value) || 0
            });
          } else {
            Store.addAccount(name);
          }
          renderAccounts();
          App.toast('已保存', 'success');
        }
      }
    ]);
  }

  // ============ 收支录入 ============
  function renderTodayTransactions() {
    const container = document.getElementById('todayTransactions');
    const date = Store.getCurrentDate();
    const txs = Store.getTransactions(date);

    if (txs.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div>今日暂无账单记录</div>';
      return;
    }

    const sorted = [...txs].sort((a, b) => b.createdAt - a.createdAt);
    container.innerHTML = sorted.map(t => {
      const account = Store.getAccounts().find(a => a.id === t.accountId);
      const isExpense = t.type === 'expense';
      return `
        <div class="list-item">
          <span style="font-size:20px;">${isExpense ? '💸' : '💵'}</span>
          <div class="flex-1">
            <div class="fw-600">${App.escapeHtml(t.category)}${t.subCategory ? ' · ' + App.escapeHtml(t.subCategory) : ''}</div>
            <div class="text-sm text-muted">
              ${account ? App.escapeHtml(account.name) : '未知账户'}
              ${t.note ? ' · ' + App.escapeHtml(t.note) : ''}
            </div>
          </div>
          <span class="fw-600" style="color:${isExpense ? 'var(--danger)' : 'var(--celadon-dark)'};">
            ${isExpense ? '-' : '+'}${App.formatMoney(t.amount)}
          </span>
          <button class="btn-text danger delete-tx-btn" data-id="${t.id}">删除</button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.delete-tx-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (confirm('确定删除该账单？')) {
          Store.deleteTransaction(this.dataset.id);
          renderTodayTransactions();
          renderAccounts();
          renderSummary();
          renderCategoryStats();
          App.toast('已删除', 'success');
        }
      });
    });
  }

  function showAddTransactionModal() {
    const accounts = Store.getAccounts();
    if (accounts.length === 0) {
      App.toast('请先创建一个账户', 'warning');
      return;
    }

    const expenseCats = Store.getExpenseCategories();
    const incomeCats = Store.getIncomeCategories();

    App.modal('记一笔', `
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">类型</label>
        <div class="flex-row">
          <button class="btn tx-type-btn active" data-type="expense" id="txTypeExpense">💸 支出</button>
          <button class="btn tx-type-btn" data-type="income" id="txTypeIncome">💵 收入</button>
        </div>
        <input type="hidden" id="txType" value="expense">
      </div>
      <div class="grid-2 mb-12">
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">账户</label>
          <select class="select" id="txAccount">
            ${accounts.map(a => `<option value="${a.id}">${App.escapeHtml(a.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">日期</label>
          <input type="date" class="input" id="txDate" value="${Store.getCurrentDate()}">
        </div>
      </div>
      <div class="grid-2 mb-12">
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">一级分类</label>
          <select class="select" id="txCategory"></select>
        </div>
        <div>
          <label class="text-sm text-muted mb-8" style="display:block;">二级分类</label>
          <div class="flex-row">
            <select class="select" id="txSubCategory" style="flex:1;"></select>
            <button class="btn btn-sm" id="addSubCatBtn" title="新增子分类">+</button>
          </div>
        </div>
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">金额</label>
        <input type="number" class="input" id="txAmount" placeholder="0.00" step="0.01" min="0">
      </div>
      <div class="mb-12">
        <label class="text-sm text-muted mb-8" style="display:block;">备注</label>
        <input type="text" class="input" id="txNote" placeholder="可选备注">
      </div>
    `, [
      { label: '取消' },
      {
        label: '保存',
        primary: true,
        onClick: function (body) {
          const amount = parseFloat(body.querySelector('#txAmount').value);
          if (!amount || amount <= 0) {
            App.toast('请输入有效金额', 'warning');
            return false;
          }
          const type = body.querySelector('#txType').value;
          const categorySelect = body.querySelector('#txCategory');
          const subCategorySelect = body.querySelector('#txSubCategory');
          Store.addTransaction({
            date: body.querySelector('#txDate').value,
            accountId: body.querySelector('#txAccount').value,
            type: type,
            category: categorySelect.value,
            subCategory: subCategorySelect.value,
            amount: amount,
            note: body.querySelector('#txNote').value
          });
          App.toast('记账成功！', 'success');
          // 刷新
          renderAccounts();
          renderTodayTransactions();
          renderSummary();
          renderCategoryStats();
        }
      }
    ]);

    // 类型切换
    function updateCategories() {
      const type = document.getElementById('txType').value;
      const cats = type === 'expense' ? expenseCats : incomeCats;
      const catSelect = document.getElementById('txCategory');
      catSelect.innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
      updateSubCategories();
    }

    function updateSubCategories() {
      const type = document.getElementById('txType').value;
      const catName = document.getElementById('txCategory').value;
      const cats = type === 'expense' ? expenseCats : incomeCats;
      const cat = cats.find(c => c.name === catName);
      const subs = cat ? cat.subCategories : [];
      const subSelect = document.getElementById('txSubCategory');
      subSelect.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
      if (subs.length === 0) {
        subSelect.innerHTML = '<option value="">无子分类</option>';
      }
    }

    document.getElementById('txTypeExpense').addEventListener('click', function () {
      document.getElementById('txType').value = 'expense';
      document.querySelectorAll('.tx-type-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
      this.classList.add('active', 'btn-primary');
      updateCategories();
    });

    document.getElementById('txTypeIncome').addEventListener('click', function () {
      document.getElementById('txType').value = 'income';
      document.querySelectorAll('.tx-type-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
      this.classList.add('active', 'btn-primary');
      updateCategories();
    });

    document.getElementById('txCategory').addEventListener('change', updateSubCategories);

    document.getElementById('addSubCatBtn').addEventListener('click', function () {
      const type = document.getElementById('txType').value;
      const catName = document.getElementById('txCategory').value;
      const newSub = prompt('请输入新的子分类名称：');
      if (newSub && newSub.trim()) {
        if (type === 'expense') {
          const cat = expenseCats.find(c => c.name === catName);
          if (cat) Store.addExpenseSubCategory(cat.id, newSub.trim());
        }
        updateSubCategories();
        document.getElementById('txSubCategory').value = newSub.trim();
      }
    });

    // 初始化
    document.getElementById('txTypeExpense').classList.add('btn-primary');
    updateCategories();
  }

  // ============ 数据汇总 ============
  function renderSummary() {
    const container = document.getElementById('summaryView');
    const date = Store.getCurrentDate();
    let txs = [];

    let label = '';
    if (currentSummaryView === 'day') {
      txs = Store.getTransactions(date);
      label = App.formatDate(date);
    } else if (currentSummaryView === 'month') {
      const monthStr = date.slice(0, 7);
      txs = Store.getTransactionsByMonth(monthStr);
      const d = new Date(date);
      label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    } else {
      const yearStr = date.slice(0, 4);
      txs = Store.getTransactionsByYear(yearStr);
      label = `${yearStr}年`;
    }

    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    container.innerHTML = `
      <div class="grid-3 mb-16">
        <div class="stat-card">
          <div class="stat-card-value" style="color:var(--celadon-dark);">+${App.formatMoney(income)}</div>
          <div class="stat-card-label">${label}总收入</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value" style="color:var(--danger);">-${App.formatMoney(expense)}</div>
          <div class="stat-card-label">${label}总支出</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value" style="color:${balance >= 0 ? 'var(--celadon-dark)' : 'var(--danger)'};">${balance >= 0 ? '+' : ''}${App.formatMoney(balance)}</div>
          <div class="stat-card-label">${label}结余</div>
        </div>
      </div>
      ${txs.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📊</div>该时段暂无账单记录</div>' : `
        <div class="text-sm text-muted mb-8">账单明细（共${txs.length}条）</div>
        <div style="max-height:300px;overflow-y:auto;">
          ${[...txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).map(t => {
            const account = Store.getAccounts().find(a => a.id === t.accountId);
            return `
              <div class="list-item">
                <span style="font-size:18px;">${t.type === 'expense' ? '💸' : '💵'}</span>
                <div class="flex-1">
                  <div class="text-sm fw-600">${App.escapeHtml(t.category)}${t.subCategory ? ' · ' + App.escapeHtml(t.subCategory) : ''}</div>
                  <div class="text-xs text-muted">${t.date} · ${account ? App.escapeHtml(account.name) : ''}${t.note ? ' · ' + App.escapeHtml(t.note) : ''}</div>
                </div>
                <span class="fw-600 text-sm" style="color:${t.type === 'expense' ? 'var(--danger)' : 'var(--celadon-dark)'};">
                  ${t.type === 'expense' ? '-' : '+'}${App.formatMoney(t.amount)}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  // ============ 支出占比统计 ============
  function renderCategoryStats() {
    const container = document.getElementById('categoryStats');
    const date = Store.getCurrentDate();
    const monthStr = date.slice(0, 7);
    const txs = Store.getTransactionsByMonth(monthStr).filter(t => t.type === 'expense');

    if (txs.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🥧</div>本月暂无支出数据</div>';
      return;
    }

    // 按一级分类统计
    const catTotals = {};
    txs.forEach(t => {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });

    const total = Object.values(catTotals).reduce((s, v) => s + v, 0);
    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

    // 颜色映射
    const colors = ['var(--celadon)', 'var(--bean-green)', 'var(--jade-blue)', 'var(--info)', 'var(--warning)', 'var(--danger)'];

    let html = `<div class="text-sm text-muted mb-8">本月支出分类占比（总支出 ${App.formatMoney(total)}）</div>`;

    // 简易条形图
    html += '<div class="freq-chart mb-16">';
    sorted.forEach(([cat, amount], i) => {
      const percent = (amount / total * 100).toFixed(1);
      const width = percent;
      html += `
        <div class="freq-bar-row">
          <span class="freq-bar-label">${App.escapeHtml(cat)}</span>
          <div class="freq-bar-track">
            <div class="freq-bar-fill" style="width:${width}%;background:${colors[i % colors.length]};"></div>
          </div>
          <span class="freq-bar-count">${App.formatMoney(amount)} (${percent}%)</span>
        </div>
      `;
    });
    html += '</div>';

    // 简易饼图（用CSS conic-gradient）
    let gradientParts = [];
    let cumulative = 0;
    sorted.forEach(([cat, amount], i) => {
      const percent = amount / total * 100;
      const color = colors[i % colors.length];
      gradientParts.push(`${color} ${cumulative}% ${cumulative + percent}%`);
      cumulative += percent;
    });

    html += `
      <div class="flex-row" style="justify-content:center;gap:30px;flex-wrap:wrap;">
        <div class="pie-chart" style="background: conic-gradient(${gradientParts.join(', ')});">
          <div class="pie-chart-center">
            <div class="stat-card-value" style="font-size:16px;">${App.formatMoney(total)}</div>
            <div class="stat-card-label">总支出</div>
          </div>
        </div>
        <div class="pie-legend">
          ${sorted.map(([cat, amount], i) => `
            <div class="flex-row mb-8">
              <span class="pie-legend-color" style="background:${colors[i % colors.length]};"></span>
              <span class="text-sm">${App.escapeHtml(cat)}</span>
              <span class="text-sm text-muted">${App.formatMoney(amount)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // ============ 事件绑定 ============
  function bindEvents() {
    document.getElementById('addAccountBtn').addEventListener('click', function () {
      showEditAccountModal(null);
    });

    document.getElementById('addTransactionBtn').addEventListener('click', function () {
      showAddTransactionModal();
    });

    document.querySelectorAll('.summary-view-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        currentSummaryView = this.dataset.view;
        document.querySelectorAll('.summary-view-btn').forEach(b => b.classList.remove('btn-primary'));
        this.classList.add('btn-primary');
        renderSummary();
      });
    });
  }

  return { render };
})();
