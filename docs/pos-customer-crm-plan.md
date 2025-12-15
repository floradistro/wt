# POS Customer Modal – Marketing/CRM Consolidation Plan

Goal: make the POS customer card the staff-facing, low-key CRM hub. Everything is staff-only, minimal UI, and action-driven (one-tap where possible).

## Wallet & Loyalty (staff-facing, subdued)
- Collapsed “Wallet & Loyalty” row with a state pill (Active/Missing/Expired), device count, and points/tier snapshot.
- Actions (behind a small chevron):
  - Reissue pass.
  - Resend QR/link or “Reinstall on this device.”
  - Push wallet update toggle (send balance/offers to pass).
  - Device list (collapsible) with “Remove device.”
- Eligible offers count; expand to small chips with expiry; tap to apply best offer to cart.
- “Points to next tier” and last earn/redeem line inline under the row.

## Marketing & Campaigns (staff-only)
- Segment chips (VIP, Win-back, Delivery, etc.) and meta audience membership; toggles to include/exclude without leaving POS.
- “Next best action” chip (discount/upsell/win-back) driven by rules/AI; one-tap apply to cart.
- “Follow-up” row with one-tap sends: Email / SMS / Wallet push using prefilled templates from Marketing; send quietly and log.

## Offers & Discounts
- Inline “Apply best discount” button that auto-picks from active promos + eligibility; shows the line item after applying.
- Cart-aware upsell: single suggested add-on row (AI-picked) with “Add” button; disappears after action.

## Activity & Logging
- Every action (reissue, apply offer, send message, toggle audience) writes a short entry to the customer timeline; tiny toast only.
- Quick staff note pinned at the top.

## Data Plumbing Needed
- Extend customer fetch to include: wallet status + devices, loyalty stats, segments, audience memberships, eligible offers/discounts, campaign templates.
- Service endpoints/actions:
  - Reissue pass, push wallet update, resend QR/link.
  - Send email/SMS/push from templates.
  - Apply discount to cart.
  - Toggle segment/audience membership.

## Later: Conversation Capture
- Always-on (setting-gated) when a customer is selected; session stops on deselect/checkout.
- Mic → ASR → summary + tags → attach to customer timeline and current order.
- Extract intents (discount requests, delivery vs pickup, product mentions), sentiment/urgency, and suggest follow-ups/discounts automatically.
- Minimal UI: small “Listening” indicator + peekable transcript; actions surfaced as “Next best action” updates.***

---

# New Swift POS (Liquid Glass) – Delivery Plan

Use the existing app’s feature set as the source of truth, but rebuild the surface in native SwiftUI with Apple-style “liquid glass” treatments. Everything here is staff-facing, minimal, and favors one-tap actions.

## Core Principles
- Liquid Glass everywhere that matters: customer modal, action rows, bottom dock; keep motion subtle (breathing shimmer only on hero states).
- Fast attach + fast act: search/scan → attach customer → one-tap actions (offers, messaging, wallet).
- Quiet logging: every action writes to the timeline; UI stays unobtrusive (toasts only).
- Offline-friendly: cache customer snapshot + queued actions; reconcile when back online.

## Client Architecture (SwiftUI)
- Shell: SwiftUI + async/await; NavigationStack for flows; `ObservableObject` feature stores; small shared design system for Liquid Glass cards, pills, and chips.
- Data layer: Supabase/PostgREST + RPC functions; typed models + DTO mappers; offline cache via SQLite/CoreData; action queue for “send later” (emails/SMS/offers).
- Feature modules:
  - `CustomerProfile`: fetch/attach/detach; base identity + contact.
  - `WalletLoyalty`: wallet devices, pass state, points/tier, eligible offers.
  - `MarketingActions`: segments/audiences, template catalog, send email/SMS/wallet push.
  - `OffersDiscounts`: apply best discount; upsell suggestion; cart bridge.
  - `ActivityLog`: append timeline events; staff notes; show recent actions.
- Services to mirror old app behaviors: PassKit reissue/resend, offer application, message senders (email/SMS/push), segment toggles.

## Data Contracts (supabase/Postgres-backed)
- Customer fetch (one call) should return:
  - Identity: id, name, primary email/phone, verified flags.
  - Wallet: pass status, device list (id, name, lastActiveAt), eligible offers summary, last update pushed at.
  - Loyalty: points, tier, pointsToNextTier, lastEarn/lastRedeem.
  - Segments/Audiences: list of ids + labels + membership booleans.
  - Marketing templates: ids for email/SMS/wallet push follow-ups.
  - Offers/discounts: best applicable promo id, list of eligible offers with expiry and cart constraints.
- Actions (RPC/REST):
  - `reissue_pass(customer_id, device_id?)`, `push_wallet_update(customer_id)`, `resend_pass_link(customer_id, channel)`.
  - `send_message(customer_id, channel, template_id, order_id?, staff_id)` for Email/SMS/Wallet push.
  - `apply_best_discount(customer_id, order_id)` and `apply_offer(offer_id, order_id)`.
  - `toggle_segment_membership(customer_id, segment_id, is_member)`.
  - `log_timeline_event(customer_id, type, metadata, order_id?, staff_id)`.

## UI/Flows (SwiftUI + Liquid Glass)
- Entry: attach customer via search/scan; shows glass dock row with wallet pill (status + devices count) and segments chips.
- Customer modal (glass card):
  - Wallet & Loyalty row (collapsed by default) with state pill; chevron reveals device list + actions (reissue, resend, push update, remove device).
  - Marketing & Campaigns row with segment chips and “Next best action” chip; toggles don’t navigate away.
  - Offers & Discounts row with “Apply best discount” and one upsell chip; shows applied line on success.
  - Follow-up row with quick send buttons (Email / SMS / Wallet push) using selected template; quiet toast + timeline entry.
  - Activity strip showing latest 3 events; “Add note” stays pinned.
- Cart bridge: `CartService` observer updates upsell/discount eligibility; actions mutate cart then refresh summary.
- Offline/failed actions: glass pill badge shows “Queued”; timeline logs when reconciled.

## Build Sequence (phased)
1) Skeleton app shell + design tokens + Liquid Glass components (cards, pills, dock).  
2) Customer attach + fetch pipeline with combined payload + cache.  
3) Wallet/Loyalty module (read + actions) + timeline logging.  
4) Marketing/Follow-up senders + segment toggles + queued send.  
5) Offers/Discounts with cart bridge + upsell suggestion service.  
6) Offline queue/retry + activity strip polish + accessibility pass.
