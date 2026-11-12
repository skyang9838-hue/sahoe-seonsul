// 평가 화면: 시작(반·번호·이름) · 장소 안 평가 패널 · 꼬꼬의 수첩 · 확인 창 · 끝 · 저장
// 2D 판(웹앱/src/app.html)에서 검증한 규칙을 그대로 옮겼다.

/* ─────────────────────────────────────────────
   1. 평가 원문 — 한글본(문항/시장경제 평가 문항.hwpx)과 글자 그대로.
      tools/verify_text.py가 이 구역(다음 2번 구역 표시 전까지)을 대조한다. 게임 사정으로 고치지 않는다.
   ───────────────────────────────────────────── */
const INSTRUCTION = "※ 다음 <자료 1>을 읽고 물음에 답하시오.";
const RESOURCE_TITLE = "<자료 1> 꼬꼬의 첫 출근";
const CHAPTERS = [
  { title: "1장. 꼬꼬의 첫 월급", paras: [
    "꼬꼬는 라면을 만드는 '불꽃식품'에 취업했습니다.",
    "꼬꼬는 공장에서 라면을 만들고 월급을 받았습니다. 월급날에는 가족과 함께 마트에 가서 가격과 품질을 비교하며 필요한 물건을 샀습니다.",
    "한편, 불꽃식품은 근로자를 고용하여 라면을 만들고, 완성된 라면을 마트에 판매했습니다."
  ]},
  { title: "2장. 꼬꼬의 바쁜 공장", paras: [
    "어느 날, 불꽃식품의 라면이 인기를 끌면서 공장이 무척 바빠졌습니다. 공장장은 근로자들에게 다음과 같이 말했습니다.",
    "\"오늘부터 밤 10시까지 일하세요. 추가로 일해도 돈은 더 주지 않습니다.\"",
    "\"주문이 밀렸으니 점심시간에도 쉬지 말고 일하세요.\"",
    "\"일하다 다친 건 본인 잘못입니다. 회사는 책임지지 않겠습니다.\"",
    "꼬꼬는 공장장의 말을 듣고 걱정이 되었습니다."
  ]},
  { title: "3장. 불꽃면 이야기", paras: [
    "불꽃식품은 새로운 라면을 개발하기로 했습니다. 회의 끝에 아주 매운 라면인 '불꽃면'을 만들고, 한 개에 1,200원에 판매하기로 결정했습니다.",
    "불꽃면 광고에는 '채소가 가득한 건강한 라면!'이라고 쓰여 있었지만, 실제로는 채소가 거의 들어 있지 않았습니다.",
    "또 라면을 만드는 과정에서 생긴 더러운 물이 근처 강으로 흘러갔습니다."
  ]}
];
const Q1 = { prompt: "1. <자료 1>의 1장에서 가계와 기업이 하는 경제활동을 각각 하나씩 찾아 쓰시오.",
             rows: ["가계(꼬꼬네 가족):", "기업(불꽃식품):"] };
const Q2 = { prompt: "2. 가계와 기업의 경제적 관계를 생각하며 빈칸에 알맞은 말을 쓰시오.",
             lines: [ ["① 가계는 기업에 노동력을 제공하고, 그 대가로 (", ")을/를 받습니다."],
                      ["② 기업은 가계에 (", ")을/를 판매하고, 그 대가로 돈을 받습니다."] ] };
const Q3 = { prompt: "3. <자료 1>의 2장에서 근로자의 권리가 지켜지지 않은 장면을 하나 골라 글을 쓰시오.",
             cond: ["<조건>", "가) 어떤 장면에서 근로자의 어떤 권리가 지켜지지 않았는지 쓸 것.", "나) 이 문제를 해결하기 위한 방법을 한 가지 제안할 것."] };
const Q4 = { prompt: "4. <자료 1>의 3장을 읽고 불꽃식품의 경제활동에 대해 쓰시오.",
             cond: ["<조건>", "가) 불꽃식품이 기업의 자유에 따라 스스로 결정한 일을 한 가지 찾아 쓸 것.", "나) 불꽃식품이 사회적 책임을 다하지 못한 일을 한 가지 찾고, 이를 개선할 방법을 제안할 것."] };

/* ─────────────────────────────────────────────
   2. 화면·상태
   ───────────────────────────────────────────── */
import { API_URL, SCENES } from './config.js?v=7';
const N_ANS = 6;
const ANSWER_LABELS = ["1번 가계", "1번 기업", "2번 ①", "2번 ②", "3번", "4번"];
const S = { ban: "", num: "", name: "", row: 0, answers: blank(), submitted: false, submittedAt: "", progress: 0, flags: {},
  dirty: false, saving: false, failed: false, lastSavedAt: "", finalizing: false, base: "" };
let H = {}, sfx = {}, mode = "start";
function blank() { const a = []; for (let i = 0; i < N_ANS; i++) a.push(""); return a; }
const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove("hide"), hide = (id) => $(id).classList.add("hide");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const digits = (v) => { v = String(v || "").trim(); return /^\d{1,2}$/.test(v) ? String(parseInt(v, 10)) : ""; };
const two = (n) => (n < 10 ? "0" : "") + n, hhmm = (d) => two(d.getHours()) + ":" + two(d.getMinutes());
const stamp = (d) => d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) + " " + hhmm(d);
export function setSfx(s) { sfx = s || {}; }
export function setProgress(p) { S.progress = Math.max(S.progress, p); lsSave(); save(false); }
export function fit() {
  const st = $("ex-stage"); if (!st) return;
  st.style.transform = "translate(-50%,-50%) scale(" + Math.min(innerWidth / 960, innerHeight / 540) + ")";
}

/* ─────────────────────────────────────────────
   3. 서버 연결: API_URL(GAS 웹앱)이 있으면 fetch, 없으면 로컬 스텁
   ───────────────────────────────────────────── */
const SRV = (function () {
  if (API_URL) {
    const call = (body, ok, fail) => fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) })
      .then((r) => r.json()).then(ok).catch(fail);
    return {
      live: true,
      register: (ban, num, name, ok, fail) => call({ action: "register", ban, num, name }, ok, fail),
      save: (p, ok, fail) => call(Object.assign({ action: "save" }, p), ok, fail),
    };
  }
  const stub = { failNext: 0, okFalse: 0, rows: {}, calls: [], delay: 120 };
  try { stub.rows = JSON.parse(localStorage.getItem("kkokko3d-preview-server") || "{}"); } catch (e) {}
  window.__stub = stub;
  const later = (fn) => setTimeout(fn, stub.delay), keep = () => { try { localStorage.setItem("kkokko3d-preview-server", JSON.stringify(stub.rows)); } catch (e) {} };
  return {
    live: false,
    register(ban, num, name, ok, fail) {
      later(() => {
        if (stub.failNext > 0) { stub.failNext--; fail(new Error("stub")); return; }
        const k = [ban, num, name].join("/");
        if (!stub.rows[k]) stub.rows[k] = { row: Object.keys(stub.rows).length + 2, answers: blank(), submitted: false, submittedAt: "", progress: 0 };
        keep(); const r = stub.rows[k];
        ok({ ok: true, row: r.row, answers: r.answers.slice(), submitted: r.submitted, submittedAt: r.submittedAt, progress: r.progress });
      });
    },
    save(p, ok, fail) {
      stub.calls.push(JSON.parse(JSON.stringify(p)));
      later(() => {
        if (stub.failNext > 0) { stub.failNext--; fail(new Error("stub")); return; }
        if (stub.okFalse > 0) { stub.okFalse--; ok({ ok: false, msg: "저장하지 못했어요. (스텁)" }); return; }
        const r = stub.rows[[p.ban, p.num, p.name].join("/")];
        if (r && !r.submitted) { r.answers = p.answers.slice(); r.progress = Math.max(r.progress, p.progress); if (p.isFinal) { r.submitted = true; r.submittedAt = stamp(new Date()); } }
        keep(); ok({ ok: true, at: stamp(new Date()), submitted: r ? r.submitted : false });
      });
    },
  };
})();

/* ─────────────────────────────────────────────
   4. 저장 (로컬 즉시 + 서버 자동 저장·재시도)
   ───────────────────────────────────────────── */
const lsKey = () => "kkokko3d:" + [S.ban, S.num, S.name].join(":");
function lsSave() { try { localStorage.setItem(lsKey(), JSON.stringify({ answers: S.answers, pending: S.dirty, progress: S.progress, flags: S.flags, base: S.base })); } catch (e) {} }
function lsLoad() { try { const v = localStorage.getItem(lsKey()); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
export function saveLocal(gs) { if (gs) { S.flags = Object.assign({}, gs.flags); S.progress = Math.max(S.progress, gs.progress || 0); } lsSave(); }
function setAnswer(i, v) { if (S.submitted || S.finalizing || S.answers[i] === v) return; S.answers[i] = v; S.dirty = true; lsSave(); renderSaveState(); }
const saveQueue = [];
function save(isFinal, done) {
  if (S.saving) { saveQueue.push([isFinal, done]); return; }
  if (!S.row) { done && done(false); return; }
  const snap = S.answers.slice(); S.saving = true; renderSaveState(); let tries = 0;
  const attempt = () => {
    tries++;
    SRV.save({ row: S.row, ban: S.ban, num: S.num, name: S.name, answers: snap, isFinal: !!isFinal, progress: S.progress }, (res) => {
      S.saving = false;
      if (res && res.ok) {
        S.dirty = JSON.stringify(S.answers) !== JSON.stringify(snap); S.failed = false; S.lastSavedAt = hhmm(new Date()); S.base = JSON.stringify(snap);
        if (res.submitted) { S.submitted = true; S.submittedAt = res.at || stamp(new Date()); }
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
function renderSaveState() {
  const el = $("save-state"); if (!el) return;
  el.className = S.saving ? "saving" : S.failed ? "fail" : "";
  el.textContent = S.saving ? "저장 중…" : S.failed ? "저장 실패" : S.dirty ? "저장 대기" : (S.lastSavedAt ? "저장됨 " + S.lastSavedAt : "저장됨");
}
setInterval(() => { if (S.row && S.dirty && !S.saving && !S.submitted) save(false); }, 60000);
addEventListener("beforeunload", (e) => { if (S.row && !S.submitted && (S.dirty || S.saving)) { e.preventDefault(); e.returnValue = ""; } });

/* ─────────────────────────────────────────────
   5. 평가 패널·수첩 HTML
   ───────────────────────────────────────────── */
const chapterHTML = (c) => CHAPTERS[c].paras.map((p) => "<p>" + esc(p) + "</p>").join("");
function qHTML(c, prefix) {
  let h = ""; const ro = S.submitted ? " readonly" : "";
  if (c === 0) {
    h += '<div class="q"><div class="q-prompt">' + esc(Q1.prompt) + '</div>';
    Q1.rows.forEach((lab, i) => { h += '<div class="q-row"><span class="lab">' + esc(lab) + '</span><input id="' + prefix + 'a' + i + '" data-i="' + i + '" maxlength="120" autocomplete="off" spellcheck="false"' + ro + ' aria-label="' + esc(lab) + '"></div>'; });
    h += '</div><div class="q"><div class="q-prompt">' + esc(Q2.prompt) + '</div>';
    Q2.lines.forEach((ln, j) => {
      const idx = 2 + j, pre = ln[0].slice(0, -1), post = ln[1].slice(0, 5), rest = ln[1].slice(5);
      h += '<div class="fill-line">' + esc(pre) + '<span class="nw">(<input id="' + prefix + 'a' + idx + '" data-i="' + idx + '" maxlength="20" autocomplete="off" spellcheck="false"' + ro + ' aria-label="2번 ' + (j === 0 ? "①" : "②") + ' 빈칸">' + esc(post) + '</span>' + esc(rest) + '</div>';
    });
    h += '</div>';
  } else {
    const Q = c === 1 ? Q3 : Q4, idx = c === 1 ? 4 : 5;
    h += '<div class="q"><div class="q-prompt">' + esc(Q.prompt) + '</div><div class="cond">' + Q.cond.map(esc).join("<br>") + '</div>';
    h += '<textarea id="' + prefix + 'a' + idx + '" data-i="' + idx + '" maxlength="1500" rows="5" autocomplete="off" spellcheck="false"' + ro + ' aria-label="' + (c === 1 ? "3번" : "4번") + ' 답"></textarea></div>';
  }
  return h;
}
let toastT = 0;
function toast(msg) { const t = $("ex-toast"); t.textContent = msg; show("ex-toast"); clearTimeout(toastT); toastT = setTimeout(() => hide("ex-toast"), 2200); }
function bindInputs(root) {
  root.querySelectorAll("input[data-i],textarea[data-i]").forEach((el) => {
    const i = +el.getAttribute("data-i"); el.value = S.answers[i] || "";
    const grow = () => { if (el.tagName === "TEXTAREA") { el.style.height = "auto"; el.style.height = Math.max(el.scrollHeight + 4, 118) + "px"; } };
    setTimeout(grow, 0);
    el.addEventListener("input", () => { setAnswer(i, el.value); grow(); });
    el.addEventListener("paste", (e) => { e.preventDefault(); toast("붙여넣기는 할 수 없어요. 직접 써 주세요."); });
    el.addEventListener("drop", (e) => e.preventDefault());
    el.addEventListener("blur", () => { if (S.dirty && !S.saving) save(false); });
  });
}
const chapterBlank = (c) => (c === 0 ? [0, 1, 2, 3] : c === 1 ? [4] : [5]).filter((i) => !String(S.answers[i] || "").replace(/\s/g, "")).length;

let panelDone = null, curC = 0, waitSpaceUp = false, focusAfter = null;
export function openPanel(c, onClose) {
  curC = c; panelDone = onClose; mode = "panel";
  $("ex-inst").textContent = INSTRUCTION; $("ex-res").textContent = RESOURCE_TITLE;
  $("ex-scene").innerHTML = SCENES[c] ? '<img alt="' + esc(CHAPTERS[c].title) + ' 장면" src="' + SCENES[c] + '">' : "";
  $("ex-chapter").textContent = CHAPTERS[c].title; $("ex-text").innerHTML = chapterHTML(c);
  $("ex-qs").innerHTML = qHTML(c, "p-"); bindInputs($("ex-qs"));
  show("ex-root"); show("ex-panel");
  const first = $("ex-qs").querySelector("input,textarea");
  focusAfter = first && !S.submitted ? first : null; waitSpaceUp = true;
}
function closePanel() {
  const leave = () => {
    hide("ex-panel"); hide("ex-root"); mode = "game"; document.activeElement && document.activeElement.blur();
    if (S.dirty && !S.saving) save(false);
    const cb = panelDone; panelDone = null; cb && cb();
  };
  if (!S.submitted && chapterBlank(curC) > 0) ask("비어 있는 칸이 있어요.\n나중에 수첩에서 다시 쓸 수 있어요. 나갈까요?", leave); else leave();
}

let nbTab = 0, nbClose = null, nbEnd = null;
export function openNotebook(progress, onClose, onEnd) {
  S.progress = Math.max(S.progress, progress || 0); nbClose = onClose; nbEnd = onEnd; mode = "notebook";
  show("ex-root"); show("ex-notebook"); renderNotebook(Math.max(0, Math.min(S.progress, 3) - 1));
}
function renderNotebook(tab) {
  nbTab = tab; let tabs = "";
  for (let c = 0; c < 3; c++) { const locked = S.progress < c + 1 && !S.submitted; tabs += '<button data-t="' + c + '" class="' + (c === tab ? "on" : "") + '"' + (locked ? " disabled" : "") + '>' + (c + 1) + '장</button>'; }
  $("nb-tabs").innerHTML = tabs;
  $("nb-tabs").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => renderNotebook(+b.getAttribute("data-t"))));
  const visited = S.progress > tab || S.submitted;
  $("nb-inst").textContent = INSTRUCTION; $("nb-res").textContent = RESOURCE_TITLE; $("nb-chapter").textContent = CHAPTERS[tab].title;
  $("nb-text").innerHTML = visited ? chapterHTML(tab) : "<p>아직 들르지 않은 곳이에요.</p>";
  $("nb-qs").innerHTML = visited ? qHTML(tab, "n-") : ""; if (visited) bindInputs($("nb-qs"));
  const blanks = S.answers.filter((a) => !String(a || "").replace(/\s/g, "")).length;
  $("nb-blank").textContent = S.submitted ? "" : (blanks ? "빈칸 " + blanks + "개" : "빈칸 없음");
  $("nb-submit").disabled = !(S.progress >= 3 && !S.submitted); $("nb-submit").classList.toggle("hide", S.submitted);
  $("nb-note").textContent = S.submitted ? "제출한 답이에요. 고칠 수 없어요." : (S.progress < 3 ? "세 곳을 모두 들러야 제출할 수 있어요." : "");
}
function closeNotebook() {
  if (S.finalizing) return;
  hide("ex-notebook"); document.activeElement && document.activeElement.blur();
  if (S.dirty && !S.saving) save(false);
  if (S.submitted) { showEnd(); return; }
  hide("ex-root"); mode = "game"; const cb = nbClose; nbClose = null; cb && cb();
}
function lockInputs(on) { document.querySelectorAll("#ex-root input,#ex-root textarea").forEach((el) => { el.readOnly = on || S.submitted; }); }
function submitFinal() {
  const blanks = S.answers.map((a, k) => (!String(a || "").replace(/\s/g, "") ? ANSWER_LABELS[k] : null)).filter(Boolean);
  ask((blanks.length ? "비어 있는 칸: " + blanks.join(", ") + "\n\n" : "") + "제출하면 고칠 수 없어요. 제출할까요?", () => {
    $("nb-submit").disabled = true; S.finalizing = true; lockInputs(true);
    save(true, (ok) => {
      S.finalizing = false;
      if (ok && S.submitted) { hide("ex-notebook"); showEnd(); sfx.gate && sfx.gate(); }
      else { $("nb-submit").disabled = false; lockInputs(false); }
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
  const ban = digits($("in-ban").value), num = digits($("in-num").value), name = $("in-name").value.trim();
  if (!$("in-ban").value || !$("in-num").value || !name) { $("start-msg").textContent = "반, 번호, 이름을 모두 적어 주세요."; return; }
  if (!ban || !num) { $("start-msg").textContent = "반과 번호는 숫자로만 적어 주세요."; return; }
  $("btn-start").disabled = true; $("start-msg").textContent = "출근 준비 중…";
  SRV.register(ban, num, name, (res) => {
    $("btn-start").disabled = false;
    if (mode !== "start") return;
    if (!res || !res.ok) { $("start-msg").textContent = (res && res.msg) || "다시 눌러 주세요."; return; }
    Object.assign(S, { ban, num, name, row: res.row, submitted: !!res.submitted, submittedAt: res.submittedAt || "" });
    S.answers = (res.answers || blank()).slice(0, N_ANS); while (S.answers.length < N_ANS) S.answers.push("");
    S.progress = res.progress || 0; S.base = JSON.stringify(S.answers);
    const local = lsLoad();
    if (local) {
      const serverBlank = !S.answers.join("").replace(/\s/g, "");
      if (local.pending && !S.submitted && local.answers && (local.base === S.base || serverBlank)) { S.answers = local.answers.slice(0, N_ANS); S.dirty = true; }
      S.progress = Math.max(S.progress, local.progress || 0); S.flags = local.flags || {};
    }
    $("start-msg").textContent = ""; hide("ex-start"); hide("ex-root");
    if (S.submitted) { showEnd(); return; }
    if (S.dirty) save(false);
    const fresh = S.progress === 0 && !S.answers.join("").replace(/\s/g, "");
    mode = "game";
    H.onStart({ progress: S.progress, flags: S.flags, fresh, who: "6학년 " + ban + "반 " + num + "번 " + name });
    renderSaveState();
  }, () => { $("btn-start").disabled = false; $("start-msg").textContent = "서버와 연결하지 못했어요. 다시 눌러 주세요."; });
}
function showEnd() {
  mode = "end"; show("ex-root"); hide("ex-panel"); hide("ex-notebook"); show("ex-end");
  $("end-time").textContent = S.submittedAt ? "제출 시각 " + S.submittedAt : "";
  H.onEnd && H.onEnd();
}

/* ─────────────────────────────────────────────
   8. 키보드
   ───────────────────────────────────────────── */
const typing = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"); };
addEventListener("keydown", (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (mode === "ask") {
    if (e.code === "Escape") { e.preventDefault(); closeAsk(false); }
    if (e.key === "Tab") { e.preventDefault(); (document.activeElement === $("ex-ask-no") ? $("ex-ask-yes") : $("ex-ask-no")).focus(); }
    return;
  }
  if (mode === "panel" && waitSpaceUp && e.code === "Space") { e.preventDefault(); return; }
  if (mode === "notebook" && e.code === "Escape") { e.preventDefault(); closeNotebook(); return; }
  if (mode === "panel" && e.code === "Escape") { e.preventDefault(); return; }
});
addEventListener("keyup", (e) => {
  if (e.code === "Space" && waitSpaceUp) { waitSpaceUp = false; if (focusAfter) { focusAfter.focus(); focusAfter = null; } }
});

export function init(hooks) {
  H = hooks; fit();
  $("btn-start").addEventListener("click", start);
  ["in-ban", "in-num", "in-name"].forEach((id) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") start(); }));
  $("ex-done").addEventListener("click", closePanel);
  $("nb-close").addEventListener("click", closeNotebook);
  $("nb-submit").addEventListener("click", submitFinal);
  $("ex-ask-yes").addEventListener("click", () => closeAsk(true));
  $("ex-ask-no").addEventListener("click", () => closeAsk(false));
  $("ex-banner-retry").addEventListener("click", () => save(false));
  $("end-view").addEventListener("click", () => { hide("ex-end"); mode = "notebook"; show("ex-notebook"); renderNotebook(0); });
  show("ex-root"); show("ex-start"); setTimeout(() => $("in-ban").focus(), 60);
  setTimeout(() => { if (waitSpaceUp === true && focusAfter && mode === "panel") { /* Space 없이 연 경우 */ } }, 0);
  window.__ex = { S, SRV, get mode() { return mode; } };
}
