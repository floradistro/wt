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
    paddingHorizontal: layout.containerMargin,
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

  // Campaign Icon - Matches ProductItem icon
  campaignIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  campaignIconText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
  },
  // Campaign Info - Matches ProductItem productInfo
  campaignInfo: {
    flex: 1,
    gap: 2,
    minWidth: 180,
  },
  campaignName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  campaignType: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  campaignMeta: {
    minWidth: 100,
    alignItems: 'flex-end',
    gap: 4,
  },
  activeLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#34c759',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inactiveLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ff3b30',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
})
