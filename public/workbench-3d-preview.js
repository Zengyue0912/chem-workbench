/* ============================================================================
 * 高中化学 3D 考点工作台 — 3D 预览交互（工作流 4 · A 组）
 *
 * 背景：首页 / 考点页 / 资源浏览的模型预览原本是静态 <img>
 * （chem-spatial.js 的 picture() 生成，指向 assets/spatial/*.webp），
 * 且该目录并不存在、图片全部 404；文案却写着"可旋转""转动模型"，
 * 误导用户去拖拽一张不会动的破图。
 *
 * 本文件把每个预览图就地升级为真正可拖拽旋转的小画布：
 *   - 复用现有 Canvas 2.5D 引擎（window.E3）与模型构建器（window.B，
 *     与 inline-08-ui.js 的 select() 同款调用方式），不重写核心逻辑；
 *   - 模型构建器在 viewer3d bundle 里，首次有预览进入视口时才经
 *     ChemLazy.load('viewer3d') 加载一次（与打开任意 3D 对象时加载的
 *     是同一个 bundle，Promise 去重，不会重复加载）；
 *   - E3 的相机是全局单例，每次绘制前保存、绘制后恢复，与主舞台互不干扰；
 *   - 性能限流：同一时间最多 1 个实例自动慢转（最近交互 / 视口内首个），
 *     其余只画静态帧；共享单个 rAF；DPR 上限 1.5；模型按 kind:id 缓存；
 *     隐藏 / 离开视口 / 切到舞台视图时停转；prefers-reduced-motion 时不自动转。
 *
 * 兜底（方案 b）：SIM 驱动的实验（tit / na / flame / asm / drill）模型由
 * SIM.setup* 在内部构建且改写 VW 全局状态，无法安全离线重建；这类预览
 * 以及引擎加载失败 / 模型构建失败的情况，改为引导占位层（图标 + 文字 +
 * 悬停放大），拖拽时 toast 提示"点击进入 3D 视图后可旋转"。
 *
 * 不修改任何原有文件：只读取 window.E3 / window.B / window.DB /
 * window.ChemLazy / window.UI 等公开命名空间，并监听 DOM 变化。
 * ========================================================================== */
(function () {
'use strict';

/* ---------------- 常量与小工具 ---------------- */
var DRAG_PX = 6;            /* 超过该位移视为拖拽，抑制随后那次点击 */
var AUTO_SPEED = 0.25;      /* 自动慢转角速度 rad/s（与首页 H₂O 画布一致） */
var INERTIA = 0.93;         /* 惯性衰减（与主查看器 inline-07-viewer.js 一致） */
var DPR_CAP = 1.5;          /* 预览画布 DPR 上限 */
var TOAST_GAP = 4000;       /* 同一兜底预览拖拽提示的最短间隔（ms） */
var SIM_EXP_IDS = { tit: 1, na: 1, flame: 1, asm_gas: 1, asm_dist: 1, drill_na: 1, drill_h2so4: 1 };

var $ = function (id) { return document.getElementById(id); };
var clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
var reducedMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

var ROTATE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
var ORBIT_ICON = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><ellipse cx="32" cy="32" rx="28" ry="11" transform="rotate(-24 32 32)" opacity=".55"/><ellipse cx="32" cy="32" rx="28" ry="11" transform="rotate(24 32 32)" opacity=".55"/><circle cx="32" cy="32" r="7" fill="currentColor" stroke="none"/><circle cx="52" cy="20" r="3.4" fill="currentColor" stroke="none"/><circle cx="14" cy="44" r="2.6" fill="currentColor" stroke="none"/></svg>';

/* ---------------- 状态 ---------------- */
var registry = [];          /* 所有预览实例 */
var modelCache = {};        /* 'kind:id' -> model | null（不可构建） */
var bundlePromise = null;   /* viewer3d 加载 Promise（只触发一次） */
var active = null;          /* 当前自动旋转的实例（最多 1 个） */
var rafId = 0;
var lastTs = 0;
var toastTimer = null;

/* ---------------- Toast（与 SIM.asmToast 同款写法，复用 #toast） ---------------- */
function showToast(msg) {
  var t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
}

/* ---------------- 模型构建（与 select() 同款调用方式） ---------------- */
function findItem(kind, id) {
  var db = window.DB;
  if (!db) return null;
  var list = kind === 'mol' ? db.mols : kind === 'app' ? db.app :
             kind === 'sub' ? db.subs : kind === 'exp' ? db.exps : null;
  if (!list) return null;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

function buildModel(kind, id) {
  var key = kind + ':' + id;
  if (key in modelCache) return modelCache[key];
  var model = null;
  try {
    var B = window.B;
    var item = findItem(kind, id);
    if (B && item) {
      if (kind === 'mol') {
        model = B.molecule(item, 'ball');
      } else if (kind === 'app') {
        model = (item.model && B.app[item.model.fn]) ? B.app[item.model.fn]() : null;
      } else if (kind === 'sub') {
        /* select() 会直接改写 item.model.txt/txt2；这里克隆一份，避免污染 DB */
        var cfg = {};
        var src = item.model || {};
        for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) cfg[k] = src[k];
        cfg.txt = item.name;
        cfg.txt2 = String(item.formula || '').replace(/<[^>]+>/g, '').replace(/（[^）]*）/g, '').slice(0, 9);
        model = (cfg.kind && B.subs[cfg.kind]) ? B.subs[cfg.kind](cfg) : null;
      } else if (kind === 'exp') {
        /* 只有 sim:'static' 且有 scene 的实验能离线重建；SIM 驱动的实验走兜底 */
        model = (item.sim === 'static' && item.scene && B.app[item.scene]) ? B.app[item.scene]() : null;
      }
    }
  } catch (e) {
    model = null;
  }
  modelCache[key] = model;
  return model;
}

/* viewer3d bundle（B 构建器 + VW）只加载一次；失败时允许下次重试 */
function ensureEngine() {
  if (window.B && window.E3) return Promise.resolve(true);
  if (bundlePromise) return bundlePromise;
  if (window.ChemLazy && window.ChemLazy.load) {
    bundlePromise = window.ChemLazy.load('viewer3d').then(function () {
      return !!(window.B && window.E3);
    }).catch(function () {
      bundlePromise = null;
      return false;
    });
  } else {
    bundlePromise = Promise.resolve(false);
  }
  return bundlePromise;
}

/* ---------------- 相机现场保存 / 恢复（E3.cam 是全局单例） ---------------- */
function saveCam() {
  var c = window.E3.cam;
  return { yaw: c.yaw, pitch: c.pitch, dist: c.dist, fov: c.fov, cx: c.cx, cy: c.cy };
}
function restoreCam(s) {
  var c = window.E3.cam;
  c.yaw = s.yaw; c.pitch = s.pitch; c.dist = s.dist;
  c.fov = s.fov; c.cx = s.cx; c.cy = s.cy;
}

/* ---------------- 绘制 ---------------- */
function fitPreview(inst) {
  var saved = saveCam();
  window.E3.fit(inst.model, Math.max(2, inst.w), Math.max(2, inst.h), 0.86);
  inst.dist = window.E3.cam.dist;
  restoreCam(saved);
}

function drawPreview(inst) {
  var E3 = window.E3;
  if (!E3 || !inst.model || inst.w < 2 || inst.h < 2) return;
  var cam = E3.cam;
  var saved = saveCam();
  cam.yaw = inst.yaw;
  cam.pitch = inst.pitch;
  cam.dist = inst.dist;
  cam.fov = Math.min(inst.w, inst.h) * 0.86;
  cam.cx = inst.w / 2;
  cam.cy = inst.h * 0.47;
  var ctx = inst.ctx;
  ctx.setTransform(inst.dpr, 0, 0, inst.dpr, 0, 0);
  ctx.clearRect(0, 0, inst.w, inst.h);
  try {
    E3.drawFloor(ctx, inst.model);
    E3.render(ctx, inst.model, { explode: 0, labels: false });
  } catch (e) {
    /* 单帧失败不影响其他预览 */
  }
  restoreCam(saved);
  inst.needsDraw = false;
}

function resizePreview(inst) {
  var r = inst.wrap.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  inst.w = r.width;
  inst.h = r.height;
  inst.dpr = dpr;
  inst.canvas.width = Math.max(2, Math.round(r.width * dpr));
  inst.canvas.height = Math.max(2, Math.round(r.height * dpr));
  if (inst.model) fitPreview(inst);
  inst.needsDraw = true;
}

/* ---------------- 共享 rAF 循环（最多 1 个实例自动旋转） ---------------- */
function pickActive() {
  active = null;
  for (var i = 0; i < registry.length; i++) {
    var inst = registry[i];
    if (inst.ready && inst.visible) { active = inst; break; }
  }
}
function setActive(inst) {
  active = inst;
  ensureLoop();
}
function ensureLoop() {
  if (rafId) return;
  lastTs = performance.now();
  rafId = requestAnimationFrame(tick);
}
function tick(ts) {
  var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  var keepGoing = false;
  for (var i = registry.length - 1; i >= 0; i--) {
    var inst = registry[i];
    if (!inst.wrap.isConnected) {
      disposePreview(inst);
      registry.splice(i, 1);
      continue;
    }
    if (!inst.ready) continue;
    /* 自动慢转：仅当前活动实例，且未悬停、未拖拽、可见、页面可见、非减动效 */
    if (active === inst && !inst.hover && !inst.dragging && inst.visible &&
        !reducedMotion && !document.hidden) {
      inst.yaw += dt * AUTO_SPEED;
      inst.needsDraw = true;
    }
    /* 惯性（与主查看器相同的衰减） */
    if (Math.abs(inst.vyaw) > 1e-4 || Math.abs(inst.vpitch) > 1e-4) {
      inst.yaw += inst.vyaw;
      inst.pitch = clamp(inst.pitch + inst.vpitch, -1.45, 1.45);
      inst.vyaw *= INERTIA;
      inst.vpitch *= INERTIA;
      inst.needsDraw = true;
    }
    if (inst.needsDraw && inst.visible) drawPreview(inst);
    if (inst.visible && (active === inst || Math.abs(inst.vyaw) > 1e-4 || Math.abs(inst.vpitch) > 1e-4)) {
      keepGoing = true;
    }
  }
  if (active && (!active.wrap.isConnected || !active.visible)) pickActive();
  if (keepGoing && registry.length) {
    rafId = requestAnimationFrame(tick);
  } else {
    rafId = 0;
  }
}

function disposePreview(inst) {
  if (inst.ro) { inst.ro.disconnect(); inst.ro = null; }
  if (io) { try { io.unobserve(inst.wrap); } catch (e) {} }
  if (active === inst) active = null;
}

/* ---------------- 兜底（方案 b）：引导占位层 ---------------- */
function fallbackPreview(inst, reason) {
  if (inst.failed) return;
  inst.failed = true;
  inst.loading = false;
  inst.wrap.classList.remove('wb3d-loading');
  inst.wrap.classList.add('wb3d-fallback');
  var art = document.createElement('span');
  art.className = 'wb3d-fallback-art';
  var note = reason === 'sim'
    ? '实验模拟需在 3D 视图中播放'
    : '点击进入 3D 视图查看';
  art.innerHTML = ORBIT_ICON + '<b>点击进入 3D 交互</b><small>' + note + '</small>';
  inst.wrap.appendChild(art);
}

/* ---------------- 激活：进入视口后加载引擎并建模 ---------------- */
function activatePreview(inst) {
  if (inst.loading || inst.ready || inst.failed) return;
  inst.loading = true;
  /* SIM 驱动的实验无需加载引擎，直接走兜底 */
  if (inst.kind === 'exp' && SIM_EXP_IDS[inst.id]) {
    fallbackPreview(inst, 'sim');
    return;
  }
  ensureEngine().then(function (ok) {
    if (!inst.wrap.isConnected) return;
    if (!ok) { fallbackPreview(inst, 'engine'); return; }
    var model = buildModel(inst.kind, inst.id);
    if (!model) { fallbackPreview(inst, 'model'); return; }
    inst.model = model;
    inst.ready = true;
    inst.loading = false;
    inst.wrap.classList.remove('wb3d-loading');
    inst.wrap.classList.add('wb3d-live');
    resizePreview(inst);
    drawPreview(inst);
    if (inst.visible && (!active || !active.visible)) setActive(inst);
    ensureLoop();
  });
}

/* ---------------- 点击进入 3D 视图（仅非按钮容器，如考点页 hero） ---------------- */
function openScene(inst) {
  /* 优先点页面上已有的"观察三维模型"按钮：它走 chem-spatial 的 openScene，
     会正确处理滴定等特殊入口；找不到时才直接调 select() */
  var hero = inst.wrap.closest('.cw-topic-hero');
  var btn = hero && hero.querySelector('[data-cw-action="observe"]');
  if (btn) { btn.click(); return; }
  if (typeof window.select === 'function') window.select(inst.kind, inst.id);
}

/* ---------------- 升级一个预览图 ---------------- */
function upgrade(img) {
  var src = img.getAttribute('src') || '';
  var m = /assets\/spatial\/([a-z]+)-([a-z0-9_]+)\.webp/.exec(src);
  if (!m) return;
  var kind = m[1];
  var id = m[2];
  var label = img.getAttribute('alt') || '';

  var wrap = document.createElement('span');
  wrap.className = 'wb3d-preview wb3d-loading';
  wrap.setAttribute('data-wb3d-kind', kind);
  wrap.setAttribute('data-wb3d-id', id);

  var canvas = document.createElement('canvas');
  canvas.className = 'wb3d-canvas';
  /* 语义由外层卡片按钮 / 观察按钮承担，画布本身不进无障碍树 */
  canvas.setAttribute('aria-hidden', 'true');
  wrap.appendChild(canvas);

  var hint = document.createElement('span');
  hint.className = 'wb3d-hint';
  hint.innerHTML = ROTATE_ICON + '<span>可拖动旋转</span>';
  wrap.appendChild(hint);

  var veil = document.createElement('span');
  veil.className = 'wb3d-veil';
  veil.innerHTML = '<span class="wb3d-spin"></span><span>正在加载 3D 模型…</span>';
  wrap.appendChild(veil);

  img.parentNode.replaceChild(wrap, img);

  var inst = {
    wrap: wrap, canvas: canvas, ctx: canvas.getContext('2d'),
    kind: kind, id: id, label: label,
    model: null, ready: false, failed: false, loading: false,
    yaw: 0.55, pitch: 0.30, dist: 0, vyaw: 0, vpitch: 0,
    dragging: false, moved: false, hover: false, visible: false,
    w: 0, h: 0, dpr: 1, needsDraw: true, ro: null,
    sx: 0, sy: 0, px: 0, py: 0, suppressClick: false, lastToast: 0,
    inButton: !!wrap.closest('button')
  };
  registry.push(inst);

  /* 尺寸变化时重算画布与取景 */
  if ('ResizeObserver' in window) {
    inst.ro = new ResizeObserver(function () {
      if (!inst.ready) return;
      resizePreview(inst);
      ensureLoop();
    });
    inst.ro.observe(wrap);
  }

  /* 指针交互：拖拽旋转 + 惯性；兜底态拖拽则 toast 提示 */
  wrap.addEventListener('pointerdown', function (e) {
    inst.dragging = true;
    inst.moved = false;
    inst.sx = e.clientX; inst.sy = e.clientY;
    inst.px = e.clientX; inst.py = e.clientY;
    inst.vyaw = 0; inst.vpitch = 0;
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    if (inst.ready) {
      canvas.classList.add('grabbing');
      setActive(inst);
      wrap.classList.add('wb3d-touched');
    }
  });
  wrap.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') inst.hover = true;
    if (!inst.dragging) return;
    var dx = e.clientX - inst.px;
    var dy = e.clientY - inst.py;
    inst.px = e.clientX; inst.py = e.clientY;
    if (Math.abs(e.clientX - inst.sx) + Math.abs(e.clientY - inst.sy) > DRAG_PX) {
      inst.moved = true;
    }
    if (!inst.ready) {
      /* 兜底态：拖拽时提示去 3D 视图旋转（节流，避免刷屏） */
      if (inst.moved && inst.failed) {
        var now = Date.now();
        if (now - inst.lastToast > TOAST_GAP) {
          inst.lastToast = now;
          showToast('点击进入 3D 视图后可旋转');
        }
      }
      return;
    }
    inst.yaw += dx * 0.0075;
    inst.pitch = clamp(inst.pitch + dy * 0.0075, -1.45, 1.45);
    inst.vyaw = dx * 0.0022;
    inst.vpitch = dy * 0.0022;
    inst.needsDraw = true;
    ensureLoop();
  });
  function endDrag() {
    if (!inst.dragging) return;
    inst.dragging = false;
    canvas.classList.remove('grabbing');
    if (inst.moved) {
      /* 拖拽后紧跟的那次 click 不能触发卡片跳转；400ms 后自动解除（兜底） */
      inst.suppressClick = true;
      setTimeout(function () { inst.suppressClick = false; }, 400);
    }
  }
  wrap.addEventListener('pointerup', endDrag);
  wrap.addEventListener('pointercancel', endDrag);
  wrap.addEventListener('pointerenter', function () { inst.hover = true; });
  wrap.addEventListener('pointerleave', function () { inst.hover = false; });

  /* 捕获阶段拦截点击：拖拽后抑制跳转；非按钮容器则点击进入 3D 视图 */
  wrap.addEventListener('click', function (e) {
    if (inst.suppressClick) {
      inst.suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    if (!inst.inButton) {
      e.preventDefault();
      openScene(inst);
    }
  }, true);

  if (io) io.observe(wrap);
}

/* ---------------- 视口内懒激活 ---------------- */
var io = null;
if ('IntersectionObserver' in window) {
  io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var inst = null;
      for (var j = 0; j < registry.length; j++) {
        if (registry[j].wrap === entry.target) { inst = registry[j]; break; }
      }
      if (!inst) continue;
      inst.visible = entry.isIntersecting;
      if (entry.isIntersecting) {
        if (!inst.ready && !inst.failed) activatePreview(inst);
        else if (inst.ready && (!active || !active.visible)) setActive(inst);
        ensureLoop();
      } else if (active === inst) {
        pickActive();
      }
    }
  }, { rootMargin: '160px 0px' });
}

/* ---------------- 扫描与监听 DOM 变化 ---------------- */
function scan(root) {
  if (!root || !root.querySelectorAll) return;
  var imgs = root.querySelectorAll('img.cw-preview-image');
  for (var i = 0; i < imgs.length; i++) upgrade(imgs[i]);
}

function init() {
  scan(document);
  var docBody = $('docBody');
  if (docBody && 'MutationObserver' in window) {
    /* 考点页 / 资源浏览 / 首页均渲染进 #docBody，监听新增的预览图 */
    var mo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (!node || node.nodeType !== 1) continue;
          if (node.matches && node.matches('img.cw-preview-image')) upgrade(node);
          else scan(node);
        }
      }
    });
    mo.observe(docBody, { childList: true, subtree: true });
  }
  /* 主题切换后重绘所有预览（E3 主题是全局的，随主题变化） */
  if ('MutationObserver' in window) {
    var themeMo = new MutationObserver(function () {
      for (var i = 0; i < registry.length; i++) registry[i].needsDraw = true;
      ensureLoop();
    });
    themeMo.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) ensureLoop();
  });
  window.addEventListener('chem:context', syncStageEmpty);
  setInterval(syncStageEmpty, 800);
  syncStageEmpty();
}

/* ---------------- 舞台空态：3D 视图无模型时显示加载提示 ---------------- */
var stageEmptyOn = false;
function syncStageEmpty() {
  var vp = $('viewport');
  if (!vp) return;
  var empty = !!(window.UI && window.UI.view === 'stage' && !(window.VW && window.VW.model));
  if (empty !== stageEmptyOn) {
    stageEmptyOn = empty;
    vp.classList.toggle('wb3d-stage-empty', empty);
  }
}

/* ---------------- 启动 ---------------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.ChemPreview3D = {
  version: 'w4-1',
  refresh: function () { scan(document); },
  count: function () { return registry.length; },
  liveCount: function () {
    var n = 0;
    for (var i = 0; i < registry.length; i++) if (registry[i].ready) n++;
    return n;
  }
};
})();
