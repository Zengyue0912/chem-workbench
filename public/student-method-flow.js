(function () {
'use strict';

const {methods, models, combinations, examModels, matchPrompt} = window.ChemMethodCatalog;
const lessonRoutes = window.ChemLessonRoutes;
const solveRoutes = window.ChemSolveRoutes;
const {topics, books, locations} = window.ChemStudyContent;
const catalog = {...models, ...combinations};
const escape = value => window.ChemStudio.escape(String(value ?? ''));
const name = id => catalog[id].name;
const entries = Object.keys(models);
const storageKey = 'chem-method-practice-v1';
const sessions = {lesson:new Map(), solve:new Map()};
const fields = ['输入','操作','输出','注意事项','完成标准'];

let activeId = 'titration-calc';
let directoryOpen = false, sopOpen = false, directoryGroup = 'single';
let filters = {}, term = '', storageFailed = false;
let saved = readSaved() || {};

function place(id) {
  const model = catalog[id];
  return model.place || {...locations[model.topic], point:topics[model.topic].name};
}

function setActive(id) {
  if (!Object.hasOwn(catalog, id)) return;
  activeId = id;
  filters = {...place(id), model:id};
  directoryGroup = combinations[id] ? 'combined' : 'single';
  directoryOpen = false;
  term = '';
}

setActive(activeId);

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function progress(id) {
  return (storageFailed ? saved : readSaved() || saved)[id] || {};
}

function saveAnswer(id, index, result) {
  const data = storageFailed ? saved : readSaved() || saved;
  const model = data[id] || {};
  model[index] = {first:model[index]?.first ?? result, latest:result};
  saved = {...data,[id]:model};
  try { localStorage.setItem(storageKey, JSON.stringify(saved)); storageFailed = false; }
  catch { storageFailed = true; }
}

function stateFor(mode) {
  const cache = sessions[mode];
  if (!cache.has(activeId)) {
    cache.set(activeId, mode === 'lesson' ? {step:0} : {phase:'identify', step:0, variant:0});
  }
  return cache.get(activeId);
}

function button(label, action, primary = false) {
  return `<button type="button" class="${primary ? 'btn-main' : 'btn-sub'}" data-method-action="${action}">${escape(label)}</button>`;
}

function choice(value, label, selected) {
  return `<option value="${escape(value)}"${String(value) === String(selected) ? ' selected' : ''}>${escape(label)}</option>`;
}

function catalogBrowser(mode) {
  const lesson = mode === 'lesson';
  const query = normalize(term);
  const found = query ? Object.keys(catalog).filter(id => {
    const {book, chapter, point, aliases = []} = place(id);
    const model = catalog[id];
    return [model.name, model.match, point, books[book].name, books[book].chapters[chapter], ...aliases]
      .some(value => normalize(value).includes(query));
  }) : [];
  const pickedBook = Object.keys(books).filter(id => entries.some(item => place(item).book === id));
  const inBook = entries.filter(id => place(id).book === filters.book);
  const chapters = [...new Set(inBook.map(id => place(id).chapter))].sort((a,b) => a-b);
  const inChapter = inBook.filter(id => place(id).chapter === filters.chapter);
  const points = [...new Set(inChapter.map(id => place(id).point))];
  const visible = inChapter.filter(id => place(id).point === filters.point);
  const single = `<form id="methodSelect" class="method-select">
    <div class="study-directory-selects">
      <label>册别<select name="book">${pickedBook.map(id => choice(id,books[id].name,filters.book)).join('')}</select></label>
      <label>章节<select name="chapter">${chapters.map(index => choice(index,books[filters.book].chapters[index],filters.chapter)).join('')}</select></label>
      <label>考点<select name="point">${points.map(point => choice(point,point,filters.point)).join('')}</select></label>
      <label>${lesson ? '学习内容' : '考法'}<select name="model">${visible.map(id => choice(id,name(id),filters.model)).join('')}</select></label>
    </div><button type="submit" class="btn-main">${lesson ? '开始学' : '打开考法'}</button>
  </form>`;
  const list = ids => `<div class="study-topic-list">${ids.map(id => {
    const record = lesson ? [] : Object.values(progress(id));
    const status = lesson && sessions.lesson.get(id)?.step === lessonRoutes[id].steps.length ? '本节已完成' :
      record.length ? `变式首答通过 ${record.filter(result => result?.first === true).length}/${catalog[id].variants.length}` : '';
    const {book, chapter, point} = place(id);
    const detail = combinations[id] ? combinations[id].parts.map(name).join(' → ') : `${books[book].chapters[chapter]} · ${point}`;
    return `<button type="button" class="study-topic" data-method-select="${id}" aria-pressed="${id === activeId}"><strong>${escape(name(id))}</strong>
      <span>${escape(detail)}</span>${status ? `<span>${status}</span>` : ''}</button>`;
  }).join('')}</div>`;
  return `<details class="study-sop method-catalog" ${directoryOpen ? 'open' : ''}>
    <summary>${lesson ? '选章节与学习内容' : '选择章节与考法'} <small>${entries.length} 个考法 · ${Object.keys(combinations).length} 组综合题</small></summary>
    <div class="study-sop-content">
      <form id="methodSearch" role="search" class="study-search-row"><label class="method-search-label" for="methodQuery">搜考点或考法</label>
        <input id="methodQuery" name="query" type="search" maxlength="80" value="${escape(term)}" placeholder="例如 滴定、盖斯定律、电子守恒">
        <button type="submit" class="btn-sub">搜索</button>${term ? button('清除搜索','clear') : ''}</form>
      ${term ? found.length ? list(found) : '<p class="study-note">没找到对应考法，试试更短的关键词。</p>' :
      `<div class="study-source-switch method-directory-switch">
        <button type="button" class="btn-sub" data-method-group="single" aria-pressed="${directoryGroup === 'single'}">单一考法</button>
        <button type="button" class="btn-sub" data-method-group="combined" aria-pressed="${directoryGroup === 'combined'}">综合题</button>
      </div>${directoryGroup === 'single' ? single : list(Object.keys(combinations))}`}
    </div></details>`;
}

const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

function casePanel(model) {
  const {title, stem, source} = model.example;
  return `<div class="study-case"><h3>${escape(title)}</h3>
    <p class="study-exam-source">${source ? `真题改编 · ${escape(source.label)} · <a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.link)}</a>` : '原创例题'}</p>
    <p>${escape(stem)}</p></div>`;
}

function modelChoices(id, offset = 0) {
  const options = [...new Set([id,activeId,...catalog[activeId].related,...catalog[id].related])].slice(0,3);
  const shift = (Object.keys(catalog).indexOf(id) + offset) % options.length;
  return options.slice(shift).concat(options.slice(0,shift));
}

function taskOptions(items, selected, label, action) {
  return `<div class="study-options method-options" role="group" aria-label="${escape(label)}">${items.map(({value,text}) =>
    `<button type="button" class="study-option" data-method-action="${action}" data-value="${escape(value)}" aria-pressed="${selected === value}">${escape(text)}</button>`).join('')}</div>`;
}

function stageHeader(mode, route, index) {
  const current = place(activeId);
  return `<section class="method-roadmap" aria-label="总控 SOP">
    <div class="method-roadmap-heading"><h2>${mode === 'lesson' ? '授课' : '解题'}总控 SOP</h2><span>${route.id}</span></div>
    <p class="method-breadcrumb">${escape(books[current.book].name)} <span aria-hidden="true">›</span> ${escape(books[current.book].chapters[current.chapter])} <span aria-hidden="true">›</span> ${escape(current.point)}</p>
    <p class="method-route-goal"><strong>${escape(name(activeId))}</strong><span>${escape(route.goal)}</span></p>
    <ol class="method-steps${mode === 'solve' ? ' method-solve-steps' : ''}" aria-label="技术路线与当前进度">${route.steps.map((step,i) =>
      `<li ${index === i ? 'aria-current="step"' : ''} class="${index > i ? 'is-done' : ''}"><span aria-hidden="true">${index > i ? '✓' : i+1}</span><div><strong>${escape(step.title)}</strong><small>${sopId(route,i)} · ${index > i ? '已完成' : index === i ? '进行中' : '待完成'}</small></div></li>`).join('')}</ol>
    ${sopPanel(route)}
  </section>`;
}

function identify(model, state, step) {
  const picked = state.identified;
  const correct = picked === activeId;
  const options = modelChoices(activeId).map(id => ({value:id,text:name(id)}));
  return `${casePanel(model)}<p class="method-prompt">${escape(step.action)} 这道题主要在考什么？</p>
    ${taskOptions(options,picked,'选择主考法','identify')}
    ${picked ? `<p class="study-result ${correct ? 'study-correct' : 'study-try'}" role="status"><strong>${correct ? '考法选对了' : '再看题目所求'}</strong> ${escape(correct ? model.match : '你选的考法适用于这类题。' + catalog[picked].match)}</p>` : ''}
    ${correct ? `<div class="study-actions">${button('进入主解法','start',true)}</div>` : ''}`;
}

function routeLabels(model) {
  return model.parts?.length ? `<p class="method-combo"><strong>组合路线</strong> ${model.parts.map(name).map(escape).join(' → ')}</p>` : '';
}

function lessonVideo(model) {
  const {topic} = model;
  const course = topics[topic];
  const asset = `assets/study-videos/${topic}`;
  return `<div class="method-video"><p class="study-note">相关微课 · ${escape(course.name)}</p><video controls playsinline preload="metadata" poster="${asset}.jpg" aria-label="${escape(course.name)}视频微课">
      <source src="${asset}.mp4" type="video/mp4"><track kind="captions" src="${asset}.vtt" srclang="zh-CN" label="简体中文">
      你的浏览器无法播放此视频。</video></div><details><summary>看微课的文字要点</summary><ul class="method-lesson-points">${course.concept.map(point => `<li>${escape(point)}</li>`).join('')}</ul></details>`;
}

function lessonTask(model, route, state) {
  const step = route.steps[state.step];
  if (!step) return ['本节已完成',lessonResult(model,route,state)];
  const task = step.question;
  const content = task ? lessonQuiz(step,state) : `<p class="method-prompt">${escape(step.action)}</p><p class="method-lesson-intro">${escape(step.output)}</p>`;
  const ready = !task || state.picked === task.correct;
  const media = step.video ? lessonVideo(model) : '';
  const label = state.step+1 === route.steps.length ? '完成本节' : '继续下一步';
  return [step.title,`${content}${ready ? `<div class="study-actions">${button(label,'lesson-next',true)}</div>` : ''}${media}`];
}

function lessonQuiz(step, state) {
  const task = step.question;
  const correct = state.picked === task.correct;
  return `<p class="study-note">${escape(step.input)}</p><p class="method-prompt">${escape(task.prompt)}</p>
    ${taskOptions(task.options.map((text,value) => ({text,value})),state.picked,task.prompt,'lesson-choice')}
    ${state.picked === undefined ? '' : `<p class="study-result ${correct ? 'study-correct' : 'study-try'}" role="status"><strong>${correct ? '答对了' : '再想想'}</strong> ${escape(correct ? task.explain : step.attention)}</p>`}`;
}

function solveLink(label, primary = false) {
  return `<button type="button" class="${primary ? 'btn-main' : 'btn-sub'}" data-study-action="method-other">${escape(label)}</button>`;
}

function lessonResult(model, route, state) {
  const last = route.steps.at(-1);
  return `<p class="study-result study-correct">${escape(last.question?.explain || last.output)}</p>
    <details><summary>看另一种做法</summary><p>${escape(model.alternative)}</p></details>
    <div class="study-actions">${solveLink(state.returnToSolve ? '回到刚才的解题步骤' : '去 AI 解题练这个考点',true)}
    ${button('换个考点','open-catalog')}${button('重学这节','reset')}</div>`;
}

function reviewLesson() {
  const returnToSolve = sessions.solve.get(activeId)?.phase === 'walk';
  sessions.lesson.set(activeId,{step:0,returnToSolve});
}

function lessonLink(label) {
  return `<button type="button" class="btn-sub" data-study-action="method-review-lesson">${escape(label)}</button>`;
}

function walk(model, state, step) {
  const task = model.steps[state.step];
  const method = methods[task.method];
  const correct = state.picked === task.correct;
  const followup = correct ? button(state.step+1 === model.steps.length ? '核对整套方法' : '继续下一步','next',true) :
    state.picked !== undefined ? lessonLink('去 AI 授课补这个考点') : '';
  return `<p class="study-kicker">主解法 · 第 ${state.step+1}/${model.steps.length} 步</p>
    ${routeLabels(model)}${casePanel(model)}
    <div class="method-action"><p class="method-prompt">${escape(task.prompt)}</p>
    <details><summary>给我一个方法提示</summary><p>${escape(step.attention)}</p><p>${escape(method.rule)}</p></details>
    ${taskOptions(task.options.map((text,value) => ({text,value})),state.picked,task.prompt,'move')}
    ${state.picked === undefined ? '' : `<p class="study-result ${correct ? 'study-correct' : 'study-try'}" role="status">${escape(correct ? task.explain : '再试一次。' + step.attention)}</p>`}
    ${followup ? `<div class="study-actions">${followup}</div>` : ''}</div>`;
}

function check(model, route, step) {
  return `<p class="method-prompt">${escape(step.action)}</p>${routeLabels(model)}
    <ol class="method-review">${model.steps.map((task,index) => `<li><strong>${escape(route.steps[index+1].title)}</strong><p>${escape(task.explain)}</p></li>`).join('')}</ol>
    <details><summary>看看备选解法和适用条件</summary><p>${escape(model.alternative)}</p></details>
    <div class="study-actions">${button('开始独立变式','practice',true)}</div>`;
}

function practice(model, state) {
  const task = model.variants[state.variant];
  if (!state.submitted) return `<p class="method-variant-stem">${escape(task.prompt)}</p>
    <form id="methodPractice" class="method-practice">
      <label>主要用哪种考法？<select name="type" required><option value="" selected disabled>请选择考法</option>
        ${modelChoices(task.model,state.variant+1).map(id => choice(id,name(id),'')).join('')}</select></label>
      <label>你的答案<select name="answer" required><option value="" selected disabled>请选择答案</option>
        ${task.options.map((option,index) => choice(index,option,'')).join('')}</select></label>
      <button type="submit" class="btn-main">交卷</button>
    </form>`;
  const {type, answer} = state.submitted;
  const rightType = type === task.model, rightAnswer = answer === task.correct;
  const both = rightType && rightAnswer;
  return `<p class="method-variant-stem">${escape(task.prompt)}</p><div class="study-result ${both ? 'study-correct' : 'study-try'}" role="status">
    <p><strong>考法${rightType ? '正确' : '需订正'}</strong> ${escape(name(task.model))}。${escape(catalog[task.model].match)}</p>
    <p><strong>答案${rightAnswer ? '正确' : '需订正'}</strong> ${escape(task.options[task.correct])}。${escape(task.explain)}</p>
    </div><div class="study-actions">${both ? button(state.variant+1 === model.variants.length ? '查看本次结果' : '继续下一道变式','next-variant',true) : button('订正这道题','retry',true)}</div>`;
}

function score(model) {
  const data = progress(activeId);
  const first = model.variants.filter((_,index) => data[index]?.first === true).length;
  const latest = model.variants.filter((_,index) => data[index]?.latest === true).length;
  return {first, latest, total:model.variants.length};
}

function result(model) {
  const {first, latest} = score(model);
  return `<div class="method-result-summary"><p><strong>${first}/${model.variants.length}</strong><span>考法和答案首次都对</span></p>
    <p><strong>${latest}/${model.variants.length}</strong><span>当前已通过（含订正）</span></p></div>
    <div class="study-actions">${button('换个考法','open-catalog',true)}${button('再练一次','reset')}${lessonLink('去 AI 授课复习')}</div>`;
}

function solveStepIndex(model, state) {
  const review = model.steps.length+1;
  return {identify:0, walk:state.step+1, check:review, variant:review+1+state.variant, done:review+1+model.variants.length}[state.phase];
}

function sopId(route, index) {
  return `${route.id}.${index+1}`;
}

function sopFields(values) {
  return `<dl>${values.map((value,index) => `<dt>${fields[index]}</dt><dd>${escape(value)}</dd>`).join('')}</dl>`;
}

function sopValues(step, input = step.input, output = step.output) {
  return [input,step.action,output,step.attention,step.criteria];
}

function sopPanel(route) {
  return `<details class="method-sop" ${sopOpen ? 'open' : ''}><summary>查看各步的 SOP 要求</summary>
    <div class="method-sop-overview">${route.steps.map((step,index) =>
      `<section class="study-sop-detail"><h3>${sopId(route,index)} · ${escape(step.title)}</h3>${sopFields(sopValues(step))}</section>`).join('')}</div></details>`;
}

function sopCard(id, title, values, done = false) {
  return `<aside class="study-card method-live-sop" aria-label="本步 SOP"><p class="study-kicker">${done ? '完成记录' : '本步 SOP'} <span>${id}</span></p>
    <h2>${escape(title)}</h2>${sopFields(values)}</aside>`;
}

function confirmedLessonOutput(step) {
  return step.question ? step.question.options[step.question.correct] : step.output;
}

function liveLessonSop(route, state) {
  const step = route.steps[state.step];
  if (!step) return sopCard(route.id,'本节完成',[
    `「${name(activeId)}」的 ${route.steps.length} 个子步骤。`,'核对各步的结果与最后的结论。',
    confirmedLessonOutput(route.steps.at(-1)),'在实际题目里核对条件是否相同。','已完成全部步骤，可以进入 AI 解题。'
  ],true);
  const previous = route.steps[state.step-1];
  const input = previous ? `${step.input} 上一步结果：${confirmedLessonOutput(previous)}` : step.input;
  const output = step.question && state.picked !== step.question.correct ? `待确认：${step.output}` : confirmedLessonOutput(step);
  return sopCard(sopId(route,state.step),step.title,sopValues(step,input,output));
}

function downloadSop(mode) {
  const lesson = mode === 'lesson';
  const route = (lesson ? lessonRoutes : solveRoutes)[activeId];
  const {book,chapter,point} = place(activeId);
  const lines = [`# ${name(activeId)} · ${lesson ? '授课' : '解题'}总控 SOP`, '', `**编号** ${route.id}`,
    `**教材位置** ${books[book].name} › ${books[book].chapters[chapter]} › ${point}`, `**目标** ${route.goal}`, '',
    '## 技术路线', '', route.steps.map(step => step.title).join(' → '), ''];
  route.steps.forEach((step,index) => {
    lines.push(`## ${sopId(route,index)} · ${step.title}`,'',
      ...sopValues(step).map((value,i) => `- **${fields[i]}** ${value}`));
    lines.push('');
  });
  const url = URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${route.id}-${name(activeId)}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

function liveSolveSop(model, route, index, state) {
  const step = route.steps[index];
  if (!step) {
    const {first,latest,total} = score(model);
    return sopCard(route.id,'流程验收',[
      `「${model.name}」的例题与 ${total} 道变式。`,'核对首答与订正后的结果。',
      `首答通过 ${first}/${total}，当前通过 ${latest}/${total}。`,'重练时保留第一次作答结果。',
      `例题各步已核对，变式通过 ${latest}/${total}。`
    ],true);
  }
  let input = step.input, output = step.output;
  if (state.phase === 'identify') {
    output = state.identified === activeId ? model.name : `待确认主考法 · ${step.output}`;
  } else if (state.phase === 'walk') {
    const task = model.steps[state.step];
    const previous = model.steps[state.step-1];
    const confirmed = previous?.options[previous.correct];
    if (confirmed && !input.includes(confirmed)) input += `。上一步已确认 ${confirmed}。`;
    output = state.picked === task.correct ? task.options[task.correct] : `待提交本步结果 · ${step.output}`;
  } else if (state.phase === 'variant') {
    const task = model.variants[state.variant];
    const answer = state.submitted;
    output = answer ? `考法${answer.type === task.model ? '正确' : '需订正'}，答案${answer.answer === task.correct ? '正确' : '需订正'}。` : `待提交考法和答案 · ${step.output}`;
  }
  return sopCard(sopId(route,index),step.title,sopValues(step,input,output));
}

function mount(root, mode) {
  function draw(focus = '') {
    const model = catalog[activeId], state = stateFor(mode);
    const lesson = mode === 'lesson';
    const route = (lesson ? lessonRoutes : solveRoutes)[activeId];
    const index = lesson ? state.step : solveStepIndex(model,state);
    const step = route.steps[index];
    const [title, body] = lesson ? lessonTask(model,route,state) : [step?.title || '本次练习结果',{
      identify:() => identify(model,state,step),
      walk:() => walk(model,state,step),
      check:() => check(model,route,step),
      variant:() => practice(model,state),
      done:() => result(model)
    }[state.phase]()];
    const aside = lesson ? liveLessonSop(route,state) : liveSolveSop(model,route,index,state);
    const back = lesson && state.returnToSolve && step ? `<div class="study-actions">${solveLink('回到刚才的解题步骤')}</div>` : '';
    root.innerHTML = `${catalogBrowser(mode)}${stageHeader(mode,route,index)}<div class="method-stage-grid">
      <section class="study-card method-card"><h2 id="methodTaskTitle" tabindex="-1">${escape(title)}</h2>${body}
      ${back}
      ${storageFailed ? '<p class="study-note" role="status">浏览器暂时无法保存练习记录。</p>' : ''}</section>${aside}</div>`;
    const browser = root.querySelector('.method-catalog');
    browser.ontoggle = () => { if (browser.isConnected) directoryOpen = browser.open; };
    const flow = root.querySelector('.method-sop');
    flow.ontoggle = () => { if (flow.isConnected) sopOpen = flow.open; };
    if (focus) root.querySelector(focus)?.focus();
  }

  root.onchange = event => {
    const field = event.target;
    if (field.form?.id !== 'methodSelect') return;
    if (field.name === 'model') { filters.model = field.value; return; }
    const id = entries.find(id => {
      const target = place(id);
      if (field.name === 'book') return target.book === field.value;
      if (target.book !== filters.book) return false;
      if (field.name === 'chapter') return target.chapter === Number(field.value);
      return target.chapter === filters.chapter && target.point === field.value;
    });
    if (!id) return;
    filters = {...place(id), model:id};
    draw(`select[name="${field.name}"]`);
  };

  root.onsubmit = event => {
    const {id} = event.target;
    if (!['methodSelect','methodSearch','methodPractice'].includes(id)) return;
    event.preventDefault();
    const data = new FormData(event.target);
    if (id === 'methodSearch') {
      term = data.get('query').trim();
      return draw('#methodQuery');
    }
    if (id === 'methodSelect') setActive(data.get('model'));
    if (id === 'methodPractice') {
      const state = stateFor(mode);
      if (state.phase !== 'variant' || state.submitted || !event.target.checkValidity()) return;
      const {model, correct} = catalog[activeId].variants[state.variant];
      state.submitted = {type:data.get('type'), answer:Number(data.get('answer'))};
      saveAnswer(activeId,state.variant,state.submitted.type === model && state.submitted.answer === correct);
    }
    draw('#methodTaskTitle');
  };

  root.onclick = event => {
    const control = event.target.closest('[data-method-action],[data-method-select],[data-method-group]');
    if (!control) return;
    const {methodAction:action, methodSelect:id, methodGroup:group, value} = control.dataset;
    if (id) { setActive(id); return draw('#methodTaskTitle'); }
    if (group) { directoryGroup = group; return draw(`[data-method-group="${group}"]`); }
    const state = stateFor(mode), model = catalog[activeId];
    const lessonStep = mode === 'lesson' ? lessonRoutes[activeId].steps[state.step] : null;
    const actions = {
      clear:() => { term = ''; return '#methodQuery'; },
      'open-catalog':() => { directoryOpen = true; return '.method-catalog summary'; },
      reset:() => { sessions[mode].delete(activeId); },
      'lesson-choice':() => {
        const task = lessonStep?.question;
        const selected = Number(value);
        if (!task?.options[selected]) return;
        state.picked = selected;
        return selected === task.correct ? '[data-method-action="lesson-next"]' : '[aria-pressed="true"][data-method-action="lesson-choice"]';
      },
      'lesson-next':() => {
        if (!lessonStep || (lessonStep.question && state.picked !== lessonStep.question.correct)) return;
        state.step++;
        state.picked = undefined;
      },
      identify:() => { state.identified = value; return value === activeId ? '[data-method-action="start"]' : '[aria-pressed="true"][data-method-action="identify"]'; },
      start:() => { if (state.identified === activeId) state.phase = 'walk'; },
      move:() => {
        state.picked = Number(value);
        return state.picked === model.steps[state.step].correct ? '[data-method-action="next"]' : '[aria-pressed="true"][data-method-action="move"]';
      },
      next:() => {
        if (state.picked !== model.steps[state.step].correct) return;
        state.picked = undefined;
        if (++state.step === model.steps.length) state.phase = 'check';
      },
      practice:() => { state.phase = 'variant'; },
      retry:() => { state.submitted = undefined; },
      'next-variant':() => {
        const task = model.variants[state.variant];
        if (state.submitted?.type !== task.model || state.submitted?.answer !== task.correct) return;
        state.submitted = undefined;
        if (++state.variant === model.variants.length) state.phase = 'done';
      }
    };
    if (Object.hasOwn(actions,action)) draw(actions[action]() || '#methodTaskTitle');
  };

  draw();
}

function examTag(topic, part) {
  const [primary,...secondary] = examModels[topic][part];
  return `<div class="method-exam-tag"><p><strong>题型 SOP ${solveRoutes[primary].id}</strong> · ${escape(name(primary))}${secondary.length ? ` <span>· 还用到 ${secondary.map(name).map(escape).join('、')}</span>` : ''}</p>
    <button type="button" class="btn-sub" data-study-action="method-from-exam" data-method-id="${primary}">打开这类题的 SOP</button></div>`;
}

function suggestions(question) {
  const matches = matchPrompt(question);
  if (!matches.length) return '';
  return `<div class="method-exam-tag"><strong>可参考的考法，按题目所求核对</strong>
    ${matches.map(id => `<button type="button" class="btn-sub" data-study-action="method-from-exam" data-method-id="${id}">${solveRoutes[id].id} · ${escape(name(id))} · 看同类题 SOP</button>`).join('')}</div>`;
}

window.ChemMethodStudy = {mount, setActive, examTag, suggestions, reviewLesson, downloadSop};
})();
