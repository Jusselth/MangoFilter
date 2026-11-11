import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { useAppSelector } from '../store';

/** Retroalimentación háptica sutil, desactivable desde Ajustes. */
export function useHaptics() {
  const enabled = useAppSelector((s) => s.preferences.haptics);
  return useCallback(
    (kind: 'selection' | 'success' = 'selection') => {
      if (!enabled || Platform.OS === 'web') return;
      if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else void Haptics.selectionAsync();
    },
    [enabled],
  );
}
