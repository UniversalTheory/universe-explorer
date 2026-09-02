import { AU_KM } from '@/ephemeris/frames';

export function fmtKm(km: number): string {
  if (!isFinite(km)) return '—';
  if (km > 0.05 * AU_KM) return `${(km / AU_KM).toFixed(km / AU_KM < 10 ? 3 : 2)} AU · ${fmtBig(km)} km`;
  return `${fmtBig(km)} km`;
}
export function fmtBig(x: number, digits = 3): string {
  if (!isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a >= 1e9) return `${(x / 1e9).toPrecision(digits)} billion`;
  if (a >= 1e6) return `${(x / 1e6).toPrecision(digits)} million`;
  if (a >= 1e4) return Math.round(x).toLocaleString('en-US');
  if (a >= 100) return x.toFixed(0);
  return x.toPrecision(3);
}
export function fmtMass(kg: number): string {
  const e = Math.floor(Math.log10(kg));
  return `${(kg / 10 ** e).toFixed(2)} × 10${sup(e)} kg`;
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = (n: number) => String(n).split('').map((c) => (c === '-' ? '⁻' : SUP[+c])).join('');

export function fmtDays(days: number): string {
  if (!isFinite(days)) return 'unbound';
  const a = Math.abs(days);
  if (a < 1) return `${(a * 24).toFixed(2)} h`;
  if (a < 60) return `${a.toFixed(2)} days`;
  if (a < 365.25 * 2) return `${a.toFixed(1)} days`;
  if (a < 365.25 * 1000) return `${(a / 365.25).toFixed(a / 365.25 < 10 ? 2 : 1)} years`;
  return `${fmtBig(a / 365.25)} years`;
}
export function fmtHours(h: number): string {
  const a = Math.abs(h);
  const retro = h < 0 ? ' (retrograde)' : '';
  if (a < 48) return `${a.toFixed(2)} h${retro}`;
  return `${(a / 24).toFixed(a / 24 < 10 ? 2 : 1)} days${retro}`;
}
export function fmtDate(ms: number, relativeToMs?: number): string {
  const d = new Date(ms);
  const sameYear = relativeToMs !== undefined && new Date(relativeToMs).getFullYear() === d.getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' });
}
export function fmtDateTime(ms: number, compact = false): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', ...(compact ? {} : { second: '2-digit' }) });
}
export function fmtRelative(ms: number, nowMs: number): string {
  const d = (ms - nowMs) / 86400000;
  const a = Math.abs(d);
  const s = d >= 0 ? 'in ' : '';
  const e = d < 0 ? ' ago' : '';
  if (a < 1 / 24) return d >= 0 ? 'now' : 'just passed';
  if (a < 1) return `${s}${Math.round(a * 24)} h${e}`;
  if (a < 60) return `${s}${Math.round(a)} d${e}`;
  if (a < 700) return `${s}${(a / 30.44).toFixed(0)} mo${e}`;
  return `${s}${(a / 365.25).toFixed(1)} yr${e}`;
}
