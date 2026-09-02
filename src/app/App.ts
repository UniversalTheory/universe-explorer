import * as THREE from 'three';
import { Body, Illumination, MoonPhase } from 'astronomy-engine';
import { Clock } from '@/core/Clock';
import { Settings } from '@/core/Settings';
import { vdot, vlen, vnorm, vscale, vsub, type Vec3 } from '@/core/math3';
import { BODIES, body, type BodyDef } from '@/data/catalog';
import { Ephemeris } from '@/ephemeris/Ephemeris';
import { AU_KM, C_KM_S } from '@/ephemeris/frames';
import { EventService } from '@/events/EventService';
import type { SkyEvent } from '@/events/types';
import { CameraController, type FocusTarget } from '@/render/CameraController';
import { Labels } from '@/render/Labels';
import { Starfield } from '@/render/Starfield';
import { configureTextures } from '@/render/Textures';
import { Universe } from '@/render/Universe';
import { EventsPanel } from '@/ui/EventsPanel';
import { InfoPanel } from '@/ui/InfoPanel';
import { SettingsPanel } from '@/ui/SettingsPanel';
import { TimeBar } from '@/ui/TimeBar';
import { TopBar } from '@/ui/TopBar';
import { fmtDays, fmtDate, fmtHours, fmtKm, fmtMass, fmtBig } from '@/ui/format';

const ZERO = new THREE.Vector3();

export class App {
  readonly clock = new Clock();
  readonly settings = new Settings();
  readonly renderer: THREE.WebGLRenderer;
  readonly universe: Universe;
  readonly cam: CameraController;
  readonly labels: Labels;
  readonly events = new EventService();
  private topBar: TopBar;
  private timeBar: TimeBar;
  private info: InfoPanel;
  private eventsPanel: EventsPanel;
  private settingsPanel: SettingsPanel;
  private hint: HTMLElement;
  private selectedId: string | null = null;
  private lastClick = { id: '', t: 0 };
  private lastFrame = performance.now();
  private statsTimer = 0;
  private eventsTimer = 0;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;

  static async boot(): Promise<App> {
    const canvas = document.getElementById('view') as HTMLCanvasElement;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 600;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const quality: 'high' | 'low' = mobile || mem < 4 ? 'low' : 'high';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const pr = Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.5);
    renderer.setPixelRatio(pr);
    configureTextures(renderer);
    const starfield = new Starfield(pr);
    const [eph] = await Promise.all([Ephemeris.load('data/'), starfield.load('data/')]);
    return new App(renderer, eph, starfield, quality, pr);
  }

  constructor(renderer: THREE.WebGLRenderer, readonly eph: Ephemeris, readonly starfield: Starfield, readonly quality: 'high' | 'low', pixelRatio: number) {
    this.renderer = renderer;
    this.pixelRatio = pixelRatio;
    this.universe = new Universe(eph, quality, pixelRatio);
    const hud = document.getElementById('hud')!;
    this.labels = new Labels(document.getElementById('labels')!);
    this.labels.onSelect = (id) => this.select(id);

    this.cam = new CameraController(renderer.domElement, this.target('sun'));
    this.cam.theta = 0.9; this.cam.phi = 0.42; this.cam.distance = 5.6 * AU_KM;
    this.cam.onClick = (x, y) => this.handleClick(x, y);
    this.cam.onUserInput = () => this.hint.classList.add('fade');

    const available = BODIES.filter((b) => eph.available(b));
    this.topBar = new TopBar(hud, available, {
      onSelect: (id) => { this.select(id); this.flyTo(id); },
      onToggleEvents: () => { this.eventsPanel.toggle(); this.settingsPanel.hide(); this.syncButtons(); },
      onToggleSettings: () => { this.settingsPanel.toggle(); this.eventsPanel.hide(); this.syncButtons(); },
    });
    this.timeBar = new TimeBar(hud, this.clock);
    this.info = new InfoPanel(hud, { onFly: (id) => this.flyTo(id), onSelect: (id) => { this.select(id); this.flyTo(id); }, onClose: () => this.deselect() });
    this.eventsPanel = new EventsPanel(hud, { onJump: (ev) => this.jumpToEvent(ev) });
    this.settingsPanel = new SettingsPanel(hud, this.settings);
    this.hint = document.createElement('div');
    this.hint.className = 'glass hint';
    this.hint.textContent = 'Drag to orbit · Scroll to zoom · Click a body for details · Double-click to fly there';
    hud.appendChild(this.hint);
    setTimeout(() => this.hint.classList.add('fade'), 9000);

    this.events.onUpdate = (evs) => this.eventsPanel.setEvents(evs);
    this.events.request(this.clock.ms);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.resize();
    const hash = location.hash.replace('#', '');
    if (hash && available.some((b) => b.id === hash)) { this.select(hash); this.flyTo(hash); }
    document.getElementById('loading')?.classList.add('done');
    requestAnimationFrame(() => this.frame());
  }

  private target(id: string): FocusTarget {
    // Physical radius: the exaggerated display radius shrinks to the real one as the camera approaches.
    const r = body(id).radius;
    return { id, radius: () => Math.max(r, 0.02) };
  }

  private syncButtons() {
    this.topBar.setEventsActive(this.eventsPanel.visible);
    this.topBar.setSettingsActive(this.settingsPanel.visible);
  }

  private resize() {
    this.width = innerWidth; this.height = innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.cam.resize(this.width, this.height);
  }

  private get pxPerRad() { return this.height / (2 * Math.tan((this.cam.camera.fov * Math.PI) / 360)); }

  // --- Interaction ------------------------------------------------------------
  private handleClick(x: number, y: number) {
    const id = this.universe.pick(x, y, this.width, this.height);
    const now = performance.now();
    if (id) {
      if (this.lastClick.id === id && now - this.lastClick.t < 380) { this.flyTo(id); this.lastClick = { id: '', t: 0 }; return; }
      this.lastClick = { id, t: now };
      this.select(id);
    } else {
      this.lastClick = { id: '', t: 0 };
      this.deselect();
    }
  }

  select(id: string) {
    const def = body(id);
    this.selectedId = id;
    this.info.show(def, id === 'sun' || (this.universe.bodies.get(id)?.available ?? false));
    this.settingsPanel.hide();
    this.syncButtons();
    this.updateStats();
    history.replaceState(null, '', '#' + id);
  }
  deselect() { this.selectedId = null; this.info.hide(); history.replaceState(null, '', location.pathname); }

  flyTo(id: string, distanceOverride?: number) {
    const def = body(id);
    let distance: number;
    if (def.type === 'spacecraft') distance = def.parent ? 2.5e4 : 1.5e6;
    else distance = this.cam.framingDistance(def.radius);
    if (id === 'sun') distance = Math.max(distance, 4.5e6);
    if (distanceOverride) distance = distanceOverride;
    this.cam.flyTo(this.target(id), { distance, viewDir: this.litViewDir(id) });
  }

  /** Direction (world axes) from a body toward a pleasing three-quarter-lit viewpoint. */
  private litViewDir(id: string): THREE.Vector3 | undefined {
    if (id === 'sun') return undefined;
    const h = this.universe.helioOf(id) ?? this.eph.state(id, this.clock.time)?.pos;
    if (!h) return undefined;
    // Toward the Sun, in Three axes (x, z, -y), rotated ~50° around the pole and raised ~20°.
    const toSun = new THREE.Vector3(-h[0], -h[2], h[1]).normalize();
    const angle = 0.85;
    const dir = new THREE.Vector3(toSun.x * Math.cos(angle) + toSun.z * Math.sin(angle), 0, -toSun.x * Math.sin(angle) + toSun.z * Math.cos(angle));
    dir.y = 0.36;
    return dir.normalize();
  }

  private jumpToEvent(ev: SkyEvent) {
    this.clock.set(ev.ms);
    this.clock.pause();
    if (ev.focus) {
      this.select(ev.focus);
      this.universe.computePositions(this.clock.time);
      this.flyTo(ev.focus, ev.distance);
    }
    if (innerWidth < 720) this.eventsPanel.hide();
    this.syncButtons();
  }

  private onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    switch (e.key) {
      case ' ': this.clock.toggle(); e.preventDefault(); break;
      case '[': this.timeBar.step(-1); break;
      case ']': this.timeBar.step(1); break;
      case 'n': case 'N': this.clock.goLive(); break;
      case 'e': case 'E': this.eventsPanel.toggle(); this.settingsPanel.hide(); this.syncButtons(); break;
      case 's': case 'S': this.settingsPanel.toggle(); this.eventsPanel.hide(); this.syncButtons(); break;
      case '/': this.topBar.focusSearch(); e.preventDefault(); break;
      case 'Escape': this.deselect(); this.eventsPanel.hide(); this.settingsPanel.hide(); this.syncButtons(); break;
      case 'f': case 'F': if (this.selectedId) this.flyTo(this.selectedId); break;
    }
  }

  // --- Frame loop --------------------------------------------------------------
  private frame() {
    requestAnimationFrame(() => this.frame());
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.clock.update(dt * 1000);
    const t = this.clock.time;
    const u = this.universe;
    u.computePositions(t);

    // Floating origin: the focused body (blended during transitions).
    const focusHelio = u.helioOf(this.cam.focusId) ?? [0, 0, 0];
    let origin: Vec3 = focusHelio;
    const from = this.cam.transitionFrom;
    if (from) {
      const fromHelio = u.helioOf(from.id) ?? focusHelio;
      const s = this.cam.transitionBlend;
      origin = [fromHelio[0] + (focusHelio[0] - fromHelio[0]) * s, fromHelio[1] + (focusHelio[1] - fromHelio[1]) * s, fromHelio[2] + (focusHelio[2] - fromHelio[2]) * s];
    }
    u.origin = origin;
    const offset = this.cam.update(dt);
    this.cam.screenShiftY = innerWidth < 720 && (this.info.visible || this.eventsPanel.visible) ? 0.26 : 0;
    this.cam.applyPose(offset, ZERO);
    u.update(t, dt, this.cam.camera, this.settings.state, this.pxPerRad, this.pixelRatio, this.cam.focusId, this.selectedId);

    // Labels + selection ring.
    const sel = this.selectedId ? (this.selectedId === 'sun' ? u.sun.screen : u.bodies.get(this.selectedId)?.screen) : null;
    this.labels.update(u.labelEntries(this.width, this.height, this.settings.state, this.cam.focusId), this.width, this.height,
      sel && this.selectedId ? { id: this.selectedId, x: sel.x * this.width, y: sel.y * this.height, radiusPx: sel.radiusPx, visible: sel.visible } : null);

    // Render: background sky, then the solar system.
    const r = this.renderer;
    r.autoClear = false;
    r.clear();
    this.starfield.render(r, this.cam.camera, this.settings.state.stars, 1);
    r.render(u.scene, this.cam.camera);

    // UI updates at low frequency (wall-clock).
    this.timeBar.render();
    if (now - this.statsTimer > 250) { this.statsTimer = now; this.updateStats(); }
    if (now - this.eventsTimer > 1000) { this.eventsTimer = now; this.eventsPanel.update(this.clock.ms); this.events.request(this.clock.ms); }
  }

  // --- Live facts -----------------------------------------------------------------
  private updateStats() {
    const id = this.selectedId;
    if (!id || !this.info.visible) return;
    const def = body(id);
    const t = this.clock.time;
    const rows: [string, string, boolean?][] = [];
    const st = this.eph.state(id, t);
    const earth = this.eph.state('earth', t);
    if (st) {
      if (id !== 'sun') rows.push(['Distance from Sun', fmtKm(vlen(st.pos)), true]);
      if (earth && id !== 'earth') {
        const d = vlen(vsub(st.pos, earth.pos));
        rows.push(['Distance from Earth', fmtKm(d), true]);
        const lt = d / C_KM_S;
        rows.push(['Light travel time', lt < 1 ? `${(lt * 1000).toFixed(0)} ms` : lt < 120 ? `${lt.toFixed(1)} s` : lt < 7200 ? `${(lt / 60).toFixed(1)} min` : `${(lt / 3600).toFixed(2)} h`]);
      }
      const rel = this.eph.relative(id, t);
      if (rel && id !== 'sun') rows.push([def.parent ? `Speed around ${def.parent}` : 'Orbital speed', `${vlen(rel.vel).toFixed(2)} km/s`]);
    }
    // Is the body inside its parent's shadow right now?
    if (def.parent && st) {
      const p = this.eph.state(def.parent, t);
      const pdef = body(def.parent);
      if (p) {
        const toP = vsub(p.pos, st.pos);
        const dP = vlen(toP);
        const ang = Math.acos(Math.max(-1, Math.min(1, vdot(vnorm(toP), vnorm(vscale(st.pos, -1))))));
        const radP = Math.asin(Math.min(1, pdef.radius / dP));
        if (ang < radP) rows.push(['Sunlight', `In ${pdef.name}'s shadow right now (eclipsed)`, true]);
      }
    }
    if (id === 'moon') {
      const ill = Illumination(Body.Moon, t.astro);
      const ph = MoonPhase(t.astro);
      const name = ph < 22.5 ? 'New' : ph < 67.5 ? 'Waxing crescent' : ph < 112.5 ? 'First quarter' : ph < 157.5 ? 'Waxing gibbous' : ph < 202.5 ? 'Full' : ph < 247.5 ? 'Waning gibbous' : ph < 292.5 ? 'Last quarter' : ph < 337.5 ? 'Waning crescent' : 'New';
      rows.push(['Phase', `${name} · ${(ill.phase_fraction * 100).toFixed(0)}% lit`, true]);
    }
    const period = def.orbitDays ?? this.eph.periodDays(id, t);
    if (period != null && id !== 'sun') rows.push([def.parent ? 'Orbital period' : 'Year length', fmtDays(period)]);
    if (def.rotationHours) rows.push(['Rotation period', fmtHours(def.rotationHours)]);
    else if (def.type === 'moon' && def.orbitDays) rows.push(['Rotation', 'tidally locked']);
    if (def.type !== 'spacecraft') rows.push([def.radius < 5 ? 'Size' : 'Radius', def.radius < 5 ? `${(def.radius * 2).toFixed(1)} km across` : `${fmtBig(def.radius)} km`]);
    if (def.mass) rows.push(['Mass', fmtMass(def.mass)]);
    if (def.gravity) rows.push(['Surface gravity', `${def.gravity} m/s²`]);
    if (def.temperature) rows.push(['Temperature', def.temperature]);
    if (def.moons != null) rows.push(['Known moons', String(def.moons)]);
    if (def.source.kind === 'sbdb') {
      const rec = this.eph.data.smallBodies[def.source.key];
      if (rec) {
        rows.push(['Perihelion', `${rec.q.toFixed(2)} AU`]);
        rows.push(['Eccentricity', rec.e.toFixed(3)]);
        const tpMs = (rec.tp - 2440587.5) * 86400000;
        rows.push([tpMs > t.ms ? 'Next perihelion' : 'Last perihelion', fmtDate(tpMs), true]);
        if (rec.orbitClass) rows.push(['Orbit class', rec.orbitClass, true]);
      }
    }
    if (def.source.kind === 'tle') {
      const sat = this.eph.satellites.get(def.source.key);
      const rel = this.eph.relative(id, t);
      if (rel) rows.push(['Altitude', `${fmtBig(vlen(rel.pos) - 6371)} km`]);
      if (sat) rows.push(['Orbit data epoch', fmtDate(sat.epochMs), true]);
    }
    if (def.discovered) rows.push([def.type === 'spacecraft' ? 'Launch' : 'Discovered', def.discovered, true]);
    for (const [k, v] of def.facts ?? []) rows.push([k, v, true]);
    this.info.setStats(rows);
  }
}

export type { BodyDef };
