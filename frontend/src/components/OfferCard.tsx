import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import type { Offer } from '../api/types';
import { isDeliverable } from '../domain/ranking';
import { useAppDispatch, useAppSelector } from '../store';
import { api } from '../store/api';
import { useTheme } from '../theme/ThemeContext';
import { availabilityLabel, formatCOP, formatDays, formatShipping, spokenCOP } from '../utils/format';
import { AppText, Card, StoreBadge, Tag } from './ui';

/**
 * Oferta REAL de una tienda con el desglose transparente del costo:
 * Precio base + Envío = Total. La mejor opción se resalta con borde en
 * degradado Y con una etiqueta de texto (no solo con color).
 *
 * Si la tienda no despacha a la ciudad (o solo permite recoger en tienda) se
 * muestra un aviso con ícono y texto, y la oferta nunca es "Mejor opción".
 * Abrir el enlace cuenta como una "vista" de la tienda (estadísticas).
 */
export function OfferCard({ offer, rank, bestTotal, query }: { offer: Offer; rank: number; bestTotal: number; query?: string }) {
  const { colors, gradients, radius } = useTheme();
  const dispatch = useAppDispatch();
  const city = useAppSelector((s) => s.preferences.city);
  const cityName = useAppSelector((s) => s.preferences.cityName);
  const { store } = offer;
  const reachable = isDeliverable(offer);
  const warning = availabilityLabel(offer, cityName);
  const isBest = rank === 0 && reachable;
  const diff = offer.totalCost - bestTotal;

  const open = () => {
    // La vista se registra sin esperar respuesta: abrir la tienda nunca se retrasa.
    void dispatch(
      api.endpoints.logClick.initiate(
        { offerId: offer.id, storeId: store.id, productName: offer.title.slice(0, 300), query: query?.slice(0, 80), city },
        { track: false },
      ),
    );
    void Linking.openURL(offer.url);
  };

  const a11y = `${isBest ? 'Mejor opción. ' : ''}${warning ? `Atención: ${warning}. ` : ''}${store.name}: total ${spokenCOP(offer.totalCost)}. Precio ${spokenCOP(offer.basePrice)}, envío ${
    offer.shippingCost === null ? 'por confirmar' : offer.shippingCost === 0 ? 'gratis' : spokenCOP(offer.shippingCost)
  }. ${reachable ? formatDays(offer.deliveryDays, true) : 'Sin entrega a domicilio'}. ${offer.notes.join(' ')}`;

  const content = (
    <Card elevated={isBest ? 2 : 1} style={[styles.card, isBest && { borderWidth: 0 }]}>
      {/* Resumen agrupado para lectores de pantalla; el enlace queda como control aparte. */}
      <View accessible accessibilityLabel={a11y} style={styles.summary}>
      <View style={styles.header}>
        <StoreBadge store={store} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{store.name}</AppText>
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {offer.title}
          </AppText>
        </View>
        {isBest ? <Tag icon="ribbon-outline" label="Mejor opción" /> : null}
      </View>

      {warning ? <Tag icon={offer.availability === 'pickup' ? 'storefront-outline' : 'alert-circle-outline'} tone="danger" label={warning} /> : null}

      <View style={styles.totalRow}>
        <View>
          <AppText variant="caption" tone="muted">
            {offer.shippingKnown ? 'Total con envío' : warning ? 'Precio (sin envío a tu ciudad)' : 'Precio (envío por confirmar)'}
          </AppText>
          <AppText variant="price" tone={isBest ? 'brand' : warning ? 'muted' : 'default'}>
            {formatCOP(offer.totalCost)}
          </AppText>
        </View>
        {diff > 0 && reachable ? (
          <AppText variant="label" tone="muted">
            +{formatCOP(diff)} vs. mejor
          </AppText>
        ) : null}
      </View>

      <View style={[styles.breakdown, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
        <Line label="Precio" value={formatCOP(offer.basePrice)} strike={offer.listPrice ? formatCOP(offer.listPrice) : undefined} />
        <Line
          label="Envío"
          value={offer.availability === 'pickup' ? 'Solo recogida' : offer.availability === 'no_delivery' ? 'No disponible' : formatShipping(offer)}
          highlight={offer.shippingKnown && offer.shippingCost === 0}
        />
        <View style={styles.lineRow}>
          <Ionicons name="time-outline" size={15} color={colors.textMuted} />
          <AppText variant="caption" style={{ flex: 1 }}>
            {reachable ? formatDays(offer.deliveryDays, true) : 'Sin entrega a domicilio'}
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
        accessibilityHint="Abre la publicación en la tienda"
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
