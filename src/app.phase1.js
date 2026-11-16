'use strict';
// QuickCad phase 1 — parametric 2D sketcher. Units: inches. World Y is up.
const $ = s => document.querySelector(s);
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const k in (attrs || {})) {
    if (k === 'class') n.className = attrs[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else if (k === 'html') n.innerHTML = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  for (const c of kids.flat()) if (c != null) n.append(c);
  return n;
}
const hyp = Math.hypot, PI = Math.PI, TAU = 2 * Math.PI;

// ---------------------------------------------------------------- icons
const IC = {
  select: '<path d="M5 3l14 8-6.5 1.8L10.5 19z"/>',
  line: '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>',
  poly: '<path d="M3 18l5-11 6 8 7-10"/>',
  rect: '<rect x="4" y="6" width="16" height="12"/>',
  circle: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r=".6"/>',
  arc: '<path d="M4 19A15 15 0 0 1 19 4"/><circle cx="4" cy="19" r="1.4"/><circle cx="19" cy="4" r="1.4"/>',
  slot: '<rect x="3" y="8" width="18" height="8" rx="4"/>',
  constr: '<path d="M4 20L20 4" stroke-dasharray="3 3"/>',
  del: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
  hor: '<path d="M3 12h18"/><path d="M7 8v8M17 8v8" opacity=".5"/>',
  ver: '<path d="M12 3v18"/><path d="M8 7h8M8 17h8" opacity=".5"/>',
  par: '<path d="M5 19L13 5M11 19l8-14"/>',
  perp: '<path d="M4 19h16M12 19V5"/>',
  tan: '<circle cx="10" cy="14" r="6"/><path d="M4 5.6L21 10"/>',
  eq: '<path d="M5 9h14M5 15h14"/>',
  coi: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  conc: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  sym: '<path d="M12 3v18" stroke-dasharray="3 2"/><path d="M8 7l-4 5 4 5zM16 7l4 5-4 5z"/>',
  mid: '<path d="M3 18L21 6"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
  fix: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>',
  pcirc: '<circle cx="12" cy="4.5" r="2"/><circle cx="18.5" cy="15.5" r="2"/><circle cx="5.5" cy="15.5" r="2"/><circle cx="12" cy="12" r=".7"/><path d="M15.5 6.5a8 8 0 0 1 3.3 5.6M15 19.3a8 8 0 0 1-6 0M5.200 12.1a8 8 0 0 1 3.300-5.600" opacity=".5"/>',
  prect: '<circle cx="6" cy="7" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="6" cy="16" r="2"/><circle cx="12" cy="16" r="2"/><circle cx="18" cy="16" r="2"/>',
  dxf: '<path d="M12 3v11M7.500 10l4.500 4.500L16.500 10M4 17v3h16v-3"/>',
  undo: '<path d="M8 5L3 10l5 5M3 10h11a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M16 5l5 5-5 5M21 10H10a6 6 0 0 0 0 12h3"/>',
  fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><rect x="9" y="9" width="6" height="6"/>',
  save: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
  open: '<path d="M3 7V5h7l2 2h9v3M3 7v12h15l3-9H6l-3 9"/>',
  new: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const icon = n => `<svg viewBox="0 0 24 24">${IC[n] || ''}</svg>`;

// ---------------------------------------------------------------- state
function newSketch() {
  return { v: 1, name: 'Sketch1', nid: 1, pts: { p0: { x: 0, y: 0, fixed: true } }, ents: {}, cons: {}, dims: {}, pats: {} };
}
let S = newSketch();
let settings = { theme: 'dark', gridSnap: false, showCons: true, layer: 'CUT', fingerDraw: false };
let view = { s: 60, ox: 200, oy: 400 };
let sel = [];                 // [{k:'p'|'e'|'d'|'c'|'pat', id}]
let tool = { name: 'select', step: 0 };
let constrMode = false;
let cur = null;               // current snap (draw tools)
let hover = null;
let dof = null;
let labelRects = {}, badgeRects = [];
let dirty = true;
let lastPtrType = 'mouse', penSeen = false;
const hist = []; let hi = -1, lastNid = 1;

const P = id => S.pts[id];
const nid = pre => pre + (S.nid++);
const num = id => +id.replace(/^\D+/, '');
function addPt(x, y) { const id = nid('p'); S.pts[id] = { x, y }; return id; }
function addEnt(o) { const id = nid('e'); if (constrMode) o.con = true; S.ents[id] = o; return id; }
function addCon(o) { const id = nid('c'); S.cons[id] = o; return id; }
function addDim(o) { const id = nid('d'); S.dims[id] = o; return id; }
const entPts = e => e.t === 'line' ? [e.a, e.b] : e.t === 'circle' ? [e.c] : [e.c, e.a, e.b];
const PT_KEYS = ['p', 'q', 'p1', 'p2', 'p3', 'p4'], EN_KEYS = ['e', 'e1', 'e2'];

function gc() {
  for (const id in S.ents) { const e = S.ents[id]; if ((e.t === 'line' && e.a === e.b) || (e.t === 'arc' && e.a === e.b)) delete S.ents[id]; }
  const used = new Set(['p0']);
  for (const id in S.ents) entPts(S.ents[id]).forEach(p => used.add(p));
  const bad = o => PT_KEYS.some(k => k in o && !used.has(o[k])) || EN_KEYS.some(k => k in o && !(o[k] in S.ents))
    || ('q' in o && o.p === o.q) || ('e2' in o && o.e1 === o.e2);
  for (const id in S.cons) if (bad(S.cons[id])) delete S.cons[id];
  for (const id in S.dims) if (bad(S.dims[id])) delete S.dims[id];
  for (const id in S.pats) {
    const p = S.pats[id]; p.src = p.src.filter(e => e in S.ents);
    if (!p.src.length) delete S.pats[id]; else if (p.t === 'circ' && !used.has(p.c)) p.c = 'p0';
  }
  for (const id in S.pts) if (!used.has(id)) delete S.pts[id];
  sel = sel.filter(s => s.k === 'p' ? s.id in S.pts : s.k === 'e' ? s.id in S.ents : s.k === 'd' ? s.id in S.dims : s.k === 'c' ? s.id in S.cons : s.id in S.pats);
}
function mergePts(keep, drop) {
  if (keep === drop) return;
  if (drop === 'p0') [keep, drop] = [drop, keep];
  for (const id in S.ents) { const e = S.ents[id]; for (const k of ['a', 'b', 'c']) if (e[k] === drop) e[k] = keep; }
  for (const grp of [S.cons, S.dims]) for (const id in grp) for (const k of PT_KEYS) if (grp[id][k] === drop) grp[id][k] = keep;
  for (const id in S.pats) if (S.pats[id].c === drop) S.pats[id].c = keep;
  delete S.pts[drop];
}

// ---------------------------------------------------------------- geometry helpers
function entG(e) {
  if (e.t === 'line') { const a = P(e.a), b = P(e.b); return { t: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y }; }
  const c = P(e.c);
  if (e.t === 'circle') return { t: 'circle', cx: c.x, cy: c.y, r: e.r };
  const a = P(e.a), b = P(e.b), r = hyp(a.x - c.x, a.y - c.y);
  let sa = Math.atan2(a.y - c.y, a.x - c.x), ea = Math.atan2(b.y - c.y, b.x - c.x);
  while (ea <= sa + 1e-9) ea += TAU;
  return { t: 'arc', cx: c.x, cy: c.y, r, sa, ea };
}
function inSweep(g, ang) { let d = ang - g.sa; d = ((d % TAU) + TAU) % TAU; return d <= g.ea - g.sa + 1e-9; }
function projG(g, x, y) {
  if (g.t === 'line') {
    const dx = g.x2 - g.x1, dy = g.y2 - g.y1, L2 = dx * dx + dy * dy || 1e-12;
    let t = ((x - g.x1) * dx + (y - g.y1) * dy) / L2; t = Math.max(0, Math.min(1, t));
    return { x: g.x1 + t * dx, y: g.y1 + t * dy, t };
  }
  const a = Math.atan2(y - g.cy, x - g.cx);
  if (g.t === 'circle' || inSweep(g, a)) return { x: g.cx + g.r * Math.cos(a), y: g.cy + g.r * Math.sin(a) };
  const p1 = { x: g.cx + g.r * Math.cos(g.sa), y: g.cy + g.r * Math.sin(g.sa) }, p2 = { x: g.cx + g.r * Math.cos(g.ea), y: g.cy + g.r * Math.sin(g.ea) };
  return hyp(x - p1.x, y - p1.y) < hyp(x - p2.x, y - p2.y) ? p1 : p2;
}
function distG(g, x, y) { const p = projG(g, x, y); return hyp(x - p.x, y - p.y); }
function xfG(g, T) {
  const c = Math.cos(T.rot), s = Math.sin(T.rot);
  const f = (x, y) => [T.cx + (x - T.cx) * c - (y - T.cy) * s + T.dx, T.cy + (x - T.cx) * s + (y - T.cy) * c + T.dy];
  if (g.t === 'line') { const [x1, y1] = f(g.x1, g.y1), [x2, y2] = f(g.x2, g.y2); return { t: 'line', x1, y1, x2, y2 }; }
  const [cx, cy] = f(g.cx, g.cy);
  if (g.t === 'circle') return { t: 'circle', cx, cy, r: g.r };
  return { t: 'arc', cx, cy, r: g.r, sa: g.sa + T.rot, ea: g.ea + T.rot };
}
function patXf(p) {
  const out = [];
  if (p.t === 'circ') {
    const c = P(p.c) || P('p0'), n = Math.max(1, Math.min(360, p.n | 0));
    const full = Math.abs(Math.abs(p.ang) - 360) < 1e-9;
    const step = (p.ang * PI / 180) / (full ? n : Math.max(1, n - 1));
    for (let i = 1; i < n; i++) out.push({ rot: i * step, cx: c.x, cy: c.y, dx: 0, dy: 0 });
  } else {
    const r = (p.rot || 0) * PI / 180, ux = Math.cos(r), uy = Math.sin(r);
    const n1 = Math.max(1, Math.min(200, p.n1 | 0)), n2 = Math.max(1, Math.min(200, p.n2 | 0));
    for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) {
      if (!i && !j) continue;
      out.push({ rot: 0, cx: 0, cy: 0, dx: i * p.d1 * ux - j * p.d2 * uy, dy: i * p.d1 * uy + j * p.d2 * ux });
    }
  }
  return out;
}
function patGeoms(p, includeCon) {
  const out = [], T = patXf(p);
  for (const eid of p.src) { const e = S.ents[eid]; if (!e || (e.con && !includeCon)) continue; const g = entG(e); for (const t of T) out.push(xfG(g, t)); }
  return out;
}
function exportGeoms() {
  const out = [];
  for (const id in S.ents) if (!S.ents[id].con) out.push(entG(S.ents[id]));
  for (const id in S.pats) out.push(...patGeoms(S.pats[id], false));
  return out;
}
function bboxG(list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const g of list) {
    if (g.t === 'line') { add(g.x1, g.y1); add(g.x2, g.y2); }
    else if (g.t === 'circle') { add(g.cx - g.r, g.cy - g.r); add(g.cx + g.r, g.cy + g.r); }
    else {
      add(g.cx + g.r * Math.cos(g.sa), g.cy + g.r * Math.sin(g.sa)); add(g.cx + g.r * Math.cos(g.ea), g.cy + g.r * Math.sin(g.ea));
      for (let k = Math.ceil(g.sa / (PI / 2)); k * PI / 2 <= g.ea; k++) add(g.cx + g.r * Math.cos(k * PI / 2), g.cy + g.r * Math.sin(k * PI / 2));
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}
function lineDir(e) { const a = P(e.a), b = P(e.b), L = hyp(b.x - a.x, b.y - a.y) || 1e-12; return { x: (b.x - a.x) / L, y: (b.y - a.y) / L, L }; }
function intersectLL(e1, e2) {
  const a = P(e1.a), d1 = lineDir(e1), c = P(e2.a), d2 = lineDir(e2);
  const den = d1.x * d2.y - d1.y * d2.x; if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * d2.y - (c.y - a.y) * d2.x) / den;
  return { x: a.x + d1.x * t, y: a.y + d1.y * t };
}
function angSetup(e1, e2) {
  const X = intersectLL(e1, e2); if (!X) return null;
  const ray = e => { const a = P(e.a), b = P(e.b), d = lineDir(e); const f = hyp(a.x - X.x, a.y - X.y) > hyp(b.x - X.x, b.y - X.y) ? a : b;
    const s = ((f.x - X.x) * d.x + (f.y - X.y) * d.y) >= 0 ? 1 : -1; return { s, x: d.x * s, y: d.y * s }; };
  const r1 = ray(e1), r2 = ray(e2);
  const th = Math.atan2(r1.x * r2.y - r1.y * r2.x, r1.x * r2.x + r1.y * r2.y);
  return { s1: r1.s, s2: r2.s, sg: th >= 0 ? 1 : -1, cur: Math.abs(th) * 180 / PI };
}
function rawAngle(o) { let a = o.sg * o.v * PI / 180 + (o.s1 !== o.s2 ? PI : 0); while (a > PI) a -= TAU; while (a <= -PI) a += TAU; return a; }

// ---------------------------------------------------------------- number parsing / formatting
function parseNum(s) {
  s = String(s).trim(); let m;
  if ((m = s.match(/^(-?)(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/))) return (m[1] ? -1 : 1) * (+m[2] + (+m[3]) / (+m[4]));
  if ((m = s.match(/^(-?)(\d+)\s*\/\s*(\d+)$/))) return (m[1] ? -1 : 1) * (+m[2]) / (+m[3]);
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return +s;
  return NaN;
}
function parseLen(s) {
  s = String(s).trim().toLowerCase(); let f = 1;
  if (s.endsWith('mm')) { f = 1 / 25.4; s = s.slice(0, -2); }
  else if (s.endsWith('in')) s = s.slice(0, -2);
  else if (s.endsWith('"')) s = s.slice(0, -1);
  return parseNum(s) * f;
}
const fmt = v => String(+(+v).toFixed(4));

// ---------------------------------------------------------------- solver (planegcs)
let gcs = null, solverState = 'loading';
async function initSolver() {
  try {
    const bin = Uint8Array.from(atob(WASM_B64), c => c.charCodeAt(0));
    const mod = await window.__planegcs.init({ printErr() {}, instantiateWasm(imports, done) { WebAssembly.instantiate(bin, imports).then(r => done(r.instance, r.module)); return {}; } });
    gcs = new window.__planegcs.GcsWrapper(new mod.GcsSystem(), mod);
    solverState = 'ok';
    solve(); refresh();
  } catch (err) { solverState = 'failed'; console.error(err); toast('Constraint solver failed to load — sketching works, dimensions will not drive'); refresh(); }
}
function conPrims(id, o) {
  const E = S.ents, ty = x => E[x].t;
  switch (o.t) {
    case 'hor': return [{ id, type: 'horizontal_l', l_id: o.e }];
    case 'ver': return [{ id, type: 'vertical_l', l_id: o.e }];
    case 'hpp': return [{ id, type: 'horizontal_pp', p1_id: o.p, p2_id: o.q }];
    case 'vpp': return [{ id, type: 'vertical_pp', p1_id: o.p, p2_id: o.q }];
    case 'par': return [{ id, type: 'parallel', l1_id: o.e1, l2_id: o.e2 }];
    case 'perp': return [{ id, type: 'perpendicular_ll', l1_id: o.e1, l2_id: o.e2 }];
    case 'perp4': return [{ id, type: 'perpendicular_pppp', l1p1_id: o.p1, l1p2_id: o.p2, l2p1_id: o.p3, l2p2_id: o.p4 }];
    case 'eq': {
      const a = ty(o.e1), b = ty(o.e2);
      if (a === 'line') return [{ id, type: 'equal_length', l1_id: o.e1, l2_id: o.e2 }];
      if (a === 'circle' && b === 'circle') return [{ id, type: 'equal_radius_cc', c1_id: o.e1, c2_id: o.e2 }];
      if (a === 'arc' && b === 'arc') return [{ id, type: 'equal_radius_aa', a1_id: o.e1, a2_id: o.e2 }];
      return [{ id, type: 'equal_radius_ca', c1_id: a === 'circle' ? o.e1 : o.e2, a2_id: a === 'circle' ? o.e2 : o.e1 }];
    }
    case 'tan': {
      const a = ty(o.e1), b = ty(o.e2);
      if (a === 'line') return [b === 'circle' ? { id, type: 'tangent_lc', l_id: o.e1, c_id: o.e2 } : { id, type: 'tangent_la', l_id: o.e1, a_id: o.e2 }];
      if (a === 'circle' && b === 'circle') return [{ id, type: 'tangent_cc', c1_id: o.e1, c2_id: o.e2 }];
      if (a === 'arc' && b === 'arc') return [{ id, type: 'tangent_aa', a1_id: o.e1, a2_id: o.e2 }];
      return [{ id, type: 'tangent_ca', c_id: a === 'circle' ? o.e1 : o.e2, a_id: a === 'circle' ? o.e2 : o.e1 }];
    }
    case 'pol': { const t = ty(o.e); return [t === 'line' ? { id, type: 'point_on_line_pl', p_id: o.p, l_id: o.e } : t === 'circle' ? { id, type: 'point_on_circle', p_id: o.p, c_id: o.e } : { id, type: 'point_on_arc', p_id: o.p, a_id: o.e }]; }
    case 'mid': return [{ id, type: 'p2p_symmetric_ppp', p1_id: E[o.e].a, p2_id: E[o.e].b, p_id: o.p }];
    case 'sym': return [{ id, type: 'p2p_symmetric_ppl', p1_id: o.p, p2_id: o.q, l_id: o.e }];
    case 'len': return [{ id, type: 'p2p_distance', p1_id: o.p, p2_id: o.q, distance: o.v }];
    case 'pld': return [{ id, type: 'p2l_distance', p_id: o.p, l_id: o.e, distance: o.v }];
    case 'ang': return [{ id, type: 'l2l_angle_ll', l1_id: o.e1, l2_id: o.e2, angle: rawAngle(o) }];
    case 'dia': return [{ id, type: 'circle_diameter', c_id: o.e, diameter: o.v }];
    case 'rad': return [{ id, type: 'arc_radius', a_id: o.e, radius: o.v }];
  }
  return [];
}
function buildPrims(temp) {
  const pr = [];
  for (const id in S.pts) { const p = S.pts[id]; pr.push({ id, type: 'point', x: p.x, y: p.y, fixed: !!p.fixed }); }
  for (const id in S.ents) {
    const e = S.ents[id];
    if (e.t === 'line') pr.push({ id, type: 'line', p1_id: e.a, p2_id: e.b });
    else if (e.t === 'circle') pr.push({ id, type: 'circle', c_id: e.c, radius: e.r });
    else { const g = entG(e); pr.push({ id, type: 'arc', c_id: e.c, radius: g.r, start_angle: g.sa, end_angle: g.ea, start_id: e.a, end_id: e.b }, { id: id + '_r', type: 'arc_rules', a_id: id }); }
  }
  const items = [...Object.entries(S.cons), ...Object.entries(S.dims)].sort((a, b) => num(a[0]) - num(b[0]));
  for (const [id, o] of items) pr.push(...conPrims(id, o));
  let k = 0;
  for (const t of (temp || [])) {
    pr.push({ id: 't' + (k++), type: 'coordinate_x', p_id: t.p, x: t.x, temporary: true }, { id: 't' + (k++), type: 'coordinate_y', p_id: t.p, y: t.y, temporary: true });
  }
  return pr;
}
// Solve the sketch in place. Returns {ok, msg}. Redundant constraints are pruned; conflicts are reported.
function solve(opts) {
  opts = opts || {};
  if (!gcs) return { ok: true };
  for (let iter = 0; iter < 6; iter++) {
    let st;
    try { gcs.clear_data(); gcs.push_primitives_and_params(buildPrims(opts.temp)); st = gcs.solve(); }
    catch (err) { console.error(err); return { ok: false, msg: 'Solver error' }; }
    const conf = gcs.has_gcs_conflicting_constraints() ? gcs.get_gcs_conflicting_constraints() : [];
    const red = gcs.has_gcs_redundant_constraints() ? gcs.get_gcs_redundant_constraints() : [];
    // Only constraints created by the operation in progress may be dropped; older ones are never removed silently.
    const isNew = id => opts.newFrom != null && num(id) >= opts.newFrom;
    let pruned = false, redDim = false;
    for (const id of red) { if (S.cons[id] && isNew(id)) { delete S.cons[id]; pruned = true; } else if (S.dims[id] || S.cons[id]) redDim = true; }
    if (!pruned) for (const id of conf) if (S.cons[id] && S.cons[id].auto && isNew(id)) { delete S.cons[id]; pruned = true; }
    if (pruned) continue;
    if (redDim) return { ok: false, msg: 'Already defined by other dimensions or constraints' };
    if (conf.length || st === 2) return { ok: false, msg: conf.length ? 'Over-constrained — that conflicts with existing dimensions or constraints' : 'No solution found for that value' };
    gcs.apply_solution();
    for (const o of gcs.sketch_index.get_primitives()) {
      if (o.type === 'point') { const p = S.pts[o.id]; if (p && isFinite(o.x) && isFinite(o.y)) { p.x = o.x; p.y = o.y; } }
      else if (o.type === 'circle') { const e = S.ents[o.id]; if (e && o.radius > 0) e.r = o.radius; }
    }
    dof = gcs.gcs.dof();
    return { ok: true };
  }
  return { ok: false, msg: 'Could not resolve constraints' };
}

// ---------------------------------------------------------------- history / persistence
const snapshot = () => JSON.stringify(S);
function restore(s) { S = JSON.parse(s); lastNid = S.nid; sel = sel.filter(x => (x.k === 'p' ? S.pts : x.k === 'e' ? S.ents : x.k === 'd' ? S.dims : x.k === 'c' ? S.cons : S.pats)[x.id]); solve(); }
function pushHist() { lastNid = S.nid; hist.length = hi + 1; hist.push(snapshot()); hi++; if (hist.length > 200) { hist.shift(); hi--; } persist(); }
function commit(silent) {
  gc();
  const r = solve({ newFrom: lastNid });
  if (!r.ok) { restore(hist[hi]); if (!silent) toast(r.msg); refresh(); return false; }
  gc(); pushHist(); refresh(); return true;
}
function undo() { if (hi > 0) { hi--; restore(hist[hi]); closePop(); resetTool(); persist(); refresh(); } }
function redo() { if (hi < hist.length - 1) { hi++; restore(hist[hi]); closePop(); resetTool(); persist(); refresh(); } }
function persist() { try { localStorage.setItem('qc.sketch', hist[hi]); } catch (e) {} }
function saveSettings() { try { localStorage.setItem('qc.settings', JSON.stringify(settings)); } catch (e) {} }
function validSketch(o) { return o && typeof o === 'object' && o.pts && o.pts.p0 && o.ents && o.cons && o.dims && o.pats && typeof o.nid === 'number'; }
function loadSketch(o) { S = o; lastNid = S.nid; sel = []; closePop(); resetTool(); hist.length = 0; hi = -1; gc(); solve(); pushHist(); $('#pname').value = S.name || 'Sketch1'; fit(); refresh(); }

// ---------------------------------------------------------------- view
const cv = $('#cv'), ctx = cv.getContext('2d');
let CW = 0, CH = 0, DPR = 1;
const w2s = (x, y) => [view.ox + x * view.s, view.oy - y * view.s];
const s2w = (sx, sy) => ({ x: (sx - view.ox) / view.s, y: (view.oy - sy) / view.s });
function resize() {
  const r = cv.getBoundingClientRect(); DPR = window.devicePixelRatio || 1; CW = r.width; CH = r.height;
  cv.width = Math.max(1, Math.round(CW * DPR)); cv.height = Math.max(1, Math.round(CH * DPR)); dirty = true;
}
function zoomAt(sx, sy, f) {
  const ns = Math.max(2, Math.min(4000, view.s * f)); f = ns / view.s;
  view.ox = sx - (sx - view.ox) * f; view.oy = sy - (sy - view.oy) * f; view.s = ns; dirty = true;
}
function fit() {
  const gs = []; for (const id in S.ents) gs.push(entG(S.ents[id])); for (const id in S.pats) gs.push(...patGeoms(S.pats[id], true));
  const b = bboxG(gs);
  if (!b || !CW) { view.s = 60; view.ox = Math.max(90, CW * 0.22); view.oy = CH * 0.72; dirty = true; return; }
  b.x0 = Math.min(b.x0, 0); b.y0 = Math.min(b.y0, 0); b.x1 = Math.max(b.x1, 0); b.y1 = Math.max(b.y1, 0);
  const w = Math.max(b.x1 - b.x0, 0.5), h = Math.max(b.y1 - b.y0, 0.5), m = 70;
  view.s = Math.max(2, Math.min(4000, Math.min((CW - 2 * m) / w, (CH - 2 * m) / h)));
  view.ox = CW / 2 - (b.x0 + w / 2) * view.s; view.oy = CH / 2 + (b.y0 + h / 2) * view.s; dirty = true;
}

// ---------------------------------------------------------------- snapping / hit testing
const tolPx = () => lastPtrType === 'touch' ? 22 : lastPtrType === 'pen' ? 13 : 9;
function snap(sx, sy, ref) {
  const w = s2w(sx, sy), tol = tolPx() / view.s;
  let best = null, bd = tol;
  for (const id in S.pts) { const p = S.pts[id], d = hyp(p.x - w.x, p.y - w.y); if (d < bd) { bd = d; best = { x: p.x, y: p.y, kind: 'pt', pid: id }; } }
  if (best) return best;
  bd = tol * 0.8;
  for (const id in S.ents) { const e = S.ents[id]; if (e.t !== 'line') continue; const a = P(e.a), b = P(e.b), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = hyp(mx - w.x, my - w.y); if (d < bd) { bd = d; best = { x: mx, y: my, kind: 'mid', eid: id }; } }
  if (best) return best;
  bd = tol * 0.7;
  for (const id in S.ents) { const g = entG(S.ents[id]), p = projG(g, w.x, w.y), d = hyp(p.x - w.x, p.y - w.y); if (d < bd) { bd = d; best = { x: p.x, y: p.y, kind: 'on', eid: id }; } }
  if (best) return best;
  const out = { x: w.x, y: w.y, kind: 'free' };
  if (settings.gridSnap) { const g = view.s >= 40 ? 0.0625 : view.s >= 12 ? 0.25 : 1; out.x = Math.round(out.x / g) * g; out.y = Math.round(out.y / g) * g; }
  if (ref) {
    const dx = out.x - ref.x, dy = out.y - ref.y, L = hyp(dx, dy);
    if (L * view.s > 14) {
      const a = Math.abs(Math.atan2(dy, dx)) * 180 / PI;
      if (a < 4 || a > 176) { out.y = ref.y; out.hv = 'hor'; } else if (Math.abs(a - 90) < 4) { out.x = ref.x; out.hv = 'ver'; }
    }
  }
  return out;
}
function ptFromSnap(sn) {
  if (sn.pid && S.pts[sn.pid]) return sn.pid;
  const p = addPt(sn.x, sn.y);
  if (sn.kind === 'mid' && S.ents[sn.eid]) addCon({ t: 'mid', p, e: sn.eid, auto: true });
  else if (sn.kind === 'on' && S.ents[sn.eid]) addCon({ t: 'pol', p, e: sn.eid, auto: true });
  return p;
}
function hitTest(sx, sy) {
  for (const id in labelRects) { const r = labelRects[id]; if (S.dims[id] && sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 4 && sy <= r.y + r.h + 4) return { k: 'd', id }; }
  const w = s2w(sx, sy), tol = tolPx() / view.s;
  let best = null, bd = tol;
  for (const id in S.pts) { const p = S.pts[id], d = hyp(p.x - w.x, p.y - w.y); if (d < bd) { bd = d; best = { k: 'p', id }; } }
  if (best) return best;
  for (const b of badgeRects) if (sx >= b.x - 2 && sx <= b.x + b.w + 2 && sy >= b.y - 2 && sy <= b.y + b.h + 2) return { k: 'c', id: b.id };
  bd = tol;
  for (const id in S.ents) { const d = distG(entG(S.ents[id]), w.x, w.y); if (d < bd) { bd = d; best = { k: 'e', id }; } }
  if (best) return best;
  bd = tol;
  for (const id in S.pats) for (const g of patGeoms(S.pats[id], true)) { const d = distG(g, w.x, w.y); if (d < bd) { bd = d; best = { k: 'pat', id }; } }
  return best;
}

// ---------------------------------------------------------------- tools
const HINTS = {
  select: 'Tap a line, circle or arc to dimension it. Tap two items for an angle or distance. Drag points to move geometry.',
  line: 'Line: drag from start to end, or tap the start then the end.',
  poly: 'Polyline: tap each corner. Tap the first point to close, or tap the last point again to finish.',
  rect: 'Rectangle: drag corner to corner, or tap two corners.',
  circle: 'Circle: tap the center, then a point on the rim (or drag out the radius).',
  arc: 'Arc: tap the center, the start, then sweep to the end.',
  slot: 'Slot: tap one end center, the other end center, then set the width.',
};
function setTool(name) { finishPoly(); tool = { name, step: 0 }; cur = null; closePop(); if (name !== 'select') sel = []; refresh(); }
function resetTool() { tool = { name: tool.name, step: 0 }; cur = null; dirty = true; }
function finishPoly() { if (tool.name === 'poly' && tool.step) resetTool(); }
function toolClick(sn) {
  const T = tool;
  if (T.name === 'line' || T.name === 'poly') {
    if (T.step === 0) { T.p0 = sn; T.step = 1; return; }
    if (hyp(sn.x - T.p0.x, sn.y - T.p0.y) * view.s < 4) { if (T.name === 'poly') resetTool(); return; }
    const a = T.lastPid && S.pts[T.lastPid] ? T.lastPid : ptFromSnap(T.p0), b = ptFromSnap(sn);
    if (a === b) { resetTool(); return; }
    const l = addEnt({ t: 'line', a, b }); if (sn.hv) addCon({ t: sn.hv, e: l, auto: true });
    const ok = commit();
    if (ok && T.name === 'poly' && S.pts[b] && b !== T.firstPid) { T.firstPid = T.firstPid || a; T.lastPid = b; T.p0 = { x: P(b).x, y: P(b).y, kind: 'pt', pid: b }; }
    else resetTool();
  } else if (T.name === 'rect') {
    if (T.step === 0) { T.p0 = sn; T.step = 1; return; }
    if (Math.abs(sn.x - T.p0.x) * view.s < 4 || Math.abs(sn.y - T.p0.y) * view.s < 4) return;
    const A = ptFromSnap(T.p0), C = ptFromSnap(sn), B = addPt(sn.x, T.p0.y), D = addPt(T.p0.x, sn.y);
    const l1 = addEnt({ t: 'line', a: A, b: B }), l2 = addEnt({ t: 'line', a: B, b: C }), l3 = addEnt({ t: 'line', a: C, b: D }), l4 = addEnt({ t: 'line', a: D, b: A });
    addCon({ t: 'hor', e: l1, auto: true }); addCon({ t: 'ver', e: l2, auto: true }); addCon({ t: 'hor', e: l3, auto: true }); addCon({ t: 'ver', e: l4, auto: true });
    commit(); resetTool();
  } else if (T.name === 'circle') {
    if (T.step === 0) { T.p0 = sn; T.step = 1; return; }
    const r = hyp(sn.x - T.p0.x, sn.y - T.p0.y); if (r * view.s < 4) return;
    addEnt({ t: 'circle', c: ptFromSnap(T.p0), r }); commit(); resetTool();
  } else if (T.name === 'arc') {
    if (T.step === 0) { T.p0 = sn; T.step = 1; return; }
    if (T.step === 1) { if (hyp(sn.x - T.p0.x, sn.y - T.p0.y) * view.s < 4) return; T.p1 = sn; T.step = 2; T.acc = 0; T.la = Math.atan2(sn.y - T.p0.y, sn.x - T.p0.x); return; }
    arcTrack(sn);
    if (Math.abs(T.acc) < 0.03) return;
    const r = hyp(T.p1.x - T.p0.x, T.p1.y - T.p0.y), a = Math.atan2(sn.y - T.p0.y, sn.x - T.p0.x);
    const ex = T.p0.x + r * Math.cos(a), ey = T.p0.y + r * Math.sin(a);
    const c = ptFromSnap(T.p0), s = ptFromSnap(T.p1);
    const e = (sn.pid && S.pts[sn.pid] && hyp(P(sn.pid).x - ex, P(sn.pid).y - ey) * view.s < 3) ? sn.pid : addPt(ex, ey);
    addEnt(T.acc < 0 ? { t: 'arc', c, a: e, b: s } : { t: 'arc', c, a: s, b: e }); commit(); resetTool();
  } else if (T.name === 'slot') {
    if (T.step === 0) { T.p0 = sn; T.step = 1; return; }
    if (T.step === 1) { if (hyp(sn.x - T.p0.x, sn.y - T.p0.y) * view.s < 6) return; T.p1 = sn; T.step = 2; return; }
    const g = slotGeom(T.p0, T.p1, sn); if (!g || g.r * view.s < 3) return;
    const c1 = ptFromSnap(T.p0), c2 = ptFromSnap(T.p1);
    const a1 = addPt(g.a1.x, g.a1.y), b1 = addPt(g.b1.x, g.b1.y), a2 = addPt(g.a2.x, g.a2.y), b2 = addPt(g.b2.x, g.b2.y);
    addEnt({ t: 'line', a: a1, b: a2 }); addEnt({ t: 'line', a: b1, b: b2 });
    const r1 = addEnt({ t: 'arc', c: c1, a: a1, b: b1 }), r2 = addEnt({ t: 'arc', c: c2, a: b2, b: a2 });
    addCon({ t: 'perp4', p1: c1, p2: a1, p3: a1, p4: a2, auto: true, hid: true }); addCon({ t: 'perp4', p1: c2, p2: a2, p3: a1, p4: a2, auto: true, hid: true });
    addCon({ t: 'perp4', p1: c1, p2: b1, p3: b1, p4: b2, auto: true, hid: true }); addCon({ t: 'perp4', p1: c2, p2: b2, p3: b1, p4: b2, auto: true, hid: true });
    addCon({ t: 'eq', e1: r1, e2: r2, auto: true, hid: true });
    if (T.p1.hv) addCon({ t: T.p1.hv === 'hor' ? 'hpp' : 'vpp', p: c1, q: c2, auto: true });
    commit(); resetTool();
  }
}
function arcTrack(sn) { const T = tool, a = Math.atan2(sn.y - T.p0.y, sn.x - T.p0.x); let d = a - T.la; while (d > PI) d -= TAU; while (d < -PI) d += TAU; T.acc += d; T.la = a; if (T.acc > TAU) T.acc -= TAU; if (T.acc < -TAU) T.acc += TAU; }
function slotGeom(p0, p1, w) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, L = hyp(dx, dy); if (L < 1e-9) return null;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, r = Math.abs((w.x - p0.x) * nx + (w.y - p0.y) * ny);
  return { r, a1: { x: p0.x + nx * r, y: p0.y + ny * r }, b1: { x: p0.x - nx * r, y: p0.y - ny * r }, a2: { x: p1.x + nx * r, y: p1.y + ny * r }, b2: { x: p1.x - nx * r, y: p1.y - ny * r }, ang: Math.atan2(uy, ux) };
}
const refPt = () => (tool.step >= 1 && (tool.name === 'line' || tool.name === 'poly' || (tool.name === 'slot' && tool.step === 1))) ? tool.p0 : null;

// ---------------------------------------------------------------- selection, dimensions, constraints
const isSel = (k, id) => sel.some(s => s.k === k && s.id === id);
function toggleSel(h) { const i = sel.findIndex(s => s.k === h.k && s.id === h.id); if (i >= 0) sel.splice(i, 1); else { if (h.k === 'd' || h.k === 'c' || h.k === 'pat') sel = []; else sel = sel.filter(s => s.k === 'p' || s.k === 'e'); sel.push(h); } }
function findDim(o) {
  for (const id in S.dims) { const d = S.dims[id]; if (d.t !== o.t) continue;
    if (o.t === 'len' && ((d.p === o.p && d.q === o.q) || (d.p === o.q && d.q === o.p))) return id;
    if (o.t === 'pld' && d.p === o.p && d.e === o.e) return id;
    if (o.t === 'ang' && ((d.e1 === o.e1 && d.e2 === o.e2) || (d.e1 === o.e2 && d.e2 === o.e1))) return id;
    if ((o.t === 'dia' || o.t === 'rad') && d.e === o.e) return id; }
  return null;
}
// What dimension does the current selection offer?
function dimOffer() {
  const pts = sel.filter(s => s.k === 'p').map(s => s.id), ents = sel.filter(s => s.k === 'e').map(s => s.id), E = S.ents;
  let o = null, cur0 = 0, label = '';
  const ptLine = (p, e) => { const g = entG(E[e]), d = lineDir(E[e]); return Math.abs((P(p).x - g.x1) * -d.y + (P(p).y - g.y1) * d.x); };
  const pp = (p, q) => hyp(P(p).x - P(q).x, P(p).y - P(q).y);
  if (ents.length === 1 && !pts.length) {
    const e = E[ents[0]];
    if (e.t === 'line') { o = { t: 'len', p: e.a, q: e.b }; cur0 = lineDir(e).L; label = 'Length'; }
    else if (e.t === 'circle') { o = { t: 'dia', e: ents[0] }; cur0 = e.r * 2; label = 'Diameter'; }
    else { o = { t: 'rad', e: ents[0] }; cur0 = entG(e).r; label = 'Radius'; }
  } else if (ents.length === 2 && !pts.length) {
    const [i, j] = ents, a = E[i], b = E[j];
    if (a.t === 'line' && b.t === 'line') {
      const d1 = lineDir(a), d2 = lineDir(b);
      if (Math.abs(d1.x * d2.y - d1.y * d2.x) < 0.02) { o = { t: 'pld', p: b.a, e: i }; cur0 = ptLine(b.a, i); label = 'Distance'; }
      else { const s = angSetup(a, b); if (s) { o = { t: 'ang', e1: i, e2: j, s1: s.s1, s2: s.s2, sg: s.sg }; cur0 = s.cur; label = 'Angle'; } }
    } else if (a.t === 'line' || b.t === 'line') { const l = a.t === 'line' ? i : j, r = a.t === 'line' ? b : a; o = { t: 'pld', p: r.c, e: l }; cur0 = ptLine(r.c, l); label = 'Center to line'; }
    else if (a.c !== b.c) { o = { t: 'len', p: a.c, q: b.c }; cur0 = pp(a.c, b.c); label = 'Center to center'; }
  } else if (pts.length === 1 && ents.length === 1) {
    const e = E[ents[0]];
    if (e.t === 'line') { if (e.a !== pts[0] && e.b !== pts[0]) { o = { t: 'pld', p: pts[0], e: ents[0] }; cur0 = ptLine(pts[0], ents[0]); label = 'Distance'; } }
    else if (e.c !== pts[0]) { o = { t: 'len', p: pts[0], q: e.c }; cur0 = pp(pts[0], e.c); label = 'Distance to center'; }
  } else if (pts.length === 2 && !ents.length) { o = { t: 'len', p: pts[0], q: pts[1] }; cur0 = pp(pts[0], pts[1]); label = 'Distance'; }
  if (!o) return null;
  const ex = findDim(o);
  return { o, label, existing: ex, value: ex ? S.dims[ex].v : cur0, ang: o.t === 'ang' };
}
function defaultOff(o) {
  if (o.t === 'ang') return 46 / view.s;
  if (o.t === 'dia') return PI / 4;
  if (o.t === 'rad') { const g = entG(S.ents[o.e]); return (g.sa + g.ea) / 2; }
  return 30 / view.s;
}
function applyDim(offer, v) {
  if (!(v > 0) || (offer.ang && v >= 180)) { toast(offer.ang ? 'Enter an angle between 0 and 180' : 'Enter a value greater than 0'); return false; }
  if (offer.existing) S.dims[offer.existing].v = v; else addDim(Object.assign({}, offer.o, { v, off: defaultOff(offer.o) }));
  const ok = commit(); if (ok) { sel = []; closePop(); refresh(); } return ok;
}
function applyCon(type) {
  const pts = sel.filter(s => s.k === 'p').map(s => s.id), ents = sel.filter(s => s.k === 'e').map(s => s.id), E = S.ents;
  const lines = ents.filter(i => E[i].t === 'line'), rounds = ents.filter(i => E[i].t !== 'line');
  let need = null;
  switch (type) {
    case 'hor': case 'ver':
      if (lines.length) lines.forEach(e => addCon({ t: type, e }));
      else if (pts.length === 2) addCon({ t: type === 'hor' ? 'hpp' : 'vpp', p: pts[0], q: pts[1] });
      else need = 'Select a line (or two points) first'; break;
    case 'par': case 'perp':
      if (lines.length >= 2) for (let i = 1; i < lines.length; i++) addCon({ t: type, e1: lines[0], e2: lines[i] }); else need = 'Select two lines first'; break;
    case 'tan':
      if (lines.length === 1 && rounds.length === 1) addCon({ t: 'tan', e1: lines[0], e2: rounds[0] });
      else if (!lines.length && rounds.length === 2) addCon({ t: 'tan', e1: rounds[0], e2: rounds[1] });
      else need = 'Select a line and a circle/arc, or two circles/arcs'; break;
    case 'eq':
      if (lines.length >= 2 && !rounds.length) for (let i = 1; i < lines.length; i++) addCon({ t: 'eq', e1: lines[0], e2: lines[i] });
      else if (rounds.length >= 2 && !lines.length) for (let i = 1; i < rounds.length; i++) addCon({ t: 'eq', e1: rounds[0], e2: rounds[i] });
      else need = 'Select two lines, or two circles/arcs'; break;
    case 'coi':
      if (pts.length === 2 && !ents.length) { if (P(pts[1]).fixed && !P(pts[0]).fixed) pts.reverse(); mergePts(pts[0], pts[1]); }
      else if (pts.length === 1 && ents.length === 1 && !entPts(E[ents[0]]).includes(pts[0])) addCon({ t: 'pol', p: pts[0], e: ents[0] });
      else need = 'Select two points, or a point and a line/circle'; break;
    case 'conc':
      if (rounds.length === 2 && !lines.length) mergePts(E[rounds[0]].c, E[rounds[1]].c); else need = 'Select two circles or arcs'; break;
    case 'sym':
      if (pts.length === 2 && lines.length === 1) addCon({ t: 'sym', p: pts[0], q: pts[1], e: lines[0] }); else need = 'Select two points and the mirror line'; break;
    case 'mid':
      if (pts.length === 1 && lines.length === 1 && !entPts(E[lines[0]]).includes(pts[0])) addCon({ t: 'mid', p: pts[0], e: lines[0] }); else need = 'Select a point and a line'; break;
    case 'fix': {
      const ids = new Set(pts); ents.forEach(i => entPts(E[i]).forEach(p => ids.add(p))); ids.delete('p0');
      if (!ids.size) { need = 'Select points or geometry to lock in place'; break; }
      const on = [...ids].some(p => !P(p).fixed); ids.forEach(p => { if (on) P(p).fixed = true; else delete P(p).fixed; }); break;
    }
  }
  if (need) { if (tool.name !== 'select') setTool('select'); toast(need); return; }
  closePop();
  if (commit()) { sel = []; refresh(); }
}
function deleteSel() {
  if (!sel.length) { toast('Select something to delete first'); return; }
  let n = 0;
  for (const s of sel) {
    if (s.k === 'e' && S.ents[s.id]) { delete S.ents[s.id]; n++; }
    else if (s.k === 'd' && S.dims[s.id]) { delete S.dims[s.id]; n++; }
    else if (s.k === 'c' && S.cons[s.id]) { delete S.cons[s.id]; n++; }
    else if (s.k === 'pat' && S.pats[s.id]) { delete S.pats[s.id]; n++; }
  }
  if (!n) { toast('Points are removed with their geometry — select the line or circle'); return; }
  sel = []; closePop(); commit();
}
function toggleConstr() {
  const ents = sel.filter(s => s.k === 'e');
  if (ents.length) { const on = ents.some(s => !S.ents[s.id].con); ents.forEach(s => { if (on) S.ents[s.id].con = true; else delete S.ents[s.id].con; }); commit(); showSelPop(); }
  else { constrMode = !constrMode; toast(constrMode ? 'Construction mode on — new geometry is reference only' : 'Construction mode off'); refresh(); }
}
function startPattern(kind) {
  const ents = sel.filter(s => s.k === 'e').map(s => s.id);
  if (!ents.length) { if (tool.name !== 'select') setTool('select'); toast('Select the geometry to pattern first, then tap ' + (kind === 'circ' ? 'Circular' : 'Rectangular')); return; }
  const id = nid('n');
  S.pats[id] = kind === 'circ' ? { t: 'circ', src: ents, c: 'p0', n: 4, ang: 360 } : { t: 'rect', src: ents, n1: 2, d1: 1, n2: 1, d2: 1, rot: 0 };
  sel = [{ k: 'pat', id }]; showPatPop(id, true); refresh();
}

// ---------------------------------------------------------------- popup (dimension entry near selection)
const pop = $('#pop');
let popState = null;
function closePop(revert) {
  if (popState && popState.dirtyDraft && revert !== false) { restore(hist[hi]); }
  popState = null; pop.classList.remove('on'); pop.innerHTML = ''; dirty = true;
}
function selAnchor() {
  let xs = [], ys = [];
  const add = (x, y) => { const [sx, sy] = w2s(x, y); xs.push(sx); ys.push(sy); };
  for (const s of sel) {
    if (s.k === 'p' && S.pts[s.id]) add(P(s.id).x, P(s.id).y);
    else if (s.k === 'e' && S.ents[s.id]) { const b = bboxG([entG(S.ents[s.id])]); add(b.x0, b.y0); add(b.x1, b.y1); }
    else if (s.k === 'd' && labelRects[s.id]) { const r = labelRects[s.id]; xs.push(r.x, r.x + r.w); ys.push(r.y, r.y + r.h); }
    else if (s.k === 'pat' && S.pats[s.id]) { const b = bboxG(patGeoms(S.pats[s.id], true)); if (b) { add(b.x0, b.y0); add(b.x1, b.y1); } }
    else if (s.k === 'c') { const b = badgeRects.find(b => b.id === s.id); if (b) { xs.push(b.x); ys.push(b.y); } }
  }
  if (!xs.length) return { x: CW / 2, y: CH / 2, x0: CW / 2, x1: CW / 2, y0: CH / 2, y1: CH / 2 };
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
// spec: {title, fields:[{key,label,value,unit,kind}], actions:[{label,fn,cls}], onOk(vals), onChange(vals)}
function openPop(spec) {
  pop.innerHTML = ''; popState = { spec, active: 0, fresh: true, vals: spec.fields.map(f => f.value), dirtyDraft: !!spec.draft };
  const ttl = el('div', { class: 'ttl' }, spec.title, el('button', { class: 'x', 'aria-label': 'Close', onclick: () => { closePop(); sel = []; refresh(); } }, '×'));
  ttl.addEventListener('pointerdown', ev => { if (ev.target !== ttl) return; const sx = ev.clientX - pop.offsetLeft, sy = ev.clientY - pop.offsetTop; try { ttl.setPointerCapture(ev.pointerId); } catch (_) {}
    const mv = e2 => { pop.style.left = Math.max(0, Math.min(CW - 60, e2.clientX - sx)) + 'px'; pop.style.top = Math.max(0, Math.min(CH - 40, e2.clientY - sy)) + 'px'; };
    const up = () => { ttl.removeEventListener('pointermove', mv); ttl.removeEventListener('pointerup', up); ttl.removeEventListener('pointercancel', up); };
    ttl.addEventListener('pointermove', mv); ttl.addEventListener('pointerup', up); ttl.addEventListener('pointercancel', up); });
  pop.append(ttl);
  spec.fields.forEach((f, i) => pop.append(el('div', { class: 'fld', 'data-i': i, onclick: () => { popState.active = i; popState.fresh = true; paintPop(); } },
    el('span', { class: 'fl' }, f.label), el('span', { class: 'fv' }), el('span', { class: 'fu' }, f.unit || ''))));
  if (spec.fields.length) {
    const keys = ['7', '8', '9', '/', '4', '5', '6', '␣', '1', '2', '3', '⌫', '0', '.', spec.fields.some(f => f.kind === 'len' || f.kind === 'slen') ? 'mm' : '−', '✓'];
    pop.append(el('div', { class: 'keys' }, keys.map(k => el('button', { class: k === '✓' ? 'okk' : '', 'aria-label': k === '␣' ? 'space' : k === '⌫' ? 'backspace' : k === '✓' ? 'OK' : k, onclick: () => popKey(k) }, k))));
  }
  if (spec.actions && spec.actions.length) pop.append(el('div', { class: 'acts' }, spec.actions.map(a => el('button', { class: a.cls || '', onclick: a.fn }, a.label))));
  pop.classList.add('on'); paintPop();
  placePop();
  if (window.innerWidth <= 760) {      // phone: the popup is a bottom sheet, so slide the selection into view above it
    const an = selAnchor(), lim = CH - pop.offsetHeight - 40;
    if (an.y1 > lim) { view.oy -= Math.min(an.y1 - lim, Math.max(0, an.y0 - 30)); dirty = true; }
  }
}
// Put the popup next to the selection, on whichever side hides the least geometry.
function placePop() {
  const a = selAnchor(), pw = pop.offsetWidth, ph = pop.offsetHeight, g = 24;
  const cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2, cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const samples = [];
  const addS = (x, y) => { const [sx, sy] = w2s(x, y); if (sx > -20 && sx < CW + 20 && sy > -20 && sy < CH + 20) samples.push([sx, sy]); };
  const sampleG = q => { for (let k = 0; k <= 8; k++) { const t = k / 8; if (q.t === 'line') addS(q.x1 + (q.x2 - q.x1) * t, q.y1 + (q.y2 - q.y1) * t); else { const an = q.t === 'circle' ? t * TAU : q.sa + (q.ea - q.sa) * t; addS(q.cx + q.r * Math.cos(an), q.cy + q.r * Math.sin(an)); } } };
  for (const id in S.ents) sampleG(entG(S.ents[id]));
  for (const id in S.pats) patGeoms(S.pats[id], true).forEach(sampleG);
  const cands = [[a.x1 + g, cy - ph / 2], [a.x0 - g - pw, cy - ph / 2], [cx - pw / 2, a.y1 + g], [cx - pw / 2, a.y0 - g - ph],
    [a.x1 + g, a.y1 + g], [a.x0 - g - pw, a.y1 + g], [a.x1 + g, a.y0 - g - ph], [a.x0 - g - pw, a.y0 - g - ph],
    [CW - pw - 10, 10], [10, 10], [CW - pw - 10, CH - ph - 10], [10, CH - ph - 10], [CW - pw - 10, cy - ph / 2], [10, cy - ph / 2]];
  let best = null, bs = Infinity;
  for (const [x0, y0] of cands) {
    const x = cl(x0, 8, Math.max(8, CW - pw - 8)), y = cl(y0, 8, Math.max(8, CH - ph - 8));
    let hits = 0; for (const [sx, sy] of samples) if (sx > x - 14 && sx < x + pw + 14 && sy > y - 14 && sy < y + ph + 14) hits++;
    const ox = Math.max(0, Math.min(x + pw, a.x1) - Math.max(x, a.x0)), oy = Math.max(0, Math.min(y + ph, a.y1) - Math.max(y, a.y0));
    const covers = (ox > 0 || a.x1 === a.x0 && x < a.x0 && x + pw > a.x0) && (oy > 0 || a.y1 === a.y0 && y < a.y0 && y + ph > a.y0) ? 1 : 0;
    const dist = hyp(x + pw / 2 - cx, y + ph / 2 - cy);
    const score = covers * 1e6 + hits * 400 + dist;
    if (score < bs) { bs = score; best = [x, y]; }
  }
  pop.style.left = best[0] + 'px'; pop.style.top = best[1] + 'px';
}
function paintPop() {
  if (!popState) return;
  pop.querySelectorAll('.fld').forEach((n, i) => { n.classList.toggle('on', i === popState.active); const fv = n.querySelector('.fv'); fv.textContent = popState.vals[i]; fv.classList.toggle('sel', i === popState.active && popState.fresh); });
}
function popVals() {
  const out = {}; let ok = true;
  popState.spec.fields.forEach((f, i) => {
    const s = String(popState.vals[i]).replace('−', '-');
    let v = (f.kind === 'len' || f.kind === 'slen') ? parseLen(s) : parseNum(s);
    if (f.kind === 'int') v = Math.round(v);
    if (!isFinite(v) || (f.kind === 'len' && v <= 0) || (f.kind === 'int' && v < 1)) ok = false;
    out[f.key] = v;
  });
  return ok ? out : null;
}
function popKey(k) {
  if (!popState || !popState.spec.fields.length) return;
  const i = popState.active;
  if (k === '✓' || k === 'Enter') { const v = popVals(); if (!v) { toast('Check the value — use decimals, fractions like 1 3/8, or mm'); return; } popState.spec.onOk(v); return; }
  let s = popState.fresh ? '' : String(popState.vals[i]);
  if (k === '⌫' || k === 'Backspace') s = popState.fresh ? '' : s.slice(0, -1);
  else if (k === '␣' || k === ' ') s += ' ';
  else if (k === '−' || k === '-') s = s.startsWith('−') ? s.slice(1) : '−' + s;
  else if (k === 'mm') s = s.replace(/mm$/, '') + 'mm';
  else s = s.replace(/mm$/, '') + k + (/mm$/.test(s) ? 'mm' : '');
  popState.vals[i] = s; popState.fresh = false; paintPop();
  if (popState.spec.onChange) { const v = popVals(); if (v) popState.spec.onChange(v); }
}
function showSelPop() {
  if (!sel.length) { closePop(); return; }
  const s0 = sel[0];
  if (s0.k === 'pat') { showPatPop(s0.id, false); return; }
  if (s0.k === 'c') {
    const c = S.cons[s0.id]; if (!c) return;
    openPop({ title: CON_NAMES[c.t] + ' constraint', fields: [], actions: [{ label: 'Delete constraint', cls: 'dg', fn: deleteSel }] }); return;
  }
  if (s0.k === 'd') {
    const d = S.dims[s0.id]; if (!d) return;
    openPop({ title: DIM_NAMES[d.t], fields: [{ key: 'v', label: 'Value', value: fmt(d.v), unit: d.t === 'ang' ? '°' : 'in', kind: d.t === 'ang' ? 'num' : 'len' }],
      actions: [{ label: 'Delete dimension', cls: 'dg', fn: deleteSel }],
      onOk: v => applyDim({ existing: s0.id, ang: d.t === 'ang' }, v.v) }); return;
  }
  const offer = dimOffer(), ents = sel.filter(s => s.k === 'e');
  const acts = [];
  if (ents.length) { const allCon = ents.every(s => S.ents[s.id].con); acts.push({ label: 'Construction', cls: allCon ? 'on' : '', fn: toggleConstr }, { label: 'Delete', cls: 'dg', fn: deleteSel }); }
  if (!offer && !acts.length) { closePop(); return; }
  const n = sel.length;
  openPop({ title: offer ? offer.label + (offer.existing ? '' : ' — type to set') : n + ' selected',
    fields: offer ? [{ key: 'v', label: offer.existing ? 'Value' : 'Now', value: fmt(offer.value), unit: offer.ang ? '°' : 'in', kind: offer.ang ? 'num' : 'len' }] : [],
    actions: acts, onOk: v => applyDim(offer, v.v) });
}
function showPatPop(id, isNew) {
  const p = S.pats[id]; if (!p) return;
  const upd = v => { Object.assign(S.pats[id], v); popState.dirtyDraft = true; dirty = true; };
  const done = v => { Object.assign(S.pats[id], v); popState.dirtyDraft = false; closePop(false); sel = []; commit(); };
  const acts = [];
  if (p.t === 'circ') acts.push({ label: 'Pick center', fn: () => { popState.pick = true; toast('Tap the point to pattern around'); } });
  acts.push({ label: 'Delete', cls: 'dg', fn: () => { popState.dirtyDraft = false; delete S.pats[id]; closePop(false); sel = []; commit(); } });
  const fields = p.t === 'circ'
    ? [{ key: 'n', label: 'Count', value: String(p.n), kind: 'int' }, { key: 'ang', label: 'Angle', value: fmt(p.ang), unit: '°', kind: 'num' }]
    : [{ key: 'n1', label: 'Count →', value: String(p.n1), kind: 'int' }, { key: 'd1', label: 'Spacing →', value: fmt(p.d1), unit: 'in', kind: 'slen' },
       { key: 'n2', label: 'Count ↑', value: String(p.n2), kind: 'int' }, { key: 'd2', label: 'Spacing ↑', value: fmt(p.d2), unit: 'in', kind: 'slen' },
       { key: 'rot', label: 'Rotate', value: fmt(p.rot || 0), unit: '°', kind: 'num' }];
  openPop({ title: p.t === 'circ' ? 'Circular pattern' : 'Rectangular pattern', fields, actions: acts, onOk: done, onChange: upd, draft: isNew });
}
const CON_NAMES = { hor: 'Horizontal', ver: 'Vertical', hpp: 'Horizontal', vpp: 'Vertical', par: 'Parallel', perp: 'Perpendicular', tan: 'Tangent', eq: 'Equal', pol: 'Coincident', mid: 'Midpoint', sym: 'Symmetric', perp4: 'Slot' };
const CON_TAG = { hor: 'H', ver: 'V', hpp: 'H', vpp: 'V', par: '∥', perp: '⊥', tan: 'T', eq: '=', pol: '◦', mid: 'M', sym: 'S' };
const DIM_NAMES = { len: 'Length', pld: 'Distance', ang: 'Angle', dia: 'Diameter', rad: 'Radius' };

// ---------------------------------------------------------------- pointer input
const ptrs = new Map();
let act = null, nav = null;
const evPos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function touchPts() { return [...ptrs.values()].filter(p => p.type === 'touch'); }
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  const p = evPos(e); lastPtrType = e.pointerType || 'mouse'; if (e.pointerType === 'pen') penSeen = true;
  ptrs.set(e.pointerId, { x: p.x, y: p.y, type: e.pointerType });
  if (e.pointerType === 'touch') {
    const t = touchPts();
    if (t.length === 2) { cancelAct(); nav = { mode: 'pinch', d: hyp(t[0].x - t[1].x, t[0].y - t[1].y), cx: (t[0].x + t[1].x) / 2, cy: (t[0].y + t[1].y) / 2 }; return; }
    if (t.length > 2) return;
    if (penSeen && !settings.fingerDraw) { nav = { mode: 'pan', id: e.pointerId, x: p.x, y: p.y }; return; }
  }
  if (e.pointerType === 'mouse' && e.button !== 0) { nav = { mode: 'pan', id: e.pointerId, x: p.x, y: p.y }; return; }
  if (act) return;
  actDown(p, e);
});
cv.addEventListener('pointermove', e => {
  const p = evPos(e), rec = ptrs.get(e.pointerId);
  if (rec) { rec.x = p.x; rec.y = p.y; }
  if (nav) {
    if (nav.mode === 'pinch') { const t = touchPts(); if (t.length >= 2) { const d = hyp(t[0].x - t[1].x, t[0].y - t[1].y), cx = (t[0].x + t[1].x) / 2, cy = (t[0].y + t[1].y) / 2; view.ox += cx - nav.cx; view.oy += cy - nav.cy; if (nav.d > 0) zoomAt(cx, cy, d / nav.d); nav.d = d; nav.cx = cx; nav.cy = cy; dirty = true; } }
    else if (nav.id === e.pointerId) { view.ox += p.x - nav.x; view.oy += p.y - nav.y; nav.x = p.x; nav.y = p.y; dirty = true; }
    return;
  }
  if (e.pointerType !== 'touch' || act) { lastPtrType = e.pointerType || 'mouse'; }
  const w = s2w(p.x, p.y); $('#xy').textContent = 'X ' + w.x.toFixed(3) + '   Y ' + w.y.toFixed(3);
  if (act && act.id === e.pointerId) actMove(p);
  else if (!act && e.pointerType !== 'touch') { if (tool.name !== 'select') { cur = snap(p.x, p.y, refPt()); if (tool.name === 'arc' && tool.step === 2) arcTrack(cur); } else { const h = hitTest(p.x, p.y); hover = h; } dirty = true; }
});
function endPtr(e, cancel) {
  const p = evPos(e); ptrs.delete(e.pointerId);
  if (nav) { if (nav.mode === 'pinch') { if (touchPts().length < 2) nav = null; } else if (nav.id === e.pointerId) nav = null; return; }
  if (act && act.id === e.pointerId) { if (cancel) cancelAct(); else actUp(p); }
}
cv.addEventListener('pointerup', e => endPtr(e, false));
cv.addEventListener('pointercancel', e => endPtr(e, true));
cv.addEventListener('pointerleave', e => { if (!act && e.pointerType !== 'touch') { hover = null; if (tool.step === 0) cur = null; dirty = true; } });
cv.addEventListener('wheel', e => { e.preventDefault(); const p = evPos(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

function cancelAct() {
  if (!act) return;
  if (act.dragging && act.pre) { restore(act.pre); }
  if (act.downClicked && tool.step === 1 && tool.name !== 'poly') resetTool();
  act = null; dirty = true;
}
function actDown(p, e) {
  act = { id: e.pointerId, x0: p.x, y0: p.y, moved: false };
  if (tool.name === 'select') {
    if (popState && popState.pick) { const h = hitTest(p.x, p.y); act.pick = h; return; }
    act.hit = hitTest(p.x, p.y);
  } else {
    closePop();
    cur = snap(p.x, p.y, refPt());
    if (tool.step === 0) { toolClick(cur); act.downClicked = true; }
    dirty = true;
  }
}
function actMove(p) {
  const thr = lastPtrType === 'touch' ? 10 : 6;
  if (!act.moved && hyp(p.x - act.x0, p.y - act.y0) > thr) { act.moved = true; if (tool.name === 'select') beginDrag(p); }
  if (tool.name !== 'select') { cur = snap(p.x, p.y, refPt()); if (tool.name === 'arc' && tool.step === 2) arcTrack(cur); dirty = true; return; }
  if (act.moved) doDrag(p);
}
function actUp(p) {
  const a = act; act = null;
  if (tool.name !== 'select') {
    cur = snap(p.x, p.y, refPt());
    if (a.downClicked && !a.moved) { dirty = true; return; }     // first tap: wait for the next one
    toolClick(cur); if (lastPtrType === 'touch' && tool.step === 0) cur = null; dirty = true; return;
  }
  if (a.pick !== undefined) {
    if (a.pick && a.pick.k === 'p' && popState && popState.pick) { const id = sel[0] && sel[0].id; if (S.pats[id]) { S.pats[id].c = a.pick.id; popState.pick = false; popState.dirtyDraft = true; toast('Center set'); dirty = true; } }
    else toast('Tap a point (an endpoint, a circle center or the origin)');
    return;
  }
  if (a.moved) { endDrag(a); return; }
  // tap
  if (popState && popState.dirtyDraft) closePop();
  if (!a.hit) { sel = []; closePop(); refresh(); return; }
  toggleSel(a.hit); refresh(); showSelPop();
}
function beginDrag(p) {
  const h = act.hit; act.pre = hist[hi];
  if (!h) { act.drag = 'pan'; act.lx = act.x0; act.ly = act.y0; return; }
  closePop();
  if (h.k === 'd') { act.drag = 'dim'; act.dragging = true; return; }
  if (h.k === 'p') { if (P(h.id).fixed) { act.drag = 'none'; toast(h.id === 'p0' ? 'The origin is fixed' : 'That point is locked (Fix)'); return; } act.drag = 'pts'; act.pts = [{ p: h.id, x: P(h.id).x, y: P(h.id).y }]; act.dragging = true; return; }
  if (h.k === 'e') {
    const e = S.ents[h.id];
    if (e.t === 'circle') { act.drag = 'rad'; act.dragging = true; return; }
    const ids = e.t === 'line' ? [e.a, e.b] : [e.a, e.b, e.c];
    if (ids.some(i => P(i).fixed)) { act.drag = 'none'; return; }
    act.drag = 'pts'; act.pts = ids.map(i => ({ p: i, x: P(i).x, y: P(i).y })); act.dragging = true; return;
  }
  act.drag = 'none';
}
function doDrag(p) {
  const w = s2w(p.x, p.y), w0 = s2w(act.x0, act.y0), h = act.hit;
  if (act.drag === 'pan') { view.ox += p.x - act.lx; view.oy += p.y - act.ly; act.lx = p.x; act.ly = p.y; dirty = true; return; }
  if (act.drag === 'pts') {
    const dx = w.x - w0.x, dy = w.y - w0.y;
    if (gcs) solve({ temp: act.pts.map(t => ({ p: t.p, x: t.x + dx, y: t.y + dy })) });
    else act.pts.forEach(t => { P(t.p).x = t.x + dx; P(t.p).y = t.y + dy; });
    dirty = true;
  } else if (act.drag === 'rad') {
    const e = S.ents[h.id], c = P(e.c), old = e.r; e.r = Math.max(1e-3, hyp(w.x - c.x, w.y - c.y)); if (gcs && !solve().ok) e.r = old; dirty = true;
  } else if (act.drag === 'dim') {
    const d = S.dims[h.id]; if (!d) return;
    if (d.t === 'len') { const a = P(d.p), b = P(d.q), L = hyp(b.x - a.x, b.y - a.y) || 1; d.off = ((w.x - (a.x + b.x) / 2) * -(b.y - a.y) + (w.y - (a.y + b.y) / 2) * (b.x - a.x)) / L; }
    else if (d.t === 'pld') { const u = lineDir(S.ents[d.e]), q = P(d.p); d.off = (w.x - q.x) * u.x + (w.y - q.y) * u.y; }
    else if (d.t === 'ang') { const X = intersectLL(S.ents[d.e1], S.ents[d.e2]); if (X) d.off = Math.max(12 / view.s, hyp(w.x - X.x, w.y - X.y)); }
    else { const c = P(S.ents[d.e].c); d.off = Math.atan2(w.y - c.y, w.x - c.x); }
    dirty = true;
  }
}
function endDrag(a) {
  if (a.drag === 'pts' || a.drag === 'rad' || a.drag === 'dim') { if (snapshot() !== hist[hi]) { pushHist(); refresh(); } }
  dirty = true;
}

// keyboard (hardware keyboards)
document.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (popState && popState.spec.fields.length && (/^[0-9./ \-m]$/.test(e.key) || e.key === 'Backspace' || e.key === 'Enter')) { e.preventDefault(); if (e.key === 'm') popKey('mm'); else popKey(e.key); return; }
  if (e.key === 'Escape') { if (popState) { closePop(); sel = []; refresh(); } else if (tool.step) resetTool(); else setTool('select'); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.length) deleteSel(); }
});

// ---------------------------------------------------------------- rendering
function pal() {
  const L = settings.theme === 'light';
  return L ? { bg: '#eef1f4', grid: '#dfe4e9', grid2: '#c9d1d9', axis: '#9aa6b2', geo: '#12202e', con: '#b0741a', pt: '#12202e', sel: '#e07a00', dim: '#1c7a4c', pat: '#6f8194', prev: '#e07a00', badge: '#5a6876', badgeBg: '#ffffff', fix: '#c62828', lbl: '#ffffff' }
    : { bg: '#14181d', grid: '#1c2229', grid2: '#27303a', axis: '#4a5866', geo: '#e9eef3', con: '#c79a4a', pt: '#e9eef3', sel: '#ff9f1c', dim: '#5fd39a', pat: '#7b8b9b', prev: '#ff9f1c', badge: '#aab6c2', badgeBg: '#232a33', fix: '#ff6b6b', lbl: '#14181d' };
}
function strokeG(g) {
  ctx.beginPath();
  if (g.t === 'line') { const [a, b] = w2s(g.x1, g.y1), [c, d] = w2s(g.x2, g.y2); ctx.moveTo(a, b); ctx.lineTo(c, d); }
  else { const [x, y] = w2s(g.cx, g.cy); if (g.t === 'circle') ctx.arc(x, y, g.r * view.s, 0, TAU); else ctx.arc(x, y, g.r * view.s, -g.sa, -g.ea, true); }
  ctx.stroke();
}
function arrow(x, y, ang, c) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, 3.2); ctx.lineTo(-9, -3.2); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.restore(); }
function label(id, text, sx, sy, c, C, on) {
  ctx.font = '600 13px -apple-system,Segoe UI,Roboto,sans-serif'; const w = ctx.measureText(text).width + 12, h = 22;
  const r = { x: sx - w / 2, y: sy - h / 2, w, h }; labelRects[id] = r;
  ctx.fillStyle = on ? C.sel : C.bg; ctx.strokeStyle = on ? C.sel : c; ctx.lineWidth = 1;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(r.x, r.y, w, h, 6); else ctx.rect(r.x, r.y, w, h); ctx.fill(); ctx.stroke();
  ctx.fillStyle = on ? C.lbl : c; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, sx, sy + 0.5);
}
function drawDim(id, d, C) {
  const on = isSel('d', id), c = on ? C.sel : C.dim; ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.setLineDash([]);
  const seg = (x1, y1, x2, y2) => { const [a, b] = w2s(x1, y1), [e, f] = w2s(x2, y2); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(e, f); ctx.stroke(); return [a, b, e, f]; };
  if (d.t === 'len' || d.t === 'pld') {
    let A, B, n;
    if (d.t === 'len') { A = P(d.p); B = P(d.q); const L = hyp(B.x - A.x, B.y - A.y) || 1; n = { x: -(B.y - A.y) / L, y: (B.x - A.x) / L }; }
    else { const e = S.ents[d.e], u = lineDir(e), a = P(e.a); A = P(d.p); const t = (A.x - a.x) * u.x + (A.y - a.y) * u.y; B = { x: a.x + u.x * t, y: a.y + u.y * t }; n = u; }
    const A2 = { x: A.x + n.x * d.off, y: A.y + n.y * d.off }, B2 = { x: B.x + n.x * d.off, y: B.y + n.y * d.off };
    ctx.globalAlpha = 0.55; seg(A.x, A.y, A2.x, A2.y); seg(B.x, B.y, B2.x, B2.y); ctx.globalAlpha = 1;
    const [a, b, e, f] = seg(A2.x, A2.y, B2.x, B2.y), an = Math.atan2(f - b, e - a);
    if (hyp(e - a, f - b) > 26) { arrow(a, b, an + PI, c); arrow(e, f, an, c); }
    label(id, fmt(d.v), (a + e) / 2, (b + f) / 2, c, C, on);
  } else if (d.t === 'ang') {
    const e1 = S.ents[d.e1], e2 = S.ents[d.e2], X = intersectLL(e1, e2); if (!X) return;
    const d1 = lineDir(e1), a1 = Math.atan2(d1.y * d.s1, d1.x * d.s1), sw = d.sg * d.v * PI / 180, R = d.off;
    const [x, y] = w2s(X.x, X.y); ctx.beginPath(); ctx.arc(x, y, R * view.s, -a1, -(a1 + sw), sw > 0); ctx.stroke();
    const am = a1 + sw / 2, [lx, ly] = w2s(X.x + R * Math.cos(am), X.y + R * Math.sin(am)); label(id, fmt(d.v) + '°', lx, ly, c, C, on);
  } else {
    const e = S.ents[d.e], g = entG(e), a = d.off, ux = Math.cos(a), uy = Math.sin(a), ext = 34 / view.s;
    const from = d.t === 'dia' ? { x: g.cx - ux * g.r, y: g.cy - uy * g.r } : { x: g.cx, y: g.cy };
    const [p, q, r, s] = seg(from.x, from.y, g.cx + ux * (g.r + ext), g.cy + uy * (g.r + ext));
    const [rx, ry] = w2s(g.cx + ux * g.r, g.cy + uy * g.r), an = Math.atan2(s - q, r - p); arrow(rx, ry, an, c); if (d.t === 'dia') arrow(p, q, an + PI, c);
    label(id, (d.t === 'dia' ? '⌀' : 'R') + fmt(d.v), r + Math.cos(an) * 16, s + Math.sin(an) * 12, c, C, on);
  }
}
function render() {
  const C = pal(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CW, CH);
  // grid
  const steps = [0.0625, 0.125, 0.25, 0.5, 1, 2, 6, 12, 24, 48, 96]; let gs = steps.find(s => s * view.s >= 22) || 96;
  const major = gs < 1 ? 1 : gs < 12 ? 12 : gs * 4, w0 = s2w(0, CH), w1 = s2w(CW, 0);
  ctx.lineWidth = 1;
  for (const [st, col] of [[gs, C.grid], [major, C.grid2]]) {
    if (st * view.s < 8) continue; ctx.strokeStyle = col; ctx.beginPath();
    for (let x = Math.floor(w0.x / st) * st; x <= w1.x; x += st) { const sx = Math.round(view.ox + x * view.s) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, CH); }
    for (let y = Math.floor(w0.y / st) * st; y <= w1.y; y += st) { const sy = Math.round(view.oy - y * view.s) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(CW, sy); }
    ctx.stroke();
  }
  ctx.strokeStyle = C.axis; ctx.beginPath(); ctx.moveTo(0, Math.round(view.oy) + 0.5); ctx.lineTo(CW, Math.round(view.oy) + 0.5); ctx.moveTo(Math.round(view.ox) + 0.5, 0); ctx.lineTo(Math.round(view.ox) + 0.5, CH); ctx.stroke();
  // pattern instances
  ctx.lineWidth = 1.6;
  for (const id in S.pats) { const on = isSel('pat', id); ctx.strokeStyle = on ? C.sel : C.pat; ctx.setLineDash([]); for (const g of patGeoms(S.pats[id], false)) strokeG(g);
    const p = S.pats[id]; if (on && p.t === 'circ' && P(p.c)) { const [x, y] = w2s(P(p.c).x, P(p.c).y); ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y); ctx.moveTo(x, y - 13); ctx.lineTo(x, y + 13); ctx.stroke(); } }
  // entities
  const patSrc = new Set(); for (const s of sel) if (s.k === 'pat' && S.pats[s.id]) S.pats[s.id].src.forEach(e => patSrc.add(e));
  for (const id in S.ents) {
    const e = S.ents[id], on = isSel('e', id) || patSrc.has(id), hv = hover && hover.k === 'e' && hover.id === id;
    ctx.strokeStyle = on ? C.sel : e.con ? C.con : C.geo; ctx.lineWidth = on || hv ? 3 : e.con ? 1.3 : 2.1; ctx.setLineDash(e.con ? [7, 5] : []);
    strokeG(entG(e));
  }
  ctx.setLineDash([]);
  // points
  for (const id in S.pts) {
    const p = S.pts[id], [x, y] = w2s(p.x, p.y), on = isSel('p', id), hv = hover && hover.k === 'p' && hover.id === id;
    if (id === 'p0') { ctx.strokeStyle = on ? C.sel : C.axis; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke(); if (on) { ctx.fillStyle = C.sel; ctx.fill(); } continue; }
    const r = on || hv ? 5 : 3; ctx.fillStyle = on ? C.sel : p.fixed ? C.fix : C.pt;
    if (p.fixed) ctx.fillRect(x - r - 1, y - r - 1, 2 * r + 2, 2 * r + 2); else { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  }
  // dimensions
  labelRects = {};
  for (const id in S.dims) drawDim(id, S.dims[id], C);
  // constraint badges
  badgeRects = [];
  if (settings.showCons) {
    const count = {};
    const place = (key, x, y, nx, ny) => { const k = count[key] = (count[key] || 0) + 1; return [x + nx * 15 + (k - 1) * 17 * -ny, y + ny * 15 + (k - 1) * 17 * nx]; };
    ctx.font = '700 11px -apple-system,Segoe UI,Roboto,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const badge = (id, c, bx, by) => { const on = isSel('c', id), r = { id, x: bx - 8, y: by - 8, w: 16, h: 16 }; badgeRects.push(r);
      ctx.fillStyle = on ? C.sel : C.badgeBg; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(r.x, r.y, 16, 16, 4); else ctx.rect(r.x, r.y, 16, 16); ctx.fill();
      ctx.fillStyle = on ? C.lbl : C.badge; ctx.fillText(CON_TAG[c.t], bx, by + 0.5); };
    for (const id in S.cons) {
      const c = S.cons[id]; if (c.hid || !CON_TAG[c.t]) continue;
      const es = EN_KEYS.filter(k => k in c).map(k => c[k]);
      if (c.t === 'pol' || c.t === 'mid' || c.t === 'hpp' || c.t === 'vpp' || c.t === 'sym') { const p = P(c.p); if (!p) continue; const [x, y] = w2s(p.x, p.y); const [bx, by] = place(c.p, x, y, 0.7, -0.7); badge(id, c, bx, by); continue; }
      for (const eid of es) {
        const e = S.ents[eid]; if (!e) continue; let x, y, nx = 0, ny = -1;
        if (e.t === 'line') { const a = P(e.a), b = P(e.b), d = lineDir(e); [x, y] = w2s((a.x + b.x) / 2, (a.y + b.y) / 2); nx = -d.y; ny = -d.x; if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; } }
        else { const g = entG(e), a = e.t === 'arc' ? (g.sa + g.ea) / 2 : PI * 0.75; [x, y] = w2s(g.cx + g.r * Math.cos(a), g.cy + g.r * Math.sin(a)); nx = Math.cos(a); ny = -Math.sin(a); }
        const [bx, by] = place(eid, x, y, nx, ny); badge(id, c, bx, by);
      }
    }
  }
  // tool preview
  if (tool.name !== 'select' && cur) {
    const T = tool; ctx.strokeStyle = C.prev; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    if ((T.name === 'line' || T.name === 'poly') && T.step === 1) strokeG({ t: 'line', x1: T.p0.x, y1: T.p0.y, x2: cur.x, y2: cur.y });
    else if (T.name === 'rect' && T.step === 1) { const [a, b] = w2s(T.p0.x, T.p0.y), [c, d] = w2s(cur.x, cur.y); ctx.strokeRect(Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)); }
    else if (T.name === 'circle' && T.step === 1) strokeG({ t: 'circle', cx: T.p0.x, cy: T.p0.y, r: hyp(cur.x - T.p0.x, cur.y - T.p0.y) });
    else if (T.name === 'arc' && T.step === 1) strokeG({ t: 'line', x1: T.p0.x, y1: T.p0.y, x2: cur.x, y2: cur.y });
    else if (T.name === 'arc' && T.step === 2) { const r = hyp(T.p1.x - T.p0.x, T.p1.y - T.p0.y), a0 = Math.atan2(T.p1.y - T.p0.y, T.p1.x - T.p0.x); const g = T.acc >= 0 ? { sa: a0, ea: a0 + T.acc } : { sa: a0 + T.acc, ea: a0 }; if (Math.abs(T.acc) > 0.01) strokeG({ t: 'arc', cx: T.p0.x, cy: T.p0.y, r, sa: g.sa, ea: g.ea }); }
    else if (T.name === 'slot' && T.step === 1) strokeG({ t: 'line', x1: T.p0.x, y1: T.p0.y, x2: cur.x, y2: cur.y });
    else if (T.name === 'slot' && T.step === 2) { const g = slotGeom(T.p0, T.p1, cur); if (g) { strokeG({ t: 'line', x1: g.a1.x, y1: g.a1.y, x2: g.a2.x, y2: g.a2.y }); strokeG({ t: 'line', x1: g.b1.x, y1: g.b1.y, x2: g.b2.x, y2: g.b2.y }); strokeG({ t: 'arc', cx: T.p0.x, cy: T.p0.y, r: g.r, sa: g.ang + PI / 2, ea: g.ang + 1.5 * PI }); strokeG({ t: 'arc', cx: T.p1.x, cy: T.p1.y, r: g.r, sa: g.ang - PI / 2, ea: g.ang + PI / 2 }); } }
    ctx.setLineDash([]);
    // live size readout
    let txt = '';
    if ((T.name === 'line' || T.name === 'poly' || T.name === 'slot') && T.step === 1) txt = fmt(hyp(cur.x - T.p0.x, cur.y - T.p0.y).toFixed(3));
    else if (T.name === 'rect' && T.step === 1) txt = fmt(Math.abs(cur.x - T.p0.x).toFixed(3)) + ' × ' + fmt(Math.abs(cur.y - T.p0.y).toFixed(3));
    else if (T.name === 'circle' && T.step === 1) txt = '⌀' + fmt((2 * hyp(cur.x - T.p0.x, cur.y - T.p0.y)).toFixed(3));
    else if (T.name === 'arc' && T.step >= 1) txt = 'R' + fmt(hyp((T.p1 || cur).x - T.p0.x, (T.p1 || cur).y - T.p0.y).toFixed(3));
    else if (T.name === 'slot' && T.step === 2) { const g = slotGeom(T.p0, T.p1, cur); if (g) txt = 'W ' + fmt((2 * g.r).toFixed(3)); }
    const [sx, sy] = w2s(cur.x, cur.y);
    if (txt) { ctx.font = '600 13px -apple-system,Segoe UI,Roboto,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; const tw = ctx.measureText(txt).width; ctx.fillStyle = C.bg; ctx.globalAlpha = 0.85; ctx.fillRect(sx + 14, sy - 34, tw + 10, 20); ctx.globalAlpha = 1; ctx.fillStyle = C.prev; ctx.fillText(txt, sx + 19, sy - 24); }
    // snap marker
    ctx.strokeStyle = C.prev; ctx.lineWidth = 2; ctx.beginPath();
    if (cur.kind === 'pt') ctx.rect(sx - 7, sy - 7, 14, 14);
    else if (cur.kind === 'mid') { ctx.moveTo(sx, sy - 8); ctx.lineTo(sx + 8, sy + 6); ctx.lineTo(sx - 8, sy + 6); ctx.closePath(); }
    else if (cur.kind === 'on') { ctx.moveTo(sx - 6, sy - 6); ctx.lineTo(sx + 6, sy + 6); ctx.moveTo(sx + 6, sy - 6); ctx.lineTo(sx - 6, sy + 6); }
    else ctx.arc(sx, sy, 4, 0, TAU);
    ctx.stroke();
    if (cur.hv) { ctx.fillStyle = C.prev; ctx.font = '700 12px -apple-system,Segoe UI,Roboto,sans-serif'; ctx.textAlign = 'left'; ctx.fillText(cur.hv === 'hor' ? 'H' : 'V', sx + 12, sy + 14); }
  }
}
function loop() { if (dirty) { dirty = false; render(); } requestAnimationFrame(loop); }

// ---------------------------------------------------------------- chrome: ribbon, browser, status
const RIBBON = [
  ['Create', [['line', 'Line'], ['poly', 'Polyline'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['arc', 'Arc'], ['slot', 'Slot']]],
  ['Modify', [['select', 'Select · Dim'], ['constr', 'Construct'], ['del', 'Delete']]],
  ['Constrain', [['hor', 'Horizontal'], ['ver', 'Vertical'], ['par', 'Parallel'], ['perp', 'Perpendicular'], ['tan', 'Tangent'], ['eq', 'Equal'], ['coi', 'Coincident'], ['conc', 'Concentric'], ['sym', 'Symmetric'], ['mid', 'Midpoint'], ['fix', 'Fix / lock']], true],
  ['Pattern', [['pcirc', 'Circular'], ['prect', 'Rectangular']]],
  ['Output', [['dxf', 'DXF']]],
];
const TOOLS = ['line', 'poly', 'rect', 'circle', 'arc', 'slot', 'select'];
function ribbonClick(k) {
  if (TOOLS.includes(k)) { if (tool.name === k && k !== 'select') setTool('select'); else setTool(k); }
  else if (k === 'constr') toggleConstr();
  else if (k === 'del') deleteSel();
  else if (k === 'pcirc') startPattern('circ');
  else if (k === 'prect') startPattern('rect');
  else if (k === 'dxf') exportDialog();
  else applyCon(k);
}
function buildRibbon() {
  const R = $('#ribbon'); R.innerHTML = '';
  for (const [name, btns, grid] of RIBBON) {
    R.append(el('div', { class: 'grp' }, el('div', { class: 'btns' + (grid ? ' grid' : '') }, btns.map(([k, lbl]) =>
      el('button', { class: grid ? 'cb' : 'rb', 'data-k': k, title: lbl, 'aria-label': lbl, html: icon(k === 'del' ? 'del' : k) + (grid ? '' : `<span>${lbl}</span>`),
        onclick: () => ribbonClick(k), onpointerdown: () => { if (grid) setHint(lbl + ' constraint — select the geometry, then tap this'); } }))), el('div', { class: 'gl' }, name)));
  }
}
let hintOverride = null, hintTimer = 0;
function setHint(t) { hintOverride = t; clearTimeout(hintTimer); hintTimer = setTimeout(() => { hintOverride = null; refreshStatus(); }, 3500); refreshStatus(); }
function refreshStatus() {
  $('#hint').textContent = hintOverride || HINTS[tool.name] || '';
  const d = $('#dof');
  if (solverState === 'loading') { d.textContent = 'Loading solver…'; d.className = ''; }
  else if (solverState === 'failed') { d.textContent = 'Solver unavailable'; d.className = 'bad'; }
  else if (!Object.keys(S.ents).length) { d.textContent = ''; d.className = ''; }
  else if (dof === 0) { d.textContent = 'Fully constrained'; d.className = 'ok'; }
  else { d.textContent = dof + ' free ' + (dof === 1 ? 'move' : 'moves') + ' left'; d.className = ''; }
}
function refresh() {
  dirty = true;
  document.querySelectorAll('#ribbon [data-k]').forEach(b => { const k = b.dataset.k; b.classList.toggle('on', (TOOLS.includes(k) && tool.name === k) || (k === 'constr' && constrMode)); });
  $('#undoBtn').disabled = hi <= 0; $('#redoBtn').disabled = hi >= hist.length - 1;
  refreshStatus(); buildBrowser();
}
function buildBrowser() {
  const B = $('#browser'); B.innerHTML = '';
  const cnt = { line: 0, circle: 0, arc: 0 }; for (const id in S.ents) cnt[S.ents[id].t]++;
  B.append(el('div', { class: 'root' }, el('span', { class: 'tg' }, 'S'), S.name || 'Sketch1'));
  B.append(el('div', { class: 'sub' }, `${cnt.line} line${cnt.line === 1 ? '' : 's'} · ${cnt.circle} circle${cnt.circle === 1 ? '' : 's'} · ${cnt.arc} arc${cnt.arc === 1 ? '' : 's'}`));
  const pick = (k, id) => { if (tool.name !== 'select') setTool('select'); sel = [{ k, id }]; refresh(); closeDrawer(); if (k !== 'c') showSelPop(); else closePop(); };
  const delOne = (k, id) => { sel = [{ k, id }]; deleteSel(); };
  const dims = Object.entries(S.dims), pats = Object.entries(S.pats), cons = Object.entries(S.cons).filter(([, c]) => !c.hid);
  B.append(el('h4', {}, 'Dimensions'));
  if (!dims.length) B.append(el('div', { class: 'sub' }, 'None yet — tap a line and type a size'));
  for (const [id, d] of dims) B.append(el('div', { class: 'row' + (isSel('d', id) ? ' on' : ''), onclick: () => pick('d', id) }, el('span', { class: 'tg' }, d.t === 'ang' ? '∠' : d.t === 'dia' ? '⌀' : d.t === 'rad' ? 'R' : '↔'), el('span', { class: 'nm' }, DIM_NAMES[d.t]), el('span', { class: 'vl' }, fmt(d.v) + (d.t === 'ang' ? '°' : ''))));
  B.append(el('h4', {}, 'Patterns'));
  if (!pats.length) B.append(el('div', { class: 'sub' }, 'None'));
  for (const [id, p] of pats) B.append(el('div', { class: 'row' + (isSel('pat', id) ? ' on' : ''), onclick: () => pick('pat', id) }, el('span', { class: 'tg' }, p.t === 'circ' ? '◌' : '▦'), el('span', { class: 'nm' }, p.t === 'circ' ? 'Circular' : 'Rectangular'), el('span', { class: 'vl' }, p.t === 'circ' ? '×' + p.n : p.n1 + '×' + p.n2)));
  B.append(el('h4', {}, 'Constraints' + (cons.length ? ' (' + cons.length + ')' : '')));
  if (!cons.length) B.append(el('div', { class: 'sub' }, 'None'));
  for (const [id, c] of cons) B.append(el('div', { class: 'row' + (isSel('c', id) ? ' on' : ''), onclick: () => pick('c', id) }, el('span', { class: 'tg' }, CON_TAG[c.t] || '·'), el('span', { class: 'nm' }, CON_NAMES[c.t]), el('button', { class: 'x', 'aria-label': 'Delete constraint', onclick: ev => { ev.stopPropagation(); delOne('c', id); } }, '×')));
}
function closeDrawer() { $('#browser').classList.remove('open'); $('#scrim').classList.remove('on'); }
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }

// ---------------------------------------------------------------- DXF (R12 / AC1009), zip, saving
function dxfText(layer) {
  const gs = exportGeoms(), b = bboxG(gs) || { x0: 0, y0: 0, x1: 0, y1: 0 }, L = (layer || 'CUT').toUpperCase().replace(/[^A-Z0-9_$\-]/g, '_');
  const n = v => { const s = (+v).toFixed(6).replace(/0+$/, ''); return s.endsWith('.') ? s + '0' : s; };
  const o = [];
  const w = (...a) => { for (let i = 0; i < a.length; i += 2) o.push(String(a[i]).padStart(3, ' '), String(a[i + 1])); };
  w(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSBASE', 10, '0.0', 20, '0.0', 30, '0.0', 9, '$EXTMIN', 10, n(b.x0), 20, n(b.y0), 30, '0.0', 9, '$EXTMAX', 10, n(b.x1), 20, n(b.y1), 30, '0.0', 0, 'ENDSEC');
  w(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LTYPE', 70, 1, 0, 'LTYPE', 2, 'CONTINUOUS', 70, 64, 3, 'Solid line', 72, 65, 73, 0, 40, '0.0', 0, 'ENDTAB',
    0, 'TABLE', 2, 'LAYER', 70, 1, 0, 'LAYER', 2, L, 70, 64, 62, 7, 6, 'CONTINUOUS', 0, 'ENDTAB', 0, 'ENDSEC');
  w(0, 'SECTION', 2, 'BLOCKS', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  const deg = a => { let d = a * 180 / PI % 360; if (d < 0) d += 360; return n(d); };
  for (const g of gs) {
    if (g.t === 'line') w(0, 'LINE', 8, L, 10, n(g.x1), 20, n(g.y1), 30, '0.0', 11, n(g.x2), 21, n(g.y2), 31, '0.0');
    else if (g.t === 'circle') w(0, 'CIRCLE', 8, L, 10, n(g.cx), 20, n(g.cy), 30, '0.0', 40, n(g.r));
    else w(0, 'ARC', 8, L, 10, n(g.cx), 20, n(g.cy), 30, '0.0', 40, n(g.r), 50, deg(g.sa), 51, deg(g.ea));
  }
  w(0, 'ENDSEC', 0, 'EOF');
  return { text: o.join('\r\n') + '\r\n', count: gs.length, bbox: b, layer: L };
}
const CRC_T = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipOne(name, text) {       // single stored (uncompressed) file
  const enc = new TextEncoder(), nm = enc.encode(name), data = enc.encode(text), crc = crc32(data), d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const out = new Uint8Array(30 + nm.length + data.length + 46 + nm.length + 22), v = new DataView(out.buffer); let p = 0;
  v.setUint32(p, 0x04034b50, true); v.setUint16(p + 4, 20, true); v.setUint16(p + 6, 0x0800, true); v.setUint16(p + 8, 0, true); v.setUint16(p + 10, time, true); v.setUint16(p + 12, date, true);
  v.setUint32(p + 14, crc, true); v.setUint32(p + 18, data.length, true); v.setUint32(p + 22, data.length, true); v.setUint16(p + 26, nm.length, true); v.setUint16(p + 28, 0, true);
  out.set(nm, 30); out.set(data, 30 + nm.length); p = 30 + nm.length + data.length; const cd = p;
  v.setUint32(p, 0x02014b50, true); v.setUint16(p + 4, 20, true); v.setUint16(p + 6, 20, true); v.setUint16(p + 8, 0x0800, true); v.setUint16(p + 10, 0, true); v.setUint16(p + 12, time, true); v.setUint16(p + 14, date, true);
  v.setUint32(p + 16, crc, true); v.setUint32(p + 20, data.length, true); v.setUint32(p + 24, data.length, true); v.setUint16(p + 28, nm.length, true); v.setUint32(p + 42, 0, true);
  out.set(nm, p + 46); p += 46 + nm.length;
  v.setUint32(p, 0x06054b50, true); v.setUint16(p + 8, 1, true); v.setUint16(p + 10, 1, true); v.setUint32(p + 12, 46 + nm.length, true); v.setUint32(p + 16, cd, true);
  return out;
}
const hosted = () => !!(window.claude && typeof window.claude.use === 'function');   // running as a Claude artifact
const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
let dl = null;
const safeName = s => (String(s || 'Sketch1').trim().replace(/[\\/:*?"<>|]+/g, '-') || 'Sketch1');
// Returns a short status string for the user.
async function saveFile(filename, text, mime) {
  if (hosted() || framed) {
    if (!dl && hosted()) { try { dl = await window.claude.use('downloads'); } catch (e) {} }
    if (!dl) return { ok: false, msg: 'Saving files is not available in this view — use Copy instead.' };
    try {
      if (/\.dxf$/i.test(filename)) await dl.save({ filename: filename.replace(/\.dxf$/i, '') + '-dxf.zip', data: zipOne(filename, text) });
      else await dl.save({ filename, data: text });
      return { ok: true, msg: 'Saved' };
    } catch (err) { return { ok: false, msg: err && err.code === 'declined' ? 'Save cancelled' : 'Could not save here (' + ((err && err.code) || 'error') + ') — use Copy instead.' }; }
  }
  try {
    const file = new File([text], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPad|iPhone|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) { await navigator.share({ files: [file], title: filename }); return { ok: true, msg: 'Shared' }; }
  } catch (err) { if (err && err.name === 'AbortError') return { ok: false, msg: 'Cancelled' }; }
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: filename }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return { ok: true, msg: 'Downloaded ' + filename };
}
const modal = $('#modal');
function closeModal() { modal.classList.remove('on'); modal.innerHTML = ''; }
modal.addEventListener('pointerdown', e => { if (e.target === modal) closeModal(); });
function exportDialog() {
  closePop(); finishPoly();
  const first = dxfText(settings.layer);
  if (!first.count) { toast('Nothing to export yet — draw some geometry first'); return; }
  const b = first.bbox, nameIn = el('input', { type: 'text', value: safeName(S.name), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }), layIn = el('input', { type: 'text', value: settings.layer, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
  const note = el('div', { class: 'note' });
  const mk = () => { settings.layer = (layIn.value.trim() || 'CUT').toUpperCase(); saveSettings(); return dxfText(settings.layer); };
  const nCon = Object.values(S.ents).filter(e => e.con).length;
  modal.innerHTML = ''; modal.append(el('div', { class: 'dlg' }, el('h3', {}, 'Export DXF'),
    el('label', {}, 'File name'), nameIn, el('label', {}, 'Cut layer'), layIn,
    el('div', { class: 'info', html: `<b>${first.count}</b> entities · size <b>${fmt(b.x1 - b.x0)} × ${fmt(b.y1 - b.y0)}</b> in<br>R12 (AC1009) · LINE / ARC / CIRCLE · inches${nCon ? `<br>${nCon} construction item${nCon === 1 ? '' : 's'} left out` : ''}${dof ? '<br>Sketch is not fully constrained — sizes are as drawn' : ''}` }),
    el('div', { class: 'btnrow' },
      el('button', { class: 'pri', onclick: async () => { const d = mk(); note.textContent = 'Saving…'; const r = await saveFile(safeName(nameIn.value) + '.dxf', d.text, 'application/dxf'); note.textContent = r.msg + (r.ok && hosted() ? ' — the DXF is inside the zip (this viewer only allows zip downloads).' : ''); } }, 'Save DXF'),
      el('button', { onclick: async () => { const d = mk(); try { await navigator.clipboard.writeText(d.text); note.textContent = 'DXF text copied to the clipboard.'; } catch (e) { note.textContent = 'Copy was blocked here.'; } } }, 'Copy DXF text'),
      el('button', { onclick: closeModal }, 'Close')), note));
  modal.classList.add('on');
}
function settingsDialog() {
  closePop();
  const sw = (lbl, key, on, off, onv, offv) => { const b = el('button', {}, ''); const paint = () => { const v = settings[key] === onv; b.textContent = v ? on : off; b.classList.toggle('on', v); };
    b.onclick = () => { settings[key] = settings[key] === onv ? offv : onv; paint(); saveSettings(); document.documentElement.classList.toggle('light', settings.theme === 'light'); refresh(); }; paint(); return el('div', { class: 'sw' }, el('span', {}, lbl), b); };
  modal.innerHTML = ''; modal.append(el('div', { class: 'dlg' }, el('h3', {}, 'Settings'),
    sw('Theme', 'theme', 'Light', 'Dark', 'light', 'dark'),
    sw('Snap to grid (1/16 in when zoomed in)', 'gridSnap', 'On', 'Off', true, false),
    sw('Show constraint badges', 'showCons', 'On', 'Off', true, false),
    sw('Draw with a finger even when a Pencil is in use', 'fingerDraw', 'On', 'Off', true, false),
    el('div', { class: 'note', html: 'Units are inches. Type <b>7</b> for 7 in, <b>1 3/8</b> for a fraction, or <b>7mm</b> for millimeters.<br>With a Pencil: Pencil draws, one finger pans, two fingers zoom. Without one: one finger draws, two fingers pan and zoom.<br><br>QuickCad phase 1 · constraint solver: planegcs (FreeCAD), LGPL.' }),
    el('div', { class: 'btnrow' }, el('button', { class: 'pri', onclick: closeModal }, 'Done'))));
  modal.classList.add('on');
}
function confirmDialog(title, text, yes, fn) {
  modal.innerHTML = ''; modal.append(el('div', { class: 'dlg' }, el('h3', {}, title), el('div', { class: 'note' }, text), el('div', { class: 'btnrow' }, el('button', { class: 'pri', onclick: () => { closeModal(); fn(); } }, yes), el('button', { onclick: closeModal }, 'Cancel'))));
  modal.classList.add('on');
}

// ---------------------------------------------------------------- wiring
for (const [id, ic] of [['menuBtn', 'menu'], ['undoBtn', 'undo'], ['redoBtn', 'redo'], ['fitBtn', 'fit'], ['newBtn', 'new'], ['openBtn', 'open'], ['saveBtn', 'save'], ['setBtn', 'gear']]) $('#' + id).innerHTML = icon(ic);
$('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo; $('#fitBtn').onclick = fit; $('#setBtn').onclick = settingsDialog;
$('#menuBtn').onclick = () => { $('#browser').classList.toggle('open'); $('#scrim').classList.toggle('on'); };
$('#scrim').onclick = closeDrawer;
$('#newBtn').onclick = () => confirmDialog('Start a new sketch?', 'The current sketch is cleared. Save it first if you want to keep it.', 'New sketch', () => loadSketch(newSketch()));
$('#saveBtn').onclick = async () => { finishPoly(); const r = await saveFile(safeName(S.name) + '.quickcad.json', JSON.stringify({ app: 'QuickCad', format: 1, sketch: S }, null, 1), 'application/json'); toast(r.msg); };
$('#openBtn').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const o = JSON.parse(await f.text()); const sk = o.sketch || o; if (!validSketch(sk)) throw 0; loadSketch(sk); toast('Opened ' + f.name); } catch (err) { toast('That file is not a QuickCad part file'); }
};
$('#pname').addEventListener('change', e => { S.name = e.target.value.trim() || 'Sketch1'; e.target.value = S.name; pushHist(); refresh(); });
$('#pname').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
document.querySelectorAll('.tab[data-soon]').forEach(t => t.onclick = () => toast(t.dataset.soon));
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe($('#stage'));

(function boot() {
  try { Object.assign(settings, JSON.parse(localStorage.getItem('qc.settings') || '{}')); } catch (e) {}
  document.documentElement.classList.toggle('light', settings.theme === 'light');
  try { const o = JSON.parse(localStorage.getItem('qc.sketch') || 'null'); if (validSketch(o)) S = o; } catch (e) {}
  $('#pname').value = S.name || 'Sketch1';
  buildRibbon(); resize(); pushHist(); fit(); refresh(); loop(); initSolver();
})();
window.QC = { get S() { return S; }, get sel() { return sel; }, set sel(v) { sel = v; }, get dof() { return dof; }, get view() { return view; }, get solver() { return solverState; },
  setTool, toolClick, commit, applyCon, applyDim, dimOffer, dxfText, zipOne, parseLen, fit, undo, redo, loadSketch, newSketch, startPattern, w2s, popKey, showSelPop, solve };
