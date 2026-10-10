import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Oxanium_600SemiBold } from '@expo-google-fonts/oxanium/600SemiBold';
import { Oxanium_700Bold } from '@expo-google-fonts/oxanium/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { audio } from '../audio/audio';
import { useSettings } from '../state/settingsStore';
import { colors } from '../theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SystemUI.setBackgroundColorAsync(colors.bg0).catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Oxanium_600SemiBold, Oxanium_700Bold });
  const loaded = useSettings((s) => s.loaded);
  const music = useSettings((s) => s.music);
  const sfx = useSettings((s) => s.sfx);
  const reducedSetting = useSettings((s) => s.reducedMotion);
  const reducedOS = useReducedMotion();

  useEffect(() => {
    useSettings.getState().load();
    audio.init();
  }, []);

  useEffect(() => {
    audio.setVolumes(music, sfx);
  }, [music, sfx]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => (st === 'active' ? audio.resume() : audio.suspend()));
    return () => sub.remove();
  }, []);

  const ready = (fontsLoaded || !!fontError) && loaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg0 }} />;

  const animation = reducedSetting || reducedOS ? 'none' : 'fade';
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation, animationDuration: 220, contentStyle: { backgroundColor: colors.bg0 } }}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="ship" options={{ gestureEnabled: false }} />
          <Stack.Screen name="game-over" options={{ gestureEnabled: false }} />
          <Stack.Screen name="ending" options={{ gestureEnabled: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
