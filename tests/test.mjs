import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await page.goto('file:///home/claude/qc/dist/index.html');
await page.waitForFunction(() => window.QC && QC.solver !== 'loading', null, { timeout: 15000 });
console.log('solver:', await page.evaluate(() => QC.solver));
const box = await page.locator('#cv').boundingBox();
// helper: world->page coords
const W = async (x, y) => { const [sx, sy] = await page.evaluate(([x, y]) => QC.w2s(x, y), [x, y]); return [box.x + sx, box.y + sy]; };
const drag = async (x1, y1, x2, y2) => { const a = await W(x1, y1), b = await W(x2, y2); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 4 }); await page.mouse.move(...b, { steps: 4 }); await page.mouse.up(); };
const tap = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.up(); };
const key = async k => page.evaluate(k => QC.popKey(k), k);
const type = async s => { for (const ch of s) await key(ch === ' ' ? '␣' : ch); await key('✓'); };
const st = () => page.evaluate(() => ({ ents: Object.keys(QC.S.ents).length, cons: Object.values(QC.S.cons).map(c => c.t).join(','), dims: Object.values(QC.S.dims).map(d => d.t + '=' + d.v).join(','), dof: QC.dof, pts: Object.keys(QC.S.pts).length }));
const tool = t => page.click(`#ribbon [data-k="${t}"]`);

// 1. rectangle by drag from origin
await tool('rect'); await drag(0, 0, 5.2, 3.1);
console.log('rect', JSON.stringify(await st()));
// 2. dimension bottom line: tap it in select mode, type 6
await tool('select'); await tap(2.5, 0); await type('6');
await tap(5.2 + 0.8, 1.5); // right edge moved to x=6
console.log('after width', JSON.stringify(await st()), await page.evaluate(() => QC.sel.length));
await page.evaluate(() => { QC.sel = []; });
await tap(8, 6); // clear
await tap(6, 1.5); await type('3 1/2');
console.log('after height', JSON.stringify(await st()));
// 3. circle + diameter + locate from edges
await tool('circle'); await drag(1.2, 1.1, 1.6, 1.1);
await tool('select'); await tap(1.6, 1.1); await type('.5');
// center to left edge distance: select circle rim + left line
await tap(1.2 + 0.25, 1.1); await tap(0, 2.5); await type('1');
await tap(1 + 0.25, 1.1); await tap(3, 0); await type('1');
console.log('hole', JSON.stringify(await st()));
console.log('circle center', await page.evaluate(() => { const e = Object.values(QC.S.ents).find(e => e.t === 'circle'); return [QC.S.pts[e.c].x.toFixed(4), QC.S.pts[e.c].y.toFixed(4), e.r]; }));
// 4. rectangular pattern of the hole
await tap(1.25, 1); await tool('prect');
await page.screenshot({ path: 'shot1.png' });
await page.evaluate(() => { const f = document.querySelectorAll('#pop .fld'); f[0].click(); }); for (const ch of '3') await key(ch);
await page.evaluate(() => document.querySelectorAll('#pop .fld')[1].click()); for (const ch of '2') await key(ch);
await page.evaluate(() => document.querySelectorAll('#pop .fld')[2].click()); for (const ch of '2') await key(ch);
await page.evaluate(() => document.querySelectorAll('#pop .fld')[3].click()); for (const ch of '1.5') await key(ch);
await key('✓');
console.log('pattern', await page.evaluate(() => JSON.stringify(Object.values(QC.S.pats))));
// 5. angled line + angle dim
await tool('line'); await drag(6, 0, 8, 1.5);
await tool('select'); await tap(7, 0.75); await tap(3, 0); 
console.log('angle offer', await page.evaluate(() => { const o = QC.dimOffer(); return o && [o.label, o.value.toFixed(2)]; }));
await type('30');
console.log('angle', JSON.stringify(await st()), await page.evaluate(() => { const l = Object.values(QC.S.ents).filter(e => e.t === 'line').pop(); const a = QC.S.pts[l.a], b = QC.S.pts[l.b]; return (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI).toFixed(3); }));
// 6. slot + arc
await tool('slot'); await tap(1, 4.5); await tap(3, 4.5); await tap(2, 4.8);
await tool('arc'); await tap(7, 4); await tap(8, 4); const a = await W(7.8, 4.6); await page.mouse.move(...a, { steps: 3 }); const b2 = await W(7, 5); await page.mouse.move(...b2, { steps: 3 }); await tap(7, 5);
console.log('slot+arc', JSON.stringify(await st()));
// slot width dim: tap arc → radius
await tool('select'); await tap(0.7, 4.5); 
console.log('slot offer', await page.evaluate(() => { const o = QC.dimOffer(); return o && [o.label, o.value.toFixed(3)]; })); await type('1/4');
console.log('slot pts', await page.evaluate(() => Object.values(QC.S.ents).filter(e => e.t === 'arc').map(e => { const c = QC.S.pts[e.c], a = QC.S.pts[e.a]; return [c.x.toFixed(3), c.y.toFixed(3), Math.hypot(a.x - c.x, a.y - c.y).toFixed(4)]; }).join(' | ')));
// 7. over-constrain check: dimension top line of rect (already defined by width)
await tap(3, 3.5); await type('7');
console.log('overconstrain toast:', await page.evaluate(() => document.querySelector('#toast').textContent), JSON.stringify((await st()).dims));
await page.evaluate(() => { QC.sel = []; });
// 8a. constraints via ribbon: make angled line's free end... select two lines → perpendicular should conflict w/ 30deg angle
await tap(12, 6); await tap(7, 0.577 * 1 ); 
console.log('sel for drag', await page.evaluate(() => JSON.stringify(QC.sel)));
await tap(12, 6);
// drag free endpoint of angled line outward; angle must hold at 30
const ep = await page.evaluate(() => { const l = Object.values(QC.S.ents).filter(e => e.t === 'line')[4]; const b = QC.S.pts[l.b]; return [b.x, b.y]; });
await drag(ep[0], ep[1], ep[0] + 1.5, ep[1] + 0.2);
console.log('dragged end', await page.evaluate(() => { const l = Object.values(QC.S.ents).filter(e => e.t === 'line')[4]; const a = QC.S.pts[l.a], b = QC.S.pts[l.b]; return [b.x.toFixed(3), b.y.toFixed(3), (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI).toFixed(2)]; }));
// circular pattern of the standalone arc around origin, then pick center = rect corner (6,3.5)
await tap(7 + Math.cos(0.7), 4 + Math.sin(0.7)); await tool('pcirc');
await page.evaluate(() => document.querySelectorAll('#pop .fld')[0].click()); await key('6');
await page.evaluate(() => [...document.querySelectorAll('#pop .acts button')].find(b => b.textContent === 'Pick center').click());
await tap(6, 3.5); await key('✓');
console.log('circ pattern', await page.evaluate(() => JSON.stringify(Object.values(QC.S.pats)[1])), await page.evaluate(() => { const p = QC.S.pts[Object.values(QC.S.pats)[1].c]; return [p.x, p.y]; }));
// equal constraint on two lines: slot lines are equal anyway → should be rejected as redundant without removing anything
// 8. drag a point of the angled line
await tap(9.5, 6);
await page.evaluate(() => QC.fit());
await page.screenshot({ path: 'shot2.png' });
// 9. circular pattern + DXF
const d = await page.evaluate(() => { const r = QC.dxfText('CUT'); return { n: r.count, bbox: r.bbox, head: r.text.split('\r\n').slice(0, 12).join('|'), sample: r.text }; });
console.log('dxf', d.n, JSON.stringify(d.bbox)); 
import fs from 'node:fs'; fs.writeFileSync('out.dxf', d.sample);
// undo/redo sanity
await page.evaluate(() => { QC.undo(); QC.undo(); QC.redo(); QC.redo(); });
console.log('final', JSON.stringify(await st()));
console.log('parse', await page.evaluate(() => ['7', '1 3/8', '1-1/2', '3/8', '.5', '25.4mm', '7mm', 'abc'].map(QC.parseLen).map(v => +v.toFixed(4))));
console.log(errs.length ? errs.join('\n') : 'no page errors');
await browser.close();
