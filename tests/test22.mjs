import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await page.goto('file:///home/claude/qc/dist/index.html'); await page.waitForFunction(() => window.QC && QC.solver === 'ok');
let box = await page.locator('#cv').boundingBox();
const W = async (x, y) => { const [sx, sy] = await page.evaluate(([x, y]) => QC.w2s(x, y), [x, y]); return [box.x + sx, box.y + sy]; };
const drag = async (x1, y1, x2, y2) => { const a = await W(x1, y1), b = await W(x2, y2); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); };
const tap = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.up(); };
const rb = t => page.click(`#ribbon [data-k="${t}"]`);
const info = () => page.evaluate(() => ({ mode: QC.mode, feats: QC.part.feats.map(f => f.name + (f.type === 'sketch' ? (f.vis === false ? '[hid]' : f.vis === true ? '[vis]' : '') : '')).join(','), holes: QC.model && QC.model.holes ? QC.model.holes.length : null, toast: document.querySelector('#toast').textContent, lines3d: QC.G3.grp ? QC.G3.grp.children.length : 0 }));
const p3 = (x, y) => page.evaluate(([x, y]) => { const T = THREE, v = new T.Vector3(x, y, QC.part.t).project(QC.G3.cam); const r = document.querySelector('#gl').getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, [x, y]);
const tap3 = async (x, y) => { const [sx, sy] = await p3(x, y); await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200); };
const tipPt = (which, idx) => page.evaluate(([which, idx]) => { const T = THREE, f = QC.model.flanges[idx]; const C = QC.edgeCorners(f, which); const P = [0, 1, 2].map(k => (C[0][k] + C[1][k]) / 2 + (C[3][k] - C[0][k]) / 2); const v = new T.Vector3(...P).project(QC.G3.cam); const r = document.querySelector('#gl').getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, [which, idx]);
await rb('rect'); await drag(0, 0, 8, 3.5);
await page.click('.tab[data-tab="sm"]'); await rb('face'); await tap(0.5, 0.4); await page.click('.tgrid button:has-text("16ga")'); await page.waitForTimeout(200);
await tap3(7, 3); await rb('newsk'); await page.waitForTimeout(300); box = await page.locator('#cv').boundingBox();
// slot from (2,1.75) to (6,1.75) width ~1, plus lines ending on its corner points and crossing it
await rb('slot'); await tap(2, 1.75); await tap(6, 1.75); await tap(6, 2.25); await page.click('#escBtn');
await rb('line'); await tap(3, 2.29); await tap(3.6, 3.2); await tap(4.4, 2.29); await page.click('#escBtn');   // triangle sitting just above the slot, ends 0.04 short
await rb('line'); await tap(2.3, 1.2); await tap(2.9, 0.4); await tap(3.6, 1.21); await page.click('#escBtn');   // triangle below
console.log('old loops', await page.evaluate(() => QC.sketchLoops(QC.S).loops.length), 'regions', await page.evaluate(() => JSON.stringify(QC.cutRegions(QC.S).map(l => [+l.area.toFixed(3), l.segs.map(g => g.t[0]).join('')]))));
await rb('finish'); await page.waitForTimeout(300); await rb('cut');
await tap3(3.6, 2.7); await tap3(2.9, 0.9); await tap3(5.5, 1.75); await page.waitForTimeout(200); await page.screenshot({ path: 'r22a.png' });
console.log('picked', await page.evaluate(() => document.querySelector('#cutbar .n').textContent)); await rb('cut'); await page.waitForTimeout(300);
console.log('result', await page.evaluate(() => JSON.stringify({ holes: QC.model.holes.map(h => [+h.area.toFixed(3), h.segs.map(g => g.t[0]).join('')]), warn: QC.model.warn })));
await page.screenshot({ path: 'r22b.png' });
const d = await page.evaluate(() => { const r = QC.dxfText('CUT', QC.flatGeoms()); return { n: r.count, text: r.text }; }); (await import('node:fs')).writeFileSync('reg22.dxf', d.text); console.log('dxf', d.n);
console.log(errs.join('\n') || 'no page errors'); await browser.close();
