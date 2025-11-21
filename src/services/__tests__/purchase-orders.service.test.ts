/**
 * Unit Tests for Purchase Orders Service
 * Tests core PO operations with mocked Supabase client
 */

import {
  createPurchaseOrder,
  receiveItems,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  getPurchaseOrderStats,
  type CreatePurchaseOrderParams,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from '../purchase-orders.service'

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    startSpan: jest.fn(() => ({ finish: jest.fn() })),
  },
}))

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
}

jest.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabase,
}))

describe('Purchase Orders Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createPurchaseOrder', () => {
    const vendorId = 'vendor-123'
    const validParams: CreatePurchaseOrderParams = {
      po_type: 'inbound',
      supplier_id: 'supplier-123',
      location_id: 'location-123',
      items: [
        { product_id: 'product-1', quantity: 10, unit_price: 5.00 },
        { product_id: 'product-2', quantity: 5, unit_price: 10.00 },
      ],
      tax: 10.00,
      shipping: 5.00,
    }

    it('should create a purchase order successfully', async () => {
      const mockPO = {
        id: 'po-123',
        po_number: 'PO-20251119-0001',
        vendor_id: vendorId,
        status: 'draft',
        subtotal: 100.00,
        tax_amount: 10.00,
        shipping_cost: 5.00,
        total_amount: 115.00,
      }

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockPO, error: null }),
          }),
        }),
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      })

      const result = await createPurchaseOrder(vendorId, validParams)

      expect(result).toEqual(mockPO)
      expect(mockSupabase.from).toHaveBeenCalledWith('purchase_orders')
      expect(mockSupabase.from).toHaveBeenCalledWith('purchase_order_items')
    })

    it('should validate vendor ID is required', async () => {
      await expect(
        createPurchaseOrder('', validParams)
      ).rejects.toThrow('Vendor ID is required')
    })

    it('should validate PO type is required', async () => {
      await expect(
        createPurchaseOrder(vendorId, { ...validParams, po_type: '' as any })
      ).rejects.toThrow('Valid PO type is required')
    })

    it('should validate supplier is required for inbound POs', async () => {
      await expect(
        createPurchaseOrder(vendorId, { ...validParams, supplier_id: undefined })
      ).rejects.toThrow('Supplier is required for inbound POs')
    })

    it('should validate at least one item is required', async () => {
      await expect(
        createPurchaseOrder(vendorId, { ...validParams, items: [] })
      ).rejects.toThrow('At least one item is required')
    })

    it('should validate item quantity must be greater than 0', async () => {
      await expect(
        createPurchaseOrder(vendorId, {
          ...validParams,
          items: [{ product_id: 'p1', quantity: 0, unit_price: 10 }],
        })
      ).rejects.toThrow('Item quantity must be greater than 0')
    })

    it('should validate item unit price must be 0 or greater', async () => {
      await expect(
        createPurchaseOrder(vendorId, {
          ...validParams,
          items: [{ product_id: 'p1', quantity: 10, unit_price: -5 }],
        })
      ).rejects.toThrow('Item unit price must be 0 or greater')
    })

    it('should rollback PO when items fail to insert', async () => {
      const mockPO = { id: 'po-123', po_number: 'PO-20251119-0001' }
      const mockDelete = jest.fn().mockResolvedValue({ error: null })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockPO, error: null }),
          }),
        }),
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          error: { message: 'Insert failed', code: '23505' },
        }),
      })

      mockSupabase.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(mockDelete),
        }),
      })

      await expect(
        createPurchaseOrder(vendorId, validParams)
      ).rejects.toThrow('Failed to create purchase order items')

      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('receiveItems', () => {
    const poId = 'po-123'
    const locationId = 'location-123'
    const validItems = [
      { item_id: 'item-1', quantity: 10, condition: 'good' as const, quality_notes: undefined },
      { item_id: 'item-2', quantity: 5, condition: 'good' as const, quality_notes: undefined },
    ]

    it('should receive items successfully', async () => {
      const mockResult = {
        success: true,
        items_processed: 2,
        new_status: 'partially_received',
      }

      mockSupabase.rpc.mockResolvedValue({ data: mockResult, error: null })

      const result = await receiveItems(poId, validItems, locationId)

      expect(result).toEqual({
        success: true,
        itemsProcessed: 2,
        newStatus: 'partially_received',
      })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('receive_po_items', {
        p_po_id: poId,
        p_location_id: locationId,
        p_items: validItems,
      })
    })

    it('should validate PO ID is required', async () => {
      await expect(
        receiveItems('', validItems, locationId)
      ).rejects.toThrow('Purchase order ID is required')
    })

    it('should validate location ID is required', async () => {
      await expect(
        receiveItems(poId, validItems, '')
      ).rejects.toThrow('Location ID is required')
    })

    it('should validate at least one item is required', async () => {
      await expect(
        receiveItems(poId, [], locationId)
      ).rejects.toThrow('At least one item is required')
    })

    it('should validate item ID is required', async () => {
      await expect(
        receiveItems(poId, [
          { item_id: '', quantity: 10, condition: 'good' },
        ], locationId)
      ).rejects.toThrow('Item ID is required for all items')
    })

    it('should validate quantity must be greater than 0', async () => {
      await expect(
        receiveItems(poId, [
          { item_id: 'item-1', quantity: 0, condition: 'good' },
        ], locationId)
      ).rejects.toThrow('Invalid quantity 0 for item item-1')
    })

    it('should validate condition must be valid', async () => {
      await expect(
        receiveItems(poId, [
          { item_id: 'item-1', quantity: 10, condition: 'invalid' as any },
        ], locationId)
      ).rejects.toThrow('Invalid condition')
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST116' },
      })

      await expect(
        receiveItems(poId, validItems, locationId)
      ).rejects.toThrow('Failed to receive items')
    })

    it('should provide user-friendly error for not found', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Purchase order not found: po-123' },
      })

      await expect(
        receiveItems(poId, validItems, locationId)
      ).rejects.toThrow('Purchase order or item not found')
    })

    it('should provide user-friendly error for over-receiving', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Cannot receive 15 total for item item-1 (ordered quantity: 10)' },
      })

      await expect(
        receiveItems(poId, validItems, locationId)
      ).rejects.toThrow('Cannot receive 15 total for item item-1')
    })
  })

  describe('getPurchaseOrders', () => {
    it('should fetch purchase orders successfully', async () => {
      const mockPOs = [
        {
          id: 'po-1',
          po_number: 'PO-20251119-0001',
          status: 'draft',
          suppliers: { external_name: 'Supplier 1' },
          purchase_order_items: [
            { quantity: 10, received_quantity: 0 },
          ],
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockPOs, error: null }),
        }),
      })

      const result = await getPurchaseOrders()

      expect(result).toHaveLength(1)
      expect(result[0].supplier_name).toBe('Supplier 1')
      expect(result[0].items_count).toBe(1)
    })

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      })

      await expect(getPurchaseOrders()).rejects.toThrow('Failed to fetch purchase orders')
    })
  })

  describe('updatePurchaseOrderStatus', () => {
    it('should update status successfully', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      })

      await updatePurchaseOrderStatus('po-123', 'received')

      expect(mockSupabase.from).toHaveBeenCalledWith('purchase_orders')
    })

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Update failed' },
          }),
        }),
      })

      await expect(
        updatePurchaseOrderStatus('po-123', 'received')
      ).rejects.toThrow('Failed to update purchase order status')
    })
  })

  describe('deletePurchaseOrder', () => {
    it('should delete PO and items successfully', async () => {
      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })

      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      })

      await deletePurchaseOrder('po-123')

      expect(mockSupabase.from).toHaveBeenCalledWith('purchase_order_items')
      expect(mockSupabase.from).toHaveBeenCalledWith('purchase_orders')
    })
  })

  describe('getPurchaseOrderStats', () => {
    it('should calculate stats correctly', async () => {
      const mockPOs = [
        { status: 'draft', total_amount: 100 },
        { status: 'draft', total_amount: 50 },
        { status: 'pending', total_amount: 200 },
        { status: 'received', total_amount: 300 },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockPOs, error: null }),
      })

      const stats = await getPurchaseOrderStats()

      expect(stats).toEqual({
        total: 4,
        draft: 2,
        pending: 1,
        received: 1,
        totalValue: 650,
      })
    })
  })
})
