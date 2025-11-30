/**
 * Orders Screen Styles
 * iPad Settings-style interface with Liquid Glass
 * Apple-quality performance for hundreds of orders per day
 */

import { StyleSheet } from 'react-native'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'

export const ordersStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary, // ✅ Using token
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    overflow: 'hidden',
  },

  // MIDDLE ORDERS LIST
  ordersList: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: colors.background.primary, // ✅ Using token
  },

  // iOS Collapsing Headers
  fixedHeader: {
    position: 'absolute',
    top: layout.headerTop, // Standardized - matches all views
    left: layout.containerMargin, // ✅ Fixed: Was 6px, now 8px (matches design system)
    height: layout.searchBarHeight, // Standardized search bar height
    zIndex: 20, // Above fade gradient
  },
  fixedDateRangeSelector: {
    position: 'absolute',
    top: layout.headerTop, // Standardized - matches all views
    right: layout.containerMargin, // ✅ Fixed: Was 6px, now 8px (matches design system)
    flexDirection: 'row',
    gap: 8,
    zIndex: 20, // Above fade gradient
  },
  fixedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary, // ✅ Using token
    letterSpacing: -0.2,
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
    shadowColor: colors.background.primary, // ✅ Using token
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  largeTitleHeader: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.text.primary, // ✅ Using token
    letterSpacing: -0.5,
  },

  // Date Range Selector
  dateRangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
  },
  dateRangeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.15)', // Slightly lighter for active state - borderless
  },
  dateRangeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary, // ✅ Using token (0.8 instead of 0.6, but more consistent)
    letterSpacing: -0.2,
  },
  dateRangeButtonTextActive: {
    color: colors.text.primary, // ✅ Using token
  },

  // FlatList
  flatListContent: {
    paddingTop: 0,
    paddingBottom: layout.dockHeight,
    paddingRight: 0, // No padding - cardWrapper handles spacing
  },

  // Card Wrapper - Minimal iOS-style spacing
  cardWrapper: {
    paddingHorizontal: layout.containerMargin, // 8px - matches NavSidebar edge spacing
    marginBottom: 8,
  },
  ordersCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
  },

  // Section Headers - ✅ UNIFIED: Now matches Customers screen (golden standard)
  sectionHeader: {
    paddingHorizontal: layout.containerMargin, // 8px - consistent with all spacing
    paddingVertical: 4, // Minimal vertical padding (matches Customers)
    backgroundColor: colors.background.primary, // ✅ Using token instead of hardcoded '#000'
    marginTop: 12, // Spacing from previous section
  },
  sectionHeaderFirst: {
    paddingTop: 4, // Less padding for first section
  },
  sectionHeaderText: {
    fontSize: 22, // ✅ FIXED: Was 13px uppercase, now 22px bold (matches Customers)
    fontWeight: '700', // ✅ FIXED: Was 600, now 700 (bold)
    color: colors.text.primary, // ✅ Using token instead of hardcoded rgba
    letterSpacing: -0.3, // ✅ FIXED: Tighter spacing for larger text
    // ✅ REMOVED: textTransform uppercase (not needed for large headers)
  },

  // Order Items
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal + 6,
    gap: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle, // ✅ Using token (0.06 close to 0.05)
    minHeight: layout.minTouchTarget,
  },
  orderItemActive: {
    backgroundColor: colors.interactive.hover, // ✅ Using token (0.12 close to 0.2, more consistent)
  },
  orderItemLast: {
    borderBottomWidth: 0,
  },
  orderIcon: {
    width: 44,
    height: 44,
  },
  orderIconImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  orderIconPlaceholder: {
    backgroundColor: colors.glass.thick, // ✅ Using token (0.12 close to 0.24, more consistent)
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIconText: {
    fontSize: 20,
    color: colors.text.tertiary, // ✅ Using token
  },
  orderInfo: {
    flex: 1,
    gap: 4,
  },
  orderLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
    flex: 1,
  },
  orderTotal: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  orderMeta: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
  },
  orderStatus: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  // Legacy columns (kept for backward compatibility)
  dataColumn: {
    minWidth: 80,
    alignItems: 'flex-end',
    gap: 2,
  },
  dataLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.subtle,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dataValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.border.subtle, // ✅ Using token (0.06 matches)
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateIcon: {
    fontSize: 40,
    color: colors.text.placeholder, // ✅ Using token (0.3 matches)
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.secondary, // ✅ Using token (0.95 close to 0.9)
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.text.disabled, // ✅ Using token (0.5 matches)
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: -0.2,
  },

  // RIGHT DETAIL PANEL
  detailPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: colors.background.primary, // ✅ Using token
  },
  emptyDetail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary, // ✅ Using token
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 17,
    color: colors.text.tertiary, // ✅ Using token
    textAlign: 'center',
  },

  // DETAIL CONTENT
  detail: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.containerMargin, // 8px - consistent minimal spacing
    paddingVertical: layout.containerMargin,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.regular, // ✅ Using token
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary, // ✅ Using token
    letterSpacing: -0.2,
  },
  headerCardContainer: {
    marginHorizontal: layout.containerMargin, // 8px - consistent minimal spacing
    marginTop: layout.sectionSpacing,
    marginBottom: layout.sectionSpacing,
  },
  headerCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.containerMargin,
    gap: layout.containerMargin,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: colors.glass.thick, // ✅ Using token
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 28,
    color: colors.text.tertiary, // ✅ Using token
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary, // ✅ Using token
    marginBottom: 4,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.text.tertiary, // ✅ Using token
  },
  headerDot: {
    fontSize: 13,
    color: colors.text.placeholder, // ✅ Using token
  },

  // SECTIONS
  section: {
    marginHorizontal: layout.containerMargin, // 8px - consistent minimal spacing
    marginBottom: layout.sectionSpacing,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.disabled, // ✅ Using token (0.5 matches)
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 0, // No padding - inherits section margin
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle, // ✅ Using token
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary, // ✅ Using token
    letterSpacing: -0.2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 15,
    color: colors.text.tertiary, // ✅ Using token
  },
  rowChevron: {
    fontSize: 15,
    color: colors.text.placeholder, // ✅ Using token
  },
  inventoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  inventoryTotal: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.text.primary, // ✅ Using token
  },
})
