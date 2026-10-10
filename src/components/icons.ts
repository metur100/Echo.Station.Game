/**
 * The ECHO STATION icon set: original line icons on a 24 × 24 grid, 1.8 px round strokes.
 * One style for UI, resources, modules, anomalies and research. Rendered by <Icon>.
 */
export type Shape =
  | { p: string; fill?: boolean }
  | { c: [number, number, number]; fill?: boolean }
  | { e: [number, number, number, number, number] }
  | { r: [number, number, number, number, number] };

const hex = 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z';
const flask = 'M9.5 3.5h5M10.5 3.5v6L5 19a1.2 1.2 0 0 0 1 1.8h12a1.2 1.2 0 0 0 1-1.8l-5.5-9.5v-6';
const wrench = 'M15.5 4.2a4.5 4.5 0 0 0-5.3 5.9L4 16.3a2.1 2.1 0 0 0 3 3l6.2-6.2a4.5 4.5 0 0 0 5.9-5.3l-2.8 2.8-2.6-.4-.4-2.6z';
const shieldPath = 'M12 3l7.5 3v6c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6z';
const thermo = 'M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z';

export const ICONS = {
  // UI
  pause: [{ p: 'M9 6v12M15 6v12' }],
  play: [{ p: 'M8 5.5v13l10.5-6.5z' }],
  fast: [{ p: 'M5 6l7 6-7 6M12 6l7 6-7 6' }],
  close: [{ p: 'M6 6l12 12M18 6L6 18' }],
  back: [{ p: 'M15 5l-7 7 7 7' }],
  chevron: [{ p: 'M9 5l7 7-7 7' }],
  settings: [{ c: [12, 12, 3.2] }, { c: [12, 12, 7] }, { p: 'M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8' }],
  menu: [{ p: 'M4 7h16M4 12h16M4 17h10' }],
  check: [{ p: 'M5 12.5l4.5 4.5L19 7.5' }],
  lock: [{ r: [5, 11, 14, 9, 2] }, { p: 'M8 11V8a4 4 0 0 1 8 0v3' }],
  info: [{ c: [12, 12, 9] }, { p: 'M12 11v6M12 7.5v.2' }],
  warning: [{ p: 'M12 3.5L21.5 20h-19z' }, { p: 'M12 10v4.5M12 17.4v.2' }],
  critical: [{ p: 'M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z' }, { p: 'M12 7.5v6M12 16.4v.2' }],
  plus: [{ p: 'M12 5v14M5 12h14' }],
  trash: [{ p: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5' }],
  upgrade: [{ p: 'M12 18V6M6.5 11.5L12 6l5.5 5.5M5 21h14' }],
  rotate: [{ p: 'M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5' }],
  power: [{ p: 'M12 3.5v8M7.05 6.5a7 7 0 1 0 9.9 0' }],
  quarantine: [{ p: hex }, { p: 'M9 9l6 6M15 9l-6 6' }],
  eye: [{ p: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z' }, { c: [12, 12, 3] }],
  save: [{ p: 'M5 4h11l3 3v13H5z' }, { p: 'M8 4v5h7V4M8 20v-6h8v6' }],
  star: [{ p: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z' }],
  log: [{ p: 'M8 6h12M8 12h12M8 18h12M4 6h.6M4 12h.6M4 18h.6' }],
  stats: [{ p: 'M5 20v-8M12 20V5M19 20v-5M3 20.5h18' }],
  crew: [{ c: [12, 8, 3.6] }, { p: 'M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6' }],
  map: [{ p: 'M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z' }, { p: 'M9 4.5v13M15 6.5v13' }],
  research: [{ p: flask }, { p: 'M7.5 15h9' }],
  build: [{ p: wrench }],
  echo: [{ c: [12, 12, 1.8], fill: true }, { p: 'M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8' }],
  sound: [{ p: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z' }, { p: 'M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11' }],
  music: [{ p: 'M9 18V5.5l10-2V16' }, { c: [7, 18, 2] }, { c: [17, 16, 2] }],
  vibrate: [{ r: [8, 4, 8, 16, 1.5] }, { p: 'M4.5 9v6M19.5 9v6M2 10.5v3M22 10.5v3' }],
  motion: [{ p: 'M3 12h4l2-5 4 10 2-5h6' }],
  clock: [{ c: [12, 12, 9] }, { p: 'M12 7v5l3 2' }],
  home: [{ p: 'M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5' }],
  layers: [{ p: 'M12 4l9 5-9 5-9-5z' }, { p: 'M3 14l9 5 9-5' }],
  target: [{ c: [12, 12, 8] }, { c: [12, 12, 3] }, { p: 'M12 2v3M12 19v3M2 12h3M19 12h3' }],
  text: [{ p: 'M4 7V5h16v2M12 5v14M9 19h6' }],
  globe: [{ c: [12, 12, 9] }, { p: 'M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z' }],
  external: [{ p: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6' }],
  mission: [{ p: 'M12 3c3.5 2 5 5.5 5 9.5l-2.5 3h-5L7 12.5C7 8.5 8.5 5 12 3z' }, { c: [12, 10, 1.5] }, { p: 'M9.5 15.5L8 20l4-2 4 2-1.5-4.5' }],
  recovery: [{ p: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4' }, { p: 'M12 8v4l2.5 2.5' }],
  archive: [{ p: 'M3.5 5h17v4h-17zM5 9v10h14V9M10 13h4' }],
  trophy: [{ p: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z' }],

  // Resources
  bolt: [{ p: 'M13 2.5L5 13.5h6l-1 8 8-11h-6z' }],
  oxygen: [{ c: [10, 14, 5.5] }, { c: [17.5, 6.5, 2.8] }, { c: [18, 13.5, 1.4] }],
  food: [{ p: 'M5 19c0-8 5.5-13.5 14-14 0 8.5-5.5 14-14 14z' }, { p: 'M5 19l8-8' }],
  water: [{ p: 'M12 3.5s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10.5 12 3.5 12 3.5z' }],
  atom: [{ c: [12, 12, 1.6], fill: true }, { e: [12, 12, 9, 3.6, 0] }, { e: [12, 12, 9, 3.6, 60] }, { e: [12, 12, 9, 3.6, 120] }],
  materials: [{ p: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z' }, { p: 'M4 7.5l8 4.5 8-4.5M12 12v9' }],
  credits: [{ p: hex }, { p: 'M12 8.5l3.5 3.5-3.5 3.5-3.5-3.5z' }],
  hull: [{ p: shieldPath }],
  heat: [{ p: thermo }, { p: 'M12 9v7' }],

  // Modules
  reactor: [{ c: [12, 12, 3] }, { c: [12, 12, 8.5] }, { p: 'M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5' }],
  oxygenGen: [{ r: [4.5, 5, 6.5, 14, 3.2] }, { r: [13, 8, 6.5, 11, 3.2] }, { p: 'M7.75 9v3M16.25 11.5v2.5' }],
  hydroponics: [{ p: 'M12 20v-8M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5zM12 14.5c0-3-2.5-5-6-5 0 3 2.5 5 6 5zM6 20h12' }],
  quarters: [{ p: 'M3 18V7M3 13h18v5M21 18v-3M6.5 13v-2.5A1.5 1.5 0 0 1 8 9h3v4M12 9h6.5a2.5 2.5 0 0 1 2.5 2.5V13' }],
  lab: [{ p: flask }, { c: [10, 16.5, 1], fill: true }, { c: [14, 14.5, 0.8], fill: true }],
  storage: [{ r: [4, 6, 16, 13, 1.5] }, { p: 'M4 10.5h16M10 13.5h4' }],
  airlock: [{ c: [12, 12, 8.5] }, { c: [12, 12, 4] }, { p: 'M12 3.5V8M12 16v4.5M3.5 12H8M16 12h4.5' }],
  corridor: [{ p: 'M3 8h18M3 16h18M6 12h2.5M10.75 12h2.5M15.5 12H18' }],
  workshop: [{ p: wrench }],
  shield: [{ p: 'M4 15a8 8 0 0 1 16 0M7.5 15a4.5 4.5 0 0 1 9 0M12 15v5M8 20.5h8' }],
  recycler: [{ p: 'M17.5 8A6.5 6.5 0 0 0 6 9.5M6.5 16a6.5 6.5 0 0 0 11.5-1.5M17.5 4.5V8H14M6.5 19.5V16H10' }],
  radiator: [{ p: 'M6 5v14M10 5v14M14 5v14M18 5v14M4 19.5h16' }],
  containment: [{ p: hex }, { c: [12, 12, 3] }],
  condenser: [{ p: 'M12 3l6 9-6 9-6-9z' }, { p: 'M6 12h12' }],

  // Anomalies
  bloom: [{ p: 'M12 21c0-5 1-8 4-11M12 21c0-4-1.5-7-5-9M12 21v-9.5' }, { c: [16.5, 9, 1.8], fill: true }, { c: [6.5, 11.5, 1.8], fill: true }, { c: [12, 9.5, 1.8], fill: true }],
  choir: [{ p: 'M2 12c2-5 3.5-5 5 0s3 5 5 0 3.5-5 5 0 3 5 5 0' }],
  frost: [{ p: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5' }],

  // Research
  lattice: [{ p: 'M4 8h16M4 16h16M8 4v16M16 4v16' }],
  symbiosis: [{ c: [9, 12, 5] }, { c: [15, 12, 5] }],
  sterile: [{ p: shieldPath }, { p: 'M8.5 12l2.5 2.5 4.5-5' }],
  chart: [{ p: 'M4 19L9.5 12l4 3L20 6' }, { p: 'M15.5 6H20v4.5' }],
  burn: [{ p: 'M12 3c3 4 5 6.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z' }],
  scanner: [{ p: 'M4 20A16 16 0 0 1 20 4M8 20a12 12 0 0 1 12-12M12 20a8 8 0 0 1 8-8' }, { c: [4.5, 19.5, 1.2], fill: true }],
  ark: [{ p: 'M3 14c3 4.5 15 4.5 18 0M5 14l2-7h10l2 7M12 3v4' }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

/** Icon for each module type */
export const MODULE_ICON: Record<string, IconName> = {
  reactor: 'reactor',
  oxygen: 'oxygenGen',
  hydroponics: 'hydroponics',
  quarters: 'quarters',
  lab: 'lab',
  storage: 'storage',
  airlock: 'airlock',
  corridor: 'corridor',
  workshop: 'workshop',
  shield: 'shield',
  recycler: 'recycler',
  radiator: 'radiator',
  containment: 'containment',
  condenser: 'condenser',
};

export const RESOURCE_ICON: Record<string, IconName> = {
  power: 'bolt',
  oxygen: 'oxygen',
  food: 'food',
  water: 'water',
  research: 'atom',
  materials: 'materials',
  credits: 'credits',
  hull: 'hull',
  temperature: 'heat',
};

/** Research icon names in content map onto the set */
export const RESEARCH_ICON: Record<string, IconName> = {
  reactor: 'reactor',
  radiator: 'radiator',
  upgrade: 'upgrade',
  shield: 'shield',
  lattice: 'lattice',
  bloom: 'bloom',
  containment: 'containment',
  symbiosis: 'symbiosis',
  sterile: 'sterile',
  frost: 'frost',
  chart: 'chart',
  burn: 'burn',
  scanner: 'scanner',
  ark: 'ark',
  echo: 'echo',
  condenser: 'condenser',
  choir: 'choir',
  map: 'map',
};

export const ACHIEVEMENT_ICON: Record<string, IconName> = {
  reactor: 'reactor',
  oxygen: 'oxygen',
  build: 'build',
  upgrade: 'upgrade',
  bloom: 'bloom',
  containment: 'containment',
  symbiosis: 'symbiosis',
  echo: 'echo',
  archive: 'archive',
  research: 'research',
  crew: 'crew',
  mission: 'mission',
  map: 'map',
  recovery: 'recovery',
  ark: 'ark',
};
