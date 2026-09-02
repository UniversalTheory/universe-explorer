/**
 * Build-time data pipeline. Fetches from free public sources and bakes
 * compact static files into public/data so the app needs no network at runtime.
 *
 *   - JPL Horizons (moon osculating elements -> fitted mean elements, spacecraft state vectors)
 *   - JPL Small-Body Database (comet / asteroid / dwarf-planet elements + physical data)
 *   - HYG star database v4.1 (CC BY-SA 4.0) -> bright-star binary
 *   - Celestrak TLEs for ISS and Hubble
 *
 * Usage: npm run data:build [-- --only=moons,spacecraft,smallbodies,stars,tle]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { DEG, wrap180, wrap360 } from '../src/core/math3';

const OUT = 'public/data';
mkdirSync(`${OUT}/spacecraft`, { recursive: true });
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const want = (k: string) => only.length === 0 || only.includes(k);

const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string, tries = 4): Promise<string> {
  for (let k = 0; k < tries; k++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'UniverseExplorer/0.1 (data pipeline)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      console.warn(`  retry ${k + 1}: ${(e as Error).message}`);
      await sleep(1500 * (k + 1));
    }
  }
  throw new Error(`failed: ${url}`);
}

async function horizons(params: Record<string, string>): Promise<string> {
  const u = new URL(HORIZONS);
  u.searchParams.set('format', 'text');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, `'${v}'`);
  return fetchText(u.toString());
}

/** Extract the CSV rows between $$SOE and $$EOE. */
function soeRows(text: string): string[][] {
  const a = text.indexOf('$$SOE'), b = text.indexOf('$$EOE');
  if (a < 0 || b < 0) throw new Error('No $$SOE block:\n' + text.slice(0, 600));
  return text
    .slice(a + 5, b)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(',').map((s) => s.trim()));
}

const jdOf = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000 + 2440587.5;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** "1977-SEP-05 13:59:24.3830" -> JD */
function horizonsDateToJd(s: string): number {
  const m = s.match(/(\d{4})-([A-Z]{3})-(\d{2}) (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  if (!m) throw new Error('bad date ' + s);
  const ms = Date.UTC(+m[1], MONTHS.indexOf(m[2].toUpperCase()), +m[3], +m[4], +m[5], Math.floor(+m[6]), 0);
  return ms / 86400000 + 2440587.5 + (+m[6] % 1) / 86400;
}
function jdToIso(jd: number): string {
  return new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 19);
}

// ---------------------------------------------------------------------------
// Moons: fit mean elements in the parent's body-equator frame.
// ---------------------------------------------------------------------------
interface MoonSpec { id: string; horizons: string; parent: string; center: string; periodDays: number }
const MOONS: MoonSpec[] = [
  { id: 'phobos', horizons: '401', parent: 'mars', center: '500@499', periodDays: 0.3189 },
  { id: 'deimos', horizons: '402', parent: 'mars', center: '500@499', periodDays: 1.2624 },
  { id: 'mimas', horizons: '601', parent: 'saturn', center: '500@699', periodDays: 0.942 },
  { id: 'enceladus', horizons: '602', parent: 'saturn', center: '500@699', periodDays: 1.370 },
  { id: 'tethys', horizons: '603', parent: 'saturn', center: '500@699', periodDays: 1.888 },
  { id: 'dione', horizons: '604', parent: 'saturn', center: '500@699', periodDays: 2.737 },
  { id: 'rhea', horizons: '605', parent: 'saturn', center: '500@699', periodDays: 4.518 },
  { id: 'titan', horizons: '606', parent: 'saturn', center: '500@699', periodDays: 15.945 },
  { id: 'iapetus', horizons: '608', parent: 'saturn', center: '500@699', periodDays: 79.32 },
  { id: 'miranda', horizons: '705', parent: 'uranus', center: '500@799', periodDays: 1.413 },
  { id: 'ariel', horizons: '701', parent: 'uranus', center: '500@799', periodDays: 2.520 },
  { id: 'umbriel', horizons: '702', parent: 'uranus', center: '500@799', periodDays: 4.144 },
  { id: 'titania', horizons: '703', parent: 'uranus', center: '500@799', periodDays: 8.706 },
  { id: 'oberon', horizons: '704', parent: 'uranus', center: '500@799', periodDays: 13.463 },
  { id: 'triton', horizons: '801', parent: 'neptune', center: '500@899', periodDays: 5.877 },
  { id: 'nereid', horizons: '802', parent: 'neptune', center: '500@899', periodDays: 360.13 },
  { id: 'proteus', horizons: '808', parent: 'neptune', center: '500@899', periodDays: 1.122 },
  { id: 'charon', horizons: '901', parent: 'pluto', center: '500@999', periodDays: 6.387 },
];

const EPOCH_JD = jdOf('2026-01-01');

function unwrapDeg(vals: number[]): number[] {
  const out = [vals[0]];
  for (let i = 1; i < vals.length; i++) {
    const prev = out[i - 1];
    let v = vals[i];
    const d = wrap180(v - prev);
    out.push(prev + d);
  }
  return out;
}
function linfit(t: number[], y: number[]): { a: number; b: number } {
  const n = t.length;
  let st = 0, sy = 0, stt = 0, sty = 0;
  for (let i = 0; i < n; i++) { st += t[i]; sy += y[i]; stt += t[i] * t[i]; sty += t[i] * y[i]; }
  const b = (n * sty - st * sy) / (n * stt - st * st);
  const a = (sy - b * st) / n;
  return { a, b };
}
/**
 * Fit amplitude*[sin,cos](phi0 + rate*t) to samples given as (amp_i, angle_i) by
 * scanning the rate and de-rotating: returns the rate minimising the scatter.
 */
function fitPrecession(t: number[], amp: number[], angDeg: number[], maxRateDegPerDay: number) {
  const best = { rate: 0, score: Infinity, h: 0, k: 0 };
  const evalRate = (rate: number) => {
    let sh = 0, sk = 0;
    const n = t.length;
    const hs = new Float64Array(n), ks = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = (angDeg[i] - rate * t[i]) * DEG;
      hs[i] = amp[i] * Math.sin(a); ks[i] = amp[i] * Math.cos(a);
      sh += hs[i]; sk += ks[i];
    }
    const mh = sh / n, mk = sk / n;
    let v = 0;
    for (let i = 0; i < n; i++) v += (hs[i] - mh) ** 2 + (ks[i] - mk) ** 2;
    return { score: v, h: mh, k: mk };
  };
  const scan = (lo: number, hi: number, steps: number) => {
    for (let s = 0; s <= steps; s++) {
      const rate = lo + ((hi - lo) * s) / steps;
      const r = evalRate(rate);
      if (r.score < best.score) Object.assign(best, { rate, ...r });
    }
  };
  scan(-maxRateDegPerDay, maxRateDegPerDay, 4000);
  const w = (2 * maxRateDegPerDay) / 4000;
  scan(best.rate - w, best.rate + w, 400);
  const w2 = (2 * w) / 400;
  scan(best.rate - w2, best.rate + w2, 200);
  return best;
}

type V3 = [number, number, number];
const vdot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vnorm3 = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Orbit normal and periapsis direction from Ω, i, ω (degrees) in the elements' frame. */
function orbitAxes(Om: number, inc: number, w: number): { n: V3; p: V3 } {
  const cO = Math.cos(Om * DEG), sO = Math.sin(Om * DEG), ci = Math.cos(inc * DEG), si = Math.sin(inc * DEG);
  const cw = Math.cos(w * DEG), sw = Math.sin(w * DEG);
  const n: V3 = [si * sO, -si * cO, ci];
  const p: V3 = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
  return { n, p };
}

/** Find the pole about which the orbit normals precess (minimum variance of n·p). */
function fitLaplacePole(normals: V3[]): { pole: V3; spreadDeg: number } {
  const mean = vnorm3(normals.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]] as V3, [0, 0, 0]));
  let spread = 0;
  for (const n of normals) spread = Math.max(spread, Math.acos(Math.min(1, vdot3(n, mean))) / DEG);
  if (spread < 0.3) return { pole: mean, spreadDeg: spread }; // no measurable precession
  const score = (p: V3) => {
    let s = 0, ss = 0;
    for (const n of normals) { const d = vdot3(n, p); s += d; ss += d * d; }
    return ss / normals.length - (s / normals.length) ** 2;
  };
  // Coarse search on a cap around the mean normal, then refine.
  const zAxis = mean;
  let xAxis = vnorm3(vcross3(Math.abs(zAxis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], zAxis));
  const yAxis = vcross3(zAxis, xAxis);
  const dir = (th: number, ph: number): V3 => {
    const st = Math.sin(th * DEG), ct = Math.cos(th * DEG);
    return vnorm3([
      st * Math.cos(ph * DEG) * xAxis[0] + st * Math.sin(ph * DEG) * yAxis[0] + ct * zAxis[0],
      st * Math.cos(ph * DEG) * xAxis[1] + st * Math.sin(ph * DEG) * yAxis[1] + ct * zAxis[1],
      st * Math.cos(ph * DEG) * xAxis[2] + st * Math.sin(ph * DEG) * yAxis[2] + ct * zAxis[2],
    ]);
  };
  let best = { th: 0, ph: 0, sc: score(zAxis) };
  const search = (th0: number, th1: number, dth: number, ph0: number, ph1: number, dph: number) => {
    for (let th = th0; th <= th1; th += dth) for (let ph = ph0; ph < ph1; ph += dph) {
      const sc = score(dir(th, ph));
      if (sc < best.sc) best = { th, ph, sc };
    }
  };
  search(0, 40, 0.25, 0, 360, 2);
  search(Math.max(0, best.th - 0.5), best.th + 0.5, 0.02, best.ph - 4, best.ph + 4, 0.1);
  search(Math.max(0, best.th - 0.04), best.th + 0.04, 0.002, best.ph - 0.2, best.ph + 0.2, 0.005);
  return { pole: dir(best.th, best.ph), spreadDeg: spread };
}

interface ElemRow { t: number; e: number; i: number; Om: number; w: number; M: number; a: number }
function parseElementRows(text: string): ElemRow[] {
  // CSV columns: JDTDB, CalDate, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
  return soeRows(text).map((r) => ({ t: +r[0] - EPOCH_JD, e: +r[2], i: +r[4], Om: +r[5], w: +r[6], M: +r[9], a: +r[11] }));
}

async function buildMoons() {
  const result: Record<string, unknown> = {};
  for (const m of MOONS) {
    console.log(`moon ${m.id}`);
    const common = { COMMAND: m.horizons, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'ELEMENTS', CENTER: m.center, REF_PLANE: 'B', OUT_UNITS: 'KM-S', CSV_FORMAT: 'YES' };
    // Pass 1: dense short arc -> unambiguous mean motion.
    const step1Min = Math.max(1, Math.round((m.periodDays / 6) * 1440));
    const span1 = Math.min(730, (2000 * step1Min) / 1440);
    const text1 = await horizons({ ...common, START_TIME: jdToIso(EPOCH_JD - span1 / 2), STOP_TIME: jdToIso(EPOCH_JD + span1 / 2), STEP_SIZE: `${step1Min} m` });
    const gmMatch = text1.match(/Keplerian GM\s*:\s*([0-9.E+-]+)/i);
    if (!gmMatch) throw new Error('no GM for ' + m.id);
    const gm = +gmMatch[1];
    const rows1 = parseElementRows(text1);
    const L1 = unwrapDeg(rows1.map((r) => wrap360(r.Om + r.w + r.M)));
    const n1 = linfit(rows1.map((r) => r.t), L1).b;
    await sleep(300);
    // Pass 2: 20-year arc, unwrapped with the pass-1 mean motion.
    const SPAN2 = 20 * 365.25;
    const step2Min = Math.round((SPAN2 / 4000) * 1440);
    const text2 = await horizons({ ...common, START_TIME: jdToIso(EPOCH_JD - SPAN2 / 2), STOP_TIME: jdToIso(EPOCH_JD + SPAN2 / 2), STEP_SIZE: `${step2Min} m` });
    const rows = parseElementRows(text2);
    const t = rows.map((r) => r.t);
    const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
    const a = mean(rows.map((r) => r.a));
    // Laplace pole from the orbit normals; re-express the elements in that frame.
    const axes = rows.map((r) => orbitAxes(r.Om, r.i, r.w));
    const { pole, spreadDeg } = fitLaplacePole(axes.map((x) => x.n));
    const zL = pole;
    const xL = Math.abs(zL[2]) > 0.999999 ? ([1, 0, 0] as V3) : vnorm3(vcross3([0, 0, 1], zL)); // node of the Laplace plane on the frame equator
    const yL = vcross3(zL, xL);
    const toL = (v: V3): V3 => [vdot3(v, xL), vdot3(v, yL), vdot3(v, zL)];
    const iL: number[] = [], OmL: number[] = [], varpiL: number[] = [], LL: number[] = [];
    axes.forEach(({ n, p }, k) => {
      const nn = toL(n), pp = toL(p);
      const inc = Math.acos(Math.max(-1, Math.min(1, nn[2]))) / DEG;
      const node: V3 = Math.hypot(nn[0], nn[1]) < 1e-12 ? [1, 0, 0] : vnorm3([-nn[1], nn[0], 0]);
      const Om = wrap360(Math.atan2(node[1], node[0]) / DEG);
      // argument of periapsis: angle from node to p, measured in the orbit plane about n.
      const y = vcross3(nn, node);
      const w = wrap360(Math.atan2(vdot3(pp, y), vdot3(pp, node)) / DEG);
      iL.push(inc); OmL.push(Om); varpiL.push(Om + w); LL.push(Om + w + rows[k].M);
    });
    const inc = mean(iL);
    // Mean longitude: unwrap with the predicted rate, then fit L0 + n·τ + c·τ².
    const Lu: number[] = [LL[0]];
    for (let k = 1; k < LL.length; k++) {
      const pred = Lu[k - 1] + n1 * (t[k] - t[k - 1]);
      Lu.push(pred + wrap180(LL[k] - pred));
    }
    const qfit = quadfit(t, Lu);
    const nodeFit = fitPrecession(t, iL.map((v) => Math.sin(v * DEG)), OmL, 3);
    const periFit = fitPrecession(t, rows.map((r) => r.e), varpiL, 3);
    const ecc = Math.hypot(periFit.h, periFit.k);
    const el = {
      parent: m.parent, gm, epoch: EPOCH_JD, a, e: ecc, i: inc,
      /** Laplace-frame axes expressed in the parent's body-equator frame (rows = x, y, z). */
      frame: [...xL, ...yL, ...zL].map((v) => +v.toFixed(12)),
      Omega0: wrap360(Math.atan2(nodeFit.h, nodeFit.k) / DEG), OmegaDot: nodeFit.rate,
      varpi0: wrap360(Math.atan2(periFit.h, periFit.k) / DEG), varpiDot: periFit.rate,
      L0: wrap360(qfit.a), n: qfit.b, nDot: qfit.c,
      samples: rows.length,
      test: [] as { jd: number; pos: number[]; vel: number[] }[],
    };
    const vt = await horizons({
      COMMAND: m.horizons, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', CENTER: m.center,
      REF_PLANE: 'E', START_TIME: '2020-01-01', STOP_TIME: '2036-01-02', STEP_SIZE: '730 d', OUT_UNITS: 'KM-S', VEC_TABLE: '2', CSV_FORMAT: 'YES',
    });
    for (const r of soeRows(vt)) el.test.push({ jd: +r[0], pos: [+r[2], +r[3], +r[4]], vel: [+r[5], +r[6], +r[7]] });
    const poleTilt = Math.acos(Math.min(1, Math.abs(zL[2]))) / DEG;
    console.log(`  a=${a.toFixed(0)} e=${ecc.toFixed(5)} i=${inc.toFixed(3)} n=${qfit.b.toFixed(6)} n'=${qfit.c.toExponential(2)} Ω̇=${nodeFit.rate.toExponential(3)} ϖ̇=${periFit.rate.toExponential(3)} laplace tilt=${poleTilt.toFixed(3)}° (spread ${spreadDeg.toFixed(2)}°, ${rows.length} samples)`);
    result[m.id] = el;
    await sleep(300);
  }
  return result;
}

/** Least squares y = a + b t + c t². */
function quadfit(t: number[], y: number[]): { a: number; b: number; c: number } {
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, sy = 0, sty = 0, st2y = 0;
  for (let i = 0; i < t.length; i++) {
    const x = t[i], x2 = x * x;
    s0++; s1 += x; s2 += x2; s3 += x2 * x; s4 += x2 * x2; sy += y[i]; sty += x * y[i]; st2y += x2 * y[i];
  }
  // Solve the 3x3 normal equations by Cramer's rule.
  const det = (m: number[]) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  const A = [s0, s1, s2, s1, s2, s3, s2, s3, s4];
  const D = det(A);
  const a = det([sy, s1, s2, sty, s2, s3, st2y, s3, s4]) / D;
  const b = det([s0, sy, s2, s1, sty, s3, s2, st2y, s4]) / D;
  const c = det([s0, s1, sy, s1, s2, sty, s2, s3, st2y]) / D;
  return { a, b, c };
}

// ---------------------------------------------------------------------------
// Spacecraft: heliocentric ecliptic state vectors, Hermite-interpolated at runtime.
// ---------------------------------------------------------------------------
interface CraftSpec { id: string; horizons: string; segments: { start: string; stop: string; step: string }[] }
const CRAFT: CraftSpec[] = [
  { id: 'voyager1', horizons: '-31', segments: [{ start: '1977-09-05', stop: '1990-01-01', step: '2 d' }, { start: '1990-01-01', stop: '2070-01-01', step: '30 d' }] },
  { id: 'voyager2', horizons: '-32', segments: [{ start: '1977-08-20', stop: '1990-01-01', step: '2 d' }, { start: '1990-01-01', stop: '2070-01-01', step: '30 d' }] },
  { id: 'pioneer10', horizons: '-23', segments: [{ start: '1972-03-03', stop: '1985-01-01', step: '2 d' }, { start: '1985-01-01', stop: '2070-01-01', step: '30 d' }] },
  { id: 'pioneer11', horizons: '-24', segments: [{ start: '1973-04-06', stop: '1985-01-01', step: '2 d' }, { start: '1985-01-01', stop: '2070-01-01', step: '30 d' }] },
  { id: 'newhorizons', horizons: '-98', segments: [{ start: '2006-01-19', stop: '2008-01-01', step: '1 d' }, { start: '2008-01-01', stop: '2070-01-01', step: '10 d' }] },
  { id: 'jwst', horizons: '-170', segments: [{ start: '2021-12-25', stop: '2050-01-01', step: '1 d' }] },
  { id: 'parker', horizons: '-96', segments: [{ start: '2018-08-12', stop: '2050-01-01', step: '12 h' }] },
  { id: 'europaclipper', horizons: '-159', segments: [{ start: '2024-10-14', stop: '2050-01-01', step: '1 d' }] },
  { id: 'psyche', horizons: '-255', segments: [{ start: '2023-10-13', stop: '2050-01-01', step: '2 d' }] },
];

async function fetchVectors(cmd: string, start: string, stop: string, step: string): Promise<string[][] | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const text = await horizons({
      COMMAND: cmd, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', CENTER: '500@10', REF_PLANE: 'E',
      START_TIME: start, STOP_TIME: stop, STEP_SIZE: step, OUT_UNITS: 'KM-S', VEC_TABLE: '2', CSV_FORMAT: 'YES',
    });
    if (text.includes('$$SOE')) return soeRows(text);
    const prior = text.match(/prior to A\.D\. ([0-9A-Z:. -]+) TDB/i);
    const after = text.match(/after A\.D\. ([0-9A-Z:. -]+) TDB/i);
    if (prior) {
      const jd = horizonsDateToJd(prior[1]) + 1 / 24;
      start = jdToIso(jd); if (jdOf(start.slice(0, 10)) >= jdOf(stop)) return null;
      console.log(`    clamped start -> ${start}`);
    } else if (after) {
      const jd = horizonsDateToJd(after[1]) - 1 / 24;
      stop = jdToIso(jd); if (jdOf(stop.slice(0, 10)) <= jdOf(start.slice(0, 10))) return null;
      console.log(`    clamped stop -> ${stop}`);
    } else {
      console.warn('  horizons error:\n' + text.slice(0, 400));
      return null;
    }
  }
  return null;
}

async function buildSpacecraft() {
  const index: Record<string, unknown> = {};
  for (const c of CRAFT) {
    console.log(`spacecraft ${c.id}`);
    const rows: string[][] = [];
    for (const seg of c.segments) {
      const r = await fetchVectors(c.horizons, seg.start, seg.stop, seg.step);
      if (r) rows.push(...r);
      await sleep(300);
    }
    if (rows.length < 2) { console.warn(`  no data for ${c.id}`); continue; }
    rows.sort((x, y) => +x[0] - +y[0]);
    // Drop duplicate epochs at segment joins.
    const uniq = rows.filter((r, k) => k === 0 || +r[0] !== +rows[k - 1][0]);
    const n = uniq.length;
    const buf = new ArrayBuffer(8 + n * 8 + n * 6 * 4);
    new Uint32Array(buf, 0, 2).set([n, 0]);
    const times = new Float64Array(buf, 8, n);
    const states = new Float32Array(buf, 8 + n * 8, n * 6);
    uniq.forEach((r, k) => {
      times[k] = +r[0];
      for (let j = 0; j < 6; j++) states[k * 6 + j] = +r[2 + j];
    });
    writeFileSync(`${OUT}/spacecraft/${c.id}.bin`, Buffer.from(buf));
    index[c.id] = { file: `spacecraft/${c.id}.bin`, count: n, start: times[0], end: times[n - 1] };
    console.log(`  ${n} samples ${jdToIso(times[0])} .. ${jdToIso(times[n - 1])}`);
  }
  return index;
}

// ---------------------------------------------------------------------------
// Small bodies from the JPL Small-Body Database.
// ---------------------------------------------------------------------------
const SMALL_BODIES: { id: string; sstr: string }[] = [
  { id: 'ceres', sstr: '1' }, { id: 'pallas', sstr: '2' }, { id: 'juno', sstr: '3' }, { id: 'vesta', sstr: '4' },
  { id: 'hygiea', sstr: '10' }, { id: 'eros', sstr: '433' }, { id: 'chiron', sstr: '2060' }, { id: 'phaethon', sstr: '3200' },
  { id: 'apophis', sstr: '99942' }, { id: 'bennu', sstr: '101955' },
  { id: 'eris', sstr: '136199' }, { id: 'haumea', sstr: '136108' }, { id: 'makemake', sstr: '136472' },
  { id: 'sedna', sstr: '90377' }, { id: 'gonggong', sstr: '225088' }, { id: 'quaoar', sstr: '50000' }, { id: 'orcus', sstr: '90482' },
  { id: 'halley', sstr: '1P' }, { id: 'encke', sstr: '2P' }, { id: 'churyumov', sstr: '67P' }, { id: 'halebopp', sstr: 'C/1995 O1' },
  { id: 'neowise', sstr: 'C/2020 F3' }, { id: 'swifttuttle', sstr: '109P' }, { id: 'templetuttle', sstr: '55P' },
  { id: 'tsuchinshan', sstr: 'C/2023 A3' }, { id: 'ponsbrooks', sstr: '12P' }, { id: 'oumuamua', sstr: '1I' }, { id: 'atlas3i', sstr: '3I' },
];

async function buildSmallBodies() {
  const out: Record<string, unknown> = {};
  for (const b of SMALL_BODIES) {
    console.log(`small body ${b.id} (${b.sstr})`);
    const url = `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(b.sstr)}&phys-par=1`;
    let j: any;
    try { j = JSON.parse(await fetchText(url)); } catch (e) { console.warn('  failed', (e as Error).message); continue; }
    if (!j.orbit) { console.warn('  no orbit:', JSON.stringify(j).slice(0, 200)); continue; }
    const el: Record<string, number> = {};
    for (const x of j.orbit.elements) el[x.name] = +x.value;
    const phys: Record<string, number | string> = {};
    for (const x of j.phys_par ?? []) phys[x.name] = isNaN(+x.value) ? x.value : +x.value;
    out[b.id] = {
      fullname: j.object.fullname, kind: j.object.kind, orbitClass: j.object.orbit_class?.name,
      epoch: +j.orbit.epoch, q: el.q, e: el.e, i: el.i, Omega: el.om, omega: el.w, tp: el.tp, a: el.a, period: el.per,
      phys: { diameter: phys.diameter, rotPeriod: phys.rot_per, albedo: phys.albedo, H: phys.H, GM: phys.GM, density: phys.density },
      firstObs: j.orbit.first_obs, moid: +j.orbit.moid,
    };
    await sleep(250);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stars: HYG v4.1 -> [ra, dec, mag, ci, dist] float32 + names.
// ---------------------------------------------------------------------------
async function buildStars() {
  const cache = 'node_modules/.cache/hygdata_v40.csv';
  let csv: string;
  if (existsSync(cache)) csv = readFileSync(cache, 'utf8');
  else {
    console.log('downloading HYG…');
    const r = await fetch('https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v40.csv.gz');
    csv = gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8');
    mkdirSync('node_modules/.cache', { recursive: true });
    writeFileSync(cache, csv);
  }
  const lines = csv.split('\n');
  const unq = (v: string) => v.replace(/^"|"$/g, '');
  const head = lines[0].split(',').map(unq);
  const col = (n: string) => head.indexOf(n);
  const cRa = col('ra'), cDec = col('dec'), cMag = col('mag'), cCi = col('ci'), cDist = col('dist'), cProper = col('proper'), cBayer = col('bayer'), cCon = col('con'), cId = col('id');
  const rows: { ra: number; dec: number; mag: number; ci: number; dist: number; name: string }[] = [];
  for (let k = 1; k < lines.length; k++) {
    const f = lines[k].split(',').map(unq);
    if (f.length < head.length) continue;
    if (f[cId] === '0') continue; // the Sun
    const mag = +f[cMag];
    const proper = f[cProper];
    if (mag > 6.5 && !proper) continue;
    let name = proper;
    if (!name && mag < 3.0 && f[cBayer]) name = `${f[cBayer]} ${f[cCon]}`;
    rows.push({ ra: +f[cRa] * 15, dec: +f[cDec], mag, ci: +f[cCi] || 0, dist: +f[cDist], name });
  }
  rows.sort((a, b) => a.mag - b.mag);
  const buf = new Float32Array(rows.length * 5);
  rows.forEach((r, i) => buf.set([r.ra, r.dec, r.mag, r.ci, r.dist], i * 5));
  writeFileSync(`${OUT}/stars.bin`, Buffer.from(buf.buffer));
  const names = rows.map((r, i) => (r.name ? [i, r.name] : null)).filter(Boolean);
  console.log(`stars: ${rows.length} (${names.length} named)`);
  return { file: 'stars.bin', count: rows.length, stride: 5, names };
}

// ---------------------------------------------------------------------------
async function buildTle() {
  const out: Record<string, string[]> = {};
  for (const [id, catnr] of [['iss', '25544'], ['hubble', '20580']]) {
    const t = await fetchText(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=TLE`);
    const l = t.trim().split('\n').map((s) => s.trimEnd());
    if (l.length >= 3) out[id] = [l[0].trim(), l[1], l[2]];
    await sleep(500);
  }
  return { fetched: new Date().toISOString(), ...out };
}

// ---------------------------------------------------------------------------
async function main() {
  const file = `${OUT}/ephemeris.json`;
  const data: any = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  data.generated = new Date().toISOString();
  if (want('moons')) data.moons = await buildMoons();
  if (want('smallbodies')) data.smallBodies = await buildSmallBodies();
  if (want('spacecraft')) data.spacecraft = await buildSpacecraft();
  if (want('stars')) data.stars = await buildStars();
  if (want('tle')) data.tle = await buildTle();
  writeFileSync(file, JSON.stringify(data));
  console.log('wrote', file);
}
main().catch((e) => { console.error(e); process.exit(1); });
