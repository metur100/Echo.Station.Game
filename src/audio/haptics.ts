import * as Haptics from 'expo-haptics';

import { useSettings } from '../state/settingsStore';

type Kind = 'select' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/** Haptic feedback that respects the setting and never throws. */
export function haptic(kind: Kind) {
  if (!useSettings.getState().haptics) return;
  try {
    switch (kind) {
      case 'select':
        Haptics.selectionAsync().catch(() => undefined);
        break;
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        break;
    }
  } catch {
    // unsupported device
  }
}
