/**
 * CampaignDetail
 * Full-screen detail view for editing a discount/campaign
 * Pattern: Matches ProductDetail structure
 */

import { View, Text, Pressable, ScrollView, TextInput, Alert, Switch } from "react-native"
import { useState, useEffect } from "react"
import Slider from "@react-native-community/slider"
import * as Haptics from "expo-haptics"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import type { Campaign } from "@/services/campaigns.service"
import { Breadcrumb } from "@/components/shared"

interface CampaignDetailProps {
  campaign: Campaign
  onBack: () => void
  onUpdate: (id: string, data: Partial<Campaign>) => Promise<{ success: boolean; error?: string }>
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>
  onToggleStatus: (id: string, active: boolean) => Promise<{ success: boolean; error?: string }>
}

export function CampaignDetail({ campaign, onBack, onUpdate, onDelete, onToggleStatus }: CampaignDetailProps) {
  // Editable state
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [name, setName] = useState(campaign.name)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
    campaign.discount_type === 'bogo' ? 'percentage' : campaign.discount_type
  )
  const [discountValue, setDiscountValue] = useState(campaign.discount_value)
  const [applicationMethod, setApplicationMethod] = useState<'auto' | 'code'>(
    campaign.application_method === 'manual' ? 'auto' : campaign.application_method
  )
  const [couponCode, setCouponCode] = useState(campaign.coupon_code || '')
  const [salesChannel, setSalesChannel] = useState<'both' | 'in_store' | 'online'>(
    (campaign as any).sales_channel || 'both'
  )
  const [isActive, setIsActive] = useState(campaign.is_active)

  // Reset form when campaign changes
  useEffect(() => {
    setName(campaign.name)
    setDiscountType(campaign.discount_type === 'bogo' ? 'percentage' : campaign.discount_type)
    setDiscountValue(campaign.discount_value)
    setApplicationMethod(campaign.application_method === 'manual' ? 'auto' : campaign.application_method)
    setCouponCode(campaign.coupon_code || '')
    setSalesChannel((campaign as any).sales_channel || 'both')
    setIsActive(campaign.is_active)
  }, [campaign])

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a discount name')
      return
    }

    if (applicationMethod === 'code' && !couponCode.trim()) {
      Alert.alert('Error', 'Please enter a coupon code')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsSaving(true)

    const badgeText = discountType === 'percentage' ? `${discountValue}% OFF` : `$${discountValue} OFF`

    const result = await onUpdate(campaign.id, {
      name,
      discount_type: discountType,
      discount_value: discountValue,
      application_method: applicationMethod,
      coupon_code: applicationMethod === 'code' ? couponCode.trim().toUpperCase() : null,
      sales_channel: salesChannel,
      badge_text: badgeText,
    } as any)

    setIsSaving(false)

    if (result.success) {
      setIsEditing(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      Alert.alert('Error', result.error || 'Failed to update discount')
    }
  }

  const handleCancel = () => {
    // Reset to original values
    setName(campaign.name)
    setDiscountType(campaign.discount_type === 'bogo' ? 'percentage' : campaign.discount_type)
    setDiscountValue(campaign.discount_value)
    setApplicationMethod(campaign.application_method === 'manual' ? 'auto' : campaign.application_method)
    setCouponCode(campaign.coupon_code || '')
    setSalesChannel((campaign as any).sales_channel || 'both')
    setIsEditing(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleToggleActive = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newActive = !isActive
    setIsActive(newActive)

    const result = await onToggleStatus(campaign.id, newActive)
    if (!result.success) {
      setIsActive(!newActive) // Revert on failure
      Alert.alert('Error', result.error || 'Failed to update status')
    }
  }

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    Alert.alert(
      'Delete Discount',
      `Are you sure you want to delete "${campaign.name}"?\n\nThis will permanently remove this discount. This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            const result = await onDelete(campaign.id)
            if (result.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              onBack()
            } else {
              Alert.alert('Error', result.error || 'Failed to delete discount')
            }
          },
        },
      ]
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: layout.dockHeight + 40 }}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
    >
      {/* Header with breadcrumb and edit toggle */}
      <View style={styles.header}>
        <Breadcrumb
          items={[
            { label: 'Discounts', onPress: onBack },
            { label: name || 'Discount' },
          ]}
        />

        {isEditing ? (
          <View style={styles.editActions}>
            <Pressable onPress={handleCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={styles.saveButton} disabled={isSaving}>
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setIsEditing(true)
            }}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        )}
      </View>

      {/* Header Card */}
      <View style={styles.section}>
        <View style={styles.headerCard}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerInfo}>
            {isEditing ? (
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Discount name"
                placeholderTextColor={colors.text.quaternary}
              />
            ) : (
              <>
                <Text style={styles.nameText}>{name}</Text>
                <Text style={styles.valueText}>
                  {discountType === 'percentage' ? `${discountValue}% off` : `$${discountValue} off`}
                </Text>
              </>
            )}
          </View>
          <View style={styles.statusContainer}>
            <Text style={isActive ? styles.activeLabel : styles.inactiveLabel}>
              {isActive ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>STATUS</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <Text style={styles.rowLabel}>Active</Text>
            <Switch
              value={isActive}
              onValueChange={handleToggleActive}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(52, 199, 89, 0.5)' }}
              thumbColor={isActive ? '#34c759' : '#fff'}
            />
          </View>
        </View>
      </View>

      {/* Discount Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DISCOUNT</Text>
        <View style={styles.card}>
          {isEditing ? (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.formLabel}>Discount Type</Text>
                <View style={styles.tabSwitcher}>
                  <Pressable
                    onPress={() => setDiscountType('percentage')}
                    style={[styles.tab, discountType === 'percentage' && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, discountType === 'percentage' && styles.tabTextActive]}>
                      Percentage
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDiscountType('fixed')}
                    style={[styles.tab, discountType === 'fixed' && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, discountType === 'fixed' && styles.tabTextActive]}>
                      Fixed Amount
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.formLabel}>Discount Value</Text>
                <Text style={styles.configValue}>
                  {discountType === 'percentage' ? `${discountValue}%` : `$${discountValue}`}
                </Text>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={1}
                  maximumValue={discountType === 'percentage' ? 100 : 500}
                  step={1}
                  value={discountValue}
                  onValueChange={setDiscountValue}
                  minimumTrackTintColor={colors.text.primary}
                  maximumTrackTintColor="rgba(255,255,255,0.15)"
                  thumbTintColor={colors.text.primary}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Type</Text>
                <Text style={styles.rowValue}>
                  {discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                </Text>
              </View>
              <View style={[styles.row, styles.rowLast]}>
                <Text style={styles.rowLabel}>Value</Text>
                <Text style={styles.rowValue}>
                  {discountType === 'percentage' ? `${discountValue}%` : `$${discountValue.toFixed(2)}`}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Application Method */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>HOW TO APPLY</Text>
        <View style={styles.card}>
          {isEditing ? (
            <>
              <View style={styles.fieldGroup}>
                <View style={styles.tabSwitcher}>
                  <Pressable
                    onPress={() => setApplicationMethod('auto')}
                    style={[styles.tab, applicationMethod === 'auto' && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, applicationMethod === 'auto' && styles.tabTextActive]}>
                      Automatic
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setApplicationMethod('code')}
                    style={[styles.tab, applicationMethod === 'code' && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, applicationMethod === 'code' && styles.tabTextActive]}>
                      Coupon Code
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.hint}>
                  {applicationMethod === 'auto'
                    ? 'Applies automatically to applicable orders'
                    : 'Customer enters code at checkout'}
                </Text>
              </View>

              {applicationMethod === 'code' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.formLabel}>Coupon Code</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={couponCode}
                      onChangeText={(text) => setCouponCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="e.g., SAVE20"
                      placeholderTextColor={colors.text.quaternary}
                      style={styles.input}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={20}
                    />
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Method</Text>
                <Text style={styles.rowValue}>
                  {applicationMethod === 'auto' ? 'Automatic' : 'Coupon Code'}
                </Text>
              </View>
              {applicationMethod === 'code' && couponCode && (
                <View style={[styles.row, styles.rowLast]}>
                  <Text style={styles.rowLabel}>Code</Text>
                  <Text style={[styles.rowValue, styles.codeValue]}>{couponCode}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* Sales Channel */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WHERE TO APPLY</Text>
        <View style={styles.card}>
          {isEditing ? (
            <View style={styles.fieldGroup}>
              <View style={styles.tabSwitcher}>
                <Pressable
                  onPress={() => setSalesChannel('both')}
                  style={[styles.tab, salesChannel === 'both' && styles.tabActive]}
                >
                  <Text style={[styles.tabText, salesChannel === 'both' && styles.tabTextActive]}>Both</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSalesChannel('in_store')}
                  style={[styles.tab, salesChannel === 'in_store' && styles.tabActive]}
                >
                  <Text style={[styles.tabText, salesChannel === 'in_store' && styles.tabTextActive]}>In-Store</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSalesChannel('online')}
                  style={[styles.tab, salesChannel === 'online' && styles.tabActive]}
                >
                  <Text style={[styles.tabText, salesChannel === 'online' && styles.tabTextActive]}>Online</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>
                {salesChannel === 'both'
                  ? 'Applies to POS and online orders'
                  : salesChannel === 'in_store'
                  ? 'Only applies to POS sales'
                  : 'Only applies to online orders'}
              </Text>
            </View>
          ) : (
            <View style={[styles.row, styles.rowLast]}>
              <Text style={styles.rowLabel}>Channel</Text>
              <Text style={styles.rowValue}>
                {salesChannel === 'both' ? 'Both (POS & Online)' : salesChannel === 'in_store' ? 'In-Store Only' : 'Online Only'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>USAGE</Text>
        <View style={styles.card}>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>Times Used</Text>
            <Text style={styles.rowValue}>{campaign.current_uses || 0}</Text>
          </View>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DANGER ZONE</Text>
        <View style={styles.card}>
          <Pressable style={[styles.row, styles.rowLast]} onPress={handleDelete}>
            <Text style={styles.destructiveText}>Delete Discount</Text>
            <Text style={styles.chevron}>􀆊</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = {
  container: {
    flex: 1,
  } as const,
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: layout.containerMargin,
    paddingVertical: spacing.md,
  },
  editActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: colors.text.secondary,
  },
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(10, 132, 255, 0.3)',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#0A84FF',
  },
  editButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#0A84FF',
  },
  section: {
    paddingHorizontal: layout.containerMargin,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    overflow: 'hidden' as const,
  },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    padding: spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  iconText: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: 'rgba(235,235,245,0.6)',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  valueText: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.text.secondary,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.text.primary,
    letterSpacing: -0.4,
    padding: 0,
  },
  statusContainer: {
    alignItems: 'flex-end' as const,
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#34c759',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  inactiveLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#ff3b30',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.text.primary,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.text.secondary,
  },
  codeValue: {
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  fieldGroup: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.text.tertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  configValue: {
    fontSize: 28,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  tabSwitcher: {
    flexDirection: 'row' as const,
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 9999,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 9999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: colors.text.tertiary,
    letterSpacing: -0.2,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '600' as const,
  },
  hint: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  inputWrapper: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  input: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.text.primary,
  },
  destructiveText: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: '#ff3b30',
  },
  chevron: {
    fontSize: 17,
    fontWeight: '300' as const,
    color: colors.text.quaternary,
  },
}
