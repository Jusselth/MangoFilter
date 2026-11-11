import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Chip, GradientButton, SectionTitle, TextButton } from '../components/ui';
import { STORE_IDS, STORES } from '../domain/logistics';
import type { Category } from '../domain/types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  resetFilters,
  setFreeShippingOnly,
  setMaxBudget,
  setMaxDeliveryDays,
  toggleCategory,
  toggleStore,
} from '../store/slices/filtersSlice';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/palette';
import { CATEGORY_LABEL, formatCOP } from '../utils/format';

const BUDGETS = [300_000, 1_000_000, 2_000_000];
const DELIVERY = [
  { label: 'Cualquiera', value: null },
  { label: 'Hasta 2 días', value: 2 },
  { label: 'Hasta 5 días', value: 5 },
  { label: 'Hasta 10 días', value: 10 },
];

/**
 * Filtros aplicados en vivo (sin botón "aplicar" obligatorio). Todo se
 * controla con toques o con un campo numérico: no hay sliders de arrastre,
 * siguiendo la especificación de accesibilidad motriz.
 */
export default function FiltersScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters);
  const [budgetText, setBudgetText] = useState(filters.maxBudget ? String(filters.maxBudget) : '');

  const applyBudget = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setBudgetText(digits);
    dispatch(setMaxBudget(digits ? Number(digits) : null));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          <SectionTitle title="Presupuesto máximo (total con envío)" />
          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md }]}>
            <AppText variant="bodyStrong" tone="muted">
              $
            </AppText>
            <TextInput
              value={budgetText ? formatCOP(Number(budgetText)).slice(1) : ''}
              onChangeText={applyBudget}
              keyboardType="number-pad"
              placeholder="Sin límite"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Presupuesto máximo en pesos"
              style={[styles.input, { color: colors.text }]}
            />
          </View>
          <View style={styles.wrap}>
            {BUDGETS.map((b) => (
              <Chip key={b} label={`Hasta ${formatCOP(b)}`} selected={filters.maxBudget === b} onPress={() => applyBudget(filters.maxBudget === b ? '' : String(b))} />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionTitle title="Tiempo de entrega" />
          <View style={styles.wrap}>
            {DELIVERY.map((d) => (
              <Chip key={d.label} label={d.label} selected={filters.maxDeliveryDays === d.value} onPress={() => dispatch(setMaxDeliveryDays(d.value))} />
            ))}
          </View>
        </View>

        <View style={[styles.switchRow, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md }]}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Solo envío gratis</AppText>
            <AppText variant="caption" tone="muted">
              Oculta las ofertas que cobran envío a tu ciudad.
            </AppText>
          </View>
          <Switch
            value={filters.freeShippingOnly}
            onValueChange={(v) => {
              dispatch(setFreeShippingOnly(v));
            }}
            trackColor={{ true: colors.brand, false: colors.border }}
            thumbColor={colors.surface}
            accessibilityLabel="Solo envío gratis"
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionTitle title="Tiendas" />
          <AppText variant="caption" tone="muted">
            {filters.stores.length === 0 ? 'Incluyendo todas las tiendas.' : 'Solo las tiendas marcadas.'}
          </AppText>
          <View style={styles.wrap}>
            {STORE_IDS.map((id) => (
              <Chip key={id} label={STORES[id].name} selected={filters.stores.includes(id)} onPress={() => dispatch(toggleStore(id))} />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionTitle title="Categorías" />
          <View style={styles.wrap}>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <Chip key={c} label={CATEGORY_LABEL[c]} selected={filters.categories.includes(c)} onPress={() => dispatch(toggleCategory(c))} />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TextButton
          label="Limpiar"
          onPress={() => {
            setBudgetText('');
            dispatch(resetFilters());
          }}
        />
        <GradientButton label="Ver resultados" onPress={() => router.back()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderWidth: 1, minHeight: 52 },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, paddingVertical: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
