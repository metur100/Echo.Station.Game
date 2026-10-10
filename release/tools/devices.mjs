import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');

/**
 * Store screenshot sizes. `px` is the exact pixel size the store expects; `density` (Android dpi,
 * 160 = 1×) sets the layout size in dp. `css` / `dpr` describe the same size for the compositor.
 */
export const DEVICES = [
  // App Store Connect
  { key: 'ios-iphone-6.9', store: 'App Store – iPhone 6.9" (required)', px: [1320, 2868], density: 480, css: [440, 956], dpr: 3 },
  { key: 'ios-ipad-13', store: 'App Store – iPad 13" (required when iPad is supported)', px: [2064, 2752], density: 320, css: [1032, 1376], dpr: 2 },
  // Google Play
  { key: 'android-phone', store: 'Google Play – Phone', px: [1080, 1920], density: 420, css: [360, 640], dpr: 3 },
  { key: 'android-tablet-7', store: 'Google Play – 7" tablet', px: [1200, 1920], density: 320, css: [600, 960], dpr: 2 },
  { key: 'android-tablet-10', store: 'Google Play – 10" tablet', px: [1600, 2560], density: 320, css: [800, 1280], dpr: 2 },
];

/** Demo scenes (see src/app/dev-demo.tsx) with their store captions. */
export const SCENES = [
  { id: 'ship', caption: 'Keep a living ship alive', sub: 'A real-time simulation of power, air, food, water and heat' },
  { id: 'inspect', caption: 'Every anomaly follows rules', sub: 'See why the Lumen Bloom grows — and which room it takes next' },
  { id: 'echo', caption: 'The ship remembers', sub: 'Overloads, breaches and decisions leave echoes that come back' },
  { id: 'build', caption: 'Build room by room', sub: '14 modules on an isometric hull, placed by hand' },
  { id: 'crew', caption: 'A crew with history', sub: 'Skills, traits, fatigue and memories shape every task' },
  { id: 'power', caption: 'Read the ship at a glance', sub: 'Power, heat, damage and echo overlays' },
  { id: 'research', caption: 'Four research branches', sub: 'Turn dangerous anomalies into technology' },
  { id: 'map', caption: 'Explore what lies beyond', sub: 'Four destinations and a campaign with three endings' },
  { id: 'incident', caption: 'Hard calls, real consequences', sub: 'Incidents read the actual state of your ship' },
];
