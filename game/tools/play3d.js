// 3D 판 자동 플레이 검사: node tools/play3d.js <playwright 폴더> <캡처 폴더> [너비] [높이] [nofont]
//   nofont: 글꼴 파일을 막고(대체 글꼴로) 패널·수첩이 넘치지 않는지까지 본다
const path = require('path');
const { chromium } = require(path.join(process.argv[2], 'node_modules', 'playwright'));
const out = process.argv[3], W = +(process.argv[4] || 1366), H = +(process.argv[5] || 768), NOFONT = process.argv[6] === 'nofont';
const URL = (process.env.KK_URL || 'http://127.0.0.1:8765/') + '?stub';   // 실서버(GAS) 말고 스텁으로
const fails = []; const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails.push(m); };
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  if (NOFONT) await p.route(/\.woff2(\?|$)|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('response', (r) => { if (r.status() >= 400) console.log('  404', r.url()); });
  let n = 0; const snap = (name) => p.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + name + '.png') });
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'domcontentloaded' });
  // 로딩 화면: 시작 포스터를 흐리게 깔았는지
  if (await p.evaluate(() => !document.getElementById('loading').classList.contains('done'))) { await p.waitForTimeout(300); await snap('loading'); }
  check(await p.evaluate(() => /title\/poster\.jpg/.test(getComputedStyle(document.getElementById('loading'), '::before').backgroundImage)), '로딩 화면에 포스터를 흐리게 깔았음');
  await p.waitForFunction(() => window.__kk && __kk.S.mode === 'start', null, { timeout: 90000 });
  const st = () => p.evaluate(() => ({ mode: __kk.S.mode, x: __kk.S.x, z: __kk.S.z, prog: __kk.S.progress, flags: __kk.S.flags, quest: __kk.questCur(), ex: window.__ex && __ex.mode, ans: window.__ex && __ex.S.answers, sub: window.__ex && __ex.S.submitted }));
  const waitMode = async (m, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await st()).mode === m) return true; await p.waitForTimeout(100); } return false; };
  // 11/25부터 말 걸기·살펴보기·문·대사 넘기기 = E (Space는 점프만). 이름은 옛 그대로 space
  const space = async (k = 1) => { for (let i = 0; i < k; i++) { await p.keyboard.press('KeyE'); await p.waitForTimeout(160); } };
  const finishTalk = async () => { for (let i = 0; i < 30 && (await st()).mode === 'talk'; i++) await space(); };
  const tp = (x, z) => p.evaluate(([x, z]) => { __kk.S.x = x; __kk.S.z = z; }, [x, z]);
  const near = async (id, dx = 0, dz = 1.0) => { const t = await p.evaluate((id) => { const t = __kk.TH[id]; return { x: t.x, z: t.z }; }, id); await tp(t.x + dx, t.z + dz); await p.waitForTimeout(250); };
  // 소품 올라서기: Space(필요하면 2단) + 방향키를 holdMs 동안 → 땅이나 소품에 내려앉을 때까지 기다린다
  const jz = () => p.evaluate(() => ({ z: +__kk.J.z.toFixed(2), on: __kk.J.on, x: +__kk.S.x.toFixed(2), sz: +__kk.S.z.toFixed(2), mode: __kk.S.mode, camY: +__kk.camera.position.y.toFixed(2) }));
  //   hold: 누르는 시간(ms), 또는 손을 뗄 조건식 문자열(S·J 기준). 조건식은 페이지 안에서 매 프레임 보고 바로 keyup을 보낸다
  //   (소프트웨어 렌더링은 프레임이 느려 바깥에서 재면 늦게 뗀다)
  async function jumpMove(key, hold, dbl = false) {
    if (typeof hold === 'string') await p.evaluate(([key, expr]) => { const f = new Function('S', 'J', 'return ' + expr); const t0 = performance.now();
      const tick = () => { if (f(__kk.S, __kk.J) || performance.now() - t0 > 5000) dispatchEvent(new KeyboardEvent('keyup', { code: key })); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, [key, hold]);
    await p.keyboard.press('Space'); if (key) await p.keyboard.down(key);
    if (dbl) { await p.waitForTimeout(260); await p.keyboard.press('Space'); }
    if (typeof hold === 'string') { const t = Date.now(); while (Date.now() - t < 5000) { const q = await jz(); if (!q.on && Date.now() - t > 300) break; await p.waitForTimeout(60); } }
    else await p.waitForTimeout(Math.max(0, hold - (dbl ? 260 : 0)));
    if (key) await p.keyboard.up(key);
    for (let i = 0; i < 60; i++) { const j = await jz(); if (!j.on) break; await p.waitForTimeout(60); }
    await p.waitForTimeout(150); return jz();
  }
  // 공중 높이 재기: Space를 n번(gap ms 간격, 또는 until 조건이 맞을 때까지) 누르고 착지까지 페이지 안에서 매 프레임 최고 높이를 잰다
  async function airRun(n, gap, until) {
    await p.evaluate(() => { const a = window.__air = { max: 0, started: false, done: false, camMax: -1e9, scr: [] };
      const tick = () => { const J = __kk.J; if (J.on) a.started = true;
        if (J.z > a.max) { a.max = J.z; const c = __kk.camera, V = c.position.constructor, v = new V(__kk.S.x, J.z + 0.6, __kk.S.z).project(c); a.scr = [Math.round((v.x * 0.5 + 0.5) * innerWidth), Math.round((-v.y * 0.5 + 0.5) * innerHeight)]; a.camAtMax = c.position.y; }
        a.camMax = Math.max(a.camMax, __kk.camera.position.y);
        if (a.started && !J.on) { a.done = true; a.land = J.z; return; } requestAnimationFrame(tick); };
      requestAnimationFrame(tick); });
    // gap = 'apex': 첫 Space만 진짜 키로 누르고, 나머지는 페이지 안에서 정점 가까이 온 그 프레임에 바로 Space를 보낸다.
    //   (예전엔 정점을 기다린 뒤 Playwright로 눌렀는데, 느린 렌더링(1024·1280)에서는 그 사이 꼬꼬가 한참 내려와 2단 점프가 낮게 나가거나 착지 뒤에 눌렸다)
    //   두 번째 = 첫 점프 정점(vz<1.5), 세 번째 = 2단 점프 정점, 네 번째 = 그 뒤 내려오는 중(vz<-1.5). 3·4번째에 더 안 올라가야 한다.
    if (gap === 'apex') {
      await p.keyboard.press('Space');
      await p.evaluate((n) => { const st = window.__apexPress = { sent: 1, want: n };
        const send = () => { dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true })); st.sent++; };
        const tick = () => { const J = __kk.J; if (st.sent >= st.want || __air.done) return;
          const ready = st.sent === 1 ? !J.dbl && J.vz < 1.5 : st.sent === 2 ? J.dbl && J.vz < 1.5 : J.vz < -1.5;
          if (J.on && J.pre <= 0 && ready) send();
          requestAnimationFrame(tick); };
        requestAnimationFrame(tick); }, n);
      const t0 = Date.now(); while (Date.now() - t0 < 8000 && await p.evaluate(() => __apexPress.sent < __apexPress.want && !__air.done)) await p.waitForTimeout(60);
    } else for (let i = 0; i < n; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(gap); if (until && await p.evaluate(until)) break; }
    return p.evaluate(() => ({ max: +__air.max.toFixed(2), fly: __kk.J.fly, z: +__kk.J.z.toFixed(2), scr: __air.scr, camAtMax: +(__air.camAtMax || 0).toFixed(2), camMax: +__air.camMax.toFixed(2) }));
  }
  const airLand = async (ms = 40000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(() => __air.done)) break; await p.waitForTimeout(150); } return p.evaluate(() => ({ done: __air.done, land: __air.land, max: +__air.max.toFixed(2), mode: __kk.S.mode })); };
  async function holdUntil(key, cond, ms = 9000) { await p.keyboard.down(key); const t = Date.now(); while (Date.now() - t < ms) { if (await cond()) break; await p.waitForTimeout(80); } await p.keyboard.up(key); }

  let s0, s1;
  // 패널 스크롤 없는지 + 대사창 잘림 없는지
  // 넘침(scroll)과 왼쪽 자료 칸의 남는 높이(무대 px)를 같이 본다
  const fitCheck = async (tag, sel = '#ex-left,#ex-right') => {
    const r = await p.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => e.scrollHeight - e.clientHeight), sel);
    const slack = await p.evaluate((sel) => { const e = document.querySelector(sel.split(',')[0]), k = e.getBoundingClientRect().height / e.offsetHeight; const last = e.lastElementChild; const cs = getComputedStyle(e); return Math.round(e.clientHeight - parseFloat(cs.paddingBottom) - (last.offsetTop + last.offsetHeight - e.offsetTop)); }, sel);
    check(r.every((v) => v <= 2), tag + ' 패널 스크롤 없음 (' + r.join(',') + ', 왼쪽 여유 ' + slack + 'px)' + (NOFONT ? ' [대체 글꼴]' : ''));
  };
  // 패널 장면 그림: 받아졌고, 칸 비율과 그림 비율이 맞아 cover로 잘리는 부분이 거의 없는지(인물 잘림 방지)
  const sceneImg = async (tag) => {
    const r = await p.evaluate(async () => { const im = document.querySelector('#ex-scene img'); if (!im) return null; if (!im.complete) await new Promise((ok) => { im.onload = im.onerror = ok; });
      const cs = getComputedStyle(im), bw = im.clientWidth, bh = im.clientHeight; return { nw: im.naturalWidth, nh: im.naturalHeight, bw, bh, src: im.getAttribute('src') }; });
    if (!r) { check(false, tag + ' 장면 그림 없음'); return; }
    const crop = 1 - Math.min(r.nw / r.nh, r.bw / r.bh) / Math.max(r.nw / r.nh, r.bw / r.bh);
    const msg = tag + ' 장면 그림 비율 맞음 (그림 ' + r.nw + '×' + r.nh + ', 칸 ' + r.bw + '×' + r.bh + ', 잘림 ' + Math.round(crop * 100) + '%)';
    // 그림 규칙(11/13): 패널 그림은 2D(아스트라) 원본을 쓴다. 칸 비율에 맞춘 2D 그림을 새로 그리기 전까지는 잘림을 주의로만 알린다
    if (/[?&]v=2d/.test(r.src) && r.nw > 0 && crop >= 0.04) { console.log('  ! 주의(2D 그림, 다시 그릴 때 칸 비율로): ' + msg); return; }
    check(r.nw > 0 && crop < 0.04, msg);
  };
  // 위 가림막(HUD·퀘스트 띠) 아래 끝
  const safeTop = () => p.evaluate(() => Math.max(...['hud', 'quest-bar', 'eval-band'].map((id) => { const e = document.getElementById(id); return e.offsetParent && e.style.display !== 'none' ? e.getBoundingClientRect().bottom : 0; })));
  const labelsBelowTop = async (tag) => {
    const r = await p.evaluate(() => [...document.querySelectorAll('#labels > *')].filter((e) => e.style.display !== 'none' && e.offsetParent).map((e) => { const b = e.getBoundingClientRect(); return [e.className + ':' + e.textContent.slice(0, 8), Math.round(b.top), Math.round(b.left), Math.round(b.right), Math.round(b.bottom)]; }));
    const top = await safeTop(), bad = r.filter((x) => x[1] < top - 1);
    check(bad.length === 0, tag + ' 이름표·말풍선이 HUD·퀘스트 띠 아래 (기준 ' + Math.round(top) + ', ' + (bad.map((b) => b[0] + '@' + b[1]).join(' ') || r.length + '개') + ')');
    const zb = await p.evaluate(() => { const z = document.getElementById('zone-banner'); if (+getComputedStyle(z).opacity < 0.05) return null; const b = z.getBoundingClientRect(); return [b.left, b.right, b.top, b.bottom]; });
    if (zb) { const hit = r.filter((x) => x[2] < zb[1] && zb[0] < x[3] && x[1] < zb[3] && zb[2] < x[4]); check(hit.length === 0, tag + ' 구역 배너 밑에 깔린 이름표 없음 (' + hit.map((h) => h[0]).join(' ') + ')'); }
    const pr = r.find((x) => x[0].startsWith('prompt'));
    if (pr) { const hit = r.filter((x) => x !== pr && x[2] < pr[3] && pr[2] < x[3] && x[1] < pr[4] && pr[1] < x[4]); check(hit.length === 0, tag + ' 말풍선이 다른 이름표와 안 겹침 (' + hit.map((h) => h[0]).join(' ') + ')'); }
  };
  const faceClear = async (tag) => {
    const r = await p.evaluate(() => { const b = document.getElementById('dlg-big'); if (b.classList.contains('hide')) return null; const f = b.getBoundingClientRect(), n = document.getElementById('dlg-name').getBoundingClientRect(), c = document.querySelector('#dlg-text .ch').getBoundingClientRect(); return { f: [f.left, f.right], n: [n.left, n.right], c: [c.left, c.right], right: b.classList.contains('right') }; });
    if (!r) { check(false, tag + ' 초상화 없음'); return; }
    const ok = r.right ? r.f[0] >= Math.max(r.n[1], r.c[1]) - 1 : r.f[1] <= Math.min(r.n[0], r.c[0]) + 1;
    check(ok, tag + ' 초상화가 이름표·대사를 안 덮음 (초상 ' + r.f.map(Math.round) + ' / 이름 ' + r.n.map(Math.round) + ' / 첫 글자 ' + r.c.map(Math.round) + ')');
  };
  const dlgFit = async (tag) => { const r = await p.evaluate(() => { const d = document.getElementById('dialogue').getBoundingClientRect(); return [d.top, d.bottom, innerHeight]; }); check(r[0] > 0 && r[1] <= r[2], tag + ' 대사창 화면 안 (' + r.map(Math.round).join(',') + ')'); };
  // 바깥 구도: 꼬꼬는 화면 아래 1/3쯤, 문 앞 간판은 HUD·퀘스트 띠에 안 가림 (카메라가 자리 잡을 때까지 기다린 뒤 px로 잰다)
  const outdoorFrame = async (tag, door) => {
    await p.waitForTimeout(1400);
    const r = await p.evaluate((door) => {
      const c = __kk.camera, V = c.position.constructor, d = __kk.TH[door], scene = __kk.hero.root.parent;
      const hero = (-new V(__kk.S.x, 0.7, __kk.S.z).project(c).y * 0.5 + 0.5);
      let sign = null;
      scene.traverse((m) => {
        if (!m.isMesh || m.geometry.type !== 'PlaneGeometry' || !m.material.map || !m.material.map.isCanvasTexture) return;
        const wp = new V(); m.getWorldPosition(wp); if (Math.abs(wp.x - d.x) > 4 || Math.abs(wp.z - d.z) > 1.5 || wp.y < 2.5) return;
        m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; const xs = [], ys = [];
        for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) { const v = new V(X, Y, 0).applyMatrix4(m.matrixWorld).project(c); xs.push((v.x * 0.5 + 0.5) * innerWidth); ys.push((-v.y * 0.5 + 0.5) * innerHeight); }
        sign = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map(Math.round);
      });
      const q = document.getElementById('quest-bar'), qb = q.style.display === 'none' ? null : q.getBoundingClientRect();
      return { hero: +hero.toFixed(2), sign, qb: qb && [qb.left, qb.right, qb.top, qb.bottom].map(Math.round), hud: Math.round(document.getElementById('hud').getBoundingClientRect().bottom) };
    }, door);
    check(r.hero >= 0.6 && r.hero <= 0.76, tag + ' 꼬꼬가 화면 아래쪽 1/3쯤 (높이 비율 ' + r.hero + ')');
    if (r.sign) {
      const s = r.sign, hitQ = r.qb && s[0] < r.qb[1] && r.qb[0] < s[1] && s[2] < r.qb[3] && r.qb[2] < s[3];
      check(s[2] > r.hud + 4 && !hitQ && s[3] < H, tag + ' 간판이 HUD·퀘스트 띠에 안 가림 (간판 ' + s.join(',') + ' / HUD 아래 ' + r.hud + ' / 띠 ' + (r.qb || []).join(',') + ')');
    }
  };
  const fill = async (id, v) => { await p.fill(id, v); await p.dispatchEvent(id, 'input'); };
  // 스텁 서버(localStorage)의 0반 0번 기록
  const srvRow = () => p.evaluate(() => { const r = JSON.parse(localStorage.getItem('kkokko3d-v3-server') || '{}'); return r['0/0'] || null; });
  const act = () => p.evaluate(() => document.activeElement && document.activeElement.id);
  // "이것은 평가입니다" 띠: 보이는지(숨김·덮임 아님), 한 줄인지, 위쪽 다른 요소와 겹치는지
  const band = () => p.evaluate(() => {
    const b = document.getElementById('eval-band'), cs = getComputedStyle(b);
    if (b.classList.contains('hide') || cs.display === 'none') return { vis: false };
    b.style.pointerEvents = 'auto';   // pointer-events:none이면 elementFromPoint가 건너뛴다 — 잴 때만 잠깐 켠다
    const r = b.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    b.style.pointerEvents = '';
    const over = b.classList.contains('over-exam');
    const lh = parseFloat(cs.lineHeight) || 20, rect = (e) => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; };
    // 평가 화면이 열려 있으면 그 화면 요소만(HUD는 평가 화면 밑에 깔려 안 보임), 걸을 때는 HUD·퀘스트 띠·구역 배너
    const hits = (over ? ['ex-inst', 'nb-tabs', 'nb-close', 'nb-blank', 'ex-toast'] : ['hud-prog', 'hud-right', 'hud-who', 'quest-bar', 'zone-banner']).map((id) => document.getElementById(id))
      .concat(over ? [...document.querySelectorAll('#ex-qs .q-prompt, #nb-qs .q-prompt, #ex-res, #nb-res')] : [])
      .filter((e) => e && e.offsetParent && getComputedStyle(e).display !== 'none' && e.style.display !== 'none' && !(e.id === 'zone-banner' && +getComputedStyle(e).opacity < 0.05) && e.getClientRects().length)
      .filter((e) => { const q = rect(e); return q[0] < r.right && r.left < q[2] && q[1] < r.bottom && r.top < q[3]; }).map((e) => e.id || e.className);
    return { vis: !!top && (top === b || b.contains(top)), oneLine: r.height < lh * 1.6 + 8, h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), cx: Math.round(r.left + r.width / 2), hits, over, txt: b.textContent };
  });
  const bandCheck = async (tag, want) => {
    const r = await band();
    if (!want) { check(!r.vis, tag + ' 평가 띠 숨김'); return r; }
    check(r.vis && r.oneLine && r.hits.length === 0 && Math.abs(r.cx - W / 2) < 4, tag + ' 평가 띠 보임·한 줄·가운데·안 겹침 (' + JSON.stringify(r) + ')');
    return r;
  };
  const login = async () => { await p.fill('#in-ban', '0'); await p.fill('#in-num', '0'); await p.click('#btn-start'); };
  await p.waitForTimeout(1600); await snap('start-poster');
  // 시작 화면 = 움직이는 포스터: 창 전체를 덮고(cover), 반·번호 카드는 아래쪽
  s0 = await p.evaluate(() => { const r = document.getElementById('ex-root'), im = document.querySelector('#poster .pst-img'), b = im.getBoundingClientRect(), c = document.querySelector('.start-card').getBoundingClientRect(), t = document.querySelector('.poster-title').getBoundingClientRect();
    return { on: r.classList.contains('on-poster'), vis: getComputedStyle(document.getElementById('poster')).display !== 'none', loaded: im.complete && im.naturalWidth > 0, fit: getComputedStyle(im).objectFit, cover: b.left <= 1 && b.top <= 1 && b.right >= innerWidth - 1 && b.bottom >= innerHeight - 1, card: [Math.round(c.top), Math.round(c.bottom)], title: [Math.round(t.top), Math.round(t.bottom)], H: innerHeight, anim: getComputedStyle(im).animationName }; });
  check(s0.on && s0.vis && s0.loaded && s0.fit === 'cover' && s0.cover, '시작 화면: 포스터가 창 전체를 덮음 (' + s0.fit + ', 그림 받음 ' + s0.loaded + ')');
  check(s0.anim === 'kenburns', '포스터 느린 확대 애니메이션 (' + s0.anim + ')');
  check(s0.card[0] > s0.H * 0.6 && s0.card[1] <= s0.H && s0.title[1] < s0.card[0], '반·번호 카드는 화면 아래쪽, 제목과 안 겹침 (카드 ' + s0.card.join('~') + ' / 제목 ' + s0.title.join('~') + ' / 높이 ' + s0.H + ')');
  check(await p.evaluate(() => !document.getElementById('in-name') && !!document.getElementById('in-ban') && !!document.getElementById('in-num')), '시작 화면: 반·번호만(이름 칸 없음)');
  await bandCheck('시작 화면', false);
  await p.click('#btn-start'); await p.waitForTimeout(200);
  check(await p.evaluate(() => document.getElementById('start-msg').textContent.includes('반과 번호')), '빈칸으로 출근하기 → 반·번호 안내');
  await login();
  // 판깔기: 처음 시작하는 학생에게만. 검은 화면에 네 줄이 하나씩 → "혼자 생각해서 쓰겠습니다"를 쳐야 오프닝
  check(await waitMode('pledge', 5000), '출근하기 → 판깔기 화면');
  check(await p.evaluate(() => !document.getElementById('ex-root').classList.contains('on-poster') && document.getElementById('ex-root').classList.contains('hide')), '판깔기로 넘어가면 포스터·시작 화면 닫힘');
  await p.waitForTimeout(1500);
  s0 = await p.evaluate(() => [...document.querySelectorAll('#pledge .pl-lines p')].filter((l) => l.classList.contains('on')).length);
  check(s0 >= 1 && s0 < 4, '판깔기 줄은 한 줄씩 나타남 (1.5초 뒤 ' + s0 + '/4줄)');
  for (let i = 0; i < 80 && !(await p.evaluate(() => !!document.getElementById('pledge').dataset.ready)); i++) await p.waitForTimeout(100);
  s0 = await p.evaluate(() => ({ on: [...document.querySelectorAll('#pledge .pl-lines p')].filter((l) => l.classList.contains('on') && +getComputedStyle(l).opacity > 0.5).length, ask: getComputedStyle(document.querySelector('#pledge .pl-ask')).visibility, bg: getComputedStyle(document.getElementById('pledge')).backgroundColor, focus: document.activeElement && document.activeElement.id }));
  check(s0.on === 4 && s0.ask === 'visible', '네 줄이 다 나온 뒤 입력 칸·안내가 보임 (' + s0.on + '줄, ' + s0.ask + ')');
  check(s0.bg === 'rgb(0, 0, 0)', '판깔기 배경은 검은색 (' + s0.bg + ')');
  check(s0.focus === 'pledge-in', '판깔기 입력 칸에 자동 포커스 (' + s0.focus + ')');
  await p.waitForTimeout(700); await snap('pledge'); await bandCheck('판깔기 화면(덮임)', false);
  // 붙여넣기·끌어 놓기 막힘
  s0 = await p.evaluate(() => { const i = document.getElementById('pledge-in'); const dt = new DataTransfer(); dt.setData('text/plain', '혼자 생각해서 쓰겠습니다');
    const pe = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); i.dispatchEvent(pe);
    const de = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }); i.dispatchEvent(de); return [pe.defaultPrevented, de.defaultPrevented, i.value]; });
  check(s0[0] && s0[1] && s0[2] === '', '판깔기 칸 붙여넣기·끌어 놓기 막힘 (' + s0.join(',') + ')');
  // 꼬꼬는 안 움직임
  s1 = await st(); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Space'); await p.waitForTimeout(300);
  const sp = await st(); check(sp.mode === 'pledge' && sp.x === s1.x && sp.z === s1.z, '판깔기 중 방향키·Space로 꼬꼬가 안 움직임');
  await p.fill('#pledge-in', '');
  // 틀린 문장 → 통과 안 됨, 칸 흔들림
  await p.keyboard.type('열심히 하겠습니다'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  s0 = await p.evaluate(() => [window.__kk.S.mode, document.getElementById('pledge-in').classList.contains('bad'), document.getElementById('pledge').classList.contains('hide')]);
  check(s0[0] === 'pledge' && s0[1] && !s0[2], '틀린 문장 + Enter → 통과 안 됨, 칸 흔들림 (' + s0.join(',') + ')');
  await snap('pledge-wrong');
  // 맞는 문장(띄어쓰기는 무시) → 오프닝
  await p.fill('#pledge-in', ''); await p.keyboard.type('혼자  생각해서 쓰겠 습니다'); await p.keyboard.press('Enter');
  check(await waitMode('comic', 5000), '맞는 문장(띄어쓰기 무시) + Enter → 오프닝 컷신');
  check(await p.evaluate(() => document.getElementById('pledge').classList.contains('hide')), '판깔기 화면 닫힘');
  await p.waitForTimeout(900); await snap('comic1');
  check(!(await p.evaluate(() => document.querySelector('.comic-box').classList.contains('emph'))), '오프닝 1컷(안내)은 강조 없음');
  // 건너뛰기를 눌러도 원문 컷은 보여 준다(원문 줄은 강조)
  await p.click('#comic-skip'); await p.waitForTimeout(500);
  s0 = await p.evaluate(() => [document.getElementById('comic-page').textContent, document.querySelector('.comic-box').classList.contains('emph'), (window.__kk.S.mode)]);
  check(s0[0].startsWith('2') && s0[1] && s0[2] === 'comic', '건너뛰기 → 원문 컷(2)으로, 강조 (' + s0.join(',') + ')');
  await p.waitForTimeout(2600); await snap('comic2-emph');
  await p.click('#comic-skip'); await p.waitForTimeout(300);
  check(await waitMode('walk', 5000), '컷신 끝 → 꼬꼬 방에서 걷기');
  await p.waitForTimeout(700); await snap('home');
  s0 = await bandCheck('걷기(집 안)', true); check(s0.txt === '⚠ 이것은 평가입니다 · 친구와 답을 나누지 마세요' && !s0.over, '평가 띠 문구 (' + s0.txt + ')');
  await snap('band-walk');
  let s = await st(); check(s.quest === 'homeDoor' && (await p.evaluate(() => __kk.S.room)) === 'home', '첫 자리: 꼬꼬네 집 안 (' + s.quest + ')');
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('둘러보고')), '집 안 퀘스트 문구');
  check(await p.evaluate(() => getComputedStyle(document.getElementById('fps')).display === 'none'), 'fps 숫자 숨김(?debug 아닐 때)');
  // 시작 직후 Space: 가까운 것이 없어 점프만(나가기·단서가 바로 켜지지 않게)
  check(await p.evaluate(() => document.querySelector('#labels .prompt').style.display === 'none'), '시작 자리에서는 말풍선 없음');
  // 살펴보기 단서 3곳: 원문 강조 없이 안내 대사
  for (const id of ['clock', 'photo', 'mirror']) {
    await near(id, id === 'mirror' ? -0.5 : 0, id === 'mirror' ? 0 : 0.5); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.querySelector('#labels .prompt').textContent === 'E 살펴보기'), id + ' 앞 → 말풍선 "E 살펴보기"');
    if (id === 'clock') {   // 단서 앞에서 Space = 점프만(대사 안 열림)
      await p.keyboard.press('Space'); let jz = 0; for (let i = 0; i < 20; i++) { jz = Math.max(jz, await p.evaluate(() => __kk.J.z)); if (jz > 0.4) break; await p.waitForTimeout(50); }
      check(jz > 0.4 && (await st()).mode === 'walk', '단서 앞 Space → 점프만, 대사 안 열림 (최고 ' + jz.toFixed(2) + ')'); await p.waitForTimeout(1200);
      await near(id, 0, 0.5); await p.waitForTimeout(300);
    }
    if (id === 'clock') await labelsBelowTop('꼬꼬 방');
    await space(); s = await st(); check(s.mode === 'talk', id + ' 살펴보기 대사');
    check(!(await p.evaluate(() => document.getElementById('dialogue').classList.contains('emph'))), id + ' 대사는 강조 없음');
    if (id === 'photo') { await p.waitForTimeout(500); await snap('home-look'); await dlgFit('집 단서'); }
    await finishTalk();
  }
  check((await st()).quest === 'homeDoor', '단서를 봐도 퀘스트는 그대로(나가기만 남음)');
  await near('exit_home', 0, -0.4); await space(); await p.waitForTimeout(900);
  s = await st(); check((await p.evaluate(() => __kk.S.room)) === null && s.quest === 'mom', '집 문 → 마을, 다음 퀘스트 엄마 닭 (' + s.quest + ')');
  await p.waitForTimeout(500); await snap('village');
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('엄마')), '위쪽 퀘스트 문구');
  // 다시 들어갔다 나와도 퀘스트는 그대로
  await near('homeDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  check((await p.evaluate(() => __kk.S.room)) === 'home' && (await st()).quest === 'mom', '마을에서 집에 다시 들어가기');
  await near('exit_home', 0, -0.4); await space(); await p.waitForTimeout(900);
  check((await p.evaluate(() => __kk.S.room)) === null, '다시 나오기');
  // 점프(빈 곳에서)
  await tp(-12, 2.4); await p.waitForTimeout(250);
  await p.keyboard.press('Space');
  let jmax = 0; for (let i = 0; i < 40; i++) { jmax = Math.max(jmax, await p.evaluate(() => __kk.J.z)); if (jmax > 0.5) break; await p.waitForTimeout(60); }
  check(jmax > 0.5, '빈 곳 Space → 점프 (최고 ' + jmax.toFixed(2) + ')');
  await p.waitForTimeout(1500);
  // 제출 전: 2단 점프까지만(공중에서 Space를 더 눌러도 더 안 올라감). 이론 최고 = (V0²+V2²)/2g ≈ 2.08
  await tp(-12, 2.4); await p.waitForTimeout(250);
  let air = await airRun(4, 'apex'); let airL = await airLand(8000);
  check(airL.done && airL.land === 0 && air.max > 1.6 && air.max <= 2.1 && !air.fly, '제출 전 Space 4번(정점마다) → 2단 점프까지만, 3단·날기 없음 (최고 ' + air.max + ', 날갯짓 ' + air.fly + ')');
  const preMax = air.max; await p.waitForTimeout(1500);
  // 소품 올라서기 (벤치 윗면 0.95, 점프 정점 약 1.29)
  check(await p.evaluate(() => __kk.colliders.filter((c) => c.top !== undefined).every((c) => c.top <= 1.2)), '올라서는 소품은 모두 허리 높이 이하(1.2 이하)');
  check(await p.evaluate(() => __kk.colliders.filter((c) => c.top !== undefined && !c.off).every((c) => Math.abs(c.x - 21) - c.hw > 1.5 && Math.abs(c.z) + c.hd < 12.6 && c.x - c.hw > -22 && c.x + c.hw < 70 || c.z < -50)), '울타리 문·세계 가장자리 가까이에는 올라서는 소품 없음');
  await tp(-17.3, 4.4); await p.waitForTimeout(500);
  let j0 = await jz();
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight'); await p.waitForTimeout(200);
  let j = await jz(); check(j.z === 0 && j.x < -16.5, '점프 없이 걸으면 벤치에 막힘 (x ' + j.x + ', 발 ' + j.z + ')');
  j = await jumpMove('ArrowRight', 'S.x > -16.5'); check(j.z === 0.95 && !j.on && j.x > -16.6 && j.x < -15.4, '점프 → 벤치 위에 올라섬 (발 ' + j.z + ', x ' + j.x + ')');
  await p.waitForTimeout(700); j = await jz(); await snap('on-bench');
  check(j.z === 0.95 && j.camY > j0.camY + 0.6, '벤치 위에 서 있으면 그대로 있고 카메라도 따라 올라감 (카메라 y ' + j0.camY + ' → ' + j.camY + ')');
  await holdUntil('ArrowRight', async () => { const q = await jz(); return q.z === 0 && !q.on; }, 2500);
  j = await jz(); check(j.z === 0 && j.x > -15.5, '벤치 끝에서 걸어 나가면 떨어짐 (발 ' + j.z + ', x ' + j.x + ')');
  for (let i = 0; i < 40; i++) { j = await jz(); if (Math.abs(j.camY - j0.camY) < 0.1) break; await p.waitForTimeout(100); }
  check(Math.abs(j.camY - j0.camY) < 0.1, '내려오면 카메라 높이 제자리로 돌아옴 (' + j.camY + ')');
  // 상자(0.8) → 2단 점프로 다른 상자(1.0)
  await tp(11.6, -0.9); await p.waitForTimeout(300);
  j = await jumpMove('ArrowUp', 'S.z < -1.4'); check(j.z === 0.8, '작은 상자 위로 (발 ' + j.z + ')');
  // 높은 것(나무)은 2단 점프로도 못 지나감
  await tp(13.4, -1.5); await p.waitForTimeout(300);
  j = await jumpMove('ArrowRight', 1500, true); check(j.x < 15 && j.z === 0, '나무는 2단 점프로도 막힘 (x ' + j.x + ')');
  // 마트 문 먼저 → 잠김
  await near('martDoor', 0, 0.6); await space(); s = await st();
  check(s.mode === 'talk', '엄마 닭 전에는 마트 문 잠김'); await finishTalk();
  // 문 잠긴 채 오른쪽 문으로 → 막힘
  await tp(19.2, 2.2); await holdUntil('ArrowRight', async () => (await st()).mode === 'talk', 3000);
  s = await st(); check(s.mode === 'talk' && s.x < 21, '마트 전에는 회사 가는 문이 막힘'); await finishTalk();
  // 점프·2단 점프로도 문·울타리·덤불·세계 끝을 못 넘는다(퀘스트 순서 고정)
  for (const [x, z, key, tag] of [[19.6, 2.2, 'ArrowRight', '울타리 문'], [19.6, -6, 'ArrowRight', '문 옆 울타리'], [19.6, 9, 'ArrowRight', '문 옆 덤불'], [0, -12.4, 'ArrowUp', '북쪽 울타리'], [0, 12, 'ArrowDown', '남쪽 끝'], [-21.4, 2.2, 'ArrowLeft', '서쪽 끝']]) {
    await tp(x, z); await p.waitForTimeout(250);
    let mx = -1e9, mz = 1e9, Mz = -1e9, mnx = 1e9;
    for (let k = 0; k < 3; k++) { const q = await jumpMove(key, 1500, true); mx = Math.max(mx, q.x); mnx = Math.min(mnx, q.x); mz = Math.min(mz, q.sz); Mz = Math.max(Mz, q.sz); await finishTalk(); }
    const ok = key === 'ArrowRight' ? mx < 20.7 : key === 'ArrowUp' ? mz > -13.5 : key === 'ArrowDown' ? Mz < 12.7 : mnx > -22.1;
    check(ok, tag + ' 2단 점프로도 못 넘음 (x ' + mnx + '~' + mx + ', z ' + mz + '~' + Mz + ')');
  }
  check((await st()).quest === 'mom', '넘으려 해 봐도 퀘스트는 그대로 (' + (await st()).quest + ')');
  // 미래 마을(제출한 학생만): 제출 전에는 물체가 안 보이고 서쪽 끝 길목이 막혀 있음(위 '서쪽 끝' 점프로도 못 넘음), 안내에도 없음
  s0 = await p.evaluate(() => ({ open: __kk.FUT.open, vis: __kk.FUT.g.visible, col: !__kk.FUT.col.off, n: Object.values(__kk.TH).filter((t) => t.fut).length, txt: document.body.innerText.includes('미래') }));
  check(!s0.open && !s0.vis && s0.col && s0.n === 7 && !s0.txt, '제출 전 미래 마을: 안 보이고 길목 막힘, 화면 글에 없음 (' + JSON.stringify(s0) + ')');

  // 엄마 닭
  await near('mom', -1.0, 0.2); await p.waitForTimeout(300); await labelsBelowTop('엄마 닭 옆'); await space(); check((await st()).mode === 'talk', '엄마 닭 말 걸기'); await p.waitForTimeout(700); await snap('talk-mom'); await p.waitForTimeout(600);
  s0 = await p.evaluate(() => { const c = __kk.camera, V = c.position.constructor, m = __kk.NPCS.find((n) => n.id === 'mom'), y = (x, h, z) => Math.round((-new V(x, h, z).project(c).y * 0.5 + 0.5) * innerHeight);
    return [y(__kk.S.x, 0, __kk.S.z), y(m.x, 0, m.z), y(m.x, 2, m.z), Math.round(document.getElementById('dialogue').getBoundingClientRect().top)]; });
  check(Math.max(s0[0], s0[1]) < s0[3] && s0[2] > 60, '대화 중 꼬꼬·엄마 닭이 대사창 위에 보임 (꼬꼬 발 ' + s0[0] + ', 엄마 발 ' + s0[1] + ', 엄마 머리 ' + s0[2] + ', 대사창 ' + s0[3] + ')'); await finishTalk();
  check((await st()).flags.talkedMom === true, '엄마 닭 표시');
  // 마트 안으로
  await near('martDoor', 0, 0.6); await outdoorFrame('마트 문 앞', 'martDoor'); await snap('mart-door'); await space(); await p.waitForTimeout(900);
  s = await p.evaluate(() => __kk.S.room); check(s === 'mart', '마트 문 → 마트 안 (' + s + ')');
  await p.waitForTimeout(500); await snap('mart-in'); await labelsBelowTop('마트 안');
  check(await p.evaluate(() => { const e = document.querySelector('#labels .prompt'); return e.style.display === 'none' || !e.textContent.includes('나가기'); }), '들어온 직후 가장 가까운 것이 나가기가 아님');
  await space(); await p.waitForTimeout(400); check(await p.evaluate(() => __kk.S.room === 'mart'), '들어온 직후 Space를 또 눌러도 안 나감');
  // 라면 칸까지 실제로 걸어가기(위로)
  await holdUntil('ArrowUp', async () => (await st()).z < -82.4, 6000);
  await near('ramen', 0, 0.1); await space(); await p.waitForTimeout(1300);
  check((await st()).mode === 'talk', '라면 칸 → 원문 대사'); await dlgFit('라면'); await snap('ramen-closeup');
  check(await p.evaluate(() => document.getElementById('dialogue').classList.contains('emph')), '원문 줄 강조');
  await finishTalk(); await p.waitForTimeout(600);
  check((await st()).ex === 'panel', '라면 대사 → 평가 패널 1장'); await p.waitForTimeout(300); await snap('panel1'); await fitCheck('1장'); await sceneImg('1장');
  // 1번: <보기> 상자 + (1) 기호 버튼 두 줄(가계·기업) + (2) 빈칸 두 개 = 4칸
  check(await p.evaluate(() => document.querySelectorAll('#ex-qs .box-line').length === 4 && document.querySelectorAll('#ex-qs .sym').length === 8 && document.querySelectorAll('#ex-qs input[data-i]').length === 2), '1번 패널: 보기 4줄·기호 버튼 8개·빈칸 2개');
  // 키보드로 기호 고르기: 패널이 열리면 가계 줄 ㉠에 커서, Space로 켜고 끔, ←→ 같은 줄, ↑↓ 다른 줄, Tab은 다음 칸
  check(await act() === 'p-a0s0', '패널이 열리면 첫 칸(가계 줄 ㉠)에 커서 (' + await act() + ')');
  const ans = async () => (await st()).ans;
  const xz0 = await st();
  await p.keyboard.press('Space'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Space'); await p.waitForTimeout(150);
  s0 = await p.evaluate(() => [__ex.S.answers[0], document.querySelector('#ex-qs .sym-val[data-v="0"]').textContent, document.getElementById('p-a0s2').getAttribute('aria-checked')]);
  check(s0[0] === 'ㄱㄷ' && s0[1] === '㉠, ㉢' && s0[2] === 'true', '가계 줄 Space·→ → 저장값 "ㄱㄷ", 화면 ㉠, ㉢ (' + s0.join(' | ') + ')');
  s1 = await st(); check(s1.x === xz0.x && s1.z === xz0.z && s1.mode === 'panel', '기호 고르는 동안 꼬꼬는 안 움직임(게임 쪽 키 막힘)');
  // 두 개씩(11/25): 두 개 찬 줄에서 세 번째(㉣)는 안 켜지고 안내, 흐리게
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Space'); await p.waitForTimeout(150);
  s0 = await p.evaluate(() => [__ex.S.answers[0], document.getElementById('p-a0s3').getAttribute('aria-checked'), document.getElementById('p-a0s3').classList.contains('taken'), document.getElementById('ex-toast').textContent, document.getElementById('p-a0s1').classList.contains('taken')]);
  check(s0[0] === 'ㄱㄷ' && s0[1] === 'false' && s0[2] && s0[3] === '두 개만 고를 수 있어요' && s0[4], '1번 가계 줄 3개째(㉣ Space) → 안 켜짐, "두 개만" 안내, 남은 기호 흐림 (' + s0.join(' | ') + ')');
  await p.click('#p-a0s1'); await p.waitForTimeout(120);
  check((await ans())[0] === 'ㄱㄷ', '1번 가계 줄 3개째(㉡ 마우스) → 안 켜짐 (' + (await ans())[0] + ')');
  await p.focus('#p-a0s2');
  await p.keyboard.press('ArrowDown'); check(await act() === 'p-a1s2', '↓ → 기업 줄 같은 자리(㉢)');
  // 다른 줄에서 고른 기호(㉢)는 기업 줄에서 안 켜짐·흐림
  await p.keyboard.press('Space'); await p.waitForTimeout(150);
  s0 = await p.evaluate(() => [__ex.S.answers[1], document.getElementById('p-a1s2').getAttribute('aria-checked'), document.getElementById('p-a1s2').classList.contains('taken'), document.getElementById('p-a1s0').classList.contains('taken'), document.getElementById('p-a1s1').classList.contains('taken'), document.getElementById('ex-toast').textContent]);
  check(s0[0] === '' && s0[1] === 'false' && s0[2] && s0[3] && !s0[4] && s0[5] === '이미 다른 줄에 고른 기호예요', '1번 기업 줄: 가계에 고른 ㉢ → 안 켜짐·"이미 다른 줄" 안내, ㉠㉢ 흐림·㉡ 그대로 (' + s0.join(' | ') + ')');
  await p.click('#p-a1s0'); await p.waitForTimeout(120);
  check((await ans())[1] === '', '1번 기업 줄: 가계에 고른 ㉠ 마우스 → 안 켜짐');
  await p.focus('#p-a1s2');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Space'); await p.keyboard.press('Space'); await p.keyboard.press('Space');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Space'); await p.waitForTimeout(150);
  check((await ans())[1] === 'ㄴㄹ', '기업 줄: 켰다 끄기·←→ → "ㄴㄹ" (' + (await ans())[1] + ')');
  await p.keyboard.press('ArrowUp'); check(await act() === 'p-a0s3', '↑ → 가계 줄 같은 자리(㉣)');
  await p.keyboard.press('ArrowRight'); check(await act() === 'p-a0s0', '줄 끝에서 → 는 처음으로');
  await p.keyboard.press('Tab'); check(await act() === 'p-a1s3', 'Tab → 다음 줄(마지막으로 있던 기호)');
  await p.keyboard.press('Tab'); check(await act() === 'p-a2', 'Tab → (2) ① 빈칸');
  await p.keyboard.type('월 급'); await p.waitForTimeout(150);
  check((await ans())[2] === '월 급', '빈칸에 친 글자·띄어쓰기 그대로 (' + (await ans())[2] + ')');
  await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); check(await act() === 'p-a1s3', 'Shift+Tab → 기업 줄로 돌아감');
  await p.click('#p-a0s0'); await p.waitForTimeout(100); check((await ans())[0] === 'ㄷ', '두 개 찬 줄도 끄기는 됨(마우스) (' + (await ans())[0] + ')');
  s0 = await p.evaluate(() => [...document.querySelectorAll('#ex-qs .sym.taken')].map((e) => e.id).join(','));
  check(s0 === 'p-a0s1,p-a0s3,p-a1s0,p-a1s2', '가계 줄 하나 끄면: 가계 줄은 기업이 고른 ㉡㉣만 흐림, 두 개 찬 기업 줄은 남은 ㉠㉢ 흐림 (' + s0 + ')');
  // 덜 고른 줄은 빈칸으로 센다: [다 썼어요] → 확인 창
  await fill('#p-a2', '월급'); await fill('#p-a3', '라면');
  await p.click('#ex-done'); await p.waitForTimeout(300);
  check(await p.evaluate(() => !document.getElementById('ex-ask').classList.contains('hide') && document.getElementById('ex-ask-msg').textContent.includes('비어 있는 칸')), '가계 줄 1개만 고르고 [다 썼어요] → 빈칸 확인 창');
  await p.click('#ex-ask-no'); await p.waitForTimeout(200);
  await p.click('#p-a0s0'); await p.waitForTimeout(100); check((await ans())[0] === 'ㄱㄷ', '다시 누르면 켜짐 (' + (await ans())[0] + ')');
  await p.click('#p-a0s1'); await p.waitForTimeout(200);
  await bandCheck('1번 문항 창', true);
  check((await band()).over, '문항 창 위에서는 띠가 맨 위 테두리 자리(over-exam)');
  await snap('panel1-sym');
  await fill('#p-a2', '월급'); await fill('#p-a3', '라면');
  await p.click('#ex-done'); await p.waitForTimeout(900);
  // 자동 저장: 칸을 떠나거나(패널 닫기) 5초마다 바뀐 것만 서버로
  for (let i = 0; i < 30; i++) { const r = await srvRow(); if (r && r.answers[3] === '라면') break; await p.waitForTimeout(200); }
  s0 = await srvRow(); check(s0 && JSON.stringify(s0.answers.slice(0, 4)) === JSON.stringify(['ㄱㄷ', 'ㄴㄹ', '월급', '라면']) && s0.answers.length === 9, '자동 저장: 서버(스텁)에 9칸, 1번 4칸 그대로 (' + (s0 && s0.answers.slice(0, 4).join('|')) + ')');
  s = await st(); check(s.prog === 1, '1장 도장 (진행 ' + s.prog + ')');
  await p.waitForTimeout(700); await faceClear('꼬꼬 대사(after1)'); await snap('kkokko-talk'); await finishTalk();
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('나가')), '안에서는 나가기 안내');
  await near('exit_mart', 0, -0.4); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === null), '나가기 → 마을');
  // 이어하기: 중간에 새로고침 → 같은 반·번호로 들어오면 답·진행 그대로, 오프닝 다시 안 나옴
  await p.reload(); await p.waitForFunction(() => window.__kk && __kk.S.mode === 'start', null, { timeout: 90000 });
  await login(); await p.waitForTimeout(1200);
  s = await st();
  check(await p.evaluate(() => document.getElementById('pledge').classList.contains('hide')), '이어하기: 새로고침 뒤 판깔기 안 나옴');
  check(s.mode === 'walk' && s.prog === 1 && JSON.stringify(s.ans.slice(0, 4)) === JSON.stringify(['ㄱㄷ', 'ㄴㄹ', '월급', '라면']) && !s.sub, '이어하기: 새로고침 뒤 진행 1·답 그대로, 바로 걷기 (' + s.mode + ', 진행 ' + s.prog + ')');
  // 회사로 걸어가기
  await tp(19, 2.2); await holdUntil('ArrowRight', async () => (await st()).x > 23, 15000);
  s = await st(); check(s.x > 23, '문 열림 → 회사로 걸어 들어감 (x=' + s.x.toFixed(1) + ')');
  await p.waitForTimeout(900); await snap('company');
  // 자동차: 보닛(0.6) → 지붕(1.15) → 걸어 내려오면 보닛 → 땅
  await tp(45.2, -2.6); await p.waitForTimeout(400);
  j = await jumpMove('ArrowRight', 'S.x > 46.0'); check(j.z === 0.6, '자동차 보닛 위로 (발 ' + j.z + ', x ' + j.x + ')');
  j = await jumpMove('ArrowRight', 'S.x > 46.6'); check(j.z === 1.15, '보닛에서 지붕 위로 (발 ' + j.z + ', x ' + j.x + ')');
  await p.waitForTimeout(600); await snap('on-car');
  await holdUntil('ArrowRight', async () => { const q = await jz(); return q.z === 0 && !q.on; }, 3000);
  j = await jz(); check(j.z === 0 && j.x > 48.8, '자동차에서 걸어 내려옴 (발 ' + j.z + ', x ' + j.x + ')');
  // 땅에서 한 번 점프로 1.15(쓰레기통 뚜껑)까지: 프레임이 느려도 정점이 같아야 한다
  await tp(24.4, -2.3); await p.waitForTimeout(400);
  j = await jumpMove('ArrowUp', 'S.z < -3.0'); check(j.z === 1.15, '한 번 점프로 쓰레기통 위 (발 ' + j.z + ', 느린 렌더링 fps ' + Math.round(await p.evaluate(() => __kk.fps)) + ')');
  await tp(24.4, -1.6); await p.waitForTimeout(400);
  check(await p.evaluate(() => !__kk.POLL.on && !__kk.POLL.pipe.visible), '3장 전에는 강이 맑고 배수관 없음');
  await near('meetDoor', 0, 0.6); await outdoorFrame('회의실 문 앞', 'meetDoor'); await snap('meet-door'); await labelsBelowTop('회의실 문 앞');
  await space(); check((await st()).mode === 'talk', '공장 전에는 회의실 잠김'); await finishTalk();
  await near('factoryDoor', 0, 0.6); await outdoorFrame('공장 문 앞', 'factoryDoor'); await snap('factory-door'); await labelsBelowTop('공장 문 앞'); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === 'factory'), '공장 안'); await p.waitForTimeout(500); await snap('factory-in'); await labelsBelowTop('공장 안');
  await holdUntil('ArrowUp', async () => (await st()).mode !== 'walk', 6000);
  for (let i = 0; i < 60 && (await st()).mode !== 'talk'; i++) await p.waitForTimeout(200); s = await st();
  check(s.mode === 'talk', '빈자리에 서면 점호 시작 (' + s.mode + ')'); await snap('rollcall-wide');
  await space(2); await p.waitForTimeout(500); await snap('rollcall-boss'); await dlgFit('점호'); await faceClear('공장장 대사');
  check(await p.evaluate(() => document.getElementById('cutin').classList.contains('hide')), '점호 원문 줄에 컷인 없음(같은 장 원문 줄 연출 같게)');
  s0 = await p.evaluate(() => { const c = __kk.camera, v = new c.position.constructor(40, 1.55, -82.2).project(c); return Math.round((-v.y * 0.5 + 0.5) * innerHeight); });
  s1 = await p.evaluate(() => Math.round(document.getElementById('dialogue').getBoundingClientRect().top));
  check(s0 > 60 && s0 < s1 - 20, '공장장 얼굴이 대사창 위에 보임 (얼굴 y ' + s0 + ', 대사창 ' + s1 + ')');
  await finishTalk(); await p.waitForTimeout(600);
  check((await st()).ex === 'panel', '점호 → 평가 패널 2장'); await p.waitForTimeout(300); await snap('panel2'); await fitCheck('2장'); await sceneImg('2장');
  s0 = await p.evaluate(() => [[...document.querySelectorAll('#ex-qs .field-tag')].map((e) => e.textContent).join('/'), document.querySelectorAll('#ex-qs textarea[data-i]').length, document.querySelector('#ex-qs .cond').textContent.includes('법이나 제도를 활용하여')]);
  check(s0[0] === '가)/나)' && s0[1] === 2 && s0[2], '2번 패널: 조건 원문 + 가)·나) 칸 두 개 (' + s0.join(' | ') + ')');
  check(await act() === 'p-a4', '2번 패널 첫 칸(가))에 커서');
  await fill('#p-a4', '테스트 답 가'); await fill('#p-a5', '테스트 답 나');
  // 2번 문항 첫 [다 썼어요]: 검은 주의 화면 → [2번 문항 다시 보기](1.5초 뒤 켜짐) → 2번 패널 그대로 → 다시 [다 썼어요]로 나감
  await p.click('#ex-done'); await p.waitForTimeout(300);
  s0 = await p.evaluate(() => ({ ex: window.__ex.mode, vis: !document.getElementById('ex-warn').classList.contains('hide'), dis: document.getElementById('ex-warn-go').disabled, ask: !document.getElementById('ex-ask').classList.contains('hide'), bg: getComputedStyle(document.getElementById('ex-warn')).backgroundColor }));
  check(s0.ex === 'warn' && s0.vis && s0.dis && !s0.ask && s0.bg === 'rgb(0, 0, 0)', '2번 패널 첫 [다 썼어요] → 검은 주의 화면, 버튼은 잠시 꺼짐 (' + JSON.stringify(s0) + ')');
  check((await st()).prog === 1, '주의 화면 동안 2장 도장 아직 안 찍힘');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check((await st()).ex === 'warn', '패널 주의 화면에서 Esc로 안 닫힘');
  await p.waitForTimeout(1500); await snap('warn-panel'); await bandCheck('2번 패널 주의 화면', false);
  check(await p.evaluate(() => document.getElementById('ex-warn-go').textContent) === '2번 문항 다시 보기', '패널 주의 화면 버튼 "2번 문항 다시 보기"');
  check(await p.evaluate(() => !document.getElementById('ex-warn-go').disabled && document.activeElement.id === 'ex-warn-go'), '1.5초 뒤 [2번 문항 다시 보기] 켜짐·포커스');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  s0 = await p.evaluate(() => ({ ex: window.__ex.mode, warn: document.getElementById('ex-warn').classList.contains('hide'), panel: !document.getElementById('ex-panel').classList.contains('hide'), tags: [...document.querySelectorAll('#ex-qs .field-tag')].map((e) => e.textContent).join('/'), f: document.activeElement && document.activeElement.id, a4: document.getElementById('p-a4').value, a5: document.getElementById('p-a5').value }));
  check(s0.ex === 'panel' && s0.warn && s0.panel && s0.tags === '가)/나)' && s0.f === 'p-a4' && s0.a4 === '테스트 답 가' && s0.a5 === '테스트 답 나', 'Enter → 2번 패널 그대로(답 그대로), 가) 칸 포커스 (' + JSON.stringify(s0) + ')');
  check((await st()).prog === 1, '돌아와도 아직 2장 도장 안 찍힘');
  await snap('warn-panel-back'); await bandCheck('주의 화면 뒤 2번 문항 창', true);
  await p.click('#ex-done'); await p.waitForTimeout(900);
  check(await p.evaluate(() => document.getElementById('ex-warn').classList.contains('hide')), '다시 [다 썼어요] → 주의 화면 다시 안 나옴');
  check((await st()).prog === 2, '2장 도장'); await finishTalk();
  check(await p.evaluate(() => __kk.POLL.on && __kk.POLL.pipe.visible), '2장을 마치면 강가에 배수관·더러운 물');
  await near('exit_factory', 0, -0.4); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('(0/3)')), '3장 퀘스트: 세 곳 (0/3)');
  // 3장 세 곳(순서 자유): 광고판 → 회의실 빈 의자 → 강가 순서로 가 본다. 곳마다 연출(검은 전환·카메라·강조·초상화)을 재서 셋이 같은지 본다
  const fx3 = {};
  // 기기가 느려도 놓치지 않게: 검은 전환(#fade.on)과 조사 동작은 페이지 안에서 기록해 두고 읽는다
  await p.evaluate(() => { window.__fadeLog = []; const f = document.getElementById('fade');
    new MutationObserver(() => { if (f.classList.contains('on')) __fadeLog.push(performance.now()); }).observe(f, { attributes: true, attributeFilter: ['class'] }); });
  let mark = { fade: 0, verb: 0 };
  const arm = async () => { mark = await p.evaluate(() => ({ fade: __fadeLog.length, verb: __kk.verbLog.length })); };
  const spotRun = async (id, tag) => {
    // 원문 줄이 뜰 때까지: 검은 전환이 있었는지, 카메라 연출이 켜졌는지
    // 먼저 조사 동작(동사): 키 한 번 + 짧은 행동. 중간 장면을 찍고 길이를 잰다(세 곳 같아야 함)
    let faded = false, verbShot = false; const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      const r = await p.evaluate(() => [document.getElementById('fade').classList.contains('on'), __kk.S.mode, !document.getElementById('dialogue').classList.contains('hide'), __kk.verb]);
      if (r[3] && !r[3].ended && !verbShot && r[3].t > 700) { verbShot = true; await snap('verb-' + id); }
      if (r[0]) faded = true;
      if (r[1] === 'talk' && r[2] && !r[0]) break;
      await p.waitForTimeout(40);
    }
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ talk: __kk.S.mode === 'talk', emph: document.getElementById('dialogue').classList.contains('emph'), cam: !!__kk.S.cam,
      face: !document.getElementById('dlg-big').classList.contains('hide'), cut: !document.getElementById('cutin').classList.contains('hide'), name: document.getElementById('dlg-name').textContent }));
    const lg = await p.evaluate((m) => ({ v: __kk.verbLog.slice(m.verb), f: __fadeLog.slice(m.fade) }), mark);
    const vv = lg.v.length === 1 && lg.v[0].end ? lg.v[0] : null, vsec = vv ? (vv.end - vv.start) / 1000 : 0, vlen = Math.round(vsec * 2) / 2;   // 비교는 0.5초 단위(프레임 간격 오차)
    faded = faded || (!!vv && lg.f.some((t) => t >= vv.end));   // 동작이 끝난 뒤 원문 줄의 검은 전환
    check(!!vv && vlen > 0, tag + ' → 조사 동작 ' + vsec.toFixed(2) + '초' + (verbShot ? ' (중간 장면 찍음)' : ' (기기가 느려 중간 장면 못 찍음)'));
    fx3[id] = JSON.stringify({ verb: vlen, faded, emph: r.emph, cam: r.cam, face: r.face, cut: r.cut, name: r.name });
    check(r.talk && r.emph && faded && r.cam, tag + ' → 원문 대사 (' + fx3[id] + ')');
    await dlgFit(tag);
  };
  // 광고판: 앞까지 걸어가서 반짝이는 자리에 서기
  await near('adboard', 0, 2.2); await p.waitForTimeout(300); await labelsBelowTop('광고판 앞');
  await arm(); await holdUntil('ArrowUp', async () => (await st()).mode !== 'walk', 6000);
  await spotRun('adboard', '광고판'); await snap('spot-ad'); await finishTalk(); await p.waitForTimeout(600);
  s = await st(); check(s.mode === 'walk' && s.ex !== 'panel' && s.flags.seen_adboard, '광고판만 보면 패널 안 열림 (' + s.mode + '/' + s.ex + ')');
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('(1/3)')), '퀘스트 (1/3)');
  // 회의실: 문 → 빈 의자
  await near('meetDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === 'meet'), '회의실 안'); await p.waitForTimeout(500); await snap('meet-in'); await labelsBelowTop('회의실 안');
  await arm(); await holdUntil('ArrowUp', async () => (await st()).mode !== 'walk', 6000);
  await spotRun('seat', '회의실 빈 의자'); await snap('spot-meeting'); await finishTalk(); await p.waitForTimeout(600);
  s = await st(); check(s.mode === 'walk' && s.ex !== 'panel' && !(await p.evaluate(() => __kk.S.sit)), '두 곳 뒤에도 패널 안 열림, 의자에서 일어남 (' + s.mode + ')');
  check(await p.evaluate(() => document.querySelector('#quest-bar b').textContent.includes('나가')), '안 본 곳이 바깥이면 나가기 안내');
  await near('exit_meet', 0, -0.4); await space(); await p.waitForTimeout(900);
  // 강가: 배수관 옆 자리로 걸어가기
  await near('riverside', -2.2, 0); await p.waitForTimeout(300); await labelsBelowTop('강가');
  await arm(); await holdUntil('ArrowRight', async () => (await st()).mode !== 'walk', 6000);
  await spotRun('riverside', '강가'); await snap('spot-river');
  check(fx3.adboard === fx3.seat && fx3.seat === fx3.riverside, '세 곳 연출이 같음');
  await finishTalk(); await p.waitForTimeout(900);
  check((await st()).ex === 'panel', '세 곳을 다 보면 → 평가 패널 3장'); await p.waitForTimeout(300); await snap('panel3'); await fitCheck('3장'); await sceneImg('3장');
  s0 = await p.evaluate(() => [[...document.querySelectorAll('#ex-qs .field-tag')].map((e) => e.textContent).join('/'), document.querySelectorAll('#ex-qs textarea[data-i]').length]);
  check(s0[0] === '가)/나) 다하지 못한 점/나) 개선할 방법' && s0[1] === 3, '3번 패널: 가)·나) 문제점·나) 개선 칸 세 개 (' + s0.join(' | ') + ')');
  await fill('#p-a6', '테스트 답 다'); await fill('#p-a7', '테스트 답 라');
  // 빈칸이 있으면 나갈 때 묻는다 → 돌아가서 마저 쓴다
  await p.click('#ex-done'); await p.waitForTimeout(300);
  check(await p.evaluate(() => !document.getElementById('ex-ask').classList.contains('hide')), '빈칸 남기고 다 썼어요 → 확인 창');
  await p.click('#ex-ask-no'); await p.waitForTimeout(200);
  await fill('#p-a8', '테스트 답 마');
  await p.click('#ex-done'); await p.waitForTimeout(900); check((await st()).prog === 3, '3장 도장');
  await finishTalk(); await p.waitForTimeout(500);
  check((await st()).ex === 'notebook', '수첩 열림'); await snap('notebook'); await bandCheck('수첩', true);
  for (const t of [0, 1, 2]) { await p.click('#nb-tabs button[data-t="' + t + '"]'); await p.waitForTimeout(150); await fitCheck('수첩 ' + (t + 1) + '번', '#nb-left,#nb-right'); }
  s0 = await st(); check(JSON.stringify(s0.ans) === JSON.stringify(['ㄱㄷ', 'ㄴㄹ', '월급', '라면', '테스트 답 가', '테스트 답 나', '테스트 답 다', '테스트 답 라', '테스트 답 마']), '9칸 답 모두 그대로 (' + s0.ans.join('|') + ')');
  check(await p.evaluate(() => document.getElementById('nb-edit').classList.contains('hide') && !document.getElementById('nb-submit').disabled), '제출 전 수첩: [답 고치기] 없음, [제출하기] 켜짐');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); s = await st();
  check(s.ex === 'game' && s.mode === 'walk', 'Esc로 수첩 닫힘 (' + s.ex + '/' + s.mode + ')');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); s = await st();
  check(s.ex === 'notebook', 'Esc로 수첩 다시 열림 (' + s.ex + ')');
  // 첫 제출: 검은 주의 화면 → [내 답 다시 보기](1.5초 뒤 켜짐) → 수첩 1번 → 다시 [제출하기] → 확인 창
  await p.click('#nb-submit'); await p.waitForTimeout(300);
  s0 = await p.evaluate(() => ({ ex: window.__ex.mode, vis: !document.getElementById('ex-warn').classList.contains('hide'), dis: document.getElementById('ex-warn-go').disabled, ask: !document.getElementById('ex-ask').classList.contains('hide'), bg: getComputedStyle(document.getElementById('ex-warn')).backgroundColor }));
  check(s0.ex === 'warn' && s0.vis && s0.dis && !s0.ask && s0.bg === 'rgb(0, 0, 0)', '첫 제출 → 검은 주의 화면, 버튼은 잠시 꺼짐 (' + JSON.stringify(s0) + ')');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check((await st()).ex === 'warn', '주의 화면에서 Esc로 안 닫힘');
  await p.waitForTimeout(1500); await snap('warn'); await bandCheck('제출 주의 화면', false);
  s0 = await p.evaluate(() => [!document.getElementById('ex-warn-go').disabled && document.activeElement.id === 'ex-warn-go', document.getElementById('ex-warn-go').textContent, document.getElementById('ex-warn').innerText]);
  check(s0[0] && s0[1] === '내 답 다시 보기' && !/2번 문항/.test(s0[2]), '1.5초 뒤 [내 답 다시 보기] 켜짐·포커스, 검은 화면에 "2번 문항" 없음 (' + s0[1] + ')');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  s0 = await p.evaluate(() => ({ ex: window.__ex.mode, tab: (document.querySelector('#nb-tabs button.on') || {}).textContent, note: document.getElementById('nb-note').textContent, f: document.activeElement && document.activeElement.id, warn: document.getElementById('ex-warn').classList.contains('hide') }));
  check(s0.ex === 'notebook' && s0.tab === '1번' && s0.warn && s0.note === '1번부터 답을 한 번 더 읽어 보세요. 다 됐으면 [제출하기]를 눌러 주세요.' && s0.f === 'n-a0s0', 'Enter → 수첩 1번 탭, 안내 문구, 1번 첫 칸 포커스 (' + JSON.stringify(s0) + ')');
  await bandCheck('주의 화면 뒤 수첩', true);
  await snap('warn-q1');
  await p.click('#nb-submit'); await p.waitForTimeout(300);
  check(await p.evaluate(() => !document.getElementById('ex-ask').classList.contains('hide') && document.getElementById('ex-warn').classList.contains('hide')), '두 번째 [제출하기] → 확인 창 (주의 화면 다시 안 나옴)');
  await p.click('#ex-ask-yes'); await p.waitForTimeout(800);
  s = await st(); check(s.sub && s.ex === 'end', '제출 → 끝 화면'); await snap('end'); await bandCheck('끝 화면', false);
  s0 = await srvRow(); check(s0 && s0.submitted && s0.answers[8] === '테스트 답 마', '서버(스텁)에 제출 표시·9칸 (' + (s0 && s0.submittedAt) + ')');
  check(await p.evaluate(() => !/[◎○△]|점수|판정|정답/.test(document.getElementById('ex-root').innerText)), '학생 화면에 채점 결과(◎○△·점수·판정) 없음');
  const sub1At = s0 && s0.submittedAt;
  // 끝 화면에서 Esc → 수첩(제출한 답, [답 고치기] 있음) → Esc → 끝 화면
  await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  check((await st()).ex === 'notebook' && await p.evaluate(() => !document.getElementById('nb-edit').classList.contains('hide') && document.getElementById('nb-submit').classList.contains('hide')), '끝 화면 Esc → 수첩, [답 고치기] 보임·제출 버튼 숨김');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  check((await st()).ex === 'end', '수첩 Esc → 끝 화면으로');
  // ── 제출 뒤 자유롭게 돌아다니기 ──
  const ansAtSubmit = JSON.stringify((await st()).ans);
  await p.waitForTimeout(200);
  check(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'end-roam', '끝 화면: "마을 돌아다니기"에 커서');
  const roamChecks = async (tag) => {
    s = await st();
    check(s.mode === 'walk' && s.ex === 'game' && (await p.evaluate(() => __kk.S.roam && __ex.roaming)), tag + ' 돌아다니기 모드 (' + s.mode + '/' + s.ex + ')');
    check(await p.evaluate(() => document.getElementById('ex-root').classList.contains('hide')), tag + ' 평가 화면 닫힘');
    check(s.quest === null && await p.evaluate(() => document.getElementById('quest-bar').style.display === 'none' && !__kk.arrow.visible && __kk.markers.every((m) => !m.g.visible)), tag + ' 퀘스트 안내·화살표·반짝이 숨김');
    check(await p.evaluate(() => __kk.gates.every((g) => g.open)), tag + ' 울타리 문 모두 열림');
    check(await p.evaluate(() => __kk.FUT.open && __kk.FUT.g.visible && __kk.FUT.col.off), tag + ' 미래 마을 길 열림·구역 보임');
    check(await p.evaluate(() => [...document.querySelectorAll('#labels .edge-arrow,#labels .tlabel')].every((e) => e.style.display === 'none')), tag + ' 목적지 이름표·가장자리 화살표 숨김');
  };
  await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  await roamChecks('Enter →'); await snap('roam'); await bandCheck('제출 뒤 돌아다니기', false);
  check(await p.evaluate(() => !document.body.classList.contains('band-on')), '돌아다니기: 퀘스트 띠·배너 자리 원래대로(band-on 없음)');
  check(await p.evaluate(() => document.getElementById('kbd-nb').textContent.includes('내 답')), 'HUD 안내: Esc 내 답 보기');
  // 제출 뒤 날기: Space 연타 → 2단 점프보다 높이, 상한(땅 위 25)은 못 넘고, 카메라가 따라가고, 다시 내려앉음
  check(await p.evaluate(() => document.getElementById('kbd-nb').textContent.includes('날기')), 'HUD 안내: Space 연타 날기');
  await p.evaluate(() => { __kk.S.room = null; __kk.teleport(-12, 2.4, 0); }); await p.waitForTimeout(600);
  const camG = await p.evaluate(() => __kk.camera.position.y);
  air = await airRun(120, 140, () => __kk.J.z >= __kk.FLY_TOP - 0.05);
  await p.keyboard.press('Space'); await p.waitForTimeout(140); await p.keyboard.press('Space'); await p.waitForTimeout(400);   // 상한에서 더 눌러 보기
  air.max2 = await p.evaluate(() => +__air.max.toFixed(2)); await snap('fly-top');
  check(air.max > preMax + 1 && air.max > 20, '제출 뒤 Space 연타 → 2단 점프(' + preMax + ')보다 높이 날기 (최고 ' + air.max + ', 날갯짓 ' + air.fly + ')');
  check(air.max2 <= 25.01, '날기 높이 상한 25를 안 넘음 (상한에서 더 눌러도 ' + air.max2 + ')');
  check(air.camAtMax > camG + 15 && air.scr[1] > 20 && air.scr[1] < H - 20 && air.scr[0] > 20 && air.scr[0] < W - 20, '높이 날 때 카메라가 따라감 (카메라 y ' + camG.toFixed(1) + ' → ' + air.camAtMax + ', 꼬꼬 화면 ' + air.scr.join(',') + ')');
  airL = await airLand();
  let camL = 0; for (let i = 0; i < 40; i++) { camL = await p.evaluate(() => __kk.camera.position.y); if (Math.abs(camL - camG) < 0.1) break; await p.waitForTimeout(100); }
  check(airL.done && airL.land === 0 && airL.mode === 'walk', '날다가 손 떼면 땅에 내려앉음 (발 ' + airL.land + ')');
  check(Math.abs(camL - camG) < 0.3, '내려앉으면 카메라 높이 제자리 (' + camG.toFixed(2) + ' → ' + camL.toFixed(2) + ')');
  // 실내(마트): 벽 높이로 상한을 낮춰 벽 위로 못 나감
  await p.evaluate(() => { __kk.S.room = null; }); await near('martDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  const inR = await p.evaluate(() => { const R = __kk.ROOMS.mart; __kk.teleport(R.cx, R.cz + 1.2, Math.PI); return { cx: R.cx, cz: R.cz, w: R.w, d: R.d, top: __kk.flyTop() }; }); await p.waitForTimeout(300);
  air = await airRun(14, 140); await snap('fly-mart'); airL = await airLand(10000);
  const inS = await p.evaluate(() => ({ room: __kk.S.room, x: __kk.S.x, z: __kk.S.z }));
  check(inS.room === 'mart' && inR.top < 2.2 && air.max <= inR.top + 0.01 && air.fly > 2 && airL.done && inS.room === 'mart' && Math.abs(inS.x - inR.cx) < inR.w / 2 && Math.abs(inS.z - inR.cz) < inR.d / 2, '마트 안 날기: 천장 높이 상한 ' + inR.top.toFixed(2) + ' 안 (최고 ' + air.max + '), 방 안에 내려앉음');
  await near('exit_mart', 0, -0.4); await space(); await p.waitForTimeout(900);
  // 제출 뒤 대사: 엄마 닭이 옛 퀘스트 대사(마트 가자) 대신 제출 뒤 대사
  await near('mom', -1.0, 0.2); await p.waitForTimeout(300); await space(); await p.waitForTimeout(1500);
  s0 = await p.evaluate(() => document.getElementById('dlg-text').textContent);
  check((await st()).mode === 'talk' && !s0.includes('마트') && s0.includes('수고'), '돌아다닐 때 엄마 닭은 제출 뒤 대사 (' + s0 + ')');
  await finishTalk();
  // 문마다 잠김 없이 들어갔다 나오기
  for (const [door, room] of [['martDoor', 'mart'], ['factoryDoor', 'factory'], ['meetDoor', 'meet']]) {
    await p.evaluate(() => { __kk.S.room = null; }); await near(door, 0, 0.6);
    const pr = await p.evaluate(() => document.querySelector('#labels .prompt').textContent);
    await space(); await p.waitForTimeout(900);
    check(await p.evaluate((r) => __kk.S.room === r, room), door + ' 바로 들어감 (말풍선 ' + pr + ')');
    await p.waitForTimeout(300); await snap('roam-' + room);
    // 평가 장면 자리: 말풍선 없음, Space는 점프, 반짝이 자리에 서도 장면이 시작되지 않음
    const sid = { mart: 'ramen', factory: 'rollcall', meet: 'seat' }[room];
    await near(sid, 0, room === 'mart' ? 0.1 : 0); await p.waitForTimeout(700);
    s = await st();
    const pr2 = await p.evaluate(() => { const e = document.querySelector('#labels .prompt'); return e.style.display === 'none' ? '' : e.textContent; });
    check(s.mode === 'walk' && s.ex === 'game', room + ' 평가 장면 자리에 서도 장면·패널 안 열림 (' + s.mode + '/' + s.ex + ')');
    await space(); await p.waitForTimeout(700); s = await st();
    check(s.ex === 'game' && (s.mode === 'walk' || s.mode === 'talk') && !pr2.includes('살펴') , room + ' 장면 자리 Space → 패널 안 열림 (말풍선 "' + pr2 + '")');
    await finishTalk(); await p.waitForTimeout(800);
    await near('exit_' + room, 0, -0.4); await space(); await p.waitForTimeout(900);
    check(await p.evaluate(() => __kk.S.room === null), room + ' 나가기');
  }
  // 회사 쪽에서 마을까지 문을 지나 걸어가기(막힘 없음)
  await tp(26, 2.2); await holdUntil('ArrowLeft', async () => (await st()).x < 18, 15000);
  s = await st(); check(s.x < 18 && s.mode === 'walk', '회사 → 마을 걸어서 돌아옴 (x=' + s.x.toFixed(1) + ')');
  // ── 미래 마을(제출 뒤만): 마을 왼쪽 끝 새 길 → 시간 여행 거리 세 칸 · 첨단 기술 셋 · 초성 암호 상자 ──
  await tp(-20.5, 2.2); await p.waitForTimeout(300);
  await holdUntil('ArrowLeft', async () => (await st()).x < -26, 9000);
  s = await st(); check(s.x < -26 && s.mode === 'walk', '마을 왼쪽 끝 새 길로 걸어 들어감 (x=' + s.x.toFixed(1) + ')');
  await p.waitForTimeout(500);
  check(await p.evaluate(() => document.getElementById('zone-banner').textContent.includes('미래 마을')), '들어가면 구역 띠 "미래 마을"');
  await p.evaluate(() => __kk.shot([-35.5, 13, 17], [-35.5, 0.5, 0.5])); await p.waitForTimeout(600); await snap('future-wide');
  await p.evaluate(() => { __kk.S.cam = null; });
  // 한 곳: Space → 연출(scene) → 한 줄(talk) → 다시 걷기. mid: 연출 중간에 재는 값
  const futSpot = async (id, tag, mid) => {
    await near(id, 0, 0); await p.waitForTimeout(350);
    const pr = await p.evaluate(() => { const e = document.querySelector('#labels .prompt'); return e.style.display === 'none' ? '' : e.textContent; });
    await space(); const a = await st();
    const ms = await p.evaluate(() => __kk.FUT.anim ? __kk.FUT.anim.ms : 0);
    await p.waitForTimeout(ms * 0.45); const m = mid ? await p.evaluate(mid) : null; await snap('future-' + tag);
    const ok = await waitMode('talk', ms + 4000); await p.waitForTimeout(500);
    const lines = []; for (let i = 0; i < 20 && (await st()).mode === 'talk'; i++) { const t = await p.evaluate(() => document.getElementById('dlg-text').textContent); if (lines[lines.length - 1] !== t) lines.push(t); await space(); }
    const txt = lines.join(' / '); await p.waitForTimeout(200); const b2 = await st();
    const back = await p.evaluate(() => ({ lift: __kk.FUT.lift, anim: !!__kk.FUT.anim, jz: __kk.J.z }));
    check(pr.startsWith('E ') && a.mode === 'scene' && ms >= 1000 && ms <= 2500 && ok && b2.mode === 'walk' && !back.anim && back.lift === 0 && back.jz === 0,
      tag + ': Space → 연출 ' + ms + 'ms → 한 줄 → 다시 걷기 (말풍선 "' + pr + '", ' + a.mode + '→' + (ok ? 'talk' : '?') + '→' + b2.mode + ', "' + txt.slice(0, 22) + '…")');
    return { txt, m, b2 };
  };
  let fr;
  fr = await futSpot('futDrone', 'drone', () => __kk.FUT.drone.position.y);
  check(fr.m > 1.5 && fr.txt.includes('첨단 기술'), '드론: 떠올라 한 바퀴 (높이 ' + (+fr.m).toFixed(2) + '), 끝나면 첨단 기술 한 줄');
  check(await p.evaluate(() => __kk.FUT.drone.position.y < 0.2), '드론 다시 내려앉음');
  // 자율 주행 차: 상자를 풀기 전(열쇠 없음)에는 잠김 대사만, 차는 안 움직임
  {
    const c0 = await p.evaluate(() => ({ x: __kk.FUT.car.g.position.x, z: __kk.FUT.car.g.position.z, key: __kk.FUT.key }));
    await near('futCar', 0, 0); await p.waitForTimeout(350);
    const pr = await p.evaluate(() => { const e = document.querySelector('#labels .prompt'); return e.style.display === 'none' ? '' : e.textContent; });
    await space(); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => ({ mode: __kk.S.mode, drive: __kk.FUT.drive, anim: !!__kk.FUT.anim, t: document.getElementById('dlg-text').textContent, cx: __kk.FUT.car.g.position.x, cz: __kk.FUT.car.g.position.z, vis: __kk.hero.root.visible }));
    await finishTalk(); await p.waitForTimeout(200);
    check(!c0.key && r.mode === 'talk' && !r.drive && !r.anim && r.t.includes('잠겨') && r.t.includes('열쇠') && r.cx === c0.x && r.cz === c0.z && r.vis && (await st()).mode === 'walk',
      '상자 전 자율 주행 차 → 잠김 대사, 차 그대로 (말풍선 "' + pr + '", "' + r.t + '")');
  }
  fr = await futSpot('futRobot', 'robot', () => Math.abs(__kk.FUT.robot.turret.rotation.y) + Math.abs(__kk.FUT.robot.a2.rotation.z + 1.1) + Math.abs(__kk.FUT.robot.a1.rotation.z - 0.3));   // a1(아래팔)은 연출 한가운데서 가장 크게 — 잰 때가 한가운데여도 0이 안 되게
  check(fr.m > 0.3, '로봇: 버튼 누르면 팔이 움직임 (' + (+fr.m).toFixed(2) + ')');
  // 미래 마을에서도 수첩(Esc)·날기 그대로
  await tp(-35, 2.2); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500); s = await st();
  check(s.ex === 'notebook', '미래 마을에서 Esc → 내 답 수첩 (' + s.ex + ')');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400); s = await st();
  check(s.ex === 'game' && s.mode === 'walk', '수첩 Esc → 다시 미래 마을');
  air = await airRun(8, 150); airL = await airLand(15000);
  check(air.max > 2 && air.fly >= 1 && airL.done && airL.mode === 'walk', '미래 마을에서도 Space 연타 날기 (최고 ' + air.max + ')');
  // ── 시간 여행 거리 = 읽고 따라 쓰기(1960 → 1980 → 2020 차례) · 초성 암호 상자(틀리면 1960으로) ──
  const dlg = () => p.evaluate(() => document.getElementById('dlg-text').textContent);
  // 잠긴 곳: Space → 연출 없이 바로 대사 한 줄
  const lockTalk = async (id) => {
    await near(id, 0, 0); await p.waitForTimeout(350); await space(); await p.waitForTimeout(1200);
    const r = { mode: (await st()).mode, anim: await p.evaluate(() => !!__kk.FUT.anim), t: await dlg(), read: await p.evaluate(() => __kk.FUT.read), cp: await p.evaluate(() => !document.getElementById('cipher').classList.contains('hide')) };
    await finishTalk(); await p.waitForTimeout(200); return r;
  };
  const rdState = () => p.evaluate(() => ({ mode: __kk.S.mode, vis: !document.getElementById('futread').classList.contains('hide'), era: document.getElementById('futread-era').textContent,
    ask: document.getElementById('futread-ask').textContent, f: document.activeElement && document.activeElement.id, rd: __kk.FUT.rd && { ...__kk.FUT.rd }, read: __kk.FUT.read,
    b: [...document.querySelectorAll('#futread-text b')].map((e) => e.textContent), txt: document.getElementById('futread-text').textContent,
    done: !document.getElementById('futread-done').classList.contains('hide'),
    askVis: !document.querySelector('#futread .nw-ask').classList.contains('hide'), nextVis: !document.getElementById('futread-next').classList.contains('hide'),
    c: __kk.FUT.rd ? __kk.FUT.rd.c : -1, nc: __kk.FUT.rd ? __kk.FUT_READ[__kk.FUT.rd.i].cards.length : 0,
    img: (() => { const im = document.getElementById('futread-img'); return im.complete && im.naturalWidth > 0; })(), head: document.getElementById('futread-head').textContent,
    fit: (() => { const b = document.querySelector('#futread .cp-box').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight + 1; })() }));
  // 건물 하나 열기: Space → 커지는 연출(1.2초) → 읽기 창
  const openSpot = async (i) => {
    await near('futT' + i, 0, 0); await p.waitForTimeout(350); await space();
    const a = await st(), ms = await p.evaluate(() => __kk.FUT.anim ? __kk.FUT.anim.ms : 0);
    const ok = await waitMode('read', ms + 3000); await p.waitForTimeout(250);
    return { a, ms, ok };
  };
  const WORDS = [['경제 성장'], ['한강의기적'], [' 삶의 질 ', '빈부격차']];
  const ASK = [['경제성장'], ['한강의 기적'], ['삶의 질', '빈부 격차']];
  const ERA = ['1960년대', '1980년대', '2020년대'];
  const MONEY = ['120달러', '1,910달러', '38,020달러'];   // 11/25 세계 은행 최신 값으로 고침(1962·1980·2023)
  // 11/25 저녁: 기사 카드 2~3장을 넘기며 읽는다. 따라 쓸 낱말이 든 카드에서는 다 써야 [다음 기사]가 나온다
  const readSpot = async (i, tag, opt = {}) => {
    const o = await openSpot(i); const r0 = await rdState();
    check(o.a.mode === 'scene' && o.ms === 1200 && o.ok && r0.vis && r0.era.startsWith(ERA[i]) && r0.c === 0 && r0.rd.w === 0 && r0.nc >= 2 && r0.head,
      tag + ' ' + ERA[i] + ': Space → 연출 ' + o.ms + 'ms → 읽기 창 첫 기사 "' + r0.head + '" (기사 ' + r0.nc + '장)');
    let wi = 0, txt = '', seen = 0, wrongDone = !opt.wrong, imgs = 0, fits = 0;
    for (let k = 0; k < 30; k++) {
      await p.waitForTimeout(250);
      const r = await rdState();
      if (r.c + 1 > seen) { seen = r.c + 1; txt += r.txt; if (r.img) imgs++; if (r.fit) fits++; if (opt.shot) await snap('future-read-' + i + '-' + r.c); }
      if (r.askVis) {
        check(r.f === 'futread-in' && r.ask === '따라 써 보세요: ' + ASK[i][wi] && !r.nextVis && r.b.includes(ASK[i][wi]), tag + ' ' + ERA[i] + ' 기사 ' + (r.c + 1) + ': "' + r.ask + '", 칸 포커스, [다음 기사] 숨김');
        if (!wrongDone) {
          wrongDone = true;
          await p.fill('#futread-in', '경제발전');
          await p.evaluate(() => document.getElementById('futread-in').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true })));
          check(await p.evaluate(() => !document.getElementById('futread-in').classList.contains('bad') && __kk.FUT.rd.w === 0), tag + ' 조합 중 Enter는 판정 안 함');
          await p.keyboard.press('Enter'); await p.waitForTimeout(120);
          const rw = await rdState(), bad = await p.evaluate(() => document.getElementById('futread-in').classList.contains('bad'));
          check(bad && rw.rd.w === 0 && rw.read === i && rw.vis, tag + ' 틀리게 쓰면 칸 흔들림, 안 넘어감 (' + JSON.stringify({ bad, w: rw.rd.w, read: rw.read }) + ')');
          await p.waitForTimeout(350);
          await p.fill('#futread-in', '');
          const pv = await p.evaluate(() => { const el = document.getElementById('futread-in'); const e = new Event('paste', { bubbles: true, cancelable: true }); el.dispatchEvent(e); const d = new Event('drop', { bubbles: true, cancelable: true }); el.dispatchEvent(d); return { pd: e.defaultPrevented, dd: d.defaultPrevented, warn: document.getElementById('futread-warn').textContent, v: el.value }; });
          check(pv.pd && pv.dd && pv.warn.includes('붙여넣기') && pv.v === '', tag + ' 붙여넣기·끌어 놓기 막음 + 안내 (' + pv.warn + ')');
          const cx = await p.evaluate(() => __kk.S.x);
          await p.keyboard.down('ArrowRight'); await p.waitForTimeout(400); await p.keyboard.up('ArrowRight');
          check(await p.evaluate((x) => Math.abs(__kk.S.x - x) < 0.001 && __kk.S.mode === 'read' && __kk.FUT.rd.c >= 0, cx), tag + ' 읽기 창이 열린 동안 꼬꼬 안 움직임, 칸에서 → 눌러도 기사 안 넘어감');
        }
        await p.fill('#futread-in', WORDS[i][wi]); await p.keyboard.press('Enter'); wi++; await p.waitForTimeout(320);
        continue;
      }
      if (r.done) break;
      check(r.nextVis && r.f === 'futread-next', tag + ' 기사 ' + (r.c + 1) + ': 따라 쓸 것 없음 → [다음 기사] 포커스');
      if (r.c === 1 && opt.wrong) {   // ← 앞 기사로 갔다가 → 다시(버튼 포커스일 때만 방향키로 넘김)
        await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(200); const rb = await rdState();
        await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200); const rf = await rdState();
        check(rb.c === 0 && rf.c === 1, tag + ' ← 앞 기사, → 다시 (' + rb.c + '→' + rf.c + ')');
      }
      await p.keyboard.press('Enter');
    }
    check(txt.includes(MONEY[i]), tag + ' ' + ERA[i] + ' 기사 속 숫자 ' + MONEY[i]);
    check(imgs === seen && fits === seen, tag + ' ' + ERA[i] + ' 기사 ' + seen + '장 모두 사진 뜸(' + imgs + ')·창이 화면 안(' + fits + ')');
    const r1 = await rdState();
    check(r1.read === i + 1 && r1.done && r1.f === 'futread-done' && r1.vis && wi === WORDS[i].length, tag + ' 따라 쓰기 ' + WORDS[i].length + '개 맞힘(띄어쓰기 무시) → FUT.read ' + r1.read + ', 마지막 기사 [다 읽었어요] 포커스');
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const r2 = await rdState();
    check(!r2.vis && r2.mode === 'walk' && r2.rd === null, tag + ' [다 읽었어요] Enter → 창 닫히고 다시 걷기');
  };
  // 1) 1980을 먼저 누르면 잠김, 상자를 먼저 눌러도 잠김
  let lk = await lockTalk('futT1');
  check(lk.mode === 'talk' && !lk.anim && lk.t.includes('1960년대부터 차례로') && lk.read === 0, '1980년대 먼저 → 대사만 "' + lk.t + '"');
  lk = await lockTalk('futBox');
  check(lk.mode === 'talk' && !lk.cp && lk.t.includes('아직 읽지 않은 곳') && lk.t.includes('1960년대'), '상자 먼저 → 대사만 "' + lk.t + '"');
  // 2) 세 건물 차례로 읽고 따라 쓰기(첫 건물에서 틀린 입력·붙여넣기 확인)
  await readSpot(0, '1차', { wrong: true, shot: true });
  lk = await lockTalk('futBox');
  check(lk.t.includes('1980년대') && !lk.cp, '1960만 읽고 상자 → "' + lk.t + '"');
  lk = await lockTalk('futT2');
  check(lk.t.includes('1980년대부터') && !lk.anim, '1960만 읽고 2020 → "' + lk.t + '"');
  await readSpot(1, '1차'); await readSpot(2, '1차');
  // 다 읽은 건물은 다시 읽기만(따라 쓰기 칸 없이)
  await openSpot(0); s0 = await rdState();
  check(s0.vis && !s0.askVis && s0.nextVis && s0.f === 'futread-next' && s0.read === 3, '다 읽은 1960년대 다시 → 읽기만(따라 쓰기 칸 없이 [다음 기사]) (' + JSON.stringify({ ask: s0.askVis, read: s0.read }) + ')');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check(await p.evaluate(() => document.getElementById('futread').classList.contains('hide') && __kk.S.mode === 'walk' && __ex.mode === 'game' && __kk.FUT.read === 3), 'Esc → 읽기 창만 닫힘(수첩 안 열림)');
  // 3) 상자에서 일부러 틀림 → 창 닫히고 1960년대 앞으로, 읽은 기록 0
  await near('futBox', 0, 0); await p.waitForTimeout(350);
  const prB = await p.evaluate(() => document.querySelector('#labels .prompt').textContent);
  await space(); await p.waitForTimeout(400);
  s0 = await p.evaluate(() => ({ mode: __kk.S.mode, vis: !document.getElementById('cipher').classList.contains('hide'), f: document.activeElement && document.activeElement.id, v: document.getElementById('cipher-in').value, n: document.getElementById('cipher-n').textContent, rule: document.querySelector('#cipher .cp-rule').textContent }));
  check(prB.includes('암호') && s0.mode === 'cipher' && s0.vis && s0.f === 'cipher-in' && s0.v === '' && s0.n === '1 / 4' && s0.rule.includes('친구에게 묻지 말고'), '셋 다 읽고 상자 Space → 창 열림, 칸 포커스, "친구에게 묻지 말고" 한 줄 (' + JSON.stringify(s0) + ')');
  await p.fill('#cipher-in', '경제성장'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
  check(await p.evaluate(() => __kk.FUT.qi === 1), '암호 1 맞힘 → 2번째 문제');
  await p.fill('#cipher-in', '경제발전'); await p.keyboard.press('Enter'); await p.waitForTimeout(1300);
  s0 = await p.evaluate(() => ({ hid: document.getElementById('cipher').classList.contains('hide'), read: __kk.FUT.read, qi: __kk.FUT.qi, x: __kk.S.x, z: __kk.S.z, face: __kk.S.face, t0: { x: __kk.TH.futT0.x, z: __kk.TH.futT0.z }, cx: __kk.camera.position.x, mode: __kk.S.mode, t: document.getElementById('dlg-text').textContent }));
  check(s0.hid && s0.read === 0 && s0.qi === 0, '상자에서 틀림 → 창 닫힘, FUT.read·qi 0 (' + JSON.stringify({ read: s0.read, qi: s0.qi }) + ')');
  check(Math.abs(s0.x - s0.t0.x) < 0.01 && Math.abs(s0.z - s0.t0.z) < 0.01 && Math.abs(s0.face - Math.PI) < 0.01 && Math.abs(s0.cx - s0.x) < 4, '꼬꼬가 1960년대 건물 앞(간판 쪽)으로, 카메라도 따라옴 (x ' + s0.x.toFixed(2) + ', z ' + s0.z.toFixed(2) + ', 카메라 x ' + s0.cx.toFixed(2) + ')');
  check(s0.mode === 'talk' && s0.t.includes('1960년대부터 다시'), '틀린 뒤 대사 "' + s0.t + '"');
  await snap('future-back-1960'); await finishTalk();
  lk = await lockTalk('futT1');
  check(lk.t.includes('1960년대부터') && lk.read === 0, '돌아온 뒤 1980 → 다시 잠김');
  // 1960 열었다가 Esc → 안 끝난 걸로
  await openSpot(0); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check(await p.evaluate(() => __kk.FUT.read === 0 && __kk.S.mode === 'walk'), '따라 쓰기 중 Esc → 그 건물은 안 끝남 (FUT.read 0)');
  // 4) 다시 세 건물 → 상자 다 맞힘 → 미래 꼬꼬 변신
  await readSpot(0, '2차'); await readSpot(1, '2차'); await readSpot(2, '2차');
  await near('futBox', 0, 0); await p.waitForTimeout(350); await space(); await p.waitForTimeout(400);
  check(await p.evaluate(() => __kk.S.mode === 'cipher' && __kk.FUT.qi === 0 && document.getElementById('cipher-n').textContent === '1 / 4'), '다시 상자 → 1번 문제부터');
  const cx0 = await p.evaluate(() => __kk.S.x);
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight');
  check(await p.evaluate((x) => Math.abs(__kk.S.x - x) < 0.001 && __kk.S.mode === 'cipher', cx0), '암호 창이 열린 동안 꼬꼬 안 움직임');
  await p.fill('#cipher-in', '경제발전');
  await p.evaluate(() => document.getElementById('cipher-in').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true })));
  check(await p.evaluate(() => !document.getElementById('cipher').classList.contains('hide') && __kk.FUT.qi === 0 && __kk.FUT.read === 3), '암호 창 조합 중 Enter는 판정 안 함');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  s0 = await p.evaluate(() => ({ mode: __kk.S.mode, ex: __ex.mode, hid: document.getElementById('cipher').classList.contains('hide'), read: __kk.FUT.read }));
  check(s0.mode === 'walk' && s0.ex === 'game' && s0.hid && s0.read === 3, 'Esc → 암호 창만 닫힘(수첩 안 열림, 읽은 기록 그대로) (' + JSON.stringify(s0) + ')');
  await space(); await p.waitForTimeout(400);
  let cOk = true;
  for (const [i, a] of ['경제 성장', '한강의기적', ' 삶의 질 ', '빈부격차'].entries()) {
    await p.fill('#cipher-in', a); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
    const q = await p.evaluate(() => __kk.FUT.qi); if (q !== i + 1) { cOk = false; console.log('    암호', i + 1, '판정 실패', q); }
  }
  check(cOk, '암호 넷 다 맞힘(띄어쓰기 무시)');
  s0 = await p.evaluate(() => ({ hid: document.getElementById('cipher').classList.contains('hide'), done: __kk.FUT.done, bits: __kk.FUT.bits.length, mode: __kk.S.mode, act: __kk.FUT.anim && __kk.FUT.anim.act }));
  check(s0.hid && s0.done && s0.bits > 0 && s0.mode === 'scene' && s0.act === 'suit', '넷 다 맞히면 창 닫힘·상자 열림·꽃가루·변신 연출 시작 (' + JSON.stringify(s0) + ')');
  await p.waitForTimeout(1000);
  s0 = await p.evaluate(() => { const b = __kk.FUT.beam; return b ? { y: +b.scale.y.toFixed(2), op: +b.material.opacity.toFixed(2), add: b.material.blending } : null; });
  check(s0 && s0.y > 1 && s0.op > 0.1 && s0.add === 2, '상자에서 빛 기둥(더하기 섞기) (' + JSON.stringify(s0) + ')');
  await p.waitForTimeout(1300);
  s0 = await p.evaluate(() => ({ lift: __kk.FUT.lift, spin: __kk.FUT.spin, mode: __kk.S.mode }));
  await snap('future-suit-spin');
  check(s0.lift > 0.5 && s0.spin > 0 && s0.mode === 'scene', '꼬꼬가 떠올라 돌기 (높이 ' + s0.lift.toFixed(2) + ', 회전 ' + s0.spin.toFixed(2) + ')');
  check(await waitMode('talk', 3000), '변신 끝 → 대사');
  await p.waitForTimeout(800);
  s0 = await p.evaluate(() => { const U = __kk.FUT.suit; return { t: document.getElementById('dlg-text').textContent, suit: !!U, helm: !!U && U.helmet.parent === __kk.hero.parts.head, pack: !!U && U.pack.parent === __kk.hero.rig, lift: __kk.FUT.lift, spin: __kk.FUT.spin, beam: !!__kk.FUT.beam }; });
  check(s0.suit && s0.helm && s0.pack && s0.lift === 0 && s0.spin === 0 && !s0.beam && s0.t.includes('미래 꼬꼬'), '변신 뒤 헬멧은 머리, 제트팩은 몸에 붙음, 빛 기둥 치움 + "' + s0.t + '"');
  await snap('future-suit-after');
  await space(); await p.waitForTimeout(1200);
  s0 = await p.evaluate(() => ({ t: document.getElementById('dlg-text').textContent, key: __kk.FUT.key, verb: __kk.TH.futCar.verb }));
  check(s0.t.includes('자동차 열쇠') && s0.key === true && s0.verb.includes('타기'), '변신 대사 뒤 "' + s0.t + '", FUT.key ' + s0.key + ', 차 말풍선 "' + s0.verb + '"');
  await finishTalk(); s = await st();
  check(s.mode === 'walk' && await p.evaluate(() => __kk.FUT.lid.rotation.x < -1.5), '변신 뒤 다시 걷기, 상자 뚜껑 열림');
  // ── 자율 주행 한 바퀴(열쇠 받은 뒤): 길이 건물·소품을 뚫지 않는지 → 타기 → 몇 초 뒤 차가 움직임 → [내리기] → 걷기 ──
  s0 = await p.evaluate(() => {
    // 길 위 240점에서 차 크기(옆 ±0.55·앞뒤 ±1.0, 점마다 꼬꼬 반지름 0.36을 더함)로 충돌 상자를 잰다. 세워 둔 이 차 자기 상자는 뺀다
    const R = __kk.FUT.route, own = __kk.FUT.carCol, hits = []; own.off = true;
    const zones = { future: 0, village: 0, company: 0 };
    for (let i = 0; i <= 240; i++) {
      const u = i / 240, q = R.getPointAt(u), tg = R.getTangentAt(u), nx = -tg.z, nz = tg.x;
      zones[q.x < -23.4 ? 'future' : q.x < 21 ? 'village' : 'company']++;
      for (const [a, b] of [[0, 0], [0.55, 1.0], [-0.55, 1.0], [0.55, -1.0], [-0.55, -1.0], [0.55, 0], [-0.55, 0]]) {
        const x = q.x + nx * a + tg.x * b, z = q.z + nz * a + tg.z * b, c = __kk.blocked(x, z, 0);
        if (c) { hits.push([+x.toFixed(1), +z.toFixed(1), c.x.toFixed ? +c.x.toFixed(1) : c.x, c.z.toFixed ? +c.z.toFixed(1) : c.z]); break; }
      }
    }
    own.off = false;
    const a = R.getPointAt(0), b = R.getPointAt(1), c = __kk.FUT.car.g.position;
    return { len: +R.getLength().toFixed(1), hits: hits.slice(0, 6), nHit: hits.length, zones, maxX: Math.max(...R.getSpacedPoints(200).map((v) => v.x)), loop: Math.hypot(a.x - b.x, a.z - b.z) + Math.hypot(a.x - c.x, a.z - c.z) };
  });
  check(s0.nHit === 0, '자율 주행 길 240점 차 크기로 충돌 없음 (길이 ' + s0.len + ', 걸림 ' + s0.nHit + ' ' + JSON.stringify(s0.hits) + ')');
  check(s0.zones.future > 0 && s0.zones.village > 0 && s0.zones.company > 0 && s0.maxX > 30 && s0.loop < 0.01, '길: 미래 마을 → 꼬꼬네 마을 → 회사 앞(최대 x ' + s0.maxX.toFixed(1) + ') → 차 자리로 돌아옴 (' + JSON.stringify(s0.zones) + ')');
  const carAt = () => p.evaluate(() => ({ x: __kk.FUT.car.g.position.x, z: __kk.FUT.car.g.position.z, ry: __kk.FUT.car.g.rotation.y }));
  const parked = await carAt();
  const rideStart = async () => {
    await near('futCar', 0, 0); await p.waitForTimeout(350);
    const pr = await p.evaluate(() => { const e = document.querySelector('#labels .prompt'); return e.style.display === 'none' ? '' : e.textContent; });
    await space(); await p.waitForTimeout(300);
    return { pr, ...(await p.evaluate(() => ({ mode: __kk.S.mode, drive: __kk.FUT.drive, ms: __kk.FUT.anim && __kk.FUT.anim.ms, btn: !document.getElementById('fut-exit').classList.contains('hide') }))) };
  };
  const afterRide = () => p.evaluate(() => ({ mode: __kk.S.mode, drive: __kk.FUT.drive, anim: !!__kk.FUT.anim, vis: __kk.hero.root.visible, x: __kk.S.x, z: __kk.S.z, t: { x: __kk.TH.futCar.x, z: __kk.TH.futCar.z },
    btn: !document.getElementById('fut-exit').classList.contains('hide'), ex: window.__ex && __ex.mode, fade: document.getElementById('fade').classList.contains('on') }));
  const parkedOk = (a, c) => Math.abs(a.x - a.t.x) < 0.01 && Math.abs(a.z - a.t.z) < 0.01 && Math.abs(c.x - parked.x) < 0.01 && Math.abs(c.z - parked.z) < 0.01 && Math.abs(c.ry - parked.ry) < 0.001;
  let rs = await rideStart();
  check(rs.mode === 'scene' && rs.drive && rs.btn && rs.ms >= 20000 && rs.ms <= 30000 && rs.pr.includes('타기'), '열쇠 받은 뒤 차 타기 → 자율 주행 시작 (' + rs.ms + 'ms, [내리기] 보임, 말풍선 "' + rs.pr + '")');
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(2700); await p.keyboard.up('ArrowUp');   // 도는 동안 방향키는 안 먹는다
  s0 = await p.evaluate(() => ({ c: { x: __kk.FUT.car.g.position.x, z: __kk.FUT.car.g.position.z }, s: { x: __kk.S.x, z: __kk.S.z }, vis: __kk.hero.root.visible, mode: __kk.S.mode, cl: { x: __kk.camera.position.x, z: __kk.camera.position.z } }));
  const moved = Math.hypot(s0.c.x - parked.x, s0.c.z - parked.z);
  check(moved > 3 && !s0.vis && s0.mode === 'scene' && Math.hypot(s0.s.x - s0.c.x, s0.s.z - s0.c.z) < 0.01 && Math.abs(s0.cl.x - s0.c.x) < 6,
    '3초 뒤 차가 움직임 (' + moved.toFixed(1) + '칸, 꼬꼬는 차 안·숨김, 카메라 x ' + s0.cl.x.toFixed(1) + ' / 차 x ' + s0.c.x.toFixed(1) + ')');
  await p.waitForTimeout(2500);
  s0 = await p.evaluate(() => ({ x: __kk.FUT.car.g.position.x, b: document.getElementById('zone-banner').textContent }));
  await snap('future-drive');
  check(s0.x > -23.4, '5초쯤엔 꼬꼬네 마을로 들어섬 (차 x ' + s0.x.toFixed(1) + ', 구역 띠 "' + s0.b + '")');
  await p.click('#fut-exit'); await p.waitForTimeout(900);
  let ar = await afterRide(), ca = await carAt();
  check(ar.mode === 'walk' && !ar.drive && !ar.anim && ar.vis && !ar.btn && !ar.fade && parkedOk(ar, ca), '[내리기] → 차 자리에서 내려 걷기, 차도 제자리 (' + JSON.stringify({ mode: ar.mode, x: +ar.x.toFixed(2), z: +ar.z.toFixed(2) }) + ')');
  rs = await rideStart(); await p.waitForTimeout(1500);
  await p.keyboard.press('Escape'); await p.waitForTimeout(900);
  ar = await afterRide(); ca = await carAt();
  check(rs.drive && ar.mode === 'walk' && ar.ex === 'game' && !ar.drive && ar.vis && parkedOk(ar, ca), '주행 중 Esc → 내리기(수첩 안 열림) (' + ar.mode + '/' + ar.ex + ')');
  // 끝까지 돈 경우: 시간을 앞당겨 마지막 0.6초만 남기고 → 차 자리에 서고 저절로 내림
  rs = await rideStart(); await p.waitForTimeout(400);
  await p.evaluate(() => { const A = __kk.FUT.anim; A.t0 -= A.ms - 600; });
  await p.waitForTimeout(1200);
  ar = await afterRide(); ca = await carAt();
  check(rs.drive && ar.mode === 'walk' && !ar.drive && ar.vis && !ar.btn && parkedOk(ar, ca), '한 바퀴 끝 → 차 자리에 서고 꼬꼬 내려 걷기 (' + JSON.stringify({ mode: ar.mode, ry: +ca.ry.toFixed(3) }) + ')');
  // 헬멧이 이름표를 가리지 않게: 헬멧 꼭대기(안테나)가 이름표 높이(1.75)보다 낮아야
  s0 = await p.evaluate(() => { __kk.hero.root.updateMatrixWorld(true); const v = __kk.FUT.suit.helmet.children[2].getWorldPosition(__kk.camera.position.clone()); return +(v.y - __kk.hero.root.position.y).toFixed(2); });
  check(s0 < 1.7, '헬멧 꼭대기(' + s0 + ')가 이름표 높이(1.75)보다 낮음');
  // 점프: 조금 더 높이 + 제트팩 불꽃(점프 중에만)
  await tp(-35, 2.2); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__sj = { max: 0, fl: false }; const t0 = performance.now(); const f = () => { __sj.max = Math.max(__sj.max, __kk.J.z); if (__kk.FUT.suit.flames[0].visible) __sj.fl = true; if (performance.now() - t0 < 1600) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await p.keyboard.press('Space'); await p.waitForTimeout(1700);
  s0 = await p.evaluate(() => ({ max: +__sj.max.toFixed(2), fl: __sj.fl, now: __kk.FUT.suit.flames[0].visible, jz: __kk.J.z }));
  check(s0.max > 1.5 && s0.max < 2.2 && s0.fl && !s0.now && s0.jz === 0, '미래 꼬꼬 점프: 조금 더 높이(' + s0.max + ', 전 ≈1.29), 점프 중에만 제트팩 불꽃 (' + JSON.stringify(s0) + ')');
  air = await airRun(8, 150); airL = await airLand(15000);
  check(air.max > 2 && airL.done && airL.mode === 'walk' && air.max <= 25.01, '미래 꼬꼬도 날기·상한 그대로 (최고 ' + air.max + ')');
  await near('futBox', 0, 0); await p.waitForTimeout(350); await space(); await p.waitForTimeout(1000);
  check((await st()).mode === 'talk' && (await dlg()).includes('이미 열려'), '연 상자 다시 → "이미 열려 있어요"'); await finishTalk();
  check(JSON.stringify((await st()).ans) === ansAtSubmit && !JSON.stringify(await srvRow()).includes('경제'), '암호를 풀어도 답안·서버(스텁) 그대로');
  // 내 답 보기: Esc → 제출한 답은 읽기 전용, [답 고치기]만 보임, 글자·기호 안 바뀜
  const roRead = () => p.evaluate(() => [...document.querySelectorAll('#nb-qs input[data-i],#nb-qs textarea[data-i]')].every((e) => e.readOnly) && [...document.querySelectorAll('#nb-qs .sym')].every((e) => e.getAttribute('aria-disabled') === 'true'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(500); s = await st();
  check(s.ex === 'notebook', '돌아다니다 Esc → 내 답 수첩 (' + s.ex + ')'); await snap('roam-notebook'); await bandCheck('제출 뒤 수첩(읽기만)', false);
  check(await roRead() && await p.evaluate(() => document.getElementById('nb-submit').classList.contains('hide') && !document.getElementById('nb-edit').classList.contains('hide')), '제출한 답: 읽기 전용, [답 고치기] 보임·제출 버튼 숨김');
  await p.focus('#nb-qs textarea'); await p.keyboard.type('고침'); await p.waitForTimeout(200);
  check(JSON.stringify((await st()).ans) === ansAtSubmit, '읽기 전용 칸에 글자를 쳐도 답 그대로');
  await p.click('#nb-tabs button[data-t="0"]'); await p.waitForTimeout(150); await p.click('#n-a0s1', { force: true }); await p.waitForTimeout(150);
  check(JSON.stringify((await st()).ans) === ansAtSubmit, '읽기 전용 기호 버튼을 눌러도 그대로');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400); s = await st();
  check(s.ex === 'game' && s.mode === 'walk', 'Esc → 끝 화면 말고 다시 마을 (' + s.ex + '/' + s.mode + ')');
  // 답 고치기 → 다시 제출 (마감 전)
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await p.click('#nb-edit'); await p.waitForTimeout(600);
  check(await p.evaluate(() => __ex.S.editing && !document.getElementById('nb-submit').classList.contains('hide') && document.getElementById('nb-submit').textContent.includes('다시') && document.getElementById('nb-edit').classList.contains('hide')), '[답 고치기] → 고칠 수 있음, [다시 제출하기] 보임');
  await bandCheck('[답 고치기] 중', true);
  await p.click('#nb-tabs button[data-t="2"]'); await p.waitForTimeout(150);
  await p.click('#n-a8'); await p.keyboard.type(' 고침'); await p.waitForTimeout(150);
  await p.click('#nb-tabs button[data-t="0"]'); await p.waitForTimeout(150);
  await p.focus('#n-a1s0'); await p.keyboard.press('Space'); await p.waitForTimeout(150);
  check((await st()).ans[1] === 'ㄴㄹ', '수첩에서도 다른 줄 기호(㉠)는 안 켜짐 (' + (await st()).ans[1] + ')');
  await p.focus('#n-a1s3'); await p.keyboard.press('Space'); await p.waitForTimeout(150);
  s0 = (await st()).ans; check(s0[8] === '테스트 답 마 고침' && s0[1] === 'ㄴ', '고친 답 반영 (3번 나) 뒤 "' + s0[8] + '", 1번 기업 "' + s0[1] + '")');
  for (let i = 0; i < 40; i++) { const r = await srvRow(); if (r && r.answers[1] === 'ㄴ') break; await p.waitForTimeout(250); }
  check((await srvRow()).answers[1] === 'ㄴ', '고치는 중에도 자동 저장(5초 이내)');
  await p.waitForTimeout(1100);   // 제출 시각(분 단위)이 달라지는지는 보지 않고, 다시 제출 표시만 본다
  await p.click('#nb-submit'); await p.waitForTimeout(300);
  check(await p.evaluate(() => document.getElementById('ex-ask-msg').textContent.includes('다시 제출')), '다시 제출 확인 창');
  check(await p.evaluate(() => document.getElementById('ex-ask-msg').textContent.includes('1번 (1) 기업(두 개 골라요)')), '제출 빈칸 목록에 "1번 (1) 기업(두 개 골라요)"');
  await p.click('#ex-ask-yes'); await p.waitForTimeout(800);
  s0 = await srvRow(); s = await st();
  check(s.ex === 'notebook' && s0.submitted && s0.answers[8] === '테스트 답 마 고침' && await p.evaluate(() => !__ex.S.editing) && await roRead(), '다시 제출 → 서버에 고친 답·제출 표시, 수첩은 다시 읽기 전용');
  check(await p.evaluate(() => document.getElementById('ex-toast').textContent.includes('다시 제출')), '"다시 제출했어요" 알림');
  await bandCheck('다시 제출 뒤 수첩', false);
  const ansAfterEdit = JSON.stringify(s.ans);
  // 고치다가 다시 제출 안 하고 닫기 → 묻고 닫힘(고친 답은 저장)
  await p.click('#nb-edit'); await p.waitForTimeout(600);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check(await p.evaluate(() => !document.getElementById('ex-ask').classList.contains('hide') && document.getElementById('ex-ask-msg').textContent.includes('다시 제출하지')), '고치는 중 Esc → "아직 다시 제출하지 않았어요" 확인');
  await p.click('#ex-ask-yes'); await p.waitForTimeout(500); s = await st();
  check(s.ex === 'game' && s.mode === 'walk' && await p.evaluate(() => !__ex.S.editing), '확인 → 마을로, 고치기 끝');
  // 새로고침(마감 전): 끝 화면 말고 바로 돌아다니기, 수첩에서 고치기 가능
  await p.reload(); await p.waitForFunction(() => window.__kk && __kk.S.mode === 'start', null, { timeout: 90000 });
  await login(); await p.waitForTimeout(1200);
  s = await st(); check(s.sub && s.ex === 'game' && JSON.stringify(s.ans) === ansAfterEdit, '새로고침 → 끝 화면 없이 바로 돌아다니기, 제출 상태·답 그대로 (' + s.ex + ')');
  check(await p.evaluate(() => document.getElementById('ex-end').classList.contains('hide') && document.getElementById('ex-toast').textContent.includes('Esc')), '새로고침 뒤 안내: Esc로 수첩에서 고칠 수 있음');
  check(await p.evaluate(() => document.getElementById('pledge').classList.contains('hide') && __kk.S.mode !== 'pledge'), '제출 뒤 새로고침 → 판깔기 안 나옴');
  await roamChecks('새로고침 뒤'); await snap('roam-reload');
  s = await st(); check(s.x < -8 && !(await p.evaluate(() => __kk.S.room)) && await p.evaluate(() => !document.getElementById('hud').classList.contains('hide')), '새로고침 뒤 마을 입구에서 시작·HUD 보임 (x=' + s.x.toFixed(1) + ')');
  await near('meetDoor', 0, 0.6); await space(); await p.waitForTimeout(900);
  check(await p.evaluate(() => __kk.S.room === 'meet'), '새로고침 뒤에도 문 열림(회의실)');
  await near('fox', 0, 1.2); await p.waitForTimeout(300); await space(); await p.waitForTimeout(1500);
  s0 = await p.evaluate(() => document.getElementById('dlg-text').textContent);
  check(!s0.includes('빈자리') && s0.includes('수고'), '돌아다닐 때 회의실 여우도 제출 뒤 대사 (' + s0 + ')'); await finishTalk();
  // 선생님이 반을 마감: 수첩을 열면 읽기 전용 + "선생님이 마감했어요", 고치기·제출 없음, 저장도 거부
  await p.evaluate(() => __stub.setClosed('0', true));
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  check(await p.evaluate(() => __ex.S.closed && document.getElementById('nb-note').textContent.includes('선생님이 마감했어요') && document.getElementById('nb-edit').classList.contains('hide') && document.getElementById('nb-submit').classList.contains('hide')), '마감 뒤 수첩: "선생님이 마감했어요", 고치기·제출 버튼 없음');
  check(await roRead(), '마감 뒤 칸·기호 모두 읽기 전용'); await snap('closed-notebook');
  await p.focus('#nb-qs textarea, #nb-qs input'); await p.keyboard.type('마감뒤'); await p.waitForTimeout(200);
  check(JSON.stringify((await st()).ans) === ansAfterEdit, '마감 뒤 글자를 쳐도 답 그대로');
  check(await p.evaluate(() => document.getElementById('save-state').textContent === '마감됨'), 'HUD 저장 표시: 마감됨');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  // 마감 중 서버에 저장을 보내면 거부(스텁): 고치는 중에 마감된 경우
  s0 = await p.evaluate(() => new Promise((ok) => __ex.SRV.save({ ban: '0', num: '0', answers: ['x', '', '', '', '', '', '', '', ''], progress: 3 }, ok, ok)));
  check(s0 && s0.ok === false && s0.closed === true, '마감된 반 저장 → 서버(스텁)가 closed로 거부');
  check((await srvRow()).answers[0] === 'ㄱㄷ', '거부된 저장은 서버 답을 안 바꿈');
  // 마감 뒤 새로고침: 바로 돌아다니기, 수첩은 읽기 전용
  await p.reload(); await p.waitForFunction(() => window.__kk && __kk.S.mode === 'start', null, { timeout: 90000 });
  await login(); await p.waitForTimeout(1200);
  s = await st(); check(s.ex === 'game' && await p.evaluate(() => __ex.S.closed && __ex.roaming), '마감 뒤 새로고침 → 돌아다니기, 마감 상태');
  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  check(await roRead() && await p.evaluate(() => document.getElementById('nb-note').textContent.includes('선생님이 마감했어요')), '마감 뒤 새로고침 → 수첩 읽기 전용·마감 안내');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // 고치는 도중에 마감되면: 다음 저장에서 closed를 받고 바로 읽기 전용
  await p.evaluate(() => __stub.setClosed('0', false));
  await p.evaluate(() => { __ex.S.closed = false; });
  await p.keyboard.press('Escape'); await p.waitForTimeout(600); await p.click('#nb-edit'); await p.waitForTimeout(600);
  await p.evaluate(() => __stub.setClosed('0', true));
  await p.click('#nb-tabs button[data-t="1"]'); await p.waitForTimeout(150);
  await p.click('#n-a5'); await p.keyboard.type('!'); await p.waitForTimeout(200);
  await p.click('#nb-tabs button[data-t="0"]'); await p.waitForTimeout(1500);   // 칸을 떠나면 저장 → closed
  check(await p.evaluate(() => __ex.S.closed && !__ex.S.editing && document.getElementById('nb-note').textContent.includes('선생님이 마감했어요')), '고치는 중 마감 → 저장 거부 받고 바로 읽기 전용');
  check((await srvRow()).answers[5] === '테스트 답 나', '마감 뒤 고친 글자는 서버에 안 들어감');
  check(errs.length === 0, '콘솔 오류 없음 ' + errs.slice(0, 3).join(' | '));
  console.log(fails.length ? '실패 ' + fails.length : '모두 통과');
  await b.close(); process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
