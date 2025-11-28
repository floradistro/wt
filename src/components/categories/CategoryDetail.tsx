/**
 * CategoryDetail Component
 * Full detail view for a category with inline editing
 * Matches the products detail pattern exactly
 */

import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Image, Switch } from 'react-native'
import { useState, useRef } from 'react'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { radius, spacing, colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { useAuth } from '@/stores/auth.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import type { Category } from '@/types/categories'
import { EditablePricingTemplatesSection } from './EditablePricingTemplatesSection'
import { EditableCustomFieldsSection } from './EditableCustomFieldsSection'
import { EditableVariantTemplatesSection, type EditableVariantTemplatesSectionRef } from './EditableVariantTemplatesSection'
import { Breadcrumb, MediaPickerModal, ImagePreviewModal } from '@/components/shared'
import { uploadProductImage, updateProductImage } from '@/services/media.service'
import { getThumbnailImage } from '@/utils/image-transforms'

interface CategoryDetailProps {
  category: Category
  onBack: () => void
  onCategoryUpdated: () => void
  fieldsCount: number
  templatesCount: number
}

export function CategoryDetail({
  category,
  onBack,
  onCategoryUpdated,
  fieldsCount,
  templatesCount,
}: CategoryDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()
  const { vendor } = useAppAuth()
  const variantSectionRef = useRef<EditableVariantTemplatesSectionRef>(null)

  // Edit state
  const [editedName, setEditedName] = useState(category.name)
  const [editedDescription, setEditedDescription] = useState(category.description || '')
  const [editedSlug, setEditedSlug] = useState(category.slug || '')
  const [editedIsActive, setEditedIsActive] = useState(category.is_active)

  // Image state
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(category.featured_image || null)

  // Image handlers
  const handleOpenImagePreview = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowImagePreview(true)
  }

  const handleChangePhoto = () => {
    setShowImagePreview(false)
    setTimeout(() => {
      setShowMediaPicker(true)
    }, 300)
  }

  const handleTakePhoto = async () => {
    if (!vendor?.id) return

    try {
      setShowImagePreview(false)

      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        logger.warn('[CategoryDetail] Camera permission denied')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        await handleSelectImage(result.assets[0].uri, true)
      }
    } catch (error) {
      logger.error('[CategoryDetail] Failed to take photo:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleRemovePhoto = async () => {
    if (!vendor?.id || !user?.email) return

    try {
      setShowImagePreview(false)
      setUploadingImage(true)

      logger.info('[CategoryDetail] Removing category image')

      // Get vendor_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      // Update category to remove image
      const { error: updateError } = await supabase
        .from('categories')
        .update({
          featured_image: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', category.id)
        .eq('vendor_id', userData.vendor_id)

      if (updateError) throw updateError

      setCurrentImageUrl(null)
      onCategoryUpdated()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      logger.error('[CategoryDetail] Failed to remove image:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSelectImage = async (imageUri: string, isFromDevice: boolean) => {
    if (!vendor?.id || !user?.email) {
      logger.error('[CategoryDetail] Cannot upload - no vendor ID or user')
      return
    }

    try {
      setUploadingImage(true)
      setShowMediaPicker(false)

      let imageUrl = imageUri

      // If from device, upload to Supabase first
      if (isFromDevice) {
        logger.info('[CategoryDetail] Uploading device image to Supabase')
        const result = await uploadProductImage({
          vendorId: vendor.id,
          productId: category.id, // Use category ID as product ID (same bucket)
          uri: imageUri,
        })
        imageUrl = result.url
      }

      // Get vendor_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      // Update category with image URL
      logger.info('[CategoryDetail] Updating category with image URL:', imageUrl)
      const { error: updateError } = await supabase
        .from('categories')
        .update({
          featured_image: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', category.id)
        .eq('vendor_id', userData.vendor_id)

      if (updateError) throw updateError

      // Update local state immediately for instant UI feedback
      setCurrentImageUrl(imageUrl)

      // Trigger parent reload to refresh the category list
      onCategoryUpdated()

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      logger.error('[CategoryDetail] Failed to set category image:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSave = async () => {
    if (!user?.email) return

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      const { error: updateError } = await supabase
        .from('categories')
        .update({
          name: editedName,
          description: editedDescription,
          slug: editedSlug,
          is_active: editedIsActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', category.id)
        .eq('vendor_id', userData.vendor_id)

      if (updateError) throw updateError

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setIsEditing(false)
      onCategoryUpdated()
    } catch (error) {
      logger.error('Failed to save category:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditedName(category.name)
    setEditedDescription(category.description || '')
    setEditedSlug(category.slug || '')
    setEditedIsActive(category.is_active)
    setIsEditing(false)
  }

  // Handler for when pricing templates are updated
  // This refreshes both the parent and the variant section's pricing template dropdown
  const handlePricingTemplatesUpdated = async () => {
    onCategoryUpdated()
    // Also refresh the variant section's pricing templates
    if (variantSectionRef.current) {
      await variantSectionRef.current.refreshPricingTemplates()
    }
  }

  const handleDeleteCategory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.email) {
              logger.error('[CategoryDetail] Cannot delete - no user')
              return
            }

            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
              logger.info('[CategoryDetail] Deleting category:', category.id)

              // Get vendor_id
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('vendor_id')
                .eq('auth_user_id', user.id)
                .maybeSingle()

              if (userError || !userData) {
                throw userError || new Error('User record not found')
              }

              // Check if category has products
              const { data: productsInCategory, error: productCheckError } = await supabase
                .from('products')
                .select('id', { count: 'exact', head: true })
                .eq('primary_category_id', category.id)
                .limit(1)

              if (productCheckError) {
                logger.warn('[CategoryDetail] Error checking products', { error: productCheckError.message })
              }

              if (productsInCategory && productsInCategory.length > 0) {
                throw new Error('This category cannot be deleted because it contains products. Please move or delete the products first.')
              }

              // Verify category belongs to vendor and delete
              const { error: deleteError } = await supabase
                .from('categories')
                .delete()
                .eq('id', category.id)
                .eq('vendor_id', userData.vendor_id)

              if (deleteError) throw deleteError

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              logger.info('[CategoryDetail] Category deleted successfully')

              // Go back first
              onBack()

              // Then trigger reload
              setTimeout(() => {
                onCategoryUpdated()
              }, 100)
            } catch (error) {
              logger.error('[CategoryDetail] Failed to delete category:', error)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

              Alert.alert(
                'Delete Failed',
                error instanceof Error ? error.message : 'Failed to delete category. Please try again.',
                [{ text: 'OK' }]
              )
            }
          }
        }
      ]
    )
  }

  return (
    <>
    <ScrollView
      style={styles.detail}
      contentContainerStyle={{ paddingBottom: layout.dockHeight, paddingRight: 0 }}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
      scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
    >
      {/* Header with Edit/Save toggle */}
      <View style={styles.detailHeader}>
        <Breadcrumb
          items={[
            { label: 'Categories', onPress: onBack },
            { label: editedName },
          ]}
        />

        {isEditing ? (
          <View style={styles.editActions}>
            <Pressable onPress={handleCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={styles.saveButton} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#60A5FA" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setIsEditing(true)
          }} style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        )}
      </View>

      {/* Header Card */}
      <View style={styles.headerCardContainer}>
        <View style={styles.headerCardGlass}>
          <View style={styles.headerCard}>
            <Pressable onPress={handleOpenImagePreview} disabled={uploadingImage}>
              {uploadingImage ? (
                <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : currentImageUrl ? (
                <Image source={{ uri: getThumbnailImage(currentImageUrl) || currentImageUrl }} style={styles.headerIcon} />
              ) : (
                <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
                  <Text style={styles.headerIconText}>
                    {(isEditing ? editedName : category.name).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </Pressable>
            <View style={styles.headerInfo}>
              {isEditing ? (
                <>
                  <TextInput
                    style={styles.headerTitleInput}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Category name"
                    placeholderTextColor="rgba(235,235,245,0.3)"
                  />
                  <TextInput
                    style={styles.headerSubtitleInput}
                    value={editedSlug}
                    onChangeText={setEditedSlug}
                    placeholder="Slug"
                    placeholderTextColor="rgba(235,235,245,0.3)"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.headerTitle}>{category.name}</Text>
                  <View style={styles.headerMeta}>
                    <Text style={styles.headerSubtitle}>{category.slug || 'No slug'}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>OVERVIEW</Text>
        <View style={styles.cardGlass}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{category.product_count || 0}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{fieldsCount}</Text>
              <Text style={styles.statLabel}>Fields</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{templatesCount}</Text>
              <Text style={styles.statLabel}>Templates</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Description Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DESCRIPTION</Text>
        <View style={styles.cardGlass}>
          {isEditing ? (
            <View style={styles.descriptionContainer}>
              <TextInput
                style={styles.descriptionInput}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Category description"
                placeholderTextColor="rgba(235,235,245,0.3)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          ) : (
            <View style={styles.descriptionContainer}>
              {category.description ? (
                <Text style={styles.descriptionText}>{category.description}</Text>
              ) : (
                <Text style={[styles.descriptionText, styles.descriptionEmpty]}>
                  No description
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Online Visibility Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ONLINE VISIBILITY</Text>
        <View style={styles.cardGlass}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Publish Online</Text>
              <Text style={styles.visibilityDescription}>
                {editedIsActive
                  ? 'Category is visible on your online storefront'
                  : 'Category is hidden from your online storefront'}
              </Text>
            </View>
            <Switch
              value={editedIsActive}
              onValueChange={(value) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setEditedIsActive(value)
              }}
              disabled={!isEditing || saving}
              trackColor={{ false: 'rgba(120,120,128,0.32)', true: '#60A5FA' }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(120,120,128,0.32)"
            />
          </View>
        </View>
      </View>

      {/* Pricing Templates Section */}
      <EditablePricingTemplatesSection
        categoryId={category.id}
        isEditing={isEditing}
        onTemplatesUpdated={handlePricingTemplatesUpdated}
      />

      {/* Custom Fields Section */}
      <EditableCustomFieldsSection
        categoryId={category.id}
        isEditing={isEditing}
        onFieldsUpdated={onCategoryUpdated}
      />

      {/* Variant Templates Section */}
      <EditableVariantTemplatesSection
        ref={variantSectionRef}
        categoryId={category.id}
        isEditing={isEditing}
        onTemplatesUpdated={onCategoryUpdated}
      />

      {/* Actions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIONS</Text>
        <View style={styles.cardGlass}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>View Products</Text>
            <Text style={styles.rowChevron}>􀆊</Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>Manage Subcategories</Text>
            <Text style={styles.rowChevron}>􀆊</Text>
          </View>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DANGER ZONE</Text>
        <View style={styles.cardGlass}>
          <Pressable
            style={[styles.row, styles.rowLast]}
            onPress={handleDeleteCategory}
            disabled={isEditing}
          >
            <Text style={[styles.rowLabel, styles.destructiveText]}>Delete Category</Text>
            <Text style={styles.rowChevron}>􀆊</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>

    {/* Image Preview Modal */}
    <ImagePreviewModal
      visible={showImagePreview}
      imageUrl={currentImageUrl || ''}
      onClose={() => setShowImagePreview(false)}
      onChangePhoto={handleChangePhoto}
      onTakePhoto={handleTakePhoto}
      onRemovePhoto={currentImageUrl ? handleRemovePhoto : undefined}
    />

    {/* Media Picker Modal */}
    <MediaPickerModal
      visible={showMediaPicker}
      onClose={() => setShowMediaPicker(false)}
      onSelect={handleSelectImage}
    />
  </>
  )
}

function SettingsRow({
  label,
  value,
  showChevron = true,
  onPress,
}: {
  label: string
  value?: string
  showChevron?: boolean
  onPress?: () => void
}) {
  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPress()
    }
  }

  return (
    <Pressable style={styles.row} onPress={handlePress} disabled={!onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {showChevron && <Text style={styles.rowChevron}>􀆊</Text>}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  detail: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.containerMargin,
    paddingVertical: layout.containerMargin,
  },
  editButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  saveButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.glass.thick,
    borderWidth: 1,
    borderColor: colors.border.emphasis,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  headerCardContainer: {
    marginHorizontal: layout.containerMargin,
    marginTop: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  headerCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCardGlassFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.containerMargin,
    gap: layout.containerMargin,
  },
  headerIcon: {
    width: 100,
    height: 100,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 44,
    color: 'rgba(235,235,245,0.6)',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerTitleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  headerSubtitleInput: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.9)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardGlassFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.containerMargin,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 0.5,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  descriptionContainer: {
    padding: layout.containerMargin,
  },
  descriptionText: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    lineHeight: 22,
  },
  descriptionEmpty: {
    fontStyle: 'italic',
  },
  descriptionInput: {
    fontSize: 15,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
    minHeight: 100,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.containerMargin,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  rowChevron: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.3)',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  destructiveText: {
    color: '#ff3b30',
  },
  visibilityDescription: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    marginTop: 4,
  },
})
