/**
 * CampaignsDetail
 * Discount campaigns management - Jobs Principle: Simple discount creation
 */

import { View, Text, Pressable, ActivityIndicator, Alert, TextInput } from "react-native"
import { useState } from "react"
// Removed LiquidGlassView - using plain View with borderless style
import Slider from "@react-native-community/slider"
import * as Haptics from "expo-haptics"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import type { Campaign } from "@/types/campaigns"
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
      badge_color: 'rgba(255,255,255,0.15)', // Match product list - borderless
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

  const onEditCampaign = (campaign: Campaign) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // TODO: Implement edit modal/flow
    Alert.alert('Edit Campaign', `Edit "${campaign.name}"`)
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
        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
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
                  maximumTrackTintColor="rgba(255,255,255,0.15)" // Match product list - borderless
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
          </View>
        </View>
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

      {/* Campaigns List - MATCHES ProductsListView Structure */}
      <View style={styles.cardWrapper}>
        <View style={styles.listCardGlass}>
          {campaigns.map((campaign, index) => {
            const isLast = index === campaigns.length - 1
            return (
              <Pressable
                key={campaign.id}
                style={[styles.listItem, isLast && styles.listItemLast]}
                onPress={() => onEditCampaign(campaign)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={campaign.name}
              >
                {/* Campaign Icon */}
                <View style={styles.campaignIcon}>
                  <Text style={styles.campaignIconText}>
                    {campaign.name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Campaign Info */}
                <View style={styles.campaignInfo}>
                  <Text style={styles.campaignName} numberOfLines={1}>{campaign.name}</Text>
                  <Text style={styles.campaignType} numberOfLines={1}>
                    {campaign.campaign_type || 'Campaign'}
                  </Text>
                </View>

                {/* Status */}
                <View style={styles.campaignMeta}>
                  {!campaign.is_active && (
                    <Text style={styles.inactiveLabel}>INACTIVE</Text>
                  )}
                  {campaign.is_active && (
                    <Text style={styles.activeLabel}>ACTIVE</Text>
                  )}
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>
    </>
  )
}

export { CampaignsDetail }
