/* ============================================================================
 * 高中化学 3D 考点工作台 — 同步练习题库与变式生成器测试集（v2.4.0 F 组）
 *
 * 运行方法（零依赖，纯 Node 断言，无测试框架）：
 *   cd ~/workspace/chem-workbench/merged
 *   node tests/practice-bank.test.js
 *
 * 覆盖：
 *  1) 三库合并：默认 60 + 概念 36 + 真题 25 = 121 题，id 去重，s14 答案修正；
 *  2) 合并后 121 题逐题 schema 校验（id/type/答案范围/分值/解析/主题/来源）；
 *  3) 真实的 ChemPracticeCore.validate()：合并题包（上限 300）与生成题；
 *  4) 变式生成器：同（模板，种子）可复现、7 模板 × 50 种子 schema + 引擎重算、
 *     randomByTopic / variantOf 可复现；
 *  5) 结构化解析渲染冒烟：C.analysisText 对字符串/对象解析的轻量检查
 *     （详细渲染行为见 tests/practice-analysis.test.js，这里不重复）。
 *
 * 加载办法（与 A 组 tests/practice-analysis.test.js 相同）：
 *  练习核心是 public/index.html 内联块 #9 里的浏览器代码，不能直接 require。
 *  用 vm 在沙箱里执行：ChemPracticeCore 纯逻辑 IIFE 单独切片取出；题库数据行、
 *  两个分库文件与 mergePracticeBanks 合并 IIFE 在 window 桩沙箱里按真实页面
 *  顺序执行（分库的 <script> 标签在块 #9 之前，见 index.html）。
 *  生成器与解题引擎是双环境模块，用动态 import 加载后从 globalThis 取 API。
 *
 * 引擎重算方法（见 verifyChecks 的注释）：重放题目 _gen.checks 里记录的每一次
 *  引擎调用（方法 + 参数），用引擎重新计算并比对记录值。
 *
 * 不发真实网络请求，不需要真实 API Key。
 * 本文件不打包进首屏，不进入 sw.js 预缓存。
 * ========================================================================== */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* merged 是 type:module，用动态 import 加载双环境模块（先引擎后生成器，
   与页面顺序一致）；两者在 Node 下把 API 挂在 globalThis 上。 */
await import('../public/workbench-solve-engine.js');
await import('../public/workbench-practice-gen.js');
const E = globalThis.ChemSolveEngine;
const G = globalThis.ChemPracticeGen;

/* 合并版布局：练习核心在 public/index.html 的内联块 #9 里（单文件应用）。
   按注释锚点把该 <script> 块切出来当 SRC；其余切片逻辑与 GitHub 版相同。 */
const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const blockMark = HTML.indexOf('/* Chemistry Studio upgrade');
const blockStart = HTML.lastIndexOf('<script>', blockMark);
const blockEnd = HTML.indexOf('</script>', blockMark);
const SRC = HTML.slice(blockStart, blockEnd);
const TOPICS = ['物质与反应', '元素及其化合物', '结构与有机', '反应原理', '定量分析', '实验探究'];
const TYPES = ['single', 'multi', 'fill', 'experiment'];
const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;

/* ---------- 取出 ChemPracticeCore 纯逻辑 IIFE（与 A 组测试同法） ---------- */
const exportIdx = SRC.indexOf('root.ChemPracticeCore={');
const coreStart = SRC.lastIndexOf("(function(root){'use strict';", exportIdx);
const coreEndMark = "})(typeof window==='undefined'?globalThis:window);";
const coreEnd = SRC.indexOf(coreEndMark, exportIdx) + coreEndMark.length;
const coreSandbox = {};
vm.createContext(coreSandbox);
vm.runInContext(SRC.slice(coreStart, coreEnd), coreSandbox);
const C = coreSandbox.ChemPracticeCore;

/* ---------- 在 window 桩沙箱里按页面顺序加载三库并执行真实合并 ---------- */
const bankSandbox = { window: null, console };
bankSandbox.window = bankSandbox;
vm.createContext(bankSandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'practice-bank-concept.js'), 'utf8'), bankSandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'practice-bank-exam.js'), 'utf8'), bankSandbox);
const dataLine = SRC.split('\n').find(l => l.startsWith('window.CHEM_PRACTICE_DEFAULT='));
vm.runInContext(dataLine, bankSandbox);
const DEFAULT_COUNT = bankSandbox.CHEM_PRACTICE_DEFAULT.questions.length;
const CONCEPT = bankSandbox.CHEM_PRACTICE_CONCEPT;
const EXAM = bankSandbox.CHEM_PRACTICE_EXAM;
const mergeStart = SRC.indexOf('(function mergePracticeBanks(){');
const mergeSrc = SRC.slice(mergeStart, SRC.indexOf('})();', mergeStart) + 5);
vm.runInContext(mergeSrc, bankSandbox);
const PACK = bankSandbox.CHEM_PRACTICE_DEFAULT;
const MERGED = PACK.questions;

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

/* ---------- 题目 schema 检查（静态题库与生成题共用；错误带规则前缀） ---------- */
function schemaErrors(q) {
  const errs = [];
  if (!q || typeof q !== 'object') return ['题目不是对象'];
  if (typeof q.id !== 'string' || !ID_RE.test(q.id)) errs.push('id:格式不合法');
  if (TYPES.indexOf(q.type) === -1) errs.push('type:不支持的题型 ' + q.type);
  if (typeof q.title !== 'string' || !q.title.trim()) errs.push('title:题名为空');
  if (typeof q.stem !== 'string' || !q.stem.trim()) errs.push('stem:题干为空');
  if (TOPICS.indexOf(q.topic) === -1) errs.push('topic:不在 6 个主题内');
  if (typeof q.source !== 'string' || !q.source.trim()) errs.push('source:来源为空');
  if (typeof q.level !== 'string' || !q.level.trim()) errs.push('level:层次为空');
  if (!Number.isInteger(q.points) || q.points < 1 || q.points > 50) errs.push('points:总分须为 1–50 的整数');
  /* 解析：字符串须非空；对象至少一个字段非空（与 validate 的“至少一个字段”口径一致）。 */
  const a = q.analysis;
  const aOk = (typeof a === 'string' && a.trim()) ||
    (a && typeof a === 'object' && !Array.isArray(a) &&
      ((typeof a.focus === 'string' && a.focus.trim()) ||
       (typeof a.approach === 'string' && a.approach.trim()) ||
       (Array.isArray(a.steps) && a.steps.some(s => typeof s === 'string' && s.trim())) ||
       (typeof a.pitfalls === 'string' && a.pitfalls.trim())));
  if (!aOk) errs.push('analysis:解析为空');
  if (q.type === 'single' || q.type === 'multi') {
    if (!Array.isArray(q.options) || q.options.length < 2) errs.push('options:选项不足 2 个');
    else if (q.options.some(o => typeof o !== 'string' || !o.trim())) errs.push('options:选项为空字符串');
    if (Array.isArray(q.options) && q.options.length >= 2) {
      const inRange = n => Number.isInteger(n) && n >= 0 && n < q.options.length;
      if (q.type === 'single') {
        if (!inRange(q.answer)) errs.push('answer:单选答案下标越界');
      } else {
        if (!Array.isArray(q.answer) || !q.answer.length) errs.push('answer:多选答案为空');
        else {
          if (q.answer.some(n => !inRange(n))) errs.push('answer:多选答案下标越界');
          if (new Set(q.answer).size !== q.answer.length) errs.push('multi:多选答案下标重复');
        }
      }
    }
  } else if (q.type === 'fill' || q.type === 'experiment') {
    if (!Array.isArray(q.parts) || !q.parts.length || q.parts.length > 12) errs.push('parts:小题数量须为 1–12 个');
    else {
      const pids = new Set();
      let sum = 0;
      q.parts.forEach(p => {
        if (typeof p.id !== 'string' || !ID_RE.test(p.id)) errs.push('parts:小题 id 不合法');
        else if (pids.has(p.id)) errs.push('parts:小题 id 重复');
        pids.add(p.id);
        if (['numeric', 'text', 'manual'].indexOf(p.kind) === -1) errs.push('parts:小题 kind 非法');
        if (typeof p.prompt !== 'string' || !p.prompt.trim()) errs.push('parts:小题 prompt 为空');
        if (!Number.isInteger(p.points) || p.points < 1 || p.points > 50) errs.push('points:小题分值须为 1–50 的整数');
        else sum += p.points;
        if (p.kind === 'numeric') {
          if (!Number.isFinite(p.answer)) errs.push('numeric:数值答案不是有限数字');
          if (!Number.isFinite(p.tolerance) || p.tolerance < 0 || p.tolerance > 1000) errs.push('numeric:容差非法（须为 0–1000 的有限数）');
        } else if (p.kind === 'text') {
          if (!Array.isArray(p.answer) || !p.answer.length || p.answer.some(x => typeof x !== 'string' || !x.trim())) errs.push('parts:文本小题参考答案非法');
        } else if (p.kind === 'manual') {
          if (typeof p.rubric !== 'string' || !p.rubric.trim()) errs.push('parts:开放题缺少核对量规');
        }
      });
      if (Number.isInteger(q.points) && sum !== q.points) errs.push('points:小题分值和(' + sum + ')≠总分(' + q.points + ')');
    }
  }
  return errs;
}
/* 121 题的逐题错误表（供本节各规则断言按前缀筛选）。 */
const SCHEMA = MERGED.map(q => ({ id: q.id, errors: schemaErrors(q) }));
function withPrefix(prefix) {
  return SCHEMA.filter(x => x.errors.some(e => e.indexOf(prefix) === 0))
    .map(x => x.id + '(' + x.errors.filter(e => e.indexOf(prefix) === 0).join('、') + ')');
}

/* ---------- 引擎重算：重放 _gen.checks ----------
 * 方法说明：生成器在生成每道题时，把每一次引擎调用（方法名 + 完整参数 spec、
 * 取值字段 field、记录值 value）都记在题目 _gen.checks 里。这里按记录重新调
 * 用引擎（E[method](spec)），取同一字段，与记录值比对（相对误差 1e-9）。
 * 这验证的是“生成题的答案所依据的引擎计算，在脱离生成过程后重新算一遍仍
 * 得到同一结果”；引擎调用本身被重新执行，而不是只信任生成器存下的数字。
 * 注意：它不验证“引擎值到选项/小题答案文本的映射”（如四舍五入、单位换算），
 * 该映射由 B 组自测的独立算术重算覆盖（见 /tmp/practice-gen-selftest.js）。 */
function getPath(obj, p) { return p.split('.').reduce((c, k) => (c == null ? undefined : c[k]), obj); }
function verifyChecks(q) {
  const checks = q._gen && q._gen.checks;
  if (!Array.isArray(checks) || !checks.length) return '未记录引擎调用（_gen.checks 为空）';
  for (let i = 0; i < checks.length; i++) {
    const c = checks[i];
    if (typeof E[c.method] !== 'function') return '引擎没有方法 ' + c.method;
    const r = E[c.method](c.spec);
    if (!r || r.ok !== true) return '引擎重算失败（' + c.method + '）';
    const v = getPath(r, c.field);
    if (typeof v !== 'number') return '重算字段不是数字（' + c.method + ' ' + c.field + '）';
    const tol = Math.max(Math.abs(c.value) * 1e-9, 1e-12);
    if (Math.abs(v - c.value) > tol) return '重算值不一致（' + c.method + ' ' + c.field + '）：记录 ' + c.value + '，重算 ' + v;
  }
  return null;
}

/* 构造最小题包（供 validate 题目级约束测试）。 */
function packWith(questions) {
  return { schema: 'chem-practice/2', id: 't', version: '1', title: 'T', description: 'D', topics: TOPICS.slice(), sources: [], questions };
}
function cloneWithId(q, id) { const c = JSON.parse(JSON.stringify(q)); c.id = id; return c; }

/* ================= 1. 三库合并 ================= */
(function () {
  console.log('— 1. 三库合并 —');
  ok('默认题包合并前 60 题', DEFAULT_COUNT === 60, '实际 ' + DEFAULT_COUNT);
  const cIds = CONCEPT.map(q => q.id).sort();
  const cExpect = Array.from({ length: 36 }, (_, i) => 'c' + String(i + 1).padStart(2, '0'));
  ok('概念题库 36 题，id 恰为 c01–c36', CONCEPT.length === 36 && JSON.stringify(cIds) === JSON.stringify(cExpect));
  const zIds = EXAM.map(q => q.id).sort();
  const zExpect = Array.from({ length: 25 }, (_, i) => 'z' + String(i + 1).padStart(2, '0'));
  ok('真题题库 25 题，id 恰为 z01–z25', EXAM.length === 25 && JSON.stringify(zIds) === JSON.stringify(zExpect));
  ok('合并后共 121 题', MERGED.length === 121, '实际 ' + MERGED.length);
  ok('合并后 id 无重复', new Set(MERGED.map(q => q.id)).size === MERGED.length);
  const s14 = MERGED.find(q => q.id === 's14');
  ok('s14 答案已修正为 1（B 项）', s14 && s14.answer === 1, '实际 ' + (s14 && s14.answer));
  vm.runInContext(mergeSrc, bankSandbox);
  ok('合并幂等：再执行一次合并仍为 121 题', bankSandbox.CHEM_PRACTICE_DEFAULT.questions.length === 121);
})();

/* ================= 2. 静态题库 schema（合并后 121 题逐题检查） ================= */
(function () {
  console.log('— 2. 静态题库 schema（121 题） —');
  ok('id 格式合法', withPrefix('id:').length === 0, withPrefix('id:').join('，'));
  ok('type 全部合法（single/multi/fill/experiment）', withPrefix('type:').length === 0, withPrefix('type:').join('，'));
  ok('单选/多选选项不少于 2 个', withPrefix('options:').length === 0, withPrefix('options:').join('，'));
  ok('单选/多选答案下标在选项范围内', withPrefix('answer:').length === 0, withPrefix('answer:').join('，'));
  ok('多选答案无重复下标', withPrefix('multi:').length === 0, withPrefix('multi:').join('，'));
  ok('numeric 小题答案为有限数字且 tolerance 合法', withPrefix('numeric:').length === 0, withPrefix('numeric:').join('，'));
  ok('小题分值和等于总分', withPrefix('points:').length === 0, withPrefix('points:').join('，'));
  ok('analysis 非空（字符串非空，或对象至少一个字段非空）', withPrefix('analysis:').length === 0, withPrefix('analysis:').join('，'));
  ok('topic 为 6 个现有主题名之一', withPrefix('topic:').length === 0, withPrefix('topic:').join('，'));
  ok('source 非空', withPrefix('source:').length === 0, withPrefix('source:').join('，'));
  const bad = SCHEMA.filter(x => x.errors.length);
  ok('全部 121 题通过完整 schema 检查', bad.length === 0,
    bad.slice(0, 5).map(x => x.id + '：' + x.errors.join('、')).join('；') + (bad.length > 5 ? '（等 ' + bad.length + ' 题）' : ''));
})();

/* ================= 3. 真实的 ChemPracticeCore.validate() ================= */
(function () {
  console.log('— 3. ChemPracticeCore.validate() —');
  let validated = null, validateErr = '';
  try { validated = C.validate(PACK); } catch (e) { validateErr = e.message; }
  ok('合并题包（121 题）通过 validate', !!validated && validated.questions.length === 121, validateErr);
  const genQ = G.generate('stoich', 42);
  let rawOk = false, rawErr = '';
  try {
    const v = C.validate(packWith([genQ]));
    rawOk = v.questions.length === 1 && v.questions[0].analysis.focus && !('_gen' in v.questions[0]);
  } catch (e) { rawErr = e.message; }
  ok('生成题（原始结构化解析）通过 validate 题目级约束，且 _gen 被丢弃', rawOk, rawErr);
  let flatOk = false, flatErr = '';
  try {
    const v = C.validate(packWith([G.flattenAnalysis(genQ)]));
    flatOk = v.questions.length === 1 && typeof v.questions[0].analysis === 'string' && v.questions[0].analysis.trim() !== '';
  } catch (e) { flatErr = e.message; }
  ok('生成题（flattenAnalysis 压平后）通过 validate 题目级约束', flatOk, flatErr);
  const s01 = MERGED.find(q => q.id === 's01');
  const q300 = Array.from({ length: 300 }, (_, i) => cloneWithId(s01, 'bound-' + String(i).padStart(3, '0')));
  let ok300 = false;
  try { ok300 = C.validate(packWith(q300)).questions.length === 300; } catch (e) { ok300 = false; }
  ok('300 题题包可通过 validate（上限边界）', ok300);
  throws('301 题题包被 validate 拒绝（上限 300）', () => C.validate(packWith(q300.concat([cloneWithId(s01, 'bound-300')]))));
})();

/* ================= 4. 变式生成器 ================= */
(function () {
  console.log('— 4. 变式生成器 —');
  ok('engineAvailable() 为 true', G.engineAvailable() === true);
  const templates = G.listTemplates();
  const tIds = templates.map(t => t.id).sort();
  ok('listTemplates() 返回 7 个模板', templates.length === 7 &&
    JSON.stringify(tIds) === JSON.stringify(['balance', 'kc', 'ph', 'redox', 'solution', 'stoich', 'titration']),
    '实际 ' + tIds.join(','));
  ok('7 个模板的主题与 level 均合法', templates.every(t => TOPICS.indexOf(t.topic) !== -1 && (t.level === '巩固' || t.level === '综合')));

  /* 同一（模板，种子）重复生成严格一致。 */
  const reproSeeds = [1, 7, 12345, 'abc', '中文种子', 'seed-1_x'];
  templates.forEach(t => {
    const bad = [];
    reproSeeds.forEach(seed => {
      const a = G.generate(t.id, seed);
      const b = G.generate(t.id, seed);
      if (JSON.stringify(a) !== JSON.stringify(b)) bad.push('种子 ' + seed + ' 两次不一致');
      if (!/^gen-[a-z]+-[A-Za-z0-9_-]+$/.test(a.id)) bad.push('种子 ' + seed + ' id 格式错误：' + a.id);
    });
    ok('可复现：' + t.id + '（数字/字符串种子各两次生成严格一致）', bad.length === 0, bad.join('；'));
  });

  /* 每模板 50 个随机种子：schema 校验 + 引擎重算；收集生成题供批量 validate。 */
  const allGen = [];
  templates.forEach((t, ti) => {
    const bad = [];
    const variants = {};
    for (let i = 0; i < 50; i++) {
      const seed = 7000 + ti * 1000 + i;
      let q;
      try { q = G.generate(t.id, seed); } catch (e) { bad.push('种子 ' + seed + ' 生成抛错：' + e.message); continue; }
      variants[q._gen.variant] = (variants[q._gen.variant] || 0) + 1;
      allGen.push(q);
      const se = schemaErrors(q);
      if (se.length) bad.push('种子 ' + seed + ' schema：' + se.join('、'));
      const chk = G.checkSchema(q);
      if (!chk.ok) bad.push('种子 ' + seed + ' checkSchema：' + chk.errors.join('、'));
      const ce = verifyChecks(q);
      if (ce) bad.push('种子 ' + seed + ' 引擎重算：' + ce);
    }
    console.log('    ' + t.id + ' 子型分布：' + JSON.stringify(variants));
    ok(t.id + ' × 50 种子：schema 校验 + 引擎重算全部通过', bad.length === 0, bad.slice(0, 3).join('；'));
  });

  /* 350 道生成题分批过真实 validate（每包 175 题，上限 300 以内）。 */
  ok('350 道生成题 id 互不重复', new Set(allGen.map(q => q.id)).size === allGen.length, '实际 ' + allGen.length + ' 题');
  let rawBatchOk = true, rawBatchErr = '';
  try {
    for (let i = 0; i < allGen.length; i += 175) {
      const chunk = allGen.slice(i, i + 175);
      if (C.validate(packWith(chunk)).questions.length !== chunk.length) { rawBatchOk = false; break; }
    }
  } catch (e) { rawBatchOk = false; rawBatchErr = e.message; }
  ok('350 道生成题（原始结构化解析）分批通过 validate', rawBatchOk, rawBatchErr);
  let flatBatchOk = true, flatBatchErr = '';
  try {
    const flatAll = allGen.map(q => G.flattenAnalysis(q));
    for (let i = 0; i < flatAll.length; i += 175) {
      const chunk = flatAll.slice(i, i + 175);
      if (C.validate(packWith(chunk)).questions.length !== chunk.length) { flatBatchOk = false; break; }
    }
  } catch (e) { flatBatchOk = false; flatBatchErr = e.message; }
  ok('350 道生成题（压平后）分批通过 validate', flatBatchOk, flatBatchErr);

  /* randomByTopic / variantOf 可复现。 */
  const rbtBad = [];
  [['定量分析', 99], ['反应原理', 5], ['物质与反应', 7]].forEach(([topic, seed]) => {
    const a = G.randomByTopic(topic, seed);
    const b = G.randomByTopic(topic, seed);
    if (JSON.stringify(a) !== JSON.stringify(b)) rbtBad.push(topic + ' 两次不一致');
    if (a.topic !== topic) rbtBad.push(topic + ' 生成题主题不符：' + a.topic);
  });
  ok('randomByTopic 同种子可复现且主题正确（3 个有模板主题）', rbtBad.length === 0, rbtBad.join('；'));
  const noTemplateBad = [];
  ['元素及其化合物', '结构与有机', '实验探究'].forEach(topic => {
    try { G.randomByTopic(topic, 1); noTemplateBad.push(topic + ' 应抛错但没有抛错'); }
    catch (e) { /* 当前行为：抛错。见文件末尾说明。 */ }
  });
  ok('randomByTopic 对无模板主题抛错（3 个主题尚无变式模板）', noTemplateBad.length === 0, noTemplateBad.join('；'));

  const vBad = [];
  const base = G.generate('kc', 77);
  const v1 = G.variantOf(base, 100);
  const v2 = G.variantOf(base, 100);
  if (JSON.stringify(v1) !== JSON.stringify(v2)) vBad.push('生成题 variantOf 两次不一致');
  if (v1._gen.template !== 'kc') vBad.push('variantOf 应同模板 kc，实际 ' + v1._gen.template);
  if (v1.id === base.id) vBad.push('variantOf 新种子应产生新 id');
  const v3 = G.variantOf({ id: 's01', topic: '反应原理' }, 5);
  if (v3.topic !== '反应原理') vBad.push('静态题 variantOf 应按主题换题，实际主题 ' + v3.topic);
  try { G.variantOf(null, 1); vBad.push('variantOf(null) 应抛错但没有抛错'); } catch (e) { /* 应抛错 */ }
  ok('variantOf 同种子可复现（生成题同模板新题；静态题按主题换题）', vBad.length === 0, vBad.join('；'));

  const d1 = G.generate('kc', 1), d2 = G.generate('kc', 2);
  ok('不同种子产生不同题目', d1.id !== d2.id && d1.stem !== d2.stem);
})();

/* ================= 5. 结构化解析渲染冒烟（C.analysisText，轻量） ================= */
(function () {
  console.log('— 5. 结构化解析渲染冒烟 —');
  const genQ = G.generate('ph', 3);
  const flatText = C.analysisText(G.flattenAnalysis(genQ).analysis);
  ok('字符串 analysis 经 analysisText 渲染出非空文本',
    typeof flatText === 'string' && flatText.trim() !== '' &&
    flatText.indexOf(genQ.analysis.focus.slice(0, 12)) >= 0,
    '渲染结果为空或丢失解析内容');
  function fourParts(q) {
    const t = C.analysisText(q.analysis);
    const a = q.analysis;
    const missing = [];
    if (t.indexOf('考什么') < 0 || t.indexOf(a.focus.slice(0, 12)) < 0) missing.push('考什么');
    if (t.indexOf('怎么想') < 0 || t.indexOf(a.approach.slice(0, 12)) < 0) missing.push('怎么想');
    if (t.indexOf('分步详解') < 0 || t.indexOf(a.steps[0].slice(0, 12)) < 0) missing.push('分步详解');
    if (t.indexOf('易错点') < 0 || t.indexOf(a.pitfalls.slice(0, 12)) < 0) missing.push('易错点');
    return { text: t, missing };
  }
  const s01 = MERGED.find(q => q.id === 's01');
  const r1 = fourParts(s01);
  ok('对象 analysis（真实题 s01）渲染含四个部分的关键句', r1.text.trim() !== '' && r1.missing.length === 0, '缺失：' + r1.missing.join('、'));
  const r2 = fourParts(G.generate('kc', 11));
  ok('对象 analysis（生成题 kc/11）渲染含四个部分的关键句', r2.text.trim() !== '' && r2.missing.length === 0, '缺失：' + r2.missing.join('、'));
})();

/* ================= 6. 旧作答记录迁移（v2.4.0 验收补丁） ================= */
(function () {
  console.log('— 6. 旧作答记录迁移 —');
  const pack = { id: 'highschool-workbook', version: '2.4', questions: MERGED };
  const recS01 = { answers: { choice: 0 }, submitted: true, result: { valid: true, score: 4, max: 4 } };
  const recS14 = { answers: { choice: 1 }, submitted: true, result: { valid: true, score: 4, max: 4 } };
  const legacy = [
    { key: 'chem_practice_oldfp1', value: { signature: 'old-pack', records: { s01: recS01, old999: { answers: {} } } } },
    { key: 'chem_practice_oldfp2', value: { signature: 'older-pack', records: { s14: recS14, s01: { answers: { choice: 2 } } } } },
  ];
  const m = C.migrateRecords(pack, legacy);
  ok('只导入当前题包内 id 的记录（s01、s14 入，old999 不入）',
    Object.keys(m).length === 2 && m.s01 === recS01 && m.s14 === recS14,
    '实际键：' + Object.keys(m).join(','));
  ok('同 id 记录先到先得（后出现的 s01 不覆盖）', m.s01.answers.choice === 0);
  ok('空与异常输入不抛错且返回空对象',
    JSON.stringify(C.migrateRecords(null, null)) === '{}' &&
    JSON.stringify(C.migrateRecords(pack, null)) === '{}' &&
    JSON.stringify(C.migrateRecords(pack, [{ value: null }, { value: { records: 'x' } }, { value: { records: [1] } }, null])) === '{}');
  ok('无旧记录时返回空对象', JSON.stringify(C.migrateRecords(pack, [])) === '{}');
})();

/* ================= 7. 列表分组与状态（v2.4.1 排版重做） ================= */
(function () {
  console.log('— 7. 列表分组与状态 —');
  const groups = C.groupPracticeQuestions(MERGED, {});
  const topics = groups.map(g => g.topic);
  ok('分出 6 个主题组', groups.length === 6, '实际 ' + groups.length);
  ok('6 组主题齐全且顺序与题包首次出现一致',
    TOPICS.every(t => topics.indexOf(t) >= 0) &&
    JSON.stringify(topics) === JSON.stringify([...new Set(MERGED.map(q => q.topic))]),
    '实际顺序：' + topics.join('、'));
  const total = groups.reduce((n, g) => n + g.total, 0);
  ok('各组题数之和为 121', total === 121, '实际 ' + total);
  const perTopicOk = groups.every(g => g.total === MERGED.filter(q => q.topic === g.topic).length);
  ok('每组题数与题库实际分布一致', perTopicOk);
  ok('无记录时全部为 todo', groups.every(g => g.questions.every(x => x.state === 'todo')));

  const records = {
    s01: { result: { score: 4, max: 4 } },
    s02: { result: { score: 0, max: 4 } },
    s03: { answers: { choice: 1 } },
    s04: {},
    ghost: { result: { score: 4, max: 4 } },
  };
  const g2 = C.groupPracticeQuestions(MERGED, records);
  const find = id => { for (const g of g2) { const x = g.questions.find(y => y.q.id === id); if (x) return x; } return null; };
  ok('状态判定：满分 done、未满分 weak、有草稿 doing、无记录 todo',
    find('s01').state === 'done' && find('s02').state === 'weak' &&
    find('s03').state === 'doing' && find('s04').state === 'todo');
  ok('全局序号 num 与题包顺序一致（s01=1、s02=2、s03=3）',
    find('s01').num === 1 && find('s02').num === 2 && find('s03').num === 3);
  const gMat = g2.find(g => g.topic === '物质与反应');
  ok('组统计：done/weak 计数与分数汇总正确',
    gMat.done === 1 && gMat.weak === 1 && gMat.score === 4 && gMat.max === 8,
    'done=' + gMat.done + ' weak=' + gMat.weak + ' score=' + gMat.score + ' max=' + gMat.max);
  ok('不存在于题包的记录 id 被忽略', find('ghost') === null);
  ok('空与异常输入返回空数组',
    JSON.stringify(C.groupPracticeQuestions(null, null)) === '[]' &&
    JSON.stringify(C.groupPracticeQuestions([], {})) === '[]' &&
    JSON.stringify(C.groupPracticeQuestions([{ id: 'x' }], {})) === '[]');
})();

console.log('\n通过 ' + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

/* 说明（供协调员参考，不影响测试结果）：
 * randomByTopic 对 3 个尚无变式模板的主题（元素及其化合物、结构与有机、
 * 实验探究）会抛错，原因是 pool 为空，pick 返回 undefined 后 generate 抛
 * “未知的变式模板“undefined””。抛错本身合理，但错误信息容易误导（主题是
 * 合法的，只是该主题暂无模板）；建议 randomByTopic 在 pool 为空时抛一个
 * 指明主题暂无模板的错误。variantOf 对这 3 个主题的静态题同样走此路径。
 * 另：生成器自带的 analysisText 步骤标题是“解题步骤”，而
 * ChemPracticeCore.analysisText 是“分步详解”，两者标题不一致但内容一致，
 * 属文案不一致，非功能缺陷。
 */
