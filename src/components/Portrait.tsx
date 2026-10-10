/**
 * Original crew portraits: stylised busts built from vector shapes, lit from the upper left
 * with a cyan rim light, on a role-coloured backdrop.
 */
import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../theme/tokens';

interface Look {
  skin: string;
  skinShade: string;
  hair: string;
  suit: string;
  accent: string;
  hairStyle: 'bun' | 'short' | 'bob' | 'buzz';
  glasses?: boolean;
  beard?: boolean;
  headset?: boolean;
  scar?: boolean;
}

const LOOKS: Record<string, Look> = {
  ines: { skin: '#E0B59A', skinShade: '#B9876E', hair: '#3B2A24', suit: '#5A3F2A', accent: colors.amber, hairStyle: 'bun', headset: true },
  tomas: { skin: '#7A4E36', skinShade: '#5A3826', hair: '#16110F', suit: '#3A3168', accent: colors.violet, hairStyle: 'short', glasses: true, beard: true },
  mira: { skin: '#E8C3A4', skinShade: '#C49A7E', hair: '#11151E', suit: '#1D4558', accent: colors.cyan, hairStyle: 'bob', headset: true },
  elias: { skin: '#C9B2A4', skinShade: '#A08A7E', hair: '#B9B2A6', suit: '#24503F', accent: colors.green, hairStyle: 'buzz', scar: true },
};

export const Portrait = memo(function Portrait({ id, size = 64, dimmed }: { id: string; size?: number; dimmed?: boolean }) {
  const l = LOOKS[id] ?? LOOKS.ines;
  const gid = `p${id}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" opacity={dimmed ? 0.45 : 1} accessible={false}>
      <Defs>
        <RadialGradient id={`${gid}bg`} cx="35%" cy="25%" r="90%">
          <Stop offset="0" stopColor={l.accent} stopOpacity="0.45" />
          <Stop offset="0.55" stopColor="#0E182E" stopOpacity="1" />
          <Stop offset="1" stopColor="#070C1A" stopOpacity="1" />
        </RadialGradient>
        <LinearGradient id={`${gid}suit`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={l.suit} stopOpacity="1" />
          <Stop offset="1" stopColor="#0B1222" stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id={`${gid}face`} x1="0.2" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={l.skin} />
          <Stop offset="1" stopColor={l.skinShade} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" rx="18" fill={`url(#${gid}bg)`} />
      {/* Shoulders and suit */}
      <Path d="M10 100 C12 78 28 70 50 70 C72 70 88 78 90 100 Z" fill={`url(#${gid}suit)`} />
      <Path d="M36 72 L50 86 L64 72" stroke={l.accent} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.9" />
      <Rect x="66" y="82" width="12" height="4" rx="2" fill={l.accent} opacity="0.85" />
      {/* Neck */}
      <Path d="M42 60 L42 72 C46 75 54 75 58 72 L58 60 Z" fill={l.skinShade} />
      {/* Hair behind */}
      {l.hairStyle === 'bob' ? <Path d="M27 44 C26 22 74 22 73 44 L74 64 C66 66 62 58 62 50 L38 50 C38 58 34 66 26 64 Z" fill={l.hair} /> : null}
      {l.hairStyle === 'bun' ? <Circle cx="63" cy="22" r="9" fill={l.hair} /> : null}
      {/* Head */}
      <Ellipse cx="50" cy="44" rx="17" ry="20" fill={`url(#${gid}face)`} />
      {/* Ears */}
      <Ellipse cx="33.5" cy="46" rx="2.6" ry="4.5" fill={l.skinShade} />
      <Ellipse cx="66.5" cy="46" rx="2.6" ry="4.5" fill={l.skinShade} />
      {/* Hair on top */}
      {l.hairStyle === 'short' ? <Path d="M33 40 C32 24 68 22 67 40 C62 32 40 30 33 40 Z" fill={l.hair} /> : null}
      {l.hairStyle === 'bun' ? <Path d="M32.5 42 C31 22 69 21 67.5 42 C63 30 46 27 32.5 42 Z" fill={l.hair} /> : null}
      {l.hairStyle === 'bob' ? <Path d="M32 40 C33 26 67 26 68 40 C60 34 44 30 32 40 Z" fill={l.hair} /> : null}
      {l.hairStyle === 'buzz' ? <Path d="M33.5 40 C33 27 67 27 66.5 40 C60 34 42 33 33.5 40 Z" fill={l.hair} opacity="0.85" /> : null}
      {/* Face */}
      <G opacity="0.9">
        <Path d="M41 46 Q44 44.5 47 46" stroke="#1A1210" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <Path d="M53 46 Q56 44.5 59 46" stroke="#1A1210" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <Path d="M50 48 L48.5 54 L51 54.5" stroke={l.skinShade} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <Path d="M45 58.5 Q50 61 55 58.5" stroke="#5A2E2A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </G>
      {l.beard ? <Path d="M34 50 C35 64 44 66 50 66 C56 66 65 64 66 50 C62 60 56 62 50 62 C44 62 38 60 34 50 Z" fill={l.hair} opacity="0.92" /> : null}
      {l.glasses ? (
        <G stroke="#D9E3F5" strokeWidth="1.4" fill="rgba(69,224,220,0.12)">
          <Rect x="39" y="42" width="9.5" height="7" rx="2.5" />
          <Rect x="51.5" y="42" width="9.5" height="7" rx="2.5" />
          <Path d="M48.5 45 L51.5 45" fill="none" />
        </G>
      ) : null}
      {l.scar ? <Path d="M58 36 L61 44" stroke="#8C5E58" strokeWidth="1.4" strokeLinecap="round" /> : null}
      {l.headset ? (
        <G>
          <Path d="M32 44 C30 26 70 26 68 44" stroke="#2A3550" strokeWidth="2.6" fill="none" />
          <Rect x="65" y="41" width="5" height="9" rx="2" fill="#2A3550" />
          <Path d="M67.5 50 Q66 57 58 58" stroke="#2A3550" strokeWidth="1.6" fill="none" />
          <Circle cx="57.5" cy="58" r="1.6" fill={l.accent} />
        </G>
      ) : null}
      {/* Rim light */}
      <Path d="M66 34 C70 42 69 52 63 59" stroke={colors.cyan} strokeWidth="1.4" fill="none" opacity="0.55" strokeLinecap="round" />
      <Rect x="0.75" y="0.75" width="98.5" height="98.5" rx="17.5" stroke={l.accent} strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
    </Svg>
  );
});
