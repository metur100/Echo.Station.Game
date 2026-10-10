/**
 * Source artwork for the app icon, adaptive icon layers, splash mark and store graphics.
 * Original vector art: an isometric hull with a glowing reactor core and echo rings.
 */
const C = { bg0: '#04070F', bg1: '#070C1A', cyan: '#45E0DC', amber: '#FFB547', violet: '#9A84F0', hullTop: '#1C2B4D', hullL: '#16213D', hullR: '#0D162C' };

/** The mark, drawn in a 1024 box, scaled by `s` around the centre. */
export function mark({ s = 1, mono = false } = {}) {
  const fill = (c) => (mono ? '#FFFFFF' : c);
  return `
  <g transform="translate(512 540) scale(${s}) translate(-512 -540)">
    <defs>
      <radialGradient id="core" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#FFF1CF"/>
        <stop offset="0.35" stop-color="${C.amber}"/>
        <stop offset="1" stop-color="${C.amber}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="top" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#22355E"/>
        <stop offset="1" stop-color="#0E1830"/>
      </linearGradient>
      <linearGradient id="cyl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#3A4A6E"/>
        <stop offset="0.4" stop-color="#6A7BA3"/>
        <stop offset="1" stop-color="#1E2942"/>
      </linearGradient>
    </defs>
    ${mono ? '' : `<ellipse cx="512" cy="520" rx="330" ry="170" fill="url(#core)" opacity="0.28"/>`}
    <!-- hull -->
    <path d="M512 250 L872 450 L512 650 L152 450 Z" fill="${mono ? '#FFFFFF' : 'url(#top)'}" ${mono ? '' : `stroke="${C.cyan}" stroke-opacity="0.85" stroke-width="10" stroke-linejoin="round"`}/>
    <path d="M152 450 L512 650 L512 760 L152 560 Z" fill="${fill(C.hullL)}" ${mono ? 'opacity="0.7"' : ''}/>
    <path d="M872 450 L512 650 L512 760 L872 560 Z" fill="${fill(C.hullR)}" ${mono ? 'opacity="0.45"' : ''}/>
    ${mono ? '' : `
    <g stroke="${C.cyan}" stroke-opacity="0.22" stroke-width="5">
      <path d="M332 350 L692 550 M692 350 L332 550 M242 400 L602 600 M782 400 L422 600"/>
    </g>
    <path d="M152 450 L512 650 L872 450" fill="none" stroke="${C.cyan}" stroke-opacity="0.4" stroke-width="6"/>`}
    <!-- echo rings -->
    <path d="M262 452 A250 125 0 0 1 762 452" fill="none" stroke="${fill(C.violet)}" stroke-width="14" stroke-linecap="round" opacity="${mono ? 1 : 0.8}"/>
    <path d="M182 452 A330 165 0 0 1 842 452" fill="none" stroke="${fill(C.violet)}" stroke-width="10" stroke-linecap="round" opacity="${mono ? 0.7 : 0.45}"/>
    <!-- reactor -->
    ${mono ? '' : `<circle cx="512" cy="430" r="150" fill="url(#core)"/>`}
    <path d="M440 460 L440 340 A72 36 0 0 1 584 340 L584 460 A72 36 0 0 1 440 460 Z" fill="${mono ? '#FFFFFF' : 'url(#cyl)'}"/>
    <ellipse cx="512" cy="340" rx="72" ry="36" fill="${fill('#FFD08A')}"/>
    <ellipse cx="512" cy="400" rx="74" ry="37" fill="none" stroke="${fill(C.amber)}" stroke-width="8"/>
    <circle cx="512" cy="338" r="20" fill="#FFFFFF"/>
  </g>`;
}

function stars(n, seed = 3) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let out = '';
  for (let i = 0; i < n; i++) out += `<circle cx="${(r() * 1024).toFixed(1)}" cy="${(r() * 1024).toFixed(1)}" r="${(0.8 + r() * 2.4).toFixed(2)}" fill="#DDE8FF" opacity="${(0.25 + r() * 0.6).toFixed(2)}"/>`;
  return out;
}

const background = `
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#14204A"/>
      <stop offset="0.6" stop-color="${C.bg1}"/>
      <stop offset="1" stop-color="${C.bg0}"/>
    </radialGradient>
    <radialGradient id="neb" cx="80%" cy="15%" r="60%">
      <stop offset="0" stop-color="#5C46B4" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#5C46B4" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="neb2" cx="10%" cy="90%" r="60%">
      <stop offset="0" stop-color="#188C96" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#188C96" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#neb)"/>
  <rect width="1024" height="1024" fill="url(#neb2)"/>
  ${stars(90)}`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;

export const ICONS = {
  'icon.png': { size: 1024, svg: svg(`${background}${mark({ s: 0.92 })}`) },
  'android-icon-foreground.png': { size: 1024, svg: svg(mark({ s: 0.62 })) },
  'android-icon-background.png': { size: 1024, svg: svg(background) },
  'android-icon-monochrome.png': { size: 1024, svg: svg(mark({ s: 0.62, mono: true })) },
  'splash-icon.png': { size: 1024, svg: svg(mark({ s: 1 })) },
  'favicon.png': { size: 48, svg: svg(`${background}${mark({ s: 1.05 })}`) },
};
