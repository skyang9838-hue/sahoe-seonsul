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
  async function holdUntil(key, cond, ms = 9000) { await p.keyboard.down(key); const t = Date.now(); while (Date.now() - t < ms) { if (await cond()) break; await p.waitForTimeout(80); } await p.keyboard.up(key); }

  let s0, s1;
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
  check(await waitMode('walk', 5000), '컷신 끝 → 마을 걷기');
  await p.waitForTimeout(700); await snap('village');
  let s = await st(); check(s.quest === 'mom', '첫 퀘스트: 엄마 닭 (' + s.quest + ')');
  check(await p.evaluate(() => getComputedStyle(document.getElementById('fps')).display === 'none'), 'fps 숫자 숨김(?debug 아닐 때)');
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('엄마')), '위쪽 퀘스트 문구');
  // 점프
  await p.keyboard.press('Space');
  let jmax = 0; for (let i = 0; i < 40; i++) { jmax = Math.max(jmax, await p.evaluate(() => __kk.J.z)); if (jmax > 0.5) break; await p.waitForTimeout(60); }
  check(jmax > 0.5, '빈 곳 Space → 점프 (최고 ' + jmax.toFixed(2) + ')');
  await p.waitForTimeout(1500);
  // 마트 문 먼저 → 잠김
  await near('martDoor', 0, 0.6); await space(); s = await st();
  check(s.mode === 'talk', '엄마 닭 전에는 마트 문 잠김'); await finishTalk();
  // 문 잠긴 채 오른쪽 문으로 → 막힘
  await tp(19.2, 2.2); await holdUntil('ArrowRight', async () => (await st()).mode === 'talk', 3000);
  s = await st(); check(s.mode === 'talk' && s.x < 21, '마트 전에는 회사 가는 문이 막힘'); await finishTalk();
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
    check(r.nw > 0 && crop < 0.04, tag + ' 장면 그림 비율 맞음 (그림 ' + r.nw + '×' + r.nh + ', 칸 ' + r.bw + '×' + r.bh + ', 잘림 ' + Math.round(crop * 100) + '%)');
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
  const fill = async (id, v) => { await p.fill(id, v); await p.dispatchEvent(id, 'input'); };
  // 엄마 닭
  await near('mom', -1.0, 0.2); await p.waitForTimeout(300); await labelsBelowTop('엄마 닭 옆'); await space(); check((await st()).mode === 'talk', '엄마 닭 말 걸기'); await p.waitForTimeout(700); await snap('talk-mom'); await finishTalk();
  check((await st()).flags.talkedMom === true, '엄마 닭 표시');
  // 마트 안으로
  await near('martDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
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
  check(await p.evaluate(() => !__kk.POLL.on && !__kk.POLL.pipe.visible), '3장 전에는 강이 맑고 배수관 없음');
  await near('meetDoor', 0, 0.6); await p.waitForTimeout(300); await labelsBelowTop('회의실 문 앞');
  await space(); check((await st()).mode === 'talk', '공장 전에는 회의실 잠김'); await finishTalk();
  await near('factoryDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
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
  check(errs.length === 0, '콘솔 오류 없음 ' + errs.slice(0, 3).join(' | '));
  console.log(fails.length ? '실패 ' + fails.length : '모두 통과');
  await b.close(); process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
