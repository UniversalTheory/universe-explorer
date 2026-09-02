/**
 * IAU Working Group on Cartographic Coordinates and Rotational Elements
 * (Archinal et al. 2009 / 2015) rotation models.
 *
 * For each body: north pole (α0, δ0) in ICRF (≈ EQJ) and prime-meridian
 * angle W, measured along the equator from the node Q of the body's equator
 * on the ICRF equator (Q is at right ascension α0 + 90°).
 *
 *   body-fixed -> ICRF :  Rz(α0 + 90°) · Rx(90° - δ0) · Rz(W)
 *
 * T = Julian centuries, d = days, both from J2000 TT.
 */
import { DEG, mmulAll, rotX, rotZ, wrap360, type Mat3 } from '@/core/math3';

export interface PoleState {
  /** Right ascension of the north pole, deg (ICRF). */
  ra: number;
  /** Declination of the north pole, deg. */
  dec: number;
  /** Prime meridian angle, deg. */
  W: number;
}

type Model = (d: number, T: number) => PoleState;

const s = (deg: number) => Math.sin(deg * DEG);
const c = (deg: number) => Math.cos(deg * DEG);

/** Simple linear model helper. wRate in deg/day. */
const lin = (ra0: number, raT: number, dec0: number, decT: number, w0: number, wRate: number): Model =>
  (d, T) => ({ ra: ra0 + raT * T, dec: dec0 + decT * T, W: w0 + wRate * d });

const MODELS: Record<string, Model> = {
  sun: lin(286.13, 0, 63.87, 0, 84.176, 14.1844),
  mercury: lin(281.0103, -0.0328, 61.4155, -0.0049, 329.5988, 6.1385108),
  venus: lin(272.76, 0, 67.16, 0, 160.20, -1.4813688),
  earth: lin(0.0, -0.641, 90.0, -0.557, 190.147, 360.9856235),
  mars: lin(317.269202, -0.10927547, 54.432516, -0.05827105, 176.049863, 350.891982443297),
  jupiter: lin(268.056595, -0.006499, 64.495303, 0.002413, 284.95, 870.536),
  saturn: lin(40.589, -0.036, 83.537, -0.004, 38.90, 810.7939024),
  uranus: lin(257.311, 0, -15.175, 0, 203.81, -501.1600928),
  neptune: (d, T) => {
    const N = 357.85 + 52.316 * T;
    return { ra: 299.36 + 0.70 * s(N), dec: 43.46 - 0.51 * c(N), W: 249.978 + 541.1397757 * d - 0.48 * s(N) };
  },
  pluto: lin(132.993, 0, -6.163, 0, 302.695, 56.3625225),
  charon: lin(132.993, 0, -6.163, 0, 122.695, 56.3625225),
  ceres: lin(291.418, 0, 66.764, 0, 170.650, 952.1532),
  vesta: lin(309.031, 0, 42.235, 0, 285.39, 1617.3329428),
  pallas: lin(33, 0, -3, 0, 38, 1105.8036),

  moon: (d, T) => {
    const E1 = 125.045 - 0.0529921 * d, E2 = 250.089 - 0.1059842 * d, E3 = 260.008 + 13.0120009 * d;
    const E4 = 176.625 + 13.3407154 * d, E5 = 357.529 + 0.9856003 * d, E6 = 311.589 + 26.4057084 * d;
    const E7 = 134.963 + 13.0649930 * d, E8 = 276.617 + 0.3287146 * d, E9 = 34.226 + 1.7484877 * d;
    const E10 = 15.134 - 0.1589763 * d, E11 = 119.743 + 0.0036096 * d, E12 = 239.961 + 0.1643573 * d;
    const E13 = 25.053 + 12.9590088 * d;
    return {
      ra: 269.9949 + 0.0031 * T - 3.8787 * s(E1) - 0.1204 * s(E2) + 0.0700 * s(E3) - 0.0172 * s(E4)
        + 0.0072 * s(E6) - 0.0052 * s(E10) + 0.0043 * s(E13),
      dec: 66.5392 + 0.0130 * T + 1.5419 * c(E1) + 0.0239 * c(E2) - 0.0278 * c(E3) + 0.0068 * c(E4)
        - 0.0029 * c(E6) + 0.0009 * c(E7) + 0.0008 * c(E10) - 0.0009 * c(E13),
      W: 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.5610 * s(E1) + 0.1208 * s(E2) - 0.0642 * s(E3)
        + 0.0158 * s(E4) + 0.0252 * s(E5) - 0.0066 * s(E6) - 0.0047 * s(E7) - 0.0046 * s(E8) + 0.0028 * s(E9)
        + 0.0052 * s(E10) + 0.0040 * s(E11) + 0.0019 * s(E12) - 0.0044 * s(E13),
    };
  },

  phobos: (d, T) => {
    const M1 = 169.51 - 0.4357640 * d, M2 = 192.93 + 1128.4096700 * d + 8.864 * T * T;
    return {
      ra: 317.68 - 0.108 * T + 1.79 * s(M1),
      dec: 52.90 - 0.061 * T - 1.08 * c(M1),
      W: 35.06 + 1128.8445850 * d + 8.864 * T * T - 1.42 * s(M1) - 0.78 * s(M2),
    };
  },
  deimos: (d, T) => {
    const M3 = 53.47 - 0.0181510 * d;
    return {
      ra: 316.65 - 0.108 * T + 2.98 * s(M3),
      dec: 53.52 - 0.061 * T - 1.78 * c(M3),
      W: 79.41 + 285.1618970 * d - 0.520 * T * T - 2.58 * s(M3) + 0.19 * c(M3),
    };
  },

  io: (d, T) => {
    const J3 = 283.90 + 4850.7 * T, J4 = 355.80 + 1191.3 * T;
    return {
      ra: 268.05 - 0.009 * T + 0.094 * s(J3) + 0.024 * s(J4),
      dec: 64.50 + 0.003 * T + 0.040 * c(J3) + 0.011 * c(J4),
      W: 200.39 + 203.4889538 * d - 0.085 * s(J3) - 0.022 * s(J4),
    };
  },
  europa: (d, T) => {
    const J4 = 355.80 + 1191.3 * T, J5 = 119.90 + 262.1 * T, J6 = 229.80 + 64.3 * T, J7 = 352.25 + 2382.6 * T;
    return {
      ra: 268.08 - 0.009 * T + 1.086 * s(J4) + 0.060 * s(J5) + 0.015 * s(J6) + 0.009 * s(J7),
      dec: 64.51 + 0.003 * T + 0.468 * c(J4) + 0.026 * c(J5) + 0.007 * c(J6) + 0.002 * c(J7),
      W: 36.022 + 101.3747235 * d - 0.980 * s(J4) - 0.054 * s(J5) - 0.014 * s(J6) - 0.008 * s(J7),
    };
  },
  ganymede: (d, T) => {
    const J4 = 355.80 + 1191.3 * T, J5 = 119.90 + 262.1 * T, J6 = 229.80 + 64.3 * T;
    return {
      ra: 268.20 - 0.009 * T - 0.037 * s(J4) + 0.431 * s(J5) + 0.091 * s(J6),
      dec: 64.57 + 0.003 * T - 0.016 * c(J4) + 0.186 * c(J5) + 0.039 * c(J6),
      W: 44.064 + 50.3176081 * d + 0.033 * s(J4) - 0.389 * s(J5) - 0.082 * s(J6),
    };
  },
  callisto: (d, T) => {
    const J5 = 119.90 + 262.1 * T, J6 = 229.80 + 64.3 * T, J8 = 113.35 + 6070.0 * T;
    return {
      ra: 268.72 - 0.009 * T - 0.068 * s(J5) + 0.590 * s(J6) + 0.010 * s(J8),
      dec: 64.83 + 0.003 * T - 0.029 * c(J5) + 0.254 * c(J6) - 0.004 * c(J8),
      W: 259.51 + 21.5710715 * d + 0.061 * s(J5) - 0.533 * s(J6) - 0.009 * s(J8),
    };
  },

  mimas: (d, T) => {
    const S3 = 177.40 - 36505.5 * T, S5 = 316.45 + 506.2 * T;
    return {
      ra: 40.66 - 0.036 * T + 13.56 * s(S3),
      dec: 83.52 - 0.004 * T - 1.53 * c(S3),
      W: 333.46 + 381.9945550 * d - 13.48 * s(S3) - 44.85 * s(S5),
    };
  },
  enceladus: lin(40.66, -0.036, 83.52, -0.004, 6.32, 262.7318996),
  tethys: (d, T) => {
    const S4 = 300.00 - 7225.9 * T, S5 = 316.45 + 506.2 * T;
    return {
      ra: 40.66 - 0.036 * T + 9.66 * s(S4),
      dec: 83.52 - 0.004 * T - 1.09 * c(S4),
      W: 8.95 + 190.6979085 * d - 9.60 * s(S4) + 2.23 * s(S5),
    };
  },
  dione: lin(40.66, -0.036, 83.52, -0.004, 357.6, 131.5349316),
  rhea: (d, T) => {
    const S6 = 345.20 - 1016.3 * T;
    return {
      ra: 40.38 - 0.036 * T + 3.10 * s(S6),
      dec: 83.55 - 0.004 * T - 0.35 * c(S6),
      W: 235.16 + 79.6900478 * d - 3.08 * s(S6),
    };
  },
  titan: lin(39.4827, 0, 83.4279, 0, 186.5855, 22.5769768),
  iapetus: lin(318.16, -3.949, 75.03, -1.143, 355.2, 4.5379572),

  miranda: (d, T) => {
    const U11 = 102.23 - 2024.22 * T, U12 = 316.41 + 2863.14 * T;
    return {
      ra: 257.43 + 4.41 * s(U11) - 0.04 * s(2 * U11),
      dec: -15.08 + 4.25 * c(U11) - 0.02 * c(2 * U11),
      W: 30.70 - 254.6906892 * d - 1.27 * s(U12) + 0.15 * s(2 * U12) + 1.15 * s(U11) - 0.09 * s(2 * U11),
    };
  },
  ariel: (d, T) => {
    const U12 = 316.41 + 2863.14 * T, U13 = 304.01 - 51.94 * T;
    return { ra: 257.43 + 0.29 * s(U13), dec: -15.10 + 0.28 * c(U13), W: 156.22 - 142.8356681 * d + 0.05 * s(U12) + 0.08 * s(U13) };
  },
  umbriel: (d, T) => {
    const U12 = 316.41 + 2863.14 * T, U14 = 308.71 - 93.17 * T;
    return { ra: 257.43 + 0.21 * s(U14), dec: -15.10 + 0.20 * c(U14), W: 108.05 - 86.8688923 * d - 0.09 * s(U12) + 0.06 * s(U14) };
  },
  titania: (d, T) => {
    const U15 = 340.82 - 75.32 * T;
    return { ra: 257.43 + 0.29 * s(U15), dec: -15.10 + 0.28 * c(U15), W: 77.74 - 41.3514316 * d + 0.08 * s(U15) };
  },
  oberon: (d, T) => {
    const U16 = 259.14 - 504.81 * T;
    return { ra: 257.43 + 0.16 * s(U16), dec: -15.10 + 0.16 * c(U16), W: 6.77 - 26.7394932 * d + 0.04 * s(U16) };
  },

  triton: (d, T) => {
    const N7 = 177.85 + 52.316 * T;
    let ra = 299.36, dec = 41.17, W = 296.53 - 61.2572637 * d;
    const ra_k = [-32.35, -6.28, -2.08, -0.74, -0.28, -0.11, -0.07, -0.02, -0.01];
    const dec_k = [22.55, 2.10, 0.55, 0.16, 0.05, 0.02, 0.01];
    const w_k = [22.25, 6.73, 2.05, 0.74, 0.28, 0.11, 0.05, 0.02, 0.01];
    ra_k.forEach((k, i) => (ra += k * s((i + 1) * N7)));
    dec_k.forEach((k, i) => (dec += k * c((i + 1) * N7)));
    w_k.forEach((k, i) => (W += k * s((i + 1) * N7)));
    return { ra, dec, W };
  },
  proteus: (d, T) => {
    const N = 357.85 + 52.316 * T, N6 = 142.61 + 2824.6 * T;
    return { ra: 299.27 + 0.70 * s(N) - 0.05 * s(N6), dec: 42.91 - 0.51 * c(N) - 0.04 * c(N6), W: 93.38 + 320.7654228 * d - 0.48 * s(N) + 0.04 * s(N6) };
  },
};

/** Bodies with no published pole: spin about the ecliptic north pole. */
const ECLIPTIC_POLE = { ra: 270, dec: 90 - 23.4392911 };

/**
 * Rotation state for a body at time tt (days since J2000 TT).
 * @param periodHours fallback sidereal rotation period for bodies without an IAU model.
 */
export function bodyPole(id: string, tt: number, periodHours?: number): PoleState {
  const m = MODELS[id];
  if (m) {
    const p = m(tt, tt / 36525);
    return { ra: p.ra, dec: p.dec, W: wrap360(p.W) };
  }
  const rate = periodHours ? 360 / (periodHours / 24) : 0;
  return { ...ECLIPTIC_POLE, W: wrap360(rate * tt) };
}

export function hasIauModel(id: string): boolean {
  return id in MODELS;
}

/** Matrix from the body's equator-and-node frame (pole = +Z, node Q = +X) to EQJ. */
export function poleFrameToEqj(p: PoleState): Mat3 {
  return mmulAll(rotZ((p.ra + 90) * DEG), rotX((90 - p.dec) * DEG));
}

/** Full body-fixed -> EQJ matrix (includes the prime meridian rotation W). */
export function bodyFixedToEqj(p: PoleState): Mat3 {
  return mmulAll(rotZ((p.ra + 90) * DEG), rotX((90 - p.dec) * DEG), rotZ(p.W * DEG));
}
