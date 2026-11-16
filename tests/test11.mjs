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
// ---- sketch fillet + chamfer on a rectangle
await rb('rect'); await drag(0, 0, 6, 3.5);
await page.click('.tab[data-tab="sketch"]').catch(() => {});
const sk = () => page.evaluate(() => ({ ents: Object.values(QC.S.ents).filter(e => !e.con).map(e => e.t).join(','), dof: QC.dof, dims: Object.values(QC.S.dims).map(d => d.t + ':' + (+d.v).toFixed(4)).join(' ') }));
console.log('rect', JSON.stringify(await sk()));
await rb('fillet'); await tap(6, 3.5); await page.waitForTimeout(300);
console.log('fillet', JSON.stringify(await sk()), 'pop', await page.evaluate(() => document.querySelector('#pop') && document.querySelector('#pop').textContent.slice(0, 40)));
await page.screenshot({ path: 'fc1.png' });
await page.keyboard.press('Escape');
// type radius 0.5 via API
await page.evaluate(() => { const id = Object.keys(QC.S.dims).find(k => QC.S.dims[k].t === 'rad'); QC.sel = [{ k: 'd', id }]; QC.showSelPop(); });
await page.waitForTimeout(100); await page.evaluate(() => { const f = document.querySelectorAll('#pop .fld')[0]; f && f.click(); });
for (const k of ['.', '5', '✓']) await page.evaluate(k => QC.popKey(k), k);
await page.waitForTimeout(200); console.log('radius .5', JSON.stringify(await sk()));
await rb('chamfer'); await tap(0, 0); await page.waitForTimeout(300);
console.log('chamfer', JSON.stringify(await sk())); await page.screenshot({ path: 'fc2.png' });
// drag-resize the rectangle width dimension? change overall width via dims: check loops still closed
console.log('loops', await page.evaluate(() => QC.findLoops(QC.dxfGeoms ? QC.dxfGeoms() : []).loops.length));
console.log(errs.join('\n') || 'no page errors'); await browser.close();
