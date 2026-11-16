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
const sk = () => page.evaluate(() => ({ lines: Object.values(QC.S.ents).filter(e => e.t === 'line').length, cons: Object.values(QC.S.cons).map(c => c.t).join(','), pts: Object.keys(QC.S.pts).length, tool: document.querySelector('#ribbon .on') ? [...document.querySelectorAll('#ribbon .on')].map(b => b.dataset.k).join('+') : '' }));
// chained line
await rb('line'); await tap(0, 0); await tap(3, 0); await tap(3, 2); console.log('chain', JSON.stringify(await sk()));
await page.click('#escBtn'); console.log('esc', JSON.stringify(await sk()));
// two loose lines + parallel via tool, coincident via tool
await rb('line'); await tap(5, 0.2); await tap(7, 0.9); await page.click('#escBtn');
await rb('line'); await tap(5, 2); await tap(7.5, 2.4); await page.click('#escBtn');
await rb('par'); console.log('par armed', JSON.stringify(await sk()));
await tap(6, 0.55); await tap(6.25, 2.2); await page.waitForTimeout(150); console.log('par done', JSON.stringify(await sk()));
await rb('coi'); await tap(5, 2); await tap(7, 0.9); await page.waitForTimeout(150); console.log('coi pts', JSON.stringify(await sk()));
await page.screenshot({ path: 'k1.png' });
await page.click('#escBtn');
// undo the extra lines so the profile is an open L
for (let i = 0; i < 4; i++) await page.click('#undoBtn');
console.log('after undo', JSON.stringify(await sk()));
await rb('finish'); await page.waitForTimeout(150); console.log('finish tab', await page.evaluate(() => document.querySelector('.tab.on').dataset.tab), await page.evaluate(() => document.querySelector('#toast').textContent));
await rb('contour'); await page.click('.tgrid button:has-text("16ga")'); await page.waitForTimeout(400);
console.log('contour', await page.evaluate(() => JSON.stringify({ mode: QC.mode, bb: QC.model.bb, bends: QC.model.bends.map(b => [+b.x1.toFixed(4), b.lay]), note: document.querySelector('#flpanel .note').textContent, err: QC.model.err })));
await page.screenshot({ path: 'k2.png' });
await page.click('#flpanel .btnrow button:has-text("Done")'); await rb('flat'); await page.waitForTimeout(300); await page.screenshot({ path: 'k3.png' });
const d = await page.evaluate(() => { const r = QC.dxfText('CUT', QC.flatGeoms()); return { n: r.count, bb: r.bbox }; }); console.log('dxf', JSON.stringify(d));
console.log(errs.join('\n') || 'no page errors'); await browser.close();
