// 평가 화면: 시작(반·번호) · 장소 안 평가 패널 · 꼬꼬의 수첩 · 확인 창 · 끝 · 저장
// 2D 판(웹앱/src/app.html)에서 검증한 규칙을 옮기고, 11/13 확정 3문항·9칸(a0~a8)으로 바꿨다.
// 학생 화면에는 채점 결과를 절대 보여 주지 않는다(채점은 교사 화면·game/src/scorer.js 몫).

/* ─────────────────────────────────────────────
   1. 평가 원문 — 기준본(문항/시장경제 평가 문항 (그림·세로).hwpx)과 글자 그대로.
      tools/verify_text.py가 이 구역(다음 2번 구역 표시 전까지)을 대조한다. 게임 사정으로 고치지 않는다.
   ───────────────────────────────────────────── */
const INSTRUCTION = "※ 다음 <자료 1>~<자료 3>을 읽고 물음에 답하시오.";
const RESOURCE_TITLE = "꼬꼬의 첫 출근";
const CHAPTERS = [
  { title: "<자료 1> 꼬꼬의 첫 월급", paras: [
    "꼬꼬는 라면을 만드는 '불꽃식품'에 취업했습니다.",
    "꼬꼬는 공장에서 라면을 만들고 월급을 받았습니다. 월급날에는 가족과 함께 마트에 가서 가격과 품질을 비교하며 필요한 물건을 샀습니다.",
    "한편, 불꽃식품은 근로자를 고용하여 라면을 만들고, 완성된 라면을 마트에 판매했습니다."
  ]},
  { title: "<자료 2> 꼬꼬의 바쁜 공장", paras: [
    "어느 날, 불꽃식품의 라면이 인기를 끌면서 공장이 무척 바빠졌습니다. 공장장은 근로자들에게 다음과 같이 말했습니다.",
    "\"오늘부터 밤 10시까지 일하세요. 추가로 일해도 돈은 더 주지 않습니다.\"",
    "\"주문이 밀렸으니 점심시간에도 쉬지 말고 일하세요.\"",
    "\"일하다 다친 건 본인 잘못입니다. 회사는 책임지지 않겠습니다.\"",
    "꼬꼬는 공장장의 말을 듣고 걱정이 되었습니다."
  ]},
  { title: "<자료 3> 불꽃면 이야기", paras: [
    "불꽃식품은 새로운 라면을 개발하기로 했습니다. 회의 끝에 아주 매운 라면인 '불꽃면'을 만들고, 한 개에 1,200원에 판매하기로 결정했습니다.",
    "불꽃면 광고에는 '채소가 가득한 건강한 라면!'이라고 쓰여 있었지만, 실제로는 채소가 거의 들어 있지 않았습니다.",
    "또 라면을 만드는 과정에서 생긴 더러운 물이 근처 강으로 흘러갔습니다."
  ]}
];
const Q1 = { prompt: "1. <자료 1>을 읽고 가계와 기업의 역할에 대해 물음에 답하시오.",
             sub1: "(1) 가계와 기업이 하는 경제활동을 <보기>에서 모두 골라 기호를 쓰시오.",
             boxTitle: "<보기>",
             options: ["㉠ 공장에서 일하고 월급을 받는다.", "㉡ 근로자를 고용하여 라면을 만든다.",
                       "㉢ 가격과 품질을 비교하며 필요한 물건을 산다.", "㉣ 완성된 라면을 마트에 판매한다."],
             rows: ["가계(꼬꼬네 가족):", "기업(불꽃식품):"],
             sub2: "(2) 가계와 기업의 경제적 관계를 생각하며 빈칸에 알맞은 말을 쓰시오.",
             lines: [ ["① 가계는 기업에 노동력을 제공하고, 그 대가로 (", ")을/를 받습니다."],
                      ["② 기업은 가계에 (", ")을/를 판매하고, 그 대가로 돈을 받습니다."] ] };
const Q2 = { prompt: "2. <자료 2>의 공장장의 말 중 \"오늘부터 밤 10시까지 일하세요. 추가로 일해도 돈은 더 주지 않습니다.\"를 읽고 글을 쓰시오.",
             cond: ["<조건>", "가) 근로자의 어떤 권리가 지켜지지 않았는지 쓸 것.", "나) 법이나 제도를 활용하여 해결 방법을 한 가지 제안할 것."] };
const Q3 = { prompt: "3. <자료 3>을 읽고 불꽃식품의 경제활동에 대해 쓰시오.",
             cond: ["<조건>", "가) 불꽃식품이 기업의 자유에 따라 스스로 결정한 일을 한 가지 찾아 쓸 것.", "나) 불꽃식품이 라면을 만드는 과정에서 사회적 책임을 다하지 못한 점을 쓰고, 이를 개선할 방법을 제안할 것."] };

/* ─────────────────────────────────────────────
   2. 화면·상태
   ───────────────────────────────────────────── */
import { API_URL, SCENES } from './config.js?v=12';
const N_ANS = 9;
// 답 칸: a0·a1 = 1번 (1) 기호(저장값 예 "ㄱㄷ"), a2·a3 = 1번 (2) 빈칸, a4·a5 = 2번 가)·나), a6·a7·a8 = 3번 가)·나) 문제점·나) 개선
const ANSWER_LABELS = ["1번 (1) 가계", "1번 (1) 기업", "1번 (2) ①", "1번 (2) ②", "2번 가)", "2번 나)", "3번 가)", "3번 나) 앞", "3번 나) 뒤"];
const CH_FIELDS = [[0, 1, 2, 3], [4, 5], [6, 7, 8]];         // 장(패널) → 답 칸
// 서술 칸 위 작은 안내(조건 문구는 위 <조건> 상자에 원문 그대로 있고, 이건 칸 이름표일 뿐)
const FIELD_TAG = { 4: "가)", 5: "나)", 6: "가)", 7: "나) 다하지 못한 점", 8: "나) 개선할 방법" };
const SYM = ["ㄱ", "ㄴ", "ㄷ", "ㄹ"], SYM_SHOW = ["㉠", "㉡", "㉢", "㉣"];
// 저장 키 v3: 옛 4문항(6칸) 데이터와 섞이지 않게
import { studentSrv, KEY_SRV, KEY_CLOSED, KEY_LOCAL } from './srv.js?v=1';
const S = { ban: "", num: "", row: 0, answers: blank(), submitted: false, submittedAt: "", progress: 0, flags: {},
  closed: false, editing: false, dirty: false, saving: false, failed: false, lastSavedAt: "", finalizing: false, base: "" };
let H = {}, sfx = {}, mode = "start", roaming = false;   // roaming: 제출 뒤 마을 돌아다니기
function blank() { const a = []; for (let i = 0; i < N_ANS; i++) a.push(""); return a; }
const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove("hide"), hide = (id) => $(id).classList.add("hide");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const digits = (v) => { v = String(v || "").trim(); return /^\d{1,2}$/.test(v) ? String(parseInt(v, 10)) : ""; };
const two = (n) => (n < 10 ? "0" : "") + n, hhmm = (d) => two(d.getHours()) + ":" + two(d.getMinutes());
const stamp = (d) => d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) + " " + hhmm(d);
const isBlank = (v) => !String(v || "").replace(/\s/g, "");
const who = () => "6학년 " + S.ban + "반 " + S.num + "번";
// 지금 답을 고칠 수 있나: 마감 전, 제출 중이 아님, (제출했으면 [답 고치기]를 누른 뒤)
const canEdit = () => !S.closed && !S.finalizing && (!S.submitted || S.editing);
export function setSfx(s) { sfx = s || {}; }
export function setProgress(p) { S.progress = Math.max(S.progress, p); lsSave(); save(false); }
export function fit() {
  const st = $("ex-stage"); if (!st) return;
  st.style.transform = "translate(-50%,-50%) scale(" + Math.min(innerWidth / 960, innerHeight / 540) + ")";
}

/* ─────────────────────────────────────────────
   3. 서버 연결: API_URL(GAS 웹앱)이 있으면 fetch, 없으면 로컬 스텁
      주고받는 약속(server/Code.gs와 같게):
        register {action:"register", ban, num}
          → {ok, row, answers[9], submitted, submittedAt, progress, closed}
        save     {action:"save", ban, num, answers[9], progress}
          → {ok, at, submitted, closed, msg}   마감된 반이면 {ok:false, closed:true, msg}
        submit   {action:"submit", ban, num, answers[9], progress}
          → {ok, at, submitted:true, submittedAt, closed, msg}   마감된 반이면 거부
      제출한 뒤에도 마감 전이면 save·submit을 받는다(다시 제출하면 제출 시각만 새로).
      채점 결과는 학생 쪽 응답에 넣지 않는다.
   ───────────────────────────────────────────── */
const SRV = studentSrv(API_URL);   // 약속·로컬 스텁(window.__stub)은 srv.js

/* ─────────────────────────────────────────────
   4. 저장 (로컬 즉시 + 서버 자동 저장·재시도)
   ───────────────────────────────────────────── */
const lsKey = () => KEY_LOCAL + S.ban + ":" + S.num;
function lsSave() { if (!S.ban) return; try { localStorage.setItem(lsKey(), JSON.stringify({ answers: S.answers, pending: S.dirty, progress: S.progress, flags: S.flags, base: S.base })); } catch (e) {} }
function lsLoad() { try { const v = localStorage.getItem(lsKey()); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
export function saveLocal(gs) { if (gs) { S.flags = Object.assign({}, gs.flags); S.progress = Math.max(S.progress, gs.progress || 0); } lsSave(); }
function setAnswer(i, v) { if (!canEdit() || S.answers[i] === v) return; S.answers[i] = v; S.dirty = true; lsSave(); renderSaveState(); }
const saveQueue = [];
// final: true면 제출(처음 제출·다시 제출 모두)
function save(final, done) {
  if (S.saving) { saveQueue.push([final, done]); return; }
  if (!S.row || S.closed) { done && done(false); return; }
  const snap = S.answers.slice(); S.saving = true; renderSaveState(); let tries = 0;
  const attempt = () => {
    tries++;
    SRV[final ? "submit" : "save"]({ ban: S.ban, num: S.num, answers: snap, progress: S.progress }, (res) => {
      S.saving = false;
      if (res && res.closed) { saveQueue.length = 0; setClosed(); done && done(false); return; }
      if (res && res.ok) {
        S.dirty = JSON.stringify(S.answers) !== JSON.stringify(snap); S.failed = false; S.lastSavedAt = hhmm(new Date()); S.base = JSON.stringify(snap);
        if (final && res.submitted) { S.submitted = true; S.submittedAt = res.submittedAt || res.at || stamp(new Date()); }
        lsSave(); hide("ex-banner");
      } else { S.failed = true; showBanner(res && res.msg); }
      renderSaveState(); done && done(!!(res && res.ok)); drain();
    }, () => {
      if (tries < 3) { setTimeout(attempt, 700 * tries); return; }
      S.saving = false; S.failed = true; renderSaveState(); showBanner(null); done && done(false); drain();
    });
  };
  attempt();
}
function drain() { if (saveQueue.length) { const j = saveQueue.shift(); save(j[0], j[1]); } }
function showBanner(msg) { $("ex-banner-msg").textContent = msg || "답을 서버에 저장하지 못했어요. 답은 이 컴퓨터에 남아 있으니 선생님께 알려 주세요."; show("ex-banner"); }
// 반이 마감됨: 그 뒤로는 읽기 전용
function setClosed() {
  const was = S.closed;
  S.closed = true; S.editing = false; S.saving = false; S.failed = false; S.dirty = false;
  hide("ex-banner"); renderSaveState(); lockInputs(); lsSave();
  if (mode === "notebook") renderNotebook(nbTab);
  if (!was) toast("선생님이 마감했어요. 이제 답을 고칠 수 없어요.");
}
function renderSaveState() {
  const el = $("save-state"); if (!el) return;
  el.className = S.saving ? "saving" : S.failed ? "fail" : "";
  el.textContent = S.closed ? "마감됨" : S.saving ? "저장 중…" : S.failed ? "저장 실패" : S.dirty ? "저장 대기" : (S.lastSavedAt ? "저장됨 " + S.lastSavedAt : "저장됨");
}
// 바뀐 것이 있을 때만 5초마다 저장(칸을 떠날 때도 저장)
setInterval(() => { if (S.row && S.dirty && !S.saving && canEdit()) save(false); }, 5000);
addEventListener("beforeunload", (e) => { if (S.row && !S.closed && (S.dirty || S.saving)) { e.preventDefault(); e.returnValue = ""; } });

/* ─────────────────────────────────────────────
   5. 평가 패널·수첩 HTML
   ───────────────────────────────────────────── */
const chapterHTML = (c) => CHAPTERS[c].paras.map((p) => "<p>" + esc(p) + "</p>").join("");
const symShow = (v) => SYM.filter((k) => v.indexOf(k) >= 0).map((k) => SYM_SHOW[SYM.indexOf(k)]).join(", ");
function symRowHTML(i, lab, prefix) {
  const v = String(S.answers[i] || "");
  let h = '<div class="q-row sym-row"><span class="lab">' + esc(lab) + '</span><span class="syms" role="group" aria-label="' + esc(lab) + '">';
  SYM.forEach((k, j) => {
    const on = v.indexOf(k) >= 0;
    h += '<span id="' + prefix + 'a' + i + 's' + j + '" class="sym' + (on ? " on" : "") + '" role="checkbox" aria-checked="' + on + '" tabindex="' + (j === 0 ? 0 : -1) +
      '" data-i="' + i + '" data-k="' + k + '" data-j="' + j + '">' + SYM_SHOW[j] + '</span>';
  });
  return h + '</span><span class="sym-val" data-v="' + i + '">' + esc(symShow(v)) + '</span></div>';
}
function textField(i, prefix) {
  const tag = FIELD_TAG[i];
  return '<div class="field">' + (tag ? '<div class="field-tag">' + esc(tag) + '</div>' : '') +
    '<textarea id="' + prefix + 'a' + i + '" data-i="' + i + '" maxlength="800" rows="2" autocomplete="off" spellcheck="false" aria-label="' + esc(ANSWER_LABELS[i]) + '"></textarea></div>';
}
function qHTML(c, prefix) {
  let h = "";
  if (c === 0) {
    h += '<div class="q"><div class="q-prompt">' + esc(Q1.prompt) + '</div>';
    h += '<div class="q-sub">' + esc(Q1.sub1) + '</div>';
    h += '<div class="box"><div class="box-title">' + esc(Q1.boxTitle) + '</div>' + Q1.options.map((o) => '<div class="box-line">' + esc(o) + '</div>').join("") + '</div>';
    Q1.rows.forEach((lab, i) => { h += symRowHTML(i, lab, prefix); });
    h += '<div class="q-sub">' + esc(Q1.sub2) + '</div>';
    Q1.lines.forEach((ln, j) => {
      const idx = 2 + j, pre = ln[0].slice(0, -1), post = ln[1].slice(0, 5), rest = ln[1].slice(5);
      h += '<div class="fill-line">' + esc(pre) + '<span class="nw">(<input id="' + prefix + 'a' + idx + '" data-i="' + idx + '" maxlength="20" autocomplete="off" spellcheck="false" aria-label="' + esc(ANSWER_LABELS[idx]) + ' 빈칸">' + esc(post) + '</span>' + esc(rest) + '</div>';
    });
    h += '</div>';
  } else {
    const Q = c === 1 ? Q2 : Q3;
    h += '<div class="q"><div class="q-prompt">' + esc(Q.prompt) + '</div><div class="cond">' + Q.cond.map(esc).join("<br>") + '</div>';
    h += CH_FIELDS[c].map((i) => textField(i, prefix)).join("") + '</div>';
  }
  return h;
}
let toastT = 0;
function toast(msg) { const t = $("ex-toast"); t.textContent = msg; show("ex-toast"); clearTimeout(toastT); toastT = setTimeout(() => hide("ex-toast"), 2600); }
function bindInputs(root) {
  root.querySelectorAll("input[data-i],textarea[data-i]").forEach((el) => {
    const i = +el.getAttribute("data-i"); el.value = S.answers[i] || "";
    const grow = () => { if (el.tagName === "TEXTAREA") { el.style.height = "auto"; el.style.height = Math.max(el.scrollHeight + 4, parseFloat(getComputedStyle(el).minHeight) || 58) + "px"; } };
    setTimeout(grow, 0);
    el.addEventListener("input", () => { if (!canEdit()) { el.value = S.answers[i] || ""; return; } setAnswer(i, el.value); grow(); });
    el.addEventListener("paste", (e) => { e.preventDefault(); toast("붙여넣기는 할 수 없어요. 직접 써 주세요."); });
    el.addEventListener("drop", (e) => e.preventDefault());
    el.addEventListener("blur", () => { if (S.dirty && !S.saving) save(false); });
  });
  // 1번 (1) 기호 버튼: 누르거나 Space·Enter로 켜고 끔, ←→ 같은 줄, ↑↓ 다른 줄, Tab은 줄 단위로 넘어감
  root.querySelectorAll(".sym").forEach((el) => {
    const toggle = () => {
      if (!canEdit()) { if (S.closed) toast("선생님이 마감했어요."); return; }
      const i = +el.dataset.i, k = el.dataset.k, cur = String(S.answers[i] || "");
      const next = SYM.filter((s) => (s === k ? cur.indexOf(s) < 0 : cur.indexOf(s) >= 0)).join("");
      setAnswer(i, next); paintSyms(root, i);
    };
    el.addEventListener("click", () => { el.focus(); toggle(); });
    el.addEventListener("keydown", (e) => {
      const i = +el.dataset.i, j = +el.dataset.j;
      if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (!e.repeat) toggle(); return; }
      let ti = i, tj = j;
      if (e.key === "ArrowRight") tj = (j + 1) % 4; else if (e.key === "ArrowLeft") tj = (j + 3) % 4;
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") ti = i === 0 ? 1 : 0;
      else return;
      e.preventDefault(); e.stopPropagation();
      const t = root.querySelector('.sym[data-i="' + ti + '"][data-j="' + tj + '"]');
      if (t) t.focus();
    });
    el.addEventListener("focus", () => { root.querySelectorAll('.sym[data-i="' + el.dataset.i + '"]').forEach((s) => { s.tabIndex = s === el ? 0 : -1; }); });
  });
  lockInputs();
}
function paintSyms(root, i) {
  const v = String(S.answers[i] || "");
  root.querySelectorAll('.sym[data-i="' + i + '"]').forEach((s) => { const on = v.indexOf(s.dataset.k) >= 0; s.classList.toggle("on", on); s.setAttribute("aria-checked", on); });
  const val = root.querySelector('.sym-val[data-v="' + i + '"]'); if (val) val.textContent = symShow(v);
}
const chapterBlank = (c) => CH_FIELDS[c].filter((i) => isBlank(S.answers[i])).length;

let panelDone = null, curC = 0, waitSpaceUp = false, focusAfter = null;
export function openPanel(c, onClose) {
  curC = c; panelDone = onClose; mode = "panel";
  $("ex-inst").textContent = INSTRUCTION; $("ex-res").textContent = RESOURCE_TITLE;
  $("ex-scene").dataset.c = c;   // 2장은 글이 길어 그림을 낮게(exam.css)
  $("ex-scene").innerHTML = SCENES[c] ? '<img alt="' + esc(CHAPTERS[c].title) + ' 장면" src="' + SCENES[c] + '">' : "";
  $("ex-chapter").textContent = CHAPTERS[c].title; $("ex-text").innerHTML = chapterHTML(c);
  $("ex-panel").dataset.c = c;
  $("ex-qs").innerHTML = qHTML(c, "p-"); bindInputs($("ex-qs"));
  show("ex-root"); show("ex-panel");
  const first = $("ex-qs").querySelector('input,textarea,.sym[tabindex="0"]');
  // 대사를 넘긴 Space를 아직 누르고 있을 때만 뗄 때까지 기다린다(안 그러면 그 Space가 첫 칸에 들어감).
  // 이미 뗐으면 바로 첫 칸에 커서를 둔다.
  const target = first && canEdit() ? first : null;
  if (spaceDown) { focusAfter = target; waitSpaceUp = true; }
  else { focusAfter = null; waitSpaceUp = false; if (target) target.focus(); }
}
function closePanel() {
  const leave = () => {
    hide("ex-panel"); hide("ex-root"); mode = "game"; document.activeElement && document.activeElement.blur();
    if (S.dirty && !S.saving) save(false);
    const cb = panelDone; panelDone = null; cb && cb();
  };
  if (canEdit() && chapterBlank(curC) > 0) ask("비어 있는 칸이 있어요.\n나중에 수첩에서 다시 쓸 수 있어요. 나갈까요?", leave); else leave();
}

let nbTab = 0, nbClose = null;
export function openNotebook(progress, onClose) {
  S.progress = Math.max(S.progress, progress || 0); nbClose = onClose; mode = "notebook";
  show("ex-root"); show("ex-notebook"); renderNotebook(Math.max(0, Math.min(S.progress, 3) - 1));
  if (S.submitted) refreshClosed();
}
// 제출한 뒤 수첩을 열 때·[답 고치기]를 누를 때 마감됐는지 서버에 다시 묻는다(답은 건드리지 않음)
function refreshClosed(after) {
  if (!S.row || S.closed) { after && after(); return; }
  SRV.register(S.ban, S.num, (res) => { if (res && res.closed) setClosed(); after && after(); }, () => { after && after(); });
}
function renderNotebook(tab) {
  nbTab = tab; let tabs = "";
  for (let c = 0; c < 3; c++) { const locked = S.progress < c + 1 && !S.submitted; tabs += '<button data-t="' + c + '" class="' + (c === tab ? "on" : "") + '"' + (locked ? " disabled" : "") + '>' + (c + 1) + '번</button>'; }
  $("nb-tabs").innerHTML = tabs;
  $("nb-tabs").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => renderNotebook(+b.getAttribute("data-t"))));
  const visited = S.progress > tab || S.submitted;
  $("nb-inst").textContent = INSTRUCTION; $("nb-res").textContent = RESOURCE_TITLE; $("nb-chapter").textContent = CHAPTERS[tab].title;
  $("nb-text").innerHTML = visited ? chapterHTML(tab) : "<p>아직 들르지 않은 곳이에요.</p>";
  $("ex-notebook").dataset.c = tab;
  $("nb-qs").innerHTML = visited ? qHTML(tab, "n-") : ""; if (visited) bindInputs($("nb-qs"));
  const blanks = S.answers.filter(isBlank).length;
  $("nb-blank").textContent = canEdit() ? (blanks ? "빈칸 " + blanks + "개" : "빈칸 없음") : "";
  const showSubmit = canEdit() || S.finalizing, showEdit = S.submitted && !S.editing && !S.closed && !S.finalizing;
  $("nb-submit").classList.toggle("hide", !showSubmit);
  $("nb-submit").textContent = S.submitted ? "다시 제출하기" : "제출하기";
  $("nb-submit").disabled = !(S.progress >= 3 || S.submitted) || S.finalizing;
  $("nb-edit").classList.toggle("hide", !showEdit);
  $("nb-note").textContent = S.closed ? "선생님이 마감했어요. 이제 답을 고칠 수 없어요."
    : S.editing ? "고친 답은 저절로 저장돼요. 다 고쳤으면 다시 제출해 주세요."
    : S.submitted ? "제출했어요." + (S.submittedAt ? " (" + S.submittedAt + ")" : "") + " 선생님이 마감하기 전까지 고칠 수 있어요."
    : (S.progress < 3 ? "세 곳을 모두 들러야 제출할 수 있어요." : "");
}
function closeNotebook() {
  if (S.finalizing) return;
  const leave = () => {
    S.editing = false; lockInputs();
    hide("ex-notebook"); document.activeElement && document.activeElement.blur();
    if (S.dirty && !S.saving && !S.closed) save(false);
    if (S.submitted && !roaming) { showEnd(); return; }   // 돌아다니는 중이면 끝 화면 말고 마을로
    hide("ex-root"); mode = "game"; const cb = nbClose; nbClose = null; cb && cb();
  };
  if (S.editing && !S.closed) ask("아직 다시 제출하지 않았어요.\n고친 답은 저장돼요. 수첩을 닫을까요?", leave); else leave();
}
// 제출한 뒤 [답 고치기]: 마감 전이면 다시 쓸 수 있게
function startEdit() {
  if (!S.submitted || S.closed || S.editing) return;
  $("nb-edit").disabled = true;
  refreshClosed(() => {
    $("nb-edit").disabled = false;
    if (S.closed || mode !== "notebook") return;
    S.editing = true; renderNotebook(nbTab);
    const first = $("nb-qs").querySelector('input,textarea,.sym[tabindex="0"]'); first && first.focus();
  });
}
function lockInputs() {
  const ro = !canEdit();
  document.querySelectorAll("#ex-root input[data-i],#ex-root textarea[data-i]").forEach((el) => { el.readOnly = ro; });
  document.querySelectorAll("#ex-root .sym").forEach((el) => { el.setAttribute("aria-disabled", ro ? "true" : "false"); el.classList.toggle("ro", ro); });
}
function submitFinal() {
  if (!canEdit()) return;
  const blanks = S.answers.map((a, k) => (isBlank(a) ? ANSWER_LABELS[k] : null)).filter(Boolean);
  const again = S.submitted;
  ask((blanks.length ? "비어 있는 칸: " + blanks.join(", ") + "\n\n" : "") + (again ? "고친 답으로 다시 제출할까요?" : "제출할까요?\n선생님이 마감하기 전까지는 수첩에서 다시 고칠 수 있어요."), () => {
    $("nb-submit").disabled = true; S.finalizing = true; lockInputs();
    save(true, (ok) => {
      S.finalizing = false;
      if (ok && S.submitted) {
        S.editing = false; lockInputs(); sfx.gate && sfx.gate();
        if (roaming) { renderNotebook(nbTab); toast("다시 제출했어요."); }
        else { hide("ex-notebook"); showEnd(); }
      } else { lockInputs(); if (mode === "notebook") renderNotebook(nbTab); }
    });
  });
}

/* ─────────────────────────────────────────────
   6. 확인 창
   ───────────────────────────────────────────── */
let askYes = null, askPrev = "", askFocus = null;
function ask(msg, yes) { askFocus = document.activeElement; askYes = yes; askPrev = mode; mode = "ask"; $("ex-ask-msg").textContent = msg; show("ex-ask"); setTimeout(() => $("ex-ask-no").focus(), 30); }
function closeAsk(ok) {
  hide("ex-ask"); mode = askPrev; const f = askYes; askYes = null;
  if (ok && f) f(); else if (askFocus && askFocus.focus && document.body.contains(askFocus)) askFocus.focus();
}

/* ─────────────────────────────────────────────
   7. 시작·끝
   ───────────────────────────────────────────── */
function start() {
  if ($("btn-start").disabled || mode !== "start") return;
  const ban = digits($("in-ban").value), num = digits($("in-num").value);
  if (!$("in-ban").value || !$("in-num").value) { $("start-msg").textContent = "반과 번호를 모두 적어 주세요."; return; }
  if (!ban || !num) { $("start-msg").textContent = "반과 번호는 숫자로만 적어 주세요."; return; }
  $("btn-start").disabled = true; $("start-msg").textContent = "출근 준비 중…";
  SRV.register(ban, num, (res) => {
    $("btn-start").disabled = false;
    if (mode !== "start") return;
    if (!res || !res.ok) { $("start-msg").textContent = (res && res.msg) || "다시 눌러 주세요."; return; }
    Object.assign(S, { ban, num, row: res.row || 1, submitted: !!res.submitted, submittedAt: res.submittedAt || "", closed: !!res.closed, editing: false });
    S.answers = (res.answers || blank()).slice(0, N_ANS).map((v) => String(v == null ? "" : v)); while (S.answers.length < N_ANS) S.answers.push("");
    S.progress = res.progress || 0; S.base = JSON.stringify(S.answers);
    const local = lsLoad();
    if (local) {
      const serverBlank = !S.answers.join("").replace(/\s/g, "");
      // 이 컴퓨터에만 남은(서버에 못 보낸) 답: 서버 답이 그때와 같거나 비어 있으면 이어 쓴다. 마감됐으면 서버 답 그대로
      if (local.pending && !S.closed && local.answers && local.answers.length === N_ANS && (local.base === S.base || serverBlank)) { S.answers = local.answers.slice(); S.dirty = true; }
      S.progress = Math.max(S.progress, local.progress || 0); S.flags = local.flags || {};
    }
    if (S.submitted) S.progress = Math.max(S.progress, 3);
    $("start-msg").textContent = ""; hide("ex-start"); hide("ex-root");
    renderSaveState();
    if (S.dirty) save(false);
    // 이미 제출한 학생(새로고침 등): 끝 화면 말고 바로 마을 돌아다니기 — Esc 수첩에서 답 보기·고치기
    if (S.submitted) { startRoam(); toast(S.closed ? "제출한 답이 있어요. 선생님이 마감해서 볼 수만 있어요." : "제출한 답이 있어요. Esc를 눌러 수첩에서 고칠 수 있어요."); return; }
    const fresh = S.progress === 0 && !S.answers.join("").replace(/\s/g, "");
    mode = "game";
    H.onStart({ progress: S.progress, flags: S.flags, fresh, who: who() });
  }, () => { $("btn-start").disabled = false; $("start-msg").textContent = "서버와 연결하지 못했어요. 다시 눌러 주세요."; });
}
function showEnd() {
  mode = "end"; show("ex-root"); hide("ex-panel"); hide("ex-notebook"); show("ex-end");
  $("end-time").textContent = S.submittedAt ? "제출 시각 " + S.submittedAt : "";
  $("end-sub").textContent = S.closed ? "선생님이 마감했어요." : "선생님이 마감하기 전까지는 Esc를 눌러 수첩에서 답을 고칠 수 있어요.";
  roaming = false;
  H.onEnd && H.onEnd();
  setTimeout(() => { if (mode === "end") $("end-roam").focus(); }, 60);
}
// 제출 뒤 자유롭게 돌아다니기: 평가 패널은 다시 안 열린다(main.js가 막음). Esc 수첩 = 내 답 보기·[답 고치기]
function startRoam() {
  roaming = true; mode = "game"; hide("ex-end"); hide("ex-root");
  document.activeElement && document.activeElement.blur();
  H.onRoam && H.onRoam({ progress: Math.max(S.progress, 3), flags: S.flags, who: who() });
}
function roam() { if (mode !== "end" || !S.submitted) return; startRoam(); }
function endToNotebook() { hide("ex-end"); mode = "notebook"; show("ex-notebook"); renderNotebook(0); refreshClosed(); }

/* ─────────────────────────────────────────────
   8. 키보드
   ───────────────────────────────────────────── */
const typing = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.classList.contains("sym")); };
addEventListener("keydown", (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (mode === "ask") {
    if (e.code === "Escape") { e.preventDefault(); closeAsk(false); }
    if (e.key === "Tab") { e.preventDefault(); (document.activeElement === $("ex-ask-no") ? $("ex-ask-yes") : $("ex-ask-no")).focus(); }
    return;
  }
  // 여기서 처리한 키는 main.js(게임 쪽)에 넘기지 않는다 — 수첩을 Esc로 닫자마자 같은 Esc로 다시 열리던 문제
  if (mode === "panel" && waitSpaceUp && e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (mode === "notebook" && e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeNotebook(); return; }
  if (mode === "panel" && e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (mode === "end" && e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); endToNotebook(); return; }
}, true);
addEventListener("keyup", (e) => {
  if (e.code === "Space" && waitSpaceUp) {
    waitSpaceUp = false;
    // 이미 입력 칸에 커서가 있으면(학생이 클릭한 칸) 옮기지 않는다
    if (focusAfter && !typing()) focusAfter.focus();
    focusAfter = null;
  }
});
// Space를 지금 누르고 있는지(패널이 열릴 때 판단용). 다른 처리보다 먼저 듣는다.
let spaceDown = false;
addEventListener("keydown", (e) => { if (e.code === "Space") spaceDown = true; }, true);
addEventListener("keyup", (e) => { if (e.code === "Space") spaceDown = false; }, true);
addEventListener("blur", () => { spaceDown = false; });
// 패널 안을 클릭하거나 칸에 커서가 들어가면 기다리던 포커스 옮기기를 지운다
["mousedown", "focusin"].forEach((ev) => addEventListener(ev, (e) => {
  if (mode === "panel" && e.target && e.target.closest && e.target.closest("#ex-panel")) { waitSpaceUp = false; focusAfter = null; }
}, true));

// 시험용 초기화: 주소에 ?reset=반:번호 또는 ?reset=all — 이 브라우저에 저장된 기록(스텁 서버·로컬 사본)만 지운다
function resetFromURL() {
  const r = new URLSearchParams(location.search).get('reset'); if (!r) return;
  const [ban, num] = r === 'all' ? [null, null] : r.split(':');
  const hit = (b, n) => r === 'all' || (digits(b) === digits(ban) && digits(n) === digits(num));
  try {
    const rows = JSON.parse(localStorage.getItem(KEY_SRV) || '{}');
    let cnt = 0;
    Object.keys(rows).forEach((k) => { const [b, n] = k.split('/'); if (hit(b, n)) { delete rows[k]; cnt++; } });
    localStorage.setItem(KEY_SRV, JSON.stringify(rows));
    if (SRV.live === false && window.__stub) window.__stub.rows = rows;
    Object.keys(localStorage).forEach((k) => { if (k.indexOf(KEY_LOCAL) === 0) { const [b, n] = k.slice(KEY_LOCAL.length).split(':'); if (hit(b, n)) { localStorage.removeItem(k); cnt++; } } });
    if (r === 'all') localStorage.removeItem(KEY_CLOSED);
    console.log('초기화', r, cnt);
    history.replaceState(null, '', location.pathname);
    setTimeout(() => toast(r === 'all' ? '이 컴퓨터의 시험 기록을 모두 지웠어요.' : ban + '반 ' + num + '번 기록을 지웠어요. (' + cnt + '개)'), 300);
  } catch (e) {}
}

export function init(hooks) {
  H = hooks; fit(); resetFromURL();
  $("btn-start").addEventListener("click", start);
  ["in-ban", "in-num"].forEach((id) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") start(); }));
  $("ex-done").addEventListener("click", closePanel);
  $("nb-close").addEventListener("click", closeNotebook);
  $("nb-submit").addEventListener("click", submitFinal);
  $("nb-edit").addEventListener("click", startEdit);
  $("ex-ask-yes").addEventListener("click", () => closeAsk(true));
  $("ex-ask-no").addEventListener("click", () => closeAsk(false));
  $("ex-banner-retry").addEventListener("click", () => save(false));
  $("end-view").addEventListener("click", endToNotebook);
  $("end-roam").addEventListener("click", roam);
  show("ex-root"); show("ex-start"); setTimeout(() => $("in-ban").focus(), 60);
  window.__ex = { S, SRV, N_ANS, get mode() { return mode; }, get roaming() { return roaming; } };
}
