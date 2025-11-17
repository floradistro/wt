/**
 * PricingTemplateModal Component
 * Create/Edit pricing tier templates with dynamic price breaks
 * Apple Engineering: <300 lines, clean grid layout
 */

import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'
import { layout } from '@/theme/layout'
import { DEFAULT_PRICE_BREAKS, type PriceBreak, type PricingTemplate, type QualityTier } from '@/hooks/usePricingTemplates'

const QUALITY_TIERS: { value: QualityTier; label: string }[] = [
  { value: 'exotic', label: 'Exotic' },
  { value: 'top-shelf', label: 'Top Shelf' },
  { value: 'mid-shelf', label: 'Mid Shelf' },
  { value: 'value', label: 'Value' },
]

interface PricingTemplateModalProps {
  visible: boolean
  template?: PricingTemplate | null
  categoryId: string
  onClose: () => void
  onSaved: () => void
}

export function PricingTemplateModal({
  visible,
  template,
  categoryId,
  onClose,
  onSaved,
}: PricingTemplateModalProps) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [qualityTier, setQualityTier] = useState<QualityTier | null>(null)
  const [priceBreaks, setPriceBreaks] = useState<PriceBreak[]>([])
  const [saving, setSaving] = useState(false)

  const isEditMode = !!template

  useEffect(() => {
    if (template) {
      setName(template.name)
      setDescription(template.description || '')
      setQualityTier(template.quality_tier)
      setPriceBreaks(template.default_tiers)
    } else {
      setName('')
      setDescription('')
      setQualityTier(null)
      setPriceBreaks(DEFAULT_PRICE_BREAKS.map(pb => ({ ...pb, price: null })))
    }
  }, [template])

  const handleAddPriceBreak = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newBreak: PriceBreak = {
      id: `custom_${Date.now()}`,
      label: '',
      qty: 1,
      unit: 'g',
      price: null,
      sort_order: priceBreaks.length + 1,
    }
    setPriceBreaks([...priceBreaks, newBreak])
  }

  const handleRemovePriceBreak = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setPriceBreaks(priceBreaks.filter(pb => pb.id !== id))
  }

  const handleUpdatePriceBreak = (id: string, updates: Partial<PriceBreak>) => {
    setPriceBreaks(priceBreaks.map(pb => pb.id === id ? { ...pb, ...updates } : pb))
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user!.email)
        .single()

      if (userError) throw userError

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const templateData = {
        name,
        slug,
        description: description || null,
        quality_tier: qualityTier,
        default_tiers: priceBreaks,
        applicable_to_categories: [categoryId],
        vendor_id: userData.vendor_id,
        is_active: true,
      }

      if (isEditMode) {
        const { error } = await supabase
          .from('pricing_tier_templates')
          .update({
            ...templateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', template.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('pricing_tier_templates')
          .insert(templateData)

        if (error) throw error
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onSaved()
      onClose()
    } catch (error) {
      logger.error('Failed to save pricing template', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.background, !isLiquidGlassSupported && styles.backgroundFallback]}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Edit Template' : 'New Template'}
            </Text>
            <Pressable onPress={handleSave} style={styles.headerButton} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#60A5FA" />
              ) : (
                <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary]}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.label}>Template Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Standard Flower Pricing"
                placeholderTextColor="rgba(235,235,245,0.3)"
                autoFocus
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Quality Tier</Text>
              <View style={styles.tierRow}>
                {QUALITY_TIERS.map(qt => (
                  <Pressable
                    key={qt.value}
                    style={[styles.tierChip, qualityTier === qt.value && styles.tierChipActive]}
                    onPress={() => setQualityTier(qualityTier === qt.value ? null : qt.value)}
                  >
                    <Text style={[styles.tierChipText, qualityTier === qt.value && styles.tierChipTextActive]}>
                      {qt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Price Breaks</Text>
              {priceBreaks.map((pb, index) => (
                <View key={pb.id} style={styles.priceBreakRow}>
                  <View style={styles.priceBreakHeader}>
                    <Text style={styles.priceBreakTitle}>Tier {index + 1}</Text>
                    {priceBreaks.length > 1 && (
                      <Pressable onPress={() => handleRemovePriceBreak(pb.id)}>
                        <Text style={styles.removeButton}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                  <TextInput
                    style={styles.input}
                    value={pb.label}
                    onChangeText={(text) => handleUpdatePriceBreak(pb.id, { label: text })}
                    placeholder="Label (e.g., 1 gram)"
                    placeholderTextColor="rgba(235,235,255,0.3)"
                  />
                  <View style={styles.priceBreakInputs}>
                    <TextInput
                      style={[styles.input, styles.smallInput]}
                      value={pb.qty.toString()}
                      onChangeText={(text) => handleUpdatePriceBreak(pb.id, { qty: parseFloat(text) || 0 })}
                      placeholder="Qty"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[styles.input, styles.smallInput]}
                      value={pb.unit}
                      onChangeText={(text) => handleUpdatePriceBreak(pb.id, { unit: text })}
                      placeholder="Unit"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                    />
                    <View style={[styles.input, styles.priceInputWrapper]}>
                      <Text style={styles.dollarSign}>$</Text>
                      <TextInput
                        style={styles.priceInput}
                        value={pb.price?.toString() || ''}
                        onChangeText={(text) => handleUpdatePriceBreak(pb.id, { price: parseFloat(text) || null })}
                        placeholder="0.00"
                        placeholderTextColor="rgba(235,235,245,0.3)"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>
              ))}
              <Pressable style={styles.addButton} onPress={handleAddPriceBreak}>
                <Text style={styles.addButtonText}>+ Add Price Break</Text>
              </Pressable>
            </View>
          </ScrollView>
        </LiquidGlassView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  background: { flex: 1 },
  backgroundFallback: { backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.contentHorizontal,
    paddingVertical: layout.cardPadding,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: { minWidth: 60 },
  headerButtonText: { fontSize: 17, color: 'rgba(235,235,245,0.6)' },
  headerButtonTextPrimary: { color: '#60A5FA', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
  content: { flex: 1, paddingHorizontal: layout.contentHorizontal },
  section: { marginTop: 24 },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(235,235,245,0.7)', marginBottom: 8 },
  input: {
    fontSize: 17,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tierRow: { flexDirection: 'row', gap: 8 },
  tierChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  tierChipActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tierChipText: { fontSize: 13, color: 'rgba(235,235,245,0.6)' },
  tierChipTextActive: { color: '#fff', fontWeight: '600' },
  priceBreakRow: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  priceBreakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceBreakTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(235,235,245,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  removeButton: { fontSize: 18, color: '#ff453a', fontWeight: '600' },
  priceBreakInputs: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallInput: { flex: 1, textAlign: 'center' },
  priceInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dollarSign: { fontSize: 17, color: 'rgba(235,235,245,0.6)', marginRight: 4 },
  priceInput: { flex: 1, fontSize: 17, color: '#fff', textAlign: 'right' },
  addButton: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    marginTop: 8,
  },
  addButtonText: { fontSize: 15, color: 'rgba(235,235,245,0.6)', fontWeight: '500' },
})
