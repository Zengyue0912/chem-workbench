/* ============================================================================
 * 高中化学 3D 考点工作台 — 概念图谱迷你导航（工作流 4 / D 组）
 * 配套样式：css/workbench-learn.css（.wbl-cmap*）。
 *
 * 核对结果（见任务汇报）：考点数据里没有明确的关联字段——
 *   DB.subs / app / mols / exps 只有 sub（章节代码，如 bx1c1）、
 *   subName（章节名）与 tags（标签数组），没有 related / prereq /
 *   next 等字段。inline-09-studio.js 里教案数据的 related 指向的是
 *   同步练习题编号（s01、e01 等），不是考点条目，不能用于考点导航。
 * 因此本模块按任务要求用“同章节 + 同标签”推断关联，并在界面上如实
 * 标注“同章节 · 同标签推断，非教材指定顺序”：
 *   - 前置考点：同章节（sub 相同）中排在当前考点之前的条目（按
 *     物品 → 仪器 → 分子 → 实验的种类顺序，再按原数据顺序），
 *     取最近的 3 个；
 *   - 关联考点：同章节中排在当前考点之后的条目 + 共享 ≥1 个标签的
 *     其他章节条目（共享标签数多的优先），取 4 个。
 *
 * 挂载方式（不改原有 JS）：监听 window 'chem:context' 事件（每次
 * select()/showHome() 都会派发）与 #inspector 的 MutationObserver，
 * 在详情面板 .insp-body 顶部插入迷你导航；当前考点通过公开接口
 * window.ChemTutor.current()（或 ChemStudio.context()）读取；
 * 点击跳转复用全局 window.select(kind, id)。
 * 本模块不写任何 localStorage。
 * ========================================================================== */
(function () {
'use strict';

function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

var KIND_LABEL = { sub: '物品', app: '仪器', mol: '分子', exp: '实验' };
var KIND_ORDER = { sub: 0, app: 1, mol: 2, exp: 3 };
var MAX_PREV = 3;
var MAX_RELATED = 4;

/* ---------- 数据读取（只读 window.DB） ---------- */
function allItems() {
  var db = window.DB || {};
  var out = [];
  [['sub', 'subs'], ['app', 'app'], ['mol', 'mols'], ['exp', 'exps']].forEach(function (pair) {
    var arr = db[pair[1]];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (it) {
      out.push({ kind: pair[0], id: it.id, name: it.name,
        sub: it.sub || '', subName: it.subName || '', tags: it.tags || [] });
    });
  });
  return out;
}
function findItem(kind, id) {
  var list = allItems();
  for (var i = 0; i < list.length; i++) {
    if (list[i].kind === kind && list[i].id === id) return list[i];
  }
  return null;
}
/* 同章节内的规范顺序：种类顺序 → 原数据顺序（allItems 已按种类分组）。 */
function chapterOrder(a, b) {
  var k = (KIND_ORDER[a.kind] || 0) - (KIND_ORDER[b.kind] || 0);
  return k;
}

/* ---------- 关联推断（纯函数，可单测） ---------- */
function relatedFor(kind, id, items) {
  items = items || allItems();
  var cur = null, i;
  for (i = 0; i < items.length; i++) {
    if (items[i].kind === kind && items[i].id === id) { cur = items[i]; break; }
  }
  if (!cur) return { current: null, prev: [], related: [] };
  var sameChapter = items.filter(function (it) {
    return it.sub && cur.sub && it.sub === cur.sub &&
      !(it.kind === cur.kind && it.id === cur.id);
  });
  /* 当前考点在同章节序列中的位置：种类顺序 + 原数据顺序（稳定排序）。 */
  var pos = 0;
  var withCur = sameChapter.concat([cur]);
  var idx = {};
  items.forEach(function (it, n) { idx[it.kind + ':' + it.id] = n; });
  withCur.sort(function (a, b) {
    var k = chapterOrder(a, b);
    return k !== 0 ? k : (idx[a.kind + ':' + a.id] - idx[b.kind + ':' + b.id]);
  });
  for (i = 0; i < withCur.length; i++) {
    if (withCur[i].kind === cur.kind && withCur[i].id === cur.id) { pos = i; break; }
  }
  var prev = withCur.slice(0, pos).slice(-MAX_PREV).reverse();
  var after = withCur.slice(pos + 1);
  /* 关联：先同章节之后的条目，再按共享标签数排序的其他条目。 */
  var related = after.slice();
  var seen = {};
  related.forEach(function (it) { seen[it.kind + ':' + it.id] = 1; });
  seen[cur.kind + ':' + cur.id] = 1;
  var tagScored = [];
  items.forEach(function (it) {
    var key = it.kind + ':' + it.id;
    if (seen[key]) return;
    var shared = 0;
    (it.tags || []).forEach(function (t) {
      if ((cur.tags || []).indexOf(t) !== -1) shared += 1;
    });
    if (shared > 0) tagScored.push({ it: it, shared: shared });
  });
  tagScored.sort(function (a, b) {
    if (b.shared !== a.shared) return b.shared - a.shared;
    return (idx[a.it.kind + ':' + a.it.id] || 0) - (idx[b.it.kind + ':' + b.it.id] || 0);
  });
  tagScored.forEach(function (s) { related.push(s.it); });
  return { current: cur, prev: prev, related: related.slice(0, MAX_RELATED) };
}

/* ---------- 当前考点 ---------- */
function currentSelection() {
  try {
    if (window.ChemTutor && typeof window.ChemTutor.current === 'function') {
      var c = window.ChemTutor.current();
      if (c && c.kind && c.id) return { kind: c.kind, id: c.id, name: c.name || '' };
    }
  } catch (e) {}
  try {
    if (window.ChemStudio && typeof window.ChemStudio.context === 'function') {
      var c2 = window.ChemStudio.context();
      if (c2 && c2.kind && c2.id) return { kind: c2.kind, id: c2.id, name: c2.name || '' };
    }
  } catch (e) {}
  return null;
}

/* ---------- 渲染 ---------- */
var lastKey = '';
function chip(it, extraClass) {
  return '<button type="button" class="wbl-cmap-chip ' + (extraClass || '') +
    '" data-wbl-goto-kind="' + esc(it.kind) + '" data-wbl-goto-id="' + esc(it.id) +
    '" title="' + esc((it.subName || '') + ' · ' + (KIND_LABEL[it.kind] || '')) + '">' +
    esc(it.name) + '</button>';
}
function render() {
  var ins = $('inspector');
  if (!ins) return;
  var body = ins.querySelector('.insp-body');
  if (!body) { lastKey = ''; return; }
  var sel = currentSelection();
  /* 周期表 3D 大厅（kind==='pt'）与无选中状态不显示图谱。 */
  if (!sel || sel.kind === 'pt') {
    var stale = body.querySelector('[data-wbl-cmap]');
    if (stale) stale.remove();
    lastKey = '';
    return;
  }
  var key = sel.kind + ':' + sel.id;
  var existing = body.querySelector('[data-wbl-cmap]');
  if (existing && lastKey === key) return;
  if (existing) existing.remove();
  var rel = relatedFor(sel.kind, sel.id);
  if (!rel.current || (!rel.prev.length && !rel.related.length)) {
    lastKey = key;
    return;
  }
  var nav = document.createElement('nav');
  nav.className = 'wbl-cmap';
  nav.setAttribute('data-wbl-cmap', '1');
  nav.setAttribute('aria-label', '概念图谱迷你导航');
  var html = '<div class="wbl-cmap-head"><strong>概念图谱</strong>' +
    '<span class="wbl-demo-badge">推断关联</span></div>';
  html += '<div class="wbl-cmap-cur">当前：' + esc(rel.current.name) +
    '（' + esc(rel.current.subName || KIND_LABEL[rel.current.kind] || '') + '）</div>';
  if (rel.prev.length) {
    html += '<div class="wbl-cmap-row"><span class="wbl-cmap-label">前置考点</span>' +
      '<span class="wbl-cmap-chips">' + rel.prev.map(function (it) { return chip(it, 'prev'); }).join('') + '</span></div>';
  }
  if (rel.related.length) {
    html += '<div class="wbl-cmap-row"><span class="wbl-cmap-label">关联考点</span>' +
      '<span class="wbl-cmap-chips">' + rel.related.map(function (it) { return chip(it, 'rel'); }).join('') + '</span></div>';
  }
  html += '<p class="wbl-cmap-note">前置 / 关联由“同章节 + 同标签”推断，非教材指定顺序；点击可跳转。</p>';
  nav.innerHTML = html;
  /* 放在详情面板顶部（问助教按钮之前，便于第一时间看到导航）。 */
  body.insertBefore(nav, body.firstChild);
  lastKey = key;
}

/* ---------- 初始化 ---------- */
function init() {
  render();
  var ins = $('inspector');
  if (ins && window.MutationObserver) {
    var timer = 0;
    new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(render, 60);
    }).observe(ins, { childList: true, subtree: false });
  }
  /* select() 在 renderInspector 之后派发 chem:context，是最准的刷新时机。 */
  window.addEventListener('chem:context', function () {
    setTimeout(render, 60);
  });
  /* 点击跳转：事件委托，复用全局 select(kind, id)。 */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-wbl-goto-kind]') : null;
    if (!b) return;
    var kind = b.getAttribute('data-wbl-goto-kind');
    var id = b.getAttribute('data-wbl-goto-id');
    if (kind && id && typeof window.select === 'function') {
      e.preventDefault();
      window.select(kind, id);
    }
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ---------------- 对外接口 ---------------- */
window.ChemConceptMap = {
  relatedFor: relatedFor,
  allItems: allItems,
  current: currentSelection,
  refresh: render
};

})();
