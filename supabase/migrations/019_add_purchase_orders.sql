-- Purchase Orders Migration
-- Creates tables for managing inbound and outbound purchase orders
-- Matches prototype schema with suppliers and wholesale_customers

-- Create suppliers table (for inbound POs)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  external_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wholesale_customers table (for outbound POs)
CREATE TABLE IF NOT EXISTS wholesale_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  external_company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  shipping_address TEXT,
  billing_address TEXT,
  tax_id TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_orders table (matching prototype schema)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  po_type TEXT NOT NULL CHECK (po_type IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'received', 'partially_received', 'cancelled')),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  wholesale_customer_id UUID REFERENCES wholesale_customers(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  expected_delivery_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 2) NOT NULL,
  received_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  condition TEXT CHECK (condition IN ('good', 'damaged', 'expired', 'rejected')),
  quality_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_suppliers_vendor_id ON suppliers(vendor_id);
CREATE INDEX idx_wholesale_customers_vendor_id ON wholesale_customers(vendor_id);
CREATE INDEX idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_po_type ON purchase_orders(po_type);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_wholesale_customer_id ON purchase_orders(wholesale_customer_id);
CREATE INDEX idx_purchase_orders_location_id ON purchase_orders(location_id);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at DESC);
CREATE INDEX idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product_id ON purchase_order_items(product_id);

-- Enable Row Level Security
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Users can view suppliers for their vendor"
  ON suppliers FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can create suppliers for their vendor"
  ON suppliers FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can update suppliers for their vendor"
  ON suppliers FOR UPDATE
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for wholesale_customers
CREATE POLICY "Users can view wholesale_customers for their vendor"
  ON wholesale_customers FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can create wholesale_customers for their vendor"
  ON wholesale_customers FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can update wholesale_customers for their vendor"
  ON wholesale_customers FOR UPDATE
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for purchase_orders
CREATE POLICY "Users can view purchase orders for their vendor"
  ON purchase_orders FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can create purchase orders for their vendor"
  ON purchase_orders FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can update purchase orders for their vendor"
  ON purchase_orders FOR UPDATE
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can delete purchase orders for their vendor"
  ON purchase_orders FOR DELETE
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for purchase_order_items
CREATE POLICY "Users can view items for their vendor's purchase orders"
  ON purchase_order_items FOR SELECT
  USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE vendor_id IN (
        SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
      )
    )
  );

CREATE POLICY "Users can create items for their vendor's purchase orders"
  ON purchase_order_items FOR INSERT
  WITH CHECK (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE vendor_id IN (
        SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
      )
    )
  );

CREATE POLICY "Users can update items for their vendor's purchase orders"
  ON purchase_order_items FOR UPDATE
  USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE vendor_id IN (
        SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
      )
    )
  );

CREATE POLICY "Users can delete items for their vendor's purchase orders"
  ON purchase_order_items FOR DELETE
  USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE vendor_id IN (
        SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
      )
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_purchase_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamps
CREATE TRIGGER update_purchase_orders_timestamp
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_timestamp();

CREATE TRIGGER update_purchase_order_items_timestamp
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_timestamp();
