/**
 * LocationConfigurationDetail
 * Location configuration - Jobs Principle: Deep dive into location settings
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Animated, TextInput, Image, Switch } from "react-native"
import { useState } from "react"
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from "@callstack/liquid-glass"
import { LinearGradient } from "expo-linear-gradient"
import Slider from "@react-native-community/slider"
import * as Haptics from "expo-haptics"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import type { UserLocationAccess } from "@/hooks/useUserLocations"
import type { UserWithLocations } from "@/hooks/useUsers"
import type { Supplier } from "@/hooks/useSuppliers"
import type { LoyaltyProgram } from "@/hooks/useLoyalty"
import type { Campaign } from "@/hooks/useCampaigns"
import type { PaymentProcessor } from "@/hooks/usePaymentProcessors"
import { UserManagementModals } from "../UserManagementModals"
import { SupplierManagementModals } from "../SupplierManagementModals"
import { PaymentProcessorModal } from "../PaymentProcessorModal"
import { DetailRow } from "./DetailRow"
import { locationConfigurationStyles as styles } from "./locationConfiguration.styles"

function PaymentIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 20, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: color }}>
        <View style={{ width: 14, height: 2, backgroundColor: color, marginTop: 3, marginLeft: 2 }} />
      </View>
    </View>
  )
}

function LocationConfigurationDetail({
  location,
  processors,
  processorsLoading,
  processorsError,
  headerOpacity,
  onBack,
  onCreateProcessor,
  onUpdateProcessor,
  onDeleteProcessor,
  onTestConnection,
  onSetAsDefault,
  onToggleStatus,
  onReload,
}: {
  location: UserLocationAccess
  processors: PaymentProcessor[]
  processorsLoading: boolean
  processorsError: string | null
  headerOpacity: Animated.Value
  onBack: () => void
  onCreateProcessor: any
  onUpdateProcessor: any
  onDeleteProcessor: any
  onTestConnection: any
  onSetAsDefault: any
  onToggleStatus: any
  onReload: () => void
}) {
  const [showAddProcessorModal, setShowAddProcessorModal] = useState(false)
  const [editingProcessor, setEditingProcessor] = useState<PaymentProcessor | null>(null)
  const [testingProcessorId, setTestingProcessorId] = useState<string | null>(null)

  const handleAddProcessor = () => {
    setEditingProcessor(null)
    setShowAddProcessorModal(true)
  }

  const handleEditProcessor = (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingProcessor(processor)
    setShowAddProcessorModal(true)
  }

  const handleTestConnection = async (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setTestingProcessorId(processor.id)

    const result = await onTestConnection(processor.id)
    setTestingProcessorId(null)

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert(
        'Test Successful ✓',
        result.message || '$1.00 test transaction approved.\n\nTerminal is online and ready to accept payments.',
        [{ text: 'OK', style: 'default' }]
      )
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert(
        'Test Failed ✗',
        result.error || 'Connection test failed. Please check your terminal and configuration.',
        [{ text: 'OK', style: 'cancel' }]
      )
    }
  }

  const handleSetAsDefault = async (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const result = await onSetAsDefault(processor.id)
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to set as default')
    }
  }

  const handleToggleStatus = async (processor: PaymentProcessor) => {
    const newStatus = !processor.is_active
    const statusText = newStatus ? 'activate' : 'deactivate'

    Alert.alert(
      `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} Processor`,
      `Are you sure you want to ${statusText} ${processor.processor_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusText.charAt(0).toUpperCase() + statusText.slice(1),
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            const result = await onToggleStatus(processor.id, newStatus)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to update processor status')
            }
          },
        },
      ]
    )
  }

  const handleDeleteProcessor = (processor: PaymentProcessor) => {
    Alert.alert(
      'Delete Processor',
      `Are you sure you want to permanently delete ${processor.processor_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            const result = await onDeleteProcessor(processor.id)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete processor')
            }
          },
        },
      ]
    )
  }

  const getProcessorTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      dejavoo: 'Dejavoo',
      stripe: 'Stripe',
      square: 'Square',
      authorizenet: 'Authorize.Net',
      clover: 'Clover',
    }
    return types[type] || type
  }

  const getTestStatusColor = (status?: string | null) => {
    if (status === 'success') return '#10b981'
    if (status === 'failed') return '#ef4444'
    return colors.text.quaternary
  }

  const formatAddress = () => {
    const parts = [
      location.location.address_line1,
      location.location.city,
      location.location.state,
      location.location.postal_code,
    ].filter(Boolean)
    return parts.join(', ') || 'No address'
  }

  const activeProcessors = processors.filter(p => p.is_active)
  const inactiveProcessors = processors.filter(p => !p.is_active)

  return (
    <View style={styles.detailContainer}>
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Pressable onPress={onBack} style={styles.fixedHeaderButton}>
          <Text style={styles.fixedHeaderButtonText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.fixedHeaderTitle}>{location.location.name}</Text>
        <View style={{ width: 70 }} />
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
        <View style={[styles.cardWrapper, styles.titleRow]}>
          <Pressable
            onPress={onBack}
            style={[styles.addButton, { backgroundColor: colors.glass.regular }]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Back to locations"
          >
            <Text style={[styles.addButtonText, { color: colors.text.secondary }]}>‹ Locations</Text>
          </Pressable>
          <Text style={styles.detailTitle}>{location.location.name}</Text>
        </View>

        {/* Location Info */}
        <Text style={[styles.cardSectionTitle, { marginTop: spacing.lg }]}>STORE INFORMATION</Text>
        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            interactive
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={{ padding: spacing.md, gap: spacing.sm }}>
              <Text style={styles.formLabel}>ADDRESS</Text>
              <Text style={styles.locationConfigValue}>{formatAddress()}</Text>
              {location.location.phone && (
                <>
                  <Text style={[styles.formLabel, { marginTop: spacing.md }]}>PHONE</Text>
                  <Text style={styles.locationConfigValue}>{location.location.phone}</Text>
                </>
              )}
              {location.location.tax_rate !== undefined && location.location.tax_rate !== null && (
                <>
                  <Text style={[styles.formLabel, { marginTop: spacing.md }]}>TAX RATE</Text>
                  <Text style={styles.locationConfigValue}>
                    {(location.location.tax_rate * 100).toFixed(2)}% {location.location.tax_name || 'Sales Tax'}
                  </Text>
                </>
              )}
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>

        {/* Payment Processors Section */}
        <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>PAYMENT PROCESSORS</Text>

        {processorsLoading ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.text.tertiary} />
            <Text style={{ ...typography.footnote, color: colors.text.tertiary, marginTop: spacing.sm }}>
              Loading processors...
            </Text>
          </View>
        ) : processorsError ? (
          <View style={styles.cardWrapper}>
            <LiquidGlassView
              interactive
              style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
            >
              <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                <Text style={[styles.emptyStateText, { fontSize: 15, color: '#ef4444' }]}>Error loading processors</Text>
                <Text style={{ ...typography.footnote, color: colors.text.tertiary, textAlign: 'center' }}>
                  {processorsError}
                </Text>
                <Pressable
                  onPress={onReload}
                  style={[styles.addButton, { marginTop: spacing.sm }]}
                >
                  <Text style={styles.addButtonText}>Retry</Text>
                </Pressable>
              </View>
            </LiquidGlassView>
          </View>
        ) : activeProcessors.length === 0 ? (
          <View style={styles.cardWrapper}>
            <LiquidGlassView
              interactive
              style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
            >
              <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                <PaymentIcon color={colors.text.quaternary} />
                <Text style={[styles.emptyStateText, { fontSize: 15 }]}>No processors configured</Text>
                <Pressable
                  onPress={handleAddProcessor}
                  style={[styles.addButton, { marginTop: spacing.sm }]}
                >
                  <Text style={styles.addButtonText}>Add Processor</Text>
                </Pressable>
              </View>
            </LiquidGlassView>
          </View>
        ) : (
          <>
            <View style={[styles.cardWrapper, styles.titleRow]}>
              <Text style={{ ...typography.body, color: colors.text.secondary }}>
                {activeProcessors.length} active
              </Text>
              <Pressable onPress={handleAddProcessor} style={styles.addButton}>
                <Text style={styles.addButtonText}>Add Processor</Text>
              </Pressable>
            </View>

            {activeProcessors.map((processor) => {
              const isTesting = testingProcessorId === processor.id
              const lastTestDate = processor.last_tested_at ? new Date(processor.last_tested_at) : null
              const testStatus = processor.last_test_status

              return (
                <LiquidGlassContainerView key={processor.id} spacing={12} style={styles.cardWrapper}>
                  <LiquidGlassView
                    interactive
                    style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
                  >
                    <View style={{ padding: spacing.md }}>
                      {/* Header with name and badges */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                        <View style={{ flex: 1, gap: spacing.xs }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                            <Text style={styles.supplierCardName}>{processor.processor_name}</Text>
                            {processor.is_default && (
                              <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#60A5FA20', borderRadius: radius.xs }}>
                                <Text style={{ ...typography.caption2, color: '#60A5FA', fontWeight: '600' }}>DEFAULT</Text>
                              </View>
                            )}
                            {testStatus && (
                              <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: testStatus === 'success' ? '#10b98120' : '#ef444420', borderRadius: radius.xs }}>
                                <Text style={{ ...typography.caption2, color: testStatus === 'success' ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                                  {testStatus === 'success' ? '● ONLINE' : '● OFFLINE'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ ...typography.footnote, color: colors.text.tertiary }}>
                            {getProcessorTypeLabel(processor.processor_type)} • {processor.environment === 'production' ? 'Production' : 'Sandbox'}
                          </Text>
                        </View>
                      </View>

                      {/* Test status details */}
                      {lastTestDate && (
                        <View style={{
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.sm,
                          backgroundColor: colors.glass.thin,
                          borderRadius: radius.md,
                          marginBottom: spacing.md,
                          borderLeftWidth: 3,
                          borderLeftColor: getTestStatusColor(testStatus)
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ ...typography.caption2, color: colors.text.tertiary, textTransform: 'uppercase', marginBottom: 2 }}>
                                Last Test
                              </Text>
                              <Text style={{ ...typography.footnote, color: colors.text.secondary }}>
                                {lastTestDate.toLocaleDateString()} at {lastTestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <Text style={{ ...typography.headline, color: getTestStatusColor(testStatus), fontWeight: '600' }}>
                              {testStatus === 'success' ? '✓' : '✗'}
                            </Text>
                          </View>
                          {processor.last_test_error && testStatus === 'failed' && (
                            <Text style={{ ...typography.footnote, color: '#ef4444', marginTop: spacing.xs }}>
                              {processor.last_test_error}
                            </Text>
                          )}
                        </View>
                      )}

                      {/* Action buttons */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                        <Pressable
                          onPress={() => handleTestConnection(processor)}
                          disabled={isTesting}
                          style={[
                            styles.userActionButton,
                            {
                              backgroundColor: isTesting ? colors.glass.thin : '#60A5FA20',
                              borderWidth: 1,
                              borderColor: isTesting ? colors.border.subtle : '#60A5FA40',
                            }
                          ]}
                        >
                          <Text style={[styles.userActionButtonText, { color: isTesting ? colors.text.tertiary : '#60A5FA', fontWeight: '600' }]}>
                            {isTesting ? 'Testing...' : 'Send Test $1.00'}
                          </Text>
                        </Pressable>
                        {!processor.is_default && (
                          <Pressable
                            onPress={() => handleSetAsDefault(processor)}
                            style={styles.userActionButton}
                          >
                            <Text style={styles.userActionButtonText}>Set Default</Text>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => handleEditProcessor(processor)}
                          style={styles.userActionButton}
                        >
                          <Text style={styles.userActionButtonText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleToggleStatus(processor)}
                          style={styles.userActionButton}
                        >
                          <Text style={styles.userActionButtonText}>Deactivate</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteProcessor(processor)}
                          style={[styles.userActionButton, styles.userActionButtonDanger]}
                        >
                          <Text style={styles.userActionButtonDangerText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  </LiquidGlassView>
                </LiquidGlassContainerView>
              )
            })}

            {inactiveProcessors.length > 0 && (
              <>
                <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>INACTIVE</Text>
                {inactiveProcessors.map((processor) => (
                  <LiquidGlassContainerView key={processor.id} spacing={12} style={styles.cardWrapper}>
                    <LiquidGlassView
                      interactive
                      style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback, { opacity: 0.5 }]}
                    >
                      <View style={styles.supplierCard}>
                        <View style={styles.supplierCardHeader}>
                          <View style={styles.supplierCardInfo}>
                            <Text style={styles.supplierCardName}>{processor.processor_name}</Text>
                            <Text style={styles.supplierCardEmail}>
                              {getProcessorTypeLabel(processor.processor_type)} • {processor.environment}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.supplierCardActions}>
                          <Pressable
                            onPress={() => handleToggleStatus(processor)}
                            style={styles.userActionButton}
                          >
                            <Text style={styles.userActionButtonText}>Activate</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteProcessor(processor)}
                            style={[styles.userActionButton, styles.userActionButtonDanger]}
                          >
                            <Text style={styles.userActionButtonDangerText}>Delete</Text>
                          </Pressable>
                        </View>
                      </View>
                    </LiquidGlassView>
                  </LiquidGlassContainerView>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <PaymentProcessorModal
        visible={showAddProcessorModal}
        processor={editingProcessor}
        locationId={location.location.id}
        onClose={() => {
          setShowAddProcessorModal(false)
          setEditingProcessor(null)
        }}
        onCreate={onCreateProcessor}
        onUpdate={onUpdateProcessor}
      />
    </View>
  )
}

export { LocationConfigurationDetail }
