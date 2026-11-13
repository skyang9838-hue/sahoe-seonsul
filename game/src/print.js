// 반별 답안집: print.html?ban=N — 학생 1명 = A4 1장, 번호순. 기준본 한글 양식의 문항 쪽 모양에 학생 답을 채운다.
//   판정 넣기(?grade=1)·미제출 장 넣기(?missing=1)는 위 띠에서 켜고 끈다. 긴 답은 글자를 줄여 한 장에 맞추고, 그래도 넘치면 위에 경고.
import { T, esc, loadKeywords, loadClass, loginBox } from './teacher-core.js?v=1';
import { Q1, Q2, Q3, symShow } from './items.js?v=1';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const BAN = (qs.get('ban') || '').replace(/\D/g, '');
const TAG = { 4: '가)', 5: '나)', 6: '가)', 7: '나) 다하지 못한 점', 8: '나) 개선할 방법' };
const MIN_LINES = { 4: 2, 5: 2, 6: 2, 7: 2, 8: 2 };   // 답 줄 최소 줄 수(답이 짧아도 종이처럼 줄을 그어 둠)
// 넘칠 때 줄여 보는 단계: [답 글자 pt, 최소 줄 수 쓰기]
const STEPS = [[10, true], [10, false], [9.5, false], [9, false], [8.5, false], [8, false], [7.5, false], [7, false]];
const O = { grade: qs.get('grade') === '1', missing: qs.get('missing') === '1' };
let DATA = null;

function sheetHtml(s) {
  const a = s.answers || [], j = s.j;
  const jm = (no) => {
    if (!O.grade || !s.registered) return '';
    const it = j.items[no - 1];
    return '<div class="jm"><b>' + esc(it.grade === '미응답' ? '－' : it.grade) + '</b>' + (it.grade === '미응답' ? '미응답' : it.confirmed ? '' : '임시') + (it.check ? '<br>확인' : '') + '</div>';
  };
  const choice = (v) => esc(symShow(v) || String(v || ''));
  const blank = (v) => '<span class="blank-ans aval">' + (String(v || '').trim() ? esc(v) : '　　　　　　') + '</span>';
  const field = (i) => '<div class="alines" data-i="' + i + '" style="min-height:calc(var(--lh) * var(--min' + i + ', ' + MIN_LINES[i] + '))"><span class="tag">' + esc(TAG[i]) + '</span>' + esc(String(a[i] || '').replace(/\r\n?/g, '\n')) + '</div>';
  const t = j && j.total;
  const who = '<div class="who"><span>6학년 ' + esc(BAN) + '반 ' + esc(s.num) + '번</span>' + (s.name ? '<span class="nm">(' + esc(s.name) + ')</span>' : '') +
    '<span class="sp"></span>' + (s.submitted ? '' : '<span class="stamp">미제출</span>') +
    (O.grade && s.registered && t ? '<span class="tot">종합<b>' + esc(t.grade === '미응답' ? '－' : t.grade) + '</b>' + (t.confirmed ? '' : ' 임시') + '</span>' : '') + '</div>';
  return '<section class="sheet" data-num="' + esc(s.num) + '"><div class="frame">' + who + '<div class="content">' +
    '<p class="qp">' + esc(Q1.prompt) + '</p>' +
    '<p class="qp">' + esc(Q1.sub1) + '</p>' +
    '<div class="boxrow"><div class="box"><div>' + esc(Q1.boxTitle) + '</div>' + Q1.options.map((o) => '<div>' + esc(o) + '</div>').join('') + '</div>' + jm(1) + '</div>' +
    '<div class="gap-m"></div>' +
    Q1.rows.map((r, i) => '<div class="alines choice"><span class="lb">' + esc(r) + '</span> <span class="aval">' + choice(a[i]) + '</span></div>').join('') +
    '<div class="gap-s"></div>' +
    '<p class="qp">' + esc(Q1.sub2) + '</p>' +
    '<div class="boxrow"><div class="box blanks">' + Q1.lines.map((l, i) => '<div>' + esc(l[0]) + blank(a[2 + i]) + esc(l[1]) + '</div>').join('') + '</div></div>' +
    '<div class="gap-s"></div>' +
    '<p class="qp">' + esc(Q2.prompt) + '</p>' +
    '<div class="boxrow"><div class="box">' + Q2.cond.map((c) => '<div>' + esc(c) + '</div>').join('') + '</div>' + jm(2) + '</div>' +
    '<div class="gap-m"></div>' + field(4) + field(5) +
    '<div class="gap-s"></div>' +
    '<p class="qp">' + esc(Q3.prompt) + '</p>' +
    '<div class="boxrow"><div class="box">' + Q3.cond.map((c) => '<div>' + esc(c) + '</div>').join('') + '</div>' + jm(3) + '</div>' +
    '<div class="gap-m"></div>' + field(6) + field(7) + field(8) +
    '</div></div></section>';
}

// 넘치면 단계별로 줄이기. 돌려주는 값: 넘친 채로 남았나
function fit(sheet) {
  const c = sheet.querySelector('.content');
  for (const [pt, useMin] of STEPS) {
    sheet.style.setProperty('--af', pt + 'pt');
    sheet.style.setProperty('--lh', (pt * 1.6).toFixed(2) + 'pt');
    for (const i of Object.keys(MIN_LINES)) sheet.style.setProperty('--min' + i, useMin ? MIN_LINES[i] : 1);
    if (c.scrollHeight <= c.clientHeight + 1) { sheet.classList.remove('over'); sheet.dataset.af = pt; return false; }
  }
  // 가장 작은 글자로도 넘침: 긴 칸부터 끝을 잘라 한 장 안에 둔다(넘친 글이 다음 쪽으로 밀려 쪽 수가 틀어지지 않게).
  // 잘린 칸 끝에는 빨간 "…(잘림)" 표시, 화면 위에는 경고. 전체 답은 교사 화면에서 본다.
  const fields = [...sheet.querySelectorAll('.alines[data-i]')];
  for (let k = 0; k < 80 && c.scrollHeight > c.clientHeight + 1; k++) {
    const f = fields.reduce((m, x) => (x.dataset.len = x.dataset.len || String(x.dataset.full ? x.dataset.full.length : textOf(x).length), !m || +x.dataset.len > +m.dataset.len ? x : m), null);
    if (!f || +f.dataset.len < 20) break;
    if (!f.dataset.full) f.dataset.full = textOf(f);
    const n = Math.floor(+f.dataset.len * 0.85);
    f.dataset.len = String(n);
    [...f.childNodes].filter((x) => x.nodeType === 3).forEach((x) => x.remove());
    let cut = f.querySelector('.cut');
    if (!cut) { cut = document.createElement('span'); cut.className = 'cut'; cut.textContent = ' …(잘림)'; f.appendChild(cut); }
    f.insertBefore(document.createTextNode(f.dataset.full.slice(0, n)), cut);
  }
  sheet.classList.add('over'); sheet.dataset.af = 'over';
  return true;
}
// 답 줄의 학생 글(칸 이름표·잘림 표시 뺀 글 노드)
function textOf(f) { const t = [...f.childNodes].filter((n) => n.nodeType === 3); return t.map((n) => n.textContent).join(''); }

function render() {
  if (!DATA) return;
  const list = DATA.students.filter((s) => s.submitted || (O.missing));
  $('opt-grade').checked = O.grade; $('opt-missing').checked = O.missing;
  const sub = DATA.students.filter((s) => s.submitted).length;
  $('t-title').textContent = '6학년 ' + BAN + '반 답안집';
  $('t-info').textContent = '제출 ' + sub + '명 / 전체 ' + DATA.students.length + '명 · 이번 인쇄 ' + list.length + '장' + (DATA.closed ? ' · 마감됨' : ' · 아직 마감 전');
  $('pages').innerHTML = list.map(sheetHtml).join('');
  $('msg').classList.toggle('hide', list.length > 0);
  if (!list.length) $('msg').textContent = '제출한 학생이 없어요. (미제출 장 넣기를 켜면 미제출 학생도 나와요)';
  const over = [];
  $('pages').querySelectorAll('.sheet').forEach((sh) => { if (fit(sh)) over.push(sh.dataset.num + '번'); });
  const w = $('warn');
  w.classList.toggle('hide', !over.length);
  w.textContent = over.length ? '⚠ 글자를 가장 작게 줄여도 한 장을 넘는 답이 있어요: ' + over.join(', ') + ' — 빨간 테두리 장은 끝이 잘려 인쇄돼요. 교사 화면에서 답 전체를 확인해 주세요.' : '';
  document.body.dataset.ready = '1';
  document.body.dataset.sheets = String(list.length);
  document.body.dataset.over = String(over.length);
}

function setOpt(k, v) {
  O[k] = v;
  const u = new URL(location.href); u.searchParams.set(k, v ? '1' : '0'); history.replaceState(null, '', u);
  render();
}

async function start() {
  $('login').classList.add('hide');
  if (!BAN) { $('msg').textContent = '주소에 반이 없어요. 교사 화면에서 [답안집 PDF]를 눌러 열어 주세요.'; return; }
  $('msg').textContent = '불러오는 중…';
  const kw = await loadKeywords();
  if (kw && kw.auth === false) { showLogin('다시 로그인해 주세요.'); return; }
  if (!kw || !kw.ok) { $('msg').textContent = '인정 단어를 받지 못했어요. ' + ((kw && kw.msg) || ''); return; }
  const r = await loadClass(BAN);
  if (r && r.auth === false) { showLogin('다시 로그인해 주세요.'); return; }
  if (!r || !r.ok) { $('msg').textContent = (r && r.msg) || '불러오지 못했어요.'; return; }
  DATA = r;
  DATA.students.sort((x, y) => x.num - y.num);
  $('tools').classList.remove('hide');
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  render();
}
function showLogin(msg) {
  $('tools').classList.add('hide'); $('msg').classList.add('hide'); $('pages').innerHTML = '';
  $('login').classList.remove('hide');
  loginBox($('login'), () => { $('msg').classList.remove('hide'); start(); });
  if (msg) $('lg-msg').textContent = msg;
}

$('opt-grade').addEventListener('change', (e) => setOpt('grade', e.target.checked));
$('opt-missing').addEventListener('change', (e) => setOpt('missing', e.target.checked));
$('btn-print').addEventListener('click', () => window.print());
window.__print = { O, setOpt, get data() { return DATA; } };   // 자동 시험용
if (T.loggedIn) start(); else showLogin('');
