/**
 * Layout Constants - Apple Engineering Standard
 * Standardized across all screens - Apple consistency
 *
 * DESIGN SYSTEM PRINCIPLE:
 * All spacing uses the 8px base unit for perfect alignment.
 * This creates visual rhythm and prevents inconsistencies.
 */

export const layout = {
  // Sidebar Navigation (Settings-style) - Compact cart width
  sidebarWidth: 280, // Compact cart width for POS

  // ==========================================
  // APPLE 8PX DESIGN SYSTEM
  // ==========================================
  // Base unit: 8px
  // All spacing derives from this unit (8px, 16px, 24px, etc.)
  //
  // CRITICAL RULE: Use ONLY these standardized values
  // ❌ NEVER use arbitrary values (e.g., 20px, 12px, etc.)
  // ✅ ALWAYS use layout.spacing constants
  //
  spacing: {
    xs: 4,   // Extra small (half unit)
    sm: 8,   // Small (1 unit) - PRIMARY EDGE SPACING
    md: 16,  // Medium (2 units)
    lg: 24,  // Large (3 units)
    xl: 32,  // Extra large (4 units)
  },

  // Primary edge spacing (8px everywhere)
  containerMargin: 8, // CRITICAL: All edges use this value

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

  // ==========================================
  // POS LAYOUT SYSTEM (Apple Quality)
  // ==========================================
  // Ensures perfect alignment between cart, products, and search bar
  //
  // VISUAL HIERARCHY:
  // ┌─────────────────────┬─────────────────────────────┐
  // │ Cart Container      │ Search Bar                  │ ← Both 8px from edges
  // │ [8px margin]        │ [8px absolute positioning]  │
  // │                     │                             │
  // │                     │ Product Grid                │ ← 8px padding all sides
  // │                     │ [8px padding]               │
  // └─────────────────────┴─────────────────────────────┘
  //
  pos: {
    // Cart spacing (matches NavSidebar)
    cartMarginAll: 8,          // All margins around cart container

    // Product grid spacing
    productGridPaddingLeft: 8,   // Left padding (aligns with cart right edge)
    productGridPaddingRight: 8,  // Right padding (8px from screen edge) - CRITICAL!
    productGridPaddingTop: 72,   // Top padding (space for floating search bar)
    productGridGap: 16,          // Gap between product cards

    // Search bar positioning
    searchBarTop: 8,             // Top position
    searchBarLeft: 8,            // Left position (aligns with product grid)
    searchBarRight: 8,           // Right position (8px from screen edge) - CRITICAL!
    searchBarHeight: 48,         // Fixed height
  },
} as const
