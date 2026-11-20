/* ============================================================================
 * 抽取自 index.html 内联 <script> #6（原行 2754–3499）。
 * 模型构建器 B：测量/加热/分离仪器 + 分子
 * 工作流 1（性能与工程重构）：内容原样搬运，仅做加载方式改变。
 * 加载方式：按需懒加载（bundle: viewer3d，见 js/loader.js）
 * ========================================================================== */
(function(){'use strict';
const V=E3.v,{L,S,LN,D,F,LB,PT,fin,BOX}=B,M=B.M;
function shadeCol(hex,k){
  const c=hex.length===4?'#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]:hex;
  const r=Math.min(255,Math.round(parseInt(c.substr(1,2),16)*k)),g=Math.min(255,Math.round(parseInt(c.substr(3,2),16)*k)),b=Math.min(255,Math.round(parseInt(c.substr(5,2),16)*k));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
/* 圆环（多段短线拼成） */
function RING(cx,cy,cz,r,col,seg){
  seg=seg||14;const lns=[];
  for(let i=0;i<seg;i++){
    const a1=i/seg*Math.PI*2,a2=(i+1)/seg*Math.PI*2;
    lns.push(LN([cx+r*Math.cos(a1),cy,cz+r*Math.sin(a1)],[cx+r*Math.cos(a2),cy,cz+r*Math.sin(a2)],0.05,col));
  }
  return lns;
}
B.RING=RING;
/* ============ 测量仪器 ============ */
Object.assign(B.app,{
  balance(){ /* 托盘天平：铸铁底座 + 圆柱立柱 + 真横梁 + 吊盘 */
    const parts=[];
    parts.push(PT('底座',[].concat(
      BOX(0,0.12,0,2.6,0.24,1.4,'#4f565e'),
      BOX(0,0.245,0,2.5,0.02,1.3,'#616a73'),
      [[0.95,0.5],[0.95,-0.5],[-0.95,0.5],[-0.95,-0.5]].map(p=>
        this._cyl([p[0],0,p[1]],[p[0],0.04,p[1]],0.1,'#33383d',{edge:'#23272b'})
      ).reduce((x,y)=>x.concat(y),[])
    )));
    parts.push(PT('立柱与刀口',[].concat(
      this._cyl([0,0.24,0],[0,1.46,0],0.12,'#7d868f'),
      this._ring([0,0.9,0],[0,1,0],0.15,0.028,'#9aa4ad'),
      BOX(0,1.52,0,0.3,0.2,0.2,'#5d666f'),
      this._cyl([0,1.52,-0.14],[0,1.52,0.14],0.05,'#3d444a')
    )));
    parts.push(PT('横梁',[].concat(
      this._cyl([-1.5,1.55,0],[1.5,1.55,0],0.055,'#9aa4ad'),
      this._cyl([-0.62,1.55,0],[0.62,1.55,0],0.035,'#c3ccd3'),
      BOX(0.42,1.66,0,0.16,0.16,0.13,'#3d444a'),      /* 游码 */
      (function(){const t=[];for(let k=0;k<11;k++){const x=-1.3+k*0.26;
        t.push(LN([x,1.545,0.062],[x,1.545,0.12],0.013,'#dbe3e8'));}return t;})()
    )));
    parts.push(PT('指针与刻度板',[
      this._cyl([0,1.5,0.1],[0,0.9,0.15],0.022,'#d94f43'),
      F([[-0.34,0.66,0.17],[0.34,0.66,0.17],[0.34,1.02,0.17],[-0.34,1.02,0.17]],'#f6f2e8',{flat:true,edge:'#6e7d88',lw:.8,zBias:1}),
      LN([-0.24,0.72,0.175],[0.24,0.72,0.175],0.014,'#454b52'),
      LN([-0.16,0.98,0.175],[0.16,0.98,0.175],0.014,'#454b52'),
      LN([0,0.68,0.175],[0,1.04,0.175],0.016,'#454b52')
    ]));
    const pan=(x,nm,extra)=>PT(nm,[].concat(
      this._cyl([x,1.55,0],[x,1.22,0],0.032,'#9aa4ad'),
      this._ring([x,1.19,0],[0,1,0],0.1,0.022,'#9aa4ad'),
      L([[0.02,0],[0.34,0.012],[0.5,0.05],[0.56,0.12],[0.56,0.17]],{col:'#d9e0e5',edge:'#93a0a9',off:[x,1.02,0]}),
      /* 浅碟内壁：比外壁亮一点，读出凹陷感 */
      L([[0.02,0.028],[0.32,0.038],[0.47,0.072],[0.52,0.13]],{col:'#eef3f6',edge:null,off:[x,1.02,0]})
    ).concat(extra||[]));
    parts.push(pan(-1.45,'左托盘（放物体）'));
    parts.push(pan(1.45,'右托盘（放砝码）',[
      L([[0.0,0.14],[0.2,0.14],[0.2,0.33],[0.0,0.33]],{col:'#aab4bc',edge:'#6e7d88',flat:true,off:[1.3,1.02,0.08]}),
      L([[0.0,0.14],[0.13,0.14],[0.13,0.27],[0.0,0.27]],{col:'#bcc6cd',edge:'#6e7d88',flat:true,off:[1.62,1.02,-0.1]})
    ]));
    return fin(parts);
  },
  ebal(){ /* 电子天平 */
    const parts=[];
    parts.push(PT('机身',[].concat(BOX(0,0.22,0,1.95,0.44,1.55,'#eceff2',{edge:'#c6ccd2'}),
      [F([[-0.62,0.02,0.78],[0.62,0.02,0.78],[0.62,0.4,0.78],[-0.62,0.4,0.78]],'#1d2733',{})])));
    parts.push(PT('显示屏',[
      F([[-0.55,0.12,0.785],[0.55,0.12,0.785],[0.55,0.32,0.785],[-0.55,0.32,0.785]],'#0d1620',{}),
      LN([-0.38,0.22,0.79],[-0.1,0.22,0.79],0.02,'#39d98a'),
      LN([0.05,0.22,0.79],[0.4,0.22,0.79],0.02,'#39d98a')
    ]));
    parts.push(PT('秤盘',[D([0,0.47,0],[0,1,0],0.6,'#c9d2d8',{edge:M.metalDark}),D([0,0.49,0],[0,1,0],0.52,'#e6ebee')]));
    parts.push(PT('按键',[D([0.72,0.06,0.786],[0,0,1],0.05,'#454b52'),D([0.87,0.06,0.786],[0,0,1],0.05,'#454b52')]));
    return fin(parts);
  },
  phm(){ /* pH 计（笔式） */
    const parts=[];
    parts.push(PT('笔杆',[LN([0,0.7,0],[0,3.1,0],0.22,'#e8ebee'),LN([0,0.7,0],[0,3.1,0],0.185,'#f6f8f9')]));
    parts.push(PT('显示屏',[
      F([[-0.17,2.3,0.213],[0.17,2.3,0.213],[0.17,2.72,0.213],[-0.17,2.72,0.213]],'#101820',{}),
      LN([-0.1,2.5,0.216],[0.02,2.5,0.216],0.02,'#39d98a'),
      LN([0.05,2.62,0.216],[0.1,2.62,0.216],0.02,'#39d98a')
    ]));
    parts.push(PT('按键',[D([0,1.9,0.223],[0,0,1],0.06,'#454b52'),D([0,1.6,0.223],[0,0,1],0.06,'#454b52')]));
    parts.push(PT('电极与玻璃泡',[
      LN([0,0.7,0],[0,0.05,0],0.12,'#d8edf3'),
      S([0,-0.1,0],0.2,'#d8edf3')
    ]));
    return fin(parts);
  },
  therm(){ /* 温度计：密集刻度 + 红柱圆头 */
    const parts=[];
    parts.push(PT('感温泡与红液',[S([0,-0.16,0],0.17,'#e74c3c'),LN([0,-0.02,0],[0,2.3,0],0.05,'#e74c3c'),S([0,2.3,0],0.052,'#e0554a')]));
    parts.push(PT('玻璃管',[LN([0,-0.02,0],[0,3.5,0],0.1,'#eef4f7')]));
    const marks=[];
    for(let k=0;k<15;k++){const y=0.3+k*0.21;marks.push(LN([0.105,y,0],[0.105+(k%5===0?0.1:0.05),y],0.013,'#8899a4'));}
    parts.push(PT('刻度',marks));
    parts.push(PT('背板高光',[F([[-0.09,0.2,0.03],[-0.03,0.2,0.03],[-0.03,3.3,0.03],[-0.09,3.3,0.03]],'#ffffff',{flat:true,zBias:2.5,alpha:.3})]));
    return fin(parts);
  },
  hyd(){ /* 密度计 */
    const parts=[];
    parts.push(PT('玻璃管体',[L([[0.02,0.1],[0.14,0.14],[0.22,0.5],[0.3,1.0],[0.3,1.7],[0.2,2.1],[0.11,2.4],[0.11,3.2],[0.16,3.24],[0.16,3.32],[0.11,3.34]],{alpha:.6})]));
    parts.push(PT('下部配重（铅粒）',[L([[0.02,0.12],[0.14,0.16],[0.2,0.5],[0.2,1.0]],{col:'#454b52',edge:'#2c3138',flat:true})]));
    const marks=[];
    for(let k=0;k<6;k++){const y=2.5+k*0.12;marks.push(LN([0.115,y,0],[0.16,y],0.012,'#8899a4'));}
    parts.push(PT('刻度',marks));
    return fin(parts);
  },
  watch2(){ /* 秒表 */
    const parts=[];
    parts.push(PT('表壳',[L([[0.02,0],[0.55,0.02],[0.66,0.16],[0.66,0.5],[0.52,0.64],[0.02,0.64]],{col:'#3b3f46',edge:'#23262b',flat:true})]));
    parts.push(PT('表盘',[
      D([0,0.34,0.66],[0,0,1],0.52,'#f8f9fa',{edge:'#23262b'}),
      D([0,0.34,0.662],[0,0,1],0.42,'#ffffff')
    ]));
    const ticks=[];
    for(let k=0;k<12;k++){const a=k/12*Math.PI*2;
      ticks.push(LN([Math.cos(a)*0.44,0.34,0.665+Math.sin(a)*0.44],[Math.cos(a)*0.36,0.34,0.665+Math.sin(a)*0.36],0.016,'#454b52'));}
    parts.push(PT('刻度',ticks));
    parts.push(PT('指针',[
      LN([0,0.34,0.67],[0.3,0.34,0.67],0.025,'#2c3138'),
      LN([0,0.34,0.672],[Math.cos(2.1)*0.2,0.34+Math.sin(2.1)*0.2,0.672],0.03,'#e74c3c')
    ]));
    parts.push(PT('按钮',[LN([0,0.64,0],[0,0.9,0],0.09,'#3b3f46'),D([0,0.92,0],[0,1,0],0.09,'#565b62'),LN([0.5,0.55,0],[0.62,0.62,0],0.06,'#3b3f46')]));
    return fin(parts);
  },
  /* ============ 加热设备 ============ */
  lamp(){ /* 酒精灯：收腰双层火焰 + 灯帽斜靠灯身 */
    const parts=[];
    parts.push(PT('灯体',[L([[0.02,0],[0.75,0.02],[0.95,0.1],[0.98,0.32],[0.98,1.2],[0.82,1.38],[0.75,1.4]],{alpha:.55})]));
    parts.push(PT('酒精',[L([[0.02,0.1],[0.9,0.16],[0.9,0.95]],{col:'#eef3f6',alpha:.8,edge:null,flat:true,cull:true}),D([0,0.95,0],[0,1,0],0.88,'#f6f9fa',{flat:true})]));
    parts.push(PT('灯芯与火焰',[
      LN([0,1.3,0],[0,1.74,0],0.05,'#e8e0cc'),
      L([[0.02,1.74],[0.13,1.82],[0.2,2.0],[0.16,2.3],[0.07,2.56],[0.02,2.66]],{col:'#ff9428',alpha:.85,edge:null,flat:true}),
      L([[0.02,1.74],[0.08,1.8],[0.11,1.94],[0.08,2.14],[0.03,2.28],[0.02,2.32]],{col:'#ffd23d',alpha:.88,edge:null,flat:true}),
      L([[0.02,1.74],[0.04,1.79],[0.05,1.86],[0.02,1.92]],{col:'#7ab8e8',alpha:.9,edge:null,flat:true}),
      B.GLOW([0,2.05,0],0.75,'rgba(255,170,70,.32)')
    ]));
    parts.push(PT('灯帽（斜靠灯身）',[
      LN([1.28,0.26,0.5],[1.72,0.62,0.72],0.29,M.capDark),
      D([1.28,0.26,0.5],[0.42,0.5,0.26],0.29,'#6b7a86',{flat:true}),
      D([1.72,0.62,0.72],[-0.42,-0.5,-0.26],0.29,'#7d8b96',{flat:true})
    ]));
    parts.push(PT('灯身高光',[F([[-0.5,0.35,0.86],[-0.38,0.35,0.86],[-0.38,1.05,0.86],[-0.5,1.05,0.86]],'#ffffff',{flat:true,zBias:2.5,alpha:.3})]));
    return fin(parts,{fire:true});
  },
  tri(){ /* 三脚架与石棉网 */
    const parts=[];
    const legs=[];
    for(let i=0;i<3;i++){
      const a=Math.PI/2+i/3*Math.PI*2;
      const p0=[Math.cos(a)*1.26,0.95,Math.sin(a)*1.26];
      const p1=[Math.cos(a)*0.5,0.02,Math.sin(a)*0.5];
      legs.push(this._cyl(p0,p1,0.055,'#6d7781'));
      legs.push(B.S(p1,0.062,'#3d444a')); /* 脚垫 */
    }
    parts.push(PT('三脚架',legs.concat(this._ring([0,0.95,0],[0,1,0],1.3,0.045,'#79838c'))));
    parts.push(PT('石棉网',[
      /* 方形铁网 + 中央石棉圆片：真实石棉网是"铁丝网夹一片石棉"，不是一块圆盘 */
      F([[-1.12,1.02,-1.12],[1.12,1.02,-1.12],[1.12,1.02,1.12],[-1.12,1.02,1.12]],'#cfc9bb',{edge:'#a49e90'}),
      D([0,1.03,0],[0,1,0],0.78,'#e8e1d2',{flat:true,edge:'#c6bfae'}),
      (function(){const g=[];for(let i=-2;i<=2;i++){const p=i*0.45;
        g.push(LN([p,1.031,-1.1],[p,1.031,1.1],0.012,'#aaa494'));
        g.push(LN([-1.1,1.031,p],[1.1,1.031,p],0.012,'#aaa494'));}
        return g;})()
    ]));
    return fin(parts);
  },
  cruc(){ /* 坩埚 */
    const parts=[];
    parts.push(PT('坩埚体',[L([[0.02,0],[0.38,0.02],[0.56,0.14],[0.62,0.45],[0.66,0.75],[0.7,0.75]],{col:M.porcelain,edge:M.porcEdge,alpha:.95})]));
    parts.push(PT('坩埚盖',[
      L([[0.68,0.75],[0.68,0.8],[0.42,0.92],[0.14,0.98],[0.02,0.99]],{col:M.porcelain,edge:M.porcEdge}),
      D([0,1.0,0],[0,1,0],0.1,M.porcEdge,{flat:true})
    ]));
    return fin(parts);
  },
  evap(){ /* 蒸发皿 */
    const parts=[];
    parts.push(PT('蒸发皿',[L([[0.02,0],[0.48,0.04],[0.78,0.2],[1.0,0.5],[1.08,0.72],[1.12,0.78],[1.12,0.88],[1.05,0.88]],{col:M.porcelain,edge:M.porcEdge,alpha:.95})]));
    parts.push(PT('液体（蒸发中）',[
      L([[0.02,0.08],[0.7,0.22],[0.85,0.4],[0.9,0.5],[0.6,0.55],[0.1,0.3]],{col:'#a8d4e8',alpha:.87,edge:null,flat:true,cull:true})
    ]));
    return fin(parts);
  },
  tong(){ /* 坩埚钳 */
    const parts=[];
    const arm=(s)=>[].concat(
      this._cyl([0,1.12,0],[0.26*s,0.62,0],0.05,'#9aa3ab'),
      this._cyl([0.26*s,0.62,0],[0.42*s,0.36,0],0.048,'#9aa3ab'),
      this._cyl([0.42*s,0.36,0],[0.3*s,-0.5,0],0.042,'#9aa3ab'),
      this._cyl([0.3*s,-0.5,0],[0.075*s,-1.18,0],0.032,'#3d444a')
    );
    parts.push(PT('左钳臂',arm(1)));
    parts.push(PT('右钳臂',arm(-1)));
    parts.push(PT('铆钉与指环',[
      B.TUBE([0,1.12,-0.09],[0,1.12,0.09],0.062,{col:'#5b646d',alpha:1,edge:'#2f353b',seg:12}),
      this._ring([0,1.12,0],[0,0,1],0.13,0.026,'#6d7781')
    ]));
    return fin(parts);
  },
  /* ---- 金属杆件原语：真三维圆柱 + 圆环 + 蝶形螺丝（替代屏幕空间直线 LN） ---- */
  _cyl(a,b,r,col,o){
    o=o||{};
    return B.TUBE(a,b,r,{
      col:col||M.metal,alpha:o.alpha!==undefined?o.alpha:1,
      edge:o.edge!==undefined?o.edge:shadeCol(col||M.metal,.86),
      seg:o.seg||18
    });
  },
  _ring(c,n,R,r,col,o){ /* 用 N 段短圆柱拼一只真正的金属圆环 */
    o=o||{};const seg=o.seg||26,out=[];
    let u=V.cross(n,[0,1,0]);if(V.len(u)<.01)u=[1,0,0];
    u=V.norm(u);const w=V.cross(n,u);
    const P=a=>[c[0]+(u[0]*Math.cos(a)+w[0]*Math.sin(a))*R,
                c[1]+(u[1]*Math.cos(a)+w[1]*Math.sin(a))*R,
                c[2]+(u[2]*Math.cos(a)+w[2]*Math.sin(a))*R];
    for(let i=0;i<seg;i++){
      out.push(B.TUBE(P(i/seg*Math.PI*2),P((i+1)/seg*Math.PI*2),r,
        {col:col||M.iron,alpha:1,edge:shadeCol(col||M.iron,.8),seg:7}));
    }
    return out;
  },
  _screw(c,dir,len,r,col){ /* 蝶形螺丝：螺杆 + 两片蝶翼 */
    const d=V.norm(dir);
    let t=V.cross(d,[0,1,0]);if(V.len(t)<.01)t=V.cross(d,[1,0,0]);
    t=V.norm(t);const b=V.cross(d,t);
    const tip=[c[0]+d[0]*len,c[1]+d[1]*len,c[2]+d[2]*len];
    const out=[B.TUBE(c,tip,r,{col:col||M.metalDark,alpha:1,edge:shadeCol(col||M.metalDark,.5),seg:10})];
    [1,-1].forEach(s=>{
      const p=[tip[0]+t[0]*0.11*s,tip[1]+t[1]*0.11*s,tip[2]+t[2]*0.11*s];
      out.push(B.TUBE(tip,p,r*0.62,{col:col||M.metalDark,alpha:1,edge:shadeCol(col||M.metalDark,.5),seg:8}));
    });
    out.push(B.S(tip,r*0.95,col||M.metalDark));
    return out;
  },
  gasjar(){ /* 集气瓶（磨砂口 + 玻璃片） */
    const parts=[];
    parts.push(PT('瓶体',[L([[0.02,0],[0.92,0.03],[1.02,0.14],[1.04,0.9],[1.02,1.42],[0.9,1.5],[0.88,1.56]],{alpha:.34})]));
    parts.push(PT('磨砂瓶口',[L([[0.885,1.44],[0.885,1.56]],{col:'#e9eff3',edge:'#b9c6cf',flat:true,alpha:.6})]));
    parts.push(PT('玻璃片',[
      F([[-0.98,1.62,-0.98],[0.98,1.62,-0.98],[0.98,1.62,0.98],[-0.98,1.62,0.98]],'#e8f3f8',{edge:'#b9c6cf',alpha:.45}),
      F([[-0.7,1.625,-0.7],[0.7,1.625,-0.7],[0.7,1.625,0.7],[-0.7,1.625,0.7]],'#ffffff',{alpha:.18})
    ]));
    return fin(parts);
  },
  washb(){ /* 洗气瓶：双孔塞 + 长进短出导管 */
    const parts=[];
    parts.push(PT('瓶体',[L([[0.02,0],[0.95,0.03],[1.06,0.16],[1.08,1.1],[1.04,1.46],[0.88,1.54],[0.86,1.6]],{alpha:.34})]));
    parts.push(PT('吸收液',[
      L([[0.02,0.1],[0.98,0.14],[1.0,0.5],[1.0,0.88]],{col:'#b3d9ec',alpha:.88,edge:null,flat:true,cull:true}),
      D([0,0.88,0],[0,1,0],0.98,'#c9e6f5',{flat:true})
    ]));
    parts.push(PT('双孔橡胶塞',[L([[0.02,1.56],[0.86,1.56],[0.86,1.78],[0.02,1.78]],{col:M.rubber,edge:shadeCol(M.rubber,.6),flat:true})]));
    parts.push(PT('长导管（进气，插到液面下）',[B.TUBE([-0.34,2.36,0],[-0.34,0.16,0],0.058,{col:'#dceaf2',alpha:.42,edge:null,seg:14})]));
    parts.push(PT('短导管（出气）',[B.TUBE([0.32,2.36,0],[0.32,1.32,0],0.058,{col:'#dceaf2',alpha:.42,edge:null,seg:14})]));
    return fin(parts);
  },
  drytube(){ /* 球形干燥管 */
    const parts=[];
    parts.push(PT('管体',[L([[0.02,0],[0.15,0],[0.15,0.72],[0.36,0.78],[0.54,0.94],[0.6,1.24],[0.54,1.54],[0.36,1.7],[0.15,1.76],[0.15,2.44],[0.02,2.44]],{alpha:.34})]));
    parts.push(PT('干燥剂（无水氯化钙）',[
      L([[0.02,0.8],[0.34,0.86],[0.5,1.0],[0.55,1.24],[0.5,1.48],[0.34,1.62],[0.02,1.66]],{col:'#efe9dc',alpha:.9,edge:null,flat:true,cull:true})
    ]));
    parts.push(PT('棉花塞',[
      L([[0.06,1.66],[0.14,1.66],[0.14,1.8]],{col:'#f6f3ea',edge:'#ddd7c8',flat:true,alpha:.9}),
      L([[0.06,0.78],[0.14,0.78],[0.14,0.66]],{col:'#f6f3ea',edge:'#ddd7c8',flat:true,alpha:.9})
    ]));
    return fin(parts);
  },
  ushape(){ /* U 形管 */
    const parts=[];
    const g={col:'#eaf6fb',alpha:.42,edge:null,seg:18};
    parts.push(PT('U 形管',[
      B.TUBE([-0.62,2.16,0],[-0.62,0.62,0],0.2,g),
      B.TUBE([-0.62,0.62,0],[-0.47,0.4,0],0.2,g),
      B.TUBE([-0.47,0.4,0],[0.47,0.4,0],0.2,g),
      B.TUBE([0.47,0.4,0],[0.62,0.62,0],0.2,g),
      B.TUBE([0.62,0.62,0],[0.62,2.16,0],0.2,g)
    ]));
    parts.push(PT('管内液体',[
      B.TUBE([-0.62,0.9,0],[-0.62,0.3,0],0.16,{col:'#a9d3e8',alpha:.9,edge:null,seg:12}),
      B.TUBE([-0.62,0.3,0],[0.62,0.3,0],0.16,{col:'#a9d3e8',alpha:.9,edge:null,seg:12}),
      B.TUBE([0.62,0.3,0],[0.62,0.75,0],0.16,{col:'#a9d3e8',alpha:.9,edge:null,seg:12})
    ]));
    return fin(parts);
  },
  clamp(){ /* 试管夹：木柄 + 金属夹口 + 弹簧 */
    const parts=[];
    parts.push(PT('木柄',[
      B.TUBE([0,-1.1,0.08],[0,0.5,0.08],0.13,'#c99b66',{edge:'#9a7346',seg:12}),
      B.TUBE([0,-1.1,-0.08],[0,0.5,-0.08],0.13,'#bd8f5b',{edge:'#8f6b3f',seg:12})
    ]));
    parts.push(PT('夹臂',[
      this._cyl([0,0.5,0.09],[0.42,1.28,0.09],0.038,'#9aa4ad'),
      this._cyl([0,0.5,-0.09],[0.42,1.28,-0.09],0.038,'#9aa4ad'),
      this._cyl([0.42,1.28,0.09],[0.66,1.5,0.09],0.032,'#b9c3cb'),
      this._cyl([0.42,1.28,-0.09],[0.66,1.5,-0.09],0.032,'#b9c3cb')
    ]));
    parts.push(PT('夹口衬垫',[
      B.TUBE([0.5,1.36,0.09],[0.66,1.5,0.09],0.042,{col:'#3f464c',alpha:1,edge:'#2b3035',seg:8}),
      B.TUBE([0.5,1.36,-0.09],[0.66,1.5,-0.09],0.042,{col:'#3f464c',alpha:1,edge:'#2b3035',seg:8})
    ]));
    parts.push(PT('弹簧',this._ring([0,0.5,0],[1,0,0],0.1,0.022,'#8f99a2')));
    return fin(parts);
  },
  dropper(){ /* 胶头滴管 */
    const parts=[];
    parts.push(PT('玻璃管',[L([[0.02,0],[0.05,0.02],[0.06,0.3],[0.085,0.5],[0.085,1.66],[0.07,1.7],[0.07,1.74]],{alpha:.4})]));
    parts.push(PT('管内试液',[L([[0.02,0.04],[0.062,0.06],[0.07,0.92]],{col:'#bfe0ef',alpha:.85,edge:null,flat:true,cull:true})]));
    parts.push(PT('胶帽',[L([[0.02,1.72],[0.09,1.74],[0.16,1.86],[0.19,2.1],[0.15,2.32],[0.06,2.44],[0.02,2.46]],{col:M.rubber,edge:shadeCol(M.rubber,.62),flat:true})]));
    return fin(parts);
  },
  calor(){ /* 简易量热计：保温外筒 + 内筒 + 盖板 + 温度计 + 环形搅拌棒 */
    const parts=[];
    parts.push(PT('保温外筒',[L([[0.02,0],[0.95,0.02],[1.05,0.1],[1.08,0.5],[1.08,1.6],[0.95,1.68],[0.9,1.7]],{col:'#e4eaf0',edge:'#aeb9c2',alpha:.42})]));
    parts.push(PT('内筒（反应容器）',[L([[0.02,0.12],[0.78,0.14],[0.83,0.2],[0.85,1.48],[0.76,1.54],[0.72,1.56]],{alpha:.34})]));
    parts.push(PT('反应液',[
      L([[0.02,0.18],[0.72,0.2],[0.75,0.24],[0.75,0.88]],{col:'#cfe6f2',alpha:.88,edge:null,flat:true,cull:true}),
      D([0,0.88,0],[0,1,0],0.73,'#dceff8',{flat:true})
    ]));
    parts.push(PT('盖板',[L([[0.02,1.56],[0.9,1.56],[0.9,1.7],[0.02,1.7]],{col:'#dfe4e8',edge:'#aeb8bf',flat:true,alpha:.55})]));
    parts.push(PT('温度计',[L([[0.02,1.68],[0.045,1.7],[0.045,2.96],[0.02,2.96]],{alpha:.42,off:[0.28,0,0]}),
      L([[0.02,1.72],[0.03,1.74],[0.03,2.2]],{col:'#e0554a',alpha:.9,edge:null,off:[0.28,0,0]})]));
    parts.push(PT('环形玻璃搅拌棒',[].concat(
      this._cyl([-0.32,2.24,0],[-0.32,0.46,0],0.032,'#9aa4ad'),
      this._ring([-0.32,0.42,0],[0,1,0],0.2,0.028,'#9aa4ad')
    )));
    return fin(parts);
  },
  stand(){ /* 铁架台：铸铁底座 + 真圆柱立柱 + 十字夹 + 铁圈 + 铁夹 */
    const parts=[];
    /* 底座：铸铁板（上下两层做出铸造倒角）+ 四只橡胶地脚 */
    parts.push(PT('铸铁底座',[].concat(
      BOX(0,0.07,0,1.95,0.14,1.28,'#565f67'),
      BOX(0,0.145,0,1.86,0.03,1.2,'#6a747c'),
      BOX(0,0.015,0,1.99,0.03,1.32,'#3f464c'),
      [[0.78,0.52],[0.78,-0.52],[-0.78,0.52],[-0.78,-0.52]].map(p=>
        B.TUBE([p[0],0,p[1]],[p[0],-0.055,p[1]],0.085,{col:M.rubber,alpha:1,edge:'#22262a',seg:10})
      ).reduce((a,b)=>a.concat(b),[])
    )));
    /* 立柱：真圆柱（有高光与明暗过渡），根部铸一个凸台 */
    parts.push(PT('立柱',[].concat(
      B.TUBE([-0.72,0.15,0],[-0.72,0.34,0],0.19,{col:'#69737c',alpha:1,edge:'#4a5259',seg:18}),
      B.TUBE([-0.72,0.32,0],[-0.72,3.78,0],0.085,{col:'#9aa4ad',alpha:1,edge:'#727c85',seg:20}),
      B.TUBE([-0.72,3.78,0],[-0.72,3.86,0],0.1,{col:'#aeb8c0',alpha:1,edge:'#7b858e',seg:14}),
      this._cyl([-0.72,3.86,0],[-0.72,3.9,0],0.075,'#b9c3cb')
    )));
    /* 十字夹（铁圈）：夹块 + 蝶形螺丝 + 横臂 + 铁圈 */
    parts.push(PT('铁圈（十字夹）',[].concat(
      BOX(-0.72,2.36,0,0.3,0.34,0.24,'#6f7982'),
      BOX(-0.72,2.36,0,0.34,0.1,0.28,'#828c96'),
      this._screw([-0.72,2.36,0.12],[0,0,1],0.16,0.028),
      this._cyl([-0.6,2.36,0],[0.06,2.36,0],0.045,'#8b959e'),
      this._ring([0.62,2.36,0],[0,1,0],0.56,0.038,'#8f99a2')
    )));
    /* 铁夹：夹块 + 蝶形螺丝 + 横臂 + 上下两片夹臂 + 压紧钮 */
    parts.push(PT('铁夹',[].concat(
      BOX(-0.72,3.16,0,0.3,0.34,0.24,'#6f7982'),
      BOX(-0.72,3.16,0,0.34,0.1,0.28,'#828c96'),
      this._screw([-0.72,3.16,0.12],[0,0,1],0.16,0.028),
      this._cyl([-0.6,3.16,0],[-0.12,3.16,0],0.045,'#8b959e'),
      this._cyl([-0.12,3.16,0],[-0.06,3.34,0],0.04,'#8f99a2'),
      this._cyl([-0.12,3.16,0],[-0.06,2.98,0],0.04,'#8f99a2'),
      this._cyl([-0.06,3.34,0],[0.22,3.3,0],0.036,'#8f99a2'),
      this._cyl([-0.06,2.98,0],[0.22,3.02,0],0.036,'#8f99a2'),
      B.S([0.24,3.16,0],0.062,'#3d444a'),
      this._cyl([-0.12,3.16,0],[0,3.16,0],0.055,'#3d444a')
    )));
    return fin(parts);
  },
  /* ============ 分离提纯 ============ */
  distill(){ /* 蒸馏装置（组合） */
    const parts=[];
    const bx=-2.1;
    parts.push(PT('圆底烧瓶',[
      L([[0.02,0.28],[0.3,0.34],[0.62,0.52],[0.92,0.86],[1.06,1.3],[1.06,1.6],[0.9,1.95],[0.6,2.2],[0.34,2.3],[0.28,2.32],[0.28,3.4],[0.35,3.42],[0.35,3.5],[0.28,3.52]],{alpha:.4,off:[bx,0,0]}),
      L([[0.02,0.3],[0.4,0.4],[0.75,0.68],[0.92,1.05],[0.94,1.35],[0.6,1.75],[0.1,1.9],[0.02,1.55]],{col:'#bfe4f0',alpha:.83,edge:null,flat:true,cull:true,off:[bx,0,0]}),
      D([bx,1.85,0],[0.1,0.98,-0.1],0.5,'#d2ecf5',{flat:true})
    ]));
    parts.push(PT('温度计',[
      LN([bx,3.5,0],[bx,2.55,0],0.06,'#eef4f7'),
      LN([bx,2.62,0],[bx,3.42,0],0.028,'#e74c3c'),
      S([bx,2.62,0],0.09,'#e74c3c')
    ]));
    parts.push(PT('酒精灯热源',[
      L([[0.02,-0.5],[0.55,0.02],[0.68,0.1],[0.7,0.3],[0.7,0.85],[0.58,1.0],[0.52,1.02]],{alpha:.4,off:[bx,0,0]}),
      LN([bx,-0.2,0],[bx,0.35,0],0.05,'#e8e0cc'),
      L([[0.02,0.35],[0.12,0.44],[0.17,0.62],[0.13,0.85],[0.05,1.02],[0.02,1.08]],{col:'#ff8c2e',alpha:.83,edge:null,flat:true,cull:true,off:[bx,0,0]})
    ]));
    const cA=[bx+0.28,3.35,0],cB=[1.35,1.6,0];
    parts.push(PT('直形冷凝管',[
      B.TUBE([cA[0]-0.1,cA[1]+0.08,0],[cB[0]+0.04,cB[1]-0.05,0],0.42,{}),
      B.TUBE([cA[0]-0.1,cA[1]+0.08,0],[cB[0]+0.04,cB[1]-0.05,0],0.30,{col:'#a5d5e8',alpha:.5,edge:null}),
      B.TUBE(cA,cB,0.13,{}),
      B.TUBE([cA[0]-0.2,cA[1]+0.15,0.28],[cA[0]-0.75,cA[1]+0.4,0.75],0.09,{}),
      B.TUBE([cB[0]+0.2,cB[1]-0.15,-0.3],[cB[0]+0.75,cB[1]-0.4,-0.75],0.09,{})
    ]));
    parts.push(PT('尾接管',[
      B.TUBE([1.35,1.6,0],[1.9,1.15,0],0.16,{}),
      B.TUBE([1.9,1.15,0],[2.15,0.98,0],0.13,{})
    ]));
    parts.push(PT('锥形瓶（接收）',[
      L([[0.02,0],[0.6,0.02],[0.78,0.12],[0.8,0.35],[0.8,0.5],[0.24,1.75],[0.24,2.05],[0.3,2.07],[0.3,2.18],[0.24,2.2]],{alpha:.4,off:[2.15,0,0]})
    ]));
    return fin(parts);
  },
  vac(){ /* 抽滤装置 */
    const parts=[];
    parts.push(PT('布氏漏斗',[
      L([[0.02,1.95],[0.72,1.95],[0.72,2.5],[0.35,2.72],[0.22,2.85],[0.22,3.1]],{alpha:.45,off:[0,0,0]}),
      D([0,2.48,0],[0,1,0],0.68,'#dfe8ed',{flat:true,alpha:.9}),
      D([0,2.5,0],[0,1,0],0.6,'#ffffff',{flat:true,edge:'#d9d5c5'})
    ]));
    parts.push(PT('橡胶塞',[
      L([[0.02,1.72],[0.4,1.76],[0.42,1.95],[0.32,2.2],[0.2,2.3],[0.02,2.3]],{col:M.rubber,edge:shadeCol(M.rubber,.55),flat:true})
    ]));
    parts.push(PT('抽滤瓶',[
      L([[0.02,0],[0.6,0.02],[0.8,0.14],[0.85,0.4],[0.85,0.6],[0.3,1.6],[0.3,1.7]],{alpha:.55}),
      B.TUBE([0,1.35,0],[0.9,1.9,0.35],0.13,{})
    ]));
    parts.push(PT('滤液',[
      L([[0.02,0.1],[0.72,0.18],[0.78,0.42],[0.78,0.6],[0.4,1.2],[0.05,1.25]],{col:'#cfe8f2',alpha:.83,edge:null,flat:true,cull:true})
    ]));
    return fin(parts);
  },
  ccol(){ /* 层析柱 */
    const parts=[];
    parts.push(PT('柱体',[
      L([[0.02,0.9],[0.3,0.9],[0.34,1.05],[0.34,3.9],[0.46,3.95],[0.46,4.1],[0.34,4.12]],{alpha:.55})
    ]));
    parts.push(PT('固定相（硅胶）',[
      L([[0.02,1.0],[0.32,1.05],[0.32,2.1]],{col:'#f4f1e8',alpha:.95,edge:'#d8d2c0',flat:true}),
      D([0,2.1,0],[0,1,0],0.31,'#faf8f0',{flat:true})
    ]));
    parts.push(PT('色带（分离中）',[
      L([[0.02,1.6],[0.32,1.62],[0.32,1.85]],{col:'#e05a5a',alpha:.85,edge:null,flat:true,cull:true}),
      L([[0.02,1.3],[0.32,1.32],[0.32,1.5]],{col:'#e8b84b',alpha:.85,edge:null,flat:true,cull:true})
    ]));
    parts.push(PT('流动相（洗脱液）',[
      L([[0.02,2.15],[0.32,2.18],[0.32,3.4]],{col:'#dceaf0',alpha:.8,edge:null,flat:true,cull:true}),
      D([0,3.4,0],[0,1,0],0.31,'#e8f2f6',{flat:true})
    ]));
    parts.push(PT('下活塞与尖嘴',[
      LN([-0.42,0.82,0],[0.42,0.82,0],0.08,M.glass),
      S([0.54,0.82,0],0.09,M.glass),
      L([[0.02,0.9],[0.08,0.78],[0.1,0.55],[0.1,0.42],[0.04,0.38],[0.02,0.38]],{alpha:.62})
    ]));
    return fin(parts);
  },
  cent(){ /* 离心机 */
    const parts=[];
    parts.push(PT('机身',[].concat(BOX(0,0.5,0,1.9,1.0,1.5,'#eef1f4',{edge:'#c6ccd2'}),
      [D([0,1.05,0],[0,1,0],0.72,'#dfe5ea',{edge:'#c6ccd2'})])));
    parts.push(PT('透明顶盖',[D([0,1.12,0],[0,1,0],0.7,'#cfe4ec',{alpha:.4,edge:M.glassEdge})]));
    const rotor=[D([0,1.06,0],[0,1,0],0.55,'#8b95a0',{flat:true})];
    const tubes=[];
    for(let i=0;i<4;i++){
      const a=i/4*Math.PI*2+Math.PI/4,tx=Math.cos(a)*0.36,tz=Math.sin(a)*0.36;
      rotor.push(D([tx,1.075,tz],[0,1,0],0.12,'#454b52',{flat:true}));
      tubes.push(L([[0.02,0.78],[0.09,0.78],[0.09,1.28],[0.02,1.28]],{alpha:.5,off:[tx,0,tz]}));
    }
    parts.push(PT('转子与离心管',rotor.concat(tubes)));
    parts.push(PT('控制钮',[D([0.72,0.75,0.756],[0,0,1],0.07,'#454b52'),D([0.72,0.5,0.756],[0,0,1],0.07,'#2c8a6a')]));
    return fin(parts);
  }
});
/* ============ 分子构建 ============ */
function genH(atoms,bonds){ /* 按杂化方式补全氢原子 */
  const adj={};
  bonds.forEach(bd=>{(adj[bd[0]]=adj[bd[0]]||[]).push(bd[1]);(adj[bd[1]]=adj[bd[1]]||[]).push(bd[0]);});
  const n=atoms.length;
  for(let i=0;i<n;i++){
    const a=atoms[i];
    const nb=(adj[i]||[]).filter(j=>atoms[j]&&atoms[j].e!=='H');
    const nd=nb.map(j=>V.norm([atoms[j].x-a.x,atoms[j].y-a.y,atoms[j].z-a.z]));
    let dirs=[];
    if(a.e==='C'){
      const hyb=a.hyb||3;
      if(hyb===2){
        if(nd.length===2){ /* sp2 CH2：平面剩余方向 */
          const su=[nd[0][0]+nd[1][0],nd[0][1]+nd[1][1],nd[0][2]+nd[1][2]];
          dirs=[V.norm([-su[0],-su[1],-su[2]])];
        }
        /* sp2 且邻位数 1 或 3：氢原子均已显式定义（乙烯/乙炔等），不自动补 */
      } else if(hyb===1){
        if(nd.length===1)dirs=[[-nd[0][0],-nd[0][1],-nd[0][2]]];
      } else { /* sp3 */
        if(nd.length===1){
          const d=nd[0],ax=[0,0,1];if(Math.abs(d[2])>0.9)ax=[1,0,0];
          const u=V.norm(V.cross(d,ax)),w=V.cross(d,u);
          for(let k=0;k<3;k++){const th=k/3*Math.PI*2;
            dirs.push([d[0]*-1/3+(u[0]*Math.cos(th)+w[0]*Math.sin(th))*2*Math.SQRT2/3,
                       d[1]*-1/3+(u[1]*Math.cos(th)+w[1]*Math.sin(th))*2*Math.SQRT2/3,
                       d[2]*-1/3+(u[2]*Math.cos(th)+w[2]*Math.sin(th))*2*Math.SQRT2/3]);}
        } else if(nd.length===2){
          const su=[nd[0][0]+nd[1][0],nd[0][1]+nd[1][1],nd[0][2]+nd[1][2]];
          const m=V.norm(su),w=V.norm(V.cross(nd[0],nd[1]));
          const c=0.577,s=0.816;
          dirs=[[(-m[0]*c+w[0]*s),(-m[1]*c+w[1]*s),(-m[2]*c+w[2]*s)],[(-m[0]*c-w[0]*s),(-m[1]*c-w[1]*s),(-m[2]*c-w[2]*s)]];
        } else if(nd.length===3){
          const su=nd.reduce((s,u)=>[s[0]+u[0],s[1]+u[1],s[2]+u[2]],[0,0,0]);
          dirs=[V.norm([-su[0],-su[1],-su[2]])];
        }
      }
    } else if(a.e==='O'){
      if(nb.length===1){
        const hasH=(adj[i]||[]).some(j=>atoms[j]&&atoms[j].e==='H');
        const allSingle=bonds.filter(bd=>bd[0]===i||bd[1]===i).every(bd=>bd[2]===1);
        if(allSingle&&!hasH)dirs=[[-nd[0][0],-nd[0][1],-nd[0][2]]];
      }
    }
    const bl=a.e==='O'?0.96:1.09;
    dirs.forEach(d=>{atoms.push({e:'H',x:a.x+d[0]*bl,y:a.y+d[1]*bl,z:a.z+d[2]*bl});bonds.push([i,atoms.length-1,1]);});
  }
}
function bondLines(a,b,order,col){
  const dir=V.norm(V.sub(b,a));
  let o=V.cross(dir,[0,1,0]);
  if(V.len(o)<0.05)o=V.cross(dir,[1,0,0]);
  o=V.norm(o);
  const r=0.085,off=0.11;
  const lns=[];
  if(order===1||order===undefined){lns.push(LN(a,b,r,col,{gA:undefined,gB:undefined}));}
  else if(order===2){lns.push(LN(V.sub(a,[o[0]*off,o[1]*off,o[2]*off]),V.sub(b,[o[0]*off,o[1]*off,o[2]*off]),r*0.8,col),LN(V.sub(a,[-o[0]*off,-o[1]*off,-o[2]*off]),V.sub(b,[-o[0]*off,-o[1]*off,-o[2]*off]),r*0.8,col));}
  else{lns.push(LN(a,b,r*0.8,col),LN(V.sub(a,[o[0]*off*1.6,o[1]*off*1.6,o[2]*off*1.6]),V.sub(b,[o[0]*off*1.6,o[1]*off*1.6,o[2]*off*1.6]),r*0.7,col),LN(V.sub(a,[-o[0]*off*1.6,-o[1]*off*1.6,-o[2]*off*1.6]),V.sub(b,[-o[0]*off*1.6,-o[1]*off*1.6,-o[2]*off*1.6]),r*0.7,col));}
  return lns;
}
function finishMol(parts){
  const box=E3.bbox({parts:parts});
  parts.forEach((pt,i)=>{
    pt.cen=E3.bbox({parts:[pt]}).center;
    if(pt.fixed){pt.dir=null;return;}
    let d=V.sub(pt.cen,box.center);
    if(V.len(d)<0.3)d=[0,1,0];
    pt.dir=V.norm(d);
    pt.shapes.forEach(s=>{if(s.g===undefined)s.g=i;});
  });
  return {parts:parts,center:box.center,span:box.span,box:box,isMol:true};
}
B.molecule=function(m,mode){
  mode=mode||'ball';
  if(m.crystal)return B.crystal(m);
  const atoms=m.atoms.map(a=>({e:a.e,x:a.x,y:a.y,z:a.z,hyb:a.hyb}));
  const bonds=m.bonds.map(bd=>bd.slice());
  if(m.autoH)genH(atoms,bonds);
  const parts=[];
  atoms.forEach((a,i)=>{
    const el=DB.ELEM[a.e]||DB.ELEM.C;
    const r=mode==='space'?el.vdw*0.8:el.r;
    const shapes=[S([a.x,a.y,a.z],r,el.c)];
    parts.push(PT(a.e,shapes));
  });
  if(mode!=='space'){
    const blns=[];
    bonds.forEach(bd=>{
      const a=atoms[bd[0]],b=atoms[bd[1]];
      const ca=(DB.ELEM[a.e]||DB.ELEM.C).c,cb=(DB.ELEM[b.e]||DB.ELEM.C).c;
      const mix=V.norm(V.sub([b.x,b.y,b.z],[a.x,a.y,a.z]));
      const mid=[(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2];
      bondLines([a.x,a.y,a.z],mid,bd[2],shadeCol(ca,1.9)).forEach(ln=>{ln.gA=bd[0];blns.push(ln);});
      bondLines(mid,[b.x,b.y,b.z],bd[2],shadeCol(cb,1.9)).forEach(ln=>{ln.gB=bd[1];blns.push(ln);});
    });
    parts.push(PT('键',blns));
    parts[parts.length-1].fixed=true;
  }
  /* 标注：每种元素标一次 */
  const seen={};
  atoms.forEach((a,i)=>{if(!seen[a.e]){seen[a.e]=1;parts[i].shapes.push(LB([a.x,a.y,a.z],a.e));}});
  return finishMol(parts);
};
/* ============ 晶体程序生成 ============ */
B.crystal=function(m){
  const parts=[];
  if(m.crystal==='nacl'){
    const a=2.82;
    const cl=[],na=[];
    for(let i=-1;i<=1;i+=2)for(let j=-1;j<=1;j+=2)for(let k=-1;k<=1;k+=2)cl.push([i*a,j*a,k*a]);
    [[a,0,0],[-a,0,0],[0,a,0],[0,-a,0],[0,0,a],[0,0,-a]].forEach(p=>cl.push(p));
    [[0,a,a],[0,a,-a],[0,-a,a],[0,-a,-a],[a,0,a],[a,0,-a],[-a,0,a],[-a,0,-a],[a,a,0],[a,-a,0],[-a,a,0],[-a,-a,0]].forEach(p=>na.push(p));
    na.push([0,0,0]);
    na.forEach(p=>parts.push(PT('Na⁺',[S(p,0.5,DB.ELEM.Na.c)])));
    cl.forEach(p=>parts.push(PT('Cl⁻',[S(p,0.92,DB.ELEM.Cl.c)])));
    const edges=[];
    for(let i=-1;i<=1;i+=2){
      edges.push(LN([i*a,-a,-a],[i*a,a,-a],0.03,'#9aa8b2'),LN([i*a,-a,a],[i*a,a,a],0.03,'#9aa8b2'),LN([i*a,-a,-a],[i*a,-a,a],0.03,'#9aa8b2'),LN([i*a,a,-a],[i*a,a,a],0.03,'#9aa8b2'));
      edges.push(LN([-a,i*a,-a],[a,i*a,-a],0.03,'#9aa8b2'),LN([-a,i*a,a],[a,i*a,a],0.03,'#9aa8b2'));
      edges.push(LN([-a,-a,i*a],[a,-a,i*a],0.03,'#9aa8b2'),LN([-a,a,i*a],[a,a,i*a],0.03,'#9aa8b2'));
    }
    const nb=[];
    [[a,0,0],[-a,0,0],[0,a,0],[0,-a,0],[0,0,a],[0,0,-a]].forEach(p=>nb.push(LN([0,0,0],p,0.06,'#c9d6e2')));
    const edgePart=PT('晶胞框架',edges.concat(nb));edgePart.fixed=true;
    parts.push(edgePart);
    parts.push(PT('体心 Na⁺（标注）',[LB([0,0,0],'Na⁺'),LB([a,0,0],'Cl⁻')]));
    parts[parts.length-1].fixed=true;
  }
  else if(m.crystal==='diamond'){
    const a=3.567;
    const pts=[];
    for(let i=-1;i<=1;i+=2)for(let j=-1;j<=1;j+=2)for(let k=-1;k<=1;k+=2)pts.push([i*a/2,j*a/2,k*a/2]);
    [[a/2,0,0],[-a/2,0,0],[0,a/2,0],[0,-a/2,0],[0,0,a/2],[0,0,-a/2]].forEach(p=>pts.push(p));
    const inner=[[a/4,a/4,a/4],[a*3/4,a*3/4,a/4],[a*3/4,a/4,a*3/4],[a/4,a*3/4,a*3/4]];
    inner.forEach(p=>pts.push(p));
    const ccol=DB.ELEM.C.c;
    pts.forEach(p=>parts.push(PT('C',[S(p,0.4,ccol)])));
    const bl=[];
    inner.forEach(ip=>{
      pts.forEach(p=>{
        const d=V.len(V.sub(p,ip));
        if(d>1.4&&d<1.7)bl.push(LN(ip,p,0.07,ccol));
      });
    });
    const edges=[];
    for(let i=-1;i<=1;i+=2){
      edges.push(LN([i*a/2,-a/2,-a/2],[i*a/2,a/2,-a/2],0.025,'#9aa8b2'),LN([i*a/2,-a/2,a/2],[i*a/2,a/2,a/2],0.025,'#9aa8b2'),LN([i*a/2,-a/2,-a/2],[i*a/2,-a/2,a/2],0.025,'#9aa8b2'),LN([i*a/2,a/2,-a/2],[i*a/2,a/2,a/2],0.025,'#9aa8b2'));
      edges.push(LN([-a/2,i*a/2,-a/2],[a/2,i*a/2,-a/2],0.025,'#9aa8b2'),LN([-a/2,i*a/2,a/2],[a/2,i*a/2,a/2],0.025,'#9aa8b2'));
      edges.push(LN([-a/2,-a/2,i*a/2],[a/2,-a/2,i*a/2],0.025,'#9aa8b2'),LN([-a/2,a/2,i*a/2],[a/2,a/2,i*a/2],0.025,'#9aa8b2'));
    }
    const bp=PT('共价键网络',bl.concat(edges));bp.fixed=true;
    parts.push(bp);
    parts.push(PT('标注',[LB([a/4,a/4,a/4],'C（四面体配位）')]));
    parts[parts.length-1].fixed=true;
  }
  else if(m.crystal==='graphite'){
    const R=1.42,d=Math.sqrt(3)*R;
    const centers=[];
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
      centers.push([i*d+ (j%2?d/2:0), j*d*Math.sqrt(3)/2]);
    }
    function layer(z,shift){
      const pts=[];
      centers.forEach(c=>{
        for(let k=0;k<6;k++){
          const th=k/6*Math.PI*2+Math.PI/6;
          pts.push([c[0]+Math.cos(th)*R+shift[0],c[1]+Math.sin(th)*R+shift[1],z]);
        }
      });
      const uniq=[];
      pts.forEach(p=>{
        if(!uniq.some(q=>V.len(V.sub(q,p))<0.2))uniq.push(p);
      });
      return uniq;
    }
    const l1=layer(0,[0,0]),l2=layer(3.35,[R*0.5,R*0.29]);
    const ccol=DB.ELEM.C.c;
    l1.concat(l2).forEach(p=>parts.push(PT('C',[S(p,0.36,ccol)])));
    const bl=[];
    [l1,l2].forEach(pts=>{
      pts.forEach(p=>pts.forEach(q=>{
        const dd=V.len(V.sub(p,q));
        if(dd>1.3&&dd<1.55)bl.push(LN(p,q,0.06,ccol));
      }));
    });
    const bp=PT('层内共价键',bl);bp.fixed=true;
    parts.push(bp);
    parts.push(PT('标注',[LB([0,0,0],'碳层'),LB([0,0,3.35],'层间距≈3.35 Å（范德华力）')]));
    parts[parts.length-1].fixed=true;
  }
  else if(m.crystal==='c60'){
    const phi=(1+Math.sqrt(5))/2,R=3.5;
    const Vv=[];
    const perms=[[0,1,2],[1,2,0],[2,0,1]];
    perms.forEach(pm=>{
      for(const s1 of[1,-1])for(const s2 of[1,-1]){
        const v=[0,0,0];v[pm[0]]=s1*1;v[pm[1]]=s2*phi;
        Vv.push(v);
      }
    });
    const n=Vv.length;
    const nbr={};
    for(let i=0;i<n;i++){nbr[i]=[];for(let j=0;j<n;j++){if(i!==j&&V.len(V.sub(Vv[i],Vv[j]))<2.05)nbr[i].push(j);}}
    const pts=[];
    const edges=[];
    for(let i=0;i<n;i++){
      nbr[i].forEach(j=>{
        if(j<i)return;
        const a=Vv[i],b=Vv[j];
        const p1=V.norm([a[0]+(b[0]-a[0])/3,a[1]+(b[1]-a[1])/3,a[2]+(b[2]-a[2])/3]);
        const p2=V.norm([a[0]+(b[0]-a[0])*2/3,a[1]+(b[1]-a[1])*2/3,a[2]+(b[2]-a[2])*2/3]);
        const P1=[p1[0]*R,p1[1]*R,p1[2]*R],P2=[p2[0]*R,p2[1]*R,p2[2]*R];
        pts.push(P1);pts.push(P2);
        edges.push({p1:P1,p2:P2});
      });
    }
    const ccol=DB.ELEM.C.c;
    pts.forEach(p=>parts.push(PT('C',[S(p,0.27,ccol)])));
    const bl=[];
    edges.forEach(e=>bl.push(LN(e.p1,e.p2,0.06,ccol)));
    /* 五边形环边 */
    for(let i=0;i<n;i++){
      const v=Vv[i];
      const cap=nbr[i].map(j=>{
        const b=Vv[j];
        return V.norm([v[0]+(b[0]-v[0])/3,v[1]+(b[1]-v[1])/3,v[2]+(b[2]-v[2])/3]).map((c,k)=>c*R);
      });
      const vh=V.norm(v);
      let ax=[0,0,1];if(Math.abs(vh[2])>0.9)ax=[1,0,0];
      const u=V.norm(V.cross(vh,ax)),w=V.cross(vh,u);
      cap.sort((p,q)=>{
        const ap=Math.atan2(p[0]*w[0]+p[1]*w[1]+p[2]*w[2],p[0]*u[0]+p[1]*u[1]+p[2]*u[2]);
        const aq=Math.atan2(q[0]*w[0]+q[1]*w[1]+q[2]*w[2],q[0]*u[0]+q[1]*u[1]+q[2]*u[2]);
        return ap-aq;
      });
      for(let k=0;k<cap.length;k++)bl.push(LN(cap[k],cap[(k+1)%cap.length],0.06,ccol));
    }
    const bp=PT('碳笼骨架',bl);bp.fixed=true;
    parts.push(bp);
    parts.push(PT('标注',[LB([0,R,0],'C₆₀ 足球烯'),LB([0,0,R],'12 个五边形')]));
    parts[parts.length-1].fixed=true;
  }
  return finishMol(parts);
};
/* ============ 3D 元素周期表大厅（灵感⑤） ============ */
B.buildPT=function(){
  const parts=[];
  const S=1.0, GAP=0.06;
  DB.PT.forEach((e,i)=>{
    const Z=i+1;
    const x=(e[2]-9.5)*S;
    const z=(e[3]-5.5)*S;
    const vm=e[6];
    const h=0.42+vm*0.26;
    const cat=DB.PT_CAT[e[4]];
    const col=cat[1];
    const w=S-GAP;
    const shapes=[];
    BOX(x,h/2,z,w,h,w,col,{}).forEach(f=>shapes.push(f));
    shapes.push(F([[x-w/2,h+0.004,z-w/2],[x+w/2,h+0.004,z-w/2],[x+w/2,h+0.004,z+w/2],[x-w/2,h+0.004,z+w/2]],col,{flat:true,txt:e[0],textCol:'#ffffff',txtScale:0.6}));
    if(Z<10)shapes.push(F([[x-w/2,h+0.004,z+w/2-0.006],[x-w/2+0.2,h+0.004,z+w/2-0.006],[x-w/2+0.2,h+0.004,z+w/2-0.16],[x-w/2,h+0.004,z+w/2-0.16]],col,{flat:true,txt:String(Z),textCol:'rgba(255,255,255,.85)',txtScale:0.5}));
    parts.push(PT(e[0]+' '+e[1],shapes));
  });
  /* 类别图例（侧立面板） */
  const lgx=11.4,lgz=-2.6;
  Object.keys(DB.PT_CAT).forEach((k,i)=>{
    const c=DB.PT_CAT[k];
    const ly=2.6-i*0.34;
    parts.push(PT('图例 '+c[0],[
      F([[lgx,ly,lgz-0.12],[lgx+0.3,ly,lgz-0.12],[lgx+0.3,ly,lgz+0.12],[lgx,ly,lgz+0.12]],c[1],{flat:true,txt:c[0],textCol:'#3f5a55',txtScale:0.24})
    ]));
  });
  return B.fin(parts);
};
})();
