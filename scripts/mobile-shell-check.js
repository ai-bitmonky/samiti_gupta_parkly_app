/* PARKLY · mobile shell check (Playwright, 390×844 iPhone UA + one 1440×900 desktop check). Exit code 1 on any failure or console error. */
/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script, run outside Next */
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
// Usage: npm run build && npx next start -p 3100 &  then  node scripts/mobile-shell-check.js [baseUrl] [shotDir]
// Needs playwright (PLAYWRIGHT_PATH or /opt/npm-tools/node_modules/playwright) and a chromium build.
const BASE = process.argv[2] || 'http://localhost:3100';
const OUT = process.argv[3] || require('os').tmpdir() + '/parkly-mobile-shots';
require('fs').mkdirSync(OUT, { recursive: true });
const S = (n) => `${OUT}/${n}.png`;
const errors = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const cls = (sel) => p.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.className), sel);
  const path = () => new URL(p.url()).pathname;

  await p.goto(BASE + '/explore');
  await p.waitForSelector('main.screen[data-name=welcome]');
  ok(path() === '/welcome', 'onboarding gate redirects to /welcome (' + path() + ')');
  await p.screenshot({ path: S('01-welcome') });

  await p.getByRole('button', { name: 'Find parking' }).click();
  await p.waitForTimeout(60);
  const pushCls = await cls('main.screen');
  ok(pushCls.some((c) => c.includes('nav-push-in')) , 'welcome → explore push-in: ' + JSON.stringify(pushCls));
  await p.waitForTimeout(500);
  ok(path() === '/explore', 'on /explore');
  ok((await cls('main.screen')).length === 1, 'old layer removed after animation');
  await p.waitForTimeout(800);
  await p.screenshot({ path: S('02-explore') });
  const tb = await p.evaluate(() => { const t = document.querySelector('.tabbar'); const cs = getComputedStyle(t); return { bf: cs.backdropFilter || cs.webkitBackdropFilter, tr: cs.transform, on: document.querySelector('.tab.is-on')?.textContent, dev: document.querySelector('.device').className }; });
  ok(tb.on === 'Explore' && !tb.dev.includes('no-tabbar') && /blur/.test(tb.bf), 'tab bar visible, blurred, Explore lit ' + JSON.stringify(tb));

  // collapse large title
  await p.evaluate(() => document.querySelector('main.screen').scrollTo(0, 300));
  await p.waitForTimeout(250);
  ok((await cls('.topbar'))[0].includes('is-collapsed'), 'large title collapses on scroll');
  await p.screenshot({ path: S('03-explore-scrolled') });
  await p.evaluate(() => document.querySelector('main.screen').scrollTo(0, 0));

  // tab switching
  await p.click('.tab[aria-label=Bookings]');
  await p.waitForTimeout(60);
  const tabCls = await cls('main.screen');
  ok(tabCls.some((c) => c.includes('nav-tab-in')), 'tab switch nav-tab-in ' + JSON.stringify(tabCls));
  await p.waitForTimeout(450);
  ok(path() === '/bookings' && (await p.textContent('.tab.is-on')).includes('Bookings'), 'on /bookings with tab lit');
  const badge = await p.$eval('.tab[aria-label=Bookings] .tab-badge', (e) => e.textContent).catch(() => null);
  console.log('  bookings badge:', badge);
  await p.screenshot({ path: S('04-bookings') });
  await p.click('.tab[aria-label=Explore]');
  await p.waitForTimeout(500);

  // push to facility
  const fid = await p.$eval('.rcard', (e) => e.dataset.fid);
  await p.click('.rcard .rcard-media');
  await p.waitForTimeout(100);
  const c1 = await cls('main.screen');
  ok(c1.some((c) => c.includes('nav-push-out')) && c1.some((c) => c.includes('nav-push-in')), 'push to /parking: ' + JSON.stringify(c1));
  await p.screenshot({ path: S('05-push-mid') });
  await p.waitForTimeout(450);
  ok(path() === '/parking/' + fid, 'on ' + path());
  ok(await p.$eval('.device', (e) => e.classList.contains('no-tabbar')), 'tab bar hidden on pushed screen');
  // the facility screen uses the overlay top bar (glass back button over the hero), like the prototype
  ok(!!(await p.$('.topbar.is-overlay .glass-btn[aria-label=Back]')), 'overlay back button on the facility hero');
  await p.screenshot({ path: S('06-parking') });

  // back button → pop
  await p.click('.glass-btn[aria-label=Back]');
  await p.waitForTimeout(120);
  const c2 = await cls('main.screen');
  ok(c2.some((c) => c.includes('nav-pop-out')) && c2.some((c) => c.includes('nav-pop-in')), 'pop back: ' + JSON.stringify(c2));
  await p.waitForTimeout(450);
  ok(path() === '/explore', 'back on /explore');

  // push again then edge swipe back
  await p.click('.rcard .rcard-media');
  await p.waitForTimeout(500);
  ok(path() === '/parking/' + fid, 'pushed again');
  const edge = await p.$eval('.edge-swipe', (e) => !e.hidden);
  ok(edge, 'edge-swipe zone active');
  await p.mouse.move(6, 420); await p.mouse.down();
  for (let x = 6; x <= 200; x += 12) { await p.mouse.move(x, 425); await p.waitForTimeout(16); }
  const mid = await p.evaluate(() => [...document.querySelectorAll('main.screen')].map((e) => ({ n: e.dataset.name, c: e.className, t: e.style.transform, f: e.style.filter })));
  ok(mid.length === 2 && mid[0].c.includes('is-under') && mid[1].c.includes('is-swiping'), 'live under-layer during swipe ' + JSON.stringify(mid));
  await p.screenshot({ path: S('07-swipe-mid') });
  for (let x = 200; x <= 260; x += 12) { await p.mouse.move(x, 425); await p.waitForTimeout(16); }
  await p.mouse.up();
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => [...document.querySelectorAll('main.screen')].map((e) => ({ n: e.dataset.name, c: e.className, t: e.style.transform })));
  ok(path() === '/explore' && after.length === 1 && after[0].n === 'explore' && !after[0].c.includes('is-under') && !after[0].t, 'swipe adopted explore ' + JSON.stringify(after));
  await p.screenshot({ path: S('08-after-swipe') });

  // swipe cancel
  await p.click('.rcard .rcard-media');
  await p.waitForTimeout(500);
  await p.mouse.move(6, 420); await p.mouse.down();
  for (let x = 6; x <= 60; x += 6) { await p.mouse.move(x, 425); await p.waitForTimeout(40); }
  await p.waitForTimeout(200); await p.mouse.move(62, 425); await p.mouse.up();
  await p.waitForTimeout(600);
  const canc = await p.evaluate(() => [...document.querySelectorAll('main.screen')].map((e) => ({ n: e.dataset.name, c: e.className, t: e.style.transform })));
  ok(path().startsWith('/parking') && canc.length === 1 && !canc[0].t, 'short swipe settles back ' + JSON.stringify(canc));
  // deep back via PARENT: reload on parking (stack of 1)
  await p.reload(); await p.waitForSelector('main.screen[data-name=parking]'); await p.waitForTimeout(300);
  await p.click('.glass-btn[aria-label=Back]'); await p.waitForTimeout(500);
  ok(path() === '/explore', 'deep link back → PARENT /explore');

  // time sheet open + drag close
  await p.click('.when');
  await p.waitForSelector('.overlay-sheet .wheel');
  await p.waitForTimeout(500);
  await p.screenshot({ path: S('09-timesheet') });
  const wh = await p.evaluate(() => { const col = document.querySelectorAll('.wcol')[1]; const i = Math.round(col.scrollTop / 40); const its = col.querySelectorAll('.w-it'); return { i, sel: its[i].style.transform, next: its[i + 1] && its[i + 1].style.transform, thumb: document.querySelector('.overlay .seg-thumb').style.width }; });
  ok(/rotateX\((-)?0deg\)/.test(wh.sel), 'wheel selected row flat ' + JSON.stringify(wh));
  // wheel scroll changes time
  const before = await p.textContent('.sheet-foot .btn');
  await p.evaluate(() => { const col = document.querySelectorAll('.wcol')[1]; col.scrollTop += 80; });
  await p.waitForTimeout(400);
  // switch to daily
  await p.click('.overlay .seg button:nth-of-type(2)');
  await p.waitForTimeout(400);
  const foot = await p.textContent('.sheet-foot .btn');
  ok(/day/.test(foot), 'daily mode changes CTA: ' + before + ' → ' + foot);
  await p.screenshot({ path: S('10-timesheet-daily') });
  const grip = await p.$('.sheet-grip-hit');
  const gb = await grip.boundingBox();
  await p.mouse.move(gb.x + gb.width / 2, gb.y + 5); await p.mouse.down();
  for (let y = 0; y <= 320; y += 20) { await p.mouse.move(gb.x + gb.width / 2, gb.y + 5 + y); await p.waitForTimeout(16); }
  await p.screenshot({ path: S('11-sheet-drag') });
  await p.mouse.up();
  await p.waitForTimeout(500);
  ok((await p.$$('.overlay')).length === 0, 'drag down closes the sheet');
  // small drag settles back
  await p.click('.when'); await p.waitForSelector('.overlay-sheet .wheel'); await p.waitForTimeout(450);
  const g2 = await (await p.$('.sheet-grip-hit')).boundingBox();
  await p.mouse.move(g2.x + 20, g2.y + 5); await p.mouse.down();
  for (let y = 0; y <= 40; y += 4) { await p.mouse.move(g2.x + 20, g2.y + 5 + y); await p.waitForTimeout(30); }
  await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(400);
  ok((await p.$$('.overlay')).length === 1, 'small drag keeps the sheet open');
  // back() closes the top sheet first
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok((await p.$$('.overlay')).length === 0, 'Esc closes sheet');

  // filter + sort + dest sheets open without errors
  for (const sel of ['.filter-row .chip:nth-child(1)', '.filter-row .chip:nth-child(2)', '.searchbar']) {
    await p.click(sel); await p.waitForSelector('.overlay-sheet'); await p.waitForTimeout(400);
    await p.screenshot({ path: S('12-' + sel.replace(/[^a-z0-9]/gi, '')) });
    await p.click('.overlay-backdrop', { position: { x: 20, y: 20 } }); await p.waitForTimeout(400);
  }
  // heart + compare tray
  await p.click('.rcard .cmp-toggle'); await p.waitForTimeout(300);
  ok(await p.$eval('.floating', (e) => !e.hidden), 'compare tray appears');
  await p.screenshot({ path: S('13-tray') });
  await p.click('.floating .btn-ghost'); await p.waitForTimeout(200);
  ok(await p.$eval('.floating', (e) => e.hidden), 'tray clears');

  // pull to refresh (touch via CDP)
  await p.evaluate(() => document.querySelector('main.screen').scrollTo(0, 0)); // pull only starts at the top
  await p.waitForTimeout(200);
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }] });
  await touch('touchStart', 200);
  for (let y = 200; y <= 400; y += 10) { await touch('touchMove', y); await p.waitForTimeout(16); }
  const pulling = (await cls('main.screen'))[0];
  await p.screenshot({ path: S('14-pull') });
  await touch('touchEnd', 400);
  await p.waitForTimeout(150);
  const refreshing = (await cls('main.screen'))[0];
  ok(pulling.includes('is-pulling') && refreshing.includes('is-refreshing') && (await p.$$('.sk-card')).length > 0, 'pull to refresh: ' + pulling + ' / ' + refreshing);
  await p.screenshot({ path: S('15-refreshing') });
  await p.waitForTimeout(1300);
  ok((await p.$$('.sk-card')).length === 0 && (await p.textContent('.toast-host')).includes('refreshed'), 'refresh done + toast');

  // reduced motion: no anim classes
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.click('.rcard .rcard-media'); await p.waitForTimeout(40);
  const rmc = await cls('main.screen');
  ok(rmc.length === 1 && !rmc[0].includes('nav-'), 'reduced motion: no transition ' + JSON.stringify(rmc));
  await p.emulateMedia({ reducedMotion: 'no-preference' });

  // horizontal overflow
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(ov <= 0, 'no horizontal overflow (' + ov + ')');

  // desktop
  const dctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await dctx.newPage();
  d.on('console', (m) => { if (m.type() === 'error') errors.push('desktop: ' + m.text()); });
  d.on('pageerror', (e) => errors.push('desktop pageerror: ' + e.message));
  await d.goto(BASE + '/explore'); await d.waitForTimeout(1500);
  ok(!!(await d.$('aside.sidebar')) && !(await d.$('.device')) && !(await d.$('nav.tabbar')), 'desktop renders sidebar, no mobile shell');
  await d.screenshot({ path: S('20-desktop') });
  // live resize desktop → mobile → desktop
  await d.setViewportSize({ width: 600, height: 900 }); await d.waitForTimeout(600);
  const m1 = !!(await d.$('.device main.screen'));
  await d.setViewportSize({ width: 1440, height: 900 }); await d.waitForTimeout(600);
  ok(m1 && !(await d.$('.device')) && (await d.evaluate(() => document.body.className)) === 'd', 'live resize switches shell both ways (not onboarded → /welcome → desktop landing)');

  console.log('console errors/warnings:', errors.length ? errors : 'none');
  if (errors.length) process.exitCode = 1;
  await b.close();
})();
