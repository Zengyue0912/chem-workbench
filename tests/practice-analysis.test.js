/* ============================================================================
 * 高中化学 3D 考点工作台 — 同步练习结构化解析测试集（v2.4.0 A 组）
 *
 * 运行方法（零依赖，纯 Node 断言，无测试框架）：
 *   cd ~/workspace/chem-workbench/merged
 *   node tests/practice-analysis.test.js
 *
 * 覆盖：ChemPracticeCore.validate 对字符串 / 结构化两种解析形式的校验、
 * analysisText 文本化、analysisHTML 分段渲染、内置 60 题数据完整性
 * （全部结构化解析、答案快照）、AI 讲题按钮的静态接线检查。
 * 不发真实网络请求，不需要真实 API Key。
 * 本文件不打包进首屏，不进入 sw.js 预缓存。
 * ========================================================================== */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* 合并版布局：练习核心在 public/index.html 的内联块 #9 里（单文件应用）。
   按注释锚点把该 <script> 块切出来当 SRC；其余切片逻辑与 GitHub 版相同。 */
const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const blockMark = HTML.indexOf('/* Chemistry Studio upgrade');
const blockStart = HTML.lastIndexOf('<script>', blockMark);
const blockEnd = HTML.indexOf('</script>', blockMark);
const SRC = HTML.slice(blockStart, blockEnd);

/* ---------- 取出 ChemPracticeCore 纯逻辑 IIFE（不依赖 DOM） ---------- */
const exportIdx = SRC.indexOf('root.ChemPracticeCore={');
const coreStart = SRC.lastIndexOf("(function(root){'use strict';", exportIdx);
const coreEndMark = "})(typeof window==='undefined'?globalThis:window);";
const coreEnd = SRC.indexOf(coreEndMark, exportIdx) + coreEndMark.length;
const coreSrc = SRC.slice(coreStart, coreEnd);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox);
const C = sandbox.ChemPracticeCore;

/* ---------- 取出 analysisHTML（练习 UI 里的解析渲染函数） ---------- */
const htmlLine = SRC.split('\n').find(l => l.startsWith('function analysisHTML(a){'));
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const analysisHTML = new Function('E', htmlLine + '; return analysisHTML;')(E);

/* ---------- 内置题包 ---------- */
const dataLine = SRC.split('\n').find(l => l.startsWith('window.CHEM_PRACTICE_DEFAULT='));
const PACK = JSON.parse(dataLine.replace(/^window\.CHEM_PRACTICE_DEFAULT=/, '').replace(/;$/, ''));

/* 答案快照：60 题的答案（单选/多选为索引，填空/实验为各小题答案，开放题为 null）。
 * s14 已按正确化学结论修正为 1（原数据为 2，见 A 组汇报）。 */
var EXPECTED_ANSWERS = {"s01":0,"s02":2,"s03":1,"s04":1,"s05":1,"s06":2,"s07":3,"s08":1,"s09":2,"s10":0,"s11":1,"s12":1,"m01":[0,1,3],"m02":[0,1,3],"m03":[0,1,3],"m04":[1,2,3],"f01":[2.925,["偏低","降低"]],"f02":[0.06,0.04],"f03":[0.4,0.5333],"f04":[0.01,12],"f05":[["Cl","氯"],17,["强酸"]],"f06":[2,6,["C2H6O","C₂H₆O"]],"f07":[0.1,0.1],"f08":[0.1,0.001],"e01":[25,0.1,null,null],"e02":[2.65,250,null,null],"e03":[["先检漏","检漏","先检查气密性","检查气密性"],null,null],"e04":[["AB","A和B","A与B"],["AC","A和C","A与C"],2,null],"e05":[["Na+","Na⁺","钠离子"],["BaSO4","BaSO₄"],["Na2SO4","Na₂SO₄"],null],"e06":[["降温","冷却","降温结晶","冷却结晶"],null,null],"s13":1,"s14":1,"s15":1,"s16":2,"s17":1,"s18":1,"s19":1,"s20":1,"s21":1,"s22":2,"s23":1,"s24":0,"s25":1,"s26":0,"m05":[0,2],"m06":[0,1,3],"m07":[1,2,3],"m08":[0,1,2],"m09":[0,1,2],"f09":[2,["既有酸性又有还原性","酸性且还原性","还原性和酸性"]],"f10":[0.1,2.24],"f11":[0.2,0.3,6.72],"f12":[["C","碳"],["N","氮"],["F","氟"]],"f13":[0.0001,4],"f14":[0.2,8.8],"f15":[3,8,["C3H8","C₃H₈"]],"f16":[60,5.625],"e07":[null,["干燥","干燥氯气","除去水蒸气"],null,null],"e08":[["CO₂和H₂O","H2O和CO2","二氧化碳和水","水和二氧化碳"],1.68,83.2],"e09":[null,null,null]};

/* ---------- 断言工具 ---------- */
let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  ok - ' + name); }
  else { failed++; console.log('  FAIL - ' + name + (extra ? ' :: ' + extra : '')); }
}
function throws(name, fn) {
  try { fn(); ok(name, false, '应当抛错但没有抛错'); }
  catch (e) { ok(name, true); }
}

/* ---------- 构造最小题包 ---------- */
function packWith(analysis) {
  return {
    schema: 'chem-practice/2', id: 't', version: '1', title: 'T', description: 'D',
    topics: ['章'], sources: [],
    questions: [{ id: 'q1', topic: '章', type: 'single', title: '题', stem: '干', analysis, source: 'S', level: '巩固', points: 4, options: ['A', 'B'], answer: 0 }]
  };
}

/* ================= 1. validate：两种解析形式 ================= */
(function () {
  const s = C.validate(packWith('老解析字符串'));
  ok('validate 接受字符串解析', s.questions[0].analysis === '老解析字符串');
  const full = { focus: '考离子共存', approach: '先圈条件', steps: ['第一步', '第二步'], pitfalls: '别漏无色' };
  const v = C.validate(packWith(full));
  ok('validate 接受结构化解析', v.questions[0].analysis.focus === '考离子共存' && v.questions[0].analysis.steps.length === 2);
  const partial = C.validate(packWith({ steps: ['只有步骤'] }));
  ok('validate 接受缺字段的结构化解析', partial.questions[0].analysis.steps.length === 1 && partial.questions[0].analysis.focus === '');
  const emptySteps = C.validate(packWith({ focus: '只有考什么', steps: [] }));
  ok('validate 接受 steps 为空数组的结构化解析', emptySteps.questions[0].analysis.focus === '只有考什么');
  const filtered = C.validate(packWith({ steps: ['有效', '', '  ', '也有效'] }));
  ok('validate 过滤 steps 里的空字符串', JSON.stringify(filtered.questions[0].analysis.steps) === JSON.stringify(['有效', '也有效']));
  const longFocus = C.validate(packWith({ focus: 'x'.repeat(2001), steps: ['有效'] }));
  ok('validate 对超长字段按缺失处理而不崩溃', longFocus.questions[0].analysis.focus === '' && longFocus.questions[0].analysis.steps.length === 1);
  throws('validate 拒绝空对象解析', () => C.validate(packWith({})));
  throws('validate 拒绝数字解析', () => C.validate(packWith(123)));
  throws('validate 拒绝缺失解析', () => C.validate(packWith(undefined)));
  throws('validate 拒绝数组解析', () => C.validate(packWith(['a'])));
  throws('validate 拒绝空字符串解析', () => C.validate(packWith('   ')));
  const parsed = C.parse(JSON.stringify(packWith(full)));
  ok('parse 可导入含结构化解析的题包', parsed.questions[0].analysis.approach === '先圈条件');
})();

/* ================= 2. analysisText ================= */
(function () {
  ok('analysisText 原样返回字符串', C.analysisText('老解析') === '老解析');
  const t = C.analysisText({ focus: 'F', approach: 'A', steps: ['S1', 'S2'], pitfalls: 'P' });
  ok('analysisText 含四个小标题', t.indexOf('考什么：F') >= 0 && t.indexOf('怎么想：A') >= 0 && t.indexOf('分步详解：') >= 0 && t.indexOf('易错点：P') >= 0);
  ok('analysisText 步骤带编号', t.indexOf('1. S1') >= 0 && t.indexOf('2. S2') >= 0);
  const p = C.analysisText({ steps: ['只有步骤'] });
  ok('analysisText 缺字段时只输出已有字段', p.indexOf('考什么') < 0 && p.indexOf('1. 只有步骤') >= 0);
  ok('analysisText 对 null 返回空串', C.analysisText(null) === '');
  ok('analysisText 对 undefined 返回空串', C.analysisText(undefined) === '');
  ok('analysisText 对数组返回空串', C.analysisText(['x']) === '');
  ok('analysisText 对空对象返回空串', C.analysisText({}) === '');
})();

/* ================= 3. analysisHTML ================= */
(function () {
  const s = analysisHTML('老解析字符串');
  ok('analysisHTML 字符串解析单段显示', s === '<p>老解析字符串</p>');
  const h = analysisHTML({ focus: 'F', approach: 'A', steps: ['S1', 'S2'], pitfalls: 'P' });
  ok('analysisHTML 结构化解析含四个小标题', h.indexOf('<b>考什么</b>') >= 0 && h.indexOf('<b>怎么想</b>') >= 0 && h.indexOf('<b>分步详解</b>') >= 0 && h.indexOf('<b>易错点</b>') >= 0);
  ok('analysisHTML 步骤用 ol/li 编号', h.indexOf('<ol>') >= 0 && h.indexOf('<li>S1</li>') >= 0 && h.indexOf('<li>S2</li>') >= 0);
  const p = analysisHTML({ focus: 'F' });
  ok('analysisHTML 缺字段时不崩溃且只渲染已有段', p.indexOf('考什么') >= 0 && p.indexOf('怎么想') < 0 && p.indexOf('<ol>') < 0);
  ok('analysisHTML 空对象不崩溃', analysisHTML({}).indexOf('暂无解析') >= 0);
  ok('analysisHTML null 不崩溃', analysisHTML(null) === '<p></p>');
  const x = analysisHTML({ focus: '<img src=x onerror=alert(1)>' });
  ok('analysisHTML 转义 HTML 注入', x.indexOf('<img') < 0 && x.indexOf('&lt;img') >= 0);
})();

/* ================= 4. 内置 60 题数据 ================= */
(function () {
  ok('内置题包共 60 题', PACK.questions.length === 60);
  const allStructured = PACK.questions.every(q => q.analysis && typeof q.analysis === 'object' && !Array.isArray(q.analysis));
  ok('60 题全部为结构化解析', allStructured);
  const allFields = PACK.questions.every(q => {
    const a = q.analysis;
    return typeof a.focus === 'string' && a.focus.trim() && typeof a.approach === 'string' && a.approach.trim()
      && Array.isArray(a.steps) && a.steps.length >= 2 && a.steps.every(s => typeof s === 'string' && s.trim())
      && typeof a.pitfalls === 'string' && a.pitfalls.trim();
  });
  ok('每题四字段齐全且步骤不少于 2 步', allFields);
  let validated = null;
  try { validated = C.validate(PACK); } catch (e) { /* fallthrough */ }
  ok('内置题包通过 validate', !!validated && validated.questions.length === 60);
  const mismatches = [];
  for (const q of PACK.questions) {
    const got = q.options ? q.answer : q.parts.map(p => p.kind === 'manual' ? null : p.answer);
    if (JSON.stringify(got) !== JSON.stringify(EXPECTED_ANSWERS[q.id])) mismatches.push(q.id);
  }
  ok('60 题答案与快照一致', mismatches.length === 0, '不一致：' + mismatches.join(','));
  ok('s14 答案已修正为 B（索引 1）', PACK.questions.find(q => q.id === 's14').answer === 1);
})();

/* ================= 5. AI 讲题按钮静态接线 ================= */
(function () {
  ok('解析区有“让 AI 讲这道题”按钮', SRC.indexOf("B('让 AI 讲这道题','explain')") >= 0);
  ok('点击分发 explain 到 explainWithAI', SRC.indexOf("a==='explain')explainWithAI()") >= 0);
  ok('explainWithAI 调用 window.ChemTutor.send', SRC.indexOf('function explainWithAI()') >= 0 && SRC.indexOf('t.send(prompt.slice(0,2990))') >= 0);
  ok('explainWithAI 附带题干与文本化解析', SRC.indexOf('解析:C.analysisText(q.analysis)') >= 0);
  ok('ChemTutor 不可用时有守卫不抛错', SRC.indexOf("typeof t.send!=='function'") >= 0);
  ok('wb-solution 使用 analysisHTML 渲染', SRC.indexOf('${analysisHTML(q.analysis)}') >= 0);
  ok('不再有未兼容的 E(q.analysis) 直接渲染', SRC.indexOf('E(q.analysis)') < 0);
  ok('不再有未兼容的字符串拼接 q.analysis', SRC.indexOf("'+q.analysis") < 0 && SRC.indexOf('解析:q.analysis') < 0);
})();

console.log('\n通过 ' + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
