// 3D 판 자동 플레이 검사: node tools/play3d.js <playwright 폴더> <캡처 폴더> [너비] [높이] [nofont]
//   nofont: 글꼴 파일을 막고(대체 글꼴로) 패널·수첩이 넘치지 않는지까지 본다
const path = require('path');
const { chromium } = require(path.join(process.argv[2], 'node_modules', 'playwright'));
const out = process.argv[3], W = +(process.argv[4] || 1366), H = +(process.argv[5] || 768), NOFONT = process.argv[6] === 'nofont';
const URL = process.env.KK_URL || 'http://127.0.0.1:8765/';
const fails = []; const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails.push(m); };
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  if (NOFONT) await p.route(/\.woff2(\?|$)|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('response', (r) => { if (r.status() >= 400) console.log('  404', r.url()); });
  let n = 0; const snap = (name) => p.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + name + '.png') });
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => window.__kk && __kk.S.mode === 'start', null, { timeout: 90000 });
  const st = () => p.evaluate(() => ({ mode: __kk.S.mode, x: __kk.S.x, z: __kk.S.z, prog: __kk.S.progress, flags: __kk.S.flags, quest: __kk.questCur(), ex: window.__ex && __ex.mode, ans: window.__ex && __ex.S.answers, sub: window.__ex && __ex.S.submitted }));
  const waitMode = async (m, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await st()).mode === m) return true; await p.waitForTimeout(100); } return false; };
  const space = async (k = 1) => { for (let i = 0; i < k; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(160); } };
  const finishTalk = async () => { for (let i = 0; i < 30 && (await st()).mode === 'talk'; i++) await space(); };
  const tp = (x, z) => p.evaluate(([x, z]) => { __kk.S.x = x; __kk.S.z = z; }, [x, z]);
  const near = async (id, dx = 0, dz = 1.0) => { const t = await p.evaluate((id) => { const t = __kk.TH[id]; return { x: t.x, z: t.z }; }, id); await tp(t.x + dx, t.z + dz); await p.waitForTimeout(250); };
  // 소품 올라서기: Space(필요하면 2단) + 방향키를 holdMs 동안 → 땅이나 소품에 내려앉을 때까지 기다린다
  const jz = () => p.evaluate(() => ({ z: +__kk.J.z.toFixed(2), on: __kk.J.on, x: +__kk.S.x.toFixed(2), sz: +__kk.S.z.toFixed(2), mode: __kk.S.mode, camY: +__kk.camera.position.y.toFixed(2) }));
  //   hold: 누르는 시간(ms), 또는 손을 뗄 조건식 문자열(S·J 기준). 조건식은 페이지 안에서 매 프레임 보고 바로 keyup을 보낸다
  //   (소프트웨어 렌더링은 프레임이 느려 바깥에서 재면 늦게 뗀다)
  async function jumpMove(key, hold, dbl = false) {
    if (typeof hold === 'string') await p.evaluate(([key, expr]) => { const f = new Function('S', 'J', 'return ' + expr); const t0 = performance.now();
      const tick = () => { if (f(__kk.S, __kk.J) || performance.now() - t0 > 5000) dispatchEvent(new KeyboardEvent('keyup', { code: key })); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, [key, hold]);
    await p.keyboard.press('Space'); if (key) await p.keyboard.down(key);
    if (dbl) { await p.waitForTimeout(260); await p.keyboard.press('Space'); }
    if (typeof hold === 'string') { const t = Date.now(); while (Date.now() - t < 5000) { const q = await jz(); if (!q.on && Date.now() - t > 300) break; await p.waitForTimeout(60); } }
    else await p.waitForTimeout(Math.max(0, hold - (dbl ? 260 : 0)));
    if (key) await p.keyboard.up(key);
    for (let i = 0; i < 60; i++) { const j = await jz(); if (!j.on) break; await p.waitForTimeout(60); }
    await p.waitForTimeout(150); return jz();
  }
  async function holdUntil(key, cond, ms = 9000) { await p.keyboard.down(key); const t = Date.now(); while (Date.now() - t < ms) { if (await cond()) break; await p.waitForTimeout(80); } await p.keyboard.up(key); }

  let s0, s1;
  // 패널 스크롤 없는지 + 대사창 잘림 없는지
  // 넘침(scroll)과 왼쪽 자료 칸의 남는 높이(무대 px)를 같이 본다
  const fitCheck = async (tag, sel = '#ex-left,#ex-right') => {
    const r = await p.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => e.scrollHeight - e.clientHeight), sel);
    const slack = await p.evaluate((sel) => { const e = document.querySelector(sel.split(',')[0]), k = e.getBoundingClientRect().height / e.offsetHeight; const last = e.lastElementChild; const cs = getComputedStyle(e); return Math.round(e.clientHeight - parseFloat(cs.paddingBottom) - (last.offsetTop + last.offsetHeight - e.offsetTop)); }, sel);
    check(r.every((v) => v <= 2), tag + ' 패널 스크롤 없음 (' + r.join(',') + ', 왼쪽 여유 ' + slack + 'px)' + (NOFONT ? ' [대체 글꼴]' : ''));
  };
  // 패널 장면 그림: 받아졌고, 칸 비율과 그림 비율이 맞아 cover로 잘리는 부분이 거의 없는지(인물 잘림 방지)
  const sceneImg = async (tag) => {
    const r = await p.evaluate(async () => { const im = document.querySelector('#ex-scene img'); if (!im) return null; if (!im.complete) await new Promise((ok) => { im.onload = im.onerror = ok; });
      const cs = getComputedStyle(im), bw = im.clientWidth, bh = im.clientHeight; return { nw: im.naturalWidth, nh: im.naturalHeight, bw, bh, src: im.getAttribute('src') }; });
    if (!r) { check(false, tag + ' 장면 그림 없음'); return; }
    const crop = 1 - Math.min(r.nw / r.nh, r.bw / r.bh) / Math.max(r.nw / r.nh, r.bw / r.bh);
    const msg = tag + ' 장면 그림 비율 맞음 (그림 ' + r.nw + '×' + r.nh + ', 칸 ' + r.bw + '×' + r.bh + ', 잘림 ' + Math.round(crop * 100) + '%)';
    // 그림 규칙(11/13): 패널 그림은 2D(아스트라) 원본을 쓴다. 칸 비율에 맞춘 2D 그림을 새로 그리기 전까지는 잘림을 주의로만 알린다
    if (/[?&]v=2d/.test(r.src) && r.nw > 0 && crop >= 0.04) { console.log('  ! 주의(2D 그림, 다시 그릴 때 칸 비율로): ' + msg); return; }
    check(r.nw > 0 && crop < 0.04, msg);
  };
  // 위 가림막(HUD·퀘스트 띠) 아래 끝
  const safeTop = () => p.evaluate(() => Math.max(...['hud', 'quest-bar'].map((id) => { const e = document.getElementById(id); return e.offsetParent && e.style.display !== 'none' ? e.getBoundingClientRect().bottom : 0; })));
  const labelsBelowTop = async (tag) => {
    const r = await p.evaluate(() => [...document.querySelectorAll('#labels > *')].filter((e) => e.style.display !== 'none' && e.offsetParent).map((e) => { const b = e.getBoundingClientRect(); return [e.className + ':' + e.textContent.slice(0, 8), Math.round(b.top), Math.round(b.left), Math.round(b.right), Math.round(b.bottom)]; }));
    const top = await safeTop(), bad = r.filter((x) => x[1] < top - 1);
    check(bad.length === 0, tag + ' 이름표·말풍선이 HUD·퀘스트 띠 아래 (기준 ' + Math.round(top) + ', ' + (bad.map((b) => b[0] + '@' + b[1]).join(' ') || r.length + '개') + ')');
    const zb = await p.evaluate(() => { const z = document.getElementById('zone-banner'); if (+getComputedStyle(z).opacity < 0.05) return null; const b = z.getBoundingClientRect(); return [b.left, b.right, b.top, b.bottom]; });
    if (zb) { const hit = r.filter((x) => x[2] < zb[1] && zb[0] < x[3] && x[1] < zb[3] && zb[2] < x[4]); check(hit.length === 0, tag + ' 구역 배너 밑에 깔린 이름표 없음 (' + hit.map((h) => h[0]).join(' ') + ')'); }
    const pr = r.find((x) => x[0].startsWith('prompt'));
    if (pr) { const hit = r.filter((x) => x !== pr && x[2] < pr[3] && pr[2] < x[3] && x[1] < pr[4] && pr[1] < x[4]); check(hit.length === 0, tag + ' 말풍선이 다른 이름표와 안 겹침 (' + hit.map((h) => h[0]).join(' ') + ')'); }
  };
  const faceClear = async (tag) => {
    const r = await p.evaluate(() => { const b = document.getElementById('dlg-big'); if (b.classList.contains('hide')) return null; const f = b.getBoundingClientRect(), n = document.getElementById('dlg-name').getBoundingClientRect(), c = document.querySelector('#dlg-text .ch').getBoundingClientRect(); return { f: [f.left, f.right], n: [n.left, n.right], c: [c.left, c.right], right: b.classList.contains('right') }; });
    if (!r) { check(false, tag + ' 초상화 없음'); return; }
    const ok = r.right ? r.f[0] >= Math.max(r.n[1], r.c[1]) - 1 : r.f[1] <= Math.min(r.n[0], r.c[0]) + 1;
    check(ok, tag + ' 초상화가 이름표·대사를 안 덮음 (초상 ' + r.f.map(Math.round) + ' / 이름 ' + r.n.map(Math.round) + ' / 첫 글자 ' + r.c.map(Math.round) + ')');
  };
  const dlgFit = async (tag) => { const r = await p.evaluate(() => { const d = document.getElementById('dialogue').getBoundingClientRect(); return [d.top, d.bottom, innerHeight]; }); check(r[0] > 0 && r[1] <= r[2], tag + ' 대사창 화면 안 (' + r.map(Math.round).join(',') + ')'); };
  // 바깥 구도: 꼬꼬는 화면 아래 1/3쯤, 문 앞 간판은 HUD·퀘스트 띠에 안 가림 (카메라가 자리 잡을 때까지 기다린 뒤 px로 잰다)
  const outdoorFrame = async (tag, door) => {
    await p.waitForTimeout(1400);
    const r = await p.evaluate((door) => {
      const c = __kk.camera, V = c.position.constructor, d = __kk.TH[door], scene = __kk.hero.root.parent;
      const hero = (-new V(__kk.S.x, 0.7, __kk.S.z).project(c).y * 0.5 + 0.5);
      let sign = null;
      scene.traverse((m) => {
        if (!m.isMesh || m.geometry.type !== 'PlaneGeometry' || !m.material.map || !m.material.map.isCanvasTexture) return;
        const wp = new V(); m.getWorldPosition(wp); if (Math.abs(wp.x - d.x) > 4 || Math.abs(wp.z - d.z) > 1.5 || wp.y < 2.5) return;
        m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; const xs = [], ys = [];
        for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) { const v = new V(X, Y, 0).applyMatrix4(m.matrixWorld).project(c); xs.push((v.x * 0.5 + 0.5) * innerWidth); ys.push((-v.y * 0.5 + 0.5) * innerHeight); }
        sign = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map(Math.round);
      });
      const q = document.getElementById('quest-bar'), qb = q.style.display === 'none' ? null : q.getBoundingClientRect();
      return { hero: +hero.toFixed(2), sign, qb: qb && [qb.left, qb.right, qb.top, qb.bottom].map(Math.round), hud: Math.round(document.getElementById('hud').getBoundingClientRect().bottom) };
    }, door);
    check(r.hero >= 0.6 && r.hero <= 0.76, tag + ' 꼬꼬가 화면 아래쪽 1/3쯤 (높이 비율 ' + r.hero + ')');
    if (r.sign) {
      const s = r.sign, hitQ = r.qb && s[0] < r.qb[1] && r.qb[0] < s[1] && s[2] < r.qb[3] && r.qb[2] < s[3];
      check(s[2] > r.hud + 4 && !hitQ && s[3] < H, tag + ' 간판이 HUD·퀘스트 띠에 안 가림 (간판 ' + s.join(',') + ' / HUD 아래 ' + r.hud + ' / 띠 ' + (r.qb || []).join(',') + ')');
    }
  };
  const fill = async (id, v) => { await p.fill(id, v); await p.dispatchEvent(id, 'input'); };
  await snap('start');
  await p.fill('#in-ban', '0'); await p.fill('#in-num', '0'); await p.fill('#in-name', '테스트'); await p.click('#btn-start');
  check(await waitMode('comic', 5000), '출근하기 → 오프닝 컷신');
  await p.waitForTimeout(900); await snap('comic1');
  check(!(await p.evaluate(() => document.querySelector('.comic-box').classList.contains('emph'))), '오프닝 1컷(안내)은 강조 없음');
  // 건너뛰기를 눌러도 원문 컷은 보여 준다(원문 줄은 강조)
  await p.click('#comic-skip'); await p.waitForTimeout(500);
  s0 = await p.evaluate(() => [document.getElementById('comic-page').textContent, document.querySelector('.comic-box').classList.contains('emph'), (window.__kk.S.mode)]);
  check(s0[0].startsWith('2') && s0[1] && s0[2] === 'comic', '건너뛰기 → 원문 컷(2)으로, 강조 (' + s0.join(',') + ')');
  await p.waitForTimeout(2600); await snap('comic2-emph');
  await p.click('#comic-skip'); await p.waitForTimeout(300);
  check(await waitMode('walk', 5000), '컷신 끝 → 꼬꼬 방에서 걷기');
  await p.waitForTimeout(700); await snap('home');
  let s = await st(); check(s.quest === 'homeDoor' && (await p.evaluate(() => __kk.S.room)) === 'home', '첫 자리: 꼬꼬네 집 안 (' + s.quest + ')');
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('둘러보고')), '집 안 퀘스트 문구');
  check(await p.evaluate(() => getComputedStyle(document.getElementById('fps')).display === 'none'), 'fps 숫자 숨김(?debug 아닐 때)');
  // 시작 직후 Space: 가까운 것이 없어 점프만(나가기·단서가 바로 켜지지 않게)
  check(await p.evaluate(() => document.querySelector('#labels .prompt').style.display === 'none'), '시작 자리에서는 말풍선 없음');
  // 살펴보기 단서 3곳: 원문 강조 없이 안내 대사
  for (const id of ['clock', 'photo', 'mirror']) {
    await near(id, id === 'mirror' ? -0.5 : 0, id === 'mirror' ? 0 : 0.5); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.querySelector('#labels .prompt').textContent.includes('살펴보기')), id + ' 앞 → Space 살펴보기');
    if (id === 'clock') await labelsBelowTop('꼬꼬 방');
    await space(); s = await st(); check(s.mode === 'talk', id + ' 살펴보기 대사');
    check(!(await p.evaluate(() => document.getElementById('dialogue').classList.contains('emph'))), id + ' 대사는 강조 없음');
    if (id === 'photo') { await p.waitForTimeout(500); await snap('home-look'); await dlgFit('집 단서'); }
    await finishTalk();
  }
  check((await st()).quest === 'homeDoor', '단서를 봐도 퀘스트는 그대로(나가기만 남음)');
  await near('exit_home', 0, -0.4); await space(); await p.waitForTimeout(900);
  s = await st(); check((await p.evaluate(() => __kk.S.room)) === null && s.quest === 'mom', '집 문 → 마을, 다음 퀘스트 엄마 닭 (' + s.quest + ')');
  await p.waitForTimeout(500); await snap('village');
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('엄마')), '위쪽 퀘스트 문구');
  // 다시 들어갔다 나와도 퀘스트는 그대로
  await near('homeDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  check((await p.evaluate(() => __kk.S.room)) === 'home' && (await st()).quest === 'mom', '마을에서 집에 다시 들어가기');
  await near('exit_home', 0, -0.4); await space(); await p.waitForTimeout(900);
  check((await p.evaluate(() => __kk.S.room)) === null, '다시 나오기');
  // 점프(빈 곳에서)
  await tp(-12, 2.4); await p.waitForTimeout(250);
  await p.keyboard.press('Space');
  let jmax = 0; for (let i = 0; i < 40; i++) { jmax = Math.max(jmax, await p.evaluate(() => __kk.J.z)); if (jmax > 0.5) break; await p.waitForTimeout(60); }
  check(jmax > 0.5, '빈 곳 Space → 점프 (최고 ' + jmax.toFixed(2) + ')');
  await p.waitForTimeout(1500);
  // 소품 올라서기 (벤치 윗면 0.95, 점프 정점 약 1.29)
  check(await p.evaluate(() => __kk.colliders.filter((c) => c.top !== undefined).every((c) => c.top <= 1.2)), '올라서는 소품은 모두 허리 높이 이하(1.2 이하)');
  check(await p.evaluate(() => __kk.colliders.filter((c) => c.top !== undefined && !c.off).every((c) => Math.abs(c.x - 21) - c.hw > 1.5 && Math.abs(c.z) + c.hd < 12.6 && c.x - c.hw > -22 && c.x + c.hw < 70 || c.z < -50)), '울타리 문·세계 가장자리 가까이에는 올라서는 소품 없음');
  await tp(-17.3, 4.4); await p.waitForTimeout(500);
  let j0 = await jz();
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight'); await p.waitForTimeout(200);
  let j = await jz(); check(j.z === 0 && j.x < -16.5, '점프 없이 걸으면 벤치에 막힘 (x ' + j.x + ', 발 ' + j.z + ')');
  j = await jumpMove('ArrowRight', 'S.x > -16.5'); check(j.z === 0.95 && !j.on && j.x > -16.6 && j.x < -15.4, '점프 → 벤치 위에 올라섬 (발 ' + j.z + ', x ' + j.x + ')');
  await p.waitForTimeout(700); j = await jz(); await snap('on-bench');
  check(j.z === 0.95 && j.camY > j0.camY + 0.6, '벤치 위에 서 있으면 그대로 있고 카메라도 따라 올라감 (카메라 y ' + j0.camY + ' → ' + j.camY + ')');
  await holdUntil('ArrowRight', async () => { const q = await jz(); return q.z === 0 && !q.on; }, 2500);
  j = await jz(); check(j.z === 0 && j.x > -15.5, '벤치 끝에서 걸어 나가면 떨어짐 (발 ' + j.z + ', x ' + j.x + ')');
  for (let i = 0; i < 40; i++) { j = await jz(); if (Math.abs(j.camY - j0.camY) < 0.1) break; await p.waitForTimeout(100); }
  check(Math.abs(j.camY - j0.camY) < 0.1, '내려오면 카메라 높이 제자리로 돌아옴 (' + j.camY + ')');
  // 상자(0.8) → 2단 점프로 다른 상자(1.0)
  await tp(11.6, -0.9); await p.waitForTimeout(300);
  j = await jumpMove('ArrowUp', 'S.z < -1.4'); check(j.z === 0.8, '작은 상자 위로 (발 ' + j.z + ')');
  // 높은 것(나무)은 2단 점프로도 못 지나감
  await tp(13.4, -1.5); await p.waitForTimeout(300);
  j = await jumpMove('ArrowRight', 1500, true); check(j.x < 15 && j.z === 0, '나무는 2단 점프로도 막힘 (x ' + j.x + ')');
  // 마트 문 먼저 → 잠김
  await near('martDoor', 0, 0.6); await space(); s = await st();
  check(s.mode === 'talk', '엄마 닭 전에는 마트 문 잠김'); await finishTalk();
  // 문 잠긴 채 오른쪽 문으로 → 막힘
  await tp(19.2, 2.2); await holdUntil('ArrowRight', async () => (await st()).mode === 'talk', 3000);
  s = await st(); check(s.mode === 'talk' && s.x < 21, '마트 전에는 회사 가는 문이 막힘'); await finishTalk();
  // 점프·2단 점프로도 문·울타리·덤불·세계 끝을 못 넘는다(퀘스트 순서 고정)
  for (const [x, z, key, tag] of [[19.6, 2.2, 'ArrowRight', '울타리 문'], [19.6, -6, 'ArrowRight', '문 옆 울타리'], [19.6, 9, 'ArrowRight', '문 옆 덤불'], [0, -12.4, 'ArrowUp', '북쪽 울타리'], [0, 12, 'ArrowDown', '남쪽 끝'], [-21.4, 2.2, 'ArrowLeft', '서쪽 끝']]) {
    await tp(x, z); await p.waitForTimeout(250);
    let mx = -1e9, mz = 1e9, Mz = -1e9, mnx = 1e9;
    for (let k = 0; k < 3; k++) { const q = await jumpMove(key, 1500, true); mx = Math.max(mx, q.x); mnx = Math.min(mnx, q.x); mz = Math.min(mz, q.sz); Mz = Math.max(Mz, q.sz); await finishTalk(); }
    const ok = key === 'ArrowRight' ? mx < 20.7 : key === 'ArrowUp' ? mz > -13.5 : key === 'ArrowDown' ? Mz < 12.7 : mnx > -22.1;
    check(ok, tag + ' 2단 점프로도 못 넘음 (x ' + mnx + '~' + mx + ', z ' + mz + '~' + Mz + ')');
  }
  check((await st()).quest === 'mom', '넘으려 해 봐도 퀘스트는 그대로 (' + (await st()).quest + ')');
  // 엄마 닭
  await near('mom', -1.0, 0.2); await p.waitForTimeout(300); await labelsBelowTop('엄마 닭 옆'); await space(); check((await st()).mode === 'talk', '엄마 닭 말 걸기'); await p.waitForTimeout(700); await snap('talk-mom'); await p.waitForTimeout(600);
  s0 = await p.evaluate(() => { const c = __kk.camera, V = c.position.constructor, m = __kk.NPCS.find((n) => n.id === 'mom'), y = (x, h, z) => Math.round((-new V(x, h, z).project(c).y * 0.5 + 0.5) * innerHeight);
    return [y(__kk.S.x, 0, __kk.S.z), y(m.x, 0, m.z), y(m.x, 2, m.z), Math.round(document.getElementById('dialogue').getBoundingClientRect().top)]; });
  check(Math.max(s0[0], s0[1]) < s0[3] && s0[2] > 60, '대화 중 꼬꼬·엄마 닭이 대사창 위에 보임 (꼬꼬 발 ' + s0[0] + ', 엄마 발 ' + s0[1] + ', 엄마 머리 ' + s0[2] + ', 대사창 ' + s0[3] + ')'); await finishTalk();
  check((await st()).flags.talkedMom === true, '엄마 닭 표시');
  // 마트 안으로
  await near('martDoor', 0, 0.6); await outdoorFrame('마트 문 앞', 'martDoor'); await snap('mart-door'); await space(); await p.waitForTimeout(900);
  s = await p.evaluate(() => __kk.S.room); check(s === 'mart', '마트 문 → 마트 안 (' + s + ')');
  await p.waitForTimeout(500); await snap('mart-in'); await labelsBelowTop('마트 안');
  check(await p.evaluate(() => { const e = document.querySelector('#labels .prompt'); return e.style.display === 'none' || !e.textContent.includes('나가기'); }), '들어온 직후 가장 가까운 것이 나가기가 아님');
  await space(); await p.waitForTimeout(400); check(await p.evaluate(() => __kk.S.room === 'mart'), '들어온 직후 Space를 또 눌러도 안 나감');
  // 라면 칸까지 실제로 걸어가기(위로)
  await holdUntil('ArrowUp', async () => (await st()).z < -82.4, 6000);
  await near('ramen', 0, 0.1); await space(); await p.waitForTimeout(1300);
  check((await st()).mode === 'talk', '라면 칸 → 원문 대사'); await dlgFit('라면'); await snap('ramen-closeup');
  check(await p.evaluate(() => document.getElementById('dialogue').classList.contains('emph')), '원문 줄 강조');
  await finishTalk(); await p.waitForTimeout(600);
  check((await st()).ex === 'panel', '라면 대사 → 평가 패널 1장'); await p.waitForTimeout(300); await snap('panel1'); await fitCheck('1장'); await sceneImg('1장');
  // 키보드로 바로 쓰기: Space로 대사를 넘긴 뒤 첫 칸에 커서, 처음 친 낱말·띄어쓰기가 그대로
  check(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'p-a0', '패널이 열리면 첫 칸에 커서');
  await p.keyboard.type('가계 일함'); await p.waitForTimeout(150);
  s0 = await p.evaluate(() => document.getElementById('p-a0').value); check(s0 === '가계 일함', '처음 친 글자 그대로 (' + s0 + ')');
  await p.click('#p-a2'); await p.keyboard.type('가 나'); await p.waitForTimeout(150);
  s0 = await p.evaluate(() => [document.getElementById('p-a2').value, document.activeElement.id, document.getElementById('p-a0').value]);
  check(s0[0] === '가 나' && s0[1] === 'p-a2' && s0[2] === '가계 일함', '클릭한 칸에 그대로 들어감 (' + s0.join(' | ') + ')');
  await fill('#p-a0', '공장에서 일하고 월급을 받는다'); await fill('#p-a1', '라면을 만들어 판매한다'); await fill('#p-a2', '월급'); await fill('#p-a3', '라면');
  await p.click('#ex-done'); await p.waitForTimeout(900);
  s = await st(); check(s.prog === 1, '1장 도장 (진행 ' + s.prog + ')');
  await p.waitForTimeout(700); await faceClear('꼬꼬 대사(after1)'); await snap('kkokko-talk'); await finishTalk();
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('나가')), '안에서는 나가기 안내');
  await near('exit_mart', 0, -0.4); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === null), '나가기 → 마을');
  // 회사로 걸어가기
  await tp(19, 2.2); await holdUntil('ArrowRight', async () => (await st()).x > 23, 15000);
  s = await st(); check(s.x > 23, '문 열림 → 회사로 걸어 들어감 (x=' + s.x.toFixed(1) + ')');
  await p.waitForTimeout(900); await snap('company');
  // 자동차: 보닛(0.6) → 지붕(1.15) → 걸어 내려오면 보닛 → 땅
  await tp(45.2, -2.6); await p.waitForTimeout(400);
  j = await jumpMove('ArrowRight', 'S.x > 46.0'); check(j.z === 0.6, '자동차 보닛 위로 (발 ' + j.z + ', x ' + j.x + ')');
  j = await jumpMove('ArrowRight', 'S.x > 46.6'); check(j.z === 1.15, '보닛에서 지붕 위로 (발 ' + j.z + ', x ' + j.x + ')');
  await p.waitForTimeout(600); await snap('on-car');
  await holdUntil('ArrowRight', async () => { const q = await jz(); return q.z === 0 && !q.on; }, 3000);
  j = await jz(); check(j.z === 0 && j.x > 48.8, '자동차에서 걸어 내려옴 (발 ' + j.z + ', x ' + j.x + ')');
  // 땅에서 한 번 점프로 1.15(쓰레기통 뚜껑)까지: 프레임이 느려도 정점이 같아야 한다
  await tp(24.4, -2.3); await p.waitForTimeout(400);
  j = await jumpMove('ArrowUp', 'S.z < -3.0'); check(j.z === 1.15, '한 번 점프로 쓰레기통 위 (발 ' + j.z + ', 느린 렌더링 fps ' + Math.round(await p.evaluate(() => __kk.fps)) + ')');
  await tp(24.4, -1.6); await p.waitForTimeout(400);
  check(await p.evaluate(() => !__kk.POLL.on && !__kk.POLL.pipe.visible), '3장 전에는 강이 맑고 배수관 없음');
  await near('meetDoor', 0, 0.6); await outdoorFrame('회의실 문 앞', 'meetDoor'); await snap('meet-door'); await labelsBelowTop('회의실 문 앞');
  await space(); check((await st()).mode === 'talk', '공장 전에는 회의실 잠김'); await finishTalk();
  await near('factoryDoor', 0, 0.6); await outdoorFrame('공장 문 앞', 'factoryDoor'); await snap('factory-door'); await labelsBelowTop('공장 문 앞'); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === 'factory'), '공장 안'); await p.waitForTimeout(500); await snap('factory-in'); await labelsBelowTop('공장 안');
  await holdUntil('ArrowUp', async () => (await st()).mode !== 'walk', 6000);
  for (let i = 0; i < 60 && (await st()).mode !== 'talk'; i++) await p.waitForTimeout(200); s = await st();
  check(s.mode === 'talk', '빈자리에 서면 점호 시작 (' + s.mode + ')'); await snap('rollcall-wide');
  await space(2); await p.waitForTimeout(500); await snap('rollcall-boss'); await dlgFit('점호'); await faceClear('공장장 대사');
  check(await p.evaluate(() => document.getElementById('cutin').classList.contains('hide')), '점호 원문 줄에 컷인 없음(같은 장 원문 줄 연출 같게)');
  s0 = await p.evaluate(() => { const c = __kk.camera, v = new c.position.constructor(40, 1.55, -82.2).project(c); return Math.round((-v.y * 0.5 + 0.5) * innerHeight); });
  s1 = await p.evaluate(() => Math.round(document.getElementById('dialogue').getBoundingClientRect().top));
  check(s0 > 60 && s0 < s1 - 20, '공장장 얼굴이 대사창 위에 보임 (얼굴 y ' + s0 + ', 대사창 ' + s1 + ')');
  await finishTalk(); await p.waitForTimeout(600);
  check((await st()).ex === 'panel', '점호 → 평가 패널 2장'); await p.waitForTimeout(300); await snap('panel2'); await fitCheck('2장'); await sceneImg('2장');
  await fill('#p-a4', '밤 10시까지 일했는데 돈을 더 주지 않았다.');
  await p.click('#ex-done'); await p.waitForTimeout(900); check((await st()).prog === 2, '2장 도장'); await finishTalk();
  check(await p.evaluate(() => __kk.POLL.on && __kk.POLL.pipe.visible), '2장을 마치면 강가에 배수관·더러운 물');
  await near('exit_factory', 0, -0.4); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('(0/3)')), '3장 퀘스트: 세 곳 (0/3)');
  // 3장 세 곳(순서 자유): 광고판 → 회의실 빈 의자 → 강가 순서로 가 본다. 곳마다 연출(검은 전환·카메라·강조·초상화)을 재서 셋이 같은지 본다
  const fx3 = {};
  const spotRun = async (id, tag) => {
    // 원문 줄이 뜰 때까지: 검은 전환이 있었는지, 카메라 연출이 켜졌는지
    let faded = false; const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      const r = await p.evaluate(() => [document.getElementById('fade').classList.contains('on'), __kk.S.mode, !document.getElementById('dialogue').classList.contains('hide')]);
      if (r[0]) faded = true;
      if (r[1] === 'talk' && r[2] && !r[0]) break;
      await p.waitForTimeout(40);
    }
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ talk: __kk.S.mode === 'talk', emph: document.getElementById('dialogue').classList.contains('emph'), cam: !!__kk.S.cam,
      face: !document.getElementById('dlg-big').classList.contains('hide'), cut: !document.getElementById('cutin').classList.contains('hide'), name: document.getElementById('dlg-name').textContent }));
    fx3[id] = JSON.stringify({ faded, emph: r.emph, cam: r.cam, face: r.face, cut: r.cut, name: r.name });
    check(r.talk && r.emph && faded && r.cam, tag + ' → 원문 대사 (' + fx3[id] + ')');
    await dlgFit(tag);
  };
  // 광고판: 앞까지 걸어가서 반짝이는 자리에 서기
  await near('adboard', 0, 2.2); await p.waitForTimeout(300); await labelsBelowTop('광고판 앞');
  await holdUntil('ArrowUp', async () => (await st()).mode !== 'walk', 6000);
  await spotRun('adboard', '광고판'); await snap('spot-ad'); await finishTalk(); await p.waitForTimeout(600);
  s = await st(); check(s.mode === 'walk' && s.ex !== 'panel' && s.flags.seen_adboard, '광고판만 보면 패널 안 열림 (' + s.mode + '/' + s.ex + ')');
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('(1/3)')), '퀘스트 (1/3)');
  // 회의실: 문 → 빈 의자
  await near('meetDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === 'meet'), '회의실 안'); await p.waitForTimeout(500); await snap('meet-in'); await labelsBelowTop('회의실 안');
  await holdUntil('ArrowUp', async () => (await st()).mode !== 'walk', 6000);
  await spotRun('seat', '회의실 빈 의자'); await snap('spot-meeting'); await finishTalk(); await p.waitForTimeout(600);
  s = await st(); check(s.mode === 'walk' && s.ex !== 'panel' && !(await p.evaluate(() => __kk.S.sit)), '두 곳 뒤에도 패널 안 열림, 의자에서 일어남 (' + s.mode + ')');
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('나가')), '안 본 곳이 바깥이면 나가기 안내');
  await near('exit_meet', 0, -0.4); await space(); await p.waitForTimeout(900);
  // 강가: 배수관 옆 자리로 걸어가기
  await near('riverside', -2.2, 0); await p.waitForTimeout(300); await labelsBelowTop('강가');
  await holdUntil('ArrowRight', async () => (await st()).mode !== 'walk', 6000);
  await spotRun('riverside', '강가'); await snap('spot-river');
  check(fx3.adboard === fx3.seat && fx3.seat === fx3.riverside, '세 곳 연출이 같음');
  await finishTalk(); await p.waitForTimeout(900);
  check((await st()).ex === 'panel', '세 곳을 다 보면 → 평가 패널 3장'); await p.waitForTimeout(300); await snap('panel3'); await fitCheck('3장'); await sceneImg('3장');
  await fill('#p-a5', '1,200원에 팔기로 스스로 결정했다.');
  await p.click('#ex-done'); await p.waitForTimeout(900); check((await st()).prog === 3, '3장 도장');
  await finishTalk(); await p.waitForTimeout(500);
  check((await st()).ex === 'notebook', '수첩 열림'); await snap('notebook');
  for (const t of [0, 1, 2]) { await p.click('#nb-tabs button[data-t="' + t + '"]'); await p.waitForTimeout(150); await fitCheck('수첩 ' + (t + 1) + '장', '#nb-left,#nb-right'); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); s = await st();
  check(s.ex === 'game' && s.mode === 'walk', 'Esc로 수첩 닫힘 (' + s.ex + '/' + s.mode + ')');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); s = await st();
  check(s.ex === 'notebook', 'Esc로 수첩 다시 열림 (' + s.ex + ')');
  await p.click('#nb-submit'); await p.waitForTimeout(300); await p.click('#ex-ask-yes'); await p.waitForTimeout(800);
  s = await st(); check(s.sub && s.ex === 'end', '제출 → 끝 화면'); await snap('end');
  // ── 제출 뒤 자유롭게 돌아다니기 ──
  const ansAtSubmit = JSON.stringify((await st()).ans);
  await p.waitForTimeout(200);
  check(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'end-roam', '끝 화면: "마을 돌아다니기"에 커서');
  const roamChecks = async (tag) => {
    s = await st();
    check(s.mode === 'walk' && s.ex === 'game' && (await p.evaluate(() => __kk.S.roam && __ex.roaming)), tag + ' 돌아다니기 모드 (' + s.mode + '/' + s.ex + ')');
    check(await p.evaluate(() => document.getElementById('ex-root').classList.contains('hide')), tag + ' 평가 화면 닫힘');
    check(s.quest === null && await p.evaluate(() => document.getElementById('quest-bar').style.display === 'none' && !__kk.arrow.visible && __kk.markers.every((m) => !m.g.visible)), tag + ' 퀘스트 안내·화살표·반짝이 숨김');
    check(await p.evaluate(() => __kk.gates.every((g) => g.open)), tag + ' 울타리 문 모두 열림');
    check(await p.evaluate(() => [...document.querySelectorAll('#labels .edge-arrow,#labels .tlabel')].every((e) => e.style.display === 'none')), tag + ' 목적지 이름표·가장자리 화살표 숨김');
  };
  await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  await roamChecks('Enter →'); await snap('roam');
  check(await p.evaluate(() => document.getElementById('kbd-nb').textContent.includes('내 답')), 'HUD 안내: Esc 내 답 보기');
  // 문마다 잠김 없이 들어갔다 나오기
  for (const [door, room] of [['martDoor', 'mart'], ['factoryDoor', 'factory'], ['meetDoor', 'meet']]) {
    await p.evaluate(() => { __kk.S.room = null; }); await near(door, 0, 0.6);
    const pr = await p.evaluate(() => document.querySelector('#labels .prompt').textContent);
    await space(); await p.waitForTimeout(900);
    check(await p.evaluate((r) => __kk.S.room === r, room), door + ' 바로 들어감 (말풍선 ' + pr + ')');
    await p.waitForTimeout(300); await snap('roam-' + room);
    // 평가 장면 자리: 말풍선 없음, Space는 점프, 반짝이 자리에 서도 장면이 시작되지 않음
    const sid = { mart: 'ramen', factory: 'rollcall', meet: 'seat' }[room];
    await near(sid, 0, room === 'mart' ? 0.1 : 0); await p.waitForTimeout(700);
    s = await st();
    const pr2 = await p.evaluate(() => { const e = document.querySelector('#labels .prompt'); return e.style.display === 'none' ? '' : e.textContent; });
    check(s.mode === 'walk' && s.ex === 'game', room + ' 평가 장면 자리에 서도 장면·패널 안 열림 (' + s.mode + '/' + s.ex + ')');
    await space(); await p.waitForTimeout(700); s = await st();
    check(s.ex === 'game' && (s.mode === 'walk' || s.mode === 'talk') && !pr2.includes('살펴') , room + ' 장면 자리 Space → 패널 안 열림 (말풍선 "' + pr2 + '")');
    await finishTalk(); await p.waitForTimeout(800);
    await near('exit_' + room, 0, -0.4); await space(); await p.waitForTimeout(900);
    check(await p.evaluate(() => __kk.S.room === null), room + ' 나가기');
  }
  // 회사 쪽에서 마을까지 문을 지나 걸어가기(막힘 없음)
  await tp(26, 2.2); await holdUntil('ArrowLeft', async () => (await st()).x < 18, 15000);
  s = await st(); check(s.x < 18 && s.mode === 'walk', '회사 → 마을 걸어서 돌아옴 (x=' + s.x.toFixed(1) + ')');
  // 내 답 다시 보기: Esc → 읽기 전용 수첩, 제출 버튼 없음, 글자 안 들어감
  await p.keyboard.press('Escape'); await p.waitForTimeout(400); s = await st();
  check(s.ex === 'notebook', '돌아다니다 Esc → 내 답 수첩 (' + s.ex + ')'); await snap('roam-notebook');
  check(await p.evaluate(() => [...document.querySelectorAll('#nb-qs input,#nb-qs textarea')].every((e) => e.readOnly) && document.getElementById('nb-submit').classList.contains('hide')), '수첩 읽기 전용·제출 버튼 없음');
  await p.focus('#nb-qs textarea, #nb-qs input'); await p.keyboard.type('고침'); await p.waitForTimeout(200);
  check(JSON.stringify((await st()).ans) === ansAtSubmit, '읽기 전용 칸에 글자를 쳐도 답 그대로');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400); s = await st();
  check(s.ex === 'game' && s.mode === 'walk', 'Esc → 끝 화면 말고 다시 마을 (' + s.ex + '/' + s.mode + ')');
  // 새로고침: 제출 상태 유지 → 끝 화면 → 다시 돌아다니기
  await p.reload(); await p.waitForFunction(() => window.__kk && __kk.S.mode === 'start', null, { timeout: 90000 });
  await p.fill('#in-ban', '0'); await p.fill('#in-num', '0'); await p.fill('#in-name', '테스트'); await p.click('#btn-start'); await p.waitForTimeout(800);
  s = await st(); check(s.sub && s.ex === 'end' && JSON.stringify(s.ans) === ansAtSubmit, '새로고침 → 제출 상태·답 그대로, 끝 화면');
  check(await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('kkokko3d-preview-server')); const v = Object.values(r)[0]; return v.submitted; }), '서버(스텁) 제출 상태 유지');
  await p.waitForTimeout(200); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  await roamChecks('새로고침 뒤'); await snap('roam-reload');
  s = await st(); check(s.x < -8 && !(await p.evaluate(() => __kk.S.room)) && await p.evaluate(() => !document.getElementById('hud').classList.contains('hide')), '새로고침 뒤 마을 입구에서 시작·HUD 보임 (x=' + s.x.toFixed(1) + ')');
  await near('meetDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === 'meet'), '새로고침 뒤에도 문 열림(회의실)');
  check(errs.length === 0, '콘솔 오류 없음 ' + errs.slice(0, 3).join(' | '));
  console.log(fails.length ? '실패 ' + fails.length : '모두 통과');
  await b.close(); process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
