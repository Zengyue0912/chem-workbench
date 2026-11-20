/* ============================================================================
 * 高中化学 3D 考点工作台 — 确定性化学计算引擎测试集（v2.2.0 / A 组）
 *
 * 运行方法（零依赖，纯 Node 断言，无测试框架）：
 *   cd ~/workspace/chem-workbench/optimized
 *   node tests/solve-engine.test.js
 *
 * 运行后打印“通过 X/Y”；全部通过时退出码为 0，任一失败时退出码为 1。
 * 本文件不打包进首屏，不进入 sw.js 预缓存。
 * ========================================================================== */
'use strict';

var E = require('../js/workbench-solve-engine.js');
var Emin = require('../js/workbench-solve-engine.min.js');

var passed = 0, total = 0, failures = [];

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failures.push(name + ' — ' + e.message);
    console.log('  ✗ ' + name + ' — ' + e.message);
  }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + '期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a));
}
function approx(a, b, tol, msg) {
  if (typeof a !== 'number' || Math.abs(a - b) > tol) {
    throw new Error((msg || '') + '期望约 ' + b + '（误差<' + tol + '），实际 ' + a);
  }
}
function ok(res, msg) {
  if (!res || res.ok !== true) throw new Error((msg || '') + '期望 ok:true，实际 ' + JSON.stringify(res));
}
function notOk(res, msg) {
  if (!res || res.ok !== false || typeof res.error !== 'string' || !res.error) {
    throw new Error((msg || '') + '期望 ok:false 并带中文 error，实际 ' + JSON.stringify(res));
  }
}
function atomsEq(actual, expected, msg) {
  var ka = Object.keys(actual || {}).sort(), ke = Object.keys(expected).sort();
  eq(JSON.stringify(ka), JSON.stringify(ke), (msg || '') + '元素集合不一致：');
  for (var i = 0; i < ke.length; i++) eq(actual[ke[i]], expected[ke[i]], (msg || '') + ke[i] + ' 个数：');
}
function balanceCase(name, input, coeffs) {
  test('配平：' + name, function () {
    var r = E.balance(input);
    ok(r, 'balance(' + input + ')：');
    eq(JSON.stringify(r.coefficients), JSON.stringify(coeffs), '系数：');
    if (!r.balanced || r.balanced.indexOf('→') === -1) throw new Error('balanced 应含箭头 →，实际 ' + r.balanced);
    if (!r.steps || r.steps.length < 4) throw new Error('steps 应至少 4 步，实际 ' + (r.steps && r.steps.length));
    var last = r.steps[r.steps.length - 1];
    if (last.title.indexOf('检验') === -1 || last.detail.indexOf('检验通过') === -1) {
      throw new Error('最后一步应为原子守恒检验且通过，实际 ' + JSON.stringify(last));
    }
  });
}

/* ============================== 一、方程式配平（18 个） ============================== */
console.log('\n一、方程式配平');
balanceCase('氢气燃烧', 'H2 + O2 -> H2O', [2, 1, 2]);
balanceCase('丙烷燃烧', 'C3H8 + O2 -> CO2 + H2O', [1, 5, 3, 4]);
balanceCase('高锰酸钾与浓盐酸', 'KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O', [2, 16, 2, 2, 5, 8]);
balanceCase('铁与稀硝酸', 'Fe + HNO3 -> Fe(NO3)3 + NO + H2O', [1, 4, 1, 1, 2]);
balanceCase('铜与浓硫酸', 'Cu + H2SO4 -> CuSO4 + SO2 + H2O', [1, 2, 1, 1, 2]);
balanceCase('过氧化钠与二氧化碳', 'Na2O2 + CO2 -> Na2CO3 + O2', [2, 2, 2, 1]);
balanceCase('铝热反应', 'Al + Fe2O3 -> Fe + Al2O3', [2, 1, 2, 1]);
balanceCase('氨的催化氧化', 'NH3 + O2 -> NO + H2O', [4, 5, 4, 6]);
balanceCase('电解水', 'H2O -> H2 + O2', [2, 2, 1]);
balanceCase('碳酸钙高温分解', 'CaCO3 -> CaO + CO2', [1, 1, 1]);
balanceCase('二硫化亚铁煅烧', 'FeS2 + O2 -> Fe2O3 + SO2', [4, 11, 2, 8]);
balanceCase('氯气与氢氧化钠', 'Cl2 + NaOH -> NaCl + NaClO + H2O', [1, 2, 1, 1, 1]);
balanceCase('二氧化硫催化氧化', 'SO2 + O2 -> SO3', [2, 1, 2]);
balanceCase('乙醇燃烧', 'C2H5OH + O2 -> CO2 + H2O', [1, 3, 2, 3]);
balanceCase('甲烷燃烧', 'CH4 + O2 -> CO2 + H2O', [1, 2, 1, 2]);
balanceCase('中文箭头与等号输入', 'H2 + O2 → H2O', [2, 1, 2]);
balanceCase('离子方程式（电荷守恒）', 'Fe2+ + MnO4- + H+ -> Fe3+ + Mn2+ + H2O', [5, 1, 8, 5, 1, 4]);
balanceCase('离子方程式无空格写法', 'Fe2++MnO4-+H+->Fe3++Mn2++H2O', [5, 1, 8, 5, 1, 4]);
test('配平：元素不守恒应报错（H2+O2→CO2，碳只在一侧）', function () {
  notOk(E.balance('H2 + O2 -> CO2'));
});
test('配平：无正整数解应报错（Na+H2O→NaOH，氢无法守恒）', function () {
  notOk(E.balance('Na + H2O -> NaOH'));
});

/* ============================== 二、pH 计算（10 个） ============================== */
console.log('\n二、pH 计算');
function phCase(name, spec, expected) {
  test('pH：' + name, function () {
    var r = E.ph(spec);
    ok(r, 'ph(' + JSON.stringify(spec) + ')：');
    approx(r.value, expected, 0.01, 'pH 值：');
    if (!r.steps || r.steps.length < 2) throw new Error('steps 应至少 2 步');
  });
}
phCase('强酸 0.01 mol/L', { kind: 'strong-acid', c: 0.01 }, 2);
phCase('强酸 0.001 mol/L', { kind: 'strong-acid', c: 0.001 }, 3);
phCase('强碱 0.01 mol/L', { kind: 'strong-base', c: 0.01 }, 12);
phCase('强碱 0.1 mol/L', { kind: 'strong-base', c: 0.1 }, 13);
phCase('强酸稀释 10 倍', { kind: 'dilute', c: 0.01, factor: 10 }, 3);
phCase('等体积等浓度酸碱混合（恰好中和）', { kind: 'mix', c: 0.01, v: 100, c2: 0.01, v2: 100 }, 7);
phCase('一元弱酸（醋酸 Ka=1.8e-5，c=0.1）', { kind: 'weak-acid', c: 0.1, Ka: 1.8e-5 }, 2.875);
phCase('酸过量混合（0.02 酸 100mL + 0.01 碱 100mL）', { kind: 'mix', c: 0.02, v: 100, c2: 0.01, v2: 100 }, 2.30);
test('pH：浓度为 0 应报错', function () {
  notOk(E.ph({ kind: 'strong-acid', c: 0 }));
});
test('pH：浓度超过 10 应报错', function () {
  notOk(E.ph({ kind: 'strong-acid', c: 20 }));
});

/* ============================== 三、化学计量（8 个） ============================== */
console.log('\n三、化学计量');
test('计量：49 g H2SO4 的物质的量为 0.5 mol', function () {
  var r = E.stoich({ kind: 'n-mass', mass: 49, formula: 'H2SO4' });
  ok(r);
  approx(r.result.n, 0.5, 1e-9);
  eq(r.result.M, 98);
});
test('计量：2 mol CO2 的质量为 88 g', function () {
  var r = E.stoich({ kind: 'n-mass', n: 2, formula: 'CO2' });
  ok(r);
  approx(r.result.mass, 88, 1e-9);
});
test('计量：0.5 mol 气体标准状况体积为 11.2 L', function () {
  var r = E.stoich({ kind: 'n-volume', n: 0.5 });
  ok(r);
  approx(r.result.volume, 11.2, 1e-9);
  eq(r.result.Vm, 22.4);
});
test('计量：1 mol 粒子数为 6.02×10²³', function () {
  var r = E.stoich({ kind: 'n-particles', n: 1 });
  ok(r);
  approx(r.result.particles, 6.02e23, 1e21);
});
test('计量：0.5 mol 溶于 2 L，浓度为 0.25 mol/L', function () {
  var r = E.stoich({ kind: 'molarity', n: 0.5, volume: 2 });
  ok(r);
  approx(r.result.c, 0.25, 1e-9);
});
test('计量：按量计算（4 g H2 + 32 g O2 生成 36 g H2O，恰好反应）', function () {
  var r = E.stoich({
    kind: 'reaction', equation: 'H2 + O2 -> H2O',
    given: [{ formula: 'H2', mass: 4 }, { formula: 'O2', mass: 32 }],
    target: 'H2O'
  });
  ok(r);
  approx(r.result.targetMol, 2, 1e-9);
  approx(r.result.targetMass, 36, 1e-9);
  eq(r.result.exactReaction, true);
});
test('计量：过量判断（13 g Zn + 0.5 mol HCl，Zn 不足，生成 0.2 mol H2）', function () {
  var r = E.stoich({
    kind: 'reaction', equation: 'Zn + HCl -> ZnCl2 + H2',
    given: [{ formula: 'Zn', mass: 13 }, { formula: 'HCl', mol: 0.5 }],
    target: 'H2'
  });
  ok(r);
  eq(r.result.limiting, 'Zn');
  eq(r.result.exactReaction, false);
  approx(r.result.targetMol, 0.2, 1e-9);
  approx(r.result.targetVolume, 4.48, 1e-9);
});
test('计量：产率（10 g CaCO3 分解，80% 产率得 3.52 g CO2）', function () {
  var r = E.stoich({
    kind: 'reaction', equation: 'CaCO3 -> CaO + CO2',
    given: [{ formula: 'CaCO3', mass: 10 }],
    target: 'CO2', yield: 0.8
  });
  ok(r);
  approx(r.result.theoreticalMass, 4.4, 1e-9);
  approx(r.result.actualMass, 3.52, 1e-9);
});

/* ============================== 四、化学式解析器（11 个） ============================== */
console.log('\n四、化学式解析器');
test('解析：H2O', function () {
  var r = E.parseFormula('H2O');
  ok(r);
  atomsEq(r.atoms, { H: 2, O: 1 });
  eq(r.charge, 0);
  eq(r.normalized, 'H₂O');
});
test('解析：括号 Al2(SO4)3', function () {
  var r = E.parseFormula('Al2(SO4)3');
  ok(r);
  atomsEq(r.atoms, { Al: 2, S: 3, O: 12 });
  eq(r.normalized, 'Al₂(SO₄)₃');
});
test('解析：结晶水 CuSO4·5H2O', function () {
  var r = E.parseFormula('CuSO4·5H2O');
  ok(r);
  atomsEq(r.atoms, { Cu: 1, S: 1, O: 9, H: 10 });
  eq(r.normalized, 'CuSO₄·5H₂O');
});
test('解析：电荷 SO4^2-（ASCII 写法）', function () {
  var r = E.parseFormula('SO4^2-');
  ok(r);
  atomsEq(r.atoms, { S: 1, O: 4 });
  eq(r.charge, -2);
  eq(r.normalized, 'SO₄²⁻');
});
test('解析：电荷 SO₄²⁻（Unicode 上下标）', function () {
  var r = E.parseFormula('SO₄²⁻');
  ok(r);
  atomsEq(r.atoms, { S: 1, O: 4 });
  eq(r.charge, -2);
});
test('解析：嵌套括号与电荷 [Cu(NH3)4]2+', function () {
  var r = E.parseFormula('[Cu(NH3)4]2+');
  ok(r);
  atomsEq(r.atoms, { Cu: 1, N: 4, H: 12 });
  eq(r.charge, 2);
  eq(r.normalized, '[Cu(NH₃)₄]²⁺');
});
test('解析：单元素离子 Fe3+（数字为电荷数）', function () {
  var r = E.parseFormula('Fe3+');
  ok(r);
  atomsEq(r.atoms, { Fe: 1 });
  eq(r.charge, 3);
});
test('解析：多元素离子 NH4+（数字为下标，电荷 +1）', function () {
  var r = E.parseFormula('NH4+');
  ok(r);
  atomsEq(r.atoms, { N: 1, H: 4 });
  eq(r.charge, 1);
});
test('解析：状态符号 Ca(OH)2(s)（忽略但保留）', function () {
  var r = E.parseFormula('Ca(OH)2(s)');
  ok(r);
  atomsEq(r.atoms, { Ca: 1, O: 2, H: 2 });
  eq(r.state, '(s)');
  eq(r.normalized, 'Ca(OH)₂(s)');
});
test('解析：前置系数 2H2O（原子数计入系数）', function () {
  var r = E.parseFormula('2H2O');
  ok(r);
  atomsEq(r.atoms, { H: 4, O: 2 });
  eq(r.coefficient, 2);
  eq(r.normalized, '2H₂O');
});
test('解析：非法输入应报错而非崩溃', function () {
  notOk(E.parseFormula('Xx2O'), '未知元素：');
  notOk(E.parseFormula('H2O('), '括号不匹配：');
  notOk(E.parseFormula('h2o'), '小写开头：');
  notOk(E.parseFormula(''), '空字符串：');
  notOk(E.parseFormula('H2O$'), '非法字符：');
  notOk(E.parseFormula('H0'), '下标为 0：');
});

/* ============================== 五、守恒法模板（6 个） ============================== */
console.log('\n五、守恒法模板');
test('守恒：溶液电荷守恒（0.1 Na+ / 0.05 Cl-，求 SO4²⁻ 为 0.025）', function () {
  var r = E.conserve({
    template: 'solution-charge',
    cations: [{ ion: 'Na+', c: 0.1 }],
    anions: [{ ion: 'Cl-', c: 0.05 }, { ion: 'SO4^2-', c: 'x' }]
  });
  ok(r);
  if (!r.equations || r.equations.length < 1) throw new Error('应返回列式 equations');
  approx(r.solution.value, 0.025, 1e-9);
});
test('守恒：氧化还原电子守恒（0.1 mol KMnO4 得 5e，求 Fe²⁺ 为 0.5 mol）', function () {
  var r = E.conserve({
    template: 'redox-electron',
    oxidants: [{ formula: 'KMnO4', electrons: 5, mol: 0.1 }],
    reductants: [{ formula: 'Fe2+', electrons: 1, mol: 'x' }]
  });
  ok(r);
  approx(r.solution.mol, 0.5, 1e-9);
});
test('守恒：质量守恒配平辅助（H2+O2→H2O 列出 H、O 两式）', function () {
  var r = E.conserve({ template: 'mass-equation', equation: 'H2 + O2 -> H2O' });
  ok(r);
  eq(r.equations.length, 2);
});
test('守恒：元素守恒（0.5 mol Fe2O3 含 Fe 1 mol）', function () {
  var r = E.conserve({
    template: 'element-conserve', element: 'Fe',
    from: { formula: 'Fe2O3', mol: 0.5 }, to: { formula: 'Fe' }
  });
  ok(r);
  approx(r.result.mol, 1, 1e-9);
  approx(r.result.mass, 56, 1e-9);
});
test('守恒：稀释守恒（0.1 mol/L 100 mL 稀释至 500 mL，c2=0.02）', function () {
  var r = E.conserve({ template: 'dilution', c1: 0.1, v1: 100, v2: 500 });
  ok(r);
  approx(r.result.c2, 0.02, 1e-9);
});
test('守恒：离子方程式电荷检验（配平后的高锰酸钾氧化亚铁）', function () {
  var r = E.conserve({ template: 'charge-check', equation: '5Fe2+ + MnO4- + 8H+ -> 5Fe3+ + Mn2+ + 4H2O' });
  ok(r);
  eq(r.balanced, true);
  eq(r.equations.length, 2);
});

/* ============================== 六、.min 版一致性（2 个） ============================== */
console.log('\n六、.min 版一致性');
test('.min：API 契约完整（6 个方法均可调用）', function () {
  var methods = ['parseFormula', 'balance', 'ph', 'stoich', 'conserve', 'molarMass'];
  for (var i = 0; i < methods.length; i++) {
    if (typeof Emin[methods[i]] !== 'function') throw new Error('.min 缺少方法 ' + methods[i]);
    if (typeof E[methods[i]] !== 'function') throw new Error('源码缺少方法 ' + methods[i]);
  }
  eq(Emin.version, E.version);
});
test('.min：配平结果与源码一致', function () {
  var a = Emin.balance('KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O');
  var b = E.balance('KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O');
  ok(a);
  eq(JSON.stringify(a.coefficients), JSON.stringify(b.coefficients));
  eq(a.balanced, b.balanced);
  approx(Emin.ph({ kind: 'strong-acid', c: 0.01 }).value, 2, 1e-9);
});

/* ============================== 汇总 ============================== */
console.log('\n通过 ' + passed + '/' + total);
if (failures.length) {
  console.log('失败用例：');
  for (var f = 0; f < failures.length; f++) console.log('  - ' + failures[f]);
  process.exit(1);
}
