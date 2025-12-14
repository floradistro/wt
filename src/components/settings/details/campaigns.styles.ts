/**
 * CampaignsDetail styles
 * Inline styles (detailCommon.styles was removed)
 */

import { StyleSheet } from "react-native"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import { layout } from "@/theme/layout"

export const campaignsStyles = StyleSheet.create({
  // Common detail styles (inlined)
  detailContainer: {
    flex: 1,
  },
  detailCard: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  listCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
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
  listItemLast: {
    borderBottomWidth: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  formInput: {
    ...typography.body,
    color: colors.text.primary,
  },
  tabSwitcher: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
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

  // Component-specific styles
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userActionButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
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
