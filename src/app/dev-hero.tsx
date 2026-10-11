/**
 * Development only: the demo ship full screen, without HUD, drawn as vectors. Used to capture
 * the Google Play header images (release/tools/capture-headers.mjs). Release builds redirect.
 */
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Starfield } from '../components/Starfield';
import { ShipView } from '../game/rendering/ShipView';
import { useGame } from '../state/gameStore';
import { colors } from '../theme/tokens';

export default function DevHero() {
  const snapshot = useGame((s) => s.snapshot);
  const { width, height } = useWindowDimensions();
  if (!__DEV__) return <Redirect href="/menu" />;
  if (!snapshot) return <View style={styles.root} />;
  // Ship on the right half so the left stays free for the title in the composed header.
  // Clear of the top and bottom 10 %, where the system bars sit (the compositor fades those strips out).
  const insets = { top: height * 0.1, bottom: height * 0.1, left: width * 0.38, right: width * 0.02 };
  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <Starfield seed={21} />
      <ShipView state={snapshot} path="neutral" interactive={false} vector insets={insets} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg0 } });
