/**
 * Focus-based orbit camera with inertia, wheel / pinch zoom, and animated
 * transitions between bodies. Works with a floating origin: the focused
 * body is always at the world origin, so the camera position is just the
 * spherical offset.
 */
import * as THREE from 'three';
import { clamp, smoothstep } from '@/core/math3';

export interface FocusTarget {
  id: string;
  /** Displayed radius (km) for framing / minimum distance. */
  radius: () => number;
}

const EASE = (t: number) => smoothstep(clamp(t, 0, 1));
/** Far plane, km: beyond the far side of the Galactic disc. The log depth buffer keeps precision. */
export const CAMERA_FAR_KM = 1e19;
/** Furthest the camera may back away from its focus, km (≈ 65 kpc, enough to frame the whole disc). */
export const MAX_CAMERA_DISTANCE_KM = 2e18;

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  /** Spherical offset from the focus: azimuth (rad), elevation (rad), distance (km). */
  theta = 0.6;
  phi = 0.35;
  distance = 4e8;
  private velTheta = 0;
  private velPhi = 0;
  private zoomVel = 0;
  private focus: FocusTarget;
  /** Transition state: blending the origin from `from` to `focus`. */
  transition: { from: FocusTarget; start: number; duration: number; startDist: number; endDist: number; startTheta: number; endTheta: number; startPhi: number; endPhi: number } | null = null;
  /** World offset applied while transitioning (world origin is the *new* focus, so the old focus is offset). */
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pinchDist = 0;
  private touches = new Map<number, { x: number; y: number }>();
  onUserInput?: () => void;
  onClick?: (x: number, y: number) => void;
  private downPos = { x: 0, y: 0, t: 0 };

  constructor(readonly dom: HTMLElement, initial: FocusTarget) {
    this.camera = new THREE.PerspectiveCamera(50, 1, 1, CAMERA_FAR_KM);
    this.focus = initial;
    this.bind();
  }

  get focusId() { return this.focus.id; }
  get focusTarget() { return this.focus; }
  get transitionFrom(): FocusTarget | null { return this.transition?.from ?? null; }
  /** 0..1 blend from old focus to new (1 when not transitioning). */
  get transitionBlend(): number { return this.transition ? EASE((performance.now() / 1000 - this.transition.start) / this.transition.duration) : 1; }

  /** Good viewing distance for a body of displayed radius r. */
  framingDistance(radiusKm: number) {
    const fov = (this.camera.fov * Math.PI) / 180;
    return (radiusKm * 3.2) / Math.tan(fov / 2);
  }

  /**
   * Animate to a new focus. `viewDir` (optional, unit vector in world axes) is the
   * direction from the body toward where the camera should end up, e.g. the sunlit side.
   */
  flyTo(target: FocusTarget, opts: { duration?: number; distance?: number; viewDir?: THREE.Vector3 } = {}) {
    const same = target.id === this.focus.id && !this.transition;
    let endTheta = this.theta, endPhi = this.phi;
    if (opts.viewDir) {
      const d = opts.viewDir;
      const targetTheta = Math.atan2(d.x, d.z);
      // Shortest way round.
      let delta = targetTheta - (this.theta % (2 * Math.PI));
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      endTheta = this.theta + delta;
      endPhi = clamp(Math.asin(clamp(d.y, -1, 1)), -1.2, 1.2);
    }
    this.transition = {
      from: this.focus, start: performance.now() / 1000, duration: opts.duration ?? (same ? 1.2 : 1.8),
      startDist: this.distance, endDist: opts.distance ?? this.framingDistance(target.radius()),
      startTheta: this.theta, endTheta, startPhi: this.phi, endPhi,
    };
    this.focus = target;
    this.zoomVel = 0;
    this.velTheta = this.velPhi = 0;
  }

  /** Instantly set focus (no animation). */
  setFocus(target: FocusTarget, distance?: number) {
    this.focus = target;
    this.transition = null;
    if (distance) this.distance = distance;
  }

  private bind() {
    const d = this.dom;
    d.style.touchAction = 'none';
    d.addEventListener('pointerdown', (e) => {
      d.setPointerCapture(e.pointerId);
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 1) { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; this.velTheta = this.velPhi = 0; }
      if (this.touches.size === 2) { const [a, b] = [...this.touches.values()]; this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
      this.downPos = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.onUserInput?.();
    });
    d.addEventListener('pointermove', (e) => {
      if (!this.touches.has(e.pointerId)) return;
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        const [a, b] = [...this.touches.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.zoomBy(Math.pow(this.pinchDist / dist, 1.0));
        this.pinchDist = dist;
        return;
      }
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      const k = 0.0045 * (e.pointerType === 'touch' ? 1.2 : 1);
      this.velTheta = -dx * k;
      this.velPhi = dy * k;
      this.theta += this.velTheta;
      this.phi = clamp(this.phi + this.velPhi, -1.45, 1.45);
    });
    const up = (e: PointerEvent) => {
      this.touches.delete(e.pointerId);
      if (this.touches.size < 2) this.pinchDist = 0;
      if (this.touches.size === 0) this.dragging = false;
      const dt = performance.now() - this.downPos.t;
      const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
      if (dt < 400 && moved < 6 && e.button === 0) this.onClick?.(e.clientX, e.clientY);
    };
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', up);
    d.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Zoom gain grows with distance: the Galaxy is ten orders of magnitude beyond Neptune.
      const gain = 0.0022 * clamp(1 + 0.35 * Math.log10(Math.max(1, this.distance / 2e10)), 1, 3);
      const f = Math.exp(clamp(e.deltaY, -120, 120) * gain);
      this.zoomVel = clamp(this.zoomVel + Math.log(f), -0.6, 0.6);
      this.onUserInput?.();
    }, { passive: false });
    d.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  zoomBy(factor: number) { this.distance = this.clampDistance(this.distance * factor); this.transition = null; }
  private clampDistance(dist: number) {
    const r = this.focus.radius();
    return clamp(dist, r * 1.35 + 0.5, MAX_CAMERA_DISTANCE_KM);
  }

  /** Advance by dt seconds; returns the camera position offset (km) relative to the focus body. */
  update(dt: number): THREE.Vector3 {
    // Inertia.
    if (!this.dragging) {
      this.theta += this.velTheta;
      this.phi = clamp(this.phi + this.velPhi, -1.45, 1.45);
      this.velTheta *= Math.pow(0.02, dt);
      this.velPhi *= Math.pow(0.02, dt);
    }
    if (this.zoomVel !== 0) {
      const step = this.zoomVel * Math.min(1, dt * 9);
      this.distance = this.clampDistance(this.distance * Math.exp(step));
      this.zoomVel -= step;
      if (Math.abs(this.zoomVel) < 1e-4) this.zoomVel = 0;
    }
    if (this.transition) {
      const elapsed = performance.now() / 1000 - this.transition.start;
      const s = EASE(elapsed / this.transition.duration);
      // Log-space distance interpolation with a slight zoom-out bump.
      const a = Math.log(this.transition.startDist), b = Math.log(this.transition.endDist);
      const bump = this.transition.from.id !== this.focus.id ? Math.sin(s * Math.PI) * 0.35 : 0;
      this.distance = Math.exp(a + (b - a) * s + bump);
      if (!this.dragging) {
        const tr = this.transition;
        this.theta = tr.startTheta + (tr.endTheta - tr.startTheta) * s;
        this.phi = tr.startPhi + (tr.endPhi - tr.startPhi) * s;
      }
      if (elapsed >= this.transition.duration) { this.transition = null; this.distance = this.clampDistance(this.distance); }
    } else this.distance = this.clampDistance(this.distance);

    const cp = Math.cos(this.phi);
    _off.set(this.distance * cp * Math.sin(this.theta), this.distance * Math.sin(this.phi), this.distance * cp * Math.cos(this.theta));
    return _off;
  }

  /** Fraction of the viewport height to shift the focus point upward (used when a bottom sheet covers the centre). */
  screenShiftY = 0;
  private currentShift = 0;

  /** Update near/far for the current distance, keep the camera looking at the origin. */
  applyPose(offset: THREE.Vector3, lookOffset: THREE.Vector3) {
    this.currentShift += (this.screenShiftY - this.currentShift) * 0.12;
    this.camera.position.copy(offset).add(lookOffset);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(lookOffset);
    if (Math.abs(this.currentShift) > 1e-4) {
      // Translate camera and target along the camera's up axis so the body sits higher on screen.
      const half = this.distance * Math.tan((this.camera.fov * Math.PI) / 360);
      _up.set(0, 1, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(-half * 2 * this.currentShift);
      this.camera.position.add(_up);
      _look.copy(lookOffset).add(_up);
      this.camera.lookAt(_look);
    }
    const r = this.focus.radius();
    this.camera.near = Math.max(0.02, (this.distance - r) * 0.002);
    this.camera.far = CAMERA_FAR_KM;
    this.camera.updateProjectionMatrix();
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
const _off = new THREE.Vector3();
const _up = new THREE.Vector3();
const _look = new THREE.Vector3();
