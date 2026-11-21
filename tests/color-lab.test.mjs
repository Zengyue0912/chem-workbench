import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newSetup,observe,dispense,transfer,volume} from '../public/color-lab-model.js';
import {describeChange} from '../public/color-lab-reaction.js';

test('指示剂随净酸碱量变色，无指示剂时酸碱仍无色',()=>{
  const [a,b]=newSetup('indicator').vessels;
  for(const [key,expected] of [[null,'绿色'],['acid','黄色'],['base','绿色'],['base','蓝色']]){
    if(key)assert.equal(dispense('indicator',a,key,1),'');
    assert.equal(observe('indicator',a).caption,expected);
  }
  dispense('indicator',b,'acid',1);
  assert.equal(observe('indicator',b).caption,'无色');
  assert.ok(Math.abs(observe('indicator',b).value-2)<1e-6);
});
test('过量维生素 C 先耗尽，再加入的碘才能重新显蓝黑色',()=>{
  const [a]=newSetup('iodine').vessels;
  const obs=()=>observe('iodine',a);
  dispense('iodine',a,'starch',1);assert.equal(obs().caption,'蓝黑色');
  dispense('iodine',a,'vitamin',2);assert.equal(obs().caption,'无色');
  dispense('iodine',a,'iodine',1);assert.equal(obs().caption,'无色');
  dispense('iodine',a,'iodine',6);assert.equal(obs().caption,'蓝黑色');
});
test('沉淀受限量试剂控制；混匀后分样守恒；加酸后重新溶解',()=>{
  const [a,b]=newSetup('copper').vessels;
  dispense('copper',a,'alkali',10);assert.equal(observe('copper',a).solid,.32);
  const unsplit=observe('copper',a);
  assert.equal(transfer(a,b,volume(a)/2),'');
  assert.equal(volume(a),volume(b));
  assert.equal(observe('copper',a).solid,.16);
  assert.equal(observe('copper',b).solid,.16);
  assert.equal(observe('copper',b).depositShare,unsplit.depositShare);
  assert.equal(observe('copper',b).color,unsplit.color);
  dispense('copper',a,'acidCu',5);
  assert.equal(observe('copper',a).solid,0);assert.equal(observe('copper',b).solid,.16);
  assert.equal(observe('copper',a).depositShare,0);
});
test('两杯转移、稀释与装量上限；拒绝的操作不会改变状态',()=>{
  const [a,b]=newSetup('indicator').vessels;b.kind='tube';
  const unchanged=JSON.stringify([a,b]);
  assert.ok(transfer(a,b,12));assert.ok(dispense('indicator',b,'water',21));
  assert.ok(dispense('indicator',a,'iodine',1));assert.ok(dispense('indicator',a,'acid',-1));
  assert.equal(JSON.stringify([a,b]),unchanged);
  transfer(a,b,10);assert.equal(observe('indicator',a).caption,'空容器');
  const before=observe('indicator',b);
  dispense('indicator',b,'water',10);
  const after=observe('indicator',b);
  assert.equal(after.value,before.value);assert.notEqual(after.color,before.color);
});
test('沉淀动画区分现场生成、溶解和从另一只杯中带入的固体',()=>{
  const [a,b]=newSetup('copper').vessels;
  const initial=observe('copper',a),empty=observe('copper',b);
  dispense('copper',a,'alkali',1);
  const withSolid=observe('copper',a);
  assert.equal(describeChange('copper',initial,withSolid,'#e4f1f2','alkali').effect,'precipitate');
  transfer(a,b,volume(a)/2);
  const moved=observe('copper',b);
  assert.equal(describeChange('copper',empty,moved,withSolid.color,null,moved.solid).effect,'pour');
  dispense('copper',b,'acidCu',1);
  assert.equal(describeChange('copper',moved,observe('copper',b),'#e4f1f2','acidCu').effect,'dissolve');
});
test('只在仍有碘可反应时显示局部褪色，继续加维生素 C 时保留无色',()=>{
  const [a]=newSetup('iodine').vessels;
  dispense('iodine',a,'starch',1);
  const colored=observe('iodine',a);
  dispense('iodine',a,'vitamin',.05);
  const partially=observe('iodine',a);
  assert.equal(partially.caption,'蓝黑色');
  assert.equal(describeChange('iodine',colored,partially,'#e4f1f2','vitamin').effect,'bleach');
  dispense('iodine',a,'vitamin',2);
  const clear=observe('iodine',a);
  dispense('iodine',a,'vitamin',1);
  assert.equal(describeChange('iodine',clear,observe('iodine',a),'#e4f1f2','vitamin').effect,'pour');
});
test('初始 10 mL 放入 25 mL 烧杯，旧版 50 mL 烧杯仍按原量程加液',()=>{
  const [a]=newSetup('indicator').vessels;
  assert.equal(volume(a),10);assert.equal(a.kind,'smallBeaker');
  assert.ok(dispense('indicator',a,'water',16));
  const old={kind:'beaker',stock:{water:38}};
  assert.equal(dispense('indicator',old,'water',12),'');assert.equal(volume(old),50);
});
