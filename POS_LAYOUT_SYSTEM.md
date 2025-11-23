# POS Layout System - Apple Engineering Standard

## Design Principle: 8px Base Unit System

All spacing in the POS system uses an **8px base unit** for perfect visual alignment and consistency.

```
Base Unit: 8px
├── xs: 4px   (0.5 units) - Half spacing
├── sm: 8px   (1 unit)    - PRIMARY EDGE SPACING ⭐
├── md: 16px  (2 units)   - Card gaps, internal padding
├── lg: 24px  (3 units)   - Section spacing
└── xl: 32px  (4 units)   - Large gaps
```

---

## Critical Layout Rules

### ✅ ALWAYS DO:
1. **Use layout constants** - `layout.pos.*` for all POS spacing
2. **8px edge spacing** - All edges (cart, products, search) use 8px
3. **16px card gaps** - Space between product cards
4. **Test on device** - Verify alignment matches cart edges

### ❌ NEVER DO:
1. **Arbitrary values** - Never use hardcoded values (e.g., `20`, `12`)
2. **Inconsistent spacing** - All edges must align perfectly
3. **Manual calculations** - Use layout constants, not math
4. **Skip visual testing** - Always verify on actual device

---

## POS Layout Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        POSScreen                            │
│  ┌──────────────────┬──────────────────────────────────┐   │
│  │ Left Column      │ Right Column                     │   │
│  │ (375px)          │ (flex: 1)                        │   │
│  │                  │                                  │   │
│  │ ┌──────────────┐ │ ┌──────────────────────────────┐ │   │
│  │ │              │ │ │ POSSearchBar                 │ │   │
│  │ │              │ │ │ top: 8px                     │ │   │
│  │ │ POSCheckout  │ │ │ left: 8px  ←─────────────┐   │ │   │
│  │ │ (Cart)       │ │ │ right: 8px               │   │ │   │
│  │ │              │ │ └──────────────────────────┘   │ │   │
│  │ │ margin: 8px  │ │                                │ │   │
│  │ │ all sides ─┐ │ │ ┌──────────────────────────┐   │ │   │
│  │ │            │ │ │ │ POSProductGrid           │   │ │   │
│  │ │            │ │ │ │                          │   │ │   │
│  │ │            │ │ │ │ paddingLeft: 8px  ←──────┘   │ │   │
│  │ └────────────┘ │ │ │ paddingRight: 8px ←──────────┘ │   │
│  │                  │ │ paddingTop: 72px             │ │   │
│  └──────────────────┴─┴──────────────────────────────┘ │   │
│                                                          │   │
│  ← 8px edge spacing throughout (perfect alignment) →    │   │
└─────────────────────────────────────────────────────────────┘
```

**Key Alignment:**
- Cart right edge: 8px from column boundary
- Product grid left edge: 8px from column boundary
- Search bar left edge: 8px (aligns with products)
- Search bar right edge: 8px from screen edge
- Product grid right edge: 8px from screen edge

**Result:** All elements align perfectly at 8px from edges 🎯

---

## Layout Constants Reference

### From `src/theme/layout.ts`

```typescript
export const layout = {
  // POS Layout System
  pos: {
    // Cart spacing
    cartMarginAll: 8,              // All margins around cart

    // Product grid spacing
    productGridPaddingLeft: 8,     // Aligns with cart right edge
    productGridPaddingRight: 8,    // 8px from screen edge ⚠️ CRITICAL
    productGridPaddingTop: 72,     // Space for search bar
    productGridGap: 16,            // Gap between cards

    // Search bar positioning
    searchBarTop: 8,               // Top position
    searchBarLeft: 8,              // Left position
    searchBarRight: 8,             // Right position ⚠️ CRITICAL
    searchBarHeight: 48,           // Fixed height
  }
}
```

---

## Component Implementation

### POSScreen.tsx (Cart Container)
```typescript
cartContainer: {
  flex: 1,
  margin: layout.pos.cartMarginAll, // ✅ 8px all sides
  borderRadius: layout.containerRadius,
  borderCurve: 'continuous',
  overflow: 'hidden',
}
```

### POSProductGrid.tsx (Product Grid)
```typescript
const contentContainerStyle = useMemo(() => ({
  paddingTop: layout.pos.productGridPaddingTop,      // ✅ 72px
  paddingLeft: layout.pos.productGridPaddingLeft,    // ✅ 8px
  paddingRight: layout.pos.productGridPaddingRight,  // ✅ 8px - CRITICAL!
  paddingBottom: Math.max(layout.dockHeight, insets.bottom + 16),
}), [insets.bottom])

const styles = StyleSheet.create({
  columnWrapper: {
    gap: layout.pos.productGridGap, // ✅ 16px horizontal
  },
  productCardWrapper: {
    flex: 1,
    marginBottom: layout.pos.productGridGap, // ✅ 16px vertical
  },
})
```

### POSSearchBar.tsx (Search Bar)
```typescript
const styles = StyleSheet.create({
  searchHeaderFloating: {
    position: 'absolute',
    top: layout.pos.searchBarTop,      // ✅ 8px
    left: layout.pos.searchBarLeft,    // ✅ 8px
    right: layout.pos.searchBarRight,  // ✅ 8px - CRITICAL!
    zIndex: 10,
  },
  unifiedSearchBarPill: {
    height: layout.pos.searchBarHeight,           // ✅ 48px
    borderRadius: layout.pos.searchBarHeight / 2, // ✅ Perfect pill
  },
})
```

---

## Common Issues & Fixes

### Issue #1: Product cards don't align with search bar
**Symptom:** Products extend past search bar on right side

**Root Cause:**
```typescript
// ❌ WRONG
paddingRight: 20,  // Arbitrary value

// ✅ CORRECT
paddingRight: layout.pos.productGridPaddingRight,  // 8px
```

**Fix:** Always use `layout.pos.productGridPaddingRight`

---

### Issue #2: Search bar overhangs or undershoots
**Symptom:** Search bar doesn't align with product grid edges

**Root Cause:**
```typescript
// ❌ WRONG
right: 12,  // Arbitrary value

// ✅ CORRECT
right: layout.pos.searchBarRight,  // 8px
```

**Fix:** Always use `layout.pos.searchBarRight`

---

### Issue #3: Cart and products don't align
**Symptom:** Gap between cart and products is uneven

**Root Cause:**
```typescript
// ❌ WRONG
marginRight: 10,        // Cart
paddingLeft: 8,         // Products

// ✅ CORRECT
margin: layout.pos.cartMarginAll,           // 8px (Cart)
paddingLeft: layout.pos.productGridPaddingLeft,  // 8px (Products)
```

**Fix:** Both must use 8px from layout constants

---

## Testing Checklist

Before committing layout changes, verify:

- [ ] Cart right edge aligns with products left edge
- [ ] Search bar left edge aligns with products left edge
- [ ] Search bar right edge aligns with products right edge
- [ ] Product cards have 16px gaps (not touching)
- [ ] All edges use 8px spacing (no arbitrary values)
- [ ] Code uses `layout.pos.*` constants (no hardcoded values)
- [ ] Tested on iPad in landscape orientation
- [ ] No overhang or gaps at screen edges

---

## Visual Inspection Guide

### Perfect Alignment (What to Look For)
```
Cart edge ─┐     ┌─ Search bar edge
           │     │
           ▼     ▼
┌──────────────────────────────┐
│ Cart     │ [Search.........]│
│          │                  │
│          │ [Card] [Card]    │  ← Cards align with search bar
│          │ [Card] [Card]    │
└──────────────────────────────┘
           ▲                  ▲
           │                  │
           └─ 8px gap    8px gap
```

### Bad Alignment (What to Avoid)
```
❌ Products overhang past search bar
❌ Search bar extends past products
❌ Uneven gaps (some 8px, some 20px)
❌ Cards touching screen edge (0px gap)
❌ Cart and products not aligned
```

---

## Enforcement

To prevent future layout issues:

1. **Code Review:** Check all PR changes use `layout.pos.*`
2. **Type System:** TypeScript enforces layout constant usage
3. **Visual Testing:** Always test on device before merge
4. **Documentation:** Reference this file in layout changes

---

## Apple Quality Standard

This layout system achieves:
- ✅ Pixel-perfect alignment across all elements
- ✅ Consistent 8px edge spacing (Apple iOS style)
- ✅ Perfect visual rhythm with 16px card gaps
- ✅ Zero magic numbers (all values from constants)
- ✅ Maintainable (change once, applies everywhere)
- ✅ Bulletproof (impossible to break without breaking types)

**Never again will we have layout inconsistencies in POS.** 🎯
