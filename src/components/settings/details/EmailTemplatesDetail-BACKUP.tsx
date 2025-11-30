/**
 * EmailTemplatesDetail - Email template management
 * Allows viewing, editing, and previewing email templates
 */

import { View, Text, StyleSheet, ScrollView, Animated, Pressable, ActivityIndicator, TextInput, Alert, useWindowDimensions } from 'react-native'
import { useState, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import RenderHTML from 'react-native-render-html'
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
// HTML PREVIEW RENDERER
// Uses react-native-render-html for proper rendering
// ============================================

function parseHtmlToNodes(html: string): HtmlNode[] {
  const nodes: HtmlNode[] = []

  // Remove DOCTYPE, comments, and clean up
  let cleaned = html
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')

  // Extract body content if present
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) {
    cleaned = bodyMatch[1]
  }

  // Simple regex-based parser (handles most email template structures)
  const tagRegex = /<(\/?)([\w-]+)([^>]*)>|([^<]+)/g
  const stack: HtmlNode[][] = [nodes]
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(cleaned)) !== null) {
    const [, isClosing, tag, attrs, text] = match

    if (text && text.trim()) {
      // Text node - decode all HTML entities
      const currentParent = stack[stack.length - 1]
      let decoded = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&copy;/g, '©')
        .replace(/&reg;/g, '®')
        .replace(/&trade;/g, '™')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&bull;/g, '•')
        .replace(/&hellip;/g, '…')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
        .trim()

      if (decoded) {
        currentParent.push({
          type: 'text',
          content: decoded
        })
      }
    } else if (tag) {
      const tagLower = tag.toLowerCase()

      if (isClosing) {
        // Closing tag
        if (stack.length > 1) {
          stack.pop()
        }
      } else {
        // Opening tag
        const node: HtmlNode = {
          type: 'element',
          tag: tagLower,
          children: [],
        }

        // Parse attributes
        const styleMatch = attrs?.match(/style\s*=\s*["']([^"']*)["']/i)
        if (styleMatch) {
          node.style = parseInlineStyle(styleMatch[1])
        }

        const srcMatch = attrs?.match(/src\s*=\s*["']([^"']*)["']/i)
        if (srcMatch) {
          node.src = srcMatch[1]
        }

        const hrefMatch = attrs?.match(/href\s*=\s*["']([^"']*)["']/i)
        if (hrefMatch) {
          node.href = hrefMatch[1]
        }

        const altMatch = attrs?.match(/alt\s*=\s*["']([^"']*)["']/i)
        if (altMatch) {
          node.alt = altMatch[1]
        }

        const currentParent = stack[stack.length - 1]
        currentParent.push(node)

        // Self-closing tags
        const selfClosing = ['br', 'hr', 'img', 'meta', 'link', 'input']
        if (!selfClosing.includes(tagLower) && !attrs?.includes('/>')) {
          stack.push(node.children!)
        }
      }
    }
  }

  return nodes
}

interface NativeHtmlPreviewProps {
  html: string
}

function NativeHtmlPreview({ html }: NativeHtmlPreviewProps) {
  const { width } = useWindowDimensions()

  const nodes = useMemo(() => parseHtmlToNodes(html), [html])

  // Helper to convert CSS styles to RN styles
  const cssToRnStyle = (style: Record<string, string>): Record<string, unknown> => {
    const rnStyle: Record<string, unknown> = {}
    if (style.color) rnStyle.color = style.color
    if (style.backgroundColor) rnStyle.backgroundColor = style.backgroundColor
    if (style.fontSize) rnStyle.fontSize = parseInt(style.fontSize)
    if (style.fontWeight) rnStyle.fontWeight = style.fontWeight as '400' | '700' | 'bold' | 'normal'
    if (style.textAlign) rnStyle.textAlign = style.textAlign as 'left' | 'center' | 'right'
    if (style.padding) rnStyle.padding = parseInt(style.padding)
    if (style.paddingTop) rnStyle.paddingTop = parseInt(style.paddingTop)
    if (style.paddingBottom) rnStyle.paddingBottom = parseInt(style.paddingBottom)
    if (style.paddingLeft) rnStyle.paddingLeft = parseInt(style.paddingLeft)
    if (style.paddingRight) rnStyle.paddingRight = parseInt(style.paddingRight)
    if (style.margin) rnStyle.margin = parseInt(style.margin)
    if (style.marginTop) rnStyle.marginTop = parseInt(style.marginTop)
    if (style.marginBottom) rnStyle.marginBottom = parseInt(style.marginBottom)
    if (style.borderRadius) rnStyle.borderRadius = parseInt(style.borderRadius)
    if (style.maxWidth) rnStyle.maxWidth = parseInt(style.maxWidth)
    if (style.width && style.width !== '100%') rnStyle.width = parseInt(style.width)
    if (style.lineHeight) rnStyle.lineHeight = parseInt(style.lineHeight)
    return rnStyle
  }

  // Check if a node should be rendered as text (inline element)
  const isTextNode = (node: HtmlNode): boolean => {
    if (node.type === 'text') return true
    const inlineTags = ['span', 'strong', 'b', 'em', 'i', 'a', 'br', 'small', 'sub', 'sup']
    return inlineTags.includes(node.tag || '')
  }

  // Render text content (for inline rendering)
  const renderTextContent = (node: HtmlNode, key: string): React.ReactNode => {
    if (node.type === 'text') {
      return node.content || ''
    }

    if (node.tag === 'br') return '\n'

    const childContent = node.children?.map((child, i) => renderTextContent(child, `${key}-${i}`)) || []
    const style = cssToRnStyle(node.style || {})

    if (node.tag === 'strong' || node.tag === 'b') {
      return <Text key={key} style={[{ fontWeight: 'bold' }, style]}>{childContent}</Text>
    }
    if (node.tag === 'em' || node.tag === 'i') {
      return <Text key={key} style={[{ fontStyle: 'italic' }, style]}>{childContent}</Text>
    }
    if (node.tag === 'a') {
      return <Text key={key} style={[{ color: '#007AFF', textDecorationLine: 'underline' }, style]}>{childContent}</Text>
    }
    if (node.tag === 'span' || node.tag === 'small') {
      return <Text key={key} style={style}>{childContent}</Text>
    }

    return childContent
  }

  const renderNode = (node: HtmlNode, index: number, depth: number = 0): React.ReactNode => {
    if (node.type === 'text') {
      if (!node.content || !node.content.trim()) return null
      // Always wrap text in Text component when at top level
      return <Text key={`text-${index}-${depth}`} style={previewStyles.text}>{node.content}</Text>
    }

    const key = `${node.tag}-${index}-${depth}`
    const style = node.style || {}
    const rnStyle = cssToRnStyle(style)

    // Check if all children are inline/text
    const allChildrenInline = node.children?.every(c => isTextNode(c)) ?? true

    const renderChildren = (): React.ReactNode => {
      if (!node.children || node.children.length === 0) return null

      // If all children are inline, wrap in a single Text
      if (allChildrenInline && node.children.length > 0) {
        const textContent = node.children.map((child, i) => renderTextContent(child, `${key}-tc-${i}`))
        return <Text style={previewStyles.text}>{textContent}</Text>
      }

      // Mix of block and inline - render each appropriately
      return node.children.map((child, i) => {
        if (isTextNode(child)) {
          // Wrap inline content in Text
          return <Text key={`${key}-child-${i}`} style={previewStyles.text}>{renderTextContent(child, `${key}-child-${i}`)}</Text>
        }
        return renderNode(child, i, depth + 1)
      })
    }

    switch (node.tag) {
      case 'html':
      case 'body':
      case 'div':
      case 'table':
      case 'tbody':
      case 'thead':
      case 'tfoot':
      case 'tr':
      case 'center':
        return (
          <View key={key} style={[previewStyles.container, rnStyle]}>
            {renderChildren()}
          </View>
        )

      case 'td':
      case 'th':
        return (
          <View key={key} style={[previewStyles.tableCell, rnStyle]}>
            {renderChildren()}
          </View>
        )

      case 'h1': {
        const textContent = node.children?.map((child, i) => renderTextContent(child, `${key}-h1-${i}`)) || []
        return (
          <Text key={key} style={[previewStyles.h1, rnStyle]}>
            {textContent}
          </Text>
        )
      }

      case 'h2': {
        const textContent = node.children?.map((child, i) => renderTextContent(child, `${key}-h2-${i}`)) || []
        return (
          <Text key={key} style={[previewStyles.h2, rnStyle]}>
            {textContent}
          </Text>
        )
      }

      case 'h3': {
        const textContent = node.children?.map((child, i) => renderTextContent(child, `${key}-h3-${i}`)) || []
        return (
          <Text key={key} style={[previewStyles.h3, rnStyle]}>
            {textContent}
          </Text>
        )
      }

      case 'p': {
        const textContent = node.children?.map((child, i) => renderTextContent(child, `${key}-p-${i}`)) || []
        return (
          <Text key={key} style={[previewStyles.paragraph, rnStyle]}>
            {textContent}
          </Text>
        )
      }

      case 'span':
      case 'strong':
      case 'b':
      case 'em':
      case 'i':
      case 'a': {
        const textStyle = {
          ...(node.tag === 'strong' || node.tag === 'b' ? { fontWeight: 'bold' as const } : {}),
          ...(node.tag === 'em' || node.tag === 'i' ? { fontStyle: 'italic' as const } : {}),
          ...(node.tag === 'a' ? { color: '#007AFF', textDecorationLine: 'underline' as const } : {}),
          ...rnStyle
        }
        const textContent = node.children?.map((child, i) => renderTextContent(child, `${key}-inline-${i}`)) || []
        return (
          <Text key={key} style={[previewStyles.text, textStyle]}>
            {textContent}
          </Text>
        )
      }

      case 'img':
        if (!node.src || node.src === '' || node.src === 'about:blank') {
          // Skip empty images
          return null
        }
        const imgWidth = style.width ? parseInt(style.width) : width - 40
        const imgHeight = style.height ? parseInt(style.height) : 100
        return (
          <Image
            key={key}
            source={{ uri: node.src }}
            style={[
              previewStyles.image,
              { width: Math.min(imgWidth, width - 40), height: imgHeight },
              rnStyle
            ]}
            resizeMode="contain"
          />
        )

      case 'hr':
        return <View key={key} style={previewStyles.hr} />

      case 'br':
        return <Text key={key}>{'\n'}</Text>

      case 'ul':
      case 'ol':
        return (
          <View key={key} style={[previewStyles.list, rnStyle]}>
            {renderChildren()}
          </View>
        )

      case 'li': {
        const liContent = node.children?.map((child, i) => renderTextContent(child, `${key}-li-${i}`)) || []
        return (
          <View key={key} style={previewStyles.listItem}>
            <Text style={previewStyles.listBullet}>•</Text>
            <Text style={[previewStyles.listText, rnStyle]}>{liContent}</Text>
          </View>
        )
      }

      default:
        // Render unknown tags as Views
        if (node.children && node.children.length > 0) {
          return (
            <View key={key} style={rnStyle}>
              {renderChildren()}
            </View>
          )
        }
        return null
    }
  }

  if (!html || !html.trim()) {
    return (
      <View style={previewStyles.emptyPreview}>
        <Ionicons name="mail-outline" size={48} color="#86868b" />
        <Text style={previewStyles.emptyText}>No preview available</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={previewStyles.scrollView}
      contentContainerStyle={previewStyles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      <View style={previewStyles.emailContainer}>
        {nodes.map((node, index) => renderNode(node, index))}
      </View>
    </ScrollView>
  )
}

const previewStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: layout.dockHeight,
  },
  emailContainer: {
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    overflow: 'hidden',
  },
  container: {
    marginVertical: 2,
  },
  tableCell: {
    padding: 4,
  },
  h1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1d1d1f',
    marginVertical: 12,
  },
  h2: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1d1d1f',
    marginVertical: 10,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1d1d1f',
    marginVertical: 8,
  },
  paragraph: {
    fontSize: 15,
    color: '#3d3d3d',
    lineHeight: 22,
    marginVertical: 6,
  },
  text: {
    fontSize: 15,
    color: '#3d3d3d',
  },
  image: {
    borderRadius: 8,
    marginVertical: 8,
    alignSelf: 'center',
  },
  hr: {
    height: 1,
    backgroundColor: '#e5e5e7',
    marginVertical: 16,
  },
  list: {
    marginVertical: 8,
    paddingLeft: 8,
  },
  listItem: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  listBullet: {
    fontSize: 15,
    color: '#3d3d3d',
    marginRight: 8,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    color: '#3d3d3d',
    lineHeight: 22,
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
    setViewMode('edit')
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
  if (isLoading && templates.length === 0) {
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
          // Preview Mode - Render HTML using native components
          <View style={styles.previewContainer}>
            <NativeHtmlPreview html={previewHtml} />
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

  // List mode
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
                              onPress={() => handleSetDefault(template)}
                              style={styles.setDefaultButton}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editorHint: {
    ...typography.caption1,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  subjectInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.glass.thin,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  htmlInput: {
    ...typography.body,
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.text.primary,
    backgroundColor: colors.glass.thin,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 400,
  },

  // Variables
  variablesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  variableChip: {
    backgroundColor: colors.glass.regular,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  variableText: {
    fontFamily: 'monospace',
    fontSize: 12,
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
    paddingVertical: spacing.xxl,
    paddingHorizontal: layout.contentHorizontal,
  },
  emptyStateText: {
    ...typography.headline,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  emptyStateSubtext: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
})
