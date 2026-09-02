export type EventKind = 'eclipse' | 'moon' | 'season' | 'planet' | 'conjunction' | 'alignment' | 'meteor' | 'apsis' | 'transit' | 'mission';
export interface SkyEvent {
  /** JS epoch ms (UTC). */
  ms: number;
  title: string;
  detail?: string;
  kind: EventKind;
  /** Body to focus when jumping to this event. */
  focus?: string;
  /** Suggested camera distance (km) when jumping. */
  distance?: number;
}
export interface EventsRequest { type: 'compute'; ms: number; horizonDays: number }
export interface EventsResponse { type: 'result'; ms: number; events: SkyEvent[] }
