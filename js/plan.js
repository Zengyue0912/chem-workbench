/* ============================================================================
 * 高中化学 3D 考点工作台 — 定价与功能门控（工作流 2：商业化产品外壳）
 * ============================================================================
 * 定价三档（与落地页 index.html#pricing 保持一致）：
 *   free   免费版  ¥0        核心功能：3D 实验、考点导航、周期表、SOP 解题、
 *                             练习与测验、错题本（查看与订正）、学习进度。
 *   pro    Pro 会员 ¥19/月 或 ¥149/年
 *                             解锁全部真题解析、AI 助手无限次、错题导出、
 *                             学习记录导出、3D 错题解析卡。
 *   school 学校版  联系洽谈  Pro 全部权益 + 班级管理、课堂数据、专属支持。
 *
 * 门控实现（不改工作流 1 的任何 JS 源码）：
 *   1. 捕获阶段 document 点击监听：工作台的点击处理都是冒泡阶段的
 *      document 委托（如 inline-09-studio.js 的 [data-pr]/[data-teach]、
 *      exam-space.js 的 [data-exam-card]），捕获监听先运行，未开通时
 *      stopPropagation + preventDefault 即可真实拦截，弹窗引导升级。
 *   2. 包装 window.ChemTutor.send：免费版 AI 提问每天 5 次，超限拦截。
 *      原方法保存在 Tutor.__chemOrigSend，供 js/ai-config.js 的降级
 *      分支复用（避免重复计次）。
 *
 * 【演示级付费墙】不产生真实扣费。demoActivate() 仅在本地把 plan 切换
 * 为 pro，供演示与测试；恢复免费版同样在本地完成。
 *   TODO: 接入微信支付/支付宝：正式上线时，把 demoActivate() 换成：
 *     (1) 调用创建订单 API：POST /api/billing/create-order
 *         {plan:'pro', period:'monthly'|'yearly'} -> {orderId, payUrl}
 *     (2) 拉起微信/支付宝收银台（扫码或 JSAPI），用户完成支付；
 *     (3) 服务端收到支付回调后更新用户 plan，前端重新拉取用户状态。
 *   支付回调与订单校验必须在服务端完成，绝不能只信前端传回的状态。
 * ========================================================================== */
(function () {
'use strict';

/* ---------------- 3D 查看器未加载时的空操作兜底 ----------------
 * 工作流 1 的潜在问题（本文件不改 W1 源码，在此运行时兜底）：
 * window.resizeCv / window.needsDraw 只在 viewer3d 懒加载 bundle
 * （js/inline-07-viewer.js 末尾）中定义，而化学助教 Tutor.toggle()
 *（js/inline-09-studio.js）是无条件调用 window.resizeCv() 的。
 * 原站同步加载时这两个函数始终存在；改懒加载后，用户在首次打开
 * 任意 3D 对象之前点“化学助教”或发 AI 提问，就会抛 TypeError。
 * 这里先补两个空操作，viewer3d 加载后会被真实实现覆盖（同名赋值），
 * 行为与原站一致。 */
if (typeof window.resizeCv !== 'function') window.resizeCv = function () {};
if (typeof window.needsDraw !== 'function') window.needsDraw = function () {};

/* ---------------- 定价定义（落地页与付费墙共用同一份文案） ---------------- */
var PLANS = {
  free: {
    id: 'free', name: '免费版', price: '¥0',
    tagline: '核心功能免费使用',
    features: ['3D 实验与分子/晶体查看', '考点导航与搜索', '元素周期表',
      'SOP 解题法（滴定 / VSEPR / 离子 / 有机）', '练习、测验与错题本',
      'AI 助手每天 5 次（演示模式）', '真题解析每天 3 次']
  },
  pro: {
    id: 'pro', name: 'Pro 会员', price: '¥19/月', yearly: '¥149/年',
    tagline: '为认真备考的你准备',
    features: ['免费版全部功能', '全部真题解析，不限次数',
      'AI 助手无限次提问', '错题导出（JSON 备份）',
      '学习记录导出', '3D 错题解析卡', '新功能优先体验']
  },
  school: {
    id: 'school', name: '学校版', price: '联系洽谈',
    tagline: '面向班级与学校',
    features: ['Pro 全部权益', '班级与学生管理', '课堂学习数据汇总',
      '教师备课协作', '专属支持与培训']
  }
};
/* 免费版每日限额（按自然日、按账号分别计数）。 */
var FREE_LIMITS = { ai: 5, analysis: 3 };
var GUEST_PLAN_KEY = 'chem3d_plan_guest_v1';

var FEATURE_COPY = {
  ai: { title: 'AI 助手提问次数已用完', desc: '免费版每天可向 AI 助手提问 5 次。升级 Pro 后无限次提问，备考冲刺不用等明天。' },
  analysis: { title: '完整解析查看次数已用完', desc: '免费版每天可查看 3 次完整解析。升级 Pro 后全部真题解析不限次数，随看随学。' },
  export: { title: '错题导出是 Pro 功能', desc: '把错题本导出为 JSON 文件，随时备份、换设备也不丢。升级 Pro 即可使用。' },
  records: { title: '学习记录导出是 Pro 功能', desc: '把练习与作答记录导出备份，方便整理复习。升级 Pro 即可使用。' },
  card: { title: '3D 错题解析卡是 Pro 功能', desc: '把错题生成带 3D 模型的解析卡图片，方便保存与分享。升级 Pro 即可使用。' },
  menu: { title: '升级 Pro，解锁完整功能', desc: '全部真题解析、AI 助手无限次、错题与学习记录导出、3D 错题解析卡。' }
};

/* ---------------- 账号与套餐读写 ---------------- */
function accountId() {
  return (window.ChemAuth && window.ChemAuth.getCurrentUserId()) || 'guest';
}
function getPlan() {
  if (window.ChemAuth && window.ChemAuth.isLoggedIn()) {
    var u = window.ChemAuth.getCurrentUser();
    if (u && u.plan && PLANS[u.plan]) return u.plan;
  }
  try {
    var g = localStorage.getItem(GUEST_PLAN_KEY);
    return g && PLANS[g] ? g : 'free';
  } catch (e) { return 'free'; }
}
function isPro() { var p = getPlan(); return p === 'pro' || p === 'school'; }
async function setPlan(plan) {
  if (!PLANS[plan]) plan = 'free';
  if (window.ChemAuth && window.ChemAuth.isLoggedIn()) {
    var u = window.ChemAuth.getCurrentUser();
    if (u) await window.ChemAuth.updateUser(u.id, { plan: plan });
  } else {
    try { localStorage.setItem(GUEST_PLAN_KEY, plan); } catch (e) {}
  }
  window.dispatchEvent(new CustomEvent('chem:plan-change', { detail: { plan: plan } }));
  return plan;
}

/* ---------------- 每日限额（按账号 + 自然日） ---------------- */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function quotaKey() { return 'chem3d_plan_quota_' + accountId() + '_' + todayStr(); }
function readQuota() {
  try {
    var q = JSON.parse(localStorage.getItem(quotaKey()) || '{}');
    return { ai: q.ai | 0, analysis: q.analysis | 0 };
  } catch (e) { return { ai: 0, analysis: 0 }; }
}
function writeQuota(q) {
  try { localStorage.setItem(quotaKey(), JSON.stringify(q)); } catch (e) {}
}
/* 返回 true 表示本次消耗成功（Pro 直接放行，不计数）。 */
function consume(kind) {
  if (isPro()) return true;
  var limit = FREE_LIMITS[kind];
  var q = readQuota();
  if (q[kind] >= limit) return false;
  q[kind] += 1;
  writeQuota(q);
  return true;
}
function remaining(kind) {
  if (isPro()) return Infinity;
  return Math.max(0, FREE_LIMITS[kind] - readQuota()[kind]);
}
function quotaStatus() {
  return {
    plan: getPlan(),
    ai: { used: readQuota().ai, limit: FREE_LIMITS.ai, remaining: remaining('ai') },
    analysis: { used: readQuota().analysis, limit: FREE_LIMITS.analysis, remaining: remaining('analysis') }
  };
}
function can(feature) {
  if (feature === 'ai-unlimited') return isPro();
  if (feature === 'exam-analysis') return isPro() || remaining('analysis') > 0;
  /* mistake-export / record-export / exam-card 均为 Pro 专属，无免费额度。 */
  return isPro();
}

/* ---------------- 付费墙弹窗 ---------------- */
function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function toast(msg) {
  var t = document.getElementById('toast');
  if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2600); }
  else window.alert(msg);
}
function closePaywall() {
  var m = document.querySelector('.chem2-paywall-mask');
  if (m) m.remove();
}
function showPaywall(feature) {
  closePaywall();
  var copy = FEATURE_COPY[feature] || FEATURE_COPY.menu;
  var pro = PLANS.pro;
  var mask = el('div', 'chem2-mask chem2-paywall-mask');
  mask.setAttribute('role', 'dialog');
  mask.setAttribute('aria-modal', 'true');
  mask.setAttribute('aria-label', '升级 Pro');
  var box = el('div', 'chem2-box chem2-paywall-box');
  var badge = el('span', 'chem2-paywall-badge', 'Pro 会员');
  var title = el('h2', 'chem2-title', copy.title);
  var desc = el('p', 'chem2-note', copy.desc);
  var price = el('p', 'chem2-price', 'Pro 会员 · ¥19/月 或 ¥149/年');
  var list = el('ul', 'chem2-feature-list');
  pro.features.forEach(function (f) { list.appendChild(el('li', '', '✓ ' + f)); });
  var demoNote = el('p', 'chem2-note chem2-demo-note',
    '演示级付费墙：点击“演示开通”仅在本地切换演示状态，不会扣费、' +
    '不跳转支付。正式上线后此处将接入微信支付 / 支付宝。');
  var activateBtn = el('button', 'btn-main chem2-paywall-cta', '演示开通 Pro（不扣费）');
  activateBtn.type = 'button';
  /* 工作流 3 埋点：付费墙演示开通（js/analytics.js 委托监听 data-analytics） */
  activateBtn.setAttribute('data-analytics', 'upgrade');
  activateBtn.setAttribute('data-analytics-source', 'app-paywall');
  var pricingLink = el('a', 'btn-sub chem2-paywall-link', '查看完整定价');
  pricingLink.href = 'index.html#pricing';
  var laterBtn = el('button', 'btn-sub', '稍后再说');
  laterBtn.type = 'button';
  var closeBtn = el('button', 'chem2-x', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '关闭');
  box.append(closeBtn, badge, title, desc, price, list, demoNote, activateBtn, pricingLink, laterBtn);
  mask.appendChild(box);
  document.body.appendChild(mask);
  activateBtn.focus();

  closeBtn.addEventListener('click', closePaywall);
  laterBtn.addEventListener('click', closePaywall);
  mask.addEventListener('click', function (e) { if (e.target === mask) closePaywall(); });
  mask.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); closePaywall(); }
  });
  activateBtn.addEventListener('click', function () { demoActivate('pro'); });
}
/* 演示开通：仅本地切换 plan。正式支付见文件头 TODO。 */
async function demoActivate(plan) {
  await setPlan(plan);
  closePaywall();
  toast(plan === 'pro' || plan === 'school'
    ? '演示开通成功：已切换为' + PLANS[plan].name + '（未扣费）。'
    : '已恢复为免费版（演示）。');
}

/* ---------------- 门控点：捕获阶段点击拦截 ----------------
 * 工作台的点击处理均为冒泡阶段委托；捕获监听先运行，拦截时
 * stopPropagation + preventDefault，工作台的原处理不会执行。 */
var GATES = [
  /* 错题本：导出错题按钮（inline-09-studio.js，data-teach="export-wrong"） */
  { selector: '[data-teach="export-wrong"]', feature: 'export', kind: null },
  /* 练习册：导出学习记录（inline-09-studio.js，data-pr="exportrecords"） */
  { selector: '[data-pr="exportrecords"]', feature: 'records', kind: null },
  /* 真题空间：3D 错题解析卡（exam-space.js，data-exam-card） */
  { selector: '[data-exam-card]', feature: 'card', kind: null },
  /* 练习册：查看完整解析（inline-09-studio.js，data-pr="reveal"） */
  { selector: '[data-pr="reveal"]', feature: 'analysis', kind: 'analysis' },
  /* 错题本详情：查看解析（inline-09-studio.js，data-teach="solution"） */
  { selector: '[data-teach="solution"]', feature: 'analysis', kind: 'analysis' }
];
function gateFor(target) {
  for (var i = 0; i < GATES.length; i++) {
    var g = GATES[i];
    var hit = target.closest ? target.closest(g.selector) : null;
    if (hit) return g;
  }
  /* 通用钩子：任何带 data-plan-gate="feature" 的元素都可被门控；
   * data-plan-upgrade 的元素点击直接打开付费墙。 */
  var custom = target.closest ? target.closest('[data-plan-gate]') : null;
  if (custom) {
    var f = custom.getAttribute('data-plan-gate');
    return { feature: FEATURE_COPY[f] ? f : 'menu', kind: f === 'analysis' ? 'analysis' : null };
  }
  return null;
}
function onClickCapture(e) {
  if (!e.target || !e.target.closest) return;
  if (e.target.closest('[data-plan-upgrade]')) {
    e.preventDefault(); e.stopPropagation();
    showPaywall('menu');
    return;
  }
  var gate = gateFor(e.target);
  if (!gate) return;
  if (gate.kind) {
    /* 限额类：Pro 放行；免费版有剩余额度则消耗一次后放行。 */
    if (consume(gate.kind)) return;
  } else if (can(gate.feature)) {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  showPaywall(gate.feature);
}
document.addEventListener('click', onClickCapture, true);

/* ---------------- AI 助手次数门控：包装 ChemTutor.send ---------------- */
function wrapTutorSend() {
  var T = window.ChemTutor;
  if (!T || typeof T.send !== 'function' || T.__chemPlanWrapped) return !!T;
  var orig = T.send;
  T.__chemOrigSend = orig; /* 供 ai-config.js 降级分支复用，避免重复计次 */
  T.__chemPlanWrapped = true;
  T.send = async function (q) {
    var input = document.getElementById('caInput');
    var text = (q == null ? (input ? input.value : '') : q);
    text = String(text == null ? '' : text).trim();
    /* 空问题或正在回答中：交给原逻辑自行 no-op，不计次数。 */
    if (!text || T.busy) return orig.call(T, q);
    if (!consume('ai')) { showPaywall('ai'); return; }
    return orig.call(T, q);
  };
  return true;
}
/* plan.js 排在 inline-09-studio.js 之后执行，正常情况下 ChemTutor 已存在；
 * 仍做有限重试，防脚本加载顺序变化。 */
(function retryWrap(attempt) {
  if (wrapTutorSend()) return;
  if (attempt < 10) setTimeout(function () { retryWrap(attempt + 1); }, 500);
})(0);

/* ---------------- 落地页 CTA：app.html?upgrade=pro 自动打开付费墙 ---------------- */
function maybeOpenFromParam() {
  try {
    var params = new URLSearchParams(location.search);
    if (params.get('upgrade') === 'pro') {
      setTimeout(function () { showPaywall('menu'); }, 600);
    }
  } catch (e) {}
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', maybeOpenFromParam);
} else {
  maybeOpenFromParam();
}

/* ---------------- 对外接口 ---------------- */
window.ChemPlan = {
  PLANS: PLANS,
  FREE_LIMITS: FREE_LIMITS,
  getPlan: getPlan,
  setPlan: setPlan,
  isPro: isPro,
  can: can,
  consumeAI: function () { return consume('ai'); },
  consumeAnalysis: function () { return consume('analysis'); },
  quotaStatus: quotaStatus,
  showPaywall: showPaywall,
  closePaywall: closePaywall,
  demoActivate: demoActivate
};

})();
