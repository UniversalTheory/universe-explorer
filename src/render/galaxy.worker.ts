import { generateGalaxy } from './galaxy-gen';

export interface GalaxyRequest { quality: 'high' | 'low'; kpc: number }

self.onmessage = (e: MessageEvent<GalaxyRequest>) => {
  const { pos, col, size, alpha, count } = generateGalaxy(e.data.quality, e.data.kpc);
  (self as unknown as Worker).postMessage({ pos, col, size, alpha, count }, [pos.buffer, col.buffer, size.buffer, alpha.buffer]);
};
