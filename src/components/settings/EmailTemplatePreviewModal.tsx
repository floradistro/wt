/**
 * EmailTemplatePreviewModal - Preview email templates via WebView
 * Fetches rendered HTML from edge function and displays in WebView
 */

import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'
import { colors, typography, spacing } from '@/theme/tokens'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uaednwpxursknmwdeejn.supabase.co'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

// Template slug to display name mapping
const TEMPLATE_NAMES: Record<string, string> = {
  receipt: 'Receipt',
  order_confirmation: 'Order Confirmation',
  order_ready: 'Order Ready for Pickup',
  order_shipped: 'Order Shipped',
  order_status_update: 'Order Status Update',
  welcome: 'Welcome Email',
  password_reset: 'Password Reset',
  loyalty_update: 'Loyalty Points Update',
  back_in_stock: 'Back in Stock',
}

interface EmailTemplatePreviewModalProps {
  visible: boolean
  templateSlug: string | null
  vendorId: string
  onClose: () => void
}

export function EmailTemplatePreviewModal({
  visible,
  templateSlug,
  vendorId,
  onClose,
}: EmailTemplatePreviewModalProps) {
  const insets = useSafeAreaInsets()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)

  // Fetch HTML content when modal opens
  useEffect(() => {
    if (visible && templateSlug) {
      setIsLoading(true)
      setError(null)
      setHtmlContent(null)

      fetchTemplateHtml(templateSlug, vendorId)
        .then((html) => {
          setHtmlContent(html)
          setIsLoading(false)
        })
        .catch((err) => {
          console.error('[EmailTemplatePreview] Error:', err)
          setError(err.message || 'Failed to load template')
          setIsLoading(false)
        })
    }
  }, [visible, templateSlug, vendorId])

  const fetchTemplateHtml = async (template: string, vendor: string): Promise<string> => {
    const url = `${SUPABASE_URL}/functions/v1/send-email?template=${template}&vendorId=${vendor}`

    console.log('[EmailTemplatePreview] Fetching:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[EmailTemplatePreview] Response error:', response.status, errorText)
      throw new Error(`Failed to load template (${response.status})`)
    }

    const html = await response.text()
    console.log('[EmailTemplatePreview] Got HTML, length:', html.length)

    // Wrap HTML with dark background so overscroll areas match our UI
    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background-color: #1c1c1e;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `
    return wrappedHtml
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  if (!visible || !templateSlug) return null

  const templateName = TEMPLATE_NAMES[templateSlug] || templateSlug

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>EMAIL TEMPLATE PREVIEW</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{templateName}</Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Preview Content */}
        <View style={styles.content}>
          {/* Loading Indicator */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.text.tertiary} />
              <Text style={styles.loadingText}>Loading preview...</Text>
            </View>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color={colors.semantic.error} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={handleClose} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Close</Text>
              </Pressable>
            </View>
          )}

          {/* WebView with HTML content */}
          {htmlContent && !error && (
            <WebView
              source={{ html: htmlContent }}
              style={styles.webview}
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
              javaScriptEnabled={false}
              originWhitelist={['*']}
            />
          )}
        </View>

        {/* Footer Info */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.footerInfo}>
            <Ionicons name="information-circle-outline" size={16} color="rgba(235,235,245,0.4)" />
            <Text style={styles.footerText}>
              This is a preview with sample data. Actual emails will use real customer and order information.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  webview: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: '#1c1c1e',
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.glass.regular,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  retryButtonText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(235,235,245,0.4)',
    lineHeight: 16,
  },
})
