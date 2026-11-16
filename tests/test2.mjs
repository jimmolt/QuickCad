import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await page.goto('file:///home/claude/qc/dist/index.html');
await page.waitForFunction(() => window.QC && QC.solver === 'ok');
// synthetic pen + touch events
const res = await page.evaluate(async () => {
  const cv = document.querySelector('#cv'), r = cv.getBoundingClientRect(); const out = {};
  const ev = (type, id, pt, x, y, extra = {}) => cv.dispatchEvent(new PointerEvent(type, Object.assign({ pointerId: id, pointerType: pt, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true }, extra)));
  // finger draws a line when no pen seen
  QC.setTool('line'); ev('pointerdown', 5, 'touch', 300, 300); ev('pointermove', 5, 'touch', 380, 302); ev('pointermove', 5, 'touch', 500, 303); ev('pointerup', 5, 'touch', 500, 303);
  out.fingerLine = Object.keys(QC.S.ents).length + ' ents, cons ' + Object.values(QC.S.cons).map(c => c.t);
  // pen draws rectangle with tap-tap
  QC.setTool('rect'); ev('pointerdown', 9, 'pen', 600, 200); ev('pointerup', 9, 'pen', 600, 200); ev('pointermove', 9, 'pen', 700, 300, { buttons: 0 }); ev('pointerdown', 9, 'pen', 760, 330); ev('pointerup', 9, 'pen', 760, 330);
  out.penRect = Object.keys(QC.S.ents).length;
  // now finger should pan, not draw
  const v0 = { ...QC.view }; QC.setTool('line'); ev('pointerdown', 5, 'touch', 300, 500); ev('pointermove', 5, 'touch', 350, 540); ev('pointerup', 5, 'touch', 350, 540);
  out.fingerPan = [QC.view.ox - v0.ox, QC.view.oy - v0.oy, Object.keys(QC.S.ents).length];
  // pinch zoom
  const s0 = QC.view.s; ev('pointerdown', 5, 'touch', 300, 400); ev('pointerdown', 6, 'touch', 400, 400); ev('pointermove', 6, 'touch', 500, 400); ev('pointerup', 6, 'touch', 500, 400); ev('pointerup', 5, 'touch', 300, 400);
  out.pinch = (QC.view.s / s0).toFixed(2);
  // polyline closed triangle with pen taps
  QC.setTool('poly'); for (const [x, y] of [[200, 600], [320, 600], [260, 520], [200, 600]]) { ev('pointerdown', 9, 'pen', x, y); ev('pointerup', 9, 'pen', x, y); }
  out.poly = Object.keys(QC.S.ents).length + ' ents ' + Object.keys(QC.S.pts).length + ' pts';
  // zip check
  const z = QC.zipOne('a.dxf', QC.dxfText('CUT').text); out.zip = Array.from(z).map(b => String.fromCharCode(b)).join('');
  return out;
});
fs.writeFileSync('t.zip', Buffer.from(res.zip, 'latin1')); delete res.zip; console.log(JSON.stringify(res));
await page.evaluate(() => QC.fit()); await page.screenshot({ path: 'shot3.png' });
// phone layout
const ph = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true });
await ph.goto('file:///home/claude/qc/dist/index.html'); await ph.waitForFunction(() => window.QC && QC.solver === 'ok');
await ph.evaluate(() => { QC.setTool('rect'); QC.toolClick({ x: 0, y: 0, kind: 'pt', pid: 'p0' }); QC.toolClick({ x: 4, y: 2.5, kind: 'free' }); QC.setTool('select'); QC.fit(); QC.sel = [{ k: 'e', id: Object.keys(QC.S.ents)[0] }]; QC.showSelPop(); });
await ph.screenshot({ path: 'shot4.png' });
console.log(errs.join('\n') || 'no page errors'); await browser.close();
