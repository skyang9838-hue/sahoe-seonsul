// game/src/keywords.json → server/Keywords.js (사본 시트 설치용 기본 인정 단어). 실행: node tools/build_keywords_js.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const kw = JSON.parse(readFileSync('game/src/keywords.json', 'utf8'));
const head = [
  '// 공개 인정 단어 (game/src/keywords.json과 같음, tools/test_server.mjs가 대조). 시트 숨김 탭이 비었을 때만 쓴다 — 우리 학교용 사본 설치용 (11/28)',
  '// 고치면: game/src/keywords.json을 고친 뒤 이 파일을 다시 만든다 (node tools/build_keywords_js.mjs)',
];
writeFileSync('server/Keywords.js', head.join('\n') + '\nvar KEYWORDS_DEFAULT = ' + JSON.stringify(kw) + ';\n');
console.log('server/Keywords.js 만듦');
