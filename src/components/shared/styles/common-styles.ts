/**
 * Common Shared Styles
 * Standardized components used across the app
 */

import { StyleSheet } from 'react-native'
import { spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'

/**
 * PILL BUTTON - Standard across all views
 * Use this for all action buttons (Add Product, Create Audit, etc.)
 */
export const pillButtonStyles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    borderRadius: 24, // PILL SHAPED
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  // Small variant (for icons/short text)
  buttonSmall: {
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmallText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#fff',
  },
})

/**
 * TITLE SECTION - Standard header for all views
 * Logo + Large Title + Action Button
 */
export const titleSectionStyles = StyleSheet.create({
  cardWrapper: {
    paddingHorizontal: layout.contentHorizontal,
  },
  titleSectionContainer: {
    marginBottom: spacing.md,
  },
  largeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  vendorLogoInline: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  largeTitleHeader: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
    marginTop: 4,
  },
})

/**
 * FIXED HEADER - Appears when scrolling
 */
export const fixedHeaderStyles = StyleSheet.create({
  fixedHeader: {
    position: 'absolute',
    top: layout.headerTop,
    left: 0,
    right: 0,
    height: layout.headerHeight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  fixedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
})

/**
 * FADE GRADIENT - Top fade effect
 */
export const fadeGradientStyles = StyleSheet.create({
  fadeGradient: {
    position: 'absolute',
    top: layout.headerTop + layout.headerHeight,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 5,
    pointerEvents: 'none',
  },
})
