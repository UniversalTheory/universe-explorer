/** Shape of public/data/ephemeris.json produced by scripts/build-data.ts. */
export interface FittedMoonElements {
  parent: string;
  /** Parent GM, km^3/s^2. */
  gm: number;
  /** Epoch JD (TDB). */
  epoch: number;
  a: number; e: number; i: number;
  Omega0: number; OmegaDot: number;
  varpi0: number; varpiDot: number;
  L0: number; n: number;
  /** Quadratic mean-longitude term, deg/day² (captures resonance libration over the fit span). */
  nDot: number;
  /** Laplace-frame axes (x, y, z rows) expressed in the parent's body-equator frame. */
  frame: number[];
  samples: number;
  test: { jd: number; pos: number[]; vel: number[] }[];
}
export interface SmallBodyRecord {
  fullname: string; kind: string; orbitClass?: string;
  epoch: number; q: number; e: number; i: number; Omega: number; omega: number; tp: number; a?: number; period?: number;
  phys: { diameter?: number; rotPeriod?: number; albedo?: number; H?: number; GM?: number; density?: number };
  firstObs?: string; moid?: number;
}
export interface SpacecraftIndex { file: string; count: number; start: number; end: number }
export interface EphemerisData {
  generated: string;
  moons: Record<string, FittedMoonElements>;
  smallBodies: Record<string, SmallBodyRecord>;
  spacecraft: Record<string, SpacecraftIndex>;
  stars: {
    file: string; count: number; stride: number;
    /** [index, name] for stars with a proper name (or Bayer letter when bright). */
    names: [number, string][];
    /** Catalogue key (src/data/stars.ts) -> index. */
    keys: Record<string, number>;
    /** On-demand deep tier (AT-HYG stars not in HYG). */
    deep?: { file: string; count: number };
  };
  tle: { fetched: string } & Record<string, string[]>;
}
