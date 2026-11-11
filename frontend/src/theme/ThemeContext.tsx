import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, useColorScheme, type ViewStyle } from 'react-native';

import { useAppSelector } from '../store';
import { darkPalette, gradients, lightPalette, radius, spacing, type Palette } from './palette';

/**
 * React Context para el tema visual. El modo elegido vive en Redux
 * (preferencias persistidas); el contexto resuelve "sistema" contra el
 * esquema del dispositivo y expone colores, degradados y sombras ya listos.
 */
export interface Theme {
  isDark: boolean;
  colors: Palette;
  gradients: (typeof gradients)['light'] | (typeof gradients)['dark'];
  spacing: typeof spacing;
  radius: typeof radius;
  /** Sombra cálida en 3 niveles (elevation en Android, shadow* en iOS/web). */
  shadow: (level: 1 | 2 | 3) => ViewStyle;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useAppSelector((s) => s.preferences.themeMode);
  const system = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');

  const theme = useMemo<Theme>(() => {
    const colors = isDark ? darkPalette : lightPalette;
    return {
      isDark,
      colors,
      gradients: isDark ? gradients.dark : gradients.light,
      spacing,
      radius,
      shadow: (level) => {
        const opacity = isDark ? 0.35 : [0, 0.08, 0.12, 0.18][level];
        const blur = [0, 8, 16, 24][level];
        return Platform.select<ViewStyle>({
          android: { elevation: level * 2, shadowColor: colors.shadow },
          default: {
            shadowColor: colors.shadow,
            shadowOpacity: opacity,
            shadowRadius: blur,
            shadowOffset: { width: 0, height: level * 3 },
          },
        })!;
      },
    };
  }, [isDark]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return theme;
}
