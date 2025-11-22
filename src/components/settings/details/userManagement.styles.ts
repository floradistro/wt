import { StyleSheet } from "react-native"
import { colors, spacing, radius } from "@/theme/tokens"
import { detailCommonStyles } from "./detailCommon.styles"

export const styles = StyleSheet.create({
  ...detailCommonStyles,
  userCard: {
    padding: spacing.md,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: 0.5,
  },
  userCardInfo: {
    flex: 1,
    gap: 2,
  },
  userCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  userCardName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  userCardEmail: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  userCardPhone: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },
  roleBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inactiveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: '#ff3b3020',
    borderWidth: 1,
    borderColor: '#ff3b3040',
  },
  inactiveBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ff3b30',
    letterSpacing: 0.8,
  },
  userCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  userCardMetaText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },
  userCardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  // Alias common action button styles for backward compat
  userActionButton: detailCommonStyles.actionButton,
  userActionButtonText: detailCommonStyles.actionButtonText,
  userActionButtonDanger: detailCommonStyles.actionButtonDanger,
  userActionButtonDangerText: detailCommonStyles.actionButtonDangerText,
})
