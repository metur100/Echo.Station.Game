import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../theme/tokens';

/**
 * The ECHO STATION mark: an isometric hull diamond with a glowing reactor core and two echo
 * rings. Same artwork as the app icon (scripts/icon-art.mjs).
 */
export function LogoMark({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessible={false}>
      <Defs>
        <LinearGradient id="hullTop" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1C2B4D" />
          <Stop offset="1" stopColor="#0C1529" />
        </LinearGradient>
        <RadialGradient id="core" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFE2A8" />
          <Stop offset="0.45" stopColor={colors.amber} />
          <Stop offset="1" stopColor={colors.amber} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {/* Hull: top face and two side faces */}
      <Path d="M60 22 L104 46 L60 70 L16 46 Z" fill="url(#hullTop)" stroke={colors.cyan} strokeOpacity="0.7" strokeWidth="1.6" />
      <Path d="M16 46 L60 70 L60 84 L16 60 Z" fill="#16213D" />
      <Path d="M104 46 L60 70 L60 84 L104 60 Z" fill="#0D162C" />
      {/* Room grid */}
      <G stroke={colors.cyan} strokeOpacity="0.18" strokeWidth="1">
        <Path d="M38 34 L82 58 M82 34 L38 58 M27 40 L71 64 M93 40 L49 64" />
      </G>
      {/* Echo rings */}
      <Path d="M30 46 A30 15 0 0 1 90 46" stroke={colors.violet} strokeWidth="1.6" fill="none" strokeOpacity="0.7" />
      <Path d="M20 46 A40 20 0 0 1 100 46" stroke={colors.violet} strokeWidth="1.2" fill="none" strokeOpacity="0.4" />
      {/* Reactor */}
      <Circle cx="60" cy="44" r="16" fill="url(#core)" />
      <Path d="M52 46 L52 34 A8 4 0 0 1 68 34 L68 46 A8 4 0 0 1 52 46 Z" fill="#3A4A6E" />
      <Path d="M52 34 A8 4 0 0 1 68 34 A8 4 0 0 1 52 34 Z" fill="#FFD08A" />
      <Circle cx="60" cy="34" r="2.6" fill="#FFFFFF" />
    </Svg>
  );
}
