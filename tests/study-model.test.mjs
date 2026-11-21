import assert from 'node:assert/strict';
import test from 'node:test';
import {CONSENT, createApp, hashPassword} from '../server/core.mjs';
import {openSQLite} from '../server/sqlite.mjs';
import {createLocalStudyModel,createStudyModel,validateStudyInput} from '../server/study-model.mjs';

const origin = 'https://example.test';
const guide = {mode:'solve', topic:'titration', question:'滴定读数差应该怎么求？', thought:'先找初读数'};

test('同步练习在提示时不发送解析，复盘时才带上参考内容', () => {
  const practice = {mode:'practice', question:'滴定读数差应该怎么求？', thought:'先找初读数', reference:'示例解析', studentNo:'A01'};
  const hint = validateStudyInput(practice);
  assert.match(hint.task,/提示/);
  assert.equal(hint.reference,'');
  assert.equal(Object.hasOwn(hint,'studentNo'),false);
  const review = validateStudyInput({...practice, review:true});
  assert.match(review.task,/复盘/);
  assert.equal(review.reference,'示例解析');
});

async function call(app, route, {data, cookie, from = origin} = {}) {
  return app.handle(new Request(origin + '/api/data/' + route, {
    method: data ? 'POST' : 'GET',
    headers: {Origin:from, 'Content-Type':'application/json', ...(cookie ? {Cookie:cookie} : {})},
    ...(data ? {body:JSON.stringify(data)} : {})
  }));
}

test('未配置模型时保留内置流程，云端模型需要登录并对同一学号限额', async t => {
  const store = openSQLite(':memory:');
  t.after(() => store.close());
  const config = {
    mode:'cloud', siteUrl:origin, collectionCode:'STUDY-TEST',
    secret:'study-test-secret-32-characters-minimum', adminSalt:'study-test',
    adminHash:hashPassword('Study-Admin-Test', 'study-test')
  };
  const offline = createApp({store, config});
  assert.deepEqual(await (await call(offline, 'study/status')).json(), {configured:false});
  assert.equal((await call(offline, 'study/guide', {data:guide})).status, 503);

  const calls = [];
  const studyModel = createStudyModel({
    CHEM_STUDY_BASE_URL:'https://provider.test/v1/', CHEM_STUDY_API_KEY:'mock-key', CHEM_STUDY_MODEL:'mock-model'
  }, async (url, options) => {
    assert.equal(url.href, 'https://provider.test/v1/chat/completions');
    const body = JSON.parse(options.body);
    calls.push(JSON.parse(body.messages[1].content));
    return Response.json({choices:[{message:{content:'先用末读数减去初读数。'}}]});
  });
  const app = createApp({store, config:{...config, studyModel}});
  assert.deepEqual(await (await call(app, 'study/status')).json(), {configured:true,available:false});
  assert.equal((await call(app, 'study/guide', {data:guide})).status, 401);
  assert.equal((await call(app, 'study/guide', {data:{mode:'practice',question:guide.question}})).status, 401);
  assert.equal((await call(app, 'study/guide', {data:{mode:'plan',question:guide.question}})).status, 401);
  assert.equal((await call(app, 'study/guide', {data:guide, from:'https://elsewhere.test'})).status, 403);
  const join = () => call(app, 'join', {data:{
    code:'STUDY-TEST', consent:true, consentVersion:CONSENT, className:'临时测试班', studentNo:'S1', alias:'合成学生'
  }});
  const first = await join(), second = await join();
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const cookies = [first, second].map(response => response.headers.get('set-cookie').split(';')[0]);
  assert.deepEqual(await (await call(app,'study/status',{cookie:cookies[0]})).json(),{configured:true,available:true});
  assert.equal((await call(app, 'study/guide', {data:{...guide, question:'x'}, cookie:cookies[0]})).status, 400);
  const responses = await Promise.all(Array.from({length:12}, (_, i) => call(app, 'study/guide', {
    data:{...guide, studentNo:'S1', name:'不应被发送'}, cookie:cookies[i % 2]
  })));
  assert.equal(responses.filter(response => response.status === 200).length, 10);
  assert.equal(responses.filter(response => response.status === 429).length, 2);
  assert.deepEqual(await responses.find(response => response.ok).json(), {answer:'先用末读数减去初读数。'});
  assert.equal(calls.length, 10);
  assert.deepEqual(calls[0], {...guide, topic:'酸碱滴定与误差'});
  assert.equal((await call(app,'study/guide',{data:{mode:'plan',question:guide.question},cookie:cookies[0]})).status,429);
});

test('临时 SOP 只接收题目和条件，核验模型步骤的结构', async t => {
  const store = openSQLite(':memory:');
  t.after(() => store.close());
  const step = {
    title:'找出基准水量',input:'初始质量与饱和条件',action:'按初温溶解度折算水量',
    output:'水的质量',attention:'两次溶解度按同一水量换算',criteria:'能解释水量从哪来'
  };
  const plan = {title:'降温析晶',missing:['低温下的溶解度'],steps:[step,{...step,title:'换算低温能溶多少'}]};
  let reply = '```json\n' + JSON.stringify(plan) + '\n```';
  const studyModel = createStudyModel({
    CHEM_STUDY_BASE_URL:'https://provider.test/v1',CHEM_STUDY_API_KEY:'mock-key',CHEM_STUDY_MODEL:'mock-model'
  }, async (url,options) => {
    const body = JSON.parse(options.body);
    assert.match(body.messages[0].content,/不得捏造读数/);
    assert.deepEqual(JSON.parse(body.messages[1].content),{mode:'plan',question:'降温后析出多少晶体？',evidence:'水的质量已知。'});
    return Response.json({choices:[{message:{content:reply}}]});
  });
  const app = createApp({store,config:{mode:'local',studyModel}});
  assert.deepEqual(await (await call(app,'study/status')).json(),{configured:true,available:true});
  const data = {mode:'plan',question:'降温后析出多少晶体？',evidence:'水的质量已知。',studentNo:'多余字段'};
  const response = await call(app,'study/guide',{data});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{plan});
  const reading = {type:'计算题',topic:'溶解度与降温析晶',method:'比较降温前后的溶解量。',firstLook:'先核对水量。'};
  reply = JSON.stringify({...plan,reading});
  assert.deepEqual(await (await call(app,'study/guide',{data})).json(),{plan:{...plan,reading}});
  reply = JSON.stringify({...plan,reading:{...reading,topic:'超'.repeat(161)}});
  assert.deepEqual(await (await call(app,'study/guide',{data})).json(),{plan});
  reply = '{"title":"不完整","missing":[],"steps":[{"title":"没有操作"}]}';
  assert.equal((await call(app,'study/guide',{data})).status,502);
});

test('本机兼容已有 DeepSeek 变量，显式配置优先', async () => {
  let called = false;
  const model = createLocalStudyModel({'deepseek-api':'mock-local-key'},async (url,options) => {
    called = true;
    assert.equal(url.href,'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer mock-local-key');
    assert.equal(JSON.parse(options.body).model,'deepseek-flash');
    return Response.json({choices:[{message:{content:'检查题目给定条件。'}}]});
  });
  assert.equal(await model(guide),'检查题目给定条件。');
  assert.equal(called,true);
  assert.equal(createLocalStudyModel({'deepseek-api':'mock-local-key',CHEM_STUDY_BASE_URL:'https://other.test'}),null);
  const explicit = createLocalStudyModel({
    'deepseek-api':'mock-local-key',CHEM_STUDY_BASE_URL:'https://other.test',CHEM_STUDY_API_KEY:'mock-explicit-key',CHEM_STUDY_MODEL:'configured-model'
  },async (url,options) => {
    assert.equal(url.origin,'https://other.test');
    assert.equal(options.headers.Authorization,'Bearer mock-explicit-key');
    return Response.json({choices:[{message:{content:'显式模型正常。'}}]});
  });
  assert.equal(await explicit(guide),'显式模型正常。');
});
