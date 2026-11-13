/**
 * 꼬꼬의 첫 출근 — 서버 (Google Apps Script + 구글 시트, 3문항·9칸판)
 *
 * 6학년 사회 [6사11-01] 서·논술형 평가 웹앱의 저장·교사 서버. 2D 판 웹앱/src/Code.js를 3문항판으로 옮겼다.
 * 스프레드시트에 연결된(컨테이너 바인딩) 스크립트로 쓴다. 게임·교사 화면은 GitHub Pages에 있고,
 * 이 스크립트는 웹앱(/exec)으로 배포해 doPost 하나로 모든 요청을 받는다.
 * 요청 = Content-Type text/plain 에 JSON 한 덩어리 {action, ...}  (브라우저 사전 요청(CORS preflight)을 피하려고 text/plain)
 * 응답 = JSON. 약속 전체는 game/src/srv.js 맨 위 주석과 같다.
 *
 * 시트 탭
 *   답안     A 반 | B 번호 | C~K a0~a8 (1(1)가계·1(1)기업·1(2)①·1(2)②·2가)·2나)·3가)·3나)문제점·3나)개선)
 *            | L 상태 | M 진행 | N 마지막 저장 | O 제출 시각 | P 최초 접속
 *   채점     A 반 | B 번호 | C~F 1번·2번·3번·종합 임시 | G 확인 | H~K 1번·2번·3번·종합 확정 | L 종합 직접 | M 교사 수정 시각
 *   설정     A 반 | B 마감(Y/빈칸) | C 바뀐 시각
 *   명단     A 반 | B 번호 | C 이름   (선택. 교사가 직접 붙여 넣는다 — 앱은 학생 명단 파일을 읽지 않는다)
 *   인정단어 (숨김) A열에 인정 단어 JSON을 나눠 담는다. setupKeywords()로 넣는다.
 *
 * 비밀 두 가지는 코드에 넣지 않는다
 *   - 교사 비밀번호: 스크립트 속성 TEACHER_PW
 *   - 인정 단어: 숨김 탭 '인정단어' (없으면 스크립트 속성 KEYWORDS_JSON)
 *
 * 동시 접속: 시트에 쓰는 요청(register·save·submit·grade·gradeBulk·close)은 모두 스크립트 락 안에서 쓴다.
 * 학생은 5초마다·바뀐 것이 있을 때만 저장하므로 한 반 23명이 같이 써도 락 대기는 짧다.
 */

var TZ = 'Asia/Seoul';
var N_ANS = 9;
var SH_ANS = '답안', SH_GRADE = '채점', SH_SET = '설정', SH_ROSTER = '명단', SH_KW = '인정단어';

var ANS_HEAD = ['반', '번호', '1(1) 가계', '1(1) 기업', '1(2) ①', '1(2) ②', '2 가)', '2 나)', '3 가)', '3 나) 문제점', '3 나) 개선',
                '상태', '진행', '마지막 저장', '제출 시각', '최초 접속'];
var A_ANS = 3;              // C열 = a0
var A_STATUS = 12;          // L
var A_PROG = 13;            // M
var A_SAVED = 14;           // N
var A_SUBMIT = 15;          // O
var A_FIRST = 16;           // P
var A_LAST = 16;

var GRADE_HEAD = ['반', '번호', '1번 임시', '2번 임시', '3번 임시', '종합 임시', '확인', '1번 확정', '2번 확정', '3번 확정', '종합 확정', '종합 직접', '교사 수정 시각'];
var G_AUTO = 3, G_CHECK = 7, G_FINAL = 8, G_DIRECT = 12, G_AT = 13, G_LAST = 13;
var ITEMS = ['1', '2', '3', '종합'];
var MARKS = ['◎', '○', '△', ''];

var SET_HEAD = ['반', '마감', '바뀐 시각'];
var ROSTER_HEAD = ['반', '번호', '이름'];

var ST_WORK = '작성중', ST_DONE = '제출완료';
var TOKEN_HOURS = 6;
var MAX_TEXT = 3000;        // 칸 하나 최대 글자 수
var KW_CHUNK = 40000;       // 시트 칸 하나에 5만 자까지 들어가므로 4만 자씩 나눈다

/* ── 웹앱 진입점 ─────────────────────────── */

function doGet() {
  return json_({ ok: true, msg: '꼬꼬의 첫 출근 서버가 켜져 있어요. 게임에서 POST로 부릅니다.' });
}

function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, msg: '요청 형식이 맞지 않아요.' }); }
  return json_(route_(body || {}));
}

/** action 이름 → 처리 함수. 교사 요청은 토큰을 먼저 본다. */
function route_(b) {
  try {
    switch (b.action) {
      case 'register': return register_(b.ban, b.num);
      case 'save':     return write_(b, false);
      case 'submit':   return write_(b, true);
      case 'login':    return login_(b.pw);
      case 'list':
      case 'keywords':
      case 'grade':
      case 'gradeBulk':
      case 'close':
        if (!checkToken_(b.token)) return { ok: false, auth: false, msg: '다시 로그인해 주세요.' };
        if (b.action === 'list') return list_(b.ban);
        if (b.action === 'keywords') return keywords_();
        if (b.action === 'grade') return grade_(b.ban, b.num, b.item, b.value);
        if (b.action === 'gradeBulk') return gradeBulk_(b.ban, b.list);
        return close_(b.ban, b.on);
      default: return { ok: false, msg: '알 수 없는 요청이에요.' };
    }
  } catch (err) {
    return { ok: false, msg: '서버에서 문제가 생겼어요. (' + err + ')' };
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ── 작은 도구 ───────────────────────────── */

function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function norm_(v) { return String(v == null ? '' : v).replace(/^\s+|\s+$/g, ''); }
/** 반·번호: 숫자 1~2자리만 받고 앞의 0을 뗀다. exam.js의 digits()와 같은 규칙. */
function digits_(v) { v = norm_(v); return /^\d{1,2}$/.test(v) ? String(parseInt(v, 10)) : ''; }
/** 시트가 날짜 값으로 바꿔 놓은 칸도 글자로 돌려준다. */
function txt_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss') : String(v == null ? '' : v); }
/** 화면에 보이는 시각은 분까지(로컬 스텁과 같은 모양). */
function short_(v) { return txt_(v).slice(0, 16); }
function blank_() { var a = []; for (var i = 0; i < N_ANS; i++) a.push(''); return a; }
/** 학생 글이 =, +, -, @로 시작하면 시트가 수식으로 읽지 않게 앞에 ' 를 붙인다(시트에는 안 보이고 읽으면 원래 글). */
function safe_(v) {
  v = String(v == null ? '' : v);
  if (v.length > MAX_TEXT) v = v.slice(0, MAX_TEXT);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function lock_(ms) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(ms); return lock; } catch (e) { return null; }
}

/* ── 시트 준비 ───────────────────────────── */

function ss_() { return SpreadsheetApp.getActive(); }

/** 탭이 없으면 머리줄을 넣어 만든다. 있으면 머리줄이 그대로인지 본다(열을 끼우거나 지우면 엉뚱한 칸에 쓰게 되므로). */
function sheet_(name, head, setupFn) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#fdf3e1');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');   // 반·번호·답·시각을 모두 글자로
    if (setupFn) setupFn(sh);
    return sh;
  }
  var cur = sh.getRange(1, 1, 1, head.length).getValues()[0];
  for (var i = 0; i < head.length; i++) {
    if (norm_(cur[i]) !== head[i]) throw new Error(name + ' 탭의 머리줄(' + (i + 1) + '번째 열 "' + head[i] + '")을 확인해 주세요.');
  }
  return sh;
}

function ansSheet_() {
  return sheet_(SH_ANS, ANS_HEAD, function (sh) {
    var w = [44, 48, 90, 90, 110, 110, 260, 260, 260, 260, 260, 70, 50, 130, 130, 130];
    for (var i = 0; i < w.length; i++) sh.setColumnWidth(i + 1, w[i]);
    sh.getRange(1, A_ANS, sh.getMaxRows(), N_ANS).setWrap(true).setVerticalAlignment('top');
  });
}
function gradeSheet_() { return sheet_(SH_GRADE, GRADE_HEAD); }
function setSheet_() { return sheet_(SH_SET, SET_HEAD); }
function rosterSheet_() { return sheet_(SH_ROSTER, ROSTER_HEAD); }

/** 데이터 행(2행부터) 전체. 비어 있으면 []. */
function rows_(sh, ncol) {
  var last = sh.getLastRow();
  return last >= 2 ? sh.getRange(2, 1, last - 1, ncol).getValues() : [];
}
/** 반·번호가 같은 행 번호(시트 기준). 없으면 0. */
function findRow_(rows, ban, num) {
  for (var i = 0; i < rows.length; i++) if (digits_(rows[i][0]) === ban && digits_(rows[i][1]) === num) return i + 2;
  return 0;
}

function closedMap_() {
  var m = {};
  var sh = ss_().getSheetByName(SH_SET);
  if (!sh) return m;
  rows_(sh, 2).forEach(function (r) { var b = digits_(r[0]); if (b && norm_(r[1]) === 'Y') m[b] = true; });
  return m;
}
function isClosed_(ban) { return !!closedMap_()[ban]; }

/** 처음 한 번: 편집기에서 실행하면 탭 다섯 개를 만든다(안 해도 첫 요청 때 필요한 탭은 저절로 생긴다). */
function setup() {
  var lock = lock_(30000);
  if (!lock) throw new Error('잠시 뒤 다시 실행해 주세요.');
  try {
    ansSheet_(); gradeSheet_(); setSheet_(); rosterSheet_();
    kwSheet_();
    Logger.log('탭 준비 끝: 답안·채점·설정·명단·인정단어(숨김)');
  } finally { lock.releaseLock(); }
}

/* ── 학생: 등록 / 이어하기 ───────────────── */

function register_(ban, num) {
  if (!norm_(ban) || !norm_(num)) return { ok: false, msg: '반과 번호를 골라 주세요.' };
  ban = digits_(ban); num = digits_(num);
  if (!ban || !num) return { ok: false, msg: '반과 번호는 숫자로만 적어 주세요.' };

  var lock = lock_(30000);
  if (!lock) return { ok: false, msg: '지금 접속이 몰려 있어요. 잠시 뒤 다시 눌러 주세요.' };
  try {
    var sh = ansSheet_();
    var rows = rows_(sh, A_LAST);
    var closed = isClosed_(ban);
    var row = findRow_(rows, ban, num);
    if (row) {
      var r = rows[row - 2];
      return {
        ok: true, row: row,
        answers: r.slice(A_ANS - 1, A_ANS - 1 + N_ANS).map(function (v) { return txt_(v); }),
        submitted: norm_(r[A_STATUS - 1]) === ST_DONE,
        submittedAt: short_(r[A_SUBMIT - 1]),
        progress: Number(r[A_PROG - 1]) || 0,
        closed: closed
      };
    }
    row = rows.length + 2;
    var line = [ban, num].concat(blank_()).concat([ST_WORK, 0, '', '', now_()]);
    sh.getRange(row, 1, 1, A_LAST).setValues([line]);
    return { ok: true, row: row, answers: blank_(), submitted: false, submittedAt: '', progress: 0, closed: closed };
  } finally {
    lock.releaseLock();
  }
}

/* ── 학생: 저장 / 제출 ───────────────────── */

/** save(final=false)와 submit(final=true). 마감된 반은 거부. 제출한 뒤에도 마감 전이면 받는다(다시 제출하면 제출 시각만 새로). */
function write_(b, final) {
  var ban = digits_(b.ban), num = digits_(b.num), answers = b.answers;
  if (!ban || !num) return { ok: false, msg: '반·번호 정보가 없어요. 새로고침한 뒤 다시 들어와 주세요.' };
  if (!Array.isArray(answers) || answers.length !== N_ANS) return { ok: false, msg: '새로고침한 뒤 다시 들어와 주세요.' };

  var lock = lock_(10000);
  if (!lock) return { ok: false, msg: '저장이 몰려 있어요. 잠시 뒤 다시 저장해 주세요.' };
  try {
    if (isClosed_(ban)) return { ok: false, closed: true, msg: '선생님이 마감했어요. 이제 답을 고칠 수 없어요.' };
    var sh = ansSheet_();
    var rows = rows_(sh, A_LAST);
    var row = findRow_(rows, ban, num);
    if (!row) return { ok: false, msg: '등록되지 않은 번호예요. 새로고침한 뒤 다시 들어와 주세요.' };
    var cur = rows[row - 2];

    var at = now_();
    var wasDone = norm_(cur[A_STATUS - 1]) === ST_DONE;
    var done = wasDone || final;
    var submittedAt = final ? at : txt_(cur[A_SUBMIT - 1]);
    var prog = Math.max(Number(cur[A_PROG - 1]) || 0, Math.min(99, Number(b.progress) || 0));
    var vals = answers.map(safe_).concat([done ? ST_DONE : ST_WORK, prog, at, submittedAt]);
    sh.getRange(row, A_ANS, 1, N_ANS + 4).setValues([vals]);
    return { ok: true, at: short_(at), submitted: done, submittedAt: short_(submittedAt), closed: false };
  } finally {
    lock.releaseLock();
  }
}

/* ── 교사: 로그인·토큰 ───────────────────── */

function login_(pw) {
  var real = PropertiesService.getScriptProperties().getProperty('TEACHER_PW');
  if (!real) return { ok: false, msg: '교사 비밀번호가 아직 설정되지 않았어요. 스크립트 속성 TEACHER_PW를 넣어 주세요.' };
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('pwfail')) || 0;
  if (fails >= 10) return { ok: false, msg: '비밀번호를 여러 번 틀렸어요. 10분 뒤 다시 해 주세요.' };
  if (String(pw == null ? '' : pw) !== real) {
    cache.put('pwfail', String(fails + 1), 600);
    return { ok: false, msg: '비밀번호가 맞지 않아요.' };
  }
  var token = Utilities.getUuid();
  cache.put('tok:' + token, '1', TOKEN_HOURS * 3600);
  return { ok: true, token: token, hours: TOKEN_HOURS };
}

function checkToken_(token) {
  token = norm_(token);
  if (!token) return false;
  return CacheService.getScriptCache().get('tok:' + token) === '1';
}

/* ── 교사: 반 답안·채점 보기 ─────────────── */

function list_(ban) {
  var ss = ss_();
  var shA = ss.getSheetByName(SH_ANS), shG = ss.getSheetByName(SH_GRADE), shR = ss.getSheetByName(SH_ROSTER);
  var ans = shA ? rows_(shA, A_LAST) : [];
  var grd = shG ? rows_(shG, G_LAST) : [];
  var ros = shR ? rows_(shR, 3) : [];

  var bset = {};
  ans.concat(ros).forEach(function (r) { var b = digits_(r[0]); if (b) bset[b] = true; });
  var bans = Object.keys(bset).sort(function (x, y) { return x - y; });
  ban = digits_(ban);
  if (!ban) return { ok: true, ban: '', bans: bans, closed: false, students: [] };

  var names = {}, nums = {};
  ros.forEach(function (r) { if (digits_(r[0]) === ban && digits_(r[1])) { names[digits_(r[1])] = norm_(r[2]); nums[digits_(r[1])] = true; } });
  var byNum = {};
  ans.forEach(function (r, i) { if (digits_(r[0]) === ban && digits_(r[1])) { byNum[digits_(r[1])] = { r: r, row: i + 2 }; nums[digits_(r[1])] = true; } });
  var gBy = {};
  grd.forEach(function (r) { if (digits_(r[0]) === ban && digits_(r[1])) gBy[digits_(r[1])] = r; });

  var students = Object.keys(nums).sort(function (x, y) { return x - y; }).map(function (n) {
    var a = byNum[n], r = a ? a.r : null;
    return {
      num: n, name: names[n] || '', row: a ? a.row : 0, registered: !!a,
      answers: r ? r.slice(A_ANS - 1, A_ANS - 1 + N_ANS).map(function (v) { return txt_(v); }) : blank_(),
      submitted: !!(r && norm_(r[A_STATUS - 1]) === ST_DONE),
      submittedAt: r ? short_(r[A_SUBMIT - 1]) : '',
      savedAt: r ? short_(r[A_SAVED - 1]) : '',
      progress: r ? (Number(r[A_PROG - 1]) || 0) : 0,
      grade: gradeObj_(gBy[n])
    };
  });
  return { ok: true, ban: ban, bans: bans, closed: isClosed_(ban), students: students };
}

function gradeObj_(r) {
  var g = { auto: {}, check: false, final: {}, direct: false, at: '' };
  for (var i = 0; i < ITEMS.length; i++) {
    g.auto[ITEMS[i]] = r ? norm_(r[G_AUTO - 1 + i]) : '';
    g.final[ITEMS[i]] = r ? norm_(r[G_FINAL - 1 + i]) : '';
  }
  if (r) { g.check = norm_(r[G_CHECK - 1]) === 'Y'; g.direct = norm_(r[G_DIRECT - 1]) === 'Y'; g.at = txt_(r[G_AT - 1]); }
  return g;
}

/* ── 교사: 인정 단어 ─────────────────────── */

function kwSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SH_KW);
  if (!sh) { sh = ss.insertSheet(SH_KW); sh.getRange(1, 1, sh.getMaxRows(), 1).setNumberFormat('@'); }
  sh.hideSheet();
  return sh;
}

function readKeywords_() {
  var sh = ss_().getSheetByName(SH_KW);
  var text = '';
  if (sh && sh.getLastRow() >= 1) {
    text = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return txt_(r[0]); }).join('');
  }
  if (!norm_(text)) text = PropertiesService.getScriptProperties().getProperty('KEYWORDS_JSON') || '';
  if (!norm_(text)) return null;
  return JSON.parse(text);
}

function keywords_() {
  var kw;
  try { kw = readKeywords_(); } catch (e) { return { ok: false, msg: '인정 단어 JSON이 깨져 있어요. setupKeywords를 다시 실행해 주세요.' }; }
  if (!kw || !kw.fields) return { ok: false, msg: '인정 단어가 아직 없어요. 배포 안내 4단계(setupKeywords)를 해 주세요.' };
  return { ok: true, keywords: kw };
}

/** 인정 단어 JSON(문자열이나 객체)을 숨김 탭에 넣는다. 반환 = 칸별 단어 수 요약. */
function setupKeywords_(src) {
  var obj = typeof src === 'string' ? JSON.parse(src) : src;
  if (!obj || !obj.fields) throw new Error('인정 단어 JSON에 fields가 없어요. server/private/keywords.json 내용을 통째로 붙여 넣어 주세요.');
  var need = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
  for (var i = 0; i < need.length; i++) if (!obj.fields[need[i]]) throw new Error('인정 단어 JSON에 ' + need[i] + ' 칸이 없어요.');
  var text = JSON.stringify(obj);
  var chunks = [];
  for (var p = 0; p < text.length; p += KW_CHUNK) chunks.push([text.slice(p, p + KW_CHUNK)]);
  var lock = lock_(30000);
  if (!lock) throw new Error('잠시 뒤 다시 실행해 주세요.');
  try {
    var sh = kwSheet_();
    if (sh.getLastRow() >= 1) sh.getRange(1, 1, sh.getLastRow(), 1).clearContent();
    sh.getRange(1, 1, chunks.length, 1).setValues(chunks);
  } finally { lock.releaseLock(); }
  var sum = need.map(function (k) {
    var f = obj.fields[k], n = 0;
    (f.groups || []).forEach(function (g) { n += (g.words || []).length; });
    return k + ':' + (f.type === 'choice' ? '기호' : n);
  }).join(' ');
  return '인정 단어를 넣었어요 (' + text.length + '자, 칸 ' + chunks.length + '개). ' + sum;
}

/**
 * 편집기에서 한 번 실행: 인정 단어 넣기.
 *   1) Apps Script에 파일을 하나 더 만들고(이름 예: 붙여넣기) 한 줄로
 *        var KEYWORDS_PASTE = { ...server/private/keywords.json 내용 그대로... };
 *   2) 위쪽 함수 고르기에서 setupKeywords → 실행 → 실행 로그에 "인정 단어를 넣었어요"가 보이면 끝
 *   3) 붙여넣기 파일은 지운다(단어는 숨김 탭에 남는다)
 * (이름 끝에 _가 붙은 함수는 편집기 실행 목록에 안 보여서, 실제 일은 setupKeywords_가 하고 이 함수는 부르기만 한다)
 */
function setupKeywords() {
  if (typeof KEYWORDS_PASTE === 'undefined') throw new Error('KEYWORDS_PASTE가 없어요. 배포 안내 4단계대로 붙여넣기 파일을 먼저 만들어 주세요.');
  var msg = setupKeywords_(KEYWORDS_PASTE);
  Logger.log(msg);
  return msg;
}

/* ── 교사: 판정 저장 ─────────────────────── */

/** 채점 탭에서 그 학생 행(없으면 새로 만든 행 번호와 빈 줄). 락 안에서 부른다. */
function gradeRow_(sh, rows, ban, num) {
  var row = findRow_(rows, ban, num);
  if (row) return { row: row, line: rows[row - 2].slice() };
  var line = [ban, num]; for (var i = 2; i < G_LAST; i++) line.push('');
  rows.push(line);
  return { row: rows.length + 1, line: line.slice() };
}

function validMark_(item, value) { return ITEMS.indexOf(String(item)) >= 0 && MARKS.indexOf(String(value)) >= 0; }

function grade_(ban, num, item, value) {
  ban = digits_(ban); num = digits_(num);
  item = String(item == null ? '' : item); value = String(value == null ? '' : value);
  if (!ban || !num) return { ok: false, msg: '반·번호가 없어요.' };
  if (!validMark_(item, value)) return { ok: false, msg: '판정 값이 맞지 않아요.' };
  var lock = lock_(10000);
  if (!lock) return { ok: false, msg: '저장이 몰려 있어요. 잠시 뒤 다시 눌러 주세요.' };
  try {
    var sh = gradeSheet_();
    var rows = rows_(sh, G_LAST);
    var g = gradeRow_(sh, rows, ban, num);
    g.line[G_FINAL - 1 + ITEMS.indexOf(item)] = value;
    if (item === '종합') g.line[G_DIRECT - 1] = value ? 'Y' : '';
    g.line[G_AT - 1] = now_();
    sh.getRange(g.row, 1, 1, G_LAST).setValues([g.line]);
    return { ok: true, grade: gradeObj_(g.line) };
  } finally { lock.releaseLock(); }
}

/** list = [{num, auto?:{1,2,3,종합}, check?, final?:{1,2,3,종합}, direct?}] — 일괄 확정·임시 판정 기록. 하나라도 틀리면 아무것도 안 쓴다. */
function gradeBulk_(ban, list) {
  ban = digits_(ban);
  if (!ban) return { ok: false, msg: '반을 골라 주세요.' };
  if (!Array.isArray(list) || list.length > 60) return { ok: false, msg: '판정 목록이 맞지 않아요.' };
  for (var i = 0; i < list.length; i++) {
    var e = list[i] || {};
    if (!digits_(e.num)) return { ok: false, msg: '번호가 없어요.' };
    var parts = ['auto', 'final'];
    for (var p = 0; p < parts.length; p++) {
      var m = e[parts[p]];
      if (m) for (var k in m) if (!validMark_(k, m[k])) return { ok: false, msg: '판정 값이 맞지 않아요.' };
    }
  }
  var lock = lock_(15000);
  if (!lock) return { ok: false, msg: '저장이 몰려 있어요. 잠시 뒤 다시 눌러 주세요.' };
  try {
    var sh = gradeSheet_();
    var rows = rows_(sh, G_LAST);
    var at = now_(), touched = {};
    list.forEach(function (e) {
      var num = digits_(e.num);
      var row = findRow_(rows, ban, num);
      if (!row) { gradeRow_(sh, rows, ban, num); row = rows.length + 1; }
      var line = rows[row - 2];
      if (e.auto) for (var k in e.auto) line[G_AUTO - 1 + ITEMS.indexOf(k)] = String(e.auto[k]);
      if (e.final) for (var f in e.final) {
        line[G_FINAL - 1 + ITEMS.indexOf(f)] = String(e.final[f]);
        // direct를 같이 보내면 그 값(false = 1·2·3번 확정으로 다시 계산한 종합), 빼면 값이 있을 때 종합 직접
        if (f === '종합') line[G_DIRECT - 1] = (e.direct != null ? !!e.direct : true) && e.final[f] ? 'Y' : '';
      }
      if (e.check != null) line[G_CHECK - 1] = e.check ? 'Y' : '';
      line[G_AT - 1] = at;
      touched[row] = true;
    });
    // 바뀐 행이 이어져 있으면 한 번에, 아니면 행마다 쓴다
    Object.keys(touched).map(Number).sort(function (a, b) { return a - b; }).forEach(function (row) {
      sh.getRange(row, 1, 1, G_LAST).setValues([rows[row - 2]]);
    });
    return { ok: true, count: list.length };
  } finally { lock.releaseLock(); }
}

/* ── 교사: 반 마감 ───────────────────────── */

function close_(ban, on) {
  ban = digits_(ban);
  if (!ban) return { ok: false, msg: '반을 골라 주세요.' };
  var lock = lock_(10000);
  if (!lock) return { ok: false, msg: '잠시 뒤 다시 눌러 주세요.' };
  try {
    var sh = setSheet_();
    var rows = rows_(sh, 3);
    var row = findRow_(rows.map(function (r) { return [r[0], '1']; }), ban, '1');
    if (!row) row = rows.length + 2;
    sh.getRange(row, 1, 1, 3).setValues([[ban, on ? 'Y' : '', now_()]]);
    return { ok: true, ban: ban, closed: !!on };
  } finally { lock.releaseLock(); }
}
