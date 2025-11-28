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
import { getIconImage } from '@/utils/image-transforms'

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
    // When NO locations selected (All Locations view), hide stock quantities (catalog view)
    if (selectedLocationIds.length === 0) {
      return {
        type: 'none' as const,
      }
    }

    // When specific locations are selected, show inventory breakdown
    if (item.inventory && item.inventory.length > 0) {
      // Filter to selected locations
      const relevantInventory = item.inventory.filter(inv =>
        selectedLocationIds.includes(inv.location_id)
      )

      // Sort by location name for consistent display
      const sortedInventory = [...relevantInventory].sort((a, b) =>
        a.location_name.localeCompare(b.location_name)
      )

      // Show per-location breakdown when we have inventory data
      if (sortedInventory.length > 0) {
        return {
          type: 'multi' as const,
          locations: sortedInventory,
          totalStock: sortedInventory.reduce((sum, inv) => sum + inv.available_quantity, 0),
        }
      }
    }

    // Fallback: No inventory data - show 0 stock
    return {
      type: 'single' as const,
      stock: 0,
    }
  }, [item, selectedLocationIds])

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
      {/* Icon/Thumbnail - Apple Music Style: Full-height, zero padding */}
      {item.featured_image ? (
        <Image
          source={{ uri: getIconImage(item.featured_image) || item.featured_image }}
          style={styles.productIconImage}
          resizeMode="cover"
        />
      ) : item.vendor_logo_url ? (
        <Image
          source={{ uri: getIconImage(item.vendor_logo_url) || item.vendor_logo_url }}
          style={styles.productIconImage}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.productIconPlaceholder, styles.productIconImage]}>
          <Text style={styles.productIconText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

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
      {inventoryDisplay.type !== 'none' && (
        <View style={styles.inventoryColumn}>
          {inventoryDisplay.type === 'single' && (
            <>
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
            </>
          )}

          {inventoryDisplay.type === 'multi' && (
            <View style={styles.locationsContainer}>
              {/* Show total if multiple locations */}
              {inventoryDisplay.locations.length > 1 && (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>TOTAL</Text>
                    <Text
                      style={[
                        styles.totalQty,
                        inventoryDisplay.totalStock === 0 && styles.stockOut,
                        inventoryDisplay.totalStock > 0 && inventoryDisplay.totalStock < 10 && styles.stockLow,
                        inventoryDisplay.totalStock >= 10 && styles.stockOk,
                      ]}
                    >
                      {inventoryDisplay.totalStock}g
                    </Text>
                  </View>
                  <View style={styles.totalDivider} />
                </>
              )}
              {/* Per-location breakdown */}
              {inventoryDisplay.locations.map((loc, index) => (
                <View key={loc.id}>
                  <View style={styles.locationRow}>
                    <Text style={styles.locationName} numberOfLines={1}>
                      {loc.location_name}
                    </Text>
                    <Text
                      style={[
                        styles.locationQty,
                        loc.available_quantity === 0 && styles.stockOut,
                        loc.available_quantity > 0 && loc.available_quantity < 10 && styles.stockLow,
                        loc.available_quantity >= 10 && styles.stockOk,
                      ]}
                    >
                      {loc.available_quantity}g
                    </Text>
                  </View>
                  {index < inventoryDisplay.locations.length - 1 && (
                    <View style={styles.locationDivider} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </Pressable>
  )
}

export const ProductItem = memo(ProductItemComponent)
ProductItem.displayName = 'ProductItem'

// ========================================
// STYLES - Apple Music Style
// ========================================
const styles = StyleSheet.create({
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6, // Small vertical padding - Apple Music style
    paddingLeft: 12, // Small left padding for album art spacing
    paddingRight: layout.rowPaddingHorizontal,
    gap: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: 72,
  },
  productItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  productItemLast: {
    borderBottomWidth: 0,
  },
  productIconImage: {
    width: 60, // Slightly smaller to account for padding
    height: 60,
    borderRadius: 8, // iOS rounded corners - Apple Music style
  },
  productIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIconText: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
  },
  productInfo: {
    flex: 1,
    gap: 2,
    minWidth: 180,
    paddingVertical: 0,
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

  // Inventory column wrapper
  inventoryColumn: {
    minWidth: 240,
    alignItems: 'flex-end',
  },
  // Multi-location breakdown
  locationsContainer: {
    gap: 0,
    width: 240,
  },
  // Total row (shown when multiple locations)
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 8,
    gap: 12,
  },
  totalLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'left',
  },
  totalQty: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.4,
    minWidth: 55,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  totalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 4,
    marginHorizontal: 8,
  },
  // Individual location rows
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 12,
  },
  locationDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 1,
    marginHorizontal: 8,
  },
  locationName: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'left',
  },
  locationQty: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
    minWidth: 55,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  moreLocations: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.2,
    marginTop: 1,
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
