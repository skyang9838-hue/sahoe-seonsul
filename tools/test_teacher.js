// 교사 화면·반별 답안집 자동 시험 (Playwright, 로컬 스텁)
//   실행: node tools/test_teacher.js <playwright 폴더> <캡처 폴더>   (저장소 맨 위에서)
//   - game 폴더를 이 시험이 직접 띄운다(포트 KK_PORT, 기본 8781). 그래서 인정 단어는 가짜 목록(keywords.sample.json)이 쓰인다.
//   - 가짜 학생 26명(제출 23 · 작성 중 2 · 명단만 1)을 학생 스텁과 같은 localStorage 키(v3)에 심는다.
//   - 기대값은 game/src/scorer.js를 Node에서 그대로 돌려 낸다.
const path = require('path');
const fs = require('fs');
const http = require('http');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const GAME = path.join(ROOT, 'game');
const PW = process.argv[2], OUT = process.argv[3];
if (!PW || !OUT) { console.log('사용법: node tools/test_teacher.js <playwright 폴더> <캡처 폴더>'); process.exit(2); }
const { chromium } = require(path.join(PW, 'node_modules', 'playwright'));
fs.mkdirSync(OUT, { recursive: true });
const PORT = +(process.env.KK_PORT || 8781), BASE = 'http://127.0.0.1:' + PORT + '/';
const fails = []; let pass = 0;
const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (c) pass++; else fails.push(m); };
const section = (t) => console.log('— ' + t);

/* ── 정적 서버(game 폴더만) ── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, BASE).pathname);
  const f = path.normalize(path.join(GAME, u.endsWith('/') ? u + 'index.html' : u));
  if (!f.startsWith(GAME)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

/* ── 가짜 학생 ── */
// 가짜 인정 단어(keywords.sample.json) 기준: a0 정답 ㅁㅂ · a1 ㅅㅇ · a2 별빛조각 · a3 꿈빵 · a4 노을바람/새벽이슬 · a5 숲길지도 · a6 파랑나비 · a7 회색안개 · a8 초록우산
const LONG = (w) => (w + '라고 생각합니다. 왜냐하면 자료에서 그런 일이 있었기 때문입니다. ').repeat(5);
const PATTERNS = [
  ['ㅁㅂ', 'ㅅㅇ', '별빛조각', '꿈빵', '노을바람이 지켜지지 않았다.', '숲길지도를 활용해서 해결한다.', '파랑나비를 스스로 정했다.', '회색안개가 생겼다.', '초록우산을 만든다.'],   // 모두 🟢
  ['ㅁㅂ', 'ㅅㅇ', '별빛조각', '꿈빵', '노을바람', '숲길지도는 필요 없다', '파랑나비', '회색안개', '초록우산'],                                      // 2번 나) 반대 뜻 🟡
  ['ㅁㅂ', 'ㅅㅇ', '별빛조갹', '꿈빵', '새벽이슬을 못 지켰다', '숲길지도', '파랑나비', '회색안개', '초록우산'],                                       // 1번 (2) 오타 🟡
  ['ㄱㄷ', 'ㅅㅇ', '별빛조각', '꿈빵', '노을바람', '', '파랑나비', '회색안개', ''],                                                              // ○ ○ ○
  ['ㅁ', 'ㅅ', '', '모름', '잘 모르겠다', '', '몰라요', '', ''],                                                                                // △ △ △
  ['ㅁ', 'ㅅㅇ', '별빛조각', '꿈빵', '노을바람', '숲길지도', '파랑나비', '회색안개', '초록우산'],                                                    // 1번 ○ → 종합 ◎ 후보
  ['ㅁㅂ', 'ㅅㅇ', '별빛조각', '꿈빵', '노을바람', '숲길지도', '파랑나비', '회색안게가 생겼다', '초록우산'],                                          // 3번 오타 🟡
  ['ㅁㅂ', 'ㅅㅇ', '별빛조각', '꿈빵', LONG('노을바람'), LONG('숲길지도'), LONG('파랑나비'), LONG('회색안개'), LONG('초록우산')],                   // 긴 답
];
const NAMES = ['가람', '나래', '다온', '라온', '마루', '바다', '사랑', '아라', '자람', '차오', '카이', '타라', '파랑', '하늘', '가온', '나봄', '다솜', '로운', '미르', '보람', '새봄', '온유', '지음', '초롱', '토리', '한결'];
function seed() {
  const rows = {}, roster = { 3: {} };
  for (let n = 1; n <= 26; n++) {
    roster[3][n] = '가짜' + NAMES[n - 1];
    if (n === 26) continue;   // 명단에만 있고 들어오지 않은 학생
    const ans = PATTERNS[(n - 1) % PATTERNS.length].slice();
    const sub = n <= 23;
    rows['3/' + n] = { row: n + 1, answers: ans, submitted: sub, submittedAt: sub ? '2026-11-20 10:' + String(n).padStart(2, '0') : '', progress: sub ? 3 : 2, savedAt: '2026-11-20 10:' + String(n).padStart(2, '0') };
  }
  // 4반: 아주 긴 답 1명(글자를 줄여도 넘쳐야 함 → 경고)
  const huge = '아주 길게 쓴 답입니다. '.repeat(140);
  rows['4/1'] = { row: 30, answers: ['ㅁㅂ', 'ㅅㅇ', '별빛조각', '꿈빵', huge, huge, huge, huge, huge], submitted: true, submittedAt: '2026-11-20 11:00', progress: 3, savedAt: '2026-11-20 11:00' };
  return { rows, roster };
}

(async () => {
  const sc = await import(pathToFileURL(path.join(GAME, 'src', 'scorer.js')).href);
  const KW = JSON.parse(fs.readFileSync(path.join(GAME, 'src', 'keywords.sample.json'), 'utf8'));
  const { rows, roster } = seed();
  const isMark = (g) => ['◎', '○', '△'].includes(g);
  const EXP = {};   // 번호 → scorer 결과
  for (let n = 1; n <= 25; n++) EXP[n] = sc.gradeAnswers(rows['3/' + n].answers, KW);
  const IF = { 1: ['a0', 'a1', 'a2', 'a3'], 2: ['a4', 'a5'], 3: ['a6', 'a7', 'a8'] };
  const hasYellow = (r, item) => IF[item].some((k) => r.fields[k].state === 'yellow' || (r.fields[k].groups || []).some((g) => g.state === 'yellow'));
  const greenOnly = (r, item) => isMark(r.items[item - 1].grade) && !r.items[item - 1].check && !hasYellow(r, item);

  await new Promise((ok) => server.listen(PORT, '127.0.0.1', ok));
  const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  let shotN = 0; const snap = (pg, name) => pg.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-' + name + '.png') });
  const LS = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);

  /* 1. 학생 화면에 교사 화면 길이 없는지 */
  section('학생 화면에 교사 화면 링크 없음');
  const idx = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
  const studentJs = ['main.js', 'exam.js', 'story.js', 'config.js', 'chars.js', 'toon.js', 'srv.js'].map((f) => fs.readFileSync(path.join(GAME, 'src', f), 'utf8')).join('\n');
  check(!/teacher|print\.html|교사/.test(idx), 'index.html에 teacher·print·교사 글자 없음');
  check(!/teacher\.html|print\.html|teacher\.js|teacher-core/.test(studentJs), '학생 쪽 스크립트에 교사 화면 주소 없음');
  const tchSrc = ['teacher.js', 'teacher-core.js', 'print.js', 'items.js'].map((f) => fs.readFileSync(path.join(GAME, 'src', f), 'utf8')).join('\n');
  const privKw = path.join(ROOT, 'server', 'private', 'keywords.json');
  if (fs.existsSync(privKw)) {
    const words = new Set(); const kw = JSON.parse(fs.readFileSync(privKw, 'utf8'));
    Object.values(kw.fields).forEach((f) => (f.groups || []).forEach((g) => (g.words || []).concat(g.single || []).forEach((w) => { const s = typeof w === 'string' ? w : w.w; if (s && s.replace(/\s/g, '').length >= 3) words.add(s); })));
    const qText = tchSrc.match(/export const Q[123][\s\S]*?\};/g).join('\n');
    const leak = [...words].filter((w) => tchSrc.replace(qText, '').includes(w));
    check(leak.length === 0, '교사 화면 코드에 실제 인정 단어(3글자 이상 ' + words.size + '개) 없음 ' + leak.slice(0, 5).join(','));
  } else console.log('  (비공개 인정 단어 파일이 없어 유출 대조는 건너뜀)');
  // items.js 문구 = exam.js 1번 구역 문구
  const exam = fs.readFileSync(path.join(GAME, 'src', 'exam.js'), 'utf8');
  const pick = (src, name) => { const m = src.match(new RegExp('const ' + name + ' = (\\{[\\s\\S]*?\\});')); return m ? JSON.stringify(Function('return ' + m[1])()) : null; };
  const items = fs.readFileSync(path.join(GAME, 'src', 'items.js'), 'utf8');
  for (const q of ['Q1', 'Q2', 'Q3']) check(pick(exam, q) && pick(exam, q) === pick(items, q), 'items.js ' + q + ' 문구 = exam.js(기준본 대조된 원문)');

  /* 2. 로그인 */
  section('로그인');
  await p.goto(BASE + 'teacher.html');
  await p.evaluate(({ rows, roster }) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('kkokko3d-v3-server', JSON.stringify(rows)); localStorage.setItem('kkokko3d-v3-roster', JSON.stringify(roster)); }, { rows, roster });
  await p.reload(); await p.waitForSelector('#lg-pw');
  await snap(p, 'login-1366');
  await p.fill('#lg-pw', 'wrong'); await p.click('#lg-go'); await p.waitForTimeout(400);
  check(await p.evaluate(() => document.getElementById('lg-msg').textContent.includes('맞지 않아요') && document.getElementById('app').classList.contains('hide')), '틀린 비밀번호 → 안내, 화면 안 열림');
  check(await p.evaluate(() => !sessionStorage.getItem('kkokko3d-v3-token')), '틀리면 토큰 없음');
  await p.fill('#lg-pw', 'teacher'); await p.click('#lg-go');
  await p.waitForFunction(() => document.querySelectorAll('table.cls tbody tr').length > 0, null, { timeout: 8000 });
  check(true, '맞는 비밀번호 → 교사 화면');
  await p.waitForTimeout(500);

  /* 3. 반 표 */
  section('반 표');
  const tbl = await p.evaluate(() => ({ rows: document.querySelectorAll('table.cls tbody tr').length, tables: document.querySelectorAll('table.cls').length,
    sub: document.getElementById('st-sub').textContent, chk: document.getElementById('st-chk').textContent, ban: document.getElementById('ban').value,
    bans: [...document.querySelectorAll('#ban option')].map((o) => o.value) }));
  check(tbl.rows === 26 && tbl.tables === 2, '반 표 26명(두 칸으로 나눔) (' + tbl.rows + '행, 표 ' + tbl.tables + '개)');
  check(tbl.sub.replace(/\s/g, '') === '제출23/26', '제출 23/26 (' + tbl.sub + ')');
  const expChk = Object.values(EXP).filter((r) => r.items.some((it) => it.check) || r.total.check).length;
  check(tbl.chk.replace(/\s/g, '') === '확인필요' + expChk, '확인 필요 ' + expChk + '명 (' + tbl.chk + ')');
  check(tbl.ban === '3' && tbl.bans.join() === '3,4', '반 고르기: 3·4반, 3반 선택 (' + tbl.bans + ')');
  const cells = await p.evaluate(() => [...document.querySelectorAll('table.cls tbody tr')].map((tr) => ({ num: tr.dataset.num, stt: tr.querySelector('.stt').textContent, nm: tr.querySelector('.nm').textContent,
    g: [...tr.querySelectorAll('td.cell')].map((td) => { const c = td.querySelector('.chip'); return { t: c.textContent.replace(/[^◎○△미응답]/g, ''), cls: c.className }; }) })));
  let chipOk = true, chkOk = true;
  for (const c of cells) {
    const n = +c.num; if (n === 26) continue;
    const r = EXP[n];
    const want = r.items.map((it) => it.grade).concat(r.total.grade);
    if (c.g.map((x) => x.t).join() !== want.join()) { chipOk = false; console.log('    차이', n, c.g.map((x) => x.t), want); }
    r.items.forEach((it, i) => { if (it.check !== c.g[i].cls.includes('chk')) chkOk = false; });
    if (!c.g.every((x) => x.cls.includes('temp') || x.t === '미응답')) chipOk = false;
  }
  check(chipOk, '25명 칩 = scorer 임시 판정(1·2·3번·종합), 모두 임시(흐리게)');
  check(chkOk, '🟡 문항은 노랑 테두리(확인)');
  const c24 = cells.find((c) => c.num === '24'), c26 = cells.find((c) => c.num === '26'), c1 = cells.find((c) => c.num === '1');
  check(c1.stt.startsWith('제출') && c24.stt === '작성 중' && c26.stt === '미접속' && c26.g.every((x) => x.t === '미응답'), '상태: 제출 · 작성 중 · 미접속(명단만, 미응답 회색)');
  check(c1.nm === '가짜가람', '명단 이름 표시');
  const fitT = await p.evaluate(() => { const a = document.querySelector('.tbl-area'); return { sh: a.scrollHeight, ch: a.clientHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
  check(fitT.sh <= fitT.ch && fitT.sw <= fitT.iw, '1366×768: 반 표 26명이 스크롤 없이 한눈에 (높이 ' + fitT.sh + '/' + fitT.ch + ', 너비 ' + fitT.sw + '/' + fitT.iw + ')');
  // 칸 누르면 답 펼침
  await p.click('td.cell[data-num="2"][data-item="2"]'); await p.waitForTimeout(200);
  const det = await p.evaluate(() => ({ t: document.getElementById('detail').textContent, g: document.querySelectorAll('#detail mark.kw-g').length, y: document.querySelectorAll('#detail mark.kw-y').length, q: document.querySelector('#detail .kw-q') && document.querySelector('#detail .kw-q').textContent }));
  check(det.t.includes('숲길지도') && det.t.includes('는 필요 없다') && det.g >= 1 && det.y >= 1 && det.q === '→ 반대 뜻?', '칸 누르면 답 펼침: 🟢 형광펜·🟡 노랑 + "→ 반대 뜻?" (' + det.g + '/' + det.y + ')');
  await snap(p, 'table-detail-1366');
  await p.click('td.cell[data-num="3"][data-item="1"]'); await p.waitForTimeout(200);
  const det3 = await p.evaluate(() => ({ q: [...document.querySelectorAll('#detail .kw-q')].map((e) => e.textContent), sym: document.querySelector('#detail .sym') && document.querySelector('#detail .sym').textContent }));
  check(det3.q.includes('→ 별빛조각?'), '오타는 "→ 낱말?"로 어느 단어로 봤는지 표시 (' + det3.q + ')');
  check(det3.sym === '㉤', '기호 칸은 ㉠ 모양으로 표시 (' + det3.sym + ')');

  /* 4. 문항 탭 · 🟡만 보기 · 키보드 */
  section('문항 탭');
  await p.click('.tabs button[data-tab="2"]'); await p.waitForTimeout(250);
  const it2 = await p.evaluate(() => ({ n: document.querySelectorAll('#cards .card').length, q: document.getElementById('it-q').textContent, bulk: document.getElementById('btn-bulk').textContent,
    chips: document.querySelectorAll('#cards .bchip').length, marks: document.querySelectorAll('#cards .card .mk').length }));
  const expElig2 = Object.entries(EXP).filter(([n, r]) => +n <= 23 && greenOnly(r, 2)).map(([n]) => n);   // 제출한 학생만
  check(it2.n === 26 && it2.q.startsWith('2. <자료 2>'), '2번 탭: 학생 카드 26장, 발문 위에 (' + it2.n + ')');
  check(it2.chips > 0 && it2.marks === 26 * 3, '카드마다 근거 칩·[◎][○][△]');
  check(it2.bulk.includes('(' + expElig2.length + '명)'), '일괄 확정 대상 = 🟢만 있는 답 ' + expElig2.length + '명 (' + it2.bulk + ')');
  await snap(p, 'item2-1366');
  await p.click('#btn-yel'); await p.waitForTimeout(200);
  const yl = await p.evaluate(() => [...document.querySelectorAll('#cards .card')].map((c) => c.dataset.num));
  const expY2 = Object.entries(EXP).filter(([, r]) => hasYellow(r, 2) || r.items[1].check).map(([n]) => n);
  check(yl.join() === expY2.join() && yl.length > 0, '🟡만 보기: 🟡 답만 ' + yl.length + '장 (' + yl.join(',') + ')');
  await snap(p, 'item2-yellow-1366');
  // 키보드: 1 → ◎ 확정하고 다음으로, ← 돌아와 3 → △, ← Backspace → 확정 지움
  const first = yl[0];
  await p.keyboard.press('1'); await p.waitForTimeout(500);
  let G = await LS('kkokko3d-v3-grades');
  check(G && G['3/' + first] && G['3/' + first].final['2'] === '◎', '키보드 1 → ' + first + '번 2번 ◎ 확정 저장');
  check(await p.evaluate(() => __tch.V.cur) === 1, '판정하면 다음 학생으로');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  check(await p.evaluate(() => __tch.V.cur) === 0, '← 이전 학생');
  await p.keyboard.press('3'); await p.waitForTimeout(500);
  G = await LS('kkokko3d-v3-grades');
  check(G['3/' + first].final['2'] === '△', '키보드 3 → △로 바꿈');
  const curCard = await p.evaluate((n) => { const c = document.querySelector('#cards .card[data-num="' + n + '"] .chip'); return c.className + '|' + c.textContent; }, first);
  check(curCard.includes('conf') && curCard.includes('△'), '확정은 굵게(conf) 표시 (' + curCard + ')');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Backspace'); await p.waitForTimeout(500);
  G = await LS('kkokko3d-v3-grades');
  check(G['3/' + first].final['2'] === '', 'Backspace → 확정 지움(다시 임시)');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  check(await p.evaluate(() => __tch.V.cur) === Math.min(2, yl.length - 1), '→ 다음 학생');
  // 일괄 확정
  await p.click('#btn-yel'); await p.waitForTimeout(150);
  await p.click('#btn-bulk'); await p.waitForTimeout(700);
  G = await LS('kkokko3d-v3-grades');
  const bulkOk = expElig2.every((n) => G['3/' + n] && G['3/' + n].final['2'] === EXP[n].items[1].grade);
  const bulkNoY = Object.keys(EXP).filter((n) => !expElig2.includes(n)).every((n) => !G['3/' + n] || !G['3/' + n].final['2']);
  check(bulkOk, '일괄 확정: 🟢만 있는 ' + expElig2.length + '명 2번 = 임시 판정으로 확정');
  check(bulkNoY, '🟡·미응답 답, 작성 중(미제출) 학생은 일괄 확정에서 빠짐');
  check(await p.evaluate(() => document.getElementById('btn-bulk').disabled), '확정 뒤 일괄 확정 버튼 0명 → 꺼짐');
  // 1·3번도 일괄 확정 → 1번 학생(모두 🟢)은 종합이 다시 계산돼 확정
  for (const t of ['1', '3']) { await p.click('.tabs button[data-tab="' + t + '"]'); await p.waitForTimeout(150); await p.click('#btn-bulk'); await p.waitForTimeout(700); }
  G = await LS('kkokko3d-v3-grades');
  check(G['3/1'].final['1'] === '◎' && G['3/1'].final['3'] === '◎' && G['3/1'].final['종합'] === '◎' && G['3/1'].direct === false, '1·2·3번 모두 확정 → 종합 ◎ 다시 계산해 저장(직접 아님)');
  check(G['3/1'].auto['1'] === EXP[1].items[0].grade && G['3/2'].check === true, '임시 판정·확인 표시도 시트(스텁)에 기록');
  // 종합 직접: 반 표에서 종합 칸 → △ 직접 → 문항을 바꿔도 △ 유지 → 자동 계산으로
  await p.click('.tabs button[data-tab="table"]'); await p.waitForTimeout(150);
  await p.click('td.cell[data-num="1"][data-item="종합"]'); await p.waitForTimeout(150);
  await snap(p, 'table-total-1366');
  await p.click('#detail button.mk[data-v="△"]'); await p.waitForTimeout(500);
  G = await LS('kkokko3d-v3-grades');
  check(G['3/1'].final['종합'] === '△' && G['3/1'].direct === true, '종합을 직접 △ → 종합 직접 저장');
  await p.click('td.cell[data-num="1"][data-item="1"]'); await p.waitForTimeout(150);
  await p.keyboard.press('2'); await p.waitForTimeout(500);
  G = await LS('kkokko3d-v3-grades');
  check(G['3/1'].final['1'] === '○' && G['3/1'].final['종합'] === '△' && G['3/1'].direct === true, '문항을 바꿔도 직접 정한 종합이 우선');
  const tcell = await p.evaluate(() => document.querySelector('td.cell[data-num="1"][data-item="종합"]').textContent);
  check(tcell.includes('△') && tcell.includes('직접'), '반 표 종합 칸에 "직접" 표시 (' + tcell + ')');
  await p.click('td.cell[data-num="1"][data-item="종합"]'); await p.waitForTimeout(150);
  await p.click('#detail button.mk.auto'); await p.waitForTimeout(700);
  G = await LS('kkokko3d-v3-grades');
  check(G['3/1'].direct === false && G['3/1'].final['종합'] === '', '자동 계산으로 → 1번 ○·2·3번 ◎ = ◎ 후보(확인) → 종합 확정 비움');
  const tcell2 = await p.evaluate(() => document.querySelector('td.cell[data-num="1"][data-item="종합"]').textContent);
  check(tcell2.includes('◎') && tcell2.includes('후보'), '반 표 종합: ◎ 후보 (' + tcell2 + ')');
  // 새로고침해도 확정 그대로
  await p.reload(); await p.waitForFunction(() => document.querySelectorAll('table.cls tbody tr').length > 0, null, { timeout: 8000 }); await p.waitForTimeout(300);
  const after = await p.evaluate(() => { const c = document.querySelector('td.cell[data-num="1"][data-item="1"] .chip'); return c.className + '|' + c.textContent; });
  check(after.includes('conf') && after.includes('○'), '새로고침 뒤에도 확정(굵게) 유지 (' + after + ')');
  await snap(p, 'table-1366');

  /* 5. 반 마감 → 학생 쪽 읽기 전용 */
  section('반 마감');
  p.once('dialog', (d) => d.accept());
  await p.click('#btn-close'); await p.waitForTimeout(500);
  const closed = await LS('kkokko3d-v3-closed');
  check(closed && closed['3'] === true, '[반 마감] → 마감 저장(학생 스텁과 같은 키)');
  check(await p.evaluate(() => !document.getElementById('tag-closed').classList.contains('hide') && document.getElementById('btn-close').textContent === '마감 풀기'), '마감됨 표시 · 버튼은 "마감 풀기"');
  const stuSave = await p.evaluate(async () => { const m = await import('./src/srv.js?v=1'); const s = m.studentSrv(''); window.__stub.delay = 0;
    return new Promise((ok) => s.save({ ban: '3', num: '5', answers: Array(9).fill('마감뒤'), progress: 3 }, ok, ok)); });
  check(stuSave && stuSave.ok === false && stuSave.closed === true, '학생 스텁 저장 → 마감으로 거부');
  check((await LS('kkokko3d-v3-server'))['3/5'].answers[0] === rows['3/5'].answers[0], '거부된 저장은 답을 안 바꿈');
  // 실제 게임 화면(같은 저장소)에서 3반 1번으로 들어가면 읽기 전용
  {
    const g = await ctx.newPage(); g.on('pageerror', (e) => errs.push('game: ' + e));
    await g.goto(BASE + 'index.html');
    await g.waitForFunction(() => window.__kk && __kk.S.mode === 'start', null, { timeout: 120000 });
    await g.fill('#in-ban', '3'); await g.fill('#in-num', '1'); await g.click('#btn-start');
    await g.waitForFunction(() => window.__ex && __ex.S.row && __ex.mode === 'game', null, { timeout: 20000 }).catch(() => {});
    await g.waitForTimeout(1200);
    await g.keyboard.press('Escape'); await g.waitForTimeout(900);
    const ro = await g.evaluate(() => ({ closed: __ex.S.closed, note: (document.getElementById('nb-note') || {}).textContent || '',
      ro: [...document.querySelectorAll('#nb-qs input[data-i],#nb-qs textarea[data-i]')].every((e) => e.readOnly),
      sym: [...document.querySelectorAll('#nb-qs .sym')].every((e) => e.getAttribute('aria-disabled') === 'true'), edit: document.getElementById('nb-edit').classList.contains('hide') }));
    check(ro.closed && ro.note.includes('선생님이 마감했어요') && ro.ro && ro.sym && ro.edit, '게임 화면(3반 1번): 수첩 읽기 전용 · "선생님이 마감했어요" · 고치기 없음');
    await g.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-game-closed.png') });
    await g.close();
  }

  /* 6. 답안집 */
  section('반별 답안집');
  const [pr] = await Promise.all([ctx.waitForEvent('page'), p.click('#btn-print')]);
  pr.on('pageerror', (e) => errs.push('print: ' + e));
  await pr.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 15000 });
  const countPdf = async (pg) => { const buf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }); return (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length; };
  const sheetInfo = (pg) => pg.evaluate(() => ({ n: document.querySelectorAll('.sheet').length, over: +document.body.dataset.over, warn: !document.getElementById('warn').classList.contains('hide'),
    nums: [...document.querySelectorAll('.sheet')].map((s) => s.dataset.num), af: [...document.querySelectorAll('.sheet')].map((s) => s.dataset.af),
    head: document.querySelector('.sheet .who').textContent, overflow: [...document.querySelectorAll('.sheet .content')].filter((c) => c.scrollHeight > c.clientHeight + 1).length }));
  let si = await sheetInfo(pr);
  check(si.n === 23, '[답안집 PDF] → 제출 23명 = 23장 (' + si.n + ')');
  check(si.nums.join() === Array.from({ length: 23 }, (_, i) => String(i + 1)).join(), '번호순');
  check(si.head.replace(/\s+/g, '').startsWith('6학년3반1번(가짜가람)'), '위에 "6학년 3반 1번 (이름)" (' + si.head.trim() + ')');
  check(si.over === 0 && !si.warn && si.overflow === 0, '쪽 넘침 없음(경고 없음)');
  const longAf = si.af.filter((_, i) => (i % PATTERNS.length) === 7);
  check(longAf.length > 0 && longAf.every((v) => +v < 10), '긴 답은 글자를 줄여 한 장에 (' + longAf.join(',') + 'pt)');
  let pages = await countPdf(pr);
  check(pages === 23, 'PDF 쪽 수 = 23 (' + pages + ')');
  const s1 = await pr.evaluate(() => { const s = document.querySelectorAll('.sheet'); return { a: s[0].textContent, d: s[3].textContent, box: s[0].querySelectorAll('.box').length, lines: s[0].querySelectorAll('.alines').length }; });
  check(s1.a.includes('㉤, ㉥') && s1.d.includes('㉠, ㉢'), '기호는 ㉠ 모양으로 (1번 ㉤, ㉥ · 4번 ㉠, ㉢)');
  check(s1.box === 4 && s1.lines === 7 && s1.a.includes('<보기>') && s1.a.includes('<조건>') && s1.a.includes('별빛조각'), '문항 쪽 모양: <보기>·(2) 빈칸·<조건> 상자 4개, 답 줄 7곳, 칸에 학생 답');
  check(!(await pr.evaluate(() => document.querySelector('.jm'))), '판정 넣기 꺼짐(기본) → 판정 없음');
  await pr.setViewportSize({ width: 1366, height: 768 }); await snap(pr, 'print-1366');
  await pr.click('#opt-grade'); await pr.waitForTimeout(300);
  const gj = await pr.evaluate(() => ({ jm: document.querySelectorAll('.sheet:first-child .jm').length, tot: (document.querySelector('.sheet:first-child .tot') || {}).textContent }));
  check(gj.jm === 3 && /종합/.test(gj.tot || ''), '판정 넣기 켬 → 문항 옆 판정 3개 · 종합 (' + gj.tot + ')');
  await pr.click('#opt-missing'); await pr.waitForTimeout(300);
  si = await sheetInfo(pr);
  check(si.n === 26 && si.over === 0 && si.overflow === 0, '미제출 장 켬 → 26장(작성 중 2 + 명단만 1), 넘침 없음 (' + si.n + ')');
  check(await pr.evaluate(() => [...document.querySelectorAll('.sheet')].filter((s) => s.querySelector('.stamp')).map((s) => s.dataset.num).join()) === '24,25,26', '미제출 장에 "미제출" 표시 (24·25·26번)');
  pages = await countPdf(pr);
  check(pages === 26, 'PDF 쪽 수 = 26 (' + pages + ')');
  await pr.emulateMedia({ media: 'print' });
  const printOver = await pr.evaluate(() => [...document.querySelectorAll('.sheet .content')].filter((c) => c.scrollHeight > c.clientHeight + 1).length);
  check(printOver === 0, '인쇄 모양에서도 넘친 장 0');
  await pr.emulateMedia({ media: null });
  fs.writeFileSync(path.join(OUT, 'answerbook-3반.pdf'), await pr.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
  // 4반: 글자를 줄여도 넘치는 답 → 경고
  await pr.goto(BASE + 'print.html?ban=4'); await pr.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 15000 });
  si = await sheetInfo(pr);
  check(si.n === 1 && si.over === 1 && si.warn, '아주 긴 답(4반) → 한 장을 넘으면 화면에 경고');
  { const n4 = await countPdf(pr); check(n4 === 1, '넘쳐도 그 학생은 1장(뒤 장으로 밀리지 않음) (' + n4 + ')'); }
  fs.writeFileSync(path.join(OUT, 'answerbook-4반-넘침.pdf'), await pr.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
  await snap(pr, 'print-overflow-warn');
  // 기준본과 나란히 볼 캡처(110dpi = 기준본 그림과 같은 배율)
  {
    const c2 = await b.newContext({ viewport: { width: 1000, height: 1300 }, deviceScaleFactor: 110 / 96 });
    const q = await c2.newPage();
    await q.goto(BASE + 'teacher.html');
    await q.evaluate(({ rows, roster }) => { localStorage.setItem('kkokko3d-v3-server', JSON.stringify(rows)); localStorage.setItem('kkokko3d-v3-roster', JSON.stringify(roster)); }, { rows, roster });
    await q.goto(BASE + 'print.html?ban=3&grade=0');
    await q.fill('#lg-pw', 'teacher'); await q.click('#lg-go');
    await q.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 15000 });
    await q.locator('.sheet').first().screenshot({ path: path.join(OUT, 'print-sheet1-110dpi.png') });
    await q.locator('.sheet').nth(7).screenshot({ path: path.join(OUT, 'print-sheet8-long-110dpi.png') });
    await c2.close();
  }
  await pr.close();

  /* 7. 1280×720 · 로그아웃 */
  section('1280×720 · 로그아웃');
  await p.setViewportSize({ width: 1280, height: 720 }); await p.waitForTimeout(300);
  const f12 = await p.evaluate(() => { const a = document.querySelector('.tbl-area'); return { sh: a.scrollHeight, ch: a.clientHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, bar: document.querySelector('.bar').getBoundingClientRect().height }; });
  check(f12.sh <= f12.ch && f12.sw <= f12.iw, '1280×720: 반 표 스크롤 없음·가로 넘침 없음 (높이 ' + f12.sh + '/' + f12.ch + ', 너비 ' + f12.sw + '/' + f12.iw + ', 위 띠 ' + Math.round(f12.bar) + 'px)');
  await p.click('td.cell[data-num="7"][data-item="3"]'); await p.waitForTimeout(150);
  await snap(p, 'table-detail-1280');
  await p.click('.tabs button[data-tab="3"]'); await p.waitForTimeout(150);
  await snap(p, 'item3-1280');
  await p.click('#btn-yel'); await p.waitForTimeout(150);
  await snap(p, 'item3-yellow-1280');
  await p.setViewportSize({ width: 1366, height: 768 });
  await p.click('#btn-out'); await p.waitForTimeout(200);
  check(await p.evaluate(() => !!document.getElementById('lg-pw') && document.getElementById('app').classList.contains('hide') && !sessionStorage.getItem('kkokko3d-v3-token')), '나가기 → 로그인 화면, 토큰 지움');
  // 토큰 없이 직접 답안집 주소 → 로그인 먼저
  await p.goto(BASE + 'print.html?ban=3'); await p.waitForTimeout(400);
  check(await p.evaluate(() => !!document.getElementById('lg-pw') && document.querySelectorAll('.sheet').length === 0), '로그인 없이 답안집 주소 → 로그인 상자만(답 안 보임)');

  check(errs.length === 0, '페이지 오류 없음 ' + errs.slice(0, 3).join(' / '));
  await b.close(); server.close();
  console.log('\n교사 화면 시험: 통과 ' + pass + ' · 실패 ' + fails.length);
  console.log('캡처: ' + OUT);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
