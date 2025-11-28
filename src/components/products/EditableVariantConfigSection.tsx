/**
 * Editable Variant Config Section
 * Product-level opt-in/out for category variant templates
 * Shows available variants from category and lets users enable/disable per product
 */

import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Switch, Image } from 'react-native'
import * as Haptics from 'expo-haptics'
import { spacing, radius, colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { useAuth } from '@/stores/auth.store'
import type { Product } from '@/types/products'
import { getIconImage } from '@/utils/image-transforms'

interface EditableVariantConfigSectionProps {
  product: Product
}

interface CategoryVariantTemplate {
  id: string
  variant_name: string
  variant_slug: string
  icon: string
  description: string | null
  conversion_ratio: number
  conversion_unit: string
}

interface ProductVariantConfig {
  id: string
  variant_template_id: string
  is_enabled: boolean
}

export function EditableVariantConfigSection({ product }: EditableVariantConfigSectionProps) {
  const { user } = useAuth()

  const [availableVariants, setAvailableVariants] = useState<CategoryVariantTemplate[]>([])
  const [variantConfigs, setVariantConfigs] = useState<Record<string, ProductVariantConfig>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Load available variants from category
  const loadVariants = useCallback(async () => {
    if (!product.primary_category_id) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // Get category variant templates
      const { data: templates, error: templatesError } = await supabase
        .from('category_variant_templates')
        .select('*')
        .eq('category_id', product.primary_category_id)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (templatesError) throw templatesError

      // Get existing product variant configs
      const { data: configs, error: configsError } = await supabase
        .from('product_variant_configs')
        .select('*')
        .eq('product_id', product.id)

      if (configsError) throw configsError

      // Map configs by template_id
      const configsMap: Record<string, ProductVariantConfig> = {}
      configs?.forEach(config => {
        configsMap[config.variant_template_id] = config
      })

      setAvailableVariants(templates || [])
      setVariantConfigs(configsMap)
      logger.info('Loaded variant configs', {
        productId: product.id,
        templatesCount: templates?.length,
        configsCount: configs?.length,
      })
    } catch (error) {
      logger.error('Failed to load variant configs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [product.id, product.primary_category_id])

  useEffect(() => {
    loadVariants()
  }, [loadVariants])

  const handleToggleVariant = async (templateId: string, currentlyEnabled: boolean) => {
    try {
      setIsSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      const existingConfig = variantConfigs[templateId]

      if (existingConfig) {
        // Update existing config
        const { error } = await supabase
          .from('product_variant_configs')
          .update({ is_enabled: !currentlyEnabled })
          .eq('id', existingConfig.id)

        if (error) throw error

        setVariantConfigs({
          ...variantConfigs,
          [templateId]: { ...existingConfig, is_enabled: !currentlyEnabled },
        })
      } else {
        // Create new config
        const { data, error } = await supabase
          .from('product_variant_configs')
          .insert({
            product_id: product.id,
            variant_template_id: templateId,
            is_enabled: true,
          })
          .select()
          .single()

        if (error) throw error

        setVariantConfigs({
          ...variantConfigs,
          [templateId]: data,
        })
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      logger.error('Failed to toggle variant:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AVAILABLE VARIANTS</Text>
        <View style={styles.cardGlass}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.text.secondary} />
          </View>
        </View>
      </View>
    )
  }

  if (availableVariants.length === 0) {
    return null // Don't show section if category has no variant templates
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>AVAILABLE VARIANTS</Text>
      <View style={styles.cardGlass}>
        {availableVariants.map((variant, index) => {
          const config = variantConfigs[variant.id]
          const isEnabled = config?.is_enabled ?? true // Default enabled if no config

          return (
            <View key={variant.id}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.variantRow}>
                <View style={styles.variantLeft}>
                  <View style={styles.variantIcon}>
                    {variant.icon?.startsWith('http') ? (
                      <Image source={{ uri: getIconImage(variant.icon) || variant.icon }} style={styles.variantIconImage} />
                    ) : (
                      <View style={styles.iconPlaceholder}>
                        <Text style={styles.iconPlaceholderText}>?</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.variantInfo}>
                    <Text style={styles.variantName}>{variant.variant_name}</Text>
                    <Text style={styles.variantMeta}>
                      {variant.conversion_ratio}
                      {variant.conversion_unit} conversion
                    </Text>
                    {variant.description && (
                      <Text style={styles.variantDescription}>{variant.description}</Text>
                    )}
                  </View>
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={() => handleToggleVariant(variant.id, isEnabled)}
                  disabled={isSaving}
                  trackColor={{ false: 'rgba(120,120,128,0.16)', true: '#34C759' }}
                  thumbColor="#fff"
                  ios_backgroundColor="rgba(120,120,128,0.16)"
                />
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  loadingContainer: {
    paddingVertical: layout.containerMargin * 2,
    alignItems: 'center',
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.containerMargin,
    minHeight: layout.minTouchTarget,
  },
  variantLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginRight: spacing.md,
  },
  variantIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantIconText: {
    fontSize: 24,
  },
  variantIconImage: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  iconPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  iconPlaceholderText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '600',
  },
  variantInfo: {
    flex: 1,
  },
  variantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  variantMeta: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  variantDescription: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.5)',
    marginTop: 2,
    lineHeight: 18,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: layout.containerMargin,
  },
})
