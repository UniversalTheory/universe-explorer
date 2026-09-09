/**
 * Deep-sky objects as catalogue bodies: nebulae, supernova remnants, planetary
 * nebulae, dark clouds and star clusters, with hand-written descriptions.
 * Positions/sizes come from public/data/deepsky.json (OpenNGC + curated distances).
 */
import { DeepSkyCatalog, type DsoKind, type DsoRecord } from '@/ephemeris/deepsky';
import type { BodyDef } from './catalog';

interface Note { d: string; facts?: [string, string][]; aliases?: string[] }

export const DSO_NOTES: Record<string, Note> = {
  'orion-nebula': { d: 'The nearest large star-forming region, 1,300 light-years away and visible to the naked eye as the middle "star" of Orion\'s sword. Its gas glows in the ultraviolet of the Trapezium, four hot young stars at its heart, and it holds thousands of newborn stars and protoplanetary discs.', aliases: ['M42', 'NGC 1976'], facts: [['Diameter', '~24 light-years'], ['Age of the Trapezium', '< 1 million years']] },
  'running-man': { d: 'A reflection nebula just north of the Orion Nebula, lit blue by young stars and cut by dark dust lanes that suggest a running figure.', aliases: ['NGC 1977'] },
  'flame-nebula': { d: 'An emission nebula beside Alnitak, the eastern star of Orion\'s Belt, whose ultraviolet light sets its hydrogen glowing behind a thick dark lane of dust.', aliases: ['NGC 2024'] },
  'horsehead': { d: 'The most famous dark nebula: a pillar of cold dust silhouetted against the red glow of IC 434, shaped by radiation from Sigma Orionis. It will erode away over a few million years.', aliases: ['Barnard 33', 'B33'], facts: [['Height', '~3.5 light-years']] },
  'eagle-nebula': { d: 'A young star cluster inside a cloud of gas 7,000 light-years away, home to the Pillars of Creation: columns of cold gas light-years tall in which new stars are condensing.', aliases: ['M16', 'NGC 6611'], facts: [['Pillars of Creation', 'up to 5 light-years tall']] },
  'lagoon-nebula': { d: 'A bright emission nebula in Sagittarius, visible to the naked eye, with a young cluster and a swirling "hourglass" of gas around the massive star Herschel 36.', aliases: ['M8', 'NGC 6523'] },
  'trifid-nebula': { d: 'Three nebulae in one: a red emission region split into three lobes by dark dust lanes, with a blue reflection nebula alongside.', aliases: ['M20', 'NGC 6514'] },
  'omega-nebula': { d: 'One of the brightest and most massive star-forming regions in the Galaxy, 5,500 light-years away, holding as much gas as 800 Suns.', aliases: ['M17', 'Swan Nebula', 'NGC 6618'] },
  'carina-nebula': { d: 'A vast star-forming complex 8,500 light-years away, four times larger than the Orion Nebula, containing Eta Carinae and some of the most massive stars known. JWST\'s "Cosmic Cliffs" image shows one of its edges.', aliases: ['NGC 3372', 'Eta Carinae Nebula'], facts: [['Diameter', '~300 light-years']] },
  'rosette-nebula': { d: 'A ring of glowing gas 130 light-years across, hollowed out by the winds of the young cluster NGC 2244 at its centre.', aliases: ['NGC 2237', 'Caldwell 49'] },
  'north-america': { d: 'A large emission nebula in Cygnus whose outline resembles the continent, glowing red in hydrogen light beside the Pelican Nebula. It is lit by a hidden hot star.', aliases: ['NGC 7000'] },
  'pelican-nebula': { d: 'The Pelican, separated from the North America Nebula by a dark lane of dust, where a front of ionisation is sculpting new stars out of the cloud.', aliases: ['IC 5070'] },
  'heart-nebula': { d: 'A heart-shaped cloud of glowing hydrogen 7,500 light-years away in Cassiopeia, energised by a cluster of hot young stars at its core.', aliases: ['IC 1805'] },
  'soul-nebula': { d: 'The Heart\'s neighbour, a large star-forming region shaped by the winds of its embedded clusters.', aliases: ['IC 1848'] },
  'california-nebula': { d: 'A faint red nebula 2.5° long in Perseus, lit by the runaway star Xi Persei, whose outline recalls the US state.', aliases: ['NGC 1499'] },
  'cone-nebula': { d: 'The Christmas Tree Cluster and the Cone Nebula: a young cluster and a 7-light-year pillar of dust in Monoceros.', aliases: ['NGC 2264', 'Christmas Tree Cluster'] },
  'cats-paw': { d: 'A toe-print of glowing gas in Scorpius, one of the most active nurseries of massive stars nearby.', aliases: ['NGC 6334', 'Bear Claw Nebula'] },
  'lobster-nebula': { d: 'A star-forming region near the Cat\'s Paw containing Pismis 24, a cluster with some of the most massive stars known.', aliases: ['NGC 6357', 'War and Peace Nebula'] },
  'crescent-nebula': { d: 'A bubble blown by the fierce wind of a Wolf–Rayet star, ploughing into gas the star shed earlier.', aliases: ['NGC 6888', 'Caldwell 27'] },
  'bubble-nebula': { d: 'A 7-light-year bubble inflated by the wind of a star 45 times the Sun\'s mass, 7,100 light-years away in Cassiopeia.', aliases: ['NGC 7635', 'Caldwell 11'] },
  'pacman-nebula': { d: 'An emission nebula in Cassiopeia with a dark lane that gives it the shape of the video-game character.', aliases: ['NGC 281'] },
  'elephants-trunk': { d: 'A dark, winding pillar of gas 20 light-years long inside the IC 1396 region, hiding newborn stars.', aliases: ['IC 1396'] },
  'thors-helmet': { d: 'A helmet-shaped bubble 30 light-years across blown by a Wolf–Rayet star nearing the end of its life.', aliases: ['NGC 2359'] },
  'wizard-nebula': { d: 'A star-forming cloud in Cepheus surrounding the young cluster NGC 7380.', aliases: ['NGC 7380'] },
  'cocoon-nebula': { d: 'An emission and reflection nebula at the end of a long dark cloud in Cygnus, cradling a young cluster.', aliases: ['IC 5146'] },
  'tulip-nebula': { d: 'A flower-shaped emission nebula in Cygnus, close on the sky to the black hole Cygnus X-1.', aliases: ['Sh2-101'] },
  'witch-head': { d: 'A faint reflection nebula whose dust scatters the blue light of Rigel, 40 light-years away from it.', aliases: ['IC 2118'] },
  'iris-nebula': { d: 'A bright reflection nebula 1,300 light-years away, dust lit blue by a hot young star.', aliases: ['NGC 7023', 'Caldwell 4'] },
  'pleiades-nebulosity': { d: 'The Seven Sisters, the brightest open cluster in the sky: about a thousand stars 100 million years old, 444 light-years away, passing through a cloud of dust that reflects their blue light.', aliases: ['M45', 'Seven Sisters', 'Pleiades'], facts: [['Age', '~100 million years'], ['Members', '~1,000 stars']] },
  'crab-nebula': { d: 'The remnant of the supernova seen by Chinese astronomers in AD 1054, 6,500 light-years away. At its centre a pulsar spins 30 times a second, powering the nebula\'s eerie blue glow.', aliases: ['M1', 'NGC 1952'], facts: [['Supernova', 'AD 1054'], ['Pulsar spin', '30.2 per second'], ['Expansion', '~1,500 km/s']] },
  'veil-nebula': { d: 'The western arc of the Cygnus Loop, the shredded remains of a star that exploded 10,000–20,000 years ago; the whole loop spans six full Moons.', aliases: ['NGC 6960', 'Witch\'s Broom', 'Cygnus Loop'] },
  'veil-east': { d: 'The eastern arc of the Cygnus Loop supernova remnant, a tangle of glowing filaments 2,400 light-years away.', aliases: ['NGC 6992', 'NGC 6995'] },
  'cassiopeia-a': { d: 'The youngest known supernova remnant in the Galaxy (about 340 years old) and the brightest radio source in the sky beyond the Solar System. A neutron star sits at its centre.', aliases: ['Cas A'], facts: [['Explosion', 'c. 1680'], ['Shell diameter', '~10 light-years']] },
  'vela-snr': { d: 'A remnant 800 light-years away from a supernova about 11,000 years ago, spanning 8° of sky, with the Vela pulsar at its heart.', aliases: ['Gum 16'] },
  'tycho-snr': { d: 'The remnant of the supernova Tycho Brahe watched in 1572, which proved the heavens could change.', aliases: ['SN 1572', '3C 10'] },
  'kepler-snr': { d: 'The remnant of the supernova of 1604, the last seen in the Milky Way with the naked eye, studied by Johannes Kepler.', aliases: ['SN 1604'] },
  'ring-nebula': { d: 'The classic planetary nebula: a barrel of gas expelled by a dying Sun-like star 2,500 light-years away, seen end-on, with a white dwarf at its centre.', aliases: ['M57', 'NGC 6720'], facts: [['Age', '~4,000 years'], ['Diameter', '~1.3 light-years']] },
  'helix-nebula': { d: 'The nearest bright planetary nebula, 655 light-years away, a light-year-wide shell of gas from a dying star that spans half a full Moon in the sky.', aliases: ['NGC 7293', 'Eye of God', 'Caldwell 63'] },
  'dumbbell-nebula': { d: 'The first planetary nebula ever discovered (Messier, 1764), a bright hourglass of gas 1,360 light-years away.', aliases: ['M27', 'NGC 6853'] },
  'cats-eye': { d: 'One of the most complex planetary nebulae, with nested shells and jets; its central star ejected the layers in a series of pulses over the last thousand years.', aliases: ['NGC 6543', 'Caldwell 6'] },
  'eskimo-nebula': { d: 'A planetary nebula whose bright inner disc and fringed outer shell suggest a face in a parka; the central star is 40,000 K.', aliases: ['NGC 2392', 'Clownface Nebula', 'Caldwell 39'] },
  'owl-nebula': { d: 'A round planetary nebula in the Big Dipper with two dark "eyes", 2,000 light-years away.', aliases: ['M97', 'NGC 3587'] },
  'little-dumbbell': { d: 'A faint bipolar planetary nebula in Perseus, the dimmest Messier object.', aliases: ['M76', 'NGC 650'] },
  'saturn-nebula': { d: 'A planetary nebula with ansae that resemble Saturn\'s rings, named by Lord Rosse in the 1840s.', aliases: ['NGC 7009', 'Caldwell 55'] },
  'butterfly-nebula': { d: 'A bipolar planetary nebula whose central star, one of the hottest known at 250,000 K, is hidden in a ring of dust between two wings of gas.', aliases: ['NGC 6302', 'Bug Nebula', 'Caldwell 69'] },
  'blue-snowball': { d: 'A compact, bright blue planetary nebula in Andromeda, easy in small telescopes.', aliases: ['NGC 7662', 'Caldwell 22'] },
  'ghost-of-jupiter': { d: 'A planetary nebula that looks the size of Jupiter in the eyepiece, with an inner eye-shaped shell.', aliases: ['NGC 3242', 'Caldwell 59'] },
  'eight-burst': { d: 'The Southern Ring Nebula, a JWST first-light target: shells of gas from a dying star with a binary companion.', aliases: ['NGC 3132', 'Southern Ring', 'Caldwell 74'] },
  'hourglass-nebula': { d: 'A young planetary nebula whose etched hourglass shape, imaged by Hubble in 1996, hints at a companion star shaping the outflow.', aliases: ['MyCn 18'] },
  'red-spider': { d: 'A two-lobed planetary nebula with waves of gas 100 billion km high, driven by a stellar wind of 1,000 km/s.', aliases: ['NGC 6537'] },
  'coalsack': { d: 'The most prominent dark nebula in the sky, a cloud of dust 600 light-years away blotting out the Milky Way beside the Southern Cross. Aboriginal Australians saw it as the head of the Emu in the sky.', aliases: ['Caldwell 99'] },
  'pipe-nebula': { d: 'A pipe-shaped dark cloud in Ophiuchus, 450 light-years away, part of the Ophiuchus molecular cloud complex.', aliases: ['Barnard 59', 'Barnard 78'] },
  'barnard-68': { d: 'A small, dense dark cloud so opaque it hides every star behind it; a Bok globule on the verge of collapsing into a star.', aliases: ['B68'] },
  'hyades': { d: 'The nearest open cluster, 153 light-years away, forming the V of the Bull\'s face (Aldebaran is a foreground star). Its 625-million-year-old stars were the first cluster with a measured distance.', aliases: ['Caldwell 41', 'Melotte 25'], facts: [['Age', '~625 million years']] },
  'double-cluster': { d: 'h Persei, one half of the Double Cluster: two young open clusters 7,500 light-years away, each with hundreds of blue supergiants, visible to the naked eye.', aliases: ['NGC 869', 'h Persei', 'Caldwell 14'] },
  'chi-persei': { d: 'χ Persei, the other half of the Double Cluster, a few hundred light-years from its twin.', aliases: ['NGC 884', 'Chi Persei'] },
  'jewel-box': { d: 'A young open cluster beside the Southern Cross whose blue and orange stars looked to John Herschel like "a casket of variously coloured precious stones".', aliases: ['NGC 4755', 'Kappa Crucis Cluster', 'Caldwell 94'] },
  'beehive': { d: 'A naked-eye cluster in Cancer known since antiquity, 610 light-years away, of similar age and motion to the Hyades. Galileo resolved it into stars in 1609.', aliases: ['M44', 'Praesepe', 'NGC 2632'] },
  'm67': { d: 'One of the oldest open clusters, about 4 billion years, with many stars very like the Sun; a benchmark for stellar evolution.', aliases: ['NGC 2682'] },
  'wild-duck': { d: 'A rich, compact open cluster of about 2,900 stars in Scutum, one of the densest known.', aliases: ['M11', 'NGC 6705'] },
  'butterfly-cluster': { d: 'An open cluster in Scorpius whose brightest stars trace a butterfly, 1,600 light-years away.', aliases: ['M6', 'NGC 6405'] },
  'ptolemy-cluster': { d: 'A bright naked-eye cluster near the Scorpion\'s sting, recorded by Ptolemy in AD 130.', aliases: ['M7', 'NGC 6475'] },
  'm37': { d: 'The richest of the three Messier clusters in Auriga, with about 500 stars 4,500 light-years away.', aliases: ['NGC 2099'] },
  'westerlund-1': { d: 'A super star cluster 12,000 light-years away, one of the most massive young clusters in the Galaxy, packed with red supergiants, Wolf–Rayet stars and a magnetar. Dust hides it from view.', aliases: ['Ara Cluster'], facts: [['Mass', '~50,000 Suns'], ['Age', '~4 million years']] },
  'ngc-3603': { d: 'A compact cluster of very massive stars inside one of the largest H II regions in the Galaxy, 20,000 light-years away.', aliases: ['NGC 3603'] },
  'coma-cluster': { d: 'A sparse, nearby open cluster of about 40 stars in Coma Berenices, 280 light-years away.', aliases: ['Melotte 111', 'Coma Berenices Cluster'] },
  'southern-pleiades': { d: 'A bright open cluster around Theta Carinae, 480 light-years away, resembling a southern version of the Pleiades.', aliases: ['IC 2602', 'Theta Carinae Cluster', 'Caldwell 102'] },
  'ngc-6231': { d: 'A young cluster of hot blue stars in the tail of Scorpius, the core of the Scorpius OB1 association.', aliases: ['NGC 6231', 'Caldwell 76'] },
  'alpha-persei': { d: 'A loose cluster of young stars around Mirfak, 570 light-years away, spread across several degrees of sky.', aliases: ['Melotte 20', 'Perseus OB3'] },
  'trumpler-14': { d: 'One of the youngest and most massive clusters in the Carina Nebula, only half a million years old.', aliases: ['Tr 14'] },
  'omega-centauri': { d: 'The largest globular cluster in the Galaxy: ten million stars in a ball 150 light-years across, 17,000 light-years away, visible to the naked eye. It may be the stripped core of a dwarf galaxy, and an intermediate-mass black hole lurks at its centre.', aliases: ['NGC 5139', 'Caldwell 80'], facts: [['Stars', '~10 million'], ['Age', '~12 billion years']] },
  '47-tucanae': { d: 'The second-brightest globular cluster, 13,000 light-years away beside the Small Magellanic Cloud, with a dense core and many millisecond pulsars.', aliases: ['NGC 104', '47 Tuc', 'Caldwell 106'] },
  'm13': { d: 'The brightest globular cluster of the northern sky, several hundred thousand stars 22,000 light-years away; the 1974 Arecibo message was beamed toward it.', aliases: ['M13', 'NGC 6205', 'Hercules Cluster'] },
  'm4': { d: 'The closest globular cluster, 7,200 light-years away beside Antares, with a bar of stars across its core.', aliases: ['NGC 6121'] },
  'm22': { d: 'One of the brightest globulars, 10,600 light-years away in Sagittarius, with two black holes detected inside it.', aliases: ['NGC 6656'] },
  'm15': { d: 'A globular cluster with one of the densest cores known, possibly harbouring a black hole, 33,600 light-years away.', aliases: ['NGC 7078'] },
  'm5': { d: 'One of the older globular clusters, about 13 billion years, and among the largest, 24,500 light-years away.', aliases: ['NGC 5904'] },
  'm3': { d: 'A rich globular cluster with hundreds of variable stars, 34,000 light-years away in Canes Venatici.', aliases: ['NGC 5272'] },
  'm92': { d: 'One of the oldest globulars, near the age of the Universe itself, 27,000 light-years away in Hercules.', aliases: ['NGC 6341'] },
  'm2': { d: 'A large, compact globular cluster 37,500 light-years away in Aquarius.', aliases: ['NGC 7089'] },
  'm10': { d: 'A globular cluster in Ophiuchus, 14,300 light-years away, with a loose core.', aliases: ['NGC 6254'] },
  'm12': { d: 'A loose globular cluster near M10, which may have lost most of its low-mass stars to the Galaxy\'s tides.', aliases: ['NGC 6218'] },
  'm80': { d: 'A dense globular cluster in Scorpius, 32,600 light-years away, where a nova erupted in 1860.', aliases: ['NGC 6093'] },
  'm62': { d: 'An irregular, lopsided globular cluster near the Galactic centre, 22,200 light-years away.', aliases: ['NGC 6266'] },
  'ngc-6397': { d: 'One of the two nearest globular clusters, 7,800 light-years away, with a collapsed core and a hidden concentration of stellar-mass black holes.', aliases: ['NGC 6397', 'Caldwell 86'] },
  'ngc-6752': { d: 'The third-brightest globular cluster, 13,000 light-years away in Pavo, with a collapsed core.', aliases: ['NGC 6752', 'Caldwell 93'] },
  'm71': { d: 'A loose globular cluster in Sagitta once thought to be an open cluster.', aliases: ['NGC 6838'] },
  'ngc-2808': { d: 'A massive globular cluster in Carina with at least three generations of stars.', aliases: ['NGC 2808'] },
  'm55': { d: 'A large, loose globular cluster in Sagittarius, 17,600 light-years away.', aliases: ['NGC 6809'] },
  'm54': { d: 'A globular cluster 87,000 light-years away that belongs to the Sagittarius Dwarf galaxy now being absorbed by the Milky Way: the first extragalactic globular known.', aliases: ['NGC 6715'] },
};

const KIND_LABEL: Record<DsoKind, string> = {
  emission: 'Emission nebula', reflection: 'Reflection nebula', planetary: 'Planetary nebula', snr: 'Supernova remnant', dark: 'Dark nebula', open: 'Open cluster', globular: 'Globular cluster',
};
const KIND_COLOR: Record<DsoKind, string> = {
  emission: '#ff7a8a', reflection: '#8fb8ff', planetary: '#7fe0d0', snr: '#ffb070', dark: '#8a7a70', open: '#bcd4ff', globular: '#ffe0a8',
};
export const DSO_KIND_LABEL = KIND_LABEL;

export function buildDeepSkyBodies(cat: DeepSkyCatalog): BodyDef[] {
  return cat.objects.map((o: DsoRecord) => {
    const note = DSO_NOTES[o.id];
    const { a } = DeepSkyCatalog.sizeKm(o);
    const aliases = [...(note?.aliases ?? []), ...o.names.filter((n) => !note?.aliases?.includes(n))];
    return {
      id: o.id, name: o.name, type: o.kind === 'open' || o.kind === 'globular' ? 'cluster' : 'nebula', radius: a, color: KIND_COLOR[o.kind],
      source: { kind: 'fixed', pos: DeepSkyCatalog.position(o) }, description: note?.d ?? `${KIND_LABEL[o.kind]} in ${o.con}, ${o.ly.toLocaleString('en-US')} light-years away.`,
      facts: note?.facts, aliases: aliases.length ? aliases : undefined, generated: !note,
    };
  });
}
