import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { useHaptics } from '../hooks/useHaptics';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/palette';
import { AppText, type IconName } from './ui';

/** Mínimo de letras que acepta el backend para consultar las tiendas. */
export const MIN_QUERY = 2;
const MAX_SUGGESTIONS = 5;

/** Sugerencia mientras se escribe: viene del historial, de lo más buscado o de las ideas. */
export interface Suggestion {
  query: string;
  icon: IconName;
}

/** Minúsculas y sin tildes, para que "camara" encuentre "cámara". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Barra de búsqueda tipo "pill" con sombra cálida.
 *
 * - Se busca con la tecla del teclado **o tocando la lupa**. Con el campo vacío,
 *   la lupa enfoca el campo; con menos de 2 letras, avisa en vez de buscar.
 * - La lupa se colorea cuando hay texto, para indicar que se puede tocar.
 * - Con `suggestions`, mientras se escribe aparece una lista de búsquedas que
 *   coinciden (sin distinguir tildes ni mayúsculas).
 */
export function SearchBar({
  initialValue = '',
  onSubmit,
  autoFocus,
  placeholder = 'Busca un producto: "iphone 15", "freidora"…',
  suggestions,
}: {
  initialValue?: string;
  onSubmit: (query: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  suggestions?: Suggestion[];
}) {
  const { colors, radius, shadow } = useTheme();
  const haptic = useHaptics();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = useSharedValue(1);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  const pulse = () => {
    scale.value = withSequence(
      withTiming(0.82, { duration: 90, reduceMotion: ReduceMotion.System }),
      withSpring(1, { damping: 9, stiffness: 260, reduceMotion: ReduceMotion.System }),
    );
  };
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const run = (raw: string) => {
    const q = raw.trim();
    if (q.length === 0) {
      setHint('Escribe qué producto quieres comparar.');
      inputRef.current?.focus();
      return;
    }
    if (q.length < MIN_QUERY) {
      setHint(`Escribe al menos ${MIN_QUERY} letras.`);
      return;
    }
    setHint(null);
    setValue(q);
    haptic();
    inputRef.current?.blur();
    setFocused(false);
    onSubmit(q);
  };

  const pressSearch = () => {
    pulse();
    run(value);
  };

  const matches = useMemo(() => {
    const needle = fold(value);
    if (!suggestions || needle.length === 0) return [];
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    for (const s of suggestions) {
      const key = fold(s.query);
      if (key === needle || seen.has(key) || !key.includes(needle)) continue;
      seen.add(key);
      out.push(s);
      if (out.length === MAX_SUGGESTIONS) break;
    }
    return out;
  }, [suggestions, value]);

  const hasText = value.trim().length > 0;
  const showSuggestions = focused && matches.length > 0;

  return (
    <View style={{ gap: 6 }}>
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surface, borderRadius: radius.pill, borderColor: focused ? colors.brand : colors.border },
          shadow(2),
        ]}
      >
        <Pressable
          onPress={pressSearch}
          accessibilityRole="button"
          accessibilityLabel={hasText ? `Buscar ${value.trim()}` : 'Buscar'}
          accessibilityHint="Compara el producto en todas las tiendas"
          hitSlop={6}
          style={({ pressed }) => [styles.searchButton, { borderRadius: radius.pill, opacity: pressed ? 0.7 : 1 }]}
        >
          <Animated.View
            style={[styles.searchIcon, { borderRadius: radius.pill, backgroundColor: hasText ? colors.brand : 'transparent' }, iconStyle]}
          >
            <Ionicons name="search" size={hasText ? 18 : 20} color={hasText ? colors.onBrand : colors.textMuted} />
          </Animated.View>
        </Pressable>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(t) => {
            setValue(t);
            if (hint) setHint(null);
          }}
          onSubmitEditing={() => run(value)}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          // Se espera un instante antes de ocultar las sugerencias para que el toque sobre una alcance a registrarse (web).
          onBlur={() => {
            blurTimer.current = setTimeout(() => setFocused(false), 180);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Buscar producto"
          accessibilityHint="Escribe el producto y toca la lupa o confirma para comparar en todas las tiendas"
          maxFontSizeMultiplier={1.6}
          style={[styles.input, { color: colors.text }]}
        />
        {value.length > 0 ? (
          <Pressable
            onPress={() => {
              setValue('');
              setHint(null);
              inputRef.current?.focus();
            }}
            accessibilityRole="button"
            accessibilityLabel="Borrar texto"
            hitSlop={10}
            style={styles.clear}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {hint ? (
        <Animated.View entering={FadeIn.duration(150)} accessibilityLiveRegion="polite" style={styles.hint}>
          <Ionicons name="information-circle-outline" size={15} color={colors.brandStrong} />
          <AppText variant="caption" tone="brand">
            {hint}
          </AppText>
        </Animated.View>
      ) : null}

      {showSuggestions ? (
        <Animated.View
          entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(100).reduceMotion(ReduceMotion.System)}
          accessibilityLabel="Sugerencias de búsqueda"
          style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, shadow(2)]}
        >
          {matches.map((s, i) => (
            <Pressable
              key={s.query}
              onPress={() => run(s.query)}
              accessibilityRole="button"
              accessibilityLabel={`Buscar ${s.query}`}
              style={({ pressed }) => [
                styles.suggestion,
                { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
            >
              <Ionicons name={s.icon} size={16} color={colors.textMuted} />
              <AppText style={{ flex: 1 }} numberOfLines={1}>
                {s.query}
              </AppText>
              <Ionicons name="arrow-up-outline" size={16} color={colors.textMuted} style={{ transform: [{ rotate: '-45deg' }] }} />
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 8,
    gap: 4,
    borderWidth: 1,
  },
  searchButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  // minWidth: 0 evita que en web el input empuje el botón de borrar fuera de la barra.
  // En web se quita el anillo de foco del navegador (RN no tipa outlineStyle 'none'): el foco ya se indica con el borde naranja de la barra.
  input: { flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 14, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null) },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  suggestions: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 16 },
});
