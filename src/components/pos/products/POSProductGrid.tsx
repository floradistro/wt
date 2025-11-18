import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { memo } from 'react'
import type { Product, PricingTier } from '@/types/pos'
import { POSProductCard } from '../POSProductCard'
import { layout } from '@/theme/layout'

interface POSProductGridProps {
  products: Product[]
  loading: boolean
  onAddToCart: (product: Product, tier?: PricingTier) => void
  activeFilters?: {
    category?: string
    strainTypes?: string[]
    consistencies?: string[]
    flavors?: string[]
  }
  matchingFiltersMap?: Map<string, string[]>
}

function POSProductGrid({
  products,
  loading,
  onAddToCart,
  activeFilters,
  matchingFiltersMap,
}: POSProductGridProps) {
  if (loading) {
    return (
      <View
        style={styles.loadingContainer}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading products"
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    )
  }

  if (products.length === 0) {
    return (
      <View
        style={styles.emptyProductsContainer}
        accessible={true}
        accessibilityRole="alert"
        accessibilityLabel={
          activeFilters?.category && activeFilters.category !== 'All'
            ? 'No products found. Try a different category'
            : 'No products available'
        }
      >
        <Text style={styles.emptyProductsText}>No products found</Text>
        <Text style={styles.emptyProductsSubtext}>
          {activeFilters?.category && activeFilters.category !== 'All'
            ? 'Try a different category'
            : 'No products available'}
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.productsScrollBehind}
      contentContainerStyle={styles.productsGridWithHeader}
      showsVerticalScrollIndicator={false}
      accessible={false}
      accessibilityLabel={`Product grid with ${products.length} products`}
    >
      {products.map((product) => {
        // Get matching filters for this product (if any)
        const matchingFilters = matchingFiltersMap?.get(product.id)

        // Transform product for POSProductCard
        const transformedProduct = {
          ...product,
          image_url: product.image_url,
          vendor_logo_url: (product as any).vendor?.logo_url || null,
          primary_category: product.category ? { name: product.category, slug: product.category.toLowerCase() } : undefined,
          meta_data: {
            pricing_mode: (product as any).pricing_tiers && (product as any).pricing_tiers.length > 0 ? 'tiered' as const : 'single' as const,
            pricing_tiers: (product as any).pricing_tiers?.map((tier: any) => ({
              qty: tier.qty,
              price: String(tier.price),
              weight: tier.label
            }))
          }
        }

        return (
          <POSProductCard
            key={product.id}
            product={transformedProduct as any}
            onAddToCart={onAddToCart}
            matchingFilters={matchingFilters}
          />
        )
      })}
    </ScrollView>
  )
}

const POSProductGridMemo = memo(POSProductGrid)
export { POSProductGridMemo as POSProductGrid }

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0,
  },
  emptyProductsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyProductsText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },
  emptyProductsSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.3)',
  },
  productsScrollBehind: {
    flex: 1,
  },
  productsGridWithHeader: {
    paddingTop: 80, // Space for floating search bar
    paddingBottom: layout.dockHeight,
    paddingLeft: 0, // No left padding - spacing comes from cart's marginRight
    paddingRight: layout.containerMargin,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.cardPadding,
  },
})
