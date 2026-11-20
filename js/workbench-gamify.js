/* ============================================================================
 * 高中化学 3D 考点工作台 — 游戏化：连胜 / 今日目标 / 经验值（工作流 4 / D 组）
 * 配套样式：css/workbench-learn.css（.wbl-game*）。
 *
 * 纯前端 localStorage 实现，与现有进度系统打通——只读现有进度键，
 * 不另起一套冲突的学习进度数据：
 *   读（原有键，全部只读、不写）：
 *     chem3d_visited   {kind:id: 1}            浏览过的考点（inline-08-ui.js）
 *     chem3d_recent    [{k,i,t}]               最近浏览（带时间戳）
 *     chem3d_quiz_<id> {score,total,ts}        课后练习/预习自测最佳成绩
 *     chem3d_pv_<id>   {ts}                    预习自测完成标记
 *     chem3d_expdone   {expId: ...}            实验观察完成
 *     chem3d_favs      {kind:id: true}         收藏
 *     chem_exam_space_v1（真题空间错题本，只读错题数用于展示）
 *   写（本模块自己的键，只存游戏化状态，不存学习进度本身）：
 *     chem3d_v2_gamify_v1
 *       { xp, days: {YYYY-MM-DD: {items, questions, flash, xp, bonus}},
 *         seenVisited: {kind:id: 1}, seenQuiz: {id: score},
 *         goalItems, goalQuestions }
 *     chem3d_v2_ 前缀受 js/auth.js 的按账号隔离换入换出保护。
 *
 * 经验规则（写在界面上，公开透明）：
 *   首次浏览一个考点 +5 · 完成一次自测 +10（刷新最佳成绩再 +5）·
 *   闪卡复习一张 +2 · “讲给 AI 听”一次 +10 · 每日目标全部达成 +20。
 * 等级：每 100 XP 升一级（Lv.1 从 0 XP 起）。
 * 每日目标：默认每日 3 个新考点 / 10 道题，可在首页条上直接改。
 *
 * 事件联动：监听 window CustomEvent('chem:learn')（闪卡/费曼模块派发）
 * 计经验；同时监听 'chem:context'（每次选考点/回首页都会派发）做增量
 * 同步——比较 chem3d_visited / chem3d_quiz_* 与 seen 快照的差值发奖。
 *
 * 接口预留（接真实后端时）：ChemGamify.exportState()/importState(json)
 * 可与云端同步接口对接；当前版本只做本地导入导出。
 * ========================================================================== */
(function () {
'use strict';

/* ---------- 通用小工具 ---------- */
function $(id) { return document.getElementById(id); }
function lsGet(key) {
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}
function lsGetJSON(key, fallback) {
  try {
    var v = JSON.parse(lsGet(key) || 'null');
    return v && typeof v === 'object' ? v : fallback;
  } catch (e) { return fallback; }
}
function lsSetJSON(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function todayKey(d) {
  d = d || new Date();
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}
function shiftDay(key, delta) {
  var parts = key.split('-');
  var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  d.setDate(d.getDate() + delta);
  return todayKey(d);
}
function isToday(ts) { return todayKey(new Date(ts)) === todayKey(); }

/* ---------- 常量与状态 ---------- */
var STATE_KEY = 'chem3d_v2_gamify_v1';
var XP_NEW_ITEM = 5;
var XP_QUIZ_DONE = 10;
var XP_QUIZ_BEST = 5;
var XP_DAILY_BONUS = 20;
var XP_PER_LEVEL = 100;
var GOAL_ITEM_OPTIONS = [1, 3, 5];
var GOAL_Q_OPTIONS = [5, 10, 20];

function defaultState() {
  return { xp: 0, days: {}, seenVisited: {}, seenQuiz: {},
    goalItems: 3, goalQuestions: 10 };
}
function loadState() {
  var st = lsGetJSON(STATE_KEY, null);
  if (!st || typeof st !== 'object') return defaultState();
  if (typeof st.xp !== 'number') st.xp = 0;
  if (!st.days || typeof st.days !== 'object') st.days = {};
  if (!st.seenVisited || typeof st.seenVisited !== 'object') st.seenVisited = {};
  if (!st.seenQuiz || typeof st.seenQuiz !== 'object') st.seenQuiz = {};
  if (GOAL_ITEM_OPTIONS.indexOf(st.goalItems) === -1) st.goalItems = 3;
  if (GOAL_Q_OPTIONS.indexOf(st.goalQuestions) === -1) st.goalQuestions = 10;
  return st;
}
function saveState(st) { lsSetJSON(STATE_KEY, st); }
function levelFor(xp) { return 1 + Math.floor(Math.max(0, xp) / XP_PER_LEVEL); }
function dayLog(st, day) {
  if (!st.days[day]) st.days[day] = { items: 0, questions: 0, flash: 0, xp: 0, bonus: false };
  return st.days[day];
}
/* 活跃日：当天有任意学习行为（新考点/做题/闪卡/费曼均计入 days 记录）。 */
function activeDays(st) {
  return Object.keys(st.days).filter(function (d) {
    var l = st.days[d];
    return l && (l.items > 0 || l.questions > 0 || l.flash > 0 || l.xp > 0);
  });
}
function streakOf(st) {
  var active = {};
  activeDays(st).forEach(function (d) { active[d] = 1; });
  var today = todayKey();
  var cursor = active[today] ? today : shiftDay(today, -1);
  if (!active[cursor]) return 0;
  var n = 0;
  while (active[cursor]) { n += 1; cursor = shiftDay(cursor, -1); }
  return n;
}

/* ---------- 读现有进度键（只读） ---------- */
function readVisited() { return lsGetJSON('chem3d_visited', {}); }
function readQuizResults() {
  var out = {};
  try {
    for (var i = 0; i < window.localStorage.length; i++) {
      var k = window.localStorage.key(i);
      if (k && k.indexOf('chem3d_quiz_') === 0) {
        var v = lsGetJSON(k, null);
        if (v && typeof v.score === 'number') out[k.slice('chem3d_quiz_'.length)] = v;
      }
    }
  } catch (e) { /* 忽略 */ }
  return out;
}
function readProgressSummary() {
  var visited = readVisited();
  var quizzes = readQuizResults();
  var passed = 0, answered = 0;
  Object.keys(quizzes).forEach(function (id) {
    var q = quizzes[id];
    answered += q.total || 0;
    if (q.total && q.score >= Math.ceil(q.total * 0.75)) passed += 1;
  });
  var expDone = lsGetJSON('chem3d_expdone', {});
  var favs = lsGetJSON('chem3d_favs', {});
  var total = 0;
  try {
    var db = window.DB || {};
    total = (db.subs || []).length + (db.app || []).length +
      (db.mols || []).length + (db.exps || []).length;
  } catch (e) {}
  return { visitedN: Object.keys(visited).length, total: total,
    quizDone: Object.keys(quizzes).length, quizPassed: passed,
    questionsAnswered: answered,
    expDoneN: Object.keys(expDone).length, favN: Object.keys(favs).length };
}

/* ---------- 增量同步：比较快照差值发奖 ---------- */
function award(st, day, xp, field, n) {
  var log = dayLog(st, day);
  st.xp += xp;
  log.xp += xp;
  if (field && n) log[field] += n;
  return log;
}
function maybeDailyBonus(st, day) {
  var log = dayLog(st, day);
  if (log.bonus) return false;
  if (log.items >= st.goalItems && log.questions >= st.goalQuestions) {
    log.bonus = true;
    st.xp += XP_DAILY_BONUS;
    log.xp += XP_DAILY_BONUS;
    return true;
  }
  return false;
}
/* 首次同步时：已浏览的旧考点不补发经验（只做快照），避免老用户一夜暴富；
 * 之后的新增浏览与新完成的自测才发奖。seedToday=true 时把“今天已有”
 * 的活动记入今日日志（用 recent/quiz 的时间戳判断）。 */
function syncFromProgress(seedToday) {
  var st = loadState();
  var changed = false;
  var today = todayKey();
  var firstRun = Object.keys(st.seenVisited).length === 0 && st.xp === 0 &&
    Object.keys(st.days).length === 0;
  var visited = readVisited();
  var newItems = [];
  Object.keys(visited).forEach(function (k) {
    if (!st.seenVisited[k]) { st.seenVisited[k] = 1; newItems.push(k); changed = true; }
  });
  if (!firstRun && newItems.length) {
    newItems.forEach(function () { award(st, today, XP_NEW_ITEM, 'items', 1); });
  }
  var quizzes = readQuizResults();
  Object.keys(quizzes).forEach(function (id) {
    var q = quizzes[id];
    var prev = st.seenQuiz[id];
    if (prev == null) {
      st.seenQuiz[id] = q.score;
      changed = true;
      if (!firstRun) {
        award(st, today, XP_QUIZ_DONE, 'questions', q.total || 0);
      }
    } else if (q.score > prev) {
      st.seenQuiz[id] = q.score;
      changed = true;
      award(st, today, XP_QUIZ_BEST, 'questions', 0);
    }
  });
  if (seedToday && firstRun) {
    /* 用现有时间戳把“今天已有的活动”记入今日日志（不发追溯经验）。 */
    var log = dayLog(st, today);
    var recent = lsGetJSON('chem3d_recent', []);
    var todayItems = 0;
    if (Array.isArray(recent)) {
      recent.forEach(function (r) { if (r && r.t && isToday(r.t)) todayItems += 1; });
    }
    if (todayItems) log.items = todayItems;
    Object.keys(quizzes).forEach(function (id) {
      var q = quizzes[id];
      if (q.ts && isToday(q.ts)) log.questions += q.total || 0;
    });
    if (log.items || log.questions) changed = true;
  }
  if (maybeDailyBonus(st, today)) changed = true;
  if (changed) saveState(st);
  return st;
}

function onLearnEvent(e) {
  var d = (e && e.detail) || {};
  if (!d.type) return;
  var st = loadState();
  var today = todayKey();
  var before = levelFor(st.xp);
  if (d.type === 'flashcard') {
    award(st, today, d.xp || 2, 'flash', 1);
  } else if (d.type === 'feynman') {
    /* 费曼讲解计经验与活跃日，但不计入新考点/做题数。 */
    award(st, today, d.xp || 10, null, 0);
  } else {
    return;
  }
  var bonus = maybeDailyBonus(st, today);
  saveState(st);
  refreshStrip();
  if (levelFor(st.xp) > before) toast('升级啦！现在是 Lv.' + levelFor(st.xp) + ' 🎉');
  else if (bonus) toast('今日目标全部达成，+20 经验 🎉');
}
function toast(msg) {
  var t = $('toast');
  if (t) {
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 3000);
  }
}

/* ---------- 首页条 UI ---------- */
function homeRoot() {
  var doc = $('docBody');
  if (!doc || !doc.querySelector('.learn-card')) return null;
  return doc;
}
function ringSVG(ratio) {
  var r = 26, c = 2 * Math.PI * r;
  var off = c * (1 - Math.max(0, Math.min(1, ratio)));
  return '<svg class="wbl-game-ring" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="今日目标完成 ' +
    Math.round(ratio * 100) + '%">' +
    '<circle cx="32" cy="32" r="' + r + '" class="wbl-game-ring-bg"/>' +
    '<circle cx="32" cy="32" r="' + r + '" class="wbl-game-ring-fg" ' +
    'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
    '<text x="32" y="36" class="wbl-game-ring-text">' + Math.round(ratio * 100) + '%</text></svg>';
}
function refreshStrip() {
  var doc = homeRoot();
  if (!doc) return;
  var st = syncFromProgress(false);
  var today = todayKey();
  var log = dayLog(st, today);
  var streak = streakOf(st);
  var level = levelFor(st.xp);
  var inLevel = st.xp % XP_PER_LEVEL;
  var itemRatio = st.goalItems ? log.items / st.goalItems : 1;
  var qRatio = st.goalQuestions ? log.questions / st.goalQuestions : 1;
  var ratio = Math.min(1, (Math.min(1, itemRatio) + Math.min(1, qRatio)) / 2);
  var summary = readProgressSummary();
  var flashDue = 0;
  try {
    if (window.ChemFlashcards) flashDue = window.ChemFlashcards.counts().total;
  } catch (e) {}
  var strip = doc.querySelector('[data-wbl-game-strip]');
  if (!strip) {
    strip = document.createElement('section');
    strip.className = 'wbl-game-strip';
    strip.setAttribute('data-wbl-game-strip', '1');
    strip.setAttribute('aria-label', '学习连胜与今日目标');
    var title = doc.querySelector('.title');
    if (title && title.nextSibling) doc.insertBefore(strip, title.nextSibling);
    else doc.insertBefore(strip, doc.firstChild);
  }
  strip.innerHTML =
    '<div class="wbl-game-cell wbl-game-streak"><span class="wbl-game-flame">🔥</span>' +
      '<div><strong>' + streak + ' 天</strong><small>学习连胜</small></div></div>' +
    '<div class="wbl-game-cell wbl-game-goal">' + ringSVG(ratio) +
      '<div><strong>今日目标</strong>' +
      '<small>' + Math.min(log.items, st.goalItems) + ' / ' + st.goalItems + ' 个新考点 · ' +
      Math.min(log.questions, st.goalQuestions) + ' / ' + st.goalQuestions + ' 道题</small>' +
      '<span class="wbl-game-goal-edit">目标：' +
        '<select data-wbl-goal-items aria-label="每日新考点目标">' +
          GOAL_ITEM_OPTIONS.map(function (n) {
            return '<option value="' + n + '"' + (n === st.goalItems ? ' selected' : '') + '>' + n + ' 考点</option>';
          }).join('') +
        '</select>' +
        '<select data-wbl-goal-q aria-label="每日做题目标">' +
          GOAL_Q_OPTIONS.map(function (n) {
            return '<option value="' + n + '"' + (n === st.goalQuestions ? ' selected' : '') + '>' + n + ' 道题</option>';
          }).join('') +
        '</select></span></div></div>' +
    '<div class="wbl-game-cell wbl-game-xp"><div><strong>Lv.' + level + '</strong>' +
      '<small>' + st.xp + ' 经验 · 距下一级还差 ' + (XP_PER_LEVEL - inLevel) + ' XP</small></div>' +
      '<div class="wbl-game-xpbar"><i style="width:' + Math.round(inLevel / XP_PER_LEVEL * 100) + '%"></i></div>' +
      '<small class="wbl-game-rules">新考点 +5 · 自测 +10 · 闪卡 +2 · 讲给 AI 听 +10 · 达成今日目标 +20</small></div>' +
    '<div class="wbl-game-cell wbl-game-links">' +
      '<button class="btn-main" type="button" data-learn-flash>🃏 闪卡复习' +
        (flashDue > 0 ? '（' + flashDue + ' 张待复习）' : '') + '</button>' +
      '<small>已浏览 ' + summary.visitedN + (summary.total ? ' / ' + summary.total : '') +
      ' 个考点 · 自测完成 ' + summary.quizDone + ' 个</small></div>';
  var selItems = strip.querySelector('[data-wbl-goal-items]');
  var selQ = strip.querySelector('[data-wbl-goal-q]');
  if (selItems) selItems.addEventListener('change', function () {
    var s2 = loadState();
    s2.goalItems = parseInt(selItems.value, 10) || 3;
    maybeDailyBonus(s2, todayKey());
    saveState(s2);
    refreshStrip();
  });
  if (selQ) selQ.addEventListener('change', function () {
    var s2 = loadState();
    s2.goalQuestions = parseInt(selQ.value, 10) || 10;
    maybeDailyBonus(s2, todayKey());
    saveState(s2);
    refreshStrip();
  });
}

/* ---------- 初始化 ---------- */
function init() {
  syncFromProgress(true);
  refreshStrip();
  var doc = $('docBody');
  if (doc && window.MutationObserver) {
    var timer = 0;
    new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(refreshStrip, 60);
    }).observe(doc, { childList: true });
  }
  window.addEventListener('chem:context', function () {
    syncFromProgress(false);
    setTimeout(refreshStrip, 60);
  });
  window.addEventListener('chem:learn', onLearnEvent);
  /* 从其他标签页回来时同步一次（storage 事件只在跨标签时触发）。 */
  window.addEventListener('storage', function (e) {
    if (e && e.key && e.key.indexOf('chem3d_') === 0) {
      syncFromProgress(false);
      refreshStrip();
    }
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ---------------- 对外接口 ---------------- */
window.ChemGamify = {
  getState: function () { return loadState(); },
  getStreak: function () { return streakOf(loadState()); },
  getLevel: function () { return levelFor(loadState().xp); },
  todayLog: function () { return dayLog(loadState(), todayKey()); },
  progressSummary: readProgressSummary,
  sync: function () { return syncFromProgress(false); },
  refresh: refreshStrip,
  /* 手动记一笔经验（供以后其他模块调用；type 仅用于统计展示）。 */
  award: function (xp, type) {
    var st = loadState();
    award(st, todayKey(), xp || 0, null, 0);
    maybeDailyBonus(st, todayKey());
    saveState(st);
    refreshStrip();
    return st.xp;
  },
  exportState: function () { return JSON.stringify(loadState()); },
  importState: function (json) {
    try {
      var st = JSON.parse(json);
      if (!st || typeof st.xp !== 'number') return false;
      saveState(st);
      refreshStrip();
      return true;
    } catch (e) { return false; }
  }
};

})();
