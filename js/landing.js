/* ============================================================================
 * 高中化学 3D 考点工作台 — 营销落地页脚本（工作流 2）
 * 仅用于 index.html / about.html / privacy.html / terms.html：
 * FAQ 手风琴、移动端导航开关、意见反馈表单占位、页脚年份。
 * 零内联脚本（CSP script-src 'self'）；全部用 addEventListener 绑定。
 * ========================================================================== */
(function () {
'use strict';

function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
  else fn();
}

onReady(function () {
  /* ---------- FAQ 手风琴（事件委托） ---------- */
  document.addEventListener('click', function (e) {
    var q = e.target.closest ? e.target.closest('.faq-q') : null;
    if (!q) return;
    var item = q.closest('.faq-item');
    if (!item) return;
    var open = item.classList.toggle('open');
    q.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* ---------- 移动端导航开关 ---------- */
  var toggle = document.querySelector('.ld-nav-toggle');
  var nav = document.querySelector('.ld-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) nav.classList.remove('open');
    });
  }

  /* ---------- 意见反馈表单占位：不提交到后端，引导用户发邮件 ---------- */
  var form = document.getElementById('feedbackForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = document.getElementById('feedbackStatus');
      if (status) {
        status.textContent = '演示：表单尚未接入后端，请用邮件反馈（点击上方邮箱地址即可写信）。感谢你的建议！';
      }
    });
  }

  /* ---------- 页脚年份 ---------- */
  document.querySelectorAll('[data-year]').forEach(function (n) {
    n.textContent = new Date().getFullYear();
  });
});

})();
