/**
 * Captures the full-screen ship (dev-only /dev-hero route, vector rendering, no HUD) at the two
 * Google Play header sizes. The emulator display is resized to the exact landscape size, so the
 * capture is a real render at full resolution, not an upscale.
 *
 *   node release/tools/capture-headers.mjs        (Metro + Expo Go as for capture-screenshots.mjs)
 * Output: release/store-assets/raw/header/<w>x<h>.png
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './devices.mjs';

export const HEADERS = [
  { px: [5244, 2950], density: 960 },
  { px: [3840, 1646], density: 640 },
];

const PORT = process.env.METRO_PORT ?? '8082';
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', env, timeout: 30000 });
const adbRaw = (...args) => execFileSync('adb', args, { env, maxBuffer: 256 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = path.join(ROOT, 'release', 'store-assets', 'raw', 'header');
fs.mkdirSync(dir, { recursive: true });
try {
  for (const h of HEADERS) {
    const [w, hh] = h.px;
    adb('shell', 'wm', 'size', `${w}x${hh}`);
    adb('shell', 'wm', 'density', String(h.density));
    await sleep(3000);
    adb('shell', 'am', 'force-stop', 'host.exp.exponent');
    await sleep(1500);
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `'exp://127.0.0.1:${PORT}/--/dev-demo?scene=hero'`, 'host.exp.exponent');
    await sleep(45000);
    const file = path.join(dir, `${w}x${hh}.png`);
    fs.writeFileSync(file, adbRaw('exec-out', 'screencap', '-p'));
    console.log('  ', path.relative(ROOT, file));
  }
} finally {
  adb('shell', 'wm', 'size', 'reset');
  adb('shell', 'wm', 'density', 'reset');
}
