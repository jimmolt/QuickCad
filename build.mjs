import { build } from 'esbuild';
import fs from 'node:fs';
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('src/solver-entry.js', `import init from "@salusoft89/planegcs/dist/planegcs_dist/planegcs.js";
import { GcsWrapper } from "@salusoft89/planegcs/dist/sketch/gcs_wrapper.js";
window.__planegcs = { init, GcsWrapper };`);
const r = await build({ entryPoints: ['src/solver-entry.js'], bundle: true, format: 'iife', platform: 'browser', minify: true, write: false,
  external: ['node:*', 'module', 'fs', 'path', 'url'], define: { 'import.meta.url': '"https://quickcad.invalid/"' }, logLevel: 'error' });
let solver = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const wasm = fs.readFileSync('node_modules/@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm').toString('base64');
const app = fs.readFileSync('src/app.js', 'utf8') + '\n' + fs.readFileSync('src/part.js', 'utf8');
const three = fs.readFileSync('node_modules/three/build/three.min.js', 'utf8');
if (/<\/script/i.test(app)) throw new Error('app contains </script');
let html = fs.readFileSync('src/app.html', 'utf8');
html = html.replace('/*__THREE__*/', () => three).replace('/*__SOLVER__*/', () => solver).replace('__WASM__', () => wasm).replace('/*__APP__*/', () => app);
fs.writeFileSync('dist/index.html', html);
console.log('built', (html.length / 1024).toFixed(0) + ' KB');
