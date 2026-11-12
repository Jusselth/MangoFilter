import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfferCard } from '../../components/OfferCard';
import { ProductImage } from '../../components/ProductImage';
import { AppText, Card, EmptyState, GradientButton, IconButton, SegmentedControl, Skeleton, Tag } from '../../components/ui';
import { CRITERIA, isDeliverable, rankGroup } from '../../domain/ranking';
import { useAccountPrompt } from '../../hooks/useAccountPrompt';
import { useHaptics } from '../../hooks/useHaptics';
import { useAppDispatch, useAppSelector } from '../../store';
import { describeApiError, useSearchProductsQuery } from '../../store/api';
import { setCriterion } from '../../store/slices/preferencesSlice';
import { toggleSaved } from '../../store/slices/savedSlice';
import { useTheme } from '../../theme/ThemeContext';
import { formatCOP, plural, timeAgo } from '../../utils/format';

/**
 * Comparación de un producto entre tiendas. Muestra TODAS las ofertas del
 * grupo (sin filtros) para que la comparación sea completa y transparente.
 */
export default function ProductScreen() {
  const { id, q = '' } = useLocalSearchParams<{ id: string; q?: string }>();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const haptic = useHaptics();
  const showAccountPrompt = useAccountPrompt();
  const city = useAppSelector((s) => s.preferences.city);
  const criterion = useAppSelector((s) => s.preferences.criterion);
  const isSaved = useAppSelector((s) => s.saved.items.some((p) => p.id === id));

  const { data, isFetching, isError, error, refetch } = useSearchProductsQuery({ q, city }, { skip: q.trim().length < 2 });

  const group = useMemo(() => {
    const found = data?.groups.find((g) => g.id === id) ?? data?.groups.find((g) => g.offers.some((o) => o.id === id));
    return found ? rankGroup(found, criterion) : undefined;
  }, [data, id, criterion]);

  const onToggleSave = () => {
    if (!group) return;
    haptic('success');
    dispatch(toggleSaved({ id, name: group.name, imageUrl: group.imageUrl, query: q, bestTotalAtSave: group.best.totalCost, savedAt: Date.now() }));
    // Primer producto guardado desde que se abrió la app (sin cuenta): invitar a crearla para sincronizar.
    if (!isSaved) showAccountPrompt('save');
  };

  if (!data && isFetching) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={120} />
        <Skeleton height={180} />
        <Skeleton height={180} />
      </View>
    );
  }

  if (isError || !group || !data) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title={isError ? 'No pudimos consultar las tiendas' : 'Este producto ya no aparece'}
        message={isError ? describeApiError(error) : 'Puede que se haya agotado o que la tienda ya no lo despache a tu ciudad.'}
        action={<GradientButton label="Reintentar" icon="refresh" onPress={refetch} />}
      />
    );
  }

  const best = group.best;
  const bestReachable = isDeliverable(best);
  const known = group.offers.filter((o) => o.shippingKnown);
  const cheapest = known.length ? Math.min(...known.map((o) => o.totalCost)) : null;
  const fastestDays = known.map((o) => o.deliveryDays).filter((d): d is number => d !== null);
  const fastest = fastestDays.length ? Math.min(...fastestDays) : null;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon={isSaved ? 'heart' : 'heart-outline'}
              active={isSaved}
              label={isSaved ? 'Quitar de guardados' : 'Guardar producto'}
              onPress={onToggleSave}
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={styles.head}>
          <ProductImage uri={group.imageUrl} size={96} label={group.name} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="label" tone="muted">
              {group.offers.length > 1 ? `Comparado en ${plural(group.offers.length, 'tienda', 'tiendas')}` : bestReachable ? 'Disponible en 1 tienda' : 'En 1 tienda'}
            </AppText>
            <AppText variant="heading" accessibilityRole="header">
              {group.name}
            </AppText>
          </View>
        </View>

        <Card style={{ padding: 16, gap: 10 }}>
          <AppText variant="caption" tone="muted">
            Resumen para {data.city.name} · consultado {timeAgo(data.fetchedAt)}
          </AppText>
          <View style={styles.summaryRow}>
            {bestReachable ? (
              <Stat label="Mejor opción" value={formatCOP(best.totalCost)} hint={best.store.name} highlight />
            ) : (
              <Stat label="Mejor opción" value="—" hint="Ninguna llega" />
            )}
            <Stat label="Más barato" value={cheapest !== null ? formatCOP(cheapest) : '—'} />
            <Stat label="Más rápido" value={fastest === null ? '—' : fastest <= 1 ? '1 día' : `${fastest} días`} />
          </View>
          {group.undeliverable > 0 ? (
            <Tag
              icon="alert-circle-outline"
              tone="danger"
              label={
                group.undeliverable === group.offers.length
                  ? group.offers.length === 1
                    ? `La tienda no lo despacha a ${data.city.name}`
                    : `Ninguna tienda lo despacha a ${data.city.name}`
                  : `${plural(group.undeliverable, 'tienda no lo despacha', 'tiendas no lo despachan')} a ${data.city.name} (marcadas abajo)`
              }
            />
          ) : null}
          {group.savings > 0 ? (
            <Tag icon="trending-down" tone="leaf" label={`Ahorras hasta ${formatCOP(group.savings)} frente a la opción más cara`} />
          ) : null}
        </Card>

        {group.offers.length > 1 ? (
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
        ) : null}

        {group.offers.map((offer, index) => (
          <OfferCard key={offer.id} offer={offer} rank={index} bestTotal={best.totalCost} query={q} />
        ))}

        <Card elevated={0} style={[styles.disclaimer, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
            Total = precio + envío cotizado por cada tienda para {data.city.name}. Los precios pueden cambiar: confirma en la tienda antes de pagar.
            MangoFilter no vende: la compra, el pago, la garantía y las devoluciones son directamente con cada tienda.{' '}
            <AppText variant="caption" tone="brand" onPress={() => router.push('/terms')} accessibilityRole="link">
              Términos de uso
            </AppText>
          </AppText>
        </Card>
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
  disclaimer: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-start', marginTop: 8 },
});
