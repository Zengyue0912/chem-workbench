/* ============================================================================
 * 高中化学 3D 考点工作台 — 移动端运行时增强（工作流 3）
 * 只做加法：不修改 W1 的任何 JS 源码；全部通过 addEventListener 运行时挂载。
 *
 * 已有能力复用说明（经核查，不重复实现）：
 * - 抽屉开关：js/inline-08-ui.js 已绑定 #btnMenu 打开、#mask 点击关闭；
 *   本文件不重复绑定 click，只补：左滑关闭、滚动锁定、超宽自动关闭。
 * - 3D 画布手势：js/inline-07-viewer.js（viewer3d bundle）已用 Pointer Events
 *   实现单指拖拽旋转 + 双指捏合缩放；本文件不重复绑定，避免双倍旋转/缩放。
 *   本文件只补：触屏双击复位视角（dblclick 在部分移动端不可靠）。
 * 配套样式：css/mobile.css（断点 768px / 1024px）。
 * ========================================================================== */
(function () {
  'use strict';

  var DRAWER_BREAKPOINT = 768;   // 与 css/mobile.css 的手机断点一致
  var SWIPE_CLOSE_DX = -60;      // 抽屉左滑关闭阈值（px）
  var TAP_MAX_MOVE = 12;         // 双击判定：两次触点最大位移（px）
  var TAP_MAX_INTERVAL = 320;    // 双击判定：两次触点最大间隔（ms）

  function $(id) { return document.getElementById(id); }

  /* ---------- 1. 视口高度修正：移动端地址栏伸缩导致 100vh 跳动 ---------- */
  function updateVh() {
    var vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }
  var vhTimer = 0;
  function updateVhDebounced() {
    clearTimeout(vhTimer);
    vhTimer = setTimeout(updateVh, 80);
  }

  /* ---------- 2. 抽屉增强 ---------- */
  function isDrawerOpen() {
    var sb = $('sidebar');
    return !!(sb && sb.classList.contains('show'));
  }
  function closeDrawer() {
    var sb = $('sidebar'), mask = $('mask');
    if (sb) sb.classList.remove('show');
    if (mask) mask.classList.remove('show');
    syncDrawerState();
  }
  function openDrawer() {
    var sb = $('sidebar'), mask = $('mask');
    if (sb) sb.classList.add('show');
    if (mask) mask.classList.add('show');
    syncDrawerState();
  }
  /* 同步：body 滚动锁定 class + 菜单按钮 aria-expanded */
  function syncDrawerState() {
    var open = isDrawerOpen();
    document.body.classList.toggle('chem-drawer-open', open);
    var btn = $('btnMenu');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function initDrawer() {
    var sb = $('sidebar');
    if (!sb) return;
    syncDrawerState();

    /* 抽屉 class 变化（原有 btnMenu/mask 逻辑触发）时同步锁定状态 */
    if ('MutationObserver' in window) {
      new MutationObserver(function () { syncDrawerState(); })
        .observe(sb, { attributes: true, attributeFilter: ['class'] });
    }

    /* 左滑关闭：只在抽屉打开时监听滑动 */
    var startX = 0, startY = 0, tracking = false;
    sb.addEventListener('touchstart', function (e) {
      if (!isDrawerOpen() || e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });
    sb.addEventListener('touchmove', function (e) {
      if (!tracking) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      /* 明显左滑且非竖向滚动时关闭 */
      if (dx < SWIPE_CLOSE_DX && Math.abs(dy) < Math.abs(dx)) {
        tracking = false;
        closeDrawer();
      }
    }, { passive: true });
    sb.addEventListener('touchend', function () { tracking = false; }, { passive: true });

    /* 窗口变宽超过手机断点时自动收起抽屉，避免残留遮罩 */
    var rsTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rsTimer);
      rsTimer = setTimeout(function () {
        if (window.innerWidth > DRAWER_BREAKPOINT && isDrawerOpen()) closeDrawer();
      }, 120);
    });
  }

  /* ---------- 3. 3D 画布：触屏双击复位视角 ---------- */
  function initCanvasDoubleTap() {
    var cv = $('cv');
    if (!cv) return;
    var lastTap = 0, lastX = 0, lastY = 0, pinch = false;

    cv.addEventListener('touchstart', function (e) {
      if (e.touches.length > 1) pinch = true;
    }, { passive: true });
    cv.addEventListener('touchend', function (e) {
      if (pinch) { if (e.touches.length === 0) pinch = false; return; }
      if (e.changedTouches.length !== 1) return;
      var t = e.changedTouches[0];
      var now = Date.now();
      var quick = now - lastTap < TAP_MAX_INTERVAL;
      var near = Math.abs(t.clientX - lastX) < TAP_MAX_MOVE &&
                 Math.abs(t.clientY - lastY) < TAP_MAX_MOVE;
      lastTap = now; lastX = t.clientX; lastY = t.clientY;
      if (!quick || !near) return;
      /* 双击：复位视角（复用 viewer 暴露的全局接口；viewer 未加载时跳过） */
      lastTap = 0;
      if (typeof window.fitModel === 'function') {
        try {
          window.fitModel();
          if (typeof window.needsDraw === 'function') window.needsDraw();
        } catch (err) { /* 复位失败不影响其他功能 */ }
      }
    }, { passive: true });

    /* 触屏设备更新操作提示文案 */
    var hint = $('hudHint');
    if (hint && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      hint.textContent = '单指拖拽旋转 · 双指缩放 · 双击复位';
    }
  }

  /* ---------- 4. 触屏检测 class（供 CSS/其他脚本判断） ---------- */
  function markTouch() {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.documentElement.classList.add('chem-touch');
    }
  }

  function init() {
    updateVh();
    markTouch();
    initDrawer();
    initCanvasDoubleTap();
    window.addEventListener('resize', updateVhDebounced);
    window.addEventListener('orientationchange', updateVhDebounced);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* 对外接口（供 a11y.js / 其他脚本调用，不依赖 W1 内部函数） */
  window.ChemMobile = {
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    isDrawerOpen: isDrawerOpen,
    isTouch: function () {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
  };
})();
