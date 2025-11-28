/**
 * Shared styles for all Settings Detail components
 * These styles are common across all detail views to maintain consistency
 */

import { StyleSheet } from "react-native"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import { layout } from "@/theme/layout"

export const detailCommonStyles = StyleSheet.create({
  detailContainer: {
    flex: 1,
  },
  fixedHeader: {
    position: 'absolute',
    top: layout.headerTop, // Standardized - matches all views (8px)
    left: 0,
    right: 0,
    height: layout.searchBarHeight, // Standardized search bar height (48px)
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20, // Above fade gradient
  },
  fixedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  fixedHeaderButton: {
    position: 'absolute',
    right: layout.containerMargin, // 8px - consistent minimal spacing
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedHeaderButtonText: {
    fontSize: 20,
    fontWeight: '300',
    color: colors.text.primary,
    marginTop: -2,
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10,
  },
  detailScroll: {
    flex: 1,
  },
  cardWrapper: {
    paddingHorizontal: layout.containerMargin, // 8px - matches NavSidebar edge spacing AND ProductsListView
    marginBottom: layout.containerMargin, // 8px - matches ProductsListView EXACTLY
  },
  titleSectionContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    padding: spacing.lg,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  detailTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    paddingTop: 16,
    paddingBottom: 8,
  },
  detailTitleLarge: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff', // Match ProductsListView exactly
    letterSpacing: -0.8, // Match ProductsListView exactly
  },
  largeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailCard: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
  },
  // List Card - MATCHES ProductsListView productsCardGlass
  listCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  // List Item - MATCHES ProductItem styling
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    gap: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: layout.minTouchTarget,
  },
  listItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  listItemLast: {
    borderBottomWidth: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyStateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyStateText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.4,
    marginBottom: spacing.xxs,
  },
  emptyStateSubtext: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  addButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  formLabel: {
    ...typography.caption1,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.xxs,
  },
  formInputWrapper: {
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  formInput: {
    ...typography.body,
    color: colors.text.primary,
  },
  formHint: {
    ...typography.footnote,
    color: colors.text.quaternary,
    marginBottom: spacing.xs,
  },
  tabSwitcher: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    borderRadius: 9999,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.15)', // Match product list - borderless
  },
  tabText: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)', // Match product list - borderless
  },
  actionButtonDangerText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#ff3b30',
    letterSpacing: -0.1,
  },
})
