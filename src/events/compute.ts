/**
 * Upcoming astronomical events from a given instant, computed with
 * astronomy-engine plus static tables. Pure; runs inside a Web Worker.
 */
import {
  Body, MakeTime, SearchMoonQuarter, NextMoonQuarter, SearchLunarEclipse, NextLunarEclipse, SearchGlobalSolarEclipse,
  NextGlobalSolarEclipse, Seasons, SearchRelativeLongitude, SearchMaxElongation, SearchPlanetApsis, NextPlanetApsis,
  SearchLunarApsis, NextLunarApsis, SearchTransit, GeoVector, AngleBetween, Ecliptic, type AstroTime,
} from 'astronomy-engine';
import { METEOR_SHOWERS, NOTABLE_EVENTS } from '@/data/event-tables';
import { AU_KM } from '@/ephemeris/frames';
import type { SkyEvent } from './types';

const DAY = 86400000;
const ms = (t: AstroTime) => t.date.getTime();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function computeEvents(startMs: number, horizonDays: number): SkyEvent[] {
  const t0 = MakeTime(new Date(startMs));
  const endMs = startMs + horizonDays * DAY;
  const out: SkyEvent[] = [];
  const push = (e: SkyEvent) => { if (e.ms >= startMs - DAY && e.ms <= endMs) out.push(e); };

  // Moon phases.
  try {
    let mq = SearchMoonQuarter(t0);
    const names = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'];
    for (let k = 0; k < 10 && ms(mq.time) <= endMs; k++) {
      push({ ms: ms(mq.time), title: names[mq.quarter], kind: 'moon', focus: 'moon', distance: 2.5e4 });
      mq = NextMoonQuarter(mq);
    }
  } catch (e) { console.warn(e); }

  // Eclipses.
  try {
    let le = SearchLunarEclipse(t0);
    for (let k = 0; k < 6 && ms(le.peak) <= endMs; k++) {
      const mins = Math.round((le.kind === 'total' ? le.sd_total : le.kind === 'partial' ? le.sd_partial : le.sd_penum) * 2);
      push({ ms: ms(le.peak), title: `${cap(le.kind)} lunar eclipse`, detail: `Greatest eclipse; ${le.kind} phase lasts about ${mins} min.`, kind: 'eclipse', focus: 'moon', distance: 3.0e4 });
      le = NextLunarEclipse(le.peak);
    }
  } catch (e) { console.warn(e); }
  try {
    let se = SearchGlobalSolarEclipse(t0);
    for (let k = 0; k < 6 && ms(se.peak) <= endMs; k++) {
      const lat = se.latitude ?? NaN, lon = se.longitude ?? NaN;
      const where = isFinite(lat) && isFinite(lon) ? ` Greatest eclipse near ${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(0)}°${lon >= 0 ? 'E' : 'W'}.` : '';
      push({ ms: ms(se.peak), title: `${cap(se.kind)} solar eclipse`, detail: `The Moon's shadow crosses Earth.${where}`, kind: 'eclipse', focus: 'earth', distance: 6.0e4 });
      se = NextGlobalSolarEclipse(se.peak);
    }
  } catch (e) { console.warn(e); }

  // Seasons.
  const y0 = new Date(startMs).getUTCFullYear();
  for (let y = y0; y <= y0 + Math.ceil(horizonDays / 365) + 1; y++) {
    const s = Seasons(y);
    push({ ms: ms(s.mar_equinox), title: 'March equinox', detail: 'Day and night are equal length everywhere on Earth.', kind: 'season', focus: 'earth' });
    push({ ms: ms(s.jun_solstice), title: 'June solstice', detail: 'Longest day in the northern hemisphere.', kind: 'season', focus: 'earth' });
    push({ ms: ms(s.sep_equinox), title: 'September equinox', kind: 'season', focus: 'earth' });
    push({ ms: ms(s.dec_solstice), title: 'December solstice', detail: 'Longest day in the southern hemisphere.', kind: 'season', focus: 'earth' });
  }

  // Planetary configurations.
  const outer: [Body, string][] = [[Body.Mars, 'mars'], [Body.Jupiter, 'jupiter'], [Body.Saturn, 'saturn'], [Body.Uranus, 'uranus'], [Body.Neptune, 'neptune']];
  for (const [b, id] of outer) {
    try {
      const opp = SearchRelativeLongitude(b, 180, t0);
      push({ ms: ms(opp), title: `${cap(id)} at opposition`, detail: 'Opposite the Sun in the sky: closest, brightest, visible all night.', kind: 'planet', focus: id });
      const conj = SearchRelativeLongitude(b, 0, t0);
      push({ ms: ms(conj), title: `${cap(id)} in conjunction with the Sun`, detail: 'Passes behind the Sun as seen from Earth.', kind: 'planet', focus: id });
    } catch (e) { console.warn(e); }
  }
  for (const [b, id] of [[Body.Mercury, 'mercury'], [Body.Venus, 'venus']] as [Body, string][]) {
    try {
      const inf = SearchRelativeLongitude(b, 0, t0);
      push({ ms: ms(inf), title: `${cap(id)} at inferior conjunction`, detail: 'Passes between Earth and the Sun.', kind: 'planet', focus: id });
      const sup = SearchRelativeLongitude(b, 180, t0);
      push({ ms: ms(sup), title: `${cap(id)} at superior conjunction`, detail: 'Passes behind the Sun.', kind: 'planet', focus: id });
      let el = SearchMaxElongation(b, t0);
      for (let k = 0; k < 4 && ms(el.time) <= endMs; k++) {
        push({ ms: ms(el.time), title: `${cap(id)} at greatest ${el.visibility} elongation`, detail: `${el.elongation.toFixed(1)}° from the Sun, best ${el.visibility} visibility.`, kind: 'planet', focus: id });
        el = SearchMaxElongation(b, el.time.AddDays(1));
      }
    } catch (e) { console.warn(e); }
  }

  // Apsides.
  try {
    let ap = SearchPlanetApsis(Body.Earth, t0);
    for (let k = 0; k < 3 && ms(ap.time) <= endMs; k++) {
      push({ ms: ms(ap.time), title: ap.kind === 0 ? 'Earth at perihelion' : 'Earth at aphelion', detail: `${(ap.dist_au * AU_KM / 1e6).toFixed(2)} million km from the Sun.`, kind: 'apsis', focus: 'earth' });
      ap = NextPlanetApsis(Body.Earth, ap);
    }
  } catch (e) { console.warn(e); }
  try {
    let la = SearchLunarApsis(t0);
    const fulls = out.filter((e) => e.title === 'Full Moon');
    for (let k = 0; k < 30 && ms(la.time) <= endMs; k++) {
      if (la.kind === 0) {
        const near = fulls.find((f) => Math.abs(f.ms - ms(la.time)) < 1.2 * DAY);
        if (near) { near.title = 'Supermoon (full Moon at perigee)'; near.detail = `Full Moon within a day of perigee, ${(la.dist_km / 1000).toFixed(0)},000 km away: larger and brighter than usual.`; }
      }
      la = NextLunarApsis(la);
    }
  } catch (e) { console.warn(e); }

  // Transits (rare; only report if within horizon).
  for (const [b, id] of [[Body.Mercury, 'mercury'], [Body.Venus, 'venus']] as [Body, string][]) {
    try {
      const tr = SearchTransit(b, t0);
      if (ms(tr.peak) <= endMs) push({ ms: ms(tr.peak), title: `Transit of ${cap(id)}`, detail: `${cap(id)} crosses the face of the Sun as seen from Earth.`, kind: 'transit', focus: id });
    } catch (e) { console.warn(e); }
  }

  // Close conjunctions between planets and with the Moon (angular separation minima).
  const bright: [Body, string][] = [[Body.Mercury, 'mercury'], [Body.Venus, 'venus'], [Body.Mars, 'mars'], [Body.Jupiter, 'jupiter'], [Body.Saturn, 'saturn']];
  const sep = (a: Body, b: Body, t: AstroTime) => AngleBetween(GeoVector(a, t, true), GeoVector(b, t, true));
  const scanDays = Math.min(horizonDays, 3 * 365);
  for (let i = 0; i < bright.length; i++) {
    for (let j = i + 1; j < bright.length; j++) {
      const [a, ida] = bright[i], [b, idb] = bright[j];
      let prev = sep(a, b, t0), prev2 = Infinity;
      for (let d = 1; d <= scanDays; d++) {
        const t = t0.AddDays(d);
        const s = sep(a, b, t);
        if (prev < prev2 && prev < s && prev < 2.5) {
          // Refine the minimum around day d-1.
          let lo = d - 2, hi = d;
          for (let k = 0; k < 20; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (sep(a, b, t0.AddDays(m1)) < sep(a, b, t0.AddDays(m2))) hi = m2; else lo = m1; }
          const tm = t0.AddDays((lo + hi) / 2);
          const smin = sep(a, b, tm);
          // Skip if both are too close to the Sun to see.
          const sunSep = AngleBetween(GeoVector(a, tm, true), GeoVector(Body.Sun, tm, true));
          if (sunSep > 8) push({ ms: ms(tm), title: `${cap(ida)} meets ${cap(idb)}`, detail: `Planetary conjunction: ${smin.toFixed(1)}° apart in the sky.`, kind: 'conjunction', focus: ida });
        }
        prev2 = prev; prev = s;
      }
    }
  }
  // Moon passing planets (next 90 days only).
  for (const [b, id] of bright) {
    let prev = sep(Body.Moon, b, t0), prev2 = Infinity;
    for (let d = 1; d <= Math.min(horizonDays, 90); d++) {
      const t = t0.AddDays(d);
      const s = sep(Body.Moon, b, t);
      if (prev < prev2 && prev < s && prev < 4) {
        const sunSep = AngleBetween(GeoVector(b, t, true), GeoVector(Body.Sun, t, true));
        if (sunSep > 12) push({ ms: ms(t0.AddDays(d - 1)), title: `Moon near ${cap(id)}`, detail: `About ${prev.toFixed(1)}° apart: an easy naked-eye pairing.`, kind: 'conjunction', focus: 'moon' });
      }
      prev2 = prev; prev = s;
    }
  }

  // Planetary alignments: several bright planets within a narrow arc of the sky.
  try {
    let inWindow = false;
    for (let d = 0; d <= scanDays; d += 2) {
      const t = t0.AddDays(d);
      const lons = bright.map(([b]) => Ecliptic(GeoVector(b, t, true)).elon).sort((x, y) => x - y);
      const sunLon = Ecliptic(GeoVector(Body.Sun, t, true)).elon;
      // Only planets more than 15° from the Sun count as visible.
      const vis = lons.filter((l) => Math.min(Math.abs(l - sunLon), 360 - Math.abs(l - sunLon)) > 15);
      let best = { count: 0, span: 360 };
      for (let i = 0; i < vis.length; i++) {
        for (let n = vis.length; n >= 3; n--) {
          if (i + n > vis.length) continue;
          const span = vis[i + n - 1] - vis[i];
          if ((n >= 4 && span < 45) || (n >= 3 && span < 15)) { if (n > best.count) best = { count: n, span }; break; }
        }
      }
      const aligned = best.count >= 3;
      if (aligned && !inWindow) push({ ms: ms(t), title: `${best.count} planets align`, detail: `${best.count} bright planets gather within ${best.span.toFixed(0)}° of sky, visible together.`, kind: 'alignment', focus: 'sun', distance: 1.2e9 });
      inWindow = aligned;
    }
  } catch (e) { console.warn(e); }

  // Meteor showers (approximate peak dates).
  for (let y = y0; y <= y0 + Math.ceil(horizonDays / 365); y++) {
    for (const sh of METEOR_SHOWERS) {
      push({ ms: Date.UTC(y, sh.month - 1, sh.day, 4), title: `${sh.name} meteor shower peak`, detail: `Up to ~${sh.zhr} meteors/hour under dark skies.`, kind: 'meteor', focus: sh.parent ?? 'earth' });
    }
  }
  for (const n of NOTABLE_EVENTS) push({ ms: Date.parse(n.date), title: n.title, detail: n.detail, kind: 'mission', focus: n.body });

  out.sort((a, b) => a.ms - b.ms);
  return out;
}
