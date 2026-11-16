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
const info = () => page.evaluate(() => ({ mode: QC.mode, feats: QC.part.feats.map(f => f.name + (f.type === 'sketch' ? (f.vis === false ? '[hid]' : f.vis === true ? '[vis]' : '') : '')).join(','), holes: QC.model && QC.model.holes ? QC.model.holes.length : null, toast: document.querySelector('#toast').textContent, lines3d: 0 }));
const p3 = (x, y) => page.evaluate(([x, y]) => { const T = THREE, v = new T.Vector3(x, y, QC.part.t).project(QC.G3.cam); const r = document.querySelector('#gl').getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, [x, y]);
const tap3 = async (x, y) => { const [sx, sy] = await p3(x, y); await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200); };
const fl = () => page.evaluate(() => ({ feats: QC.part.feats.map(f => f.name).join(','), flanges: QC.model.flanges.length, warn: QC.model.warn, bb: QC.model.bb, area: +QC.model.area.toFixed(4), panel: !!document.querySelector('#flpanel'), note: (document.querySelector('#flpanel .note') || {}).textContent, toast: document.querySelector('#toast').textContent }));
await rb('rect'); await drag(0, 0, 6, 3.5);
await page.click('.tab[data-tab="sm"]'); await rb('face'); await tap(2, 1.5); await page.click('.tgrid button:has-text("16ga")'); await page.waitForTimeout(200);
await rb('flange'); await page.waitForTimeout(200);
await page.mouse.move(600, 500); const [hx, hy] = await p3(3, 3.5); await page.mouse.move(hx, hy); await page.waitForTimeout(200); await page.screenshot({ path: 'f0.png' });
await tap3(3, 3.5); console.log('flange on top edge', JSON.stringify(await fl())); await page.screenshot({ path: 'f1.png' });
// change angle & distance via panel inputs
const set = async (idx, v) => { const i = page.locator('#flpanel input').nth(idx); await i.fill(v); await i.dispatchEvent('change'); await page.waitForTimeout(150); };
await set(0, '2'); console.log('dist 2', JSON.stringify(await fl()));
await set(1, '45'); console.log('angle 45', JSON.stringify(await fl())); await page.screenshot({ path: 'f2.png' });
await set(1, '90');
await page.click('#flpanel .sb button:has-text("Down")'); await page.waitForTimeout(150); await page.screenshot({ path: 'f3.png' });
await page.click('#flpanel .sb button:has-text("Up")');
// 2nd flange on right edge (tap again on 3D)
await page.click('#flpanel .btnrow button:has-text("Done")');
await tap3(6, 1.75); console.log('flange on right edge', JSON.stringify(await fl()));
await page.click('#flpanel .btnrow button:has-text("Done")');
// tap existing flange edge reopens
await tap3(3, 3.5); console.log('reopen', await page.evaluate(() => document.querySelector('#flpanel b').textContent));
// DXF
const d = await page.evaluate(() => { const r = QC.dxfText('CUT', QC.flatGeoms()); return { n: r.count, bb: r.bbox, text: r.text }; });
(await import('node:fs')).writeFileSync('flange.dxf', d.text); console.log('dxf', d.n, JSON.stringify(d.bb));
// too short
await set(0, '0.05'); console.log('too short', JSON.stringify(await fl()));
await set(0, '2'); await page.click('#flpanel .btnrow button:has-text("Delete")'); console.log('deleted', JSON.stringify(await fl()));
await rb('flange'); await page.evaluate(() => QC.undo()); console.log('undo', JSON.stringify(await fl()));
console.log(errs.join('\n') || 'no page errors'); await browser.close();
