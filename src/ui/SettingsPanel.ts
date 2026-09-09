import type { Settings, SettingsState } from '@/core/Settings';

const TOGGLES: [keyof SettingsState, string][] = [
  ['orbits', 'Orbit lines'], ['labels', 'Labels'], ['moons', 'Moons'], ['smallBodies', 'Asteroids & comets'], ['spacecraft', 'Spacecraft'], ['belts', 'Asteroid & Kuiper belts'], ['stars', 'Stars & Milky Way'], ['exoplanets', 'Exoplanet systems'], ['deepSky', 'Nebulae & clusters'], ['deepStars', 'Deep star catalogue (+221k stars, 9 MB)'],
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
      <div class="credits">Positions: JPL Horizons, JPL SBDB, astronomy-engine, <a href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noopener">NASA Exoplanet Archive</a>. Textures: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope</a> (CC BY 4.0), moon maps NASA/JPL/SSI &amp; LPI (public domain), Milky Way: ESO/S. Brunier (CC BY 4.0), deep-sky data: OpenNGC (CC BY-SA 4.0), nebula photos: Wikimedia Commons (credits in each object's panel), stars: HYG v4.1 &amp; AT-HYG v4.0 (astronexus, CC BY-SA 4.0; Gaia DR3 distances).</div>`;
    this.el.querySelectorAll<HTMLElement>('[data-scale]').forEach((b) => b.addEventListener('click', () => this.settings.set('scaleMode', b.dataset.scale as 'visual' | 'real')));
    this.el.querySelectorAll<HTMLElement>('.toggle').forEach((t) => t.addEventListener('click', () => this.settings.toggle(t.dataset.key as never)));
  }
}
