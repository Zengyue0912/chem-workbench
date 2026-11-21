/* ============================================================================
 * 高中化学 3D 考点工作台 — 化学方程式渲染器（v2.2.0 / C 组）
 *
 * 轻量自研渲染，零依赖，不引入 KaTeX。
 *
 *   window.ChemRender.renderFormula(text)
 *     纯方程式/化学式字符串 → HTML 字符串（先转义再渲染，防 XSS）。
 *     处理：数字下标（H2SO4 → H₂SO₄）、离子电荷上标（SO4^2- / Fe3+ →
 *     SO₄²⁻ / Fe³⁺）、反应箭头（-> / => → →，<=> / <-> → ⇌，方程式里的 =
 *     也转为 →）、条件箭头（--点燃--> 或 ->[高温]，条件写在箭头上方）、
 *     沉淀 ↓ / 气体 ↑ 符号（原样保留）、系数与状态符号（(s)/(l)/(g)/(aq)
 *     原样保留）、结晶水点（CuSO4.5H2O → CuSO4·5H2O）。
 *     已渲染过的 Unicode（H₂SO₄、SO₄²⁻）会原样通过，不会二次转换。
 *
 *   window.ChemRender.renderInto(element)
 *     对已有 DOM 做文本节点级渲染：只替换文本节点，不动元素结构与事件
 *     监听；只渲染“像化学式”的片段（元素符号须为真实元素，且含下标数字、
 *     电荷或括号才动），其余文字原样保留。幂等：重复调用不产生嵌套标签
 *     （data-chem-rendered 守卫 + Unicode 输出天然不再匹配）。
 *     B 组分步解题：步骤 DOM 生成后调用 ChemRender.renderInto(stepEl)。
 *     若步骤内容是流式追加的，追加完成后调用 ChemRender.refresh(stepEl)。
 *
 *   window.ChemRender.isRendered(el)：是否已渲染过（含祖先已渲染的情况）。
 *
 * 自动监听（模块加载后自动启动，不改任何现有文件）：
 *   - 助教回答：MutationObserver 监听 #caMessages，新增 assistant 消息时只
 *     渲染其中的 .ca-text，不动 .ca-refs / .ca-links 按钮。
 *   - 测验解析：监听 #quizDialog（index.html 静态存在），渲染 .q-why。
 *   - 闪卡：监听 body 下新增的 #wblFlashMask，渲染卡面 .wbl-flash-q /
 *     .wbl-flash-formula / .wbl-flash-a。
 * ========================================================================== */
(function () {
'use strict';

/* ---------- 上下标映射 ---------- */
var SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };

/* 118 种元素符号（用于散文模式下校验候选片段，避免把英文单词当化学式）。 */
var ELEMENTS = {};
('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn ' +
 'Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La ' +
 'Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po ' +
 'At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg ' +
 'Cn Nh Fl Mc Lv Ts Og').split(' ').forEach(function (s) { ELEMENTS[s] = true; });

/* 单元素符号 + 数字时，只有这些常见单质才渲染（避免“维生素B1”之类误伤）。 */
var KNOWN_SINGLE = { H2: 1, O2: 1, O3: 1, N2: 1, F2: 1, Cl2: 1, Br2: 1, I2: 1, S8: 1, P4: 1, C60: 1 };

var RENDERED_ATTR = 'data-chem-rendered';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function subStr(digits) {
  return String(digits).split('').map(function (c) { return SUB[c] || c; }).join('');
}
function supStr(digits) {
  return String(digits).split('').map(function (c) { return SUP[c] || c; }).join('');
}

/* ---------- 条件箭头：--条件--> / --条件→ / ->[条件] → 占位符（最后还原为 HTML） ---------- */
function extractConditionArrows(text, store) {
  return text.replace(/--([^-\n]{1,20})(?:-->|→)|->\[([^\]\n]{1,20})\]/g, function (m, a, b) {
    var cond = (a || b || '').trim();
    if (!cond) return m;
    var html = '<span class="chem-eq-arrow" style="display:inline-flex;flex-direction:column;align-items:center;' +
      'line-height:1.15;vertical-align:middle;margin:0 .15em">' +
      '<span class="chem-eq-cond" style="font-size:.72em;white-space:nowrap">' + esc(cond) + '</span>' +
      '<span>→</span></span>';
    store.push(html);
    return String.fromCharCode(1) + (store.length - 1) + String.fromCharCode(2);
  });
}
function restorePlaceholders(html, store) {
  return html.replace(new RegExp(String.fromCharCode(1) + '(\\d+)' + String.fromCharCode(2), 'g'), function (m, i) { return store[Number(i)] || ''; });
}

/* ---------- 普通箭头（在转义前做，避免 <=> 被转义破坏） ---------- */
function plainArrows(text) {
  return text.replace(/<=>|<->/g, '⇌').replace(/->|=>/g, '→');
}

/* ---------- 纯方程式核心：原始文本 → HTML（内部先转义） ---------- */
function renderFormulaCore(raw) {
  var store = [];
  var t = extractConditionArrows(String(raw == null ? '' : raw), store);
  t = plainArrows(t);
  t = esc(t);
  /* 结晶水点：CuSO4.5H2O → CuSO4·5H2O（点两侧须为化学式字符，避免动小数）。 */
  t = t.replace(/(?<=[A-Za-z0-9\)\]\}])\.(?=\d*[A-Z\(])/g, '·');
  /* 方程式里的 = 转为 →（后须跟化学式开头，避免动 pH=7、Kc=… 之类）。 */
  t = t.replace(/(?<=[A-Za-z0-9\)\]\}])=(?=\d*[A-Z\(])/g, '→');
  /* ^ 电荷：SO4^2- → SO4²⁻，Fe^3+ → Fe³⁺（^ 后的数字全部是电荷数）。 */
  t = t.replace(/\^(\d*)([+-])/g, function (m, d, s) { return supStr(d) + SUP[s]; });
  /* 行末紧贴电荷：Fe3+ → Fe³⁺，Cl- → Cl⁻，CO32- → CO3²⁻。
     符号前一位数字是电荷数还是下标，要看它前面是什么：
     - 前面是数字或右括号 → 电荷数（CO32- 里的 2，[Fe(CN)6]3- 里的 3）；
     - 前面是字母时，看数字前的化学式核心：只有一个元素符号 → 电荷数
       （Fe3+、Al3+、Ca2+）；两个及以上 → 下标，只把符号变上标
       （NH4+ → NH₄⁺，MnO4- → MnO₄⁻）。
     符号必须紧贴化学式字符、后面是分隔符或结尾，避免把“2H2 + O2”里的
     加号当电荷。 */
  t = t.replace(/(\d?)([+-])(?=[\s→⇌（）()\[\]、。；：,]|$)/g, function (m, d, s, off, full) {
    var prev = off > 0 ? full.charAt(off - 1) : '';
    if (!/[A-Za-z0-9\)\]\}]/.test(prev)) return m;
    if (!d) return SUP[s];
    if (/[\d\)\]\}]/.test(prev)) return supStr(d) + SUP[s];
    /* prev 是字母：数数字前的核心里有几个元素符号。 */
    var start = off - 1;
    while (start > 0 && /[A-Za-z0-9()\[\]·]/.test(full.charAt(start - 1))) start--;
    var core = full.slice(start, off);
    var syms = core.match(/[A-Z][a-z]?/g) || [];
    if (syms.length === 1) return supStr(d) + SUP[s];
    return d + SUP[s];
  });
  /* 下标：紧跟元素符号或右括号的数字串（系数、结晶水数目不动）。 */
  t = t.replace(/(?<=[A-Za-z\)\]\}])\d+/g, function (m) { return subStr(m); });
  return restorePlaceholders(t, store);
}

function renderFormula(text) {
  return renderFormulaCore(text);
}

/* ---------- 散文模式：只渲染文本里“像化学式”的片段 ---------- */
var CANDIDATE_RE = /(?:\[[^\[\]]*\]|\([^()]*\)|[A-Z][a-z]?)[A-Za-z0-9()\[\]·.^+\-]*/g;

function parseSymbols(cand) {
  var symbols = [];
  var re = /[A-Z][a-z]?/g;
  var m;
  while ((m = re.exec(cand)) !== null) {
    if (!ELEMENTS[m[0]]) return null;
    symbols.push(m[0]);
  }
  return symbols;
}

function isRenderableFormula(cand) {
  if (!cand || cand.length < 2) return false;
  var symbols = parseSymbols(cand);
  if (!symbols || !symbols.length) return false;
  var hasSubscriptDigit = /[A-Za-z\)\]\}]\d/.test(cand);
  var hasCaretCharge = /\^\d*[+-]/.test(cand);
  var hasTrailingCharge = /\d?[+-]$/.test(cand);
  var hasParenDigit = /\)\d|\]\d/.test(cand);
  if (!hasSubscriptDigit && !hasCaretCharge && !hasTrailingCharge && !hasParenDigit) return false;
  if (symbols.length >= 2) return true;
  /* 单元素符号：须带电荷、括号，或是常见单质。 */
  if (hasCaretCharge || hasTrailingCharge) return true;
  if (/[\(\)\[\]]/.test(cand)) return true;
  return !!KNOWN_SINGLE[cand];
}

/* 文本节点内容 → HTML：化学式片段渲染，其余文字转义后原样保留。 */
function renderProse(text) {
  var store = [];
  var t = extractConditionArrows(String(text == null ? '' : text), store);
  var out = '';
  var last = 0;
  var m;
  CANDIDATE_RE.lastIndex = 0;
  while ((m = CANDIDATE_RE.exec(t)) !== null) {
    var cand = m[0];
    var start = m.index;
    /* 去掉候选末尾的句点/孤括号（“H2O。”里的句点不是结晶水点）。 */
    var trimmed = cand.replace(/[.·(]+$/, '');
    if (trimmed.length >= 2 && isRenderableFormula(trimmed)) {
      out += esc(plainArrows(t.slice(last, start)));
      out += renderFormulaCore(trimmed);
      last = start + trimmed.length;
    }
    /* 不可渲染的候选留在纯文本段里，不动 last。 */
  }
  out += esc(plainArrows(t.slice(last)));
  return restorePlaceholders(out, store);
}

/* ---------- DOM 渲染（文本节点级，幂等） ---------- */
function isRendered(el) {
  return !!(el && el.nodeType === 1 && el.closest && el.closest('[' + RENDERED_ATTR + ']'));
}

function renderInto(el) {
  if (!el || el.nodeType !== 1 || typeof document === 'undefined') return false;
  if (isRendered(el)) return false;
  if (typeof document.createTreeWalker !== 'function') return false;
  var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      var p = node.parentNode;
      if (!p) return NodeFilter.FILTER_REJECT;
      var tag = p.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' ||
          tag === 'SUB' || tag === 'SUP') return NodeFilter.FILTER_REJECT;
      if (p.closest && p.closest('[' + RENDERED_ATTR + '], .chem-eq-arrow')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [];
  var n;
  while ((n = walker.nextNode())) nodes.push(n);
  var changed = false;
  nodes.forEach(function (node) {
    var original = node.nodeValue;
    var html = renderProse(original);
    if (html === esc(original)) return;
    var tmp = document.createElement('span');
    tmp.innerHTML = html;
    var frag = document.createDocumentFragment();
    while (tmp.firstChild) frag.appendChild(tmp.firstChild);
    if (node.parentNode) node.parentNode.replaceChild(frag, node);
    changed = true;
  });
  el.setAttribute(RENDERED_ATTR, '1');
  return changed;
}

function refresh(el) {
  if (el && el.removeAttribute) el.removeAttribute(RENDERED_ATTR);
  return renderInto(el);
}

/* ---------- 自动监听 ---------- */
function renderAssistantMessages(root) {
  if (!root || !root.querySelectorAll) return;
  var bodies = root.querySelectorAll('.ca-msg.assistant .ca-text');
  for (var i = 0; i < bodies.length; i++) renderInto(bodies[i]);
}

function watchAssistant() {
  if (typeof document === 'undefined') return false;
  var box = document.getElementById('caMessages');
  if (!box) return false;
  if (box.__chemRenderWatched) return true;
  box.__chemRenderWatched = true;
  renderAssistantMessages(box);
  if ('MutationObserver' in window) {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mu) {
        mu.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('ca-msg') && node.classList.contains('assistant')) {
            var body = node.querySelector('.ca-text');
            if (body) renderInto(body);
          } else if (node.querySelectorAll) {
            renderAssistantMessages(node);
          }
        });
      });
    }).observe(box, { childList: true });
  }
  return true;
}

function renderQuizExplanations(root) {
  if (!root || !root.querySelectorAll) return;
  var nodes = root.querySelectorAll('.q-why');
  for (var i = 0; i < nodes.length; i++) renderInto(nodes[i]);
}

function watchQuiz() {
  if (typeof document === 'undefined') return false;
  var dlg = document.getElementById('quizDialog');
  if (!dlg) return false;
  if (dlg.__chemRenderWatched) return true;
  dlg.__chemRenderWatched = true;
  renderQuizExplanations(dlg);
  if ('MutationObserver' in window) {
    /* 原 renderQuiz 每次作答/提交都整体重渲染 innerHTML，变化后重新渲染解析。 */
    new MutationObserver(function () { renderQuizExplanations(dlg); }).observe(dlg, { childList: true });
  }
  return true;
}

function renderFlashcardFaces(root) {
  if (!root || !root.querySelectorAll) return;
  var nodes = root.querySelectorAll('.wbl-flash-q, .wbl-flash-formula, .wbl-flash-a');
  for (var i = 0; i < nodes.length; i++) renderInto(nodes[i]);
}

function attachFlashcardMask(mask) {
  if (!mask || mask.__chemRenderWatched) return;
  mask.__chemRenderWatched = true;
  var body = mask.querySelector ? mask.querySelector('#wblFlashBody') : null;
  if (!body) return;
  renderFlashcardFaces(body);
  if ('MutationObserver' in window) {
    /* 闪卡每次翻页都重写 #wblFlashBody 的 innerHTML，变化后重新渲染卡面。 */
    new MutationObserver(function () { renderFlashcardFaces(body); }).observe(body, { childList: true });
  }
}

function watchFlashcards() {
  if (typeof document === 'undefined') return false;
  var mask = document.getElementById('wblFlashMask');
  if (mask) attachFlashcardMask(mask);
  return true;
}

function bootstrap() {
  if (typeof document === 'undefined' || !document.body) return;
  watchAssistant();
  watchQuiz();
  watchFlashcards();
  if (!('MutationObserver' in window)) return;
  /* 晚到挂载：助教面板（#chemAssistant）与闪卡遮罩（#wblFlashMask）都是
     运行时 append 到 body 的，这里只监听 body 直属子节点，命中后接管。 */
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mu) {
      mu.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.id === 'chemAssistant' || (node.querySelector && node.querySelector('#caMessages'))) {
          watchAssistant();
        }
        if (node.id === 'wblFlashMask') attachFlashcardMask(node);
      });
    });
  }).observe(document.body, { childList: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

window.ChemRender = {
  version: '2.2.0',
  renderFormula: renderFormula,
  renderInto: renderInto,
  refresh: refresh,
  isRendered: isRendered,
  watchAssistant: watchAssistant,
  watchQuiz: watchQuiz,
  watchFlashcards: watchFlashcards
};
})();
