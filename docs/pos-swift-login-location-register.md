# Swift POS (Liquid Glass) – Login → Location → Register → POS Shell

Use the current React Native app as the baseline for logic, state, and flows. Rebuild the surfaces in SwiftUI with a true iOS aesthetic: native physics, SF Symbols, tactile haptics, and “liquid glass” treatment throughout.

## References in RN app
- Login screen: `App.tsx` (LiquidGlassView hero, animated orbs, validation, Supabase login).
- Session setup: `src/components/pos/session/POSSessionSetup.tsx`.
  - Location selector: `POSLocationSelector`.
  - Register selector: `POSRegisterSelector`.
  - Cash drawer modal: `POSCashCountModal`.
- POS shell/layout: `src/screens/POSScreen.tsx`, `DashboardNavigator.tsx` (dock, left cart pane, right product browser).

## Screen 1 – Login (SwiftUI)
- Layout: Centered glass card over blurred gradient background; breathing “orb” layers via `Canvas` + blur; Liquid Glass on the card and logo pill.
- Fields: Email + password (SF Symbols: envelope, lock); inline validation (email format) with subtle shake on invalid submit.
- Actions: Primary button “Access Portal”; secondary text link “Need help signing in?”; footer “Need an account? Contact us”.
- States: Loading state disables fields and shows small inline activity ring in the button; error banner as floating glass toast.
- Motion/Haptics: Springy slide-in on mount; `impact(.medium)` on submit; `notification(.error)` on auth failure.
- Auth: Supabase email/password, same validation logic as RN; persist session; on success transition to shell with fade/scale of the card.

## Screen 2 – Select Location
- Entry: Present after login when no location in session; follows RN’s `POSLocationSelector` logic.
- Layout: Full-height sheet with hero title (vendor name) and grid/list of locations in glass cards; include vendor logo pill.
- Data: Use vendor + locations from Supabase (same payload as AppAuthContext).
- Interactions: Tap card → haptic light; show checkmark; proceed to register sheet.
- Offline: If cached locations exist, show them; badge for “Offline” and block proceed if selection not synced.

## Screen 3 – Select Register
- Entry: After location, before session; mirrors RN `POSRegisterSelector`.
- Layout: Glass sheet sliding up; list of registers with name, status (available/active), and small meta (last used).
- Actions: Back to Location (top-left chevron); select register advances to cash drawer logic if needed.
- States: Show skeletons while loading registers; disabled state for unavailable registers.

## Cash Drawer Modal (if needed)
- Modal: Center glass dialog with numeric pad for opening cash, notes textarea; primary “Open Drawer” and secondary “Cancel”.
- Validation: Require amount; show inline error; `notification(.error)` haptic on failure.
- After submit: Call `openCashDrawer`, then enter session.

## POS Shell (post-session)
- Layout: Matches RN split view: left cart/checkout column with glass container; right product browser (swipeable) full bleed; floating dock along bottom aligned to content center.
- Components:
  - Left: Cart + customer + payment steps; glass sections with sticky header.
  - Right: Product grid/list with filters and orders tab (as in RN’s swipeable browser).
  - Dock: Glass pill with tabs (POS, Products, Marketing) and badge counts.
- Motion: Fade/slide in on session ready; refresh Liquid Glass key when returning to screen (RN uses refreshKey).
- Realtime: Subscribe to inventory/pricing same as RN hooks; surface activity via subtle toasts.

## Data/State Parity
- Auth/session: Supabase auth; cached session restore; same “selectLocation → selectRegister → open/join session” sequence.
- Calls: `selectLocation`, `selectRegister` (returns needsCashDrawer/sessionId), `joinExistingSession`, `openCashDrawer`.
- Session context: Store `locationId`, `locationName`, `registerId`, `registerName`, `sessionId`, `vendor`.
- Logging: Reuse timeline logging pattern for actions (future).

## Visual System (true iOS polish)
- Typography: SF Pro Text/Display; weights matching RN tone (light for headers, medium for labels).
- Colors: Match RN tokens but lean into native translucency; adaptive for light/dark.
- Liquid Glass: Use layered blur + gradient borders; subtle shimmer only on hero elements (login logo, dock when idle).
- Haptics: Light on select; medium on primary actions; error notification on failures.
- Accessibility: Dynamic Type support for labels, VoiceOver labels on tabs/buttons, sufficient contrast on glass.

## Implementation Order
1) Build LiquidGlass SwiftUI components (card, pill, dock) + design tokens to mirror RN theme.
2) Implement Login screen with auth wiring and error handling.
3) Implement Location selector screen using cached/vendor data; then Register selector; then Cash Drawer modal.
4) Implement POS shell container (left/right panes, dock) with placeholder content; wire to existing Supabase endpoints.
5) Add realtime subscriptions and session refresh handling; polish motion/haptics/accessibility.
