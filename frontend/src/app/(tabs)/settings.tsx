import { router } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { AccountSection } from '../../components/AccountSection';
import { CityList } from '../../components/CityList';
import { TabScreen } from '../../components/TabScreen';
import { AppText, Card, SectionTitle, SegmentedControl, TextButton } from '../../components/ui';
import { CRITERIA } from '../../domain/ranking';
import { API_URL } from '../../config';
import { useAppDispatch, useAppSelector } from '../../store';
import { api } from '../../store/api';
import { clearHistory } from '../../store/slices/historySlice';
import { setCity, setCriterion, setHaptics, setThemeMode, type ThemeMode } from '../../store/slices/preferencesSlice';
import { useTheme } from '../../theme/ThemeContext';

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function SettingsScreen() {
  const { colors, spacing } = useTheme();
  const dispatch = useAppDispatch();
  const prefs = useAppSelector((s) => s.preferences);
  const historyCount = useAppSelector((s) => s.history.queries.length);

  return (
    <TabScreen title="Ajustes">
      <AccountSection />

      <View style={{ gap: spacing.sm }}>
        <SectionTitle title="Ciudad de entrega" />
        <CityList value={prefs.city} onChange={(c) => dispatch(setCity({ id: c.id, name: c.name }))} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionTitle title="¿Qué priorizas al comparar?" />
        <SegmentedControl accessibilityLabel="Criterio de comparación" options={CRITERIA} value={prefs.criterion} onChange={(c) => dispatch(setCriterion(c))} />
        <AppText variant="caption" tone="muted">
          {prefs.criterion === 'precio'
            ? 'Siempre el menor costo total (precio + envío).'
            : prefs.criterion === 'rapidez'
              ? 'Prioriza lo que llega antes, aunque cueste un poco más.'
              : 'Balancea costo total y tiempo de entrega por igual.'}
        </AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionTitle title="Apariencia" />
        <SegmentedControl accessibilityLabel="Tema" options={THEMES} value={prefs.themeMode} onChange={(m) => dispatch(setThemeMode(m))} />
      </View>

      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">Vibración al tocar</AppText>
          <AppText variant="caption" tone="muted">
            Respuesta háptica sutil al cambiar opciones o guardar.
          </AppText>
        </View>
        <Switch
          value={prefs.haptics}
          onValueChange={(v) => {
            dispatch(setHaptics(v));
          }}
          trackColor={{ true: colors.brand, false: colors.border }}
          thumbColor={colors.surface}
          accessibilityLabel="Vibración al tocar"
        />
      </Card>

      <View style={{ gap: spacing.xs }}>
        <SectionTitle title="Datos" />
        <TextButton
          icon="time-outline"
          label={historyCount > 0 ? `Borrar historial de búsquedas y visitas (${historyCount})` : 'Borrar historial de búsquedas y visitas'}
          onPress={() => dispatch(clearHistory())}
        />
        <TextButton
          icon="refresh"
          label="Volver a consultar precios"
          onPress={() => dispatch(api.util.resetApiState())}
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <SectionTitle title="Ayuda y legal" />
        <TextButton icon="play-circle-outline" label="Ver de nuevo el tour de bienvenida" onPress={() => router.push({ pathname: '/welcome', params: { replay: '1' } })} />
        <TextButton icon="document-text-outline" label="Términos de uso y exención de responsabilidad" onPress={() => router.push('/terms')} />
        <TextButton icon="shield-checkmark-outline" label="Aviso de privacidad" onPress={() => router.push('/privacy')} />
      </View>

      <Card elevated={0} style={{ padding: 16, gap: 6, backgroundColor: colors.surfaceAlt }}>
        <AppText variant="bodyStrong">Acerca de MangoFilter</AppText>
        <AppText variant="caption" tone="muted">
          Proyecto académico — Ingeniería Informática, Universidad de La Sabana. Los precios, envíos y enlaces se consultan en vivo en las
          tiendas a través de sus APIs públicas; pueden cambiar sin previo aviso, así que confirma siempre en la tienda antes de pagar.
          MangoFilter no vende productos ni procesa pagos: las compras se hacen directamente en cada tienda. Dirigida a mayores de 18 años.
        </AppText>
        <AppText variant="caption" tone="muted" selectable>
          Servidor: {API_URL}
        </AppText>
      </Card>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
});
