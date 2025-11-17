# Whaletools Native - Feature Consolidation & Simplification Plan
## From 32 Pages to 8 Core Experiences

> "Simplicity is the ultimate sophistication." - Leonardo da Vinci (Apple's motto)

---

## EXECUTIVE SUMMARY

**Current State**: 32 vendor pages, massive feature redundancy, scattered UI
**Target State**: 8 unified experiences, zero redundancy, spatial organization

**Key Insight**: We don't have too many FEATURES - we have too many PLACES to access them.

---

## THE CONSOLIDATION STRATEGY

### Core Principle: "One Source of Truth"

Every piece of data lives in ONE place. Every feature is accessed through ONE logical path.

```
BEFORE (Web Prototype):
- Products page
- Labels page (uses product data)
- Inventory tab (inside products)
- Media library (separate)
- Product images (in products)
- TV menus (uses product data)
- POS (uses product data)

AFTER (Native App):
- Products (unified hub)
  ├─ Catalog management
  ├─ Inventory (integrated tab)
  ├─ Media (contextual)
  ├─ Labels (quick action)
  ├─ Preview on Display (live preview)
  └─ Pricing & Tiers (inline)
```

---

## THE 8 CORE EXPERIENCES

### 1. **THE COUNTER** (POS)
**Role**: Staff, Cashiers
**Purpose**: Ring up sales

**Consolidates**:
- POS register UI
- Customer lookup
- Loyalty redemption
- Payment processing
- Receipt printing
- Pickup queue
- Cash drawer management

**Interface**:
```
┌─────────────────────────────────────────┐
│  [Search or Scan Product]              │
├─────────────────────────────────────────┤
│                                         │
│  [Product Grid - Beautiful]            │
│                                         │
│  ┌───────────────────────┐             │
│  │ CART         $127.50  │             │
│  │ 3 items               │             │
│  │ [Line items]          │             │
│  │ [CHECKOUT]            │             │
│  └───────────────────────┘             │
└─────────────────────────────────────────┘

DOCK: [Counter] [Queue] [Customers] [Close]
```

**Hidden Complexity**:
- Session management happens automatically
- Tax calculation is invisible
- Payment processor health checks in background
- Inventory updates happen on sale completion

---

### 2. **PRODUCTS** (Catalog Hub)
**Role**: Managers, Staff
**Purpose**: Manage everything product-related

**Consolidates**:
- Product catalog
- Product creation/editing
- Bulk import
- Categories & subcategories
- Custom fields
- Pricing tiers & blueprints
- Inventory tracking
- Stock movements
- Stock adjustments
- COAs (lab results)
- Labels printing
- AI product enrichment
- Product images (from media)
- Digital signage preview

**Interface**:
```
┌─────────────────────────────────────────┐
│  PRODUCTS                               │
│  [Search] [Filter by Category ▼]       │
├─────────────────────────────────────────┤
│                                         │
│  VIEWS: [Grid] [List] [Inventory]      │
│                                         │
│  [Product Cards Grid]                  │
│   - Photo                               │
│   - Name                                │
│   - Price                               │
│   - Stock (3 locations)                │
│   - Quick actions                       │
│                                         │
└─────────────────────────────────────────┘

TAP PRODUCT → Modal with Tabs:
[Details] [Inventory] [Media] [Pricing] [Lab Results]

QUICK ACTIONS (Long Press):
- Edit
- Adjust Stock
- Print Label
- View on Display
- Duplicate
- Archive
```

**Key Innovation**: Everything related to a product is accessible from ONE place

**Inventory Tab** (inside Products):
```
PRODUCT: Blue Dream

INVENTORY BY LOCATION
├─ Downtown        47 units  [Adjust]
├─ West            23 units  [Adjust]
└─ Airport         12 units  [Adjust]

RECENT MOVEMENTS
├─ Sale: -1.0g (2m ago) - Register 2
├─ Adjustment: +5.0g (1h ago) - Sarah M.
└─ Transfer: -10.0g to West (yesterday)

ACTIONS
[Adjust Stock] [Transfer] [View Full History]
```

---

### 3. **CUSTOMERS** (Unified CRM)
**Role**: Managers, Staff
**Purpose**: Manage all customer relationships

**Consolidates**:
- Customer database
- Wholesale customers
- Loyalty members
- Customer segments
- Customer orders
- Lifetime value tracking
- Loyalty points management
- Apple Wallet passes

**Interface**:
```
┌─────────────────────────────────────────┐
│  CUSTOMERS                              │
│  [Search customers...]                  │
│  TYPE: [All] [Retail] [Wholesale] [VIP]│
├─────────────────────────────────────────┤
│                                         │
│  CUSTOMER CARDS                         │
│  ┌─────────────────────┐               │
│  │ 👤 John Smith       │               │
│  │ Loyalty: Gold ⭐    │               │
│  │ 1,250 points        │               │
│  │ $4,890 lifetime     │               │
│  │ Last order: 2d ago  │               │
│  └─────────────────────┘               │
│                                         │
└─────────────────────────────────────────┘

TAP CUSTOMER → Details:
[Profile] [Orders] [Loyalty] [Activity]
```

**Key Innovation**: One customer record, different contexts (retail/wholesale/loyalty)

**Customer Types** (via single field):
```typescript
type CustomerType = 'retail' | 'wholesale' | 'vip'

interface Customer {
  id: string
  type: CustomerType

  // Shared fields
  name: string
  email: string
  phone: string

  // Retail-specific
  loyaltyPoints?: number
  loyaltyTier?: string

  // Wholesale-specific
  companyName?: string
  creditLimit?: number
  paymentTerms?: string
  discountPercentage?: number

  // Computed
  lifetimeValue: number
  totalOrders: number
}
```

---

### 4. **MEDIA** (Asset Management)
**Role**: Managers, Marketing
**Purpose**: Manage all brand assets and imagery

**Consolidates**:
- Media library
- Product photos
- Marketing materials
- Brand assets (logos, banners)
- AI image generation
- AI image editing (upscale, remove BG)
- Menu display images
- Label graphics

**Interface**:
```
┌─────────────────────────────────────────┐
│  MEDIA                                  │
│  [Upload] [Generate with AI]           │
│  CATEGORY: [All] [Products] [Brand] [Marketing]
├─────────────────────────────────────────┤
│                                         │
│  [Grid of Images - Beautiful]          │
│   - Thumbnail                           │
│   - AI tags                             │
│   - Linked products                     │
│   - Quick actions                       │
│                                         │
└─────────────────────────────────────────┘

TAP IMAGE → Quick View:
- Full image
- Metadata (AI tags, description, colors)
- Linked to: [Products using this image]
- Actions: [Edit] [Remove BG] [Upscale] [Link to Product]

AI GENERATION FLOW:
[Generate] → [Describe what you want] → [Style options] → [Generate] → [Approve/Reject] → [Auto-link to products]
```

**Key Innovation**: Media is organized by USE, not by file type

---

### 5. **STORE** (Location Hub)
**Role**: Managers
**Purpose**: Manage THIS physical location

**Consolidates**:
- Location settings
- Business hours
- Tax configuration
- Team/staff at this location
- Terminals/registers
- Payment processors
- Today's activity
- Digital signage displays
- Store performance

**Interface**:
```
┌─────────────────────────────────────────┐
│  [Beautiful Store Photo]                │
│  CANNABIS CORNER - DOWNTOWN             │
│  123 Main St, Denver CO                 │
│  🟢 Open · Closes 9PM                   │
└─────────────────────────────────────────┘

TODAY'S SNAPSHOT
├─ Sales: $12,847 (↑23%)
├─ Transactions: 142
├─ Active: 3 registers
└─ Staff: Sarah, Mike, Alex

LIVE ACTIVITY (Real-time Feed)
├─ 🛒 Sale: $127.50 (2m ago)
├─ 📦 Stock adjusted: Blue Dream (5m)
├─ 👤 New customer: John D. (12m)

QUICK ACTIONS
┌─────┬─────┬─────┬─────┐
│ 🏪  │ 👥  │ 📺  │ ⚙️  │
│ POS │Team │ TV  │ Set │
└─────┴─────┴─────┴─────┘

DOCK: [Store] [Products] [Customers] [Orders] [More]
```

**Team Tab** (inside Store):
```
TEAM AT DOWNTOWN

WORKING NOW (3)
├─ Sarah Martinez (Manager)
│  └─ Register 1 • Session #142 • $4,200
├─ Mike Johnson (Cashier)
│  └─ Register 2 • Session #143 • $3,800
└─ Alex Chen (Cashier)
   └─ Register 3 • Session #144 • $4,847

SCHEDULED TODAY (5)
├─ 9am-5pm: Sarah, Mike, Alex
└─ 5pm-9pm: Jordan, Casey

ACTIONS
[Add Team Member] [View Schedules] [Permissions]
```

**Display Tab** (inside Store):
```
DIGITAL SIGNAGE

LIVE PREVIEW
┌─────────────────────────┐
│ [What customers see]    │
│ [Real menu display]     │
└─────────────────────────┘

CONNECTED SCREENS (3)
├─ 📺 Main Menu (55" Samsung) - Active
├─ 📺 Specials (43" LG) - Active
└─ 📺 Counter (iPad Pro) - Idle

ACTIONS
[Edit Layout] [Change Theme] [Add Screen]
```

**Settings Tab** (inside Store):
```
STORE CONFIGURATION

GENERAL
├─ Store name, address, hours
└─ Contact info (phone, email)

OPERATIONS
├─ Tax rate: 8.5%
├─ Payment processors (2 active)
└─ Receipt footer

COMPLIANCE
├─ Age verification
└─ Lab results requirements
```

**Key Innovation**: Location is the context, not a database record

---

### 6. **ORDERS** (Commerce Hub)
**Role**: Managers, Staff
**Purpose**: Manage all sales across channels

**Consolidates**:
- Order management (all channels)
- POS orders
- Online orders
- Pickup queue
- Shipping queue
- Order fulfillment
- Refunds/voids
- Order analytics

**Interface**:
```
┌─────────────────────────────────────────┐
│  ORDERS                                 │
│  [Search orders...]                     │
│  STATUS: [All] [New] [Ready] [Complete]│
│  CHANNEL: [All] [POS] [Online] [Wholesale]
├─────────────────────────────────────────┤
│                                         │
│  ORDER CARDS                            │
│  ┌─────────────────────┐               │
│  │ #142 • $127.50      │               │
│  │ John Smith          │               │
│  │ Pickup • Ready      │               │
│  │ 2 items • 5m ago    │               │
│  │ [Mark Picked Up]    │               │
│  └─────────────────────┘               │
│                                         │
└─────────────────────────────────────────┘

TAP ORDER → Details:
[Items] [Customer] [Payment] [Timeline]

QUICK FILTERS (Top Pills)
[New Orders (12)] [Ready for Pickup (8)] [Shipping (3)]
```

**Key Innovation**: All orders from all channels in one unified view

**Order Detail Tabs**:
```
ORDER #142

[ITEMS]
├─ Blue Dream 3.5g × 1    $45.00
├─ Gummies 10mg × 2       $60.00
└─ Pre-roll Pack × 1      $22.50

[CUSTOMER]
├─ John Smith
├─ john@email.com
├─ (303) 555-0123
└─ Loyalty: 1,250 points

[PAYMENT]
├─ Method: Card (Visa •••• 4242)
├─ Subtotal: $127.50
├─ Tax (8.5%): $10.84
└─ Total: $138.34 ✓ Paid

[TIMELINE]
├─ Order placed: 2:34 PM
├─ Payment confirmed: 2:34 PM
├─ Ready for pickup: 2:39 PM (5m)
└─ Next: Customer pickup
```

---

### 7. **MARKET** (Marketing Hub)
**Role**: Managers, Marketing
**Purpose**: Attract and retain customers

**Consolidates**:
- Email campaigns
- Customer segments
- Loyalty program configuration
- Promotions/discounts
- Apple Wallet passes
- Campaign analytics
- Review management

**Interface**:
```
┌─────────────────────────────────────────┐
│  MARKETING                              │
│  [Campaigns] [Loyalty] [Promotions]    │
├─────────────────────────────────────────┤
│                                         │
│  CAMPAIGNS (Email)                      │
│  ┌─────────────────────┐               │
│  │ 🎉 Weekend Sale     │               │
│  │ Scheduled: Fri 9AM  │               │
│  │ 1,247 recipients    │               │
│  │ [Edit] [Preview]    │               │
│  └─────────────────────┘               │
│                                         │
│  LOYALTY PROGRAM                        │
│  ├─ 847 members                         │
│  ├─ Avg: 430 points                    │
│  └─ [Configure]                         │
│                                         │
│  ACTIVE PROMOTIONS (3)                  │
│  ├─ WEEKEND20 (20% off)                │
│  ├─ FIRSTTIME (Free item)              │
│  └─ LOYALTY500 (500 points = $5)       │
│                                         │
└─────────────────────────────────────────┘

TAP CAMPAIGN → Edit:
[Template] [Recipients] [Schedule] [Preview]

LOYALTY CONFIG:
├─ Points per dollar: 1 point / $1
├─ Point value: $0.01 / point
├─ Tiers: Bronze, Silver, Gold, Platinum
└─ Rewards catalog
```

**Key Innovation**: All marketing tools in one hub, not scattered

---

### 8. **INSIGHTS** (Analytics Hub)
**Role**: Managers, Owners
**Purpose**: Understand business performance

**Consolidates**:
- Sales analytics
- Product performance
- Location performance
- Staff performance
- Customer analytics
- Inventory analytics
- Profit & loss
- Tax reporting
- Custom reports
- Export capabilities

**Interface**:
```
┌─────────────────────────────────────────┐
│  INSIGHTS                               │
│  📅 Last 30 days ▼                      │
├─────────────────────────────────────────┤
│                                         │
│  KEY METRICS                            │
│  ┌─────────────────────┐               │
│  │ REVENUE             │               │
│  │ $127,450            │               │
│  │ ↑ 23% vs prev       │               │
│  └─────────────────────┘               │
│                                         │
│  [Sales Chart - Beautiful Visualization]│
│                                         │
│  TOP PRODUCTS (This Period)            │
│  ├─ 1. Blue Dream     $23,450 (351u)  │
│  ├─ 2. Girl Scout     $18,200 (204u)  │
│  └─ 3. OG Kush       $15,890 (197u)  │
│                                         │
│  BY LOCATION                            │
│  ├─ Downtown    $67,200 ████████████   │
│  ├─ West        $42,100 ████████       │
│  └─ Airport     $18,150 ████           │
│                                         │
└─────────────────────────────────────────┘

DRILL DOWN:
Tap any metric → Detailed breakdown
Tap any product → Product performance details
Tap any location → Location analytics

QUICK ACTIONS:
[Export Report] [Custom Report] [Compare Periods]
```

**Key Innovation**: Progressive disclosure - overview → details → deep dive

---

## NAVIGATION ARCHITECTURE

### Role-Based Entry Points

```
USER ROLE: Cashier
└─ Opens to: THE COUNTER (POS)
   └─ Dock: [Counter] [Queue] [Customers] [Close]

USER ROLE: Manager
└─ Opens to: STORE (Location Hub)
   └─ Dock: [Store] [Products] [Customers] [Orders] [More]
       └─ More: [Media] [Market] [Insights]

USER ROLE: Owner/Admin
└─ Opens to: NETWORK (All Locations)
   └─ Dock: [Network] [Products] [Customers] [Orders] [Insights]
```

### The "More" Pattern

When you have >5 items, use "More" to access additional features:

```
PRIMARY DOCK (5 items max):
[Store] [Products] [Customers] [Orders] [More]

TAP "MORE" → Expands to secondary menu:
┌─────────────────────────────┐
│ MORE                        │
├─────────────────────────────┤
│ 📸 Media                    │
│ 📊 Marketing                │
│ 📈 Insights                 │
│ ⚙️  Settings                │
│ 📚 Help & Support           │
└─────────────────────────────┘
```

---

## FEATURE MAPPING: OLD → NEW

### Products & Catalog
| OLD WEB APP | NEW NATIVE APP |
|-------------|----------------|
| Products page | Products (hub) |
| Labels page | Products → Quick Action: Print Label |
| Suppliers page | Products → Tab: Suppliers |
| Lab Results page | Products → Tab: Lab Results |
| Inventory tab (in products) | Products → Tab: Inventory |
| Categories (separate) | Products → Filter by Category |
| Pricing tiers (separate) | Products → Product Detail → Pricing Tab |

### Customers
| OLD WEB APP | NEW NATIVE APP |
|-------------|----------------|
| Customers page | Customers (hub) |
| Wholesale customers page | Customers → Filter: Wholesale |
| Loyalty members (separate) | Customers → Filter: Loyalty Members |
| Customer segments | Customers → Segments (tab) |

### Media
| OLD WEB APP | NEW NATIVE APP |
|-------------|----------------|
| Media library | Media (hub) |
| Product images (in products) | Media → Filter: Product Photos |
| Brand assets (in branding) | Media → Filter: Brand Assets |
| AI image generation (separate) | Media → Action: Generate with AI |
| Image editing tools | Media → Select Image → Edit |

### Store Operations
| OLD WEB APP | NEW NATIVE APP |
|-------------|----------------|
| Locations page | Store → Select Location |
| Location settings | Store → Settings Tab |
| Employees/Team | Store → Team Tab |
| Terminals | Store → Settings → Terminals |
| Payment processors | Store → Settings → Payments |
| TV Menus | Store → Display Tab |

### Marketing
| OLD WEB APP | NEW NATIVE APP |
|-------------|----------------|
| Email campaigns | Market → Campaigns |
| Loyalty program config | Market → Loyalty Tab |
| Customer segments | Customers → Segments OR Market → Segments |
| Apple Wallet | Market → Loyalty → Wallet Passes |
| Promotions/discounts | Market → Promotions Tab |
| Reviews | Market → Reviews Tab |

### Sales & Orders
| OLD WEB APP | NEW NATIVE APP |
|-------------|----------------|
| Orders page | Orders (hub) |
| Pickup queue (in POS) | Orders → Filter: Pickup |
| Shipping queue | Orders → Filter: Shipping |
| Payouts | Orders → Tab: Payouts |

### Analytics
| OLD WEB APP | NEW NATIVE APP |
|-------------|----------------|
| Dashboard | Insights → Overview |
| Analytics page | Insights (hub) |
| Sales reports | Insights → Sales Tab |
| Product reports | Insights → Products Tab |
| Location reports | Insights → Locations Tab |
| Custom reports | Insights → Action: Custom Report |

### POS
| OLD WEB APP | NEW NATIVE APP |
|-------------|----------------|
| POS register | The Counter (dedicated mode) |
| Customer lookup (in POS) | Counter → Dock: Customers |
| Pickup queue (in POS) | Counter → Dock: Queue |
| Session management | Counter → Dock: Close (end shift) |

### Settings
| OLD WEB APP | NEW NATIVE APP |
|-------------|----------------|
| Vendor settings | Settings (global) |
| Location settings | Store → Settings Tab |
| Team/employees | Store → Team Tab |
| Terminals | Store → Settings → Terminals |
| Payment processors | Store → Settings → Payments |
| Branding | Settings → Branding |
| Website/domain | Settings → Website |

---

## DATA MODEL CONSOLIDATION

### Unified Customer Model
```typescript
interface Customer {
  // Identity
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string

  // Type & Role
  type: 'retail' | 'wholesale' | 'vip'

  // Retail Fields
  loyaltyPoints?: number
  loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'platinum'
  walletPassId?: string

  // Wholesale Fields
  companyName?: string
  taxId?: string
  creditLimit?: number
  paymentTerms?: 'net_30' | 'net_60' | 'due_on_receipt'
  discountPercentage?: number

  // Computed
  lifetimeValue: number
  totalOrders: number
  averageOrderValue: number
  lastOrderDate?: Date

  // Metadata
  createdAt: Date
  updatedAt: Date
  vendorId: string
}
```

### Unified Pricing Model
```typescript
interface ProductPricing {
  productId: string

  // Base Pricing
  basePrice: number
  costPrice?: number
  compareAtPrice?: number // For showing "was $X"

  // Tiered Pricing (quantity/weight breaks)
  tiers?: PricingTier[]

  // Context-based Pricing
  wholesalePricing?: {
    baseDiscount: number // percentage
    customDiscounts: Record<string, number> // customer-specific
  }

  // Dynamic Pricing
  categoryPricing?: {
    categoryId: string
    markup: number
  }
}

interface PricingTier {
  minQuantity: number
  price: number
  unit: 'g' | 'oz' | 'lb' | 'ea'
}
```

### Unified Order Model
```typescript
interface Order {
  id: string
  orderNumber: string

  // Source & Channel
  source: 'pos' | 'online' | 'wholesale' | 'manual'
  channel: 'in_store' | 'pickup' | 'delivery' | 'shipping'

  // Location
  locationId: string
  registerId?: string // if POS

  // Customer
  customerId?: string
  customerName: string
  customerEmail?: string
  customerPhone?: string

  // Items
  items: OrderItem[]

  // Pricing
  subtotal: number
  taxAmount: number
  shippingAmount?: number
  discountAmount?: number
  total: number

  // Payment
  paymentMethod: 'card' | 'cash' | 'check' | 'account'
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'void'
  paymentTransactionId?: string

  // Fulfillment
  fulfillmentStatus: 'pending' | 'ready' | 'completed' | 'cancelled'
  fulfillmentDate?: Date

  // Tracking
  trackingNumber?: string
  carrier?: string

  // Metadata
  createdAt: Date
  createdBy: string // user ID
  notes?: string
}
```

### Unified Media Model
```typescript
interface MediaAsset {
  id: string

  // File Info
  url: string
  filename: string
  mimeType: string
  size: number
  width?: number
  height?: number

  // Organization
  category: 'product' | 'brand' | 'marketing' | 'menu'
  tags: string[] // user tags + AI tags

  // AI Metadata
  aiDescription?: string
  aiTags?: string[]
  dominantColors?: string[]
  qualityScore?: number

  // Usage
  linkedProducts?: string[] // product IDs using this image
  linkedTo?: string[] // generic links to other entities

  // Variants (generated)
  variants?: {
    thumbnail: string
    small: string
    medium: string
    large: string
    original: string
  }

  // Metadata
  uploadedBy: string
  createdAt: Date
  updatedAt: Date
}
```

---

## COMPONENT CONSOLIDATION

### Before: Scattered Components
```
OLD:
- ProductCard
- ProductCardGrid
- ProductCardList
- ProductCardCompact
- InventoryProductCard
- POSProductCard
- TVMenuProductCard
```

### After: Unified Product Component
```typescript
<ProductCard
  product={product}
  variant="grid" | "list" | "compact" | "pos" | "display"
  showInventory={boolean}
  showPricing={boolean}
  showActions={boolean}
  onTap={handler}
  onLongPress={handler}
/>
```

**One component, multiple contexts** - configured via props, not duplicated code.

### Before: Multiple Customer Components
```
OLD:
- CustomerCard
- CustomerListItem
- WholesaleCustomerCard
- LoyaltyMemberCard
- POSCustomerLookup
```

### After: Unified Customer Component
```typescript
<CustomerCard
  customer={customer}
  variant="card" | "list" | "detail" | "pos"
  showLoyalty={boolean}
  showOrders={boolean}
  showWholesale={boolean}
  onSelect={handler}
/>
```

### Before: Multiple Order Components
```
OLD:
- OrderCard
- OrderListItem
- POSOrderCard
- PickupQueueCard
- ShippingQueueCard
```

### After: Unified Order Component
```typescript
<OrderCard
  order={order}
  variant="card" | "list" | "pos" | "queue"
  showCustomer={boolean}
  showItems={boolean}
  showActions={boolean}
  onTap={handler}
  actions={[]}
/>
```

---

## API CONSOLIDATION

### Before: Redundant Endpoints
```
OLD:
GET /api/vendor/products
GET /api/vendor/products/inventory
GET /api/vendor/inventory/products
GET /api/pos/products
GET /api/tv-display/products
```

### After: Unified Product API
```
NEW:
GET /api/products
  ?include=inventory,pricing,media,lab_results
  &location_id=xxx
  &context=pos|display|catalog

Returns EXACTLY what you need for the context
```

### Before: Multiple Customer Endpoints
```
OLD:
GET /api/vendor/customers
GET /api/vendor/wholesale-customers
GET /api/vendor/loyalty/members
GET /api/pos/customers/lookup
```

### After: Unified Customer API
```
NEW:
GET /api/customers
  ?type=retail|wholesale|all
  &include=loyalty,orders,stats
  &search=term

Single endpoint, filtered by type
```

---

## IMPLEMENTATION PHASES

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Build the design system and navigation

- [ ] LiquidGlass component library
- [ ] Unified Product component (all variants)
- [ ] Unified Customer component (all variants)
- [ ] Unified Order component (all variants)
- [ ] Context-aware Dock navigation
- [ ] Role-based routing

### Phase 2: The Counter (Weeks 3-4)
**Goal**: Perfect the POS experience

- [ ] POS product grid
- [ ] POS cart with unified pricing
- [ ] Payment flow
- [ ] Customer lookup (unified)
- [ ] Session management
- [ ] Queue management (pickup/shipping)

### Phase 3: Products Hub (Weeks 5-6)
**Goal**: Consolidate all product features

- [ ] Product catalog (grid/list)
- [ ] Product detail with tabs
- [ ] Inventory tab (per-location stock)
- [ ] Media tab (linked images)
- [ ] Pricing tab (tiers & wholesale)
- [ ] Lab results tab
- [ ] Quick actions (label print, adjust stock)

### Phase 4: Customers & Orders (Week 7)
**Goal**: Unified customer & order management

- [ ] Customer hub (all types)
- [ ] Customer detail tabs
- [ ] Order hub (all channels)
- [ ] Order detail tabs
- [ ] Fulfillment workflows

### Phase 5: Store & Media (Week 8)
**Goal**: Location management & asset hub

- [ ] Store hub (location overview)
- [ ] Team tab
- [ ] Display tab (digital signage)
- [ ] Settings tab
- [ ] Media hub (unified library)
- [ ] AI generation integration

### Phase 6: Marketing & Insights (Week 9)
**Goal**: Marketing tools & analytics

- [ ] Marketing hub
- [ ] Email campaigns
- [ ] Loyalty configuration
- [ ] Insights hub
- [ ] Analytics dashboards
- [ ] Custom reports

### Phase 7: Polish & Performance (Week 10)
**Goal**: Make it feel like an Apple product

- [ ] Micro-interactions
- [ ] Loading states (skeleton screens)
- [ ] Error states
- [ ] Offline mode
- [ ] Haptic feedback everywhere
- [ ] 60fps animations
- [ ] Accessibility (VoiceOver)

---

## SUCCESS METRICS

### Simplicity Metrics
- ✅ 8 core experiences (down from 32 pages)
- ✅ Max 3 taps to any feature (down from 5+)
- ✅ 5 dock items max (down from 15+ sidebar links)
- ✅ Zero duplicate components (down from 47 redundant components)

### Performance Metrics
- ✅ <1s app launch
- ✅ <200ms screen transitions
- ✅ 60fps throughout
- ✅ Works offline for core features

### User Experience Metrics
- ✅ Zero training for new users
- ✅ NPS score >80
- ✅ 95% feature discovery (users find features without help)
- ✅ 50% reduction in support tickets

---

## THE APPLE DIFFERENCE APPLIED

### 1. FOCUS
**Before**: 32 pages competing for attention
**After**: 8 experiences, each with ONE clear purpose

### 2. ELIMINATION
**Before**: Every feature gets its own page
**After**: Related features grouped in tabs/actions within a hub

### 3. ORGANIZATION
**Before**: Organized by database tables (Products, Customers, Orders)
**After**: Organized by USER INTENT (What am I trying to do?)

### 4. PROGRESSIVE DISCLOSURE
**Before**: Everything visible all the time
**After**: Start simple, reveal complexity only when needed

### 5. SPATIAL THINKING
**Before**: Navigation mimics web sitemap
**After**: Navigation mirrors physical/mental space

---

## FINAL VISION STATEMENT

**Whaletools Native doesn't just port the web app to mobile.**
**It REIMAGINES retail management through the lens of spatial computing.**

Every feature exists.
Every capability remains.
But the EXPERIENCE is transformed.

From scattered → unified
From complex → simple
From functional → delightful

**That's not just better design.**
**That's the Apple standard.**

---

*"Innovation is saying no to 1,000 things." - Steve Jobs*

We said no to:
- ❌ 32 separate pages
- ❌ Duplicate components
- ❌ Redundant data models
- ❌ Scattered navigation
- ❌ Feature bloat

We said yes to:
- ✅ 8 unified experiences
- ✅ One source of truth
- ✅ Context-aware UI
- ✅ Progressive disclosure
- ✅ Spatial organization

**This is Whaletools Native.**
