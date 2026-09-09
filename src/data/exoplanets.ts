/**
 * Exoplanet systems as catalogue bodies. The archive supplies the numbers
 * (src/ephemeris/exoplanets.ts); this file turns them into `BodyDef`s, assigns
 * procedural skins by planet class, and layers hand-written descriptions on the
 * systems people ask about. Hosts already curated in stars.ts keep their entries.
 */
import { EXO_INCL_ASSUMED, EXO_PHASE_UNKNOWN, EXO_TRANSITS, type ExoCatalog, type ExoHost, type ExoPlanet } from '@/ephemeris/exoplanets';
import { LY_KM, PC_KM } from '@/ephemeris/frames';
import { BODY_MAP, type BodyDef, type ProceduralSkin } from './catalog';
import { tempColor } from './stars';

const R_EARTH = 6371, M_EARTH = 5.9722e24, R_SUN = 695700, M_SUN = 1.9885e30;
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// --- Curated text --------------------------------------------------------------------------
interface Note { description: string; facts?: [string, string][]; aliases?: string[] }

/** Hosts that are not in stars.ts. Keys are archive host names. */
export const HOST_NOTES: Record<string, Note> = {
  'Kepler-186': { description: 'A red dwarf 580 light-years away in Cygnus with five planets. The outermost, Kepler-186f, was in 2014 the first Earth-sized planet found in a star\'s habitable zone.' },
  'Kepler-452': { description: 'A Sun-like star 1,800 light-years away, 1.5 billion years older than the Sun. Kepler-452b, announced in 2015 as "Earth\'s cousin", orbits in its habitable zone every 385 days.' },
  'Kepler-22': { description: 'A Sun-like star 640 light-years away whose planet Kepler-22b was, in 2011, the first transiting planet confirmed in a habitable zone.' },
  'Kepler-16': { description: 'A pair of stars 245 light-years away orbited by Kepler-16b, the first planet confirmed to circle two suns (2011), a Saturn-mass world with a 229-day year.', facts: [['Stars', 'K dwarf + M dwarf, 41-day orbit']] },
  'Kepler-11': { description: 'A Sun-like star 2,100 light-years away with six planets, five of them packed inside the orbit of Mercury: the first compact multi-planet system found by transits (2011).' },
  'Kepler-90': { description: 'A Sun-like star 2,800 light-years away with eight known planets, matching the Solar System\'s count; the eighth, Kepler-90i, was found with machine learning in 2017.' },
  'TOI-700': { description: 'A quiet red dwarf 100 light-years away with four small planets. TOI-700 d (2020) and e (2023) are Earth-sized worlds in the habitable zone, found by TESS.' },
  'LHS 1140': { description: 'A red dwarf 49 light-years away. Its planet LHS 1140 b, a rocky or water-rich super-Earth in the habitable zone, is one of the best targets for detecting an atmosphere with JWST.' },
  'K2-18': { description: 'A red dwarf 124 light-years away with a sub-Neptune, K2-18 b, whose atmosphere shows water vapour, methane and carbon dioxide; a possible "Hycean" ocean world.' },
  'GJ 1214': { description: 'A red dwarf 48 light-years away with the archetypal mini-Neptune GJ 1214 b, whose thick hazy atmosphere has defied spectroscopy since 2009.' },
  'Kepler-10': { description: 'A Sun-like star 600 light-years away. Kepler-10b (2011) was the first rocky planet confirmed by Kepler: a lava world orbiting in 20 hours.' },
  'Kepler-444': { description: 'An 11-billion-year-old star 117 light-years away with five planets smaller than Venus, formed when the Universe was a fifth of its present age.' },
  'Kepler-62': { description: 'A K dwarf 1,200 light-years away with five planets; Kepler-62e and f (2013) were among the first potentially habitable super-Earths.' },
  'Kepler-438': { description: 'A red dwarf 470 light-years away whose planet Kepler-438b is one of the most Earth-like in size, though its star\'s flares may have stripped its atmosphere.' },
  'TOI-715': { description: 'A red dwarf 137 light-years away with a super-Earth in the habitable zone, TOI-715 b, found by TESS in 2024.' },
  'GJ 667 C': { description: 'The smallest member of a triple star system 23 light-years away, with at least two super-Earths, one of them (Gliese 667 Cc) in the habitable zone.' },
  'Gliese 12': { description: 'A red dwarf 40 light-years away with Gliese 12 b, a Venus-sized temperate planet found in 2024, close enough for JWST to probe its air.' },
  'HD 219134': { description: 'An orange dwarf 21 light-years away with at least five planets; HD 219134 b is the nearest transiting rocky planet known.' },
  'YZ Ceti': { description: 'A red dwarf 12 light-years away with three small planets on very tight orbits; radio bursts hint that the innermost may interact with the star\'s magnetic field.' },
  'HD 40307': { description: 'An orange dwarf 42 light-years away with a system of super-Earths, one of them, HD 40307 g, near the habitable zone.' },
  'HD 10180': { description: 'A Sun-like star 127 light-years away with six confirmed planets, once the richest system known outside our own.' },
  'WASP-12': { description: 'A Sun-like star 1,400 light-years away devouring its planet: WASP-12b, a hot Jupiter orbiting in 26 hours, is being stretched into an egg and stripped of gas.' },
  'WASP-121': { description: 'An F-type star 850 light-years away with an ultra-hot Jupiter whose dayside is hot enough to vaporise iron; the planet is puffed up close to the point of being torn apart.' },
  'WASP-39': { description: 'A Sun-like star 700 light-years away whose hot Saturn, WASP-39b, gave JWST its first clear detection of carbon dioxide in an exoplanet atmosphere (2022).' },
  'KELT-9': { description: 'A blue-white star 670 light-years away hosting the hottest planet known: KELT-9b, whose dayside reaches 4,300 °C, hotter than many stars.' },
  'PSR B1257+12': { description: 'A millisecond pulsar 2,300 light-years away, the spinning remnant of a supernova. Its three planets, found in 1992 from timing glitches, were the first planets discovered outside the Solar System.', facts: [['Spin period', '6.22 ms'], ['First exoplanets', '1992, Wolszczan & Frail']] },
  'CoRoT-7': { description: 'An orange dwarf 520 light-years away with CoRoT-7b, the first rocky exoplanet with a measured size (2009), a lava world orbiting in 20 hours.' },
  'Wolf 1069': { description: 'A red dwarf 31 light-years away with an Earth-mass planet in the habitable zone, Wolf 1069 b, found in 2023.' },
  'LP 890-9': { description: 'A cool red dwarf 105 light-years away with two Earth-sized planets; LP 890-9 c sits in the habitable zone.' },
  'HD 69830': { description: 'An orange dwarf 41 light-years away with three Neptune-mass planets and an asteroid belt detected by Spitzer.' },
  'Kepler-1649': { description: 'A red dwarf 300 light-years away whose planet Kepler-1649c, found in archived Kepler data in 2020, is close to Earth in size and receives similar sunlight.' },
  'Kepler-296': { description: 'A binary of red dwarfs 740 light-years away with five planets, two of them in the habitable zone.' },
  '82 G. Eridani': { description: 'A Sun-like star 20 light-years away, one of the closest with planets: three super-Earths on tight orbits.', aliases: ['e Eridani', 'HD 20794'] },
  'GJ 3470': { description: 'A red dwarf 96 light-years away with a warm Neptune whose escaping atmosphere forms a huge hydrogen cloud.' },
  'HAT-P-11': { description: 'An orange dwarf 123 light-years away with a Neptune-sized planet on a polar orbit, the first small exoplanet with water detected in its atmosphere.' },
  'TRAPPIST-1': { description: 'An ultra-cool dwarf barely larger than Jupiter, 41 light-years away, with seven Earth-sized planets found in 2016–17. Three lie in the habitable zone; all seven would fit inside Mercury\'s orbit.' },
};

/** Planets with hand-written text. Keys are archive planet names. */
export const PLANET_NOTES: Record<string, Note> = {
  'Proxima Cen b': { description: 'The nearest exoplanet: an Earth-mass world orbiting Proxima Centauri every 11.2 days at 0.05 AU, inside the habitable zone of its dim star. Tidally locked and bathed in flares, it may or may not keep an atmosphere.', facts: [['Discovered', '2016, Anglada-Escudé et al.'], ['Equilibrium temperature', '~234 K']] },
  'Proxima Cen d': { description: 'A quarter-Earth-mass planet skimming Proxima Centauri every 5.1 days, one of the lightest planets ever found by radial velocity (2022).' },
  'TRAPPIST-1 b': { description: 'The innermost TRAPPIST-1 world, an airless rock hot enough to melt lead on its dayside, as JWST measured in 2023.' },
  'TRAPPIST-1 c': { description: 'A Venus-sized planet that JWST found lacks a thick carbon-dioxide atmosphere.' },
  'TRAPPIST-1 d': { description: 'A small world at the inner edge of the habitable zone, receiving a little more light than Venus does.' },
  'TRAPPIST-1 e': { description: 'The most Earth-like of the seven: Earth\'s size and density, in the middle of the habitable zone. A prime target for JWST\'s search for an atmosphere.' },
  'TRAPPIST-1 f': { description: 'A habitable-zone planet probably rich in water, receiving about as much light as Mars does from the Sun.' },
  'TRAPPIST-1 g': { description: 'The largest TRAPPIST-1 planet, at the outer edge of the habitable zone, likely with a thick ice or water layer.' },
  'TRAPPIST-1 h': { description: 'The outermost and coldest of the seven, orbiting in 19 days; all seven planets are locked in a chain of orbital resonances.' },
  'Kepler-186 f': { description: 'The first Earth-sized planet found in a habitable zone (2014): 1.17 Earth radii, 130-day orbit around a red dwarf, receiving a third of the light Earth gets.' },
  'Kepler-452 b': { description: '"Earth\'s cousin": 1.6 Earth radii in a 385-day orbit around a Sun-like star, receiving 10% more light than Earth. Probably rocky, possibly with a thick atmosphere.' },
  'Kepler-22 b': { description: 'The first habitable-zone transiting planet confirmed (2011): 2.4 Earth radii, 290-day orbit, likely an ocean world or mini-Neptune.' },
  'Kepler-16 b': { description: 'Tatooine made real: a Saturn-mass planet circling two stars every 229 days, the first confirmed circumbinary planet (2011).' },
  'Kepler-90 i': { description: 'The eighth planet of Kepler-90, found in 2017 by a neural network trained on Kepler light curves: a hot rocky world orbiting every 14 days.' },
  'Kepler-10 b': { description: 'Kepler\'s first rocky planet (2011): 1.5 Earth radii, 20-hour orbit, with a dayside of molten rock at 2,000 K.' },
  'Kepler-62 f': { description: 'A super-Earth in the outer habitable zone of an orange dwarf, orbiting every 267 days; among the first potentially habitable planets found.' },
  'Kepler-1649 c': { description: 'Rediscovered in 2020 after Kepler\'s software had rejected it: 1.06 Earth radii, receiving 75% of Earth\'s sunlight from its red dwarf.' },
  'TOI-700 d': { description: 'TESS\'s first Earth-sized habitable-zone planet (2020), orbiting a quiet red dwarf every 37 days.' },
  'TOI-700 e': { description: 'A second Earth-sized world of TOI-700 in the optimistic habitable zone, found in 2023.' },
  'LHS 1140 b': { description: 'A super-Earth in the habitable zone of a nearby red dwarf; JWST hints at a nitrogen atmosphere and possibly a global ocean. A leading candidate for a habitable world.' },
  'K2-18 b': { description: 'A sub-Neptune 8.6 times Earth\'s mass in the habitable zone. JWST found methane and carbon dioxide in its atmosphere (2023) and a debated hint of dimethyl sulphide.' },
  'GJ 1214 b': { description: 'The archetypal mini-Neptune, 2.7 Earth radii, wrapped in high-altitude haze that hides its lower atmosphere. JWST mapped its heat in 2023.' },
  '51 Peg b': { description: 'Dimidium, the first planet found around a Sun-like star (1995): half Jupiter\'s mass orbiting in 4.2 days, which forced astronomers to invent the "hot Jupiter". Its discoverers, Mayor and Queloz, shared the 2019 Nobel Prize.' },
  'HD 209458 b': { description: 'Osiris, the first transiting exoplanet (1999). Its atmosphere was the first detected (sodium, 2001) and it is boiling away in a comet-like tail of hydrogen.' },
  'HD 189733 b': { description: 'A deep-blue hot Jupiter with 8,700 km/h winds and rain of molten glass, the best-studied giant exoplanet.' },
  '55 Cnc e': { description: 'Janssen: a lava world twice Earth\'s size orbiting in 17.7 hours, with a magma ocean and, JWST suggests, a thick atmosphere fed by the magma.' },
  'WASP-12 b': { description: 'A hot Jupiter being eaten by its star: tidally stretched, orbiting in 26 hours, and spiralling inward to destruction in about three million years.' },
  'WASP-121 b': { description: 'An ultra-hot Jupiter where iron and magnesium vaporise on the dayside and may rain as liquid metal on the night side.' },
  'WASP-39 b': { description: 'A hot Saturn that gave JWST its first unambiguous carbon-dioxide detection in an exoplanet atmosphere (2022), plus sulphur dioxide made by photochemistry.' },
  'KELT-9 b': { description: 'The hottest known planet: a dayside at 4,300 °C where molecules are torn apart and iron and titanium exist as atomic vapour.' },
  'PSR B1257+12 c': { description: 'Poltergeist, one of the first exoplanets ever found (1992): a four-Earth-mass planet orbiting a pulsar, detected from tiny shifts in the pulsar\'s radio ticks.' },
  'PSR B1257+12 d': { description: 'Phobetor, a pulsar planet found alongside Poltergeist in 1992, orbiting the dead star every 98 days.' },
  'PSR B1257+12 b': { description: 'Draugr, the least massive exoplanet known, about twice the Moon\'s mass, orbiting a pulsar every 25 days.' },
  'CoRoT-7 b': { description: 'The first rocky exoplanet with a measured size (2009): 1.6 Earth radii, 20-hour orbit, a molten dayside and possibly a rock-vapour atmosphere.' },
  'GJ 436 b': { description: 'Awohali, a warm Neptune whose escaping atmosphere trails behind it like a comet, 50 times the planet\'s size.' },
  'Gliese 667 C c': { description: 'A super-Earth in the habitable zone of a red dwarf in a triple star system, 23 light-years away.' },
  'GJ 273 b': { description: 'Luyten b, a super-Earth in the habitable zone of Luyten\'s Star, 12 light-years away; the target of the 2017 "Sónar Calling" message, arriving in 2030.' },
  'Ross 128 b': { description: 'A temperate Earth-mass planet around a quiet red dwarf 11 light-years away, orbiting every 9.9 days.' },
  'Teegarden\'s Star b': { description: 'One of the most Earth-like planets known in mass and temperature, 12.5 light-years away, orbiting its tiny star every 4.9 days.' },
  'Barnard b': { description: 'A sub-Earth-mass planet orbiting Barnard\'s Star every 3.15 days, confirmed in 2024 after decades of false alarms.' },
  'Wolf 1069 b': { description: 'An Earth-mass planet in the habitable zone of a red dwarf 31 light-years away, probably tidally locked with a permanent dayside.' },
  'HR 8799 b': { description: 'The outermost of four giant planets photographed directly around HR 8799 (2008), orbiting at 70 AU with a 460-year year.' },
  'HR 8799 e': { description: 'The innermost of the four imaged HR 8799 giants; JWST measured carbon dioxide in its atmosphere in 2025.' },
  'bet Pic b': { description: 'A young super-Jupiter imaged orbiting inside Beta Pictoris\'s debris disc, its orbit tracked directly since 2008.' },
  'eps Eri b': { description: 'Ægir, a Jupiter-like planet on a 7.4-year orbit around Epsilon Eridani, the closest known Jupiter analogue.' },
  'Gliese 12 b': { description: 'A Venus-sized temperate planet 40 light-years away (2024), one of the best small worlds for atmospheric study.' },
  'TOI-715 b': { description: 'A super-Earth in the conservative habitable zone of a red dwarf, found by TESS in 2024.' },
  'Kepler-11 b': { description: 'The innermost of Kepler-11\'s six planets, all packed within a region smaller than Mercury\'s orbit yet gravitationally stable.' },
  'ups And b': { description: 'Saffar, a hot Jupiter in the first multi-planet system found around a main-sequence star (1999).' },
  'HD 219134 b': { description: 'The nearest known transiting rocky planet, 21 light-years away, orbiting in 3 days with a dayside of molten rock.' },
  'Gliese 876 d': { description: 'A hot super-Earth found in 2005, at the time the lowest-mass planet known around a normal star.' },
  'tau Cet e': { description: 'A candidate super-Earth near the inner edge of Tau Ceti\'s habitable zone.' },
  'eps Ind A b': { description: 'A cold Jupiter-like giant 12 light-years away, imaged directly by JWST in 2024.' },
};

// --- Planet classes and skins -------------------------------------------------------------
export type PlanetClass = 'lava' | 'rocky' | 'temperate' | 'icy' | 'super-earth' | 'mini-neptune' | 'neptune' | 'hot-jupiter' | 'gas-giant';

export function classify(p: ExoPlanet): PlanetClass {
  const r = p.rade, t = p.eqt;
  if (r < 1.6) {
    if (t > 1200) return 'lava';
    if (t > 400) return 'rocky';
    if (t > 170) return 'temperate';
    return 'icy';
  }
  if (r < 2.2) return 'super-earth';
  if (r < 4) return 'mini-neptune';
  if (r < 7) return 'neptune';
  return t > 1000 ? 'hot-jupiter' : 'gas-giant';
}

const CLASS_LABEL: Record<PlanetClass, string> = {
  lava: 'lava world', rocky: 'hot rocky planet', temperate: 'temperate rocky planet', icy: 'cold rocky planet',
  'super-earth': 'super-Earth', 'mini-neptune': 'mini-Neptune', neptune: 'Neptune-like planet', 'hot-jupiter': 'hot Jupiter', 'gas-giant': 'gas giant',
};

export function planetSkin(cls: PlanetClass, seed: string): { color: string; procedural: ProceduralSkin } {
  // Vary hue slightly per planet so systems don't look cloned.
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  const v = (h % 100) / 100;
  const pick = (a: string, b: string) => (v < 0.5 ? a : b);
  switch (cls) {
    case 'lava': return { color: '#ff7a3a', procedural: { base: '#3a1a10', accent: pick('#ff8c2a', '#ffb347'), style: 'cratered', detail: 0.9 } };
    case 'rocky': return { color: '#c9a07a', procedural: { base: pick('#8c6a4a', '#a08060'), accent: '#d9c2a0', style: 'rocky', detail: 0.7 } };
    case 'temperate': return { color: '#6fa8d8', procedural: { base: pick('#2f6ea8', '#3a7a9a'), accent: pick('#c8b48a', '#8fbf8f'), style: 'rocky', detail: 0.6 } };
    case 'icy': return { color: '#d8e8f0', procedural: { base: '#c8d8e0', accent: '#f0f6fa', style: 'icy', detail: 0.5 } };
    case 'super-earth': return { color: '#9fb8c8', procedural: { base: pick('#6f8fa8', '#7a8f9f'), accent: '#c0d0dc', style: 'rocky', detail: 0.55 } };
    case 'mini-neptune': return { color: '#8fb4e0', procedural: { base: pick('#5a86c0', '#6a90b8'), accent: '#b8d0ee', style: 'banded', detail: 0.4 } };
    case 'neptune': return { color: '#5a8cff', procedural: { base: pick('#3f6fd8', '#4a78d0'), accent: '#8fb0ff', style: 'banded', detail: 0.4 } };
    case 'hot-jupiter': return { color: '#c86a4a', procedural: { base: pick('#7a2e22', '#8a3a24'), accent: pick('#e0804a', '#d09050'), style: 'banded', detail: 0.5 } };
    default: return { color: '#d9b48a', procedural: { base: pick('#b8905e', '#c0a070'), accent: pick('#e8d2a8', '#f0e0c0'), style: 'banded', detail: 0.5 } };
  }
}

// --- Defs ------------------------------------------------------------------------------------
const fmtLy = (pc: number) => { const ly = (pc * PC_KM) / LY_KM; return ly < 100 ? `${ly.toFixed(0)}` : `${Math.round(ly / 10) * 10}`; };
const fmtPeriod = (d: number) => (d < 2 ? `${(d * 24).toFixed(1)} hours` : d < 100 ? `${d.toFixed(1)} days` : d < 1000 ? `${d.toFixed(0)} days` : `${(d / 365.25).toFixed(1)} years`);

function hostDescription(h: ExoHost): string {
  const kind = h.spect ? `${h.spect.split(' ')[0]} star` : h.teff < 3900 ? 'red dwarf' : h.teff < 5300 ? 'orange dwarf' : h.teff < 6000 ? 'Sun-like star' : h.teff < 7500 ? 'yellow-white star' : 'hot star';
  return `A ${kind} ${fmtLy(h.dist)} light-years away with ${h.n} known planet${h.n === 1 ? '' : 's'}, from the NASA Exoplanet Archive.`;
}

function planetDescription(p: ExoPlanet, h: ExoHost, cls: PlanetClass): string {
  const size = p.rade < 0.9 ? 'smaller than Earth' : p.rade < 1.25 ? 'about Earth-sized' : p.rade < 11 ? `${p.rade.toFixed(1)} times Earth's radius` : `${(p.rade / 11.2).toFixed(1)} times Jupiter's radius`;
  const how = p.method === 'Transit' ? 'from its transits' : p.method === 'Radial Velocity' ? 'from its star\'s wobble' : p.method === 'Imaging' ? 'by direct imaging' : p.method === 'Microlensing' ? 'by gravitational microlensing' : `by ${p.method.toLowerCase()}`;
  return `A ${CLASS_LABEL[cls]} ${size}, orbiting ${h.name} every ${fmtPeriod(p.per)} at ${(p.a / 1.495978707e8).toPrecision(2)} AU. Found ${how}${p.year ? ` in ${p.year}` : ''}${p.facility ? ` (${p.facility})` : ''}.`;
}

/** Build BodyDefs for every host (unless already curated) and planet in the catalogue. */
export function buildExoplanetBodies(cat: ExoCatalog): BodyDef[] {
  const out: BodyDef[] = [];
  const hostIds: string[] = [];
  cat.hosts.forEach((h, i) => {
    const existing = BODY_MAP.get(h.key);
    if (existing) { hostIds[i] = existing.id; existing.moons = h.n; if (!existing.aliases?.includes(h.name) && existing.name !== h.name) (existing.aliases ??= []).push(h.name); return; }
    const note = HOST_NOTES[h.name];
    const id = h.key;
    hostIds[i] = id;
    out.push({
      id, name: h.name, type: 'star', radius: (isNaN(h.rad) ? 1 : h.rad) * R_SUN, mass: isNaN(h.mass) ? undefined : h.mass * M_SUN,
      color: tempColor(isNaN(h.teff) ? 5500 : h.teff), temperature: isNaN(h.teff) ? undefined : `${Math.round(h.teff).toLocaleString('en-US')} K surface`,
      spectral: h.spect || undefined, luminosity: isNaN(h.lum) ? undefined : h.lum, moons: h.n, aliases: note?.aliases,
      source: { kind: 'star', key: h.key }, description: note?.description ?? hostDescription(h), facts: note?.facts, lazy: true, generated: !note,
    });
  });
  cat.planets.forEach((p) => {
    const h = cat.hosts[p.host];
    const cls = classify(p);
    const skin = planetSkin(cls, p.name);
    const note = PLANET_NOTES[p.name];
    const facts: [string, string][] = [];
    if (!isNaN(p.eqt)) facts.push(['Equilibrium temperature', `${Math.round(p.eqt)} K · ${Math.round(p.eqt - 273.15)} °C`]);
    if (p.flags & EXO_PHASE_UNKNOWN) facts.push(['Orbital phase', 'no transit or periastron epoch measured; periastron placed at J2000']);
    if (p.flags & EXO_INCL_ASSUMED) facts.push(['Inclination', `not measured; ${p.incl}° assumed`]);
    facts.push(['Orientation on the sky', 'node angle not measured (drawn at 0°)']);
    out.push({
      id: slug(p.name), name: p.name, type: 'exoplanet', parent: hostIds[p.host], radius: p.rade * R_EARTH, mass: isNaN(p.masse) ? undefined : p.masse * M_EARTH,
      orbitDays: p.per, color: skin.color, procedural: skin.procedural, source: { kind: 'exoplanet', key: p.name },
      description: note?.description ?? planetDescription(p, h, cls), discovered: `${p.year || '?'}, ${p.method}${p.facility ? ` (${p.facility})` : ''}`,
      facts: [...(note?.facts ?? []), ...facts], aliases: note?.aliases, lazy: true, generated: !note,
      temperature: (p.flags & EXO_TRANSITS) ? undefined : undefined,
    });
  });
  return out;
}

export const PLANET_CLASS_LABEL = CLASS_LABEL;
