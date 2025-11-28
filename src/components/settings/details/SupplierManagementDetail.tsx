/**
 * SupplierManagementDetail
 * Supplier management - Jobs Principle: Simple vendor relationships
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator, Animated, Alert } from "react-native"
import { useState } from "react"
// Removed LiquidGlassView - using plain View with borderless style
import * as Haptics from "expo-haptics"
import { colors, spacing } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import { TitleSection } from "@/components/shared"
import { useSuppliers, useSuppliersLoading, useSuppliersActions } from "@/stores/suppliers-management.store"
import { SupplierDetail } from "./SupplierDetail"
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
  headerOpacity,
  vendorLogo,
}: {
  headerOpacity: Animated.Value
  vendorLogo?: string | null
}) {
  // ✅ Read from stores instead of props
  const suppliers = useSuppliers()
  const isLoading = useSuppliersLoading()
  const { deleteSupplier, toggleSupplierStatus, loadSuppliers } = useSuppliersActions()

  // Navigation state
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  // ✅ Use navigation instead of modals
  const handleAddSupplier = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsCreatingNew(true)
  }

  const handleEditSupplier = (supplier: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedSupplier(supplier)
  }

  const handleBack = () => {
    setSelectedSupplier(null)
    setIsCreatingNew(false)
  }

  const handleSupplierSaved = async () => {
    // Reload suppliers list
    await loadSuppliers(suppliers[0]?.vendor_id || '')
  }

  const handleToggleStatus = async (supplier: any) => {
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
            const result = await toggleSupplierStatus(supplier.id, newStatus)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to update supplier status')
            }
          },
        },
      ]
    )
  }

  const handleDeleteSupplier = (supplier: any) => {
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
            const result = await deleteSupplier(supplier.id)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete supplier')
            }
          },
        },
      ]
    )
  }

  // Show detail page if supplier selected or creating new
  if (selectedSupplier || isCreatingNew) {
    return (
      <SupplierDetail
        supplier={selectedSupplier}
        onBack={handleBack}
        onSupplierSaved={handleSupplierSaved}
      />
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
        <ScrollView
          style={styles.detailScroll}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: layout.dockHeight, paddingRight: 0 }}
        >
          <TitleSection
            title="Suppliers"
            logo={vendorLogo}
            buttonText="Add Supplier"
            onButtonPress={handleAddSupplier}
          />

          <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
            <View style={styles.emptyStateIcon}>
              <SuppliersIcon color={colors.text.quaternary} />
            </View>
            <Text style={styles.emptyStateText}>No suppliers yet</Text>
            <Text style={styles.emptyStateSubtext}>Add suppliers for purchasing inventory</Text>
          </View>
        </ScrollView>
      </View>
    )
  }

  const activeSuppliers = suppliers.filter(s => s.is_active)
  const inactiveSuppliers = suppliers.filter(s => !s.is_active)

  return (
    <View style={styles.detailContainer}>
      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: layout.dockHeight, paddingRight: 0 }}
      >
        <TitleSection
          title="Suppliers"
          logo={vendorLogo}
          subtitle={`${activeSuppliers.length} active${inactiveSuppliers.length > 0 ? `, ${inactiveSuppliers.length} inactive` : ''}`}
          buttonText="Add Supplier"
          onButtonPress={handleAddSupplier}
        />

        {/* Active Suppliers List - MATCHES ProductsListView Structure */}
        <View style={styles.cardWrapper}>
          <View style={styles.listCardGlass}>
            {activeSuppliers.map((supplier, index) => {
              const isLast = index === activeSuppliers.length - 1
              return (
                <Pressable
                  key={supplier.id}
                  style={[styles.listItem, isLast && styles.listItemLast]}
                  onPress={() => handleEditSupplier(supplier)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={supplier.external_name}
                >
                  {/* Supplier Icon */}
                  <View style={styles.supplierIcon}>
                    <SuppliersIcon color={'rgba(235,235,245,0.6)'} />
                  </View>

                  {/* Supplier Info */}
                  <View style={styles.supplierInfo}>
                    <Text style={styles.supplierName} numberOfLines={1}>{supplier.external_name}</Text>
                    <Text style={styles.supplierContact} numberOfLines={1}>
                      {supplier.contact_name || 'No contact'}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Inactive Suppliers */}
        {inactiveSuppliers.length > 0 && (
          <>
            <View style={styles.cardWrapper}>
              <Text style={styles.sectionLabel}>INACTIVE</Text>
            </View>
            {/* Inactive Suppliers List - MATCHES ProductsListView Structure */}
            <View style={styles.cardWrapper}>
              <View style={[styles.listCardGlass, { opacity: 0.5 }]}>
                {inactiveSuppliers.map((supplier, index) => {
                  const isLast = index === inactiveSuppliers.length - 1
                  return (
                    <Pressable
                      key={supplier.id}
                      style={[styles.listItem, isLast && styles.listItemLast]}
                      onPress={() => handleEditSupplier(supplier)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={supplier.external_name}
                    >
                      {/* Supplier Icon */}
                      <View style={styles.supplierIcon}>
                        <SuppliersIcon color={'rgba(235,235,245,0.6)'} />
                      </View>

                      {/* Supplier Info */}
                      <View style={styles.supplierInfo}>
                        <Text style={styles.supplierName} numberOfLines={1}>{supplier.external_name}</Text>
                        <Text style={styles.supplierContact} numberOfLines={1}>
                          {supplier.contact_name || 'No contact'}
                        </Text>
                      </View>

                      {/* Status (if inactive) */}
                      {!supplier.is_active && (
                        <View style={styles.supplierMeta}>
                          <Text style={styles.inactiveLabel}>INACTIVE</Text>
                        </View>
                      )}
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
export { SupplierManagementDetail }
