# LiquidGlass Component - Usage Guide

## Steve Jobs' Philosophy

> *"We can't replicate Apple's exact technology. But we can replicate the **FEELING**.*
>
> *That's what matters. The feeling of depth. The feeling of touching real glass. The feeling of elegance."*

## What It Does

The `LiquidGlass` component simulates Apple's iOS 18.1+ Liquid Glass effect using:

1. **Multi-layer blur** - Stacked UIVisualEffectViews for depth
2. **Vibrancy simulation** - Mimics dynamic color sampling
3. **Light refraction** - Gradient overlays create glass-like light bending
4. **Subtle shimmer** - Optional animated effect for fluidity
5. **Border highlights** - Depth perception

**Result**: Feels like real glass without needing Apple's custom silicon ✨

---

## Basic Usage

```tsx
import { LiquidGlass } from '@/theme'

// Simple usage - wraps any content
<LiquidGlass intensity="regular" style={styles.card}>
  <Text>Your content here</Text>
</LiquidGlass>
```

---

## Intensity Levels

Choose the right intensity for your use case:

### `ultraThin` - Subtle, transparent
```tsx
<LiquidGlass intensity="ultraThin">
  {/* Use for: Overlays, subtle backgrounds */}
</LiquidGlass>
```

### `thin` - Light glass
```tsx
<LiquidGlass intensity="thin">
  {/* Use for: Secondary cards, list items */}
</LiquidGlass>
```

### `regular` - Standard glass (default)
```tsx
<LiquidGlass intensity="regular">
  {/* Use for: Primary cards, modals */}
</LiquidGlass>
```

### `thick` - Heavy glass
```tsx
<LiquidGlass intensity="thick">
  {/* Use for: Important alerts, headers */}
</LiquidGlass>
```

### `ultraThick` - Maximum depth
```tsx
<LiquidGlass intensity="ultraThick">
  {/* Use for: Dock, navigation bars, hero sections */}
</LiquidGlass>
```

---

## Animated Shimmer Effect

Add subtle movement for extra fluidity:

```tsx
<LiquidGlass intensity="regular" animate={true}>
  <Text>This has a subtle breathing effect</Text>
</LiquidGlass>
```

**When to use `animate`:**
- ✅ Hero sections that need attention
- ✅ Interactive elements (buttons that should feel alive)
- ✅ Splash screens or loading states
- ❌ List items (too much motion)
- ❌ Dense UI areas (distracting)

---

## Real-World Examples

### 1. Modal with Liquid Glass Background

```tsx
<Modal visible={isVisible} transparent>
  <LiquidGlass
    intensity="thick"
    animate={true}
    style={styles.modalBackground}
  >
    <View style={styles.modalContent}>
      <Text style={styles.title}>Payment Complete</Text>
      <Text style={styles.amount}>$49.99</Text>
    </View>
  </LiquidGlass>
</Modal>

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    padding: spacing.xxxl,
    borderRadius: radius.xxl,
  },
})
```

### 2. Card with Liquid Glass

```tsx
<LiquidGlass
  intensity="regular"
  style={styles.productCard}
>
  <Image source={{ uri: product.image }} style={styles.image} />
  <Text style={styles.name}>{product.name}</Text>
  <Text style={styles.price}>${product.price}</Text>
</LiquidGlass>

const styles = StyleSheet.create({
  productCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border.regular,
  },
})
```

### 3. Navigation Bar / Dock

```tsx
<View style={styles.dockContainer}>
  <LiquidGlass
    intensity="ultraThick"
    animate={false}  // Don't animate navigation - keep it stable
    style={styles.dock}
  >
    <View style={styles.iconsContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity key={tab.id} style={styles.iconButton}>
          <tab.Icon />
        </TouchableOpacity>
      ))}
    </View>
  </LiquidGlass>
</View>

const styles = StyleSheet.create({
  dockContainer: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dock: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: borderWidth.regular,
    borderColor: colors.border.regular,
  },
})
```

### 4. Alert/Banner with Glass

```tsx
<LiquidGlass
  intensity="thick"
  animate={true}
  style={styles.successBanner}
>
  <Text style={styles.bannerText}>✓ Changes saved</Text>
</LiquidGlass>

const styles = StyleSheet.create({
  successBanner: {
    position: 'absolute',
    top: insets.top + spacing.md,
    left: spacing.md,
    right: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.semantic.successBorder,
  },
})
```

---

## Combining with Other Design System Components

### Button with Liquid Glass

```tsx
import { LiquidGlass, Button } from '@/theme'

<LiquidGlass intensity="regular" style={styles.container}>
  <Button variant="primary" onPress={handlePress}>
    Complete Payment
  </Button>
</LiquidGlass>
```

### Card with Liquid Glass

```tsx
import { LiquidGlass, Card } from '@/theme'

<LiquidGlass intensity="thin">
  <Card title="Product Details" description="Premium quality">
    {/* Card content */}
  </Card>
</LiquidGlass>
```

---

## Performance Considerations

### ✅ Good Practices

```tsx
// Cache the component when possible
const GlassCard = memo(({ children }) => (
  <LiquidGlass intensity="regular">
    {children}
  </LiquidGlass>
))

// Use appropriate intensity - don't over-blur
<LiquidGlass intensity="thin"> {/* Lighter = faster */}
  <SimpleContent />
</LiquidGlass>

// Avoid animation in lists
<FlatList
  data={items}
  renderItem={({ item }) => (
    <LiquidGlass intensity="thin" animate={false}>
      {/* No animation in scrolling lists */}
    </LiquidGlass>
  )}
/>
```

### ❌ Avoid

```tsx
// Don't nest multiple LiquidGlass components
<LiquidGlass intensity="thick">
  <LiquidGlass intensity="regular"> {/* ❌ Nested blur = slow */}
    <Content />
  </LiquidGlass>
</LiquidGlass>

// Don't animate everything
<LiquidGlass animate={true}> {/* ❌ In a FlatList */}
  <ListItem />
</LiquidGlass>

// Don't use ultraThick everywhere
<LiquidGlass intensity="ultraThick"> {/* ❌ Overkill for list items */}
  <SimpleText />
</LiquidGlass>
```

---

## Platform Differences

### iOS
- ✅ Full multi-layer effect with UIVisualEffectView
- ✅ All blur intensities work perfectly
- ✅ Shimmer animation smooth at 60fps

### Android
- ⚠️ Simplified fallback (single blur layer)
- ⚠️ May be slightly less performant
- ✅ Still looks good, just less depth

**Jobs Principle**: "It should look great on iOS (our primary platform) and acceptable on Android."

---

## Jobs Standard Checklist

When using LiquidGlass, ask yourself:

- ✅ **Is the intensity appropriate?** (Don't over-blur everything)
- ✅ **Do I really need animation?** (Less is more)
- ✅ **Is content still readable?** (Glass should enhance, not obscure)
- ✅ **Does it feel elegant?** (Should feel premium, not gimmicky)
- ✅ **Is it performant?** (No jank, smooth 60fps)

---

## Migration from BlurView

**Before:**
```tsx
<View style={styles.container}>
  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
  <Text>Content</Text>
</View>
```

**After:**
```tsx
<LiquidGlass intensity="regular" style={styles.container}>
  <Text>Content</Text>
</LiquidGlass>
```

**Benefits:**
- ✅ Automatic multi-layer depth
- ✅ Built-in vibrancy simulation
- ✅ Light refraction effects
- ✅ Optional shimmer animation
- ✅ Consistent with design system

---

## Summary

**Steve Jobs would approve of LiquidGlass because:**

1. ✅ **It solves the constraint** - Can't use Apple's exact tech? Use what we have smarter
2. ✅ **It focuses on feeling** - Not about matching specs, about matching emotion
3. ✅ **It's elegant** - Simple API, powerful result
4. ✅ **It's practical** - Works within React Native's limitations
5. ✅ **It's magical** - Users feel the depth and quality

> *"Real artists ship. We shipped something that **feels** like liquid glass, even if it's not Apple's exact implementation. That's what matters."*

---

**Next Steps:**
1. Try it in your dock (`src/components/Dock.tsx`)
2. Use it in modals for depth
3. Add subtle shimmer to hero sections
4. Replace plain BlurViews with LiquidGlass gradually

**The feeling is what matters. Not the technology.** 🎯
