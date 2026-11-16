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
const dims = () => page.evaluate(() => Object.entries(QC.S.dims).map(([i, d]) => i + ':' + d.t + '=' + (+d.v.toFixed(4)) + (d.expr ? '{' + d.expr + '}' : '') + (d.driven ? 'DRV' : '')).join(' '));
// rectangle in a circle-in-square setup: square 3x3, circle inside; dim circle center to left edge (1") and to right edge; make right = formula of left
await rb('rect'); await drag(0, 0, 3, 3); await page.click('#escBtn');
await rb('circle'); await drag(1, 1.5, 1.4, 1.5); await page.click('#escBtn');
// Dimension: center to left edge
await rb('select');
await tap(1, 1.5); await tap(0, 1.4); await page.waitForTimeout(150);   // center + left edge -> pld popup
console.log('popup1', await page.evaluate(() => document.querySelector('#pop .ttl') && document.querySelector('#pop .ttl').textContent.slice(0, 30)));
await key('✓'); await page.waitForTimeout(150);   // accept measured 1.000
// center to right edge
await tap(1, 1.5); await tap(3, 1.4); await page.waitForTimeout(150);
console.log('dims', await dims());
// type formula: tap the first dimension's label to insert ref, then /2? No - set equal-ish: d of left dim
const dimIds = await page.evaluate(() => Object.keys(QC.S.dims));
// insert ref via popRefInsert path: tap the other dim label on canvas
const lab = await page.evaluate(() => Object.fromEntries(Object.entries(QC.labelRects).map(([k, r]) => [k, [r.x + r.w / 2, r.y + r.h / 2]])));
const other = dimIds[0], pos = lab[other];
await page.mouse.move(box.x + pos[0], box.y + pos[1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200);
console.log('field now', await page.evaluate(() => QC.popState ? QC.popState.vals[0] : 'no pop'));
await key('+'); await key('.'); await key('5'); await page.waitForTimeout(100);
console.log('preview field', await page.evaluate(() => QC.popState && QC.popState.vals[0]));
await key('✓'); await page.waitForTimeout(200);
console.log('after formula OK', await dims());
// change d-left to 0.75 -> follower should become 1.25
await tap(0.75, 1.5); await page.waitForTimeout(50); // clear sel (tap circle center region off) hmm: select the first dim label instead
await page.evaluate(() => { QC.sel.length = 0; });
const lab2 = await page.evaluate(() => Object.fromEntries(Object.entries(QC.labelRects).map(([k, r]) => [k, [r.x + r.w / 2, r.y + r.h / 2]])));
const p1 = lab2[other];
await page.mouse.move(box.x + p1[0], box.y + p1[1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(120);
await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(250);   // double tap opens popup
console.log('popup2', await page.evaluate(() => document.querySelector('#pop .ttl') && document.querySelector('#pop .ttl').textContent.slice(0, 26)));
await key('.'); await key('7'); await key('5'); await key('✓'); await page.waitForTimeout(250);
console.log('after source change', await dims());
// driven: dimension the circle center to the TOP edge? instead add a redundant one: distance center-to-left AGAIN exists; add center-to-bottom then center-to-top => over? Use simpler: dim between left and right edges (width 3) exists via rect dims? Rect has none. Add line length on top edge = 3 (ok), then bottom edge length -> redundant -> driven
await page.evaluate(() => { QC.sel.length = 0; });
await tap(1.5, 3); await page.waitForTimeout(150); await key('✓'); await page.waitForTimeout(150);          // top edge length 3 (drives)
await tap(1.5, 0); await page.waitForTimeout(150); await key('✓'); await page.waitForTimeout(250);          // bottom edge -> redundant -> driven
console.log('after redundant len', await dims());
console.log('toast', await page.evaluate(() => document.querySelector('#toast').textContent));
// drag right edge? geometry locked except... check driven updates: change top edge to 2.5 -> driven should read 2.5
await page.evaluate(() => { QC.sel.length = 0; });
const topLen = await page.evaluate(() => { for (const [i, d] of Object.entries(QC.S.dims)) if (d.t === 'len' && !d.driven) return i; });
const lab3 = await page.evaluate(() => Object.fromEntries(Object.entries(QC.labelRects).map(([k, r]) => [k, [r.x + r.w / 2, r.y + r.h / 2]])));
const p3 = lab3[topLen];
await page.mouse.move(box.x + p3[0], box.y + p3[1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(120);
await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(250);
await key('2'); await key('.'); await key('5'); await key('✓'); await page.waitForTimeout(250);
console.log('after top=2.5 (driven follows)', await dims());
await page.screenshot({ path: 'fx.png' });
console.log(errs.join('\n') || 'no page errors'); await browser.close();
