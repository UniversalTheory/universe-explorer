/**
 * Time scales.
 *
 * The simulation clock is a JavaScript epoch (ms, UTC). Ephemeris code wants
 * TT (Terrestrial Time), expressed as days since J2000.0 = JD 2451545.0 TT.
 * TDB (used by JPL Horizons) differs from TT by < 2 ms, which is ignored.
 */
import { MakeTime, type AstroTime } from 'astronomy-engine';

export const J2000_JD = 2451545.0;
export const DAY_MS = 86_400_000;
export const JULIAN_YEAR_DAYS = 365.25;
export const JULIAN_CENTURY_DAYS = 36525;

/** Days since J2000 TT for a JS Date / epoch ms. */
export function ttDays(dateOrMs: Date | number): number {
  return MakeTime(dateOrMs instanceof Date ? dateOrMs : new Date(dateOrMs)).tt;
}
export function astroTime(dateOrMs: Date | number): AstroTime {
  return MakeTime(dateOrMs instanceof Date ? dateOrMs : new Date(dateOrMs));
}
export const jdTT = (tt: number) => J2000_JD + tt;
export const ttFromJD = (jd: number) => jd - J2000_JD;
/** Julian centuries since J2000 TT. */
export const centuries = (tt: number) => tt / JULIAN_CENTURY_DAYS;

/** Approximate JS epoch ms from days since J2000 TT (inverse of ttDays, ~ms precision). */
export function msFromTT(tt: number): number {
  // Iterate once on the UT-TT offset (Delta T).
  const guess = Date.UTC(2000, 0, 1, 12) + tt * DAY_MS;
  const err = ttDays(guess) - tt;
  return guess - err * DAY_MS;
}

export function formatUTC(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/** A resolved simulation instant in every time scale the app needs. */
export interface SimTime {
  /** JS epoch milliseconds (UTC). */
  ms: number;
  astro: AstroTime;
  /** Days since J2000.0 TT. */
  tt: number;
  /** Julian date, TT (≈ TDB). */
  jd: number;
}
export function makeSimTime(ms: number): SimTime {
  const astro = MakeTime(new Date(ms));
  return { ms, astro, tt: astro.tt, jd: J2000_JD + astro.tt };
}
