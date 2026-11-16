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
const mv = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.waitForTimeout(60); };
const snapk = () => page.evaluate(() => { const c = QC.cur; return c ? c.kind + (c.dir ? ':' + c.dir.kind : '') : null; });
const sk = () => page.evaluate(() => JSON.stringify({ n: Object.values(QC.S.ents).filter(e => !e.con).length, cons: Object.values(QC.S.cons).map(c => c.t).join(',') }));
await rb('circle'); await tap(2, 2); await tap(3, 2);                 // circle r=1 centre (2,2)
await rb('line'); await tap(6, 0); await tap(6, 3); await page.click('#escBtn');   // vertical line x=6
await rb('line'); await tap(0, 0); await tap(5, 0); await page.click('#escBtn');   // base line y=0
const res = {};
await rb('line'); await tap(4, 3.5);                                   // start point above/right of circle
await mv(2.55, 1.3); res.tan = await snapk();                          // near tangent point of circle?
await mv(4, 0); res.perp = await snapk();                              // foot of perpendicular on y=0 -> (4,0)
await mv(6, 1.5); res.perpOrMid = await snapk();
await mv(3, 0.003 + 0); res.t3 = await snapk();
await page.click('#escBtn');
await rb('line'); await mv(6, 0); res.endpt = await snapk(); await page.click('#escBtn');
await rb('line'); await mv(2, 3); res.quad = await snapk(); await mv(2.5, 0); res.mid = await snapk(); await page.click('#escBtn');
await rb('line'); await mv(2.9, 0.003); res.on = await snapk(); await page.click('#escBtn');
console.log(JSON.stringify(res));
// real tangent line: start at (4,3.5) to the circle tangent point computed in page
const tp = await page.evaluate(() => { const r = { x: 4, y: 3.5 }, C = { x: 2, y: 2, r: 1 }, dx = r.x - C.x, dy = r.y - C.y, d = Math.hypot(dx, dy), al = Math.atan2(dy, dx), be = Math.acos(C.r / d); return [C.x + C.r * Math.cos(al + be), C.y + C.r * Math.sin(al + be)]; });
await rb('line'); await tap(4, 3.5); await mv(...tp); console.log('tan snap', await snapk()); await tap(...tp); await page.click('#escBtn');
console.log('after tangent', await sk(), await page.evaluate(() => QC.dof));
await rb('line'); await tap(4.2, 2.8); await mv(4.2, 0); console.log('perp snap', await snapk()); await tap(4.2, 0); await page.click('#escBtn');
console.log('after perp', await sk(), await page.evaluate(() => QC.dof));
await page.screenshot({ path: 'sn1.png' });
console.log(errs.join('\n') || 'no page errors'); await browser.close();
