/**
 * ShippingSettingsDetail - Company-wide shipping configuration
 * Jobs Principle: Simple, focused shipping settings
 */

import { View, Text, StyleSheet, ScrollView, Animated, Pressable, TextInput, Switch, Alert } from 'react-native'
import { useState, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { TitleSection } from '@/components/shared'
import { DetailRow } from './DetailRow'
import { detailCommonStyles } from './detailCommon.styles'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { updateVendor } from '@/services/vendors.service'

interface ShippingSettingsDetailProps {
  headerOpacity: Animated.Value
  vendorLogo?: string | null
}

export function ShippingSettingsDetail({ headerOpacity, vendorLogo }: ShippingSettingsDetailProps) {
  const { vendor, refreshVendorData } = useAppAuth()

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedSettings, setEditedSettings] = useState({
    free_shipping_enabled: vendor?.free_shipping_enabled ?? true,
    free_shipping_threshold: vendor?.free_shipping_threshold?.toString() ?? '35',
    default_shipping_cost: vendor?.default_shipping_cost?.toString() ?? '5.99',
  })

  // Update state when vendor changes, but only if not in edit mode
  // This prevents the form from resetting while the user is editing
  useEffect(() => {
    if (vendor && !isEditMode) {
      setEditedSettings({
        free_shipping_enabled: vendor.free_shipping_enabled ?? true,
        free_shipping_threshold: vendor.free_shipping_threshold?.toString() ?? '35',
        default_shipping_cost: vendor.default_shipping_cost?.toString() ?? '5.99',
      })
    }
  }, [vendor, isEditMode])

  const handleEditSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsEditMode(true)
  }

  const handleCancelEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsEditMode(false)
    // Reset to original values
    setEditedSettings({
      free_shipping_enabled: vendor?.free_shipping_enabled ?? true,
      free_shipping_threshold: vendor?.free_shipping_threshold?.toString() ?? '35',
      default_shipping_cost: vendor?.default_shipping_cost?.toString() ?? '5.99',
    })
  }

  const handleSaveSettings = async () => {
    if (!vendor?.id) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsSaving(true)

    try {
      // Validate shipping threshold
      let freeShippingThreshold: number | null = null
      if (editedSettings.free_shipping_threshold.trim() !== '') {
        const parsedThreshold = parseFloat(editedSettings.free_shipping_threshold)
        if (isNaN(parsedThreshold) || parsedThreshold < 0) {
          Alert.alert('Invalid Threshold', 'Please enter a valid free shipping threshold (0 or greater).')
          setIsSaving(false)
          return
        }
        freeShippingThreshold = parsedThreshold
      }

      // Validate default shipping cost
      let defaultShippingCost: number | null = null
      if (editedSettings.default_shipping_cost.trim() !== '') {
        const parsedCost = parseFloat(editedSettings.default_shipping_cost)
        if (isNaN(parsedCost) || parsedCost < 0) {
          Alert.alert('Invalid Shipping Cost', 'Please enter a valid shipping cost (0 or greater).')
          setIsSaving(false)
          return
        }
        defaultShippingCost = parsedCost
      }

      const { error } = await updateVendor(vendor.id, {
        free_shipping_enabled: editedSettings.free_shipping_enabled,
        free_shipping_threshold: freeShippingThreshold,
        default_shipping_cost: defaultShippingCost,
      })

      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', error)
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setIsEditMode(false)

        // Refresh vendor data to sync with context
        refreshVendorData().catch(err => {
          console.error('Failed to refresh vendor data:', err)
        })
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update shipping settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <View style={styles.detailContainer}>
      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: layout.dockHeight, paddingRight: 0 }}
      >
        {/* Title Section */}
        <TitleSection
          title="Shipping"
          logo={vendorLogo}
          subtitle="Configure free shipping threshold and default rates"
        />

        {/* Edit Button Row */}
        <View style={[styles.cardWrapper, styles.titleRow]}>
          <Text style={styles.cardSectionTitle}>SHIPPING SETTINGS</Text>
          {!isEditMode ? (
            <Pressable onPress={handleEditSettings} style={styles.addButton}>
              <Text style={styles.addButtonText}>Edit</Text>
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <Pressable
                onPress={handleCancelEdit}
                disabled={isSaving}
                style={[styles.addButton, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
              >
                <Text style={[styles.addButtonText, { color: colors.text.tertiary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveSettings}
                disabled={isSaving}
                style={[styles.addButton, { backgroundColor: '#10b98120' }]}
              >
                <Text style={[styles.addButtonText, { color: '#10b981', fontWeight: '600' }]}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Settings Card */}
        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
            <View style={{ padding: spacing.md, gap: spacing.sm }}>
              {/* Free Shipping Toggle */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { marginBottom: spacing.xs }]}>FREE SHIPPING</Text>
                  <Text style={{ ...typography.footnote, color: colors.text.tertiary }}>
                    {editedSettings.free_shipping_enabled
                      ? 'Free shipping is enabled for qualifying orders'
                      : 'All orders will be charged shipping'}
                  </Text>
                </View>
                <Switch
                  value={editedSettings.free_shipping_enabled}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setEditedSettings({ ...editedSettings, free_shipping_enabled: value })
                  }}
                  disabled={!isEditMode || isSaving}
                  trackColor={{ false: 'rgba(120,120,128,0.32)', true: '#10b981' }}
                  thumbColor="#fff"
                  ios_backgroundColor="rgba(120,120,128,0.32)"
                />
              </View>

              {/* Divider */}
              <View style={{ height: 0.5, backgroundColor: 'rgba(235,235,245,0.1)', marginVertical: spacing.md }} />

              {/* Free Shipping Threshold */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>FREE SHIPPING THRESHOLD</Text>
                  {isEditMode ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ ...typography.body, color: colors.text.tertiary, marginRight: spacing.xs }}>$</Text>
                      <TextInput
                        value={editedSettings.free_shipping_threshold}
                        onChangeText={(text) => setEditedSettings({ ...editedSettings, free_shipping_threshold: text })}
                        style={[styles.formInput, { flex: 1 }]}
                        placeholder="35"
                        placeholderTextColor={colors.text.quaternary}
                        keyboardType="decimal-pad"
                        editable={!isSaving && editedSettings.free_shipping_enabled}
                      />
                    </View>
                  ) : (
                    <Text style={styles.valueText}>
                      {vendor?.free_shipping_threshold !== undefined && vendor?.free_shipping_threshold !== null
                        ? `$${vendor.free_shipping_threshold.toFixed(2)}`
                        : '$35.00'}
                    </Text>
                  )}
                  <Text style={{ ...typography.caption2, color: colors.text.quaternary, marginTop: spacing.xs }}>
                    Orders above this amount get free shipping
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>DEFAULT SHIPPING COST</Text>
                  {isEditMode ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ ...typography.body, color: colors.text.tertiary, marginRight: spacing.xs }}>$</Text>
                      <TextInput
                        value={editedSettings.default_shipping_cost}
                        onChangeText={(text) => setEditedSettings({ ...editedSettings, default_shipping_cost: text })}
                        style={[styles.formInput, { flex: 1 }]}
                        placeholder="5.99"
                        placeholderTextColor={colors.text.quaternary}
                        keyboardType="decimal-pad"
                        editable={!isSaving}
                      />
                    </View>
                  ) : (
                    <Text style={styles.valueText}>
                      {vendor?.default_shipping_cost !== undefined && vendor?.default_shipping_cost !== null
                        ? `$${vendor.default_shipping_cost.toFixed(2)}`
                        : '$5.99'}
                    </Text>
                  )}
                  <Text style={{ ...typography.caption2, color: colors.text.quaternary, marginTop: spacing.xs }}>
                    Charged when order is below threshold
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.cardWrapper}>
          <View style={[styles.detailCard, { backgroundColor: 'rgba(96,165,250,0.1)' }]}>
            <View style={{ padding: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                <Text style={{ fontSize: 20 }}>💡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.text.primary, fontWeight: '600', marginBottom: spacing.xs }}>
                    How it works
                  </Text>
                  <Text style={{ ...typography.footnote, color: colors.text.secondary, lineHeight: 20 }}>
                    When a customer's order subtotal meets or exceeds the free shipping threshold, shipping will be free. Orders below the threshold will be charged the default shipping cost.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  ...detailCommonStyles,
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardSectionTitle: {
    ...typography.caption1,
    color: colors.text.tertiary,
    fontWeight: '600',
    margin: 0,
  },
  valueText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  formInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
})
