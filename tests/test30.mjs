// Project geometry: U-channel, hole in flange A projected onto flange B's sketch, base edges onto a flange sketch, associativity, delete, undo
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await page.goto('file:///home/claude/qc/dist/index.html'); await page.waitForFunction(() => window.QC && QC.solver === 'ok');
let box = await page.locator('#cv').boundingBox();
const W = async (x, y) => { const [sx, sy] = await page.evaluate(([x, y]) => QC.w2s(x, y), [x, y]); return [box.x + sx, box.y + sy]; };
const drag = async (x1, y1, x2, y2) => { const a = await W(x1, y1), b = await W(x2, y2); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); };
const tap = async (x, y) => { const a = await W(x, y); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(120); };
const rb = t => page.click(`#ribbon [data-k="${t}"]`);
const toastT = () => page.evaluate(() => document.querySelector('#toast').textContent);
const pg = () => page.evaluate(() => Object.entries(QC.S.ents).filter(([, e]) => e.proj && e.proj[0] === '@pg').map(([i, e]) => { const P = k => { const p = QC.S.pts[e[k]]; return '(' + (+p.x.toFixed(3)) + ',' + (+p.y.toFixed(3)) + ')'; }; return i + ':' + e.t + (e.lost ? '!LOST' : '') + (e.t === 'line' ? P('a') + P('b') : P('c') + 'r' + e.r) + '<' + e.proj[1] + '>'; }).join(' '));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
await rb('rect'); await drag(0, 0, 6, 3.5);
await rb('project'); ok(/outline of the part|Face first/.test(await toastT()), 'Project refused before a part exists: ' + await toastT());
await page.click('.tab[data-tab="sm"]'); await rb('face'); await tap(2, 1.5); await page.click('.tgrid button:has-text("16ga")'); await page.waitForTimeout(250);
// two 2 in flanges, up, on the y=3.5 and y=0 edges -> U channel
await page.evaluate(() => { const P = QC.part; for (const [my, ny] of [[3.5, 1], [0, -1]]) P.feats.push({ id: 'f' + (P.nf++), type: 'flange', name: 'Flange' + (P.feats.filter(f => f.type === 'flange').length + 1), e: { mx: 3, my, nx: 0, ny }, ang: 90, len: 2, ref: 'out', side: 'up' }); QC.regen(); });
console.log('flanges', await page.evaluate(() => QC.model.flanges.length), 'warn', await page.evaluate(() => JSON.stringify(QC.model.warn)));
const flId = i => page.evaluate(i => QC.model.flanges[i].f.id, i);
const skOn = async i => { const id = await flId(i); await page.evaluate(id => { QC.setMode('model'); QC.setSelFace({ fl: id }); }, id); await rb('newsk'); await page.waitForFunction(() => QC.mode === 'sketch'); await page.waitForTimeout(200); box = await page.locator('#cv').boundingBox(); };
// hole in flange A at x=1.5 along the bend, 1.0 up the leg
await skOn(0);
await rb('circle'); await drag(1.5, 1.0, 1.75, 1.0); await page.click('#escBtn');
await page.click('.tab[data-tab="sm"]'); await rb('cut'); await tap(1.5, 1.0); await rb('cut'); await page.waitForTimeout(300);
console.log('A holes', await page.evaluate(() => QC.model.flanges[0].holes.length), await toastT());
// sketch on flange B, project
await skOn(1);
const cands = await page.evaluate(() => QC.projCands().map(c => c.key + ':' + c.g.t));
console.log('candidates on B', cands.length, cands.join(' '));
await rb('project'); ok(await page.evaluate(() => QC.tool.name) === 'project', 'Project tool on');
const cc = await page.evaluate(() => { const c = QC.projCands().find(c => c.g.t === 'circle'); return c && [c.g.cx, c.g.cy, c.g.r]; });
ok(!!cc, 'hole of flange A offered on flange B as a circle ' + JSON.stringify(cc && cc.map(v => +v.toFixed(3))));
await tap(cc[0] + cc[2], cc[1]); console.log('toast', await toastT());
let s = await pg(); console.log('projected', s); ok(/circle/.test(s), 'circle projected');
// a base-plate edge (plate seen edge-on) projects as a line below the bend
const ln = await page.evaluate(() => { const c = QC.projCands().filter(c => c.g.t === 'line' && Math.abs(c.g.y1 - c.g.y2) < 1e-6 && c.g.y1 < -0.01).sort((a, b) => a.g.y1 - b.g.y1)[0]; return c && [c.g.x1, c.g.y1, c.g.x2, c.g.y2, c.key]; });
ok(!!ln, 'plate edge offered as a line ' + JSON.stringify(ln));
await tap((ln[0] + ln[2]) / 2, ln[1]); s = await pg(); console.log('projected', s); ok((s.match(/line/g) || []).length === 1, 'line projected');
await page.screenshot({ path: 'pg1.png' });
await page.click('#escBtn');
// not part of the profile; dimensionable: draw a circle and make it concentric with the projected hole
ok(await page.evaluate(() => QC.cutRegions(QC.S).length) === 0, 'projected geometry is not a cut profile');
await rb('circle'); await drag(4, 1.2, 4.2, 1.2); await page.click('#escBtn');
await rb('conc'); const mine = await page.evaluate(() => { const e = Object.values(QC.S.ents).find(e => e.t === 'circle' && !e.proj); const p = QC.S.pts[e.c]; return [p.x + e.r, p.y]; });
await tap(mine[0], mine[1]); await tap(cc[0] + cc[2], cc[1]); await page.click('#escBtn');
const ctr = () => page.evaluate(() => { const e = Object.values(QC.S.ents).find(e => e.t === 'circle' && !e.proj); const p = QC.S.pts[e.c]; return [+p.x.toFixed(4), +p.y.toFixed(4)]; });
let c1 = await ctr(); ok(Math.abs(c1[0] - cc[0]) < 1e-3 && Math.abs(c1[1] - cc[1]) < 1e-3, 'my circle is concentric with the projected hole ' + JSON.stringify(c1));
// associativity: move the hole in flange A (edit its sketch) -> projection and my circle follow
const before = await pg();
await page.evaluate(() => { const f = QC.part.feats.filter(f => f.type === 'sketch')[1]; const e = Object.values(f.sk.ents).find(e => e.t === 'circle'); f.sk.pts[e.c].x += 0.15; f.sk.pts[e.c].y -= 0.1; QC.regen(); }); await page.waitForTimeout(200);
const after = await pg(); console.log('before', before, '\nafter ', after); ok(before !== after && !/LOST/.test(after), 'projection moved with the part');
const c2 = await ctr(); ok(Math.abs(Math.abs(c2[0] - c1[0]) - 0.15) < 1e-3 && Math.abs(c2[1] - (c1[1] - 0.1)) < 1e-3, 'concentric circle followed ' + JSON.stringify(c2));
// change thickness-independent thing: make flange A longer -> hole stays, plate line stays; delete source hole -> LOST
await page.evaluate(() => { const P = QC.part; P.feats = P.feats.filter(f => f.type !== 'cut'); QC.regen(); }); await page.waitForTimeout(150);
s = await pg(); ok(/circle!LOST/.test(s), 'source hole removed -> marked lost, kept in place: ' + s); console.log('warn', await page.evaluate(() => JSON.stringify(QC.model.warn)));
// delete a projected line
await rb('select'); await page.click('#escBtn'); await tap((ln[0] + ln[2]) / 2, ln[1]); await rb('del'); await page.waitForTimeout(150);
s = await pg(); ok(!/line/.test(s), 'projected line deleted: ' + s);
await page.click('#undoBtn'); await page.waitForTimeout(150); s = await pg(); ok(/line/.test(s), 'undo brings it back');
// top-face sketch: flange inner faces project as lines; hole on a flange projects edge-on as a line
await page.evaluate(() => { QC.setMode('model'); QC.setSelFace('top'); }); await rb('newsk'); await page.waitForFunction(() => QC.mode === 'sketch'); await page.waitForTimeout(200); box = await page.locator('#cv').boundingBox();
const tc = await page.evaluate(() => QC.projCands().map(c => c.key + ':' + c.g.t + (c.g.t === 'line' ? '(' + [c.g.x1, c.g.y1, c.g.x2, c.g.y2].map(v => +v.toFixed(3)) + ')' : '')));
console.log('top candidates', tc.length, tc.join(' '));
ok(tc.length > 0 && tc.every(t => /line/.test(t)), 'top face offers flange edges as lines only');
await page.screenshot({ path: 'pg2.png' });
console.log(errs.join('\n') || 'no page errors'); await browser.close();
