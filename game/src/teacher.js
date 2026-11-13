// 교사 화면: 로그인 → 반 고르기 → 반 표 / 1·2·3번 문항 탭에서 판정 확정 → 반 마감 · 답안집
// 채점은 scorer.js(teacher-core.js를 거쳐) 그대로. 인정 단어는 로그인 뒤 서버 keywords()로만 받는다.
import { T, ITEMS, esc, judge, needsCheck, loadKeywords, loadClass, syncAuto, prepItems, prepTotal,
  paint, itemFields, itemHasYellow, itemGreenOnly, loginBox } from './teacher-core.js?v=1';
import { Q1, Q2, Q3, FIELD_NAME, symShow } from './items.js?v=1';

const $ = (id) => document.getElementById(id);
const PROMPT = { 1: Q1.prompt, 2: Q2.prompt, 3: Q3.prompt };
const GC = { '◎': 'ga', '○': 'gb', '△': 'gc', '미응답': 'gn' };
const MC = { '◎': 'ma', '○': 'mb', '△': 'mc' };
const DOT = { green: '🟢', yellow: '🟡', none: '⚪', empty: '⚪' };
const KEY_BAN = 'kkokko3d-teacher-ban';   // 마지막에 본 반(이 브라우저 편의용)

const V = { ban: '', bans: [], closed: false, students: [], tab: 'table', sel: null, cur: 0, yellowOnly: false, busy: false };
let chain = Promise.resolve();   // 서버 저장 순서를 지킨다(같은 학생을 빠르게 두 번 눌러도 마지막 값이 남게)

/* ── 알림 ───────────────── */
let toastT = 0;
function toast(msg, err) {
  const t = $('toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(() => { t.className = ''; }, err ? 4000 : 1400);
}
function authLost(r) {
  if (r && r.auth === false) { showLogin('다시 로그인해 주세요. (로그인 시간이 지났어요)'); return true; }
  return false;
}

/* ── 로그인 ───────────────── */
function showLogin(msg) {
  $('app').classList.add('hide'); $('login').classList.remove('hide');
  loginBox($('login'), start);
  if (msg) $('lg-msg').textContent = msg;
}
async function start() {
  $('login').classList.add('hide'); $('app').classList.remove('hide');
  $('tbl').innerHTML = '<div class="loading">불러오는 중…</div>';
  const kw = await loadKeywords();
  if (authLost(kw)) return;
  if (!kw || !kw.ok) { $('tbl').innerHTML = '<div class="loading">인정 단어를 받지 못했어요. ' + esc((kw && kw.msg) || '') + ' [새로 고침]을 눌러 주세요.</div>'; return; }
  const r = await T.list('');
  if (authLost(r)) return;
  if (!r || !r.ok) { $('tbl').innerHTML = '<div class="loading">' + esc((r && r.msg) || '반 목록을 받지 못했어요.') + '</div>'; return; }
  V.bans = r.bans || [];
  let want = '';
  try { want = localStorage.getItem(KEY_BAN) || ''; } catch (e) {}
  const q = new URLSearchParams(location.search).get('ban');
  if (q && V.bans.includes(q)) want = q;
  fillBans(V.bans.includes(want) ? want : V.bans[0] || '');
  await openBan($('ban').value);
}
function fillBans(sel) {
  $('ban').innerHTML = V.bans.length ? V.bans.map((b) => '<option value="' + esc(b) + '"' + (b === sel ? ' selected' : '') + '>' + esc(b) + '</option>').join('')
    : '<option value="">—</option>';
}

/* ── 반 불러오기 ───────────────── */
async function openBan(ban) {
  V.ban = ban; V.sel = null; V.cur = 0;
  try { if (ban) localStorage.setItem(KEY_BAN, ban); } catch (e) {}
  if (!ban) { V.students = []; V.closed = false; render(); $('tbl').innerHTML = '<div class="loading">아직 들어온 반이 없어요. 학생이 게임에서 반·번호를 넣으면 여기 나타나요.</div>'; return; }
  V.busy = true;
  const r = await loadClass(ban);
  V.busy = false;
  if (authLost(r)) return;
  if (!r || !r.ok) { toast((r && r.msg) || '불러오지 못했어요.', true); return; }
  V.students = r.students; V.closed = !!r.closed;
  if (r.bans && r.bans.join() !== V.bans.join()) { V.bans = r.bans; fillBans(ban); }
  render();
  // 시트에 임시 판정·확인 표시 맞춰 두기(조용히)
  chain = chain.then(() => syncAuto(ban, V.students)).then((s) => { if (s && !s.ok) { if (!authLost(s)) toast('임시 판정을 시트에 적지 못했어요: ' + (s.msg || ''), true); } });
}

/* ── 그리기 ───────────────── */
function chip(g, conf, chk, extra) {
  const cls = 'chip ' + (GC[g] || 'gn') + (g === '미응답' ? '' : conf ? ' conf' : ' temp') + (chk ? ' chk' : '');
  return '<span class="' + cls + '" title="' + (g === '미응답' ? '미응답' : (conf ? '확정' : '임시') + (chk ? ' · 확인 필요' : '')) + '">' + esc(g) + (extra || '') + '</span>';
}
function status(s) {
  if (s.submitted) return '<span class="stt-sub">제출 ' + esc(String(s.submittedAt || '').slice(11, 16)) + '</span>';
  if (s.registered) return '<span class="stt-work">작성 중</span>';
  return '<span class="stt-none">미접속</span>';
}
function render() {
  const sub = V.students.filter((s) => s.submitted).length;
  $('st-sub').innerHTML = '제출 <b>' + sub + '</b>/' + V.students.length;
  $('st-chk').innerHTML = '확인 필요 <b>' + V.students.filter((s) => s.registered && needsCheck(s.j)).length + '</b>';
  $('tag-closed').classList.toggle('hide', !V.closed);
  $('btn-close').textContent = V.closed ? '마감 풀기' : '반 마감';
  $('btn-close').disabled = $('btn-print').disabled = !V.ban;
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === V.tab)));
  $('v-table').classList.toggle('hide', V.tab !== 'table');
  $('v-item').classList.toggle('hide', V.tab === 'table');
  if (V.tab === 'table') { renderTable(); renderDetail(); } else renderItem();
}

function renderTable() {
  const st = V.students;
  if (!st.length) { $('tbl').innerHTML = '<div class="loading">이 반에는 아직 학생이 없어요.</div>'; return; }
  const half = st.length > 12 ? Math.ceil(st.length / 2) : st.length;
  const parts = [st.slice(0, half), st.slice(half)].filter((p) => p.length);
  $('tbl').innerHTML = parts.map((part) =>
    '<table class="cls"><thead><tr><th>번호</th><th>이름</th><th>상태</th><th>1번</th><th>2번</th><th>3번</th><th>종합</th></tr></thead><tbody>' +
    part.map((s) => {
      const j = s.j;
      const cells = j.items.map((it) => cellTd(s, it.no, chip(it.grade, it.confirmed, it.check))).join('');
      const t = j.total;
      const tMini = t.direct ? '<span class="mini">직접</span>' : t.candidate && !t.confirmed ? '<span class="mini">◎ 후보</span>' : '';
      return '<tr data-num="' + esc(s.num) + '" class="' + (s.submitted ? '' : 'not-sub') + '"><td class="num">' + esc(s.num) + '</td><td class="nm" title="' + esc(s.name) + '">' + esc(s.name) + '</td><td class="stt">' + status(s) + '</td>' +
        cells + cellTd(s, '종합', chip(t.grade, t.confirmed, t.check && !t.direct) + tMini) + '</tr>';
    }).join('') + '</tbody></table>').join('');
}
function cellTd(s, item, inner) {
  const sel = V.sel && V.sel.num === s.num && V.sel.item === item;
  return '<td class="cell' + (sel ? ' sel' : '') + '" data-num="' + esc(s.num) + '" data-item="' + item + '" tabindex="0">' + inner + '</td>';
}

function renderDetail() {
  const d = $('detail');
  const s = V.sel && V.students.find((x) => x.num === V.sel.num);
  if (!s) { d.innerHTML = '<div class="empty">표에서 칸을 누르면 그 학생의 답이 여기 펼쳐져요.<br>1·2·3 = ◎○△, ←→ = 이전·다음 학생</div>'; return; }
  if (V.sel.item !== '종합') { d.innerHTML = card(s, V.sel.item, true); return; }
  const j = s.j, t = j.total;
  d.innerHTML = '<div class="det-head"><b>' + esc(s.num) + '번</b><span>' + esc(s.name) + '</span>' + status(s) + '</div>' +
    '<div class="det-sum">' + j.items.map((it) => '<div>' + it.no + '번<br>' + chip(it.grade, it.confirmed, it.check) + '</div>').join('') + '</div>' +
    '<div class="card"><header><b>종합</b>' + chip(t.grade, t.confirmed, t.check && !t.direct) +
    '<span class="lbl">' + (t.direct ? '교사가 직접 정함 (문항을 바꿔도 이 값이 우선)' : t.candidate ? '◎ 후보 — 1번이 ○예요. 직접 정해 주세요' : '1·2·3번 판정으로 계산') + '</span>' +
    '<span class="grow"></span></header>' +
    '<div class="marks">' + ['◎', '○', '△'].map((m) => '<button class="mk ' + MC[m] + (t.direct && t.grade === m ? ' on' : '') + '" data-num="' + esc(s.num) + '" data-item="종합" data-v="' + m + '">' + m + '</button>').join('') +
    '<button class="mk auto" data-num="' + esc(s.num) + '" data-item="종합" data-v=""' + (t.direct ? '' : ' disabled') + '>자동 계산으로</button></div></div>';
}

// 문항 카드 (문항 탭·펼침 같이 씀)
function card(s, item, detail, idx) {
  const j = s.j, it = j.items[+item - 1];
  const head = '<header><b class="num">' + esc(s.num) + '번</b><span class="nm">' + esc(s.name) + '</span><span class="stt">' + status(s) + '</span>' +
    (detail ? '<span class="lbl">' + item + '번</span>' : '') + '<span class="grow"></span>' +
    '<span class="lbl">' + (it.confirmed ? '확정' : '임시') + '</span>' + chip(it.grade, it.confirmed, it.check) +
    '<span class="marks">' + ['◎', '○', '△'].map((m) => {
      const on = it.confirmed && it.grade === m, sug = !it.confirmed && it.auto === m;
      return '<button class="mk ' + MC[m] + (on ? ' on' : '') + (sug ? ' sug' : '') + '" data-num="' + esc(s.num) + '" data-item="' + item + '" data-v="' + m + '" title="' + m + (on ? ' (다시 누르면 확정 지움)' : '') + '">' + m + '</button>';
    }).join('') + '</span></header>';
  let body = '';
  if (!s.registered) body = '<div class="fld"><span class="ft blank">아직 게임에 들어오지 않았어요.</span></div>';
  else body = itemFields(j, item).map((f) => '<div class="fld"><span class="fl">' + esc(FIELD_NAME[f.i]) + '</span>' + fieldHtml(s.answers[f.i], f.fr) + '</div>').join('') + basis(j, item);
  const cls = 'card' + (!detail && idx === V.cur ? ' cur' : '') + (s.registered ? '' : ' off');
  return '<article class="' + cls + '" data-num="' + esc(s.num) + '"' + (idx != null ? ' data-idx="' + idx + '"' : '') + '>' + head + body + '</article>';
}
function fieldHtml(text, fr) {
  if (!String(text || '').trim()) return '<span class="ft blank">(빈 칸)</span>';
  if (fr && 'picked' in fr) {   // 기호 칸
    if (fr.invalid) return '<span class="ft">' + esc(text) + ' <span class="miss">기호 말고 다른 글자가 섞임</span></span><span class="st">' + DOT[fr.state] + '</span>';
    const sym = fr.picked.map((c) => '<span class="sym ' + (fr.right.includes(c) ? 'ok' : 'bad') + '">' + esc(symShow(c)) + '</span>').join('');
    const miss = fr.missing.length ? '<span class="miss">빠짐 ' + esc(fr.missing.map(symShow).join(', ')) + '</span>' : '';
    return '<span class="ft">' + sym + miss + '</span><span class="st">' + DOT[fr.state] + '</span>';
  }
  return '<span class="ft">' + paint(text, fr) + '</span><span class="st">' + DOT[fr ? fr.state : 'none'] + '</span>';
}
function basis(j, item) {
  const chips = [];
  itemFields(j, item).forEach((f) => {
    if ('picked' in f.fr || !(f.fr.groups || []).length) { chips.push([f.fr.state, FIELD_NAME[f.i]]); return; }
    f.fr.groups.forEach((g) => chips.push([g.state, g.label]));
  });
  return '<div class="basis">' + chips.map(([st, l]) => '<span class="bchip ' + (st === 'green' ? 'g' : st === 'yellow' ? 'y' : 'n') + '">' + DOT[st] + ' ' + esc(l) + '</span>').join('') + '</div>';
}

function visibleList() {
  const item = V.tab;
  return V.students.filter((s) => !V.yellowOnly || (s.registered && (itemHasYellow(s.j, item) || s.j.items[+item - 1].check)));
}
function renderItem() {
  const item = V.tab;
  $('it-q').textContent = PROMPT[item]; $('it-q').title = PROMPT[item];
  const elig = V.students.filter((s) => s.submitted && itemGreenOnly(s.j, item) && !s.j.items[+item - 1].confirmed);
  $('btn-bulk').textContent = '🟢만 있는 답 일괄 확정 (' + elig.length + '명)';
  $('btn-bulk').disabled = !elig.length;
  $('btn-yel').setAttribute('aria-pressed', String(V.yellowOnly));
  const list = visibleList();
  if (V.cur >= list.length) V.cur = Math.max(0, list.length - 1);
  const box = $('cards'), top = box.scrollTop;
  box.innerHTML = list.length ? list.map((s, i) => card(s, item, false, i)).join('') : '<div class="none">' + (V.yellowOnly ? '이 문항에 🟡 답이 없어요.' : '학생이 없어요.') + '</div>';
  box.scrollTop = top;
}
function scrollCur() { const c = $('cards').querySelector('.card.cur'); if (c) c.scrollIntoView({ block: 'nearest' }); }

/* ── 판정 저장 ───────────────── */
function commit(job, okMsg) {
  render();
  const ban = V.ban;
  chain = chain.then(() => job.send(ban)).then((r) => {
    if (r && r.ok) { if (okMsg) toast(okMsg); return; }
    job.undo(); render();
    if (!authLost(r)) toast('저장하지 못했어요. ' + ((r && r.msg) || '') + ' 다시 눌러 주세요.', true);
  });
  return chain;
}
function setMark(num, item, v) {
  const s = V.students.find((x) => x.num === num); if (!s) return;
  if (item === '종합') { commit(prepTotal(s, v), v ? '종합 ' + v + ' (직접)' : '종합을 자동 계산으로'); return; }
  const it = s.j.items[+item - 1];
  const value = it.confirmed && it.grade === v ? '' : v;   // 확정한 값을 다시 누르면 확정 지움
  commit(prepItems([{ s, item, value }]), value ? num + '번 ' + item + '번 ' + value + ' 확정' : num + '번 ' + item + '번 확정 지움');
}

/* ── 이벤트 ───────────────── */
$('ban').addEventListener('change', (e) => openBan(e.target.value));
$('btn-reload').addEventListener('click', () => { if (V.ban) openBan(V.ban); else start(); });
$('btn-out').addEventListener('click', () => { T.logout(); showLogin(''); });
$('btn-print').addEventListener('click', () => { if (V.ban) window.open('print.html?ban=' + encodeURIComponent(V.ban), '_blank'); });
$('btn-close').addEventListener('click', async () => {
  if (!V.ban) return;
  const on = !V.closed;
  if (!confirm(on ? '6학년 ' + V.ban + '반을 마감할까요?\n마감하면 학생들이 답을 고치거나 다시 제출할 수 없어요.' : '6학년 ' + V.ban + '반 마감을 풀까요?\n학생들이 다시 답을 고칠 수 있어요.')) return;
  const r = await T.close(V.ban, on);
  if (authLost(r)) return;
  if (!r || !r.ok) { toast('마감을 바꾸지 못했어요. ' + ((r && r.msg) || ''), true); return; }
  V.closed = !!r.closed; render(); toast(V.closed ? V.ban + '반을 마감했어요.' : V.ban + '반 마감을 풀었어요.');
});
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  V.tab = b.dataset.tab; V.cur = 0; render(); if (V.tab !== 'table') $('cards').scrollTop = 0;
});
$('btn-yel').addEventListener('click', () => { V.yellowOnly = !V.yellowOnly; V.cur = 0; render(); $('cards').scrollTop = 0; });
$('btn-bulk').addEventListener('click', () => {
  const item = V.tab;
  const elig = V.students.filter((s) => s.submitted && itemGreenOnly(s.j, item) && !s.j.items[+item - 1].confirmed);
  if (!elig.length) return;
  commit(prepItems(elig.map((s) => ({ s, item, value: s.j.items[+item - 1].auto }))), item + '번 ' + elig.length + '명 일괄 확정');
});
document.addEventListener('click', (e) => {
  const mk = e.target.closest('button.mk');
  if (mk) {
    if (V.tab !== 'table') { const c = mk.closest('.card'); if (c && c.dataset.idx != null) V.cur = +c.dataset.idx; }
    setMark(mk.dataset.num, mk.dataset.item, mk.dataset.v); return;
  }
  const td = e.target.closest('td.cell');
  if (td) { V.sel = { num: td.dataset.num, item: td.dataset.item }; render(); return; }
  const c = e.target.closest('#cards .card');
  if (c && c.dataset.idx != null && +c.dataset.idx !== V.cur) { V.cur = +c.dataset.idx; renderItem(); }
});
document.addEventListener('keydown', (e) => {
  if ($('app').classList.contains('hide') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key === 'Enter' && e.target.matches && e.target.matches('td.cell')) { e.target.click(); return; }
  const mark = { 1: '◎', 2: '○', 3: '△' }[e.key];
  const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown', back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
  const clear = e.key === 'Backspace' || e.key === 'Delete';
  if (!mark && !fwd && !back && !clear) return;
  if (V.tab === 'table') {
    if (!V.sel) return;
    e.preventDefault();
    const i = V.students.findIndex((x) => x.num === V.sel.num);
    if (fwd || back) { const n = V.students[i + (fwd ? 1 : -1)]; if (n) { V.sel = { num: n.num, item: V.sel.item }; render(); } return; }
    const s = V.students[i]; if (!s) return;
    if (V.sel.item === '종합') { if (mark) setMark(s.num, '종합', mark); else if (clear) setMark(s.num, '종합', ''); return; }
    const it = s.j.items[+V.sel.item - 1];
    if (mark) { if (!(it.confirmed && it.grade === mark)) setMark(s.num, V.sel.item, mark); }
    else if (it.confirmed) setMark(s.num, V.sel.item, it.grade);
    return;
  }
  const list = visibleList(); if (!list.length) return;
  e.preventDefault();
  if (fwd || back) { V.cur = Math.max(0, Math.min(list.length - 1, V.cur + (fwd ? 1 : -1))); renderItem(); scrollCur(); return; }
  const s = list[V.cur], item = V.tab, it = s.j.items[+item - 1];
  if (mark) {
    if (!(it.confirmed && it.grade === mark)) setMark(s.num, item, mark);
    // 판정하면 다음 학생으로 (🟡만 보기에서도 그 학생은 목록에 남는다 — 확인 표시가 아니라 🟡 낱말로 거르므로)
    const nl = visibleList();
    V.cur = Math.min(nl.length - 1, nl.indexOf(s) + 1); renderItem(); scrollCur();
  } else if (clear && it.confirmed) setMark(s.num, item, it.grade);
});

/* ── 시작 ───────────────── */
window.__tch = { V, T };   // 자동 시험용
if (T.loggedIn) start(); else showLogin('');
