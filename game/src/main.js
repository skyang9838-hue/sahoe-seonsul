// 꼬꼬의 첫 출근 — 3D 본판: 마을 → 시내(불꽃식품) → 회의실·강가
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { toon, toonify, addOutline, GRAD_ENV } from './toon.js?v=7';
import { buildChicken, buildCritter } from './chars.js?v=7';
import { WHO, DIALOGUE, OPENING, QUEST_TEXT } from './story.js?v=7';
import * as EXAM from './exam.js?v=7';

const $ = (id) => document.getElementById(id);

/* ── 렌더러·장면 ───────────────────────────── */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let PR = Math.min(devicePixelRatio, 1.5);
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
  renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 3, h / 3);
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
        vec3 c=mix(vec3(.36,.72,.95),vec3(.55,.86,1.),smoothstep(.3,.5,w*.5+.5));
        c=mix(c,vec3(.95,1.,1.),smoothstep(.43,.5,d));
        float s=step(.985,sin(vUv.x*${round ? '40.' : '200.'}+t*2.)*sin(vUv.y*36.-t*1.7)); c+=s*.35;
        if(dirty>=0.){ float k=exp(-pow((vUv.x-dirty)*14.,2.))*smoothstep(1.,.2,vUv.y); c=mix(c,vec3(.52,.5,.46),k*.75); }
        gl_FragColor=vec4(c,.93); }`,
  });
}

/* ── 모델 불러오기·배치 ─────────────────────── */
const loader = new GLTFLoader();
const protos = {};
const MODELS = ['home', 'home2', 'market', 'well', 'windmill', 'tavern', 'bench', 'streetlight', 'bush', 'box', 'barrel',
  'tree_single_A', 'tree_single_B', 'trees_A_medium', 'trees_B_small', 'rock_single_A', 'rock_single_C',
  'fence_wood_straight', 'fence_wood_straight_gate', 'crate_A_small', 'crate_A_big', 'cloud_big',
  'crate_carrots', 'crate_tomatoes', 'crate_lettuce', 'building_A', 'building_B', 'building_D', 'building_E', 'building_F',
  'building_G', 'building_H', 'watertower', 'road_straight', 'road_straight_crossing', 'car_sedan', 'car_taxi', 'car_hatchback',
  'car_stationwagon', 'trafficlight_A', 'firehydrant', 'trash_A', 'dumpster', 'fence_stone_straight'];
const ALIAS = { building_E: 'factory_e', building_G: 'office' };
async function loadAll() {
  let done = 0;
  await Promise.all(MODELS.map((n) => new Promise((res) => {
    loader.load(`assets/models/kaykit/${ALIAS[n] || n}.glb`, (g) => {
      const root = g.scene, box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3());
      root.position.set(-c.x, -box.min.y, -c.z);
      const holder = new THREE.Group(); holder.add(root);
      protos[n] = { holder, size: box.getSize(new THREE.Vector3()) };
      $('ld-fill').style.width = (++done / MODELS.length * 100) + '%'; res();
    }, undefined, () => { console.warn('모델 실패', n); res(); });
  })));
}
const colliders = [], occluders = [], clouds = [];
function place(name, x, z, { s = 1, h = 0, w = 0, ry = 0, solid = true, shrink = 0.8, outline = 0.02, occl = true } = {}) {
  const p = protos[name]; if (!p) return null;
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
  if (solid) colliders.push({ x, z, hw: info.w * shrink / 2, hd: info.d * shrink / 2 });
  return info;
}
const front = (b, gap = 0.6) => ({ x: b.x, z: b.z + b.d / 2 + gap });   // 건물 정면(남쪽) 문 앞

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
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  return m;
}

/* ── 캐릭터 ────────────────────────────────── */
const hero = buildChicken(); scene.add(hero.root);
const NPCS = [];
function addNPC(id, actor, x, z, ry, r = 1) {
  actor.root.position.set(x, 0, z); actor.root.rotation.y = ry; scene.add(actor.root);
  const c = { x, z, hw: 0.45 * r, hd: 0.45 * r }; colliders.push(c);
  const n = { id, actor, x, z, ry, r, kind: 'npc' }; NPCS.push(n); return n;
}

/* ── 세계 ──────────────────────────────────── */
// 구역: 마을 x∈[-26,26], 시내 x∈[26,80], 회의실·강가 x∈[80,134]
const ZONE_X = [-26, 26, 80, 134];
const TH = {};      // 상호작용 대상 id → {kind,x,z,...}
const gates = [];   // {x, need, collider, mesh, locked}
function buildWorld() {
  // 땅
  plane(160, 60, grass([30, 11]), 54, 0, 0);
  plane(54, 30, pavement([14, 8]), 53, -1, 0.006);
  plane(58, 3.6, dirt([14, 1.2]), 0, 2.2);
  plane(56, 3.6, dirt([14, 1.2]), 107, 2.2);
  // 연못
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), waterMat(true));
  pond.rotation.x = -Math.PI / 2; pond.position.set(-1.5, 0.02, 6.6); pond.scale.set(1.4, 1, 1); scene.add(pond);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.12, 8, 40), toon(0xb9b2a4, { env: true }));
  rim.rotation.x = Math.PI / 2; rim.position.copy(pond.position); rim.scale.set(1.4, 1, 1); addOutline(rim, 0.015); scene.add(rim);
  colliders.push({ x: -1.5, z: 6.6, hw: 2.5, hd: 1.7 });
  flowers(-26, 26, 1); flowers(80, 134, 2);

  /* 1) 마을 */
  place('home', -8.5, -6.2, { h: 4.8 });
  const market = place('market', 8, -6.4, { h: 5.0 });
  place('well', -1.6, -4.4, { h: 2.1 });
  place('windmill', -19, -9, { h: 8.5 });
  place('home2', 18.5, -8.6, { h: 4.4, ry: -0.3 });
  place('tavern', -21.5, 4, { h: 4.6, ry: 1.2 });
  [[-13.5, -2.8], [-14.5, 6.5], [13.5, -2.4], [14.5, 7], [3, -10], [-4, -10.5], [10, 9.8], [-9.5, 10], [21, 7.5], [-20.5, -1.5], [-6.5, 8.5], [6.5, 8.6]]
    .forEach(([x, z], i) => place(['tree_single_A', 'tree_single_B', 'trees_B_small'][i % 3], x, z, { h: 3.6 + (i % 3) * 0.6, ry: i, shrink: 0.3 }));
  place('trees_A_medium', -23, -12, { h: 5, shrink: 0.5 }); place('trees_A_medium', 23, -12.5, { h: 5, shrink: 0.5 });
  [[-4.5, 0.5], [4.5, 0.5], [-12.5, 0.5], [12.5, 0.5], [20, 0.5], [-20, 0.5]].forEach(([x, z]) => place('streetlight', x, z, { h: 2.8, shrink: 0.25 }));
  place('bench', -15.5, 4.4, { h: 0.95, ry: Math.PI / 2 }); place('bench', 16.5, 4.6, { h: 0.95, ry: -Math.PI / 2 });
  [[4.3, -3.4], [11.4, -3.6]].forEach(([x, z]) => place('crate_carrots', x, z, { h: 0.85 }));
  place('crate_tomatoes', 12.6, -3.3, { h: 0.85 }); place('crate_lettuce', 3.2, -3.6, { h: 0.85 });
  [[-11.6, -3.4], [-5.4, -3.6], [-12.8, -2.2]].forEach(([x, z]) => place('bush', x, z, { h: 1.1, shrink: 0.6 }));
  place('barrel', -11.8, -1.3, { h: 0.95 }); place('crate_A_small', 13.4, -1.8, { h: 0.8 }); place('crate_A_big', 14.2, -2.6, { h: 1.0 });
  place('rock_single_A', 1.6, 9.2, { h: 0.9 }); place('rock_single_C', -4.6, 8.0, { h: 0.7 });
  for (let x = -24; x <= 22; x += 2.2) place('fence_wood_straight', x, -13.4, { h: 1.1, shrink: 1, occl: false });
  const mf = front(market, 0.2);
  TH.martDoor = { id: 'martDoor', kind: 'door', x: mf.x, z: mf.z, label: '동네 마트', chapter: 0, needFlags: ['talkedMom'], lockedDlg: 'lockedMartDoor' };
  const mom = addNPC('mom', buildChicken({ cap: false, apron: 0x58a14a, pocket: 0x3f7f35, pencil: false, size: 1.18, combColor: 0xe84a3a }), -3.4, -1.4, 0.35, 1.15);
  const baby = addNPC('baby', buildChicken({ body: 0xffdf4a, cap: false, apron: null, size: 0.62, chick: true, beakColor: 0xf08a1e }), -2.2, -0.9, -0.4, 0.7);
  Object.assign(mom, { dlg: 'mom', setFlag: 'talkedMom', labelY: 2.15 }); Object.assign(baby, { dlg: 'baby', labelY: 1.3 });

  /* 마을 → 시내 문 */
  addGate(25.6, 1, 'lockedGate1');

  /* 2) 시내: 도로·빌딩·불꽃식품 */
  const roadP = protos.road_straight;
  if (roadP) { const s = 3.6 / roadP.size.z; for (let x = 27.2; x < 80; x += roadP.size.x * s) place('road_straight', x, 2.2, { s, solid: false, outline: 0, occl: false }); }
  place('building_A', 31, -8.5, { h: 7, ry: 0 });
  place('building_B', 39, -8.8, { h: 8.5 });
  const factory = buildFactory(52, -8.6);
  place('building_D', 64.5, -8.6, { h: 7.5 });
  place('building_F', 73, -8.4, { h: 6.5 });
  place('watertower', 58, -14.5, { h: 7.5 });
  place('building_H', 33, 11.2, { h: 6, ry: Math.PI });
  place('building_A', 70.5, 11.4, { h: 6.5, ry: Math.PI });
  // 불꽃식품 간판(정면 위)
  const ff = front(factory, 0.3);
  TH.factoryDoor = { id: 'factoryDoor', kind: 'door', x: ff.x, z: ff.z, label: '불꽃식품 공장', chapter: 1, needFlags: ['talkedBoss'], lockedDlg: 'lockedFactoryDoor' };
  [[30, 5.0, 'car_sedan', 0], [44, 5.0, 'car_taxi', Math.PI], [61, 5.0, 'car_hatchback', 0], [74, 5.0, 'car_stationwagon', Math.PI]]
    .forEach(([x, z, n, ry]) => place(n, x, z, { h: 1.15, ry: ry + Math.PI / 2, shrink: 0.85 }));
  [[29, 0.2], [37, 0.2], [45, 0.2], [59, 0.2], [67, 0.2], [76, 0.2], [33, 4.2], [49, 4.2], [63, 4.2], [77, 4.2]].forEach(([x, z]) => place('streetlight', x, z, { h: 3.0, shrink: 0.25, ry: z > 2 ? Math.PI : 0 }));
  place('trafficlight_A', 46.5, 0.0, { h: 3.2, shrink: 0.2 });
  place('firehydrant', 47.6, -2.2, { h: 0.7 }); place('trash_A', 57.6, -2.6, { h: 0.8 }); place('dumpster', 44.5, -3.4, { h: 1.3, ry: 0.2 });
  [[35, -3.2], [42, -3.4], [60, -3.2], [69, -3.2]].forEach(([x, z]) => place('bush', x, z, { h: 1.0, shrink: 0.6 }));
  [[48.5, -4.8], [55.5, -4.8], [49.8, -5.4]].forEach(([x, z], i) => place(i === 2 ? 'crate_A_big' : 'box', x, z, { h: 0.9 }));
  const boss = addNPC('boss', buildCritter('raccoon', { outfit: 'boss', size: 1.12 }), 54.6, -2.2, -0.3, 1.1);
  const bear = addNPC('bear', buildCritter('bear', { outfit: 'cap' }), 40, -1.2, 0.4);
  const bunny = addNPC('bunny', buildCritter('bunny', { outfit: 'cap' }), 42, -1.6, -0.3);
  Object.assign(boss, { dlg: 'boss', setFlag: 'talkedBoss', labelY: 2.3 });
  Object.assign(bear, { dlg: 'bear', labelY: 2.0 }); Object.assign(bunny, { dlg: 'bunny', labelY: 2.4 });

  /* 시내 → 회의실·강가 문 */
  addGate(79.6, 2, 'lockedGate2');

  /* 3) 회의실·강가 */
  const meet = place('building_G', 92, -8, { h: 7 });
  const ms = signPlane('회의실', 3.4, 1.0, { size: 84, fg: '#2c3e7a' });
  ms.position.set(meet.x, 3.6, meet.z + meet.d / 2 + 0.06); scene.add(ms);
  const mf2 = front(meet, 0.3);
  TH.meetDoor = { id: 'meetDoor', kind: 'door', x: mf2.x, z: mf2.z, label: '회의실', chapter: 2, needFlags: ['seeFox', 'seeAd', 'seeRiver'], lockedDlg: 'lockedMeetDoor' };
  // 광고판: 기둥 + 판 + 원문 광고 문구
  const bx = 112, bz = -5.2;
  const postMat = toon(0x8a5a36, { env: true });
  [-1.6, 1.6].forEach((o) => { const pst = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 0.22), postMat); pst.position.set(bx + o, 1.3, bz); pst.castShadow = true; addOutline(pst, 0.02); scene.add(pst); });
  const board = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 0.2), toon(0xfff8ec, { env: true })); board.position.set(bx, 3.3, bz); board.castShadow = true; addOutline(board, 0.025); scene.add(board);
  const adFace = signPlane("채소가 가득한\n건강한 라면!", 4.1, 1.95, { size: 70, fg: '#2f7d32', bg: '#fffdf2', border: '#c9a24a' });
  adFace.position.set(bx, 3.3, bz + 0.11); scene.add(adFace);
  colliders.push({ x: bx, z: bz, hw: 2.0, hd: 0.4 });
  TH.ad = { id: 'ad', kind: 'look', x: bx, z: bz + 1.2, label: '광고판', dlg: 'ad', setFlag: 'seeAd', labelY: 4.9 };
  // 강 + 배수관
  const river = new THREE.Mesh(new THREE.PlaneGeometry(56, 4.2, 1, 1), waterMat(false, 0.73));
  river.rotation.x = -Math.PI / 2; river.position.set(107, 0.025, 10.4); scene.add(river);
  plane(56, 0.6, dirt([14, 0.3]), 107, 8.1, 0.02);
  colliders.push({ x: 107, z: 11, hw: 28, hd: 2.4 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.2, 16), toon(0x8d939a, { env: true }));
  pipe.rotation.x = Math.PI / 2; pipe.position.set(118, 0.35, 7.6); pipe.castShadow = true; addOutline(pipe, 0.02); scene.add(pipe);
  TH.river = { id: 'river', kind: 'look', x: 118, z: 6.6, label: '강가', dlg: 'river', setFlag: 'seeRiver', labelY: 1.6 };
  const fox = addNPC('fox', buildCritter('fox', { outfit: 'office' }), 101, -1.6, -0.2);
  Object.assign(fox, { dlg: 'fox', setFlag: 'seeFox', labelY: 2.2 });
  [[84, -3], [100, -4], [124, -6], [128, -1], [86, 6], [125, 6.5]].forEach(([x, z], i) => place(['tree_single_A', 'tree_single_B', 'trees_B_small'][i % 3], x, z, { h: 3.8, ry: i, shrink: 0.3 }));
  place('bench', 106, 6.2, { h: 0.95, ry: Math.PI }); place('rock_single_A', 96, 7.2, { h: 0.8 });
  [[86, 0.4], [98, 0.4], [110, 0.4], [122, 0.4]].forEach(([x, z]) => place('streetlight', x, z, { h: 2.8, shrink: 0.25 }));
  for (let x = 82; x <= 132; x += 2.2) place('fence_wood_straight', x, -13.4, { h: 1.1, shrink: 1, occl: false });
  // 구름
  for (let i = 0; i < 16; i++) {
    const c = place('cloud_big', -30 + i * 11, -18 - (i % 2) * 5, { h: 2 + (i % 3), solid: false, outline: 0, occl: false });
    if (c) { c.g.position.y = 11 + (i % 3) * 1.5; c.g.userData.drift = 0.3 + (i % 3) * 0.15; clouds.push(c.g); }
  }
  // 세계 가장자리
  colliders.push({ x: 54, z: -14.6, hw: 90, hd: 1 }, { x: 54, z: 13.6, hw: 90, hd: 1 }, { x: -27, z: 0, hw: 1, hd: 20 }, { x: 135, z: 0, hw: 1, hd: 20 });
  NPCS.forEach((n) => { TH[n.id] = n; });
}
function flowers(x0, x1, seed) {
  const r = rnd(23 + seed), petal = new THREE.SphereGeometry(0.07, 8, 6);
  [0xff7aa8, 0xffd23a, 0xffffff, 0xb08cff, 0xff8a4a].forEach((c) => {
    const n = 60, im = new THREE.InstancedMesh(petal, toon(c, { env: true }), n), m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      let x, z;
      do { x = x0 + r() * (x1 - x0); z = (r() - 0.5) * 20; } while (Math.abs(z - 2.2) < 2.4 || (Math.abs(x + 1.5) < 3.2 && Math.abs(z - 6.6) < 2.4) || z > 7.6 && x > 80);
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
  sign.position.set(0, HH - 0.55, HD / 2 + 0.07); g.add(sign);
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
const HR = 0.36;
function blocked(x, z) {
  for (const c of colliders) {
    if (c.off) continue;
    const dx = Math.max(Math.abs(x - c.x) - c.hw, 0), dz = Math.max(Math.abs(z - c.z) - c.hd, 0);
    if (dx * dx + dz * dz < HR * HR) return c;
  }
  return null;
}

/* ── 상태·퀘스트 (2D 판 규칙 그대로) ───────── */
const S = { x: -8, z: 2.4, face: 0, mode: 'loading', flags: {}, progress: 0 };
const QUEST = ['mom', 'martDoor', 'gate1', 'boss', 'factoryDoor', 'gate2', 'fox', 'ad', 'river', 'meetDoor', 'notebook'];
function stepDone(id) {
  const f = S.flags;
  switch (id) {
    case 'mom': return !!f.talkedMom || S.progress > 0;
    case 'martDoor': return S.progress > 0;
    case 'gate1': return S.x > 26 || S.progress > 1;
    case 'boss': return !!f.talkedBoss || S.progress > 1;
    case 'factoryDoor': return S.progress > 1;
    case 'gate2': return S.x > 80 || S.progress > 2;
    case 'fox': return !!f.seeFox || S.progress > 2;
    case 'ad': return !!f.seeAd || S.progress > 2;
    case 'river': return !!f.seeRiver || S.progress > 2;
    case 'meetDoor': return S.progress > 2;
    default: return false;
  }
}
function questCur() { for (const id of QUEST) if (!stepDone(id)) return id; return null; }
function questTarget(id) {
  if (id === 'gate1') return { x: 26.6, z: 2.2, label: '회사 가는 길', y: 2.4 };
  if (id === 'gate2') return { x: 80.6, z: 2.2, label: '회의실 가는 길', y: 2.4 };
  if (!id || id === 'notebook') return null;
  const t = TH[id]; return t ? { x: t.x, z: t.z, label: t.label || WHO[t.id]?.name, y: t.labelY || 2.6, npc: t.kind === 'npc' } : null;
}
function doorOpen(t) { return S.progress > t.chapter || (t.needFlags || []).every((f) => S.flags[f]); }
function nearestThing() {
  let best = null, bd = 1.7;
  for (const k in TH) { const t = TH[k]; const d = Math.hypot(t.x - S.x, t.z - S.z); if (d < bd) { bd = d; best = t; } }
  return best;
}
function interact(t) {
  const cur = questCur();
  const inQuest = QUEST.includes(t.id);
  if (inQuest && cur && cur !== t.id && !stepDone(t.id) && t.kind !== 'door') {
    const ct = TH[cur] || {}, nm = ct.kind === 'npc' ? WHO[ct.id].name + '에게 말을 걸어' : (ct.label || '') + '을 살펴';
    talk([{ who: 'note', text: '먼저 ' + nm + ' 봐요.' }]); return;
  }
  if (t.kind === 'door') {
    if (!doorOpen(t)) { sfx.nope(); talk(DIALOGUE[t.lockedDlg]); return; }
    sfx.door(); enterDoor(t); return;
  }
  talk(DIALOGUE[t.dlg], () => {
    if (t.setFlag && !S.flags[t.setFlag]) { S.flags[t.setFlag] = true; EXAM.saveLocal(S); sfx.open(); }
  }, t);
}
function enterDoor(t) {
  S.mode = 'panel';
  fadeOut(() => {
    EXAM.openPanel(t.chapter, () => {
      fadeIn();
      S.mode = 'walk';
      if (S.progress === t.chapter) {
        S.progress = t.chapter + 1; EXAM.setProgress(S.progress); EXAM.saveLocal(S);
        stampPop(t.chapter);
        const nx = ['after1', 'after2', 'after3'][t.chapter];
        talk(DIALOGUE[nx], () => { if (t.chapter === 2) openNotebook(); });
      }
    });
  });
}
function openNotebook() { if (S.mode !== 'walk') return; S.mode = 'panel'; EXAM.openNotebook(S.progress, () => { S.mode = 'walk'; }, () => { S.mode = 'end'; }); }

/* ── 대화 ──────────────────────────────────── */
const D = { lines: null, i: 0, typed: 0, full: '', timer: 0, done: null, npc: null };
const talkQueue = [];
function talk(lines, done, npc) {
  if (!lines || !lines.length) { done && done(); return; }
  if (S.mode !== 'walk') { talkQueue.push([lines, done, npc]); return; }
  Object.assign(D, { lines, i: 0, done: done || null, npc: npc || null });
  S.mode = 'talk'; $('letterbox').classList.add('on'); $('dialogue').classList.remove('hide');
  if (npc && npc.actor) {
    const toward = (a, b) => Math.atan2(b.x - a.x, b.z - a.z), mix = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
    S.face = mix(toward(S, npc), 0, 0.5); npc.actor.root.rotation.y = mix(toward(npc, S), 0, 0.55);
  }
  showLine();
}
function speakerActor(who) { if (who === 'kkokko') return hero; const n = NPCS.find((n) => n.id === who); return n ? n.actor : null; }
function showLine() {
  const L = D.lines[D.i];
  $('dlg-name').textContent = WHO[L.who].name;
  $('dlg-face').innerHTML = ''; if (portraits[L.who]) $('dlg-face').appendChild(portraits[L.who].cloneNode());
  NPCS.forEach((n) => n.actor.setTalk(false)); hero.setTalk(false);
  const a = speakerActor(L.who); if (a) { a.setTalk(true); a.setMood(L.face || 'happy'); }
  if (L.who === 'kkokko') hero.setMood(L.face || '');
  D.full = L.text; D.typed = 0; clearInterval(D.timer);
  D.timer = setInterval(() => {
    D.typed++; $('dlg-text').textContent = D.full.slice(0, D.typed);
    if (D.typed % 3 === 1) sfx.blip();
    if (D.typed >= D.full.length) { clearInterval(D.timer); a && a.setTalk(false); }
  }, 32);
}
function advance() {
  if (D.typed < D.full.length) { clearInterval(D.timer); D.typed = D.full.length; $('dlg-text').textContent = D.full; NPCS.forEach((n) => n.actor.setTalk(false)); hero.setTalk(false); return; }
  D.i++;
  if (D.i < D.lines.length) { showLine(); return; }
  NPCS.forEach((n) => { n.actor.setTalk(false); n.actor.setMood(''); }); hero.setTalk(false); hero.setMood('');
  S.mode = 'walk'; $('letterbox').classList.remove('on'); $('dialogue').classList.add('hide');
  const cb = D.done; D.done = null; cb && cb();
  if (S.mode === 'walk' && talkQueue.length) { const q = talkQueue.shift(); talk(q[0], q[1], q[2]); }
}

/* ── 오프닝 컷신 ───────────────────────────── */
function playOpening(done) {
  S.mode = 'comic'; let i = 0;
  const box = $('comic'), img = $('comic-img'), txt = $('comic-text');
  box.classList.remove('hide');
  let typed = 0, full = '', timer = 0;
  function show() {
    const c = OPENING[i]; img.classList.remove('in'); void img.offsetWidth;
    img.src = c.img; img.classList.add('in'); full = c.text; typed = 0; clearInterval(timer);
    timer = setInterval(() => { typed++; txt.textContent = full.slice(0, typed); if (typed % 3 === 1) sfx.blip(); if (typed >= full.length) clearInterval(timer); }, 38);
    $('comic-page').textContent = (i + 1) + ' / ' + OPENING.length;
  }
  function next() {
    if (typed < full.length) { clearInterval(timer); typed = full.length; txt.textContent = full; return; }
    i++; if (i < OPENING.length) { show(); return; }
    removeEventListener('keydown', onKey, true); box.classList.add('hide'); done();
  }
  function onKey(e) { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); e.stopPropagation(); audioUnlock(); next(); } }
  addEventListener('keydown', onKey, true);
  $('comic-skip').onclick = () => { i = OPENING.length; typed = full.length; next(); };
  show();
}

/* ── 초상화 ────────────────────────────────── */
const portraits = {};
function makePortraits() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(200, 200); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0xd8c8a8, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 3, 4); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  const list = [['kkokko', buildChicken()], ['mom', buildChicken({ cap: false, apron: 0x58a14a, pocket: 0x3f7f35, pencil: false, combColor: 0xe84a3a })],
    ['baby', buildChicken({ body: 0xffdf4a, cap: false, apron: null, chick: true, beakColor: 0xf08a1e })],
    ['boss', buildCritter('raccoon', { outfit: 'boss' })], ['bear', buildCritter('bear', { outfit: 'cap' })],
    ['bunny', buildCritter('bunny', { outfit: 'cap' })], ['fox', buildCritter('fox', { outfit: 'office' })]];
  for (const [id, a] of list) {
    sc.add(a.root); a.setMood(id === 'boss' ? '' : 'happy'); a.update(0.016, {});
    cam.position.set(0.35, 1.2, 2.3); cam.lookAt(0, 0.88, 0); r.render(sc, cam);
    const img = new Image(); img.src = r.domElement.toDataURL(); img.style.width = '100%'; img.style.height = '100%';
    portraits[id] = img; sc.remove(a.root);
  }
  portraits.note = portraits.kkokko;
  r.dispose();
}

/* ── 효과·소리 ─────────────────────────────── */
const dusts = [];
const dustMap = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
function puff(x, z, n = 1) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustMap, transparent: true, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, r = n > 1 ? 0.25 : 0;
    s.position.set(x + Math.cos(a) * r, 0.12, z + Math.sin(a) * r); s.scale.setScalar(0.35);
    s.userData = { life: 0.55, vx: Math.cos(a) * (n > 1 ? 1.2 : 0.2), vz: Math.sin(a) * (n > 1 ? 1.2 : 0.2) };
    scene.add(s); dusts.push(s);
  }
}
let AC = null, master = null, musicGain = null;
function audioUnlock() {
  if (AC) return;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination); startMusic(); } catch (e) {}
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
let zoneShown = -1;
function zoneBanner(z) {
  const names = ['꼬꼬네 마을', '시내 · 불꽃식품', '회사 뒤 회의실과 강가'];
  const b = $('zone-banner'); b.innerHTML = '<span class="zb-ch">' + (z + 1) + '장</span>' + names[z];
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
const tmpV = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V1 = new THREE.Vector3();
function toScreen(x, y, z) { tmpV.set(x, y, z).project(camera); return [(tmpV.x * 0.5 + 0.5) * innerWidth, (-tmpV.y * 0.5 + 0.5) * innerHeight, tmpV.z]; }
let navT = 0, lastQuest = '';
function updateNav(dt) {
  navT += dt;
  const cur = questCur();
  if (cur !== lastQuest) { lastQuest = cur; qbar.querySelector('b').textContent = QUEST_TEXT[cur] || ''; qbar.classList.remove('pop'); void qbar.offsetWidth; qbar.classList.add('pop'); }
  qbar.style.display = (S.mode === 'walk' || S.mode === 'talk') && cur ? '' : 'none';
  const tg = (S.mode === 'walk') ? questTarget(cur) : null;
  // 3D 화살표
  arrow.visible = !!tg;
  if (tg) { arrow.position.set(tg.x, tg.y + 0.6 + Math.sin(navT * 4) * 0.22, tg.z); arrow.rotation.y += dt * 2.2; }
  // 이름표
  if (tg) { const [sx, sy, sz] = toScreen(tg.x, tg.y + 1.5, tg.z); labelEl.textContent = tg.label || ''; labelEl.style.left = sx + 'px'; labelEl.style.top = sy + 'px'; labelEl.style.display = sz < 1 ? '' : 'none'; }
  else labelEl.style.display = 'none';
  // 화면 밖이면 가장자리 화살표
  if (tg) {
    const [sx, sy, sz] = toScreen(tg.x, tg.y, tg.z), m = 70;
    const off = sz > 1 || sx < m || sx > innerWidth - m || sy < m || sy > innerHeight - m;
    if (off) {
      const cx = innerWidth / 2, cy = innerHeight / 2; let dx = sx - cx, dy = sy - cy; if (sz > 1) { dx = -dx; dy = -dy; }
      const k = Math.min((cx - m) / Math.abs(dx || 1), (cy - m) / Math.abs(dy || 1));
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
    const zHero = S.x < 26 ? 0 : S.x < 80 ? 1 : 2, zT = tg.x < 26 ? 0 : tg.x < 80 ? 1 : 2;
    if (zT > zHero) pts.push([zHero === 0 ? 24.5 : 78.5, 2.2], [zHero === 0 ? 27 : 81, 2.2]);
    else if (Math.abs(tg.z - 2.2) > 3 && Math.abs(S.z - 2.2) > 3) pts.push([S.x, 2.2]);
    if (Math.abs(tg.x - S.x) > 6 && !(zT > zHero)) pts.push([tg.x, 2.2]);
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
  const t = S.mode === 'walk' ? nearestThing() : null;
  if (t) {
    const ty = t.kind === 'npc' ? (t.labelY || 2) - 0.2 : t.kind === 'door' ? 2.2 : (t.labelY || 1.4) - 0.6;
    const [px, py] = toScreen(t.x, ty, t.z);
    prompt.textContent = t.kind === 'npc' ? 'Space 말 걸기' : t.kind === 'door' ? (doorOpen(t) ? 'Space 들어가기' : '🔒 Space') : 'Space 살펴보기';
    prompt.style.left = px + 'px'; prompt.style.top = py + 'px'; prompt.style.display = '';
  } else prompt.style.display = 'none';
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
const J = { on: false, pre: 0, z: 0, vz: 0, dbl: false, spin: 0, land: 0 };
const GRAV = 26, V0 = 8.2, V2 = 6.4;
function jump() {
  if (!J.on) { Object.assign(J, { on: true, pre: 0.06, z: 0, vz: 0, dbl: false, spin: 0 }); return; }
  if (!J.dbl && J.pre <= 0) { J.dbl = true; J.vz = V2; J.spin = 0.0001; sfx.jump2(); puff(S.x, S.z, 6); }
}
addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (S.mode === 'panel' || S.mode === 'end' || S.mode === 'start') return;   // 시험 화면은 exam.js가 처리
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  audioUnlock();
  if (S.mode === 'talk') { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) advance(); return; }
  if (S.mode !== 'walk') return;
  if (e.code === 'Escape') { openNotebook(); return; }
  if (e.code === 'Space' && !e.repeat) { const t = nearestThing(); if (t) interact(t); else jump(); return; }
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

/* ── 루프 ──────────────────────────────────── */
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tv = new THREE.Vector3(), tl = new THREE.Vector3();
let stepT = 0, fpsT = 0, fpsN = 0, lowT = 0, gateCool = 0;
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  let moving = false;
  gateCool -= dt;
  if (S.mode === 'walk') {
    let dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    let dz = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    if (dx || dz) {
      const l = Math.hypot(dx, dz); dx /= l; dz /= l; moving = true;
      const sp = 4.6 * dt, nx = S.x + dx * sp, nz = S.z + dz * sp;
      const bx = blocked(nx, S.z); if (!bx) S.x = nx; else hitGate(bx);
      const bz = blocked(S.x, nz); if (!bz) S.z = nz;
      S.face = Math.atan2(dx, dz);
      stepT += dt; if (stepT > 0.18 && !J.on) { stepT = 0; puff(S.x - dx * 0.3, S.z - dz * 0.3, 1); sfx.step(); }
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
  if (J.on) {
    if (J.pre > 0) { J.pre -= dt; sy = 0.8; sx = 1.15; if (J.pre <= 0) { J.vz = V0; sfx.jump(); } }
    else {
      J.vz -= GRAV * dt; J.z += J.vz * dt;
      const v = J.vz / V0; sy = 1 + Math.max(-0.06, Math.min(0.15, v * 0.15)); sx = 1 - (sy - 1) * 0.6;
      if (J.spin) J.spin = Math.min(1, J.spin + dt / 0.45);
      if (J.z <= 0) { J.z = 0; J.on = false; J.spin = 0; J.land = 0.14; puff(S.x, S.z, 8); sfx.land(); }
    }
  }
  if (J.land > 0) { J.land -= dt; sy *= 0.78; sx *= 1.2; }
  hero.root.position.set(S.x, 0, S.z);
  let dy = S.face - hero.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  hero.root.rotation.y += dy * Math.min(1, dt * 12);
  hero.update(dt, { moving, jumping: J.on && J.pre <= 0, sx, sy, lift: J.z, spin: J.spin * Math.PI * 2 });
  for (const n of NPCS) if (Math.abs(n.x - S.x) < 30) n.actor.update(dt, {});
  // 구역 배너
  const z = S.x < 26 ? 0 : S.x < 80 ? 1 : 2; if (z !== zoneShown && S.mode !== 'loading') { zoneShown = z; zoneBanner(z); }
  // 해·카메라
  sun.position.set(S.x + 9, 16, S.z + 7); sun.target.position.set(S.x, 0, S.z);
  const close = S.mode === 'talk' ? 0.72 : 1;
  camLook.lerp(tl.set(S.x, 0.7 + J.z * 0.25, S.z), Math.min(1, dt * 6));
  camPos.lerp(tv.set(S.x + CAM_OFF.x, CAM_OFF.y * close, S.z + CAM_OFF.z * close), Math.min(1, dt * 4));
  camera.position.copy(camPos); camera.lookAt(camLook);
  waterUniform.value += dt;
  for (const c of clouds) { c.position.x += c.userData.drift * dt; if (c.position.x > 150) c.position.x = -40; }
  for (let i = dusts.length - 1; i >= 0; i--) {
    const s = dusts[i]; s.userData.life -= dt;
    s.position.x += s.userData.vx * dt; s.position.z += s.userData.vz * dt; s.position.y += dt * 0.5;
    s.scale.setScalar(0.35 + (0.55 - s.userData.life) * 1.4); s.material.opacity = Math.max(0, s.userData.life / 0.55);
    if (s.userData.life <= 0) { scene.remove(s); s.material.dispose(); dusts.splice(i, 1); }
  }
  updateOccluders(dt);
  updateSmoke(dt);
  updateNav(dt);
  composer.render();
  fpsT += dt; fpsN++;
  if (fpsT > 1) {
    const fps = fpsN / fpsT; $('fps').textContent = Math.round(fps) + ' fps';
    if (fps < 40) { if (++lowT > 2 && PR > 0.7) { PR = Math.max(0.7, PR - 0.15); renderer.setPixelRatio(PR); resize(); lowT = 0; } } else lowT = 0;
    window.__kk.fps = fps; fpsT = 0; fpsN = 0;
  }
  requestAnimationFrame(loop);
}
function hitGate(c) {
  const g = gates.find((g) => g.col === c); if (!g || g.open || gateCool > 0) return;
  gateCool = 1.4; sfx.nope(); talk(DIALOGUE[g.lockedDlg]);
}

window.__kk = { S, J, NPCS, TH, gates, occluders, questCur, fps: 0 };
(async function init() {
  await loadAll();
  buildWorld();
  makePortraits();
  renderer.compile(scene, camera);
  $('loading').classList.add('done');
  EXAM.init({
    onStart: (st) => {                       // 반·번호·이름 등록 뒤
      S.progress = st.progress; Object.assign(S.flags, st.flags || {});
      if (S.progress >= 1) S.flags.talkedMom = true;
      if (S.progress >= 2) S.flags.talkedBoss = true;
      if (S.progress >= 3) S.flags.seeFox = S.flags.seeAd = S.flags.seeRiver = true;
      const startX = [-8, 30, 84][Math.min(S.progress, 2)];
      S.x = startX; S.z = 2.4;
      camPos.set(S.x + CAM_OFF.x, CAM_OFF.y, S.z + CAM_OFF.z); camLook.set(S.x, 0.7, S.z);
      $('hud').classList.remove('hide'); $('hud-who').textContent = st.who; renderHUD();
      const go = () => { S.mode = 'walk'; zoneShown = -1; if (S.progress >= 3) openNotebook(); };
      if (st.fresh) playOpening(go); else go();
    },
    getFlags: () => S.flags,
    onEnd: () => { S.mode = 'end'; },
  });
  S.mode = 'start';
  camPos.set(S.x + CAM_OFF.x, CAM_OFF.y, S.z + CAM_OFF.z); camLook.set(S.x, 0.7, S.z);
  loop();
})();
