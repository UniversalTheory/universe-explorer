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
/** Heliocentric gravitational parameter, km^3/s^2. */
export const GM_SUN = 1.32712440041279419e11;
