/**
 * The Milky Way as a model. Nobody has measured the Galaxy's shape directly, so this is a
 * structural model fitted to measurements:
 *
 *  - Spiral arms: log-periodic fits to ~200 maser parallaxes, Reid et al. 2019 (ApJ 885, 131), Table 2,
 *    with R₀ = 8.15 kpc and Θ₀ = 236 km/s. Each arm: ln(R / R_kink) = −(β − β_kink) tan ψ, with a different
 *    pitch angle ψ on either side of the kink; β is Galactocentric azimuth, 0 toward the Sun and increasing
 *    with Galactic longitude (the direction of rotation). Widths are the fitted Gaussian arm widths.
 *  - Disc, bulge and bar: Bland-Hawthorn & Gerhard 2016 (thin disc scale length 2.6 kpc, scale height
 *    0.3 kpc; thick disc 2.0 / 0.9 kpc; bar half-length ~5 kpc at 28° to the Sun–centre line).
 *  - Sun's height above the plane: 20.8 pc (Bennett & Bovy 2019).
 *
 * Schematic regions (heliopause, Oort cloud, Local Bubble, Radcliffe Wave, Gould Belt) and arm labels
 * are catalogue bodies of type 'region' so they can be searched, selected and labelled.
 */
import { DEG, mapply, type Vec3 } from '@/core/math3';
import { AU_KM, EQJ_TO_ECL, GAL_TO_EQJ, KPC_KM, LY_KM, PC_KM } from '@/ephemeris/frames';
import type { BodyDef } from './catalog';

export const R0_KPC = 8.15;
export const THETA0_KMS = 236;
export const SUN_Z_PC = 20.8;
/** Bar orientation from the Sun–centre line, degrees, and half-length, kpc. */
export const BAR_ANGLE_DEG = 28;
export const BAR_HALF_KPC = 5.0;

export interface ArmSpec {
  id: string;
  name: string;
  /** Kink azimuth (deg), radius at the kink (kpc), pitch angles before/after the kink (deg), azimuth range (deg), Gaussian width (kpc). */
  betaKink: number; rKink: number; psiIn: number; psiOut: number; betaMin: number; betaMax: number; width: number;
  color: string;
  /** Relative star-formation weight (young blue stars and H II regions). */
  weight: number;
}

/** Reid et al. 2019, Table 2 (values as published; the 3-kpc arm is the near segment). */
export const ARMS: ArmSpec[] = [
  { id: 'arm-3kpc', name: '3-kpc Arm', betaKink: 15, rKink: 3.52, psiIn: -4.2, psiOut: -4.2, betaMin: 15, betaMax: 18, width: 0.18, color: '#ffd9a0', weight: 0.3 },
  { id: 'arm-norma', name: 'Norma–Outer Arm', betaKink: 18, rKink: 4.46, psiIn: -1.0, psiOut: 19.5, betaMin: 5, betaMax: 54, width: 0.14, color: '#ffd0b0', weight: 0.8 },
  { id: 'arm-scutum', name: 'Scutum–Centaurus Arm', betaKink: 23, rKink: 4.91, psiIn: 14.1, psiOut: 12.1, betaMin: 0, betaMax: 104, width: 0.23, color: '#cfe0ff', weight: 1.2 },
  { id: 'arm-sagittarius', name: 'Sagittarius–Carina Arm', betaKink: 24, rKink: 6.04, psiIn: 17.1, psiOut: 1.0, betaMin: 2, betaMax: 97, width: 0.27, color: '#ffd8e0', weight: 1.0 },
  { id: 'arm-local', name: 'Local (Orion) Arm', betaKink: 9, rKink: 8.26, psiIn: 11.4, psiOut: 11.4, betaMin: -8, betaMax: 34, width: 0.31, color: '#d8e8ff', weight: 0.5 },
  { id: 'arm-perseus', name: 'Perseus Arm', betaKink: 40, rKink: 8.87, psiIn: 10.3, psiOut: 8.7, betaMin: -23, betaMax: 115, width: 0.35, color: '#c8dcff', weight: 1.1 },
  { id: 'arm-outer', name: 'Outer Arm', betaKink: 18, rKink: 12.24, psiIn: 3.0, psiOut: 9.4, betaMin: -16, betaMax: 71, width: 0.65, color: '#b8ccff', weight: 0.5 },
];

/** Galactocentric radius of an arm at azimuth β (deg), kpc. */
export function armRadius(arm: ArmSpec, betaDeg: number): number {
  const psi = (betaDeg < arm.betaKink ? arm.psiIn : arm.psiOut) * DEG;
  return arm.rKink * Math.exp(-(betaDeg - arm.betaKink) * DEG * Math.tan(psi));
}

/**
 * Galactocentric cylindrical (R kpc, β deg, z kpc) → heliocentric ECL km.
 * Sun-centred galactic frame: x̂ toward the centre (l = 0), ŷ toward l = 90°, ẑ toward the north Galactic pole;
 * the centre is at (R₀, 0, −z☉). A point at azimuth β lies at centre + R(−cos β x̂ + sin β ŷ).
 */
export function galactoToEcl(rKpc: number, betaDeg: number, zKpc: number): Vec3 {
  const b = betaDeg * DEG;
  const x = R0_KPC - rKpc * Math.cos(b), y = rKpc * Math.sin(b), z = zKpc - SUN_Z_PC / 1000;
  const eqj = mapply(GAL_TO_EQJ, [x * KPC_KM, y * KPC_KM, z * KPC_KM]);
  return mapply(EQJ_TO_ECL, eqj);
}

export function galacticToEcl(lDeg: number, bDeg: number, distKm: number): Vec3 {
  const l = lDeg * DEG, b = bDeg * DEG;
  const v: Vec3 = [Math.cos(b) * Math.cos(l) * distKm, Math.cos(b) * Math.sin(l) * distKm, Math.sin(b) * distKm];
  return mapply(EQJ_TO_ECL, mapply(GAL_TO_EQJ, v));
}

// --- Schematic regions and arm labels -----------------------------------------------------------
export interface RegionShape { kind: 'shell' | 'ring' | 'ellipsoid' | 'wave' | 'label'; radiusKm?: number; radii?: [number, number, number]; tiltDeg?: number; points?: Vec3[]; opacity?: number }
export interface RegionDef extends BodyDef { shape: RegionShape }

const fixed = (pos: Vec3): BodyDef['source'] => ({ kind: 'fixed', pos });

/** Radcliffe Wave: a ~9,000 ly sinusoidal string of gas clouds (Alves et al. 2020), sketched through its anchors. */
const radcliffe: Vec3[] = [
  galacticToEcl(197, 12, 400 * PC_KM),    // Taurus / Perseus side
  galacticToEcl(174, -5, 320 * PC_KM),
  galacticToEcl(160, -17, 470 * PC_KM),
  galacticToEcl(140, -30, 600 * PC_KM),   // near Orion
  galacticToEcl(120, -25, 800 * PC_KM),
  galacticToEcl(100, 0, 950 * PC_KM),     // Cepheus / Cygnus direction
  galacticToEcl(80, 8, 1200 * PC_KM),
  galacticToEcl(60, 5, 1600 * PC_KM),     // Cygnus X
  galacticToEcl(40, -2, 2200 * PC_KM),
];

export const REGIONS: RegionDef[] = [
  { id: 'heliopause', name: 'Heliopause', type: 'region', radius: 120 * AU_KM, color: '#8fc4ff', source: fixed([0, 0, 0]),
    description: 'The edge of the Sun\'s domain, where the solar wind is stopped by the interstellar medium. Voyager 1 crossed it in 2012 at 122 AU and Voyager 2 in 2018 at 119 AU. Drawn here as a sphere; in reality it is blunt on the upwind side (toward Ophiuchus) and drawn out downstream.',
    facts: [['Distance', '~120 AU (varies with the solar cycle)'], ['Crossed by', 'Voyager 1 (2012), Voyager 2 (2018)']], shape: { kind: 'shell', radiusKm: 120 * AU_KM, opacity: 0.25 } },
  { id: 'oort-cloud', name: 'Oort Cloud', type: 'region', radius: 100000 * AU_KM, color: '#a0b8d8', source: fixed([0, 0, 0]),
    description: 'A vast shell of trillions of icy bodies surrounding the Solar System from about 2,000 to 100,000 AU (1.6 light-years), the source of long-period comets. It has never been observed directly; its extent is inferred from comet orbits. Drawn as a translucent shell.',
    facts: [['Inner edge', '~2,000 AU'], ['Outer edge', '~100,000 AU · 1.6 light-years'], ['Bodies', 'trillions']], shape: { kind: 'shell', radiusKm: 100000 * AU_KM, opacity: 0.12 } },
  { id: 'local-cloud', name: 'Local Interstellar Cloud', type: 'region', radius: 15 * LY_KM, color: '#c0d8ff', source: fixed(galacticToEcl(25, 5, 4 * LY_KM)),
    description: 'The wisp of interstellar gas the Sun is passing through: about 30 light-years across, 0.3 atoms per cubic centimetre, 7,000 K. The Sun entered it within the last 100,000 years and will leave within 20,000.',
    facts: [['Size', '~30 light-years'], ['Density', '0.3 atoms/cm³']], shape: { kind: 'ellipsoid', radii: [15 * LY_KM, 12 * LY_KM, 10 * LY_KM], opacity: 0.18 } },
  { id: 'local-bubble', name: 'Local Bubble', type: 'region', radius: 500 * LY_KM, color: '#9fb8e0', source: fixed(galacticToEcl(0, 0, 0)),
    description: 'A cavity of hot, thin gas about 1,000 light-years across, blown by a dozen supernovae over the last 14 million years. The Sun drifted into it 5 million years ago; nearly all nearby star formation lies on its surface (Zucker et al. 2022). Drawn as a schematic ellipsoid.',
    facts: [['Size', '~1,000 light-years'], ['Age', '~14 million years']], shape: { kind: 'ellipsoid', radii: [400 * LY_KM, 500 * LY_KM, 650 * LY_KM], opacity: 0.1 } },
  { id: 'gould-belt', name: 'Gould Belt', type: 'region', radius: 1000 * LY_KM, color: '#b8c8ff', source: fixed(galacticToEcl(0, 0, 0)),
    description: 'A ring of bright young stars and star-forming clouds about 3,000 light-years across (Orion, Scorpius–Centaurus, Perseus, Taurus), tilted 20° to the Galactic plane, noticed by John Herschel and Benjamin Gould in the 19th century. Recent 3D maps show much of it is the Radcliffe Wave seen in projection.',
    facts: [['Diameter', '~3,000 light-years'], ['Tilt', '~20° to the Galactic plane']], shape: { kind: 'ring', radiusKm: 1000 * LY_KM, tiltDeg: 20, opacity: 0.35 } },
  { id: 'radcliffe-wave', name: 'Radcliffe Wave', type: 'region', radius: 4500 * LY_KM, color: '#ffb0c0', source: fixed(radcliffe[4]),
    description: 'A 9,000-light-year-long wave of star-forming gas discovered in 2020 in Gaia 3D dust maps, undulating 500 light-years above and below the Galactic plane and containing Orion, Taurus, Perseus and Cygnus X. It oscillates on a period of about 30 million years. Sketched through its main anchors.',
    facts: [['Length', '~9,000 light-years'], ['Amplitude', '~500 light-years'], ['Discovered', '2020, Alves et al.']], shape: { kind: 'wave', points: radcliffe, opacity: 0.6 } },
  { id: 'galactic-bar', name: 'Galactic Bar', type: 'region', radius: 5 * KPC_KM, color: '#ffd0a0', source: fixed(galactoToEcl(0, 0, 0)),
    description: 'The bar of old stars at the heart of the Milky Way, about 10,000 light-years long, seen at 28° to our line of sight. Its ends feed the major spiral arms. The Galactic centre and Sagittarius A* sit at its middle.',
    facts: [['Half-length', '~5 kpc'], ['Angle to the Sun–centre line', '~28°']], shape: { kind: 'label' } },
];

/** One label per arm, at its point nearest the Sun–centre line (β = 0) or the middle of its range. */
export function armLabelBodies(): RegionDef[] {
  return ARMS.filter((a) => a.id !== 'arm-3kpc').map((a) => {
    const beta = a.betaMin <= 0 && a.betaMax >= 0 ? 0 : (a.betaMin + a.betaMax) / 2;
    const r = armRadius(a, beta);
    return {
      id: a.id, name: a.name, type: 'region', radius: a.width * KPC_KM, color: a.color, source: fixed(galactoToEcl(r, beta, 0)),
      description: `${a.name}: a spiral arm of the Milky Way traced by high-mass star-forming regions (Reid et al. 2019). Pitch angle ${a.psiIn}° (${a.psiOut}° beyond the kink at β = ${a.betaKink}°), radius ${a.rKink} kpc at the kink, width ${(a.width * 1000).toFixed(0)} pc.`,
      facts: [['Model', 'log-periodic spiral fitted to maser parallaxes'], ['Distance from the Sun at β = 0', `${Math.abs(R0_KPC - armRadius(a, 0)).toFixed(2)} kpc ${armRadius(a, 0) < R0_KPC ? 'toward' : 'away from'} the centre`]],
      shape: { kind: 'label' }, generated: false,
    };
  });
}
