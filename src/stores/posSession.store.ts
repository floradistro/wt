/**
 * POS Session Store - Apple Engineering Standard
 *
 * Principle: Global state for POS session eliminates prop drilling
 * Replaces: Props passing through POSScreen → POSCheckout → Modals
 *
 * Benefits:
 * - Zero prop drilling
 * - Session accessible anywhere in POS flow
 * - Clean component hierarchy
 * - Single source of truth
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionInfo, Vendor, Location } from '@/types/pos';
import { supabase } from '@/lib/supabase/client';
import * as Haptics from 'expo-haptics';
import { logger } from '@/utils/logger';

interface SessionData {
  sessionNumber: string;
  totalSales: number;
  totalCash: number;
  openingCash: number;
}

interface POSSessionState {
  // Session data
  sessionInfo: SessionInfo | null;
  vendor: Vendor | null;
  locations: Location[];
  customUserId: string | null;
  sessionData: SessionData | null;

  // UI state
  loading: boolean;
  error: string | null;

  // Actions
  loadVendorAndLocations: (authUserId: string) => Promise<void>;
  selectLocation: (locationId: string, locationName: string) => Promise<void>;
  selectRegister: (
    registerId: string,
    registerName: string
  ) => Promise<{ needsCashDrawer: boolean; registerId?: string; registerName?: string } | void>;
  openCashDrawer: (openingCash: number, notes: string) => Promise<void>;
  prepareEndSession: () => Promise<void>;
  closeCashDrawer: (closingCash: number, notes: string) => Promise<void>;
  clearSession: () => void;
  reset: () => void;
}

const initialState = {
  sessionInfo: null,
  vendor: null,
  locations: [],
  customUserId: null,
  sessionData: null,
  loading: false,
  error: null,
};

export const usePOSSessionStore = create<POSSessionState>()(
  devtools(
    persist(
      (set, get) => ({
  ...initialState,

  /**
   * Load vendor and locations for the user
   */
  loadVendorAndLocations: async (authUserId: string) => {
    try {
      set({ loading: true, error: null });

      // Get user's vendor by auth_user_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, vendor_id, vendors(id, store_name, logo_url)')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (userError || !userData) throw userError || new Error('User record not found');

      logger.info('[POSSession] User data loaded', {
        userId: userData.id,
        role: userData.role,
        vendorId: userData.vendor_id,
        vendors: userData.vendors
      });

      // Extract vendor from join (might be object or array depending on relationship)
      const vendors = userData.vendors;
      let vendorData: { id: string; store_name: string; logo_url?: string | null } | null = null;

      if (vendors) {
        if (Array.isArray(vendors)) {
          vendorData = vendors.length > 0 ? vendors[0] : null;
        } else {
          vendorData = vendors as { id: string; store_name: string; logo_url?: string | null };
        }
      }

      // Fallback: If vendor join failed, fetch separately using vendor_id
      if (!vendorData && userData.vendor_id) {
        logger.warn('[POSSession] Vendor join failed, fetching separately', {
          vendorId: userData.vendor_id
        });

        const { data: vendorFallback, error: vendorError } = await supabase
          .from('vendors')
          .select('id, store_name, logo_url')
          .eq('id', userData.vendor_id)
          .single();

        if (!vendorError && vendorFallback) {
          vendorData = vendorFallback;
          logger.info('[POSSession] Vendor loaded via fallback');
        } else {
          logger.error('[POSSession] Vendor fallback failed:', vendorError);
        }
      }

      if (!vendorData) {
        logger.error('[POSSession] No vendor found', {
          userId: userData.id,
          vendorId: userData.vendor_id,
          hasVendors: !!userData.vendors
        });
        throw new Error('No vendor found for user. Please contact support.');
      }

      logger.info('[POSSession] Vendor loaded successfully', {
        vendorId: vendorData.id,
        vendorName: vendorData.store_name
      });

      // Check if user is admin
      const isAdmin = ['vendor_owner', 'vendor_admin'].includes(userData.role);

      let locs: Location[] = [];

      if (isAdmin) {
        // Get all active, POS-enabled locations
        const { data: allLocations, error: locationsError } = await supabase
          .from('locations')
          .select('id, name, address_line1, city, state, is_primary')
          .eq('vendor_id', userData.vendor_id)
          .eq('is_active', true)
          .eq('pos_enabled', true)
          .order('is_primary', { ascending: false })
          .order('name');

        if (locationsError) throw locationsError;
        locs = allLocations || [];
      } else {
        // Get user's assigned locations
        const { data: locationsData, error: locationsError } = await supabase
          .from('user_locations')
          .select(`
            location_id,
            locations!inner (
              id,
              name,
              address_line1,
              city,
              state,
              is_primary
            )
          `)
          .eq('user_id', userData.id);

        if (locationsError) throw locationsError;

        locs = (locationsData || []).map((ul: any) => ul.locations).filter(Boolean);
      }

      set({
        vendor: vendorData as Vendor,
        customUserId: userData.id,
        locations: locs,
        loading: false,
      });
    } catch (err) {
      logger.error('Error loading vendor/locations:', err);
      set({
        error: err instanceof Error ? err.message : 'Failed to load vendor/locations',
        loading: false,
      });
    }
  },

  /**
   * Select a location and load tax configuration
   */
  selectLocation: async (locationId: string, locationName: string) => {
    logger.debug('🎯 [posSession.store] selectLocation START', { locationId, locationName })
    try {
      logger.debug('🎯 [posSession.store] Fetching location settings from Supabase...')
      const { data: location, error } = await supabase
        .from('locations')
        .select('settings')
        .eq('id', locationId)
        .single();

      if (error) {
        logger.error('❌ [posSession.store] Supabase error:', error)
        throw error
      }

      logger.debug('✅ [posSession.store] Location settings fetched:', location)

      const taxConfig = location?.settings?.tax_config || {};
      const taxRate = taxConfig.sales_tax_rate || 0.08;
      const taxName = taxConfig.tax_name;

      logger.debug('🎯 [posSession.store] Setting sessionInfo in store...')
      set({
        sessionInfo: {
          locationId,
          locationName,
          registerId: '',
          registerName: '',
          sessionId: '',
          taxRate,
          taxName,
        },
      });
      logger.debug('✅ [posSession.store] selectLocation COMPLETE')
    } catch (err) {
      logger.error('❌ [posSession.store] Error loading location tax config:', err);
      // Fallback with default tax rate
      logger.debug('🎯 [posSession.store] Using fallback tax rate')
      set({
        sessionInfo: {
          locationId,
          locationName,
          registerId: '',
          registerName: '',
          sessionId: '',
          taxRate: 0.08,
        },
      });
      logger.debug('✅ [posSession.store] selectLocation COMPLETE (with fallback)')
    }
  },

  /**
   * Select a register and join/create session
   */
  selectRegister: async (registerId: string, registerName: string) => {
    try {
      // Check for active session
      const { data: activeSession } = await supabase
        .from('pos_sessions')
        .select('id, session_number')
        .eq('register_id', registerId)
        .eq('status', 'open')
        .single();

      if (activeSession) {
        // Join existing session
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        set((state) => ({
          sessionInfo: {
            ...state.sessionInfo!,
            registerId,
            registerName,
            sessionId: activeSession.id,
          },
        }));
        return { needsCashDrawer: false };
      }

      // No active session - needs cash drawer
      // CRITICAL FIX: Must set registerId in store before returning!
      set((state) => ({
        sessionInfo: {
          ...state.sessionInfo!,
          registerId,
          registerName,
        },
      }));
      return { needsCashDrawer: true, registerId, registerName };
    } catch (err) {
      logger.error('Error selecting register:', err);
      throw err;
    }
  },

  /**
   * Open cash drawer and create session
   */
  openCashDrawer: async (openingCash: number, _notes: string) => {
    const { sessionInfo, customUserId, vendor } = get();

    if (!sessionInfo) {
      throw new Error('Session info missing');
    }

    if (!customUserId) {
      logger.error('[openCashDrawer] customUserId is missing!', { customUserId });
      throw new Error('User ID is required to start a session');
    }

    if (!vendor) {
      throw new Error('Vendor info missing');
    }

    logger.debug('[openCashDrawer] Starting session with:', {
      locationId: sessionInfo.locationId,
      registerId: sessionInfo.registerId,
      userId: customUserId,
      vendorId: vendor.id,
      openingCash,
    });

    try {
      // Call RPC function to create session
      const { data, error } = await supabase.rpc('get_or_create_session', {
        p_location_id: sessionInfo.locationId,
        p_opening_cash: openingCash,
        p_register_id: sessionInfo.registerId,
        p_user_id: customUserId,
        p_vendor_id: vendor.id,
      });

      if (error) {
        logger.error('[openCashDrawer] RPC error:', error);
        throw error;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      set((state) => ({
        sessionInfo: {
          ...state.sessionInfo!,
          sessionId: data.id,
        },
        sessionData: {
          sessionNumber: data.session_number || 'Unknown',
          totalSales: 0,
          totalCash: 0,
          openingCash,
        },
      }));
    } catch (err) {
      logger.error('Error opening cash drawer:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    }
  },

  /**
   * Prepare to end session - load session data and open modal
   * ANTI-LOOP: Simple async action, no circular dependencies
   */
  prepareEndSession: async () => {
    const { sessionInfo } = get();

    if (!sessionInfo?.sessionId) {
      logger.error('[END SESSION] No session ID found!');
      return;
    }

    try {
      logger.debug('[END SESSION] Loading session data for ID:', sessionInfo.sessionId);

      const { data: session, error } = await supabase
        .from('pos_sessions')
        .select('session_number, total_sales, total_cash, opening_cash')
        .eq('id', sessionInfo.sessionId)
        .single();

      if (error || !session) {
        logger.error('[END SESSION] Error loading session data:', error);
        return;
      }

      logger.debug('[END SESSION] Session data loaded:', session);

      // Store session data for modal
      set({
        sessionData: {
          sessionNumber: session.session_number,
          totalSales: session.total_sales || 0,
          totalCash: session.total_cash || 0,
          openingCash: session.opening_cash || 0,
        },
      });

      // Import checkoutUIActions to open modal
      // NOTE: This is safe because we're importing actions, not creating subscriptions
      const { checkoutUIActions } = await import('./checkout-ui.store');

      logger.debug('[END SESSION] Opening close drawer modal');
      checkoutUIActions.openModal('cashDrawerClose');

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      logger.error('[END SESSION] Error in prepareEndSession:', error);
    }
  },

  /**
   * Close cash drawer and end session
   */
  closeCashDrawer: async (closingCash: number, notes: string) => {
    const { sessionInfo } = get();

    if (!sessionInfo?.sessionId) {
      throw new Error('No active session');
    }

    try {
      // Close session via RPC
      const { data, error } = await supabase.rpc('close_pos_session', {
        p_session_id: sessionInfo.sessionId,
        p_closing_cash: closingCash,
        p_closing_notes: notes || null,
      });

      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || 'Failed to close session');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Clear session
      get().clearSession();
    } catch (err) {
      logger.error('Error closing cash drawer:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    }
  },

  /**
   * Clear session state
   */
  clearSession: () => {
    set({
      sessionInfo: null,
      sessionData: null,
    });
  },

  /**
   * Reset entire store (for logout)
   */
  reset: () => {
    set(initialState);
  },
      }),
      {
        name: 'pos-session-storage',
        storage: {
          getItem: async (name) => {
            const value = await AsyncStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          },
          setItem: async (name, value) => {
            await AsyncStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: async (name) => {
            await AsyncStorage.removeItem(name);
          },
        },
        partialize: (state) => ({
          // Persist session info, vendor, and customUserId for crash recovery
          sessionInfo: state.sessionInfo,
          vendor: state.vendor,
          customUserId: state.customUserId,
          // Don't persist locations (refetch), loading/error states, or sessionData
        }),
      }
    ),
    { name: 'POSSessionStore' }
  )
);

/**
 * Selectors for cleaner component usage
 * ✅ CRITICAL: Use useShallow to prevent new object on every render
 */
export const usePOSSession = () => usePOSSessionStore(
  useShallow((state) => ({
    sessionInfo: state.sessionInfo,
    vendor: state.vendor,
    customUserId: state.customUserId,
    sessionData: state.sessionData,
    loading: state.loading,
    error: state.error,
  }))
);

// Export POS session actions as plain object (not a hook!)
export const posSessionActions = {
  get loadVendorAndLocations() { return usePOSSessionStore.getState().loadVendorAndLocations },
  get selectLocation() { return usePOSSessionStore.getState().selectLocation },
  get selectRegister() { return usePOSSessionStore.getState().selectRegister },
  get openCashDrawer() { return usePOSSessionStore.getState().openCashDrawer },
  get prepareEndSession() { return usePOSSessionStore.getState().prepareEndSession },
  get closeCashDrawer() { return usePOSSessionStore.getState().closeCashDrawer },
  get clearSession() { return usePOSSessionStore.getState().clearSession },
  get reset() { return usePOSSessionStore.getState().reset },
};

// Legacy hook for backward compatibility
export const usePOSSessionActions = () => posSessionActions;

export const usePOSLocations = () => usePOSSessionStore((state) => state.locations);
