/**
 * Layout Constants
 * Standardized across all screens - Apple consistency
 */

export const layout = {
  // Sidebar Navigation (Settings-style)
  sidebarWidth: 375,

  // Container Margins (iPad Settings pattern)
  containerMargin: 16,

  // Content Margins
  contentHorizontal: 40,
  contentVertical: 20,

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
