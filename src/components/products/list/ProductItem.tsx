/**
 * ProductItem Component
 * Apple Standard: Focused, single-responsibility list item
 *
 * Handles:
 * - Product display in list view
 * - Location-aware inventory display
 * - Multi-location inventory breakdown
 */

import React, { useMemo, memo } from 'react'
import { View, Text, StyleSheet, Pressable, Image } from 'react-native'
import { layout } from '@/theme/layout'
import type { Product } from '@/types/products'

interface ProductItemProps {
  item: Product
  isLast: boolean
  isSelected: boolean
  categoryName: string | null
  selectedLocationIds: string[]
  locationNames: string[]
  onPress: () => void
}

function ProductItemComponent({
  item,
  isLast,
  isSelected,
  categoryName,
  selectedLocationIds,
  locationNames,
  onPress,
}: ProductItemProps) {
  // Calculate location-aware inventory display
  const inventoryDisplay = useMemo(() => {
    // Use inventory_quantity from the current product (single location data from store)
    const qty = item.inventory_quantity ?? 0

    return {
      type: 'single' as const,
      stock: qty,
      isInStock: qty > 0,
    }
  }, [item])

  return (
    <Pressable
      style={[
        styles.productItem,
        isSelected && styles.productItemActive,
        isLast && styles.productItemLast,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {/* Icon/Thumbnail */}
      <View style={styles.productIcon}>
        {item.featured_image ? (
          <Image
            source={{ uri: item.featured_image }}
            style={styles.productIconImage}
          />
        ) : (
          <View style={[styles.productIconPlaceholder, styles.productIconImage]}>
            <Text style={styles.productIconText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Product Name & Category */}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.productSKU} numberOfLines={1}>
          {categoryName || 'Uncategorized'}
        </Text>
      </View>

      {/* Inventory Display - Adapts based on filter */}
      {inventoryDisplay.type === 'aggregate' && (
        <>
          <View style={styles.dataColumn}>
            <Text style={styles.dataLabel}>STOCK</Text>
            <Text
              style={[
                styles.dataValue,
                styles.stockValue,
                inventoryDisplay.totalStock === 0 && styles.stockOut,
                inventoryDisplay.totalStock > 0 && inventoryDisplay.totalStock < 10 && styles.stockLow,
                inventoryDisplay.totalStock >= 10 && styles.stockOk,
              ]}
            >
              {inventoryDisplay.totalStock}g
            </Text>
          </View>
          <View style={styles.dataColumn}>
            <Text style={styles.dataLabel}>LOCATIONS</Text>
            <Text style={styles.dataValue}>{inventoryDisplay.locationsCount}</Text>
          </View>
        </>
      )}

      {inventoryDisplay.type === 'single' && (
        <>
          <View style={styles.dataColumn}>
            <Text style={styles.dataLabel}>STOCK</Text>
            <Text
              style={[
                styles.dataValue,
                styles.stockValue,
                inventoryDisplay.stock === 0 && styles.stockOut,
                inventoryDisplay.stock > 0 && inventoryDisplay.stock < 10 && styles.stockLow,
                inventoryDisplay.stock >= 10 && styles.stockOk,
              ]}
            >
              {inventoryDisplay.stock}g
            </Text>
          </View>
          <View style={styles.dataColumn}>
            <Text style={styles.dataLabel}>STATUS</Text>
            <Text style={[styles.dataValue, inventoryDisplay.isInStock ? styles.stockOk : styles.stockOut]}>
              {inventoryDisplay.isInStock ? 'In Stock' : 'Out'}
            </Text>
          </View>
        </>
      )}

      {inventoryDisplay.type === 'multi' && (
        <View style={styles.locationBreakdown}>
          {inventoryDisplay.topLocations.map((loc, idx) => (
            <View key={idx} style={styles.locationRow}>
              <Text style={styles.locationName} numberOfLines={1}>{loc.name}</Text>
              <Text
                style={[
                  styles.locationQty,
                  loc.quantity === 0 && styles.stockOut,
                  loc.quantity > 0 && loc.quantity < 10 && styles.stockLow,
                  loc.quantity >= 10 && styles.stockOk,
                ]}
              >
                {loc.quantity}g
              </Text>
            </View>
          ))}
          {inventoryDisplay.totalLocations > 2 && (
            <Text style={styles.moreLocations}>
              +{inventoryDisplay.totalLocations - 2} more
            </Text>
          )}
        </View>
      )}
    </Pressable>
  )
}

export const ProductItem = memo(ProductItemComponent)
ProductItem.displayName = 'ProductItem'

// ========================================
// STYLES
// ========================================
const styles = StyleSheet.create({
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    gap: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: layout.minTouchTarget,
  },
  productItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  productItemLast: {
    borderBottomWidth: 0,
  },
  productIcon: {
    width: 44,
    height: 44,
  },
  productIconImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  productIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIconText: {
    fontSize: 20,
    color: 'rgba(235,235,245,0.6)',
  },
  productInfo: {
    flex: 1,
    gap: 2,
    minWidth: 180,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  productSKU: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },

  // Multi-location breakdown
  locationBreakdown: {
    gap: 3,
    minWidth: 140,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  locationName: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
    flex: 1,
  },
  locationQty: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
    minWidth: 45,
    textAlign: 'right',
  },
  moreLocations: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.2,
    marginTop: 1,
  },

  // Data Columns
  dataColumn: {
    minWidth: 80,
    alignItems: 'flex-end',
    gap: 2,
  },
  dataLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dataValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },

  // Stock Color Coding
  stockValue: {
    fontVariant: ['tabular-nums'],
  },
  stockOut: {
    color: '#ff3b30',
  },
  stockLow: {
    color: '#ff9500',
  },
  stockOk: {
    color: '#34c759',
  },
})
