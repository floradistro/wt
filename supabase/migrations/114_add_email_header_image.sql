-- Add email header image column to vendor_email_settings
ALTER TABLE vendor_email_settings
ADD COLUMN IF NOT EXISTS email_header_image_url TEXT;

COMMENT ON COLUMN vendor_email_settings.email_header_image_url IS 'Custom header image URL for email templates (e.g., logo + brand name)';
