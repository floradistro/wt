/**
 * CategoryDetail Component
 * Full detail view for a category with inline editing
 * Matches the products detail pattern exactly
 */

import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { useAuth } from '@/stores/auth.store'
import type { Category } from '@/hooks/useCategories'
import { EditablePricingTemplatesSection } from './EditablePricingTemplatesSection'
import { EditableCustomFieldsSection } from './EditableCustomFieldsSection'

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

  // Edit state
  const [editedName, setEditedName] = useState(category.name)
  const [editedDescription, setEditedDescription] = useState(category.description || '')
  const [editedSlug, setEditedSlug] = useState(category.slug || '')

  const handleSave = async () => {
    if (!user?.email) return

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError

      const { error: updateError } = await supabase
        .from('categories')
        .update({
          name: editedName,
          description: editedDescription,
          slug: editedSlug,
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
    setIsEditing(false)
  }

  return (
    <ScrollView
      style={styles.detail}
      contentContainerStyle={{ paddingBottom: layout.dockHeight }}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
    >
      {/* Header with Edit/Save toggle */}
      <View style={styles.detailHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Categories</Text>
        </Pressable>

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
            <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
              <Text style={styles.headerIconText}>
                {(isEditing ? editedName : category.name).charAt(0).toUpperCase()}
              </Text>
            </View>
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

      {/* Pricing Templates Section */}
      <EditablePricingTemplatesSection
        categoryId={category.id}
        isEditing={isEditing}
        onTemplatesUpdated={onCategoryUpdated}
      />

      {/* Custom Fields Section */}
      <EditableCustomFieldsSection
        categoryId={category.id}
        isEditing={isEditing}
        onFieldsUpdated={onCategoryUpdated}
      />

      {/* Actions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIONS</Text>
        <View style={styles.cardGlass}>
          <SettingsRow label="View Products" showChevron />
          <SettingsRow label="Manage Subcategories" showChevron />
          <SettingsRow label="Delete Category" showChevron={false} />
        </View>
      </View>
    </ScrollView>
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
    paddingHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    paddingVertical: layout.cardPadding,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  editButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  editActions: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  saveButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  headerCardContainer: {
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    marginTop: layout.sectionSpacing,
    marginBottom: layout.sectionSpacing,
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
    padding: layout.cardPadding,
    gap: layout.cardPadding,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 28,
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
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    marginBottom: layout.sectionSpacing,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: layout.cardPadding,
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
    paddingHorizontal: layout.rowPaddingHorizontal,
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
    padding: 16,
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
    borderRadius: 8,
    minHeight: 100,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    minHeight: layout.minTouchTarget,
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
})
