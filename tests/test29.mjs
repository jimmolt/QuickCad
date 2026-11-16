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
const tap = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(90); };
const rb = t => page.click(`#ribbon [data-k="${t}"]`);
const key = k => page.evaluate(k => QC.popKey(k), k);
const type = async s => { for (const ch of s) await key(ch); await key('✓'); };
const dims = () => page.evaluate(() => Object.entries(QC.S.dims).map(([i, d]) => i + ':' + d.t + '=' + (+d.v.toFixed(3)) + (d.expr ? '{' + d.expr + '}' : '') + (d.g ? '=G' : '') + (d.driven ? 'DRV' : '')).join(' '));
// Jim's case: rect 2.5 wide (fixed), circle between the edges at 1.5 / 1.0; link -> both 1.25
await rb('rect'); await drag(0, 0, 2.5, 3); await page.click('#escBtn');
await rb('select'); await tap(0.7, 3); await page.waitForTimeout(120); await type('2.5');   // width driven by top edge length
await page.click('#escBtn'); await rb('circle'); await drag(1.5, 1.5, 1.7, 1.5); await page.click('#escBtn');
await rb('select');
await tap(1.5, 1.5); await tap(0, 2.2); await page.waitForTimeout(150); await key('✓'); await page.waitForTimeout(150);   // center to left edge = 1.5 (measured)
console.log('1', await dims());
await tap(1.5, 1.5); await tap(2.5, 2.2); await page.waitForTimeout(150);                                                 // center to right edge -> popup (measured 1.0)
console.log('2 popup', await page.evaluate(() => QC.popState && QC.popState.spec.title.slice(0, 30)));
// tap the first distance dim's label -> plain ref -> preview should AVERAGE both to 1.25
const first = await page.evaluate(() => { for (const [i, d] of Object.entries(QC.S.dims)) if (d.t === 'pld') return i; });
const lab = await page.evaluate(() => Object.fromEntries(Object.entries(QC.labelRects).map(([k, r]) => [k, [r.x + r.w / 2, r.y + r.h / 2]])));
await page.mouse.move(box.x + lab[first][0], box.y + lab[first][1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(250);
console.log('3 field', await page.evaluate(() => String(QC.popState.vals[0])), '| preview', await dims());
await key('✓'); await page.waitForTimeout(250);
console.log('4 after OK', await dims());
console.log('center x', await page.evaluate(() => { const e = Object.values(QC.S.ents).find(e => e.t === 'circle'); return +QC.S.pts[e.c].x.toFixed(4); }));
// typing into either should set both (type 1.0 into the first)
await page.evaluate(() => { QC.sel.length = 0; });
const lab2 = await page.evaluate(() => Object.fromEntries(Object.entries(QC.labelRects).map(([k, r]) => [k, [r.x + r.w / 2, r.y + r.h / 2]])));
await page.mouse.move(box.x + lab2[first][0], box.y + lab2[first][1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200);
await type('1');
console.log('5 typed 1 into one', await dims(), 'center x', await page.evaluate(() => { const e = Object.values(QC.S.ents).find(e => e.t === 'circle'); return +QC.S.pts[e.c].x.toFixed(4); }));
console.log(errs.join('\n') || 'no page errors'); await browser.close();
