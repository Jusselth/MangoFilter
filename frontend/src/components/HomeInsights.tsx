import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Recommendation } from '../api/types';
import { rankGroup } from '../domain/ranking';
import { useAppSelector } from '../store';
import { useGetRecommendationsQuery, useGetTopStoresQuery, useGetTrendingQuery } from '../store/api';
import { useTheme } from '../theme/ThemeContext';
import { formatCOP, plural, spokenCOP } from '../utils/format';
import { ProductImage } from './ProductImage';
import { AppText, Card, Chip, PressableCard, SectionTitle, Skeleton, StoreBadge } from './ui';

/* -------------------------- Recomendado para ti --------------------------- */

/**
 * Recomendaciones según la actividad REAL del usuario (búsquedas, vistas y
 * guardados). Si no hay actividad, la sección no aparece: nada se inventa.
 */
export function RecommendedSection() {
  const { spacing } = useTheme();
  const city = useAppSelector((s) => s.preferences.city);
  const session = useAppSelector((s) => s.session);
  const hasHistory = useAppSelector((s) => s.history.queries.length > 0);
  const savedIds = useAppSelector((s) => s.saved.items.map((i) => i.id).join('|'));
  const who = session.user?.id ?? 'guest';
  const { data, isLoading, isError } = useGetRecommendationsQuery({ city, who }, { skip: session.status === 'loading' });

  // Los guardados del invitado solo los conoce el dispositivo: se excluyen aquí.
  const items = useMemo(() => {
    const saved = new Set(savedIds.split('|'));
    return (data?.items ?? []).filter((r) => !saved.has(r.group.id));
  }, [data, savedIds]);

  if (isError) return null;
  if (isLoading) {
    return hasHistory ? (
      <View style={{ gap: spacing.sm }}>
        <SectionTitle title="Recomendado para ti" />
        <Skeleton height={150} />
      </View>
    ) : null;
  }
  if (items.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionTitle title="Recomendado para ti" />
      <AppText variant="caption" tone="muted" style={{ marginTop: -8 }}>
        Mejor opción actual en las tiendas, según lo que has buscado y visto.
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md, paddingVertical: 4, paddingRight: spacing.lg }}
        style={{ marginRight: -spacing.lg }}
      >
        {items.map((r) => (
          <RecommendationCard key={r.group.id} rec={r} />
        ))}
      </ScrollView>
    </View>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const criterion = useAppSelector((s) => s.preferences.criterion);
  const ranked = useMemo(() => rankGroup(rec.group, criterion), [rec.group, criterion]);
  const { best } = ranked;

  return (
    <PressableCard
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: rec.group.id, q: rec.query } })}
      accessibilityLabel={`${rec.group.name}. Mejor opción ${spokenCOP(best.totalCost)} en ${best.store.name}. ${rec.reason}.`}
      accessibilityHint="Abre la comparación entre tiendas"
      style={styles.recCard}
    >
      <View style={styles.recTop}>
        <ProductImage uri={rec.group.imageUrl} size={56} label={rec.group.name} />
        <AppText variant="label" numberOfLines={3} style={{ flex: 1 }}>
          {rec.group.name}
        </AppText>
      </View>
      <View style={{ gap: 2 }}>
        <AppText variant="bodyStrong" tone="brand">
          {formatCOP(best.totalCost)}
        </AppText>
        <View style={styles.storeLine}>
          <StoreBadge store={best.store} size={18} />
          <AppText variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
            {best.store.name}
            {ranked.offers.length > 1 ? ` · ${plural(ranked.offers.length, 'tienda', 'tiendas')}` : ''}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" tone="muted" numberOfLines={2}>
        {rec.reason}
      </AppText>
    </PressableCard>
  );
}

/* ----------------------- Lo más buscado en la ciudad ---------------------- */

/** Búsquedas reales más frecuentes en la ciudad (mínimo de personas distintas). */
export function TrendingSection({ onSearch, fallback }: { onSearch: (q: string) => void; fallback: React.ReactNode }) {
  const { spacing } = useTheme();
  const city = useAppSelector((s) => s.preferences.city);
  const cityName = useAppSelector((s) => s.preferences.cityName);
  const { data, isLoading, isError } = useGetTrendingQuery(city);

  if (isError) return <>{fallback}</>;
  if (isLoading) return <Skeleton height={80} />;

  return (
    <>
      <View style={{ gap: spacing.sm }}>
        <SectionTitle title={`Lo más buscado en ${cityName}`} />
        {data && data.queries.length > 0 ? (
          <>
            <View style={styles.wrap}>
              {data.queries.map((t, i) => (
                <Chip
                  key={t.query}
                  label={`${i + 1}. ${t.query}`}
                  icon="trending-up"
                  onPress={() => onSearch(t.query)}
                  accessibilityLabel={`Puesto ${i + 1}: ${t.query}, buscado por ${plural(t.people, 'persona', 'personas')}. Buscar`}
                />
              ))}
            </View>
            <AppText variant="caption" tone="muted">
              Búsquedas reales en MangoFilter de al menos {plural(data.minPeople, 'persona', 'personas')}, últimos {data.days} días.
            </AppText>
          </>
        ) : (
          <AppText variant="caption" tone="muted">
            Aún no hay suficientes búsquedas en {cityName} para mostrar tendencias (cada una debe hacerla al menos{' '}
            {plural(data?.minPeople ?? 3, 'persona', 'personas')}).
          </AppText>
        )}
      </View>
      {data && data.queries.length === 0 ? fallback : null}
    </>
  );
}

/* -------------------------- Tiendas más visitadas ------------------------- */

/** Top de tiendas por "vistas": veces que alguien abrió una oferta hacia la tienda desde MangoFilter. */
export function TopStoresSection() {
  const { colors, spacing, radius } = useTheme();
  const { data, isLoading, isError } = useGetTopStoresQuery();

  if (isError) return null;
  if (isLoading) return <Skeleton height={120} />;
  if (!data) return null;

  const max = Math.max(1, ...data.stores.map((s) => s.views));

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionTitle title="Tiendas más visitadas" />
      {data.stores.length === 0 ? (
        <AppText variant="caption" tone="muted">
          Todavía no hay visitas este mes. Cuando alguien abre una oferta hacia una tienda, esa tienda suma una visita.
        </AppText>
      ) : (
        <Card style={{ padding: 12, gap: 10 }}>
          {data.stores.map((s, i) => (
            <View
              key={s.store.id}
              style={styles.storeRow}
              accessible
              accessibilityLabel={`Puesto ${i + 1}: ${s.store.name}, ${plural(s.views, 'visita', 'visitas')} de ${plural(s.people, 'persona', 'personas')}`}
            >
              <AppText variant="label" tone="muted" style={{ width: 18, textAlign: 'center' }}>
                {i + 1}
              </AppText>
              <StoreBadge store={s.store} size={28} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.storeHead}>
                  <AppText variant="label" style={{ flex: 1 }} numberOfLines={1}>
                    {s.store.name}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {plural(s.views, 'visita', 'visitas')}
                  </AppText>
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
                  <View style={[styles.bar, { width: `${(s.views / max) * 100}%`, backgroundColor: colors.brand, borderRadius: radius.pill }]} />
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}
      <View style={styles.footnote}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
        <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
          Una visita es cuando alguien abre el enlace de una oferta hacia la tienda desde MangoFilter (últimos {data.days} días). No indica
          compras.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recCard: { width: 228, padding: 14, gap: 10 },
  recTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  storeLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  storeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { height: 6, overflow: 'hidden' },
  bar: { height: 6 },
  footnote: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
});
