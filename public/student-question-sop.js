(function () {
'use strict';

const fields = ['title','input','action','output','attention','criteria'];
const labels = ['输入','操作','输出','注意事项','完成标准'];
const makeStep = (title,input,action,output,attention,criteria) => ({title,input,action,output,attention,criteria});
const paper = 'https://mat1.gtimg.com/sh/zt/edu/2013gk/2012huaxue.pdf';

const ionization = new Map([
  ['NaHSO4', ['NaHSO₄','抑制','溶液提供 H⁺。']],
  ['HCl', ['HCl','抑制','溶液提供 H⁺。']],
  ['NaOH', ['NaOH','抑制','溶液提供 OH⁻。']],
  ['KOH', ['KOH','抑制','溶液提供 OH⁻。']],
  ['KF', ['KF','促进','F⁻ 水解，可看作消耗水电离产生的 H⁺。']],
  ['NaF', ['NaF','促进','F⁻ 水解，可看作消耗水电离产生的 H⁺。']],
  ['KAl(SO4)2', ['KAl(SO₄)₂','促进','Al³⁺ 水解，可看作消耗水电离产生的 OH⁻。']],
  ['AlCl3', ['AlCl₃','促进','Al³⁺ 水解，可看作消耗水电离产生的 OH⁻。']],
  ['NH4Cl', ['NH₄Cl','促进','NH₄⁺ 水解，可看作消耗水电离产生的 OH⁻。']],
  ['CH3COONa', ['CH₃COONa','促进','CH₃COO⁻ 水解，可看作消耗水电离产生的 H⁺。']],
  ['NaI', ['NaI','无明显影响','Na⁺ 和 I⁻ 在这类题中按无明显水解处理。']],
  ['NaCl', ['NaCl','无明显影响','Na⁺ 和 Cl⁻ 在这类题中按无明显水解处理。']],
  ['KNO3', ['KNO₃','无明显影响','K⁺ 和 NO₃⁻ 在这类题中按无明显水解处理。']]
]);

function waterPlan(stem,options) {
  if (options.length < 2 || !/水的电离(?:平衡|程度)/.test(stem) || /混合|加热|降温|升温|最大|最小/.test(stem)) return null;
  const effect = /不(?:产生|造成|发生)影响|无(?:明显)?影响|没有影响|不影响|保持不变/.test(stem) ? '无明显影响'
    : /抑制/.test(stem) && !/促进|不抑制/.test(stem) ? '抑制'
    : /促进/.test(stem) && !/抑制|不促进/.test(stem) ? '促进' : '';
  if (!effect) return null;
  const entries = options.map(({letter,content}) => {
    const formula = content
      .match(/^([A-Za-z0-9()]+)\s*(?:水?溶液)?[。；;，,]?\s*$/)?.[1];
    return {letter,substance:ionization.get(formula)};
  });
  if (entries.some(entry => !entry.substance)) return null;
  const correct = entries.filter(entry => entry.substance[1] === effect);
  if (correct.length !== 1) return null;
  const all = entries.map(({letter,substance}) => letter + ' ' + substance[0]).join('、');
  const hydrolysis = entries.filter(entry => entry.substance[1] === '促进').map(entry => entry.substance[2]).join(' ');
  return {
    title:'水的电离平衡',missing:[],target:effect === '无明显影响' ? '选出对水的电离无明显影响的选项。' : '选出使水的电离受到' + effect + '的选项。',
    steps:[
      makeStep('先找直接提供 H⁺ 或 OH⁻ 的溶液',all,
        '找出直接给溶液带来 H⁺ 或 OH⁻ 的物质，并判断对水电离的影响。','写下符合条件的物质和影响方向。',
        '外加 H⁺ 或 OH⁻ 会抑制水的电离。','能指出 H⁺ 或 OH⁻ 来自哪个选项。'),
      makeStep('再判断其余选项是否水解','上一步标出的选项，以及其余盐溶液。',
        '把其余盐拆成离子。看看哪些离子会水解，并判断水解对水电离的影响。','写下其余选项的水解判断。',
        hydrolysis || '盐类水解能促进水的电离。','能区分发生水解和无明显水解的离子。'),
      makeStep('逐项比较后选答案','前两步对每种溶液的判断。',
        '逐项标出抑制、促进或无明显影响，再选出题目要求的一项。','一个选项和一句理由。',
        '看清这道题问的是水的电离。','能说明所选项为什么符合题意。')
    ],
    reference:['参考答案 ' + correct[0].letter,...entries.map(({letter,substance}) => letter + ' ' + substance[0] + ' · ' +
      substance[1] + '。' + substance[2])]
  };
}

function analyze(question) {
  const {text,stem,options} = window.ChemPreparedSop.readChoices(question);
  const vsepr = window.ChemVseprStudy.identify(stem,options,question);
  const choice = options.length > 0 || /下列[^。！？\n]{0,30}(?:正确|错误|不合理|有误|符合)|选项|哪一项/.test(stem) ||
    (!!vsepr && /(?:下列|以下)[\s\S]+的是/.test(stem));
  const negative = /不正确|不合理|错误|不符合|不能说明/.test(stem);
  const asks = stem.split(/[。！？\n；]/).map(line => line.trim()).filter(Boolean);
  const target = choice ? (negative ? '判断哪些说法有问题，选出题目要求的错误项。' : '找出符合题意的选项。')
    : asks.findLast(line => /求|算|判断|说明|解释|写出|填|为什么|设计|证明|多少|怎样|如何|是什么|比较/.test(line))?.slice(-180) || '';
  const missing = [];
  const figure = /如(?:下|右|左|上)?图|[右左上下]图|见图|图中|图示|装置图|示意图|图[甲乙一二三\d]\s*(?:所示|中)/.test(stem);
  const table = /如下表|见表|[上下]表|表中|表[甲乙一二三\d]\s*(?:所示|中)/.test(stem);
  const cell = /装置|电极|电路|电池/.test(stem) && /原电池|电解池|电解|电极|盐桥/.test(text);
  if (figure) missing.push(cell ? '装置图上的电极材料、导线接法，以及是否画出了外接电源。' : '原题配图。请补上图中的标注、读数或各部件之间的关系。');
  if (table) missing.push('原题表格中与所求有关的行、列和单位。');
  if (choice && options.length < 2) missing.push('选项文字。请把题目要求判断的选项贴全。');
  const calculation = /(?<!要)求|计算|算出|多少/.test(target);
  const equation = /(?:写出|书写|配平|列出).{0,20}(?:方程式|化学式)|(?:方程式|化学式).{0,10}(?:怎样写|如何写)/.test(target);
  const experiment = !choice && !calculation && !equation && /装置|实验|探究|检验|对照|控制变量|操作|现象/.test(stem);
  const zinc = /Zn\s*\+\s*2\s*H\s*\+[\s\S]{0,20}Zn\s*2\s*\+[\s\S]{0,12}H\s*2/i.test(stem);
  const source = cell && zinc && /不可能是同种材料/.test(text) && /电解池[^。]{0,28}稀盐酸/.test(text) &&
    /原电池[^。]{0,28}稀盐酸/.test(text) && /稀硫酸/.test(text) ? paper : '';
  const vseprPlan = !missing.length && vsepr?.exercise ? window.ChemVseprStudy.makePlan(vsepr.exercise,makeStep) : null;
  const water = !missing.length && waterPlan(stem,options);
  const reading = {
    type:choice ? (/多选|不定项|选出所有/.test(stem) ? '多选题' : vseprPlan || water || /单选|唯一/.test(stem) ? '单项选择题' : '选择题')
      : experiment ? '实验探究题' : calculation ? '计算题' : /填空|填入/.test(stem) ? '填空题' : equation ? '方程式书写题' : '解答题',
    ...(vsepr?.reading || (water ? {
      topic:'水的电离平衡',
      method:'判断不同溶质使水的电离受到抑制、促进，还是无明显影响。',
      firstLook:'先看各选项会直接提供 H⁺、OH⁻，还是发生水解。'
    } : {})),
    correction:vsepr?.correction || null
  };
  return {question,choice,missing,source,plan:vseprPlan || water,reading,
    vseprExercise:vseprPlan ? vsepr.exercise : null,
    index:0,entries:[],answer:'',supplemental:'',condition:'',
    origin:vseprPlan ? 'VSEPR 专项' : water ? '水电离专项' : '题型库'};
}

function mount(root,state) {
  const escape = text => window.ChemStudio.escape(String(text ?? ''));
  const selected = (value,actual) => value === actual ? ' selected' : '';
  const act = (label,action) => '<button type="button" class="btn-sub" data-question-action="' + action + '">' + escape(label) + '</button>';
  const needs = () => [...new Set([...state.missing,...state.plan.missing])];
  const supplied = () => state.condition === 'added' && state.supplemental.trim().length >= 4;
  function conditions() {
    const missing = needs();
    return '<div class="question-conditions">' + (missing.length ? '<p><strong>请核对原题资料</strong></p><ul>' +
      missing.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul>' +
      '<label class="study-field">图表或条件的情况<select name="condition">' +
      '<option value="">请选择</option><option value="added"' + selected('added',state.condition) +
      '>我能补充这些条件</option><option value="absent"' + selected('absent',state.condition) +
      '>手里没有，先做能确定的部分</option></select></label>' : '') +
      '<label class="study-field">补充原题条件<textarea name="supplemental" maxlength="1200" rows="2" placeholder="写原图的标注、读数、连接关系或遗漏的小问">' +
      escape(state.supplemental) + '</textarea></label></div>';
  }

  function draw(focus) {
    const {index,plan,entries} = state;
    const step = plan.steps[index];
    const exercise = state.vseprExercise;
    const countStep = exercise && index === 1;
    const hint = state.hintStep === index ? state.hintText : '';
    const remaining = needs().length && !supplied();
    const hasStuck = entries.some(entry => entry.stuck);
    const missingNote = remaining ? '<p class="study-result study-try">还有原题条件待补。先记录能确定的部分。</p>' : '';
    const road = '<section class="method-roadmap" aria-label="题型总控 SOP">' +
      '<div class="method-roadmap-heading"><h2>题型解题 SOP</h2><span>' +
      escape(state.preparedId + ' · ' + state.origin) + '</span></div>' +
      '<p class="method-route-goal"><strong>' + escape(plan.title) +
      '</strong></p><ol class="method-steps method-solve-steps">' + plan.steps.map(({title},i) =>
      '<li ' + (i === index ? 'aria-current="step"' : '') + ' class="' + (i < index && !entries[i]?.stuck ? 'is-done' : '') +
      '"><span aria-hidden="true">' + (i + 1) + '</span><div><strong>' + escape(title) + '</strong><small>' +
      escape(state.preparedId) + '-0' + (i+1) + ' · ' +
      (i < index ? (entries[i]?.stuck ? '有卡点' : '已记录') : i === index ? '当前步骤' : '待完成') + '</small></div></li>').join('') + '</ol></section>';
    const previous = entries[index - 1]?.answer;
    const aside = step ? '<aside class="study-card method-live-sop"><p class="study-kicker">当前子 SOP</p><dl>' +
      labels.map((label,i) => '<dt>' + label + '</dt><dd>' + escape(step[fields[i+1]]) + '</dd>').join('') + '</dl></aside>' : '';
    const back = index ? act('返回上一步','back') : '';
    const note = state.notice ? '<p class="study-result study-try" role="status">' + escape(state.notice) + '</p>' : '';
    const finalChoice = exercise && index === plan.steps.length - 1;
    const response = countStep ? window.ChemVseprStudy.countFields(exercise,state.vseprCounts || {}) :
      (finalChoice ? window.ChemVseprStudy.choiceField(exercise,state.vseprChoice) : '') +
      '<label class="study-field">' + (finalChoice ? '写下选择依据' : '写下这一步的结果') +
      '<textarea name="answer" rows="3" maxlength="1200" placeholder="' + escape(step?.output) + '">' + escape(state.answer) + '</textarea></label>';
    const help = hint ? '<section class="question-step-help" aria-label="这一步的提示"><h3>给你一点线索</h3><p tabindex="-1">' +
      escape(hint) + '</p>' + (exercise ?
        '<details' + (state.showVseprComparison ? ' open' : '') + '><summary>用 3D 看 SO₂ 和 OF₂</summary>' +
        (state.showVseprComparison ? '<chem-vsepr-comparison></chem-vsepr-comparison>' : '') + '</details>' : '') +
      (!plan.reference ? act('记下卡点，继续','skip') : '') + '</section>' : '';
    const reference = plan.reference ? '<details class="question-reference"><summary>核对参考答案</summary><ul class="question-result">' +
      plan.reference.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul></details>' : '';
    const body = step ? '<p class="method-prompt">' + escape(step.action) + '</p>' +
      (previous ? '<p class="question-previous"><strong>上一步留下的结果</strong> ' + escape(previous) + '</p>' : '') +
      (index !== 1 ? missingNote : '') + '<form data-question-form="step">' + (index === 1 && !plan.reference ? conditions() : '') + response + note +
      '<div class="study-actions"><button type="submit" class="btn-main">' + (index === plan.steps.length-1 ? '整理这题的推理' : '记下结果，继续') +
      '</button>' + act('我卡在这一步','stuck') + back + '</div></form>' + help : missingNote +
      '<p>' + (remaining || hasStuck ? '这题还有待补资料或卡点。' : '你的步骤和结论已整理。') + '可以下载后对照参考答案，或请老师核对。</p>' +
      '<ul class="question-result">' + entries.map((entry,i) => '<li><strong>' + escape(plan.steps[i].title) + '</strong> ' +
        escape([entry.choice && '选 ' + entry.choice,entry.answer].filter(Boolean).join(' · ') || '这里还有卡点。') +
        (entry.stuck ? '（待核对）' : '') + '</li>').join('') + '</ul>' +
      reference + '<div class="study-actions">' + (state.practiceNext ? act('继续做变式','practice-next') : '') +
      act('下载步骤与作答','download') + back + '</div>';
    const source = state.source ? '<p class="study-note">与 2012 年上海卷第 14 题吻合。<a href="' + state.source +
      '" target="_blank" rel="noopener noreferrer">核对原题和装置图</a></p>' : '';
    const practiceMolecule = exercise?.options.some(({particle}) => particle.formula === 'H₂O') ? 'H2S' : 'H2O';
    const practice = !step && exercise && !state.practiceNext ? '<section class="study-card" aria-label="换一道题试试"><h2>换一道题试试</h2><chem-vsepr-practice molecule="' +
      practiceMolecule + '"></chem-vsepr-practice></section>' : '';
    root.innerHTML = road + '<div class="method-stage-grid"><section class="study-card method-card"><h2 id="ownQuestionTitle" tabindex="-1">' +
      escape(step?.title || '本题推理草稿') + '</h2>' + source + body + '</section>' + aside + '</div>' +
      practice;
    const comparison = root.querySelector('.question-step-help details');
    if (comparison) comparison.ontoggle = () => {
      if (!comparison.isConnected) return;
      state.showVseprComparison = comparison.open;
      if (comparison.open && !comparison.querySelector('chem-vsepr-comparison')) {
        comparison.append(document.createElement('chem-vsepr-comparison'));
      }
    };
    if (focus) root.querySelector(focus)?.focus();
  }

  function advance(stuck) {
    state.notice = '';
    const finalChoice = state.vseprExercise && state.index === state.plan.steps.length - 1;
    if (!stuck && state.vseprExercise && state.index === 1) {
      const result = window.ChemVseprStudy.checkCounts(state.vseprExercise,state.vseprCounts || {});
      if (result.hint) {
        state.hintStep = state.index;
        state.hintText = result.hint;
        return draw('[name="domain-' + result.field + '"]');
      }
      state.answer = result.answer;
    }
    if (!stuck && finalChoice) {
      const hint = window.ChemVseprStudy.checkChoice(state.vseprExercise,state.vseprChoice);
      if (hint) {
        state.hintStep = state.index;
        state.hintText = hint;
        return draw('[name="vsepr-choice"]');
      }
    }
    if (state.index === 1 && needs().length && !supplied() && state.condition !== 'absent') {
      if (stuck) state.condition = 'absent';
      else {
        state.notice = '请补上具体条件，或选择先做能确定的部分。';
        return draw('[name="condition"]');
      }
    }
    if (!stuck && state.answer.trim().length < 2) {
      state.notice = '先写一点自己的想法。还没想出来时，可以标为卡点。';
      return draw('[name="answer"]');
    }
    state.entries.length = state.index;
    state.entries.push({answer:state.answer.trim(),stuck,...(finalChoice ? {choice:state.vseprChoice} : {})});
    state.index++;
    state.answer = '';
    state.hintStep = null;
    state.showVseprComparison = false;
    draw('#ownQuestionTitle');
  }

  function download() {
    const heading = state.preparedId + ' · ';
    const parts = ['# ' + heading + state.plan.title,'','原题',state.question,'','补充条件',state.supplemental.trim() || '待核对'];
    const {reading} = state;
    if (reading) parts.push('','考点',reading.topic,'','考法',reading.method);
    if (needs().length && !supplied()) parts.push('','待补资料',...needs());
    state.plan.steps.forEach((step,i) => {
      parts.push('','## ' + (i+1) + '. ' + step.title);
      labels.forEach((label,j) => parts.push('','**' + label + '** ' + step[fields[j+1]]));
      if (state.entries[i]?.choice) parts.push('','**学生选择** ' + state.entries[i].choice);
      parts.push('','**学生记录** ' + (state.entries[i]?.answer || '待补') + (state.entries[i]?.stuck ? '（有卡点）' : ''));
    });
    parts.push('','作答记录，供对照参考答案或交老师复核。');
    const url = URL.createObjectURL(new Blob([parts.join('\n')],{type:'text/markdown;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = state.preparedId + '-解题记录.md';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }

  root.oninput = event => {
    const {name,value} = event.target;
    if (name?.startsWith('domain-') && state.vseprExercise) {
      (state.vseprCounts ||= {})[name.slice(7)] = Number(value);
    }
    if (name === 'vsepr-choice') state.vseprChoice = value;
    if (['answer','supplemental','condition'].includes(name)) state[name] = value;
  };
  root.onsubmit = event => {
    event.preventDefault();
    if (event.target.dataset.questionForm === 'step') advance(false);
  };
  root.onclick = event => {
    const action = event.target.closest('[data-question-action]')?.dataset.questionAction;
    if (action === 'stuck') {
      if (!state.plan.hints) return advance(true);
      state.hintStep = state.index;
      state.hintText = state.plan.hints[state.index];
      return draw('.question-step-help p');
    }
    if (action === 'download') return download();
    if (action === 'practice-next') return state.practiceNext?.();
    if (action === 'skip') return advance(true);
    if (action === 'back') {
      state.index--;
      state.answer = state.entries[state.index]?.answer || '';
      state.notice = '';
      state.hintStep = null;
      state.showVseprComparison = false;
      return draw('#ownQuestionTitle');
    }
  };
  draw();
}

window.ChemQuestionSop = {analyze,mount};
})();
