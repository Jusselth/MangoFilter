import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { IconTile } from './ui';

/**
 * Foto real del producto (servida por la tienda) sobre fondo blanco, porque
 * las fotos de catálogo vienen con fondo blanco y así se ven igual en modo
 * oscuro. Si no hay imagen o falla la carga, muestra un ícono neutro.
 */
export function ProductImage({ uri, size = 72, label }: { uri: string | null; size?: number; label: string }) {
  const { radius } = useTheme();
  const [failed, setFailed] = useState(false);

  if (!uri || failed) return <IconTile icon="cube-outline" size={size} />;

  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: '#FFFFFF', overflow: 'hidden', padding: 4 }}>
      <Image
        source={{ uri }}
        style={{ flex: 1 }}
        contentFit="contain"
        transition={150}
        cachePolicy="memory-disk"
        accessibilityLabel={`Foto de ${label}`}
        onError={() => setFailed(true)}
      />
    </View>
  );
}
