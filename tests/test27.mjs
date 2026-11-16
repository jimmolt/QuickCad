import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await page.goto('file:///home/claude/qc/dist/index.html'); await page.waitForFunction(() => window.QC && QC.solver === 'ok');
const box = await page.locator('#cv').boundingBox();
const W = async (x, y) => { const [sx, sy] = await page.evaluate(([x, y]) => QC.w2s(x, y), [x, y]); return [box.x + sx, box.y + sy]; };
const drag = async (x1, y1, x2, y2) => { const a = await W(x1, y1), b = await W(x2, y2); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); };
const tap = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(90); };
const rb = t => page.click(`#ribbon [data-k="${t}"]`);
const key = k => page.evaluate(k => QC.popKey(k), k);
const dims = () => page.evaluate(() => Object.values(QC.S.dims).map(d => d.t + ':' + (+d.v.toFixed(4))).join(' '));
// two lines meeting at a diagonal: endpoints (0,0) and (3,1.75) free points via two unconnected line ends
await rb('line'); await tap(0, 0); await tap(-2, -1); await page.click('#escBtn');
await rb('line'); await tap(3, 1.75); await tap(5, 3); await page.click('#escBtn');
// Dimension mode: pick the two near endpoints
await rb('select');
await tap(0, 0); await tap(3, 1.75); await page.waitForTimeout(150);
console.log('placing?', await page.evaluate(() => !!QC.dimPlace), 'hint', (await page.evaluate(() => document.querySelector('#status').textContent)).slice(0, 40));
// drop BELOW the pair -> horizontal
await tap(1.5, -1.2); await page.waitForTimeout(200);
console.log('dims after drop below', await dims(), 'popup', await page.evaluate(() => !!document.querySelector('#pop.on')));
await key('2'); await key('✓'); await page.waitForTimeout(200);
console.log('typed 2 ->', await dims(), await page.evaluate(() => { const a = QC.S.pts; const ids = Object.values(QC.S.dims)[0]; const p = a[ids.p], q = a[ids.q]; return 'dx=' + (q.x - p.x).toFixed(3); }));
// second pair: drop to the RIGHT -> vertical
await page.click('#escBtn'); await rb('select');
await tap(2, 1.75); await page.waitForTimeout(120); // reselect pts: first point at (2,?) hmm tap the moved endpoint
const pt2 = await page.evaluate(() => { const d = Object.values(QC.S.dims)[0]; return [QC.S.pts[d.p], QC.S.pts[d.q]].map(p => [+p.x.toFixed(3), +p.y.toFixed(3)]); });
console.log('pts now', JSON.stringify(pt2));
await page.evaluate(() => { QC.sel.length = 0; });
await tap(pt2[0][0], pt2[0][1]); await tap(pt2[1][0], pt2[1][1]); await page.waitForTimeout(120);
await tap(pt2[1][0] + 1.5, (pt2[0][1] + pt2[1][1]) / 2); await page.waitForTimeout(200);
console.log('dims after drop right', await dims());
await key('1'); await key('✓'); await page.waitForTimeout(200);
// third: drop past the far corner -> aligned
const pt3 = await page.evaluate(() => { const d = Object.values(QC.S.dims)[0]; return [QC.S.pts[d.p], QC.S.pts[d.q]].map(p => [+p.x.toFixed(3), +p.y.toFixed(3)]); });
await page.evaluate(() => { QC.sel.length = 0; });
await tap(pt3[0][0], pt3[0][1]); await tap(pt3[1][0], pt3[1][1]); await page.waitForTimeout(120);
await tap(pt3[1][0] + 0.8, pt3[1][1] + 0.8); await page.waitForTimeout(200);
console.log('dims after corner drop', await dims());
await page.screenshot({ path: 'pl.png' });
console.log(errs.join('\n') || 'no page errors'); await browser.close();
