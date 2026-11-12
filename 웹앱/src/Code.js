/**
 * 꼬꼬의 첫 출근 — 서버
 *
 * 6학년 사회 [6사11-01] 서·논술형 평가용 웹앱. 「기후 탐사대」 서버를 고쳐 썼다.
 * 스프레드시트에 연결된(컨테이너 바인딩) 스크립트로 쓴다.
 *
 * '응답' 탭 하나. 학생 1명 = 1행
 *   A 반 | B 번호 | C 이름 | D 1-가계 | E 1-기업 | F 2-① | G 2-② | H 3번 | I 4번
 *   J 상태 | K 마지막 저장 | L 제출 시각 | M 최초 접속 | N 진행
 *   채점은 O열부터 자유롭게 쓴다.
 * 반·번호·이름이 모두 같아야 같은 학생으로 본다.
 *
 * 동시 접속 설계 (기후 탐사대와 같음)
 *   - 탭을 만들고 행을 배정하는 register()에서만 스크립트 락을 잡는다.
 *   - saveAnswers()는 배정받은 자기 행에만 쓰므로 락이 필요 없다.
 */

var SHEET = '응답';
var TZ = 'Asia/Seoul';
var N_ANS = 6;
var HEADERS = ['반', '번호', '이름', '1-가계', '1-기업', '2-①', '2-②', '3번', '4번',
               '상태', '마지막 저장', '제출 시각', '최초 접속', '진행'];

var COL_ANSWER1 = 4;                 // D
var COL_COUNT   = N_ANS + 3;         // D~L (답 6 + 상태·저장·제출)
var COL_FIRST   = 13;                // M
var COL_PROG    = 14;                // N
var LAST_COL    = 14;                // N

/* ── 웹앱 진입점 ─────────────────────────── */

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('꼬꼬의 첫 출근')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ── 시트 준비 ───────────────────────────── */

function ensureSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() > 0) { checkHeader_(sh); return sh; }
  if (sh.getMaxColumns() < LAST_COL) sh.insertColumnsAfter(sh.getMaxColumns(), LAST_COL - sh.getMaxColumns());
  sh.getRange(1, 1, 1, LAST_COL).setValues([HEADERS]).setFontWeight('bold').setBackground('#fdf3e1');
  sh.setFrozenRows(1);
  sh.getRange(1, 1, sh.getMaxRows(), 3).setNumberFormat('@');
  var widths = [48, 56, 90, 220, 220, 120, 120, 420, 420, 80, 140, 140, 140, 60];
  for (var i = 0; i < widths.length; i++) sh.setColumnWidth(i + 1, widths[i]);
  sh.getRange(1, COL_ANSWER1, sh.getMaxRows(), N_ANS).setWrap(true).setVerticalAlignment('top').setNumberFormat('@');
  sh.getRange(1, COL_ANSWER1 + N_ANS, sh.getMaxRows(), 4).setNumberFormat('@');   // 상태·저장·제출·최초 접속은 글자로
  return sh;
}

/** 열을 끼우거나 지우면 A1이나 N1 머리글이 밀린다. 그런 탭에는 쓰지 않는다. */
function checkHeader_(sh) {
  var head = sh.getRange(1, 1, 1, LAST_COL).getValues()[0];
  if (head[0] !== HEADERS[0] || head[LAST_COL - 1] !== HEADERS[LAST_COL - 1]) {
    throw new Error(SHEET + ' 탭의 열 구성을 확인해 주세요.');
  }
}

function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function norm_(v) { return String(v == null ? '' : v).replace(/^\s+|\s+$/g, ''); }

/** 반·번호: 숫자 1~2자리만 받고 앞의 0을 뗀다. app.html의 digits()와 같은 규칙. */
function digits_(v) {
  v = norm_(v);
  return /^\d{1,2}$/.test(v) ? String(parseInt(v, 10)) : '';
}

/** 시트가 날짜 값으로 바꿔 놓은 칸도 'yyyy-MM-dd HH:mm:ss' 글자로 돌려준다. */
function txt_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss') : String(v || ''); }

function blankAnswers_() { var a = []; for (var i = 0; i < N_ANS; i++) a.push(''); return a; }

/* ── 등록 / 이어쓰기 ─────────────────────── */

function register(ban, num, name) {
  name = norm_(name);
  if (!norm_(ban) || !norm_(num) || !name) return { ok: false, msg: '반, 번호, 이름을 모두 적어 주세요.' };
  ban = digits_(ban);
  num = digits_(num);
  if (!ban || !num) return { ok: false, msg: '반과 번호는 숫자로만 적어 주세요.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) { return { ok: false, msg: '지금 접속이 몰려 있어요. 잠시 뒤 다시 눌러 주세요.' }; }

  try {
    var sh = ensureSheet_();
    var last = sh.getLastRow();
    if (last >= 2) {
      var rows = sh.getRange(2, 1, last - 1, LAST_COL).getValues();
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (norm_(r[0]) === ban && norm_(r[1]) === num && norm_(r[2]) === name) {
          return {
            ok: true,
            row: i + 2,
            answers: r.slice(3, 3 + N_ANS).map(function (v) { return String(v || ''); }),
            submitted: norm_(r[3 + N_ANS]) === '제출완료',
            submittedAt: txt_(r[5 + N_ANS]),
            progress: Number(r[COL_PROG - 1]) || 0
          };
        }
      }
    }
    var row = Math.max(last, 1) + 1;
    var line = [ban, num, name].concat(blankAnswers_()).concat(['작성중', '', '', now_(), 0]);
    sh.getRange(row, 1, 1, LAST_COL).setValues([line]);
    return { ok: true, row: row, answers: blankAnswers_(), submitted: false, submittedAt: '', progress: 0 };
  } catch (e) {
    return { ok: false, msg: '서버와 연결하지 못했어요. (' + e + ')' };
  } finally {
    lock.releaseLock();
  }
}

/* ── 답안 저장 ───────────────────────────── */

function saveAnswers(row, ban, num, name, answers, isFinal, progress) {
  ban = digits_(ban);
  num = digits_(num);
  name = norm_(name);
  row = Number(row);
  if (!isFinite(row) || row % 1 || row < 2) return { ok: false, msg: '자리 정보가 없어요. 새로고침한 뒤 다시 들어와 주세요.' };
  if (!Array.isArray(answers) || answers.length !== N_ANS) return { ok: false, msg: '새로고침한 뒤 다시 들어와 주세요.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); }
  catch (e) { return { ok: false, msg: '저장이 몰려 있어요. 잠시 뒤 다시 저장해 주세요.' }; }
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
    if (!sh || row > sh.getLastRow()) return { ok: false, msg: '자리 정보가 어긋났어요. 새로고침한 뒤 다시 들어와 주세요.' };
    checkHeader_(sh);

    var cur = sh.getRange(row, 1, 1, LAST_COL).getValues()[0];
    if (!ban || !num || norm_(cur[0]) !== ban || norm_(cur[1]) !== num || norm_(cur[2]) !== name) {
      return { ok: false, msg: '자리 정보가 어긋났어요. 새로고침한 뒤 다시 들어와 주세요.' };
    }
    var wasSubmitted = norm_(cur[3 + N_ANS]) === '제출완료';
    if (wasSubmitted) return { ok: true, at: txt_(cur[5 + N_ANS]), submitted: true };

    var at = now_();
    var status = isFinal ? '제출완료' : '작성중';
    var submittedAt = isFinal ? at : '';
    var vals = answers.map(function (v) { return String(v || ''); }).concat([status, at, submittedAt]);
    sh.getRange(row, COL_ANSWER1, 1, COL_COUNT).setValues([vals]);
    var p = Math.max(Number(cur[COL_PROG - 1]) || 0, Math.min(3, Number(progress) || 0));
    sh.getRange(row, COL_PROG).setValue(p);
    return { ok: true, at: at, submitted: status === '제출완료' };
  } catch (e) {
    return { ok: false, msg: '저장하지 못했어요. (' + e + ')' };
  } finally {
    lock.releaseLock();
  }
}
