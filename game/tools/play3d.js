// 3D 판 자동 플레이 검사: node tools/play3d.js <playwright 폴더> <캡처 폴더> [너비] [높이]
const path = require('path');
const { chromium } = require(path.join(process.argv[2], 'node_modules', 'playwright'));
const out = process.argv[3], W = +(process.argv[4] || 1366), H = +(process.argv[5] || 768);
const URL = 'http://127.0.0.1:8765/';
const fails = []; const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails.push(m); };
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
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

  await snap('start');
  await p.fill('#in-ban', '0'); await p.fill('#in-num', '0'); await p.fill('#in-name', '테스트'); await p.click('#btn-start');
  check(await waitMode('comic', 5000), '출근하기 → 오프닝 컷신');
  await p.waitForTimeout(900); await snap('comic1');
  for (let i = 0; i < 8 && (await st()).mode === 'comic'; i++) { await space(); await p.waitForTimeout(250); }
  check(await waitMode('walk', 5000), '컷신 끝 → 마을 걷기');
  await p.waitForTimeout(700); await snap('village');
  let s = await st(); check(s.quest === 'mom', '첫 퀘스트: 엄마 닭 (' + s.quest + ')');
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
  // 엄마 닭
  await near('mom', -1.0, 0.2); await space(); check((await st()).mode === 'talk', '엄마 닭 말 걸기'); await p.waitForTimeout(700); await snap('talk-mom'); await finishTalk();
  check((await st()).flags.talkedMom === true, '엄마 닭 표시');
  // 패널 스크롤 없는지 + 대사창 잘림 없는지
  const fitCheck = async (tag) => { const r = await p.evaluate(() => [...document.querySelectorAll('#ex-left,#ex-right')].map((e) => e.scrollHeight - e.clientHeight)); check(r.every((v) => v <= 2), tag + ' 패널 스크롤 없음 (' + r.join(',') + ')'); };
  const dlgFit = async (tag) => { const r = await p.evaluate(() => { const d = document.getElementById('dialogue').getBoundingClientRect(); return [d.top, d.bottom, innerHeight]; }); check(r[0] > 0 && r[1] <= r[2], tag + ' 대사창 화면 안 (' + r.map(Math.round).join(',') + ')'); };
  const fill = async (id, v) => { await p.fill(id, v); await p.dispatchEvent(id, 'input'); };
  // 마트 안으로
  await near('martDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  s = await p.evaluate(() => __kk.S.room); check(s === 'mart', '마트 문 → 마트 안 (' + s + ')');
  await snap('mart-in');
  // 라면 칸까지 실제로 걸어가기(위로)
  await holdUntil('ArrowUp', async () => (await st()).z < -82.4, 6000);
  await near('ramen', 0, 0.1); await space(); await p.waitForTimeout(1300);
  check((await st()).mode === 'talk', '라면 칸 → 원문 대사'); await dlgFit('라면'); await snap('ramen-closeup');
  check(await p.evaluate(() => document.getElementById('dialogue').classList.contains('emph')), '원문 줄 강조');
  await finishTalk(); await p.waitForTimeout(600);
  check((await st()).ex === 'panel', '라면 대사 → 평가 패널 1장'); await p.waitForTimeout(300); await snap('panel1'); await fitCheck('1장');
  await fill('#p-a0', '공장에서 일하고 월급을 받는다'); await fill('#p-a1', '라면을 만들어 판매한다'); await fill('#p-a2', '월급'); await fill('#p-a3', '라면');
  await p.click('#ex-done'); await p.waitForTimeout(900);
  s = await st(); check(s.prog === 1, '1장 도장 (진행 ' + s.prog + ')'); await finishTalk();
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('나가')), '안에서는 나가기 안내');
  await near('exit_mart', 0, -0.4); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === null), '나가기 → 마을');
  // 회사로 걸어가기
  await tp(19, 2.2); await holdUntil('ArrowRight', async () => (await st()).x > 23, 15000);
  s = await st(); check(s.x > 23, '문 열림 → 회사로 걸어 들어감 (x=' + s.x.toFixed(1) + ')');
  await p.waitForTimeout(900); await snap('company');
  await near('meetDoor', 0, 0.6); await space(); check((await st()).mode === 'talk', '공장 전에는 회의실 잠김'); await finishTalk();
  await near('factoryDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === 'factory'), '공장 안'); await snap('factory-in');
  await holdUntil('ArrowUp', async () => (await st()).mode !== 'walk', 6000);
  for (let i = 0; i < 60 && (await st()).mode !== 'talk'; i++) await p.waitForTimeout(200); s = await st();
  check(s.mode === 'talk', '빈자리에 서면 점호 시작 (' + s.mode + ')'); await snap('rollcall-wide');
  await space(2); await p.waitForTimeout(500); await snap('rollcall-boss'); await dlgFit('점호');
  await finishTalk(); await p.waitForTimeout(600);
  check((await st()).ex === 'panel', '점호 → 평가 패널 2장'); await p.waitForTimeout(300); await snap('panel2'); await fitCheck('2장');
  await fill('#p-a4', '밤 10시까지 일했는데 돈을 더 주지 않았다.');
  await p.click('#ex-done'); await p.waitForTimeout(900); check((await st()).prog === 2, '2장 도장'); await finishTalk();
  await near('exit_factory', 0, -0.4); await space(); await p.waitForTimeout(900);
  await near('meetDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === 'meet'), '회의실 안'); await snap('meet-in');
  await holdUntil('ArrowUp', async () => (await st()).mode !== 'walk', 6000);
  await p.waitForTimeout(1600); s = await st(); check(s.mode === 'talk', '빈 의자 → 회의 시작'); await snap('meeting-fox');
  await space(2); await p.waitForTimeout(1200); await snap('meeting-ad');
  await space(2); await p.waitForTimeout(1200); await snap('meeting-river');
  await finishTalk(); await p.waitForTimeout(700);
  check((await st()).ex === 'panel', '회의 → 평가 패널 3장'); await p.waitForTimeout(300); await snap('panel3'); await fitCheck('3장');
  await fill('#p-a5', '1,200원에 팔기로 스스로 결정했다.');
  await p.click('#ex-done'); await p.waitForTimeout(900); check((await st()).prog === 3, '3장 도장');
  await finishTalk(); await p.waitForTimeout(500);
  check((await st()).ex === 'notebook', '수첩 열림'); await snap('notebook');
  await p.click('#nb-submit'); await p.waitForTimeout(300); await p.click('#ex-ask-yes'); await p.waitForTimeout(800);
  s = await st(); check(s.sub && s.ex === 'end', '제출 → 끝 화면'); await snap('end');
  check(errs.length === 0, '콘솔 오류 없음 ' + errs.slice(0, 3).join(' | '));
  console.log(fails.length ? '실패 ' + fails.length : '모두 통과');
  await b.close(); process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
