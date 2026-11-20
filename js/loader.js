/* ============================================================================
 * ChemLazy — 按需加载器（工作流 1：性能与工程重构新增文件）
 *
 * 首屏只加载核心脚本（核心 UI + 导航 + 搜索 + 学习入口），其余功能模块
 * 在首次使用时按需加载并缓存。bundle 内文件按原始引用顺序串行加载，
 * 保证 window 命名空间依赖（如 ChemMethodCatalog → ChemLessonRoutes →
 * ChemMethodStudy、SOP 数据 → ChemPreparedSop）不错乱。
 *
 * bundle 清单：
 *   viewer3d  3D 构建器 + 查看器（首次打开任意 3D 对象/3D 大厅时加载）
 *   lessons   教案 SOP 面板（首次进入“教师备课”时加载）
 *   study     学习内容 + SOP 数据/真题/方法流/OCR + 完整版 student-study.js
 *             （首次进入 AI 授课/解题时加载；student-study.js 在最后加载，
 *             使其顶层捕获的命名空间均为已加载的 live 值）
 *   spatial   3D 空间增强 + 找考点（首屏空闲时预加载）
 *   examspace 高考真题空间（首屏空闲时预加载；首页按钮点击时按需加载兜底）
 *   datacollector 学习数据同步（课堂后台；首屏空闲时预加载，顶栏按钮晚 1 秒出现）
 * ========================================================================== */
(function () {
'use strict';

var VERSION = 'w1-1';
var withVersion = function (url) { return url + '?v=' + VERSION; };

/* 各 bundle 的文件清单（与原 index.html 引用顺序一致，串行加载） */
var BUNDLES = {
  viewer3d: {
    js: ['js/inline-05-build-a.min.js',
         'js/inline-06-build-b.min.js',
         'js/inline-07-viewer.min.js']
  },
  lessons: {
    js: ['js/inline-10-lesson-sop.min.js',
         'js/inline-11-lesson-md.min.js',
         'js/inline-12-lesson-flow.min.js']
  },
  study: {
    js: ['js/student-study-content.min.js',
         'js/student-exam-questions.min.js',
         'js/student-study-sop.min.js',
         'js/student-methods.min.js',
         'js/student-lesson-routes.min.js',
         'js/student-solve-routes.min.js',
         'js/student-titration-sop.min.js',
         'js/student-vsepr-study.min.js',
         'js/student-question-sop.min.js',
         'js/student-sop-basic-data.min.js',
         'js/student-sop-principles-data.min.js',
         'js/student-sop-structure-data.min.js',
         'js/student-sop-organic-data.min.js',
         'js/student-sop-practice-data.min.js',
         'js/student-prepared-sop.min.js',
         'js/student-ionic-sop.min.js',
         'js/student-method-flow.min.js',
         'js/student-question-ocr.min.js',
         'js/student-study.min.js']
  },
  spatial: {
    css: ['css/chem-spatial.min.css'],
    js: ['js/chem-spatial-camera.min.js',
         'js/chem-spatial.min.js']
  },
  examspace: {
    css: ['css/exam-space.min.css'],
    js: ['js/exam-space-models.min.js',
         'js/exam-space.min.js']
  },
  datacollector: {
    css: ['css/data.min.css'],
    js: ['js/data-collector.min.js']
  }
};

var fileCache = new Map();   /* url -> Promise（单个文件去重） */
var bundleCache = new Map(); /* bundle 名 -> Promise */

function loadScript(src) {
  var url = withVersion(src);
  if (fileCache.has(url)) return fileCache.get(url);
  var promise = new Promise(function (resolve, reject) {
    var el = document.createElement('script');
    el.src = url;
    el.onload = function () { resolve(); };
    el.onerror = function () { fileCache.delete(url); reject(new Error('脚本加载失败：' + src)); };
    document.head.appendChild(el);
  });
  fileCache.set(url, promise);
  return promise;
}

function loadCss(href) {
  var url = withVersion(href);
  if (fileCache.has(url)) return fileCache.get(url);
  var promise = new Promise(function (resolve) {
    var el = document.createElement('link');
    el.rel = 'stylesheet';
    el.href = url;
    var done = false;
    var finish = function () { if (!done) { done = true; resolve(); } };
    el.onload = finish;
    el.onerror = finish; /* 样式失败不阻塞功能，仅记录 */
    document.head.appendChild(el);
    setTimeout(finish, 3000); /* 兜底：个别浏览器不触发 link onload */
  });
  fileCache.set(url, promise);
  return promise;
}

function loadBundle(name) {
  var bundle = BUNDLES[name];
  if (!bundle) return Promise.reject(new Error('未知 bundle：' + name));
  var chain = Promise.resolve();
  if (bundle.css) {
    bundle.css.forEach(function (href) { chain = chain.then(function () { return loadCss(href); }); });
  }
  bundle.js.forEach(function (src) {
    chain = chain.then(function () { return loadScript(src); });
  });
  return chain.then(function () {
    if (name === 'viewer3d') {
      /* 恢复用户保存的分子显示模式（首屏 init 时 VW 尚未加载，无法当时设置） */
      try {
        var saved = JSON.parse(window.localStorage.getItem('chem3d_v2_molmode'));
        if ((saved === 'ball' || saved === 'space') && window.VW) window.VW.molMode = saved;
      } catch (e) { /* 忽略读取异常，使用默认球棍模式 */ }
    }
    /* spatial / examspace 晚于舞台渲染时，补一次工具条与详情面板刷新 */
    if ((name === 'spatial' || name === 'examspace') && window.__chemRefreshStageUI) {
      try { window.__chemRefreshStageUI(); } catch (e) { /* 忽略刷新异常 */ }
    }
  });
}

function load(name) {
  if (!bundleCache.has(name)) {
    var promise = loadBundle(name).catch(function (err) {
      bundleCache.delete(name); /* 失败后允许下次点击重试 */
      var toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = '功能加载失败，请检查网络后重试。';
        toast.classList.add('show');
        setTimeout(function () { toast.classList.remove('show'); }, 2600);
      }
      if (window.console && console.error) console.error('[ChemLazy]', err);
      throw err;
    });
    bundleCache.set(name, promise);
  }
  return bundleCache.get(name);
}

/* ---------- 首屏骨架屏 ---------- */
var skeletonHidden = false;
function hideSkeleton() {
  if (skeletonHidden) return;
  skeletonHidden = true;
  var el = document.getElementById('chemSkeleton');
  if (!el) return;
  el.classList.add('done');
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
}
/* 主信号：最后一个核心脚本（student-study.js）执行完毕后调用 markReady() */
function markReady() { hideSkeleton(); }
/* 兜底：load 事件后 1.2s 或最长 6s 后一定撤掉骨架屏，避免脚本异常时白屏 */
window.addEventListener('load', function () { setTimeout(hideSkeleton, 1200); });
setTimeout(hideSkeleton, 6000);

/* ---------- 首屏空闲预加载：3D 空间 + 真题空间 + 学习数据同步 ---------- */
function idlePreload() {
  load('spatial').catch(function () {});
  load('examspace').catch(function () {});
  load('datacollector').catch(function () {});
}
if (document.readyState === 'complete') {
  setTimeout(idlePreload, 800);
} else {
  window.addEventListener('load', function () {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(idlePreload, { timeout: 2000 });
    } else {
      setTimeout(idlePreload, 800);
    }
  });
}

/* ---------- 兜底：空闲预加载完成前，用户先点了首页真题按钮 ---------- */
document.addEventListener('click', function (event) {
  if (window.ChemExamSpace) return; /* 已加载：交给 exam-space.js 自己的监听处理 */
  var btn = event.target && event.target.closest
    ? event.target.closest('[data-exam-model]') : null;
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  load('examspace').then(function () { btn.click(); }).catch(function () {});
}, true);

window.ChemLazy = {
  version: VERSION,
  bundles: Object.keys(BUNDLES),
  load: load,
  markReady: markReady,
  isLoaded: function (name) { return bundleCache.has(name); }
};
})();
