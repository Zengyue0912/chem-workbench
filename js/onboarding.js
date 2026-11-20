/* ============================================================================
 * 高中化学 3D 考点工作台 — 新手引导（工作流 2：商业化产品外壳）
 * ============================================================================
 * 首次进入工作台（app.html）时展示 3 步浮层，介绍导航树、3D 实验与
 * AI 助手；看完或跳过后记入 localStorage，之后不再自动出现。
 * “已看过”标记按账号存放（ChemAuth.scopedKey），不同账号各看一次；
 * ChemAuth 不可用时退回全局键 chem3d_onboard_seen_v1。
 * 可在账号菜单里点“重新查看新手引导”随时再看（ChemOnboarding.show(true)）。
 * ========================================================================== */
(function () {
'use strict';

var GLOBAL_SEEN_KEY = 'chem3d_onboard_seen_v1';

var STEPS = [
  {
    target: '#navTree',
    title: '第 1 步 · 考点导航树',
    text: '左侧是按教材章节整理的考点导航：试剂、仪器、分子、实验都在这里。点任意一项，右侧 3D 舞台会立刻打开对应模型；顶部的搜索框也可以直接搜。'
  },
  {
    target: '#viewport',
    title: '第 2 步 · 3D 实验舞台',
    text: '中间是 3D 实验舞台：拖拽旋转、滚轮缩放、双击复位。选“酸碱中和滴定”可以亲手操作滴定、记录数据并生成实验报告；分子支持同屏对比。'
  },
  {
    target: '#btnAssistant',
    title: '第 3 步 · AI 助手',
    text: '点右上角“化学助教”随时提问，它会结合当前模型或实验步骤回答。默认是演示模式（内置规则回答）；点助教面板的“AI 设置”可以接通你自己的 API。'
  }
];

function seenKey() {
  if (window.ChemAuth && typeof window.ChemAuth.scopedKey === 'function') {
    return window.ChemAuth.scopedKey('onboard_seen');
  }
  return GLOBAL_SEEN_KEY;
}
function isSeen() {
  try { return localStorage.getItem(seenKey()) === '1'; } catch (e) { return true; }
}
function markSeen() {
  try { localStorage.setItem(seenKey(), '1'); } catch (e) {}
}
function reset() {
  try { localStorage.removeItem(seenKey()); } catch (e) {}
}

function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

var current = 0;
var mask = null, ring = null, card = null;
var onResize = null;

function targetRect(step) {
  var t = document.querySelector(step.target);
  if (!t) return null;
  var r = t.getBoundingClientRect();
  /* 目标不可见（移动端侧栏收起等）时返回 null，卡片居中展示。 */
  if (r.width < 8 || r.height < 8) return null;
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return null;
  return r;
}

function position() {
  var step = STEPS[current];
  var r = targetRect(step);
  if (r) {
    ring.style.display = 'block';
    ring.style.top = Math.max(4, r.top - 6) + 'px';
    ring.style.left = Math.max(4, r.left - 6) + 'px';
    ring.style.width = (r.width + 12) + 'px';
    ring.style.height = (r.height + 12) + 'px';
  } else {
    ring.style.display = 'none';
  }
  /* 卡片优先放在目标下方；空间不足则放上方；窄屏/无目标时居中。 */
  card.style.top = '';
  card.style.left = '';
  card.classList.remove('chem2-ob-center');
  var cw = Math.min(card.offsetWidth || 340, window.innerWidth - 24);
  if (!r || window.innerWidth < 720) {
    card.classList.add('chem2-ob-center');
    return;
  }
  var top = r.bottom + 16;
  if (top + card.offsetHeight > window.innerHeight - 12) {
    top = Math.max(12, r.top - card.offsetHeight - 16);
  }
  var left = Math.min(Math.max(12, r.left), window.innerWidth - cw - 12);
  card.style.top = top + 'px';
  card.style.left = left + 'px';
}

function render() {
  var step = STEPS[current];
  card.querySelector('.chem2-ob-title').textContent = step.title;
  card.querySelector('.chem2-ob-text').textContent = step.text;
  var dots = card.querySelectorAll('.chem2-ob-dot');
  dots.forEach(function (d, i) { d.classList.toggle('on', i === current); });
  card.querySelector('.chem2-ob-prev').style.visibility = current === 0 ? 'hidden' : 'visible';
  card.querySelector('.chem2-ob-next').textContent = current === STEPS.length - 1 ? '开始使用' : '下一步';
  card.querySelector('.chem2-ob-skip').style.display = current === STEPS.length - 1 ? 'none' : '';
  requestAnimationFrame(position);
}

function finish() {
  markSeen();
  close();
}
function close() {
  if (onResize) {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onResize, true);
    onResize = null;
  }
  if (mask) { mask.remove(); mask = null; ring = null; card = null; }
}

function build() {
  mask = el('div', 'chem2-ob-mask');
  mask.setAttribute('role', 'dialog');
  mask.setAttribute('aria-modal', 'true');
  mask.setAttribute('aria-label', '新手引导');
  ring = el('div', 'chem2-ob-ring');
  card = el('div', 'chem2-ob-card');
  var dots = el('div', 'chem2-ob-dots');
  STEPS.forEach(function () { dots.appendChild(el('span', 'chem2-ob-dot')); });
  var title = el('h2', 'chem2-ob-title', '');
  var text = el('p', 'chem2-ob-text', '');
  var actions = el('div', 'chem2-ob-actions');
  var prev = el('button', 'btn-sub chem2-ob-prev', '上一步');
  prev.type = 'button';
  var skip = el('button', 'btn-sub chem2-ob-skip', '跳过引导');
  skip.type = 'button';
  var next = el('button', 'btn-main chem2-ob-next', '下一步');
  next.type = 'button';
  actions.append(prev, skip, next);
  card.append(dots, title, text, actions);
  mask.append(ring, card);
  document.body.appendChild(mask);

  prev.addEventListener('click', function () {
    if (current > 0) { current -= 1; render(); }
  });
  next.addEventListener('click', function () {
    if (current < STEPS.length - 1) { current += 1; render(); }
    else finish();
  });
  skip.addEventListener('click', finish);
  mask.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); finish(); }
    if (e.key === 'ArrowRight' && current < STEPS.length - 1) { current += 1; render(); }
    if (e.key === 'ArrowLeft' && current > 0) { current -= 1; render(); }
  });
  onResize = function () { position(); };
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onResize, true);
  render();
  next.focus();
}

function show(force) {
  if (!force && isSeen()) return false;
  if (mask) return true;
  current = 0;
  build();
  return true;
}

/* 首次进入：等骨架屏撤掉、界面稳定后再出现（约 1 秒）。 */
function maybeShow() {
  if (isSeen()) return;
  setTimeout(function () { show(false); }, 1000);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', maybeShow);
} else {
  maybeShow();
}

window.ChemOnboarding = { show: show, close: close, reset: reset, isSeen: isSeen };

})();
