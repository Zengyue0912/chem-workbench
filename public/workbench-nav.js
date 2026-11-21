/* ============================================================================
 * 高中化学 3D 考点工作台 — B 组：左侧导航 + 滚动提示 + 原子轨道对比度
 * 配套样式：css/workbench-layout.css。
 *
 * 只做表现层委托与增强，不改动任何原有 JS：
 *   - 导航分册折叠 / 选中项滚动：监听 #navTree 的重渲染（MutationObserver）
 *     与原站的 chem:context 事件（select() 在 updateNavActive 之后派发），
 *     再调整 .nav-book 的 .collapsed 与滚动位置；用户手动展开/收起的
 *     分册只在“选中项变化 / 导航重建”时才按默认规则复位。
 *   - 考点掌握状态：只读 localStorage（chem3d_quiz_<id>，原站课后练习
 *     的最好成绩，见 js/inline-08-ui.js 提交逻辑）；有测验的考点才显示
 *     状态点，无测验数据时为“未开始”，没有测验的考点不显示、不编造。
 *   - 滚动提示：向 .docview / .pt-scroll / .pt-info / .sidebar 注入
 *     sticky 提示条，有更多内容且未到底时显示。
 *   - 原子轨道对比度：元素详情 canvas（#atomCv）的轨道描边由原站
 *     atomDraw() 以 16% / 20% 不透明度绘制；本文件仅对该 canvas 的
 *     2D 上下文做实例级拦截，把两条已知的轨道线颜色提亮、加粗，
 *     不影响其他 canvas，不改原站代码。
 * ========================================================================== */
(function () {
'use strict';

/* ---------- 通用 ---------- */
function $(id) { return document.getElementById(id); }
function debounce(fn, ms) {
  var t = 0;
  return function () {
    var a = arguments, s = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(s, a); }, ms);
  };
}

/* ================= 导航：分册折叠 / 选中滚动 ================= */
var navTree = null, sidebar = null;
var NAV_DONE = false, lastActiveKey = '';

function activeItem() { return navTree ? navTree.querySelector('.sub-item.active') : null; }
function activeKey(el) {
  return el ? ((el.getAttribute('data-kind') || '') + '\n' + (el.getAttribute('data-id') || '')) : '';
}
function bookOf(body) {
  var b = body && body.previousElementSibling;
  return b && b.classList.contains('nav-book') ? b : null;
}
function scrollToActive(el) {
  if (!el || !sidebar) return;
  requestAnimationFrame(function () {
    try {
      if (typeof el.scrollIntoView === 'function') { el.scrollIntoView({ block: 'nearest' }); return; }
      var r = el.getBoundingClientRect(), sr = sidebar.getBoundingClientRect();
      if (r.top < sr.top) sidebar.scrollTop -= (sr.top - r.top);
      else if (r.bottom > sr.bottom) sidebar.scrollTop += (r.bottom - sr.bottom);
    } catch (e) { /* 滚动失败不影响主流程 */ }
  });
}

/* 默认只展开当前选中项所在分册，其余折叠。opts.structural 为真表示
 * renderNav 重建了节点（需复位）；仅 reorderNav 移动节点时不复位，
 * 以免打断用户手动展开的分册。 */
function applyNavState(opts) {
  if (!navTree) return;
  var act = activeItem();
  var key = activeKey(act);
  var actBook = null;
  if (act) actBook = bookOf(act.closest('.book-body'));
  var structural = !!(opts && opts.structural);
  var keyChanged = (key !== lastActiveKey);
  if (!NAV_DONE || structural || keyChanged) {
    navTree.querySelectorAll('.nav-book').forEach(function (bk) {
      bk.classList.toggle('collapsed', bk !== actBook);
    });
    NAV_DONE = true;
  }
  /* 标记已处理过的分组：重建产生的新节点无此标记，移动的旧节点有。 */
  navTree.querySelectorAll('.nav-group').forEach(function (g) { g.dataset.wbNav = '1'; });
  if (keyChanged || (opts && opts.scroll)) {
    lastActiveKey = key;
    if (act) scrollToActive(act);
  }
  updateMastery();
  var sb = sidebar;
  if (sb) updateCue(sb);
}

var pendingStructural = false;
var scheduleApply = debounce(function () {
  var s = pendingStructural;
  pendingStructural = false;
  applyNavState({ structural: s });
}, 80);

function watchNav() {
  if (!navTree || !window.MutationObserver) return;
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (n.nodeType !== 1) continue;
        if (n.classList && n.classList.contains('nav-group') && !n.dataset.wbNav) pendingStructural = true;
        if (n.querySelectorAll) {
          var gs = n.querySelectorAll('.nav-group');
          for (var k = 0; k < gs.length; k++) {
            if (!gs[k].dataset.wbNav) { pendingStructural = true; break; }
          }
        }
        if (pendingStructural) break;
      }
      if (pendingStructural) break;
    }
    scheduleApply();
  });
  mo.observe(navTree, { childList: true, subtree: true });
}

/* ---------- 收起全部 / 展开全部 + 掌握状态图例 ---------- */
function injectNavCtl() {
  if (!sidebar || $('wbNavCtl')) return;
  var ctl = document.createElement('div');
  ctl.className = 'wb-navctl';
  ctl.id = 'wbNavCtl';
  ctl.innerHTML = '<div class="wb-navctl-row">'
    + '<button type="button" data-wb-nav="collapse" aria-label="收起全部导航分组">全部收起</button>'
    + '<button type="button" data-wb-nav="expand" aria-label="展开全部导航分组">全部展开</button></div>'
    + '<div class="wb-legend" title="按课后练习最佳成绩：≥75% 已掌握，50%–74% 学习中，低于 50% 薄弱；有练习未作答为未开始">'
    + '<span class="wb-lg"><i class="wb-lg-dot" data-state="done"></i>已掌握</span>'
    + '<span class="wb-lg"><i class="wb-lg-dot" data-state="doing"></i>学习中</span>'
    + '<span class="wb-lg"><i class="wb-lg-dot" data-state="weak"></i>薄弱</span>'
    + '<span class="wb-lg"><i class="wb-lg-dot" data-state="todo"></i>未开始</span></div>';
  /* 注入 #sidebar（而非 #navTree）：reorderNav 会拆掉 #navTree 下所有
   * 非 .nav-group 子节点，放在这里才不会被重排逻辑移除。 */
  var tree = $('navTree');
  if (tree && tree.parentNode === sidebar) sidebar.insertBefore(ctl, tree);
  else sidebar.insertBefore(ctl, sidebar.firstChild);
  ctl.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-wb-nav]') : null;
    if (!b) return;
    if (b.getAttribute('data-wb-nav') === 'collapse') collapseAll();
    else expandAll();
  });
}
function collapseAll() {
  if (!navTree) return;
  var act = activeItem(), actBook = null, actSub = null;
  if (act) { actBook = bookOf(act.closest('.book-body')); actSub = act.closest('.subnav'); }
  navTree.querySelectorAll('.nav-book').forEach(function (bk) {
    bk.classList.toggle('collapsed', bk !== actBook);
  });
  navTree.querySelectorAll('.subnav').forEach(function (sn) {
    var open = (sn === actSub);
    sn.classList.toggle('open', open);
    var cat = sn.previousElementSibling;
    if (cat && cat.classList.contains('nav-cat')) cat.classList.toggle('open', open);
  });
  if (act) scrollToActive(act);
}
function expandAll() {
  if (!navTree) return;
  navTree.querySelectorAll('.nav-book').forEach(function (bk) { bk.classList.remove('collapsed'); });
  navTree.querySelectorAll('.subnav').forEach(function (sn) {
    sn.classList.add('open');
    var cat = sn.previousElementSibling;
    if (cat && cat.classList.contains('nav-cat')) cat.classList.add('open');
  });
  var act = activeItem();
  if (act) scrollToActive(act);
}

/* ================= 考点掌握状态（只读本地测验成绩） ================= */
/* 数据来源：原站课后练习提交时写入的 chem3d_quiz_<id> = {score, total, ts}
 *（最好成绩，见 inline-08-ui.js 615–616 行）。达标线沿用原站规则
 *（≥ ceil(total×0.75)，见 renderInspector 的“已达标”判断）。
 * 注意：原站成绩键只有 id、没有 kind，且 sub/mol/exp 间存在同名 id
 *（如 nacl、na）；因此只对“自身在 DB 里确有 quiz 数组”的考点显示状态，
 * 避免把实验的成绩错标到同名物品/分子上。 */
var QUIZ_SET = null; /* "kind\nid" -> true：该考点有课后练习 */
function buildQuizSet() {
  if (QUIZ_SET) return QUIZ_SET;
  var set = {};
  try {
    var DB = window.DB || {};
    var map = { sub: 'subs', app: 'app', mol: 'mols', exp: 'exps' };
    Object.keys(map).forEach(function (k) {
      var arr = DB[map[k]];
      if (!Array.isArray(arr)) return;
      arr.forEach(function (it) {
        if (it && Array.isArray(it.quiz) && it.quiz.length) set[k + '\n' + it.id] = true;
      });
    });
  } catch (e) { /* DB 不可读时退化为成绩驱动 */ }
  QUIZ_SET = set;
  return set;
}
function readQuiz(id) {
  try {
    var raw = window.localStorage.getItem('chem3d_quiz_' + id);
    if (raw === null) return null;
    var v = JSON.parse(raw);
    if (!v || typeof v.score !== 'number' || typeof v.total !== 'number' || v.total <= 0) return null;
    return v;
  } catch (e) { return null; }
}
function hasQuiz(kind, id) {
  var set = buildQuizSet();
  if (Object.keys(set).length === 0) return readQuiz(id) !== null; /* DB 不可用时退化 */
  return !!set[kind + '\n' + id];
}
function masteryState(v) {
  if (v.score >= Math.ceil(v.total * 0.75)) return 'done';
  if (v.score / v.total >= 0.5) return 'doing';
  return 'weak';
}
function updateMastery() {
  if (!navTree) return;
  navTree.querySelectorAll('.sub-item').forEach(function (btn) {
    var kind = btn.getAttribute('data-kind') || '';
    var id = btn.getAttribute('data-id') || '';
    var dot = btn.querySelector('.wb-mastery');
    if (!id || !hasQuiz(kind, id)) { if (dot) dot.remove(); return; }
    var v = readQuiz(id);
    var state, label;
    if (!v) {
      state = 'todo';
      label = '有课后练习，尚未作答 · 未开始';
    } else {
      state = masteryState(v);
      var pct = Math.round(v.score / v.total * 100);
      label = '课后练习最佳 ' + v.score + '/' + v.total + '（' + pct + '%）· '
        + (state === 'done' ? '已掌握' : (state === 'doing' ? '学习中' : '薄弱'));
    }
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'wb-mastery';
      dot.setAttribute('role', 'img');
      btn.appendChild(dot);
    }
    if (dot.getAttribute('data-state') !== state) dot.setAttribute('data-state', state);
    if (dot.getAttribute('aria-label') !== label) dot.setAttribute('aria-label', label);
    if (dot.title !== label) dot.title = label;
  });
}

/* ================= 滚动提示（渐变遮罩 +“向下滚动”） ================= */
var CUE_TEXT = '向下滚动 ▾';
function directCue(sc) {
  var ch = sc.children;
  for (var i = 0; i < ch.length; i++) {
    if (ch[i].classList && ch[i].classList.contains('wb-scrollcue')) return ch[i];
  }
  return null;
}
function ensureCue(sc) {
  if (!sc) return null;
  var cue = directCue(sc);
  if (!cue) {
    cue = document.createElement('div');
    cue.className = 'wb-scrollcue';
    cue.setAttribute('aria-hidden', 'true');
    var pill = document.createElement('span');
    pill.className = 'wb-cue-pill';
    pill.textContent = CUE_TEXT;
    cue.appendChild(pill);
    sc.appendChild(cue);
  }
  return cue;
}
function updateCue(sc) {
  var cue = ensureCue(sc);
  if (!cue) return;
  var show = (sc.scrollHeight > sc.clientHeight + 4)
    && (sc.scrollTop + sc.clientHeight < sc.scrollHeight - 4);
  cue.classList.toggle('wb-cue-off', !show);
}
function watchScroller(sc) {
  if (!sc || sc.dataset.wbCue) return;
  sc.dataset.wbCue = '1';
  sc.addEventListener('scroll', function () { updateCue(sc); }, { passive: true });
  updateCue(sc);
}

/* ================= 元素详情：左栏提示 + 原子轨道对比度 ================= */
var ORBIT_BOOST = {
  'rgba(18,72,60,.16)': 'rgba(18,72,60,.5)',     /* 浅色：等效对比 1.31:1 → 约 2.6:1 */
  'rgba(226,248,240,.20)': 'rgba(226,248,240,.62)' /* 深色：等效对比 1.83:1 → 约 6.3:1 */
};
function patchAtomCanvas(cv) {
  if (!cv || cv.__wbOrbit) return;
  var ctx = null;
  try { ctx = cv.getContext && cv.getContext('2d'); } catch (e) { return; }
  if (!ctx) return;
  var proto = null, ssDesc = null, lwDesc = null;
  try {
    proto = Object.getPrototypeOf(ctx);
    ssDesc = Object.getOwnPropertyDescriptor(proto, 'strokeStyle');
    lwDesc = Object.getOwnPropertyDescriptor(proto, 'lineWidth');
  } catch (e) { return; }
  if (!ssDesc || typeof ssDesc.set !== 'function' || typeof ssDesc.get !== 'function'
    || !lwDesc || typeof lwDesc.set !== 'function' || typeof lwDesc.get !== 'function') return;
  try {
    /* 仅拦截原站 atomDraw 写出的两条轨道线颜色；线宽 1 → 1.8。
     * atomDraw 先写 strokeStyle 再写 lineWidth，顺序与此一致。 */
    var orbit = false;
    Object.defineProperty(ctx, 'strokeStyle', {
      configurable: true, enumerable: true,
      get: function () { return ssDesc.get.call(ctx); },
      set: function (v) {
        orbit = Object.prototype.hasOwnProperty.call(ORBIT_BOOST, v);
        ssDesc.set.call(ctx, orbit ? ORBIT_BOOST[v] : v);
      }
    });
    Object.defineProperty(ctx, 'lineWidth', {
      configurable: true, enumerable: true,
      get: function () { return lwDesc.get.call(ctx); },
      set: function (v) { lwDesc.set.call(ctx, (orbit && v === 1) ? 1.8 : v); }
    });
    cv.__wbOrbit = true;
  } catch (e) { /* 宿主对象不可定义属性时静默放弃，不影响详情页 */ }
}
function setupPtDetail() {
  var info = document.querySelector('.pt-info');
  if (info) { watchScroller(info); updateCue(info); }
  var cv = $('atomCv');
  if (cv) patchAtomCanvas(cv);
}
function watchPtDlg() {
  var dlg = $('ptDlg');
  if (!dlg || !window.MutationObserver) return;
  /* openPTDetail 每次重写 #ptDlg 的 innerHTML，左栏提示与 canvas 补丁
   * 都要随之重建；补丁有 __wbOrbit 标记，不会重复安装。 */
  var mo = new MutationObserver(function () { setupPtDetail(); });
  mo.observe(dlg, { childList: true });
}

/* ================= 初始化 ================= */
function init() {
  navTree = $('navTree');
  sidebar = $('sidebar');
  injectNavCtl();
  watchNav();
  watchPtDlg();
  var doc = $('viewDoc');
  var pts = document.querySelector('.pt-scroll');
  [doc, pts, sidebar].forEach(function (sc) { if (sc) watchScroller(sc); });
  setupPtDetail();
  /* 内容变化 / 尺寸变化时重算提示显隐 */
  if (window.MutationObserver) {
    var cueUpd = debounce(function () {
      [doc, pts, sidebar].forEach(function (sc) { if (sc) updateCue(sc); });
      var info = document.querySelector('.pt-info');
      if (info) updateCue(info);
    }, 150);
    if (doc) new MutationObserver(cueUpd).observe(doc, { childList: true, subtree: true });
    var grid = $('ptGrid');
    if (grid) new MutationObserver(cueUpd).observe(grid, { childList: true });
  }
  window.addEventListener('resize', debounce(function () {
    [doc, pts, sidebar].forEach(function (sc) { if (sc) updateCue(sc); });
  }, 150));
  /* 选中变化：原站 select() 在 updateNavActive 之后派发 chem:context */
  window.addEventListener('chem:context', function () { scheduleApply(); });
  /* 课后练习提交：原站按钮级监听先于 document 冒泡监听执行，
   * localStorage 已写入后再重算掌握状态。预习自测不写成绩键，不受影响。 */
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#qSubmit')) {
      setTimeout(updateMastery, 120);
    }
  });
  /* 跨标签页成绩变化 + 回到页面时重算 */
  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf('chem3d_quiz_') === 0) updateMastery();
  });
  window.addEventListener('focus', function () { updateMastery(); });
  applyNavState({ structural: true, scroll: true });
  updateMastery();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
