/* ============================================================================
 * 高中化学 3D 考点工作台 — 闪卡复习 + FSRS 间隔重复（工作流 4 / D 组）
 * 配套样式：css/workbench-learn.css（.wbl-flash*）。
 *
 * 表现层 + 本地学习模块，不改动任何原有逻辑与数据：
 *   - 卡片内容只来自现有考点数据（window.DB.subs / app / mols / exps
 *     的 name / formula / desc / info / props / principle / uses），
 *     不编造任何新内容；卡片在运行时由数据派生，不复制进代码。
 *   - 间隔重复用 FSRS-4.5 简化调度（纯前端实现，默认权重参数），
 *     每张卡的记忆状态（难度 / 稳定性 / 到期时间 / 复习次数）只存本机
 *     localStorage（键 chem3d_v2_flash_v1，chem3d_v2_ 前缀，受
 *     js/auth.js 的按账号隔离换入换出保护）。
 *   - 评分只有两档：“再来一次”（FSRS Again=1）/“认识了”
 *     （FSRS Good=3），与任务要求一致。
 *   - 复习一张卡后派发 window CustomEvent('chem:learn',
 *     {detail:{type:'flashcard', xp:2}})，供 D 组游戏化模块计经验；
 *     本模块不依赖游戏化模块是否加载。
 *
 * 接口预留（接真实后端时）：
 *   - ChemFlashcards.exportState() / importState(json)：导出/导入全部
 *     卡片状态，供以后与云端同步接口对接；当前版本只做本地导入导出。
 *   - ChemFlashcards.setScheduler(fn)：替换调度函数（例如改用服务端
 *     下发的 FSRS 参数）；默认调度见 schedule()。
 * ========================================================================== */
(function () {
'use strict';

/* ---------- 通用小工具 ---------- */
function $(id) { return document.getElementById(id); }
function storeGetJSON(key, fallback) {
  try {
    var v = JSON.parse(window.localStorage.getItem(key) || 'null');
    return v && typeof v === 'object' ? v : fallback;
  } catch (e) { return fallback; }
}
function storeSetJSON(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
/* 去掉数据里残留的 HTML 标签（如 formula 中的 <sub>），再截断。 */
function plain(s, maxLen) {
  var t = String(s == null ? '' : s).replace(/<[^>]+>/g, '');
  if (maxLen && t.length > maxLen) t = t.slice(0, maxLen) + '…';
  return t;
}
function todayKey(d) {
  d = d || new Date();
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}
function emitLearn(detail) {
  try {
    window.dispatchEvent(new CustomEvent('chem:learn', { detail: detail }));
  } catch (e) { /* 旧浏览器忽略 */ }
}

/* ---------- 存储 ---------- */
var STATE_KEY = 'chem3d_v2_flash_v1';
var NEW_PER_DAY = 10;   /* 每天最多引入的新卡数 */
var XP_PER_CARD = 2;    /* 复习一张卡的经验值（游戏化模块读取） */

function loadState() {
  var st = storeGetJSON(STATE_KEY, null);
  if (!st || typeof st !== 'object') st = {};
  if (!st.cards || typeof st.cards !== 'object') st.cards = {};
  if (!st.introduced || typeof st.introduced !== 'object') st.introduced = {};
  return st;
}
function saveState(st) { storeSetJSON(STATE_KEY, st); }

/* ---------- 卡片派生（只读现有 DB 数据） ---------- */
var KIND_LABEL = { sub: '化学物品', app: '化学仪器', mol: '分子与晶体', exp: '化学实验' };

function cardFromItem(kind, it) {
  var front = it.name;
  var frontSub = plain(it.formula || '', 40);
  var backLines = [];
  if (kind === 'exp') {
    if (it.principle) backLines.push(it.principle);
    if (it.phenomena && it.phenomena.length) backLines.push('现象：' + it.phenomena.slice(0, 2).join('；'));
    if (it.steps && it.steps.length) {
      backLines.push('步骤：' + it.steps.slice(0, 3).map(function (s) { return s.t; }).join(' → '));
    }
  } else {
    if (it.desc) backLines.push(it.desc);
    if (it.info) backLines.push(it.info);
    if (it.props && it.props.length) {
      backLines.push(it.props.slice(0, 2).map(function (p) {
        return p[0] + '：' + plain(p[1], 40);
      }).join('；'));
    }
    if (it.uses && it.uses.length) backLines.push('用途：' + it.uses[0]);
  }
  if (!backLines.length) return null;
  return {
    id: 'fc:' + kind + ':' + it.id,
    kind: kind, itemId: it.id,
    front: front, frontSub: frontSub,
    back: backLines.join('\n'),
    chapter: it.subName || '',
    tags: it.tags || []
  };
}

function allCards() {
  var db = window.DB || {};
  var out = [];
  ['sub', 'app', 'mol', 'exp'].forEach(function (kind) {
    var arr = db[kind === 'sub' ? 'subs' : kind === 'app' ? 'app' : kind === 'mol' ? 'mols' : 'exps'];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (it) {
      var c = cardFromItem(kind, it);
      if (c) out.push(c);
    });
  });
  return out;
}
function cardById(id) {
  var list = allCards();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

/* ---------- FSRS-4.5 简化调度 ----------
 * 参考 FSRS（Free Spaced Repetition Scheduler）4.5 的默认权重与公式，
 * 只保留本项目需要的部分：初始难度/稳定性、遗忘曲线可提取率、
 * 成功/失败后的稳定性与难度更新。评分只有 Again(1) 与 Good(3) 两档。
 * w 数组为 FSRS-4.5 公开默认参数（前 17 项本模块用到）。
 */
var W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
  1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898];
var DECAY = -0.5;          /* 遗忘曲线衰减指数 */
var FACTOR = 19 / 81;      /* 可提取率公式系数（对应 90% 目标保持率） */
var MIN_D = 1, MAX_D = 10;
var MIN_S = 0.1;           /* 稳定性下限（天），避免除零与负间隔 */

function clampD(d) { return Math.min(MAX_D, Math.max(MIN_D, d)); }
function clampS(s) { return Math.max(MIN_S, s); }
function initDifficulty(rating) { return clampD(W[4] - Math.exp(W[5] * (rating - 1)) + 1); }
function initStability(rating) { return clampS(W[rating - 1]); }
/* 可提取率 R：距上次复习 elapsed 天后仍记得的概率估计。 */
function retrievability(elapsedDays, stability) {
  if (elapsedDays <= 0) return 1;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
}
function nextDifficulty(d, rating) {
  var nd = d - W[6] * (rating - 3);
  /* FSRS 均值回归：向初始难度均值（initDifficulty(3)）轻微回归 */
  nd = W[7] * initDifficulty(3) + (1 - W[7]) * nd;
  return clampD(nd);
}
function nextStabilityOnSuccess(d, s, r, rating) {
  var hardPenalty = rating === 2 ? W[15] : 1;
  var easyBonus = rating === 4 ? W[16] : 1;
  var sNew = s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) *
    (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus);
  return clampS(sNew);
}
function nextStabilityOnFail(d, s, r) {
  var sNew = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) *
    Math.exp((1 - r) * W[14]);
  return clampS(Math.min(sNew, s));
}
function nextIntervalDays(stability) {
  /* 目标保持率 90% 下的间隔：I = 9 * S（由 R 公式反推，含上限 365 天）。 */
  return Math.min(365, Math.max(1, Math.round(9 * stability)));
}

/* 调度入口：给定旧状态与评分，返回新状态（纯函数，可单测）。
 * state: {d, s, due, reps, lapses, state}；state: 0 新卡 / 1 学习 / 2 复习 / 3 重学。
 * rating: 1 再来一次 / 3 认识了。nowMs 可注入（测试用）。 */
function schedule(prev, rating, nowMs) {
  var now = nowMs || Date.now();
  var DAY = 86400000;
  var st = prev || { d: 0, s: 0, due: 0, reps: 0, lapses: 0, state: 0 };
  var elapsed = st.due ? Math.max(0, (now - (st.lastReview || now)) / DAY) : 0;
  var r = st.s > 0 ? retrievability(elapsed, st.s) : 1;
  var next = { d: st.d, s: st.s, due: st.due, reps: st.reps + 1,
    lapses: st.lapses, state: st.state, lastReview: now };
  if (!prev || st.state === 0) {
    next.d = initDifficulty(rating);
    next.s = initStability(rating);
    next.state = rating === 1 ? 1 : 2;
    if (rating === 1) next.lapses += 1;
  } else if (rating === 1) {
    next.d = nextDifficulty(st.d, rating);
    next.s = nextStabilityOnFail(st.d, st.s, r);
    next.state = 3;
    next.lapses += 1;
  } else {
    next.d = nextDifficulty(st.d, rating);
    next.s = nextStabilityOnSuccess(st.d, st.s, r, rating);
    next.state = 2;
  }
  var intervalDays;
  if (rating === 1) {
    /* 答错：10 分钟后可再复习（同一会话内仍会出现），同时记入重学。 */
    next.due = now + 10 * 60 * 1000;
  } else {
    intervalDays = nextIntervalDays(next.s);
    if (st.state === 0) intervalDays = Math.max(1, Math.min(4, intervalDays));
    next.due = now + intervalDays * DAY;
  }
  next.interval = rating === 1 ? 0 : intervalDays;
  return next;
}

/* ---------- 每日队列 ---------- */
function buildQueue(nowMs) {
  var now = nowMs || Date.now();
  var st = loadState();
  var cards = allCards();
  var due = [], fresh = [];
  var today = todayKey(new Date(now));
  var introducedToday = 0;
  Object.keys(st.introduced).forEach(function (id) {
    if (st.introduced[id] === today) introducedToday += 1;
  });
  cards.forEach(function (c) {
    var s = st.cards[c.id];
    if (!s) { fresh.push(c); return; }
    if (s.due <= now) due.push(c);
  });
  /* 到期卡按到期时间排序（最 overdue 的先复习）；新卡按原数据顺序。 */
  due.sort(function (a, b) { return st.cards[a.id].due - st.cards[b.id].due; });
  var newRoom = Math.max(0, NEW_PER_DAY - introducedToday);
  var newCards = fresh.slice(0, newRoom);
  return { due: due, fresh: newCards, freshTotal: fresh.length,
    introducedToday: introducedToday, state: st };
}
function counts() {
  var q = buildQueue();
  return { due: q.due.length, fresh: q.fresh.length, freshTotal: q.freshTotal,
    total: q.due.length + q.fresh.length };
}

/* ---------- 会话 UI ---------- */
var session = { list: [], index: 0, flipped: false, done: 0, again: 0, mask: null };

function fmtDue(ts) {
  var diff = ts - Date.now();
  var DAY = 86400000;
  if (diff < 60 * 60 * 1000) return '约 10 分钟后';
  var d = Math.round(diff / DAY);
  if (d <= 1) return '明天';
  return d + ' 天后';
}

function openMask() {
  closeMask();
  var mask = document.createElement('div');
  mask.className = 'wbl-mask';
  mask.id = 'wblFlashMask';
  mask.setAttribute('role', 'dialog');
  mask.setAttribute('aria-modal', 'true');
  mask.setAttribute('aria-label', '闪卡复习');
  mask.innerHTML =
    '<div class="wbl-flash-dialog">' +
      '<div class="wbl-flash-head">' +
        '<div><h3>闪卡复习</h3><p class="wbl-flash-sub" id="wblFlashSub"></p></div>' +
        '<button class="btn-sub" id="wblFlashClose" type="button">关闭</button>' +
      '</div>' +
      '<div class="wbl-flash-progress"><i id="wblFlashBar"></i></div>' +
      '<div class="wbl-flash-body" id="wblFlashBody"></div>' +
      '<p class="wbl-foot-note">卡片内容来自本站考点数据；复习计划用 FSRS 间隔重复算法本地计算，只存本机浏览器。</p>' +
    '</div>';
  document.body.appendChild(mask);
  session.mask = mask;
  mask.addEventListener('click', function (e) {
    if (e.target === mask) closeMask();
  });
  mask.querySelector('#wblFlashClose').addEventListener('click', closeMask);
  mask.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); closeMask(); }
  });
  return mask;
}
function closeMask() {
  var m = $('wblFlashMask');
  if (m) m.remove();
  session.mask = null;
}

function renderCard() {
  var body = $('wblFlashBody');
  var sub = $('wblFlashSub');
  var bar = $('wblFlashBar');
  if (!body) return;
  var total = session.list.length;
  if (session.index >= total) {
    body.innerHTML =
      '<div class="wbl-flash-done"><div class="wbl-flash-done-big">✓ 本轮完成</div>' +
      '<p>共复习 ' + session.done + ' 张卡' +
      (session.again ? '，其中 ' + session.again + ' 张需要再来一次（已安排 10 分钟后再次出现）' : '') + '。</p>' +
      '<p>下次到期卡片请明天再来，或现在去工作台继续探索新考点。</p>' +
      '<button class="btn-main" id="wblFlashDoneBtn" type="button">完成</button></div>';
    if (sub) sub.textContent = '今日复习已完成';
    if (bar) bar.style.width = '100%';
    var btn = $('wblFlashDoneBtn');
    if (btn) btn.addEventListener('click', closeMask);
    return;
  }
  var card = session.list[session.index];
  var st = loadState();
  var cs = st.cards[card.id];
  var isNew = !cs;
  if (sub) sub.textContent = '第 ' + (session.index + 1) + ' / ' + total + ' 张' +
    (isNew ? ' · 新卡' : ' · 到期复习') + ' · ' + (card.chapter || KIND_LABEL[card.kind] || '');
  if (bar) bar.style.width = Math.round(session.index / total * 100) + '%';
  body.innerHTML =
    '<div class="wbl-flash-card" id="wblFlashCard" tabindex="0" role="button" aria-label="点击翻转卡片">' +
      '<div class="wbl-flash-inner" id="wblFlashInner">' +
        '<div class="wbl-flash-face wbl-flash-front">' +
          '<span class="wbl-flash-kind">' + esc(KIND_LABEL[card.kind] || '') + '</span>' +
          '<div class="wbl-flash-q">' + esc(card.front) + '</div>' +
          (card.frontSub ? '<div class="wbl-flash-formula">' + esc(card.frontSub) + '</div>' : '') +
          '<span class="wbl-flash-hint">点击卡片查看答案</span>' +
        '</div>' +
        '<div class="wbl-flash-face wbl-flash-back">' +
          '<div class="wbl-flash-a">' + esc(card.back).replace(/\n/g, '<br>') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="wbl-flash-actions">' +
      '<button class="btn-sub wbl-flash-again" id="wblFlashAgain" type="button" disabled>再来一次</button>' +
      '<button class="btn-main wbl-flash-good" id="wblFlashGood" type="button" disabled>认识了</button>' +
    '</div>' +
    '<p class="wbl-flash-tip">先在心里想出答案，再翻卡核对；翻卡后才能评分。</p>';
  session.flipped = false;
  var cardEl = $('wblFlashCard');
  var flip = function () {
    if (session.flipped) return;
    session.flipped = true;
    var inner = $('wblFlashInner');
    if (inner) inner.classList.add('flipped');
    var a = $('wblFlashAgain'), g = $('wblFlashGood');
    if (a) a.disabled = false;
    if (g) g.disabled = false;
  };
  cardEl.addEventListener('click', flip);
  cardEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
  });
  $('wblFlashAgain').addEventListener('click', function () { rate(1); });
  $('wblFlashGood').addEventListener('click', function () { rate(3); });
}

function rate(rating) {
  var card = session.list[session.index];
  if (!card || !session.flipped) return;
  var st = loadState();
  var prev = st.cards[card.id] || null;
  if (!prev) st.introduced[card.id] = todayKey();
  var next = schedule(prev, rating);
  st.cards[card.id] = next;
  saveState(st);
  session.done += 1;
  if (rating === 1) session.again += 1;
  emitLearn({ type: 'flashcard', cardId: card.id, rating: rating, xp: XP_PER_CARD });
  /* 答错的卡 10 分钟后才到期，不在同一轮内重复出现。 */
  session.index += 1;
  renderCard();
  refreshHomeEntry();
}

function startSession() {
  var q = buildQueue();
  var list = q.due.concat(q.fresh);
  if (!list.length) {
    openMask();
    var body = $('wblFlashBody');
    var sub = $('wblFlashSub');
    if (sub) sub.textContent = '今日暂无到期卡片';
    if (body) {
      body.innerHTML = '<div class="wbl-flash-done"><div class="wbl-flash-done-big">🎉 今天的卡都复习完了</div>' +
        '<p>到期卡片 0 张 · 新卡今日已引入 ' + q.introducedToday + ' / ' + NEW_PER_DAY + ' 张。</p>' +
        '<p>新卡会在你浏览新考点后陆续加入复习队列；已学卡片会按记忆状态在之后几天陆续到期。</p>' +
        '<button class="btn-main" id="wblFlashDoneBtn" type="button">知道了</button></div>';
      var btn = $('wblFlashDoneBtn');
      if (btn) btn.addEventListener('click', closeMask);
    }
    return;
  }
  session.list = list;
  session.index = 0;
  session.done = 0;
  session.again = 0;
  openMask();
  renderCard();
}

/* ---------- 首页入口（MutationObserver 注入，不改 showHome 源码） ---------- */
function homeRoot() {
  var doc = $('docBody');
  if (!doc) return null;
  /* 首页特征：标题“3D 化学实验工作室” + 学习进度卡。 */
  if (!doc.querySelector('.learn-card')) return null;
  return doc;
}
function refreshHomeEntry() {
  var doc = homeRoot();
  if (!doc) return;
  var entry = doc.querySelector('[data-wbl-flash-entry]');
  var c = counts();
  var label = c.total > 0
    ? '今日到期 ' + c.due + ' 张 · 新卡 ' + c.fresh + ' 张'
    : '今日暂无到期卡片';
  if (entry) {
    var small = entry.querySelector('[data-wbl-flash-count]');
    if (small) small.textContent = label;
    return;
  }
  var card = document.createElement('button');
  card.type = 'button';
  card.className = 'wbl-home-flash';
  card.setAttribute('data-wbl-flash-entry', '1');
  card.innerHTML =
    '<span class="wbl-home-flash-icon">🃏</span>' +
    '<span class="wbl-home-flash-text"><strong>闪卡复习</strong>' +
    '<small data-wbl-flash-count>' + esc(label) + '</small></span>' +
    '<span class="wbl-home-flash-go">开始复习 →</span>';
  card.addEventListener('click', startSession);
  /* 放在学习进度卡之后、模块入口之前。 */
  var learnCard = doc.querySelector('.learn-card');
  if (learnCard && learnCard.nextSibling) doc.insertBefore(card, learnCard.nextSibling);
  else doc.appendChild(card);
}

function init() {
  if (!window.DB) return false;
  refreshHomeEntry();
  /* 首页每次重渲染（showHome 写 docBody.innerHTML）后重新注入入口。 */
  var doc = $('docBody');
  if (doc && window.MutationObserver) {
    var timer = 0;
    new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(refreshHomeEntry, 60);
    }).observe(doc, { childList: true });
  }
  window.addEventListener('chem:context', function () {
    setTimeout(refreshHomeEntry, 60);
  });
  /* 游戏化条与概念图谱等模块可用 [data-learn-flash] 打开闪卡。 */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-learn-flash]') : null;
    if (b) { e.preventDefault(); startSession(); }
  });
  return true;
}

/* 延迟初始化：DB 由 defer 脚本提供，本模块排在它们之后，但仍做重试兜底。 */
(function boot(attempt) {
  if (init() || attempt >= 10) return;
  setTimeout(function () { boot(attempt + 1); }, 400);
})(0);

/* ---------------- 对外接口 ---------------- */
window.ChemFlashcards = {
  open: startSession,
  counts: counts,
  allCards: allCards,
  cardById: cardById,
  schedule: schedule,
  retrievability: retrievability,
  NEW_PER_DAY: NEW_PER_DAY,
  /* 导出/导入全部卡片状态（供以后与云端同步接口对接；当前仅本地使用）。 */
  exportState: function () { return JSON.stringify(loadState()); },
  importState: function (json) {
    try {
      var st = JSON.parse(json);
      if (!st || typeof st.cards !== 'object') return false;
      saveState(st);
      refreshHomeEntry();
      return true;
    } catch (e) { return false; }
  },
  resetState: function () {
    try { window.localStorage.removeItem(STATE_KEY); } catch (e) {}
    refreshHomeEntry();
  }
};

})();
