/**
 * Design tokens — portados do styles/loja.css
 * Mantém a mesma identidade visual (roxo vibrante + amarelo + branco)
 */

export const colors = {
  purple50:  '#F5F3FF',
  purple100: '#EDE9FF',
  purple200: '#DDD6FE',
  purple300: '#C4B5FD',
  purple400: '#A78BFA',
  purple500: '#7C3AED',
  purple600: '#7C3AED',
  purple700: '#6B21A8',
  purple800: '#0D0530',
  purple900: '#06021A',
  purple950: '#03010F',

  yellow:     '#F5A623',
  yellowDark: '#C98200',
  yellowLight:'#FFD166',

  green:      '#16A34A',
  red:        '#DC2626',

  bgApp:        '#FFFFFF',
  bgCard:       '#FFFFFF',
  bgBottomNav:  '#FFFFFF',

  textPrimary:   '#111111',
  textSecondary: '#666677',
  textTertiary:  '#9999AA',
  textOnDark:    '#FFFFFF',
  textOnYellow:  '#1A0840',

  border:       'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.16)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export const typography = {
  // Font family will use system default (San Francisco on iOS, Roboto on Android)
  // To use Inter like the web version, install expo-font in a later step.
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    color: colors.textPrimary,
  },
  cardName: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    lineHeight: 15,
  },
  cardBrand: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: colors.textTertiary,
  },
  cardPrice: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: colors.purple700,
    letterSpacing: -0.3,
  },
};
