# Apply Migration 105 - Add Featured Image to Categories

## Feature
Add ability to select images for categories from the vendor media library, just like product images.

## What This Adds

- Categories can now have a featured image displayed in the category detail view
- Image selection from:
  - Vendor media library
  - Device photos
  - Camera
- Same image management system as products

## Steps

1. **Go to Supabase Dashboard**
   - Open your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run the migration:**
   - Copy the SQL from `supabase/migrations/105_add_category_featured_image.sql`
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Success**
   - Should see success message in the output
   - Open a category in the app
   - Tap on the category icon/placeholder in the header
   - Should be able to select/upload an image

## Files Changed

- `supabase/migrations/105_add_category_featured_image.sql` - Migration file (created)
- `src/types/categories.ts` - Added `featured_image` field to Category interface
- `src/components/categories/CategoryDetail.tsx` - Added image selection UI
- `APPLY_MIGRATION_105.md` - This documentation (created)

## How It Works

### UI Flow:
1. **View**: Category detail shows image or first letter placeholder
2. **Tap image**: Opens full-screen preview with options
3. **Change Photo**: Opens media picker with 3 tabs:
   - My Library (vendor media)
   - Device Photos
   - Take Photo (camera)
4. **Select**: Image uploads to Supabase storage and updates category
5. **Remove**: Option to remove image and restore placeholder

### Technical Details:
- Images stored in same `vendor-product-images` bucket as products
- Image URLs stored in `categories.featured_image` column
- Instant UI feedback while uploading
- Haptic feedback for all interactions

## Priority

🟡 **MEDIUM** - Enhances visual appeal of categories but not critical for functionality
