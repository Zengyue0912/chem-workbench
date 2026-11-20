/* ============================================================================
 * 抽取自 index.html 内联 <script> #5（原行 2348–2751）。
 * 模型构建器 A：物品 + 玻璃仪器（window.B）
 * 工作流 1（性能与工程重构）：内容原样搬运，仅做加载方式改变。
 * 加载方式：按需懒加载（bundle: viewer3d，见 js/loader.js）
 * ========================================================================== */
(function(){'use strict';
window.B={};
const V=E3.v;
const M={ /* 材质库 */
  glass:'#c0e2f4', glassEdge:'#7fb5cf', brown:'#8a5a2b', brownEdge:'#5e3c1a',
  cap:'#93a7b4', capDark:'#5c6c78', rubber:'#3b3f45', metal:'#b8c4cc', metalDark:'#6e7d88',
  iron:'#5d6870', porcelain:'#f4f1ea', porcEdge:'#c9c2b4', flameOut:'#ff8c2e', flameIn:'#ffd23d',
  wood:'#b98d5e', paper:'#fdfdf8', paperEdge:'#d8d4c4', liquid:'#a8d4e8', water:'#bfe4f0',
  label:'#ffffff', labEdge:'#b9c6cf', textline:'#7b8891'
};
B.M=M;
/* ---- 小工具 ---- */
function L(prof,o){o=o||{};return {t:'lathe',prof:prof,seg:o.seg||64,col:o.col||M.glass,alpha:o.alpha,edge:o.edge!==undefined?o.edge:M.glassEdge,lw:o.lw,liquid:o.liquid,flat:o.flat,o:o.off,cull:o.cull};}
  function SPH(c,r,col,o){o=o||{};return {t:'sph',c:c,r:r,col:col,glow:o.glow,g:o.g,zBias:o.zBias};}
function LN(a,b,r,col,o){o=o||{};return {t:'line',a:a,b:b,r:r,col:col,colA:o.colA,colB:o.colB,gA:o.gA,gB:o.gB};}
function DISC(c,n,r,col,o){o=o||{};return {t:'disc',c:c,n:n,r:r,col:col,alpha:o.alpha,edge:o.edge,flat:o.flat,g:o.g};}
function FACE(vs,col,o){o=o||{};return {t:'face',vs:vs,col:col,alpha:o.alpha,edge:o.edge,lw:o.lw,flat:o.flat,txt:o.txt,textCol:o.textCol,zBias:o.zBias,txtScale:o.txtScale};}
function LBL(p,txt){return {t:'lbl',p:p,txt:txt};}
function PT(name,shapes,g){return {name:name,shapes:shapes,g:g};}
function finish(parts,opt){
  opt=opt||{};
  const box=E3.bbox({parts:parts});
  parts.forEach(pt=>{
    const pb=E3.bbox({parts:[pt]});
    pt.cen=pb.center;
    let d=V.sub(pb.center,box.center);
    if(V.len(d)<box.span*0.08)d=[0,1,0];
    pt.dir=V.norm(d);
  });
  return {parts:parts,center:box.center,span:box.span,box:box,auto:opt.auto!==false,fire:opt.fire};
}
/* 盒子（六面） */
function BOX(cx,cy,cz,w,h,d,col,o){
  o=o||{};
  const x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2,z0=cz-d/2,z1=cz+d/2;
  const f=[];
  f.push(FACE([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],col,{edge:o.edge}));
  f.push(FACE([[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]],col,{edge:o.edge}));
  f.push(FACE([[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]],shadeCol(col,.9),{edge:o.edge}));
  f.push(FACE([[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]],shadeCol(col,.82),{edge:o.edge}));
  f.push(FACE([[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]],shadeCol(col,1.08),{edge:o.edge}));
  f.push(FACE([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],shadeCol(col,.7),{edge:o.edge}));
  return f;
}
function shadeCol(hex,k){
  const c=hex.length===4?'#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]:hex;
  const r=Math.min(255,Math.round(parseInt(c.substr(1,2),16)*k)),g=Math.min(255,Math.round(parseInt(c.substr(3,2),16)*k)),b=Math.min(255,Math.round(parseInt(c.substr(5,2),16)*k));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
B.L=L;B.S=SPH;B.LN=LN;B.D=DISC;B.F=FACE;B.LB=LBL;B.PT=PT;B.fin=finish;B.BOX=BOX;
function TUBE(a,b,r,o){o=o||{};return {t:'tube',a:a,b:b,r:r,col:o.col||M.glass,alpha:o.alpha!==undefined?o.alpha:.45,edge:o.edge!==undefined?o.edge:M.glassEdge,seg:o.seg};}
function GLOW(c,r,col){return {t:'glow',c:c,r:r,col:col};}
B.TUBE=TUBE;B.GLOW=GLOW;
/* 瓶身标签（白底印刷：名称行 + 化学式行 + 液色色条 + 规格线；字号按投影实测校准） */
function labelFaces(z,y0,h,liq,txt,txt2){
  const w=0.9,x=0,zc=z+0.09;
  const fs=[];
  fs.push(FACE([[-w/2+x,y0,zc],[w/2+x,y0,zc],[w/2+x,y0+h,zc],[-w/2+x,y0+h,zc]],M.label,{edge:M.labEdge,lw:.8,zBias:3,flat:true}));
  fs.push(FACE([[-w/2+0.04+x,y0+h-0.12,zc+0.002],[w/2-0.04+x,y0+h-0.12,zc+0.002],[w/2-0.04+x,y0+h-0.025,zc+0.002],[-w/2+0.04+x,y0+h-0.025,zc+0.002]],liq,{flat:true,zBias:3.01}));
  fs.push(FACE([[-w/2+0.02+x,y0+h-0.4,zc+0.002],[w/2-0.02+x,y0+h-0.4,zc+0.002],[w/2-0.02+x,y0+h-0.15,zc+0.002],[-w/2+0.02+x,y0+h-0.15,zc+0.002]],M.label,{flat:true,zBias:3.02,txt:txt,textCol:'#22333b',txtScale:.2}));
  if(txt2)fs.push(FACE([[-w/2+0.02+x,y0+h-0.56,zc+0.002],[w/2-0.02+x,y0+h-0.56,zc+0.002],[w/2-0.02+x,y0+h-0.42,zc+0.002],[-w/2+0.02+x,y0+h-0.42,zc+0.002]],M.label,{flat:true,zBias:3.02,txt:txt2,textCol:'#41586b',txtScale:.13}));
  fs.push(FACE([[-w/2+0.08+x,y0+0.3,zc+0.002],[-0.02+x,y0+0.3,zc+0.002],[-0.02+x,y0+0.36,zc+0.002],[-w/2+0.08+x,y0+0.36,zc+0.002]],M.textline,{flat:true,zBias:3.02}));
  fs.push(FACE([[-w/2+0.08+x,y0+0.13,zc+0.002],[0.08+x,y0+0.13,zc+0.002],[0.08+x,y0+0.19,zc+0.002],[-w/2+0.08+x,y0+0.19,zc+0.002]],M.textline,{flat:true,zBias:3.02}));
  return fs;
}
/* ============ 化学物品模型 ============ */
B.subs={
  narrow(cfg){ /* 细口试剂瓶：磨口塞 + 液面弯月缘 + 竖向高光带 */
    cfg=cfg||{};
    const liq=cfg.liq||M.liquid, lv=cfg.level||0.58;
    const gl=cfg.glass==='brown'?{c:M.brown,e:M.brownEdge}:{c:M.glass,e:M.glassEdge};
    const parts=[];
    const prof=[[0.02,0],[0.95,0.02],[1.12,0.16],[1.18,0.5],[1.18,1.95],[0.98,2.28],[0.42,2.52],[0.42,3.12],[0.5,3.14],[0.5,3.28],[0.42,3.3]];
    parts.push(PT('瓶身',[L(prof,{col:gl.c,edge:gl.e,alpha:.58})]));
    const lh=0.12+lv*(1.95-0.12);
    parts.push(PT('液体',[
      L([[0.02,0.12],[1.06,0.15],[1.1,0.5],[1.1,lh]],{col:liq,alpha:.9,edge:null,liquid:true,flat:true}),
      DISC([0,lh,0],[0,1,0],1.075,shadeCol(liq,1.22),{flat:true}), /* 弯月缘亮环 */
      DISC([0,lh-0.004,0],[0,1,0],0.92,liq,{flat:true}), /* 液面主体 */
      DISC([0,lh-0.012,0],[0,1,0],0.46,shadeCol(liq,.9),{flat:true}) /* 中心微凹变暗 */
    ]));
    parts.push(PT('磨口瓶塞',[
      L([[0.02,3.02],[0.29,3.04],[0.29,3.27]],{col:gl.c,edge:gl.e,alpha:.75}), /* 插入瓶颈的玻璃塞芯 */
      L([[0.3,3.28],[0.34,3.3],[0.34,3.34],[0.56,3.36],[0.58,3.4],[0.58,3.44],[0.54,3.46],[0.54,3.5],[0.58,3.52],[0.58,3.66],[0.5,3.68],[0.44,3.7],[0.02,3.7]],{col:cfg.cap||M.cap,edge:M.capDark,flat:true}) /* 带棱纹的塞帽 */
    ]));
    parts.push(PT('瓶身高光',[
      FACE([[-0.62,0.35,1.16],[-0.46,0.35,1.16],[-0.46,1.85,1.16],[-0.62,1.85,1.16]],'#ffffff',{flat:true,zBias:2.5,alpha:.32}),
      FACE([[0.52,0.5,1.16],[0.58,0.5,1.16],[0.58,1.7,1.16],[0.52,1.7,1.16]],'#ffffff',{flat:true,zBias:2.5,alpha:.13})
    ]));
    if(cfg.ring)parts.push(PT('警示环',[L([[1.185,1.7],[1.185,2.0]],{col:cfg.ring,edge:shadeCol(cfg.ring,.7),flat:true})]));
    parts.push(PT('标签',labelFaces(1.185,0.42,0.92,liq,cfg.txt,cfg.txt2)));
    return finish(parts);
  },
  wide(cfg){ /* 广口瓶：磨口塞 + 平滑粉末面 + 晶体点缀 + 高光 */
    cfg=cfg||{};
    const sol=cfg.solid||'#f5f7fa';
    const gl=cfg.glass==='brown'?{c:M.brown,e:M.brownEdge}:{c:M.glass,e:M.glassEdge};
    const parts=[];
    const prof=[[0.02,0],[0.95,0.02],[1.1,0.14],[1.12,0.4],[1.12,1.5],[1.0,1.62],[0.82,1.72],[0.82,2.0],[0.9,2.02],[0.9,2.14],[0.82,2.16]];
    parts.push(PT('瓶身',[L(prof,{col:gl.c,edge:gl.e,alpha:.58})]));
    const lv=cfg.level||0.45;
    const ph=0.35+lv*0.9;
    parts.push(PT('固体试剂',[
      L([[0.02,0.1],[1.0,0.12],[1.02,0.35],[1.02,ph]],{col:sol,alpha:.95,edge:shadeCol(sol,.8),flat:true,cull:true}),
      DISC([0,ph,0],[0,1,0],1.0,shadeCol(sol,1.06),{flat:true}), /* 平滑堆面 */
      SPH([0.4,ph+0.06,0.28],0.085,sol),SPH([-0.35,ph+0.05,-0.24],0.075,sol),SPH([0.05,ph+0.05,-0.42],0.07,sol),SPH([-0.15,ph+0.07,0.35],0.065,shadeCol(sol,1.1)),SPH([0.5,ph+0.04,-0.1],0.06,sol) /* 表层晶体 */
    ]));
    parts.push(PT('磨口瓶塞',[
      L([[0.02,1.98],[0.78,1.98],[0.78,2.02]],{col:gl.c,edge:gl.e,alpha:.75}),
      L([[0.8,2.02],[0.9,2.04],[0.9,2.08],[1.08,2.1],[1.1,2.14],[1.1,2.18],[1.06,2.2],[1.06,2.24],[1.1,2.26],[1.1,2.4],[1.0,2.42],[0.94,2.44],[0.02,2.44]],{col:cfg.cap||M.cap,edge:M.capDark,flat:true})
    ]));
    parts.push(PT('瓶身高光',[
      FACE([[-0.6,0.3,1.1],[-0.44,0.3,1.1],[-0.44,1.35,1.1],[-0.6,1.35,1.1]],'#ffffff',{flat:true,zBias:2.5,alpha:.3}),
      FACE([[0.46,0.42,1.1],[0.52,0.42,1.1],[0.52,1.25,1.1],[0.46,1.25,1.1]],'#ffffff',{flat:true,zBias:2.5,alpha:.12})
    ]));
    if(cfg.ring)parts.push(PT('警示环',[L([[1.125,1.3],[1.125,1.6]],{col:cfg.ring,edge:shadeCol(cfg.ring,.7),flat:true})]));
    parts.push(PT('标签',labelFaces(1.125,0.3,0.8,sol,cfg.txt,cfg.txt2)));
    return finish(parts);
  },
  drop(cfg){ /* 滴瓶（指示剂） */
    cfg=cfg||{};
    const liq=cfg.liq||'#c9a0dc';
    const parts=[];
    const prof=[[0.02,0],[0.6,0.02],[0.75,0.12],[0.78,0.3],[0.78,1.35],[0.66,1.5],[0.38,1.6],[0.38,1.9],[0.44,1.92],[0.44,2.0],[0.38,2.02]];
    parts.push(PT('棕色滴瓶',[L(prof,{col:M.brown,edge:M.brownEdge,alpha:.62})]));
    const lh=0.12+(cfg.level||0.5)*1.2;
    parts.push(PT('试液',[
      L([[0.02,0.12],[0.72,0.16],[0.72,lh]],{col:liq,alpha:.9,edge:null,flat:true,cull:true}),
      DISC([0,lh,0],[0,1,0],0.7,shadeCol(liq,1.15),{flat:true})
    ]));
    parts.push(PT('胶帽',[L([[0.02,2.0],[0.5,2.0],[0.5,2.3],[0.34,2.62],[0.12,2.75],[0.02,2.78]],{col:M.rubber,edge:shadeCol(M.rubber,.6),flat:true})]));
    parts.push(PT('标签',labelFaces(0.785,0.28,0.72,liq,cfg.txt,cfg.txt2)));
    return finish(parts);
  },
  canister(cfg){ /* 储钠瓶（煤油中） */
    cfg=cfg||{};
    const parts=[];
    const prof=[[0.02,0],[0.9,0.02],[1.05,0.14],[1.08,0.4],[1.08,1.35],[0.95,1.5],[0.6,1.6],[0.6,1.88],[0.68,1.9],[0.68,2.0],[0.6,2.02]];
    parts.push(PT('棕色储钠瓶',[L(prof,{col:M.brown,edge:M.brownEdge,alpha:.62})]));
    parts.push(PT('煤油',[
      L([[0.02,0.12],[0.98,0.15],[1.0,0.4],[1.0,1.3]],{col:'#e8dcae',alpha:.85,edge:null,flat:true,cull:true}),
      DISC([0,1.3,0],[0,1,0],0.98,'#efe6c0',{flat:true})
    ]));
    parts.push(PT('金属钠',[
      SPH([0.35,0.22,0.2],0.24,'#d4dae2'),SPH([-0.3,0.2,-0.22],0.2,'#d4dae2'),SPH([0,0.5,0.3],0.13,'#d4dae2'),
      SPH([0.42,0.3,0.28],0.05,'#f4f7fa'),SPH([-0.36,0.28,-0.28],0.045,'#f4f7fa') /* 银白切面高光 */
    ]));
    parts.push(PT('瓶盖',[L([[0.02,2.0],[0.7,2.0],[0.7,2.26],[0.02,2.26]],{col:M.capDark,edge:'#3d4a55',flat:true})]));
    parts.push(PT('警示环',[L([[1.085,1.15],[1.085,1.42]],{col:'#c0392b',edge:'#8e2620',flat:true})]));
    parts.push(PT('标签',labelFaces(1.085,0.3,0.78,'#c0392b',cfg.txt,cfg.txt2)));
    return finish(parts);
  },
  phbox(cfg){ /* 试纸盒 */
    const parts=[];
    parts.push(PT('纸盒',[].concat(BOX(0,0.55,0,1.7,1.1,0.62,'#fbfbf6',{edge:M.paperEdge}),
      FACE([[-0.72,0.1,0.311],[0.72,0.1,0.311],[0.72,0.42,0.311],[-0.72,0.42,0.311]],M.paper,{edge:M.paperEdge,lw:.8}))));
    parts.push(PT('盒盖',[].concat(BOX(0,1.18,0,1.76,0.16,0.68,'#0e6b57',{edge:'#0a4f40'}),
      FACE([[-0.5,1.261,0.341],[0.5,1.261,0.341],[0.5,1.30,0.341],[-0.5,1.30,0.341]],'#2dd4bf',{}))));
    /* 比色卡色条 */
    const cols=['#c0392b','#e67e22','#f1c40f','#27ae60','#16a085','#2980b9'];
    const strip=[];
    cols.forEach((c,i)=>{strip.push(FACE([[-0.55+i*0.19,0.5,0.312],[-0.55+i*0.19+0.16,0.5,0.312],[-0.55+i*0.19+0.16,0.72,0.312],[-0.55+i*0.19,0.72,0.312]],c,{}));});
    parts.push(PT('比色卡',strip));
    parts.push(PT('试纸',[FACE([[0.55,0.5,0],[1.45,0.5,0],[1.45,0.62,0],[0.55,0.62,0]],M.paper,{edge:M.paperEdge})]));
    return finish(parts);
  },
  paperstack(){ /* 滤纸 */
    const parts=[];
    const sh=[];
    for(let i=0;i<9;i++){
      const jx=(Math.sin(i*2.7)*0.06),jz=(Math.cos(i*1.9)*0.06);
      sh.push(DISC([jx,0.05+i*0.055,jz],[0,1,0],1.15-i*0.008,i%2?'#fdfdf8':'#f4f2e8',{edge:'#d9d5c5',flat:true}));
    }
    parts.push(PT('滤纸堆',sh));
    parts.push(PT('滤纸（展开）',[DISC([0,0.03,0],[0,1,0],1.3,'#ffffff',{edge:'#cfcabb',flat:true})]));
    return finish(parts);
  },
  sheet(){ /* 称量纸 */
    const parts=[];
    parts.push(PT('称量纸',[
      FACE([[-1.3,0,0.15],[0,0,0.55],[0,0,-0.55],[-1.3,0,-0.15]],'#ffffff',{edge:M.paperEdge,lw:1}),
      FACE([[0,0,0.55],[1.3,0,0.15],[1.3,0,-0.15],[0,0,-0.55]],'#f6f6ef',{edge:M.paperEdge,lw:1})
    ]));
    return finish(parts);
  },
  spatula(){ /* 药匙 */
    const parts=[];
    parts.push(PT('柄',[LN([-1.5,0.6,0],[1.5,0.6,0],0.075,'#e8ddc8')]));
    parts.push(PT('大匙',[
      DISC([-1.85,0.6,0],[0,0,1],0.4,'#efe5cf',{edge:'#cbbd9d',flat:true}),
      SPH([-1.85,0.6,0.42],0.05,'#e8ddc8')
    ]));
    parts.push(PT('小匙',[
      DISC([1.8,0.6,0],[0,0,1],0.26,'#efe5cf',{edge:'#cbbd9d',flat:true}),
      SPH([1.8,0.6,0.28],0.04,'#e8ddc8')
    ]));
    return finish(parts);
  },
  stopper(){ /* 橡胶塞 */
    const parts=[];
    parts.push(PT('橡胶塞',[L([[0.02,0],[0.5,0.02],[0.5,0.3],[0.4,0.95],[0.32,1.05],[0.34,1.2],[0.46,1.32],[0.48,1.42],[0.02,1.44]],{col:M.rubber,edge:shadeCol(M.rubber,.55),flat:true})]));
    return finish(parts);
  },
  tweezers(){ /* 镊子 */
    const parts=[];
    const arm=(s)=>[
      LN([0,1.15,0],[0.28*s,0.5,0],0.075,M.metal),
      LN([0.28*s,0.5,0],[0.34*s,0.35,0],0.07,M.metal),
      LN([0.34*s,0.35,0],[0.05*s,-1.1,0],0.055,M.metal),
      LN([0.05*s,-1.1,0],[0.012*s,-1.5,0],0.03,M.metalDark)
    ];
    parts.push(PT('左臂',arm(1)));
    parts.push(PT('右臂',arm(-1)));
    parts.push(PT('指环',[
      DISC([0,1.32,0],[0,0,1],0.2,M.metalDark,{flat:true,edge:shadeCol(M.metalDark,.6)}),
      DISC([0,1.32,0.001],[0,0,1],0.12,M.metal,{flat:true})
    ]));
    return finish(parts);
  }
};
/* ============ 化学仪器模型 ============ */
B.app={
  testtube(){ /* 试管：圆润底弧 + 弯月液面 + 高光 */
    const parts=[];
    parts.push(PT('管体',[L([[0.02,0.06],[0.14,0.02],[0.3,0.14],[0.35,0.42],[0.36,0.7],[0.36,2.55],[0.42,2.57],[0.42,2.68],[0.36,2.7]],{alpha:.55})]));
    parts.push(PT('液体',[
      L([[0.02,0.1],[0.28,0.14],[0.32,0.42],[0.32,1.1]],{col:'#bfe4f0',alpha:.85,edge:null,flat:true,cull:true}),
      DISC([0,1.1,0],[0,1,0],0.315,'#cdeaf4',{flat:true}),
      DISC([0,1.094,0],[0,1,0],0.13,'#a8d2e6',{flat:true})
    ]));
    parts.push(PT('管口翻边',[L([[0.36,2.55],[0.42,2.57],[0.42,2.68],[0.36,2.7]],{alpha:.55})]));
    parts.push(PT('管身高光',[FACE([[-0.3,0.5,0.2],[-0.22,0.5,0.2],[-0.22,2.3,0.2],[-0.3,2.3,0.2]],'#ffffff',{flat:true,zBias:2.5,alpha:.26})]));
    return finish(parts);
  },
  beaker(){ /* 烧杯：杯嘴 + 密集刻度 + 高光 */
    const parts=[];
    parts.push(PT('杯体',[L([[0.02,0],[0.85,0.02],[1.1,0.12],[1.12,0.3],[1.12,2.1],[1.2,2.16],[1.2,2.32],[1.12,2.34]],{alpha:.55})]));
    parts.push(PT('杯底',[L([[0.02,0],[0.85,0.02],[1.1,0.12],[1.12,0.3],[1.12,0.34],[0.02,0.3]],{alpha:.62})]));
    parts.push(PT('杯嘴',[ /* 口沿一侧导流尖嘴：两片斜面 + 底槽 */
      FACE([[0.52,2.14,0.86],[1.14,2.14,0.72],[0.92,2.3,1.3],[0.4,2.3,1.02]],M.glass,{alpha:.6,edge:M.glassEdge,lw:.8,zBias:.8}),
      FACE([[0.4,2.1,0.98],[0.92,2.1,1.26],[0.92,2.3,1.3],[0.4,2.3,1.02]],shadeCol(M.glass,1.12),{alpha:.55,edge:M.glassEdge,lw:.7,zBias:.79})
    ]));
    parts.push(PT('液体',[
      L([[0.02,0.14],[1.04,0.2],[1.05,0.34],[1.05,1.3]],{col:'#bfe4f0',alpha:.88,edge:null,flat:true,cull:true}),
      DISC([0,1.3,0],[0,1,0],1.0,'#cdeaf4',{flat:true}),
      DISC([0,1.294,0],[0,1,0],0.44,'#a8d2e6',{flat:true})
    ]));
    const marks=[];
    for(let k=0;k<14;k++){const y=0.55+k*0.115;marks.push(LN([1.06,y,0],[1.06+(k%2?0.05:0.09),y,0],0.02,'#4a6b78'));}
    parts.push(PT('刻度线',marks));
    parts.push(PT('杯身高光',[
      FACE([[-0.58,0.35,1.08],[-0.42,0.35,1.08],[-0.42,1.9,1.08],[-0.58,1.9,1.08]],'#ffffff',{flat:true,zBias:2.5,alpha:.3}),
      FACE([[0.44,0.45,1.08],[0.5,0.45,1.08],[0.5,1.8,1.08],[0.44,1.8,1.08]],'#ffffff',{flat:true,zBias:2.5,alpha:.12})
    ]));
    return finish(parts);
  },
  flask(){ /* 锥形瓶 */
    const parts=[];
    parts.push(PT('瓶体',[L([[0.02,0],[0.75,0.02],[0.95,0.14],[0.98,0.4],[0.98,0.55],[0.28,2.05],[0.28,2.45],[0.35,2.47],[0.35,2.6],[0.28,2.62]],{alpha:.55})]));
    parts.push(PT('液体',[
      L([[0.02,0.12],[0.88,0.18],[0.9,0.42],[0.9,0.6],[0.5,1.7],[0.24,2.0]],{col:'#dceaf0',alpha:.87,edge:null,flat:true,cull:true}),
      DISC([0,1.62,0],[0,-0.24,0.97].map(v=>v),0.42,'#e8f2f6',{flat:true})
    ]));
    return finish(parts);
  },
  rbs(){ /* 圆底烧瓶 */
    const parts=[];
    const prof=[[0.02,0.28],[0.3,0.34],[0.62,0.52],[0.92,0.86],[1.06,1.3],[1.06,1.6],[0.9,1.95],[0.6,2.2],[0.34,2.3],[0.28,2.32],[0.28,3.5],[0.35,3.52],[0.35,3.62],[0.28,3.64]];
    parts.push(PT('球形瓶体',[L(prof,{alpha:.55})]));
    parts.push(PT('支管',[TUBE([0.28,3.2,0],[1.15,3.75,0],0.13,{})]));
    parts.push(PT('液体',[
      L([[0.02,0.3],[0.4,0.4],[0.75,0.68],[0.92,1.05],[0.94,1.35],[0.6,1.75],[0.1,1.9],[0.02,1.55]],{col:'#bfe4f0',alpha:.87,edge:null,flat:true,cull:true}),
      DISC([0,1.85,0],[0.1,0.98,-0.1],0.55,'#d2ecf5',{flat:true})
    ]));
    return finish(parts);
  },
  vflask(){ /* 容量瓶 */
    const parts=[];
    const prof=[[0.02,0],[0.5,0.02],[0.72,0.1],[0.78,0.3],[0.78,0.85],[0.5,1.25],[0.26,1.6],[0.26,3.1],[0.32,3.12],[0.32,3.2],[0.26,3.22]];
    parts.push(PT('梨形瓶体',[L(prof,{alpha:.55})]));
    parts.push(PT('标线环',[L([[0.265,2.55],[0.265,2.6]],{col:'#2b6cb0',edge:'#2b6cb0',flat:true})]));
    parts.push(PT('定容液面',[
      L([[0.02,0.1],[0.72,0.16],[0.74,0.34],[0.74,0.8],[0.46,1.18],[0.24,1.55],[0.24,2.5]],{col:'#dceaf0',alpha:.87,edge:null,flat:true,cull:true}),
      DISC([0,2.52,0],[0,1,0],0.235,'#e8f2f6',{flat:true})
    ]));
    return finish(parts);
  },
  cyl(){ /* 量筒：底座加宽 + 主次刻度 + 高光 */
    const parts=[];
    parts.push(PT('底座',[L([[0.02,0],[0.75,0],[0.75,0.16],[0.55,0.2],[0.55,0.24],[0.02,0.2]],{col:M.glass,alpha:.62})]));
    parts.push(PT('筒体',[L([[0.42,0.2],[0.42,0.32],[0.52,0.45],[0.52,3.1],[0.58,3.15],[0.58,3.26],[0.52,3.28]],{alpha:.55})]));
    const marks=[];
    for(let k=0;k<18;k++){const y=0.6+k*0.135;marks.push(L([[0.52,y,0],[0.52+(k%5===0?0.08:0.04)-(k%5===2?0.012:0),y,0]],{col:'#4a6b78'}));}
    parts.push(PT('刻度',marks));
    parts.push(PT('液体',[
      L([[0.02,0.24],[0.5,0.3],[0.5,0.5],[0.5,1.5]],{col:'#bfe4f0',alpha:.88,edge:null,flat:true,cull:true}),
      DISC([0,1.5,0],[0,1,0],0.485,'#cdeaf4',{flat:true}),
      DISC([0,1.494,0],[0,1,0],0.2,'#a8d2e6',{flat:true})
    ]));
    parts.push(PT('筒身高光',[FACE([[0.12,0.55,0.5],[0.19,0.55,0.5],[0.19,2.9,0.5],[0.12,2.9,0.5]],'#ffffff',{flat:true,zBias:2.5,alpha:.28})]));
    return finish(parts);
  },
  buret(){ /* 酸式滴定管：密集刻度 + 活塞柄 + 尖嘴液滴 */
    const parts=[];
    parts.push(PT('刻度管',[L([[0.02,0.9],[0.2,0.9],[0.2,3.4],[0.26,3.45],[0.26,3.56],[0.2,3.58],[0.2,3.7],[0.02,3.7]].map(p=>p),{alpha:.55})]));
    const marks=[];
    for(let k=0;k<=50;k++){
      const y=3.32-k*.042, length=k%10===0?.19:k%5===0?.13:.074;
      marks.push(LN([-.095,y,-.202],[-.095+length,y,-.202],k%10===0?.011:.006,'#2c4c59'));
    }
    parts.push(PT('刻度',marks));
    parts.push(PT('液体',[
      L([[0.02,1.0],[0.18,1.05],[0.18,3.3]],{col:'#f0d7e0',alpha:.85,edge:null,flat:true,cull:true}),
      DISC([0,3.3,0],[0,1,0],0.17,'#f7e5ea',{flat:true}),
      DISC([0,3.294,0],[0,1,0],0.07,'#e8c3d2',{flat:true})
    ]));
    parts.push(PT('活塞',[
      LN([-0.5,0.85,0],[0.5,0.85,0],0.09,M.glass),
      SPH([0.62,0.85,0],0.11,M.glass),
      SPH([-0.62,0.85,0],0.09,M.glass),
      LN([-0.62,0.85,0.1],[-0.86,0.85,0.3],0.045,M.capDark) /* 活塞手柄小嘴 */
    ]));
    parts.push(PT('尖嘴',[
      L([[0.02,0.9],[0.06,0.75],[0.1,0.55],[0.1,0.42],[0.04,0.38],[0.02,0.38]],{alpha:.62}),
      SPH([0,0.3,0],0.05,'#f0d7e0')
    ]));
    parts.push(PT('管身高光',[FACE([[-0.155,1.2,0.185],[-0.09,1.2,0.185],[-0.09,3.25,0.185],[-0.155,3.25,0.185]],'#ffffff',{flat:true,zBias:2.5,alpha:.28})]));
    return finish(parts);
  },
  pipette(){ /* 移液管 */
    const parts=[];
    parts.push(PT('胖肚管体',[L([[0.02,0.3],[0.11,0.3],[0.11,0.9],[0.36,1.15],[0.4,1.4],[0.4,2.15],[0.36,2.4],[0.11,2.65],[0.11,3.3],[0.16,3.32],[0.16,3.42],[0.11,3.44]],{alpha:.55})]));
    parts.push(PT('环状标线',[L([[0.125,3.12],[0.125,3.17]],{col:'#2b6cb0',edge:'#2b6cb0',flat:true})]));
    parts.push(PT('溶液',[
      L([[0.02,0.35],[0.1,0.4],[0.1,0.9],[0.34,1.15],[0.37,1.4],[0.37,2.15],[0.34,2.4],[0.1,2.6],[0.1,2.9]],{col:'#cfe8f2',alpha:.87,edge:null,flat:true,cull:true}),
      DISC([0,2.9,0],[0,1,0],0.095,'#e0f0f6',{flat:true}),
      SPH([0,0.34,0],0.045,'#cfe8f2')
    ]));
    return finish(parts);
  },
  funnel(){ /* 漏斗 */
    const parts=[];
    parts.push(PT('漏斗体',[L([[0.02,0.6],[0.1,0.6],[0.12,0.75],[1.15,1.95],[1.2,2.05],[1.2,2.16],[1.14,2.16]],{alpha:.58})]));
    parts.push(PT('滤纸锥',[
      L([[0.02,0.66],[0.09,0.66],[0.11,0.8],[1.04,1.88],[1.04,1.95],[0.02,1.4]],{col:'#ffffff',alpha:.92,edge:'#d9d5c5',flat:true})
    ]));
    return finish(parts);
  },
  sepf(){ /* 分液漏斗 */
    const parts=[];
    parts.push(PT('梨形球体',[L([[0.02,1.0],[0.3,1.05],[0.62,1.35],[0.75,1.8],[0.75,2.2],[0.55,2.6],[0.28,2.8],[0.24,2.85],[0.24,3.6],[0.3,3.62],[0.3,3.72],[0.24,3.74]],{alpha:.58})]));
    parts.push(PT('上口塞',[L([[0.02,3.72],[0.36,3.72],[0.36,3.86],[0.24,3.94],[0.12,3.96],[0.02,3.96]],{col:M.rubber,edge:shadeCol(M.rubber,.55),flat:true})]));
    parts.push(PT('下层液体（萃取相）',[
      L([[0.02,1.05],[0.3,1.1],[0.55,1.35],[0.65,1.75],[0.65,2.05],[0.4,2.4],[0.1,2.5],[0.02,2.1]],{col:'#e8b84b',alpha:.88,edge:null,flat:true,cull:true}),
      DISC([0,2.42,0],[0.12,0.96,-0.24],0.42,'#f0c96a',{flat:true})
    ]));
    parts.push(PT('上层液体（水相）',[
      L([[0.02,2.5],[0.3,2.55],[0.4,2.72],[0.3,3.3],[0.12,3.4],[0.02,3.4]],{col:'#cfe8f2',alpha:.83,edge:null,flat:true,cull:true}),
      DISC([0,3.4,0],[0,1,0],0.11,'#e0f0f6',{flat:true})
    ]));
    parts.push(PT('下活塞',[
      LN([-0.4,0.95,0],[0.4,0.95,0],0.08,M.glass),
      SPH([0.52,0.95,0],0.09,M.glass)
    ]));
    parts.push(PT('下管与尖嘴',[
      L([[0.02,1.0],[0.09,0.85],[0.1,0.55],[0.1,0.4],[0.04,0.36],[0.02,0.36]],{alpha:.62})
    ]));
    return finish(parts);
  },
  cond(){ /* 直形冷凝管 */
    const parts=[];
    parts.push(PT('外套管',[L([[0.02,0.5],[0.52,0.5],[0.52,3.1],[0.6,3.16],[0.6,3.28],[0.52,3.3],[0.52,3.5]],{alpha:.62})]));
    parts.push(PT('冷却水',[
      L([[0.02,0.56],[0.5,0.56],[0.5,3.05]],{col:'#a5d5e8',alpha:.4,edge:null,flat:true,cull:true})
    ]));
    parts.push(PT('下进水口',[
      B.TUBE([0,0.5,0.52],[-0.75,-0.3,0.95],0.1,{})
    ]));
    parts.push(PT('上出水口',[
      B.TUBE([0,3.3,0.52],[0.8,4.0,0.9],0.1,{})
    ]));
    parts.push(PT('内管（蒸气通道）',[
      B.TUBE([0,0.12,0],[0,3.88,0],0.13,{}),
      B.TUBE([0,0.12,0],[0,3.88,0],0.08,{col:'#eaf4f8',alpha:.55,edge:null})
    ]));
    return finish(parts);
  },
  rod(){ /* 玻璃棒 */
    const parts=[];
    parts.push(PT('玻璃棒',[
      LN([-1.5,0,0],[1.5,0,0],0.075,M.glass),
      SPH([-1.5,0,0],0.078,M.glass),SPH([1.5,0,0],0.078,M.glass)
    ]));
    return finish(parts);
  },
  watch(){ /* 表面皿 */
    const parts=[];
    parts.push(PT('浅弧面皿',[L([[0.02,0],[0.6,0.05],[0.95,0.22],[1.25,0.5],[1.32,0.6],[1.32,0.68],[1.24,0.68]],{alpha:.6})]));
    return finish(parts);
  }
};
})();
