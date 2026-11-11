import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { CITIES } from '../domain/logistics';
import type { CityId, Zone } from '../domain/types';
import { useTheme } from '../theme/ThemeContext';
import { AppText } from './ui';

const ZONE_LABEL: Record<Zone, string> = {
  principal: 'Ciudad principal',
  intermedia: 'Ciudad intermedia',
  remota: 'Zona de difícil acceso',
};

/** Lista de ciudades tipo "radio": se usa en Ajustes y en el modal de ciudad. */
export function CityList({ value, onChange }: { value: CityId; onChange: (city: CityId) => void }) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
    >
      {CITIES.map((city, i) => {
        const selected = city.id === value;
        return (
          <Pressable
            key={city.id}
            onPress={() => onChange(city.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${city.name}, ${ZONE_LABEL[city.zone]}`}
            style={({ pressed }) => [
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <AppText variant={selected ? 'bodyStrong' : 'body'}>{city.name}</AppText>
              <AppText variant="caption" tone="muted">
                {ZONE_LABEL[city.zone]}
              </AppText>
            </View>
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? colors.brandStrong : colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 60, gap: 12 },
});
