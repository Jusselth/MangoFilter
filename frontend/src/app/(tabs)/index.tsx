import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecommendedSection, TopStoresSection, TrendingSection } from '../../components/HomeInsights';
import { SearchBar, type Suggestion } from '../../components/SearchBar';
import { AppText, Chip, SectionTitle, Skeleton, StoreBadge, TextButton } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store';
import { describeApiError, useGetStoresQuery, useGetTrendingQuery } from '../../store/api';
import { addQuery, clearHistory } from '../../store/slices/historySlice';
import { useTheme } from '../../theme/ThemeContext';

/** Ideas de búsqueda (solo texto de ayuda, cuando aún no hay tendencias reales; los resultados siempre vienen de las tiendas). */
const IDEAS = ['freidora de aire', 'televisor samsung', 'audífonos sony', 'licuadora oster', 'portátil lenovo', 'nevera'];

export default function HomeScreen() {
  const { colors, gradients, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const cityName = useAppSelector((s) => s.preferences.cityName);
  const history = useAppSelector((s) => s.history.queries);
  const city = useAppSelector((s) => s.preferences.city);
  const stores = useGetStoresQuery();
  // Misma consulta que "Lo más buscado" (RTK Query la comparte): alimenta las sugerencias al escribir.
  const trending = useGetTrendingQuery(city);

  const suggestions = useMemo<Suggestion[]>(
    () => [
      ...history.map((query) => ({ query, icon: 'time-outline' as const })),
      ...(trending.data?.queries ?? []).map((t) => ({ query: t.query, icon: 'trending-up' as const })),
      ...IDEAS.map((query) => ({ query, icon: 'sparkles-outline' as const })),
    ],
    [history, trending.data],
  );

  /** Entrada sutil del contenido (respeta "reducir movimiento" del sistema). */
  const enter = (i: number) => FadeInDown.delay(80 + i * 70).duration(320).reduceMotion(ReduceMotion.System);

  const search = (q: string) => {
    dispatch(addQuery(q));
    router.push({ pathname: '/search', params: { q } });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.xl, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }]}
      >
        <View style={styles.brandRow}>
          <View style={[styles.logo, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
            <Ionicons name="leaf" size={16} color="#2E7D32" />
          </View>
          <AppText variant="heading" style={{ color: colors.onHero, flex: 1 }}>
            MangoFilter
          </AppText>
          <Pressable
            onPress={() => router.push({ pathname: '/welcome', params: { replay: '1' } })}
            accessibilityRole="button"
            accessibilityLabel="Cómo funciona MangoFilter. Ver el tour"
            hitSlop={8}
            style={({ pressed }) => [styles.help, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="help-circle-outline" size={18} color={colors.onHero} />
            <AppText variant="label" style={{ color: colors.onHero }}>
              ¿Cómo funciona?
            </AppText>
          </Pressable>
        </View>
        <AppText variant="display" accessibilityRole="header" style={{ color: colors.onHero }}>
          Compara en todas las tiendas, paga lo justo.
        </AppText>
        <AppText style={{ opacity: 0.85, color: colors.onHero }}>Precios reales + envío a tu ciudad, en un solo lugar.</AppText>
      </LinearGradient>

      <View style={[styles.searchWrap, { paddingHorizontal: spacing.lg }]}>
        <SearchBar onSubmit={search} suggestions={suggestions} placeholder='Busca un producto: "freidora", "tv samsung"…' />
        <Pressable
          onPress={() => router.push('/city')}
          accessibilityRole="button"
          accessibilityLabel={`Enviar a ${cityName}. Cambiar ciudad`}
          style={({ pressed }) => [styles.cityRow, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="location-outline" size={16} color={colors.brandStrong} />
          <AppText variant="label" tone="muted">
            Enviar a{' '}
            <AppText variant="label" tone="brand">
              {cityName}
            </AppText>
          </AppText>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Una sola entrada animada: envolver cada sección dejaría huecos cuando una sección no tiene datos y no se muestra. */}
      <Animated.View entering={enter(0)} style={{ paddingHorizontal: spacing.lg, gap: spacing.xl, marginTop: spacing.lg }}>
        {history.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionTitle title="Búsquedas recientes" action={<TextButton label="Borrar" onPress={() => dispatch(clearHistory())} />} />
            <View style={styles.wrap}>
              {history.map((q) => (
                <Chip key={q} label={q} icon="time-outline" onPress={() => search(q)} accessibilityLabel={`Buscar de nuevo ${q}`} />
              ))}
            </View>
          </View>
        ) : null}

        <RecommendedSection />

        <TrendingSection
          onSearch={search}
          fallback={
            <View style={{ gap: spacing.sm }}>
              <SectionTitle title="Prueba con" />
              <View style={styles.wrap}>
                {IDEAS.map((q) => (
                  <Chip key={q} label={q} icon="sparkles-outline" onPress={() => search(q)} accessibilityLabel={`Buscar ${q}`} />
                ))}
              </View>
            </View>
          }
        />

        <TopStoresSection />

        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Comparamos en" />
          {stores.isLoading ? (
            <Skeleton height={72} />
          ) : stores.isError ? (
            <View style={{ gap: 4 }}>
              <AppText variant="caption" tone="danger">
                {describeApiError(stores.error)}
              </AppText>
              <TextButton label="Reintentar" icon="refresh" onPress={stores.refetch} />
            </View>
          ) : (
            <View style={styles.wrap}>
              {stores.data?.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => void Linking.openURL(s.website)}
                  accessibilityRole="link"
                  accessibilityLabel={`${s.name}, abrir sitio web`}
                  style={({ pressed }) => [styles.store, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <StoreBadge store={s} size={28} />
                  <AppText variant="label">{s.name}</AppText>
                </Pressable>
              ))}
            </View>
          )}
          <AppText variant="caption" tone="muted">
            Precios, envíos y enlaces se consultan en vivo en cada tienda. Pueden cambiar sin previo aviso: confirma siempre en la tienda antes de pagar.
            MangoFilter no vende productos: la compra se hace directamente en cada tienda.{' '}
            <AppText variant="caption" tone="brand" onPress={() => router.push('/terms')} accessibilityRole="link">
              Términos de uso
            </AppText>
          </AppText>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 56, gap: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  help: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingLeft: 8 },
  logo: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { marginTop: -28, gap: 4 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  store: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8, minHeight: 44 },
});
