// 채점 엔진 단위 시험 — 실행: node tools/test_scorer.mjs  (저장소 맨 위에서)
// 1) 공개 시험: game/src/keywords.sample.json(가짜 목록) + tools/scorer_cases.sample.json — 늘 돈다.
// 2) 실제 시험: server/private/keywords.json(비공개) + tools/scorer_cases.json(비공개) — 두 파일이 있을 때만.
// 기대값은 사람이 계획서 3-4·3-5 규칙과 인정 단어 표로 정한 것이다(엔진 출력을 베끼지 않는다).
// 통과 기준(계획서 8-1): 기대 ⚪/🟡인데 🟢 = 0건 · 기대 🟢인데 ⚪ = 0건 · 문항·종합 판정 100% 일치.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scoreField, gradeAnswers, MARK, FIELDS } from '../game/src/scorer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const verbose = process.argv.includes('-v');

function runSuite(name, kwPath, casePath) {
  const kw = readJSON(kwPath), cs = readJSON(casePath);
  const defs = kw.fields;
  const r = { fieldCases: 0, same: 0, falseGreen: [], miss: [], soft: [], itemCases: 0, itemBad: [], totalBad: [], checkBad: [] };

  // ── 칸별 시험
  for (const k of Object.keys(cs.fields || {})) {
    for (const c of cs.fields[k]) {
      const [text, exp, note] = c;
      const res = scoreField(text, defs[k]);
      const act = MARK[res.state];
      r.fieldCases++;
      const hits = (res.groups || []).flatMap((g) => g.hits.map((h) => `${g.id}:${h.kind === 'typo' ? '→' + h.word + '?' : h.word}${h.neg ? '(부정)' : ''}`)).join(' ');
      const line = `${k} "${text}" 기대 ${exp} 결과 ${act} ${hits ? '[' + hits + ']' : ''}${note ? ' — ' + note : ''}`;
      if (act === exp) { r.same++; if (verbose) console.log('  ok ' + line); continue; }
      if (act === '🟢') r.falseGreen.push(line);
      else if (exp === '🟢' && act === '⚪') r.miss.push(line);
      else r.soft.push(line);                     // 🟢→🟡, ⚪↔🟡 : 통과 기준 밖(참고)
    }
  }

  // ── 학생 단위(문항·종합 판정)
  const base = cs.base || {};
  for (const s of cs.students || []) {
    const ans = FIELDS.map((k) => (s.set && k in s.set ? s.set[k] : (s.answers ? s.answers[FIELDS.indexOf(k)] : base[k])) || '');
    const g = gradeAnswers(ans, kw);
    r.itemCases++;
    const got = g.items.map((it) => it.grade);
    const tag = `${s.id}${s.note ? ' (' + s.note + ')' : ''}`;
    const detail = FIELDS.map((k) => k + MARK[g.fields[k].state]).join(' ');
    if (got.join() !== s.items.join()) r.itemBad.push(`${tag}: 문항 기대 ${s.items.join(' ')} 결과 ${got.join(' ')} | ${detail}`);
    if (g.total.grade !== s.total) r.totalBad.push(`${tag}: 종합 기대 ${s.total} 결과 ${g.total.grade} | ${detail}`);
    if ('check' in s && g.total.check !== s.check) r.checkBad.push(`${tag}: 확인 기대 ${s.check} 결과 ${g.total.check} | ${detail}`);
  }

  const pass = !r.falseGreen.length && !r.miss.length && !r.itemBad.length && !r.totalBad.length && !r.checkBad.length;
  console.log(`\n■ ${name}`);
  console.log(`  칸 시험 ${r.fieldCases}개: 기대와 같음 ${r.same} · 거짓 🟢 ${r.falseGreen.length} · 놓침(🟢→⚪) ${r.miss.length} · 그 밖 차이(참고) ${r.soft.length}`);
  console.log(`  학생 ${r.itemCases}명: 문항 판정 다름 ${r.itemBad.length} · 종합 다름 ${r.totalBad.length} · 확인 표시 다름 ${r.checkBad.length}`);
  const dump = (title, arr) => { if (arr.length) { console.log(`  [${title}]`); arr.forEach((l) => console.log('   - ' + l)); } };
  dump('거짓 🟢', r.falseGreen); dump('놓침', r.miss); dump('문항 판정', r.itemBad); dump('종합', r.totalBad); dump('확인 표시', r.checkBad);
  dump('그 밖 차이(통과 기준 밖)', r.soft);
  console.log(`  → ${pass ? '통과' : '실패'}`);
  return pass;
}

let ok = runSuite('공개 시험 (가짜 목록)', 'game/src/keywords.sample.json', 'tools/scorer_cases.sample.json');
if (existsSync(join(ROOT, 'server/private/keywords.json')) && existsSync(join(ROOT, 'tools/scorer_cases.json'))) {
  ok = runSuite('실제 시험 (비공개 인정 단어)', 'server/private/keywords.json', 'tools/scorer_cases.json') && ok;
} else {
  console.log('\n■ 실제 시험: server/private/keywords.json 또는 tools/scorer_cases.json이 없어 건너뜀 (비공개 파일)');
}
console.log(ok ? '\n전체 통과' : '\n실패 있음');
process.exit(ok ? 0 : 1);
