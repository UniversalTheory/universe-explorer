/**
 * Facade: one call to get the heliocentric ecliptic state of any catalogued
 * body at a given instant, plus its orientation and an orbit curve.
 */
import { mmul, vadd, type Mat3, type Vec3 } from '@/core/math3';
import type { SimTime } from '@/core/time';
import { body, BODIES, BODY_MAP, type BodyDef } from '@/data/catalog';
import { bodyFixedToEqj, bodyPole } from './iau';
import { EQJ_TO_ECL } from './frames';
import { conicState, sampleConic, type OrbitState } from './kepler';
import { moonOrbitPath, moonState } from './moons';
import { galileanStates, GM, moonGeoState, planetState } from './planets';
import { smallBodyOrbitPath, smallBodyState } from './smallbodies';
import { Trajectory } from './spacecraft';
import { Satellite } from './tle';
import { elementsFromState } from './orbit-elements';
import type { EphemerisData } from './types';
import { StarCatalog } from './stars';
import { ExoCatalog, exoplanetOrbitPath, exoplanetState, type ExoJson } from './exoplanets';
import { DeepSkyCatalog, type DsoJson } from './deepsky';
import { binaryOrbitPath, binaryState } from './binary';

const ZERO: OrbitState = { pos: [0, 0, 0], vel: [0, 0, 0] };

export interface OrbitCurve {
  /** Points in ECL km, relative to `relativeTo` (heliocentric if 'sun'). */
  points: Vec3[];
  relativeTo: string;
  /** True when the curve is a flown/planned trajectory rather than a closed orbit. */
  isTrajectory?: boolean;
}

export class Ephemeris {
  private cacheKey = NaN;
  private relCache = new Map<string, OrbitState | null>();
  private helioCache = new Map<string, OrbitState | null>();
  private galileanCache: OrbitState[] | null = null;

  constructor(
    readonly data: EphemerisData,
    readonly trajectories: Map<string, Trajectory>,
    readonly satellites: Map<string, Satellite>,
    /** Star catalogue; scripts that only need Solar System bodies may omit it. */
    readonly stars: StarCatalog = new StarCatalog(new ArrayBuffer(0)),
    readonly exo: ExoCatalog | null = null,
    readonly deepSky: DeepSkyCatalog | null = null,
  ) {}

  static async load(base = 'data/'): Promise<Ephemeris> {
    const data = (await (await fetch(base + 'ephemeris.json')).json()) as EphemerisData;
    const trajectories = new Map<string, Trajectory>();
    await Promise.all(
      Object.entries(data.spacecraft ?? {}).map(async ([id, idx]) => {
        const buf = await (await fetch(base + idx.file)).arrayBuffer();
        trajectories.set(id, new Trajectory(buf));
      }),
    );
    const satellites = new Map<string, Satellite>();
    for (const [id, tle] of Object.entries(data.tle ?? {})) if (Array.isArray(tle)) satellites.set(id, new Satellite(tle));
    const stars = new StarCatalog(await (await fetch(base + data.stars.file)).arrayBuffer(), data.stars.stride);
    let exo: ExoCatalog | null = null;
    if (data.exoplanets) {
      const [json, bin] = await Promise.all([fetch(base + data.exoplanets.file).then((r) => r.json() as Promise<ExoJson>), fetch(base + data.exoplanets.bin).then((r) => r.arrayBuffer())]);
      exo = new ExoCatalog(json, bin);
    }
    let deepSky: DeepSkyCatalog | null = null;
    if (data.deepSky) deepSky = new DeepSkyCatalog((await (await fetch(base + data.deepSky.file)).json()) as DsoJson);
    return new Ephemeris(data, trajectories, satellites, stars, exo, deepSky);
  }

  /** Exoplanet record for a catalogue key (the archive planet name). */
  exoplanet(key: string) {
    const i = this.exo?.index(key);
    return i === undefined ? null : this.exo!.planets[i];
  }

  /** Index into the star catalogue for a catalogue key, if present. */
  starIndex(key: string): number | undefined { return this.data.stars.keys?.[key]; }

  /** Whether this body has ephemeris data available. */
  available(def: BodyDef): boolean {
    const s = def.source;
    switch (s.kind) {
      case 'moon': return !!this.data.moons?.[s.key];
      case 'sbdb': return !!this.data.smallBodies?.[s.key];
      case 'spacecraft': return this.trajectories.has(s.key);
      case 'tle': return this.satellites.has(s.key);
      case 'star': return this.starIndex(s.key) !== undefined;
      case 'exoplanet': return this.exoplanet(s.key) !== null && !!def.parent;
      case 'binary': return !!def.parent && BODY_MAP.has(def.parent);
      default: return true;
    }
  }

  /** Bodies present in both the catalogue and the data. */
  availableBodies(): BodyDef[] {
    return BODIES.filter((b) => this.available(b));
  }

  private tick(t: SimTime) {
    if (this.cacheKey !== t.tt) {
      this.cacheKey = t.tt;
      this.relCache.clear();
      this.helioCache.clear();
      this.galileanCache = null;
    }
  }

  /** State relative to the body's parent (the Sun for heliocentric bodies). Null if unavailable at this time. */
  relative(id: string, t: SimTime): OrbitState | null {
    this.tick(t);
    const cached = this.relCache.get(id);
    if (cached !== undefined) return cached;
    const r = this.computeRelative(body(id), t);
    this.relCache.set(id, r);
    return r;
  }

  private computeRelative(def: BodyDef, t: SimTime): OrbitState | null {
    const s = def.source;
    switch (s.kind) {
      case 'sun': return ZERO;
      case 'fixed': return { pos: [s.pos[0], s.pos[1], s.pos[2]], vel: [0, 0, 0] };
      case 'star': {
        const i = this.starIndex(s.key);
        return i === undefined ? null : this.stars.state(i, t.tt / 365.25);
      }
      case 'exoplanet': {
        const p = this.exoplanet(s.key);
        const host = def.parent ? this.state(def.parent, t) : null;
        return p && host ? exoplanetState(p, host.pos, t.jd) : null;
      }
      case 'binary': {
        const host = def.parent ? this.state(def.parent, t) : null;
        return host ? binaryState(s.el, host.pos, t.jd) : null;
      }
      case 'planet': return planetState(s.aeBody, t.astro);
      case 'moon-ae': return moonGeoState(t.astro);
      case 'galilean': {
        if (!this.galileanCache) this.galileanCache = galileanStates(t.astro);
        return this.galileanCache[s.index];
      }
      case 'moon': {
        const el = this.data.moons?.[s.key];
        return el ? moonState(el, t.jd, t.tt) : null;
      }
      case 'sbdb': {
        const rec = this.data.smallBodies?.[s.key];
        return rec ? smallBodyState(rec, t.jd) : null;
      }
      case 'spacecraft': {
        const tr = this.trajectories.get(s.key);
        if (!tr || !tr.contains(t.jd)) return null;
        return tr.state(t.jd);
      }
      case 'tle': {
        const sat = this.satellites.get(s.key);
        return sat ? sat.state(t.astro) : null;
      }
    }
  }

  /** Heliocentric ECL state (km, km/s). Null if unavailable at this time. */
  state(id: string, t: SimTime): OrbitState | null {
    this.tick(t);
    const cached = this.helioCache.get(id);
    if (cached !== undefined) return cached;
    const def = body(id);
    const rel = this.relative(id, t);
    let out: OrbitState | null = null;
    if (rel) {
      if (def.parent) {
        const p = this.state(def.parent, t);
        out = p ? { pos: vadd(p.pos, rel.pos), vel: vadd(p.vel, rel.vel) } : null;
      } else out = rel;
    }
    this.helioCache.set(id, out);
    return out;
  }

  /** Body-fixed -> ECL rotation matrix. */
  orientation(id: string, t: SimTime): Mat3 {
    const def = body(id);
    const hours = def.rotationHours ?? (def.type === 'moon' && def.orbitDays ? def.orbitDays * 24 : undefined);
    return mmul(EQJ_TO_ECL, bodyFixedToEqj(bodyPole(id, t.tt, hours)));
  }

  /** Orbit / trajectory curve for drawing. */
  orbitCurve(id: string, t: SimTime): OrbitCurve | null {
    const def = body(id);
    const s = def.source;
    switch (s.kind) {
      case 'sun': case 'fixed': case 'star': return null;
      case 'moon': {
        const el = this.data.moons?.[s.key];
        return el ? { points: moonOrbitPath(el, t.jd, t.tt), relativeTo: def.parent! } : null;
      }
      case 'sbdb': {
        const rec = this.data.smallBodies?.[s.key];
        return rec ? { points: smallBodyOrbitPath(rec), relativeTo: 'sun' } : null;
      }
      case 'spacecraft': {
        const tr = this.trajectories.get(s.key);
        return tr ? { points: tr.path(1), relativeTo: 'sun', isTrajectory: true } : null;
      }
      case 'exoplanet': {
        const p = this.exoplanet(s.key);
        const host = def.parent ? this.state(def.parent, t) : null;
        return p && host ? { points: exoplanetOrbitPath(p, host.pos), relativeTo: def.parent! } : null;
      }
      case 'binary': {
        const host = def.parent ? this.state(def.parent, t) : null;
        return host ? { points: binaryOrbitPath(s.el, host.pos), relativeTo: def.parent! } : null;
      }
      default: {
        // Osculating conic from the current state relative to the parent.
        const rel = this.relative(id, t);
        if (!rel) return null;
        const parent = def.parent ?? 'sun';
        const gm = GM[parent] ?? GM.sun;
        const el = elementsFromState(rel.pos, rel.vel, gm, t.jd);
        const segs = s.kind === 'tle' ? 128 : 256;
        return { points: sampleConic(el, segs, 1e12), relativeTo: parent };
      }
    }
  }

  /** Osculating orbital period in days, if bound. */
  periodDays(id: string, t: SimTime): number | null {
    const def = body(id);
    if (def.source.kind === 'fixed' || def.source.kind === 'star') return null;
    if (def.source.kind === 'exoplanet') return this.exoplanet(def.source.key)?.per ?? null;
    if (def.source.kind === 'binary') return def.source.el.per;
    const rel = this.relative(id, t);
    if (!rel) return null;
    const gm = GM[def.parent ?? 'sun'] ?? GM.sun;
    const el = elementsFromState(rel.pos, rel.vel, gm, t.jd);
    if (el.e >= 1) return null;
    const a = el.q / (1 - el.e);
    return (2 * Math.PI * Math.sqrt((a * a * a) / gm)) / 86400;
  }

  /** Convenience: propagate a conic element set (used by tests). */
  static conic = conicState;
}
