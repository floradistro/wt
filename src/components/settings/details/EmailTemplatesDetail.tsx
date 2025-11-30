/**
 * EmailTemplatesDetail - Email template management
 * Allows viewing, editing, and previewing email templates
 */

import { View, Text, StyleSheet, ScrollView, Animated, Pressable, ActivityIndicator, TextInput, Alert } from 'react-native'
import { useState, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { TitleSection } from '@/components/shared'
import { useEmailTemplatesStore } from '@/stores/email-templates.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { EmailTemplate } from '@/services/email-template.service'

interface EmailTemplatesDetailProps {
  headerOpacity: Animated.Value
  vendorLogo?: string | null
  onBack?: () => void
}

type ViewMode = 'list' | 'edit' | 'preview'

const CATEGORY_LABELS: Record<string, string> = {
  receipt: 'Receipt',
  order_confirmation: 'Order Confirmation',
  order_update: 'Order Updates',
  welcome: 'Welcome',
  loyalty: 'Loyalty',
  marketing: 'Marketing',
}

// ============================================
// SIMPLE TEXT PREVIEW - Dark iOS Theme
// ============================================

interface HtmlPreviewProps {
  html: string
}

function HtmlPreview({ html }: HtmlPreviewProps) {
  if (!html || !html.trim()) {
    return (
      <View style={previewStyles.emptyPreview}>
        <Ionicons name="mail-outline" size={48} color="#86868b" />
        <Text style={previewStyles.emptyText}>No template content</Text>
      </View>
    )
  }

  // Strip HTML tags for simple text preview
  const stripHtml = (htmlString: string) => {
    return htmlString
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }

  const plainText = stripHtml(html)

  return (
    <ScrollView
      style={previewStyles.scrollView}
      contentContainerStyle={previewStyles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      <Text style={previewStyles.previewText}>{plainText}</Text>
    </ScrollView>
  )
}

const previewStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: layout.dockHeight,
  },
  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  emptyText: {
    fontSize: 15,
    color: '#86868b',
    marginTop: 12,
  },
  previewText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text.primary,
  },
})

export function EmailTemplatesDetail({ headerOpacity, vendorLogo, onBack }: EmailTemplatesDetailProps) {
  const { vendorId, user, vendor } = useAppAuth()
  const {
    templates,
    selectedTemplate,
    isLoading,
    isSaving,
    error,
    previewHtml,
    loadTemplates,
    selectTemplate,
    updateTemplate,
    setAsDefault,
  } = useEmailTemplatesStore()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editedHtml, setEditedHtml] = useState('')
  const [editedSubject, setEditedSubject] = useState('')

  // Load templates on mount
  useEffect(() => {
    console.log('📧 EmailTemplatesDetail: vendorId =', vendorId)
    if (vendorId) {
      console.log('📧 EmailTemplatesDetail: Loading templates for vendor', vendorId)
      loadTemplates(vendorId)
    } else {
      console.log('⚠️ EmailTemplatesDetail: No vendorId!')
    }
  }, [vendorId])

  // Update edited content when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setEditedHtml(selectedTemplate.html_content)
      setEditedSubject(selectedTemplate.subject)
    }
  }, [selectedTemplate])

  const handleSelectTemplate = (template: EmailTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    selectTemplate(template)
    setViewMode('preview') // Start in preview mode
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (viewMode === 'edit' || viewMode === 'preview') {
      setViewMode('list')
      selectTemplate(null)
    } else if (onBack) {
      onBack()
    }
  }

  const handleSave = async () => {
    if (!selectedTemplate) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const success = await updateTemplate(
      selectedTemplate.id,
      {
        html_content: editedHtml,
        subject: editedSubject,
      },
      user?.id
    )

    if (success) {
      Alert.alert('Saved', 'Template updated successfully')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      Alert.alert('Error', error || 'Failed to save template')
    }
  }

  const handleSetDefault = async (template: EmailTemplate) => {
    if (!vendorId) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const success = await setAsDefault(template.id, vendorId)

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      Alert.alert('Error', error || 'Failed to set as default')
    }
  }

  const handleTogglePreview = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setViewMode(viewMode === 'preview' ? 'edit' : 'preview')
  }

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(template)
    return acc
  }, {} as Record<string, EmailTemplate[]>)

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.detailContainer}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text.primary} />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      </View>
    )
  }

  // Edit/Preview mode
  if ((viewMode === 'edit' || viewMode === 'preview') && selectedTemplate) {
    return (
      <View style={styles.detailContainer}>
        {/* Header */}
        <View style={styles.editorHeader}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{selectedTemplate.name}</Text>
            <Text style={styles.headerSubtitle}>
              {CATEGORY_LABELS[selectedTemplate.category || ''] || selectedTemplate.category}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleTogglePreview}
              style={[styles.headerButton, viewMode === 'preview' && styles.headerButtonActive]}
            >
              <Ionicons
                name={viewMode === 'preview' ? 'code-slash' : 'eye'}
                size={20}
                color={viewMode === 'preview' ? colors.text.primary : colors.text.secondary}
              />
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.text.primary} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>

        {viewMode === 'preview' ? (
          // Preview Mode - Render HTML using react-native-render-html
          <View style={styles.previewContainer}>
            <HtmlPreview html={previewHtml} />
          </View>
        ) : (
          // Edit Mode
          <ScrollView
            style={styles.detailScroll}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            contentContainerStyle={{ paddingBottom: layout.dockHeight }}
          >
            {/* Subject */}
            <View style={styles.editorSection}>
              <Text style={styles.editorLabel}>Subject Line</Text>
              <TextInput
                style={styles.subjectInput}
                value={editedSubject}
                onChangeText={setEditedSubject}
                placeholder="Email subject..."
                placeholderTextColor={colors.text.tertiary}
              />
              <Text style={styles.editorHint}>
                Use {'{{variable}}'} for dynamic content
              </Text>
            </View>

            {/* HTML Content */}
            <View style={styles.editorSection}>
              <Text style={styles.editorLabel}>HTML Template</Text>
              <TextInput
                style={styles.htmlInput}
                value={editedHtml}
                onChangeText={setEditedHtml}
                placeholder="HTML content..."
                placeholderTextColor={colors.text.tertiary}
                multiline
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Variables Reference */}
            <View style={styles.editorSection}>
              <Text style={styles.editorLabel}>Available Variables</Text>
              <View style={styles.variablesContainer}>
                {selectedTemplate.variables.map((variable) => (
                  <View key={variable} style={styles.variableChip}>
                    <Text style={styles.variableText}>{`{{${variable}}}`}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.editorHint}>
                Use {'{{#if variable}}...{{/if}}'} for conditionals{'\n'}
                Use {'{{#each items}}...{{/each}}'} for loops
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    )
  }

  // List mode - Continue with your existing list code...
  return (
    <View style={styles.detailContainer}>
      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: layout.dockHeight }}
      >
        <TitleSection
          title="Email Templates"
          logo={vendorLogo}
          subtitle={`${templates.length} templates`}
          showBackButton={!!onBack}
          onBackPress={onBack}
        />

        {/* Templates by Category */}
        {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
          <View key={category}>
            <Text style={styles.cardSectionTitle}>
              {CATEGORY_LABELS[category]?.toUpperCase() || category.toUpperCase()}
            </Text>
            <View style={styles.cardWrapper}>
              <View style={styles.detailCard}>
                <View style={styles.cardInner}>
                  {categoryTemplates.map((template, index) => (
                    <View key={template.id}>
                      {index > 0 && <View style={styles.cardDivider} />}
                      <Pressable
                        onPress={() => handleSelectTemplate(template)}
                        style={styles.templateRow}
                      >
                        <View style={styles.templateInfo}>
                          <View style={styles.templateNameRow}>
                            <Text style={styles.templateName}>{template.name}</Text>
                            {template.is_default && (
                              <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>Default</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.templateSubject} numberOfLines={1}>
                            {template.subject}
                          </Text>
                        </View>
                        <View style={styles.templateActions}>
                          {!template.is_default && (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation()
                                handleSetDefault(template)
                              }}
                              style={styles.setDefaultButton}
                            >
                              <Text style={styles.setDefaultText}>Set Default</Text>
                            </Pressable>
                          )}
                          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        ))}

        {templates.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No templates found</Text>
            <Text style={styles.emptyStateSubtext}>
              Templates will be created automatically when you configure email settings
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  detailContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  detailScroll: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },

  // Card styles (matching other detail views)
  cardWrapper: {
    paddingHorizontal: layout.contentHorizontal,
    marginBottom: spacing.sm,
  },
  detailCard: {
    backgroundColor: colors.glass.thin,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  cardInner: {
    padding: spacing.md,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.sm,
  },
  cardSectionTitle: {
    ...typography.caption1,
    color: colors.text.tertiary,
    fontWeight: '600',
    letterSpacing: 1,
    paddingHorizontal: layout.contentHorizontal + spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Template list
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  templateInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  templateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  templateName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  templateSubject: {
    ...typography.footnote,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  defaultBadge: {
    backgroundColor: colors.semantic.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.semantic.success,
  },
  setDefaultButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.glass.regular,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  setDefaultText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  // Editor
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.glass.thin,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  headerTitle: {
    ...typography.headline,
    color: colors.text.primary,
    fontWeight: '600',
  },
  headerSubtitle: {
    ...typography.caption1,
    color: colors.text.tertiary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.glass.thin,
  },
  headerButtonActive: {
    backgroundColor: colors.glass.thick,
  },
  saveButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.glass.thick,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.emphasis,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },

  // Editor sections
  editorSection: {
    paddingHorizontal: layout.contentHorizontal,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  editorLabel: {
    ...typography.footnote,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  subjectInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.glass.thin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  htmlInput: {
    ...typography.body,
    fontFamily: 'Courier',
    color: colors.text.primary,
    backgroundColor: colors.glass.thin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
    minHeight: 300,
  },
  editorHint: {
    ...typography.caption2,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  variablesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  variableChip: {
    backgroundColor: colors.glass.regular,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  variableText: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: colors.text.secondary,
  },

  // Preview
  previewContainer: {
    flex: 1,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyStateText: {
    ...typography.headline,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  emptyStateSubtext: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
})
