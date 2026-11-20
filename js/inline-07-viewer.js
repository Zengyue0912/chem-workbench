/* ============================================================================
 * 抽取自 index.html 内联 <script> #7（原行 3502–4363）。
 * 查看器 + 实验模拟器（window.VW / SIM / resizeCv）
 * 工作流 1（性能与工程重构）：内容原样搬运，仅做加载方式改变。
 * 加载方式：按需懒加载（bundle: viewer3d，见 js/loader.js）
 * ========================================================================== */
(function(){'use strict';
const $=id=>document.getElementById(id);
const cv=$('cv'),ctx=cv.getContext('2d'),viewport=$('viewport');
const RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const V=E3.v;
let needsDraw=true;
const VW={model:null,meta:null,auto:!RM,explode:0,labels:false,molMode:'ball',vyaw:0,vpitch:0,exp:null,extra:[],minD:2,maxD:60,expPitch:undefined,cmp:null};
window.VW=VW;
/* ---------- 尺寸 ---------- */
function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const r=viewport.getBoundingClientRect();
  cv.width=Math.max(2,r.width*dpr);cv.height=Math.max(2,r.height*dpr);
  cv._dpr=dpr;cv._w=r.width;cv._h=r.height;
  if(VW.model){E3.cam.cx=r.width/2;E3.cam.cy=r.height*0.47;E3.cam.fov=Math.min(r.width,r.height)*0.86;}
  needsDraw=true;
}
window.addEventListener('resize',resize);
window.__calcDisp=calcDisp; /* 调试导出 */
/* ---------- 拆解位移 ---------- */
function calcDisp(){
  if(VW.cmp){ /* 分子对比：左右分列、中心归零（同步旋转、统一比例——同一相机同一世界单位） */
    const n=VW.model.parts.length,disp=[];
    const c=VW.cmp;
    const pa=[-c.dx/2-c.ca[0],-c.ca[1],-c.ca[2]];
    const pb=[c.dx/2-c.cb[0],-c.cb[1],-c.cb[2]];
    for(let i=0;i<n;i++)disp.push(i<c.nA?pa:pb);
    return disp;
  }
  if(VW.asm){ /* 装配挑战：已装零件归位，未装零件移出视野（y=-999） */
    const n=VW.model.parts.length,disp=[];
    for(let i=0;i<n;i++)disp.push([0,-999,0]);
    VW.asm.groups.forEach((g,gi)=>{
      if(gi<VW.asm.placed)for(let i=g[0];i<=g[1];i++)disp[i]=[0,0,0];
    });
    return disp;
  }
  const t=VW.explode,n=VW.model.parts.length;
  const disp=[];
  if(t<=0){for(let i=0;i<n;i++)disp.push([0,0,0]);return disp;}
  const s=t*VW.model.span*0.5;
  VW.model.parts.forEach(pt=>{disp.push(pt.dir?[pt.dir[0]*s,pt.dir[1]*s,pt.dir[2]*s]:[0,0,0]);});
  return disp;
}
/* ---------- 绘帧 ---------- */
function drawFrame(){
  const options={explode:VW.explode,disp:VW.model?calcDisp():[],labels:VW.labels,extra:VW.extra};
  if(VW.model&&window.ChemSpatial?.draw(VW.model,options,E3.cam,cv))return;
  ctx.setTransform(cv._dpr,0,0,cv._dpr,0,0);
  ctx.clearRect(0,0,cv._w,cv._h);
  if(!VW.model)return;
  E3.drawFloor(ctx,VW.model);
  E3.render(ctx,VW.model,options);
  /* 暗角：四角轻微压暗，增强舞台纵深 */
  const dark=document.body.dataset.theme==='dark';
  const vg=ctx.createRadialGradient(cv._w/2,cv._h*0.45,Math.min(cv._w,cv._h)*0.40,cv._w/2,cv._h*0.5,Math.max(cv._w,cv._h)*0.75);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,dark?'rgba(0,0,0,.34)':'rgba(8,45,36,.10)');
  ctx.fillStyle=vg;
  ctx.fillRect(0,0,cv._w,cv._h);
}
function loop(ts){
  const dt=Math.min(0.33,(ts-(loop._t||ts))/1000)||0.016;loop._t=ts;
  if(document.hidden){requestAnimationFrame(loop);return;}
  if(VW.auto&&VW.model&&window.UI?.view==='stage'){E3.cam.yaw+=dt*0.4;needsDraw=true;}
  if(Math.abs(VW.vyaw)>1e-4||Math.abs(VW.vpitch)>1e-4){
    E3.cam.yaw+=VW.vyaw;E3.cam.pitch=Math.max(-1.45,Math.min(1.45,E3.cam.pitch+VW.vpitch));
    VW.vyaw*=0.93;VW.vpitch*=0.93;needsDraw=true;
  }
  if(VW.exp&&VW.exp.playing&&!VW.exp.manual&&window.UI?.view==='stage'){ /* 低帧率时物理子步进：保持模拟速率且动画不跳跃 */
    let rem=dt;
    while(rem>0){const s=Math.min(0.1,rem);SIM.update(VW.exp,s);rem-=s;}
    needsDraw=true;
  }
  if(needsDraw){drawFrame();needsDraw=false;}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
/* ---------- 视角与交互 ---------- */
function fitModel(){
  const r=viewport.getBoundingClientRect();
  const b=E3.fit(VW.model,Math.max(200,r.width),Math.max(200,r.height),0.84);
  VW.minD=b.span*0.8;VW.maxD=b.span*9;
  VW.baseD=E3.cam.dist; /* 拆解缩放基准：拆开后按倍率拉远，零件才不会飞出画面 */
  E3.cam.yaw=0.18;E3.cam.pitch=VW.expPitch!==undefined?VW.expPitch:0.26; /* 近正视：瓶身标签面正对相机，印刷文字默认可读 */
  VW.vyaw=VW.vpitch=0;
}
function resetView(){if(VW.model){fitModel();needsDraw=true;}}
const ptrs=new Map();let pinchD=0;
cv.tabIndex=0;
cv.addEventListener('pointerdown',e=>{
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  cv.setPointerCapture(e.pointerId);
  cv.classList.add('grabbing');hideHint();
  if(ptrs.size===2){const a=[...ptrs.values()];pinchD=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
  needsDraw=true;
});
cv.addEventListener('pointermove',e=>{
  const p=ptrs.get(e.pointerId);if(!p)return;
  if(ptrs.size===1){
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    E3.cam.yaw+=dx*0.0075;
    E3.cam.pitch=Math.max(-1.45,Math.min(1.45,E3.cam.pitch+dy*0.0075));
    VW.vyaw=dx*0.0022;VW.vpitch=dy*0.0022;
  }
  p.x=e.clientX;p.y=e.clientY;
  if(ptrs.size===2){
    const a=[...ptrs.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    if(pinchD>0&&d>0){E3.cam.dist=Math.max(VW.minD,Math.min(VW.maxD,E3.cam.dist*pinchD/d));}
    pinchD=d;
  }
  needsDraw=true;
});
function ptrEnd(e){ptrs.delete(e.pointerId);if(ptrs.size<2)pinchD=0;if(!ptrs.size)cv.classList.remove('grabbing');}
cv.addEventListener('pointerup',ptrEnd);cv.addEventListener('pointercancel',ptrEnd);
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  E3.cam.dist=Math.max(VW.minD,Math.min(VW.maxD,E3.cam.dist*Math.exp(e.deltaY*0.0011)));
  needsDraw=true;
},{passive:false});
cv.addEventListener('dblclick',resetView);
cv.addEventListener('keydown',e=>{
  const k=e.key;let used=true;
  if(k==='ArrowLeft')E3.cam.yaw-=0.12;
  else if(k==='ArrowRight')E3.cam.yaw+=0.12;
  else if(k==='ArrowUp')E3.cam.pitch=Math.min(1.45,E3.cam.pitch+0.1);
  else if(k==='ArrowDown')E3.cam.pitch=Math.max(-1.45,E3.cam.pitch-0.1);
  else if(k==='+'||k==='=')E3.cam.dist=Math.max(VW.minD,E3.cam.dist*0.9);
  else if(k==='-')E3.cam.dist=Math.min(VW.maxD,E3.cam.dist*1.11);
  else if(k===' '&&VW.exp){SIM.togglePlay();}
  else used=false;
  if(used){e.preventDefault();needsDraw=true;}
});
let hintT=0;
function hideHint(){const h=$('hudHint');if(h&&!h.classList.contains('fade')){clearTimeout(hintT);hintT=setTimeout(()=>h.classList.add('fade'),1800);}}
/* ---------- 实验模拟器 ---------- */
const M=B.M,{L,S,LN,D,F}=B;
function hexGlow(h,a){
  const c=h.length===4?'#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3]:h;
  return 'rgba('+parseInt(c.substr(1,2),16)+','+parseInt(c.substr(3,2),16)+','+parseInt(c.substr(5,2),16)+','+a+')';
}
const SIM={
  DUR:{na:[2.6,1.6,1.6,6.0,4.2],tit:[3,2.5,2.5,7,4,3.5],flame:[3,3.5,4,3.5],drill_na:[3,4.5,4.5],drill_h2so4:[3,4.5,4.5],asm_gas:[1,1,1,1],asm_dist:[1,1,1,1],static:[3.2,3.2,3.2,3.2,3.2,3.2]},
  durations(item){const preset=SIM.DUR[item.id]||SIM.DUR[item.sim]||[];return item.steps.map((_,i)=>Number.isFinite(preset[i])&&preset[i]>0?preset[i]:3.2);},
  init(item){
    const e={item:item,step:0,stepT:0,playing:false,done:false,st:{}};
    VW.exp=e;
    SIM.setup(item,e);
    SIM.panel();
  },
  setup(item,e){
    if(item.sim==='na')SIM.setupNa(e);
    else if(item.sim==='tit')SIM.setupTit(e);
    else if(item.sim==='flame')SIM.setupFlame(e);
    else if(item.sim==='drill')SIM.setupDrill(e);
    else if(item.sim==='asm')SIM.setupAsm(e);
    else SIM.setupStatic(e);
  },
  /* ===== 静态装置实验：模型就位，用"下一步"推进讲解 ===== */
  setupStatic(e){
    e.st={};
    const fn=e.item.scene;
    VW.model=(fn&&B.app[fn])?B.app[fn]():null;
    VW.expPitch=e.item.pitch!==undefined?e.item.pitch:0.2;
    if(VW.model)fitModel();
  },
  /* ===== 钠与水 ===== */
  setupNa(e){
    e.st={na:{x:0,z:0,r:0.28,vx:0.9,vz:0.6},bubbles:[],ripples:[],mist:[],flames:[],redR:0,redA:0,phDrop:false,inDrop:false};
    VW.model=(function(){
      const parts=[];
      parts.push(B.PT('烧杯',[L([[0.02,0],[1.35,0.02],[1.5,0.1],[1.55,0.3],[1.55,2.3],[1.63,2.36],[1.63,2.5],[1.55,2.52]],{alpha:.52})]));
      parts.push(B.PT('水（滴有酚酞）',[
        L([[0.02,0.14],[1.46,0.2],[1.48,0.4],[1.48,1.7]],{col:'#d9ecf4',alpha:.75,edge:null,flat:true,cull:true}),
        D([0,1.7,0],[0,1,0],1.46,'#e0f0f7',{flat:true,alpha:.68})
      ]));
      parts.push(B.PT('玻璃片（旁置）',[
        F([[-2.6,0.02,-0.9],[-1.2,0.02,-0.9],[-1.2,0.02,0.9],[-2.6,0.02,0.9]],'#eef4f7',{edge:'#c6d3da'}),
        F([[-2.5,0.03,-0.8],[-1.3,0.03,-0.8],[-1.3,0.03,0.8],[-2.5,0.03,0.8]],'#f8fbfd',{})
      ]));
      return B.fin(parts);
    })();
    VW.expPitch=-0.34; /* 俯视：课堂演示观察"浮、熔、游、红"水面现象的标准视角 */
    fitModel();
    E3.cam.dist*=0.72; /* 拉近镜头：聚焦烧杯反应区 */
  },
  na(e,dt){
    const st=e.st;
    const na=st.na;
    /* 钠块位置与大小 */
    if(e.step<2){na.x=-1.9;na.z=0;na.r=0.26;na.y=0.16;} /* 玻璃片上 */
    else if(e.step===2&&e.stepT<0.8){ /* 投入瞬间下落 */
      const k=e.stepT/0.8;
      na.x=0;na.z=0;na.y=1.9-k*0.3;na.r=0.26;
    }else{na.y=1.86;na.r=Math.max(0.16,0.26*(1-(e.step===3?e.stepT/6:(e.step>3?1:0))*0.5));}
    if(e.step===2&&!st.inDrop&&e.stepT>=0.8){ /* 钠粒入水激起水花 */
      st.inDrop=true;
      st.ripples.push({x:0,z:0,r:0.08,a:0.85});
      st.mist.push({x:0,y:1.75,z:0,r:0.12,vy:0.3,a:0.4});
    }
    if(e.step===1&&!st.phDrop&&e.stepT>=1.2){ /* 酚酞液滴入水 */
      st.phDrop=true;
      st.ripples.push({x:0.3,z:0.2,r:0.06,a:0.65});
    }
    /* 步骤≥2：钠已入水，隐藏旁置玻璃片让镜头聚焦烧杯 */
    if(VW.model&&VW.model.parts[2])VW.model.parts[2].hide=e.step>=2;
    if(e.step>=3){
      na.x+=na.vx*dt;na.z+=na.vz*dt;
      if(Math.abs(na.x)>1.05){na.x=Math.sign(na.x)*1.05;na.vx*=-1;st.ripples.push({x:na.x,z:na.z,r:0.07,a:0.7});}
      if(Math.abs(na.z)>1.05){na.z=Math.sign(na.z)*1.05;na.vz*=-1;st.ripples.push({x:na.x,z:na.z,r:0.07,a:0.7});}
      na.vx+=(Math.random()-0.5)*3*dt;na.vz+=(Math.random()-0.5)*3*dt;
      /* 游动涟漪：钠球走到哪里，哪里泛起细涟漪（"游"的视觉暗示） */
      st.trailT=(st.trailT||0)+dt;
      if(st.trailT>0.38){st.trailT=0;st.ripples.push({x:na.x,z:na.z,r:0.05,a:0.5});}
      const rate=e.step===3?(e.stepT<4?20:11):7;
      if(Math.random()<dt*rate)st.bubbles.push({x:na.x+(Math.random()-.5)*.55,y:1.18+Math.random()*0.38,z:na.z*0.4+0.2+(Math.random()-.5)*.5,r:0.07+Math.random()*0.09,vy:0.5+Math.random()*.4});
      /* 反应剧烈期燃起黄色火苗（贴钠球侧边，小而亮） */
      if(Math.random()<dt*(e.step===3?4.2:0.7))st.flames.push({x:na.x+(Math.random()-.5)*.34,y:1.98,z:na.z+(Math.random()-.5)*.34,r:0.06+Math.random()*.06,vy:0.55+Math.random()*.4,life:0.8+Math.random()*.4});
      /* 红色扩散前沿：酚酞遇 NaOH 变红并由钠球处向外扩散（反应即开始，快速渐进变红） */
      if(e.stepT>0.6)st.redR=Math.min(1.48,st.redR+dt*0.9);
      st.redA=Math.min(0.8,(st.redR/1.48)*0.78);
    }
    st.bubbles.forEach(b=>{b.y+=b.vy*dt;b.r+=dt*0.025;});
    st.bubbles=st.bubbles.filter(b=>{
      if(b.y>=1.70){ /* 气泡到水面破裂：激起小涟漪，带出水汽 */
        if(Math.random()<0.34)st.ripples.push({x:b.x,z:b.z,r:0.04,a:0.5});
        if(Math.random()<0.6)st.mist.push({x:b.x,y:1.74,z:b.z,r:0.09,vy:0.3,a:0.46});
        return false;
      }
      return true;
    });
    /* 涟漪半径夹在杯内，触壁即快速消散；同时限流，避免堆成一圈圈灰色年轮 */
    st.ripples.forEach(rp=>{
      rp.r=Math.min(1.40,rp.r+dt*0.9);
      rp.a-=dt*(rp.r>=1.40?1.9:0.55);
    });
    if(st.ripples.length>11)st.ripples=st.ripples.slice(st.ripples.length-11);
    st.ripples=st.ripples.filter(rp=>rp.a>0.02);
    /* 白雾限流：不限制会在十几秒内糊满整个视野，把烧杯与液体一并吞掉 */
    if(st.mist.length>14)st.mist=st.mist.slice(st.mist.length-14);
    st.mist.forEach(m=>{m.y+=m.vy*dt;m.r+=dt*0.15;m.a-=dt*0.06;});
    st.mist=st.mist.filter(m=>m.a>0.02);
    st.flames.forEach(f=>{f.y+=f.vy*dt;f.life-=dt;f.r+=dt*0.02;});
    st.flames=st.flames.filter(f=>f.life>0);
  },
  naExtra(e){
    const st=e.st,ex=[];
    const na=st.na;
    /* 动态 zBias：元素深度 - 其正下方水面 (x,1.7,z) 局部深度 + 0.1，
       把浮于水面之上的元素（钠球/火苗/白雾）恒提到其所在处水面之前绘制。
       注：本引擎 pitch 正方向为仰视（y 越高 view-z 越大越"远"），
       故高于水面的元素天然"远"于水面，必须显式提前，否则被大水面盘片盖住 */
    const zbAt=(x,y,z)=>Math.max(0,(E3.proj(x,y,z)[2]-E3.proj(x,1.7,z)[2])+0.1);
    if(na&&na.r>0.05&&e.step<4){
      const y=e.step<2?0.16+na.r*0.8:(e.step===2?(na.y||1.86):1.86);
      /* 钠球渲染优先级最高（zb+1.05）：教学演示必须看到银白钠球。
         双层球：蓝灰底衬（描边效果）+ 银白亮球——浅背景/红背景下都高对比醒目 */
      /* 钠球只比水面提前一点点：让它"泡在水里、隔着一层玻璃"，而不是浮在杯壁外面。
         玻璃已足够通透，透过前壁仍能清楚看到银白钠球 */
      const zb=zbAt(na.x,y,na.z)+0.18;
      ex.push({t:'glow',c:[na.x,y,na.z],r:na.r*4,col:'rgba(255,250,242,.30)',zBias:zb+0.06});
      ex.push(S([na.x,y,na.z],na.r*1.18,'#8fa4b8',{zBias:zb-0.02}));
      ex.push(S([na.x,y,na.z],na.r,'#f4f8fc',{glow:true,zBias:zb}));
      /* 浮动标注：指明银白小球是"钠"（课堂演示核心物质标识） */
      ex.push(F([[na.x-0.34,y+na.r+0.5,na.z],[na.x+0.34,y+na.r+0.5,na.z],[na.x+0.34,y+na.r+0.82,na.z],[na.x-0.34,y+na.r+0.82,na.z]],'#ffffff',{flat:true,txt:'钠',textCol:'#1d5f74',zBias:zb+0.1}));
      if(e.step===3)ex.push(LN([na.x,y,na.z],[na.x+0.5,y+0.35,na.z],0.03,'#c2c9d4'));
    }
    /* 气泡：细密小气泡从钠球周边散开上浮，层次介于红盘与钠球之间 */
    st.bubbles.forEach(b=>{
      ex.push(S([b.x,b.y,b.z],b.r,'#f2f8fc',{glow:true,zBias:0.55}));
    });
    /* 水面涟漪（深青色环，浅背景上清晰可见） */
    st.ripples.forEach(rp=>{
      ex.push({t:'ring',c:[rp.x,1.708,rp.z],n:[0,1,0],r0:Math.max(0.015,rp.r-0.12),r1:rp.r,col:'rgba(38,98,124,'+Math.min(0.9,rp.a).toFixed(2)+')',zBias:zbAt(rp.x,1.708,rp.z)});
    });
    /* 白雾（水汽，白色更醒目） */
    st.mist.forEach(m=>{
      ex.push({t:'glow',c:[m.x,m.y,m.z],r:m.r*2.6,col:'rgba(238,244,250,'+(m.a*0.8).toFixed(2)+')',zBias:zbAt(m.x,m.y,m.z)+0.4});
    });
    /* 黄色火苗（贴钠球侧边的小橙焰，偏移+0.3 确保浮于水面之上、低于钠球层级） */
    st.flames.forEach(f=>{
      const zb=zbAt(f.x,f.y,f.z)+0.10;
      ex.push({t:'glow',c:[f.x,f.y,f.z],r:f.r*2.4,col:'rgba(255,150,50,.34)',zBias:zb+0.04});
      ex.push(S([f.x,f.y,f.z],f.r,'#ff9d3c',{glow:true,zBias:zb}));
      ex.push(S([f.x,f.y+f.r*0.5,f.z],f.r*0.55,'#ffe08a',{glow:true,zBias:zb}));
    });
    /* 酚酞液滴（步骤1滴入） */
    if(e.step===1&&e.stepT<1.2){
      const k=e.stepT/1.2;
      ex.push(S([0.3,2.0-k*0.3,0.2],0.06,'#c062a8',{glow:true}));
    }
    /* 红色扩散：由钠球处向外扩散的红色前沿 + 整体变红（酚酞遇碱的玫红） */
    if(st.redA>0){
      ex.push(L([[0.02,0.14],[1.46,0.2],[1.48,0.4],[1.48,1.68]],{col:'#dd4f86',alpha:st.redA,edge:null,flat:true,cull:true}));
      ex.push(D([0,1.7,0],[0,1,0],1.46,'#d94a80',{alpha:Math.min(.85,st.redA+0.3),flat:true}));
      if(st.redR<1.44)ex.push({t:'ring',c:[0,1.71,0],n:[0,1,0],r0:Math.max(0.02,st.redR-0.08),r1:st.redR,col:'rgba(196,22,72,'+(0.75*(st.redA/0.8)).toFixed(2)+')',zBias:0.06});
      ex.push({t:'glow',c:[0,1.15,0],r:1.25,col:'rgba(230,60,120,'+(st.redA*0.28).toFixed(2)+')'});
    }
    return ex;
  },
  /* ===== 中和滴定 ===== */
  setupTit(e){
    e.st={liqY:3.15,drops:[],splashes:[],swirls:[],flaskRed:0,tipR:0.036};
    VW.model=(function(){
      const parts=[];
      const by=1.6; /* 滴定管抬升：尖嘴伸入锥形瓶口内约 1～2cm（规范操作） */
      parts.push(B.PT('铁架台与滴定管夹',[
        ...B.BOX(-1.2,-.09,.25,1.8,.17,1.1,'#3b494f',{edge:'#71848a'}),
        LN([-1.51,.02,.26],[-1.51,5.25,.26],.065,'#8d9caa'),
        LN([-1.54,3.8,.26],[-.12,3.8,.17],.07,'#6e8791'),
        LN([-.36,3.8,-.14],[.14,3.8,-.14],.056,'#374854'),
        LN([-.36,3.8,.18],[.14,3.8,.18],.056,'#374854'),
        S([-1.52,3.8,.26],.11,'#7996a3')
      ]));
      parts.push(B.PT('碱式滴定管',[
        L([[0.02,0.9],[0.2,0.9],[0.2,3.4],[0.26,3.45],[0.26,3.56],[0.2,3.58],[0.2,3.7],[0.02,3.7]],{alpha:.55,off:[0,by,0]}),
        LN([0,0.9+by,0],[0,0.45+by,0],0.07,M.rubber),
        L([[0.02,0.9],[0.06,0.75],[0.1,0.55],[0.1,0.42],[0.04,0.38],[0.02,0.38]],{alpha:.62,off:[0,by,0]})
      ]));
      const graduations=[];
      for(let k=0;k<=50;k++){
        const y=3.3+by-k*.026, length=k%10===0?.18:k%5===0?.125:.07;
        graduations.push(LN([-.09,y,-.203],[-.09+length,y,-.203],k%10===0?.009:.005,'#315561'));
      }
      parts.push(B.PT('滴定管刻度',graduations));
      parts.push(B.PT('锥形瓶',[
        L([[0.02,0],[0.6,0.02],[0.8,0.14],[0.85,0.4],[0.85,0.6],[0.3,1.6],[0.3,1.95],[0.37,1.97],[0.37,2.1],[0.3,2.12]],{alpha:.5}),
        L([[0.02,0.1],[0.74,0.18],[0.78,0.42],[0.78,0.62],[0.4,1.3],[0.08,1.35],[0.02,1.0]],{col:'#e8f2f6',alpha:.68,edge:null,flat:true,cull:true})
      ]));
      return B.fin(parts);
    })();
    fitModel();
    E3.cam.dist*=0.72; /* 拉近镜头：聚焦滴定管与锥形瓶 */
  },
  tit(e,dt){
    const st=e.st;
    if(e.manual){window.ChemTitration?.paint(e);return;}
    if(e.step===0){st.liqY=3.15+Math.sin(e.stepT*2)*0.12;}
    else if(e.step===1){st.liqY=3.3;}
    else if(e.step===2){st.liqY=3.25;}
    else if(e.step===3){
      st.liqY=Math.max(2.2,3.25-e.stepT*0.14);
      /* 尖嘴处液滴逐渐长大 → 脱落 */
      st.tipR=Math.min(0.11,st.tipR+dt*0.09);
      if(st.tipR>=0.104){st.drops.push({y:1.95,r:0.1,vy:1.1});st.tipR=0.036;}
      if(Math.random()<dt*1.4)st.swirls.push({ang:Math.random()*Math.PI*2,rad:0.26+Math.random()*0.14,y:1.0+Math.random()*0.3,r:0.12+Math.random()*0.08,alpha:0.55});
    }else if(e.step===4){
      st.liqY=Math.max(2.0,2.2-e.stepT*0.05);
      st.tipR=Math.min(0.11,st.tipR+dt*0.08);
      if(st.tipR>=0.104){st.drops.push({y:1.95,r:0.106,vy:1.0});st.tipR=0.036;}
      st.flaskRed=Math.min(0.55,e.stepT*0.45);
    }else{st.flaskRed=0.55;}
    st.drops.forEach(d=>{d.vy+=dt*1.5;d.y-=d.vy*dt;});
    st.drops=st.drops.filter(d=>{
      if(d.y<=1.37){ /* 液滴落液：激起涟漪 + 旋涡扩散 */
        st.splashes.push({r:0.06,alpha:0.6});
        const n=e.step>=4?3:2;
        for(let i=0;i<n;i++)st.swirls.push({ang:Math.random()*Math.PI*2,rad:0.24+Math.random()*0.18,y:1.0+Math.random()*0.34,r:0.12+Math.random()*0.1,alpha:0.6});
        return false;
      }
      return true;
    });
    st.splashes.forEach(s=>{s.r+=dt*0.75;s.alpha-=dt*0.32;});
    st.splashes=st.splashes.filter(s=>s.alpha>0.03);
    st.swirls.forEach(w=>{w.ang+=dt*2.4;w.alpha-=dt*0.2;});
    st.swirls=st.swirls.filter(w=>w.alpha>0.03);
  },
  titExtra(e){
    const st=e.st,ex=[];
    const by=1.6;
    /* 滴定管内液柱与液面（随滴定逐渐下降） */
    ex.push(L([[0.02,1.0],[0.18,1.05],[0.18,st.liqY]],{col:'#f2d0dd',alpha:.85,edge:null,flat:true,cull:true,off:[0,by,0]}));
    ex.push(D([0,st.liqY+by,0],[0,1,0],0.175,'#f7e0e8',{flat:true}));
    /* 尖嘴处正在长大的液滴 */
    if(e.step===3||e.step===4){
      ex.push(S([0,2.0-st.tipR,0],st.tipR,'#f2d0dd',{glow:true}));
    }
    /* 下落液滴（水滴形：头球+颈+尾球） */
    st.drops.forEach(d=>{
      ex.push(S([0,d.y,0],d.r,'#f2d0dd',{glow:true}));
      ex.push(S([0,d.y+d.r*1.6,0],d.r*0.5,'#f2d0dd'));
      ex.push(LN([0,d.y+d.r*0.7,0],[0,d.y+d.r*1.9,0],d.r*0.3,'#e8bccb'));
    });
    /* 落点涟漪（液面上扩散的圆环） */
    st.splashes.forEach(s=>{
      ex.push({t:'ring',c:[0,1.378,0],n:[0,1,0],r0:Math.max(0.02,s.r-0.09),r1:s.r,col:'rgba(255,255,255,'+s.alpha.toFixed(2)+')'});
    });
    /* 旋涡扩散团（酸性段白色微旋 / 终点粉色扩散） */
    st.swirls.forEach(w=>{
      const x=Math.cos(w.ang)*w.rad,z=Math.sin(w.ang)*w.rad;
      const col=e.step>=4?'rgba(245,120,160,'+w.alpha.toFixed(2)+')':'rgba(255,255,255,'+(w.alpha*0.7).toFixed(2)+')';
      ex.push({t:'glow',c:[x,w.y,z],r:w.r*3.4,col:col});
    });
    /* 锥形瓶液面 */
    const red=st.flaskRed;
    ex.push(D([0,1.36,0],[0,1,0],0.36,red>0?'#f7bdd0':'#e8f2f6',{flat:true,alpha:red>0?0.55+red*0.3:0.55}));
    /* 变红叠加与粉色光晕 */
    if(red>0){
      ex.push(L([[0.02,0.1],[0.74,0.18],[0.78,0.42],[0.78,0.62],[0.4,1.3],[0.08,1.35],[0.02,1.0]],{col:'#f5a8c0',alpha:red,edge:null,flat:true,cull:true}));
      if(red>0.15)ex.push({t:'glow',c:[0,1.05,0],r:0.95,col:'rgba(245,120,160,'+(red*0.28).toFixed(2)+')'});
    }
    return ex;
  },
  /* ===== 焰色试验 ===== */
  setupFlame(e){
    e.st={ele:null,inner:null,particles:[],sparks:[],glowT:0};
    VW.model=(function(){
      const parts=[];
      parts.push(B.PT('酒精灯',[
        L([[0.02,0],[0.75,0.02],[0.95,0.1],[0.98,0.32],[0.98,1.2],[0.82,1.38],[0.75,1.4]],{alpha:.55}),
        L([[0.02,0.1],[0.9,0.16],[0.9,0.95]],{col:'#eef3f6',alpha:.8,edge:null,flat:true,cull:true}),
        D([0,0.95,0],[0,1,0],0.88,'#f6f9fa',{flat:true}),
        LN([0,1.3,0],[0,1.72,0],0.05,'#e8e0cc')
      ]));
      parts.push(B.PT('铂丝',[
        LN([2.2,1.7,0.4],[1.1,2.1,0.2],0.035,'#dfe6ec'),
        LN([1.1,2.1,0.2],[0.16,2.05,0],0.035,'#dfe6ec'),
        LN([0.16,2.05,0],[0.05,1.95,0],0.03,'#dfe6ec')
      ]));
      return B.fin(parts);
    })();
    fitModel();
    E3.cam.dist*=0.82; /* 拉近镜头：聚焦火焰区 */
  },
  flame(e,dt){
    const st=e.st;
    const map=['','#f3c518','#e8663d','#3ecf6a','#b06ae8'];
    const inner=['','#fff3c0','#ffd9c0','#d0ffd9','#e9d8ff'];
    let idx=e.step;
    if(idx===2&&e.stepT>=2)idx=3; /* 步骤3内：先钙（砖红）后铜（绿）分段演示 */
    if(idx===3)idx=4; /* 钾焰（透过钴玻璃） */
    st.ele=map[idx]||'';
    st.inner=inner[idx]||'';
    st.glowT+=dt;
    if(e.step>0){
      const rate=idx===4?18:16;
      if(Math.random()<dt*rate)st.particles.push({x:(Math.random()-.5)*.26,y:1.85+Math.random()*.25,z:(Math.random()-.5)*.26,r:0.05+Math.random()*.07,vy:0.45+Math.random()*.55});
      if(Math.random()<dt*4)st.sparks.push({x:(Math.random()-.5)*.18,y:2.0,z:(Math.random()-.5)*.18,r:0.035+Math.random()*.025,vy:0.9+Math.random()*.6,life:0.5+Math.random()*0.3});
    }
    st.particles.forEach(p=>{p.y+=p.vy*dt;p.vy*=0.985;p.r+=dt*0.009;p.x+=Math.sin(p.y*6+st.glowT*3)*dt*0.12;});
    st.particles=st.particles.filter(p=>p.y<2.85);
    st.sparks.forEach(s=>{s.y+=s.vy*dt;s.life-=dt;s.x+=Math.sin(s.y*10)*dt*0.06;});
    st.sparks=st.sparks.filter(s=>s.life>0);
  },
  flameExtra(e){
    const st=e.st,ex=[];
    const col=st.ele||'#ffd23d';
    const inner=st.inner||'#fff2b8';
    /* 火焰本体（外层元素色 + 内芯亮色） */
    ex.push(L([[0.02,1.72],[0.15,1.8],[0.24,2.05],[0.19,2.4],[0.09,2.66],[0.02,2.76]],{col:col,alpha:e.step===0?0.6:0.82,edge:null,flat:true,cull:true}));
    ex.push(L([[0.02,1.72],[0.09,1.79],[0.13,1.95],[0.09,2.15],[0.04,2.3],[0.02,2.34]],{col:inner,alpha:.85,edge:null,flat:true,cull:true}));
    if(e.step>0){
      /* 火光光晕（元素色光染，照亮周边环境） */
      ex.push({t:'glow',c:[0,2.1,0],r:1.5,col:hexGlow(col,0.34)});
      ex.push({t:'glow',c:[0,2.15,0],r:1.05,col:hexGlow(col,0.30)});
      ex.push({t:'glow',c:[0,2.0,0],r:0.5,col:hexGlow(inner,0.35)});
      /* 粒子火舌（柔光团主体 + 内芯亮点，随高度横向摇曳） */
      st.particles.forEach(p=>{
        ex.push({t:'glow',c:[p.x,p.y,p.z],r:p.r*7.5,col:hexGlow(col,0.5)});
        if(p.r>0.08)ex.push(S([p.x,p.y,p.z],p.r*0.55,inner,{glow:true}));
      });
      /* 飞溅火星（细长亮线段 + 微光晕） */
      st.sparks.forEach(s=>{
        ex.push(LN([s.x,s.y-s.r*2.2,s.z],[s.x,s.y+s.r*2.2,s.z],s.r*0.9,'#fff8e0'));
        ex.push({t:'glow',c:[s.x,s.y,s.z],r:s.r*4,col:'rgba(255,250,220,.5)'});
      });
      /* 铂丝尖端灼热 */
      ex.push(S([0.05,1.95,0],0.045,inner,{glow:true}));
    }
    if(e.step===3){ /* 蓝色钴玻璃：滤去钠的黄光干扰 */
      ex.push(F([[1.15,1.6,-0.75],[1.15,1.6,0.75],[1.15,3.1,0.75],[1.15,3.1,-0.75]],'#2e63c9',{alpha:.42,edge:'#24509e'}));
      ex.push({t:'glow',c:[0,2.15,0],r:1.15,col:'rgba(160,120,235,.30)'});
    }
    return ex;
  },
  /* ===== 事故演练（灵感②：错误操作后果 + 正确处置） ===== */
  setupDrill(e){
    if(e.item.drill==='na')SIM.setupDrillNa(e);
    else SIM.setupDrillH2so4(e);
  },
  setupDrillNa(e){
    e.st={flames:[],drops:[],sands:[],boom:0,booming:false,out:0,droped:false,sanded:false};
    VW.model=(function(){
      const parts=[];
      parts.push(B.PT('燃烧的钠块（台面）',B.BOX(0,0.11,0,0.52,0.22,0.52,'#e8edf4',{edge:'#9fb0c0'})));
      parts.push(B.PT('煤油瓶（旁置）',[
        B.L([[0.02,0],[0.52,0.02],[0.6,0.1],[0.62,0.32],[0.62,1.05],[0.5,1.12],[0.42,1.14]],{col:B.M.brown,alpha:.9,edge:B.M.brownEdge,off:[1.9,0,0.2]}),
        B.D([1.9,1.02,0.2],[0,1,0],0.6,'#5e431f',{flat:true})
      ]));
      parts.push(B.PT('沙土桶（左侧待用）',B.BOX(-1.7,0.35,0.3,0.66,0.7,0.66,'#a9855a',{edge:'#7a5f3d'})));
      return B.fin(parts);
    })();
    VW.expPitch=-0.38;
    fitModel();
    E3.cam.dist*=0.78;
  },
  setupDrillH2so4(e){
    e.st={splash:[],stream:[],mist:[],warn:0,boiled:false,done2:0,poured:false,streaming:false,streamT:0};
    VW.model=(function(){
      const parts=[];
      parts.push(B.PT('烧杯（盛水 1/3）',[
        B.L([[0.02,0],[0.75,0.02],[0.92,0.1],[0.95,0.3],[0.95,1.5],[1.02,1.56],[1.02,1.66],[0.95,1.68]],{alpha:.5}),
        B.L([[0.02,0.12],[0.8,0.18],[0.82,0.4],[0.82,0.52]],{col:'#d9ecf4',alpha:.72,edge:null,flat:true,cull:true}),
        B.D([0,0.52,0],[0,1,0],0.82,'#e0f0f7',{flat:true,alpha:.6})
      ]));
      parts.push(B.PT('量筒（浓硫酸）',[
        B.L([[0.02,0],[0.3,0.02],[0.34,0.08],[0.34,1.6],[0.4,1.63],[0.4,1.7],[0.34,1.72]],{alpha:.5,off:[1.9,0,0.3]}),
        B.L([[0.02,0.06],[0.27,0.1],[0.28,0.5],[0.28,1.1]],{col:'#e8d9a8',alpha:.85,edge:null,flat:true,cull:true,off:[1.9,0,0.3]}),
        B.D([1.9,1.1,0.3],[0,1,0],0.27,'#ecdfb4',{flat:true})
      ]));
      parts.push(B.PT('玻璃棒（待用）',[
        B.LN([0.55,2.05,0.15],[0.1,1.0,0.05],0.045,'#dfe6ec')
      ]));
      return B.fin(parts);
    })();
    VW.expPitch=-0.34;
    fitModel();
    E3.cam.dist*=0.78;
  },
  drill(e,dt){
    const st=e.st;
    if(e.item.drill==='na'){
      if(e.step<2||st.boom>0||(e.step===2&&!st.out)){ /* 步骤2未窒息前火持续燃烧（渐弱），救学逻辑：覆盖→窒息→熄灭 */
        const wk=e.step===2?0.55:1;
        if(Math.random()<dt*4*wk)st.flames.push({x:(Math.random()-.5)*.4,y:0.35,z:(Math.random()-.5)*.4,r:(0.09+Math.random()*.1)*wk,vy:(0.6+Math.random()*.5)*wk,life:0.7+Math.random()*.4});
      }
      if(st.boom>0)st.boom-=dt;
      if(e.step===1){
        if(!st.droped){
          st.droped=true;
          for(let i=0;i<5;i++)st.drops.push({y:2.6-i*0.28,vy:0,delay:i*0.16});
        }
        st.drops.forEach(d=>{if(d.delay>0){d.delay-=dt;return;}d.vy+=dt*3;d.y-=d.vy*dt;});
        st.drops=st.drops.filter(d=>{
          if(d.y<=0.35){
            if(!st.booming){st.booming=true;st.boom=1.8;}
            return false;
          }
          return true;
        });
        if(st.booming&&st.boom>0&&Math.random()<dt*26)st.flames.push({x:(Math.random()-.5)*1.3,y:0.4+Math.random()*1.2,z:(Math.random()-.5)*1.3,r:0.14+Math.random()*.16,vy:1.2+Math.random()*.9,life:0.8+Math.random()*.5});
      }
      if(e.step===2){
        if(!st.sanded){st.sanded=true;st.pile=[];st.piled=0;for(let i=0;i<30;i++)st.sands.push({x:(Math.random()-.5)*.9,y:2.4+Math.random()*.9,z:(Math.random()-.5)*.9,vy:0,r:0.07+Math.random()*.06,delay:Math.random()*1.1});}
        st.sands.forEach(s=>{if(s.delay>0){s.delay-=dt;return;}s.vy+=dt*2.6;s.y-=s.vy*dt;});
        st.sands=st.sands.filter(s=>{
          if(s.y<=0.2){ /* 落地留底：钠块上堆成沙丘、台面散落，直观呈现"覆盖" */
            if(st.pile.length<56){
              const on=Math.abs(s.x)<0.34&&Math.abs(s.z)<0.34;
              if(on)st.piled++;
              const h=on?0.2+Math.min(0.26,st.piled*0.009):0.04;
              st.pile.push({x:s.x,y:h+s.r*0.4,z:s.z,r:s.r});
            }
            return false;
          }
          return true;
        });
        if(e.stepT>2.2)st.out=1;
      }
      st.flames.forEach(f=>{f.y+=f.vy*dt;f.life-=dt*(e.step===2?(st.out?2.6:0.55):0.5);f.r+=dt*0.02;}); /* 窒息前慢衰减、窒息后快速熄灭 */
      st.flames=st.flames.filter(f=>f.life>0);
    }else{
      if(e.step===1&&!st.boiled&&e.stepT>0.9){
        st.boiled=true;
        for(let i=0;i<30;i++)st.splash.push({x:1.9+(Math.random()-.5)*.3,y:1.15,z:0.3+(Math.random()-.5)*.3,vx:(Math.random()-.5)*2.4,vy:1.6+Math.random()*1.6,vz:(Math.random()-.5)*2.4,r:0.05+Math.random()*.06});
        st.warn=2.2;
      }
      if(e.step===2){
        st.streaming=true;st.streamT+=dt;
        st.stream=[];
        for(let i=0;i<8;i++){
          const k=(st.streamT*1.6+i*0.14)%1;
          if(k<0.9){
            const sy=1.9-k*1.3;
            const sx=0.55-0.45*(sy-0.6)/1.3;
            st.stream.push({x:sx,y:sy,r:0.045});
          }
        }
        if(Math.random()<dt*3)st.mist.push({x:(Math.random()-.5)*.3,y:0.62,z:(Math.random()-.5)*.3,r:0.06+Math.random()*.05,a:0.3});
        if(e.stepT>2.6)st.done2=1;
      }
      st.splash.forEach(p=>{p.vy-=dt*3.2;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;});
      st.splash=st.splash.filter(p=>p.y>0.05);
      if(st.warn>0)st.warn-=dt;
      st.mist.forEach(m=>{m.y+=dt*0.25;m.r+=dt*0.12;m.a-=dt*0.08;});
      st.mist=st.mist.filter(m=>m.a>0.02);
    }
  },
  drillExtra(e){
    const st=e.st,ex=[];
    if(e.item.drill==='na'){
      st.flames.forEach(f=>{
        ex.push({t:'glow',c:[f.x,f.y,f.z],r:f.r*4,col:'rgba(255,150,50,.42)'});
        ex.push(B.S([f.x,f.y,f.z],f.r,'#ff9d3c',{glow:true}));
        ex.push(B.S([f.x,f.y+f.r*0.5,f.z],f.r*0.55,'#ffe08a',{glow:true}));
      });
      st.drops.forEach(d=>{if(d.delay<=0)ex.push(B.S([0,d.y,0],0.07,'#8fd0f2',{glow:true}));});
      st.sands.forEach(s=>ex.push(B.S([s.x,s.y,s.z],s.r,'#b5967a')));
      (st.pile||[]).forEach(p=>{
        const on=Math.abs(p.x)<0.34&&Math.abs(p.z)<0.34;
        ex.push(B.S([p.x,p.y,p.z],p.r*1.55,'#a9855a',{zBias:on?0.85:0.3})); /* 高y更远：zBias 前移避免被钠块顶面盖住 */
      });
      if(st.out){ /* 窒息后：整体沙丘掩埋钠块，处置结果一目了然 */
        ex.push(B.S([0,0.46,0],0.36,'#a9855a',{zBias:1.15}));
        ex.push(B.S([-0.24,0.34,0.1],0.24,'#a9855a',{zBias:1.05}));
        ex.push(B.S([0.24,0.34,-0.1],0.24,'#a9855a',{zBias:1.05}));
        ex.push(B.S([0.14,0.32,0.2],0.19,'#9c7748',{zBias:1.02}));
        ex.push(B.S([-0.14,0.32,-0.2],0.19,'#9c7748',{zBias:1.02}));
      }
      if(st.booming&&e.step===1){
        ex.push({t:'glow',c:[0,0.8,0],r:2.2,col:'rgba(220,45,45,'+(0.22*Math.min(1,Math.max(0,st.boom))).toFixed(2)+')'});
        ex.push(B.F([[-1.05,1.35,0],[1.05,1.35,0],[1.05,1.78,0],[-1.05,1.78,0]],'#e8564f',{flat:true,txt:'氢气爆燃 · 危险！',textCol:'#ffffff',txtScale:0.5,zBias:4,edge:'#a83832',lw:1.5}));
      }
      if(e.step===2&&!st.out)ex.push(B.F([[-1.05,1.3,0],[1.05,1.3,0],[1.05,1.72,0],[-1.05,1.72,0]],'#2a8f6f',{flat:true,txt:'沙土覆盖中…',textCol:'#ffffff',txtScale:0.45,zBias:4,edge:'#1d6b52',lw:1.5}));
      if(st.out)ex.push(B.F([[-1.05,1.3,0],[1.05,1.3,0],[1.05,1.72,0],[-1.05,1.72,0]],'#34c98e',{flat:true,txt:'窒息熄灭 √',textCol:'#ffffff',txtScale:0.5,zBias:4,edge:'#1d8a5f',lw:1.5}));
    }else{
      st.splash.forEach(p=>ex.push(B.S([p.x,p.y,p.z],p.r,'#e8d9a8',{glow:true})));
      (st.stream||[]).forEach(s=>ex.push(B.S([s.x,s.y,0.08],s.r,'#e8d9a8',{glow:true})));
      st.mist.forEach(m=>ex.push({t:'glow',c:[m.x,m.y,m.z],r:m.r*4,col:'rgba(220,228,238,'+m.a.toFixed(2)+')'}));
      if(e.step===1&&e.stepT<0.9)ex.push(B.F([[0.2,1.78,0.3],[3.6,1.78,0.3],[3.6,2.18,0.3],[0.2,2.18,0.3]],'#c99234',{flat:true,txt:'错误：把水倒入浓硫酸！',textCol:'#ffffff',txtScale:0.4,zBias:4,edge:'#8f6a22',lw:1.5}));
      if(st.warn>0){
        ex.push({t:'glow',c:[1.0,1.1,0.3],r:2.4,col:'rgba(220,45,45,'+(0.2*Math.min(1,st.warn/2)).toFixed(2)+')'});
        ex.push(B.F([[0.2,1.78,0.3],[3.6,1.78,0.3],[3.6,2.18,0.3],[0.2,2.18,0.3]],'#e8564f',{flat:true,txt:'暴沸飞溅 · 危险！',textCol:'#ffffff',txtScale:0.4,zBias:4,edge:'#a83832',lw:1.5}));
      }
      if(e.step===2&&!st.done2)ex.push(B.F([[-1.35,1.82,0],[1.35,1.82,0],[1.35,2.24,0],[-1.35,2.24,0]],'#2a8f6f',{flat:true,txt:'浓硫酸沿玻璃棒缓缓注入…',textCol:'#ffffff',txtScale:0.42,zBias:4,edge:'#1d6b52',lw:1.5}));
      if(st.done2)ex.push(B.F([[-1.35,1.82,0],[1.35,1.82,0],[1.35,2.24,0],[-1.35,2.24,0]],'#34c98e',{flat:true,txt:'酸入水 · 安全 √',textCol:'#ffffff',txtScale:0.5,zBias:4,edge:'#1d8a5f',lw:1.5}));
    }
    return ex;
  },
  /* ===== 装配挑战（灵感①：点击选择零件 · 顺序判定 · 实时纠错） ===== */
  setupAsm(e){
    const groups=[],parts=[];
    const flat=ss=>{const o=[];ss.forEach(s=>Array.isArray(s)?o.push(...s):o.push(s));return o;}; /* B.BOX 返回 FACE 数组：展平后才能被渲染器识别 */
    const add=(name,shapes)=>{const fs=flat(shapes);groups.push([parts.length,parts.length-0]);parts.push(B.PT(name,fs));groups[groups.length-1]=[parts.length-1,parts.length-1];};
    if(e.item.asm==='gas'){
      /* 固液制气：锥形瓶 + 长颈漏斗（插瓶口 x0） + 弯管导管（塞孔 x0.18 引出） + 集气瓶 */
      add('锥形瓶',[
        B.L([[0.02,0],[0.6,0.02],[0.8,0.14],[0.85,0.4],[0.85,0.6],[0.3,1.6],[0.3,1.95],[0.37,1.97],[0.37,2.1],[0.3,2.12]],{alpha:.5}),
        B.L([[0.02,0.1],[0.74,0.18],[0.78,0.42],[0.78,0.62],[0.4,1.3],[0.08,1.35],[0.02,1.0]],{col:'#d9ecf4',alpha:.7,edge:null,flat:true,cull:true})
      ]);
      add('长颈漏斗',[
        B.L([[0.02,2.98],[0.12,3.0],[0.52,3.14],[0.55,3.34]],{alpha:.55}), /* 平滑锥形喇叭：无台阶无翻边，长颈漏斗标准形 */
        B.L([[0.02,0.5],[0.1,0.55],[0.11,0.7],[0.11,2.96],[0.12,2.98]],{alpha:.55}) /* 长颈直插到近瓶底：下端没入液面形成液封 */
      ]);
      add('弯管导管',[
        B.TUBE([0.18,2.15,0],[0.18,2.62,0],0.09,{alpha:.5}),
        B.TUBE([0.18,2.62,0],[1.6,2.62,0],0.09,{alpha:.5}),
        B.TUBE([1.6,2.62,0],[2.5,1.35,0],0.09,{alpha:.5}),
        B.TUBE([2.5,1.35,0],[2.35,0.4,0],0.075,{alpha:.5}), /* 向上排空气法：导管沿瓶口左侧伸入瓶内下部 */
        B.S([0.18,2.62,0],0.115,'#e6f2f8'), /* 弯头节点：让"上→水平→斜下→入瓶"四段走向清晰可辨 */
        B.S([1.6,2.62,0],0.115,'#e6f2f8'),
        B.S([2.5,1.35,0],0.105,'#e6f2f8')
      ]);
      add('集气瓶',[
        B.L([[0.02,0],[0.55,0.02],[0.62,0.1],[0.64,0.3],[0.64,1.05],[0.7,1.1],[0.7,1.2],[0.64,1.22]],{alpha:.5,off:[2.7,0,0]}),
        B.BOX(2.7,0.04,0,1.05,0.08,1.05,'#e8f4f8',{edge:'#b9d3e0'}), /* 外凸底座：集气瓶标准形态 */
        B.F([[3.3,0.05,0.52],[4.26,0.05,0.52],[4.26,1.07,0.52],[3.3,1.07,0.52]],'#f4fafd',{flat:true,edge:'#8fb8cf',lw:1}) /* 磨口玻璃片侧立瓶旁：纯白平面示意，收集满 CO₂ 后取下盖口 */
      ]);
    }else{
      /* 蒸馏：圆底烧瓶+支管 → 温度计 → 冷凝管（斜置） → 接收锥形瓶 */
      add('圆底烧瓶',[
        B.L([[0.02,0],[0.4,0.02],[0.55,0.15],[0.6,0.6],[0.45,1.0],[0.22,1.15],[0.22,1.7],[0.3,1.72],[0.3,1.84],[0.22,1.86]],{alpha:.5}),
        B.TUBE([0.26,1.55,0],[1.0,1.95,0],0.1,{alpha:.5})
      ]);
      add('温度计',[
        B.LN([0,2.05,0],[0,1.5,0],0.05,'#dfe6ec'),
        B.S([0,1.5,0],0.07,'#cf5050')
      ]);
      add('直形冷凝管',[
        B.TUBE([1.0,1.95,0],[2.6,1.0,0],0.09,{alpha:.5}),
        B.TUBE([1.18,1.9,0],[2.42,1.06,0],0.21,{alpha:.3}),
        B.TUBE([1.45,1.75,0.2],[1.45,2.15,0.2],0.06,{alpha:.5}),
        B.TUBE([2.15,1.2,-0.2],[2.15,0.8,-0.2],0.06,{alpha:.5})
      ]);
      add('锥形瓶',[
        B.L([[0.02,0],[0.45,0.02],[0.6,0.12],[0.65,0.35],[0.65,0.5],[0.25,1.0],[0.25,1.2],[0.32,1.22],[0.32,1.32],[0.25,1.34]],{alpha:.5,off:[2.6,0,0]}),
        B.TUBE([2.6,1.0,0],[2.6,0.55,0],0.09,{alpha:.5})
      ]);
    }
    VW.model=B.fin(parts);
    VW.asm={groups:groups,placed:0};
    VW.expPitch=-0.32; /* 微俯视：横向长装置（锥形瓶→集气瓶）四部件互不遮挡、气路全程可见 */
    fitModel(); /* 装置跨度大（x0~3.4）：不再拉近镜头，保证弯管与集气瓶完整可见 */
  },
  asmToast(msg){ /* toast 函数在 UI 块 IIFE 内部，跨块不可见（window.toast 是 DOM 元素）——装配块内联提示 */
    const t=document.getElementById('toast');
    if(!t)return;
    t.textContent=msg;t.classList.add('show');
    clearTimeout(this._asmToastT);
    this._asmToastT=setTimeout(()=>t.classList.remove('show'),2400);
  },
  asmPick(e,i){
    if(e.done)return;
    if(i===e.step){
      e.step++;
      VW.asm.placed=e.step;
      if(e.step>=e.item.asmParts.length){
        e.done=true;
        SIM.onDone&&SIM.onDone(e);
        SIM.asmToast('装配完成 √ 装置就绪');
      }else SIM.asmToast('正确：'+e.item.asmParts[i]+' 已就位');
      SIM.panel();needsDraw=true;
    }else{
      const why=e.item.asmWhy?e.item.asmWhy[i]:'装配原则：先下后上、先主后辅';
      SIM.asmToast('顺序不对：'+why);
    }
  },
  /* ---------- 通用 ---------- */
  update(e,dt){
    if(!e.playing||e.manual)return;
    const sp=e.speed||1;
    e.stepT+=dt*sp;
    const durs=SIM.durations(e.item);
    if(e.stepT>=durs[e.step]){
      e.stepT=0;
      if(e.step<durs.length-1)e.step++;
      else{e.playing=false;e.done=true;SIM.onDone&&SIM.onDone(e);}
      SIM.panel();
    }
    if(e.item.sim==='na')SIM.na(e,dt*sp);
    else if(e.item.sim==='tit')SIM.tit(e,dt*sp);
    else if(e.item.sim==='flame')SIM.flame(e,dt*sp);
    else if(e.item.sim==='drill')SIM.drill(e,dt*sp);
    VW.extra=SIM.extra(e);
    SIM.syncSeek(e);
  },
  total(e){const d=SIM.durations(e.item);return d.reduce((s,v)=>s+v,0);},
  pos(e){let t=0;for(let i=0;i<e.step;i++)t+=SIM.durations(e.item)[i];return t+e.stepT;},
  /* 回放：拖动时间轴 → 跳到任意时刻（随机粒子重置，确定性状态按 stepT 恢复） */
  seek(t){
    const e=VW.exp;if(!e)return;
    const durs=SIM.durations(e.item);
    const total=SIM.total(e);
    t=Math.max(0,Math.min(total-0.01,t));
    let acc=0,step=durs.length-1,stepT=durs[durs.length-1];
    for(let i=0;i<durs.length;i++){
      if(t<acc+durs[i]){step=i;stepT=t-acc;break;}
      acc+=durs[i];
    }
    e.step=step;e.stepT=stepT;e.done=false;
    if(e.item.sim==='na'){
      e.st.bubbles=[];e.st.ripples=[];e.st.mist=[];e.st.flames=[];
      if(e.st.na){e.st.na.x=step>=3?0.2:-1.9;e.st.na.z=0;}
      if(step>=3){e.st.redR=Math.min(1.48,Math.max(0,stepT>0.6?stepT-0.6:0)*0.9);e.st.redA=Math.min(0.8,(e.st.redR/1.48)*0.78);}
      else{e.st.redR=0;e.st.redA=0;}
    }
    if(e.item.sim==='flame'){e.st.particles=[];e.st.sparks=[];}
    if(e.item.sim==='tit'){e.st.drops=[];e.st.swirls=[];e.st.splashes=[];}
    if(e.item.sim==='tit')SIM.tit(e,0);
    SIM.panel();SIM.extra(e);needsDraw=true;
  },
  syncSeek(e){ /* 播放中同步滑块位置（不重建 DOM） */
    const sk=$('expSeek');if(!sk)return;
    sk.value=Math.round(SIM.pos(e)/SIM.total(e)*1000);
    const tl=$('expSeekTxt');if(tl)tl.textContent=SIM.pos(e).toFixed(1)+'s / '+SIM.total(e).toFixed(0)+'s';
  },
  extra(e){
    VW.extra=[];
    if(e.item.sim==='na')VW.extra=SIM.naExtra(e);
    else if(e.item.sim==='tit')VW.extra=SIM.titExtra(e);
    else if(e.item.sim==='flame')VW.extra=SIM.flameExtra(e);
    else if(e.item.sim==='drill')VW.extra=SIM.drillExtra(e);
    return VW.extra;
  },
  togglePlay(){
    const e=VW.exp;if(!e)return;
    if(e.done)SIM.reset();
    e.playing=!e.playing;
    SIM.panel();
  },
  goStep(i){
    const e=VW.exp;if(!e)return;
    const durs=SIM.durations(e.item);
    e.step=Math.max(0,Math.min(durs.length-1,i));
    e.stepT=0;e.done=false;e.playing=true;
    if(e.item.sim==='na'){e.st.bubbles=[];}
    if(e.item.sim==='flame'){e.st.particles=[];}
    SIM.panel();
  },
  reset(){
    const e=VW.exp;if(!e)return;
    e.step=0;e.stepT=0;e.done=false;e.playing=false;e.manual=false;
    SIM.setup(e.item,e);
    VW.extra=[];
    SIM.panel();needsDraw=true;
  },
  panel(){
    const e=VW.exp;if(!e)return;
    if(e.item.id==='tit'&&window.ChemTitration?.isManual()){window.ChemTitration.render();return;}
    const p=$('expPanel');
    const durs=SIM.durations(e.item);
    const steps=e.item.steps;
    if(e.item.asm){ /* 装配挑战面板：零件选择 + 顺序判定 */
      let asmBtns='';
      e.item.asmParts.forEach((nm,i)=>{
        asmBtns+='<button data-asm="'+i+'" class="'+(i<e.step?'ok':'')+'">'+(i<e.step?'✓ ':'')+nm+'</button>';
      });
      p.innerHTML='<h4>'+e.item.name+' · 已装 '+e.step+'/'+e.item.asmParts.length+'</h4>'+
        '<div class="exp-steps">'+steps.map((s,i)=>'<div class="st'+(i<e.step?' done':i===e.step?' cur':'')+'"></div>').join('')+'</div>'+
        '<div class="step-txt">'+(e.done?'🎉 装置装配完成！可拖拽旋转检查整体，或在详情面板生成实验报告。':'装配提示：'+steps[e.step].txt)+'</div>'+
        (e.done?'':'<div class="asm-list">'+asmBtns+'</div>')+
        '<div class="exp-ctrl"><button data-act="rst">重新装配</button></div>';
      p.classList.add('show');
      p.querySelectorAll('button[data-asm]').forEach(b=>{
        b.addEventListener('click',()=>SIM.asmPick(e,parseInt(b.getAttribute('data-asm'),10)));
      });
      const rst=p.querySelector('button[data-act="rst"]');
      if(rst)rst.addEventListener('click',()=>SIM.reset());
      return;
    }
    const durs2=SIM.durations(e.item);
    let bars='';
    steps.forEach((s,i)=>{bars+='<div class="st'+(i<e.step?' done':i===e.step?(e.playing||e.done?' cur':' cur'):'')+'"></div>';});
    const pos=SIM.pos(e),tot=SIM.total(e);
    const speeds=[[0.25,'0.25×'],[0.5,'0.5×'],[1,'1×'],[2,'2×']];
    p.innerHTML='<h4>'+e.item.name+' · 步骤 '+(e.step+1)+'/'+steps.length+'</h4>'+
      '<div class="exp-steps">'+bars+'</div>'+
      '<div class="step-txt">'+steps[e.step].t+'：'+steps[e.step].txt+'</div>'+
      '<div class="exp-prog"><input type="range" id="expSeek" min="0" max="1000" value="'+Math.round(pos/tot*1000)+'" aria-label="实验回放进度"><span id="expSeekTxt">'+pos.toFixed(1)+'s / '+tot.toFixed(0)+'s</span></div>'+
      '<div class="exp-ctrl">'+
      '<button data-act="rst">重置</button>'+
      '<button data-act="prev">上一步</button>'+
      '<button class="primary" data-act="play">'+(e.playing?'暂停':'播放')+'</button>'+
      '<button data-act="next">下一步</button></div>'+
      '<div class="exp-speed">'+speeds.map(s=>'<button data-sp="'+s[0]+'" class="'+((e.speed||1)===s[0]?'on':'')+'">'+s[1]+'</button>').join('')+'<span class="sp-l">分步观察现象；静态讲解不含反应动画</span></div>';
    p.classList.add('show');
    p.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click',()=>{
        const a=b.getAttribute('data-act');
        if(a==='play')SIM.togglePlay();
        else if(a==='prev')SIM.goStep(e.step-1);
        else if(a==='next')SIM.goStep(e.step+1);
        else if(a==='rst')SIM.reset();
      });
    });
    const sk=$('expSeek');
    if(sk)sk.addEventListener('input',()=>{
      if(e.playing)e.playing=false; /* 拖动时暂停，便于精确定位 */
      SIM.seek(sk.value/1000*SIM.total(e));
    });
    p.querySelectorAll('.exp-speed button').forEach(b=>{
      b.addEventListener('click',()=>{e.speed=parseFloat(b.getAttribute('data-sp'));SIM.panel();});
    });
  }
};
window.SIM=SIM;
window.needsDraw=function(){needsDraw=true;};
window.fitModel=fitModel;window.resetView=resetView;window.resizeCv=resize;
/* 实验完成度记录（灵感⑦：学习环中的"观察"环节） */
SIM.onDone=function(e){
  if(e.item&&e.item.id){
    const done=store2.get('expdone',{});
    done[e.item.id]=Date.now();
    store2.set('expdone',done);
  }
};
/* localStorage 简易封装（SIM 块内独立于 UI 块的 store） */
function store2get(k,d){try{const v=localStorage.getItem('chem3d_'+k);return v!==null?JSON.parse(v):d;}catch(e){return d;}}
var store2={get:store2get,set:function(k,v){try{localStorage.setItem('chem3d_'+k,JSON.stringify(v));}catch(e){}}};
})();
