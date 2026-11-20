/* ============================================================================
 * 学习功能轻量入口（工作流 1：性能与工程重构新增文件）
 *
 * 完整版 student-study.js（约 62KB）+ student-study-content.js（约 19KB）
 * 改为按需懒加载：只有用户首次点击“AI 授课 / AI 解题”入口时才加载。
 * 本 stub 只负责首屏可见的部分，与完整版加载时的行为完全一致：
 *   1. 在导航树顶部加入“AI 授课 / AI 解题”两个入口（与完整版同款标记）；
 *   2. 在首页加入“学生学习 SOP”入口区，并包装 ChemEnhance.home 以便
 *      之后每次回到首页时重新加入（与完整版 addHomeEntry 相同逻辑）；
 *   3. 提供 ChemStudentStudy 门面（与完整版同签名）：错题本与 3D 空间
 *      的调用先走门面，门面按需加载完整版后再转发；完整版加载后整体替换门面；
 *   4. 拦截 [data-study-enter] 点击：经门面进入对应模式；完整版加载后
 *      由其自己的监听接管。
 * 完整版加载时会检测到入口已存在，不会重复创建导航项。
 * ========================================================================== */
(function () {
'use strict';

/* 1. 导航入口（标记与完整版 student-study.js 的 nav 块完全一致） */
var nav = document.createElement('div');
nav.className = 'study-nav';
nav.innerHTML =
  '<div class="nav-group"><button type="button" class="nav-cat new-nav" data-study-enter="lesson"><span class="ni" aria-hidden="true">◫</span><span>AI 授课</span></button></div>' +
  '<div class="nav-group"><button type="button" class="nav-cat new-nav" data-study-enter="solve"><span class="ni" aria-hidden="true">✎</span><span>AI 解题</span></button></div>';
var tree = document.getElementById('navTree');
if (tree && tree.firstElementChild) tree.firstElementChild.after(nav);

/* 2. 首页入口区（标记与完整版 addHomeEntry 完全一致，含去重守卫） */
function addHomeEntry(root) {
  if (!root) return;
  var home = root.querySelector('.studio-home');
  if (!home || home.querySelector('.study-home-entry')) return;
  var block = document.createElement('section');
  block.className = 'study-home-entry';
  block.setAttribute('aria-label', '学生学习 SOP');
  block.innerHTML = '<button type="button" class="study-topic" data-study-enter="lesson"><strong>AI 授课 SOP <span aria-hidden="true">→</span></strong><small>看微课 · 学方法 · 查理解</small></button>' +
    '<button type="button" class="study-topic" data-study-enter="solve"><strong>AI 解题 SOP <span aria-hidden="true">→</span></strong><small>读题选法 · 分步作答 · 换题练习</small></button>';
  home.insertBefore(block, home.querySelector('.home-welcome'));
}
if (window.ChemEnhance && window.ChemEnhance.home) {
  var originalHome = window.ChemEnhance.home;
  window.ChemEnhance.home = function (root) { originalHome(root); addHomeEntry(root); };
}
addHomeEntry(document.getElementById('docBody'));

/* 3. 对外 API 门面：完整版加载前，错题本（openIonicReview）与 3D 空间
 *    （openLibrary/openOwnQuestion/openQuestion）也可能调用 ChemStudentStudy。
 *    门面与完整版同签名，调用时先按需加载完整版，再转发给完整版；
 *    完整版加载后会整体替换 window.ChemStudentStudy（其内部方法自带懒加载包装）。 */
function facadeCall(method, args) {
  return window.ChemLazy.load('study').then(function () {
    var api = window.ChemStudentStudy;
    if (api && !api.__isStub) return api[method].apply(api, args);
  }).catch(function () {});
}
if (!window.ChemStudentStudy) {
  window.ChemStudentStudy = {
    __isStub: true,
    enter: function (mode, route) { return facadeCall('enter', [mode, route]); },
    /* topicForQuestion 是同步返回值，完整版未加载时无法计算；当前唯一调用方是
       openQuestion 内部（加载后调用），门面返回 '' 表示无匹配，与原行为一致。 */
    topicForQuestion: function () { return ''; },
    openIonicReview: function (id, back) { return facadeCall('openIonicReview', [id, back]); },
    openOwnQuestion: function () { return facadeCall('openOwnQuestion', []); },
    openLibrary: function (id) { return facadeCall('openLibrary', [id]); },
    openQuestion: function (q, thought, opts) { return facadeCall('openQuestion', [q, thought, opts]); }
  };
}

/* 4. 入口点击：经门面进入对应模式（完整版加载后由其自己的监听接管） */
document.addEventListener('click', function (event) {
  var trigger = event.target && event.target.closest
    ? event.target.closest('[data-study-enter]') : null;
  if (!trigger) return;
  var api = window.ChemStudentStudy;
  if (api && !api.__isStub) return; /* 完整版已加载：由其自己的监听接管 */
  window.ChemStudentStudy.enter(trigger.dataset.studyEnter, 'methods');
});

/* 骨架屏主信号：本文件是最后一个首屏核心脚本 */
if (window.ChemLazy) window.ChemLazy.markReady();
})();
