/** Resolve and download licence-checked Commons imagery for the deep-sky list (slow; polite gaps). */
import { fetchDeepSkyImages } from './deepsky';
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
fetchDeepSkyImages(only.length ? only : undefined).then(() => console.log('done')).catch((e) => { console.error(e); process.exit(1); });
