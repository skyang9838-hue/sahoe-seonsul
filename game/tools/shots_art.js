// 게임 장면으로 그림 찍기: 평가 패널 그림 + 오프닝 만화
// node tools/shots_art.js <playwright 폴더> <저장 폴더> [이름,이름...]
//   → <저장 폴더>/*.png (원본 크기) + 인물 테두리 px 검사. 다 찍은 뒤 tools/compose_art.py로 줄이고 붙여 assets에 넣는다.
// 장면을 꾸며(인물 위치·표정·카메라) 3D 화면만 찍는다. 글자·화면 장식은 숨긴다.
// 패널 그림 칸은 무대 기준 376×100(2장 376×76, exam.css .scene img)이라 그 비율로 찍는다(cover로 잘리지 않게).
const path = require('path');
const { chromium } = require(path.join(process.argv[2], 'node_modules', 'playwright'));
const out = process.argv[3];
const only = process.argv[4] ? process.argv[4].split(',') : null;
const OPEN = { w: 1600, h: 900 }, P1 = { w: 2256, h: 600 }, P2 = { w: 2256, h: 456 }, P3 = { w: 744, h: 600 };
const SHOTS = [
  // 오프닝 1: 일자리 알림판 앞의 꼬꼬(뒷모습, 알림판을 본다)
  { name: 'open1', ...OPEN, who: ['hero'], set: { room: null, hero: [-16.6, -1.5, -2.3], heroMood: '', cam: [[-15.0, 2.6, 2.6], [-17.0, 1.1, -2.6]] } },
  // 오프닝 2: 불꽃식품 공장 앞, 꼬꼬와 공장장(서로 마주 봄)
  { name: 'open2', ...OPEN, who: ['hero', 'boss'], set: { room: null, hero: [31.6, -3.2, 0.9], heroMood: 'happy', npcs: { boss: [33.4, -3.3, -0.6, 'happy'] }, cam: [[32.8, 2.6, 3.2], [32.6, 1.9, -5.0]] } },
  // 오프닝 3: 첫 월급날, 집 앞 가족
  { name: 'open3', ...OPEN, who: ['hero', 'mom', 'baby'], set: { room: null, hero: [-9.2, -2.0, 0.2], heroMood: 'happy', npcs: { mom: [-10.8, -2.4, 0.4, 'happy'], baby: [-7.9, -1.6, -0.3, 'happy'] }, cam: [[-9.4, 2.4, 3.6], [-9.6, 1.4, -4.0]] } },
  // 1장: 마트 라면 칸, 가족과 함께
  { name: 'scene1', ...P1, who: ['hero', 'mom2', 'baby2'], set: { room: 'mart', fov: 46, hero: [-3.3, -83.3, 0.3], heroMood: 'happy', npcs: { mom2: [-4.6, -83.5, 0.5, 'happy'], baby2: [-2.1, -82.9, -0.4, 'happy'] }, cam: [[-3.3, 1.7, -79.4], [-3.3, 1.08, -84.0]] } },
  // 2장: 공장 점호(공장장이 말하고 근로자들이 걱정)
  { name: 'scene2', ...P2, who: ['hero', 'boss', 'bear', 'bunny'], set: { room: 'factory', hero: [40, -79, Math.PI], heroMood: 'worry', npcs: { boss: [41.6, -81.4, -0.59, ''], bear: [38.2, -79, Math.PI, 'worry'], bunny: [41.8, -79, Math.PI, 'worry'] }, cam: [[38.6, 2.7, -84.6], [40.3, 0.65, -79.6]] } },
  // 3장: 회의실 / 광고판 / 강가 (세 칸으로 붙인다)
  { name: 'scene3a', ...P3, who: ['fox', 'staff1', 'staff2'], set: { room: 'meet', fov: 46, cam: [[80, 3.0, -76.2], [80, 0.9, -83.2]] } },
  { name: 'scene3b', ...P3, who: [], set: { room: 'meet', cam: [[63.5, 3.6, 4.4], [63.5, 3.2, -3.8]] } },
  { name: 'scene3c', ...P3, who: [], poll: true, set: { room: 'meet', fov: 40, cam: [[36.0, 8.0, 4.4], [37.0, 0, 10.0]] } },
];
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', (e) => console.log('ERR', String(e)));
  await p.goto((process.env.KK_URL || 'http://127.0.0.1:8765/') + '?shot=1&reset=all');
  await p.waitForFunction(() => window.__kk && __kk.S.mode === 'start', null, { timeout: 120000 });
  await p.fill('#in-ban', '0'); await p.fill('#in-num', '0'); await p.fill('#in-name', '그림'); await p.click('#btn-start');
  await p.waitForTimeout(800);
  for (let i = 0; i < 10 && (await p.evaluate(() => __kk.S.mode)) === 'comic'; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(250); }
  await p.waitForTimeout(1500);
  await p.addStyleTag({ content: '#hud,#labels,#fps,#quest-bar,#zone-banner,#letterbox,#dialogue,#dlg-big,#cutin,#comic,#ex-root{display:none!important}#fade{opacity:0!important}' });
  let bad = 0;
  for (const sh of SHOTS) {
    if (only && !only.includes(sh.name)) continue;
    await p.setViewportSize({ width: sh.w, height: sh.h });
    await p.waitForTimeout(400);   // resize(fov 되돌림)가 먼저 끝나게
    await p.evaluate(([st, poll]) => {
      const K = __kk, S = K.S; S.mode = 'shot'; S.room = st.room; S.sit = !!st.sit;
      if (st.hero) { S.x = st.hero[0]; S.z = st.hero[1]; S.face = st.hero[2]; K.hero.root.rotation.y = st.hero[2]; }
      else { S.x = st.cam[1][0]; S.z = -200; }
      K.hero.setMood(st.heroMood || '');
      for (const [id, v] of Object.entries(st.npcs || {})) {
        const n = K.TH[id]; n.x = v[0]; n.z = v[1]; n.actor.root.position.x = v[0]; n.actor.root.position.z = v[1]; n.actor.root.rotation.y = v[2]; n.actor.setMood(v[3]);
      }
      // 3장 강가: 원문("더러운 물이 근처 강으로")대로 배수관·폐수를 켠다
      const P = K.POLL; P.on = poll; if (P.uni) P.uni.value = poll ? P.dirtyAt : -1; if (P.pipe) P.pipe.visible = poll;
      K.shot(st.cam[0], st.cam[1]);
      if (st.fov) { K.camera.fov = st.fov; K.camera.updateProjectionMatrix(); }   // 다음 장면에서 창 크기를 바꾸면 resize가 되돌린다
    }, [sh.set, !!sh.poll]);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(out, sh.name + '.png') });
    // 인물 테두리(메시 경계 상자 꼭짓점을 화면에 투영, px). 화면 밖으로 나가거나 서로 크게 겹치면 알린다.
    const boxes = await p.evaluate((who) => {
      const K = __kk, cam = K.camera, V = cam.position.constructor, W = innerWidth, H = innerHeight;
      return who.map((id) => {
        const root = id === 'hero' ? K.hero.root : K.TH[id].actor.root; root.updateMatrixWorld(true);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        root.traverse((o) => {
          if (!o.isMesh || !o.visible || !o.geometry) return;
          const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox;
          for (let i = 0; i < 8; i++) {
            const v = new V(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld).project(cam);
            const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
            x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
          }
        });
        return { id, box: [x0, y0, x1, y1].map(Math.round), W, H };
      });
    }, sh.who);
    const msg = boxes.map((r) => {
      const [x0, y0, x1, y1] = r.box, inside = x0 >= 0 && y0 >= 0 && x1 <= r.W && y1 <= r.H;
      if (!inside) bad++;
      return (inside ? '' : '잘림! ') + r.id + ' [' + r.box.join(',') + ']';
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].box, c = boxes[j].box;
      const ix = Math.max(0, Math.min(a[2], c[2]) - Math.max(a[0], c[0])), iy = Math.max(0, Math.min(a[3], c[3]) - Math.max(a[1], c[1]));
      const small = Math.min((a[2] - a[0]) * (a[3] - a[1]), (c[2] - c[0]) * (c[3] - c[1]));
      const k = ix * iy / small; if (k > 0.25) { bad++; msg.push('겹침! ' + boxes[i].id + '/' + boxes[j].id + ' ' + Math.round(k * 100) + '%'); }
    }
    console.log('찍음', sh.name, sh.w + '×' + sh.h, msg.join(' · '));
  }
  await b.close();
  if (bad) { console.log('구도 문제', bad); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(2); });
