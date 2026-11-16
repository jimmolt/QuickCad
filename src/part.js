// ================================================================ phase 2: sheet metal part
// The part is an ordered feature list: sketch -> face -> (sketch -> cut)*. Everything lies on one plane until flanges arrive.
let dirty3 = true;
const G3 = { ok: false, tried: false, az: -PI / 3, el: 0.62, span: 10, tx: 0, ty: 0, tz: 0, fitNext: true };

function withSketch(sk, fn) {
  const s0 = S, sel0 = sel, dof0 = dof, n0 = lastNid; S = sk; sel = [];
  try { return fn(); } finally { S = s0; sel = sel0; dof = dof0; lastNid = n0; }
}

// ---------------------------------------------------------------- closed loops
const KEY = (x, y) => Math.round(x * 1e4) + ',' + Math.round(y * 1e4);
function gEnds(g) {
  if (g.t === 'line') return [[g.x1, g.y1], [g.x2, g.y2]];
  return [[g.cx + g.r * Math.cos(g.sa), g.cy + g.r * Math.sin(g.sa)], [g.cx + g.r * Math.cos(g.ea), g.cy + g.r * Math.sin(g.ea)]];
}
function tess(g, rev) {            // points along g, last point left out
  if (g.t === 'line') return [rev ? [g.x2, g.y2] : [g.x1, g.y1]];
  const sa = g.t === 'circle' ? 0 : g.sa, sw = g.t === 'circle' ? TAU : g.ea - g.sa;
  const tol = Math.acos(Math.max(-1, 1 - 0.0015 / Math.max(g.r, 0.002))) * 2;
  const n = Math.max(3, Math.min(720, Math.ceil(sw / Math.min(PI / 30, tol || PI / 30))));
  const out = []; for (let k = 0; k < n; k++) { const a = rev ? sa + sw - sw * k / n : sa + sw * k / n; out.push([g.cx + g.r * Math.cos(a), g.cy + g.r * Math.sin(a)]); }
  return out;
}
function mkLoop(segs, poly) {
  let a = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return { segs, poly, area: Math.abs(a) / 2, bb: { x0, y0, x1, y1 } };
}
function findLoops(gs) {
  const loops = [], segs = []; let open = 0;
  for (const g of gs) {
    if (g.t === 'circle') { if (g.r > 1e-6) loops.push(mkLoop([g], tess(g))); continue; }
    const e = gEnds(g), k = [KEY(e[0][0], e[0][1]), KEY(e[1][0], e[1][1])];
    if (k[0] === k[1]) continue;
    segs.push({ g, k, used: false });
  }
  const map = new Map();
  segs.forEach((s, i) => s.k.forEach(k => { if (!map.has(k)) map.set(k, []); map.get(k).push(i); }));
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].used) continue;
    const chain = [{ i, rev: false }], startK = segs[i].k[0]; let curK = segs[i].k[1], last = i, ok = map.get(startK).length === 2;
    segs[i].used = true;
    while (curK !== startK) {
      const nb = map.get(curK); if (nb.length !== 2) { ok = false; break; }
      const j = nb[0] === last ? nb[1] : nb[0]; if (segs[j].used) { ok = false; break; }
      const rev = segs[j].k[0] !== curK; chain.push({ i: j, rev }); segs[j].used = true; curK = rev ? segs[j].k[0] : segs[j].k[1]; last = j;
    }
    if (!ok) { open++; continue; }
    const poly = []; for (const c of chain) poly.push(...tess(segs[c.i].g, c.rev));
    if (poly.length >= 3) loops.push(mkLoop(chain.map(c => segs[c.i].g), poly));
  }
  return { loops, open };
}

// ---------------------------------------------------------------- regions: every enclosed area made by the sketch geometry, including areas formed by crossing or touching lines
// Geometry is cut into small edges, split where edges cross or touch, dead ends are dropped, and the faces of the resulting network are traced. Runs of edges from the same
// line / arc are merged back, so a region's outline is still real lines and arcs for the DXF.
function cycleLoop(cyc, gs) {        // closed chain of small edges -> loop whose outline is merged back into whole lines and arcs
  let st = 0; const n = cyc.length; while (st < n && cyc[st].s === cyc[(st - 1 + n) % n].s) st++;
  const segs = [];
  if (st === n) { const g = gs[cyc[0].s]; if (g.t === 'circle') segs.push(g); else return null; }
  else for (let i = 0; i < n;) { let j = i; while (j + 1 < n && cyc[(st + j + 1) % n].s === cyc[(st + i) % n].s) j++;
    const f = cyc[(st + i) % n], l = cyc[(st + j) % n], g = gs[f.s], A = f.A, B = l.B;
    if (g.t === 'line') segs.push({ t: 'line', x1: A[0], y1: A[1], x2: B[0], y2: B[1] });
    else { const m = f.B, ccw = (A[0] - g.cx) * (m[1] - g.cy) - (A[1] - g.cy) * (m[0] - g.cx) > 0, p = ccw ? A : B, q = ccw ? B : A, sa = Math.atan2(p[1] - g.cy, p[0] - g.cx); let ea = Math.atan2(q[1] - g.cy, q[0] - g.cx); while (ea <= sa + 1e-9) ea += TAU; segs.push({ t: 'arc', cx: g.cx, cy: g.cy, r: g.r, sa, ea }); }
    i = j + 1; }
  const lp = mkLoop(segs, cyc.map(c => c.A)); lp.he = cyc; lp.gs = gs; return lp;
}
function unionRegions(list) {         // picked regions that share an edge become one shape (the shared edge disappears)
  if (list.length < 2 || list.some(l => !l.he) || list.some(l => l.gs !== list[0].gs)) return list;
  const all = new Map(); for (const l of list) for (const h of l.he) all.set(h.k, h);
  const keep = [...all.values()].filter(h => !all.has(h.tk)), by = new Map(); for (const h of keep) { if (!by.has(h.from)) by.set(h.from, []); by.get(h.from).push(h); }
  const out = [], used = new Set();
  for (const h0 of keep) { if (used.has(h0)) continue; const cyc = []; let h = h0;
    while (h && !used.has(h)) { used.add(h); cyc.push(h); h = (by.get(h.to) || []).find(x => !used.has(x)) || (h.to === h0.from ? h0 : null); }
    if (h !== h0 || cyc.length < 2) continue; let ar = 0; for (const c of cyc) ar += c.A[0] * c.B[1] - c.B[0] * c.A[1]; if (ar <= 1e-9) continue;
    const lp = cycleLoop(cyc, list[0].gs); if (lp) out.push(lp); }
  return out.length ? out : list;
}
const regionCache = new Map();
function regions(gs) {
  const key = JSON.stringify(gs); if (regionCache.has(key)) return regionCache.get(key);
  const E = [];
  gs.forEach((g, si) => { if (g.t === 'line') { E.push({ a: [g.x1, g.y1], b: [g.x2, g.y2], s: si }); return; } if (!(g.r > 1e-6)) return;
    const pts = tess(g); pts.push(g.t === 'circle' ? pts[0] : gEnds(g)[1]); for (let k = 0; k < pts.length - 1; k++) E.push({ a: pts[k], b: pts[k + 1], s: si }); });
  // close small gaps: a line end that stops just short of another edge (or overshoots by a hair) is pulled onto it, so hand-drawn triangles still count as closed
  { const TOL = 0.04, near = (p, skip) => { let best = null, bd = TOL; for (const f of E) { if (f.s === skip) continue; const sx = f.b[0] - f.a[0], sy = f.b[1] - f.a[1], l2 = sx * sx + sy * sy; if (l2 < 1e-14) continue;
        const t = Math.max(0, Math.min(1, ((p[0] - f.a[0]) * sx + (p[1] - f.a[1]) * sy) / l2)), q = [f.a[0] + t * sx, f.a[1] + t * sy], d = hyp(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; best = { q, d }; } } return best; };
    const ends = []; gs.forEach((g, si) => { if (g.t === 'line') ends.push([si, 'a'], [si, 'b']); });
    const idx = new Map(); E.forEach((e, i) => { if (gs[e.s].t === 'line') idx.set(e.s, i); });
    for (const [si, w] of ends) { const e = E[idx.get(si)], p = w === 'a' ? e.a : e.b, nb = near(p, si); if (nb && nb.d > 1e-6) { if (w === 'a') e.a = nb.q; else e.b = nb.q; } } }
  const cuts = E.map(() => []), ep = 1e-7;
  for (let i = 0; i < E.length; i++) { const e = E[i], rx = e.b[0] - e.a[0], ry = e.b[1] - e.a[1], x0 = Math.min(e.a[0], e.b[0]) - 1e-6, x1 = Math.max(e.a[0], e.b[0]) + 1e-6, y0 = Math.min(e.a[1], e.b[1]) - 1e-6, y1 = Math.max(e.a[1], e.b[1]) + 1e-6;
    for (let j = i + 1; j < E.length; j++) { const f = E[j]; if (f.s === e.s) continue;
      if (Math.max(f.a[0], f.b[0]) < x0 || Math.min(f.a[0], f.b[0]) > x1 || Math.max(f.a[1], f.b[1]) < y0 || Math.min(f.a[1], f.b[1]) > y1) continue;
      const sx = f.b[0] - f.a[0], sy = f.b[1] - f.a[1], den = rx * sy - ry * sx; if (Math.abs(den) < 1e-14) continue;
      const qx = f.a[0] - e.a[0], qy = f.a[1] - e.a[1], t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den, le = hyp(rx, ry), lf = hyp(sx, sy), te = 2e-5 / le, tf = 2e-5 / lf;
      if (t < -te || t > 1 + te || u < -tf || u > 1 + tf) continue;
      const p = u <= tf ? f.a : u >= 1 - tf ? f.b : t <= te ? e.a : t >= 1 - te ? e.b : [e.a[0] + t * rx, e.a[1] + t * ry];
      if (t > te && t < 1 - te) cuts[i].push([t, p]); if (u > tf && u < 1 - tf) cuts[j].push([u, p]); } }
  const nodes = new Map(), nk = p => { const k = KEY(p[0], p[1]); if (!nodes.has(k)) nodes.set(k, { p, out: [] }); return k; }, seen = new Set(), H = [];
  E.forEach((e, i) => { const pts = [e.a, ...cuts[i].sort((a, b) => a[0] - b[0]).map(c => c[1]), e.b];
    for (let k = 0; k < pts.length - 1; k++) { const ka = nk(pts[k]), kb = nk(pts[k + 1]); if (ka === kb) continue; const id = ka < kb ? ka + '|' + kb : kb + '|' + ka; if (seen.has(id)) continue; seen.add(id); H.push({ ka, kb, s: e.s, dead: false }); } });
  const deg = new Map(); for (const h of H) { deg.set(h.ka, (deg.get(h.ka) || 0) + 1); deg.set(h.kb, (deg.get(h.kb) || 0) + 1); }
  for (let ch = true; ch;) { ch = false; for (const h of H) if (!h.dead && (deg.get(h.ka) === 1 || deg.get(h.kb) === 1)) { h.dead = true; deg.set(h.ka, deg.get(h.ka) - 1); deg.set(h.kb, deg.get(h.kb) - 1); ch = true; } }
  const half = []; for (const h of H) { if (h.dead) continue; const A = nodes.get(h.ka), B = nodes.get(h.kb), h1 = { from: h.ka, to: h.kb, s: h.s, ang: Math.atan2(B.p[1] - A.p[1], B.p[0] - A.p[0]), used: false }, h2 = { from: h.kb, to: h.ka, s: h.s, ang: Math.atan2(A.p[1] - B.p[1], A.p[0] - B.p[0]), used: false }; h1.tw = h2; h2.tw = h1; A.out.push(h1); B.out.push(h2); half.push(h1, h2); }
  for (const n of nodes.values()) { n.out.sort((a, b) => a.ang - b.ang); n.out.forEach((h, i) => h.idx = i); }
  const out = [];
  for (const h0 of half) { if (h0.used) continue; const cyc = []; let h = h0, guard = 0;
    while (!h.used && guard++ < 200000) { h.used = true; cyc.push(h); const o = nodes.get(h.to).out; h = o[(h.tw.idx - 1 + o.length) % o.length]; }
    if (h !== h0 || cyc.length < 2) continue;
    let ar = 0; for (const c of cyc) { const a = nodes.get(c.from).p, b = nodes.get(c.to).p; ar += a[0] * b[1] - b[0] * a[1]; } if (ar <= 1e-9) continue;
    const lp = cycleLoop(cyc.map(c => ({ s: c.s, A: nodes.get(c.from).p, B: nodes.get(c.to).p, k: c.from + '>' + c.to, tk: c.to + '>' + c.from, from: c.from, to: c.to })), gs); if (lp) out.push(lp);
  }
  if (regionCache.size > 40) regionCache.clear(); regionCache.set(key, out); return out;
}
const cutRegions = sk => withSketch(sk, () => regions(toModelGs(sk, exportGeoms())));
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function polysCross(p, q) {
  const n = p.length, m = q.length;
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    for (let j = 0; j < m; j++) {
      const c = q[j], d = q[(j + 1) % m];
      const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
      if ((d1 > 0) === (d2 > 0)) continue;
      const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]), d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
      if ((d3 > 0) !== (d4 > 0)) return true;
    }
  }
  return false;
}
const bbOut = (a, b) => a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1;
const loopIn = (inner, outer) => !bbOut(inner.bb, outer.bb) && inner.poly.every(p => pointInPoly(p[0], p[1], outer.poly));
const crosses = (a, b) => !bbOut(a.bb, b.bb) && polysCross(a.poly, b.poly);
// A sketch drawn on the underside of the sheet is stored as seen from below (x mirrored); everything that talks to the 3D model converts back.
const skOwner = sk => part.feats.find(f => f.type === 'sketch' && f.sk === sk);
const skMir = sk => { const o = skOwner(sk); return o && o.plane === 'bot' ? -1 : 1; };
function mirG(g) { const o = Object.assign({}, g); if (g.t === 'line') { o.x1 = -g.x1; o.x2 = -g.x2; } else { o.cx = -g.cx; if (g.t === 'arc') { o.sa = PI - g.ea; o.ea = PI - g.sa; } } return o; }
const toModelGs = (sk, gs) => skMir(sk) < 0 ? gs.map(mirG) : gs;
const sketchLoops = sk => withSketch(sk, () => findLoops(toModelGs(sk, exportGeoms())));
const topLoops = loops => loops.filter(l => !loops.some(o => o !== l && o.area > l.area && pointInPoly(l.poly[0][0], l.poly[0][1], o.poly)));

// ---------------------------------------------------------------- model = outline minus cutouts
function buildModel() {
  model = null;
  const cf = contourFeat(); if (cf && !faceFeat()) { buildContour(cf); return; }
  const face = faceFeat(); if (!face || !part.t) return;
  const fs = feat(face.sk); if (!fs) return;
  const { loops, open } = sketchLoops(fs.sk);
  if (!loops.length) { model = { err: 'The outline sketch has no closed shape', warn: ['The outline sketch has no closed shape'] }; return; }
  const cand = face.pt ? loops.filter(l => pointInPoly(face.pt.x, face.pt.y, l.poly)).sort((a, b) => a.area - b.area) : [];
  const base = cand[0] || loops.slice().sort((a, b) => b.area - a.area)[0];
  let outer = base;
  let holes = topLoops(loops.filter(l => l !== outer && loopIn(l, outer)));
  flCutLoops = {};
  const warn = []; if (open) warn.push(fs.name + ': ' + open + ' open shape' + (open === 1 ? '' : 's') + ' ignored');
  outer = applyCorners(base, warn);
  for (const f of part.feats) {
    if (f.type !== 'cut' || f.off) continue;
    const sf = feat(f.sk); if (!sf) continue;
    const r = f.pick ? { loops: cutRegions(sf.sk) } : sketchLoops(sf.sk); let skipped = 0, used = 0;
    let cl = r.loops;
    if (skFl(sf)) { if (f.pick) { cl = []; for (const q of f.pick) { const h = r.loops.filter(l => pointInPoly(q.x, q.y, l.poly)).sort((a, b) => a.area - b.area)[0]; if (h && !cl.includes(h)) cl.push(h); } } cl = unionRegions(cl); (flCutLoops[sf.plane.fl] = flCutLoops[sf.plane.fl] || []).push(...cl.map(l => Object.assign({ cut: f.name }, l))); continue; }
    if (f.pick) { cl = []; for (const q of f.pick) { const h = r.loops.filter(l => pointInPoly(q.x, q.y, l.poly)).sort((a, b) => a.area - b.area)[0]; if (h && !cl.includes(h)) cl.push(h); } }
    if (f.pick) cl = unionRegions(cl);
    for (const c of topLoops(cl)) {
      if (!loopIn(c, outer) || crosses(c, outer) || holes.some(h => crosses(c, h))) { skipped++; continue; }
      if (holes.some(h => pointInPoly(c.poly[0][0], c.poly[0][1], h.poly))) continue;       // already open there
      holes = holes.filter(h => !pointInPoly(h.poly[0][0], h.poly[0][1], c.poly)); holes.push(c); used++;
    }
    if (skipped) warn.push(f.name + ': ' + skipped + ' profile' + (skipped === 1 ? '' : 's') + ' skipped (crosses an edge or another cutout — edge notches go in the outline sketch for now)');
    if (!used && !skipped) warn.push(f.name + ': no closed shape to cut');
  }
  const fl = addFlanges(outer, holes, warn);
  for (const id in flCutLoops) if (!fl.flanges.some(x => x.f.id === id)) warn.push(flCutLoops[id][0].cut + ': the flange it cuts is missing or suppressed');
  model = { flHoles: fl.flHoles, flHolePolys: fl.flHolePolys, base, outer, holes, warn, bb: fl.bb, area: fl.area, flanges: fl.flanges, bends: fl.bends, flatSegs: fl.flatSegs };
}
const baseGeoms = () => model && model.outer ? [...model.outer.segs, ...model.holes.flatMap(h => h.segs)] : [];
const flatGeoms = () => model && model.outer ? [...(model.flatSegs || model.outer.segs), ...model.holes.flatMap(h => h.segs), ...(model.flHoles || []), ...(model.bends || [])] : [];


// ---------------------------------------------------------------- edge flanges
// f = { type:'flange', e:{mx,my,nx,ny} (picked outline edge: midpoint + outward normal), ang, len, ref:'out'|'in'|'tan', side:'up'|'down', r?, k? }
const flR = f => f.r != null ? f.r : (part.rule.rm || 1) * part.t;
const flK = f => f.k != null ? f.k : part.rule.k;
function flangeCalc(f) {
  const t = part.t, r = flR(f), k = flK(f), ad = f.ang == null ? 90 : f.ang;
  if (t > 1) return { err: 'flanges are blocked above 1 in thickness (bending limit)' };
  if (!(ad > 0 && ad < 180)) return { err: 'angle must be between 0 and 180°' };
  if (!(r >= 0)) return { err: 'bend radius must be 0 or more' };
  const A = ad * PI / 180, tn = Math.tan(A / 2), out = (r + t) * tn, inn = r * tn;
  const need = f.ref === 'tan' ? 0 : f.ref === 'in' ? inn : out;
  const Lf = f.len - need;
  if (!(Lf > 1e-4)) return { err: 'length must be more than ' + fmt(+need.toFixed(4)) + ' in for this bend' };
  const BA = A * (r + k * t);
  return { A, r, k, t, Lf, BA, D: BA + Lf, down: f.side === 'down', out, inn };
}
function edgeFrame(g, outer) {        // outward normal of a straight outline edge
  const L = hyp(g.x2 - g.x1, g.y2 - g.y1), dx = (g.x2 - g.x1) / L, dy = (g.y2 - g.y1) / L, mx = (g.x1 + g.x2) / 2, my = (g.y1 + g.y2) / 2;
  let ux = dy, uy = -dx; if (pointInPoly(mx + ux * 1e-3, my + uy * 1e-3, outer.poly)) { ux = -ux; uy = -uy; }
  return { L, mx, my, ux, uy };
}
function flangeEdge(f, outer) {
  const e = f.e; let best = null;
  for (const g of outer.segs) {
    if (g.t !== 'line' || hyp(g.x2 - g.x1, g.y2 - g.y1) < 1e-6) continue;
    const fr = edgeFrame(g, outer); if (fr.ux * e.nx + fr.uy * e.ny < 0.9) continue;
    const d = hyp(fr.mx - e.mx, fr.my - e.my); if (!best || d < best.d) best = { g, d, fr };
  }
  return best;
}
const stripLoop = (fa, fb, d, D) => { const e = 2e-3, L = hyp(fb[0] - fa[0], fb[1] - fa[1]) || 1, tx = (fb[0] - fa[0]) / L * e, ty = (fb[1] - fa[1]) / L * e;
  const pts = [[fa[0] + tx + d[0] * e, fa[1] + ty + d[1] * e], [fa[0] + tx + d[0] * (D - e), fa[1] + ty + d[1] * (D - e)], [fb[0] - tx + d[0] * (D - e), fb[1] - ty + d[1] * (D - e)], [fb[0] - tx + d[0] * e, fb[1] - ty + d[1] * e]];
  return { poly: pts, bb: { x0: Math.min(...pts.map(a => a[0])), x1: Math.max(...pts.map(a => a[0])), y0: Math.min(...pts.map(a => a[1])), y1: Math.max(...pts.map(a => a[1])) } }; };
const v3 = (a, b, c, d) => [a[0] * b + c[0] * d, a[1] * b + c[1] * d, a[2] * b + c[2] * d];     // a*b + c*d
const neg3 = a => [-a[0], -a[1], -a[2]];
function advanceFrame(fr, c, t) {         // frame (bottom-surface origin, sheet direction u, top-face normal n, edge direction v) -> frame at the tip of the flat leg (leg0 = where the flat leg starts)
  const s = Math.sin(c.A), co = Math.cos(c.A); let lu, lz, u2, n2;
  if (!c.down) { lu = (c.r + t) * s; lz = t + c.r - (c.r + t) * co; u2 = [co, s]; n2 = [-s, co]; }
  else { lu = c.r * s; lz = -c.r + c.r * co; u2 = [co, -s]; n2 = [s, co]; }
  const O2 = v3(fr.O, 1, v3(fr.u, lu, fr.n, lz), 1), u = v3(fr.u, u2[0], fr.n, u2[1]), n = v3(fr.u, n2[0], fr.n, n2[1]);
  return { O: v3(O2, 1, u, c.Lf), u, n, v: fr.v, leg0: O2 };
}
const ln = (a, b) => ({ t: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
let flCutLoops = {};       // flange id -> closed loops (in the flange's own flat-leg coordinates) to cut through it
function addFlanges(outer, holes, warn) {
  const flHoles = [], flHolePolys = [], flanges = [], bends = [], flatSegs = outer.segs.slice(), strips = [], byId = {};
  let area = outer.area - holes.reduce((s, h) => s + h.area, 0), bb = Object.assign({}, outer.bb);
  const lb = (settings.layBend || 'IV_BEND'), lbd = (settings.layBendDown || 'IV_BEND_DOWN');
  for (const f of part.feats) {
    if (f.type !== 'flange' || f.off) continue;
    const c = flangeCalc(f); if (c.err) { warn.push(f.name + ': ' + c.err); continue; }
    let rec, target, pre = [], post = [];
    if (!f.parent) {
      const ed = flangeEdge(f, outer); if (!ed) { warn.push(f.name + ': its edge is gone — delete it or pick the edge again'); continue; }
      if (flanges.some(x => x.g === ed.g)) { warn.push(f.name + ': that edge already has a flange'); continue; }
      const { g, fr } = ed, ux = fr.ux, uy = fr.uy, vx = uy, vy = -ux, a = [g.x1, g.y1], b = [g.x2, g.y2];
      const p = (a[0] * vx + a[1] * vy <= b[0] * vx + b[1] * vy) ? a : b, q = p === a ? b : a;
      rec = { f, g, c, fa: p, fb: q, fd: [ux, uy], W: fr.L, fr0: { O: [p[0], p[1], 0], u: [ux, uy, 0], n: [0, 0, 1], v: [vx, vy, 0] } }; target = g;
    } else {
      const P = byId[f.parent], edge = f.pe || 'tip'; if (!P) { warn.push(f.name + ': the flange it hangs from is missing or suppressed'); continue; }
      if (flanges.some(x => x.f.parent === f.parent && (x.f.pe || 'tip') === edge)) { warn.push(f.name + ': that edge of the flange already has a flange'); continue; }
      const fd = P.fd, D = P.c.D, BA = P.c.BA, T = P.tip, dl = hyp(P.fb[0] - P.fa[0], P.fb[1] - P.fa[1]), dv = [(P.fb[0] - P.fa[0]) / dl, (P.fb[1] - P.fa[1]) / dl];
      const mv = (pt, k) => [pt[0] + fd[0] * k, pt[1] + fd[1] * k];
      if (edge === 'tip') { rec = { f, g: null, c, fa: mv(P.fa, D), fb: mv(P.fb, D), fd, W: P.W, fr0: T }; target = P.endLine; }
      else if (edge === 's0') { const fa = mv(P.fa, BA), fb = mv(P.fa, D); rec = { f, g: null, c, fa, fb, fd: [-dv[0], -dv[1]], W: P.c.Lf, fr0: { O: T.leg0, u: neg3(T.v), n: T.n, v: T.u } }; target = P.sideLines.s0; pre = [ln(P.fa, fa)]; }
      else { const fa = mv(P.fb, D), fb = mv(P.fb, BA); rec = { f, g: null, c, fa, fb, fd: dv, W: P.c.Lf, fr0: { O: v3(v3(T.leg0, 1, T.v, P.W), 1, T.u, P.c.Lf), u: T.v, n: T.n, v: neg3(T.u) } }; target = P.sideLines.s1; post = [ln(fb, P.fb)]; }
    }
    { // auto-trim: if this flange runs into an earlier one, cut its width back until it clears by the gap
      const PB = flPieces(rec, 0), gap = flGap(f), by = []; let lo = Infinity, hi = -Infinity, t0 = 0, t1 = 0;
      for (const A of flanges) { if (A.f.id === f.parent) continue;
        const core = flPieces(A, -2e-4); if (!core.some(pa => PB.some(pb => vExtent(pa, pb, rec.fr0)))) continue;
        for (const pa of flPieces(A, gap)) for (const pb of PB) { const e = vExtent(pa, pb, rec.fr0); if (e) { lo = Math.min(lo, e[0]); hi = Math.max(hi, e[1]); } }
        by.push(A.f.name); }
      if (lo <= hi) { lo = Math.max(0, lo); hi = Math.min(rec.W, hi);
        if (rec.W - (hi - lo) < 0.02) warn.push(f.name + ': runs into ' + by.join(', ') + ' across its whole width');
        else { if ((lo + hi) / 2 < rec.W / 2) t0 = hi; else t1 = rec.W - lo;
          const L = hyp(rec.fb[0] - rec.fa[0], rec.fb[1] - rec.fa[1]) || 1, dx = (rec.fb[0] - rec.fa[0]) / L, dy = (rec.fb[1] - rec.fa[1]) / L, ofa = rec.fa, ofb = rec.fb;
          rec.fa = [ofa[0] + dx * t0, ofa[1] + dy * t0]; rec.fb = [ofb[0] - dx * t1, ofb[1] - dy * t1]; rec.W -= t0 + t1; rec.fr0 = Object.assign({}, rec.fr0, { O: v3(rec.fr0.O, 1, rec.fr0.v, t0) });
          if (t0) pre.push(ln(ofa, rec.fa)); if (t1) post.unshift(ln(rec.fb, ofb)); rec.trim = { by, amt: t0 + t1 }; } }
    }
    const { fa, fb, fd, W } = rec, D = c.D, h = c.BA / 2, i = flatSegs.indexOf(target);
    const fa1 = [fa[0] + fd[0] * D, fa[1] + fd[1] * D], fb1 = [fb[0] + fd[0] * D, fb[1] + fd[1] * D], l3 = [ln(fa, fa1), ln(fa1, fb1), ln(fb1, fb)];
    if (i >= 0) flatSegs.splice(i, 1, ...pre, ...l3, ...post); else flatSegs.push(...pre, ...l3, ...post);
    rec.sideLines = { s0: l3[0], s1: l3[2] }; rec.endLine = l3[1];
    bends.push({ t: 'line', x1: fa[0] + fd[0] * h, y1: fa[1] + fd[1] * h, x2: fb[0] + fd[0] * h, y2: fb[1] + fd[1] * h, lay: c.down ? lbd : lb, info: { ang: f.ang == null ? 90 : f.ang, r: c.r, down: c.down, name: f.name } });
    const sl = stripLoop(fa, fb, fd, D);
    if (crosses(sl, outer) || strips.some(o => crosses(sl, o)) || (!f.parent && pointInPoly((fa[0] + fb[0]) / 2 + fd[0] * D / 2, (fa[1] + fb[1]) / 2 + fd[1] * D / 2, outer.poly))) warn.push(f.name + ': the flat blank overlaps itself here — a corner relief is needed (not built yet)');
    strips.push(sl); rec.tip = advanceFrame(rec.fr0, c, part.t); flanges.push(rec); byId[f.id] = rec;
    rec.holes = []; { const dl = hyp(fb[0] - fa[0], fb[1] - fa[1]) || 1, ex = (fb[0] - fa[0]) / dl, ey = (fb[1] - fa[1]) / dl, th = Math.atan2(ey, ex), mp = (x, y) => [fa[0] + ex * x + fd[0] * (c.BA + y), fa[1] + ey * x + fd[1] * (c.BA + y)];
      for (const h of topLoops(flCutLoops[f.id] || [])) { if (h.bb.x0 < 1e-4 || h.bb.y0 < 1e-4 || h.bb.x1 > W - 1e-4 || h.bb.y1 > c.Lf - 1e-4) { warn.push(h.cut + ': a shape reaches past the edge of ' + f.name + ' and was skipped'); continue; }
        rec.holes.push(h); area -= h.area; flHolePolys.push(h.poly.map(q => mp(q[0], q[1])));
        for (const g of h.segs) { if (g.t === 'line') { const a = mp(g.x1, g.y1), b = mp(g.x2, g.y2); flHoles.push({ t: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1] }); } else { const cc = mp(g.cx, g.cy), o = { t: g.t, cx: cc[0], cy: cc[1], r: g.r }; if (g.t === 'arc') { o.sa = g.sa + th; o.ea = g.ea + th; } flHoles.push(o); } } } }
    area += W * D; for (const pt of [fa1, fb1]) { bb.x0 = Math.min(bb.x0, pt[0]); bb.x1 = Math.max(bb.x1, pt[0]); bb.y0 = Math.min(bb.y0, pt[1]); bb.y1 = Math.max(bb.y1, pt[1]); }
  }
  return { flanges, bends, flatSegs, area, bb, flHoles, flHolePolys };
}
// the three free edges of a flange's flat leg, as thin end-face rectangles in 3D: tip, side at the start of the edge (s0) and at the far end (s1)
function edgeCorners(fl, which) {
  const T = fl.tip, th = part.t; let a, dir, len;
  if (which === 'tip') { a = T.O; dir = T.v; len = fl.W; }
  else { a = which === 's1' ? v3(T.leg0, 1, T.v, fl.W) : T.leg0; dir = T.u; len = fl.c.Lf; }
  const b = v3(a, 1, dir, len); return [a, b, v3(b, 1, T.n, th), v3(a, 1, T.n, th)];
}
function pickTip(px, py, tolPx) {
  if (!(model && model.flanges && G3.ok && G3.cam)) return null; const T = window.THREE; let best = null;
  const sc = p => { const v = new T.Vector3(p[0], p[1], p[2]).project(G3.cam); return [(v.x + 1) / 2 * CW, (1 - v.y) / 2 * CH]; };
  const segD = (A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1e-9, u = Math.max(0, Math.min(1, ((px - A[0]) * dx + (py - A[1]) * dy) / L2)); return hyp(px - (A[0] + u * dx), py - (A[1] + u * dy)); };
  for (const fl of model.flanges) for (const edge of ['tip', 's0', 's1']) {
    const P = edgeCorners(fl, edge).map(sc), d = Math.min(segD(P[0], P[1]), segD(P[3], P[2]));
    if (d < tolPx && (!best || d < best.d)) best = { fl, edge, d };
  }
  return best;
}
function pickFlangeEdge3(px, py) {      // nearest edge LINE on screen: top line of an edge = bend up, bottom line = bend down
  if (!(model && model.outer && G3.ok && G3.cam)) return null; const T = window.THREE; let best = null;
  const sc = p => { const v = new T.Vector3(p[0], p[1], p[2]).project(G3.cam); return [(v.x + 1) / 2 * CW, (1 - v.y) / 2 * CH]; };
  const segD = (A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1e-9, u = Math.max(0, Math.min(1, ((px - A[0]) * dx + (py - A[1]) * dy) / L2)); return hyp(px - (A[0] + u * dx), py - (A[1] + u * dy)); };
  const tryL = (A, B, hit) => { const d = segD(sc(A), sc(B)); if (d < 20 && (!best || d < best.d - 1e-6)) best = Object.assign({ d, line: [A, B] }, hit); };
  for (const fl of model.flanges || []) for (const edge of ['tip', 's0', 's1']) { const C = edgeCorners(fl, edge); tryL(C[3], C[2], { tip: fl, edge, side: 'up' }); tryL(C[0], C[1], { tip: fl, edge, side: 'down' }); }
  if (!model.contour) model.outer.segs.forEach((g, gi) => { if (g.t !== 'line') return; tryL([g.x1, g.y1, part.t], [g.x2, g.y2, part.t], { g, gi, side: 'up' }); tryL([g.x1, g.y1, 0], [g.x2, g.y2, 0], { g, gi, side: 'down' }); });
  if (best) best.key = (best.tip ? 't' + best.tip.f.id + best.edge : 'g' + best.gi) + best.side;
  return best;
}
// ---- flange-to-flange clearance: convex pieces (plane lists, n.x <= d) of a flange, and the v-range where two pieces overlap
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const flGap = f => f.gap != null ? f.gap : (part.rule.gap != null ? part.rule.gap : 0.03);
function flPieces(rec, off) {
  const c = rec.c, t = part.t, F = rec.fr0, m = Math.max(2, Math.ceil(c.A / (PI / 6))), I = [], O = [];
  for (let i = 0; i <= m; i++) { const th = c.A * i / m, s = Math.sin(th), co = Math.cos(th); I.push([c.r * s, t + c.r - c.r * co]); O.push([(c.r + t) * s, t + c.r - (c.r + t) * co]); }
  const dx = Math.cos(c.A), dz = Math.sin(c.A); let polys = [];
  for (let i = 0; i < m; i++) polys.push([I[i], I[i + 1], O[i + 1], O[i]]);
  polys.push([I[m], [I[m][0] + c.Lf * dx, I[m][1] + c.Lf * dz], [O[m][0] + c.Lf * dx, O[m][1] + c.Lf * dz], O[m]]);
  if (c.down) polys = polys.map(pl => pl.map(q => [q[0], t - q[1]]));
  const vo = dot3(F.v, F.O);
  return polys.map(pl => { const cx = (pl[0][0] + pl[1][0] + pl[2][0] + pl[3][0]) / 4, cy = (pl[0][1] + pl[1][1] + pl[2][1] + pl[3][1]) / 4, planes = [];
    for (let k = 0; k < 4; k++) { const p = pl[k], q = pl[(k + 1) % 4]; let nx = q[1] - p[1], ny = p[0] - q[0]; const L = hyp(nx, ny); if (L < 1e-9) continue; nx /= L; ny /= L; let d = nx * p[0] + ny * p[1]; if (nx * cx + ny * cy > d) { nx = -nx; ny = -ny; d = -d; }
      const N = v3(F.u, nx, F.n, ny); planes.push({ n: N, d: d + off + dot3(N, F.O) }); }
    planes.push({ n: F.v, d: vo + rec.W + off }, { n: neg3(F.v), d: -vo + off }); return planes; });
}
function vExtent(PA, PB, F) {
  const P = PA.concat(PB), n = P.length, vo = dot3(F.v, F.O); let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const cij = cross3(P[i].n, P[j].n); if (dot3(cij, cij) < 1e-12) continue;
    for (let k = j + 1; k < n; k++) { const det = dot3(cij, P[k].n); if (Math.abs(det) < 1e-9) continue;
      const a = cross3(P[j].n, P[k].n), b = cross3(P[k].n, P[i].n), x = [(P[i].d * a[0] + P[j].d * b[0] + P[k].d * cij[0]) / det, (P[i].d * a[1] + P[j].d * b[1] + P[k].d * cij[1]) / det, (P[i].d * a[2] + P[j].d * b[2] + P[k].d * cij[2]) / det];
      let ok = true; for (let q = 0; q < n; q++) if (dot3(P[q].n, x) > P[q].d + 1e-7) { ok = false; break; }
      if (ok) { const v = dot3(F.v, x) - vo; if (v < lo) lo = v; if (v > hi) hi = v; } } }
  return lo <= hi ? [lo, hi] : null;
}
function nearestEdge(w, tol) {
  if (!(model && model.outer)) return null; let best = null;
  for (const g of model.outer.segs) {
    if (g.t !== 'line') continue;
    const dx = g.x2 - g.x1, dy = g.y2 - g.y1, L2 = dx * dx + dy * dy; if (L2 < 1e-12) continue;
    const u = Math.max(0, Math.min(1, ((w.x - g.x1) * dx + (w.y - g.y1) * dy) / L2)), d = hyp(w.x - (g.x1 + u * dx), w.y - (g.y1 + u * dy));
    if (d < tol && (!best || d < best.d)) best = { g, d };
  }
  return best;
}
function flatButton() {
  if (!(model && model.outer)) { toast(faceFeat() ? (model && model.err) || 'The outline is not closed' : 'No sheet metal yet — tap Face first'); return; }
  if (mode === 'flat') { setMode('model'); return; }
  endFlPick(); closeFlPanel(); $('#toast').classList.remove('on'); setMode('flat');
}
function flangeButton() {
  if (!faceFeat()) { toast('Create a Face first — then pick an edge'); return; }
  if (part.t > 1) { toast('Flanges are blocked above 1 in thickness (bending limit)'); return; }
  if (flPick) { endFlPick(); return; }
  if (cutSel) cancelCut(); endCrPick(); finishPoly(); closePop(); sel = [];
  flPick = true; tool = { name: 'flange', step: 0 }; refresh(); toast('Tap the line on an edge: the top line bends up, the bottom line bends down');
}
function endFlPick() { if (!flPick) return; flPick = false; flHover = null; if (tool.name === 'flange') tool = { name: 'select', step: 0 }; G3.rebuild = true; dirty3 = true; refresh(); }
function flangeTap(w, tol) { const h = nearestEdge(w, tol); flangeHit(h ? { g: h.g } : null); }
function flangeHit(hit) {
  if (!flPick) return;
  if (!hit) { toast('Tap right on the line along an edge of the sheet or of a flange'); return; }
  const r = (part.rule.rm || 1) * part.t, need = (r + part.t) * Math.tan(PI / 4), len = Math.max(1, +(need * 2).toFixed(4));
  let f;
  if (hit.tip) {
    const ex = model.flanges.find(x => x.f.parent === hit.tip.f.id && (x.f.pe || 'tip') === hit.edge); if (ex) { flangePanel(ex.f); return; }
    f = { id: 'f' + (part.nf++), type: 'flange', name: nextName('flange', 'Flange'), parent: hit.tip.f.id, pe: hit.edge, ang: 90, len, ref: 'out', side: hit.side || 'up' };
  } else {
    const ex = model.flanges && model.flanges.find(x => x.g === hit.g); if (ex) { flangePanel(ex.f); return; }
    const fr = edgeFrame(hit.g, model.outer);
    f = { id: 'f' + (part.nf++), type: 'flange', name: nextName('flange', 'Flange'), e: { mx: fr.mx, my: fr.my, nx: fr.ux, ny: fr.uy }, ang: 90, len, ref: 'out', side: hit.side || 'up' };
  }
  part.feats.push(f); flHover = null; commitPart(); flangePanel(f);
}
function closeFlPanel() { const p = document.querySelector('#flpanel'); if (p) p.remove(); flActive = null; G3.rebuild = true; dirty3 = true; }
function flangePanel(f) {
  closeFlPanel(); flActive = f.id;
  const note = el('div', { class: 'note' });
  const paintNote = () => { const c = flangeCalc(f), w = model && model.warn ? model.warn.filter(x => x.startsWith(f.name + ':')) : [];
    note.style.color = c.err || w.length ? 'var(--danger)' : ''; note.textContent = c.err ? c.err : w.length ? w[0].slice(f.name.length + 2) : 'Flat blank grows ' + fmt(+c.D.toFixed(4)) + ' in (bend allowance ' + fmt(+c.BA.toFixed(4)) + ', flat leg ' + fmt(+c.Lf.toFixed(4)) + ')' + (() => { const r = model && model.flanges && model.flanges.find(x => x.f === f); return r && r.trim ? ' · trimmed ' + fmt(+r.trim.amt.toFixed(4)) + ' in to clear ' + r.trim.by.join(', ') : ''; })(); };
  const preview = () => { buildModel(); G3.rebuild = true; dirty3 = true; updateInfo(); paintNote(); };
  const num = (label, get, set, parse, unit) => { const inp = el('input', { type: 'text', inputmode: 'decimal', value: fmt(get()), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    inp.addEventListener('focus', () => { try { inp.select(); } catch (e) {} });
    inp.addEventListener('input', () => { const v = parse(inp.value); if (v >= 0 && isFinite(v)) { set(v); preview(); } });
    inp.addEventListener('change', () => { const v = parse(inp.value); if (!(v >= 0 && isFinite(v))) { inp.value = fmt(get()); return; } set(v); commitPart(); paintNote(); });
    return el('div', { class: 'ff' }, el('label', {}, label + (unit ? ' (' + unit + ')' : '')), inp); };
  const seg = (label, opts, get, set) => el('div', { class: 'seg' }, el('label', {}, label), el('div', { class: 'sb' }, ...opts.map(([k, t]) => el('button', { class: get() === k ? 'on' : '', onclick: () => { set(k); commitPart(); flangePanel(f); } }, t))));
  const more = el('div', { class: 'more', style: 'display:none' },
    el('div', { class: 'two' }, num('Bend radius', () => flR(f), v => { f.r = v; }, parseLen, 'in'), num('K-factor', () => flK(f), v => { f.k = v; }, parseFloat)),
    el('div', { class: 'note' }, 'Radius defaults to the thickness and K to 0.44 (Inventor values). Changing them here only affects this flange.'));
  const panel = el('div', { id: 'flpanel' },
    el('div', { class: 'hd' }, el('b', {}, f.name + (f.parent && feat(f.parent) ? '  on ' + feat(f.parent).name + ({ s0: ' (side)', s1: ' (side)' }[f.pe] || ' (end)') : '')), el('button', { class: 'x', title: 'Close', onclick: closeFlPanel }, '✕')),
    el('div', { class: 'two' }, num('Distance', () => f.len, v => { f.len = v; }, parseLen, 'in'), num('Angle', () => f.ang == null ? 90 : f.ang, v => { f.ang = v; }, parseFloat, '°')),
    seg('Distance measured to', [['out', 'Outside'], ['in', 'Inside'], ['tan', 'Flat leg']], () => f.ref || 'out', v => { f.ref = v; }),
    seg('Bend direction', [['up', 'Up'], ['down', 'Down']], () => f.side || 'up', v => { f.side = v; }),
    num('Gap to other flanges (auto trim)', () => flGap(f), v => { f.gap = v; }, parseLen, 'in'),
    el('button', { class: 'lnk', onclick: ev => { const o = more.style.display === 'none'; more.style.display = o ? '' : 'none'; ev.target.textContent = o ? 'Less ▴' : 'More ▾'; } }, 'More ▾'), more, note,
    el('div', { class: 'btnrow' },
      el('button', { class: 'pri', onclick: closeFlPanel }, 'Done'),
      el('button', { onclick: () => { if (f.off) delete f.off; else f.off = true; commitPart(); flangePanel(f); } }, f.off ? 'Unsuppress' : 'Suppress'),
      el('button', { style: 'color:var(--danger)', onclick: () => { const gone = new Set([f.id]); for (let ch = true; ch;) { ch = false; for (const x of part.feats) if (x.type === 'flange' && x.parent && gone.has(x.parent) && !gone.has(x.id)) { gone.add(x.id); ch = true; } } part.feats = part.feats.filter(x => !gone.has(x.id)); closeFlPanel(); commitPart(); toast(gone.size > 1 ? 'Flange and the ' + (gone.size - 1) + ' on its end deleted' : 'Flange deleted'); } }, 'Delete')));
  $('#stage').append(panel); paintNote();
}



// ---------------------------------------------------------------- contour flange: an open profile of straight lines, given thickness and a width; bends are added at every corner
// f = { type:'contour', sk, len (width of the part), flip?, r?, k? }. The profile is the side view; the part is pulled straight up from the sketch.
const contourFeat = () => part.feats.find(f => f.type === 'contour');
function openChain(gs) {
  if (gs.some(g => g.t !== 'line')) return { err: 'Contour Flange profiles use straight lines only for now — the bends are added for you at each corner' };
  const L = gs.filter(g => hyp(g.x2 - g.x1, g.y2 - g.y1) > 1e-6), map = new Map();
  L.forEach((g, i) => gEnds(g).forEach(([x, y]) => { const k = KEY(x, y); if (!map.has(k)) map.set(k, { x, y, segs: [] }); map.get(k).segs.push(i); }));
  const seen = new Set(); let best = null;
  for (const [k0, n0] of map) { if (n0.segs.length !== 1 || seen.has(k0)) continue;
    const pts = [[n0.x, n0.y]]; let k = k0, si = n0.segs[0], len = 0, ok = true; seen.add(k0);
    for (;;) { const e = gEnds(L[si]), k1 = KEY(e[0][0], e[0][1]) === k ? KEY(e[1][0], e[1][1]) : KEY(e[0][0], e[0][1]), nd = map.get(k1); pts.push([nd.x, nd.y]); len += hyp(L[si].x2 - L[si].x1, L[si].y2 - L[si].y1); k = k1; seen.add(k);
      if (nd.segs.length === 1) break; if (nd.segs.length !== 2) { ok = false; break; } si = nd.segs[0] === si ? nd.segs[1] : nd.segs[0]; }
    if (ok && (!best || len > best.len)) best = { pts, len }; }
  return best || { err: L.length ? 'Contour Flange needs an OPEN profile (like an L, Z or hat shape). For a closed outline use Face.' : 'Draw the side profile with the Line tool first, then tap Contour Flange' };
}
function contourCalc(f) {
  const sk = feat(f.sk); if (!sk) return { err: 'its sketch is gone' };
  const ch = openChain(sketchGeoms(sk)); if (ch.err) return ch;
  const P = [ch.pts[0]]; for (let i = 1; i < ch.pts.length; i++) { const a = P[P.length - 1], b = ch.pts[i], c = ch.pts[i + 1]; if (c && Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-6 * hyp(b[0] - a[0], b[1] - a[1]) * hyp(c[0] - b[0], c[1] - b[1])) continue; P.push(b); }
  const t = part.t, r = f.r != null ? f.r : (part.rule.rm || 1) * t, K = f.k != null ? f.k : part.rule.k, sg = f.flip ? -1 : 1, n = P.length - 1, d = [], Ls = [];
  for (let i = 0; i < n; i++) { const l = hyp(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); Ls.push(l); d.push([(P[i + 1][0] - P[i][0]) / l, (P[i + 1][1] - P[i][1]) / l]); }
  const bends = [];
  for (let i = 1; i < n; i++) { const cr = d[i - 1][0] * d[i][1] - d[i - 1][1] * d[i][0], phi = Math.atan2(Math.abs(cr), d[i - 1][0] * d[i][0] + d[i - 1][1] * d[i][1]); if (phi > PI * 0.985) return { err: 'the profile folds flat back on itself' };
    const left = cr > 0, toward = (left ? 1 : -1) === sg, Rs = toward ? r + t : r; bends.push({ i, phi, left, toward, Rs, Ro: toward ? r : r + t, tr: Rs * Math.tan(phi / 2) }); }
  const str = Ls.map((l, i) => l - (i > 0 ? bends[i - 1].tr : 0) - (i < n - 1 ? bends[i].tr : 0)); if (str.some(x => x < -1e-6)) return { err: 'a leg of the profile is too short for its bends — make it longer or use a smaller bend radius' };
  const nr = i => [-d[i][1] * sg, d[i][0] * sg], A = [P[0]], B = [[P[0][0] + nr(0)[0] * t, P[0][1] + nr(0)[1] * t]];
  for (const b of bends) { const V = P[b.i], d0 = d[b.i - 1], T1 = [V[0] - d0[0] * b.tr, V[1] - d0[1] * b.tr], tn = b.left ? [-d0[1], d0[0]] : [d0[1], -d0[0]], C = [T1[0] + tn[0] * b.Rs, T1[1] + tn[1] * b.Rs], a0 = Math.atan2(T1[1] - C[1], T1[0] - C[0]), m = Math.max(3, Math.ceil(b.phi / (PI / 24)));
    for (let k = 0; k <= m; k++) { const a = a0 + (b.left ? 1 : -1) * b.phi * k / m; A.push([C[0] + b.Rs * Math.cos(a), C[1] + b.Rs * Math.sin(a)]); B.push([C[0] + b.Ro * Math.cos(a), C[1] + b.Ro * Math.sin(a)]); } }
  A.push(P[n]); B.push([P[n][0] + nr(n - 1)[0] * t, P[n][1] + nr(n - 1)[1] * t]);
  let x = 0; const lines = []; for (let i = 0; i < n; i++) { x += Math.max(0, str[i]); if (i < n - 1) { const BA = bends[i].phi * (r + K * t); lines.push({ x: x + BA / 2, b: bends[i] }); x += BA; } }
  return { poly: A.concat(B.reverse()), dev: x, lines, r, K, nb: bends.length };
}
function buildContour(cf) {
  if (!part.t) return; const c = contourCalc(cf); if (c.err) { model = { err: cf.name + ': ' + c.err, warn: [cf.name + ': ' + c.err] }; return; }
  const W = cf.len, segs = [ln([0, 0], [c.dev, 0]), ln([c.dev, 0], [c.dev, W]), ln([c.dev, W], [0, W]), ln([0, W], [0, 0])], outer = mkLoop(segs, [[0, 0], [c.dev, 0], [c.dev, W], [0, W]]);
  const lb = (settings.layBend || 'IV_BEND'), lbd = (settings.layBendDown || 'IV_BEND_DOWN'), xs = c.poly.map(p => p[0]), ys = c.poly.map(p => p[1]);
  const bends = c.lines.map(l => ({ t: 'line', x1: l.x, y1: 0, x2: l.x, y2: W, lay: l.b.toward ? lb : lbd, info: { ang: +(l.b.phi * 180 / PI).toFixed(2), r: c.r, down: !l.b.toward, name: cf.name } }));
  model = { contour: { poly: c.poly, len: W, bb: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } }, base: null, outer, holes: [], warn: [], bb: outer.bb, area: c.dev * W, flanges: [], bends, flatSegs: segs };
}
function contourButton() {
  const cf = contourFeat(); if (cf) { featTap(cf); return; }
  if (faceFeat()) { toast('This part starts from a Face. Contour Flange starts a new part from an open profile — use Edge Flange on this one.'); return; }
  finishPoly(); closePop(); const ch = openChain(sketchGeoms(feat(actId))); if (ch.err) { toast(ch.err); return; }
  thicknessDialog(t => {
    const t0 = part.t, tl0 = part.tl, f = { id: 'f' + part.nf, type: 'contour', name: 'Contour1', sk: actId, len: 4 };
    part.t = t.v; part.tl = t.label; const c = contourCalc(f); if (c.err) { part.t = t0; part.tl = tl0; toast('Contour Flange: ' + c.err); return; }
    part.nf++; part.feats.push(f); feat(actId).vis = false; tool = { name: 'select', step: 0 }; sel = []; G3.fitNext = true; commitPart(); setMode('model'); contourPanel(f);
  });
}
function contourPanel(f) {
  closeFlPanel(); flActive = f.id;
  const note = el('div', { class: 'note' });
  const paint = () => { const c = contourCalc(f); note.style.color = c.err ? 'var(--danger)' : ''; note.textContent = c.err ? c.err : 'Flat blank ' + fmt(+c.dev.toFixed(4)) + ' × ' + fmt(f.len) + ' in · ' + c.nb + ' bend' + (c.nb === 1 ? '' : 's') + '. Edit the sketch to change the profile.'; };
  const preview = () => { buildModel(); G3.rebuild = true; dirty3 = true; updateInfo(); paint(); };
  const num = (label, get, set, parse, unit, min) => { const inp = el('input', { type: 'text', inputmode: 'decimal', value: fmt(get()), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    inp.addEventListener('focus', () => { try { inp.select(); } catch (e) {} });
    inp.addEventListener('input', () => { const v = parse(inp.value); if (v >= min && isFinite(v)) { set(v); preview(); } });
    inp.addEventListener('change', () => { const v = parse(inp.value); if (!(v >= min && isFinite(v))) { inp.value = fmt(get()); return; } set(v); G3.fitNext = true; commitPart(); paint(); });
    return el('div', { class: 'ff' }, el('label', {}, label + (unit ? ' (' + unit + ')' : '')), inp); };
  const panel = el('div', { id: 'flpanel' },
    el('div', { class: 'hd' }, el('b', {}, f.name), el('button', { class: 'x', title: 'Close', onclick: closeFlPanel }, '✕')),
    num('Width (how far the profile is pulled)', () => f.len, v => { f.len = v; }, parseLen, 'in', 0.01),
    el('div', { class: 'seg' }, el('label', {}, 'Thickness goes on'), el('div', { class: 'sb' }, ...[[false, 'Side A'], [true, 'Side B']].map(([k, tx]) => el('button', { class: !!f.flip === k ? 'on' : '', onclick: () => { if (k) f.flip = true; else delete f.flip; commitPart(); contourPanel(f); } }, tx)))),
    el('div', { class: 'two' }, num('Bend radius', () => f.r != null ? f.r : (part.rule.rm || 1) * part.t, v => { f.r = v; }, parseLen, 'in', 0), num('K-factor', () => f.k != null ? f.k : part.rule.k, v => { f.k = v; }, parseFloat, '', 0)), note,
    el('div', { class: 'btnrow' },
      el('button', { class: 'pri', onclick: closeFlPanel }, 'Done'),
      el('button', { onclick: () => { closeFlPanel(); activate(f.sk); setMode('sketch'); } }, 'Edit sketch'),
      el('button', { style: 'color:var(--danger)', onclick: () => { const sk = feat(f.sk); part.feats = part.feats.filter(x => x !== f); if (sk) delete sk.vis; closeFlPanel(); commitPart(); setMode('sketch'); toast('Contour flange removed'); } }, 'Delete')));
  $('#stage').append(panel); paint();
}

// ---------------------------------------------------------------- corner round / chamfer on the part outline
// f = { type:'corner', kind:'round'|'chamfer', pt:{x,y} (picked outline corner), size, off? }. Applied to the base outline before cuts and flanges.
function cornerVerts(outer) {            // every place two consecutive straight edges of the outline meet
  const sg = outer.segs, n = sg.length, out = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = sg[i], b = sg[j]; if (a.t !== 'line' || b.t !== 'line') continue;
    for (const [x, y] of gEnds(a)) for (const [x2, y2] of gEnds(b)) if (hyp(x - x2, y - y2) < 1e-5) {
      if (out.some(o => hyp(o.x - x, o.y - y) < 1e-5)) continue;
      const cnt = sg.filter(g => gEnds(g).some(e => hyp(e[0] - x, e[1] - y) < 1e-5)).length; if (cnt === 2) out.push({ x, y, segs: [a, b] });
    }
  }
  return out;
}
function applyCorners(outer, warn) {
  const todo = part.feats.filter(f => f.type === 'corner' && !f.off); if (!todo.length) return outer;
  const verts = cornerVerts(outer); let segs = outer.segs.slice(); const cur = new Map(); const now = g => cur.get(g) || g;
  const endAway = (g, V) => { const e = gEnds(g); return hyp(e[0][0] - V.x, e[0][1] - V.y) < 1e-6 ? e[1] : e[0]; };
  const moveEnd = (g, V, q) => { const e = gEnds(g), a = hyp(e[0][0] - V.x, e[0][1] - V.y) < 1e-6; return a ? { t: 'line', x1: q[0], y1: q[1], x2: e[1][0], y2: e[1][1] } : { t: 'line', x1: e[0][0], y1: e[0][1], x2: q[0], y2: q[1] }; };
  for (const f of todo) {
    let V = null, bd = 1e9; for (const v of verts) { const d = hyp(v.x - f.pt.x, v.y - f.pt.y); if (d < bd) { bd = d; V = v; } }
    if (!V) { warn.push(f.name + ': no corner found'); continue; }
    const [ga, gb] = V.segs, ca = now(ga), cb = now(gb), A = endAway(ca, V), B = endAway(cb, V);
    const la = hyp(A[0] - V.x, A[1] - V.y), lb = hyp(B[0] - V.x, B[1] - V.y), ua = [(A[0] - V.x) / la, (A[1] - V.y) / la], ub = [(B[0] - V.x) / lb, (B[1] - V.y) / lb];
    const cs = ua[0] * ub[0] + ua[1] * ub[1]; if (Math.abs(cs) > 0.9999) { warn.push(f.name + ': that corner is flat'); continue; }
    const half = Math.acos(cs) / 2, r = f.size, t = f.kind === 'chamfer' ? r : r / Math.tan(half);
    if (!(r > 1e-4) || t > 0.49 * Math.min(la, lb)) { warn.push(f.name + ': too big for the edges at this corner'); continue; }
    const T1 = [V.x + ua[0] * t, V.y + ua[1] * t], T2 = [V.x + ub[0] * t, V.y + ub[1] * t];
    const na = moveEnd(ca, V, T1), nb = moveEnd(cb, V, T2); segs[segs.indexOf(ca)] = na; segs[segs.indexOf(cb)] = nb; cur.set(ga, na); cur.set(gb, nb);
    if (f.kind === 'chamfer') segs.push({ t: 'line', x1: T1[0], y1: T1[1], x2: T2[0], y2: T2[1] });
    else {
      const bx = ua[0] + ub[0], by = ua[1] + ub[1], bl = hyp(bx, by), dc = r / Math.sin(half), C = [V.x + bx / bl * dc, V.y + by / bl * dc];
      const ccw = (T1[0] - C[0]) * (T2[1] - C[1]) - (T1[1] - C[1]) * (T2[0] - C[0]) > 0, p = ccw ? T1 : T2, q = ccw ? T2 : T1;
      const sa = Math.atan2(p[1] - C[1], p[0] - C[0]); let ea = Math.atan2(q[1] - C[1], q[0] - C[0]); while (ea <= sa + 1e-9) ea += TAU;
      segs.push({ t: 'arc', cx: C[0], cy: C[1], r, sa, ea });
    }
  }
  const lp = findLoops(segs).loops.sort((a, b) => b.area - a.area)[0];
  if (!lp) { warn.push('Corner features could not be applied'); return outer; }
  return lp;
}
function nearestCorner(px, py, tolPx) {     // nearest outline corner to a screen point, checked at the top face and bottom face
  if (!(model && model.base)) return null; const T = window.THREE; let best = null;
  for (const v of cornerVerts(model.base)) for (const z of [part.t, 0]) {
    const p = new T.Vector3(v.x, v.y, z).project(G3.cam), sx = (p.x + 1) / 2 * CW, sy = (1 - p.y) / 2 * CH, d = hyp(sx - px, sy - py);
    if (d < tolPx && (!best || d < best.d)) best = { v, d };
  }
  return best;
}
function cornerButton(kind) {
  if (!faceFeat()) { toast('Create a Face first — then pick a corner'); return; }
  if (crPick === kind) { endCrPick(); return; }
  endFlPick(); if (cutSel) cancelCut(); closeFlPanel(); finishPoly(); closePop(); sel = [];
  if (mode !== 'model') setMode('model');
  crPick = kind; tool = { name: 'corner', step: 0 }; refresh(); toast('Tap a corner of the sheet to ' + (kind === 'round' ? 'round' : 'chamfer') + ' it');
}
function endCrPick() { if (!crPick) return; crPick = null; crHover = null; if (tool.name === 'corner') tool = { name: 'select', step: 0 }; G3.rebuild = true; dirty3 = true; refresh(); }
function cornerHit(v) {
  if (!crPick) return;
  if (!v) { toast('Tap right on a corner where two straight edges meet'); return; }
  const ex = part.feats.find(f => f.type === 'corner' && hyp(f.pt.x - v.x, f.pt.y - v.y) < 0.05); if (ex) { cornerPanel(ex); return; }
  const la = hyp(v.segs[0].x2 - v.segs[0].x1, v.segs[0].y2 - v.segs[0].y1), lb = hyp(v.segs[1].x2 - v.segs[1].x1, v.segs[1].y2 - v.segs[1].y1);
  const f = { id: 'f' + (part.nf++), type: 'corner', name: nextName('corner', 'Corner'), kind: crPick, pt: { x: v.x, y: v.y }, size: +Math.min(0.25, 0.3 * Math.min(la, lb)).toFixed(4) };
  part.feats.push(f); crHover = null; commitPart(); cornerPanel(f);
}
function cornerPanel(f) {
  closeFlPanel(); flActive = f.id;
  const note = el('div', { class: 'note' });
  const paint = () => { const w = model && model.warn ? model.warn.filter(x => x.startsWith(f.name + ':')) : []; note.style.color = w.length ? 'var(--danger)' : ''; note.textContent = w.length ? w[0].slice(f.name.length + 2) : (f.kind === 'chamfer' ? 'Both legs of the chamfer are this long.' : 'Radius of the rounded corner.'); };
  const inp = el('input', { type: 'text', inputmode: 'decimal', value: fmt(f.size), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  inp.addEventListener('focus', () => { try { inp.select(); } catch (e) {} });
  inp.addEventListener('input', () => { const v = parseLen(inp.value); if (v > 0 && isFinite(v)) { f.size = v; buildModel(); G3.rebuild = true; dirty3 = true; updateInfo(); paint(); } });
  inp.addEventListener('change', () => { const v = parseLen(inp.value); if (!(v > 0 && isFinite(v))) { inp.value = fmt(f.size); return; } f.size = v; commitPart(); paint(); });
  const kinds = el('div', { class: 'sb' }, ...[['round', 'Round'], ['chamfer', 'Chamfer']].map(([k, t]) => el('button', { class: f.kind === k ? 'on' : '', onclick: () => { f.kind = k; commitPart(); cornerPanel(f); } }, t)));
  const panel = el('div', { id: 'flpanel' },
    el('div', { class: 'hd' }, el('b', {}, f.name), el('button', { class: 'x', title: 'Close', onclick: closeFlPanel }, '✕')),
    el('div', { class: 'seg' }, el('label', {}, 'Corner type'), kinds),
    el('div', { class: 'ff' }, el('label', {}, (f.kind === 'chamfer' ? 'Size' : 'Radius') + ' (in)'), inp), note,
    el('div', { class: 'btnrow' },
      el('button', { class: 'pri', onclick: closeFlPanel }, 'Done'),
      el('button', { onclick: () => { if (f.off) delete f.off; else f.off = true; commitPart(); cornerPanel(f); } }, f.off ? 'Unsuppress' : 'Suppress'),
      el('button', { style: 'color:var(--danger)', onclick: () => { part.feats = part.feats.filter(x => x !== f); closeFlPanel(); commitPart(); toast('Corner removed'); } }, 'Delete')));
  $('#stage').append(panel); paint();
}

// ---------------------------------------------------------------- projected edges (outline shown in later sketches)
function syncProj(srcFeat) {       // operates on S
  const src = srcFeat.sk, pmap = {}, have = new Set(), mx = skMir(S);
  for (const id in S.pts) { const p = S.pts[id]; if (!p.proj) continue; const q = p.proj[0] === srcFeat.id && src.pts[p.proj[1]]; if (q) { p.x = q.x * mx; p.y = q.y; pmap[p.proj[1]] = id; } }
  pmap.p0 = 'p0';
  for (const id in S.ents) {
    const e = S.ents[id]; if (!e.proj) continue; const q = e.proj[0] === srcFeat.id && src.ents[e.proj[1]];
    if (!q || q.con) { delete S.ents[id]; continue; }
    if (e.t === 'circle') e.r = q.r; have.add(e.proj[1]);
  }
  const pp = pid => { if (pmap[pid]) return pmap[pid]; const id = nid('p'), q = src.pts[pid]; S.pts[id] = { x: q.x * mx, y: q.y, fixed: true, proj: [srcFeat.id, pid] }; return (pmap[pid] = id); };
  for (const eid in src.ents) {
    const e = src.ents[eid]; if (e.con || have.has(eid)) continue;
    const o = { t: e.t, con: true, proj: [srcFeat.id, eid] }; for (const k of ['a', 'b', 'c']) if (e[k]) o[k] = pp(e[k]); if (e.t === 'circle') o.r = e.r;
    S.ents[nid('e')] = o;
  }
}
// Bring every later sketch in line with the outline, then rebuild the model.
const skFl = f => f && f.plane && f.plane.fl;                       // id of the flange a sketch sits on
const planeKey = f => skFl(f) ? 'fl' + f.plane.fl : 'base';
function syncFlProj(W, L) {       // operates on S: the flange's flat leg as a fixed yellow rectangle (origin = bend end, start side)
  const C = [[0, 0], [W, 0], [W, L], [0, L]], ids = [];
  for (let k = 0; k < 4; k++) { let id = Object.keys(S.pts).find(q => S.pts[q].proj && S.pts[q].proj[0] === '@fl' && S.pts[q].proj[1] === k);
    if (k === 0) { id = 'p0'; } else if (!id) { id = nid('p'); S.pts[id] = { x: 0, y: 0, fixed: true, proj: ['@fl', k] }; }
    S.pts[id].x = C[k][0]; S.pts[id].y = C[k][1]; ids.push(id); }
  for (let k = 0; k < 4; k++) if (!Object.values(S.ents).some(e => e.proj && e.proj[0] === '@fl' && e.proj[1] === k)) S.ents[nid('e')] = { t: 'line', a: ids[k], b: ids[(k + 1) % 4], con: true, proj: ['@fl', k] };
}
function regen() {
  const face = faceFeat(), src = face && feat(face.sk);
  if (src) for (const f of part.feats) if (f.type === 'sketch' && f.id !== src.id && !skFl(f)) withSketch(f.sk, () => { syncProj(src); gc(); solve(); if (f.id === actId) lastNid = S.nid; });
  if (src && actId !== src.id) { lastNid = S.nid; solve(); }
  buildModel(); let again = false;
  for (const f of part.feats) { if (f.type !== 'sketch' || !skFl(f)) continue; const rec = model && model.flanges && model.flanges.find(x => x.f.id === f.plane.fl); if (!rec) continue;
    withSketch(f.sk, () => { syncFlProj(rec.W, rec.c.Lf); solve(); if (f.id === actId) lastNid = S.nid; }); if (f.id === actId) { lastNid = S.nid; } again = true; }
  if (again) buildModel();
  dirty3 = true; G3.rebuild = true;
}

// ---------------------------------------------------------------- feature commands
const nextName = (type, base) => base + (part.feats.filter(f => f.type === type).length + 1);
function activate(id) { finishPoly(); closePop(); sel = []; actId = id; S = feat(id).sk; lastNid = S.nid; tool = { name: 'select', step: 0 }; cur = null; solve(); }
function setMode(m) {
  finishPoly(); closePop(); sel = [];
  if (m === 'model') { init3D(); if (!G3.ok) { toast('3D view is not available in this browser — the flat pattern still works'); } }
  mode = m; ribTab = m === 'model' || m === 'flat' ? 'sm' : 'sketch'; if (m === 'sketch' && tool.name === 'face') tool = { name: 'select', step: 0 };
  $('#stage').classList.toggle('model', m === 'model'); $('#stage').classList.toggle('flat', m === 'flat');
  buildRibbon(); resize(); if (m === 'sketch') fit(); if (m === 'flat') fitFlat(); dirty3 = true; refresh(); updateInfo();
}
function faceButton() {
  if (faceFeat()) { thicknessDialog(t => { part.t = t.v; part.tl = t.label; commitPart(); updateInfo(); }); return; }
  if (contourFeat()) { toast('This part is built from a Contour Flange — a Face cannot be added to it'); return; }
  if (mode === 'model') setMode('sketch');
  ribTab = 'sm'; tool = { name: 'face', step: 0 }; buildRibbon(); refresh(); toast('Tap inside the closed outline');
}
function facePick(w) {
  const { loops } = findLoops(exportGeoms());
  const hit = loops.filter(l => pointInPoly(w.x, w.y, l.poly));
  if (!hit.length) { toast(loops.length ? 'Tap inside the outline' : 'No closed outline yet — close the shape first (snap the last point to the first)'); return; }
  thicknessDialog(t => {
    part.t = t.v; part.tl = t.label; part.feats.push({ id: 'f' + (part.nf++), type: 'face', name: 'Face1', sk: actId, pt: { x: w.x, y: w.y } }); feat(actId).vis = false;
    tool = { name: 'select', step: 0 }; G3.fitNext = true; commitPart(); setMode('model');
  });
}
let lastFaceTap = null;
let selFace = null;     // 'top' | 'bot' : the sheet face highlighted in 3D, waiting for New Sketch
function setSelFace(v) { selFace = v; G3.rebuild = true; dirty3 = true; refresh(); }
function screenToPlane(px, py, z) {
  const T = window.THREE, rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(px / CW * 2 - 1, -(py / CH) * 2 + 1), G3.cam);
  const out = new T.Vector3(); return rc.ray.intersectPlane(new T.Plane(new T.Vector3(0, 0, 1), -z), out) ? { x: out.x, y: out.y } : null;
}
function hit3(px, py) {            // what is under the finger in 3D: { plate, face:'top'|'bot', x, y } or { fl: flange record, x, y (flat-leg coordinates) }
  if (!(model && model.outer && G3.ok)) return null; const T = window.THREE, rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(px / CW * 2 - 1, -(py / CH) * 2 + 1), G3.cam);
  const hits = rc.intersectObjects(G3.grp.children.filter(o => o.userData && o.userData.pk), false); if (!hits.length) return null;
  const h = hits[0], p = h.point, ud = h.object.userData, t = part.t, e = Math.max(1e-3, t * 0.02);
  if (ud.pk === 'plate') return { plate: true, face: Math.abs(p.z - t) < e ? 'top' : Math.abs(p.z) < e ? 'bot' : null, x: p.x, y: p.y };
  const rec = model.flanges.find(x => x.f.id === ud.pk); if (!rec) return null; const L0 = rec.tip.leg0, d = [p.x - L0[0], p.y - L0[1], p.z - L0[2]], y = dot3(d, rec.tip.u), nn = dot3(d, rec.tip.n);
  return y >= -e && y <= rec.c.Lf + e && (Math.abs(nn) < e || Math.abs(nn - t) < e) ? { fl: rec, x: dot3(d, rec.tip.v), y } : { edge: true };
}
const selKey = v => !v ? '' : v.fl ? 'fl' + v.fl : v;
function facePick3(px, py) {
  if (!(model && model.outer && !model.contour)) return; const h = hit3(px, py);
  const v = h && h.fl ? { fl: h.fl.f.id } : h && h.plate && h.face ? h.face : null;
  if (!v) { if (selFace) setSelFace(null); return; }
  if (selKey(v) === selKey(selFace)) { setSelFace(null); return; }
  setSelFace(v); toast((v.fl ? feat(v.fl).name + ' face' : v === 'top' ? 'Top face' : 'Bottom face') + ' selected — tap New Sketch');
}
function newSketchOnFace() {
  const face = faceFeat(); if (!face) { toast('Create a Face first — then New Sketch puts a sketch on it'); return; }
  if (mode === 'model' && !selFace) { toast('Tap the face you want to sketch on (it turns orange), then tap New Sketch'); return; }
  const f = { id: 'f' + (part.nf++), type: 'sketch', name: nextName('sketch', 'Sketch'), sk: newSketch() }; if (selFace === 'bot') f.plane = 'bot'; else if (selFace && selFace.fl) f.plane = { fl: selFace.fl };
  selFace = null; part.feats.push(f); activate(f.id); regen(); pushHist();
  const done = () => { setMode('sketch'); toast('Sketch on ' + (skFl(f) ? feat(f.plane.fl).name : f.plane ? 'the bottom face' : 'the top face') + ' — the part stays visible behind your sketch. Draw the cutouts, then tap Cut.'); };
  const fr = typeof planeFrame === 'function' && planeFrame(f);
  if (fr && mode === 'model') swingTo(fr, done); else done();
}
const sketchUsed = f => part.feats.some(x => (x.type === 'face' || x.type === 'cut' || x.type === 'contour') && x.sk === f.id);
const sketchVis = f => f.vis !== undefined ? f.vis : !sketchUsed(f);      // shown until a feature uses it, unless toggled
function sketchGeoms(f) { return toModelGs(f.sk, withSketch(f.sk, () => { const out = []; for (const id in S.ents) { const e = S.ents[id]; if (!e.con && !e.proj) out.push(entG(e)); } for (const id in S.pats) out.push(...patGeoms(S.pats[id], false)); return out; })); }
// Cut = pick the closed shapes to remove, then Apply. Works from the sketch view or the 3D view.
const cutCands = () => { const face = faceFeat(); return part.feats.filter(f => f.type === 'sketch' && f.id !== face.sk && true); };
const smallestAt = (sk, pt) => cutRegions(sk).filter(l => pointInPoly(pt.x, pt.y, l.poly)).sort((a, b) => a.area - b.area)[0];
const sameLoop = (a, b) => a && b && Math.abs(a.area - b.area) < 1e-9 && Math.abs(a.bb.x0 - b.bb.x0) < 1e-9 && Math.abs(a.bb.y0 - b.bb.y0) < 1e-9;
function cutBar() {
  let bar = document.querySelector('#cutbar');
  if (!cutSel) { if (bar) bar.remove(); return; }
  if (!bar) { bar = el('div', { id: 'cutbar' }, el('span', { class: 'n' }), el('button', { class: 'pri', onclick: () => makeCut() }, 'Apply Cut'), el('button', { onclick: () => cancelCut() }, 'Cancel')); $('#stage').append(bar); }
  const n = cutSel.sel.length; bar.querySelector('.n').textContent = n ? n + ' shape' + (n === 1 ? '' : 's') + ' selected' : 'Tap the shapes to cut';
  bar.querySelector('.pri').disabled = !n;
}
function cutRefresh() { cutSel.loops = cutSel.sel.map(e => { const f = feat(e.sk), l = f && smallestAt(f.sk, e.pt); return l && Object.assign({}, l, { pk: planeKey(f) }); }).filter(Boolean); cutBar(); G3.rebuild = true; dirty3 = true; refresh(); }
function cutTap(w, pk) {
  if (!cutSel) return;
  let best = null; if (!pk) pk = mode === 'sketch' ? planeKey(feat(actId)) : 'base';
  for (const f of cutCands().filter(f => planeKey(f) === pk)) for (const l of cutRegions(f.sk)) if (pointInPoly(w.x, w.y, l.poly) && (!best || l.area < best.l.area)) best = { f, l };
  if (!best) { const any = cutCands().length; toast(any ? 'Tap inside an enclosed area of a sketch (the hole or profile you want cut)' : 'No visible sketch to cut — draw one with New Sketch, or turn a sketch on with its eye'); return; }
  const i = cutSel.sel.findIndex(e => e.sk === best.f.id && sameLoop(smallestAt(best.f.sk, e.pt), best.l));
  if (i >= 0) cutSel.sel.splice(i, 1); else cutSel.sel.push({ sk: best.f.id, pt: { x: w.x, y: w.y } });
  cutRefresh();
}
function cancelCut() { if (!cutSel) return; cutSel = null; if (tool.name === 'cut') tool = { name: 'select', step: 0 }; cutBar(); G3.rebuild = true; dirty3 = true; refresh(); }
function makeCut() {
  const face = faceFeat(); if (!face) { toast('Create a Face first'); return; }
  if (!cutSel) {                      // 1st tap: start picking
    endFlPick(); endCrPick(); finishPoly(); closePop(); sel = []; cutSel = { sel: [], loops: [] }; tool = { name: 'cut', step: 0 };
    cutBar(); refresh(); toast('Tap each closed shape you want to cut, then Apply Cut'); return;
  }
  if (!cutSel.sel.length) { cancelCut(); return; }
  const by = {}; for (const e of cutSel.sel) (by[e.sk] = by[e.sk] || []).push(e.pt);
  const names = [];
  for (const id in by) { const sf = feat(id); if (!sf) continue; part.feats.push({ id: 'f' + (part.nf++), type: 'cut', name: nextName('cut', 'Cut'), sk: id, pick: by[id] }); sf.vis = false; names.push(sf.name); }
  const n = cutSel.sel.length; cutSel = null; tool = { name: 'select', step: 0 }; cutBar();
  commitPart(); setMode('model');
  if (model && model.warn.length) toast(model.warn[model.warn.length - 1]); else toast('Cut ' + n + ' shape' + (n === 1 ? '' : 's') + ' from ' + names.join(', '));
}
function featTap(f) {
  if (f.type === 'sketch') { activate(f.id); setMode('sketch'); return; }
  if (f.type === 'face') { faceButton(); return; }
  if (f.type === 'flange') { if (mode !== 'model') setMode('model'); flangePanel(f); return; }
  if (f.type === 'corner') { if (mode !== 'model') setMode('model'); cornerPanel(f); return; }
  if (f.type === 'contour') { if (mode !== 'model' && model && model.outer) setMode('model'); contourPanel(f); return; }
  const sk = feat(f.sk);
  modal.innerHTML = ''; modal.append(el('div', { class: 'dlg' }, el('h3', {}, f.name), el('div', { class: 'note' }, f.pick ? 'Cuts the ' + f.pick.length + ' shape' + (f.pick.length === 1 ? '' : 's') + ' you picked in ' + (sk ? sk.name : 'its sketch') + ' through the sheet.' : 'Cuts every closed shape in ' + (sk ? sk.name : 'its sketch') + ' through the sheet.'),
    el('div', { class: 'btnrow' },
      el('button', { class: 'pri', onclick: () => { closeModal(); if (sk) { activate(sk.id); setMode('sketch'); } } }, 'Edit sketch'),
      el('button', { onclick: () => { closeModal(); if (f.off) delete f.off; else f.off = true; commitPart(); updateInfo(); } }, f.off ? 'Unsuppress' : 'Suppress'),
      el('button', { style: 'color:var(--danger)', onclick: () => { closeModal(); part.feats = part.feats.filter(x => x !== f); if (sk) delete sk.vis; commitPart(); updateInfo(); } }, 'Delete cut'),
      el('button', { onclick: closeModal }, 'Close'))));
  modal.classList.add('on');
}

// ---------------------------------------------------------------- thickness picker
const GAUGES = [[20, 0.0359], [18, 0.0478], [16, 0.0598], [14, 0.0747], [12, 0.1046], [11, 0.1196], [10, 0.1345], [9, 0.148], [5, 0.208]];
const FRACS = [['1/8', 0.125], ['3/16', 0.1875], ['1/4', 0.25], ['5/16', 0.3125], ['3/8', 0.375], ['7/16', 0.4375], ['1/2', 0.5]];
function thicknessDialog(cb) {
  closePop();
  const pick = (v, label) => { closeModal(); cb({ v, label }); };
  const btn = (name, v) => el('button', { class: part.t && Math.abs(part.t - v) < 1e-6 ? 'on' : '', onclick: () => pick(v, name + ' (' + fmt(v) + ')'), html: name + '<small>' + fmt(v) + '</small>' });
  const inp = el('input', { type: 'text', inputmode: 'decimal', placeholder: 'e.g. 0.09 or 3/4 or 3mm', autocomplete: 'off' });
  const note = el('div', { class: 'note' }, 'Mild steel. Bend rule (used when flanges arrive): K-factor ' + part.rule.k + ', inside radius = thickness.');
  const use = () => { const v = parseLen(inp.value); if (!(v > 0) || v > 2) { note.textContent = 'Enter a thickness up to 2 in — decimals, fractions or mm.'; note.style.color = 'var(--danger)'; return; } pick(v, fmt(v) + ' in'); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') use(); });
  modal.innerHTML = ''; modal.append(el('div', { class: 'dlg' }, el('h3', {}, 'Sheet thickness'),
    el('label', {}, 'Gauge'), el('div', { class: 'tgrid' }, GAUGES.map(([g, v]) => btn(g + 'ga', v))),
    el('label', {}, 'Plate'), el('div', { class: 'tgrid' }, FRACS.map(([n, v]) => btn(n, v))),
    el('label', {}, 'Other thickness (in)'), el('div', { class: 'inl' }, inp, el('button', { onclick: use }, 'Use')),
    note, el('div', { class: 'btnrow' }, el('button', { onclick: closeModal }, 'Cancel'))));
  modal.classList.add('on');
}
function updateInfo() {
  const n = $('#minfo'); if (!n) return;
  if (!(model && model.outer)) { n.innerHTML = model && model.err ? model.err : ''; n.style.visibility = model && model.err ? 'visible' : 'hidden'; return; }
  n.style.visibility = 'visible'; const b = model.bb;
  n.innerHTML = `<b>${part.tl}</b> mild steel · blank <b>${fmt(b.x1 - b.x0)} × ${fmt(b.y1 - b.y0)}</b> in · ${model.holes.length} cutout${model.holes.length === 1 ? '' : 's'}${model.flanges && model.flanges.length ? ' · ' + model.flanges.length + ' flange' + (model.flanges.length === 1 ? '' : 's') : ''} · about ${fmt((model.area * part.t * 0.2836).toFixed(2))} lb`
    + (model.warn.length ? `<br><span style="color:var(--danger)">${model.warn.join('<br>')}</span>` : '');
}

// ---------------------------------------------------------------- 3D view (three.js)
function init3D() {
  if (G3.tried) return; G3.tried = true;
  try {
    const T = window.THREE, c = $('#gl');
    G3.r = new T.WebGLRenderer({ canvas: c, antialias: true });
    G3.scene = new T.Scene(); G3.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000); G3.cam.up.set(0, 0, 1);
    G3.scene.add(new T.HemisphereLight(0xffffff, 0x556070, 0.85));
    G3.sun = new T.DirectionalLight(0xffffff, 0.75); G3.scene.add(G3.sun);
    G3.grp = new T.Group(); G3.scene.add(G3.grp);
    G3.ok = true; G3.rebuild = true;
    const cube = document.querySelector('#vcube .cube'), h = 25;
    for (const [name, tf, az, elv] of [['FRONT', '', -PI / 2, 0], ['BACK', 'rotateY(180deg)', PI / 2, 0], ['RIGHT', 'rotateY(90deg)', 0, 0], ['LEFT', 'rotateY(-90deg)', PI, 0], ['TOP', 'rotateX(90deg)', -PI / 2, 1.5533], ['BTM', 'rotateX(-90deg)', -PI / 2, -1.5533]])
      cube.append(el('div', { class: 'f', style: `transform:${tf} translateZ(${h}px)`, onclick: () => { G3.az = az; G3.el = elv; dirty3 = true; } }, name));
    $('#vhome').onclick = () => { G3.az = -PI / 3; G3.el = 0.62; G3.fitNext = true; dirty3 = true; };
    const ps = new Map(); let pinch = null;
    const pos = e => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const pan = (dx, dy) => { const m = G3.cam.matrixWorld.elements, k = G3.span / CH; G3.tx -= (m[0] * dx - m[4] * dy) * k; G3.ty -= (m[1] * dx - m[5] * dy) * k; G3.tz -= (m[2] * dx - m[6] * dy) * k; };
    c.addEventListener('pointerdown', e => { e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch (_) {} const p = pos(e); ps.set(e.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y, moved: false, multi: false, pan: e.button === 1 || e.button === 2 || e.shiftKey }); if (ps.size === 1 && e.button !== 1 && e.button !== 2) { const hh = handleAt(p.x, p.y); if (hh) ps.get(e.pointerId).hd = handleStart(hh, p.x, p.y); } if (ps.size >= 2) for (const q of ps.values()) q.multi = true;
      if (ps.size === 2) { const [a, b] = [...ps.values()]; pinch = { d: hyp(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; } });
    c.addEventListener('pointermove', e => { const q = ps.get(e.pointerId); if (!q) return; const p = pos(e), dx = p.x - q.x, dy = p.y - q.y; q.x = p.x; q.y = p.y; if (hyp(p.x - q.x0, p.y - q.y0) > 6) q.moved = true;
      if (ps.size >= 2 && pinch) { const [a, b] = [...ps.values()], d = hyp(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; pan(cx - pinch.cx, cy - pinch.cy); if (pinch.d > 0 && d > 0) G3.span = Math.max(0.05, Math.min(5000, G3.span * pinch.d / d)); pinch = { d, cx, cy }; }
      else if (q.hd) handleDrag(q.hd, p.x, p.y);
      else if (q.pan) pan(dx, dy);
      else { G3.az -= dx * 0.009; G3.el = Math.max(-1.5533, Math.min(1.5533, G3.el + dy * 0.009)); }
      dirty3 = true; });
    const up = e => { const q = ps.get(e.pointerId); if (q && q.hd) { handleEnd(q.hd); ps.delete(e.pointerId); if (ps.size < 2) pinch = null; return; } if (q && e.type === 'pointerup' && !q.moved && !q.multi && ps.size === 1) { if (cutSel) { const h = hit3(q.x, q.y); if (h && h.fl) cutTap({ x: h.x, y: h.y }, 'fl' + h.fl.f.id); else { const w = h && h.plate ? h : screenToTop(q.x, q.y); if (w) cutTap({ x: w.x, y: w.y }, 'base'); } } else if (flPick) { const h = pickFlangeEdge3(q.x, q.y); if (h) flangeHit(h); else { endFlPick(); facePick3(q.x, q.y); } } else if (crPick) { const h = nearestCorner(q.x, q.y, 40); if (h) cornerHit(h.v); else { endCrPick(); facePick3(q.x, q.y); } } else { const now = Date.now(), dbl = lastFaceTap && now - lastFaceTap.t < 450 && Math.hypot(q.x - lastFaceTap.x, q.y - lastFaceTap.y) < 24; lastFaceTap = { t: now, x: q.x, y: q.y }; if (dbl && selFace) { lastFaceTap = null; newSketchOnFace(); } else facePick3(q.x, q.y); } } ps.delete(e.pointerId); if (ps.size < 2) pinch = null; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('pointermove', e => { if (crPick && !ps.size && e.pointerType !== 'touch') { const p = pos(e), h = nearestCorner(p.x, p.y, 40), k = h ? KEY(h.v.x, h.v.y) : null; if (k !== crHover) { crHover = k; G3.rebuild = true; dirty3 = true; } return; }
      if (!flPick || ps.size || e.pointerType === 'touch') return; const p = pos(e), h = pickFlangeEdge3(p.x, p.y), key = h ? h.key : null; if (key !== (flHover ? flHover.key : null)) { flHover = h ? { key, line: h.line } : null; G3.rebuild = true; dirty3 = true; } });
    c.addEventListener('wheel', e => { e.preventDefault(); G3.span = Math.max(0.05, Math.min(5000, G3.span * Math.exp(e.deltaY * 0.0015))); dirty3 = true; }, { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());
  } catch (err) { console.error(err); G3.ok = false; }
}
// ---- push / pull handles (arrows) in the 3D view
function ray3(px, py) { const T = window.THREE, rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(px / CW * 2 - 1, -(py / CH) * 2 + 1), G3.cam); return rc.ray; }
function handleAt(px, py) { const T = window.THREE; let best = null;
  for (const h of G3.handles || []) { const v = new T.Vector3(...h.grab).project(G3.cam), d = hyp((v.x + 1) / 2 * CW - px, (1 - v.y) / 2 * CH - py); if (d < 36 && (!best || d < best.d)) best = { h, d }; }
  return best ? best.h : null; }
function handleValue(h, px, py) {         // raw value under the pointer: distance along the arrow line, or the bend angle in degrees
  const r = ray3(px, py), o = [r.origin.x, r.origin.y, r.origin.z], rd = [r.direction.x, r.direction.y, r.direction.z];
  if (h.type === 'lin') { const w = [h.P[0] - o[0], h.P[1] - o[1], h.P[2] - o[2]], b = dot3(h.d, rd), dd = dot3(h.d, w), e = dot3(rd, w), den = 1 - b * b; return den < 1e-6 ? null : (b * e - dd) / den; }
  const den = dot3(rd, h.v); if (Math.abs(den) < 1e-6) return null; const k = dot3([h.O[0] - o[0], h.O[1] - o[1], h.O[2] - o[2]], h.v) / den, p = [o[0] + rd[0] * k - h.O[0], o[1] + rd[1] * k - h.O[1], o[2] + rd[2] * k - h.O[2]];
  let a = Math.atan2((h.down ? -1 : 1) * dot3(p, h.n), dot3(p, h.u)) * 180 / PI; if (a < 0) a = a < -90 ? 180 : 0; return a; }
function handleStart(h, px, py) { const s0 = handleValue(h, px, py); return s0 == null ? null : { h, s0, v0: h.get(), last: h.get() }; }
function handleDrag(st, px, py) { const s = handleValue(st.h, px, py); if (s == null) return; const h = st.h;
  let v = h.type === 'lin' ? st.v0 + (s - st.s0) : s; v = Math.round(v / h.snap) * h.snap; v = h.type === 'lin' ? Math.max(h.min, +v.toFixed(5)) : Math.max(5, Math.min(175, v));
  if (Math.abs(v - st.last) < 1e-9) return; st.last = h.set(v); buildModel(); G3.rebuild = true; dirty3 = true; updateInfo();
  const inp = document.querySelectorAll('#flpanel input')[h.inp]; if (inp) inp.value = fmt(st.last); }
function handleEnd(st) { if (Math.abs(st.last - st.v0) > 1e-9) commitPart(); st.h.done(); }
function screenToTop(px, py) {
  const T = window.THREE, rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(px / CW * 2 - 1, -(py / CH) * 2 + 1), G3.cam);
  const out = new T.Vector3(); return rc.ray.intersectPlane(new T.Plane(new T.Vector3(0, 0, 1), -part.t), out) ? { x: out.x, y: out.y } : null;
}
function rebuild3D() {
  const T = window.THREE; G3.rebuild = false;
  while (G3.grp.children.length) { const o = G3.grp.children.pop(); o.geometry.dispose(); o.material.dispose(); }
  if (!(model && model.outer)) return;
  const v2 = poly => poly.map(p => new T.Vector2(p[0], p[1]));
  const shape = new T.Shape(v2(model.contour ? model.contour.poly : model.outer.poly)); if (!model.contour) for (const h of model.holes) shape.holes.push(new T.Path(v2(h.poly)));
  const geo = new T.ExtrudeGeometry(shape, { depth: model.contour ? model.contour.len : part.t, bevelEnabled: false, curveSegments: 1 });
  const light = settings.theme === 'light';
  const legMat = (fl, dz) => new T.Matrix4().makeBasis(new T.Vector3(...fl.tip.v), new T.Vector3(...fl.tip.u), new T.Vector3(...fl.tip.n)).setPosition(...v3(fl.tip.leg0, 1, fl.tip.n, dz));
  const pm0 = new T.Mesh(geo, new T.MeshStandardMaterial({ color: light ? 0xaab4be : 0x9eabb8, metalness: 0.35, roughness: 0.55 })); if (!model.contour) pm0.userData.pk = 'plate'; G3.grp.add(pm0);
  G3.grp.add(new T.LineSegments(new T.EdgesGeometry(geo, 24), new T.LineBasicMaterial({ color: light ? 0x1a2430 : 0x0c1014 })));
  for (const fl of model.flanges || []) {
    const c = fl.c, n = Math.max(4, Math.ceil(c.A / (PI / 24))), I = [], O = [];
    for (let i = 0; i <= n; i++) { const th = c.A * i / n, s = Math.sin(th), co = Math.cos(th); I.push([c.r * s, part.t + c.r - c.r * co]); O.push([(c.r + part.t) * s, part.t + c.r - (c.r + part.t) * co]); }
    const dx = Math.cos(c.A), dz = Math.sin(c.A);
    let poly = fl.holes && fl.holes.length ? [...I, ...O.slice().reverse()] : [...I, [I[n][0] + c.Lf * dx, I[n][1] + c.Lf * dz], [O[n][0] + c.Lf * dx, O[n][1] + c.Lf * dz], ...O.slice().reverse()];
    if (c.down) poly = poly.map(q => [q[0], part.t - q[1]]);
    const fg = new T.ExtrudeGeometry(new T.Shape(v2(poly)), { depth: fl.W, bevelEnabled: false, steps: 1, curveSegments: 1 });
    const F0 = fl.fr0; fg.applyMatrix4(new T.Matrix4().makeBasis(new T.Vector3(...F0.u), new T.Vector3(...F0.n), new T.Vector3(...F0.v)).setPosition(...F0.O));
    const fm0 = new T.Mesh(fg, new T.MeshStandardMaterial({ color: light ? 0xaab4be : 0x9eabb8, metalness: 0.35, roughness: 0.55 })); fm0.userData.pk = fl.f.id; G3.grp.add(fm0);
    G3.grp.add(new T.LineSegments(new T.EdgesGeometry(fg, 24), new T.LineBasicMaterial({ color: light ? 0x1a2430 : 0x0c1014 })));
    if (fl.holes && fl.holes.length) { const sh = new T.Shape(v2([[0, 0], [fl.W, 0], [fl.W, c.Lf], [0, c.Lf]])); for (const h of fl.holes) sh.holes.push(new T.Path(v2(h.poly)));
      const lg = new T.ExtrudeGeometry(sh, { depth: part.t, bevelEnabled: false, curveSegments: 1 }); lg.applyMatrix4(legMat(fl, 0));
      const lm = new T.Mesh(lg, new T.MeshStandardMaterial({ color: light ? 0xaab4be : 0x9eabb8, metalness: 0.35, roughness: 0.55 })); lm.userData.pk = fl.f.id; G3.grp.add(lm);
      G3.grp.add(new T.LineSegments(new T.EdgesGeometry(lg, 24), new T.LineBasicMaterial({ color: light ? 0x1a2430 : 0x0c1014 }))); }
  }
  if (crPick && crHover && model.base) { const v = cornerVerts(model.base).find(q => KEY(q.x, q.y) === crHover); if (v) { const cg = new T.CircleGeometry(G3.span * 0.014, 24), cmh = new T.Mesh(cg, new T.MeshBasicMaterial({ color: 0xff9f1c, depthTest: false })); cmh.position.set(v.x, v.y, part.t + 0.004); cmh.renderOrder = 3; G3.grp.add(cmh); } }
  if (selFace && selFace.fl) { const fl = (model.flanges || []).find(x => x.f.id === selFace.fl); if (fl) { const fm = new T.Mesh(new T.ShapeGeometry(new T.Shape(v2([[0, 0], [fl.W, 0], [fl.W, fl.c.Lf], [0, fl.c.Lf]]))), new T.MeshBasicMaterial({ color: 0xff9f1c, transparent: true, opacity: 0.45, side: T.DoubleSide, depthTest: false })); fm.applyMatrix4(legMat(fl, part.t / 2)); fm.renderOrder = 2; G3.grp.add(fm); } }
  else if (selFace && model.outer && !model.contour) { const zz = selFace === 'top' ? part.t + 0.003 : -0.003, sh = new T.Shape(v2(model.outer.poly)); for (const h of model.holes) sh.holes.push(new T.Path(v2(h.poly)));
    const fm = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: 0xff9f1c, transparent: true, opacity: 0.45, side: T.DoubleSide, depthTest: false })); fm.position.z = zz; fm.renderOrder = 2; G3.grp.add(fm); }
  if (flPick && flHover && flHover.line) { const [A, B] = flHover.line, a = new T.Vector3(...A), b = new T.Vector3(...B), L = a.distanceTo(b) || 1e-6;
    const cg = new T.CylinderGeometry(G3.span * 0.004, G3.span * 0.004, L, 8), hm = new T.Mesh(cg, new T.MeshBasicMaterial({ color: 0xff9f1c, depthTest: false }));
    hm.position.copy(a).add(b).multiplyScalar(0.5); hm.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); hm.renderOrder = 3; G3.grp.add(hm); }
  // visible sketches drawn on the face they belong to (all of them while picking a cut)
  const z = part.t + Math.max(0.002, part.t * 0.02), pos = [], face0 = faceFeat();
  const toW = f => { const id = skFl(f); if (!id) return (x, y) => [x, y, f.plane === 'bot' ? -(z - part.t) : z]; const fl = (model.flanges || []).find(x => x.f.id === id); if (!fl) return null; const M = legMat(fl, z); return (x, y) => { const q = new T.Vector3(x, y, 0).applyMatrix4(M); return [q.x, q.y, q.z]; }; };
  for (const f of part.feats) { if (f.type !== 'sketch' || !(sketchVis(f) || (cutSel && face0 && f.id !== face0.sk))) continue; const W = toW(f); if (!W) continue;
    for (const g of sketchGeoms(f)) { const pts = g.t === 'line' ? [[g.x1, g.y1], [g.x2, g.y2]] : tess(g).concat([g.t === 'circle' ? [g.cx + g.r, g.cy] : [g.cx + g.r * Math.cos(g.ea), g.cy + g.r * Math.sin(g.ea)]]);
      for (let k = 0; k < pts.length - 1; k++) pos.push(...W(pts[k][0], pts[k][1]), ...W(pts[k + 1][0], pts[k + 1][1])); } }
  if (pos.length) { const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G3.grp.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: light ? 0xd97a00 : 0xff9f1c, depthTest: false }))); }
  if (cutSel) for (const l of cutSel.loops) { const m = new T.Mesh(new T.ShapeGeometry(new T.Shape(v2(l.poly))), new T.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.5, side: T.DoubleSide, depthTest: false }));
    if (l.pk && l.pk !== 'base') { const fl = (model.flanges || []).find(x => 'fl' + x.f.id === l.pk); if (!fl) continue; m.applyMatrix4(legMat(fl, z)); } else m.position.z = z + 0.001; m.renderOrder = 2; G3.grp.add(m); }
  // push / pull arrows for the feature whose popup is open
  G3.handles = []; const af = flActive && feat(flActive);
  const arrow = (P, d, col) => { const L = G3.span * 0.085, R = G3.span * 0.006, dir = new T.Vector3(...d).normalize(), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir), mat = () => new T.MeshBasicMaterial({ color: col, depthTest: false });
    const sh = new T.Mesh(new T.CylinderGeometry(R, R, L * 0.6, 10), mat()), hd = new T.Mesh(new T.ConeGeometry(R * 3.2, L * 0.4, 14), mat()); for (const [m, k] of [[sh, 0.3], [hd, 0.8]]) { m.quaternion.copy(q); m.position.set(P[0] + dir.x * L * k, P[1] + dir.y * L * k, P[2] + dir.z * L * k); m.renderOrder = 5; G3.grp.add(m); }
    return [P[0] + dir.x * L * 0.6, P[1] + dir.y * L * 0.6, P[2] + dir.z * L * 0.6]; };
  if (af && af.type === 'flange' && !af.off) { const fl = (model.flanges || []).find(x => x.f.id === af.id); if (fl) { const Tt = fl.tip, mid = v3(v3(Tt.O, 1, Tt.v, fl.W / 2), 1, Tt.n, part.t / 2), nd = fl.c.down ? neg3(Tt.n) : Tt.n;
    G3.handles.push({ type: 'lin', P: mid, d: Tt.u, grab: arrow(mid, Tt.u, 0x3b5bff), snap: 1 / 16, min: 1 / 16, inp: 0, get: () => af.len, set: v => { const o = af.len; af.len = v; if (flangeCalc(af).err) af.len = o; return af.len; }, done: () => flangePanel(af) });
    const F = fl.fr0; G3.handles.push({ type: 'ang', O: v3(v3(F.O, 1, F.v, fl.W / 2), 1, F.n, part.t / 2), u: F.u, n: F.n, v: F.v, down: fl.c.down, grab: arrow(mid, nd, 0x19b36b), snap: 5, inp: 1, get: () => af.ang == null ? 90 : af.ang, set: v => { const o = af.ang; af.ang = v; if (flangeCalc(af).err) af.ang = o; return af.ang == null ? 90 : af.ang; }, done: () => flangePanel(af) }); } }
  else if (af && af.type === 'corner' && !af.off && model.base) { let V = null, bd = 1e9; for (const q of cornerVerts(model.base)) { const dd = hyp(q.x - af.pt.x, q.y - af.pt.y); if (dd < bd) { bd = dd; V = q; } }
    if (V) { let bx = 0, by = 0; for (const g of V.segs) { const e = gEnds(g), far = hyp(e[0][0] - V.x, e[0][1] - V.y) < 1e-6 ? e[1] : e[0], l = hyp(far[0] - V.x, far[1] - V.y) || 1; bx += (far[0] - V.x) / l; by += (far[1] - V.y) / l; } const bl = hyp(bx, by) || 1, P = [V.x, V.y, part.t], d = [bx / bl, by / bl, 0];
      G3.handles.push({ type: 'lin', P, d, grab: arrow(P, d, 0x3b5bff), snap: 1 / 32, min: 1 / 32, inp: 0, get: () => af.size, set: v => (af.size = v), done: () => cornerPanel(af) }); } }
  else if (af && af.type === 'contour' && model.contour) { const b = model.contour.bb, P = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, model.contour.len], d = [0, 0, 1];
    G3.handles.push({ type: 'lin', P, d, grab: arrow(P, d, 0x3b5bff), snap: 1 / 16, min: 1 / 16, inp: 0, get: () => af.len, set: v => (af.len = v), done: () => contourPanel(af) }); }
  G3.scene.background = new T.Color(light ? 0xeef1f4 : 0x14181d);
}
// ---- world frame of a sketch feature's plane: origin, x/y directions, outward normal (toward whoever views that sketch)
function planeFrame(f) {
  if (!f || !(model && model.outer) || model.contour) return null;
  const id = skFl(f);
  if (!id) return f.plane === 'bot' ? { O: [0, 0, 0], ex: [-1, 0, 0], ey: [0, 1, 0], n: [0, 0, -1] } : { O: [0, 0, part.t], ex: [1, 0, 0], ey: [0, 1, 0], n: [0, 0, 1] };
  const fl = (model.flanges || []).find(x => x.f.id === id); if (!fl || !fl.tip) return null;
  return { O: v3(fl.tip.leg0, 1, fl.tip.n, part.t), ex: fl.tip.v.slice(), ey: fl.tip.u.slice(), n: fl.tip.n.slice() };
}
function backdropOn() { return mode === 'sketch' && G3.ok !== false && !!planeFrame(feat(actId)); }
// The 3D part drawn behind the sketch: an ortho camera looks straight at the sketch plane and tracks the 2D pan/zoom, so 3D and sketch line up 1:1.
function drawBackdrop() {
  if (!G3.tried) init3D(); if (!G3.ok) return false;
  const fr = planeFrame(feat(actId)); if (!fr) return false;
  if (G3.rebuild || G3.theme !== settings.theme) { G3.theme = settings.theme; rebuild3D(); }
  G3.r.setPixelRatio(DPR); G3.r.setSize(CW, CH, false);
  const cam = G3.cam, c = s2w(CW / 2, CH / 2);
  const Wc = [0, 1, 2].map(i => fr.O[i] + fr.ex[i] * c.x + fr.ey[i] * c.y);
  cam.left = -CW / (2 * view.s); cam.right = CW / (2 * view.s); cam.top = CH / (2 * view.s); cam.bottom = -CH / (2 * view.s); cam.updateProjectionMatrix();
  cam.up.set(fr.ey[0], fr.ey[1], fr.ey[2]);
  cam.position.set(Wc[0] + fr.n[0] * 1000, Wc[1] + fr.n[1] * 1000, Wc[2] + fr.n[2] * 1000);
  cam.lookAt(Wc[0], Wc[1], Wc[2]); cam.updateMatrixWorld();
  G3.sun.position.set(cam.position.x + fr.ex[0] * 300 + fr.ey[0] * 420, cam.position.y + fr.ex[1] * 300 + fr.ey[1] * 420, cam.position.z + fr.ex[2] * 300 + fr.ey[2] * 420);
  G3.sun.intensity = 0.3;
  G3.r.render(G3.scene, cam);
  return true;
}
// Swing the model-view camera around to look straight at a face, then run fn (used when a sketch opens on a face).
function swingTo(fr, fn) {
  if (!G3.ok || mode !== 'model') { fn(); return; }
  const n = fr.n, el1 = Math.max(-1.5533, Math.min(1.5533, Math.asin(n[2]))), az1raw = (Math.abs(n[2]) > 0.999) ? G3.az : Math.atan2(n[1], n[0]);
  let daz = az1raw - G3.az; while (daz > PI) daz -= TAU; while (daz < -PI) daz += TAU;
  const C = [0, 1, 2].map(i => fr.O[i] + fr.ex[i] * 0 + fr.ey[i] * 0);
  const a0 = { az: G3.az, el: G3.el, tx: G3.tx, ty: G3.ty, tz: G3.tz }, t0 = performance.now(), DUR = 420;
  const tick = now => {
    const k = Math.min(1, (now - t0) / DUR), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
    G3.az = a0.az + daz * e; G3.el = a0.el + (el1 - a0.el) * e;
    G3.tx = a0.tx + (C[0] - a0.tx) * e; G3.ty = a0.ty + (C[1] - a0.ty) * e; G3.tz = a0.tz + (C[2] - a0.tz) * e;
    dirty3 = true;
    if (k < 1) requestAnimationFrame(tick); else fn();
  };
  requestAnimationFrame(tick);
}
function draw3D() {
  if (!G3.ok) return;
  G3.cam.up.set(0, 0, 1); G3.sun.intensity = 0.75;
  if (G3.rebuild || G3.theme !== settings.theme) { G3.theme = settings.theme; rebuild3D(); }
  if (G3.fitNext && model && model.outer) { const b = model.contour ? model.contour.bb : model.bb, zh = model.contour ? model.contour.len : part.t; G3.fitNext = false; G3.tx = (b.x0 + b.x1) / 2; G3.ty = (b.y0 + b.y1) / 2; G3.tz = zh / 2; const d = hyp(b.x1 - b.x0, b.y1 - b.y0, zh); G3.span = Math.max(0.2, d * 1.25 * Math.max(1, CH / Math.max(CW, 1))); }
  G3.r.setPixelRatio(DPR); G3.r.setSize(CW, CH, false);
  const cam = G3.cam, hh = G3.span / 2, hw = hh * CW / Math.max(CH, 1), ce = Math.cos(G3.el);
  cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.updateProjectionMatrix();
  const dx = ce * Math.cos(G3.az), dy = ce * Math.sin(G3.az), dz = Math.sin(G3.el), D = 1000;
  cam.position.set(G3.tx + dx * D, G3.ty + dy * D, G3.tz + dz * D); cam.lookAt(G3.tx, G3.ty, G3.tz); cam.updateMatrixWorld();
  G3.sun.position.set(cam.position.x - dy * 400, cam.position.y + dx * 400, cam.position.z + 500);
  G3.r.render(G3.scene, cam);
  // view cube follows the camera. Cube-local axes: x = world X, y = -world Z, z = -world Y.
  const e = cam.matrixWorldInverse.elements, R = (i, j) => e[j * 4 + i];
  const col = (j, sg) => [sg * R(0, j), -sg * R(1, j), sg * R(2, j)];
  const c0 = col(0, 1), c1 = col(2, -1), c2 = col(1, -1);
  document.querySelector('#vcube .cube').style.transform = `matrix3d(${c0.join(',')},0,${c1.join(',')},0,${c2.join(',')},0,0,0,0,1)`;
}

// ---------------------------------------------------------------- Dropbox (works when QuickCad is hosted on its own page)
const dbxRedirect = () => location.origin + location.pathname;
function dbxTok() { try { return JSON.parse(localStorage.getItem('qc.dbx') || 'null'); } catch (e) { return null; } }
const b64u = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function dbxConnect() {
  const ver = b64u(crypto.getRandomValues(new Uint8Array(48)));
  const ch = b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ver))));
  localStorage.setItem('qc.dbxv', ver);
  location.href = 'https://www.dropbox.com/oauth2/authorize?client_id=' + encodeURIComponent(settings.dbxKey) + '&response_type=code&code_challenge=' + ch + '&code_challenge_method=S256&token_access_type=offline&redirect_uri=' + encodeURIComponent(dbxRedirect());
}
async function dbxToken(params) {
  const r = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(Object.assign({ client_id: settings.dbxKey }, params)) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || 'token request failed');
  const old = dbxTok() || {}; const t = { access: j.access_token, refresh: j.refresh_token || old.refresh, exp: Date.now() + ((j.expires_in || 14400) - 120) * 1000 };
  localStorage.setItem('qc.dbx', JSON.stringify(t)); return t;
}
async function dbxFinish() {
  let code = null; try { code = new URLSearchParams(location.search).get('code'); } catch (e) {}
  if (!code) return; const ver = localStorage.getItem('qc.dbxv'); history.replaceState(null, '', location.pathname); if (!ver || !settings.dbxKey) return;
  try { await dbxToken({ code, grant_type: 'authorization_code', code_verifier: ver, redirect_uri: dbxRedirect() }); localStorage.removeItem('qc.dbxv'); toast('Dropbox connected — tap Flat DXF and Save to Dropbox'); }
  catch (err) { toast('Dropbox connection failed: ' + err.message); }
}
async function dbxAccess() { let t = dbxTok(); if (!t) throw new Error('not connected'); if (Date.now() >= t.exp) t = await dbxToken({ grant_type: 'refresh_token', refresh_token: t.refresh }); return t.access; }
async function dbxUpload(path, text, overwrite) {
  const arg = JSON.stringify({ path, mode: overwrite ? 'overwrite' : 'add', autorename: false, mute: true }).replace(/[\u007f-￿]/g, c => '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4));
  const r = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + await dbxAccess(), 'Dropbox-API-Arg': arg, 'Content-Type': 'application/octet-stream' }, body: text });
  if (r.status === 409) return { conflict: true };
  if (!r.ok) throw new Error((await r.text()).slice(0, 160)); return { ok: true };
}
async function dbxFolders(path) {
  const r = await fetch('https://api.dropboxapi.com/2/files/list_folder', { method: 'POST', headers: { Authorization: 'Bearer ' + await dbxAccess(), 'Content-Type': 'application/json' }, body: JSON.stringify({ path: path === '/' ? '' : path, limit: 2000 }) });
  if (!r.ok) throw new Error((await r.text()).slice(0, 160));
  return (await r.json()).entries.filter(e => e['.tag'] === 'folder').map(e => e.path_display).sort((a, b) => a.localeCompare(b));
}
function dbxSettings() {
  const key = el('input', { type: 'text', value: settings.dbxKey || '', placeholder: 'Dropbox app key', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const folder = el('input', { type: 'text', value: settings.dbxFolder || '/AutoCad Drawings', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const st = el('div', { class: 'note' }), list = el('div', {});
  const save = () => { settings.dbxKey = key.value.trim(); let f = folder.value.trim() || '/'; if (!f.startsWith('/')) f = '/' + f; settings.dbxFolder = f; folder.value = f; saveSettings(); };
  key.addEventListener('change', save); folder.addEventListener('change', save);
  const blocked = framed || hosted();
  const paint = () => { st.innerHTML = blocked ? 'Dropbox cannot be reached from inside Claude. Host QuickCad on its own page, then register this redirect URI in your Dropbox app: the page address.' : (dbxTok() ? 'Connected to Dropbox.' : 'Not connected.') + ' Redirect URI to register in the Dropbox app: <b>' + dbxRedirect() + '</b>'; };
  const browse = async () => { save(); try { st.textContent = 'Loading folders…'; const fs = await dbxFolders(settings.dbxFolder); paint(); list.innerHTML = '';
      const up = settings.dbxFolder.replace(/\/[^/]*$/, '') || '/';
      const row = (label, p) => el('div', { class: 'row', onclick: () => { folder.value = p; save(); browse(); } }, el('span', { class: 'tg' }, '▸'), el('span', { class: 'nm' }, label));
      if (settings.dbxFolder !== '/') list.append(row('.. up one level', up)); fs.forEach(p => list.append(row(p.split('/').pop(), p)));
      if (!fs.length) list.append(el('div', { class: 'note' }, 'No sub-folders here. Files will be saved in ' + settings.dbxFolder)); } catch (err) { st.textContent = 'Could not list folders: ' + err.message; } };
  paint();
  return el('div', {}, el('label', {}, 'Dropbox app key'), key, el('label', {}, 'Dropbox save folder'), folder,
    el('div', { class: 'btnrow' },
      el('button', { onclick: () => { save(); if (blocked) { paint(); return; } if (!settings.dbxKey) { st.textContent = 'Enter the app key first.'; return; } dbxConnect(); } }, dbxTok() ? 'Reconnect' : 'Connect Dropbox'),
      el('button', { onclick: () => { if (blocked || !dbxTok()) { st.textContent = blocked ? 'Not available inside Claude.' : 'Connect first.'; return; } browse(); } }, 'Browse folders'),
      el('button', { onclick: () => { try { localStorage.removeItem('qc.dbx'); } catch (e) {} paint(); } }, 'Disconnect')), st, list);
}

// ---------------------------------------------------------------- boot
(function boot() {
  try { Object.assign(settings, JSON.parse(localStorage.getItem('qc.settings') || '{}')); } catch (e) {}
  if (!settings.dbxFolder) settings.dbxFolder = '/AutoCad Drawings';
  document.documentElement.classList.toggle('light', settings.theme === 'light');
  try {
    const o = JSON.parse(localStorage.getItem('qc.part') || 'null');
    if (o && validPart(o.part)) part = o.part;
    else { const old = JSON.parse(localStorage.getItem('qc.sketch') || 'null'); if (validSketch(old)) part = wrapSketch(old); }
  } catch (e) {}
  actId = part.feats[0].id; S = part.feats[0].sk; lastNid = S.nid;
  $('#pname').value = part.name || 'Part1';
  buildRibbon(); resize(); buildModel(); pushHist(); fit(); refresh(); updateInfo(); loop();
  initSolver().then(() => { regen(); if (model && model.outer) setMode('model'); refresh(); updateInfo(); });
  dbxFinish();
})();
window.QC = { popKey, undo, redo, get popState() { return popState; }, get hi() { return hi; }, get labelRects() { return labelRects; }, get tool() { return tool; }, toolVar, get cur() { return cur; }, get S() { return S; }, get part() { return part; }, get model() { return model; }, get mode() { return mode; }, get G3() { return G3; }, get sel() { return sel; }, set sel(v) { sel = v; }, get dof() { return dof; }, get view() { return view; }, get solver() { return solverState; },
  setTool, toolClick, commit, applyCon, applyDim, dimOffer, dxfText, flatGeoms, zipOne, parseLen, fit, undo, redo, loadSketch, loadPart, newPart, newSketch, startPattern, w2s, popKey, showSelPop, solve,
  facePick, faceButton, newSketchOnFace, cornerButton, cornerHit, regions, cutRegions, hit3, handleAt, handleStart, handleDrag, handleEnd, facePick3, setSelFace,  cornerVerts, contourButton, contourCalc, openChain, pickFlangeEdge3, edgeCorners, flatButton, flangeButton, flangeTap, flangePanel, flangeCalc, makeCut, cutTap, cancelCut, cutCands, sketchLoops, cutState: () => cutSel, setMode, activate, findLoops, regen };
