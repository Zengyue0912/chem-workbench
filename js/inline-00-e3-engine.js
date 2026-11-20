/* ============================================================================
 * 抽取自 index.html 内联 <script> #0（原行 793–1279）。
 * 3D 引擎：透视投影 + 画家算法 + 旋转体建模（window.E3）
 * 工作流 1（性能与工程重构）：内容原样搬运，仅做加载方式改变。
 * 加载方式：首屏 defer
 * ========================================================================== */
(function(){'use strict';
window.E3={};
const TAU=Math.PI*2;
/* ---- 颜色工具 ---- */
const _cc={};
function rgb(h){
  if(_cc[h])return _cc[h];
  let s=h.length===4?'#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3]:h;
  const r=parseInt(s.substr(1,2),16),g=parseInt(s.substr(3,2),16),b=parseInt(s.substr(5,2),16);
  return _cc[h]=[r,g,b];
}
function shade(h,k,a){
  const c=rgb(h),f=v=>Math.max(0,Math.min(255,Math.round(v*k)));
  return 'rgba('+f(c[0])+','+f(c[1])+','+f(c[2])+','+(a===undefined?1:a)+')';
}
E3.shade=shade;
E3.rgba=(h,a)=>shade(h,1,a);
function shadeW(h,k,a,w){
  const c=rgb(h),t=w||0,f=v=>Math.max(0,Math.min(255,Math.round(v*k*(1-t)+255*t)));
  return 'rgba('+f(c[0])+','+f(c[1])+','+f(c[2])+','+(a===undefined?1:a)+')';
}
E3.shadeW=shadeW;
/* ---- 向量 ---- */
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vlen=a=>Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);
const vnorm=a=>{const l=vlen(a)||1;return [a[0]/l,a[1]/l,a[2]/l]};
const vcross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
E3.v={sub:vsub,len:vlen,norm:vnorm,cross:vcross,mid:(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]};
/* ---- 光源（固定世界方向：左上前） ---- */
const L=vnorm([-0.42,0.74,0.53]);
/* ---- 相机 ---- */
const cam={yaw:0.55,pitch:0.30,dist:12,fov:520,cx:0,cy:0};
E3.cam=cam;
E3.rot=function(x,y,z){
  const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw);
  const x1=x*cy-z*sy,z1=x*sy+z*cy;
  const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
  return [x1,y*cp-z1*sp,y*sp+z1*cp];
};
E3.proj=function(x,y,z){
  const p=E3.rot(x,y,z),zc=p[2]+cam.dist;
  const f=cam.fov/Math.max(zc,0.12);
  return [cam.cx+p[0]*f,cam.cy-p[1]*f,zc,f];
};
/* ---- 包围盒 ---- */
function bbox(model){
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  const ext=(x,y,z)=>{
    if(x<mn[0])mn[0]=x; if(x>mx[0])mx[0]=x;
    if(y<mn[1])mn[1]=y; if(y>mx[1])mx[1]=y;
    if(z<mn[2])mn[2]=z; if(z>mx[2])mx[2]=z;
  };
  model.parts.forEach(pt=>pt.shapes.forEach(s=>{
    const d=[0,0,0];
    if(s.t==='sph'){ext(s.c[0]-s.r,s.c[1]-s.r,s.c[2]-s.r);ext(s.c[0]+s.r,s.c[1]+s.r,s.c[2]+s.r);}
    else if(s.t==='line'){[[s.a,0],[s.b,1]].forEach(([p])=>{ext(p[0]-s.r,p[1]-s.r,p[2]-s.r);ext(p[0]+s.r,p[1]+s.r,p[2]+s.r);});}
    else if(s.t==='lathe'){const ox=s.o?s.o[0]:0,oy=s.o?s.o[1]:0,oz=s.o?s.o[2]:0;s.prof.forEach(pr=>{ext(ox-pr[0],oy+pr[1],oz-pr[0]);ext(ox+pr[0],oy+pr[1],oz+pr[0]);});}
    else if(s.t==='disc'){ext(s.c[0]-s.r,s.c[1]-s.r,s.c[2]-s.r);ext(s.c[0]+s.r,s.c[1]+s.r,s.c[2]+s.r);}
    else if(s.t==='face'){s.vs.forEach(p=>ext(p[0],p[1],p[2]));}
    else if(s.t==='tube'){[[s.a],[s.b]].forEach(([p])=>{ext(p[0]-s.r,p[1]-s.r,p[2]-s.r);ext(p[0]+s.r,p[1]+s.r,p[2]+s.r);});}
    else if(s.t==='glow'){ext(s.c[0]-s.r*0.3,s.c[1]-s.r*0.3,s.c[2]-s.r*0.3);ext(s.c[0]+s.r*0.3,s.c[1]+s.r*0.3,s.c[2]+s.r*0.3);}
    else if(s.t==='ring'){ext(s.c[0]-s.r1,s.c[1]-0.02,s.c[2]-s.r1);ext(s.c[0]+s.r1,s.c[1]+0.02,s.c[2]+s.r1);}
  }));
  return {mn,mx,center:[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2],
    span:Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])||1};
}
E3.bbox=bbox;
E3.fit=function(model,W,H,pad){
  const b=bbox(model);
  cam.fov=Math.min(W,H)*(pad||0.9);
  cam.dist=b.span*1.85+2.2;
  cam.cx=W/2;cam.cy=H*0.47;
  return b;
};
/* ---- 旋转体：预计算法线 ---- */
function latheNormals(prof,seg){
  const nrm=[];
  const P=(i,j)=>{const a=(j%seg)/seg*TAU,r=prof[i][0],y=prof[i][1];return [r*Math.sin(a),y,r*Math.cos(a)];};
  for(let i=0;i<prof.length-1;i++){
    const row=[];
    for(let j=0;j<seg;j++){
      const A=P(i,j),B=P(i,j+1),C=P(i+1,j+1),D=P(i+1,j);
      const n=vcross(vsub(B,A),vsub(D,A));
      row.push(vnorm(n));
    }
    nrm.push(row);
  }
  return nrm;
}
E3.latheNormals=latheNormals;
/* ---- 主渲染 ---- */
/* opts:{explode:0..1, disp:数组, extra:[shapes], labels:bool, theme:{text,text2,grid,floor}, dpr} */
E3.render=function(ctx,model,opts){
  opts=opts||{};
  const W=ctx.canvas.clientWidth||ctx.canvas.width,H=ctx.canvas.clientHeight||ctx.canvas.height;
  const items=[];
  const explode=opts.explode||0;
  const disp=opts.disp||model.parts.map(()=>[0,0,0]);
  const D=g=>disp[g]||[0,0,0];
  /* -- 收集图元 -- */
  function pushShape(s,gA,gB){
    if(s.t==='sph'){
      const d=D(s.g!==undefined?s.g:gA);
      const p=E3.proj(s.c[0]+d[0],s.c[1]+d[1],s.c[2]+d[2]);
      const r=s.r*p[3];
      if(r>0.4)items.push({z:p[2]-(s.zBias||0),k:0,x:p[0],y:p[1],r,col:s.col,glow:s.glow});
    }else if(s.t==='line'){
      const dA=D(s.gA!==undefined?s.gA:gA),dB=D(s.gB!==undefined?s.gB:(gB===undefined?gA:gB));
      const pA=E3.proj(s.a[0]+dA[0],s.a[1]+dA[1],s.a[2]+dA[2]);
      const pB=E3.proj(s.b[0]+dB[0],s.b[1]+dB[1],s.b[2]+dB[2]);
      items.push({z:(pA[2]+pB[2])/2,k:1,ax:pA[0],ay:pA[1],bx:pB[0],by:pB[1],w:Math.max(.8,s.r*(pA[3]+pB[3])),colA:s.colA||s.col,colB:s.colB||s.col});
    }else if(s.t==='lathe'){
      const d=D(s.g!==undefined?s.g:gA);
      const seg=s.seg,prof=s.prof;
      const ox=d[0]+(s.o?s.o[0]:0),oy=d[1]+(s.o?s.o[1]:0),oz=d[2]+(s.o?s.o[2]:0);
      const vs=[],vk=[];
      /* 顶点光照（Gouraud）：按母线切向解析顶点法线 */
      if(!s._vn){
        const vn=[];
        for(let i=0;i<prof.length;i++){
          const im=Math.max(0,i-1),ip=Math.min(prof.length-1,i+1);
          const dr=prof[ip][0]-prof[im][0],dy=prof[ip][1]-prof[im][1];
          const l=Math.hypot(dr,dy)||1;
          vn.push([dy/l,-dr/l]); /* (径向分量, y分量) */
        }
        s._vn=vn;
      }
      for(let i=0;i<prof.length;i++){
        const row=[],krow=[];
        const nr=s._vn[i][0],ny=s._vn[i][1];
        for(let j=0;j<=seg;j++){
          const a=j/seg*TAU,r=prof[i][0],y=prof[i][1];
          row.push(E3.proj(r*Math.sin(a)+ox,y+oy,r*Math.cos(a)+oz));
          if(!s.flat){
            const n=E3.rot(nr*Math.sin(a),ny,nr*Math.cos(a));
            const nd=Math.max(0,n[0]*L[0]+n[1]*L[1]+n[2]*L[2]);
            /* 窗光反射条（顶点级）：屏幕固定方位高斯亮带，旋转时不随模型转动 */
            const ang=Math.atan2(n[0],n[2]);
            const stk=Math.pow(Math.abs(Math.cos(ang+0.95)),7)*0.85+Math.pow(Math.abs(Math.cos(ang-0.95)),9)*0.72;
            krow.push(0.62+0.72*nd+stk*0.9);
          } else krow.push(1);
        }
        vs.push(row);vk.push(krow);
      }
      if(!s._n)s._n=latheNormals(prof,seg);
      const al=s.alpha!==undefined?s.alpha:1;
      /* 材质判定：液体 = 平光且无描边；玻璃 = 半透明且有描边。
         玻璃实际不透明度单独压低（aG），避免前后壁叠加后变成乳白实心。 */
      const isLiq=!!(s.flat&&!s.edge);
      const isGlass=!isLiq&&al<1;
      const aG=isGlass?Math.min(al,0.34):al;
      /* 特征行：仅首行与末行（杯口/杯底缘），中间不画环线——消除"线框感"，玻璃更纯净 */
      if(!s._ring){
        const rk=[0,prof.length-2];
        s._ring={};rk.forEach(i=>s._ring[i]=1);
      }
      for(let i=0;i<prof.length-1;i++){
        for(let j=0;j<seg;j++){
          const A=vs[i][j],B=vs[i][j+1],C=vs[i+1][j+1],Dv=vs[i+1][j];
          if(A[2]<.25&&B[2]<.25&&C[2]<.25&&Dv[2]<.25)continue;
          const n=E3.rot(s._n[i][j][0],s._n[i][j][1],s._n[i][j][2]);
          if(s.cull&&n[2]<0)continue;
          /* 剪影纵线：相邻面朝向翻转处才描边 */
          const n2=E3.rot(s._n[i][(j+1)%seg][0],s._n[i][(j+1)%seg][1],s._n[i][(j+1)%seg][2]);
          const sil=(n[2]>=0)!==(n2[2]>=0);
          const ring=!!s._ring[i];
          const showLine=s.edge&&(sil||ring);
          /* Gouraud 渐变填充：左顶点色→右顶点色（玻璃附加轮廓光+镜面高光） */
          const kA=(vk[i][j]+vk[i+1][j])/2,kB=(vk[i][j+1]+vk[i+1][j+1])/2;
          const nd=Math.max(0,n[0]*L[0]+n[1]*L[1]+n[2]*L[2]);
          let w=0,streak=0;
          if(isGlass){
            const rim=1-Math.abs(n[2]);
            /* 插画式玻璃：白化只集中在菲涅尔边缘与窄亮带，不再大面积糊白 */
            w=Math.max(0,rim-0.55)*0.58+Math.pow(nd,13)*0.26;
            /* 窗光反射条：屏幕固定方位的窄高斯亮带（不随模型旋转） */
            const ang=Math.atan2(n[0],n[2]);
            /* 只让"竖立面"吃窗光反射；水平面（杯底/瓶底）不吃，否则会炸出放射状白楔。
               单条主反射带 + 一条极弱副带：玻璃器皿的经典插画语言（1~2 道高光，不是满身亮条） */
            const vert=Math.pow(1-Math.abs(n[1]),2);
            streak=(Math.pow(Math.max(0,Math.cos(ang-0.72)),6)*0.95+Math.pow(Math.max(0,Math.cos(ang-2.45)),11)*0.45)*vert;
            w=Math.min(0.84,w+streak*0.34);
          }
          /* 液体：保持色相饱和，只用深度渐变区分上下，不做白化 */
          const lk=isLiq?0.90+0.17*(prof.length>1?i/(prof.length-1):0):1;
          const kA2=kA*lk,kB2=kB*lk;
          let fill;
          if(s.flat||Math.abs(kA2-kB2)<0.015)fill=shadeW(s.col,(kA2+kB2)/2,aG,w);
          else fill={gA:[(A[0]+Dv[0])/2,(A[1]+Dv[1])/2],gB:[(B[0]+C[0])/2,(B[1]+C[1])/2],cA:shadeW(s.col,kA2,aG,w),cB:shadeW(s.col,kB2,aG,w)};
          const zf=(A[2]+B[2]+C[2]+Dv[2])/4;
          items.push({z:zf,k:2,pts:[[A[0],A[1]],[B[0],B[1]],[C[0],C[1]],[Dv[0],Dv[1]]],
            fill:fill,stroke:showLine?shade(s.edge,Math.max(kA2,0.94),isGlass?0.82:(al>.5?.62:.5)):null,
            lw:isGlass?1.15:(s.lw||1),
            /* 杯口/杯底那一圈只描"横线"，不描四边形轮廓——否则 64 段会变成一圈放射状梳齿 */
            ringOnly:!!(ring&&!sil),
            /* 补缝只在"够大"的面上做：杯底那种细长环面补了会变成放射状白楔 */
            seam:isLiq?Math.abs(A[1]-Dv[1])>6.5:al>=.86});
          /* 高光条附加层：窄亮带处补一层极淡白，只保留"反射线"不保留"乳白底" */
          if(streak>0.42){
            items.push({z:zf-0.002,k:2,pts:[[A[0],A[1]],[B[0],B[1]],[C[0],C[1]],[Dv[0],Dv[1]]],
              fill:'rgba(255,255,255,'+Math.min(.5,streak*0.5).toFixed(3)+')',stroke:null});
          }
        }
      }
      /* 液面弯月面：液体顶端补一道亮环，读作"液面张力"而不是一个平圆片 */
      if(isLiq){
        const pt=prof[prof.length-1];
        if(pt[0]>0.12){
          pushShape({t:'ring',c:[ox,pt[1]+oy,oz],n:[0,1,0],r0:pt[0]*0.88,r1:pt[0]*1.02,
            col:shadeW(s.col,1.55,0.50,0.30),zBias:0.03});
        }
      }
      /* 开口壳体封口：仅当两端都开口（多为拆解后的断口）时补圆片，避免看见内壁三角扇 */
      if(isGlass&&prof[0][0]>0.25&&prof[prof.length-1][0]>0.25){
        [0,prof.length-1].forEach((idx,k)=>{
          pushShape({t:'disc',c:[ox,prof[idx][1]+oy,oz],n:[0,k?1:-1,0],r:prof[idx][0]*0.99,
            col:s.col,alpha:Math.min(0.46,aG+0.14),flat:true,edge:null,dome:false});
        });
      }
    }else if(s.t==='disc'){
      const d=D(s.g!==undefined?s.g:gA);
      let u=vcross(s.n,[0,1,0]);if(vlen(u)<.01)u=[1,0,0];
      u=vnorm(u);const v=vcross(s.n,u);
      const pts=[],zs=[];
      for(let j=0;j<14;j++){
        const a=j/14*TAU,rr=s.r;
        const x=s.c[0]+(u[0]*Math.cos(a)+v[0]*Math.sin(a))*rr+d[0];
        const y=s.c[1]+(u[1]*Math.cos(a)+v[1]*Math.sin(a))*rr+d[1];
        const z=s.c[2]+(u[2]*Math.cos(a)+v[2]*Math.sin(a))*rr+d[2];
        const p=E3.proj(x,y,z);pts.push([p[0],p[1]]);zs.push(p[2]);
      }
      const n=E3.rot(s.n[0],s.n[1],s.n[2]);
      const k=s.flat?1:0.52+0.62*Math.max(0,n[0]*L[0]+n[1]*L[1]+n[2]*L[2]);
      const pc=E3.proj(s.c[0]+d[0],s.c[1]+d[1],s.c[2]+d[2]);
      items.push({z:pc[2]-(s.zBias||0),k:2,pts,col:s.col,kk:k,al:s.alpha!==undefined?s.alpha:1,dome:s.dome!==false,stroke:s.edge?shade(s.edge,k,.7):null,lw:1});
    }else if(s.t==='face'){
      const d=D(s.g!==undefined?s.g:gA);
      const pts=[],zs=[];let cx=0,cy=0,fs=0;
      s.vs.forEach(v=>{const p=E3.proj(v[0]+d[0],v[1]+d[1],v[2]+d[2]);pts.push([p[0],p[1]]);zs.push(p[2]);cx+=p[0];cy+=p[1];fs+=p[3];});
      const nv=s.vs.length;cx/=nv;cy/=nv;fs/=nv;
      if(!s._n)s._n=vnorm(vcross(vsub(s.vs[1],s.vs[0]),vsub(s.vs[3]||s.vs[2],s.vs[0])));
      const n=E3.rot(s._n[0],s._n[1],s._n[2]);
      const k=s.flat?1:0.52+0.62*Math.max(0,n[0]*L[0]+n[1]*L[1]+n[2]*L[2]);
      items.push({z:Math.min.apply(null,zs)+0.01-(s.zBias||0),k:2,pts,fill:shade(s.col,k,s.alpha!==undefined?s.alpha:1),stroke:s.edge?shade(s.edge,k,.7):null,lw:s.lw||1,txt:s.txt,tc:s.textCol,cx:cx,cy:cy,fs:fs,tsc:s.txtScale});
    }else if(s.t==='ring'){ /* 圆环（涟漪/扩散前沿） */
      const d=D(s.g!==undefined?s.g:gA);
      let u=vcross(s.n,[0,1,0]);if(vlen(u)<.01)u=[1,0,0];
      u=vnorm(u);const vv=vcross(s.n,u);
      const SEG=22,pts=[],zs=[];
      for(let j=0;j<=SEG;j++){
        const a=j/SEG*TAU,rr=s.r1;
        const p=E3.proj(s.c[0]+(u[0]*Math.cos(a)+vv[0]*Math.sin(a))*rr+d[0],s.c[1]+(u[1]*Math.cos(a)+vv[1]*Math.sin(a))*rr+d[1],s.c[2]+(u[2]*Math.cos(a)+vv[2]*Math.sin(a))*rr+d[2]);
        pts.push([p[0],p[1]]);zs.push(p[2]);
      }
      for(let j=SEG;j>=0;j--){
        const a=j/SEG*TAU,rr=s.r0;
        const p=E3.proj(s.c[0]+(u[0]*Math.cos(a)+vv[0]*Math.sin(a))*rr+d[0],s.c[1]+(u[1]*Math.cos(a)+vv[1]*Math.sin(a))*rr+d[1],s.c[2]+(u[2]*Math.cos(a)+vv[2]*Math.sin(a))*rr+d[2]);
        pts.push([p[0],p[1]]);zs.push(p[2]);
      }
      const col=(s.col&&s.col[0]==='#')?shade(s.col,1,s.alpha!==undefined?s.alpha:1):s.col;
      const pc=E3.proj(s.c[0]+d[0],s.c[1]+d[1],s.c[2]+d[2]);
      items.push({z:pc[2]-(s.zBias||0),k:2,pts,fill:col,even:true});
    }else if(s.t==='lbl'){ /* 标注（支持拆解/对比位移） */
      if(opts.labels){
        const d=D(s.g!==undefined?s.g:gA);
        const p=E3.proj(s.p[0]+d[0],s.p[1]+d[1],s.p[2]+d[2]);
        items.push({z:p[2],k:3,x:p[0],y:p[1],txt:s.txt});
      }
    }else if(s.t==='glow'){ /* 柔光光晕 */
      const d=D(s.g!==undefined?s.g:gA);
      const p=E3.proj(s.c[0]+d[0],s.c[1]+d[1],s.c[2]+d[2]);
      items.push({z:p[2]+0.05-(s.zBias||0),k:4,x:p[0],y:p[1],r:Math.max(2,s.r*p[3]),col:s.col});
    }else if(s.t==='tube'){ /* 圆柱管（任意朝向） */
      const d=D(s.g!==undefined?s.g:gA);
      const dir=vnorm(vsub(s.b,s.a));
      let u=vcross(dir,[0,1,0]);if(vlen(u)<.01)u=vcross(dir,[1,0,0]);
      u=vnorm(u);const vv=vcross(dir,u);
      const seg=s.seg||14,al=s.alpha!==undefined?s.alpha:1;
      const ringPts=P=>{
        const out=[];
        for(let j=0;j<=seg;j++){
          const a=j/seg*TAU,ca=Math.cos(a),sa=Math.sin(a);
          out.push(E3.proj(P[0]+(u[0]*ca+vv[0]*sa)*s.r+d[0],P[1]+(u[1]*ca+vv[1]*sa)*s.r+d[1],P[2]+(u[2]*ca+vv[2]*sa)*s.r+d[2]));
        }
        return out;
      };
      const ra=ringPts(s.a),rb=ringPts(s.b);
      for(let j=0;j<seg;j++){
        const A=ra[j],B=ra[j+1],C=rb[j+1],Dv=rb[j];
        if(A[2]<.25&&B[2]<.25&&C[2]<.25&&Dv[2]<.25)continue;
        const am=(j+0.5)/seg*TAU,ca=Math.cos(am),sa=Math.sin(am);
        const n=E3.rot(u[0]*ca+vv[0]*sa,u[1]*ca+vv[1]*sa,u[2]*ca+vv[2]*sa);
        if(s.cull&&n[2]<0)continue;
        const nd=Math.max(0,n[0]*L[0]+n[1]*L[1]+n[2]*L[2]);
        const k=0.56+0.62*nd;
        let w=0;
        if(al<1){
          const rim=1-Math.abs(n[2]);
          w=Math.max(0,rim-0.56)*0.66+Math.pow(nd,9)*0.46;
          if(w>0.78)w=0.78;
        }
        items.push({z:(A[2]+B[2]+C[2]+Dv[2])/4,k:2,pts:[[A[0],A[1]],[B[0],B[1]],[C[0],C[1]],[Dv[0],Dv[1]]],
          fill:shadeW(s.col,k,al,w),stroke:s.edge?shade(s.edge,Math.max(k,0.92),al>.5?.6:.48):null,lw:1,seam:al>=.82});
      }
    }
  }
  model.parts.forEach((pt,pi)=>{if(pt.hide)return;pt.shapes.forEach(s=>pushShape(s,pi));});
  (opts.extra||[]).forEach(s=>pushShape(s));
  /* -- 排序（远→近） -- */
  items.sort((a,b)=>b.z-a.z);
  /* -- 绘制 -- */
  ctx.lineJoin='round';ctx.lineCap='round';
  const labels=[];
  for(let i=0;i<items.length;i++){
    const it=items[i];
    if(it.k===0){ /* 球 */
      const r=it.r;
      const g=ctx.createRadialGradient(it.x-r*.33,it.y-r*.38,r*.12,it.x,it.y,r*1.02);
      g.addColorStop(0,shade(it.col,1.5));
      g.addColorStop(.5,shade(it.col,it.glow?1.12:1));
      g.addColorStop(1,shade(it.col,.55));
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(it.x,it.y,r,0,TAU);ctx.fill();
      if(r>3){ /* 镜面高光点 */
        ctx.fillStyle='rgba(255,255,255,.38)';
        ctx.beginPath();
        ctx.ellipse(it.x-r*.32,it.y-r*.36,Math.max(.7,r*.18),Math.max(.5,r*.11),-.65,0,TAU);
        ctx.fill();
      }
      if(r>2.6){ctx.strokeStyle=shade(it.col,.42,.55);ctx.lineWidth=.8;ctx.stroke();}
    }else if(it.k===1){ /* 键/杆 */
      ctx.beginPath();ctx.moveTo(it.ax,it.ay);ctx.lineTo(it.bx,it.by);
      ctx.lineWidth=it.w;
      if(it.colA===it.colB)ctx.strokeStyle=it.colA;
      else{const g=ctx.createLinearGradient(it.ax,it.ay,it.bx,it.by);g.addColorStop(0,it.colA);g.addColorStop(1,it.colB);ctx.strokeStyle=g;}
      ctx.stroke();
      if(it.w>5){ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=it.w*.25;ctx.beginPath();ctx.moveTo(it.ax,it.ay);ctx.lineTo(it.bx,it.by);ctx.stroke();}
    }else if(it.k===2){ /* 面 */
      ctx.beginPath();
      ctx.moveTo(it.pts[0][0],it.pts[0][1]);
      for(let j=1;j<it.pts.length;j++)ctx.lineTo(it.pts[j][0],it.pts[j][1]);
      ctx.closePath();
      let fs;
      if(it.dome&&it.col){ /* 圆盘：弯月面径向渐变（中心受光→边缘略暗） */
        let cx=0,cy=0;
        it.pts.forEach(p=>{cx+=p[0];cy+=p[1];});
        cx/=it.pts.length;cy/=it.pts.length;
        let rr=0;
        it.pts.forEach(p=>{rr=Math.max(rr,Math.hypot(p[0]-cx,p[1]-cy));});
        if(rr>4){
          const g=ctx.createRadialGradient(cx-rr*.22,cy-rr*.26,rr*.1,cx,cy,rr);
          g.addColorStop(0,shadeW(it.col,it.kk*1.24,it.al,0));
          g.addColorStop(.68,shadeW(it.col,it.kk,it.al,0));
          g.addColorStop(1,shadeW(it.col,it.kk*.86,it.al,0));
          ctx.fillStyle=g;fs=g;
        }else{ctx.fillStyle=shadeW(it.col,it.kk,it.al,0);fs=ctx.fillStyle;}
      }else if(it.fill&&it.fill.gA){
        const g=ctx.createLinearGradient(it.fill.gA[0],it.fill.gA[1],it.fill.gB[0],it.fill.gB[1]);
        g.addColorStop(0,it.fill.cA);g.addColorStop(1,it.fill.cB);
        ctx.fillStyle=g;fs=g;
      }else{ctx.fillStyle=it.fill;fs=it.fill;}
      ctx.fill(it.even?'evenodd':'nonzero');
      /* 用填充色描边补缝（消除相邻半透明面拼接处的缝隙线） */
      if(it.seam){ctx.strokeStyle=fs;ctx.lineWidth=1.1;ctx.stroke();}
      if(it.stroke){
        ctx.strokeStyle=it.stroke;ctx.lineWidth=it.lw;
        if(it.ringOnly){ /* 只描上/下两条横边，保留"杯口那一圈"的清晰度 */
          ctx.beginPath();
          ctx.moveTo(it.pts[0][0],it.pts[0][1]);ctx.lineTo(it.pts[1][0],it.pts[1][1]);
          ctx.moveTo(it.pts[3][0],it.pts[3][1]);ctx.lineTo(it.pts[2][0],it.pts[2][1]);
          ctx.stroke();
        }else ctx.stroke();
      }
      if(it.txt&&it.fs){
        ctx.fillStyle=it.tc||'#43505a';
        ctx.font='700 '+Math.max(6,Math.min(40,it.fs*(it.tsc||0.13)))+'px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(it.txt,it.cx,it.cy);
        ctx.textAlign='left';ctx.textBaseline='alphabetic';
      }
    }else if(it.k===3){labels.push(it);}
    else if(it.k===4){ /* 柔光光晕 */
      const rr=Math.max(1.5,it.r);
      const g=ctx.createRadialGradient(it.x,it.y,0,it.x,it.y,rr);
      g.addColorStop(0,it.col);
      g.addColorStop(1,String(it.col).replace(/,\s*[\d.]+\)$/,',0)'));
      ctx.fillStyle=g;
      ctx.beginPath();ctx.arc(it.x,it.y,rr,0,TAU);ctx.fill();
    }
  }
  /* -- 标注（最后绘制） -- */
  if(labels.length){
    ctx.font='700 12px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    let oy=0;
    labels.forEach((lb,i)=>{
      const tw=ctx.measureText(lb.txt).width;
      const bx=lb.x+14,by=lb.y-30-(i%3)*26;
      ctx.strokeStyle=opts.theme&&opts.theme.grid||'rgba(20,184,166,.5)';
      ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(lb.x,lb.y);ctx.lineTo(bx-4,by+11);ctx.stroke();
      ctx.fillStyle='rgba(20,184,166,.9)';
      ctx.beginPath();ctx.arc(lb.x,lb.y,2.4,0,TAU);ctx.fill();
      ctx.beginPath();
      const r=4,pad=7,h=20;
      const x0=bx-6,y0=by-4;
      ctx.roundRect?ctx.roundRect(x0,y0,tw+pad*2,h,r):ctx.rect(x0,y0,tw+pad*2,h);
      ctx.closePath();
      ctx.fillStyle=(opts.theme&&opts.theme.labelBg)||'rgba(255,255,255,.92)';
      ctx.fill();
      ctx.strokeStyle=(opts.theme&&opts.theme.grid)||'rgba(20,184,166,.4)';
      ctx.stroke();
      ctx.fillStyle=(opts.theme&&opts.theme.labelTx)||'#0e6b57';
      ctx.fillText(lb.txt,bx,y0+14);
    });
  }
  return items.length;
};
/* ---- 场景背景：实验室台面（理化板 + 台沿厚度）+ 舞台白光 + 分层接触阴影 ---- */
E3.drawFloor=function(ctx,model,floorY){
  const th=opts0.theme;
  const cvn=ctx.canvas;
  const W=cvn.clientWidth||cvn.width,H=cvn.clientHeight||cvn.height;
  /* 舞台柔光：物体身后一道白光，增强纵深 */
  if(th.spot&&W>4&&H>4){
    const g=ctx.createRadialGradient(W/2,H*0.40,0,W/2,H*0.40,Math.min(W,H)*0.52);
    g.addColorStop(0,th.spot);g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  const N=5,step=model?Math.max(1,(bbox(model).span/8)):1.4;
  const fy=floorY!==undefined?floorY:(model?bbox(model).mn[1]-0.06:-3);
  /* 实验台面：覆盖模型的透视四边形 + 前侧沿厚度 */
  if(th.table){
    /* 台面范围放大：原来的 ±1.5 会让台面远边横切在物体腰部，看着像悬在一块小板上 */
    const T=Math.max(N*step*2.4,model?bbox(model).span*1.7:3);
    const q=[E3.proj(-T,fy,-T),E3.proj(T,fy,-T),E3.proj(T,fy,T),E3.proj(-T,fy,T)];
    if(q.every(p=>p[2]>.3)){
      /* 台面向远处淡出：没有硬边的"无限料理台"，既不会横切物体，也不会糊成一张平板 */
      const gn=[(q[0][0]+q[1][0])/2,(q[0][1]+q[1][1])/2],gf=[(q[2][0]+q[3][0])/2,(q[2][1]+q[3][1])/2];
      const tg=ctx.createLinearGradient(gn[0],gn[1],gf[0],gf[1]);
      tg.addColorStop(0,th.table);
      tg.addColorStop(.55,th.table);
      tg.addColorStop(1,shade(th.table,1,0));
      ctx.fillStyle=tg;
      ctx.beginPath();ctx.moveTo(q[0][0],q[0][1]);ctx.lineTo(q[1][0],q[1][1]);ctx.lineTo(q[2][0],q[2][1]);ctx.lineTo(q[3][0],q[3][1]);ctx.closePath();ctx.fill();
      const t1=E3.proj(T,fy-0.34,-T),t2=E3.proj(T,fy-0.34,T);
      if(t1[2]>.3){
        ctx.fillStyle=th.tableEdge;
        ctx.beginPath();ctx.moveTo(q[1][0],q[1][1]);ctx.lineTo(t1[0],t1[1]);ctx.lineTo(t2[0],t2[1]);ctx.lineTo(q[2][0],q[2][1]);ctx.closePath();ctx.fill();
      }
      ctx.strokeStyle=th.tableEdge;ctx.lineWidth=1.5; /* 台面轮廓描边：边界清晰可辨 */
      ctx.beginPath();ctx.moveTo(q[0][0],q[0][1]);ctx.lineTo(q[1][0],q[1][1]);ctx.lineTo(q[2][0],q[2][1]);ctx.lineTo(q[3][0],q[3][1]);ctx.closePath();ctx.stroke();
      /* 台面柔光反射：中心偏亮 */
      if(th.tableGlow){
        const gc=E3.proj(0,fy,0);
        if(gc[2]>.3){
          const rg=ctx.createRadialGradient(gc[0],gc[1],0,gc[0],gc[1],Math.max(60,(q[1][0]-q[0][0])*.5));
          rg.addColorStop(0,th.tableGlow);rg.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle=rg;
          ctx.beginPath();ctx.moveTo(q[0][0],q[0][1]);ctx.lineTo(q[1][0],q[1][1]);ctx.lineTo(q[2][0],q[2][1]);ctx.lineTo(q[3][0],q[3][1]);ctx.closePath();ctx.fill();
        }
      }
    }
  }
  if(model){ /* 分层接触阴影：外层柔和 + 内层浓郁，沿光反方向偏移 */
    const b=bbox(model),c=b.center;
    const p=E3.proj(c[0],fy,c[2]);
    if(p[2]>.3){
      const rx=(b.span*.46)*p[3],ry=rx*.30;
      const ox=rx*0.10,oy=ry*0.20;
      if(rx>4){
        const g1=ctx.createRadialGradient(p[0]+ox,p[1]+oy,0,p[0]+ox,p[1]+oy,rx);
        g1.addColorStop(0,th.floor);g1.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g1;
        ctx.beginPath();ctx.ellipse(p[0]+ox,p[1]+oy,rx,ry,0,0,TAU);ctx.fill();
        const g2=ctx.createRadialGradient(p[0]+ox*.5,p[1]+oy*.5,0,p[0]+ox*.5,p[1]+oy*.5,rx*.52);
        g2.addColorStop(0,th.floor2||th.floor);g2.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g2;
        ctx.beginPath();ctx.ellipse(p[0]+ox*.5,p[1]+oy*.5,rx*.52,ry*.62,0,0,TAU);ctx.fill();
      }
    }
  }
};
/* 全局主题引用（由 UI 更新） */
var opts0={theme:{grid:'rgba(70,86,94,.09)',floor:'rgba(24,34,40,.17)',floor2:'rgba(14,22,26,.28)',spot:'rgba(255,252,246,.50)',labelBg:'rgba(255,255,255,.94)',labelTx:'#0e6b57',table:'#e6e2d5',tableEdge:'#9d9787',tableGlow:'rgba(255,255,255,.5)'}};
E3.setTheme=function(t){opts0.theme=t;};
})();
