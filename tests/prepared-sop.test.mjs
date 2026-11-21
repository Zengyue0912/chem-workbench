import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createContext,runInContext} from 'node:vm';

const publicDir = new URL('../public/', import.meta.url);
const dataFiles = readdirSync(publicDir).filter(name => /^student-sop-.+-data\.js$/.test(name));
const context = createContext({window:{}});
for (const name of [...dataFiles,'student-prepared-sop.js']) {
  runInContext(readFileSync(new URL(name,publicDir),'utf8'),context,{filename:name});
}
const {catalog,byId,cleanQuestionText,readChoices,splitQuestion,rank,confidentMatch,makePlan} = context.window.ChemPreparedSop;

test('题型 SOP 有独立操作、编号和可衔接的子步骤', () => {
  assert.ok(catalog.length >= 300 && catalog.length <= 400);
  assert.equal(byId.size,catalog.length);
  assert.equal(new Set(catalog.map(item => item.topic)).size,16);
  assert.equal(new Set(catalog.map(item => item.title)).size,catalog.length);
  const operations = new Set();
  for (const item of catalog) {
    const {steps,hints} = makePlan(item);
    assert.equal(steps.length,4);
    assert.equal(hints.length,steps.length);
    assert.ok(item.context.every(cue => cue.length > 0) && item.ask.every(cue => cue.length > 0),item.id);
    steps.forEach((step,index) => {
      for (const field of ['title','input','action','output','attention','criteria']) {
        assert.ok(step[field]?.trim(),item.id + ' ' + field);
      }
      if (index) assert.equal(step.input,steps[index-1].output,item.id);
    });
    operations.add(steps[1].action + '\n' + steps[2].action);
  }
  assert.equal(operations.size,catalog.length);
});

const samples = [
  ['M01','取一定质量的碳酸钠，折合的物质的量是多少？'],
  ['I01','等量氢氧化钠和盐酸反应，写出净离子方程式。'],
  ['R03','高锰酸根发生还原时得到电子，求转移电子数。'],
  ['E07','亚铁盐与给定氧化剂反应，写出铁元素的产物价态。'],
  ['H02','乙酸、乙醇、乙酸乙酯的燃烧热依次为 −874、−1367、−2238 kJ/mol。液态乙酸和液态乙醇按 1∶1 生成液态乙酸乙酯和液态水，求该反应的焓变。'],
  ['H02','已知目标反应各物种的燃烧焓，求反应焓变。结果保留两位小数。'],
  ['K08','给出各物态及计量系数，试写出平衡常数表达式。'],
  ['W17','混合后离子积是否大于溶度积，讨论是否沉淀。'],
  ['C02','已给出离子方程式。根据电源接线确定电解池阴极是哪一侧。'],
  ['A09','比较第三周期同周期元素的原子半径大小。'],
  ['S07','从中心原子的成键电子对和孤电子对出发，解释为什么 H₂O 的键角小于 NH₃ 的键角。'],
  ['X03','一个立方晶胞在顶点和面心都有球，问晶胞中个数。'],
  ['O15','图为分子的质谱图，根据分子离子峰求相对分子质量。'],
  ['Y13','说明甲酸乙酯在酸性水解时的产物结构。'],
  ['L02','温度接近室温，一套装置的气密性如何检查？'],
  ['D06','用标准酸液滴定。盛标准酸液的滴定管用水洗过，未经标准酸液润洗就装液。这样算出的质量分数偏高、偏低还是无影响？'],
  ['D21','用高锰酸钾滴定测过氧化脲纯度。哪种操作会使测得的纯度偏低？ A. 配制样品溶液时加水超过容量瓶刻度线。 B. 水洗滴定管后，没用标准液润洗。'],
  ['F02','某工业流程第一次过滤后，滤渣的主要成分是什么？']
];

for (const [id,question] of samples) {
  test('根据所求匹配 ' + id + ' · ' + byId.get(id).title, () => {
    assert.equal(confidentMatch(rank(splitQuestion(question)[0])),id);
  });
}

test('综合题保留共用题干并按小问匹配', () => {
  const parts = splitQuestion('4、已知材料晶胞和电解池电源接线。\n（1）晶胞中顶点和面心被占据，求每个晶胞中个数。\n（2）求电解池阴极的位置。');
  assert.equal(parts.length,2);
  assert.ok(parts[0].context.startsWith('4、'));
  assert.equal(confidentMatch(rank(parts[0])),'X03');
  assert.equal(confidentMatch(rank(parts[1])),'C02');
  assert.equal(splitQuestion('1. 求体积。\n2. 求质量。').length,2);
  assert.equal(splitQuestion('20.05 mL 氨水。\n0.1000 mol/L 盐酸。').length,1);
});

test('无关题和可能混淆的问法保留待确认状态', () => {
  assert.equal(confidentMatch(rank(splitQuestion('向量空间维数及矩阵秩是多少？')[0])),'');
  const ranks = rank(splitQuestion('滴定管尖嘴原有气泡，锥形瓶也带有蒸馏水，测得浓度偏高还是偏低？')[0]);
  assert.ok(ranks.some(item => item.id === 'D07') && ranks.some(item => item.id === 'D08'));
  assert.equal(confidentMatch(ranks),'');
});

test('从 Markdown 复制真题时，题干和四个选项仍能分开识别', () => {
  const stem = '用高锰酸钾滴定测过氧化脲纯度。哪种操作会使测得的纯度偏低？';
  const choices = [
    '配制样品溶液时加水超过容量瓶刻度线。',
    '水洗滴定管后，没用标准液润洗。',
    '滴定过程中有标准液滴到锥形瓶外。',
    '滴定管尖嘴原来有气泡，滴定后气泡消失。'
  ];
  const markers = [
    ['> A. ','> B. ','> C. ','> D. '],
    ['>> Ａ．','>> Ｂ．','>> Ｃ．','>> Ｄ．'],
    ['- A、','- B、','- C、','- D、'],
    ['（A）','（B）','（C）','（D）']
  ];
  for (const prefixes of markers) {
    const question = [stem, '>', ...choices.map((choice,index) => prefixes[index] + choice)].join('\r\n');
    const [part] = splitQuestion(question);
    const {stem:parsed,options} = readChoices(part.prompt);
    assert.equal(parsed,stem.normalize('NFKC'));
    assert.equal(options.map(({letter}) => letter).join(''),'ABCD');
    assert.equal(options[2].content,choices[2].normalize('NFKC'));
    assert.equal(confidentMatch(rank(part)),'D21');
  }
});

test('引用的综合题保留小问结构，题内大于号和数量保留', () => {
  const question = '> 4. 已知晶胞与电解池的接线。\n>\n> （1）顶点和面心被占据，求晶胞中个数。\n> （2）求电解池阴极的位置。';
  const parts = splitQuestion(question);
  assert.equal(parts.length,2);
  assert.match(parts[0].context,/^4\. /);
  assert.equal(confidentMatch(rank(parts[0])),'X03');
  assert.equal(confidentMatch(rank(parts[1])),'C02');
  assert.equal(cleanQuestionText('已知 c\n> 0.10 mol/L。\n若 Q > K，判断移动方向。'),
    '已知 c\n> 0.10 mol/L。\n若 Q > K，判断移动方向。');
});
