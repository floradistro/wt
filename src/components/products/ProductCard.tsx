/**
 * ProductCard Component
 * Apple-quality product card with liquid glass
 * Jobs Principle: "Design is not just what it looks like. Design is how it works."
 */

import { View, Text, StyleSheet, Pressable, Image } from 'react-native'
import { memo } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import type { Product } from '@/types/products'

interface ProductCardProps {
  product: Product
  onPress?: (product: Product) => void
  onLongPress?: (product: Product) => void
}

export const ProductCard = memo(function ProductCard({
  product,
  onPress,
  onLongPress,
}: ProductCardProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.(product)
  }

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onLongPress?.(product)
  }

  // Format price
  const displayPrice = product.price
    ? `$${product.price.toFixed(2)}`
    : product.regular_price
    ? `$${product.regular_price.toFixed(2)}`
    : 'N/A'

  // Stock badge color
  const stockBadgeColor =
    (product.total_stock ?? 0) === 0
      ? '#ff3b30' // Red - out of stock
      : (product.total_stock ?? 0) < 10
      ? '#ff9500' // Orange - low stock
      : '#34c759' // Green - in stock

  return (
    <LiquidGlassView
      effect="regular"
      colorScheme="dark"
      interactive
      style={[styles.card, !isLiquidGlassSupported && styles.cardFallback]}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${displayPrice}, ${product.total_stock ?? 0} in stock${product.on_sale ? ', on sale' : ''}${product.featured ? ', featured' : ''}`}
        accessibilityHint={onPress ? 'Tap to view product details. Long press for quick actions' : undefined}
      >
        {/* Compact Row Layout */}
        <View style={styles.row}>
          {/* Small Thumbnail */}
          <View style={styles.thumbnailContainer}>
            {product.featured_image ? (
              <Image
                source={{ uri: product.featured_image }}
                style={styles.thumbnail}
                resizeMode="cover"
                accessibilityLabel={`Product image for ${product.name}`}
                accessibilityRole="image"
              />
            ) : (
              <View
                style={styles.thumbnailPlaceholder}
                accessibilityLabel={`No image available for ${product.name}`}
              >
                <Text style={styles.thumbnailPlaceholderText}>
                  {product.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {product.featured && (
              <View style={styles.featuredDot} accessibilityLabel="Featured product indicator" />
            )}
          </View>

          {/* Product Info */}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {product.name}
              </Text>
              {product.on_sale && (
                <View style={styles.saleDot} />
              )}
            </View>

            {product.sku && (
              <Text style={styles.sku} numberOfLines={1}>
                {product.sku}
              </Text>
            )}
          </View>

          {/* Price & Stock */}
          <View style={styles.rightInfo}>
            <Text
              style={[styles.price, product.on_sale && styles.salePrice]}
              accessibilityLabel={`Price: ${displayPrice}${product.on_sale ? ' (on sale)' : ''}`}
              accessibilityRole="text"
            >
              {displayPrice}
            </Text>
            <View
              style={[styles.stockBadge, { backgroundColor: stockBadgeColor }]}
              accessibilityLabel={`Stock quantity: ${product.total_stock ?? 0} ${(product.total_stock ?? 0) === 0 ? 'out of stock' : (product.total_stock ?? 0) < 10 ? 'low stock' : 'in stock'}`}
            >
              <Text style={styles.stockText}>{product.total_stock ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* Location Stock (compact, only if multiple) */}
        {product.inventory && product.inventory.length > 1 && (
          <View style={styles.locationStock}>
            <Text style={styles.locationStockText} numberOfLines={1}>
              {product.inventory.map(inv =>
                `${inv.location_name}: ${inv.quantity}`
              ).join(' • ')}
            </Text>
          </View>
        )}
      </Pressable>
    </LiquidGlassView>
  )
})

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  cardFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pressable: {
    padding: 12,
  },

  // Row Layout
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Thumbnail
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
  },
  featuredDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffd60a',
    borderWidth: 2,
    borderColor: colors.background.primary,
  },

  // Info
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    letterSpacing: -0.2,
    flex: 1,
  },
  saleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff3b30',
  },
  sku: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },

  // Right Info
  rightInfo: {
    alignItems: 'flex-end',
    gap: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  salePrice: {
    color: '#ff3b30',
  },

  // Stock
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderCurve: 'continuous',
    minWidth: 36,
    alignItems: 'center',
  },
  stockText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Location Stock
  locationStock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  locationStockText: {
    fontSize: 10,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: 0.2,
  },
})
