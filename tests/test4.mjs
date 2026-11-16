import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await page.goto('file:///home/claude/qc/dist/index.html'); await page.waitForFunction(() => window.QC && QC.solver === 'ok');
const box = await page.locator('#cv').boundingBox();
const W = async (x, y) => { const [sx, sy] = await page.evaluate(([x, y]) => QC.w2s(x, y), [x, y]); return [box.x + sx, box.y + sy]; };
const drag = async (x1, y1, x2, y2, shot) => { const a = await W(x1, y1), b = await W(x2, y2); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); if (shot) await page.screenshot({ path: shot }); await page.mouse.up(); };
await page.click('#ribbon [data-k="rect"]'); await drag(1, 1, 5, 3);
await page.click('#ribbon [data-k="circle"]'); await drag(7, 2, 7.5, 2);
await page.keyboard.press('Escape');
const n = () => page.evaluate(() => QC.sel.length + ':' + QC.sel.map(s => QC.S.ents[s.id].t[0]).join(''));
await drag(0.5, 0.5, 3, 3.5); console.log('window right, partial rect ->', await n());       // only left vertical line fully inside
await drag(9, 4, -0.5, 0.5); console.log('window? no: leftward crossing all ->', await n());
await drag(3, 3.5, 0.5, 0.5, 'bx.png'); console.log('crossing left, partial ->', await n());    // left, top, bottom lines touched
await drag(0.5, 0.5, 9, 4); console.log('window all ->', await n());
console.log('pop rect', await page.evaluate(() => { const r = document.querySelector('#pop').getBoundingClientRect(); const c = document.querySelector('#cv').getBoundingClientRect(); return [r.left - c.left, r.top - c.top, r.width, r.height, QC.w2s(7, 2)]; }));
await page.evaluate(() => { document.querySelector('#pop .x').click(); QC.sel = Object.keys(QC.S.ents).map(id => ({ k: 'e', id })); });
await drag(6.9, 1.9, 7.1, 2.1); console.log('window inside circle (nothing) ->', await n());
await drag(7.1, 2.1, 6.9, 1.9); console.log('crossing inside circle (nothing) ->', await n());
await drag(7.6, 2.1, 7.4, 1.9); console.log('crossing rim ->', await n());
await page.keyboard.press('Delete'); console.log('ents after delete', await page.evaluate(() => Object.keys(QC.S.ents).length));
console.log(errs.join('\n') || 'no page errors'); await browser.close();
