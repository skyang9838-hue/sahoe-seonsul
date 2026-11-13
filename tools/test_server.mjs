// 서버(server/Code.gs) 시험 — 실행: node tools/test_server.mjs  (저장소 맨 위에서)
// GAS는 여기서 배포할 수 없으니 SpreadsheetApp·LockService·CacheService·PropertiesService·ContentService·Utilities를
// 흉내 낸 작은 가짜 위에서 Code.gs를 그대로 돌려 라우팅·잠금·마감·토큰·채점 저장을 본다.
// 끝에 로컬 스텁(game/src/srv.js)도 같은 장면으로 돌려 응답 모양(키)이 서버와 같은지 대조한다.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE = readFileSync(join(ROOT, 'server', 'Code.gs'), 'utf8');
const SAMPLE_KW = JSON.parse(readFileSync(join(ROOT, 'game', 'src', 'keywords.sample.json'), 'utf8'));

let pass = 0; const fails = [];
const check = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } };
const section = (t) => console.log('— ' + t);

/* ── 가짜 GAS ─────────────────────────────── */
function makeGas() {
  const clock = { t: Date.UTC(2026, 10, 20, 0, 30, 0) };   // 2026-11-20 09:30 (서울)
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(clock.t); } static now() { return clock.t; } }
  const lock = { held: false, busy: false, waits: 0 };
  const violations = [];
  const logs = [];
  const props = {};
  const cache = {};

  class Range {
    constructor(sh, r, c, nr = 1, nc = 1) { Object.assign(this, { sh, r, c, nr, nc }); }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j)); out.push(row); }
      return out;
    }
    getValue() { return this.sh.get(this.r, this.c); }
    setValues(v) {
      if (v.length !== this.nr || v.some((row) => row.length !== this.nc)) throw new Error('setValues 크기가 범위와 다름 ' + this.nr + 'x' + this.nc);
      if (this.sh.watch && !lock.held) violations.push(this.sh.name + ' ' + this.r + '행을 락 없이 씀');
      v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x)));
      return this;
    }
    setValue(x) { return this.setValues([[x]]); }
    clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.set(this.r + i, this.c + j, ''); return this; }
    setNumberFormat() { return this; } setFontWeight() { return this; } setBackground() { return this; } setWrap() { return this; } setVerticalAlignment() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.cells = new Map(); this.hidden = false; this.cols = 26; this.watch = true; this.writes = 0; }
    key(r, c) { return r + ',' + c; }
    get(r, c) { const v = this.cells.get(this.key(r, c)); return v === undefined ? '' : v; }
    set(r, c, v) {
      this.writes++;
      // 진짜 시트처럼: 맨 앞 ' 는 글자로 저장하라는 표시라 값에는 안 남는다. 그렇지 않은 =로 시작하는 글은 수식이 된다
      if (typeof v === 'string' && v[0] === "'") v = v.slice(1);
      else if (typeof v === 'string' && v[0] === '=') v = { formula: v };
      if (v === '' || v == null) this.cells.delete(this.key(r, c)); else this.cells.set(this.key(r, c), v);
    }
    getRange(r, c, nr, nc) { if (r < 1 || c < 1) throw new Error('범위 오류'); return new Range(this, r, c, nr, nc); }
    getLastRow() { let m = 0; for (const k of this.cells.keys()) m = Math.max(m, +k.split(',')[0]); return m; }
    getMaxRows() { return 1000; } getMaxColumns() { return this.cols; }
    insertColumnsAfter(_, n) { this.cols += n; }
    setFrozenRows() {} setColumnWidth() {}
    hideSheet() { this.hidden = true; return this; }
    row(r, n) { return this.getRange(r, 1, 1, n).getValues()[0]; }
  }
  const ss = { sheets: {}, getSheetByName(n) { return this.sheets[n] || null; }, insertSheet(n) { if (lock.held === false) violations.push(n + ' 탭을 락 없이 만듦'); return (this.sheets[n] = new Sheet(n)); } };

  const ctx = {
    Date: FakeDate, JSON, Math, Number, String, Array, Object, Error, isFinite, parseInt,
    SpreadsheetApp: { getActive: () => ss },
    LockService: { getScriptLock: () => ({
      waitLock() { lock.waits++; if (lock.busy || lock.held) throw new Error('잠금 대기 시간 초과'); lock.held = true; },
      releaseLock() { lock.held = false; },
    }) },
    CacheService: { getScriptCache: () => ({
      put(k, v, ttl) { cache[k] = { v: String(v), until: clock.t + ttl * 1000 }; },
      get(k) { const e = cache[k]; return e && e.until > clock.t ? e.v : null; },
      remove(k) { delete cache[k]; },
    }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (s) => ({ s, mime: '', setMimeType(m) { this.mime = m; return this; }, getContent() { return this.s; } }) },
    Utilities: {
      getUuid: () => randomUUID(),
      formatDate(d, tz, fmt) {
        const k = new Date(d.getTime() + 9 * 3600 * 1000), p = (n) => String(n).padStart(2, '0');
        return fmt.replace('yyyy', k.getUTCFullYear()).replace('MM', p(k.getUTCMonth() + 1)).replace('dd', p(k.getUTCDate()))
          .replace('HH', p(k.getUTCHours())).replace('mm', p(k.getUTCMinutes())).replace('ss', p(k.getUTCSeconds()));
      },
    },
    Logger: { log: (m) => logs.push(String(m)) },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx, { filename: 'Code.gs' });
  const post = (body) => {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    const out = ctx.doPost({ postData: { contents: raw, type: 'text/plain' } });
    if (out.mime !== 'application/json') violations.push('응답 형식이 JSON이 아님');
    return JSON.parse(out.getContent());
  };
  return { ctx, ss, lock, clock, props, cache, logs, violations, post, tick: (sec) => { clock.t += sec * 1000; } };
}

const A9 = (fill) => Array.from({ length: 9 }, (_, i) => (typeof fill === 'function' ? fill(i) : fill));

/* ── 1. 라우팅 ────────────────────────────── */
section('라우팅');
{
  const g = makeGas();
  const get = JSON.parse(g.ctx.doGet().getContent());
  check(get.ok === true, 'doGet은 켜져 있다는 JSON');
  check(g.post('{깨진').ok === false, '깨진 JSON은 ok:false');
  check(/알 수 없는/.test(g.post({ action: 'hack' }).msg), '모르는 action은 거부');
  check(g.post({}).ok === false, 'action 없음은 거부');
  check(g.post({ action: 'register', ban: '', num: '3' }).ok === false, '반 비면 등록 거부');
  check(g.post({ action: 'register', ban: '3', num: '삼' }).ok === false, '번호가 숫자가 아니면 거부');
  check(g.post({ action: 'register', ban: '123', num: '3' }).ok === false, '반 세 자리는 거부');
  check(!g.ss.getSheetByName('답안'), '잘못된 등록은 탭도 안 만듦');
}

/* ── 2. 학생: 등록·저장·제출 ──────────────── */
section('학생 등록·저장·제출');
{
  const g = makeGas();
  const r1 = g.post({ action: 'register', ban: '3', num: '5' });
  check(r1.ok && r1.row === 2 && r1.answers.length === 9 && r1.answers.every((x) => x === '') && r1.submitted === false && r1.closed === false && r1.progress === 0,
    '첫 등록 = 2행, 빈 답 9칸, 마감 아님');
  const sh = g.ss.getSheetByName('답안');
  check(sh && sh.row(1, 16).join('|') === '반|번호|1(1) 가계|1(1) 기업|1(2) ①|1(2) ②|2 가)|2 나)|3 가)|3 나) 문제점|3 나) 개선|상태|진행|마지막 저장|제출 시각|최초 접속', '답안 탭 머리줄 16열');
  check(sh.get(2, 16) === '2026-11-20 09:30:00', '최초 접속 시각(서울 시간)');
  const r2 = g.post({ action: 'register', ban: '03', num: '05' });
  check(r2.ok && r2.row === 2, '03·05도 같은 학생(앞의 0 무시)');
  check(g.post({ action: 'register', ban: '3', num: '6' }).row === 3, '다른 번호는 새 행');
  check(sh.getLastRow() === 3, '행 2개만');

  check(/새로고침/.test(g.post({ action: 'save', ban: '3', num: '5', answers: ['a'], progress: 1 }).msg), '칸 수가 9가 아니면 거부');
  check(g.post({ action: 'save', ban: '3', num: '5', answers: 'x', progress: 1 }).ok === false, 'answers가 배열이 아니면 거부');
  check(/등록되지 않은/.test(g.post({ action: 'save', ban: '3', num: '9', answers: A9(''), progress: 1 }).msg), '등록 안 한 번호는 거부');
  check(g.post({ action: 'save', ban: 'x', num: '5', answers: A9('') }).ok === false, '반 이상하면 거부');

  g.tick(65);
  const ans = ['ㄱㄷ', 'ㄴㄹ', '별빛조각', '꿈빵', '=HYPERLINK("http://x","눌러")', '+보라구름', '라면 가격을 정했다', '-회색안개를 버렸다', '@초록 시설'];
  const s1 = g.post({ action: 'save', ban: '3', num: '5', answers: ans, progress: 2 });
  check(s1.ok && s1.at === '2026-11-20 09:31' && s1.submitted === false && s1.closed === false && s1.submittedAt === '', '저장 응답(분까지 시각, 제출 아님)');
  check(sh.get(2, 3) === 'ㄱㄷ' && sh.get(2, 11) === '@초록 시설', '답이 C~K열에');
  check(sh.get(2, 7) === ans[4] && typeof sh.get(2, 7) === 'string', '=로 시작하는 답은 수식이 아니라 글자로 저장');
  check(sh.get(2, 12) === '작성중' && sh.get(2, 13) === 2 && sh.get(2, 14) === '2026-11-20 09:31:05', '상태·진행·마지막 저장');
  const back = g.post({ action: 'register', ban: '3', num: '5' });
  check(JSON.stringify(back.answers) === JSON.stringify(ans), '이어하기에서 답 9칸이 그대로(앞 기호까지)');
  check(back.progress === 2, '진행도 이어받음');
  g.post({ action: 'save', ban: '3', num: '5', answers: ans, progress: 1 });
  check(sh.get(2, 13) === 2, '진행은 줄지 않음');
  const long = 'ㄱ'.repeat(5000);
  g.post({ action: 'save', ban: '3', num: '6', answers: A9(long), progress: 0 });
  check(sh.get(3, 3).length === 3000, '아주 긴 답은 3000자까지');

  g.tick(60);
  const sub = g.post({ action: 'submit', ban: '3', num: '5', answers: ans, progress: 3 });
  check(sub.ok && sub.submitted === true && sub.submittedAt === '2026-11-20 09:32' && sub.closed === false, '제출 응답');
  check(sh.get(2, 12) === '제출완료' && sh.get(2, 15) === '2026-11-20 09:32:05', '제출완료·제출 시각');
  g.tick(60);
  const after = g.post({ action: 'save', ban: '3', num: '5', answers: A9('고친 답'), progress: 3 });
  check(after.ok && after.submitted === true && after.submittedAt === '2026-11-20 09:32', '제출 뒤에도 마감 전이면 저장 받음, 제출 표시·시각 유지');
  check(sh.get(2, 3) === '고친 답' && sh.get(2, 12) === '제출완료', '고친 답 저장, 상태는 제출완료 그대로');
  g.tick(60);
  const re = g.post({ action: 'submit', ban: '3', num: '5', answers: A9('다시'), progress: 3 });
  check(re.ok && re.submittedAt === '2026-11-20 09:34', '다시 제출하면 제출 시각만 새로');
  const reg = g.post({ action: 'register', ban: '3', num: '5' });
  check(reg.submitted === true && reg.submittedAt === '2026-11-20 09:34', '새로고침(register)해도 제출 상태 유지');
  check(!('grade' in reg) && !('keywords' in reg) && !('auto' in reg), '학생 응답에 채점·인정 단어 없음');
  check(g.violations.length === 0, '락 없이 쓴 곳 없음 ' + g.violations.join(' / '));
}

/* ── 3. 마감 ──────────────────────────────── */
section('마감');
{
  const g = makeGas();
  g.props.TEACHER_PW = 'pw-시험';
  const tok = g.post({ action: 'login', pw: 'pw-시험' }).token;
  g.post({ action: 'register', ban: '3', num: '1' });
  g.post({ action: 'register', ban: '4', num: '1' });
  g.post({ action: 'save', ban: '3', num: '1', answers: A9('마감 전'), progress: 1 });
  const c = g.post({ action: 'close', token: tok, ban: '3', on: true });
  check(c.ok && c.closed === true && c.ban === '3', '3반 마감');
  const set = g.ss.getSheetByName('설정');
  check(set.row(2, 2).join('|') === '3|Y', '설정 탭에 3반 Y');
  const sv = g.post({ action: 'save', ban: '3', num: '1', answers: A9('마감 뒤'), progress: 1 });
  check(sv.ok === false && sv.closed === true && /마감/.test(sv.msg), '마감 뒤 저장 거부');
  const sb = g.post({ action: 'submit', ban: '3', num: '1', answers: A9('마감 뒤'), progress: 3 });
  check(sb.ok === false && sb.closed === true, '마감 뒤 제출 거부');
  check(g.ss.getSheetByName('답안').get(2, 3) === '마감 전', '마감 뒤 답이 바뀌지 않음');
  const rg = g.post({ action: 'register', ban: '3', num: '1' });
  check(rg.ok && rg.closed === true && rg.answers[0] === '마감 전', '마감 뒤 등록은 답을 주되 closed:true');
  check(g.post({ action: 'save', ban: '4', num: '1', answers: A9('4반'), progress: 1 }).ok === true, '다른 반은 그대로 저장');
  g.post({ action: 'close', token: tok, ban: '03', on: true });
  check(set.getLastRow() === 2, '같은 반 마감을 또 눌러도 행이 늘지 않음');
  g.post({ action: 'close', token: tok, ban: '3', on: false });
  check(set.get(2, 2) === '' || set.get(2, 2) === undefined, '마감 풀기 = 빈칸');
  check(g.post({ action: 'save', ban: '3', num: '1', answers: A9('풀린 뒤'), progress: 1 }).ok === true, '마감 풀면 다시 저장');
  check(g.post({ action: 'close', token: tok, ban: '', on: true }).ok === false, '반 없이 마감 거부');
  check(g.violations.length === 0, '락 없이 쓴 곳 없음');
}

/* ── 4. 교사 로그인·토큰 ─────────────────── */
section('교사 로그인·토큰');
{
  const g = makeGas();
  for (const a of ['list', 'keywords', 'grade', 'gradeBulk', 'close']) {
    const r = g.post({ action: a, ban: '3', num: '1', item: '1', value: '◎', list: [], on: true });
    check(r.ok === false && r.auth === false, a + ': 토큰 없으면 auth:false');
    const r2 = g.post({ action: a, token: 'tok-지어냄', ban: '3' });
    check(r2.auth === false, a + ': 지어낸 토큰 거부');
  }
  check(!g.ss.getSheetByName('설정') && !g.ss.getSheetByName('채점'), '토큰 없는 요청은 아무 탭도 안 만듦');
  check(/TEACHER_PW/.test(g.post({ action: 'login', pw: '' }).msg), '비밀번호 속성이 없으면 설정하라고 안내');
  g.props.TEACHER_PW = 'kokko!2026';
  check(g.post({ action: 'login', pw: 'teacher' }).ok === false, '틀린 비밀번호 거부(스텁 기본값도 안 통함)');
  check(g.post({ action: 'login' }).ok === false, '비밀번호 없음 거부');
  const ok = g.post({ action: 'login', pw: 'kokko!2026' });
  check(ok.ok && typeof ok.token === 'string' && ok.token.length >= 32 && ok.hours === 6, '맞는 비밀번호 → 토큰(6시간)');
  check(g.post({ action: 'list', token: ok.token, ban: '' }).ok === true, '토큰으로 list');
  g.tick(6 * 3600 - 5);
  check(g.post({ action: 'list', token: ok.token, ban: '' }).ok === true, '6시간 안은 통함');
  g.tick(10);
  check(g.post({ action: 'list', token: ok.token, ban: '' }).auth === false, '6시간 지나면 토큰 끝');
  for (let i = 0; i < 10; i++) g.post({ action: 'login', pw: '틀림' + i });
  const locked = g.post({ action: 'login', pw: 'kokko!2026' });
  check(locked.ok === false && /10분/.test(locked.msg), '10번 틀리면 맞는 비밀번호도 10분 막음');
  g.tick(601);
  check(g.post({ action: 'login', pw: 'kokko!2026' }).ok === true, '10분 뒤 다시 로그인');
  check(!CODE.includes('kokko!2026') && !/TEACHER_PW\s*=\s*['"]/.test(CODE), '비밀번호가 코드에 없음');
}

/* ── 5. 인정 단어 ─────────────────────────── */
section('인정 단어');
{
  const g = makeGas();
  g.props.TEACHER_PW = 'p';
  const tok = g.post({ action: 'login', pw: 'p' }).token;
  const none = g.post({ action: 'keywords', token: tok });
  check(none.ok === false && /setupKeywords/.test(none.msg), '인정 단어가 없으면 안내');
  let threw = ''; try { g.ctx.setupKeywords(); } catch (e) { threw = String(e.message); }
  check(/KEYWORDS_PASTE/.test(threw), '붙여넣기 없이 setupKeywords 실행하면 안내 오류');
  threw = ''; try { g.ctx.setupKeywords_({ version: 1 }); } catch (e) { threw = String(e.message); }
  check(/fields/.test(threw), 'fields 없는 JSON 거부');
  // 사용자처럼: 붙여넣기 파일 = 전역 변수 KEYWORDS_PASTE
  vm.runInContext('var KEYWORDS_PASTE = ' + JSON.stringify(SAMPLE_KW) + ';', g.ctx);
  const msg = g.ctx.setupKeywords();
  check(/인정 단어를 넣었어요/.test(msg) && g.logs.some((l) => /인정 단어를 넣었어요/.test(l)), 'setupKeywords 실행 로그');
  const kwSh = g.ss.getSheetByName('인정단어');
  check(kwSh && kwSh.hidden === true, '인정단어 탭은 숨김');
  const got = g.post({ action: 'keywords', token: tok });
  check(got.ok && JSON.stringify(got.keywords) === JSON.stringify(SAMPLE_KW), 'keywords()가 넣은 JSON을 그대로 돌려줌');
  // 4만 자가 넘는 목록도 칸을 나눠 담고 그대로 읽힘
  const big = JSON.parse(JSON.stringify(SAMPLE_KW));
  big.fields.a4.groups[0].words = Array.from({ length: 9000 }, (_, i) => '낱말' + i);
  g.ctx.setupKeywords_(JSON.stringify(big));
  check(kwSh.getLastRow() >= 2, '긴 목록은 여러 칸에 나눔');
  check(JSON.stringify(g.post({ action: 'keywords', token: tok }).keywords) === JSON.stringify(big), '나눈 목록이 그대로 합쳐짐');
  g.ctx.setupKeywords_(SAMPLE_KW);
  check(kwSh.getLastRow() === 1, '다시 넣으면 남은 칸을 지움');
  check(JSON.stringify(g.post({ action: 'keywords', token: tok }).keywords) === JSON.stringify(SAMPLE_KW), '다시 넣은 목록');
  // 스크립트 속성 대체
  const g2 = makeGas(); g2.props.TEACHER_PW = 'p'; g2.props.KEYWORDS_JSON = JSON.stringify(SAMPLE_KW);
  const t2 = g2.post({ action: 'login', pw: 'p' }).token;
  check(JSON.stringify(g2.post({ action: 'keywords', token: t2 }).keywords) === JSON.stringify(SAMPLE_KW), '시트에 없으면 스크립트 속성 KEYWORDS_JSON');
  g2.props.KEYWORDS_JSON = '{깨짐';
  check(/깨져/.test(g2.post({ action: 'keywords', token: t2 }).msg), '깨진 JSON이면 안내');
  // 공개 쪽에 실제 인정 단어가 없는지: 비공개 목록이 이 컴퓨터에 있으면 Code.gs·srv.js와 대조
  const priv = join(ROOT, 'server', 'private', 'keywords.json');
  if (existsSync(priv)) {
    const pk = JSON.parse(readFileSync(priv, 'utf8'));
    const words = new Set();
    for (const f of Object.values(pk.fields)) for (const gr of f.groups || []) for (const w of gr.words || []) { const s = typeof w === 'string' ? w : w.w; if (s && s.replace(/\s/g, '').length >= 3) words.add(s); }
    const srvSrc = readFileSync(join(ROOT, 'game', 'src', 'srv.js'), 'utf8');
    const leak = [...words].filter((w) => CODE.includes(w) || srvSrc.includes(w));
    check(leak.length === 0, '실제 인정 단어(3글자 이상 ' + words.size + '개)가 Code.gs·srv.js에 없음 ' + leak.join(','));
  } else console.log('  (비공개 목록 없음 — 유출 대조 건너뜀)');
}

/* ── 6. 채점 저장·list ────────────────────── */
section('채점 저장·list');
{
  const g = makeGas();
  g.props.TEACHER_PW = 'p';
  const tok = g.post({ action: 'login', pw: 'p' }).token;
  for (const n of ['1', '2', '3']) g.post({ action: 'register', ban: '3', num: n });
  g.post({ action: 'register', ban: '5', num: '1' });
  g.post({ action: 'submit', ban: '3', num: '2', answers: A9((i) => '답' + i), progress: 3 });
  g.post({ action: 'save', ban: '3', num: '3', answers: A9('쓰는 중'), progress: 1 });
  // 교사가 명단 탭에 붙여 넣은 이름(4번은 아직 안 들어옴)
  g.lock.held = true;
  const ros = g.ctx.rosterSheet_();
  ros.getRange(2, 1, 3, 3).setValues([['3', '1', '가나'], ['3', '2', '다라'], ['3', '4', '마바']]);
  g.lock.held = false;

  const l0 = g.post({ action: 'list', token: tok, ban: '' });
  check(l0.ok && l0.bans.join(',') === '3,5' && l0.students.length === 0, '반 없이 list = 반 목록만');
  const l = g.post({ action: 'list', token: tok, ban: '3' });
  check(l.ok && l.ban === '3' && l.closed === false, '3반 list');
  check(l.students.map((s) => s.num).join(',') === '1,2,3,4', '번호순, 명단에만 있는 4번도 포함');
  const s2 = l.students[1], s4 = l.students[3], s3 = l.students[2];
  check(s2.name === '다라' && s2.submitted && s2.submittedAt && s2.answers[8] === '답8' && s2.registered, '제출한 학생: 이름·답·제출 시각');
  check(s3.submitted === false && s3.savedAt !== '' && s3.answers[0] === '쓰는 중' && s3.name === '', '작성 중 학생');
  check(s4.registered === false && s4.answers.every((x) => x === '') && s4.name === '마바', '안 들어온 학생은 빈 답');
  check(JSON.stringify(s2.grade) === JSON.stringify({ auto: { 1: '', 2: '', 3: '', 종합: '' }, check: false, final: { 1: '', 2: '', 3: '', 종합: '' }, direct: false, at: '' }), '채점 전 grade 모양');

  check(g.post({ action: 'grade', token: tok, ban: '3', num: '2', item: '4', value: '◎' }).ok === false, '없는 문항 거부');
  check(g.post({ action: 'grade', token: tok, ban: '3', num: '2', item: '1', value: 'A' }).ok === false, '◎○△ 말고 거부');
  check(g.post({ action: 'grade', token: tok, ban: '3', num: '', item: '1', value: '◎' }).ok === false, '번호 없음 거부');
  const gr = g.post({ action: 'grade', token: tok, ban: '3', num: '2', item: '2', value: '◎' });
  check(gr.ok && gr.grade.final['2'] === '◎' && gr.grade.direct === false, '2번 확정 ◎');
  const gs = g.ss.getSheetByName('채점');
  check(gs.row(1, 13).join('|') === '반|번호|1번 임시|2번 임시|3번 임시|종합 임시|확인|1번 확정|2번 확정|3번 확정|종합 확정|종합 직접|교사 수정 시각', '채점 탭 머리줄 13열');
  check(gs.row(2, 13)[8] === '◎', '채점 탭 I열(2번 확정)');
  const gt = g.post({ action: 'grade', token: tok, ban: '3', num: '2', item: '종합', value: '○' });
  check(gt.grade.direct === true && gt.grade.final['종합'] === '○', '종합을 직접 바꾸면 종합 직접 표시');
  check(g.post({ action: 'grade', token: tok, ban: '3', num: '2', item: '종합', value: '' }).grade.direct === false, '종합 지우면 직접 표시도 꺼짐');
  check(gs.getLastRow() === 2, '같은 학생은 한 행');

  const bad = g.post({ action: 'gradeBulk', token: tok, ban: '3', list: [{ num: '1', final: { 1: '◎' } }, { num: '3', final: { 2: '?' } }] });
  check(bad.ok === false && gs.getLastRow() === 2, '목록에 틀린 값이 하나라도 있으면 아무것도 안 씀');
  check(g.post({ action: 'gradeBulk', token: tok, ban: '3', list: Array.from({ length: 61 }, (_, i) => ({ num: String(i % 30 + 1) })) }).ok === false, '61명 넘는 목록 거부');
  check(g.post({ action: 'gradeBulk', token: tok, ban: '3', list: [{ final: { 1: '◎' } }] }).ok === false, '번호 없는 항목 거부');
  const bulk = g.post({ action: 'gradeBulk', token: tok, ban: '3', list: [
    { num: '1', auto: { 1: '△', 2: '△', 3: '△', 종합: '△' }, check: false },
    { num: '2', auto: { 1: '○', 2: '◎', 3: '◎', 종합: '◎' }, check: true },
    { num: '3', auto: { 1: '◎', 2: '◎', 3: '◎', 종합: '◎' }, check: false, final: { 1: '◎', 2: '◎', 3: '◎', 종합: '◎' } },
  ] });
  check(bulk.ok && bulk.count === 3, '일괄 3명');
  const l2 = g.post({ action: 'list', token: tok, ban: '3' });
  const G = Object.fromEntries(l2.students.map((s) => [s.num, s.grade]));
  check(G['2'].auto['1'] === '○' && G['2'].check === true && G['2'].final['2'] === '◎', '2번 학생: 임시·확인·앞서 확정한 값 유지');
  check(G['3'].final['종합'] === '◎' && G['3'].direct === true, '일괄 확정에 종합이 있으면 직접 표시');
  check(G['1'].auto['종합'] === '△' && G['1'].final['1'] === '' && G['1'].at === '2026-11-20 09:30:00', '1번 학생 임시만');
  check(G['4'].at === '', '안 건드린 학생은 빈 채점');
  // direct:false와 함께 보낸 종합 = 1·2·3번 확정으로 다시 계산한 값 → 종합 직접 아님 (교사 화면이 씀)
  check(g.post({ action: 'gradeBulk', token: tok, ban: '3', list: [{ num: '1', final: { 1: '○', 2: '○', 3: '○', 종합: '○' }, direct: false }] }).ok, 'direct:false 일괄 저장');
  const G1 = g.post({ action: 'list', token: tok, ban: '3' }).students.find((s) => s.num === '1').grade;
  check(G1.final['종합'] === '○' && G1.direct === false, 'direct:false면 종합 확정만 적고 직접 표시는 안 켬');
  check(gs.getLastRow() === 4, '채점 탭 3명');
  check(g.post({ action: 'list', token: tok, ban: '5' }).students.length === 1, '5반은 따로');
  check(g.violations.length === 0, '락 없이 쓴 곳 없음 ' + g.violations.join(' / '));
}

/* ── 7. 잠금 ──────────────────────────────── */
section('잠금');
{
  const g = makeGas();
  g.props.TEACHER_PW = 'p';
  const tok = g.post({ action: 'login', pw: 'p' }).token;
  g.post({ action: 'register', ban: '3', num: '1' });
  const before = g.ss.getSheetByName('답안').writes;
  g.lock.busy = true;   // 다른 요청이 락을 쥐고 안 놓는 상황
  check(/몰려/.test(g.post({ action: 'register', ban: '3', num: '2' }).msg), '락을 못 잡으면 등록은 잠시 뒤 다시');
  check(/몰려/.test(g.post({ action: 'save', ban: '3', num: '1', answers: A9('x'), progress: 1 }).msg), '락을 못 잡으면 저장 거부(게임이 다시 보냄)');
  check(g.post({ action: 'submit', ban: '3', num: '1', answers: A9('x'), progress: 3 }).ok === false, '락을 못 잡으면 제출 거부');
  check(g.post({ action: 'grade', token: tok, ban: '3', num: '1', item: '1', value: '◎' }).ok === false, '락을 못 잡으면 판정 거부');
  check(g.post({ action: 'gradeBulk', token: tok, ban: '3', list: [{ num: '1', final: { 1: '◎' } }] }).ok === false, '락을 못 잡으면 일괄 거부');
  check(g.post({ action: 'close', token: tok, ban: '3', on: true }).ok === false, '락을 못 잡으면 마감 거부');
  check(g.post({ action: 'list', token: tok, ban: '3' }).ok === true, '읽기(list)는 락 없이 됨');
  check(g.ss.getSheetByName('답안').writes === before && !g.ss.getSheetByName('채점') && !g.ss.getSheetByName('설정'), '락을 못 잡은 요청은 아무것도 안 씀');
  g.lock.busy = false;
  check(g.lock.held === false, '모든 요청 뒤 락이 풀려 있음');
  // 오류가 나도 락을 놓는지: 머리줄을 망가뜨린 뒤 저장
  g.ss.getSheetByName('답안').set(1, 3, '바뀐 머리');
  const broke = g.post({ action: 'save', ban: '3', num: '1', answers: A9('x'), progress: 1 });
  check(broke.ok === false && /머리줄/.test(broke.msg), '머리줄이 바뀐 탭에는 쓰지 않음');
  check(g.lock.held === false, '오류가 나도 락을 놓음');
  check(g.violations.length === 0, '락 없이 쓴 곳 없음');
}

/* ── 8. 한 반이 몰려 저장 ─────────────────── */
section('23명 몰려 저장');
{
  const g = makeGas();
  const expect = {};
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let n = 1; n <= 23; n++) g.post({ action: 'register', ban: '2', num: String(n) });
  let calls = 0, okCount = 0;
  for (let round = 0; round < 40; round++) {
    for (let n = 1; n <= 23; n++) {
      if (rnd() < 0.5) continue;
      const a = A9((i) => (rnd() < 0.3 ? '' : n + '번 ' + i + '칸 ' + round));
      const final = round > 30 && rnd() < 0.2;
      const r = g.post({ action: final ? 'submit' : 'save', ban: '2', num: String(n), answers: a, progress: Math.floor(round / 10) });
      calls++; if (r.ok) { okCount++; expect[n] = a; }
      g.tick(1);
    }
  }
  check(okCount === calls, '저장 ' + calls + '번 모두 성공');
  const sh = g.ss.getSheetByName('답안');
  check(sh.getLastRow() === 24, '23명 = 23행(중복 행 없음)');
  let same = 0;
  for (let n = 1; n <= 23; n++) {
    const reg = g.post({ action: 'register', ban: '2', num: String(n) });
    if (!expect[n] || JSON.stringify(reg.answers) === JSON.stringify(expect[n])) same++;
  }
  check(same === 23, '23명 모두 마지막으로 보낸 답과 같음');
  check(g.lock.waits >= calls, '저장마다 락을 잡음');
  check(g.violations.length === 0, '락 없이 쓴 곳 없음');
}

/* ── 9. 로컬 스텁(srv.js)과 응답 모양 대조 ── */
section('로컬 스텁과 약속 대조');
{
  // 브라우저 흉내: localStorage·sessionStorage(메모리), keywords 파일은 file: 주소로 읽기
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; };
  globalThis.localStorage = mem(); globalThis.sessionStorage = mem(); globalThis.window = globalThis;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (u, o) => {
    if (String(u).startsWith('file:')) { try { const t = readFileSync(fileURLToPath(String(u)), 'utf8'); return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(t)) }); } catch (e) { return Promise.resolve({ ok: false, json: () => Promise.resolve(null) }); } }
    return realFetch(u, o);
  };
  const srv = await import(pathToFileURL(join(ROOT, 'game', 'src', 'srv.js')).href + '?t=' + Date.now());
  const st = srv.studentSrv('');
  st.delay = 0; window.__stub.delay = 0;
  const cb = (fn) => new Promise((res, rej) => fn(res, rej));
  const keys = (o) => Object.keys(o).sort().join(',');
  const g = makeGas(); g.props.TEACHER_PW = 'p';

  const sReg = await cb((ok, f) => st.register('3', '7', ok, f));
  const gReg = g.post({ action: 'register', ban: '3', num: '7' });
  check(keys(sReg) === keys(gReg), 'register 응답 키 같음 [' + keys(gReg) + '] / 스텁 [' + keys(sReg) + ']');
  const p = { ban: '3', num: '7', answers: A9('a'), progress: 1 };
  const sSave = await cb((ok, f) => st.save(p, ok, f));
  const gSave = g.post(Object.assign({ action: 'save' }, p));
  check(keys(sSave) === keys(gSave), 'save 응답 키 같음 [' + keys(gSave) + '] / 스텁 [' + keys(sSave) + ']');
  const sSub = await cb((ok, f) => st.submit(p, ok, f));
  const gSub = g.post(Object.assign({ action: 'submit' }, p));
  check(keys(sSub) === keys(gSub) && sSub.submitted === true && gSub.submitted === true, 'submit 응답 키 같음');

  const te = srv.teacherSrv('', { delay: 0 });
  check((await te.list('3')).auth === false, '스텁 교사: 로그인 전 list 거부');
  check((await te.login('틀림')).ok === false, '스텁 교사: 틀린 비밀번호 거부');
  const tl = await te.login(srv.STUB_PW);
  const gl = g.post({ action: 'login', pw: 'p' });
  check(tl.ok && keys(tl) === keys(gl), '스텁 교사 login 응답 키 같음');
  const tok = gl.token;
  const tc = await te.close('3', true), gc = g.post({ action: 'close', token: tok, ban: '3', on: true });
  check(keys(tc) === keys(gc), 'close 응답 키 같음');
  const sClosed = await cb((ok, f) => st.save(p, ok, f));
  const gClosed = g.post(Object.assign({ action: 'save' }, p));
  check(sClosed.ok === false && sClosed.closed === true && gClosed.ok === false && gClosed.closed === true, '마감 뒤 저장 거부: 스텁·서버 같음');
  await te.close('3', false); g.post({ action: 'close', token: tok, ban: '3', on: false });

  const tg = await te.grade('3', '7', '2', '◎'), gg = g.post({ action: 'grade', token: tok, ban: '3', num: '7', item: '2', value: '◎' });
  check(keys(tg) === keys(gg) && keys(tg.grade) === keys(gg.grade), 'grade 응답 키 같음');
  check((await te.grade('3', '7', '9', '◎')).ok === false, '스텁도 없는 문항 거부');
  const bl = [{ num: '7', auto: { 1: '○', 2: '◎', 3: '△', 종합: '△' }, check: true }];
  const tb = await te.gradeBulk('3', bl), gb = g.post({ action: 'gradeBulk', token: tok, ban: '3', list: bl });
  check(keys(tb) === keys(gb), 'gradeBulk 응답 키 같음');
  const bd = [{ num: '7', final: { 1: '◎', 종합: '◎' }, direct: false }];
  await te.gradeBulk('3', bd); g.post({ action: 'gradeBulk', token: tok, ban: '3', list: bd });
  const td = (await te.list('3')).students[0].grade, gd = g.post({ action: 'list', token: tok, ban: '3' }).students[0].grade;
  check(td.direct === false && gd.direct === false && td.final['종합'] === '◎' && gd.final['종합'] === '◎', 'direct:false 종합: 스텁·서버 같음(직접 아님)');
  const tli = await te.list('3'), gli = g.post({ action: 'list', token: tok, ban: '3' });
  check(keys(tli) === keys(gli), 'list 응답 키 같음');
  const ts = tli.students[0], gs = gli.students[0];
  check(keys(ts) === keys(gs) && keys(ts.grade) === keys(gs.grade), 'list 학생 항목 키 같음 [' + keys(gs) + ']');
  check(JSON.stringify(ts.grade.auto) === JSON.stringify(gs.grade.auto) && ts.grade.check === gs.grade.check && ts.grade.final['2'] === gs.grade.final['2'], '같은 조작 뒤 채점 값 같음');
  check(ts.submitted === gs.submitted && JSON.stringify(ts.answers) === JSON.stringify(gs.answers), '같은 조작 뒤 답·제출 같음');
  check(JSON.stringify(tli.bans) === JSON.stringify(gli.bans), '반 목록 같음');

  const tk = await te.keywords();
  const hasPriv = existsSync(join(ROOT, 'server', 'private', 'keywords.json'));
  check(tk.ok && tk.keywords && tk.keywords.fields && tk.keywords.fields.a8, '스텁 keywords 받음');
  // 노드에는 location이 없어 "로컬 서버"가 아니므로 가짜 목록이 나와야 한다(공개 사이트에서와 같은 동작)
  check(tk.source === 'sample', '로컬 서버가 아닐 때는 가짜 목록(keywords.sample.json)' + (hasPriv ? '' : ''));
  te.logout();
  check((await te.keywords()).auth === false, '로그아웃 뒤 거부');
  globalThis.fetch = realFetch;
}

console.log(`\n서버 시험: 통과 ${pass} · 실패 ${fails.length}`);
if (fails.length) { fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
