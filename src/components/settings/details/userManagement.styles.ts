import { StyleSheet } from "react-native"
import { colors, spacing, radius } from "@/theme/tokens"
import { detailCommonStyles } from "./detailCommon.styles"

export const styles = StyleSheet.create({
  ...detailCommonStyles,
  // Avatar - Matches ProductItem icon
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.5,
  },
  // User Info - Matches ProductItem productInfo
  userInfo: {
    flex: 1,
    gap: 2,
    minWidth: 180,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  userRole: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  // Right Side Meta - Matches ProductItem inventory column
  userMeta: {
    minWidth: 100,
    alignItems: 'flex-end',
    gap: 4,
  },
  inactiveLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ff3b30',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  locationCount: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
  },
  // Legacy styles (keep for modals)
  userCardInfo: {
    flex: 1,
    gap: 2,
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
    backgroundColor: 'rgba(255,59,48,0.15)', // Match product list - borderless
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
