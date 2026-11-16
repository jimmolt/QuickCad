import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
await page.goto('file:///home/claude/qc/dist/index.html');
await page.waitForFunction(() => window.QC && QC.solver === 'ok');
let box = await page.locator('#cv').boundingBox();
const W = async (x, y) => { const [sx, sy] = await page.evaluate(([x, y]) => QC.w2s(x, y), [x, y]); return [box.x + sx, box.y + sy]; };
const drag = async (x1, y1, x2, y2) => { const a = await W(x1, y1), b = await W(x2, y2); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 4 }); await page.mouse.move(...b, { steps: 4 }); await page.mouse.up(); };
const tap = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.up(); };
const key = async k => page.evaluate(k => QC.popKey(k), k);
const type = async s => { for (const ch of s) await key(ch === ' ' ? '␣' : ch); await key('✓'); };
const rb = t => page.click(`#ribbon [data-k="${t}"]`);
const pickAll = () => page.evaluate(() => { for (const f of QC.cutCands()) for (const l of QC.sketchLoops(f.sk).loops) QC.cutTap({ x: (l.bb.x0 + l.bb.x1) / 2, y: (l.bb.y0 + l.bb.y1) / 2 }); return QC.cutState().sel.length; });
const tab = t => page.click(`.tab[data-tab="${t}"]`);
const info = () => page.evaluate(() => ({ mode: QC.mode, feats: QC.part.feats.map(f => f.name + (f.off ? '(off)' : '')).join(','), t: QC.part.tl, holes: QC.model && QC.model.holes ? QC.model.holes.length : null, area: QC.model && QC.model.area ? +QC.model.area.toFixed(4) : null, warn: QC.model ? QC.model.warn : null, g3: QC.G3.ok }));
// outline: 6 x 3.5 plate with one hole in the outline sketch
await rb('rect'); await drag(0, 0, 5.3, 3.2);
await rb('select'); await tap(2.5, 0); await type('6'); await tap(6, 1.5); await type('3.5');
await rb('circle'); await drag(5, 2.5, 5.25, 2.5); await rb('select'); await tap(5.25, 2.5); await type('1/2');
// Face
await tab('sm'); await rb('face'); await tap(2, 1.5);
await page.screenshot({ path: 'p2a.png' });
await page.click('.tgrid button:has-text("16ga")');
await page.waitForTimeout(300);
console.log('face', JSON.stringify(await info()));
await page.screenshot({ path: 'p2b.png' });
// new sketch on face, hole 1" from left and bottom edges, rectangular pattern, slot crossing nothing
await page.evaluate(() => QC.setSelFace && QC.mode === 'model' && QC.setSelFace('top')); await rb('newsk'); await page.waitForFunction(() => QC.mode === 'sketch'); box = await page.locator('#cv').boundingBox();
console.log('sketch2 proj ents', await page.evaluate(() => Object.values(QC.S.ents).filter(e => e.proj).length), await page.evaluate(() => QC.mode));
await rb('circle'); await drag(1.3, 1.2, 1.5, 1.2); await rb('select');
await tap(1.5, 1.2); await type('.375');
await tap(1.3 + 0.1875, 1.2); await tap(0, 2); console.log('offer', await page.evaluate(() => { const o = QC.dimOffer(); return o && o.label; })); await type('1');
await tap(1 + 0.1875, 1.2); await tap(4.6, 0); await type('1');
console.log('hole center', await page.evaluate(() => { const e = Object.values(QC.S.ents).find(e => e.t === 'circle' && !e.proj); const c = QC.S.pts[e.c]; return [c.x.toFixed(4), c.y.toFixed(4), e.r, QC.dof]; }));
await tap(1.1875, 1); await rb('prect');
await page.evaluate(() => document.querySelectorAll('#pop .fld')[0].click()); await key('3');
await page.evaluate(() => document.querySelectorAll('#pop .fld')[1].click()); await key('1'); await key('.'); await key('5'); await key('✓');
await page.screenshot({ path: 'p2c.png' });
await tab('sm'); await rb('cut'); console.log('picked', await pickAll()); await rb('cut'); await page.waitForTimeout(300);
console.log('cut', JSON.stringify(await info()));
await page.screenshot({ path: 'p2d.png' });
// expected area: 21 - pi*.25^2 - 3*pi*.1875^2
console.log('expected area', (21 - Math.PI * 0.0625 - 3 * Math.PI * 0.1875 ** 2).toFixed(4));
// edit outline: width 6 -> 8; projections in sketch2 follow, hole stays 1" from left edge
await page.click('#browser .row:has-text("Sketch1")'); box = await page.locator('#cv').boundingBox();
await page.evaluate(() => { const id = Object.keys(QC.S.dims)[0]; QC.sel = [{ k: 'd', id }]; QC.showSelPop(); }); await type('8');
console.log('after widen', JSON.stringify(await info()), await page.evaluate(() => { const sk = QC.part.feats[2].sk; return Object.values(sk.pts).filter(p => p.proj).map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' '); }));
// flat DXF
await page.evaluate(() => QC.setMode('model'));
const d = await page.evaluate(() => { const r = QC.dxfText('CUT', QC.flatGeoms()); return { n: r.count, bb: r.bbox, text: r.text }; });
fs.writeFileSync('flat.dxf', d.text); console.log('flat dxf', d.n, JSON.stringify(d.bb));
// second cut sketch with a notch crossing the edge -> warning
await page.evaluate(() => QC.setSelFace && QC.mode === 'model' && QC.setSelFace('top')); await rb('newsk'); await page.waitForFunction(() => QC.mode === 'sketch'); box = await page.locator('#cv').boundingBox(); await rb('rect'); await drag(7.5, 1, 8.6, 2); await tab('sm'); await rb('cut'); console.log('picked', await pickAll()); await rb('cut'); await page.waitForTimeout(200);
console.log('notch', JSON.stringify(await info()));
// suppress cut1 via feature dialog, undo
await page.click('#browser .row:has-text("Cut1")'); await page.click('.dlg button:has-text("Suppress")');
console.log('suppressed', JSON.stringify(await info()));
await page.evaluate(() => QC.undo()); console.log('undo', JSON.stringify(await info()));
// flat export dialog + orbit screenshot
await rb('flatdxf'); await page.screenshot({ path: 'p2e.png' }); await page.click('.dlg button:has-text("Close")');
const gb = await page.locator('#gl').boundingBox(); await page.mouse.move(gb.x + 400, gb.y + 300); await page.mouse.down(); await page.mouse.move(gb.x + 520, gb.y + 230, { steps: 5 }); await page.mouse.up();
await page.screenshot({ path: 'p2f.png' });
await page.evaluate(() => [...document.querySelectorAll('#vcube .f')].find(f => f.textContent === 'TOP').click()); await page.waitForTimeout(100); await page.screenshot({ path: 'p2g.png' });
// save / reload JSON round trip
const json = await page.evaluate(() => JSON.stringify({ app: 'QuickCad', format: 2, part: QC.part }));
await page.evaluate(j => QC.loadPart(JSON.parse(j).part), json); console.log('reload', JSON.stringify(await info()));
// reload page: autosave restores
await page.reload(); await page.waitForFunction(() => window.QC && QC.solver === 'ok'); await page.waitForTimeout(300); console.log('after page reload', JSON.stringify(await info()));
// legacy phase-1 sketch load
await page.evaluate(() => { const s = QC.newSketch(); QC.loadSketch(s); }); console.log('legacy', JSON.stringify(await info()));
console.log(errs.join('\n') || 'no page errors'); await browser.close();
