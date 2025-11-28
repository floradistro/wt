/**
 * LocationConfigurationDetail styles
 * Extends detailCommon.styles with component-specific styles
 */

import { StyleSheet } from "react-native"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import { detailCommonStyles } from "./detailCommon.styles"

export const locationConfigurationStyles = StyleSheet.create({
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
  locationConfigValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  formInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 40,
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
  supplierCardEmail: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  supplierCardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
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
})
