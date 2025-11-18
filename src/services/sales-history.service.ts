import { supabase } from '@/lib/supabase/client';
import { logger } from '@/utils/logger';

export interface SalesRecord {
  id: string;
  order_id: string;
  order_number: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax: number;
  total: number;
  discount?: number;
  order_type: 'walk_in' | 'pickup' | 'delivery' | 'shipping';
  order_status: string;
  customer_name?: string;
  location_id?: string;
  location_name?: string;
  created_at: string;
}

export interface SalesStats {
  total_units_sold: number;
  total_revenue: number;
  average_unit_price: number;
  total_orders: number;
  by_order_type: Record<string, { units: number; revenue: number }>;
  by_date: { date: string; units: number; revenue: number }[];
}

export interface SalesHistoryFilters {
  product_id?: string;
  location_id?: string;
  order_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch sales history for products
 */
export async function fetchSalesHistory(
  vendorId: string,
  filters: SalesHistoryFilters = {}
): Promise<{ data: SalesRecord[] | null; error: any }> {
  try {
    // First, get order IDs for this vendor with completed status
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, order_type, status, pickup_location_id, created_at')
      .eq('vendor_id', vendorId)
      .in('status', ['completed', 'delivered', 'shipped']);

    if (orderError) {
      logger.error('Error fetching orders:', orderError);
      return { data: null, error: orderError };
    }

    if (!orderData || orderData.length === 0) {
      return { data: [], error: null };
    }

    const orderIds = orderData.map(o => o.id);
    const orderMap = new Map(orderData.map(o => [o.id, o]));

    // Now get order items for these orders
    let query = supabase
      .from('order_items')
      .select('*, products(id, name, sku)')
      .in('order_id', orderIds);

    if (filters.product_id) {
      query = query.eq('product_id', filters.product_id);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching order items:', error);
      return { data: null, error };
    }

    // Transform the data into SalesRecord format
    let salesRecords: SalesRecord[] = (data || [])
      .map((item: any) => {
        const order = orderMap.get(item.order_id);
        if (!order) return null;

        return {
          id: item.id,
          order_id: item.order_id,
          order_number: order.order_number,
          product_id: item.product_id,
          product_name: item.products?.name || 'Unknown',
          product_sku: item.products?.sku,
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          subtotal: item.subtotal || 0,
          tax: item.tax_amount || 0,
          total: item.total || 0,
          discount: item.discount_amount || 0,
          order_type: order.order_type,
          order_status: order.status,
          customer_name: undefined,
          location_id: order.pickup_location_id,
          location_name: undefined,
          created_at: order.created_at,
        };
      })
      .filter((record): record is SalesRecord => record !== null);

    // Apply location filter in memory
    if (filters.location_id) {
      salesRecords = salesRecords.filter(
        record => record.location_id === filters.location_id
      );
    }

    // Apply order type filter in memory
    if (filters.order_type) {
      salesRecords = salesRecords.filter(
        record => record.order_type === filters.order_type
      );
    }

    // Apply date filters in memory
    if (filters.start_date) {
      const startTime = new Date(filters.start_date).getTime();
      salesRecords = salesRecords.filter(record => {
        return new Date(record.created_at).getTime() >= startTime;
      });
    }

    if (filters.end_date) {
      const endTime = new Date(filters.end_date).getTime();
      salesRecords = salesRecords.filter(record => {
        return new Date(record.created_at).getTime() <= endTime;
      });
    }

    // Sort by created_at descending (newest first)
    salesRecords.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Apply limit in memory
    if (filters.limit) {
      salesRecords = salesRecords.slice(0, filters.limit);
    }

    return { data: salesRecords, error: null };
  } catch (error) {
    logger.error('Error in fetchSalesHistory:', error);
    return { data: null, error };
  }
}

/**
 * Get sales statistics for a product
 */
export async function getSalesStats(
  vendorId: string,
  productId?: string,
  startDate?: string,
  endDate?: string
): Promise<SalesStats> {
  try {
    const filters: SalesHistoryFilters = {
      product_id: productId,
      start_date: startDate,
      end_date: endDate,
    };

    const { data, error } = await fetchSalesHistory(vendorId, filters);

    if (error || !data) {
      return {
        total_units_sold: 0,
        total_revenue: 0,
        average_unit_price: 0,
        total_orders: 0,
        by_order_type: {},
        by_date: [],
      };
    }

    // Calculate statistics
    const stats = data.reduce((acc, record) => {
      acc.total_units_sold += record.quantity;
      acc.total_revenue += record.total;

      // Track unique orders
      if (!acc.order_ids.has(record.order_id)) {
        acc.order_ids.add(record.order_id);
        acc.total_orders += 1;
      }

      // By order type
      if (!acc.by_order_type[record.order_type]) {
        acc.by_order_type[record.order_type] = { units: 0, revenue: 0 };
      }
      acc.by_order_type[record.order_type].units += record.quantity;
      acc.by_order_type[record.order_type].revenue += record.total;

      // By date
      const date = new Date(record.created_at).toISOString().split('T')[0];
      const existing = acc.by_date.find(d => d.date === date);
      if (existing) {
        existing.units += record.quantity;
        existing.revenue += record.total;
      } else {
        acc.by_date.push({ date, units: record.quantity, revenue: record.total });
      }

      return acc;
    }, {
      total_units_sold: 0,
      total_revenue: 0,
      total_orders: 0,
      order_ids: new Set<string>(),
      by_order_type: {} as Record<string, { units: number; revenue: number }>,
      by_date: [] as { date: string; units: number; revenue: number }[],
    });

    // Calculate average unit price
    const average_unit_price = stats.total_units_sold > 0
      ? stats.total_revenue / stats.total_units_sold
      : 0;

    // Sort by_date chronologically
    stats.by_date.sort((a, b) => a.date.localeCompare(b.date));

    return {
      total_units_sold: stats.total_units_sold,
      total_revenue: stats.total_revenue,
      average_unit_price,
      total_orders: stats.total_orders,
      by_order_type: stats.by_order_type,
      by_date: stats.by_date,
    };
  } catch (error) {
    logger.error('Error in getSalesStats:', error);
    return {
      total_units_sold: 0,
      total_revenue: 0,
      average_unit_price: 0,
      total_orders: 0,
      by_order_type: {},
      by_date: [],
    };
  }
}

/**
 * Export sales history to CSV format
 */
export function exportSalesHistoryToCSV(salesRecords: SalesRecord[]): string {
  const headers = [
    'Date',
    'Order Number',
    'Product Name',
    'SKU',
    'Quantity',
    'Unit Price',
    'Subtotal',
    'Tax',
    'Total',
    'Order Type',
    'Customer',
    'Location'
  ].join(',');

  const rows = salesRecords.map(record => [
    new Date(record.created_at).toLocaleDateString(),
    record.order_number,
    `"${record.product_name}"`,
    record.product_sku || '',
    record.quantity,
    record.unit_price.toFixed(2),
    record.subtotal.toFixed(2),
    record.tax.toFixed(2),
    record.total.toFixed(2),
    record.order_type,
    `"${record.customer_name || ''}"`,
    record.location_name || ''
  ].join(','));

  return [headers, ...rows].join('\n');
}
