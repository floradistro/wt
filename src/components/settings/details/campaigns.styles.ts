/**
 * CampaignsDetail styles
 * Extends detailCommon.styles with component-specific styles
 */

import { StyleSheet } from "react-native"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import { detailCommonStyles } from "./detailCommon.styles"

export const campaignsStyles = StyleSheet.create({
  ...detailCommonStyles,

  // Component-specific overrides/customizations
  cardWrapper: {
    marginLeft: 16,
    marginRight: 16,
    marginVertical: 6,
  },
  configValue: {
    ...typography.title3,
    color: colors.text.primary,
    fontWeight: '600',
  },
  userActionButton: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userActionButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
})
