import { computeEvents } from '../../src/events/compute';
const t0 = performance.now();
const evs = computeEvents(Date.UTC(2026, 8, 2, 10, 30), 3 * 365);
console.log(`computed ${evs.length} events in ${((performance.now() - t0) / 1000).toFixed(2)} s`);
for (const e of evs.slice(0, 28)) console.log(new Date(e.ms).toISOString().slice(0, 16), e.kind.padEnd(11), e.title, e.detail ? '— ' + e.detail.slice(0, 70) : '');
