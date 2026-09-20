// Dev helper: measure what boot actually costs, so the Stage G performance work has numbers.
// Reports time to `window.app`, the cost of generating the galaxy model and the star cloud,
// and the size/parse cost of the on-demand data files.
// usage: node scripts/dev/boot-profile.mjs [--url=http://localhost:5173/]
//
// JS timings are meaningful under SwiftShader (only GL is emulated); frame rates are not.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const args = process.argv.slice(2);
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=').slice(1).join('=');
const CANDIDATES = [process.env.SNAP_BROWSER, '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].filter(Boolean);
const executablePath = CANDIDATES.find((p) => existsSync(p));
if (!executablePath) { console.error('No Chromium-based browser found; set SNAP_BROWSER=/path/to/binary'); process.exit(1); }
const browser = await chromium.launch({ executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

// Long tasks (>50 ms of blocked main thread) are the metric that matters for boot: wall-clock time
// under SwiftShader is dominated by GL setup and drowns everything else out.
await page.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] });
});
const t0 = Date.now();
await page.goto(opt('url') || 'http://localhost:5173/', { waitUntil: 'load' });
// `<div id="app">` shadows window.app until main.ts assigns the real one, so wait for a member.
await page.waitForFunction('!!window.app?.universe', null, { timeout: 90000 });
const bootMs = Date.now() - t0;
const long = await page.evaluate(() => window.__long.slice());
console.log('long tasks during boot (ms):', long.join(' ') || 'none', '| total blocked:', long.reduce((a, b) => a + b, 0));

const r = await page.evaluate(async () => {
  const out = {};
  const timed = (fn) => { const t = performance.now(); const v = fn(); return [+(performance.now() - t).toFixed(1), v]; };
  // Generation now runs in a worker; time the pure function to see what the boot thread was spared.
  const { generateGalaxy } = await import('/src/render/galaxy-gen.ts');
  let g;
  [out.galaxyGenHigh_ms, g] = timed(() => generateGalaxy('high', 1e-9 * 3.0857e16));
  out.galaxyGenPoints = g.count;
  [out.galaxyGenLow_ms] = timed(() => generateGalaxy('low', 1e-9 * 3.0857e16));
  out.galaxyPointsLive = app.universe.galaxy.count;
  const StarCloud = app.universe.starCloud.constructor;
  [out.starCloudBuild_ms] = timed(() => new StarCloud(app.eph.stars, 1));
  out.starCount = app.eph.stars.count;
  out.bodiesInstantiated = app.universe.bodies.size;
  out.exoLoaded = !!app.eph.exo;
  for (const [name, file] of [['exoJson', 'data/exoplanets.json'], ['deepSkyJson', 'data/deepsky.json']]) {
    const t = performance.now();
    const txt = await (await fetch(file)).text();
    out[name + 'Fetch_ms'] = +(performance.now() - t).toFixed(1);
    out[name + 'KB'] = Math.round(txt.length / 1024);
    [out[name + 'Parse_ms']] = timed(() => JSON.parse(txt));
  }
  return out;
});
console.log('time to window.app (ms):', bootMs);
console.log(JSON.stringify(r, null, 2));
await browser.close();
