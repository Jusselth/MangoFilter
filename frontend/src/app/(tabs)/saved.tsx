import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProductImage } from '../../components/ProductImage';
import { TabScreen } from '../../components/TabScreen';
import { AppText, Card, EmptyState, GradientButton, IconButton, Skeleton } from '../../components/ui';
import { rankGroup } from '../../domain/ranking';
import { useAppDispatch, useAppSelector } from '../../store';
import { useSearchProductsQuery } from '../../store/api';
import { removeSaved, type SavedProduct } from '../../store/slices/savedSlice';
import { useTheme } from '../../theme/ThemeContext';
import { formatCOP, spokenCOP } from '../../utils/format';

/**
 * Guardados: vuelve a consultar las tiendas (con caché) y compara el precio
 * actual con el que había al guardar. La variación se comunica con ícono +
 * texto ("Bajó", "Subió"), no solo con color.
 */
export default function SavedScreen() {
  const items = useAppSelector((s) => s.saved.items);

  return (
    <TabScreen title="Guardados" subtitle="Te mostramos si el mejor precio cambió desde que lo guardaste.">
      {items.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="Aún no guardas productos"
          message="Toca el corazón en la comparación de un producto para seguir su precio."
          action={<GradientButton label="Buscar productos" icon="search" onPress={() => router.navigate('/')} />}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {items.map((item) => (
            <SavedRow key={item.id} item={item} />
          ))}
        </View>
      )}
    </TabScreen>
  );
}

function SavedRow({ item }: { item: SavedProduct }) {
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const city = useAppSelector((s) => s.preferences.city);
  const criterion = useAppSelector((s) => s.preferences.criterion);
  const { data, isFetching, isError } = useSearchProductsQuery({ q: item.query, city });

  const group = useMemo(() => {
    const g = data?.groups.find((x) => x.id === item.id) ?? data?.groups.find((x) => x.offers.some((o) => o.id === item.id));
    return g ? rankGroup(g, criterion) : undefined;
  }, [data, item.id, criterion]);

  const current = group?.best.totalCost;
  const delta = current !== undefined ? current - item.bestTotalAtSave : 0;
  const trend =
    delta < 0
      ? { icon: 'arrow-down' as const, text: `Bajó ${formatCOP(-delta)}`, tone: 'leaf' as const }
      : delta > 0
        ? { icon: 'arrow-up' as const, text: `Subió ${formatCOP(delta)}`, tone: 'danger' as const }
        : { icon: 'remove' as const, text: 'Sin cambios', tone: 'muted' as const };

  const a11y = group
    ? `${item.name}. Mejor opción actual ${spokenCOP(group.best.totalCost)} en ${group.best.store.name}. ${trend.text}.`
    : `${item.name}. ${isFetching ? 'Consultando precio.' : 'No disponible ahora.'}`;

  return (
    // La fila abre el detalle y el botón de borrar es un hermano (no anidado):
    // así ambos son enfocables por lectores de pantalla y el HTML web es válido.
    <Card style={styles.card}>
      <Pressable
        onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id, q: item.query } })}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => [styles.main, { opacity: pressed ? 0.7 : 1 }]}
      >
        <ProductImage uri={item.imageUrl} size={56} label={item.name} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {item.name}
          </AppText>
          {isFetching && !group ? (
            <Skeleton height={14} width="60%" />
          ) : group ? (
            <View style={styles.priceRow}>
              <AppText variant="bodyStrong" tone="brand">
                {formatCOP(group.best.totalCost)}
              </AppText>
              <View style={styles.trend}>
                <Ionicons
                  name={trend.icon}
                  size={14}
                  color={trend.tone === 'leaf' ? colors.leaf : trend.tone === 'danger' ? colors.danger : colors.textMuted}
                />
                <AppText variant="caption" tone={trend.tone}>
                  {trend.text}
                </AppText>
              </View>
            </View>
          ) : (
            <AppText variant="caption" tone="muted">
              {isError ? 'No pudimos consultar ahora' : 'No disponible en tu ciudad ahora'}
            </AppText>
          )}
        </View>
      </Pressable>
      <IconButton icon="trash-outline" label={`Quitar ${item.name} de guardados`} onPress={() => dispatch(removeSaved(item.id))} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
