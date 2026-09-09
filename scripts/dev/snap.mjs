// Dev helper: open the app in the installed Edge via Playwright, run optional actions, screenshot, dump console.
// usage: node scripts/dev/snap.mjs <out.png> [--mobile] [--hash=earth] [--wait=ms] [--click=x,y] [--eval=js]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const args = process.argv.slice(2);
const out = args[0] ?? 'shot.png';
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=').slice(1).join('=');
const mobile = args.includes('--mobile');
// Any installed Chromium-based browser works (SNAP_BROWSER=/path overrides): Edge, Brave, Chrome, Chromium.
const CANDIDATES = [process.env.SNAP_BROWSER, '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].filter(Boolean);
const executablePath = CANDIDATES.find((p) => existsSync(p));
if (!executablePath) { console.error('No Chromium-based browser found; set SNAP_BROWSER=/path/to/binary'); process.exit(1); }
const browser = await chromium.launch({ executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('worker', (w) => { logs.push('[worker] started ' + w.url()); w.on('console', (m) => logs.push(`[worker:${m.type()}] ${m.text()}`)); w.on('close', () => logs.push('[worker] closed')); });
const hash = opt('hash');
await page.goto('http://localhost:5173/' + (hash ? '#' + hash : ''), { waitUntil: 'load' });
await page.waitForTimeout(+(opt('wait') || 6000));
const click = opt('click');
if (click) { const [x, y] = click.split(',').map(Number); await page.mouse.click(x, y); await page.waitForTimeout(1500); }
const ev = opt('eval');
if (ev) { try { const r = await page.evaluate(ev); logs.push('[eval] ' + JSON.stringify(r)); } catch (e) { logs.push('[eval error] ' + e.message); } await page.waitForTimeout(+(opt('after') || 2500)); }
await page.screenshot({ path: out });
const seen = new Map();
for (const l of logs) { if (l.includes('[vite]')) continue; const k = l.startsWith('[error]') || l.startsWith('[eval') || l.startsWith('[pageerror]') ? l.slice(0, 3000) : l.slice(0, 160); seen.set(k, (seen.get(k) ?? 0) + 1); }
console.log([...seen].map(([k, n]) => (n > 1 ? `(${n}x) ` : '') + k).slice(0, 60).join('\n'));
await browser.close();
