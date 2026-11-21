/* ============================================================================
 * 高中化学 3D 考点工作台 — 搜索联动（工作流 4 / C 组）
 * 配套样式：css/workbench-controls.css（同步高亮、考点入口行）。
 *
 * 方案：联动，不删除任一搜索框。理由——两个搜索框的语料不同：
 *   - 顶栏全局搜索（#searchInput，js/inline-08-ui.js searchAll）：搜试剂 /
 *     仪器 / 分子 / 实验 4 类物品，下拉直达 3D 对象；
 *   - 首页“找一个考点”（#cwTopicQuery，js/chem-spatial.js openCenter）：
 *     搜考点专题 + 题型 SOP，打开找考点结果页。
 *   删任何一个都会丢失一类检索能力。联动后用户在一个入口能看到两个
 *   维度的结果：
 *   1) 首页搜索框输入时，关键词同步到顶栏搜索框并触发其原有 input 处理，
 *      顶栏下拉自动弹出物品结果，搜索框亮起一圈提示；不抢焦点（避免打断
 *      正在输入的手指/键盘），首页框的回车提交行为保持不变。
 *   2) 顶栏搜索有关键词时，下拉末尾追加一行“在考点专题中搜索「关键词」→”，
 *      点击后复用 chem-spatial 已有的 document 级 submit 监听（派发一个
 *      隐藏的 .cw-search 表单提交事件）打开找考点结果页；spatial / study
 *      bundle 尚未加载时先经 ChemLazy 按需加载再提交。
 *   3) 顶栏输入时，若首页搜索框在当前页面可见，也反向同步其内容。
 * ========================================================================== */
(function () {
'use strict';

var syncing = false; /* 程序化同步时抑制回环 */
var pulseTimer = 0;

function $(id) { return document.getElementById(id); }
/* 短暂高亮一个搜索框，提示用户“结果已同步到这里” */
function pulse(box) {
  if (!box) return;
  box.classList.remove('wb-sync');
  /* 强制重排以便重复触发动画 */
  void box.offsetWidth;
  box.classList.add('wb-sync');
  window.clearTimeout(pulseTimer);
  pulseTimer = window.setTimeout(function () { box.classList.remove('wb-sync'); }, 1200);
}

/* 把关键词同步到顶栏搜索框，并触发原有 input 处理弹出下拉 */
function syncToTopbar(keyword) {
  var top = $('searchInput');
  if (!top) return;
  if (top.value === keyword) return;
  syncing = true;
  try {
    top.value = keyword;
    top.dispatchEvent(new Event('input', { bubbles: true }));
  } finally {
    syncing = false;
  }
  var box = top.closest ? top.closest('.searchbox') : null;
  if (keyword) pulse(box);
}

/* 把关键词同步到首页“找一个考点”搜索框（仅当它在当前页面存在时） */
function syncToHome(keyword) {
  var home = $('cwTopicQuery');
  if (!home) return;
  if (home.value === keyword) return;
  syncing = true;
  try { home.value = keyword; } finally { syncing = false; }
  /* chem-spatial 只在 submit 时读取该框，不会因赋值产生回环 */
}

/* ---------- 顶栏下拉：追加“在考点专题中搜索”入口行 ---------- */
function ensureTopicRow() {
  var drop = $('searchDrop');
  var top = $('searchInput');
  if (!drop || !top) return;
  var kw = top.value.trim();
  var old = drop.querySelector('.wb-search-topic');
  if (!kw || !drop.classList.contains('show')) {
    if (old) old.remove();
    return;
  }
  if (old) {
    /* 关键词变了就更新文案（原下拉每次输入都会重建 innerHTML，行会被清掉重建） */
    var b = old.querySelector('b');
    if (b && b.textContent !== kw) b.textContent = kw;
    return;
  }
  var row = document.createElement('div');
  row.className = 'sd-item wb-search-topic';
  row.setAttribute('role', 'button');
  row.setAttribute('tabindex', '0');
  row.innerHTML = '<span>在考点专题中搜索「<b></b>」</span>' +
    '<span class="wb-search-topic-arrow" aria-hidden="true">→</span>';
  row.querySelector('b').textContent = kw;
  drop.appendChild(row);
}

/* 复用 chem-spatial 的 document 级 submit 监听打开找考点结果页 */
function openTopicSearch(keyword) {
  var submitForm = function () {
    var form = document.createElement('form');
    form.className = 'cw-search';
    form.dataset.cwSearch = 'topics';
    form.style.display = 'none';
    var input = document.createElement('input');
    input.name = 'query';
    input.value = keyword;
    form.appendChild(input);
    document.body.appendChild(form);
    /* chem-spatial.js 监听 document 的 submit 事件（data-cw-search="topics"），
       派发冒泡的 submit 事件即可触发 openCenter(keyword) */
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    if (form.parentNode) form.parentNode.removeChild(form);
  };
  var top = $('searchInput');
  var drop = $('searchDrop');
  if (top) top.value = '';
  if (drop) drop.classList.remove('show');
  syncToHome(keyword);
  /* spatial（chem-spatial.js 的 submit 监听）与 study（openCenter 读取的
     ChemPreparedSop）均为懒加载 bundle，未就绪时先加载再提交 */
  var needSpatial = !window.ChemSpatial;
  var needStudy = !window.ChemPreparedSop;
  if ((needSpatial || needStudy) && window.ChemLazy && typeof window.ChemLazy.load === 'function') {
    var jobs = [];
    if (needSpatial) jobs.push(window.ChemLazy.load('spatial').catch(function () {}));
    if (needStudy) jobs.push(window.ChemLazy.load('study').catch(function () {}));
    Promise.all(jobs).then(submitForm);
  } else {
    submitForm();
  }
}

function init() {
  var top = $('searchInput');
  var drop = $('searchDrop');
  if (!top || !drop) return;

  /* 双向同步：两个搜索框都会被原逻辑重渲染（首页框随 home()/openCenter 重建），
     因此用 document 级 input 委托。 */
  document.addEventListener('input', function (e) {
    if (syncing || !e.target) return;
    if (e.target.id === 'cwTopicQuery') {
      syncToTopbar(e.target.value);
    } else if (e.target.id === 'searchInput') {
      syncToHome(e.target.value);
    }
  });

  /* 顶栏下拉每次输入都会重建 innerHTML，入口行需在每次变化后补上 */
  if ('MutationObserver' in window) {
    new MutationObserver(function () { ensureTopicRow(); })
      .observe(drop, { childList: true });
    /* 下拉开关（class 变化）时也同步一次入口行 */
    new MutationObserver(function () { ensureTopicRow(); })
      .observe(drop, { attributes: true, attributeFilter: ['class'] });
  }

  /* 入口行点击 / 回车：打开找考点结果页 */
  drop.addEventListener('click', function (e) {
    var row = e.target.closest ? e.target.closest('.wb-search-topic') : null;
    if (!row) return;
    var kw = ($('searchInput') || {}).value || '';
    kw = kw.trim();
    if (kw) openTopicSearch(kw);
  });
  drop.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var row = e.target.closest ? e.target.closest('.wb-search-topic') : null;
    if (!row) return;
    e.preventDefault();
    var kw = ($('searchInput') || {}).value || '';
    kw = kw.trim();
    if (kw) openTopicSearch(kw);
  });

  ensureTopicRow();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
