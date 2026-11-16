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
await rb('rect'); await drag(0, 0, 6, 3.5);
await page.click('.tab[data-tab="sm"]'); await rb('face'); await tap(2, 1.5); await page.click('.tgrid button:has-text("16ga")'); await page.waitForTimeout(200);
console.log('face', JSON.stringify(await info()));
// Jim's flow: new sketch, draw, Finish, then Cut from the 3D view
await page.evaluate(() => QC.setSelFace && QC.mode === 'model' && QC.setSelFace('top')); await rb('newsk'); await page.waitForFunction(() => QC.mode === 'sketch'); box = await page.locator('#cv').boundingBox(); await rb('circle'); await drag(2, 1.5, 2.4, 1.5); await rb('rect'); await drag(3.5, 1, 5, 2.5);
await rb('finish'); await page.waitForTimeout(300);
console.log('finished (sketch visible in 3D)', JSON.stringify(await info())); await page.screenshot({ path: 'v1.png' });
await rb('cut'); await page.waitForTimeout(300);
console.log('cut from 3D', JSON.stringify(await info()));
// toggle visibility of Sketch2 back on
await page.click('#browser .row:has-text("Sketch2") .eye'); await page.waitForTimeout(200); console.log('eye on', JSON.stringify(await info()));
await page.click('#browser .row:has-text("Sketch2") .eye'); await page.waitForTimeout(200); console.log('eye off', JSON.stringify(await info()));
// open-shape sketch can't be cut: clear message
await page.evaluate(() => QC.setSelFace && QC.mode === 'model' && QC.setSelFace('top')); await rb('newsk'); await page.waitForFunction(() => QC.mode === 'sketch'); box = await page.locator('#cv').boundingBox(); await rb('line'); await drag(0.5, 0.5, 1.5, 0.5); await rb('finish'); await rb('cut');
console.log('open shape', JSON.stringify(await info()));
await page.evaluate(() => QC.undo()); console.log('undo ok', (await info()).feats);
console.log(errs.join('\n') || 'no page errors'); await browser.close();
