(function () {
'use strict';

const example = '下列粒子的 VSEPR 模型为平面三角形且其空间结构为 V 形的是\nA. SO₂\nB. CO₂\nC. BF₃\nD. OF₂';
const keyword = /(?<![a-zａ-ｚ])(?:[vｖ]\s*[sｓ]\s*[ebｅｂ]\s*[pｐ]\s*[rｒ]|[vｖ]\s*[eｅ]\s*[sｓ]\s*[pｐ]\s*[rｒ])(?![a-zａ-ｚ])/i;
const practiceKey = 'chem-vsepr-practice-v1';
const particles = {
  SO2:{formula:'SO₂', bonded:2, lone:1, shape:'V 形'},
  CO2:{formula:'CO₂', bonded:2, lone:0, shape:'直线形'},
  BF3:{formula:'BF₃', bonded:3, lone:0, shape:'平面三角形'},
  OF2:{formula:'OF₂', bonded:2, lone:2, shape:'V 形'},
  H2O:{formula:'H₂O', bonded:2, lone:2, shape:'V 形'},
  NH3:{formula:'NH₃', bonded:3, lone:1, shape:'三角锥形'},
  CH4:{formula:'CH₄', bonded:4, lone:0, shape:'正四面体形'}
};
const domainCount = particle => particle.bonded + particle.lone;
const arrangements = {2:'直线形',3:'平面三角形',4:'正四面体形'};
const plain = text => text.normalize('NFKC').replace(/\s+/g,'').replace(/正四面体(?!形)/g,'正四面体形').toUpperCase();

function identify(stem, options, rawQuestion) {
  const term = rawQuestion.match(keyword)?.[0];
  const mentionsShape = /(?:空间|分子)(?:构型|结构)|键角|电子域|孤电子对/.test(stem);
  if (!keyword.test(stem) && (!mentionsShape || !/(?:分子|粒子|中心原子|孤电子对|电子域|AX[2-6])/.test(stem) ||
      /(?:极性|杂化)(?:的是|为|是什么|如何)|晶体|共面|共线|有机分子/.test(stem))) return null;
  const text = stem.replace(keyword,'VSEPR');
  const pair = text.match(/VSEPR\s*模型\s*(?:为|是)\s*(直线形|平面三角形|正四面体形?)\s*(?:且|并且|[,，])\s*(?:其)?(?:空间|分子)(?:结构|构型)\s*(?:为|是)\s*(V\s*形|直线形|平面三角形|三角锥形|正四面体形?)\s*的(?:粒子)?\s*(?:是|为)(?:下列哪一项)?\s*[?？:：。()（）]*$/i);
  const profile = {
    reading:{
      topic:'VSEPR 模型与分子空间构型',
      method:pair ? '题目给出两种形状，从选项里反推符合条件的粒子。' : '先数中心原子周围的电子域，再判断原子在空间中的排布。',
      firstLook:pair ? '圈出「' + pair[1] + '」和「' + pair[2] + '」，确认它们分别描述什么。'
        : '找出中心原子，分开数成键方向和孤电子对。'
    },
    correction:term && plain(term) !== 'VSEPR' ? {from:term,to:'VSEPR'} : null,
    exercise:null
  };
  if (!pair || options.length < 2 || /错误|不(?:符合|正确|是|同)|多选|不定项|键角|极性|杂化|比较|依次|均为/.test(text)) return profile;
  const optionsWithData = options.map(({letter,content}) => {
    const formula = content.replace(/[\s,，、。;；]+$/g,'').replace(/\s+/g,'');
    return {letter,particle:Object.hasOwn(particles,formula) ? particles[formula] : null};
  });
  if (optionsWithData.some(({particle}) => !particle) || new Set(optionsWithData.map(({letter}) => letter)).size !== options.length) return profile;
  const matches = optionsWithData.filter(({particle}) =>
    plain(arrangements[domainCount(particle)]) === plain(pair[1]) && plain(particle.shape) === plain(pair[2]));
  if (matches.length === 1) profile.exercise = {arrangement:pair[1],shape:pair[2].replace(/\s+/g,' '),options:optionsWithData,correct:matches[0]};
  return profile;
}

function makePlan(exercise, step) {
  const options = exercise.options.map(({letter,particle}) => letter + '. ' + particle.formula).join('、');
  const domains = Object.keys(arrangements).find(count => plain(arrangements[count]) === plain(exercise.arrangement));
  return {
    title:'由 VSEPR 模型和分子构型反选粒子',missing:[],
    steps:[
      step('分清题目给出的两种形状','题目要求 VSEPR 模型为' + exercise.arrangement + '，空间构型为' + exercise.shape + '。',
        '说清「' + exercise.arrangement + '」和「' + exercise.shape + '」分别描述什么。',
        '分别说明电子域的排布和原子的位置。',
        '中心原子上的每一对孤电子各占一个电子域。描述空间构型时，只看原子所在的位置。',
        '能分别说清两种形状的判断依据。'),
      step('逐项数中心原子的电子域',options,
        '每项先找中心原子，再数它周围的成键方向和孤电子对，填入电子域总数。',
        '每个选项各得到一个电子域总数。',
        '单键、双键或三键只要朝向同一个邻原子，就算一个成键电子域。',
        '每个选项的计数都核对过。'),
      step('用 VSEPR 模型筛一轮','上一步核对后的电子域总数。',
        '先用「' + exercise.arrangement + '」筛选。把符合的选项和判断依据写下来。',
        '保留电子域排布为' + exercise.arrangement + '的选项。',
        '2 个电子域对应直线形，3 个对应平面三角形，4 个对应正四面体形。',
        '能用电子域数说明为什么保留这些选项。'),
      step('看实际原子位置再做选择','上一步保留的选项及中心原子的孤电子对。',
        '在保留的选项里判断实际分子构型。选出同时满足两项条件的粒子，并解释理由。',
        '一个选项，加上电子域数和空间构型两条依据。',
        '不同粒子都可能呈 V 形。把两项条件都核对一遍。',
        '能说清为什么这个选项同时满足题目的两个条件。')
    ],
    reference:[
      '参考答案 ' + exercise.correct.letter + ' · ' + exercise.correct.particle.formula,
      ...exercise.options.map(({letter,particle}) => letter + '. ' + particle.formula + '：' +
        particle.bonded + ' 个成键方向、' + particle.lone + ' 对孤电子，共 ' + domainCount(particle) +
        ' 个电子域；VSEPR 模型为' + arrangements[domainCount(particle)] + '，空间构型为' + particle.shape + '。')
    ],
    hints:[
      '想一想：孤电子对有没有占位置？它的位置上有没有原子？',
      '成键方向和孤电子对要分别数。双键连接两个原子时，中心原子朝向这个邻原子的方向有几个？',
      '先找总数等于 ' + domains + ' 的选项。先把它们留下，再判断空间构型。',
      '在留下的选项里，想象把孤电子对用透明记号标出来。只连实际的原子，还能看到什么形状？'
    ]
  };
}

function countFields(exercise, counts) {
  return '<div class="vsepr-count-grid">' + exercise.options.map(({letter,particle}) =>
    '<label>' + letter + '. ' + particle.formula + '<select name="domain-' + letter + '">' +
    '<option value="">选电子域数</option>' + [1,2,3,4,5,6].map(number => '<option value="' + number + '"' +
      (counts[letter] === number ? ' selected' : '') + '>' + number + ' 个</option>').join('') +
    '</select></label>').join('') + '</div>';
}

function checkCounts(exercise, counts) {
  const empty = exercise.options.find(({letter}) => !counts[letter]);
  if (empty) return {hint:'请先填 ' + empty.letter + ' 项的电子域数。',field:empty.letter};
  const wrong = exercise.options.find(({letter,particle}) => counts[letter] !== domainCount(particle));
  if (wrong) {
    const {letter,particle} = wrong;
    const check = /^(SO₂|CO₂)$/.test(particle.formula) && counts[letter] > domainCount(particle)
      ? '有个方向可能数了两遍。多重键朝向同一个邻原子时，只算一个电子域。'
      : '先数实际连着的邻原子，再加中心原子的孤电子对。';
    return {hint:letter + '. ' + particle.formula + ' 再数一次。' + check,field:letter};
  }
  return {answer:exercise.options.map(({letter,particle}) => letter + '. ' + particle.formula + '：' +
    counts[letter] + ' 个').join('；')};
}

function choiceField(exercise, choice) {
  return '<label class="study-field vsepr-final-choice">你的选项<select name="vsepr-choice">' +
    '<option value="">请选择</option>' + exercise.options.map(({letter,particle}) =>
      '<option value="' + letter + '"' + (choice === letter ? ' selected' : '') +
      '>' + letter + '. ' + particle.formula + '</option>').join('') + '</select></label>';
}

function checkChoice(exercise, choice) {
  if (!choice) return '先选出一个同时满足两项条件的选项。';
  const particle = exercise.options.find(option => option.letter === choice)?.particle;
  if (!particle) return '请从题目给出的选项里选。';
  if (plain(arrangements[domainCount(particle)]) !== plain(exercise.arrangement)) {
    return '这项的电子域总数对应另一种 VSEPR 模型。回看计数，先用题目要求的电子域排布筛一轮。';
  }
  if (plain(particle.shape) !== plain(exercise.shape)) {
    return '这项的 VSEPR 模型符合。再只看原子位置，核对它的分子空间构型。';
  }
  return '';
}

// Directions show the idealized electron-domain geometry.
const trigonal = [[-.866,-.5,0],[.866,-.5,0],[0,1,0]];
const tetrahedral = [[-.816,-.577,0],[.816,-.577,0],[0,.577,.816],[0,.577,-.816]];
const center = [0,.6,0];
const atomColors = {S:'#e5b33a',O:'#d25852',F:'#32937f'};
const modelPosition = (direction,radius) => direction.map((value,i) => center[i] + radius * value);

class ComparisonScene extends window.ChemGames.Scene {
  sphere(object) {
    if (!object.pair) return super.sphere(object);
    const point = this.project(object.p);
    const size = .25 * this.scale * point.k;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(point.x,point.y,size * 1.35,size,0,0,Math.PI * 2);
    ctx.fillStyle = '#a88ae64d';
    ctx.fill();
    ctx.setLineDash([3,2]);
    ctx.strokeStyle = '#7354b6';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#6343a3';
    for (const dx of [-.42,.42]) {
      ctx.beginPath();
      ctx.arc(point.x + dx * size,point.y,Math.max(1.6,size * .22),0,Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return point;
  }
}

function drawModel(scene, formula, showPairs) {
  const config = formula === 'SO2'
    ? {centerAtom:'S',outer:'O',directions:trigonal}
    : {centerAtom:'O',outer:'F',directions:tetrahedral};
  const atom = (label,p,r) => ({label,p,r,color:atomColors[label],ink:label === 'S' ? '#302303' : '#fff'});
  const outer = config.directions.slice(0,2).map(direction => modelPosition(direction,1.44));
  scene.objects = [atom(config.centerAtom,center,.36),...outer.map(p => atom(config.outer,p,.31))];
  if (showPairs) scene.objects.push(...config.directions.slice(2).map(direction =>
    ({pair:true,ghost:true,p:modelPosition(direction,1.16)})));
  scene.bonds = outer.map(p => [center,p]);
  scene.draw();
}

class VseprComparison extends HTMLElement {
  connectedCallback() {
    this.innerHTML = '<div class="vsepr-compare"><div class="vsepr-model-grid">' +
      ['SO₂','OF₂'].map(formula => '<figure><figcaption>' + formula + '</figcaption><canvas role="img" aria-label="' +
        formula + ' 的可旋转分子模型"></canvas></figure>').join('') + '</div><div class="study-actions">' +
      '<button class="btn-sub" type="button" data-vsepr-view="pairs" aria-pressed="false">显示孤电子对</button>' +
      '<button class="btn-sub" type="button" data-vsepr-view="rotate">旋转视角</button></div>' +
      '<p class="study-note" aria-live="polite">拖动任一模型，两边一起转。先看看两者的原子排布。</p>' +
      '<small class="study-note">示意图按理想电子域方向绘制。</small></div>';
    this.scenes = [...this.querySelectorAll('canvas')].map(canvas => {
      const scene = new ComparisonScene(canvas);
      scene.zoom = 1.92;
      scene.yaw = .55;
      scene.pitch = .34;
      scene.resize();
      let drag = null;
      canvas.onpointerdown = event => {
        if (event.button !== 0) return;
        canvas.setPointerCapture(event.pointerId);
        drag = {x:event.clientX,y:event.clientY};
      };
      canvas.onpointermove = event => {
        if (!drag || !canvas.hasPointerCapture(event.pointerId)) return;
        this.rotate((event.clientX - drag.x) * .012,(event.clientY - drag.y) * .01);
        drag = {x:event.clientX,y:event.clientY};
      };
      canvas.onlostpointercapture = () => { drag = null; };
      return scene;
    });
    let showPairs = false;
    const redraw = () => this.scenes.forEach((scene,i) => drawModel(scene,i ? 'OF2' : 'SO2',showPairs));
    this.onclick = event => {
      const button = event.target.closest('[data-vsepr-view]');
      if (!button) return;
      if (button.dataset.vseprView === 'rotate') return this.rotate(.56,.1);
      showPairs = !showPairs;
      button.setAttribute('aria-pressed',String(showPairs));
      button.textContent = showPairs ? '隐藏孤电子对' : '显示孤电子对';
      this.querySelector('[aria-live]').textContent = showPairs
        ? '紫色虚线各表示一对孤电子。SO₂ 有 2 个成键方向和 1 对孤电子；OF₂ 有 2 个成键方向和 2 对孤电子。'
        : '拖动任一模型，两边一起转。先看看两者的原子排布。';
      redraw();
    };
    redraw();
  }

  rotate(yaw,pitch) {
    for (const scene of this.scenes) {
      scene.yaw += yaw;
      scene.pitch = Math.max(-1.35,Math.min(1.35,scene.pitch + pitch));
      scene.draw();
    }
  }

  disconnectedCallback() {
    this.scenes?.forEach(scene => scene.stop());
    this.scenes = [];
  }
}

function readPractice() {
  try { return JSON.parse(localStorage.getItem(practiceKey)); }
  catch { return null; }
}

const practicePending = () => readPractice()?.lastCorrect === false;

class VseprPractice extends HTMLElement {
  connectedCallback() {
    if (this.firstChild) return;
    const saved = readPractice();
    const variant = (this.getAttribute('molecule') || saved?.variant) === 'H2S' ? 'H2S' : 'H2O';
    const {formula,centerAtom} = variant === 'H2S' ? {formula:'H₂S',centerAtom:'S'} : {formula:'H₂O',centerAtom:'O'};
    this.innerHTML = '<form class="vsepr-practice"><p>' + formula + ' 的中心 ' + centerAtom +
      ' 有 6 个价电子，分别与两个 H 形成一根单键。判断它的 VSEPR 模型和空间构型。</p>' +
      '<div class="vsepr-count-grid"><label>VSEPR 模型<select name="arrangement" required><option value="">请选择</option>' +
      '<option value="2">直线形</option><option value="3">平面三角形</option><option value="4">正四面体形</option></select></label>' +
      '<label>分子空间构型<select name="shape" required><option value="">请选择</option>' +
      '<option value="linear">直线形</option><option value="bent">V 形</option><option value="tetrahedral">正四面体形</option></select></label></div>' +
      '<label class="study-field">你是怎么数的？<select name="reason" required><option value="">请选择</option>' +
      '<option value="2">两个成键方向，没有孤电子对</option><option value="3">两个成键方向，一对孤电子</option>' +
      '<option value="4">两个成键方向，两对孤电子</option></select></label>' +
      '<button class="btn-main" type="submit">核对变式</button><p class="study-result" role="status" hidden></p></form>';
    let attempts = saved?.variant === variant && saved.lastCorrect === false && Number.isSafeInteger(saved.attempts) && saved.attempts > 0
      ? saved.attempts : 0;
    const form = this.querySelector('form');
    form.onsubmit = event => {
      event.preventDefault();
      const {arrangement,shape,reason} = Object.fromEntries(new FormData(form));
      const correct = arrangement === '4' && shape === 'bent' && reason === '4';
      const feedback = this.querySelector('[role="status"]');
      attempts++;
      feedback.hidden = false;
      feedback.classList.toggle('study-correct',correct);
      feedback.textContent = correct
        ? (attempts === 1 ? '第一次就答对了。' : '订正后答对了。') + '2 个成键方向和 2 对孤电子一共是 4 个电子域；三个原子呈 V 形。'
        : reason !== '4' ? '先算中心 ' + centerAtom + '：它用 2 个价电子参与两根键，还剩几个电子？两个电子才能组成一对。'
          : arrangement !== '4' ? '把你数出的成键方向和孤电子对相加，再判断 VSEPR 模型。'
          : '你数对了电子域。判断分子空间构型时，想想实际有几个原子，它们在哪些位置。';
      try { localStorage.setItem(practiceKey,JSON.stringify({variant,attempts,lastCorrect:correct})); }
      catch { if (!correct) feedback.textContent += ' 本浏览器无法保存待复练记录。'; }
    };
  }
}

customElements.define('chem-vsepr-comparison',VseprComparison);
customElements.define('chem-vsepr-practice',VseprPractice);
window.ChemVseprStudy = {example,identify,makePlan,countFields,checkCounts,choiceField,checkChoice,practicePending};
})();
