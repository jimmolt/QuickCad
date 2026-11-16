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
const tap = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(80); };
const tapS = async (sx, sy) => { await page.mouse.move(box.x + sx, box.y + sy); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(80); };
const rb = t => page.click(`#ribbon [data-k="${t}"]`);
const esc = () => page.click('#escBtn');
const info = () => page.evaluate(() => ({ dims: Object.entries(QC.S.dims).map(([i, d]) => i + ':' + d.t + ' ' + d.v.toFixed(4) + (d.g ? ' [' + d.g + ']' : '')).join(' | '), dof: document.querySelector('#dof').textContent, toast: document.querySelector('#toast').textContent }));
await rb('rect'); await drag(3, 1, 7, 4); await esc();
await rb('circle'); await tap(4.1, 2.2); await tap(4.4, 2.2); await esc();       // circle off-center, left of middle
const cen = () => page.evaluate(() => { const e = Object.values(QC.S.ents).find(e => e.t === 'circle'); return [+QC.S.pts[e.c].x.toFixed(4), +QC.S.pts[e.c].y.toFixed(4)]; });
console.log('circle center', await cen());
// 2) dimension to left edge and to right edge, make them equal
const ids = await page.evaluate(() => { const E = QC.S.ents, ids = Object.keys(E); const circ = ids.find(i => E[i].t === 'circle'); const lines = ids.filter(i => E[i].t === 'line' && !E[i].con).map(i => ({ i, x1: QC.S.pts[E[i].a].x, x2: QC.S.pts[E[i].b].x })); return { circ, c: E[circ].c, left: lines.find(l => Math.abs(l.x1 - 3) < 1e-4 && Math.abs(l.x2 - 3) < 1e-4).i, right: lines.find(l => Math.abs(l.x1 - 7) < 1e-4 && Math.abs(l.x2 - 7) < 1e-4).i }; });
for (const side of ['left', 'right']) {
  await page.evaluate(([c, l]) => { QC.sel = [{ k: 'p', id: c }, { k: 'e', id: l }]; const o = QC.dimOffer(); QC.applyDim(o, o.value); }, [ids.c, ids[side]]);
}
console.log('dims', await info());
await rb('select'); await esc();
const lab = await page.evaluate(() => Object.fromEntries(Object.entries(QC.labelRects).map(([k, r]) => [k, [r.x + r.w / 2, r.y + r.h / 2]])));
const dk = Object.keys(lab); console.log('labels', dk.length);
await tapS(...lab[dk[0]]); await page.waitForTimeout(150); await tapS(...lab[dk[0]]); await page.waitForTimeout(300);   // double tap -> popup
console.log('popup title', await page.evaluate(() => document.querySelector('#pop .ttl') && document.querySelector('#pop .ttl').textContent));
await tapS(...lab[dk[1]]); await page.waitForTimeout(300);
console.log('field after ref tap', await page.evaluate(() => QC.popState && String(QC.popState.vals[0])));
await page.evaluate(() => QC.popKey('✓')); await page.waitForTimeout(300);
console.log('after equal-by-formula', await info(), await page.evaluate(() => Object.values(QC.S.dims).map(d => d.expr || '-').join(' ')));
await page.screenshot({ path: 'v25.png' });
console.log(errs.join('\n') || 'no page errors'); await browser.close();
