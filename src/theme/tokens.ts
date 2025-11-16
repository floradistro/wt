/**
 * WhaleTools Design System - Design Tokens
 * Apple-inspired design language for POS and all future features
 *
 * Philosophy:
 * - Simplicity: One way to do things
 * - Consistency: Same patterns everywhere
 * - Elegance: Every detail matters
 */

import { Dimensions } from 'react-native'

const { width } = Dimensions.get('window')

/**
 * Device Classification
 */
export const device = {
  isTablet: width > 600,
  width,
} as const

/**
 * Colors - Dark mode first (Apple philosophy)
 * Using semantic names for maintainability
 */
export const colors = {
  // Backgrounds
  background: {
    primary: '#000000',          // Pure black (OLED-friendly)
    secondary: 'rgba(0,0,0,0.4)',
    tertiary: 'rgba(0,0,0,0.85)',
  },

  // Glass/Blur Effects (iOS liquid glass)
  glass: {
    ultraThin: 'rgba(255,255,255,0.02)',
    thin: 'rgba(255,255,255,0.03)',
    regular: 'rgba(255,255,255,0.08)',
    thick: 'rgba(255,255,255,0.12)',
    ultraThick: 'rgba(255,255,255,0.15)',
  },

  // Borders
  border: {
    subtle: 'rgba(255,255,255,0.06)',
    regular: 'rgba(255,255,255,0.1)',
    emphasis: 'rgba(255,255,255,0.12)',
    strong: 'rgba(255,255,255,0.15)',
    hairline: 'rgba(255,255,255,0.1)',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.95)',
    tertiary: 'rgba(255,255,255,0.8)',
    quaternary: 'rgba(255,255,255,0.7)',
    disabled: 'rgba(255,255,255,0.5)',
    subtle: 'rgba(255,255,255,0.4)',
    ghost: 'rgba(255,255,255,0.25)',
    placeholder: 'rgba(255,255,255,0.3)',
  },

  // Semantic Colors
  semantic: {
    success: '#10b981',           // Green
    successBg: 'rgba(16,185,129,0.08)',
    successBorder: 'rgba(16,185,129,0.3)',
    successLight: 'rgba(16,185,129,0.05)',

    error: 'rgba(255,60,60,0.95)',
    errorBg: 'rgba(239,68,68,0.1)',
    errorBorder: 'rgba(239,68,68,0.3)',
    errorLight: 'rgba(255,80,80,0.95)',

    warning: 'rgba(251,191,36,0.95)',
    warningBg: 'rgba(251,191,36,0.1)',
    warningBorder: 'rgba(251,191,36,0.3)',

    info: 'rgba(100,200,255,0.95)',
    infoBg: 'rgba(100,200,255,0.15)',
    infoBorder: 'rgba(100,200,255,0.3)',
  },

  // Interactive States
  interactive: {
    default: 'rgba(255,255,255,0.08)',
    hover: 'rgba(255,255,255,0.12)',
    active: 'rgba(255,255,255,0.15)',
    disabled: 'rgba(255,255,255,0.03)',
  },
} as const

/**
 * Typography - Apple San Francisco style
 * Following iOS Human Interface Guidelines
 */
export const typography = {
  // Display Text (Hero sections)
  display: {
    fontSize: 34,
    fontWeight: '300' as const,
    letterSpacing: -0.5,
    lineHeight: 40,
  },

  // Titles
  title: {
    large: {
      fontSize: 28,
      fontWeight: '600' as const,
      letterSpacing: -0.4,
      lineHeight: 34,
    },
    medium: {
      fontSize: 24,
      fontWeight: '200' as const,
      letterSpacing: -0.4,
      lineHeight: 30,
    },
    small: {
      fontSize: 18,
      fontWeight: '300' as const,
      letterSpacing: 0.5,
      lineHeight: 24,
    },
  },

  // Body Text
  body: {
    large: {
      fontSize: 17,
      fontWeight: '500' as const,
      letterSpacing: -0.4,
      lineHeight: 22,
    },
    regular: {
      fontSize: 15,
      fontWeight: '500' as const,
      letterSpacing: -0.3,
      lineHeight: 20,
    },
    small: {
      fontSize: 13,
      fontWeight: '500' as const,
      letterSpacing: -0.2,
      lineHeight: 18,
    },
  },

  // Captions (Secondary text)
  caption: {
    large: {
      fontSize: 13,
      fontWeight: '400' as const,
      letterSpacing: -0.2,
      lineHeight: 18,
    },
    regular: {
      fontSize: 11,
      fontWeight: '500' as const,
      letterSpacing: 0.3,
      lineHeight: 16,
    },
    small: {
      fontSize: 10,
      fontWeight: '400' as const,
      letterSpacing: 0.3,
      lineHeight: 14,
    },
  },

  // Labels (UI elements)
  label: {
    large: {
      fontSize: 16,
      fontWeight: '600' as const,
      letterSpacing: -0.4,
      lineHeight: 21,
    },
    regular: {
      fontSize: 13,
      fontWeight: '500' as const,
      letterSpacing: -0.2,
      lineHeight: 18,
    },
    small: {
      fontSize: 11,
      fontWeight: '500' as const,
      letterSpacing: 1,
      lineHeight: 16,
    },
    tiny: {
      fontSize: 9,
      fontWeight: '200' as const,
      letterSpacing: 0.8,
      lineHeight: 12,
    },
  },

  // Price/Financial (Special formatting for money)
  price: {
    hero: {
      fontSize: 36,
      fontWeight: '300' as const,
      letterSpacing: -0.5,
    },
    large: {
      fontSize: 28,
      fontWeight: '600' as const,
      letterSpacing: 0,
    },
    regular: {
      fontSize: 14,
      fontWeight: '500' as const,
      letterSpacing: 0,
    },
  },

  // Input Fields
  input: {
    large: {
      fontSize: 32,
      fontWeight: '200' as const,
      letterSpacing: -0.5,
    },
    regular: {
      fontSize: 16,
      fontWeight: '300' as const,
      letterSpacing: -0.3,
    },
  },

  // Uppercase Labels
  uppercase: {
    fontSize: 10,
    fontWeight: '500' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
} as const

/**
 * Spacing - 4px base unit (Apple's 4pt grid)
 */
export const spacing = {
  xxxs: 2,    // Hairline spacing
  xxs: 4,     // Micro spacing
  xs: 8,      // Extra small
  sm: 12,     // Small
  md: 16,     // Medium (default)
  lg: 20,     // Large
  xl: 24,     // Extra large
  xxl: 32,    // 2x large
  xxxl: 40,   // 3x large
  huge: 48,   // Huge
  massive: 60, // Massive
} as const

/**
 * Border Radius - Apple's corner radiuses
 */
export const radius = {
  none: 0,
  xs: 6,      // Tiny corners
  sm: 10,     // Small
  md: 12,     // Medium (cards)
  lg: 16,     // Large (grouped lists)
  xl: 20,     // Extra large (inputs)
  xxl: 24,    // 2x large (modals, containers)
  pill: 100,  // Pill shape (height/2)
  round: 999, // Fully round
} as const

/**
 * Shadows - iOS-style elevation
 */
export const shadows = {
  none: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
} as const

/**
 * Animation - Apple's signature spring physics
 */
export const animation = {
  // Durations (in ms)
  duration: {
    instant: 0,
    fast: 150,
    normal: 200,
    slow: 300,
    slower: 400,
  },

  // Spring configs (for Animated.spring)
  spring: {
    gentle: {
      tension: 50,
      friction: 10,
      useNativeDriver: true,
    },
    snappy: {
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    },
    bouncy: {
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    },
  },

  // Timing configs
  timing: {
    easeOut: {
      duration: 200,
      useNativeDriver: true,
    },
    easeInOut: {
      duration: 300,
      useNativeDriver: true,
    },
  },
} as const

/**
 * Blur Intensities - iOS BlurView
 */
export const blur = {
  ultraThin: 20,
  thin: 30,
  regular: 40,
  thick: 50,
  ultraThick: 60,
  heavy: 80,
} as const

/**
 * Z-Index Layers - Consistent layering
 */
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  popover: 50,
  toast: 60,
} as const

/**
 * Layout - Common layout values
 */
export const layout = {
  // Component Heights
  height: {
    input: 48,
    inputLarge: 60,
    button: 44,
    buttonLarge: 56,
    listItem: 60,
    header: 56,
    tabBar: 50,
  },

  // Cart Widths (for POS)
  cart: {
    tablet: 380,
    phone: 320,
  },

  // Container Widths
  container: {
    sm: 600,
    md: 800,
    lg: 1000,
    xl: 1200,
  },

  // Grid Gaps
  gap: {
    grid: 12,
    list: 8,
    inline: 4,
  },
} as const

/**
 * Breakpoints
 */
export const breakpoints = {
  phone: 0,
  tablet: 600,
  desktop: 1024,
} as const

/**
 * Border Widths - Pixel-perfect borders
 */
export const borderWidth = {
  none: 0,
  hairline: 0.33,  // iOS hairline
  thin: 0.5,
  regular: 1,
  thick: 2,
} as const

/**
 * Opacity Levels - Consistent transparency
 */
export const opacity = {
  disabled: 0.3,
  ghost: 0.4,
  muted: 0.6,
  regular: 0.8,
  bright: 0.95,
  full: 1,
} as const
