/**
 * PaymentProcessorsManagementDetail
 * Payment processor overview - Jobs Principle: Simple payment configuration overview
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Animated, TextInput, Image, Switch } from "react-native"
import { useState } from "react"
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from "@callstack/liquid-glass"
import { LinearGradient } from "expo-linear-gradient"
import * as Haptics from "expo-haptics"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import type { PaymentProcessor } from "@/hooks/usePaymentProcessors"
import { PaymentProcessorModal } from "../PaymentProcessorModal"
import { paymentProcessorsStyles as styles } from "./paymentProcessors.styles"

function PaymentIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 20, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: color }}>
        <View style={{ width: 14, height: 2, backgroundColor: color, marginTop: 3, marginLeft: 2 }} />
      </View>
    </View>
  )
}

function PaymentProcessorsManagementDetail({
  processors,
  isLoading,
  headerOpacity,
  onCreateProcessor,
  onUpdateProcessor,
  onDeleteProcessor,
  onTestConnection,
  onSetAsDefault,
  onToggleStatus,
  onReload,
  vendorLogo,
}: {
  processors: PaymentProcessor[]
  isLoading: boolean
  headerOpacity: Animated.Value
  onCreateProcessor: any
  onUpdateProcessor: any
  onDeleteProcessor: any
  onTestConnection: any
  onSetAsDefault: any
  onToggleStatus: any
  onReload: () => void
  vendorLogo?: string | null
}) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProcessor, setEditingProcessor] = useState<PaymentProcessor | null>(null)

  const handleAddProcessor = () => {
    setEditingProcessor(null)
    setShowAddModal(true)
  }

  const handleEditProcessor = (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingProcessor(processor)
    setShowAddModal(true)
  }

  const handleTestConnection = async (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const result = await onTestConnection(processor.id)
    if (result.success) {
      Alert.alert('Success', 'Connection test successful')
    } else {
      Alert.alert('Test Failed', result.error || 'Connection test failed')
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
      `Are you sure you want to permanently delete ${processor.processor_name}? This action cannot be undone.`,
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

  if (isLoading) {
    return (
      <View style={styles.detailContainer}>
        <View style={[styles.emptyState, { paddingTop: layout.contentStartTop }]}>
          <ActivityIndicator color={colors.text.tertiary} />
          <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading processors...</Text>
        </View>
      </View>
    )
  }

  if (processors.length === 0) {
    return (
      <View style={styles.detailContainer}>
        <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
          <Text style={styles.fixedHeaderTitle}>Payment Processors</Text>
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
          <View style={styles.cardWrapper}>
            <Text style={styles.detailTitle}>Payment Processors</Text>
          </View>

          <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
            <View style={styles.emptyStateIcon}>
              <PaymentIcon color={colors.text.quaternary} />
            </View>
            <Text style={styles.emptyStateText}>No processors configured</Text>
            <Text style={styles.emptyStateSubtext}>Add a payment processor to accept payments</Text>
            <Pressable
              onPress={handleAddProcessor}
              style={styles.addButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add first processor"
            >
              <Text style={styles.addButtonText}>Add Processor</Text>
            </Pressable>
          </View>
        </ScrollView>

        <PaymentProcessorModal
          visible={showAddModal}
          processor={editingProcessor}
          onClose={() => {
            setShowAddModal(false)
            setEditingProcessor(null)
          }}
          onCreate={onCreateProcessor}
          onUpdate={onUpdateProcessor}
        />
      </View>
    )
  }

  const activeProcessors = processors.filter(p => p.is_active)
  const inactiveProcessors = processors.filter(p => !p.is_active)

  return (
    <View style={styles.detailContainer}>
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Payment Processors</Text>
        <Pressable
          onPress={handleAddProcessor}
          style={styles.fixedHeaderButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add new processor"
        >
          <Text style={styles.fixedHeaderButtonText}>+</Text>
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
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.detailTitleLarge}>Payment Processors</Text>
                <Pressable
                  onPress={handleAddProcessor}
                  style={styles.addButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Add new processor"
                >
                  <Text style={styles.addButtonText}>Add Processor</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Active Processors */}
        {activeProcessors.map((processor) => (
          <LiquidGlassContainerView key={processor.id} spacing={12} style={styles.cardWrapper}>
            <LiquidGlassView
              interactive
              style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
            >
              <View style={styles.supplierCard}>
                <View style={styles.supplierCardHeader}>
                  <View style={styles.supplierCardInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={styles.supplierCardName}>{processor.processor_name}</Text>
                      {processor.is_default && (
                        <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 2, backgroundColor: colors.glass.thin, borderRadius: radius.xs }}>
                          <Text style={{ ...typography.caption2, color: colors.text.tertiary }}>DEFAULT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.supplierCardEmail}>
                      {getProcessorTypeLabel(processor.processor_type)} • {processor.environment}
                    </Text>
                    {processor.last_tested_at && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getTestStatusColor(processor.last_test_status) }} />
                        <Text style={styles.supplierCardEmail}>
                          Last tested {new Date(processor.last_tested_at).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.supplierCardActions}>
                  <Pressable
                    onPress={() => handleTestConnection(processor)}
                    style={styles.userActionButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Test ${processor.processor_name}`}
                  >
                    <Text style={styles.userActionButtonText}>Test</Text>
                  </Pressable>
                  {!processor.is_default && (
                    <Pressable
                      onPress={() => handleSetAsDefault(processor)}
                      style={styles.userActionButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${processor.processor_name} as default`}
                    >
                      <Text style={styles.userActionButtonText}>Set Default</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => handleEditProcessor(processor)}
                    style={styles.userActionButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${processor.processor_name}`}
                  >
                    <Text style={styles.userActionButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleToggleStatus(processor)}
                    style={styles.userActionButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Deactivate ${processor.processor_name}`}
                  >
                    <Text style={styles.userActionButtonText}>Deactivate</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteProcessor(processor)}
                    style={[styles.userActionButton, styles.userActionButtonDanger]}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${processor.processor_name}`}
                  >
                    <Text style={styles.userActionButtonDangerText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </LiquidGlassView>
          </LiquidGlassContainerView>
        ))}

        {/* Inactive Processors */}
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
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Activate ${processor.processor_name}`}
                      >
                        <Text style={styles.userActionButtonText}>Activate</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteProcessor(processor)}
                        style={[styles.userActionButton, styles.userActionButtonDanger]}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${processor.processor_name}`}
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
      </ScrollView>

      <PaymentProcessorModal
        visible={showAddModal}
        processor={editingProcessor}
        onClose={() => {
          setShowAddModal(false)
          setEditingProcessor(null)
        }}
        onCreate={onCreateProcessor}
        onUpdate={onUpdateProcessor}
      />
    </View>
  )
}

export { PaymentProcessorsManagementDetail }
