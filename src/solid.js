// ================================================================ phase 4b: solid parts (3D Model tab)
// A finished sketch becomes sheet metal (Face) or a solid (Extrude / Revolve). Solids are real 3D bodies built with the Manifold kernel:
// every Extrude either adds to the body or cuts into it, depending on which way its arrow is pulled. Sketches can sit on any flat face.
// feature: { type:'extrude', sk, pick:[{x,y}], d (signed, along the sketch normal), op?:'join'|'cut', thru?, off? }
//          { type:'revolve', sk, pick:[{x,y}], ax (entity id of the axis line), ang, op? }
// sketch on a face: f.pl = { O, ex, ey, n } (world frame), f.cap = id of the extrude whose end face it sits on (so it follows that extrude's distance)
var MF = null, mfState = 'loading';
var exPick = null;       // 'extrude' | 'revolve' while waiting for a profile tap
var exActive = null;     // id of the extrude / revolve whose bar and arrow are showing
var lastExD = 1;
(async () => {
  try {
    const bin = Uint8Array.from(atob(MF_B64), c => c.charCodeAt(0));
    MF = await window.__manifold({ printErr() {}, wasmBinary: bin });
    MF.setup(); mfState = 'ok';
    if (part.solid) { regen(); if (model && model.outer && mode === 'sketch' && !Object.keys(S.ents).length) setMode('model'); G3.rebuild = true; dirty3 = true; refresh(); updateInfo(); }
  } catch (e) { mfState = 'failed'; console.error(e); }
})();

const XYF = () => ({ O: [0, 0, 0], ex: [1, 0, 0], ey: [0, 1, 0], n: [0, 0, 1] });
const add3 = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const solidFeats = () => part.feats.filter(f => f.type === 'extrude' || f.type === 'revolve');
function skFrame(f, depth) {
  if (!f || !f.pl) return XYF();
  const fr = { O: f.pl.O.slice(), ex: f.pl.ex.slice(), ey: f.pl.ey.slice(), n: f.pl.n.slice() };
  if (f.cap && (depth || 0) < 20) { const X = feat(f.cap), sf = X && feat(X.sk);          // follow the end face of the extrude it was drawn on
    if (X && sf && X.type === 'extrude' && !X.thru) { const f0 = skFrame(sf, (depth || 0) + 1), end = add3(f0.O, f0.n, X.d), k = dot3(end, fr.n) - dot3(fr.O, fr.n); if (Math.abs(dot3(f0.n, fr.n)) > 0.9999) fr.O = add3(fr.O, fr.n, k); } }
  return fr;
}
const frPt = (fr, x, y, z) => [fr.O[0] + fr.ex[0] * x + fr.ey[0] * y + fr.n[0] * (z || 0), fr.O[1] + fr.ex[1] * x + fr.ey[1] * y + fr.n[1] * (z || 0), fr.O[2] + fr.ex[2] * x + fr.ey[2] * y + fr.n[2] * (z || 0)];
function innerPt(l) {            // a point safely inside a loop
  let cx = 0, cy = 0; for (const p of l.poly) { cx += p[0]; cy += p[1]; } cx /= l.poly.length; cy /= l.poly.length; if (pointInPoly(cx, cy, l.poly)) return { x: cx, y: cy };
  const n = l.poly.length; for (let i = 0; i < n; i++) { const a = l.poly[i], b = l.poly[(i + 2) % n], x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2; if (pointInPoly(x, y, l.poly)) return { x, y }; }
  return { x: cx, y: cy };
}
// the picked regions of a sketch: each is the smallest enclosed area under a pick point, with the enclosed shapes inside it left as holes unless they were picked too
function profLoops(sf, picks) {
  const regs = cutRegions(sf.sk), out = [];
  for (const q of picks || []) { const h = regs.filter(l => pointInPoly(q.x, q.y, l.poly)).sort((a, b) => a.area - b.area)[0]; if (h && !out.some(o => o.outer === h)) out.push({ outer: h, inner: topLoops(regs.filter(l => l !== h && l.area < h.area && loopIn(l, h))) }); }
  return out;
}
var mfTrash = [];                 // kernel objects are lazy: nothing is freed until the whole body has been read out
const mfK = o => (mfTrash.push(o), o);
function profCS(loops, map) {     // -> Manifold CrossSection
  let cs = null; const mp = map || (p => p);
  for (const L of loops) { let a = mfK(new MF.CrossSection([L.outer.poly.map(mp)], 'EvenOdd'));
    if (L.inner.length) { const b = mfK(new MF.CrossSection(L.inner.map(i => i.poly.map(mp)), 'NonZero')); a = mfK(a.subtract(b)); }
    cs = cs ? mfK(cs.add(a)) : a; }
  return cs;
}
function revAxis(X, sf) {         // axis line of a revolve in sketch coordinates
  const e = sf.sk.ents[X.ax]; if (!e || e.t !== 'line') return null; const a = sf.sk.pts[e.a], b = sf.sk.pts[e.b], L = hyp(b.x - a.x, b.y - a.y); if (L < 1e-9) return null;
  return { A: [a.x, a.y], a: [(b.x - a.x) / L, (b.y - a.y) / L] };
}
function buildSolid() {
  model = null; if (mfState !== 'ok') return;
  try { buildSolid0(); } finally { for (const o of mfTrash) try { o.delete(); } catch (_) {} mfTrash = []; }
}
function buildSolid0() {
  const warn = [], cat = [], ops = {}, feats = solidFeats(); let body = null, n = 0;
  const stub = { segs: [], poly: [], area: 0, bb: { x0: 0, y0: 0, x1: 0, y1: 0 } };
  for (const X of feats) {
    if (X.off) continue; const sf = feat(X.sk); if (!sf) { warn.push(X.name + ': its sketch is gone'); continue; }
    const fr = skFrame(sf), loops = profLoops(sf, X.pick); if (!loops.length) { warn.push(X.name + ': its profile is gone — edit ' + sf.name + ' or delete this feature'); continue; }
    let toolM = null, op = !body ? 'new' : X.op || (X.type === 'extrude' && (X.thru || X.d < 0) ? 'cut' : 'join'), d = X.d;
    try {
      if (X.type === 'extrude') {
        if (X.thru) { const b = body ? body.boundingBox() : null, big = b ? hyp(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) * 2 + 1 : 10; d = -big; }
        const cs = profCS(loops), e0 = mfK(cs.extrude(Math.abs(d))), e1 = d < 0 ? mfK(e0.translate([0, 0, d])) : e0;
        toolM = mfK(e1.transform([...fr.ex, 0, ...fr.ey, 0, ...fr.n, 0, ...fr.O, 1]));
      } else {
        const ax = revAxis(X, sf); if (!ax) { warn.push(X.name + ': its axis line is gone'); continue; }
        const c0 = innerPt(loops[0].outer); let px = -ax.a[1], py = ax.a[0]; if ((c0.x - ax.A[0]) * px + (c0.y - ax.A[1]) * py < 0) { px = -px; py = -py; }
        const loc = p => [(p[0] - ax.A[0]) * px + (p[1] - ax.A[1]) * py, (p[0] - ax.A[0]) * ax.a[0] + (p[1] - ax.A[1]) * ax.a[1]];
        if (loops.some(L => L.outer.poly.some(p => loc(p)[0] < -1e-6))) { warn.push(X.name + ': the profile crosses the axis'); continue; }
        const cs = profCS(loops, loc), ang = Math.max(1, Math.min(360, X.ang || 360)), r0 = mfK(MF.Manifold.revolve(cs, 96, ang));
        const a3 = [0, 1, 2].map(i => fr.ex[i] * ax.a[0] + fr.ey[i] * ax.a[1]), p3 = [0, 1, 2].map(i => fr.ex[i] * px + fr.ey[i] * py), y3 = cross3(a3, p3);
        toolM = mfK(r0.transform([...p3, 0, ...y3, 0, ...a3, 0, ...frPt(fr, ax.A[0], ax.A[1]), 1]));
      }
      body = !body ? toolM : mfK(op === 'cut' ? body.subtract(toolM) : body.add(toolM));
    } catch (e) { warn.push(X.name + ': could not be built'); continue; }
    ops[X.id] = { op, fr, d, c: innerPt(loops[0].outer) }; n++;
    // analytic edges of this feature for Project geometry: the profile at both ends, and the straight edges between
    if (X.type === 'extrude') loops.forEach((L, li) => [L.outer, ...L.inner].forEach((lp, pi) => lp.segs.forEach((g, si) => { const key = 'X' + X.id + '.' + li + '.' + pi + '.' + si;
      for (const [z, sfx] of [[0, 's'], [d, 'e']]) { const k = key + sfx, m = (x, y) => frPt(fr, x, y, z);
        if (g.t === 'line') cat.push({ key: k, t: 'line', A: m(g.x1, g.y1), B: m(g.x2, g.y2) });
        else if (g.r > 1e-6) { const o = { key: k, t: g.t, C: m(g.cx, g.cy), r: g.r, n: fr.n.slice() }; if (g.t === 'arc') { const at = a => m(g.cx + g.r * Math.cos(a), g.cy + g.r * Math.sin(a)); o.A = at(g.sa); o.B = at(g.ea); o.M = at((g.sa + g.ea) / 2); } cat.push(o); } }
      if (g.t !== 'circle') { const e = gEnds(g)[0]; cat.push({ key: key + 'v', t: 'line', A: frPt(fr, e[0], e[1], 0), B: frPt(fr, e[0], e[1], d) }); } })));
  }
  if (!body) { if (feats.length) model = { solid: true, empty: true, outer: stub, holes: [], flanges: [], warn, cat: [], ops, bb: stub.bb, area: 0, bends: [], flatSegs: [], pos: new Float32Array(0), idx: new Uint32Array(0), vol: 0, b3: { min: [0, 0, 0], max: [0, 0, 0] } }; return; }
  if (body.isEmpty()) warn.push('Nothing is left of the part — a cut removed all of it');
  const mesh = body.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, pos = new Float32Array(vp.length / np * 3);
  for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { pos[j] = vp[i]; pos[j + 1] = vp[i + 1]; pos[j + 2] = vp[i + 2]; }
  const b3 = body.boundingBox(), vol = body.volume();
  model = { solid: true, outer: stub, holes: [], flanges: [], warn, cat, ops, bb: { x0: b3.min[0], y0: b3.min[1], x1: b3.max[0], y1: b3.max[1] }, area: 0, bends: [], flatSegs: [], pos, idx: new Uint32Array(mesh.triVerts), vol, b3 };
}
function solidInfo(n) {
  if (!model || !model.solid || model.empty) { n.textContent = ''; return; } const b = model.b3;
  n.innerHTML = `Solid · <b>${fmt(b.max[0] - b.min[0])} × ${fmt(b.max[1] - b.min[1])} × ${fmt(b.max[2] - b.min[2])}</b> in · ${fmt(model.vol.toFixed(3))} in³ · about ${fmt((model.vol * 0.2836).toFixed(2))} lb mild steel`;
}

// ---------------------------------------------------------------- 3D display and picking
function triN(i) { const p = model.pos, x = model.idx, a = x[i * 3] * 3, b = x[i * 3 + 1] * 3, c = x[i * 3 + 2] * 3, u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]], n = cross3(u, v), L = hyp(n[0], n[1], n[2]) || 1; return { n: [n[0] / L, n[1] / L, n[2] / L], off: (n[0] * p[a] + n[1] * p[a + 1] + n[2] * p[a + 2]) / L, ar: L / 2 }; }
function solidTopo() {            // per-triangle planes and edge neighbours (built once per model)
  if (model.topo) return model.topo; const nt = model.idx.length / 3, tn = [], em = new Map(), x = model.idx;
  for (let i = 0; i < nt; i++) { tn.push(triN(i)); for (let k = 0; k < 3; k++) { const a = x[i * 3 + k], b = x[i * 3 + (k + 1) % 3], key = a < b ? a + '_' + b : b + '_' + a; (em.get(key) || em.set(key, []).get(key)).push(i); } }
  return (model.topo = { tn, em });
}
function triCurved(i) {           // part of a rounded surface: a neighbour meets it at a small, non-zero angle
  const { tn, em } = solidTopo(), x = model.idx;
  for (let k = 0; k < 3; k++) { const a = x[i * 3 + k], b = x[i * 3 + (k + 1) % 3], nb = em.get(a < b ? a + '_' + b : b + '_' + a) || []; for (const j of nb) { if (j === i) continue; const c = dot3(tn[i].n, tn[j].n); if (c < 0.99985 && c > 0.9) return true; } }
  return false;
}
const planeTris = (n, off) => { const { tn } = solidTopo(), out = []; for (let i = 0; i < tn.length; i++) if (tn[i].ar > 1e-12 && dot3(tn[i].n, n) > 0.99999 && Math.abs(tn[i].off - off) < 1e-4) out.push(i); return out; };
function faceFrame(n, p) {
  const off = dot3(n, p), r = v => Math.abs(v) < 1e-9 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-9 ? Math.sign(v) : v, N = n.map(r), O = [N[0] * off, N[1] * off, N[2] * off];
  let ex; if (Math.abs(N[2]) > 0.999) ex = [N[2] > 0 ? 1 : -1, 0, 0]; else { ex = cross3([0, 0, 1], N); const L = hyp(ex[0], ex[1], ex[2]); ex = ex.map(v => r(v / L)); }
  return { O, ex, ey: cross3(N, ex).map(r), n: N };
}
function hitSolid(px, py) {
  if (!(model && model.solid && G3.ok && G3.solidMesh)) return null; const T = window.THREE, rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(px / CW * 2 - 1, -(py / CH) * 2 + 1), G3.cam);
  const h = rc.intersectObject(G3.solidMesh, false)[0]; if (!h) return null; const t = triN(h.faceIndex);
  return { tri: h.faceIndex, n: t.n, p: [h.point.x, h.point.y, h.point.z] };
}
function rayPlane(px, py, fr) {   // where the pointer hits a sketch plane, in that sketch's coordinates
  const r = ray3(px, py), o = [r.origin.x, r.origin.y, r.origin.z], d = [r.direction.x, r.direction.y, r.direction.z], den = dot3(d, fr.n); if (Math.abs(den) < 1e-9) return null;
  const k = dot3([fr.O[0] - o[0], fr.O[1] - o[1], fr.O[2] - o[2]], fr.n) / den, q = [o[0] + d[0] * k - fr.O[0], o[1] + d[1] * k - fr.O[1], o[2] + d[2] * k - fr.O[2]];
  return { x: dot3(q, fr.ex), y: dot3(q, fr.ey), k };
}
function rebuildSolid3D(T) {
  const light = settings.theme === 'light'; G3.solidMesh = null; G3.handles = [];
  const add = o => { G3.grp.add(o); return o; };
  if (model.idx.length) {
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(model.pos, 3)); geo.setIndex(new T.BufferAttribute(model.idx, 1));
    const flat = geo.toNonIndexed(); flat.computeVertexNormals(); geo.dispose();
    G3.solidMesh = add(new T.Mesh(flat, new T.MeshStandardMaterial({ color: light ? 0xaab4be : 0x9eabb8, metalness: 0.35, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }))); G3.solidMesh.userData.pk = 'solid';
    add(new T.LineSegments(new T.EdgesGeometry(flat, 24), new T.LineBasicMaterial({ color: light ? 0x1a2430 : 0x0c1014 })));
    if (selFace && selFace.pl) { const tr = planeTris(selFace.pl.n, dot3(selFace.pl.n, selFace.pl.O)), pp = [];
      for (const i of tr) for (let k = 0; k < 3; k++) { const v = model.idx[i * 3 + k] * 3; pp.push(model.pos[v] + selFace.pl.n[0] * 2e-3, model.pos[v + 1] + selFace.pl.n[1] * 2e-3, model.pos[v + 2] + selFace.pl.n[2] * 2e-3); }
      if (pp.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pp, 3)); const m = add(new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xff9f1c, transparent: true, opacity: 0.6, side: T.DoubleSide }))); m.renderOrder = 2; } }
  }
  // sketches that are switched on (or being picked from), drawn on their planes; picked profiles of the active feature filled
  const lp = [], X = exActive && feat(exActive);
  for (const f of part.feats) { if (f.type !== 'sketch' || !(sketchVis(f) || exPick || (X && X.sk === f.id))) continue; const fr = skFrame(f);
    for (const g of sketchGeoms(f)) { const pts = tess(g); pts.push(g.t === 'line' ? [g.x2, g.y2] : g.t === 'circle' ? pts[0] : gEnds(g)[1]); for (let i = 0; i < pts.length - 1; i++) lp.push(...frPt(fr, pts[i][0], pts[i][1], 1e-3), ...frPt(fr, pts[i + 1][0], pts[i + 1][1], 1e-3)); } }
  if (lp.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); const l = add(new T.LineSegments(g, new T.LineBasicMaterial({ color: light ? 0xd97a00 : 0xff9f1c, depthTest: false }))); l.renderOrder = 3; }
  if (X && !X.off && feat(X.sk)) { const sf = feat(X.sk), fr = skFrame(sf), o = model.ops[X.id], cut = o && o.op === 'cut';
    for (const L of profLoops(sf, X.pick)) { const sh = new T.Shape(L.outer.poly.map(p => new T.Vector2(p[0], p[1]))); for (const h of L.inner) sh.holes.push(new T.Path(h.poly.map(p => new T.Vector2(p[0], p[1]))));
      const m = add(new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: cut ? 0xff4d4d : 0x3b8bff, transparent: true, opacity: 0.35, side: T.DoubleSide, depthTest: false })));
      m.applyMatrix4(new T.Matrix4().makeBasis(new T.Vector3(...fr.ex), new T.Vector3(...fr.ey), new T.Vector3(...fr.n)).setPosition(...fr.O)); m.renderOrder = 2; }
    if (X.type === 'extrude') { const c = (o && o.c) || { x: 0, y: 0 }, d = X.thru ? (o ? o.d : -1) : X.d, P = frPt(fr, c.x, c.y, d), dir = d < 0 ? neg3(fr.n) : fr.n, col = cut ? 0xff4d4d : 0x3b5bff;
      const Lh = G3.span * 0.085, R = G3.span * 0.006, dv = new T.Vector3(...dir).normalize(), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dv), mat = () => new T.MeshBasicMaterial({ color: col, depthTest: false });
      for (const [m, k] of [[new T.Mesh(new T.CylinderGeometry(R, R, Lh * 0.6, 10), mat()), 0.3], [new T.Mesh(new T.ConeGeometry(R * 3.2, Lh * 0.4, 14), mat()), 0.8]]) { m.quaternion.copy(q); m.position.set(P[0] + dv.x * Lh * k, P[1] + dv.y * Lh * k, P[2] + dv.z * Lh * k); m.renderOrder = 5; add(m); }
      G3.handles.push({ type: 'lin', P, d: fr.n, grab: [P[0] + dv.x * Lh * 0.6, P[1] + dv.y * Lh * 0.6, P[2] + dv.z * Lh * 0.6], snap: 1 / 16, min: -1e6, inp: 99, get: () => X.thru ? d : X.d,
        set: v => { if (Math.abs(v) < 1 / 32) return X.thru ? d : X.d; X.d = v; delete X.thru; lastExD = Math.abs(v); exBarPaint(); return v; }, done: () => { exBarPaint(); G3.rebuild = true; dirty3 = true; } }); } }
  G3.scene.background = new T.Color(light ? 0xeef1f4 : 0x14181d);
}

// ---------------------------------------------------------------- taps in the 3D view
function solidTap(px, py) {
  if (exPick) { exPick3D(px, py); return; }
  if (exActive) { const X = feat(exActive), sf = X && feat(X.sk); if (!sf) return;        // add / remove profiles of the feature being edited
    const w = rayPlane(px, py, skFrame(sf)); if (!w) return; const regs = cutRegions(sf.sk), h = regs.filter(l => pointInPoly(w.x, w.y, l.poly)).sort((a, b) => a.area - b.area)[0]; if (!h) return;
    const i = X.pick.findIndex(q => regs.filter(l => pointInPoly(q.x, q.y, l.poly)).sort((a, b) => a.area - b.area)[0] === h);
    if (i >= 0) { if (X.pick.length < 2) { toast('A feature needs at least one profile'); return; } X.pick.splice(i, 1); } else X.pick.push({ x: w.x, y: w.y });
    commitPart(); exBarPaint(); return; }
  const h = hitSolid(px, py); if (!h) { if (selFace) setSelFace(null); return; }
  if (triCurved(h.tri)) { toast('That face is curved — sketches go on flat faces'); return; }
  const fr = faceFrame(h.n, h.p);
  if (selFace && selFace.pl && dot3(selFace.pl.n, fr.n) > 0.9999 && Math.abs(dot3(selFace.pl.n, selFace.pl.O) - dot3(fr.n, fr.O)) < 1e-4) { setSelFace(null); return; }
  const v = { pl: fr }; for (const id in model.ops) { const o = model.ops[id], X = feat(id); if (!X || X.type !== 'extrude' || X.thru || o.op === 'cut') continue; if (Math.abs(dot3(o.fr.n, fr.n)) > 0.9999 && Math.abs(dot3(add3(o.fr.O, o.fr.n, o.d), fr.n) - dot3(fr.O, fr.n)) < 1e-5) v.cap = id; }
  setSelFace(v); toast('Face selected — tap Start 2D Sketch (or double-tap the face)');
}
function solidNewSketch() {
  if (mode === 'model' && !(selFace && selFace.pl)) { toast('Tap the flat face you want to sketch on (it turns orange), then tap Start 2D Sketch'); return; }
  exClose(); exPick = null;
  const f = { id: 'f' + (part.nf++), type: 'sketch', name: nextName('sketch', 'Sketch'), sk: newSketch() }; if (selFace && selFace.pl) { f.pl = selFace.pl; if (selFace.cap) f.cap = selFace.cap; }
  selFace = null; part.feats.push(f); activate(f.id); regen(); pushHist();
  const done = () => { setMode('sketch'); toast('Sketching on the face — the part stays visible behind. Finish Sketch, then Extrude: pull out to add, push in to cut.'); };
  if (mode === 'model') swingTo(skFrame(f), done); else done();
}

// ---------------------------------------------------------------- Extrude / Revolve commands
const exCands = () => part.feats.filter(f => f.type === 'sketch' && !sketchUsed(f) && cutRegions(f.sk).length);
function extrudeButton(kind) {
  if (faceFeat() || contourFeat()) { toast('This part is sheet metal — ' + (kind === 'revolve' ? 'Revolve' : 'Extrude') + ' is for solid parts. Start a new part for a solid.'); return; }
  if (mfState !== 'ok') { toast(mfState === 'failed' ? 'The 3D kernel could not start in this browser' : 'The 3D kernel is still loading — try again in a moment'); return; }
  if (exPick === kind) { exPick = null; refresh(); G3.rebuild = true; dirty3 = true; return; }
  finishPoly(); closePop(); exClose(); sel = [];
  const c = exCands(); if (!c.length) { toast('Draw a closed shape in a sketch first — Start 2D Sketch, draw, Finish Sketch'); return; }
  if (c.length === 1) { const r = cutRegions(c[0].sk); if (r.length === 1) { exStart(kind, c[0], innerPt(r[0])); return; } }
  exPick = kind;
  if (mode === 'sketch' && !(model && model.outer)) { ribTab = '3d'; tool = { name: 'face', step: 0, ex: true }; buildRibbon(); refresh(); toast('Tap inside the closed shape to ' + kind); return; }
  if (mode !== 'model') setMode('model'); ribTab = '3d'; buildRibbon(); G3.rebuild = true; dirty3 = true; refresh(); toast('Tap inside the shape to ' + kind);
}
function exPick2D(w) {            // sketch view (no body yet)
  const sf = feat(actId), h = cutRegions(sf.sk).filter(l => pointInPoly(w.x, w.y, l.poly))[0]; if (!h) { toast('Tap inside a closed shape'); return; }
  exStart(exPick || 'extrude', sf, { x: w.x, y: w.y });
}
function exPick3D(px, py) {
  let best = null;
  for (const f of exCands()) { const w = rayPlane(px, py, skFrame(f)); if (!w) continue; if (cutRegions(f.sk).some(l => pointInPoly(w.x, w.y, l.poly)) && (!best || w.k < best.w.k)) best = { f, w }; }
  if (!best) { toast('Tap inside a closed shape of a sketch (orange lines)'); return; }
  exStart(exPick, best.f, { x: best.w.x, y: best.w.y });
}
function exStart(kind, sf, pt) {
  exPick = null; tool = { name: 'select', step: 0 };
  const X = { id: 'f' + (part.nf++), type: kind, sk: sf.id, pick: [pt] };
  if (kind === 'extrude') { X.name = nextName('extrude', 'Extrusion'); X.d = lastExD || 1; }
  else { X.name = nextName('revolve', 'Revolution'); X.ang = 360;
    const lines = Object.entries(sf.sk.ents).filter(([, e]) => e.t === 'line' && !e.proj), con = lines.filter(([, e]) => e.con), reg = profLoops(sf, [pt])[0];
    // axis: the only construction line, else the profile's longest straight edge is offered first (tap another line in the bar to change)
    if (con.length === 1) X.ax = con[0][0]; else { let bl = -1; for (const [id, e] of lines) { const a = sf.sk.pts[e.a], b = sf.sk.pts[e.b], L = hyp(a.x - b.x, a.y - b.y); if (L > bl) { bl = L; X.ax = id; } } }
    if (!X.ax || !reg) { toast('Revolve needs a line in the sketch to spin around'); return; } }
  part.solid = true; part.feats.push(X); sf.vis = false; G3.fitNext = true; commitPart(); setMode('model'); exPanel(X);
  if (model && model.warn.length) toast(model.warn[model.warn.length - 1]);
}
function exClose(quiet) { if (!exActive && !document.querySelector('#exbar')) return; exActive = null; const b = document.querySelector('#exbar'); if (b) b.remove(); if (!quiet) { G3.rebuild = true; dirty3 = true; } }
function exBarPaint() {
  const b = document.querySelector('#exbar'), X = exActive && feat(exActive); if (!b || !X) return; const o = model && model.ops && model.ops[X.id], first = solidFeats().filter(f => !f.off)[0] === X;
  const inp = b.querySelector('input'); if (inp && document.activeElement !== inp) inp.value = X.type === 'revolve' ? fmt(X.ang || 360) : X.thru ? 'through' : fmt(Math.abs(X.d));
  b.querySelectorAll('[data-op]').forEach(q => { q.style.display = first ? 'none' : ''; q.classList.toggle('on', !!o && o.op === q.dataset.op); });
  const th = b.querySelector('[data-thru]'); if (th) { th.style.display = first || !(o && o.op === 'cut') ? 'none' : ''; th.classList.toggle('on', !!X.thru); }
}
function tiltView(fr) {          // looking straight at the profile the arrow points at the eye and cannot be dragged: tip the view so it can
  const ce = Math.cos(G3.el), v = [ce * Math.cos(G3.az), ce * Math.sin(G3.az), Math.sin(G3.el)]; if (Math.abs(dot3(v, fr.n)) < 0.9) return;
  const s = dot3(v, fr.n) < 0 ? -1 : 1, ky = Math.abs(fr.n[2]) > 0.9 ? -0.64 : 0.5, d = [0, 1, 2].map(i => fr.n[i] * 0.62 * s + fr.ex[i] * 0.45 + fr.ey[i] * ky), L = hyp(d[0], d[1], d[2]), az1 = Math.atan2(d[1], d[0]), el1 = Math.asin(Math.max(-1, Math.min(1, d[2] / L)));
  let daz = az1 - G3.az; while (daz > PI) daz -= TAU; while (daz < -PI) daz += TAU; const a0 = G3.az, e0 = G3.el, t0 = performance.now();
  const tick = now => { const k = Math.min(1, (now - t0) / 350), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k); G3.az = a0 + daz * e; G3.el = e0 + (el1 - e0) * e; G3.rebuild = true; dirty3 = true; if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function exPanel(X) {
  exClose(true); closeFlPanel(); if (selFace) selFace = null; exActive = X.id;
  if (X.type === 'extrude' && feat(X.sk)) tiltView(skFrame(feat(X.sk)));
  const upd = () => { commitPart(); exBarPaint(); updateInfo(); };
  const inp = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': X.type === 'revolve' ? 'Angle' : 'Distance' });
  const use = () => { if (X.type === 'revolve') { const v = parseNum(inp.value); if (v > 0 && v <= 360) { X.ang = v; upd(); } else exBarPaint(); return; }
    const v = parseLen(inp.value); if (v > 0 && isFinite(v)) { X.d = (X.d < 0 || X.thru ? -1 : 1) * v; delete X.thru; lastExD = v; upd(); } else exBarPaint(); };
  inp.addEventListener('change', use); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { inp.blur(); } e.stopPropagation(); }); inp.addEventListener('focus', () => inp.select());
  const bar = el('div', { id: 'exbar' }, el('span', { class: 'nm' }, X.name), inp, el('span', {}, X.type === 'revolve' ? '°' : 'in'),
    X.type === 'extrude' ? el('button', { title: 'Flip direction', onclick: () => { X.d = -X.d; if (X.op) delete X.op; delete X.thru; upd(); } }, 'Flip') : null,
    el('button', { 'data-op': 'join', onclick: () => { X.op = 'join'; delete X.thru; upd(); } }, 'Join'),
    el('button', { 'data-op': 'cut', onclick: () => { X.op = 'cut'; upd(); } }, 'Cut'),
    X.type === 'extrude' ? el('button', { 'data-thru': '1', onclick: () => { if (X.thru) delete X.thru; else { X.thru = true; X.op = 'cut'; } upd(); } }, 'Through all') : null,
    el('button', { class: 'pri', onclick: () => { exClose(); refresh(); } }, 'OK'),
    el('button', { style: 'color:var(--danger)', onclick: () => { const sf = feat(X.sk); part.feats = part.feats.filter(f => f !== X); if (sf && !sketchUsed(sf)) delete sf.vis; if (!solidFeats().length) part.solid = false; exClose(); commitPart(); updateInfo(); if (!part.solid) { activate(part.feats[0].id); setMode('sketch'); } toast(X.name + ' deleted'); } }, 'Delete'));
  $('#stage').append(bar); G3.rebuild = true; dirty3 = true; exBarPaint(); refresh();
}
// parts saved by the first Extrude build (a plate with part.solid) become real extrusions
function migrateSolid(p) {
  if (!p || !p.solid || p.feats.some(f => f.type === 'extrude' || f.type === 'revolve')) return p; const out = [];
  for (const f of p.feats) { if (f.type === 'face') out.push({ id: f.id, type: 'extrude', name: 'Extrusion1', sk: f.sk, pick: [f.pt || { x: 0, y: 0 }], d: p.t || 1 }); else if (f.type === 'cut' && f.pick) out.push({ id: f.id, type: 'extrude', name: f.name, sk: f.sk, pick: f.pick, d: -1, thru: true, op: 'cut' }); else if (f.type === 'sketch' || f.type === 'extrude') out.push(f); }
  p.feats = out; return p;
}
for (const [k, g] of Object.entries({ mf: () => mfState, exActive: () => exActive, exPick: () => exPick, selFace: () => selFace })) Object.defineProperty(window.QC, k, { get: g });
Object.assign(window.QC, { extrudeButton, exStart, exPanel, exClose, buildSolid, solidTap, hitSolid, skFrame, rayPlane, faceFrame, solidFeats, profLoops });
