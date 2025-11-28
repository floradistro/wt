/**
 * CategoryModal Component
 *
 * STANDARD MODAL PATTERN ✅
 * This is the GOLD STANDARD for all modals in the app
 *
 * Pattern: Full-screen slide-up sheet with pill-shaped inputs
 * Reference: Based on POSUnifiedCustomerSelector
 *
 * When creating new modals, copy this structure exactly!
 */

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native'
import { useState, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { logger } from '@/utils/logger'
import { useProductsScreenStore, productsScreenActions } from '@/stores/products-list.store'

/**
 * CategoryModal - ZERO PROPS ✅
 * Full-screen sheet - EXACT match to customer selector
 */
export function CategoryModal() {
  const insets = useSafeAreaInsets()

  // ========================================
  // STORES - TRUE ZERO PROPS
  // ========================================
  const { user } = useAppAuth()
  const showModal = useProductsScreenStore((state) => state.showCreateCategory)

  // ========================================
  // LOCAL STATE (for form)
  // ========================================
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset on open/close
  useEffect(() => {
    if (showModal) {
      setName('')
      setDescription('')
    }
  }, [showModal])

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

      const { error: createError } = await supabase
        .from('categories')
        .insert({
          name: name.trim(),
          slug,
          description: description.trim() || null,
          parent_id: null,
          vendor_id: userData.vendor_id,
        })

      if (createError) throw createError

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      productsScreenActions.closeAllModals()
    } catch (err) {
      logger.error('Failed to create category', { error: err })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productsScreenActions.closeAllModals()
  }

  if (!showModal) return null

  return (
    <Modal
      visible={showModal}
      animationType="slide" // Slides up from bottom
      presentationStyle="fullScreen" // Full screen, not half
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* ===== HEADER ===== */}
        {/* Standard pattern: Search input + Done button */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={name}
              onChangeText={setName}
              placeholder="Category name"
              placeholderTextColor="rgba(235,235,245,0.3)"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>
          <Pressable onPress={handleClose} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>

        {/* ===== CONTENT ===== */}
        {/* Scrollable content area */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Description Section (optional field) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <View style={styles.descriptionCard}>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description for this category"
                placeholderTextColor="rgba(235,235,245,0.3)"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* ===== ACTION BUTTON ===== */}
          {/* Standard pattern: "+ ACTION NAME" */}
          <Pressable
            onPress={handleSave}
            style={[styles.addButton, (!name.trim() || saving) && styles.addButtonDisabled]}
            disabled={!name.trim() || saving}
          >
            <Text style={styles.addButtonText}>
              {saving ? 'CREATING...' : '+ CREATE CATEGORY'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 24, // PILL SHAPED
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
  },
  doneButton: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24, // PILL SHAPED
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.08,
    marginBottom: 12,
    marginLeft: 4,
  },
  descriptionCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20, // PILL SHAPED
    padding: 16,
  },
  descriptionInput: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.2,
    minHeight: 80,
  },
  addButton: {
    marginTop: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24, // PILL SHAPED
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
})
