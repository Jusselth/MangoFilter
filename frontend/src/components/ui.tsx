/**
 * Primitivas visuales de MangoFilter. Todas toman colores del ThemeContext,
 * respetan el escalado de fuente del sistema y garantizan áreas táctiles ≥ 44 pt.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { StoreRef } from '../api/types';
import { readableOn } from '../utils/format';
import { useTheme } from '../theme/ThemeContext';
import { fonts, MIN_TOUCH } from '../theme/palette';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* --------------------------------- Texto --------------------------------- */

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'price';
type Tone = 'default' | 'muted' | 'brand' | 'leaf' | 'onBrand' | 'danger';

const VARIANTS: Record<Variant, { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number }> = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  price: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
};

export function AppText({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const { colors } = useTheme();
  const color = {
    default: colors.text,
    muted: colors.textMuted,
    brand: colors.brandStrong,
    leaf: colors.leaf,
    onBrand: colors.onBrand,
    danger: colors.danger,
  }[tone];
  // maxFontSizeMultiplier alto: se permite ampliar hasta 200% (WCAG 1.4.4).
  return <Text maxFontSizeMultiplier={2} style={[VARIANTS[variant], { color }, style]} {...rest} />;
}

/* --------------------------------- Card ---------------------------------- */

export function Card({ children, style, elevated = 1 }: { children: ReactNode; style?: StyleProp<ViewStyle>; elevated?: 0 | 1 | 2 | 3 }) {
  const { colors, radius, shadow } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        elevated ? shadow(elevated) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Contenedor presionable con retroalimentación sutil de escala/opacidad. */
export function PressableCard({ children, style, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const { colors, radius, shadow } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        shadow(1),
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

/* -------------------------------- Botones -------------------------------- */

export function GradientButton({
  label,
  icon,
  onPress,
  loading,
  style,
  accessibilityHint,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const { colors, gradients, radius, shadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!loading }}
      style={({ pressed }) => [{ borderRadius: radius.pill, opacity: pressed ? 0.9 : 1 }, shadow(2), style]}
    >
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientButton, { borderRadius: radius.pill }]}
      >
        {loading ? (
          <ActivityIndicator color={colors.onBrand} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={18} color={colors.onBrand} /> : null}
            <AppText variant="bodyStrong" tone="onBrand">
              {label}
            </AppText>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function TextButton({ label, onPress, icon, tone = 'brand' }: { label: string; onPress: () => void; icon?: IconName; tone?: Tone }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      {icon ? <Ionicons name={icon} size={16} color={tone === 'danger' ? colors.danger : colors.brandStrong} /> : null}
      <AppText variant="label" tone={tone}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  active,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  active?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={24} color={active ? colors.brandStrong : colors.text} />
    </Pressable>
  );
}

/* --------------------------------- Chips --------------------------------- */

export function Chip({
  label,
  selected,
  onPress,
  icon,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  accessibilityLabel?: string;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radius.pill,
          backgroundColor: selected ? colors.brandSoft : colors.surface,
          borderColor: selected ? colors.brand : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {/* El estado seleccionado se indica con ícono + borde, no solo con color. */}
      {selected ? <Ionicons name="checkmark" size={15} color={colors.brandStrong} /> : icon ? <Ionicons name={icon} size={15} color={colors.textMuted} /> : null}
      <AppText variant="label" tone={selected ? 'brand' : 'default'}>
        {label}
      </AppText>
    </Pressable>
  );
}

/* -------------------------- Control segmentado --------------------------- */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const { colors, radius, shadow, isDark } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.label}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[
              styles.segment,
              { borderRadius: radius.pill },
              selected && [{ backgroundColor: isDark ? colors.brandSoft : colors.surface }, shadow(1)],
            ]}
          >
            <AppText variant="label" tone={selected ? 'default' : 'muted'} numberOfLines={1} style={selected ? { fontFamily: fonts.semibold } : null}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------ Etiquetas -------------------------------- */

export function Tag({ label, icon, tone = 'brand' }: { label: string; icon?: IconName; tone?: 'brand' | 'leaf' | 'muted' }) {
  const { colors, radius } = useTheme();
  const bg = { brand: colors.brandSoft, leaf: colors.leafSoft, muted: colors.surfaceAlt }[tone];
  const fg = { brand: colors.brandStrong, leaf: colors.leaf, muted: colors.textMuted }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg, borderRadius: radius.pill }]}>
      {icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <AppText variant="label" style={{ color: fg, fontSize: 12 }}>
        {label}
      </AppText>
    </View>
  );
}

/** "Logo" textual de la tienda: iniciales sobre su color (decorativo; el nombre siempre va en texto al lado). */
export function StoreBadge({ store, size = 36 }: { store: Pick<StoreRef, 'short' | 'color'>; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        backgroundColor: store.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.36, color: readableOn(store.color) }} maxFontSizeMultiplier={1}>
        {store.short}
      </Text>
    </View>
  );
}

/** Ícono sobre degradado suave, usado como "miniatura" de producto/servicio. */
export function IconTile({ icon, size = 56 }: { icon: IconName; size?: number }) {
  const { colors, gradients } = useTheme();
  return (
    <LinearGradient
      colors={gradients.soft}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 3.2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={size * 0.46} color={colors.brandStrong} />
    </LinearGradient>
  );
}

/* ------------------------------- Estados --------------------------------- */

export function Skeleton({ height, width = '100%', style }: { height: number; width?: ViewStyle['width']; style?: StyleProp<ViewStyle> }) {
  const { colors, radius } = useTheme();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800, reduceMotion: ReduceMotion.System }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ height, width, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm }, animated, style]} />;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty} accessibilityRole="summary">
      <View style={[styles.emptyIcon, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={30} color={colors.brandStrong} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText tone="muted" style={{ textAlign: 'center', maxWidth: 300 }}>
        {message}
      </AppText>
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  gradientButton: {
    minHeight: 52,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  textButton: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmented: { flexDirection: 'row', padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 48 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TOUCH },
});
