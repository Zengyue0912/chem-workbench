import * as THREE from './assets/three/three.module.js';
import {apparatus} from './chem-book-model.js?v=2';

const {clamp, lerp} = THREE.MathUtils;
const CYAN = 0x1a858a;
const AMBER = 0xb9673c;
const CREAM = 0xf5edda;
const makeMaterial = (color, props = {}) => new THREE.MeshStandardMaterial({color, roughness: .47, ...props});

function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function box(parent, w, h, d, mat, x, y, z) {
  return mesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}

function plate(parent, w, h, d, radius, mat, x, y, z) {
  const shape = new THREE.Shape();
  const left = -w / 2, right = w / 2, bottom = -d / 2, top = d / 2;
  shape.moveTo(left + radius, bottom);
  shape.lineTo(right - radius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top);
  shape.quadraticCurveTo(left, top, left, top - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  const object = mesh(parent, new THREE.ExtrudeGeometry(shape, {
    depth: h, bevelEnabled: false, curveSegments: 6
  }), mat, x, y - h / 2, z);
  object.rotation.x = -Math.PI / 2;
  return object;
}

function cylinder(parent, r, h, mat, x, y, z, open = false, order = 0) {
  const part = mesh(parent, new THREE.CylinderGeometry(r, r, h, 40, 1, open), mat, x, y, z);
  part.renderOrder = order;
  return part;
}

function ring(parent, radius, thickness, mat, y, z = 0) {
  const part = mesh(parent, new THREE.TorusGeometry(radius, thickness, 8, 48), mat, 0, y, z);
  part.rotation.x = Math.PI / 2;
  return part;
}

function cable(parent, coords, mat, radius = .024) {
  const route = new THREE.CatmullRomCurve3(coords.map(coord => new THREE.Vector3(...coord)));
  return mesh(parent, new THREE.TubeGeometry(route, 44, radius, 12, false), mat);
}

function contactShadow(parent, width, depth, x, y, z) {
  const shadow = artwork(parent, 96, 96, width, depth, x, y, z, ctx => {
    const shade = ctx.createRadialGradient(48, 48, 3, 48, 48, 46);
    shade.addColorStop(0, '#263d3054');
    shade.addColorStop(.57, '#263d3031');
    shade.addColorStop(1, '#263d3000');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 96, 96);
  });
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 0;
  return shadow;
}

function artwork(parent, width, height, w, h, x, y, z, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'));
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const mark = mesh(parent, new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({map, transparent: true, depthWrite: false}), x, y, z);
  mark.renderOrder = 9;
  return mark;
}

function bookPages(world) {
  const cover = makeMaterial(0x30423b);
  const edge = makeMaterial(0xe5d7b8);
  const paper = makeMaterial(CREAM, {roughness: .9});
  const pageLine = makeMaterial(0xcab995);
  plate(world, 8.18, .11, 4.94, .13, cover, -.14, -.28, .03);
  for (const [width, x] of [[2.56, -2.77], [5.42, 1.24]]) {
    plate(world, width, .19, 4.72, .10, edge, x, -.144, .02);
    plate(world, width + .02, .031, 4.73, .09, paper, x, -.038, .012);
    for (let i = 0; i < 6; i++) {
      box(world, width - .18, .006, .014, pageLine, x, -.204 + i * .023, 2.383);
    }
  }
  box(world, .058, .026, 4.66, pageLine, -1.48, -.026, .02);
  box(world, .04, .023, 4.55, makeMaterial(0xece0bf), -1.535, -.024, .02);
  const leftPrint = artwork(world, 352, 612, 2.34, 4.08, -2.78, -.020, -.04, ctx => {
    ctx.strokeStyle = '#9c9679';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(25, 24, 302, 559);
    ctx.fillStyle = '#41574c';
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText('ELECTROLYSIS', 43, 63);
    ctx.font = '700 48px Microsoft YaHei, system-ui';
    ctx.fillText('电解水', 40, 144);
    ctx.strokeStyle = '#9a9c81';
    ctx.beginPath();
    ctx.moveTo(43, 172);
    ctx.lineTo(302, 172);
    ctx.stroke();
    ctx.fillStyle = '#315655';
    ctx.font = '700 33px Georgia, serif';
    ctx.fillText('2H₂O', 43, 240);
    ctx.fillText('↓', 44, 297);
    ctx.fillText('?', 44, 363);
    ctx.font = '17px Microsoft YaHei, system-ui';
    ctx.fillText('先观察，再用数据判断', 43, 506);
  });
  leftPrint.rotation.x = -Math.PI / 2;
  const blueprint = artwork(world, 832, 650, 5.18, 4.46, 1.26, -.018, 0, ctx => {
    ctx.strokeStyle = '#aaa38b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(25, 25, 782, 600);
    ctx.strokeStyle = '#8d9c8d40';
    ctx.beginPath();
    for (let x = 52; x < 797; x += 24) {
      ctx.moveTo(x, 52); ctx.lineTo(x, 600);
    }
    for (let y = 52; y < 603; y += 24) {
      ctx.moveTo(51, y); ctx.lineTo(781, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#5c766c';
    ctx.font = '700 15px Georgia, serif';
    ctx.fillText('APPARATUS / ASSEMBLY', 52, 580);
  });
  blueprint.rotation.x = -Math.PI / 2;
}

function experimentPage(world) {
  const leaf = makeMaterial(0xf0e7cd, {roughness:.95});
  plate(world, 6.08, .038, 4.45, .06, leaf, 1.02, -.043, 0);
  const margin = artwork(world, 940, 680, 5.96, 4.32, 1.02, -.021, 0, ctx => {
    ctx.strokeStyle = '#b7b092';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 28, 880, 624);
    ctx.fillStyle = '#5e715f';
    ctx.font = '700 18px Microsoft YaHei, sans-serif';
    ctx.fillText('电解水', 65, 615);
  });
  margin.rotation.x = -Math.PI / 2;
  margin.renderOrder = -1;
  const print = artwork(world, 940, 680, 5.96, 4.32, 1.02, -.018, 0, ctx => {
    ctx.fillStyle = '#f8f2dc';
    ctx.fillRect(0, 0, 940, 680);
    ctx.strokeStyle = '#aaa78b';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 28, 880, 624);
    ctx.font = '700 27px Microsoft YaHei, sans-serif';
    ctx.fillStyle = '#41645c';
    ctx.fillText('电解水装置示意', 63, 81);
    ctx.strokeStyle = '#d6d1b9';
    ctx.beginPath();
    for (let x = 64; x <= 876; x += 24) {
      ctx.moveTo(x, 116);
      ctx.lineTo(x, 610);
    }
    for (let y = 116; y <= 610; y += 24) {
      ctx.moveTo(64, y);
      ctx.lineTo(876, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#496c67';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeRect(234, 530, 472, 31);
    ctx.beginPath();
    for (const x of [278, 662]) {
      ctx.moveTo(x, 531);
      ctx.lineTo(x, 137);
    }
    for (const y of [217, 373]) {
      ctx.moveTo(278, y);
      ctx.lineTo(662, y);
    }
    ctx.stroke();
    for (const x of [361, 579]) {
      ctx.fillStyle = '#edf2df';
      ctx.fillRect(x - 27, 161, 54, 328);
      ctx.strokeRect(x - 27, 161, 54, 328);
      ctx.beginPath();
      for (let y = 194; y <= 445; y += 26) {
        ctx.moveTo(x + 11, y);
        ctx.lineTo(x + 25, y);
      }
      ctx.moveTo(x - 36, 159);
      ctx.lineTo(x + 36, 159);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(361, 489);
    ctx.bezierCurveTo(361, 527, 579, 527, 579, 489);
    ctx.moveTo(470, 508);
    ctx.lineTo(470, 415);
    ctx.stroke();
    ctx.strokeRect(416, 552, 108, 46);
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillStyle = '#23767b';
    ctx.fillText('−', 433, 582);
    ctx.fillStyle = '#a2532b';
    ctx.fillText('+', 490, 582);
  });
  print.rotation.x = -Math.PI / 2;
  print.renderOrder = 0;
  return print;
}

function makeTube(parent, color) {
  const metal = makeMaterial(0x637975, {metalness: .33});
  const electrode = makeMaterial(0x35403e, {metalness: .37});
  const accent = makeMaterial(color);
  const shell = new THREE.MeshBasicMaterial({
    color: 0xc3e8e5, transparent: true, opacity: .21, depthWrite: false, side: THREE.DoubleSide
  });
  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0x73b4b3, transparent: true, opacity: .76, depthWrite: false, roughness: .22
  });
  cylinder(parent, .205, 2.56, shell, 0, 1.51, 0, true, 5);
  const liquid = cylinder(parent, .192, 1, liquidMat, 0, 1.50, 0, false, 2);
  const waterline = ring(parent, .185, .013, makeMaterial(0x83b3ae), 0);
  waterline.renderOrder = 6;
  ring(parent, .204, .014, metal, .255);
  ring(parent, .204, .017, metal, 2.79);
  cylinder(parent, .133, .12, metal, 0, 2.78, 0);
  cylinder(parent, .081, .09, accent, 0, 2.87, 0);
  cylinder(parent, .094, .142, accent, 0, .152, 0);
  box(parent, .103, .47, .091, electrode, 0, .44, .01);
  const tick = makeMaterial(0x425954);
  for (let i = 0; i <= 12; i++) {
    box(parent, i % 3 ? .066 : .114, .011, .009, tick, .024, 1.24 + i * .117, .202);
  }
  const sheen = new THREE.MeshBasicMaterial({color: 0xf1fff7, transparent: true, opacity: .69, depthWrite: false});
  const stripe = box(parent, .018, 2.35, .008, sheen, -.137, 1.522, .151);
  stripe.renderOrder = 8;
  const bubbleGeometry = new THREE.SphereGeometry(.041, 10, 8);
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xe8faf5, roughness: .22, transparent: true, opacity: .85, depthWrite: false
  });
  const bubbles = Array.from({length: color === CYAN ? 23 : 12}, () => {
    const bead = mesh(parent, bubbleGeometry, bubbleMat);
    bead.renderOrder = 4;
    return bead;
  });
  return {liquid, waterline, bubbles};
}

function makeSupply(root) {
  const caseMat = makeMaterial(0x303b39, {metalness: .22});
  const face = makeMaterial(0x182824);
  plate(root, 1.47, .36, .70, .067, caseMat, 0, .24, 0);
  plate(root, 1.40, .043, .63, .06, makeMaterial(0x60716a), 0, .438, 0);
  box(root, .82, .24, .015, face, -.13, .25, .358);
  const screen = makeMaterial(0x658b73, {emissive: 0x163e32, emissiveIntensity: .15});
  box(root, .64, .145, .012, screen, -.13, .27, .369);
  const dial = cylinder(root, .105, .09, makeMaterial(0xa3aaa0), .50, .245, .36);
  dial.rotation.x = Math.PI / 2;
  for (let i = 0; i < 10; i++) box(root, .033, .009, .23, face, -.38 + i * .078, .461, -.126);
  for (const [side, color] of [[-1, CYAN], [1, AMBER]]) {
    cylinder(root, .053, .105, makeMaterial(color), side * .515, .34, -.345).rotation.x = Math.PI / 2;
  }
  artwork(root, 256, 68, .61, .133, -.13, .269, .377, ctx => {
    ctx.fillStyle = '#172a22';
    ctx.font = '700 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DC SUPPLY', 128, 49);
  });
  return screen;
}

function makeSample(world) {
  const group = new THREE.Group();
  world.add(group);
  group.position.set(1.03, .08, .10);
  const matte = makeMaterial(0x526763);
  contactShadow(group, 3.0, 2.2, 0, -.09, 0);
  const glass = new THREE.MeshBasicMaterial({color: 0xb6d7d8, transparent: true, opacity: .29, depthWrite: false, side: THREE.DoubleSide});
  plate(group, 2.4, .105, 1.48, .12, matte, 0, .01, 0);
  cylinder(group, .33, 1.30, glass, 0, .78, 0, true, 4);
  ring(group, .33, .023, makeMaterial(0x6f8d8d), 1.43);
  cylinder(group, .36, .103, matte, 0, .15, 0);
  const stick = new THREE.Group();
  group.add(stick);
  stick.rotation.z = -.67;
  cylinder(stick, .026, .84, makeMaterial(0xa96c3f), 0, .42, 0);
  const ember = mesh(stick, new THREE.SphereGeometry(.036, 12, 8), new THREE.MeshBasicMaterial({color: 0xdd572a}));
  const flame = mesh(stick, new THREE.SphereGeometry(.118, 20, 10),
    new THREE.MeshBasicMaterial({color: 0xff9c21, transparent: true, opacity: .89, depthWrite: false,
      toneMapped: false}), 0, -.101, 0);
  flame.scale.set(.7, 1.48, .65);
  const core = mesh(stick, new THREE.SphereGeometry(.082, 16, 10),
    new THREE.MeshBasicMaterial({color: 0xffefb5, toneMapped: false}), 0, -.053, .007);
  core.scale.set(.53, 1.34, .72);
  const flash = mesh(group, new THREE.SphereGeometry(.16, 14, 9),
    new THREE.MeshBasicMaterial({color: 0x62aef6, transparent: true, depthWrite: false,
      toneMapped: false}), 0, 1.45, .11);
  flash.renderOrder = 7;
  const accent = makeMaterial(CYAN);
  ring(group, .345, .022, accent, .23);
  return {
    group,
    update(test, reduced) {
      group.visible = Boolean(test);
      if (!test) return;
      const t = test.elapsed;
      const approach = reduced ? 1 : THREE.MathUtils.smootherstep(t, 0, .64);
      const hydrogen = test.gas === 'h';
      stick.position.set(lerp(.63, .075, approach), lerp(1.83, 1.47, approach), .105);
      accent.color.setHex(hydrogen ? CYAN : AMBER);
      const lit = hydrogen ? t < .65 : t >= .65;
      flame.visible = core.visible = reduced ? !hydrogen : lit;
      flame.scale.y = reduced ? 1.48 : 1.48 + Math.sin(t * 15) * .17;
      ember.visible = true;
      flash.visible = hydrogen && t >= .65 && t < 1.36;
      flash.material.opacity = clamp(.92 - (t - .65) * 1.22, .03, .92);
      flash.scale.set(1.18, 1 + (t - .65) * 2, 1.18);
    }
  };
}

const views = {
  paper: {x: .0, y: .04, z: .20, yaw: -.22, pitch: .99, distance: 10.6, minAspect: 1.34},
  bench: {x: .05, y: 1.01, z: .27, yaw: -.16, pitch: .48, distance: 9.99, minAspect: 1.38},
  electrodes: {x: 1.04, y: 1.38, z: .03, yaw: 0, pitch: .15, distance: 5.84, minAspect: 1.07},
  sample: {x: 1.05, y: 1.10, z: .08, yaw: -.04, pitch: .32, distance: 5.35, minAspect: 1.05}
};
const inlineViews = {
  ...views,
  paper: {x:1.02, y:.04, z:.03, yaw:-.1, pitch:1.27, distance:7.86, minAspect:1.40},
  bench: {x:1.08, y:1.20, z:.47, yaw:-.18, pitch:.43, distance:8.67, minAspect:1.35},
  electrodes: {...views.electrodes, distance:6.04}
};

export function createBookScene(host, {place, miss, contextLost, manual, wheelZoom = true, inline = false}, markers) {
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setClearColor(0xffffff, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const dom = renderer.domElement;
  dom.setAttribute('aria-hidden', 'true');
  host.append(dom);

  const scene = new THREE.Scene(), world = new THREE.Group();
  scene.add(world);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
  const key = new THREE.DirectionalLight(0xfff1d9, 2.65);
  key.position.set(-4, 8, 5);
  const fill = new THREE.DirectionalLight(0xdcffff, 1.15);
  fill.position.set(4, 4, -4);
  scene.add(key, fill, new THREE.HemisphereLight(0xfaf9e9, 0x7a9a95, 2.0));
  const print = inline ? experimentPage(world) : null;
  if (!inline) bookPages(world);

  const rig = new THREE.Group();
  rig.position.set(1.02, 0, -.02);
  world.add(rig);
  const iron = makeMaterial(0x425957, {metalness: .24});
  const steel = makeMaterial(0x95a8a3, {metalness: .45});
  const mat = makeMaterial(0xcbd9ce);
  const slotIdle = makeMaterial(0x719888);
  const slotActive = makeMaterial(0x19a989, {emissive: 0x126b59, emissiveIntensity: .55});
  contactShadow(rig, 5.10, 2.43, 0, -.017, -.15);
  const platform = plate(rig, 4.50, .090, 1.79, .12, mat, 0, .07, -.22);
  const frontRail = plate(rig, 4.06, .079, .38, .085, iron, 0, .128, .424);
  const backBeam = new THREE.Group();
  backBeam.position.set(0, .105, -.66);
  rig.add(backBeam);
  for (const x of [-1.4, 1.4]) {
    plate(rig, .47, .11, .42, .07, iron, x, .12, -.66);
    cylinder(backBeam, .055, 2.69, steel, x, 1.348, 0);
    cylinder(backBeam, .085, .14, iron, x, .16, 0);
    cylinder(backBeam, .07, .11, iron, x, 2.72, 0);
    for (const y of [1.27, 2.34]) {
      cylinder(backBeam, .086, .12, iron, x, y, 0);
      cylinder(backBeam, .071, .11, steel, x, y, .075).rotation.x = Math.PI / 2;
    }
  }
  for (const y of [1.27, 2.34]) {
    box(backBeam, 2.81, .069, .096, steel, 0, y, 0);
    for (const x of [-.91, .91]) {
      box(backBeam, .085, .072, .41, iron, x, y, .24);
      cylinder(backBeam, .069, .087, iron, x + .20, y, .48).rotation.z = Math.PI / 2;
    }
  }
  const wires = new THREE.Group();
  rig.add(wires);
  for (const [side, color] of [[-1, CYAN], [1, AMBER]]) {
    cable(wires, [[side * .515, .39, .87],[side * .76, .16, .75],[side * 1.50, .18, .62],
      [side * 1.43, .17, .305],[side * .91, .18, .09],[side * .91, .253, 0]], makeMaterial(color));
  }
  const joint = makeMaterial(0x648d8a, {roughness: .3});
  const channel = makeMaterial(0x92c4c3, {roughness: .18});
  cable(wires, [[-.91,.39,-.12],[-.90,.352,-.30],[-.75,.35,-.54],
    [0,.35,-.59],[.75,.35,-.54],[.90,.352,-.30],[.91,.39,-.12]], channel, .066);
  cylinder(wires, .091, .74, channel, 0, .73, -.59);
  cylinder(wires, .123, .055, joint, 0, 1.105, -.59);

  const parts = new Map(), pickables = [];
  const anchors = new Map();
  for (const part of apparatus) {
    const root = new THREE.Group(), hinge = new THREE.Group(), slot = new THREE.Group();
    root.add(hinge);
    rig.add(root, slot);
    if (part.id === 'power') contactShadow(root, 1.90, 1.0, 0, .014, .10);
    slot.position.set(...part.slot);
    const base = part.id === 'power'
      ? plate(slot, 1.64, .027, .80, .09, slotIdle, 0, .025, 0)
      : ring(slot, .294, .029, slotIdle, .045);
    const anchor = new THREE.Group();
    anchor.position.set(0, part.id === 'power' ? .34 : 1.05, part.id === 'power' ? .33 : .15);
    hinge.add(anchor);
    anchors.set(part.id, anchor);
    const model = part.id === 'power' ? {screen: makeSupply(hinge)} : makeTube(hinge, part.id === 'hydrogen' ? CYAN : AMBER);
    const position = part.tray.map(value => value);
    root.position.set(...position);
    parts.set(part.id, {root, hinge, base, model, part});
    hinge.traverse(object => {
      if (!object.isMesh) return;
      object.userData.part = part.id;
      pickables.push(object);
    });
  }

  const sample = makeSample(world);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const shots = inline ? inlineViews : views;
  const cameraPose = {...shots.paper};
  let goal = {...shots.paper};
  let needsRender = true, fold = 0, opened = false, sceneReady = false, sampleVisible = false;
  let lastPositions, lastTime, lastRunning, drag = null, pinchGap = 0;
  const placed = new Set(), pointers = new Map();
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.085);
  const hit = new THREE.Vector3(), local = new THREE.Vector3(), markerPoint = new THREE.Vector3();
  let width = 1, height = 1;

  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  const sizeWatcher = new ResizeObserver(resize);
  sizeWatcher.observe(host);
  resize();

  function targetPart(entry) {
    return placed.has(entry.part.id) ? entry.part.slot : entry.part.tray;
  }

  function readRay(event) {
    const rect = dom.getBoundingClientRect();
    pointer.set(2 * (event.clientX - rect.left) / width - 1, 1 - 2 * (event.clientY - rect.top) / height);
    ray.setFromCamera(pointer, camera);
  }

  function selectView(name) {
    goal = {...shots[name]};
    const turn = goal.yaw - cameraPose.yaw;
    goal.yaw = cameraPose.yaw + Math.atan2(Math.sin(turn), Math.cos(turn));
    needsRender = true;
  }

  function zoom(delta) {
    goal.distance = clamp(goal.distance + delta, 3.8, 14.5);
    needsRender = true;
  }

  dom.addEventListener('pointerdown', event => {
    if (!opened || !sceneReady || sampleVisible || event.button > 0) return;
    dom.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, event);
    if (pointers.size > 1) {
      drag = null;
      pinchGap = 0;
      needsRender = true;
      return;
    }
    readRay(event);
    const id = ray.intersectObjects(pickables, false).find(item => !placed.has(item.object.userData.part))?.object.userData.part;
    drag = {id, x: event.clientX, y: event.clientY};
    if (id && ray.ray.intersectPlane(floor, hit)) {
      const pos = parts.get(id).root.position;
      rig.worldToLocal(hit);
      drag.offset = [pos.x - hit.x, pos.z - hit.z];
      drag.point = pos.clone();
    }
    dom.style.cursor = id ? 'grabbing' : 'move';
  });

  dom.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, event);
    if (pointers.size === 2) {
      const [a, b] = pointers.values();
      const gap = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchGap) {
        manual();
        zoom((pinchGap - gap) * .022);
      }
      pinchGap = gap;
      return;
    }
    if (!drag) return;
    if (drag.id && drag.point) {
      readRay(event);
      if (ray.ray.intersectPlane(floor, hit)) {
        rig.worldToLocal(hit);
        drag.point.set(clamp(hit.x + drag.offset[0], -2.48, 2.48), .10,
          clamp(hit.z + drag.offset[1], -1.13, 2.08));
      }
    } else {
      manual();
      goal.yaw -= (event.clientX - drag.x) * .008;
      goal.pitch = clamp(goal.pitch + (event.clientY - drag.y) * .007, .1, 1.29);
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
    needsRender = true;
  });

  function endDrag(event) {
    if (!pointers.delete(event.pointerId)) return;
    pinchGap = 0;
    if (drag?.id && drag.point && event.type === 'pointerup') {
      const {id, point} = drag;
      const slot = parts.get(id).part.slot;
      if (Math.hypot(point.x - slot[0], (point.z - slot[2]) * 1.05) <= .57) place(id);
      else miss(id);
    }
    drag = null;
    dom.style.cursor = 'grab';
    needsRender = true;
  }

  dom.addEventListener('pointerup', endDrag);
  dom.addEventListener('pointercancel', endDrag);
  dom.addEventListener('lostpointercapture', endDrag);
  dom.addEventListener('wheel', event => {
    if (!wheelZoom || !opened || sampleVisible) return;
    event.preventDefault();
    manual();
    zoom(Math.sign(event.deltaY) * .37);
  }, {passive: false});
  dom.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost();
  });

  function updateCamera(ease) {
    let changed = false;
    for (const key of Object.keys(cameraPose)) {
      const remaining = goal[key] - cameraPose[key];
      if (Math.abs(remaining) < .0006) continue;
      cameraPose[key] += remaining * ease;
      changed = true;
    }
    const {x, y, z, distance, minAspect, yaw, pitch} = cameraPose;
    const range = distance * Math.max(1, minAspect / camera.aspect);
    const radius = range * Math.cos(pitch);
    camera.position.set(x + Math.sin(yaw) * radius, y + range * Math.sin(pitch), z + Math.cos(yaw) * radius);
    camera.lookAt(x, y, z);
    camera.updateMatrixWorld();
    return changed;
  }

  function updateParts(state, ease) {
    let changed = false;
    for (const [id, {root, hinge, base, model, part}] of parts) {
      const position = targetPart({part});
      local.set(...position);
      if (id !== 'power') local.z -= (1 - fold) * 1.43;
      if (id === drag?.id && drag.point) local.copy(drag.point);
      else if (placed.has(id)) local.y += (1 - fold) * .011;
      if (root.position.distanceToSquared(local) > .000012) {
        root.position.lerp(local, ease);
        changed = true;
      }
      const angle = id === 'power' ? 0 : 1.51 * (1 - fold);
      hinge.rotation.x = angle;
      base.visible = !placed.has(id) && fold > .8 && !sampleVisible;
      base.material = drag?.id === id ? slotActive : slotIdle;
      if (id === 'power') {
        model.screen.emissiveIntensity = state.running ? 1.25 : .10;
        continue;
      }
      const volume = id === 'hydrogen' ? state.h : state.o;
      const depth = 2.485 - volume * .157;
      const level = .263 + depth;
      model.liquid.scale.y = depth;
      model.liquid.position.y = .263 + depth / 2;
      model.waterline.position.y = level;
      model.bubbles.forEach((bubble, i) => {
        bubble.visible = placed.has(id) && state.running;
        if (!bubble.visible) return;
        const progress = reduced.matches ? (i * .199) % 1 :
          (state.time * (.68 + i % 6 * .026) + i * .179) % 1;
        bubble.scale.setScalar(.70 + i % 5 * .20);
        bubble.position.set(Math.sin(i * 3 + progress * 7) * .112,
          .48 + progress * Math.max(0, level - .55), Math.cos(i * 2 + progress * 8) * .106);
      });
    }
    return changed;
  }

  function updateMarkers() {
    for (const [name, marker] of markers) {
      marker.hidden = !sceneReady || sampleVisible || goal.pitch > .97 ||
        (placed.has(name) && (name === 'power' || placed.size < 3)) ||
        (placed.size < 3 && Boolean(drag?.id));
      if (marker.hidden) continue;
      anchors.get(name).getWorldPosition(markerPoint).project(camera);
      marker.style.left = (markerPoint.x * .5 + .5) * 100 + '%';
      marker.style.top = (.5 - markerPoint.y * .5) * 100 + '%';
      marker.style.visibility = Math.abs(markerPoint.x) > .94 || Math.abs(markerPoint.y) > .83 ? 'hidden' : '';
      marker.classList.toggle('cb-connected', placed.size === 3);
    }
  }

  function frame(state, delta) {
    const ease = reduced.matches ? 1 : 1 - Math.exp(-delta * 8);
    if (lastPositions !== state.positions) {
      lastPositions = state.positions;
      placed.clear();
      for (const id of lastPositions) placed.add(id);
      needsRender = true;
    }
    if (opened !== state.opened) {
      opened = state.opened;
      if (!opened) drag = null;
      if (!opened) selectView('paper');
      else if (goal.y < .2) selectView(state.running ? 'electrodes' : 'bench');
    }
    if (sampleVisible !== Boolean(state.test)) {
      sampleVisible = Boolean(state.test);
      selectView(sampleVisible ? 'sample' : 'bench');
    }

    const unfolding = Math.abs(Number(opened) - fold) > .001;
    if (unfolding) fold += (Number(opened) - fold) * (reduced.matches ? 1 : Math.min(1, delta * 1.83));
    sceneReady = opened && fold > .94;
    if (print) {
      print.visible = fold < .45;
      print.material.opacity = 1 - THREE.MathUtils.smootherstep(fold, 0, .45);
    }
    rig.visible = !sampleVisible && (!print || fold > .012);
    const easedFold = THREE.MathUtils.smootherstep(fold, 0, 1);
    backBeam.rotation.x = 1.43 * (1 - easedFold);
    platform.position.y = .07 - .065 * (1 - easedFold);
    frontRail.position.y = .128 - .11 * (1 - easedFold);
    wires.visible = sceneReady && placed.size === apparatus.length;
    const movement = updateParts(state, ease);
    const cameraChanged = updateCamera(ease);
    sample.update(state.test, reduced.matches);
    if (needsRender || unfolding || movement || cameraChanged || state.test ||
      lastTime !== state.time || lastRunning !== state.running) {
      renderer.render(scene, camera);
      updateMarkers();
      needsRender = false;
    }
    lastTime = state.time;
    lastRunning = state.running;
  }

  return {
    frame,
    zoom,
    orbit(angle) {
      goal.yaw += angle;
      needsRender = true;
    },
    view: selectView,
    dispose() {
      sizeWatcher.disconnect();
      const resources = new Set();
      scene.traverse(object => {
        if (object.geometry) resources.add(object.geometry);
        if (object.material) {
          resources.add(object.material);
          if (object.material.map) resources.add(object.material.map);
        }
      });
      resources.forEach(resource => resource.dispose());
      renderer.dispose();
      dom.remove();
    }
  };
}
