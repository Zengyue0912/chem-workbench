/* ============================================================================
 * 高中化学 3D 考点工作台 — 同步练习变式生成器（v2.4.0 / B 组）
 *
 * 定位：按“模板 + 种子”确定性生成计算类变式练习题，与静态题库
 * （CHEM_PRACTICE_DEFAULT，chem-practice/2）共用同一题目对象结构。
 * 纯逻辑模块，不依赖 DOM；浏览器挂载 window.ChemPracticeGen，Node 下
 * 同时支持 module.exports（便于测试）。
 *
 * 依赖：window.ChemSolveEngine（js/workbench-solve-engine.js）。引擎在每次
 * 生成时惰性读取；引擎不可用、或任一引擎调用返回 ok:false 时，generate()
 * 明确抛错，绝不输出未经引擎验证的答案。
 *
 * 答案来源（确定性计算引擎，绝不手写/硬编码答案）：
 *   - ph：引擎 ph()（strong-acid / strong-base）；稀释先由引擎
 *     conserve/dilution（c₁V₁=c₂V₂）求稀释后浓度，再由 ph() 求 pH。
 *   - balance：引擎 balance()（分数高斯消元配平 + 原子守恒检验）。
 *   - stoich：引擎 stoich()（n-mass / n-volume / reaction）。
 *   - solution：引擎 stoich/molarity + conserve/dilution。
 *   - titration：引擎原语组合，推导链：① balance() 取标准液与待测液的
 *     计量系数比；② stoich/molarity 由 c(标准)×V(平均消耗) 求 n(标准溶质)；
 *     ③ 按系数比求 n(待测溶质)；④ stoich/molarity 由 n(待测)/V(待测)
 *     求 c(待测)。三组平行读数的平均值是纯算术平均（已在解析中说明）。
 *   - kc：引擎无直接 Kc 接口，用引擎原语组合，推导链：① balance() 取
 *     计量系数；② 三段式（起始/转化/平衡）得各物质平衡物质的量；
 *     ③ stoich/molarity（c=n/V）求各平衡浓度；④ Kc 按定义式
 *     Kc=Π[生成物]^ν/Π[反应物]^ν 代入引擎算出的浓度与系数求得。
 *     系数与浓度均来自引擎，最后一步只是定义式的代数代入。
 *   - redox：引擎 conserve/redox-electron（电子守恒）求未知物质的量；
 *     转移电子总量 = 已知物质的量 × 每分子得失电子数，并与引擎解出的
 *     未知量 × 其电子数交叉检验，不一致时抛错。
 *
 * 可复现性：自实现 mulberry32 + FNV-1a 字符串种子哈希；同一（模板，种子）
 * 重复生成结果完全一致（JSON 严格相等）。默认种子（不传 seed 时）用
 * Math.random 生成，不可复现，仅供随手出题。
 *
 * 题目对象：字段与静态题库一致（id / topic / title / stem / type /
 * points / options 或 parts / answer / analysis / source / level），另附
 * _gen 元数据（{template, seed, variant, params, checks}，供自测与调试；
 * C.validate() 只取已知字段，会自动丢弃 _gen，接入时也可自行删除）。
 * analysis 为结构化对象 {focus, approach, steps[], pitfalls}；当前
 * C.validate() 要求 analysis 为字符串，协调员接入时须先升级校验器以
 * 接受结构化解析，或用本模块的 flattenAnalysis(q) 把解析压平为字符串
 * 再合入题包（见汇报中的接线说明）。
 *
 * API：
 *   generate(templateId, seed)   生成一道题（seed 可选，缺省为随机种子）
 *   randomByTopic(topic, seed)   在指定主题内按种子挑模板生成
 *   listTemplates()              7 个模板的元数据
 *   variantOf(question, seed)    同模板新种子（静态题则按主题换一道）
 *   engineAvailable()            引擎是否可用
 *   analysisText(analysis)       结构化解析 → 纯文本
 *   flattenAnalysis(question)    返回 analysis 已压平为字符串的题目副本
 *   checkSchema(question)        按 v2.4 变式题 schema 自检，返回 {ok, errors}
 * ========================================================================== */
(function (root) {
'use strict';

/* ============================== 引擎接入（惰性读取） ============================== */
/* Node 下在加载时 require 同目录引擎；浏览器下每次生成时读 window 上的挂载，
   因此脚本加载顺序不敏感（但仍建议把本文件放在引擎之后加载）。 */
var nodeEngine = null;
if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
  try { nodeEngine = require('./workbench-solve-engine.js'); } catch (e) { nodeEngine = null; }
}
function getEngine() {
  if (nodeEngine) return nodeEngine;
  if (typeof window !== 'undefined' && window.ChemSolveEngine) return window.ChemSolveEngine;
  if (typeof global !== 'undefined' && global.ChemSolveEngine) return global.ChemSolveEngine;
  return null;
}
function engineAvailable() { return !!getEngine(); }
function needEngine() {
  var E = getEngine();
  if (!E) throw new Error('ChemSolveEngine 不可用：请先加载 js/workbench-solve-engine.js（浏览器），或确保其与本文件位于同一目录（Node）');
  return E;
}
/* 引擎调用守卫：任何 ok:false 都转为明确的 Error，绝不继续用失败结果出题。 */
function mustOk(res, ctx) {
  if (!res || res.ok !== true) {
    throw new Error('引擎计算失败（' + ctx + '）：' + (res && res.error ? res.error : '未知错误'));
  }
  return res;
}

/* ============================== 带种子随机数 ============================== */
/* FNV-1a 32 位字符串哈希：把任意字符串种子映射为无符号 32 位整数。 */
function hashSeed(seed) {
  var s = String(seed), h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/* mulberry32：小而快的确定性 PRNG，同一整数种子产生同一随机数序列。 */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  var n = (typeof seed === 'number' && isFinite(seed)) ? (seed >>> 0) : hashSeed(seed);
  return mulberry32(n);
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
function shuffle(rng, arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
function defaultSeed() { return Math.floor(Math.random() * 1000000000); }

/* ============================== 数值格式化 ============================== */
var SUP_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
function supNum(n) {
  return String(n).split('').map(function (ch) {
    if (ch === '-') return '⁻';
    if (ch === '+') return '⁺';
    return SUP_DIGITS[+ch] || ch;
  }).join('');
}
function trimNum(v) {
  var s = String(v);
  if (s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
function round6(v) { return Math.round(v * 1e6) / 1e6; }
function log10(x) { return Math.log(x) / Math.LN10; }
/* 通用数值显示：常规范围保留至多 4 位小数去尾零；过大/过小用科学计数法。 */
function fmtVal(v) {
  if (v === 0) return '0';
  var a = Math.abs(v);
  if (a >= 1e4 || a < 1e-3) {
    var e = Math.floor(Math.log(a) / Math.LN10);
    var m = Math.round(v / Math.pow(10, e) * 1000) / 1000;
    return trimNum(m) + '×10' + supNum(e);
  }
  return trimNum(Math.round(v * 1e4) / 1e4);
}
/* pH 固定两位小数（化学常规写法，如 1.70、12.00）。 */
function fmtPH(v) { return (Math.round(v * 100) / 100).toFixed(2); }
/* 浓度：至多 4 位小数去尾零。 */
function fmtConc(v) { return trimNum(Math.round(v * 1e4) / 1e4); }
/* 滴定管读数：固定两位小数（如 25.00 mL）。 */
function fmtMl(v) { return v.toFixed(2); }

/* 填空数值容差：整数题 0；pH 0.02；其余取 1%（向上取整到 1 位有效数字），
   既容纳中间步骤的舍入差异，又不会把数量级错误判对。 */
function toleranceFor(v, kind) {
  if (kind === 'int') return 0;
  if (kind === 'ph') return 0.02;
  var a = Math.abs(v);
  if (a === 0) return 0.0005;
  var t = a * 0.01;
  var mag = Math.pow(10, Math.floor(Math.log(t) / Math.LN10));
  var t1 = Math.ceil(t / mag) * mag;
  return Math.max(round6(t1 * 1e6) / 1e6, 1e-5);
}

/* ============================== 主题与题目骨架 ============================== */
var TOPICS = ['物质与反应', '元素及其化合物', '结构与有机', '反应原理', '定量分析', '实验探究'];

/* 种子 → id 片段：数字或安全字符串直接用；其他字符串用 FNV-1a 哈希缩写，
   保证 id 始终符合 /^[A-Za-z0-9_.-]{1,64}$/。 */
function seedSlug(seed) {
  var s = String(seed);
  if (/^[A-Za-z0-9_-]{1,32}$/.test(s)) return s;
  return 'h' + ('0000000' + hashSeed(s).toString(16)).slice(-8);
}

/* 记录一次引擎调用，供自测独立重算：{method, spec, field, value}，
   field 为结果中的取值路径（如 'value'、'result.c2'、'coefficients.2'）。 */
function recordCheck(gen, method, spec, field, value) {
  gen.checks.push({ method: method, spec: spec, field: field, value: value });
}

/* 结构化解析：引擎 steps（{title, detail}）转为字符串数组，可追加推导链说明。 */
function buildAnalysis(focus, approach, engineSteps, extraSteps, pitfalls) {
  var steps = [];
  var all = (engineSteps || []).concat(extraSteps || []);
  for (var i = 0; i < all.length; i++) {
    steps.push(typeof all[i] === 'string' ? all[i] : all[i].title + '：' + all[i].detail);
  }
  return { focus: focus, approach: approach, steps: steps, pitfalls: pitfalls };
}

/* 结构化解析 → 纯文本（供旧版字符串解析渲染/校验使用）。 */
function analysisText(a) {
  if (typeof a === 'string') return a;
  if (!a || typeof a !== 'object') return '';
  var out = [];
  if (a.focus) out.push('考什么：' + a.focus);
  if (a.approach) out.push('怎么想：' + a.approach);
  if (Array.isArray(a.steps) && a.steps.length) {
    out.push('分步详解：');
    for (var i = 0; i < a.steps.length; i++) out.push((i + 1) + '. ' + a.steps[i]);
  }
  if (a.pitfalls) out.push('易错点：' + a.pitfalls);
  return out.join('\n');
}

function baseQuestion(gen, meta, type, points) {
  return {
    id: 'gen-' + gen.template + '-' + seedSlug(gen.seed),
    topic: meta.topic,
    title: meta.title,
    stem: meta.stem,
    type: type,
    points: points,
    analysis: meta.analysis,
    source: '变式生成',
    level: meta.level,
    _gen: gen
  };
}

/* 单选题收尾：干扰项去重后取 3 个，与正确项一起按种子洗牌，定位答案下标。 */
function finishSingle(rng, gen, meta, correctText, distractorTexts) {
  var seen = {};
  seen[correctText] = true;
  var ds = [];
  for (var i = 0; i < distractorTexts.length; i++) {
    var t = distractorTexts[i];
    if (typeof t === 'string' && t !== '' && !seen[t]) { seen[t] = true; ds.push(t); }
  }
  if (ds.length < 3) throw new Error('模板 ' + gen.template + ' 干扰项不足 3 个（去重后 ' + ds.length + ' 个）');
  ds = shuffle(rng, ds).slice(0, 3);
  var opts = shuffle(rng, [correctText].concat(ds));
  var q = baseQuestion(gen, meta, 'single', 4);
  q.options = opts;
  q.answer = opts.indexOf(correctText);
  return q;
}

/* 填空题收尾：总分 = 各小题分之和（每小题 2 分，2 小题 4 分、3 小题 6 分）。 */
function finishFill(gen, meta, parts) {
  var points = 0;
  for (var i = 0; i < parts.length; i++) points += parts[i].points;
  var q = baseQuestion(gen, meta, 'fill', points);
  q.parts = parts;
  return q;
}
function numPart(id, prompt, value, unit, tolKind, points) {
  return {
    id: id, prompt: prompt, kind: 'numeric', answer: value,
    points: points || 2, unit: unit || '',
    tolerance: toleranceFor(value, tolKind || ''), rubric: ''
  };
}

/* 由正确值与“典型错误值”生成干扰项文本；不足 3 个时用倍数扰动补足。
   format：数值→字符串；unit：单位后缀；valid：可选的值域过滤（如 pH 须在 0~14 内）。 */
function numDistractors(rng, value, format, unit, wrongValues, valid) {
  var correct = format(value) + unit;
  var seen = {};
  seen[correct] = true;
  var out = [];
  function add(v) {
    if (typeof v !== 'number' || !isFinite(v)) return;
    if (valid && !valid(v)) return;
    var t = format(v) + unit;
    if (t !== correct && !seen[t]) { seen[t] = true; out.push(t); }
  }
  for (var i = 0; i < wrongValues.length; i++) add(wrongValues[i]);
  var mults = [0.5, 2, 1.5, 0.8, 1.2, 3, 0.25, 4, 0.1, 10, 0.9, 1.1, 0.2, 5];
  for (var j = 0; j < mults.length && out.length < 3; j++) add(value * mults[j]);
  return out;
}
/* 整数干扰项（配平系数）：±1、±2、×2 等，去重后取够 3 个。 */
function intDistractors(rng, v) {
  var cands = [v - 1, v + 1, v + 2, v - 2, v * 2, v + 3, 1, 2, 3, 4, 5, 6, 7, 8];
  var seen = {}, out = [];
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i];
    if (c > 0 && c !== v && !seen[c]) { seen[c] = true; out.push(String(c)); }
  }
  return out;
}

/* ============================== 变式题 schema 自检 ============================== */
/* 镜像 C.validate() 的题目级约束（id 正则、主题、题型、分值、选项/小题、
   答案范围），外加 v2.4 结构化 analysis 的形状检查。注意：当前 inline-09
   的 C.validate() 要求 analysis 为字符串，生成题合入题包前须先升级校验器
   或调用 flattenAnalysis() 压平（见模块头与汇报）。 */
function checkSchema(q) {
  var errors = [];
  function bad(m) { errors.push(m); }
  if (!q || typeof q !== 'object') return { ok: false, errors: ['题目不是对象'] };
  if (typeof q.id !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(q.id)) bad('id 不合法');
  if (TOPICS.indexOf(q.topic) === -1) bad('topic 不在 6 个主题内');
  if (typeof q.title !== 'string' || !q.title.trim() || q.title.length > 160) bad('title 格式不正确');
  if (typeof q.stem !== 'string' || !q.stem.trim() || q.stem.length > 6000) bad('stem 格式不正确');
  if (q.type !== 'single' && q.type !== 'fill') bad('type 须为 single 或 fill');
  if (!Number.isInteger(q.points) || q.points < 1 || q.points > 50) bad('points 须为 1–50 的整数');
  if (typeof q.source !== 'string' || !q.source.trim() || q.source.length > 300) bad('source 格式不正确');
  if (q.level !== '巩固' && q.level !== '综合') bad('level 须为“巩固”或“综合”');
  var a = q.analysis;
  if (!a || typeof a !== 'object' || typeof a.focus !== 'string' || !a.focus.trim()) bad('analysis.focus 缺失');
  if (!a || typeof a !== 'object' || typeof a.approach !== 'string' || !a.approach.trim()) bad('analysis.approach 缺失');
  if (!a || typeof a !== 'object' || !Array.isArray(a.steps) || !a.steps.length ||
      a.steps.some(function (s) { return typeof s !== 'string' || !s.trim(); })) bad('analysis.steps 须为非空字符串数组');
  if (!a || typeof a !== 'object' || typeof a.pitfalls !== 'string' || !a.pitfalls.trim()) bad('analysis.pitfalls 缺失');
  if (q.type === 'single') {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8) bad('单选题选项须为 2–8 个');
    else {
      var seen = {};
      for (var i = 0; i < q.options.length; i++) {
        if (typeof q.options[i] !== 'string' || !q.options[i].trim() || q.options[i].length > 1500) bad('选项格式不正确');
        if (seen[q.options[i]]) bad('选项重复');
        seen[q.options[i]] = true;
      }
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || !Array.isArray(q.options) || q.answer >= q.options.length) bad('单选题答案索引越界');
  } else if (q.type === 'fill') {
    if (!Array.isArray(q.parts) || !q.parts.length || q.parts.length > 12) bad('填空题须有 1–12 个小题');
    else {
      var sum = 0, pids = {};
      for (var j = 0; j < q.parts.length; j++) {
        var p = q.parts[j];
        if (typeof p.id !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(p.id)) bad('小题 id 不合法');
        if (pids[p.id]) bad('小题 id 重复');
        pids[p.id] = true;
        if (p.kind !== 'numeric' && p.kind !== 'text' && p.kind !== 'manual') bad('小题 kind 不正确');
        if (typeof p.prompt !== 'string' || !p.prompt.trim() || p.prompt.length > 2000) bad('小题 prompt 格式不正确');
        if (!Number.isInteger(p.points) || p.points < 1 || p.points > 50) bad('小题分值不正确');
        sum += p.points;
        if (p.kind === 'numeric') {
          if (!isFinite(p.answer) || !isFinite(p.tolerance) || p.tolerance < 0 || p.tolerance > 1000) bad('数值小题的答案或容差无效');
        } else if (p.kind === 'text') {
          if (!Array.isArray(p.answer) || !p.answer.length) bad('文本小题须有参考答案');
        }
      }
      if (sum !== q.points) bad('总分与小题分值之和不一致');
    }
  }
  return { ok: errors.length === 0, errors: errors };
}

/* ============================================================================
 * 模板 1：ph — 强酸/强碱 pH 与稀释（反应原理 / 巩固）
 * 子型：acid（强酸 pH，单选）/ base（强碱 pH，单选）/
 *      dilute-acid / dilute-base（稀释后浓度 + pH，填空 2 小题）
 * 答案来源：引擎 ph()；稀释浓度由引擎 conserve/dilution 求出后，再以该
 * 浓度调用 ph()（strong-acid/strong-base，计入每分子电离数 n），因此
 * H₂SO₄、Ba(OH)₂ 等多元强酸碱的稀释 pH 也是正确的。
 * ========================================================================== */
var PH_ACIDS = [
  { name: '盐酸', formula: 'HCl', label: 'HCl', n: 1 },
  { name: '硝酸', formula: 'HNO3', label: 'HNO₃', n: 1 },
  { name: '硫酸', formula: 'H2SO4', label: 'H₂SO₄', n: 2 }
];
var PH_BASES = [
  { name: '氢氧化钠', formula: 'NaOH', label: 'NaOH', n: 1 },
  { name: '氢氧化钾', formula: 'KOH', label: 'KOH', n: 1 },
  { name: '氢氧化钡', formula: 'Ba(OH)2', label: 'Ba(OH)₂', n: 2 }
];
var PH_CONCS = [0.1, 0.01, 0.001, 0.05, 0.02, 0.005, 0.002];

function genPh(E, rng, gen) {
  var variant = pick(rng, ['acid', 'base', 'dilute-acid', 'dilute-base']);
  gen.variant = variant;
  if (variant === 'acid' || variant === 'base') {
    var isAcid = variant === 'acid';
    var sol = pick(rng, isAcid ? PH_ACIDS : PH_BASES);
    var c = pick(rng, PH_CONCS);
    var spec = { kind: isAcid ? 'strong-acid' : 'strong-base', c: c, n: sol.n };
    var r = mustOk(E.ph(spec), 'pH 计算');
    gen.params = { solute: sol.formula, c: c, n: sol.n };
    recordCheck(gen, 'ph', spec, 'value', r.value);
    var stem = '25℃，' + fmtConc(c) + ' mol/L ' + sol.name + '（' + sol.label + '）溶液的 pH 约为多少？（Kw=1.0×10⁻¹⁴，忽略水的电离）';
    var analysis = buildAnalysis(
      '强' + (isAcid ? '酸' : '碱') + '溶液的 pH 计算',
      isAcid
        ? '强酸完全电离，先求 c(H⁺)，再用 pH=-lg c(H⁺)。注意一分子酸电离出的 H⁺ 个数。'
        : '强碱完全电离，先求 c(OH⁻)，再用 pH+pOH=14。注意一分子碱电离出的 OH⁻ 个数。',
      r.steps, null,
      isAcid
        ? 'H₂SO₄ 每分子电离出 2 个 H⁺，c(H⁺)=2c，不能直接用酸的浓度取对数；pH 越小酸性越强，不要把 -lg 算成 lg。'
        : 'Ba(OH)₂ 每分子电离出 2 个 OH⁻；pH=14-pOH，不要把 pOH 当成 pH。');
    var wrong = isAcid
      ? [-log10(c), 14 - r.value, r.value + 1, r.value - 1, r.value + 0.3]
      : [14 - r.value, -log10(c), r.value + 1, r.value - 1, r.value - 0.3];
    var ds = numDistractors(rng, r.value, fmtPH, '', wrong, function (v) { return v >= 0 && v <= 14; });
    return finishSingle(rng, gen,
      { topic: '反应原理', title: '强' + (isAcid ? '酸' : '碱') + '的 pH', stem: stem, analysis: analysis, level: '巩固' },
      fmtPH(r.value), ds);
  }
  var isAcidD = variant === 'dilute-acid';
  var solD = pick(rng, isAcidD ? PH_ACIDS : PH_BASES);
  var cD = pick(rng, [0.1, 0.01, 0.05]);
  var factor = pick(rng, [10, 100, 1000]);
  var dSpec = { template: 'dilution', c1: cD, v1: 1, v2: factor };
  var dRes = mustOk(E.conserve(dSpec), '稀释守恒');
  var pSpec = { kind: isAcidD ? 'strong-acid' : 'strong-base', c: dRes.result.c2, n: solD.n };
  var pRes = mustOk(E.ph(pSpec), '稀释后 pH');
  gen.params = { solute: solD.formula, c: cD, factor: factor, n: solD.n };
  recordCheck(gen, 'conserve', dSpec, 'result.c2', dRes.result.c2);
  recordCheck(gen, 'ph', pSpec, 'value', pRes.value);
  var stemD = '25℃，将 ' + fmtConc(cD) + ' mol/L ' + solD.name + '（' + solD.label + '）溶液加水稀释 ' + factor +
    ' 倍，忽略水的电离。求稀释后溶液中 ' + solD.label + ' 的浓度与溶液的 pH。';
  var analysisD = buildAnalysis(
    '强' + (isAcidD ? '酸' : '碱') + '溶液的稀释与 pH',
    '稀释前后溶质物质的量不变，先由 c₁V₁=c₂V₂ 求稀释后浓度，再按强' + (isAcidD ? '酸' : '碱') + '公式求 pH。',
    dRes.steps.concat(pRes.steps),
    ['推导链：稀释后浓度由引擎 conserve/dilution（c₁V₁=c₂V₂）算出；pH 由引擎 ph() 以稀释后浓度与每分子电离数 n=' + solD.n + ' 算出。'],
    '稀释 ' + factor + ' 倍是浓度除以 ' + factor + '，不是 pH 加减 ' + factor + '；稀释后仍是强' + (isAcidD ? '酸' : '碱') + '，求 pH 时别忘了每分子电离数 n。');
  var partsD = [
    numPart('a', '稀释后 ' + solD.label + ' 的浓度', dRes.result.c2, 'mol/L'),
    numPart('b', '稀释后溶液的 pH', pRes.value, '', 'ph')
  ];
  return finishFill(gen,
    { topic: '反应原理', title: '强' + (isAcidD ? '酸' : '碱') + '的稀释与 pH', stem: stemD, analysis: analysisD, level: '巩固' },
    partsD);
}

/* ============================================================================
 * 模板 2：balance — 方程式配平（物质与反应 / 巩固）
 * 子型：coef-single（问某一物质系数，单选）/ coef-fill（问两个物质系数，
 *      填空 2 小题）/ full-single（问完整配平结果，单选；干扰项为逐个
 *      系数 ±1 的未配平方程式，保证错误且不与正确项重复）
 * 答案来源：引擎 balance()（分数高斯消元 + 原子守恒检验）。
 * ========================================================================== */
var BALANCE_POOL = [
  { eq: 'Fe + O2 -> Fe2O3', disp: 'Fe + O₂ → Fe₂O₃' },
  { eq: 'C2H6 + O2 -> CO2 + H2O', disp: 'C₂H₆ + O₂ → CO₂ + H₂O' },
  { eq: 'KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O', disp: 'KMnO₄ + HCl → KCl + MnCl₂ + Cl₂ + H₂O' },
  { eq: 'Cu + HNO3 -> Cu(NO3)2 + NO + H2O', disp: 'Cu + HNO₃ → Cu(NO₃)₂ + NO + H₂O' },
  { eq: 'Al + H2SO4 -> Al2(SO4)3 + H2', disp: 'Al + H₂SO₄ → Al₂(SO₄)₃ + H₂↑' },
  { eq: 'NH3 + O2 -> NO + H2O', disp: 'NH₃ + O₂ → NO + H₂O' },
  { eq: 'FeS2 + O2 -> Fe2O3 + SO2', disp: 'FeS₂ + O₂ → Fe₂O₃ + SO₂' },
  { eq: 'KClO3 -> KCl + O2', disp: 'KClO₃ → KCl + O₂↑' },
  { eq: 'Na + H2O -> NaOH + H2', disp: 'Na + H₂O → NaOH + H₂↑' },
  { eq: 'CH4 + O2 -> CO2 + H2O', disp: 'CH₄ + O₂ → CO₂ + H₂O' },
  { eq: 'H2S + SO2 -> S + H2O', disp: 'H₂S + SO₂ → S↓ + H₂O' },
  { eq: 'P + O2 -> P2O5', disp: 'P + O₂ → P₂O₅' },
  { eq: 'Fe2O3 + CO -> Fe + CO2', disp: 'Fe₂O₃ + CO → Fe + CO₂' },
  { eq: 'Mg + CO2 -> MgO + C', disp: 'Mg + CO₂ → MgO + C' }
];
/* 由方程式文本取各物质的规范显示式（引擎 parseFormula 的 normalized）与反应物个数。 */
function balanceSpecies(E, eq) {
  var sides = eq.split('->');
  var left = sides[0].split('+'), right = sides[1].split('+');
  var labels = [];
  for (var i = 0; i < left.length; i++) {
    labels.push(mustOk(E.parseFormula(left[i].trim()), '解析化学式').normalized);
  }
  for (var j = 0; j < right.length; j++) {
    labels.push(mustOk(E.parseFormula(right[j].trim()), '解析化学式').normalized);
  }
  return { labels: labels, nReact: left.length };
}
function renderEquation(labels, coefs, nReact) {
  function side(from, to) {
    var parts = [];
    for (var i = from; i < to; i++) parts.push((coefs[i] > 1 ? String(coefs[i]) : '') + labels[i]);
    return parts.join(' + ');
  }
  return side(0, nReact) + ' → ' + side(nReact, labels.length);
}

function genBalance(E, rng, gen) {
  var item = pick(rng, BALANCE_POOL);
  var variant = pick(rng, ['coef-single', 'coef-fill', 'full-single']);
  gen.variant = variant;
  var r = mustOk(E.balance(item.eq), '配平 ' + item.eq);
  var sp = balanceSpecies(E, item.eq);
  gen.params = { equation: item.eq, coefficients: r.coefficients, labels: sp.labels, nReact: sp.nReact };
  for (var ci = 0; ci < r.coefficients.length; ci++) {
    recordCheck(gen, 'balance', item.eq, 'coefficients.' + ci, r.coefficients[ci]);
  }
  var analysis = buildAnalysis(
    '化学方程式的配平（原子守恒）',
    '设各物质系数为未知数，按反应前后各元素原子数相等列方程组，解出最小正整数比，最后逐元素检验。',
    r.steps, null,
    '配平只能改系数，不能改化学式下标；系数要化到最简整数比；配完后必须检验左右两边各元素原子数。');
  if (variant === 'coef-single') {
    var idx = randInt(rng, 0, sp.labels.length - 1);
    var v = r.coefficients[idx];
    var stem = '配平下列化学方程式：' + item.disp + '。配平后，' + sp.labels[idx] + ' 前的化学计量数是多少？';
    return finishSingle(rng, gen,
      { topic: '物质与反应', title: '方程式配平', stem: stem, analysis: analysis, level: '巩固' },
      String(v), intDistractors(rng, v));
  }
  if (variant === 'coef-fill') {
    var idxs = shuffle(rng, range(sp.labels.length)).slice(0, 2);
    var stem2 = '配平下列化学方程式：' + item.disp + '。写出配平后指定物质前的化学计量数。';
    var parts = [];
    for (var k = 0; k < idxs.length; k++) {
      parts.push(numPart(String.fromCharCode(97 + k),
        sp.labels[idxs[k]] + ' 前的化学计量数', r.coefficients[idxs[k]], '', 'int', 2));
    }
    return finishFill(gen,
      { topic: '物质与反应', title: '方程式配平', stem: stem2, analysis: analysis, level: '巩固' }, parts);
  }
  var correct = renderEquation(sp.labels, r.coefficients, sp.nReact);
  var dTexts = [];
  for (var i = 0; i < r.coefficients.length; i++) {
    var pert = r.coefficients.slice();
    pert[i] = pert[i] + 1;
    dTexts.push(renderEquation(sp.labels, pert, sp.nReact));
    if (r.coefficients[i] > 1) {
      var pert2 = r.coefficients.slice();
      pert2[i] = pert2[i] - 1;
      dTexts.push(renderEquation(sp.labels, pert2, sp.nReact));
    }
  }
  var stem3 = '下列配平结果正确的是？原方程式：' + item.disp;
  return finishSingle(rng, gen,
    { topic: '物质与反应', title: '方程式配平', stem: stem3, analysis: analysis, level: '巩固' },
    correct, dTexts);
}

/* ============================================================================
 * 模板 3：stoich — 化学计量（定量分析 / 巩固）
 * 子型：mass-n（由质量求物质的量与某元素原子物质的量，填空 2 小题）/
 *      gas（标况气体体积 → 物质的量 → 质量，填空 2 小题）/
 *      reaction（按配平方程式求生成量，填空 2 小题或单选）
 * 答案来源：引擎 stoich()（n-mass / n-volume / reaction）与 molarMass()；
 * mass-n 的第 2 小题 n(元素)=n(物质)×每分子原子数，原子数由引擎
 * parseFormula() 解析得到，乘法一步在解析中明示。
 * ========================================================================== */
var STOICH_SOLIDS = [
  { formula: 'H2SO4', label: 'H₂SO₄', name: '硫酸', element: 'H' },
  { formula: 'NaCl', label: 'NaCl', name: '氯化钠', element: 'Na' },
  { formula: 'CaCO3', label: 'CaCO₃', name: '碳酸钙', element: 'O' },
  { formula: 'NaOH', label: 'NaOH', name: '氢氧化钠', element: 'O' },
  { formula: 'CuSO4', label: 'CuSO₄', name: '硫酸铜', element: 'O' },
  { formula: 'KNO3', label: 'KNO₃', name: '硝酸钾', element: 'O' },
  { formula: 'NH4NO3', label: 'NH₄NO₃', name: '硝酸铵', element: 'N' },
  { formula: 'C6H12O6', label: 'C₆H₁₂O₆', name: '葡萄糖', element: 'C' }
];
var STOICH_GASES = [
  { formula: 'CO2', label: 'CO₂', name: '二氧化碳' },
  { formula: 'O2', label: 'O₂', name: '氧气' },
  { formula: 'H2', label: 'H₂', name: '氢气' },
  { formula: 'N2', label: 'N₂', name: '氮气' },
  { formula: 'CH4', label: 'CH₄', name: '甲烷' },
  { formula: 'SO2', label: 'SO₂', name: '二氧化硫' },
  { formula: 'NH3', label: 'NH₃', name: '氨气' }
];
var STOICH_REACTIONS = [
  { eq: 'Fe + 2HCl -> FeCl2 + H2', disp: 'Fe + 2HCl → FeCl₂ + H₂↑', given: 'Fe', givenName: '铁', reagent: '足量稀盐酸', target: 'H2', targetLabel: 'H₂', targetName: '氢气', targetKind: 'volume' },
  { eq: 'Zn + H2SO4 -> ZnSO4 + H2', disp: 'Zn + H₂SO₄ → ZnSO₄ + H₂↑', given: 'Zn', givenName: '锌', reagent: '足量稀硫酸', target: 'H2', targetLabel: 'H₂', targetName: '氢气', targetKind: 'volume' },
  { eq: 'CaCO3 + 2HCl -> CaCl2 + CO2 + H2O', disp: 'CaCO₃ + 2HCl → CaCl₂ + CO₂↑ + H₂O', given: 'CaCO3', givenName: '碳酸钙', reagent: '足量稀盐酸', target: 'CO2', targetLabel: 'CO₂', targetName: '二氧化碳', targetKind: 'volume' },
  { eq: '2H2 + O2 -> 2H2O', disp: '2H₂ + O₂ → 2H₂O', given: 'H2', givenName: '氢气', reagent: '足量氧气', target: 'H2O', targetLabel: 'H₂O', targetName: '水', targetKind: 'mass' },
  { eq: 'C + O2 -> CO2', disp: 'C + O₂ → CO₂', given: 'C', givenName: '碳', reagent: '足量氧气', target: 'CO2', targetLabel: 'CO₂', targetName: '二氧化碳', targetKind: 'mass' },
  { eq: '2Al + 6HCl -> 2AlCl3 + 3H2', disp: '2Al + 6HCl → 2AlCl₃ + 3H₂↑', given: 'Al', givenName: '铝', reagent: '足量稀盐酸', target: 'H2', targetLabel: 'H₂', targetName: '氢气', targetKind: 'volume' },
  { eq: 'Na2CO3 + 2HCl -> 2NaCl + CO2 + H2O', disp: 'Na₂CO₃ + 2HCl → 2NaCl + CO₂↑ + H₂O', given: 'Na2CO3', givenName: '碳酸钠', reagent: '足量稀盐酸', target: 'CO2', targetLabel: 'CO₂', targetName: '二氧化碳', targetKind: 'volume' }
];

function genStoich(E, rng, gen) {
  var variant = pick(rng, ['mass-n', 'gas', 'reaction', 'reaction', 'reaction-single']);
  gen.variant = variant;
  if (variant === 'mass-n') {
    var s = pick(rng, STOICH_SOLIDS);
    var nT = pick(rng, [0.1, 0.2, 0.25, 0.5, 1, 2, 0.05]);
    var mm = mustOk(E.molarMass(s.formula), '摩尔质量');
    var mass = round6(nT * mm.value);
    var spec = { kind: 'n-mass', mass: mass, formula: s.formula };
    var r = mustOk(E.stoich(spec), '质量→物质的量');
    var pf = mustOk(E.parseFormula(s.formula), '解析化学式');
    var atomCount = pf.atoms[s.element] || 0;
    if (atomCount === 0) throw new Error('模板 stoich：元素 ' + s.element + ' 不在 ' + s.formula + ' 中');
    var nElem = round6(r.result.n * atomCount);
    gen.params = { formula: s.formula, mass: mass, element: s.element, atomCount: atomCount };
    recordCheck(gen, 'stoich', spec, 'result.n', r.result.n);
    recordCheck(gen, 'parseFormula', s.formula, 'atoms.' + s.element, atomCount);
    var stem = fmtVal(mass) + ' g ' + s.name + '（' + s.label + '）的物质的量是多少？其中 ' + s.element + ' 原子的物质的量是多少？';
    var analysis = buildAnalysis(
      '质量、物质的量与微粒数的换算',
      '先由摩尔质量把质量换算成物质的量 n=m/M，再由化学式中原子个数换算元素原子的物质的量。',
      r.steps,
      ['n(' + s.element + ') = n(' + s.label + ') × 每分子中 ' + s.element + ' 原子数 = ' + fmtVal(r.result.n) + ' × ' + atomCount + ' = ' + fmtVal(nElem) + ' mol（原子数由引擎 parseFormula 解析得到）。'],
      '摩尔质量的单位是 g/mol，数值上等于相对分子质量；求元素原子物质的量时别忘了乘化学式中该原子的个数。');
    return finishFill(gen,
      { topic: '定量分析', title: '质量与物质的量的换算', stem: stem, analysis: analysis, level: '巩固' },
      [numPart('a', s.label + ' 的物质的量', r.result.n, 'mol'),
       numPart('b', s.element + ' 原子的物质的量', nElem, 'mol')]);
  }
  if (variant === 'gas') {
    var g = pick(rng, STOICH_GASES);
    var vol = pick(rng, [2.24, 4.48, 5.6, 6.72, 8.96, 11.2, 22.4]);
    var spec1 = { kind: 'n-volume', volume: vol };
    var r1 = mustOk(E.stoich(spec1), '气体体积→物质的量');
    var spec2 = { kind: 'n-mass', n: r1.result.n, formula: g.formula };
    var r2 = mustOk(E.stoich(spec2), '物质的量→质量');
    gen.params = { formula: g.formula, volume: vol };
    recordCheck(gen, 'stoich', spec1, 'result.n', r1.result.n);
    recordCheck(gen, 'stoich', spec2, 'result.mass', r2.result.mass);
    var stemG = '标准状况下 ' + fmtVal(vol) + ' L ' + g.name + '（' + g.label + '）的物质的量是多少？质量是多少？（气体摩尔体积 Vm=22.4 L/mol）';
    var analysisG = buildAnalysis(
      '气体摩尔体积与质量的换算',
      '标准状况下先由 V=n·Vm 求物质的量，再由 m=n·M 求质量。',
      r1.steps.concat(r2.steps), null,
      '22.4 L/mol 只适用于标准状况（0℃、101 kPa）下的气体，液体和固体不能用；体积单位注意 L 与 mL 的换算。');
    return finishFill(gen,
      { topic: '定量分析', title: '气体体积与质量的换算', stem: stemG, analysis: analysisG, level: '巩固' },
      [numPart('a', g.label + ' 的物质的量', r1.result.n, 'mol'),
       numPart('b', g.label + ' 的质量', r2.result.mass, 'g')]);
  }
  var rx = pick(rng, STOICH_REACTIONS);
  var nG = pick(rng, [0.1, 0.2, 0.5, 1]);
  var mmG = mustOk(E.molarMass(rx.given), '摩尔质量');
  var massG = round6(nG * mmG.value);
  var specR = { kind: 'reaction', equation: rx.eq, given: [{ formula: rx.given, mass: massG }], target: rx.target };
  var rr = mustOk(E.stoich(specR), '按方程式计算');
  var isVol = rx.targetKind === 'volume';
  var targetVal = isVol ? rr.result.targetVolume : rr.result.targetMass;
  var targetUnit = isVol ? 'L' : 'g';
  var targetWord = isVol ? '标准状况下的体积' : '质量';
  gen.params = { equation: rx.eq, given: rx.given, givenMass: massG, target: rx.target, targetKind: rx.targetKind };
  recordCheck(gen, 'stoich', specR, 'result.targetMol', rr.result.targetMol);
  recordCheck(gen, 'stoich', specR, isVol ? 'result.targetVolume' : 'result.targetMass', targetVal);
  var stemR = fmtVal(massG) + ' g ' + rx.givenName + '与' + rx.reagent + '完全反应（方程式：' + rx.disp + '）。';
  var analysisR = buildAnalysis(
    '按化学方程式的化学计量计算',
    '先把已知质量换算成物质的量，再按配平后的计量系数比求生成物的物质的量，最后换算成' + targetWord + '。',
    rr.steps, null,
    '必须先配平方程式再按系数比计算，不能按 1∶1 想当然；气体体积须确认是标准状况才能用 22.4 L/mol。');
  if (variant === 'reaction-single') {
    var mmT = mustOk(E.molarMass(rx.target), '目标物质摩尔质量');
    var wrongRatio = isVol ? nG * 22.4 : nG * mmT.value; /* 忽略系数比、按 1∶1 算的典型错误 */
    var ds = numDistractors(rng, targetVal, fmtVal, ' ' + targetUnit,
      [wrongRatio, targetVal * 2, targetVal / 2, massG]);
    return finishSingle(rng, gen,
      { topic: '定量分析', title: '按方程式求生成量', stem: stemR + '生成' + rx.targetName + '（' + rx.targetLabel + '）的' + targetWord + '是多少？', analysis: analysisR, level: '巩固' },
      fmtVal(targetVal) + ' ' + targetUnit, ds);
  }
  return finishFill(gen,
    { topic: '定量分析', title: '按方程式求生成量', stem: stemR + '求生成' + rx.targetName + '（' + rx.targetLabel + '）的物质的量与' + targetWord + '。', analysis: analysisR, level: '巩固' },
    [numPart('a', rx.targetLabel + ' 的物质的量', rr.result.targetMol, 'mol'),
     numPart('b', rx.targetLabel + ' 的' + targetWord, targetVal, targetUnit)]);
}

/* ============================================================================
 * 模板 4：solution — 溶液配制与稀释（定量分析 / 巩固）
 * 子型：prepare（由浓度与体积求溶质物质的量与质量，填空 2 小题或单选）/
 *      dilute（稀释后浓度与取样物质的量，填空 2 小题）/
 *      from-conc（由浓溶液配制稀溶液：需溶质物质的量与浓溶液体积，填空 2 小题）
 * 答案来源：引擎 stoich/molarity、stoich/n-mass 与 conserve/dilution。
 * ========================================================================== */
var SOL_SOLUTES = [
  { formula: 'NaCl', label: 'NaCl', name: '氯化钠' },
  { formula: 'NaOH', label: 'NaOH', name: '氢氧化钠' },
  { formula: 'CuSO4', label: 'CuSO₄', name: '硫酸铜' },
  { formula: 'Na2CO3', label: 'Na₂CO₃', name: '碳酸钠' },
  { formula: 'KNO3', label: 'KNO₃', name: '硝酸钾' },
  { formula: 'NH4Cl', label: 'NH₄Cl', name: '氯化铵' },
  { formula: 'CuSO4·5H2O', label: 'CuSO₄·5H₂O', name: '胆矾' }
];

function genSolution(E, rng, gen) {
  var variant = pick(rng, ['prepare', 'prepare-single', 'dilute', 'from-conc']);
  gen.variant = variant;
  if (variant === 'prepare' || variant === 'prepare-single') {
    var s = pick(rng, SOL_SOLUTES);
    var vMl = pick(rng, [100, 250, 500, 1000]);
    var c = pick(rng, [0.1, 0.2, 0.25, 0.5, 1.0]);
    var spec1 = { kind: 'molarity', c: c, volume: vMl / 1000 };
    var r1 = mustOk(E.stoich(spec1), '浓度→物质的量');
    var spec2 = { kind: 'n-mass', n: r1.result.n, formula: s.formula };
    var r2 = mustOk(E.stoich(spec2), '物质的量→质量');
    gen.params = { formula: s.formula, volumeMl: vMl, c: c };
    recordCheck(gen, 'stoich', spec1, 'result.n', r1.result.n);
    recordCheck(gen, 'stoich', spec2, 'result.mass', r2.result.mass);
    var stem = '用 ' + s.name + '（' + s.label + '）固体配制 ' + vMl + ' mL、' + fmtConc(c) + ' mol/L 的溶液，需要 ' + s.name + ' 的物质的量与质量各是多少？';
    var analysis = buildAnalysis(
      '一定物质的量浓度溶液的配制计算',
      '先由 n=cV 求所需溶质的物质的量，再由 m=nM 求需称取的质量。',
      r1.steps.concat(r2.steps), null,
      '体积须换算成 L 再代入 n=cV；用胆矾配制硫酸铜溶液时摩尔质量按 CuSO₄·5H₂O（250 g/mol）算，不能按无水 CuSO₄ 算。');
    if (variant === 'prepare-single') {
      var ds = numDistractors(rng, r2.result.mass, fmtVal, ' g',
        [r2.result.mass * 2, r2.result.mass / 2, r1.result.n, r2.result.mass * 1000]);
      return finishSingle(rng, gen,
        { topic: '定量分析', title: '配制溶液需称取的质量', stem: '用 ' + s.name + '（' + s.label + '）固体配制 ' + vMl + ' mL、' + fmtConc(c) + ' mol/L 的溶液，需要称取 ' + s.name + ' 的质量是多少？', analysis: analysis, level: '巩固' },
        fmtVal(r2.result.mass) + ' g', ds);
    }
    return finishFill(gen,
      { topic: '定量分析', title: '配制溶液的计算', stem: stem, analysis: analysis, level: '巩固' },
      [numPart('a', '需 ' + s.label + ' 的物质的量', r1.result.n, 'mol'),
       numPart('b', '需称取 ' + s.label + ' 的质量', r2.result.mass, 'g')]);
  }
  if (variant === 'dilute') {
    var sd = pick(rng, SOL_SOLUTES.slice(0, 6));
    var c1 = pick(rng, [0.5, 1.0, 2.0, 0.2]);
    var v1 = pick(rng, [20, 25, 50, 100]);
    var v2cands = [100, 250, 500, 1000].filter(function (v) { return v > v1; });
    var v2 = pick(rng, v2cands);
    var v3 = pick(rng, [10, 20, 25]);
    var dSpec = { template: 'dilution', c1: c1, v1: v1, v2: v2 };
    var dRes = mustOk(E.conserve(dSpec), '稀释守恒');
    var mSpec = { kind: 'molarity', c: dRes.result.c2, volume: v3 / 1000 };
    var mRes = mustOk(E.stoich(mSpec), '取样物质的量');
    gen.params = { formula: sd.formula, c1: c1, v1: v1, v2: v2, v3: v3 };
    recordCheck(gen, 'conserve', dSpec, 'result.c2', dRes.result.c2);
    recordCheck(gen, 'stoich', mSpec, 'result.n', mRes.result.n);
    var stemD = '将 ' + v1 + ' mL、' + fmtConc(c1) + ' mol/L 的 ' + sd.name + ' 溶液加水稀释至 ' + v2 +
      ' mL，再从中取出 ' + v3 + ' mL。求稀释后溶液的浓度，以及取出的 ' + v3 + ' mL 溶液中溶质的物质的量。';
    var analysisD = buildAnalysis(
      '溶液的稀释与取样',
      '稀释前后溶质物质的量不变（c₁V₁=c₂V₂），先求稀释后浓度；溶液是均匀的，取出部分与整体浓度相同，再由 n=cV 求取样中的溶质物质的量。',
      dRes.steps.concat(mRes.steps), null,
      '稀释后体积是加水后的总体积，不是加入水的体积；取样不改变浓度，但取出的溶质物质的量要按取出的体积算。');
    return finishFill(gen,
      { topic: '定量分析', title: '稀释与取样', stem: stemD, analysis: analysisD, level: '巩固' },
      [numPart('a', '稀释后溶液的浓度', dRes.result.c2, 'mol/L'),
       numPart('b', '取出的溶液中溶质的物质的量', mRes.result.n, 'mol')]);
  }
  var sc = pick(rng, SOL_SOLUTES.slice(0, 6));
  var c1c = pick(rng, [2, 5, 10, 1]);
  var c2c = pick(rng, [0.1, 0.2, 0.5]);
  var v2ml = pick(rng, [250, 500, 1000]);
  var specA = { kind: 'molarity', c: c2c, volume: v2ml / 1000 };
  var rA = mustOk(E.stoich(specA), '目标物质的量');
  var specB = { kind: 'molarity', n: rA.result.n, c: c1c };
  var rB = mustOk(E.stoich(specB), '浓溶液体积');
  var v1ml = round6(rB.result.volume * 1000);
  gen.params = { formula: sc.formula, c1: c1c, c2: c2c, v2ml: v2ml };
  recordCheck(gen, 'stoich', specA, 'result.n', rA.result.n);
  recordCheck(gen, 'stoich', specB, 'result.volume', rB.result.volume);
  var stemC = '实验室有 ' + fmtConc(c1c) + ' mol/L 的 ' + sc.name + ' 浓溶液，现要配制 ' + v2ml + ' mL、' +
    fmtConc(c2c) + ' mol/L 的稀溶液。需要溶质的物质的量是多少？应量取浓溶液多少毫升？（忽略混合体积变化）';
  var analysisC = buildAnalysis(
    '由浓溶液稀释配制稀溶液',
    '先由目标浓度与体积求所需溶质的物质的量 n=c₂V₂，再由 V₁=n/c₁ 求需量取的浓溶液体积。',
    rA.steps.concat(rB.steps),
    ['体积单位换算：V₁ = ' + fmtVal(rB.result.volume) + ' L = ' + fmtVal(v1ml) + ' mL。'],
    '稀释前后溶质物质的量不变；量取浓溶液的体积要用浓溶液的浓度去除，不能用稀溶液的浓度。');
  return finishFill(gen,
    { topic: '定量分析', title: '由浓溶液配制稀溶液', stem: stemC, analysis: analysisC, level: '巩固' },
    [numPart('a', '需要溶质的物质的量', rA.result.n, 'mol'),
     numPart('b', '应量取浓溶液的体积', v1ml, 'mL')]);
}

/* ============================================================================
 * 模板 5：titration — 滴定计算（定量分析 / 综合）
 * 子型：fill-avg（三组平行读数：平均体积 + 标准溶质物质的量 + 待测浓度，
 *      填空 3 小题）/ fill-single（单次读数，填空 2 小题）/ choice（待测浓度，单选）
 * 答案来源：引擎原语组合（推导链见模块头）：balance() 取系数比；
 * stoich/molarity 求 n(标准溶质) 与 c(待测)。平行读数的平均值是纯算术平均。
 * ========================================================================== */
var TITR_POOL = [
  { std: 'NaOH', stdName: '氢氧化钠', analyte: 'HCl', anName: '盐酸', eq: 'NaOH + HCl -> NaCl + H2O', disp: 'NaOH + HCl → NaCl + H₂O' },
  { std: 'NaOH', stdName: '氢氧化钠', analyte: 'H2SO4', anName: '硫酸', eq: '2NaOH + H2SO4 -> Na2SO4 + 2H2O', disp: '2NaOH + H₂SO₄ → Na₂SO₄ + 2H₂O' },
  { std: 'HCl', stdName: '盐酸', analyte: 'NaOH', anName: '氢氧化钠', eq: 'HCl + NaOH -> NaCl + H2O', disp: 'HCl + NaOH → NaCl + H₂O' },
  { std: 'H2SO4', stdName: '硫酸', analyte: 'NaOH', anName: '氢氧化钠', eq: 'H2SO4 + 2NaOH -> Na2SO4 + 2H2O', disp: 'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O' }
];
/* 平行读数抖动（和为 0，保证平均值恰好等于基准体积）。 */
var TITR_JITTERS = [[0.02, -0.02, 0], [0.04, -0.02, -0.02], [-0.04, 0.02, 0.02], [0.02, 0.02, -0.04], [0, 0.02, -0.02]];

function genTitration(E, rng, gen) {
  var t = pick(rng, TITR_POOL);
  var variant = pick(rng, ['fill-avg', 'fill-single', 'choice']);
  gen.variant = variant;
  var cStd = pick(rng, [0.1, 0.2, 0.05, 0.15]);
  var vAnMl = pick(rng, [20.00, 25.00]);
  var vBase = pick(rng, [20.00, 22.50, 24.80, 25.00, 26.40, 28.00, 30.00]);
  var readings, vAvgMl;
  if (variant === 'fill-avg') {
    var jit = pick(rng, TITR_JITTERS);
    readings = jit.map(function (d) { return round6(vBase + d); });
    vAvgMl = round6((readings[0] + readings[1] + readings[2]) / 3);
  } else {
    readings = [vBase];
    vAvgMl = vBase;
  }
  var bal = mustOk(E.balance(t.eq), '滴定反应配平');
  var ratio = bal.coefficients[1] / bal.coefficients[0]; /* n(待测)/n(标准) */
  var specStd = { kind: 'molarity', c: cStd, volume: vAvgMl / 1000 };
  var mStd = mustOk(E.stoich(specStd), '标准液溶质物质的量');
  /* 注意：nAn 是中间量，直接传给下一步引擎调用，不做 round6 舍入——
     对小数值（如 0.0005625 mol）舍入会引入约 0.09% 的误差并传导到最终浓度。 */
  var nAn = mStd.result.n * ratio;
  var specAn = { kind: 'molarity', n: nAn, volume: vAnMl / 1000 };
  var mAn = mustOk(E.stoich(specAn), '待测液浓度');
  gen.params = { std: t.std, analyte: t.analyte, equation: t.eq, coefficients: bal.coefficients,
    cStd: cStd, vAnMl: vAnMl, readings: readings, ratio: ratio };
  recordCheck(gen, 'balance', t.eq, 'coefficients.0', bal.coefficients[0]);
  recordCheck(gen, 'balance', t.eq, 'coefficients.1', bal.coefficients[1]);
  recordCheck(gen, 'stoich', specStd, 'result.n', mStd.result.n);
  recordCheck(gen, 'stoich', specAn, 'result.c', mAn.result.c);
  var chainStep = '推导链：① 引擎 balance() 配平 ' + t.disp + '，得 n(' + t.analyte + ')/n(' + t.std + ')=' +
    bal.coefficients[1] + '/' + bal.coefficients[0] + '；② 引擎 stoich/molarity 求 n(' + t.std + ')；③ 按系数比求 n(' + t.analyte + ')；④ 引擎 stoich/molarity 求 c(' + t.analyte + ')=n/V。';
  var analysis = buildAnalysis(
    '酸碱中和滴定的定量计算',
    '先求标准溶液的平均消耗体积与溶质物质的量，再按配平后的计量系数比求待测溶质的物质的量，最后由 c=n/V 求待测液浓度。',
    bal.steps.concat(mStd.steps, mAn.steps), [chainStep],
    '体积须换算成 L 再代入 n=cV；H₂SO₄ 与 NaOH 的系数比是 1∶2，不能按 1∶1 算；平行测定取平均值前应舍弃明显偏离的数据（本题三组数据均有效）。');
  var stemHead = '用 ' + fmtConc(cStd) + ' mol/L ' + t.stdName + '标准溶液滴定 ' + fmtMl(vAnMl) + ' mL 未知浓度的' + t.anName + '（反应：' + t.disp + '）。';
  if (variant === 'fill-avg') {
    var stemA = stemHead + '三次消耗标准溶液的体积分别为 ' +
      readings.map(fmtMl).join('、') + ' mL。求平均消耗体积、消耗标准溶质的物质的量与待测液的浓度。';
    return finishFill(gen,
      { topic: '定量分析', title: '酸碱滴定计算', stem: stemA, analysis: analysis, level: '综合' },
      [numPart('a', '三次平均消耗标准溶液的体积', vAvgMl, 'mL'),
       numPart('b', '消耗 ' + t.std + ' 的物质的量', mStd.result.n, 'mol'),
       numPart('c', '待测' + t.anName + '的浓度', mAn.result.c, 'mol/L')]);
  }
  if (variant === 'fill-single') {
    var stemB = stemHead + '恰好完全反应时消耗标准溶液 ' + fmtMl(vBase) + ' mL。求消耗标准溶质的物质的量与待测液的浓度。';
    return finishFill(gen,
      { topic: '定量分析', title: '酸碱滴定计算', stem: stemB, analysis: analysis, level: '综合' },
      [numPart('a', '消耗 ' + t.std + ' 的物质的量', mStd.result.n, 'mol'),
       numPart('b', '待测' + t.anName + '的浓度', mAn.result.c, 'mol/L')]);
  }
  var stemC = stemHead + '恰好完全反应时消耗标准溶液 ' + fmtMl(vBase) + ' mL。待测' + t.anName + '的浓度是多少？';
  var ds = numDistractors(rng, mAn.result.c, fmtConc, ' mol/L',
    [mAn.result.c * 2, mAn.result.c / 2, cStd, mAn.result.c * 10, mAn.result.c * (vAnMl / vAvgMl)]);
  return finishSingle(rng, gen,
    { topic: '定量分析', title: '酸碱滴定计算', stem: stemC, analysis: analysis, level: '综合' },
    fmtConc(mAn.result.c) + ' mol/L', ds);
}

/* ============================================================================
 * 模板 6：kc — 平衡常数 Kc（反应原理 / 综合）
 * 子型：fill-2（平衡浓度 + Kc，填空 2 小题）/ fill-3（转化率 + 平衡浓度
 *      + Kc，填空 3 小题）/ choice（Kc，单选）
 * 答案来源：引擎原语组合（推导链见模块头）：balance() 取计量系数；
 * stoich/molarity 求各平衡浓度；Kc 按定义式代入引擎结果求得。
 * 题设保证：各平衡物质的量 > 0.005 mol，Kc 落在 10⁻³–10³ 内（不满足则
 * 按种子顺序重抽参数，最多 8 次；仍不满足则抛错，不出偏题）。
 * ========================================================================== */
var KC_POOL = [
  { eq: 'N2O4 -> NO2', disp: 'N₂O₄(g) ⇌ 2NO₂(g)',
    reactants: [{ f: 'N2O4', label: 'N₂O₄' }], products: [{ f: 'NO2', label: 'NO₂' }],
    initSets: [[1.0], [2.0], [0.5]], fracs: [0.2, 0.3, 0.4, 0.5, 0.6], vols: [1, 2, 5] },
  { eq: 'SO2 + O2 -> SO3', disp: '2SO₂(g) + O₂(g) ⇌ 2SO₃(g)',
    reactants: [{ f: 'SO2', label: 'SO₂' }, { f: 'O2', label: 'O₂' }], products: [{ f: 'SO3', label: 'SO₃' }],
    initSets: [[2.0, 1.0], [4.0, 2.0], [1.0, 0.5]], fracs: [0.3, 0.4, 0.5, 0.6], vols: [1, 2, 5] },
  { eq: 'H2 + I2 -> HI', disp: 'H₂(g) + I₂(g) ⇌ 2HI(g)',
    reactants: [{ f: 'H2', label: 'H₂' }, { f: 'I2', label: 'I₂' }], products: [{ f: 'HI', label: 'HI' }],
    initSets: [[1.0, 1.0], [2.0, 2.0], [0.5, 0.5]], fracs: [0.4, 0.5, 0.6, 0.7, 0.8], vols: [1, 2] },
  { eq: 'N2 + H2 -> NH3', disp: 'N₂(g) + 3H₂(g) ⇌ 2NH₃(g)',
    reactants: [{ f: 'N2', label: 'N₂' }, { f: 'H2', label: 'H₂' }], products: [{ f: 'NH3', label: 'NH₃' }],
    initSets: [[1.0, 3.0], [2.0, 6.0], [0.5, 1.5]], fracs: [0.2, 0.3, 0.4, 0.5], vols: [1, 2, 5] },
  { eq: 'CO + H2O -> CO2 + H2', disp: 'CO(g) + H₂O(g) ⇌ CO₂(g) + H₂(g)',
    reactants: [{ f: 'CO', label: 'CO' }, { f: 'H2O', label: 'H₂O' }], products: [{ f: 'CO2', label: 'CO₂' }, { f: 'H2', label: 'H₂' }],
    initSets: [[1.0, 1.0], [2.0, 2.0]], fracs: [0.2, 0.3, 0.4, 0.5, 0.6], vols: [1, 2, 5] }
];
/* Kc 表达式的一项：c^ν(物种)，ν=1 时不写指数。 */
function kcTerm(label, coef) {
  return 'c' + (coef > 1 ? supNum(coef) : '') + '(' + label + ')';
}

function genKc(E, rng, gen) {
  var rx = pick(rng, KC_POOL);
  var variant = pick(rng, ['fill-2', 'fill-3', 'choice']);
  gen.variant = variant;
  var bal = mustOk(E.balance(rx.eq), '平衡反应配平');
  var coefs = bal.coefficients; /* 与方程式中物质出现顺序一致：先反应物后生成物 */
  var nR = rx.reactants.length;
  var nAll = nR + rx.products.length;
  var attempt = null;
  for (var t = 0; t < 8 && !attempt; t++) {
    var init = pick(rng, rx.initSets);
    var frac = pick(rng, rx.fracs);
    var V = pick(rng, rx.vols);
    var limiting = Infinity;
    for (var i = 0; i < nR; i++) limiting = Math.min(limiting, init[i] / coefs[i]);
    /* x 与 nEq 是中间量，不做舍入（舍入误差会传导到浓度与 Kc）；显示时由 fmtVal 处理。 */
    var x = limiting * frac;
    var nEq = [];
    for (var j = 0; j < nR; j++) nEq.push(init[j] - coefs[j] * x);
    for (var k = 0; k < rx.products.length; k++) nEq.push(coefs[nR + k] * x);
    var okAmt = true;
    for (var m = 0; m < nAll; m++) if (!(nEq[m] > 0.005)) okAmt = false;
    if (!okAmt) continue;
    var kcNum = 1, kcDen = 1;
    for (var p = 0; p < rx.products.length; p++) kcNum *= Math.pow(nEq[nR + p] / V, coefs[nR + p]);
    for (var q = 0; q < nR; q++) kcDen *= Math.pow(nEq[q] / V, coefs[q]);
    var kc = kcNum / kcDen;
    if (!(kc >= 1e-3 && kc <= 1e3) || !isFinite(kc)) continue;
    attempt = { init: init, frac: frac, V: V, x: x, nEq: nEq, kc: kc };
  }
  if (!attempt) throw new Error('模板 kc：8 次抽取均未得到合理的平衡组成，请换一个种子重试');
  /* 各平衡浓度走引擎 stoich/molarity（c=n/V）逐个算出。 */
  var labels = [];
  for (var a = 0; a < nR; a++) labels.push(rx.reactants[a].label);
  for (var b = 0; b < rx.products.length; b++) labels.push(rx.products[b].label);
  var concs = [], molSteps = [];
  for (var s = 0; s < nAll; s++) {
    var spec = { kind: 'molarity', n: attempt.nEq[s], volume: attempt.V };
    var mr = mustOk(E.stoich(spec), '平衡浓度');
    concs.push(mr.result.c);
    molSteps.push({ title: '求平衡时 ' + labels[s] + ' 的浓度', detail: mr.steps[mr.steps.length - 1].detail });
    recordCheck(gen, 'stoich', spec, 'result.c', mr.result.c);
  }
  /* Kc 按定义式代入引擎算出的浓度与系数（最后一步为定义式代数代入）。 */
  var num = 1, den = 1;
  for (var p2 = 0; p2 < rx.products.length; p2++) num *= Math.pow(concs[nR + p2], coefs[nR + p2]);
  for (var q2 = 0; q2 < nR; q2++) den *= Math.pow(concs[q2], coefs[q2]);
  var kcVal = Math.round((num / den) * 1e4) / 1e4;
  for (var ci = 0; ci < coefs.length; ci++) recordCheck(gen, 'balance', rx.eq, 'coefficients.' + ci, coefs[ci]);
  gen.params = { equation: rx.eq, V: attempt.V, init: attempt.init, frac: attempt.frac,
    extent: attempt.x, coefficients: coefs, nEq: attempt.nEq, concs: concs, kc: kcVal };
  var givenIdx = randInt(rng, 0, nAll - 1);
  var initText = [];
  for (var i2 = 0; i2 < nR; i2++) initText.push(labels[i2] + ' ' + fmtVal(attempt.init[i2]) + ' mol');
  var stem = '恒温、' + attempt.V + ' L 恒容密闭容器中发生反应 ' + rx.disp + '。起始投入 ' +
    initText.join('、') + '，达到平衡时 ' + labels[givenIdx] + ' 的物质的量为 ' + fmtVal(attempt.nEq[givenIdx]) +
    ' mol。Kc 按 mol/L 代入。';
  var startLine = [], changeLine = [], eqLine = [];
  for (var i3 = 0; i3 < nAll; i3++) {
    var n0 = i3 < nR ? attempt.init[i3] : 0;
    var ch = coefs[i3] * attempt.x; /* 转化量 = 计量系数 × 反应进度（反应物与生成物同式） */
    startLine.push(labels[i3] + ' ' + fmtVal(n0));
    changeLine.push(labels[i3] + ' ' + fmtVal(round6(ch)));
    eqLine.push(labels[i3] + ' ' + fmtVal(attempt.nEq[i3]));
  }
  var numStr = [], denStr = [];
  for (var p3 = 0; p3 < rx.products.length; p3++) numStr.push(kcTerm(rx.products[p3].label, coefs[nR + p3]));
  for (var q3 = 0; q3 < nR; q3++) denStr.push(kcTerm(rx.reactants[q3].label, coefs[q3]));
  var subNum = [], subDen = [];
  for (var p4 = 0; p4 < rx.products.length; p4++) {
    subNum.push(fmtVal(concs[nR + p4]) + (coefs[nR + p4] > 1 ? supNum(coefs[nR + p4]) : ''));
  }
  for (var q4 = 0; q4 < nR; q4++) {
    subDen.push(fmtVal(concs[q4]) + (coefs[q4] > 1 ? supNum(coefs[q4]) : ''));
  }
  var extra = [
    '三段式（物质的量，mol）：起始——' + startLine.join('，') + '；转化——' + changeLine.join('，') + '；平衡——' + eqLine.join('，') + '。',
    'Kc 表达式：Kc = ' + numStr.join('·') + ' / (' + denStr.join('·') + ') = ' + subNum.join(' × ') + ' / (' + subDen.join(' × ') + ') = ' + fmtVal(kcVal) + '。',
    '推导链：计量系数来自引擎 balance()；各平衡浓度来自引擎 stoich/molarity（c=n/V）；Kc 由定义式代入引擎结果求得。'
  ];
  var analysis = buildAnalysis(
    '化学平衡常数 Kc 的计算',
    '先用三段式由已知平衡量求出各物质的平衡物质的量，再换算成平衡浓度，最后按 Kc 定义式代入（生成物浓度幂之积除以反应物浓度幂之积）。',
    bal.steps.concat(molSteps), extra,
    'Kc 只与温度有关；表达式中固体、纯液体不写入（本题全为气体）；浓度须用平衡浓度，不是起始浓度；系数要作指数，不能漏写或写成系数相乘。');
  var prod0 = rx.products[0].label;
  var rate0 = Math.round((attempt.init[0] - attempt.nEq[0]) / attempt.init[0] * 1000) / 10;
  if (variant === 'fill-2') {
    return finishFill(gen,
      { topic: '反应原理', title: '平衡常数 Kc 的计算', stem: stem + '求平衡时 ' + prod0 + ' 的浓度与该温度下的 Kc。', analysis: analysis, level: '综合' },
      [numPart('a', '平衡时 ' + prod0 + ' 的浓度', concs[nR], 'mol/L'),
       numPart('b', '该温度下的 Kc', kcVal, '')]);
  }
  if (variant === 'fill-3') {
    return finishFill(gen,
      { topic: '反应原理', title: '转化率与平衡常数', stem: stem + '求 ' + rx.reactants[0].label + ' 的转化率、平衡时 ' + prod0 + ' 的浓度与该温度下的 Kc。', analysis: analysis, level: '综合' },
      [numPart('a', rx.reactants[0].label + ' 的转化率（填百分数数值，如 60 表示 60%）', rate0, '%'),
       numPart('b', '平衡时 ' + prod0 + ' 的浓度', concs[nR], 'mol/L'),
       numPart('c', '该温度下的 Kc', kcVal, '')]);
  }
  var kcMolNum = 1, kcMolDen = 1, kcNoExpNum = 1, kcNoExpDen = 1;
  for (var p5 = 0; p5 < rx.products.length; p5++) {
    kcMolNum *= Math.pow(attempt.nEq[nR + p5], coefs[nR + p5]);
    kcNoExpNum *= concs[nR + p5];
  }
  for (var q5 = 0; q5 < nR; q5++) {
    kcMolDen *= Math.pow(attempt.nEq[q5], coefs[q5]);
    kcNoExpDen *= concs[q5];
  }
  var ds = numDistractors(rng, kcVal, fmtVal, '',
    [1 / kcVal, kcMolNum / kcMolDen, kcNoExpNum / kcNoExpDen, kcVal * attempt.V, kcVal / attempt.V]);
  return finishSingle(rng, gen,
    { topic: '反应原理', title: '平衡常数 Kc 的计算', stem: stem + '该温度下的 Kc 约为多少？', analysis: analysis, level: '综合' },
    fmtVal(kcVal), ds);
}

/* ============================================================================
 * 模板 7：redox — 氧化还原电子转移（物质与反应 / 巩固）
 * 子型：ox-known（已知氧化剂求还原剂，填空 2 小题）/
 *      rd-known（已知还原剂求氧化剂，填空 2 小题）/
 *      choice（转移电子物质的量，单选）
 * 答案来源：引擎 conserve/redox-electron（电子守恒）求未知物质的量；
 * 转移电子总量 = 已知物质的量 × 每分子得失电子数，并与引擎解出的未知量
 * × 其电子数交叉检验，不一致时抛错。
 * ========================================================================== */
var REDOX_POOL = [
  { ox: { f: 'MnO4-', label: 'MnO₄⁻', name: '高锰酸根离子', e: 5, change: 'Mn 由 +7 价降至 +2 价' },
    rd: { f: 'Fe2+', label: 'Fe²⁺', name: '亚铁离子', e: 1, change: 'Fe 由 +2 价升至 +3 价' },
    note: '酸性条件下，MnO₄⁻ 把 Fe²⁺ 氧化为 Fe³⁺，自身被还原为 Mn²⁺。' },
  { ox: { f: 'Cr2O7^2-', label: 'Cr₂O₇²⁻', name: '重铬酸根离子', e: 6, change: 'Cr 由 +6 价降至 +3 价（每摩尔 Cr₂O₇²⁻ 含 2 个 Cr）' },
    rd: { f: 'Fe2+', label: 'Fe²⁺', name: '亚铁离子', e: 1, change: 'Fe 由 +2 价升至 +3 价' },
    note: '酸性条件下，Cr₂O₇²⁻ 把 Fe²⁺ 氧化为 Fe³⁺，自身被还原为 Cr³⁺。' },
  { ox: { f: 'Cl2', label: 'Cl₂', name: '氯气', e: 2, change: 'Cl 由 0 价降至 −1 价' },
    rd: { f: 'Fe', label: 'Fe', name: '铁', e: 3, change: 'Fe 由 0 价升至 +3 价' },
    note: '铁在氯气中燃烧生成 FeCl₃。' },
  { ox: { f: 'O2', label: 'O₂', name: '氧气', e: 4, change: 'O 由 0 价降至 −2 价' },
    rd: { f: 'Mg', label: 'Mg', name: '镁', e: 2, change: 'Mg 由 0 价升至 +2 价' },
    note: '镁在氧气中燃烧生成 MgO。' },
  { ox: { f: 'Cu2+', label: 'Cu²⁺', name: '铜离子', e: 2, change: 'Cu 由 +2 价降至 0 价' },
    rd: { f: 'Zn', label: 'Zn', name: '锌', e: 2, change: 'Zn 由 0 价升至 +2 价' },
    note: '锌片插入硫酸铜溶液中，Zn 置换出 Cu。' },
  { ox: { f: 'Ag+', label: 'Ag⁺', name: '银离子', e: 1, change: 'Ag 由 +1 价降至 0 价' },
    rd: { f: 'Cu', label: 'Cu', name: '铜', e: 2, change: 'Cu 由 0 价升至 +2 价' },
    note: '铜丝插入硝酸银溶液中，Cu 置换出 Ag。' },
  { ox: { f: 'HNO3', label: 'HNO₃', name: '硝酸', e: 3, change: 'N 由 +5 价降至 +2 价（生成 NO）' },
    rd: { f: 'Cu', label: 'Cu', name: '铜', e: 2, change: 'Cu 由 0 价升至 +2 价' },
    note: '铜与稀硝酸反应生成 NO。' },
  { ox: { f: 'H2SO4', label: 'H₂SO₄', name: '浓硫酸', e: 2, change: 'S 由 +6 价降至 +4 价（生成 SO₂）' },
    rd: { f: 'C', label: 'C', name: '碳', e: 4, change: 'C 由 0 价升至 +4 价（生成 CO₂）' },
    note: '碳与浓硫酸共热生成 CO₂ 和 SO₂。' }
];
var REDOX_MOLS = [0.02, 0.05, 0.1, 0.2, 0.3, 0.5];

function genRedox(E, rng, gen) {
  var pair = pick(rng, REDOX_POOL);
  var variant = pick(rng, ['ox-known', 'rd-known', 'choice']);
  gen.variant = variant;
  var knownIsOx = variant !== 'rd-known';
  var known = knownIsOx ? pair.ox : pair.rd;
  var other = knownIsOx ? pair.rd : pair.ox;
  /* 选一个使未知量数值干净（至多 4 位小数）的已知量；都没有时取第一个。 */
  var start = randInt(rng, 0, REDOX_MOLS.length - 1);
  var knownMol = REDOX_MOLS[start];
  for (var i = 0; i < REDOX_MOLS.length; i++) {
    var cand = REDOX_MOLS[(start + i) % REDOX_MOLS.length];
    var u = cand * known.e / other.e;
    if (Math.abs(u * 1e4 - Math.round(u * 1e4)) < 1e-6) { knownMol = cand; break; }
  }
  var spec = {
    template: 'redox-electron',
    oxidants: [{ formula: pair.ox.f, electrons: pair.ox.e, mol: knownIsOx ? knownMol : 'x' }],
    reductants: [{ formula: pair.rd.f, electrons: pair.rd.e, mol: knownIsOx ? 'x' : knownMol }]
  };
  var r = mustOk(E.conserve(spec), '电子守恒');
  if (!r.solution || !isFinite(r.solution.mol)) throw new Error('引擎电子守恒未返回唯一解');
  var unknownMol = r.solution.mol;
  var eTrans = round6(knownMol * known.e);
  if (Math.abs(unknownMol * other.e - eTrans) > 1e-5 * Math.max(1, eTrans)) {
    throw new Error('电子守恒交叉检验失败：氧化剂得电子与还原剂失电子不一致');
  }
  gen.params = { oxidant: pair.ox.f, reductant: pair.rd.f, knownIsOx: knownIsOx,
    knownMol: knownMol, knownE: known.e, otherE: other.e, unknownMol: unknownMol, eTrans: eTrans };
  recordCheck(gen, 'conserve', spec, 'solution.mol', unknownMol);
  var stem = pair.note + '反应中，' + fmtVal(knownMol) + ' mol ' + known.label + '（' + known.name + '，' +
    known.change + '，每摩尔' + (knownIsOx ? '得' : '失') + ' ' + known.e + ' mol 电子）完全反应，另一反应物为 ' +
    other.label + '（' + other.name + '，' + other.change + '，每摩尔' + (knownIsOx ? '失' : '得') + ' ' + other.e +
    ' mol 电子）。求转移电子的物质的量，以及被' + (knownIsOx ? '氧化' : '还原') + '的 ' + other.label + ' 的物质的量。';
  var analysis = buildAnalysis(
    '氧化还原反应中的电子守恒',
    '氧化剂得到的电子总数等于还原剂失去的电子总数：先由已知量求转移电子总量，再除以另一反应物每分子的得失电子数。',
    r.steps,
    ['转移电子总量 = ' + fmtVal(knownMol) + ' × ' + known.e + ' = ' + fmtVal(eTrans) + ' mol；交叉检验：' +
     fmtVal(unknownMol) + ' × ' + other.e + ' = ' + fmtVal(round6(unknownMol * other.e)) + ' mol，两边相等。'],
    '得失电子数要按“每摩尔物质”算，不是按每个原子算（如 1 mol Cr₂O₇²⁻ 含 2 个 Cr，共得 6 mol 电子）；电子守恒只管电子总数，不管反应是否恰好按方程式比例进行。');
  if (variant === 'choice') {
    var stemC = pair.note + '反应中，' + fmtVal(knownMol) + ' mol ' + known.label + '（' + known.name + '，' +
      known.change + '，每摩尔' + (knownIsOx ? '得' : '失') + ' ' + known.e + ' mol 电子）完全反应，另一反应物为 ' +
      other.label + '（' + other.name + '，' + other.change + '，每摩尔' + (knownIsOx ? '失' : '得') + ' ' + other.e +
      ' mol 电子）。转移电子的物质的量是多少？';
    var ds = numDistractors(rng, eTrans, fmtVal, ' mol',
      [knownMol, eTrans * 2, eTrans / 2, unknownMol, knownMol * other.e]);
    return finishSingle(rng, gen,
      { topic: '物质与反应', title: '氧化还原电子转移', stem: stemC, analysis: analysis, level: '巩固' },
      fmtVal(eTrans) + ' mol', ds);
  }
  return finishFill(gen,
    { topic: '物质与反应', title: '氧化还原电子转移', stem: stem, analysis: analysis, level: '巩固' },
    [numPart('a', '转移电子的物质的量', eTrans, 'mol'),
     numPart('b', '被' + (knownIsOx ? '氧化' : '还原') + '的 ' + other.label + ' 的物质的量', unknownMol, 'mol')]);
}

/* ============================== 模板注册与对外 API ============================== */
var TEMPLATES = [
  { id: 'ph', name: '强酸/强碱 pH 与稀释', topic: '反应原理', types: ['single', 'fill'], level: '巩固', description: '强酸/强碱溶液的 pH，加水稀释后的浓度与 pH。' },
  { id: 'balance', name: '方程式配平', topic: '物质与反应', types: ['single', 'fill'], level: '巩固', description: '常见化学方程式的配平：问某一物质的系数，或问完整配平结果。' },
  { id: 'stoich', name: '化学计量', topic: '定量分析', types: ['single', 'fill'], level: '巩固', description: '质量、物质的量、标况气体体积的换算，以及按方程式求生成量。' },
  { id: 'solution', name: '溶液配制与稀释', topic: '定量分析', types: ['single', 'fill'], level: '巩固', description: '配制一定浓度溶液需称取的质量，稀释后浓度与取样，由浓溶液配制稀溶液。' },
  { id: 'titration', name: '滴定计算', topic: '定量分析', types: ['single', 'fill'], level: '综合', description: '酸碱中和滴定：平行读数平均、标准溶质物质的量与待测液浓度。' },
  { id: 'kc', name: '平衡常数 Kc', topic: '反应原理', types: ['single', 'fill'], level: '综合', description: '由三段式求平衡浓度、转化率与化学平衡常数 Kc。' },
  { id: 'redox', name: '氧化还原电子转移', topic: '物质与反应', types: ['single', 'fill'], level: '巩固', description: '电子守恒：由已知氧化剂/还原剂求转移电子总量与另一反应物的物质的量。' }
];
var GENERATORS = {
  ph: genPh, balance: genBalance, stoich: genStoich, solution: genSolution,
  titration: genTitration, kc: genKc, redox: genRedox
};

function generate(templateId, seed) {
  var E = needEngine();
  if (!GENERATORS[templateId]) {
    throw new Error('未知的变式模板“' + templateId + '”，可用模板：' + Object.keys(GENERATORS).join('、'));
  }
  var s = (seed === undefined || seed === null) ? defaultSeed() : seed;
  var rng = makeRng(s);
  var gen = { template: templateId, seed: s, variant: '', params: null, checks: [] };
  var q = GENERATORS[templateId](E, rng, gen);
  var chk = checkSchema(q);
  if (!chk.ok) throw new Error('生成的题目未通过 schema 校验：' + chk.errors.join('；'));
  return q;
}

/* 有变式模板的主题（供练习列表入口判断：无模板主题不直接出题，改为随机有模板的主题）。 */
function topicsWithTemplates() {
  var out = [];
  for (var i = 0; i < TEMPLATES.length; i++) {
    if (out.indexOf(TEMPLATES[i].topic) === -1) out.push(TEMPLATES[i].topic);
  }
  return out;
}

function randomByTopic(topic, seed) {
  if (TOPICS.indexOf(topic) === -1) {
    throw new Error('未知的主题“' + topic + '”，可用主题：' + TOPICS.join('、'));
  }
  var s = (seed === undefined || seed === null) ? defaultSeed() : seed;
  var pool = [];
  for (var i = 0; i < TEMPLATES.length; i++) {
    if (TEMPLATES[i].topic === topic) pool.push(TEMPLATES[i].id);
  }
  if (!pool.length) throw new Error('主题“' + topic + '”暂无变式模板（变式模板目前只覆盖计算类题型）');
  var rng = makeRng(s);
  return generate(pick(rng, pool), s);
}

function variantOf(question, seed) {
  if (!question || typeof question !== 'object') throw new Error('variantOf 需要传入题目对象');
  var s = (seed === undefined || seed === null) ? defaultSeed() : seed;
  var tid = null;
  if (question._gen && GENERATORS[question._gen.template]) tid = question._gen.template;
  else if (typeof question.id === 'string') {
    var m = question.id.match(/^gen-([a-z]+)-/);
    if (m && GENERATORS[m[1]]) tid = m[1];
  }
  if (tid) return generate(tid, s);
  if (question.topic && TOPICS.indexOf(question.topic) !== -1) return randomByTopic(question.topic, s);
  throw new Error('无法为题目“' + question.id + '”找到同类模板：既非变式生成题，主题也不在 6 个同步练习主题内');
}

function listTemplates() {
  return TEMPLATES.map(function (t) {
    return { id: t.id, name: t.name, topic: t.topic, types: t.types.slice(), level: t.level, description: t.description };
  });
}

/* 返回 analysis 已压平为字符串的题目副本（去掉 _gen）：可直接通过当前
   C.validate()，供协调员在校验器升级前合入题包时使用。 */
function flattenAnalysis(q) {
  if (!q || typeof q !== 'object') throw new Error('flattenAnalysis 需要传入题目对象');
  var copy = {};
  for (var k in q) if (q.hasOwnProperty(k) && k !== '_gen') copy[k] = q[k];
  copy.analysis = analysisText(q.analysis);
  return copy;
}

var ChemPracticeGen = {
  version: '2.4.0',
  generate: generate,
  randomByTopic: randomByTopic,
  listTemplates: listTemplates,
  topicsWithTemplates: topicsWithTemplates,
  variantOf: variantOf,
  topics: TOPICS.slice(),
  engineAvailable: engineAvailable,
  analysisText: analysisText,
  flattenAnalysis: flattenAnalysis,
  checkSchema: checkSchema
};

root.ChemPracticeGen = ChemPracticeGen;
/* Node 环境（测试用）：同时支持 require 引入，不影响浏览器使用。 */
if (typeof module !== 'undefined' && module.exports) module.exports = ChemPracticeGen;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
