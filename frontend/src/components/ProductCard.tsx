import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { isDeliverable, type RankedGroup } from '../domain/ranking';
import { useAppSelector } from '../store';
import { useTheme } from '../theme/ThemeContext';
import { availabilityLabel, formatCOP, formatDays, plural, spokenCOP } from '../utils/format';
import { ProductImage } from './ProductImage';
import { AppText, PressableCard, StoreBadge, Tag } from './ui';

/** Tarjeta de resultado: un producto (agrupado entre tiendas) con su mejor oferta según el criterio. */
export const ProductCard = memo(function ProductCard({ group, onPress }: { group: RankedGroup; onPress: () => void }) {
  const { colors } = useTheme();
  const cityName = useAppSelector((s) => s.preferences.cityName);
  const { best } = group;
  const storeCount = group.offers.length;
  // Si ni la mejor oferta llega, ninguna llega (las que no llegan siempre van al final).
  const noneArrive = !isDeliverable(best);
  const bestWarning = availabilityLabel(best, cityName);

  const a11y = [
    group.name,
    noneArrive
      ? `Atención: ${bestWarning}. Precio ${spokenCOP(best.totalCost)} en ${best.store.name}`
      : `Mejor opción ${spokenCOP(best.totalCost)}${best.shippingKnown ? ' con envío' : ', envío por confirmar'} en ${best.store.name}`,
    group.undeliverable > 0 && !noneArrive ? `${plural(group.undeliverable, 'tienda no lo despacha', 'tiendas no lo despachan')} a ${cityName}` : '',
    formatDays(best.deliveryDays),
    storeCount > 1 ? `comparado en ${plural(storeCount, 'tienda', 'tiendas')}` : 'disponible en 1 tienda',
    group.savings > 0 ? `ahorras hasta ${spokenCOP(group.savings)}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <PressableCard onPress={onPress} accessibilityLabel={a11y} accessibilityHint="Abre la comparación entre tiendas" style={styles.card}>
      <View style={styles.row}>
        <ProductImage uri={group.imageUrl} label={group.name} />
        <View style={styles.info}>
          <AppText variant="bodyStrong" numberOfLines={3}>
            {group.name}
          </AppText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.bottom}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="muted">
            {best.shippingKnown ? 'Total con envío' : noneArrive ? 'Precio (sin envío a tu ciudad)' : 'Precio (envío por confirmar)'}
          </AppText>
          <AppText variant="price" tone={noneArrive ? 'muted' : 'brand'}>
            {formatCOP(best.totalCost)}
          </AppText>
          <View style={styles.storeLine}>
            <StoreBadge store={best.store} size={20} />
            <AppText variant="caption" style={{ flexShrink: 1 }}>
              {best.store.name} · {noneArrive ? 'Sin entrega a domicilio' : formatDays(best.deliveryDays)}
            </AppText>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      <View style={styles.meta}>
        {noneArrive && bestWarning ? (
          <Tag icon="alert-circle-outline" tone="danger" label={storeCount > 1 ? `Ninguna tienda lo despacha a ${cityName}` : bestWarning} />
        ) : group.undeliverable > 0 ? (
          <Tag icon="alert-circle-outline" tone="danger" label={`${plural(group.undeliverable, 'tienda no lo despacha', 'tiendas no lo despachan')} a ${cityName}`} />
        ) : null}
        {storeCount > 1 ? (
          <Tag icon="git-compare-outline" label={`Comparado en ${plural(storeCount, 'tienda', 'tiendas')}`} />
        ) : (
          <Tag icon="storefront-outline" label="Solo en 1 tienda" tone="muted" />
        )}
        {group.savings > 0 ? <Tag icon="trending-down" label={`Ahorras hasta ${formatCOP(group.savings)}`} tone="leaf" /> : null}
      </View>
    </PressableCard>
  );
});

const styles = StyleSheet.create({
  card: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  info: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth },
  bottom: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  storeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4 },
});
