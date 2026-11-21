import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const context = {window:{}};
runInNewContext(readFileSync(new URL('../public/student-ionic-sop.js',import.meta.url),'utf8'),context);
const {recognize,checkEquation,sample} = context.window.ChemIonicSop;

test('只对用量清楚的碳酸钠和盐酸题开启逐步核对', () => {
  const classify = (prompt,context = '') => recognize({prompt,context});
  assert.equal(classify(sample('acid')).id,'acid');
  assert.equal(classify(sample('carbonate')).id,'carbonate');
  const pasted = '向 Na₂CO₃ 溶液中加入足量稀 HCl，试写出该反应的净离子方程式。';
  assert.equal(classify(pasted).condition,'向 Na₂CO₃ 溶液中加入足量稀 HCl');
  assert.equal(classify(pasted).request,'试写出该反应的净离子方程式');
  assert.equal(classify('写出该反应的离子方程式。','向碳酸钠溶液中加入过量盐酸。').id,'acid');
  assert.equal(classify('向碳酸钠溶液中加入盐酸。写出离子方程式。'),null);
  assert.equal(classify('向碳酸钠溶液中加入过量盐酸，再加入 NaOH。写出离子方程式。'),null);
  assert.equal(classify('如图所示。向碳酸钠溶液中加入过量盐酸。写出离子方程式。'),null);
});

test('方程式接受常见电荷写法和调换项的顺序', () => {
  const accepted = (text,id) => checkEquation(text,id)?.every(check => check.ok);
  assert.equal(accepted('2 H⁺ + CO₃²⁻ → H₂O(l) + CO₂(g)','acid'),true);
  assert.equal(accepted('CO32-+2H+=CO2↑+H2O','acid'),true);
  assert.equal(accepted('CO3^2-(aq) + H+(aq) -> HCO3-(aq)','carbonate'),true);
  assert.equal(checkEquation('CO3^2- + H+ = HCO3- =','carbonate'),null);
});

test('分别判断产物、旁观离子、原子数和电荷', () => {
  const failed = (text,id) => Array.from(checkEquation(text,id).filter(check => !check.ok), check => check.cause);
  assert.deepEqual(failed('CO₃²⁻ + H⁺ → HCO₃⁻','acid'),['产物判断']);
  assert.deepEqual(failed('CO₃²⁻ + H⁺ → CO₂ + H₂O','acid'),['原子数未配平','总电荷未配平']);
  assert.deepEqual(failed('CO₃⁻ + 2H⁺ → CO₂ + H₂O','acid'),['参与反应的离子','总电荷未配平']);
  assert.deepEqual(failed('CO₃²⁻ + 2H⁺ → CO₂↓ + H₂O','acid'),['产物判断']);
  assert.equal(checkEquation('没写完','acid'),null);
});
