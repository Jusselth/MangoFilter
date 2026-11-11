/**
 * Paleta "mango": amarillos y naranjas maduros con un verde hoja como acento.
 * Los textos sobre fondos de color usan café oscuro (no blanco) para cumplir
 * contraste WCAG AA: el blanco sobre naranja claro no alcanza 4.5:1.
 */
export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  /** Texto sobre degradado mango (botón principal, hero). */
  onBrand: string;
  /** Texto sobre el degradado del encabezado de inicio. */
  onHero: string;
  brand: string;
  /** Naranja oscuro para precios y enlaces sobre fondo claro (contraste ≥ 4.5:1). */
  brandStrong: string;
  brandSoft: string;
  leaf: string;
  leafSoft: string;
  danger: string;
  shadow: string;
  overlay: string;
  tabBar: string;
}

export const lightPalette: Palette = {
  background: '#FFF9F1',
  surface: '#FFFFFF',
  surfaceAlt: '#FFF1DE',
  border: '#F1E3CF',
  text: '#2A1C0E',
  textMuted: '#6E5B47',
  onBrand: '#2A1C0E',
  onHero: '#2A1C0E',
  brand: '#F59A23',
  brandStrong: '#B4500E',
  brandSoft: '#FFE7C2',
  leaf: '#2E7D32',
  leafSoft: '#E3F2DC',
  danger: '#B3261E',
  shadow: '#B4601A',
  overlay: 'rgba(42, 28, 14, 0.35)',
  tabBar: 'rgba(255, 255, 255, 0.96)',
};

export const darkPalette: Palette = {
  background: '#16100A',
  surface: '#211810',
  surfaceAlt: '#2B2016',
  border: '#3A2C1F',
  text: '#FFF4E6',
  textMuted: '#CDB89F',
  onBrand: '#1F1408',
  onHero: '#FFF4E6',
  brand: '#FFAE45',
  brandStrong: '#FFB766',
  brandSoft: '#3D2A15',
  leaf: '#86CF83',
  leafSoft: '#1E3320',
  danger: '#FF8A80',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  tabBar: 'rgba(33, 24, 16, 0.97)',
};

/** Degradados mango: de amarillo maduro a naranja intenso. */
export const gradients = {
  light: {
    brand: ['#FFD45C', '#FFA931', '#F47B20'] as const,
    soft: ['#FFF4DF', '#FFE6C4'] as const,
    hero: ['#FFE08A', '#FFB443', '#F7862A'] as const,
  },
  dark: {
    brand: ['#FFC24D', '#F99A2E', '#E26B1D'] as const,
    soft: ['#2E2216', '#3A2918'] as const,
    hero: ['#9A5414', '#5A3412', '#1E140B'] as const,
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Mínimo táctil recomendado (WCAG 2.5.8 / guías iOS-Android). */
export const MIN_TOUCH = 44;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
