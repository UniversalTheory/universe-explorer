/**
 * Scene manager: owns every renderable body and keeps it in sync with the
 * ephemeris for the current simulation time and floating origin.
 */
import * as THREE from 'three';
import { BODIES, body, type BodyDef } from '@/data/catalog';
import type { Ephemeris } from '@/ephemeris/Ephemeris';
import type { SimTime } from '@/core/time';
import type { Vec3 } from '@/core/math3';
import type { SettingsState } from '@/core/Settings';
import { BodyObject } from './BodyObject';
import { SunObject } from './SunObject';
import { OrbitLine } from './OrbitLine';
import { Belts } from './Belts';
import type { LabelEntry } from './Labels';
import { CometVisual } from './Comet';
import { WORLD_UNIT_KM } from '@/ephemeris/frames';
import { StarCloud } from './StarCloud';

/** Beyond this distance from the camera (km, ≈ 27,000 AU) Solar System bodies are sub-pixel and hidden. */
const FAR_HIDE_KM = 4e12;
/** Deep star tier is fetched once the camera is this far from the Sun (km) or a star is focused. */
const DEEP_TIER_KM = 5e13;

const PRIORITY: Record<string, number> = {
  star: 100, planet: 90, dwarf: 50, moon: 40, asteroid: 30, comet: 32, interstellar: 34, spacecraft: 20,
  exoplanet: 45, nebula: 60, cluster: 58, blackhole: 62, neutron: 56, region: 10,
};
/** Minimum on-screen radius (px) enforced in visual scale mode. */
const MIN_PX: Record<string, number> = {
  star: 9, planet: 5.5, dwarf: 3.5, moon: 3.2, asteroid: 2.4, comet: 2.4, interstellar: 2.4, spacecraft: 0,
  exoplanet: 4, nebula: 0, cluster: 0, blackhole: 4, neutron: 3, region: 0,
};
const ORBIT_REFRESH_DAYS: Record<string, number> = { planet: 20, dwarf: 30, moon: 0.75, tle: 0.02 };

interface OrbitEntry { line: OrbitLine; group: THREE.Group; parent: string; lastTT: number; isStatic: boolean }

export class Universe {
  readonly scene = new THREE.Scene();
  readonly sun: SunObject;
  readonly bodies = new Map<string, BodyObject>();
  /** Other stars drawn as spheres when close (their catalogue point is hidden meanwhile). */
  readonly stars = new Map<string, SunObject>();
  readonly orbits = new Map<string, OrbitEntry>();
  readonly belts: Belts;
  readonly starCloud: StarCloud;
  private deepTier: 'idle' | 'loading' | 'done' | 'failed' = 'idle';
  /** Named catalogue stars (not in the body catalogue) that get labels. */
  private cloudLabels: { index: number; name: string }[] = [];
  private cloudScreen = new Map<number, { x: number; y: number; visible: boolean; radiusPx: number; distance: number }>();
  private comets = new Map<string, CometVisual>();
  /** Heliocentric ECL positions (km) computed this frame. */
  private helio = new Map<string, Vec3>();
  private children = new Map<string, BodyDef[]>();
  private quality: 'high' | 'low';
  origin: Vec3 = [0, 0, 0];
  private elapsed = 0;

  constructor(readonly eph: Ephemeris, quality: 'high' | 'low', pixelRatio: number) {
    this.quality = quality;
    this.sun = new SunObject(body('sun'));
    this.scene.add(this.sun.group);
    for (const def of BODIES) {
      if (def.id === 'sun') continue;
      if (!eph.available(def)) continue;
      if (def.type === 'star') {
        const so = new SunObject(def, false);
        this.stars.set(def.id, so);
        this.scene.add(so.group);
        continue;
      }
      const obj = new BodyObject(def, quality);
      this.bodies.set(def.id, obj);
      this.scene.add(obj.group);
      if (def.type === 'comet' || def.type === 'interstellar') {
        const cv = new CometVisual(def.color);
        obj.group.add(cv.group);
        this.comets.set(def.id, cv);
      }
      const parent = def.parent ?? 'sun';
      const line = new OrbitLine(def.color, def.type === 'spacecraft' ? 0.22 : 0.3);
      const group = new THREE.Group();
      group.add(line.line);
      this.scene.add(group);
      const src = def.source.kind;
      this.orbits.set(def.id, { line, group, parent, lastTT: -Infinity, isStatic: src === 'sbdb' || src === 'spacecraft' });
      if (def.parent) {
        const arr = this.children.get(def.parent) ?? [];
        arr.push(def);
        this.children.set(def.parent, arr);
      }
    }
    this.belts = new Belts(pixelRatio);
    this.scene.add(this.belts.group);
    this.starCloud = new StarCloud(eph.stars, pixelRatio);
    this.scene.add(this.starCloud.group);
    // Labels for the brightest named stars that are not in the body catalogue.
    const keyed = new Set(Object.values(eph.data.stars.keys ?? {}));
    for (const [index, name] of eph.data.stars.names) {
      if (keyed.has(index) || eph.stars.mag[index] > 2.2) continue;
      this.cloudLabels.push({ index, name });
    }
  }

  /** Fetch the deep star tier once (on demand). */
  private loadDeepTier() {
    const meta = this.eph.data.stars.deep;
    if (!meta || this.deepTier !== 'idle') return;
    this.deepTier = 'loading';
    fetch('data/' + meta.file).then((r) => r.arrayBuffer()).then((buf) => {
      this.eph.stars.append(buf, this.eph.data.stars.stride);
      this.starCloud.rebuild();
      this.deepTier = 'done';
    }).catch((e) => { console.warn('deep star tier unavailable', e); this.deepTier = 'failed'; });
  }
  get deepTierState() { return this.deepTier; }

  /** Heliocentric ECL position for a body at the current frame's time (km). */
  helioOf(id: string): Vec3 | null {
    return this.helio.get(id) ?? null;
  }
  /** Displayed (exaggerated) radius in km. */
  displayedRadius(id: string): number {
    if (id === 'sun') return this.sun.def.radius * this.sun.displayScale;
    const st = this.stars.get(id);
    if (st) return st.def.radius * st.displayScale;
    const b = this.bodies.get(id);
    return b ? Math.max(b.def.radius * b.displayScale, 0.02) : 1;
  }
  worldPosition(id: string, out: THREE.Vector3): THREE.Vector3 {
    if (id === 'sun') return out.copy(this.sun.group.position);
    const st = this.stars.get(id);
    if (st) return out.copy(st.group.position);
    const b = this.bodies.get(id);
    return b ? out.copy(b.group.position) : out.set(0, 0, 0);
  }
  /** Screen record for any body, star or the Sun. */
  screenOf(id: string) {
    if (id === 'sun') return this.sun.screen;
    return this.bodies.get(id)?.screen ?? this.stars.get(id)?.screen;
  }
  isAvailable(id: string): boolean {
    if (id === 'sun') return true;
    return this.bodies.get(id)?.available ?? this.stars.get(id)?.available ?? false;
  }
  /** Heliocentric ECL km → Three.js world units relative to the floating origin (double precision until here). */
  private worldFromHelio(h: Vec3, out: THREE.Vector3): THREE.Vector3 {
    const k = 1 / WORLD_UNIT_KM;
    return out.set((h[0] - this.origin[0]) * k, (h[2] - this.origin[2]) * k, -(h[1] - this.origin[1]) * k);
  }

  /** Compute positions for time t (must be called before update()). */
  computePositions(t: SimTime) {
    this.helio.clear();
    this.helio.set('sun', [0, 0, 0]);
    for (const [id, obj] of this.bodies) {
      const s = this.eph.state(id, t);
      obj.available = !!s;
      if (s) { this.helio.set(id, s.pos); obj.helio = s.pos; }
    }
    for (const [id, st] of this.stars) {
      const s = this.eph.state(id, t);
      st.available = !!s;
      if (s) { this.helio.set(id, s.pos); st.helio = s.pos as [number, number, number]; }
    }
  }

  update(t: SimTime, dt: number, camera: THREE.PerspectiveCamera, settings: SettingsState, pxPerRad: number, pixelRatio: number, focusId: string, selectedId: string | null) {
    this.elapsed += dt;
    this.lastYears = t.tt / 365.25;
    const visual = settings.scaleMode === 'visual';
    const camPos = camera.position;
    // Positions relative to the floating origin.
    this.worldFromHelio([0, 0, 0], this.sun.group.position);
    const sunWorld = this.sun.group.position;
    for (const [id, obj] of this.bodies) {
      const h = this.helio.get(id);
      const typeVisible = this.typeVisible(obj.def, settings);
      if (!h || !typeVisible) { obj.setVisible(false); obj.screen.visible = false; continue; }
      this.worldFromHelio(h, obj.group.position);
      // Seen from the stars, the Solar System is a single point: hide everything but the Sun.
      if (obj.group.position.distanceTo(camPos) > FAR_HIDE_KM && id !== focusId && id !== selectedId) { obj.setVisible(false); obj.screen.visible = false; continue; }
      obj.setVisible(true);
      obj.setOrientation(this.eph.orientation(id, t));
      const minPx = visual ? MIN_PX[obj.def.type] ?? 3 : 0;
      obj.update(camPos, sunWorld, minPx / pxPerRad, obj.def.type === 'spacecraft' ? 7 : 4.5, pxPerRad);
      const cv = this.comets.get(id);
      if (cv) {
        const st = this.eph.state(id, t);
        const r = Math.hypot(h[0], h[1], h[2]);
        _anti.set(h[0], h[2], -h[1]).normalize();
        if (st) _vel.set(st.vel[0], st.vel[2], -st.vel[1]).normalize(); else _vel.set(0, 0, 0);
        cv.update(r, _anti, _vel, obj.screen.distance, pxPerRad);
      }
    }
    this.sun.update(camPos, camera.quaternion, visual ? MIN_PX.star / pxPerRad : 0, pxPerRad, this.elapsed, pixelRatio);
    // Other stars: sphere when close enough, otherwise their catalogue point.
    for (const [id, st] of this.stars) {
      const h = this.helio.get(id);
      const idx = st.def.source.kind === 'star' ? this.eph.starIndex(st.def.source.key) : undefined;
      if (!h || !settings.stars) { st.setVisible(false); st.screen.visible = false; if (idx !== undefined) this.starCloud.setHidden(idx, false); continue; }
      st.setVisible(true);
      this.worldFromHelio(h, st.group.position);
      st.update(camPos, camera.quaternion, 0, pxPerRad, this.elapsed, pixelRatio);
      if (idx !== undefined) this.starCloud.setHidden(idx, st.sphereVisible);
    }
    this.starCloud.setVisible(settings.stars);
    if (settings.stars) this.starCloud.update(this.origin, t.tt / 365.25, pxPerRad, pixelRatio, 1);
    const sunDist = this.sun.group.position.distanceTo(camPos);
    if (settings.deepStars && settings.stars && (sunDist > DEEP_TIER_KM || this.stars.has(focusId))) this.loadDeepTier();
    this.updateOccluders();
    this.updateOrbits(t, settings, camPos, pxPerRad, focusId, selectedId);
    this.belts.setVisible(settings.belts);
    if (settings.belts) this.belts.update(t.tt, new THREE.Vector3(this.origin[0], this.origin[2], -this.origin[1]), pxPerRad, pixelRatio);
    this.project(camera);
  }

  private typeVisible(def: BodyDef, s: SettingsState): boolean {
    switch (def.type) {
      case 'moon': return s.moons;
      case 'spacecraft': return s.spacecraft;
      case 'asteroid': case 'comet': case 'interstellar': return s.smallBodies;
      default: return true;
    }
  }

  /** For each body, the neighbours most likely to shadow it (parent, siblings, children), by angular size. */
  private updateOccluders() {
    const tmp: { pos: THREE.Vector3; radius: number; ang: number }[] = [];
    for (const [id, obj] of this.bodies) {
      if (!obj.group.visible || obj.def.type === 'spacecraft') continue;
      tmp.length = 0;
      const def = obj.def;
      const cands: BodyDef[] = [];
      if (def.parent) { cands.push(body(def.parent)); for (const s of this.children.get(def.parent) ?? []) if (s.id !== id) cands.push(s); }
      for (const c of this.children.get(id) ?? []) cands.push(c);
      for (const c of cands) {
        if (c.type === 'spacecraft') continue;
        const o = this.bodies.get(c.id);
        if (!o || !o.available) continue;
        const d = o.group.position.distanceTo(obj.group.position);
        if (d <= 0) continue;
        tmp.push({ pos: o.group.position, radius: c.radius, ang: c.radius / d });
      }
      tmp.sort((a, b) => b.ang - a.ang);
      obj.setOccluders(tmp.slice(0, 6));
    }
  }

  private updateOrbits(t: SimTime, settings: SettingsState, camPos: THREE.Vector3, pxPerRad: number, focusId: string, selectedId: string | null) {
    for (const [id, o] of this.orbits) {
      const obj = this.bodies.get(id)!;
      const show = settings.orbits && obj.group.visible && obj.available;
      if (!show) { o.line.setVisible(false); continue; }
      const def = obj.def;
      const highlighted = id === focusId || id === selectedId;
      // Minor bodies and spacecraft only show their paths when selected or focused.
      if (!highlighted && def.type !== 'planet' && def.type !== 'dwarf' && def.type !== 'moon') { o.line.setVisible(false); continue; }
      // Position the orbit at its parent.
      this.worldPosition(o.parent, o.group.position);
      // Hide orbits that would be sub-pixel clutter (moon orbits below 12 px; heliocentric ones below 3 px when zoomed out to the stars).
      const parentDist = o.group.position.distanceTo(camPos);
      {
        const rel = this.eph.relative(id, t);
        const sizePx = rel ? (Math.hypot(rel.pos[0], rel.pos[1], rel.pos[2]) / parentDist) * pxPerRad : 0;
        if (sizePx < (def.parent ? 12 : 3)) { o.line.setVisible(false); continue; }
      }
      // Refresh curve when stale.
      const refresh = o.isStatic ? Infinity : ORBIT_REFRESH_DAYS[def.source.kind === 'tle' ? 'tle' : def.type] ?? 5;
      if (o.lastTT === -Infinity || Math.abs(t.tt - o.lastTT) > refresh) {
        const curve = this.eph.orbitCurve(id, t);
        if (curve) o.line.setPoints(curve.points);
        o.lastTT = t.tt;
      }
      o.line.opacity = highlighted ? 0.75 : def.type === 'planet' ? 0.42 : 0.3;
      o.line.setVisible(true);
    }
  }

  private project(camera: THREE.PerspectiveCamera) {
    const v = _v;
    const doOne = (pos: THREE.Vector3, screen: { x: number; y: number; visible: boolean }) => {
      v.copy(pos).project(camera);
      screen.visible = v.z < 1 && v.z > -1;
      screen.x = (v.x + 1) / 2;
      screen.y = (1 - v.y) / 2;
    };
    doOne(this.sun.group.position, this.sun.screen);
    for (const obj of this.bodies.values()) {
      if (!obj.group.visible) { obj.screen.visible = false; continue; }
      doOne(obj.group.position, obj.screen);
    }
    for (const st of this.stars.values()) {
      if (!st.group.visible) { st.screen.visible = false; continue; }
      doOne(st.group.position, st.screen);
    }
    // Named cloud stars (positions recomputed from the catalogue; cheap for ~50 stars).
    const years = this.lastYears;
    for (const { index } of this.cloudLabels) {
      const p = this.eph.stars.position(index, years, _p3);
      _v2.set(p[0] - this.origin[0], p[2] - this.origin[2], -(p[1] - this.origin[1]));
      let rec = this.cloudScreen.get(index);
      if (!rec) { rec = { x: 0, y: 0, visible: false, radiusPx: 3, distance: 0 }; this.cloudScreen.set(index, rec); }
      rec.distance = _v2.distanceTo(camera.position);
      doOne(_v2, rec);
    }
  }
  private lastYears = 0;

  /** Label entries in CSS pixels. */
  labelEntries(width: number, height: number, settings: SettingsState, focusId: string, selectedId: string | null = null): LabelEntry[] {
    const out: LabelEntry[] = [];
    const add = (id: string, def: BodyDef, s: { x: number; y: number; visible: boolean; radiusPx: number; distance: number }, dim = false) => {
      out.push({ id, text: def.name, x: s.x * width, y: s.y * height, radiusPx: s.radiusPx, priority: PRIORITY[def.type] + (id === focusId ? 200 : 0), kind: def.type, visible: s.visible, dim });
    };
    if (settings.labels) {
      add('sun', this.sun.def, this.sun.screen);
      for (const [id, obj] of this.bodies) {
        if (!obj.group.visible || !obj.screen.visible) continue;
        const def = obj.def;
        if (def.parent) {
          // Only label satellites that are visibly separated from their parent.
          const p = id === 'sun' ? this.sun.screen : this.bodies.get(def.parent)?.screen ?? this.sun.screen;
          const sep = Math.hypot((obj.screen.x - p.x) * width, (obj.screen.y - p.y) * height);
          const parentR = this.bodies.get(def.parent)?.screen.radiusPx ?? 0;
          if (sep < Math.max(18, parentR + 10) && id !== focusId) continue;
        }
        // Skip tiny bodies that are far away unless focused.
        if (def.type !== 'planet' && obj.screen.radiusPx < 0.8 && obj.def.type !== 'spacecraft' && id !== focusId && obj.screen.distance > 5e8 * (def.type === 'dwarf' ? 30 : 6)) continue;
        add(id, def, obj.screen, def.type === 'spacecraft' || def.type === 'asteroid' || def.type === 'comet');
      }
      if (settings.stars) {
        for (const [id, st] of this.stars) {
          if (!st.group.visible || !st.screen.visible) continue;
          // Far away, only label stars that are bright from here (or focused): keeps the sky uncluttered.
          const idx = st.def.source.kind === 'star' ? this.eph.starIndex(st.def.source.key) : undefined;
          const mag = idx !== undefined ? this.eph.stars.absMag[idx] + 5 * Math.log10(Math.max(st.screen.distance / 3.0857e13, 1e-6) / 10) : 0;
          if (mag > 3.0 && id !== focusId && id !== selectedId) continue;
          add(id, st.def, st.screen, mag > 1.5 && id !== focusId);
        }
        for (const { index, name } of this.cloudLabels) {
          const rec = this.cloudScreen.get(index);
          if (!rec || !rec.visible) continue;
          const mag = this.eph.stars.absMag[index] + 5 * Math.log10(Math.max(rec.distance / 3.0857e13, 1e-6) / 10);
          if (mag > 2.2) continue;
          out.push({ id: `star:${index}`, text: name, x: rec.x * width, y: rec.y * height, radiusPx: 4, priority: 35 - mag, kind: 'star', visible: true, dim: true });
        }
      }
    }
    return out;
  }

  /** Pick the body nearest to a screen point (CSS px). */
  pick(x: number, y: number, width: number, height: number): string | null {
    let best: string | null = null, bestScore = 14;
    const test = (id: string, s: { x: number; y: number; visible: boolean; radiusPx: number }) => {
      if (!s.visible) return;
      const d = Math.hypot(s.x * width - x, s.y * height - y) - Math.min(s.radiusPx, Math.max(width, height));
      if (d < bestScore) { bestScore = d; best = id; }
    };
    test('sun', this.sun.screen);
    for (const [id, obj] of this.bodies) if (obj.group.visible) test(id, obj.screen);
    for (const [id, st] of this.stars) if (st.group.visible) test(id, st.screen);
    return best;
  }

  get qualityLevel() { return this.quality; }
}
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _p3: Vec3 = [0, 0, 0];
const _anti = new THREE.Vector3();
const _vel = new THREE.Vector3();
