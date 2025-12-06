-- ============================================================================
-- CHECKOUT ATTEMPTS TRACKING
-- ============================================================================
-- Logs ALL checkout attempts BEFORE payment processing so staff can see:
-- 1. Failed payment attempts (card declined, errors)
-- 2. Fraud review holds (responseCode 4)
-- 3. Successful orders
--
-- This ensures NO payment attempt goes untracked, even if order creation fails.
-- ============================================================================

-- ============================================================================
-- 1. CREATE CHECKOUT_ATTEMPTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS checkout_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),

  -- Customer info (captured at time of attempt)
  customer_id UUID REFERENCES customers(id),
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,

  -- Shipping address (for order fulfillment if payment succeeds later)
  shipping_address JSONB,
  billing_address JSONB,

  -- Order details
  items JSONB NOT NULL,  -- Cart items snapshot
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,

  -- Payment info
  payment_method TEXT,  -- 'card', 'apple_pay', 'google_pay'
  payment_processor TEXT,  -- 'authorizenet', 'spin', etc.

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  -- Possible statuses:
  -- 'pending' - attempt created, payment not yet processed
  -- 'processing' - payment being processed
  -- 'approved' - payment approved, order being created
  -- 'declined' - payment declined by processor
  -- 'held_for_review' - fraud review (Auth.net responseCode 4)
  -- 'error' - system error during processing
  -- 'completed' - order created successfully
  -- 'abandoned' - customer left before completing

  -- Processor response (filled after payment attempt)
  processor_response_code TEXT,
  processor_transaction_id TEXT,
  processor_auth_code TEXT,
  processor_error_message TEXT,  -- Technical error from processor
  customer_error_message TEXT,   -- Error message shown to customer
  error_context JSONB,           -- Full error snapshot for debugging

  -- Link to order if successful
  order_id UUID REFERENCES orders(id),
  order_number TEXT,

  -- Source tracking
  source TEXT DEFAULT 'web',  -- 'web', 'pos', 'mobile'
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,  -- When payment was actually processed

  -- Staff follow-up tracking
  staff_reviewed BOOLEAN DEFAULT FALSE,
  staff_reviewed_at TIMESTAMPTZ,
  staff_reviewed_by UUID REFERENCES users(id),
  staff_notes TEXT
);

-- ============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Fast lookup by vendor
CREATE INDEX idx_checkout_attempts_vendor ON checkout_attempts(vendor_id);

-- Find attempts needing staff attention
CREATE INDEX idx_checkout_attempts_needs_review ON checkout_attempts(vendor_id, status)
  WHERE status IN ('held_for_review', 'declined', 'error') AND staff_reviewed = FALSE;

-- Find attempts by customer
CREATE INDEX idx_checkout_attempts_customer ON checkout_attempts(customer_id)
  WHERE customer_id IS NOT NULL;

-- Find attempts by email (for guest checkouts)
CREATE INDEX idx_checkout_attempts_email ON checkout_attempts(customer_email)
  WHERE customer_email IS NOT NULL;

-- Recent attempts
CREATE INDEX idx_checkout_attempts_created ON checkout_attempts(vendor_id, created_at DESC);

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

ALTER TABLE checkout_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view checkout attempts for their vendor
CREATE POLICY "Users can view checkout attempts for their vendor"
  ON checkout_attempts
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id
      FROM users
      WHERE auth_user_id = auth.uid()
    )
  );

-- Users can update checkout attempts for their vendor (for staff notes)
CREATE POLICY "Users can update checkout attempts for their vendor"
  ON checkout_attempts
  FOR UPDATE
  USING (
    vendor_id IN (
      SELECT vendor_id
      FROM users
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id
      FROM users
      WHERE auth_user_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY "Service role full access to checkout_attempts"
  ON checkout_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_checkout_attempts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER checkout_attempts_updated_at
  BEFORE UPDATE ON checkout_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_checkout_attempts_timestamp();

-- ============================================================================
-- 5. HELPER VIEW FOR STAFF DASHBOARD
-- ============================================================================

CREATE OR REPLACE VIEW checkout_attempts_needing_attention AS
SELECT
  ca.*,
  c.first_name || ' ' || c.last_name AS customer_full_name,
  c.email AS customer_email_verified,
  c.phone AS customer_phone_verified
FROM checkout_attempts ca
LEFT JOIN customers c ON ca.customer_id = c.id
WHERE ca.status IN ('held_for_review', 'declined', 'error')
  AND ca.staff_reviewed = FALSE
ORDER BY ca.created_at DESC;

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'CHECKOUT ATTEMPTS TRACKING CREATED';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Table: checkout_attempts';
  RAISE NOTICE 'View: checkout_attempts_needing_attention';
  RAISE NOTICE '';
  RAISE NOTICE 'Staff can now see:';
  RAISE NOTICE '  - Failed payment attempts';
  RAISE NOTICE '  - Fraud review holds';
  RAISE NOTICE '  - All checkout activity';
  RAISE NOTICE '==========================================';
END $$;
