const clamp = value => Math.max(0, Math.min(1, value));
const lerp = (a, b, t) => a + (b - a) * t;
function smooth(start, end, value) {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}
function rgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

// The chemical model supplies the endpoints. Only the path between them is illustrated.
export function describeChange(tray, before, after, incoming, key, carriedSolid = 0) {
  const start = rgb(before.ml > 0 ? before.color : after.color);
  const end = rgb(after.color);
  const difference = Math.max(...end.map((v, i) => Math.abs(v - start[i])));
  const produced = after.solid - before.solid - carriedSolid;
  let effect = difference > 4 ? 'mix' : 'pour';
  let plume = end;
  let strength = 1;
  if (tray === 'copper' && Math.abs(produced) > 1e-8) {
    effect = produced > 0 ? 'precipitate' : 'dissolve';
    if (produced > 0) plume = [157, 210, 237];
    strength = Math.min(1, Math.sqrt(500 * Math.abs(produced) / after.ml));
  } else if (tray === 'iodine' && key === 'vitamin' && before.value > after.value + 1e-10) {
    effect = 'bleach';
    plume = [228, 241, 242];
    strength = Math.min(1, Math.sqrt(5 * (before.value - after.value) / before.value));
  } else if (tray === 'iodine' && key === 'starch' && after.value > 1e-10 && difference > 4) {
    plume = [31, 35, 68];
  }
  return {before, after, start, end, plume, strength, effect, incoming};
}

const width = 192, height = 112;
const contact = .13;
const timings = {pour:900, mix:2700, bleach:2900, precipitate:3600, dissolve:3100};

function flocStamp() {
  const stamp = document.createElement('canvas');
  stamp.width = 48;
  stamp.height = 36;
  const ctx = stamp.getContext('2d');
  for (const [x, y, r] of [[15,20,12],[29,20,12],[24,12,11],[34,14,8],[12,13,6]]) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, 'rgba(210,238,248,.98)');
    glow.addColorStop(.45, 'rgba(154,211,239,.95)');
    glow.addColorStop(.73, 'rgba(67,145,198,.82)');
    glow.addColorStop(1, 'rgba(65,141,198,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x-r, y-r, 2*r, 2*r);
  }
  return stamp;
}

function paintLiquid(ctx, pixels, change, progress) {
  const {start, end, plume, strength, effect} = change;
  // The reaction starts at the surface. Two winding streams spread and then mix.
  const spread = smooth(.01, .86, progress);
  const uniform = smooth(.30, .95, progress);
  const turbidity = effect==='precipitate' ? .52*strength*smooth(.14,.48,progress)*(1-smooth(.58,.97,progress)) : 0;
  const base = start.map((c, i) => lerp(lerp(c, end[i], uniform), plume[i], turbidity));
  const tint = plume.map((c, i) => c - base[i]);
  const front = 1.32 * spread;
  const visible = effect === 'pour' ? 0 : strength * (1 - smooth(.65, 1, progress));
  const data = pixels.data;
  for (let y = 0, offset = 0; y < height; y++) {
    const depth = y / height;
    const reached = smooth(-.13, .13, front - depth);
    const head = Math.exp(-28 * (depth - front + .11) ** 2);
    const left = .45 + (.018 + depth*.15)*Math.sin(7.5*depth - 3.5*spread);
    const branch = left + Math.sin(9*depth - 2.2*spread) * (.02 + .16*spread);
    const radius = .02 + spread*.12 + head*.10 + .016*(1+Math.sin(16*depth-3*spread));
    const fringe = .022 * Math.sin(20*depth + 5*spread);
    // The two leading lobes roll outwards as the denser front descends.
    const wing = .045 + spread*.17, lobeWidth=.045+.095*spread;
    const leadingLeft = ((depth-front+.08+wing*.42) / (.085+.09*spread))**2;
    const leadingRight = ((depth-front+.06+wing*.30) / (.075+.09*spread))**2;
    for (let x = 0; x < width; x++, offset+=4) {
      const across = x / width;
      const warp = fringe * Math.sin(13*across + 6*depth - 3*spread);
      const core = 1 - smooth(radius*.25, radius, Math.abs(across-left+warp));
      const curl = 1 - smooth(radius*.18, radius*.6, Math.abs(across-branch-warp));
      const leftLobe = ((across-left+wing+warp)/lobeWidth)**2+leadingLeft;
      const rightLobe = ((across-left-wing*.88-warp)/(lobeWidth*.90))**2+leadingRight;
      const lobes = (1-smooth(.12,1.25,Math.min(leftLobe,rightLobe)))*smooth(.03,.20,spread);
      const mask = reached * visible * Math.max(core, curl*.83, lobes*.88);
      for (let k = 0; k < 3; k++) data[offset+k] = base[k] + tint[k]*mask;
      data[offset+3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

function paintFlocs(ctx, stamp, progress, strength) {
  const count = Math.ceil(43 * strength);
  for (let i = 0; i < count; i++) {
    const seed = ((i * 37 + 11) % 101) / 101;
    const age = clamp((progress - .06 - seed*.34) / (.88 - seed*.34));
    if (!age || age === 1) continue;
    const lane = ((i * 67 + 17) % 103) / 103;
    const depth = ((i * 23 + 54) % 97) / 97;
    const fan = smooth(0, .52, age);
    const x = .45 + fan * ((lane-.5)*.91 + .043*Math.sin(8*age+i));
    const suspended = lerp(.04+seed*.12, .19+depth*.58, fan);
    const y = lerp(suspended, .99, smooth(.46,1,age));
    const size = (10+seed*19) * (.55+.45*strength);
    ctx.globalAlpha = smooth(0,.20,age) * (1-smooth(.76,1,age));
    ctx.save();
    ctx.translate(x*width,y*height);
    ctx.rotate((lane-.5)*1.6);
    ctx.drawImage(stamp,-size/2,-size*.37,size,size*.74);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function createReactionPlayer(root, onFrame) {
  const cups = [...root.querySelectorAll('[data-vessel]')];
  const fields = cups.map(cup => {
    const field = cup.querySelector('.fl-flow');
    const sample = cup.querySelector('.fl-sample-flow');
    field.width = sample.width = width;
    field.height = sample.height = height;
    return {field, ctx:field.getContext('2d'), sample:sample.getContext('2d')};
  });
  if (fields.some(view => !view.ctx || !view.sample)) {
    root.classList.add('fl-static');
    return {play(){},stop(){},dispose(){}};
  }
  const pixels = fields[0].ctx.createImageData(width, height);
  const stamp = flocStamp();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canAnimate = () => !reduced.matches && document.body.classList.contains('fx-on');
  let active = null, raf = 0;

  function stop() {
    cancelAnimationFrame(raf);
    if (!active) return;
    const {index, change} = active;
    active = null;
    const {ctx} = fields[index], cup = cups[index];
    ctx.fillStyle = change.after.color;
    ctx.fillRect(0, 0, width, height);
    cup.classList.remove('fl-reacting');
    for (const prop of ['--moving-level','--moving-bed','--moving-share','--fall','--drop-opacity']) cup.style.removeProperty(prop);
    onFrame(index, change.after, null);
  }

  function play(index, change, capacity) {
    stop();
    if (!canAnimate()) return;
    active = {index, change};
    const cup = cups[index], {ctx, field, sample} = fields[index];
    const {before, after, effect} = change;
    const stream=after.ml-before.ml>=.49;
    cup.classList.add('fl-reacting');
    cup.style.setProperty('--drop-color', change.incoming);
    const phaseLabel=cup.querySelector('.fl-phase');
    const start = performance.now();
    let lastPaint = -Infinity, lastPhase='';
    function draw(now) {
      const t = clamp((now - start) / timings[effect]);
      if (t >= 1) { stop(); return; }
      if (now - lastPaint >= 30) {
        lastPaint = now;
        const progress = clamp((t - contact) / (1 - contact));
        const fill = smooth(0, .26, progress);
        const settling = effect === 'precipitate' ? smooth(.36,.95,progress) : smooth(.12,.83,progress);
        const ml = lerp(before.ml, after.ml, fill);
        const solid = lerp(before.solid, after.solid, settling);
        const depositShare = lerp(before.depositShare, after.depositShare, settling);
        let phase='液体混匀中';
        if (t <= contact) phase=stream?'正在加液':'正在滴加';
        else if (effect==='precipitate') phase=progress<.57?'絮状沉淀出现':'絮状物下沉';
        else if (effect==='dissolve') phase='沉淀逐渐溶解';
        else if (effect==='bleach') phase='滴落处褪色';
        else if (effect==='mix') phase='颜色正在扩散';
        if(phase!==lastPhase){phaseLabel.textContent=phase;lastPhase=phase;}
        if (t <= contact || effect === 'pour') {
          ctx.fillStyle = t <= contact ? (before.ml > 0 ? before.color : after.color) : after.color;
          ctx.fillRect(0, 0, width, height);
        } else {
          paintLiquid(ctx, pixels, change, progress);
          if (effect === 'precipitate') paintFlocs(ctx, stamp, progress, change.strength);
        }
        sample.drawImage(field, 0, 0);
        const dispensing=t<=contact || (stream && progress<.18);
        const drop=dispensing ? {fall:Math.min(1,(t/contact)**2),color:change.incoming,stream} : null;
        cup.style.setProperty('--moving-level', (100*ml/capacity)+'%');
        cup.style.setProperty('--moving-bed', (100*ml/capacity*depositShare)+'%');
        cup.style.setProperty('--moving-share', (100*depositShare)+'%');
        cup.style.setProperty('--fall', String(drop?.fall || 0));
        cup.style.setProperty('--drop-opacity', drop ? '1' : '0');
        onFrame(index, {ml,solid,depositShare}, drop);
      }
      raf = requestAnimationFrame(draw);
    }
    draw(start);
  }
  const preference = () => { if (!canAnimate()) stop(); };
  reduced.addEventListener('change', preference);
  window.addEventListener('chem:fx', preference);
  return {play,stop,dispose() {
    stop();
    reduced.removeEventListener('change', preference);
    window.removeEventListener('chem:fx', preference);
  }};
}
