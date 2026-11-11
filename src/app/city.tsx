import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { CityList } from '../components/CityList';
import { AppText } from '../components/ui';
import { useHaptics } from '../hooks/useHaptics';
import { useAppDispatch, useAppSelector } from '../store';
import { setCity } from '../store/slices/preferencesSlice';
import { useTheme } from '../theme/ThemeContext';

export default function CityScreen() {
  const { spacing } = useTheme();
  const dispatch = useAppDispatch();
  const haptic = useHaptics();
  const city = useAppSelector((s) => s.preferences.city);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <AppText tone="muted">El costo y el tiempo de envío se calculan según la ciudad de entrega.</AppText>
      <CityList
        value={city}
        onChange={(c) => {
          haptic();
          dispatch(setCity(c));
          router.back();
        }}
      />
    </ScrollView>
  );
}
