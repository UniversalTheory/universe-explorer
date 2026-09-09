import * as THREE from 'three';
import { Body, Illumination, MoonPhase } from 'astronomy-engine';
import { Clock } from '@/core/Clock';
import { Settings } from '@/core/Settings';
import { vdot, vlen, vnorm, vscale, vsub, type Vec3 } from '@/core/math3';
import { BODIES, body, registerBodies, type BodyDef } from '@/data/catalog';
import { buildExoplanetBodies, classify, PLANET_CLASS_LABEL } from '@/data/exoplanets';
import { buildDeepSkyBodies, DSO_KIND_LABEL } from '@/data/deepsky';
import { buildCompactBodies } from '@/data/compact';
import { armLabelBodies, REGIONS, R0_KPC, THETA0_KMS } from '@/data/galaxy';
import { isGalacticRate } from '@/core/Clock';
import { apparentSeparation, schwarzschildKm } from '@/ephemeris/binary';
import { EXO_INCL_ASSUMED, EXO_MASS_IS_MSINI, EXO_PHASE_UNKNOWN, EXO_TRANSITS, nextTransitJd } from '@/ephemeris/exoplanets';
import { Ephemeris } from '@/ephemeris/Ephemeris';
import { AU_KM, C_KM_S, GAL_CENTRE_ECL, GAL_NORTH_ECL, LY_KM, eclToThree } from '@/ephemeris/frames';
import { EventService } from '@/events/EventService';
import type { SkyEvent } from '@/events/types';
import { CameraController, type FocusTarget } from '@/render/CameraController';
import { Labels } from '@/render/Labels';
import { Starfield } from '@/render/Starfield';
import { configureTextures } from '@/render/Textures';
import { EXO_LAYER, Universe } from '@/render/Universe';
import { EventsPanel } from '@/ui/EventsPanel';
import { InfoPanel } from '@/ui/InfoPanel';
import { SettingsPanel } from '@/ui/SettingsPanel';
import { TimeBar } from '@/ui/TimeBar';
import { TopBar, ZOOM_VIEWS, type ZoomView } from '@/ui/TopBar';
import { ScaleBar } from '@/ui/ScaleBar';
import { fmtDays, fmtDate, fmtHours, fmtKm, fmtLightTime, fmtMass, fmtBig } from '@/ui/format';

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
  private scaleBar: ScaleBar;
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
    const starfield = new Starfield();
    const [eph] = await Promise.all([Ephemeris.load('data/'), starfield.load()]);
    if (eph.exo) registerBodies(buildExoplanetBodies(eph.exo));
    if (eph.deepSky) registerBodies(buildDeepSkyBodies(eph.deepSky));
    registerBodies(buildCompactBodies());
    registerBodies([...REGIONS, ...armLabelBodies()]);
    return new App(renderer, eph, starfield, quality, pr);
  }

  constructor(renderer: THREE.WebGLRenderer, readonly eph: Ephemeris, readonly starfield: Starfield, readonly quality: 'high' | 'low', pixelRatio: number) {
    this.renderer = renderer;
    this.pixelRatio = pixelRatio;
    this.settings.applyDefault('deepStars', quality === 'high');
    this.universe = new Universe(eph, quality, pixelRatio);
    const hud = document.getElementById('hud')!;
    this.labels = new Labels(document.getElementById('labels')!);
    this.labels.onSelect = (id) => { if (!id.startsWith('star:')) this.select(id); };

    this.cam = new CameraController(renderer.domElement, this.target('sun'));
    this.cam.camera.layers.enable(EXO_LAYER);
    this.cam.theta = 0.9; this.cam.phi = 0.42; this.cam.distance = 5.6 * AU_KM;
    this.cam.onClick = (x, y) => this.handleClick(x, y);
    this.cam.onUserInput = () => this.hint.classList.add('fade');

    const available = BODIES.filter((b) => eph.available(b));
    this.topBar = new TopBar(hud, available, {
      onSelect: (id) => { this.select(id); this.flyTo(id); },
      onToggleEvents: () => { this.eventsPanel.toggle(); this.settingsPanel.hide(); this.syncButtons(); },
      onToggleSettings: () => { this.settingsPanel.toggle(); this.eventsPanel.hide(); this.syncButtons(); },
      onJump: (view) => this.jumpTo(view),
    });
    this.timeBar = new TimeBar(hud, this.clock);
    this.scaleBar = new ScaleBar(hud);
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
    if (id?.startsWith('star:')) return;
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
    this.universe.ensure(id);
    this.selectedId = id;
    this.info.show(def, this.universe.isAvailable(id));
    this.settingsPanel.hide();
    this.syncButtons();
    this.updateStats();
    history.replaceState(null, '', '#' + id);
  }
  deselect() { this.selectedId = null; this.info.hide(); history.replaceState(null, '', location.pathname); }

  flyTo(id: string, distanceOverride?: number) {
    const def = body(id);
    this.universe.ensure(id);
    let distance: number;
    if (def.type === 'spacecraft') distance = def.parent ? 2.5e4 : 1.5e6;
    else if (def.compact === 'blackhole') distance = this.cam.framingDistance(def.radius * 16);   // frame the accretion disc / photon ring
    else distance = this.cam.framingDistance(def.radius);
    if (id === 'sun') distance = Math.max(distance, 4.5e6);
    if (distanceOverride) distance = distanceOverride;
    this.cam.flyTo(this.target(id), { distance, viewDir: this.litViewDir(id) });
  }

  /**
   * Jump the camera to one of the canonical framings of the Sun: the planets, the solar
   * neighbourhood, or the whole Galaxy (seen from above the disc, on the anti-centre side).
   */
  jumpTo(view: ZoomView) {
    const spec = ZOOM_VIEWS.find((v) => v.id === view);
    if (!spec) return;
    const fov = (this.cam.camera.fov * Math.PI) / 180;
    const distance = spec.radius / (0.8 * Math.tan(fov / 2));
    let viewDir: THREE.Vector3;
    if (view === 'galaxy') {
      const n = eclToThree(GAL_NORTH_ECL), c = eclToThree(GAL_CENTRE_ECL);
      viewDir = new THREE.Vector3(n[0] - 0.7 * c[0], n[1] - 0.7 * c[1], n[2] - 0.7 * c[2]).normalize();
    } else {
      const phi = 0.55, cp = Math.cos(phi);
      viewDir = new THREE.Vector3(cp * Math.sin(this.cam.theta), Math.sin(phi), cp * Math.cos(this.cam.theta));
    }
    this.cam.flyTo(this.target('sun'), { distance, viewDir, duration: 2.2 });
    this.hint.classList.add('fade');
  }

  /** Direction (world axes) from a body toward a pleasing three-quarter-lit viewpoint. */
  private litViewDir(id: string): THREE.Vector3 | undefined {
    const def = body(id);
    if (id === 'sun' || def.type === 'star' || def.type === 'blackhole' || def.type === 'neutron' || def.type === 'region') return undefined;
    const h = this.universe.helioOf(id) ?? this.eph.state(id, this.clock.time)?.pos;
    if (!h) return undefined;
    // Deep-sky cards are photographs taken from here: approach them from the Sun's side, slightly off-axis.
    if (def.type === 'nebula' || def.type === 'cluster') {
      const toSun = new THREE.Vector3(-h[0], -h[2], h[1]).normalize();
      const side = new THREE.Vector3(0, 1, 0).cross(toSun).normalize().multiplyScalar(0.35);
      return toSun.add(side).setY(toSun.y + 0.2).normalize();
    }
    // Toward the light source (the Sun, or an exoplanet's host star), in Three axes (x, z, -y), rotated ~50° around the pole and raised ~20°.
    let src: Vec3 = [0, 0, 0];
    if (def.type === 'exoplanet' && def.parent) src = this.universe.helioOf(def.parent) ?? this.eph.state(def.parent, this.clock.time)?.pos ?? src;
    const toSun = new THREE.Vector3(src[0] - h[0], src[2] - h[2], -(src[1] - h[1])).normalize();
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
      case '1': this.jumpTo('system'); break;
      case '2': this.jumpTo('stars'); break;
      case '3': this.jumpTo('galaxy'); break;
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
    u.frozen = isGalacticRate(this.clock.rate) && this.clock.playing && !this.clock.live;
    const offset = this.cam.update(dt);
    this.cam.screenShiftY = innerWidth < 720 && (this.info.visible || this.eventsPanel.visible) ? 0.26 : 0;
    this.cam.applyPose(offset, ZERO);
    u.update(t, dt, this.cam.camera, this.settings.state, this.pxPerRad, this.pixelRatio, this.cam.focusId, this.selectedId);

    // Labels + selection ring.
    const sel = this.selectedId ? u.screenOf(this.selectedId) : null;
    this.labels.update(u.labelEntries(this.width, this.height, this.settings.state, this.cam.focusId, this.selectedId), this.width, this.height,
      sel && this.selectedId ? { id: this.selectedId, x: sel.x * this.width, y: sel.y * this.height, radiusPx: sel.radiusPx, visible: sel.visible } : null);

    // Render: background sky, then the solar system.
    const r = this.renderer;
    r.autoClear = false;
    r.clear();
    // The panorama is the sky as seen from here; fade it out between ~1 and ~100 light-years from the Sun
    // so the 3D star cloud takes over (the galaxy model of Stage F will replace it beyond that).
    const sunDist = u.sun.group.position.distanceTo(this.cam.camera.position);
    const fade = 1 - Math.min(1, Math.max(0, Math.log10(Math.max(sunDist, 1) / 1e13) / 2));
    this.starfield.render(r, this.cam.camera, this.settings.state.stars, 0.85 * (0.15 + 0.85 * fade));
    if (this.settings.state.deepSky) { r.render(u.farScene, u.farCamera); r.clearDepth(); }
    r.render(u.scene, this.cam.camera);

    // UI updates at low frequency (wall-clock).
    this.timeBar.render();
    this.scaleBar.update((2 * this.cam.distance * Math.tan((this.cam.camera.fov * Math.PI) / 360)) / this.height);
    if (now - this.statsTimer > 250) {
      this.statsTimer = now;
      this.updateStats();
      const d = this.cam.distance;
      this.topBar.setZoomView(this.cam.focusId === 'sun' ? ZOOM_VIEWS.find((v) => d >= v.min && d < v.max)?.id ?? null : null);
    }
    if (now - this.eventsTimer > 1000 && Math.abs(this.clock.ms - Date.now()) < 5e14) { this.eventsTimer = now; this.eventsPanel.update(this.clock.ms); this.events.request(this.clock.ms); }
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
    if (def.type === 'region') {
      rows.push(['Kind', 'Schematic model, not a measured shape', true]);
      if (st && id !== 'heliopause' && id !== 'oort-cloud') rows.push(['Distance from Sun', fmtKm(vlen(st.pos)), true]);
      rows.push(['Size', `${fmtKm(def.radius)} radius`, true]);
      if (id.startsWith('arm-') || id === 'galactic-bar') rows.push(['Galaxy parameters', `R₀ = ${R0_KPC} kpc · Θ₀ = ${THETA0_KMS} km/s (Reid et al. 2019)`, true]);
      for (const [k, v] of def.facts ?? []) rows.push([k, v, true]);
      this.info.setStats(rows);
      return;
    }
    if (def.compact) {
      const mSun = (def.mass ?? 0) / 1.9885e30;
      rows.push(['Type', def.compact === 'blackhole' ? (mSun > 1e5 ? 'Supermassive black hole' : 'Stellar-mass black hole') : def.compact === 'neutron' ? (def.spinSeconds ? (def.spinSeconds > 2 ? 'Magnetar / slow pulsar' : def.spinSeconds < 0.02 ? 'Millisecond pulsar' : 'Pulsar') : 'Neutron star') : 'White dwarf']);
      if (st) rows.push(['Distance from Sun', fmtKm(vlen(st.pos)), true]);
      if (mSun) rows.push(['Mass', mSun >= 1e4 ? `${fmtBig(mSun)} × Sun` : `${mSun.toPrecision(3)} × Sun`]);
      if (def.compact === 'blackhole') rows.push(['Event horizon radius', fmtKm(schwarzschildKm(mSun))]);
      else rows.push(['Radius', def.radius < 100 ? `${def.radius.toFixed(0)} km` : `${fmtBig(def.radius)} km · ${(def.radius / 6371).toFixed(2)} × Earth`]);
      if (def.spinSeconds) rows.push(['Spin period', def.spinSeconds < 1 ? `${(def.spinSeconds * 1000).toFixed(2)} ms · ${(1 / def.spinSeconds).toFixed(1)} per second` : `${def.spinSeconds.toFixed(3)} s`]);
      if (def.temperature) rows.push(['Temperature', def.temperature]);
      if (def.source.kind === 'binary' && def.parent) {
        const p = this.eph.state(def.parent, t);
        rows.push(['Orbital period', fmtDays(def.source.el.per)]);
        if (p) { const sep = apparentSeparation(def.source.el, vlen(p.pos), t.jd); rows.push(['Separation now', `${sep.rho.toFixed(2)}″ at PA ${sep.theta.toFixed(0)}° · ${fmtKm(vlen(this.eph.relative(id, t)?.pos ?? [0, 0, 0]))}`, true]); }
        if (!def.source.phaseKnown) rows.push(['Orbit', 'period and inclination measured; node and phase not', true]);
      }
      const kids = this.eph.availableBodies().filter((b) => b.parent === id);
      for (const k of kids) if (k.source.kind === 'binary') rows.push([`${k.name} orbit`, `${fmtDays(k.source.el.per)}${k.source.phaseKnown ? '' : ' (phase not measured)'}`, true]);
      if (def.discovered) rows.push(['Discovered', def.discovered, true]);
      for (const [k, v] of def.facts ?? []) rows.push([k, v, true]);
      this.info.setStats(rows);
      return;
    }
    if (def.compact) {
      const mSun = (def.mass ?? 0) / 1.9885e30;
      rows.push(['Type', def.compact === 'blackhole' ? (mSun > 1e5 ? 'Supermassive black hole' : 'Stellar-mass black hole') : def.compact === 'neutron' ? (def.spinSeconds ? (def.spinSeconds > 2 ? 'Magnetar / slow pulsar' : def.spinSeconds < 0.02 ? 'Millisecond pulsar' : 'Pulsar') : 'Neutron star') : 'White dwarf']);
      if (st) rows.push(['Distance from Sun', fmtKm(vlen(st.pos)), true]);
      if (mSun) rows.push(['Mass', mSun >= 1e4 ? `${fmtBig(mSun)} × Sun` : `${mSun.toPrecision(3)} × Sun`]);
      if (def.compact === 'blackhole') rows.push(['Event horizon radius', fmtKm(schwarzschildKm(mSun))]);
      else rows.push(['Radius', def.radius < 100 ? `${def.radius.toFixed(0)} km` : `${fmtBig(def.radius)} km · ${(def.radius / 6371).toFixed(2)} × Earth`]);
      if (def.spinSeconds) rows.push(['Spin period', def.spinSeconds < 1 ? `${(def.spinSeconds * 1000).toFixed(2)} ms · ${(1 / def.spinSeconds).toFixed(1)} per second` : `${def.spinSeconds.toFixed(3)} s`]);
      if (def.temperature) rows.push(['Temperature', def.temperature]);
      if (def.source.kind === 'binary' && def.parent) {
        const p = this.eph.state(def.parent, t);
        rows.push(['Orbital period', fmtDays(def.source.el.per)]);
        if (p) { const sep = apparentSeparation(def.source.el, vlen(p.pos), t.jd); rows.push(['Separation now', `${sep.rho.toFixed(2)}″ at PA ${sep.theta.toFixed(0)}° · ${fmtKm(vlen(this.eph.relative(id, t)?.pos ?? [0, 0, 0]))}`, true]); }
        if (!def.source.phaseKnown) rows.push(['Orbit', 'period and inclination measured; node and phase not', true]);
      }
      const kids = this.eph.availableBodies().filter((b) => b.parent === id);
      for (const k of kids) if (k.source.kind === 'binary') rows.push([`${k.name} orbit`, `${fmtDays(k.source.el.per)}${k.source.phaseKnown ? '' : ' (phase not measured)'}`, true]);
      if (def.discovered) rows.push(['Discovered', def.discovered, true]);
      for (const [k, v] of def.facts ?? []) rows.push([k, v, true]);
      this.info.setStats(rows);
      return;
    }
    if (def.type === 'nebula' || def.type === 'cluster') {
      const rec = this.eph.deepSky?.get(id);
      if (rec && st) {
        rows.push(['Type', DSO_KIND_LABEL[rec.kind]]);
        rows.push(['Distance from Sun', fmtKm(vlen(st.pos)), true]);
        const acrossLy = (2 * def.radius) / LY_KM;
        rows.push(['Size', `${acrossLy < 10 ? acrossLy.toFixed(1) : fmtBig(acrossLy)} light-years across · ${rec.maj >= 60 ? `${(rec.maj / 60).toFixed(1)}°` : `${rec.maj.toFixed(0)}′`} on the sky`, true]);
        rows.push(['Light travel time', fmtLightTime(vlen(st.pos) / C_KM_S)]);
        if (rec.vmag != null) rows.push(['Apparent magnitude', rec.vmag.toFixed(1)]);
        if (rec.con) rows.push(['Constellation', rec.con]);
        if (rec.ngc) rows.push(['Catalogue', rec.ngc.replace(/^(NGC|IC)0*/, '$1 ')]);
        for (const [k, v] of def.facts ?? []) rows.push([k, v, true]);
        if (rec.image) rows.push(['Image', `${rec.image.credit || 'Wikimedia Commons'} · ${rec.image.license}`, true]);
        this.info.setStats(rows);
        return;
      }
    }
    if (def.type === 'exoplanet' && def.source.kind === 'exoplanet') {
      const p = this.eph.exoplanet(def.source.key);
      const host = def.parent ? body(def.parent) : null;
      if (p && host) {
        const cls = classify(p);
        rows.push(['Type', PLANET_CLASS_LABEL[cls].replace(/^./, (c) => c.toUpperCase())]);
        rows.push(['Host star', `${host.name}${host.spectral ? ` (${host.spectral})` : ''}`]);
        const hostSt = this.eph.state(host.id, t);
        if (hostSt) rows.push(['Distance from Sun', fmtKm(vlen(hostSt.pos)), true]);
        rows.push(['Orbital period', fmtDays(p.per)]);
        rows.push(['Semi-major axis', `${(p.a / AU_KM).toPrecision(3)} AU`]);
        rows.push(['Eccentricity', p.e.toFixed(3)]);
        rows.push(['Inclination', `${p.incl.toFixed(1)}°${p.flags & EXO_INCL_ASSUMED ? ' (assumed)' : ''}`]);
        rows.push(['Radius', p.rade < 4 ? `${p.rade.toPrecision(3)} × Earth` : `${(p.rade / 11.209).toPrecision(3)} × Jupiter · ${p.rade.toFixed(1)} × Earth`]);
        if (!isNaN(p.masse)) rows.push([p.flags & EXO_MASS_IS_MSINI ? 'Minimum mass (M sin i)' : 'Mass', p.masse < 30 ? `${p.masse.toPrecision(3)} × Earth` : `${(p.masse / 317.8).toPrecision(3)} × Jupiter`]);
        if (p.flags & EXO_TRANSITS) {
          const nt = nextTransitJd(p, t.jd);
          if (nt !== null) rows.push(['Next transit (seen from Earth)', fmtDate((nt - 2440587.5) * 86400000) + (isNaN(p.trandur) ? '' : ` · lasts ${p.trandur.toFixed(1)} h`), true]);
          else rows.push(['Transits its star', 'yes']);
        }
        if (p.flags & EXO_PHASE_UNKNOWN) rows.push(['Orbital phase', 'not measured (periastron set to J2000)', true]);
        if (def.discovered) rows.push(['Discovered', def.discovered, true]);
        for (const [k, v] of def.facts ?? []) rows.push([k, v, true]);
        this.info.setStats(rows);
        return;
      }
    }
    const isStar = def.type === 'star' && id !== 'sun';
    if (st && isStar) {
      const d = vlen(st.pos);
      rows.push(['Distance from Sun', fmtKm(d), true]);
      const ly = d / LY_KM;
      const year = new Date(t.ms).getUTCFullYear() - ly;
      rows.push(['Light travel time', `${fmtLightTime(d / C_KM_S)} · left the star ${year >= 0 ? `around ${Math.round(year)}` : `${fmtBig(-year)} years BC`}`, true]);
      rows.push(['Space velocity', `${vlen(st.vel).toFixed(1)} km/s relative to the Sun`, true]);
      if (def.source.kind === 'binary' && def.parent) {
        const rel = this.eph.relative(id, t);
        rows.push([`Orbit around ${body(def.parent).name}`, `${fmtDays(def.source.el.per)} · now ${fmtKm(vlen(rel?.pos ?? [0, 0, 0]))} apart · ${(vlen(rel?.vel ?? [0, 0, 0])).toFixed(1)} km/s${def.source.phaseKnown ? '' : ' (phase not measured)'}`, true]);
      }
      const idx = def.source.kind === 'star' ? this.eph.starIndex(def.source.key) : undefined;
      if (idx !== undefined) {
        const cat = this.eph.stars;
        rows.push(['Apparent magnitude', cat.mag[idx].toFixed(2)]);
        rows.push(['Absolute magnitude', cat.absMag[idx].toFixed(2)]);
        if (cat.flags[idx] & 1) rows.push(['Distance', 'not measured; placed at 1,000 pc', true]);
      }
      if (def.spectral) rows.push(['Spectral type', def.spectral]);
      if (def.luminosity != null) rows.push(['Luminosity', def.luminosity >= 100 ? `${fmtBig(def.luminosity)} × Sun` : def.luminosity >= 0.01 ? `${def.luminosity.toPrecision(2)} × Sun` : `${def.luminosity.toExponential(1)} × Sun`]);
      rows.push(['Radius', `${(def.radius / 695700).toPrecision(3)} × Sun · ${fmtBig(def.radius)} km`, true]);
      if (def.mass) rows.push(['Mass', `${(def.mass / 1.9885e30).toPrecision(2)} × Sun`]);
      if (def.temperature) rows.push(['Temperature', def.temperature]);
      if (def.discovered) rows.push(['Discovered', def.discovered, true]);
      for (const [k, v] of def.facts ?? []) rows.push([k, v, true]);
      this.info.setStats(rows);
      return;
    }
    if (st) {
      if (id !== 'sun') rows.push(['Distance from Sun', fmtKm(vlen(st.pos)), true]);
      if (earth && id !== 'earth') {
        const d = vlen(vsub(st.pos, earth.pos));
        rows.push(['Distance from Earth', fmtKm(d), true]);
        rows.push(['Light travel time', fmtLightTime(d / C_KM_S)]);
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
