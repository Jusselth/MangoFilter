import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfferCard } from '../../components/OfferCard';
import { AppText, Card, EmptyState, GradientButton, IconButton, IconTile, SegmentedControl, Skeleton, Tag, type IconName } from '../../components/ui';
import { getCity, STORES } from '../../domain/logistics';
import { findGroup } from '../../domain/matching';
import { CRITERION_LABEL, rankGroup } from '../../domain/ranking';
import type { Criterion } from '../../domain/types';
import { useHaptics } from '../../hooks/useHaptics';
import { useAppDispatch, useAppSelector } from '../../store';
import { useSearchProductsQuery } from '../../store/api';
import { setCriterion } from '../../store/slices/preferencesSlice';
import { toggleSaved } from '../../store/slices/savedSlice';
import { useTheme } from '../../theme/ThemeContext';
import { CATEGORY_ICON, CATEGORY_LABEL, formatCOP, formatDays, plural } from '../../utils/format';

const CRITERIA = (['precio', 'equilibrado', 'rapidez'] as Criterion[]).map((value) => ({ value, label: CRITERION_LABEL[value] }));

/**
 * Comparación de un producto entre tiendas. Muestra TODAS las ofertas del
 * grupo (sin filtros) para que la comparación sea completa y transparente.
 */
export default function ProductScreen() {
  const { id, q = '' } = useLocalSearchParams<{ id: string; q?: string }>();
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const haptic = useHaptics();
  const city = useAppSelector((s) => s.preferences.city);
  const criterion = useAppSelector((s) => s.preferences.criterion);
  const isSaved = useAppSelector((s) => s.saved.items.some((p) => p.id === id));

  const { data, isFetching, isError, refetch } = useSearchProductsQuery({ q, city });

  const group = useMemo(() => {
    const found = data ? findGroup(data.groups, id) : undefined;
    return found ? rankGroup(found, criterion) : undefined;
  }, [data, id, criterion]);

  const onToggleSave = () => {
    if (!group) return;
    haptic('success');
    dispatch(
      toggleSaved({ id, name: group.name, query: q, category: group.category, bestTotalAtSave: group.minTotal, savedAt: Date.now() }),
    );
  };

  const headerRight = () =>
    group ? (
      <IconButton
        icon={isSaved ? 'heart' : 'heart-outline'}
        active={isSaved}
        label={isSaved ? 'Quitar de guardados' : 'Guardar producto'}
        onPress={onToggleSave}
      />
    ) : null;

  if (!data && isFetching) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={120} />
        <Skeleton height={180} />
        <Skeleton height={180} />
      </View>
    );
  }

  if (isError || !group) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="No encontramos este producto"
        message="Puede que ya no esté disponible en las tiendas consultadas."
        action={<GradientButton label="Reintentar" icon="refresh" onPress={refetch} />}
      />
    );
  }

  const best = group.best;
  const cheapest = Math.min(...group.offers.map((o) => o.totalCost));
  const fastest = Math.min(...group.offers.map((o) => o.deliveryDays));

  return (
    <>
      <Stack.Screen options={{ headerRight }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={styles.head}>
          <IconTile icon={CATEGORY_ICON[group.category] as IconName} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="label" tone="muted">
              {CATEGORY_LABEL[group.category]} · {plural(group.offers.length, 'tienda', 'tiendas')}
            </AppText>
            <AppText variant="title" accessibilityRole="header">
              {group.name}
            </AppText>
          </View>
        </View>

        <Card style={{ padding: 16, gap: 10 }}>
          <AppText variant="caption" tone="muted">
            Resumen para {getCity(city).name}
          </AppText>
          <View style={styles.summaryRow}>
            <Stat label="Mejor opción" value={formatCOP(best.totalCost)} hint={STORES[best.storeId].name} highlight />
            <Stat label="Más barato" value={formatCOP(cheapest)} />
            <Stat label="Más rápido" value={fastest <= 1 ? '1 día' : `${fastest} días`} />
          </View>
          {group.savings > 0 ? (
            <Tag icon="trending-down" tone="leaf" label={`Ahorras hasta ${formatCOP(group.savings)} frente a la opción más cara`} />
          ) : null}
        </Card>

        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            Ordenar ofertas por
          </AppText>
          <SegmentedControl
            accessibilityLabel="Ordenar ofertas por"
            options={CRITERIA}
            value={criterion}
            onChange={(c) => {
              haptic();
              dispatch(setCriterion(c));
            }}
          />
        </View>

        {group.offers.map((offer, index) => (
          <OfferCard key={offer.id} offer={offer} rank={index} bestTotal={best.totalCost} />
        ))}

        <AppText variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: spacing.sm }}>
          Total = precio + envío a {getCity(city).name}. {formatDays(best.deliveryDays)} con la mejor opción. Precios de demostración.
        </AppText>
      </ScrollView>
    </>
  );
}

function Stat({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${label}: ${value}${hint ? ` en ${hint}` : ''}`}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong" tone={highlight ? 'brand' : 'default'} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  summaryRow: { flexDirection: 'row', gap: 12 },
});
