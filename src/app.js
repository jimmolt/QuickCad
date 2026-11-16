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
  project: '<path class="s" d="M3 21l4-8h14l-4 8z"/><path d="M3 21l4-8h14l-4 8z"/><path class="y" d="M8 4h9" stroke-width="2.4"/><path class="y" d="M8.500 17h8" stroke-width="2"/><path class="a" d="M9 6v9M16 6v9" stroke-dasharray="2 2"/>',
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
  face: '<path d="M3 17l6-10h12l-6 10z"/>',
  fillet: '<path d="M4 20V12a8 8 0 0 1 8-8h8"/>',
  contour: '<path d="M3 18h5V8h8v10h5"/>',
  chamfer: '<path d="M4 20V10l6-6h10"/>',
  cround: '<path d="M4 20V12a8 8 0 0 1 8-8h8v16z" opacity=".55"/><path d="M4 20V12a8 8 0 0 1 8-8"/>',
  cchamfer: '<path d="M4 20V10l6-6h10v16z" opacity=".55"/><path d="M4 20V10l6-6"/>',
  eye: '<path d="M2 12s3.600-6.500 10-6.500S22 12 22 12s-3.600 6.500-10 6.500S2 12 2 12z"/><circle cx="12" cy="12" r="2.800"/>',
  eyeoff: '<path d="M2 12s3.600-6.500 10-6.500S22 12 22 12s-3.600 6.500-10 6.500S2 12 2 12z" opacity=".45"/><path d="M4 4l16 16"/>',
  newsk: '<path d="M2 19l5-8h7M2 19h11l2-3"/><path d="M15 4l4 4-6 6-4 1 1-4z"/>',
  flange: '<path d="M3 19h11"/><path d="M14 19c4 0 6-2 6-6V4"/><path d="M17 7l3-3 3 3" opacity=".0"/>',
  cut: '<path d="M3 17l6-10h12l-6 10z"/><ellipse cx="12" cy="12" rx="3.2" ry="2"/>',
  thick: '<path d="M4 10h16v4H4z"/><path d="M12 3v7M12 21v-7M9.500 5.500L12 3l2.500 2.500M9.500 18.500L12 21l2.500-2.500"/>',
  view: '<path d="M12 3l8 4.500v9L12 21l-8-4.500v-9zM12 12l8-4.500M12 12v9M12 12L4 7.500"/>',
  finish: '<path d="M4 12.500l5 5L20 6.500"/>',
  flat: '<path d="M12 3v11M7.500 10l4.500 4.500L16.500 10M4 17v3h16v-3"/>',
};
// Two-tone icons: white = geometry, blue (.a) = what the tool makes or changes, yellow dots (.y) = points you pick, .s = sheet fill, .g = green
const pt = (x, y) => `<circle class="y" cx="${x}" cy="${y}" r="2.1"/>`;
Object.assign(IC, {
  line: '<path class="a" d="M5 19L19 5"/>' + pt(5, 19) + pt(19, 5),
  poly: '<path class="a" d="M3.500 18l5-11 6 8 6-10"/>' + pt(3.5, 18) + pt(8.5, 7) + pt(14.5, 15) + pt(20.5, 5),
  rect: '<rect class="a" x="4" y="6.500" width="16" height="11"/>' + pt(4, 17.5) + pt(20, 6.5),
  'rect-center': '<rect class="a" x="4" y="6.500" width="16" height="11"/><path d="M12 12l8-5.500" stroke-dasharray="2 2" opacity=".7"/>' + pt(12, 12) + pt(20, 6.5),
  circle: '<circle class="a" cx="12" cy="12" r="8"/><path d="M12 12h8" stroke-dasharray="2 2" opacity=".7"/>' + pt(12, 12) + pt(20, 12),
  'circle-2pt': '<circle class="a" cx="12" cy="12" r="8"/><path d="M4 12h16" stroke-dasharray="2 2" opacity=".7"/>' + pt(4, 12) + pt(20, 12),
  'circle-3pt': '<circle class="a" cx="12" cy="12" r="8"/>' + pt(12, 4) + pt(5.1, 16) + pt(18.9, 16),
  arc: '<path class="a" d="M5 18A13 13 0 0 1 18 5"/><path d="M5 18h13V5" stroke-dasharray="2 2" opacity=".55"/>' + pt(5, 18) + pt(18, 5) + pt(18, 18),
  slot: '<rect class="a" x="3" y="8" width="18" height="8" rx="4"/><path d="M7 12h10" stroke-dasharray="2 2" opacity=".7"/>' + pt(7, 12) + pt(17, 12),
  select: '<path d="M4 4v16M20 4v16" opacity=".75"/><path class="a" d="M6 12h12M6 12l3.500-2.800M6 12l3.500 2.800M18 12l-3.500-2.800M18 12l-3.500 2.800"/>',
  fillet: '<path d="M4 21v-7M12 4h8" opacity=".8"/><path class="a" d="M4 14A10 10 0 0 1 12 4"/>' + pt(4, 14) + pt(12, 4),
  chamfer: '<path d="M4 21v-8M12 4h8" opacity=".8"/><path class="a" d="M4 13l8-9"/>' + pt(4, 13) + pt(12, 4),
  constr: '<path class="a" d="M4 20L20 4" stroke-dasharray="3.500 3"/>' + pt(4, 20) + pt(20, 4),
  del: '<path d="M5 7h14M9.500 7V4.500h5V7"/><path class="r" d="M7 7l1 13h8l1-13M10.500 11v5.500M13.500 11v5.500"/>',
  hor: '<path class="a" d="M3 14h18"/><path d="M8 7h8M8 7l2.200-1.800M8 7l2.200 1.800M16 7l-2.200-1.800M16 7l-2.200 1.800" stroke-width="1.4" opacity=".8"/>',
  ver: '<path class="a" d="M14 3v18"/><path d="M7 8v8M7 8L5.200 10.200M7 8l1.800 2.200M7 16l-1.800-2.200M7 16l1.800-2.200" stroke-width="1.4" opacity=".8"/>',
  par: '<path class="a" d="M4 19L12 5"/><path d="M12 19l8-14"/>',
  perp: '<path d="M3 19h18"/><path class="a" d="M12 19V4"/><path d="M12 15h4v4" stroke-width="1.3" opacity=".7"/>',
  tan: '<circle cx="10" cy="14.500" r="6"/><path class="a" d="M3 5.500l18 5"/>',
  eq: '<path class="a" d="M5 9.500h14M5 14.500h14"/>',
  coi: '<path d="M3 20l7-7M21 20l-7-7" opacity=".8"/><circle class="a" cx="12" cy="11" r="4.500"/>' + pt(12, 11),
  conc: '<circle cx="12" cy="12" r="8.500"/><circle class="a" cx="12" cy="12" r="4.200"/>' + pt(12, 12),
  sym: '<path d="M12 2.500v19" stroke-dasharray="3 2" opacity=".8"/><path class="a" d="M8.500 6l-5 6 5 6zM15.500 6l5 6-5 6z"/>',
  mid: '<path class="a" d="M3 18L21 6"/><path d="M9.500 9.500l5 5" stroke-width="1.3" opacity=".7"/>' + pt(12, 12),
  fix: '<rect class="a" x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>',
  pcirc: '<circle class="a" cx="12" cy="4.500" r="2.300"/><circle cx="18.500" cy="15.500" r="2.300"/><circle cx="5.500" cy="15.500" r="2.300"/><path d="M16 6.500a8 8 0 0 1 3 5M14.500 19.500a8 8 0 0 1-5 0M5 11.500a8 8 0 0 1 3-5" stroke-dasharray="2 2" opacity=".6"/>' + pt(12, 12),
  prect: '<rect class="a" x="3.500" y="13.500" width="5" height="5"/><rect x="10.500" y="13.500" width="5" height="5" opacity=".75"/><rect x="17.500" y="13.500" width="3.500" height="5" opacity=".45"/><rect x="3.500" y="5.500" width="5" height="5" opacity=".75"/><rect x="10.500" y="5.500" width="5" height="5" opacity=".45"/>',
  dxf: '<path d="M6 3h8l4 4v6M6 3v10"/><path d="M14 3v4h4" opacity=".7"/><path class="a" d="M12 12v8M8.500 17l3.500 3.500 3.500-3.500"/>',
  finish: '<circle class="g" cx="12" cy="12" r="9"/><path class="g" d="M7.500 12.500l3 3 6-6.500" stroke-width="2.400"/>',
  face: '<path class="s" d="M3 17l5-10h13l-5 10z"/><path class="a" d="M3 17l5-10h13l-5 10z"/>',
  newsk: '<path class="s" d="M2 19l4.500-9H17l-4.500 9z"/><path d="M2 19l4.500-9H13M2 19h10.500l1.500-3"/><path class="a" d="M16.500 3.500l4 4-6.500 6.500-4.500 1 1-4.500z"/>',
  cut: '<path class="s" d="M3 17l5-10h13l-5 10z"/><path d="M3 17l5-10h13l-5 10z"/><ellipse class="a" cx="12" cy="12" rx="3.600" ry="2.300"/>',
  flange: '<path class="s" d="M2 20v-3h10a3 3 0 0 0 3-3V4h3v10a6 6 0 0 1-6 6z"/><path d="M12 20H2v-3h10M15 14V4h3v10"/><path class="a" d="M12 17a3 3 0 0 0 3-3M12 20a6 6 0 0 0 6-6"/>',
  contour: '<path class="a" d="M2 18.500h5v-11h10v11h5" stroke-width="2.600" stroke-linejoin="round"/>',
  thick: '<path class="s" d="M3 10h18v4H3z"/><path d="M3 10h18v4H3z"/><path class="a" d="M12 2.500V8M12 21.500V16M9.800 5.500L12 8l2.200-2.500M9.800 18.500L12 16l2.200 2.500"/>',
  cround: '<path class="s" d="M4 20v-8a8 8 0 0 1 8-8h8v16z"/><path d="M12 4h8M4 20v-8"/><path class="a" d="M4 12a8 8 0 0 1 8-8"/>',
  cchamfer: '<path class="s" d="M4 20V11l7-7h9v16z"/><path d="M11 4h9M4 20v-9"/><path class="a" d="M4 11l7-7"/>',
  view: '<path class="s" d="M12 3l8 4.500v9L12 21l-8-4.500v-9z"/><path d="M12 3l8 4.500v9L12 21l-8-4.500v-9z"/><path class="a" d="M12 12l8-4.500M12 12v9M12 12L4 7.500"/>',
  flat: '<path class="s" d="M3 8h18v9H3z"/><path d="M3 8h18v9H3z"/><path class="a" d="M8 8v9M16 8v9" stroke-dasharray="2.500 2"/>',
  flatdxf: '<path d="M4 4h16v9H4z"/><path d="M9 4v9M15 4v9" stroke-dasharray="2 2" opacity=".6"/><path class="a" d="M12 14v7M8.800 18l3.200 3 3.200-3"/>',
});
const icon = n => `<svg viewBox="0 0 24 24">${IC[n] || ''}</svg>`;

// ---------------------------------------------------------------- state
function newSketch() {
  return { v: 1, name: 'Sketch1', nid: 1, pts: { p0: { x: 0, y: 0, fixed: true } }, ents: {}, cons: {}, dims: {}, pats: {} };
}
function newPart() { return { v: 2, name: 'Part1', t: null, tl: '', rule: { k: 0.44, rm: 1 }, nf: 2, feats: [{ id: 'f1', type: 'sketch', name: 'Sketch1', sk: newSketch() }] }; }
let part = newPart();
let S = part.feats[0].sk;     // the sketch being edited
let actId = 'f1', mode = 'sketch', ribTab = 'sketch', model = null;
const feat = id => part.feats.find(f => f.id === id);
const faceFeat = () => part.feats.find(f => f.type === 'face');
let settings = { theme: 'dark', gridSnap: false, showCons: true, layer: 'CUT', fingerDraw: false };
let view = { s: 60, ox: 200, oy: 400 };
let sel = [];                 // [{k:'p'|'e'|'d'|'c'|'pat', id}]
let tool = { name: 'select', step: 0 };
const toolVar = { rect: 'corner', circle: 'center' };   // chosen style of each drawing tool (long-press the button to change)
const VARIANTS = { rect: [['corner', 'Corner to corner'], ['center', 'From center']], circle: [['center', 'Center + radius'], ['2pt', '2 point (diameter)'], ['3pt', '3 point']] };
let crPick = null, crHover = null;       // 'round' | 'chamfer' while picking sheet-metal corners
let flPick = false, flHover = null, flActive = null;   // edge-flange picking / hover edge / id of the flange in the popup
let cutSel = null;      // while the Cut command is picking profiles: { sel:[{sk,pt}], loops:[{poly}] }
let constrMode = false;
let cur = null;               // current snap (draw tools)
let hover = null;
let dof = null;
let labelRects = {}, badgeRects = [];
let dirty = true;
let lastPtrType = 'mouse', penSeen = false, ptr = null;
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
  const midUse = new Set();   // a line-midpoint point lives only while a constraint or dimension other than its own midpoint lock uses it
  for (const grp of [S.cons, S.dims]) for (const id in grp) { const o = grp[id]; if (o.t === 'mid' && S.pts[o.p] && S.pts[o.p].mid) continue; for (const k of PT_KEYS) if (k in o && S.pts[o[k]] && S.pts[o[k]].mid) midUse.add(o[k]); }
  for (const id in S.pts) if (S.pts[id].mid && midUse.has(id) && S.pts[id].mid in S.ents) used.add(id);
  for (const id in S.cons) { const c = S.cons[id]; if (c.t === 'pol' && S.pts[c.p] && S.pts[c.p].keep && c.e in S.ents) used.add(c.p); }     // 3-point circle: the three clicked points stay while they sit on their circle
  const bad = o => PT_KEYS.some(k => k in o && !used.has(o[k])) || EN_KEYS.some(k => k in o && !(o[k] in S.ents))
    || ('q' in o && o.p === o.q) || ('e2' in o && o.e1 === o.e2);
  for (const id in S.cons) if (bad(S.cons[id])) delete S.cons[id];
  for (const id in S.dims) if (bad(S.dims[id])) delete S.dims[id];
  for (const id in S.pats) {
    const p = S.pats[id]; p.src = p.src.filter(e => e in S.ents);
    if (!p.src.length) delete S.pats[id]; else if (p.t === 'circ' && !used.has(p.c)) p.c = 'p0';
  }
  const gm = {}; for (const id in S.dims) if (S.dims[id].g) (gm[S.dims[id].g] = gm[S.dims[id].g] || []).push(id);
  for (const g in gm) if (gm[g].length < 2) for (const i of gm[g]) { delete S.dims[i].g; delete S.dims[i].gf; }
  for (const id in S.dims) { const d = S.dims[id]; if (d.expr && (d.expr.match(/d\d+/gi) || []).some(r => !(r.toLowerCase() in S.dims))) delete d.expr; }
  for (const id in S.pts) if (!used.has(id)) delete S.pts[id];
  sel = sel.filter(s => s.k === 'p' ? s.id in S.pts : s.k === 'e' ? s.id in S.ents : s.k === 'd' ? s.id in S.dims : s.k === 'c' ? s.id in S.cons : s.id in S.pats);
}
function mergePts(keep, drop) {
  if (keep === drop) return;
  if (S.pts[keep].proj && S.pts[drop].proj) return;
  if (drop === 'p0' || (S.pts[drop].proj && !S.pts[keep].proj)) [keep, drop] = [drop, keep];
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
    case 'len': return [{ id, type: 'p2p_distance', p1_id: o.p, p2_id: o.q, distance: o.g || o.v }];
    case 'dx': return [{ id, type: 'difference', param1: { o_id: o.p, prop: 'x' }, param2: { o_id: o.q, prop: 'x' }, difference: o.g || o.v }];
    case 'dy': return [{ id, type: 'difference', param1: { o_id: o.p, prop: 'y' }, param2: { o_id: o.q, prop: 'y' }, difference: o.g || o.v }];
    case 'pld': return [{ id, type: 'p2l_distance', p_id: o.p, l_id: o.e, distance: o.g || o.v }];
    case 'ang': return [{ id, type: 'l2l_angle_ll', l1_id: o.e1, l2_id: o.e2, angle: rawAngle(o) }];
    case 'dia': return [{ id, type: 'circle_diameter', c_id: o.e, diameter: o.g || o.v }];
    case 'rad': return [{ id, type: 'arc_radius', a_id: o.e, radius: o.g || o.v }];
  }
  return [];
}
function buildPrims(temp) {
  const pr = [];
  for (const id in S.pts) { const p = S.pts[id]; pr.push({ id, type: 'point', x: p.x, y: p.y, fixed: !!p.fixed }); }
  for (const id in S.ents) {
    const e = S.ents[id];
    if (e.t === 'line') pr.push({ id, type: 'line', p1_id: e.a, p2_id: e.b });
    else if (e.t === 'circle') { pr.push({ id, type: 'circle', c_id: e.c, radius: e.r }); if (e.proj) pr.push({ id: id + '_pd', type: 'circle_diameter', c_id: id, diameter: e.r * 2 }); }
    else { const g = entG(e); pr.push({ id, type: 'arc', c_id: e.c, radius: g.r, start_angle: g.sa, end_angle: g.ea, start_id: e.a, end_id: e.b }, { id: id + '_r', type: 'arc_rules', a_id: id }); }
  }
  const items = [...Object.entries(S.cons), ...Object.entries(S.dims)].sort((a, b) => num(a[0]) - num(b[0]));
  for (const [id, o] of items) if (!o.driven) pr.push(...conPrims(id, o));
  let k = 0;
  for (const t of (temp || [])) {
    pr.push({ id: 't' + (k++), type: 'coordinate_x', p_id: t.p, x: t.x, temporary: true }, { id: 't' + (k++), type: 'coordinate_y', p_id: t.p, y: t.y, temporary: true });
  }
  return pr;
}
// Solve the sketch in place. Returns {ok, msg}. Redundant constraints are pruned; conflicts are reported.
// Inventor-style formulas: a dimension's value can be an expression of other dimensions, e.g. "d7/2" or "d3+0.125".
function evalExpr(str) {
  const s = String(str).replace(/\u2212/g, '-').replace(/\u00d7/g, '*').trim(); let i = 0;
  const ws = () => { while (s[i] === ' ') i++; };
  const prim = () => { ws();
    if (s[i] === '(') { i++; const v = add(); ws(); if (s[i] !== ')') throw 0; i++; return v; }
    if (s[i] === '-') { i++; return -prim(); }
    const m = /^d\d+/i.exec(s.slice(i)); if (m) { i += m[0].length; const d = S.dims[m[0].toLowerCase()]; if (!d) throw 0; return d.v; }
    const n = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!n) throw 0; i += n[0].length; let v = parseFloat(n[0]);
    const u = /^\s*(mm|cm|in(?![a-z])|")/i.exec(s.slice(i)); if (u) { i += u[0].length; const k = u[1].toLowerCase(); v *= k === 'mm' ? 1 / 25.4 : k === 'cm' ? 1 / 2.54 : 1; }   // units inside formulas: 5mm, 2 cm, 3in
    return v;
  };
  const mul = () => { let v = prim(); for (;;) { ws(); if (s[i] === '*') { i++; v *= prim(); } else if (s[i] === '/') { i++; v /= prim(); } else return v; } };
  const add = () => { let v = mul(); for (;;) { ws(); if (s[i] === '+') { i++; v += mul(); } else if (s[i] === '-') { i++; v -= mul(); } else return v; } };
  try { const v = add(); ws(); return i >= s.length && isFinite(v) ? v : null; } catch (_) { return null; }
}
function evalDims() {      // settle formula dims (a few passes cover chains); returns true when any value moved
  let ch = false;
  for (let k = 0; k < 4; k++) { let any = false;
    for (const id in S.dims) { const d = S.dims[id]; if (!d.expr || d.driven) continue; const v = evalExpr(d.expr);
      if (v != null && v > 1e-9 && !(d.t === 'ang' && v >= 180) && Math.abs(v - d.v) > 1e-9) { d.v = v; any = ch = true; } }
    if (!any) break; }
  return ch;
}
function measureDim(d) {   // what a driven dimension reads off the geometry
  if (d.t === 'len') { const a = P(d.p), b = P(d.q); return hyp(b.x - a.x, b.y - a.y); }
  if (d.t === 'dx') return Math.abs(P(d.q).x - P(d.p).x);
  if (d.t === 'dy') return Math.abs(P(d.q).y - P(d.p).y);
  if (d.t === 'pld') { const e = S.ents[d.e], u = lineDir(e), a = P(e.a), p = P(d.p); return Math.abs(-(p.x - a.x) * u.y + (p.y - a.y) * u.x); }
  if (d.t === 'dia') return S.ents[d.e].r * 2;
  if (d.t === 'rad') return entG(S.ents[d.e]).r;
  if (d.t === 'ang') { const d1 = lineDir(S.ents[d.e1]), d2 = lineDir(S.ents[d.e2]), ux = d1.x * d.s1, uy = d1.y * d.s1, vx = d2.x * d.s2, vy = d2.y * d.s2;
    return Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy))) * 180 / PI; }
  return null;
}
function solve(opts) {
  opts = opts || {};
  if (!gcs) return { ok: true };
  for (let iter = 0; iter < 6; iter++) {
    let st;
    evalDims();
    const grp = {}; for (const id in S.dims) { const d = S.dims[id]; if (d.g) (grp[d.g] = grp[d.g] || { ids: [], fixed: !!d.gf }).ids.push(id); }
    try { gcs.clear_data(); for (const g in grp) gcs.push_sketch_param(g, grp[g].ids.reduce((a, i) => a + S.dims[i].v, 0) / grp[g].ids.length, grp[g].fixed); gcs.push_primitives_and_params(buildPrims(opts.temp)); st = gcs.solve(); }
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
    for (const g in grp) { const v = gcs.get_sketch_param_value(g); if (isFinite(v) && v > 1e-9) for (const i of grp[g].ids) S.dims[i].v = v; }
    for (const id in S.dims) { const d = S.dims[id]; if (d.driven) { const m = measureDim(d); if (m != null && isFinite(m)) d.v = m; } }
    if (evalDims()) continue;      // a formula referenced a dimension the solver just moved: solve again with the new values
    dof = gcs.gcs.dof();
    return { ok: true };
  }
  return { ok: false, msg: 'Could not resolve constraints' };
}

// ---------------------------------------------------------------- history / persistence
const snapshot = () => JSON.stringify({ part, act: actId });
function restore(s) {
  const o = JSON.parse(s); part = o.part; const f = (feat(o.act) && feat(o.act).type === 'sketch') ? feat(o.act) : part.feats[0];
  actId = f.id; S = f.sk; lastNid = S.nid; if (typeof closeFlPanel === 'function') closeFlPanel();
  sel = sel.filter(x => (x.k === 'p' ? S.pts : x.k === 'e' ? S.ents : x.k === 'd' ? S.dims : x.k === 'c' ? S.cons : S.pats)[x.id]); solve(); buildModel(); dirty3 = true;
}
function pushHist() { lastNid = S.nid; hist.length = hi + 1; hist.push(snapshot()); hi++; if (hist.length > 120) { hist.shift(); hi--; } persist(); }
function commit(silent) {
  gc();
  const r = solve({ newFrom: lastNid });
  if (!r.ok) { restore(hist[hi]); if (!silent) toast(r.msg); refresh(); return false; }
  gc(); regen(); pushHist(); refresh(); return true;
}
function commitPart() { regen(); pushHist(); refresh(); }
function undo() { if (hi > 0) { hi--; restore(hist[hi]); closePop(); resetTool(); persist(); afterJump(); } }
function redo() { if (hi < hist.length - 1) { hi++; restore(hist[hi]); closePop(); resetTool(); persist(); afterJump(); } }
function afterJump() { if ((mode === 'model' || mode === 'flat') && !(model && model.outer)) setMode('sketch'); else { $('#pname').value = part.name; refresh(); } }
function persist() { try { localStorage.setItem('qc.part', hist[hi]); } catch (e) {} }
function saveSettings() { try { localStorage.setItem('qc.settings', JSON.stringify(settings)); } catch (e) {} }
function validSketch(o) { return o && typeof o === 'object' && o.pts && o.pts.p0 && o.ents && o.cons && o.dims && o.pats && typeof o.nid === 'number'; }
function validPart(o) { return o && Array.isArray(o.feats) && o.feats.length && o.feats[0].type === 'sketch' && o.feats.every(f => f.type !== 'sketch' || validSketch(f.sk)); }
function wrapSketch(sk) { const p = newPart(); p.name = sk.name && sk.name !== 'Sketch1' ? sk.name : 'Part1'; p.feats[0].sk = sk; return p; }
function loadPart(p) {
  part = p; actId = part.feats[0].id; S = part.feats[0].sk; lastNid = S.nid; sel = []; closePop(); tool = { name: 'select', step: 0 }; cur = null; hist.length = 0; hi = -1;
  gc(); solve(); regen(); pushHist(); $('#pname').value = part.name || 'Part1'; G3.fitNext = true;
  setMode(model && model.outer ? 'model' : 'sketch'); fit(); refresh();
}
function loadSketch(o) { loadPart(wrapSketch(o)); }

// ---------------------------------------------------------------- view
const cv = $('#cv'), ctx = cv.getContext('2d');
let CW = 0, CH = 0, DPR = 1;
const w2s = (x, y) => [view.ox + x * view.s, view.oy - y * view.s];
const s2w = (sx, sy) => ({ x: (sx - view.ox) / view.s, y: (view.oy - sy) / view.s });
function resize() {
  const r = $('#stage').getBoundingClientRect(); DPR = window.devicePixelRatio || 1; CW = r.width; CH = r.height;
  cv.width = Math.max(1, Math.round(CW * DPR)); cv.height = Math.max(1, Math.round(CH * DPR)); dirty = true; dirty3 = true;
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
// Inference snapping: while a draw tool is active the cursor locks to endpoints, centers, midpoints, intersections, quadrants, perpendicular and tangent
// points (from the start point of the line being drawn), nearest-on-curve, and to horizontal / vertical / parallel / perpendicular directions. Each one makes the matching constraint.
const SNAP_LABEL = { pt: 'Endpoint', mid: 'Midpoint', on: 'On curve', int: 'Intersection', quad: 'Quadrant', perp: 'Perpendicular', tan: 'Tangent', par: 'Parallel', perpd: 'Perpendicular' };
function inferPoints(w, ref, tol) {
  const cands = [], E = S.ents, ids = Object.keys(E), G = {}; for (const id of ids) G[id] = entG(E[id]);
  const swept = (g, x, y) => g.t === 'circle' || inSweep(g, Math.atan2(y - g.cy, x - g.cx));
  // intersections
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = G[ids[i]], b = G[ids[j]], pts = [];
    if (a.t === 'line' && b.t === 'line') { const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1, d2x = b.x2 - b.x1, d2y = b.y2 - b.y1, den = d1x * d2y - d1y * d2x; if (Math.abs(den) > 1e-12) { const u = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / den, v = ((b.x1 - a.x1) * d1y - (b.y1 - a.y1) * d1x) / den; if (u > -1e-6 && u < 1 + 1e-6 && v > -1e-6 && v < 1 + 1e-6) pts.push([a.x1 + u * d1x, a.y1 + u * d1y]); } }
    else if ((a.t === 'line') !== (b.t === 'line') && a.t !== 'line' !== (b.t !== 'line')) { const L = a.t === 'line' ? a : b, C = a.t === 'line' ? b : a, dx = L.x2 - L.x1, dy = L.y2 - L.y1, fx = L.x1 - C.cx, fy = L.y1 - C.cy, A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), K = fx * fx + fy * fy - C.r * C.r, D = B * B - 4 * A * K;
      if (A > 1e-12 && D >= 0) for (const sg of D < 1e-12 ? [0] : [-1, 1]) { const u = (-B + sg * Math.sqrt(D)) / (2 * A); if (u > -1e-6 && u < 1 + 1e-6) { const x = L.x1 + u * dx, y = L.y1 + u * dy; if (swept(C, x, y)) pts.push([x, y]); } } }
    for (const [x, y] of pts) cands.push({ x, y, kind: 'int', e1: ids[i], e2: ids[j], pr: 2 });
  }
  // quadrants of circles and arcs
  for (const id of ids) { const g = G[id]; if (g.t === 'line') continue; for (let k = 0; k < 4; k++) { const an = k * PI / 2, x = g.cx + g.r * Math.cos(an), y = g.cy + g.r * Math.sin(an); if (swept(g, x, y)) cands.push({ x, y, kind: 'quad', eid: id, horiz: k % 2 === 0 ? false : true, pr: 3 }); } }
  // perpendicular and tangent from the start point of the line being drawn
  if (ref) for (const id of ids) { const g = G[id];
    if (g.t === 'line') { const dx = g.x2 - g.x1, dy = g.y2 - g.y1, L2 = dx * dx + dy * dy; if (L2 < 1e-12) continue; const u = ((ref.x - g.x1) * dx + (ref.y - g.y1) * dy) / L2; if (u < -1e-6 || u > 1 + 1e-6) continue; const x = g.x1 + u * dx, y = g.y1 + u * dy; if (hyp(x - ref.x, y - ref.y) < 1e-4) continue; cands.push({ x, y, kind: 'perp', eid: id, pr: 5 }); }
    else { const dx = ref.x - g.cx, dy = ref.y - g.cy, d = hyp(dx, dy); if (d <= g.r * 1.001) continue; const al = Math.atan2(dy, dx), be = Math.acos(g.r / d); for (const sg of [-1, 1]) { const x = g.cx + g.r * Math.cos(al + sg * be), y = g.cy + g.r * Math.sin(al + sg * be); if (swept(g, x, y)) cands.push({ x, y, kind: 'tan', eid: id, pr: 5 }); } } }
  let best = null; for (const c of cands) { const d = hyp(c.x - w.x, c.y - w.y); if (d < tol * (c.pr === 5 ? 0.9 : 1) && (!best || c.pr < best.pr || (c.pr === best.pr && d < best.d))) best = Object.assign(c, { d }); }
  return best;
}
function snap(sx, sy, ref) {
  const w = s2w(sx, sy), tol = tolPx() / view.s;
  let best = null, bd = tol;
  for (const id in S.pts) { const p = S.pts[id], d = hyp(p.x - w.x, p.y - w.y); if (d < bd) { bd = d; best = { x: p.x, y: p.y, kind: 'pt', pid: id }; } }
  if (best) return best;
  const inf = inferPoints(w, ref, tol); if (inf && inf.pr <= 3) return inf;
  bd = tol * 0.8;
  for (const id in S.ents) { const e = S.ents[id]; if (e.t !== 'line') continue; const a = P(e.a), b = P(e.b), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = hyp(mx - w.x, my - w.y); if (d < bd) { bd = d; best = { x: mx, y: my, kind: 'mid', eid: id }; } }
  if (best) return best;
  if (inf) return inf;
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
      else for (const id in S.ents) { const e = S.ents[id]; if (e.t !== 'line' || (tool.lastEid && id === tool.lastEid && false)) continue; const u = lineDir(e), ang = Math.atan2(dy, dx);
        for (const [rot, kind] of [[0, 'par'], [PI / 2, 'perpd']]) { let da = ang - (Math.atan2(u.y, u.x) + rot); da = ((da % PI) + PI) % PI; if (da > PI / 2) da -= PI; if (Math.abs(da) < 0.045) { const ca = Math.atan2(u.y, u.x) + rot, k = dx * Math.cos(ca) + dy * Math.sin(ca); out.x = ref.x + k * Math.cos(ca); out.y = ref.y + k * Math.sin(ca); out.dir = { kind, eid: id }; break; } }
        if (out.dir) break; }
    }
  }
  return out;
}
function ptFromSnap(sn) {
  if (sn.pid && S.pts[sn.pid]) return sn.pid;
  const p = addPt(sn.x, sn.y);
  if (sn.kind === 'mid' && S.ents[sn.eid]) addCon({ t: 'mid', p, e: sn.eid, auto: true });
  else if ((sn.kind === 'on' || sn.kind === 'perp') && S.ents[sn.eid]) addCon({ t: 'pol', p, e: sn.eid, auto: true });
  else if (sn.kind === 'int') { if (S.ents[sn.e1]) addCon({ t: 'pol', p, e: sn.e1, auto: true }); if (S.ents[sn.e2]) addCon({ t: 'pol', p, e: sn.e2, auto: true }); }
  else if (sn.kind === 'quad' && S.ents[sn.eid]) { const e = S.ents[sn.eid]; addCon({ t: 'pol', p, e: sn.eid, auto: true }); addCon({ t: sn.horiz ? 'vpp' : 'hpp', p: e.c, q: p, auto: true }); }
  return p;
}
function realHit(h) {       // a line's midpoint becomes a real point (locked to the middle of the line) the first time it is used
  if (!h || h.k !== 'p' || h.id != null || h.mid == null || !S.ents[h.mid]) return h;
  for (const id in S.cons) { const c = S.cons[id]; if (c.t === 'mid' && c.e === h.mid && S.pts[c.p]) return { k: 'p', id: c.p }; }
  const e = S.ents[h.mid], a = P(e.a), b = P(e.b), p = addPt((a.x + b.x) / 2, (a.y + b.y) / 2); S.pts[p].mid = h.mid; addCon({ t: 'mid', p, e: h.mid });
  return { k: 'p', id: p };
}
const midOn = () => (tool.name === 'con' && ['hor', 'ver', 'sym', 'mid', 'coi', 'fix'].includes(tool.type)) || (tool.name === 'select' && tool.dim);
function hitTest(sx, sy) {
  for (const id in labelRects) { const r = labelRects[id]; if (S.dims[id] && sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 4 && sy <= r.y + r.h + 4) return { k: 'd', id }; }
  const w = s2w(sx, sy), tol = tolPx() / view.s;
  let best = null, bd = tol;
  for (const id in S.pts) { const p = S.pts[id], d = hyp(p.x - w.x, p.y - w.y); if (d < bd) { bd = d; best = { k: 'p', id }; } }
  if (best) return best;
  if (midOn()) { bd = sel.some(q => q.k === 'p') ? tol : tool.name === 'con' ? tol * 0.45 : tol * 0.25; for (const id in S.ents) { const e = S.ents[id]; if (e.t !== 'line') continue; const a = P(e.a), b = P(e.b), d = hyp((a.x + b.x) / 2 - w.x, (a.y + b.y) / 2 - w.y); if (d < bd) { bd = d; best = { k: 'p', id: null, mid: id }; } } if (best) return best; }
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
  select: 'Tap to select, drag to move anything that is not locked, double-tap a line, circle or dimension to edit its size. Drag a box to select. Tap Dimension to dimension several things.',
  dim: 'Tap an item to dimension it. Drag a box to select: right = fully inside, left = anything touched. Drag points to move geometry.',
  line: 'Line: drag from start to end, or tap the start then the end.',
  poly: 'Polyline: tap each corner. Tap the first point to close, or tap the last point again to finish.',
  rect: 'Rectangle: drag corner to corner, or tap two corners.',
  circle: 'Circle: tap the center, then a point on the rim (or drag out the radius).',
  'circle-2pt': 'Circle, 2 point: tap one end of the diameter, then the other end.',
  'circle-3pt': 'Circle, 3 point: tap three points that lie on the circle.',
  'rect-center': 'Rectangle from center: tap the center, then a corner.',
  arc: 'Arc: tap the center, the start, then sweep to the end.',
  slot: 'Slot: tap one end center, the other end center, then set the width.',
  project: 'Project: the dashed yellow lines are edges and holes of the part. Tap one to bring it into this sketch as reference geometry that follows the part. Tap Project again when done.',
  face: 'Face: tap inside the closed outline to turn it into sheet metal.',
  fillet: 'Fillet: tap a corner where two lines meet, then type the radius.',
  chamfer: 'Chamfer: tap a corner where two lines meet, then type the size.',
};
function setTool(name, dim) { finishPoly(); tool = { name, step: 0 }; if (dim) tool.dim = true; cur = null; closePop(); if (name !== 'select') sel = []; refresh(); }
function resetTool() { tool = { name: tool.name, step: 0 }; cur = null; dirty = true; }
function finishPoly() { if ((tool.name === 'poly' || tool.name === 'line') && tool.step) resetTool(); }
function toolClick(sn) {
  const T = tool;
  if (T.name === 'line' || T.name === 'poly') {
    if (T.step === 0) { T.p0 = sn; T.step = 1; return; }
    if (hyp(sn.x - T.p0.x, sn.y - T.p0.y) * view.s < 4) { resetTool(); return; }
    const a = T.lastPid && S.pts[T.lastPid] ? T.lastPid : ptFromSnap(T.p0), b = ptFromSnap(sn);
    if (a === b) { resetTool(); return; }
    const l = addEnt({ t: 'line', a, b }); if (sn.hv) addCon({ t: sn.hv, e: l, auto: true });
    if (sn.kind === 'perp' && S.ents[sn.eid]) addCon({ t: 'perp', e1: l, e2: sn.eid, auto: true }); else if (sn.kind === 'tan' && S.ents[sn.eid]) { addCon({ t: 'tan', e1: l, e2: sn.eid, auto: true }); addCon({ t: 'pol', p: b, e: sn.eid, auto: true }); }
    else if (sn.dir && S.ents[sn.dir.eid]) addCon({ t: sn.dir.kind === 'par' ? 'par' : 'perp', e1: l, e2: sn.dir.eid, auto: true });
    const ok = commit();
    if (ok && S.pts[b] && b !== T.firstPid) { T.firstPid = T.firstPid || a; T.lastPid = b; T.p0 = { x: P(b).x, y: P(b).y, kind: 'pt', pid: b }; }
    else resetTool();
  } else if (T.name === 'rect') {
    if (T.step === 0) { T.p0 = sn; T.step = 1; return; }
    if (Math.abs(sn.x - T.p0.x) * view.s < 4 || Math.abs(sn.y - T.p0.y) * view.s < 4) return;
    if (toolVar.rect === 'center') {
      const dx = Math.abs(sn.x - T.p0.x), dy = Math.abs(sn.y - T.p0.y), cx = T.p0.x, cy = T.p0.y;
      const A = addPt(cx - dx, cy - dy), B = addPt(cx + dx, cy - dy), C = addPt(cx + dx, cy + dy), D = addPt(cx - dx, cy + dy);
      const l1 = addEnt({ t: 'line', a: A, b: B }), l2 = addEnt({ t: 'line', a: B, b: C }), l3 = addEnt({ t: 'line', a: C, b: D }), l4 = addEnt({ t: 'line', a: D, b: A });
      addCon({ t: 'hor', e: l1, auto: true }); addCon({ t: 'ver', e: l2, auto: true }); addCon({ t: 'hor', e: l3, auto: true }); addCon({ t: 'ver', e: l4, auto: true });
      const dg = addEnt({ t: 'line', a: A, b: C, con: true }), c = ptFromSnap(T.p0); addCon({ t: 'mid', p: c, e: dg });
      commit(); resetTool(); return;
    }
    const A = ptFromSnap(T.p0), C = ptFromSnap(sn), B = addPt(sn.x, T.p0.y), D = addPt(T.p0.x, sn.y);
    const l1 = addEnt({ t: 'line', a: A, b: B }), l2 = addEnt({ t: 'line', a: B, b: C }), l3 = addEnt({ t: 'line', a: C, b: D }), l4 = addEnt({ t: 'line', a: D, b: A });
    addCon({ t: 'hor', e: l1, auto: true }); addCon({ t: 'ver', e: l2, auto: true }); addCon({ t: 'hor', e: l3, auto: true }); addCon({ t: 'ver', e: l4, auto: true });
    commit(); resetTool();
  } else if (T.name === 'circle') {
    if (T.step === 0) { T.p0 = sn; T.step = 1; return; }
    const v = toolVar.circle;
    if (v === '2pt') {           // the two clicks are the ends of a diameter
      const d = hyp(sn.x - T.p0.x, sn.y - T.p0.y); if (d * view.s < 8) return;
      const p1 = ptFromSnap(T.p0), p2 = ptFromSnap(sn); if (p1 === p2) { resetTool(); return; }
      const c = addPt((T.p0.x + sn.x) / 2, (T.p0.y + sn.y) / 2), ci = addEnt({ t: 'circle', c, r: d / 2 }), dg = addEnt({ t: 'line', a: p1, b: p2, con: true });
      addCon({ t: 'mid', p: c, e: dg }); addCon({ t: 'pol', p: p1, e: ci, auto: true }); commit(); resetTool(); return;
    }
    if (v === '3pt') {           // three points on the circle
      if (T.step === 1) { if (hyp(sn.x - T.p0.x, sn.y - T.p0.y) * view.s < 6) return; T.p1 = sn; T.step = 2; return; }
      const cc = circum(T.p0, T.p1, sn); if (!cc) { toast('Those three points are in a line — pick a point off the line'); return; }
      const p1 = ptFromSnap(T.p0), p2 = ptFromSnap(T.p1), p3 = ptFromSnap(sn); if (p1 === p2 || p2 === p3 || p1 === p3) { resetTool(); return; }
      const c = addPt(cc.x, cc.y), ci = addEnt({ t: 'circle', c, r: cc.r });
      for (const q of [p1, p2, p3]) { S.pts[q].keep = true; addCon({ t: 'pol', p: q, e: ci, auto: true }); }
      commit(); resetTool(); return;
    }
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
function circum(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)); if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d, y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d; return { x, y, r: hyp(a.x - x, a.y - y) };
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
    if ((o.t === 'len' || o.t === 'dx' || o.t === 'dy') && ((d.p === o.p && d.q === o.q) || (d.p === o.q && d.q === o.p))) return id;
    if (o.t === 'pld' && d.p === o.p && d.e === o.e) return id;
    if (o.t === 'ang' && ((d.e1 === o.e1 && d.e2 === o.e2) || (d.e1 === o.e2 && d.e2 === o.e1))) return id;
    if ((o.t === 'dia' || o.t === 'rad') && d.e === o.e) return id; }
  return null;
}
// What dimension does the current selection offer?
let dimPlace = null;
// Which dimension a drop point asks for, Inventor style: below/above the two points = horizontal, beside = vertical, out along the diagonal = straight-line.
function placeOffer(pid, qid, c) {
  const A = P(pid), B = P(qid);
  const x0 = Math.min(A.x, B.x), x1 = Math.max(A.x, B.x), y0 = Math.min(A.y, B.y), y1 = Math.max(A.y, B.y);
  const inX = c.x > x0 && c.x < x1, inY = c.y > y0 && c.y < y1;
  let t = 'len'; if (inX && !inY && x1 - x0 > 1e-9) t = 'dx'; else if (inY && !inX && y1 - y0 > 1e-9) t = 'dy';
  if (t === 'dx') { const [p, q] = A.x <= B.x ? [pid, qid] : [qid, pid]; return { o: { t: 'dx', p, q }, v: x1 - x0, off: c.y, label: 'Horizontal distance' }; }
  if (t === 'dy') { const [p, q] = A.y <= B.y ? [pid, qid] : [qid, pid]; return { o: { t: 'dy', p, q }, v: y1 - y0, off: c.x, label: 'Vertical distance' }; }
  const L = hyp(B.x - A.x, B.y - A.y) || 1, n = { x: -(B.y - A.y) / L, y: (B.x - A.x) / L };
  return { o: { t: 'len', p: pid, q: qid }, v: L, off: (c.x - A.x) * n.x + (c.y - A.y) * n.y, label: 'Distance' };
}
function placeDim(c) {
  const dp = dimPlace; dimPlace = null; if (!dp || !S.pts[dp.p] || !S.pts[dp.q]) { refresh(); return; }
  const off = placeOffer(dp.p, dp.q, c), ex = findDim(off.o);
  if (ex) { S.dims[ex].off = off.off; sel = [{ k: 'd', id: ex }]; commit(); showSelPop(); return; }
  const id = addDim(Object.assign({}, off.o, { v: +off.v.toFixed(6), off: off.off }));
  if (!commit()) {
    const id2 = addDim(Object.assign({}, off.o, { v: 1, off: off.off, driven: true }));
    if (commit(true)) { toast('Already set by other dimensions — added as a driven reference ' + id2); sel = [{ k: 'd', id: id2 }]; refresh(); showSelPop(); }
    else { sel = []; refresh(); }
    return;
  }
  sel = [{ k: 'd', id }]; refresh(); showSelPop();
}
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
const EQ_OK = { len: 1, pld: 1, dia: 1, rad: 1, dx: 1, dy: 1 };
function linkEqual(aId, bId) {
  const A = S.dims[aId], B = S.dims[bId]; if (!A || !B || aId === bId) return false;
  if (!EQ_OK[A.t] || !EQ_OK[B.t]) return false;
  const gn = 'g' + aId;
  const ids = Object.keys(S.dims).filter(i => i === aId || i === bId || (A.g && S.dims[i].g === A.g) || (B.g && S.dims[i].g === B.g));
  for (const i of ids) { S.dims[i].g = gn; S.dims[i].gf = false; delete S.dims[i].expr; delete S.dims[i].driven; }
  return true;
}
const plainRef = raw => { const m = /^\s*(d\d+)\s*$/i.exec(String(raw).replace(/−/g, '-')); return m ? m[1].toLowerCase() : null; };
function equalDims(a, b) {          // make two dimensions share one value (it floats until you type a value into either one)
  const A = S.dims[a], B = S.dims[b]; if (!A || !B) return;
  if (!EQ_OK[A.t] || !EQ_OK[B.t]) { toast('Angles cannot be made equal to lengths'); return; }
  if (A.g && A.g === B.g) { toast('Those two are already equal'); return; }
  const gn = 'g' + a, ids = Object.keys(S.dims).filter(i => i === a || i === b || (A.g && S.dims[i].g === A.g) || (B.g && S.dims[i].g === B.g));
  for (const i of ids) { S.dims[i].g = gn; S.dims[i].gf = false; }
  if (commit()) { sel = []; closePop(); refresh(); toast('Dimensions are now equal (' + fmt(S.dims[a].v) + ')'); }
}
function previewDim(mut) {   // live preview while typing: start from the state the popup opened on, apply the typed value, solve, but don't commit
  if (!popState) return;
  restore(popState.base);
  if (mut() && !solve().ok) restore(popState.base);
  popState.dimPrev = true;
  dirty = true;
}
function setDimVal(id, v) { const d = S.dims[id]; if (!d) return false; if (d.g) { for (const i in S.dims) if (S.dims[i].g === d.g) S.dims[i].v = v; } else d.v = v; return true; }
function applyDim(offer, v, expr) {
  if (!(v > 0) || (offer.ang && v >= 180)) { toast(offer.ang ? 'Enter an angle between 0 and 180' : 'Enter a value greater than 0'); return false; }
  const pr = expr && plainRef(expr), tgt = offer.existing ? S.dims[offer.existing] : null;
  const eq = pr && S.dims[pr] && (!tgt || (EQ_OK[tgt.t] && EQ_OK[S.dims[pr].t])) && (!offer.o || EQ_OK[offer.o.t]);
  if (offer.existing) { const d0 = tgt;
    if (eq) linkEqual(offer.existing, pr);
    else if (expr) { d0.expr = expr; delete d0.g; delete d0.gf; delete d0.driven; d0.v = v; }
    else { delete d0.expr; if (d0.g) { for (const i in S.dims) if (S.dims[i].g === d0.g) { S.dims[i].v = v; S.dims[i].gf = true; } } else d0.v = v; } }
  else { const nid = addDim(Object.assign({}, offer.o, { v, off: defaultOff(offer.o) }, expr && !eq ? { expr } : {})); if (eq) linkEqual(nid, pr); }
  let ok = commit();
  if (!ok && eq) {   // averaging impossible here (something else pins the geometry): follow the other dimension one-way instead
    if (offer.existing) { const d0 = S.dims[offer.existing]; d0.expr = pr; delete d0.g; delete d0.gf; d0.v = S.dims[pr].v; }
    else addDim(Object.assign({}, offer.o, { v: S.dims[pr].v, off: defaultOff(offer.o), expr: pr }));
    ok = commit(true); if (ok) toast('Linked one-way to ' + pr + ' (averaging would conflict with other constraints)');
  }
  if (!ok && !offer.existing) {   // the sketch is already fully defined there: add it as a driven (reference) dimension instead
    const id = addDim(Object.assign({}, offer.o, { v: 1, off: defaultOff(offer.o), driven: true }));
    if (commit(true)) { toast('Already set by other dimensions — added as a driven reference ' + id); ok = true; }
  }
  if (ok) { sel = []; closePop(); refresh(); } return ok;
}

// ---------------------------------------------------------------- constraint as a tool: tap the constraint, then tap the geometry (stays on until Esc)
const CON_HINT = { hor: 'Horizontal: tap a line, or two points', ver: 'Vertical: tap a line, or two points', par: 'Parallel: tap two lines', perp: 'Perpendicular: tap two lines', tan: 'Tangent: tap a line and a circle/arc, or two circles/arcs',
  eq: 'Equal: tap two lines, or two circles/arcs', coi: 'Coincident: tap a point or a line, then the point to join it to', conc: 'Concentric: tap two circles or arcs', sym: 'Symmetric: tap two points, then the mirror line',
  mid: 'Midpoint: tap a point and a line', fix: 'Fix: tap a point or a line to lock it (tap again to unlock)' };
function conParts() { const pts = sel.filter(s => s.k === 'p'), ents = sel.filter(s => s.k === 'e'), lines = ents.filter(s => S.ents[s.id].t === 'line'); return { p: pts.length, e: ents.length, l: lines.length, r: ents.length - lines.length }; }
function conAccept(type, h) {
  if (!h || (h.k !== 'p' && h.k !== 'e')) return false; const line = h.k === 'e' && S.ents[h.id].t === 'line', round = h.k === 'e' && !line;
  switch (type) { case 'hor': case 'ver': case 'sym': case 'mid': return h.k === 'p' || line; case 'par': case 'perp': return line; case 'conc': return round; case 'tan': case 'eq': return h.k === 'e'; default: return true; }
}
function conReady(type) {
  const n = conParts();
  switch (type) {
    case 'hor': case 'ver': return (n.l >= 1 && !n.p) || (n.p === 2 && !n.e);
    case 'par': case 'perp': return n.l === 2;
    case 'tan': return (n.l === 1 && n.r === 1) || (!n.l && n.r === 2);
    case 'eq': return (n.l === 2 && !n.r) || (n.r === 2 && !n.l);
    case 'coi': return (n.p === 2 && !n.e) || (n.p === 1 && n.e === 1);
    case 'conc': return n.r === 2;
    case 'sym': return n.p === 2 && n.l === 1;
    case 'mid': return n.p === 1 && n.l === 1;
    case 'fix': return n.p + n.e >= 1;
  }
  return false;
}
function startCon(type) {
  finishPoly(); closePop(); cur = null;
  sel = sel.filter(s => conAccept(type, s)); if (sel.length >= (type === 'sym' ? 3 : 2)) sel = [];
  tool = { name: 'con', type, step: 0 }; refresh(); toast(CON_HINT[type] + (sel.length ? ' — now tap the other one' : ''));
}
function conTap(h) {
  const type = tool.type;
  if (!h) { if (sel.length) { sel = []; refresh(); } return; }
  if (!conAccept(type, h)) { toast(CON_HINT[type]); return; }
  const i = sel.findIndex(s => s.k === h.k && s.id === h.id);
  if (i >= 0) sel.splice(i, 1); else { sel.push({ k: h.k, id: h.id }); const n = conParts(), max = type === 'sym' ? 3 : 2; if (!conReady(type) && (sel.length >= max || (type === 'coi' && n.e > 1) || ((type === 'hor' || type === 'ver') && n.p && n.e) || ((type === 'tan' || type === 'eq') && false))) sel = [{ k: h.k, id: h.id }]; }
  if (conReady(type)) { applyCon(type, true); if (tool.name === 'con') { sel = []; } }
  refresh();
}
function escAll() {
  closePop(); dimPlace = null; if (cutSel) cancelCut(); endFlPick(); endCrPick(); closeFlPanel(); finishPoly(); if (selFace) setSelFace(null);
  tool = { name: 'select', step: 0 }; cur = null; sel = []; act = null; refresh(); if (mode === 'model') { G3.rebuild = true; dirty3 = true; }
}
function applyCon(type, fromTool) {
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
      const ids = new Set(pts); ents.forEach(i => entPts(E[i]).forEach(p => ids.add(p))); ids.delete('p0'); for (const q of [...ids]) if (P(q).proj) ids.delete(q);
      if (!ids.size) { need = 'Select points or geometry to lock in place'; break; }
      const on = [...ids].some(p => !P(p).fixed); ids.forEach(p => { if (on) P(p).fixed = true; else delete P(p).fixed; }); break;
    }
  }
  if (need) { if (fromTool) { sel = []; toast(need); } else startCon(type); return; }
  closePop();
  if (commit()) { sel = []; refresh(); }
}

// ---------------------------------------------------------------- fillet / chamfer on a sketch corner
// The corner point stays as a "virtual sharp": two construction lines run from the new end points back to it (collinear with the real lines),
// so dimensions that reach the corner keep working. Fillet = tangent arc + radius dimension. Chamfer = a line + one distance dimension (both legs equal).
let lastCorner = 0.25;
function cornerLinesAt(pid) { return Object.keys(S.ents).filter(id => { const e = S.ents[id]; return e.t === 'line' && !e.con && (e.a === pid || e.b === pid); }); }
function cornerPick(px, py) {
  const w = s2w(px, py), tol = Math.max(tolPx(), 16) / view.s; let best = null, bd = tol;
  for (const id in S.pts) { const p = S.pts[id], d = hyp(p.x - w.x, p.y - w.y); if (d < bd && cornerLinesAt(id).length === 2) { bd = d; best = id; } }
  return best;
}
function doCorner(kind, pid) {
  const ls = cornerLinesAt(pid), E = S.ents;
  if (ls.length !== 2) { toast('Tap a corner where exactly two lines meet'); return false; }
  for (const id in E) { const e = E[id]; if (e.t !== 'line' && entPts(e).includes(pid)) { toast('That corner touches an arc or circle — only line-to-line corners can be rounded'); return false; } }
  const [i1, i2] = ls, E1 = E[i1], E2 = E[i2];
  if (E1.proj || E2.proj) { toast('Projected part edges cannot be changed here — change the outline sketch'); return false; }
  const P0 = P(pid), A1 = P(E1.a === pid ? E1.b : E1.a), A2 = P(E2.a === pid ? E2.b : E2.a);
  const l1 = hyp(A1.x - P0.x, A1.y - P0.y), l2 = hyp(A2.x - P0.x, A2.y - P0.y), u1 = [(A1.x - P0.x) / l1, (A1.y - P0.y) / l1], u2 = [(A2.x - P0.x) / l2, (A2.y - P0.y) / l2];
  const cs = u1[0] * u2[0] + u1[1] * u2[1]; if (Math.abs(cs) > 0.9999) { toast('Those two lines are straight or overlapping — no corner to ' + (kind === 'fillet' ? 'round' : 'chamfer')); return false; }
  const half = Math.acos(cs) / 2, m = Math.min(l1, l2) * 0.45;
  let size = lastCorner, t = kind === 'fillet' ? size / Math.tan(half) : size;
  if (t > m) { t = m; size = kind === 'fillet' ? t * Math.tan(half) : t; }
  if (!(size > 1e-4)) { toast('The sides are too short here'); return false; }
  const T1 = addPt(P0.x + u1[0] * t, P0.y + u1[1] * t), T2 = addPt(P0.x + u2[0] * t, P0.y + u2[1] * t), cm = constrMode; constrMode = false;
  if (E1.a === pid) E1.a = T1; else E1.b = T1; if (E2.a === pid) E2.a = T2; else E2.b = T2;
  let dimId;
  if (kind === 'fillet') {
    const bx = u1[0] + u2[0], by = u1[1] + u2[1], bl = hyp(bx, by), dc = size / Math.sin(half), C = addPt(P0.x + bx / bl * dc, P0.y + by / bl * dc), c = P(C), a = P(T1), b = P(T2);
    const ccw = (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x) > 0, arc = addEnt(ccw ? { t: 'arc', c: C, a: T1, b: T2 } : { t: 'arc', c: C, a: T2, b: T1 });
    addCon({ t: 'tan', e1: i1, e2: arc }); addCon({ t: 'tan', e1: i2, e2: arc });
    dimId = addDim({ t: 'rad', e: arc, v: size, off: defaultOff({ t: 'rad', e: arc }) });
  } else addEnt({ t: 'line', a: T1, b: T2 });
  const k1 = addEnt({ t: 'line', a: T1, b: pid, con: true }), k2 = addEnt({ t: 'line', a: T2, b: pid, con: true });
  addCon({ t: 'par', e1: i1, e2: k1 }); addCon({ t: 'par', e1: i2, e2: k2 });
  if (kind === 'chamfer') { addCon({ t: 'eq', e1: k1, e2: k2 }); dimId = addDim({ t: 'len', p: T1, q: pid, v: size, off: 30 / view.s }); }
  constrMode = cm; lastCorner = size;
  if (!commit()) return false;
  sel = [{ k: 'd', id: dimId }]; refresh(); showSelPop(); toast((kind === 'fillet' ? 'Fillet' : 'Chamfer') + ' added — type a new ' + (kind === 'fillet' ? 'radius' : 'size') + ' or tap the next corner');
  return true;
}
function cornerTap(px, py) {
  const pid = cornerPick(px, py); if (!pid) { toast('Tap a corner point where two lines meet'); return; }
  doCorner(tool.name, pid);
}

function deleteSel() {
  if (!sel.length) { toast('Select something to delete first'); return; }
  let n = 0, pj = 0;
  for (const s of sel) {
    if (s.k === 'e' && S.ents[s.id]) { if (S.ents[s.id].proj && S.ents[s.id].proj[0] !== '@pg') { pj++; continue; } delete S.ents[s.id]; n++; }
    else if (s.k === 'd' && S.dims[s.id]) { delete S.dims[s.id]; n++; }
    else if (s.k === 'c' && S.cons[s.id]) { delete S.cons[s.id]; n++; }
    else if (s.k === 'pat' && S.pats[s.id]) { delete S.pats[s.id]; n++; }
  }
  if (!n) { toast(pj ? 'Projected edges follow the part outline — edit the outline sketch to change them' : 'Points are removed with their geometry — select the line or circle'); return; }
  sel = []; closePop(); commit();
}
function toggleConstr() {
  const ents = sel.filter(s => s.k === 'e' && !S.ents[s.id].proj);
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
  if (popState && revert !== false) { if (popState.dimPrev) restore(popState.base); else if (popState.dirtyDraft) restore(hist[hi]); }
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
  pop.innerHTML = ''; popState = { spec, active: 0, fresh: true, vals: spec.fields.map(f => f.value), dirtyDraft: !!spec.draft, base: snapshot() };
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
  if (spec.dimRef && spec.fields.length) pop.append(el('div', { class: 'keys keys2' }, ['+', '−', '×', '(', ')'].map(k => el('button', { 'aria-label': k, onclick: () => popKey(k) }, k))));
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
    const s = String(popState.vals[i]).replace(/−/g, '-');
    let v;
    if (f.kind !== 'int' && /d\d/i.test(s)) { const ev = evalExpr(s); v = ev == null ? NaN : ev; }
    else { v = (f.kind === 'len' || f.kind === 'slen') ? parseLen(s) : parseNum(s); if (!isFinite(v) && f.kind !== 'int' && popState.spec.dimRef) { const ev = evalExpr(s); if (ev != null) v = ev; } }   // plain math: 1.5+.25, 25mm+1
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
  else if (k === '−' || k === '-') s = popState.spec.dimRef ? s + '-' : (s.startsWith('−') ? s.slice(1) : '−' + s);
  else if (k === '×' || k === '*') s += '*';
  else if (k === '+' || k === '(' || k === ')') s += k;
  else if (k === '/' && popState.spec.dimRef && /mm$/.test(s)) s += '/';
  else if (k === 'mm') s = popState.spec.dimRef && /[-+*/()]/.test(s.replace(/^-/, '')) ? (/mm$/.test(s) ? s : /[\d.]$/.test(s) ? s + 'mm' : s) : s.replace(/mm$/, '') + 'mm';
  else s = s.replace(/mm$/, '') + k + (/mm$/.test(s) ? 'mm' : '');
  popState.vals[i] = s; popState.fresh = false; paintPop();
  if (popState.spec.onChange) { const v = popVals(); if (v) popState.spec.onChange(v); }
}
function popRefInsert(id) {
  if (!popState || !popState.spec.dimRef) return;
  const i = popState.active; let v = popState.fresh ? '' : String(popState.vals[i]);
  popState.vals[i] = v + id; popState.fresh = false; paintPop();
  if (popState.spec.onChange) { const vv = popVals(); if (vv) popState.spec.onChange(vv); }
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
    if (d.driven) {
      openPop({ title: s0.id + ' (driven) = ' + fmt(d.v) + (d.t === 'ang' ? '°' : ' in'), fields: [], actions: [
        { label: 'Make driving', fn: () => { delete S.dims[s0.id].driven; closePop(); sel = []; commit(); } },
        { label: 'Delete dimension', cls: 'dg', fn: deleteSel }] }); return;
    }
    const acts = [{ label: 'Make driven', fn: () => { if (popState.dimPrev) { popState.dimPrev = false; restore(popState.base); } const dd = S.dims[s0.id]; dd.driven = true; delete dd.g; delete dd.gf; delete dd.expr; closePop(); sel = []; commit(true); } },
      { label: 'Delete dimension', cls: 'dg', fn: deleteSel }];
    if (d.g) acts.unshift({ label: 'Unlink equal', fn: () => { for (const i in S.dims) if (S.dims[i].g === d.g) { delete S.dims[i].g; delete S.dims[i].gf; } closePop(); sel = []; commit(); } });
    openPop({ title: s0.id + ' · ' + DIM_NAMES[d.t] + (d.g ? ' (equal)' : d.expr ? ' (ƒx)' : '') + ' — tap another dimension to reference it', dimRef: true,
      fields: [{ key: 'v', label: 'Value', value: d.expr || fmt(d.v), unit: d.t === 'ang' ? '°' : 'in', kind: d.t === 'ang' ? 'num' : 'len' }],
      actions: acts,
      onChange: v => { const pr = plainRef(popState.vals[0]);
        if (pr && pr !== s0.id && S.dims[pr] && EQ_OK[d.t] && EQ_OK[S.dims[pr].t]) { previewDim(() => linkEqual(s0.id, pr)); return; }
        if (v.v > 0 && !(d.t === 'ang' && v.v >= 180)) previewDim(() => setDimVal(s0.id, v.v)); },
      onOk: v => { const raw = String(popState.vals[0]).replace(/−/g, '-'), ex = /d\d/i.test(raw) ? raw : null;
        if (ex && (raw.match(/d\d+/gi) || []).some(r => r.toLowerCase() === s0.id)) { toast('A dimension cannot reference itself'); return; }
        if (popState.dimPrev) { popState.dimPrev = false; restore(popState.base); } applyDim({ existing: s0.id, ang: d.t === 'ang' }, v.v, ex); } }); return;
  }
  if (tool.dim && sel.length === 2 && sel.every(x => x.k === 'p')) {
    dimPlace = { p: sel[0].id, q: sel[1].id, cur: null }; closePop();
    setHint('Now tap where the dimension should sit — above/below the points = horizontal, beside = vertical, out past a corner = straight-line'); refresh(); return;
  }
  const offer = dimOffer(), ents = sel.filter(s => s.k === 'e');
  const acts = [];
  if (ents.length && ents.every(s => S.ents[s.id].proj && S.ents[s.id].proj[0] === '@pg')) acts.push({ label: 'Delete', cls: 'dg', fn: deleteSel });
  if (ents.some(s => !S.ents[s.id].proj)) { const allCon = ents.every(s => S.ents[s.id].con); acts.push({ label: 'Construction', cls: allCon ? 'on' : '', fn: toggleConstr }, { label: 'Delete', cls: 'dg', fn: deleteSel }); }
  if (!offer && !acts.length) { closePop(); return; }
  const n = sel.length;
  openPop({ title: offer ? offer.label + (offer.existing ? '' : ' — type to set') : n + ' selected', dimRef: !!offer,
    fields: offer ? [{ key: 'v', label: offer.existing ? 'Value' : 'Now', value: fmt(offer.value), unit: offer.ang ? '°' : 'in', kind: offer.ang ? 'num' : 'len' }] : [],
    actions: acts,
    onChange: offer ? v => { const pr = plainRef(popState.vals[0]);
      if (pr && S.dims[pr] && (offer.existing ? EQ_OK[S.dims[offer.existing].t] : offer.o && EQ_OK[offer.o.t]) && EQ_OK[S.dims[pr].t]) {
        previewDim(() => { const id = offer.existing || addDim(Object.assign({}, offer.o, { v: v.v, off: defaultOff(offer.o) })); return linkEqual(id, pr); }); return; }
      if (v.v > 0 && !(offer.ang && v.v >= 180)) previewDim(() => { if (offer.existing) return setDimVal(offer.existing, v.v); addDim(Object.assign({}, offer.o, { v: v.v, off: defaultOff(offer.o) })); return true; }); } : undefined,
    onOk: v => { const raw = String(popState.vals[0]).replace(/−/g, '-'), ex = /d\d/i.test(raw) ? raw : null;
      if (popState.dimPrev) { popState.dimPrev = false; restore(popState.base); } applyDim(offer, v.v, ex); } });
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
const DIM_NAMES = { len: 'Length', pld: 'Distance', ang: 'Angle', dia: 'Diameter', rad: 'Radius', dx: 'Horizontal distance', dy: 'Vertical distance' };

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
  if (mode === 'flat') { nav = { mode: 'pan', id: e.pointerId, x: p.x, y: p.y }; return; }
  if (act) return;
  ptr = p; dirty = true;
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
  if (act ? act.id === e.pointerId : e.pointerType !== 'touch') { ptr = p; dirty = true; }
  const w = s2w(p.x, p.y); $('#xy').textContent = 'X ' + w.x.toFixed(3) + '   Y ' + w.y.toFixed(3);
  if (act && act.id === e.pointerId) actMove(p);
  else if (!act && e.pointerType !== 'touch') { if (dimPlace) { dimPlace.cur = s2w(p.x, p.y); } else if (tool.name !== 'select' && tool.name !== 'con') { cur = snap(p.x, p.y, refPt()); if (tool.name === 'arc' && tool.step === 2) arcTrack(cur); } else { const h = hitTest(p.x, p.y); hover = h; } dirty = true; }
});
function endPtr(e, cancel) {
  const p = evPos(e); ptrs.delete(e.pointerId);
  if (nav) { if (nav.mode === 'pinch') { if (touchPts().length < 2) nav = null; } else if (nav.id === e.pointerId) nav = null; return; }
  if (act && act.id === e.pointerId) { if (cancel) cancelAct(); else actUp(p); }
}
cv.addEventListener('pointerup', e => endPtr(e, false));
cv.addEventListener('pointercancel', e => endPtr(e, true));
cv.addEventListener('pointerleave', e => { if (!act && e.pointerType === 'mouse') ptr = null; if (!act && e.pointerType !== 'touch') { hover = null; if (tool.step === 0) cur = null; dirty = true; } });
cv.addEventListener('wheel', e => { e.preventDefault(); const p = evPos(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

function cancelAct() {
  if (!act) return;
  if (act.dragging && act.pre) { restore(act.pre); }
  if (act.downClicked && tool.step === 1 && tool.name !== 'poly' && tool.name !== 'line') resetTool();
  act = null; dirty = true;
}
let lastTap = null;
function actDown(p, e) {
  act = { id: e.pointerId, x0: p.x, y0: p.y, moved: false };
  if (dimPlace && tool.name === 'select') { act.place = true; dimPlace.cur = s2w(p.x, p.y); dirty = true; return; }
  if (tool.name === 'select') {
    if (popState && popState.pick) { const h = hitTest(p.x, p.y); act.pick = h; return; }
    act.hit = hitTest(p.x, p.y);
  } else {
    closePop();
    if (tool.name === 'con') { act.con = hitTest(p.x, p.y) || null; return; }
    if (tool.name === 'face') { act.face = s2w(p.x, p.y); return; }
    if (tool.name === 'cut') { act.cut = s2w(p.x, p.y); return; }
    if (tool.name === 'project') { act.pg = { x: p.x, y: p.y }; return; }
    if (tool.name === 'flange') { act.fl = s2w(p.x, p.y); return; }
    if (tool.name === 'fillet' || tool.name === 'chamfer') { act.cr = { x: p.x, y: p.y }; return; }
    cur = snap(p.x, p.y, refPt());
    if (tool.step === 0) { toolClick(cur); act.downClicked = true; }
    dirty = true;
  }
}
function actMove(p) {
  if (act.place) { if (dimPlace) { dimPlace.cur = s2w(p.x, p.y); dirty = true; } return; }
  const thr = lastPtrType === 'touch' ? 10 : 6;
  if (!act.moved && hyp(p.x - act.x0, p.y - act.y0) > thr) { act.moved = true; if (tool.name === 'select') beginDrag(p); }
  if (act.face || act.cut || act.pg || act.fl || act.cr || act.con !== undefined) return;
  if (tool.name !== 'select') { cur = snap(p.x, p.y, refPt()); if (tool.name === 'arc' && tool.step === 2) arcTrack(cur); dirty = true; return; }
  if (act.moved) doDrag(p);
}
function actUp(p) {
  const a = act; act = null;
  if (a.place) { placeDim(s2w(p.x, p.y)); return; }
  if (a.con !== undefined) { if (!a.moved) conTap(realHit(a.con)); return; }
  if (a.face) { if (!a.moved) facePick(a.face); return; }
  if (a.cut) { if (!a.moved) cutTap({ x: a.cut.x * skMir(S), y: a.cut.y }); return; }
  if (a.pg) { if (!a.moved) projectTap(a.pg.x, a.pg.y); return; }
  if (a.fl) { if (!a.moved) flangeTap(a.fl, 14 / view.s); return; }
  if (a.cr) { if (!a.moved) cornerTap(a.cr.x, a.cr.y); return; }
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
  if (a.hit && a.hit.k === 'd' && popState && popState.spec && popState.spec.dimRef && !popState.pick && !(sel.length === 1 && sel[0].k === 'd' && sel[0].id === a.hit.id)) { popRefInsert(a.hit.id); return; }
  if (a.hit && a.hit.mid != null) a.hit = realHit(a.hit);
  const now = Date.now(), dbl = lastTap && now - lastTap.t < 450 && hyp(p.x - lastTap.x, p.y - lastTap.y) < 24; lastTap = { t: now, x: p.x, y: p.y };
  if (!a.hit) { sel = []; closePop(); refresh(); return; }
  if (dbl && sel.length && sel.some(q => q.k === a.hit.k && q.id === a.hit.id)) { showSelPop(); return; }       // double tap: edit its dimension
  if (!isSel(a.hit.k, a.hit.id) || tool.dim) toggleSel(a.hit); refresh(); if (tool.dim) showSelPop();
}
function beginDrag(p) {
  let h = act.hit; act.pre = hist[hi]; if (h && h.mid != null) h = act.hit = null;
  if (!h) { act.drag = 'box'; closePop(); sel = []; refresh(); return; }
  closePop();
  if (h.k === 'd') { act.drag = 'dim'; act.dragging = true; return; }
  if (h.k === 'p') { if (P(h.id).fixed) { act.drag = 'none'; toast(h.id === 'p0' ? 'The origin is fixed' : P(h.id).proj ? 'Projected edges follow the part outline' : 'That point is locked (Fix)'); return; } act.drag = 'pts'; act.pts = [{ p: h.id, x: P(h.id).x, y: P(h.id).y }]; act.dragging = true; return; }
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
  if (act.drag === 'box') { act.bx = p.x; act.by = p.y; dirty = true; return; }
  if (act.drag === 'pts') {
    const dx = w.x - w0.x, dy = w.y - w0.y;
    if (gcs) solve({ temp: act.pts.map(t => ({ p: t.p, x: t.x + dx, y: t.y + dy })) });
    else act.pts.forEach(t => { P(t.p).x = t.x + dx; P(t.p).y = t.y + dy; });
    dirty = true;
  } else if (act.drag === 'rad') {
    const e = S.ents[h.id], c = P(e.c), old = e.r; e.r = Math.max(1e-3, hyp(w.x - c.x, w.y - c.y)); if (gcs && !solve().ok) e.r = old; dirty = true;
  } else if (act.drag === 'dim') {
    const d = S.dims[h.id]; if (!d) return;
    if (d.t === 'dx') d.off = w.y;
    else if (d.t === 'dy') d.off = w.x;
    else if (d.t === 'len') { const a = P(d.p), b = P(d.q), L = hyp(b.x - a.x, b.y - a.y) || 1; d.off = ((w.x - (a.x + b.x) / 2) * -(b.y - a.y) + (w.y - (a.y + b.y) / 2) * (b.x - a.x)) / L; }
    else if (d.t === 'pld') { const u = lineDir(S.ents[d.e]), q = P(d.p); d.off = (w.x - q.x) * u.x + (w.y - q.y) * u.y; }
    else if (d.t === 'ang') { const X = intersectLL(S.ents[d.e1], S.ents[d.e2]); if (X) d.off = Math.max(12 / view.s, hyp(w.x - X.x, w.y - X.y)); }
    else { const c = P(S.ents[d.e].c); d.off = Math.atan2(w.y - c.y, w.x - c.x); }
    dirty = true;
  }
}
function endDrag(a) {
  if (a.drag === 'box' && a.bx != null) { sel = boxPick(a.x0, a.y0, a.bx, a.by).map(id => ({ k: 'e', id })); refresh(); if (sel.length) showSelPop(); return; }
  if (a.drag === 'pts' || a.drag === 'rad' || a.drag === 'dim') { if (snapshot() !== hist[hi]) { regen(); pushHist(); refresh(); } }
  dirty = true;
}

// Box select: drag right = window (whole item inside), drag left = crossing (anything the box touches).
function boxPick(x0, y0, x1, y1) {
  const window_ = x1 > x0, a = s2w(Math.min(x0, x1), Math.max(y0, y1)), b = s2w(Math.max(x0, x1), Math.min(y0, y1));
  const inside = (x, y) => x >= a.x && x <= b.x && y >= a.y && y <= b.y;
  const cross = (p, q, r, t) => { const o = (u, v, w) => Math.sign((v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0])); return o(p, q, r) !== o(p, q, t) && o(r, t, p) !== o(r, t, q); };
  const corners = [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]], out = [];
  for (const id in S.ents) {
    const g = entG(S.ents[id]); let pts;
    if (g.t === 'line') pts = [[g.x1, g.y1], [g.x2, g.y2]];
    else { pts = tess(g); pts.push(g.t === 'circle' ? pts[0] : [g.cx + g.r * Math.cos(g.ea), g.cy + g.r * Math.sin(g.ea)]); }
    let hit;
    if (window_) hit = pts.every(p => inside(p[0], p[1]));
    else { hit = pts.some(p => inside(p[0], p[1])); for (let i = 0; !hit && i < pts.length - 1; i++) for (let k = 0; k < 4 && !hit; k++) hit = cross(pts[i], pts[i + 1], corners[k], corners[(k + 1) % 4]); }
    if (hit) out.push(id);
  }
  return out;
}
// keyboard (hardware keyboards)
document.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (popState && popState.spec.fields.length && (/^[0-9./ \-m+*()]$/.test(e.key) || e.key === 'Backspace' || e.key === 'Enter')) { e.preventDefault(); if (e.key === 'm') popKey('mm'); else popKey(e.key); return; }
  if (e.key === 'Escape') escAll();
  else if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.length) deleteSel(); }
});

// ---------------------------------------------------------------- rendering
function pal() {
  const L = settings.theme === 'light';
  return L ? { bg: '#eef1f4', grid: '#dfe4e9', grid2: '#c9d1d9', axis: '#9aa6b2', geo: '#12202e', con: '#b0741a', pt: '#12202e', sel: '#e07a00', dim: '#1c7a4c', pat: '#6f8194', prev: '#e07a00', badge: '#5a6876', badgeBg: '#ffffff', fix: '#c62828', lbl: '#ffffff', proj: '#9a7b00', ref: '#8d99a6', vis: '#d9a15c', sheet: 'rgba(90,104,118,0.22)' }
    : { bg: '#14181d', grid: '#1c2229', grid2: '#27303a', axis: '#4a5866', geo: '#e9eef3', con: '#c79a4a', pt: '#e9eef3', sel: '#ff9f1c', dim: '#5fd39a', pat: '#7b8b9b', prev: '#ff9f1c', badge: '#aab6c2', badgeBg: '#232a33', fix: '#ff6b6b', lbl: '#14181d', proj: '#e3c23a', ref: '#55636f', vis: '#8a6426', sheet: 'rgba(158,171,184,0.20)' };
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
  const on = isSel('d', id), c = on ? C.sel : d.driven ? C.badge : C.dim; ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.setLineDash([]);
  const seg = (x1, y1, x2, y2) => { const [a, b] = w2s(x1, y1), [e, f] = w2s(x2, y2); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(e, f); ctx.stroke(); return [a, b, e, f]; };
  if (d.t === 'len' || d.t === 'pld' || d.t === 'dx' || d.t === 'dy') {
    let A, B, n, A2, B2;
    if (d.t === 'len') { A = P(d.p); B = P(d.q); const L = hyp(B.x - A.x, B.y - A.y) || 1; n = { x: -(B.y - A.y) / L, y: (B.x - A.x) / L }; }
    else if (d.t === 'pld') { const e = S.ents[d.e], u = lineDir(e), a = P(e.a); A = P(d.p); const t = (A.x - a.x) * u.x + (A.y - a.y) * u.y; B = { x: a.x + u.x * t, y: a.y + u.y * t }; n = u; }
    else { A = P(d.p); B = P(d.q); }
    if (d.t === 'dx') { A2 = { x: A.x, y: d.off }; B2 = { x: B.x, y: d.off }; }
    else if (d.t === 'dy') { A2 = { x: d.off, y: A.y }; B2 = { x: d.off, y: B.y }; }
    else { A2 = { x: A.x + n.x * d.off, y: A.y + n.y * d.off }; B2 = { x: B.x + n.x * d.off, y: B.y + n.y * d.off }; }
    ctx.globalAlpha = 0.55; seg(A.x, A.y, A2.x, A2.y); seg(B.x, B.y, B2.x, B2.y); ctx.globalAlpha = 1;
    const [a, b, e, f] = seg(A2.x, A2.y, B2.x, B2.y), an = Math.atan2(f - b, e - a);
    if (hyp(e - a, f - b) > 26) { arrow(a, b, an + PI, c); arrow(e, f, an, c); }
    label(id, d.driven ? '(' + fmt(d.v) + ')' : (d.g ? '= ' : d.expr ? 'ƒ ' : '') + fmt(d.v), (a + e) / 2, (b + f) / 2, c, C, on);
  } else if (d.t === 'ang') {
    const e1 = S.ents[d.e1], e2 = S.ents[d.e2], X = intersectLL(e1, e2); if (!X) return;
    const d1 = lineDir(e1), a1 = Math.atan2(d1.y * d.s1, d1.x * d.s1), sw = d.sg * d.v * PI / 180, R = d.off;
    const [x, y] = w2s(X.x, X.y); ctx.beginPath(); ctx.arc(x, y, R * view.s, -a1, -(a1 + sw), sw > 0); ctx.stroke();
    const am = a1 + sw / 2, [lx, ly] = w2s(X.x + R * Math.cos(am), X.y + R * Math.sin(am)); label(id, d.driven ? '(' + fmt(d.v) + '°)' : (d.expr ? 'ƒ ' : '') + fmt(d.v) + '°', lx, ly, c, C, on);
  } else {
    const e = S.ents[d.e], g = entG(e), a = d.off, ux = Math.cos(a), uy = Math.sin(a), ext = 34 / view.s;
    const from = d.t === 'dia' ? { x: g.cx - ux * g.r, y: g.cy - uy * g.r } : { x: g.cx, y: g.cy };
    const [p, q, r, s] = seg(from.x, from.y, g.cx + ux * (g.r + ext), g.cy + uy * (g.r + ext));
    const [rx, ry] = w2s(g.cx + ux * g.r, g.cy + uy * g.r), an = Math.atan2(s - q, r - p); arrow(rx, ry, an, c); if (d.t === 'dia') arrow(p, q, an + PI, c);
    label(id, (d.driven ? '(' : d.g ? '= ' : d.expr ? 'ƒ ' : '') + (d.t === 'dia' ? '⌀' : 'R') + fmt(d.v) + (d.driven ? ')' : ''), r + Math.cos(an) * 16, s + Math.sin(an) * 12, c, C, on);
  }
}
function fitFlat() {
  const gs = flatGeoms(), b = bboxG(gs); if (!b || !CW) return;
  const w = Math.max(b.x1 - b.x0, 0.5), h = Math.max(b.y1 - b.y0, 0.5), m = 90;
  view.s = Math.max(2, Math.min(4000, Math.min((CW - 2 * m) / w, (CH - 2 * m - 40) / h)));
  view.ox = CW / 2 - (b.x0 + w / 2) * view.s; view.oy = CH / 2 + (b.y0 + h / 2) * view.s + 10; dirty = true;
}
function renderFlat(C) {
  const steps = [0.0625, 0.125, 0.25, 0.5, 1, 2, 6, 12, 24, 48, 96]; let gs = steps.find(s => s * view.s >= 22) || 96;
  const major = gs < 1 ? 1 : gs < 12 ? 12 : gs * 4, w0 = s2w(0, CH), w1 = s2w(CW, 0);
  ctx.lineWidth = 1;
  for (const [st, col] of [[gs, C.grid], [major, C.grid2]]) {
    if (st * view.s < 8) continue; ctx.strokeStyle = col; ctx.beginPath();
    for (let x = Math.floor(w0.x / st) * st; x <= w1.x; x += st) { const sx = Math.round(view.ox + x * view.s) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, CH); }
    for (let y = Math.floor(w0.y / st) * st; y <= w1.y; y += st) { const sy = Math.round(view.oy - y * view.s) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(CW, sy); }
    ctx.stroke();
  }
  if (!(model && model.outer)) return;
  const light = settings.theme === 'light', bendC = light ? '#d97a00' : '#ff9f1c';
  // blank body tint (outline minus cutouts, even-odd)
  ctx.beginPath(); const path = poly => poly.forEach((q, i) => { const [x, y] = w2s(q[0], q[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  const strips = []; path(model.outer.poly); ctx.closePath();
  for (const fl of model.flanges) { const D = fl.c.D, d = fl.fd, P = [fl.fa, [fl.fa[0] + d[0] * D, fl.fa[1] + d[1] * D], [fl.fb[0] + d[0] * D, fl.fb[1] + d[1] * D], fl.fb]; strips.push(P); }
  ctx.beginPath(); path(model.outer.poly); ctx.closePath(); for (const P of strips) { path(P); ctx.closePath(); } for (const h of model.holes) { path(h.poly); ctx.closePath(); } for (const P of model.flHolePolys || []) { path(P); ctx.closePath(); }
  ctx.fillStyle = light ? 'rgba(30,60,90,.07)' : 'rgba(180,200,220,.07)'; ctx.fill('evenodd');
  // cut profile
  ctx.strokeStyle = C.geo; ctx.lineWidth = 2.2; ctx.setLineDash([]); for (const g of flatGeoms()) if (!g.lay) strokeG(g);
  // bend lines
  ctx.strokeStyle = bendC; ctx.lineWidth = 2.2; ctx.setLineDash([12, 6]);
  for (const g of model.bends) strokeG(g);
  ctx.setLineDash([]); ctx.font = '600 12px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const g of model.bends) { const [x, y] = w2s((g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2), i = g.info, txt = (i.down ? 'BEND DOWN ' : 'BEND UP ') + fmt(i.ang) + '°  R' + fmt(+i.r.toFixed(4)), tw = ctx.measureText(txt).width + 12;
    ctx.fillStyle = C.bg; ctx.fillRect(x - tw / 2, y - 10, tw, 20); ctx.fillStyle = bendC; ctx.fillText(txt, x, y); }
  // overall size
  const b = model.bb, [bx0, by0] = w2s(b.x0, b.y0), [bx1, by1] = w2s(b.x1, b.y1), dc = C.dim;
  ctx.strokeStyle = dc; ctx.fillStyle = dc; ctx.lineWidth = 1.2; ctx.font = '600 13px system-ui,sans-serif';
  const oy = by0 + 26, ox = bx1 + 26;
  ctx.beginPath(); ctx.moveTo(bx0, oy); ctx.lineTo(bx1, oy); ctx.moveTo(bx0, oy - 6); ctx.lineTo(bx0, oy + 6); ctx.moveTo(bx1, oy - 6); ctx.lineTo(bx1, oy + 6);
  ctx.moveTo(ox, by0); ctx.lineTo(ox, by1); ctx.moveTo(ox - 6, by0); ctx.lineTo(ox + 6, by0); ctx.moveTo(ox - 6, by1); ctx.lineTo(ox + 6, by1); ctx.stroke();
  const lab = (t, x, y, rot) => { ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(-PI / 2); const tw = ctx.measureText(t).width + 12; ctx.fillStyle = C.bg; ctx.fillRect(-tw / 2, -10, tw, 20); ctx.fillStyle = dc; ctx.fillText(t, 0, 0); ctx.restore(); };
  lab(fmt(+(b.x1 - b.x0).toFixed(4)) + ' in', (bx0 + bx1) / 2, oy, false); lab(fmt(+(b.y1 - b.y0).toFixed(4)) + ' in', ox, (by0 + by1) / 2, true);
  // header
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '600 14px system-ui,sans-serif'; ctx.fillStyle = C.geo;
  ctx.fillText('Flat pattern  ·  ' + part.tl + ' mild steel  ·  ' + model.bends.length + ' bend' + (model.bends.length === 1 ? '' : 's'), 14, 12);
  ctx.font = '12px system-ui,sans-serif'; ctx.fillStyle = bendC; ctx.fillText('- - -  bend line (' + (settings.layBend || 'IV_BEND') + ' up / ' + (settings.layBendDown || 'IV_BEND_DOWN') + ' down)', 14, 32);
}
function render() {
  const C = pal(); if (mode === 'flat') { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CW, CH); renderFlat(C); return; } ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (bdActive) { ctx.clearRect(0, 0, CW, CH); ctx.globalAlpha = 0.33; } else { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CW, CH); }
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
  ctx.globalAlpha = 1;
  if (!bdActive && model && model.outer && !model.contour) {   // no 3D behind (fallback): shade the material the sketch sits on
    const mx = skMir(S), fl = skFl(feat(actId));
    const tracePoly = p => { if (!p || p.length < 3) return; ctx.moveTo(...w2s(p[0][0] * mx, p[0][1])); for (let i = 1; i < p.length; i++) ctx.lineTo(...w2s(p[i][0] * mx, p[i][1])); ctx.closePath(); };
    let polys = null;
    if (!fl) polys = [model.outer.poly, ...model.holes.map(h => h.poly)];
    else { const rec = (model.flanges || []).find(x => x.f.id === fl); if (rec) polys = [[[0, 0], [rec.W, 0], [rec.W, rec.c.Lf], [0, rec.c.Lf]], ...(rec.holes || []).map(h => h.poly)]; }
    if (polys) { ctx.beginPath(); polys.forEach(tracePoly); ctx.fillStyle = C.sheet; ctx.fill('evenodd'); }
  }
  if (!bdActive && model && model.outer && planeKey(feat(actId)) === 'base') { ctx.strokeStyle = C.ref; ctx.lineWidth = 1.2; ctx.setLineDash([]); const mxr = skMir(S); for (const g of baseGeoms()) strokeG(mxr < 0 ? mirG(g) : g); }
  ctx.strokeStyle = C.vis; ctx.lineWidth = 1.2; ctx.setLineDash([]); for (const f of part.feats) if (f.type === 'sketch' && f.id !== actId && planeKey(f) === planeKey(feat(actId)) && (sketchVis(f) || (cutSel && faceFeat() && f.id !== faceFeat().sk))) for (const g of toModelGs(S, sketchGeoms(f))) strokeG(g);
  if (cutSel) { ctx.globalAlpha = 0.32; ctx.fillStyle = C.sel; for (const l of cutSel.loops) { if ((l.pk || 'base') !== planeKey(feat(actId))) continue; ctx.beginPath(); l.poly.forEach((q, i) => { const [x, y] = w2s(q[0] * skMir(S), q[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill(); } ctx.globalAlpha = 1; }
  // pattern instances
  ctx.lineWidth = 1.6;
  for (const id in S.pats) { const on = isSel('pat', id); ctx.strokeStyle = on ? C.sel : C.pat; ctx.setLineDash([]); for (const g of patGeoms(S.pats[id], false)) strokeG(g);
    const p = S.pats[id]; if (on && p.t === 'circ' && P(p.c)) { const [x, y] = w2s(P(p.c).x, P(p.c).y); ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y); ctx.moveTo(x, y - 13); ctx.lineTo(x, y + 13); ctx.stroke(); } }
  // entities
  const patSrc = new Set(); for (const s of sel) if (s.k === 'pat' && S.pats[s.id]) S.pats[s.id].src.forEach(e => patSrc.add(e));
  for (const id in S.ents) {
    const e = S.ents[id], on = isSel('e', id) || patSrc.has(id), hv = hover && hover.k === 'e' && hover.id === id;
    ctx.strokeStyle = on ? C.sel : e.lost ? C.fix : e.proj ? C.proj : e.con ? C.con : C.geo; ctx.lineWidth = on || hv ? 3 : e.proj ? 1.7 : e.con ? 1.3 : 2.1; ctx.setLineDash(e.con && !e.proj ? [7, 5] : []);
    strokeG(entG(e));
  }
  ctx.setLineDash([]);
  if (tool.name === 'project') { const hv = ptr && !act && lastPtrType !== 'touch' ? projNear(ptr.x, ptr.y) : null; ctx.strokeStyle = C.proj;
    for (const c of projCands()) { const h = hv && hv.key === c.key; ctx.globalAlpha = h ? 1 : 0.62; ctx.lineWidth = h ? 3.4 : 2; ctx.setLineDash(h ? [] : [6, 4]); strokeG(c.g); } ctx.globalAlpha = 1; ctx.setLineDash([]); }
  // points
  for (const id in S.pts) {
    const p = S.pts[id], [x, y] = w2s(p.x, p.y), on = isSel('p', id), hv = hover && hover.k === 'p' && hover.id === id;
    if (id === 'p0') { ctx.strokeStyle = on ? C.sel : C.axis; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke(); if (on) { ctx.fillStyle = C.sel; ctx.fill(); } continue; }
    const r = on || hv ? 5 : 3; ctx.fillStyle = on ? C.sel : p.proj ? C.proj : p.fixed ? C.fix : C.pt;
    if (p.fixed && !p.proj) ctx.fillRect(x - r - 1, y - r - 1, 2 * r + 2, 2 * r + 2); else { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  }
  if (midOn()) for (const id in S.ents) { const e = S.ents[id]; if (e.t !== 'line') continue; const a = P(e.a), b = P(e.b), [x, y] = w2s((a.x + b.x) / 2, (a.y + b.y) / 2), hv = hover && hover.mid === id;
    if (Object.values(S.pts).some(q => q.mid === id)) continue; ctx.strokeStyle = hv ? C.sel : C.con; ctx.lineWidth = hv ? 2.2 : 1.4; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x - 5, y + 4); ctx.closePath(); ctx.stroke(); }
  // dimensions
  labelRects = {};
  for (const id in S.dims) drawDim(id, S.dims[id], C);
  if (dimPlace) { const pc = dimPlace.cur || cur; if (pc && S.pts[dimPlace.p] && S.pts[dimPlace.q]) { const po = placeOffer(dimPlace.p, dimPlace.q, pc); drawDim('~place', Object.assign({ v: po.v, off: po.off }, po.o), C); delete labelRects['~place']; } }
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
  if (tool.name !== 'select' && tool.name !== 'face' && tool.name !== 'cut' && tool.name !== 'flange' && tool.name !== 'fillet' && tool.name !== 'chamfer' && cur) {
    const T = tool; ctx.strokeStyle = C.prev; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    if ((T.name === 'line' || T.name === 'poly') && T.step === 1) strokeG({ t: 'line', x1: T.p0.x, y1: T.p0.y, x2: cur.x, y2: cur.y });
    else if (T.name === 'rect' && T.step === 1 && toolVar.rect === 'center') { const [a, b] = w2s(T.p0.x, T.p0.y), [c, d] = w2s(cur.x, cur.y), w = Math.abs(c - a), h = Math.abs(d - b); ctx.strokeRect(a - w, b - h, 2 * w, 2 * h); }
    else if (T.name === 'rect' && T.step === 1) { const [a, b] = w2s(T.p0.x, T.p0.y), [c, d] = w2s(cur.x, cur.y); ctx.strokeRect(Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)); }
    else if (T.name === 'circle' && T.step === 1 && toolVar.circle === '2pt') strokeG({ t: 'circle', cx: (T.p0.x + cur.x) / 2, cy: (T.p0.y + cur.y) / 2, r: hyp(cur.x - T.p0.x, cur.y - T.p0.y) / 2 });
    else if (T.name === 'circle' && T.step === 1 && toolVar.circle === '3pt') strokeG({ t: 'line', x1: T.p0.x, y1: T.p0.y, x2: cur.x, y2: cur.y });
    else if (T.name === 'circle' && T.step === 2) { const cc = circum(T.p0, T.p1, cur); if (cc) strokeG({ t: 'circle', cx: cc.x, cy: cc.y, r: cc.r }); }
    else if (T.name === 'circle' && T.step === 1) strokeG({ t: 'circle', cx: T.p0.x, cy: T.p0.y, r: hyp(cur.x - T.p0.x, cur.y - T.p0.y) });
    else if (T.name === 'arc' && T.step === 1) strokeG({ t: 'line', x1: T.p0.x, y1: T.p0.y, x2: cur.x, y2: cur.y });
    else if (T.name === 'arc' && T.step === 2) { const r = hyp(T.p1.x - T.p0.x, T.p1.y - T.p0.y), a0 = Math.atan2(T.p1.y - T.p0.y, T.p1.x - T.p0.x); const g = T.acc >= 0 ? { sa: a0, ea: a0 + T.acc } : { sa: a0 + T.acc, ea: a0 }; if (Math.abs(T.acc) > 0.01) strokeG({ t: 'arc', cx: T.p0.x, cy: T.p0.y, r, sa: g.sa, ea: g.ea }); }
    else if (T.name === 'slot' && T.step === 1) strokeG({ t: 'line', x1: T.p0.x, y1: T.p0.y, x2: cur.x, y2: cur.y });
    else if (T.name === 'slot' && T.step === 2) { const g = slotGeom(T.p0, T.p1, cur); if (g) { strokeG({ t: 'line', x1: g.a1.x, y1: g.a1.y, x2: g.a2.x, y2: g.a2.y }); strokeG({ t: 'line', x1: g.b1.x, y1: g.b1.y, x2: g.b2.x, y2: g.b2.y }); strokeG({ t: 'arc', cx: T.p0.x, cy: T.p0.y, r: g.r, sa: g.ang + PI / 2, ea: g.ang + 1.5 * PI }); strokeG({ t: 'arc', cx: T.p1.x, cy: T.p1.y, r: g.r, sa: g.ang - PI / 2, ea: g.ang + PI / 2 }); } }
    ctx.setLineDash([]);
    // live size readout
    let txt = '';
    if ((T.name === 'line' || T.name === 'poly' || T.name === 'slot') && T.step === 1) txt = fmt(hyp(cur.x - T.p0.x, cur.y - T.p0.y).toFixed(3));
    else if (T.name === 'rect' && T.step === 1) { const k = toolVar.rect === 'center' ? 2 : 1; txt = fmt((k * Math.abs(cur.x - T.p0.x)).toFixed(3)) + ' × ' + fmt((k * Math.abs(cur.y - T.p0.y)).toFixed(3)); }
    else if (T.name === 'circle' && T.step === 1) txt = '⌀' + fmt((toolVar.circle === '2pt' ? hyp(cur.x - T.p0.x, cur.y - T.p0.y) : toolVar.circle === '3pt' ? 0 : 2 * hyp(cur.x - T.p0.x, cur.y - T.p0.y)).toFixed(3)).replace(/^⌀0$/, '');
    else if (T.name === 'circle' && T.step === 2) { const cc = circum(T.p0, T.p1, cur); if (cc) txt = '⌀' + fmt((2 * cc.r).toFixed(3)); }
    else if (T.name === 'arc' && T.step >= 1) txt = 'R' + fmt(hyp((T.p1 || cur).x - T.p0.x, (T.p1 || cur).y - T.p0.y).toFixed(3));
    else if (T.name === 'slot' && T.step === 2) { const g = slotGeom(T.p0, T.p1, cur); if (g) txt = 'W ' + fmt((2 * g.r).toFixed(3)); }
    const [sx, sy] = w2s(cur.x, cur.y);
    if (txt) { ctx.font = '600 13px -apple-system,Segoe UI,Roboto,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; const tw = ctx.measureText(txt).width; ctx.fillStyle = C.bg; ctx.globalAlpha = 0.85; ctx.fillRect(sx + 14, sy - 34, tw + 10, 20); ctx.globalAlpha = 1; ctx.fillStyle = C.prev; ctx.fillText(txt, sx + 19, sy - 24); }
    // snap marker
    ctx.strokeStyle = C.prev; ctx.lineWidth = 2; ctx.beginPath();
    let lab = SNAP_LABEL[cur.kind] || null; const isCen = cur.kind === 'pt' && Object.values(S.ents).some(e => e.c === cur.pid);
    if (cur.kind === 'pt') { lab = cur.pid === 'p0' ? 'Origin' : isCen ? 'Center' : 'Endpoint'; if (isCen) { ctx.arc(sx, sy, 8, 0, TAU); ctx.moveTo(sx + 1.5, sy); ctx.arc(sx, sy, 1.5, 0, TAU); } else ctx.rect(sx - 7, sy - 7, 14, 14); }
    else if (cur.kind === 'mid') { ctx.moveTo(sx, sy - 8); ctx.lineTo(sx + 8, sy + 6); ctx.lineTo(sx - 8, sy + 6); ctx.closePath(); }
    else if (cur.kind === 'on') { ctx.moveTo(sx - 6, sy - 6); ctx.lineTo(sx + 6, sy + 6); ctx.moveTo(sx + 6, sy - 6); ctx.lineTo(sx - 6, sy + 6); }
    else if (cur.kind === 'int') { ctx.moveTo(sx - 8, sy - 8); ctx.lineTo(sx + 8, sy + 8); ctx.moveTo(sx + 8, sy - 8); ctx.lineTo(sx - 8, sy + 8); ctx.moveTo(sx + 10, sy); ctx.arc(sx, sy, 10, 0, TAU); }
    else if (cur.kind === 'quad') { ctx.moveTo(sx, sy - 9); ctx.lineTo(sx + 9, sy); ctx.lineTo(sx, sy + 9); ctx.lineTo(sx - 9, sy); ctx.closePath(); }
    else if (cur.kind === 'perp') { ctx.moveTo(sx - 9, sy + 8); ctx.lineTo(sx - 9, sy - 8); ctx.moveTo(sx - 9, sy + 8); ctx.lineTo(sx + 9, sy + 8); ctx.moveTo(sx - 9, sy + 2); ctx.lineTo(sx - 3, sy + 2); ctx.lineTo(sx - 3, sy + 8); }
    else if (cur.kind === 'tan') { ctx.arc(sx, sy - 3, 6, 0, TAU); ctx.moveTo(sx - 11, sy + 3); ctx.lineTo(sx + 11, sy + 3); }
    else if (cur.dir) { lab = SNAP_LABEL[cur.dir.kind]; if (cur.dir.kind === 'par') { ctx.moveTo(sx - 4, sy + 8); ctx.lineTo(sx + 4, sy - 8); ctx.moveTo(sx + 2, sy + 8); ctx.lineTo(sx + 10, sy - 8); } else { ctx.moveTo(sx - 9, sy + 8); ctx.lineTo(sx - 9, sy - 8); ctx.moveTo(sx - 9, sy + 8); ctx.lineTo(sx + 9, sy + 8); } ctx.moveTo(sx + 4, sy); ctx.arc(sx, sy, 4, 0, TAU); }
    else ctx.arc(sx, sy, 4, 0, TAU);
    ctx.stroke();
    if (lab) { ctx.font = '600 12px -apple-system,Segoe UI,Roboto,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; const tw = ctx.measureText(lab).width; ctx.fillStyle = C.bg; ctx.globalAlpha = 0.9; ctx.fillRect(sx + 14, sy + 10, tw + 10, 20); ctx.globalAlpha = 1; ctx.fillStyle = C.prev; ctx.fillText(lab, sx + 19, sy + 20); }
    if (cur.hv) { ctx.fillStyle = C.prev; ctx.font = '700 12px -apple-system,Segoe UI,Roboto,sans-serif'; ctx.textAlign = 'left'; ctx.fillText(cur.hv === 'hor' ? 'H' : 'V', sx + 12, sy + 14); }
  }
}
function drawOverlay(C) {
  if (act && act.drag === 'box' && act.bx != null) {
    const win = act.bx > act.x0, col = win ? '#3aa0ff' : '#4cd08a';
    ctx.setLineDash(win ? [] : [6, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.globalAlpha = 0.13;
    ctx.fillRect(act.x0, act.y0, act.bx - act.x0, act.by - act.y0); ctx.globalAlpha = 1; ctx.strokeRect(act.x0, act.y0, act.bx - act.x0, act.by - act.y0); ctx.setLineDash([]);
    ctx.font = '600 12px -apple-system,Segoe UI,Roboto,sans-serif'; ctx.textAlign = win ? 'left' : 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(win ? 'inside box' : 'touching box', act.bx + (win ? 6 : -6), Math.min(act.y0, act.by) - 4);
  }
  if (ptr) {      // cursor: crosshair with a gap at the tip
    const x = Math.round(ptr.x) + 0.5, y = Math.round(ptr.y) + 0.5, L = 16, gp = 4;
    for (const [w, c] of [[3.5, C.bg], [1.5, tool.name === 'select' ? C.geo : C.prev]]) {
      ctx.lineWidth = w; ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x - gp, y); ctx.moveTo(x + gp, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y - gp); ctx.moveTo(x, y + gp); ctx.lineTo(x, y + L); ctx.stroke();
    }
  }
}
let bdActive = false;
function loop() {
  if (mode === 'model') { if (dirty3) { dirty3 = false; draw3D(); } }
  else if (dirty || (mode === 'sketch' && dirty3)) {
    if (mode === 'sketch') { const on = backdropOn() && drawBackdrop(); if (on !== bdActive) { bdActive = on; $('#stage').classList.toggle('skbd', on); } dirty3 = false; }
    else if (bdActive) { bdActive = false; $('#stage').classList.remove('skbd'); }
    dirty = false; render(); if (mode !== 'flat') drawOverlay(pal());
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- chrome: ribbon, browser, status
const RIBBON = [
  ['Create', [['line', 'Line'], ['poly', 'Polyline'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['arc', 'Arc'], ['slot', 'Slot'], ['project', 'Project']]],
  ['Modify', [['select', 'Dimension'], ['fillet', 'Fillet'], ['chamfer', 'Chamfer'], ['constr', 'Construct'], ['del', 'Delete']]],
  ['Constrain', [['hor', 'Horizontal'], ['ver', 'Vertical'], ['par', 'Parallel'], ['perp', 'Perpendicular'], ['tan', 'Tangent'], ['eq', 'Equal'], ['coi', 'Coincident'], ['conc', 'Concentric'], ['sym', 'Symmetric'], ['mid', 'Midpoint'], ['fix', 'Fix / lock']], true],
  ['Pattern', [['pcirc', 'Circular'], ['prect', 'Rectangular']]],
  ['Output', [['dxf', 'Sketch DXF']]],
  ['Exit', [['finish', 'Finish Sketch']]],
];
const RIBBON_SM = [
  ['Sheet Metal', [['face', 'Face'], ['newsk', 'New Sketch'], ['cut', 'Cut'], ['flange', 'Edge Flange'], ['contour', 'Contour Flange'], ['thick', 'Thickness']]],
  ['Corners', [['cround', 'Corner Round'], ['cchamfer', 'Corner Chamfer']]],
  ['View', [['view', '3D / Sketch']]],
  ['Flat Pattern', [['flat', 'Flat Pattern'], ['flatdxf', 'Flat DXF']]],
];
const SMALL = new Set(['poly', 'slot', 'fillet', 'chamfer', 'constr', 'del', 'pcirc', 'prect']);   // secondary tools: small stacked buttons, Inventor style
const TOOLS = ['line', 'poly', 'rect', 'circle', 'arc', 'slot', 'select', 'fillet', 'chamfer'];
function ribbonClick(k) {
  if (cutSel && k !== 'cut' && k !== 'view' && k !== 'finish') cancelCut();
  if (flPick && k !== 'flange' && k !== 'view' && k !== 'finish') endFlPick();
  if (crPick && k !== 'cround' && k !== 'cchamfer' && k !== 'view' && k !== 'finish') endCrPick();
  if (k === 'select') { if (tool.dim) setTool('select'); else setTool('select', true); }
  else if (TOOLS.includes(k)) { if (tool.name === k) setTool('select'); else setTool(k); }
  else if (k === 'constr') toggleConstr();
  else if (k === 'del') deleteSel();
  else if (k === 'pcirc') startPattern('circ');
  else if (k === 'prect') startPattern('rect');
  else if (k === 'project') projectButton();
  else if (k === 'dxf') exportDialog('sketch');
  else if (k === 'flat') flatButton();
  else if (k === 'flatdxf') exportDialog('flat');
  else if (k === 'face') faceButton();
  else if (k === 'newsk') newSketchOnFace();
  else if (k === 'cut') makeCut();
  else if (k === 'flange') flangeButton();
  else if (k === 'contour') contourButton();
  else if (k === 'cround') cornerButton('round');
  else if (k === 'cchamfer') cornerButton('chamfer');
  else if (k === 'thick') { if (faceFeat()) thicknessDialog(t => { part.t = t.v; part.tl = t.label; commitPart(); }); else toast('Create a Face first — thickness is chosen then'); }
  else if (k === 'finish') { finishPoly(); closePop(); tool = { name: 'select', step: 0 }; sel = []; if (model && model.outer) setMode('model'); else { ribTab = 'sm'; buildRibbon(); refresh(); toast('Sketch finished — tap Face for a closed outline, or Contour Flange for an open profile'); } }
  else if (k === 'view') { if (mode === 'model') setMode('sketch'); else if (mode === 'flat') setMode('model'); else if (model && model.outer) setMode('model'); else toast(faceFeat() ? (model && model.err) || 'The outline is not closed' : 'No sheet metal yet — open the Sheet Metal tab, tap Face, then tap inside your outline'); }
  else if (tool.name === 'con' && tool.type === k) setTool('select');
  else applyCon(k);
}
function varBtn(k, lbl, grid) {
  const vs = VARIANTS[k], cur = vs && vs.find(v => v[0] === toolVar[k]);
  const b = el('button', { class: (grid ? 'cb' : SMALL.has(k) ? 'sb' : 'rb') + (vs ? ' hasvar' : ''), 'data-k': k, title: lbl, 'aria-label': lbl, html: icon(vs && cur && cur[0] !== vs[0][0] ? k + '-' + cur[0] : k) + (grid ? '' : `<span>${lbl}</span>`) });
  if (!vs) { b.onclick = () => ribbonClick(k); b.onpointerdown = () => { if (grid) setHint(lbl + ' constraint — tap this, then tap the geometry'); }; return b; }
  // hold the button (or slide the pen down from it) to pick the drawing style from a drop-down; a plain tap just picks the tool
  let timer = 0, menu = null, hov = null, y0 = 0, down = false;
  const items = () => menu ? [...menu.children] : [];
  const open = () => { if (menu) return; const r = b.getBoundingClientRect(); menu = el('div', { class: 'varmenu' }, vs.map((v, i) => el('div', { class: 'vi' + (toolVar[k] === v[0] ? ' cur' : ''), 'data-v': v[0], html: icon(i ? k + '-' + v[0] : k) + `<span>${v[1]}</span>` })));
    menu.style.left = Math.max(4, Math.min(r.left, innerWidth - 200)) + 'px'; menu.style.top = (r.bottom + 4) + 'px'; document.body.append(menu); };
  const close = () => { clearTimeout(timer); down = false; if (menu) { menu.remove(); menu = null; } hov = null; };
  const pick = v => { toolVar[k] = v; close(); setTool(k); buildRibbon(); refresh(); };
  b.addEventListener('contextmenu', e => e.preventDefault());
  b.addEventListener('pointerdown', e => { down = true; y0 = e.clientY; try { b.setPointerCapture(e.pointerId); } catch (_) {} clearTimeout(timer); timer = setTimeout(open, 350); });
  b.addEventListener('pointermove', e => { if (!down) return; if (!menu && e.clientY - y0 > 14) open(); if (!menu) return;
    hov = items().find(i => { const r = i.getBoundingClientRect(); return e.clientX >= r.left - 30 && e.clientX <= r.right + 30 && e.clientY >= r.top && e.clientY < r.bottom; }) || null; items().forEach(i => i.classList.toggle('hov', i === hov)); });
  b.addEventListener('pointerup', e => { if (!down) return; const had = !!menu, h = hov; if (had) { if (h) pick(h.dataset.v); else close(); } else { close(); ribbonClick(k); } });
  b.addEventListener('pointercancel', close);
  return b;
}
function buildRibbon() {
  const R = $('#ribbon'); R.innerHTML = '';
  for (const [name, btns0, grid] of (ribTab === 'sm' ? RIBBON_SM : RIBBON)) {
    const btns = name === 'Output' && model && model.outer ? [...btns0, ['flatdxf', 'Flat DXF']] : btns0;
    const big = btns.filter(b => grid || !SMALL.has(b[0])), small = grid ? [] : btns.filter(b => SMALL.has(b[0]));
    R.append(el('div', { class: 'grp' }, el('div', { class: 'btns' }, grid ? el('div', { class: 'grid' }, big.map(([k, lbl]) => varBtn(k, lbl, true))) : big.map(([k, lbl]) => varBtn(k, lbl, false)),
      small.length ? el('div', { class: 'stack' }, small.map(([k, lbl]) => varBtn(k, lbl, false))) : null), el('div', { class: 'gl' }, name)));
  }
  fitRibbon();
}
function fitRibbon() {       // the whole ribbon always fits the screen: step down through tighter layouts until nothing overflows
  const R = $('#ribbon'); if (!R) return; R.classList.remove('c1', 'c2', 'c3');
  for (const c of ['c1', 'c2', 'c3']) { if (R.scrollWidth <= R.clientWidth + 1) break; R.classList.add(c); }
}
window.addEventListener('resize', () => setTimeout(fitRibbon, 0));
let hintOverride = null, hintTimer = 0;
function setHint(t) { hintOverride = t; clearTimeout(hintTimer); hintTimer = setTimeout(() => { hintOverride = null; refreshStatus(); }, 3500); refreshStatus(); }
function refreshStatus() {
  $('#hint').textContent = hintOverride || (tool.name === 'con' ? CON_HINT[tool.type] + '. Stays on until you tap Esc.' : crPick ? 'Corner: tap a corner of the sheet. Tap a corner that already has one to change it. Tap the button again when done.' : mode === 'flat' ? 'Flat pattern: drag to pan, pinch or scroll to zoom. Orange dashes are the bend lines. Tap Flat DXF to save it.' : flPick ? 'Edge flange: tap an outer edge of the sheet or any free edge of a flange. Tap a flanged edge to change it. Tap Edge Flange again when done.' : cutSel ? 'Cut: tap each closed shape you want removed (tap again to unselect), then tap Apply Cut.' : mode === 'model' ? 'Drag to orbit. Two fingers pan and zoom. Tap a face to select it, double-tap it to sketch on it. Tap a feature in the browser to edit it.' : HINTS[tool.dim ? 'dim' : tool.name + '-' + toolVar[tool.name]] || HINTS[tool.dim ? 'dim' : tool.name] || '');
  const d = $('#dof');
  if (mode === 'model' || mode === 'flat') { d.textContent = ''; d.className = ''; return; }
  if (solverState === 'loading') { d.textContent = 'Loading solver…'; d.className = ''; }
  else if (solverState === 'failed') { d.textContent = 'Solver unavailable'; d.className = 'bad'; }
  else if (!Object.keys(S.ents).length) { d.textContent = ''; d.className = ''; }
  else if (dof === 0) { d.textContent = 'Fully constrained'; d.className = 'ok'; }
  else { d.textContent = dof + ' free ' + (dof === 1 ? 'move' : 'moves') + ' left'; d.className = ''; }
}
function refresh() {
  dirty = true;
  document.querySelectorAll('#ribbon [data-k]').forEach(b => { const k = b.dataset.k; b.classList.toggle('on', (k === 'newsk' && !!selFace) || (TOOLS.includes(k) && tool.name === k && mode === 'sketch' && (k !== 'select' || !!tool.dim)) || (tool.name === 'con' && tool.type === k) || (k === 'contour' && tool.name === 'contour') || (k === 'constr' && constrMode) || (k === 'face' && tool.name === 'face') || (k === 'cut' && !!cutSel) || (k === 'flange' && flPick) || (k === 'cround' && crPick === 'round') || (k === 'cchamfer' && crPick === 'chamfer') || (k === 'flat' && mode === 'flat')); });
  document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === ribTab));
  $('#undoBtn').disabled = hi <= 0; $('#redoBtn').disabled = hi >= hist.length - 1;
  refreshStatus(); buildBrowser(); updateInfo();
}
function buildBrowser() {
  const B = $('#browser'); B.innerHTML = '';
  const cnt = { line: 0, circle: 0, arc: 0 }; for (const id in S.ents) if (!S.ents[id].proj) cnt[S.ents[id].t]++;
  B.append(el('div', { class: 'root' }, el('span', { class: 'tg' }, 'P'), part.name || 'Part1'));
  for (const f of part.feats) {
    const on = f.type === 'sketch' && f.id === actId && mode === 'sketch';
    const val = f.type === 'face' || f.type === 'contour' ? (part.tl || '') : f.type === 'cut' || f.type === 'flange' || f.type === 'corner' ? (f.off ? 'off' : f.type === 'flange' ? (f.ang == null ? 90 : f.ang) + '°' : f.type === 'corner' ? (f.kind === 'chamfer' ? 'chamfer ' : 'R') + fmt(f.size) : '') : on ? 'editing' : '';
    B.append(el('div', { class: 'row' + (on ? ' on' : ''), onclick: () => { closeDrawer(); featTap(f); } }, el('span', { class: 'tg' }, f.type === 'sketch' ? '✎' : f.type === 'face' ? '▱' : f.type === 'flange' ? '⌐' : f.type === 'contour' ? '⎍' : f.type === 'corner' ? '◜' : '◍'), el('span', { class: 'nm' }, f.name), el('span', { class: 'vl' }, val),
      f.type === 'sketch' ? el('button', { class: 'x eye' + (sketchVis(f) ? ' on' : ''), title: sketchVis(f) ? 'Hide sketch' : 'Show sketch', 'aria-label': (sketchVis(f) ? 'Hide ' : 'Show ') + f.name, html: icon(sketchVis(f) ? 'eye' : 'eyeoff'), onclick: ev => { ev.stopPropagation(); f.vis = !sketchVis(f); commitPart(); } }) : null));
  }
  if (model && model.warn && model.warn.length) B.append(el('div', { class: 'sub', style: 'color:var(--danger);padding-top:6px' }, model.warn.join(' · ')));
  if (mode !== 'sketch') return;
  B.append(el('h4', {}, feat(actId).name + ' geometry'));
  B.append(el('div', { class: 'sub' }, `${cnt.line} line${cnt.line === 1 ? '' : 's'} · ${cnt.circle} circle${cnt.circle === 1 ? '' : 's'} · ${cnt.arc} arc${cnt.arc === 1 ? '' : 's'}`));
  const pick = (k, id) => {
    if (k === 'd' && popState && popState.spec && popState.spec.dimRef && !(sel.length === 1 && sel[0].k === 'd' && sel[0].id === id)) { popRefInsert(id); return; }
    if (tool.name !== 'select') setTool('select'); sel = [{ k, id }]; refresh(); closeDrawer(); if (k !== 'c') showSelPop(); else closePop(); };
  const delOne = (k, id) => { sel = [{ k, id }]; deleteSel(); };
  const dims = Object.entries(S.dims), pats = Object.entries(S.pats), cons = Object.entries(S.cons).filter(([, c]) => !c.hid);
  B.append(el('h4', {}, 'Dimensions'));
  if (!dims.length) B.append(el('div', { class: 'sub' }, 'None yet — tap a line and type a size'));
  for (const [id, d] of dims) B.append(el('div', { class: 'row' + (isSel('d', id) ? ' on' : ''), onclick: () => pick('d', id) }, el('span', { class: 'tg' }, d.t === 'ang' ? '∠' : d.t === 'dia' ? '⌀' : d.t === 'rad' ? 'R' : '↔'), el('span', { class: 'nm' }, id + ' · ' + DIM_NAMES[d.t] + (d.expr ? ' ƒ' : '')), el('span', { class: 'vl' }, (d.driven ? '(' : '') + fmt(d.v) + (d.t === 'ang' ? '°' : '') + (d.driven ? ')' : ''))));
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
function dxfText(layer, gs0) {
  const cl = s => (s || 'CUT').toUpperCase().replace(/[^A-Z0-9_$\-]/g, '_');
  const gs = gs0 || exportGeoms(), b = bboxG(gs) || { x0: 0, y0: 0, x1: 0, y1: 0 }, L = cl(layer), lays = [...new Set([L, ...gs.map(g => g.lay ? cl(g.lay) : L)])];
  const n = v => { const s = (+v).toFixed(6).replace(/0+$/, ''); return s.endsWith('.') ? s + '0' : s; };
  const o = [];
  const w = (...a) => { for (let i = 0; i < a.length; i += 2) o.push(String(a[i]).padStart(3, ' '), String(a[i + 1])); };
  w(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSBASE', 10, '0.0', 20, '0.0', 30, '0.0', 9, '$EXTMIN', 10, n(b.x0), 20, n(b.y0), 30, '0.0', 9, '$EXTMAX', 10, n(b.x1), 20, n(b.y1), 30, '0.0', 0, 'ENDSEC');
  w(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LTYPE', 70, 1, 0, 'LTYPE', 2, 'CONTINUOUS', 70, 64, 3, 'Solid line', 72, 65, 73, 0, 40, '0.0', 0, 'ENDTAB',
    0, 'TABLE', 2, 'LAYER', 70, lays.length, ...lays.flatMap(l => [0, 'LAYER', 2, l, 70, 64, 62, 7, 6, 'CONTINUOUS']), 0, 'ENDTAB', 0, 'ENDSEC');
  w(0, 'SECTION', 2, 'BLOCKS', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  const deg = a => { let d = a * 180 / PI % 360; if (d < 0) d += 360; return n(d); };
  for (const g of gs) {
    const GL = g.lay ? cl(g.lay) : L;
    if (g.t === 'line') w(0, 'LINE', 8, GL, 10, n(g.x1), 20, n(g.y1), 30, '0.0', 11, n(g.x2), 21, n(g.y2), 31, '0.0');
    else if (g.t === 'circle') w(0, 'CIRCLE', 8, GL, 10, n(g.cx), 20, n(g.cy), 30, '0.0', 40, n(g.r));
    else w(0, 'ARC', 8, GL, 10, n(g.cx), 20, n(g.cy), 30, '0.0', 40, n(g.r), 50, deg(g.sa), 51, deg(g.ea));
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
      if (/\.dxf$/i.test(filename)) {   // save the plain .dxf; only if this viewer refuses that file type, fall back to a zip
        try { await dl.save({ filename, data: text, mimeType: mime }); return { ok: true, msg: 'Saved ' + filename }; }
        catch (e) { if (e && e.code === 'declined') throw e; await dl.save({ filename: filename.replace(/\.dxf$/i, '') + '-dxf.zip', data: zipOne(filename, text) }); return { ok: true, msg: 'Saved', zipped: true }; }
      }
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
function exportDialog(kind) {
  closePop(); finishPoly();
  const flat = kind === 'flat';
  if (flat && !(model && model.outer)) { toast('No sheet metal part yet — create a Face first'); return; }
  const geoms = () => flat ? flatGeoms() : undefined;
  const first = dxfText(settings.layer, geoms());
  if (!first.count) { toast('Nothing to export yet — draw some geometry first'); return; }
  const b = first.bbox, nameIn = el('input', { type: 'text', value: safeName(part.name), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }), layIn = el('input', { type: 'text', value: settings.layer, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
  const note = el('div', { class: 'note' });
  const mk = () => { settings.layer = (layIn.value.trim() || 'CUT').toUpperCase(); saveSettings(); return dxfText(settings.layer, geoms()); };
  const nCon = flat ? 0 : Object.values(S.ents).filter(e => e.con && !e.proj).length;
  let info = `<b>${first.count}</b> entities · blank size <b>${fmt(b.x1 - b.x0)} × ${fmt(b.y1 - b.y0)}</b> in<br>R12 (AC1009) · LINE / ARC / CIRCLE · inches`;
  if (flat) info = `Thickness <b>${part.tl}</b> · ${model.holes.length} cutout${model.holes.length === 1 ? '' : 's'} · about <b>${fmt((model.area * part.t * 0.2836).toFixed(2))} lb</b> mild steel<br>` + info + (model.warn.length ? `<br><span style="color:var(--danger)">${model.warn.join('<br>')}</span>` : '');
  else if (model && model.outer) info += '<br><b>This saves only the sketch you are editing.</b> For the sheet metal part with its flanges and bend lines use Flat DXF.';
  if (!flat) info += (nCon ? `<br>${nCon} construction item${nCon === 1 ? '' : 's'} left out` : '') + (dof ? '<br>Sketch is not fully constrained — sizes are as drawn' : '');
  const dbxBtn = el('button', { onclick: async () => {
    const d = mk(), fname = safeName(nameIn.value) + '.dxf';
    if (framed || hosted()) { note.textContent = 'Dropbox cannot be reached from inside Claude. It works once QuickCad is on its own web page (for example GitHub Pages) with your Dropbox app key in Settings.'; return; }
    if (!settings.dbxKey) { note.textContent = 'Add your Dropbox app key in Settings first, then connect.'; return; }
    if (!dbxTok()) { note.textContent = 'Opening Dropbox to connect…'; dbxConnect(); return; }
    try {
      note.textContent = 'Uploading…'; const path = (settings.dbxFolder || '').replace(/\/+$/, '') + '/' + fname;
      let r = await dbxUpload(path, d.text, dbxBtn.dataset.replace === path);
      if (r.conflict) { dbxBtn.dataset.replace = path; dbxBtn.textContent = 'Replace in Dropbox'; note.textContent = fname + ' already exists in ' + (settings.dbxFolder || '/') + '. Tap Replace in Dropbox to overwrite it.'; return; }
      dbxBtn.dataset.replace = ''; dbxBtn.textContent = 'Save to Dropbox'; note.textContent = 'Saved to Dropbox: ' + path;
    } catch (err) { note.textContent = 'Dropbox upload failed: ' + (err && err.message || err); }
  } }, 'Save to Dropbox');
  modal.innerHTML = ''; modal.append(el('div', { class: 'dlg' }, el('h3', {}, flat ? 'Flat pattern DXF' : 'Export sketch DXF'),
    el('label', {}, 'File name'), nameIn, el('label', {}, 'Cut layer'), layIn,
    el('div', { class: 'info', html: info }),
    el('div', { class: 'btnrow' },
      el('button', { class: 'pri', onclick: async () => { const d = mk(); note.textContent = 'Saving…'; const r = await saveFile(safeName(nameIn.value) + '.dxf', d.text, 'application/dxf'); note.textContent = r.msg + (r.zipped ? ' — the DXF is inside the zip (this viewer only allows zip downloads).' : ''); } }, 'Save DXF'),
      dbxBtn,
      el('button', { onclick: async () => { const d = mk(); try { await navigator.clipboard.writeText(d.text); note.textContent = 'DXF text copied to the clipboard.'; } catch (e) { note.textContent = 'Copy was blocked here.'; } } }, 'Copy text'),
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
    dbxSettings(),
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
$('#escBtn').onclick = escAll; $('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo; $('#fitBtn').onclick = () => { if (mode === 'model') { G3.fitNext = true; dirty3 = true; } else if (mode === 'flat') fitFlat(); else fit(); }; $('#setBtn').onclick = settingsDialog;
$('#menuBtn').onclick = () => { $('#browser').classList.toggle('open'); $('#scrim').classList.toggle('on'); };
$('#scrim').onclick = closeDrawer;
$('#newBtn').onclick = () => confirmDialog('Start a new sketch?', 'The current sketch is cleared. Save it first if you want to keep it.', 'New sketch', () => loadPart(newPart()));
$('#saveBtn').onclick = async () => { finishPoly(); const r = await saveFile(safeName(part.name) + '.quickcad.json', JSON.stringify({ app: 'QuickCad', format: 2, part }), 'application/json'); toast(r.msg); };
$('#openBtn').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const o = JSON.parse(await f.text()); if (validPart(o.part)) loadPart(o.part); else { const sk = o.sketch || o; if (!validSketch(sk)) throw 0; loadSketch(sk); } toast('Opened ' + f.name); } catch (err) { toast('That file is not a QuickCad part file'); }
};
$('#pname').addEventListener('change', e => { part.name = e.target.value.trim() || 'Part1'; e.target.value = part.name; pushHist(); refresh(); });
$('#pname').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
document.querySelectorAll('.tab[data-soon]').forEach(t => t.onclick = () => toast(t.dataset.soon));
document.querySelectorAll('.tab[data-model]').forEach(t => t.onclick = () => { if (model && model.outer && !model.contour) setMode('model'); else toast('Make a Face first — then 3D Model shows the part'); });
document.querySelectorAll('.tab[data-tab]').forEach(t => t.onclick = () => { if (t.dataset.tab === 'sketch' && mode === 'model') { setMode('sketch'); return; } finishPoly(); ribTab = t.dataset.tab; buildRibbon(); refresh(); });
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe($('#stage'));

