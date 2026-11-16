import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await page.goto('file:///home/claude/qc/dist/index.html'); await page.waitForFunction(() => window.QC && QC.solver === 'ok');
let box = await page.locator('#cv').boundingBox();
const W = async (x, y) => { const [sx, sy] = await page.evaluate(([x, y]) => QC.w2s(x, y), [x, y]); return [box.x + sx, box.y + sy]; };
const drag = async (x1, y1, x2, y2) => { const a = await W(x1, y1), b = await W(x2, y2); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); };
const tap = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(60); };
const rb = t => page.click(`#ribbon [data-k="${t}"]`);
const esc = () => page.click('#escBtn');
const st = () => page.evaluate(() => ({ pts: Object.keys(QC.S.pts).length, ents: Object.values(QC.S.ents).map(e => e.t[0] + (e.con ? 'c' : '')).join(''), cons: Object.values(QC.S.cons).map(c => c.t).join(','), dims: Object.values(QC.S.dims).map(d => d.t + ':' + d.v.toFixed(3) + (d.g ? '=' : '')).join(' '), dof: document.querySelector('#dof').textContent }));
// --- long-press menu on Rectangle: hold, slide down onto 'From center'
let r = await page.locator('#ribbon [data-k="rect"]').boundingBox();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.waitForTimeout(500);
const mi = await page.locator('.varmenu .vi').allTextContents(); console.log('menu', mi);
const it = await page.locator('.varmenu .vi').nth(1).boundingBox(); await page.mouse.move(it.x + 20, it.y + it.height / 2, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(150);
console.log('tool', await page.evaluate(() => QC.tool && QC.tool.name), await page.evaluate(() => document.querySelector('#hint').textContent));
await tap(0, 0); await tap(2, 1); console.log('rect from center', await st()); await esc();
// --- circle 2 point and 3 point
r = await page.locator('#ribbon [data-k="circle"]').boundingBox();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.waitForTimeout(500);
await page.mouse.move(r.x + 20, (await page.locator('.varmenu .vi').nth(1).boundingBox()).y + 10, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(150);
await tap(-1, -0.5); await tap(1, -0.5); console.log('circle 2pt', await st()); await esc();
r = await page.locator('#ribbon [data-k="circle"]').boundingBox();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.waitForTimeout(500);
await page.mouse.move(r.x + 20, (await page.locator('.varmenu .vi').nth(2).boundingBox()).y + 10, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(150);
await tap(-3, -2); await tap(-2, -3); await tap(-1, -2); console.log('circle 3pt', await st()); await esc();
// --- midpoint constraint: circle center vertically under the midpoint of the rectangle's top edge
await page.evaluate(() => { QC.newSketch && 0; });
await rb('rect'); await rb('rect'); // toggles tool off/on; then ensure corner style
r = await page.locator('#ribbon [data-k="rect"]').boundingBox();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.waitForTimeout(500);
await page.mouse.move(r.x + 20, (await page.locator('.varmenu .vi').nth(0).boundingBox()).y + 10, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(150);
await drag(3, 1, 7, 4); await esc();
await rb('circle'); await esc();
r = await page.locator('#ribbon [data-k="circle"]').boundingBox();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.waitForTimeout(500);
await page.mouse.move(r.x + 20, (await page.locator('.varmenu .vi').nth(0).boundingBox()).y + 10, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(150);
await tap(5.3, 2.2); await tap(5.6, 2.2); await esc();
console.log('before', await st());
await rb('ver'); await tap(5.3, 2.2); await tap(5, 4); await page.waitForTimeout(200); console.log('after vertical to midpoint', await st());
console.log('circle center x', await page.evaluate(() => { const e = Object.values(QC.S.ents).find(e => e.t === 'circle'); return +QC.S.pts[e.c].x.toFixed(4); })); await esc();
// --- equal dimensions: circle in the rectangle, distance to left edge and to right edge
await rb('select'); await page.waitForTimeout(100);
console.log('errs so far', errs.length);
console.log(errs.join('\n') || 'no page errors'); await page.screenshot({ path: 'v24.png' }); await browser.close();
