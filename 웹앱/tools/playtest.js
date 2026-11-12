// 키보드만으로 끝까지 플레이하는 자동 검사.
// 쓰는 법: node tools/playtest.js <playwright가 깔린 폴더> <캡처 폴더> [너비] [높이]
const path = require('path');
const pwDir = process.argv[2], outDir = process.argv[3];
const W = +(process.argv[4] || 1366), H = +(process.argv[5] || 768);
const { chromium } = require(path.join(pwDir, 'node_modules', 'playwright'));
const fs = require('fs');
fs.mkdirSync(outDir, { recursive: true });
const url = 'file:///' + path.resolve(__dirname, '..', 'preview.html').replace(/\\/g, '/');
const fails = [];
function check(cond, msg) { if (!cond) { fails.push(msg); console.log('  ✗', msg); } else console.log('  ✓', msg); }

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  let shot = 0;
  const snap = async (name) => page.screenshot({ path: path.join(outDir, `${String(++shot).padStart(2, '0')}-${name}.png`) });
  const st = () => page.evaluate(() => ({ mode: __kk.S.mode, zone: __kk.S.zone, x: __kk.S.x, y: __kk.S.y, progress: __kk.S.progress, answers: __kk.S.answers, submitted: __kk.S.submitted, flags: __kk.S.flags }));
  const t0 = Date.now(); let walkMs = 0;

  async function walkTo(tx, ty, tol = 30, maxMs = 15000) {
    const start = Date.now(); let last = null, stuck = 0;
    while (Date.now() - start < maxMs) {
      const s = await st();
      if (s.mode !== 'walk') return s;
      if (last && Math.abs(last.x - s.x) < 1 && Math.abs(last.y - s.y) < 1) stuck++; else stuck = 0;
      last = s;
      if (stuck > 3) { await page.keyboard.down('ArrowDown'); await page.waitForTimeout(250); await page.keyboard.up('ArrowDown'); stuck = 0; continue; }
      const dx = tx - s.x, dy = ty - s.y;
      if (Math.abs(dx) < tol && Math.abs(dy) < tol) break;
      const kx = Math.abs(dx) >= tol ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : null;
      const ky = Math.abs(dy) >= tol ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : null;
      if (kx) await page.keyboard.down(kx); if (ky) await page.keyboard.down(ky);
      await page.waitForTimeout(80);
      if (kx) await page.keyboard.up(kx); if (ky) await page.keyboard.up(ky);
    }
    walkMs += Date.now() - start;
    return st();
  }
  async function walkRight(ms) {
    const s0 = Date.now(); const z0 = (await st()).zone;
    await page.keyboard.down('ArrowRight');
    while (Date.now() - s0 < 4000) { const q = await st(); if (q.zone !== z0 || q.mode !== 'walk') break; await page.waitForTimeout(60); }
    await page.keyboard.up('ArrowRight'); walkMs += Date.now() - s0;
  }
  async function waitMode(mode, ms = 2000) { const t = Date.now(); while (Date.now() - t < ms) { if ((await st()).mode === mode) return true; await page.waitForTimeout(80); } return false; }
  async function spaceUntil(mode, max = 20) {
    for (let i = 0; i < max; i++) { const s = await st(); if (s.mode === mode) return true; await page.keyboard.press('Space'); await page.waitForTimeout(120); }
    return (await st()).mode === mode;
  }
  async function zoneThing(id) { return page.evaluate((id) => { const Z = __kk.ZONES[__kk.S.zone]; return Z.things.find(t => t.id === id); }, id); }
  async function overflowCheck(sel, name) {
    const r = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, sw: e.scrollWidth, cw: e.clientWidth }; }, sel);
    check(r && r.l >= 0 && r.t >= 0 && r.r <= W + 1 && r.b <= H + 1, `${name} 화면 안에 있음 (${r && Math.round(r.r)}x${r && Math.round(r.b)} / ${W}x${H})`);
    check(r && r.sw <= r.cw + 1, `${name} 가로 넘침 없음`);
  }

  console.log(`[${W}x${H}] 시작`);
  await snap('start');
  await page.fill('#in-ban', '0'); await page.fill('#in-num', '0'); await page.fill('#in-name', '테스트');
  await page.click('#btn-start');
  await page.waitForTimeout(400);
  check((await st()).mode === 'guide', '시작 → 조작 안내');
  await snap('guide');
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  check((await st()).mode === 'walk', '안내 → 마을 걷기');
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  const jz = await page.evaluate(() => document.querySelector('.actor.hero .body').style.transform);
  check(/translateY\(-\d/.test(jz), '빈 곳에서 Space → 점프');
  await page.waitForTimeout(700);
  await snap('zone0');

  // 잠긴 오른쪽 출구
  await walkTo(915, 360);
  await walkRight(500);
  let s = await st();
  check(s.mode === 'talk' && s.zone === 0, '마트 전에는 오른쪽 출구가 막힘');
  await spaceUntil('walk');

  // 엄마 닭
  const mom = await zoneThing('mom');
  await walkTo(mom.x - 36, mom.y, 12);
  await page.waitForTimeout(100);
  check(await page.isVisible('#prompt'), '엄마 닭 근처에서 말 걸기 표시');
  await page.keyboard.press('Space'); await page.waitForTimeout(500);
  check((await st()).mode === 'talk', '엄마 닭 대화 시작');
  await snap('talk-mom');
  await spaceUntil('walk');

  // 마트 문 → 패널 1장
  const mart = await zoneThing('martDoor');
  await walkTo(mart.x, mart.y + 10, 24);
  await page.keyboard.press('Space'); await page.waitForTimeout(500);
  { const q = await st(); if (q.mode !== 'panel') console.log('    debug', JSON.stringify({ mode: q.mode, x: Math.round(q.x), y: Math.round(q.y), flags: q.flags, dlg: await page.textContent('#dlg-text') })); }
  check((await st()).mode === 'panel', '마트 문 → 평가 패널 1장');
  await overflowCheck('#panel', '패널');
  await snap('panel1');
  // 입력 중 방향키 → 꼬꼬 안 움직임
  const before = await st();
  await page.focus('#p-a0'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('공장에서 일하고 월급을 받는다');
  await page.fill('#p-a1', '라면을 만들어 판매한다');
  await page.fill('#p-a2', '월급'); await page.fill('#p-a3', '라면');
  await page.locator('#p-a3').dispatchEvent('input');
  const after = await st();
  check(before.x === after.x && before.y === after.y, '입력 중 방향키에 꼬꼬가 안 움직임');
  check(after.answers[0].includes('월급') && after.answers[3] === '라면', '1장 답 4칸이 상태에 들어감');
  await page.click('#panel-done'); await waitMode('talk');
  s = await st();
  check(s.progress === 1, '1장 도장 (progress 1)');
  await snap('stamp1');
  await spaceUntil('walk');

  // 공장 구역
  await walkTo(915, 360);
  await walkRight(500); await page.waitForTimeout(600);
  s = await st();
  check(s.zone === 1, '오른쪽 출구 → 공장 구역');
  await snap('zone1');
  const door = await zoneThing('factoryDoor');
  await walkTo(door.x, door.y + 10, 24);
  await page.keyboard.press('Space'); await page.waitForTimeout(400);
  check((await st()).mode === 'talk', '공장장과 말하기 전에는 공장 문이 안 열림');
  await spaceUntil('walk');
  const boss = await zoneThing('boss');
  await walkTo(boss.x - 40, boss.y);
  await page.keyboard.press('Space'); await page.waitForTimeout(400);
  await snap('talk-boss');
  const bossText = await page.textContent('#dlg-text');
  await spaceUntil('walk');
  check((await st()).flags.talkedBoss === true, '공장장 대화 후 문 열림 표시');
  await walkTo(door.x, door.y + 10, 24);
  await page.keyboard.press('Space'); await page.waitForTimeout(500);
  check((await st()).mode === 'panel', '공장 문 → 평가 패널 2장');
  await page.fill('#p-a4', '밤 10시까지 일했는데 돈을 더 주지 않았다.');
  await page.locator('#p-a4').dispatchEvent('input');
  await snap('panel2');
  await page.click('#panel-done'); await waitMode('talk');
  check((await st()).progress === 2, '2장 도장');
  await spaceUntil('walk');

  // 회의실 구역
  await walkTo(915, 360);
  await walkRight(500); await page.waitForTimeout(600);
  check((await st()).zone === 2, '공장 → 회의실 구역');
  await snap('zone2');
  const meet0 = await zoneThing('meetDoor');
  await walkTo(meet0.x, meet0.y + 10, 24);
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  check((await st()).mode === 'talk', '세 곳을 보기 전에는 회의실 문이 안 열림');
  await spaceUntil('walk');
  const fox = await zoneThing('fox');
  await walkTo(fox.x - 32, fox.y, 12);
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  check((await st()).mode === 'talk', '회의실 직원 말 걸기');
  await spaceUntil('walk');
  const river = await zoneThing('river');
  await walkTo(river.x, river.y - 12, 26);
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  check((await page.textContent('#dlg-text')).length >= 0 && (await st()).flags.seeRiver !== true, '순서를 건너뛴 강가는 아직 안 됨');
  await spaceUntil('walk');
  const ad = await zoneThing('ad');
  await walkTo(ad.x, ad.y + 20, 28);
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  check((await st()).mode === 'talk', '광고판 살펴보기');
  await spaceUntil('walk');
  await walkTo(river.x, river.y - 12, 26);
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  check((await st()).mode === 'talk', '강가 살펴보기');
  await spaceUntil('walk');
  const fl = (await st()).flags;
  check(fl.seeFox && fl.seeAd && fl.seeRiver, '세 곳을 다 보면 표시가 모두 켜짐');
  const meet = await zoneThing('meetDoor');
  await walkTo(meet.x, meet.y + 10, 24);
  await page.keyboard.press('Space'); await page.waitForTimeout(500);
  check((await st()).mode === 'panel', '회의실 문 → 평가 패널 3장');
  await page.fill('#p-a5', '1,200원에 팔기로 스스로 결정했다.');
  await page.locator('#p-a5').dispatchEvent('input');
  await snap('panel3');
  await page.click('#panel-done'); await waitMode('talk');
  check((await st()).progress === 3, '3장 도장');
  await spaceUntil('notebook');
  check((await st()).mode === 'notebook', '3장 뒤 수첩이 열림');
  await overflowCheck('#notebook', '수첩');
  await snap('notebook');

  // 새로고침 이어쓰기 (제출 전)
  await page.reload(); await page.waitForTimeout(300);
  await page.fill('#in-ban', '0'); await page.fill('#in-num', '0'); await page.fill('#in-name', '테스트');
  await page.click('#btn-start'); await page.waitForTimeout(500);
  s = await st();
  check(s.progress === 3 && s.answers[5].includes('1,200원') && s.mode === 'notebook', '새로고침 후 이어쓰기 (진행·답 유지)');

  // 저장 실패 → 배너
  await page.evaluate(() => { __stub.failNext = 3; });
  await page.fill('#n-a0', '바꾼 답'); await page.locator('#n-a0').dispatchEvent('input');
  await page.locator('#n-a0').blur();
  await page.waitForTimeout(3000);
  check(await page.isVisible('#banner'), '저장 실패 시 배너가 뜸');
  await snap('banner');
  await page.click('#banner-retry'); await page.waitForTimeout(600);
  check(!(await page.isVisible('#banner')), '다시 저장하면 배너가 사라짐');

  // 제출
  await page.click('#nb-submit'); await page.waitForTimeout(200);
  check(await page.isVisible('#ask'), '제출 확인 창');
  await page.click('#ask-yes'); await page.waitForTimeout(700);
  s = await st();
  check(s.submitted && s.mode === 'end', '제출 → 끝 화면');
  await snap('end');
  await page.reload(); await page.waitForTimeout(300);
  await page.fill('#in-ban', '0'); await page.fill('#in-num', '0'); await page.fill('#in-name', '테스트');
  await page.click('#btn-start'); await page.waitForTimeout(500);
  check((await st()).mode === 'end', '제출 뒤 다시 들어오면 끝 화면');
  await page.click('#end-view'); await page.waitForTimeout(200);
  check(await page.evaluate(() => document.querySelector('#n-a0').readOnly), '제출 뒤 수첩은 읽기 전용');

  check(errors.length === 0, '콘솔 오류 없음' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`걷기 조작 시간(자동) ${(walkMs / 1000).toFixed(1)}초, 전체 ${(Date.now() - t0) / 1000}초`);
  console.log(fails.length ? `실패 ${fails.length}개` : '모두 통과');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
