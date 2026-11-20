(function () {
'use strict';

const {topics, books, locations, findTopics, reviewDelay, grade} = window.ChemStudyContent;
let exams = window.ChemStudyExams;
let methodStudy = window.ChemMethodStudy;
let titrationSop = window.ChemTitrationSop;
let questionSop = window.ChemQuestionSop;
let preparedSop = window.ChemPreparedSop;
let ionicSop = window.ChemIonicSop;
const $ = id => document.getElementById(id);
const escape = text => window.ChemStudio.escape(String(text ?? ''));
const keys = Object.keys(topics);
const titles = {lesson:'AI 授课', solve:'AI 解题'};
const sopFiles = {lesson:'AI授课-SOP.md', solve:'AI解题-SOP.md'};
const storeKey = 'chem-student-study-v1';
const newDraft = () => ({
  source:'example', question:'', thought:'', step:0, choice:null, clue:false, checked:false,
  practiceResult:null, titration:null, questionSop:null, ionic:null,
  questionReading:null, prepared:null, practiceNext:null,
  image:null, imageNotice:'', imageText:null, imageBase:''
});
let storageFailed = false;
let mode = 'lesson', topicId = keys[0], progress = readProgress(), draft = newDraft();
let route = 'methods';
let ionicReview = null;
let selectedBook = locations[topicId].book, selectedChapter = '', searchTerm = '';
let lessonReplay = '', transferOpen = false, returnFromScene = null, modelReady = false;
let directoryOpen = false;
let allExamTopics = false;
let guidance = '', request = null;
const videoPositions = new Map();
const sopOpen = {lesson:false, solve:false};
const sopSelection = {lesson:null, solve:null};
let vsepr = window.ChemVseprStudy;
/* 工作流 1：SOP/真题等模块改为按需懒加载，以下命名空间在入口处加载完成后重新解析 */
function refreshLazyModules(){
  exams=window.ChemStudyExams;methodStudy=window.ChemMethodStudy;
  titrationSop=window.ChemTitrationSop;questionSop=window.ChemQuestionSop;
  preparedSop=window.ChemPreparedSop;ionicSop=window.ChemIonicSop;vsepr=window.ChemVseprStudy;
}

function readProgress() {
  if (storageFailed) return progress;
  try { return JSON.parse(localStorage.getItem(storeKey)) || {}; }
  catch { return {}; }
}

function updateProgress(topic) {
  const latest = {...readProgress(), [topicId]:topic};
  progress = latest;
  try { localStorage.setItem(storeKey, JSON.stringify(latest)); storageFailed = false; }
  catch { storageFailed = true; }
}

function record(stage, choice) {
  const topic = {...readProgress()[topicId]};
  const kind = questionKind(topic, stage);
  const question = studyQuestion(topics[topicId], topic, stage);
  const field = recordField(stage);
  const previous = questionResult(topic, stage);
  const now = Date.now();
  const first = stage === 'practice' ? draft.practiceResult?.first : previous?.first;
  const result = {choice, first:first ?? choice, at:now, kind};
  if (question.source) result.examId = question.source.id;
  topic[field] = result;
  if (stage === 'practice') draft.practiceResult = result;
  if ((stage === 'transfer' || stage === 'practice') && grade(question, choice).correct) {
    topic.reviewAt ??= now + reviewDelay;
  }
  updateProgress(topic);
}

function markVideo(method) {
  const previous = readProgress()[topicId] || {};
  if (!previous.video || (method === 'ended' && previous.video.method !== 'ended')) {
    updateProgress({...previous, video:{method, at:Date.now()}});
  }
}

function button(label, action, css = 'btn-sub') {
  return `<button type="button" class="${css}" data-study-action="${action}">${label}</button>`;
}

function card(label, heading, body, id = '') {
  return `<section class="study-card" ${id ? 'id="' + id + '"' : ''}><p class="study-kicker">${label}</p><h2>${heading}</h2>${body}</section>`;
}

function questionKind(topicProgress, stage) {
  if (stage !== 'transfer') return stage;
  if (topicProgress?.transfer) return topicProgress.transfer.kind || stage;
  const first = topicProgress?.diagnostic?.first;
  return first !== undefined && !grade(topics[topicId].diagnostic, first).correct ? 'repair' : stage;
}

function recordField(stage) {
  if (stage === 'practice') return 'examPractice';
  return mode === 'solve' && stage === 'recall' ? 'examRecall' : stage;
}

function studyQuestion(topic, topicProgress, stage) {
  return stage === 'practice' || (mode === 'solve' && stage === 'recall')
    ? exams[topicId][stage] : topic[questionKind(topicProgress, stage)];
}

function questionResult(saved, stage) {
  if (stage === 'practice') return draft.practiceResult;
  const result = saved?.[recordField(stage)];
  if (mode === 'solve' && stage === 'recall' && result?.examId !== exams[topicId].recall.source.id) return undefined;
  return result;
}

function examSource(source) {
  return `<p class="study-exam-source">${escape(source.label)} · 真题改编
    <a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.link)} ↗</a></p>`;
}

function quiz(topic, stage, title, description) {
  const topicProgress = progress[topicId];
  const question = studyQuestion(topic, topicProgress, stage);
  const result = questionResult(topicProgress, stage);
  const feedback = result && grade(question, result.choice);
  const options = question.options.map((option, choice) =>
    `<button type="button" class="study-option" data-study-stage="${stage}" data-choice="${choice}" aria-pressed="${result?.choice === choice}">${escape(option)}</button>`
  ).join('');
  const note = feedback ? `<p class="study-result ${feedback.correct ? 'study-correct' : ''}" role="status"><strong>${feedback.correct ? '答对了' : '再想一步'}</strong> ${escape(feedback.feedback)}${stage === 'diagnostic' ? '' : `<br>首次作答：${grade(question, result.first).correct ? '正确' : '待巩固'}`}</p>` : '';
  const tag = feedback && question.source ? methodStudy.examTag(topicId, stage) : '';
  return card(description, title, `${question.source ? examSource(question.source) : ''}<p>${escape(question.prompt)}</p><div class="study-options">${options}</div>${note}${tag}`, 'study-' + stage);
}

function evidence() {
  const trial = progress[topicId]?.experiment;
  return trial ? `<p class="study-result"><strong>本次实验记录</strong>　初读数 ${trial.initial.toFixed(2)} mL，末读数 ${trial.final.toFixed(2)} mL，差值 ${trial.used.toFixed(2)} mL。<br>终点判断：${escape(trial.status)}。想一想，计算时应代入哪个体积？</p>` : '';
}

function review(topic) {
  const result = progress[topicId];
  if (!result?.reviewAt) return '';
  if (result.reviewAt <= Date.now()) {
    return quiz(topic, 'recall', '隔天再做一道', '独立复习');
  }
  const when = new Date(result.reviewAt).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
  return card('隔天复习', '下次用一道新题再检验', `<p>完成时间满 24 小时后开放。这次可在 ${escape(when)} 以后回来。</p>`, 'study-review-wait');
}

function passed(topic, saved, stage) {
  const result = questionResult(saved, stage);
  return !!result && grade(studyQuestion(topic, saved, stage), result.choice).correct;
}

function modelPanel() {
  return `<div class="study-model"><p class="study-note">只有点击发送才会传输当前问题和思路。请删去姓名、学校等信息。</p>
    ${button(request ? '正在请求模型…' : mode === 'lesson' ? '让 AI 换个说法' : '发送给 AI，请给一个提示', 'model')}
    ${guidance ? `<p class="study-result study-model-output" role="status">${escape(guidance)}</p>` : ''}</div>`;
}

function lessonVideo(topic) {
  const rules = topic.concept.map(point => `<li>${escape(point)}</li>`).join('');
  const asset = 'assets/study-videos/' + topicId;
  return `<section class="study-video-card" aria-label="视频微课">
    <div class="study-video-frame"><video id="studyVideo" data-topic="${topicId}" controls playsinline preload="metadata"
      src="${asset}.mp4" poster="${asset}.jpg" aria-label="${escape(topic.name)}视频微课">
      <track kind="captions" src="${asset}.vtt" srclang="zh-CN" label="简体中文">你的浏览器无法播放此视频。</video></div>
    <div class="study-video-footer"><div><p class="study-kicker">AI 中文配音 · 动画演示</p><h2>${escape(topic.name)}</h2></div>
      <div class="study-actions">${lessonReplay === 'solve' ? button('回去继续解题', 'to-solve', 'btn-main')
        : lessonReplay ? button('返回当前任务', 'lesson-resume', 'btn-main')
        : button('看完了，试一题', 'diagnostic', 'btn-main')}${button(escape(topic.scene.label), 'scene')}</div></div>
    <div class="study-video-notes">${evidence()}
      <details><summary>查看视频要点</summary><ol>${rules}</ol><p>${escape(topic.demo)}</p></details>
      <p id="studyVideoError" class="study-note" role="status" hidden>视频没有加载成功。可以重试播放，或先看视频要点。</p>
    </div></section>`;
}

function lessonStage(saved) {
  if (!saved.video && !saved.diagnostic) return 'video';
  if (!saved.diagnostic) return 'diagnostic';
  if (!transferOpen && !saved.transfer) return 'explain';
  return passed(topics[topicId], saved, 'transfer') ? 'complete' : 'transfer';
}

function lesson(topic) {
  const saved = progress[topicId] || {};
  const stage = lessonStage(saved);
  if (lessonReplay || stage === 'video') return lessonVideo(topic);
  const replay = `<div class="study-actions">${button('回看微课', 'lesson-replay')}</div>`;
  if (stage === 'diagnostic') return quiz(topic, 'diagnostic', '先试这一题', '用刚才的规则判断') + replay;
  if (stage === 'explain') {
    const first = grade(topic.diagnostic, saved.diagnostic.first);
    return card(first.correct ? '首答正确' : '先补这一点', first.correct ? '这一步会了' : '找到了这题卡住的地方',
      `<p class="study-result ${first.correct ? 'study-correct' : 'study-try'}">${escape(first.feedback)}</p>
      ${first.correct ? '' : `<p>${escape(topic.concept[0])}</p>`}
      <div class="study-actions">${button(first.correct ? '继续，试一道应用题' : '明白了，换道题试试', 'transfer', 'btn-main')}${button(escape(topic.scene.label), 'scene')}</div>
      ${evidence()}<div id="studyModelControls">${modelReady ? modelPanel() : ''}</div>`, 'study-explain') + replay;
  }
  if (stage === 'transfer') {
    return quiz(topic, 'transfer', '独立做一道新题', '换题验证') + replay +
      (saved.transfer ? `<div class="study-actions">${button('带着这个专题去 AI 解题', 'to-solve')}</div>` : '');
  }
  const feedback = grade(topic[questionKind(saved, 'transfer')], saved.transfer.choice).feedback;
  return card('本次微课完成', '换题验证通过', `<p>${escape(feedback)}</p>${evidence()}`, 'study-complete') + review(topic) + replay;
}

function solvePractice(topic) {
  const done = passed(topic, progress[topicId] || {}, 'practice');
  const actions = `<div class="study-actions">${button('看本专题视频', 'to-lesson')}
    ${done ? button('重走例题','restart') : ''}</div>`;
  if (!done) return quiz(topic, 'practice', '换一道真题，自己做', '独立复测') + actions;
  const {practice} = exams[topicId];
  const result = grade(practice, draft.practiceResult.choice);
  return card('本次解题完成', '同类题通过', `${examSource(practice.source)}<p>${escape(result.feedback)}</p>${methodStudy.examTag(topicId,'practice')}${actions}`, 'study-complete') + review(topic);
}

function guidedSolver(topic, {example, moves}) {
  const total = moves.length;
  if (draft.step === total) {
    if (draft.checked) return solvePractice(topic);
    return card('三步完成', '核对这道真题', `${examSource(example.source)}<p>${escape(example.stem)}</p>
      <p class="study-result">${escape(example.worked)}</p><p class="study-note">对照刚才三步，检查条件、列式和单位。</p>
      ${methodStudy.examTag(topicId,'example')}
      <div class="study-actions">${button('核对完，做新题', 'check-example', 'btn-main')}${button('看本专题视频', 'to-lesson')}</div>`, 'study-worked');
  }
  const move = moves[draft.step];
  const result = draft.choice === null ? null : grade(move, draft.choice);
  const steps = moves.map((_, index) => `<span class="study-step ${index < draft.step ? 'is-done' : index === draft.step ? 'is-current' : ''}">${index < draft.step ? '✓' : index + 1}</span>`).join('');
  const options = move.options.map((option, index) => `<button type="button" class="study-option"
    data-study-move="${index}" aria-pressed="${draft.choice === index}" ${result?.correct ? 'disabled' : ''}><b>${'ABC'[index]}</b><span>${escape(option)}</span></button>`).join('');
  return `<article class="study-case" id="study-example"><p class="study-kicker">${escape(topic.type)} · 分步带做</p>
    <h2>${escape(example.title)}</h2>${examSource(example.source)}<p>${escape(example.stem)}</p></article>`
    + methodStudy.examTag(topicId,'example')
    + card('第 ' + (draft.step + 1) + ' 步，共 ' + total + ' 步', escape(move.prompt),
      `<div class="study-step-row" aria-hidden="true">${steps}</div><div class="study-move-options">${options}</div>
      ${result ? `<p class="study-result ${result.correct ? 'study-correct' : 'study-try'}" role="status"><strong>${result.correct ? '这一步对了' : '再试一下'}</strong>　${escape(result.feedback)}</p>` : ''}
      ${draft.clue && !result?.correct ? `<p class="study-note">${escape(example.hints[draft.step])}</p>` : ''}
      <div class="study-actions">${result?.correct ? button(draft.step + 1 === total ? '核对例题' : '下一步', 'next-move', 'btn-main') : button('给个线索', 'clue')}
      ${button('看本专题视频', 'to-lesson')}</div>`, 'study-move');
}

function customInput() {
  return card('第 1 步', '先把题目放进来', `
    <label class="study-field">题目文字<textarea id="studyQuestion" aria-describedby="studyImageHelp" rows="3" maxlength="2000" placeholder="粘贴题干，或按 Ctrl+V 粘贴截图">${escape(draft.question)}</textarea></label>
    <div id="studyImagePanel" class="study-image-panel">${imagePanel()}</div>
    <p class="study-note">「分步解题」会一步一步算给你看，每步都能问为什么；「拍照解题」拍题自动识别。</p>
    <div class="study-actions"><button type="button" class="btn-main" data-study-action="solve-step" ${draft.image?.controller ? 'disabled' : ''}>分步解题</button>
      <button type="button" class="btn-sub" data-study-action="solve-photo">拍照解题</button>
      <button type="button" class="btn-sub" data-study-action="start-custom" ${draft.image?.controller ? 'disabled' : ''}>只看解题步骤</button>
      ${vsepr.practicePending() ? button('继续做构型变式','review-vsepr') : ''}</div>`, 'study-custom-input');
}

function readingCard(reading) {
  if (!reading) return '';
  const fields = [['题型','type'],['考点','topic'],['这次怎么考','method'],['先看哪里','firstLook']];
  const clues = reading.clues?.length ? '<p class="study-note"><strong>匹配线索</strong> ' +
    reading.clues.map(clue => '<mark>' + escape(clue) + '</mark>').join(' · ') + '</p>' : '';
  const evidence = reading.evidence
    ? `<dl><div><dt>这问要写什么</dt><dd>${escape(reading.evidence.request)}</dd></div>
        <div><dt>决定解法的条件</dt><dd>${escape(reading.evidence.condition)}</dd></div>
        <div><dt>建议解法</dt><dd>先判断用量，再定产物和离子方程式。</dd></div></dl>`
    : `<dl>${fields.map(([label,key]) => `<div><dt>${label}</dt><dd>${escape(reading[key])}</dd></div>`).join('')}</dl>${clues}`;
  return `<section class="study-card question-reading" aria-label="这题怎么考"><h2>这题怎么考</h2>
    ${evidence}
    ${reading.correction ? `<p class="study-note">题目里的 <strong>${escape(reading.correction.from)}</strong> 可能是 <strong>VSEPR</strong>。${draft.image ? '可以展开原图核对。' : '可以点「修改原题」核对。'}
      ${button('改为 VSEPR','correct-vsepr')}</p>` : ''}</section>`;
}

function highlightEvidence(question,evidence) {
  if (!evidence) return escape(question);
  const spans = [evidence.condition,evidence.request]
    .map(phrase => ({phrase,at:question.indexOf(phrase)}))
    .filter(({at}) => at >= 0).sort((left,right) => left.at - right.at);
  let output = '', offset = 0;
  for (const {phrase,at} of spans) {
    if (at < offset) continue;
    output += escape(question.slice(offset,at)) + '<mark>' + escape(phrase) + '</mark>';
    offset = at + phrase.length;
  }
  return output + escape(question.slice(offset));
}

function sourceImage() {
  return draft.image ? `<details class="study-image-source"><summary>查看原题截图</summary>
    <a href="${escape(draft.image.url)}" target="_blank" rel="noopener noreferrer" aria-label="在新标签页查看原题截图"><img src="${escape(draft.image.url)}" alt="原题截图"></a></details>` : '';
}

function imagePanel() {
  const image = draft.image;
  return `<div class="study-image-tools">
    <input id="studyImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" hidden>
    ${button(image ? '换一张图' : '选择题目图片', 'pick-image')}
    <small id="studyImageHelp">也可以点题目框，按 Ctrl+V 粘贴截图。图片在本页识字。</small></div>
    ${image ? `<div class="study-image-preview">
      <a href="${escape(image.url)}" target="_blank" rel="noopener noreferrer" aria-label="在新标签页查看原题截图"><img src="${escape(image.url)}" alt="题目图片预览"></a>
      <div class="study-actions">${!image.controller && !image.recognized ? button('重新识别', 'retry-image') : ''}${button('移除图片', 'remove-image')}</div>
    </div>` : ''}
    <p id="studyImageStatus" class="study-note" role="status" aria-atomic="true">${escape(draft.imageNotice)}</p>`;
}

function refreshImagePanel() {
  const panel = $('studyImagePanel');
  if (!panel) return;
  const activeAction = panel.contains(document.activeElement) && document.activeElement.dataset.studyAction;
  panel.innerHTML = imagePanel();
  $('study-custom-input').querySelector('[data-study-action="solve-step"]').disabled = !!draft.image?.controller;
  $('study-custom-input').querySelector('[data-study-action="start-custom"]').disabled = !!draft.image?.controller;
  if (activeAction) (panel.querySelector('[data-study-action="' + activeAction + '"]') || $('studyQuestion'))?.focus();
}

function releaseImage() {
  const image = draft.image;
  if (!image) return;
  image.controller?.abort();
  URL.revokeObjectURL(image.url);
  draft.image = null;
}

async function recognizeImage() {
  const owner = draft, image = owner.image;
  if (!image || image.controller) return;
  const controller = new AbortController();
  image.controller = controller;
  owner.imageNotice = '正在识别题目图片…';
  refreshImagePanel();
  const stillCurrent = () => draft === owner && owner.image === image && !controller.signal.aborted;
  let lastProgress = 0;
  try {
    await window.ChemLazy.load('study');
    const {text, confidence} = await window.ChemQuestionOCR.recognize(image.file, {
      signal:controller.signal,
      onProgress(value) {
        const part = Math.floor(value * 10) * 10;
        if (!stillCurrent() || part <= lastProgress) return;
        lastProgress = part;
        owner.imageNotice = '正在识别题目图片… ' + part + '%';
        if ($('studyImageStatus')) $('studyImageStatus').textContent = owner.imageNotice;
      }
    });
    if (!stillCurrent()) return;
    if (text.replace(/\s/g, '').length < 4) throw new Error('这张图里没读到完整的文字，试试裁到题干附近，或直接输入题目。');
    const typed = owner.question.trim();
    if (typed.length >= 1999) {
      owner.imageNotice = '题目框已接近 2000 字上限。请删减文字后再点「重新识别」。';
      return;
    }
    owner.imageBase = owner.question;
    const combined = typed ? typed + '\n\n' + text : text;
    owner.question = combined.slice(0,2000);
    owner.imageText = owner.question;
    image.recognized = true;
    owner.imageNotice = (combined.length > 2000 ? '文字已填到 2000 字上限，请检查题干是否完整。' :
      confidence < 70 ? '有些字识别得不太准，请对照原图改一下。' : '文字已填入。确认化学式、上下标和单位后即可分析。') +
      ' 有图表的题，请补上用到的标注或数据。';
    if ($('studyQuestion')) $('studyQuestion').value = owner.question;
  } catch (error) {
    if (stillCurrent()) owner.imageNotice = error.message || '图片识别失败，请换张图再试。';
  } finally {
    if (image.controller === controller) image.controller = null;
    if (stillCurrent()) refreshImagePanel();
  }
}

function attachImage(file) {
  if (!file) return;
  if (!/^image\/(?:png|jpeg|webp|bmp)$/.test(file.type) || file.size > 10 * 1024 * 1024 || !file.size) {
    draft.imageNotice = '请选择 10 MB 以内的 PNG、JPG、WebP 或 BMP 图片。';
    refreshImagePanel();
    return;
  }
  releaseImage();
  if (draft.imageText !== null && draft.question === draft.imageText) {
    draft.question = draft.imageBase;
    if ($('studyQuestion')) $('studyQuestion').value = draft.question;
  }
  draft.imageText = null;
  draft.image = {file,url:URL.createObjectURL(file),controller:null,recognized:false};
  void recognizeImage();
}

function connectVideo(previous) {
  const placeholder = $('studyVideo');
  if (!placeholder) return;
  if (previous?.dataset.topic === topicId) placeholder.replaceWith(previous);
  const player = $('studyVideo');
  const showError = () => { if ($('studyVideo') === player) $('studyVideoError').hidden = false; };
  player.onerror = showError;
  player.onended = () => {
    if ($('studyVideo') !== player || mode !== 'lesson' || player.dataset.topic !== topicId) return;
    markVideo('ended');
    if (lessonReplay) refreshSop();
    else render('study-diagnostic');
  };
  if (player.error) showError();
  if (player !== previous && videoPositions.has(topicId)) {
    const time = videoPositions.get(topicId);
    player.addEventListener('loadedmetadata', () => { player.currentTime = Math.min(player.duration, time); }, {once:true});
  }
}

const compactSearch = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]|年/gu, '');

function matchingTopics() {
  if (searchTerm) {
    const matches = findTopics(searchTerm);
    if (mode !== 'solve') return matches;
    const term = compactSearch(searchTerm);
    const examMatches = term ? keys.filter(id => {
      const {example, practice, recall} = exams[id];
      return [example.title, example.stem, example.source.label, practice.source.label, recall.source.label]
        .some(text => compactSearch(text).includes(term));
    }) : [];
    return [...new Set([...matches, ...examMatches])];
  }
  if (mode === 'solve' && allExamTopics) return keys;
  return keys.filter(id => locations[id].book === selectedBook &&
    (selectedChapter === '' || locations[id].chapter === Number(selectedChapter)));
}

function selectTopic(id) {
  if (!id || topicId === id) return;
  topicId = id;
  lessonReplay = '';
  transferOpen = false;
  sopSelection.lesson = sopSelection.solve = null;
  resetDraft();
}

function reviewPending(id) {
  const saved = progress[id];
  return saved?.reviewAt <= Date.now() &&
    (mode === 'solve' ? saved.examRecall?.examId !== exams[id].recall.source.id : !saved.recall);
}

function directory(matches) {
  const book = books[selectedBook];
  const solve = mode === 'solve';
  const bookOptions = Object.entries(books).map(([id, entry]) =>
    `<option value="${id}" ${selectedBook === id ? 'selected' : ''}>${entry.name}</option>`).join('');
  const chapters = book.chapters.map((chapter, index) => {
    const count = keys.filter(id => locations[id].book === selectedBook && locations[id].chapter === index).length;
    return `<option value="${index}" ${selectedChapter === String(index) ? 'selected' : ''}>${chapter} · ${count ? count + ' 个知识点' : '待补充'}</option>`;
  }).join('');
  const cards = matches.map(id => {
    const place = locations[id];
    const {example, practice, recall} = exams[id];
    const term = compactSearch(searchTerm);
    const matchedSources = solve && term ? [['带做', example], ['复测', practice], ['复习', recall]]
      .filter(([, question]) => compactSearch(question.source.label).includes(term))
      .map(([stage, question]) => stage + ' · ' + question.source.label) : [];
    const label = solve ? matchedSources.join(' / ') || example.source.label : '视频微课';
    return `<button class="study-topic" type="button" data-study-topic="${id}" aria-pressed="${id === topicId}">
      <strong>${topics[id].name}</strong><span>${searchTerm || (solve && allExamTopics) ? books[place.book].name + ' · ' : ''}${books[place.book].chapters[place.chapter]}</span>
      <span>${escape(label)}${reviewPending(id) ? ' · 待复习' : ''}</span></button>`;
  }).join('');
  const empty = searchTerm ? '这个知识点目前没有对应内容。可以试试更短的词，比如「酯化」「容量瓶」「盐桥」。'
    : '这一章的微课和解题卡还在补充。可以换一章，或直接搜知识点。';
  return `<section class="study-directory" aria-label="教材目录与知识点搜索">
    <div class="study-directory-top"><p class="study-kicker">人教版高中化学 · 教材目录</p>
      <form id="studySearchForm" role="search">
        <label for="studySearch">${solve ? '搜知识点、年份或卷别' : '搜知识点'}</label><div class="study-search-row">
        <input id="studySearch" type="search" value="${escape(searchTerm)}" placeholder="${solve ? '例如 滴定、2025山东卷、北京卷' : '例如 气泡、稀释、官能团'}" maxlength="100">
        <button type="submit" class="btn-main">搜索</button>${searchTerm ? button('回教材目录', 'clear-search') : ''}</div>
      </form>
      ${solve && !searchTerm ? `<div class="study-actions">${button(allExamTopics ? '回教材筛选' : '查看全部真题专题', 'toggle-exam-list')}</div>` : ''}
      ${searchTerm ? '' : `<div class="study-directory-selects">
        <label>册别<select id="studyBook">${bookOptions}</select></label>
        <label>章节<select id="studyChapter"><option value="">本册已上线知识点</option>${chapters}</select></label></div>`}
    </div>
    <div id="study-topic-result" class="study-directory-result">
      <h2>${searchTerm ? '「' + escape(searchTerm) + '」找到 ' + matches.length + ' 项' : solve && allExamTopics ? '全部 ' + keys.length + ' 个真题专题' : '本目录下的知识点'}</h2>
      ${matches.length ? `<div class="study-topic-list">${cards}</div>` : `<p class="study-note" role="status">${empty}</p>`}
    </div></section>`;
}

function sopProgress(hasTopic) {
  const todo = '待完成', done = '已完成';
  if (!hasTopic) return {next:0, states:['待选专题', todo, todo, todo, todo, todo]};
  const saved = progress[topicId] || {};
  const topic = topics[topicId];
  const result = stage => passed(topic, saved, stage) ? done : questionResult(saved, stage) ? '待订正' : todo;
  const recall = saved.reviewAt > Date.now() ? '等开放' : result('recall');
  if (mode === 'lesson') {
    const next = {video:1, diagnostic:2, explain:2, transfer:4, complete:5}[lessonStage(saved)];
    return {next, states:[
      done, saved.video ? (saved.video.method === 'ended' ? '已播放完' : '已确认') : todo,
      saved.diagnostic ? '已试答' : todo, saved.experiment ? '已带回测量' : saved.observedAt ? '已返回' : '可选',
      result('transfer'), recall
    ]};
  }
  const total = exams[topicId].moves.length;
  const finished = draft.step === total;
  const picked = draft.choice !== null;
  const practice = passed(topic, saved, 'practice');
  const next = !finished ? (picked ? 2 : 1) : !draft.checked ? 3 : !practice ? 4 : 5;
  return {next, states:[
    done, finished ? done : picked ? '已作答' : todo,
    finished ? done : picked ? '已显示反馈' : todo,
    draft.checked ? done : todo,
    result('practice'), recall
  ]};
}

function sopLink(index, hasTopic) {
  const saved = progress[topicId] || {};
  const action = (label, command) => button(label, command);
  const target = id => `<button type="button" class="btn-sub" data-study-sop-target="${id}">前往这一步</button>`;
  if (index === 0 && (!hasTopic || mode === 'lesson')) return target('study-topic-result');
  if (!hasTopic) return '';
  if (mode === 'lesson' && index === 1) return lessonStage(saved) === 'video' ? target('studyVideo') : action('回看微课', 'lesson-replay');
  if (mode === 'lesson' && index === 3) return action('去观察', 'scene');
  const {next} = sopProgress(hasTopic);
  if (index !== next) return '';
  if (index === 5) return target(saved.reviewAt > Date.now() ? 'study-review-wait' : 'study-recall');
  if (mode === 'lesson') return target(index === 2
    ? lessonStage(saved) === 'explain' ? 'study-explain' : 'study-diagnostic'
    : 'study-transfer');
  return target(['study-topic-result','study-move','study-move','study-worked','study-practice'][index]);
}

function sopContent(hasTopic) {
  const {steps, input, output, rule} = window.ChemStudySop[mode];
  const {next, states} = sopProgress(hasTopic);
  const selected = sopSelection[mode] ?? next;
  const item = steps[selected];
  return `<p class="study-note">${rule}</p><p class="study-note">输入 · ${input}<br>输出 · ${output}</p>
    <div class="study-sop-steps" aria-label="子 SOP">${steps.map(({id, title}, index) =>
      `<button type="button" class="btn-sub" data-study-sop-step="${index}" aria-pressed="${index === selected}">
        <small>${id}</small><strong>${title}</strong><small>${states[index]}</small></button>`
    ).join('')}</div><div class="study-sop-detail"><h2>${item.id} · ${item.title}</h2><dl>
      ${[['输入', item.input], ['操作', item.action], ['输出', item.output], ['注意事项', item.attention], ['完成标准', item.criteria]]
        .map(([name, text]) => `<dt>${name}</dt><dd>${text}</dd>`).join('')}
    </dl>${sopLink(selected, hasTopic)}</div>`;
}

function sopSummary(hasTopic) {
  const {id, title, steps} = window.ChemStudySop[mode];
  const {next, states} = sopProgress(hasTopic);
  return `${id} · ${title} SOP <small>${next === 5 && states[next] === '已完成' ? '复习已完成' : '当前步骤 · ' + steps[next].title}${states[next] === '等开放' ? '（等开放）' : ''}</small>`;
}

function refreshSop(hasTopic = matchingTopics().includes(topicId)) {
  const panel = $('studySop');
  if (!panel) return;
  panel.querySelector('summary').innerHTML = sopSummary(hasTopic);
  panel.querySelector('.study-sop-content').innerHTML = sopContent(hasTopic);
}

function focusStudy(id) {
  const section = $(id);
  if (!section) return;
  const directory = section.closest('#studyDirectory');
  if (directory) directory.open = true;
  const target = section.querySelector('h2, summary') || section;
  target.tabIndex = -1;
  target.focus();
}

function currentTask(hasTopic, topic) {
  if (!hasTopic) return '';
  const {next, states} = sopProgress(hasTopic);
  const {steps} = window.ChemStudySop[mode];
  let title = steps[next].title;
  if (mode === 'lesson' && lessonReplay) title = '回看微课';
  else if (mode === 'lesson' && lessonStage(progress[topicId] || {}) === 'explain') title = '先弄清刚才这一题';
  else if (next === 5 && states[next] === '等开放') title = '今天学完了';
  else if (next === 5 && states[next] === '已完成') title = '本专题复习完成';
  return `<div class="study-current-task"><div><strong>${title}</strong><span>${escape(topic.name)}</span></div>
    <span>${steps[next].id}</span></div>`;
}

function studyHeader() {
  const methods = route === 'methods';
  const standard = route === 'legacy';
  const lessonMode = mode === 'lesson';
  const download = methods ? '<button type="button" class="btn-sub" data-study-action="method-download">下载当前 SOP</button>' :
    `<a href="${sopFiles[mode]}" download>下载${titles[mode]} SOP</a>`;
  return `<header class="study-head"><h1>${titles[mode]}</h1>${download}</header>
    <div class="study-source-switch study-route-switch" aria-label="${titles[mode]}方式">
      <button type="button" class="btn-sub" data-study-action="method-route" aria-pressed="${methods}">${lessonMode ? '按考法学' : '按题型练'}</button>
      ${lessonMode ? `<button type="button" class="btn-sub" data-study-action="video-route" aria-pressed="${!methods}">视频微课</button>` :
      `<button type="button" class="btn-sub" data-study-source="custom" aria-pressed="${standard && draft.source === 'custom'}">贴一道题</button>
      <button type="button" class="btn-sub" data-study-action="prepared-library" aria-pressed="${route === 'prepared-library'}">查解题步骤</button>
      <button type="button" class="btn-sub" data-study-source="example" aria-pressed="${standard && draft.source === 'example'}">练高考真题</button>`}
    </div>`;
}

const libraryPractice = {
  I01:{model:'net-ionic',exam:['ions']},
  I02:{model:'net-ionic',exam:['ions']},
  I03:{model:'ion-coexist'},
  I04:{model:'ion-coexist'},
  I05:{model:'ion-coexist'},
  I06:{ionic:true,exam:['ions']},
  M08:{model:'dilution-calc'},
  R03:{model:'redox-electrons',exam:['redox']},
  R04:{model:'redox-electrons',exam:['redox']},
  R05:{model:'redox-electrons',exam:['redox']},
  D01:{model:'titration-calc',exam:['titration']},
  D04:{model:'titration-endpoint'},
  D06:{model:'titration-error',exam:['titration','practice']},
  D07:{model:'titration-error',exam:['titration','practice']},
  D08:{model:'titration-error',exam:['titration','practice']},
  D09:{model:'titration-error',exam:['titration','practice']},
  D10:{model:'titration-error',exam:['titration','practice']},
  D11:{model:'solution-prep',exam:['dilution']},
  D22:{model:'titration-combo'},
  C01:{model:'cell-poles',exam:['cell']},
  C02:{model:'cell-poles'},
  C03:{model:'cell-poles'},
  H01:{model:'hess-path',exam:['ester']},
  H02:{model:'hess-path',exam:['ester']},
  K09:{model:'equilibrium-q',exam:['equilibrium','practice']},
  K14:{model:'equilibrium-temp',exam:['equilibrium']},
  S06:{model:'molecular-shape',exam:['polarity','practice']},
  S11:{model:'molecular-polarity',exam:['polarity']}
};

function showLibraryEntry(entry) {
  const related = libraryPractice[entry.id];
  const practice = related?.ionic ? button('练这类题','open-ionic-sample') : related?.model ?
    `<button type="button" class="btn-sub" data-study-action="method-from-exam" data-method-id="${related.model}">练这类题</button>` : '';
  const exam = related?.exam ?
    `<button type="button" class="btn-sub" data-study-action="prepared-exam" data-sop-id="${entry.id}">做一道同类真题</button>` : '';
  preparedSop.showEntry($('preparedEntry'),entry,practice + exam);
  focusStudy('preparedEntry');
}

function mountPreparedLibrary(root) {
  root.innerHTML = `<section class="student-study" aria-label="AI 解题">${studyHeader()}
    <div id="preparedCatalog"></div><div id="preparedEntry"></div></section>`;
  preparedSop.mountCatalog($('preparedCatalog'), showLibraryEntry);
}

function mountPreparedQuestion(root,focusId) {
  const {parts,index} = draft.prepared;
  const current = parts[index];
  const active = preparedSop.byId.get(current.selectedId);
  const alternatives = current.ranks.filter(({id}) => id !== current.selectedId);
  const choices = alternatives.map(({id}) => {
    const entry = preparedSop.byId.get(id);
    return `<button type="button" class="study-topic" data-study-action="prepared-use" data-sop-id="${id}">
      <strong>${escape(entry.title)}</strong><small>${id} · ${escape(entry.topic)}</small></button>`;
  }).join('');
  const subquestions = parts.length > 1 ? `<section class="study-card" aria-label="选择小问">
    <h2>选一个小问开始</h2><div class="study-actions">${parts.map((part,i) =>
      `<button type="button" class="btn-sub" data-study-action="prepared-part" data-part="${i}" aria-pressed="${i === index}">
        ${escape(part.label)}${part.selectedId ? ' · ' + part.selectedId : ' · 待确认'}</button>`).join('')}</div>
    <p id="preparedPrompt" class="study-model-output">${escape(current.prompt)}</p></section>` : '';
  const status = active ? (current.manual ? '已选择' : '匹配到') + '题型 SOP ' + active.id
    : choices ? '请确认本题考法' : '暂未找到明确匹配';
  const message = active ? (choices ? '可对照原题所求，查看是否有更合适的考法。' : '')
    : choices ? '题目可能涉及下列考法。请选择与这一问的要求最接近的一项。'
    : '核对题干、选项和图表是否贴全。也可以按知识点找解题步骤。';
  const evidence = draft.questionReading?.evidence;
  const question = preparedSop.cleanQuestionText(draft.question);
  const missing = current.profile.missing;
  const missingNote = missing.length && !draft.titration ?
    `<div class="study-card question-conditions"><strong>请核对原题资料</strong>
    <ul>${missing.map(item => `<li>${escape(item)}</li>`).join('')}</ul></div>` : '';
  root.innerHTML = `<section class="student-study" aria-label="AI 解题">${studyHeader()}
    <div class="study-case own-titration-question"><h2>你的题目</h2>
      <p class="study-model-output">${highlightEvidence(question,evidence)}</p>${sourceImage()}
      ${draft.thought ? `<details class="study-image-source"><summary>之前记下的思路</summary><p>${escape(draft.thought)}</p></details>` : ''}
      <div class="study-actions">${button('修改原题','edit-custom')}</div></div>${subquestions}
    <div id="studyQuestionReading">${readingCard(draft.questionReading)}${missingNote}
      ${!active ? `<section class="study-card"><h2>${status}</h2><p>${message}</p>
        ${choices ? `<div class="prepared-list">${choices}</div>` : ''}</section>` : ''}
    </div>
    ${active ? `<div id="${draft.ionic ? 'ownIonicFlow' : draft.titration ? 'ownTitrationFlow' : 'ownQuestionFlow'}" aria-label="按原题分步解题"></div>` : ''}
    <details id="preparedAlternatives" class="study-sop"><summary>${active ? status + ' · 核对或更换考法' : '自己找解题步骤'} </summary>
      <div class="study-sop-content">${active && message ? `<p class="study-note">${message}</p><div class="prepared-list">${choices}</div>` : ''}
      <div id="preparedCatalog"></div></div>
    </details></section>`;
  if (draft.ionic) ionicSop.mountGuided($('ownIonicFlow'),draft.ionic);
  else if (draft.titration) titrationSop.mount($('ownTitrationFlow'),draft.titration);
  else if (draft.questionSop) questionSop.mount($('ownQuestionFlow'),draft.questionSop);
  preparedSop.mountCatalog($('preparedCatalog'),entry => openPreparedPart(index,entry.id));
  if (focusId) focusStudy(focusId);
}

function render(focusId) {
  if (window.UI.view !== 'study') return;
  const previousVideo = $('studyVideo');
  if (previousVideo) {
    videoPositions.set(previousVideo.dataset.topic, previousVideo.currentTime);
    previousVideo.pause();
  }
  const root = $('docBody');
  if (route === 'methods') {
    root.innerHTML = `<section class="student-study" aria-label="${titles[mode]}">${studyHeader()}<div id="methodWorkspace"></div></section>`;
    methodStudy.mount($('methodWorkspace'),mode);
    return;
  }
  if (mode === 'solve' && route === 'prepared-library') return mountPreparedLibrary(root);
  if (mode === 'solve' && route === 'ionic-review') {
    root.innerHTML = `<section class="student-study" aria-label="AI 解题">${studyHeader()}<div id="ionicReview"></div></section>`;
    return ionicSop.mountReview($('ionicReview'),ionicReview.id,ionicReview.returnToQuestion);
  }
  if (mode === 'solve' && draft.source === 'custom') {
    if (draft.prepared) return mountPreparedQuestion(root,focusId);
    root.innerHTML = `<section class="student-study" aria-label="AI 解题">${studyHeader()}
      <p id="studyNotice" class="study-note" role="status"></p>${customInput()}</section>`;
    if (focusId) focusStudy(focusId);
    return;
  }
  const topic = topics[topicId];
  const matches = matchingTopics();
  const showTopic = matches.includes(topicId);
  const due = keys.filter(reviewPending).length;
  root.innerHTML = `<section class="student-study" aria-label="${titles[mode]}">${studyHeader()}
    <details class="study-sop" id="studySop" data-mode="${mode}" ${sopOpen[mode] ? 'open' : ''}>
      <summary>${sopSummary(showTopic)}</summary><div class="study-sop-content">${sopContent(showTopic)}</div>
    </details>
    <details id="studyDirectory" ${directoryOpen || !showTopic ? 'open' : ''}><summary>${mode === 'solve'
      ? '真题题库 · ' + keys.length + ' 个专题' : '换个知识点 · 教材目录和搜索'}</summary>${directory(matches)}</details>
    ${due ? `<p class="study-note">有 ${due} 个专题可隔天复习。</p>` : ''}
    <p id="studyNotice" class="study-note" role="status">${storageFailed ? '浏览器无法保存本次记录。' : ''}</p>
    ${currentTask(showTopic, topic)}
    ${showTopic ? mode === 'lesson' ? lesson(topic) : guidedSolver(topic,exams[topicId]) : ''}</section>`;
  connectVideo(previousVideo);
  $('studyDirectory').addEventListener('toggle', event => {
    if (event.currentTarget.isConnected) directoryOpen = event.currentTarget.open;
  });
  $('studySop').addEventListener('toggle', event => {
    const panel = event.currentTarget;
    if (panel.isConnected) sopOpen[panel.dataset.mode] = panel.open;
  });
  const modelButton = $('docBody').querySelector('[data-study-action="model"]');
  if (request && modelButton) modelButton.disabled = true;
  if (focusId) focusStudy(focusId);
}

function enter(nextMode, nextRoute = route) {
  if (nextMode !== mode || nextRoute !== route) clearGuidance();
  if (nextRoute === 'legacy' && mode === 'solve' && nextMode === 'lesson' && (searchTerm || allExamTopics) &&
      matchingTopics().includes(topicId) && !findTopics(searchTerm).includes(topicId)) {
    searchTerm = '';
    selectedBook = locations[topicId].book;
    selectedChapter = '';
  }
  mode = nextMode;
  route = nextRoute;
  window.ChemGames?.stop();
  window.UI.view = 'study';
  window.UI.sel = null;
  $('viewDoc').classList.add('show');
  $('viewStage').classList.add('hide');
  $('viewPT')?.classList.add('hide');
  $('sidebar').classList.remove('show');
  $('mask').classList.remove('show');
  $('inspector').classList.remove('show');
  $('viewDoc').scrollTop = 0;
  render();
  window.dispatchEvent(new CustomEvent('chem:context'));
  document.querySelectorAll('#navTree [data-study-enter]').forEach(link => {
    const active = link.dataset.studyEnter === mode;
    link.classList.toggle('active',active);
    if (active) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
}

function clearGuidance() {
  request?.abort();
  request = null;
  guidance = '';
}

function resetDraft() {
  clearGuidance();
  releaseImage();
  draft = newDraft();
}

function startScene() {
  const player = $('studyVideo');
  if (player) {
    videoPositions.set(topicId, player.currentTime);
    player.pause();
  }
  const scene = topics[topicId].scene;
  const before = window.ChemTitration?.snapshot().trials.at(-1)?.id;
  returnFromScene = {topicId, before};
  if (scene.id === 'tit') window.ChemTitration.enter();
  else window.select(scene.kind, scene.id);
  const previous = $('studyReturn');
  if (previous) previous.hidden = false;
  else {
    const back = document.createElement('button');
    back.id = 'studyReturn';
    back.type = 'button';
    back.className = 'btn-main';
    back.dataset.studyAction = 'return';
    back.textContent = '返回 AI 授课';
    $('viewStage').append(back);
  }
}

function endScene() {
  const scene = returnFromScene;
  if (!scene) return;
  returnFromScene = null;
  $('studyReturn').hidden = true;
  topicId = scene.topicId;
  const activeScene = window.UI.sel?.id;
  const trial = window.ChemTitration?.snapshot().trials.at(-1);
  if (activeScene === topics[topicId].scene.id) {
    const updated = {...readProgress()[topicId], observedAt:Date.now()};
    if (activeScene === 'tit' && trial && trial.id !== scene.before) {
      const {initial, final, used, status} = trial;
      updated.experiment = {initial, final, used, status};
    }
    updateProgress(updated);
  }
  enter('lesson');
}

function notice(text) { $('studyNotice').textContent = text; }

function topicForQuestion(question) {
  const text = question.title + ' ' + question.topic + ' ' + question.stem;
  if (/滴定/.test(text)) return 'titration';
  if (/原电池|电解池|盐桥|电极反应/.test(text)) return 'cell';
  if (/电子守恒|氧化还原/.test(text)) return 'redox';
  if (/极性|分子.{0,5}结构|空间构型/.test(text)) return 'polarity';
  if (/离子共存|离子方程式|离子反应/.test(text)) return 'ions';
  return findTopics(text)[0] || '';
}

function openIonicReview(id,returnToQuestion = false) {
  if (!ionicSop.validCase(id)) return;
  ionicReview = {id,returnToQuestion};
  enter('solve','ionic-review');
}

function openLibraryExam(sopId) {
  const link = libraryPractice[sopId]?.exam;
  if (!link) return;
  const [id,part] = link;
  selectTopic(id);
  resetDraft();
  selectedBook = locations[id].book;
  selectedChapter = String(locations[id].chapter);
  searchTerm = '';
  directoryOpen = false;
  allExamTopics = false;
  if (part === 'practice') {
    draft.step = exams[id].moves.length;
    draft.checked = true;
  }
  enter('solve','legacy');
  focusStudy(part === 'practice' ? 'study-practice' : 'study-move');
}

window.ChemStudentStudy = {
  enter, /* 工作流 1：供 student-study-stub.js 在懒加载完成后进入指定模式 */
  topicForQuestion,
  openIonicReview,
  openOwnQuestion() {
    resetDraft();
    draft.source = 'custom';
    enter('solve','legacy');
    focusStudy('study-custom-input');
  },
  openLibrary(id) {
    enter('solve','prepared-library');
    const entry = preparedSop.byId.get(id);
    if (entry) showLibraryEntry(entry);
  },
  openQuestion(question, thought = '', {analyze = false,practice = null} = {}) {
    const selected = topicForQuestion(question) || topicId;
    resetDraft();
    topicId = selected;
    selectedBook = locations[selected].book;
    selectedChapter = String(locations[selected].chapter);
    searchTerm = '';
    allExamTopics = false;
    transferOpen = false;
    draft.source = 'custom';
    const items = question.options || question.parts?.map(part => part.prompt + (part.unit ? '（' + part.unit + '）' : '')) || [];
    draft.question = [question.stem, ...items.map((item,index) =>
      (question.options ? String.fromCharCode(65+index) + '．' : '（' + (index+1) + '）') + item)].join('\n').slice(0, 2000);
    draft.thought = String(thought || '').slice(0, 600);
    draft.practiceNext = practice;
    enter('solve','legacy');
    if (analyze && hasQuestion()) analyzeCustomQuestion();
  }
};
/* 工作流 1：学习入口首次调用时先按需加载 study bundle，再执行原逻辑（topicForQuestion 无懒加载依赖，保持同步） */
['openIonicReview','openOwnQuestion','openLibrary','openQuestion'].forEach(key=>{
  const orig=window.ChemStudentStudy[key];
  window.ChemStudentStudy[key]=function(...args){
    return window.ChemLazy.load('study').then(()=>{refreshLazyModules();return orig.apply(this,args);});
  };
});

function hasQuestion() {
  if (draft.question.trim().length < 6) {
    notice('先粘贴完整题目，再看提示。');
    $('studyQuestion')?.focus();
    return false;
  }
  return true;
}

function preparePart(part) {
  const profile = questionSop.analyze(part.text);
  const ionic = !profile.choice && !profile.missing.length ? ionicSop.recognize(part) : null;
  const ranks = preparedSop.rank(part);
  const best = ranks[0];
  const matched = preparedSop.confidentMatch(ranks);
  const titration = profile.choice ? null : titrationSop.readQuestion(part.text);
  const scenarios = {rinse:'D06',bubble:'D07',flask:'D08',spill:'D09',over:'D10'};
  let titrationId = '';
  if (titration?.method === 'calc' && /(?:求|计算|算出).{0,24}浓度|浓度(?:是多少|为多少|为\s*[_?])/.test(part.prompt) &&
      !titration.asksActual && (!best || best.id === 'D01')) titrationId = 'D01';
  if (titration?.method === 'error' && /偏高|偏低|误差|偏差|结果.{0,5}影响/.test(part.prompt)) {
    const known = scenarios[titration.fields.scenario];
    if (known && (!best || matched === known)) titrationId = known;
  }
  if (titration?.method === 'both' && titration.asksActual && titration.fields.scenario === 'bubble' &&
      /(?:实际|真实|校正).{0,8}浓度/.test(part.prompt)) titrationId = 'D22';
  const referenceId = profile.vseprExercise ? 'S06' : profile.origin === '水电离专项' ? 'W06' : '';
  const device = profile.choice && /(?:总反应|反应的离子方程式)/.test(part.prompt) &&
    /装置/.test(part.prompt) && /原电池/.test(part.text) && /电解池/.test(part.text);
  const selectedId = referenceId || titrationId || (ionic ? 'I06' : device ? 'C21' : matched);
  return {...part,profile,ranks,selectedId,referenceId,titrationId,titration,ionic,runs:new Map()};
}

function openPreparedPart(index,chosenId) {
  const part = draft.prepared.parts[index];
  if (!part || (chosenId && !preparedSop.byId.has(chosenId))) return;
  draft.prepared.index = index;
  if (chosenId) {
    part.selectedId = chosenId;
    part.manual = true;
  }
  const {profile,selectedId} = part;
  const entry = preparedSop.byId.get(selectedId);
  const native = selectedId && selectedId === part.titrationId;
  const reference = selectedId && selectedId === part.referenceId;
  const ionic = selectedId === 'I06' ? part.ionic : null;
  if (entry && !part.runs.has(selectedId)) {
    const state = native ? {...part.titration,index:0,plan:null,answer:'',notice:'',accepted:false} :
      ionic ? ionicSop.createGuided(ionic,part.text) : {...profile,plan:reference ? profile.plan : preparedSop.makePlan(entry),
        vseprExercise:reference ? profile.vseprExercise : null,answer:'',entries:[],
        origin:reference ? profile.origin : '题型库',practiceNext:draft.practiceNext};
    part.runs.set(selectedId,{...state,preparedId:selectedId});
  }
  const run = part.runs.get(selectedId);
  const clues = part.manual ? null : part.ranks.find(item => item.id === selectedId);
  draft.ionic = ionic ? run : null;
  draft.titration = native ? run : null;
  draft.questionSop = native || ionic ? null : run;
  draft.questionReading = reference ? {...profile.reading} : {
    ...(entry ? preparedSop.reading(entry,native ? (part.titration.method === 'error' ? '实验分析题' : '计算题') : profile.reading.type) :
      {type:profile.reading.type,topic:'待确认',method:'请核对小问的实际要求',firstLook:'圈出这一问要求计算、判断或解释的内容。'}),
    correction:profile.reading.correction,
    evidence:ionic,
    clues:clues && [...new Set([clues.context,clues.ask])].filter(clue => part.text.includes(clue))
  };
  if (draft.questionSop) draft.questionSop.reading = draft.questionReading;
  return render('studyQuestionReading');
}

function analyzeCustomQuestion() {
  draft.prepared = {parts:preparedSop.splitQuestion(draft.question).map(preparePart),index:0};
  return openPreparedPart(0);
}

/* v2.2.1：新版分步解题入口（引擎计算 + 分步交互）。新模块不可用时回退旧流程。 */
function startStepSolve() {
  const q = (draft.question || '').trim();
  if (!q) return;
  if (window.ChemSolveFlow && typeof window.ChemSolveFlow.start === 'function') {
    try { window.ChemSolveFlow.start(q, { source: 'study' }); return; }
    catch (e) { /* 回退旧流程 */ }
  }
  analyzeCustomQuestion();
}
function startPhotoSolve() {
  if (window.ChemSolveOCR && typeof window.ChemSolveOCR.openPhotoSolve === 'function') {
    try { window.ChemSolveOCR.openPhotoSolve(); return; }
    catch (e) { /* 回退：聚焦题目框，提示粘贴截图 */ }
  }
  $('studyQuestion')?.focus();
}

async function askModel(control) {
  if (mode !== 'lesson' || !modelReady || request) return;
  const controller = new AbortController();
  request = controller;
  control.disabled = true;
  control.textContent = '正在请求模型…';
  const topic = topics[topicId];
  const body = {mode,topic:topicId,misconception:topic.diagnostic.feedback[progress[topicId].diagnostic.first]};
  try {
    const response = await fetch('/api/data/study/guide', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:controller.signal
    });
    const data = await response.json();
    if (request !== controller) return;
    guidance = response.ok ? 'AI 辅导\n' + data.answer : data.error;
  } catch {
    if (request === controller) guidance = '模型暂时没有响应。可以继续看内置辅导。';
  } finally {
    if (request === controller) { request = null; render('study-explain'); }
  }
}

document.addEventListener('input', event => {
  if (event.target.id === 'studyQuestion') draft.question = event.target.value;
});

document.addEventListener('paste', event => {
  if (!event.target.closest('#study-custom-input')) return;
  const file = [...(event.clipboardData?.items || [])]
    .find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile() ||
    [...(event.clipboardData?.files || [])].find(item => item.type.startsWith('image/'));
  if (!file) return;
  event.preventDefault();
  attachImage(file);
});

document.addEventListener('submit', event => {
  if (event.target.id !== 'studySearchForm') return;
  event.preventDefault();
  searchTerm = $('studySearch').value.trim();
  const results = matchingTopics();
  if (!results.includes(topicId)) selectTopic(results[0]);
  render('study-topic-result');
});

document.addEventListener('change', event => {
  if (event.target.id === 'studyImageFile') return attachImage(event.target.files[0]);
  if (event.target.id === 'studyBook') {
    selectedBook = event.target.value;
    selectedChapter = '';
  } else if (event.target.id === 'studyChapter') selectedChapter = event.target.value;
  else return;
  allExamTopics = false;
  const results = matchingTopics();
  if (!results.includes(topicId)) selectTopic(results[0]);
  render('study-topic-result');
});

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-study-enter],[data-study-topic],[data-study-stage],[data-study-action],[data-study-source],[data-study-move],[data-study-sop-step],[data-study-sop-target]');
  if (!trigger) return;
  const {studyEnter, studyTopic, studyStage, studyAction, studySource, studyMove, studySopStep, studySopTarget, choice} = trigger.dataset;
  if (studyEnter) {
    if (studyEnter === 'lesson') lessonReplay = '';
    return window.ChemLazy.load('study').then(()=>{refreshLazyModules();enter(studyEnter,'methods');});
  }
  if (studySopStep !== undefined) {
    sopSelection[mode] = Number(studySopStep);
    refreshSop();
    $('studySop').querySelector('[aria-pressed="true"]').focus();
    return;
  }
  if (studySopTarget) {
    if (lessonReplay && mode === 'lesson' && !['studyVideo','study-topic-result'].includes(studySopTarget)) {
      lessonReplay = '';
      return render(studySopTarget);
    }
    if (studySopTarget === 'study-recall' && !$('study-recall')) return render('study-recall');
    return focusStudy(studySopTarget);
  }
  if (studyTopic) { selectTopic(studyTopic); directoryOpen = false; return render(); }
  if (studySource) {
    if (draft.source !== studySource) {
      resetDraft();
      draft.source = studySource;
      sopSelection[mode] = null;
    }
    if (studySource === 'custom' && !matchingTopics().includes(topicId)) {
      searchTerm = '';
      selectedBook = locations[topicId].book;
      selectedChapter = '';
    }
    return enter('solve','legacy');
  }
  if (studyAction === 'method-route') return enter(mode,'methods');
  if (studyAction === 'prepared-library') return enter('solve','prepared-library');
  if (studyAction === 'prepared-exam') return openLibraryExam(trigger.dataset.sopId);
  if (studyAction === 'ionic-review') return openIonicReview(trigger.dataset.ionicCase,true);
  if (studyAction === 'ionic-return') return enter('solve','legacy');
  if (studyAction === 'open-ionic-sample') {
    resetDraft();
    draft.source = 'custom';
    draft.question = ionicSop.sample('acid');
    enter('solve','legacy');
    return analyzeCustomQuestion();
  }
  if (studyAction === 'prepared-part') return openPreparedPart(Number(trigger.dataset.part));
  if (studyAction === 'prepared-use') return openPreparedPart(draft.prepared.index,trigger.dataset.sopId);
  if (studyAction === 'method-download') return methodStudy.downloadSop(mode);
  if (studyAction === 'video-route') return enter('lesson','legacy');
  if (studyAction === 'method-other') return enter('solve','methods');
  if (studyAction === 'method-review-lesson') {
    methodStudy.reviewLesson();
    return enter('lesson','methods');
  }
  if (studyAction === 'method-from-exam') {
    methodStudy.setActive(trigger.dataset.methodId);
    return enter('solve','methods');
  }
  if (studyStage) {
    record(studyStage, Number(choice));
    const complete = ['transfer', 'practice'].includes(studyStage) && passed(topics[topicId], progress[topicId], studyStage);
    render(studyStage === 'diagnostic' ? 'study-explain' : complete ? 'study-complete' : 'study-' + studyStage);
    return;
  }
  if (studyMove !== undefined) {
    draft.choice = Number(studyMove);
    render();
    const root = $('study-move');
    (root.querySelector('[data-study-action="next-move"]') ||
      root.querySelector('[aria-pressed="true"]'))?.focus();
    return;
  }
  if (studyAction === 'pick-image') return $('studyImageFile')?.click();
  if (studyAction === 'retry-image') return void recognizeImage();
  if (studyAction === 'remove-image') {
    releaseImage();
    draft.imageText = null;
    draft.imageNotice = '已移除原图，题目框里的文字仍可修改。';
    return refreshImagePanel();
  }
  if (studyAction === 'solve-step' && !draft.image?.controller && hasQuestion()) return startStepSolve();
  if (studyAction === 'solve-photo') return startPhotoSolve();
  if (studyAction === 'start-custom' && !draft.image?.controller && hasQuestion()) return analyzeCustomQuestion();
  if (studyAction === 'correct-vsepr') {
    const correction = draft.questionReading?.correction;
    if (!correction) return;
    draft.question = draft.question.replace(correction.from,correction.to);
    const original = $('docBody').querySelector('.study-case .study-model-output');
    if (original) original.textContent = preparedSop.cleanQuestionText(draft.question);
    draft.questionReading.correction = null;
    for (const part of draft.prepared.parts) {
      for (const field of ['text','prompt','context']) part[field] = part[field].replace(correction.from,correction.to);
      if (part.profile.reading.correction?.from === correction.from) part.profile.reading.correction = null;
      for (const run of part.runs.values()) {
        if (run.question) run.question = part.text;
      }
    }
    if ($('preparedPrompt')) $('preparedPrompt').textContent = draft.prepared.parts[draft.prepared.index].prompt;
    const readingRegion = $('studyQuestionReading');
    if (readingRegion) {
      readingRegion.innerHTML = readingCard(draft.questionReading);
      focusStudy('studyQuestionReading');
    }
    return;
  }
  if (studyAction === 'review-vsepr') {
    const id = 'study-vsepr-review';
    if (!$(id)) $('study-custom-input').after(Object.assign(document.createElement('div'),{id}));
    $(id).innerHTML = card('上次的错点','复练分子构型','<chem-vsepr-practice></chem-vsepr-practice>');
    return focusStudy(id);
  }
  if (studyAction === 'edit-custom') {
    const {question,thought,image,imageNotice,imageText,imageBase} = draft;
    draft.image = null;
    resetDraft();
    draft.source = 'custom';
    Object.assign(draft,{question,thought,image,imageNotice,imageText,imageBase});
    return render('study-custom-input');
  }
  if (studyAction === 'scene') return startScene();
  if (studyAction === 'clear-search') {
    searchTerm = '';
    allExamTopics = false;
    const results = matchingTopics();
    if (!results.includes(topicId)) selectTopic(results[0]);
    return render('study-topic-result');
  }
  if (studyAction === 'toggle-exam-list') {
    allExamTopics = !allExamTopics;
    if (!allExamTopics && !matchingTopics().includes(topicId)) {
      selectedBook = locations[topicId].book;
      selectedChapter = '';
    }
    return render('study-topic-result');
  }
  if (studyAction === 'return') return endScene();
  if (studyAction === 'to-solve') return enter('solve');
  if (studyAction === 'to-lesson') { lessonReplay = 'solve'; return enter('lesson'); }
  if (studyAction === 'lesson-replay') { lessonReplay = 'lesson'; return render('studyVideo'); }
  if (studyAction === 'lesson-resume') { lessonReplay = ''; return render(); }
  if (studyAction === 'diagnostic') {
    markVideo('confirmed');
    return render('study-diagnostic');
  }
  if (studyAction === 'transfer') { transferOpen = true; return render('study-transfer'); }
  if (studyAction === 'clue') { draft.clue = true; return render('study-move'); }
  if (studyAction === 'next-move') {
    const {moves} = exams[topicId];
    const move = moves[draft.step];
    if (!move || !grade(move, draft.choice).correct) return;
    draft.step++;
    draft.choice = null;
    draft.clue = false;
    return render(draft.step === moves.length ? 'study-worked' : 'study-move');
  }
  if (studyAction === 'restart') { resetDraft(); return render('study-move'); }
  if (studyAction === 'check-example') { draft.checked = true; return render('study-practice'); }
  if (studyAction === 'model') askModel(trigger);
});
window.addEventListener('chem:context', () => {
  if (window.UI.view === 'study') return;
  $('studyVideo')?.pause();
  $('methodWorkspace')?.querySelector('video')?.pause();
  document.querySelector('#navTree [data-study-enter][aria-current]')?.removeAttribute('aria-current');
  const scene = returnFromScene && topics[returnFromScene.topicId].scene;
  if ($('studyReturn') && window.UI.sel?.id !== scene?.id) $('studyReturn').hidden = true;
});

const nav = document.createElement('div');
nav.className = 'study-nav';
nav.innerHTML = Object.entries(titles).map(([id, title]) =>
  `<div class="nav-group"><button type="button" class="nav-cat new-nav" data-study-enter="${id}"><span class="ni" aria-hidden="true">${id === 'lesson' ? '◫' : '✎'}</span><span>${title}</span></button></div>`
).join('');
/* 工作流 1：首屏 stub 已创建入口时不再重复创建 */
if (!document.querySelector('#navTree [data-study-enter]')) $('navTree').firstElementChild.after(nav);

function addHomeEntry(root) {
  const home = root.querySelector('.studio-home');
  if (!home || home.querySelector('.study-home-entry')) return;
  const block = document.createElement('section');
  block.className = 'study-home-entry';
  block.setAttribute('aria-label','学生学习 SOP');
  block.innerHTML = `<button type="button" class="study-topic" data-study-enter="lesson"><strong>AI 授课 SOP <span aria-hidden="true">→</span></strong><small>看微课 · 学方法 · 查理解</small></button>
    <button type="button" class="study-topic" data-study-enter="solve"><strong>AI 解题 SOP <span aria-hidden="true">→</span></strong><small>读题选法 · 分步作答 · 换题练习</small></button>`;
  home.insertBefore(block,home.querySelector('.home-welcome'));
}

const originalHome = window.ChemEnhance.home;
window.ChemEnhance.home = root => { originalHome(root); addHomeEntry(root); };
addHomeEntry($('docBody'));

if (location.protocol !== 'file:') fetch('/api/data/study/status', {cache:'no-store'})
  .then(response => response.ok ? response.json() : null)
  .then(data => { modelReady = data?.configured === true; })
  .catch(() => {})
  .finally(() => {
    const panel = $('studyModelControls');
    if (panel && mode === 'lesson') panel.innerHTML = modelReady ? modelPanel() : '';
  });
})();
