/* ============================================================================
 * 高中化学 3D 考点工作台 — 增长事件上报抽象（工作流 3）
 * 只做加法：独立文件，不修改 W1 的任何 JS 源码。
 *
 * 设计：
 * - 默认只输出到 console（本地可见，不发任何网络请求），不内置任何真实追踪 ID。
 * - 预留 Plausible / Google Analytics（gtag）接入点：页面引入对应官方脚本后，
 *   调用 ChemAnalytics.use(ChemAnalytics.plausible()) 即可接通，无需改本文件。
 * - 尊重 Do Not Track：DNT=1 时不向任何外部 Provider 发送事件（console 仍输出，
 *   因其不产生网络请求）。
 * - 所有事件同时派发 window CustomEvent 'chem:analytics'，供其他脚本监听。
 *
 * 预埋关键事件：
 *   workbench_enter  进入工作台（每会话一次）
 *   exp_3d_open      打开 3D 实验/对象（data: { name }）
 *   quiz_submit      提交测验（data: { title }）
 *   quiz_complete    测验弹窗关闭且此前有提交（data: { title }）
 *   upgrade_click    点击升级（data: { source }，见下方接入方式）
 *   auth_register    注册（data: { method }）
 *   auth_login       登录（data: { method }）
 *   page_view        页面浏览（data: { path }，所有页面）
 *   share_copy       复制分享链接 / share_checkin 打卡卡片下载（由 share.js 上报）
 *   pwa_*            安装相关（由 pwa.js 上报）
 *
 * 升级/注册/登录接入方式（三选一，协调员/工作流 2 任选）：
 *   1) 按钮加属性：data-analytics="upgrade" / "register" / "login"
 *      （可选 data-analytics-source="landing-hero" 说明来源）
 *   2) 代码派发事件：window.dispatchEvent(new CustomEvent('chem:upgrade-click',
 *      { detail: { source: 'pricing' } }))；注册/登录对应 'chem:auth-register' /
 *      'chem:auth-login'，detail 可带 { method: 'email' }。
 *   3) 直接调用：ChemAnalytics.track('upgrade_click', { source: '...' })。
 * ========================================================================== */
(function () {
  'use strict';

  var providers = [];
  var debug = true; // console 输出开关：ChemAnalytics.setDebug(false) 可关闭
  var dnt = (navigator.doNotTrack === '1' || window.doNotTrack === '1');

  function track(event, data) {
    if (typeof event !== 'string' || !event) return;
    data = data || {};
    var payload = { event: event, data: data, at: new Date().toISOString() };
    if (debug && window.console) {
      console.info('[ChemAnalytics]', event, data);
    }
    if (!dnt) {
      providers.forEach(function (p) {
        try { p.track(event, data); } catch (e) { /* 单个 Provider 失败不影响其他 */ }
      });
    }
    try {
      window.dispatchEvent(new CustomEvent('chem:analytics', { detail: payload }));
    } catch (e) { /* 忽略 */ }
  }

  function use(provider) {
    if (provider && typeof provider.track === 'function') providers.push(provider);
    return api;
  }

  /* ---------- 预留 Provider 适配器（无真实 ID，需页面先引入官方脚本） ---------- */
  function plausibleProvider() {
    return {
      name: 'plausible',
      track: function (event, data) {
        if (typeof window.plausible === 'function') {
          window.plausible(event, { props: data });
        }
      }
    };
  }
  function gtagProvider() {
    return {
      name: 'gtag',
      track: function (event, data) {
        if (typeof window.gtag === 'function') {
          window.gtag('event', event, data);
        }
      }
    };
  }

  var api = {
    track: track,
    use: use,
    plausible: plausibleProvider,
    gtag: gtagProvider,
    setDebug: function (on) { debug = !!on; },
    isDnt: function () { return dnt; }
  };
  window.ChemAnalytics = api;

  /* ---------- 自动埋点（仅当页面是工作台时启用工作台专属事件） ---------- */
  function isWorkbench() {
    return !!(document.getElementById('viewStage') || document.getElementById('navTree'));
  }

  function autoInstrument() {
    /* page_view：所有页面 */
    track('page_view', { path: location.pathname });

    if (!isWorkbench()) return;

    /* workbench_enter：每会话一次 */
    try {
      if (!sessionStorage.getItem('chem3d_v2_analytics_entered')) {
        sessionStorage.setItem('chem3d_v2_analytics_entered', '1');
        track('workbench_enter', { referrer: document.referrer || '' });
      }
    } catch (e) {
      track('workbench_enter', { referrer: document.referrer || '' });
    }

    /* exp_3d_open：面包屑变化即代表打开了新的 3D 对象/实验 */
    var crumb = document.getElementById('crumb');
    var lastCrumb = crumb ? crumb.textContent.trim() : '';
    var crumbTimer = 0;
    if (crumb && 'MutationObserver' in window) {
      new MutationObserver(function () {
        clearTimeout(crumbTimer);
        crumbTimer = setTimeout(function () {
          var text = crumb.textContent.trim();
          if (text && text !== lastCrumb) {
            lastCrumb = text;
            track('exp_3d_open', { name: text });
          }
        }, 300);
      }).observe(crumb, { childList: true, characterData: true, subtree: true });
    }

    /* quiz_submit / quiz_complete：测验弹窗内提交按钮点击 + 弹窗关闭 */
    var quizSubmitted = false;
    var quizTitle = '';
    document.addEventListener('click', function (e) {
      var dialog = document.getElementById('quizDialog');
      if (!dialog || !dialog.contains(e.target)) return;
      var btn = e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      var label = (btn.textContent || '').trim();
      if (/提交|完成|交卷|查看结果/.test(label)) {
        quizSubmitted = true;
        var head = dialog.querySelector('h3, h2');
        quizTitle = head ? head.textContent.trim() : '';
        track('quiz_submit', { title: quizTitle });
      }
    });
    var quizMask = document.getElementById('quizMask');
    if (quizMask && 'MutationObserver' in window) {
      new MutationObserver(function () {
        if (!quizMask.classList.contains('show') && quizSubmitted) {
          quizSubmitted = false;
          track('quiz_complete', { title: quizTitle });
          quizTitle = '';
        }
      }).observe(quizMask, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ---------- 升级 / 注册 / 登录：属性埋点 + 自定义事件 ---------- */
  function bindGrowthEvents() {
    /* 方式 1：data-analytics 属性（委托点击，动态按钮同样生效） */
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-analytics]') : null;
      if (!el) return;
      var kind = el.getAttribute('data-analytics');
      var source = el.getAttribute('data-analytics-source') || el.id || '';
      if (kind === 'upgrade') track('upgrade_click', { source: source });
      else if (kind === 'register') track('auth_register', { source: source });
      else if (kind === 'login') track('auth_login', { source: source });
    });
    /* 方式 2：自定义事件（供工作流 2 的 auth/plan 逻辑派发） */
    window.addEventListener('chem:upgrade-click', function (e) {
      track('upgrade_click', (e.detail) || {});
    });
    window.addEventListener('chem:auth-register', function (e) {
      track('auth_register', (e.detail) || {});
    });
    window.addEventListener('chem:auth-login', function (e) {
      track('auth_login', (e.detail) || {});
    });
  }

  function init() {
    autoInstrument();
    bindGrowthEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
