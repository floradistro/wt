/**
 * Unified Customer Search Utility
 *
 * Apple Engineering Principle: Single source of truth for customer search
 * All customer search methods consolidated here
 */

import { supabase } from '@/lib/supabase/client';
import type { Customer } from '@/types/pos';

/**
 * Normalize phone number for search (remove formatting)
 */
export const normalizePhone = (phone: string): string => {
  return phone.replace(/[\s\-\(\)\.]/g, '');
};

/**
 * Search customers by text across all fields
 */
export const searchCustomersByText = async (
  vendorId: string,
  searchTerm: string,
  limit: number = 100
): Promise<Customer[]> => {
  if (!searchTerm.trim()) {
    return [];
  }

  const term = searchTerm.trim();
  const normalizedPhone = normalizePhone(term);
  const isPhoneSearch = /^\d+$/.test(normalizedPhone) && normalizedPhone.length >= 3;

  let searchConditions = `first_name.ilike.%${term}%,last_name.ilike.%${term}%,middle_name.ilike.%${term}%,display_name.ilike.%${term}%,email.ilike.%${term}%`;

  if (isPhoneSearch) {
    searchConditions += `,phone.ilike.%${normalizedPhone}%`;
  } else {
    searchConditions += `,phone.ilike.%${term}%`;
  }

  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .or(searchConditions)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
};

/**
 * Search customer by exact phone number
 */
export const searchCustomerByPhone = async (
  vendorId: string,
  phone: string
): Promise<Customer | null> => {
  const normalizedPhone = normalizePhone(phone);

  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .ilike('phone', `%${normalizedPhone}%`)
    .limit(1)
    .single();

  return data || null;
};

/**
 * Search customer by exact email
 */
export const searchCustomerByEmail = async (
  vendorId: string,
  email: string
): Promise<Customer | null> => {
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .ilike('email', email)
    .limit(1)
    .single();

  return data || null;
};

/**
 * Search customer by license number (exact match)
 */
export const searchCustomerByLicense = async (
  vendorId: string,
  licenseNumber: string
): Promise<Customer | null> => {
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .eq('license_number', licenseNumber)
    .limit(1)
    .single();

  return data || null;
};
