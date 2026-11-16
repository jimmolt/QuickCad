// formulas: units inside expressions, plain math, formulas on angle dimensions
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
const tap = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(110); };
const rb = t => page.click(`#ribbon [data-k="${t}"]`);
const key = k => page.evaluate(k => QC.popKey(k), k);
const type = async s => { for (const ch of s.match(/mm|./g)) await key(ch); await page.waitForTimeout(60); await key('✓'); await page.waitForTimeout(150); };
const dims = () => page.evaluate(() => Object.entries(QC.S.dims).map(([i, d]) => i + ':' + d.t + '=' + (+d.v.toFixed(4)) + (d.expr ? '{' + d.expr + '}' : '') + (d.driven ? 'DRV' : '')).join(' '));
const dv = id => page.evaluate(id => QC.S.dims[id] && QC.S.dims[id].v, id);
const last = () => page.evaluate(() => Object.keys(QC.S.dims).at(-1));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const esc = () => page.click('#escBtn');
await rb('line'); await drag(0, 3, 3.2, 3); await esc(); await rb('line'); await drag(0, 4, 2.2, 4); await esc(); await rb('line'); await drag(0, 5, 1.3, 5); await esc(); await rb('line'); await drag(0, 6, 1.1, 6); await esc();
await rb('select');
await tap(1.5, 3); await type('3'); const dA = await last(); await esc(); await rb('select');
await tap(1, 4); await type(dA + '/2+5mm'); const dB = await last();
ok(Math.abs(await dv(dB) - (1.5 + 5 / 25.4)) < 1e-6, dB + ' = ' + dA + '/2+5mm -> ' + await dv(dB));
await esc(); await rb('select'); await tap(0.6, 5); await type('1+.5'); const dC = await last();
ok(Math.abs(await dv(dC) - 1.5) < 1e-6, 'plain math 1+.5 -> ' + await dv(dC) + ' (no formula kept: ' + !(await page.evaluate(id => QC.S.dims[id].expr, dC)) + ')');
await esc(); await rb('select'); await tap(0.5, 6); await type('25.4mm*2'); const dD = await last();
ok(Math.abs(await dv(dD) - 2) < 1e-6, '25.4mm*2 -> ' + await dv(dD));
// change the source: follower with units re-evaluates
await esc(); await page.evaluate(() => { QC.sel.length = 0; }); await rb('select'); await tap(1.5, 3); await page.waitForTimeout(120); await type('4');
ok(Math.abs(await dv(dB) - (2 + 5 / 25.4)) < 1e-6, 'after ' + dA + '=4, ' + dB + ' -> ' + await dv(dB));
console.log(await dims());
// angle formulas
await esc(); await rb('line'); await drag(6, 0, 9, 0); await esc(); await rb('line'); await drag(6, 0, 8, 1.4); await esc();
await rb('line'); await drag(6, 3, 9, 3); await esc(); await rb('line'); await drag(6, 3, 8, 5.2); await esc();
await rb('select'); await tap(8.5, 0); await tap(7.5, 1.05); await page.waitForTimeout(150);
console.log('popup', await page.evaluate(() => QC.popState && QC.popState.spec.title));
await type('30'); const aA = await last(); console.log('angle A', aA, await dv(aA), await page.evaluate(id => QC.S.dims[id].t, aA));
await esc(); await rb('select'); await tap(8.5, 3); await tap(7.5, 4.65); await page.waitForTimeout(150); await type(aA + '*2'); const aB = await last();
ok(await page.evaluate(id => QC.S.dims[id].t, aB) === 'ang' && Math.abs(await dv(aB) - 60) < 1e-6, 'angle ' + aB + ' = ' + aA + '*2 -> ' + await dv(aB));
const angOf = () => page.evaluate(() => { const E = Object.values(QC.S.ents).filter(e => e.t === 'line').slice(-2), P = QC.S.pts, a = (e) => Math.atan2(P[e.b].y - P[e.a].y, P[e.b].x - P[e.a].x) * 180 / Math.PI; return Math.abs(a(E[1]) - a(E[0])); });
console.log('measured angle of pair B', +(await angOf()).toFixed(3));
// change angle A -> B follows
await esc(); await page.evaluate(() => { QC.sel.length = 0; });
const lab = await page.evaluate(() => Object.fromEntries(Object.entries(QC.labelRects).map(([k, r]) => [k, [r.x + r.w / 2, r.y + r.h / 2]])));
await page.mouse.move(box.x + lab[aA][0], box.y + lab[aA][1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(80); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200);
await type('25');
ok(Math.abs(await dv(aA) - 25) < 1e-6 && Math.abs(await dv(aB) - 50) < 1e-6, 'angle A=25 -> B=' + await dv(aB) + ', measured ' + (+(await angOf()).toFixed(3)));
// an angle formula that would reach 180 is refused cleanly
console.log(await dims());
console.log(errs.join('\n') || 'no page errors'); await browser.close();
