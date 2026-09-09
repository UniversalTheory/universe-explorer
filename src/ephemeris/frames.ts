/**
 * Reference frames.
 *
 *  EQJ  – J2000 mean equator & equinox (≈ ICRF). Used by astronomy-engine,
 *         IAU rotation models and the star catalogue.
 *  ECL  – J2000 ecliptic & equinox. The app's world frame (km, heliocentric).
 *  GAL  – IAU 1958 galactic frame, used to orient the Milky Way skybox.
 *  Three – ECL re-axised so that ecliptic north is +Y: (x, y, z) -> (x, z, -y).
 */
import { DEG, mtranspose, rotX, type Mat3, type Vec3, mapply } from '@/core/math3';

/** IAU 1976 obliquity of the ecliptic at J2000, 84381.448 arcsec. */
export const OBLIQUITY_J2000_DEG = 84381.448 / 3600;
export const OBLIQUITY_J2000 = OBLIQUITY_J2000_DEG * DEG;

export const EQJ_TO_ECL: Mat3 = rotX(-OBLIQUITY_J2000);
export const ECL_TO_EQJ: Mat3 = rotX(OBLIQUITY_J2000);

/** EQJ -> GAL (Hipparcos-era values, Murray 1989 / ESA 1997). */
export const EQJ_TO_GAL: Mat3 = [
  -0.0548755604, -0.8734370902, -0.4838350155,
  0.4941094279, -0.4448296300, 0.7469822445,
  -0.8676661490, -0.1980763734, 0.4559837762,
];
export const GAL_TO_EQJ: Mat3 = mtranspose(EQJ_TO_GAL);

/** ECL -> Three.js axes (Y up = ecliptic north). Its own inverse is its transpose. */
export const ECL_TO_THREE: Mat3 = [1, 0, 0, 0, 0, 1, 0, -1, 0];
export const THREE_TO_ECL: Mat3 = mtranspose(ECL_TO_THREE);

export const eqjToEcl = (v: Vec3) => mapply(EQJ_TO_ECL, v);
export const eclToEqj = (v: Vec3) => mapply(ECL_TO_EQJ, v);
export const eclToThree = (v: Vec3): Vec3 => [v[0], v[2], -v[1]];
export const threeToEcl = (v: Vec3): Vec3 => [v[0], -v[2], v[1]];

/** Unit vector in EQJ from right ascension / declination (degrees). */
export function raDecToVec(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  const c = Math.cos(dec);
  return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
}

export const AU_KM = 149597870.7;
export const C_KM_S = 299792.458;
/** Julian-year light-year and IAU parsec, km. */
export const LY_KM = 9.4607304725808e12;
export const PC_KM = 3.0856775814913673e13;
export const KPC_KM = PC_KM * 1e3;

/**
 * Kilometres per Three.js world unit. The whole Milky Way fits in float32 with
 * km as the unit (positions relative to the floating origin stay < 1e18 km, so
 * squared lengths stay < 1e36 ≪ 3.4e38). This constant is the single hook for
 * the extragalactic phase, where a larger unit will be needed; it is 1 today and
 * radii, camera distances and shader constants still assume 1.
 */
export const WORLD_UNIT_KM = 1;

/** Galactic north pole (b = +90°) as a unit vector in ECL. */
export const GAL_NORTH_ECL: Vec3 = mapply(EQJ_TO_ECL, mapply(GAL_TO_EQJ, [0, 0, 1]));
/** Direction of the Galactic centre (l = 0, b = 0) as a unit vector in ECL. */
export const GAL_CENTRE_ECL: Vec3 = mapply(EQJ_TO_ECL, mapply(GAL_TO_EQJ, [1, 0, 0]));
/** Heliocentric gravitational parameter, km^3/s^2. */
export const GM_SUN = 1.32712440041279419e11;
