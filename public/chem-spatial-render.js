import * as THREE from './assets/three/three.module.js';

const shared = {
  sph:new THREE.SphereGeometry(1,24,16),
  line:new THREE.CylinderGeometry(1,1,1,12),
  tube:new THREE.CylinderGeometry(1,1,1,24,1,true),
  disc:new THREE.CircleGeometry(1,36),
  ring:new THREE.RingGeometry(.91,1,36)
};
const unitY = new THREE.Vector3(0,1,0);
const unitZ = new THREE.Vector3(0,0,1);
const zero = [0,0,0];
const point = new THREE.Vector3();
const axis = new THREE.Vector3();

function paint(source) {
  const rgba = /^rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)$/.exec(source || '');
  return rgba ? ['rgb('+rgba.slice(1,4).join(',')+')',Number(rgba[4])] : [source || '#b7d4d8',1];
}

function printTexture(shape) {
  const sheet = document.createElement('canvas');
  sheet.width = 512;
  sheet.height = 144;
  const ink = sheet.getContext('2d');
  ink.fillStyle = shape.col || '#ffffff';
  ink.fillRect(0,0,sheet.width,sheet.height);
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  ink.fillStyle = shape.textCol || '#20474b';
  ink.font = '600 90px "Microsoft YaHei", sans-serif';
  ink.fillText(shape.txt,sheet.width/2,sheet.height/2,sheet.width-22);
  const texture = new THREE.CanvasTexture(sheet);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function geometry(shape) {
  if (shared[shape.t]) return shared[shape.t];
  if (shape.t === 'glow') return shared.sph;
  if (shape.t === 'lathe') {
    return new THREE.LatheGeometry(shape.prof.map(([r,y])=>new THREE.Vector2(Math.max(0,r),y)),
      Math.min(48,Math.max(16,shape.seg || 32)));
  }
  if (shape.t === 'face' && shape.vs.length >= 3) {
    const patch = new THREE.BufferGeometry();
    const indices = [];
    for (let i=1;i<shape.vs.length-1;i++) indices.push(0,i,i+1);
    patch.setAttribute('position',new THREE.Float32BufferAttribute(shape.vs.flat(),3));
    if (shape.vs.length === 4) patch.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
    patch.setIndex(indices);
    patch.computeVertexNormals();
    return patch;
  }
  return null;
}

function material(shape) {
  const [color,alpha] = paint(shape.col || shape.colA);
  const clear = shape.alpha ?? alpha;
  if (shape.t === 'glow') return new THREE.MeshBasicMaterial({color,opacity:clear*.38,transparent:true,depthWrite:false});
  const glass = (shape.t === 'lathe' || shape.t === 'tube') && clear < .74 && !shape.liquid;
  const coat = glass ? clear*.72 : clear;
  return new THREE.MeshPhysicalMaterial({
    color:glass ? new THREE.Color(color).multiplyScalar(.70) : color,
    roughness:glass ? .18 : .48,metalness:glass ? .12 : .055,
    clearcoat:glass ? .92 : .22,clearcoatRoughness:glass ? .17 : .35,
    transparent:coat < .98,opacity:coat,depthWrite:coat >= .92,side:THREE.DoubleSide,
    map:shape.txt && shape.vs?.length === 4 ? printTexture(shape) : null
  });
}

function place(mesh,shape,offsets,part) {
  const start = offsets[shape.g ?? shape.gA ?? part] || zero;
  if (shape.t === 'line' || shape.t === 'tube') {
    const end = offsets[shape.gB ?? part] || zero;
    point.fromArray(shape.a).add(axis.fromArray(start));
    axis.fromArray(shape.b).add(mesh.position.fromArray(end));
    mesh.position.copy(point).lerp(axis,.5);
    axis.sub(point);
    const length = axis.length();
    mesh.scale.set(shape.r,length,shape.r);
    mesh.quaternion.setFromUnitVectors(unitY,axis.normalize());
    return;
  }
  mesh.position.fromArray(shape.c || shape.o || zero).add(axis.fromArray(start));
  if (shape.t === 'disc' || shape.t === 'ring') {
    mesh.scale.setScalar(shape.r || shape.r1);
    mesh.quaternion.setFromUnitVectors(unitZ,axis.fromArray(shape.n || [0,1,0]).normalize());
  }
  if (shape.t === 'sph' || shape.t === 'glow') mesh.scale.setScalar(shape.r);
}

function addShape(shape,parent) {
  const form = geometry(shape);
  if (!form) return null;
  const mesh = new THREE.Mesh(form,material(shape));
  if (shape.txt) mesh.renderOrder = 1;
  parent.add(mesh);
  return mesh;
}

function release(mesh) {
  mesh.removeFromParent();
  if (!Object.values(shared).includes(mesh.geometry)) mesh.geometry.dispose();
  mesh.material.map?.dispose();
  mesh.material.dispose();
}

function floorShadow() {
  const sheet = document.createElement('canvas');
  sheet.width = sheet.height = 128;
  const ctx = sheet.getContext('2d');
  const shade = ctx.createRadialGradient(64,64,8,64,64,62);
  shade.addColorStop(0,'rgba(0,0,0,.52)');
  shade.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0,0,128,128);
  const material = new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sheet),transparent:true,depthWrite:false});
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
  mesh.rotation.x = -Math.PI/2;
  return mesh;
}

export function createLabRenderer(viewport,controlCanvas) {
  const view = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  view.domElement.className = 'cw-geometry';
  view.domElement.setAttribute('aria-hidden','true');
  viewport.insertBefore(view.domElement,controlCanvas);
  view.setClearColor(0x000000,0);
  view.outputColorSpace = THREE.SRGBColorSpace;
  view.toneMapping = THREE.ACESFilmicToneMapping;
  view.toneMappingExposure = 1.22;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45,1,.05,400);
  const flip = new THREE.Group();
  flip.scale.z = -1;
  const pose = new THREE.Group();
  flip.add(pose);
  scene.add(flip,new THREE.HemisphereLight('#e4f8ff','#516252',2.1));
  for (const [color,strength,x,y,z] of [['#fff0d6',3.1,-5,8,7],['#74f4df',2.55,4,3,-5],['#bfcfff',2.2,5,2,5]]) {
    const light = new THREE.DirectionalLight(color,strength);
    light.position.set(x,y,z);
    scene.add(light);
  }

  const shadow = floorShadow();
  shadow.renderOrder = -1;
  pose.add(shadow);

  const labels = document.createElement('div');
  labels.className = 'cw-part-labels';
  labels.setAttribute('aria-hidden','true');
  viewport.insertBefore(labels,controlCanvas);
  const nodes = [];
  const extras = [];
  const projected = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let current = null;
  let lastExtra = null;
  let width = 0, height = 0, dpr = 0;
  let active = false;

  function clear() {
    for (const part of nodes) for (const record of part.meshes) release(record.mesh);
    for (const record of extras) if (record) release(record.mesh);
    nodes.length = extras.length = 0;
    labels.replaceChildren();
    current = lastExtra = null;
  }

  function load(model) {
    clear();
    current = model;
    model.parts.forEach((part,index) => {
      const meshes = part.shapes.flatMap(shape => {
        const mesh = addShape(shape,pose);
        if (mesh) mesh.userData.partName = part.name;
        return mesh ? [{mesh,shape}] : [];
      });
      const name = document.createElement('span');
      name.className = 'cw-model-label';
      name.textContent = part.name;
      name.hidden = true;
      labels.append(name);
      const teach = part.name && part.cen && !/(?:高光|阴影|反光|光晕)$/.test(part.name);
      nodes.push({part,index,meshes,name,teach,labelWidth:Math.min(114,Array.from(part.name || '').length*12+15)});
    });
    const [x,,z] = model.center || zero;
    const lowest = model.box?.mn?.[1] ?? 0;
    const span = Math.max(model.span || 1,1);
    shadow.position.set(x,lowest-.014,z);
    shadow.scale.set(span*1.45,span*1.35,1);
  }

  function draw(model,options,legacy) {
    const w = controlCanvas.clientWidth, h = controlCanvas.clientHeight;
    if (!w || !h || view.getContext().isContextLost()) return false;
    const density = Math.min(window.devicePixelRatio || 1,1.65);
    if (w !== width || h !== height || density !== dpr) {
      width = w;
      height = h;
      dpr = density;
      view.setPixelRatio(dpr);
      view.setSize(w,h,false);
    }
    if (model !== current) load(model);
    const offsets = options.disp;
    for (const {part,index,meshes} of nodes) {
      for (const {mesh,shape} of meshes) {
        mesh.visible = !part.hide && (offsets[index]?.[1] ?? 0) > -100;
        if (mesh.visible) place(mesh,shape,offsets,index);
      }
    }

    if (options.extra !== lastExtra) {
      lastExtra = options.extra;
      for (let i=0;i<Math.max(lastExtra.length,extras.length);i++) {
        const data = lastExtra[i];
        const previous = extras[i];
        if (previous?.shape === data) continue;
        if (previous) release(previous.mesh);
        const mesh = data ? addShape(data,pose) : null;
        extras[i] = mesh ? {shape:data,mesh} : null;
      }
      extras.length = lastExtra.length;
    }
    for (const record of extras) if (record) place(record.mesh,record.shape,offsets);

    pose.rotation.set(legacy.pitch,-legacy.yaw,0,'XYZ');
    camera.position.z = legacy.dist;
    camera.fov = THREE.MathUtils.radToDeg(2*Math.atan(height/(2*(legacy.fov || height))));
    camera.aspect = width/height;
    camera.setViewOffset(width,height,width/2-legacy.cx,height/2-legacy.cy,width,height);
    camera.updateMatrixWorld();
    shadow.visible = !viewport.classList.contains('cw-is-ar');
    view.render(scene,camera);

    const placedLabels = [];
    const focused = options.focusPart && nodes.find(node => node.part.name === options.focusPart);
    function showLabel({part,index,name,teach,labelWidth},isFocused) {
      name.hidden = true;
      name.classList.toggle('cw-part-focus',isFocused);
      if ((!options.labels && !isFocused) || !teach || part.hide || (offsets[index]?.[1] ?? 0) < -100) return;
      projected.fromArray(part.cen).add(axis.fromArray(offsets[index] || zero)).applyMatrix4(pose.matrixWorld).project(camera);
      const x = (.5+projected.x*.5)*width;
      const y = (.5-projected.y*.5)*height;
      const margin = isFocused ? 4 : labelWidth/2;
      if (x < margin || x > width-margin || y < 15 || y > height-15 || Math.abs(projected.z) > 1) return;
      const left = isFocused && x+labelWidth+18 > width;
      const labelX = isFocused ? x+(left ? -1 : 1)*(labelWidth/2+18) : x;
      if (placedLabels.some(other=>Math.abs(other.y-y)<24 && Math.abs(other.x-labelX)<(other.width+labelWidth)*.5)) return;
      placedLabels.push({x:labelX,y,width:labelWidth});
      name.classList.toggle('cw-focus-left',left);
      name.style.left = x.toFixed(1)+'px';
      name.style.top = y.toFixed(1)+'px';
      name.hidden = false;
    }
    if (focused) showLabel(focused,true);
    for (const node of nodes) if (node !== focused) showLabel(node,false);
    viewport.classList.add('cw-webgl-on');
    active = true;
    return true;
  }

  return {
    draw,
    pickPart(x,y,allowed) {
      if (!active || !viewport.classList.contains('cw-webgl-on')) return '';
      const rect = controlCanvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return '';
      pointer.set(2*(x-rect.left)/rect.width-1,1-2*(y-rect.top)/rect.height);
      ray.setFromCamera(pointer,camera);
      const targets = nodes.filter(({part}) => Object.hasOwn(allowed,part.name))
        .flatMap(({meshes}) => meshes.map(({mesh}) => mesh).filter(mesh => mesh.visible));
      return ray.intersectObjects(targets,false)[0]?.object.userData.partName || '';
    },
    capture(isolated = false) {
      if (!active || !current) return '';
      const previous = shadow.visible;
      if (isolated) shadow.visible = false;
      view.render(scene,camera);
      const shot = view.domElement.toDataURL('image/png');
      if (isolated) {
        shadow.visible = previous;
        view.render(scene,camera);
      }
      return shot;
    },
    hide() {
      active = false;
      viewport.classList.remove('cw-webgl-on');
      clear();
    },
    dispose() {
      this.hide();
      view.domElement.remove();
      labels.remove();
      release(shadow);
      view.dispose();
    }
  };
}
