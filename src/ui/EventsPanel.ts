import type { SkyEvent } from '@/events/types';
import { fmtDate, fmtRelative } from './format';

const CLOSE = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICONS: Record<string, string> = { eclipse: '🌘', moon: '🌕', season: '🌍', planet: '🪐', conjunction: '✨', alignment: '🔭', meteor: '☄️', apsis: '☀️', transit: '⚫', mission: '🛰️' };

export class EventsPanel {
  readonly el: HTMLElement;
  readonly next: HTMLElement;
  private list: HTMLElement;
  private events: SkyEvent[] = [];
  private renderedKey = '';

  constructor(root: HTMLElement, private opts: { onJump: (ev: SkyEvent) => void }) {
    this.el = document.createElement('div');
    this.el.className = 'glass panel events';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="head"><div><h2>Upcoming events</h2><div class="kind">from the current simulation time</div></div><button class="icon-btn close" title="Close">${CLOSE}</button></div><div class="body"><div class="list"><p class="desc">Computing…</p></div></div>`;
    root.appendChild(this.el);
    this.list = this.el.querySelector('.list')!;
    this.el.querySelector('.close')!.addEventListener('click', () => this.hide());
    this.next = document.createElement('div');
    this.next.className = 'glass next-event';
    this.next.hidden = true;
    this.next.addEventListener('click', () => this.show());
    root.appendChild(this.next);
  }

  get visible() { return !this.el.hidden; }
  show() { this.el.hidden = false; this.renderedKey = ''; }
  hide() { this.el.hidden = true; }
  toggle() { this.el.hidden ? this.show() : this.hide(); }

  setEvents(events: SkyEvent[]) { this.events = events; this.renderedKey = ''; }

  /** Refresh relative times (cheap; call ~1 Hz). */
  update(nowMs: number) {
    const upcoming = this.events.filter((e) => e.ms >= nowMs - 3600000);
    const first = upcoming[0];
    if (first) {
      this.next.hidden = false;
      this.next.innerHTML = `Next: <b>${first.title}</b> · ${fmtRelative(first.ms, nowMs)}`;
    } else this.next.hidden = true;
    if (this.el.hidden) return;
    const key = `${upcoming.length}:${first?.ms}:${Math.floor(nowMs / 3600000)}`;
    if (key === this.renderedKey) return;
    this.renderedKey = key;
    if (!upcoming.length) { this.list.innerHTML = '<p class="desc">No events computed yet.</p>'; return; }
    this.list.innerHTML = upcoming.slice(0, 60).map((e, i) => `
      <div class="event" data-i="${i}">
        <div class="when"><span class="d">${fmtDate(e.ms, nowMs)}</span><span class="rel">${fmtRelative(e.ms, nowMs)}</span></div>
        <div class="icon">${ICONS[e.kind] ?? '•'}</div>
        <div class="what"><div class="t">${e.title}</div>${e.detail ? `<div class="s">${e.detail}</div>` : ''}</div>
      </div>`).join('');
    this.list.querySelectorAll<HTMLElement>('.event').forEach((el) => el.addEventListener('click', () => this.opts.onJump(upcoming[+el.dataset.i!])));
  }
}
