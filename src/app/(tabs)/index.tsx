import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchBar } from '../../components/SearchBar';
import { AppText, Chip, SectionTitle, StoreBadge, TextButton } from '../../components/ui';
import { SUGGESTED_QUERIES } from '../../data/seed/catalog';
import { getCity, STORE_IDS, STORES } from '../../domain/logistics';
import { useAppDispatch, useAppSelector } from '../../store';
import { addQuery, clearHistory } from '../../store/slices/historySlice';
import { useTheme } from '../../theme/ThemeContext';

export default function HomeScreen() {
  const { colors, gradients, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const city = useAppSelector((s) => getCity(s.preferences.city));
  const history = useAppSelector((s) => s.history.queries);

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
          <AppText variant="heading" tone="onBrand" style={{ color: colors.onHero }}>
            MangoFilter
          </AppText>
        </View>
        <AppText variant="display" tone="onBrand" accessibilityRole="header" style={{ color: colors.onHero }}>
          Compara en todas las tiendas, paga lo justo.
        </AppText>
        <AppText tone="onBrand" style={{ opacity: 0.85, color: colors.onHero }}>
          Precio + envío a tu ciudad, en un solo lugar.
        </AppText>
      </LinearGradient>

      <View style={[styles.searchWrap, { paddingHorizontal: spacing.lg }]}>
        <SearchBar onSubmit={search} />
        <Pressable
          onPress={() => router.push('/city')}
          accessibilityRole="button"
          accessibilityLabel={`Enviar a ${city.name}. Cambiar ciudad`}
          style={({ pressed }) => [styles.cityRow, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="location-outline" size={16} color={colors.brandStrong} />
          <AppText variant="label" tone="muted">
            Enviar a <AppText variant="label" tone="brand">{city.name}</AppText>
          </AppText>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xl, marginTop: spacing.lg }}>
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

        <View style={{ gap: spacing.sm }}>
          <SectionTitle title="Prueba con" />
          <View style={styles.wrap}>
            {SUGGESTED_QUERIES.map((q) => (
              <Chip key={q} label={q} icon="sparkles-outline" onPress={() => search(q)} accessibilityLabel={`Buscar ${q}`} />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Comparamos en" />
          <View style={styles.wrap}>
            {STORE_IDS.map((id) => (
              <View key={id} style={styles.store} accessible accessibilityLabel={STORES[id].name}>
                <StoreBadge storeId={id} size={28} />
                <AppText variant="label">{STORES[id].name}</AppText>
              </View>
            ))}
          </View>
          <AppText variant="caption" tone="muted">
            Datos de demostración: precios simulados con fines académicos.
          </AppText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 56, gap: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  logo: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { marginTop: -28, gap: 4 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  store: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8, minHeight: 36 },
});
