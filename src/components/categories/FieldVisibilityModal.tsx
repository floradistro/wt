/**
 * FieldVisibilityModal Component
 * Configure field visibility across 4 contexts
 * Apple Engineering: Clean toggles, clear descriptions
 */

import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { layout } from '@/theme/layout'
import type { FieldVisibilityConfig } from '@/hooks/useCategories'

interface VisibilityContext {
  key: keyof FieldVisibilityConfig
  icon: string
  label: string
  description: string
}

const CONTEXTS: VisibilityContext[] = [
  {
    key: 'shop',
    icon: '􀎭',
    label: 'Shop Page',
    description: 'Product cards in grid view',
  },
  {
    key: 'product_page',
    icon: '􀉆',
    label: 'Product Page',
    description: 'Individual product pages',
  },
  {
    key: 'pos',
    icon: '􀢌',
    label: 'POS System',
    description: 'Point of sale interface',
  },
  {
    key: 'tv_menu',
    icon: '􀡴',
    label: 'TV Menu',
    description: 'Digital signage displays',
  },
]

interface FieldVisibilityModalProps {
  visible: boolean
  fieldSlug: string
  fieldLabel: string
  categoryId: string
  initialConfig: FieldVisibilityConfig
  onClose: () => void
  onSaved: () => void
}

export function FieldVisibilityModal({
  visible,
  fieldSlug,
  fieldLabel,
  categoryId,
  initialConfig,
  onClose,
  onSaved,
}: FieldVisibilityModalProps) {
  const [config, setConfig] = useState<FieldVisibilityConfig>(initialConfig)
  const [saving, setSaving] = useState(false)

  const toggleContext = (key: keyof FieldVisibilityConfig) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setConfig(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Update category field_visibility JSONB
      const { data: category, error: fetchError } = await supabase
        .from('categories')
        .select('field_visibility')
        .eq('id', categoryId)
        .single()

      if (fetchError) throw fetchError

      const updatedVisibility = {
        ...(category.field_visibility || {}),
        [fieldSlug]: config,
      }

      const { error } = await supabase
        .from('categories')
        .update({
          field_visibility: updatedVisibility,
          updated_at: new Date().toISOString(),
        })
        .eq('id', categoryId)

      if (error) throw error

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onSaved()
      onClose()
    } catch (error) {
      logger.error('Failed to save field visibility', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.background, !isLiquidGlassSupported && styles.backgroundFallback]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Field Visibility</Text>
              <Text style={styles.headerSubtitle}>{fieldLabel}</Text>
            </View>
            <Pressable onPress={handleSave} style={styles.headerButton} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#60A5FA" />
              ) : (
                <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary]}>Save</Text>
              )}
            </Pressable>
          </View>

          {/* Context Toggles */}
          <View style={styles.content}>
            {CONTEXTS.map((context, index) => {
              const isEnabled = config[context.key]
              const isLast = index === CONTEXTS.length - 1

              return (
                <Pressable
                  key={context.key}
                  style={[styles.contextRow, isLast && styles.contextRowLast]}
                  onPress={() => toggleContext(context.key)}
                >
                  <Text style={[styles.contextIcon, isEnabled && styles.contextIconActive]}>
                    {context.icon}
                  </Text>
                  <View style={styles.contextInfo}>
                    <Text style={styles.contextLabel}>{context.label}</Text>
                    <Text style={styles.contextDescription}>{context.description}</Text>
                  </View>
                  <View style={[styles.toggle, isEnabled && styles.toggleActive]}>
                    {isEnabled && <View style={styles.toggleThumb} />}
                  </View>
                </Pressable>
              )
            })}
          </View>

          {/* Info Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Hidden fields preserve their data. They just won't be displayed in the selected context.
            </Text>
          </View>
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
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    marginTop: 2,
  },
  content: {
    marginTop: 24,
    marginHorizontal: layout.contentHorizontal,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  contextRowLast: {
    borderBottomWidth: 0,
  },
  contextIcon: {
    fontSize: 28,
    color: 'rgba(235,235,245,0.3)',
    marginRight: 16,
    width: 32,
    textAlign: 'center',
  },
  contextIconActive: {
    color: '#34c759',
  },
  contextInfo: {
    flex: 1,
  },
  contextLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  contextDescription: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#34c759',
    alignItems: 'flex-end',
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: '#fff',
  },
  footer: {
    marginTop: 32,
    marginHorizontal: layout.contentHorizontal,
    padding: layout.cardPadding,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: layout.cardRadius,
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    lineHeight: 18,
    textAlign: 'center',
  },
})
