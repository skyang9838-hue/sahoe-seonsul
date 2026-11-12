// 3D 시험판 캡처: node tools/shot3d.js <playwright 폴더> <캡처 폴더> [url]
const path = require('path');
const { chromium } = require(path.join(process.argv[2], 'node_modules', 'playwright'));
const out = process.argv[3], url = process.argv[4] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto(url);
  await p.waitForFunction(() => window.__kk && window.__kk.S.mode === 'walk', null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(out, '3d-1.png') });
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(900); await p.keyboard.up('ArrowRight');
  await p.keyboard.press('Space'); await p.waitForTimeout(260);
  await p.screenshot({ path: path.join(out, '3d-2-jump.png') });
  await p.waitForTimeout(800);
  // 엄마 닭 쪽으로
  for (let i = 0; i < 40; i++) {
    const s = await p.evaluate(() => { const m = __kk.NPCS[0]; return { x: __kk.S.x, z: __kk.S.z, mx: m.x, mz: m.z }; });
    const dx = s.mx - 1.1 - s.x, dz = s.mz + 0.2 - s.z;
    if (Math.abs(dx) < 0.25 && Math.abs(dz) < 0.25) break;
    const k = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dz > 0 ? 'ArrowDown' : 'ArrowUp');
    await p.keyboard.down(k); await p.waitForTimeout(90); await p.keyboard.up(k);
  }
  await p.screenshot({ path: path.join(out, '3d-3-near.png') });
  await p.keyboard.press('Space'); await p.waitForTimeout(1600);
  await p.screenshot({ path: path.join(out, '3d-4-talk.png') });
  console.log('fps', await p.evaluate(() => __kk.fps), 'errors', errs.slice(0, 8));
  await b.close();
})();
