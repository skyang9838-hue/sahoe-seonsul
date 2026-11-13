// 교사 화면(teacher.html)과 반별 답안집(print.html)이 같이 쓰는 것:
//   서버 연결(srv.js teacherSrv) · 로그인 상자 · 반 자료 불러오기 · 채점(scorer.js 그대로) · 확정/임시 판정 합치기 · 답 칠하기
// 인정 단어는 로그인 뒤 서버 keywords()(로컬 스텁이면 스텁 규칙)에서만 받는다. 이 파일에도 학생 화면 코드에도 넣지 않는다.
import { API_URL } from './config.js?v=10';
import { teacherSrv } from './srv.js?v=2';
import { gradeAnswers, totalFrom, FIELDS } from './scorer.js?v=2';
import { ITEM_FIELDS } from './items.js?v=1';

export const T = teacherSrv(API_URL);
export const ITEMS = ['1', '2', '3'];
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isMark = (g) => g === '◎' || g === '○' || g === '△';

let KW = null;
/** 인정 단어(로그인 뒤 한 번 받아 둠) */
export async function loadKeywords() {
  if (KW) return { ok: true, keywords: KW };
  const r = await T.keywords();
  if (r && r.ok && r.keywords) KW = r.keywords;
  return r;
}

/**
 * 학생 한 명의 판정 정리.
 *   auto  = scorer.js가 낸 임시 판정 (gradeAnswers 결과)
 *   items = [{no, grade, confirmed, check, auto, autoCheck}] — 교사 확정이 있으면 그 값(굵게), 없으면 임시(흐리게)
 *   total = {grade, confirmed, direct, check, candidate} — 교사가 종합을 직접 정했으면(direct) 그 값, 아니면 1·2·3번으로 totalFrom 다시 계산
 */
export function judge(st) {
  const g = st.grade || { auto: {}, final: {}, check: false, direct: false };
  const auto = st.registered ? gradeAnswers(st.answers || [], KW || {}) : null;
  const items = ITEMS.map((no, i) => {
    const a = auto ? auto.items[i] : { grade: '미응답', check: false };
    const f = (g.final && g.final[no]) || '';
    return { no, grade: f || a.grade, confirmed: !!f, check: !f && a.check, auto: a.grade, autoCheck: a.check };
  });
  let total;
  if (g.direct && g.final && isMark(g.final['종합'])) {
    total = { grade: g.final['종합'], confirmed: true, direct: true, check: false, candidate: false };
  } else {
    const t = totalFrom(items.map((it) => ({ grade: it.grade, check: it.check })));
    total = { grade: t.grade, confirmed: items.every((it) => it.confirmed) && !t.check, direct: false, check: t.check, candidate: t.candidate };
  }
  return { auto, items, total };
}

/** 확인이 필요한 학생인가 (확정 안 된 🟡 문항이 있거나 종합 ◎ 후보) */
export const needsCheck = (j) => j.items.some((it) => it.check) || (!j.total.direct && j.total.check);

/** 반 자료 불러오기: {ok, ban, bans, closed, students:[{…, j}]} */
export async function loadClass(ban) {
  const r = await T.list(ban);
  if (!r || !r.ok) return r;
  (r.students || []).forEach((s) => { s.j = judge(s); });
  return r;
}

/**
 * 서버(시트)의 임시 판정·확인 표시·확정 종합이 지금 계산과 다르면 맞춰 둔다(gradeBulk, 60명씩).
 *   auto: 앱 임시 판정(미응답은 빈칸) · check: 🟡 확인 표시 · final 종합: 1·2·3번이 모두 확정이고 확인 없을 때 다시 계산한 값(종합 직접이면 건드리지 않음)
 */
export async function syncAuto(ban, students) {
  const list = [];
  students.forEach((s) => {
    if (!s.registered) return;
    const j = s.j, g = s.grade || {};
    const auto = { 1: '', 2: '', 3: '', 종합: '' };
    j.auto.items.forEach((it, i) => { auto[ITEMS[i]] = isMark(it.grade) ? it.grade : ''; });
    auto['종합'] = isMark(j.auto.total.grade) ? j.auto.total.grade : '';
    const check = j.auto.items.some((it) => it.check) || j.auto.total.check;
    const e = { num: s.num };
    let diff = false;
    if (Object.keys(auto).some((k) => ((g.auto && g.auto[k]) || '') !== auto[k])) { e.auto = auto; diff = true; }
    if (!!g.check !== check) { e.check = check; diff = true; }
    if (!g.direct) {
      const want = totalFinal(j);
      if (((g.final && g.final['종합']) || '') !== want) { e.final = { 종합: want }; e.direct = false; diff = true; }
    }
    if (diff) list.push(e);
  });
  for (let i = 0; i < list.length; i += 60) {
    const r = await T.gradeBulk(ban, list.slice(i, i + 60));
    if (!r || !r.ok) return r;
    // 받은 대로 화면 쪽 기록도 고쳐 둔다
    list.slice(i, i + 60).forEach((e) => {
      const s = students.find((x) => x.num === e.num); if (!s) return;
      s.grade = s.grade || { auto: {}, final: {}, check: false, direct: false };
      if (e.auto) s.grade.auto = Object.assign({}, e.auto);
      if (e.check != null) s.grade.check = e.check;
      if (e.final) s.grade.final = Object.assign({}, s.grade.final, e.final);
    });
  }
  return { ok: true, count: list.length };
}

/** 종합 칸에 확정으로 적을 값: 1·2·3번이 다 확정이고 확인이 없으면 다시 계산한 종합, 아니면 빈칸 */
export function totalFinal(j) {
  if (j.total.direct) return j.total.grade;
  return j.items.every((it) => it.confirmed) && !j.total.check && isMark(j.total.grade) ? j.total.grade : '';
}

/**
 * 교사가 문항 판정을 정함(value '' = 확정 지움). 여러 학생 한꺼번에도(일괄 확정).
 *   changes = [{s, item, value}] → 화면 쪽 기록을 바로 바꾸고(누르자마자 보이게), 서버에 보낼 gradeBulk 목록과 되돌리기를 돌려준다.
 *   문항 확정과 함께 (종합 직접이 아니면) 다시 계산한 종합도 같이 적는다.
 */
export function prepItems(changes) {
  const before = new Map(), touched = [];
  changes.forEach(({ s, item, value }) => {
    if (!before.has(s)) { before.set(s, JSON.parse(JSON.stringify(s.grade || {}))); touched.push(s); }
    s.grade = s.grade || { auto: {}, final: {}, check: false, direct: false };
    s.grade.final = Object.assign({ 1: '', 2: '', 3: '', 종합: '' }, s.grade.final);
    s.grade.final[item] = value;
  });
  const list = touched.map((s) => {
    s.j = judge(s);
    const fin = {};
    changes.filter((c) => c.s === s).forEach((c) => { fin[c.item] = c.value; });
    const e = { num: s.num, final: fin };
    if (!s.grade.direct) { fin['종합'] = totalFinal(s.j); e.direct = false; s.grade.final['종합'] = fin['종합']; }
    return e;
  });
  const undo = () => touched.forEach((s) => { s.grade = before.get(s); s.j = judge(s); });
  return { list, undo, send: (ban) => T.gradeBulk(ban, list) };
}

/** 교사가 종합을 직접 정함(value '' = 직접 지움 → 1·2·3번으로 다시 계산). prepItems와 같은 모양으로 돌려준다 */
export function prepTotal(s, value) {
  const before = JSON.parse(JSON.stringify(s.grade || {}));
  s.grade = s.grade || { auto: {}, final: {}, check: false, direct: false };
  s.grade.final = Object.assign({ 1: '', 2: '', 3: '', 종합: '' }, s.grade.final);
  let send;
  if (value) {
    s.grade.final['종합'] = value; s.grade.direct = true; s.j = judge(s);
    send = (ban) => T.grade(ban, s.num, '종합', value);
  } else {
    s.grade.direct = false; s.grade.final['종합'] = ''; s.j = judge(s);
    const want = totalFinal(s.j); s.grade.final['종합'] = want;
    send = (ban) => T.grade(ban, s.num, '종합', '').then((r) => (r && r.ok && want ? T.gradeBulk(ban, [{ num: s.num, final: { 종합: want }, direct: false }]) : r));
  }
  const undo = () => { s.grade = before; s.j = judge(s); };
  return { undo, send };
}

/**
 * 글 칸 답에 인정 단어 칠하기. 🟢(정확) = 형광펜, 🟡(오타·반대 뜻) = 노랑 + "→ 낱말?" 꼬리.
 *   fr = scorer 칸 결과. 위치(start·end)는 NFC 기준이라 같은 기준으로 자른다.
 */
export function paint(text, fr) {
  const src = String(text == null ? '' : text).normalize('NFC');
  if (!fr || !fr.groups) return esc(src);
  const hits = [];
  fr.groups.forEach((g) => (g.hits || []).forEach((h) => {
    const green = h.kind === 'exact' && !h.neg;
    hits.push({ s: h.start, e: h.end, green, word: h.word, kind: h.kind, neg: h.neg, label: g.label });
  }));
  // 겹치면 🟢 먼저, 그다음 긴 것
  hits.sort((a, b) => (b.green - a.green) || ((b.e - b.s) - (a.e - a.s)) || (a.s - b.s));
  const take = [];
  hits.forEach((h) => { if (!take.some((t) => h.s < t.e && h.e > t.s)) take.push(h); });
  take.sort((a, b) => a.s - b.s);
  let out = '', at = 0;
  take.forEach((h) => {
    out += esc(src.slice(at, h.s));
    const tip = h.green ? '인정 단어 (' + h.label + ')' : h.kind === 'typo' ? '비슷함: ' + h.word + ' (' + h.label + ')' : '반대 뜻일 수 있음 (' + h.label + ')';
    out += '<mark class="' + (h.green ? 'kw-g' : 'kw-y') + '" title="' + esc(tip) + '">' + esc(src.slice(h.s, h.e)) + '</mark>';
    if (!h.green) out += '<span class="kw-q">' + esc(h.kind === 'typo' ? '→ ' + h.word + '?' : '→ 반대 뜻?') + '</span>';
    at = h.e;
  });
  return out + esc(src.slice(at));
}

/** 문항의 칸 결과들 */
export const itemFields = (j, item) => (j.auto ? ITEM_FIELDS[item].map((i) => ({ i, key: FIELDS[i], fr: j.auto.fields[FIELDS[i]] })) : []);
/** 문항에 🟡가 있나 */
export const itemHasYellow = (j, item) => itemFields(j, item).some((f) => f.fr.state === 'yellow' || (f.fr.groups || []).some((g) => g.state === 'yellow'));
/** 🟢만 있는 답인가(일괄 확정 대상): 미응답 아님, 🟡 없음, 확인 없음 */
export const itemGreenOnly = (j, item) => {
  const it = j.items[+item - 1];
  return !!j.auto && isMark(it.auto) && !it.autoCheck && !itemHasYellow(j, item);
};

/* ── 로그인 상자 (교사 화면·답안집 같이 씀) ───────── */
export function loginBox(root, onOk) {
  root.innerHTML =
    '<form class="login-card" autocomplete="off">' +
    '<h1>서·논술형 채점</h1><p class="login-sub">6학년 사회 「꼬꼬의 첫 출근」 · 교사용</p>' +
    '<label for="lg-pw">교사 비밀번호</label>' +
    '<input id="lg-pw" type="password" autocomplete="current-password" required>' +
    '<button id="lg-go" type="submit">들어가기</button>' +
    '<div id="lg-msg" class="login-msg" role="alert"></div>' +
    (T.live ? '' : '<p class="login-mode">로컬 시험 모드 — 서버 주소가 비어 있어 이 컴퓨터에 저장된 답을 봐요.</p>') +
    '</form>';
  const f = root.querySelector('form'), pw = root.querySelector('#lg-pw'), msg = root.querySelector('#lg-msg'), go = root.querySelector('#lg-go');
  pw.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    go.disabled = true; msg.textContent = '확인 중…';
    const r = await T.login(pw.value);
    go.disabled = false;
    if (r && r.ok) { msg.textContent = ''; onOk(); }
    else { msg.textContent = (r && r.msg) || '들어가지 못했어요.'; pw.select(); }
  });
}
