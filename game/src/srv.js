// 서버 연결 공용 모듈 — 학생 화면(exam.js)과 교사 화면이 같이 쓴다.
//   API_URL(GAS 웹앱 /exec 주소)이 있으면 fetch로 server/Code.gs의 doPost에 보내고,
//   비어 있으면 이 브라우저 localStorage로 서버를 흉내 내는 로컬 스텁으로 똑같이 돈다.
//
// 주고받는 약속 (server/Code.gs와 같게. 요청 = text/plain에 JSON 한 덩어리, 응답 = JSON)
//   학생
//     register {action:"register", ban, num}
//       → {ok, row, answers[9], submitted, submittedAt, progress, closed}
//     save     {action:"save", ban, num, answers[9], progress}
//       → {ok, at, submitted, submittedAt, closed}     마감된 반이면 {ok:false, closed:true, msg}
//     submit   {action:"submit", ban, num, answers[9], progress}
//       → {ok, at, submitted:true, submittedAt, closed} 마감된 반이면 거부
//     제출한 뒤에도 마감 전이면 save·submit을 받는다(다시 제출하면 제출 시각만 새로). 학생 응답에 채점 결과는 없다.
//   교사 (login 말고는 모두 token 필요. 토큰이 없거나 끝나면 {ok:false, auth:false, msg})
//     login     {action:"login", pw}                 → {ok, token, hours}
//     list      {action:"list", token, ban}          → {ok, ban, bans[], closed, students[]}
//                 students[i] = {num, name, row, answers[9], submitted, submittedAt, savedAt, progress, registered,
//                                grade:{auto:{1,2,3,종합}, check, final:{1,2,3,종합}, direct, at}}
//                 (반을 비우면 bans만 채워 돌려준다)
//     keywords  {action:"keywords", token}           → {ok, keywords}   인정 단어 JSON(server/private/keywords.json과 같은 구조)
//     grade     {action:"grade", token, ban, num, item, value}   item = "1"|"2"|"3"|"종합", value = "◎"|"○"|"△"|"" (빈칸 = 확정 지움)
//                 → {ok, grade}       item "종합"에 값을 넣으면 direct(종합 직접)가 켜진다
//     gradeBulk {action:"gradeBulk", token, ban, list:[{num, auto?:{1,2,3,종합}, check?, final?:{1,2,3,종합}}]}
//                 → {ok, count}       auto = 앱이 낸 임시 판정, final = 교사 확정
//                 direct?: 종합 직접 여부. 빼면 final 종합에 값이 있을 때 켜진다. direct:false + final 종합 = 1·2·3번 확정으로 다시 계산한 종합
//     close     {action:"close", token, ban, on}     → {ok, ban, closed}

// 저장 키 v3: 옛 4문항(6칸) 데이터와 섞이지 않게. exam.js·교사 화면·play3d가 같은 키를 쓴다.
export const KEY_SRV = 'kkokko3d-v3-server';       // 스텁 답안 {"반/번호": {row, answers, submitted, submittedAt, progress, savedAt}}
export const KEY_CLOSED = 'kkokko3d-v3-closed';    // 스텁 마감 {반: true}
export const KEY_LOCAL = 'kkokko3d-v3:';           // 학생 기기 로컬 사본 kkokko3d-v3:반:번호
export const KEY_GRADES = 'kkokko3d-v3-grades';    // 스텁 채점 {"반/번호": {auto, check, final, direct, at}}
export const KEY_ROSTER = 'kkokko3d-v3-roster';    // 스텁 명단(선택) {반: {번호: 이름}} — 교사가 직접 넣은 것만
export const N_ANS = 9;
export const STUB_PW = 'teacher';                  // 로컬 스텁 전용 교사 비밀번호. 실제 서버는 스크립트 속성 TEACHER_PW
const KEY_TOKEN = 'kkokko3d-v3-token';
const ITEMS = ['1', '2', '3', '종합'];
const MARKS = ['◎', '○', '△', ''];

const blank = () => { const a = []; for (let i = 0; i < N_ANS; i++) a.push(''); return a; };
const two = (n) => (n < 10 ? '0' : '') + n;
const stamp = (d) => d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());
const digits = (v) => { v = String(v == null ? '' : v).trim(); return /^\d{1,2}$/.test(v) ? String(parseInt(v, 10)) : ''; };
const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then((r) => r.json());

/* ─────────────────────────────────────────────
   학생 API (콜백 방식: ok(res), fail(err) — exam.js가 쓰는 모양 그대로)
   ───────────────────────────────────────────── */
export function studentSrv(API_URL) {
  if (API_URL) {
    const call = (body, ok, fail) => post(API_URL, body).then(ok).catch(fail);
    return {
      live: true,
      register: (ban, num, ok, fail) => call({ action: 'register', ban, num }, ok, fail),
      save: (p, ok, fail) => call(Object.assign({ action: 'save' }, p), ok, fail),
      submit: (p, ok, fail) => call(Object.assign({ action: 'submit' }, p), ok, fail),
    };
  }
  // 로컬 스텁. 마감 여부는 KEY_CLOSED를 매번 다시 읽는다(같은 브라우저의 교사 화면 스텁이 마감을 누르면 바로 반영).
  //   시험용 손잡이 window.__stub: failNext(다음 n번 연결 실패), okFalse(다음 n번 저장 거부), rows, calls, delay, setClosed(반, 켬)
  const stub = { failNext: 0, okFalse: 0, rows: {}, calls: [], delay: 120 };
  stub.rows = readLS(KEY_SRV, {});
  const readClosed = () => readLS(KEY_CLOSED, {});
  stub.setClosed = (ban, on) => { const c = readClosed(); if (on) c[ban] = true; else delete c[ban]; writeLS(KEY_CLOSED, c); };
  if (typeof window !== 'undefined') window.__stub = stub;
  const later = (fn) => setTimeout(fn, stub.delay), keep = () => writeLS(KEY_SRV, stub.rows);
  const write = (p, final, ok, fail) => {
    stub.calls.push(JSON.parse(JSON.stringify(Object.assign({ final }, p))));
    later(() => {
      if (stub.failNext > 0) { stub.failNext--; fail(new Error('stub')); return; }
      if (stub.okFalse > 0) { stub.okFalse--; ok({ ok: false, msg: '저장하지 못했어요. (스텁)' }); return; }
      if (readClosed()[p.ban]) { ok({ ok: false, closed: true, msg: '선생님이 마감했어요.' }); return; }
      const r = stub.rows[[p.ban, p.num].join('/')];
      if (!r) { ok({ ok: false, msg: '등록되지 않은 번호예요. (스텁)' }); return; }
      const at = stamp(new Date()).slice(0, 16);
      r.answers = p.answers.slice(); r.progress = Math.max(r.progress, p.progress || 0); r.savedAt = at;
      if (final) { r.submitted = true; r.submittedAt = at; }
      keep(); ok({ ok: true, at, submitted: r.submitted, submittedAt: r.submittedAt, closed: false });
    });
  };
  return {
    live: false,
    register(ban, num, ok, fail) {
      later(() => {
        if (stub.failNext > 0) { stub.failNext--; fail(new Error('stub')); return; }
        const k = [ban, num].join('/');
        if (!stub.rows[k]) stub.rows[k] = { row: Object.keys(stub.rows).length + 2, answers: blank(), submitted: false, submittedAt: '', progress: 0 };
        keep(); const r = stub.rows[k];
        ok({ ok: true, row: r.row, answers: r.answers.slice(), submitted: r.submitted, submittedAt: r.submittedAt, progress: r.progress, closed: !!readClosed()[ban] });
      });
    },
    save: (p, ok, fail) => write(p, false, ok, fail),
    submit: (p, ok, fail) => write(p, true, ok, fail),
  };
}

/* ─────────────────────────────────────────────
   교사 API (Promise 방식: 모두 응답 객체로 resolve. 연결 실패는 {ok:false, net:true, msg})
   토큰은 sessionStorage에 둔다(탭을 닫으면 다시 로그인).
   ───────────────────────────────────────────── */
export function teacherSrv(API_URL, opts = {}) {
  let token = '';
  try { token = sessionStorage.getItem(KEY_TOKEN) || ''; } catch (e) {}
  const setToken = (t) => { token = t || ''; try { if (token) sessionStorage.setItem(KEY_TOKEN, token); else sessionStorage.removeItem(KEY_TOKEN); } catch (e) {} };
  const netFail = () => ({ ok: false, net: true, msg: '서버와 연결하지 못했어요. 잠시 뒤 다시 눌러 주세요.' });
  const api = API_URL ? liveTeacher(API_URL) : stubTeacher(opts);
  const wrap = (action, needToken) => (p = {}) => {
    const body = Object.assign({ action }, p);
    if (needToken) body.token = token;
    return Promise.resolve().then(() => api(body)).then((res) => {
      if (res && res.auth === false) setToken('');
      return res;
    }, netFail);
  };
  return {
    live: !!API_URL,
    get loggedIn() { return !!token; },
    login: (pw) => wrap('login', false)({ pw }).then((res) => { if (res && res.ok) setToken(res.token); return res; }),
    logout: () => setToken(''),
    list: (ban) => wrap('list', true)({ ban }),
    keywords: () => wrap('keywords', true)(),
    grade: (ban, num, item, value) => wrap('grade', true)({ ban, num, item, value }),
    gradeBulk: (ban, list) => wrap('gradeBulk', true)({ ban, list }),
    close: (ban, on) => wrap('close', true)({ ban, on: !!on }),
  };
}

function liveTeacher(url) { return (body) => post(url, body); }

// 로컬 스텁 교사 서버. 학생 스텁과 같은 localStorage 키를 매번 다시 읽고 쓴다.
//   인정 단어: server/private/keywords.json(이 컴퓨터에서 저장소 맨 위로 서버를 띄웠을 때만 보임)이 있으면 그것,
//   없으면 game/src/keywords.sample.json(가짜 목록). opts.keywordsURL로 바꿀 수 있다.
function stubTeacher(opts) {
  const tokens = readLS(KEY_TOKEN + '-stub', {});
  const delay = opts.delay == null ? 80 : opts.delay;
  const wait = (v) => new Promise((res) => setTimeout(() => res(v), delay));
  let kwCache = null;
  const loadKeywords = () => {
    if (kwCache) return kwCache;
    const tries = opts.keywordsURL ? [opts.keywordsURL] : [];
    const local = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (local) tries.push(new URL('../../server/private/keywords.json', import.meta.url).href);
    tries.push(new URL('./keywords.sample.json', import.meta.url).href);
    kwCache = tries.reduce((pr, u) => pr.then((got) => got || fetch(u, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => (j && j.fields ? { j, u } : null)).catch(() => null)), Promise.resolve(null))
      .then((got) => { if (!got) { kwCache = null; return null; } return got; });
    return kwCache;
  };
  const authed = (t) => !!(t && tokens[t] && tokens[t] > Date.now());
  const gradeOf = (g) => ({ auto: Object.assign({ 1: '', 2: '', 3: '', 종합: '' }, g && g.auto), check: !!(g && g.check),
    final: Object.assign({ 1: '', 2: '', 3: '', 종합: '' }, g && g.final), direct: !!(g && g.direct), at: (g && g.at) || '' });
  const bansOf = (rows, roster) => {
    const s = new Set(Object.keys(rows).map((k) => k.split('/')[0]).concat(Object.keys(roster)));
    return [...s].filter((b) => digits(b)).sort((a, b) => a - b);
  };
  return (body) => {
    const a = body.action;
    if (a === 'login') {
      if (String(body.pw || '') !== (opts.pw || STUB_PW)) return wait({ ok: false, msg: '비밀번호가 맞지 않아요.' });
      const t = 'stub-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      tokens[t] = Date.now() + 6 * 3600 * 1000; writeLS(KEY_TOKEN + '-stub', tokens);
      return wait({ ok: true, token: t, hours: 6 });
    }
    if (!['list', 'keywords', 'grade', 'gradeBulk', 'close'].includes(a)) return wait({ ok: false, msg: '알 수 없는 요청이에요.' });
    if (!authed(body.token)) return wait({ ok: false, auth: false, msg: '다시 로그인해 주세요.' });
    const rows = readLS(KEY_SRV, {}), closed = readLS(KEY_CLOSED, {}), grades = readLS(KEY_GRADES, {}), roster = readLS(KEY_ROSTER, {});
    if (a === 'keywords') return loadKeywords().then((got) => got ? wait({ ok: true, keywords: got.j, source: /private/.test(got.u) ? 'private' : 'sample' })
      : wait({ ok: false, msg: '인정 단어를 불러오지 못했어요.' }));
    const ban = digits(body.ban);
    if (a === 'list') {
      const bans = bansOf(rows, roster);
      if (!ban) return wait({ ok: true, ban: '', bans, closed: false, students: [] });
      const names = roster[ban] || {}, nums = new Set(Object.keys(names));
      Object.keys(rows).forEach((k) => { const [b, n] = k.split('/'); if (b === ban && digits(n)) nums.add(n); });
      const students = [...nums].sort((x, y) => x - y).map((n) => {
        const r = rows[ban + '/' + n];
        return { num: n, name: names[n] || '', row: r ? r.row : 0, registered: !!r, answers: r ? r.answers.slice() : blank(),
          submitted: !!(r && r.submitted), submittedAt: (r && r.submittedAt) || '', savedAt: (r && r.savedAt) || '', progress: (r && r.progress) || 0,
          grade: gradeOf(grades[ban + '/' + n]) };
      });
      return wait({ ok: true, ban, bans, closed: !!closed[ban], students });
    }
    if (!ban) return wait({ ok: false, msg: '반을 골라 주세요.' });
    if (a === 'close') {
      if (body.on) closed[ban] = true; else delete closed[ban];
      writeLS(KEY_CLOSED, closed);
      return wait({ ok: true, ban, closed: !!body.on });
    }
    const at = stamp(new Date());
    const apply = (num, item, value, field) => {
      const k = ban + '/' + num, g = gradeOf(grades[k]);
      g[field][item] = value;
      if (field === 'final' && item === '종합') g.direct = !!value;
      g.at = at; grades[k] = g; return g;
    };
    if (a === 'grade') {
      const num = digits(body.num), item = String(body.item), value = String(body.value == null ? '' : body.value);
      if (!num) return wait({ ok: false, msg: '번호가 없어요.' });
      if (!ITEMS.includes(item) || !MARKS.includes(value)) return wait({ ok: false, msg: '판정 값이 맞지 않아요.' });
      const g = apply(num, item, value, 'final'); writeLS(KEY_GRADES, grades);
      return wait({ ok: true, grade: g });
    }
    // gradeBulk
    const list = Array.isArray(body.list) ? body.list : null;
    if (!list || list.length > 60) return wait({ ok: false, msg: '판정 목록이 맞지 않아요.' });
    for (const e of list) {
      const num = digits(e && e.num); if (!num) return wait({ ok: false, msg: '번호가 없어요.' });
      for (const f of ['auto', 'final']) if (e[f]) for (const it of Object.keys(e[f])) {
        if (!ITEMS.includes(it) || !MARKS.includes(String(e[f][it]))) return wait({ ok: false, msg: '판정 값이 맞지 않아요.' });
      }
    }
    list.forEach((e) => {
      const num = digits(e.num);
      for (const f of ['auto', 'final']) if (e[f]) Object.keys(e[f]).forEach((it) => apply(num, it, String(e[f][it]), f));
      // direct:false와 함께 온 종합 = 1·2·3번 확정으로 다시 계산한 값(종합 직접 아님)
      if (e.direct != null && e.final && e.final['종합'] != null) { const g = grades[ban + '/' + num]; g.direct = !!e.direct && !!String(e.final['종합']); }
      if (e.check != null) { const g = gradeOf(grades[ban + '/' + num]); g.check = !!e.check; g.at = at; grades[ban + '/' + num] = g; }
    });
    writeLS(KEY_GRADES, grades);
    return wait({ ok: true, count: list.length });
  };
}
