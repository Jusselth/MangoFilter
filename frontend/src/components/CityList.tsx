import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import type { City } from '../api/types';
import { describeApiError, useGetCitiesQuery } from '../store/api';
import { useTheme } from '../theme/ThemeContext';
import { AppText, EmptyState, GradientButton, Skeleton } from './ui';

/** Lista de ciudades (desde el backend) tipo "radio": se usa en Ajustes y en el modal de ciudad. */
export function CityList({ value, onChange }: { value: string; onChange: (city: City) => void }) {
  const { colors, radius } = useTheme();
  const { data, isLoading, isError, error, refetch } = useGetCitiesQuery();

  if (isLoading) return <Skeleton height={240} />;
  if (isError || !data) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No pudimos cargar las ciudades"
        message={describeApiError(error)}
        action={<GradientButton label="Reintentar" icon="refresh" onPress={refetch} />}
      />
    );
  }

  return (
    <View
      accessibilityRole="radiogroup"
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
    >
      {data.map((city, i) => {
        const selected = city.id === value;
        return (
          <Pressable
            key={city.id}
            onPress={() => onChange(city)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${city.name}, ${city.department}`}
            style={({ pressed }) => [
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <AppText variant={selected ? 'bodyStrong' : 'body'}>{city.name}</AppText>
              <AppText variant="caption" tone="muted">
                {city.department}
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
