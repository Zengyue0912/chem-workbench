/* ============================================================================
 * 高中化学 3D 考点工作台 — 分步交互解题 + 错因诊断 + 变式训练（v2.2.0 / B 组）
 * 配套样式：css/workbench-solve.css。挂载：window.ChemSolveFlow。
 *
 * 只新增本文件，不改动任何原有文件；沿用 v2.1 的包装/委托模式：
 *   - 解题面板复用站内弹窗样式 .quiz-mask / .quiz-dialog；
 *   - 3D 打开、Vibe 动画、SOP、助教、掌握状态全部复用现有公开入口。
 *
 * 与 A 组计算引擎（window.ChemSolveEngine，js/workbench-solve-engine.js）
 * 的对接契约（已按 A 组交付的真实接口核对，见 buildPhSpec / buildStoichSpec /
 * buildConserveSpec 与 VARIANT_TEMPLATES）：
 *   - 所有方法返回 {ok: boolean, ...}；成功带 steps: [{title, detail}]，
 *     失败带 error（中文）。方法：parseFormula(text)、balance(eqText)、
 *     ph(spec)、stoich(spec)、conserve(spec)。
 *   - balance(eqText)：方程式字符串（= / -> / → 均可）；成功返回
 *     {balanced, coefficients, steps}，balanced 用“→”连接。
 *   - ph(spec)：{kind, c, ...}，kind ∈ strong-acid / strong-base /
 *     dilute / mix / weak-acid / weak-base；c 为浓度 mol/L；n 为每分子
 *     电离数（H2SO4、Ba(OH)2 取 2）；dilute 需 c + factor（或 v/v2）；
 *     weak-acid/weak-base 需 Ka/Kb。成功返回 {value, steps}。
 *   - stoich(spec)：{kind, ...}，kind ∈ n-mass（{mass|n, M|formula}）/
 *     n-volume（{n|volume}）/ n-particles / molarity（n、c、volume
 *     三选二，体积单位 L）/ reaction（{equation, given:[{formula,
 *     mass|mol|volume}], target}）。成功返回 {result, steps}，result
 *     是对象（如 {n, mass, M}、{targetMol, targetMass}），答案须按
 *     模板指定的 answerField 字段提取。
 *   - conserve(spec)：按 template 分派，template ∈ solution-charge
 *     （{cations:[{ion,c}], anions:[...]}，未知浓度填 "x"）/
 *     redox-electron（{oxidants:[{formula,electrons,mol}],
 *     reductants:[...]}）/ mass-equation / element-conserve /
 *     dilution / charge-check。成功返回 {equations, steps}，可唯一
 *     求解时另附 solution（{ion, value} 或 {formula, mol}）或 result。
 *   - 本模块的 spec 始终附带 text（完整题干原文，供人阅读与调试；
 *     引擎忽略该字段），结构化字段按上述形状填写。
 *   - 变式题答案一律从引擎返回中提取（answerField 指定字段路径，
 *     或 answer / balanced / value / solution.value / solution.mol）；
 *     提不到数值/字符串答案的变式不生成。
 *   - 引擎不存在或返回 ok:false 时，本模块降级走 SOP / 助教链路，并明确
 *     标注原因，绝不编造答案。
 *
 * 与 C 组联动（workbench-solve-ocr.js / workbench-chem-render.js，全部
 * 防御性调用，C 组模块未加载时静默跳过，不报错）：
 *   - 解题历史：解题完成（全部步骤已展开）时派发 CustomEvent
 *     'chem:solve-complete'，detail {question, method, result, source}；
 *     method 与面板置信度一致（engine→engine、sop→rules、tutor→
 *     retrieval，无可靠解析时不派发）；source 取 ocr（拍照题干，经
 *     start() 的 opts.source 传入）/ example（变式题）/ custom（手动
 *     输入）；result 取最后一步的 detail。每会话只派发一次。
 *     ChemSolveHistory 监听该事件记入历史，本模块不直接调用它。
 *   - 错题联动：点某步“没懂”时调 ChemSolveMistakes.markNotUnderstood(
 *     question, {topic, note})；变式题答错时调 markVariantWrong(question,
 *     {topic, note})；变式答对或全部步骤都点“懂了”后调
 *     markUnderstood(question)。
 *   - 方程式渲染：每次渲染后对每个步骤元素调 ChemRender.renderInto(
 *     stepEl)，再对整个面板调 ChemRender.refresh(dialogEl)（本模块
 *     内容非流式，整屏渲染完成即为“追加完成”点）。
 *
 * 复用的现有入口（只读/委托，不改原文件）：
 *   - 3D 打开：window.ChemTutor.act({type:'open', kind, id})
 *     （js/inline-09-studio.js 的 Tutor.act；无 ChemTutor 时退化为
 *     window.select(kind, id)，与 act 内部同一调用）
 *   - 分子对比：ChemTutor.act({type:'compare', a, b})
 *   - 分步动画：window.ChemVibe.open(id)，id 取自 ChemVibe.topics
 *     （vsepr / titration / cloud，见 js/workbench-vibe.js）
 *   - 苏格拉底引导：window.ChemSocratic.format(answer, q, 'solve') 的
 *     首段引导问题（仅用于“没懂”提示；不可用时用内置通用引导句式）
 *   - 规则 SOP：window.ChemQuestionSop.analyze(q)（VSEPR / 水电离专项）、
 *     window.ChemPreparedSop（splitQuestion / rank / confidentMatch /
 *     makePlan，见 js/student-question-sop.js 与 student-prepared-sop.js）
 *   - 资料检索：window.ChemTutor.local(q, ChemTutor.current())
 *   - 助教提问：window.ChemTutor.send(text)
 *   - 掌握状态：localStorage 键 chem3d_quiz_<id>（js/workbench-nav.js 规则：
 *     {score, total, ts}，>= ceil(total*0.75) 已掌握，>= 50% 学习中，
 *     否则薄弱；只对 DB 中确有 quiz 数组的考点显示）。本模块不新增任何
 *     localStorage 键；变式题做对后按“保留更好成绩”合并写入同一键。
 *
 * 错因诊断的规则表（内置数据，仅作确定性规则查表，不做语义猜测）：
 *   弱电解质 16 种 + 难溶物 16 种 + 气体 6 种 = 38 种；需标注反应条件
 *   的反应 15 条；电荷守恒核对用的常见离子表 29 种。
 * ========================================================================== */
(function () {
'use strict';

/* ---------- 通用 ---------- */
function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function plain(s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, ''); }
function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function isArray(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
function isFiniteNumber(v) { return typeof v === 'number' && isFinite(v); }

/* 下标/上标/箭头/全角符号 -> ASCII（只用于匹配与传给引擎，显示仍用原文）。 */
var NORM_MAP = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '−': '-', '→': '=', '⟶': '=', '⇒': '=',
  '＝': '=', '＋': '+', '－': '-', '（': '(', '）': ')',
  '÷': '/', '^': '', '﹢': '+', '﹣': '-'
};
function norm(s) {
  var out = '', i, ch;
  s = String(s == null ? '' : s);
  for (i = 0; i < s.length; i++) {
    ch = s.charAt(i);
    out += hasOwn(NORM_MAP, ch) ? NORM_MAP[ch] : ch;
  }
  return out;
}
/* 去空格的归一化文本（离子/化学式子串匹配用）。 */
function normFlat(s) { return norm(s).replace(/\s+/g, ''); }

/* 把回答拆成句子（保留句末标点），只做重组，不改写事实。 */
function splitSentences(text) {
  var parts = String(text || '').match(/[^。；！？\n]+[。；！？\n]?/g) || [];
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].replace(/\n/g, '').replace(/^\s+|\s+$/g, '');
    if (p.length > 0) out.push(p);
  }
  return out;
}
function fmtNum(n) {
  if (!isFiniteNumber(n)) return String(n);
  var r = Math.round(n * 1000000) / 1000000;
  return String(r);
}
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function emitContext() {
  try { window.dispatchEvent(new CustomEvent('chem:context')); } catch (e) { /* 旧浏览器忽略 */ }
}

/* ---------- C 组联动（防御性调用，C 组模块未加载时静默跳过） ---------- */
var HISTORY_METHOD = { engine: 'engine', sop: 'rules', tutor: 'retrieval' };
function historySource() {
  if (!S) return 'custom';
  if (S.opts && S.opts.source === 'ocr') return 'ocr';
  if (S.opts && S.opts.fromVariant) return 'example';
  return 'custom';
}
function historyResult(plan) {
  if (!plan || !plan.steps.length) return '';
  var last = plan.steps[plan.steps.length - 1];
  return (trim(last.detail || '') || trim(last.title || '')).slice(0, 500);
}
/* 解题完成时派发历史事件（每会话一次；无可靠解析时不派发）。 */
function maybeDispatchComplete() {
  if (!S || !S.plan || S.view !== 'solve' || S.historyDispatched) return;
  var method = HISTORY_METHOD[S.plan.confidence];
  if (!method || !isFinished()) return;
  S.historyDispatched = true;
  try {
    window.dispatchEvent(new CustomEvent('chem:solve-complete', { detail: {
      question: S.plan.question, method: method,
      result: historyResult(S.plan), source: historySource()
    } }));
  } catch (e) { /* 派发失败不影响解题流程 */ }
}
function callMistakes(fnName, question, opts) {
  try {
    var M = window.ChemSolveMistakes;
    if (M && typeof M[fnName] === 'function') M[fnName](question, opts);
  } catch (e) { /* 错题联动失败不影响解题流程 */ }
}
function mistakeTopic() {
  return (S && S.plan && S.plan.review) ? S.plan.review.topicName : 'AI 解题';
}
/* 方程式渲染：步骤 DOM 生成后逐个 renderInto，整屏内容就绪后 refresh。 */
function renderFormulas() {
  if (!dialogEl) return;
  try {
    var R = window.ChemRender;
    if (!R) return;
    if (typeof R.renderInto === 'function') {
      var els = dialogEl.querySelectorAll('.wbs-step, .wbs-variant-q, .wbs-finding, .wbs-q');
      for (var i = 0; i < els.length; i++) {
        try { R.renderInto(els[i]); } catch (e2) { /* 单个元素失败不中断 */ }
      }
    }
    if (typeof R.refresh === 'function') {
      try { R.refresh(dialogEl); } catch (e3) { /* 忽略 */ }
    }
  } catch (e) { /* 渲染失败不影响解题流程 */ }
}

/* ---------- 计算引擎（防御性调用） ---------- */
function engine() {
  try { return window.ChemSolveEngine || null; } catch (e) { return null; }
}
/* 校验引擎返回的 steps，非法条目丢弃；全部非法返回 null。 */
function validSteps(r) {
  if (!r || !isArray(r.steps)) return null;
  var steps = [];
  for (var i = 0; i < r.steps.length; i++) {
    var s = r.steps[i];
    if (!s) continue;
    var title = trim(s.title || '');
    var detail = trim(s.detail || '');
    if (!title && !detail) continue;
    steps.push({
      title: title || ('第' + (i + 1) + '步'),
      detail: detail,
      why: trim(s.why || s.explain || '')
    });
  }
  return steps.length ? steps : null;
}
/* 返回 {called, ok, result, steps, error}；引擎不存在时 called 为 false。 */
function callEngine(method, arg) {
  var eng = engine();
  if (!eng || typeof eng[method] !== 'function') return { called: false };
  var r = null;
  try { r = eng[method](arg); } catch (e) {
    return { called: true, ok: false, error: '计算引擎执行出错' + (e && e.message ? '：' + e.message : '') };
  }
  if (!r || typeof r !== 'object' || typeof r.ok !== 'boolean') {
    return { called: true, ok: false, error: '计算引擎返回了无法识别的结果' };
  }
  if (!r.ok) return { called: true, ok: false, error: trim(r.error || '本题超出计算引擎范围') };
  return { called: true, ok: true, result: r, steps: validSteps(r) };
}
/* 变式题答案：优先 answer，接受 balanced / value / solution.value /
 * solution.mol 同义字段。stoich / conserve 的 result 是对象（如
 * {n, mass, M}），须由调用方按 answerField 指定字段提取，这里不猜。 */
function engineAnswer(r) {
  if (!r) return null;
  var v = r.answer;
  if (v == null || v === '') v = r.balanced;
  if (v == null || v === '') v = r.value;
  if (v == null || v === '') v = (r.solution && r.solution.value != null) ? r.solution.value : null;
  if (v == null || v === '') v = (r.solution && r.solution.mol != null) ? r.solution.mol : null;
  if (v == null || v === '') v = r.result;
  if (v == null || v === '') return null;
  if (typeof v === 'object') return null;
  return v;
}
/* 按模板指定的字段路径（如 'result.n'、'solution.value'）从引擎返回中
 * 提取变式题答案；未指定路径时用 engineAnswer；提不到返回 null。 */
function extractAnswer(r, spec) {
  if (spec && spec.answerField) {
    var parts = String(spec.answerField).split('.');
    var v = r;
    for (var i = 0; i < parts.length; i++) {
      if (v == null || typeof v !== 'object') return null;
      v = v[parts[i]];
    }
    if (v == null || v === '' || typeof v === 'object') return null;
    return v;
  }
  return engineAnswer(r);
}

/* ---------- 考点识别 ---------- */
/* cls 为变式题类别（balance / ph / stoich / conserve）；model 是站内 3D
 * 模型/实验链接；vibe 是分步动画主题 id；mastery 是掌握状态的考点。 */
var TOPICS = [
  { key: 'balance', name: '化学方程式配平', cls: 'balance',
    kws: ['配平'], model: null, vibe: null, mastery: null },
  { key: 'ph', name: 'pH 计算', cls: 'ph',
    kws: ['pH', '酸碱度', '氢离子浓度'], model: { kind: 'exp', id: 'tit' },
    vibe: 'titration', mastery: { kind: 'exp', id: 'tit' } },
  { key: 'stoich', name: '物质的量计算', cls: 'stoich',
    kws: ['物质的量', '摩尔质量', '物质的量浓度', '阿伏伽德罗'], model: { kind: 'exp', id: 'cfgsol' },
    vibe: null, mastery: { kind: 'exp', id: 'cfgsol' } },
  { key: 'conserve', name: '守恒法计算', cls: 'conserve',
    kws: ['守恒', '得失电子'], model: { kind: 'exp', id: 'hydroly' },
    vibe: null, mastery: { kind: 'exp', id: 'hydroly' } },
  { key: 'vsepr', name: 'VSEPR 与空间构型', cls: null,
    kws: ['VSEPR', '空间构型', '分子构型', '键角', '杂化', '电子域'],
    model: { kind: 'mol', id: 'h2o' }, vibe: 'vsepr', mastery: null },
  { key: 'titration', name: '酸碱中和滴定', cls: null,
    kws: ['滴定', '终点', '标准液', '指示剂', '酚酞'], model: { kind: 'exp', id: 'tit' },
    vibe: 'titration', mastery: { kind: 'exp', id: 'tit' } },
  { key: 'hydrolysis', name: '盐类的水解', cls: null,
    kws: ['水解', '水的电离', '电离平衡', '水解平衡'], model: { kind: 'exp', id: 'hydroly' },
    vibe: null, mastery: { kind: 'exp', id: 'hydroly' } },
  { key: 'redox', name: '氧化还原反应', cls: null,
    kws: ['氧化还原', '氧化剂', '还原剂', '化合价'], model: { kind: 'exp', id: 'feprop' },
    vibe: null, mastery: { kind: 'exp', id: 'feprop' } },
  { key: 'cell', name: '原电池与电解池', cls: null,
    kws: ['原电池', '电解池', '电极', '正极', '负极', '阳极', '阴极'],
    model: { kind: 'exp', id: 'cell' }, vibe: null, mastery: { kind: 'exp', id: 'cell' } },
  { key: 'equilibrium', name: '化学平衡', cls: null,
    kws: ['化学平衡', '平衡移动', '平衡常数'], model: null, vibe: null, mastery: null },
  { key: 'thermo', name: '反应热与焓变', cls: null,
    kws: ['反应热', '焓变', '燃烧热', '中和热'], model: { kind: 'exp', id: 'neutheat' },
    vibe: null, mastery: { kind: 'exp', id: 'neutheat' } },
  { key: 'rate', name: '化学反应速率', cls: null,
    kws: ['反应速率'], model: { kind: 'exp', id: 'ratelab' },
    vibe: null, mastery: { kind: 'exp', id: 'ratelab' } },
  { key: 'cloud', name: '电子云与原子轨道', cls: null,
    kws: ['电子云', '原子轨道', '能级', '电子排布', '共价键'], model: { kind: 'mol', id: 'h2' },
    vibe: 'cloud', mastery: null },
  { key: 'solution', name: '溶液的配制', cls: null,
    kws: ['配制溶液', '容量瓶', '定容'], model: { kind: 'exp', id: 'cfgsol' },
    vibe: null, mastery: { kind: 'exp', id: 'cfgsol' } },
  { key: 'equation', name: '化学方程式书写', cls: null,
    kws: ['方程式', '离子方程式'], model: null, vibe: null, mastery: null }
];

function dbItems() {
  var out = [];
  try {
    var db = window.DB || {};
    var map = { sub: 'subs', app: 'app', mol: 'mols', exp: 'exps' };
    for (var k in map) {
      if (!hasOwn(map, k)) continue;
      var arr = db[map[k]];
      if (!isArray(arr)) continue;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].id) out.push({ kind: k, item: arr[i] });
      }
    }
  } catch (e) { /* DB 不可读时只用关键词表 */ }
  return out;
}
function findDbItem(kind, id) {
  var items = dbItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].kind === kind && items[i].item.id === id) return items[i].item;
  }
  return null;
}
/* 题目关键词匹配站内考点数据（名称/标签/化学式），返回最佳匹配。 */
function matchDbItem(q) {
  var items = dbItems();
  var best = null, bestScore = 0;
  var nq = norm(q);
  for (var i = 0; i < items.length; i++) {
    var it = items[i].item, score = 0;
    if (it.name && q.indexOf(it.name) !== -1) score += 3;
    if (it.formula) {
      var f = norm(plain(it.formula));
      if (f.length >= 2 && nq.indexOf(f) !== -1) score += 2;
    }
    if (isArray(it.tags)) {
      for (var j = 0; j < it.tags.length; j++) {
        if (it.tags[j] && it.tags[j].length >= 2 && q.indexOf(it.tags[j]) !== -1) score += 1;
      }
    }
    if (score > bestScore) { bestScore = score; best = { kind: items[i].kind, id: it.id, name: it.name }; }
  }
  return bestScore >= 2 ? best : null;
}

function detectTopic(q) {
  var best = null, bestScore = 0;
  for (var i = 0; i < TOPICS.length; i++) {
    var t = TOPICS[i], score = 0;
    for (var j = 0; j < t.kws.length; j++) {
      if (q.indexOf(t.kws[j]) !== -1) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = t; }
  }
  var db = matchDbItem(q);
  var topic = null;
  if (best) {
    topic = {
      key: best.key, name: best.name, cls: best.cls,
      model: best.model, vibe: best.vibe, mastery: best.mastery
    };
  } else if (db) {
    topic = { key: 'db', name: db.name, cls: null, model: { kind: db.kind, id: db.id }, vibe: null, mastery: null };
  }
  if (topic && db) {
    /* DB 匹配更具体（如题干点名乙酸）时，3D 链接优先用 DB 匹配项。 */
    topic.model = { kind: db.kind, id: db.id };
    topic.dbName = db.name;
  }
  /* 水与二氧化碳的极性对比：沿用 Tutor.local 的同一判断条件。 */
  if (topic && /对比|比较/.test(q) && /水/.test(q) && /二氧化碳|CO2/i.test(q)) {
    topic.compare = { a: 'h2o', b: 'co2' };
  }
  return topic;
}

/* ---------- 引擎调用点识别（题干 -> 引擎方法） ---------- */
/* 从题干抽第一条化学方程式（左右至少一边含 +，避免把 n=cV 当方程式）。 */
function extractEquation(q) {
  var nq = norm(q).replace(/。/g, ' ');
  var token = '[A-Za-z0-9().]+';
  var re = new RegExp('(' + token + '(?:\\s*\\+\\s*' + token + ')+\\s*=\\s*' + token +
    '(?:\\s*\\+\\s*' + token + ')*' + '|' + token + '\\s*=\\s*' + token +
    '(?:\\s*\\+\\s*' + token + ')+)');
  var m = nq.match(re);
  if (!m) return null;
  var eq = m[1].replace(/\s+/g, '');
  /* 排除纯数学式（如 a+b=c 里没有化学元素大写字母开头的情况不做判断，
   * 引擎对无法解析的方程式会返回 ok:false，届时走降级链路）。 */
  return eq;
}
function extractConc(q) {
  var m = norm(q).match(/(\d+(?:\.\d+)?)\s*(?:mol\/L|mol·L)/);
  return m ? parseFloat(m[1]) : null;
}
/* 从题干解析 Ka/Kb（如 Ka=1.8×10^-5、Ka=1.8e-5）；题干未给时返回 null。 */
function parseK(q, name) {
  var nq = norm(q);
  var m = nq.match(new RegExp(name + '\\s*[=:]?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:\\*|x|×)?\\s*10(-?\\d+)'));
  if (m) return parseFloat(m[1]) * Math.pow(10, parseInt(m[2], 10));
  m = nq.match(new RegExp(name + '\\s*[=:]?\\s*(\\d+(?:\\.\\d+)?)[eE](-?\\d+)'));
  if (m) return parseFloat(m[1]) * Math.pow(10, parseInt(m[2], 10));
  m = nq.match(new RegExp(name + '\\s*[=:]?\\s*(\\d+(?:\\.\\d+)?)'));
  return m ? parseFloat(m[1]) : null;
}
/* 教材常用电离常数（25℃，人教版选必1）：醋酸 Ka、一水合氨 Kb 均为 1.8×10⁻⁵。
 * 仅用于题干点名这两种弱电解质又未给出常数的情形；引擎步骤会写明所用 Ka/Kb。 */
var TEXTBOOK_K = { 'CH3COOH': 1.8e-5, 'NH3': 1.8e-5 };
function buildPhSpec(q) {
  var nq = norm(q);
  var c = extractConc(q);
  var kind = null, formula = null, n = null, Ka = null, Kb = null;
  if (/盐酸|HCl/.test(q)) { kind = 'strong-acid'; formula = 'HCl'; }
  else if (/硫酸|H2SO4/.test(q)) { kind = 'strong-acid'; formula = 'H2SO4'; n = 2; }
  else if (/硝酸|HNO3/.test(q)) { kind = 'strong-acid'; formula = 'HNO3'; }
  else if (/氢氧化钠|NaOH/.test(q)) { kind = 'strong-base'; formula = 'NaOH'; }
  else if (/氢氧化钾|KOH/.test(q)) { kind = 'strong-base'; formula = 'KOH'; }
  else if (/氢氧化钡|Ba\(OH\)2/.test(q)) { kind = 'strong-base'; formula = 'Ba(OH)2'; n = 2; }
  else if (/醋酸|乙酸|CH3COOH/.test(q)) { kind = 'weak-acid'; formula = 'CH3COOH'; Ka = parseK(q, 'Ka') || TEXTBOOK_K['CH3COOH']; }
  else if (/氨水|NH3/.test(q)) { kind = 'weak-base'; formula = 'NH3'; Kb = parseK(q, 'Kb') || TEXTBOOK_K['NH3']; }
  /* 稀释：引擎 dilute 模板需要原浓度 c 与倍数 factor（或体积）。 */
  var dm = q.match(/稀释\s*(\d+(?:\.\d+)?)\s*倍/);
  if (dm) {
    if (kind === 'weak-acid' || kind === 'weak-base') return null; /* 弱电解质稀释非线性，不可套用 */
    var factor = parseFloat(dm[1]);
    var cc = c, type = null;
    if (kind === 'strong-acid') type = 'acid';
    else if (kind === 'strong-base') type = 'base';
    if (cc == null) {
      var pm0 = nq.match(/pH\s*[=:]?\s*(\d+(?:\.\d+)?)/);
      if (pm0) {
        var ph0 = parseFloat(pm0[1]);
        /* 只有 pH 没有浓度时由 pH 反推强电解质浓度：酸 c = 10^-pH，碱 c = 10^(pH-14)。 */
        if (ph0 < 7) { cc = Math.pow(10, -ph0); type = 'acid'; }
        else if (ph0 > 7) { cc = Math.pow(10, ph0 - 14); type = 'base'; }
      }
    }
    if (cc != null && type) return { text: q, kind: 'dilute', c: cc, factor: factor, type: type, formula: formula };
    return null;
  }
  if (c == null || !kind) return null; /* 无浓度或无法确定酸碱种类时不猜测，走降级链路 */
  var spec = { text: q, kind: kind, c: c, formula: formula };
  if (n != null) spec.n = n;
  if (Ka != null) spec.Ka = Ka;
  if (Kb != null) spec.Kb = Kb;
  return spec;
}
function buildStoichSpec(q) {
  var nq = norm(q);
  var known = ['H2O', 'NaCl', 'H2SO4', 'CaCO3', 'NaOH', 'CO2', 'O2', 'H2',
    'Fe', 'CuSO4', 'HCl', 'NH3', 'CH4', 'C6H12O6', 'Na2CO3', 'CaO', 'Al', 'Zn', 'Mg', 'KCl'];
  var formula = null;
  for (var i = 0; i < known.length; i++) {
    if (nq.indexOf(known[i]) !== -1) { formula = known[i]; break; }
  }
  var mass = null, volMl = null, conc = extractConc(q), moles = null;
  var mm = nq.match(/(\d+(?:\.\d+)?)\s*(?:g|克)/);
  if (mm) mass = parseFloat(mm[1]);
  var vm = nq.match(/(\d+(?:\.\d+)?)\s*(mL|毫升)/);
  if (vm) volMl = parseFloat(vm[1]);
  else {
    var vl = nq.match(/(\d+(?:\.\d+)?)\s*(?:L|升)/);
    if (vl) volMl = parseFloat(vl[1]) * 1000;
  }
  var nm = nq.match(/(\d+(?:\.\d+)?)\s*mol/);
  if (nm) moles = parseFloat(nm[1]);
  /* 映射到引擎的真实 kind；无法确定时返回 null，走降级链路。 */
  if (mass != null && formula) return { text: q, kind: 'n-mass', mass: mass, formula: formula };
  if (conc != null && volMl != null) {
    /* molarity 的体积单位是 L，mL 须换算。 */
    return { text: q, kind: 'molarity', c: conc, volume: volMl / 1000, formula: formula };
  }
  if (moles != null && /体积/.test(q) && /气体|标准状况/.test(q)) {
    return { text: q, kind: 'n-volume', n: moles };
  }
  if (moles != null && formula && /质量/.test(q)) {
    return { text: q, kind: 'n-mass', n: moles, formula: formula };
  }
  return null;
}
/* 解析电荷守恒题：c(离子)=浓度（已知）与“求 c(离子)”（未知，填 "x"）。
 * 离子按尾部电荷号分阴阳离子；须恰好 1 个未知且阴阳离子各至少 1 种，
 * 否则返回 null（不猜测，走降级链路）。
 * 注意：传给引擎的离子须用 ^ 写法标多电荷（如 SO4^2-）；直接写 SO42-
 * 会被引擎解析器误读为 S + O₄₂（电荷 -1）。 */
function ionForEngine(formula, num, sign) {
  return num !== '' ? formula + '^' + num + sign : formula + sign;
}
function parseChargeSpec(nq) {
  var cations = [], anions = [], seen = {};
  var re = /c\(\s*([A-Za-z0-9]+)\s*(\d*)\s*([+-])\s*\)\s*=\s*(\d+(?:\.\d+)?|x|X)/g;
  var m;
  while ((m = re.exec(nq)) !== null) {
    var ion = ionForEngine(m[1], m[2], m[3]);
    if (seen[ion]) continue;
    seen[ion] = true;
    var entry = { ion: ion, c: (/^[xX]$/.test(m[4]) ? 'x' : parseFloat(m[4])) };
    if (m[3] === '+') cations.push(entry);
    else anions.push(entry);
  }
  var um = nq.match(/求\s*c\(\s*([A-Za-z0-9]+)\s*(\d*)\s*([+-])\s*\)/);
  if (um) {
    var uion = ionForEngine(um[1], um[2], um[3]);
    if (!seen[uion]) {
      seen[uion] = true;
      if (um[3] === '+') cations.push({ ion: uion, c: 'x' });
      else anions.push({ ion: uion, c: 'x' });
    }
  }
  if (!cations.length || !anions.length) return null;
  var unknowns = 0;
  var all = cations.concat(anions);
  for (var i = 0; i < all.length; i++) if (all[i].c === 'x') unknowns++;
  if (unknowns !== 1) return null;
  return { template: 'solution-charge', cations: cations, anions: anions };
}
function buildConserveSpec(q) {
  var nq = norm(q);
  /* 目前只把“溶液电荷守恒”题解析为引擎模板；得失电子、物料守恒等
   * 自由文本解析不可靠，返回 null 走 SOP/助教链路，不猜测。 */
  if (/电荷守恒/.test(q) || /c\(/.test(nq)) {
    var spec = parseChargeSpec(nq);
    if (spec) { spec.text = q; return spec; }
  }
  return null;
}
/* 决定本题是否可交给引擎；opts 可强制指定方法与 spec（变式题用）。 */
function detectEngineCall(q, opts) {
  if (opts && opts.engineMethod) {
    return { method: opts.engineMethod, arg: opts.engineSpec, cls: opts.engineCls || null };
  }
  if (/配平|系数/.test(q)) {
    var eq = extractEquation(q);
    if (eq) return { method: 'balance', arg: eq, cls: 'balance' };
  }
  if (/pH/i.test(q)) {
    var phSpec = buildPhSpec(q);
    if (phSpec) return { method: 'ph', arg: phSpec, cls: 'ph' };
  }
  if (/守恒|得失电子/.test(q)) {
    /* 守恒题只走 conserve；解析不出引擎模板时直接返回 null（不 fallback
     * 到 stoich，避免把守恒题当成普通计量题算错）。 */
    var cspec = buildConserveSpec(q);
    return cspec ? { method: 'conserve', arg: cspec, cls: 'conserve' } : null;
  }
  if (/物质的量|摩尔/.test(q)) {
    var stSpec = buildStoichSpec(q);
    if (stSpec) return { method: 'stoich', arg: stSpec, cls: 'stoich' };
  }
  return null;
}

/* ---------- 第 0 步：审题 ---------- */
function buildReview(q, topic) {
  var sentences = splitSentences(q);
  var known = [];
  for (var i = 0; i < sentences.length; i++) {
    var s = sentences[i];
    if (/\d/.test(s) && (/mol|mL|g\b|克|升|L\b|%|pH|°C|Pa|atm|K\b/.test(s) || /已知/.test(s))) {
      if (known.length < 4) known.push(s);
    }
  }
  var target = '';
  for (var j = sentences.length - 1; j >= 0; j--) {
    if (/求|计算|是多少|判断|写出|说明|解释|确定|选择|比较|证明|设计/.test(sentences[j])) {
      target = sentences[j];
      break;
    }
  }
  return {
    known: known,
    target: target,
    topicName: topic ? topic.name : '未识别到对应考点'
  };
}

/* ---------- 解题计划：引擎 -> SOP -> 助教资料检索 ---------- */
function mapSopSteps(steps) {
  var out = [];
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    var detail = '';
    if (s.input) detail += '输入：' + s.input;
    if (s.action) detail += (detail ? '\n' : '') + s.action;
    if (s.output) detail += (detail ? '\n' : '') + '输出：' + s.output;
    var why = '';
    if (s.attention) why += '注意：' + s.attention;
    if (s.criteria) why += (why ? '\n' : '') + '完成标准：' + s.criteria;
    out.push({ title: s.title || ('第' + (i + 1) + '步'), detail: detail, why: why, sop: true });
  }
  return out;
}
/* 助教回答按句子分组为参考要点（只做重组，不新增事实）。 */
function tutorSteps(answer) {
  var sentences = splitSentences(answer);
  var out = [];
  for (var i = 0; i < sentences.length && out.length < 3; i += 2) {
    var chunk = sentences.slice(i, i + 2).join('');
    out.push({
      title: '参考要点' + ['（一）', '（二）', '（三）'][out.length],
      detail: chunk, why: ''
    });
  }
  if (!out.length) out.push({ title: '资料检索参考', detail: answer, why: '' });
  return out;
}

var CONFIDENCE_LABEL = {
  engine: '引擎精确计算',
  sop: '规则模板解析',
  tutor: '资料检索参考，结论请核对教材',
  none: '未找到可靠解析'
};

function buildPlan(question, opts) {
  opts = opts || {};
  var topic = detectTopic(question);
  var plan = {
    question: question, topic: topic, review: buildReview(question, topic),
    confidence: 'none', engineNote: '', steps: [], refs: [], actions: [],
    tutorAnswer: '', engineCls: null
  };
  /* 1. 计算引擎（A 组）。 */
  var call = detectEngineCall(question, opts);
  if (call) {
    var r = callEngine(call.method, call.arg);
    if (r.called && r.ok && r.steps) {
      plan.confidence = 'engine';
      plan.steps = r.steps;
      plan.engineCls = call.cls;
      /* 配平的最终结果（balanced）不在引擎步骤文本里，附到最后一步末尾
       * （引擎自身返回的字段，只做呈现，不编造）。 */
      if (r.result && r.result.balanced) {
        var lastStep = plan.steps[plan.steps.length - 1];
        lastStep.detail += (lastStep.detail ? '\n' : '') + '配平结果：' + r.result.balanced;
      }
      return plan;
    }
    if (r.called && !r.ok) {
      plan.engineNote = '本题超出计算引擎范围（' + r.error + '），已改用规则模板解析。';
    } else if (!r.called) {
      plan.engineNote = '计算引擎未加载，已改用规则模板解析。';
    }
  } else if (!engine()) {
    plan.engineNote = '计算引擎未加载，已改用规则模板解析。';
  }
  /* 2. 规则 SOP：ChemQuestionSop（VSEPR / 水电离专项）。 */
  try {
    var QS = window.ChemQuestionSop;
    if (QS && typeof QS.analyze === 'function') {
      var a = QS.analyze(question);
      if (a && a.plan && isArray(a.plan.steps) && a.plan.steps.length) {
        plan.confidence = 'sop';
        plan.steps = mapSopSteps(a.plan.steps);
        if (!topic && a.reading && a.reading.topic) {
          plan.review.topicName = a.reading.topic;
        }
        return plan;
      }
    }
  } catch (e) { /* SOP 异常不中断，继续下一链路 */ }
  /* 3. 规则 SOP：ChemPreparedSop 题型库（需高置信匹配才采用）。 */
  try {
    var PS = window.ChemPreparedSop;
    if (PS && typeof PS.splitQuestion === 'function' && typeof PS.rank === 'function') {
      var parts = PS.splitQuestion(question);
      var part = parts && parts[0];
      if (part) {
        var ranks = PS.rank(part);
        var id = PS.confidentMatch(ranks);
        var entry = (id && PS.byId && typeof PS.byId.get === 'function') ? PS.byId.get(id) : null;
        if (entry && typeof PS.makePlan === 'function') {
          var p2 = PS.makePlan(entry);
          if (p2 && isArray(p2.steps) && p2.steps.length) {
            plan.confidence = 'sop';
            plan.steps = mapSopSteps(p2.steps);
            if (!topic && entry.topic) plan.review.topicName = entry.topic;
            return plan;
          }
        }
      }
    }
  } catch (e) { /* 同上 */ }
  /* 4. 助教资料检索（离线 FAQ + 站内资料；无可靠答案时不包装）。 */
  try {
    var T = window.ChemTutor;
    if (T && typeof T.local === 'function') {
      var ctx = {};
      try { ctx = (typeof T.current === 'function') ? T.current() : {}; } catch (e2) { ctx = {}; }
      var res = T.local(question, ctx);
      if (res && res.answer) {
        if (res.answer.indexOf('暂时没有找到可靠答案') === -1) {
          plan.confidence = 'tutor';
          plan.tutorAnswer = res.answer;
          plan.refs = res.refs || [];
          plan.actions = res.actions || [];
          plan.steps = tutorSteps(res.answer);
          return plan;
        }
        plan.tutorAnswer = res.answer;
      }
    }
  } catch (e) { /* 同上 */ }
  plan.confidence = 'none';
  return plan;
}

/* ---------- “没懂”提示：步骤拆分 + 苏格拉底式引导问题 ---------- */
/* 通用引导句式（不含事实断言；与 workbench-socratic.js 的引导风格一致）。 */
var GUIDE_QS = [
  '这一步用到了题干里的哪个已知条件？先把它指出来，再想它和要求的结果有什么关系。',
  '如果把这一步的结果遮住，你能说出上一步留下了什么、下一步还需要什么吗？',
  '这一步的单位有没有统一？先检查单位，再检查数值。',
  '换一个角度想：如果这一步不这样做，还能从哪个已知条件出发？',
  '把这一步拆成两句小话：先算什么，再得到什么？试着自己说一遍。'
];
function guideQuestion(i, detail, question) {
  /* 优先复用苏格拉底模块的引导问题（format 首段即引导问题），
   * 不可用时用内置通用句式。 */
  try {
    var CS = window.ChemSocratic;
    if (CS && typeof CS.format === 'function' && detail) {
      var f = CS.format(detail, question || '', 'solve');
      var first = String(f || '').split('\n\n')[0];
      if (first && first.length > 4) return first;
    }
  } catch (e) { /* 忽略 */ }
  return GUIDE_QS[i % GUIDE_QS.length];
}
/* 把一步拆得更细：句子拆分或 SOP 字段展开，只重组已有内容。 */
function splitStep(step) {
  var subs = [];
  if (step.sop) {
    var fields = splitSentences(step.detail || '');
    for (var i = 0; i < fields.length; i++) subs.push(fields[i]);
  } else {
    var ss = splitSentences(step.detail || '');
    for (var j = 0; j < ss.length; j++) subs.push(ss[j]);
  }
  return subs;
}

/* ---------- 变式训练：模板 + 引擎算答案 ---------- */
/* 每类至少 2 个模板；变式题答案必须由引擎算出，引擎算不出的不生成。
 * make(pick) 返回 {question, method, arg, checkKind, mastery}；
 * mastery 指向 DB 中确有 quiz 数组的实验考点（见 workbench-nav.js 规则），
 * 无对应考点时为 null（不更新掌握状态）。 */
var VARIANT_TEMPLATES = {
  balance: [
    { id: 'bal-metal', name: '金属与氧气反应',
      make: function (pick) {
        var metals = [
          { eq: 'Fe + O2 = Fe2O3', mastery: { kind: 'exp', id: 'feprop' } },
          { eq: 'Mg + O2 = MgO', mastery: null },
          { eq: 'Al + O2 = Al2O3', mastery: null },
          { eq: 'Cu + O2 = CuO', mastery: null },
          { eq: 'Zn + O2 = ZnO', mastery: null },
          { eq: 'Na + O2 = Na2O', mastery: { kind: 'exp', id: 'na' } },
          { eq: 'Ca + O2 = CaO', mastery: null }
        ];
        var m = pick(metals);
        return { question: '配平下列化学方程式：' + m.eq.replace(/=/g, '→'),
          method: 'balance', arg: m.eq, checkKind: 'equation', mastery: m.mastery };
      } },
    { id: 'bal-neutral', name: '酸碱中和',
      make: function (pick) {
        var list = [
          'H2SO4 + NaOH = Na2SO4 + H2O',
          'HCl + Ca(OH)2 = CaCl2 + H2O',
          'H2SO4 + Al(OH)3 = Al2(SO4)3 + H2O',
          'HNO3 + Ca(OH)2 = Ca(NO3)2 + H2O',
          'H3PO4 + NaOH = Na3PO4 + H2O'
        ];
        var eq = pick(list);
        return { question: '配平下列化学方程式：' + eq.replace(/=/g, '→'),
          method: 'balance', arg: eq, checkKind: 'equation',
          mastery: { kind: 'exp', id: 'tit' } };
      } },
    { id: 'bal-burn', name: '烃的燃烧',
      make: function (pick) {
        var list = [
          'CH4 + O2 = CO2 + H2O', 'C2H6 + O2 = CO2 + H2O',
          'C3H8 + O2 = CO2 + H2O', 'C2H4 + O2 = CO2 + H2O'
        ];
        var eq = pick(list);
        return { question: '配平下列化学方程式：' + eq.replace(/=/g, '→'),
          method: 'balance', arg: eq, checkKind: 'equation', mastery: null };
      } }
  ],
  ph: [
    { id: 'ph-acid', name: '强酸溶液的 pH',
      make: function (pick) {
        var acids = [{ n: '盐酸（HCl）', f: 'HCl' }, { n: '硝酸（HNO3）', f: 'HNO3' }];
        var cs = [0.1, 0.01, 0.001, 0.05, 0.02, 0.005];
        var a = pick(acids), c = pick(cs);
        var q = '25℃时，' + fmtNum(c) + ' mol/L ' + a.n + '溶液的 pH 是多少？（只写数值）';
        return { question: q, method: 'ph',
          arg: { text: q, c: c, kind: 'strong-acid', formula: a.f },
          checkKind: 'number', mastery: { kind: 'exp', id: 'tit' } };
      } },
    { id: 'ph-base', name: '强碱溶液的 pH',
      make: function (pick) {
        var bases = [{ n: '氢氧化钠（NaOH）', f: 'NaOH' }, { n: '氢氧化钾（KOH）', f: 'KOH' }];
        var cs = [0.1, 0.01, 0.001, 0.05, 0.02, 0.005];
        var b = pick(bases), c = pick(cs);
        var q = '25℃时，' + fmtNum(c) + ' mol/L ' + b.n + '溶液的 pH 是多少？（只写数值）';
        return { question: q, method: 'ph',
          arg: { text: q, c: c, kind: 'strong-base', formula: b.f },
          checkKind: 'number', mastery: { kind: 'exp', id: 'tit' } };
      } },
    { id: 'ph-dilute', name: '稀释后的 pH',
      make: function (pick) {
        var c = pick([0.1, 0.01, 0.001]), factor = pick([10, 100]);
        var q = '25℃时，将 ' + fmtNum(c) + ' mol/L 盐酸加水稀释 ' + factor + ' 倍，稀释后溶液的 pH 是多少？（只写数值）';
        return { question: q, method: 'ph',
          arg: { text: q, kind: 'dilute', c: c, factor: factor, type: 'acid', formula: 'HCl' },
          checkKind: 'number', mastery: { kind: 'exp', id: 'tit' } };
      } }
  ],
  stoich: [
    { id: 'st-mass', name: '质量换算物质的量',
      make: function (pick) {
        var subs = [
          { n: '水（H2O）', f: 'H2O' }, { n: '氯化钠（NaCl）', f: 'NaCl' },
          { n: '硫酸（H2SO4）', f: 'H2SO4' }, { n: '碳酸钙（CaCO3）', f: 'CaCO3' },
          { n: '氢氧化钠（NaOH）', f: 'NaOH' }, { n: '二氧化碳（CO2）', f: 'CO2' },
          { n: '硫酸铜（CuSO4）', f: 'CuSO4' }
        ];
        var s = pick(subs), m = pick([5, 9, 18, 20, 36, 49, 50, 80, 100]);
        var q = fmtNum(m) + ' g ' + s.n + '的物质的量是多少 mol？（只写数值）';
        return { question: q, method: 'stoich',
          arg: { text: q, kind: 'n-mass', mass: m, formula: s.f },
          answerField: 'result.n',
          checkKind: 'number', mastery: { kind: 'exp', id: 'cfgsol' } };
      } },
    { id: 'st-conc', name: '浓度与体积换算物质的量',
      make: function (pick) {
        var c = pick([0.1, 0.2, 0.5, 1]), v = pick([100, 200, 250, 500]);
        var q = fmtNum(c) + ' mol/L 的 NaCl 溶液 ' + v + ' mL 中，NaCl 的物质的量是多少 mol？（只写数值）';
        return { question: q, method: 'stoich',
          arg: { text: q, kind: 'molarity', c: c, volume: v / 1000, formula: 'NaCl' },
          answerField: 'result.n',
          checkKind: 'number', mastery: { kind: 'exp', id: 'cfgsol' } };
      } },
    { id: 'st-gas', name: '气体摩尔体积',
      make: function (pick) {
        var gases = [{ n: '氢气（H2）', f: 'H2' }, { n: '氧气（O2）', f: 'O2' },
          { n: '二氧化碳（CO2）', f: 'CO2' }, { n: '氮气（N2）', f: 'N2' }];
        var g = pick(gases), n = pick([0.5, 1, 2, 0.25]);
        var q = '标准状况下，' + fmtNum(n) + ' mol ' + g.n + '的体积是多少 L？（只写数值）';
        return { question: q, method: 'stoich',
          arg: { text: q, kind: 'n-volume', n: n },
          answerField: 'result.volume',
          checkKind: 'number', mastery: null };
      } }
  ],
  conserve: [
    { id: 'cv-charge', name: '电荷守恒求离子浓度',
      make: function (pick) {
        var a = pick([0.1, 0.2]), b = pick([0.05, 0.08]);
        var q = '某溶液中 c(Na+)=' + fmtNum(a) + ' mol/L，c(Cl-)=' + fmtNum(b) +
          ' mol/L，c(H+)=0.01 mol/L，求 c(OH-) 是多少 mol/L？（只写数值）';
        return { question: q, method: 'conserve',
          arg: { text: q, template: 'solution-charge',
            cations: [{ ion: 'Na+', c: a }, { ion: 'H+', c: 0.01 }],
            anions: [{ ion: 'Cl-', c: b }, { ion: 'OH-', c: 'x' }] },
          answerField: 'solution.value',
          checkKind: 'number', mastery: { kind: 'exp', id: 'hydroly' } };
      } },
    { id: 'cv-electron', name: '得失电子守恒',
      make: function (pick) {
        var metals = [{ n: '铁（Fe）', f: 'Fe' }, { n: '锌（Zn）', f: 'Zn' }, { n: '镁（Mg）', f: 'Mg' }];
        var m = pick(metals), n = pick([0.5, 1, 1.5, 2]);
        var q = fmtNum(n) + ' mol ' + m.n + '与足量硫酸铜溶液完全反应，析出铜多少 mol？（只写数值）';
        return { question: q, method: 'conserve',
          arg: { text: q, template: 'redox-electron',
            oxidants: [{ formula: 'CuSO4', electrons: 2, mol: 'x' }],
            reductants: [{ formula: m.f, electrons: 2, mol: n }] },
          answerField: 'solution.mol',
          checkKind: 'number', mastery: { kind: 'exp', id: 'cell' } };
      } },
    { id: 'cv-mass', name: '质量守恒与化学计量',
      make: function (pick) {
        var m = pick([10, 20, 50, 100]);
        var q = fmtNum(m) + ' g 碳酸钙（CaCO3）完全分解，生成二氧化碳（CO2）的质量是多少 g？（只写数值）';
        return { question: q, method: 'stoich',
          arg: { text: q, kind: 'reaction', equation: 'CaCO3 = CaO + CO2',
            given: [{ formula: 'CaCO3', mass: m }], target: 'CO2' },
          answerField: 'result.targetMass',
          checkKind: 'number', mastery: null };
      } }
  ]
};

function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
/* 生成 count 道变式题；答案一律来自引擎，引擎算不出的模板直接跳过。 */
function generateVariants(topicKey, count) {
  count = count || 3;
  var classes = [];
  if (topicKey && VARIANT_TEMPLATES[topicKey]) classes = [topicKey];
  else classes = ['balance', 'ph']; /* 未识别考点时给基础练习 */
  var templates = [];
  for (var ci = 0; ci < classes.length; ci++) {
    var list = VARIANT_TEMPLATES[classes[ci]];
    for (var ti = 0; ti < list.length; ti++) {
      templates.push({ cls: classes[ci], tpl: list[ti] });
    }
  }
  /* 洗牌后逐个尝试；模板用完仍不足时再轮一遍（参数随机，不会重复出题）。 */
  var order = [];
  for (var i = 0; i < templates.length; i++) order.push(i);
  for (var s = order.length - 1; s > 0; s--) {
    var j = Math.floor(Math.random() * (s + 1));
    var tmp = order[s]; order[s] = order[j]; order[j] = tmp;
  }
  var out = [], seenQ = {}, attempts = 0;
  while (out.length < count && attempts < 12) {
    attempts++;
    var entry = templates[order[(attempts - 1) % order.length]];
    var spec;
    try { spec = entry.tpl.make(pickOne); } catch (e) { continue; }
    if (!spec || !spec.question || seenQ[spec.question]) continue;
    var r = callEngine(spec.method, spec.arg);
    if (!r.called || !r.ok) continue;
    var ans = extractAnswer(r.result, spec);
    if (ans == null || ans === '') continue;
    seenQ[spec.question] = true;
    out.push({
      id: 'v' + Date.now() + '_' + out.length + '_' + Math.floor(Math.random() * 10000),
      cls: entry.cls, tpl: entry.tpl.id, tplName: entry.tpl.name,
      question: spec.question, answer: ans, answerText: String(ans),
      method: spec.method, arg: spec.arg, answerField: spec.answerField || '',
      checkKind: spec.checkKind || 'number',
      mastery: spec.mastery || null
    });
  }
  return out;
}

/* ---------- 变式题答案核对（确定性比较） ---------- */
function parseUserNumber(s) {
  var t = normFlat(trim(s)).replace(/,/g, '');
  var m = t.match(/(-?\d+(?:\.\d+)?)\s*(?:\*|x)?\s*10\^?(-?\d+)/);
  if (m) return parseFloat(m[1]) * Math.pow(10, parseInt(m[2], 10));
  m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}
function normEquation(s) {
  var t = normFlat(s);
  t = t.replace(/(^|\+)1(?=[A-Z(])/g, '$1');
  return t;
}
function checkVariantAnswer(variant, input) {
  if (!variant) return { ok: false, message: '变式题数据缺失，请重新生成。' };
  if (variant.checkKind === 'equation') {
    var want = normEquation(String(variant.answer));
    var got = normEquation(input);
    if (!got) return { ok: false, message: '请先写出配平后的方程式。' };
    return { ok: true, correct: got === want, expected: String(variant.answer) };
  }
  var ans = parseUserNumber(String(variant.answer));
  var gotNum = parseUserNumber(input);
  if (isNaN(gotNum)) return { ok: false, message: '请先写一个数值答案。' };
  if (isNaN(ans)) return { ok: false, message: '该变式题答案不是数值，无法自动核对，请点“分步解答”对照。' };
  var tol = Math.max(1e-9, Math.abs(ans) * 0.02);
  return { ok: true, correct: Math.abs(gotNum - ans) <= tol, expected: String(variant.answer) };
}

/* ---------- 掌握状态（复用 workbench-nav.js 的键与规则） ---------- */
/* 键：chem3d_quiz_<id> = {score, total, ts}（原站课后练习最好成绩）。
 * 规则：>= ceil(total*0.75) 已掌握；>= 50% 学习中；否则薄弱；只对 DB 中
 * 确有 quiz 数组的考点显示。变式题按 1 道题计分，与已有成绩保留更好者；
 * 平局保留原有课后练习记录。写完后派发 chem:context，导航即时重算状态点。
 * 注意：导航图例文案固定写“课后练习最佳”，变式题写入后该文案不变，
 * 这是复用同一键的已知代价（见汇报）。 */
var QUIZ_PREFIX = 'chem3d_quiz_';
function hasQuizItem(kind, id) {
  try {
    var item = findDbItem(kind, id);
    if (!item) return false;
    return !!(item.quiz && item.quiz.length);
  } catch (e) { return false; }
}
function readQuizRecord(id) {
  try {
    var raw = window.localStorage.getItem(QUIZ_PREFIX + id);
    if (raw == null) return null;
    var v = JSON.parse(raw);
    if (!v || typeof v.score !== 'number' || typeof v.total !== 'number' || v.total <= 0) return null;
    return v;
  } catch (e) { return null; }
}
function masteryState(v) {
  if (v.score >= Math.ceil(v.total * 0.75)) return 'done';
  if (v.score / v.total >= 0.5) return 'doing';
  return 'weak';
}
var MASTERY_LABEL = { done: '已掌握', doing: '学习中', weak: '薄弱' };
function recordMastery(kind, id, correct) {
  if (!kind || !id) return { updated: false, reason: '未关联到站内考点' };
  if (!hasQuizItem(kind, id)) return { updated: false, reason: '该考点在站内没有课后练习，导航不显示掌握状态' };
  var prev = readQuizRecord(id);
  var cand = { score: correct ? 1 : 0, total: 1, ts: Date.now() };
  var next = cand, changed = true;
  if (prev) {
    if (prev.score / prev.total >= cand.score / cand.total) { next = prev; changed = false; }
  }
  if (changed) {
    try { window.localStorage.setItem(QUIZ_PREFIX + id, JSON.stringify(next)); }
    catch (e) { return { updated: false, reason: '浏览器存储不可用' }; }
  }
  emitContext();
  return { updated: changed, state: masteryState(next), label: MASTERY_LABEL[masteryState(next)], record: next };
}

/* ================= 错因诊断（帮我找错） ================= */
/* 全部为确定性规则：查表、单位模式、数值比较、引擎校验。无法确定的
 * 一律不下结论（跳过并注明），绝不凭关键词猜测冒充诊断。 */

/* 常见弱电解质 16 种 + 难溶物 16 种 + 气体 6 种 = 38 种。 */
var WEAK_ELECTROLYTES = [
  { f: 'CH3COOH', name: '醋酸' }, { f: 'H2CO3', name: '碳酸' },
  { f: 'H2S', name: '氢硫酸' }, { f: 'H2SO3', name: '亚硫酸' },
  { f: 'HClO', name: '次氯酸' }, { f: 'HF', name: '氢氟酸' },
  { f: 'HCN', name: '氢氰酸' }, { f: 'H3PO4', name: '磷酸' },
  { f: 'HNO2', name: '亚硝酸' }, { f: 'H2C2O4', name: '草酸' },
  { f: 'H2SiO3', name: '硅酸' }, { f: 'HCOOH', name: '甲酸' },
  { f: 'C6H5OH', name: '苯酚' }, { f: 'H3BO3', name: '硼酸' },
  { f: 'NH3·H2O', name: '一水合氨' }, { f: 'H2O', name: '水' }
];
var INSOLUBLE_LIST = [
  { f: 'BaSO4', name: '硫酸钡' }, { f: 'AgCl', name: '氯化银' },
  { f: 'AgBr', name: '溴化银' }, { f: 'AgI', name: '碘化银' },
  { f: 'CaCO3', name: '碳酸钙' }, { f: 'BaCO3', name: '碳酸钡' },
  { f: 'Mg(OH)2', name: '氢氧化镁' }, { f: 'Al(OH)3', name: '氢氧化铝' },
  { f: 'Fe(OH)3', name: '氢氧化铁' }, { f: 'Fe(OH)2', name: '氢氧化亚铁' },
  { f: 'Cu(OH)2', name: '氢氧化铜' }, { f: 'CaF2', name: '氟化钙' },
  { f: 'PbSO4', name: '硫酸铅' }, { f: 'MgCO3', name: '碳酸镁' },
  { f: 'Zn(OH)2', name: '氢氧化锌' }, { f: 'CuS', name: '硫化铜' }
];
var GAS_LIST = [
  { f: 'CO2', name: '二氧化碳' }, { f: 'SO2', name: '二氧化硫' },
  { f: 'NH3', name: '氨气' }, { f: 'H2S', name: '硫化氢' },
  { f: 'Cl2', name: '氯气' }, { f: 'NO2', name: '二氧化氮' }
];
/* 弱酸根 -> 对应弱酸（仅用于“H+、弱酸根、OH- 同时在左”的拆错判定；
 * 弱酸盐 + 强酸的正确写法左端没有 OH-，不会误判）。 */
var WEAK_ANIONS = [
  { pat: 'CH3COO-', acid: 'CH3COOH（醋酸）' },
  { pat: 'HS-', acid: 'H2S（氢硫酸）' },
  { pat: 'ClO-', acid: 'HClO（次氯酸）' },
  { pat: 'F-', acid: 'HF（氢氟酸）' },
  { pat: 'CN-', acid: 'HCN（氢氰酸）' },
  { pat: 'S2-', acid: 'H2S（氢硫酸）' }
];
/* 难溶物离子对（左端同时出现离子对、右端没有对应难溶物时判定为拆错；
 * 沉淀生成反应右端必有难溶物，不会误判）。 */
var INSOLUBLE_PAIRS = [
  { cat: 'Ba2+', an: 'SO42-', salt: 'BaSO4', name: '硫酸钡' },
  { cat: 'Ag+', an: 'Cl-', salt: 'AgCl', name: '氯化银' },
  { cat: 'Ag+', an: 'Br-', salt: 'AgBr', name: '溴化银' },
  { cat: 'Ag+', an: 'I-', salt: 'AgI', name: '碘化银' },
  { cat: 'Ca2+', an: 'CO32-', salt: 'CaCO3', name: '碳酸钙' },
  { cat: 'Ba2+', an: 'CO32-', salt: 'BaCO3', name: '碳酸钡' },
  { cat: 'Mg2+', an: 'OH-', salt: 'Mg(OH)2', name: '氢氧化镁' },
  { cat: 'Al3+', an: 'OH-', salt: 'Al(OH)3', name: '氢氧化铝' },
  { cat: 'Fe3+', an: 'OH-', salt: 'Fe(OH)3', name: '氢氧化铁' },
  { cat: 'Fe2+', an: 'OH-', salt: 'Fe(OH)2', name: '氢氧化亚铁' },
  { cat: 'Cu2+', an: 'OH-', salt: 'Cu(OH)2', name: '氢氧化铜' },
  { cat: 'Ca2+', an: 'F-', salt: 'CaF2', name: '氟化钙' },
  { cat: 'Pb2+', an: 'SO42-', salt: 'PbSO4', name: '硫酸铅' },
  { cat: 'Mg2+', an: 'CO32-', salt: 'MgCO3', name: '碳酸镁' },
  { cat: 'Zn2+', an: 'OH-', salt: 'Zn(OH)2', name: '氢氧化锌' },
  { cat: 'Cu2+', an: 'S2-', salt: 'CuS', name: '硫化铜' }
];
/* 旁观离子判定用同一张常见离子表：净离子方程式中，任何离子都不应
 * 在两边同时出现（出现即未约去）；表内离子在高中常见离子方程式中
 * 没有合法的两边同现情形。 */
/* 电荷守恒核对：常见离子电荷表。 */
var KNOWN_IONS = [
  ['NH4+', 1], ['H+', 1], ['Na+', 1], ['K+', 1], ['Ag+', 1],
  ['Ca2+', 2], ['Mg2+', 2], ['Ba2+', 2], ['Zn2+', 2], ['Cu2+', 2], ['Fe2+', 2],
  ['Fe3+', 3], ['Al3+', 3],
  ['OH-', -1], ['Cl-', -1], ['NO3-', -1], ['F-', -1], ['Br-', -1], ['I-', -1],
  ['HCO3-', -1], ['HSO4-', -1], ['CH3COO-', -1], ['ClO-', -1], ['HS-', -1],
  ['SO42-', -2], ['CO32-', -2], ['S2-', -2], ['SO32-', -2], ['HPO42-', -2],
  ['PO43-', -3]
];
/* 需标注反应条件的反应 15 条（按反应物/生成物化学式token匹配）。 */
var CONDITION_TABLE = [
  { react: ['N2', 'H2'], prod: ['NH3'], cond: '高温、高压、催化剂', name: '合成氨' },
  { react: ['KClO3'], prod: ['KCl', 'O2'], cond: 'MnO2 作催化剂并加热', name: '氯酸钾制氧气' },
  { react: ['CaCO3'], prod: ['CaO', 'CO2'], cond: '高温', name: '碳酸钙分解' },
  { react: ['C', 'O2'], prod: ['CO2'], cond: '点燃', name: '碳的燃烧' },
  { react: ['H2', 'O2'], prod: ['H2O'], cond: '点燃', name: '氢气的燃烧' },
  { react: ['CH4', 'O2'], prod: ['CO2', 'H2O'], cond: '点燃', name: '甲烷的燃烧' },
  { react: ['S', 'O2'], prod: ['SO2'], cond: '点燃', name: '硫的燃烧' },
  { react: ['Fe', 'O2'], prod: ['Fe3O4'], cond: '点燃', name: '铁丝在氧气中燃烧' },
  { react: ['H2O2'], prod: ['H2O', 'O2'], cond: 'MnO2 作催化剂', name: '过氧化氢分解' },
  { react: ['H2O'], prod: ['H2', 'O2'], cond: '通电', name: '水的电解' },
  { react: ['CO2', 'C'], prod: ['CO'], cond: '高温', name: '二氧化碳与碳反应' },
  { react: ['Fe2O3', 'CO'], prod: ['Fe', 'CO2'], cond: '高温', name: '一氧化碳还原氧化铁' },
  { react: ['NH3', 'O2'], prod: ['NO', 'H2O'], cond: '催化剂并加热', name: '氨的催化氧化' },
  { react: ['SO2', 'O2'], prod: ['SO3'], cond: '催化剂并加热', name: '二氧化硫催化氧化' },
  { react: ['C2H5OH'], prod: ['C2H4', 'H2O'], cond: '浓硫酸、170℃', name: '乙醇消去反应' }
];
var CONDITION_MARKS = ['△', '高温', '催化剂', '点燃', '通电', '加热', '光照',
  'MnO2', '浓硫酸', '高压', '170', '灼热', '引燃'];

/* 把一行拆成化学式 token（去系数），供反应条件匹配用。 */
function formulaTokens(line) {
  var parts = norm(line).split(/[^A-Za-z0-9()]+/);
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var t = parts[i].replace(/^\d+/, '');
    if (/^[A-Z][A-Za-z0-9()]*$/.test(t)) out.push(t);
  }
  return out;
}
function hasAllTokens(tokens, list) {
  for (var i = 0; i < list.length; i++) {
    if (tokens.indexOf(list[i]) === -1) return false;
  }
  return true;
}
function hasAnyToken(tokens, list) {
  for (var i = 0; i < list.length; i++) {
    if (tokens.indexOf(list[i]) !== -1) return true;
  }
  return false;
}
/* 判断一行是否为离子方程式（化学式后紧跟电荷号，如 Na+、SO42-）。 */
function looksIonic(line) {
  var n = norm(line);
  return /[A-Za-z0-9]\s*[+-](?=\s*(?:\+|=|$|\)|）))/.test(n) || /离子方程式/.test(line);
}
/* 把等式按第一个 = 切成左右两端（归一化去空格）。 */
function splitSides(line) {
  var n = normFlat(line);
  var idx = n.indexOf('=');
  if (idx === -1) return null;
  return { left: n.slice(0, idx), right: n.slice(idx + 1) };
}
/* 一侧的电荷总和（只数表内离子；无表内离子返回 null 表示无法核对）。 */
function sideCharge(side) {
  var s = side.replace(/c\(/g, '').replace(/\)/g, '');
  var total = 0, found = false;
  for (var i = 0; i < KNOWN_IONS.length; i++) {
    var ion = KNOWN_IONS[i][0], charge = KNOWN_IONS[i][1];
    var re = new RegExp('(\\d*)' + escapeRegExp(ion), 'g');
    var m;
    while ((m = re.exec(s)) !== null) {
      found = true;
      total += (m[1] ? parseInt(m[1], 10) : 1) * charge;
    }
  }
  return found ? total : null;
}
function sigFigs(numStr) {
  var t = trim(numStr).replace(/^[+-]/, '');
  var m = t.match(/^(\d+(?:\.\d+)?)\s*(?:[×x*]10|e|E)/);
  if (m) t = m[1];
  t = t.replace('.', '').replace(/^0+/, '');
  return t.length || 1;
}
function decimalsOf(numStr) {
  var m = trim(numStr).match(/\.(\d+)/);
  return m ? m[1].length : 0;
}
/* 从原题提取：题给数据的最少有效数字位数、保留位数要求。 */
function questionSigInfo(q) {
  var info = { minSig: null, keepDecimals: null, keepSig: null };
  var nq = norm(q);
  var re = /(\d+(?:\.\d+)?)\s*(?:mol\/L|mol|g|mL|L|%|mg|kg)/g;
  var m;
  while ((m = re.exec(nq)) !== null) {
    var sf = sigFigs(m[1]);
    if (info.minSig == null || sf < info.minSig) info.minSig = sf;
  }
  var d = q.match(/保留\s*(\d+)\s*位小数/);
  if (d) info.keepDecimals = parseInt(d[1], 10);
  var s = q.match(/保留\s*(\d+)\s*位有效数字/);
  if (s) info.keepSig = parseInt(s[1], 10);
  return info;
}

function addFinding(findings, line, type, title, what, why, fix) {
  for (var i = 0; i < findings.length; i++) {
    if (findings[i].line === line && findings[i].type === type && findings[i].title === title) return;
  }
  findings.push({ line: line, type: type, title: title, what: what, why: why, fix: fix });
}

/* 规则 1：方程式未配平（引擎校验；引擎不存在时跳过）。
 * 注意：balance 的职责是把未配平的方程式配平，因此 ok:true 本身不代表
 * 学生写得已经配平——必须把引擎返回的配平结果与学生原文逐项比较，
 * 不同才判定为未配平；ok:false 表示引擎无法配平该式，也记为问题。 */
function checkBalance(line, lineNo, findings, eng) {
  if (!eng || looksIonic(line)) return;
  var nq = norm(line).replace(/。/g, ' ');
  var token = '[A-Za-z0-9().]+';
  var re = new RegExp('(' + token + '(?:\\s*\\+\\s*' + token + ')+\\s*=\\s*' + token +
    '(?:\\s*\\+\\s*' + token + ')*' + '|' + token + '\\s*=\\s*' + token +
    '(?:\\s*\\+\\s*' + token + ')+)', 'g');
  var m, count = 0;
  while ((m = re.exec(nq)) !== null && count < 3) {
    count++;
    var eq = m[1].replace(/\s+/g, '');
    var r = callEngine('balance', eq);
    if (r.called && !r.ok) {
      addFinding(findings, lineNo, 'balance', '方程式无法配平',
        '第 ' + lineNo + ' 行的方程式 ' + eq + ' 无法配平。',
        r.error || '引擎无法处理该方程式，请检查化学式是否写对。',
        '请先核对各物质的化学式是否正确，再重新配平。');
      continue;
    }
    if (r.called && r.ok) {
      var balanced = engineAnswer(r.result);
      /* 引擎未返回配平结果时无法比较，不下结论。 */
      if (balanced == null || balanced === '') continue;
      if (normEquation(String(balanced)) !== normEquation(eq)) {
        addFinding(findings, lineNo, 'balance', '方程式未配平',
          '第 ' + lineNo + ' 行的方程式 ' + eq + ' 未配平。',
          '方程式两边各元素的原子个数不相等。',
          '配平后应为 ' + String(balanced) + '（引擎计算结果）。');
      }
    }
  }
}
/* 规则 2：离子方程式拆错（弱电解质 / 沉淀 / 气体被拆成离子）。 */
function checkIonic(line, lineNo, findings) {
  var sides = splitSides(line);
  if (!sides || !looksIonic(line)) return;
  var left = sides.left, right = sides.right;
  var hasH = left.indexOf('H+') !== -1;
  var hasOH = left.indexOf('OH-') !== -1;
  /* I1：左端同时出现 H+ 与 OH-（两者会反应，常见原因是把弱电解质拆了）。 */
  if (hasH && hasOH) {
    var acid = null;
    for (var i = 0; i < WEAK_ANIONS.length; i++) {
      if (left.indexOf(WEAK_ANIONS[i].pat) !== -1) { acid = WEAK_ANIONS[i].acid; break; }
    }
    addFinding(findings, lineNo, 'ionic', '弱电解质可能被拆成离子',
      '第 ' + lineNo + ' 行左端同时出现了 H+ 与 OH-。',
      acid
        ? 'H+ 与 OH- 会反应生成水，不应同时出现在同一边；左端的 ' + WEAK_ANIONS[i].pat +
          ' 提示你可能把弱电解质 ' + acid + ' 拆成了离子。弱电解质在离子方程式中应写化学式。'
        : 'H+ 与 OH- 会反应生成水，不应同时出现在同一边；请检查是否把弱电解质（如醋酸、一水合氨）拆成了离子。弱电解质在离子方程式中应写化学式。',
      '把弱电解质改写为化学式（如 CH3COOH、NH3·H2O、H2O），再重新书写离子方程式。');
  }
  /* I2：难溶物离子对在左、对应难溶物不在右。 */
  for (var j = 0; j < INSOLUBLE_PAIRS.length; j++) {
    var p = INSOLUBLE_PAIRS[j];
    if (left.indexOf(p.cat) !== -1 && left.indexOf(p.an) !== -1 && right.indexOf(normFlat(p.salt)) === -1) {
      addFinding(findings, lineNo, 'ionic', '难溶物被拆成离子',
        '第 ' + lineNo + ' 行把 ' + p.salt + '（' + p.name + '）拆成了 ' + p.cat + ' 与 ' + p.an + '。',
        p.name + '是难溶物，在离子方程式中应写化学式，不拆成离子。',
        '把左端的 ' + p.cat + ' 与 ' + p.an + ' 合并改写为 ' + p.salt + '，再重新书写离子方程式。');
    }
  }
  /* I3：旁观离子两边同时出现，未约去。 */
  for (var k = 0; k < KNOWN_IONS.length; k++) {
    var ion = KNOWN_IONS[k][0];
    if (left.indexOf(ion) !== -1 && right.indexOf(ion) !== -1) {
      addFinding(findings, lineNo, 'ionic', '旁观离子未约去',
        '第 ' + lineNo + ' 行两边都出现了 ' + ion + '。',
        '离子方程式应约去两边相同的旁观离子，只保留实际参加反应的离子。',
        '把两边的 ' + ion + ' 约去，再检查方程式是否配平、电荷是否守恒。');
    }
  }
}
/* 规则 3：单位换算错（mol/L 与 mL 混用、g 直接除以 mol/L）。 */
function checkUnits(line, lineNo, findings) {
  var n = norm(line);
  var hasConv = /1000|10\^?-?3|0\.001/.test(n);
  if (/mol\/L/.test(n) && /mL/.test(n) && /[*×·]/.test(n) && !hasConv) {
    addFinding(findings, lineNo, 'unit', 'mL 与 L 未换算',
      '第 ' + lineNo + ' 行用 mol/L 的浓度乘了以 mL 为单位的体积，且未见除以 1000。',
      '物质的量 n = c·V 要求体积用 L；直接用 mL 计算，结果会偏大 1000 倍。',
      '把体积换算成 L（除以 1000）后再计算，或在式中写出 ÷1000。');
  }
  if (/\d+(?:\.\d+)?\s*g\s*\/\s*\d+(?:\.\d+)?\s*mol\/L/.test(n)) {
    addFinding(findings, lineNo, 'unit', '单位不匹配：质量除以浓度',
      '第 ' + lineNo + ' 行用质量（g）直接除以物质的量浓度（mol/L）。',
      'g ÷ (mol/L) 的单位是 g·L/mol，既不是体积也不是物质的量。',
      '先用质量除以摩尔质量得到物质的量，再用物质的量除以浓度得到体积。');
  }
}
/* 规则 3b：同一数值在 mL/L、g/kg 间混用（跨行核对）。 */
function checkUnitConsistency(lines, findings) {
  var seen = {};
  for (var i = 0; i < lines.length; i++) {
    var n = norm(lines[i]);
    var re = /(\d+(?:\.\d+)?)\s*(mL|L|g|kg)(?![A-Za-z])/g;
    var m;
    while ((m = re.exec(n)) !== null) {
      var val = parseFloat(m[1]);
      if (!val) continue;
      var unit = m[2];
      var group = (unit === 'mL' || unit === 'L') ? 'vol' : 'mass';
      var key = group + ':' + val;
      if (!seen[key]) seen[key] = [];
      seen[key].push({ line: i + 1, unit: unit });
    }
  }
  for (var k in seen) {
    if (!hasOwn(seen, k)) continue;
    var list = seen[k];
    var units = {};
    for (var j = 0; j < list.length; j++) units[list[j].unit] = true;
    var hasSmall = !!(units.mL || units.g);
    var hasBig = !!(units.L || units.kg);
    if (hasSmall && hasBig) {
      var last = list[list.length - 1];
      var pair = units.mL ? 'mL 与 L' : 'g 与 kg';
      addFinding(findings, last.line, 'unit', '单位混用：同一数值用了两种单位',
        '第 ' + last.line + ' 行的数值与前面某行相同，但单位在' + pair + '之间换了。',
        '1 L = 1000 mL，1 kg = 1000 g；同一数值换单位时数值也要相应换算。',
        '统一用一种单位，并把数值按 1000 倍关系换算。');
    }
  }
}
/* 规则 4：有效数字错（与原题题给数据比较；无原题时跳过）。 */
function checkSigFigs(lines, qSig, findings) {
  var lastIdx = -1, lastLine = '';
  for (var i = lines.length - 1; i >= 0; i--) {
    var t = trim(lines[i]);
    if (t && t.indexOf('=') !== -1) { lastIdx = i; lastLine = t; break; }
  }
  if (lastIdx === -1) return;
  var tail = lastLine.slice(lastLine.lastIndexOf('=') + 1);
  var m = norm(tail).match(/^\s*(-?\d+(?:\.\d+)?(?:\s*(?:\*|×|x)\s*10\^?-?\d+)?)/);
  if (!m) return; /* 最后一行等号后不是数值（如方程式），不核对 */
  var result = m[1];
  var rsf = sigFigs(result);
  if (qSig.keepSig != null && rsf !== qSig.keepSig) {
    addFinding(findings, lastIdx + 1, 'sigfig', '有效数字位数与要求不符',
      '结果 ' + result + ' 有 ' + rsf + ' 位有效数字，原题要求保留 ' + qSig.keepSig + ' 位有效数字。',
      '有效数字位数应按原题要求保留。',
      '把结果改写为 ' + qSig.keepSig + ' 位有效数字。');
    return;
  }
  if (qSig.keepDecimals != null && decimalsOf(result) !== qSig.keepDecimals) {
    addFinding(findings, lastIdx + 1, 'sigfig', '保留小数位数与要求不符',
      '结果 ' + result + ' 保留了 ' + decimalsOf(result) + ' 位小数，原题要求保留 ' + qSig.keepDecimals + ' 位小数。',
      '小数位数应按原题要求保留。',
      '把结果改写为保留 ' + qSig.keepDecimals + ' 位小数。');
    return;
  }
  if (qSig.minSig != null && rsf > qSig.minSig) {
    addFinding(findings, lastIdx + 1, 'sigfig', '结果有效数字多于题给数据',
      '结果 ' + result + ' 有 ' + rsf + ' 位有效数字，题给数据最少只有 ' + qSig.minSig + ' 位有效数字。',
      '计算结果的有效数字位数一般不超过题给数据中最少的那一个。',
      '把结果改写为 ' + qSig.minSig + ' 位有效数字。');
  }
}
/* 规则 5：漏写反应条件。 */
function checkConditions(line, lineNo, findings) {
  var n = norm(line);
  if (n.indexOf('=') === -1) return;
  /* 计算式（n=、c=、m=、V=、pH）不是方程式，不检查条件。 */
  if (/(^|[^A-Za-z])(n|c|m|V)\s*=/.test(n) || /mol\/L/.test(n) || /pH/.test(n)) return;
  for (var i = 0; i < CONDITION_MARKS.length; i++) {
    if (line.indexOf(CONDITION_MARKS[i]) !== -1) return;
  }
  var tokens = formulaTokens(line);
  if (tokens.length < 2) return;
  for (var j = 0; j < CONDITION_TABLE.length; j++) {
    var r = CONDITION_TABLE[j];
    if (hasAllTokens(tokens, r.react) && hasAnyToken(tokens, r.prod)) {
      addFinding(findings, lineNo, 'condition', '漏写反应条件',
        '第 ' + lineNo + ' 行的' + r.name + '反应没有标注反应条件。',
        '该反应通常需要' + r.cond + '，方程式应在箭头上方或下方注明条件。',
        '在方程式箭头处补上条件：' + r.cond + '。');
      return;
    }
  }
}
/* 规则 6：守恒关系用错（电荷不守恒、得失电子不等）。 */
function checkConservation(line, lineNo, findings) {
  var sides = splitSides(line);
  if (sides) {
    var lq = sideCharge(sides.left), rq = sideCharge(sides.right);
    if (lq != null && rq != null && lq !== rq) {
      addFinding(findings, lineNo, 'conserve', '电荷不守恒',
        '第 ' + lineNo + ' 行等式两边的电荷总数不相等（左 ' + (lq >= 0 ? '+' : '') + lq + '，右 ' + (rq >= 0 ? '+' : '') + rq + '）。',
        '离子方程式与电荷守恒式两边的电荷总数必须相等。',
        '检查各离子的系数与电荷数，重新配平电荷。');
    }
  }
  if (/电子/.test(line) || /e-/.test(norm(line))) {
    var getM = line.match(/得\D{0,6}?(\d+(?:\.\d+)?)/);
    var loseM = line.match(/失\D{0,6}?(\d+(?:\.\d+)?)/);
    if (getM && loseM && parseFloat(getM[1]) !== parseFloat(loseM[1])) {
      addFinding(findings, lineNo, 'conserve', '得失电子不等',
        '第 ' + lineNo + ' 行写得电子 ' + getM[1] + '、失电子 ' + loseM[1] + '，两者不相等。',
        '氧化还原反应中得电子总数必须等于失电子总数。',
        '重新核对各物质的化合价变化与系数，使得到失电子总数相等。');
    }
  }
}

/* 诊断入口：text 为学生过程（每行一步），question 为原题（可空）。 */
function diagnoseProcess(text, question) {
  var lines = String(text || '').split(/\r\n?|\n/);
  var findings = [], skipped = [];
  var eng = engine();
  var nonEmpty = 0;
  for (var i = 0; i < lines.length; i++) {
    var line = trim(lines[i]);
    if (!line) continue;
    nonEmpty++;
    checkBalance(line, i + 1, findings, eng);
    checkIonic(line, i + 1, findings);
    checkUnits(line, i + 1, findings);
    checkConditions(line, i + 1, findings);
    checkConservation(line, i + 1, findings);
  }
  checkUnitConsistency(lines, findings);
  if (question) {
    checkSigFigs(lines, questionSigInfo(question), findings);
  } else {
    skipped.push('未提供原题，无法核对有效数字与保留位数。');
  }
  if (!eng) skipped.push('计算引擎未加载，未校验方程式配平。');
  findings.sort(function (a, b) { return a.line - b.line; });
  return { lines: nonEmpty, findings: findings, skipped: skipped };
}

/* ================= 解题面板 ================= */
var S = null; /* 当前会话 */
var maskEl = null, dialogEl = null, priorFocus = null;

function newSession(plan, opts) {
  opts = opts || {};
  return {
    plan: plan, opts: opts, parent: opts.parent || null,
    view: plan ? 'solve' : 'ask',
    revealed: plan && plan.steps.length ? 1 : 0,
    done: {}, confused: {}, whyOpen: {}, hintOpen: {},
    expanded: {}, collapsed: {},
    diagText: '', diagResult: null, diagQuestion: opts.diagQuestion || '',
    variants: null, variantInputs: {}, variantResults: {},
    variantSelfReport: null, questionInput: '', askError: '',
    focusDiagResult: false, historyDispatched: false
  };
}
function stepExpanded(i) {
  if (i === S.revealed - 1) return !S.collapsed[i];
  return !!S.expanded[i];
}
function isFinished() {
  if (!S.plan) return false;
  var n = S.plan.steps.length;
  return n === 0 || S.revealed >= n;
}
function diagQuestion() {
  return S.plan ? S.plan.question : (S.diagQuestion || '');
}

function ensurePanel() {
  if (maskEl || !document.body) return;
  maskEl = document.createElement('div');
  maskEl.className = 'quiz-mask wbs-mask';
  maskEl.id = 'wbsMask';
  maskEl.setAttribute('role', 'dialog');
  maskEl.setAttribute('aria-modal', 'true');
  maskEl.setAttribute('aria-label', '分步解题');
  dialogEl = document.createElement('div');
  dialogEl.className = 'quiz-dialog wbs-dialog';
  dialogEl.id = 'wbsDialog';
  dialogEl.setAttribute('tabindex', '-1');
  maskEl.appendChild(dialogEl);
  document.body.appendChild(maskEl);
  maskEl.addEventListener('click', function (e) { if (e.target === maskEl) closePanel(); });
  maskEl.addEventListener('keydown', function (e) { trapTab(e, dialogEl); });
}
function openPanel() {
  if (!maskEl) return;
  priorFocus = document.activeElement;
  maskEl.classList.add('show');
  if (dialogEl) dialogEl.focus();
}
function closePanel() {
  if (maskEl) maskEl.classList.remove('show');
  if (priorFocus && typeof priorFocus.focus === 'function') {
    try { priorFocus.focus(); } catch (e) { /* 忽略 */ }
    priorFocus = null;
  }
}
function trapTab(e, root) {
  if (e.key !== 'Tab' || !root) return;
  var list = root.querySelectorAll('button, input, select, textarea, a[href], summary');
  var a = [];
  for (var i = 0; i < list.length; i++) {
    if (!list[i].disabled && list[i].getClientRects().length) a.push(list[i]);
  }
  if (!a.length) return;
  var first = a[0], last = a[a.length - 1];
  if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

/* ---------- 3D / Vibe / 助教联动（复用现有公开入口） ---------- */
function vibeTopic(id) {
  var fallback = {
    vsepr: 'VSEPR：电子域互相排斥',
    titration: '滴定曲线：半滴之差',
    cloud: '电子云：从轨道到成键'
  };
  try {
    var V = window.ChemVibe;
    if (!V || typeof V.open !== 'function') return null;
    if (isArray(V.topics)) {
      for (var i = 0; i < V.topics.length; i++) {
        if (V.topics[i] && V.topics[i].id === id) return { id: id, title: V.topics[i].title || fallback[id] || id };
      }
      return null;
    }
    return fallback[id] ? { id: id, title: fallback[id] } : null;
  } catch (e) { return null; }
}
function open3D(kind, id) {
  closePanel();
  try {
    var T = window.ChemTutor;
    if (T && typeof T.act === 'function') { T.act({ type: 'open', kind: kind, id: id }); return; }
  } catch (e) { /* 继续退化分支 */ }
  try { if (typeof window.select === 'function') window.select(kind, id); } catch (e2) { /* 忽略 */ }
}
function openCompare(a, b) {
  closePanel();
  try {
    var T = window.ChemTutor;
    if (T && typeof T.act === 'function') T.act({ type: 'compare', a: a, b: b });
  } catch (e) { /* 忽略 */ }
}
function openVibe(id) {
  closePanel();
  try {
    if (window.ChemVibe && typeof window.ChemVibe.open === 'function') window.ChemVibe.open(id);
  } catch (e) { /* 忽略 */ }
}
function askTutor(text) {
  closePanel();
  try {
    if (window.ChemTutor && typeof window.ChemTutor.send === 'function') window.ChemTutor.send(text);
  } catch (e) { /* 忽略 */ }
}
function linkButtons(plan) {
  var out = [];
  var seen = {};
  var t = plan.topic;
  function push3D(kind, id) {
    var key = kind + ':' + id;
    if (seen[key]) return;
    seen[key] = true;
    var item = findDbItem(kind, id);
    if (!item) return;
    out.push('<button type="button" class="btn-sub wbs-btn" data-wbs-action="open-3d" data-wbs-kind="' +
      esc(kind) + '" data-wbs-id="' + esc(id) + '">在 3D 中查看「' + esc(item.name) + '」</button>');
  }
  if (t) {
    if (t.model) push3D(t.model.kind, t.model.id);
    if (t.compare) {
      out.push('<button type="button" class="btn-sub wbs-btn" data-wbs-action="open-compare" data-wbs-a="' +
        esc(t.compare.a) + '" data-wbs-b="' + esc(t.compare.b) + '">同屏比较水 / 二氧化碳</button>');
    }
    if (t.vibe) {
      var vt = vibeTopic(t.vibe);
      if (vt) {
        out.push('<button type="button" class="btn-sub wbs-btn" data-wbs-action="open-vibe" data-wbs-id="' +
          esc(vt.id) + '">看分步动画「' + esc(vt.title) + '」</button>');
      }
    }
  }
  for (var i = 0; i < plan.refs.length; i++) {
    if (plan.refs[i]) push3D(plan.refs[i].kind, plan.refs[i].id);
  }
  for (var j = 0; j < plan.actions.length; j++) {
    var a = plan.actions[j];
    if (a && a.type === 'open') push3D(a.kind, a.id);
    if (a && a.type === 'compare') {
      out.push('<button type="button" class="btn-sub wbs-btn" data-wbs-action="open-compare" data-wbs-a="' +
        esc(a.a) + '" data-wbs-b="' + esc(a.b) + '">同屏比较相关分子</button>');
    }
  }
  return out.length ? '<div class="wbs-links chem-actions">' + out.join('') + '</div>' : '';
}

/* ---------- 渲染 ---------- */
function captureFocus() {
  try {
    var el = document.activeElement;
    if (!el || !dialogEl || !dialogEl.contains(el)) return null;
    var act = el.getAttribute && el.getAttribute('data-wbs-action');
    if (!act) return null;
    return { action: act, i: el.getAttribute('data-wbs-i'), vid: el.getAttribute('data-wbs-vid') };
  } catch (e) { return null; }
}
function restoreFocus(key) {
  if (S.focusDiagResult) {
    S.focusDiagResult = false;
    var r = $('wbsDiagResult');
    if (r) { r.focus(); return; }
  }
  if (!key || !dialogEl) return;
  try {
    var sel = '[data-wbs-action="' + key.action + '"]';
    if (key.i != null) sel += '[data-wbs-i="' + key.i + '"]';
    if (key.vid != null) sel += '[data-wbs-vid="' + key.vid + '"]';
    var el = dialogEl.querySelector(sel);
    if (el) el.focus();
  } catch (e) { /* 忽略 */ }
}
function render() {
  if (!S || !dialogEl) return;
  var key = captureFocus();
  var html = '';
  if (S.view === 'ask') html = renderAsk();
  else if (S.view === 'diagnose') html = renderDiagnose();
  else html = renderSolve();
  dialogEl.innerHTML = html;
  restoreFocus(key);
  renderFormulas(); /* C 组：步骤 DOM 生成后渲染方程式 */
  maybeDispatchComplete(); /* C 组：解题完成时派发历史事件 */
}
function headHTML(title, badge) {
  return '<div class="quiz-head wbs-head"><h3>' + esc(title) + '</h3>' +
    (badge || '') +
    '<button type="button" class="btn-sub wbs-x" data-wbs-action="close" aria-label="关闭">×</button></div>';
}
function badgeHTML(confidence) {
  return '<span class="wbs-badge wbs-badge-' + confidence + '">' +
    esc(CONFIDENCE_LABEL[confidence] || '') + '</span>';
}

function renderAsk() {
  var html = headHTML('分步解题', '');
  html += '<p class="wbs-note">输入一道化学题，我会先帮你审题（已知什么、求什么、考点是什么），再一步一步推导；每一步都可以问“为什么这样算”，也可以点“没懂”要更细的拆分。</p>';
  if (S.askError) html += '<p class="wbs-warn" role="status">' + esc(S.askError) + '</p>';
  html += '<label class="wbs-label">题目<textarea id="wbsQuestionInput" data-wbs-field="question" rows="4" maxlength="2000" placeholder="例如：配平 Fe + O2 → Fe2O3；或：25℃时，0.01 mol/L 盐酸的 pH 是多少？">' +
    esc(S.questionInput) + '</textarea></label>';
  html += '<div class="chem-actions"><button type="button" class="btn-main wbs-btn" data-wbs-action="start-ask">开始解题</button>' +
    '<button type="button" class="btn-sub wbs-btn" data-wbs-action="photo-solve">拍照解题</button>' +
    '<button type="button" class="btn-sub wbs-btn" data-wbs-action="diagnose-open">帮我找错：诊断我的解题过程</button></div>';
  return html;
}

function renderSolve() {
  var plan = S.plan;
  var n = plan.steps.length;
  var html = headHTML('分步解题', badgeHTML(plan.confidence));
  html += '<p class="wbs-q"><b>题目：</b>' + esc(plan.question) + '</p>';
  if (plan.engineNote) html += '<p class="wbs-note">' + esc(plan.engineNote) + '</p>';
  /* 第 0 步：审题。 */
  var rv = plan.review;
  html += '<section class="wbs-step wbs-step0"><div class="wbs-step-head-static">' +
    '<span class="wbs-step-no">第 0 步</span><span class="wbs-step-title">审题</span></div>' +
    '<div class="wbs-step-body"><dl class="wbs-review">' +
    '<dt>已知什么</dt><dd>' + (rv.known.length ? esc(rv.known.join('；')) : '题干中没有可直接提取的数值条件，请对照原题核对。') + '</dd>' +
    '<dt>求什么</dt><dd>' + (rv.target ? esc(rv.target) : '未识别到明确的求解目标，请对照原题核对。') + '</dd>' +
    '<dt>考点是什么</dt><dd>' + esc(rv.topicName) + '</dd></dl>' +
    linkButtons(plan) + '</div></section>';
  if (n === 0) {
    html += '<p class="wbs-warn">本站资料暂时没有找到可靠解析。可以换一个关键词提问，或向老师请教。</p>';
    if (plan.tutorAnswer) html += '<p class="wbs-note">' + esc(plan.tutorAnswer) + '</p>';
  }
  var doneCount = 0;
  for (var i = 0; i < n && i < S.revealed; i++) {
    var st = plan.steps[i];
    if (S.done[i]) doneCount++;
    var expanded = stepExpanded(i);
    var stateTxt = S.done[i] ? '✓ 懂了' : (S.confused[i] ? '？ 没懂' : (expanded ? '▾' : '▸'));
    html += '<section class="wbs-step' + (S.done[i] ? ' is-done' : '') + (S.confused[i] ? ' is-confused' : '') + '">' +
      '<button type="button" class="wbs-step-head" data-wbs-action="toggle-step" data-wbs-i="' + i +
      '" aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
      '<span class="wbs-step-no">第 ' + (i + 1) + ' 步</span>' +
      '<span class="wbs-step-title">' + esc(st.title) + '</span>' +
      '<span class="wbs-step-state">' + stateTxt + '</span></button>';
    if (expanded) {
      html += '<div class="wbs-step-body">';
      if (st.detail) html += '<p class="wbs-step-detail">' + esc(st.detail) + '</p>';
      html += '<button type="button" class="btn-sub wbs-btn-sm" data-wbs-action="why" data-wbs-i="' + i + '">为什么这样算</button>';
      if (S.whyOpen[i]) {
        html += '<div class="wbs-why">' + (st.why
          ? esc(st.why)
          : '暂无详细讲解。<span class="wbs-think">思考提示：' + esc(guideQuestion(i, st.detail, plan.question)) + '</span>') + '</div>';
      }
      html += '<div class="wbs-feedback"><button type="button" class="btn-sub wbs-btn" data-wbs-action="understood" data-wbs-i="' + i + '">这步懂了</button>' +
        '<button type="button" class="btn-sub wbs-btn" data-wbs-action="confused" data-wbs-i="' + i + '">没懂</button></div>';
      if (S.hintOpen[i]) {
        var subs = splitStep(st);
        html += '<div class="wbs-hint"><p><b>再拆细一点：</b></p>';
        if (subs.length > 1) {
          html += '<ol>';
          for (var k = 0; k < subs.length; k++) html += '<li>' + esc(subs[k]) + '</li>';
          html += '</ol>';
        } else if (subs.length === 1) {
          html += '<p>' + esc(subs[0]) + '</p>';
        } else {
          html += '<p>这一步没有更细的拆分，可以对照题干条件再想一想。</p>';
        }
        html += '<p><b>引导问题：</b>' + esc(guideQuestion(i, st.detail, plan.question)) + '</p>' +
          '<button type="button" class="btn-sub wbs-btn" data-wbs-action="ask-tutor" data-wbs-i="' + i + '">问助教这一步</button></div>';
      }
      html += '</div>';
    }
    html += '</section>';
  }
  if (n > 0) {
    html += '<p class="wbs-progress">已展开 ' + Math.min(S.revealed, n) + ' / ' + n + ' 步 · 已懂 ' + doneCount + ' 步</p>';
    html += '<div class="chem-actions wbs-nav">';
    if (S.revealed < n) html += '<button type="button" class="btn-main wbs-btn" data-wbs-action="next">下一步</button>';
    html += '<button type="button" class="btn-sub wbs-btn" data-wbs-action="restart">重新推导一遍</button></div>';
  }
  if (isFinished()) html += renderCompletion();
  html += '<div class="chem-actions wbs-foot">' +
    '<button type="button" class="btn-sub wbs-btn" data-wbs-action="diagnose-open">帮我找错</button>' +
    '<button type="button" class="btn-sub wbs-btn" data-wbs-action="new-question">换一题</button>' +
    (S.parent ? '<button type="button" class="btn-sub wbs-btn" data-wbs-action="back-parent">返回原题</button>' : '') +
    '</div>';
  return html;
}

function renderCompletion() {
  var plan = S.plan;
  var html = '<section class="wbs-complete"><h4>举一反三 · 变式训练</h4>';
  if (!S.variants) {
    var cls = (plan.topic && plan.topic.cls) || plan.engineCls;
    S.variants = generateVariants(cls, 3);
  }
  if (!S.variants.length) {
    html += '<p class="wbs-note">暂无可生成的变式题（变式题答案须由计算引擎算出，当前引擎未加载或暂不支持该知识点）。</p>';
  } else {
    for (var i = 0; i < S.variants.length; i++) {
      var v = S.variants[i];
      var res = S.variantResults[v.id];
      var input = S.variantInputs[v.id] || '';
      html += '<article class="wbs-variant"><p class="wbs-variant-q"><b>变式 ' + (i + 1) + ' · ' +
        esc(v.tplName) + '</b><br>' + esc(v.question) + '</p>' +
        '<div class="wbs-variant-row"><input type="text" data-wbs-field="variant" data-wbs-vid="' + esc(v.id) +
        '" value="' + esc(input) + '" placeholder="写出你的答案" aria-label="变式题答案">' +
        '<button type="button" class="btn-sub wbs-btn" data-wbs-action="variant-check" data-wbs-vid="' + esc(v.id) + '">核对答案</button>' +
        '<button type="button" class="btn-sub wbs-btn" data-wbs-action="variant-solve" data-wbs-vid="' + esc(v.id) + '">分步解答</button></div>' +
        (res ? '<p class="wbs-variant-result ' + (res.correct ? 'ok' : 'warn') + '" role="status">' + esc(res.text) + '</p>' : '') +
        '</article>';
    }
  }
  var fv = S.opts.fromVariant;
  if (fv) {
    if (!S.variantSelfReport) {
      html += '<div class="wbs-selfreport"><p>这道变式题你做对了吗？</p>' +
        '<div class="chem-actions"><button type="button" class="btn-main wbs-btn" data-wbs-action="variant-correct">做对了</button>' +
        '<button type="button" class="btn-sub wbs-btn" data-wbs-action="variant-wrong">做错了</button></div></div>';
    } else {
      html += '<p class="wbs-note" role="status">' + esc(S.variantSelfReport.text) + '</p>';
    }
  }
  html += '</section>';
  return html;
}

function refTableHTML() {
  function rows(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(esc(list[i].f) + '（' + esc(list[i].name) + '）');
    return out.join('、');
  }
  return '<details class="wbs-ref"><summary>常见弱电解质与难溶物表（规则诊断查表用，共 38 种）</summary>' +
    '<p><b>弱电解质（16 种）：</b>' + rows(WEAK_ELECTROLYTES) + '</p>' +
    '<p><b>难溶物（16 种）：</b>' + rows(INSOLUBLE_LIST) + '</p>' +
    '<p><b>气体（6 种）：</b>' + rows(GAS_LIST) + '</p>' +
    '<p class="wbs-note">弱电解质、难溶物、气体在离子方程式中写化学式，不拆成离子。</p></details>';
}

function renderDiagnose() {
  var html = headHTML('帮我找错', '');
  html += '<p class="wbs-note">规则诊断，未覆盖的错误类型请向老师确认。粘贴或输入你的解题过程，每行一步。</p>';
  if (!diagQuestion()) html += '<p class="wbs-note">未关联原题，有效数字检查已跳过；从解题面板打开诊断可关联原题。</p>';
  html += '<label class="wbs-label">我的解题过程<textarea id="wbsDiagInput" data-wbs-field="diag" rows="6" maxlength="4000" placeholder="每行一步，例如：\n2H2 + O2 = 2H2O\nn = 0.1 mol/L × 25 mL = 2.5 mol">' +
    esc(S.diagText) + '</textarea></label>';
  html += '<div class="chem-actions"><button type="button" class="btn-main wbs-btn" data-wbs-action="diagnose-run">开始诊断</button>' +
    (S.plan ? '<button type="button" class="btn-sub wbs-btn" data-wbs-action="diagnose-back">返回解题</button>' : '') +
    '</div>';
  var res = S.diagResult;
  if (res) {
    html += '<div class="wbs-diag-result" id="wbsDiagResult" tabindex="-1" role="status">';
    html += '<p><b>已检查 ' + res.lines + ' 行，' +
      (res.findings.length ? '发现 ' + res.findings.length + ' 处规则可识别的问题。' : '未发现规则可识别的错误。') + '</b></p>';
    if (!res.findings.length) {
      html += '<p class="wbs-ok">未发现规则可识别的错误。这不代表过程完全正确，未覆盖的错误类型请向老师确认。</p>';
    }
    for (var i = 0; i < res.findings.length; i++) {
      var f = res.findings[i];
      html += '<article class="wbs-finding"><h4>第 ' + f.line + ' 行 · ' + esc(f.title) + '</h4>' +
        '<p><b>错在哪：</b>' + esc(f.what) + '</p>' +
        '<p><b>为什么错：</b>' + esc(f.why) + '</p>' +
        '<p><b>应该怎样：</b>' + esc(f.fix) + '</p></article>';
    }
    if (res.skipped.length) {
      html += '<p class="wbs-note">未检查的项目：' + esc(res.skipped.join('；')) + '</p>';
    }
    html += '</div>';
  }
  html += refTableHTML();
  return html;
}

/* ---------- 动作处理（事件委托） ---------- */
function findVariant(vid) {
  if (!S || !S.variants) return null;
  for (var i = 0; i < S.variants.length; i++) {
    if (S.variants[i].id === vid) return S.variants[i];
  }
  return null;
}
function masteryText(variant, correct) {
  if (!variant.mastery) return '';
  var rec = recordMastery(variant.mastery.kind, variant.mastery.id, correct);
  if (rec.updated) return '掌握状态已更新为「' + rec.label + '」。';
  if (rec.state) return '掌握状态：' + rec.label + '（已有更好成绩，保持不变）。';
  return rec.reason ? '掌握状态未更新：' + rec.reason + '。' : '';
}
function handleAction(action, el) {
  var i = el.getAttribute('data-wbs-i');
  i = (i == null || i === '') ? -1 : parseInt(i, 10);
  var vid = el.getAttribute('data-wbs-vid');
  switch (action) {
    case 'close':
      closePanel();
      return;
    case 'diagnose-open':
      if (!S) S = newSession(null, {});
      S.view = 'diagnose';
      ensurePanel(); render(); openPanel();
      return;
    case 'start-ask': {
      var ta = $('wbsQuestionInput');
      var q = trim((ta ? ta.value : '') || S.questionInput || '');
      if (!q) { S.askError = '请先输入题目。'; render(); return; }
      start(q, {});
      return;
    }
    case 'photo-solve': { /* v2.2.0 集成：拍照入口，C 组 ChemSolveOCR */
      try {
        if (window.ChemSolveOCR && typeof window.ChemSolveOCR.openPhotoSolve === 'function') {
          window.ChemSolveOCR.openPhotoSolve();
        } else {
          S.askError = '拍照组件未加载，请直接输入题目，或刷新页面重试。';
          render();
        }
      } catch (e) {
        S.askError = '拍照功能暂时不可用，请直接输入题目。';
        render();
      }
      return;
    }
    case 'new-question':
      S = newSession(null, {});
      S.view = 'ask';
      render();
      return;
    case 'back-parent':
      if (S && S.parent) { S = S.parent; render(); }
      return;
    case 'next':
      if (S.plan && S.revealed < S.plan.steps.length) S.revealed++;
      render();
      return;
    case 'restart':
      S.revealed = S.plan && S.plan.steps.length ? 1 : 0;
      S.done = {}; S.confused = {}; S.whyOpen = {}; S.hintOpen = {};
      S.expanded = {}; S.collapsed = {};
      S.variantSelfReport = null;
      render();
      return;
    case 'toggle-step':
      if (i === S.revealed - 1) S.collapsed[i] = !S.collapsed[i];
      else S.expanded[i] = !S.expanded[i];
      render();
      return;
    case 'why':
      S.whyOpen[i] = !S.whyOpen[i];
      render();
      return;
    case 'understood': {
      S.done[i] = true;
      delete S.confused[i];
      delete S.hintOpen[i];
      if (i === S.revealed - 1 && S.revealed < S.plan.steps.length) S.revealed++;
      /* 全部步骤都点“懂了”：本题已理解，错题联动记为已订正。 */
      var allDone = true;
      for (var d = 0; d < S.plan.steps.length; d++) {
        if (!S.done[d]) { allDone = false; break; }
      }
      if (allDone && S.plan.steps.length) callMistakes('markUnderstood', S.plan.question);
      render();
      return;
    }
    case 'confused': {
      S.confused[i] = true;
      S.hintOpen[i] = !S.hintOpen[i];
      delete S.done[i];
      /* 错题联动：记入错题本（卡住的步骤写进备注）。 */
      var cst = S.plan.steps[i];
      callMistakes('markNotUnderstood', S.plan.question,
        { topic: mistakeTopic(), note: '第 ' + (i + 1) + ' 步：' + (cst ? cst.title : '') });
      render();
      return;
    }
    case 'ask-tutor': {
      var st = S.plan.steps[i];
      askTutor('这一步为什么这样算？题目：' + S.plan.question + '；步骤：' + (st ? st.title : '') +
        (st && st.detail ? '（' + st.detail + '）' : ''));
      return;
    }
    case 'open-3d':
      open3D(el.getAttribute('data-wbs-kind'), el.getAttribute('data-wbs-id'));
      return;
    case 'open-compare':
      openCompare(el.getAttribute('data-wbs-a'), el.getAttribute('data-wbs-b'));
      return;
    case 'open-vibe':
      openVibe(el.getAttribute('data-wbs-id'));
      return;
    case 'diagnose-run': {
      var dt = $('wbsDiagInput');
      S.diagText = dt ? dt.value : (S.diagText || '');
      if (!trim(S.diagText)) {
        S.diagResult = { lines: 0, findings: [], skipped: ['请先输入解题过程。'] };
      } else {
        S.diagResult = diagnoseProcess(S.diagText, diagQuestion());
      }
      S.focusDiagResult = true;
      render();
      return;
    }
    case 'diagnose-back':
      S.view = S.plan ? 'solve' : 'ask';
      render();
      return;
    case 'variant-check': {
      var v = findVariant(vid);
      if (!v) return;
      var input = S.variantInputs[vid] || '';
      var res = checkVariantAnswer(v, input);
      if (!res.ok) {
        S.variantResults[vid] = { correct: false, text: res.message };
      } else if (res.correct) {
        callMistakes('markUnderstood', v.question);
        S.variantResults[vid] = { correct: true, text: '回答正确！' + masteryText(v, true) };
      } else {
        callMistakes('markVariantWrong', v.question,
          { topic: mistakeTopic(), note: '变式题（' + v.tplName + '）答错，正确答案：' + res.expected });
        S.variantResults[vid] = { correct: false,
          text: '再想想：正确答案是 ' + res.expected + '。可以点“分步解答”看推导过程。' + masteryText(v, false) };
      }
      render();
      return;
    }
    case 'variant-solve': {
      var v2 = findVariant(vid);
      if (!v2) return;
      start(v2.question, {
        engineMethod: v2.method, engineSpec: v2.arg, engineCls: v2.cls,
        fromVariant: v2, parent: S
      });
      return;
    }
    case 'variant-correct':
    case 'variant-wrong': {
      var fv = S.opts.fromVariant;
      var correct = (action === 'variant-correct');
      var text = correct ? '做对了，很好！' : '没关系，对照上面的分步解答再想一想，也可以点“重新推导一遍”。';
      if (fv) {
        text += masteryText(fv, correct);
        if (correct) callMistakes('markUnderstood', fv.question);
        else callMistakes('markVariantWrong', fv.question,
          { topic: mistakeTopic(), note: '变式题（' + fv.tplName + '）自评做错' });
      }
      S.variantSelfReport = { correct: correct, text: text };
      render();
      return;
    }
    default:
      return;
  }
}

function onDocClick(e) {
  updateDrawerBtnVisibility();
  var t = e.target && e.target.closest ? e.target.closest('[data-wbs-action]') : null;
  if (!t) return;
  handleAction(t.getAttribute('data-wbs-action'), t);
}
function onDocInput(e) {
  var t = e.target;
  if (!t || !t.getAttribute || !S) return;
  var f = t.getAttribute('data-wbs-field');
  if (f === 'diag') S.diagText = t.value;
  else if (f === 'variant') S.variantInputs[t.getAttribute('data-wbs-vid')] = t.value;
  else if (f === 'question') S.questionInput = t.value;
}
function onDocKeydown(e) {
  if (e.key === 'Escape' && maskEl && maskEl.classList.contains('show')) {
    if (document.querySelector('.chem-modal.open')) return;
    closePanel();
  }
}

/* ---------- 助教抽屉入口（solve 模式内显示，事件委托挂载） ---------- */
function updateDrawerBtnVisibility() {
  var b = document.querySelector('[data-wbs-drawer-btn]');
  if (!b) return;
  var show = true;
  try {
    if (window.ChemSocratic && typeof window.ChemSocratic.getMode === 'function') {
      show = window.ChemSocratic.getMode() === 'solve';
    }
  } catch (e) { /* 苏格拉底模块不可用时默认显示 */ }
  b.style.display = show ? '' : 'none';
}
function injectDrawerButton(attempt) {
  var quick = $('caQuick');
  if (!quick) {
    if (attempt < 20) setTimeout(function () { injectDrawerButton(attempt + 1); }, 500);
    return;
  }
  if (document.querySelector('[data-wbs-drawer-btn]')) { updateDrawerBtnVisibility(); return; }
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-sub wbs-drawer-btn';
  b.setAttribute('data-wbs-drawer-btn', '1');
  b.setAttribute('data-wbs-action', 'diagnose-open');
  b.textContent = '帮我找错：诊断我的解题过程';
  b.title = '粘贴你的解题过程（每行一步），按规则逐行检查常见错误';
  quick.parentNode.insertBefore(b, quick.nextSibling);
  updateDrawerBtnVisibility();
}

/* ---------- 对外接口 ---------- */
function start(question, opts) {
  opts = opts || {};
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', function () { start(question, opts); });
    return null;
  }
  var q = trim(question || '');
  if (!q) {
    S = newSession(null, opts);
    S.view = 'ask';
    ensurePanel(); render(); openPanel();
    return S;
  }
  S = newSession(buildPlan(q, opts), opts);
  S.view = 'solve';
  ensurePanel(); render(); openPanel();
  return S;
}
function resume() {
  if (!S) return false;
  ensurePanel(); render(); openPanel();
  return true;
}

var DELEGATED = false;
function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }
  if (DELEGATED) return;
  DELEGATED = true;
  ensurePanel();
  injectDrawerButton(0);
  document.addEventListener('click', onDocClick);
  document.addEventListener('input', onDocInput);
  document.addEventListener('keydown', onDocKeydown);
}
init();

window.ChemSolveFlow = {
  version: '2.2.0-b1',
  start: start,
  resume: resume,
  close: closePanel,
  openDiagnosis: function (question) {
    S = newSession(null, { diagQuestion: question || '' });
    S.view = 'diagnose';
    ensurePanel(); render(); openPanel();
    return S;
  },
  /* 供测试与集成复用的纯逻辑入口（不碰 DOM 的部分可单测）。 */
  buildPlan: buildPlan,
  detectTopic: detectTopic,
  diagnose: diagnoseProcess,
  generateVariants: generateVariants,
  checkVariantAnswer: checkVariantAnswer,
  recordMastery: recordMastery,
  confidenceLabel: function (c) { return CONFIDENCE_LABEL[c] || ''; }
};

})();
