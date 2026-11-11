import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { STORES } from '../domain/logistics';
import type { Offer } from '../domain/types';
import { useTheme } from '../theme/ThemeContext';
import { formatCOP, formatDays, spokenCOP } from '../utils/format';
import { AppText, Card, StoreBadge, Tag } from './ui';

/**
 * Oferta de una tienda con el desglose transparente del costo:
 * Precio base + Envío = Total. La mejor opción se resalta con borde en
 * degradado Y con una etiqueta de texto (no solo con color).
 */
export function OfferCard({ offer, rank, bestTotal }: { offer: Offer; rank: number; bestTotal: number }) {
  const { colors, gradients, radius } = useTheme();
  const store = STORES[offer.storeId];
  const isBest = rank === 0;
  const diff = offer.totalCost - bestTotal;

  const open = () => void Linking.openURL(offer.url);

  const a11y = `${isBest ? 'Mejor opción. ' : ''}${store.name}: total ${spokenCOP(offer.totalCost)}. Precio ${spokenCOP(offer.basePrice)}, envío ${
    offer.shippingCost === 0 ? 'gratis' : spokenCOP(offer.shippingCost)
  }. ${formatDays(offer.deliveryDays, true)}. ${offer.notes.join(' ')}`;

  const content = (
    <Card elevated={isBest ? 2 : 1} style={[styles.card, isBest && { borderWidth: 0 }]}>
      {/* Resumen agrupado para lectores de pantalla; el enlace queda como control aparte. */}
      <View accessible accessibilityLabel={a11y} style={styles.summary}>
      <View style={styles.header}>
        <StoreBadge storeId={offer.storeId} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{store.name}</AppText>
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {offer.title}
          </AppText>
        </View>
        {isBest ? <Tag icon="ribbon-outline" label="Mejor opción" /> : null}
      </View>

      <View style={styles.totalRow}>
        <View>
          <AppText variant="caption" tone="muted">
            Total con envío
          </AppText>
          <AppText variant="price" tone={isBest ? 'brand' : 'default'}>
            {formatCOP(offer.totalCost)}
          </AppText>
        </View>
        {diff > 0 ? (
          <AppText variant="label" tone="muted">
            +{formatCOP(diff)} vs. mejor
          </AppText>
        ) : null}
      </View>

      <View style={[styles.breakdown, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
        <Line label="Precio" value={formatCOP(offer.basePrice)} strike={offer.listPrice ? formatCOP(offer.listPrice) : undefined} />
        <Line
          label="Envío"
          value={offer.shippingCost === 0 ? 'Gratis' : formatCOP(offer.shippingCost)}
          highlight={offer.shippingCost === 0}
        />
        <View style={styles.lineRow}>
          <Ionicons name="time-outline" size={15} color={colors.textMuted} />
          <AppText variant="caption" style={{ flex: 1 }}>
            {formatDays(offer.deliveryDays, true)}
          </AppText>
        </View>
      </View>

      {offer.notes.map((note) => (
        <View key={note} style={styles.lineRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
          <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
            {note}
          </AppText>
        </View>
      ))}
      </View>

      <Pressable
        onPress={open}
        accessibilityRole="link"
        accessibilityLabel={`Ver en ${store.name}`}
        accessibilityHint="Abre la tienda en el navegador"
        style={({ pressed }) => [styles.link, { borderColor: colors.border, borderRadius: radius.pill, opacity: pressed ? 0.6 : 1 }]}
      >
        <AppText variant="label" tone="brand">
          Ver en {store.name}
        </AppText>
        <Ionicons name="open-outline" size={15} color={colors.brandStrong} />
      </Pressable>
    </Card>
  );

  return (
    <View>
      {isBest ? (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg + 2, padding: 2 }}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </View>
  );
}

function Line({ label, value, strike, highlight }: { label: string; value: string; strike?: string; highlight?: boolean }) {
  return (
    <View style={styles.lineRow}>
      <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      {strike ? (
        <AppText variant="caption" tone="muted" style={{ textDecorationLine: 'line-through' }} accessibilityLabel={`Antes ${strike}`}>
          {strike}
        </AppText>
      ) : null}
      <AppText variant="label" tone={highlight ? 'leaf' : 'default'}>
        {highlight ? '✓ ' : ''}
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  summary: { gap: 12 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  breakdown: { padding: 12, gap: 6 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: {
    minHeight: 44,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
