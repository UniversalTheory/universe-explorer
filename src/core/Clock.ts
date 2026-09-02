/**
 * Simulation clock. Tracks a simulated instant (ms since epoch, UTC) that
 * advances at `rate` × real time while playing. `live` means the clock is
 * pinned to the real current time.
 */
import { makeSimTime, type SimTime } from './time';

export type ClockListener = (clock: Clock) => void;

export class Clock {
  private _ms = Date.now();
  private _rate = 1;
  private _playing = true;
  private _live = true;
  private listeners = new Set<ClockListener>();
  private _time: SimTime = makeSimTime(this._ms);

  get ms() { return this._ms; }
  get rate() { return this._rate; }
  get playing() { return this._playing; }
  get live() { return this._live; }
  get time(): SimTime { return this._time; }

  onChange(fn: ClockListener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { for (const l of this.listeners) l(this); }

  /** Advance by real elapsed milliseconds. */
  update(dtMs: number) {
    if (this._live) this._ms = Date.now();
    else if (this._playing) this._ms += dtMs * this._rate;
    else return;
    this._time = makeSimTime(this._ms);
  }

  set(ms: number) {
    this._live = false;
    this._ms = ms;
    this._time = makeSimTime(ms);
    this.emit();
  }
  setRate(rate: number) {
    if (rate === 1 && this._live) return;
    this._live = false;
    this._rate = rate;
    this._playing = true;
    this.emit();
  }
  play() { this._playing = true; this.emit(); }
  pause() { this._live = false; this._playing = false; this.emit(); }
  toggle() { this._playing ? this.pause() : this.play(); }
  /** Snap back to real time. */
  goLive() { this._live = true; this._playing = true; this._rate = 1; this._ms = Date.now(); this._time = makeSimTime(this._ms); this.emit(); }
}

/** Speed presets in multiples of real time. */
export const RATE_STEPS = [1, 60, 600, 3600, 6 * 3600, 86400, 7 * 86400, 30 * 86400, 365.25 * 86400, 10 * 365.25 * 86400];

export function formatRate(rate: number): string {
  const a = Math.abs(rate);
  const sign = rate < 0 ? '−' : '';
  if (a === 1) return 'real time';
  if (a < 60) return `${sign}${a}×`;
  if (a < 3600) return `${sign}${(a / 60).toFixed(0)} min/s`;
  if (a < 86400) return `${sign}${(a / 3600).toFixed(0)} h/s`;
  if (a < 30 * 86400) return `${sign}${(a / 86400).toFixed(0)} d/s`;
  if (a < 365 * 86400) return `${sign}${(a / (30 * 86400)).toFixed(0)} mo/s`;
  return `${sign}${(a / (365.25 * 86400)).toFixed(0)} yr/s`;
}
