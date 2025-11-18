# Complete Order Workflow Analysis
## Apple Engineering + Complete Staff Toolset

---

## The 4 Order Types - Complete Picture

```
┌──────────────┬────────────────────────────────────────────────────────┐
│ Order Type   │ Customer Journey                                       │
├──────────────┼────────────────────────────────────────────────────────┤
│ Walk-in      │ Customer walks in → Buys → Pays → Leaves              │
│              │ (Instant POS sale, no fulfillment)                     │
├──────────────┼────────────────────────────────────────────────────────┤
│ Pickup       │ Customer orders online → Staff prepares →              │
│              │ Customer picks up at store → Complete                  │
│              │ (Local, same-day or next-day)                          │
├──────────────┼────────────────────────────────────────────────────────┤
│ Delivery     │ Customer orders online → Staff prepares →              │
│              │ Driver delivers locally → Complete                     │
│              │ (Local delivery within service area)                   │
├──────────────┼────────────────────────────────────────────────────────┤
│ Shipping     │ Customer orders online → Staff packs →                 │
│              │ USPS/FedEx ships → Delivered → Complete               │
│              │ (Nationwide shipping, tracking, labels)                │
└──────────────┴────────────────────────────────────────────────────────┘
```

---

## Staff Needs - Complete Toolset

### What Staff Actually Need to See:

✅ **Active Orders** (needs their attention)
✅ **Today's History** (for customer service, quick lookups)
✅ **Complete History** (returns, disputes, reporting)
✅ **Shipping Tools** (labels, tracking, packing slips)

---

## Orders Screen - Redesigned Navigation

### Left Sidebar:

```
┌───────────────────────────┐
│  ACTIVE ORDERS            │
├───────────────────────────┤
│  🔔 Needs Action       3  │ ← Smart filter: What needs staff NOW
│  📦 Being Prepared     5  │ ← Orders staff are working on
│                           │
│  ORDER TYPES              │
├───────────────────────────┤
│  📍 Pickup             2  │ ← Only active pickup orders
│  🚗 Delivery           1  │ ← Only active delivery orders
│  📮 Shipping           2  │ ← Only active shipping orders
│                           │
│  HISTORY                  │
├───────────────────────────┤
│  💰 Walk-in Today    198  │ ← Today's POS sales
│  📅 All Orders       247  │ ← Complete history
│  🔍 Search Orders         │ ← Find any order ever
│                           │
│  REPORTS                  │
├───────────────────────────┤
│  📊 Today's Sales         │
│  📈 This Week             │
│  🗓️ This Month            │
└───────────────────────────┘
```

### Key Filters Explained:

**🔔 Needs Action** (Priority #1)
- Pickup: `pending` or `ready` (needs staff to prepare or hand off)
- Delivery: `pending` or `out_for_delivery` (needs prep or delivery confirmation)
- Shipping: `pending` or `ready_to_ship` (needs packing or label printing)
- Walk-in: NEVER shows here (auto-completed)

**📦 Being Prepared**
- All orders with status `preparing`
- Shows what staff is actively working on
- Useful for teamwork: "I'm already packing that order"

**💰 Walk-in Today**
- All POS sales from today
- For customer service: "Did you buy this today?"
- For reporting: "How many walk-in sales today?"
- All auto-completed, no action needed

**📅 All Orders**
- Complete history
- Searchable by date range, customer, order number
- For returns, disputes, inventory audits

---

## Shipping Orders - Complete Workflow

### Status Progression:
```
┌─────────┐   ┌────────────┐   ┌────────────────┐   ┌──────────────┐   ┌───────────┐
│ PENDING │→ │ PREPARING  │→ │ READY_TO_SHIP  │→ │   SHIPPED    │→ │ DELIVERED │
└─────────┘   └────────────┘   └────────────────┘   └──────────────┘   └───────────┘
  (Orange)      (Blue)            (Purple)             (Purple)           (Green)

   Staff           Staff            Staff             Auto from          Auto from
   clicks       packs items      prints label        tracking API       tracking API
   "Prepare"    + marks ready    + ships package
```

### Shipping Order Detail View:

```
┌─────────────────────────────────────────────────────────┐
│ ← Orders                                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Mike Thompson                                          │
│  Shipping Order • #SHP-20251118-0045                    │
│  🟣 READY TO SHIP                                       │
│                                                         │
│  SHIPPING ADDRESS                                       │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Mike Thompson                                     │ │
│  │ 123 Main Street, Apt 4B                          │ │
│  │ New York, NY 10001                               │ │
│  │ (212) 555-0199                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ITEMS (3) - Total Weight: 0.5 lbs                     │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ✓ Blue Dream (3.5g)              $45.00          │ │
│  │ ✓ Gummies (100mg)                $28.00          │ │
│  │ ✓ Pre-rolls (5pk)                $35.00          │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  PACKAGE DETAILS                                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Weight: 0.5 lbs                                   │ │
│  │ Dimensions: 8" × 6" × 4" (auto-calculated)       │ │
│  │ Service: USPS Priority Mail                      │ │
│  │ Est. Delivery: Nov 20-22                         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│  ┃  📄 Print Shipping Label + Packing Slip         ┃ │ ← Primary action
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                         │
│  [ 📦 Mark as Shipped ]                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### After Clicking "Print Shipping Label":

```
┌─────────────────────────────────────────────────────────┐
│  SHIPPING LABEL READY                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📄 Documents Generated:                                │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ✓ Shipping Label (4x6)                            │ │
│  │ ✓ Packing Slip                                    │ │
│  │ ✓ Return Label (optional)                         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Tracking Number: 9400111899562843657891                │
│  Postage Paid: $8.95                                    │
│                                                         │
│  [ 🖨️ Print Labels ]  [ 📧 Email to Customer ]         │
│                                                         │
│  After printing and affixing label:                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│  ┃  ✓ Confirm Package Shipped                       ┃ │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Shipped Order Detail:

```
┌─────────────────────────────────────────────────────────┐
│ ← Orders                                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Mike Thompson                                          │
│  Shipping Order • #SHP-20251118-0045                    │
│  🟣 IN TRANSIT                                          │
│                                                         │
│  TRACKING                                               │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Tracking: 9400111899562843657891                 │ │
│  │                                                   │ │
│  │ ● Shipped from Charlotte, NC - Nov 18, 2:30 PM  │ │
│  │ ● In Transit - Nov 19, 8:00 AM                  │ │
│  │ ● Out for Delivery - Nov 20, 9:00 AM            │ │
│  │ ○ Expected Delivery - Nov 20, 5:00 PM           │ │
│  │                                                   │ │
│  │ [ 🔗 View Full Tracking on USPS.com ]            │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  PACKAGE DETAILS                                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Service: USPS Priority Mail                      │ │
│  │ Shipped: Nov 18, 2024 at 2:30 PM                │ │
│  │ Shipped by: Sarah Johnson                        │ │
│  │ Postage: $8.95                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [ 📄 Reprint Label ]  [ 📧 Resend Tracking ]          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Shipping Integration - Technical Details

### Supported Carriers:

**Phase 1 (Launch):**
- USPS (Priority Mail, First Class, Priority Express)
- Automatic tracking updates via USPS API

**Phase 2 (Future):**
- FedEx
- UPS
- DHL

### Integration with Shippo/EasyPost:

```typescript
// Example: Print shipping label
async function createShippingLabel(orderId: string) {
  const order = await getOrderById(orderId)

  // 1. Create shipment with Shippo API
  const shipment = await shippo.createShipment({
    addressFrom: {
      name: "WhaleTools Charlotte",
      street1: "123 Store St",
      city: "Charlotte",
      state: "NC",
      zip: "28202",
      country: "US"
    },
    addressTo: {
      name: order.shipping_name,
      street1: order.shipping_address_line1,
      street2: order.shipping_address_line2,
      city: order.shipping_city,
      state: order.shipping_state,
      zip: order.shipping_zip,
      country: "US"
    },
    parcels: [{
      length: "8",
      width: "6",
      height: "4",
      weight: "0.5",
      distance_unit: "in",
      mass_unit: "lb"
    }]
  })

  // 2. Buy cheapest label (or let staff choose)
  const rate = shipment.rates.find(r => r.servicelevel.token === "usps_priority")
  const transaction = await shippo.createTransaction(rate.object_id)

  // 3. Save tracking number to order
  await updateOrder(orderId, {
    tracking_number: transaction.tracking_number,
    tracking_url: transaction.tracking_url_provider,
    shipping_label_url: transaction.label_url,
    postage_paid: transaction.rate,
    status: 'shipped',
    shipped_at: new Date(),
    shipped_by_user_id: currentUser.id
  })

  // 4. Notify customer
  await sendEmail({
    to: order.customer_email,
    subject: `Your order #${order.order_number} has shipped!`,
    template: 'order-shipped',
    data: {
      trackingNumber: transaction.tracking_number,
      trackingUrl: transaction.tracking_url_provider,
      estimatedDelivery: transaction.estimated_delivery
    }
  })

  // 5. Return label URL for printing
  return {
    labelUrl: transaction.label_url,
    packingSlipUrl: generatePackingSlip(order),
    trackingNumber: transaction.tracking_number
  }
}
```

### Automatic Tracking Updates:

```typescript
// Webhook from Shippo for tracking updates
app.post('/api/webhooks/shippo', async (req) => {
  const event = req.body

  if (event.event === 'track_updated') {
    const tracking = event.data

    // Find order by tracking number
    const order = await findOrderByTracking(tracking.tracking_number)

    // Update order status based on tracking
    if (tracking.status === 'DELIVERED') {
      await updateOrder(order.id, {
        status: 'completed',
        delivered_at: new Date(tracking.status_date),
        delivery_confirmed_by: 'usps_tracking'
      })

      // Notify customer
      await sendEmail({
        to: order.customer_email,
        subject: `Your order has been delivered!`,
        template: 'order-delivered'
      })
    }

    // Log tracking event for customer to see
    await createTrackingEvent({
      order_id: order.id,
      status: tracking.status,
      location: tracking.location,
      timestamp: tracking.status_date,
      message: tracking.status_details
    })
  }
})
```

---

## Order History - Smart Search & Filters

### Search Interface:

```
┌─────────────────────────────────────────────────────────┐
│  ALL ORDERS                                   🔍        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Search by order #, customer, phone, email...    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  FILTERS:                                               │
│  ┌────────────┬────────────┬────────────┬───────────┐  │
│  │ All Types ▼│  Any Date ▼│ All Staff ▼│ Export ▼  │  │
│  └────────────┴────────────┴────────────┴───────────┘  │
│                                                         │
│  Showing 247 orders • Total: $12,459.87                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Today - Nov 18, 2024                                   │
│  ┌───────────────────────────────────────────────────┐ │
│  │ #WLK-001 • 10:45 AM • Walk-in  • $45  • ✓ Paid  │ │
│  │ John Smith                                        │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ #PK-0234 • 10:30 AM • Pickup   • $89  • ⏱ Ready │ │
│  │ Sarah Johnson                                     │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ #SHP-0045 • 9:15 AM • Shipping • $108 • 📦 Ship. │ │
│  │ Mike Thompson                                     │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Yesterday - Nov 17, 2024                               │
│  ┌───────────────────────────────────────────────────┐ │
│  │ #WLK-198 • 6:45 PM • Walk-in   • $72  • ✓ Paid  │ │
│  │ ...                                               │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Quick Stats at Top:

```
┌─────────────────────────────────────────────────────────┐
│  TODAY'S SUMMARY                                        │
├─────────────────────────────────────────────────────────┤
│  💰 $8,910.00    198 Walk-in                           │
│  📍 $1,290.00     15 Pickup                            │
│  🚗   $890.00      8 Delivery                          │
│  📮   $369.87      4 Shipping                          │
│  ─────────────────────────────────────────────────────  │
│  Total: $11,459.87 • 225 orders                        │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema - Complete

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,

  -- Order Type (NEW)
  order_type VARCHAR(20) NOT NULL, -- 'walk_in', 'pickup', 'delivery', 'shipping'

  -- Customer
  customer_id UUID REFERENCES customers(id),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),

  -- Location
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  pickup_location_id UUID REFERENCES locations(id), -- Where order is fulfilled from

  -- Shipping Address (for shipping orders only)
  shipping_name VARCHAR(255),
  shipping_address_line1 VARCHAR(255),
  shipping_address_line2 VARCHAR(255),
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(50),
  shipping_zip VARCHAR(20),
  shipping_country VARCHAR(2) DEFAULT 'US',
  shipping_phone VARCHAR(20),

  -- Status Workflow
  status VARCHAR(30) NOT NULL,
  -- walk_in: 'completed'
  -- pickup: 'pending', 'preparing', 'ready', 'completed', 'cancelled'
  -- delivery: 'pending', 'preparing', 'out_for_delivery', 'completed', 'cancelled'
  -- shipping: 'pending', 'preparing', 'ready_to_ship', 'shipped', 'in_transit', 'delivered', 'cancelled'

  -- Payment
  payment_status VARCHAR(30) NOT NULL,
  payment_method VARCHAR(50),

  -- Money
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0, -- For shipping orders
  total_amount DECIMAL(10,2) NOT NULL,

  -- Fulfillment Tracking
  prepared_by_user_id UUID REFERENCES users(id),
  prepared_at TIMESTAMP,

  -- Pickup/Delivery Specific
  ready_at TIMESTAMP, -- When order was marked ready
  notified_at TIMESTAMP, -- When customer was notified
  picked_up_at TIMESTAMP,
  delivered_at TIMESTAMP,
  delivered_by_user_id UUID REFERENCES users(id),

  -- Shipping Specific
  tracking_number VARCHAR(100),
  tracking_url TEXT,
  shipping_label_url TEXT,
  shipping_carrier VARCHAR(50), -- 'usps', 'fedex', 'ups'
  shipping_service VARCHAR(100), -- 'priority_mail', 'ground', etc.
  postage_paid DECIMAL(10,2),
  package_weight DECIMAL(10,3), -- in lbs
  package_length DECIMAL(10,2), -- in inches
  package_width DECIMAL(10,2),
  package_height DECIMAL(10,2),
  shipped_at TIMESTAMP,
  shipped_by_user_id UUID REFERENCES users(id),
  estimated_delivery_date DATE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Notes
  customer_notes TEXT,
  staff_notes TEXT,

  -- Indexes for performance
  INDEX idx_order_type (order_type),
  INDEX idx_status (status),
  INDEX idx_location (pickup_location_id),
  INDEX idx_created (created_at DESC),
  INDEX idx_tracking (tracking_number)
);

-- Tracking Events (for shipping orders)
CREATE TABLE order_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  status VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  message TEXT,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_order (order_id),
  INDEX idx_timestamp (timestamp DESC)
);
```

---

## Migration Strategy

### Step 1: Add New Fields
```sql
-- Add order_type column
ALTER TABLE orders ADD COLUMN order_type VARCHAR(20);

-- Add shipping fields
ALTER TABLE orders ADD COLUMN shipping_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN shipping_address_line1 VARCHAR(255);
ALTER TABLE orders ADD COLUMN shipping_address_line2 VARCHAR(255);
ALTER TABLE orders ADD COLUMN shipping_city VARCHAR(100);
ALTER TABLE orders ADD COLUMN shipping_state VARCHAR(50);
ALTER TABLE orders ADD COLUMN shipping_zip VARCHAR(20);
ALTER TABLE orders ADD COLUMN shipping_country VARCHAR(2) DEFAULT 'US';
ALTER TABLE orders ADD COLUMN shipping_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN tracking_url TEXT;
ALTER TABLE orders ADD COLUMN shipping_label_url TEXT;
ALTER TABLE orders ADD COLUMN shipping_carrier VARCHAR(50);
ALTER TABLE orders ADD COLUMN shipping_service VARCHAR(100);
ALTER TABLE orders ADD COLUMN postage_paid DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN shipping_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN package_weight DECIMAL(10,3);
ALTER TABLE orders ADD COLUMN package_length DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN package_width DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN package_height DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN shipped_by_user_id UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN estimated_delivery_date DATE;
ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN delivered_by_user_id UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN prepared_by_user_id UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN prepared_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN ready_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN notified_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN picked_up_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN staff_notes TEXT;
```

### Step 2: Migrate Existing Data
```sql
-- Set order_type based on delivery_type
UPDATE orders
SET order_type = CASE
  WHEN delivery_type = 'instore' THEN 'walk_in'
  WHEN delivery_type = 'pickup' THEN 'pickup'
  WHEN delivery_type = 'delivery' THEN 'delivery'
  ELSE 'walk_in'
END;

-- Auto-complete all walk-in orders
UPDATE orders
SET
  status = 'completed',
  completed_at = created_at
WHERE order_type = 'walk_in'
  AND payment_status = 'paid'
  AND status != 'completed';

-- Update status terminology for pickup/delivery
UPDATE orders
SET status = CASE
  WHEN status = 'processing' THEN 'preparing'
  ELSE status
END
WHERE order_type IN ('pickup', 'delivery', 'shipping');
```

### Step 3: Create Tracking Events Table
```sql
CREATE TABLE order_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  message TEXT,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tracking_order ON order_tracking_events(order_id);
CREATE INDEX idx_tracking_timestamp ON order_tracking_events(timestamp DESC);
```

---

## POS Updates - Auto-Complete Walk-in

### Update POS Sale Creation:

```typescript
// In src/services/pos.service.ts or wherever POS creates orders

async function createPOSSale(saleData: POSSaleData) {
  const order = await supabase
    .from('orders')
    .insert({
      order_type: 'walk_in', // NEW: Always walk_in for POS
      status: 'completed', // NEW: Auto-complete
      payment_status: 'paid', // Payment succeeded
      customer_id: saleData.customer_id,
      pickup_location_id: saleData.location_id, // Where sale happened
      vendor_id: saleData.vendor_id,
      subtotal: saleData.subtotal,
      tax_amount: saleData.tax,
      discount_amount: saleData.discount,
      total_amount: saleData.total,
      payment_method: saleData.payment_method,
      completed_at: new Date(), // NEW: Mark completed timestamp
      created_at: new Date(),
      updated_at: new Date(),
    })
    .select()
    .single()

  // Create order items...

  return order
}
```

---

## Staff Tools Summary

### What Staff Can Do:

**Active Orders Tab:**
- See only orders that need action
- Quick filters by order type
- One-click status updates
- Print labels/packing slips

**History Tab:**
- Search any order
- Filter by date, type, staff
- Export for reports
- Customer service lookups

**Shipping Tools:**
- Print USPS labels in one click
- Track packages automatically
- Reprint labels if needed
- See delivery status

**Reports:**
- Daily sales by type
- Weekly/monthly summaries
- Staff performance
- Inventory impact

---

## Implementation Priority - Revised

### Phase 1: Core Workflow (This Week)
1. ✅ Add `order_type` field to database
2. ✅ Migrate existing data
3. ✅ Update POS to create `walk_in` orders (auto-complete)
4. ✅ Add "Needs Action" smart filter
5. ✅ Add "Being Prepared" filter
6. ✅ Add "Walk-in Today" history view
7. ✅ Update order detail views with order type badges

### Phase 2: Shipping Integration (Next Week)
1. ✅ Add shipping fields to database
2. ✅ Integrate Shippo API
3. ✅ Build label printing UI
4. ✅ Add tracking webhook
5. ✅ Auto-update order status from tracking
6. ✅ Customer email notifications

### Phase 3: Enhanced Features (Following Weeks)
1. ⏳ Packing slip generation
2. ⏳ Return labels
3. ⏳ Multi-package shipments
4. ⏳ International shipping
5. ⏳ Delivery driver app
6. ⏳ Customer delivery tracking page

---

*"Staff should spend their time helping customers, not managing software."* - Apple Design Principle
