/**
 * Static catalogue of everything the app can show. Physical data from NASA
 * planetary fact sheets / JPL SSD. Orbital state comes from the ephemeris
 * layer, not from here.
 */
/**
 * Solar System kinds, plus the Galaxy-phase kinds: 'star' also covers other stars,
 * 'exoplanet' orbits a star, 'nebula' / 'cluster' are extended deep-sky objects,
 * 'blackhole' / 'neutron' are compact objects, 'region' is a schematic structure
 * (heliopause, Oort cloud, Local Bubble…).
 */
import { STARS } from './stars';

export type BodyType =
  | 'star' | 'planet' | 'dwarf' | 'moon' | 'asteroid' | 'comet' | 'interstellar' | 'spacecraft'
  | 'exoplanet' | 'nebula' | 'cluster' | 'blackhole' | 'neutron' | 'region';

/** How the ephemeris layer computes this body's position. */
export type EphemerisSource =
  | { kind: 'sun' }
  | { kind: 'fixed'; pos: [number, number, number] } // constant heliocentric ECL position, km
  | { kind: 'star'; key: string }               // star catalogue (stars.bin) with proper motion
  | { kind: 'planet'; aeBody: string }          // astronomy-engine heliocentric body
  | { kind: 'moon-ae'; aeBody: string }         // astronomy-engine geocentric (the Moon)
  | { kind: 'galilean'; index: 0 | 1 | 2 | 3 }  // astronomy-engine JupiterMoons
  | { kind: 'moon'; key: string }               // baked fitted elements (ephemeris.json)
  | { kind: 'sbdb'; key: string }               // baked conic elements
  | { kind: 'spacecraft'; key: string }         // baked state vectors
  | { kind: 'tle'; key: string };               // bundled TLE + SGP4

export interface ProceduralSkin {
  /** Base colour (hex). */
  base: string;
  /** Secondary / highlight colour (hex). */
  accent: string;
  style: 'rocky' | 'icy' | 'dark' | 'banded' | 'cratered';
  /** 0..1 roughness of the noise. */
  detail?: number;
}

export interface RingDef { inner: number; outer: number; texture: string }
export interface AtmosphereDef { color: string; /** thickness as fraction of radius */ height: number; intensity?: number }

export interface BodyDef {
  id: string;
  name: string;
  type: BodyType;
  /** Parent body id for moons (position is relative to the parent). */
  parent?: string;
  /** Equatorial radius, km. */
  radius: number;
  polarRadius?: number;
  mass?: number;                 // kg
  /** Sidereal rotation period, hours (negative = retrograde). */
  rotationHours?: number;
  /** Sidereal orbital period, days (for facts; computed if absent). */
  orbitDays?: number;
  color: string;
  texture?: string;
  textureHi?: string;
  night?: string;
  clouds?: string;
  cloudsHi?: string;
  ring?: RingDef;
  atmosphere?: AtmosphereDef;
  procedural?: ProceduralSkin;
  source: EphemerisSource;
  description: string;
  discovered?: string;
  gravity?: number;              // m/s^2
  temperature?: string;
  moons?: number;
  /** Extra static facts. */
  facts?: [string, string][];
  /** Stars: MK spectral type, bolometric luminosity in solar units, and other names people search for. */
  spectral?: string;
  luminosity?: number;
  aliases?: string[];
}

const AE = (aeBody: string): EphemerisSource => ({ kind: 'planet', aeBody });
const MOON = (key: string): EphemerisSource => ({ kind: 'moon', key });
const SB = (key: string): EphemerisSource => ({ kind: 'sbdb', key });
const SC = (key: string): EphemerisSource => ({ kind: 'spacecraft', key });

export const SOLAR_SYSTEM: BodyDef[] = [
  {
    id: 'sun', name: 'Sun', type: 'star', radius: 695700, mass: 1.9885e30, rotationHours: 609.12, color: '#ffd27a',
    texture: 'textures/2k_sun.jpg', source: { kind: 'sun' }, gravity: 274, temperature: '5,500 °C surface · 15 million °C core',
    description: 'A G2V main-sequence star holding 99.86% of the Solar System\'s mass. Light from its surface takes 8 minutes 19 seconds to reach Earth.',
    facts: [['Age', '4.6 billion years'], ['Luminosity', '3.83 × 10²⁶ W'], ['Spectral type', 'G2V'], ['Rotation', '25.4 days at equator, ~35 days near poles']],
  },
  // --- Planets ---------------------------------------------------------------
  {
    id: 'mercury', name: 'Mercury', type: 'planet', radius: 2439.7, mass: 3.3011e23, rotationHours: 1407.6, orbitDays: 87.969, color: '#b5b0a8',
    texture: 'textures/2k_mercury.jpg', textureHi: 'textures/8k_mercury.jpg', source: AE('Mercury'), gravity: 3.7, temperature: '−180 to 430 °C', moons: 0,
    description: 'The smallest planet and closest to the Sun. Its 3:2 spin–orbit resonance means one solar day lasts two Mercurian years.',
    facts: [['Solar day', '176 Earth days'], ['Orbital eccentricity', '0.2056, highest of the planets']],
  },
  {
    id: 'venus', name: 'Venus', type: 'planet', radius: 6051.8, mass: 4.8675e24, rotationHours: -5832.5, orbitDays: 224.701, color: '#e8cda0',
    texture: 'textures/2k_venus_surface.jpg', clouds: 'textures/4k_venus_atmosphere.jpg', atmosphere: { color: '#ffd9a0', height: 0.02, intensity: 0.9 },
    source: AE('Venus'), gravity: 8.87, temperature: '465 °C', moons: 0,
    description: 'Earth\'s near twin in size, wrapped in a crushing carbon-dioxide atmosphere with sulphuric-acid clouds. It rotates backwards, slower than it orbits.',
    facts: [['Surface pressure', '92 bar'], ['Solar day', '117 Earth days']],
  },
  {
    id: 'earth', name: 'Earth', type: 'planet', radius: 6378.137, polarRadius: 6356.752, mass: 5.9722e24, rotationHours: 23.9345, orbitDays: 365.256, color: '#6fa8ff',
    texture: 'textures/2k_earth_daymap.jpg', textureHi: 'textures/8k_earth_daymap.jpg', night: 'textures/2k_earth_nightmap.jpg',
    clouds: 'textures/2k_earth_clouds.jpg', cloudsHi: 'textures/8k_earth_clouds.jpg', atmosphere: { color: '#6fb3ff', height: 0.025, intensity: 1.0 },
    source: AE('Earth'), gravity: 9.81, temperature: '15 °C average', moons: 1,
    description: 'The only world known to harbour life. 71% of its surface is ocean, and its large Moon stabilises the axial tilt that drives the seasons.',
    facts: [['Axial tilt', '23.44°'], ['Mean distance to Sun', '1 AU = 149.6 million km']],
  },
  {
    id: 'mars', name: 'Mars', type: 'planet', radius: 3396.2, polarRadius: 3376.2, mass: 6.4171e23, rotationHours: 24.6229, orbitDays: 686.98, color: '#e07b4f',
    texture: 'textures/2k_mars.jpg', textureHi: 'textures/8k_mars.jpg', atmosphere: { color: '#d9a070', height: 0.015, intensity: 0.35 },
    source: AE('Mars'), gravity: 3.71, temperature: '−65 °C average', moons: 2,
    description: 'The red planet: home to Olympus Mons, the tallest volcano in the Solar System, and Valles Marineris, a canyon as long as the USA is wide.',
    facts: [['Axial tilt', '25.19°'], ['Solar day (sol)', '24 h 39 m']],
  },
  {
    id: 'jupiter', name: 'Jupiter', type: 'planet', radius: 71492, polarRadius: 66854, mass: 1.8982e27, rotationHours: 9.925, orbitDays: 4332.59, color: '#d9b48a',
    texture: 'textures/2k_jupiter.jpg', textureHi: 'textures/8k_jupiter.jpg', atmosphere: { color: '#e0c8a8', height: 0.012, intensity: 0.5 },
    source: AE('Jupiter'), gravity: 24.79, temperature: '−110 °C cloud tops', moons: 95,
    description: 'The largest planet, 2.5 times the mass of all the others combined. The Great Red Spot is a storm wider than Earth that has raged for centuries.',
    facts: [['Fastest rotation', '9 h 55 m'], ['Magnetic field', '~20,000× Earth\'s']],
  },
  {
    id: 'saturn', name: 'Saturn', type: 'planet', radius: 60268, polarRadius: 54364, mass: 5.6834e26, rotationHours: 10.656, orbitDays: 10759.22, color: '#e8d5a3',
    texture: 'textures/2k_saturn.jpg', textureHi: 'textures/8k_saturn.jpg', ring: { inner: 74500, outer: 140220, texture: 'textures/2k_saturn_ring_alpha.png' },
    atmosphere: { color: '#f0dcb0', height: 0.012, intensity: 0.4 },
    source: AE('Saturn'), gravity: 10.44, temperature: '−140 °C cloud tops', moons: 274,
    description: 'The ringed giant. Its rings are mostly water ice, span 280,000 km, yet are typically only 10 metres thick. Saturn is less dense than water.',
    facts: [['Ring span', '~280,000 km'], ['Axial tilt', '26.73°']],
  },
  {
    id: 'uranus', name: 'Uranus', type: 'planet', radius: 25559, polarRadius: 24973, mass: 8.681e25, rotationHours: -17.24, orbitDays: 30688.5, color: '#9fdff0',
    texture: 'textures/2k_uranus.jpg', atmosphere: { color: '#b0f0ff', height: 0.015, intensity: 0.5 },
    source: AE('Uranus'), gravity: 8.87, temperature: '−195 °C', moons: 28,
    description: 'An ice giant tipped on its side: its axis is tilted 98°, so each pole gets 42 years of sunlight followed by 42 years of darkness.',
    discovered: '1781, William Herschel',
    facts: [['Axial tilt', '97.8°'], ['Coldest planetary atmosphere', '−224 °C minimum']],
  },
  {
    id: 'neptune', name: 'Neptune', type: 'planet', radius: 24764, polarRadius: 24341, mass: 1.02413e26, rotationHours: 16.11, orbitDays: 60182, color: '#4d7cff',
    texture: 'textures/2k_neptune.jpg', atmosphere: { color: '#6a8cff', height: 0.015, intensity: 0.5 },
    source: AE('Neptune'), gravity: 11.15, temperature: '−200 °C', moons: 16,
    description: 'The outermost planet, discovered by mathematics before it was seen. Its winds reach 2,100 km/h, the fastest in the Solar System.',
    discovered: '1846, Le Verrier / Galle',
    facts: [['Fastest winds', '2,100 km/h'], ['Orbits since discovery', '1 (completed 2011)']],
  },
  // --- Earth's Moon ------------------------------------------------------------
  {
    id: 'moon', name: 'Moon', type: 'moon', parent: 'earth', radius: 1737.4, mass: 7.346e22, rotationHours: 655.72, orbitDays: 27.3217, color: '#c8c8c8',
    texture: 'textures/2k_moon.jpg', textureHi: 'textures/8k_moon.jpg', source: { kind: 'moon-ae', aeBody: 'Moon' }, gravity: 1.62, temperature: '−173 to 127 °C',
    description: 'Earth\'s only natural satellite, likely formed from debris after a Mars-sized body struck the young Earth. It is drifting away 3.8 cm per year.',
    facts: [['Mean distance', '384,400 km'], ['Synodic month', '29.53 days']],
  },
  // --- Mars moons ---------------------------------------------------------------
  { id: 'phobos', name: 'Phobos', type: 'moon', parent: 'mars', radius: 11.1, mass: 1.06e16, orbitDays: 0.3189, color: '#9a8c80', source: MOON('phobos'), discovered: '1877, Asaph Hall',
    procedural: { base: '#6e655c', accent: '#4a423b', style: 'cratered' },
    description: 'A captured-asteroid-like moon orbiting faster than Mars rotates, so it rises in the west. Tidal forces will tear it apart in ~50 million years.' },
  { id: 'deimos', name: 'Deimos', type: 'moon', parent: 'mars', radius: 6.2, mass: 1.5e15, orbitDays: 1.2624, color: '#a89c90', source: MOON('deimos'), discovered: '1877, Asaph Hall',
    procedural: { base: '#8a7f73', accent: '#5c5349', style: 'cratered' },
    description: 'The smaller, outer moon of Mars. Its surface is smoothed by a thick layer of regolith.' },
  // --- Jupiter moons ------------------------------------------------------------
  { id: 'io', name: 'Io', type: 'moon', parent: 'jupiter', radius: 1821.6, mass: 8.93e22, orbitDays: 1.769, color: '#e6d27a', texture: 'textures/moons/io.jpg', source: { kind: 'galilean', index: 0 }, discovered: '1610, Galileo',
    procedural: { base: '#d9c56a', accent: '#8a4a1a', style: 'rocky', detail: 0.9 }, temperature: '−163 °C (1,600 °C in lava)',
    description: 'The most volcanically active world known, squeezed by Jupiter\'s tides. Hundreds of volcanoes paint its surface in sulphur yellows and reds.' },
  { id: 'europa', name: 'Europa', type: 'moon', parent: 'jupiter', radius: 1560.8, mass: 4.80e22, orbitDays: 3.551, color: '#d8c8b0', texture: 'textures/moons/europa.jpg', source: { kind: 'galilean', index: 1 }, discovered: '1610, Galileo',
    procedural: { base: '#d6cbb8', accent: '#9c6a48', style: 'icy', detail: 0.5 },
    description: 'A smooth ice shell over a global salt-water ocean holding twice the water of all Earth\'s oceans, a prime candidate for life. Europa Clipper arrives in 2030.' },
  { id: 'ganymede', name: 'Ganymede', type: 'moon', parent: 'jupiter', radius: 2634.1, mass: 1.4819e23, orbitDays: 7.155, color: '#a89a88', source: { kind: 'galilean', index: 2 }, discovered: '1610, Galileo',
    procedural: { base: '#9a8e80', accent: '#5a5048', style: 'cratered', detail: 0.7 },
    description: 'The largest moon in the Solar System, bigger than Mercury, and the only moon with its own magnetic field.' },
  { id: 'callisto', name: 'Callisto', type: 'moon', parent: 'jupiter', radius: 2410.3, mass: 1.0759e23, orbitDays: 16.689, color: '#7a7068', texture: 'textures/moons/callisto.jpg', source: { kind: 'galilean', index: 3 }, discovered: '1610, Galileo',
    procedural: { base: '#5e564e', accent: '#b8b0a4', style: 'cratered', detail: 0.9 },
    description: 'The most heavily cratered object known, an ancient surface unchanged for four billion years.' },
  // --- Saturn moons -------------------------------------------------------------
  { id: 'mimas', name: 'Mimas', type: 'moon', parent: 'saturn', radius: 198.2, mass: 3.75e19, orbitDays: 0.942, color: '#c9c9c9', texture: 'textures/moons/mimas.jpg', source: MOON('mimas'), discovered: '1789, Herschel',
    procedural: { base: '#bdbdbd', accent: '#7a7a7a', style: 'cratered', detail: 0.8 },
    description: 'Dominated by the 130-km Herschel crater, giving it a resemblance to the Death Star. Recent evidence suggests a young subsurface ocean.' },
  { id: 'enceladus', name: 'Enceladus', type: 'moon', parent: 'saturn', radius: 252.1, mass: 1.08e20, orbitDays: 1.370, color: '#f0f4ff', texture: 'textures/moons/enceladus.jpg', source: MOON('enceladus'), discovered: '1789, Herschel',
    procedural: { base: '#eef2f8', accent: '#9fb8d8', style: 'icy', detail: 0.4 },
    description: 'Brilliantly white and geologically alive: geysers at its south pole spray ocean water into space, feeding Saturn\'s E ring.' },
  { id: 'tethys', name: 'Tethys', type: 'moon', parent: 'saturn', radius: 531.1, mass: 6.17e20, orbitDays: 1.888, color: '#dcdcdc', texture: 'textures/moons/tethys.jpg', source: MOON('tethys'), discovered: '1684, Cassini',
    procedural: { base: '#d4d4d4', accent: '#8c8c8c', style: 'cratered', detail: 0.6 },
    description: 'An icy moon with the vast Ithaca Chasma canyon and the 450-km Odysseus impact basin.' },
  { id: 'dione', name: 'Dione', type: 'moon', parent: 'saturn', radius: 561.4, mass: 1.095e21, orbitDays: 2.737, color: '#d0d0d0', texture: 'textures/moons/dione.jpg', source: MOON('dione'), discovered: '1684, Cassini',
    procedural: { base: '#c8c8c8', accent: '#787878', style: 'cratered', detail: 0.6 },
    description: 'Wispy bright ice cliffs streak its trailing hemisphere. Dione shares its orbit with two tiny Trojan moons.' },
  { id: 'rhea', name: 'Rhea', type: 'moon', parent: 'saturn', radius: 763.8, mass: 2.31e21, orbitDays: 4.518, color: '#c4c4c4', texture: 'textures/moons/rhea.jpg', source: MOON('rhea'), discovered: '1672, Cassini',
    procedural: { base: '#bcbcbc', accent: '#707070', style: 'cratered', detail: 0.7 },
    description: 'Saturn\'s second-largest moon, a heavily cratered ball of ice and rock with a tenuous oxygen atmosphere.' },
  { id: 'titan', name: 'Titan', type: 'moon', parent: 'saturn', radius: 2574.7, mass: 1.3452e23, orbitDays: 15.945, color: '#d9a13b', texture: 'textures/moons/titan.jpg', source: MOON('titan'), discovered: '1655, Huygens',
    procedural: { base: '#c9962f', accent: '#8f6a20', style: 'banded', detail: 0.3 }, atmosphere: { color: '#e0a848', height: 0.06, intensity: 1.0 }, temperature: '−179 °C',
    description: 'The only moon with a thick atmosphere, and the only other world with liquid on its surface: lakes and rivers of methane and ethane. Dragonfly launches for Titan in 2028.' },
  { id: 'iapetus', name: 'Iapetus', type: 'moon', parent: 'saturn', radius: 734.5, mass: 1.81e21, orbitDays: 79.32, color: '#a09080', texture: 'textures/moons/iapetus.jpg', source: MOON('iapetus'), discovered: '1671, Cassini',
    procedural: { base: '#d8d0c4', accent: '#2a2018', style: 'dark', detail: 0.8 },
    description: 'The two-toned moon: one hemisphere is as dark as coal, the other bright ice. An equatorial ridge 20 km high makes it look like a walnut.' },
  // --- Uranus moons -------------------------------------------------------------
  { id: 'miranda', name: 'Miranda', type: 'moon', parent: 'uranus', radius: 235.8, mass: 6.6e19, orbitDays: 1.413, color: '#b8bcc4', source: MOON('miranda'), discovered: '1948, Kuiper',
    procedural: { base: '#b0b4bc', accent: '#606468', style: 'icy', detail: 0.9 },
    description: 'A patchwork world with the tallest cliff in the Solar System, Verona Rupes, 20 km high.' },
  { id: 'ariel', name: 'Ariel', type: 'moon', parent: 'uranus', radius: 578.9, mass: 1.35e21, orbitDays: 2.520, color: '#c8ccd4', source: MOON('ariel'), discovered: '1851, Lassell',
    procedural: { base: '#c4c8d0', accent: '#7c8088', style: 'icy', detail: 0.6 },
    description: 'The brightest of Uranus\'s moons, crossed by valleys that suggest past geological activity.' },
  { id: 'umbriel', name: 'Umbriel', type: 'moon', parent: 'uranus', radius: 584.7, mass: 1.17e21, orbitDays: 4.144, color: '#6c7078', source: MOON('umbriel'), discovered: '1851, Lassell',
    procedural: { base: '#5c6068', accent: '#2c3038', style: 'cratered', detail: 0.7 },
    description: 'The darkest of the major Uranian moons, with a mysterious bright ring called Wunda near its equator.' },
  { id: 'titania', name: 'Titania', type: 'moon', parent: 'uranus', radius: 788.4, mass: 3.53e21, orbitDays: 8.706, color: '#b4b0b0', source: MOON('titania'), discovered: '1787, Herschel',
    procedural: { base: '#aca8a8', accent: '#605c5c', style: 'cratered', detail: 0.6 },
    description: 'The largest moon of Uranus, scarred by enormous canyons up to 1,500 km long.' },
  { id: 'oberon', name: 'Oberon', type: 'moon', parent: 'uranus', radius: 761.4, mass: 3.01e21, orbitDays: 13.463, color: '#a8a09c', source: MOON('oberon'), discovered: '1787, Herschel',
    procedural: { base: '#a0989c', accent: '#504848', style: 'cratered', detail: 0.7 },
    description: 'The outermost major moon of Uranus, with an ancient cratered surface and a mountain 11 km high.' },
  // --- Neptune moons ------------------------------------------------------------
  { id: 'triton', name: 'Triton', type: 'moon', parent: 'neptune', radius: 1353.4, mass: 2.14e22, orbitDays: 5.877, color: '#d8c8c0', texture: 'textures/moons/triton.jpg', source: MOON('triton'), discovered: '1846, Lassell',
    procedural: { base: '#d4c4bc', accent: '#8c7c78', style: 'icy', detail: 0.5 }, temperature: '−235 °C',
    description: 'A captured Kuiper-belt object orbiting Neptune backwards, with nitrogen geysers and a cantaloupe-textured surface. It is slowly spiralling inward.' },
  { id: 'proteus', name: 'Proteus', type: 'moon', parent: 'neptune', radius: 210, mass: 4.4e19, orbitDays: 1.122, color: '#807878', source: MOON('proteus'), discovered: '1989, Voyager 2',
    procedural: { base: '#6c6464', accent: '#3c3434', style: 'cratered', detail: 0.8 },
    description: 'Neptune\'s second-largest moon, so dark and close to the planet that it was missed until Voyager 2 flew by.' },
  { id: 'nereid', name: 'Nereid', type: 'moon', parent: 'neptune', radius: 170, mass: 3e19, rotationHours: 11.52, orbitDays: 360.13, color: '#9c9c9c', source: MOON('nereid'), discovered: '1949, Kuiper',
    procedural: { base: '#8c8c8c', accent: '#505050', style: 'rocky', detail: 0.7 },
    description: 'Follows one of the most eccentric orbits of any moon, ranging from 1.4 to 9.7 million km from Neptune.' },
  // --- Pluto system -------------------------------------------------------------
  { id: 'pluto', name: 'Pluto', type: 'dwarf', radius: 1188.3, mass: 1.303e22, rotationHours: -153.29, orbitDays: 90560, color: '#d8b898', source: AE('Pluto'), discovered: '1930, Clyde Tombaugh',
    procedural: { base: '#cfae8e', accent: '#5a3e2e', style: 'icy', detail: 0.6 }, temperature: '−229 °C', moons: 5, gravity: 0.62,
    description: 'The best-known dwarf planet, with a heart-shaped nitrogen glacier, Sputnik Planitia. Pluto and Charon orbit a point between them, a true double system.' },
  { id: 'charon', name: 'Charon', type: 'moon', parent: 'pluto', radius: 606, mass: 1.586e21, orbitDays: 6.387, color: '#a8a0a0', source: MOON('charon'), discovered: '1978, Christy',
    procedural: { base: '#a09898', accent: '#5a3c34', style: 'icy', detail: 0.5 },
    description: 'Half the diameter of Pluto, with a dark red polar cap of organic material. Pluto and Charon are tidally locked to each other.' },
  // --- Dwarf planets & asteroids ----------------------------------------------
  { id: 'ceres', name: 'Ceres', type: 'dwarf', radius: 469.7, mass: 9.38e20, rotationHours: 9.07, color: '#b0a8a0', texture: 'textures/2k_ceres_fictional.jpg', source: SB('ceres'), discovered: '1801, Piazzi', gravity: 0.28,
    description: 'The largest object in the asteroid belt and the only dwarf planet in the inner Solar System. Bright salt deposits in Occator crater hint at briny water below.' },
  { id: 'vesta', name: 'Vesta', type: 'asteroid', radius: 262.7, mass: 2.59e20, rotationHours: 5.342, color: '#b8b0a0', source: SB('vesta'), discovered: '1807, Olbers',
    procedural: { base: '#aca498', accent: '#5c5448', style: 'cratered', detail: 0.8 },
    description: 'The brightest asteroid, occasionally visible to the naked eye. A giant impact at its south pole excavated a crater almost as wide as Vesta itself.' },
  { id: 'pallas', name: 'Pallas', type: 'asteroid', radius: 256, mass: 2.04e20, rotationHours: 7.81, color: '#a0a0a8', source: SB('pallas'), discovered: '1802, Olbers',
    procedural: { base: '#8c8c94', accent: '#48484e', style: 'cratered', detail: 0.9 },
    description: 'The third-most-massive asteroid, on an unusually tilted 35° orbit.' },
  { id: 'hygiea', name: 'Hygiea', type: 'asteroid', radius: 217, mass: 8.7e19, rotationHours: 13.8, color: '#787070', source: SB('hygiea'), discovered: '1849, de Gasparis',
    procedural: { base: '#605858', accent: '#302828', style: 'cratered', detail: 0.7 },
    description: 'The fourth-largest asteroid and nearly spherical, possibly qualifying as a dwarf planet.' },
  { id: 'juno', name: 'Juno', type: 'asteroid', radius: 123, mass: 2.7e19, rotationHours: 7.21, color: '#9c948c', source: SB('juno'), discovered: '1804, Harding',
    procedural: { base: '#8c8478', accent: '#4c4438', style: 'cratered', detail: 0.8 },
    description: 'One of the first asteroids discovered, a large stony body in the inner belt.' },
  { id: 'eros', name: 'Eros', type: 'asteroid', radius: 8.4, mass: 6.69e15, rotationHours: 5.27, color: '#b0a090', source: SB('eros'), discovered: '1898, Witt',
    procedural: { base: '#a89888', accent: '#584838', style: 'cratered', detail: 0.9 },
    description: 'A 34-km peanut-shaped near-Earth asteroid, the first ever orbited and landed on by a spacecraft (NEAR Shoemaker, 2001).' },
  { id: 'apophis', name: 'Apophis', type: 'asteroid', radius: 0.17, mass: 6.1e10, rotationHours: 30.6, color: '#c8b8a0', source: SB('apophis'), discovered: '2004',
    procedural: { base: '#a89880', accent: '#584830', style: 'rocky', detail: 0.9 },
    description: 'On 13 April 2029 this 340-m asteroid will pass just 31,600 km from Earth, closer than geostationary satellites, and be visible to the naked eye.' },
  { id: 'bennu', name: 'Bennu', type: 'asteroid', radius: 0.245, mass: 7.33e10, rotationHours: 4.30, color: '#6c6460', source: SB('bennu'), discovered: '1999',
    procedural: { base: '#4c4440', accent: '#242020', style: 'rocky', detail: 1.0 },
    description: 'A rubble-pile asteroid sampled by OSIRIS-REx, which returned 120 g of it to Earth in 2023.' },
  { id: 'phaethon', name: 'Phaethon', type: 'asteroid', radius: 2.9, rotationHours: 3.6, color: '#7c8898', source: SB('phaethon'), discovered: '1983, IRAS',
    procedural: { base: '#5c6878', accent: '#2c3848', style: 'rocky', detail: 0.9 },
    description: 'The parent body of the Geminid meteor shower, a "rock comet" that passes closer to the Sun than Mercury.' },
  { id: 'chiron', name: 'Chiron', type: 'asteroid', radius: 108, rotationHours: 5.918, color: '#a8a8b0', source: SB('chiron'), discovered: '1977, Kowal',
    procedural: { base: '#909098', accent: '#484850', style: 'icy', detail: 0.6 },
    description: 'The first centaur discovered, orbiting between Saturn and Uranus and behaving as both asteroid and comet.' },
  { id: 'eris', name: 'Eris', type: 'dwarf', radius: 1163, mass: 1.66e22, rotationHours: 378.4, color: '#e0e0e8', texture: 'textures/2k_eris_fictional.jpg', source: SB('eris'), discovered: '2005, Brown et al.', moons: 1,
    description: 'Slightly smaller than Pluto but more massive, its discovery led to the 2006 redefinition of "planet". Currently near aphelion, three times farther than Pluto.' },
  { id: 'haumea', name: 'Haumea', type: 'dwarf', radius: 780, mass: 4.0e21, rotationHours: 3.9155, color: '#e8e8f0', texture: 'textures/2k_haumea_fictional.jpg', source: SB('haumea'), discovered: '2004', moons: 2,
    description: 'Spins so fast (once every 4 hours) that it is stretched into an egg shape twice as long as it is wide. It has a ring.' },
  { id: 'makemake', name: 'Makemake', type: 'dwarf', radius: 715, mass: 3.1e21, rotationHours: 22.83, color: '#d8b0a0', texture: 'textures/2k_makemake_fictional.jpg', source: SB('makemake'), discovered: '2005', moons: 1,
    description: 'A reddish Kuiper-belt dwarf planet covered in frozen methane, the second-brightest object beyond Neptune after Pluto.' },
  { id: 'sedna', name: 'Sedna', type: 'dwarf', radius: 500, rotationHours: 10.3, color: '#c05030', source: SB('sedna'), discovered: '2003, Brown et al.',
    procedural: { base: '#a84a2c', accent: '#5a2414', style: 'icy', detail: 0.5 },
    description: 'One of the reddest objects known, on an 11,400-year orbit reaching 900 AU. It is now approaching its 2076 perihelion, the closest in millennia.' },
  { id: 'gonggong', name: 'Gonggong', type: 'dwarf', radius: 615, mass: 1.75e21, rotationHours: 22.4, color: '#b86050', source: SB('gonggong'), discovered: '2007', moons: 1,
    procedural: { base: '#9c4c3c', accent: '#4c2418', style: 'icy', detail: 0.5 },
    description: 'A large, red trans-Neptunian dwarf planet in a 3:10 resonance with Neptune, named after a Chinese water god.' },
  { id: 'quaoar', name: 'Quaoar', type: 'dwarf', radius: 555, mass: 1.2e21, rotationHours: 17.68, color: '#a88070', source: SB('quaoar'), discovered: '2002', moons: 1,
    procedural: { base: '#8c6c5c', accent: '#44302a', style: 'icy', detail: 0.5 },
    description: 'A Kuiper-belt dwarf planet with a ring far outside its Roche limit, where a moon should have formed instead.' },
  { id: 'orcus', name: 'Orcus', type: 'dwarf', radius: 458, mass: 6.3e20, rotationHours: 13.19, color: '#a0a0a8', source: SB('orcus'), discovered: '2004', moons: 1,
    procedural: { base: '#8c8c94', accent: '#48484e', style: 'icy', detail: 0.5 },
    description: 'The "anti-Pluto": it shares Pluto\'s 2:3 resonance with Neptune but is always on the opposite side of its orbit.' },
  // --- Comets & interstellar objects -------------------------------------------
  { id: 'halley', name: '1P/Halley', type: 'comet', radius: 5.5, rotationHours: 52.8, color: '#a0d0ff', source: SB('halley'),
    description: 'The most famous comet, returning every 75–76 years. Last seen in 1986, it reached aphelion in December 2023 and is now falling back toward its 2061 perihelion.' },
  { id: 'encke', name: '2P/Encke', type: 'comet', radius: 2.4, color: '#a0d0ff', source: SB('encke'),
    description: 'The comet with the shortest known period, just 3.3 years. Parent of the Taurid meteor showers.' },
  { id: 'churyumov', name: '67P/Churyumov–Gerasimenko', type: 'comet', radius: 2.0, rotationHours: 12.4, color: '#a0d0ff', source: SB('churyumov'),
    description: 'The rubber-duck-shaped comet orbited by ESA\'s Rosetta for two years and visited by the Philae lander in 2014.' },
  { id: 'halebopp', name: 'C/1995 O1 Hale–Bopp', type: 'comet', radius: 30, color: '#a0d0ff', source: SB('halebopp'),
    description: 'The Great Comet of 1997, visible to the naked eye for a record 18 months. Its huge nucleus will not return for over 2,000 years.' },
  { id: 'neowise', name: 'C/2020 F3 NEOWISE', type: 'comet', radius: 2.5, color: '#a0d0ff', source: SB('neowise'),
    description: 'The brightest comet for northern observers since Hale–Bopp, a highlight of July 2020. It will not return for about 6,800 years.' },
  { id: 'swifttuttle', name: '109P/Swift–Tuttle', type: 'comet', radius: 13, color: '#a0d0ff', source: SB('swifttuttle'),
    description: 'Parent of the Perseid meteor shower, a 26-km nucleus on a 133-year orbit. It returns in 2126.' },
  { id: 'templetuttle', name: '55P/Tempel–Tuttle', type: 'comet', radius: 1.8, color: '#a0d0ff', source: SB('templetuttle'),
    description: 'Parent of the Leonid meteor shower, which produces spectacular storms every 33 years when the comet returns. Next perihelion: 2031.' },
  { id: 'tsuchinshan', name: 'C/2023 A3 Tsuchinshan–ATLAS', type: 'comet', radius: 1.5, color: '#a0d0ff', source: SB('tsuchinshan'),
    description: 'The Great Comet of October 2024, which lit up evening skies with a long tail. Its orbit is now slightly hyperbolic: it is leaving the Solar System for good.' },
  { id: 'ponsbrooks', name: '12P/Pons–Brooks', type: 'comet', radius: 17, color: '#a0d0ff', source: SB('ponsbrooks'),
    description: 'The "Devil Comet", known for outbursts that gave it horns during its 2024 return. It comes back every 71 years.' },
  { id: 'oumuamua', name: '1I/ʻOumuamua', type: 'interstellar', radius: 0.1, color: '#ff9fd0', source: SB('oumuamua'), discovered: '2017, Pan-STARRS',
    description: 'The first known interstellar object, a cigar- or pancake-shaped visitor that passed through in 2017 and is now heading out past Neptune, never to return.' },
  { id: 'atlas3i', name: '3I/ATLAS', type: 'interstellar', radius: 1, color: '#ff9fd0', source: SB('atlas3i'), discovered: '2025, ATLAS',
    description: 'The third interstellar object ever found, discovered in July 2025 and the largest yet. It swung past the Sun in October 2025 at 68 km/s and is now leaving the Solar System.' },
  // --- Spacecraft ---------------------------------------------------------------
  { id: 'voyager1', name: 'Voyager 1', type: 'spacecraft', radius: 0.01, color: '#ffffff', source: SC('voyager1'), discovered: 'Launched 5 Sep 1977',
    description: 'The most distant human-made object, over 165 AU from the Sun and in interstellar space since 2012. It carries the Golden Record.' },
  { id: 'voyager2', name: 'Voyager 2', type: 'spacecraft', radius: 0.01, color: '#ffffff', source: SC('voyager2'), discovered: 'Launched 20 Aug 1977',
    description: 'The only spacecraft to have visited Uranus and Neptune. It crossed into interstellar space in November 2018.' },
  { id: 'pioneer10', name: 'Pioneer 10', type: 'spacecraft', radius: 0.01, color: '#ffffff', source: SC('pioneer10'), discovered: 'Launched 3 Mar 1972',
    description: 'The first spacecraft to cross the asteroid belt and fly past Jupiter. Contact was lost in 2003; it drifts toward Aldebaran.' },
  { id: 'pioneer11', name: 'Pioneer 11', type: 'spacecraft', radius: 0.01, color: '#ffffff', source: SC('pioneer11'), discovered: 'Launched 6 Apr 1973',
    description: 'The first spacecraft to fly past Saturn (1979). Its last signal was received in 1995.' },
  { id: 'newhorizons', name: 'New Horizons', type: 'spacecraft', radius: 0.01, color: '#ffffff', source: SC('newhorizons'), discovered: 'Launched 19 Jan 2006',
    description: 'Flew past Pluto in July 2015 and the Kuiper-belt object Arrokoth in 2019. It is still exploring the outer Kuiper belt.' },
  { id: 'jwst', name: 'James Webb Space Telescope', type: 'spacecraft', radius: 0.01, color: '#ffffff', source: SC('jwst'), discovered: 'Launched 25 Dec 2021',
    description: 'The largest space telescope, observing the infrared universe from a halo orbit around the Sun–Earth L2 point, 1.5 million km from Earth.' },
  { id: 'parker', name: 'Parker Solar Probe', type: 'spacecraft', radius: 0.01, color: '#ffffff', source: SC('parker'), discovered: 'Launched 12 Aug 2018',
    description: 'The fastest human-made object, diving through the Sun\'s corona at 690,000 km/h and reaching within 6.1 million km of its surface.' },
  { id: 'europaclipper', name: 'Europa Clipper', type: 'spacecraft', radius: 0.01, color: '#ffffff', source: SC('europaclipper'), discovered: 'Launched 14 Oct 2024',
    description: 'En route to Jupiter (arrival April 2030) to study Europa\'s ice shell and ocean with nearly 50 close flybys.' },
  { id: 'psyche', name: 'Psyche', type: 'spacecraft', radius: 0.01, color: '#ffffff', source: SC('psyche'), discovered: 'Launched 13 Oct 2023',
    description: 'Heading to the metal-rich asteroid 16 Psyche, arriving in 2029, to study what may be the exposed core of a protoplanet.' },
  { id: 'iss', name: 'International Space Station', type: 'spacecraft', parent: 'earth', radius: 0.05, color: '#ffffff', source: { kind: 'tle', key: 'iss' }, discovered: 'First module launched 1998',
    description: 'A football-field-sized laboratory orbiting 400 km up at 28,000 km/h, circling Earth every 90 minutes. Continuously crewed since November 2000.' },
  { id: 'hubble', name: 'Hubble Space Telescope', type: 'spacecraft', parent: 'earth', radius: 0.01, color: '#ffffff', source: { kind: 'tle', key: 'hubble' }, discovered: 'Launched 24 Apr 1990',
    description: 'The telescope that measured the age of the universe and photographed the Pillars of Creation, orbiting 530 km above Earth since 1990.' },
];

/** Everything: Solar System bodies first, then the star catalogue (src/data/stars.ts). */
export const BODIES: BodyDef[] = [...SOLAR_SYSTEM, ...STARS];
export const BODY_MAP: Map<string, BodyDef> = new Map(BODIES.map((b) => [b.id, b]));
export const body = (id: string): BodyDef => {
  const b = BODY_MAP.get(id);
  if (!b) throw new Error('Unknown body ' + id);
  return b;
};
export const childrenOf = (id: string): BodyDef[] => BODIES.filter((b) => b.parent === id);
export const PLANETS = BODIES.filter((b) => b.type === 'planet');

/** Meteor showers: peak month/day (approx.), parent body, typical ZHR. */
export const METEOR_SHOWERS: { name: string; month: number; day: number; zhr: number; parent?: string }[] = [
  { name: 'Quadrantids', month: 1, day: 3, zhr: 110 },
  { name: 'Lyrids', month: 4, day: 22, zhr: 18 },
  { name: 'Eta Aquariids', month: 5, day: 6, zhr: 50, parent: 'halley' },
  { name: 'Perseids', month: 8, day: 12, zhr: 100, parent: 'swifttuttle' },
  { name: 'Orionids', month: 10, day: 21, zhr: 20, parent: 'halley' },
  { name: 'Leonids', month: 11, day: 17, zhr: 15, parent: 'templetuttle' },
  { name: 'Geminids', month: 12, day: 14, zhr: 150, parent: 'phaethon' },
  { name: 'Ursids', month: 12, day: 22, zhr: 10 },
];

/** Notable one-off events that are not computed from ephemerides. */
export const NOTABLE_EVENTS: { date: string; title: string; body?: string; detail: string }[] = [
  { date: '2029-04-13T21:46:00Z', title: 'Apophis closest approach to Earth', body: 'apophis', detail: '31,600 km, visible to the naked eye from Europe and Africa.' },
  { date: '2030-04-11T00:00:00Z', title: 'Europa Clipper arrives at Jupiter', body: 'europaclipper', detail: 'Jupiter orbit insertion begins the Europa flyby campaign.' },
  { date: '2029-08-01T00:00:00Z', title: 'Psyche arrives at asteroid Psyche', body: 'psyche', detail: 'Orbit insertion around the metal-rich asteroid.' },
  { date: '2031-05-20T00:00:00Z', title: '55P/Tempel–Tuttle perihelion', body: 'templetuttle', detail: 'Return of the Leonid parent comet; enhanced Leonid activity expected 2031–2033.' },
  { date: '2061-07-28T00:00:00Z', title: '1P/Halley perihelion', body: 'halley', detail: 'Halley\'s Comet returns to the inner Solar System.' },
  { date: '2076-07-01T00:00:00Z', title: 'Sedna perihelion', body: 'sedna', detail: 'Closest approach to the Sun (76 AU) in ~11,400 years.' },
];
