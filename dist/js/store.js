/* ============================================
 * store.js - 数据存储层
 * 统一管理 localStorage 中的所有数据
 * ============================================ */

const Store = (function () {
  const STORAGE_KEY = 'workstation_data_v1';

  // 默认数据结构
  function getDefaultData() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      currentDate: today,
      globalTimers: [], // 全局计时仓库
      exercise: {
        checkins: [] // {id, date, labels:[], timerIds:[], notes, summary, weight, fitness}
      },
      study: {
        todos: [
          { id: uid(), name: '英语学习', completed: false, date: today, deadline: '', priority: 'normal', timerIds: [], preset: true },
          { id: uid(), name: '日常阅读', completed: false, date: today, deadline: '', priority: 'normal', timerIds: [], preset: true },
          { id: uid(), name: '驾照考取', completed: false, date: today, deadline: '', priority: 'normal', timerIds: [], preset: true }
        ],
        categories: [
          { id: uid(), name: '英语' },
          { id: uid(), name: '阅读' }
        ],
        notes: [] // {id, categoryId, title, content, linkedTodoId, date, createdAt}
      },
      checklist: {
        tasks: [], // {id, quadrant:0-3, text, completed, date, recurring:'none'|'daily'|'weekly', createdAt}
        archived: []
      },
      accounting: {
        accounts: [
          { id: uid(), name: '现金', balance: 0 },
          { id: uid(), name: '微信', balance: 0 },
          { id: uid(), name: '支付宝', balance: 0 }
        ],
        transactions: [], // {id, date, accountId, type:'income'|'expense', category, subCategory, amount, note}
        expenseCategories: [
          { id: uid(), name: '吃', subCategories: ['早餐', '午餐', '晚餐', '零食', '外卖'] },
          { id: uid(), name: '穿', subCategories: ['衣服', '鞋帽', '配饰'] },
          { id: uid(), name: '住', subCategories: ['房租', '水电', '物业', '日用品'] },
          { id: uid(), name: '行', subCategories: ['公交', '地铁', '打车', '加油'] }
        ],
        incomeCategories: [
          { id: uid(), name: '工资', subCategories: [] },
          { id: uid(), name: '兼职', subCategories: [] },
          { id: uid(), name: '其他', subCategories: [] }
        ]
      },
      records: {
        boards: [
          { id: uid(), name: '随笔', type: 'note' },
          { id: uid(), name: '心情记录', type: 'mood' },
          { id: uid(), name: '图片记录', type: 'image' },
          { id: uid(), name: '习惯打卡', type: 'habit' }
        ],
        entries: [] // {id, boardId, date, content, mood, images:[base64], habitStreak, lastCheckDate}
      },
      goals: {
        exercise: { monthlyMinutes: 0, label: '月度运动目标(分钟)' },
        reading: { monthlyMinutes: 0, label: '月度阅读目标(分钟)' },
        savings: { monthlyTarget: 0, label: '月度储蓄目标(元)' }
      },
      modules: [
        { id: 'dashboard', name: '总览面板', icon: '◈', builtin: true, visible: true },
        { id: 'exercise', name: '锻炼计划', icon: '🏃', builtin: true, visible: true },
        { id: 'study', name: '学习计划', icon: '📚', builtin: true, visible: true },
        { id: 'checklist', name: '每日清单', icon: '📋', builtin: true, visible: true },
        { id: 'accounting', name: '每日记账', icon: '💰', builtin: true, visible: true },
        { id: 'records', name: '日常记录', icon: '✏️', builtin: true, visible: true }
      ],
      customPages: {}, // { pageId: [{ id, date, content, createdAt }] }
      theme: 'light'
    };
  }

  // 生成唯一ID
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  let data = null;

  // 初始化
  function init() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        data = JSON.parse(raw);
        // 合并新字段（兼容旧数据）
        const defaults = getDefaultData();
        data = deepMerge(defaults, data);
      } catch (e) {
        console.error('数据解析失败，重置为默认', e);
        data = getDefaultData();
      }
    } else {
      data = getDefaultData();
    }
    save();
  }

  // 深合并
  function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  // 保存
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // 获取全部数据
  function getAll() {
    return data;
  }

  // 获取当前日期
  function getCurrentDate() {
    return data.currentDate;
  }

  // 设置当前日期
  function setCurrentDate(date) {
    data.currentDate = date;
    save();
  }

  // ============ 全局计时仓库 ============
  function getTimers() {
    return data.globalTimers;
  }

  function getTimersByDate(date) {
    return data.globalTimers.filter(t => t.date === date);
  }

  function addTimer(timer) {
    const t = {
      id: uid(),
      name: timer.name || '未命名计时',
      mode: timer.mode || 'up', // 'up' | 'down'
      duration: timer.duration || 0, // 秒
      targetDuration: timer.targetDuration || 0, // 倒计时目标秒数
      date: timer.date || data.currentDate,
      startTime: timer.startTime || null,
      endTime: timer.endTime || null,
      source: timer.source || 'exercise', // 'exercise' | 'study'
      createdAt: Date.now()
    };
    data.globalTimers.push(t);
    save();
    return t;
  }

  function deleteTimer(id) {
    data.globalTimers = data.globalTimers.filter(t => t.id !== id);
    // 同时从锻炼打卡和学习任务中移除引用
    data.exercise.checkins.forEach(c => {
      if (c.timerIds) c.timerIds = c.timerIds.filter(tid => tid !== id);
    });
    data.study.todos.forEach(t => {
      if (t.timerIds) t.timerIds = t.timerIds.filter(tid => tid !== id);
    });
    save();
  }

  function getTimer(id) {
    return data.globalTimers.find(t => t.id === id);
  }

  // ============ 锻炼模块 ============
  function getExerciseCheckins(date) {
    return data.exercise.checkins.filter(c => c.date === date);
  }

  function getAllCheckins() {
    return data.exercise.checkins;
  }

  function addExerciseCheckin(checkin) {
    const c = {
      id: uid(),
      date: checkin.date || data.currentDate,
      labels: checkin.labels || [],
      timerIds: checkin.timerIds || [],
      notes: checkin.notes || '',
      summary: checkin.summary || '',
      weight: checkin.weight || '',
      fitness: checkin.fitness || '',
      createdAt: Date.now()
    };
    data.exercise.checkins.push(c);
    save();
    return c;
  }

  function updateExerciseCheckin(id, updates) {
    const c = data.exercise.checkins.find(c => c.id === id);
    if (c) {
      Object.assign(c, updates);
      save();
    }
    return c;
  }

  function deleteExerciseCheckin(id) {
    data.exercise.checkins = data.exercise.checkins.filter(c => c.id !== id);
    save();
  }

  // ============ 学习模块 ============
  function getStudyTodos() {
    return data.study.todos;
  }

  function getStudyTodosByDate(date) {
    // 预置任务始终显示；自定义任务按日期
    return data.study.todos.filter(t => t.preset || t.date === date);
  }

  function addStudyTodo(todo) {
    const t = {
      id: uid(),
      name: todo.name,
      completed: false,
      date: todo.date || data.currentDate,
      deadline: todo.deadline || '',
      priority: todo.priority || 'normal',
      timerIds: [],
      preset: false,
      createdAt: Date.now()
    };
    data.study.todos.push(t);
    save();
    return t;
  }

  function updateStudyTodo(id, updates) {
    const t = data.study.todos.find(t => t.id === id);
    if (t) {
      Object.assign(t, updates);
      save();
    }
    return t;
  }

  function deleteStudyTodo(id) {
    data.study.todos = data.study.todos.filter(t => t.id !== id);
    save();
  }

  function getStudyCategories() {
    return data.study.categories;
  }

  function addStudyCategory(name) {
    const c = { id: uid(), name: name };
    data.study.categories.push(c);
    save();
    return c;
  }

  function deleteStudyCategory(id) {
    data.study.categories = data.study.categories.filter(c => c.id !== id);
    data.study.notes = data.study.notes.filter(n => n.categoryId !== id);
    save();
  }

  function updateStudyCategory(id, name) {
    const c = data.study.categories.find(c => c.id === id);
    if (c) { c.name = name; save(); }
  }

  function getStudyNotes(categoryId) {
    if (categoryId) return data.study.notes.filter(n => n.categoryId === categoryId);
    return data.study.notes;
  }

  function addStudyNote(note) {
    const n = {
      id: uid(),
      categoryId: note.categoryId,
      title: note.title || '无标题',
      content: note.content || '',
      linkedTodoId: note.linkedTodoId || null,
      date: note.date || data.currentDate,
      createdAt: Date.now()
    };
    data.study.notes.push(n);
    save();
    return n;
  }

  function updateStudyNote(id, updates) {
    const n = data.study.notes.find(n => n.id === id);
    if (n) { Object.assign(n, updates); save(); }
    return n;
  }

  function deleteStudyNote(id) {
    data.study.notes = data.study.notes.filter(n => n.id !== id);
    save();
  }

  // ============ 每日清单 ============
  function getChecklistTasks(date) {
    return data.checklist.tasks.filter(t => t.date === date);
  }

  function addChecklistTask(task) {
    const t = {
      id: uid(),
      quadrant: task.quadrant || 0,
      text: task.text,
      completed: false,
      date: task.date || data.currentDate,
      recurring: task.recurring || 'none',
      createdAt: Date.now()
    };
    data.checklist.tasks.push(t);
    // 如果是循环任务，自动生成未来7天的副本
    if (t.recurring !== 'none') {
      generateRecurringTasks(t);
    }
    save();
    return t;
  }

  function generateRecurringTasks(task) {
    const baseDate = new Date(task.date);
    for (let i = 1; i <= 7; i++) {
      const d = new Date(baseDate);
      if (task.recurring === 'daily') {
        d.setDate(d.getDate() + i);
      } else if (task.recurring === 'weekly') {
        d.setDate(d.getDate() + i * 7);
      }
      const dateStr = d.toISOString().slice(0, 10);
      // 避免重复
      const exists = data.checklist.tasks.some(
        t => t.date === dateStr && t.text === task.text && t.quadrant === task.quadrant && t.recurring === task.recurring
      );
      if (!exists) {
        data.checklist.tasks.push({
          ...task,
          id: uid(),
          date: dateStr,
          completed: false,
          createdAt: Date.now()
        });
      }
    }
  }

  function updateChecklistTask(id, updates) {
    const t = data.checklist.tasks.find(t => t.id === id);
    if (t) {
      Object.assign(t, updates);
      // 如果标记为完成，归档
      if (updates.completed === true) {
        data.checklist.archived.push({ ...t });
        data.checklist.tasks = data.checklist.tasks.filter(task => task.id !== id);
      }
      save();
    }
    return t;
  }

  function deleteChecklistTask(id) {
    data.checklist.tasks = data.checklist.tasks.filter(t => t.id !== id);
    save();
  }

  function getArchivedTasks(date) {
    return data.checklist.archived.filter(t => t.date === date);
  }

  // ============ 记账模块 ============
  function getAccounts() {
    return data.accounting.accounts;
  }

  function addAccount(name) {
    const a = { id: uid(), name: name, balance: 0 };
    data.accounting.accounts.push(a);
    save();
    return a;
  }

  function updateAccount(id, updates) {
    const a = data.accounting.accounts.find(a => a.id === id);
    if (a) { Object.assign(a, updates); save(); }
    return a;
  }

  function deleteAccount(id) {
    data.accounting.accounts = data.accounting.accounts.filter(a => a.id !== id);
    save();
  }

  function getTransactions(date) {
    if (date) return data.accounting.transactions.filter(t => t.date === date);
    return data.accounting.transactions;
  }

  function getTransactionsByMonth(yearMonth) {
    return data.accounting.transactions.filter(t => t.date.startsWith(yearMonth));
  }

  function getTransactionsByYear(year) {
    return data.accounting.transactions.filter(t => t.date.startsWith(year));
  }

  function addTransaction(tx) {
    const t = {
      id: uid(),
      date: tx.date || data.currentDate,
      accountId: tx.accountId,
      type: tx.type, // 'income' | 'expense'
      category: tx.category,
      subCategory: tx.subCategory || '',
      amount: parseFloat(tx.amount) || 0,
      note: tx.note || '',
      createdAt: Date.now()
    };
    data.accounting.transactions.push(t);
    // 更新账户余额
    const acc = data.accounting.accounts.find(a => a.id === t.accountId);
    if (acc) {
      if (t.type === 'income') acc.balance += t.amount;
      else acc.balance -= t.amount;
    }
    save();
    return t;
  }

  function deleteTransaction(id) {
    const t = data.accounting.transactions.find(t => t.id === id);
    if (t) {
      // 回滚账户余额
      const acc = data.accounting.accounts.find(a => a.id === t.accountId);
      if (acc) {
        if (t.type === 'income') acc.balance -= t.amount;
        else acc.balance += t.amount;
      }
    }
    data.accounting.transactions = data.accounting.transactions.filter(t => t.id !== id);
    save();
  }

  function getExpenseCategories() {
    return data.accounting.expenseCategories;
  }

  function addExpenseSubCategory(catId, subName) {
    const cat = data.accounting.expenseCategories.find(c => c.id === catId);
    if (cat) {
      if (!cat.subCategories.includes(subName)) {
        cat.subCategories.push(subName);
        save();
      }
    }
  }

  function deleteExpenseSubCategory(catId, subName) {
    const cat = data.accounting.expenseCategories.find(c => c.id === catId);
    if (cat) {
      cat.subCategories = cat.subCategories.filter(s => s !== subName);
      save();
    }
  }

  function getIncomeCategories() {
    return data.accounting.incomeCategories;
  }

  // ============ 日常记录 ============
  function getRecordBoards() {
    return data.records.boards;
  }

  function addRecordBoard(name, type) {
    const b = { id: uid(), name: name, type: type };
    data.records.boards.push(b);
    save();
    return b;
  }

  function updateRecordBoard(id, updates) {
    const b = data.records.boards.find(b => b.id === id);
    if (b) { Object.assign(b, updates); save(); }
    return b;
  }

  function deleteRecordBoard(id) {
    data.records.boards = data.records.boards.filter(b => b.id !== id);
    data.records.entries = data.records.entries.filter(e => e.boardId !== id);
    save();
  }

  function getRecordEntries(boardId, date) {
    let entries = data.records.entries;
    if (boardId) entries = entries.filter(e => e.boardId === boardId);
    if (date) entries = entries.filter(e => e.date === date);
    return entries;
  }

  function addRecordEntry(entry) {
    const e = {
      id: uid(),
      boardId: entry.boardId,
      date: entry.date || data.currentDate,
      content: entry.content || '',
      mood: entry.mood || '',
      images: entry.images || [],
      habitStreak: entry.habitStreak || 0,
      lastCheckDate: entry.lastCheckDate || null,
      habitPeriod: entry.habitPeriod || 'daily',
      createdAt: Date.now()
    };
    data.records.entries.push(e);
    save();
    return e;
  }

  function updateRecordEntry(id, updates) {
    const e = data.records.entries.find(e => e.id === id);
    if (e) { Object.assign(e, updates); save(); }
    return e;
  }

  function deleteRecordEntry(id) {
    data.records.entries = data.records.entries.filter(e => e.id !== id);
    save();
  }

  // ============ 目标管理 ============
  function getGoals() {
    return data.goals;
  }

  function updateGoals(updates) {
    Object.assign(data.goals, updates);
    save();
  }

  // ============ 主题 ============
  function getTheme() {
    return data.theme;
  }

  function setTheme(theme) {
    data.theme = theme;
    save();
  }

  // ============ 模块管理 ============
  function getModules() {
    return data.modules || [];
  }

  function updateModule(id, updates) {
    const m = data.modules.find(m => m.id === id);
    if (m) {
      Object.assign(m, updates);
      save();
    }
  }

  function addCustomModule(name, icon) {
    const id = 'custom_' + uid();
    data.modules.push({ id, name, icon: icon || '📝', builtin: false, visible: true });
    data.customPages[id] = [];
    save();
    return id;
  }

  function deleteCustomModule(id) {
    data.modules = data.modules.filter(m => m.id !== id);
    delete data.customPages[id];
    save();
  }

  // ============ 自定义页面数据 ============
  function getCustomPageEntries(pageId) {
    if (!data.customPages) data.customPages = {};
    return data.customPages[pageId] || [];
  }

  function getCustomPageEntriesByDate(pageId, date) {
    return (data.customPages[pageId] || []).filter(e => e.date === date);
  }

  function addCustomPageEntry(pageId, content) {
    if (!data.customPages[pageId]) data.customPages[pageId] = [];
    const entry = {
      id: uid(),
      date: data.currentDate,
      content: content,
      createdAt: Date.now()
    };
    data.customPages[pageId].push(entry);
    save();
    return entry;
  }

  function deleteCustomPageEntry(pageId, entryId) {
    if (!data.customPages[pageId]) return;
    data.customPages[pageId] = data.customPages[pageId].filter(e => e.id !== entryId);
    save();
  }

  // ============ 全局搜索 ============
  function search(keyword) {
    if (!keyword.trim()) return [];
    const kw = keyword.toLowerCase();
    const results = [];

    // 搜索学习笔记
    data.study.notes.forEach(n => {
      if (n.title.toLowerCase().includes(kw) || n.content.toLowerCase().includes(kw)) {
        results.push({
          type: '学习笔记',
          module: 'study',
          content: n.title + (n.content ? ' - ' + n.content.slice(0, 50) : ''),
          id: n.id,
          date: n.date
        });
      }
    });

    // 搜索待学任务
    data.study.todos.forEach(t => {
      if (t.name.toLowerCase().includes(kw)) {
        results.push({
          type: '待学任务',
          module: 'study',
          content: t.name,
          id: t.id,
          date: t.date
        });
      }
    });

    // 搜索账单
    data.accounting.transactions.forEach(t => {
      const text = (t.category + ' ' + t.subCategory + ' ' + t.note + ' ' + t.amount).toLowerCase();
      if (text.includes(kw)) {
        results.push({
          type: '账单记录',
          module: 'accounting',
          content: `${t.type === 'expense' ? '支出' : '收入'} ${t.category}-${t.subCategory} ¥${t.amount} ${t.note}`,
          id: t.id,
          date: t.date
        });
      }
    });

    // 搜索训练日志
    data.exercise.checkins.forEach(c => {
      const text = (c.labels.join(' ') + ' ' + c.notes + ' ' + c.summary).toLowerCase();
      if (text.includes(kw)) {
        results.push({
          type: '训练日志',
          module: 'exercise',
          content: c.labels.join('、') + (c.notes ? ' - ' + c.notes.slice(0, 50) : ''),
          id: c.id,
          date: c.date
        });
      }
    });

    // 搜索待办清单
    data.checklist.tasks.forEach(t => {
      if (t.text.toLowerCase().includes(kw)) {
        results.push({
          type: '待办事项',
          module: 'checklist',
          content: t.text,
          id: t.id,
          date: t.date
        });
      }
    });

    // 搜索日常记录
    data.records.entries.forEach(e => {
      if (e.content.toLowerCase().includes(kw)) {
        results.push({
          type: '日常记录',
          module: 'records',
          content: e.content.slice(0, 60),
          id: e.id,
          date: e.date
        });
      }
    });

    return results;
  }

  // ============ 数据导出 ============
  function exportData(format) {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `workstation_backup_${data.currentDate}.json`);
    } else if (format === 'csv') {
      const csv = generateCSV();
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `workstation_export_${data.currentDate}.csv`);
    } else if (format === 'txt') {
      const txt = generateTXT();
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      downloadBlob(blob, `workstation_export_${data.currentDate}.txt`);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function generateCSV() {
    let csv = '';
    // 计时记录
    csv += '=== 计时记录 ===\n';
    csv += '名称,模式,时长(秒),日期,来源\n';
    data.globalTimers.forEach(t => {
      csv += `"${t.name}","${t.mode === 'up' ? '正计时' : '倒计时'}",${t.duration},${t.date},${t.source}\n`;
    });
    // 账单
    csv += '\n=== 账单记录 ===\n';
    csv += '日期,类型,分类,子分类,金额,备注\n';
    data.accounting.transactions.forEach(t => {
      csv += `${t.date},${t.type === 'expense' ? '支出' : '收入'},"${t.category}","${t.subCategory}",${t.amount},"${t.note}"\n`;
    });
    // 训练
    csv += '\n=== 训练记录 ===\n';
    csv += '日期,训练标签,备注,总结,体重\n';
    data.exercise.checkins.forEach(c => {
      csv += `${c.date},"${c.labels.join('、')}","${c.notes}","${c.summary}","${c.weight}"\n`;
    });
    // 清单
    csv += '\n=== 待办清单 ===\n';
    csv += '日期,象限,内容,是否完成,循环\n';
    [...data.checklist.tasks, ...data.checklist.archived].forEach(t => {
      const qNames = ['重要且紧急', '重要不紧急', '不重要紧急', '不重要不紧急'];
      csv += `${t.date},"${qNames[t.quadrant]}","${t.text}",${t.completed ? '是' : '否'},${t.recurring}\n`;
    });
    return csv;
  }

  function generateTXT() {
    let txt = '个人综合工作台 - 数据导出\n';
    txt += `导出日期: ${new Date().toLocaleString('zh-CN')}\n`;
    txt += `${'='.repeat(50)}\n\n`;

    txt += '一、计时记录\n';
    txt += '-'.repeat(30) + '\n';
    data.globalTimers.forEach(t => {
      const mins = Math.floor(t.duration / 60);
      const secs = t.duration % 60;
      txt += `[${t.date}] ${t.name} (${t.source}) - ${t.mode === 'up' ? '正计时' : '倒计时'} ${mins}分${secs}秒\n`;
    });

    txt += '\n二、训练打卡\n';
    txt += '-'.repeat(30) + '\n';
    data.exercise.checkins.forEach(c => {
      txt += `[${c.date}] 训练: ${c.labels.join('、')}\n`;
      if (c.notes) txt += `  备注: ${c.notes}\n`;
      if (c.summary) txt += `  总结: ${c.summary}\n`;
      if (c.weight) txt += `  体重: ${c.weight}kg\n`;
    });

    txt += '\n三、学习任务\n';
    txt += '-'.repeat(30) + '\n';
    data.study.todos.forEach(t => {
      txt += `${t.completed ? '✓' : '○'} ${t.name}`;
      if (t.deadline) txt += ` (截止: ${t.deadline})`;
      txt += '\n';
    });

    txt += '\n四、学习笔记\n';
    txt += '-'.repeat(30) + '\n';
    data.study.notes.forEach(n => {
      txt += `【${n.title}】(${n.date})\n${n.content}\n\n`;
    });

    txt += '\n五、待办清单\n';
    txt += '-'.repeat(30) + '\n';
    const qNames = ['重要且紧急', '重要不紧急', '不重要紧急', '不重要不紧急'];
    [...data.checklist.tasks, ...data.checklist.archived].forEach(t => {
      txt += `[${t.date}] [${qNames[t.quadrant]}] ${t.completed ? '✓' : '○'} ${t.text}\n`;
    });

    txt += '\n六、账单记录\n';
    txt += '-'.repeat(30) + '\n';
    data.accounting.transactions.forEach(t => {
      txt += `[${t.date}] ${t.type === 'expense' ? '支出' : '收入'} ${t.category}-${t.subCategory} ¥${t.amount}`;
      if (t.note) txt += ` (${t.note})`;
      txt += '\n';
    });

    txt += '\n七、日常记录\n';
    txt += '-'.repeat(30) + '\n';
    data.records.entries.forEach(e => {
      txt += `[${e.date}] `;
      if (e.mood) txt += `[心情:${e.mood}] `;
      txt += `${e.content}\n`;
    });

    return txt;
  }

  return {
    init,
    save,
    getAll,
    getCurrentDate,
    setCurrentDate,
    uid,
    // 计时
    getTimers,
    getTimersByDate,
    addTimer,
    deleteTimer,
    getTimer,
    // 锻炼
    getExerciseCheckins,
    getAllCheckins,
    addExerciseCheckin,
    updateExerciseCheckin,
    deleteExerciseCheckin,
    // 学习
    getStudyTodos,
    getStudyTodosByDate,
    addStudyTodo,
    updateStudyTodo,
    deleteStudyTodo,
    getStudyCategories,
    addStudyCategory,
    deleteStudyCategory,
    updateStudyCategory,
    getStudyNotes,
    addStudyNote,
    updateStudyNote,
    deleteStudyNote,
    // 清单
    getChecklistTasks,
    addChecklistTask,
    updateChecklistTask,
    deleteChecklistTask,
    getArchivedTasks,
    // 记账
    getAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    getTransactions,
    getTransactionsByMonth,
    getTransactionsByYear,
    addTransaction,
    deleteTransaction,
    getExpenseCategories,
    addExpenseSubCategory,
    deleteExpenseSubCategory,
    getIncomeCategories,
    // 记录
    getRecordBoards,
    addRecordBoard,
    updateRecordBoard,
    deleteRecordBoard,
    getRecordEntries,
    addRecordEntry,
    updateRecordEntry,
    deleteRecordEntry,
    // 目标
    getGoals,
    updateGoals,
    // 主题
    getTheme,
    setTheme,
    // 模块管理
    getModules,
    updateModule,
    addCustomModule,
    deleteCustomModule,
    // 自定义页面
    getCustomPageEntries,
    getCustomPageEntriesByDate,
    addCustomPageEntry,
    deleteCustomPageEntry,
    // 搜索
    search,
    // 导出
    exportData
  };
})();
