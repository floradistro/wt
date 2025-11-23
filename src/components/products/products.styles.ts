/**
 * Products Styles
 * Shared styles for product components
 * Pattern: Same structure as customers.styles.ts
 */

import { StyleSheet } from 'react-native'
import { colors, spacing, radius, typography } from '@/theme/tokens'
import { layout } from '@/theme/layout'

export const productsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  productsList: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fixedHeader: {
    position: 'absolute',
    top: layout.headerTop,
    left: 0,
    right: 0,
    height: layout.searchBarHeight,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fixedHeaderTitle: {
    ...typography.fixedHeader,
    color: colors.text.primary,
    fontWeight: '600',
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10,
  },
  titleSectionContainer: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.border.emphasis,
  },
  titleWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  vendorLogoInline: {
    width: 80,
    height: 80,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border.emphasis,
    shadowColor: colors.background.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  largeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  largeTitleHeader: {
    ...typography.largeTitle,
    color: colors.text.primary,
  },
  addProductButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addProductButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  scrollView: {
    flex: 1,
  },
  cardWrapper: {
    paddingHorizontal: layout.containerMargin,
    marginVertical: layout.contentVertical,
  },
  productsCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.glass.regular,
  },
  sectionHeader: {
    paddingVertical: 4,
    paddingHorizontal: layout.containerMargin,
    backgroundColor: colors.background.primary,
    marginTop: 12,
  },
  sectionHeaderText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyStateIcon: {
    fontSize: 40,
  },
  emptyStateTitle: {
    ...typography.title2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyStateText: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },

  // Detail Panel
  detailPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.primary,
  },
})
