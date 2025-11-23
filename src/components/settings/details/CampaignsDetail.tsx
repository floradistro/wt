/**
 * CampaignsDetail
 * Discount campaigns management - Jobs Principle: Simple discount creation
 */

import { View, Text, Pressable, ActivityIndicator, Alert, TextInput, Switch } from "react-native"
import { useState } from "react"
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from "@callstack/liquid-glass"
import Slider from "@react-native-community/slider"
import * as Haptics from "expo-haptics"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import type { Campaign } from "@/hooks/useCampaigns"
import { campaignsStyles as styles } from "./campaigns.styles"

function CampaignsDetail({
  campaigns,
  stats,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  onToggleStatus,
}: {
  campaigns: Campaign[]
  stats: any
  isLoading: boolean
  onCreate: any
  onUpdate: any
  onDelete: any
  onToggleStatus: any
}) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [discountName, setDiscountName] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState(20)
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveDiscount = async () => {
    if (!discountName.trim()) {
      Alert.alert('Error', 'Please enter a discount name')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsSaving(true)

    const badgeText = discountType === 'percentage' ? `${discountValue}% OFF` : `$${discountValue} OFF`

    const result = await onCreate({
      name: discountName,
      discount_type: discountType,
      discount_value: discountValue,
      apply_to: 'all',
      apply_to_ids: [],
      location_scope: 'all',
      location_ids: [],
      schedule_type: 'always',
      application_method: 'auto',
      badge_text: badgeText,
      badge_color: colors.glass.thick,
    })

    setIsSaving(false)

    if (result.success) {
      setEditingId(null)
      setDiscountName('')
      setDiscountValue(20)
      setDiscountType('percentage')
    } else {
      Alert.alert('Error', result.error || 'Failed to create discount')
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setDiscountName('')
    setDiscountValue(20)
    setDiscountType('percentage')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleToggleDiscount = (discountId: string, currentStatus: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onToggleStatus(discountId, !currentStatus).catch((error: any) => {
      Alert.alert('Error', error?.message || 'Failed to toggle discount')
    })
  }

  const handleDeleteDiscount = (discountId: string, discountName: string) => {
    Alert.alert(
      'Delete Discount',
      `Are you sure you want to delete "${discountName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            const result = await onDelete(discountId)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete discount')
            }
          },
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
        <ActivityIndicator color={colors.text.tertiary} />
        <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading campaigns...</Text>
      </View>
    )
  }

  if (campaigns.length === 0 && editingId !== 'new') {
    return (
      <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
        <Text style={styles.emptyStateText}>No discounts yet</Text>
        <Text style={styles.emptyStateSubtext}>Create automatic discounts for your customers</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setEditingId('new')
          }}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>Create Discount</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <>
      {editingId === 'new' && (
        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}>
            <View style={{ padding: spacing.md }}>
              <Text style={{ ...typography.headline, color: colors.text.primary, marginBottom: spacing.md }}>Create Discount</Text>

              <Text style={styles.formLabel}>Discount Name</Text>
              <View style={styles.formInputWrapper}>
                <TextInput
                  value={discountName}
                  onChangeText={setDiscountName}
                  placeholder="e.g., Summer Sale"
                  placeholderTextColor={colors.text.quaternary}
                  style={styles.formInput}
                />
              </View>

              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.formLabel}>Discount Type</Text>
                <View style={styles.tabSwitcher}>
                  <Pressable
                    onPress={() => setDiscountType('percentage')}
                    style={[styles.tab, discountType === 'percentage' && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, discountType === 'percentage' && styles.tabTextActive]}>Percentage</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDiscountType('fixed')}
                    style={[styles.tab, discountType === 'fixed' && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, discountType === 'fixed' && styles.tabTextActive]}>Fixed Amount</Text>
                  </Pressable>
                </View>
              </View>

              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.formLabel}>Discount Value</Text>
                <Text style={styles.configValue}>{discountType === 'percentage' ? `${discountValue}%` : `$${discountValue}`}</Text>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={discountType === 'percentage' ? 1 : 1}
                  maximumValue={discountType === 'percentage' ? 100 : 500}
                  step={1}
                  value={discountValue}
                  onValueChange={setDiscountValue}
                  minimumTrackTintColor={colors.text.primary}
                  maximumTrackTintColor={colors.glass.thick}
                  thumbTintColor={colors.text.primary}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
                <Pressable
                  onPress={handleCancelEdit}
                  style={[styles.userActionButton, { flex: 1 }]}
                >
                  <Text style={styles.userActionButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveDiscount}
                  disabled={isSaving}
                  style={[styles.addButton, { flex: 1 }]}
                >
                  <Text style={styles.addButtonText}>{isSaving ? 'Saving...' : 'Save Discount'}</Text>
                </Pressable>
              </View>
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>
      )}

      {campaigns.length > 0 && editingId !== 'new' && (
        <View style={[styles.cardWrapper, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={{ ...typography.body, color: colors.text.secondary }}>
            {campaigns.length} {campaigns.length === 1 ? 'discount' : 'discounts'}
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setEditingId('new')
            }}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>Create Discount</Text>
          </Pressable>
        </View>
      )}

      {campaigns.map((discount) => (
        <LiquidGlassContainerView key={discount.id} spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            interactive
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={{ padding: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.headline, color: colors.text.primary }}>{discount.name}</Text>
                  <Text style={{ ...typography.footnote, color: colors.text.tertiary, marginTop: 2 }}>
                    {discount.discount_type === 'percentage'
                      ? `${discount.discount_value}% OFF`
                      : `$${discount.discount_value} OFF`}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  {discount.badge_text && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        backgroundColor: discount.badge_color || colors.glass.thick,
                        borderRadius: radius.xs
                      }}
                    >
                      <Text style={{ ...typography.caption2, color: colors.text.primary, fontWeight: '600' }}>
                        {discount.badge_text}
                      </Text>
                    </View>
                  )}
                  <Switch
                    value={discount.is_active}
                    onValueChange={() => handleToggleDiscount(discount.id, discount.is_active)}
                    trackColor={{ false: colors.glass.thick, true: colors.glass.thick }}
                    thumbColor={colors.text.primary}
                    ios_backgroundColor={colors.glass.thick}
                  />
                  <Pressable
                    onPress={() => handleDeleteDiscount(discount.id, discount.name)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: radius.sm,
                      backgroundColor: colors.glass.regular,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ fontSize: 24, color: colors.text.tertiary, lineHeight: 24 }}>×</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>
      ))}
    </>
  )
}

export { CampaignsDetail }
