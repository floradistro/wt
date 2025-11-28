-- Create vendor-product-images storage bucket
-- Vendors can upload/manage their product images
-- Public read access for displaying images in app

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-product-images',
  'vendor-product-images',
  true, -- Public bucket for easy access via getPublicUrl
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for vendor-product-images bucket

-- Policy: Vendors can read their own images
CREATE POLICY "Vendors can view own images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vendor-product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT vendor_id::text FROM users WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Public can read all images (needed for public URLs)
CREATE POLICY "Public read access for images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'vendor-product-images');

-- Policy: Vendors can upload to their own folder
CREATE POLICY "Vendors can upload own images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT vendor_id::text FROM users WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Vendors can update their own images
CREATE POLICY "Vendors can update own images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vendor-product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT vendor_id::text FROM users WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'vendor-product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT vendor_id::text FROM users WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Vendors can delete their own images
CREATE POLICY "Vendors can delete own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vendor-product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT vendor_id::text FROM users WHERE auth_user_id = auth.uid()
  )
);
