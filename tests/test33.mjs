// 3D Model tab: Extrude with push/pull arrow (no dialog), extrude into the part = cut, sketch on any flat face, revolve
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.goto('file:///home/claude/qc/dist/index.html'); await page.waitForFunction(() => window.QC && QC.solver === 'ok' && QC.mf === 'ok');
let box = await page.locator('#cv').boundingBox();
const W = async (x, y) => { const [sx, sy] = await page.evaluate(([x, y]) => QC.w2s(x, y), [x, y]); return [box.x + sx, box.y + sy]; };
const drag = async (x1, y1, x2, y2) => { const a = await W(x1, y1), b = await W(x2, y2); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); };
const tap = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(120); };
const rb = t => page.click(`#ribbon [data-k="${t}"]`);
const toastT = () => page.evaluate(() => document.querySelector('#toast').textContent);
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const vol = () => page.evaluate(() => QC.model && QC.model.vol);
const scr = p => page.evaluate(p => { const r = document.querySelector('#gl').getBoundingClientRect(), v = new THREE.Vector3(...p).project(QC.G3.cam); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, p);
const click3 = async p => { const [x, y] = await scr(p); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(250); };
const pull = async dist => { const q = await page.evaluate(dist => { const h = QC.G3.handles[0]; return [h.grab, [h.grab[0] + h.d[0] * dist, h.grab[1] + h.d[1] * dist, h.grab[2] + h.d[2] * dist]]; }, dist); const a = await scr(q[0]), b = await scr(q[1]);
  await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 5 }); await page.mouse.move(...b, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(300); };
// 1. base: 4 x 3 rectangle, Extrude -> no dialog, arrow + bar, default 1 in
await rb('rect'); await drag(0, 0, 4, 3); await page.click('#escBtn'); await rb('finish');
await page.click('.tab[data-tab="3d"]'); await page.screenshot({ path: 'ex0.png', clip: { x: 0, y: 0, width: 1180, height: 180 } });
await rb('extrude'); await page.waitForFunction(() => QC.mode === 'model'); await page.waitForTimeout(300);
ok(await page.evaluate(() => !document.querySelector('#modal.on') && !!document.querySelector('#exbar') && QC.G3.handles.length === 1), 'Extrude: single profile auto-picked, no dialog, arrow + bar shown');
ok(Math.abs(await vol() - 12) < 1e-4, 'default 1 in -> volume ' + await vol());
await pull(1); ok(Math.abs(await vol() - 24) < 1e-4, 'arrow pulled +1 -> 2 in tall, volume ' + await vol() + ', bar reads ' + await page.inputValue('#exbar input'));
await page.fill('#exbar input', '1.5'); await page.press('#exbar input', 'Enter'); await page.waitForTimeout(250); ok(Math.abs(await vol() - 18) < 1e-4, 'typed 1.5 in the bar -> ' + await vol());
await page.click('#exbar button.pri'); ok(await page.evaluate(() => !QC.exActive), 'OK closes the bar');
await page.screenshot({ path: 'ex1.png' });
// 2. sketch on top (double-tap), circle, extrude INTO the part = cut pocket
await click3([2, 1.5, 1.5]); ok(!!(await page.evaluate(() => QC.selFace && QC.selFace.pl && QC.selFace.pl.n)), 'top face selected ' + JSON.stringify(await page.evaluate(() => QC.selFace.pl.n)) + ' cap=' + await page.evaluate(() => QC.selFace.cap));
await rb('newsk'); await page.waitForFunction(() => QC.mode === 'sketch'); await page.waitForTimeout(250); box = await page.locator('#cv').boundingBox();
await rb('circle'); await drag(1, 1.5, 1.5, 1.5); await page.click('#escBtn'); await rb('finish'); await page.waitForTimeout(250);
await rb('extrude'); await page.waitForTimeout(700); const v0 = await vol();
ok(Math.abs(v0 - (18 + Math.PI * 0.25 * 1.5)) < 0.01, 'second extrude starts as a boss at the last distance (join): ' + v0);
console.log('view', await page.evaluate(() => [QC.G3.az, QC.G3.el, QC.G3.handles.length, JSON.stringify(QC.G3.handles[0] && QC.G3.handles[0].grab)])); await page.screenshot({ path: 'ex2a.png' }); console.log('dbg', await page.evaluate(() => { const h = QC.G3.handles[0], r = document.querySelector('#gl').getBoundingClientRect(), v = new THREE.Vector3(...h.grab).project(QC.G3.cam), px = (v.x + 1) / 2 * r.width, py = (1 - v.y) / 2 * r.height; const ha = QC.handleAt(px, py); const st = ha && QC.handleStart(ha, px, py); const el = document.elementFromPoint(r.left + px, r.top + py); return JSON.stringify({ cls: document.querySelector('#stage').className, kids: [...document.querySelector('#stage').children].map(c => (c.id || c.className) + ':' + getComputedStyle(c).display + ':' + getComputedStyle(c).pointerEvents + ':' + getComputedStyle(c).zIndex).join(' | '), mode: QC.mode, px, py, ha: !!ha, st: st && [st.s0, st.v0], el: el && (el.id || el.className || el.tagName) }); })); await pull(-2); const v1 = await vol(), X2 = await page.evaluate(() => { const X = QC.solidFeats()[1]; return [X.d, QC.model.ops[X.id].op]; });
ok(X2[1] === 'cut' && Math.abs(X2[0] + 0.5) < 1e-6 && Math.abs(v1 - (18 - Math.PI * 0.25 * 0.5)) < 0.01, 'pushed into the part -> cut 0.5 deep pocket ' + JSON.stringify(X2) + ' vol ' + v1);
await page.screenshot({ path: 'ex2.png' });
await page.click('#exbar [data-thru]'); await page.waitForTimeout(250); ok(Math.abs(await vol() - (18 - Math.PI * 0.25 * 1.5)) < 0.01, 'Through all -> ' + await vol());
await page.click('#exbar [data-thru]'); await page.click('#exbar button.pri');
// 3. sketch on a SIDE face, rectangle, pull out = boss; base height change keeps the top sketch on the top
await page.evaluate(() => { QC.G3.az = -Math.PI / 2 + 0.4; QC.G3.el = 0.3; }); await page.waitForTimeout(300);
await click3([2, 0, 0.75]); const sn = await page.evaluate(() => QC.selFace && QC.selFace.pl && QC.selFace.pl.n); ok(sn && Math.abs(sn[1] + 1) < 1e-6, 'front side face selected ' + JSON.stringify(sn));
await rb('newsk'); await page.waitForFunction(() => QC.mode === 'sketch'); await page.waitForTimeout(250); box = await page.locator('#cv').boundingBox();
const fr = await page.evaluate(() => QC.skFrame(QC.part.feats.at(-1))); console.log('side frame', JSON.stringify(fr));
await rb('rect'); await drag(1, 0.25, 2, 1.0); await page.click('#escBtn'); await page.screenshot({ path: 'ex3.png' }); await rb('finish'); await page.waitForTimeout(250);
await rb('extrude'); await page.waitForTimeout(700); const v2 = await vol();
ok(Math.abs(v2 - (18 - Math.PI * 0.25 * 0.5 + 0.375)) < 0.01, 'side boss 1 x 0.75 x 0.5 joined: ' + v2); await page.click('#exbar button.pri');
await page.evaluate(() => { QC.solidFeats()[0].d = 2; QC.regen(); }); await page.waitForTimeout(200);
ok(Math.abs(await vol() - (24 - Math.PI * 0.25 * 0.5 + 0.375)) < 0.01, 'base made 2 in tall: pocket sketch followed the top face, vol ' + await vol());
await page.screenshot({ path: 'ex4.png' });
// 4. undo / redo, sheet metal tools refused, browser tap reopens the bar
const hi = await page.evaluate(() => QC.hi); await page.click('#undoBtn'); await page.waitForTimeout(200); await page.click('#redoBtn'); await page.waitForTimeout(200); ok(await page.evaluate(() => QC.hi) === hi && await page.evaluate(() => QC.solidFeats().length) === 3, 'undo/redo keeps 3 features');
await page.click('.tab[data-tab="sm"]'); await rb('face'); ok(/sheet metal tool/.test(await toastT()), 'Face refused on a solid'); await page.click('.tab[data-tab="3d"]');
await page.click('#browser .row:has-text("Extrusion2")'); await page.waitForTimeout(250); ok(await page.evaluate(() => !!document.querySelector('#exbar') && QC.G3.handles.length === 1), 'tapping Extrusion2 in the browser reopens its arrow'); await page.click('#escBtn');
// 5. save / load round trip
const vb = await vol(), saved = await page.evaluate(() => JSON.stringify(QC.part)); await page.evaluate(s => QC.loadPart(JSON.parse(s)), saved); await page.waitForTimeout(300); ok(Math.abs(await vol() - vb) < 1e-9, 'save / load gives the same solid ' + vb);
// 6. revolve on a new part
await page.evaluate(() => QC.loadPart(QC.newPart())); await page.waitForTimeout(300); box = await page.locator('#cv').boundingBox();
await rb('rect'); await drag(1, 0, 2, 3); await page.click('#escBtn'); await rb('constr'); await rb('line'); await drag(0, -0.5, 0, 3.5); await page.click('#escBtn'); await rb('constr'); await rb('finish');
await page.click('.tab[data-tab="3d"]'); await rb('revolve'); await page.waitForTimeout(400);
const rv = await vol(); ok(Math.abs(rv - Math.PI * (4 - 1) * 3) / (Math.PI * 9) < 0.01, 'revolve 1x3 rectangle about the construction line: ' + rv + ' (ring = ' + (Math.PI * 9).toFixed(3) + ') ' + JSON.stringify(await page.evaluate(() => QC.model.warn)));
await page.screenshot({ path: 'ex5.png' });
// 7. two shapes in one sketch: tap picks the profile; inner circle stays a hole; tapping the circle afterwards adds it
await page.evaluate(() => QC.loadPart(QC.newPart())); await page.waitForTimeout(300); box = await page.locator('#cv').boundingBox();
await rb('rect'); await drag(0, 0, 4, 3); await page.click('#escBtn'); await rb('circle'); await drag(1, 1.5, 1.5, 1.5); await page.click('#escBtn');
await page.click('.tab[data-tab="3d"]'); await rb('extrude'); console.log('pick toast:', await toastT()); await tap(3, 2); await page.waitForFunction(() => QC.mode === 'model'); await page.waitForTimeout(600);
ok(Math.abs(await vol() - (12 - Math.PI * 0.25) * 0.5) < 0.01, 'rectangle picked, circle left as a hole: ' + await vol());
await click3([1, 1.5, 0]); ok(Math.abs(await vol() - 6) < 0.01, 'tapping the circle adds it to the profile: ' + await vol());
await page.click('#exbar button:has-text("Delete")'); await page.waitForTimeout(300); ok(await page.evaluate(() => !QC.part.solid && QC.mode === 'sketch' && QC.part.feats.length === 1), 'Delete returns to the bare sketch (Face or Extrude can be chosen again)');
console.log(errs.join('\n') || 'no page errors'); await browser.close();
