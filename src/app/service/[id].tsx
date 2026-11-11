import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Card, EmptyState, GradientButton, IconTile, SegmentedControl, Skeleton, Tag, type IconName } from '../../components/ui';
import { rankServiceOffers, type ServiceSort } from '../../domain/ranking';
import type { RankedServiceOffer, Service } from '../../domain/types';
import { useGetServiceOffersQuery } from '../../store/api';
import { useTheme } from '../../theme/ThemeContext';
import { formatCOP, SERVICE_CATEGORY_ICON, spokenCOP } from '../../utils/format';

const SORTS: { value: ServiceSort; label: string }[] = [
  { value: 'precio', label: 'Menor precio' },
  { value: 'neto', label: 'Más valor' },
];

/**
 * Comparación de integradores para un servicio. "Costo neto" descuenta el
 * valor de los otros servicios incluidos en el paquete (si los pagaras aparte).
 */
export default function ServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useGetServiceOffersQuery(id);
  const [sort, setSort] = useState<ServiceSort>('precio');

  const ranked = useMemo(() => (data ? rankServiceOffers(data.offers, data.catalog, sort) : []), [data, sort]);

  if (isLoading) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={80} />
        <Skeleton height={160} />
        <Skeleton height={160} />
      </View>
    );
  }
  if (isError || !data) {
    return <EmptyState icon="alert-circle-outline" title="Servicio no disponible" message="Inténtalo de nuevo." action={<GradientButton label="Reintentar" onPress={refetch} />} />;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}>
      <View style={styles.head}>
        <IconTile icon={SERVICE_CATEGORY_ICON[data.service.category] as IconName} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" accessibilityRole="header">
            {data.service.name}
          </AppText>
          <AppText variant="caption" tone="muted">
            {data.service.description}
          </AppText>
        </View>
      </View>

      <SegmentedControl accessibilityLabel="Ordenar planes por" options={SORTS} value={sort} onChange={setSort} />
      <AppText variant="caption" tone="muted">
        {sort === 'precio'
          ? 'Ordenado por lo que pagas cada mes.'
          : 'Ordenado por costo neto: lo que pagas menos el valor de los otros servicios que incluye el plan.'}
      </AppText>

      {ranked.map((offer, index) => (
        <ServiceOfferCard key={offer.id} offer={offer} best={index === 0} catalog={data.catalog} sort={sort} />
      ))}

      <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
        Integradores y precios de demostración.
      </AppText>
    </ScrollView>
  );
}

function ServiceOfferCard({ offer, best, catalog, sort }: { offer: RankedServiceOffer; best: boolean; catalog: Service[]; sort: ServiceSort }) {
  const { colors, gradients, radius } = useTheme();
  const included = offer.includes.map((sid) => catalog.find((s) => s.id === sid)).filter((s): s is Service => !!s);

  const a11y = `${best ? 'Mejor opción. ' : ''}${offer.provider}, ${offer.planName}. ${spokenCOP(offer.monthlyPrice)} al mes.${
    included.length ? ` Incluye ${included.map((s) => s.name).join(', ')}. Costo neto ${spokenCOP(offer.netCost)}.` : ''
  }${offer.commitmentMonths ? ` Permanencia de ${offer.commitmentMonths} meses.` : ' Sin permanencia.'}`;

  const card = (
    <Card elevated={best ? 2 : 1} style={[styles.card, best && { borderWidth: 0 }]}>
      <View accessible accessibilityLabel={a11y} style={{ gap: 10 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{offer.provider}</AppText>
            <AppText variant="caption" tone="muted">
              {offer.planName}
            </AppText>
          </View>
          {best ? <Tag icon="ribbon-outline" label={sort === 'precio' ? 'Más barato' : 'Más valor'} /> : null}
        </View>

        <View style={styles.row}>
          <AppText variant="price" tone={best ? 'brand' : 'default'}>
            {formatCOP(offer.monthlyPrice)}
            <AppText variant="caption" tone="muted">
              {' '}
              /mes
            </AppText>
          </AppText>
        </View>

        {included.length > 0 ? (
          <View style={[styles.box, { backgroundColor: colors.leafSoft, borderRadius: radius.md }]}>
            {included.map((s) => (
              <View key={s.id} style={styles.line}>
                <Ionicons name="add-circle-outline" size={16} color={colors.leaf} />
                <AppText variant="caption" style={{ flex: 1 }}>
                  Incluye {s.name}
                </AppText>
                <AppText variant="caption" tone="muted">
                  vale {formatCOP(s.standalonePrice)}
                </AppText>
              </View>
            ))}
            <View style={styles.line}>
              <AppText variant="label" tone="leaf" style={{ flex: 1 }}>
                Costo neto del servicio
              </AppText>
              <AppText variant="label" tone="leaf">
                {formatCOP(offer.netCost)}
              </AppText>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 4 }}>
          {offer.benefits.map((b) => (
            <View key={b} style={styles.line}>
              <Ionicons name="checkmark" size={15} color={colors.textMuted} />
              <AppText variant="caption" style={{ flex: 1 }}>
                {b}
              </AppText>
            </View>
          ))}
          <View style={styles.line}>
            <Ionicons name={offer.commitmentMonths ? 'lock-closed-outline' : 'lock-open-outline'} size={15} color={colors.textMuted} />
            <AppText variant="caption" tone="muted">
              {offer.commitmentMonths ? `Permanencia de ${offer.commitmentMonths} meses` : 'Sin permanencia'}
            </AppText>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => void Linking.openURL(offer.url)}
        accessibilityRole="link"
        accessibilityLabel={`Ver plan en ${offer.provider}`}
        style={({ pressed }) => [styles.link, { borderColor: colors.border, borderRadius: radius.pill, opacity: pressed ? 0.6 : 1 }]}
      >
        <AppText variant="label" tone="brand">
          Ver plan
        </AppText>
        <Ionicons name="open-outline" size={15} color={colors.brandStrong} />
      </Pressable>
    </Card>
  );

  return best ? (
    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg + 2, padding: 2 }}>
      {card}
    </LinearGradient>
  ) : (
    card
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  card: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { padding: 12, gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { minHeight: 44, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
