/* ============================================================================
 * 高中化学 3D 考点工作台 — 无障碍运行时增强（工作流 3）
 * 只做加法：不修改 W1 的任何 JS 源码；全部运行时挂载。
 * - 注入跳过链接（样式见 css/enhance.css .chem-skip-link）。
 * - 给缺无障碍名的图标按钮补 aria-label（优先 title，其次内置 id 映射）。
 * - Esc 关闭弹窗 / 抽屉 / 详情面板（报告弹窗与助教已有各自 Esc 处理，本文件
 *   不重复接管，只做兜底关闭其余弹窗；重复关闭同一弹窗是幂等的）。
 * - 弹窗打开时焦点陷阱（Tab 循环）与关闭后焦点回位。
 * - 动态内容（测验/报告弹窗等）通过 MutationObserver 增量补标签。
 * ========================================================================== */
(function () {
  'use strict';

  /* 已知图标按钮的 id → 无障碍名映射（仅在按钮既无 aria-label 又无可见文本时补） */
  var LABEL_BY_ID = {
    btnMenu: '打开导航菜单',
    btnPT: '打开元素周期表',
    btnTheme: '切换深浅主题',
    btnAssistant: '打开化学助教',
    inspToggle: '展开详情面板',
    ptFull: '全屏显示周期表',
    ptAcc: '切换周期表主题',
    ptLang: '切换周期表中英文',
    ptHall: '打开 3D 元素大厅',
    fxToggle: '切换实验室氛围特效'
  };

  /* 弹窗/抽屉的选择器（按关闭优先级排序） */
  var LAYER_SELECTORS = [
    '#quizMask.show', '#cmpMask.show', '#rptMask.show', '#ptMask.show'
  ];

  var lastFocused = null; // 弹窗打开前聚焦的元素，用于关闭后回位

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- 1. 跳过链接 ---------- */
  function injectSkipLink() {
    if ($('#chemSkipLink')) return;
    var main = $('.main') || $('main');
    if (!main) return;
    if (!main.id) main.id = 'chemMain';
    var link = document.createElement('a');
    link.id = 'chemSkipLink';
    link.className = 'chem-skip-link';
    link.href = '#' + main.id;
    link.textContent = '跳到主要内容';
    link.addEventListener('click', function () {
      /* 让目标可聚焦，读屏焦点能真正落到主区 */
      if (main.tabIndex !== 0 && main.tabIndex !== -1) main.tabIndex = -1;
      main.focus({ preventScroll: true });
    });
    document.body.insertBefore(link, document.body.firstChild);
  }

  /* ---------- 2. 图标按钮补 aria-label ---------- */
  function accessibleName(el) {
    var label = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    if (label) return label;
    var text = (el.textContent || '').trim();
    if (text) return text;
    return '';
  }
  function labelButtons(root) {
    var btns = $$('button', root).concat($$('a[role="button"]', root));
    btns.forEach(function (el) {
      if (accessibleName(el)) return;
      var name = el.getAttribute('title') ||
        (el.id && LABEL_BY_ID[el.id]) ||
        el.getAttribute('data-label') || '';
      name = (name || '').trim();
      if (!name) return;
      el.setAttribute('aria-label', name);
    });
    /* 无 alt 的装饰性 svg 隐藏于无障碍树（有文本的按钮内图标不重复播报） */
    $$('button svg, a svg', root).forEach(function (svg) {
      if (!svg.getAttribute('aria-label') && !svg.getAttribute('role')) {
        svg.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /* ---------- 3. Esc 关闭 + 焦点陷阱 ---------- */
  function openLayers() {
    var layers = [];
    LAYER_SELECTORS.forEach(function (sel) {
      var el = $(sel);
      if (el) layers.push(el);
    });
    return layers;
  }
  function closeTopLayer() {
    /* 优先关闭最上层弹窗 */
    var layers = openLayers();
    if (layers.length) {
      var top = layers[layers.length - 1];
      top.classList.remove('show');
      restoreFocus();
      return true;
    }
    /* 再关详情面板抽屉 */
    var insp = $('#inspector');
    if (insp && insp.classList.contains('show')) {
      insp.classList.remove('show');
      var t = $('#inspToggle');
      if (t) t.focus();
      return true;
    }
    /* 再关移动端导航抽屉（复用 ChemMobile 的关闭逻辑） */
    if (window.ChemMobile && window.ChemMobile.isDrawerOpen()) {
      window.ChemMobile.closeDrawer();
      var btn = $('#btnMenu');
      if (btn) btn.focus();
      return true;
    }
    /* 最后：搜索框有焦点时失焦，收起下拉联想 */
    var search = $('#searchInput');
    if (search && document.activeElement === search) {
      search.blur();
      return true;
    }
    return false;
  }
  function restoreFocus() {
    if (lastFocused && typeof lastFocused.focus === 'function' && document.contains(lastFocused)) {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  function focusableIn(el) {
    return $$('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', el)
      .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
  }
  function trapTab(e) {
    var layers = openLayers();
    if (!layers.length) return;
    var top = layers[layers.length - 1];
    var items = focusableIn(top);
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function watchLayers() {
    if (!('MutationObserver' in window)) return;
    /* 记录弹窗打开前的焦点；弹窗打开后把焦点移入弹窗内第一个可聚焦元素 */
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        var el = m.target;
        if (!el.classList || !el.classList.contains('show')) return;
        if (!/Mask$/.test(el.id)) return;
        if (!lastFocused) lastFocused = document.activeElement;
        setTimeout(function () {
          var items = focusableIn(el);
          if (items.length) items[0].focus();
        }, 60);
      });
    });
    ['quizMask', 'cmpMask', 'rptMask', 'ptMask'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /* ---------- 4. 动态内容增量补标签 ---------- */
  function watchDynamicContent() {
    if (!('MutationObserver' in window)) return;
    var timer = 0;
    var observer = new MutationObserver(function (mutations) {
      var need = mutations.some(function (m) { return m.addedNodes.length > 0; });
      if (!need) return;
      clearTimeout(timer);
      timer = setTimeout(function () { labelButtons(document); }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- 5. 读屏播报辅助 ---------- */
  function announce(msg) {
    var region = $('#chemLiveRegion');
    if (!region) {
      region = document.createElement('div');
      region.id = 'chemLiveRegion';
      region.className = 'chem-sr-only';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    region.textContent = '';
    setTimeout(function () { region.textContent = msg; }, 30);
  }

  function init() {
    injectSkipLink();
    labelButtons(document);
    watchLayers();
    watchDynamicContent();
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        /* 报告弹窗与助教已有原生 Esc 处理且会 stopPropagation 的场景：
           本处理与之共存，重复关闭是幂等的，不会误关其他层 */
        closeTopLayer();
      } else if (e.key === 'Tab') {
        trapTab(e);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ChemA11y = {
    announce: announce,
    relabel: function () { labelButtons(document); }
  };
})();
