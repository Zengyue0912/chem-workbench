/* ============================================================================
 * 高中化学 3D 考点工作台 — 确定性化学计算引擎（v2.2.0 / A 组）
 *
 * 架构定位：引擎优先、AI 讲解第二。凡是能确定性算对的题，先由本引擎算出
 * 100% 正确的答案与推导步骤，再由讲解层生成讲解；大模型只负责讲明白，
 * 不负责算答案。本文件是 v2.2.0 的地基：纯前端、零依赖、ES5 语法。
 *
 * 挂载：window.ChemSolveEngine（Node 下同时支持 module.exports，便于测试）。
 *
 * API 契约（与 B 组约定，不得擅自改动方法名与返回结构）：
 *   所有方法返回 {ok: boolean, ...}；成功 ok:true 并带 steps:[{title,detail}]；
 *   失败 ok:false 并带 error（中文说明）。不抛未捕获异常，不返回 NaN/Infinity。
 *   - parseFormula(text)  化学式解析 → {ok, atoms, charge, normalized, ...}
 *   - balance(eqText)     方程式配平 → {ok, balanced, coefficients, steps}
 *   - ph(spec)            pH 计算    → {ok, value, steps}
 *   - stoich(spec)        物质的量与化学计量 → {ok, result, steps}
 *   - conserve(spec)      守恒法列式辅助 → {ok, equations, steps}
 *   - molarMass(formula)  附加工具：摩尔质量 → {ok, value, formula, steps}
 *
 * 核心算法说明：
 *   1) 配平用线性代数法：把“每种元素反应前后原子数相等”列成齐次线性方程组
 *      A·x = 0（行=元素/电荷，列=物质，反应物取正、生成物取负），用分数类
 *      做精确高斯消元求行最简形（RREF），再由自由变量得到零空间基向量，
 *      通分约分后取最小正整数解。全部运算用自实现的有理数类完成，零浮点误差。
 *   2) pH：强酸/强碱用 -lg c(H⁺)；一元弱酸用精确求解公式
 *      [H⁺] = (-Ka + √(Ka² + 4·Ka·c)) / 2（解一元二次方程，不用近似）。
 *   3) 化学计量：标准状况气体摩尔体积 Vm = 22.4 L/mol（0℃、101 kPa），
 *      阿伏伽德罗常数 NA = 6.02×10²³ mol⁻¹；摩尔质量按高中常用相对原子质量表计算。
 * ========================================================================== */
(function (root) {
'use strict';

/* ============================== 通用小工具 ============================== */

function isNum(v) { return typeof v === 'number' && isFinite(v); }
function isInt(v) { return isNum(v) && Math.floor(v) === v; }
function fail(msg) { return { ok: false, error: msg }; }

/* 安全包装：任何未捕获异常都转为 {ok:false, error}，绝不向外抛错。 */
function safe(fn) {
  return function () {
    try { return fn.apply(null, arguments); }
    catch (e) { return fail('计算出错：' + (e && e.message ? e.message : '未知错误')); }
  };
}

/* 最大公约数 / 最小公倍数（正整数） */
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b !== 0) { var t = a % b; a = b; b = t; }
  return a === 0 ? 1 : a;
}
function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }

/* 数值修整：去掉浮点计算的末尾噪声（如 3.5200000000000005 → 3.52）。 */
function roundSmart(v) {
  if (!isNum(v)) return v;
  if (Math.abs(v) >= 1e12) return v;
  return Math.round(v * 1e6) / 1e6;
}
function round4(v) { return Math.round(v * 1e4) / 1e4; }

var SUB_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
var SUP_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
function subNum(n) {
  return String(n).split('').map(function (ch) { return SUB_DIGITS[+ch] || ch; }).join('');
}
function supNum(n) {
  return String(n).split('').map(function (ch) {
    if (ch === '-') return '⁻';
    if (ch === '+') return '⁺';
    return SUP_DIGITS[+ch] || ch;
  }).join('');
}
/* 步骤文本里的数字格式化：常规范围用十进制，极大/极小用科学计数法。 */
function fmtNum(n) {
  if (n === 0) return '0';
  var a = Math.abs(n);
  if (a >= 1e-4 && a < 1e7) return String(roundSmart(n));
  var e = Math.floor(Math.log(a) / Math.LN10);
  var m = roundSmart(n / Math.pow(10, e));
  return m + '×10' + supNum(e);
}
function log10(x) { return Math.log(x) / Math.LN10; }

/* ============================== 分数类（精确有理数） ============================== */
/* 配平全程用分数运算，避免 1/3 这类分数的浮点误差。分数恒保持最简形式且分母为正。 */
function Frac(n, d) {
  if (d === undefined) d = 1;
  if (d === 0) throw new Error('分数分母不能为 0');
  if (!isInt(n) || !isInt(d)) throw new Error('分数的分子分母必须为整数');
  if (d < 0) { n = -n; d = -d; }
  var g = gcd(n, d);
  this.n = n / g;
  this.d = d / g;
}
Frac.prototype.isZero = function () { return this.n === 0; };
Frac.prototype.neg = function () { return new Frac(-this.n, this.d); };
Frac.prototype.add = function (o) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); };
Frac.prototype.sub = function (o) { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); };
Frac.prototype.mul = function (o) { return new Frac(this.n * o.n, this.d * o.d); };
Frac.prototype.div = function (o) {
  if (o.n === 0) throw new Error('分数除零');
  return new Frac(this.n * o.d, this.d * o.n);
};
Frac.prototype.toString = function () {
  return this.d === 1 ? String(this.n) : this.n + '/' + this.d;
};

/* ============================== 元素表与相对原子质量 ============================== */
/* 118 种元素符号（用于解析校验，大小写敏感）；相对原子质量取高中常用值。 */
var ELEMENTS = {};
(function () {
  var list = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni ' +
    'Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba ' +
    'La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po ' +
    'At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn ' +
    'Nh Fl Mc Lv Ts Og').split(' ');
  for (var i = 0; i < list.length; i++) ELEMENTS[list[i]] = true;
})();

var ATOMIC_MASS = {
  H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20,
  Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, Ar: 40, K: 39,
  Ca: 40, Sc: 45, Ti: 48, V: 51, Cr: 52, Mn: 55, Fe: 56, Co: 59, Ni: 59,
  Cu: 64, Zn: 65, Ga: 70, Ge: 73, As: 75, Se: 79, Br: 80, Kr: 84, Rb: 85,
  Sr: 88, Y: 89, Zr: 91, Ag: 108, Cd: 112, In: 115, Sn: 119, Sb: 122,
  I: 127, Cs: 133, Ba: 137, Pt: 195, Au: 197, Hg: 201, Pb: 207
};

/* ============================== 化学式解析器 ============================== */
/*
 * 支持：元素符号（大小写敏感）、数字下标、括号/方括号（含嵌套与下标）、
 * 前置系数、电荷（Unicode 上标 ²⁻⁺ 与 ASCII 写法 ^2- / 2+）、结晶水（·）、
 * 状态符号 (s)/(l)/(g)/(aq)（不计入原子数，但保留在 normalized 中）。
 *
 * 解析分三步：① 归一化 Unicode 上下标/全角符号；② 从末尾剥离状态符号与电荷；
 * ③ 递归下降解析“元素/基团序列”，生成结构树，再由树统计原子数并渲染规范式。
 *
 * 电荷判定的约定（纯 ASCII 无 ^ 时存在歧义，按高中常见写法处理）：
 *   - 末尾 ^数字± 或上标数字±：数字即电荷数，如 SO4^2-、SO₄²⁻；
 *   - 末尾数字± 紧跟 ] 或 )：数字为电荷数，如 [Cu(NH3)4]2+；
 *   - 单元素离子末尾数字±：数字为电荷数，如 Fe3+、O2-（氧离子 O²⁻）；
 *   - 多元素末尾数字±：数字是最后一个元素的下标，电荷为 ±1，如 NH4+（NH₄⁺）。
 */
var SUB_MAP = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
var SUP_MAP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

function normalizeFormulaText(text) {
  var s = String(text).replace(/\s+/g, '');
  s = s.replace(/（/g, '(').replace(/）/g, ')').replace(/【/g, '[').replace(/】/g, ']');
  s = s.replace(/＋/g, '+').replace(/－/g, '-').replace(/⋅/g, '·').replace(/\./g, '·');
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (SUB_MAP[ch] !== undefined) out += SUB_MAP[ch];           /* 下标数字 → 普通数字 */
    else if (SUP_MAP[ch] !== undefined) out += '^' + SUP_MAP[ch]; /* 上标数字 → ^数字（标记电荷） */
    else if (ch === '⁺') out += '+';
    else if (ch === '⁻') out += '-';
    else out += ch;
  }
  return out;
}

/* 快速扫描字符串中出现过几种元素符号（供无 ^ 电荷判定用）。 */
function distinctElements(s) {
  var seen = {}, count = 0, m, re = /[A-Z][a-z]?/g;
  while ((m = re.exec(s)) !== null) {
    if (!seen[m[0]]) { seen[m[0]] = true; count++; }
  }
  return count;
}

/* 从末尾剥离电荷，返回 {core, charge}。 */
function extractCharge(s) {
  var m;
  if (/(\+\+|--)$/.test(s)) {
    return { core: s.slice(0, -2), charge: s.slice(-2) === '++' ? 2 : -2 };
  }
  m = s.match(/\^(\d*)([+-])$/); /* 带 ^ 的写法：数字明确为电荷数 */
  if (m) {
    var mag = m[1] === '' ? 1 : parseInt(m[1], 10);
    return { core: s.slice(0, s.length - m[0].length), charge: (m[2] === '+' ? 1 : -1) * mag };
  }
  m = s.match(/(\d*)([+-])$/);
  if (m) {
    var prefix = s.slice(0, s.length - m[0].length);
    var digits = m[1];
    var sign = m[2] === '+' ? 1 : -1;
    if (digits !== '' && /[\]\)]$/.test(prefix)) {
      return { core: prefix, charge: sign * parseInt(digits, 10) };
    }
    if (digits !== '') {
      if (distinctElements(prefix) <= 1) {
        return { core: prefix, charge: sign * parseInt(digits, 10) };
      }
      return { core: prefix + digits, charge: sign }; /* 数字归最后一个元素，电荷 ±1 */
    }
    return { core: prefix, charge: sign };
  }
  return { core: s, charge: 0 };
}

/* 递归下降解析一段“元素/基团序列”。节点：{t:'e', s:符号, n:个数} 或 {t:'g', ch:[子节点], n:倍数, open:'('/'['} */
function parseSequence(s, pos, closer) {
  var nodes = [];
  while (pos < s.length) {
    var ch = s.charAt(pos);
    if (closer && ch === closer) return { nodes: nodes, pos: pos + 1 };
    if (ch === '(' || ch === '[') {
      var close = ch === '(' ? ')' : ']';
      var inner = parseSequence(s, pos + 1, close);
      var mult = readNumber(s, inner.pos);
      if (mult.value === 0) throw new Error('括号后的下标不能为 0');
      nodes.push({ t: 'g', ch: inner.nodes, n: mult.value, open: ch });
      pos = mult.pos;
    } else if (ch === ')' || ch === ']') {
      throw new Error('括号不匹配：多余的“' + ch + '”');
    } else if (ch >= 'A' && ch <= 'Z') {
      var sym = ch;
      if (pos + 1 < s.length) {
        var nx = s.charAt(pos + 1);
        if (nx >= 'a' && nx <= 'z') sym += nx;
      }
      if (!ELEMENTS[sym]) throw new Error('未知的元素符号“' + sym + '”，请检查大小写与拼写');
      var num = readNumber(s, pos + sym.length);
      if (num.value === 0) throw new Error('元素“' + sym + '”的下标不能为 0');
      nodes.push({ t: 'e', s: sym, n: num.value });
      pos = num.pos;
    } else if (ch >= '0' && ch <= '9') {
      throw new Error('数字“' + ch + '”位置有误：下标必须紧跟元素符号或括号');
    } else {
      throw new Error('无法识别的字符“' + ch + '”');
    }
  }
  if (closer) throw new Error('括号不匹配：缺少闭括号“' + closer + '”');
  return { nodes: nodes, pos: pos };
}

/* 读取紧跟的数字；没有数字时返回 1。数字过大时报错，避免无意义的超大计算。 */
function readNumber(s, pos) {
  var start = pos, v = '';
  while (pos < s.length && s.charAt(pos) >= '0' && s.charAt(pos) <= '9') { v += s.charAt(pos); pos++; }
  if (v === '') return { value: 1, pos: pos };
  var n = parseInt(v, 10);
  if (n > 9999) throw new Error('下标“' + v + '”过大');
  return { value: n, pos: pos };
}

function addAtomsInto(atoms, nodes, mult) {
  for (var i = 0; i < nodes.length; i++) {
    var nd = nodes[i];
    if (nd.t === 'e') atoms[nd.s] = (atoms[nd.s] || 0) + nd.n * mult;
    else addAtomsInto(atoms, nd.ch, mult * nd.n);
  }
}
function renderNodes(nodes) {
  var out = '';
  for (var i = 0; i < nodes.length; i++) {
    var nd = nodes[i];
    if (nd.t === 'e') out += nd.s + (nd.n > 1 ? subNum(nd.n) : '');
    else {
      var close = nd.open === '(' ? ')' : ']';
      out += nd.open + renderNodes(nd.ch) + close + (nd.n > 1 ? subNum(nd.n) : '');
    }
  }
  return out;
}
function renderCharge(charge) {
  if (charge === 0) return '';
  var a = Math.abs(charge);
  return (a > 1 ? supNum(a) : '') + (charge > 0 ? '⁺' : '⁻');
}

/* 内部解析：返回完整结构（含 per-formula-unit 的 unitAtoms，供配平使用）。 */
function parseFormulaInternal(text) {
  if (typeof text !== 'string' || text.replace(/\s+/g, '') === '') {
    return fail('化学式不能为空');
  }
  var s = normalizeFormulaText(text);
  if (s === '') return fail('化学式不能为空');
  if (/[a-z]/.test(s.charAt(0))) return fail('化学式应以大写字母、数字系数或括号开头，请检查大小写');

  /* ① 剥离状态符号（不计入原子数，保留在 normalized 中）。 */
  var state = '';
  var sm = s.match(/\((s|l|g|aq)\)$/i);
  if (sm) { state = '(' + sm[1].toLowerCase() + ')'; s = s.slice(0, s.length - sm[0].length); }

  /* ② 剥离电荷。 */
  var chg = extractCharge(s);
  s = chg.core;
  if (s === '') return fail('化学式缺少主体部分');
  if (s.indexOf('^') !== -1) return fail('电荷符号“^”位置有误，电荷应写在化学式末尾');
  if (s.indexOf('+') !== -1 || s.indexOf('-') !== -1) {
    return fail('化学式中出现多余的“+”或“-”，电荷请写在末尾（如 SO4^2-）');
  }

  /* ③ 按结晶水分隔符拆分，各部分分别解析（后续部分的前置数字为结晶水分子数）。 */
  var parts = s.split('·');
  var parsed = [];
  for (var p = 0; p < parts.length; p++) {
    var part = parts[p];
    if (part === '') return fail('结晶水写法有误：“·”两侧都应有化学式');
    var coef = 1;
    var dm = part.match(/^(\d+)/);
    if (dm) {
      coef = parseInt(dm[1], 10);
      if (coef === 0) return fail('化学式前的系数不能为 0');
      part = part.slice(dm[1].length);
      if (part === '') return fail('化学式不能只有数字系数');
    }
    var seq;
    try { seq = parseSequence(part, 0, null); }
    catch (e) { return fail(e.message); }
    if (seq.nodes.length === 0) return fail('化学式“' + text + '”无法解析');
    parsed.push({ coef: coef, nodes: seq.nodes });
  }

  /* 原子统计：unitAtoms 为一个化学式单位的原子数（不计前置系数，
     但计入结晶水倍数）；atoms 计入前置系数（整项的原子数）。 */
  var unitAtoms = {}, atoms = {};
  for (var k = 0; k < parsed.length; k++) {
    var tmp = {};
    addAtomsInto(tmp, parsed[k].nodes, k === 0 ? 1 : parsed[k].coef);
    for (var el in tmp) if (tmp.hasOwnProperty(el)) {
      unitAtoms[el] = (unitAtoms[el] || 0) + tmp[el];
    }
  }
  var leadCoef = parsed[0].coef;
  for (var el2 in unitAtoms) if (unitAtoms.hasOwnProperty(el2)) {
    atoms[el2] = unitAtoms[el2] * leadCoef;
  }

  /* 规范化字符串：下标用 Unicode 下标，电荷用上标，结晶水用 · 连接，状态符号保留在末尾。 */
  function renderPart(pr, withCoef) {
    return (withCoef && pr.coef > 1 ? String(pr.coef) : '') + renderNodes(pr.nodes);
  }
  var unitNorm = '';
  for (var q = 0; q < parsed.length; q++) {
    unitNorm += (q > 0 ? '·' : '') + renderPart(parsed[q], q > 0);
  }
  var normalized = (leadCoef > 1 ? String(leadCoef) : '') + unitNorm +
    renderCharge(chg.charge) + state;
  unitNorm = unitNorm + renderCharge(chg.charge) + state;

  return {
    ok: true,
    atoms: atoms,
    unitAtoms: unitAtoms,
    charge: chg.charge,
    coefficient: leadCoef,
    state: state,
    normalized: normalized,
    unitNormalized: unitNorm
  };
}

/* 公开：化学式解析（契约字段 atoms/charge/normalized，另附 coefficient/state 供调用方参考）。 */
function parseFormula(text) {
  var r = parseFormulaInternal(text);
  if (!r.ok) return r;
  return {
    ok: true,
    atoms: r.atoms,
    charge: r.charge,
    normalized: r.normalized,
    coefficient: r.coefficient,
    state: r.state
  };
}

/* ============================== 方程式配平（线性代数法） ============================== */
/*
 * 算法：设各物质系数为 x₁…xₙ。对每种元素（及总电荷），“反应前原子数 = 反应后
 * 原子数”给出一个齐次线性方程；全体方程组成 A·x = 0，其中矩阵 A 的行是元素，
 * 列是物质，反应物系数取正、生成物取负。用分数类做精确高斯消元求行最简形
 * （RREF），由自由变量得到零空间基向量，再通分约分取最小正整数解。
 *   - 零空间维数 = 0：只有零解，方程式无解 → 明确报错；
 *   - 维数 = 1：唯一比例解，取最小正整数比；
 *   - 维数 ≥ 2：欠定方程组，在小范围内搜索系数和最小的全正整数解（维数 > 3 时报错请补充条件）。
 * 最后必须通过原子守恒检验（逐元素核对左右原子数，含电荷时也核对电荷），检验通过才算成功。
 */
var COEF_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
function coefLetter(i) { return i < 26 ? COEF_LETTERS[i] : 'x' + (i + 1); }

/* 分数矩阵的高斯-若尔当消元，求行最简形。返回 {a: 消元后矩阵, pivots: 主元列下标}。 */
function rref(mat) {
  var m = mat.length, n = mat[0].length;
  var a = [];
  for (var i = 0; i < m; i++) a.push(mat[i].slice());
  var pivots = [], row = 0;
  for (var col = 0; col < n && row < m; col++) {
    var sel = -1;
    for (var i2 = row; i2 < m; i2++) {
      if (!a[i2][col].isZero()) { sel = i2; break; }
    }
    if (sel === -1) continue;
    var tmp = a[row]; a[row] = a[sel]; a[sel] = tmp;
    var pv = a[row][col];
    for (var j = 0; j < n; j++) a[row][j] = a[row][j].div(pv);
    for (var k = 0; k < m; k++) {
      if (k !== row && !a[k][col].isZero()) {
        var f = a[k][col];
        for (var j2 = 0; j2 < n; j2++) a[k][j2] = a[k][j2].sub(f.mul(a[row][j2]));
      }
    }
    pivots.push(col);
    row++;
  }
  return { a: a, pivots: pivots };
}

/* 由 RREF 得到零空间的一组基：每个自由变量取 1、其余自由变量取 0，主元变量 = -RREF 对应行元素。 */
function nullSpaceBasis(rr, nCols) {
  var a = rr.a, pivots = rr.pivots;
  var isPivot = {}, pivotRowOf = {};
  for (var i = 0; i < pivots.length; i++) { isPivot[pivots[i]] = true; pivotRowOf[pivots[i]] = i; }
  var basis = [];
  for (var f = 0; f < nCols; f++) {
    if (isPivot[f]) continue;
    var vec = [];
    for (var j = 0; j < nCols; j++) vec.push(new Frac(0));
    vec[f] = new Frac(1);
    for (var p = 0; p < pivots.length; p++) {
      vec[pivots[p]] = a[pivotRowOf[pivots[p]]][f].neg();
    }
    basis.push(vec);
  }
  return basis;
}

/* 分数向量 → 最小正整数向量：通分（乘分母最小公倍数）再约分（除最大公约数）。
   全负则整体变号；含 0 或正负混杂时返回 null（不是合法的配平系数）。 */
function fracVecToInts(vec) {
  var L = 1, i;
  for (i = 0; i < vec.length; i++) L = lcm(L, vec[i].d);
  var ints = [];
  for (i = 0; i < vec.length; i++) ints.push(vec[i].n * (L / vec[i].d));
  var g = 0;
  for (i = 0; i < ints.length; i++) g = gcd(g, ints[i]);
  if (g > 1) for (i = 0; i < ints.length; i++) ints[i] /= g;
  var allNeg = true, allPos = true;
  for (i = 0; i < ints.length; i++) {
    if (ints[i] > 0) allNeg = false;
    if (ints[i] <= 0) allPos = false;
  }
  if (allNeg) {
    for (i = 0; i < ints.length; i++) ints[i] = -ints[i];
    return { ints: ints, lcm: L, gcd: g };
  }
  if (allPos) return { ints: ints, lcm: L, gcd: g };
  return null;
}

/* 在零空间中找全正整数解。维数 1 时直接取基向量；维数 2~3 时在小范围组合中搜索系数和最小的解。 */
function findPositiveSolution(basis) {
  if (basis.length === 0) return null;
  if (basis.length === 1) {
    var s = fracVecToInts(basis[0]);
    return s ? { ints: s.ints, raw: basis[0], lcm: s.lcm, gcd: s.gcd } : null;
  }
  if (basis.length > 3) return null;
  var R = 6, k = basis.length, n = basis[0].length;
  var total = Math.pow(2 * R + 1, k);
  var best = null, bestRaw = null, bestSum = Infinity;
  for (var c = 0; c < total; c++) {
    var code = c, ts = [], allZero = true, i;
    for (i = 0; i < k; i++) {
      var t = (code % (2 * R + 1)) - R;
      code = Math.floor(code / (2 * R + 1));
      ts.push(t);
      if (t !== 0) allZero = false;
    }
    if (allZero) continue;
    var vec = [];
    for (var j = 0; j < n; j++) {
      var sum = new Frac(0);
      for (var b = 0; b < k; b++) sum = sum.add(basis[b][j].mul(new Frac(ts[b])));
      vec.push(sum);
    }
    var s2 = fracVecToInts(vec);
    if (!s2) continue;
    var sumInts = 0;
    for (var q = 0; q < s2.ints.length; q++) sumInts += s2.ints[q];
    if (sumInts < bestSum) { bestSum = sumInts; best = s2; bestRaw = vec; }
  }
  return best ? { ints: best.ints, raw: bestRaw, lcm: best.lcm, gcd: best.gcd } : null;
}

/* 把 “2a + b - c” 形式的和渲染出来（items: [{v: 系数, letter: 字母}]）。 */
function formatSide(items) {
  if (items.length === 0) return '0';
  var out = '';
  for (var i = 0; i < items.length; i++) {
    var v = items[i].v, mag = Math.abs(v);
    var term = (mag === 1 ? '' : String(mag)) + items[i].letter;
    if (i === 0) out += (v < 0 ? '-' : '') + term;
    else out += (v < 0 ? ' - ' : ' + ') + term;
  }
  return out;
}

/* 逐元素列出原子守恒方程（配平步骤 1 与守恒法 mass-equation 模板共用）。 */
function atomEquations(terms, nReact, elements, withCharge) {
  var eqs = [];
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i], L = [], R = [];
    for (var j = 0; j < terms.length; j++) {
      var v = terms[j].unitAtoms[el] || 0;
      if (v !== 0) (j < nReact ? L : R).push({ v: v, letter: coefLetter(j) });
    }
    eqs.push(el + '：' + formatSide(L) + ' = ' + formatSide(R));
  }
  if (withCharge) {
    var Lc = [], Rc = [];
    for (var k = 0; k < terms.length; k++) {
      if (terms[k].charge !== 0) (k < nReact ? Lc : Rc).push({ v: terms[k].charge, letter: coefLetter(k) });
    }
    eqs.push('电荷：' + formatSide(Lc) + ' = ' + formatSide(Rc));
  }
  return eqs;
}

/* 把方程式的一边按“+”切成物质项。关键：离子电荷的 +（如 Fe2+）不是分隔符。
 * 判定规则（按顺序）：① 下一个字符是 + 或 - 时，本 + 为电荷（如 Fe2++MnO4- 中的第一个 +）；
 * ② 上一个字符是 + 或 - 时，本 + 为分隔符（如 Fe2++MnO4- 中的第二个 +）；
 * ③ 左侧为空白时为分隔符；④ 右侧为空白或位于末尾时为电荷（如 "Fe2+ + MnO4-"）；
 * ⑤ 其余（两侧都紧贴，如 H2+O2）为分隔符。无空格的单 + 离子方程式（如 Fe2+MnO4-）
 * 存在歧义，按分隔符处理；离子方程式请用空格或 ++ 写法，如 "Fe2+ + MnO4-"。 */
function splitTerms(side) {
  var terms = [], cur = '';
  for (var i = 0; i < side.length; i++) {
    var ch = side.charAt(i);
    if (ch !== '+') { cur += ch; continue; }
    var prev = i > 0 ? side.charAt(i - 1) : '';
    var next = i + 1 < side.length ? side.charAt(i + 1) : '';
    var isCharge;
    if (next === '+' || next === '-') isCharge = true;
    else if (prev === '+' || prev === '-') isCharge = false;
    else if (prev === '' || prev === ' ' || prev === '\t') isCharge = false;
    else if (next === '' || next === ' ' || next === '\t') isCharge = true;
    else isCharge = false;
    if (isCharge) cur += ch;
    else { terms.push(cur); cur = ''; }
  }
  terms.push(cur);
  return terms;
}

/* 把方程式文本拆成左右两边的物质项（配平与守恒法共用）。成功返回 {terms, nReact}。 */
function splitEquation(eqText) {
  if (typeof eqText !== 'string' || eqText.replace(/\s+/g, '') === '') {
    return fail('请输入化学方程式，如 H2 + O2 -> H2O');
  }
  var s = eqText.replace(/\s+/g, ' ').trim();
  var parts = s.split(/\s*(?:->|=>|→|⟶|=)\s*/);
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    return fail('方程式需要一个箭头（-> 或 →），左右各至少一种物质');
  }
  var left = splitTerms(parts[0]), right = splitTerms(parts[1]);
  var terms = [], nReact = left.length;
  var all = left.concat(right);
  for (var i = 0; i < all.length; i++) {
    var t = all[i].replace(/\s+/g, '');
    if (t === '') return fail('方程式中“+”号两侧都应有物质');
    var r = parseFormulaInternal(t);
    if (!r.ok) return fail('“' + t + '”解析失败：' + r.error);
    terms.push(r);
  }
  return { ok: true, terms: terms, nReact: nReact };
}

function collectElements(terms) {
  var elements = [], seen = {};
  for (var i = 0; i < terms.length; i++) {
    for (var el in terms[i].unitAtoms) if (terms[i].unitAtoms.hasOwnProperty(el)) {
      if (!seen[el]) { seen[el] = true; elements.push(el); }
    }
  }
  return elements;
}

function balance(eqText) {
  var sp = splitEquation(eqText);
  if (!sp.ok) return sp;
  var terms = sp.terms, nReact = sp.nReact;
  var hadInputCoef = false, withCharge = false;
  for (var i = 0; i < terms.length; i++) {
    if (terms[i].coefficient > 1) hadInputCoef = true;
    if (terms[i].charge !== 0) withCharge = true;
  }
  var elements = collectElements(terms);

  /* 构造系数矩阵：行 = 元素（+电荷行），列 = 物质，反应物取正、生成物取负。 */
  var mat = [];
  for (var ei = 0; ei < elements.length; ei++) {
    var row = [];
    for (var j = 0; j < terms.length; j++) {
      var v = terms[j].unitAtoms[elements[ei]] || 0;
      row.push(new Frac(j < nReact ? v : -v));
    }
    mat.push(row);
  }
  if (withCharge) {
    var crow = [];
    for (var j2 = 0; j2 < terms.length; j2++) {
      crow.push(new Frac(j2 < nReact ? terms[j2].charge : -terms[j2].charge));
    }
    mat.push(crow);
  }

  var rr = rref(mat);
  var basis = nullSpaceBasis(rr, terms.length);
  if (basis.length === 0) {
    return fail('该方程式无法配平：元素不守恒或存在多余物质，请检查反应物与生成物');
  }
  var sol = findPositiveSolution(basis);
  if (!sol) {
    if (basis.length > 3) return fail('该方程式配平结果不唯一（自由度过高），请补充条件或拆分反应');
    return fail('该方程式无法配平：不存在全为正数的整数组系数，请检查反应物与生成物');
  }
  var coefs = sol.ints;

  /* 检验：逐元素核对左右原子数，含电荷时也核对总电荷；检验不通过则不返回成功。 */
  var checkLines = [], checkOk = true;
  for (var ci = 0; ci < elements.length; ci++) {
    var el = elements[ci], lSum = 0, rSum = 0;
    for (var k = 0; k < terms.length; k++) {
      var cnt = (terms[k].unitAtoms[el] || 0) * coefs[k];
      if (k < nReact) lSum += cnt; else rSum += cnt;
    }
    if (lSum !== rSum) checkOk = false;
    checkLines.push(el + '：左侧 ' + lSum + ' = 右侧 ' + rSum);
  }
  var chargeLine = '';
  if (withCharge) {
    var lCh = 0, rCh = 0;
    for (var k2 = 0; k2 < terms.length; k2++) {
      var cc = terms[k2].charge * coefs[k2];
      if (k2 < nReact) lCh += cc; else rCh += cc;
    }
    if (lCh !== rCh) checkOk = false;
    var fmtCh = function (v) { return (v > 0 ? '+' : '') + v; };
    chargeLine = '电荷：左侧 ' + fmtCh(lCh) + ' = 右侧 ' + fmtCh(rCh);
  }
  if (!checkOk) return fail('内部校验失败：配平结果未通过原子守恒检验，请检查方程式');

  function sideStr(from, to) {
    var parts = [];
    for (var i = from; i < to; i++) {
      parts.push((coefs[i] > 1 ? String(coefs[i]) : '') + terms[i].unitNormalized);
    }
    return parts.join(' + ');
  }
  var balanced = sideStr(0, nReact) + ' → ' + sideStr(nReact, terms.length);

  /* 推导步骤：列方程组 → 解系数 → 约分 → 检验原子守恒。 */
  var letters = [];
  for (var li = 0; li < terms.length; li++) letters.push(coefLetter(li) + '=' + terms[li].unitNormalized);
  var rawStr = [], intStr = [];
  for (var ri = 0; ri < terms.length; ri++) {
    rawStr.push(coefLetter(ri) + ' = ' + sol.raw[ri].toString());
    intStr.push(coefLetter(ri) + ' = ' + coefs[ri]);
  }
  var steps = [
    {
      title: '列原子守恒方程组',
      detail: '设各物质的系数依次为：' + letters.join('，') + '。\n' +
        '根据原子守恒（反应前后各元素原子总数相等）列方程组：\n' +
        atomEquations(terms, nReact, elements, withCharge).join('\n') +
        (hadInputCoef ? '\n（输入中已有的系数将被重新计算。）' : '')
    },
    {
      title: '解方程组',
      detail: '对系数矩阵做精确分数高斯消元（有理数运算，无浮点误差），求得系数比：\n' +
        rawStr.join('，') +
        (basis.length > 1 ? '\n（方程组有 ' + basis.length + ' 个自由变量，取系数和最小的正整数解。）' : '')
    },
    {
      title: '化为最小整数比',
      detail: (sol.lcm > 1 || sol.gcd > 1
        ? '各项同乘 ' + sol.lcm + ' 通分' + (sol.gcd > 1 ? '，再同除 ' + sol.gcd + ' 约分' : '') + '，得最小整数比：\n'
        : '系数已是最小整数比，无需通分约分：\n') + intStr.join('，')
    },
    {
      title: '检验原子守恒',
      detail: checkLines.join('；') + '。' +
        (chargeLine ? chargeLine + '。' : '') +
        '原子守恒检验通过，配平结果正确。'
    }
  ];
  return { ok: true, balanced: balanced, coefficients: coefs, steps: steps };
}

/* ============================== pH 计算 ============================== */
/*
 * spec 字段：{kind, c, c2?, v?, v2?, Ka?, Kb?, n?, n2?, factor?, type?}
 *   kind: 'strong-acid' 强酸 | 'strong-base' 强碱 | 'dilute' 稀释 |
 *         'mix' 混合 | 'weak-acid' 一元弱酸 | 'weak-base' 一元弱碱（附加）
 *   c/c2: 浓度 mol/L；v/v2: 体积（同单位即可，默认等体积）；Ka/Kb: 电离常数；
 *   n/n2: 每分子电离出的 H⁺/OH⁻ 数（默认 1，如 H2SO4 取 2）；
 *   factor: 稀释倍数（dilute 用，与 v/v2 二选一）；type: dilute/mix 的子类型
 *     dilute: 'acid'(默认)/'base'；mix: 'acid-base'(默认)/'acid-acid'/'base-base'。
 * 约定：25℃，Kw = 1.0×10⁻¹⁴，pH + pOH = 14；浓度须在 (0, 10] mol/L 内。
 * 弱酸/弱碱用精确公式 [H⁺] = (-K + √(K² + 4Kc)) / 2（解一元二次方程），不做近似。
 */
function ph(spec) {
  if (!spec || typeof spec !== 'object') return fail('请传入 pH 计算参数，如 {kind: "strong-acid", c: 0.01}');
  var kind = spec.kind;
  var KNOWN = ['strong-acid', 'strong-base', 'dilute', 'mix', 'weak-acid', 'weak-base'];
  if (KNOWN.indexOf(kind) === -1) {
    return fail('未知的 pH 计算类型“' + kind + '”，支持：strong-acid / strong-base / dilute / mix / weak-acid / weak-base');
  }
  function needConc(v, name) {
    if (!isNum(v)) return fail(name + '须为数字（单位 mol/L）');
    if (v <= 0 || v > 10) return fail(name + '超出合理范围：浓度须大于 0 且不超过 10 mol/L');
    return null;
  }
  function needVol(v, name) {
    if (!isNum(v)) return fail(name + '须为数字');
    if (v <= 0) return fail(name + '须大于 0');
    return null;
  }
  function protons(v, name) {
    if (v === undefined || v === null) return 1;
    if (!isNum(v) || v <= 0) return fail(name + '须为大于 0 的数字');
    return v;
  }

  /* ---- 强酸 ---- */
  if (kind === 'strong-acid') {
    var e1 = needConc(spec.c, '酸的浓度 c');
    if (e1) return e1;
    var n1 = protons(spec.n, 'n（每分子电离的 H⁺ 数）');
    if (n1 && n1.ok === false) return n1;
    var cH1 = spec.c * n1;
    var v1 = -log10(cH1);
    if (!isFinite(v1)) return fail('浓度过小，无法计算 pH');
    return {
      ok: true, value: round4(v1),
      steps: [
        { title: '求氢离子浓度', detail: '强酸完全电离，c(H⁺) = ' + (n1 > 1 ? n1 + ' × c = ' + n1 + ' × ' : 'c = ') + fmtNum(spec.c) + ' = ' + fmtNum(cH1) + ' mol/L' },
        { title: '求 pH', detail: 'pH = -lg c(H⁺) = -lg(' + fmtNum(cH1) + ') = ' + fmtNum(v1) +
          (cH1 < 1e-6 ? '\n（浓度极低时水的电离不可忽略，本结果为忽略水电离的近似值。）' : '') }
      ]
    };
  }

  /* ---- 强碱 ---- */
  if (kind === 'strong-base') {
    var e2 = needConc(spec.c, '碱的浓度 c');
    if (e2) return e2;
    var n2 = protons(spec.n, 'n（每分子电离的 OH⁻ 数）');
    if (n2 && n2.ok === false) return n2;
    var cOH2 = spec.c * n2;
    var pOH2 = -log10(cOH2);
    var v2 = 14 - pOH2;
    if (!isFinite(v2)) return fail('浓度过小，无法计算 pH');
    return {
      ok: true, value: round4(v2),
      steps: [
        { title: '求氢氧根浓度', detail: '强碱完全电离，c(OH⁻) = ' + (n2 > 1 ? n2 + ' × c = ' + n2 + ' × ' : 'c = ') + fmtNum(spec.c) + ' = ' + fmtNum(cOH2) + ' mol/L' },
        { title: '求 pH', detail: '25℃ 时 pH + pOH = 14，pOH = -lg c(OH⁻) = -lg(' + fmtNum(cOH2) + ') = ' + fmtNum(pOH2) + '，\n所以 pH = 14 - ' + fmtNum(pOH2) + ' = ' + fmtNum(v2) +
          (cOH2 < 1e-6 ? '\n（浓度极低时水的电离不可忽略，本结果为忽略水电离的近似值。）' : '') }
      ]
    };
  }

  /* ---- 稀释 ---- */
  if (kind === 'dilute') {
    var e3 = needConc(spec.c, '原浓度 c');
    if (e3) return e3;
    var type3 = spec.type || 'acid';
    if (type3 !== 'acid' && type3 !== 'base') return fail('dilute 的 type 须为 "acid"（酸）或 "base"（碱）');
    var cAfter, dilDetail;
    if (spec.factor !== undefined && spec.factor !== null) {
      if (!isNum(spec.factor) || spec.factor <= 0) return fail('稀释倍数 factor 须为大于 0 的数字');
      cAfter = spec.c / spec.factor;
      dilDetail = '稀释 ' + fmtNum(spec.factor) + ' 倍，c₂ = c / ' + fmtNum(spec.factor) + ' = ' + fmtNum(spec.c) + ' / ' + fmtNum(spec.factor) + ' = ' + fmtNum(cAfter) + ' mol/L';
    } else if (spec.v !== undefined && spec.v2 !== undefined) {
      var ev = needVol(spec.v, '原体积 v') || needVol(spec.v2, '稀释后体积 v2');
      if (ev) return ev;
      cAfter = spec.c * spec.v / spec.v2;
      dilDetail = '稀释前后溶质物质的量不变，c₁V₁ = c₂V₂，c₂ = c₁V₁/V₂ = ' + fmtNum(spec.c) + ' × ' + fmtNum(spec.v) + ' / ' + fmtNum(spec.v2) + ' = ' + fmtNum(cAfter) + ' mol/L';
    } else {
      return fail('稀释计算需要给出稀释倍数 factor，或原体积 v 与稀释后体积 v2');
    }
    if (type3 === 'acid') {
      var v3 = -log10(cAfter);
      if (!isFinite(v3)) return fail('稀释后浓度过小，无法计算 pH');
      return {
        ok: true, value: round4(v3),
        steps: [
          { title: '求稀释后浓度', detail: dilDetail },
          { title: '求 pH', detail: 'pH = -lg c(H⁺) = -lg(' + fmtNum(cAfter) + ') = ' + fmtNum(v3) }
        ]
      };
    }
    var pOH3 = -log10(cAfter);
    var v3b = 14 - pOH3;
    if (!isFinite(v3b)) return fail('稀释后浓度过小，无法计算 pH');
    return {
      ok: true, value: round4(v3b),
      steps: [
        { title: '求稀释后浓度', detail: dilDetail },
        { title: '求 pH', detail: 'pOH = -lg c(OH⁻) = -lg(' + fmtNum(cAfter) + ') = ' + fmtNum(pOH3) + '，pH = 14 - pOH = ' + fmtNum(v3b) }
      ]
    };
  }

  /* ---- 混合 ---- */
  if (kind === 'mix') {
    var e4 = needConc(spec.c, '第一种溶液的浓度 c') || needConc(spec.c2, '第二种溶液的浓度 c2');
    if (e4) return e4;
    var vA = spec.v === undefined || spec.v === null ? 1 : spec.v;
    var vB = spec.v2 === undefined || spec.v2 === null ? 1 : spec.v2;
    var ev2 = needVol(vA, '第一种溶液的体积 v') || needVol(vB, '第二种溶液的体积 v2');
    if (ev2) return ev2;
    var na = protons(spec.n, 'n');
    if (na && na.ok === false) return na;
    var nb = protons(spec.n2, 'n2');
    if (nb && nb.ok === false) return nb;
    var type4 = spec.type || 'acid-base';
    var molA = spec.c * vA * na, molB = spec.c2 * vB * nb, vTot = vA + vB;
    if (type4 === 'acid-acid') {
      var cH4 = (molA + molB) / vTot;
      var v4 = -log10(cH4);
      return {
        ok: true, value: round4(v4),
        steps: [
          { title: '求混合后氢离子浓度', detail: 'n(H⁺) = ' + fmtNum(spec.c) + ' × ' + fmtNum(vA) + (na > 1 ? ' × ' + na : '') + ' + ' + fmtNum(spec.c2) + ' × ' + fmtNum(vB) + (nb > 1 ? ' × ' + nb : '') + ' = ' + fmtNum(molA + molB) + '，\nc(H⁺) = n(H⁺)/(V₁+V₂) = ' + fmtNum(molA + molB) + ' / ' + fmtNum(vTot) + ' = ' + fmtNum(cH4) + ' mol/L' },
          { title: '求 pH', detail: 'pH = -lg c(H⁺) = -lg(' + fmtNum(cH4) + ') = ' + fmtNum(v4) }
        ]
      };
    }
    if (type4 === 'base-base') {
      var cOH4 = (molA + molB) / vTot;
      var v4b = 14 + log10(cOH4);
      return {
        ok: true, value: round4(v4b),
        steps: [
          { title: '求混合后氢氧根浓度', detail: 'n(OH⁻) = ' + fmtNum(molA + molB) + '，c(OH⁻) = n(OH⁻)/(V₁+V₂) = ' + fmtNum(molA + molB) + ' / ' + fmtNum(vTot) + ' = ' + fmtNum(cOH4) + ' mol/L' },
          { title: '求 pH', detail: 'pH = 14 + lg c(OH⁻) = 14 + lg(' + fmtNum(cOH4) + ') = ' + fmtNum(v4b) }
        ]
      };
    }
    if (type4 !== 'acid-base') return fail('mix 的 type 须为 "acid-base"（酸碱混合）、"acid-acid"（酸酸混合）或 "base-base"（碱碱混合）');
    var step1 = 'n(H⁺) = ' + fmtNum(spec.c) + ' × ' + fmtNum(vA) + (na > 1 ? ' × ' + na : '') + ' = ' + fmtNum(molA) + '，' +
      'n(OH⁻) = ' + fmtNum(spec.c2) + ' × ' + fmtNum(vB) + (nb > 1 ? ' × ' + nb : '') + ' = ' + fmtNum(molB) + '（体积单位一致即可）。';
    if (Math.abs(molA - molB) < 1e-12 * Math.max(1, molA, molB)) {
      return {
        ok: true, value: 7,
        steps: [
          { title: '比较 H⁺ 与 OH⁻ 的物质的量', detail: step1 + '\nn(H⁺) = n(OH⁻)，恰好完全中和。' },
          { title: '求 pH', detail: '恰好中和，溶液呈中性，pH = 7。' }
        ]
      };
    }
    if (molA > molB) {
      var cH5 = (molA - molB) / vTot;
      var v5 = -log10(cH5);
      return {
        ok: true, value: round4(v5),
        steps: [
          { title: '比较 H⁺ 与 OH⁻ 的物质的量', detail: step1 + '\nn(H⁺) > n(OH⁻)，酸过量，剩余 n(H⁺) = ' + fmtNum(molA - molB) + '。' },
          { title: '求剩余氢离子浓度', detail: 'c(H⁺) = ' + fmtNum(molA - molB) + ' / (' + fmtNum(vA) + ' + ' + fmtNum(vB) + ') = ' + fmtNum(cH5) + ' mol/L' },
          { title: '求 pH', detail: 'pH = -lg c(H⁺) = -lg(' + fmtNum(cH5) + ') = ' + fmtNum(v5) }
        ]
      };
    }
    var cOH5 = (molB - molA) / vTot;
    var v5b = 14 + log10(cOH5);
    return {
      ok: true, value: round4(v5b),
      steps: [
        { title: '比较 H⁺ 与 OH⁻ 的物质的量', detail: step1 + '\nn(OH⁻) > n(H⁺)，碱过量，剩余 n(OH⁻) = ' + fmtNum(molB - molA) + '。' },
        { title: '求剩余氢氧根浓度', detail: 'c(OH⁻) = ' + fmtNum(molB - molA) + ' / (' + fmtNum(vA) + ' + ' + fmtNum(vB) + ') = ' + fmtNum(cOH5) + ' mol/L' },
        { title: '求 pH', detail: 'pH = 14 + lg c(OH⁻) = 14 + lg(' + fmtNum(cOH5) + ') = ' + fmtNum(v5b) }
      ]
    };
  }

  /* ---- 一元弱酸 / 一元弱碱（精确公式） ---- */
  var isWeakAcid = kind === 'weak-acid';
  var e6 = needConc(spec.c, '浓度 c');
  if (e6) return e6;
  var K = isWeakAcid ? spec.Ka : spec.Kb;
  var kName = isWeakAcid ? 'Ka' : 'Kb';
  if (!isNum(K)) return fail('弱' + (isWeakAcid ? '酸' : '碱') + '计算需要给出电离常数 ' + kName);
  if (K <= 0 || K > 1) return fail(kName + '超出合理范围：须大于 0 且不超过 1');
  var cX = (-K + Math.sqrt(K * K + 4 * K * spec.c)) / 2;
  if (!isFinite(cX) || cX <= 0) return fail('无法求解电离平衡，请检查 c 与 ' + kName);
  var v6 = isWeakAcid ? -log10(cX) : 14 + log10(cX);
  var ionName = isWeakAcid ? 'H⁺' : 'OH⁻';
  return {
    ok: true, value: round4(v6),
    steps: [
      { title: '列电离平衡式', detail: '设平衡时 c(' + ionName + ') = x mol/L，由 ' + kName + ' = x²/(c - x) 得一元二次方程：x² + ' + kName + '·x - ' + kName + '·c = 0。' },
      { title: '解方程求离子浓度', detail: 'x = (-' + kName + ' + √(' + kName + '² + 4' + kName + 'c)) / 2 = (-' + fmtNum(K) + ' + √(' + fmtNum(K * K) + ' + 4 × ' + fmtNum(K) + ' × ' + fmtNum(spec.c) + ')) / 2 = ' + fmtNum(cX) + ' mol/L（精确公式，未用近似）。' },
      { title: '求 pH', detail: isWeakAcid
        ? 'pH = -lg c(H⁺) = -lg(' + fmtNum(cX) + ') = ' + fmtNum(v6)
        : 'pH = 14 + lg c(OH⁻) = 14 + lg(' + fmtNum(cX) + ') = ' + fmtNum(v6) }
    ]
  };
}

/* ============================== 物质的量与化学计量 ============================== */
/*
 * spec 字段：{kind, ...}，kind 决定计算类型：
 *   'n-mass'    质量 ⇄ 物质的量：{mass?|n?, M?|formula?}（mass/n 二选一，M 或 formula 二选一）
 *   'n-volume'  物质的量 ⇄ 气体体积（标准状况）：{n?|volume?}
 *   'n-particles' 物质的量 ⇄ 粒子数：{n?|particles?}
 *   'molarity'  物质的量浓度：{n?|c?|volume?|mass?, M?|formula?}（已知任意两个求第三个；或由质量求浓度）
 *   'reaction'  按配平方程式计算：{equation, given:[{formula, mass?|mol?|volume?}], target, yield?}
 * 约定：标准状况（0℃、101 kPa）气体摩尔体积 Vm = 22.4 L/mol；NA = 6.02×10²³ mol⁻¹；
 * 产率 yield 可给小数（0.8）或百分数（80），均按 80% 理解。
 */
var VM_STP = 22.4;      /* 标准状况气体摩尔体积，L/mol */
var NA_CONST = 6.02e23; /* 阿伏伽德罗常数，mol⁻¹ */

/* 由化学式计算摩尔质量（g/mol），同时返回推导式。 */
function molarMassOf(formula) {
  var r = parseFormulaInternal(formula);
  if (!r.ok) return r;
  var M = 0, parts = [];
  for (var el in r.unitAtoms) if (r.unitAtoms.hasOwnProperty(el)) {
    if (ATOMIC_MASS[el] === undefined) {
      return fail('缺少元素“' + el + '”的相对原子质量数据，无法计算摩尔质量');
    }
    var cnt = r.unitAtoms[el];
    M += ATOMIC_MASS[el] * cnt;
    parts.push(cnt > 1 ? cnt + '×' + ATOMIC_MASS[el] : String(ATOMIC_MASS[el]));
  }
  return {
    ok: true, value: roundSmart(M), formula: r.unitNormalized,
    detail: 'M(' + r.unitNormalized + ') = ' + parts.join(' + ') + ' = ' + fmtNum(M) + ' g/mol'
  };
}

function molarMass(formula) {
  var r = molarMassOf(formula);
  if (!r.ok) return r;
  return { ok: true, value: r.value, formula: r.formula, steps: [{ title: '计算摩尔质量', detail: r.detail }] };
}

/* 原子组成指纹：用于把已知量物质与方程式中的项对应起来。 */
function atomsKey(atoms, charge) {
  var keys = [];
  for (var el in atoms) if (atoms.hasOwnProperty(el)) keys.push(el);
  keys.sort();
  var out = [];
  for (var i = 0; i < keys.length; i++) out.push(keys[i] + ':' + atoms[keys[i]]);
  return out.join(',') + '|q' + (charge || 0);
}

function stoich(spec) {
  if (!spec || typeof spec !== 'object') return fail('请传入化学计量参数，如 {kind: "n-mass", mass: 49, formula: "H2SO4"}');
  var kind = spec.kind;
  var KNOWN = ['n-mass', 'n-volume', 'n-particles', 'molarity', 'reaction'];
  if (KNOWN.indexOf(kind) === -1) {
    return fail('未知的化学计量类型“' + kind + '”，支持：n-mass / n-volume / n-particles / molarity / reaction');
  }
  function needPos(v, name) {
    if (!isNum(v)) return fail(name + '须为数字');
    if (v <= 0) return fail(name + '须大于 0');
    return null;
  }
  /* 取摩尔质量：优先用显式 M，其次由 formula 计算。 */
  function getM() {
    if (spec.M !== undefined && spec.M !== null) {
      if (!isNum(spec.M) || spec.M <= 0) return fail('摩尔质量 M 须为大于 0 的数字（单位 g/mol）');
      return { ok: true, value: spec.M, detail: 'M = ' + fmtNum(spec.M) + ' g/mol' };
    }
    if (spec.formula) return molarMassOf(spec.formula);
    return fail('需要给出摩尔质量 M 或化学式 formula');
  }

  /* ---- 质量 ⇄ 物质的量 ---- */
  if (kind === 'n-mass') {
    var hasMass = spec.mass !== undefined && spec.mass !== null;
    var hasN = spec.n !== undefined && spec.n !== null;
    if (hasMass === hasN) return fail('n-mass 计算须恰好给出质量 mass 或物质的量 n 其中之一');
    var mRes = getM();
    if (!mRes.ok) return mRes;
    if (hasMass) {
      var e1 = needPos(spec.mass, '质量 mass');
      if (e1) return e1;
      var n1 = spec.mass / mRes.value;
      return {
        ok: true, result: { n: roundSmart(n1), mass: roundSmart(spec.mass), M: roundSmart(mRes.value) },
        steps: [
          { title: '确定摩尔质量', detail: mRes.detail },
          { title: '求物质的量', detail: 'n = m / M = ' + fmtNum(spec.mass) + ' g / ' + fmtNum(mRes.value) + ' g·mol⁻¹ = ' + fmtNum(n1) + ' mol' }
        ]
      };
    }
    var e2 = needPos(spec.n, '物质的量 n');
    if (e2) return e2;
    var mass1 = spec.n * mRes.value;
    return {
      ok: true, result: { n: roundSmart(spec.n), mass: roundSmart(mass1), M: roundSmart(mRes.value) },
      steps: [
        { title: '确定摩尔质量', detail: mRes.detail },
        { title: '求质量', detail: 'm = n × M = ' + fmtNum(spec.n) + ' mol × ' + fmtNum(mRes.value) + ' g·mol⁻¹ = ' + fmtNum(mass1) + ' g' }
      ]
    };
  }

  /* ---- 物质的量 ⇄ 气体体积（标准状况） ---- */
  if (kind === 'n-volume') {
    var hasN2 = spec.n !== undefined && spec.n !== null;
    var hasV = spec.volume !== undefined && spec.volume !== null;
    if (hasN2 === hasV) return fail('n-volume 计算须恰好给出物质的量 n 或气体体积 volume 其中之一');
    var note = '（标准状况：0℃、101 kPa，气体摩尔体积 Vm = 22.4 L/mol）';
    if (hasN2) {
      var e3 = needPos(spec.n, '物质的量 n');
      if (e3) return e3;
      var vol = spec.n * VM_STP;
      return {
        ok: true, result: { n: roundSmart(spec.n), volume: roundSmart(vol), Vm: VM_STP },
        steps: [{ title: '求气体体积', detail: 'V = n × Vm = ' + fmtNum(spec.n) + ' mol × 22.4 L·mol⁻¹ = ' + fmtNum(vol) + ' L' + note }]
      };
    }
    var e4 = needPos(spec.volume, '气体体积 volume');
    if (e4) return e4;
    var n2 = spec.volume / VM_STP;
    return {
      ok: true, result: { n: roundSmart(n2), volume: roundSmart(spec.volume), Vm: VM_STP },
      steps: [{ title: '求物质的量', detail: 'n = V / Vm = ' + fmtNum(spec.volume) + ' L / 22.4 L·mol⁻¹ = ' + fmtNum(n2) + ' mol' + note }]
    };
  }

  /* ---- 物质的量 ⇄ 粒子数 ---- */
  if (kind === 'n-particles') {
    var hasN3 = spec.n !== undefined && spec.n !== null;
    var hasP = spec.particles !== undefined && spec.particles !== null;
    if (hasN3 === hasP) return fail('n-particles 计算须恰好给出物质的量 n 或粒子数 particles 其中之一');
    if (hasN3) {
      var e5 = needPos(spec.n, '物质的量 n');
      if (e5) return e5;
      var N = spec.n * NA_CONST;
      return {
        ok: true, result: { n: roundSmart(spec.n), particles: N, NA: NA_CONST },
        steps: [{ title: '求粒子数', detail: 'N = n × NA = ' + fmtNum(spec.n) + ' mol × 6.02×10²³ mol⁻¹ = ' + fmtNum(N) + ' 个' }]
      };
    }
    var e6 = needPos(spec.particles, '粒子数 particles');
    if (e6) return e6;
    var n3 = spec.particles / NA_CONST;
    return {
      ok: true, result: { n: roundSmart(n3), particles: spec.particles, NA: NA_CONST },
      steps: [{ title: '求物质的量', detail: 'n = N / NA = ' + fmtNum(spec.particles) + ' / 6.02×10²³ mol⁻¹ = ' + fmtNum(n3) + ' mol' }]
    };
  }

  /* ---- 物质的量浓度 ---- */
  if (kind === 'molarity') {
    var nVal = spec.n, cVal = spec.c, vVal = spec.volume;
    if ((nVal === undefined || nVal === null) && spec.mass !== undefined && spec.mass !== null) {
      var mRes2 = getM();
      if (!mRes2.ok) return mRes2;
      var e7 = needPos(spec.mass, '质量 mass');
      if (e7) return e7;
      nVal = spec.mass / mRes2.value;
    }
    var known = 0;
    if (nVal !== undefined && nVal !== null) known++;
    if (cVal !== undefined && cVal !== null) known++;
    if (vVal !== undefined && vVal !== null) known++;
    if (known !== 2) return fail('molarity 计算须恰好给出 n、c、体积 volume 中的两个（或由质量 mass 代替 n）');
    var en = nVal !== undefined && nVal !== null ? needPos(nVal, '物质的量 n') : null;
    var ec = cVal !== undefined && cVal !== null ? needPos(cVal, '浓度 c') : null;
    var ev = vVal !== undefined && vVal !== null ? needPos(vVal, '体积 volume') : null;
    if (en) return en;
    if (ec) return ec;
    if (ev) return ev;
    var stepsM = [];
    if (spec.mass !== undefined && spec.mass !== null && spec.n === undefined) {
      stepsM.push({ title: '由质量求物质的量', detail: mRes2.detail + '；n = m / M = ' + fmtNum(spec.mass) + ' / ' + fmtNum(mRes2.value) + ' = ' + fmtNum(nVal) + ' mol' });
    }
    if (cVal === undefined || cVal === null) {
      cVal = nVal / vVal;
      stepsM.push({ title: '求物质的量浓度', detail: 'c = n / V = ' + fmtNum(nVal) + ' mol / ' + fmtNum(vVal) + ' L = ' + fmtNum(cVal) + ' mol/L' });
    } else if (nVal === undefined || nVal === null) {
      nVal = cVal * vVal;
      stepsM.push({ title: '求物质的量', detail: 'n = c × V = ' + fmtNum(cVal) + ' mol/L × ' + fmtNum(vVal) + ' L = ' + fmtNum(nVal) + ' mol' });
    } else {
      vVal = nVal / cVal;
      stepsM.push({ title: '求溶液体积', detail: 'V = n / c = ' + fmtNum(nVal) + ' mol / ' + fmtNum(cVal) + ' mol/L = ' + fmtNum(vVal) + ' L' });
    }
    return { ok: true, result: { n: roundSmart(nVal), c: roundSmart(cVal), volume: roundSmart(vVal) }, steps: stepsM };
  }

  /* ---- 按配平方程式计算（含过量判断、产率） ---- */
  var eqRes = balance(spec.equation);
  if (!eqRes.ok) return eqRes;
  var sp = splitEquation(spec.equation);
  var terms = sp.terms, nReact = sp.nReact, coefs = eqRes.coefficients;
  if (!spec.given || !spec.given.length) return fail('reaction 计算须给出已知量 given（至少一种反应物的量）');
  if (!spec.target) return fail('reaction 计算须给出所求物质 target（如 "H2O"）');

  /* 已知量 → 物质的量 → 与计量系数之比，最小比值者为限定反应物。 */
  var givenInfo = [];
  for (var gi = 0; gi < spec.given.length; gi++) {
    var g = spec.given[gi];
    if (!g || !g.formula) return fail('given 中的每一项须包含化学式 formula');
    var gp = parseFormulaInternal(g.formula);
    if (!gp.ok) return fail('已知量“' + g.formula + '”解析失败：' + gp.error);
    var gKey = atomsKey(gp.unitAtoms, gp.charge);
    var idx = -1;
    for (var ti = 0; ti < nReact; ti++) {
      if (atomsKey(terms[ti].unitAtoms, terms[ti].charge) === gKey) { idx = ti; break; }
    }
    if (idx === -1) return fail('已知量物质“' + gp.unitNormalized + '”不是该方程式的反应物');
    var mol, how;
    if (g.mol !== undefined && g.mol !== null) {
      var em = needPos(g.mol, '物质的量 mol');
      if (em) return em;
      mol = g.mol;
      how = 'n = ' + fmtNum(mol) + ' mol（直接给出）';
    } else if (g.mass !== undefined && g.mass !== null) {
      var emass = needPos(g.mass, '质量 mass');
      if (emass) return emass;
      var mm = molarMassOf(g.formula);
      if (!mm.ok) return mm;
      mol = g.mass / mm.value;
      how = mm.detail + '；n = m / M = ' + fmtNum(g.mass) + ' / ' + fmtNum(mm.value) + ' = ' + fmtNum(mol) + ' mol';
    } else if (g.volume !== undefined && g.volume !== null) {
      var evol = needPos(g.volume, '体积 volume');
      if (evol) return evol;
      mol = g.volume / VM_STP;
      how = 'n = V / Vm = ' + fmtNum(g.volume) + ' / 22.4 = ' + fmtNum(mol) + ' mol（标准状况气体）';
    } else {
      return fail('已知量“' + g.formula + '”须给出 mass（质量）、mol（物质的量）或 volume（气体体积）之一');
    }
    givenInfo.push({ idx: idx, name: terms[idx].unitNormalized, coef: coefs[idx], mol: mol, ratio: mol / coefs[idx], how: how });
  }
  var limiting = givenInfo[0];
  for (var li2 = 1; li2 < givenInfo.length; li2++) {
    if (givenInfo[li2].ratio < limiting.ratio - 1e-12) limiting = givenInfo[li2];
  }
  var allExact = true;
  for (var ai = 0; ai < givenInfo.length; ai++) {
    if (Math.abs(givenInfo[ai].ratio - limiting.ratio) > 1e-9 * Math.max(1, limiting.ratio)) { allExact = false; break; }
  }

  /* 所求物质：可以是生成物（求生成量）或反应物（求消耗量）。 */
  var tp = parseFormulaInternal(spec.target);
  if (!tp.ok) return fail('所求物质“' + spec.target + '”解析失败：' + tp.error);
  var tKey = atomsKey(tp.unitAtoms, tp.charge);
  var tIdx = -1;
  for (var tj = 0; tj < terms.length; tj++) {
    if (atomsKey(terms[tj].unitAtoms, terms[tj].charge) === tKey) { tIdx = tj; break; }
  }
  if (tIdx === -1) return fail('所求物质“' + tp.unitNormalized + '”不在该方程式中');
  var isProduct = tIdx >= nReact;
  var targetMol = limiting.ratio * coefs[tIdx];
  var tM = molarMassOf(spec.target);
  if (!tM.ok) return tM;
  var targetMass = targetMol * tM.value;
  var targetVol = targetMol * VM_STP;

  var yld = null;
  if (spec.yield !== undefined && spec.yield !== null) {
    if (!isNum(spec.yield) || spec.yield <= 0) return fail('产率 yield 须为大于 0 的数字（小数如 0.8，或百分数如 80）');
    yld = spec.yield > 1 ? spec.yield / 100 : spec.yield;
    if (yld > 1) return fail('产率不能超过 100%');
  }

  var rSteps = [
    { title: '配平方程式', detail: '配平结果：' + eqRes.balanced }
  ];
  var givenLines = [];
  for (var gl = 0; gl < givenInfo.length; gl++) {
    var inf = givenInfo[gl];
    givenLines.push(inf.name + '：' + inf.how + '；n/系数 = ' + fmtNum(inf.mol) + ' / ' + inf.coef + ' = ' + fmtNum(inf.ratio));
  }
  rSteps.push({ title: '计算各反应物的 n/系数', detail: givenLines.join('\n') });
  if (givenInfo.length > 1) {
    rSteps.push({
      title: '判断过量与不足',
      detail: allExact
        ? '各反应物的 n/系数 相等，恰好完全反应，无过量。'
        : 'n/系数 最小的是 ' + limiting.name + '（' + fmtNum(limiting.ratio) + '），它是限定反应物（不足量），其余反应物过量，按 ' + limiting.name + ' 计算。'
    });
  }
  var verb = isProduct ? '生成' : '消耗';
  rSteps.push({
    title: '按计量系数求' + verb + '量',
    detail: 'n(' + terms[tIdx].unitNormalized + ') = ' + fmtNum(limiting.ratio) + ' × ' + coefs[tIdx] + ' = ' + fmtNum(targetMol) + ' mol；\n' +
      tM.detail + '；\nm(' + terms[tIdx].unitNormalized + ') = ' + fmtNum(targetMol) + ' × ' + fmtNum(tM.value) + ' = ' + fmtNum(targetMass) + ' g' +
      (isProduct ? '；若为气体，标准状况下体积 V = ' + fmtNum(targetMol) + ' × 22.4 = ' + fmtNum(targetVol) + ' L。' : '。')
  });
  var result = {
    limiting: limiting.name,
    exactReaction: allExact,
    target: terms[tIdx].unitNormalized,
    targetMol: roundSmart(targetMol),
    targetMass: roundSmart(targetMass),
    targetVolume: roundSmart(targetVol)
  };
  if (yld !== null) {
    var actual = targetMass * yld;
    result.theoreticalMass = roundSmart(targetMass);
    result.actualMass = roundSmart(actual);
    result.yield = yld;
    rSteps.push({
      title: '计入产率',
      detail: '理论产量 ' + fmtNum(targetMass) + ' g，产率 ' + fmtNum(yld * 100) + '%，实际产量 = ' + fmtNum(targetMass) + ' × ' + fmtNum(yld) + ' = ' + fmtNum(actual) + ' g。'
    });
  }
  return { ok: true, result: result, steps: rSteps };
}

/* ============================== 守恒法列式辅助 ============================== */
/*
 * spec 字段：{template, ...}，template 决定题型模板：
 *   'solution-charge'  溶液电荷守恒：{cations:[{ion, charge?, c?}], anions:[...]}（c 可填 "x" 表示未知）
 *   'redox-electron'   氧化还原电子守恒：{oxidants:[{formula, electrons, mol?}], reductants:[...]}（mol 可填 "x"）
 *   'mass-equation'    质量守恒配平辅助：{equation}（列出各元素原子守恒方程组）
 *   'element-conserve' 元素守恒：{element, from:{formula, mol?|mass?}, to:{formula}}
 *   'dilution'         稀释守恒 c₁V₁=c₂V₂：{c1, v1, c2?|v2?}（c2/v2 二选一求解）
 *   'charge-check'     离子方程式电荷守恒检验：{equation}
 * 返回 {ok, equations:[列式字符串], steps}；可唯一求解时另附 solution/result。
 */
function isUnknown(v) {
  return v === undefined || v === null || v === 'x' || v === 'X' || v === '?';
}

/* ---- 模板 1：溶液电荷守恒 ---- */
function conserveSolutionCharge(spec) {
  var cations = spec.cations || [], anions = spec.anions || [];
  if (!cations.length || !anions.length) {
    return fail('溶液电荷守恒需要给出阳离子 cations 与阴离子 anions（各至少一种）');
  }
  function parseIon(entry, side) {
    if (!entry || !entry.ion) return fail(side + '中的每一项须包含离子化学式 ion');
    var p = parseFormulaInternal(entry.ion);
    if (!p.ok) return fail('离子“' + entry.ion + '”解析失败：' + p.error);
    var ch = entry.charge !== undefined && entry.charge !== null ? entry.charge : p.charge;
    if (!isInt(ch) || ch === 0) return fail('离子“' + entry.ion + '”的电荷须为非零整数');
    if (side === '阳离子' && ch < 0) return fail('离子“' + entry.ion + '”带负电，应放在 anions 中');
    if (side === '阴离子' && ch > 0) return fail('离子“' + entry.ion + '”带正电，应放在 cations 中');
    if (!isUnknown(entry.c) && (!isNum(entry.c) || entry.c < 0)) {
      return fail('离子“' + entry.ion + '”的浓度 c 须为不小于 0 的数字，未知时填 "x"');
    }
    return { ok: true, name: p.unitNormalized, charge: ch, c: isUnknown(entry.c) ? null : entry.c };
  }
  var cs = [], as = [], i;
  for (i = 0; i < cations.length; i++) {
    var pc = parseIon(cations[i], '阳离子');
    if (!pc.ok) return pc;
    cs.push(pc);
  }
  for (i = 0; i < anions.length; i++) {
    var pa = parseIon(anions[i], '阴离子');
    if (!pa.ok) return pa;
    as.push(pa);
  }
  function termStr(it) {
    var a = Math.abs(it.charge);
    return (a > 1 ? a : '') + 'c(' + it.name + ')';
  }
  var eq = cs.map(termStr).join(' + ') + ' = ' + as.map(termStr).join(' + ');
  var steps = [
    { title: '列电荷守恒式', detail: '溶液呈电中性：阳离子所带正电荷总数 = 阴离子所带负电荷总数（浓度须乘以离子所带电荷数）。' }
  ];
  var unknowns = [];
  for (i = 0; i < cs.length; i++) if (cs[i].c === null) unknowns.push({ it: cs[i], side: 'cation' });
  for (i = 0; i < as.length; i++) if (as[i].c === null) unknowns.push({ it: as[i], side: 'anion' });
  var out = { ok: true, equations: [eq], steps: steps };
  if (unknowns.length === 1) {
    var sumC = 0, sumA = 0;
    for (i = 0; i < cs.length; i++) if (cs[i].c !== null) sumC += Math.abs(cs[i].charge) * cs[i].c;
    for (i = 0; i < as.length; i++) if (as[i].c !== null) sumA += Math.abs(as[i].charge) * as[i].c;
    var u = unknowns[0];
    var xVal = u.side === 'cation'
      ? (sumA - sumC) / Math.abs(u.it.charge)
      : (sumC - sumA) / Math.abs(u.it.charge);
    if (xVal < 0 || !isFinite(xVal)) return fail('数据矛盾：按电荷守恒求得的浓度为负值，请检查已知浓度');
    out.solution = { ion: u.it.name, value: roundSmart(xVal), unit: 'mol/L' };
    steps.push({
      title: '代入求解',
      detail: '已知阳离子电荷浓度之和 = ' + fmtNum(sumC) + '，阴离子电荷浓度之和（不含未知项）= ' + fmtNum(sumA) + '，\n解得 c(' + u.it.name + ') = ' + fmtNum(xVal) + ' mol/L。'
    });
  } else if (unknowns.length === 0) {
    var sC = 0, sA = 0;
    for (i = 0; i < cs.length; i++) sC += Math.abs(cs[i].charge) * cs[i].c;
    for (i = 0; i < as.length; i++) sA += Math.abs(as[i].charge) * as[i].c;
    steps.push({
      title: '代入检验',
      detail: '阳离子电荷浓度之和 = ' + fmtNum(sC) + '，阴离子电荷浓度之和 = ' + fmtNum(sA) + '，' +
        (Math.abs(sC - sA) < 1e-9 ? '两边相等，电荷守恒成立。' : '两边不相等，数据可能有误，请检查浓度。')
    });
  } else {
    steps.push({ title: '求解说明', detail: '未知浓度有 ' + unknowns.length + ' 个，仅凭电荷守恒无法唯一求解，需结合其他条件（如物料守恒）。' });
  }
  return out;
}

/* ---- 模板 2：氧化还原电子守恒 ---- */
function conserveRedoxElectron(spec) {
  var oxidants = spec.oxidants || [], reductants = spec.reductants || [];
  if (!oxidants.length || !reductants.length) {
    return fail('氧化还原电子守恒需要给出氧化剂 oxidants 与还原剂 reductants（各至少一种）');
  }
  function parseAgent(entry, side) {
    if (!entry || !entry.formula) return fail(side + '中的每一项须包含化学式 formula');
    var p = parseFormulaInternal(entry.formula);
    if (!p.ok) return fail('“' + entry.formula + '”解析失败：' + p.error);
    if (!isNum(entry.electrons) || entry.electrons <= 0) {
      return fail('“' + entry.formula + '”须给出每分子得失电子数 electrons（大于 0 的数字）');
    }
    if (!isUnknown(entry.mol) && (!isNum(entry.mol) || entry.mol < 0)) {
      return fail('“' + entry.formula + '”的物质的量 mol 须为不小于 0 的数字，未知时填 "x"');
    }
    return { ok: true, name: p.unitNormalized, electrons: entry.electrons, mol: isUnknown(entry.mol) ? null : entry.mol };
  }
  var ox = [], rd = [], i;
  for (i = 0; i < oxidants.length; i++) {
    var po = parseAgent(oxidants[i], '氧化剂');
    if (!po.ok) return po;
    ox.push(po);
  }
  for (i = 0; i < reductants.length; i++) {
    var pr = parseAgent(reductants[i], '还原剂');
    if (!pr.ok) return pr;
    rd.push(pr);
  }
  function symStr(it) { return 'n(' + it.name + ')×' + fmtNum(it.electrons); }
  function subStr(it) { return it.mol === null ? symStr(it) : fmtNum(it.mol) + '×' + fmtNum(it.electrons); }
  var eqSym = ox.map(symStr).join(' + ') + ' = ' + rd.map(symStr).join(' + ');
  var eqSub = ox.map(subStr).join(' + ') + ' = ' + rd.map(subStr).join(' + ');
  var equations = [eqSym];
  if (eqSub !== eqSym) equations.push(eqSub);
  var steps = [
    { title: '列电子守恒式', detail: '氧化还原反应中，氧化剂得到的电子总数 = 还原剂失去的电子总数，即：n(氧化剂)×每分子得电子数 = n(还原剂)×每分子失电子数。' }
  ];
  var unknowns = [];
  for (i = 0; i < ox.length; i++) if (ox[i].mol === null) unknowns.push({ it: ox[i], side: 'ox' });
  for (i = 0; i < rd.length; i++) if (rd[i].mol === null) unknowns.push({ it: rd[i], side: 'rd' });
  var out = { ok: true, equations: equations, steps: steps };
  if (unknowns.length === 1) {
    var sumOx = 0, sumRd = 0;
    for (i = 0; i < ox.length; i++) if (ox[i].mol !== null) sumOx += ox[i].mol * ox[i].electrons;
    for (i = 0; i < rd.length; i++) if (rd[i].mol !== null) sumRd += rd[i].mol * rd[i].electrons;
    var u = unknowns[0];
    var xVal = u.side === 'ox' ? (sumRd - sumOx) / u.it.electrons : (sumOx - sumRd) / u.it.electrons;
    if (xVal < 0 || !isFinite(xVal)) return fail('数据矛盾：按电子守恒求得的物质的量为负值，请检查已知量');
    out.solution = { formula: u.it.name, mol: roundSmart(xVal) };
    steps.push({
      title: '代入求解',
      detail: '已知氧化剂得电子总数（不含未知项）= ' + fmtNum(sumOx) + ' mol，还原剂失电子总数（不含未知项）= ' + fmtNum(sumRd) + ' mol，\n解得 n(' + u.it.name + ') = ' + fmtNum(xVal) + ' mol。'
    });
  } else if (unknowns.length === 0) {
    var sO = 0, sR = 0;
    for (i = 0; i < ox.length; i++) sO += ox[i].mol * ox[i].electrons;
    for (i = 0; i < rd.length; i++) sR += rd[i].mol * rd[i].electrons;
    steps.push({
      title: '代入检验',
      detail: '氧化剂得电子总数 = ' + fmtNum(sO) + ' mol，还原剂失电子总数 = ' + fmtNum(sR) + ' mol，' +
        (Math.abs(sO - sR) < 1e-9 ? '两边相等，电子守恒成立。' : '两边不相等，数据可能有误，请检查物质的量与得失电子数。')
    });
  } else {
    steps.push({ title: '求解说明', detail: '未知物质的量有 ' + unknowns.length + ' 个，仅凭电子守恒无法唯一求解，需结合其他条件。' });
  }
  return out;
}

/* ---- 模板 3：质量守恒配平辅助（列原子守恒方程组） ---- */
function conserveMassEquation(spec) {
  var sp = splitEquation(spec.equation);
  if (!sp.ok) return sp;
  var elements = collectElements(sp.terms);
  var withCharge = false;
  for (var i = 0; i < sp.terms.length; i++) if (sp.terms[i].charge !== 0) withCharge = true;
  var letters = [];
  for (var li = 0; li < sp.terms.length; li++) letters.push(coefLetter(li) + '=' + sp.terms[li].unitNormalized);
  return {
    ok: true,
    equations: atomEquations(sp.terms, sp.nReact, elements, withCharge),
    steps: [
      { title: '设系数', detail: '设各物质的系数依次为：' + letters.join('，') + '。' },
      { title: '列质量守恒方程组', detail: '质量守恒的微观本质是原子守恒：反应前后各元素原子总数相等，对每种元素列一个方程。解此方程组并取最小正整数比，即得配平系数。' }
    ]
  };
}

/* ---- 模板 4：元素守恒 ---- */
function conserveElement(spec) {
  if (!spec.element || !ELEMENTS[spec.element]) return fail('元素守恒需要给出有效的元素符号 element（如 "Fe"）');
  if (!spec.from || !spec.from.formula) return fail('元素守恒需要给出含该元素的起始物质 from.formula');
  if (!spec.to || !spec.to.formula) return fail('元素守恒需要给出含该元素的目标物质 to.formula');
  var pf = parseFormulaInternal(spec.from.formula);
  if (!pf.ok) return fail('起始物质“' + spec.from.formula + '”解析失败：' + pf.error);
  var pt = parseFormulaInternal(spec.to.formula);
  if (!pt.ok) return fail('目标物质“' + spec.to.formula + '”解析失败：' + pt.error);
  var a = pf.unitAtoms[spec.element] || 0;
  var b = pt.unitAtoms[spec.element] || 0;
  if (a === 0) return fail('元素“' + spec.element + '”不在起始物质“' + pf.unitNormalized + '”中');
  if (b === 0) return fail('元素“' + spec.element + '”不在目标物质“' + pt.unitNormalized + '”中');
  var nFrom, howFrom;
  if (spec.from.mol !== undefined && spec.from.mol !== null) {
    if (!isNum(spec.from.mol) || spec.from.mol <= 0) return fail('from.mol 须为大于 0 的数字');
    nFrom = spec.from.mol;
    howFrom = 'n(' + pf.unitNormalized + ') = ' + fmtNum(nFrom) + ' mol（直接给出）';
  } else if (spec.from.mass !== undefined && spec.from.mass !== null) {
    if (!isNum(spec.from.mass) || spec.from.mass <= 0) return fail('from.mass 须为大于 0 的数字');
    var mm = molarMassOf(spec.from.formula);
    if (!mm.ok) return mm;
    nFrom = spec.from.mass / mm.value;
    howFrom = mm.detail + '；n(' + pf.unitNormalized + ') = ' + fmtNum(spec.from.mass) + ' / ' + fmtNum(mm.value) + ' = ' + fmtNum(nFrom) + ' mol';
  } else {
    return fail('起始物质须给出 mol（物质的量）或 mass（质量）');
  }
  var nTo = nFrom * a / b;
  var mt = molarMassOf(spec.to.formula);
  if (!mt.ok) return mt;
  var massTo = nTo * mt.value;
  function coefStr(n, name) { return (n > 1 ? n : '') + 'n(' + name + ')'; }
  return {
    ok: true,
    equations: [spec.element + ' 元素守恒：' + coefStr(a, pf.unitNormalized) + ' = ' + coefStr(b, pt.unitNormalized)],
    result: { mol: roundSmart(nTo), mass: roundSmart(massTo) },
    steps: [
      { title: '列元素守恒式', detail: '反应前后 ' + spec.element + ' 原子总数不变：' + a + ' 个 ' + spec.element + ' 来自每分子 ' + pf.unitNormalized + '，' + b + ' 个 ' + spec.element + ' 进入每分子 ' + pt.unitNormalized + '。' },
      { title: '求起始物质的量', detail: howFrom },
      { title: '求目标物质的量', detail: 'n(' + pt.unitNormalized + ') = ' + fmtNum(nFrom) + ' × ' + a + ' / ' + b + ' = ' + fmtNum(nTo) + ' mol；m = ' + fmtNum(nTo) + ' × ' + fmtNum(mt.value) + ' = ' + fmtNum(massTo) + ' g。' }
    ]
  };
}

/* ---- 模板 5：稀释守恒 c₁V₁ = c₂V₂ ---- */
function conserveDilution(spec) {
  if (!isNum(spec.c1) || spec.c1 <= 0) return fail('稀释守恒需要给出原浓度 c1（大于 0 的数字）');
  if (!isNum(spec.v1) || spec.v1 <= 0) return fail('稀释守恒需要给出原体积 v1（大于 0 的数字）');
  var hasC2 = spec.c2 !== undefined && spec.c2 !== null;
  var hasV2 = spec.v2 !== undefined && spec.v2 !== null;
  if (hasC2 === hasV2) return fail('稀释守恒须恰好给出稀释后浓度 c2 或稀释后体积 v2 其中之一，求解另一个');
  var eq = 'c₁V₁ = c₂V₂';
  if (hasV2) {
    if (!isNum(spec.v2) || spec.v2 <= 0) return fail('稀释后体积 v2 须为大于 0 的数字');
    var c2 = spec.c1 * spec.v1 / spec.v2;
    return {
      ok: true,
      equations: [eq, fmtNum(spec.c1) + '×' + fmtNum(spec.v1) + ' = c₂×' + fmtNum(spec.v2)],
      result: { c2: roundSmart(c2) },
      steps: [
        { title: '列稀释守恒式', detail: '稀释前后溶质的物质的量不变：c₁V₁ = c₂V₂。' },
        { title: '代入求解', detail: 'c₂ = c₁V₁/V₂ = ' + fmtNum(spec.c1) + ' × ' + fmtNum(spec.v1) + ' / ' + fmtNum(spec.v2) + ' = ' + fmtNum(c2) + ' mol/L。' }
      ]
    };
  }
  if (!isNum(spec.c2) || spec.c2 <= 0) return fail('稀释后浓度 c2 须为大于 0 的数字');
  var v2 = spec.c1 * spec.v1 / spec.c2;
  return {
    ok: true,
    equations: [eq, fmtNum(spec.c1) + '×' + fmtNum(spec.v1) + ' = ' + fmtNum(spec.c2) + '×V₂'],
    result: { v2: roundSmart(v2) },
    steps: [
      { title: '列稀释守恒式', detail: '稀释前后溶质的物质的量不变：c₁V₁ = c₂V₂。' },
      { title: '代入求解', detail: 'V₂ = c₁V₁/c₂ = ' + fmtNum(spec.c1) + ' × ' + fmtNum(spec.v1) + ' / ' + fmtNum(spec.c2) + ' = ' + fmtNum(v2) + '（与 V₁ 单位一致）。' }
    ]
  };
}

/* ---- 模板 6：离子方程式电荷守恒检验 ---- */
function conserveChargeCheck(spec) {
  var sp = splitEquation(spec.equation);
  if (!sp.ok) return sp;
  function sideCharge(from, to, label) {
    var parts = [], sum = 0;
    for (var i = from; i < to; i++) {
      var t = sp.terms[i];
      if (t.charge === 0) continue;
      sum += t.charge * t.coefficient;
      parts.push('(' + (t.charge > 0 ? '+' : '') + t.charge + ')' + (t.coefficient > 1 ? '×' + t.coefficient : '') + ' [' + t.unitNormalized + ']');
    }
    return { label: label, text: label + '总电荷：' + (parts.length ? parts.join(' + ') + ' = ' + (sum > 0 ? '+' : '') + sum : '0'), sum: sum };
  }
  var left = sideCharge(0, sp.nReact, '反应物');
  var right = sideCharge(sp.nReact, sp.terms.length, '生成物');
  var balanced = left.sum === right.sum;
  return {
    ok: true,
    equations: [left.text, right.text],
    balanced: balanced,
    steps: [
      { title: '计算两侧总电荷', detail: '离子方程式左右两边电荷总数应相等（系数×离子电荷之和）。' },
      { title: '检验结论', detail: balanced
        ? '两侧总电荷相等（' + (left.sum > 0 ? '+' : '') + left.sum + '），电荷守恒成立。'
        : '两侧总电荷不相等（反应物 ' + (left.sum > 0 ? '+' : '') + left.sum + '，生成物 ' + (right.sum > 0 ? '+' : '') + right.sum + '），电荷不守恒，请检查方程式的配平或离子电荷。' }
    ]
  };
}

function conserve(spec) {
  if (!spec || typeof spec !== 'object') {
    return fail('请传入守恒计算参数，如 {template: "solution-charge", cations: [...], anions: [...]}');
  }
  switch (spec.template) {
    case 'solution-charge': return conserveSolutionCharge(spec);
    case 'redox-electron': return conserveRedoxElectron(spec);
    case 'mass-equation': return conserveMassEquation(spec);
    case 'element-conserve': return conserveElement(spec);
    case 'dilution': return conserveDilution(spec);
    case 'charge-check': return conserveChargeCheck(spec);
    default:
      return fail('未知的守恒模板“' + spec.template + '”，支持：solution-charge / redox-electron / mass-equation / element-conserve / dilution / charge-check');
  }
}

/* ============================== 公开 API ============================== */
var ChemSolveEngine = {
  version: '2.2.0',
  parseFormula: safe(parseFormula),
  balance: safe(balance),
  ph: safe(ph),
  stoich: safe(stoich),
  conserve: safe(conserve),
  molarMass: safe(molarMass)
};

root.ChemSolveEngine = ChemSolveEngine;
/* Node 环境（测试用）：同时支持 require 引入，不影响浏览器使用。 */
if (typeof module !== 'undefined' && module.exports) module.exports = ChemSolveEngine;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
