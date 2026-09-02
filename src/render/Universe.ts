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

const PRIORITY: Record<string, number> = { star: 100, planet: 90, dwarf: 50, moon: 40, asteroid: 30, comet: 32, interstellar: 34, spacecraft: 20 };
/** Minimum on-screen radius (px) enforced in visual scale mode. */
const MIN_PX: Record<string, number> = { star: 9, planet: 5.5, dwarf: 3.5, moon: 3.2, asteroid: 2.4, comet: 2.4, interstellar: 2.4, spacecraft: 0 };
const ORBIT_REFRESH_DAYS: Record<string, number> = { planet: 20, dwarf: 30, moon: 0.75, tle: 0.02 };

interface OrbitEntry { line: OrbitLine; group: THREE.Group; parent: string; lastTT: number; isStatic: boolean }

export class Universe {
  readonly scene = new THREE.Scene();
  readonly sun: SunObject;
  readonly bodies = new Map<string, BodyObject>();
  readonly orbits = new Map<string, OrbitEntry>();
  readonly belts: Belts;
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
  }

  /** Heliocentric ECL position for a body at the current frame's time (km). */
  helioOf(id: string): Vec3 | null {
    return this.helio.get(id) ?? null;
  }
  /** Displayed (exaggerated) radius in km. */
  displayedRadius(id: string): number {
    if (id === 'sun') return this.sun.def.radius * this.sun.displayScale;
    const b = this.bodies.get(id);
    return b ? Math.max(b.def.radius * b.displayScale, 0.02) : 1;
  }
  worldPosition(id: string, out: THREE.Vector3): THREE.Vector3 {
    if (id === 'sun') return out.copy(this.sun.group.position);
    const b = this.bodies.get(id);
    return b ? out.copy(b.group.position) : out.set(0, 0, 0);
  }
  private worldFromHelio(h: Vec3, out: THREE.Vector3): THREE.Vector3 {
    return out.set(h[0] - this.origin[0], h[2] - this.origin[2], -(h[1] - this.origin[1]));
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
  }

  update(t: SimTime, dt: number, camera: THREE.PerspectiveCamera, settings: SettingsState, pxPerRad: number, pixelRatio: number, focusId: string, selectedId: string | null) {
    this.elapsed += dt;
    const visual = settings.scaleMode === 'visual';
    const camPos = camera.position;
    // Positions relative to the floating origin.
    this.worldFromHelio([0, 0, 0], this.sun.group.position);
    const sunWorld = this.sun.group.position;
    for (const [id, obj] of this.bodies) {
      const h = this.helio.get(id);
      const typeVisible = this.typeVisible(obj.def, settings);
      if (!h || !typeVisible) { obj.setVisible(false); obj.screen.visible = false; continue; }
      obj.setVisible(true);
      this.worldFromHelio(h, obj.group.position);
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
    this.sun.update(camPos, camera.quaternion, visual ? MIN_PX.star / pxPerRad : 0, pxPerRad, this.elapsed);
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
      // Hide moon / satellite orbits that would be sub-pixel clutter.
      const parentDist = o.group.position.distanceTo(camPos);
      if (def.parent) {
        const rel = this.eph.relative(id, t);
        const sizePx = rel ? (Math.hypot(rel.pos[0], rel.pos[1], rel.pos[2]) / parentDist) * pxPerRad : 0;
        if (sizePx < 12) { o.line.setVisible(false); continue; }
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
  }

  /** Label entries in CSS pixels. */
  labelEntries(width: number, height: number, settings: SettingsState, focusId: string): LabelEntry[] {
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
    return best;
  }

  get qualityLevel() { return this.quality; }
}
const _v = new THREE.Vector3();
const _anti = new THREE.Vector3();
const _vel = new THREE.Vector3();
