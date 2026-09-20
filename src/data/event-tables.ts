/**
 * Static event tables: meteor showers and notable one-off dates.
 *
 * Kept apart from `catalog.ts` because the events Web Worker needs only these two
 * tables; importing the body catalogue would drag the star and exoplanet
 * catalogues into the worker bundle.
 */
/** Meteor showers: peak month/day (approx.), parent body, typical ZHR. */
export const METEOR_SHOWERS: { name: string; month: number; day: number; zhr: number; parent?: string }[] = [
  { name: 'Quadrantids', month: 1, day: 3, zhr: 110 },
  { name: 'Lyrids', month: 4, day: 22, zhr: 18 },
  { name: 'Eta Aquariids', month: 5, day: 6, zhr: 50, parent: 'halley' },
  { name: 'Perseids', month: 8, day: 12, zhr: 100, parent: 'swifttuttle' },
  { name: 'Orionids', month: 10, day: 21, zhr: 20, parent: 'halley' },
  { name: 'Leonids', month: 11, day: 17, zhr: 15, parent: 'templetuttle' },
  { name: 'Geminids', month: 12, day: 14, zhr: 150, parent: 'phaethon' },
  { name: 'Ursids', month: 12, day: 22, zhr: 10 },
];

/** Notable one-off events that are not computed from ephemerides. */
export const NOTABLE_EVENTS: { date: string; title: string; body?: string; detail: string }[] = [
  { date: '2029-04-13T21:46:00Z', title: 'Apophis closest approach to Earth', body: 'apophis', detail: '31,600 km, visible to the naked eye from Europe and Africa.' },
  { date: '2030-04-11T00:00:00Z', title: 'Europa Clipper arrives at Jupiter', body: 'europaclipper', detail: 'Jupiter orbit insertion begins the Europa flyby campaign.' },
  { date: '2029-08-01T00:00:00Z', title: 'Psyche arrives at asteroid Psyche', body: 'psyche', detail: 'Orbit insertion around the metal-rich asteroid.' },
  { date: '2031-05-20T00:00:00Z', title: '55P/Tempel–Tuttle perihelion', body: 'templetuttle', detail: 'Return of the Leonid parent comet; enhanced Leonid activity expected 2031–2033.' },
  { date: '2061-07-28T00:00:00Z', title: '1P/Halley perihelion', body: 'halley', detail: 'Halley\'s Comet returns to the inner Solar System.' },
  { date: '2076-07-01T00:00:00Z', title: 'Sedna perihelion', body: 'sedna', detail: 'Closest approach to the Sun (76 AU) in ~11,400 years.' },
];
