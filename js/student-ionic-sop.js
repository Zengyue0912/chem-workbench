(function () {
'use strict';

const sampleRequest = '写出该反应的离子方程式';
const cases = {
  acid: {
    condition:'向碳酸钠溶液中加入过量盐酸',
    products:'二氧化碳和水', equation:'CO₃²⁻ + 2H⁺ → CO₂↑ + H₂O',
    why:'碳酸根先得到一个 H⁺ 生成 HCO₃⁻。盐酸足量，HCO₃⁻ 继续与 H⁺ 反应，生成 CO₂ 和 H₂O。'
  },
  carbonate: {
    condition:'向过量碳酸钠溶液中逐滴加入少量盐酸',
    products:'碳酸氢根', equation:'CO₃²⁻ + H⁺ → HCO₃⁻',
    why:'向过量碳酸钠溶液中逐滴加入少量盐酸时，按题设用量，碳酸根得到一个 H⁺，生成 HCO₃⁻。'
  }
};
const otherCase = id => id === 'acid' ? 'carbonate' : 'acid';
const sample = id => cases[id].condition + '。' + sampleRequest + '。';
const validCase = id => Object.hasOwn(cases,id);
const amountLabels = {acid:'盐酸', carbonate:'碳酸钠'};
const amountQuestion = '题目说明哪种物质过量或足量？';
const products = ['碳酸氢根','二氧化碳和水','一氧化碳和水'];

// Only route complete, unambiguous versions of these two paper exercises to the checker.
const carbonate = '(?:碳酸钠|Na2CO3)(?:的)?(?:水)?溶液';
const acid = '(?:稀)?(?:盐酸|HCl(?:溶液)?)';
const add = '(?:缓慢|逐滴)?(?:加入|滴加)';
const excess = '(?:过量|足量)(?:的)?';
const small = '少量(?:的)?';
const acidCondition = new RegExp('^(?:向?' + carbonate + '中' + add + excess + acid + '|' +
  carbonate + '(?:和|与)' + excess + acid + '反应)$','i');
const carbonateCondition = new RegExp('^向?' + excess + carbonate + '中' + add + small + acid + '$','i');
const requestPattern = /(?:^|[。，,；;！!？?\n])\s*((?:请|试)?(?:写出|写下|书写|列出)(?:(?:上述|该|此|这个|这一)?(?:反应(?:的)?|过程(?:的)?))?(?:净)?离子(?:方程)?式)\s*[。！!？?]?$/;

function recognize(part) {
  const request = requestPattern.exec(part.prompt);
  if (!request) return null;
  const condition = [part.context,part.prompt.slice(0,request.index)].filter(Boolean)
    .join('\n').trim().replace(/[。；;！!？?]+$/,'').replace(/^\d{1,2}[.．、]\s*/,'');
  const compact = condition.normalize('NFKC').replace(/\s+/g,'');
  const id = acidCondition.test(compact) ? 'acid' : carbonateCondition.test(compact) ? 'carbonate' : '';
  return id ? {id,condition,request:request[1]} : null;
}

const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const superCharge = /[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻]/g;
const normalize = text => text.replace(superCharge, value => '^' + [...value.slice(0,-1)]
  .map(digit => superscripts.indexOf(digit)).join('') + (value.endsWith('⁺') ? '+' : '-'))
  .normalize('NFKC').replace(/[−–]/g,'-').replace(/\s+/g,'');

function parseSide(text) {
  // At a species boundary H++ means H⁺ followed by the separator. CO2+H2O uses only a separator.
  const token = /(\d{1,3})?((?:[A-Z][a-z]?\d{0,3})+)(?:\^(\d{0,2})([+-])|([+-])(?=(?:\((?:aq|g|l|s)\)|[↑↓])?(?:\+|$)))?(\((?:aq|g|l|s)\)|[↑↓])?/y;
  const species = new Set();
  const atoms = new Map();
  let charge = 0, offset = 0, states = true;
  while (offset < text.length) {
    token.lastIndex = offset;
    const term = token.exec(text);
    if (!term) return null;
    let [,coefficient,formula,magnitude,sign,bareSign,phase] = term;
    if (formula === 'CO32' && bareSign === '-') {
      formula = 'CO3';
      magnitude = '2';
    }
    const count = Number(coefficient ?? 1);
    const signed = sign || bareSign;
    const size = Number(magnitude || 1);
    if (!count || !size) return null;
    const ionCharge = signed ? (signed === '-' ? -size : size) : 0;
    if (phase) {
      if (ionCharge) states &&= phase === '(aq)';
      else if (formula === 'CO2') states &&= phase === '↑' || phase === '(g)';
      else if (formula === 'H2O') states &&= phase === '(l)';
    }
    species.add(formula + ':' + ionCharge);
    charge += count * ionCharge;
    for (const [,element,subscript] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
      const number = Number(subscript || 1);
      if (!number) return null;
      atoms.set(element,(atoms.get(element) || 0) + count * number);
    }
    offset = token.lastIndex;
    if (offset === text.length) return {species,atoms,charge,states};
    if (text[offset] !== '+') return null;
    offset++;
  }
  return null;
}

function sameSpecies(actual, required) {
  return actual.size === required.length && required.every(item => actual.has(item));
}

function checkEquation(value, id) {
  const [left,right,extra] = normalize(value).split(/⟶|→|->|=>|=/);
  const from = parseSide(left);
  const to = extra === undefined && right ? parseSide(right) : null;
  if (!from || !to) return null;
  const atoms = [...new Set([...from.atoms.keys(),...to.atoms.keys()])]
    .filter(element => from.atoms.get(element) !== to.atoms.get(element));
  const expected = id === 'acid' ? ['CO2:0','H2O:0'] : ['HCO3:-1'];
  return [
    {ok:sameSpecies(to.species,expected) && to.states, label:'产物与题意', cause:'产物判断',
      tip:'回看原题的用量。碳酸根得到一个 H⁺ 后，还能继续得到 H⁺ 吗？也请核对产物的状态符号。'},
    {ok:sameSpecies(from.species,['CO3:-2','H:1']) && from.states, label:'参与反应的离子', cause:'参与反应的离子',
      tip:'检查左边的离子及其电荷。两边都没有改变的旁观离子应消去。'},
    {ok:atoms.length === 0, label:'原子数守恒', cause:'原子数未配平',
      tip:'重新数两侧 ' + atoms.join('、') + ' 的原子，调整化学式前面的系数。'},
    {ok:from.charge === to.charge, label:'总电荷守恒', cause:'总电荷未配平',
      tip:'左边总电荷为 ' + from.charge + '，右边为 ' + to.charge + '。把各离子的电荷乘以系数后再相加。'}
  ];
}

const steps = [
  {title:'先判断用量', prompt:amountQuestion,
    hints:['回到原题，找出说明用量的词。','看「过量」或「足量」说的是哪种物质。']},
  {title:'判断最终产物', prompt:'碳酸根反应后生成什么？',
    hints:['看反应后是否还有 H⁺ 能继续参与。','碳酸根先接收一个 H⁺。看看这一步之后反应能否继续。']},
  {title:'写出净离子方程式', prompt:'写出两侧实际参加反应或生成的微粒，再配平。',
    hints:['先写碳酸根和 H⁺，消去没有变化的旁观离子。','按你选出的产物写右边，再分别数各元素的原子和总电荷。']}
];
const amountHint = '回看原题，「过量」或「足量」修饰的是哪种物质？';
const formatHint = '先写完整的反应式，再核对。用「→」或「=」连接两边。离子电荷可以写成 SO₄²⁻ 或 SO4^2-。';
const escape = text => window.ChemStudio.escape(String(text ?? ''));
const ionicButton = (label,action) => '<button type="button" class="btn-sub" data-ionic-action="' + action + '">' + label + '</button>';

function radioChoices(name, list, current, label) {
  return '<fieldset class="ionic-choices"><legend>' + label + '</legend>' + list.map(([value,text]) =>
    '<label><input type="radio" name="' + name + '" value="' + escape(value) + '"' + (value === current ? ' checked' : '') +
    ' required><span>' + escape(text) + '</span></label>').join('') + '</fieldset>';
}

function equationField(value) {
  return '<label class="study-field">净离子方程式<textarea rows="2" name="equation" maxlength="300" required>' +
    escape(value) + '</textarea></label>';
}

function feedback(notice, checks, accepted) {
  if (!notice && !checks) return '';
  return '<div class="study-result ' + (accepted ? 'study-correct' : 'study-try') + '" role="status" tabindex="-1">' +
    (notice ? '<p>' + escape(notice) + '</p>' : '') + (checks ? '<ul class="ionic-checks">' + checks.map(item =>
      '<li><strong>' + item.label + (item.ok ? '通过' : '需核对') + '</strong>' +
      (item.ok ? '' : '。' + escape(item.tip)) + '</li>').join('') + '</ul>' : '') + '</div>';
}

function createGuided(info, question) {
  return {info,question,index:0,value:'',level:0,notice:'',checks:null,accepted:false,mistake:'',saved:false};
}

function mountGuided(root,state) {
  const {id} = state.info;
  const exercise = cases[id];
  const sopSteps = steps.map(step => '<li><strong>' + step.title + '</strong>。' + step.prompt + '</li>').join('');

  function draw(moveFocus = false) {
    const step = steps[state.index];
    const currentSop = root.querySelector('.ionic-sop');
    if (currentSop) state.sopOpen = currentSop.open;
    const field = state.index === 0 ? radioChoices('value',Object.entries(amountLabels),state.value,'选择一种物质')
      : state.index === 1 ? radioChoices('value',products.map(text => [text,text]),state.value,'选择产物')
      : equationField(state.value);
    const result = feedback(state.notice,state.checks,state.accepted);
    const hint = step && state.level ? '<div class="question-step-help" role="status" tabindex="-1">' +
      step.hints.slice(0,state.level).map(line => '<p>' + escape(line) + '</p>').join('') + '</div>' : '';
    const actions = '<div class="study-actions">';
    const body = step ? '<p>' + escape(step.prompt) + '</p>' + (state.accepted ?
      result + actions + '<button class="btn-main" type="button" data-ionic-action="next">' +
      (state.index === steps.length - 1 ? '核对原题结果' : '下一步') + '</button></div>' :
      '<form>' + field + result + actions + '<button type="submit" class="btn-main">核对这一步</button>' +
      (state.level < step.hints.length ? ionicButton(state.level ? '再给一点提示' : '给一点提示','hint') : '') +
      '</div></form>' + hint) : '<p>' + exercise.why + '</p><p class="ionic-equation">' + exercise.equation + '</p>' +
      (state.mistake ? '<p>' + (state.saved ? '已记入错题本。' : '当前浏览器无法保存错因。') +
        '这次先复练<strong>' + escape(state.mistake) + '</strong>。</p>' : '<p>下一题会换一个用量条件。</p>') +
      actions + '<button type="button" class="btn-main" data-study-action="ionic-review" data-ionic-case="' + id +
      '">换一道题，自己做</button>' + (state.saved ? '<button type="button" class="btn-sub" data-teach="open-ionic" data-value="' +
      id + '">查看错题记录</button>' : '') + '</div>';
    root.innerHTML = '<section class="study-card ionic-task">' +
      '<p class="study-kicker">' + (step ? '第 ' + (state.index+1) + ' 步，共 ' + steps.length + ' 步' : '原题完成') +
      '</p><h2 tabindex="-1">' + (step?.title || '核对原题结果') + '</h2>' + body +
      '<details class="study-sop ionic-sop"' + (state.sopOpen ? ' open' : '') +
      '><summary>查看完整解题步骤</summary><ol>' + sopSteps + '</ol></details></section>';
    root.querySelector('.ionic-sop').ontoggle = event => {
      if (event.currentTarget.isConnected) state.sopOpen = event.currentTarget.open;
    };
    if (moveFocus) root.querySelector('h2').focus();
  }

  root.oninput = event => { state.value = event.target.value; };
  root.onsubmit = event => {
    event.preventDefault();
    let cause = '';
    state.notice = '';
    if (state.index === 0) {
      state.accepted = state.value === id;
      state.notice = state.accepted ? '这一步对了。接下来按原题的用量判断产物。' : amountHint;
      cause = '用量条件';
    } else if (state.index === 1) {
      state.accepted = state.value === exercise.products;
      state.notice = state.accepted ? '这一步对了。' + exercise.why : '再想想，前一步得到的 HCO₃⁻ 还能不能和 H⁺ 反应？';
      cause = '产物判断';
    } else {
      state.checks = checkEquation(state.value,id);
      const wrong = state.checks?.find(item => !item.ok);
      state.accepted = !!state.checks && !wrong;
      state.notice = !state.checks ? formatHint : state.accepted ? '方程式核对通过。' : '';
      cause = wrong?.cause;
    }
    if (!state.accepted && cause && !state.mistake) {
      state.mistake = cause;
      const answer = state.index === 0 ? amountLabels[state.value] : state.value;
      state.saved = window.ChemMistakes.recordIonic(id,state.question,cause,answer);
    }
    draw();
    root.querySelector(state.accepted ? '[data-ionic-action="next"]' : '[role="status"]')?.focus();
  };
  root.onclick = event => {
    const action = event.target.closest('[data-ionic-action]')?.dataset.ionicAction;
    if (action === 'hint') {
      state.level++;
      draw();
      root.querySelector('.question-step-help').focus();
    } else if (action === 'next' && state.accepted) {
      Object.assign(state,{index:state.index+1, value:'', level:0, notice:'', checks:null, accepted:false});
      draw(true);
    }
  };
  draw();
}

function mountReview(root,originalId,returnToQuestion) {
  const id = otherCase(originalId);
  const back = returnToQuestion ?
    '<button type="button" class="btn-sub" data-study-action="ionic-return">返回原题</button>' :
    '<button type="button" class="btn-sub" data-teach="open-ionic" data-value="' + originalId + '">回到错题记录</button>';
  let missed = false;
  root.innerHTML = '<section class="study-card ionic-task"><h2 tabindex="-1">换一道题，自己做</h2>' +
    '<p class="study-model-output">' + sample(id) + '</p><form>' +
    radioChoices('amount',Object.entries(amountLabels),'',amountQuestion) + equationField('') +
    '<div class="ionic-review-feedback"></div><div class="study-actions"><button type="submit" class="btn-main">提交复练</button>' +
    back + '</div></form></section>';
  root.onsubmit = event => {
    event.preventDefault();
    const form = event.target, input = new FormData(form);
    const equation = checkEquation(input.get('equation'),id);
    const amountOK = input.get('amount') === id;
    const correct = amountOK && equation?.every(item => item.ok);
    if (correct) {
      const {why,equation:reference} = cases[id];
      const saved = window.ChemMistakes.completeIonic(originalId);
      form.innerHTML = '<h3 tabindex="-1">' + (missed ? '订正后通过' : '复练首答通过') + '</h3>' +
        feedback(why,equation,true) + '<p class="ionic-equation">' + reference + '</p>' +
        (saved === false ? '<p class="study-note">当前浏览器无法保存复练结果。</p>' : '') +
        '<div class="study-actions">' + back + '</div>';
      form.querySelector('h3').focus();
      return;
    }
    missed = true;
    const message = !amountOK ? amountHint : equation ? '看看哪一项还需核对。' : formatHint;
    const target = form.querySelector('.ionic-review-feedback');
    target.innerHTML = feedback(message,amountOK ? equation : null,false);
    target.querySelector('[role="status"]').focus();
  };
  root.querySelector('h2').focus();
}

window.ChemIonicSop = {recognize,validCase,sample,checkEquation,createGuided,mountGuided,mountReview};
})();
