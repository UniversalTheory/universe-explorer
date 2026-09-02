/** Persisted user settings with change notification. */
export interface SettingsState {
  scaleMode: 'visual' | 'real';
  orbits: boolean;
  labels: boolean;
  moons: boolean;
  smallBodies: boolean;
  spacecraft: boolean;
  belts: boolean;
  stars: boolean;
  quality: 'auto' | 'high' | 'low';
}

const DEFAULTS: SettingsState = {
  scaleMode: 'visual', orbits: true, labels: true, moons: true, smallBodies: true, spacecraft: true, belts: true, stars: true, quality: 'auto',
};
const KEY = 'universe-explorer.settings.v1';

export class Settings {
  state: SettingsState;
  private listeners = new Set<(s: SettingsState, key: keyof SettingsState) => void>();
  constructor() {
    let saved: Partial<SettingsState> = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* ignore */ }
    this.state = { ...DEFAULTS, ...saved };
  }
  get<K extends keyof SettingsState>(k: K): SettingsState[K] { return this.state[k]; }
  set<K extends keyof SettingsState>(k: K, v: SettingsState[K]) {
    if (this.state[k] === v) return;
    this.state[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* ignore */ }
    for (const l of this.listeners) l(this.state, k);
  }
  toggle(k: { [K in keyof SettingsState]: SettingsState[K] extends boolean ? K : never }[keyof SettingsState]) {
    this.set(k, !this.state[k] as never);
  }
  onChange(fn: (s: SettingsState, key: keyof SettingsState) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}
