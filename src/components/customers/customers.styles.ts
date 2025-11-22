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
  largeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  largeTitleHeader: {
    ...typography.largeTitle,
    color: colors.text.primary,
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
    backgroundColor: 'rgba(255,255,255,0.05)', // Solid glass effect for smooth scrolling
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
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  customerItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  customerItemLast: {
    borderBottomWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass.thick,
    borderWidth: 1,
    borderColor: colors.border.regular,
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
    backgroundColor: '#000',
    marginTop: 12,
  },
  sectionHeaderText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
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
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.containerMargin, // 8px - consistent minimal spacing
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    ...typography.body,
    color: colors.semantic.info,
  },
  detailHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.regular,
    minWidth: 80,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: colors.glass.regular,
  },
  deleteButton: {
    borderColor: colors.semantic.errorBorder,
  },
  cancelButton: {
    backgroundColor: colors.glass.regular,
  },
  saveButton: {
    backgroundColor: colors.semantic.success,
    borderColor: colors.semantic.success,
  },
  actionButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  deleteButtonText: {
    ...typography.button,
    color: colors.semantic.error,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  detailContent: {
    flex: 1,
    paddingHorizontal: layout.containerMargin, // 8px - consistent minimal spacing
  },
  detailAvatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16,
  },
  detailAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.glass.thick,
    borderWidth: 2,
    borderColor: colors.border.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailAvatarText: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text.primary,
  },
  detailCustomerName: {
    ...typography.title1,
    color: colors.text.primary,
  },
  nameEditFields: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 500,
  },
  nameInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...typography.title2,
    color: colors.text.primary,
  },
  loyaltyStatValue: {
    color: colors.semantic.success,
  },
  statLabel: {
    ...typography.caption1,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...typography.uppercaseLabel,
    color: colors.text.subtle,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  glassCard: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  infoLabel: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  infoValue: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'right',
  },
  infoInput: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
    padding: 0,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border.subtle,
    marginLeft: 16,
  },
  comingSoonText: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  statHint: {
    ...typography.caption1,
    color: colors.text.subtle,
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Loyalty Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loyaltyModal: {
    backgroundColor: colors.glass.ultraThick,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border.regular,
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
    borderWidth: 1,
  },
  loyaltyButtonPositive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: colors.semantic.successBorder,
  },
  loyaltyButtonNegative: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: colors.semantic.errorBorder,
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
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
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
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
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
