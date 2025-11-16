# WhaleTools Design System

**Apple-Quality UI Framework**

Built with the philosophy that Steve Jobs and Apple engineering would approve of.

---

## Philosophy

### Core Principles

1. **Simplicity**: One way to do things. Clear, obvious patterns.
2. **Consistency**: Same patterns everywhere. No exceptions.
3. **Elegance**: Every detail matters. Pixel-perfect execution.
4. **Performance**: Fast, smooth, responsive. 60fps minimum.

### Design Language

- **Dark-first**: OLED-optimized pure black backgrounds
- **Liquid Glass**: iOS-style blur effects throughout
- **Typography**: San Francisco-inspired hierarchy
- **Haptics**: Consistent tactile feedback
- **Animations**: Spring physics, never linear

---

## Quick Start

```typescript
import { colors, typography, spacing, radius, Button, Card } from '@/theme'

// Use design tokens
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  title: {
    ...typography.title.large,
    color: colors.text.primary,
  },
})

// Use components
<Button variant="primary" onPress={handlePress}>
  Save Changes
</Button>

<Card blur blurIntensity="thick">
  <Text>Card content</Text>
</Card>
```

---

## Design Tokens

All design tokens are located in `src/theme/tokens.ts`.

### Colors

```typescript
import { colors } from '@/theme'

// Backgrounds
colors.background.primary      // #000000 (pure black)
colors.background.secondary    // rgba(0,0,0,0.4)
colors.background.tertiary     // rgba(0,0,0,0.85)

// Glass Effects
colors.glass.ultraThin        // rgba(255,255,255,0.02)
colors.glass.thin             // rgba(255,255,255,0.03)
colors.glass.regular          // rgba(255,255,255,0.08)
colors.glass.thick            // rgba(255,255,255,0.12)
colors.glass.ultraThick       // rgba(255,255,255,0.15)

// Borders
colors.border.subtle          // rgba(255,255,255,0.06)
colors.border.regular         // rgba(255,255,255,0.1)
colors.border.emphasis        // rgba(255,255,255,0.12)
colors.border.strong          // rgba(255,255,255,0.15)

// Text
colors.text.primary           // #FFFFFF
colors.text.secondary         // rgba(255,255,255,0.95)
colors.text.tertiary          // rgba(255,255,255,0.8)
colors.text.disabled          // rgba(255,255,255,0.5)
colors.text.placeholder       // rgba(255,255,255,0.3)

// Semantic Colors
colors.semantic.success       // #10b981
colors.semantic.error         // rgba(255,60,60,0.95)
colors.semantic.info          // rgba(100,200,255,0.95)
```

### Typography

```typescript
import { typography } from '@/theme'

// Display (Hero text)
typography.display            // 34px, light

// Titles
typography.title.large        // 28px, semibold
typography.title.medium       // 24px, light
typography.title.small        // 18px, light

// Body Text
typography.body.large         // 17px, medium
typography.body.regular       // 15px, medium
typography.body.small         // 13px, medium

// Labels
typography.label.large        // 16px, semibold
typography.label.regular      // 13px, medium
typography.label.small        // 11px, medium (UPPERCASE)

// Prices (special formatting)
typography.price.hero         // 36px, light
typography.price.large        // 28px, semibold
typography.price.regular      // 14px, medium
```

### Spacing

Based on 4px grid system:

```typescript
import { spacing } from '@/theme'

spacing.xxs    // 4px
spacing.xs     // 8px
spacing.sm     // 12px
spacing.md     // 16px  (default)
spacing.lg     // 20px
spacing.xl     // 24px
spacing.xxl    // 32px
spacing.xxxl   // 40px
```

### Border Radius

```typescript
import { radius } from '@/theme'

radius.xs      // 6px   (tiny corners)
radius.sm      // 10px  (small)
radius.md      // 12px  (cards)
radius.lg      // 16px  (grouped lists)
radius.xl      // 20px  (inputs)
radius.xxl     // 24px  (modals)
radius.pill    // 100   (pill shape)
radius.round   // 999   (fully round)
```

---

## Components

All components are in `src/theme/components.tsx`.

### Button

```typescript
<Button
  variant="primary"      // primary | secondary | ghost | success | error
  size="medium"          // small | medium | large
  onPress={handlePress}
  loading={false}
  disabled={false}
  fullWidth={false}
>
  Button Text
</Button>
```

**Variants:**
- `primary`: White glass background (default action)
- `secondary`: Subtle glass background
- `ghost`: Transparent with border
- `success`: Green tint
- `error`: Red tint

**Sizes:**
- `small`: 36px height
- `medium`: 44px height
- `large`: 56px height

### Card

```typescript
<Card
  blur={true}               // Enable blur effect
  blurIntensity="thick"     // ultraThin | thin | regular | thick | ultraThick
  style={customStyles}
>
  <Text>Card content here</Text>
</Card>
```

Features:
- Automatic blur background
- Border with proper color
- Rounded corners (24px)
- Proper shadow

### Modal (Bottom Sheet)

```typescript
<Modal
  visible={isVisible}
  onClose={handleClose}
  title="Modal Title"
  showHandle={true}
>
  <Text>Modal content</Text>
</Modal>
```

Features:
- Slides up from bottom
- Blur backdrop
- Pull handle
- Spring animation
- Safe area aware

### TextInput

```typescript
<TextInput
  value={value}
  onChangeText={setValue}
  placeholder="Enter text"
  label="FIELD LABEL"
  keyboardType="default"   // default | numeric | decimal-pad | email-address
  secureTextEntry={false}
  large={false}            // Use large variant (60px height)
/>
```

### ListItem (iOS 26 Style)

```typescript
<View style={{ borderRadius: 16, overflow: 'hidden' }}>
  <ListItem
    first={true}
    last={false}
    selected={isSelected}
    showCheckmark={true}
    onPress={handlePress}
  >
    <Text>List item content</Text>
  </ListItem>
  {/* More items */}
</View>
```

### Pill

```typescript
<Pill
  variant="default"        // default | success | error | info
  onPress={handlePress}
  onRemove={handleRemove}  // Shows X button
>
  <Text>Pill content</Text>
</Pill>
```

### SectionHeader

```typescript
<SectionHeader
  title="SECTION TITLE"
  action={{
    label: "View All",
    onPress: handleViewAll
  }}
/>
```

### EmptyState

```typescript
<EmptyState
  title="No items found"
  subtitle="Try adjusting your filters"
  action={{
    label: "Clear Filters",
    onPress: handleClear
  }}
/>
```

### Divider

```typescript
<Divider />                 // Horizontal hairline
<Divider vertical />        // Vertical hairline
```

---

## Utilities

### Product Transformers

```typescript
import {
  transformInventoryToProducts,
  extractCategories,
  extractFieldValues,
  applyFilters,
  getLowestPrice,
} from '@/utils/product-transformers'

// Transform raw inventory data
const products = transformInventoryToProducts(inventoryData)

// Extract unique categories
const categories = extractCategories(products)

// Get available filter values
const strainTypes = extractFieldValues(products, 'strain_type')

// Apply filters
const filtered = applyFilters(products, {
  searchQuery: 'og kush',
  category: 'Flower',
  strainTypes: ['Indica'],
  consistencies: [],
  flavors: [],
})

// Get lowest price for "From $X.XX" display
const lowestPrice = getLowestPrice(product)
```

---

## Custom Hooks

### useFilters

Consolidated filter state management:

```typescript
import { useFilters } from '@/hooks/pos'

const {
  filters,                    // Current filter state
  filteredProducts,           // Filtered product list
  activeFilterCount,          // Number of active filters
  matchingFiltersMap,         // Map of product IDs to matching filters
  availableStrainTypes,       // Available strain types
  availableConsistencies,     // Available consistencies
  availableFlavors,           // Available flavors
  setSearchQuery,             // Set search query
  setCategory,                // Set category
  toggleStrainType,           // Toggle strain type filter
  toggleConsistency,          // Toggle consistency filter
  toggleFlavor,               // Toggle flavor filter
  clearFilters,               // Clear all filters
} = useFilters(products)
```

### useModalState

State machine for modal management:

```typescript
import { useModalState } from '@/hooks/pos'

const {
  activeModal,                 // Current active modal
  openModal,                   // Open a specific modal
  closeModal,                  // Close current modal
  isModalOpen,                 // Check if specific modal is open
  hasOpenModal,                // Check if any modal is open
} = useModalState()

// Usage
openModal('payment')
closeModal()
const isPaymentOpen = isModalOpen('payment')
```

### useSession

Session state management:

```typescript
import { useSession } from '@/hooks/pos'

const {
  sessionInfo,                 // Current session info
  vendor,                      // Vendor info
  locations,                   // Available locations
  customUserId,                // Custom user ID
  sessionData,                 // Session data (for closing)
  loading,                     // Loading state
  error,                       // Error message
  loadVendorAndLocations,      // Load vendor/locations
  selectLocation,              // Select location
  selectRegister,              // Select register
  openCashDrawer,              // Open cash drawer & create session
  closeCashDrawer,             // Close cash drawer & end session
  clearSession,                // Clear session state
} = useSession()
```

---

## Best Practices

### DO ✅

1. **Use design tokens everywhere**
   ```typescript
   // Good
   const styles = StyleSheet.create({
     container: {
       backgroundColor: colors.background.primary,
       padding: spacing.md,
     },
   })

   // Bad
   const styles = StyleSheet.create({
     container: {
       backgroundColor: '#000',
       padding: 16,
     },
   })
   ```

2. **Use typography presets**
   ```typescript
   // Good
   <Text style={{ ...typography.title.large, color: colors.text.primary }}>
     Title
   </Text>

   // Bad
   <Text style={{ fontSize: 28, fontWeight: '600', color: '#fff' }}>
     Title
   </Text>
   ```

3. **Use components over custom implementations**
   ```typescript
   // Good
   <Button variant="primary" onPress={handlePress}>
     Save
   </Button>

   // Bad
   <TouchableOpacity
     style={{ backgroundColor: 'rgba(255,255,255,0.15)', ... }}
     onPress={handlePress}
   >
     <Text>Save</Text>
   </TouchableOpacity>
   ```

4. **Add haptic feedback**
   ```typescript
   const handlePress = () => {
     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
     // ...
   }
   ```

5. **Use proper animations**
   ```typescript
   // Use spring for natural motion
   Animated.spring(animValue, {
     toValue: 1,
     useNativeDriver: true,
     ...animation.spring.gentle,
   }).start()
   ```

### DON'T ❌

1. Don't hardcode colors/spacing
2. Don't create custom buttons/inputs
3. Don't use linear animations
4. Don't skip haptic feedback
5. Don't ignore safe area insets
6. Don't use emojis unless explicitly requested

---

## Migration Guide

### Migrating Existing Components

1. **Replace hardcoded values with tokens:**
   ```typescript
   // Before
   backgroundColor: '#000'
   padding: 16

   // After
   backgroundColor: colors.background.primary
   padding: spacing.md
   ```

2. **Use typography presets:**
   ```typescript
   // Before
   fontSize: 28,
   fontWeight: '600',
   letterSpacing: -0.4

   // After
   ...typography.title.large
   ```

3. **Replace custom components:**
   ```typescript
   // Before
   <CustomButton>...</CustomButton>

   // After
   <Button variant="primary">...</Button>
   ```

4. **Add proper memoization:**
   ```typescript
   // Use useMemo for expensive calculations
   const filtered = useMemo(() => {
     return applyFilters(products, filters)
   }, [products, filters])

   // Use useCallback for functions
   const handlePress = useCallback(() => {
     // ...
   }, [dependencies])
   ```

---

## Testing

### Component Testing

```typescript
import { render, fireEvent } from '@testing-library/react-native'
import { Button } from '@/theme'

test('Button calls onPress when clicked', () => {
  const onPress = jest.fn()
  const { getByText } = render(
    <Button onPress={onPress}>Click me</Button>
  )

  fireEvent.press(getByText('Click me'))
  expect(onPress).toHaveBeenCalled()
})
```

### Utility Testing

```typescript
import { applyFilters } from '@/utils/product-transformers'

test('applyFilters filters products correctly', () => {
  const products = [...]
  const filters = {
    searchQuery: 'og',
    category: 'Flower',
    strainTypes: [],
    consistencies: [],
    flavors: [],
  }

  const filtered = applyFilters(products, filters)
  expect(filtered.length).toBeLessThan(products.length)
})
```

---

## Performance

### Optimization Checklist

- ✅ Use `useMemo` for expensive calculations
- ✅ Use `useCallback` for functions passed as props
- ✅ Use `memo()` for component memoization
- ✅ Enable `useNativeDriver` for animations
- ✅ Lazy load heavy components
- ✅ Virtualize long lists

### Example

```typescript
// Memoized filtered products
const filteredProducts = useMemo(
  () => applyFilters(products, filters),
  [products, filters]
)

// Memoized component
const ProductCard = memo(({ product, onPress }) => {
  // ...
})

// Memoized callback
const handlePress = useCallback((id) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  selectProduct(id)
}, [selectProduct])
```

---

## Support

For questions or issues, please check:

1. This documentation
2. Component source code in `src/theme/`
3. Example usage in `src/screens/POSScreen.refactored.tsx`

---

**Built with ❤️ and Apple's design principles**
