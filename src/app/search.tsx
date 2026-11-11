import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '../components/ProductCard';
import { SearchBar } from '../components/SearchBar';
import { AppText, Card, EmptyState, GradientButton, IconButton, SegmentedControl, Skeleton } from '../components/ui';
import { getCity, STORES } from '../domain/logistics';
import { countActiveFilters, CRITERION_LABEL } from '../domain/ranking';
import type { Criterion, RankedGroup } from '../domain/types';
import { useHaptics } from '../hooks/useHaptics';
import { useRankedSearch } from '../hooks/useRankedSearch';
import { useAppDispatch } from '../store';
import { addQuery } from '../store/slices/historySlice';
import { resetFilters } from '../store/slices/filtersSlice';
import { setCriterion } from '../store/slices/preferencesSlice';
import { useTheme } from '../theme/ThemeContext';
import { plural } from '../utils/format';

const CRITERIA: { value: Criterion; label: string }[] = (['precio', 'equilibrado', 'rapidez'] as Criterion[]).map((value) => ({
  value,
  label: CRITERION_LABEL[value],
}));

export default function SearchScreen() {
  const { q = '' } = useLocalSearchParams<{ q?: string }>();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const haptic = useHaptics();
  const { data, ranked, isFetching, isError, error, refetch, criterion, city, filters } = useRankedSearch(q);

  const activeFilters = countActiveFilters(filters);
  const failedStores = data?.stores.filter((s) => s.status !== 'ok') ?? [];
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
      <SegmentedControl
        accessibilityLabel="Ordenar por"
        options={CRITERIA}
        value={criterion}
        onChange={(c) => {
          haptic();
          dispatch(setCriterion(c));
        }}
      />
      {data && !isFetching ? (
        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
            {plural(ranked.length, 'producto', 'productos')}
            {ranked.length !== totalGroups ? ` de ${totalGroups}` : ''} · {data.stores.length - failedStores.length} de{' '}
            {data.stores.length} tiendas · {getCity(city).name}
          </AppText>
        </View>
      ) : null}
      {failedStores.length > 0 && !isFetching ? (
        <Card elevated={0} style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.textMuted} />
          <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
            No respondió: {failedStores.map((s) => STORES[s.storeId].name).join(', ')}. Mostramos lo disponible.
          </AppText>
        </Card>
      ) : null}
    </View>
  );

  let body: React.ReactNode = null;
  if (isFetching && !data) {
    body = <LoadingList />;
  } else if (isError) {
    body = (
      <EmptyState
        icon="cloud-offline-outline"
        title="No pudimos consultar las tiendas"
        message={(error as { message?: string })?.message ?? 'Revisa tu conexión e inténtalo de nuevo.'}
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
              <LoadingList />
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
                message="Prueba con otra palabra, la marca o el modelo (ej. “jbl flip 6”)."
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

function LoadingList() {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel="Consultando tiendas" accessibilityRole="progressbar">
      <AppText variant="caption" tone="muted">
        Consultando 5 tiendas en paralelo…
      </AppText>
      {[0, 1, 2].map((i) => (
        <Card key={i} style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Skeleton height={56} width={56} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton height={12} width="40%" />
              <Skeleton height={16} width="90%" />
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
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  notice: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center' },
});
