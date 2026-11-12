// 게임 장면으로 그림 찍기: 평가 패널 그림 + 오프닝 만화
// node tools/shots_art.js <playwright 폴더> <저장 폴더>
// 장면을 꾸며(인물 위치·표정·카메라) 3D 화면만 찍는다. 글자·화면 장식은 숨긴다.
const path = require('path');
const { chromium } = require(path.join(process.argv[2], 'node_modules', 'playwright'));
const out = process.argv[3];
const SHOTS = [
  // 오프닝 1: 일자리 알림판 앞의 꼬꼬
  { name: 'open1', w: 1600, h: 900, set: { room: null, hero: [-16.6, -1.5, -2.3], heroMood: '', cam: [[-14.2, 1.9, 0.2], [-17.4, 1.25, -2.9]] } },
  // 오프닝 2: 불꽃식품 공장 앞, 꼬꼬와 공장장
  { name: 'open2', w: 1600, h: 900, set: { room: null, hero: [31.6, -3.2, 0.5], heroMood: 'happy', npcs: { boss: [33.4, -3.3, -0.5, 'happy'] }, cam: [[32.8, 2.6, 3.2], [32.6, 1.9, -5.0]] } },
  // 오프닝 3: 첫 월급날, 집 앞 가족
  { name: 'open3', w: 1600, h: 900, set: { room: null, hero: [-9.2, -2.0, 0.2], heroMood: 'happy', npcs: { mom: [-10.8, -2.4, 0.4, 'happy'], baby: [-7.9, -1.6, -0.3, 'happy'] }, cam: [[-9.4, 2.4, 3.6], [-9.6, 1.4, -4.0]] } },
  // 1장: 마트 라면 칸, 가족과 함께
  { name: 'scene1', w: 1500, h: 520, set: { room: 'mart', hero: [-3.3, -83.3, 0.3], heroMood: 'happy', npcs: { mom2: [-4.5, -83.5, 0.5, 'happy'], baby2: [-2.2, -82.9, -0.4, 'happy'] }, cam: [[-2.8, 2.2, -79.4], [-3.4, 1.25, -84.4]] } },
  // 2장: 공장 점호
  { name: 'scene2', w: 1500, h: 520, set: { room: 'factory', hero: [40, -79, Math.PI], heroMood: 'worry', npcs: { boss: [40, -82.2, 0, ''], bear: [38.2, -79, Math.PI, 'worry'], bunny: [41.8, -79, Math.PI, 'worry'] }, cam: [[43.4, 2.7, -83.5], [40, 0.9, -79.4]] } },
  // 3장: 회의실 / 광고판 / 강가 (세 칸으로 붙인다)
  { name: 'scene3a', w: 1000, h: 1040, set: { room: 'meet', hero: [80, -78.45, Math.PI], sit: true, cam: [[82.4, 2.7, -76.0], [80, 1.1, -82.0]] } },
  { name: 'scene3b', w: 1000, h: 1040, set: { room: 'meet', cam: [[63.5, 3.4, 6.2], [63.5, 2.9, -3.8]] } },
  { name: 'scene3c', w: 1000, h: 1040, set: { room: 'meet', cam: [[35.6, 5.2, 4.4], [37.4, 0, 10.6]] } },
];
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', (e) => console.log('ERR', String(e)));
  await p.goto('http://127.0.0.1:8765/?shot=1&reset=all');
  await p.waitForFunction(() => window.__kk && __kk.S.mode === 'start', null, { timeout: 120000 });
  await p.fill('#in-ban', '0'); await p.fill('#in-num', '0'); await p.fill('#in-name', '그림'); await p.click('#btn-start');
  await p.waitForTimeout(800);
  for (let i = 0; i < 10 && (await p.evaluate(() => __kk.S.mode)) === 'comic'; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(250); }
  await p.waitForTimeout(1500);
  await p.addStyleTag({ content: '#hud,#labels,#fps,#quest-bar,#zone-banner,#letterbox,#dialogue,#dlg-big,#cutin,#comic,#ex-root{display:none!important}#fade{opacity:0!important}' });
  for (const sh of SHOTS) {
    await p.setViewportSize({ width: sh.w, height: sh.h });
    await p.evaluate((st) => {
      const K = __kk, S = K.S; S.mode = 'shot'; S.room = st.room; S.sit = !!st.sit;
      if (st.hero) { S.x = st.hero[0]; S.z = st.hero[1]; S.face = st.hero[2]; K.hero.root.rotation.y = st.hero[2]; }
      else { S.x = st.cam[1][0]; S.z = -200; }
      K.hero.setMood(st.heroMood || '');
      for (const [id, v] of Object.entries(st.npcs || {})) {
        const n = K.TH[id]; n.x = v[0]; n.z = v[1]; n.actor.root.position.x = v[0]; n.actor.root.position.z = v[1]; n.actor.root.rotation.y = v[2]; n.actor.setMood(v[3]);
      }
      K.shot(st.cam[0], st.cam[1]);
    }, sh.set);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(out, sh.name + '.png') });
    console.log('찍음', sh.name);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(2); });
