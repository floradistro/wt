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
    backgroundColor: '#000',
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
    backgroundColor: '#000',
  },

  // iOS Collapsing Headers
  fixedHeader: {
    position: 'absolute',
    top: layout.headerTop, // Standardized - matches all views
    left: 6,
    height: layout.searchBarHeight, // Standardized search bar height
    zIndex: 20, // Above fade gradient
  },
  fixedDateRangeSelector: {
    position: 'absolute',
    top: layout.headerTop, // Standardized - matches all views
    right: 6,
    flexDirection: 'row',
    gap: 8,
    zIndex: 20, // Above fade gradient
  },
  fixedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
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
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  largeTitleHeader: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },

  // Date Range Selector
  dateRangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateRangeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dateRangeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  dateRangeButtonTextActive: {
    color: '#fff',
  },

  // FlatList
  flatListContent: {
    paddingTop: layout.contentStartTop,
    paddingBottom: layout.dockHeight,
    paddingRight: 0, // No padding - cardWrapper handles spacing
  },

  // Card Wrapper - iOS-style spacing
  cardWrapper: {
    marginLeft: layout.contentLeft, // 8px - combines with nav 8px margin for 16px total
    marginRight: layout.contentHorizontal, // 16px - equal spacing on right
    marginBottom: 8,
  },
  ordersCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Solid glass effect
  },

  // Section Headers
  sectionHeader: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  sectionHeaderFirst: {
    paddingTop: 4, // Less padding for first section
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
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
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: layout.minTouchTarget,
  },
  orderItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
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
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIconText: {
    fontSize: 20,
    color: 'rgba(235,235,245,0.6)',
  },
  orderInfo: {
    flex: 1,
    gap: 2,
    minWidth: 180,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  orderMeta: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
  },
  dataColumn: {
    minWidth: 80,
    alignItems: 'flex-end',
    gap: 2,
  },
  dataLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dataValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateIcon: {
    fontSize: 40,
    color: 'rgba(235,235,245,0.3)',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.9)',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  emptyStateText: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.5)',
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
    backgroundColor: '#000',
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
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 17,
    color: 'rgba(235,235,245,0.6)',
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
    paddingHorizontal: layout.contentHorizontal, // 16px equal padding on detail panels
    paddingVertical: layout.cardPadding,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  headerCardContainer: {
    marginHorizontal: layout.contentHorizontal, // 16px equal padding on detail panels
    marginTop: layout.sectionSpacing,
    marginBottom: layout.sectionSpacing,
  },
  headerCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.cardPadding,
    gap: layout.cardPadding,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 28,
    color: 'rgba(235,235,245,0.6)',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  headerDot: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.3)',
  },

  // SECTIONS
  section: {
    marginHorizontal: layout.contentHorizontal, // 16px equal padding on detail panels
    marginBottom: layout.sectionSpacing,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: layout.cardPadding,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  rowChevron: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.3)',
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
    color: '#fff',
  },
})
