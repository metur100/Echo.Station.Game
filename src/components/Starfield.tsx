/**
 * Procedural deep-space backdrop: three star layers baked into paths (cheap to draw), two soft
 * nebula glows. Static, so it never forces a redraw.
 */
import { Canvas, Circle, Group, LinearGradient, Path, RadialGradient, Rect, Skia, vec } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '../theme/tokens';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const Starfield = memo(function Starfield({ seed = 7, nebula = true, dim = 1 }: { seed?: number; nebula?: boolean; dim?: number }) {
  const { width, height } = useWindowDimensions();

  const layers = useMemo(() => {
    const r = rng(seed);
    const w = Math.max(width, height) * 1.2;
    const h = w;
    const mk = (n: number, rmin: number, rmax: number) => {
      const p = Skia.PathBuilder.Make();
      for (let i = 0; i < n; i++) p.addCircle(r() * w, r() * h, rmin + r() * (rmax - rmin));
      return p.build();
    };
    return { far: mk(220, 0.35, 0.8), mid: mk(90, 0.6, 1.2), near: mk(26, 1, 1.8) };
  }, [height, seed, width]);

  return (
    <Canvas style={StyleSheet.absoluteFill} accessible={false} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[colors.bg1, colors.bg0, '#03050B']} />
      </Rect>
      {nebula ? (
        <Group opacity={0.9 * dim}>
          <Circle cx={width * 0.85} cy={height * 0.22} r={width * 0.75}>
            <RadialGradient c={vec(width * 0.85, height * 0.22)} r={width * 0.75} colors={['rgba(92, 70, 180, 0.22)', 'rgba(92, 70, 180, 0)']} />
          </Circle>
          <Circle cx={width * 0.1} cy={height * 0.82} r={width * 0.7}>
            <RadialGradient c={vec(width * 0.1, height * 0.82)} r={width * 0.7} colors={['rgba(24, 140, 150, 0.16)', 'rgba(24, 140, 150, 0)']} />
          </Circle>
        </Group>
      ) : null}
      <Path path={layers.far} color={`rgba(170, 190, 230, ${0.45 * dim})`} />
      <Path path={layers.mid} color={`rgba(210, 225, 255, ${0.6 * dim})`} />
      <Path path={layers.near} color={`rgba(235, 245, 255, ${0.9 * dim})`} />
    </Canvas>
  );
});
