/**
 * Builds the store assets from the raw game captures:
 *   - captioned screenshots for every store size (the capture is shown unmodified inside a frame)
 *   - Play icon 512, App Store icon 1024 (no alpha), Play feature graphic 1024 × 500
 *
 * Renders HTML with a local Chromium-based browser (Edge on Windows) through playwright-core.
 *   node release/tools/compose-store-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright-core';

import { DEVICES, ROOT, SCENES } from './devices.mjs';

const OUT = path.join(ROOT, 'release', 'store-assets');
const RAW = path.join(OUT, 'raw');
const font = (p) => pathToFileURL(path.join(ROOT, 'node_modules', p)).href;
const FONTS = `
  @font-face { font-family: Oxanium; font-weight: 700; src: url('${font('@expo-google-fonts/oxanium/700Bold/Oxanium_700Bold.ttf')}'); }
  @font-face { font-family: Inter; font-weight: 500; src: url('${font('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf')}'); }
`;
const FOLDER = {
  'android-phone': 'google-play/phone',
  'android-tablet-7': 'google-play/tablet-7',
  'android-tablet-10': 'google-play/tablet-10',
  'ios-iphone-6.9': 'app-store/iphone-6.9',
  'ios-iphone-6.5': 'app-store/iphone-6.5',
  'ios-ipad-13': 'app-store/ipad-13',
};

function stars(n, w, h, seed = 7) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let out = '';
  for (let i = 0; i < n; i++) out += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(0.4 + r() * 1.2).toFixed(2)}" fill="#DDE8FF" opacity="${(0.2 + r() * 0.6).toFixed(2)}"/>`;
  return `<svg class="stars" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${out}</svg>`;
}

const PAGE = (w, h, body, extraCss = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
  ${FONTS}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body { background: radial-gradient(120% 70% at 85% 0%, rgba(92,70,180,.42), transparent 60%), radial-gradient(90% 60% at 0% 100%, rgba(24,140,150,.30), transparent 60%), linear-gradient(#0B1326, #04070F); color: #E6EDF8; font-family: Inter, sans-serif; position: relative; }
  .stars { position: absolute; inset: 0; }
  ${extraCss}
</style></head><body>${stars(Math.round((w * h) / 2200), w, h)}${body}</body></html>`;

async function screenshots(browser) {
  for (const d of DEVICES) {
    const page = await browser.newPage({ deviceScaleFactor: d.dpr });
    const [cw, ch] = d.css;
    const dir = path.join(RAW, d.key);
    if (!fs.existsSync(dir)) {
      console.log('skip (no captures):', d.key);
      await page.close();
      continue;
    }
    const out = path.join(OUT, FOLDER[d.key]);
    fs.mkdirSync(out, { recursive: true });
    await page.setViewportSize({ width: cw, height: ch });
    const tablet = cw / ch > 0.6;
    for (const [i, scene] of SCENES.entries()) {
      const file = path.join(dir, `${String(i + 1).padStart(2, '0')}-${scene.id}.png`);
      if (!fs.existsSync(file)) continue;
      const src = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
      const capH = Math.round(ch * (tablet ? 0.8 : 0.76));
      const capW = Math.round(capH * (cw / ch));
      const css = `
        .cap { position: absolute; top: ${Math.round(ch * 0.045)}px; left: 0; right: 0; text-align: center; padding: 0 ${Math.round(cw * 0.07)}px; }
        .label { font: 700 ${Math.round(cw * (tablet ? 0.022 : 0.033))}px Oxanium; letter-spacing: .18em; color: #45E0DC; text-transform: uppercase; }
        h1 { font: 700 ${Math.round(cw * (tablet ? 0.05 : 0.074))}px/1.08 Oxanium; letter-spacing: .01em; margin-top: ${Math.round(ch * 0.008)}px; }
        p { font: 500 ${Math.round(cw * (tablet ? 0.026 : 0.039))}px/1.35 Inter; color: #93A1BF; margin-top: ${Math.round(ch * 0.01)}px; }
        .frame { position: absolute; left: 50%; bottom: ${Math.round(ch * 0.03)}px; width: ${capW}px; height: ${capH}px; transform: translateX(-50%); border-radius: ${Math.round(cw * 0.05)}px; overflow: hidden; border: 1.5px solid rgba(69,224,220,.45); box-shadow: 0 0 0 ${Math.round(cw * 0.012)}px rgba(14,24,46,.9), 0 24px 60px rgba(0,0,0,.6), 0 0 80px rgba(69,224,220,.12); }
        .frame img { width: 100%; height: 100%; display: block; }`;
      const body = `<div class="cap"><div class="label">ECHO STATION</div><h1>${scene.caption}</h1><p>${scene.sub}</p></div><div class="frame"><img src="${src}"/></div>`;
      await page.setContent(PAGE(cw, ch, body, css));
      await page.evaluate(() => document.fonts.ready);
      const target = path.join(out, `${String(i + 1).padStart(2, '0')}-${scene.id}.jpg`);
      await page.screenshot({ path: target, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: cw, height: ch } });
    }
    await page.close();
    console.log('wrote', FOLDER[d.key]);
  }
}

async function graphics(browser) {
  const icon = fs.readFileSync(path.join(ROOT, 'assets', 'images', 'icon.png')).toString('base64');
  // Icons: Play 512 (any), App Store 1024 (opaque)
  for (const [file, size, scale] of [['google-play/icon-512.png', 512, 0.5], ['app-store/icon-1024.png', 1024, 1]]) {
    const p = await browser.newPage({ deviceScaleFactor: 1 });
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:#04070F"><img src="data:image/png;base64,${icon}" style="width:${1024 * scale}px;height:${1024 * scale}px;display:block"/></body></html>`);
    fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
    await p.screenshot({ path: path.join(OUT, file), omitBackground: false });
    await p.close();
    console.log('wrote', file);
  }
  // Feature graphic 1024 × 500: logo, title and the real ship capture
  const shot = path.join(RAW, 'android-tablet-10', '01-ship.png');
  const p = await browser.newPage({ deviceScaleFactor: 1 });
  await p.setViewportSize({ width: 1024, height: 500 });
  const shipImg = fs.existsSync(shot) ? `<div class="ship"><img src="data:image/png;base64,${fs.readFileSync(shot).toString('base64')}"/></div>` : '';
  const css = `
    .ship { position: absolute; right: -40px; top: 0; bottom: 0; width: 620px; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 30%); }
    .ship img { position: absolute; width: 900px; left: -120px; top: -620px; }
    .text { position: absolute; left: 64px; top: 50%; transform: translateY(-50%); width: 470px; }
    .label { font: 700 16px Oxanium; letter-spacing: .3em; color: #45E0DC; }
    h1 { font: 700 70px/1 Oxanium; letter-spacing: .03em; margin-top: 10px; }
    p { font: 500 22px/1.35 Inter; color: #93A1BF; margin-top: 16px; }
    .logo { width: 72px; height: 72px; margin-bottom: 18px; }`;
  const logo = `<img class="logo" src="data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'assets', 'images', 'splash-icon.png')).toString('base64')}"/>`;
  await p.setContent(PAGE(1024, 500, `${shipImg}<div class="text">${logo}<div class="label">THE LIVING SHIP</div><h1>ECHO<br/>STATION</h1><p>Keep a damaged research ship alive. The ship remembers everything.</p></div>`, css));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(OUT, 'google-play', 'feature-graphic-1024x500.png') });
  await p.close();
  console.log('wrote google-play/feature-graphic-1024x500.png');
}

const channel = process.env.BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chrome');
const browser = await chromium.launch({ channel });
try {
  await screenshots(browser);
  await graphics(browser);
} finally {
  await browser.close();
}
