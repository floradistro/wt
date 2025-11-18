-- Create inventory_adjustments table for tracking manual stock corrections
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('count_correction', 'damage', 'shrinkage', 'theft', 'expired', 'received', 'return', 'other')),
  quantity_before NUMERIC NOT NULL,
  quantity_after NUMERIC NOT NULL,
  quantity_change NUMERIC NOT NULL, -- Can be negative
  reason TEXT NOT NULL,
  notes TEXT,
  reference_id UUID, -- Link to PO, Order, or other related record
  reference_type TEXT, -- 'purchase_order', 'order', 'transfer', etc.
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product ON inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_location ON inventory_adjustments(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_created_at ON inventory_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_vendor ON inventory_adjustments(vendor_id);

-- Enable RLS
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view adjustments for their vendor
CREATE POLICY "Users can view inventory adjustments for their vendor"
  ON inventory_adjustments
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can create adjustments for their vendor
CREATE POLICY "Users can create inventory adjustments for their vendor"
  ON inventory_adjustments
  FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE id = auth.uid()
    )
  );

-- Create stock_movements table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'transfer_out', 'transfer_in')),
  quantity_before NUMERIC NOT NULL,
  quantity_after NUMERIC NOT NULL,
  quantity_change NUMERIC NOT NULL,
  reference_id UUID, -- Order ID, PO ID, Adjustment ID, Transfer ID
  reference_type TEXT, -- 'order', 'purchase_order', 'adjustment', 'transfer'
  source_location_id UUID REFERENCES locations(id), -- For transfers
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON stock_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_vendor ON stock_movements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_id);

-- Enable RLS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view movements for their vendor
CREATE POLICY "Users can view stock movements for their vendor"
  ON stock_movements
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE id = auth.uid()
    )
  );

-- RLS Policy: System can insert movements
CREATE POLICY "System can create stock movements"
  ON stock_movements
  FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE id = auth.uid()
    )
  );

-- Function to automatically create stock movement when adjustment is made
CREATE OR REPLACE FUNCTION create_stock_movement_from_adjustment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO stock_movements (
    product_id,
    location_id,
    movement_type,
    quantity_before,
    quantity_after,
    quantity_change,
    reference_id,
    reference_type,
    vendor_id
  ) VALUES (
    NEW.product_id,
    NEW.location_id,
    'adjustment',
    NEW.quantity_before,
    NEW.quantity_after,
    NEW.quantity_change,
    NEW.id,
    'adjustment',
    NEW.vendor_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create stock movement on adjustment
CREATE TRIGGER trigger_create_stock_movement_from_adjustment
  AFTER INSERT ON inventory_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION create_stock_movement_from_adjustment();

-- Grant necessary permissions
GRANT SELECT, INSERT ON inventory_adjustments TO authenticated;
GRANT SELECT ON stock_movements TO authenticated;
