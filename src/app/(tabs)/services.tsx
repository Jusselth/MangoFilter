import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TabScreen } from '../../components/TabScreen';
import { AppText, Chip, EmptyState, GradientButton, IconTile, PressableCard, Skeleton, type IconName } from '../../components/ui';
import type { ServiceCategory } from '../../domain/types';
import { useListServicesQuery } from '../../store/api';
import { useTheme } from '../../theme/ThemeContext';
import { formatCOP, SERVICE_CATEGORY_ICON, SERVICE_CATEGORY_LABEL } from '../../utils/format';

/** Módulo de Servicios: suscripciones y servicios del hogar ofrecidos por varios integradores. */
export default function ServicesScreen() {
  const { colors, spacing } = useTheme();
  const { data, isLoading, isError, refetch } = useListServicesQuery();
  const [category, setCategory] = useState<ServiceCategory | null>(null);

  const services = useMemo(() => (data ?? []).filter((s) => !category || s.category === category), [data, category]);

  return (
    <TabScreen title="Servicios" subtitle="Compara planes y paquetes: quién te da más por menos cada mes.">
      <View style={styles.wrap}>
        <Chip label="Todos" selected={category === null} onPress={() => setCategory(null)} />
        {(Object.keys(SERVICE_CATEGORY_LABEL) as ServiceCategory[]).map((c) => (
          <Chip key={c} label={SERVICE_CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>

      {isLoading ? (
        [0, 1, 2, 3].map((i) => <Skeleton key={i} height={84} />)
      ) : isError ? (
        <EmptyState icon="cloud-offline-outline" title="No pudimos cargar los servicios" message="Inténtalo de nuevo." action={<GradientButton label="Reintentar" onPress={refetch} />} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {services.map((s) => {
            return (
              <PressableCard
                key={s.id}
                onPress={() => router.push({ pathname: '/service/[id]', params: { id: s.id } })}
                accessibilityLabel={`${s.name}. ${s.offerCount} opciones, desde ${formatCOP(s.minPrice)} al mes`}
                style={styles.card}
              >
                <IconTile icon={SERVICE_CATEGORY_ICON[s.category] as IconName} size={52} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong">{s.name}</AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {s.description}
                  </AppText>
                  <AppText variant="label" tone="brand">
                    Desde {formatCOP(s.minPrice)}/mes · {s.offerCount} opciones
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </PressableCard>
            );
          })}
        </View>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
});
