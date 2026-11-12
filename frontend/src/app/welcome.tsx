import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Card, GradientButton, IconTile, SegmentedControl, StoreBadge, Tag, TextButton, type IconName } from '../components/ui';
import { CRITERIA } from '../domain/ranking';
import { useAccountPrompt } from '../hooks/useAccountPrompt';
import { useHaptics } from '../hooks/useHaptics';
import { TERMS_SUMMARY } from '../legal';
import { useAppDispatch, useAppSelector } from '../store';
import { useGetStoresQuery } from '../store/api';
import { TERMS_VERSION, termsAccepted } from '../store/slices/onboardingSlice';
import { setCriterion } from '../store/slices/preferencesSlice';
import { useTheme } from '../theme/ThemeContext';

type PageId = 'intro' | 'features' | 'tour-search' | 'tour-compare' | 'terms';
const PAGES: PageId[] = ['intro', 'features', 'tour-search', 'tour-compare', 'terms'];

/**
 * Bienvenida de la primera vez: para qué sirve la app, qué hace, un mini tour
 * de cómo usarla y, al final, el aviso de edad y la exención de responsabilidad,
 * que hay que aceptar para entrar (se guarda en el dispositivo con la versión
 * de los términos).
 *
 * Al aceptar, si la persona no tiene cuenta, se abre la invitación a crearla
 * (`account-prompt`).
 *
 * Con `?replay=1` (desde Inicio o Ajustes) se repite el tour; si ya se
 * aceptaron los términos, la última página solo los recuerda.
 */
export default function WelcomeScreen() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dispatch = useAppDispatch();
  const haptic = useHaptics();
  const showAccountPrompt = useAccountPrompt();
  const alreadyAccepted = useAppSelector((s) => s.onboarding.termsVersion >= TERMS_VERSION);
  const listRef = useRef<FlatList<PageId>>(null);
  const [index, setIndex] = useState(0);
  const [isAdult, setIsAdult] = useState(false);
  const [understands, setUnderstands] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLast = index === PAGES.length - 1;
  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(PAGES.length - 1, i));
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) {
      haptic();
      setIndex(i);
    }
  };

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const finish = () => {
    if (alreadyAccepted) return leave();
    if (!isAdult || !understands) {
      setError('Para continuar, confirma las dos casillas.');
      return;
    }
    haptic('success');
    dispatch(termsAccepted({ version: TERMS_VERSION, at: new Date().toISOString() }));
    router.replace('/');
    // Al terminar el tour se invita a crear cuenta (solo si es invitado y las cuentas están activas).
    showAccountPrompt('welcome');
  };

  const renderPage = ({ item }: { item: PageId }) => (
    <ScrollView
      style={{ width }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg }}
      showsVerticalScrollIndicator={false}
    >
      {item === 'intro' ? <IntroPage /> : null}
      {item === 'features' ? <FeaturesPage /> : null}
      {item === 'tour-search' ? <TourSearchPage /> : null}
      {item === 'tour-compare' ? <TourComparePage /> : null}
      {item === 'terms' ? (
        <TermsPage
          alreadyAccepted={alreadyAccepted}
          isAdult={isAdult}
          understands={understands}
          onToggleAdult={() => {
            setIsAdult((v) => !v);
            setError(null);
          }}
          onToggleUnderstands={() => {
            setUnderstands((v) => !v);
            setError(null);
          }}
          error={error}
        />
      ) : null}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={[styles.topBar, { paddingHorizontal: spacing.lg }]}>
        <AppText variant="label" tone="muted">
          {index + 1} de {PAGES.length}
        </AppText>
        {replay && alreadyAccepted ? (
          <TextButton label="Cerrar" icon="close" onPress={leave} />
        ) : !isLast ? (
          <TextButton label="Saltar tour" onPress={() => goTo(PAGES.length - 1)} />
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(p) => p}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        extraData={[isAdult, understands, error, alreadyAccepted, width]}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      />

      <View style={[styles.footer, { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.md, borderTopColor: colors.border }]}>
        <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel={`Paso ${index + 1} de ${PAGES.length}`}>
          {PAGES.map((p, i) => (
            <Pressable key={p} onPress={() => goTo(i)} hitSlop={6} accessibilityLabel={`Ir al paso ${i + 1}`} accessibilityRole="button">
              <View
                style={[
                  styles.dot,
                  { backgroundColor: i === index ? colors.brand : colors.border, width: i === index ? 22 : 8 },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <View style={styles.footerButtons}>
          {index > 0 ? <TextButton label="Atrás" icon="chevron-back" onPress={() => goTo(index - 1)} /> : <View />}
          <GradientButton
            label={isLast ? (alreadyAccepted ? 'Volver a la app' : 'Aceptar y empezar') : 'Siguiente'}
            icon={isLast ? 'checkmark' : 'arrow-forward'}
            onPress={isLast ? finish : () => goTo(index + 1)}
            style={{ flexShrink: 1 }}
          />
        </View>
      </View>
    </View>
  );
}

/* --------------------------------- Páginas -------------------------------- */

function PageHeader({ icon, kicker, title, text }: { icon: IconName; kicker?: string; title: string; text: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(320).reduceMotion(ReduceMotion.System)} style={{ gap: 10 }}>
      <IconTile icon={icon} size={64} />
      {kicker ? (
        <AppText variant="label" tone="brand">
          {kicker}
        </AppText>
      ) : null}
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      <AppText tone="muted" style={{ lineHeight: 23 }}>
        {text}
      </AppText>
    </Animated.View>
  );
}

function IntroPage() {
  const { colors, gradients, radius, spacing } = useTheme();
  const stores = useGetStoresQuery();
  return (
    <>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { borderRadius: radius.xl }]}>
        <View style={[styles.logo, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
          <Ionicons name="leaf" size={26} color="#2E7D32" />
        </View>
        <AppText variant="display" accessibilityRole="header" style={{ color: colors.onHero }}>
          Te damos la bienvenida a MangoFilter
        </AppText>
        <AppText style={{ color: colors.onHero, opacity: 0.9, lineHeight: 23 }}>
          Compara el mismo producto en varias tiendas colombianas y descubre cuánto te cuesta de verdad, con el envío a tu ciudad incluido.
        </AppText>
      </LinearGradient>

      <Animated.View entering={FadeInDown.delay(120).duration(320).reduceMotion(ReduceMotion.System)} style={{ gap: spacing.sm }}>
        <AppText variant="heading">¿Para qué sirve?</AppText>
        <AppText style={{ lineHeight: 23 }}>
          Para no tener que abrir cinco páginas antes de comprar. Escribes lo que buscas una sola vez y MangoFilter consulta las tiendas en vivo, filtra
          las ofertas y te dice cuál te conviene más.
        </AppText>
      </Animated.View>

      {stores.data && stores.data.length > 0 ? (
        <Animated.View entering={FadeIn.delay(220).duration(320).reduceMotion(ReduceMotion.System)} style={{ gap: spacing.sm }}>
          <AppText variant="label" tone="muted">
            Hoy comparamos en
          </AppText>
          <View style={styles.wrap}>
            {stores.data.map((s) => (
              <View key={s.id} style={styles.storeRow}>
                <StoreBadge store={s} size={26} />
                <AppText variant="label">{s.name}</AppText>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : null}
    </>
  );
}

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'cash-outline', title: 'El costo total real', text: 'Precio + envío cotizado por la propia tienda para tu ciudad. Nada de sorpresas al pagar.' },
  { icon: 'git-compare-outline', title: 'El mismo producto, lado a lado', text: 'Juntamos las ofertas del mismo modelo en distintas tiendas para que las compares.' },
  { icon: 'ribbon-outline', title: 'La mejor opción para ti', text: 'Según lo que prefieras: el menor precio, lo que llega antes o un equilibrio.' },
  { icon: 'alert-circle-outline', title: 'Avisos honestos', text: 'Si una tienda no despacha a tu ciudad o no respondió, te lo decimos.' },
];

function FeaturesPage() {
  const { colors, spacing } = useTheme();
  return (
    <>
      <PageHeader icon="sparkles-outline" title="Qué hace MangoFilter" text="Filtra y ordena las ofertas reales de las tiendas para que decidas rápido." />
      <View style={{ gap: spacing.md }}>
        {FEATURES.map((f, i) => (
          <Animated.View key={f.title} entering={FadeInDown.delay(100 + i * 80).duration(300).reduceMotion(ReduceMotion.System)}>
            <Card style={styles.feature}>
              <View style={[styles.featureIcon, { backgroundColor: colors.brandSoft }]}>
                <Ionicons name={f.icon} size={20} color={colors.brandStrong} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">{f.title}</AppText>
                <AppText variant="caption" tone="muted">
                  {f.text}
                </AppText>
              </View>
            </Card>
          </Animated.View>
        ))}
      </View>
    </>
  );
}

/** Paso numerado del tour con una "maqueta" de la parte de la app que explica. */
function TourStep({ n, title, text, children, delay = 0 }: { n: number; title: string; text: string; children?: ReactNode; delay?: number }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(100 + delay).duration(300).reduceMotion(ReduceMotion.System)} style={{ gap: spacing.sm }}>
      <View style={styles.stepHead}>
        <View style={[styles.stepNumber, { backgroundColor: colors.brand, borderRadius: radius.pill }]}>
          <AppText variant="label" tone="onBrand">
            {n}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" tone="muted">
            {text}
          </AppText>
        </View>
      </View>
      {children ? <View style={{ marginLeft: 38 }}>{children}</View> : null}
    </Animated.View>
  );
}

function TourSearchPage() {
  const { colors, radius, shadow, spacing } = useTheme();
  const cityName = useAppSelector((s) => s.preferences.cityName);
  return (
    <>
      <PageHeader icon="search-outline" kicker="Mini tour · 1 de 2" title="Busca y ajusta" text="Así se encuentra un producto en todas las tiendas a la vez." />
      <View style={{ gap: spacing.lg }}>
        <TourStep n={1} title="Escribe el producto y toca la lupa" text='Usa la marca o el modelo para mejores resultados: "licuadora oster", "tv samsung 55".'>
          {/* Maqueta ilustrativa (no interactiva) de la barra de búsqueda. */}
          <View
            accessible
            accessibilityLabel="Ejemplo de la barra de búsqueda"
            style={[styles.mockBar, { backgroundColor: colors.surface, borderColor: colors.brand, borderRadius: radius.pill }, shadow(1)]}
          >
            <View style={[styles.mockSearchIcon, { backgroundColor: colors.brand, borderRadius: radius.pill }]}>
              <Ionicons name="search" size={16} color={colors.onBrand} />
            </View>
            <AppText style={{ flex: 1 }}>licuadora oster</AppText>
            <Ionicons name="hand-left-outline" size={18} color={colors.brandStrong} style={{ transform: [{ rotate: '-20deg' }] }} />
          </View>
        </TourStep>
        <TourStep n={2} title="Elige tu ciudad de entrega" text="El envío, los días de entrega y algunos precios cambian según la ciudad." delay={80}>
          <View style={styles.mockCity}>
            <Ionicons name="location-outline" size={16} color={colors.brandStrong} />
            <AppText variant="label" tone="muted">
              Enviar a{' '}
              <AppText variant="label" tone="brand">
                {cityName}
              </AppText>
            </AppText>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </View>
        </TourStep>
        <TourStep n={3} title="Filtra si lo necesitas" text="Con el embudo de los resultados: presupuesto máximo, días de entrega, envío gratis y tiendas." delay={160}>
          <View style={styles.wrap}>
            <Tag icon="wallet-outline" tone="muted" label="Presupuesto" />
            <Tag icon="time-outline" tone="muted" label="Llega en 2 días" />
            <Tag icon="gift-outline" tone="muted" label="Envío gratis" />
          </View>
        </TourStep>
      </View>
    </>
  );
}

function TourComparePage() {
  const { colors, radius, spacing } = useTheme();
  const dispatch = useAppDispatch();
  const criterion = useAppSelector((s) => s.preferences.criterion);
  return (
    <>
      <PageHeader icon="git-compare-outline" kicker="Mini tour · 2 de 2" title="Compara y decide" text="Abre un producto para ver todas sus ofertas, de la mejor a la peor." />
      <View style={{ gap: spacing.lg }}>
        <TourStep n={4} title="¿Qué priorizas?" text="Pruébalo aquí: queda guardado y lo puedes cambiar cuando quieras." delay={0}>
          <SegmentedControl accessibilityLabel="Elegir la mejor opción por" options={CRITERIA} value={criterion} onChange={(c) => dispatch(setCriterion(c))} />
        </TourStep>
        <TourStep n={5} title="Mira el costo total" text='La "Mejor opción" se marca con borde y etiqueta. El total ya incluye el envío.' delay={80}>
          <View style={[styles.mockBreakdown, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
            <MockLine label="Precio" value="lo que cobra la tienda" />
            <MockLine label="+ Envío" value="cotizado a tu ciudad" />
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
            <MockLine label="= Total" value="lo que realmente pagas" strong />
          </View>
        </TourStep>
        <TourStep n={6} title="Compra en la tienda" text='"Ver en {tienda}" abre la publicación exacta. La compra y el pago se hacen allá, no en MangoFilter.' delay={160}>
          <View style={[styles.mockLink, { borderColor: colors.border, borderRadius: radius.pill }]}>
            <AppText variant="label" tone="brand">
              Ver en la tienda
            </AppText>
            <Ionicons name="open-outline" size={15} color={colors.brandStrong} />
          </View>
        </TourStep>
        <TourStep n={7} title="Guarda y vigila el precio" text="Toca el corazón y en Guardados verás si el precio bajó o subió." delay={240}>
          <View style={styles.wrap}>
            <Ionicons name="heart" size={22} color={colors.brandStrong} />
            <Tag icon="trending-down" tone="leaf" label="Bajó de precio" />
          </View>
        </TourStep>
      </View>
    </>
  );
}

function MockLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.mockLine}>
      <AppText variant={strong ? 'bodyStrong' : 'label'} style={{ width: 72 }}>
        {label}
      </AppText>
      <AppText variant="caption" tone={strong ? 'brand' : 'muted'} style={{ flex: 1 }}>
        {value}
      </AppText>
    </View>
  );
}

function TermsPage({
  alreadyAccepted,
  isAdult,
  understands,
  onToggleAdult,
  onToggleUnderstands,
  error,
}: {
  alreadyAccepted: boolean;
  isAdult: boolean;
  understands: boolean;
  onToggleAdult: () => void;
  onToggleUnderstands: () => void;
  error: string | null;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <>
      <PageHeader
        icon="shield-checkmark-outline"
        title="Antes de empezar"
        text="MangoFilter solo te ayuda a comparar y filtrar. Es importante que tengas claro lo siguiente:"
      />
      <Card elevated={0} style={{ padding: 16, gap: 10, backgroundColor: colors.surfaceAlt }}>
        {TERMS_SUMMARY.map((line) => (
          <View key={line} style={styles.bullet}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.brandStrong} style={{ marginTop: 2 }} />
            <AppText style={{ flex: 1, lineHeight: 22 }}>{line}</AppText>
          </View>
        ))}
      </Card>
      <TextButton icon="document-text-outline" label="Leer los términos completos" onPress={() => router.push('/terms')} />

      {alreadyAccepted ? (
        <View style={styles.bullet}>
          <Ionicons name="checkmark-done" size={18} color={colors.leaf} />
          <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
            Ya aceptaste estos términos en este dispositivo.
          </AppText>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Checkbox
            checked={isAdult}
            onToggle={onToggleAdult}
            label="Tengo 18 años o más, o uso MangoFilter con la supervisión de mi padre, madre o acudiente."
          />
          <Checkbox
            checked={understands}
            onToggle={onToggleUnderstands}
            label="Entiendo que MangoFilter no vende productos: las compras las hago directamente en cada tienda y MangoFilter no es responsable de ellas."
          />
          {error ? (
            <View accessibilityLiveRegion="assertive" style={[styles.error, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <AppText variant="caption" tone="danger" style={{ flex: 1 }}>
                {error}
              </AppText>
            </View>
          ) : null}
        </View>
      )}
    </>
  );
}

function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.checkRow,
        { borderColor: checked ? colors.brand : colors.border, backgroundColor: checked ? colors.brandSoft : colors.surface, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? colors.brandStrong : colors.textMuted} />
      <AppText variant="caption" style={{ flex: 1, lineHeight: 20 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  hero: { padding: 20, gap: 10 },
  logo: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 },
  feature: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center' },
  featureIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNumber: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  mockBar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingLeft: 5, paddingRight: 14, borderWidth: 1 },
  mockSearchIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  mockCity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mockBreakdown: { padding: 12, gap: 6 },
  mockLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mockLink: { minHeight: 40, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 18 },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkRow: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderWidth: 1, minHeight: 56 },
  error: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-start' },
  footer: { paddingTop: 12, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  footerButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
