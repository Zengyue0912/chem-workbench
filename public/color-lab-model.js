// All quantities stored in a vessel are mL of stock. Molarity × mL gives mmol.
export const stocks = {
  water:{name:'蒸馏水',label:'稀释',color:'#e4f1f2'},
  acid:{name:'稀盐酸',label:'0.010 mol/L',color:'#e4f1f2'},
  base:{name:'氢氧化钠溶液',label:'0.010 mol/L',color:'#e4f1f2'},
  btb:{name:'溴麝香草酚蓝',label:'BTB 指示剂',color:'#41996c'},
  iodine:{name:'稀碘液',label:'0.002 mol/L（以 I₂ 计）',color:'#ac722d'},
  starch:{name:'淀粉溶液',label:'显色剂',color:'#eff0ea'},
  vitamin:{name:'维生素 C 溶液',label:'0.010 mol/L',color:'#e4f1f2'},
  copper:{name:'硫酸铜溶液',label:'0.040 mol/L',color:'#4e9fc4'},
  alkali:{name:'氢氧化钠溶液',label:'0.10 mol/L',color:'#e4f1f2'},
  acidCu:{name:'稀盐酸',label:'0.10 mol/L',color:'#e4f1f2'}
};
export const setups = {
  iodine:{title:'碘与淀粉显色',short:'碘与淀粉',palette:['#b67a29','#252b58','#e4edef'],
    prompt:'向碘液加入淀粉，观察第一滴落下的位置。再试试加入维生素 C。',
    reagents:['starch','vitamin','iodine','water'],start:{iodine:8,water:2},first:'starch',
    note:'维生素 C 与碘按 1∶1 反应。剩余碘与淀粉形成蓝黑色体系，色深为定性示意。'},
  indicator:{title:'酸碱指示剂变色',short:'酸碱指示剂',palette:['#e7bc36','#66a457','#267ac3'],
    prompt:'先加酸，再逐次加碱。看滴落处和杯中其他位置的颜色什么时候变得一样。',
    reagents:['acid','base','btb','water'],start:{water:9.8,btb:0.2},first:'acid',
    note:'按 25 °C 理想强酸、强碱溶液计算 pH。指示剂按微量示踪处理，颜色为白光下的近似显示。'},
  copper:{title:'蓝色沉淀的生成与溶解',short:'蓝色沉淀',palette:['#94d4e4','#488bcc','#bddeea'],
    prompt:'向硫酸铜溶液加碱，先看滴落处，再看杯底。加入稀盐酸后再观察一次。',
    reagents:['alkali','acidCu','copper','water'],start:{copper:8,water:2},first:'alkali',
    note:'按 Cu²⁺ 与 OH⁻ 的 1∶2 计量关系近似沉淀量。忽略微量溶解，杯底显示固液分层示意。'}
};
export const capacities = {smallBeaker:25,beaker:50,tube:20};
export const vesselNames = {smallBeaker:'烧杯',beaker:'烧杯',tube:'试管'};
export const volume = vessel => Object.values(vessel.stock).reduce((sum,v) => sum+v,0);
export const fmt = n => String(Number(n.toFixed(3)));
export function newSetup(id) {
  return {vessels:[{kind:'smallBeaker',stock:{...setups[id].start}},{kind:'smallBeaker',stock:{}}],
    active:0,reagent:setups[id].first,tool:'pipette',amount:1,log:[],note:''};
}
function enoughSpace(vessel,ml) { return volume(vessel)+ml <= capacities[vessel.kind]+1e-8; }
export function dispense(id,vessel,key,ml) {
  if (!setups[id].reagents.includes(key) || !Number.isFinite(ml) || ml <= 0) return '请选择本实验的试剂和有效用量。';
  if (!enoughSpace(vessel,ml)) return '容器装不下，请减小用量或改用大烧杯。';
  vessel.stock[key]=(vessel.stock[key] || 0)+ml;
  return '';
}
export function transfer(from,to,ml) {
  const total=volume(from);
  if (!Number.isFinite(ml) || ml <= 0 || ml > total+1e-8) return '当前容器里的试液不够，请减小转移量。';
  if (!enoughSpace(to,ml)) return '接收容器装不下，请减小转移量。';
  const fraction=Math.min(1,ml/total);
  for (const [key,value] of Object.entries(from.stock)) {
    const moved=value*fraction;
    to.stock[key]=(to.stock[key] || 0)+moved;
    from.stock[key]=value-moved;
  }
  return '';
}
const clamp = n => Math.min(1,Math.max(0,n));
const mix = (a,b,t) => a.map((v,i)=>Math.round(v+(b[i]-v)*clamp(t)));
const clear=[228,241,242];
function display(rgb,strength) {
  return '#'+mix(clear,rgb,strength).map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function observe(id,vessel) {
  const v=volume(vessel),s=vessel.stock;
  const out={ml:v,color:'#dfedef',solid:0,depositShare:0,caption:'空容器',reading:'',value:null};
  if (v<1e-8) return out;
  if (id==='indicator') {
    const delta=((s.acid||0)-(s.base||0))*.01/v;
    const root=Math.hypot(delta,2e-7);
    const h=delta>=0 ? (delta+root)/2 : 2e-14/(root-delta);
    const ph=-Math.log10(h);
    const fraction=1/(1+10**(7.1-ph));
    const yellow=[245,198,44],green=[62,157,89],blue=[35,99,198];
    const tint=fraction<.5 ? mix(yellow,green,fraction*2) : mix(green,blue,(fraction-.5)*2);
    const strength=1-Math.exp(-155*(s.btb||0)/v);
    out.color=display(tint,strength);
    out.caption=!s.btb?'无色':ph<6?'黄色':ph<6.7?'黄绿色':ph<7.3?'绿色':ph<7.6?'蓝绿色':'蓝色';
    if(s.btb && strength<.2)out.caption+='（很浅）';
    out.value=ph;out.reading='pH '+ph.toFixed(2);
  } else if (id==='iodine') {
    const remaining=Math.max(0,.002*(s.iodine||0)-.01*(s.vitamin||0));
    const binding=1-Math.exp(-160*(s.starch||0)/v);
    const depth=1-Math.exp(-remaining/v*(1200+4800*binding));
    out.color=display(mix([178,113,41],[31,35,68],binding),depth);
    if(remaining<1e-10)out.caption='无色';
    else if(binding<.18)out.caption=depth>.5?'黄褐色':'浅黄色';
    else if(binding<.72)out.caption='褐色中透出蓝紫色';
    else out.caption=depth>.5?'蓝黑色':'浅蓝紫色';
    out.value=remaining;out.reading='剩余碘 '+fmt(remaining*1000)+' μmol';
  } else {
    const cu=(s.copper||0)*.04;
    const oh=((s.alkali||0)-(s.acidCu||0))*.1;
    const ppt=Math.max(0,Math.min(cu,oh/2));
    const dissolved=cu-ppt;
    out.color=display([62,162,210],1-Math.exp(-55*dissolved/v));
    out.solid=ppt;out.value=ppt;out.reading='沉淀 '+fmt(ppt)+' mmol';
    // Qualitative settled layer for both views. Equal concentrations give equal shares.
    out.depositShare=Math.min(.36,2.2*Math.sqrt(ppt/v));
    out.caption=ppt>1e-8?(dissolved>1e-8?'蓝色沉淀 · 上层浅蓝':'蓝色沉淀 · 上层无色'):(dissolved>1e-8?'蓝色澄清溶液':'无色');
  }
  return out;
}
