/**
 * Deep-sky objects inside the Milky Way: nebulae, supernova remnants, planetary
 * nebulae, dark clouds, open and globular clusters.
 *
 *  - Positions, angular sizes, position angles, magnitudes, constellations: OpenNGC (CC BY-SA 4.0).
 *  - Distances: curated below (OpenNGC has none); light-years from the literature, rounded.
 *  - Imagery: Wikimedia Commons, chosen per object and licence-checked through the Commons API
 *    (only CC BY / CC BY-SA / public domain / CC0 files are accepted; credit and licence are
 *    recorded in deepsky.json and shown in the app).
 *
 * Used by build-data.ts (`--only=deepsky`, metadata only) and by `npm run data:deepsky-images`
 * (slow: one Commons API call + one download per object, with polite gaps).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export type DsoKind = 'emission' | 'reflection' | 'planetary' | 'snr' | 'dark' | 'open' | 'globular';

export interface DsoSpec {
  id: string;
  /** OpenNGC name (NGC1976 / IC0434 / addendum name), or inline coordinates. */
  ngc?: string;
  inline?: { ra: number; dec: number; maj: number; min?: number; vmag?: number; con?: string };
  name: string;
  kind: DsoKind;
  /** Distance, light-years. */
  ly: number;
  /** Commons search query (defaults to the name) or an explicit file name (starts with "File:"). */
  image?: string;
  /** Skip imagery (clusters are drawn as point clouds). */
  noImage?: boolean;
}

const L = (id: string, ngc: string | undefined, name: string, kind: DsoKind, ly: number, image?: string, inline?: DsoSpec['inline']): DsoSpec => ({ id, ngc, name, kind, ly, image, inline, noImage: kind === 'open' || kind === 'globular' || (kind === 'dark' && !image) });

export const DEEP_SKY: DsoSpec[] = [
  // --- Emission / H II regions ------------------------------------------------------------
  L('orion-nebula', 'NGC1976', 'Orion Nebula', 'emission', 1344, 'File:Orion Nebula - Hubble 2006 mosaic 18000.jpg'),
  L('running-man', 'NGC1977', 'Running Man Nebula', 'reflection', 1500, 'NGC 1977 Running Man Nebula'),
  L('flame-nebula', 'NGC2024', 'Flame Nebula', 'emission', 1350, 'NGC 2024 Flame Nebula'),
  L('horsehead', 'B033', 'Horsehead Nebula', 'dark', 1375, 'Horsehead Nebula Barnard 33'),
  L('eagle-nebula', 'NGC6611', 'Eagle Nebula', 'emission', 7000, 'File:Eagle Nebula from ESO.jpg'),
  L('lagoon-nebula', 'NGC6523', 'Lagoon Nebula', 'emission', 4100, 'Lagoon Nebula M8'),
  L('trifid-nebula', 'NGC6514', 'Trifid Nebula', 'emission', 4100, 'Trifid Nebula'),
  L('omega-nebula', 'NGC6618', 'Omega Nebula', 'emission', 5500, 'Omega Nebula M17'),
  L('carina-nebula', 'NGC3372', 'Carina Nebula', 'emission', 8500, 'File:Carina Nebula by ESO.jpg'),
  L('rosette-nebula', 'NGC2237', 'Rosette Nebula', 'emission', 5200, 'Rosette Nebula'),
  L('north-america', 'NGC7000', 'North America Nebula', 'emission', 2600, 'North America Nebula'),
  L('pelican-nebula', 'IC5070', 'Pelican Nebula', 'emission', 1800, 'Pelican Nebula'),
  L('heart-nebula', 'IC1805', 'Heart Nebula', 'emission', 7500, 'IC 1805 Heart Nebula'),
  L('soul-nebula', 'IC1848', 'Soul Nebula', 'emission', 7500, 'IC 1848 Soul Nebula'),
  L('california-nebula', 'NGC1499', 'California Nebula', 'emission', 1000, 'NGC 1499 California Nebula'),
  L('cone-nebula', 'NGC2264', 'Cone Nebula & Christmas Tree Cluster', 'emission', 2500, 'NGC 2264 Cone Nebula ESO'),
  L('cats-paw', 'NGC6334', "Cat's Paw Nebula", 'emission', 5500, "Cat's Paw Nebula"),
  L('lobster-nebula', 'NGC6357', 'Lobster Nebula', 'emission', 8000, 'NGC 6357 Lobster Nebula'),
  L('crescent-nebula', 'NGC6888', 'Crescent Nebula', 'emission', 5000, 'Crescent Nebula'),
  L('bubble-nebula', 'NGC7635', 'Bubble Nebula', 'emission', 7100, 'NGC 7635 Bubble Nebula Hubble'),
  L('pacman-nebula', 'NGC0281', 'Pacman Nebula', 'emission', 9500, 'NGC 281 Pacman Nebula'),
  L('elephants-trunk', 'IC1396', "Elephant's Trunk Nebula", 'emission', 2400, 'IC 1396 Elephant\'s Trunk Nebula'),
  L('thors-helmet', 'NGC2359', "Thor's Helmet", 'emission', 12000, "NGC 2359 Thor's Helmet Nebula"),
  L('wizard-nebula', 'NGC7380', 'Wizard Nebula', 'emission', 7200, 'Wizard Nebula NGC 7380'),
  L('cocoon-nebula', 'IC5146', 'Cocoon Nebula', 'emission', 2500, 'Cocoon Nebula IC 5146'),
  L('tulip-nebula', undefined, 'Tulip Nebula', 'emission', 6000, 'Sh2-101 Tulip Nebula', { ra: 300.0, dec: 35.28, maj: 16, con: 'Cyg' }),
  // --- Reflection ---------------------------------------------------------------------------
  L('witch-head', 'IC2118', 'Witch Head Nebula', 'reflection', 900, 'Witch Head Nebula'),
  L('iris-nebula', 'NGC7023', 'Iris Nebula', 'reflection', 1300, 'Iris Nebula NGC 7023'),
  L('pleiades-nebulosity', 'Mel022', 'Pleiades', 'open', 444, undefined),
  // --- Supernova remnants ----------------------------------------------------------------------
  L('crab-nebula', 'NGC1952', 'Crab Nebula', 'snr', 6500, 'File:Crab Nebula.jpg'),
  L('veil-nebula', 'NGC6960', 'Veil Nebula (western)', 'snr', 2400, 'NGC 6960 Witch\'s Broom Veil Nebula'),
  L('veil-east', 'NGC6992', 'Veil Nebula (eastern)', 'snr', 2400, 'NGC 6992 Eastern Veil Nebula'),
  L('cassiopeia-a', undefined, 'Cassiopeia A', 'snr', 11000, 'Cassiopeia A supernova remnant', { ra: 350.85, dec: 58.815, maj: 5, vmag: undefined, con: 'Cas' }),
  L('vela-snr', undefined, 'Vela Supernova Remnant', 'snr', 800, 'Vela Supernova Remnant', { ra: 128.5, dec: -45.83, maj: 480, con: 'Vel' }),
  L('tycho-snr', undefined, "Tycho's Supernova Remnant", 'snr', 8000, 'Tycho supernova remnant SN 1572', { ra: 6.34, dec: 64.13, maj: 8, con: 'Cas' }),
  L('kepler-snr', undefined, "Kepler's Supernova Remnant", 'snr', 20000, 'Kepler supernova remnant SN 1604 Chandra Hubble Spitzer', { ra: 262.67, dec: -21.49, maj: 4, con: 'Oph' }),
  // --- Planetary nebulae -----------------------------------------------------------------------
  L('ring-nebula', 'NGC6720', 'Ring Nebula', 'planetary', 2570, 'M57 Ring Nebula Hubble'),
  L('helix-nebula', 'NGC7293', 'Helix Nebula', 'planetary', 655, 'Helix Nebula NGC 7293'),
  L('dumbbell-nebula', 'NGC6853', 'Dumbbell Nebula', 'planetary', 1360, 'Dumbbell Nebula M27'),
  L('cats-eye', 'NGC6543', "Cat's Eye Nebula", 'planetary', 3300, "Cat's Eye Nebula NGC 6543"),
  L('eskimo-nebula', 'NGC2392', 'Eskimo Nebula', 'planetary', 6500, 'NGC 2392 Eskimo Nebula Hubble'),
  L('owl-nebula', 'NGC3587', 'Owl Nebula', 'planetary', 2000, 'M97 Owl Nebula'),
  L('little-dumbbell', 'NGC0650', 'Little Dumbbell Nebula', 'planetary', 2500, 'Little Dumbbell Nebula M76'),
  L('saturn-nebula', 'NGC7009', 'Saturn Nebula', 'planetary', 5200, 'NGC 7009 Saturn Nebula Hubble'),
  L('butterfly-nebula', 'NGC6302', 'Butterfly Nebula', 'planetary', 3400, 'NGC 6302 Butterfly Nebula Hubble'),
  L('blue-snowball', 'NGC7662', 'Blue Snowball Nebula', 'planetary', 5600, 'NGC 7662 Blue Snowball'),
  L('ghost-of-jupiter', 'NGC3242', 'Ghost of Jupiter', 'planetary', 4800, 'NGC 3242 Ghost of Jupiter'),
  L('eight-burst', 'NGC3132', 'Southern Ring Nebula', 'planetary', 2000, 'NGC 3132 Southern Ring Nebula'),
  L('hourglass-nebula', undefined, 'Engraved Hourglass Nebula', 'planetary', 8000, 'MyCn 18 Hourglass Nebula', { ra: 200.85, dec: -67.38, maj: 0.5, con: 'Mus' }),
  L('red-spider', 'NGC6537', 'Red Spider Nebula', 'planetary', 3000, 'Red Spider Nebula NGC 6537'),
  // --- Dark nebulae ---------------------------------------------------------------------------
  L('coalsack', undefined, 'Coalsack', 'dark', 600, undefined, { ra: 192.5, dec: -62.5, maj: 420, min: 300, con: 'Cru' }),
  L('pipe-nebula', undefined, 'Pipe Nebula', 'dark', 450, undefined, { ra: 259.8, dec: -25.5, maj: 420, min: 90, con: 'Oph' }),
  L('barnard-68', undefined, 'Barnard 68', 'dark', 500, 'File:Barnard 68.jpg', { ra: 260.66, dec: -23.83, maj: 4, con: 'Oph' }),
  // --- Open clusters (drawn as point clouds) ---------------------------------------------------
  L('hyades', undefined, 'Hyades', 'open', 153, undefined, { ra: 66.75, dec: 15.87, maj: 330, vmag: 0.5, con: 'Tau' }),
  L('double-cluster', 'NGC0869', 'Double Cluster (h Persei)', 'open', 7500),
  L('chi-persei', 'NGC0884', 'Double Cluster (χ Persei)', 'open', 7500),
  L('jewel-box', 'NGC4755', 'Jewel Box Cluster', 'open', 6400),
  L('beehive', 'NGC2632', 'Beehive Cluster', 'open', 610),
  L('m67', 'NGC2682', 'M67', 'open', 2700),
  L('wild-duck', 'NGC6705', 'Wild Duck Cluster', 'open', 6100),
  L('butterfly-cluster', 'NGC6405', 'Butterfly Cluster', 'open', 1600),
  L('ptolemy-cluster', 'NGC6475', "Ptolemy's Cluster", 'open', 980),
  L('m37', 'NGC2099', 'M37', 'open', 4500),
  L('westerlund-1', undefined, 'Westerlund 1', 'open', 12000, undefined, { ra: 251.77, dec: -45.85, maj: 3, con: 'Ara' }),
  L('ngc-3603', 'NGC3603', 'NGC 3603', 'open', 20000),
  L('coma-cluster', 'Mel111', 'Coma Star Cluster', 'open', 280),
  L('southern-pleiades', 'IC2602', 'Southern Pleiades', 'open', 480),
  L('ngc-6231', 'NGC6231', 'NGC 6231', 'open', 5600),
  L('alpha-persei', undefined, 'Alpha Persei Cluster', 'open', 570, undefined, { ra: 51.5, dec: 49.0, maj: 185, con: 'Per' }),
  L('trumpler-14', undefined, 'Trumpler 14', 'open', 8500, undefined, { ra: 160.97, dec: -59.55, maj: 5, con: 'Car' }),
  // --- Globular clusters -------------------------------------------------------------------------
  L('omega-centauri', 'NGC5139', 'Omega Centauri', 'globular', 17000),
  L('47-tucanae', 'NGC0104', '47 Tucanae', 'globular', 13000),
  L('m13', 'NGC6205', 'Great Hercules Cluster (M13)', 'globular', 22200),
  L('m4', 'NGC6121', 'M4', 'globular', 7200),
  L('m22', 'NGC6656', 'M22', 'globular', 10600),
  L('m15', 'NGC7078', 'M15', 'globular', 33600),
  L('m5', 'NGC5904', 'M5', 'globular', 24500),
  L('m3', 'NGC5272', 'M3', 'globular', 33900),
  L('m92', 'NGC6341', 'M92', 'globular', 26700),
  L('m2', 'NGC7089', 'M2', 'globular', 37500),
  L('m10', 'NGC6254', 'M10', 'globular', 14300),
  L('m12', 'NGC6218', 'M12', 'globular', 15700),
  L('m80', 'NGC6093', 'M80', 'globular', 32600),
  L('m62', 'NGC6266', 'M62', 'globular', 22200),
  L('ngc-6397', 'NGC6397', 'NGC 6397', 'globular', 7800),
  L('ngc-6752', 'NGC6752', 'NGC 6752', 'globular', 13000),
  L('m71', 'NGC6838', 'M71', 'globular', 13000),
  L('ngc-2808', 'NGC2808', 'NGC 2808', 'globular', 31000),
  L('m55', 'NGC6809', 'M55', 'globular', 17600),
  L('m54', 'NGC6715', 'M54', 'globular', 87400),
];

// ---------------------------------------------------------------------------------------------
const OPENNGC_URL = 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv';
const OPENNGC_ADDENDUM_URL = 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/addendum.csv';
const UA = 'UniverseExplorer/0.1 (https://github.com/UniversalTheory/universe-explorer; data pipeline)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cached(url: string, file: string): Promise<string> {
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  const t = await r.text();
  mkdirSync('node_modules/.cache', { recursive: true });
  writeFileSync(file, t);
  return t;
}

interface NgcRow { ra: number; dec: number; maj: number; min: number; pa: number; vmag: number; con: string; names: string; type: string }

async function loadOpenNgc(): Promise<Map<string, NgcRow>> {
  const text = (await cached(OPENNGC_URL, 'node_modules/.cache/NGC.csv')) + '\n' + (await cached(OPENNGC_ADDENDUM_URL, 'node_modules/.cache/NGC_addendum.csv'));
  const out = new Map<string, NgcRow>();
  const sex = (s: string, hours: boolean) => {
    if (!s) return NaN;
    const sign = s.trim().startsWith('-') ? -1 : 1;
    const [a, b, c] = s.replace(/^[+-]/, '').split(':').map(Number);
    const v = a + (b || 0) / 60 + (c || 0) / 3600;
    return sign * (hours ? v * 15 : v);
  };
  for (const line of text.split('\n')) {
    const f = line.split(';');
    if (f.length < 24 || f[0] === 'Name') continue;
    out.set(f[0], { type: f[1], ra: sex(f[2], true), dec: sex(f[3], false), con: f[4], maj: +f[5] || NaN, min: +f[6] || NaN, pa: +f[7] || NaN, vmag: +f[9] || NaN, names: f[28] ?? '' });
  }
  return out;
}

export interface ImageMeta { file: string; url: string; credit: string; license: string; width: number; height: number }
const IMG_CACHE = 'node_modules/.cache/deepsky-images.json';
const OK_LICENSES = /^(CC BY(-SA)? [234]\.0|CC BY(-SA)? 3\.0 IGO|CC0|Public domain)/i;
const BAD_NAME = /map|chart|diagram|finder|sketch|drawing|annotat|label|comparison|animation|compass|wide[- ]field|mosaic|panel|around the|region of the sky|hdr|logo|flickr|crop of|montage|collage|side by side|\.gif$|\.svg$|\.tif/i;

/** Pick a Commons file for an object through the API (search or explicit file), verifying the licence. */
async function findImage(spec: DsoSpec): Promise<ImageMeta | null> {
  const explicit = spec.image?.startsWith('File:');
  const params = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: '1024' });
  if (explicit) params.set('titles', spec.image!);
  else { params.set('generator', 'search'); params.set('gsrnamespace', '6'); params.set('gsrlimit', '25'); params.set('gsrsearch', `${spec.image ?? spec.name} filetype:bitmap`); }
  const r = await fetch('https://commons.wikimedia.org/w/api.php?' + params, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Commons API ${r.status}`);
  const j = (await r.json()) as { query?: { pages?: Record<string, { title: string; imageinfo?: { url: string; thumburl?: string; width: number; height: number; mime: string; extmetadata?: Record<string, { value: string }> }[] }> } };
  const pages = Object.values(j.query?.pages ?? {});
  const cands: (ImageMeta & { score: number })[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !ii.extmetadata) continue;
    const lic = ii.extmetadata.LicenseShortName?.value ?? '';
    if (!OK_LICENSES.test(lic)) continue;
    if (!/jpeg|png/.test(ii.mime) || ii.width < 900) continue;
    if (BAD_NAME.test(p.title)) continue;
    const artist = (ii.extmetadata.Artist?.value ?? ii.extmetadata.Credit?.value ?? '').replace(/<[^>]+>/g, '').trim();
    let score = Math.min(ii.width, 6000) / 1000;
    if (/ESO|NASA|ESA|Hubble|JPL|Spitzer|Chandra|Webb|NOIRLab|NOAO/i.test(artist + p.title)) score += 4;
    if (/Hubble|ESO/i.test(p.title)) score += 1;
    // The title should name the object (common name, or its NGC / IC / Messier number).
    const nums = [spec.ngc?.replace(/^(NGC|IC)0*/, '$1 ') ?? '', ...(spec.name.match(/M\d+/g) ?? [])].filter(Boolean);
    const named = p.title.toLowerCase().includes(spec.name.toLowerCase().replace(/ nebula.*| cluster.*/, '')) || nums.some((n) => p.title.toUpperCase().includes(n.toUpperCase()));
    score += named ? 3 : -3;
    if (/x-ray|radio|infrared|ultraviolet|spitzer|chandra|wise/i.test(p.title)) score -= 1.5;   // prefer visible-light pictures
    cands.push({ file: p.title, url: ii.thumburl ?? ii.url, credit: artist.slice(0, 160), license: lic, width: ii.width, height: ii.height, score });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands[0] ?? null;
}

/** Slow path: resolve and download an image for every object that wants one. */
export async function fetchDeepSkyImages(only?: string[]) {
  const meta: Record<string, ImageMeta | null> = existsSync(IMG_CACHE) ? JSON.parse(readFileSync(IMG_CACHE, 'utf8')) : {};
  mkdirSync('public/textures/deepsky', { recursive: true });
  for (const spec of DEEP_SKY) {
    if (spec.noImage || (only && !only.includes(spec.id))) continue;
    const out = `public/textures/deepsky/${spec.id}.jpg`;
    if (meta[spec.id] && existsSync(out)) continue;
    try {
      const m = meta[spec.id] ?? (await findImage(spec));
      meta[spec.id] = m;
      writeFileSync(IMG_CACHE, JSON.stringify(meta, null, 1));
      if (!m) { console.log(`  ${spec.id}: no suitable image`); await sleep(4000); continue; }
      const r = await fetch(m.url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`download ${r.status}`);
      writeFileSync(out, Buffer.from(await r.arrayBuffer()));
      console.log(`  ${spec.id}: ${m.file} (${m.license}; ${m.credit})`);
    } catch (e) {
      console.warn(`  ${spec.id}: ${(e as Error).message}`);
    }
    await sleep(16000);   // Commons rate limits aggressively
  }
}

/** Metadata for public/data/deepsky.json (no network beyond the cached OpenNGC files). */
export async function buildDeepSky() {
  const ngc = await loadOpenNgc();
  const images: Record<string, ImageMeta | null> = existsSync(IMG_CACHE) ? JSON.parse(readFileSync(IMG_CACHE, 'utf8')) : {};
  const objects = [];
  for (const s of DEEP_SKY) {
    const row = s.ngc ? ngc.get(s.ngc) : undefined;
    if (s.ngc && !row) { console.warn(`  deepsky: ${s.ngc} not in OpenNGC`); }
    const ra = row?.ra ?? s.inline?.ra, dec = row?.dec ?? s.inline?.dec;
    if (ra === undefined || dec === undefined || isNaN(ra)) { console.warn(`  deepsky: ${s.id} has no position`); continue; }
    const maj = (row && isFinite(row.maj) ? row.maj : s.inline?.maj) ?? 5;
    const min = (row && isFinite(row.min) ? row.min : s.inline?.min) ?? maj;
    const img = !s.noImage && images[s.id] && existsSync(`public/textures/deepsky/${s.id}.jpg`) ? images[s.id] : null;
    objects.push({
      id: s.id, name: s.name, kind: s.kind, ra, dec, ly: s.ly, maj, min, pa: row && isFinite(row.pa) ? row.pa : 0,
      vmag: row && isFinite(row.vmag) ? row.vmag : s.inline?.vmag ?? null, con: row?.con ?? s.inline?.con ?? '', ngc: s.ngc ?? null,
      names: row?.names ? row.names.split(',').map((x) => x.trim()).filter((x) => x && x !== s.name) : [],
      image: img ? { file: `textures/deepsky/${s.id}.jpg`, credit: img.credit, license: img.license, source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(img.file.replace(/ /g, '_'))}`, aspect: img.width / img.height } : null,
    });
  }
  writeFileSync('public/data/deepsky.json', JSON.stringify({ objects }));
  console.log(`deepsky: ${objects.length} objects, ${objects.filter((o) => o.image).length} with images`);
  return { file: 'deepsky.json', count: objects.length };
}
