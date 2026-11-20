/* ============================================================================
 * 高中化学 3D 考点工作台 — Service Worker（工作流 3）
 * 位置：站点根目录 sw.js（由 js/pwa.js 注册，scope 为整站；相对路径，兼容子路径部署如 GitHub Pages）。
 *
 * 策略：
 * - 预缓存（install）：核心页面 + 首屏 CSS/JS + 图标，离线可打开工作台入口。
 * - 导航请求：网络优先，失败时回退离线页 offline.html。
 * - 同源静态资源（css/js/assets）：缓存优先，后台更新（stale-while-revalidate）。
 * - 其他同源请求：网络优先，失败时读缓存。
 * - 跨源请求（Bilibili 播放器等）：不拦截，直接放行。
 *
 * 版本管理：改动预缓存列表或缓存策略时，升级 CACHE_VERSION（旧缓存自动清理）。
 * 注意：预缓存 URL 带查询串（?v=w1-1 / ?v=w3-1），与页面引用一致，否则命中失败。
 * ========================================================================== */
'use strict';

var CACHE_VERSION = 'w6-2';
var CACHE_NAME = 'chem3d-v' + CACHE_VERSION;
var OFFLINE_URL = 'offline.html';

/* 预缓存：工作台首屏必需资源（W1 首屏清单 + W2 商业化外壳 + W3 新增层 + W4 工作台改版）
 * 协调员注：W2 完成后同步更新——新增 commerce/auth/plan/ai-config/onboarding、
 * 落地页 landing css/js 与三个信息页；auth/plan 改动后版本串为 ?v=w2-2。
 * W4 同步更新——新增 workbench-* 覆盖层 CSS 与 JS（?v=w4-1）。
 * v2.2.0 同步更新——新增 AI 解题模块 CSS 与 JS（?v=w5-1）；tests/ 不进预缓存。 */
var PRECACHE_URLS = [
  './',
  'app.html',
  'about.html',
  'privacy.html',
  'terms.html',
  'offline.html',
  'manifest.json',
  'css/inline-head.min.css?v=w1-2',
  'css/student-study.min.css?v=w1-1',
  'css/commerce.min.css?v=w2-1',
  'css/landing.min.css?v=w2-1',
  'css/mobile.min.css?v=w3-1',
  'css/enhance.min.css?v=w3-1',
  'css/workbench-layout.min.css?v=w4-1',
  'css/workbench-quiz.min.css?v=w4-1',
  'css/workbench-controls.min.css?v=w4-1',
  'css/workbench-learn.min.css?v=w4-1',
  'css/workbench-fx.min.css?v=w4-1',
  'css/workbench-solve.min.css?v=w5-1',
  'js/auth.min.js?v=w2-2',
  'js/loader.min.js?v=w2.4.0',
  'js/inline-00-e3-engine.min.js?v=w1-1',
  'js/inline-01-db-items.min.js?v=w1-1',
  'js/inline-02-db-app.min.js?v=w1-1',
  'js/inline-03-db-elem.min.js?v=w1-1',
  'js/inline-04-db-exps.min.js?v=w1-1',
  'js/inline-08-ui.min.js?v=w1-1',
  'js/practice-bank-concept.min.js?v=w2.4.0',
  'js/practice-bank-exam.min.js?v=w2.4.0',
  'js/inline-09-studio.min.js?v=w2.4.1',
  'js/student-study-stub.min.js?v=w1-1',
  'js/workbench-nav.min.js?v=w4-1',
  'js/plan.min.js?v=w2-2',
  'js/ai-config.min.js?v=w2.3.0',
  'js/onboarding.min.js?v=w2-1',
  'js/workbench-flashcards.min.js?v=w4-1',
  'js/workbench-socratic.min.js?v=w4-1',
  'js/workbench-gamify.min.js?v=w4-1',
  'js/workbench-conceptmap.min.js?v=w4-1',
  'js/landing.min.js?v=w2-1',
  'js/mobile.min.js?v=w3-1',
  'js/a11y.min.js?v=w3-1',
  'js/analytics.min.js?v=w3-1',
  'js/share.min.js?v=w3-1',
  'js/pwa.min.js?v=w3-1',
  'js/workbench-quiz.min.js?v=w4-1',
  'js/workbench-search.min.js?v=w4-1',
  'js/workbench-3d-preview.min.js?v=w4-1',
  'js/workbench-vibe.min.js?v=w4-1',
  'js/workbench-solve-engine.min.js?v=w5-1',
  'js/workbench-practice-gen.min.js?v=w2.4.0',
  'js/workbench-chem-render.min.js?v=w5-1',
  'js/workbench-solve-ocr.min.js?v=w5-1',
  'js/workbench-solve-flow.min.js?v=w5-3',
  'assets/jxnu-emblem.jpg',
  'assets/icon-192.png',
  'assets/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      /* 逐个添加：个别资源 404（如落地页尚未部署的 /）不导致整个安装失败 */
      return Promise.all(PRECACHE_URLS.map(function (url) {
        return cache.add(url).catch(function () { /* 单个失败忽略 */ });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME && key.indexOf('chem3d-v') === 0) {
          return caches.delete(key);
        }
        return Promise.resolve();
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* 收到 skipWaiting 消息时立即激活（供页面“有新版本，立即刷新”按钮调用） */
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isStaticAsset(url) {
  return url.pathname.indexOf('/css/') !== -1 ||
    url.pathname.indexOf('/js/') !== -1 ||
    url.pathname.indexOf('/assets/') !== -1;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨源请求不拦截

  /* 1. 导航请求：网络优先，离线回退离线页 */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match(OFFLINE_URL);
        });
      })
    );
    return;
  }

  /* 2. 同源静态资源：缓存优先 + 后台更新 */
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
          }
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      })
    );
    return;
  }

  /* 3. 其他同源请求：网络优先，失败读缓存 */
  event.respondWith(
    fetch(req).catch(function () { return caches.match(req); })
  );
});
