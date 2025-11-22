/**
 * LoyaltyManagementDetail
 * Loyalty program and campaigns - Jobs Principle: Reward customer loyalty simply
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Animated, TextInput, Image } from "react-native"
import { useState, useEffect } from "react"
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from "@callstack/liquid-glass"
import { LinearGradient } from "expo-linear-gradient"
import * as Haptics from "expo-haptics"
import { colors, spacing } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import type { LoyaltyProgram } from "@/hooks/useLoyalty"
import type { Campaign } from "@/hooks/useCampaigns"
import { CampaignsDetail } from "./CampaignsDetail"
import { loyaltyManagementStyles as styles } from "./loyaltyManagement.styles"

function LoyaltyIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
        </View>
      </View>
    </View>
  )
}

function LoyaltyManagementDetail({
  program,
  isLoading,
  headerOpacity,
  onCreateProgram,
  onUpdateProgram,
  onToggleStatus,
  vendorLogo,
  campaigns,
  campaignStats,
  campaignsLoading,
  onCreateCampaign,
  onUpdateCampaign,
  onDeleteCampaign,
  onToggleCampaignStatus,
}: {
  program: LoyaltyProgram | null
  isLoading: boolean
  headerOpacity: Animated.Value
  onCreateProgram: any
  onUpdateProgram: any
  onToggleStatus: any
  vendorLogo?: string | null
  campaigns: Campaign[]
  campaignStats: any
  campaignsLoading: boolean
  onCreateCampaign: any
  onUpdateCampaign: any
  onDeleteCampaign: any
  onToggleCampaignStatus: any
}) {
  const [activeTab, setActiveTab] = useState<'program' | 'campaigns'>('program')
  const [isEditing, setIsEditing] = useState(false)
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false)
  const [formData, setFormData] = useState({
    name: 'Loyalty Rewards',
    points_per_dollar: '1.00',
    point_value: '0.01',
    min_redemption_points: '100',
    points_expiry_days: '365',
  })

  // Initialize form when program loads
  useEffect(() => {
    if (program) {
      setFormData({
        name: program.name || 'Loyalty Rewards',
        points_per_dollar: program.points_per_dollar.toString(),
        point_value: program.point_value.toString(),
        min_redemption_points: program.min_redemption_points.toString(),
        points_expiry_days: program.points_expiry_days?.toString() || '',
      })
    }
  }, [program])

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const data = {
      name: formData.name || 'Loyalty Rewards',
      points_per_dollar: parseFloat(formData.points_per_dollar) || 1.0,
      point_value: parseFloat(formData.point_value) || 0.01,
      min_redemption_points: parseInt(formData.min_redemption_points) || 100,
      points_expiry_days: formData.points_expiry_days ? parseInt(formData.points_expiry_days) : null,
    }

    let result
    if (program) {
      result = await onUpdateProgram(data)
    } else {
      result = await onCreateProgram(data)
    }

    if (result.success) {
      setIsEditing(false)
    } else {
      Alert.alert('Error', result.error || 'Failed to save loyalty program')
    }
  }

  const handleToggleStatus = async () => {
    if (!program) return

    const newStatus = !program.is_active
    const statusText = newStatus ? 'activate' : 'deactivate'

    Alert.alert(
      `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} Loyalty Program`,
      `Are you sure you want to ${statusText} the loyalty program?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusText.charAt(0).toUpperCase() + statusText.slice(1),
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            const result = await onToggleStatus(newStatus)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to update loyalty program status')
            }
          },
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <View style={styles.detailContainer}>
        <View style={[styles.emptyState, { paddingTop: layout.contentStartTop }]}>
          <ActivityIndicator color={colors.text.tertiary} />
          <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading loyalty program...</Text>
        </View>
      </View>
    )
  }

  // Empty state - no program configured yet
  if (!program && !isEditing) {
    return (
      <View style={styles.detailContainer}>
        <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
          <Text style={styles.fixedHeaderTitle}>Loyalty & Rewards</Text>
        </Animated.View>

        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
          style={styles.fadeGradient}
          pointerEvents="none"
        />

        <ScrollView
          style={styles.detailScroll}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: layout.contentStartTop, paddingBottom: layout.dockHeight, paddingRight: 0 }}
        >
          {/* Title Section with Vendor Logo */}
          <View style={styles.cardWrapper}>
            <View style={styles.titleSectionContainer}>
              <View style={styles.titleWithLogo}>
                {vendorLogo ? (
                  <Image
                    source={{ uri: vendorLogo }}
                    style={styles.vendorLogoInline}
                    resizeMode="contain"
                        fadeDuration={0}
                  />
                ) : (
                  <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                  </View>
                )}
                <Text style={styles.detailTitleLarge}>Loyalty & Rewards</Text>
              </View>
            </View>
          </View>

          {/* Tab Switcher */}
          <View style={styles.cardWrapper}>
            <View style={styles.tabSwitcher}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setActiveTab('program')
                }}
                style={[styles.tab, activeTab === 'program' && styles.tabActive]}
              >
                <Text style={[styles.tabText, activeTab === 'program' && styles.tabTextActive]}>Program</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setActiveTab('campaigns')
                }}
                style={[styles.tab, activeTab === 'campaigns' && styles.tabActive]}
              >
                <Text style={[styles.tabText, activeTab === 'campaigns' && styles.tabTextActive]}>Discounts</Text>
              </Pressable>
            </View>
          </View>

          {activeTab === 'program' ? (
            <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
              <View style={styles.emptyStateIcon}>
                <LoyaltyIcon color={colors.text.quaternary} />
              </View>
              <Text style={styles.emptyStateText}>No loyalty program configured</Text>
              <Text style={styles.emptyStateSubtext}>Set up a loyalty program to reward your customers</Text>
              <Pressable
                onPress={() => setIsEditing(true)}
                style={styles.addButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Configure loyalty program"
              >
                <Text style={styles.addButtonText}>Configure Program</Text>
              </Pressable>
            </View>
          ) : (
            <CampaignsDetail
              campaigns={campaigns}
              stats={campaignStats}
              isLoading={campaignsLoading}
              onCreate={onCreateCampaign}
              onUpdate={onUpdateCampaign}
              onDelete={onDeleteCampaign}
              onToggleStatus={onToggleCampaignStatus}
            />
          )}
        </ScrollView>
      </View>
    )
  }

  // Show form when editing or creating
  if (isEditing || !program) {
    return (
      <View style={styles.detailContainer}>
        <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
          <Text style={styles.fixedHeaderTitle}>Loyalty & Rewards</Text>
        </Animated.View>

        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
          style={styles.fadeGradient}
          pointerEvents="none"
        />

        <ScrollView
          style={styles.detailScroll}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: layout.contentStartTop, paddingBottom: layout.dockHeight, paddingRight: 0 }}
          onScroll={(e) => {
            const offsetY = e.nativeEvent.contentOffset.y
            const threshold = 40
            headerOpacity.setValue(offsetY > threshold ? 1 : 0)
          }}
          scrollEventThrottle={16}
        >
          {/* Title Section with Vendor Logo */}
          <View style={styles.cardWrapper}>
            <View style={styles.titleSectionContainer}>
              <View style={styles.titleWithLogo}>
                {vendorLogo ? (
                  <Image
                    source={{ uri: vendorLogo }}
                    style={styles.vendorLogoInline}
                    resizeMode="contain"
                        fadeDuration={0}
                  />
                ) : (
                  <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                  </View>
                )}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.detailTitleLarge}>Configure Loyalty Program</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Pressable
                      onPress={() => {
                        // Reset form data to program values when canceling
                        if (program) {
                          setFormData({
                            name: program.name || 'Loyalty Rewards',
                            points_per_dollar: program.points_per_dollar.toString(),
                            point_value: program.point_value.toString(),
                            min_redemption_points: program.min_redemption_points.toString(),
                            points_expiry_days: program.points_expiry_days?.toString() || '',
                          })
                        }
                        setIsEditing(false)
                      }}
                style={[styles.addButton, { backgroundColor: colors.glass.regular }]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.addButtonText, { color: colors.text.secondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={styles.addButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Save"
              >
                <Text style={styles.addButtonText}>Save</Text>
              </Pressable>
            </View>
                </View>
              </View>
            </View>
          </View>

          {/* Configuration Form */}
          <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
            <LiquidGlassView
              interactive
              style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
            >
              <View style={{ padding: spacing.md, gap: spacing.md }}>
                {/* Points per Dollar */}
                <View>
                  <Text style={styles.formLabel}>Points per Dollar Spent</Text>
                  <Text style={styles.formHint}>How many points customers earn per dollar</Text>
                  <View style={styles.formInputWrapper}>
                    <TextInput
                      style={styles.formInput}
                      value={formData.points_per_dollar}
                      onChangeText={(text) => setFormData({ ...formData, points_per_dollar: text })}
                      keyboardType="decimal-pad"
                      placeholder="1.00"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>
                </View>

                {/* Point Value */}
                <View>
                  <Text style={styles.formLabel}>Point Value (USD)</Text>
                  <Text style={styles.formHint}>Dollar value of each point when redeemed</Text>
                  <View style={styles.formInputWrapper}>
                    <TextInput
                      style={styles.formInput}
                      value={formData.point_value}
                      onChangeText={(text) => setFormData({ ...formData, point_value: text })}
                      keyboardType="decimal-pad"
                      placeholder="0.01"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>
                </View>

                {/* Min Redemption */}
                <View>
                  <Text style={styles.formLabel}>Minimum Points to Redeem</Text>
                  <Text style={styles.formHint}>Minimum points required for redemption</Text>
                  <View style={styles.formInputWrapper}>
                    <TextInput
                      style={styles.formInput}
                      value={formData.min_redemption_points}
                      onChangeText={(text) => setFormData({ ...formData, min_redemption_points: text })}
                      keyboardType="number-pad"
                      placeholder="100"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>
                </View>

                {/* Expiry */}
                <View>
                  <Text style={styles.formLabel}>Points Expiry (Days)</Text>
                  <Text style={styles.formHint}>Days until points expire (leave empty for never)</Text>
                  <View style={styles.formInputWrapper}>
                    <TextInput
                      style={styles.formInput}
                      value={formData.points_expiry_days}
                      onChangeText={(text) => setFormData({ ...formData, points_expiry_days: text })}
                      keyboardType="number-pad"
                      placeholder="365 or leave empty"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>
                </View>
              </View>
            </LiquidGlassView>
          </LiquidGlassContainerView>
        </ScrollView>
      </View>
    )
  }

  // Display mode - show current configuration
  return (
    <View style={styles.detailContainer}>
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Loyalty & Rewards</Text>
        <Pressable
          onPress={() => setIsEditing(true)}
          style={styles.fixedHeaderButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Edit loyalty program"
        >
          <Text style={styles.fixedHeaderButtonText}>Edit</Text>
        </Pressable>
      </Animated.View>

      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: layout.contentStartTop, paddingBottom: layout.dockHeight, paddingRight: 0 }}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y
          const threshold = 40
          headerOpacity.setValue(offsetY > threshold ? 1 : 0)
        }}
        scrollEventThrottle={16}
      >
        {/* Title Section with Vendor Logo */}
        <View style={styles.cardWrapper}>
          <View style={styles.titleSectionContainer}>
            <View style={styles.titleWithLogo}>
              {vendorLogo ? (
                <Image
                  source={{ uri: vendorLogo }}
                  style={styles.vendorLogoInline}
                  resizeMode="contain"
                        fadeDuration={0}
                />
              ) : (
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.detailTitleLarge}>Loyalty & Rewards</Text>
                {activeTab === 'program' && (
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Pressable
                      onPress={handleToggleStatus}
                      style={[styles.addButton, !program.is_active && { backgroundColor: colors.glass.regular }]}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={program.is_active ? 'Deactivate program' : 'Activate program'}
                    >
                      <Text style={[styles.addButtonText, !program.is_active && { color: colors.text.secondary }]}>
                        {program.is_active ? 'Deactivate' : 'Activate'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setIsEditing(true)}
                      style={styles.addButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="Edit program"
                    >
                      <Text style={styles.addButtonText}>Edit</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.cardWrapper}>
          <View style={styles.tabSwitcher}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setActiveTab('program')
              }}
              style={[styles.tab, activeTab === 'program' && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === 'program' && styles.tabTextActive]}>Program</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setActiveTab('campaigns')
              }}
              style={[styles.tab, activeTab === 'campaigns' && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === 'campaigns' && styles.tabTextActive]}>Campaigns</Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'program' ? (
          <>
            {/* Program Configuration Card */}
            <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            interactive
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={{ padding: spacing.md, gap: spacing.lg }}>
              {/* Status Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: program.is_active ? '#10b981' : colors.text.quaternary,
                  }}
                />
                <Text style={[styles.formHint, { marginBottom: 0 }]}>
                  {program.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>

              {/* Configuration Details */}
              <View style={{ gap: spacing.md }}>
                <View>
                  <Text style={styles.formLabel}>Points per Dollar</Text>
                  <Text style={styles.configValue}>{program.points_per_dollar}× points</Text>
                </View>

                <View>
                  <Text style={styles.formLabel}>Point Value</Text>
                  <Text style={styles.configValue}>${program.point_value.toFixed(4)} per point</Text>
                </View>

                <View>
                  <Text style={styles.formLabel}>Minimum Redemption</Text>
                  <Text style={styles.configValue}>{program.min_redemption_points} points</Text>
                </View>

                <View>
                  <Text style={styles.formLabel}>Points Expiry</Text>
                  <Text style={styles.configValue}>
                    {program.points_expiry_days ? `${program.points_expiry_days} days` : 'Never expires'}
                  </Text>
                </View>
              </View>

              {/* Example Calculation */}
              <View style={{ marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.border.subtle }}>
                <Text style={[styles.formHint, { marginBottom: spacing.xs }]}>Example:</Text>
                <Text style={styles.formHint}>
                  $100 purchase = {Math.floor(100 * program.points_per_dollar)} points = ${(100 * program.points_per_dollar * program.point_value).toFixed(2)} value
                </Text>
              </View>
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>
          </>
        ) : (
          <CampaignsDetail
            campaigns={campaigns}
            stats={campaignStats}
            isLoading={campaignsLoading}
            onCreate={onCreateCampaign}
            onUpdate={onUpdateCampaign}
            onDelete={onDeleteCampaign}
            onToggleStatus={onToggleCampaignStatus}
          />
        )}
      </ScrollView>
    </View>
  )
}

export { LoyaltyManagementDetail }
