/** astronomy-engine wrappers returning heliocentric / parent-relative ECL states in km, km/s. */
import { Body, HelioState, GeoMoonState, JupiterMoons, type AstroTime, type StateVector } from 'astronomy-engine';
import { mapply, type Vec3 } from '@/core/math3';
import { AU_KM, EQJ_TO_ECL } from './frames';
import type { OrbitState } from './kepler';

const AU_DAY_TO_KM_S = AU_KM / 86400;

function toEcl(sv: StateVector): OrbitState {
  const p: Vec3 = [sv.x * AU_KM, sv.y * AU_KM, sv.z * AU_KM];
  const v: Vec3 = [sv.vx * AU_DAY_TO_KM_S, sv.vy * AU_DAY_TO_KM_S, sv.vz * AU_DAY_TO_KM_S];
  return { pos: mapply(EQJ_TO_ECL, p), vel: mapply(EQJ_TO_ECL, v) };
}

const AE_BODY: Record<string, Body> = {
  Mercury: Body.Mercury, Venus: Body.Venus, Earth: Body.Earth, Mars: Body.Mars, Jupiter: Body.Jupiter,
  Saturn: Body.Saturn, Uranus: Body.Uranus, Neptune: Body.Neptune, Pluto: Body.Pluto, Moon: Body.Moon, Sun: Body.Sun,
};

/** Heliocentric state of a major body. */
export function planetState(aeBody: string, time: AstroTime): OrbitState {
  return toEcl(HelioState(AE_BODY[aeBody], time));
}
/** Geocentric state of the Moon. */
export function moonGeoState(time: AstroTime): OrbitState {
  return toEcl(GeoMoonState(time));
}
/** Jovicentric states of Io, Europa, Ganymede, Callisto. */
export function galileanStates(time: AstroTime): OrbitState[] {
  const j = JupiterMoons(time);
  return [j.io, j.europa, j.ganymede, j.callisto].map(toEcl);
}

/** Gravitational parameters, km^3/s^2 (for osculating orbit drawing). */
export const GM: Record<string, number> = {
  sun: 1.32712440041279419e11, mercury: 2.2031868551e4, venus: 3.24858592e5, earth: 3.986004418e5, moon: 4.9028e3,
  mars: 4.282837362e4, jupiter: 1.26686534e8, saturn: 3.7931187e7, uranus: 5.793939e6, neptune: 6.836529e6, pluto: 8.71e2,
};
