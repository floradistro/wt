/**
 * Layout Constants
 * Standardized across all screens - Apple consistency
 */

export const layout = {
  // Sidebar Navigation (Settings-style)
  sidebarWidth: 375,

  // Container Margins (iPad Settings pattern)
  containerMargin: 20, // iOS Settings-style l/r padding

  // Content Margins - Apple-optimized spacing
  contentHorizontal: 16, // Right side content padding (from content to screen edge)
  contentLeft: 8, // Left side content padding (nav has 8px margin, so 8+8=16px total)
  contentVertical: 20,

  // Standardized header positioning - MUST be identical across all views
  headerTop: 8, // Fixed header and search bar top position
  searchBarHeight: 48, // Search bar height
  searchBarBottomGap: 12, // Gap below search bar
  contentStartTop: 68, // Where content starts (8 + 48 + 12)
  fadeGradientHeight: 80, // Fade gradient covers search area + extra for effect

  // Card/Glass Containers
  cardPadding: 16,
  sectionSpacing: 20,

  // Border Radius
  containerRadius: 20,
  cardRadius: 13,
  pillRadius: 100,

  // Row Heights
  minTouchTarget: 44,
  rowPaddingVertical: 11,
  rowPaddingHorizontal: 16,

  // Dock
  dockHeight: 100, // Dock height + spacing for scroll padding
} as const
