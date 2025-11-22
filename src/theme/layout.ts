/**
 * Layout Constants
 * Standardized across all screens - Apple consistency
 */

export const layout = {
  // Sidebar Navigation (Settings-style)
  sidebarWidth: 375,

  // ==========================================
  // APP-WIDE STANDARD SPACING: 8px (Minimal)
  // ==========================================
  // This matches the padding between the nav sidebar and screen edge
  //
  // CRITICAL RULE: ALL content must use 8px spacing
  // - Sections use: marginHorizontal: layout.containerMargin (8px)
  // - Section titles: NO horizontal padding (inherit section margin)
  // - Cards inside sections: NO horizontal margin (inherit section margin)
  // - Rows inside cards: paddingHorizontal: layout.containerMargin (8px)
  // - Content inside cards: paddingHorizontal: layout.containerMargin (8px)
  //
  // Result: Everything aligns perfectly at 8px from screen edge (minimal, Apple-style)
  //
  containerMargin: 8, // Minimal spacing - matches NavSidebar edge spacing

  // Legacy spacing values (DEPRECATED - causes inconsistent padding)
  contentHorizontal: 16, // DEPRECATED - use containerMargin
  contentLeft: 8, // DEPRECATED - use containerMargin
  contentVertical: 20,
  cardPadding: 16, // DEPRECATED - use containerMargin for consistency

  // Standardized header positioning - MUST be identical across all views
  headerTop: 8, // Fixed header and search bar top position
  searchBarHeight: 48, // Search bar height
  searchBarBottomGap: 12, // Gap below search bar
  contentStartTop: 68, // Where content starts (8 + 48 + 12)
  fadeGradientHeight: 80, // Fade gradient covers search area + extra for effect

  // Spacing
  sectionSpacing: 20,

  // Border Radius
  containerRadius: 20,
  cardRadius: 13,
  pillRadius: 100,

  // Row Heights
  minTouchTarget: 44,
  rowPaddingVertical: 11,
  rowPaddingHorizontal: 16, // Keep 16px for card content - looks better

  // Dock
  dockHeight: 100, // Dock height + spacing for scroll padding
} as const
