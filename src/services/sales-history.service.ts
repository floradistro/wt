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
  tier_name?: string; // The actual weight sold (e.g., "28g", "3.5g")
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
    logger.info('[fetchSalesHistory] Starting fetch', { vendorId, filters })

    // Query order_items directly by vendor_id to avoid massive IN clause with order IDs
    // Note: We use denormalized fields (product_name, product_sku) instead of joining
    // because products table has RLS enabled which may filter out unpublished products
    let itemsQuery = supabase
      .from('order_items')
      .select('*')
      .eq('vendor_id', vendorId);

    if (filters.product_id) {
      itemsQuery = itemsQuery.eq('product_id', filters.product_id);
    }

    const { data: itemsData, error: itemsError } = await itemsQuery;

    logger.info('[fetchSalesHistory] Order items fetched', {
      itemsCount: itemsData?.length || 0,
      hasError: !!itemsError,
      firstItem: itemsData?.[0] || null,
    })

    if (itemsError) {
      logger.error('Error fetching order items:', itemsError);
      return { data: null, error: itemsError };
    }

    if (!itemsData || itemsData.length === 0) {
      logger.info('[fetchSalesHistory] No order items found')
      return { data: [], error: null };
    }

    // Get unique order IDs from the items
    const orderIds = [...new Set(itemsData.map(item => item.order_id))];

    logger.info('[fetchSalesHistory] Fetching orders', {
      orderIdsCount: orderIds.length,
    })

    // Fetch orders for these items (filter by completed status)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, order_type, status, pickup_location_id, customer_id, created_at')
      .in('id', orderIds)
      .in('status', ['completed', 'delivered', 'shipped']);

    if (orderError) {
      logger.error('[fetchSalesHistory] Error fetching orders:', orderError);
      return { data: null, error: orderError };
    }

    logger.info('[fetchSalesHistory] Orders fetched', {
      ordersCount: orderData?.length || 0,
    })

    if (!orderData || orderData.length === 0) {
      logger.info('[fetchSalesHistory] No completed orders found')
      return { data: [], error: null };
    }

    // Create order map and filter items to only completed orders
    const orderMap = new Map(orderData.map(o => [o.id, o]));
    const data = itemsData.filter(item => orderMap.has(item.order_id));

    // Get unique customer IDs and location IDs from the filtered orders
    const customerIds = [...new Set(orderData.map(o => o.customer_id).filter(Boolean))];
    const locationIds = [...new Set(orderData.map(o => o.pickup_location_id).filter(Boolean))];

    logger.info('[fetchSalesHistory] Unique IDs found', {
      customerIdsCount: customerIds.length,
      locationIdsCount: locationIds.length,
    })

    // Fetch customers (only if we have customer IDs)
    let customersData: any[] = []
    if (customerIds.length > 0) {
      const { data: custData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .in('id', customerIds);

      if (customersError) {
        logger.error('[fetchSalesHistory] Error fetching customers:', customersError)
      }

      customersData = custData || []
    }

    logger.info('[fetchSalesHistory] Customers fetched', {
      customersCount: customersData?.length || 0,
    })

    // Fetch locations (only if we have location IDs)
    let locationsData: any[] = []
    if (locationIds.length > 0) {
      const { data: locData } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds);

      locationsData = locData || []
    }

    logger.info('[fetchSalesHistory] Locations fetched', {
      locationsCount: locationsData?.length || 0,
    })

    // Create maps for quick lookup
    const customersMap = new Map((customersData || []).map(c => [c.id, c]));
    const locationsMap = new Map((locationsData || []).map(l => [l.id, l]));

    // Transform the data into SalesRecord format
    const mappedRecords = (data || [])
      .map((item: any) => {
        const order = orderMap.get(item.order_id);
        if (!order) return null;

        const customer = order.customer_id ? customersMap.get(order.customer_id) : null;
        const location = order.pickup_location_id ? locationsMap.get(order.pickup_location_id) : null;

        // Calculate total if not present: subtotal + tax - discount
        // Or fallback to: quantity * unit_price
        const subtotal = item.subtotal || (item.quantity * (item.unit_price || 0))
        const tax = item.tax_amount || 0
        const discount = item.discount_amount || 0
        const total = item.total || (subtotal + tax - discount)

        // Build customer name from available fields
        let customerName: string | undefined
        if (customer) {
          if (customer.full_name) {
            customerName = customer.full_name
          } else if (customer.first_name || customer.last_name) {
            customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ')
          }
        }

        return {
          id: item.id,
          order_id: item.order_id,
          order_number: order.order_number,
          product_id: item.product_id,
          product_name: item.product_name || 'Unknown', // Use denormalized field
          product_sku: item.product_sku, // Use denormalized field
          quantity: item.quantity,
          tier_name: item.tier_name || undefined, // The actual weight sold
          unit_price: item.unit_price || 0,
          subtotal,
          tax,
          total,
          discount,
          order_type: order.order_type,
          order_status: order.status,
          customer_name: customerName,
          location_id: order.pickup_location_id,
          location_name: location?.name,
          created_at: order.created_at,
        } as SalesRecord;
      })
      .filter((record) => record !== null) as SalesRecord[];

    let salesRecords = mappedRecords;

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

    logger.info('[fetchSalesHistory] Returning results', {
      finalCount: salesRecords.length,
      sampleRecord: salesRecords[0] ? {
        customer_name: salesRecords[0].customer_name,
        location_name: salesRecords[0].location_name,
        quantity: salesRecords[0].quantity,
        unit_price: salesRecords[0].unit_price,
        total: salesRecords[0].total,
      } : null,
    })

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
