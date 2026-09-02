import { Clock, RATE_STEPS, formatRate } from '@/core/Clock';
import { fmtDateTime } from './format';

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none"/></svg>',
  slower: '<svg viewBox="0 0 24 24"><path d="M11 6l-7 6 7 6zM19 6l-7 6 7 6z" fill="currentColor" stroke="none"/></svg>',
  faster: '<svg viewBox="0 0 24 24"><path d="M5 6l7 6-7 6zM13 6l7 6-7 6z" fill="currentColor" stroke="none"/></svg>',
};

export class TimeBar {
  readonly el: HTMLElement;
  private dateEl: HTMLElement;
  private rateEl: HTMLElement;
  private playBtn: HTMLButtonElement;
  private picker: HTMLInputElement;
  private lastText = '';

  constructor(root: HTMLElement, private clock: Clock) {
    this.el = document.createElement('div');
    this.el.className = 'glass timebar';
    this.el.innerHTML = `
      <button class="icon-btn" data-role="slower" title="Slower / reverse ([)">${ICON.slower}</button>
      <button class="icon-btn" data-role="play" title="Play / pause (space)">${ICON.pause}</button>
      <button class="icon-btn" data-role="faster" title="Faster (])">${ICON.faster}</button>
      <div class="datetime" title="Click to set a date and time"><div class="date"></div><div class="rate"></div><input type="datetime-local" step="1" /></div>
      <button class="pill-btn now-btn" data-role="now" title="Return to the present (N)">Now</button>`;
    root.appendChild(this.el);
    this.dateEl = this.el.querySelector('.date')!;
    this.rateEl = this.el.querySelector('.rate')!;
    this.playBtn = this.el.querySelector('[data-role=play]')!;
    this.picker = this.el.querySelector('input')!;
    this.el.querySelector('[data-role=slower]')!.addEventListener('click', () => this.step(-1));
    this.el.querySelector('[data-role=faster]')!.addEventListener('click', () => this.step(1));
    this.playBtn.addEventListener('click', () => clock.toggle());
    this.el.querySelector('[data-role=now]')!.addEventListener('click', () => clock.goLive());
    const dt = this.el.querySelector<HTMLElement>('.datetime')!;
    dt.addEventListener('click', () => {
      const d = new Date(clock.ms);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
      this.picker.value = local;
      const pk = this.picker as HTMLInputElement & { showPicker?: () => void };
      try { if (pk.showPicker) pk.showPicker(); else pk.focus(); } catch { pk.focus(); }
    });
    this.picker.addEventListener('change', () => { const v = this.picker.valueAsNumber; if (!isNaN(v)) clock.set(v + new Date(v).getTimezoneOffset() * 60000); });
    clock.onChange(() => this.render());
    this.render();
  }

  /** Move to the next/previous speed preset; negative rates run time backwards. */
  step(dir: 1 | -1) {
    const c = this.clock;
    const rate = c.rate;
    const sign = Math.sign(rate) || 1;
    const idx = RATE_STEPS.findIndex((r) => r >= Math.abs(rate) - 1e-9);
    let newRate: number;
    if (sign > 0) {
      if (dir > 0) newRate = RATE_STEPS[Math.min(RATE_STEPS.length - 1, idx + 1)];
      else newRate = idx <= 0 ? -RATE_STEPS[0] : RATE_STEPS[idx - 1];
    } else {
      if (dir < 0) newRate = -RATE_STEPS[Math.min(RATE_STEPS.length - 1, idx + 1)];
      else newRate = idx <= 0 ? RATE_STEPS[0] : -RATE_STEPS[idx - 1];
    }
    if (newRate === 1 && !c.live) c.setRate(1); else c.setRate(newRate);
  }

  render() {
    const c = this.clock;
    const text = fmtDateTime(c.ms, innerWidth < 720);
    if (text !== this.lastText) { this.dateEl.textContent = text; this.lastText = text; }
    this.rateEl.textContent = c.live ? 'live' : c.playing ? formatRate(c.rate) : 'paused';
    this.rateEl.classList.toggle('live', c.live);
    this.playBtn.innerHTML = c.playing ? ICON.pause : ICON.play;
  }
}
