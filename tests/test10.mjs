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
const st = () => page.evaluate(() => ({ feats: QC.part.feats.map(f => f.name + (f.parent ? '<' + QC.part.feats.find(x => x.id === f.parent).name : '')).join(','), n: QC.model.flanges.length, warn: QC.model.warn, bb: QC.model.bb, bends: QC.model.bends.length }));
await rb('rect'); await drag(0, 0, 6, 3.5);
await page.click('.tab[data-tab="sm"]'); await rb('face'); await tap(2, 1.5); await page.click('.tgrid button:has-text("16ga")'); await page.waitForTimeout(200);
await rb('flange'); await tap3(3, 3.5); await page.click('#flpanel .btnrow button:has-text("Done")');
const set = async (idx, v) => { const i = page.locator('#flpanel input').nth(idx); await i.fill(v); await i.dispatchEvent('change'); await page.waitForTimeout(150); };
// side edge s0, then tip, then s1 of flange 1
for (const w of ['s0', 'tip', 's1']) { const [x, y] = await tipPt(w, 0); await page.mouse.move(x, y); await page.waitForTimeout(150); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300); await set(0, '0.6'); await page.click('#flpanel .btnrow button:has-text("Done")'); console.log(w, JSON.stringify(await st())); }
await page.screenshot({ path: 'sd1.png' });
// reopen side flange by tapping again
const [x2, y2] = await tipPt('s0', 0); await page.mouse.move(x2, y2); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(250); console.log('reopen', await page.evaluate(() => document.querySelector('#flpanel b').textContent)); await page.click('#flpanel .btnrow button:has-text("Done")');
await rb('flange'); await rb('flat'); await page.waitForTimeout(300); await page.screenshot({ path: 'sd2.png' });
const d = await page.evaluate(() => { const r = QC.dxfText('CUT', QC.flatGeoms()); return { n: r.count, bb: r.bbox, text: r.text }; });
(await import('node:fs')).writeFileSync('side.dxf', d.text); console.log('dxf', d.n, JSON.stringify(d.bb));
console.log(errs.join('\n') || 'no page errors'); await browser.close();
