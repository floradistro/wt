/**
 * Marketing Screen - iPad Settings-style interface
 * Customer intelligence + Email campaigns + Channels + Discounts + Affiliates
 */

import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView, Modal, Dimensions, Animated } from 'react-native'
import React, { useEffect, memo, useState, useCallback, useMemo, useRef } from 'react'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { TitleSection } from '@/components/shared'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useAuth } from '@/stores/auth.store'
import {
  useCampaigns,
  useSegments,
  useRfmDistribution,
  useTotalCustomersWithMetrics,
  useContactReachability,
  useDraftCampaign,
  useGeneratedHtml,
  useIsGenerating,
  useSelectedSegmentId,
  useDiscountCode,
  useIsCreatingDiscount,
  useMarketingActions,
  type Campaign,
} from '@/stores/marketing.store'
// Loyalty & Discounts imports
import {
  useLoyaltyProgram,
  useLoyaltyProgramLoading,
  useLoyaltyActions,
  useCampaigns as useDiscountCampaigns,
  useCampaignStats,
  useCampaignsLoading,
  useCampaignActions,
  startLoyaltyCampaignsRealtimeMonitoring,
  stopLoyaltyCampaignsRealtimeMonitoring,
  useLoyaltyCampaignsStore,
} from '@/stores/loyalty-campaigns.store'
import { CampaignsDetail } from '@/components/settings/details/CampaignsDetail'
import { supabase } from '@/lib/supabase/client'
// Affiliates imports
import {
  useAffiliates,
  useAffiliateStats,
  useSelectedAffiliate,
  useAffiliatesLoading,
  useAffiliatesActions,
  type Affiliate,
  type CreateAffiliateInput,
} from '@/stores/affiliates.store'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

function MarketingScreenComponent() {
  const { vendor } = useAppAuth()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()

  // Store state
  const campaigns = useCampaigns()
  const segments = useSegments()
  const rfmDistribution = useRfmDistribution()
  const totalCustomersWithMetrics = useTotalCustomersWithMetrics()
  const contactReachability = useContactReachability()
  const draftCampaign = useDraftCampaign()
  const generatedHtml = useGeneratedHtml()
  const isGenerating = useIsGenerating()
  const selectedSegmentId = useSelectedSegmentId()
  const discountCode = useDiscountCode()
  const isCreatingDiscount = useIsCreatingDiscount()
  const {
    loadCampaigns,
    loadSegments,
    loadRfmDistribution,
    loadContactReachability,
    subscribeToRealtime,
    unsubscribeFromRealtime,
    generateEmail,
    setSelectedSegment,
    setDraftCampaign,
    setGeneratedHtml,
    resetCreator,
    createCampaign,
    updateCampaign,
    saveDraft,
    sendCampaign,
    sendTestEmail,
    getAudienceCount,
    createDiscountCode,
    clearDiscountCode,
  } = useMarketingActions()

  // Local state
  const [showCreatorModal, setShowCreatorModal] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [editedSubject, setEditedSubject] = useState('')
  const [editedHtml, setEditedHtml] = useState('')
  const [audienceCount, setAudienceCount] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testSentSuccess, setTestSentSuccess] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [showCampaignDetail, setShowCampaignDetail] = useState(false)
  // Discount code UI state
  const [showDiscountCreator, setShowDiscountCreator] = useState(false)
  const [discountCodeInput, setDiscountCodeInput] = useState('')
  const [discountValue, setDiscountValue] = useState('20')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  // Save draft state
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  // Tab state for viewing drafts vs sent
  const [campaignTab, setCampaignTab] = useState<'all' | 'drafts' | 'sent'>('all')
  // Editing draft state
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  // Nav state
  const [activeNav, setActiveNav] = useState<'campaigns' | 'segments' | 'loyalty' | 'discounts' | 'channels' | 'affiliates' | 'wallet'>('campaigns')

  // Wallet pass stats state
  const [walletStats, setWalletStats] = useState<{
    totalPasses: number
    activePasses: number
    pushEnabled: number
    recentActivity: Array<{ order_number: string; status: string; updated_at: string }>
  } | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)

  // Loyalty & Discounts store
  const loyaltyProgram = useLoyaltyProgram()
  const loyaltyProgramLoading = useLoyaltyProgramLoading()
  const { createProgram, updateProgram, toggleProgramStatus } = useLoyaltyActions()
  const discountCampaigns = useDiscountCampaigns()
  const discountStats = useCampaignStats()
  const discountsLoading = useCampaignsLoading()
  const { createCampaign: createDiscount, updateCampaign: updateDiscount, deleteCampaign: deleteDiscount, toggleCampaignStatus: toggleDiscountStatus, loadCampaigns: loadDiscounts } = useCampaignActions()
  const { loadProgram } = useLoyaltyActions()

  // Loyalty form state
  const [isEditingLoyalty, setIsEditingLoyalty] = useState(false)
  const [loyaltyFormData, setLoyaltyFormData] = useState({
    name: 'Loyalty Rewards',
    points_per_dollar: '1.00',
    point_value: '0.01',
    min_redemption_points: '100',
    points_expiry_days: '365',
  })

  // Affiliates store
  const affiliates = useAffiliates()
  const affiliateStats = useAffiliateStats()
  const selectedAffiliateId = useSelectedAffiliate()
  const affiliatesLoading = useAffiliatesLoading()
  const {
    loadAffiliates,
    loadStats: loadAffiliateStats,
    createAffiliate,
    updateAffiliate,
    approveAffiliate,
    pauseAffiliate,
    terminateAffiliate,
    selectAffiliate,
    subscribeToAffiliateUpdates,
  } = useAffiliatesActions()

  // Get fresh affiliate data from array (prevents stale state)
  const selectedAffiliate = useMemo(() => {
    if (!selectedAffiliateId) return null
    return affiliates.find(a => a.id === selectedAffiliateId.id) || selectedAffiliateId
  }, [selectedAffiliateId, affiliates])

  // Affiliate form state
  const [showAffiliateModal, setShowAffiliateModal] = useState(false)
  const [affiliateFormData, setAffiliateFormData] = useState<CreateAffiliateInput>({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
    website_url: '',
    commission_rate: 10,
    customer_discount_rate: 0,
    payment_method: 'paypal',
    minimum_payout: 50,
    notes: '',
  })

  // Nav items
  const navItems: NavItem[] = useMemo(() => [
    {
      id: 'campaigns',
      icon: 'megaphone',
      label: 'Campaigns',
      count: campaigns.length,
    },
    {
      id: 'segments',
      icon: 'pie',
      label: 'Segments',
      count: segments.length,
    },
    {
      id: 'loyalty',
      icon: 'star',
      label: 'Loyalty',
    },
    {
      id: 'discounts',
      icon: 'pricetag',
      label: 'Discounts',
      count: discountCampaigns.length,
    },
    {
      id: 'channels',
      icon: 'share',
      label: 'Channels',
    },
    {
      id: 'affiliates',
      icon: 'people',
      label: 'Affiliates',
      count: affiliates.length,
    },
    {
      id: 'wallet',
      icon: 'wallet',
      label: 'Wallet',
      count: walletStats?.activePasses,
    },
  ], [campaigns.length, segments.length, discountCampaigns.length, affiliates.length, walletStats?.activePasses])

  // Load data on mount
  useEffect(() => {
    let unsubscribeAffiliates: (() => void) | undefined

    if (vendor?.id) {
      loadCampaigns(vendor.id)
      loadSegments(vendor.id)
      loadRfmDistribution(vendor.id)
      loadContactReachability(vendor.id)
      subscribeToRealtime(vendor.id)
      // Load affiliates and subscribe to real-time updates
      loadAffiliates(vendor.id)
      loadAffiliateStats(vendor.id)
      unsubscribeAffiliates = subscribeToAffiliateUpdates(vendor.id)
    }
    return () => {
      unsubscribeFromRealtime()
      unsubscribeAffiliates?.()
    }
  }, [vendor?.id])

  // Load loyalty and discounts data (requires auth user ID)
  useEffect(() => {
    if (user?.id) {
      loadProgram(user.id)
      loadDiscounts(user.id)
      startLoyaltyCampaignsRealtimeMonitoring(user.id)
    }
    return () => {
      stopLoyaltyCampaignsRealtimeMonitoring()
    }
  }, [user?.id])

  // Initialize loyalty form when program loads
  useEffect(() => {
    if (loyaltyProgram) {
      setLoyaltyFormData({
        name: loyaltyProgram.name || 'Loyalty Rewards',
        points_per_dollar: loyaltyProgram.points_per_dollar.toString(),
        point_value: loyaltyProgram.point_value.toString(),
        min_redemption_points: loyaltyProgram.min_redemption_points.toString(),
        points_expiry_days: loyaltyProgram.points_expiry_days?.toString() || '',
      })
    }
  }, [loyaltyProgram])

  // Sync edited subject with draft
  useEffect(() => {
    if (draftCampaign?.subject && !editedSubject) {
      setEditedSubject(draftCampaign.subject)
    }
  }, [draftCampaign?.subject])

  // Sync edited HTML with generated HTML
  useEffect(() => {
    if (generatedHtml) {
      setEditedHtml(generatedHtml)
    }
  }, [generatedHtml])

  // Update audience count when segment changes
  useEffect(() => {
    let cancelled = false
    async function updateCount() {
      if (vendor?.id) {
        const count = await getAudienceCount(selectedSegmentId, vendor.id)
        if (!cancelled) setAudienceCount(count)
      }
    }
    updateCount()
    return () => { cancelled = true }
  }, [selectedSegmentId, vendor?.id])

  // Load wallet pass stats
  useEffect(() => {
    if (!vendor?.id) return
    let cancelled = false

    async function loadWalletStats() {
      setWalletLoading(true)
      try {
        // Get all order passes for this vendor's orders
        const { data: passes, error } = await supabase
          .from('order_passes')
          .select(`
            serial_number,
            push_enabled,
            last_updated_at,
            orders!inner(
              order_number,
              status,
              vendor_id
            )
          `)
          .eq('orders.vendor_id', vendor.id)
          .order('last_updated_at', { ascending: false })
          .limit(100)

        if (error) {
          console.error('[MarketingScreen] Wallet stats error:', error)
          return
        }

        if (cancelled) return

        // Count active passes (those with registrations)
        const { count: activeCount } = await supabase
          .from('order_pass_registrations')
          .select('*', { count: 'exact', head: true })

        // Calculate stats
        const totalPasses = passes?.length || 0
        const pushEnabled = passes?.filter(p => p.push_enabled).length || 0
        const recentActivity = (passes || []).slice(0, 5).map(p => ({
          order_number: (p.orders as any)?.order_number || 'Unknown',
          status: (p.orders as any)?.status || 'unknown',
          updated_at: p.last_updated_at,
        }))

        setWalletStats({
          totalPasses,
          activePasses: activeCount || 0,
          pushEnabled,
          recentActivity,
        })
      } catch (err) {
        console.error('[MarketingScreen] Wallet stats exception:', err)
      } finally {
        if (!cancelled) setWalletLoading(false)
      }
    }

    loadWalletStats()
    return () => { cancelled = true }
  }, [vendor?.id])

  // Handlers
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !vendor?.id) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setEditedSubject('')
    setEditedHtml('')
    editedHtmlRef.current = null  // Reset the ref when generating new email
    await generateEmail(prompt, vendor.id)
  }, [prompt, vendor?.id, generateEmail])

  const handleConfirmSend = async () => {
    // Use ref first (most recent edits), then state, then generated
    const htmlToSend = editedHtmlRef.current || editedHtml || generatedHtml
    if (!vendor?.id || !draftCampaign || !htmlToSend) return

    setIsSending(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    try {
      const audienceType = selectedSegmentId ? 'segment' : 'all'
      const audienceFilter = selectedSegmentId ? { segment_id: selectedSegmentId } : {}

      let campaignId: string

      if (editingDraftId) {
        // Update existing draft before sending
        await updateCampaign(editingDraftId, {
          name: editedSubject || draftCampaign.subject || 'Campaign',
          subject: editedSubject || draftCampaign.subject || '',
          preview_text: draftCampaign.preview_text,
          content_json: draftCampaign.content_json || {},
          html_content: htmlToSend,
          audience_type: audienceType,
          audience_filter: audienceFilter,
          recipient_count: audienceCount,
        })
        campaignId = editingDraftId
      } else {
        // Create new campaign
        const campaign = await createCampaign({
          vendor_id: vendor.id,
          name: editedSubject || draftCampaign.subject || 'Campaign',
          subject: editedSubject || draftCampaign.subject || '',
          preview_text: draftCampaign.preview_text,
          content_json: draftCampaign.content_json || {},
          html_content: htmlToSend,
          audience_type: audienceType,
          audience_filter: audienceFilter,
          recipient_count: audienceCount,
          status: 'draft',
        })
        if (!campaign) throw new Error('Failed to create campaign')
        campaignId = campaign.id
      }

      const success = await sendCampaign(campaignId)
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setShowConfirmModal(false)
        setShowTestModal(false)
        setShowCreatorModal(false)
        setEditingDraftId(null)
        resetCreator()
        setPrompt('')
        setEditedSubject('')
        setEditedHtml('')
        loadCampaigns(vendor.id)
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSending(false)
    }
  }

  const handleStartOver = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    resetCreator()
    setPrompt('')
    setEditedSubject('')
    setEditedHtml('')
    setShowDiscountCreator(false)
    setDiscountCodeInput('')
    setDiscountValue('20')
    setEditingDraftId(null)
  }

  const handleCreateDiscount = async () => {
    if (!vendor?.id) return
    const value = parseFloat(discountValue) || 20
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await createDiscountCode(vendor.id, discountCodeInput, discountType, value)
    setShowDiscountCreator(false)
  }

  const handleSaveDraft = async () => {
    const htmlToSave = editedHtmlRef.current || editedHtml || generatedHtml
    if (!vendor?.id || !htmlToSave) return

    setIsSavingDraft(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const audienceType = selectedSegmentId ? 'segment' : 'all'
      const audienceFilter = selectedSegmentId ? { segment_id: selectedSegmentId } : {}

      const saved = await saveDraft(vendor.id, {
        name: editedSubject || draftCampaign?.subject || 'Untitled Campaign',
        subject: editedSubject || draftCampaign?.subject || '',
        preview_text: draftCampaign?.preview_text,
        content_json: draftCampaign?.content_json || {},
        html_content: htmlToSave,
        audience_type: audienceType,
        audience_filter: audienceFilter,
        recipient_count: audienceCount,
      })

      if (saved) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        handleCloseCreator()
        resetCreator()
        setPrompt('')
        setEditedSubject('')
        setEditedHtml('')
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleSendTest = async () => {
    // Use ref first (most recent edits), then state, then generated
    const htmlToSend = editedHtmlRef.current || editedHtml || generatedHtml
    if (!vendor?.id || !htmlToSend || !testEmail.trim()) return

    setIsSendingTest(true)
    setTestSentSuccess(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const subject = editedSubject || draftCampaign?.subject || 'Marketing Email'
      const success = await sendTestEmail(vendor.id, testEmail.trim(), subject, htmlToSend)

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setTestSentSuccess(true)
        setTimeout(() => {
          setShowTestModal(false)
          setTestSentSuccess(false)
        }, 2000)
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleOpenCreator = (segmentId?: string) => {
    console.log('[Marketing] Opening creator modal')
    if (segmentId) {
      setSelectedSegment(segmentId)
    }
    // Reset any stuck modal states before opening
    setShowTestModal(false)
    setShowConfirmModal(false)
    setEditingDraftId(null)
    setShowCreatorModal(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  const handleOpenDraft = (campaign: Campaign) => {
    console.log('[Marketing] Opening draft for editing:', campaign.id)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Set the draft content into the editor
    setEditingDraftId(campaign.id)
    setEditedSubject(campaign.subject || '')
    setEditedHtml(campaign.html_content || '')
    editedHtmlRef.current = campaign.html_content || null

    // Set audience
    if (campaign.audience_filter?.segment_id) {
      setSelectedSegment(campaign.audience_filter.segment_id)
    } else {
      setSelectedSegment(null)
    }

    // Update store state
    setDraftCampaign({
      subject: campaign.subject,
      preview_text: campaign.preview_text,
      content_json: campaign.content_json,
      html_content: campaign.html_content,
    })
    setGeneratedHtml(campaign.html_content || null)

    // Reset modal states and open
    setShowTestModal(false)
    setShowConfirmModal(false)
    setShowCampaignDetail(false)
    setShowCreatorModal(true)
  }

  const handleCloseCreator = () => {
    console.log('[Marketing] Closing creator modal')
    // Close all nested modals first
    setShowTestModal(false)
    setShowConfirmModal(false)
    setShowCreatorModal(false)
    setEditingDraftId(null)
  }

  // Computed values
  const draftCampaigns = campaigns.filter(c => c.status === 'draft')
  const sentCampaigns = campaigns.filter(c => c.status === 'sent' || c.status === 'sending')
  const filteredCampaigns = campaignTab === 'drafts' ? draftCampaigns :
    campaignTab === 'sent' ? sentCampaigns : campaigns
  const selectedSegment = segments.find(s => s.id === selectedSegmentId)

  const currentHtml = editedHtml || generatedHtml

  // Aggregate metrics for email performance
  const aggregateMetrics = useMemo(() => {
    const sent = sentCampaigns.reduce((sum, c) => sum + c.sent_count, 0)
    const delivered = sentCampaigns.reduce((sum, c) => sum + c.delivered_count, 0)
    const opened = sentCampaigns.reduce((sum, c) => sum + c.opened_count, 0)
    const clicked = sentCampaigns.reduce((sum, c) => sum + c.clicked_count, 0)
    const bounced = sentCampaigns.reduce((sum, c) => sum + c.bounced_count, 0)
    const complained = sentCampaigns.reduce((sum, c) => sum + c.complained_count, 0)

    return {
      totalCampaigns: sentCampaigns.length,
      totalSent: sent,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
      clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
      bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
      complaintRate: sent > 0 ? ((complained / sent) * 100).toFixed(2) : '0.00',
    }
  }, [sentCampaigns])

  // Ref to store edited HTML without triggering re-renders
  const editedHtmlRef = useRef<string | null>(null)

  // Handle message from WebView (inline editing) - store in ref, not state
  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data)
      if (message.type === 'htmlUpdate') {
        // Store in ref to avoid re-rendering the WebView
        editedHtmlRef.current = message.html
      } else if (message.type === 'editingDone') {
        // Only update state when editing is complete (on blur)
        if (editedHtmlRef.current) {
          setEditedHtml(editedHtmlRef.current)
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }, [])

  // Preview HTML - only changes when generatedHtml changes, NOT when editedHtml changes
  // This prevents WebView from re-rendering during typing
  // Use generatedHtml OR editedHtml (for drafts that don't have generatedHtml)
  const htmlForPreview = generatedHtml || editedHtml
  const previewHtml = htmlForPreview ? `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          html, body {
            margin: 0;
            padding: 24px;
            background: #1c1c1e;
            -webkit-tap-highlight-color: transparent;
          }
          /* Editable element styles */
          [contenteditable="true"] {
            outline: none;
            cursor: text;
            transition: box-shadow 0.2s ease;
          }
          [contenteditable="true"]:hover {
            box-shadow: 0 0 0 2px rgba(52, 199, 89, 0.3);
            border-radius: 4px;
          }
          [contenteditable="true"]:focus {
            box-shadow: 0 0 0 2px rgba(52, 199, 89, 0.6);
            border-radius: 4px;
          }
          /* Link indicator for editable links */
          a[contenteditable="true"] {
            position: relative;
          }
          a[contenteditable="true"]::after {
            content: '🔗';
            position: absolute;
            top: -8px;
            right: -8px;
            font-size: 10px;
            background: rgba(99, 102, 241, 0.9);
            padding: 2px 4px;
            border-radius: 4px;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
          }
          a[contenteditable="true"]:hover::after,
          a[contenteditable="true"]:focus::after {
            opacity: 1;
          }
          /* Edit hint */
          .edit-hint {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(52, 199, 89, 0.9);
            color: #fff;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            z-index: 1000;
          }
          .edit-hint.visible {
            opacity: 1;
          }
          /* Link editor modal */
          .link-editor-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.85);
            z-index: 2000;
            align-items: center;
            justify-content: center;
          }
          .link-editor-overlay.visible {
            display: flex;
          }
          .link-editor {
            background: #2c2c2e;
            border-radius: 16px;
            padding: 24px;
            width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          }
          .link-editor h3 {
            margin: 0 0 16px 0;
            color: #fff;
            font-size: 18px;
            font-weight: 600;
          }
          .link-editor label {
            display: block;
            color: rgba(255,255,255,0.6);
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 6px;
            text-transform: uppercase;
          }
          .link-editor input {
            width: 100%;
            padding: 12px;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            background: rgba(255,255,255,0.1);
            color: #fff;
            font-size: 14px;
            margin-bottom: 16px;
            box-sizing: border-box;
          }
          .link-editor input:focus {
            outline: none;
            border-color: #34c759;
          }
          .link-editor-buttons {
            display: flex;
            gap: 12px;
          }
          .link-editor-buttons button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }
          .btn-cancel {
            background: rgba(255,255,255,0.1);
            color: #fff;
          }
          .btn-save {
            background: #34c759;
            color: #fff;
          }
        </style>
      </head>
      <body>
        ${htmlForPreview}
        <div class="edit-hint" id="editHint">Tap text to edit • Long-press links to edit URL</div>

        <!-- Link Editor Modal -->
        <div class="link-editor-overlay" id="linkEditorOverlay">
          <div class="link-editor">
            <h3>Edit Link</h3>
            <label>Button Text</label>
            <input type="text" id="linkTextInput" placeholder="Button text...">
            <label>URL</label>
            <input type="url" id="linkUrlInput" placeholder="https://...">
            <div class="link-editor-buttons">
              <button class="btn-cancel" id="linkCancelBtn">Cancel</button>
              <button class="btn-save" id="linkSaveBtn">Save</button>
            </div>
          </div>
        </div>

        <script>
          (function() {
            let currentEditingLink = null;
            const linkEditorOverlay = document.getElementById('linkEditorOverlay');
            const linkTextInput = document.getElementById('linkTextInput');
            const linkUrlInput = document.getElementById('linkUrlInput');
            const linkCancelBtn = document.getElementById('linkCancelBtn');
            const linkSaveBtn = document.getElementById('linkSaveBtn');

            // Make all text elements editable - including buttons/CTAs
            const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, button, div:not(:has(*))';
            const elements = document.querySelectorAll(editableSelectors);

            elements.forEach(el => {
              // Make element editable if it has text content
              const hasText = el.textContent && el.textContent.trim().length > 0;
              if (hasText) {
                el.setAttribute('contenteditable', 'true');

                // For links/buttons - add long press to edit URL
                if (el.tagName === 'A' || el.tagName === 'BUTTON') {
                  let longPressTimer;

                  el.addEventListener('touchstart', function(e) {
                    longPressTimer = setTimeout(() => {
                      e.preventDefault();
                      openLinkEditor(el);
                    }, 500);
                  });

                  el.addEventListener('touchend', function() {
                    clearTimeout(longPressTimer);
                  });

                  el.addEventListener('touchmove', function() {
                    clearTimeout(longPressTimer);
                  });

                  // Prevent navigation on click
                  el.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                  });

                  // Double-click to open link editor on desktop
                  el.addEventListener('dblclick', function(e) {
                    e.preventDefault();
                    openLinkEditor(el);
                  });
                }
              }
            });

            function openLinkEditor(linkEl) {
              currentEditingLink = linkEl;
              linkTextInput.value = linkEl.textContent || '';
              linkUrlInput.value = linkEl.getAttribute('href') || '';
              linkEditorOverlay.classList.add('visible');
              linkUrlInput.focus();
            }

            function closeLinkEditor() {
              linkEditorOverlay.classList.remove('visible');
              currentEditingLink = null;
            }

            function saveLinkChanges() {
              if (currentEditingLink) {
                currentEditingLink.textContent = linkTextInput.value;
                if (currentEditingLink.tagName === 'A') {
                  currentEditingLink.setAttribute('href', linkUrlInput.value);
                }
                // Mark as edited and send update
                sendHtmlUpdate();
              }
              closeLinkEditor();
            }

            linkCancelBtn.addEventListener('click', closeLinkEditor);
            linkSaveBtn.addEventListener('click', saveLinkChanges);
            linkEditorOverlay.addEventListener('click', function(e) {
              if (e.target === linkEditorOverlay) closeLinkEditor();
            });

            // Show hint on first load
            const hint = document.getElementById('editHint');
            setTimeout(() => {
              hint.classList.add('visible');
              setTimeout(() => hint.classList.remove('visible'), 3500);
            }, 500);

            function sendHtmlUpdate() {
              const clone = document.body.cloneNode(true);
              // Remove editor elements
              const hintEl = clone.querySelector('.edit-hint');
              if (hintEl) hintEl.remove();
              const editorEl = clone.querySelector('.link-editor-overlay');
              if (editorEl) editorEl.remove();
              const scriptEl = clone.querySelector('script');
              if (scriptEl) scriptEl.remove();

              // Remove contenteditable attributes for clean HTML
              clone.querySelectorAll('[contenteditable]').forEach(el => {
                el.removeAttribute('contenteditable');
              });

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'htmlUpdate',
                html: clone.innerHTML
              }));
            }

            // Track changes and send back to React Native
            let debounceTimer;
            document.body.addEventListener('input', function(e) {
              clearTimeout(debounceTimer);
              debounceTimer = setTimeout(sendHtmlUpdate, 300);
            });

            // Show hint when element is focused
            document.body.addEventListener('focus', function(e) {
              if (e.target.hasAttribute('contenteditable')) {
                const isLink = e.target.tagName === 'A' || e.target.tagName === 'BUTTON';
                hint.textContent = isLink ? 'Editing text • Long-press for URL' : 'Editing...';
                hint.classList.add('visible');
              }
            }, true);

            document.body.addEventListener('blur', function(e) {
              if (e.target.hasAttribute('contenteditable')) {
                hint.textContent = 'Tap text to edit • Long-press links to edit URL';
                setTimeout(() => hint.classList.remove('visible'), 500);

                // Send final HTML when editing is done
                sendHtmlUpdate();
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'editingDone',
                  html: ''
                }));
              }
            }, true);
          })();
        </script>
      </body>
    </html>
  ` : null

  // Render content based on active nav
  const renderContent = () => {
    switch (activeNav) {
      case 'campaigns':
        return (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <TitleSection
              title="Campaigns"
              logo={vendor?.logo_url}
              subtitle={`${campaigns.length} campaigns`}
              buttonText="+ Create Campaign"
              onButtonPress={() => {
                console.log('[Marketing] Create Campaign button pressed')
                handleOpenCreator()
              }}
            />

            {/* HERO STATS */}
            <View style={styles.heroSection}>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>{totalCustomersWithMetrics.toLocaleString()}</Text>
                <Text style={styles.heroLabel}>Total Customers</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>
                  {rfmDistribution.find(r => r.segment === 'Champions')?.count.toLocaleString() || '0'}
                </Text>
                <Text style={styles.heroLabel}>Champions</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>
                  {rfmDistribution.find(r => r.segment === 'Loyal')?.count.toLocaleString() || '0'}
                </Text>
                <Text style={styles.heroLabel}>Loyal</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>{sentCampaigns.length}</Text>
                <Text style={styles.heroLabel}>Campaigns Sent</Text>
              </View>
            </View>

            {/* EMAIL PERFORMANCE */}
            {sentCampaigns.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Email Performance</Text>
                <Text style={styles.sectionSubtitle}>{aggregateMetrics.totalSent.toLocaleString()} emails sent across {aggregateMetrics.totalCampaigns} campaigns</Text>

                <View style={styles.metricsRow}>
                  <View style={styles.metricCard}>
                    <Ionicons name="checkmark-done" size={24} color="#10B981" />
                    <Text style={styles.metricValue}>{aggregateMetrics.deliveryRate}%</Text>
                    <Text style={styles.metricLabel}>Delivered</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Ionicons name="mail-open" size={24} color="#3B82F6" />
                    <Text style={styles.metricValue}>{aggregateMetrics.openRate}%</Text>
                    <Text style={styles.metricLabel}>Open Rate</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Ionicons name="finger-print" size={24} color="#A855F7" />
                    <Text style={styles.metricValue}>{aggregateMetrics.clickRate}%</Text>
                    <Text style={styles.metricLabel}>Click Rate</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Ionicons name="shield-checkmark" size={24} color="#6B7280" />
                    <Text style={styles.metricValue}>{aggregateMetrics.complaintRate}%</Text>
                    <Text style={styles.metricLabel}>Complaints</Text>
                  </View>
                </View>
              </View>
            )}

            {/* CAMPAIGN HISTORY WITH TABS */}
            {campaigns.length > 0 && (
              <View style={styles.section}>
                <View style={styles.campaignHistoryHeader}>
                  <Text style={styles.sectionTitle}>History</Text>
                  <View style={styles.campaignTabs}>
                    <Pressable
                      style={[styles.campaignTab, campaignTab === 'all' && styles.campaignTabActive]}
                      onPress={() => setCampaignTab('all')}
                    >
                      <Text style={[styles.campaignTabText, campaignTab === 'all' && styles.campaignTabTextActive]}>
                        All ({campaigns.length})
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.campaignTab, campaignTab === 'drafts' && styles.campaignTabActive]}
                      onPress={() => setCampaignTab('drafts')}
                    >
                      <Text style={[styles.campaignTabText, campaignTab === 'drafts' && styles.campaignTabTextActive]}>
                        Drafts ({draftCampaigns.length})
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.campaignTab, campaignTab === 'sent' && styles.campaignTabActive]}
                      onPress={() => setCampaignTab('sent')}
                    >
                      <Text style={[styles.campaignTabText, campaignTab === 'sent' && styles.campaignTabTextActive]}>
                        Sent ({sentCampaigns.length})
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {filteredCampaigns.length === 0 ? (
                  <View style={styles.noCampaignsState}>
                    <Ionicons
                      name={campaignTab === 'drafts' ? 'document-outline' : 'mail-outline'}
                      size={32}
                      color={colors.text.quaternary}
                    />
                    <Text style={styles.noCampaignsText}>
                      {campaignTab === 'drafts' ? 'No drafts yet' : 'No sent campaigns yet'}
                    </Text>
                  </View>
                ) : (
                  filteredCampaigns.slice(0, 10).map((campaign) => {
                    const isDraft = campaign.status === 'draft'
                    const openRate = campaign.delivered_count > 0
                      ? Math.round((campaign.opened_count / campaign.delivered_count) * 100)
                      : 0
                    const clickRate = campaign.opened_count > 0
                      ? Math.round((campaign.clicked_count / campaign.opened_count) * 100)
                      : 0

                    return (
                      <Pressable
                        key={campaign.id}
                        style={styles.campaignCard}
                        onPress={() => {
                          if (isDraft) {
                            // Open draft for editing
                            handleOpenDraft(campaign)
                          } else {
                            // Show sent campaign details
                            setSelectedCampaign(campaign)
                            setShowCampaignDetail(true)
                          }
                        }}
                      >
                        <View style={styles.campaignHeader}>
                          <Ionicons
                            name={isDraft ? 'document-text-outline' : campaign.status === 'sent' ? 'checkmark-circle' : 'time'}
                            size={20}
                            color={isDraft ? colors.text.tertiary : campaign.status === 'sent' ? '#10B981' : '#F59E0B'}
                          />
                          <View style={styles.campaignInfo}>
                            <Text style={styles.campaignSubject} numberOfLines={1}>
                              {campaign.subject || 'Untitled Campaign'}
                            </Text>
                            <Text style={styles.campaignDate}>
                              {isDraft
                                ? `Draft - ${new Date(campaign.created_at).toLocaleDateString()}`
                                : campaign.sent_at
                                  ? new Date(campaign.sent_at).toLocaleDateString()
                                  : 'Sending...'}
                            </Text>
                          </View>
                          {isDraft && (
                            <View style={styles.draftBadge}>
                              <Text style={styles.draftBadgeText}>Draft</Text>
                            </View>
                          )}
                        </View>
                        {!isDraft && (
                          <View style={styles.campaignStats}>
                            <View style={styles.campaignStat}>
                              <Text style={styles.campaignStatValue}>{campaign.delivered_count.toLocaleString()}</Text>
                              <Text style={styles.campaignStatLabel}>Delivered</Text>
                            </View>
                            <View style={styles.campaignStat}>
                              <Text style={styles.campaignStatValue}>{openRate}%</Text>
                              <Text style={styles.campaignStatLabel}>Opened</Text>
                            </View>
                            <View style={styles.campaignStat}>
                              <Text style={styles.campaignStatValue}>{clickRate}%</Text>
                              <Text style={styles.campaignStatLabel}>Clicked</Text>
                            </View>
                          </View>
                        )}
                        {isDraft && (
                          <View style={styles.draftInfo}>
                            <Text style={styles.draftInfoText}>
                              {campaign.recipient_count > 0
                                ? `${campaign.recipient_count.toLocaleString()} recipients`
                                : 'No audience selected'}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    )
                  })
                )}
              </View>
            )}

            {/* EMPTY STATE */}
            {sentCampaigns.length === 0 && totalCustomersWithMetrics === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={64} color={colors.text.quaternary} />
                <Text style={styles.emptyTitle}>No marketing data yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create your first campaign to start engaging with your customers
                </Text>
                <Pressable style={styles.emptyButton} onPress={() => handleOpenCreator()}>
                  <Text style={styles.emptyButtonText}>Create Campaign</Text>
                </Pressable>
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        )

      case 'segments':
        return (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <TitleSection
              title="Customer Segments"
              logo={vendor?.logo_url}
              subtitle={`${totalCustomersWithMetrics.toLocaleString()} customers analyzed`}
            />

            {/* RFM SEGMENT BREAKDOWN */}
            {rfmDistribution.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>RFM Analysis</Text>
                <Text style={styles.sectionSubtitle}>Customer behavior segments based on Recency, Frequency & Monetary value</Text>

                <View style={styles.segmentGrid}>
                  {rfmDistribution
                    .filter(item => item.count > 0)
                    .map((item) => {
                      const percentage = totalCustomersWithMetrics > 0
                        ? ((item.count / totalCustomersWithMetrics) * 100).toFixed(1)
                        : '0'
                      return (
                        <Pressable
                          key={item.segment}
                          style={styles.segmentCard}
                          onPress={() => {
                            // Find matching segment and open creator
                            const matchingSegment = segments.find(s =>
                              s.name.toLowerCase().includes(item.segment.toLowerCase())
                            )
                            handleOpenCreator(matchingSegment?.id)
                          }}
                        >
                          <View style={[styles.segmentDot, { backgroundColor: item.color }]} />
                          <View style={styles.segmentInfo}>
                            <Text style={styles.segmentName}>{item.segment}</Text>
                            <Text style={styles.segmentCount}>{item.count.toLocaleString()} customers</Text>
                          </View>
                          <Text style={styles.segmentPercent}>{percentage}%</Text>
                        </Pressable>
                      )
                    })}
                </View>
              </View>
            )}

            {/* MARKETING REACHABILITY */}
            {contactReachability && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Marketing Reachability</Text>
                <Text style={styles.sectionSubtitle}>How your customers can be reached</Text>

                <View style={styles.reachabilityGrid}>
                  {/* Email Reachable */}
                  <View style={styles.reachabilityCard}>
                    <View style={styles.reachabilityIcon}>
                      <Ionicons name="mail" size={24} color="#3B82F6" />
                    </View>
                    <Text style={styles.reachabilityValue}>{contactReachability.email_reachable.toLocaleString()}</Text>
                    <Text style={styles.reachabilityLabel}>Email Reachable</Text>
                    <Text style={styles.reachabilityPercent}>
                      {((contactReachability.email_reachable / contactReachability.total) * 100).toFixed(1)}%
                    </Text>
                  </View>

                  {/* SMS Reachable */}
                  <View style={styles.reachabilityCard}>
                    <View style={styles.reachabilityIcon}>
                      <Ionicons name="chatbubble" size={24} color="#10B981" />
                    </View>
                    <Text style={styles.reachabilityValue}>{contactReachability.sms_reachable.toLocaleString()}</Text>
                    <Text style={styles.reachabilityLabel}>SMS Reachable</Text>
                    <Text style={styles.reachabilityPercent}>
                      {((contactReachability.sms_reachable / contactReachability.total) * 100).toFixed(1)}%
                    </Text>
                  </View>

                  {/* Both Channels */}
                  <View style={styles.reachabilityCard}>
                    <View style={styles.reachabilityIcon}>
                      <Ionicons name="sync" size={24} color="#8B5CF6" />
                    </View>
                    <Text style={styles.reachabilityValue}>{contactReachability.email_and_phone.toLocaleString()}</Text>
                    <Text style={styles.reachabilityLabel}>Both Channels</Text>
                    <Text style={styles.reachabilityPercent}>
                      {((contactReachability.email_and_phone / contactReachability.total) * 100).toFixed(1)}%
                    </Text>
                  </View>

                  {/* Unreachable */}
                  <View style={styles.reachabilityCard}>
                    <View style={styles.reachabilityIcon}>
                      <Ionicons name="alert-circle" size={24} color="#EF4444" />
                    </View>
                    <Text style={styles.reachabilityValue}>{contactReachability.unreachable.toLocaleString()}</Text>
                    <Text style={styles.reachabilityLabel}>No Contact Info</Text>
                    <Text style={styles.reachabilityPercent}>
                      {((contactReachability.unreachable / contactReachability.total) * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>

                {/* Contact Breakdown */}
                <View style={styles.contactBreakdown}>
                  <View style={styles.contactBreakdownRow}>
                    <View style={styles.contactBreakdownItem}>
                      <View style={[styles.contactDot, { backgroundColor: '#3B82F6' }]} />
                      <Text style={styles.contactBreakdownLabel}>Email Only</Text>
                      <Text style={styles.contactBreakdownValue}>{contactReachability.email_only.toLocaleString()}</Text>
                    </View>
                    <View style={styles.contactBreakdownItem}>
                      <View style={[styles.contactDot, { backgroundColor: '#10B981' }]} />
                      <Text style={styles.contactBreakdownLabel}>Phone Only</Text>
                      <Text style={styles.contactBreakdownValue}>{contactReachability.phone_only.toLocaleString()}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* TARGET AUDIENCES */}
            {segments.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Target Audiences</Text>
                <Text style={styles.sectionSubtitle}>Pre-built segments ready to email</Text>

                <View style={styles.segmentGrid}>
                  {segments
                    .filter(s => s.customer_count > 0)
                    .sort((a, b) => b.customer_count - a.customer_count)
                    .map((seg) => (
                      <Pressable
                        key={seg.id}
                        style={styles.segmentCard}
                        onPress={() => handleOpenCreator(seg.id)}
                      >
                        <View style={[styles.segmentDot, { backgroundColor: seg.color || '#6366F1' }]} />
                        <View style={styles.segmentInfo}>
                          <Text style={styles.segmentName}>{seg.name}</Text>
                          <Text style={styles.segmentCount}>{seg.customer_count.toLocaleString()} customers</Text>
                        </View>
                        <Ionicons name="mail-outline" size={18} color={colors.text.tertiary} />
                      </Pressable>
                    ))}
                </View>
              </View>
            )}

            {segments.length === 0 && rfmDistribution.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="pie-chart-outline" size={64} color={colors.text.quaternary} />
                <Text style={styles.emptyTitle}>No segments yet</Text>
                <Text style={styles.emptySubtitle}>
                  Customer segments will appear here once you have enough order data
                </Text>
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        )

      case 'loyalty':
        return (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <TitleSection
              title="Loyalty Program"
              logo={vendor?.logo_url}
              subtitle={loyaltyProgram?.is_active ? 'Active' : 'Inactive'}
              buttonText={loyaltyProgram && !isEditingLoyalty ? '+ Edit' : undefined}
              onButtonPress={() => setIsEditingLoyalty(true)}
              hideButton={!loyaltyProgram || isEditingLoyalty}
            />

            {loyaltyProgramLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.text.tertiary} />
                <Text style={styles.loadingText}>Loading loyalty program...</Text>
              </View>
            ) : !loyaltyProgram && !isEditingLoyalty ? (
              // Empty state - no program configured
              <View style={styles.emptyState}>
                <Ionicons name="star-outline" size={64} color={colors.text.quaternary} />
                <Text style={styles.emptyTitle}>No loyalty program configured</Text>
                <Text style={styles.emptySubtitle}>
                  Set up a loyalty program to reward your customers for their purchases
                </Text>
                <Pressable style={styles.emptyButton} onPress={() => setIsEditingLoyalty(true)}>
                  <Text style={styles.emptyButtonText}>Configure Program</Text>
                </Pressable>
              </View>
            ) : isEditingLoyalty ? (
              // Edit/Create form
              <View style={styles.section}>
                <View style={styles.loyaltyCard}>
                  <View style={styles.loyaltyFormGroup}>
                    <Text style={styles.loyaltyFormLabel}>Points per Dollar Spent</Text>
                    <Text style={styles.loyaltyFormHint}>How many points customers earn per dollar</Text>
                    <TextInput
                      style={styles.loyaltyFormInput}
                      value={loyaltyFormData.points_per_dollar}
                      onChangeText={(text) => setLoyaltyFormData({ ...loyaltyFormData, points_per_dollar: text })}
                      keyboardType="decimal-pad"
                      placeholder="1.00"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>

                  <View style={styles.loyaltyFormGroup}>
                    <Text style={styles.loyaltyFormLabel}>Point Value (USD)</Text>
                    <Text style={styles.loyaltyFormHint}>Dollar value of each point when redeemed</Text>
                    <TextInput
                      style={styles.loyaltyFormInput}
                      value={loyaltyFormData.point_value}
                      onChangeText={(text) => setLoyaltyFormData({ ...loyaltyFormData, point_value: text })}
                      keyboardType="decimal-pad"
                      placeholder="0.01"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>

                  <View style={styles.loyaltyFormGroup}>
                    <Text style={styles.loyaltyFormLabel}>Minimum Points to Redeem</Text>
                    <Text style={styles.loyaltyFormHint}>Minimum points required for redemption</Text>
                    <TextInput
                      style={styles.loyaltyFormInput}
                      value={loyaltyFormData.min_redemption_points}
                      onChangeText={(text) => setLoyaltyFormData({ ...loyaltyFormData, min_redemption_points: text })}
                      keyboardType="number-pad"
                      placeholder="100"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>

                  <View style={styles.loyaltyFormGroup}>
                    <Text style={styles.loyaltyFormLabel}>Points Expiry (Days)</Text>
                    <Text style={styles.loyaltyFormHint}>Days until points expire (leave empty for never)</Text>
                    <TextInput
                      style={styles.loyaltyFormInput}
                      value={loyaltyFormData.points_expiry_days}
                      onChangeText={(text) => setLoyaltyFormData({ ...loyaltyFormData, points_expiry_days: text })}
                      keyboardType="number-pad"
                      placeholder="365 or leave empty"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>

                  <View style={styles.loyaltyButtonRow}>
                    <Pressable
                      style={[styles.loyaltyButton, styles.loyaltyButtonSecondary]}
                      onPress={() => {
                        if (loyaltyProgram) {
                          setLoyaltyFormData({
                            name: loyaltyProgram.name || 'Loyalty Rewards',
                            points_per_dollar: loyaltyProgram.points_per_dollar.toString(),
                            point_value: loyaltyProgram.point_value.toString(),
                            min_redemption_points: loyaltyProgram.min_redemption_points.toString(),
                            points_expiry_days: loyaltyProgram.points_expiry_days?.toString() || '',
                          })
                        }
                        setIsEditingLoyalty(false)
                      }}
                    >
                      <Text style={styles.loyaltyButtonTextSecondary}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.loyaltyButton, styles.loyaltyButtonPrimary]}
                      onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                        const data = {
                          name: loyaltyFormData.name || 'Loyalty Rewards',
                          points_per_dollar: parseFloat(loyaltyFormData.points_per_dollar) || 1.0,
                          point_value: parseFloat(loyaltyFormData.point_value) || 0.01,
                          min_redemption_points: parseInt(loyaltyFormData.min_redemption_points) || 100,
                          points_expiry_days: loyaltyFormData.points_expiry_days ? parseInt(loyaltyFormData.points_expiry_days) : null,
                        }
                        const result = loyaltyProgram ? await updateProgram(data) : await createProgram(data)
                        if (result.success) {
                          setIsEditingLoyalty(false)
                        }
                      }}
                    >
                      <Text style={styles.loyaltyButtonTextPrimary}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              // Display mode - show current configuration
              <View style={styles.section}>
                <View style={styles.loyaltyCard}>
                  {/* Status */}
                  <View style={styles.loyaltyStatusRow}>
                    <View style={[styles.loyaltyStatusDot, { backgroundColor: loyaltyProgram.is_active ? '#10B981' : colors.text.quaternary }]} />
                    <Text style={styles.loyaltyStatusText}>
                      {loyaltyProgram.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>

                  <View style={styles.loyaltyConfigGrid}>
                    <View style={styles.loyaltyConfigItem}>
                      <Text style={styles.loyaltyConfigLabel}>Points per Dollar</Text>
                      <Text style={styles.loyaltyConfigValue}>{loyaltyProgram.points_per_dollar}× points</Text>
                    </View>

                    <View style={styles.loyaltyConfigItem}>
                      <Text style={styles.loyaltyConfigLabel}>Point Value</Text>
                      <Text style={styles.loyaltyConfigValue}>${loyaltyProgram.point_value.toFixed(4)} per point</Text>
                    </View>

                    <View style={styles.loyaltyConfigItem}>
                      <Text style={styles.loyaltyConfigLabel}>Minimum Redemption</Text>
                      <Text style={styles.loyaltyConfigValue}>{loyaltyProgram.min_redemption_points} points</Text>
                    </View>

                    <View style={styles.loyaltyConfigItem}>
                      <Text style={styles.loyaltyConfigLabel}>Points Expiry</Text>
                      <Text style={styles.loyaltyConfigValue}>
                        {loyaltyProgram.points_expiry_days ? `${loyaltyProgram.points_expiry_days} days` : 'Never expires'}
                      </Text>
                    </View>
                  </View>

                  {/* Example */}
                  <View style={styles.loyaltyExample}>
                    <Text style={styles.loyaltyExampleLabel}>Example:</Text>
                    <Text style={styles.loyaltyExampleText}>
                      $100 purchase = {Math.floor(100 * loyaltyProgram.points_per_dollar)} points = ${(100 * loyaltyProgram.points_per_dollar * loyaltyProgram.point_value).toFixed(2)} value
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        )

      case 'discounts':
        return (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <TitleSection
              title="Discounts"
              logo={vendor?.logo_url}
              subtitle={`${discountCampaigns.length} discount codes`}
            />

            {/* Use the CampaignsDetail component from Settings */}
            <CampaignsDetail
              campaigns={discountCampaigns}
              stats={discountStats}
              isLoading={discountsLoading}
              onCreate={createDiscount}
              onUpdate={updateDiscount}
              onDelete={deleteDiscount}
              onToggleStatus={toggleDiscountStatus}
            />

            <View style={{ height: 100 }} />
          </ScrollView>
        )

      case 'channels':
        return (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <TitleSection
              title="Channels"
              logo={vendor?.logo_url}
              subtitle="Marketing channels"
            />

            <View style={styles.placeholderContent}>
              <View style={styles.placeholderIcon}>
                <Ionicons name="share-social-outline" size={48} color={colors.text.quaternary} />
              </View>
              <Text style={styles.placeholderTitle}>Coming Soon</Text>
              <Text style={styles.placeholderSubtitle}>
                Connect your marketing channels like SMS, push notifications, and social media
              </Text>
            </View>
          </ScrollView>
        )

      case 'affiliates':
        return (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[styles.contentScrollContent, { paddingBottom: layout.dockHeight + spacing.lg }]}
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <TitleSection
              title="Affiliates"
              logo={vendor?.logo_url}
              subtitle={`${affiliates.length} affiliates`}
              buttonText="+ Add Affiliate"
              onButtonPress={() => {
                setAffiliateFormData({
                  email: '',
                  first_name: '',
                  last_name: '',
                  phone: '',
                  company_name: '',
                  website_url: '',
                  commission_rate: 10,
                  customer_discount_rate: 0,
                  payment_method: 'paypal',
                  minimum_payout: 50,
                  notes: '',
                })
                setShowAffiliateModal(true)
              }}
            />

            {/* Hero Stats */}
            <View style={styles.heroSection}>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>{affiliateStats?.totalAffiliates || 0}</Text>
                <Text style={styles.heroLabel}>Total Affiliates</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>{affiliateStats?.activeAffiliates || 0}</Text>
                <Text style={styles.heroLabel}>Active</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>{affiliateStats?.totalClicks || 0}</Text>
                <Text style={styles.heroLabel}>Total Clicks</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>{affiliateStats?.conversionRate?.toFixed(1) || 0}%</Text>
                <Text style={styles.heroLabel}>Conv. Rate</Text>
              </View>
            </View>

            <View style={styles.heroSection}>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>${(affiliateStats?.totalRevenue || 0).toLocaleString()}</Text>
                <Text style={styles.heroLabel}>Total Revenue</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>${(affiliateStats?.totalCommissionEarned || 0).toFixed(2)}</Text>
                <Text style={styles.heroLabel}>Commission Earned</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>${(affiliateStats?.pendingCommission || 0).toFixed(2)}</Text>
                <Text style={styles.heroLabel}>Pending</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>${(affiliateStats?.totalCommissionPaid || 0).toFixed(2)}</Text>
                <Text style={styles.heroLabel}>Paid Out</Text>
              </View>
            </View>

            {/* Affiliates List */}
            {affiliatesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.text.secondary} />
              </View>
            ) : affiliates.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={colors.text.quaternary} />
                <Text style={styles.emptyStateTitle}>No Affiliates Yet</Text>
                <Text style={styles.emptyStateText}>
                  Add your first affiliate partner to start tracking referrals
                </Text>
              </View>
            ) : (
              <View style={styles.glassCard}>
                {affiliates.map((affiliate, index) => (
                  <Pressable
                    key={affiliate.id}
                    style={[
                      styles.affiliateRow,
                      index < affiliates.length - 1 && styles.borderBottom
                    ]}
                    onPress={() => selectAffiliate(affiliate)}
                  >
                    <View style={styles.affiliateInfo}>
                      <View style={styles.affiliateAvatar}>
                        <Text style={styles.affiliateInitials}>
                          {affiliate.first_name?.[0]?.toUpperCase() || ''}{affiliate.last_name?.[0]?.toUpperCase() || ''}
                        </Text>
                      </View>
                      <View style={styles.affiliateDetails}>
                        <Text style={styles.affiliateName}>
                          {affiliate.first_name} {affiliate.last_name}
                        </Text>
                        <Text style={styles.affiliateEmail}>{affiliate.email}</Text>
                        <View style={styles.affiliateMeta}>
                          <Text style={styles.affiliateCode}>Code: {affiliate.referral_code}</Text>
                          <Text style={styles.affiliateCommission}>{affiliate.commission_rate}% commission</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.affiliateStats}>
                      <View style={styles.affiliateStat}>
                        <Text style={styles.affiliateStatValue}>{affiliate.total_orders}</Text>
                        <Text style={styles.affiliateStatLabel}>Orders</Text>
                      </View>
                      <View style={styles.affiliateStat}>
                        <Text style={styles.affiliateStatValue}>${affiliate.total_revenue.toFixed(0)}</Text>
                        <Text style={styles.affiliateStatLabel}>Revenue</Text>
                      </View>
                      <View style={styles.affiliateStat}>
                        <Text style={styles.affiliateStatValue}>${affiliate.pending_commission.toFixed(2)}</Text>
                        <Text style={styles.affiliateStatLabel}>Pending</Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        affiliate.status === 'active' && styles.statusActive,
                        affiliate.status === 'pending' && styles.statusPending,
                        affiliate.status === 'paused' && styles.statusPaused,
                        affiliate.status === 'terminated' && styles.statusTerminated,
                      ]}>
                        <Text style={[
                          styles.statusText,
                          affiliate.status === 'active' && styles.statusTextActive,
                          affiliate.status === 'pending' && styles.statusTextPending,
                          affiliate.status === 'paused' && styles.statusTextPaused,
                          affiliate.status === 'terminated' && styles.statusTextTerminated,
                        ]}>
                          {affiliate.status.charAt(0).toUpperCase() + affiliate.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.text.quaternary} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Affiliate Detail Panel */}
            {selectedAffiliate && (
              <View style={[styles.glassCard, { marginTop: spacing.lg }]}>
                <View style={styles.affiliateDetailHeader}>
                  <Text style={styles.affiliateDetailTitle}>
                    {selectedAffiliate.first_name} {selectedAffiliate.last_name}
                  </Text>
                  <Pressable onPress={() => selectAffiliate(null)}>
                    <Ionicons name="close" size={24} color={colors.text.secondary} />
                  </Pressable>
                </View>

                <View style={styles.affiliateDetailRow}>
                  <Text style={styles.affiliateDetailLabel}>Email</Text>
                  <Text style={styles.affiliateDetailValue}>{selectedAffiliate.email}</Text>
                </View>
                <View style={styles.affiliateDetailRow}>
                  <Text style={styles.affiliateDetailLabel}>Referral Code</Text>
                  <Text style={[styles.affiliateDetailValue, styles.codeText]}>{selectedAffiliate.referral_code}</Text>
                </View>
                <View style={styles.affiliateDetailRow}>
                  <Text style={styles.affiliateDetailLabel}>Commission Rate</Text>
                  <Text style={styles.affiliateDetailValue}>{selectedAffiliate.commission_rate}%</Text>
                </View>
                <View style={styles.affiliateDetailRow}>
                  <Text style={styles.affiliateDetailLabel}>Customer Discount</Text>
                  <Text style={styles.affiliateDetailValue}>
                    {selectedAffiliate.customer_discount_rate > 0
                      ? `${selectedAffiliate.customer_discount_rate}${selectedAffiliate.customer_discount_type === 'percentage' ? '%' : ' fixed'}`
                      : 'None'}
                  </Text>
                </View>
                <View style={styles.affiliateDetailRow}>
                  <Text style={styles.affiliateDetailLabel}>Total Clicks</Text>
                  <Text style={styles.affiliateDetailValue}>{selectedAffiliate.total_clicks}</Text>
                </View>
                <View style={styles.affiliateDetailRow}>
                  <Text style={styles.affiliateDetailLabel}>Total Orders</Text>
                  <Text style={styles.affiliateDetailValue}>{selectedAffiliate.total_orders}</Text>
                </View>
                <View style={styles.affiliateDetailRow}>
                  <Text style={styles.affiliateDetailLabel}>Total Revenue</Text>
                  <Text style={styles.affiliateDetailValue}>${selectedAffiliate.total_revenue.toFixed(2)}</Text>
                </View>
                <View style={styles.affiliateDetailRow}>
                  <Text style={styles.affiliateDetailLabel}>Pending Commission</Text>
                  <Text style={styles.affiliateDetailValue}>${selectedAffiliate.pending_commission.toFixed(2)}</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.affiliateActions}>
                  {selectedAffiliate.status === 'pending' && (
                    <Pressable
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => user?.id && approveAffiliate(selectedAffiliate.id, user.id)}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Approve</Text>
                    </Pressable>
                  )}
                  {selectedAffiliate.status === 'active' && (
                    <Pressable
                      style={[styles.actionButton, styles.pauseButton]}
                      onPress={() => pauseAffiliate(selectedAffiliate.id)}
                    >
                      <Ionicons name="pause" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Pause</Text>
                    </Pressable>
                  )}
                  {selectedAffiliate.status === 'paused' && (
                    <Pressable
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => user?.id && approveAffiliate(selectedAffiliate.id, user.id)}
                    >
                      <Ionicons name="play" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Reactivate</Text>
                    </Pressable>
                  )}
                  {selectedAffiliate.status !== 'terminated' && (
                    <Pressable
                      style={[styles.actionButton, styles.terminateButton]}
                      onPress={() => terminateAffiliate(selectedAffiliate.id)}
                    >
                      <Ionicons name="close-circle" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Terminate</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        )

      case 'wallet':
        return (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[styles.contentScrollContent, { paddingBottom: layout.dockHeight + spacing.lg }]}
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <TitleSection
              title="Apple Wallet"
              logo={vendor?.logo_url}
              subtitle="Order pass marketing & analytics"
            />

            {/* HERO STATS */}
            <View style={styles.heroSection}>
              <View style={styles.heroCard}>
                <Ionicons name="wallet" size={24} color={colors.text.secondary} style={{ marginBottom: spacing.xs }} />
                <Text style={styles.heroNumber}>{walletStats?.totalPasses || 0}</Text>
                <Text style={styles.heroLabel}>Total Passes</Text>
              </View>
              <View style={styles.heroCard}>
                <Ionicons name="phone-portrait" size={24} color="#34c759" style={{ marginBottom: spacing.xs }} />
                <Text style={styles.heroNumber}>{walletStats?.activePasses || 0}</Text>
                <Text style={styles.heroLabel}>Active on Devices</Text>
              </View>
              <View style={styles.heroCard}>
                <Ionicons name="notifications" size={24} color="#007AFF" style={{ marginBottom: spacing.xs }} />
                <Text style={styles.heroNumber}>{walletStats?.pushEnabled || 0}</Text>
                <Text style={styles.heroLabel}>Push Enabled</Text>
              </View>
              <View style={styles.heroCard}>
                <Ionicons name="trending-up" size={24} color="#A855F7" style={{ marginBottom: spacing.xs }} />
                <Text style={styles.heroNumber}>
                  {walletStats?.totalPasses && walletStats?.activePasses
                    ? `${Math.round((walletStats.activePasses / walletStats.totalPasses) * 100)}%`
                    : '0%'}
                </Text>
                <Text style={styles.heroLabel}>Adoption Rate</Text>
              </View>
            </View>

            {/* PASS PREVIEW */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Pass Preview</Text>
              <Text style={styles.sectionSubtitle}>How your order passes appear in customers' Apple Wallet</Text>

              {/* Mock Pass Preview */}
              <View style={styles.walletPassPreview}>
                <View style={styles.walletPassCard}>
                  {/* Pass Header */}
                  <View style={styles.walletPassHeader}>
                    {vendor?.logo_url ? (
                      <View style={styles.walletPassLogo}>
                        <Text style={styles.walletPassLogoText}>
                          {vendor.store_name?.charAt(0) || 'F'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.walletPassLogo}>
                        <Text style={styles.walletPassLogoText}>F</Text>
                      </View>
                    )}
                    <Text style={styles.walletPassStoreName}>{vendor?.store_name || 'Flora Distro'}</Text>
                    <View style={styles.walletPassHeaderField}>
                      <Text style={styles.walletPassFieldLabel}>ORDER</Text>
                      <Text style={styles.walletPassFieldValue}>SHIPPING</Text>
                    </View>
                  </View>

                  {/* Primary Field */}
                  <View style={styles.walletPassPrimary}>
                    <Text style={styles.walletPassPrimaryLabel}>STATUS</Text>
                    <Text style={styles.walletPassPrimaryValue}>SHIPPED</Text>
                  </View>

                  {/* Secondary Fields */}
                  <View style={styles.walletPassSecondary}>
                    <View style={styles.walletPassSecondaryField}>
                      <Text style={styles.walletPassFieldLabel}>DETAILS</Text>
                      <Text style={styles.walletPassFieldValue}>On the way</Text>
                    </View>
                    <View style={styles.walletPassSecondaryField}>
                      <Text style={styles.walletPassFieldLabel}>TOTAL</Text>
                      <Text style={styles.walletPassFieldValue}>$89.99</Text>
                    </View>
                  </View>

                  {/* Auxiliary Fields */}
                  <View style={styles.walletPassAuxiliary}>
                    <View style={styles.walletPassSecondaryField}>
                      <Text style={styles.walletPassFieldLabel}>PROGRESS</Text>
                      <Text style={styles.walletPassFieldValue}>Step 3 of 4</Text>
                    </View>
                    <View style={styles.walletPassSecondaryField}>
                      <Text style={styles.walletPassFieldLabel}>TRACKING</Text>
                      <Text style={styles.walletPassFieldValue}>9400111...</Text>
                    </View>
                  </View>
                </View>

                {/* Pass Description */}
                <View style={styles.walletPassDescription}>
                  <Text style={styles.walletPassDescriptionTitle}>Real-time Order Updates</Text>
                  <Text style={styles.walletPassDescriptionText}>
                    Customers receive push notifications on their lock screen when order status changes.
                    Pass automatically updates with tracking info and delivery progress.
                  </Text>
                </View>
              </View>
            </View>

            {/* RECENT ACTIVITY */}
            {walletStats?.recentActivity && walletStats.recentActivity.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Pass Activity</Text>
                <View style={styles.glassCard}>
                  {walletStats.recentActivity.map((activity, index) => (
                    <View
                      key={`${activity.order_number}-${index}`}
                      style={[
                        styles.activityRow,
                        index < walletStats.recentActivity.length - 1 && styles.borderBottom,
                      ]}
                    >
                      <View style={styles.activityIcon}>
                        <Ionicons
                          name={activity.status === 'delivered' || activity.status === 'completed' ? 'checkmark-circle' : 'sync'}
                          size={20}
                          color={activity.status === 'delivered' || activity.status === 'completed' ? '#34c759' : '#007AFF'}
                        />
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityOrder}>Order #{activity.order_number}</Text>
                        <Text style={styles.activityStatus}>
                          Pass updated to: {activity.status.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.activityTime}>
                        {new Date(activity.updated_at).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* MARKETING OPTIONS */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Marketing Features</Text>
              <Text style={styles.sectionSubtitle}>Coming soon: promotional passes & campaigns</Text>

              <View style={styles.comingSoonCards}>
                <View style={styles.comingSoonCard}>
                  <View style={styles.comingSoonIcon}>
                    <Ionicons name="megaphone" size={28} color={colors.text.tertiary} />
                  </View>
                  <Text style={styles.comingSoonTitle}>Promo Pass Campaigns</Text>
                  <Text style={styles.comingSoonDescription}>
                    Create limited-time discount passes that customers can add to their Apple Wallet.
                    Push notifications remind them before expiration.
                  </Text>
                </View>

                <View style={styles.comingSoonCard}>
                  <View style={styles.comingSoonIcon}>
                    <Ionicons name="location" size={28} color={colors.text.tertiary} />
                  </View>
                  <Text style={styles.comingSoonTitle}>Location-Based Alerts</Text>
                  <Text style={styles.comingSoonDescription}>
                    Trigger wallet notifications when customers are near your store locations.
                    Perfect for driving foot traffic.
                  </Text>
                </View>

                <View style={styles.comingSoonCard}>
                  <View style={styles.comingSoonIcon}>
                    <Ionicons name="gift" size={28} color={colors.text.tertiary} />
                  </View>
                  <Text style={styles.comingSoonTitle}>Loyalty Pass Integration</Text>
                  <Text style={styles.comingSoonDescription}>
                    Combine order tracking with loyalty rewards.
                    Show points balance and tier status on the pass.
                  </Text>
                </View>
              </View>
            </View>

            {walletLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.text.secondary} />
              </View>
            )}
          </ScrollView>
        )

      default:
        return null
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.layout}>
        {/* NAV SIDEBAR */}
        <NavSidebar
          width={layout.sidebarWidth}
          items={navItems}
          activeItemId={activeNav}
          onItemPress={(id) => setActiveNav(id as 'campaigns' | 'loyalty' | 'discounts' | 'channels' | 'affiliates' | 'wallet')}
          vendorName={vendor?.store_name || ''}
          vendorLogo={vendor?.logo_url || null}
        />

        {/* CONTENT AREA */}
        <View style={styles.contentArea}>
          {renderContent()}
        </View>
      </View>

      {/* CAMPAIGN CREATOR MODAL */}
      <Modal
        visible={showCreatorModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseCreator}
      >
        <View style={[styles.creatorContainer, { paddingTop: insets.top }]}>
          <View style={styles.creatorLayout}>
            {/* SIDEBAR */}
            <View style={styles.creatorSidebar}>
              <View style={styles.creatorHeader}>
                <Pressable onPress={handleCloseCreator}>
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </Pressable>
                <Text style={styles.creatorTitle}>
                  {editingDraftId ? 'Edit Draft' : 'Create Campaign'}
                </Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView
                style={styles.creatorScroll}
                contentContainerStyle={styles.creatorContent}
                showsVerticalScrollIndicator={false}
              >
                {/* STEP 1: Prompt - only show when creating new (not editing draft) */}
                {!editingDraftId && (
                  <View style={styles.creatorSection}>
                    <Text style={styles.stepLabel}>1. WHAT DO YOU WANT TO SAY?</Text>
                    <TextInput
                      style={styles.promptInput}
                      value={prompt}
                      onChangeText={setPrompt}
                      placeholder="e.g., Announce our weekend sale with 20% off all products..."
                      placeholderTextColor={colors.text.placeholder}
                      multiline
                      textAlignVertical="top"
                    />
                    <Pressable
                      style={[styles.generateButton, (!prompt.trim() || isGenerating) && styles.buttonDisabled]}
                      onPress={handleGenerate}
                      disabled={!prompt.trim() || isGenerating}
                    >
                      {isGenerating ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                      <>
                        <Ionicons name="sparkles" size={18} color="#000" />
                        <Text style={styles.generateButtonText}>Generate Email</Text>
                      </>
                    )}
                  </Pressable>
                </View>
                )}

                {/* STEP 2: Subject (shows after generation or when editing draft) */}
                {(currentHtml || editingDraftId) && (
                  <>
                    <View style={styles.creatorSection}>
                      <Text style={styles.stepLabel}>2. SUBJECT LINE</Text>
                      <TextInput
                        style={styles.subjectInput}
                        value={editedSubject}
                        onChangeText={setEditedSubject}
                        placeholder="Enter subject line..."
                        placeholderTextColor={colors.text.placeholder}
                      />
                      <View style={styles.buttonRow}>
                        <Pressable
                          style={styles.testButton}
                          onPress={() => {
                            console.log('[Marketing] Send Test button pressed')
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            setShowTestModal(true)
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="paper-plane-outline" size={16} color={colors.text.secondary} />
                          <Text style={styles.testButtonText}>Send Test</Text>
                        </Pressable>
                        <Pressable
                          style={styles.resetButton}
                          onPress={handleStartOver}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="refresh" size={18} color={colors.text.secondary} />
                        </Pressable>
                      </View>
                    </View>

                    {/* DISCOUNT CODE - Minimal Magical Section */}
                    <View style={styles.creatorSection}>
                      <Text style={styles.stepLabel}>ADD A DISCOUNT CODE (OPTIONAL)</Text>

                      {discountCode ? (
                        // Show created discount code
                        <View style={styles.discountCreated}>
                          <View style={styles.discountCodeDisplay}>
                            <Ionicons name="pricetag" size={20} color={colors.semantic.success} />
                            <View style={styles.discountCodeInfo}>
                              <Text style={styles.discountCodeText}>{discountCode.coupon_code}</Text>
                              <Text style={styles.discountCodeValue}>
                                {discountCode.discount_type === 'percentage'
                                  ? `${discountCode.discount_value}% off`
                                  : `$${discountCode.discount_value} off`}
                              </Text>
                            </View>
                          </View>
                          <Pressable
                            style={styles.discountRemoveButton}
                            onPress={() => clearDiscountCode()}
                          >
                            <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
                          </Pressable>
                        </View>
                      ) : showDiscountCreator ? (
                        // Inline discount creator
                        <View style={styles.discountCreator}>
                          <View style={styles.discountRow}>
                            <TextInput
                              style={styles.discountCodeInputField}
                              value={discountCodeInput}
                              onChangeText={setDiscountCodeInput}
                              placeholder="CODE (auto if blank)"
                              placeholderTextColor={colors.text.placeholder}
                              autoCapitalize="characters"
                            />
                            <TextInput
                              style={styles.discountValueInput}
                              value={discountValue}
                              onChangeText={setDiscountValue}
                              placeholder="20"
                              placeholderTextColor={colors.text.placeholder}
                              keyboardType="numeric"
                            />
                            <Pressable
                              style={[
                                styles.discountTypeToggle,
                                discountType === 'percentage' && styles.discountTypeActive
                              ]}
                              onPress={() => setDiscountType('percentage')}
                            >
                              <Text style={[
                                styles.discountTypeText,
                                discountType === 'percentage' && styles.discountTypeTextActive
                              ]}>%</Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.discountTypeToggle,
                                discountType === 'fixed' && styles.discountTypeActive
                              ]}
                              onPress={() => setDiscountType('fixed')}
                            >
                              <Text style={[
                                styles.discountTypeText,
                                discountType === 'fixed' && styles.discountTypeTextActive
                              ]}>$</Text>
                            </Pressable>
                          </View>
                          <View style={styles.discountActions}>
                            <Pressable
                              style={styles.discountCancelButton}
                              onPress={() => setShowDiscountCreator(false)}
                            >
                              <Text style={styles.discountCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.discountCreateButton, isCreatingDiscount && styles.buttonDisabled]}
                              onPress={handleCreateDiscount}
                              disabled={isCreatingDiscount}
                            >
                              {isCreatingDiscount ? (
                                <ActivityIndicator size="small" color="#000" />
                              ) : (
                                <Text style={styles.discountCreateText}>Create Code</Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        // Button to show creator
                        <Pressable
                          style={styles.addDiscountButton}
                          onPress={() => setShowDiscountCreator(true)}
                        >
                          <Ionicons name="add-circle-outline" size={20} color={colors.text.secondary} />
                          <Text style={styles.addDiscountText}>Add discount code for this campaign</Text>
                        </Pressable>
                      )}
                    </View>

                    {/* STEP 3: Audience */}
                    <View style={styles.creatorSection}>
                      <Text style={styles.stepLabel}>3. WHO SHOULD RECEIVE THIS?</Text>

                      {/* All Customers option */}
                      <Pressable
                        style={[styles.audienceOption, !selectedSegmentId && styles.audienceOptionSelected]}
                        onPress={() => setSelectedSegment(null)}
                      >
                        <View style={[styles.radio, !selectedSegmentId && styles.radioSelected]}>
                          {!selectedSegmentId && <View style={styles.radioDot} />}
                        </View>
                        <View style={styles.audienceInfo}>
                          <Text style={styles.audienceName}>All Customers</Text>
                          <Text style={styles.audienceDesc}>Send to everyone in your database</Text>
                        </View>
                      </Pressable>

                      {/* Segment options */}
                      {segments.filter(s => s.customer_count > 0).slice(0, 5).map((segment) => (
                        <Pressable
                          key={segment.id}
                          style={[styles.audienceOption, selectedSegmentId === segment.id && styles.audienceOptionSelected]}
                          onPress={() => setSelectedSegment(segment.id)}
                        >
                          <View style={[styles.radio, selectedSegmentId === segment.id && styles.radioSelected]}>
                            {selectedSegmentId === segment.id && <View style={styles.radioDot} />}
                          </View>
                          <View style={styles.audienceInfo}>
                            <View style={styles.audienceNameRow}>
                              <Text style={styles.audienceName}>{segment.name}</Text>
                              <View style={[styles.segmentBadge, { backgroundColor: `${segment.color || '#6366F1'}20` }]}>
                                <Text style={[styles.segmentBadgeText, { color: segment.color || '#6366F1' }]}>
                                  {segment.customer_count}
                                </Text>
                              </View>
                            </View>
                            {segment.description && (
                              <Text style={styles.audienceDesc}>{segment.description}</Text>
                            )}
                          </View>
                        </Pressable>
                      ))}
                    </View>

                    {/* STEP 4: Send */}
                    <View style={styles.creatorSection}>
                      <Text style={styles.stepLabel}>4. SEND IT</Text>
                      <View style={styles.sendInfo}>
                        <Ionicons name="people" size={20} color={colors.text.secondary} />
                        <Text style={styles.sendInfoText}>
                          {audienceCount.toLocaleString()} customers will receive this email
                        </Text>
                      </View>
                      <View style={styles.sendButtonsRow}>
                        <Pressable
                          style={[styles.saveDraftButton, isSavingDraft && styles.buttonDisabled]}
                          onPress={handleSaveDraft}
                          disabled={isSavingDraft}
                        >
                          {isSavingDraft ? (
                            <ActivityIndicator size="small" color={colors.text.secondary} />
                          ) : (
                            <>
                              <Ionicons name="bookmark-outline" size={18} color={colors.text.secondary} />
                              <Text style={styles.saveDraftText}>Save Draft</Text>
                            </>
                          )}
                        </Pressable>
                        <Pressable
                          style={[styles.sendButton, audienceCount === 0 && styles.buttonDisabled]}
                          onPress={() => setShowConfirmModal(true)}
                          disabled={audienceCount === 0}
                        >
                          <Ionicons name="send" size={18} color="#fff" />
                          <Text style={styles.sendButtonText}>Review & Send</Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}
              </ScrollView>
            </View>

            {/* PREVIEW AREA */}
            <View style={styles.creatorPreview}>
              {previewHtml ? (
                <WebView
                  source={{ html: previewHtml }}
                  style={styles.webview}
                  scrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  onMessage={handleWebViewMessage}
                  originWhitelist={['*']}
                  javaScriptEnabled={true}
                />
              ) : (
                <View style={styles.emptyPreview}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="mail-outline" size={48} color={colors.text.quaternary} />
                  </View>
                  <Text style={styles.emptyPreviewTitle}>Your email will appear here</Text>
                  <Text style={styles.emptyPreviewSubtitle}>
                    Tell us what you want to say and we&apos;ll create a beautiful email for you
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* TEST EMAIL MODAL - Inside Creator Modal so it appears on top */}
          <Modal
            visible={showTestModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowTestModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.testModalContent}>
                {testSentSuccess ? (
                  <>
                    <Ionicons name="checkmark-circle" size={48} color={colors.semantic.success} />
                    <Text style={styles.testSuccessText}>Test email sent!</Text>
                    <Text style={styles.testSuccessSubtext}>Check your inbox at {testEmail}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.modalTitle}>Send Test Email</Text>
                    <Text style={styles.testModalSubtitle}>
                      Preview this email in your inbox before sending to customers
                    </Text>

                    <TextInput
                      style={styles.testEmailInput}
                      value={testEmail}
                      onChangeText={setTestEmail}
                      placeholder="Enter your email address..."
                      placeholderTextColor={colors.text.placeholder}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoFocus
                    />

                    <View style={styles.modalButtons}>
                      <Pressable style={styles.modalCancelButton} onPress={() => setShowTestModal(false)}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.testSendButton, (!testEmail.trim() || isSendingTest) && styles.buttonDisabled]}
                        onPress={handleSendTest}
                        disabled={!testEmail.trim() || isSendingTest}
                      >
                        {isSendingTest ? (
                          <ActivityIndicator size="small" color="#000" />
                        ) : (
                          <>
                            <Ionicons name="paper-plane" size={16} color="#000" />
                            <Text style={styles.testSendText}>Send Test</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>
        </View>
      </Modal>

      {/* CONFIRMATION MODAL */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ready to send?</Text>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Subject</Text>
              <Text style={styles.modalValue}>{editedSubject || draftCampaign?.subject}</Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Audience</Text>
              <Text style={styles.modalValue}>{selectedSegment?.name || 'All Customers'}</Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Recipients</Text>
              <Text style={styles.modalValueLarge}>{audienceCount.toLocaleString()}</Text>
            </View>

            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelButton} onPress={() => setShowConfirmModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSendButton, isSending && styles.buttonDisabled]}
                onPress={handleConfirmSend}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.modalSendText}>Send Now</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* CAMPAIGN DETAIL MODAL */}
      <Modal
        visible={showCampaignDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCampaignDetail(false)}
      >
        <View style={styles.detailOverlay}>
          <View style={styles.detailContent}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailTitle}>CAMPAIGN</Text>
                <Text style={styles.detailSubject}>{selectedCampaign?.subject}</Text>
              </View>
              <Pressable style={styles.detailCloseButton} onPress={() => setShowCampaignDetail(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </Pressable>
            </View>

            {selectedCampaign && (() => {
              const c = selectedCampaign
              const openRate = c.delivered_count > 0 ? Math.round((c.opened_count / c.delivered_count) * 100) : 0
              const clickRate = c.opened_count > 0 ? Math.round((c.clicked_count / c.opened_count) * 100) : 0
              const bounceRate = c.sent_count > 0 ? ((c.bounced_count / c.sent_count) * 100).toFixed(1) : '0'

              return (
                <ScrollView style={styles.detailScroll}>
                  <View style={styles.detailMetrics}>
                    <View style={styles.detailMetric}>
                      <Text style={styles.detailMetricValue}>{c.sent_count.toLocaleString()}</Text>
                      <Text style={styles.detailMetricLabel}>Sent</Text>
                    </View>
                    <View style={styles.detailMetric}>
                      <Text style={styles.detailMetricValue}>{c.delivered_count.toLocaleString()}</Text>
                      <Text style={styles.detailMetricLabel}>Delivered</Text>
                    </View>
                    <View style={styles.detailMetric}>
                      <Text style={styles.detailMetricValue}>{openRate}%</Text>
                      <Text style={styles.detailMetricLabel}>Opened</Text>
                    </View>
                    <View style={styles.detailMetric}>
                      <Text style={styles.detailMetricValue}>{clickRate}%</Text>
                      <Text style={styles.detailMetricLabel}>Clicked</Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Campaign Info</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Audience</Text>
                      <Text style={styles.infoValue}>
                        {c.audience_type === 'all' ? 'All Customers' : 'Segment'}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Recipients</Text>
                      <Text style={styles.infoValue}>{c.recipient_count.toLocaleString()}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Sent</Text>
                      <Text style={styles.infoValue}>
                        {c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                        }) : '-'}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Bounce Rate</Text>
                      <Text style={styles.infoValue}>{bounceRate}%</Text>
                    </View>
                  </View>
                </ScrollView>
              )
            })()}
          </View>
        </View>
      </Modal>

      {/* ADD AFFILIATE MODAL */}
      <Modal
        visible={showAffiliateModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowAffiliateModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowAffiliateModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Add Affiliate</Text>
            <Pressable
              onPress={async () => {
                if (!vendor?.id || !affiliateFormData.email || !affiliateFormData.first_name) return
                const result = await createAffiliate(vendor.id, affiliateFormData)
                if (result) {
                  setShowAffiliateModal(false)
                  loadAffiliateStats(vendor.id)
                }
              }}
            >
              <Text style={styles.modalDone}>Add</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>First Name *</Text>
              <TextInput
                style={styles.formInput}
                value={affiliateFormData.first_name}
                onChangeText={(v) => setAffiliateFormData(d => ({ ...d, first_name: v }))}
                placeholder="John"
                placeholderTextColor={colors.text.quaternary}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Last Name *</Text>
              <TextInput
                style={styles.formInput}
                value={affiliateFormData.last_name}
                onChangeText={(v) => setAffiliateFormData(d => ({ ...d, last_name: v }))}
                placeholder="Smith"
                placeholderTextColor={colors.text.quaternary}
              />
            </View>

            {/* Contact */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email *</Text>
              <TextInput
                style={styles.formInput}
                value={affiliateFormData.email}
                onChangeText={(v) => setAffiliateFormData(d => ({ ...d, email: v }))}
                placeholder="affiliate@example.com"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone</Text>
              <TextInput
                style={styles.formInput}
                value={affiliateFormData.phone || ''}
                onChangeText={(v) => setAffiliateFormData(d => ({ ...d, phone: v }))}
                placeholder="(555) 123-4567"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="phone-pad"
              />
            </View>

            {/* Business Info */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Company Name</Text>
              <TextInput
                style={styles.formInput}
                value={affiliateFormData.company_name || ''}
                onChangeText={(v) => setAffiliateFormData(d => ({ ...d, company_name: v }))}
                placeholder="Company Inc."
                placeholderTextColor={colors.text.quaternary}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Website</Text>
              <TextInput
                style={styles.formInput}
                value={affiliateFormData.website_url || ''}
                onChangeText={(v) => setAffiliateFormData(d => ({ ...d, website_url: v }))}
                placeholder="https://example.com"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            {/* Commission Settings */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Commission Rate (%)</Text>
              <TextInput
                style={styles.formInput}
                value={affiliateFormData.commission_rate?.toString() || '10'}
                onChangeText={(v) => setAffiliateFormData(d => ({ ...d, commission_rate: parseFloat(v) || 10 }))}
                placeholder="10"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Customer Discount Settings */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Customer Discount (0 = none)</Text>
              <TextInput
                style={styles.formInput}
                value={affiliateFormData.customer_discount_rate?.toString() || '0'}
                onChangeText={(v) => setAffiliateFormData(d => ({ ...d, customer_discount_rate: parseFloat(v) || 0 }))}
                placeholder="0"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="decimal-pad"
              />
              <Text style={styles.formHint}>Discount given to customer when using this affiliate's code</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Minimum Payout ($)</Text>
              <TextInput
                style={styles.formInput}
                value={affiliateFormData.minimum_payout?.toString() || '50'}
                onChangeText={(v) => setAffiliateFormData(d => ({ ...d, minimum_payout: parseFloat(v) || 50 }))}
                placeholder="50"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 80 }]}
                value={affiliateFormData.notes || ''}
                onChangeText={(v) => setAffiliateFormData(d => ({ ...d, notes: v }))}
                placeholder="Internal notes about this affiliate..."
                placeholderTextColor={colors.text.quaternary}
                multiline
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

export const MarketingScreen = memo(MarketingScreenComponent)
MarketingScreen.displayName = 'MarketingScreen'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  // Layout
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  // Content Scroll
  contentScroll: {
    flex: 1,
  },
  contentScrollContent: {
    padding: spacing.lg,
  },

  // Content Header
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  contentTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },

  // Placeholder Content (Coming Soon views)
  placeholderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  placeholderIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  placeholderSubtitle: {
    fontSize: 16,
    color: colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.lg,
  },
  comingSoon: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.quaternary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Hero Section
  heroSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  heroCard: {
    minWidth: 150,
    flex: 1,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  heroLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
  },

  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },

  // Segment Grid
  segmentGrid: {
    gap: spacing.sm,
  },
  segmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  segmentDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  segmentInfo: {
    flex: 1,
  },
  segmentName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  segmentCount: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  segmentPercent: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  // Reachability Grid
  reachabilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reachabilityCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  reachabilityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  reachabilityValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  reachabilityLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  reachabilityPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 4,
  },
  contactBreakdown: {
    backgroundColor: colors.glass.thin,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  contactBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  contactBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  contactBreakdownLabel: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  contactBreakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },

  // Audience Chips
  audienceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  audienceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.glass.thin,
  },
  audienceChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  audienceChipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  audienceChipCount: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Metrics Row
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  // Campaign Card
  campaignCard: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  campaignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  campaignInfo: {
    flex: 1,
  },
  campaignSubject: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  campaignDate: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  campaignStats: {
    flexDirection: 'row',
  },
  campaignStat: {
    flex: 1,
    alignItems: 'center',
  },
  campaignStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  campaignStatLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  emptyButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },

  // Creator Modal
  creatorContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  creatorLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  creatorSidebar: {
    width: 380,
    backgroundColor: colors.background.secondary,
    borderRightWidth: 1,
    borderRightColor: colors.border.subtle,
  },
  creatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  creatorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  creatorScroll: {
    flex: 1,
  },
  creatorContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  creatorSection: {
    marginBottom: spacing.lg,
  },
  creatorPreview: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  // Form Elements
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  promptInput: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 100,
    marginBottom: spacing.sm,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  subjectInput: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  testButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
    backgroundColor: colors.glass.thin,
  },
  testButtonText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
    backgroundColor: colors.glass.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Audience Options
  audienceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: spacing.xs,
  },
  audienceOptionSelected: {
    backgroundColor: colors.glass.regular,
    borderColor: colors.border.regular,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.emphasis,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.semantic.success,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.semantic.success,
  },
  audienceInfo: {
    flex: 1,
  },
  audienceName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  audienceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  audienceDesc: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  segmentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  segmentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Send Section
  sendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.glass.thin,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  sendInfoText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.semantic.success,
    paddingVertical: 16,
    borderRadius: radius.md,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // WebView
  webview: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyPreviewTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyPreviewSubtitle: {
    fontSize: 16,
    color: colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 300,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: 400,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  modalSection: {
    marginBottom: spacing.md,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 16,
    color: colors.text.primary,
  },
  modalValueLarge: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalSendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.semantic.success,
  },
  modalSendText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  testModalContent: {
    width: 400,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  testModalSubtitle: {
    fontSize: 14,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  testEmailInput: {
    width: '100%',
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  testSendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: '#fff',
  },
  testSendText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  testSuccessText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  testSuccessSubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  // Campaign Detail Modal
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  detailContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailSubject: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    maxWidth: 380,
  },
  detailCloseButton: {
    padding: spacing.xs,
  },
  detailScroll: {
    flex: 1,
    padding: spacing.lg,
  },
  detailMetrics: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  detailMetric: {
    flex: 1,
    alignItems: 'center',
  },
  detailMetricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  detailMetricLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  detailSection: {
    marginBottom: spacing.lg,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },

  // Discount Code Styles
  discountCreated: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  discountCodeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  discountCodeInfo: {
    gap: 2,
  },
  discountCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.semantic.success,
    letterSpacing: 1,
  },
  discountCodeValue: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  discountRemoveButton: {
    padding: spacing.xs,
  },
  discountCreator: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  discountCodeInputField: {
    flex: 2,
    backgroundColor: colors.glass.thin,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
    letterSpacing: 1,
  },
  discountValueInput: {
    flex: 1,
    backgroundColor: colors.glass.thin,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text.primary,
    textAlign: 'center',
  },
  discountTypeToggle: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.glass.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountTypeActive: {
    backgroundColor: '#fff',
  },
  discountTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  discountTypeTextActive: {
    color: '#000',
  },
  discountActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  discountCancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  discountCancelText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  discountCreateButton: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: radius.sm,
  },
  discountCreateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  addDiscountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.glass.thin,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderStyle: 'dashed',
  },
  addDiscountText: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Save Draft & Send Buttons Row
  sendButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  saveDraftButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
    backgroundColor: colors.glass.thin,
  },
  saveDraftText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  // Campaign History Tabs
  campaignHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  campaignTabs: {
    flexDirection: 'row',
    backgroundColor: colors.glass.thin,
    borderRadius: radius.pill,
    padding: 3,
  },
  campaignTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  campaignTabActive: {
    backgroundColor: colors.glass.regular,
  },
  campaignTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  campaignTabTextActive: {
    color: colors.text.primary,
  },
  noCampaignsState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  noCampaignsText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  draftBadge: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  draftBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  draftInfo: {
    paddingTop: spacing.sm,
    paddingLeft: 28,
  },
  draftInfoText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },

  // Loading state
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },

  // Loyalty styles
  loyaltyCard: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  loyaltyFormGroup: {
    marginBottom: spacing.lg,
  },
  loyaltyFormLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  loyaltyFormHint: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  loyaltyFormInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 17,
    color: colors.text.primary,
  },
  loyaltyButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  loyaltyButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyButtonPrimary: {
    backgroundColor: '#fff',
  },
  loyaltyButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  loyaltyButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  loyaltyButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  loyaltyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  loyaltyStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loyaltyStatusText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  loyaltyConfigGrid: {
    gap: spacing.md,
  },
  loyaltyConfigItem: {
    marginBottom: spacing.sm,
  },
  loyaltyConfigLabel: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  loyaltyConfigValue: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
  loyaltyExample: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.border.subtle,
  },
  loyaltyExampleLabel: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  loyaltyExampleText: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Affiliate Styles
  affiliateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  affiliateInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  affiliateAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affiliateInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  affiliateDetails: {
    flex: 1,
  },
  affiliateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  affiliateEmail: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  affiliateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  affiliateCode: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontFamily: 'monospace',
  },
  affiliateCommission: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  affiliateStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  affiliateStat: {
    alignItems: 'center',
  },
  affiliateStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  affiliateStatLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    minWidth: 70,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusTextActive: {
    color: '#10B981',
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusTextPending: {
    color: '#F59E0B',
  },
  statusPaused: {
    backgroundColor: 'rgba(107, 114, 128, 0.15)',
  },
  statusTextPaused: {
    color: '#6B7280',
  },
  statusTerminated: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusTextTerminated: {
    color: '#EF4444',
  },
  affiliateDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  affiliateDetailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  affiliateDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  affiliateDetailLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  affiliateDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  codeText: {
    fontFamily: 'monospace',
    backgroundColor: colors.glass.regular,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  affiliateActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.border.subtle,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  pauseButton: {
    backgroundColor: '#6B7280',
  },
  terminateButton: {
    backgroundColor: '#EF4444',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalCancel: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  modalDone: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.regular,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
  },
  formHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
})
