/**
 * Deep-sky objects (nebulae, remnants, clusters) from `public/data/deepsky.json`:
 * a fixed heliocentric position from RA/Dec and a curated distance, plus the
 * angular and physical size. DOM-free.
 */
import { mapply, type Vec3 } from '@/core/math3';
import { EQJ_TO_ECL, LY_KM, raDecToVec } from './frames';

export type DsoKind = 'emission' | 'reflection' | 'planetary' | 'snr' | 'dark' | 'open' | 'globular';

export interface DsoRecord {
  id: string;
  name: string;
  kind: DsoKind;
  ra: number;
  dec: number;
  /** Distance, light-years. */
  ly: number;
  /** Angular size, arcmin (major / minor axis). */
  maj: number;
  min: number;
  /** Position angle of the major axis, degrees east of north. */
  pa: number;
  vmag: number | null;
  con: string;
  ngc: string | null;
  names: string[];
  image: { file: string; credit: string; license: string; source: string; aspect: number } | null;
}

export interface DsoJson { objects: DsoRecord[] }

const ARCMIN = Math.PI / (180 * 60);

export class DeepSkyCatalog {
  readonly objects: DsoRecord[];
  private byId = new Map<string, DsoRecord>();
  constructor(json: DsoJson) {
    this.objects = json.objects;
    for (const o of this.objects) this.byId.set(o.id, o);
  }
  get(id: string): DsoRecord | undefined { return this.byId.get(id); }

  /** Heliocentric ECL position, km. */
  static position(o: DsoRecord): Vec3 {
    const d = o.ly * LY_KM;
    const u = mapply(EQJ_TO_ECL, raDecToVec(o.ra, o.dec));
    return [u[0] * d, u[1] * d, u[2] * d];
  }
  /** Physical semi-axes, km. */
  static sizeKm(o: DsoRecord): { a: number; b: number } {
    const d = o.ly * LY_KM;
    return { a: (o.maj * ARCMIN * d) / 2, b: (o.min * ARCMIN * d) / 2 };
  }
}
