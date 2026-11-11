import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/palette';

/** Barra de búsqueda tipo "pill" con sombra cálida. Busca al confirmar en el teclado. */
export function SearchBar({
  initialValue = '',
  onSubmit,
  autoFocus,
  placeholder = 'Busca un producto: "iphone 15", "freidora"…',
}: {
  initialValue?: string;
  onSubmit: (query: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const { colors, radius, shadow } = useTheme();
  const [value, setValue] = useState(initialValue);

  const submit = () => {
    const q = value.trim();
    if (q.length > 0) onSubmit(q);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderRadius: radius.pill, borderColor: colors.border }, shadow(2)]}>
      <Ionicons name="search" size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Buscar producto"
        accessibilityHint="Escribe el producto y confirma para comparar en todas las tiendas"
        maxFontSizeMultiplier={1.6}
        style={[styles.input, { color: colors.text }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => setValue('')}
          accessibilityRole="button"
          accessibilityLabel="Borrar texto"
          hitSlop={10}
          style={styles.clear}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 8,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // minWidth: 0 evita que en web el input empuje el botón de borrar fuera de la barra.
  input: { flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 14 },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
