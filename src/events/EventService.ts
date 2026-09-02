import type { EventsResponse, SkyEvent } from './types';

/** Runs event computation off the main thread and caches by day. */
export class EventService {
  private worker: Worker;
  private pending = false;
  private lastMs = NaN;
  events: SkyEvent[] = [];
  onUpdate?: (events: SkyEvent[]) => void;

  constructor() {
    this.worker = new Worker(new URL('./events.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<EventsResponse>) => {
      this.pending = false;
      this.events = e.data.events;
      this.onUpdate?.(this.events);
    };
  }

  /** Request events from `ms` if the cached start differs by more than a day. */
  request(ms: number, horizonDays = 3 * 365) {
    if (this.pending) return;
    if (!isNaN(this.lastMs) && Math.abs(ms - this.lastMs) < 86400000) return;
    this.pending = true;
    this.lastMs = ms;
    this.worker.postMessage({ type: 'compute', ms, horizonDays });
  }

  /** Events after `ms`. */
  upcoming(ms: number, limit = 40): SkyEvent[] {
    return this.events.filter((e) => e.ms >= ms - 3600000).slice(0, limit);
  }
}
