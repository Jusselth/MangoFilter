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
      <AppText tone="muted">Cada tienda cotiza el envío y el tiempo de entrega para la ciudad que elijas.</AppText>
      <CityList
        value={city}
        onChange={(c) => {
          haptic();
          dispatch(setCity({ id: c.id, name: c.name }));
          router.back();
        }}
      />
    </ScrollView>
  );
}
