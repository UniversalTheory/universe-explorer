import type { Settings, SettingsState } from '@/core/Settings';

const TOGGLES: [keyof SettingsState, string][] = [
  ['orbits', 'Orbit lines'], ['labels', 'Labels'], ['moons', 'Moons'], ['smallBodies', 'Asteroids & comets'], ['spacecraft', 'Spacecraft'], ['belts', 'Asteroid & Kuiper belts'], ['stars', 'Stars & Milky Way'],
];

export class SettingsPanel {
  readonly el: HTMLElement;
  constructor(root: HTMLElement, private settings: Settings) {
    this.el = document.createElement('div');
    this.el.className = 'glass settings';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.render();
    settings.onChange(() => this.render());
  }
  get visible() { return !this.el.hidden; }
  show() { this.el.hidden = false; }
  hide() { this.el.hidden = true; }
  toggle() { this.el.hidden ? this.show() : this.hide(); }

  private render() {
    const s = this.settings.state;
    this.el.innerHTML = `
      <div class="section-title" style="padding:4px 8px 0">Scale</div>
      <div class="segmented"><button data-scale="visual" class="${s.scaleMode === 'visual' ? 'on' : ''}">Readable</button><button data-scale="real" class="${s.scaleMode === 'real' ? 'on' : ''}">True scale</button></div>
      ${TOGGLES.map(([k, label]) => `<div class="toggle ${s[k] ? 'on' : ''}" data-key="${k}"><span>${label}</span><span class="switch"></span></div>`).join('')}
      <div class="credits">Positions: JPL Horizons, JPL SBDB, astronomy-engine. Textures: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope</a> (CC BY 4.0), moon maps NASA/JPL/SSI &amp; LPI (public domain), Milky Way: ESO/S. Brunier (CC BY 4.0), stars: HYG (CC BY-SA 4.0).</div>`;
    this.el.querySelectorAll<HTMLElement>('[data-scale]').forEach((b) => b.addEventListener('click', () => this.settings.set('scaleMode', b.dataset.scale as 'visual' | 'real')));
    this.el.querySelectorAll<HTMLElement>('.toggle').forEach((t) => t.addEventListener('click', () => this.settings.toggle(t.dataset.key as never)));
  }
}
