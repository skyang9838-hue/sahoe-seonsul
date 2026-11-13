// 키워드 채점 엔진 — 브라우저(ES module)와 Node에서 같이 쓰는 순수 함수.
// 근거: 웹앱 계획 채점·교사.md 3장(3-1~3-5), 한글본 채점기준표.
// 인정 단어는 이 파일에 넣지 않는다. 목록(keywords)은 늘 인자로 받는다
// (실제 목록은 서버 비공개 server/private/keywords.json, 공개 저장소에는 가짜 목록 keywords.sample.json만).
//
// 칸 상태: 'green'(🟢 정확) · 'yellow'(🟡 비슷함, 교사가 고름) · 'none'(⚪ 없음) · 'empty'(빈 칸)
// 문항 판정: '◎' · '○' · '△' · '미응답'
// 위치(start·end)는 text.normalize('NFC') 기준 글자 위치다.

export const FIELDS = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
export const MARK = { green: '🟢', yellow: '🟡', none: '⚪', empty: '⚪' };
export const NEG_WINDOW = 6;          // 반대 뜻: 일치 위치 앞뒤 6음절
export const GRADES = ['◎', '○', '△', '미응답'];

/* ───────── 1. 정규화 ───────── */
const KEEP = /[\p{L}\p{N}]/u;

// 정규화 정보: norm(공백·문장부호 없앤 소문자) + norm 글자마다 원문 위치(map) + 원문(src)
function normInfo(text) {
  const src = String(text == null ? '' : text).normalize('NFC');
  let norm = '';
  const map = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (!KEEP.test(ch)) continue;
    norm += ch.toLowerCase();
    map.push(i);
  }
  return { src, norm, map };
}

/** NFC → 소문자 → 공백·문장부호·따옴표·괄호 제거 */
export function normalize(text) { return normInfo(text).norm; }

/* ───────── 2. 자모 분해 (겹받침·겹모음 분해 포함) ───────── */
const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
// 한글 호환 자모 겹글자(학생이 자모만 친 경우)
const COMPAT = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
  'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };

const isSyllable = (ch) => { const c = ch.charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3; };

/** 한 글자를 자모 문자열로 */
export function jamoOf(ch) {
  if (isSyllable(ch)) {
    const c = ch.charCodeAt(0) - 0xac00;
    return CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28];
  }
  return COMPAT[ch] || ch;
}

/** 문자열을 자모 문자열로 (한글이 아닌 글자는 그대로) */
export function toJamo(s) { let out = ''; for (const ch of String(s)) out += jamoOf(ch); return out; }

/** 편집거리(삽입·삭제·바꿈 1씩) */
export function editDistance(a, b) {
  const A = Array.from(a), B = Array.from(b);
  let prev = new Array(B.length + 1);
  for (let j = 0; j <= B.length; j++) prev[j] = j;
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[B.length];
}

// 허용치 k를 넘으면 바로 k+1을 돌려주는 편집거리(오타 찾기 속도용)
function boundedDistance(a, b, k) {
  if (Math.abs(a.length - b.length) > k) return k + 1;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > k) return k + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** 자모 편집거리 */
export function jamoDistance(a, b) { return editDistance(toJamo(a), toJamo(b)); }

/** 음절 수에 따른 오타 허용치: 1음절 0(오타 안 봄) · 2~3음절 1 · 4음절 이상 2 */
export function typoLimit(syllables) { return syllables <= 1 ? 0 : syllables <= 3 ? 1 : 2; }

/* ───────── 3. 인정 단어 목록 정리 ───────── */
// 낱말 항목: "별빛조각" 또는 { w:"솔", except:["솔방울",...] } · { w:"날리지 않", negOK:true }  (예시는 가짜 낱말)
function prepWord(entry) {
  const o = typeof entry === 'string' ? { w: entry } : Object.assign({}, entry);
  const n = normalize(o.w);
  const allHangul = n.length > 0 && Array.from(n).every(isSyllable);
  return {
    w: o.w, n,
    len: n.length,
    except: (o.except || []).map(normalize).filter(Boolean),
    negOK: !!o.negOK,
    // 1음절 낱말·숫자 섞인 낱말(1,200원 등)은 정확 일치만
    typo: allHangul && n.length >= 2 && o.noTypo !== true,
    limit: allHangul ? typoLimit(n.length) : 0,
    jamo: toJamo(n)
  };
}

const prepCache = new WeakMap();
function prepField(def) {
  if (prepCache.has(def)) return prepCache.get(def);
  const groups = (def.groups || []).map((g) => {
    const seen = new Set(), words = [];
    for (const e of [...(g.words || []), ...(g.single || [])]) {
      const p = prepWord(e);
      if (!p.n) continue;
      const key = p.n + '|' + p.except.join(',') + '|' + p.negOK;
      if (seen.has(key)) continue;
      seen.add(key); words.push(p);
    }
    return { id: g.id, label: g.label || g.id, words };
  });
  const out = { neg: !!def.neg, typoExcept: (def.typoExcept || []).map(normalize).filter(Boolean), groups };
  prepCache.set(def, out);
  return out;
}

/* ───────── 4. 위치 도구 ───────── */
function occurrences(hay, needle) {
  const out = [];
  if (!needle) return out;
  let i = hay.indexOf(needle);
  while (i >= 0) { out.push([i, i + needle.length]); i = hay.indexOf(needle, i + 1); }
  return out;
}
const inside = (s, e, spans) => spans.some(([a, b]) => s >= a && e <= b);
const overlaps = (s, e, spans) => spans.some(([a, b]) => s < b && e > a);

// 부정 표현이 시작하는 norm 위치들: 않 · 못(잘못 제외) · 없 · 아니 · 낱말 첫머리 '안'(안 돼, 안해, 안 줌 …)
const AN_RE = /(^|[^\p{L}\p{N}])안(?=$|[^\p{L}\p{N}]|[되돼해하했할한줘주준가와받보시써쓰지됨됐된])/gu;
function negPositions(info) {
  const { src, norm, map } = info;
  const pos = new Set();
  for (let i = 0; i < norm.length; i++) {
    const c = norm[i];
    if (c === '않' || c === '없') pos.add(i);
    else if (c === '못' && norm[i - 1] !== '잘') pos.add(i);
    else if (c === '아' && norm[i + 1] === '니') pos.add(i);
  }
  const srcToNorm = new Map(map.map((s, i) => [s, i]));
  for (const m of src.matchAll(AN_RE)) {
    const at = m.index + m[1].length;
    if (srcToNorm.has(at)) pos.add(srcToNorm.get(at));
  }
  return [...pos];
}
// 뒤 부정(모든 글 칸): 인정 단어 바로 뒤 같은 문장 안에 '아니다·틀린·관계없다·모르겠다'처럼
// 그 낱말을 부정하거나 내치는 말이 오면 🟡 (예: "꿈빵이 아니라는 뜻이다", "초록 정리는 … 관계가 없다" — 가짜 낱말).
// 근거: Codex 반박(계획서 8-2)에서 찾은 구멍. 6음절 창 규칙(a5·a8)과 별개로 모든 칸에 적용.
export const DISMISS_WINDOW = 20;   // 낱말 뒤 같은 문장 안 20글자(공백·문장부호 뺀)
const DISMISS = ['아니', '아닌', '아님', '아냐', '틀리', '틀린', '틀렸', '관계없', '관계가없', '관계도없', '상관없', '상관이없', '관련없', '관련이없', '모르', '몰라', '몰랐'];
const SENT_END = /[.!?。\n]/;
function dismissed(info, e) {
  const from = info.map[e - 1] + 1;
  let tail = '';
  for (let i = from; i < info.src.length && tail.length < DISMISS_WINDOW; i++) {
    const ch = info.src[i];
    if (SENT_END.test(ch)) break;
    if (KEEP.test(ch)) tail += ch.toLowerCase();
  }
  return DISMISS.some((w) => tail.includes(w));
}
function nearNeg(s, e, negPos) {
  return negPos.some((p) => (p >= s - NEG_WINDOW && p < s) || (p >= e && p < e + NEG_WINDOW));
}

/* ───────── 5. 칸 채점 (글 칸) ───────── */
function hitOut(info, word, kind, s, e, extra) {
  const a = info.map[s], b = info.map[e - 1] + 1;
  return Object.assign({ word: word.w, kind, start: a, end: b, text: info.src.slice(a, b) }, extra);
}

// 오타 찾기: 답의 음절 경계에서 시작·끝나는 구간 중 자모 길이가 낱말 자모 길이 ±허용치인 것과 편집거리 비교
function typoSearch(info, sylJamo, word) {
  const L = word.jamo.length, k = word.limit;
  let best = null;
  for (let s = 0; s < sylJamo.length; s++) {
    let jam = '';
    for (let e = s; e < sylJamo.length; e++) {
      jam += sylJamo[e];
      if (jam.length > L + k) break;
      if (jam.length < L - k) continue;
      const d = boundedDistance(word.jamo, jam, k);
      if (d >= 1 && d <= k && (!best || d < best.d || (d === best.d && s < best.s))) best = { s, e: e + 1, d };
    }
  }
  return best;
}

function scoreTextField(text, def) {
  const info = normInfo(text);
  if (!info.norm) return { state: 'empty', groups: [] };
  const F = prepField(def);
  const negPos = F.neg ? negPositions(info) : [];
  const sylJamo = Array.from(info.norm).map(jamoOf);
  const typoBlock = F.typoExcept.flatMap((w) => occurrences(info.norm, w));
  const groups = F.groups.map((g) => {
    const hits = [];
    // ① 정확 일치
    for (const word of g.words) {
      const ex = word.except.flatMap((w) => occurrences(info.norm, w));
      for (const [s, e] of occurrences(info.norm, word.n)) {
        if (inside(s, e, ex)) continue;                         // 방법 속 '법' 같은 겹침은 세지 않음
        const neg = (F.neg && !word.negOK && nearNeg(s, e, negPos)) || dismissed(info, e);
        hits.push(hitOut(info, word, 'exact', s, e, { neg }));
      }
    }
    // ② 오타 일치 — 정확 일치가 하나도 없는 묶음만
    if (!hits.length) {
      for (const word of g.words) {
        if (!word.typo) continue;
        const b = typoSearch(info, sylJamo, word);
        if (!b) continue;
        const ex = word.except.flatMap((w) => occurrences(info.norm, w));
        if (overlaps(b.s, b.e, ex) || overlaps(b.s, b.e, typoBlock)) continue;
        hits.push(hitOut(info, word, 'typo', b.s, b.e, { dist: b.d, neg: (F.neg && !word.negOK && nearNeg(b.s, b.e, negPos)) || dismissed(info, b.e) }));
      }
    }
    const state = hits.some((h) => h.kind === 'exact' && !h.neg) ? 'green' : hits.length ? 'yellow' : 'none';
    return { id: g.id, label: g.label, state, hits };
  });
  return { state: bestState(groups.map((g) => g.state)), groups };
}

function bestState(states) {
  return states.includes('green') ? 'green' : states.includes('yellow') ? 'yellow' : 'none';
}

/* ───────── 6. 기호 칸 (1번 (1)) ───────── */
const CIRCLED = { '㉠': 'ㄱ', '㉡': 'ㄴ', '㉢': 'ㄷ', '㉣': 'ㄹ', '㉤': 'ㅁ', '㉥': 'ㅂ' };
/** 기호 말고 다른 글자(낱말·숫자)가 섞였는지. 게임은 버튼으로만 넣지만, 글로 들어온 값은 믿지 않는다
 *  (Codex 반박: "ㄱ과 ㄷ은 정답이 아니다"가 🟢로 나오던 구멍). */
const CHOICE_JOIN = /그리고|이랑|하고|와|과|및|랑/g;   // "ㄱ와 ㄷ"처럼 잇는 말은 허용
export function choiceHasExtra(text) {
  for (const ch of String(text == null ? '' : text).normalize('NFC').replace(CHOICE_JOIN, ' ')) {
    if (CIRCLED[ch] || /[ㄱ-ㅎ]/.test(ch)) continue;
    if (KEEP.test(ch)) return true;
  }
  return false;
}
/** "㉠, ㉢" · "ㄱㄷ" · "ㄷ ㄱ" → ['ㄱ','ㄷ'] (순서 무관, 겹침 제거) */
export function parseChoice(text) {
  const set = new Set();
  for (const ch of String(text == null ? '' : text).normalize('NFC')) {
    const c = CIRCLED[ch] || ch;
    if (/[ㄱ-ㅎ]/.test(c)) set.add(c);
  }
  return [...set].sort();
}
function scoreChoiceField(text, def) {
  const picked = parseChoice(text);
  if (!picked.length) return { state: 'empty', picked, right: [], wrong: [], missing: [] };
  if (choiceHasExtra(text)) return { state: 'none', picked, right: [], wrong: [], missing: [], invalid: true };
  const ans = [...new Set(def.answer || [])].sort();
  const right = picked.filter((c) => ans.includes(c));
  const wrong = picked.filter((c) => !ans.includes(c));
  const missing = ans.filter((c) => !picked.includes(c));
  return { state: !wrong.length && !missing.length ? 'green' : 'none', picked, right, wrong, missing };
}

/** 칸 하나 채점. def = keywords.fields[칸] */
export function scoreField(text, def) {
  if (!def) return { state: normalize(text) ? 'none' : 'empty', groups: [] };
  return def.type === 'choice' ? scoreChoiceField(text, def) : scoreTextField(text, def);
}

/* ───────── 7. 문항 판정 (3-4) ───────── */
const ok = (st) => st === 'green' || st === 'yellow';
const yel = (st) => st === 'yellow';

function item(no, grade, check, basis) { return { no, grade, check: grade === '미응답' ? false : check, basis }; }

function judge1(f) {
  if (['a0', 'a1', 'a2', 'a3'].every((k) => f[k].state === 'empty')) return item(1, '미응답', false, {});
  const p1 = f.a0.state === 'green' && f.a1.state === 'green';
  const p2 = ok(f.a2.state) && ok(f.a3.state);
  const p2y = yel(f.a2.state) || yel(f.a3.state);
  const basis = { '(1)': p1, '(2)': p2 };
  if (p1 && p2) return item(1, '◎', p2y, basis);
  if (p2) return item(1, '○', p2y, basis);
  if (p1) return item(1, '○', false, basis);
  return item(1, '△', false, basis);
}

function judge2(f) {
  if (f.a4.state === 'empty' && f.a5.state === 'empty') return item(2, '미응답', false, {});
  const right = f.a4.state, law = f.a5.state;     // a4 = 권리 묶음들 중 가장 좋은 상태
  const basis = { 권리: right, 법제도: law };
  if (ok(right) && ok(law)) return item(2, '◎', yel(right) || yel(law), basis);
  if (ok(right)) return item(2, '○', yel(right), basis);
  return item(2, '△', false, basis);
}

function judge3(f) {
  if (['a6', 'a7', 'a8'].every((k) => f[k].state === 'empty')) return item(3, '미응답', false, {});
  const fr = f.a6.state, re = f.a7.state, im = f.a8.state;
  const basis = { 자유: fr, 책임: re, 개선: im };
  if (ok(fr) && ok(re) && ok(im)) return item(3, '◎', yel(fr) || yel(re) || yel(im), basis);
  if (ok(fr) && ok(re)) return item(3, '○', yel(fr) || yel(re), basis);
  return item(3, '△', false, basis);
}

/* ───────── 8. 종합 (3-5, 평가계획 단계식) ───────── */
/**
 * items: [{grade, check}, …] 1·2·3번 순서. 교사가 문항 판정을 바꾼 뒤 다시 계산할 때도 쓴다.
 * ◎ = 1·2·3번 모두 ◎ (2·3번 ◎이고 1번 ○이면 ◎ 후보 + 확인) / ○ = 모두 ○ 이상 / △ = 그 밖 / 셋 다 미응답이면 미응답
 */
export function totalFrom(items) {
  const g = items.map((it) => it.grade);
  const anyCheck = items.some((it) => it.check);
  if (g.every((x) => x === '미응답')) return { grade: '미응답', check: false, candidate: false };
  if (g[0] === '◎' && g[1] === '◎' && g[2] === '◎') return { grade: '◎', check: anyCheck, candidate: false };
  if (g[0] === '○' && g[1] === '◎' && g[2] === '◎') return { grade: '◎', check: true, candidate: true };
  if (g.every((x) => x === '◎' || x === '○')) return { grade: '○', check: anyCheck, candidate: false };
  return { grade: '△', check: anyCheck, candidate: false };
}

/* ───────── 9. 학생 한 명 채점 ───────── */
/**
 * answers: 9칸 배열 [a0…a8] 또는 {a0:…, …}
 * keywords: { fields: { a0:{type:'choice',answer:[…]}, a2:{type:'text',groups:[…],neg?,typoExcept?}, … } }
 * 반환: { fields:{a0:{state,…},…}, items:[{no,grade,check,basis}×3], total:{grade,check,candidate} }
 */
export function gradeAnswers(answers, keywords) {
  const defs = (keywords && keywords.fields) || keywords || {};
  const get = (k, i) => (Array.isArray(answers) ? answers[i] : answers && answers[k]) || '';
  const fields = {};
  FIELDS.forEach((k, i) => { fields[k] = scoreField(get(k, i), defs[k]); });
  const items = [judge1(fields), judge2(fields), judge3(fields)];
  return { fields, items, total: totalFrom(items) };
}
