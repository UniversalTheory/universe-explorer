/** DOM labels projected onto the canvas, with simple priority-based decluttering. */
export interface LabelEntry {
  id: string;
  text: string;
  x: number; y: number;
  /** Offset from the body centre (its on-screen radius). */
  radiusPx: number;
  priority: number;
  kind: string;
  visible: boolean;
  dim?: boolean;
}

export class Labels {
  private els = new Map<string, HTMLDivElement>();
  private ring: HTMLDivElement;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;

  constructor(private container: HTMLElement) {
    this.ring = document.createElement('div');
    this.ring.className = 'select-ring';
    this.ring.hidden = true;
    container.appendChild(this.ring);
  }

  private el(id: string, text: string, kind: string): HTMLDivElement {
    let e = this.els.get(id);
    if (!e) {
      e = document.createElement('div');
      e.className = `label label-${kind}`;
      e.textContent = text;
      e.dataset.id = id;
      e.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      e.addEventListener('click', (ev) => { ev.stopPropagation(); this.onSelect?.(id); });
      e.addEventListener('pointerenter', () => this.onHover?.(id));
      e.addEventListener('pointerleave', () => this.onHover?.(null));
      this.container.appendChild(e);
      this.els.set(id, e);
    }
    return e;
  }

  update(entries: LabelEntry[], width: number, height: number, selected: { id: string; x: number; y: number; radiusPx: number; visible: boolean } | null) {
    const placed: { l: number; t: number; r: number; b: number }[] = [];
    const shown = new Set<string>();
    entries.sort((a, b) => b.priority - a.priority);
    for (const en of entries) {
      if (!en.visible || en.x < -50 || en.y < -50 || en.x > width + 50 || en.y > height + 50) continue;
      const w = en.text.length * 6.6 + 16, h = 20;
      const l = en.x + en.radiusPx + 8, t = en.y - h / 2, r = l + w, b = t + h;
      let overlap = false;
      for (const p of placed) if (l < p.r && r > p.l && t < p.b && b > p.t) { overlap = true; break; }
      if (overlap) continue;
      placed.push({ l, t, r, b });
      const e = this.el(en.id, en.text, en.kind);
      e.style.transform = `translate(${l.toFixed(1)}px, ${t.toFixed(1)}px)`;
      e.classList.toggle('dim', !!en.dim);
      e.hidden = false;
      shown.add(en.id);
    }
    for (const [id, e] of this.els) if (!shown.has(id)) e.hidden = true;
    if (selected && selected.visible) {
      const r = Math.max(selected.radiusPx + 6, 14);
      this.ring.hidden = false;
      this.ring.style.transform = `translate(${(selected.x - r).toFixed(1)}px, ${(selected.y - r).toFixed(1)}px)`;
      this.ring.style.width = this.ring.style.height = `${(r * 2).toFixed(1)}px`;
    } else this.ring.hidden = true;
  }
}
