import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { STORES } from '../domain/logistics';
import type { RankedGroup } from '../domain/types';
import { useTheme } from '../theme/ThemeContext';
import { CATEGORY_ICON, CATEGORY_LABEL, formatCOP, formatDays, plural, spokenCOP } from '../utils/format';
import { AppText, IconTile, PressableCard, StoreBadge, Tag, type IconName } from './ui';

/** Tarjeta de resultado: un producto agrupado con su mejor oferta según el criterio. */
export const ProductCard = memo(function ProductCard({ group, onPress }: { group: RankedGroup; onPress: () => void }) {
  const { colors } = useTheme();
  const { best } = group;
  const store = STORES[best.storeId];
  const storeCount = group.offers.length;

  const a11y = [
    group.name,
    `Mejor opción ${spokenCOP(best.totalCost)} con envío en ${store.name}`,
    formatDays(best.deliveryDays),
    `comparado en ${plural(storeCount, 'tienda', 'tiendas')}`,
    group.savings > 0 ? `ahorras hasta ${spokenCOP(group.savings)}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <PressableCard onPress={onPress} accessibilityLabel={a11y} accessibilityHint="Abre la comparación entre tiendas" style={styles.card}>
      <View style={styles.row}>
        <IconTile icon={CATEGORY_ICON[group.category] as IconName} />
        <View style={styles.info}>
          <AppText variant="label" tone="muted">
            {CATEGORY_LABEL[group.category]}
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {group.name}
          </AppText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.bottom}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="muted">
            Total con envío
          </AppText>
          <AppText variant="price" tone="brand">
            {formatCOP(best.totalCost)}
          </AppText>
          <View style={styles.storeLine}>
            <StoreBadge storeId={best.storeId} size={20} />
            <AppText variant="caption" style={{ flexShrink: 1 }}>
              {store.name} · {formatDays(best.deliveryDays)}
            </AppText>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      <View style={styles.meta}>
        <Tag icon="storefront-outline" label={`Comparado en ${plural(storeCount, 'tienda', 'tiendas')}`} tone="muted" />
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
