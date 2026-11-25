// 꼬꼬의 첫 출근 — 3D 본판: 마을(마트) → 회사(공장·회의실), 실내는 문으로 들어간다
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { toon, toonify, addOutline, GRAD_ENV } from './toon.js?v=7';
import { buildChicken, buildCritter } from './chars.js?v=13';
import { WHO, DIALOGUE, OPENING, QUEST_TEXT } from './story.js?v=14';
import * as EXAM from './exam.js?v=22';

const $ = (id) => document.getElementById(id);

/* ── 렌더러·장면 ───────────────────────────── */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const QS = new URLSearchParams(location.search);
const SHOT = QS.has('shot');   // 그림 찍기용(적응형 화질 끔)
if (QS.has('debug')) document.body.classList.add('debug');   // fps 숫자는 ?debug 때만
// 픽셀비: 낮게(최대 1.25) 시작해서 느리면 빨리 내리고, 넉넉하면 천천히 올린다(최대 1.5)
const PR_MAX = Math.min(devicePixelRatio, 1.5), PR_MIN = 0.6;
let PR = SHOT ? 1 : Math.min(devicePixelRatio, 1.25);
renderer.setPixelRatio(PR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = skyTexture();
scene.fog = new THREE.Fog(0xcfe9ff, 26, 62);
const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 140);
const CAM_OFF = new THREE.Vector3(0, 6.4, 9.6);
const hemi = new THREE.HemisphereLight(0xe8f6ff, 0x7aa05a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(PR); renderer.setSize(w, h, false);
  composer.setPixelRatio(PR); composer.setSize(w, h);   // 컴포저도 픽셀비를 따라가야 실제 렌더 크기가 준다
  bloom.resolution.set(w / 3, h / 3);
  camera.aspect = w / h; camera.fov = w / h < 1.2 ? 52 : 40; camera.updateProjectionMatrix();
  EXAM.fit && EXAM.fit();
}
addEventListener('resize', resize); resize();

function skyTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#6fc3ff'); gr.addColorStop(0.55, '#bfe6ff'); gr.addColorStop(1, '#fff3d6');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ── 캔버스 텍스처 ─────────────────────────── */
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]);
  t.anisotropy = 8; return t;
}
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function grass(rep) { return canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#8ccf5a'; g.fillRect(0, 0, w, h); const r = rnd(7);
  for (let i = 0; i < 900; i++) { const x = r() * w, y = r() * h, l = 4 + r() * 7; g.strokeStyle = r() < 0.5 ? 'rgba(110,182,64,.9)' : 'rgba(168,222,104,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - l); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(r() * w, r() * h, 1.6, 0, 7); g.fill(); }
}, rep); }
function dirt(rep) { return canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#e8c98e'; g.fillRect(0, 0, w, h); const r = rnd(11);
  for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h, rr = 6 + r() * 14; g.fillStyle = r() < 0.5 ? 'rgba(210,175,120,.8)' : 'rgba(245,220,170,.9)'; g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(160,140,120,.85)'; g.beginPath(); g.ellipse(r() * w, r() * h, 5, 3.5, r() * 3, 0, 7); g.fill(); }
}, rep); }
function pavement(rep) { return canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#d9d4cb'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(150,140,130,.6)'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  const r = rnd(5); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${120 + r() * 60},${120 + r() * 50},${110 + r() * 40},.25)`; g.fillRect(r() * w, r() * h, 2, 2); }
}, rep); }
function plane(w, d, tex, x, z, y = 0.01) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshToonMaterial({ map: tex, gradientMap: GRAD_ENV }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
}

/* ── 물 셰이더 ─────────────────────────────── */
const waterUniform = { value: 0 };
function waterMat(round, dirtyAt = -1) {
  return new THREE.ShaderMaterial({
    uniforms: { t: waterUniform, dirty: { value: dirtyAt } }, transparent: true,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float t; uniform float dirty; varying vec2 vUv;
      void main(){ vec2 p=vUv-.5; ${round ? 'float d=length(p); if(d>.5) discard;' : 'float d=abs(p.y)*1.;'}
        float w=sin((vUv.x*${round ? '18.' : '90.'}+t*1.6))*.5+sin((vUv.y*22.-t*1.3))*.5;
        vec3 c=mix(vec3(.20,.52,.88),vec3(.42,.76,1.),smoothstep(.3,.5,w*.5+.5));
        c=mix(c,vec3(.95,1.,1.),smoothstep(.43,.5,d));
        float s=step(.985,sin(vUv.x*${round ? '40.' : '200.'}+t*2.)*sin(vUv.y*36.-t*1.7)); c+=s*.35;
        float k=0.;
        if(dirty>=0.){   /* 강: 길이 49m·폭 4.2m. 관 물줄기가 떨어지는 자리(dirty, 둑에서 1.7m)에서 하류(+x)로 퍼진다 */
          float u=(vUv.x-dirty)*49., v=(vUv.y-.595)*4.2+.12*sin(u*.9-t*2.)*smoothstep(0.,3.,u);
          float w=.45+max(u,0.)*.16;
          k=exp(-v*v/(w*w))*exp(-max(u,0.)/16.)*smoothstep(-1.2,0.,u);
          k=clamp(k*1.25,0.,1.);
          c=mix(c,vec3(.20,.10,.025),k); }   /* 출력 단계에서 sRGB로 밝아짐 → 흙탕물 갈색 */
        gl_FragColor=vec4(c,mix(.93,1.,k)); }`,
  });
}

/* ── 모델 불러오기·배치 ─────────────────────── */
const loader = new GLTFLoader();
const protos = {};
const MODELS = ['home', 'market', 'well', 'windmill', 'bench', 'streetlight', 'bush', 'box', 'barrel',
  'tree_single_A', 'tree_single_B', 'trees_A_medium', 'trees_B_small', 'rock_single_A', 'rock_single_C',
  'fence_wood_straight', 'crate_A_small', 'crate_A_big', 'cloud_big', 'crate_carrots', 'crate_tomatoes', 'crate_lettuce',
  'building_G', 'car_sedan', 'firehydrant', 'dumpster', 'bowl'];
const ALIAS = { building_G: 'office' };
// 모델 하나: 시간 제한 15초, 실패하면 2번 더 받는다. 끝내 못 받으면 null(그 자리는 대체 상자)
const texCache = {};   // KayKit 아틀라스는 파일마다 같은 그림 → 이름·크기가 같으면 텍스처 하나를 같이 쓴다
function shareTextures(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      const t = m && m.map; if (!t || !t.name || !t.image) return;
      const key = t.name + '|' + (t.image.width || 0) + 'x' + (t.image.height || 0);
      if (!texCache[key]) texCache[key] = t;
      else if (texCache[key] !== t) { const old = t; m.map = texCache[key]; old.dispose(); }
    });
  });
}
function loadOne(n, tries = 3) {
  const url = `assets/models/kaykit/${ALIAS[n] || n}.glb`;
  const once = () => new Promise((res, rej) => {
    let over = false;
    const tm = setTimeout(() => { over = true; rej(new Error('응답 없음(15초)')); }, 15000);
    loader.load(url, (g) => { if (over) return; clearTimeout(tm); res(g); }, undefined, (e) => { if (over) return; clearTimeout(tm); rej(e); });
  });
  return (async () => {
    for (let k = 1; k <= tries; k++) {
      try { return await once(); }
      catch (e) { console.warn('모델 받기 실패', n, k + '번째', e && e.message); if (k < tries) await new Promise((r) => setTimeout(r, 600 * k)); }
    }
    return null;
  })();
}
const failedModels = [];
async function loadAll() {
  let done = 0;
  await Promise.all(MODELS.map(async (n) => {
    const g = await loadOne(n);
    if (g) {
      const root = g.scene; shareTextures(root);
      const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3());
      root.position.set(-c.x, -box.min.y, -c.z);
      const holder = new THREE.Group(); holder.add(root);
      protos[n] = { holder, size: box.getSize(new THREE.Vector3()) };
    } else failedModels.push(n);
    $('ld-fill').style.width = (++done / MODELS.length * 100) + '%';
  }));
}
// 못 받은 모델 자리: 같은 크기쯤의 상자(건물 앞 문 위치 계산이 멈추지 않게)
function fallbackProto(name) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), toon(0xd9cbb5, { env: true })); m.position.y = 0.5; g.add(m);
  return (protos[name] = { holder: g, size: new THREE.Vector3(1, 1, 1), fallback: true });
}
const colliders = [], occluders = [], clouds = [];
// top: 올라설 수 있는 낮은 소품(무릎~허리 높이). true면 모델 높이, 숫자면 그 높이. 없으면 높이와 상관없이 막는다(건물·울타리·나무 등)
function place(name, x, z, { s = 1, h = 0, w = 0, ry = 0, solid = true, shrink = 0.8, outline = 0.02, occl = true, top = 0 } = {}) {
  const p = protos[name] || fallbackProto(name);
  if (p.fallback && /cloud/.test(name)) return null;   // 구름은 없으면 그냥 뺀다
  if (h) s = h / p.size.y; if (w) s = w / p.size.x;
  const g = p.holder.clone(true);
  toonify(g, { outline: outline / s });
  g.scale.setScalar(s); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const rot = Math.abs(Math.sin(ry)) > 0.7, sx = p.size.x * s, sz = p.size.z * s;
  const info = { g, x, z, w: rot ? sz : sx, d: rot ? sx : sz, h: p.size.y * s };
  if (occl && info.h > 1.6) {
    const mats = [], outs = [];
    g.traverse((o) => { if (o.isMesh) { if (o.userData.isOutline) outs.push(o); else mats.push(o.material); } });
    occluders.push({ x, z, r: Math.max(sx, sz) * 0.5, mats, outs, a: 1 });
  }
  if (solid) { const c = { x, z, hw: info.w * shrink / 2, hd: info.d * shrink / 2 }; if (top) c.top = top === true ? info.h : top; colliders.push(c); }
  // 나무 잎 부분: 땅에서는 줄기만 막지만, 제출 뒤 날 때(S.roam)는 잎 높이에서 잎 너비만큼 막는다(몸이 나무를 뚫고 들어가지 않게)
  if (solid && /^trees?_/.test(name)) colliders.push({ x, z, hw: info.w * 0.36, hd: info.d * 0.36, canopy: true, y0: info.h * 0.3, y1: info.h });
  return info;
}
const front = (b, gap = 0.6) => ({ x: b.x, z: b.z + b.d / 2 + gap });   // 건물 정면(남쪽) 문 앞 (place는 null을 돌려주지 않는다 — 못 받은 모델은 대체 상자)

/* ── 간판·광고판(캔버스 글자) ─────────────── */
function signPlane(text, w, h, { bg = '#fff8ec', fg = '#c24d18', font = 'Jua', size = 64, border = '#3b2a1e', logo = false } = {}) {
  const tex = canvasTex(512, Math.round(512 * h / w), (g, W, H) => {
    g.fillStyle = border; g.fillRect(0, 0, W, H);
    g.fillStyle = bg; g.fillRect(10, 10, W - 20, H - 20);
    let x0 = W / 2;
    if (logo) { // 불꽃 모양 마크
      g.save(); g.translate(70, H / 2); g.fillStyle = '#e8402c';
      g.beginPath(); g.moveTo(0, 38); g.bezierCurveTo(-36, 20, -26, -16, 0, -40); g.bezierCurveTo(4, -14, 30, -6, 22, 18); g.bezierCurveTo(18, 30, 10, 36, 0, 38); g.fill();
      g.fillStyle = '#ffb02e'; g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(-16, 18, -10, 0, 2, -14); g.bezierCurveTo(6, 2, 18, 8, 10, 22); g.fill(); g.restore();
      x0 = W / 2 + 40;
    }
    g.fillStyle = fg; g.font = `${size}px "${font}"`; g.textAlign = 'center'; g.textBaseline = 'middle';
    String(text).split('\n').forEach((ln, i, a) => g.fillText(ln, x0, H / 2 + (i - (a.length - 1) / 2) * size * 1.1));
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  // 색을 살짝 낮춰 블룸에 하얗게 번지지 않게(글자가 또렷하게)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: 0xdedede }));
  return m;
}

/* ── 캐릭터 ────────────────────────────────── */
const hero = buildChicken(); scene.add(hero.root);
const NPCS = [];
function addNPC(id, actor, x, z, ry, r = 1, room = null, who = null) {
  actor.root.position.set(x, 0, z); actor.root.rotation.y = ry; scene.add(actor.root);
  const c = { x, z, hw: 0.45 * r, hd: 0.45 * r }; colliders.push(c);
  const n = { id, actor, x, z, ry, r, kind: 'npc', room, who: who || id, col: c }; NPCS.push(n); return n;
}

/* ── 강의 더러운 물(3장 내용): 2장을 마치기 전에는 맑은 강, 배수관도 없음 ── */
const POLL = { uni: null, pipe: null, flow: null, splash: null, dirtyAt: -1, on: false };
function setPollution(on) {
  POLL.on = !!on;
  if (POLL.uni) POLL.uni.value = on ? POLL.dirtyAt : -1;
  if (POLL.pipe) POLL.pipe.visible = !!on;
}

/* ── 세계 ──────────────────────────────────── */
// 바깥: 마을 x∈[-22,21] + 회사 x∈[21,70] (울타리 문 하나).
// 실내(마트·공장·회의실)는 멀리 z≈-80에 따로 짓고, 문으로 들어가면 순간이동한다.
const GATE_X = 21;
// 올라서는 소품 윗면(모델을 재서 맞춤): 자동차 보닛 높이·지붕 가운데 위치·지붕 반폭 비율
const CAR_HOOD = 0.6, CAR_ROOF_DX = -0.25, CAR_ROOF_W = 0.19;
const TH = {};      // 상호작용 대상 id → {kind,x,z,room,...}
const gates = [];   // {x, need, collider, mesh, locked}
const ROOMS = {};
const markers = []; // 반짝이는 자리 표시
const MOM_OPTS = { cap: false, apron: 0x58a14a, pocket: 0x3f7f35, pencil: false, size: 1.18, combColor: 0xe84a3a, flower: true };
const BABY_OPTS = { body: 0xffdf4a, cap: false, apron: null, size: 0.62, chick: true, beakColor: 0xf08a1e };
function box(w, h, d, x, y, z, mat, ol = 0.02, parent = scene) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z);
  b.castShadow = true; b.receiveShadow = true; if (ol) addOutline(b, ol); parent.add(b); return b;
}
function buildWorld() {
  // 땅
  plane(112, 60, grass([21, 11]), 24, 0, 0);
  // 바깥 넓은 풀밭(그림자 없음, 원래 땅판보다 조금 아래): 제출 뒤 높이 날 때 땅판 끝이 하늘에 드러나지 않게
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(320, 240), new THREE.MeshToonMaterial({ map: grass([60, 45]), gradientMap: GRAD_ENV }));
  outer.rotation.x = -Math.PI / 2; outer.position.set(24, -0.12, 0); scene.add(outer);
  plane(49, 17.4, pavement([13, 5]), 45.5, -5.1, 0.006);
  plane(44, 3.6, dirt([11, 1.2]), -0.5, 2.2);
  // 연못
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), waterMat(true));
  pond.rotation.x = -Math.PI / 2; pond.position.set(-1.5, 0.02, 6.6); pond.scale.set(1.4, 1, 1); scene.add(pond);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.12, 8, 40), toon(0xb9b2a4, { env: true }));
  rim.rotation.x = Math.PI / 2; rim.position.copy(pond.position); rim.scale.set(1.4, 1, 1); addOutline(rim, 0.015); scene.add(rim);
  colliders.push({ x: -1.5, z: 6.6, hw: 2.5, hd: 1.7 });
  flowers(-22, 20, 1);

  /* 1) 마을 */
  const home = place('home', -10, -6.2, { h: 4.8 });
  const hf = front(home, 0.2);
  TH.homeDoor = { id: 'homeDoor', kind: 'door', x: hf.x, z: hf.z, label: '꼬꼬네 집', toRoom: 'home', needProg: 0 };
  const market = place('market', 6, -6.4, { h: 5.0 });
  place('well', -2, -4.4, { h: 2.1 });
  place('windmill', -17.5, -9.5, { h: 8.5 });
  [[-14.5, -2.8], [-15, 6.5], [15, -1.5], [13.5, 7], [1.5, -10.5], [-5, -10.5], [9.5, 9.8], [-9.5, 10], [18, 7.5], [-20, -1.5], [-6.5, 8.5], [5.5, 8.6], [17.5, -6]]
    .forEach(([x, z], i) => place(['tree_single_A', 'tree_single_B', 'trees_B_small'][i % 3], x, z, { h: 3.6 + (i % 3) * 0.6, ry: i, shrink: 0.3 }));
  place('trees_A_medium', -21, -12, { h: 5, shrink: 0.5 }); place('trees_A_medium', 16.5, -12, { h: 5, shrink: 0.5 });
  [[-4.5, 0.5], [4.5, 0.5], [-13, 0.5], [13, 0.5], [-20, 0.5]].forEach(([x, z]) => place('streetlight', x, z, { h: 2.8, shrink: 0.25 }));
  place('bench', -16, 4.4, { h: 0.95, ry: Math.PI / 2, top: true }); place('bench', 16, 4.6, { h: 0.95, ry: -Math.PI / 2, top: true });
  [[2.3, -3.4], [9.4, -3.6]].forEach(([x, z]) => place('crate_carrots', x, z, { h: 0.85, top: true }));
  place('crate_tomatoes', 10.6, -3.3, { h: 0.85, top: true }); place('crate_lettuce', 1.2, -3.6, { h: 0.85, top: true });
  [[-13.1, -3.4], [-6.9, -3.6], [-14.3, -2.2]].forEach(([x, z]) => place('bush', x, z, { h: 1.1, shrink: 0.6 }));
  place('barrel', -13.3, -1.3, { h: 0.95, top: true }); place('crate_A_small', 11.6, -1.8, { h: 0.8, top: true }); place('crate_A_big', 12.4, -2.8, { h: 1.0, top: true });
  place('rock_single_A', 1.6, 9.2, { h: 0.9, top: true }); place('rock_single_C', -4.6, 8.0, { h: 0.7, top: true });
  for (let x = -22; x <= 19.6; x += 2.2) place('fence_wood_straight', x, -13.4, { h: 1.1, shrink: 1, occl: false });
  const mf = front(market, 0.2);
  TH.martDoor = { id: 'martDoor', kind: 'door', x: mf.x, z: mf.z, label: '동네 마트', toRoom: 'mart', needProg: 0, needFlags: ['talkedMom'], lockedDlg: 'lockedMartDoor' };
  const mom = addNPC('mom', buildChicken(MOM_OPTS), -5, -1.4, 0.35, 1.15);
  const baby = addNPC('baby', buildChicken(BABY_OPTS), -3.8, -0.9, -0.4, 0.7);
  Object.assign(mom, { dlg: 'mom', setFlag: 'talkedMom', labelY: 2.15 }); Object.assign(baby, { dlg: 'baby', labelY: 1.3 });

  // 일자리 알림판(오프닝 장면용 소품)
  { const jx = -18, jz = -3.2, pm = toon(0x8a5a36, { env: true });
    [-1, 1].forEach((o) => box(0.16, 1.9, 0.16, jx + o * 0.9, 0.95, jz, pm));
    box(2.1, 1.3, 0.12, jx, 1.55, jz, toon(0xc98d55, { env: true }));
    const poster = signPlane('일할 사람' + String.fromCharCode(10) + '구해요', 1.5, 1.0, { size: 92, fg: '#c24d18', bg: '#fffdf2', border: '#e0a800' });
    poster.position.set(jx, 1.55, jz + 0.07); scene.add(poster); colliders.push({ x: jx, z: jz, hw: 1.1, hd: 0.3 }); }

  /* 마을 → 회사 문 */
  addGate(GATE_X, 1, 'lockedGate1');

  /* 2) 회사: 공장 건물 + 회의실 건물 나란히, 광고판, 강가 */
  const factory = buildFactory(32.5, -8.6);
  const meet = place('building_G', 54.5, -8, { h: 7 });
  const ms = signPlane('회의실', 3.4, 1.0, { size: 84, fg: '#2c3e7a' });
  ms.position.set(meet.x, 3.6, meet.z + meet.d / 2 + 0.06); scene.add(ms);
  const ff = front(factory, 0.3), mf2 = front(meet, 0.3);
  TH.factoryDoor = { id: 'factoryDoor', kind: 'door', x: ff.x, z: ff.z, label: '불꽃식품 공장', toRoom: 'factory', needProg: 1, lockedDlg: 'lockedGate1' };
  TH.meetDoor = { id: 'meetDoor', kind: 'door', x: mf2.x, z: mf2.z, label: '회의실', toRoom: 'meet', needProg: 2, lockedDlg: 'lockedMeetDoor' };
  // 광고판: 크게, 길 쪽(카메라 쪽)을 보게
  const bx = 63.5, bz = -3.8;
  const postMat = toon(0x8a5a36, { env: true });
  [-2.3, 2.3].forEach((o) => box(0.26, 3.0, 0.26, bx + o, 1.5, bz, postMat));
  box(6.2, 3.1, 0.22, bx, 3.75, bz, toon(0xfff8ec, { env: true }), 0.025);
  const adFace = signPlane("채소가 가득한\n건강한 라면!", 5.9, 2.8, { size: 92, fg: '#2f7d32', bg: '#fffdf2', border: '#c9a24a' });
  adFace.position.set(bx, 3.75, bz + 0.12); scene.add(adFace);
  colliders.push({ x: bx, z: bz, hw: 2.6, hd: 0.4 });
  TH.adboard = { id: 'adboard', kind: 'scene', x: bx, z: bz + 1.7, label: '광고판', room: null, chapter: 2, spot: 'adboard', auto: true, labelY: 1.6, face: Math.PI };
  addMarker('adboard', bx, bz + 1.7);
  // 강 + 배수관(공장 쪽)
  const pipeX = 36.5;
  const river = new THREE.Mesh(new THREE.PlaneGeometry(49, 4.2, 1, 1), waterMat(false, (pipeX - 21) / 49));
  POLL.dirtyAt = (pipeX - 21) / 49; POLL.uni = river.material.uniforms.dirty;
  river.rotation.x = -Math.PI / 2; river.position.set(45.5, 0.025, 10.4); scene.add(river);
  plane(49, 0.6, dirt([12, 0.3]), 45.5, 8.1, 0.02);
  colliders.push({ x: 45.5, z: 11, hw: 24.5, hd: 2.4 });
  // 배수관: 둑의 콘크리트 받침에서 강 위로 나와 더러운 물을 쏟는다(2장을 마친 뒤에만 보임)
  const pipe = new THREE.Group(); scene.add(pipe);
  const PY = 0.78;   // 관 높이(수면 위)
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 18), toon(0x8d939a, { env: true }));
  tube.rotation.x = Math.PI / 2; tube.position.set(pipeX, PY, 7.9); tube.castShadow = true; addOutline(tube, 0.02); pipe.add(tube);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 20), toon(0x6f757c, { env: true }));
  lip.position.set(pipeX, PY, 9.2); addOutline(lip, 0.012); pipe.add(lip);
  box(1.3, 1.25, 0.6, pipeX, 0.62, 6.75, toon(0xb9b2a4, { env: true }), 0.02, pipe);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.25, 18), new THREE.MeshBasicMaterial({ color: 0x2a1f16 }));
  mouth.position.set(pipeX, PY, 9.21); pipe.add(mouth);
  // 쏟아지는 물줄기(관 입구 → 수면): 아래로 흐르는 줄무늬
  const flowTex = canvasTex(32, 64, (g, w, h) => { g.fillStyle = '#5e3c18'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { g.fillStyle = '#80572a'; g.fillRect(0, y, w, 6); } }, [2, 3]);
  const fall = new THREE.QuadraticBezierCurve3(new THREE.Vector3(pipeX, PY - 0.06, 9.22), new THREE.Vector3(pipeX, PY - 0.06, 9.85), new THREE.Vector3(pipeX, 0.02, 10.0));
  const stream = new THREE.Mesh(new THREE.TubeGeometry(fall, 20, 0.17, 10, false), new THREE.MeshBasicMaterial({ map: flowTex, color: 0xdddddd }));
  pipe.add(stream);
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.6, 24), new THREE.MeshBasicMaterial({ color: 0x8a6438, transparent: true, opacity: 0.85, depthWrite: false }));
  splash.rotation.x = -Math.PI / 2; splash.position.set(pipeX, 0.04, 10.0); pipe.add(splash);
  colliders.push({ x: pipeX, z: 6.75, hw: 0.7, hd: 0.35 });
  POLL.pipe = pipe; POLL.flow = flowTex; POLL.splash = splash; setPollution(SHOT);
  TH.riverside = { id: 'riverside', kind: 'scene', x: pipeX - 1.7, z: 7.8, label: '강가', room: null, chapter: 2, spot: 'riverside', auto: true, labelY: 1.6, face: Math.PI / 2 };
  addMarker('riverside', pipeX - 1.7, 7.8);
  // 꾸밈
  [[24, 6], [50, 6.5], [68.5, -7], [68.5, 6], [60, -11]].forEach(([x, z], i) => place(['tree_single_A', 'tree_single_B', 'trees_B_small'][i % 3], x, z, { h: 3.8, ry: i, shrink: 0.3 }));
  [[25, 0.4], [35, 0.4], [47, 0.4], [59, 0.4], [68, 0.4]].forEach(([x, z]) => place('streetlight', x, z, { h: 3.0, shrink: 0.25 }));
  // 자동차: 앞뒤(보닛·트렁크)는 낮고 가운데 지붕이 높다 → 충돌 상자 둘
  { const car = place('car_sedan', 47.5, -2.6, { h: 1.15, ry: Math.PI / 2, solid: false });
    colliders.push({ x: car.x, z: car.z, hw: car.w * 0.43, hd: car.d * 0.42, top: CAR_HOOD }, { x: car.x + CAR_ROOF_DX, z: car.z, hw: car.w * CAR_ROOF_W, hd: car.d * 0.4, top: car.h }); }
  place('dumpster', 24.4, -3.6, { h: 1.3, ry: 0.2, top: 1.15 }); place('firehydrant', 45.5, -1.6, { h: 0.7, top: true });   // 쓰레기통 윗면은 뚜껑 가운데 높이(잰 값)
  [[27.5, -4.4], [29, -4.6], [28.2, -5.4]].forEach(([x, z], i) => place(i === 2 ? 'crate_A_big' : 'box', x, z, { h: 0.9, top: true }));
  place('bench', 56, 6.2, { h: 0.95, ry: Math.PI, top: true }); place('rock_single_A', 43, 7.2, { h: 0.8, top: true });
  for (let x = 22.2; x <= 69; x += 2.2) place('fence_wood_straight', x, -13.4, { h: 1.1, shrink: 1, occl: false });
  // 구름
  for (let i = 0; i < 10; i++) {
    const c = place('cloud_big', -26 + i * 10, -18 - (i % 2) * 5, { h: 2 + (i % 3), solid: false, outline: 0, occl: false });
    if (c) { c.g.position.y = 11 + (i % 3) * 1.5; c.g.userData.drift = 0.3 + (i % 3) * 0.15; clouds.push(c.g); }
  }
  // 세계 가장자리
  // 서쪽 끝은 길(z 2.2) 자리를 비워 둔다 — 그 길목은 미래 마을 FUT.col이 제출 전까지 막는다
  colliders.push({ x: 24, z: -14.6, hw: 50, hd: 1 }, { x: 24, z: 13.6, hw: 50, hd: 1 }, { x: -23, z: -9.7, hw: 1, hd: 10.3 }, { x: -23, z: 11.9, hw: 1, hd: 8.1 }, { x: 71, z: 0, hw: 1, hd: 20 });

  /* 3) 실내 */
  const voidPlane = new THREE.Mesh(new THREE.PlaneGeometry(170, 46), new THREE.MeshBasicMaterial({ color: 0x2b211a }));
  voidPlane.rotation.x = -Math.PI / 2; voidPlane.position.set(30, -0.02, -80); scene.add(voidPlane);
  buildHomeRoom(); buildMart(); buildFactoryRoom(); buildMeetRoom();
  buildVerbProps();
  buildFuture();
  NPCS.forEach((n) => { TH[n.id] = n; });
}

/* ── 실내 공통 ── */
function texTiles(rep, a, b) { return canvasTex(128, 128, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2); g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }, rep); }
function texWood(rep) { return canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#d9a96e'; g.fillRect(0, 0, w, h); const r = rnd(3);
  for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(150,95,50,.28)'; g.fillRect(0, y, w, 2); const x = r() * w; g.fillRect(x, y, 2, 32);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(120,70,30,.12)'; g.fillRect(r() * w, y + 4 + r() * 24, 30 + r() * 40, 1.5); } }
}, rep); }
function texConcrete(rep) { return canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#c3c7cb'; g.fillRect(0, 0, w, h); const r = rnd(9);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${90 + r() * 60},${95 + r() * 60},${100 + r() * 60},.25)`; g.fillRect(r() * w, r() * h, 2, 2); }
  g.strokeStyle = 'rgba(110,115,120,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
}, rep); }
const matCache = {};
const tm = (c) => matCache[c] || (matCache[c] = toon(c, { env: true }));
const ROOM_H = 3.0;   // 방 벽 높이(제출 뒤 날기 높이 상한도 이것으로 정한다)
// 지붕 없는 방: 뒷벽·옆벽은 높게, 앞벽(카메라 쪽)은 낮게, 앞 가운데에 나가는 문
function buildRoom(id, cx, cz, w, d, { floor, wall, trim }) {
  plane(w, d, floor, cx, cz, 0.01);
  const wm = toon(wall, { env: true }), trm = toon(trim, { env: true }), H = ROOM_H, T = 0.3;
  box(w + T * 2, H, T, cx, H / 2, cz - d / 2 - T / 2, wm);
  box(T, H, d, cx - w / 2 - T / 2, H / 2, cz, wm); box(T, H, d, cx + w / 2 + T / 2, H / 2, cz, wm);
  box(w, 0.3, 0.06, cx, 0.15, cz - d / 2 + 0.03, trm, 0.012);
  const gw = 2.2, sw = (w - gw) / 2;
  [-1, 1].forEach((s) => box(sw, 0.5, T, cx + s * (gw / 2 + sw / 2), 0.25, cz + d / 2 + T / 2, trm));
  colliders.push({ x: cx, z: cz - d / 2 - T / 2, hw: w / 2 + T, hd: T / 2 }, { x: cx - w / 2 - T / 2, z: cz, hw: T / 2, hd: d / 2 }, { x: cx + w / 2 + T / 2, z: cz, hw: T / 2, hd: d / 2 },
    { x: cx - gw / 2 - sw / 2, z: cz + d / 2 + T / 2, hw: sw / 2, hd: T / 2 }, { x: cx + gw / 2 + sw / 2, z: cz + d / 2 + T / 2, hw: sw / 2, hd: T / 2 }, { x: cx, z: cz + d / 2 + 0.9, hw: gw / 2, hd: 0.3 });
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.9), new THREE.MeshToonMaterial({ color: 0x8a5a36, gradientMap: GRAD_ENV })); mat.rotation.x = -Math.PI / 2; mat.position.set(cx, 0.015, cz + d / 2 - 0.35); scene.add(mat);
  const sg = signPlane('나가기', 1.3, 0.42, { size: 150, fg: '#3b2a1e', bg: '#ffe9a8' }); sg.position.set(cx, 1.15, cz + d / 2 + 0.3); scene.add(sg);
  TH['exit_' + id] = { id: 'exit_' + id, kind: 'exit', x: cx, z: cz + d / 2 - 0.35, label: '나가기', room: id };
  // 들어온 자리는 출구(상호작용 반경 1.7)보다 멀리: 문 앞에서 Space를 연달아 눌러도 바로 나가지 않게
  return (ROOMS[id] = { id, cx, cz, w, d, entry: { x: cx, z: cz + d / 2 - 2.2 } });
}
function addMarker(id, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0.03, z);
  const basic = (c, o, side) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, toneMapped: false, side: side || THREE.FrontSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 40), basic(0xffd23a, 0.9)); ring.rotation.x = -Math.PI / 2; g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), basic(0xfff3a0, 0.45)); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002; g.add(disc);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 24, 1, true), basic(0xffe27a, 0.18, THREE.DoubleSide)); beam.position.y = 1.1; g.add(beam);
  scene.add(g); markers.push({ id, g, ring, beam });
}
function shelfFrame(x, z, w) {
  const H = 2.2, D = 0.6, m = tm(0xf3ead9), dk = tm(0xc4935f);
  box(w, H, 0.08, x, H / 2, z - D / 2, m, 0.015);
  [-1, 1].forEach((s) => box(0.08, H, D, x + s * w / 2, H / 2, z, dk, 0.015));
  const ys = [0.1, 0.8, 1.5]; ys.concat([2.16]).forEach((y) => box(w, 0.06, D, x, y, z, dk, 0.012));
  colliders.push({ x, z, hw: w / 2 + 0.05, hd: D / 2 + 0.05 });
  return ys.map((y) => y + 0.03);
}
let packMats = null;
function getPackMats() {
  if (packMats) return packMats;
  return (packMats = ['#e8402c', '#f39a1e', '#3c9a4a', '#3b6fc4', '#8e44ad'].map((c) => new THREE.MeshToonMaterial({ gradientMap: GRAD_ENV, map: canvasTex(128, 160, (g, w, h) => {
    g.fillStyle = c; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(64, 96, 38, 0, Math.PI); g.fill();
    g.strokeStyle = '#ffe9a8'; g.lineWidth = 5;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(34, 90 - i * 9); g.bezierCurveTo(50, 80 - i * 9, 78, 100 - i * 9, 94, 88 - i * 9); g.stroke(); }
    g.fillStyle = '#fff'; g.font = '36px "Jua"'; g.textAlign = 'center'; g.fillText('라면', 64, 44);
  }) })));
}

/* ── 꼬꼬네 집(꼬꼬 방): 오프닝 뒤 여기서 시작, 문으로 나가면 마을 ── */
// 살펴보기 단서는 출근 날 아침 이야기용(알람시계·가족사진·옷장 거울)뿐 — 평가 답과 닿는 낱말·장면은 넣지 않는다
function buildHomeRoom() {
  const cx = -40, cz = -80, w = 10, d = 8;
  const R = buildRoom('home', cx, cz, w, d, { floor: texWood([5, 4]), wall: 0xfde3d0, trim: 0x6fae5a });
  R.start = { x: cx - 2.2, z: cz - 0.6 };   // 침대 옆에서 시작
  const bz = cz - d / 2;                     // 뒷벽 안쪽 면
  // 창문(뒷벽): 아침 하늘
  const winTex = canvasTex(192, 128, (g, W, Hh) => {
    const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#ffd7a0'); gr.addColorStop(1, '#bfe6ff'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(140, 46, 18, 0, 7); g.fill();
    g.fillStyle = '#8ccf5a'; g.beginPath(); g.moveTo(0, Hh); g.quadraticCurveTo(60, 80, 120, 100); g.quadraticCurveTo(160, 88, W, 96); g.lineTo(W, Hh); g.fill();
  });
  winTex.wrapS = winTex.wrapT = THREE.ClampToEdgeWrapping;
  const wx = cx - 1.2;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false })); win.position.set(wx, 1.9, bz + 0.02); scene.add(win);
  const fm = tm(0xffffff);
  box(2.0, 0.12, 0.1, wx, 2.56, bz + 0.05, fm, 0.012); box(2.0, 0.12, 0.1, wx, 1.24, bz + 0.05, fm, 0.012);
  [-0.95, 0, 0.95].forEach((dx) => box(0.1, 1.3, 0.1, wx + dx, 1.9, bz + 0.05, fm, 0.012));
  [-1.25, 1.25].forEach((dx) => box(0.35, 1.6, 0.06, wx + dx, 1.85, bz + 0.1, tm(0xffb3a7), 0.012));   // 커튼
  // 침대(왼쪽 뒤 구석): 나무 틀 + 매트리스 + 이불 + 베개
  const bx = cx - 3.9, bzz = bz + 1.25;
  box(1.5, 0.35, 2.4, bx, 0.18, bzz, tm(0xb27a4a));
  box(1.6, 1.0, 0.14, bx, 0.5, bz + 0.07, tm(0x9a6a43));
  box(1.38, 0.2, 2.25, bx, 0.45, bzz + 0.02, tm(0xffffff), 0.012);
  box(1.44, 0.14, 1.45, bx, 0.6, bzz + 0.42, tm(0x6fb3e0), 0.012);
  box(0.9, 0.16, 0.42, bx, 0.64, bz + 0.45, tm(0xfff6d8), 0.012);
  colliders.push({ x: bx, z: bzz, hw: 0.78, hd: 1.2 });
  // 침대 옆 협탁 + 알람시계(단서 1)
  const nx = cx - 2.65, nz = bz + 0.42;
  box(0.7, 0.6, 0.6, nx, 0.3, nz, tm(0xd9a96e));
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 20), toon(0xf05a4a, { env: true })); clock.rotation.x = Math.PI / 2; clock.position.set(nx, 0.8, nz); addOutline(clock, 0.012); scene.add(clock);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (g) => {
    g.fillStyle = '#fffdf2'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#3b2a1e'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 12); g.stroke(); g.beginPath(); g.moveTo(32, 32); g.lineTo(20, 40); g.stroke();
  }), toneMapped: false })); dial.position.set(nx, 0.8, nz + 0.052); scene.add(dial);
  [-0.11, 0.11].forEach((o) => { const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), toon(0xffd23a, { env: true })); bell.position.set(nx + o, 0.97, nz); scene.add(bell); });
  colliders.push({ x: nx, z: nz, hw: 0.35, hd: 0.3 });
  // 책상 + 의자 + 스탠드 + 가족사진(단서 2)
  const dx0 = cx + 2.3, dz0 = bz + 0.42;
  box(1.9, 0.08, 0.75, dx0, 0.76, dz0, tm(0xc98d55));
  [[-0.85, -0.3], [0.85, -0.3], [-0.85, 0.3], [0.85, 0.3]].forEach(([ox, oz]) => box(0.08, 0.72, 0.08, dx0 + ox, 0.36, dz0 + oz, tm(0x9a6a43), 0));
  colliders.push({ x: dx0, z: dz0, hw: 0.95, hd: 0.38 });
  chair(dx0 + 0.45, dz0 + 0.75, Math.PI, true);
  box(0.12, 0.3, 0.12, dx0 + 0.65, 0.95, dz0 - 0.1, tm(0x6fae5a), 0.01);
  box(0.34, 0.16, 0.34, dx0 + 0.65, 1.12, dz0 - 0.1, tm(0xfff3b0), 0.01);
  const photoX = dx0 - 0.35;
  box(0.5, 0.42, 0.05, photoX, 1.0, dz0 - 0.16, tm(0x8a5a36), 0.01);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.32), new THREE.MeshBasicMaterial({ map: canvasTex(100, 80, (g, W, Hh) => {
    g.fillStyle = '#cfeeff'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#9ad66b'; g.fillRect(0, 56, W, 24);
    [[30, 44, 15, '#ffffff', '#e84a3a'], [60, 40, 18, '#ffffff', '#e84a3a'], [82, 54, 9, '#ffdf4a', null]].forEach(([x, y, r, c, comb]) => {
      g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      if (comb) { g.fillStyle = comb; g.beginPath(); g.arc(x, y - r - 2, r * 0.35, 0, 7); g.fill(); }
      g.fillStyle = '#3b2a1e'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.15, 1.8, 0, 7); g.arc(x + r * 0.3, y - r * 0.15, 1.8, 0, 7); g.fill();
    });
  }), toneMapped: false })); photo.position.set(photoX, 1.0, dz0 - 0.13); scene.add(photo);
  // 옷장(오른쪽 벽) + 문에 거울(단서 3)
  const ox = cx + w / 2 - 0.4, oz = cz - 0.2;
  box(0.8, 2.3, 1.7, ox, 1.15, oz, tm(0xe0b483));
  box(0.04, 2.1, 0.04, ox - 0.42, 1.15, oz, tm(0x9a6a43), 0);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.2), new THREE.MeshBasicMaterial({ map: canvasTex(64, 128, (g, W, Hh) => {
    const gr = g.createLinearGradient(0, 0, W, Hh); gr.addColorStop(0, '#e9f6ff'); gr.addColorStop(0.5, '#bcdcf0'); gr.addColorStop(1, '#e9f6ff'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#5fae4a'; g.beginPath(); g.arc(32, 74, 20, Math.PI, 0); g.fill(); g.fillRect(8, 72, 48, 6);   // 거울에 비친 초록 작업모
    g.fillStyle = '#ffd23a'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 3 : 7; g.lineTo(32 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } g.fill();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 6; g.beginPath(); g.moveTo(12, 40); g.lineTo(40, 12); g.stroke();
  }), toneMapped: false })); mirror.rotation.y = -Math.PI / 2; mirror.position.set(ox - 0.415, 1.35, oz + 0.4); scene.add(mirror);
  colliders.push({ x: ox, z: oz, hw: 0.42, hd: 0.86 });
  // 러그 + 화분 + 작은 책장(왼쪽 벽)
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40), new THREE.MeshToonMaterial({ color: 0xf6c35a, gradientMap: GRAD_ENV })); rug.rotation.x = -Math.PI / 2; rug.position.set(cx + 0.2, 0.014, cz + 0.6); rug.scale.set(1.3, 1, 1); scene.add(rug);
  const rug2 = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.15, 40), new THREE.MeshBasicMaterial({ color: 0xe8843a })); rug2.rotation.x = -Math.PI / 2; rug2.position.set(cx + 0.2, 0.016, cz + 0.6); rug2.scale.set(1.3, 1, 1); scene.add(rug2);
  const px = cx + w / 2 - 0.4, pz = cz + 1.6;
  box(0.45, 0.45, 0.45, px, 0.23, pz, tm(0xd9663a)); colliders.push({ x: px, z: pz, hw: 0.25, hd: 0.25 });
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), tm(0x58a14a)); leaf.position.set(px, 0.8, pz); leaf.scale.set(1, 1.2, 1); addOutline(leaf, 0.015); scene.add(leaf);
  const shx = cx - w / 2 + 0.3, shz = cz + 1.2;
  const shm = tm(0xc98d55);
  box(0.08, 1.3, 1.4, shx - 0.21, 0.65, shz, shm, 0.012);                                       // 뒤판(벽 쪽)
  [-0.7, 0.7].forEach((o) => box(0.5, 1.3, 0.06, shx, 0.65, shz + o, shm, 0.012));             // 옆판
  [0.04, 0.62, 1.27].forEach((y) => box(0.5, 0.06, 1.4, shx, y, shz, shm, 0.012));              // 선반
  const bookCols = [0xe8402c, 0x3b6fc4, 0xffc93a, 0x3c9a4a, 0x8e44ad];
  [0.07, 0.65].forEach((y, r) => { for (let i = 0; i < 5; i++) { const hh = 0.36 + ((i + r) % 3) * 0.06; box(0.3, hh, 0.16, shx, y + hh / 2, shz - 0.48 + i * 0.24, tm(bookCols[(i + r * 2) % 5]), 0); } });
  colliders.push({ x: shx, z: shz, hw: 0.28, hd: 0.72 });
  // 살펴보기 단서: 퀘스트와 무관(안 봐도 나갈 수 있고, 아무 순서로 몇 번이든)
  // stand: 살펴볼 때 꼬꼬가 비켜 서는 자리(물건을 가리지 않게), obj: 바라볼 물건, cam: CAMS 자리
  TH.clock = { id: 'clock', kind: 'look', x: nx, z: nz + 0.5, label: '알람시계', room: 'home', dlg: 'lookClock', labelY: 1.6, stand: { x: nx + 0.95, z: nz + 0.75 }, obj: { x: nx, z: nz }, cam: 'homeClock' };
  TH.photo = { id: 'photo', kind: 'look', x: photoX, z: dz0 + 0.45, label: '가족사진', room: 'home', dlg: 'lookPhoto', labelY: 1.8, stand: { x: photoX - 1.3, z: dz0 + 0.9 }, obj: { x: photoX, z: dz0 }, cam: 'homePhoto' };
  TH.mirror = { id: 'mirror', kind: 'look', x: ox - 0.75, z: oz + 0.4, label: '옷장 거울', room: 'home', dlg: 'lookMirror', labelY: 2.2, stand: { x: ox - 1.4, z: oz - 0.5 }, obj: { x: ox, z: oz + 0.4 }, cam: 'homeMirror' };
}

/* ── 마트 안 ── */
function buildMart() {
  buildRoom('mart', 0, -80, 14, 10, { floor: texTiles([7, 5], '#f6f1e6', '#e1e9ef'), wall: 0xfbe7c6, trim: 0xd9663a });
  const bz = -85 + 0.35;
  // 라면 칸: 라면 봉지 + 가격표(숫자만)
  const rx = -3.6, ys = shelfFrame(rx, bz, 3.0), geo = new THREE.BoxGeometry(0.4, 0.5, 0.12), pm = getPackMats();
  const prices = ['900원', '1,000원', '1,100원'];
  ys.forEach((y, r) => {
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(geo, pm[(i + r * 2) % pm.length]); p.position.set(rx - 1.25 + i * 0.5, y + 0.25, bz + 0.05 + (i % 2) * 0.04); p.rotation.y = (i % 3 - 1) * 0.06; p.castShadow = true; scene.add(p); }
    const tag = signPlane(prices[r], 0.66, 0.22, { size: 150, fg: '#c0392b', bg: '#ffffff', border: '#e0a800' }); tag.position.set(rx, y - 0.07, bz + 0.31); scene.add(tag);
  });
  const sg = signPlane('라면', 1.4, 0.55, { size: 150, fg: '#ffffff', bg: '#e8402c' }); sg.position.set(rx, 2.62, bz - 0.2); scene.add(sg);
  // 다른 진열대(과자·음료)
  [[0.9, 1], [4.6, 2]].forEach(([x, seed]) => {
    const ys2 = shelfFrame(x, bz, 2.8), r = rnd(seed * 31 + 7), cols = [0xffc93a, 0x6fc3ff, 0xff8fa3, 0x9ad66b, 0xffffff, 0xf28c28];
    ys2.forEach((y) => { for (let px = x - 1.1; px < x + 1.2; px += 0.36) {
      const tall = 0.25 + r() * 0.3, m = tm(cols[Math.floor(r() * cols.length)]);
      const it = seed === 2 ? new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, tall + 0.1, 12), m) : new THREE.Mesh(new THREE.BoxGeometry(0.28, tall, 0.22), m);
      it.position.set(px, y + (tall + (seed === 2 ? 0.1 : 0)) / 2, bz); it.castShadow = true; scene.add(it);
    } });
  });
  // 과일·채소 코너
  box(3.0, 0.7, 1.3, -4.6, 0.35, -78.4, tm(0xc98d55)); colliders.push({ x: -4.6, z: -78.4, hw: 1.5, hd: 0.65 });
  [['crate_carrots', -5.6], ['crate_tomatoes', -4.6], ['crate_lettuce', -3.6]].forEach(([n, x]) => { const c = place(n, x, -78.4, { h: 0.55, solid: false, occl: false }); if (c) c.g.position.y = 0.7; });
  const fs = signPlane('과일 · 채소', 1.8, 0.5, { size: 110, fg: '#2f7d32' }); fs.position.set(-4.6, 1.75, -79.1); scene.add(fs);
  // 계산대·점원
  box(2.6, 1.0, 0.9, 4.6, 0.5, -77.6, tm(0xe25a3a)); box(2.7, 0.08, 1.0, 4.6, 1.04, -77.6, tm(0xfff3e0), 0.015);
  box(0.55, 0.4, 0.45, 5.3, 1.28, -77.7, tm(0x4b5563), 0.015);
  colliders.push({ x: 4.6, z: -77.6, hw: 1.3, hd: 0.45 });
  const clerk = addNPC('clerk', buildCritter('bunny', { outfit: 'shop', fur: 0xf2d0a4 }), 4.6, -78.7, 0, 1, 'mart');
  Object.assign(clerk, { dlg: 'clerk', labelY: 2.4 });
  // 엄마 닭·아기 병아리(같이 들어옴)
  const mom2 = addNPC('mom2', buildChicken(MOM_OPTS), -1.5, -83.2, -0.5, 1.15, 'mart', 'mom');
  const baby2 = addNPC('baby2', buildChicken(BABY_OPTS), -0.8, -82.5, -0.3, 0.7, 'mart', 'baby');
  Object.assign(mom2, { dlg: 'mom2', labelY: 2.15 }); Object.assign(baby2, { dlg: 'baby2', labelY: 1.3 });
  TH.ramen = { id: 'ramen', kind: 'scene', x: rx, z: -83.5, label: '라면 칸', room: 'mart', chapter: 0, labelY: 2.0 };
  addMarker('ramen', rx, -83.5);
}

/* ── 공장 안 ── */
let beltTex = null; const beltPacks = [], lamps = [];
function buildFactoryRoom() {
  buildRoom('factory', 40, -80, 18, 12, { floor: texConcrete([9, 6]), wall: 0xe9edf0, trim: 0xf28c28 });
  const bz = -84.3;
  beltTex = canvasTex(128, 32, (g, w, h) => { g.fillStyle = '#3d4046'; g.fillRect(0, 0, w, h); g.fillStyle = '#5b6067'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 6, h); }, [12, 1]);
  box(13, 0.7, 1.2, 40, 0.35, bz, tm(0x9aa3ad));
  const top = new THREE.Mesh(new THREE.PlaneGeometry(13, 1.0), new THREE.MeshToonMaterial({ map: beltTex, gradientMap: GRAD_ENV })); top.rotation.x = -Math.PI / 2; top.position.set(40, 0.705, bz); scene.add(top);
  colliders.push({ x: 40, z: bz, hw: 6.5, hd: 0.6 });
  const pm = getPackMats();
  for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.5), pm[i % pm.length]); p.position.set(33.6 + i * 1.65, 0.78, bz); p.castShadow = true; scene.add(p); beltPacks.push(p); }
  [31.6, 48.4].forEach((mx) => {
    box(2.2, 2.2, 1.9, mx, 1.1, bz, tm(0x4f8fc0));
    box(1.0, 0.5, 0.06, mx, 1.6, bz + 0.97, toon(0x1d2a33, { env: true, emissive: 0x2a8f4a, emissiveIntensity: 0.7 }), 0.01);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), toon(0xff4a3a, { emissive: 0xff3020, emissiveIntensity: 1.2 })); lamp.position.set(mx + 0.7, 2.35, bz); scene.add(lamp); lamps.push(lamp);
    box(0.35, 1.4, 0.35, mx - 0.6, 2.9, bz - 0.4, tm(0xc9c4ba));
    colliders.push({ x: mx, z: bz, hw: 1.1, hd: 0.95 });
  });
  [['crate_A_big', 32, -76.4, 1.1], ['box', 33.4, -76.1, 0.8], ['crate_A_big', 48, -76.4, 1.1], ['barrel', 46.7, -76.1, 0.9], ['box', 31.8, -78.2, 0.8]].forEach(([n, x, z, h]) => place(n, x, z, { h, occl: false, top: true }));
  const line = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.12), new THREE.MeshBasicMaterial({ color: 0xffc93a })); line.rotation.x = -Math.PI / 2; line.position.set(40, 0.012, -78.4); scene.add(line);
  // 줄 선 동료 + 빈자리, 옆에 공장장
  const bear = addNPC('bear', buildCritter('bear', { outfit: 'cap' }), 38.2, -79, Math.PI, 1, 'factory');
  const bunny = addNPC('bunny', buildCritter('bunny', { outfit: 'cap' }), 41.8, -79, Math.PI, 1, 'factory');
  Object.assign(bear, { dlg: 'bear', labelY: 2.0 }); Object.assign(bunny, { dlg: 'bunny', labelY: 2.4 });
  const boss = addNPC('boss', buildCritter('raccoon', { outfit: 'boss', size: 1.12 }), 43.8, -81.6, -Math.PI / 2, 1.1, 'factory');
  Object.assign(boss, { dlg: 'bossIdle', labelY: 2.3, front: { x: 40, z: -82.2 } });
  TH.rollcall = { id: 'rollcall', kind: 'scene', x: 40, z: -79, label: '빈자리', room: 'factory', chapter: 1, auto: true, labelY: 1.6 };
  addMarker('rollcall', 40, -79);
}

/* ── 회의실 안 ── */
function chair(x, z, ry, solid) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const m = tm(0x2c3e7a), lg = tm(0x5b5f66);
  box(0.62, 0.1, 0.6, 0, 0.45, 0, m, 0.015, g); box(0.62, 0.7, 0.1, 0, 0.82, -0.27, m, 0.015, g);
  [[-0.25, -0.24], [0.25, -0.24], [-0.25, 0.24], [0.25, 0.24]].forEach(([dx, dz]) => box(0.06, 0.42, 0.06, dx, 0.21, dz, lg, 0, g));
  if (solid) colliders.push({ x, z, hw: 0.3, hd: 0.3 });
}
function buildMeetRoom() {
  buildRoom('meet', 80, -80, 13, 10, { floor: texWood([6, 5]), wall: 0xf6efe2, trim: 0x2c3e7a });
  // 뒷벽 창문(바깥 하늘·언덕)
  const winTex = canvasTex(256, 96, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7fc8ff'); gr.addColorStop(1, '#d9f0ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; [[50, 26], [170, 18]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 26, 9, 0, 0, 7); g.fill(); });
    g.fillStyle = '#8ccf5a'; g.beginPath(); g.moveTo(0, h); g.quadraticCurveTo(70, 50, 140, 74); g.quadraticCurveTo(200, 56, w, 70); g.lineTo(w, h); g.fill();
  });
  winTex.wrapS = winTex.wrapT = THREE.ClampToEdgeWrapping;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.7), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false })); win.position.set(80, 1.95, -84.83); scene.add(win);
  const fm = tm(0xffffff);
  box(5.3, 0.14, 0.12, 80, 2.85, -84.8, fm, 0.012); box(5.3, 0.14, 0.12, 80, 1.05, -84.8, fm, 0.012);
  [-2.6, 0, 2.6].forEach((dx) => box(0.14, 1.8, 0.12, 80 + dx, 1.95, -84.8, fm, 0.012));
  // 긴 탁자 + 의자
  const wood = tm(0x9a6a43);
  box(2.2, 0.1, 4.4, 80, 0.8, -81.3, wood);
  [[-0.95, -2], [0.95, -2], [-0.95, 2], [0.95, 2]].forEach(([dx, dz]) => box(0.1, 0.78, 0.1, 80 + dx, 0.39, -81.3 + dz, wood, 0.012));
  colliders.push({ x: 80, z: -81.3, hw: 1.1, hd: 2.2 });
  [[78.4, -82.6, Math.PI / 2], [78.4, -81, Math.PI / 2], [78.4, -79.6, Math.PI / 2], [81.6, -82.6, -Math.PI / 2], [81.6, -81, -Math.PI / 2], [81.6, -79.6, -Math.PI / 2]]
    .forEach(([x, z, ry]) => chair(x, z, ry, true));
  chair(80, -78.4, Math.PI, false);   // 빈 의자(꼬꼬 자리)
  const s1 = addNPC('staff1', buildCritter('bunny', { outfit: 'office', fur: 0xe9b7c8 }), 78.4, -82.6, Math.PI / 2, 0.9, 'meet');
  const s2 = addNPC('staff2', buildCritter('bear', { outfit: 'office', fur: 0x9a9fab }), 81.6, -81, -Math.PI / 2, 0.9, 'meet');
  [s1, s2].forEach((s) => { s.actor.root.position.y = 0.3; s.labelY = 2.5; s.dlg = s.id; });
  const fox = addNPC('fox', buildCritter('fox', { outfit: 'office' }), 80, -84.0, 0, 1, 'meet');
  Object.assign(fox, { dlg: 'foxIdle', labelY: 2.2 });
  place('bush', 74.3, -84.2, { h: 1.1, occl: false }); place('bush', 85.7, -84.2, { h: 1.1, occl: false });
  TH.seat = { id: 'seat', kind: 'scene', x: 80, z: -78.3, label: '빈 의자', room: 'meet', chapter: 2, spot: 'meeting', auto: true, labelY: 1.6, face: Math.PI };
  addMarker('seat', 80, -78.3);
}

function flowers(x0, x1, seed) {
  const r = rnd(23 + seed), petal = new THREE.SphereGeometry(0.07, 8, 6);
  [0xff7aa8, 0xffd23a, 0xffffff, 0xb08cff, 0xff8a4a].forEach((c) => {
    const n = 60, im = new THREE.InstancedMesh(petal, toon(c, { env: true }), n), m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      let x, z;
      do { x = x0 + r() * (x1 - x0); z = (r() - 0.5) * 20; } while (Math.abs(z - 2.2) < 2.4 || (Math.abs(x + 1.5) < 3.2 && Math.abs(z - 6.6) < 2.4));
      m.makeTranslation(x, 0.07, z); im.setMatrixAt(i, m);
    }
    scene.add(im);
  });
}
// 현대식 라면 공장: 톱니 지붕 공장동 + 사무동 + 굴뚝(연기) + 셔터문 + 간판
const smokes = [];
function buildFactory(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const wall = toon(0xf2efe8, { env: true }), wallD = toon(0xd8d2c6, { env: true }), roofM = toon(0xd9473a, { env: true }), glass = toon(0x8fc9e8, { env: true, emissive: 0x6fb5e0, emissiveIntensity: 0.25 });
  const add = (geo, mat, px, py, pz, ol = 0.03) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; addOutline(m, ol); g.add(m); return m; };
  const HW = 14, HD = 7, HH = 4.6;
  add(new THREE.BoxGeometry(HW, HH, HD), wall, 0, HH / 2, 0);
  add(new THREE.BoxGeometry(HW + 0.2, 0.5, HD + 0.2), wallD, 0, 0.25, 0, 0.02);
  // 톱니 지붕
  for (let i = 0; i < 4; i++) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(3.5, 0); sh.lineTo(3.5, 1.7); sh.lineTo(0, 0);
    const prism = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: HD, bevelEnabled: false }), roofM);
    prism.position.set(-HW / 2 + i * 3.5, HH, -HD / 2); prism.castShadow = true; addOutline(prism, 0.03); g.add(prism);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(HD - 0.6, 1.4), glass); win.rotation.y = -Math.PI / 2; win.position.set(-HW / 2 + i * 3.5 + 3.49, HH + 0.85, 0); g.add(win);
  }
  // 정면 창 띠
  for (let i = 0; i < 6; i++) { if (i === 2 || i === 3) continue; add(new THREE.BoxGeometry(1.5, 1.1, 0.08), glass, -5.6 + i * 2.25, 3.2, HD / 2 + 0.03, 0.015); }
  // 셔터문
  const shutter = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#9aa3ad'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 10) { c.fillStyle = '#7f8892'; c.fillRect(0, y, w, 3); } });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.9), new THREE.MeshToonMaterial({ map: shutter, gradientMap: GRAD_ENV })); door.position.set(0, 1.45, HD / 2 + 0.04); g.add(door);
  add(new THREE.BoxGeometry(3.9, 0.25, 0.3), toon(0xf28c28, { env: true }), 0, 3.0, HD / 2 + 0.1, 0.02);
  // 사무동(유리)
  add(new THREE.BoxGeometry(4.2, 6.8, 4.6), toon(0x5c7d99, { env: true }), HW / 2 + 2.3, 3.4, 1.0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) add(new THREE.BoxGeometry(1.4, 1.0, 0.06), glass, HW / 2 + 1.5 + c * 1.6, 1.6 + r * 1.4, 3.32, 0.01);
  // 굴뚝 2개
  [[-4.6, -1.6], [-2.4, -2.2]].forEach(([cx, cz]) => {
    add(new THREE.CylinderGeometry(0.45, 0.55, 4.2, 16), toon(0xc9c4ba, { env: true }), cx, HH + 2.1, cz);
    add(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16), roofM, cx, HH + 3.6, cz, 0.02);
    smokes.push({ x: x + cx, y: HH + 4.3, z: z + cz, t: Math.random() });
  });
  // 간판
  const sign = signPlane('불꽃식품', 7.2, 1.7, { logo: true, size: 96 });
  sign.position.set(0, HH - 0.55, HD / 2 + 0.12); g.add(sign);   // 창 띠(앞면 HD/2+0.07)보다 앞에: 겹친 자리 깜빡임 방지
  colliders.push({ x, z, hw: HW / 2 + 0.2, hd: HD / 2 + 0.2 }, { x: x + HW / 2 + 2.3, z: z + 1.0, hw: 2.2, hd: 2.4 });
  const mats = []; const outs = [];
  g.traverse((o) => { if (o.isMesh) { if (o.userData.isOutline) outs.push(o); else if (o.material.isMeshToonMaterial) { o.material = o.material.clone(); mats.push(o.material); } } });
  occluders.push({ x, z, r: HW / 2, mats, outs, a: 1 });
  return { g, x, z, w: HW, d: HD, h: HH };
}
const smokeMap = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30); gr.addColorStop(0, 'rgba(250,250,250,.95)'); gr.addColorStop(1, 'rgba(250,250,250,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const puffs = [];
function updateSmoke(dt) {
  for (const sm of smokes) {
    sm.t += dt; if (sm.t > 0.35 && Math.abs(sm.x - S.x) < 40) {
      sm.t = 0; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, transparent: true, depthWrite: false, opacity: 0.8 }));
      sp.position.set(sm.x, sm.y, sm.z); sp.scale.setScalar(0.8); sp.userData.life = 3.2; scene.add(sp); puffs.push(sp);
    }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const sp = puffs[i]; sp.userData.life -= dt; sp.position.y += dt * 0.9; sp.position.x += dt * 0.35;
    const k = 1 - sp.userData.life / 3.2; sp.scale.setScalar(0.8 + k * 2.4); sp.material.opacity = 0.75 * (1 - k);
    if (sp.userData.life <= 0) { scene.remove(sp); sp.material.dispose(); puffs.splice(i, 1); }
  }
}

// 울타리 문(구역 사이). 열리면 문짝이 옆으로 밀린다.
function addGate(x, need, lockedDlg) {
  const g = new THREE.Group(); g.position.set(x, 0, 2.2);
  const postM = toon(0x8a5a36, { env: true }), barM = toon(0xd9a066, { env: true });
  [-2.1, 2.1].forEach((o) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.9, 0.35), postM); p.position.set(0, 0.95, o); p.castShadow = true; addOutline(p, 0.02); g.add(p); });
  const door = new THREE.Group();
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.62), barM); b.position.set(0, 0.75, -1.6 + i * 0.8); b.castShadow = true; addOutline(b, 0.018); door.add(b); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.9), barM); rail.position.set(0, 1.1, 0); addOutline(rail, 0.018); door.add(rail);
  const lock = signPlane('🔒', 0.6, 0.6, { bg: '#ffe9a8', size: 300, border: '#3b2a1e' }); lock.position.set(0.12, 1.5, 0); lock.rotation.y = Math.PI / 2; door.add(lock);
  g.add(door); scene.add(g);
  // 문 양옆 울타리(길 밖으로 못 나가게)
  // 뒤쪽은 울타리, 앞쪽(카메라 쪽)은 낮은 덤불로 막는다(화면을 가리지 않게)
  for (let z = -12.6; z <= -0.4; z += 2.2) place('fence_wood_straight', x, z, { h: 1.1, ry: Math.PI / 2, shrink: 1, occl: false });
  for (let z = 4.8; z <= 12.6; z += 1.6) place('bush', x, z, { h: 0.8, solid: false, occl: false });
  colliders.push({ x, z: -6.6, hw: 0.4, hd: 6.4 }, { x, z: 8.8, hw: 0.4, hd: 4.4 });
  const col = { x, z: 2.2, hw: 0.4, hd: 2.3 }; colliders.push(col);
  gates.push({ x, need, col, door, lock, lockedDlg, open: false, t: 0 });
}

/* ── 충돌 ──────────────────────────────────── */
const HR = 0.36, STEP_EPS = 0.05;
// feet: 꼬꼬 발 높이. 올라설 수 있는 소품(top)은 발이 그 위에 있으면 막지 않는다. top이 없는 것은 높이와 상관없이 막는다.
function hitsBox(x, z, c) {
  const dx = Math.max(Math.abs(x - c.x) - c.hw, 0), dz = Math.max(Math.abs(z - c.z) - c.hd, 0);
  return dx * dx + dz * dz < HR * HR;
}
function blocked(x, z, feet = 0) {
  for (const c of colliders) {
    if (c.off) continue;
    if (c.top !== undefined && feet >= c.top - STEP_EPS) continue;
    if (c.canopy && (!S.roam || feet >= c.y1 || feet + 1.0 <= c.y0 || hitsBox(S.x, S.z, c))) continue;   // 이미 잎 속이면 빠져나가게 둔다
    if (hitsBox(x, z, c)) return c;
  }
  return null;
}
// 발밑 높이: 발(feet)보다 낮거나 같은 소품 윗면 가운데 가장 높은 것(막는 판정과 같은 반지름으로 겹침을 본다)
function groundAt(x, z, feet) {
  let g = 0;
  for (const c of colliders) {
    if (c.off || c.top === undefined || c.top > feet + STEP_EPS || c.top <= g) continue;
    const dx = Math.max(Math.abs(x - c.x) - c.hw, 0), dz = Math.max(Math.abs(z - c.z) - c.hd, 0);
    if (dx * dx + dz * dz < HR * HR) g = c.top;
  }
  return g;
}

/* ── 상태·퀘스트 (2D 판 규칙 그대로) ───────── */
const S = { x: -12, z: 2.4, face: 0, mode: 'loading', flags: {}, progress: 0, room: null, cam: null, sit: false, shake: 0, roam: false, placed: false };
// roam: 제출 뒤 자유롭게 돌아다니기(문 모두 열림, 퀘스트 안내 숨김, 평가 장면·패널 안 열림)
const QUEST = ['homeDoor', 'mom', 'martDoor', 'ramen', 'gate1', 'factoryDoor', 'rollcall', 'ch3', 'notebook'];
// 3장 세 곳: 조사 자리 id(TH) → 대사 묶음 이름(TH[id].spot = story.js SPOTS3). 순서는 자유, 세 곳을 다 보면 3장 패널
const SPOT_IDS = ['seat', 'adboard', 'riverside'];
const spotSeen = (id) => !!S.flags['seen_' + TH[id].spot];
const spotsLeft = () => SPOT_IDS.filter((id) => !spotSeen(id));
function stepDone(id) {
  const f = S.flags, p = S.progress, r = S.room;
  switch (id) {
    case 'homeDoor': return !!f.leftHome || !!f.talkedMom || p > 0;   // 한 번 나서면 끝(다시 들어가도 그대로)
    case 'mom': return !!f.talkedMom || p > 0;
    case 'martDoor': return r === 'mart' || p > 0;
    case 'ramen': return p > 0;
    case 'gate1': return (!r && S.x > GATE_X) || r === 'factory' || r === 'meet' || p > 1;
    case 'factoryDoor': return r === 'factory' || p > 1;
    case 'rollcall': return p > 1;
    case 'ch3': return p > 2;
    default: return false;
  }
}
function questCur() { if (S.roam) return null; for (const id of QUEST) if (!stepDone(id)) return id; return null; }
const sameRoom = (t) => (t.room || null) === (S.room || null);
const roomDoor = (room) => Object.values(TH).find((d) => d.toRoom === room);
// 3장: 아직 안 본 곳 가운데 가장 가까운 곳(실내 자리는 그 건물 문·나가기 문까지 거리로 잰다)
function nearestSpot() {
  let best = null, bd = 1e9;
  for (const id of spotsLeft()) {
    const t = TH[id], p = sameRoom(t) ? t : S.room ? TH['exit_' + S.room] : roomDoor(t.room);
    const d = Math.hypot(p.x - S.x, p.z - S.z) + (sameRoom(t) ? 0 : 3);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
function questTarget(id) {
  if (!id || id === 'notebook') return null;
  let t = id === 'gate1' ? { x: GATE_X + 1.4, z: 2.2, label: '회사 가는 길', labelY: 2.4 } : id === 'ch3' ? nearestSpot() : TH[id];
  if (!t) return null;
  if (S.room && !sameRoom(t)) { const ex = TH['exit_' + S.room]; return { x: ex.x, z: ex.z, label: '나가기', y: 1.6, exit: true }; }
  if (!S.room && t.room) t = roomDoor(t.room);   // 실내 자리는 먼저 그 건물 문으로
  return { x: t.x, z: t.z, label: t.label || WHO[t.who || t.id]?.name, y: t.labelY || 2.6, npc: t.kind === 'npc' };
}
function doorOpen(t) { return S.roam || S.progress >= (t.needProg || 0) && (S.progress > 0 || (t.needFlags || []).every((f) => S.flags[f])); }
let enteredAt = 0;
function nearestThing() {
  let best = null, bd = 1.7;
  const justIn = performance.now() - enteredAt < 600;
  for (const k in TH) { const t = TH[k]; if (!sameRoom(t) || (justIn && t.kind === 'exit') || (t.spot && S.progress < 2) || (S.roam && t.kind === 'scene') || (t.fut && !FUT.open)) continue; const d = Math.hypot(t.x - S.x, t.z - S.z); if (d < bd) { bd = d; best = t; } }
  return best;
}
function interact(t) {
  const cur = questCur();
  if (QUEST.includes(t.id) && cur && cur !== t.id && !stepDone(t.id) && t.kind !== 'door') {
    const ct = TH[cur] || {};
    talk([{ who: 'note', text: ct.kind === 'npc' ? '먼저 ' + WHO[ct.who || ct.id].name + '에게 말을 걸어 봐요.' : '먼저 ' + (ct.label || '앞의 일') + '부터 살펴봐요.' }]); return;
  }
  if (t.kind === 'door') {
    if (!doorOpen(t)) { sfx.nope(); talk(DIALOGUE[t.lockedDlg]); return; }
    sfx.door(); enterRoom(t.toRoom); return;
  }
  if (t.kind === 'exit') { sfx.door(); exitRoom(); return; }
  if (t.kind === 'scene') { if (!S.roam) runScene(t); return; }   // 제출 뒤에는 평가 장면·패널을 다시 열지 않는다
  if (t.kind === 'look') { lookAt(t); return; }
  if (t.kind === 'fut') { futAct(t); return; }
  // 제출 뒤 돌아다닐 때는 인물마다 '제출 뒤 대사'(story.js의 이름+Roam)를 쓴다 — 옛 퀘스트 대사가 상황과 안 맞아서
  const dlg = S.roam && DIALOGUE[t.dlg + 'Roam'] ? t.dlg + 'Roam' : t.dlg;
  talk(DIALOGUE[dlg], () => {
    if (S.roam) return;
    if (t.setFlag && !S.flags[t.setFlag]) { S.flags[t.setFlag] = true; EXAM.saveLocal(S); sfx.open(); }
  }, t);
}
// 실내에서는 방 전체가 화면 가운데 오게: 꼬꼬보다 안쪽(-z)을 보고, 조금 가까이
const ROOM_CAM = { look: 2.4, close: 1.1, up: 1.25 };
// 바깥에서는 꼬꼬를 화면 아래 1/3쯤에 두고 조금 멀리서 본다(앞쪽 건물·간판이 위 HUD에 안 가리게).
// 대화 중(close < 1)에는 앞보기를 줄여 꼬꼬·상대가 대사창 위에 오게 한다
const OUT_CAM = { far: 1.35, look: 3.0, lookTalk: 1.2 };
function camTarget(x, z, close = 1) {
  if (S.room) {
    const k = close * ROOM_CAM.close, lz = z - ROOM_CAM.look;
    tl.set(x, 0.7, lz); tv.set(x + CAM_OFF.x, CAM_OFF.y * k * ROOM_CAM.up, lz + CAM_OFF.z * k); return;
  }
  const k = close * OUT_CAM.far, lz = z - (close < 1 ? OUT_CAM.lookTalk : OUT_CAM.look);
  tl.set(x, 0.7, lz); tv.set(x + CAM_OFF.x, CAM_OFF.y * k, lz + CAM_OFF.z * k);
}
function landNow() { Object.assign(J, { on: false, pre: 0, z: 0, vz: 0, dbl: false, spin: 0, base: 0, fly: 0, flapT: 0 }); camGy = 0; camFly = 0; }
function teleport(x, z, face) {
  S.x = x; S.z = z; S.face = face; hero.root.rotation.y = face; landNow();
  camTarget(x, z); camPos.copy(tv); camLook.copy(tl);
}
function enterRoom(id) {
  S.mode = 'fade'; for (const k in keys) keys[k] = false;
  fadeOut(() => { const R = ROOMS[id]; S.room = id; teleport(R.entry.x, R.entry.z, Math.PI); setTimeout(() => { fadeIn(); S.mode = 'walk'; enteredAt = performance.now(); }, 150); });
}
function exitRoom() {
  const id = S.room, door = Object.values(TH).find((t) => t.toRoom === id);
  S.mode = 'fade'; for (const k in keys) keys[k] = false;
  if (id === 'home' && !S.flags.leftHome) { S.flags.leftHome = true; EXAM.saveLocal(S); }
  fadeOut(() => { S.room = null; teleport(door.x, door.z + (id === 'home' ? 1.9 : 1.2), 0); /* 집 앞은 말풍선(1.7) 밖에 내려 줌 */ setTimeout(() => { fadeIn(); S.mode = 'walk'; }, 150); });
}
// 실내 장면: 라면 칸 살펴보기 / 점호 / 회의
function runScene(t) {
  if (S.roam) return;
  if (S.progress > t.chapter) { openChapter(t.chapter); return; }    // 이미 본 장면: 바로 평가 패널(답 고치기)
  S.mode = 'scene'; for (const k in keys) keys[k] = false; landNow();
  if (t.id === 'ramen') { S.face = Math.PI; talk(DIALOGUE.ramen, () => openChapter(0), null, true); }
  else if (t.id === 'rollcall') {
    S.x = t.x; S.z = t.z; S.face = Math.PI; setCam('rollWide');
    const b = TH.boss; walkNPC(b, b.front.x, b.front.z, 0, () => talk(DIALOGUE.rollcall, () => openChapter(1), null, true));
  } else if (t.spot) {   // 3장 세 곳은 똑같은 방식: 자리에 서기 → 원문 한 줄 → 세 곳을 다 봤으면 3장 패널
    if (t.id === 'seat') { S.x = 80; S.z = -78.45; S.sit = true; } else { S.x = t.x; S.z = t.z; }
    S.face = t.face;
    playVerb(t, () => talk(DIALOGUE[t.spot], () => {
      if (!S.flags['seen_' + t.spot]) { S.flags['seen_' + t.spot] = true; EXAM.saveLocal(S); }
      if (!spotsLeft().length) { openChapter(2); return; }
      if (S.sit) { S.sit = false; S.z = -77.4; S.face = 0; }
    }));
  }
}
/* ── 3장 세 곳 조사 동작(동사) ──────────────────
   자리에 서면 키 한 번(또는 저절로) → 짧은 행동 → 원문 한 줄. 미니게임 아님, 결과는 늘 같다.
   세 곳은 길이·효과음(blip 한 번)·카메라 다가가기가 모두 같아야 한다 — 한 곳만 길거나 세면 답이 될 줄을 골라 주는 셈.
   그래서 시간·소리·카메라는 playVerb 하나가 맡고, 곳마다 다른 것은 VERBS의 자세(pose)·소품(prop)뿐이다. */
const VERB_MS = 1500;          // 동작 길이(세 곳 같음)
const VERB_TIDY_MS = 380;      // 동작이 끝나고 원문 줄의 검은 전환(fade)이 화면을 덮은 뒤에 소품·자세를 되돌린다
const VERB_CAM = { side: 3.4, ahead: 1.4, up: 2.4, look: 0.45, lookUp: 0.9 };   // 꼬꼬 옆 앞쪽에서 꼬꼬와 소품을 함께
const VP = {};                 // 동작 소품: paper(회의실 탁자 서류), ramen(라면 그릇)
let VERB = null;               // 지금 하는 동작 { v, t0, done, ended }
const verbLog = [];
const ease01 = (k) => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const span = (k, a, b) => ease01((k - a) / (b - a));
function buildVerbProps() {
  // 회의실 탁자 위 서류: 글자 없는 얇은 판(평소에도 탁자 위에 놓여 있다)
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.012, 0.52), tm(0xfbf6ea));
  paper.castShadow = true; addOutline(paper, 0.008);
  const home = { p: new THREE.Vector3(80, 0.862, -79.42), r: new THREE.Euler(0, 0.12, 0) };
  paper.position.copy(home.p); paper.rotation.copy(home.r); scene.add(paper);
  VP.paper = { m: paper, home };
  // 라면 그릇: 면만 가득, 채소는 작은 초록 조각 둘(원문: 광고엔 채소 가득, 실제로는 거의 없음). 평소엔 숨김
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const bw = 0.5;
  const pb = protos.bowl, bowlH = pb && !pb.fallback ? pb.size.y * bw / pb.size.x : 0.2;
  if (pb && !pb.fallback) { const b = pb.holder.clone(true); const sc = bw / pb.size.x; toonify(b, { outline: 0.015 / sc }); b.scale.setScalar(sc); g.add(b); }
  else { const b = new THREE.Mesh(new THREE.CylinderGeometry(bw / 2, bw * 0.32, bowlH, 24, 1, true), toon(0xf4efe6, { env: true })); b.material.side = THREE.DoubleSide; b.position.y = bowlH / 2; addOutline(b, 0.012); g.add(b); }
  const top = bowlH * 0.82, R = bw * 0.4;
  const soup = new THREE.Mesh(new THREE.CircleGeometry(R, 24), toon(0xd8642e)); soup.rotation.x = -Math.PI / 2; soup.position.y = top; g.add(soup);
  const noodleM = toon(0xf3d58a), rr = rnd(31);
  for (let i = 0; i < 9; i++) {
    const n = new THREE.Mesh(new THREE.TorusGeometry(R * (0.25 + rr() * 0.35), 0.014, 5, 20), noodleM);
    n.rotation.x = -Math.PI / 2; n.rotation.z = rr() * 6; n.scale.set(1, 0.55 + rr() * 0.5, 1);
    n.position.set((rr() - 0.5) * R * 0.5, top + 0.008 + i * 0.002, (rr() - 0.5) * R * 0.5); g.add(n);
  }
  const greenM = toon(0x4caf50);
  [[0.09, 0.05], [-0.06, -0.08]].forEach(([x, z]) => { const v = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.025), greenM); v.position.set(x, top + 0.03, z); v.rotation.y = x * 20; g.add(v); });
  VP.ramen = { g };
}
const fwd = (face, d) => ({ x: Math.sin(face) * d, z: Math.cos(face) * d });
// 곳마다 다른 것: 바라보는 쪽(face), 자세(pose: headX·lean·wing·sy), 소품(prop). k는 0→1 진행
const VERBS = {
  meeting: {   // 의자에 앉은 채 탁자 위 서류를 집어 들여다본다
    pose: (k) => ({ headX: 0.32 * span(k, 0.25, 0.5), wing: span(k, 0, 0.25) }),
    prop(k) {
      const P = VP.paper, f = fwd(S.face, 0.62), u = span(k, 0.05, 0.35);
      const hand = new THREE.Vector3(S.x + f.x, 0.42 + 0.72, S.z + f.z);
      P.m.position.lerpVectors(P.home.p, hand, u);
      // 꼬꼬 쪽으로 세워 든다: 꼬꼬와 같은 방향(+π)으로 돌리고 먼 쪽 끝을 들어 올림
      const yawT = Math.atan2(Math.sin(S.face + Math.PI), Math.cos(S.face + Math.PI)), y0 = P.home.r.y;
      P.m.rotation.set(0.75 * u, y0 + (yawT - y0) * u, 0, 'YXZ');
    },
    tidy() { const P = VP.paper; P.m.position.copy(P.home.p); P.m.rotation.copy(P.home.r); },
  },
  adboard: {   // 광고판을 올려다본 뒤, 앞에 나타난 라면 그릇을 내려다본다
    pose: (k) => ({ headX: k < 0.42 ? -0.5 * span(k, 0, 0.2) : 0.5 * span(k, 0.42, 0.6) }),
    prop(k) {
      const g = VP.ramen.g, f = fwd(S.face, 0.62);
      if (k < 0.4) { g.visible = false; return; }
      if (!g.visible) { g.visible = true; g.position.set(S.x + f.x, 0, S.z + f.z); puff(S.x + f.x, S.z + f.z, 6); }
      g.scale.setScalar(Math.min(1, (k - 0.4) / 0.1) * (1 + 0.12 * Math.sin(Math.min(1, (k - 0.4) / 0.16) * Math.PI)));
    },
    tidy() { VP.ramen.g.visible = false; },
  },
  riverside: { face: 0,   // 강가에 쪼그려 앉아 물을 들여다본다(고개 숙임)
    pose: (k) => { const u = span(k, 0, 0.3); return { headX: 0.55 * span(k, 0.15, 0.45), lean: 0.28 * u, sy: 1 - 0.2 * u }; },
    prop() {}, tidy() {},
  },
};
function playVerb(t, done) {
  const v = VERBS[t.spot];
  if (!v) { done(); return; }
  if (v.face !== undefined) S.face = v.face;
  // 카메라: 꼬꼬 옆 앞쪽으로 다가간다(lookAt처럼 setCam으로 — 자리만 꼬꼬 기준으로 계산, 세 곳 같은 거리)
  const lift = S.sit ? 0.42 : 0, f = fwd(S.face, 1), sx = Math.cos(S.face), sz = -Math.sin(S.face), C = VERB_CAM;
  CAMS.verb = { p: [S.x - sx * C.side + f.x * C.ahead, C.up + lift, S.z - sz * C.side + f.z * C.ahead],
    l: [S.x + f.x * C.look, C.lookUp + lift, S.z + f.z * C.look] };
  setCam('verb');
  $('zone-banner').classList.remove('show');   // 들어오자마자 시작해도 구역 띠가 동작 위에 남지 않게(세 곳 같은 화면)
  sfx.blip();
  VERB = { v, t0: performance.now(), done, ended: false };
  verbLog.push({ spot: t.spot, start: VERB.t0, end: 0 });   // 자동 검사용 기록(길이가 세 곳 같은지)
}
// 매 프레임: 진행(k)에 맞춰 자세·소품. 끝나면 원문 줄로 넘기고, 검은 전환 뒤 되돌린다
function updateVerb() {
  if (!VERB) return null;
  const k = Math.min(1, (performance.now() - VERB.t0) / VERB_MS);
  VERB.v.prop(k);
  const pose = VERB.v.pose(k);
  if (k >= 1 && !VERB.ended) {
    VERB.ended = true; const V = VERB; verbLog[verbLog.length - 1].end = performance.now();
    setTimeout(() => { V.v.tidy(); if (VERB === V) VERB = null; }, VERB_TIDY_MS);
    V.done();
  }
  return pose;
}
// 꼬꼬 방 단서 살펴보기: 꼬꼬가 옆으로 비켜 서서 물건을 보고, 카메라가 물건 쪽으로 다가간다(대사가 끝나면 원래 카메라)
function lookAt(t) {
  S.mode = 'scene'; for (const k in keys) keys[k] = false;
  if (t.stand) { S.x = t.stand.x; S.z = t.stand.z; }
  if (t.obj) S.face = Math.atan2(t.obj.x - S.x, t.obj.z - S.z);
  if (t.cam) setCam(t.cam);
  talk(DIALOGUE[S.roam && DIALOGUE[t.dlg + 'Roam'] ? t.dlg + 'Roam' : t.dlg], null, null, false);
}

/* ── 미래 마을: 제출한 학생만(S.roam) 마을 왼쪽 끝 새 길로 들어가는 작은 구역 (6-2 사회 「경제성장과 우리 생활」 78~92쪽) ──
   제출 전에는 묶음(FUT.g)이 안 보이고 길목(FUT.col)이 막혀 있다. 평가 답과 무관 — 서버로 아무것도 보내지 않는다. */
// read: 차례로 다 읽은(따라 쓴) 건물 수 0~3 · rd: 지금 열린 읽기 창 { i: 건물, w: 따라 쓸 낱말 차례 } · suit: 미래 꼬꼬 옷(헬멧·제트팩) · spin: 변신 회전
// key: 상자를 다 풀면 받는 자동차 열쇠 · drive: 자율 주행 한 바퀴 중이면 true · route: 한 바퀴 길(곡선) · carCol: 세워 둔 차의 충돌 상자
const FUT = { open: false, g: null, col: null, anim: null, lift: 0, spin: 0, qi: 0, done: false, bits: [], lastEnter: 0, read: 0, rd: null, suit: null, key: false, drive: false, route: null, carCol: null };
const FUT_LINE = {
  tech: '경제성장에 따라 첨단 기술이 빠르게 발전하면서 물건을 만드는 속도가 빨라지고 생산량이 늘어났어요.',
};
// 시간 여행 거리: 건물마다 읽고, **굵은 낱말**을 따라 쓴다(교과서 6-2 사회 「경제성장과 우리 생활」 표현). 상자 암호 답과 같은 낱말
const FUT_READ = [
  { era: '1960년대', text: ['1960년 우리나라 1인당 GNI(국민 한 사람 몫)는 약 120달러였어요. (세계 은행 자료)',
    '나라 전체의 생산 수준이 높아져 경제 규모가 커지는 것을 **경제성장**이라고 해요.'], words: ['경제성장'] },
  { era: '1980년대', text: ['1980년에는 약 1,870달러가 되었어요. (세계 은행 자료)',
    '전쟁 뒤 빠르게 이룬 우리나라 경제성장을 세계는 \'**한강의 기적**\'이라고 불렀어요.'], words: ['한강의 기적'] },
  { era: '2020년대', text: ['2023년에는 약 35,490달러가 되었어요. (세계 은행 자료)',
    '교육과 의료가 좋아져 사람들의 **삶의 질**이 높아졌어요.',
    '하지만 잘사는 사람과 어렵게 사는 사람의 차이가 커지는 **빈부 격차**가 나타나기도 해요.'], words: ['삶의 질', '빈부 격차'] },
];
const CIPHER = [
  ['나라 전체의 생산 수준이 높아져 경제 규모가 커지는 것을 ㄱㅈㅅㅈ(이)라고 해요.', '경제성장'],
  ['전쟁 뒤 빠르게 이룬 우리나라 경제성장을 세계는 \'ㅎㄱㅇ ㄱㅈ\'이라고 불렀어요.', '한강의기적'],
  ['경제가 성장하면 교육과 의료가 좋아져 사람들의 ㅅㅇ ㅈ이 높아져요.', '삶의질'],
  ['경제가 성장하면서 잘사는 사람과 어렵게 사는 사람의 차이가 커지는 ㅂㅂ ㄱㅊ이 나타나기도 해요.', '빈부격차'],
];
function buildFuture() {
  const g = new THREE.Group(); g.visible = false; scene.add(g); FUT.g = g;
  const grp = (x, z) => { const b = new THREE.Group(); b.position.set(x, 0, z); g.add(b); return b; };
  g.add(plane(23, 19, pavement([6, 5]), -35, 1.5, 0.012), plane(24, 3.2, dirt([7, 1]), -34, 2.2, 0.016));
  const sign = (text, x, z, w = 1.8, size = 96) => {
    [-1, 1].forEach((o) => box(0.12, 1.5, 0.12, x + o * (w / 2 - 0.15), 0.75, z, tm(0x8a5a36), 0.015, g));
    const s = signPlane(text, w, 0.62, { size, fg: '#2c3e7a' }); s.position.set(x, 1.4, z + 0.07); g.add(s);
    colliders.push({ x, z, hw: w / 2, hd: 0.15 });
  };
  sign('미래 마을', -25.2, 0.1, 2.0, 92);
  // 1) 시간 여행 거리(길 북쪽): 1960년대 초가집 · 1980년대 공장 · 2020년대 빌딩
  const hut = grp(-28, -6);
  box(2.2, 1.1, 1.8, 0, 0.55, 0, tm(0xe9d6a6), 0.02, hut); box(0.5, 0.75, 0.05, 0, 0.38, 0.92, tm(0x7a5230), 0.01, hut);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.1, 4), tm(0xc9a24a)); roof.rotation.y = Math.PI / 4; roof.position.y = 1.65; addOutline(roof, 0.02); hut.add(roof);
  const fac = grp(-33.5, -6.2), win = tm(0x4a6a8a);
  box(3.0, 2.0, 2.2, 0, 1, 0, tm(0xb8664a), 0.02, fac); box(3.1, 0.25, 2.3, 0, 2.1, 0, tm(0x8d4a36), 0.015, fac);
  box(1.4, 1.2, 1.4, -2.1, 0.6, 0.3, tm(0xd8c7a8), 0.02, fac);
  [-0.9, 0, 0.9].forEach((x) => box(0.5, 0.45, 0.04, x, 1.25, 1.11, win, 0, fac));
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 3.4, 12), tm(0x9a9a9a)); chim.position.set(1.0, 2.7, -0.5); addOutline(chim, 0.015); fac.add(chim);
  const tw = grp(-39.2, -6.6);
  const winTex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#6fa6d2'; c.fillRect(0, 0, w, h); c.fillStyle = '#d9f0ff'; [[8, 10], [36, 10], [8, 40], [36, 40]].forEach(([x, y]) => c.fillRect(x, y, 20, 16)); }, [2, 8]);
  const glass = new THREE.MeshToonMaterial({ map: winTex, gradientMap: GRAD_ENV });
  box(2.0, 8.0, 2.0, 0, 4, 0, glass, 0.02, tw); box(1.4, 10.5, 1.4, 1.6, 5.25, -0.4, glass, 0.02, tw);
  colliders.push({ x: -28, z: -6, hw: 1.2, hd: 1.0 }, { x: -34, z: -6.1, hw: 2.4, hd: 1.2 }, { x: -38.6, z: -6.6, hw: 2.0, hd: 1.3 });
  colliders.push({ x: -30.4, z: -6.2, hw: 1.3, hd: 0.9 });   // 초가집·공장 사이 틈: 건물 뒤 막다른 골목으로 못 들어가게
  colliders.push({ x: -25.4, z: -6.2, hw: 1.5, hd: 0.9 });   // 초가집 동쪽 틈(마을 서쪽 벽 x -24까지)도 같은 까닭으로 막는다
  [['1960년대', -28, hut], ['1980년대', -33.5, fac], ['2020년대', -39.2, tw]].forEach(([lb, x, obj], i) => {
    sign(lb, x, -3.3);
    TH['futT' + i] = { id: 'futT' + i, kind: 'fut', fut: true, act: 'time', i, x, z: -0.6, label: lb, verb: '살펴보기', obj, labelY: 2.2, promptY: 1.0 };   // 간판 앞으로 비켜 서고 말풍선은 낮게: 간판 글자를 덮지 않게
  });
  // 2) 첨단 기술 타 보기(길 남쪽): 드론 · 자율 주행 차 · 로봇
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 24), tm(0x3d4a5a)); pad.position.set(-28.5, 0.03, 7.2); g.add(pad);
  const drone = grp(-28.5, 7.2); drone.position.y = 0.12;
  box(0.55, 0.14, 0.55, 0, 0, 0, tm(0xf2f2f2), 0.012, drone);
  const rotors = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => { box(0.06, 0.1, 0.06, a * 0.38, 0.04, b * 0.38, tm(0x555555), 0, drone); return box(0.42, 0.02, 0.06, a * 0.38, 0.1, b * 0.38, tm(0x333333), 0, drone); });
  const car = place('car_sedan', -34.5, 7.4, { h: 1.15, ry: Math.PI / 2, solid: false, occl: false }); g.add(car.g);
  FUT.carCol = { x: car.x, z: car.z, hw: car.w * 0.43, hd: car.d * 0.42 }; colliders.push(FUT.carCol);   // 올라서기(top) 없음: 세계 가장자리 밖 소품 규칙(play3d)
  const rb = grp(-40.5, 6.3);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.4, 16), tm(0x555c66)); base.position.y = 0.2; addOutline(base, 0.015); rb.add(base);
  const turret = new THREE.Group(); turret.position.y = 0.4; rb.add(turret);
  const a1 = new THREE.Group(); turret.add(a1); box(0.24, 1.0, 0.24, 0, 0.5, 0, tm(0xf2a33a), 0.015, a1);
  const a2 = new THREE.Group(); a2.position.y = 1.0; a1.add(a2); box(0.2, 0.8, 0.2, 0, 0.4, 0, tm(0xf2a33a), 0.015, a2); box(0.34, 0.1, 0.34, 0, 0.85, 0, tm(0x555c66), 0.012, a2);
  a1.rotation.z = 0.3; a2.rotation.z = -1.1;
  box(0.4, 0.8, 0.4, -39.6, 0.4, 7.7, tm(0x6b7480), 0.015, g);   // 버튼대: 꼬꼬 오른쪽 앞, 바닥과 구별되는 진한 회색
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16), toon(0xe8402c).clone()); btn.position.set(-39.6, 0.84, 7.7); addOutline(btn, 0.01); g.add(btn);
  colliders.push({ x: -39.6, z: 7.7, hw: 0.25, hd: 0.25 }, { x: -40.5, z: 6.3, hw: 0.5, hd: 0.5 });
  Object.assign(FUT, { drone, rotors, car, robot: { turret, a1, a2, btn } });
  TH.futDrone = { id: 'futDrone', kind: 'fut', fut: true, act: 'drone', x: -28.5, z: 5.4, label: '드론', verb: '드론 날리기' };
  TH.futCar = { id: 'futCar', kind: 'fut', fut: true, act: 'car', x: -34.5, z: 5.5, label: '자율 주행 차', verb: '자율 주행 차 살펴보기', promptY: 1.8 };   // 열쇠를 받으면 '타기'
  // 자율 주행 한 바퀴 길: 차 자리 → 미래 마을 길 → 마을 큰길(z 2.2) → 울타리 문 → 회사 마당(공장 앞)에서 크게 돌아 → 같은 길로 → 차 자리.
  // 건물·가로등·벤치를 피하는 지점만 골라 잇는다(마을 큰길은 가로등 z 0.5와 벤치 z 2.9 사이: 가는 길 z 1.85, 오는 길 z 1.55). play3d가 길 위 여러 점에서 충돌을 잰다
  const c0 = car.g.position;
  FUT.route = new THREE.CatmullRomCurve3([[c0.x, c0.z], [-33, 7.3], [-31.6, 6.0], [-30.6, 3.8], [-28.6, 2.5], [-23, 2.3], [-20, 2.0], [-10, 1.85], [6, 1.85], [21, 1.9], [30, 2.4], [35.5, 2.4],
    [38.3, 1.0], [38.8, -1.2], [36.8, -2.8], [33, -3.0], [30.6, -2.2], [29.8, -0.2], [28.6, 1.6], [25, 1.8], [21, 1.6], [6, 1.55], [-10, 1.55], [-20, 1.7], [-23, 2.0], [-30, 2.0],
    [-34, 2.2], [-36.8, 3.4], [-37.8, 5.4], [-36.9, 6.9], [-35.7, 7.35], [c0.x, c0.z]].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  TH.futRobot = { id: 'futRobot', kind: 'fut', fut: true, act: 'robot', x: -41.7, z: 8.4, label: '로봇', verb: '로봇 버튼 누르기' };
  // 3) 초성 암호 상자(길 끝): 앞면이 마을 쪽(+x)을 보게
  const chest = grp(-44.3, 2.2); chest.rotation.y = Math.PI / 2;
  box(1.0, 0.55, 0.7, 0, 0.28, 0, tm(0x9a6236), 0.02, chest);
  const lid = new THREE.Group(); lid.position.set(0, 0.55, -0.35); chest.add(lid); box(1.04, 0.22, 0.74, 0, 0.11, 0.35, tm(0xb07440), 0.02, lid);
  box(0.16, 0.2, 0.05, 0, 0.5, 0.37, tm(0xf2c230), 0.01, chest);
  colliders.push({ x: -44.3, z: 2.2, hw: 0.45, hd: 0.6 });
  sign('초성 암호 상자', -44.3, 0.4, 2.4, 66);
  FUT.lid = lid;
  TH.futBox = { id: 'futBox', kind: 'fut', fut: true, act: 'box', x: -43.1, z: 2.2, label: '초성 암호 상자', verb: '암호 풀기' };
  // 구역 둘레(보이지 않는 벽). 마을 서쪽 끝(x -23)의 길목 FUT.col은 열릴 때 끈다
  colliders.push({ x: -47, z: 2, hw: 1, hd: 12 }, { x: -35, z: -9.6, hw: 12, hd: 1 }, { x: -35, z: 12.4, hw: 12, hd: 1 });
  FUT.col = { x: -23, z: 2.2, hw: 1, hd: 1.6 }; colliders.push(FUT.col);
}
function openFuture() {
  if (FUT.open) return;
  FUT.open = true; FUT.g.visible = true; FUT.col.off = true;
  const t = $('fut-toast'); t.textContent = '새 길이 열렸어요 · 마을 왼쪽 끝'; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  setTimeout(() => sfx.gate(), 300);
}
function futAct(t) {
  if (t.act === 'box') {
    if (FUT.done) talk([{ who: 'note', text: '상자는 이미 열려 있어요. 암호 넷을 모두 풀었어요!' }]);
    else if (FUT.read < FUT_READ.length) talk([{ who: 'note', text: '아직 읽지 않은 곳이 있어요: ' + FUT_READ[FUT.read].era }]);
    else openCipher();
    return;
  }
  if (t.act === 'car') {
    if (!FUT.key) talk([{ who: 'note', text: '문이 잠겨 있어요. 열쇠가 필요해요.' }]);
    else startDrive(t);
    return;
  }
  // 시간 여행 거리는 1960 → 1980 → 2020 차례로. 앞 건물을 안 읽었으면 대사만
  if (t.act === 'time' && t.i > FUT.read) { talk([{ who: 'note', text: FUT_READ[FUT.read].era + '부터 차례로 읽어요.' }]); return; }
  S.mode = 'scene'; for (const k in keys) keys[k] = false; landNow();
  FUT.timeTalk = t.act === 'time';   // 시간 여행 칸 대사 동안 꼬꼬 이름표가 뒤 간판 글자를 덮지 않게 숨긴다
  S.x = t.x; S.z = t.z; S.face = t.act === 'time' ? Math.PI : t.act === 'robot' ? Math.atan2(-40.5 - t.x, 6.3 - t.z) : 0;   // 로봇 칸은 꼬꼬가 로봇 왼쪽 앞에 비켜 서서 로봇을 본다(카메라와 로봇 사이를 가리지 않게)
  sfx.blip();
  const lines = [FUT_LINE.tech];
  const R = FUT.robot, D = FUT.drone;
  const step = {
    time(k) { const s = 1 + 0.12 * Math.sin(Math.PI * k); t.obj.scale.set(s, s, s); if (k > 0.2 && !t.puffed) { t.puffed = true; puff(t.obj.position.x, t.obj.position.z + 1.4, 8); sfx.open(); } },
    drone(k) {
      // 받침 둘레를 높이 돈다: 꼬꼬 자리(z 5.4)를 지나지 않고, 카메라와 꼬꼬 사이 시선보다 높게
      const a = Math.PI * 2 * span(k, 0.25, 0.8), r = 1.1 * span(k, 0.25, 0.35) * (1 - span(k, 0.7, 0.8));
      D.position.set(-28.5 + Math.sin(a) * r, 0.12 + 3.5 * span(k, 0, 0.25) * (1 - span(k, 0.8, 1)), 7.2 - Math.cos(a) * r);
      D.rotation.y = a; FUT.rotors.forEach((m, i) => { m.rotation.y = k * 90 + i; });
    },
    robot(k) {
      R.btn.position.y = 0.84 - (k < 0.15 ? 0.05 : 0); R.btn.material.color.setHex(k < 0.95 ? 0x5ad05a : 0xe8402c);
      R.turret.rotation.y = Math.sin(Math.PI * 2 * k) * 1.3; R.a1.rotation.z = 0.3 + 0.5 * Math.sin(Math.PI * k); R.a2.rotation.z = -1.1 + 0.7 * Math.sin(Math.PI * 2 * k);
    },
  }[t.act];
  t.puffed = false;
  FUT.anim = { act: t.act, t0: performance.now(), ms: t.act === 'time' ? 1200 : 1800, step, done: () => {
    FUT.lift = 0;
    if (t.act === 'time') { t.obj.scale.set(1, 1, 1); openRead(t.i); return; }   // 시간 여행 칸은 대사 대신 읽기 창
    talk(lines.map((text) => ({ who: 'note', text })));
  } };
}
// 자율 주행 한 바퀴(열쇠를 받은 뒤): 꼬꼬가 폴짝 차에 타면 차가 FUT.route를 따라 약 26초 동안 저절로 돈다.
// 도는 동안 S.mode 'scene'(입력 막음), 카메라는 S.x·S.z(=차)를 따라간다. Esc나 [내리기]로 언제든 차 자리에서 내린다
const DRIVE = { hop: 0.8, run: 26, ramp: 1.6 };   // 초: 타기 · 달리기 · 출발·도착 때 천천히
const exitBtn = document.createElement('button'); exitBtn.id = 'fut-exit'; exitBtn.className = 'hide'; exitBtn.type = 'button';
exitBtn.innerHTML = '내리기 <span class="kbd">Esc</span>'; document.body.appendChild(exitBtn);
exitBtn.addEventListener('click', () => { exitBtn.blur(); stopDrive(); });
function startDrive(t) {
  S.mode = 'scene'; for (const k in keys) keys[k] = false; landNow();
  S.x = t.x; S.z = t.z; S.face = 0; sfx.blip();
  const C = FUT.car.g, c0 = { x: C.position.x, z: C.position.z, ry: C.rotation.y }, curve = FUT.route, L = curve.getLength();
  const { hop, run, ramp } = DRIVE, vmax = L / (run - ramp);
  // 지나간 길이(0~L): 처음·끝 ramp초는 고르게 빨라지고 느려진다
  const dist = (s) => s < ramp ? vmax * s * s / (2 * ramp) : s > run - ramp ? L - vmax * (run - s) * (run - s) / (2 * ramp) : vmax * (s - ramp / 2);
  FUT.drive = true; exitBtn.classList.remove('hide');
  FUT.anim = { act: 'drive', t0: performance.now(), ms: (hop + run) * 1000, c0, inCar: false, step(k) {
    const s = k * (hop + run);
    if (s < hop) {   // 폴짝 뛰어 차 안으로(지붕에 앉지 않게 끝에는 숨김)
      const m = span(s, 0, hop);
      S.x = t.x + (c0.x - t.x) * m; S.z = t.z + (c0.z - t.z) * m;
      FUT.lift = Math.sin(Math.PI * m) * 0.9; hero.root.visible = m < 0.8;
      if (m > 0.8 && !this.inCar) { this.inCar = true; sfx.open(); }
      return;
    }
    hero.root.visible = false; FUT.lift = 0;
    const u = Math.min(1, Math.max(0, dist(s - hop) / L)), p = curve.getPointAt(u), tg = curve.getTangentAt(u);
    C.position.set(p.x, 0, p.z); C.rotation.y = u >= 1 ? c0.ry : Math.atan2(tg.x, tg.z);
    S.x = p.x; S.z = p.z; S.face = C.rotation.y;
  }, done: () => endDrive(false) };
}
// 내리기: 차는 제자리, 꼬꼬는 차 옆(살펴보기 자리)에 서서 다시 걷기. early(Esc·[내리기])면 잠깐 어두워졌다가 옮긴다
function endDrive(early) {
  const t = TH.futCar, A = FUT.anim, c0 = A && A.c0;
  FUT.anim = null; FUT.drive = false; FUT.lift = 0; exitBtn.classList.add('hide');
  const park = () => {
    if (c0) { FUT.car.g.position.set(c0.x, 0, c0.z); FUT.car.g.rotation.y = c0.ry; }
    hero.root.visible = true; teleport(t.x, t.z, 0); puff(t.x, t.z, 6);
  };
  if (!early) { park(); S.mode = 'walk'; return; }
  S.mode = 'fade'; sfx.blip();
  fadeOut(() => { park(); setTimeout(() => { fadeIn(); S.mode = 'walk'; }, 150); });
}
function stopDrive() { if (FUT.drive && FUT.anim && FUT.anim.act === 'drive') endDrive(true); }
function updateFuture(dt) {
  if (!FUT.open) return;
  if (FUT.anim) { const A = FUT.anim, k = Math.min(1, (performance.now() - A.t0) / A.ms); A.step(k); if (k >= 1) { FUT.anim = null; A.done(); } }
  for (let i = FUT.bits.length - 1; i >= 0; i--) {
    const b = FUT.bits[i], u = b.userData; u.life -= dt; u.vy -= 9 * dt;
    b.position.x += u.vx * dt; b.position.y += u.vy * dt; b.position.z += u.vz * dt; b.rotation.x += dt * 8; b.rotation.y += dt * 6;
    if (u.life <= 0 || b.position.y < 0) { scene.remove(b); b.material.dispose(); FUT.bits.splice(i, 1); }
  }
  if (FUT.done && FUT.lid.rotation.x > -1.9) FUT.lid.rotation.x = Math.max(-1.9, FUT.lid.rotation.x - dt * 3);
}
// 초성 암호 창: 한 문제씩, 띄어쓰기 무시 비교, 틀리면 칸 흔들림, Esc 닫기. 열린 동안 꼬꼬는 멈춘다(S.mode 'cipher')
const cipherEl = document.createElement('div'); cipherEl.id = 'cipher'; cipherEl.className = 'hide';
cipherEl.setAttribute('role', 'dialog'); cipherEl.setAttribute('aria-modal', 'true'); cipherEl.setAttribute('aria-label', '초성 암호 상자');
cipherEl.innerHTML = '<div class="cp-box"><div class="cp-top"><b>초성 암호 상자</b><span id="cipher-n"></span></div><p class="cp-rule">친구에게 묻지 말고 거리에서 읽은 낱말로 풀어요.</p><p id="cipher-q"></p>'
  + '<input id="cipher-in" autocomplete="off" spellcheck="false" aria-label="암호 답 입력"><div class="cp-key"><span class="kbd">Enter</span> 확인 · <span class="kbd">Esc</span> 닫기</div></div>';
document.body.appendChild(cipherEl);
function renderCipher() { $('cipher-n').textContent = (FUT.qi + 1) + ' / ' + CIPHER.length; $('cipher-q').textContent = CIPHER[FUT.qi][0]; $('cipher-in').value = ''; }
function openCipher() {
  S.mode = 'cipher'; for (const k in keys) keys[k] = false; landNow();
  renderCipher(); cipherEl.classList.remove('hide'); setTimeout(() => $('cipher-in').focus(), 0);
}
function closeCipher() { cipherEl.classList.add('hide'); $('cipher-in').blur(); for (const k in keys) keys[k] = false; S.mode = 'walk'; }
function checkCipher() {
  const inp = $('cipher-in'), v = inp.value.replace(/\s/g, '');
  if (!v || performance.now() - FUT.lastEnter < 200) return;   // 빈 칸·겹쳐 들어온 Enter는 무시
  FUT.lastEnter = performance.now();
  if (v !== CIPHER[FUT.qi][1]) { cipherMiss(); return; }
  sfx.ding(); FUT.qi++;
  if (FUT.qi < CIPHER.length) { renderCipher(); return; }
  closeCipher(); FUT.done = true; TH.futBox.verb = '살펴보기'; sfx.gate();
  const cols = [0xff5a5a, 0xffc93a, 0x5ad05a, 0x4aa8ff, 0xc77dff];
  for (let i = 0; i < 26; i++) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshBasicMaterial({ color: cols[i % 5], side: THREE.DoubleSide }));
    const a = Math.random() * Math.PI * 2; b.position.set(-44.3, 0.8, 2.2);
    b.userData = { life: 1.6, vx: Math.cos(a) * 1.6, vz: Math.sin(a) * 1.6, vy: 4 + Math.random() * 2.5 }; scene.add(b); FUT.bits.push(b);
  }
  futTransform();
}
// 상자 암호를 틀리면: 창을 닫고 읽은 기록을 지운 뒤 꼬꼬를 1960년대 건물 앞(간판 쪽을 보게)으로 돌려보낸다
function cipherMiss() {
  closeCipher(); sfx.nope();
  FUT.read = 0; FUT.qi = 0; S.mode = 'fade';
  fadeOut(() => {
    const t0 = TH.futT0; teleport(t0.x, t0.z, Math.PI);
    setTimeout(() => { fadeIn(); S.mode = 'walk'; talk([{ who: 'note', text: '틀렸어요. 1960년대부터 다시 읽고 오세요.' }]); }, 150);
  });
}
$('cipher-in').addEventListener('keydown', (e) => {
  e.stopPropagation();   // 게임 쪽(main.js 창 키 처리: Esc=수첩, Space=점프)으로 안 넘긴다
  if (e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter는 판정하지 않는다
  if (e.key === 'Escape') { e.preventDefault(); closeCipher(); return; }
  if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) checkCipher(); }
});
$('cipher-in').addEventListener('animationend', (e) => e.target.classList.remove('bad'));

// 시간 여행 읽기 창: 시대 제목 + 글(따라 쓸 낱말 굵게) + 따라 쓰기 칸. 암호 창과 같은 모양(CSS 공유), 열린 동안 S.mode 'read'
// 붙여넣기·끌어 놓기는 막는다(직접 써 보게). 다 쓰면 FUT.read가 늘고, Esc로 중간에 닫으면 그 건물은 안 끝난 걸로 둔다
const readEl = document.createElement('div'); readEl.id = 'futread'; readEl.className = 'hide';
readEl.setAttribute('role', 'dialog'); readEl.setAttribute('aria-modal', 'true'); readEl.setAttribute('aria-label', '시간 여행 거리 읽기');
readEl.innerHTML = '<div class="cp-box"><div class="cp-top"><b id="futread-era"></b><span id="futread-n"></span></div><div id="futread-text"></div>'
  + '<p id="futread-ask"></p><input id="futread-in" autocomplete="off" spellcheck="false" aria-label="따라 쓰기 입력">'
  + '<button id="futread-done" class="hide" type="button">다 읽었어요</button><p id="futread-warn"></p>'
  + '<div class="cp-key"><span class="kbd">Enter</span> 확인 · <span class="kbd">Esc</span> 닫기</div></div>';
document.body.appendChild(readEl);
function renderRead() {
  const R = FUT_READ[FUT.rd.i], w = FUT.rd.w, all = w >= R.words.length;
  $('futread-era').textContent = R.era;
  $('futread-n').textContent = all ? '따라 쓰기 끝' : '따라 쓰기 ' + (w + 1) + ' / ' + R.words.length;
  const box = $('futread-text'); box.textContent = '';
  R.text.forEach((line) => {
    const p = document.createElement('p');
    line.split('**').forEach((part, k) => { if (!part) return; const n = k % 2 ? document.createElement('b') : document.createTextNode(part); if (k % 2) n.textContent = part; p.appendChild(n); });
    box.appendChild(p);
  });
  $('futread-ask').textContent = all ? '' : '따라 써 보세요: ' + R.words[w];
  $('futread-in').classList.toggle('hide', all); $('futread-ask').classList.toggle('hide', all);
  $('futread-done').classList.toggle('hide', !all); $('futread-in').value = ''; $('futread-warn').textContent = '';
  setTimeout(() => (all ? $('futread-done') : $('futread-in')).focus(), 0);
}
function openRead(i) {
  S.mode = 'read'; for (const k in keys) keys[k] = false; landNow();
  FUT.rd = { i, w: i < FUT.read ? FUT_READ[i].words.length : 0 };   // 이미 끝낸 건물은 다시 읽기만(따라 쓰기 없이)
  renderRead(); readEl.classList.remove('hide');
}
function closeRead() { readEl.classList.add('hide'); $('futread-in').blur(); $('futread-done').blur(); FUT.rd = null; for (const k in keys) keys[k] = false; S.mode = 'walk'; }
function checkRead() {
  const inp = $('futread-in'), v = inp.value.replace(/\s/g, ''), R = FUT_READ[FUT.rd.i];
  if (!v || performance.now() - FUT.lastEnter < 200) return;
  FUT.lastEnter = performance.now();
  if (v !== R.words[FUT.rd.w].replace(/\s/g, '')) { sfx.nope(); inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad'); return; }
  sfx.ding(); FUT.rd.w++;
  if (FUT.rd.w >= R.words.length && FUT.read === FUT.rd.i) FUT.read = FUT.rd.i + 1;
  renderRead();
}
readEl.addEventListener('keydown', (e) => {
  e.stopPropagation();   // 게임 쪽(Esc=수첩, Space=점프)으로 안 넘긴다
  if (e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter는 판정하지 않는다
  if (e.key === 'Escape') { e.preventDefault(); closeRead(); return; }
  if (e.key === 'Enter') { e.preventDefault(); if (e.repeat) return; if (e.target.id === 'futread-in') checkRead(); else if (FUT.rd && FUT.rd.w >= FUT_READ[FUT.rd.i].words.length) closeRead(); }
});
$('futread-done').addEventListener('click', () => closeRead());
$('futread-in').addEventListener('animationend', (e) => e.target.classList.remove('bad'));
const noPaste = (e) => { e.preventDefault(); $('futread-warn').textContent = '붙여넣기는 안 돼요. 한 글자씩 직접 써 보세요.'; };
$('futread-in').addEventListener('paste', noPaste);
$('futread-in').addEventListener('drop', noPaste);
$('futread-in').addEventListener('dragover', (e) => e.preventDefault());
$('futread-in').addEventListener('beforeinput', (e) => { if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') noPaste(e); });

// 미래 꼬꼬 변신: 꽃가루 → 상자에서 빛 기둥 → 꼬꼬가 떠올라 한 바퀴 돌며 번쩍 → 헬멧·제트팩을 달고 내려온다
function buildSuit() {
  const head = hero.parts.head, rig = hero.rig;
  const glow = new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.38, depthWrite: false });
  const helmet = new THREE.Group(); head.add(helmet);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glow); dome.position.y = 0.16; dome.scale.set(1.08, 1.45, 1.08); helmet.add(dome);   // 높이 1.45배: 꼭대기 0.885가 볏 꼭대기(약 0.85)를 덮게
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.035, 8, 32), new THREE.MeshBasicMaterial({ color: 0x4aa8ff })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.16; helmet.add(ring);
  const ant = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9ff0ff })); ant.position.y = 0.9; helmet.add(ant);
  const pack = new THREE.Group(); pack.position.set(0, 0.44, -0.33); rig.add(pack);
  const metal = toon(0xb8c4d4), red = toon(0xe8402c), flames = [];
  box(0.36, 0.3, 0.1, 0, 0, 0.04, metal, 0.012, pack);
  [-1, 1].forEach((s) => {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 12), metal); tank.position.set(s * 0.12, 0, -0.06); addOutline(tank, 0.012); pack.add(tank);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.12, 12), red); cap.position.set(s * 0.12, 0.26, -0.06); pack.add(cap);
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.08, 10), toon(0x555c66)); noz.position.set(s * 0.12, -0.24, -0.06); pack.add(noz);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.3, 10), new THREE.MeshBasicMaterial({ color: 0xffa83a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    f.rotation.x = Math.PI; f.position.set(s * 0.12, -0.43, -0.06); f.visible = false; pack.add(f); flames.push(f);
  });
  return { helmet, pack, flames };
}
function futTransform() {
  S.mode = 'scene'; for (const k in keys) keys[k] = false; landNow();
  S.x = -42.6; S.z = 2.6; S.face = 0;   // 상자 바로 앞, 카메라 쪽을 보게
  S.cam = { p: new THREE.Vector3(-38.6, 3.0, 4.6), l: new THREE.Vector3(-43.3, 1.4, 2.4) };   // 떠오른 꼬꼬·빛 기둥이 한 화면에 들어오게 조금 멀리, 로봇(z 6.3)이 앞을 가리지 않게 동쪽에서
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beamGeo = new THREE.CylinderGeometry(0.55, 0.55, 1, 20, 1, true); beamGeo.translate(0, 0.5, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.set(-44.3, 0.3, 2.2); beam.scale.y = 0.01; scene.add(beam); FUT.beam = beam;
  const flash = $('fut-flash'), T = 4.0;   // 초 단위 시간표: 빛 기둥 0.9~2.4 · 떠오름 2.2~2.7 · 회전 2.6~3.3(2.9 번쩍) · 내려옴 3.3~3.8
  let flashed = false;
  FUT.anim = { act: 'suit', t0: performance.now(), ms: T * 1000, step(k) {
    const s = k * T;
    const up = span(s, 0.9, 1.6), fade = span(s, 1.8, 2.4);
    beam.scale.y = 0.01 + 7 * up; beamMat.opacity = 0.55 * Math.min(1, up * 3) * (1 - fade); beam.rotation.y = s * 2;
    FUT.lift = 1.1 * Math.sin(Math.PI / 2 * span(s, 2.2, 2.7)) * (1 - span(s, 3.3, 3.8));
    FUT.spin = Math.PI * 2 * span(s, 2.6, 3.3);
    if (s >= 2.9 && !flashed) {
      flashed = true; if (!FUT.suit) FUT.suit = buildSuit();
      sfx.whoosh(); puff(S.x, S.z, 10, 1.1);
      flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    }
  }, done: () => {
    scene.remove(beam); beamGeo.dispose(); beamMat.dispose(); FUT.beam = null;
    FUT.lift = 0; FUT.spin = 0; S.cam = null; S.mode = 'walk';
    FUT.key = true; TH.futCar.verb = '자율 주행 차 타기';
    talk([{ who: 'note', text: '딸깍! 상자가 열렸어요. 미래 꼬꼬가 되었어요!' }, { who: 'note', text: '자동차 열쇠도 받았어요!' }]);
  } };
}
function openChapter(c) {
  if (S.roam) return;
  S.mode = 'panel';
  fadeOut(() => {
    S.cam = null; if (S.sit) { S.sit = false; S.z = -77.4; S.face = 0; }
    teleport(S.x, S.z, S.face);
    EXAM.openPanel(c, () => {
      fadeIn(); S.mode = 'walk';
      if (S.progress === c) {
        S.progress = c + 1; EXAM.setProgress(S.progress); EXAM.saveLocal(S);
        if (S.progress >= 2) setPollution(true);   // 3장 강가는 2장을 마친 뒤부터 보인다
        stampPop(c);
        talk(DIALOGUE[['after1', 'after2', 'after3'][c]], () => { if (c === 2) openNotebook(); });
      }
    });
  });
}
function walkNPC(n, x, z, endRy, cb) { n.walk = { x, z, endRy, cb }; }
function openNotebook() { if (S.mode !== 'walk') return; S.mode = 'panel'; EXAM.openNotebook(S.progress, () => { S.mode = 'walk'; }, () => { S.mode = 'end'; }); }

/* ── 카메라 자리(장면 연출) ── */
const CAMS = {
  homeClock:  { p: [-42.45, 2.4, -81.0], l: [-42.6, 0.85, -83.5] },
  homePhoto:  { p: [-37.8, 2.6, -80.8], l: [-38.1, 0.95, -83.7] },
  homeMirror: { p: [-38.6, 2.0, -78.6], l: [-35.8, 1.3, -79.8] },
  ramen:    { p: [-3.1, 2.0, -81.0], l: [-3.6, 1.15, -84.6] },
  rollWide: { p: [40, 5.6, -72.6], l: [40, 0.8, -81] },
  boss:     { p: [41.0, 2.0, -77.4], l: [40, 1.15, -82.2] },
  heroFace: { p: [40.4, 1.7, -81.2], l: [40, 0.95, -79] },
  fox:      { p: [80.7, 2.5, -75.4], l: [80, 1.3, -83.4] },
  ad:       { p: [64.2, 3.3, 6.0], l: [63.5, 2.7, -3.8] },      // 3장 세 곳은 비슷한 거리(꼬꼬와 대상이 함께 보이게)
  river:    { p: [38.6, 3.8, 15.4], l: [36.9, 0.4, 8.6] },   // 강 건너편에서: 공장 쪽 둑 → 배수관 → 강
};
function setCam(name, snap) {
  const c = CAMS[name]; if (!c) return;
  S.cam = { p: new THREE.Vector3(...c.p), l: new THREE.Vector3(...c.l) };
  if (snap) { camPos.copy(S.cam.p); camLook.copy(S.cam.l); }
}

/* ── 대화 ──────────────────────────────────── */
const D = { lines: null, i: 0, typed: 0, spans: [], timer: 0, done: null, npc: null, keepCam: false, busy: false };
const talkQueue = [];
function talk(lines, done, npc, keepCam) {
  if (!lines || !lines.length) { done && done(); return; }
  if (S.mode !== 'walk' && S.mode !== 'scene') { talkQueue.push([lines, done, npc, keepCam]); return; }
  Object.assign(D, { lines, i: 0, done: done || null, npc: npc || null, keepCam: !!keepCam });
  S.mode = 'talk'; $('letterbox').classList.add('on'); $('dialogue').classList.remove('hide');
  if (npc && npc.actor) {
    const toward = (a, b) => Math.atan2(b.x - a.x, b.z - a.z), mix = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
    S.face = mix(toward(S, npc), 0, 0.5); npc.actor.root.rotation.y = mix(toward(npc, S), 0, 0.55);
  }
  showLine();
}
function speakerActor(who) { if (who === 'kkokko') return hero; const n = NPCS.find((n) => n.id === who || (n.who === who && sameRoom(n))); return n ? n.actor : null; }
function showLine() {
  const L = D.lines[D.i];
  if (L.fade) {   // 장면 바꾸기: 검게 → 카메라 옮기기 → 밝게
    D.busy = true; $('dialogue').classList.add('hide'); $('dlg-big').classList.add('hide'); $('dlg-big').dataset.who = '';
    $('fade').classList.add('on');
    setTimeout(() => { if (L.cam === 'river') setPollution(true); setCam(L.cam, true); $('fade').classList.remove('on'); setTimeout(() => { D.busy = false; $('dialogue').classList.remove('hide'); renderLine(L); }, 250); }, 380);
    return;
  }
  if (L.cam) setCam(L.cam);
  renderLine(L);
}
function renderLine(L) {
  $('dlg-name').textContent = WHO[L.who].name;
  const big = $('dlg-big'), src = faceSrc(L.who, L.face);
  if (!src) { big.classList.add('hide'); big.dataset.who = ''; }
  else {
    const changed = big.dataset.who !== L.who + (L.face || '');
    big.classList.remove('hide'); big.src = src; big.dataset.who = L.who + (L.face || '');
    big.classList.toggle('right', L.who !== 'kkokko');
    if (changed) { big.classList.remove('enter'); void big.offsetWidth; big.classList.add('enter'); }
  }
  const dlg = $('dialogue'), emph = L.src === '원문';
  dlg.classList.toggle('no-face', !src);
  dlg.classList.toggle('right-face', !!src && L.who !== 'kkokko');
  dlg.classList.toggle('left-face', !!src && L.who === 'kkokko');
  layoutFace();
  dlg.classList.toggle('emph', emph);
  if (emph) { dlg.classList.remove('shake'); void dlg.offsetWidth; dlg.classList.add('shake'); sfx.ding(); }
  big.classList.remove('wait'); clearTimeout(renderLine.t);
  if (L.cut) { cutIn(L.who); S.shake = 0.35; if (src) { big.classList.add('wait'); renderLine.t = setTimeout(() => big.classList.remove('wait'), 950); } }
  NPCS.forEach((n) => n.actor.setTalk(false)); hero.setTalk(false);
  const a = speakerActor(L.who); if (a) { a.setTalk(true); a.setMood(L.face || 'happy'); }
  if (L.who === 'kkokko') hero.setMood(L.face || '');
  if (L.heroMood) hero.setMood(L.heroMood);
  // 글자: 낱말은 줄바꿈 단위로 묶고, 한 글자씩 통통 튀어나온다
  const boxEl = $('dlg-text'); boxEl.innerHTML = ''; const spans = [];
  L.text.split(' ').forEach((word, wi) => {
    if (wi) { boxEl.appendChild(document.createTextNode(' ')); }
    const w = document.createElement('span'); w.className = 'w';
    for (const ch of word) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; w.appendChild(s); spans.push(s); }
    boxEl.appendChild(w);
  });
  D.spans = spans; D.typed = 0; clearInterval(D.timer);
  D.timer = setInterval(() => {
    if (D.typed < spans.length) spans[D.typed].classList.add('on');
    D.typed++;
    if (D.typed % 3 === 1) sfx.blip();
    if (D.typed >= spans.length) { clearInterval(D.timer); a && a.setTalk(false); }
  }, 32);
}
// 초상화가 대사 글자를 덮지 않게: 초상화와 겹치는 만큼 대사창 안쪽 여백을 준다(창 크기·그림 비율로 계산)
function layoutFace() {
  const dlg = $('dialogue'), big = $('dlg-big');
  dlg.style.removeProperty('padding-left'); dlg.style.removeProperty('padding-right');
  if (big.classList.contains('hide')) return;
  const cs = getComputedStyle(big), bh = big.offsetHeight || parseFloat(cs.height) || 0;
  const bw = big.naturalWidth ? bh * big.naturalWidth / big.naturalHeight : bh * 0.85;
  const right = big.classList.contains('right');
  const bl = right ? innerWidth - parseFloat(cs.right) - bw : parseFloat(cs.left);
  const dw = dlg.offsetWidth, dl = innerWidth / 2 - dw / 2, dr = dl + dw;
  if (!right) dlg.style.setProperty('padding-left', Math.max(24, bl + bw - dl + 18) + 'px', 'important');
  else dlg.style.setProperty('padding-right', Math.max(24, dr - bl + 18) + 'px', 'important');
}
$('dlg-big').addEventListener('load', layoutFace);
addEventListener('resize', layoutFace);
function cutIn(who) {
  const c = $('cutin'), src = faceSrc(who); if (!src) return;
  $('ci-img').src = src; c.classList.remove('hide', 'go'); void c.offsetWidth; c.classList.add('go'); sfx.whoosh();
  clearTimeout(cutIn.t); cutIn.t = setTimeout(() => c.classList.add('hide'), 1150);
}
function advance() {
  if (D.busy) return;
  if (D.typed < D.spans.length) { clearInterval(D.timer); D.typed = D.spans.length; D.spans.forEach((s) => s.classList.add('on')); NPCS.forEach((n) => n.actor.setTalk(false)); hero.setTalk(false); return; }
  D.i++;
  if (D.i < D.lines.length) { showLine(); return; }
  NPCS.forEach((n) => { n.actor.setTalk(false); n.actor.setMood(''); }); hero.setTalk(false); hero.setMood('');
  S.mode = 'walk'; if (!D.keepCam) S.cam = null;
  $('letterbox').classList.remove('on'); $('dialogue').classList.add('hide'); $('dialogue').classList.remove('emph');
  $('dlg-big').classList.add('hide'); $('dlg-big').dataset.who = ''; $('cutin').classList.add('hide');
  const cb = D.done; D.done = null; cb && cb();
  if (S.mode === 'walk' && talkQueue.length) { const q = talkQueue.shift(); talk(q[0], q[1], q[2], q[3]); }
}

/* ── 판깔기: 로그인 직후 검은 화면에 안내 네 줄 → "혼자 생각해서 쓰겠습니다"를 직접 쳐야 시작 (11/24 2반 피드백: 답 공유) ── */
function showPledge(done) {
  S.mode = 'pledge'; for (const k in keys) keys[k] = false;
  const box = $('pledge'), lines = [...box.querySelectorAll('.pl-lines p')], ask = box.querySelector('.pl-ask'), inp = $('pledge-in');
  const GOAL = '혼자생각해서쓰겠습니다';
  let finished = false;
  lines.forEach((l) => l.classList.remove('on')); ask.classList.remove('on'); inp.value = ''; inp.classList.remove('bad');
  box.classList.remove('hide');
  lines.forEach((l, i) => setTimeout(() => l.classList.add('on'), 400 + i * 900));
  setTimeout(() => { ask.classList.add('on'); box.dataset.ready = '1'; inp.focus(); }, 400 + lines.length * 900 + 300);
  const block = (e) => { e.preventDefault(); };
  const onBefore = (e) => { if (/^insertFrom(Paste|Drop)/.test(e.inputType || '')) e.preventDefault(); };
  const onKey = (e) => {
    if (e.key !== 'Enter' || finished) return;
    e.preventDefault();
    if (inp.value.replace(/\s/g, '') === GOAL) {
      finished = true; inp.blur();
      ['paste', 'drop'].forEach((t) => inp.removeEventListener(t, block)); inp.removeEventListener('beforeinput', onBefore); inp.removeEventListener('keydown', onKey);
      box.classList.add('hide'); delete box.dataset.ready; audioUnlock(); done();
    } else { inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad'); }
  };
  box.onclick = () => { if (box.dataset.ready) inp.focus(); };   // 바깥을 눌러도 칸에 다시 포커스
  ['paste', 'drop'].forEach((t) => inp.addEventListener(t, block));
  inp.addEventListener('beforeinput', onBefore);
  inp.addEventListener('keydown', onKey);
}

/* ── 오프닝 컷신 ───────────────────────────── */
function playOpening(done) {
  S.mode = 'comic'; let i = 0;
  const box = $('comic'), img = $('comic-img'), txt = $('comic-text'), cbox = box.querySelector('.comic-box');
  box.classList.remove('hide');
  let typed = 0, full = '', timer = 0, line = null;
  const seen = new Set();
  function show() {
    const c = OPENING[i]; img.classList.remove('in'); void img.offsetWidth; seen.add(i);
    img.src = c.img; img.classList.add('in'); full = c.text; typed = 0; clearInterval(timer);
    txt.innerHTML = ''; line = document.createElement('span'); txt.appendChild(line);
    // 원문 줄은 게임 속 대사와 똑같이: 형광펜·흔들림·띠링
    const emph = c.src === '원문';
    cbox.classList.toggle('emph', emph);
    if (emph) { cbox.classList.remove('shake'); void cbox.offsetWidth; cbox.classList.add('shake'); sfx.ding(); }
    timer = setInterval(() => { typed++; line.textContent = full.slice(0, typed); if (typed % 3 === 1) sfx.blip(); if (typed >= full.length) clearInterval(timer); }, 38);
    $('comic-page').textContent = (i + 1) + ' / ' + OPENING.length;
  }
  function next() {
    if (typed < full.length) { clearInterval(timer); typed = full.length; line.textContent = full; return; }
    i++; if (i < OPENING.length) { show(); return; }
    removeEventListener('keydown', onKey, true); box.classList.add('hide'); cbox.classList.remove('emph', 'shake'); done();
  }
  function onKey(e) { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); e.stopPropagation(); audioUnlock(); next(); } }
  addEventListener('keydown', onKey, true);
  // 건너뛰기: 아직 안 본 원문 컷이 남았으면 그 컷으로 가고(원문 줄은 누구나 보게), 없으면 끝
  $('comic-skip').onclick = () => {
    audioUnlock();
    const j = OPENING.findIndex((c, k) => k > i && c.src === '원문' && !seen.has(k));
    clearInterval(timer);
    if (j >= 0) { i = j; show(); return; }
    i = OPENING.length; typed = full.length; next();
  };
  show();
}

/* ── 초상화: 아스트라로 그린 2D 캐릭터 그림 (없는 인물은 초상화 없이) ── */
const FACE = { mom: 'mom', baby: 'baby', boss: 'boss', bear: 'bear', bunny: 'bunny', fox: 'fox' };
function faceSrc(who, face) {
  if (who === 'kkokko') return 'assets/faces/kkokko' + (face === 'worry' ? '_worry' : face === 'happy' ? '_happy' : '') + '.webp';
  return FACE[who] ? 'assets/faces/' + FACE[who] + '.webp' : null;
}

/* ── 효과·소리 ─────────────────────────────── */
const dusts = [];
const dustMap = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
function puff(x, z, n = 1, y = 0) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustMap, transparent: true, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, r = n > 1 ? 0.25 : 0;
    s.position.set(x + Math.cos(a) * r, y + 0.12, z + Math.sin(a) * r); s.scale.setScalar(0.35);
    s.userData = { life: 0.55, vx: Math.cos(a) * (n > 1 ? 1.2 : 0.2), vz: Math.sin(a) * (n > 1 ? 1.2 : 0.2) };
    scene.add(s); dusts.push(s);
  }
}
let AC = null, master = null, musicGain = null;
function audioUnlock() {
  if (AC) return;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = navigator.webdriver ? 0 : 0.5; master.connect(AC.destination); startMusic(); } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (!AC) return; document.hidden ? AC.suspend() : AC.resume(); });
function tone(f, d, type = 'sine', v = 0.06, slide) {
  if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
const sfx = {
  jump: () => tone(380, 0.18, 'square', 0.035, 760), jump2: () => tone(560, 0.16, 'square', 0.035, 1120),
  land: () => tone(150, 0.09, 'triangle', 0.06), blip: () => tone(640 + Math.random() * 80, 0.03, 'triangle', 0.022),
  step: () => tone(200 + Math.random() * 40, 0.035, 'triangle', 0.012),
  open: () => { tone(660, 0.12, 'sine', 0.06); setTimeout(() => tone(990, 0.18, 'sine', 0.06), 110); },
  door: () => tone(520, 0.1, 'triangle', 0.05, 700), nope: () => tone(220, 0.15, 'square', 0.03, 180),
  stamp: () => { tone(140, 0.22, 'triangle', 0.12, 70); setTimeout(() => tone(880, 0.25, 'sine', 0.05), 160); },
  ding: () => { tone(1318, 0.16, 'sine', 0.05); setTimeout(() => tone(1760, 0.28, 'sine', 0.045), 90); },
  whoosh: () => tone(300, 0.25, 'sawtooth', 0.025, 1200),
  gate: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.05), i * 90)); },
};
EXAM.setSfx && EXAM.setSfx(sfx);
function startMusic() {
  musicGain = AC.createGain(); musicGain.gain.value = 0.05; musicGain.connect(master);
  const notes = [0, 4, 7, 9, 7, 4, 2, 4, 0, 2, 4, 7, 9, 12, 9, 7], bass = [0, 0, 5, 5, 7, 7, 5, 5];
  const base = 392, beat = 0.28; let step = 0, next = AC.currentTime + 0.1;
  setInterval(() => {
    while (next < AC.currentTime + 0.4) {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle';
      o.frequency.value = base * Math.pow(2, notes[step % notes.length] / 12);
      g.gain.setValueAtTime(0.0001, next); g.gain.exponentialRampToValueAtTime(0.5, next + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, next + beat * 0.9);
      o.connect(g); g.connect(musicGain); o.start(next); o.stop(next + beat);
      if (step % 2 === 0) {
        const b = AC.createOscillator(), bg = AC.createGain(); b.type = 'sine';
        b.frequency.value = base / 4 * Math.pow(2, bass[(step / 2) % bass.length] / 12);
        bg.gain.setValueAtTime(0.0001, next); bg.gain.exponentialRampToValueAtTime(0.7, next + 0.03); bg.gain.exponentialRampToValueAtTime(0.0001, next + beat * 1.8);
        b.connect(bg); bg.connect(musicGain); b.start(next); b.stop(next + beat * 2);
      }
      step++; next += beat;
    }
  }, 120);
}
function musicDuck(on) { if (musicGain) musicGain.gain.setTargetAtTime(on ? 0.012 : 0.05, AC.currentTime, 0.3); }

/* ── 화면 연출(페이드·도장·배너) ────────────── */
function fadeOut(cb) { const f = $('fade'); f.classList.add('on'); musicDuck(true); setTimeout(cb, 280); }
function fadeIn() { $('fade').classList.remove('on'); musicDuck(false); }
function stampPop(i) {
  const el = document.querySelectorAll('#hud-prog .stamp')[i]; if (!el) return;
  el.classList.add('on'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); sfx.stamp(); renderHUD();
}
function renderHUD() {
  document.querySelectorAll('#hud-prog .slot').forEach((s, i) => {
    s.classList.toggle('done', S.progress > i); s.classList.toggle('now', S.progress === i);
    s.querySelector('.stamp').classList.toggle('on', S.progress > i);
  });
}
let zoneShown = '';
const ZONES = { future: ['', '미래 마을'], home: ['', '꼬꼬네 집'], village: ['', '꼬꼬네 마을'], company: ['', '불꽃식품 회사'], mart: ['1장', '동네 마트'], factory: ['2장', '불꽃식품 공장'], meet: ['3장', '회의실'] };
function zoneBanner(z) {
  const [ch, nm] = ZONES[z];
  const b = $('zone-banner'); b.innerHTML = (ch ? '<span class="zb-ch">' + ch + '</span>' : '') + nm;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

/* ── 길 안내: 퀘스트 문구·목적지 화살표·발자국 ── */
const arrow = new THREE.Group();
(function makeArrow() {
  const m = toon(0xffc93a, { emissive: 0xffb000, emissiveIntensity: 0.55 });
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.62, 4), m); head.rotation.x = Math.PI; head.position.y = 0; addOutline(head, 0.03);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.55, 0.26), m); shaft.position.y = 0.55; addOutline(shaft, 0.03);
  arrow.add(head, shaft); scene.add(arrow);
})();
const stepMap = canvasTex(64, 96, (g) => {
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath(); g.ellipse(32, 58, 15, 24, 0, 0, 7); g.fill();
  [[18, 22], [32, 15], [46, 22]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); });
});
const STEPS_N = 26;
const stepMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.5), new THREE.MeshBasicMaterial({ map: stepMap, transparent: true, depthWrite: false, color: 0xfff1a8, opacity: 0.9 }), STEPS_N);
stepMesh.frustumCulled = false; scene.add(stepMesh);
const qbar = $('quest-bar');
const labelEl = document.createElement('div'); labelEl.className = 'tlabel'; $('labels').appendChild(labelEl);
const prompt = document.createElement('div'); prompt.className = 'prompt'; $('labels').appendChild(prompt);
const edge = document.createElement('div'); edge.className = 'edge-arrow'; edge.innerHTML = '<span>➜</span><b></b>'; $('labels').appendChild(edge);
const nameTags = {};
function nameTag(id, text, cls) { const el = document.createElement('div'); el.className = 'nametag ' + (cls || ''); el.textContent = text; $('labels').appendChild(el); nameTags[id] = el; return el; }
function updateNameTags() {
  const show = S.mode === 'walk' || S.mode === 'talk';
  if (S.mode === 'walk') FUT.timeTalk = false;
  const list = [['__hero', hero.root.position.x, hero.root.position.z, 1.75 + J.z + (S.sit ? 0.42 : 0), '꼬꼬(나)', 'me', true]]
    .concat(NPCS.map((n) => [n.id, n.x, n.z, (n.labelY || 2) - 0.25, WHO[n.who].name, '', sameRoom(n)]));
  for (const [id, x, z, y, text, cls, same] of list) {
    const el = nameTags[id] || nameTag(id, text, cls);
    const far = !same || Math.hypot(x - S.x, z - S.z) > 14 || !show || !!S.cam || (id === '__hero' && (FUT.timeTalk || (S.mode === 'walk' && promptFor && promptFor.act === 'time')));
    if (far) { el.style.display = 'none'; continue; }
    const [sx, sy, sz] = toScreen(x, y, z);
    el.style.display = sz < 1 ? '' : 'none'; el.style.left = sx + 'px'; el.style.top = sy + 'px';
  }
}
const tmpV = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V1 = new THREE.Vector3();
function toScreen(x, y, z) { tmpV.set(x, y, z).project(camera); return [(tmpV.x * 0.5 + 0.5) * innerWidth, (-tmpV.y * 0.5 + 0.5) * innerHeight, tmpV.z]; }
let navT = 0, lastQuest = '', promptFor = null;
// 화면 위쪽 가림막(HUD + 퀘스트 띠 + 평가 띠)의 아래 끝
function topSafe() {
  let b = 0;
  for (const el of [$('hud'), qbar]) { if (el.offsetParent === null || el.style.display === 'none' || el.classList.contains('hide')) continue; b = Math.max(b, el.getBoundingClientRect().bottom); }
  return b + 6;
}
const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
// 말풍선·목적지 이름표·인물 이름표가 서로, 또 HUD와 겹치지 않게 정리한다(매 프레임, updateNameTags 뒤)
function tidyLabels() {
  let safe = topSafe();
  // 구역 배너(3초)가 떠 있는 동안은 배너 아래까지를 가림막으로 본다
  const zb = $('zone-banner'), zbOn = zb.classList.contains('show') && +getComputedStyle(zb).opacity > 0.05, zr = zbOn ? zb.getBoundingClientRect() : null;
  const vis = (el) => el.style.display !== 'none';
  if (vis(edge)) labelEl.style.display = 'none';          // 목적지가 화면 밖이면 가장자리 화살표만
  if (vis(prompt) && promptFor) {
    if (promptFor.kind === 'npc' && nameTags[promptFor.id]) nameTags[promptFor.id].style.display = 'none';   // 말 거는 대상의 이름표는 말풍선이 대신한다
    const me = nameTags.__hero;
    if (me && vis(me)) { const a = prompt.getBoundingClientRect(), b = me.getBoundingClientRect(); if (overlap(a, b)) prompt.style.top = (b.top - 14) + 'px'; }
  }
  const safeG = zr ? Math.max(safe, zr.bottom + 6) : safe;   // 길 안내(목적지 이름표·말풍선)는 배너도 피한다
  if (vis(labelEl)) {
    if (vis(prompt)) { const a = labelEl.getBoundingClientRect(), b = prompt.getBoundingClientRect(); if (overlap(a, b)) labelEl.style.top = (b.top - 8) + 'px'; }
    const h = labelEl.offsetHeight, top = parseFloat(labelEl.style.top);
    if (top - h < safeG) labelEl.style.top = (safeG + h) + 'px';
  }
  for (const id in nameTags) { const el = nameTags[id]; if (!vis(el)) continue; const h = el.offsetHeight, top = parseFloat(el.style.top); if (top - h < safe) el.style.top = (safe + h) + 'px'; }
  // 구역 배너가 떠 있는 동안 그 밑에 깔리는 인물 이름표는 잠깐 숨긴다
  if (zr) for (const id in nameTags) { const el = nameTags[id]; if (id !== '__hero' && vis(el) && overlap(el.getBoundingClientRect(), zr)) el.style.display = 'none'; }
  if (vis(prompt)) {
    const h = prompt.offsetHeight, top = parseFloat(prompt.style.top);
    if (top - h < safeG) {
      prompt.style.top = (safeG + h) + 'px';
      // 위로 비켰다가 가림막에 밀려 내려오면 꼬꼬 이름표와 다시 겹친다 → 그때는 이름표 아래로
      const me = nameTags.__hero;
      if (me && vis(me)) { const b = me.getBoundingClientRect(); if (overlap(prompt.getBoundingClientRect(), b)) prompt.style.top = (b.bottom + 6 + h) + 'px'; }
    }
  }
}
function updateNav(dt) {
  navT += dt;
  const cur = questCur(), tq = questTarget(cur), n3 = cur === 'ch3' ? ' (' + (3 - spotsLeft().length) + '/3)' : '', qkey = cur + (tq && tq.exit ? ':exit' : '') + n3;
  if (qkey !== lastQuest) { lastQuest = qkey; qbar.querySelector('b').textContent = tq && tq.exit && cur !== 'homeDoor' ? '출입문으로 나가세요' : (QUEST_TEXT[cur] || '') + n3; qbar.classList.remove('pop'); void qbar.offsetWidth; qbar.classList.add('pop'); }
  qbar.style.display = (S.mode === 'walk' || S.mode === 'talk') && cur && !S.cam ? '' : 'none';
  const tg = (S.mode === 'walk') ? tq : null;
  // 3D 화살표
  arrow.visible = !!tg;
  if (tg) { arrow.position.set(tg.x, tg.y + 0.6 + Math.sin(navT * 4) * 0.22, tg.z); arrow.rotation.y += dt * 2.2; }
  // 이름표
  if (tg) { const [sx, sy, sz] = toScreen(tg.x, tg.y + 1.5, tg.z); labelEl.textContent = tg.label || ''; labelEl.style.left = sx + 'px'; labelEl.style.top = sy + 'px'; labelEl.style.display = sz < 1 ? '' : 'none'; }
  else labelEl.style.display = 'none';
  // 화면 밖이면 가장자리 화살표
  if (tg) {
    // 위쪽은 HUD·퀘스트 띠 아래까지만 쓴다
    const [sx, sy, sz] = toScreen(tg.x, tg.y, tg.z), m = 70, mt = topSafe() + 34;
    const off = sz > 1 || sx < m || sx > innerWidth - m || sy < mt || sy > innerHeight - m;
    if (off) {
      const cx = innerWidth / 2, cy = (mt + innerHeight - m) / 2; let dx = sx - cx, dy = sy - cy; if (sz > 1) { dx = -dx; dy = -dy; }
      const k = Math.min((cx - m) / Math.abs(dx || 1), (cy - mt) / Math.abs(dy || 1));
      edge.style.left = (cx + dx * k) + 'px'; edge.style.top = (cy + dy * k) + 'px';
      edge.querySelector('span').style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
      edge.querySelector('b').textContent = Math.round(Math.hypot(tg.x - S.x, tg.z - S.z)) + 'm';
      edge.style.display = '';
    } else edge.style.display = 'none';
  } else edge.style.display = 'none';
  // 발자국 길: 꼬꼬 → (문을 지나야 하면 문 먼저) → 목적지
  let n = 0;
  if (tg) {
    const pts = [[S.x, S.z]];
    if (!S.room) {
      if ((tg.x > GATE_X) !== (S.x > GATE_X)) { const sg = S.x < GATE_X ? 1 : -1; pts.push([GATE_X - sg * 1.6, 2.2], [GATE_X + sg * 1.6, 2.2]); }
      else if (Math.abs(tg.x - S.x) > 6 && Math.abs(tg.z - 2.2) > 3 && Math.abs(S.z - 2.2) > 3) pts.push([S.x, 2.2], [tg.x, 2.2]);
    }
    pts.push([tg.x, tg.z]);
    let carry = (navT * 1.6) % 0.9;
    for (let i = 0; i < pts.length - 1 && n < STEPS_N; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L, ang = Math.atan2(ux, uz);
      for (let d = 0.9 + carry; d < L - 0.6 && n < STEPS_N; d += 0.9) {
        const side = (n % 2 ? 1 : -1) * 0.14;
        const px = ax + ux * d - uz * side, pz = az + uz * d + ux * side;
        E.set(-Math.PI / 2, 0, -ang + Math.PI); Q.setFromEuler(E);
        const fade = Math.min(1, (d) / 2) * (1 - n / STEPS_N * 0.6);
        M4.compose(V1.set(px, 0.03, pz), Q, new THREE.Vector3(fade, fade, fade)); stepMesh.setMatrixAt(n++, M4);
      }
      carry = 0;
    }
  }
  for (let i = n; i < STEPS_N; i++) { M4.makeScale(0, 0, 0); stepMesh.setMatrixAt(i, M4); }
  stepMesh.instanceMatrix.needsUpdate = true;
  // 말 걸기 말풍선
  const t = S.mode === 'walk' ? nearestThing() : null; promptFor = t;
  if (t) {
    const ty = t.promptY !== undefined ? t.promptY : t.kind === 'npc' ? (t.labelY || 2) - 0.2 : t.kind === 'door' ? 2.2 : t.kind === 'exit' ? 1.5 : (t.labelY || 1.4) - 0.6;
    const [px, py] = toScreen(t.x, ty, t.z);
    prompt.textContent = t.kind === 'npc' ? 'E 말 걸기' : t.kind === 'door' ? (doorOpen(t) ? 'E 들어가기' : '🔒 E') : t.kind === 'exit' ? 'E 나가기'
      : t.kind === 'fut' ? 'E ' + t.verb : t.id === 'rollcall' ? 'E 서기' : t.id === 'seat' ? 'E 앉기' : 'E 살펴보기';
    prompt.style.left = px + 'px'; prompt.style.top = py + 'px'; prompt.style.display = '';
  } else prompt.style.display = 'none';
  // 목적지 문 바로 앞에 서면 말풍선이 길 안내를 대신한다: 목적지 이름표·3D 화살표가 건물 간판을 덮지 않게 숨긴다
  if (t && tg && t.kind === 'door' && t.x === tg.x && t.z === tg.z) { labelEl.style.display = 'none'; arrow.visible = false; }
}

/* ── 가림 처리 ─────────────────────────────── */
function updateOccluders(dt) {
  const hx = S.x, hz = S.z, cx = camera.position.x, cz = camera.position.z;
  for (const o of occluders) {
    let hide = false;
    if (o.z > hz + 0.3 && o.z < cz && Math.abs(o.x - hx) < 14) { const t = (o.z - hz) / (cz - hz), lx = hx + (cx - hx) * t; hide = Math.abs(o.x - lx) < o.r + 0.9; }
    const target = hide ? 0.28 : 1;
    if (o.a === target) continue;
    o.a += (target - o.a) * Math.min(1, dt * 8); if (Math.abs(o.a - target) < 0.01) o.a = target;
    for (const m of o.mats) { const tr = o.a < 0.999; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = o.a; m.depthWrite = o.a > 0.95; }
    for (const ol of o.outs) ol.visible = o.a > 0.95;
  }
}

/* ── 입력 ──────────────────────────────────── */
const keys = {};
const J = { on: false, pre: 0, z: 0, vz: 0, dbl: false, spin: 0, land: 0, base: 0, fly: 0, flapT: 0 };   // z: 발 높이(땅 0, 소품 위면 그 윗면), base: 마지막으로 딛은 높이, fly: 이번 점프의 날갯짓 횟수(제출 뒤만)
const GRAV = 26, V0 = 8.2, V2 = 6.4, V0_SUIT = 9.6;   // V0_SUIT: 미래 꼬꼬(제트팩)가 된 뒤 첫 점프는 조금 더 높이(정점 ≈ 1.77)
// 제출 뒤(S.roam) 날기: 공중에서 Space마다 날갯짓(횟수 제한 없음). 바깥은 땅 위 FLY_TOP까지,
// 실내 방(지붕 없음, 벽 높이 ROOM_H)은 꼬꼬 머리가 벽 위로 안 나오게 낮춘다. 날갯짓한 뒤에는 천천히 내려온다(FLY_FALL)
const FLY_TOP = 25, HERO_H = 1.1, FLY_FALL = 7;
function flyTop() { return S.room ? ROOM_H - HERO_H : FLY_TOP; }
function jump() {
  if (!J.on) { Object.assign(J, { on: true, pre: 0.06, vz: 0, dbl: false, spin: 0, base: J.z, fly: 0, flapT: 0 }); return; }
  if (S.roam) { if (J.pre <= 0) flap(); return; }   // 제출 전에는 아래 2단 점프 그대로
  if (!J.dbl && J.pre <= 0) { J.dbl = true; J.vz = V2; J.spin = 0.0001; sfx.jump2(); puff(S.x, S.z, 6); }
}
function flap() {
  if (!J.dbl) J.spin = 0.0001;   // 첫 날갯짓은 2단 점프처럼 한 바퀴
  J.dbl = true; J.fly++; J.flapT = 0.28;
  J.vz = J.z >= flyTop() - 0.05 ? 0 : V2;
  sfx.jump2(); puff(S.x, S.z, 3, J.z);
}
addEventListener('keydown', (e) => {
  // E = 말 걸기·살펴보기. 한글 입력 상태면 keyCode 229로 오므로 code로 먼저 잡는다(입력칸이 아닐 때만)
  const isE = e.code === 'KeyE' && !(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName));
  if (!isE && (e.isComposing || e.keyCode === 229)) return;
  if (S.mode === 'panel' || S.mode === 'end' || S.mode === 'start' || S.mode === 'pledge' || S.mode === 'cipher' || S.mode === 'read') return;   // 시험 화면·판깔기·암호 창·읽기 창은 따로 처리
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  audioUnlock();
  if (S.mode === 'talk') { if ((e.code === 'Space' || e.code === 'Enter' || isE) && !e.repeat) { e.preventDefault(); advance(); } return; }
  if (S.mode === 'scene' && FUT.drive && e.code === 'Escape' && !e.repeat) { stopDrive(); return; }   // 자율 주행 중 Esc = 내리기(수첩은 안 열림)
  if (S.mode !== 'walk') return;
  if (e.code === 'Escape') { openNotebook(); return; }
  if (isE) { e.preventDefault(); if (!e.repeat) { const t = nearestThing(); if (t) interact(t); } return; }   // E = 말 걸기·살펴보기
  if (e.code === 'Space' && !e.repeat) { jump(); return; }   // Space = 점프(제출 뒤엔 날갯짓)
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

/* ── 루프 ──────────────────────────────────── */
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tv = new THREE.Vector3(), tl = new THREE.Vector3();
let camGy = 0, camFly = 0, stepT = 0, fpsT0 = performance.now(), fpsN = 0, lowT = 0, highT = 0, gateCool = 0, wasInside = false;
const SKY = scene.background, INSIDE_BG = new THREE.Color(0x2b211a);
function loop() {
  if (S.mode === 'start' || S.mode === 'pledge') { clock.getDelta(); fpsT0 = performance.now(); fpsN = 0; requestAnimationFrame(loop); return; }   // 포스터·판깔기가 화면을 다 덮는 동안은 3D를 그리지 않는다
  const dt = Math.min(0.05, clock.getDelta());
  let moving = false;
  gateCool -= dt;
  if (S.mode === 'walk') {
    let dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    let dz = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    if (dx || dz) {
      const l = Math.hypot(dx, dz); dx /= l; dz /= l; moving = true;
      const sp = 4.6 * dt, nx = S.x + dx * sp, nz = S.z + dz * sp;
      const bx = blocked(nx, S.z, J.z); if (!bx) S.x = nx; else hitGate(bx);
      const bz = blocked(S.x, nz, J.z); if (!bz) S.z = nz;
      S.face = Math.atan2(dx, dz);
      stepT += dt; if (stepT > 0.18 && !J.on) { stepT = 0; puff(S.x - dx * 0.3, S.z - dz * 0.3, 1, J.z); sfx.step(); }
    }
  }
  // 문 열림
  for (const g of gates) {
    const should = S.progress >= g.need;
    if (should && !g.open) { g.open = true; g.col.off = true; if (S.mode !== 'loading') sfx.gate(); }
    g.t += ((g.open ? 1 : 0) - g.t) * Math.min(1, dt * 3);
    g.door.position.z = -g.t * 3.6; g.door.scale.y = 1 - g.t * 0.1; g.lock.visible = !g.open;
  }
  // 점프
  let sx = 1, sy = 1;
  // 소품 끝에서 걸어 나가면 떨어진다
  if (!J.on && J.z > 0 && groundAt(S.x, S.z, J.z) < J.z - 0.01) Object.assign(J, { on: true, pre: 0, vz: 0, dbl: true, spin: 0, base: J.z });
  if (J.on) {
    if (J.pre > 0) { J.pre -= dt; sy = 0.8; sx = 1.15; if (J.pre <= 0) { J.vz = FUT.suit ? V0_SUIT : V0; sfx.jump(); } }
    else {
      const prevZ = J.z;
      if (J.fly && J.vz <= -FLY_FALL) { J.z -= FLY_FALL * dt; J.vz = -FLY_FALL; }   // 날갯짓한 뒤에는 활공하듯 천천히
      else { J.z += J.vz * dt - GRAV * dt * dt / 2; J.vz -= GRAV * dt; }   // 정확한 적분: 프레임 수와 상관없이 정점이 같다(V0²/2g ≈ 1.29)
      if (S.roam) { const top = flyTop(); if (J.z > top) { J.z = top; if (J.vz > 0) J.vz = 0; } }
      const v = J.vz / V0; sy = 1 + Math.max(-0.06, Math.min(0.15, v * 0.15)); sx = 1 - (sy - 1) * 0.6;
      if (J.spin) J.spin = Math.min(1, J.spin + dt / 0.45);
      const g = J.vz <= 0 ? groundAt(S.x, S.z, prevZ) : -1;
      if (J.z <= g) { J.z = g; J.base = g; J.on = false; J.spin = 0; J.fly = 0; J.flapT = 0; J.land = 0.14; puff(S.x, S.z, 8, g); sfx.land(); }
    }
  }
  if (J.land > 0) { J.land -= dt; sy *= 0.78; sx *= 1.2; }
  hero.root.position.set(S.x, 0, S.z);
  let dy = S.face - hero.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  hero.root.rotation.y += dy * Math.min(1, dt * 12);
  const pose = updateVerb() || {};
  hero.update(dt, { moving, jumping: J.on && J.pre <= 0, sx, sy: sy * (pose.sy || 1), lift: J.z + (S.sit ? 0.42 : 0) + FUT.lift, spin: J.spin * Math.PI * 2 + FUT.spin,
    headX: pose.headX, lean: pose.lean, wing: pose.wing });
  // 미래 꼬꼬 제트팩 불꽃: 점프·날기 중에만, 살짝 일렁인다
  if (FUT.suit) { const on = J.on && J.pre <= 0; FUT.suit.flames.forEach((f, i) => { f.visible = on; if (on) f.scale.set(1, 0.75 + Math.sin(navT * 40 + i * 2) * 0.25 + (J.vz > 0 ? 0.3 : 0), 1); }); }
  // 날기: 날갯짓 직후엔 크게 퍼덕이고, 내려올 때는 날개를 펴고 살랑
  if (J.fly && J.on) {
    J.flapT -= dt;
    const w = J.flapT > 0 ? Math.sin(J.flapT * 45) * 1.0 + 0.8 : 1.15 + Math.sin(navT * 9) * 0.12;
    hero.parts.wings.forEach((p, i) => { p.rotation.z = (i ? -1 : 1) * w; });
  }
  for (const n of NPCS) {
    let mv = false;
    if (n.walk) {
      const w = n.walk, ddx = w.x - n.x, ddz = w.z - n.z, L = Math.hypot(ddx, ddz), st = 3.0 * dt;
      if (L <= st) { n.x = w.x; n.z = w.z; n.actor.root.rotation.y = w.endRy; n.walk = null; w.cb && w.cb(); }
      else { n.x += ddx / L * st; n.z += ddz / L * st; n.actor.root.rotation.y = Math.atan2(ddx, ddz); mv = true; }
      n.actor.root.position.x = n.x; n.actor.root.position.z = n.z; n.col.x = n.x; n.col.z = n.z;
    }
    if (Math.hypot(n.x - S.x, n.z - S.z) < 30) n.actor.update(dt, { moving: mv });
  }
  // 반짝이는 자리에 서면 저절로 시작
  const qc = questCur(), autoIds = qc === 'rollcall' ? ['rollcall'] : qc === 'ch3' ? spotsLeft() : [];
  if (S.mode === 'walk') for (const id of autoIds) { const t = TH[id]; if (t && sameRoom(t) && Math.hypot(t.x - S.x, t.z - S.z) < 0.6 && !J.on && J.z === 0) { interact(t); break; } }
  for (const m of markers) { const on = autoIds.includes(m.id) && sameRoom(TH[m.id]) && S.mode === 'walk'; m.g.visible = on; if (on) { const k = 1 + Math.sin(navT * 5) * 0.08; m.ring.scale.set(k, k, 1); m.beam.material.opacity = 0.14 + Math.sin(navT * 3) * 0.06; } }
  if (beltTex) { beltTex.offset.x -= dt * 0.55; for (const p of beltPacks) { p.position.x += dt * 0.72; if (p.position.x > 46.6) p.position.x -= 13.2; } }
  for (const l of lamps) l.material.emissiveIntensity = Math.sin(navT * 6) > 0 ? 1.4 : 0.2;
  // 구역 배너
  const zk = S.room || (S.x < -23.4 ? 'future' : S.x < GATE_X ? 'village' : 'company');
  if (zk !== zoneShown && (S.mode === 'walk' || S.mode === 'talk' || FUT.drive)) { zoneShown = zk; zoneBanner(zk); }   // 자율 주행 중에도 지나는 마을 이름을 띄운다
  // 해·카메라
  sun.position.set(camLook.x + 9, 16, camLook.z + 7); sun.target.position.set(camLook.x, 0, camLook.z);
  if (S.cam) { camLook.lerp(S.cam.l, Math.min(1, dt * 4)); camPos.lerp(S.cam.p, Math.min(1, dt * 3)); }
  else {
    camTarget(S.x, S.z, S.mode === 'talk' ? 0.72 : 1);
    camGy += (J.base - camGy) * Math.min(1, dt * 5);      // 소품 위에 서면 카메라도 천천히 그만큼 올라간다
    // 날 때(제출 뒤)는 높이를 따라 카메라도 같이 올라간다(점프 높이까지는 지금처럼 거의 안 움직임)
    camFly += ((S.roam ? Math.max(0, J.z - J.base - 1.2) : 0) - camFly) * Math.min(1, dt * 4);
    tl.y += camGy + camFly + (J.z - J.base - camFly) * 0.25; tv.y += camGy + camFly;
    // 높이 날수록 카메라를 꼬꼬 위쪽으로 돌려 내려다본다 → 지평선(맵 끝)이 화면에 안 들어온다
    const fk = Math.min(1, Math.max(0, (camFly - 2) / 10));
    if (fk > 0) { const back = tv.z - tl.z; tl.z += (S.z - tl.z) * fk; tv.z = tl.z + back * (1 - 0.75 * fk); }   // 보는 곳도 꼬꼬 쪽으로 → 꼬꼬가 화면 가운데
    camLook.lerp(tl, Math.min(1, dt * 6));
    camPos.lerp(tv, Math.min(1, dt * 4));
  }
  camera.position.copy(camPos); camera.lookAt(camLook);
  if (S.shake > 0) { S.shake -= dt; const k = S.shake * 0.35; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; }
  // 실내면 하늘 대신 어두운 바탕
  const inside = camLook.z < -50;
  if (inside !== wasInside) { wasInside = inside; scene.background = inside ? INSIDE_BG : SKY; scene.fog.color.set(inside ? 0x2b211a : 0xcfe9ff); }
  scene.fog.near = 26 + camFly; scene.fog.far = 62 + camFly;   // 높이 날 때 땅이 안개에 묻히지 않게(날지 않으면 그대로)
  waterUniform.value += dt;
  if (POLL.on && POLL.flow) { const f = navT * 1.3 % 1; POLL.flow.offset.y += dt * 1.6; POLL.splash.scale.set(1 + f * 0.35, 1 + f * 0.35, 1); POLL.splash.material.opacity = 0.9 - f * 0.5; }
  for (const c of clouds) { c.position.x += c.userData.drift * dt; if (c.position.x > 150) c.position.x = -40; }
  for (let i = dusts.length - 1; i >= 0; i--) {
    const s = dusts[i]; s.userData.life -= dt;
    s.position.x += s.userData.vx * dt; s.position.z += s.userData.vz * dt; s.position.y += dt * 0.5;
    s.scale.setScalar(0.35 + (0.55 - s.userData.life) * 1.4); s.material.opacity = Math.max(0, s.userData.life / 0.55);
    if (s.userData.life <= 0) { scene.remove(s); s.material.dispose(); dusts.splice(i, 1); }
  }
  updateOccluders(dt);
  updateSmoke(dt);
  updateFuture(dt);
  updateNav(dt);
  updateNameTags();
  tidyLabels();
  composer.render();
  // fps: 잘린 dt가 아니라 실제 흐른 시간으로 잰다
  fpsN++;
  const now = performance.now(), el = (now - fpsT0) / 1000;
  if (el > 1) {
    const fps = fpsN / el; fpsT0 = now; fpsN = 0;
    if (el < 3 && !SHOT) {      // 탭이 가려졌다 돌아온 경우(긴 공백)는 빼고
      $('fps').textContent = Math.round(fps) + ' fps · ' + PR.toFixed(2);
      window.__kk.fps = fps; window.__kk.pr = PR;
      let np = PR;
      if (fps < 20) np = PR - 0.25;                               // 아주 느리면 바로 크게
      else if (fps < 40) { if (++lowT >= 2) np = PR - 0.15; } else lowT = 0;
      if (fps > 57) { if (++highT >= 4) np = PR + 0.125; } else highT = 0;
      np = Math.max(PR_MIN, Math.min(PR_MAX, np));
      if (Math.abs(np - PR) > 0.01) { PR = np; lowT = 0; highT = 0; resize(); }
    }
  }
  requestAnimationFrame(loop);
}
function hitGate(c) {
  const g = gates.find((g) => g.col === c); if (!g || g.open || gateCool > 0) return;
  gateCool = 1.4; sfx.nope(); talk(DIALOGUE[g.lockedDlg]);
}

window.__kk = { get verb() { return VERB ? { spot: Object.keys(VERBS).find((k) => VERBS[k] === VERB.v), t: performance.now() - VERB.t0, ended: VERB.ended } : null; }, VERB_MS, VP, verbLog, FUT, S, J, FLY_TOP, flyTop, arrow, markers, colliders, groundAt, blocked, NPCS, TH, gates, occluders, questCur, spotsLeft, SPOT_IDS, ROOMS, teleport, hero, fps: 0, camera, failedModels, CAMS, POLL, ROOM_CAM, OUT_CAM, composer,
  shot(p, l) { S.cam = { p: new THREE.Vector3(...p), l: new THREE.Vector3(...l) }; camPos.copy(S.cam.p); camLook.copy(S.cam.l); } };
// 간판 글자는 캔버스에 한 번만 그리므로, 글꼴이 받아진 뒤에 세계를 짓는다(최대 3초 기다림)
function waitFonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const all = Promise.all([document.fonts.load('64px "Jua"', '꼬꼬 가나다 123'),
    document.fonts.load('17px "Gowun Dodum"', '가나다라 꼬꼬')]).catch(() => {});
  return Promise.race([all, new Promise((r) => setTimeout(r, 3000))]);
}
function showLoadError(e) {
  console.error(e);
  $('ld-msg').innerHTML = '불러오지 못했어요. 새로고침(F5) 해 주세요.<br><small style="opacity:.7">' + String(e && e.message || e).replace(/[<>&]/g, '') + '</small>';
  $('ld-msg').style.color = '#8a2318';
}
// 진행에 맞춰 세계를 놓는다(도장·강·공장장 자리·꼬꼬 위치·HUD). at: 꼬꼬 자리를 따로 줄 때
function placeWorld(st, at) {
  S.progress = st.progress; Object.assign(S.flags, st.flags || {});
  setPollution(S.progress >= 2);
  if (S.progress >= 1) S.flags.talkedMom = true;
  if (S.progress >= 2) { const b = TH.boss; b.walk = null; b.x = b.front.x; b.z = b.front.z; b.col.x = b.x; b.col.z = b.z; b.actor.root.position.set(b.x, 0, b.z); b.actor.root.rotation.y = 0; }
  const md = TH.meetDoor, st0 = at || [[-12, 2.4], [GATE_X + 2.5, 2.4], [md.x, md.z + 1.4], [md.x, md.z + 1.4]][Math.min(S.progress, 3)];
  // 처음 시작(아직 집을 나선 적 없음)은 꼬꼬 방 안에서
  const atHome = !at && S.progress === 0 && !S.flags.leftHome && !S.flags.talkedMom;
  if (atHome) { const R = ROOMS.home; S.room = 'home'; teleport(R.start.x, R.start.z, 0); }
  else { S.room = null; teleport(st0[0], st0[1], 0); }
  $('hud').classList.remove('hide'); $('hud-who').textContent = st.who; renderHUD();
  S.placed = true;
}
window.addEventListener('unhandledrejection', (ev) => { if (S.mode === 'loading') showLoadError(ev.reason); });
(async function init() {
  try {
  await Promise.all([loadAll(), waitFonts()]);
  if (failedModels.length) console.warn('대체 상자로 그린 모델', failedModels);
  buildWorld();
  [...new Set(Object.values(FACE))].concat(['kkokko', 'kkokko_happy', 'kkokko_worry']).forEach((f) => { const im = new Image(); im.src = 'assets/faces/' + f + '.webp'; });
  renderer.compile(scene, camera);
  $('loading').classList.add('done');
  EXAM.init({
    onStart: (st) => {                       // 반·번호·이름 등록 뒤
      placeWorld(st);
      const go = () => { S.mode = 'walk'; zoneShown = ''; enteredAt = performance.now(); if (S.progress >= 3) openNotebook(); };
      if (st.fresh) showPledge(() => playOpening(go)); else go();   // 판깔기는 처음 시작하는 학생에게만(이어하기·제출한 학생은 안 나옴)
    },
    onRoam: (st) => {                        // 끝 화면에서 '마을 돌아다니기'
      S.roam = true;
      if (!S.placed) placeWorld(st, [-12, 2.4]);   // 새로고침 뒤 바로 끝 화면이었으면 마을 입구에서
      else { S.progress = Math.max(S.progress, st.progress || 3); setPollution(true); renderHUD(); }
      for (const k in keys) keys[k] = false;
      $('kbd-nb').textContent = 'Space 연타 날기 · Esc 내 답 보기';
      S.cam = null; S.sit = false; zoneShown = ''; S.mode = 'walk';
      openFuture();   // 제출한 학생만: 마을 왼쪽 끝에 미래 마을 길이 열린다
    },
    getFlags: () => S.flags,
    onEnd: () => { S.mode = 'end'; },
  });
  S.mode = 'start';
  camTarget(S.x, S.z); camPos.copy(tv); camLook.copy(tl);
  } catch (e) { showLoadError(e); return; }
  loop();
})();
