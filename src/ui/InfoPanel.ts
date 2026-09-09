import { body, childrenOf, type BodyDef } from '@/data/catalog';

const CLOSE = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

export class InfoPanel {
  readonly el: HTMLElement;
  private statsEl: HTMLElement;
  private current: BodyDef | null = null;

  constructor(root: HTMLElement, private opts: { onFly: (id: string) => void; onSelect: (id: string) => void; onClose: () => void }) {
    this.el = document.createElement('div');
    this.el.className = 'glass panel info';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.statsEl = document.createElement('div');
  }

  get body() { return this.current; }

  show(def: BodyDef, available: boolean) {
    this.current = def;
    const kids = childrenOf(def.id);
    this.el.innerHTML = `
      <div class="head"><div><h2>${def.name}</h2><div class="kind">${def.type === 'dwarf' ? 'Dwarf planet' : def.spectral ? `${def.spectral} star` : def.type.charAt(0).toUpperCase() + def.type.slice(1)}${def.parent ? ` of ${body(def.parent).name}` : ''}${def.type === 'star' && def.moons ? ` · ${def.moons} planet${def.moons === 1 ? '' : 's'}` : ''}</div></div><button class="icon-btn close" title="Close (Esc)">${CLOSE}</button></div>
      <div class="body">
        <p class="desc">${def.description}</p>
        ${available ? '' : '<p class="desc" style="color:#ffb37a">No trajectory data for the current date.</p>'}
        <div class="stats"></div>
        ${kids.length ? `<div class="section-title">${def.type === 'planet' || def.type === 'dwarf' ? 'Moons & satellites' : def.type === 'star' ? 'Planets' : 'Companions'}</div><div class="moons-list">${kids.map((k) => `<span class="chip" data-id="${k.id}">${k.name}</span>`).join('')}</div>` : ''}
        <div class="row"><button class="pill-btn primary" data-role="fly">Fly to ${def.name}</button>${def.parent ? `<button class="pill-btn" data-role="parent">Go to ${body(def.parent).name}</button>` : ''}</div>
      </div>`;
    this.statsEl = this.el.querySelector('.stats')!;
    this.el.querySelector('.close')!.addEventListener('click', () => this.opts.onClose());
    this.el.querySelector('[data-role=fly]')!.addEventListener('click', () => this.opts.onFly(def.id));
    this.el.querySelector('[data-role=parent]')?.addEventListener('click', () => this.opts.onSelect(def.parent!));
    this.el.querySelectorAll<HTMLElement>('.chip').forEach((c) => c.addEventListener('click', () => this.opts.onSelect(c.dataset.id!)));
    this.el.hidden = false;
  }

  hide() { this.el.hidden = true; this.current = null; }
  get visible() { return !this.el.hidden; }

  /** Replace the live stat grid. */
  setStats(rows: [string, string, boolean?][]) {
    if (this.el.hidden) return;
    this.statsEl.innerHTML = rows.map(([k, v, wide]) => `<div class="stat${wide ? ' wide' : ''}"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
  }
}
