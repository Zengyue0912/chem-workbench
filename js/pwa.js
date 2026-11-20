/* ============================================================================
 * 高中化学 3D 考点工作台 — PWA：Service Worker 注册 + 安装提示（工作流 3）
 * 只做加法：独立文件，不修改 W1 的任何 JS 源码。
 * - 注册站点根目录的 /sw.js（缓存版本见 sw.js 内 CACHE_NAME）。
 * - 监听 beforeinstallprompt，展示自定义安装横幅（样式见 css/enhance.css）。
 * - 安装横幅关闭后 14 天内不再打扰（localStorage：chem3d_v2_pwa_dismissed）。
 * 注意：Service Worker 仅在 HTTPS（或 localhost）下可用；file:// 打开时静默跳过。
 * ========================================================================== */
(function () {
  'use strict';

  var DISMISS_KEY = 'chem3d_v2_pwa_dismissed';
  var DISMISS_DAYS = 14;
  var BANNER_DELAY_MS = 3000; // 首屏稳定后再展示横幅，避免遮挡骨架屏

  var deferredPrompt = null;
  var bannerShown = false;

  function track(event, data) {
    if (window.ChemAnalytics && typeof window.ChemAnalytics.track === 'function') {
      try { window.ChemAnalytics.track(event, data || {}); } catch (e) { /* 忽略 */ }
    }
  }

  /* ---------- Service Worker 注册 ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return; // file:// / 非 HTTPS 下不可用
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').then(function (reg) {
        /* 有新版本 SW 等待激活时通知页面（由页面决定是否提示刷新） */
        reg.addEventListener('updatefound', function () {
          var worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('chem:sw-update', { detail: { registration: reg } }));
              track('pwa_update_available', {});
            }
          });
        });
      }).catch(function (err) {
        /* 注册失败不阻塞页面（常见于本地 file 预览或隐私模式） */
        if (window.console) console.warn('[ChemPWA] Service Worker 注册失败：', err);
      });
    });
  }

  /* ---------- 安装横幅 ---------- */
  function dismissedRecently() {
    try {
      var ts = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      return Date.now() - ts < DISMISS_DAYS * 24 * 3600 * 1000;
    } catch (e) { return false; }
  }
  function markDismissed() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) { /* 忽略 */ }
  }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function showBanner() {
    if (bannerShown || !deferredPrompt || isStandalone() || dismissedRecently()) return;
    bannerShown = true;

    var banner = document.createElement('div');
    banner.className = 'chem-install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', '安装应用提示');

    var img = document.createElement('img');
    img.src = 'assets/icon-192.png';
    img.alt = '';
    img.width = 40; img.height = 40;

    var text = document.createElement('div');
    text.className = 'chem-install-banner-text';
    var title = document.createElement('strong');
    title.textContent = '安装「高中化学 3D 考点工作台」';
    var sub = document.createElement('span');
    sub.textContent = '添加到主屏幕，离线也能打开核心页面';
    text.appendChild(title);
    text.appendChild(sub);

    var go = document.createElement('button');
    go.type = 'button';
    go.className = 'chem-install-go';
    go.textContent = '安装';
    go.addEventListener('click', function () { promptInstall(); });

    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'chem-install-no';
    no.textContent = '暂不';
    no.setAttribute('aria-label', '关闭安装提示');
    no.addEventListener('click', function () {
      markDismissed();
      banner.remove();
      track('pwa_install_dismissed', {});
    });

    banner.appendChild(img);
    banner.appendChild(text);
    banner.appendChild(go);
    banner.appendChild(no);
    document.body.appendChild(banner);
    track('pwa_install_prompt_shown', {});
  }

  function promptInstall() {
    if (!deferredPrompt) return Promise.resolve(false);
    deferredPrompt.prompt();
    return deferredPrompt.userChoice.then(function (choice) {
      track('pwa_install_choice', { outcome: choice.outcome });
      if (choice.outcome === 'accepted') {
        var banner = document.querySelector('.chem-install-banner');
        if (banner) banner.remove();
      }
      deferredPrompt = null;
      return choice.outcome === 'accepted';
    }).catch(function () { return false; });
  }

  function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); // 改用自定义横幅，不用浏览器默认迷你信息栏
      deferredPrompt = e;
      setTimeout(showBanner, BANNER_DELAY_MS);
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      var banner = document.querySelector('.chem-install-banner');
      if (banner) banner.remove();
      track('pwa_installed', {});
    });
  }

  registerSW();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInstallPrompt);
  } else {
    initInstallPrompt();
  }

  window.ChemPWA = {
    promptInstall: promptInstall,
    canInstall: function () { return !!deferredPrompt; }
  };
})();
