-- Migration: Allow draft POs without supplier/customer
-- Created: 2025-11-24
-- Description: Update check constraint to allow draft POs to exist without supplier_id or wholesale_customer_id

-- Drop the old constraint
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS po_relation_check;

-- Add new constraint that allows drafts to skip relation requirement
ALTER TABLE purchase_orders ADD CONSTRAINT po_relation_check CHECK (
  -- Drafts can be incomplete
  status = 'draft' OR
  -- Inbound POs (not drafts) must have supplier
  (po_type = 'inbound' AND supplier_id IS NOT NULL) OR
  -- Outbound POs (not drafts) must have customer
  (po_type = 'outbound' AND wholesale_customer_id IS NOT NULL)
);

-- Add comment
COMMENT ON CONSTRAINT po_relation_check ON purchase_orders IS 'Ensures inbound POs have supplier and outbound POs have customer, except for drafts which can be incomplete';
