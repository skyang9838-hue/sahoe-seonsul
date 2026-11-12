// 구역별 화면 캡처 (눈으로 그림 확인용)
// 쓰는 법: node tools/snap.js <playwright 폴더> <캡처 폴더> [너비] [높이]
const path = require('path');
const { chromium } = require(path.join(process.argv[2], 'node_modules', 'playwright'));
const out = process.argv[3], W = +(process.argv[4] || 1366), H = +(process.argv[5] || 768);
const url = 'file:///' + path.resolve(__dirname, '..', 'preview.html').split(path.sep).join('/');
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.screenshot({ path: path.join(out, 'art-start.png') });
  await p.fill('#in-ban', '0'); await p.fill('#in-num', '0'); await p.fill('#in-name', 't');
  await p.click('#btn-start'); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, 'art-guide.png') });
  await p.keyboard.press('Space'); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(out, 'art-z0.png') });
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500);
  await p.keyboard.press('Space'); await p.waitForTimeout(220);
  await p.screenshot({ path: path.join(out, 'art-jump.png') });
  await p.keyboard.up('ArrowRight');
  for (const z of [1, 2]) {
    await p.evaluate((z) => {
      const S = __kk.S; S.progress = z; S.flags.talkedMom = true;
      S.x = 900; S.y = 330; S.zone = z - 1;
    }, z);
    await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight');
    await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(out, `art-z${z}.png`) });
  }
  await b.close();
})();
