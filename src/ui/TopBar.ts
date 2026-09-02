import type { BodyDef } from '@/data/catalog';

const ICONS = {
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  events: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.5"/><circle cx="9" cy="17" r="2.5"/></svg>',
};

export class TopBar {
  readonly el: HTMLElement;
  private input: HTMLInputElement;
  private results: HTMLElement;
  private eventsBtn: HTMLButtonElement;
  private settingsBtn: HTMLButtonElement;
  private active = -1;
  private matches: BodyDef[] = [];

  constructor(root: HTMLElement, private bodies: BodyDef[], private opts: { onSelect: (id: string) => void; onToggleEvents: () => void; onToggleSettings: () => void }) {
    this.el = document.createElement('div');
    this.el.className = 'topbar';
    this.el.innerHTML = `
      <div class="glass brand"><span class="dot"></span><span class="title">Universe Explorer</span><span class="sub">live solar system</span></div>
      <div class="search">${ICONS.search}<input type="search" placeholder="${innerWidth < 720 ? 'Search…' : 'Search planets, moons, comets, spacecraft…'}" autocomplete="off" spellcheck="false" /><div class="glass search-results"></div></div>
      <div class="spacer"></div>
      <div class="glass actions"><button class="icon-btn" data-role="events" title="Upcoming events (E)">${ICONS.events}</button><button class="icon-btn" data-role="settings" title="Display settings (S)">${ICONS.settings}</button></div>`;
    root.appendChild(this.el);
    this.input = this.el.querySelector('input')!;
    this.results = this.el.querySelector('.search-results')!;
    this.eventsBtn = this.el.querySelector('[data-role=events]')!;
    this.settingsBtn = this.el.querySelector('[data-role=settings]')!;
    this.eventsBtn.addEventListener('click', () => opts.onToggleEvents());
    this.settingsBtn.addEventListener('click', () => opts.onToggleSettings());
    this.input.addEventListener('input', () => this.search(this.input.value));
    this.input.addEventListener('focus', () => this.search(this.input.value));
    this.input.addEventListener('blur', () => setTimeout(() => this.close(), 150));
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { this.active = Math.min(this.matches.length - 1, this.active + 1); this.render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { this.active = Math.max(0, this.active - 1); this.render(); e.preventDefault(); }
      else if (e.key === 'Enter') { const m = this.matches[Math.max(0, this.active)]; if (m) this.choose(m.id); }
      else if (e.key === 'Escape') { this.input.blur(); this.close(); }
      e.stopPropagation();
    });
  }

  focusSearch() { this.input.focus(); this.input.select(); }
  setEventsActive(on: boolean) { this.eventsBtn.classList.toggle('active', on); }
  setSettingsActive(on: boolean) { this.settingsBtn.classList.toggle('active', on); }

  private search(q: string) {
    const s = q.trim().toLowerCase();
    this.matches = s
      ? this.bodies.filter((b) => b.name.toLowerCase().includes(s) || b.id.includes(s) || b.type.includes(s)).slice(0, 12)
      : this.bodies.filter((b) => b.type === 'planet' || b.type === 'star').slice(0, 12);
    this.active = 0;
    this.render();
  }
  private render() {
    this.results.innerHTML = this.matches.map((b, i) => `<div class="search-item${i === this.active ? ' active' : ''}" data-id="${b.id}"><span class="swatch" style="background:${b.color}"></span>${b.name}<span class="type">${b.type}</span></div>`).join('');
    this.results.classList.toggle('open', this.matches.length > 0);
    this.results.querySelectorAll<HTMLElement>('.search-item').forEach((el) => el.addEventListener('mousedown', (e) => { e.preventDefault(); this.choose(el.dataset.id!); }));
  }
  private choose(id: string) { this.opts.onSelect(id); this.input.value = ''; this.input.blur(); this.close(); }
  private close() { this.results.classList.remove('open'); }
}
