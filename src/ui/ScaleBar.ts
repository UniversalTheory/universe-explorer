/**
 * Map-style scale bar: a line whose length is a round number of km / AU / ly / pc / kpc
 * measured in the plane of the focused body, so the reader always knows how far out they are.
 */
import { AU_KM, KPC_KM, LY_KM, PC_KM } from '@/ephemeris/frames';

const UNITS: [number, string][] = [[KPC_KM, 'kpc'], [PC_KM, 'pc'], [LY_KM, 'ly'], [AU_KM, 'AU'], [1, 'km']];
const NICE = [1, 2, 5];
const TARGET_PX = 120;

export class ScaleBar {
  readonly el: HTMLElement;
  private bar: HTMLElement;
  private text: HTMLElement;
  private lastLabel = '';

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'glass scalebar';
    this.el.innerHTML = '<div class="bar"></div><div class="txt"></div>';
    root.appendChild(this.el);
    this.bar = this.el.querySelector('.bar')!;
    this.text = this.el.querySelector('.txt')!;
  }

  /** @param kmPerPx kilometres per CSS pixel at the focus distance. */
  update(kmPerPx: number) {
    if (!isFinite(kmPerPx) || kmPerPx <= 0) return;
    const target = kmPerPx * TARGET_PX;
    let unitKm = 1, unit = 'km';
    for (const [u, name] of UNITS) if (target / u >= 1) { unitKm = u; unit = name; break; }
    const v = target / unitKm;
    const e = Math.floor(Math.log10(v));
    let nice = 10 ** e;
    for (const n of NICE) if (n * 10 ** e <= v) nice = n * 10 ** e;
    const px = (nice * unitKm) / kmPerPx;
    const label = `${nice >= 1e4 ? nice.toLocaleString('en-US') : nice} ${unit}`;
    if (label !== this.lastLabel) { this.text.textContent = label; this.lastLabel = label; }
    this.bar.style.width = `${px.toFixed(1)}px`;
  }

  setVisible(v: boolean) { this.el.hidden = !v; }
}
