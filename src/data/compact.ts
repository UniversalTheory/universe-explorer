/**
 * Compact objects: black holes, neutron stars / pulsars and white dwarfs, with their
 * companions on measured binary orbits where the orbit is known (Sirius B, Procyon B,
 * Alpha Centauri B, S2 around Sgr A*; X-ray binaries with published period, masses and
 * inclination but unknown node and phase, which are flagged).
 *
 * Positions: HYG rows through `star` keys where the system is a catalogued star,
 * otherwise fixed RA/Dec/distance. Masses and periods from the literature (rounded).
 */
import { binaryElements, schwarzschildKm } from '@/ephemeris/binary';
import { LY_KM, EQJ_TO_ECL, raDecToVec, PC_KM } from '@/ephemeris/frames';
import { mapply } from '@/core/math3';
import { BODY_MAP, type BodyDef, type EphemerisSource } from './catalog';

const R_SUN = 695700, M_SUN = 1.9885e30, AU = 149597870.7;
const fixed = (ra: number, dec: number, ly: number): EphemerisSource => {
  const u = mapply(EQJ_TO_ECL, raDecToVec(ra, dec)), d = ly * LY_KM;
  return { kind: 'fixed', pos: [u[0] * d, u[1] * d, u[2] * d] };
};
/** Semi-major axis (AU) from Kepler's law for a total mass in solar masses and a period in days. */
const keplerAu = (mSun: number, days: number) => Math.cbrt(mSun * (days / 365.25) ** 2);

type Kind = 'blackhole' | 'neutron' | 'whitedwarf';
interface Compact {
  id: string; name: string; kind: Kind; source: EphemerisSource; parent?: string;
  /** Solar masses. */ mass: number; /** km (defaults: Schwarzschild radius / 12 km / from mass). */ radius?: number;
  spin?: number; temperature?: string; desc: string; discovered?: string; aliases?: string[]; facts?: [string, string][];
  /** Companion star orbiting this object (or that it orbits, when `orbitsParent`). */
  companion?: { id: string; name: string; radius: number; mass: number; color: string; spectral?: string; desc: string; per: number; i?: number; e?: number; node?: number; argp?: number; tpYear?: number; phaseKnown?: boolean; aAu?: number };
  accreting?: boolean;
}

const BH: Compact[] = [
  { id: 'sgr-a', name: 'Sagittarius A*', kind: 'blackhole', source: fixed(266.41683, -29.00781, 26673), mass: 4.297e6, accreting: true, discovered: '1974 (radio source), Balick & Brown',
    desc: 'The supermassive black hole at the centre of the Milky Way, 4.3 million solar masses, 26,700 light-years away behind the dust of Sagittarius. Stars whirl around it at thousands of km/s; the star S2 dives to 120 AU of it every 16 years. The Event Horizon Telescope imaged its shadow in 2022.',
    aliases: ['Sgr A*', 'Galactic centre', 'Galactic Center'], facts: [['Event horizon', '~12 million km across'], ['Imaged', '2022, Event Horizon Telescope'], ['Nobel Prize', '2020, Genzel & Ghez']] },
  { id: 'cyg-x1', name: 'Cygnus X-1', kind: 'blackhole', source: { kind: 'star', key: 'cyg-x1' }, mass: 21.2, accreting: true, discovered: '1964 (X-rays); black hole accepted by 1974',
    desc: 'The first black hole confirmed, a 21-solar-mass object 7,200 light-years away feeding on the wind of the blue supergiant HDE 226868, which circles it every 5.6 days. Stephen Hawking bet against it being a black hole and conceded in 1990.',
    aliases: ['Cyg X-1', 'HDE 226868'], facts: [['Orbital period', '5.60 days'], ['Companion', 'HDE 226868, O9.7 Iab supergiant, 41 M☉']],
    companion: { id: 'hde-226868', name: 'HDE 226868', radius: 22 * R_SUN, mass: 40.6, color: '#b8ccff', spectral: 'O9.7 Iab', per: 5.5998, i: 27.5, desc: 'The blue supergiant donor star of Cygnus X-1, 22 times the Sun\'s radius, whose wind feeds the black hole\'s accretion disc.' } },
  { id: 'v404-cyg', name: 'V404 Cygni', kind: 'blackhole', source: fixed(306.0159, 33.8672, 7800), mass: 9.0, accreting: true, discovered: '1989 (X-ray nova, Ginga)',
    desc: 'A 9-solar-mass black hole 7,800 light-years away that erupts every few decades, most recently in 2015, when it briefly became one of the brightest X-ray sources in the sky. Its orange giant companion orbits every 6.5 days.',
    aliases: ['GS 2023+338'], facts: [['Outbursts', '1938, 1956, 1989, 2015'], ['Jet precession', 'wobbles like a top']],
    companion: { id: 'v404-cyg-b', name: 'V404 Cygni donor', radius: 6 * R_SUN, mass: 0.7, color: '#ffc080', spectral: 'K3 III', per: 6.4714, i: 67, desc: 'The evolved orange star losing gas to the black hole in V404 Cygni.' } },
  { id: 'grs-1915', name: 'GRS 1915+105', kind: 'blackhole', source: fixed(288.7983, 10.9456, 28000), mass: 12.4, accreting: true, discovered: '1992, Granat',
    desc: 'The first Galactic "microquasar": a 12-solar-mass black hole 28,000 light-years away whose jets appear to move faster than light, and whose X-ray flickering has been erratic for three decades.',
    facts: [['Orbital period', '33.85 days'], ['Jets', 'apparent superluminal motion']],
    companion: { id: 'grs-1915-b', name: 'GRS 1915+105 donor', radius: 20 * R_SUN, mass: 0.5, color: '#ffb070', spectral: 'K–M III', per: 33.85, i: 60, desc: 'The red giant donor of GRS 1915+105.' } },
  { id: 'a0620', name: 'A0620-00', kind: 'blackhole', source: fixed(95.6856, -0.3458, 5100), mass: 6.6, accreting: false, discovered: '1975 (X-ray nova, Ariel 5)',
    desc: 'One of the nearest black holes known, 5,100 light-years away in Monoceros: a 6.6-solar-mass object with a small orange dwarf whipping around it every 7.75 hours.',
    aliases: ['V616 Monocerotis'], facts: [['Orbital period', '7.75 hours']],
    companion: { id: 'a0620-b', name: 'V616 Mon donor', radius: 0.7 * R_SUN, mass: 0.4, color: '#ffcf90', spectral: 'K5 V', per: 0.3230, i: 51, desc: 'The orange dwarf companion of A0620-00.' } },
  { id: 'xte-j1118', name: 'XTE J1118+480', kind: 'blackhole', source: fixed(169.545, 48.0378, 5700), mass: 7.5, accreting: false, discovered: '2000, RXTE',
    desc: 'A black hole high above the Galactic plane, 5,700 light-years away in Ursa Major, on an orbit that suggests it was kicked out of the disc when it formed. Its companion orbits in just 4.1 hours.',
    facts: [['Orbital period', '4.08 hours'], ['Galactic latitude', '+62°']],
    companion: { id: 'xte-j1118-b', name: 'XTE J1118+480 donor', radius: 0.5 * R_SUN, mass: 0.2, color: '#ffb878', spectral: 'K7 V', per: 0.1699, i: 68, desc: 'The small red dwarf companion of XTE J1118+480.' } },
  { id: 'gro-j1655', name: 'GRO J1655-40', kind: 'blackhole', source: fixed(253.5006, -39.8458, 10500), mass: 5.4, accreting: true, discovered: '1994, Compton GRO',
    desc: 'A microquasar 10,500 light-years away whose black hole spins near the maximum allowed, with a subgiant companion in a 2.6-day orbit and jets seen at 92% of the speed of light.',
    aliases: ['Nova Scorpii 1994'], facts: [['Orbital period', '2.62 days']],
    companion: { id: 'gro-j1655-b', name: 'GRO J1655-40 donor', radius: 1.7 * R_SUN, mass: 1.45, color: '#fff4dc', spectral: 'F6 IV', per: 2.622, i: 70, desc: 'The F-type subgiant feeding GRO J1655-40.' } },
  { id: 'maxi-j1820', name: 'MAXI J1820+070', kind: 'blackhole', source: fixed(275.0913, 7.1854, 9600), mass: 8.5, accreting: true, discovered: '2018, MAXI',
    desc: 'A black hole 9,600 light-years away whose 2018 outburst was bright enough for amateur telescopes, letting astronomers watch the accretion disc\'s inner edge in real time.',
    facts: [['Orbital period', '16.5 hours'], ['Outburst', '2018']],
    companion: { id: 'maxi-j1820-b', name: 'MAXI J1820+070 donor', radius: 0.7 * R_SUN, mass: 0.4, color: '#ffc890', spectral: 'K', per: 0.6853, i: 75, desc: 'The orange dwarf donor of MAXI J1820+070.' } },
  { id: 'v4641-sgr', name: 'V4641 Sagittarii', kind: 'blackhole', source: fixed(274.804, -25.4074, 20000), mass: 6.4, accreting: true, discovered: '1999',
    desc: 'A black hole with a B-type companion 20,000 light-years away that produced the fastest jets ever seen in the Galaxy during a 1999 outburst.',
    facts: [['Orbital period', '2.82 days']],
    companion: { id: 'v4641-sgr-b', name: 'V4641 Sgr donor', radius: 3 * R_SUN, mass: 2.9, color: '#d8e4ff', spectral: 'B9 III', per: 2.817, i: 72, desc: 'The blue-white companion of V4641 Sgr.' } },
  { id: 'gaia-bh1', name: 'Gaia BH1', kind: 'blackhole', source: fixed(262.1715, -0.5811, 1560), mass: 9.6, accreting: false, discovered: '2022, Gaia astrometry',
    desc: 'The nearest known black hole, 1,560 light-years away in Ophiuchus, found by the wobble it induces in a Sun-like star that orbits it every 186 days at about the Earth–Sun distance. It is dormant: no accretion, no X-rays.',
    facts: [['Orbital period', '185.6 days'], ['Companion', 'G-type star, 0.93 M☉']],
    companion: { id: 'gaia-bh1-b', name: 'Gaia BH1 companion', radius: 1.0 * R_SUN, mass: 0.93, color: '#fff2c8', spectral: 'G', per: 185.6, e: 0.45, i: 127, phaseKnown: false, desc: 'The Sun-like star whose 186-day wobble revealed Gaia BH1.' } },
  { id: 'gaia-bh2', name: 'Gaia BH2', kind: 'blackhole', source: fixed(207.564, -59.24, 3800), mass: 8.9, accreting: false, discovered: '2023, Gaia astrometry',
    desc: 'A dormant black hole 3,800 light-years away orbited every 3.5 years by a red giant, the second found from Gaia\'s astrometry.',
    facts: [['Orbital period', '1,277 days']],
    companion: { id: 'gaia-bh2-b', name: 'Gaia BH2 companion', radius: 7.9 * R_SUN, mass: 1.07, color: '#ffc888', spectral: 'K giant', per: 1277, e: 0.52, i: 35, phaseKnown: false, desc: 'The red giant orbiting Gaia BH2.' } },
  { id: 'gaia-bh3', name: 'Gaia BH3', kind: 'blackhole', source: fixed(294.8278, 14.9308, 1926), mass: 32.7, accreting: false, discovered: '2024, Gaia astrometry',
    desc: 'The most massive stellar black hole in the Galaxy, 33 solar masses, 1,900 light-years away in Aquila, orbited every 11.6 years by an ancient metal-poor giant from a disrupted star stream.',
    facts: [['Orbital period', '11.6 years'], ['Companion', 'very metal-poor giant']],
    companion: { id: 'gaia-bh3-b', name: 'Gaia BH3 companion', radius: 5 * R_SUN, mass: 0.76, color: '#ffd8a0', spectral: 'G giant', per: 4195, e: 0.73, i: 122, phaseKnown: false, desc: 'The old halo giant orbiting Gaia BH3.' } },
  { id: 'ss-433', name: 'SS 433', kind: 'blackhole', source: fixed(287.9565, 4.9827, 18000), mass: 4.3, accreting: true, discovered: '1978 (emission-line star), Stephenson & Sanduleak',
    desc: 'A microquasar 18,000 light-years away shooting two jets at 26% of the speed of light, which precess every 162 days like a lawn sprinkler, carving the surrounding Manatee Nebula. The compact object is probably a black hole.',
    facts: [['Orbital period', '13.08 days'], ['Jet speed', '0.26 c'], ['Jet precession', '162 days']],
    companion: { id: 'ss-433-b', name: 'SS 433 donor', radius: 30 * R_SUN, mass: 12, color: '#e0e8ff', spectral: 'A supergiant', per: 13.08, i: 79, desc: 'The A-type supergiant overflowing onto SS 433\'s compact object.' } },
  { id: 'cyg-x3', name: 'Cygnus X-3', kind: 'blackhole', source: fixed(308.1075, 40.9578, 24000), mass: 2.4, accreting: true, discovered: '1966 (X-rays)',
    desc: 'A Wolf–Rayet star and a compact object (probably a black hole) in a 4.8-hour orbit 24,000 light-years away, hidden behind the Galactic plane and famous for giant radio flares.',
    aliases: ['Cyg X-3'], facts: [['Orbital period', '4.8 hours']],
    companion: { id: 'cyg-x3-b', name: 'Cygnus X-3 Wolf–Rayet star', radius: 2 * R_SUN, mass: 10, color: '#b0c8ff', spectral: 'WN', per: 0.1997, i: 30, desc: 'The helium-rich Wolf–Rayet donor of Cygnus X-3.' } },
  { id: '4u-1543', name: '4U 1543-47', kind: 'blackhole', source: fixed(236.788, -47.6675, 24000), mass: 9.4, accreting: true, discovered: '1971, Uhuru',
    desc: 'A black hole with an A-type companion 24,000 light-years away in Lupus, seen nearly face-on, that flares every decade or so.',
    companion: { id: '4u-1543-b', name: '4U 1543-47 donor', radius: 2.5 * R_SUN, mass: 2.7, color: '#f0f4ff', spectral: 'A2 V', per: 1.123, i: 21, desc: 'The A-type companion of 4U 1543-47.' } },
];

const NS: Compact[] = [
  { id: 'crab-pulsar', name: 'Crab Pulsar', kind: 'neutron', source: fixed(83.633, 22.0145, 6500), mass: 1.4, spin: 0.0334, discovered: '1968',
    desc: 'The neutron star left by the supernova of 1054, spinning 30 times a second at the heart of the Crab Nebula and powering it with a wind of electrons and positrons. It is 20 km across with more mass than the Sun.',
    aliases: ['PSR B0531+21'], facts: [['Spin period', '33.4 ms'], ['Slowing down', '38 ns per day']] },
  { id: 'vela-pulsar', name: 'Vela Pulsar', kind: 'neutron', source: fixed(128.8361, -45.1764, 960), mass: 1.4, spin: 0.0893, discovered: '1968',
    desc: 'The pulsar at the heart of the Vela supernova remnant, 960 light-years away, spinning 11 times a second and the brightest persistent gamma-ray source in the sky. It occasionally "glitches", suddenly spinning faster.',
    aliases: ['PSR B0833-45'], facts: [['Spin period', '89 ms'], ['Age', '~11,000 years']] },
  { id: 'psr-b1919', name: 'PSR B1919+21', kind: 'neutron', source: fixed(290.0925, 21.8836, 3300), mass: 1.4, spin: 1.3373, discovered: '1967, Jocelyn Bell Burnell',
    desc: 'The first pulsar discovered, in 1967 by Jocelyn Bell Burnell: a neutron star 3,300 light-years away ticking every 1.337 seconds, so regular it was nicknamed LGM-1 for "little green men".',
    aliases: ['CP 1919', 'LGM-1'], facts: [['Spin period', '1.3373 s']] },
  { id: 'geminga', name: 'Geminga', kind: 'neutron', source: fixed(98.4757, 17.7703, 815), mass: 1.4, spin: 0.237, discovered: '1972 (gamma rays)',
    desc: 'A neutron star 815 light-years away that is bright in gamma rays yet nearly silent in radio, once one of the great unidentified sources of the sky. Its supernova may have blown the Local Bubble.',
    facts: [['Spin period', '237 ms']] },
  { id: 'psr-j0437', name: 'PSR J0437-4715', kind: 'neutron', source: fixed(69.3163, -47.2525, 510), mass: 1.44, spin: 0.005757, discovered: '1993',
    desc: 'The nearest and brightest millisecond pulsar, 510 light-years away, spinning 174 times a second after being spun up by its white dwarf companion. Its timing is stable to a hundred nanoseconds, a cornerstone of pulsar timing arrays.',
    facts: [['Spin period', '5.757 ms'], ['Orbital period', '5.74 days']],
    companion: { id: 'psr-j0437-b', name: 'PSR J0437-4715 white dwarf', radius: 0.02 * R_SUN, mass: 0.22, color: '#e8f0ff', spectral: 'DA', per: 5.741, i: 137.5, desc: 'The helium white dwarf that spun the pulsar up.' } },
  { id: 'psr-b1913', name: 'Hulse–Taylor Binary', kind: 'neutron', source: fixed(288.867, 16.107, 21000), mass: 1.44, spin: 0.059, discovered: '1974, Hulse & Taylor',
    desc: 'The first binary pulsar, two neutron stars 21,000 light-years away orbiting each other every 7.75 hours. The orbit shrinks exactly as general relativity predicts from gravitational-wave emission, which won the 1993 Nobel Prize.',
    aliases: ['PSR B1913+16'], facts: [['Orbital period', '7.75 hours'], ['Orbital decay', '3.5 m per year'], ['Merger', 'in ~300 million years']],
    companion: { id: 'psr-b1913-b', name: 'PSR B1913+16 companion', radius: 12, mass: 1.39, color: '#cfe0ff', per: 0.323, e: 0.617, i: 47, phaseKnown: false, desc: 'The second neutron star of the Hulse–Taylor binary.' } },
  { id: 'psr-j0737', name: 'Double Pulsar', kind: 'neutron', source: fixed(114.4635, -30.6612, 3500), mass: 1.34, spin: 0.0227, discovered: '2003',
    desc: 'The only known system where both neutron stars are seen as pulsars, 3,500 light-years away, orbiting every 2.45 hours nearly edge-on. It is the most stringent test of general relativity in strong gravity.',
    aliases: ['PSR J0737-3039'], facts: [['Orbital period', '2.45 hours'], ['Inclination', '88.7° (eclipsing)']],
    companion: { id: 'psr-j0737-b', name: 'PSR J0737-3039B', radius: 12, mass: 1.25, color: '#cfe0ff', per: 0.1023, e: 0.088, i: 88.7, phaseKnown: false, desc: 'The slower pulsar (2.77 s) of the double pulsar.' } },
  { id: 'sgr-1806', name: 'SGR 1806-20', kind: 'neutron', source: fixed(272.1638, -20.4113, 28000), mass: 1.4, spin: 7.56, discovered: '1979',
    desc: 'A magnetar 28,000 light-years away with a magnetic field a thousand trillion times Earth\'s. Its giant flare of 27 December 2004 was the brightest event ever recorded from outside the Solar System, disturbing Earth\'s ionosphere.',
    facts: [['Spin period', '7.56 s'], ['Magnetic field', '~10¹⁵ gauss'], ['Giant flare', '27 Dec 2004']] },
  { id: 'rx-j1856', name: 'RX J1856.5-3754', kind: 'neutron', source: fixed(284.1467, -37.9042, 400), mass: 1.4, spin: 7.06, discovered: '1996, ROSAT',
    desc: 'The nearest known neutron star, 400 light-years away, one of the "Magnificent Seven" isolated neutron stars glowing softly in X-rays from their own heat.',
    facts: [['Spin period', '7.06 s'], ['Surface temperature', '~700,000 K']] },
  { id: 'sco-x1', name: 'Scorpius X-1', kind: 'neutron', source: fixed(244.9794, -15.6403, 9000), mass: 1.4, discovered: '1962, rocket flight (Giacconi)',
    desc: 'The brightest persistent X-ray source in the sky and the first found beyond the Solar System (1962): a neutron star 9,000 light-years away devouring a small companion that orbits it every 19 hours.',
    aliases: ['Sco X-1', 'V818 Scorpii'], facts: [['Orbital period', '18.9 hours']],
    companion: { id: 'sco-x1-b', name: 'Scorpius X-1 donor', radius: 0.8 * R_SUN, mass: 0.42, color: '#ffd090', per: 0.787, i: 44, desc: 'The low-mass donor star of Scorpius X-1.' } },
  { id: 'her-x1', name: 'Hercules X-1', kind: 'neutron', source: fixed(254.4575, 35.3423, 21000), mass: 1.5, spin: 1.24, discovered: '1971, Uhuru',
    desc: 'An X-ray pulsar 21,000 light-years away spinning every 1.24 seconds, eclipsed every 1.7 days by its companion HZ Herculis, with a 35-day cycle from a precessing, warped accretion disc.',
    aliases: ['Her X-1', 'HZ Herculis'], facts: [['Spin period', '1.24 s'], ['Orbital period', '1.70 days']],
    companion: { id: 'her-x1-b', name: 'HZ Herculis', radius: 4 * R_SUN, mass: 2.2, color: '#f4f6ff', spectral: 'A/F', per: 1.70, i: 85, desc: 'The companion whose X-ray-heated face makes HZ Herculis vary.' } },
];

const WD: Compact[] = [
  { id: 'sirius-b', name: 'Sirius B', kind: 'whitedwarf', source: { kind: 'binary', el: binaryElements({ years: 50.1284, arcsec: 7.4957, distPc: 2.6371, e: 0.59142, i: 136.336, node: 45.4, argp: 149.161, tpYear: 1994.5715 }), phaseKnown: true }, parent: 'sirius',
    mass: 1.018, radius: 0.0084 * R_SUN, temperature: '25,000 K surface', discovered: '1862, Alvan Clark',
    desc: 'The Pup: a white dwarf the size of Earth with the mass of the Sun, orbiting Sirius every 50 years. Once the more massive star of the pair, it burned out 120 million years ago; a teaspoon of it weighs tons.',
    aliases: ['The Pup'], facts: [['Orbital period', '50.1 years'], ['Density', '~2 tonnes per cm³'], ['Next periastron', '2044']] },
  { id: 'procyon-b', name: 'Procyon B', kind: 'whitedwarf', source: { kind: 'binary', el: binaryElements({ years: 40.838, arcsec: 4.30, distPc: 3.51, e: 0.40, i: 31.9, node: 97.3, argp: 92.2, tpYear: 1967.97 }), phaseKnown: true }, parent: 'procyon',
    mass: 0.60, radius: 0.0123 * R_SUN, temperature: '7,740 K surface', discovered: '1896, Schaeberle (predicted 1844 by Bessel)',
    desc: 'A faint white dwarf orbiting Procyon every 41 years, predicted by Bessel from Procyon\'s wobble in 1844 and only seen half a century later with the Lick 36-inch refractor.',
    facts: [['Orbital period', '40.8 years']] },
  { id: '40-eri-b', name: '40 Eridani B', kind: 'whitedwarf', source: { kind: 'binary', el: binaryElements({ years: 7900, au: 400, e: 0.0, i: 60, node: 0, argp: 0, tpYear: 2000 }), phaseKnown: false }, parent: 'keid',
    mass: 0.573, radius: 0.014 * R_SUN, temperature: '16,500 K surface', discovered: '1783, William Herschel; identified as a white dwarf 1910',
    desc: 'The first white dwarf identified (1910), and the easiest to see in a small telescope, 16 light-years away in the 40 Eridani triple system. Its wide orbit around 40 Eridani A takes about 8,000 years.',
    aliases: ['Keid B', 'Omicron2 Eridani B'], facts: [['Orbit', '~400 AU from 40 Eri A, ~8,000 years (approximate)']] },
  { id: 'stein-2051-b', name: 'Stein 2051 B', kind: 'whitedwarf', source: { kind: 'binary', el: binaryElements({ years: 420, au: 55, e: 0.0, i: 60, node: 0, argp: 0, tpYear: 2000 }), phaseKnown: false }, parent: 'stein2051',
    mass: 0.675, radius: 0.0114 * R_SUN, temperature: '7,120 K surface',
    desc: 'A white dwarf 18 light-years away whose mass was measured in 2017 by watching it bend the light of a background star, the first such gravitational-lensing measurement of a star outside the Solar System.',
    facts: [['Mass measured by lensing', '2017, Hubble']] },
];

/** Alpha Centauri B goes on a measured 79.9-year orbit around A (it was a free HYG row before). */
function bindAlphaCenB() {
  const b = BODY_MAP.get('alpha-cen-b');
  if (!b) return;
  b.parent = 'alpha-cen-a';
  b.source = { kind: 'binary', el: binaryElements({ years: 79.91, arcsec: 17.57, distPc: 1.3248, e: 0.5179, i: 79.205, node: 204.85, argp: 231.65, tpYear: 1955.57 }), phaseKnown: true };
  b.orbitDays = 79.91 * 365.25;
  (b.facts ??= []).push(['Next periastron', '2035, at 11.2 AU from A']);
}

/** S2, the star that dives closest to Sagittarius A*. */
const S2: BodyDef = {
  id: 's2', name: 'S2', type: 'star', parent: 'sgr-a', radius: 5 * R_SUN, mass: 14 * M_SUN, color: '#c8d8ff', spectral: 'B0–2 V', luminosity: 1e4,
  source: { kind: 'binary', el: binaryElements({ years: 16.046, arcsec: 0.12497, distPc: 8178, e: 0.88466, i: 134.567, node: 228.171, argp: 66.263, tpYear: 2018.379 }), phaseKnown: true },
  orbitDays: 16.046 * 365.25, aliases: ['S0-2'], discovered: '1990s, Genzel & Ghez groups',
  description: 'The star that proved Sagittarius A* is a black hole: a young B-type star that plunges to 120 AU of it every 16 years, reaching 7,650 km/s at periastron (May 2018). GRAVITY measured its gravitational redshift and the precession of its orbit, both as Einstein predicted.',
  facts: [['Orbital period', '16.05 years'], ['Periastron', '120 AU · 7,650 km/s, May 2018 and 2034'], ['Orbit precession', '12′ per orbit (Schwarzschild)']],
};

function toDef(c: Compact): BodyDef[] {
  const radius = c.radius ?? (c.kind === 'blackhole' ? schwarzschildKm(c.mass) : c.kind === 'neutron' ? 12 : 0.012 * R_SUN);
  const out: BodyDef[] = [{
    id: c.id, name: c.name, type: c.kind === 'blackhole' ? 'blackhole' : c.kind === 'neutron' ? 'neutron' : 'star', parent: c.parent, radius, mass: c.mass * M_SUN,
    color: c.kind === 'blackhole' ? '#ff9a4a' : c.kind === 'neutron' ? '#cfe0ff' : '#e8f0ff', source: c.source, description: c.desc, discovered: c.discovered, aliases: c.aliases,
    facts: c.facts?.filter(([k]) => !(((c.companion || c.source.kind === 'binary') && k === 'Orbital period') || (c.spin && k === 'Spin period'))), compact: c.kind, spinSeconds: c.spin, accreting: c.accreting, temperature: c.temperature, spectral: c.kind === 'whitedwarf' ? 'white dwarf' : undefined,
    orbitDays: c.source.kind === 'binary' ? c.source.el.per : undefined,
  }];
  if (c.companion) {
    const k = c.companion;
    const aAu = k.aAu ?? keplerAu(c.mass + k.mass, k.per);
    out.push({
      id: k.id, name: k.name, type: 'star', parent: c.id, radius: k.radius, mass: k.mass * M_SUN, color: k.color, spectral: k.spectral, orbitDays: k.per,
      source: { kind: 'binary', el: binaryElements({ years: k.per / 365.25, au: aAu, e: k.e ?? 0, i: k.i ?? 60, node: k.node ?? 0, argp: k.argp ?? 0, tpYear: k.tpYear ?? 2000 }), phaseKnown: k.phaseKnown ?? false },
      description: k.desc, facts: [['Orbit', `${aAu < 0.1 ? `${(aAu * AU / 1e6).toFixed(1)} million km` : `${aAu.toFixed(2)} AU`} from the compact object (from Kepler's law); node and phase not measured`]],
    });
  }
  return out;
}

/**
 * PSR B1257+12 arrives as an ordinary exoplanet host; it is a millisecond pulsar. The exoplanet
 * catalogue loads after boot, so this runs again once those bodies are registered.
 */
export function retypeExoplanetHosts() {
  const psr = BODY_MAP.get('x-psr-b1257-12');
  if (psr) { psr.type = 'neutron'; psr.compact = 'neutron'; psr.spinSeconds = 0.00622; psr.radius = 12; psr.color = '#cfe0ff'; }
}

/** Mutations on bodies registered earlier (curated stars, exoplanet hosts) plus the new compact bodies. */
export function buildCompactBodies(): BodyDef[] {
  bindAlphaCenB();
  retypeExoplanetHosts();
  const defs: BodyDef[] = [];
  for (const c of [...BH, ...NS, ...WD]) defs.push(...toDef(c));
  defs.push(S2);
  return defs;
}

export const COMPACT_KIND_LABEL: Record<string, string> = { blackhole: 'Black hole', neutron: 'Neutron star', whitedwarf: 'White dwarf' };
export const PC = PC_KM;
