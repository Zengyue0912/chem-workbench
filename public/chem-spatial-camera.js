(function () {
'use strict';

const pinchDistance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const movementLimit = value => Math.max(-.065,Math.min(.065,value));

function create(viewport,onMotion) {
  const video = document.createElement('video');
  video.className = 'cw-camera-feed';
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('aria-hidden','true');
  viewport.prepend(video);

  const panel = document.createElement('div');
  panel.className = 'cw-camera-state';
  panel.hidden = true;
  const status = document.createElement('p');
  status.setAttribute('role','status');
  panel.append(status);

  let stream = null;
  let epoch = 0, handEpoch = 0, frame = 0;
  let pending = false, loadingHands = false, background = false;
  let detector = null, controls = null, mark = null;
  let syncDraw = () => {};

  function update() {
    if (!controls) return;
    controls.camera.textContent = pending ? '取消开启' : background ? '退出 AR' : '摄像头 AR';
    controls.camera.setAttribute('aria-pressed',String(background));
    controls.hands.hidden = !background;
    controls.hands.textContent = loadingHands ? '正在加载手势' : detector ? '关闭手势' : '开启手势';
    controls.hands.setAttribute('aria-pressed',String(!!detector));
    controls.hands.disabled = loadingHands;
  }

  function show(text) {
    status.textContent = text;
    panel.hidden = !text;
  }

  function stopHands() {
    ++handEpoch;
    loadingHands = false;
    cancelAnimationFrame(frame);
    const previous = detector;
    detector = null;
    try { previous?.close(); } catch {}
    mark = null;
    update();
  }

  function stop(message = '') {
    ++epoch;
    pending = false;
    background = false;
    stopHands();
    for (const track of stream?.getTracks() || []) track.stop();
    stream = null;
    video.pause();
    video.srcObject = null;
    viewport.classList.remove('cw-is-ar');
    show(message);
    update();
    syncDraw();
  }

  async function toggleCamera() {
    if (stream || pending) return stop();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      show('此页面的浏览器环境无法打开相机，仍可拖动和缩放模型。');
      return;
    }
    pending = true;
    const turn = ++epoch;
    update();
    show('请在浏览器提示中允许相机。相机画面只在当前浏览器内显示。');
    try {
      const incoming = await navigator.mediaDevices.getUserMedia({
        audio:false, video:{facingMode:'user',width:{ideal:960},height:{ideal:540}}
      });
      if (turn !== epoch) {
        incoming.getTracks().forEach(track=>track.stop());
        return;
      }
      stream = incoming;
      incoming.getVideoTracks().forEach(track=>track.addEventListener('ended',() => {
        if (stream === incoming) stop('相机已断开，可以继续用普通 3D 观察。');
      },{once:true}));
      video.srcObject = stream;
      await video.play();
      if (turn !== epoch) return;
      pending = false;
      background = true;
      viewport.classList.add('cw-is-ar');
      show('AR 已开启 · 拖动模型或打开手势');
      update();
      syncDraw();
    } catch (error) {
      if (turn !== epoch) return;
      const reason = error.name === 'NotAllowedError' ? '相机权限未开启' : '未能连接相机';
      stop(reason + '，可以继续用普通 3D 观察。');
    }
  }

  function readPose(hand) {
    const wrist=hand?.[0], middle=hand?.[9], thumb=hand?.[4], index=hand?.[8];
    if (!wrist || !middle || !thumb || !index) {
      mark = null;
      return;
    }
    const palm = pinchDistance(wrist,middle);
    if (palm < .035 || pinchDistance(thumb,index)/palm > (mark ? .48 : .34)) {
      mark = null;
      return;
    }
    const next = {x:1-(thumb.x+index.x)/2,y:(thumb.y+index.y)/2};
    if (mark) onMotion(movementLimit(next.x-mark.x),movementLimit(next.y-mark.y));
    mark = next;
  }

  async function toggleHands() {
    if (detector) {
      stopHands();
      show('AR 已开启 · 拖动模型或打开手势');
      return;
    }
    if (!background || loadingHands) return;
    loadingHands = true;
    const turn = ++handEpoch;
    show('正在加载本地手势识别…');
    update();
    try {
      const {FilesetResolver, HandLandmarker} = await import('./assets/vision/vision-bundle.js');
      const files = await FilesetResolver.forVisionTasks(new URL('./assets/vision/wasm/',document.baseURI).href.replace(/\/$/,''));
      if (turn !== handEpoch) return;
      const engine = await HandLandmarker.createFromOptions(files,{
        baseOptions:{modelAssetPath:new URL('./assets/vision/hand_landmarker.task',document.baseURI).href,delegate:'CPU'},
        runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.55,minTrackingConfidence:.55
      });
      if (turn !== handEpoch) { engine.close(); return; }
      detector = engine;
      loadingHands = false;
      show('拇指和食指捏合，再移动手来旋转模型。松开后停止。');
      update();
      let lastFrame = -1, lastTime = -Infinity;
      const tick = time => {
        if (engine !== detector) return;
        if (video.readyState >= 2 && video.currentTime !== lastFrame && time-lastTime >= 70) {
          lastFrame = video.currentTime;
          lastTime = time;
          try {
            readPose(engine.detectForVideo(video,time).landmarks[0]);
          } catch {
            stopHands();
            show('手势识别暂不可用，可以拖动模型继续观察。');
            return;
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } catch {
      if (turn !== handEpoch) return;
      stopHands();
      show('手势识别加载失败，相机 AR 仍可用鼠标或触屏操作。');
    }
  }

  document.addEventListener('visibilitychange',() => { if (document.hidden) stop(); });
  window.addEventListener('pagehide',() => stop());

  return {
    bind(buttons,redraw,toolbar) {
      controls = buttons;
      syncDraw = redraw;
      toolbar.append(panel);
      controls.camera.onclick = toggleCamera;
      controls.hands.onclick = toggleHands;
      update();
    },
    stop
  };
}

window.ChemLabCamera = {create};
})();
