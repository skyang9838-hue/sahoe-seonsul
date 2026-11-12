// 꼬꼬와 동물 친구들을 도형으로 빚는다. 키 약 1.2(월드 단위), 정면 +Z, 발바닥 y=0.
import * as THREE from 'three';
import { toon, addOutline } from './toon.js?v=7';

const OL = 0.028;
function mesh(geo, mat, { outline = true, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow; m.receiveShadow = false;
  if (outline) addOutline(m, OL);
  return m;
}
const sph = (r, ws = 28, hs = 20) => new THREE.SphereGeometry(r, ws, hs);

function starShape(R, r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
    const x = Math.cos(a) * rad, y = -Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

// 눈: 검은 눈동자 + 흰 하이라이트 두 개. 깜빡임은 y 크기로.
function makeEye(size = 0.062) {
  const g = new THREE.Group();
  const pupil = mesh(sph(size, 20, 14), toon(0x2b1b14), { outline: false, shadow: false });
  pupil.scale.set(0.85, 1.05, 0.55);
  const hi = mesh(sph(size * 0.36, 12, 8), toon(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), { outline: false, shadow: false });
  hi.position.set(size * 0.3, size * 0.36, size * 0.5); hi.scale.setScalar(1.25);
  const hi2 = mesh(sph(size * 0.18, 10, 8), toon(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), { outline: false, shadow: false });
  hi2.position.set(-size * 0.3, -size * 0.3, size * 0.45);
  g.add(pupil, hi, hi2);
  return g;
}

/**
 * 닭 계열 캐릭터.
 * opts: body(색), cap(true/false), apron(색|null), size, comb, beak
 */
export function buildChicken(opts = {}) {
  const o = Object.assign({ body: 0xffffff, cap: true, capColor: 0x5f9a4a, apron: 0xfff1d6, pocket: 0xf08a24,
    size: 1, combColor: 0xe0362b, beakColor: 0xf6a023, pencil: true, star: true, chick: false }, opts);
  const root = new THREE.Group();         // 바닥 기준, 방향 회전용
  const rig = new THREE.Group();          // 찌그러짐·기울임용
  root.add(rig);
  const W = toon(o.body), parts = {};

  // 몸통과 머리(동그란 한 덩어리 느낌으로 두 구를 겹친다)
  const body = mesh(sph(0.34), W); body.position.y = 0.36; body.scale.set(1.05, 0.95, 1); rig.add(body);
  const headPivot = new THREE.Group(); headPivot.position.y = 0.7; rig.add(headPivot);
  const head = mesh(sph(0.44), W); head.position.y = 0.2; head.scale.set(1.04, 0.96, 1); headPivot.add(head);
  parts.head = headPivot;

  // 볏
  const combMat = toon(o.combColor);
  const comb = new THREE.Group();
  [[-0.08, 0.04, 0.085], [0, 0.11, 0.1], [0.08, 0.04, 0.085]].forEach(([x, y, r]) => {
    const c = mesh(sph(r, 16, 12), combMat); c.position.set(x, y, 0); comb.add(c);
  });
  comb.position.set(0, 0.66, 0.02);
  headPivot.add(comb);

  // 얼굴
  const eyeL = makeEye(0.088), eyeR = makeEye(0.088);
  eyeL.position.set(-0.16, 0.17, 0.39); eyeR.position.set(0.16, 0.17, 0.39);
  eyeL.rotation.y = -0.32; eyeR.rotation.y = 0.32;
  headPivot.add(eyeL, eyeR); parts.eyes = [eyeL, eyeR];
  const cheekMat = toon(0xff8fa3, { emissive: 0xff7f96, emissiveIntensity: 0.45 });
  [-1, 1].forEach((s) => {
    const ck = mesh(sph(0.055, 14, 10), cheekMat, { outline: false, shadow: false });
    ck.position.set(s * 0.27, 0.06, 0.34); ck.scale.set(1.6, 0.9, 0.45); headPivot.add(ck);
  });
  const beakMat = toon(o.beakColor);
  const beakTop = mesh(new THREE.ConeGeometry(0.06, 0.1, 16), beakMat);
  beakTop.rotation.x = Math.PI / 2; beakTop.position.set(0, 0.06, 0.46); beakTop.scale.set(1.3, 1, 0.7);
  const beakBot = mesh(new THREE.ConeGeometry(0.048, 0.07, 16), beakMat);
  beakBot.rotation.x = Math.PI / 2; beakBot.position.set(0, 0.015, 0.445); beakBot.scale.set(1.2, 1, 0.6);
  headPivot.add(beakTop, beakBot); parts.beakBot = beakBot;

  // 작업모 + 노란 별
  if (o.cap) {
    const capMat = toon(o.capColor);
    const capGeo = new THREE.SphereGeometry(0.455, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = mesh(capGeo, capMat); cap.position.y = 0.33; cap.scale.set(1.0, 0.62, 1.0); headPivot.add(cap);
    const brim = mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.04, 24, 1, false, -Math.PI / 2, Math.PI), capMat);
    brim.position.set(0, 0.33, 0.3); brim.scale.set(1.3, 1, 1.1); headPivot.add(brim);
    const seam = mesh(new THREE.TorusGeometry(0.456, 0.012, 6, 40), toon(0x467a37), { outline: false });
    seam.rotation.x = Math.PI / 2; seam.position.y = 0.335; headPivot.add(seam);
    if (o.star) {
      const star = mesh(new THREE.ExtrudeGeometry(starShape(0.075, 0.033), { depth: 0.025, bevelEnabled: false }),
        toon(0xffd23a, { emissive: 0xffc400, emissiveIntensity: 0.35 }));
      star.position.set(0, 0.5, 0.33); star.rotation.x = -0.65; headPivot.add(star);
    }
    comb.position.set(0, 0.66, -0.12); comb.scale.setScalar(0.9);
  }

  // 날개
  const wings = [];
  [-1, 1].forEach((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.32, 0.44, 0.02);
    const w = mesh(sph(0.16, 20, 14), W); w.scale.set(0.45, 0.85, 0.75); w.position.set(s * 0.04, -0.08, 0);
    pivot.add(w); rig.add(pivot); wings.push(pivot);
  });
  parts.wings = wings;

  // 꼬리 깃털
  const tail = new THREE.Group(); tail.position.set(0, 0.46, -0.3); tail.scale.setScalar(0.8);
  [-0.12, 0, 0.12].forEach((x, i) => {
    const f = mesh(new THREE.ConeGeometry(0.07, 0.26, 12), W);
    f.position.set(x, 0.05 + (i === 1 ? 0.04 : 0), 0); f.rotation.set(-0.9, 0, x * -2.2); tail.add(f);
  });
  rig.add(tail); parts.tail = tail;

  // 앞치마 + 주머니 + 연필
  if (o.apron) {
    const apMat = toon(o.apron, { side: THREE.DoubleSide });
    const ap = mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.34, 24, 1, true, -1.05, 2.1), apMat);
    ap.position.y = 0.32; rig.add(ap);
    [-1, 1].forEach((s) => {
      const st = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), apMat);
      st.position.set(s * 0.15, 0.55, 0.3); st.rotation.x = -0.4; st.scale.set(1, 0.7, 1); rig.add(st);
      const btn = mesh(sph(0.025, 10, 8), toon(0xa86b3c), { outline: false });
      btn.position.set(s * 0.15, 0.48, 0.355); rig.add(btn);
    });
    const pk = mesh(new THREE.BoxGeometry(0.2, 0.14, 0.03), toon(o.pocket));
    pk.position.set(0.05, 0.28, 0.365); pk.scale.set(0.85, 0.85, 1); rig.add(pk);
    if (o.pencil) {
      const pencil = new THREE.Group();
      const pb = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8), toon(0xffcc33)); pencil.add(pb);
      const tip = mesh(new THREE.ConeGeometry(0.016, 0.04, 8), toon(0xf2d3a8)); tip.position.y = 0.1; pencil.add(tip);
      const er = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.03, 8), toon(0xf08aa0)); er.position.y = -0.09; pencil.add(er);
      pencil.position.set(0.09, 0.35, 0.36); pencil.rotation.z = -0.25; pencil.scale.setScalar(0.85); rig.add(pencil);
    }
  }

  // 다리·발
  const legs = [];
  const legMat = toon(0xf39a1e);
  [-1, 1].forEach((s) => {
    const leg = new THREE.Group(); leg.position.set(s * 0.12, 0.09, 0.02);
    const shin = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), legMat); shin.position.y = -0.01; leg.add(shin);
    const foot = mesh(sph(0.075, 14, 10), legMat); foot.scale.set(1, 0.45, 1.3); foot.position.set(0, -0.06, 0.05); leg.add(foot);
    rig.add(leg); legs.push(leg);
  });
  parts.legs = legs;

  if (o.flower) {   // 엄마 닭 표시: 머리 옆 분홍 꽃
    const fl = new THREE.Group(), pm = toon(0xff7fb0, { emissive: 0xff6fa0, emissiveIntensity: 0.3 });
    for (let i = 0; i < 5; i++) { const pe = mesh(sph(0.075, 12, 8), pm); const a = i / 5 * Math.PI * 2; pe.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0); pe.scale.set(1, 1, 0.5); fl.add(pe); }
    const ct = mesh(sph(0.05, 10, 8), toon(0xffd23a)); ct.position.z = 0.03; fl.add(ct);
    fl.position.set(0.3, 0.5, 0.12); fl.rotation.y = 0.6; headPivot.add(fl);
  }
  if (o.chick) { comb.scale.setScalar(0.6); tail.scale.setScalar(0.6); }
  root.scale.setScalar(o.size);
  return makeActor(root, rig, parts);
}

/**
 * 네발 짐승 친구들(두 발로 서는 2등신): kind = raccoon | bear | bunny | fox
 */
export function buildCritter(kind, opts = {}) {
  let P = {
    raccoon: { fur: 0x9a9aa2, belly: 0xece6dc, ear: 'round', tail: 'ring', mask: true },
    bear:    { fur: 0xa8714a, belly: 0xf0d2a8, ear: 'round', tail: 'puff' },
    bunny:   { fur: 0xa9b6d6, belly: 0xf4f1ff, ear: 'long', tail: 'puff' },
    fox:     { fur: 0xf08a34, belly: 0xfff4e6, ear: 'tri', tail: 'fox' },
  }[kind];
  const o = Object.assign({ size: 1, outfit: null }, opts);
  if (o.fur) P = Object.assign({}, P, { fur: o.fur });
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const F = toon(P.fur), B = toon(P.belly), parts = {};
  const body = mesh(sph(0.34), F); body.position.y = 0.36; body.scale.set(1.05, 0.95, 0.98); rig.add(body);
  const belly = mesh(sph(0.26), B, { outline: false }); belly.position.set(0, 0.33, 0.13); belly.scale.set(1, 1.05, 0.7); rig.add(belly);
  const headPivot = new THREE.Group(); headPivot.position.y = 0.7; rig.add(headPivot); parts.head = headPivot;
  const head = mesh(sph(0.43), F); head.position.y = 0.2; head.scale.set(1.08, 0.95, 1); headPivot.add(head);
  // 주둥이·코·입
  const muz = mesh(sph(0.16, 20, 14), B); muz.position.set(0, 0.08, 0.36); muz.scale.set(1.25, 0.8, 0.75); headPivot.add(muz);
  const nose = mesh(sph(0.05, 12, 10), toon(0x2b1b14), { outline: false }); nose.position.set(0, 0.14, 0.47); nose.scale.set(1.3, 0.9, 0.8); headPivot.add(nose);
  const mouth = mesh(sph(0.032, 10, 8), toon(0x6a2a2a), { outline: false }); mouth.position.set(0, 0.04, 0.46); mouth.scale.set(1.4, 0.6, 0.5); headPivot.add(mouth);
  parts.mouth = mouth;
  // 눈(너구리는 눈가 무늬)
  const eyeL = makeEye(0.08), eyeR = makeEye(0.08);
  eyeL.position.set(-0.16, 0.24, 0.37); eyeR.position.set(0.16, 0.24, 0.37);
  eyeL.rotation.y = -0.32; eyeR.rotation.y = 0.32; headPivot.add(eyeL, eyeR); parts.eyes = [eyeL, eyeR];
  if (P.mask) [-1, 1].forEach((s) => {
    const m = mesh(sph(0.11, 16, 12), toon(0x4a4650), { outline: false }); m.position.set(s * 0.16, 0.23, 0.33); m.scale.set(1.25, 0.9, 0.45); headPivot.add(m);
  });
  const cheekMat = toon(0xff8fa3, { emissive: 0xff7f96, emissiveIntensity: 0.4 });
  [-1, 1].forEach((s) => { const ck = mesh(sph(0.05, 12, 8), cheekMat, { outline: false, shadow: false }); ck.position.set(s * 0.27, 0.08, 0.33); ck.scale.set(1.5, 0.85, 0.45); headPivot.add(ck); });
  // 귀
  [-1, 1].forEach((s) => {
    let e;
    if (P.ear === 'round') { e = mesh(sph(0.12, 16, 12), F); e.position.set(s * 0.3, 0.55, -0.02); e.scale.set(1, 1, 0.6); }
    else if (P.ear === 'long') { e = mesh(sph(0.1, 16, 12), F); e.position.set(s * 0.14, 0.78, -0.04); e.scale.set(0.8, 2.6, 0.55); e.rotation.z = s * -0.12; }
    else { e = mesh(new THREE.ConeGeometry(0.13, 0.28, 4), F); e.position.set(s * 0.25, 0.6, 0); e.rotation.z = s * -0.25; }
    headPivot.add(e);
    if (P.ear === 'long') { const inr = mesh(sph(0.06, 12, 8), toon(0xffb7c8), { outline: false }); inr.position.set(s * 0.14, 0.78, 0.02); inr.scale.set(0.7, 2.3, 0.4); inr.rotation.z = s * -0.12; headPivot.add(inr); }
  });
  // 팔(짧은 앞발)
  const arms = [];
  [-1, 1].forEach((s) => {
    const pv = new THREE.Group(); pv.position.set(s * 0.31, 0.46, 0.04);
    const a = mesh(sph(0.1, 14, 10), F); a.scale.set(0.8, 1.2, 0.8); a.position.set(s * 0.03, -0.1, 0); pv.add(a);
    rig.add(pv); arms.push(pv);
  });
  parts.wings = arms;
  // 꼬리
  const tail = new THREE.Group(); tail.position.set(0, 0.28, -0.3);
  if (P.tail === 'puff') { const t = mesh(sph(0.1, 14, 10), P === undefined ? F : (kind === 'bunny' ? toon(0xffffff) : F)); tail.add(t); }
  else if (P.tail === 'fox') { const t = mesh(new THREE.ConeGeometry(0.14, 0.5, 14), F); t.rotation.x = -1.9; t.position.set(0, 0.1, -0.12); tail.add(t); const tip = mesh(sph(0.08, 12, 8), toon(0xfff4e6)); tip.position.set(0, 0.0, -0.36); tail.add(tip); }
  else { for (let i = 0; i < 4; i++) { const r = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 12), toon(i % 2 ? 0x4a4650 : P.fur)); r.position.set(0, 0.05 + i * 0.06, -0.05 - i * 0.07); r.rotation.x = -0.9; tail.add(r); } }
  rig.add(tail); parts.tail = tail;
  // 다리
  const legs = [];
  [-1, 1].forEach((s) => {
    const leg = new THREE.Group(); leg.position.set(s * 0.13, 0.09, 0.02);
    const foot = mesh(sph(0.085, 14, 10), F); foot.scale.set(1, 0.6, 1.25); foot.position.set(0, -0.05, 0.04); leg.add(foot);
    rig.add(leg); legs.push(leg);
  });
  parts.legs = legs;
  // 옷차림
  if (o.outfit === 'cap') {
    const capMat = toon(0x5f9a4a);
    const cap = mesh(new THREE.SphereGeometry(0.445, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), capMat); cap.position.y = 0.33; cap.scale.set(1.05, 0.6, 1.0); headPivot.add(cap);
    const brim = mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.04, 24, 1, false, -Math.PI / 2, Math.PI), capMat); brim.position.set(0, 0.33, 0.3); brim.scale.set(1.3, 1, 1.1); headPivot.add(brim);
    const star = mesh(new THREE.ExtrudeGeometry(starShape(0.07, 0.03), { depth: 0.025, bevelEnabled: false }), toon(0xffd23a, { emissive: 0xffc400, emissiveIntensity: 0.35 }));
    star.position.set(0, 0.49, 0.33); star.rotation.x = -0.65; headPivot.add(star);
    const ap = mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.32, 24, 1, true, -1.05, 2.1), toon(0xfff1d6, { side: THREE.DoubleSide })); ap.position.y = 0.32; rig.add(ap);
    const pk = mesh(new THREE.BoxGeometry(0.17, 0.12, 0.03), toon(0xf08a24)); pk.position.set(0.05, 0.28, 0.365); rig.add(pk);
  } else if (o.outfit === 'boss') {
    const hm = toon(0xf28c28);
    const helmet = mesh(new THREE.SphereGeometry(0.455, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), hm); helmet.position.y = 0.32; helmet.scale.set(1.04, 0.72, 1.04); headPivot.add(helmet);
    const rim = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 28), hm); rim.position.y = 0.33; headPivot.add(rim);
    const ridge = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.6), hm); ridge.position.set(0, 0.62, 0); headPivot.add(ridge);
    const vest = mesh(new THREE.CylinderGeometry(0.355, 0.365, 0.36, 24, 1, true), toon(0xb8f23a, { emissive: 0x8fd41a, emissiveIntensity: 0.25, side: THREE.DoubleSide })); vest.position.y = 0.36; rig.add(vest);
    [0.3, 0.42].forEach((y) => { const st = mesh(new THREE.TorusGeometry(0.362, 0.015, 6, 32), toon(0xf4f4f4, { emissive: 0xffffff, emissiveIntensity: 0.3 }), { outline: false }); st.rotation.x = Math.PI / 2; st.position.y = y; rig.add(st); });
    parts.head.rotation.x = 0; root.userData.stern = true;
  } else if (o.outfit === 'shop') {
    const ap = mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.34, 24, 1, true, -1.1, 2.2), toon(0xe25a3a, { side: THREE.DoubleSide })); ap.position.y = 0.33; rig.add(ap);
    const pk = mesh(new THREE.BoxGeometry(0.16, 0.1, 0.03), toon(0xffffff)); pk.position.set(0, 0.3, 0.37); rig.add(pk);
  } else if (o.outfit === 'office') {
    const sh = mesh(new THREE.CylinderGeometry(0.355, 0.365, 0.38, 24, 1, true), toon(0xffffff, { side: THREE.DoubleSide })); sh.position.y = 0.36; rig.add(sh);
    const tie = mesh(new THREE.BoxGeometry(0.06, 0.24, 0.02), toon(0x2c3e7a)); tie.position.set(0, 0.42, 0.355); rig.add(tie);
    const knot = mesh(new THREE.BoxGeometry(0.08, 0.05, 0.03), toon(0x2c3e7a)); knot.position.set(0, 0.55, 0.35); rig.add(knot);
    const folder = mesh(new THREE.BoxGeometry(0.22, 0.28, 0.03), toon(0xe9cf8e)); folder.position.set(0.32, 0.36, 0.14); folder.rotation.y = -0.4; rig.add(folder);
  }
  root.scale.setScalar(o.size);
  return makeActor(root, rig, parts);
}

// 절차 애니메이션: 걷기 뒤뚱, 숨쉬기, 깜빡임, 말하기, 점프 찌그러짐, 둘러보기
function makeActor(root, rig, parts) {
  const st = { t: Math.random() * 10, walk: 0, blinkT: 1 + Math.random() * 3, blink: 0, talk: false,
    lookT: 3 + Math.random() * 4, lookY: 0, mood: '', sx: 1, sy: 1, lift: 0, spin: 0 };
  function update(dt, s = {}) {
    st.t += dt;
    const moving = !!s.moving;
    st.walk += dt * (moving ? 11 : 0);
    const w = moving ? 1 : 0;
    // 몸 뒤뚱
    rig.rotation.z = Math.sin(st.walk) * 0.11 * w;
    rig.rotation.x = moving ? 0.08 : 0;
    // 다리 번갈아
    parts.legs.forEach((l, i) => {
      const ph = st.walk + (i ? Math.PI : 0);
      l.rotation.x = Math.sin(ph) * 0.7 * w;
      l.position.y = 0.09 + Math.max(0, Math.sin(ph)) * 0.05 * w;
    });
    // 날개
    const flap = s.jumping ? Math.sin(st.t * 28) * 0.9 + 0.6 : moving ? Math.sin(st.walk * 2) * 0.25 + 0.15 : Math.sin(st.t * 2) * 0.05;
    parts.wings.forEach((p, i) => { p.rotation.z = (i ? -1 : 1) * flap; });
    parts.tail.rotation.x = Math.sin(st.t * 3 + st.walk) * 0.08;
    // 숨쉬기 + 찌그러짐(점프)
    const breath = moving ? 0 : Math.sin(st.t * 2.6) * 0.022;
    const sy = (s.sy ?? 1) * (1 + breath), sx = (s.sx ?? 1) * (1 - breath * 0.5);
    rig.scale.set(sx, sy, sx);
    rig.position.y = (s.lift || 0) + (moving ? Math.abs(Math.sin(st.walk)) * 0.05 : 0);
    rig.rotation.y = (s.spin || 0);
    // 깜빡임
    st.blinkT -= dt;
    if (st.blinkT <= 0) { st.blink = 0.14; st.blinkT = 2 + Math.random() * 3.5; }
    if (st.blink > 0) st.blink -= dt;
    const happy = st.mood === 'happy';
    const eyeY = st.blink > 0 ? 0.12 : happy ? 0.35 : st.mood === 'worry' ? 0.8 : 1;
    parts.eyes.forEach((e) => { e.scale.y = eyeY; });
    // 둘러보기
    st.lookT -= dt;
    if (st.lookT <= 0) { st.lookY = moving ? 0 : (Math.random() - 0.5) * 1.1; st.lookT = 2.5 + Math.random() * 4; }
    parts.head.rotation.y += ((moving ? 0 : st.lookY) - parts.head.rotation.y) * Math.min(1, dt * 4);
    parts.head.rotation.z = st.mood === 'worry' ? 0.18 : 0;
    // 말하기: 아래 부리 여닫기 + 고개 까딱
    const talk = st.talk ? Math.max(0, Math.sin(st.t * 18)) : 0;
    if (parts.beakBot) parts.beakBot.rotation.x = Math.PI / 2 + talk * 0.5;
    if (parts.mouth) parts.mouth.scale.y = 0.6 + talk * 1.6;
    parts.head.position.y = 0.7 + (st.talk ? Math.abs(Math.sin(st.t * 9)) * 0.03 : 0) + (moving ? 0 : Math.sin(st.t * 2.6 + 1) * 0.012);
  }
  return { root, rig, parts, st, update, setMood(m) { st.mood = m || ''; }, setTalk(v) { st.talk = !!v; } };
}
