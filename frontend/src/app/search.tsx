import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '../components/ProductCard';
import { SearchBar } from '../components/SearchBar';
import { AppText, Card, EmptyState, GradientButton, IconButton, SegmentedControl, Skeleton } from '../components/ui';
import { countActiveFilters, CRITERIA, type RankedGroup } from '../domain/ranking';
import { useHaptics } from '../hooks/useHaptics';
import { useRankedSearch } from '../hooks/useRankedSearch';
import { useAppDispatch, useAppSelector } from '../store';
import { describeApiError } from '../store/api';
import { resetFilters } from '../store/slices/filtersSlice';
import { addQuery } from '../store/slices/historySlice';
import { setCriterion } from '../store/slices/preferencesSlice';
import { useTheme } from '../theme/ThemeContext';
import { plural, timeAgo } from '../utils/format';

export default function SearchScreen() {
  const { q = '' } = useLocalSearchParams<{ q?: string }>();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const haptic = useHaptics();
  const cityName = useAppSelector((s) => s.preferences.cityName);
  const { data, ranked, isFetching, isError, error, refetch, criterion, filters } = useRankedSearch(q);

  const activeFilters = countActiveFilters(filters);
  const failedStores = data?.stores.filter((s) => s.status !== 'ok') ?? [];
  const okStores = data ? data.stores.length - failedStores.length : 0;
  const notShippable = data?.stores.reduce((acc, s) => acc + s.notShippable, 0) ?? 0;
  const totalGroups = data?.groups.length ?? 0;

  const onSearch = (next: string) => {
    dispatch(addQuery(next));
    router.setParams({ q: next });
  };

  const renderItem = useCallback(
    ({ item, index }: { item: RankedGroup; index: number }) => (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 40).duration(260).reduceMotion(ReduceMotion.System)}>
        <ProductCard group={item} onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id, q } })} />
      </Animated.View>
    ),
    [q],
  );

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <View style={{ gap: 6 }}>
        <AppText variant="caption" tone="muted">
          Mejor opción de cada producto según:
        </AppText>
        <SegmentedControl
          accessibilityLabel="Elegir la mejor opción por"
          options={CRITERIA}
          value={criterion}
          onChange={(c) => {
            haptic();
            dispatch(setCriterion(c));
          }}
        />
      </View>
      {data && !isFetching ? (
        <View accessibilityLiveRegion="polite">
          <AppText variant="caption" tone="muted">
            {plural(ranked.length, 'producto', 'productos')}
            {ranked.length !== totalGroups ? ` de ${totalGroups}` : ''} · {okStores} de {data.stores.length} tiendas · {data.city.name} ·{' '}
            {timeAgo(data.fetchedAt)}
          </AppText>
        </View>
      ) : null}
      {data && !isFetching && (failedStores.length > 0 || notShippable > 0) ? (
        <Card elevated={0} style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <View style={{ flex: 1, gap: 2 }}>
            {failedStores.length > 0 ? (
              <AppText variant="caption" tone="muted">
                No respondió: {failedStores.map((s) => s.store.name).join(', ')}. Mostramos lo disponible.
              </AppText>
            ) : null}
            {notShippable > 0 ? (
              <AppText variant="caption" tone="muted">
                {plural(notShippable, 'oferta no llega', 'ofertas no llegan')} a domicilio a {data.city.name}: las marcamos con un aviso
                {filters.hideUndeliverable ? ' y las ocultamos (filtro activo)' : ''}.
              </AppText>
            ) : null}
          </View>
        </Card>
      ) : null}
    </View>
  );

  let body: React.ReactNode = null;
  if (isFetching && !data) {
    body = <LoadingList cityName={cityName} />;
  } else if (isError) {
    body = (
      <EmptyState
        icon="cloud-offline-outline"
        title="No pudimos hacer la búsqueda"
        message={describeApiError(error)}
        action={<GradientButton label="Reintentar" icon="refresh" onPress={refetch} />}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={[styles.topBar, { paddingHorizontal: spacing.sm }]}>
        <IconButton icon="chevron-back" label="Volver" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <SearchBar key={q} initialValue={q} onSubmit={onSearch} />
        </View>
        <Pressable
          onPress={() => router.push('/filters')}
          accessibilityRole="button"
          accessibilityLabel={activeFilters > 0 ? `Filtros, ${activeFilters} activos` : 'Filtros'}
          style={({ pressed }) => [styles.filterButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="funnel-outline" size={22} color={colors.text} />
          {activeFilters > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.brand, borderRadius: radius.pill }]}>
              <AppText variant="label" tone="onBrand" style={{ fontSize: 11, lineHeight: 14 }}>
                {activeFilters}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>

      {body ?? (
        <FlatList
          data={isFetching ? [] : ranked}
          keyExtractor={(g) => g.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={
            isFetching ? (
              <LoadingList cityName={cityName} />
            ) : totalGroups > 0 ? (
              <EmptyState
                icon="funnel-outline"
                title="Ningún producto cumple tus filtros"
                message={`Encontramos ${plural(totalGroups, 'producto', 'productos')}, pero los filtros los ocultan.`}
                action={<GradientButton label="Quitar filtros" icon="close" onPress={() => dispatch(resetFilters())} />}
              />
            ) : (
              <EmptyState
                icon="search-outline"
                title={`Sin resultados para "${q}"`}
                message="Prueba con otra palabra, la marca o el modelo (ej. “licuadora oster”)."
              />
            )
          }
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshing={false}
          onRefresh={refetch}
        />
      )}
    </View>
  );
}

function LoadingList({ cityName }: { cityName: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md, padding: spacing.lg }} accessibilityLabel="Consultando tiendas" accessibilityRole="progressbar">
      <AppText variant="caption" tone="muted">
        Consultando precios y envíos a {cityName} en todas las tiendas…
      </AppText>
      {[0, 1, 2].map((i) => (
        <Card key={i} style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Skeleton height={72} width={72} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton height={14} width="90%" />
              <Skeleton height={14} width="60%" />
            </View>
          </View>
          <Skeleton height={22} width="50%" />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  filterButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-start' },
});
