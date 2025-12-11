/**
 * Test Affiliate Code Validation for Checkout
 *
 * Tests the validate_affiliate_code SQL function and discount calculation
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function runTests() {
  console.log('🧪 AFFILIATE CODE VALIDATION TESTS\n');
  let passed = 0;
  let failed = 0;

  // Test 1: Validate a known affiliate code (BOBS)
  console.log('Test 1: Validate known affiliate code "BOBS"');
  try {
    const { data: result, error } = await supabase.rpc('validate_affiliate_code', {
      p_vendor_id: VENDOR_ID,
      p_code: 'BOBS'
    });

    if (error) throw error;

    const affiliate = result?.[0];
    if (affiliate?.is_valid && affiliate?.affiliate_id) {
      console.log('✅ PASSED - Valid affiliate found');
      console.log('   Affiliate:', affiliate.first_name, affiliate.last_name);
      console.log('   Code:', affiliate.referral_code);
      console.log('   Commission Rate:', affiliate.commission_rate + '%');
      console.log('   Customer Discount:', affiliate.customer_discount_rate + '%', `(${affiliate.customer_discount_type})`);
      passed++;
    } else {
      console.log('❌ FAILED - Code not validated');
      console.log('   Result:', affiliate);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAILED -', err.message);
    failed++;
  }

  // Test 2: Validate with lowercase
  console.log('\nTest 2: Validate with lowercase "bobs"');
  try {
    const { data: result, error } = await supabase.rpc('validate_affiliate_code', {
      p_vendor_id: VENDOR_ID,
      p_code: 'bobs'
    });

    if (error) throw error;

    const affiliate = result?.[0];
    if (affiliate?.is_valid) {
      console.log('✅ PASSED - Case-insensitive validation works');
      passed++;
    } else {
      console.log('❌ FAILED - Lowercase code not matched');
      failed++;
    }
  } catch (err) {
    console.log('❌ FAILED -', err.message);
    failed++;
  }

  // Test 3: Invalid code
  console.log('\nTest 3: Validate invalid code "FAKECODE123"');
  try {
    const { data: result, error } = await supabase.rpc('validate_affiliate_code', {
      p_vendor_id: VENDOR_ID,
      p_code: 'FAKECODE123'
    });

    if (error) throw error;

    const affiliate = result?.[0];
    if (!affiliate?.is_valid && affiliate?.error_message === 'Invalid affiliate code') {
      console.log('✅ PASSED - Invalid code correctly rejected');
      console.log('   Error message:', affiliate.error_message);
      passed++;
    } else {
      console.log('❌ FAILED - Expected rejection');
      console.log('   Result:', affiliate);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAILED -', err.message);
    failed++;
  }

  // Test 4: Calculate discount
  console.log('\nTest 4: Calculate discount (10% on $100)');
  try {
    const { data: discountAmount, error } = await supabase.rpc('calculate_affiliate_discount', {
      p_subtotal: 100.00,
      p_discount_rate: 10.00,
      p_discount_type: 'percentage'
    });

    if (error) throw error;

    if (discountAmount === 10.00) {
      console.log('✅ PASSED - Discount calculated correctly: $' + discountAmount);
      passed++;
    } else {
      console.log('❌ FAILED - Expected $10.00, got $' + discountAmount);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAILED -', err.message);
    failed++;
  }

  // Test 5: Fixed discount
  console.log('\nTest 5: Calculate fixed discount ($5 off $100)');
  try {
    const { data: discountAmount, error } = await supabase.rpc('calculate_affiliate_discount', {
      p_subtotal: 100.00,
      p_discount_rate: 5.00,
      p_discount_type: 'fixed'
    });

    if (error) throw error;

    if (discountAmount === 5.00) {
      console.log('✅ PASSED - Fixed discount calculated correctly: $' + discountAmount);
      passed++;
    } else {
      console.log('❌ FAILED - Expected $5.00, got $' + discountAmount);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAILED -', err.message);
    failed++;
  }

  // Test 6: Fixed discount exceeds subtotal (should cap at subtotal)
  console.log('\nTest 6: Fixed discount exceeds subtotal ($50 off $10)');
  try {
    const { data: discountAmount, error } = await supabase.rpc('calculate_affiliate_discount', {
      p_subtotal: 10.00,
      p_discount_rate: 50.00,
      p_discount_type: 'fixed'
    });

    if (error) throw error;

    if (discountAmount === 10.00) {
      console.log('✅ PASSED - Fixed discount capped at subtotal: $' + discountAmount);
      passed++;
    } else {
      console.log('❌ FAILED - Expected $10.00 (capped), got $' + discountAmount);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAILED -', err.message);
    failed++;
  }

  // Test 7: Check affiliate has customer_discount_rate field
  console.log('\nTest 7: Verify affiliate has customer_discount_rate field');
  try {
    const { data: affiliates, error } = await supabase
      .from('affiliates')
      .select('id, referral_code, customer_discount_rate, customer_discount_type')
      .eq('vendor_id', VENDOR_ID)
      .limit(1);

    if (error) throw error;

    const affiliate = affiliates?.[0];
    if (affiliate && 'customer_discount_rate' in affiliate && 'customer_discount_type' in affiliate) {
      console.log('✅ PASSED - Affiliate has discount fields');
      console.log('   Customer Discount Rate:', affiliate.customer_discount_rate);
      console.log('   Customer Discount Type:', affiliate.customer_discount_type);
      passed++;
    } else {
      console.log('❌ FAILED - Missing discount fields');
      failed++;
    }
  } catch (err) {
    console.log('❌ FAILED -', err.message);
    failed++;
  }

  // Summary
  const total = passed + failed;
  const percentage = Math.round((passed / total) * 100);
  console.log('\n' + '='.repeat(50));
  console.log(`RESULTS: ${passed}/${total} tests passed (${percentage}%)`);
  console.log('='.repeat(50));

  if (percentage === 100) {
    console.log('🎉 ALL TESTS PASSED!');
  } else if (percentage >= 80) {
    console.log('✅ Most tests passed');
  } else {
    console.log('❌ Some tests failed');
  }
}

runTests().catch(console.error);
