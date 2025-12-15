# Modal Rendering Patterns - Best Practices

## Critical Rule: Never Conditionally Mount Modals

**ALWAYS render modals. Use `visible={condition}` to control visibility, NOT conditional rendering.**

## ❌ WRONG - Causes Unmounting Issues

```tsx
// BAD: Modal can unmount mid-interaction
function MyComponent() {
  const [showModal, setShowModal] = useState(false)

  if (someCondition) {
    return (
      <>
        <SomeScreen />
        {showModal && <MyModal />}  // ❌ WRONG
      </>
    )
  }

  return <OtherScreen />
}
```

**Why this fails:**
- When `someCondition` changes to `false`, the entire component unmounts
- The modal disappears even if it was open
- User loses context mid-interaction
- State is lost

## ✅ CORRECT - Always Render Modals

```tsx
// GOOD: Modal is always mounted
function MyComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const renderScreen = () => {
    if (someCondition) {
      return <SomeScreen />
    }
    return <OtherScreen />
  }

  return (
    <>
      {renderScreen()}

      {/* ALWAYS render modals at top level */}
      <MyModal
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
```

**Why this works:**
- Modal component stays mounted
- Only visibility changes via `visible` prop
- State persists
- Animations work correctly
- No unexpected unmounting

## Pattern Examples

### ✅ Session Setup Pattern
```tsx
// POSSessionSetup.tsx
export function POSSessionSetup({ onSessionReady }) {
  const { isModalOpen, openModal, closeModal } = useModalState()

  const renderScreen = () => {
    if (!sessionInfo) {
      return <POSLocationSelector />
    }
    if (sessionInfo && isModalOpen('registerSelector')) {
      return <POSRegisterSelector />
    }
    return null
  }

  return (
    <>
      {renderScreen()}

      {/* ALWAYS RENDER - Never inside conditional */}
      <OpenCashDrawerModal
        visible={isModalOpen('cashDrawerOpen')}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </>
  )
}
```

### ✅ Checkout Pattern
```tsx
// POSCheckout.tsx
export function POSCheckout({ sessionInfo }) {
  const { isModalOpen } = useModalState()
  const [sessionData, setSessionData] = useState(null)

  return (
    <View>
      <POSCart />

      {/* ALL modals rendered at top level */}
      <POSPaymentModal visible={isModalOpen('payment')} />
      <POSSaleSuccessModal visible={isModalOpen('success')} />

      {/* Safe default values for required props */}
      <CloseCashDrawerModal
        visible={isModalOpen('cashDrawerClose') && !!sessionData}
        sessionNumber={sessionData?.sessionNumber || ''}
        totalSales={sessionData?.totalSales || 0}
        onSubmit={handleSubmit}
      />
    </View>
  )
}
```

## Common Mistakes

### ❌ Conditionally Rendering Based on Data Availability
```tsx
// WRONG
{sessionData && (
  <CloseCashDrawerModal
    visible={isModalOpen('cashDrawerClose')}
    sessionNumber={sessionData.sessionNumber}
  />
)}
```

### ✅ Always Render with Safe Defaults
```tsx
// CORRECT
<CloseCashDrawerModal
  visible={isModalOpen('cashDrawerClose') && !!sessionData}
  sessionNumber={sessionData?.sessionNumber || ''}
  totalSales={sessionData?.totalSales || 0}
/>
```

### ❌ Conditionally Rendering Based on Parent State
```tsx
// WRONG - Parent component changes can unmount modal
if (activeView === 'checkout') {
  return (
    <>
      <CheckoutScreen />
      <PaymentModal visible={showPayment} />
    </>
  )
}
```

### ✅ Render Modals Outside Conditional Logic
```tsx
// CORRECT
return (
  <>
    {activeView === 'checkout' && <CheckoutScreen />}
    {activeView === 'products' && <ProductsScreen />}

    {/* Modals always rendered */}
    <PaymentModal visible={showPayment} />
  </>
)
```

## Performance Considerations

**Q: Won't rendering hidden modals hurt performance?**

**A: No.** React Native's `Modal` component with `visible={false}`:
- Does NOT render its children when invisible
- Does NOT create native views when hidden
- Has minimal overhead (just the component instance)
- Is the recommended React Native pattern

**Q: Should I use lazy loading for modals?**

**A: No.** For POS modals that are frequently used:
- Keep them mounted for instant show/hide
- No loading delay for users
- Consistent behavior
- Simpler code

For rarely-used modals (like settings), you could use dynamic imports, but still follow the pattern:
```tsx
const SettingsModal = lazy(() => import('./SettingsModal'))

return (
  <>
    <MainScreen />
    <Suspense fallback={null}>
      <SettingsModal visible={isModalOpen('settings')} />
    </Suspense>
  </>
)
```

## Code Review Checklist

When reviewing code, check:

- [ ] All modals rendered at top-level return statement
- [ ] No modals inside `if` statements
- [ ] No modals inside ternary operators for mounting/unmounting
- [ ] Modal visibility controlled by `visible` prop
- [ ] Modal props have safe default values (optional chaining + fallbacks)
- [ ] Multiple screens handled with helper function or inline conditionals for *screens*, not modals

## Quick Reference

```tsx
// ❌ NEVER DO THIS
{condition && <Modal />}
if (condition) return <Modal />

// ✅ ALWAYS DO THIS
<Modal visible={condition} />
```

## Related Issues Fixed

- **2025-01-16**: OpenCashDrawerModal unmounting on register selection
  - Root cause: Modal inside conditional return branch
  - Fix: Moved modal to top-level, always rendered
  - Files: POSSessionSetup.tsx, POSCheckout.tsx
