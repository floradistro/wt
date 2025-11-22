/**
 * SupplierManagementDetail
 * Supplier management - Jobs Principle: Simple vendor relationships
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator, Animated, Alert, Image } from "react-native"
import { useState } from "react"
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from "@callstack/liquid-glass"
import { LinearGradient } from "expo-linear-gradient"
import * as Haptics from "expo-haptics"
import { colors, spacing } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import type { Supplier } from "@/hooks/useSuppliers"
import { SupplierManagementModals } from "../SupplierManagementModals"
import { supplierManagementStyles as styles } from "./supplierManagement.styles"

function SuppliersIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 14, height: 12, borderWidth: 1.5, borderColor: color, borderTopWidth: 0, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ width: 6, height: 8, borderWidth: 1.5, borderColor: color, marginBottom: 1 }} />
      </View>
    </View>
  )
}

function SupplierManagementDetail({
  suppliers,
  isLoading,
  headerOpacity,
  onCreateSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onToggleStatus,
  onReload,
  vendorLogo,
}: {
  suppliers: Supplier[]
  isLoading: boolean
  headerOpacity: Animated.Value
  onCreateSupplier: any
  onUpdateSupplier: any
  onDeleteSupplier: any
  onToggleStatus: any
  onReload: () => void
  vendorLogo?: string | null
}) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  const handleAddSupplier = () => {
    setEditingSupplier(null)
    setShowAddModal(true)
  }

  const handleEditSupplier = (supplier: Supplier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingSupplier(supplier)
    setShowAddModal(true)
  }

  const handleToggleStatus = async (supplier: Supplier) => {
    const newStatus = !supplier.is_active
    const statusText = newStatus ? 'activate' : 'deactivate'

    Alert.alert(
      `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} Supplier`,
      `Are you sure you want to ${statusText} ${supplier.external_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusText.charAt(0).toUpperCase() + statusText.slice(1),
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            const result = await onToggleStatus(supplier.id, newStatus)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to update supplier status')
            }
          },
        },
      ]
    )
  }

  const handleDeleteSupplier = (supplier: Supplier) => {
    Alert.alert(
      'Delete Supplier',
      `Are you sure you want to permanently delete ${supplier.external_name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            const result = await onDeleteSupplier(supplier.id)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete supplier')
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
          <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading suppliers...</Text>
        </View>
      </View>
    )
  }

  if (suppliers.length === 0) {
    return (
      <View style={styles.detailContainer}>
        <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
          <Text style={styles.fixedHeaderTitle}>Suppliers</Text>
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
            <Text style={styles.detailTitle}>Suppliers</Text>
          </View>

          <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
            <View style={styles.emptyStateIcon}>
              <SuppliersIcon color={colors.text.quaternary} />
            </View>
            <Text style={styles.emptyStateText}>No suppliers yet</Text>
            <Text style={styles.emptyStateSubtext}>Add suppliers for purchasing inventory</Text>
            <Pressable
              onPress={handleAddSupplier}
              style={styles.addButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add first supplier"
            >
              <Text style={styles.addButtonText}>Add Supplier</Text>
            </Pressable>
          </View>
        </ScrollView>

        <SupplierManagementModals
          showAddModal={showAddModal}
          editingSupplier={editingSupplier}
          onCloseAddModal={() => {
            setShowAddModal(false)
            setEditingSupplier(null)
          }}
          onCreateSupplier={onCreateSupplier}
          onUpdateSupplier={onUpdateSupplier}
          onReload={onReload}
        />
      </View>
    )
  }

  const activeSuppliers = suppliers.filter(s => s.is_active)
  const inactiveSuppliers = suppliers.filter(s => !s.is_active)

  return (
    <View style={styles.detailContainer}>
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Suppliers</Text>
        <Pressable
          onPress={handleAddSupplier}
          style={styles.fixedHeaderButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add new supplier"
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
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.detailTitleLarge}>Suppliers</Text>
                <Pressable
                  onPress={handleAddSupplier}
                  style={styles.addButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Add new supplier"
                >
                  <Text style={styles.addButtonText}>Add Supplier</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Active Suppliers */}
        {activeSuppliers.map((supplier) => (
          <LiquidGlassContainerView key={supplier.id} spacing={12} style={styles.cardWrapper}>
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              interactive
              style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
            >
              <View style={styles.supplierCard}>
                <View style={styles.supplierCardHeader}>
                  <View style={styles.supplierCardInfo}>
                    <Text style={styles.supplierCardName}>{supplier.external_name}</Text>
                    {supplier.contact_name && (
                      <Text style={styles.supplierCardContact}>{supplier.contact_name}</Text>
                    )}
                    {supplier.contact_email && (
                      <Text style={styles.supplierCardEmail}>{supplier.contact_email}</Text>
                    )}
                    {supplier.contact_phone && (
                      <Text style={styles.supplierCardPhone}>{supplier.contact_phone}</Text>
                    )}
                    {supplier.address && (
                      <Text style={styles.supplierCardAddress}>{supplier.address}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.supplierCardActions}>
                  <Pressable
                    onPress={() => handleEditSupplier(supplier)}
                    style={styles.userActionButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${supplier.external_name}`}
                  >
                    <Text style={styles.userActionButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleToggleStatus(supplier)}
                    style={styles.userActionButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Deactivate ${supplier.external_name}`}
                  >
                    <Text style={styles.userActionButtonText}>Deactivate</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteSupplier(supplier)}
                    style={[styles.userActionButton, styles.userActionButtonDanger]}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${supplier.external_name}`}
                  >
                    <Text style={styles.userActionButtonDangerText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </LiquidGlassView>
          </LiquidGlassContainerView>
        ))}

        {/* Inactive Suppliers */}
        {inactiveSuppliers.length > 0 && (
          <>
            <View style={styles.cardWrapper}>
              <Text style={styles.sectionLabel}>INACTIVE</Text>
            </View>
            {inactiveSuppliers.map((supplier) => (
              <LiquidGlassContainerView key={supplier.id} spacing={12} style={styles.cardWrapper}>
                <LiquidGlassView
                  effect="regular"
                  colorScheme="dark"
                  interactive
                  style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback, { opacity: 0.5 }]}
                >
                  <View style={styles.supplierCard}>
                    <View style={styles.supplierCardHeader}>
                      <View style={styles.supplierCardInfo}>
                        <Text style={styles.supplierCardName}>{supplier.external_name}</Text>
                      </View>
                    </View>

                    <View style={styles.supplierCardActions}>
                      <Pressable
                        onPress={() => handleToggleStatus(supplier)}
                        style={styles.userActionButton}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Activate ${supplier.external_name}`}
                      >
                        <Text style={styles.userActionButtonText}>Activate</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteSupplier(supplier)}
                        style={[styles.userActionButton, styles.userActionButtonDanger]}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${supplier.external_name}`}
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

      <SupplierManagementModals
        showAddModal={showAddModal}
        editingSupplier={editingSupplier}
        onCloseAddModal={() => {
          setShowAddModal(false)
          setEditingSupplier(null)
        }}
        onCreateSupplier={onCreateSupplier}
        onUpdateSupplier={onUpdateSupplier}
        onReload={onReload}
      />
    </View>
  )
}
export { SupplierManagementDetail }
