/**
 * CategoryModal Component
 * Add/Edit category with parent selection
 * Apple Engineering: Modal presentation, validation, <300 lines
 */

import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'
import { layout } from '@/theme/layout'
import type { Category } from '@/hooks/useCategories'

interface CategoryModalProps {
  visible: boolean
  category?: Category | null // If provided, edit mode
  categories: Category[] // For parent selection
  onClose: () => void
  onSaved: () => void
}

export function CategoryModal({
  visible,
  category,
  categories,
  onClose,
  onSaved,
}: CategoryModalProps) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isEditMode = !!category

  // Load category data when editing
  useEffect(() => {
    if (category) {
      setName(category.name)
      setDescription(category.description || '')
      setParentId(category.parent_id)
    } else {
      setName('')
      setDescription('')
      setParentId(null)
    }
  }, [category])

  const handleSave = async () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user!.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      if (isEditMode) {
        // Update existing
        const { error } = await supabase
          .from('categories')
          .update({
            name,
            slug,
            description: description || null,
            parent_id: parentId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', category.id)
          .eq('vendor_id', userData.vendor_id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('categories')
          .insert({
            name,
            slug,
            description: description || null,
            parent_id: parentId,
            vendor_id: userData.vendor_id,
          })

        if (error) throw error
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onSaved()
      onClose()
    } catch (error) {
      logger.error('Failed to save category', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  // Get available parent categories (excluding self and children in edit mode)
  const availableParents = (categories || []).filter(c => {
    if (!isEditMode) return true
    // Can't select self or own children as parent
    return c.id !== category.id && c.parent_id !== category.id
  })

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.container}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.background, !isLiquidGlassSupported && styles.backgroundFallback]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleCancel} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Edit Category' : 'New Category'}
            </Text>
            <Pressable onPress={handleSave} style={styles.headerButton} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#60A5FA" />
              ) : (
                <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary]}>
                  {isEditMode ? 'Save' : 'Create'}
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            scrollIndicatorInsets={{ right: 2 }}
          >
            {/* Name Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Category Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Flower, Edibles, Concentrates"
                placeholderTextColor="rgba(235,235,245,0.3)"
                autoFocus
              />
            </View>

            {/* Description Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor="rgba(235,235,245,0.3)"
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Parent Category Selector */}
            <View style={styles.section}>
              <Text style={styles.label}>Parent Category</Text>
              <View style={styles.parentList}>
                <Pressable
                  style={[styles.parentOption, !parentId && styles.parentOptionActive]}
                  onPress={() => setParentId(null)}
                >
                  <Text style={[styles.parentOptionText, !parentId && styles.parentOptionTextActive]}>
                    None (Top Level)
                  </Text>
                  {!parentId && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
                {availableParents.map(cat => (
                  <Pressable
                    key={cat.id}
                    style={[styles.parentOption, parentId === cat.id && styles.parentOptionActive]}
                    onPress={() => setParentId(cat.id)}
                  >
                    <Text style={[styles.parentOptionText, parentId === cat.id && styles.parentOptionTextActive]}>
                      {cat.name}
                    </Text>
                    {parentId === cat.id && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        </LiquidGlassView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    flex: 1,
  },
  backgroundFallback: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.contentHorizontal,
    paddingVertical: layout.cardPadding,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 17,
    color: 'rgba(235,235,245,0.6)',
  },
  headerButtonTextPrimary: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.contentHorizontal,
  },
  section: {
    marginTop: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.7)',
    marginBottom: 8,
  },
  input: {
    fontSize: 17,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  parentList: {
    gap: 8,
  },
  parentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  parentOptionActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  parentOptionText: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.7)',
  },
  parentOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#60A5FA',
    fontWeight: '700',
  },
})
