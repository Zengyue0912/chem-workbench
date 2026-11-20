(function () {
'use strict';

const routes = window.ChemSolveRoutes;
const methods = {
  calc: {route:routes['titration-calc'], name:'计算待测液浓度', model:'titration-calc'},
  error: {route:routes['titration-error'], name:'判断测定值的偏差', model:'titration-error'},
  both: {route:routes['titration-combo'], name:'先算浓度，再判断偏差', model:'titration-combo'}
};
const scenarios = {
  bubble: {
    name:'滴定前尖嘴有气泡，滴定后气泡消失',
    prompt:'记录的标准液用量与实际进瓶的用量相比', change:'大', bias:'偏高',
    reason:'有一部分标准液留在尖嘴里，读数差也把这部分记了进去。'
  },
  rinse: {
    name:'盛标准液的滴定管水洗后未润洗',
    prompt:'达到终点所需的标准液体积与正常用量相比', change:'大', bias:'偏高',
    reason:'残水稀释了标准液，滴定时需要用更多体积。计算测定值时仍用了标称浓度。'
  },
  flask: {
    name:'锥形瓶有蒸馏水，或取样后向瓶内加少量水',
    prompt:'锥形瓶中待测物的物质的量与加水前相比', change:'相同', bias:'无影响',
    reason:'加水只改变瓶中溶液的总体积，待测物的量和原取样体积仍相同。'
  },
  spill: {
    name:'滴定开始前，锥形瓶里的待测液溅出一部分',
    prompt:'达到终点所需的标准液体积与正常用量相比', change:'小', bias:'偏低',
    reason:'一部分待测物在反应前损失，剩余待测物需要的标准液更少。'
  },
  over: {
    name:'到终点后仍继续滴加，随后记录用量',
    prompt:'记录的标准液用量与恰好到终点时的用量相比', change:'大', bias:'偏高',
    reason:'多滴进去的标准液也记在用量里，按读数推算的待测物偏多。'
  }
};

const decimal = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const volume = '(' + decimal + ')\\s*(mL|L)\\b';
const molarity = '(' + decimal + ')\\s*mol/L\\b';
const asText = value => Number(value.toPrecision(8)).toString();
const normalize = text => String(text).normalize('NFKC').replace(/[−–]/g,'-')
  .replace(/\s*[×x]\s*10\s*\^?\s*([+-]?\d+)/gi,'e$1')
  .replace(/mol\s*(?:\/\s*l|[·⋅∙.]?\s*l\s*\^?\s*-\s*1)/gi,'mol/L')
  .replace(/[：∶]/g,':');
const unique = items => {
  const values = [...new Set(items)];
  return values.length === 1 ? values[0] : '';
};

function quantityAfter(text, prefix, pattern, convert = match => Number(match[1])) {
  const expression = new RegExp(prefix + '\\s*(?<![.\\d+\\-])' + pattern,'gi');
  return unique([...text.matchAll(expression)].map(convert).filter(Number.isFinite).map(String));
}

function volumeAfter(text, prefix) {
  return quantityAfter(text,prefix,volume,match => Number(match[1]) * (match[2].toLowerCase() === 'l' ? 1000 : 1));
}

function readQuestion(question) {
  const text = normalize(question);
  if (!/滴定/.test(text) || /返滴定|回滴|剩余[^。；\n]{0,24}再(?:用|滴定)|混合酸|双指示剂/.test(text)) return null;
  const asksActual = /(?:计算|求|算出)[^。；\n]{0,25}(?:实际|真实)(?:的)?(?:物质的量)?浓度|(?:实际|真实)(?:的)?(?:物质的量)?浓度(?:为多少|是多少)/.test(text);
  const calc = asksActual || /(?:计算|求|算出)[^。；\n]{0,24}浓度|浓度(?:是多少|为多少|为\s*[_?])/.test(text);
  const error = /偏高|偏低|无影响|误差|测定(?:值|结果)?[^。；\n]{0,8}影响|测得[^。；\n]{0,12}偏差|结果[^。；\n]{0,8}影响/.test(text)
    || (asksActual && /气泡|未润洗|液体溅出/.test(text));
  if (!calc && !error) return null;
  if (calc && /(?:求|计算)[^。；\n]{0,10}标准(?:溶)?液(?:的)?浓度|稀释至|稀释到|定容至|定容到/.test(text)) return null;

  const matches = [
    ['bubble', /(?:滴定前|起初|开始时)[^。；\n]{0,22}(?:尖嘴|管尖|尖端)[^。；\n]{0,7}(?:有|存在)[^。；\n]{0,5}气泡[^。\n]{0,28}(?:气泡)?(?:消失|充满溶液)/],
    ['rinse', /(?:盛|装|用于装)[^。\n]{0,12}标准[^。\n]{0,10}滴定管[^。\n]{0,23}(?:未|没有|不)[^。\n]{0,12}润洗|滴定管[^。\n]{0,16}水洗[^。\n]{0,22}(?:直接|就)[^。\n]{0,10}(?:装入|加入|注入)[^。\n]{0,12}标准|滴定管[^。\n]{0,15}(?:未用|没有用)[^。\n]{0,8}标准[^。\n]{0,10}润洗/],
    ['flask', /锥形瓶[^。；\n]{0,12}(?:未干燥|有[^。；\n]{0,7}蒸馏水|用蒸馏水洗[^。；\n]{0,9}后)|取样后[^。；\n]{0,15}(?:加|加入)[^。；\n]{0,7}水/],
    ['spill', /(?:滴定前|滴定开始前)[^。；\n]{0,20}(?:待测液|样品)[^。；\n]{0,12}(?:溅出|洒出)/],
    ['over', /(?:终点后|超过终点)[^。；\n]{0,16}(?:继续滴|再滴|才记录)|滴过了终点/]
  ].filter(([,rule]) => rule.test(text)).map(([key]) => key);
  const explicitRatio = unique([...text.matchAll(/待测(?:物|液)(?:与|和|:|\/)标准(?:物|液)[^。；\n\d]{0,14}(\d+)\s*:\s*(\d+)/g)]
    .map(([,sample,standard]) => sample + ':' + standard));
  const singleAcids = new Set([...text.matchAll(/\b(?:HCl|HNO3|CH3COOH)\b|盐酸|硝酸|醋酸|乙酸/gi)].map(([name]) => (
    /醋酸|乙酸|ch3cooh/i.test(name) ? 'acetate' : /硝酸|hno3/i.test(name) ? 'nitrate' : 'chloride')));
  const monoPair = singleAcids.size === 1 && /NaOH|KOH|氢氧化钠|氢氧化钾/i.test(text)
    && !/二元酸|多元酸|H2SO4|H2C2O4|草酸|硫酸|混合液|共存/.test(text);
  const completeDiacid = /(?:二元酸|H2A|H2C2O4|草酸)/i.test(text) && /(?:完全|恰好)(?:被)?中和|第二(?:个)?(?:化学计量点|当量点)/.test(text)
    && /(?:用|标准液为)[^。\n]{0,35}(?:NaOH|KOH|氢氧化钠|氢氧化钾)/i.test(text);
  const standard = quantityAfter(text,'(?:标准(?:溶)?液(?:的)?(?:浓度|标称浓度)|标称浓度)\\s*(?:为|是|=|:)?',molarity)
    || quantityAfter(text,'',molarity);

  return {
    method:calc && error ? 'both' : calc ? 'calc' : 'error',
    asksActual,
    fields:{
      concentration:standard,
      sample:volumeAfter(text,'(?:准确)?(?:移取|量取|吸取|取用|取了|取|滴定|待测(?:溶)?液(?:的)?(?:取样)?体积\\s*(?:为|是|:|=)?)'),
      used:volumeAfter(text,'(?:消耗(?:了)?|耗用|用去|用掉|耗去|(?:标准(?:溶)?液(?:的)?|滴定液(?:的)?)?用量\\s*(?:为|是|:|=)?|第二(?:个)?(?:化学计量点|当量点)\\s*(?:对应|为|是|:))'),
      initial:volumeAfter(text,'(?:初读数|初始读数|滴定前(?:的)?读数)\\s*(?:为|是|:|=)?'),
      final:volumeAfter(text,'(?:末读数|终读数|滴定后(?:的)?读数|终点(?:的)?读数)\\s*(?:为|是|:|=)?'),
      ratio:explicitRatio || (completeDiacid ? '1:2' : monoPair ? '1:1' : ''),
      scenario:unique(matches),
      loss:volumeAfter(text,'(?:未进瓶体积|用于填尖嘴的体积|填(?:入|充|满)尖嘴的体积)\\s*(?:为|是|:|=)?')
    }
  };
}

function numberField(value) {
  const text = normalize(value || '').trim();
  return new RegExp('^' + decimal + '$','i').test(text) ? Number(text) : NaN;
}

function buildPlan(method, fields, asksActual) {
  const {route} = methods[method];
  const steps = [], results = [];
  const calc = method !== 'error';
  const error = method !== 'calc';
  const scenario = Object.hasOwn(scenarios,fields.scenario) ? scenarios[fields.scenario] : null;
  if (error && !scenario) return {problem:'先按原题选出要分析的操作。'};

  const numeric = (id,title,input,action,expected,unit,note) => ({
    id,title,input,action,expected,unit,note, output:asText(expected) + ' ' + unit
  });
  if (calc) {
    const standard = numberField(fields.concentration), sample = numberField(fields.sample);
    const direct = numberField(fields.used), initial = numberField(fields.initial), final = numberField(fields.final);
    const read = final - initial;
    if (!(standard > 0 && Number.isFinite(standard))) return {problem:'请填写大于零的标准液浓度，单位 mol/L。'};
    if (!(sample > 0 && Number.isFinite(sample))) return {problem:'请填写大于零的待测液取样量，单位 mL。'};
    if ((fields.initial || fields.final) && !(initial >= 0 && read > 0 && Number.isFinite(read))) {
      return {problem:'请同时填写初读数和末读数，且末读数应大于初读数。'};
    }
    if (fields.used && !(direct > 0 && Number.isFinite(direct))) return {problem:'请填写大于零的标准液用量，单位 mL。'};
    if (direct > 0 && read > 0 && Math.abs(direct-read) > 0.00001) return {problem:'填写的用量与初末读数的差不一致，请核对原题。'};
    const used = direct > 0 ? direct : read;
    if (!(used > 0)) return {problem:'请从题干、图或表填入标准液用量，或填写两次读数。'};
    const ratio = normalize(fields.ratio || '').trim().match(/^(\d{1,3})\s*:\s*(\d{1,3})$/);
    if (!(ratio && Number(ratio[1]) > 0 && Number(ratio[2]) > 0)) {
      return {problem:'请按配平的反应式填写待测物∶标准物的物质的量之比，例如 1:2。'};
    }

    const standardAmount = standard * used / 1000;
    const sampleAmount = standardAmount * Number(ratio[1]) / Number(ratio[2]);
    const concentration = sampleAmount / (sample / 1000);
    if (![standardAmount,sampleAmount,concentration].every(value => value > 0 && Number.isFinite(value))) {
      return {problem:'请检查原题数据的数量级和单位。'};
    }
    if (read > 0) steps.push(numeric('AIS-220.2a','先算标准液用量',
      '初读数 ' + asText(initial) + ' mL，末读数 ' + asText(final) + ' mL。',
      '用末读数减初读数。',used,'mL','滴定管的用量取两次读数的差。'));
    steps.push(numeric('AIS-220.2','求消耗的标准液物质的量',
      '标准液浓度 ' + asText(standard) + ' mol/L，用量 ' + asText(used) + ' mL。',
      '把用量换算成 L，再用浓度乘体积。',standardAmount,'mol','1 mL = 0.001 L。'));
    steps.push(numeric('AIS-220.3a','按反应比例换算待测物的量',
      '上一步的标准物为 ' + asText(standardAmount) + ' mol，待测物∶标准物 = ' + ratio[1] + ':' + ratio[2] + '。',
      '用标准物的量乘以待测物系数，再除以标准物系数。',sampleAmount,'mol','两个系数的次序要与题干的反应物对应。'));
    steps.push(numeric('AIS-220.3','求待测液浓度',
      '上一步的待测物为 ' + asText(sampleAmount) + ' mol，待测液取样量 ' + asText(sample) + ' mL。',
      '用待测物的量除以待测液体积（L）。',concentration,'mol/L','分母取待测液的取样体积。'));
    results.push((method === 'both' || asksActual ? '按记录算出的浓度' : '待测液浓度') + '为 ' + asText(concentration) + ' mol/L。');

    if (method === 'both' && asksActual) {
      const loss = numberField(fields.loss);
      if (fields.scenario !== 'bubble') return {problem:'这道题要求校正实际浓度。当前可校正尖嘴气泡题，请核对操作条件。'};
      if (!(loss > 0 && loss < used)) return {problem:'求实际浓度还需要填入尖嘴所占的体积，且它应小于记录用量。'};
      const actualVolume = used - loss;
      const actual = concentration * (actualVolume / used);
      steps.push(numeric('AIS-235.3a','算真正进瓶的用量',
        '记录用量 ' + asText(used) + ' mL，填入尖嘴 ' + asText(loss) + ' mL。',
        '用记录用量减去填入尖嘴的体积。',actualVolume,'mL','只有进瓶的标准液与待测物反应。'));
      steps.push(numeric('AIS-235.3','算校正后的浓度',
        '实际用量 ' + asText(actualVolume) + ' mL，标准液浓度 ' + asText(standard) + ' mol/L；取样 ' + asText(sample) + ' mL。',
        '用校正后的体积重算，反应比例仍为 ' + ratio[1] + ':' + ratio[2] + '。',actual,'mol/L','待测液取样量与两种溶液的计量比保持原题条件。'));
      results.push('按实际进瓶量算出的浓度为 ' + asText(actual) + ' mol/L。');
    }
  }
  if (error) {
    steps.push({id:'AIS-221.2',title:'判断操作改变了哪个量',input:scenario.name,action:scenario.prompt + '，是大、小还是相同？',
      expected:scenario.change,options:['大','小','相同'],note:'先追踪操作对用量或待测物的影响。',output:scenario.prompt + '，结果为' + scenario.change + '。'});
    steps.push({id:'AIS-221.3',title:'判断按原式得到的测定值',input:scenario.prompt + '，结果为' + scenario.change + '。',
      action:'其他条件按原题，测定值会怎样？',expected:scenario.bias,options:['偏高','偏低','无影响'],
      note:'把上一步的变化带回测定式，比较算出的值和正常情况下的值。',output:'测定值' + scenario.bias + '。' + scenario.reason});
    results.push('误差判断为' + scenario.bias + '。' + scenario.reason);
  }
  return {route,steps,results};
}

const fieldLabels = {
  concentration:'标准液浓度（mol/L）', sample:'待测液取样量（mL）', used:'标准液用量（mL）',
  initial:'初读数（mL）', final:'末读数（mL）', ratio:'待测物∶标准物的计量比', loss:'填入尖嘴的体积（mL）'
};

function missingMeasurements(fields,asksActual) {
  const missing = ['concentration','sample','ratio'].filter(id => !fields[id]?.trim()).map(id => fieldLabels[id]);
  if (fields.initial?.trim() || fields.final?.trim()) {
    if (!fields.initial?.trim()) missing.push(fieldLabels.initial);
    if (!fields.final?.trim()) missing.push(fieldLabels.final);
  } else if (!fields.used?.trim()) {
    missing.push('标准液用量（或初、末读数）');
  }
  if (asksActual && !fields.loss?.trim()) missing.push(fieldLabels.loss);
  return missing;
}

function mount(root, state) {
  const escape = text => window.ChemStudio.escape(String(text ?? ''));
  const option = (id,label,value) => '<option value="' + id + '"' + (id === value ? ' selected' : '') + '>' + escape(label) + '</option>';
  const input = id => '<label class="study-field">' + fieldLabels[id] + '<input name="' + id + '" value="' + escape(state.fields[id]) +
    '" inputmode="' + (id === 'ratio' ? 'text' : 'decimal') + '" ' + (id === 'ratio' ? 'placeholder="例如 1:2"' : '') + ' maxlength="24"></label>';
  const action = (label,id) => '<button type="button" class="btn-sub" data-titration-action="' + id + '">' + escape(label) + '</button>';
  const status = () => state.notice ? '<p class="study-result ' + (state.accepted ? 'study-correct' : 'study-try') + '" role="status">' + escape(state.notice) + '</p>' : '';

  function updateMissing() {
    const target = root.querySelector('[data-titration-missing]');
    if (!target) return;
    const missing = missingMeasurements(state.fields,state.method === 'both' && state.asksActual);
    target.hidden = !missing.length;
    target.textContent = missing.length ? '请从原题或图表补齐 ' + missing.join('、') + '。' : '';
  }

  function draw(focus) {
    const {method,plan,index,preparedId} = state;
    const {route,name,model} = methods[method];
    const step = plan?.steps[index];
    const current = plan ? index + 1 : 0;
    const start = {id:route.id + '.1',title:'确认原题条件'};
    const finish = {id:route.id + '.4',title:'核对原题结果'};
    const upcoming = (method === 'error' ? [] : [{id:'AIS-220.2',title:'计算标准液用量与物质的量'},{id:'AIS-220.3',title:'按反应比例求浓度'}])
      .concat(method === 'calc' ? [] : [{id:'AIS-221.2',title:'追踪操作改变的量'},{id:'AIS-221.3',title:'判断测定值的偏差'}]);
    const roadmap = [start,...(plan?.steps || upcoming),finish];
    const heading = '<section class="method-roadmap" aria-label="原题的总控 SOP"><div class="method-roadmap-heading">' +
      '<h2>按原题解 · 总控 SOP</h2><span>' + (preparedId ? escape(preparedId) + ' · ' : '') + route.id +
      '</span></div><p class="method-route-goal"><strong>' + name + '</strong><span>' + escape(route.goal) + '</span></p>' +
      '<ol class="method-steps method-solve-steps">' + roadmap.map(({id,title},i) => '<li ' + (i === current ? 'aria-current="step"' : '') +
        ' class="' + (i < current ? 'is-done' : '') + '"><span aria-hidden="true">' + (i < current ? '✓' : i+1) + '</span><div><strong>' + escape(title) +
        '</strong><small>' + id + '</small></div></li>').join('') + '</ol></section>';
    let body, title, sop;
    if (!plan) {
      title = start.title;
      const calc = method !== 'error', error = method !== 'calc';
      const data = calc ? '<p class="study-result study-try" data-titration-missing hidden></p><div class="own-titration-fields">' +
        ['concentration','sample','ratio','used','initial','final'].map(input).join('') +
        (method === 'both' && state.asksActual ? input('loss') : '') + '</div><p class="study-note">填标准液用量，或填初读数和末读数。图表里给出的数据可以在这里补填。</p>' : '';
      const caseSelect = !error ? '' : preparedId ? '<p>原题中的操作：' + escape(scenarios[state.fields.scenario].name) + '</p>' :
        '<label class="study-field">原题中的操作<select name="scenario">' + option('','选择一种操作',state.fields.scenario) +
        Object.entries(scenarios).map(([id,scenario]) => option(id,scenario.name,state.fields.scenario)).join('') + '</select></label>';
      const methodField = preparedId ? '' : '<label class="study-field">这次解哪一问<select name="method">' +
        Object.entries(methods).map(([id,entry]) => option(id,entry.name,method)).join('') + '</select></label>';
      body = '<form data-titration-form="prepare">' + methodField +
        data + caseSelect + '<p class="study-note">' +
        (calc ? '核对自动填入的条件。计量比按原题的反应式填写。' : '核对选中的操作与原题一致。') + '</p>' + status() +
        '<div class="study-actions"><button type="submit" class="btn-main">确认条件，开始解题</button></div></form>';
      sop = ['原题题干和相关图表。','核对所求、数字、单位及反应比例。','供后续步骤使用的原题条件。','图表里给出的数据需要手动补填。','原题所需的条件已齐全。'];
    } else if (step) {
      title = step.title;
      const control = step.options
        ? '<select name="answer" aria-label="本步答案" required>' + option('','选择答案',state.answer) + step.options.map(value => option(value,value,state.answer)).join('') + '</select>'
        : '<input name="answer" aria-label="本步答案" required inputmode="decimal" maxlength="40" value="' + escape(state.answer) + '"> <span>' + step.unit + '</span>';
      body = '<p class="method-prompt">' + escape(step.input) + '</p><p>' + escape(step.action) + '</p>' +
        (state.accepted ? status() + '<div class="study-actions">' + action('继续下一步','next') + '</div>' :
        '<form data-titration-form="check"><div class="study-field">' + control + '</div>' + status() +
          '<div class="study-actions"><button type="submit" class="btn-main">核对这一步</button></div></form>');
      sop = [step.input,step.action,state.accepted ? step.output : '答对后显示，并交给下一步。',step.note,'本步数值或判断正确。'];
    } else {
      title = '本次小问已做完';
      body = '<ul>' + plan.results.map(result => '<li>' + escape(result) + '</li>').join('') + '</ul><div class="study-actions">' +
        '<button type="button" class="btn-sub" data-study-action="method-from-exam" data-method-id="' + model + '">练同类题</button></div>';
      sop = ['已核对的各步结果。','检查是否答齐原题的小问。',plan.results.join(' '),
        method === 'error' ? '用原题的操作条件解释偏差。' : '浓度的单位为 mol/L。','本次所选的小问已答完。'];
    }
    const labels = ['输入','操作','输出','注意事项','完成标准'];
    root.innerHTML = heading + '<div class="method-stage-grid"><section class="study-card method-card"><h2 id="ownTitrationTitle" tabindex="-1">' + escape(title) + '</h2>' +
      body + (plan ? '<div class="study-actions">' + action('回去核对条件','back') + '</div>' : '') +
      '</section><aside class="study-card method-live-sop"><p class="study-kicker">当前子 SOP <span>' + (step?.id || (plan ? finish.id : start.id)) +
      '</span></p><dl>' + labels.map((label,i) => '<dt>' + label + '</dt><dd>' + escape(sop[i]) + '</dd>').join('') + '</dl></aside></div>';
    updateMissing();
    if (focus) root.querySelector(focus)?.focus();
  }

  const saveFields = form => {
    const {method,...fields} = Object.fromEntries(new FormData(form));
    if (method) state.method = method;
    Object.assign(state.fields,fields);
  };
  root.oninput = event => {
    const {name,value} = event.target;
    if (name === 'answer') state.answer = value;
    else if (Object.hasOwn(state.fields,name)) {
      state.fields[name] = value;
      updateMissing();
    }
  };
  root.onchange = event => {
    if (event.target.name !== 'method') return;
    saveFields(event.target.form);
    state.notice = '';
    draw('[name="method"]');
  };
  root.onsubmit = event => {
    event.preventDefault();
    if (event.target.dataset.titrationForm === 'prepare') {
      saveFields(event.target);
      const plan = buildPlan(state.method,state.fields,state.asksActual);
      state.plan = plan.problem ? null : plan;
      state.notice = plan.problem || '';
      state.index = 0;
      state.answer = '';
      state.accepted = false;
      return draw('#ownTitrationTitle');
    }
    const step = state.plan?.steps[state.index];
    if (!step || state.accepted) return;
    state.answer = new FormData(event.target).get('answer');
    const answer = step.unit ? numberField(normalize(state.answer).trim().replace(new RegExp('\\s*' + step.unit + '$','i'),'')) : NaN;
    state.accepted = step.options ? state.answer === step.expected :
      answer > 0 && Number.isFinite(answer) && Math.abs(answer-step.expected) <= Math.abs(step.expected)*0.0006;
    state.notice = state.accepted ? '这一步对了。' + step.output : '再试一下。' + step.note;
    draw(state.accepted ? '[data-titration-action="next"]' : '[name="answer"]');
  };
  root.onclick = event => {
    const action = event.target.closest('[data-titration-action]')?.dataset.titrationAction;
    if (action === 'next' && state.accepted) state.index++;
    else if (action === 'back') state.plan = null;
    else return;
    state.answer = '';
    state.accepted = false;
    state.notice = '';
    draw('#ownTitrationTitle');
  };
  draw();
}

window.ChemTitrationSop = {readQuestion,buildPlan,mount};
})();
