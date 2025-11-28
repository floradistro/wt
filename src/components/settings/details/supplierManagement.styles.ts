/**
 * SupplierManagementDetail styles
 * Extends detailCommon.styles with component-specific styles
 */

import { StyleSheet } from "react-native"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import { detailCommonStyles } from "./detailCommon.styles"

export const supplierManagementStyles = StyleSheet.create({
  ...detailCommonStyles,

  // Component-specific styles
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.quaternary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  supplierCard: {
    padding: spacing.md,
  },
  supplierCardHeader: {
    marginBottom: spacing.sm,
  },
  supplierCardInfo: {
    flex: 1,
    gap: 4,
  },
  supplierCardName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  supplierCardContact: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
  supplierCardEmail: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  supplierCardPhone: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  supplierCardAddress: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  supplierCardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.quaternary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  userActionButton: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    alignItems: 'center',
    justifyContent: 'center',
  },
  userActionButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
  userActionButtonDanger: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)', // Match product list - borderless
  },
  userActionButtonDangerText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#ff3b30',
    letterSpacing: -0.1,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    ...typography.title3,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
  sliderLabel: {
    ...typography.caption1,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.quaternary,
  },
  campaignBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.xs,
    marginTop: spacing.sm,
  },
  campaignBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  discountEditActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  // Supplier Icon - Matches ProductItem icon
  supplierIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Supplier Info - Matches ProductItem productInfo
  supplierInfo: {
    flex: 1,
    gap: 2,
    minWidth: 180,
  },
  supplierName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  supplierContact: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  supplierMeta: {
    minWidth: 100,
    alignItems: 'flex-end',
  },
  inactiveLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ff3b30',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
})
