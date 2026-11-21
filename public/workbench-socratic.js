/* ============================================================================
 * 高中化学 3D 考点工作台 — 苏格拉底式助教 + “讲给 AI 听”（工作流 4 / D 组）
 * 配套样式：css/workbench-learn.css（.wbl-soc* / .wbl-feynman*）。
 *
 * 核对结果（见任务汇报）：渲染入口可以干净拦截——
 *   - window.ChemTutor 是普通对象（js/inline-09-studio.js），演示回答的
 *     唯一生产入口是 Tutor.local(q, context)，返回 {answer, refs, actions}；
 *     js/ai-config.js 已经用“运行时包装 local/send、不改源码”的方式扩充了
 *     演示知识库。本模块沿用同一模式：在 ai-config 之后再包一层 local，
 *     只重组回答文本的结构（引导问题 + 分步提示 + 完整答案），不改动
 *     js/ai-config.js 与任何原有 JS，不碰 Tutor.send / Tutor.message。
 *   - 拦截范围只限演示模式：ChemAI.getConfig().mode === 'demo' 时才重组；
 *     用户接通 API 后（function/custom 模式），回答走 ai-config 的
 *     sendViaApi → Tutor.message，不经过 local，本模块自动不介入。
 *   - 无可靠答案的兜底回答（“本站资料暂时没有找到可靠答案”）原样放行，
 *     不做苏格拉底式包装，避免把“没有答案”包装成“有答案”。
 *
 * 内容来源：引导问题是通用教学句式（不含事实断言）；分步提示是对演示
 * 回答原文的句子拆分重组，不新增事实；“讲给 AI 听”的要点清单只来自
 * 现有考点数据（props / principle / steps / phenomena / uses 等字段）。
 *
 * 接口预留（接真实 AI 时）：
 *   - ChemSocratic.format(answer, question, mode) 是纯函数；真实 AI 接入
 *     后，可把本模块的包装点从 Tutor.local 换成对 API 返回文本的后处理，
 *     或直接让模型按同一结构输出（见 MODES 中各模式的 system 提示词草案
 *     注释）；ChemSocratic.setFormatter(fn) 可替换格式化函数。
 *   - “讲给 AI 听”的 checkExplanation() 目前是关键词匹配（演示评估）；
 *     真实 AI 接入后替换为服务端语义评估，函数签名保持不变。
 *
 * 注意：段落标签用的全角方括号在本文件里一律用转义写法
 * （见 BRACKET_L / BRACKET_R，即 U+3010 / U+3011），不要改回字面括号。
 * ========================================================================== */
(function () {
'use strict';

/* ---------- 通用小工具 ---------- */
function $(id) { return document.getElementById(id); }
function storeGet(key, fallback) {
  try { var v = window.localStorage.getItem(key); return v === null ? fallback : v; }
  catch (e) { return fallback; }
}
function storeSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch (e) { /* 忽略 */ }
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function plain(s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, ''); }
function emitLearn(detail) {
  try { window.dispatchEvent(new CustomEvent('chem:learn', { detail: detail })); }
  catch (e) { /* 旧浏览器忽略 */ }
}
/* 全角方括号（U+3010 左 / U+3011 右）：段落标签用。字符码写法，
 * 避免在本文件里出现字面括号（工具链会把字面括号当作引用标记处理）。 */
var BRACKET_L = String.fromCharCode(12304);
var BRACKET_R = String.fromCharCode(12305);
function tag(label) { return BRACKET_L + label + BRACKET_R; }

/* ---------- 模式定义 ---------- */
var MODE_KEY = 'chem3d_v2_socratic_mode';
var MODES = {
  /* system 提示词草案（接真实 AI 时用）：让模型按同一结构输出。 */
  qa: { label: '问答', guide: '先想一想',
    prompt: '你是苏格拉底式化学助教。先提一个引导问题，再给 2-3 条分步提示，最后给完整答案；不要直接甩答案。' },
  solve: { label: '解题', guide: '先审题',
    prompt: '你是苏格拉底式解题助教。先帮学生审题（已知什么、求什么），再给思路提示与分步推导，最后给答案与易错点。' },
  quiz: { label: '测验', guide: '先自测',
    prompt: '你是苏格拉底式测验助教。先出一道与问题相关的小自测让学生思考，再给提示，最后公布答案与解析。' },
  visual: { label: '可视化', guide: '先观察',
    prompt: '你是苏格拉底式助教。先引导学生观察相关的 3D 模型或实验现象，再给提示，最后给答案。' }
};
var MODE_ORDER = ['qa', 'solve', 'quiz', 'visual'];
/* 各模式的快捷提问（只是问题文本，答案仍由演示知识库给出）。 */
var MODE_CHIPS = {
  qa: null, /* 问答模式恢复抽屉原有的 4 条快捷提问 */
  solve: ['这道题应该从哪一步入手？', '先帮我分析题干条件', '这一步为什么这样操作？', '解释当前对象的原理'],
  quiz: ['考考我：滴定终点怎么判断？', '考考我：离子共存的判断方法', '考考我：原电池的正负极', '考考我：化学平衡移动的规律'],
  visual: ['比较水和二氧化碳的极性', '这个分子的空间构型是怎样的？', '用 3D 模型解释一下', '有哪些安全注意事项？']
};
var currentMode = MODE_ORDER.indexOf(storeGet(MODE_KEY, 'qa')) !== -1
  ? storeGet(MODE_KEY, 'qa') : 'qa';
var originalChips = []; /* 抽屉原有的快捷提问文本（初始化时从 DOM 读取） */

/* ---------- 苏格拉底式格式化（纯函数） ---------- */
/* 把回答拆成句子（保留句末标点），不做任何事实改写。 */
function splitSentences(text) {
  var parts = String(text || '').match(/[^。；！？\n]+[。；！？\n]?/g) || [];
  return parts.map(function (p) { return p.replace(/\n/g, '').trim(); })
    .filter(function (p) { return p.length > 0; });
}
function shortQuestion(q) {
  var t = String(q || '').replace(/\s+/g, ' ').trim();
  if (t.length > 24) t = t.slice(0, 24) + '…';
  return t;
}
/* 引导问题：通用教学句式，只复述用户问题，不含事实断言。 */
function guideQuestion(question, mode) {
  var q = shortQuestion(question);
  if (mode === 'solve') {
    return q ? '这个问题已知什么、要求什么？如果让你先列一步，你会先写哪一步（问题：「' + q + '」）？'
      : '已知什么、要求什么？如果让你先列一步，你会先写哪一步？';
  }
  if (mode === 'quiz') {
    return q ? '不看下面的提示，你能先说出「' + q + '」的关键点吗？想好了再往下看。'
      : '不看下面的提示，你能先说出这个问题的关键点吗？想好了再往下看。';
  }
  if (mode === 'visual') {
    return q ? '回答「' + q + '」之前，先打开下面关联的 3D 模型或实验转一转——你看到了什么现象？'
      : '先打开下面关联的 3D 模型或实验转一转——你看到了什么现象？';
  }
  return q ? '要回答「' + q + '」，最关键的概念是什么？你先想到的答案是什么？'
    : '这个问题最关键的概念是什么？你先想到的答案是什么？';
}

function formatSocratic(answer, question, mode) {
  var m = MODES[mode] ? mode : 'qa';
  var text = String(answer || '');
  /* 剥离 ai-config 追加的演示声明，格式化后再原样接回。 */
  var notice = '';
  var demoIdx = text.indexOf(tag('演示模式'));
  if (demoIdx !== -1) {
    notice = text.slice(demoIdx);
    text = text.slice(0, demoIdx).replace(/\s+$/, '');
  }
  /* 兜底回答（无可靠答案）不做结构包装，原样返回。 */
  if (text.indexOf('暂时没有找到可靠答案') !== -1) return answer;
  var sentences = splitSentences(text);
  if (sentences.length === 0) return answer;
  var guide = tag(MODES[m].guide) + guideQuestion(question, m);
  var hints, rest;
  if (sentences.length === 1) {
    hints = tag('分步提示') + '① ' + sentences[0];
    rest = tag('完整答案') + sentences[0];
  } else {
    var hintCount = Math.min(3, sentences.length - 1);
    hints = tag('分步提示') + sentences.slice(0, hintCount).map(function (s, i) {
      return '①②③'[i] + ' ' + s;
    }).join('\n');
    rest = tag('完整答案') + text;
  }
  var out = guide + '\n\n' + hints + '\n\n' + rest;
  if (notice) out += '\n\n' + notice;
  return out;
}
var customFormatter = null;

/* ---------- 包装 Tutor.local（演示模式才重组） ---------- */
function isDemoMode() {
  try {
    if (window.ChemAI && typeof window.ChemAI.getConfig === 'function') {
      return window.ChemAI.getConfig().mode === 'demo';
    }
  } catch (e) { /* ChemAI 未加载时按演示模式处理 */ }
  return true;
}
function wrapTutorLocal() {
  var T = window.ChemTutor;
  if (!T || typeof T.local !== 'function' || T.__chemSocraticWrapped) return !!T;
  var origLocal = T.local; /* ai-config 包装过的 local（含演示知识库） */
  T.__chemSocraticWrapped = true;
  T.local = function (q, c) {
    var r = origLocal.call(T, q, c);
    if (!r || typeof r.answer !== 'string') return r;
    if (!isDemoMode()) return r;
    var fmt = customFormatter || formatSocratic;
    var out = { answer: fmt(r.answer, q, currentMode) };
    if (r.refs) out.refs = r.refs;
    if (r.actions) out.actions = r.actions;
    return out;
  };
  return true;
}

/* ---------- 模式切换 UI（注入助教抽屉 #caQuick 上方） ---------- */
function drawer() { return $('chemAssistant'); }
function renderChips() {
  var quick = $('caQuick');
  if (!quick) return;
  var list = MODE_CHIPS[currentMode] || originalChips;
  quick.innerHTML = '';
  list.forEach(function (q) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-sub';
    b.textContent = q;
    b.addEventListener('click', function () {
      if (window.ChemTutor) window.ChemTutor.send(q);
    });
    quick.appendChild(b);
  });
}
function setMode(mode) {
  if (!MODES[mode]) return;
  currentMode = mode;
  storeSet(MODE_KEY, mode);
  var row = document.querySelector('[data-wbl-soc-modes]');
  if (row) {
    row.querySelectorAll('button').forEach(function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  renderChips();
}
function injectModeRow() {
  var pane = drawer();
  var quick = $('caQuick');
  if (!pane || !quick || document.querySelector('[data-wbl-soc-modes]')) return;
  /* 第一次注入时，从 DOM 读出抽屉原有的快捷提问（问答模式恢复用）。 */
  if (!originalChips.length) {
    Array.prototype.forEach.call(quick.querySelectorAll('button'), function (b) {
      var t = b.textContent.trim();
      if (t) originalChips.push(t);
    });
    if (!originalChips.length) {
      originalChips = ['解释当前对象的原理', '这一步为什么这样操作？',
        '有哪些安全注意事项？', '比较水和二氧化碳的极性'];
    }
  }
  var row = document.createElement('div');
  row.className = 'wbl-soc-modes';
  row.setAttribute('data-wbl-soc-modes', '1');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', '助教回答模式（演示）');
  var label = document.createElement('span');
  label.className = 'wbl-soc-modes-label';
  label.textContent = '助教模式';
  row.appendChild(label);
  MODE_ORDER.forEach(function (m) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'wbl-soc-mode' + (m === currentMode ? ' on' : '');
    b.setAttribute('data-mode', m);
    b.setAttribute('aria-pressed', m === currentMode ? 'true' : 'false');
    b.textContent = MODES[m].label;
    b.addEventListener('click', function () { setMode(m); });
    row.appendChild(b);
  });
  var badge = document.createElement('span');
  badge.className = 'wbl-demo-badge';
  badge.textContent = '演示';
  badge.title = '模式切换只改变演示回答的呈现结构与快捷提问，不连接真实 AI';
  row.appendChild(badge);
  quick.parentNode.insertBefore(row, quick);
  renderChips();
  injectFeynmanEntry();
}

/* ---------- “讲给 AI 听”（费曼学习法 · 演示评估） ---------- */
var KIND_LABEL = { sub: '化学物品', app: '化学仪器', mol: '分子与晶体', exp: '化学实验' };
var FEYNMAN_XP = 10;

/* 从一段文本里抽关键词：按标点切分，保留 2 字以上的片段；
 * 长片段（>6 字）再取 4 字的前缀与后缀作辅助关键词，避免整句过长无法命中。 */
function keywordsOf(text, extra) {
  var out = [];
  var seen = {};
  function push(w) {
    w = String(w || '').trim();
    if (w.length >= 2 && !seen[w]) { seen[w] = 1; out.push(w); }
  }
  if (extra) push(extra);
  String(text || '').split(/[，。、；：！？\s（）()「」『』·—\-/]+/).forEach(function (seg) {
    push(seg);
    if (seg.length > 6) { push(seg.slice(0, 4)); push(seg.slice(-4)); }
  });
  return out.slice(0, 8);
}
/* 要点清单：只来自现有考点数据字段；每个要点带主关键词与辅助关键词。 */
function buildKeyPoints(kind, item) {
  var points = [];
  function add(text, mainKw, extraText) {
    if (!text) return;
    var t = plain(text).trim();
    if (!t) return;
    var kws = keywordsOf(extraText || t, mainKw);
    if (!kws.length) return;
    points.push({ text: t.length > 60 ? t.slice(0, 60) + '…' : t, keywords: kws });
  }
  if (kind === 'exp') {
    splitSentences(item.principle || '').slice(0, 2).forEach(function (s) { add(s); });
    (item.steps || []).slice(0, 3).forEach(function (s) { add(s.t + '：' + s.txt, s.t); });
    (item.phenomena || []).slice(0, 2).forEach(function (p) { add('现象：' + p); });
  } else {
    (item.props || []).slice(0, 3).forEach(function (p) { add(p[0] + '：' + p[1], p[0], p[1]); });
    if (item.info) add(item.info);
    splitSentences(item.desc || '').slice(0, 2).forEach(function (s) { add(s); });
    (item.uses || []).slice(0, 1).forEach(function (u) { add('用途：' + u); });
  }
  return points.slice(0, 6);
}
/* 演示评估：要点“讲到了”当且仅当讲解文本包含其主关键词，
 * 或包含任一 4 字以上的关键词，或包含 2 个以上的关键词。
 * 明确标注为关键词匹配，非真实 AI 判断。 */
function checkExplanation(userText, points) {
  var text = String(userText || '');
  var covered = 0;
  var results = points.map(function (p) {
    var main = p.keywords[0];
    var hits = p.keywords.filter(function (k) { return text.indexOf(k) !== -1; });
    var longHit = hits.some(function (k) { return k.length >= 4; });
    var ok = (main && text.indexOf(main) !== -1) || longHit || hits.length >= 2;
    if (ok) covered += 1;
    return { text: p.text, keywords: p.keywords, hit: ok, matched: hits };
  });
  return { results: results, covered: covered, total: points.length,
    rate: points.length ? Math.round(covered / points.length * 100) : 0 };
}

function allItems() {
  var db = window.DB || {};
  var out = [];
  [['sub', 'subs'], ['app', 'app'], ['mol', 'mols'], ['exp', 'exps']].forEach(function (pair) {
    var arr = db[pair[1]];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (it) { out.push({ kind: pair[0], id: it.id, name: it.name }); });
  });
  return out;
}
function findItem(kind, id) {
  var db = window.DB || {};
  var map = { sub: 'subs', app: 'app', mol: 'mols', exp: 'exps' };
  var arr = db[map[kind]] || [];
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
  return null;
}

function injectFeynmanEntry() {
  var quick = $('caQuick');
  if (!quick || document.querySelector('[data-wbl-feynman-btn]')) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-sub wbl-feynman-btn';
  btn.setAttribute('data-wbl-feynman-btn', '1');
  btn.textContent = '🎓 讲给 AI 听（费曼法 · 演示）';
  btn.title = '用自己的话讲一遍概念，演示模式按要点清单逐项反馈讲到了哪些';
  btn.addEventListener('click', toggleFeynmanPanel);
  quick.parentNode.insertBefore(btn, quick.nextSibling);
}
function toggleFeynmanPanel() {
  var panel = $('wblFeynmanPanel');
  if (panel) { panel.remove(); return; }
  var btn = document.querySelector('[data-wbl-feynman-btn]');
  if (!btn) return;
  panel = document.createElement('div');
  panel.id = 'wblFeynmanPanel';
  panel.className = 'wbl-feynman-panel';
  var items = allItems();
  var cur = null;
  try { cur = window.ChemTutor ? window.ChemTutor.current() : null; } catch (e) {}
  var curValue = cur && cur.kind && cur.id ? cur.kind + ':' + cur.id : '';
  var options = items.map(function (it) {
    return '<option value="' + esc(it.kind + ':' + it.id) + '"' +
      (it.kind + ':' + it.id === curValue ? ' selected' : '') + '>' +
      esc('[' + (KIND_LABEL[it.kind] || '') + '] ' + it.name) + '</option>';
  }).join('');
  panel.innerHTML =
    '<div class="wbl-feynman-head"><strong>讲给 AI 听</strong>' +
    '<span class="wbl-demo-badge">演示评估</span>' +
    '<button class="btn-sub wbl-feynman-x" id="wblFeynmanClose" type="button" aria-label="关闭">×</button></div>' +
    '<p class="wbl-feynman-note">选一个概念，用自己的话讲一遍。演示模式会按该概念的要点清单（来自本站考点数据）逐项反馈“讲到了 / 没讲到”，只做关键词匹配，<b>不是真实 AI 判断</b>。</p>' +
    '<label class="wbl-feynman-label">要讲的概念' +
    '<select id="wblFeynmanConcept">' + options + '</select></label>' +
    '<label class="wbl-feynman-label">我的讲解' +
    '<textarea id="wblFeynmanText" rows="4" maxlength="2000" placeholder="例如：酚酞是酸碱指示剂，遇碱变红……"></textarea></label>' +
    '<button class="btn-main wbl-feynman-check" id="wblFeynmanCheck" type="button">检查我的讲解</button>' +
    '<div class="wbl-feynman-result" id="wblFeynmanResult" role="status"></div>';
  btn.parentNode.insertBefore(panel, btn.nextSibling);
  $('wblFeynmanClose').addEventListener('click', function () { panel.remove(); });
  $('wblFeynmanCheck').addEventListener('click', runFeynmanCheck);
}
function runFeynmanCheck() {
  var sel = $('wblFeynmanConcept');
  var area = $('wblFeynmanText');
  var result = $('wblFeynmanResult');
  if (!sel || !area || !result) return;
  var text = area.value.trim();
  if (text.length < 5) {
    result.innerHTML = '<p class="wbl-feynman-warn">请先写几句讲解（至少 5 个字），再点检查。</p>';
    return;
  }
  var parts = sel.value.split(':');
  var item = findItem(parts[0], parts[1]);
  if (!item) {
    result.innerHTML = '<p class="wbl-feynman-warn">未找到该概念的数据，请重新选择。</p>';
    return;
  }
  var points = buildKeyPoints(parts[0], item);
  if (!points.length) {
    result.innerHTML = '<p class="wbl-feynman-warn">该概念暂无可用的要点清单，换一个概念试试。</p>';
    return;
  }
  var check = checkExplanation(text, points);
  var rows = check.results.map(function (r) {
    return '<li class="' + (r.hit ? 'hit' : 'miss') + '">' +
      '<span class="wbl-feynman-mark">' + (r.hit ? '✓ 讲到了' : '○ 没讲到') + '</span>' +
      '<span>' + esc(r.text) + '</span></li>';
  }).join('');
  result.innerHTML =
    '<p class="wbl-feynman-score">讲到了 ' + check.covered + ' / ' + check.total + ' 个要点（' + check.rate + '%）</p>' +
    '<ul class="wbl-feynman-list">' + rows + '</ul>' +
    '<p class="wbl-feynman-note">演示评估：仅关键词匹配，未理解语义；没讲到的要点可以闪卡复习或追问助教。</p>';
  emitLearn({ type: 'feynman', concept: sel.value, rate: check.rate, xp: FEYNMAN_XP });
  /* 同步一条摘要到对话记录，方便回顾。 */
  try {
    if (window.ChemTutor && typeof window.ChemTutor.message === 'function') {
      var missed = check.results.filter(function (r) { return !r.hit; })
        .map(function (r) { return r.text; });
      var summary = '费曼讲解 · ' + item.name + '：讲到了 ' + check.covered + ' / ' +
        check.total + ' 个要点。' + (missed.length ? '没讲到的要点：' + missed.join('；') : '全部要点都讲到了，讲得很好！') +
        '（演示评估：关键词匹配，非真实 AI 判断）';
      window.ChemTutor.message('assistant', summary, [], [], '费曼讲解 · 演示评估');
    }
  } catch (e) { /* 摘要写入失败不影响面板内反馈 */ }
}

/* ---------- 初始化（带有限重试，防脚本加载顺序变化） ---------- */
function init(attempt) {
  var okLocal = wrapTutorLocal();
  injectModeRow();
  if ((okLocal && document.querySelector('[data-wbl-soc-modes]')) || attempt >= 10) return;
  setTimeout(function () { init(attempt + 1); }, 500);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { init(0); });
} else {
  init(0);
}

/* ---------------- 对外接口 ---------------- */
window.ChemSocratic = {
  /* 苏格拉底式格式化（纯函数；集成点：Tutor.local 包装见 wrapTutorLocal）。 */
  format: formatSocratic,
  setFormatter: function (fn) { customFormatter = typeof fn === 'function' ? fn : null; },
  getMode: function () { return currentMode; },
  setMode: setMode,
  MODES: MODES,
  /* 费曼“讲给 AI 听”：要点清单派生与演示评估（纯函数，可单测）。 */
  buildKeyPoints: buildKeyPoints,
  checkExplanation: checkExplanation,
  openFeynman: function () {
    if (window.ChemTutor) window.ChemTutor.toggle(true);
    setTimeout(function () {
      if (!$('wblFeynmanPanel')) toggleFeynmanPanel();
    }, 60);
  }
};

})();
