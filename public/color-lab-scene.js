import * as THREE from './assets/three/three.module.js';
import {capacities} from './color-lab-model.js?v=3';

const dimensions={
  smallBeaker:{r:.80,h:1.59,bottom:.09},
  beaker:{r:.83,h:1.73,bottom:.09},
  tube:{r:.38,h:2.1,bottom:.1}
};
// Project the same front section onto the vessel and into the flat comparison window.
function mapSection(geometry, bottom, height, radius) {
  const {position,normal,uv}=geometry.attributes;
  for(let i=0;i<position.count;i++){
    const u=.5+.5*position.getX(i)/radius;
    const y=(position.getY(i)-bottom)/height;
    const v=normal.getY(i)>.9 && y>.98 ? .93+.065*position.getZ(i)/radius : y;
    uv.setXY(i,u,Math.max(0,Math.min(1,v)));
  }
  uv.needsUpdate=true;
}
function flocLayerGeometry() {
  const geometry=new THREE.CylinderGeometry(1,.91,1,60,3);
  const points=geometry.attributes.position;
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
    const angle=Math.atan2(z,x);
    const edge=.93+.035*Math.sin(5*angle)+.032*Math.cos(7*angle);
    const top=.09*Math.sin(4*angle)+.07*Math.cos(9*angle);
    points.setXYZ(i,x*edge,y+top*(y+.5)*Math.hypot(x,z),z*edge);
  }
  geometry.computeVertexNormals();
  return geometry;
}
function instrument(host) {
  const view=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  view.setClearColor(0x000000,0);view.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
  view.domElement.setAttribute('aria-hidden','true');host.append(view.domElement);
  const field=host.querySelector('.fl-flow');
  const fluidTexture=new THREE.CanvasTexture(field);
  fluidTexture.colorSpace=THREE.SRGBColorSpace;fluidTexture.generateMipmaps=false;
  fluidTexture.minFilter=THREE.LinearFilter;
  const world=new THREE.Scene(),camera=new THREE.OrthographicCamera(-2,2,1.4,-1.4,.1,30);
  camera.position.set(.45,2.60,7);camera.lookAt(0,.99,0);
  world.add(new THREE.HemisphereLight(0xffffff,0xcddee2,1.8));
  const key=new THREE.DirectionalLight(0xffffff,2.3);key.position.set(-3,6,4);world.add(key);
  const group=new THREE.Group();world.add(group);
  let kind='',liquid,sediment,grains,ring,tip,jet,drop,level=0,lastSize='',disposed=false;
  let lastLevel=-1,lastBed='';
  const materials=new Set(),geometries=new Set(),textures=new Set();
  function mesh(geo,mat,order=0) {
    geometries.add(geo);materials.add(mat);
    const m=new THREE.Mesh(geo,mat);group.add(m);m.renderOrder=order;return m;
  }
  function clear(){
    grains?.dispose();grains=null;
    group.clear();
    for(const x of [...geometries,...materials,...textures])x.dispose();
    geometries.clear();materials.clear();textures.clear();
  }
  function hoop(radius,y,color,opacity,thickness=.012) {
    const m=mesh(new THREE.TorusGeometry(radius,thickness,8,72),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}),5);
    m.rotation.x=Math.PI/2;m.position.y=y;return m;
  }
  function makeScales(d) {
    const sheet=document.createElement('canvas');sheet.width=160;sheet.height=512;
    const c=sheet.getContext('2d');c.fillStyle='#395d65';c.strokeStyle='#46676c';c.lineWidth=3;
    c.font='bold 30px sans-serif';c.textBaseline='middle';
    const max=capacities[kind],ticks=10;
    for(let j=1;j<=ticks;j++){
      const y=512*(1-.88*j/ticks);c.beginPath();c.moveTo(9,y);c.lineTo(j%2===0?56:34,y);c.stroke();
      if(j%2===0)c.fillText(String(max*j/ticks),65,y+1);
    }
    const tex=new THREE.CanvasTexture(sheet);tex.colorSpace=THREE.SRGBColorSpace;textures.add(tex);
    const m=mesh(new THREE.PlaneGeometry(d.r*.72,d.h),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),7);
    m.position.set(d.r*.34,d.bottom+d.h*.5,d.r*.95);
  }
  function create(kindName){
    clear();kind=kindName;lastLevel=-1;lastBed='';
    const d=dimensions[kind],r=d.r,h=d.h,b=d.bottom;
    const wall=kind==='tube'?[[.01,.02],[r*.42,.06],[r*.78,.15],[r,.33],[r,h],[r*1.07,h+.04]]:
      [[.02,.04],[r*.86,.04],[r,.10],[r,h-.06],[r*1.035,h]];
    const body=new THREE.LatheGeometry(wall.map(([x,y])=>new THREE.Vector2(x,y)),80);
    if(kind!=='tube'){
      const coords=body.attributes.position;
      for(let j=0;j<coords.count;j++){
        const x=coords.getX(j),y=coords.getY(j),z=coords.getZ(j);
        if(y>=h-.061 && x<0){const lip=Math.max(0,1-Math.abs(z)/.29);coords.setX(j,x-.14*lip);coords.setY(j,y+.035*lip);}
      }
      body.computeVertexNormals();
    }
    mesh(body,new THREE.MeshPhysicalMaterial({color:0xd1e6eb,transparent:true,opacity:.075,
      side:THREE.DoubleSide,depthWrite:false,roughness:.12,metalness:.04}),4);
    hoop(r*(kind==='tube'?1.07:1.035),kind==='tube'?h+.04:h,0x75969c,.85);
    hoop(r*(kind==='tube'?.4:.93),kind==='tube'?.07:.085,0x84a5ab,.7,.017);
    const stroke=new THREE.LineBasicMaterial({color:0x9ab8be,transparent:true,opacity:.8});materials.add(stroke);
    for (const sign of [-1,1]) {
      const edge=new THREE.BufferGeometry().setFromPoints(wall.slice(1).map(([rad,y])=>new THREE.Vector3(sign*rad*.98,y,-sign*rad*.10)));
      geometries.add(edge);const line=new THREE.Line(edge,stroke);line.renderOrder=6;group.add(line);
    }
    const cylinder=new THREE.CylinderGeometry(1,1,1,72);
    mapSection(cylinder,-.5,1,1);
    liquid=mesh(cylinder,new THREE.MeshBasicMaterial({map:fluidTexture,transparent:true,opacity:.97,depthWrite:false,toneMapped:false}),2);
    ring=hoop(r*.951,b,0xffffff,.75,.009);
    sediment=mesh(flocLayerGeometry(),new THREE.MeshStandardMaterial({color:0x88bedc,roughness:.96,transparent:true,opacity:.91,depthWrite:false}),3);
    const beadGeometry=new THREE.IcosahedronGeometry(1,1),beadMaterial=new THREE.MeshStandardMaterial({roughness:.95,transparent:true,opacity:.91,depthWrite:false});
    geometries.add(beadGeometry);materials.add(beadMaterial);
    grains=new THREE.InstancedMesh(beadGeometry,beadMaterial,110);grains.renderOrder=3.1;group.add(grains);
    const shades=[0x82bde0,0x68a9d5,0x92c8e5].map(c=>new THREE.Color(c));
    for(let i=0;i<110;i++)grains.setColorAt(i,shades[i%shades.length]);
    const nozzle=[[.012,0],[.028,.065],[.049,.15],[.053,.45]].map(([x,y])=>new THREE.Vector2(x,y));
    tip=mesh(new THREE.LatheGeometry(nozzle,24),new THREE.MeshPhongMaterial({color:0xacc9ce,transparent:true,opacity:.78,side:THREE.DoubleSide}),8);
    tip.rotation.z=-.34;tip.visible=false;
    jet=mesh(new THREE.CylinderGeometry(.013,.016,1,12),new THREE.MeshBasicMaterial({transparent:true,opacity:.85}),8);
    jet.visible=false;
    drop=mesh(new THREE.SphereGeometry(.052,18,12),new THREE.MeshPhongMaterial({color:0xaac3cc,shininess:90}),8);
    drop.scale.set(.85,1.45,.85);drop.visible=false;
    makeScales(d);
  }
  function radiusAt(z,d){
    if(kind!=='tube')return d.r*.965;
    const t=Math.min(1,Math.max(0,(z-.02)/.31));
    return d.r*.965*Math.sqrt(1-(1-t)**2);
  }
  function shapeFluid(d,height){
    const h=Math.max(.001,height);
    if(kind!=='tube'){
      liquid.scale.set(d.r*.955,h,d.r*.955);liquid.position.y=d.bottom+h/2;
    }else{
      // Trace the rounded base up to the liquid surface so low volumes stay inside the tube.
      const profile=[new THREE.Vector2(.001,d.bottom)];
      for(let j=0;j<=16;j++){
        const y=d.bottom+h*j/16;profile.push(new THREE.Vector2(radiusAt(y,d),y));
      }
      profile.push(new THREE.Vector2(.001,d.bottom+h));
      geometries.delete(liquid.geometry);liquid.geometry.dispose();
      liquid.geometry=new THREE.LatheGeometry(profile,56);geometries.add(liquid.geometry);
      mapSection(liquid.geometry,d.bottom,h,d.r*.965);
    }
  }
  function paint(){
    if(disposed||view.getContext().isContextLost())return;
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    if(lastSize!==w+'x'+h){
      lastSize=w+'x'+h;view.setSize(w,h,false);const half=Math.max(1.18,1.04*h/w);
      camera.left=-half*w/h;camera.right=-camera.left;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
    }
    view.render(world,camera);
  }
  const ro=new ResizeObserver(paint);ro.observe(host);
  const lost=()=>host.classList.remove('fl-webgl');
  const restored=()=>{paint();host.classList.add('fl-webgl');};
  view.domElement.addEventListener('webglcontextlost',lost);
  view.domElement.addEventListener('webglcontextrestored',restored);
  let last='';
  function showContents(o,falling) {
    const d=dimensions[kind];
    level=(d.h*.88)*Math.min(1,o.ml/capacities[kind]);
    if(level!==lastLevel){
      lastLevel=level;
      shapeFluid(d,level);liquid.visible=ring.visible=o.ml>1e-8;
      ring.position.y=d.bottom+level;
      ring.scale.setScalar(radiusAt(ring.position.y,d)/(d.r*.951));
    }
    const layer=level*o.depositShare;
    const bedKey=o.solid>1e-8 ? o.solid+'|'+layer : 'clear';
    if(bedKey!==lastBed){
      lastBed=bedKey;
      sediment.visible=grains.visible=o.solid>1e-8;
      const radius=radiusAt(d.bottom+layer*.15,d)*.93;
      sediment.scale.set(radius,layer,radius);sediment.position.y=d.bottom+layer/2;
      const obj=new THREE.Object3D(),count=Math.min(110,Math.ceil(290*Math.sqrt(o.solid)));
      grains.count=count;
      for(let j=0;j<count;j++){
        const t=(j+.5)/count,angle=j*2.4;
        const variation=(j*17%31)/31;
        const y=d.bottom+layer*(.85+.14*variation);
        const rad=radius*.92*Math.sqrt(t);
        const size=Math.min(d.r*.06,level*.12,layer*.38)*(.65+.45*variation);
        obj.position.set(Math.cos(angle)*rad,y,Math.sin(angle)*rad);
        obj.scale.set(size*1.4,size*.56,size);obj.updateMatrix();grains.setMatrixAt(j,obj.matrix);
      }
      grains.instanceMatrix.needsUpdate=true;
      if(count)grains.computeBoundingSphere();
    }
    tip.visible=Boolean(falling);
    jet.visible=Boolean(falling?.stream);
    drop.visible=Boolean(falling && !falling.stream);
    if(falling){
      const start=d.h+.10;
      const length=(start-d.bottom-level)*falling.fall;
      tip.position.set(-.10*d.r,start,.02);
      drop.material.color.set(falling.color);drop.position.set(tip.position.x,start-length,.02);
      jet.material.color.set(falling.color).multiplyScalar(.85);
      jet.scale.y=Math.max(.001,length);jet.position.set(tip.position.x,start-length/2,.02);
    }
    fluidTexture.needsUpdate=true;
    paint();
  }
  return {
    update(v,o){
      const signature=[v.kind,o.ml,o.color,o.solid].join('|');
      if(signature===last)return;
      last=signature;
      if(v.kind!==kind)create(v.kind);
      if(!host.closest('.fl-reacting')){
        const ctx=field.getContext('2d');ctx.fillStyle=o.color;ctx.fillRect(0,0,field.width,field.height);
      }
      showContents(o,null);
      if(!view.getContext().isContextLost())host.classList.add('fl-webgl');
    },
    frame:showContents,
    dispose(){disposed=true;ro.disconnect();view.domElement.removeEventListener('webglcontextlost',lost);
      view.domElement.removeEventListener('webglcontextrestored',restored);
      host.classList.remove('fl-webgl');clear();fluidTexture.dispose();view.dispose();view.forceContextLoss();view.domElement.remove();}
  };
}
export function createScene(hosts){
  const views=[];
  try{for(const host of hosts)views.push(instrument(host));}
  catch(err){views.forEach(v=>v.dispose());throw err;}
  return {update(v,o){views.forEach((r,i)=>r.update(v[i],o[i]));},frame(i,o,drop){views[i].frame(o,drop);},dispose(){views.forEach(v=>v.dispose());}};
}
