import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import { useAppSelector } from '../../store';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/palette';
import type { IconName } from '../../components/ui';

function icon(name: IconName, active: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue | null; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : name} color={typeof color === 'number' ? undefined : (color ?? undefined)} size={size} />;
  }
  return TabIcon;
}

/** Tres pestañas, sin más: buscar, guardados y ajustes. */
export default function TabsLayout() {
  const { colors, shadow } = useTheme();
  const savedCount = useAppSelector((s) => s.saved.items.length);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandStrong,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          ...shadow(2),
          // En web no hay safe area inferior: se da altura extra para que las etiquetas no se recorten.
          ...(Platform.OS === 'web' ? { height: 62, paddingBottom: 8 } : null),
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Buscar', tabBarIcon: icon('search-outline', 'search') }} />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Guardados',
          tabBarIcon: icon('heart-outline', 'heart'),
          tabBarBadge: savedCount > 0 ? savedCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand, color: colors.onBrand, fontFamily: fonts.semibold, fontSize: 11 },
          tabBarAccessibilityLabel: `Guardados, ${savedCount} productos`,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('options-outline', 'options') }} />
    </Tabs>
  );
}
