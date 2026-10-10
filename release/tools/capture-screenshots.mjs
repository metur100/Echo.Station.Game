/**
 * Captures raw store screenshots of the real app running in Expo Go on an Android emulator.
 * The emulator display is resized with `wm size` / `wm density`, so every size is a real layout of
 * the game (phone, 7"/10" tablet, iPhone and iPad proportions), not a scaled copy.
 *
 * Setup:
 *   1. Start an emulator (e.g. AVD Pixel_10_Pro_XL) and Metro:  npx expo start --go --port 8082
 *   2. adb reverse tcp:8082 tcp:8082, open exp://127.0.0.1:8082 once in Expo Go and hide its
 *      floating "Tools button" (developer menu).
 *   3. node release/tools/capture-screenshots.mjs [device-key|all] [scene,scene…]
 *
 * Each scene is a real game state built by src/dev/demoState.ts and opened through the
 * development-only /dev-demo route. Output: release/store-assets/raw/<device>/NN-scene.png
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { DEVICES, ROOT, SCENES } from './devices.mjs';

const PORT = process.env.METRO_PORT ?? '8082';
const URL = `exp://127.0.0.1:${PORT}/--/`;
const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : null;
const onlyScenes = process.argv[3] ? process.argv[3].split(',') : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', env, timeout: 30000 });
const adbRaw = (...args) => execFileSync('adb', args, { env, maxBuffer: 64 * 1024 * 1024 });

function demoStatusBar() {
  adb('shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1');
  const b = (...extra) => adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', ...extra);
  b('enter');
  b('clock', '-e', 'hhmm', '0941');
  b('battery', '-e', 'level', '100', '-e', 'plugged', 'false');
  b('network', '-e', 'mobile', 'hide');
  b('network', '-e', 'wifi', 'show', '-e', 'level', '4', '-e', 'fully', 'true');
  b('notifications', '-e', 'visible', 'false');
}

async function open(route, wait) {
  adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `'${URL}${route}'`, 'host.exp.exponent');
  await sleep(wait);
}

async function capture(device) {
  const [w, h] = device.px;
  adb('shell', 'wm', 'size', `${w}x${h}`);
  adb('shell', 'wm', 'density', String(device.density));
  await sleep(2500);
  demoStatusBar();
  // Warm up: the first deep link after a resize reloads the layout.
  await open('dev-demo?scene=ship', 20000);
  const dir = path.join(ROOT, 'release', 'store-assets', 'raw', device.key);
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, scene] of SCENES.entries()) {
    if (onlyScenes && !onlyScenes.includes(scene.id)) continue;
    if (process.env.COLD) {
      // Cold start per scene: avoids Expo Go memory pressure on large tablet screens.
      adb('shell', 'am', 'force-stop', 'host.exp.exponent');
      await sleep(1500);
      await open(`dev-demo?scene=${scene.id}`, 40000);
    } else {
      await open('menu', 2000);
      await open(`dev-demo?scene=${scene.id}`, scene.wait ?? 25000);
    }
    const file = path.join(dir, `${String(i + 1).padStart(2, '0')}-${scene.id}.png`);
    fs.writeFileSync(file, adbRaw('exec-out', 'screencap', '-p'));
    console.log('  ', path.relative(ROOT, file));
  }
}

try {
  for (const d of DEVICES) {
    if (only && d.key !== only) continue;
    console.log(d.key);
    await capture(d);
  }
} finally {
  adb('shell', 'wm', 'size', 'reset');
  adb('shell', 'wm', 'density', 'reset');
  adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'exit');
}
