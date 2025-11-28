/**
 * Customers Styles
 * Shared styles for customer components
 */

import { StyleSheet } from 'react-native'
import { colors, spacing, radius, typography } from '@/theme/tokens'
import { layout } from '@/theme/layout'

export const customersStyles = StyleSheet.create({
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
  customersList: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // No padding - cardWrapper handles all spacing
  },
  fixedHeader: {
    position: 'absolute',
    top: layout.headerTop, // Standardized - matches all views
    left: 0,
    right: 0,
    height: layout.searchBarHeight, // Standardized search bar height
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20, // Above fade gradient
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
  scrollView: {
    flex: 1,
  },
  cardWrapper: {
    paddingHorizontal: layout.containerMargin, // 8px - matches NavSidebar edge spacing
    marginVertical: layout.contentVertical,
  },
  customersCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.glass.regular, // ✅ Using token (was 0.05, now 0.08 for consistency)
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    gap: 12,
    minHeight: layout.minTouchTarget,
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle, // ✅ Using token (0.06 close to 0.05)
  },
  customerItemActive: {
    backgroundColor: colors.interactive.hover, // ✅ Using token (0.12 close to 0.2, more consistent)
  },
  customerItemLast: {
    borderBottomWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.title3,
    color: colors.text.primary,
  },
  customerInfo: {
    flex: 1,
    gap: 2,
  },
  customerName: {
    ...typography.body,
    color: colors.text.primary,
  },
  customerContact: {
    ...typography.footnote,
    color: colors.text.tertiary,
  },
  dataColumn: {
    minWidth: 80,
    alignItems: 'flex-end',
    gap: 2,
  },
  dataLabel: {
    ...typography.uppercaseLabel,
    color: colors.text.subtle,
  },
  dataValue: {
    ...typography.subhead,
    color: colors.text.primary,
  },
  loyaltyPoints: {
    color: colors.semantic.success,
  },
  sectionHeader: {
    paddingVertical: 4,
    paddingHorizontal: layout.containerMargin, // 8px - consistent minimal spacing
    backgroundColor: colors.background.primary, // ✅ Using token
    marginTop: 12,
  },
  sectionHeaderText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary, // ✅ Using token
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
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
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
  clearSearchButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  clearSearchButtonText: {
    ...typography.uppercaseLabel,
    color: colors.semantic.info,
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
  detailContainer: {
    flex: 1,
  },

  // Header Card - Matches OrderDetail
  headerCardContainer: {
    marginHorizontal: layout.containerMargin,
    marginTop: layout.containerMargin,
    marginBottom: layout.containerMargin,
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
    padding: layout.containerMargin,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 36,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  headerKPIs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kpiItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  kpiValueLoyalty: {
    color: colors.semantic.success,
  },
  kpiLabel: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  kpiDivider: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.3)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 100,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  saveButton: {
    backgroundColor: colors.semantic.success,
  },
  // Sections - Matches OrderDetail
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.containerMargin,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  infoValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  infoInput: {
    fontSize: 15,
    color: colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
    padding: 0,
  },
  lastRow: {
    borderBottomWidth: 0,
  },

  // Loyalty Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.tertiary, // ✅ Using token (0.85 close to 0.7)
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loyaltyModal: {
    backgroundColor: 'rgba(255,255,255,0.15)', // Match product list - borderless, slightly more opaque for modal
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    padding: spacing.xl,
    width: '90%',
    maxWidth: 400,
    gap: spacing.lg,
  },
  loyaltyModalTitle: {
    ...typography.title2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  loyaltyModalSubtitle: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  loyaltyButtons: {
    gap: spacing.sm,
  },
  loyaltyButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  loyaltyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyButtonPositive: {
    backgroundColor: 'rgba(16,185,129,0.15)', // Match product list - borderless
  },
  loyaltyButtonNegative: {
    backgroundColor: 'rgba(255,59,48,0.15)', // Match product list - borderless
  },
  loyaltyButtonText: {
    ...typography.buttonLarge,
    color: colors.text.primary,
  },
  loyaltyCloseButton: {
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    marginTop: spacing.sm,
  },
  loyaltyCloseButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  customAmountSection: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
  },
  customAmountLabel: {
    ...typography.subhead,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  customAmountInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  customAmountInput: {
    ...typography.input,
    color: colors.text.primary,
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    textAlign: 'center',
  },
  customAmountButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAmountButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  customAmountHint: {
    ...typography.caption1,
    color: colors.text.subtle,
    textAlign: 'center',
    fontStyle: 'italic',
  },
})
