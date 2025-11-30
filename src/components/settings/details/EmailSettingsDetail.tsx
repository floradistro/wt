/**
 * EmailSettingsDetail - Email configuration and settings
 * Jobs Principle: Simple, focused email management
 */

import { View, Text, StyleSheet, ScrollView, Animated, Pressable, ActivityIndicator, Switch, TextInput, Alert, Image } from 'react-native'
import { useState, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { TitleSection } from '@/components/shared'
import { DetailRow } from './DetailRow'
import { detailCommonStyles } from './detailCommon.styles'
import { useEmailSettingsStore, EmailTestType } from '@/stores/email-settings.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { uploadProductImage } from '@/services/media.service'

interface EmailSettingsDetailProps {
  headerOpacity: Animated.Value
  vendorLogo?: string | null
  onNavigateToTemplates?: () => void
}

export function EmailSettingsDetail({ headerOpacity, vendorLogo, onNavigateToTemplates }: EmailSettingsDetailProps) {
  const { vendorId, user, vendor } = useAppAuth()
  const {
    settings,
    recentSends,
    isLoading,
    isSendingTest,
    testingEmailType,
    error,
    loadSettings,
    updateSettings,
    loadRecentSends,
    sendTestEmail,
  } = useEmailSettingsStore()

  const [isEditing, setIsEditing] = useState(false)
  const [testEmail, setTestEmail] = useState(user?.email || '')
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Form state
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [domain, setDomain] = useState('')
  const [emailHeaderImageUrl, setEmailHeaderImageUrl] = useState('')

  // Toggle states
  const [enableReceipts, setEnableReceipts] = useState(true)
  const [enableOrderConfirmations, setEnableOrderConfirmations] = useState(true)
  const [enableOrderUpdates, setEnableOrderUpdates] = useState(true)
  const [enableLoyaltyUpdates, setEnableLoyaltyUpdates] = useState(true)
  const [enableWelcomeEmails, setEnableWelcomeEmails] = useState(true)
  const [enableMarketing, setEnableMarketing] = useState(true)

  // Load settings on mount
  useEffect(() => {
    if (vendorId) {
      console.log('📧 EmailSettings: vendorId =', vendorId)
      console.log('📧 EmailSettings: user =', user)
      loadSettings(vendorId)
      loadRecentSends(vendorId, 10)
    } else {
      console.log('⚠️ EmailSettings: No vendorId found!')
    }
  }, [vendorId])

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setFromName(settings.from_name)
      setFromEmail(settings.from_email)
      setReplyTo(settings.reply_to || '')
      setDomain(settings.domain)
      setEmailHeaderImageUrl(settings.email_header_image_url || '')
      setEnableReceipts(settings.enable_receipts)
      setEnableOrderConfirmations(settings.enable_order_confirmations)
      setEnableOrderUpdates(settings.enable_order_updates)
      setEnableLoyaltyUpdates(settings.enable_loyalty_updates)
      setEnableWelcomeEmails(settings.enable_welcome_emails)
      setEnableMarketing(settings.enable_marketing)
    }
  }, [settings])

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsEditing(true)
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsEditing(false)
    // Reset form
    if (settings) {
      setFromName(settings.from_name)
      setFromEmail(settings.from_email)
      setReplyTo(settings.reply_to || '')
      setDomain(settings.domain)
    }
  }

  const handleSave = async () => {
    if (!vendorId || !user?.id) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const success = await updateSettings(
      vendorId,
      {
        from_name: fromName,
        from_email: fromEmail,
        reply_to: replyTo || undefined,
        domain,
        email_header_image_url: emailHeaderImageUrl || undefined,
        enable_receipts: enableReceipts,
        enable_order_confirmations: enableOrderConfirmations,
        enable_order_updates: enableOrderUpdates,
        enable_loyalty_updates: enableLoyaltyUpdates,
        enable_welcome_emails: enableWelcomeEmails,
        enable_marketing: enableMarketing,
      },
      user.id
    )

    if (success) {
      setIsEditing(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      Alert.alert('Error', error || 'Failed to save email settings')
    }
  }

  const handleSendTest = async (emailType?: EmailTestType) => {
    if (!vendorId || !testEmail) {
      Alert.alert('Email Required', 'Please enter a test email address in the Testing section below.')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const success = await sendTestEmail(vendorId, testEmail, vendor?.store_name, vendor?.logo_url, emailType)

    if (success) {
      const typeLabel = emailType ? emailType.replace('_', ' ') : 'test'
      Alert.alert('Test Email Sent!', `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} email sent to ${testEmail}`)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      Alert.alert('Error', error || 'Failed to send test email')
    }
  }

  const handleUploadHeaderImage = async () => {
    if (!vendorId) return

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo library access to upload an image.')
        return
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 1],
        quality: 0.9,
      })

      if (result.canceled) return

      setIsUploadingImage(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      const asset = result.assets[0]

      // Upload using media service
      const uploadResult = await uploadProductImage({
        vendorId,
        uri: asset.uri,
        filename: `email-header-${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`,
      })

      setEmailHeaderImageUrl(uploadResult.url)
      setIsUploadingImage(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      Alert.alert('Success', 'Header image uploaded! Remember to save your settings.')
    } catch (err) {
      console.error('Error uploading header image:', err)
      setIsUploadingImage(false)
      Alert.alert('Error', 'Failed to upload image. Please try again.')
    }
  }

  const handleCreateSettings = async () => {
    console.log('🔵 handleCreateSettings called')
    console.log('🔵 vendorId:', vendorId)
    console.log('🔵 user?.id:', user?.id)

    if (!vendorId) {
      console.log('❌ No vendorId')
      Alert.alert('Error', 'Vendor ID not found. Please try logging out and back in.')
      return
    }

    if (!user?.id) {
      console.log('❌ No user.id')
      Alert.alert('Error', 'User ID not found. Please try logging out and back in.')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    console.log('✅ Creating email settings for vendor:', vendorId)
    console.log('✅ Creating email settings for user:', user.id)

    const success = await updateSettings(
      vendorId,
      {
        from_name: 'Whaletools',
        from_email: 'noreply@whaletools.io',
        domain: 'whaletools.io',
        enable_receipts: true,
        enable_order_confirmations: true,
        enable_order_updates: true,
        enable_loyalty_updates: true,
        enable_welcome_emails: true,
        enable_marketing: true,
      },
      user.id
    )

    if (success) {
      Alert.alert('Success!', 'Email settings have been created.')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      Alert.alert('Error', error || 'Failed to create email settings. Please check the console for details.')
    }
  }

  if (isLoading && !settings) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text.tertiary} />
        <Text style={styles.loadingText}>Loading email settings...</Text>
      </View>
    )
  }

  // No settings configured yet
  if (!settings) {
    return (
      <View style={styles.detailContainer}>
        <ScrollView
          style={styles.detailScroll}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: layout.dockHeight }}
        >
          <TitleSection title="Email Settings" logo={vendorLogo} subtitle="Configure system emails" />

          <View style={styles.cardWrapper}>
            <View style={styles.detailCard}>
              <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.glass.regular,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing.xs,
                  }}
                >
                  <Text style={{ fontSize: 24 }}>📧</Text>
                </View>
                <Text style={{ ...typography.headline, color: colors.text.primary, fontWeight: '600' }}>
                  Email Not Configured
                </Text>
                <Text style={{ ...typography.footnote, color: colors.text.tertiary, textAlign: 'center', marginBottom: spacing.md }}>
                  Set up email to send receipts, order confirmations, and customer notifications
                </Text>
                <Pressable
                  onPress={handleCreateSettings}
                  disabled={isLoading}
                  style={{
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.lg,
                    backgroundColor: isLoading ? colors.interactive.disabled : colors.glass.thick,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isLoading ? colors.border.subtle : colors.border.emphasis,
                  }}
                >
                  <Text style={{ ...typography.body, color: isLoading ? colors.text.tertiary : colors.text.primary, fontWeight: '600' }}>
                    {isLoading ? 'Setting up...' : 'Set Up Email'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    )
  }

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
          title="Email Settings"
          logo={vendorLogo}
          subtitle="System email configuration"
          buttonText={isEditing ? undefined : 'Edit'}
          onButtonPress={isEditing ? undefined : handleEdit}
        />

        {/* Sender Configuration */}
        <Text style={styles.cardSectionTitle}>SENDER CONFIGURATION</Text>
        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Email Identity</Text>
              <View style={styles.cardDivider} />

              {isEditing ? (
                <>
                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={styles.inputLabel}>From Name</Text>
                    <TextInput
                      style={styles.input}
                      value={fromName}
                      onChangeText={setFromName}
                      placeholder="Your Store Name"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>

                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={styles.inputLabel}>From Email</Text>
                    <TextInput
                      style={styles.input}
                      value={fromEmail}
                      onChangeText={setFromEmail}
                      placeholder="noreply@yourdomain.com"
                      placeholderTextColor={colors.text.tertiary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={styles.inputLabel}>Reply-To Email (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={replyTo}
                      onChangeText={setReplyTo}
                      placeholder="support@yourdomain.com"
                      placeholderTextColor={colors.text.tertiary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={styles.inputLabel}>Domain</Text>
                    <TextInput
                      style={styles.input}
                      value={domain}
                      onChangeText={setDomain}
                      placeholder="yourdomain.com"
                      placeholderTextColor={colors.text.tertiary}
                      autoCapitalize="none"
                    />
                  </View>
                </>
              ) : (
                <>
                  <DetailRow label="From Name" value={settings.from_name} />
                  <DetailRow label="From Email" value={settings.from_email} />
                  {settings.reply_to && <DetailRow label="Reply-To" value={settings.reply_to} />}
                  <DetailRow label="Domain" value={settings.domain} />
                  <DetailRow
                    label="Status"
                    value={settings.domain_verified ? 'Verified ✓' : 'Not Verified'}
                    valueStyle={{ color: settings.domain_verified ? '#10b981' : colors.text.tertiary }}
                  />
                </>
              )}
            </View>
          </View>
        </View>

        {/* Email Header Image */}
        <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>EMAIL HEADER IMAGE</Text>
        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Custom Header</Text>
              <Text style={[styles.cardDescription, { marginBottom: spacing.md }]}>
                Upload a custom header image for all system emails (e.g., logo + brand name in Don Graffiti font)
              </Text>
              <View style={styles.cardDivider} />

              {emailHeaderImageUrl ? (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={[styles.inputLabel, { marginBottom: spacing.xs }]}>Current Header Image</Text>
                  <Image
                    source={{ uri: emailHeaderImageUrl }}
                    style={{
                      width: '100%',
                      height: 200,
                      backgroundColor: '#000',
                      borderRadius: radius.sm,
                      resizeMode: 'contain',
                    }}
                  />
                  <Pressable
                    onPress={() => setEmailHeaderImageUrl('')}
                    style={{
                      marginTop: spacing.sm,
                      paddingVertical: spacing.xs,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Remove Image</Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                onPress={handleUploadHeaderImage}
                disabled={isUploadingImage}
                style={{
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  backgroundColor: isUploadingImage ? colors.interactive.disabled : colors.glass.regular,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isUploadingImage ? colors.border.subtle : colors.border.regular,
                  alignItems: 'center',
                }}
              >
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color={colors.text.tertiary} />
                ) : (
                  <Text style={{ color: colors.text.primary, fontWeight: '600', fontSize: 15 }}>
                    {emailHeaderImageUrl ? 'Change Header Image' : 'Upload Header Image'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Template Customization */}
        {onNavigateToTemplates && (
          <>
            <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>DESIGN</Text>
            <View style={styles.cardWrapper}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onNavigateToTemplates()
                }}
                style={styles.detailCard}
              >
                <View style={[styles.cardInner, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Customize Templates</Text>
                    <Text style={[styles.cardDescription, { marginTop: 4 }]}>
                      Edit the design of your receipts, order confirmations, and other emails
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                </View>
              </Pressable>
            </View>
          </>
        )}

        {/* Email Types */}
        <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>EMAIL TYPES</Text>
        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Transactional Emails</Text>
              <View style={styles.cardDivider} />

              <ToggleRow
                label="Receipts"
                value={enableReceipts}
                onChange={setEnableReceipts}
                onTest={() => handleSendTest('receipt')}
                isTesting={isSendingTest && testingEmailType === 'receipt'}
              />
              <ToggleRow
                label="Order Confirmations"
                value={enableOrderConfirmations}
                onChange={setEnableOrderConfirmations}
                onTest={() => handleSendTest('order_confirmation')}
                isTesting={isSendingTest && testingEmailType === 'order_confirmation'}
              />
              <ToggleRow
                label="Order Updates"
                value={enableOrderUpdates}
                onChange={setEnableOrderUpdates}
                onTest={() => handleSendTest('order_update')}
                isTesting={isSendingTest && testingEmailType === 'order_update'}
              />
              <ToggleRow
                label="Loyalty Updates"
                value={enableLoyaltyUpdates}
                onChange={setEnableLoyaltyUpdates}
                onTest={() => handleSendTest('loyalty')}
                isTesting={isSendingTest && testingEmailType === 'loyalty'}
              />
              <ToggleRow
                label="Welcome Emails"
                value={enableWelcomeEmails}
                onChange={setEnableWelcomeEmails}
                onTest={() => handleSendTest('welcome')}
                isTesting={isSendingTest && testingEmailType === 'welcome'}
              />
            </View>
          </View>
        </View>

        <View style={[styles.cardWrapper, { marginTop: spacing.sm }]}>
          <View style={styles.detailCard}>
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Marketing Emails</Text>
              <View style={styles.cardDivider} />
              <ToggleRow
                label="Enable Marketing"
                value={enableMarketing}
                onChange={setEnableMarketing}
                onTest={() => handleSendTest('marketing')}
                isTesting={isSendingTest && testingEmailType === 'marketing'}
              />
            </View>
          </View>
        </View>

        {/* Test Email */}
        <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>TESTING</Text>
        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Test Email Address</Text>
              <Text style={[styles.cardDescription, { marginBottom: spacing.md }]}>
                Enter your email to receive test emails. Use the Test buttons above to send specific email types.
              </Text>
              <View style={styles.cardDivider} />

              <TextInput
                style={[styles.input, { marginBottom: spacing.md }]}
                value={testEmail}
                onChangeText={setTestEmail}
                placeholder="your@email.com"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Pressable
                onPress={() => handleSendTest()}
                disabled={isSendingTest || !testEmail}
                style={{
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  backgroundColor: isSendingTest || !testEmail ? colors.interactive.disabled : colors.glass.regular,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isSendingTest || !testEmail ? colors.border.subtle : colors.border.regular,
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.body, color: isSendingTest || !testEmail ? colors.text.tertiary : colors.text.primary, fontWeight: '600' }}>
                  {isSendingTest && !testingEmailType ? 'Sending...' : 'Send System Test Email'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Recent Sends */}
        {recentSends.length > 0 && (
          <>
            <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>RECENT SENDS</Text>
            <View style={styles.cardWrapper}>
              <View style={styles.detailCard}>
                <View style={styles.cardInner}>
                  {recentSends.slice(0, 5).map((send, index) => (
                    <View key={send.id}>
                      {index > 0 && <View style={styles.cardDivider} />}
                      <View style={{ paddingVertical: spacing.xs }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ ...typography.body, color: colors.text.primary }}>{send.subject}</Text>
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              backgroundColor: send.status === 'sent' ? '#10b98120' : '#f5923820',
                              borderRadius: radius.xs,
                            }}
                          >
                            <Text
                              style={{
                                ...typography.caption2,
                                color: send.status === 'sent' ? '#10b981' : '#f59238',
                                fontWeight: '600',
                              }}
                            >
                              {send.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ ...typography.footnote, color: colors.text.tertiary }}>
                          {send.to_email} • {new Date(send.created_at).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}

        {/* Save/Cancel Buttons (only shown when editing) */}
        {isEditing && (
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xl, flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={handleCancel}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                backgroundColor: colors.glass.thin,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border.subtle,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...typography.body, color: colors.text.secondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={isLoading}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                backgroundColor: isLoading ? colors.interactive.disabled : colors.glass.thick,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isLoading ? colors.border.subtle : colors.border.emphasis,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...typography.body, color: isLoading ? colors.text.tertiary : colors.text.primary, fontWeight: '600' }}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

interface ToggleRowProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  onTest?: () => void
  isTesting?: boolean
}

function ToggleRow({ label, value, onChange, onTest, isTesting }: ToggleRowProps) {
  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onChange(!value)
  }

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ ...typography.body, color: colors.text.secondary }}>{label}</Text>
        {onTest && value && (
          <Pressable
            onPress={onTest}
            disabled={isTesting}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              backgroundColor: colors.glass.regular,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border.regular,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: isTesting ? colors.text.tertiary : colors.text.secondary }}>
              {isTesting ? 'Sending...' : 'Test'}
            </Text>
          </Pressable>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={handleToggle}
        trackColor={{ false: '#3e3e3e', true: colors.semantic.success }}
        thumbColor={value ? '#ffffff' : '#f4f3f4'}
        ios_backgroundColor="#3e3e3e"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  ...detailCommonStyles,
  detailCard: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardInner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardTitle: {
    ...typography.headline,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    ...typography.footnote,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: 'rgba(235,235,245,0.1)',
    marginVertical: spacing.md,
  },
  cardWrapper: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardSectionTitle: {
    ...typography.caption1,
    color: colors.text.tertiary,
    fontWeight: '600',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
  inputLabel: {
    ...typography.footnote,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
})
