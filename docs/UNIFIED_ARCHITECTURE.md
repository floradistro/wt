# WhaleTools Unified Architecture
## The Complete System - Aligned & Coherent

> Reconciling: Permissions + Spatial Design + Feature Consolidation + Collaboration

---

## 🎯 THE CORE PRINCIPLES

### 1. **Intent-First Navigation**
Users choose WHAT to do, then WHERE to do it (if needed)

### 2. **Role-Based Features**
Dock shows features you CAN access, not where you ARE

### 3. **Context-Aware Scoping**
Features handle location differently based on their nature:
- **Single-Location** (POS): Must pick one location
- **Multi-Location** (Inventory): Can view/switch between assigned locations
- **Global** (Marketing Studio): No location needed

### 4. **Collaboration Spaces**
Some features transcend locations - shared team workspaces

---

## 📱 LOGIN → DASHBOARD FLOW

```
┌─────────────────────────────────────┐
│         WHALETOOLS LOGIN            │
│  email + password                   │
│  → Authenticates                    │
└─────────────────────────────────────┘
                ↓
         Check Permissions
                ↓
┌─────────────────────────────────────┐
│         MAIN DASHBOARD              │
│  (Role-based default view)          │
│                                     │
│  DOCK (Features you can access):    │
│  [Icons based on permissions]       │
└─────────────────────────────────────┘
```

**NO automatic location selection**
**NO workspace picker on login**
→ User sees features they can use
→ Location context set when entering feature that needs it

---

## 🏗️ THE DOCK - Permission-Based

The Dock is **NOT location-specific**. It shows **FEATURES YOU CAN ACCESS**.

### Staff (POS + Basic Inventory at 1 location)
```
┌───────────────────────────────────────────┐
│  [POS] [Products] [Customers] [More]      │
└───────────────────────────────────────────┘
```
- **POS**: Tap → Location selector → Open register
- **Products**: Tap → Opens to assigned location (read-only stock view)
- **Customers**: Tap → Customer search (location-filtered)
- **More**: Profile, Help, Logout

---

### Manager (Multiple locations, more permissions)
```
┌───────────────────────────────────────────┐
│  [POS] [Products] [Customers] [Orders] [More] │
└───────────────────────────────────────────┘
```
- **POS**: Tap → Choose location → Open register
- **Products**: Tap → Opens with location filter (can switch)
  - View stock across assigned locations
  - Create POs, receive inventory, transfers
- **Customers**: All customers across assigned locations
- **Orders**: View/manage orders for assigned locations
- **More**:
  - **Studio** (Marketing workspace - global)
  - **Team** (Staff management)
  - **Insights** (Reports for assigned locations)
  - Settings, Profile, Help

---

### Admin (Full platform access)
```
┌───────────────────────────────────────────┐
│  [Network] [Products] [Customers] [Orders] [More] │
└───────────────────────────────────────────┘
```
- **Network**: All locations overview, map view, aggregate metrics
- **Products**: Global catalog + per-location inventory
- **Customers**: All customers (can filter by location)
- **Orders**: All orders (can filter by location)
- **More**:
  - **Studio** (Marketing workspace)
  - **Team** (All staff across network)
  - **Insights** (Network-wide + per-location reports)
  - **Settings** (Platform settings)
  - Locations, Integrations, Billing

---

### Marketing Collaborator (Special role - no locations)
```
┌───────────────────────────────────────────┐
│  [Studio] [Media] [Customers] [More]      │
└───────────────────────────────────────────┘
```
- **Studio**: Marketing campaigns, email, promotions
- **Media**: Brand assets, product photos, organize library
- **Customers**: View for campaign targeting (read-only)
- **More**: Profile, Help

---

## 🎨 THE APP LAUNCHER vs THE DOCK

Wait - we need to clarify this. Are these the same thing or different?

### Option A: Dock IS the App Launcher
**Simple, iOS-style**: Bottom Dock shows 4-5 main apps, tap to launch

```
┌───────────────────────────────────────────┐
│                                           │
│         [Current Screen Content]          │
│                                           │
│                                           │
├───────────────────────────────────────────┤
│  DOCK (Always Visible):                   │
│  [POS] [Products] [Customers] [Orders] [•••] │
└───────────────────────────────────────────┘
```

---

### Option B: Dock + Separate App Launcher
**macOS-style**: Dock for quick access, grid launcher for all apps

```
┌───────────────────────────────────────────┐
│  [Profile]              [🔍] [📱]         │ <- Top bar
├───────────────────────────────────────────┤
│                                           │
│         [Current Screen Content]          │
│                                           │
│                                           │
├───────────────────────────────────────────┤
│  DOCK:                                    │
│  [POS] [Products] [Customers] [•••]       │
└───────────────────────────────────────────┘

Tap [📱] →

┌─────────────────────────────────────────┐
│         ALL APPS                        │
├─────────────────────────────────────────┤
│                                         │
│  ┌───┐  ┌───┐  ┌───┐  ┌───┐          │
│  │POS│  │Pro│  │Cus│  │Ord│          │
│  └───┘  └───┘  └───┘  └───┘          │
│                                         │
│  ┌───┐  ┌───┐  ┌───┐  ┌───┐          │
│  │Stu│  │Med│  │Tea│  │Ins│          │
│  └───┘  └───┘  └───┘  └───┘          │
│                                         │
│  ┌───┐  ┌───┐  ┌───┐                  │
│  │Net│  │Set│  │Hel│                  │
│  └───┘  └───┘  └───┘                  │
└─────────────────────────────────────────┘
```

---

## 🔑 RECOMMENDATION: **Option A - Dock IS the Launcher**

**Reasoning (Steve Jobs style):**
- ✅ Simpler mental model
- ✅ Everything is one tap away
- ✅ No nested navigation (grid inside grid)
- ✅ Use "More" for overflow (like iOS Settings)
- ✅ Dock adapts to permissions (you only see what you can use)

**Implementation:**
```
MAX 5 DOCK ITEMS
├─ Items 1-4: Most-used features for this role
└─ Item 5: "More" (if >4 features available)

TAP "MORE" → Bottom sheet with remaining features
└─ Grouped by category (Tools, Admin, Help)
```

---

## 🌐 LOCATION CONTEXT - Feature by Feature

### 🔵 POS (Single-location required)

**Entry Flow:**
```
User taps [POS] icon
       ↓
Check permissions → Get assigned POS locations
       ↓
IF (locations.length === 0)
   → Error: "You don't have POS access"
       ↓
IF (locations.length === 1)
   → Show Register Selector for that location
       ↓
IF (locations.length > 1)
   → Show Location Selector
       ↓ (user picks location)
   → Show Register Selector for chosen location
       ↓ (user picks register)
   → Open POS Session
```

**During POS Session:**
- Location is LOCKED (can't switch)
- Dock changes to POS-specific:
  ```
  [Products] [Customers] [End Session] [Help]
  ```
- Must close session to leave

---

### 🟢 Products/Inventory (Multi-location capable)

**Entry Flow:**
```
User taps [Products] icon
       ↓
Check permissions → Get assigned inventory locations
       ↓
IF (can view only 1 location)
   → Open to that location (fixed)
       ↓
IF (can view multiple locations)
   → Open to "All Locations" overview
   → Show location filter dropdown
       ↓
User can switch between:
   • Individual locations
   • All Locations (aggregate view)
```

**Interface:**
```
┌─────────────────────────────────────────┐
│  PRODUCTS                               │
│  Viewing: [Blowing Rock ▾]              │ <- Can switch
├─────────────────────────────────────────┤
│                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │ Blue │  │Purple│  │Green │         │
│  │Dream │  │ Haze │  │Crack │         │
│  │      │  │      │  │      │         │
│  │$35/g │  │$32/g │  │$38/g │         │
│  │      │  │      │  │      │         │
│  │45 in │  │23 at │  │12 at │         │ <- Location-specific stock
│  │stock │  │BR    │  │BR    │         │
│  │      │  │67 at │  │34 at │         │
│  │      │  │ASH   │  │ASH   │         │
│  └──────┘  └──────┘  └──────┘         │
└─────────────────────────────────────────┘
```

**Manager/Admin Features** (in product detail):
- Transfer between locations
- Create/receive POs
- Adjust inventory
- Set per-location pricing

**Staff Features**:
- View stock (read-only)
- Count inventory (assigned location only)

---

### 🟡 Marketing Studio (Global - no location)

**Entry Flow:**
```
User taps [Studio] icon (from More)
       ↓
Opens to shared workspace
NO location selection needed
```

**Interface:**
```
┌─────────────────────────────────────────┐
│  MARKETING STUDIO                       │
├─────────────────────────────────────────┤
│                                         │
│  📧 Email Campaigns                     │
│  🎯 Loyalty Programs                    │
│  🎨 Brand Guidelines                    │
│  📱 Social Media                        │
│  🏷️  Promotions                         │
│                                         │
│  When creating location-specific        │
│  content, you choose targets:           │
│                                         │
│  ┌─────────────────────────────┐       │
│  │ NEW EMAIL CAMPAIGN          │       │
│  │                             │       │
│  │ Send to:                    │       │
│  │ ☑ Blowing Rock customers    │       │
│  │ ☐ Asheville customers       │       │
│  │ ☐ All customers             │       │
│  └─────────────────────────────┘       │
└─────────────────────────────────────────┘
```

**Who can access:**
- Managers (at assigned locations)
- Admins (all locations)
- Marketing Collaborators (special role)

**Collaboration:**
- Multiple users can work simultaneously
- Changes sync in real-time
- Like Figma/Google Docs for marketing

---

### 🟣 Media Library (Global - shared resource)

**Entry Flow:**
```
User taps [Media] icon
       ↓
Opens to shared media library
NO location selection
```

**Interface:**
```
┌─────────────────────────────────────────┐
│  MEDIA LIBRARY                          │
│  [Search] [Upload] [Organize]           │
├─────────────────────────────────────────┤
│                                         │
│  📂 Product Photos (1,234)              │
│  📂 Brand Assets (45)                   │
│  📂 Marketing Materials (89)            │
│  📂 Menu Boards (23)                    │
│                                         │
│  [Grid of beautiful photos]             │
└─────────────────────────────────────────┘
```

**Who can access:**
- Managers (view + upload)
- Admins (full control)
- Marketing Collaborators (full control)
- Staff (view only - when needed for tasks)

---

### 🔴 Network View (Admin only - all locations)

**Entry Flow:**
```
Admin taps [Network] icon
       ↓
Opens to all-locations overview
```

**Interface:**
```
┌─────────────────────────────────────────┐
│  NETWORK OVERVIEW                       │
├─────────────────────────────────────────┤
│                                         │
│  [Map showing all locations]            │
│                                         │
│  🏪 Blowing Rock    $12,847 today       │
│  🏪 Asheville       $9,234 today        │
│  🏪 Charlotte       $15,678 today       │
│                                         │
│  Total Network: $37,759 today           │
│  ↑ 23% vs yesterday                     │
│                                         │
│  [Tap location to dive in]              │
└─────────────────────────────────────────┘

Tap "Blowing Rock" →

┌─────────────────────────────────────────┐
│  ← Back to Network                      │
│                                         │
│  BLOWING ROCK                           │
│  [Location details + management]        │
│                                         │
│  Dock changes to:                       │
│  [Store] [Products] [Team] [Back]       │
└─────────────────────────────────────────┘
```

---

## 🎭 COMPLETE DOCK DEFINITIONS

### Staff (POS-focused)
**Default Dock:**
```
[POS] [Products] [Customers] [More]
```

**Inside POS Session:**
```
[Search] [Customers] [Loyalty] [End Session]
```

**More Menu:**
```
• Profile & Settings
• Help & Support
• Logout
```

---

### Manager (Multi-location operations)
**Default Dock:**
```
[POS] [Products] [Customers] [Orders] [More]
```

**More Menu:**
```
TOOLS
• Marketing Studio
• Media Library
• Team Management

INSIGHTS
• Reports & Analytics
• Inventory Alerts

ACCOUNT
• Profile & Settings
• Help & Support
• Logout
```

---

### Admin (Platform-wide)
**Default Dock:**
```
[Network] [Products] [Customers] [Orders] [More]
```

**More Menu:**
```
TOOLS
• Marketing Studio
• Media Library
• Team Management
• Digital Signage

PLATFORM
• Locations
• Integrations
• Billing
• Platform Settings

INSIGHTS
• Network Reports
• Performance Analytics

ACCOUNT
• Profile
• Help & Support
• Logout
```

---

### Marketing Collaborator (Content-focused)
**Default Dock:**
```
[Studio] [Media] [Customers] [More]
```

**More Menu:**
```
• Campaign Calendar
• Analytics
• Brand Guidelines
• Profile & Settings
• Help
• Logout
```

---

## 🗄️ DATABASE SCHEMA

### user_location_assignments
```sql
CREATE TABLE user_location_assignments (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  location_id UUID REFERENCES locations,
  vendor_id UUID REFERENCES vendors,

  -- Role at this location
  role TEXT CHECK (role IN ('admin', 'manager', 'staff', 'readonly')),

  -- Feature permissions
  can_use_pos BOOLEAN DEFAULT false,
  can_view_inventory BOOLEAN DEFAULT false,
  can_manage_inventory BOOLEAN DEFAULT false,
  can_transfer_inventory BOOLEAN DEFAULT false,
  can_view_reports BOOLEAN DEFAULT false,
  can_manage_staff BOOLEAN DEFAULT false,
  can_manage_settings BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_assignments ON user_location_assignments(user_id);
CREATE INDEX idx_location_assignments ON user_location_assignments(location_id);
```

### user_global_permissions
```sql
CREATE TABLE user_global_permissions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users UNIQUE,
  vendor_id UUID REFERENCES vendors,

  -- Platform-wide roles
  is_platform_admin BOOLEAN DEFAULT false,
  is_marketing_collaborator BOOLEAN DEFAULT false,

  -- Global features
  can_access_marketing_studio BOOLEAN DEFAULT false,
  can_manage_media BOOLEAN DEFAULT false,
  can_view_network_reports BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔧 IMPLEMENTATION CHECKLIST

### Phase 1: Permission System ✅
- [ ] Create database tables
- [ ] Create permission checking functions
- [ ] Create user assignment RPC functions

### Phase 2: Context Management ✅
- [ ] Create `context.store.ts` (current user + permissions)
- [ ] Create `location.store.ts` (location data)
- [ ] Create permission checking hooks

### Phase 3: Navigation System ✅
- [ ] Create dynamic Dock component
- [ ] Create "More" menu component
- [ ] Create location selector modals

### Phase 4: Feature Entry Points ✅
- [ ] POS entry (with location selector)
- [ ] Products entry (with location filter)
- [ ] Marketing Studio entry (no location)
- [ ] Network entry (admin only)

### Phase 5: UI Components ✅
- [ ] LocationSelector modal
- [ ] LocationFilter dropdown
- [ ] PermissionGate wrapper
- [ ] DynamicDock component

---

## ✨ THE STEVE JOBS TEST

**Question 1**: "Can a new cashier open the app and start ringing up sales in under 10 seconds?"
**Answer**: ✅ YES - Login → Auto-shows POS (if only 1 location) → Start scanning

**Question 2**: "Can a regional manager switch between locations without thinking about it?"
**Answer**: ✅ YES - Features show location filter when it matters, global when it doesn't

**Question 3**: "Can the marketing team collaborate without being blocked by location barriers?"
**Answer**: ✅ YES - Studio and Media are global spaces, no location selection needed

**Question 4**: "Is there any feature visible that the user can't actually use?"
**Answer**: ✅ NO - Dock only shows features you have permission to access

**Question 5**: "Does the interface disappear, leaving only the task?"
**Answer**: ✅ YES - Location context is invisible unless you need to change it

---

## 🎯 FINAL ARCHITECTURE DIAGRAM

```
USER LOGS IN
     ↓
[Auth System] → Fetch permissions
     ↓
┌─────────────────────────────────────┐
│     MAIN DASHBOARD                  │
│  (Role-based default screen)        │
│                                     │
│  Dynamic Dock (permission-based):   │
│  Shows 4-5 apps you can access      │
└─────────────────────────────────────┘
     ↓ (User taps app)
     ↓
[Feature Entry Logic]
     ↓
     ├─ Needs location? (POS)
     │  └─ Show location selector
     │     └─ Enter feature with location context
     │
     ├─ Multi-location? (Products)
     │  └─ Open with location filter
     │     └─ User can switch as needed
     │
     └─ Global? (Studio, Media)
        └─ Enter feature (no location)
```

---

## 📝 NOTES & DECISIONS

### Why No Auto-Location Selection?
- Admins debug remotely from home
- Managers hop between stores frequently
- Better to ask intent ("What to do?") than assume location

### Why Dock Over App Grid?
- Faster (one tap vs two)
- Cleaner (no nested navigation)
- Dynamic (adapts to permissions)
- Familiar (iOS/macOS pattern)

### Why "More" Menu?
- Keeps primary actions visible
- Hides advanced/admin features
- Scales to any number of features
- Maintains focus (Jobs: "What's the ONE thing?")

### Why Global Studio/Media?
- Marketing is cross-location
- Media is shared resource
- Collaboration > silos
- Location targeting happens at campaign level, not workspace level

---

**END OF UNIFIED ARCHITECTURE**
