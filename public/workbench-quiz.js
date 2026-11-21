/* ============================================================================
 * 高中化学 3D 考点工作台 — 测验增强（工作流 4 / C 组）
 * 配套样式：css/workbench-quiz.css。
 *
 * 表现层增强，不改动任何原有测验逻辑：
 *   - 课后练习 / 预习自测弹窗（js/inline-08-ui.js renderQuiz 渲染，
 *     QUIZ 状态在其 IIFE 内部、无法直接访问）：本文件只读 DOM——通过
 *     MutationObserver 监听 #quizDialog 的重渲染，从 .q-item/.q-opt.sel/
 *     .q-item.ok/.q-item.bad 的 class 反推已答/正误状态；单题浏览、
 *     答题卡跳转、上一题/下一题、计时均为本文件自有的轻量状态包装。
 *     原选项点击/提交/重做处理器全部保留（节点移动不丢失监听）。
 *   - 高考真题空间单题页（js/exam-space.js showProblem 渲染）：监听
 *     #docBody，读取目录按钮 [data-exam-model] 的 aria-pressed 定位当前题，
 *     上一题/下一题直接 .click() 相邻目录按钮，复用原有切换逻辑；
 *     错题状态读 exam-space 自身的 localStorage（chem_exam_space_v1），
 *     答对记录用本文件自己的键（chem_wb4_exam_done）补记——因为原逻辑
 *     只持久化错题，答对不留痕。
 *   - 自适应测验推荐（模块三，OATutor 式规则推荐，纯前端实现）：
 *     测验提交/答错后，按薄弱点推荐下一题。数据全部来自现有题库与
 *     测验记录，不编造题目。注意题目本身没有考点标签（见
 *     js/inline-04-db-exps.js，题目只有 type/q/opts/ans/why），因此：
 *       · “考点”以实验（测验场次）为单位：同一场测验的题目共享该实验
 *         的考点；真题空间以题型组（空间构型 / 晶胞计算）为考点单位；
 *       · “章节”以 window.DB.exps 的 sub 字段（章节代码）为准；
 *       · “未做对过”以本文件逐题历史（chem_wb4_quiz_hist）与原测验
 *         记录（chem3d_quiz_<id>，store 前缀 chem3d_）为准。
 *     推荐卡出现在答题卡侧栏（弹窗测验）与导航条（真题空间），点击跳转。
 * ========================================================================== */
(function () {
'use strict';

/* ---------- 通用小工具 ---------- */
function $(id) { return document.getElementById(id); }
function storeGet(key, fallback) {
  try {
    var v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) { return fallback; }
}
function storeSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch (e) { /* 隐私模式下忽略 */ }
}
function storeGetJSON(key, fallback) {
  try {
    var v = JSON.parse(window.localStorage.getItem(key) || 'null');
    return v && typeof v === 'object' ? v : fallback;
  } catch (e) { return fallback; }
}
function fmtTime(ms) {
  var s = Math.floor(ms / 1000);
  var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return h > 0 ? h + ':' + p(m) + ':' + p(ss) : p(m) + ':' + p(ss);
}

/* ==========================================================================
 * 模块一：课后练习 / 预习自测弹窗（#quizMask / #quizDialog）
 * ========================================================================== */
var MODE_KEY = 'chem_wb4_quiz_mode';    /* 'single' 单题浏览 | 'all' 全部列表 */
var TIMER_KEY = 'chem_wb4_quiz_timer';  /* 'on' | 'off' */
var quiz = {
  mask: null, dialog: null,
  key: '', index: 0, total: 0,
  mode: storeGet(MODE_KEY, 'single') === 'all' ? 'all' : 'single',
  timerOn: storeGet(TIMER_KEY, 'on') !== 'off',
  submitted: false,
  startedAt: 0, elapsed: 0, timerId: 0,
  lastSig: ''
};

function quizItems() {
  return Array.prototype.slice.call(quiz.dialog.querySelectorAll('.q-item'));
}
/* 渲染签名：只有原逻辑重渲染导致的状态变化才会改变签名；
   本文件自己的 DOM 调整（移动节点、注入导航条）不改变签名，避免循环重算。 */
function quizSignature(items) {
  var head = quiz.dialog.querySelector('.quiz-head h3');
  var parts = [
    head ? head.textContent : '',
    String(items.length),
    quiz.dialog.querySelector('#qRetry') ? 's1' : 's0'
  ];
  items.forEach(function (it) {
    parts.push(it.querySelector('.q-opt.sel') ? '1' : '0');
    parts.push(it.classList.contains('ok') ? 'r' : it.classList.contains('bad') ? 'w' : '-');
  });
  return parts.join('|');
}

function quizTick() {
  var el = quiz.dialog && quiz.dialog.querySelector('.wbq-timer');
  if (!el) return;
  var ms = quiz.elapsed + (quiz.startedAt ? Date.now() - quiz.startedAt : 0);
  el.textContent = '用时 ' + fmtTime(ms);
}
function quizStartTimer() {
  quizStopTimer();
  if (!quiz.timerOn) return;
  if (!quiz.startedAt) quiz.startedAt = Date.now();
  quiz.timerId = window.setInterval(quizTick, 1000);
  quizTick();
}
function quizStopTimer() {
  if (quiz.timerId) { window.clearInterval(quiz.timerId); quiz.timerId = 0; }
}
function quizPauseTimer() {
  if (quiz.startedAt) { quiz.elapsed += Date.now() - quiz.startedAt; quiz.startedAt = 0; }
  quizStopTimer();
}

function quizApply() {
  if (!quiz.dialog || !quiz.mask || !quiz.mask.classList.contains('show')) return;
  var items = quizItems();
  if (!items.length) { quiz.lastSig = ''; return; }
  var sig = quizSignature(items);
  if (sig === quiz.lastSig) return; /* 本文件自己的 DOM 调整，不重复构建 */
  var head = quiz.dialog.querySelector('.quiz-head h3');
  var key = (head ? head.textContent : '') + '|' + items.length;
  var submitted = !!quiz.dialog.querySelector('#qRetry');
  if (key !== quiz.key) { /* 新开一场测验：复位题号与计时 */
    quiz.key = key; quiz.index = 0;
    quiz.elapsed = 0; quiz.startedAt = Date.now(); quiz.submitted = false;
  } else if (quiz.submitted && !submitted) { /* 点了“重新作答”：复位计时与题号 */
    quiz.elapsed = 0; quiz.startedAt = Date.now(); quiz.index = 0;
  } else if (!quiz.submitted && submitted) { /* 刚提交：记录逐题正误（供推荐用） */
    quizRecordResults(items);
  } else if (!quiz.startedAt) { /* 同场测验重新打开：继续计时 */
    quiz.startedAt = Date.now();
  }
  quiz.submitted = submitted;
  quiz.total = items.length;
  if (quiz.index >= items.length) quiz.index = items.length - 1;
  if (quiz.index < 0) quiz.index = 0;
  quizBuildChrome(items, submitted);
  quiz.lastSig = sig;
  quizStartTimer();
  quizUpdateCurrent(false);
}

function quizBuildChrome(items, submitted) {
  var d = quiz.dialog;
  /* 防御：若旧增强结构还在（理论上每次重渲染都会被 innerHTML 清掉），
     先把原题目与提交栏移回弹窗根部，再拆除旧结构。节点移动不丢失原监听。 */
  var oldShell = d.querySelector('.wbq-shell');
  if (oldShell) {
    var holder = oldShell.querySelector('.wbq-main');
    if (holder) {
      Array.prototype.slice.call(holder.querySelectorAll('.q-item, .q-foot'))
        .forEach(function (el) { d.insertBefore(el, oldShell); });
    }
    oldShell.remove();
  }
  var oldBar = d.querySelector('.wbq-bar');
  if (oldBar) oldBar.remove();

  /* --- 顶部进度条 --- */
  var bar = document.createElement('div');
  bar.className = 'wbq-bar';
  bar.innerHTML =
    '<span class="wbq-pos">第 <b class="wbq-cur">1</b> / <span class="wbq-total">' + items.length + '</span> 题' +
    '<small class="wbq-counts"></small></span>' +
    '<div class="wbq-progress" role="progressbar" aria-label="答题进度" aria-valuemin="0" aria-valuemax="' + items.length + '" aria-valuenow="0"><i></i></div>' +
    '<span class="wbq-timer"' + (quiz.timerOn ? '' : ' hidden') + '>用时 00:00</span>' +
    '<button type="button" class="wbq-mini wbq-timer-toggle" aria-pressed="' + (quiz.timerOn ? 'true' : 'false') + '">计时：' + (quiz.timerOn ? '开' : '关') + '</button>' +
    '<button type="button" class="wbq-mini wbq-mode-toggle" aria-pressed="' + (quiz.mode === 'single' ? 'true' : 'false') + '">' +
    (quiz.mode === 'single' ? '单题浏览' : '全部列表') + '</button>';
  var anchor = d.querySelector('.quiz-sub') || d.querySelector('.quiz-head');
  if (anchor) anchor.parentNode.insertBefore(bar, anchor.nextSibling);
  else d.insertBefore(bar, d.firstChild);

  /* --- 两栏：题干区 + 答题卡侧栏 --- */
  var shell = document.createElement('div');
  shell.className = 'wbq-shell';
  var main = document.createElement('div');
  main.className = 'wbq-main';
  var side = document.createElement('div');
  side.className = 'wbq-side';
  side.innerHTML =
    '<div class="wbq-card-title">答题卡<small>点击题号跳转</small></div>' +
    '<div class="wbq-card"></div>' +
    '<div class="wbq-legend"><i></i>未答<i class="lg-done"></i>已答' +
    '<i class="lg-right"></i>答对<i class="lg-wrong"></i>答错</div>';
  var card = side.querySelector('.wbq-card');
  items.forEach(function (it, i) {
    var cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'wbq-cell';
    cell.setAttribute('data-i', String(i));
    cell.setAttribute('aria-label', '跳转到第 ' + (i + 1) + ' 题');
    cell.textContent = String(i + 1);
    card.appendChild(cell);
  });
  /* 自适应推荐卡（模块三）：挂在答题卡下方 */
  var reco = quizRecommend(items, submitted);
  if (reco) side.appendChild(quizRecoElement(reco, items));
  shell.appendChild(main);
  shell.appendChild(side);
  d.insertBefore(shell, items[0]);
  items.forEach(function (it) { main.appendChild(it); });

  /* --- 底部导航：上一题 / 下一题 --- */
  var nav = document.createElement('div');
  nav.className = 'wbq-nav';
  nav.innerHTML =
    '<button type="button" class="btn-sub wbq-prev">← 上一题</button>' +
    '<span class="wbq-nav-pos"></span>' +
    '<button type="button" class="btn-main wbq-next">下一题 →</button>';
  main.appendChild(nav);
  var foot = d.querySelector('.q-foot');
  if (foot) main.appendChild(foot);

  d.classList.toggle('wbq-single', quiz.mode === 'single');
}

function quizUpdateCurrent(scroll) {
  var d = quiz.dialog;
  if (!d) return;
  var items = quizItems();
  var answered = 0, right = 0;
  items.forEach(function (it, i) {
    if (it.querySelector('.q-opt.sel')) answered++;
    if (it.classList.contains('ok')) right++;
    it.classList.toggle('wbq-current', i === quiz.index);
  });
  var cur = d.querySelector('.wbq-cur');
  if (cur) cur.textContent = String(quiz.index + 1);
  var counts = d.querySelector('.wbq-counts');
  if (counts) {
    counts.textContent = quiz.submitted
      ? '答对 ' + right + ' / ' + items.length
      : '已答 ' + answered + ' / ' + items.length;
  }
  var fill = d.querySelector('.wbq-progress > i');
  var prog = d.querySelector('.wbq-progress');
  var done = quiz.submitted ? right : answered;
  if (fill) fill.style.width = (items.length ? Math.round(done / items.length * 100) : 0) + '%';
  if (prog) prog.setAttribute('aria-valuenow', String(done));
  Array.prototype.forEach.call(d.querySelectorAll('.wbq-cell'), function (cell) {
    var i = Number(cell.getAttribute('data-i'));
    var it = items[i];
    if (!it) return;
    cell.classList.toggle('is-current', i === quiz.index);
    cell.classList.toggle('is-answered', !!it.querySelector('.q-opt.sel'));
    cell.classList.toggle('is-right', it.classList.contains('ok'));
    cell.classList.toggle('is-wrong', it.classList.contains('bad'));
  });
  var prev = d.querySelector('.wbq-prev');
  var next = d.querySelector('.wbq-next');
  var pos = d.querySelector('.wbq-nav-pos');
  if (prev) prev.disabled = quiz.index <= 0;
  if (next) next.disabled = quiz.index >= items.length - 1;
  if (pos) pos.textContent = '第 ' + (quiz.index + 1) + ' / ' + items.length + ' 题';
  if (scroll) {
    if (quiz.mode === 'single') { d.scrollTop = 0; }
    else if (items[quiz.index]) { items[quiz.index].scrollIntoView({ block: 'start' }); }
  }
}

function quizGoto(i) {
  if (!quiz.total) return;
  var next = Math.max(0, Math.min(quiz.total - 1, i));
  if (next === quiz.index) return;
  quiz.index = next;
  quizUpdateCurrent(true);
}

function quizInit() {
  quiz.mask = $('quizMask');
  quiz.dialog = $('quizDialog');
  if (!quiz.mask || !quiz.dialog) return;
  /* 弹窗开关：打开时构建增强、关闭时暂停计时 */
  if ('MutationObserver' in window) {
    new MutationObserver(function () {
      if (quiz.mask.classList.contains('show')) quizApply();
      else { quizPauseTimer(); quiz.lastSig = ''; }
    }).observe(quiz.mask, { attributes: true, attributeFilter: ['class'] });
    /* 原 renderQuiz 每次作答/提交都整体重渲染 innerHTML，在此重新挂增强 */
    new MutationObserver(function () { quizApply(); })
      .observe(quiz.dialog, { childList: true });
  }
  quiz.dialog.addEventListener('click', function (e) {
    var cell = e.target.closest ? e.target.closest('.wbq-cell') : null;
    if (cell) { quizGoto(Number(cell.getAttribute('data-i'))); return; }
    if (e.target.closest && e.target.closest('.wbq-prev')) { quizGoto(quiz.index - 1); return; }
    if (e.target.closest && e.target.closest('.wbq-next')) { quizGoto(quiz.index + 1); return; }
    /* 自适应推荐卡跳转（模块三） */
    var recoBtn = e.target.closest ? e.target.closest('.wbq-reco-go') : null;
    if (recoBtn) {
      var kind = recoBtn.getAttribute('data-reco');
      if (kind === 'same') { quizGoto(Number(recoBtn.getAttribute('data-i'))); return; }
      if (kind === 'chapter') { quizJumpToExp(recoBtn.getAttribute('data-exp')); return; }
      return;
    }
    var modeBtn = e.target.closest ? e.target.closest('.wbq-mode-toggle') : null;
    if (modeBtn) {
      quiz.mode = quiz.mode === 'single' ? 'all' : 'single';
      storeSet(MODE_KEY, quiz.mode);
      quiz.dialog.classList.toggle('wbq-single', quiz.mode === 'single');
      modeBtn.textContent = quiz.mode === 'single' ? '单题浏览' : '全部列表';
      modeBtn.setAttribute('aria-pressed', quiz.mode === 'single' ? 'true' : 'false');
      quizUpdateCurrent(true);
      return;
    }
    var timerBtn = e.target.closest ? e.target.closest('.wbq-timer-toggle') : null;
    if (timerBtn) {
      quiz.timerOn = !quiz.timerOn;
      storeSet(TIMER_KEY, quiz.timerOn ? 'on' : 'off');
      timerBtn.textContent = '计时：' + (quiz.timerOn ? '开' : '关');
      timerBtn.setAttribute('aria-pressed', quiz.timerOn ? 'true' : 'false');
      var timerEl = quiz.dialog.querySelector('.wbq-timer');
      if (timerEl) timerEl.hidden = !quiz.timerOn;
      if (quiz.timerOn) quizStartTimer(); else quizStopTimer();
      return;
    }
    /* “重新作答”由原逻辑处理；这里只复位本文件的计时与题号 */
    if (e.target.closest && e.target.closest('#qRetry')) {
      quiz.elapsed = 0; quiz.startedAt = Date.now(); quiz.index = 0;
    }
  });
  if (quiz.mask.classList.contains('show')) quizApply();
}

/* ==========================================================================
 * 模块二：高考真题空间单题页（.exam-page，js/exam-space.js）
 * ========================================================================== */
var EXAM_DONE_KEY = 'chem_wb4_exam_done'; /* {模型 id: 'right'|'wrong'}，本文件自记 */
var EXAM_TIMER_KEY = 'chem_wb4_exam_timer';
var REVIEW_KEY = 'chem_exam_space_v1';    /* exam-space 自身的错题记录（只读） */
var exam = {
  docBody: null, mid: '', sig: '',
  timerOn: storeGet(EXAM_TIMER_KEY, 'on') !== 'off',
  startedAt: 0, elapsed: 0, timerId: 0, active: false
};

function examReviews() { return storeGetJSON(REVIEW_KEY, {}); }
function examDone() { return storeGetJSON(EXAM_DONE_KEY, {}); }
function examRecord(id, result) {
  var done = examDone();
  if (done[id] === result) return;
  done[id] = result;
  try { window.localStorage.setItem(EXAM_DONE_KEY, JSON.stringify(done)); } catch (e) { /* 忽略 */ }
}
/* 合并状态：本文件自记的答对/答错 + 原错题本（未订正=错，已订正=对） */
function examStatus(id) {
  var done = examDone();
  if (done[id] === 'right') return 'ok';
  var reviews = examReviews();
  if (reviews[id]) return reviews[id].corrected ? 'ok' : 'bad';
  if (done[id] === 'wrong') return 'bad';
  return '';
}

function examTick() {
  var el = exam.docBody && exam.docBody.querySelector('.wbq-exam-bar .wbq-timer');
  if (!el) return;
  var ms = exam.elapsed + (exam.startedAt ? Date.now() - exam.startedAt : 0);
  el.textContent = '用时 ' + fmtTime(ms);
}
function examStartTimer() {
  examStopTimer();
  if (!exam.timerOn) return;
  if (!exam.startedAt) exam.startedAt = Date.now();
  exam.timerId = window.setInterval(examTick, 1000);
  examTick();
}
function examStopTimer() {
  if (exam.timerId) { window.clearInterval(exam.timerId); exam.timerId = 0; }
}
function examResetTimer() {
  examStopTimer();
  exam.elapsed = 0; exam.startedAt = 0;
}

function examCheck() {
  if (!exam.docBody) return;
  var page = exam.docBody.querySelector('.exam-page');
  if (!page) {
    if (exam.active) { exam.active = false; exam.mid = ''; exam.sig = ''; examResetTimer(); }
    return;
  }
  exam.active = true;
  var catalog = Array.prototype.slice.call(
    page.querySelectorAll('.exam-catalog [data-exam-model]'));
  if (!catalog.length) return;
  var curIdx = 0;
  catalog.forEach(function (b, i) {
    if (b.getAttribute('aria-pressed') === 'true') curIdx = i;
  });
  var mid = catalog[curIdx].getAttribute('data-exam-model');
  var fb = page.querySelector('#examFeedback');
  var fbSig = '-';
  if (fb) {
    if (fb.querySelector('.exam-result.is-right')) fbSig = 'R';
    else if (fb.querySelector('.exam-result.is-wrong')) fbSig = 'W';
  }
  /* 反馈出现时记下本次作答（复习回显的旧错题同样记为 wrong，状态一致） */
  if (fbSig === 'R') examRecord(mid, 'right');
  else if (fbSig === 'W') examRecord(mid, 'wrong');
  var sig = mid + '|' + catalog.length + '|' + fbSig + '|' +
    (storeGet(REVIEW_KEY, '') || '') + '|' + (storeGet(EXAM_DONE_KEY, '') || '');
  if (sig === exam.sig && page.querySelector('.wbq-exam-bar')) return;
  exam.sig = sig;
  exam.mid = mid;
  examBuildBar(page, catalog, curIdx);
  examMarkCatalog(catalog);
  examStartTimer();
}

function examBuildBar(page, catalog, curIdx) {
  var old = page.querySelector('.wbq-exam-bar');
  if (old) old.remove();
  var total = catalog.length;
  var answered = 0, right = 0;
  catalog.forEach(function (b) {
    var st = examStatus(b.getAttribute('data-exam-model'));
    if (st) answered++;
    if (st === 'ok') right++;
  });
  var bar = document.createElement('div');
  bar.className = 'wbq-exam-bar';
  bar.setAttribute('data-mid', catalog[curIdx].getAttribute('data-exam-model'));
  bar.innerHTML =
    '<span class="wbq-pos">第 <b>' + (curIdx + 1) + '</b> / ' + total + ' 题' +
    '<small>已作答 ' + answered + ' / ' + total + ' · 答对 ' + right + '</small></span>' +
    '<div class="wbq-progress" role="progressbar" aria-label="真题进度" aria-valuemin="0" aria-valuemax="' + total +
    '" aria-valuenow="' + (curIdx + 1) + '"><i style="width:' + Math.round((curIdx + 1) / total * 100) + '%"></i></div>' +
    '<span class="wbq-timer"' + (exam.timerOn ? '' : ' hidden') + '>用时 00:00</span>' +
    '<button type="button" class="wbq-mini wbq-exam-timer-toggle" aria-pressed="' + (exam.timerOn ? 'true' : 'false') + '">计时：' + (exam.timerOn ? '开' : '关') + '</button>' +
    '<span class="wbq-nav-btns">' +
    '<button type="button" class="btn-sub wbq-exam-prev"' + (curIdx <= 0 ? ' disabled' : '') + '>← 上一题</button>' +
    '<button type="button" class="btn-main wbq-exam-next"' + (curIdx >= total - 1 ? ' disabled' : '') + '>下一题 →</button>' +
    '</span>';
  var head = page.querySelector('.exam-head');
  if (head) head.parentNode.insertBefore(bar, head.nextSibling);
  else page.insertBefore(bar, page.firstChild);
  /* 自适应推荐行（模块三）：仅当前题答错后出现 */
  var wrongNow = !!page.querySelector('#examFeedback .exam-result.is-wrong');
  if (wrongNow) {
    var reco = examRecommend(catalog, curIdx);
    if (reco) bar.appendChild(examRecoElement(reco));
  }
}

function examMarkCatalog(catalog) {
  catalog.forEach(function (b) {
    var st = examStatus(b.getAttribute('data-exam-model'));
    b.classList.toggle('wbq-done-ok', st === 'ok');
    b.classList.toggle('wbq-done-bad', st === 'bad');
  });
}

function examStep(dir) {
  if (!exam.docBody) return;
  var page = exam.docBody.querySelector('.exam-page');
  if (!page) return;
  var catalog = Array.prototype.slice.call(
    page.querySelectorAll('.exam-catalog [data-exam-model]'));
  var curIdx = 0;
  catalog.forEach(function (b, i) {
    if (b.getAttribute('aria-pressed') === 'true') curIdx = i;
  });
  var target = catalog[curIdx + dir];
  /* 程序化点击目录按钮，复用 exam-space 自身的切换逻辑 */
  if (target) target.click();
}

function examInit() {
  exam.docBody = $('docBody');
  if (!exam.docBody) return;
  if ('MutationObserver' in window) {
    /* 监听整棵子树：showProblem 整体重渲染、提交后 #examFeedback 变化都会触发；
       examCheck 内部用签名去重，开销很小。 */
    new MutationObserver(function () { examCheck(); })
      .observe(exam.docBody, { childList: true, subtree: true });
  }
  exam.docBody.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('.wbq-exam-prev')) { examStep(-1); return; }
    if (e.target.closest('.wbq-exam-next')) { examStep(1); return; }
    /* 自适应推荐行跳转（模块三） */
    var recoBtn = e.target.closest('.wbq-exam-reco-go');
    if (recoBtn) { examJumpTo(recoBtn.getAttribute('data-id')); return; }
    var timerBtn = e.target.closest('.wbq-exam-timer-toggle');
    if (timerBtn) {
      exam.timerOn = !exam.timerOn;
      storeSet(EXAM_TIMER_KEY, exam.timerOn ? 'on' : 'off');
      timerBtn.textContent = '计时：' + (exam.timerOn ? '开' : '关');
      timerBtn.setAttribute('aria-pressed', exam.timerOn ? 'true' : 'false');
      var timerEl = exam.docBody.querySelector('.wbq-exam-bar .wbq-timer');
      if (timerEl) timerEl.hidden = !exam.timerOn;
      if (exam.timerOn) examStartTimer(); else examStopTimer();
    }
  });
  examCheck();
}

/* ==========================================================================
 * 模块三：自适应测验推荐（OATutor 式规则推荐，纯前端实现）
 * 数据来源：window.DB.exps（现有题库元数据）、原测验记录
 * chem3d_quiz_<id>（store 前缀 chem3d_）、本文件逐题历史
 * chem_wb4_quiz_hist（提交时记录，不含预习模式）。不编造题目。
 * ========================================================================== */
var HIST_KEY = 'chem_wb4_quiz_hist'; /* {题干哈希: {r: 做对次数, w: 做错次数}} */

function hashStr(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(16);
}
function quizHist() { return storeGetJSON(HIST_KEY, {}); }
function quizHistSave(hist) {
  try { window.localStorage.setItem(HIST_KEY, JSON.stringify(hist)); } catch (e) { /* 忽略 */ }
}
/* 题干文本（.q-txt）→ 稳定哈希，跨场次识别同一道题 */
function quizQuestionKey(item) {
  var txt = item.querySelector('.q-txt');
  return hashStr(txt ? txt.textContent.trim() : '');
}
function quizIsPreview() {
  var head = quiz.dialog && quiz.dialog.querySelector('.quiz-head h3');
  return !!head && head.textContent.indexOf('预习自测') >= 0;
}
/* 提交时记录逐题正误（只在 submitted false→true 转换时调用一次；
   预习模式成绩不计入课后记录，这里同样不记） */
function quizRecordResults(items) {
  if (quizIsPreview()) return;
  var hist = quizHist();
  var changed = false;
  items.forEach(function (it) {
    var key = quizQuestionKey(it);
    if (!key) return;
    var rec = hist[key] || { r: 0, w: 0 };
    if (it.classList.contains('ok')) rec.r++;
    else if (it.classList.contains('bad')) rec.w++;
    else return;
    hist[key] = rec;
    changed = true;
  });
  if (changed) quizHistSave(hist);
}
/* 当前测验对应的实验（按弹窗标题里的实验名匹配 window.DB.exps） */
function quizCurrentExp() {
  var head = quiz.dialog && quiz.dialog.querySelector('.quiz-head h3');
  if (!head || !window.DB || !window.DB.exps) return null;
  var name = head.textContent.replace(/ · (课后练习|预习自测)\s*$/, '').trim();
  for (var i = 0; i < window.DB.exps.length; i++) {
    if (window.DB.exps[i].name === name) return window.DB.exps[i];
  }
  return null;
}
function quizBestScore(expId) {
  return storeGetJSON('chem3d_quiz_' + expId, null);
}
/* 达标线与原 quizPassLine 一致：ceil(总题数 × 0.75) */
function quizMastered(exp) {
  if (!exp || !exp.quiz || !exp.quiz.length) return true; /* 无测验的实验不纳入推荐 */
  var best = quizBestScore(exp.id);
  if (!best || typeof best.score !== 'number') return false;
  return best.score >= Math.ceil(exp.quiz.length * 0.75);
}
function quizScoreRate(exp) {
  var best = quizBestScore(exp.id);
  if (!best || typeof best.score !== 'number' || !best.total) return 0;
  return best.score / best.total;
}

/* 推荐规则：
 *  1) 本场（同考点）优先：提交后取本场错题；未提交时取历史错题。
 *     排序：从未做对过（r==0）优先，其次历史错次多者优先，再按题号。
 *  2) 提交后本场无错题：同章节（同 sub）其他实验中找未掌握的测验，
 *     得分率最低者优先（无记录视为 0），点击跨实验打开该测验。
 *     未提交时不推跨测验（用户刚开场，尚未产生本场薄弱点，不干扰当前任务）。
 *  3) 提交后同章节全部掌握：返回 done 鼓励态。
 *  返回 null 表示无推荐内容（不显示推荐卡）。 */
function quizRecommend(items, submitted) {
  var hist = quizHist();
  var cands = [];
  items.forEach(function (it, i) {
    var wrongNow = it.classList.contains('bad');
    var rec = hist[quizQuestionKey(it)] || { r: 0, w: 0 };
    var eligible = submitted ? wrongNow : rec.w > 0;
    if (!eligible) return;
    cands.push({ index: i, neverRight: rec.r === 0, wrong: rec.w, wrongNow: wrongNow });
  });
  if (cands.length) {
    cands.sort(function (a, b) {
      if (a.neverRight !== b.neverRight) return a.neverRight ? -1 : 1;
      if (a.wrong !== b.wrong) return b.wrong - a.wrong;
      return a.index - b.index;
    });
    var top = cands[0];
    var reason = top.wrongNow
      ? (top.wrong > 1 ? '这道题累计错过 ' + top.wrong + ' 次，重点再练' : '这道题本场答错了，再练一次')
      : (top.wrong > 1 ? '历史上错过 ' + top.wrong + ' 次，还没做对过' : '上次答错过，还没做对过');
    return { kind: 'same', index: top.index, reason: reason };
  }
  /* 本场无可推荐：仅提交后（本场已完成且无错题）才推同章节其他测验；
     未提交时不推跨测验，避免干扰刚开场的作答。 */
  if (!submitted) return null;
  var exp = quizCurrentExp();
  if (!exp || !exp.sub || !window.DB || !window.DB.exps) return null;
  var peers = window.DB.exps.filter(function (e) {
    return e.sub === exp.sub && e.id !== exp.id && e.quiz && e.quiz.length;
  });
  var unmastered = peers.filter(function (e) { return !quizMastered(e); });
  if (unmastered.length) {
    unmastered.sort(function (a, b) { return quizScoreRate(a) - quizScoreRate(b); });
    var target = unmastered[0];
    var rate = quizScoreRate(target);
    return {
      kind: 'chapter', expId: target.id, expName: target.name,
      expTotal: target.quiz.length,
      reason: rate > 0
        ? '同章节「' + (target.subName || '') + '」还没达标（最好成绩 ' + Math.round(rate * 100) + '%）'
        : '同章节「' + (target.subName || '') + '」还没练过'
    };
  }
  if (peers.length) return { kind: 'done', reason: '本章节测验已全部达标，继续保持！' };
  return null;
}

function quizStemText(items, index) {
  var txt = items[index] && items[index].querySelector('.q-txt');
  var s = txt ? txt.textContent.trim() : '';
  return s.length > 26 ? s.slice(0, 26) + '…' : s;
}
function quizRecoElement(reco, items) {
  var box = document.createElement('div');
  box.className = 'wbq-reco';
  var title = document.createElement('div');
  title.className = 'wbq-reco-title';
  title.textContent = reco.kind === 'done' ? '掌握情况' : '为你推荐';
  box.appendChild(title);
  var body = document.createElement('div');
  body.className = 'wbq-reco-body';
  var why = document.createElement('div');
  why.className = 'wbq-reco-why';
  why.textContent = reco.reason;
  if (reco.kind === 'same') {
    body.textContent = '第 ' + (reco.index + 1) + ' 题 · ' + quizStemText(items, reco.index);
    box.appendChild(body);
    box.appendChild(why);
    var go = document.createElement('button');
    go.type = 'button';
    go.className = 'btn-main wbq-reco-go';
    go.setAttribute('data-reco', 'same');
    go.setAttribute('data-i', String(reco.index));
    go.textContent = '去做这道题';
    box.appendChild(go);
  } else if (reco.kind === 'chapter') {
    body.textContent = '「' + reco.expName + '」课后练习（共 ' + reco.expTotal + ' 题）';
    box.appendChild(body);
    box.appendChild(why);
    var go2 = document.createElement('button');
    go2.type = 'button';
    go2.className = 'btn-main wbq-reco-go';
    go2.setAttribute('data-reco', 'chapter');
    go2.setAttribute('data-exp', reco.expId);
    go2.textContent = '打开这个测验';
    box.appendChild(go2);
  } else {
    body.textContent = reco.reason;
    box.appendChild(body);
  }
  return box;
}

/* 跨实验打开另一场测验：关弹窗 → 选中实验 → 等 inspector 渲染出
   “课后练习”按钮后点击。select() 是 async（首次需加载 viewer3d），
   用轮询等待，最多 6 秒；超时则停留在目标实验页，用户可手动进入。 */
function quizJumpToExp(expId) {
  if (!expId || typeof window.select !== 'function') return;
  if (quiz.mask) quiz.mask.classList.remove('show');
  quizPauseTimer();
  try {
    var p = window.select('exp', expId);
    if (p && typeof p.catch === 'function') p.catch(function () {});
  } catch (e) { return; }
  var tries = 0;
  var timer = window.setInterval(function () {
    tries++;
    var btn = $('btnQuiz');
    if (btn) { window.clearInterval(timer); btn.click(); return; }
    if (tries >= 50) window.clearInterval(timer); /* 50 × 120ms = 6s */
  }, 120);
}

/* ---------- 真题空间推荐 ---------- */
/* 当前题答错后，同组（同 parent div，即同一题型组）内优先推荐未订正
   错题、其次没练过的题；同组无可推荐则换另一组；全部掌握则不显示。 */
function examRecommend(catalog, curIdx) {
  var curBtn = catalog[curIdx];
  var curGroup = curBtn.parentElement;
  var sameGroup = catalog.filter(function (b) { return b.parentElement === curGroup && b !== curBtn; });
  var otherGroup = catalog.filter(function (b) { return b.parentElement !== curGroup; });
  var pick = function (list) {
    for (var i = 0; i < list.length; i++) {
      if (examStatus(list[i].getAttribute('data-exam-model')) === 'bad') {
        return { btn: list[i], why: '这道题答错了还没订正' };
      }
    }
    for (var j = 0; j < list.length; j++) {
      if (examStatus(list[j].getAttribute('data-exam-model')) === '') {
        return { btn: list[j], why: '这道题还没练过' };
      }
    }
    return null;
  };
  var r = pick(sameGroup);
  var scope = '同考点';
  if (!r) { r = pick(otherGroup); scope = '换个考点练练'; }
  if (!r) return null;
  return {
    id: r.btn.getAttribute('data-exam-model'),
    name: r.btn.textContent.trim(),
    why: r.why, scope: scope
  };
}
function examRecoElement(reco) {
  var row = document.createElement('div');
  row.className = 'wbq-reco wbq-reco-row';
  var span = document.createElement('span');
  span.className = 'wbq-reco-text';
  var b = document.createElement('b');
  b.textContent = '为你推荐';
  span.appendChild(b);
  span.appendChild(document.createTextNode(' · 下一题练「' + reco.name + '」（' + reco.scope + '）'));
  var small = document.createElement('small');
  small.textContent = reco.why;
  span.appendChild(small);
  row.appendChild(span);
  var go = document.createElement('button');
  go.type = 'button';
  go.className = 'btn-main wbq-exam-reco-go';
  go.setAttribute('data-id', reco.id);
  go.textContent = '去做题';
  row.appendChild(go);
  return row;
}
function examJumpTo(id) {
  if (!exam.docBody || !id) return;
  var btn = exam.docBody.querySelector('.exam-catalog [data-exam-model="' + id + '"]');
  if (btn) btn.click();
}

/* ---------- 键盘：左右方向键切题（测验弹窗优先，其次真题页） ---------- */
function keyInit() {
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (quiz.mask && quiz.mask.classList.contains('show')) {
      e.preventDefault();
      quizGoto(quiz.index + (e.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (exam.docBody && exam.docBody.querySelector('.exam-page')) {
      e.preventDefault();
      examStep(e.key === 'ArrowRight' ? 1 : -1);
    }
  });
}

function init() {
  quizInit();
  examInit();
  keyInit();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
