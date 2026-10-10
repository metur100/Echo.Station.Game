import { memo } from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { colors } from '../theme/tokens';
import { ICONS, type IconName, type Shape } from './icons';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const Icon = memo(function Icon({ name, size = 20, color = colors.text, strokeWidth = 1.8 }: Props) {
  const shapes: Shape[] = ICONS[name] ?? ICONS.info;
  const common = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {shapes.map((s, i) => {
        if ('p' in s) return <Path key={i} d={s.p} fill={s.fill ? color : 'none'} {...common} />;
        if ('c' in s) return <Circle key={i} cx={s.c[0]} cy={s.c[1]} r={s.c[2]} fill={s.fill ? color : 'none'} {...common} />;
        if ('e' in s) return <Ellipse key={i} cx={s.e[0]} cy={s.e[1]} rx={s.e[2]} ry={s.e[3]} fill="none" transform={`rotate(${s.e[4]} ${s.e[0]} ${s.e[1]})`} {...common} />;
        return <Rect key={i} x={s.r[0]} y={s.r[1]} width={s.r[2]} height={s.r[3]} rx={s.r[4]} fill="none" {...common} />;
      })}
    </Svg>
  );
});
