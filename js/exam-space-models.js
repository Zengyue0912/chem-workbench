(function () {
'use strict';

const exam = {
  hydration: ['2014 年全国课标乙卷第 28 题', 'https://cse.neea.edu.cn/res/Home/report/16093/e0dd8ce360a4b75e2e5a9f80330d33c6.pdf#page=4'],
  shape: ['2021 年全国理综乙卷第 35 题', 'https://gaokao.neea.edu.cn/xhtml1/report/21121/3939-1.htm'],
  cell: ['2016 年全国理综Ⅰ、Ⅱ、Ⅲ卷第 38 题', 'https://gaokao.neea.edu.cn/res/Home/report/16093/d48e9ad04b8f4e9ae71baf579417e0d0.pdf#page=3']
};

const particle = (element, ...position) => ({element, position});
const molecule = (atoms, bonds, normal, line) => ({
  atoms: atoms.map(([element, ...position]) => particle(element, ...position)),
  bonds, normal, line
});
const ring = Array.from({length: 6}, (_, index) => {
  const angle = index * Math.PI / 3;
  return [Math.cos(angle), Math.sin(angle)];
});
const styrene = molecule([
  ...ring.map(([x, y]) => ['C', x - 1.2, y, 0]),
  ...ring.slice(1).map(([x, y]) => ['H', 1.65 * x - 1.2, 1.65 * y, 0]),
  ['C', .84, 0, 0], ['C', 1.36, .90, 0],
  ['H', 1.16, -.56, 0], ['H', 1.03, 1.46, 0], ['H', 2, .90, 0]
], [
  ...ring.map((_, i) => [i, (i + 1) % 6, i % 2 ? 1 : 2]),
  ...ring.slice(1).map((_, i) => [i + 1, i + 6]),
  [0, 11], [11, 12, 2], [11, 13], [12, 14], [12, 15]
], [0, 0, 1]);
styrene.rotating = [12, 13, 14, 15];

const cube = [];
for (const x of [0, .5, 1]) {
  for (const y of [0, .5, 1]) {
    for (const z of [0, .5, 1]) cube.push([x, y, z]);
  }
}
const boundaryCount = position => position.filter(value => value === 0 || value === 1).length;
const isFCC = p => boundaryCount(p) % 2 === 1;
const fcc = cube.filter(isFCC);
const vertex = p => boundaryCount(p) === 3;
const dryIce = fcc.map(position => {
  const face = position.findIndex(value => value !== .5);
  const directions = [[1, 1, 1], [-1, 1, -1], [-1, -1, 1], [1, -1, -1]];
  return {...particle('CO₂', ...position), direction: directions[vertex(position) ? 0 : face + 1]};
});

const models = [
  {
    id: 'styrene', name: '苯乙烯', formula: 'C₆H₅—CH=CH₂', topic: '共面 · 单键旋转', source: exam.hydration,
    model: styrene,
    stem: '把苯环所在平面当作基准。在理想结构示意中，转动苯环与乙烯基之间的单键，最多有多少个原子落在这个平面上？',
    choices: ['8 个', '11 个', '12 个', '16 个'], answer: 3,
    rule: '苯环与乙烯基各自近似平面。绕连接两者的 C—C 单键转到两平面重合时，全部 16 个原子共面。',
    errors: ['只数了碳原子。题目问的是所有原子，氢也要算。', '只数了苯环上的 6 个碳和 5 个氢，漏了乙烯基。', '12 个是图中扭转 90° 时仍在苯环平面上的数量，题目问的是最多。'],
    hint: '先打开共面高亮，再把单键从 90° 转到 0°，比较两次计数。'
  },
  {
    id: 'ethylene', name: '乙烯', formula: 'CH₂=CH₂', topic: 'sp² 杂化 · σ 键与 π 键', source: exam.hydration, object: 'c2h4',
    model: molecule([['C', -.65, 0, 0], ['C', .65, 0, 0], ['H', -1.25, .97, 0], ['H', -1.25, -.97, 0], ['H', 1.25, .97, 0], ['H', 1.25, -.97, 0]], [[0, 1, 2], [0, 2], [0, 3], [1, 4], [1, 5]], [0, 0, 1]),
    stem: '乙烯水合生成乙醇时，只观察原来的两个碳之间。原有碳碳双键中的哪一部分消失？',
    choices: ['只有 σ 键', '只有 π 键', 'σ 键、π 键都消失', '两者都保留'], answer: 1,
    rule: 'C=C 由 1 个 σ 键和 1 个 π 键组成。加成后两个碳仍通过单键相连，原来的碳碳 π 键消失。',
    errors: ['把键轴上的 σ 键和侧向重叠的 π 键认反了。', '', '碳链没有断开，两个碳之间仍有 σ 键。', '若 π 键也保留，就仍是碳碳双键。'],
    hint: '打开「p 轨道侧向重叠」，观察双键上下两侧，再打开「加成后」对比。'
  },
  {
    id: 'acetylene', name: '乙炔', formula: 'HC≡CH', topic: '共线 · sp 杂化', source: exam.shape, object: 'c2h2',
    model: molecule([['C', -.6, 0, 0], ['C', .6, 0, 0], ['H', -1.65, 0, 0], ['H', 1.65, 0, 0]], [[0, 1, 3], [0, 2], [1, 3]], [0, 0, 1], [[-.6, 0, 0], [.6, 0, 0]]),
    stem: '乙炔中，位于两碳原子连线及其延长线上的原子一共有多少个？',
    choices: ['2 个', '3 个', '4 个', '0 个'], answer: 2,
    rule: '两个碳均为 sp 杂化。H—C≡C—H 的键角为 180°，4 个原子在同一直线上。',
    errors: ['连线要延伸到两个碳的外侧，两端的氢也在直线上。', '两个氢分别在 C≡C 两端，两者都要计入。', '', '确定基准线的两个碳本身就在线上。'],
    hint: '点击「高亮共线原子」，旋转整个视角，检验任一角度下是否仍在同一条轴线上。'
  },
  {
    id: 'methane', name: '甲烷', formula: 'CH₄', topic: '共面 · sp³ 正四面体', source: exam.shape, object: 'ch4',
    model: molecule([['C', 0, 0, 0], ['H', .78, .78, .78], ['H', .78, -.78, -.78], ['H', -.78, .78, -.78], ['H', -.78, -.78, .78]], [[0, 1], [0, 2], [0, 3], [0, 4]], [0, 1, -1]),
    stem: '任取一个经过甲烷中心碳原子的平面，它最多能包含几个氢原子？',
    choices: ['1 个', '2 个', '3 个', '4 个'], answer: 1,
    rule: '任意两个氢与中心碳可确定一个平面。三个氢构成的是四面体的一个面，中心碳位于四面体内部。',
    errors: ['中心碳与两个氢可以同时位于一个平面。', '', '三个氢所在的三角形面不经过中心碳。', '把结构式画在纸上容易看成平面，空间中的四个氢位于四面体顶点。'],
    hint: '点「高亮共面原子」，数橙色氢原子，拖到侧面看另外两个氢在哪。'
  },
  {
    id: 'ammonia', name: '氨', formula: 'NH₃', topic: '分子构型 · 孤电子对', source: exam.shape, object: 'nh3',
    model: molecule([['N', 0, .4, 0], ['H', 0, -.18, 1.16], ['H', 1, -.18, -.58], ['H', -1, -.18, -.58]], [[0, 1], [0, 2], [0, 3]], [0, 1, 0]),
    stem: '观察 NH₃ 中的三个氢所在的平面，判断氨分子的空间构型。',
    choices: ['平面三角形', '三角锥形', '正四面体形', '直线形'], answer: 1,
    rule: '氮周围有 3 个成键电子域和 1 个孤电子对。三个氢构成底面，氮在底面外，因此分子呈三角锥形。',
    errors: ['俯视时三条键容易看成同一平面。从侧面能看到氮离开了底面。', '', '四个电子域接近四面体排布，分子构型只按原子位置命名。', '三个氢围出一个三角形，氮在其上方。'],
    hint: '高亮氢原子的底面，再拖动模型，从侧面看氮的位置。'
  },
  {
    id: 'nacl', name: '氯化钠', formula: 'NaCl', topic: '均摊法 · 离子晶体', source: exam.cell, object: 'nacl',
    sites: cube.map(p => particle(isFCC(p) ? 'Cl⁻' : 'Na⁺', ...p)),
    stem: '完整的 NaCl 常规晶胞中，均摊后有多少个 Na⁺、多少个 Cl⁻？',
    choices: ['1、1', '4、4', '13、14', '4、6'], answer: 1,
    rule: 'Na⁺：12 个棱心 × ¼ + 1 个体心 = 4。Cl⁻：8 个顶点 × ⅛ + 6 个面心 × ½ = 4。',
    errors: ['1:1 是最简离子比，每个常规晶胞含 4 个化学式单位。', '', '这是把图上看到的所有粒子全按 1 个算。边界粒子要均摊。', '把面心上的 Cl⁻ 当成晶胞内部粒子了，还漏了顶点。'],
    hint: '沿 X 轴拖动切片，依次找出棱心、面心和体心，再展开完整晶胞的均摊表。'
  },
  {
    id: 'cscl', name: '氯化铯', formula: 'CsCl', topic: '均摊法 · 配位数', source: exam.cell,
    sites: cube.filter(p => vertex(p) || boundaryCount(p) === 0).map(p => particle(vertex(p) ? 'Cl⁻' : 'Cs⁺', ...p)),
    stem: '体心的 Cs⁺ 最近邻有几个 Cl⁻？均摊后每个晶胞有几个 Cl⁻？',
    choices: ['8、1', '1、8', '8、8', '6、1'], answer: 0,
    rule: '最近邻有 8 个角上的 Cl⁻。均摊只计算归属，每个顶点分给本晶胞 ⅛，所以 Cl⁻ 的归属总数为 8 × ⅛ = 1。',
    errors: ['', '配位数数实际相邻粒子；均摊数才要乘边界权重。', '8 个角上的离子都参与配位，但每个顶点只分给本晶胞 ⅛。', '6:6 配位是 NaCl 原型的特点；CsCl 体心离子的 8 个角方向等距。'],
    hint: '先看完整晶胞，再沿面上对角线方向切开，分清近邻个数与归属个数。'
  },
  {
    id: 'diamond', name: '金刚石', formula: 'C', topic: '均摊法 · 共价晶体', source: exam.cell, object: 'diamond',
    sites: [...fcc, [.25,.25,.25], [.25,.75,.75], [.75,.25,.75], [.75,.75,.25]].map(p => particle('C', ...p)),
    latticeBonds: true,
    stem: '金刚石的立方常规晶胞中，除顶点和面心外还有 4 个内部碳。均摊后共几个碳原子？',
    choices: ['4 个', '6 个', '8 个', '18 个'], answer: 2,
    rule: '8 个顶点 × ⅛ + 6 个面心 × ½ + 4 个内部原子 × 1 = 8。',
    errors: ['只计了面心立方部分，漏了 4 个晶胞内部的碳。', '先把三类位置分开，不要给内部原子套边界分数。', '', '这是完整模型上画出的位置总数，边界上粒子由相邻晶胞共享。'],
    hint: '拖到 X = 0.25 和 0.75，分别找出两个内部碳原子。'
  },
  {
    id: 'dryice', name: '干冰', formula: 'CO₂(s)', topic: '均摊法 · 分子晶体', source: exam.cell,
    sites: dryIce, structure: 'https://www.nature.com/articles/s41535-019-0149-0',
    stem: '按图中 CO₂ 分子的中心位置来均摊。一个完整干冰晶胞含几个 CO₂ 分子？',
    choices: ['4 个', '6 个', '12 个', '14 个'], answer: 0,
    rule: '按分子中心计数：8 个顶点 × ⅛ + 6 个面心 × ½ = 4 个 CO₂ 分子。',
    errors: ['', '面心分子只归本晶胞 ½，且顶点也有贡献。', '4 个 CO₂ 分子共含 12 个原子，题目问分子数。', '顶点与面心一共画了 14 个分子位置，边界要均摊。'],
    hint: '先识别一个直线形 O=C=O，再数中心位置。不要用氧原子有没有伸出晶胞判断均摊。'
  }
];

const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const delta = (a, b) => a.map((x, i) => x - b[i]);
function geometry(entry, degrees, tool) {
  const {atoms, rotating, normal, line} = entry.model;
  const angle = degrees * Math.PI / 180;
  const planeY = entry.id === 'ammonia' ? -.18 : 0;
  return atoms.map((a, i) => {
    const [x, y, z] = a.position;
    const p = rotating?.includes(i) ? [x, y * Math.cos(angle) - z * Math.sin(angle), y * Math.sin(angle) + z * Math.cos(angle)] : a.position;
    if (tool === 'line' && line) {
      const axis = delta(line[1], line[0]), v = delta(p, line[0]);
      const unit = axis.map(n => n / Math.hypot(...axis));
      return {...a, position: p, match: Math.hypot(...v.map((n, j) => n - dot(v, unit) * unit[j])) < 1e-6};
    }
    return {...a, position: p, match: Math.abs(dot([p[0], p[1] - planeY, p[2]], normal)) < 1e-6};
  });
}

const axisFns = [p => p[0], p => p[1], p => p[2], p => (p[0] + p[1]) / 2];
const weight = position => 1 / 2 ** boundaryCount(position);
function tally(sites) {
  return sites.reduce((sums, {element, position}) => {
    const counts = (sums[element] ??= [0, 0, 0, 0]);
    counts[3 - boundaryCount(position)]++;
    return sums;
  }, {});
}

window.ChemExamModels = {models, geometry, tally, axisFns, weight};
})();
