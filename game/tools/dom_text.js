// 화면에 실제로 그려진 원문 글자 검사 (verify_text.py의 짝, 브라우저에서 잰다)
// node tools/dom_text.js <playwright 폴더> [출력 json]
//  1) 평가 패널(1~3장)·수첩의 #ex-text/#ex-qs 글자를 한글본 문단과 대조
//  2) 실제로 플레이하며 대사창(#dlg-text)·오프닝(#comic-text)에 다 찍힌 글자를 story.js 원문과 대조, 원문 줄 강조(emph) 여부 기록
//  3) 간판 캔버스 글자(signPlane)가 캔버스 안쪽(테두리 10px 제외)에 다 들어가는지 measureText로 잰다
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.argv[2], 'node_modules', 'playwright'));
const outJson = process.argv[3];
const URL = 'http://127.0.0.1:8765/';
const game = path.resolve(__dirname, '..');
const mainSrc = fs.readFileSync(path.join(game, 'src', 'main.js'), 'utf8');
const vExam = (mainSrc.match(/exam\.js\?v=(\d+)/) || [])[1], vStory = (mainSrc.match(/story\.js\?v=(\d+)/) || [])[1];
// signPlane('글자' 또는 "글자", w, h, { size, logo }) 뽑기
const signs = [];
for (const m of mainSrc.matchAll(/signPlane\(\s*(['"])((?:\\.|(?!\1).)*)\1((?:\s*\+\s*String\.fromCharCode\(10\)\s*\+\s*(['"])(?:(?!\5).)*\5)*)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*\{([^}]*)\})?/g)) {
  let text = m[2].replace(/\\n/g, '\n');
  if (m[3]) text += m[3].replace(/\s*\+\s*String\.fromCharCode\(10\)\s*\+\s*['"]/g, '\n').replace(/['"]$/, '');
  const opt = m[7] || '', size = +((opt.match(/size:\s*(\d+)/) || [])[1] || 64), logo = /logo:\s*true/.test(opt);
  signs.push({ text, w: +m[5], h: +m[6], size, logo, line: mainSrc.slice(0, m.index).split('\n').length });
}
const res = { panels: [], notebook: [], dialogue: [], comic: [], signs: [] };
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => window.__kk && __kk.S.mode === 'start', null, { timeout: 90000 });
  // 3) 간판 캔버스
  res.signs = await p.evaluate(async (signs) => {
    await document.fonts.load('64px "Jua"'); await document.fonts.ready;
    const c = document.createElement('canvas').getContext('2d');
    return signs.map((s) => {
      const W = 512, Hh = Math.round(512 * s.h / s.w), x0 = s.logo ? W / 2 + 40 : W / 2;
      c.font = s.size + 'px "Jua"';
      const lines = s.text.split('\n').map((ln) => { const w = c.measureText(ln).width; return { ln, width: Math.round(w), left: Math.round(x0 - w / 2), right: Math.round(x0 + w / 2) }; });
      const rows = lines.length, tall = Math.round(s.size * 1.1 * (rows - 1) + s.size);
      const clipX = lines.filter((l) => l.left < 10 || l.right > W - 10).map((l) => l.ln);
      return Object.assign({}, s, { canvas: [W, Hh], inner: [10, W - 10], lines, textHeight: tall, clipX, clipY: tall > Hh - 20, fontOK: document.fonts.check(s.size + 'px "Jua"') });
    });
  }, signs);
  // 시작 → 오프닝(원문 줄 기록)
  await p.fill('#in-ban', '0'); await p.fill('#in-num', '0'); await p.fill('#in-name', '글자검사'); await p.click('#btn-start');
  await p.waitForFunction(() => __kk.S.mode === 'comic', null, { timeout: 8000 });
  for (let i = 0; i < 10 && (await p.evaluate(() => __kk.S.mode)) === 'comic'; i++) {
    await p.keyboard.press('Space'); await p.waitForTimeout(120);   // 타자 끝내기
    res.comic.push(await p.evaluate(() => document.getElementById('comic-text').textContent));
    await p.keyboard.press('Space'); await p.waitForTimeout(300);
  }
  await p.waitForFunction(() => __kk.S.mode === 'walk', null, { timeout: 8000 });
  const st = () => p.evaluate(() => ({ mode: __kk.S.mode, ex: window.__ex && __ex.mode, room: __kk.S.room }));
  const tp = (x, z) => p.evaluate(([x, z]) => { __kk.S.x = x; __kk.S.z = z; }, [x, z]);
  const near = async (id, dx = 0, dz = 1.0) => { const t = await p.evaluate((id) => ({ x: __kk.TH[id].x, z: __kk.TH[id].z }), id); await tp(t.x + dx, t.z + dz); await p.waitForTimeout(250); };
  const space = async () => { await p.keyboard.press('Space'); await p.waitForTimeout(180); };
  async function recordTalk(tag) {
    // 대사가 다 찍힐 때까지 기다렸다가(건너뛰지 않음) 글자를 읽고 Space로 넘긴다
    for (let i = 0; i < 60 && (await st()).mode === 'talk'; i++) {
      let r = null;
      for (let k = 0; k < 80; k++) {
        r = await p.evaluate(() => { const d = document.getElementById('dialogue'), t = document.getElementById('dlg-text');
          const on = t.querySelectorAll('.ch.on').length, all = t.querySelectorAll('.ch').length;
          return { hidden: d.classList.contains('hide'), who: document.getElementById('dlg-name').textContent, text: t.textContent, emph: d.classList.contains('emph'), lit: on + '/' + all, done: all > 0 && on === all }; });
        if (!r.hidden && r.done) break;
        if ((await st()).mode !== 'talk') return;
        await p.waitForTimeout(150);
      }
      const { hidden, done, ...keep } = r;
      res.dialogue.push(Object.assign({ tag }, keep));
      await p.waitForTimeout(200); await space(); await p.waitForTimeout(250);
    }
  }
  const waitEx = async (m) => { for (let i = 0; i < 60 && (await st()).ex !== m; i++) await p.waitForTimeout(150); return (await st()).ex === m; };
  async function holdUntil(key, cond, ms = 9000) { await p.keyboard.down(key); const t = Date.now(); while (Date.now() - t < ms) { if (await cond()) break; await p.waitForTimeout(80); } await p.keyboard.up(key); }
  const panelText = () => p.evaluate(() => {
    const qs = document.getElementById('ex-qs').cloneNode(true);
    qs.querySelectorAll('input').forEach((i) => i.replaceWith(document.createTextNode('　'.repeat(6))));
    qs.querySelectorAll('textarea').forEach((i) => i.remove());
    const lines = (el) => [...el.querySelectorAll('.q-prompt,.q-row,.fill-line,.cond,p')].flatMap((e) => e.innerText.split('\n')).map((s) => s.trim()).filter(Boolean);
    document.body.appendChild(qs); qs.style.cssText = 'position:absolute;left:-9999px;width:2000px';
    const out = { inst: document.getElementById('ex-inst').textContent, res: document.getElementById('ex-res').textContent, chapter: document.getElementById('ex-chapter').textContent,
      text: [...document.getElementById('ex-text').querySelectorAll('p')].map((e) => e.textContent), qs: lines(qs) };
    qs.remove(); return out;
  });
  const closePanel = async () => { await p.click('#ex-done'); await p.waitForTimeout(500); if (await p.evaluate(() => !document.getElementById('ex-ask').classList.contains('hide'))) await p.click('#ex-ask-yes'); await p.waitForTimeout(800); };
  // 마을·마트
  await near('mom', -1.0, 0.2); await space(); await recordTalk('mom');
  await near('martDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  await holdUntil('ArrowUp', async () => (await p.evaluate(() => __kk.S.z)) < -82.4, 6000);
  await near('ramen', 0, 0.1); await space(); await p.waitForTimeout(300); await recordTalk('ramen');
  await waitEx('panel'); await p.waitForTimeout(300); res.panels.push(await panelText()); await closePanel(); await recordTalk('after1');
  await near('exit_mart', 0, -0.4); await space(); await p.waitForTimeout(900);
  await tp(19, 2.2); await holdUntil('ArrowRight', async () => (await p.evaluate(() => __kk.S.x)) > 23, 15000);
  await near('factoryDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  await holdUntil('ArrowUp', async () => (await st()).mode !== 'walk', 6000);
  for (let i = 0; i < 60 && (await st()).mode !== 'talk'; i++) await p.waitForTimeout(200);
  await recordTalk('rollcall'); await waitEx('panel'); await p.waitForTimeout(300); res.panels.push(await panelText()); await closePanel(); await recordTalk('after2');
  await near('exit_factory', 0, -0.4); await space(); await p.waitForTimeout(900);
  await near('meetDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  await holdUntil('ArrowUp', async () => (await st()).mode !== 'walk', 6000);
  for (let i = 0; i < 60 && (await st()).mode !== 'talk'; i++) await p.waitForTimeout(200);
  await recordTalk('meeting'); await waitEx('panel'); await p.waitForTimeout(300); res.panels.push(await panelText()); await closePanel(); await recordTalk('after3');
  await p.waitForTimeout(600);
  if ((await st()).ex === 'notebook') {
    for (let t = 0; t < 3; t++) {
      await p.click('#nb-tabs button[data-t="' + t + '"]'); await p.waitForTimeout(200);
      res.notebook.push(await p.evaluate(() => ({ chapter: document.getElementById('nb-chapter').textContent, text: [...document.getElementById('nb-text').querySelectorAll('p')].map((e) => e.textContent) })));
    }
  }
  res.versions = { exam: vExam, story: vStory };
  if (outJson) fs.writeFileSync(outJson, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})().catch((e) => { console.error(e); if (outJson) fs.writeFileSync(outJson, JSON.stringify(res, null, 1)); process.exit(2); });
