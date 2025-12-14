/**
 * Marketing Screen - iPad Settings-style interface
 * Customer intelligence + Email campaigns + Channels + Discounts + Affiliates
 */

import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView, Modal, Dimensions, Animated, Image, Linking, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import Slider from '@react-native-community/slider'
import React, { useEffect, memo, useState, useCallback, useMemo, useRef } from 'react'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import * as Haptics from 'expo-haptics'
import { Ionicons, FontAwesome5 } from '@expo/vector-icons'
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
// Meta (Facebook/Instagram) imports
import {
  useMetaIntegration,
  useIsMetaConnected,
  useIsMetaConnecting,
  useMetaCampaigns,
  useMetaAdSets,
  useMetaAds,
  useIsMetaSyncing,
  useMetaPosts,
  useIsSyncingMetaPosts,
  useMetaPostsFilter,
  useMetaFullInsights,
  useIsLoadingMetaInsights,
  useMetaActions,
  formatMetaSpend,
  formatMetaNumber,
  type MetaPost,
  type MetaFullInsights,
  type MetaAdSet,
  type MetaAd,
} from '@/stores/meta.store'

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
  const [activeNav, setActiveNav] = useState<'campaigns' | 'segments' | 'loyalty' | 'discounts' | 'channels' | 'meta' | 'affiliates' | 'wallet'>('campaigns')
  // Expanded segments state (for nested campaigns view)
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set())

  // Wallet pass stats state
  const [walletStats, setWalletStats] = useState<{
    // Order passes
    totalPasses: number
    activePasses: number
    pushEnabled: number
    recentActivity: Array<{ order_number: string; status: string; updated_at: string }>
    sampleOrder: {
      id: string
      order_number: string
      status: string
      order_type: string
      total_amount: number
      tracking_number?: string
      item_count: number
    } | null
    // Loyalty passes (customer_wallet_passes)
    loyaltyPasses: {
      total: number
      active: number
      pushEnabled: number
    }
    recentLoyaltyActivity: Array<{ customer_name: string; created_at: string }>
  } | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [passPreviewHtml, setPassPreviewHtml] = useState<string | null>(null)

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

  // Meta (Facebook/Instagram) store
  const metaIntegration = useMetaIntegration()
  const isMetaConnected = useIsMetaConnected()
  const isMetaConnecting = useIsMetaConnecting()
  const metaCampaigns = useMetaCampaigns()
  const metaAdSets = useMetaAdSets()
  const metaAds = useMetaAds()
  const isMetaSyncing = useIsMetaSyncing()
  const metaPosts = useMetaPosts()
  const isSyncingPosts = useIsSyncingMetaPosts()
  const postsFilter = useMetaPostsFilter()
  const metaInsights = useMetaFullInsights()
  const isLoadingInsights = useIsLoadingMetaInsights()
  const {
    loadIntegration: loadMetaIntegration,
    connect: connectMeta,
    disconnect: disconnectMeta,
    syncCampaigns: syncMetaCampaigns,
    createCampaign: createMetaCampaign,
    updateCampaignStatus: updateMetaCampaignStatus,
    saveCampaignDraft,
    deleteCampaignDraft,
    loadAdSets: loadMetaAdSets,
    createAdSet: createMetaAdSet,
    updateAdSetStatus: updateMetaAdSetStatus,
    loadAds: loadMetaAds,
    createAd: createMetaAd,
    updateAdStatus: updateMetaAdStatus,
    uploadImage: uploadMetaImage,
    searchTargeting,
    getReachEstimate,
    loadPosts: loadMetaPosts,
    syncPosts: syncMetaPosts,
    setPostsFilter: setMetaPostsFilter,
    loadFullInsights: loadMetaInsights,
    subscribeToRealtime: subscribeToMetaRealtime,
    unsubscribeFromRealtime: unsubscribeFromMetaRealtime,
  } = useMetaActions()

  // Meta connection UI state
  const [showMetaConnectModal, setShowMetaConnectModal] = useState(false)
  const [metaAccessToken, setMetaAccessToken] = useState('')
  const [metaAdAccountId, setMetaAdAccountId] = useState('')
  const [metaPixelId, setMetaPixelId] = useState('')

  // Campaign creation state
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    objective: 'OUTCOME_SALES',
    dailyBudget: 25, // numeric for slider
    status: 'PAUSED' as 'ACTIVE' | 'PAUSED',
  })

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

  // Meta sub-tab state
  const [metaSubTab, setMetaSubTab] = useState<'overview' | 'ads' | 'posts' | 'insights'>('overview')
  const [insightsDateRange, setInsightsDateRange] = useState<'7d' | '14d' | '30d' | '90d'>('30d')

  // Meta Ads drill-down state
  const [selectedMetaCampaign, setSelectedMetaCampaign] = useState<string | null>(null)
  const [selectedMetaAdSet, setSelectedMetaAdSet] = useState<string | null>(null)
  const [showAdSetModal, setShowAdSetModal] = useState(false)
  const [showAdModal, setShowAdModal] = useState(false)
  const [adSetForm, setAdSetForm] = useState({
    name: '',
    dailyBudget: 20,
    status: 'PAUSED' as 'ACTIVE' | 'PAUSED',
    optimization_goal: 'LINK_CLICKS',
    billing_event: 'IMPRESSIONS',
    countries: ['US'] as string[],
    age_min: 18,
    age_max: 65,
    genders: [] as number[],
    interests: [] as { id: string; name: string }[],
    publisher_platforms: ['facebook', 'instagram'] as string[],
  })
  const [adForm, setAdForm] = useState({
    name: '',
    status: 'PAUSED' as 'ACTIVE' | 'PAUSED',
    headline: '',
    primaryText: '',
    websiteUrl: '',
    callToAction: 'LEARN_MORE',
    imageHash: '',
  })
  const [isCreatingAdSet, setIsCreatingAdSet] = useState(false)
  const [isCreatingAd, setIsCreatingAd] = useState(false)

  // Interest search state
  const [interestSearch, setInterestSearch] = useState('')
  const [interestResults, setInterestResults] = useState<{ id: string; name: string; audience_size?: number }[]>([])
  const [isSearchingInterests, setIsSearchingInterests] = useState(false)

  // Reach estimation state
  const [reachEstimate, setReachEstimate] = useState<{ users_lower_bound: number; users_upper_bound: number } | null>(null)
  const [displayedReach, setDisplayedReach] = useState({ lower: 0, upper: 0 })
  const [isLoadingReach, setIsLoadingReach] = useState(false)
  const reachDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const interestSearchRef = useRef<NodeJS.Timeout | null>(null)

  // Animated values for smooth reach transitions
  const reachAnimatedLower = useRef(new Animated.Value(0)).current
  const reachAnimatedUpper = useRef(new Animated.Value(0)).current
  const reachPulseAnim = useRef(new Animated.Value(1)).current
  const reachGaugeAnim = useRef(new Animated.Value(0)).current

  // Animate reach numbers when they change
  useEffect(() => {
    if (reachEstimate) {
      // Animate the numbers counting up/down
      Animated.parallel([
        Animated.timing(reachAnimatedLower, {
          toValue: reachEstimate.users_lower_bound,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.timing(reachAnimatedUpper, {
          toValue: reachEstimate.users_upper_bound,
          duration: 600,
          useNativeDriver: false,
        }),
        // Animate the gauge (0-1 based on audience size, max at 50M)
        Animated.timing(reachGaugeAnim, {
          toValue: Math.min(1, (reachEstimate.users_lower_bound + reachEstimate.users_upper_bound) / 2 / 50000000),
          duration: 800,
          useNativeDriver: false,
        }),
      ]).start()

      // Update displayed values via listener
      const listenerId = reachAnimatedLower.addListener(({ value }) => {
        setDisplayedReach(prev => ({ ...prev, lower: Math.round(value) }))
      })
      const listenerIdUpper = reachAnimatedUpper.addListener(({ value }) => {
        setDisplayedReach(prev => ({ ...prev, upper: Math.round(value) }))
      })

      return () => {
        reachAnimatedLower.removeListener(listenerId)
        reachAnimatedUpper.removeListener(listenerIdUpper)
      }
    }
  }, [reachEstimate])

  // Pulse animation for loading state
  useEffect(() => {
    if (isLoadingReach) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(reachPulseAnim, { toValue: 0.5, duration: 600, useNativeDriver: true }),
          Animated.timing(reachPulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      )
      pulse.start()
      return () => pulse.stop()
    } else {
      reachPulseAnim.setValue(1)
    }
  }, [isLoadingReach])

  // Nav items
  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
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
    ]

    // Add Meta nav item when connected
    if (isMetaConnected) {
      items.push({
        id: 'meta',
        icon: 'logo-facebook',
        label: 'Meta',
        count: metaCampaigns.filter(c => c.status === 'ACTIVE').length || undefined,
      })
    }

    items.push(
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
        count: walletStats?.loyaltyPasses?.total || walletStats?.totalPasses,
      }
    )

    return items
  }, [campaigns.length, segments.length, discountCampaigns.length, affiliates.length, walletStats?.loyaltyPasses?.total, walletStats?.totalPasses, isMetaConnected, metaCampaigns])

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
      // Load Meta integration
      loadMetaIntegration(vendor.id)
      subscribeToMetaRealtime(vendor.id)
    }
    return () => {
      unsubscribeFromRealtime()
      unsubscribeAffiliates?.()
      unsubscribeFromMetaRealtime()
    }
  }, [vendor?.id])

  // Load Meta posts when connected
  useEffect(() => {
    if (vendor?.id && isMetaConnected) {
      loadMetaPosts(vendor.id)
    }
  }, [vendor?.id, isMetaConnected])

  // Load ad sets when a campaign is selected
  useEffect(() => {
    if (vendor?.id && selectedMetaCampaign) {
      loadMetaAdSets(vendor.id, selectedMetaCampaign)
    }
  }, [vendor?.id, selectedMetaCampaign])

  // Load ads when an ad set is selected
  useEffect(() => {
    if (vendor?.id && selectedMetaAdSet) {
      loadMetaAds(vendor.id, selectedMetaAdSet)
    }
  }, [vendor?.id, selectedMetaAdSet])

  // Fetch reach estimate when ad set form targeting changes
  useEffect(() => {
    if (!showAdSetModal || !vendor?.id) return

    // Clear existing timeout
    if (reachDebounceRef.current) {
      clearTimeout(reachDebounceRef.current)
    }

    // Show loading immediately
    setIsLoadingReach(true)

    // Debounce the API call (fast 100ms debounce)
    reachDebounceRef.current = setTimeout(async () => {
      const targeting: any = {
        geo_locations: { countries: adSetForm.countries },
        age_min: adSetForm.age_min,
        age_max: adSetForm.age_max,
      }
      if (adSetForm.genders.length > 0) targeting.genders = adSetForm.genders
      if (adSetForm.interests.length > 0) targeting.interests = adSetForm.interests
      if (adSetForm.publisher_platforms.length > 0) targeting.publisher_platforms = adSetForm.publisher_platforms

      try {
        const estimate = await getReachEstimate(vendor.id, targeting, adSetForm.optimization_goal)
        if (estimate) {
          setReachEstimate(estimate)
          // Animation handles displayedReach update now
        }
      } finally {
        setIsLoadingReach(false)
      }
    }, 100)

    return () => {
      if (reachDebounceRef.current) {
        clearTimeout(reachDebounceRef.current)
      }
    }
  }, [showAdSetModal, vendor?.id, adSetForm.countries, adSetForm.age_min, adSetForm.age_max, adSetForm.genders, adSetForm.interests, adSetForm.publisher_platforms, adSetForm.optimization_goal])

  // Get current campaign and ad set objects
  const currentCampaign = useMemo(() =>
    metaCampaigns.find(c => c.meta_campaign_id === selectedMetaCampaign),
    [metaCampaigns, selectedMetaCampaign]
  )
  const currentAdSet = useMemo(() =>
    metaAdSets.find(a => a.meta_ad_set_id === selectedMetaAdSet),
    [metaAdSets, selectedMetaAdSet]
  )
  const filteredAdSets = useMemo(() =>
    selectedMetaCampaign ? metaAdSets.filter(a => a.meta_campaign_id === selectedMetaCampaign) : [],
    [metaAdSets, selectedMetaCampaign]
  )
  const filteredAds = useMemo(() =>
    selectedMetaAdSet ? metaAds.filter(a => a.meta_ad_set_id === selectedMetaAdSet) : [],
    [metaAds, selectedMetaAdSet]
  )

  // Load Meta insights when insights tab is active
  // Calculate date range for insights
  const getInsightsDateRange = useCallback(() => {
    const end = new Date()
    const start = new Date()
    switch (insightsDateRange) {
      case '7d': start.setDate(end.getDate() - 7); break
      case '14d': start.setDate(end.getDate() - 14); break
      case '30d': start.setDate(end.getDate() - 30); break
      case '90d': start.setDate(end.getDate() - 90); break
    }
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    }
  }, [insightsDateRange])

  useEffect(() => {
    if (vendor?.id && isMetaConnected && metaSubTab === 'insights') {
      const { start, end } = getInsightsDateRange()
      loadMetaInsights(vendor.id, start, end)
    }
  }, [vendor?.id, isMetaConnected, metaSubTab, insightsDateRange])

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

        // Fetch a recent order to use as sample for the pass preview
        const { data: sampleOrderData } = await supabase
          .from('orders')
          .select('id, order_number, status, order_type, total_amount, tracking_number')
          .eq('vendor_id', vendor.id)
          .in('status', ['confirmed', 'preparing', 'shipped', 'in_transit', 'delivered'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Get item count for the sample order
        let sampleItemCount = 0
        if (sampleOrderData?.id) {
          const { count } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', sampleOrderData.id)
          sampleItemCount = count || 0
        }

        // Calculate order pass stats
        const totalPasses = passes?.length || 0
        const pushEnabled = passes?.filter(p => p.push_enabled).length || 0
        const recentActivity = (passes || []).slice(0, 5).map(p => ({
          order_number: (p.orders as any)?.order_number || 'Unknown',
          status: (p.orders as any)?.status || 'unknown',
          updated_at: p.last_updated_at,
        }))

        const sampleOrder = sampleOrderData ? {
          id: sampleOrderData.id,
          order_number: sampleOrderData.order_number,
          status: sampleOrderData.status,
          order_type: sampleOrderData.order_type || 'shipping',
          total_amount: sampleOrderData.total_amount,
          tracking_number: sampleOrderData.tracking_number,
          item_count: sampleItemCount,
        } : null

        // Fetch loyalty pass stats from customer_wallet_passes
        let loyaltyPasses = { total: 0, active: 0, pushEnabled: 0 }
        let recentLoyaltyActivity: Array<{ customer_name: string; created_at: string }> = []

        try {
          // Get stats from the view
          const { data: loyaltyStats } = await supabase
            .from('customer_wallet_pass_stats')
            .select('*')
            .eq('vendor_id', vendor.id)
            .maybeSingle()

          if (loyaltyStats) {
            loyaltyPasses = {
              total: loyaltyStats.total_passes || 0,
              active: loyaltyStats.active_passes || 0,
              pushEnabled: loyaltyStats.push_enabled || 0,
            }
          }

          // Get recent loyalty pass activity
          const { data: recentPasses } = await supabase
            .from('customer_wallet_passes')
            .select(`
              created_at,
              customers!inner(
                first_name,
                last_name
              )
            `)
            .eq('vendor_id', vendor.id)
            .order('created_at', { ascending: false })
            .limit(5)

          if (recentPasses) {
            recentLoyaltyActivity = recentPasses.map(p => ({
              customer_name: `${(p.customers as any)?.first_name || ''} ${(p.customers as any)?.last_name || ''}`.trim() || 'Unknown',
              created_at: p.created_at,
            }))
          }
        } catch (loyaltyErr) {
          console.error('[MarketingScreen] Loyalty pass stats error:', loyaltyErr)
        }

        setWalletStats({
          totalPasses,
          activePasses: activeCount || 0,
          pushEnabled,
          recentActivity,
          sampleOrder,
          loyaltyPasses,
          recentLoyaltyActivity,
        })

        // Fetch the HTML preview for the sample order
        if (sampleOrder?.id) {
          try {
            const previewResponse = await fetch(
              `https://uaednwpxursknmwdeejn.supabase.co/functions/v1/order-pass-preview?order_id=${sampleOrder.id}`
            )
            if (previewResponse.ok) {
              const html = await previewResponse.text()
              if (!cancelled) setPassPreviewHtml(html)
            }
          } catch (previewErr) {
            console.error('[MarketingScreen] Preview fetch error:', previewErr)
          }
        }
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
                    <Text style={styles.emptyStateText}>
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

            {/* TARGET AUDIENCES - Expandable with nested campaigns */}
            {segments.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Target Audiences</Text>
                <Text style={styles.sectionSubtitle}>Segments with campaign history</Text>

                <View style={styles.segmentGrid}>
                  {segments
                    .filter(s => s.customer_count > 0 || s.name === 'Staff') // Always show Staff for testing
                    .sort((a, b) => {
                      // Staff always first, then by customer count
                      if (a.name === 'Staff') return -1
                      if (b.name === 'Staff') return 1
                      return b.customer_count - a.customer_count
                    })
                    .map((seg) => {
                      // Find campaigns targeting this segment
                      const segmentCampaigns = campaigns.filter(c =>
                        c.audience_filter?.segment_id === seg.id
                      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

                      const isExpanded = expandedSegments.has(seg.id)
                      const hasNeverEmailed = segmentCampaigns.length === 0
                      const sentCampaigns = segmentCampaigns.filter(c => c.status === 'sent')

                      return (
                        <View key={seg.id} style={styles.expandableSegmentContainer}>
                          {/* Segment Header - Tappable to expand */}
                          <Pressable
                            style={[
                              styles.segmentCard,
                              isExpanded && styles.segmentCardExpanded,
                              hasNeverEmailed && styles.segmentCardNeverEmailed
                            ]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                              setExpandedSegments(prev => {
                                const next = new Set(prev)
                                if (next.has(seg.id)) {
                                  next.delete(seg.id)
                                } else {
                                  next.add(seg.id)
                                }
                                return next
                              })
                            }}
                          >
                            <View style={[styles.segmentDot, { backgroundColor: seg.color || '#6366F1' }]} />
                            <View style={styles.segmentInfo}>
                              <Text style={styles.segmentName}>{seg.name}</Text>
                              <View style={styles.segmentMetaRow}>
                                <Text style={styles.segmentCount}>{seg.customer_count.toLocaleString()} customers</Text>
                                {hasNeverEmailed ? (
                                  <View style={styles.neverEmailedBadge}>
                                    <Ionicons name="alert-circle" size={12} color="#F59E0B" />
                                    <Text style={styles.neverEmailedText}>Never emailed</Text>
                                  </View>
                                ) : (
                                  <Text style={styles.campaignCountBadge}>
                                    {sentCampaigns.length} campaign{sentCampaigns.length !== 1 ? 's' : ''} sent
                                  </Text>
                                )}
                              </View>
                            </View>
                            <Ionicons
                              name={isExpanded ? "chevron-up" : "chevron-down"}
                              size={20}
                              color={colors.text.tertiary}
                            />
                          </Pressable>

                          {/* Expanded Content - Campaign History + New Campaign Button */}
                          {isExpanded && (
                            <View style={styles.expandedContent}>
                              {/* Campaign History */}
                              {segmentCampaigns.length > 0 ? (
                                <View style={styles.campaignHistoryList}>
                                  {segmentCampaigns.slice(0, 5).map((campaign) => {
                                    const openRate = campaign.sent_count > 0
                                      ? ((campaign.opened_count / campaign.sent_count) * 100).toFixed(0)
                                      : '0'
                                    return (
                                      <Pressable
                                        key={campaign.id}
                                        style={styles.campaignHistoryItem}
                                        onPress={() => {
                                          setSelectedCampaign(campaign)
                                          setShowCampaignDetail(true)
                                        }}
                                      >
                                        <View style={styles.campaignHistoryInfo}>
                                          <Text style={styles.campaignHistoryName} numberOfLines={1}>
                                            {campaign.name || campaign.subject}
                                          </Text>
                                          <Text style={styles.campaignHistoryDate}>
                                            {campaign.sent_at
                                              ? new Date(campaign.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                              : campaign.status === 'draft' ? 'Draft' : 'Pending'}
                                          </Text>
                                        </View>
                                        <View style={styles.campaignHistoryStats}>
                                          {campaign.status === 'sent' && (
                                            <Text style={styles.campaignHistoryOpenRate}>{openRate}% open</Text>
                                          )}
                                          <View style={[
                                            styles.campaignStatusDot,
                                            { backgroundColor: campaign.status === 'sent' ? '#10B981' : campaign.status === 'draft' ? '#6B7280' : '#F59E0B' }
                                          ]} />
                                        </View>
                                      </Pressable>
                                    )
                                  })}
                                  {segmentCampaigns.length > 5 && (
                                    <Text style={styles.moreCampaignsText}>
                                      +{segmentCampaigns.length - 5} more campaigns
                                    </Text>
                                  )}
                                </View>
                              ) : (
                                <View style={styles.noCampaignsMessage}>
                                  <Ionicons name="mail-unread-outline" size={24} color="#F59E0B" />
                                  <Text style={styles.noCampaignsText}>
                                    This segment hasn't been emailed yet
                                  </Text>
                                  <Text style={styles.noCampaignsSubtext}>
                                    {seg.ai_description || `${seg.customer_count.toLocaleString()} potential customers waiting to hear from you`}
                                  </Text>
                                </View>
                              )}

                              {/* New Campaign Button */}
                              <Pressable
                                style={styles.newCampaignButton}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                                  handleOpenCreator(seg.id)
                                }}
                              >
                                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                                <Text style={styles.newCampaignButtonText}>New Campaign for {seg.name}</Text>
                              </Pressable>

                              {/* AI Targeting Tips */}
                              {seg.targeting_tips && seg.targeting_tips.length > 0 && (
                                <View style={styles.targetingTips}>
                                  <Text style={styles.targetingTipsLabel}>Targeting ideas:</Text>
                                  <View style={styles.targetingTipsList}>
                                    {seg.targeting_tips.slice(0, 3).map((tip, idx) => (
                                      <View key={idx} style={styles.targetingTipChip}>
                                        <Text style={styles.targetingTipText}>{tip}</Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )
                    })}
                </View>
              </View>
            )}

            {segments.length === 0 && (
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
            contentContainerStyle={[styles.contentScrollContent, { paddingBottom: layout.dockHeight + spacing.lg }]}
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <TitleSection
              title="Channels"
              logo={vendor?.logo_url}
              subtitle="Customer reach by channel"
            />

            {/* Channel Stats */}
            <View style={styles.heroSection}>
              <View style={styles.heroCard}>
                <Ionicons name="mail" size={24} color="#007AFF" style={{ marginBottom: spacing.xs }} />
                <Text style={styles.heroNumber}>{contactReachability?.email_reachable || 0}</Text>
                <Text style={styles.heroLabel}>Email</Text>
              </View>
              <View style={styles.heroCard}>
                <Ionicons name="chatbubble" size={24} color="#34c759" style={{ marginBottom: spacing.xs }} />
                <Text style={styles.heroNumber}>{contactReachability?.sms_reachable || 0}</Text>
                <Text style={styles.heroLabel}>SMS</Text>
              </View>
              <View style={styles.heroCard}>
                <Ionicons name="wallet" size={24} color="#A855F7" style={{ marginBottom: spacing.xs }} />
                <Text style={styles.heroNumber}>{contactReachability?.wallet_pass_push_enabled || 0}</Text>
                <Text style={styles.heroLabel}>Wallet Push</Text>
              </View>
              <View style={styles.heroCard}>
                <Ionicons name="people" size={24} color={colors.text.secondary} style={{ marginBottom: spacing.xs }} />
                <Text style={styles.heroNumber}>{contactReachability?.total || 0}</Text>
                <Text style={styles.heroLabel}>Total</Text>
              </View>
            </View>

            {/* Channel Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Channel Breakdown</Text>
              <View style={styles.glassCard}>
                {/* Email Channel */}
                <View style={styles.channelRow}>
                  <View style={styles.channelIcon}>
                    <Ionicons name="mail" size={20} color="#007AFF" />
                  </View>
                  <View style={styles.channelInfo}>
                    <Text style={styles.channelName}>Email</Text>
                    <Text style={styles.channelDescription}>
                      {contactReachability?.email_reachable || 0} reachable customers
                    </Text>
                  </View>
                  <View style={styles.channelStats}>
                    <Text style={styles.channelPercent}>
                      {contactReachability?.total
                        ? Math.round((contactReachability.email_reachable / contactReachability.total) * 100)
                        : 0}%
                    </Text>
                    <View style={[styles.channelStatusDot, { backgroundColor: '#34c759' }]} />
                  </View>
                </View>

                {/* SMS Channel */}
                <View style={styles.channelRow}>
                  <View style={styles.channelIcon}>
                    <Ionicons name="chatbubble" size={20} color="#34c759" />
                  </View>
                  <View style={styles.channelInfo}>
                    <Text style={styles.channelName}>SMS</Text>
                    <Text style={styles.channelDescription}>
                      {contactReachability?.sms_reachable || 0} reachable customers
                    </Text>
                  </View>
                  <View style={styles.channelStats}>
                    <Text style={styles.channelPercent}>
                      {contactReachability?.total
                        ? Math.round((contactReachability.sms_reachable / contactReachability.total) * 100)
                        : 0}%
                    </Text>
                    <View style={[styles.channelStatusDot, { backgroundColor: '#ff9500' }]} />
                  </View>
                </View>

                {/* Apple Wallet Channel */}
                <View style={[styles.channelRow, styles.borderBottom && false]}>
                  <View style={styles.channelIcon}>
                    <Ionicons name="wallet" size={20} color="#A855F7" />
                  </View>
                  <View style={styles.channelInfo}>
                    <Text style={styles.channelName}>Apple Wallet</Text>
                    <Text style={styles.channelDescription}>
                      {contactReachability?.wallet_pass_total || 0} passes created •{' '}
                      {contactReachability?.wallet_pass_push_enabled || 0} push enabled
                    </Text>
                  </View>
                  <View style={styles.channelStats}>
                    <Text style={styles.channelPercent}>
                      {contactReachability?.total && contactReachability.wallet_pass_total
                        ? Math.round((contactReachability.wallet_pass_total / contactReachability.total) * 100)
                        : 0}%
                    </Text>
                    <View style={[styles.channelStatusDot, { backgroundColor: '#34c759' }]} />
                  </View>
                </View>
              </View>
            </View>

            {/* Unreachable Customers */}
            {(contactReachability?.unreachable || 0) > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Unreachable</Text>
                <View style={styles.glassCard}>
                  <View style={styles.channelRow}>
                    <View style={[styles.channelIcon, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
                      <Ionicons name="alert-circle" size={20} color="#ff3b30" />
                    </View>
                    <View style={styles.channelInfo}>
                      <Text style={styles.channelName}>No Contact Info</Text>
                      <Text style={styles.channelDescription}>
                        {contactReachability?.unreachable || 0} customers with no email or phone
                      </Text>
                    </View>
                    <View style={styles.channelStats}>
                      <Text style={[styles.channelPercent, { color: '#ff3b30' }]}>
                        {contactReachability?.total
                          ? Math.round((contactReachability.unreachable / contactReachability.total) * 100)
                          : 0}%
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Meta (Facebook/Instagram) Integration */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Meta Ads</Text>
              <View style={styles.glassCard}>
                {/* Connection Status */}
                <View style={styles.channelRow}>
                  <View style={[styles.channelIcon, { backgroundColor: isMetaConnected ? 'rgba(24,119,242,0.1)' : 'rgba(107,114,128,0.1)' }]}>
                    <Ionicons name="logo-facebook" size={20} color={isMetaConnected ? '#1877F2' : colors.text.secondary} />
                  </View>
                  <View style={styles.channelInfo}>
                    <Text style={styles.channelName}>Facebook & Instagram</Text>
                    <Text style={styles.channelDescription}>
                      {isMetaConnected
                        ? `Connected • ${metaIntegration?.ad_account_id || 'No ad account'}`
                        : 'Connect to manage ads and track conversions'}
                    </Text>
                  </View>
                  {isMetaConnected ? (
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Pressable
                        style={styles.metaEditButton}
                        onPress={() => {
                          // Pre-fill with existing values
                          setMetaAdAccountId(metaIntegration?.ad_account_id || '')
                          setMetaPixelId(metaIntegration?.pixel_id || '')
                          setMetaAccessToken('') // Don't pre-fill token for security
                          setShowMetaConnectModal(true)
                        }}
                      >
                        <Ionicons name="pencil" size={14} color="#007AFF" />
                        <Text style={styles.metaEditButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={styles.metaDisconnectButton}
                        onPress={() => {
                          Alert.alert(
                            'Disconnect Meta',
                            'Are you sure you want to disconnect your Meta account? This will remove access to your ads data.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Disconnect',
                                style: 'destructive',
                                onPress: () => vendor?.id && disconnectMeta(vendor.id)
                              }
                            ]
                          )
                        }}
                      >
                        <Text style={styles.metaDisconnectButtonText}>Disconnect</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.metaConnectButton}
                      onPress={() => setShowMetaConnectModal(true)}
                      disabled={isMetaConnecting}
                    >
                      {isMetaConnecting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.metaConnectButtonText}>Connect</Text>
                      )}
                    </Pressable>
                  )}
                </View>

                {/* Meta Stats (if connected) */}
                {isMetaConnected && (
                  <>
                    <View style={[styles.channelRow, { marginTop: spacing.md }]}>
                      <View style={[styles.channelIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                        <Ionicons name="megaphone" size={20} color="#EF4444" />
                      </View>
                      <View style={styles.channelInfo}>
                        <Text style={styles.channelName}>Active Campaigns</Text>
                        <Text style={styles.channelDescription}>
                          {metaCampaigns.filter(c => c.status === 'ACTIVE').length} running
                        </Text>
                      </View>
                      <Pressable
                        style={styles.metaSyncButton}
                        onPress={() => vendor?.id && syncMetaCampaigns(vendor.id)}
                        disabled={isMetaSyncing}
                      >
                        {isMetaSyncing ? (
                          <ActivityIndicator size="small" color="#007AFF" />
                        ) : (
                          <Ionicons name="refresh" size={18} color="#007AFF" />
                        )}
                      </Pressable>
                    </View>

                    {/* Quick Stats */}
                    {metaCampaigns.length > 0 && (
                      <View style={styles.metaQuickStats}>
                        <View style={styles.metaStatItem}>
                          <Text style={styles.metaStatValue}>
                            {formatMetaNumber(metaCampaigns.reduce((sum, c) => sum + c.impressions, 0))}
                          </Text>
                          <Text style={styles.metaStatLabel}>Impressions</Text>
                        </View>
                        <View style={styles.metaStatItem}>
                          <Text style={styles.metaStatValue}>
                            {formatMetaNumber(metaCampaigns.reduce((sum, c) => sum + c.clicks, 0))}
                          </Text>
                          <Text style={styles.metaStatLabel}>Clicks</Text>
                        </View>
                        <View style={styles.metaStatItem}>
                          <Text style={styles.metaStatValue}>
                            {formatMetaSpend(metaCampaigns.reduce((sum, c) => sum + c.spend, 0))}
                          </Text>
                          <Text style={styles.metaStatLabel}>Spend</Text>
                        </View>
                        <View style={styles.metaStatItem}>
                          <Text style={styles.metaStatValue}>
                            {metaCampaigns.reduce((sum, c) => sum + c.conversions, 0)}
                          </Text>
                          <Text style={styles.metaStatLabel}>Conversions</Text>
                        </View>
                      </View>
                    )}

                    {/* Pixel Status */}
                    <View style={[styles.channelRow, { marginTop: spacing.md }]}>
                      <View style={[styles.channelIcon, { backgroundColor: metaIntegration?.pixel_id ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)' }]}>
                        <Ionicons name="analytics" size={20} color={metaIntegration?.pixel_id ? '#10B981' : '#F59E0B'} />
                      </View>
                      <View style={styles.channelInfo}>
                        <Text style={styles.channelName}>Conversion Tracking</Text>
                        <Text style={styles.channelDescription}>
                          {metaIntegration?.pixel_id
                            ? `Pixel: ${metaIntegration.pixel_id}`
                            : 'No pixel configured - add in settings'}
                        </Text>
                      </View>
                      <View style={[styles.channelStatusDot, { backgroundColor: metaIntegration?.pixel_id ? '#10B981' : '#F59E0B' }]} />
                    </View>
                  </>
                )}
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )

      case 'meta':
        return (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[styles.contentScrollContent, { paddingBottom: layout.dockHeight + spacing.lg }]}
            showsVerticalScrollIndicator={false}
          >
            {/* HEADER */}
            <TitleSection
              title="Meta"
              logo={vendor?.logo_url}
              subtitle="Facebook & Instagram Marketing"
            />

            {/* Sub-tabs */}
            <View style={styles.metaTabBar}>
              {(['overview', 'ads', 'posts', 'insights'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  style={[styles.metaTab, metaSubTab === tab && styles.metaTabActive]}
                  onPress={() => setMetaSubTab(tab)}
                >
                  <Ionicons
                    name={
                      tab === 'overview' ? 'grid' :
                      tab === 'ads' ? 'megaphone' :
                      tab === 'posts' ? 'images' :
                      'stats-chart'
                    }
                    size={18}
                    color={metaSubTab === tab ? '#1877F2' : colors.text.secondary}
                  />
                  <Text style={[styles.metaTabText, metaSubTab === tab && styles.metaTabTextActive]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Overview Sub-view */}
            {metaSubTab === 'overview' && (
              <>
                {/* Quick Stats */}
                <View style={styles.heroSection}>
                  <View style={styles.heroCard}>
                    <Ionicons name="eye" size={24} color="#1877F2" style={{ marginBottom: spacing.xs }} />
                    <Text style={styles.heroNumber}>
                      {formatMetaNumber(metaCampaigns.reduce((sum, c) => sum + c.impressions, 0))}
                    </Text>
                    <Text style={styles.heroLabel}>Impressions</Text>
                  </View>
                  <View style={styles.heroCard}>
                    <Ionicons name="people" size={24} color="#E1306C" style={{ marginBottom: spacing.xs }} />
                    <Text style={styles.heroNumber}>
                      {formatMetaNumber(metaCampaigns.reduce((sum, c) => sum + c.reach, 0))}
                    </Text>
                    <Text style={styles.heroLabel}>Reach</Text>
                  </View>
                  <View style={styles.heroCard}>
                    <Ionicons name="hand-left" size={24} color="#34c759" style={{ marginBottom: spacing.xs }} />
                    <Text style={styles.heroNumber}>
                      {formatMetaNumber(metaCampaigns.reduce((sum, c) => sum + c.clicks, 0))}
                    </Text>
                    <Text style={styles.heroLabel}>Clicks</Text>
                  </View>
                  <View style={styles.heroCard}>
                    <Ionicons name="cash" size={24} color="#F59E0B" style={{ marginBottom: spacing.xs }} />
                    <Text style={styles.heroNumber}>
                      {formatMetaSpend(metaCampaigns.reduce((sum, c) => sum + c.spend, 0))}
                    </Text>
                    <Text style={styles.heroLabel}>Spend</Text>
                  </View>
                </View>

                {/* Connection Info */}
                <View style={styles.section}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                    <Text style={styles.sectionTitle}>Connection</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Pressable
                        style={styles.metaEditButton}
                        onPress={() => {
                          setMetaAdAccountId(metaIntegration?.ad_account_id || '')
                          setMetaPixelId(metaIntegration?.pixel_id || '')
                          setMetaAccessToken('')
                          setShowMetaConnectModal(true)
                        }}
                      >
                        <Ionicons name="pencil" size={14} color="#007AFF" />
                        <Text style={styles.metaEditButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={styles.metaDisconnectButton}
                        onPress={() => {
                          Alert.alert(
                            'Disconnect Meta',
                            'Are you sure you want to disconnect your Meta account?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Disconnect',
                                style: 'destructive',
                                onPress: () => vendor?.id && disconnectMeta(vendor.id)
                              }
                            ]
                          )
                        }}
                      >
                        <Text style={styles.metaDisconnectButtonText}>Disconnect</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.glassCard}>
                    <View style={styles.channelRow}>
                      <View style={[styles.channelIcon, { backgroundColor: 'rgba(24,119,242,0.1)' }]}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      </View>
                      <View style={styles.channelInfo}>
                        <Text style={styles.channelName}>Connected to Meta</Text>
                        <Text style={styles.channelDescription}>
                          Ad Account: {metaIntegration?.ad_account_id || 'Not set'}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.metaSyncButton}
                        onPress={() => vendor?.id && syncMetaCampaigns(vendor.id)}
                        disabled={isMetaSyncing}
                      >
                        {isMetaSyncing ? (
                          <ActivityIndicator size="small" color="#007AFF" />
                        ) : (
                          <Ionicons name="refresh" size={18} color="#007AFF" />
                        )}
                      </Pressable>
                    </View>
                    {metaIntegration?.page_id && (
                      <View style={styles.channelRow}>
                        <View style={[styles.channelIcon, { backgroundColor: 'rgba(24,119,242,0.1)' }]}>
                          <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                        </View>
                        <View style={styles.channelInfo}>
                          <Text style={styles.channelName}>Facebook Page</Text>
                          <Text style={styles.channelDescription}>ID: {metaIntegration.page_id}</Text>
                        </View>
                      </View>
                    )}
                    {metaIntegration?.instagram_business_id && (
                      <View style={styles.channelRow}>
                        <View style={[styles.channelIcon, { backgroundColor: 'rgba(225,48,108,0.1)' }]}>
                          <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                        </View>
                        <View style={styles.channelInfo}>
                          <Text style={styles.channelName}>Instagram Business</Text>
                          <Text style={styles.channelDescription}>ID: {metaIntegration.instagram_business_id}</Text>
                        </View>
                      </View>
                    )}
                    {metaIntegration?.pixel_id && (
                      <View style={styles.channelRow}>
                        <View style={[styles.channelIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                          <Ionicons name="analytics" size={20} color="#10B981" />
                        </View>
                        <View style={styles.channelInfo}>
                          <Text style={styles.channelName}>Pixel</Text>
                          <Text style={styles.channelDescription}>ID: {metaIntegration.pixel_id}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* Active Campaigns Summary */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Active Campaigns</Text>
                  {metaCampaigns.filter(c => c.status === 'ACTIVE').length === 0 ? (
                    <View style={styles.glassCard}>
                      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                        <Ionicons name="megaphone-outline" size={48} color={colors.text.quaternary} />
                        <Text style={{ color: colors.text.tertiary, marginTop: spacing.md }}>
                          No active campaigns
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.glassCard}>
                      {metaCampaigns.filter(c => c.status === 'ACTIVE').slice(0, 5).map((campaign) => (
                        <View key={campaign.id} style={styles.channelRow}>
                          <View style={[styles.channelIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                          </View>
                          <View style={styles.channelInfo}>
                            <Text style={styles.channelName} numberOfLines={1}>{campaign.name}</Text>
                            <Text style={styles.channelDescription}>
                              {formatMetaSpend(campaign.spend)} spent • {formatMetaNumber(campaign.impressions)} impressions
                            </Text>
                          </View>
                          <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
                            {campaign.roas ? `${campaign.roas.toFixed(1)}x ROAS` : '-'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Ads Sub-view with drill-down navigation */}
            {metaSubTab === 'ads' && (
              <>
                <View style={styles.section}>
                  {/* Breadcrumb Navigation */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, flexWrap: 'wrap' }}>
                    <Pressable
                      onPress={() => {
                        setSelectedMetaCampaign(null)
                        setSelectedMetaAdSet(null)
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Ionicons name="megaphone" size={16} color={selectedMetaCampaign ? '#007AFF' : colors.text.primary} />
                      <Text style={{ marginLeft: 4, color: selectedMetaCampaign ? '#007AFF' : colors.text.primary, fontWeight: '600' }}>
                        Campaigns
                      </Text>
                    </Pressable>
                    {selectedMetaCampaign && currentCampaign && (
                      <>
                        <Ionicons name="chevron-forward" size={16} color={colors.text.quaternary} style={{ marginHorizontal: 4 }} />
                        <Pressable
                          onPress={() => setSelectedMetaAdSet(null)}
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                          <Text
                            style={{ color: selectedMetaAdSet ? '#007AFF' : colors.text.primary, fontWeight: '600' }}
                            numberOfLines={1}
                          >
                            {currentCampaign.name}
                          </Text>
                        </Pressable>
                      </>
                    )}
                    {selectedMetaAdSet && currentAdSet && (
                      <>
                        <Ionicons name="chevron-forward" size={16} color={colors.text.quaternary} style={{ marginHorizontal: 4 }} />
                        <Text style={{ color: colors.text.primary, fontWeight: '600' }} numberOfLines={1}>
                          {currentAdSet.name}
                        </Text>
                      </>
                    )}
                  </View>

                  {/* Header with actions */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                    <Text style={styles.sectionTitle}>
                      {selectedMetaAdSet ? 'Ads' : selectedMetaCampaign ? 'Ad Sets' : 'All Campaigns'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {!selectedMetaCampaign && (
                        <>
                          <Pressable
                            style={styles.metaSyncButton}
                            onPress={() => vendor?.id && syncMetaCampaigns(vendor.id)}
                            disabled={isMetaSyncing}
                          >
                            {isMetaSyncing ? (
                              <ActivityIndicator size="small" color="#007AFF" />
                            ) : (
                              <>
                                <Ionicons name="refresh" size={16} color="#007AFF" />
                                <Text style={{ color: '#007AFF', marginLeft: 4, fontSize: 13 }}>Sync</Text>
                              </>
                            )}
                          </Pressable>
                          <Pressable
                            style={[styles.metaSyncButton, { backgroundColor: '#10B981' }]}
                            onPress={() => {
                              setCampaignForm({ name: '', objective: 'OUTCOME_SALES', dailyBudget: 25, status: 'PAUSED' })
                              setShowCampaignModal(true)
                            }}
                          >
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={{ color: '#fff', marginLeft: 4, fontSize: 13, fontWeight: '600' }}>New Campaign</Text>
                          </Pressable>
                        </>
                      )}
                      {selectedMetaCampaign && !selectedMetaAdSet && (
                        <Pressable
                          style={[styles.metaSyncButton, { backgroundColor: '#10B981' }]}
                          onPress={() => {
                            setAdSetForm({
                              name: '',
                              dailyBudget: 10,
                              status: 'PAUSED',
                              optimization_goal: 'LINK_CLICKS',
                              billing_event: 'IMPRESSIONS',
                              countries: ['US'],
                              age_min: 18,
                              age_max: 65,
                              genders: [],
                              interests: [],
                              publisher_platforms: ['facebook', 'instagram'],
                            })
                            setShowAdSetModal(true)
                          }}
                        >
                          <Ionicons name="add" size={16} color="#fff" />
                          <Text style={{ color: '#fff', marginLeft: 4, fontSize: 13, fontWeight: '600' }}>New Ad Set</Text>
                        </Pressable>
                      )}
                      {selectedMetaAdSet && (
                        <Pressable
                          style={[styles.metaSyncButton, { backgroundColor: '#10B981' }]}
                          onPress={() => {
                            setAdForm({
                              name: '',
                              status: 'PAUSED',
                              headline: '',
                              primaryText: '',
                              websiteUrl: '',
                              callToAction: 'LEARN_MORE',
                              imageHash: '',
                            })
                            setShowAdModal(true)
                          }}
                        >
                          <Ionicons name="add" size={16} color="#fff" />
                          <Text style={{ color: '#fff', marginLeft: 4, fontSize: 13, fontWeight: '600' }}>New Ad</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {/* Campaigns List */}
                  {!selectedMetaCampaign && (
                    <>
                      {metaCampaigns.length === 0 ? (
                        <View style={styles.glassCard}>
                          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                            <Ionicons name="megaphone-outline" size={48} color={colors.text.quaternary} />
                            <Text style={{ color: colors.text.tertiary, marginTop: spacing.md }}>
                              No campaigns found
                            </Text>
                            <Text style={{ color: colors.text.quaternary, marginTop: spacing.xs, fontSize: 13 }}>
                              Create a new campaign or sync from Meta
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.glassCard}>
                          {metaCampaigns.map((campaign) => (
                            <Pressable
                              key={campaign.id}
                              style={styles.metaCampaignRow}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                setSelectedMetaCampaign(campaign.meta_campaign_id)
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <View
                                  style={[
                                    styles.metaStatusDot,
                                    { backgroundColor: campaign.status === 'ACTIVE' ? '#10B981' : campaign.status === 'PAUSED' ? '#F59E0B' : '#6B7280' }
                                  ]}
                                />
                                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                  <Text style={styles.metaCampaignName} numberOfLines={1}>{campaign.name}</Text>
                                  <Text style={styles.metaCampaignObjective}>{campaign.objective?.replace('OUTCOME_', '') || 'Unknown'}</Text>
                                </View>
                              </View>
                              <View style={styles.metaCampaignStats}>
                                <View style={styles.metaCampaignStat}>
                                  <Text style={styles.metaCampaignStatValue}>{formatMetaSpend(campaign.spend)}</Text>
                                  <Text style={styles.metaCampaignStatLabel}>Spend</Text>
                                </View>
                                <View style={styles.metaCampaignStat}>
                                  <Text style={styles.metaCampaignStatValue}>{formatMetaNumber(campaign.clicks)}</Text>
                                  <Text style={styles.metaCampaignStatLabel}>Clicks</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.text.quaternary} />
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </>
                  )}

                  {/* Ad Sets List */}
                  {selectedMetaCampaign && !selectedMetaAdSet && (
                    <>
                      {filteredAdSets.length === 0 ? (
                        <View style={styles.glassCard}>
                          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                            <Ionicons name="layers-outline" size={48} color={colors.text.quaternary} />
                            <Text style={{ color: colors.text.tertiary, marginTop: spacing.md }}>
                              No ad sets yet
                            </Text>
                            <Text style={{ color: colors.text.quaternary, marginTop: spacing.xs, fontSize: 13 }}>
                              Create an ad set to target your audience
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.glassCard}>
                          {filteredAdSets.map((adSet) => (
                            <Pressable
                              key={adSet.id}
                              style={styles.metaCampaignRow}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                setSelectedMetaAdSet(adSet.meta_ad_set_id)
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <Pressable
                                  style={[
                                    styles.metaStatusDot,
                                    { backgroundColor: adSet.status === 'ACTIVE' ? '#10B981' : adSet.status === 'PAUSED' ? '#F59E0B' : '#6B7280' }
                                  ]}
                                  onPress={async (e) => {
                                    e.stopPropagation()
                                    if (!vendor?.id) return
                                    const newStatus = adSet.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                    await updateMetaAdSetStatus(vendor.id, adSet.meta_ad_set_id, newStatus)
                                  }}
                                />
                                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                  <Text style={styles.metaCampaignName} numberOfLines={1}>{adSet.name}</Text>
                                  <Text style={styles.metaCampaignObjective}>
                                    {adSet.optimization_goal?.replace(/_/g, ' ') || 'Unknown'} • {adSet.daily_budget ? `$${adSet.daily_budget}/day` : 'No budget'}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.metaCampaignStats}>
                                <View style={styles.metaCampaignStat}>
                                  <Text style={styles.metaCampaignStatValue}>{formatMetaSpend(adSet.spend)}</Text>
                                  <Text style={styles.metaCampaignStatLabel}>Spend</Text>
                                </View>
                                <View style={styles.metaCampaignStat}>
                                  <Text style={styles.metaCampaignStatValue}>{formatMetaNumber(adSet.clicks)}</Text>
                                  <Text style={styles.metaCampaignStatLabel}>Clicks</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.text.quaternary} />
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </>
                  )}

                  {/* Ads List */}
                  {selectedMetaAdSet && (
                    <>
                      {filteredAds.length === 0 ? (
                        <View style={styles.glassCard}>
                          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                            <Ionicons name="image-outline" size={48} color={colors.text.quaternary} />
                            <Text style={{ color: colors.text.tertiary, marginTop: spacing.md }}>
                              No ads yet
                            </Text>
                            <Text style={{ color: colors.text.quaternary, marginTop: spacing.xs, fontSize: 13 }}>
                              Create an ad with creative to start advertising
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.glassCard}>
                          {filteredAds.map((ad) => (
                            <View key={ad.id} style={styles.metaCampaignRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <Pressable
                                  style={[
                                    styles.metaStatusDot,
                                    { backgroundColor: ad.status === 'ACTIVE' ? '#10B981' : ad.status === 'PAUSED' ? '#F59E0B' : '#6B7280' }
                                  ]}
                                  onPress={async () => {
                                    if (!vendor?.id) return
                                    const newStatus = ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                    await updateMetaAdStatus(vendor.id, ad.meta_ad_id, newStatus)
                                  }}
                                />
                                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                  <Text style={styles.metaCampaignName} numberOfLines={1}>{ad.name}</Text>
                                  <Text style={styles.metaCampaignObjective}>
                                    {ad.effective_status?.replace(/_/g, ' ') || ad.status || 'Unknown'}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.metaCampaignStats}>
                                <View style={styles.metaCampaignStat}>
                                  <Text style={styles.metaCampaignStatValue}>{formatMetaSpend(ad.spend)}</Text>
                                  <Text style={styles.metaCampaignStatLabel}>Spend</Text>
                                </View>
                                <View style={styles.metaCampaignStat}>
                                  <Text style={styles.metaCampaignStatValue}>{formatMetaNumber(ad.impressions)}</Text>
                                  <Text style={styles.metaCampaignStatLabel}>Impr</Text>
                                </View>
                                <View style={styles.metaCampaignStat}>
                                  <Text style={styles.metaCampaignStatValue}>{formatMetaNumber(ad.clicks)}</Text>
                                  <Text style={styles.metaCampaignStatLabel}>Clicks</Text>
                                </View>
                                <Pressable
                                  style={[
                                    styles.campaignActionButton,
                                    { backgroundColor: ad.status === 'ACTIVE' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)' }
                                  ]}
                                  onPress={async () => {
                                    if (!vendor?.id) return
                                    const newStatus = ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                                    await updateMetaAdStatus(vendor.id, ad.meta_ad_id, newStatus)
                                  }}
                                >
                                  <Ionicons
                                    name={ad.status === 'ACTIVE' ? 'pause' : 'play'}
                                    size={14}
                                    color={ad.status === 'ACTIVE' ? '#F59E0B' : '#10B981'}
                                  />
                                </Pressable>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </View>
              </>
            )}

            {/* Posts Sub-view */}
            {metaSubTab === 'posts' && (
              <>
                {/* Filter Bar */}
                <View style={styles.section}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {(['all', 'facebook', 'instagram'] as const).map((filter) => (
                        <Pressable
                          key={filter}
                          style={[
                            styles.metaFilterButton,
                            postsFilter === filter && styles.metaFilterButtonActive,
                          ]}
                          onPress={() => {
                            setMetaPostsFilter(filter)
                            if (vendor?.id) loadMetaPosts(vendor.id, filter)
                          }}
                        >
                          <Ionicons
                            name={filter === 'all' ? 'grid' : filter === 'facebook' ? 'logo-facebook' : 'logo-instagram'}
                            size={14}
                            color={postsFilter === filter ? '#fff' : colors.text.secondary}
                          />
                          <Text style={[
                            styles.metaFilterButtonText,
                            postsFilter === filter && styles.metaFilterButtonTextActive,
                          ]}>
                            {filter === 'all' ? 'All' : filter === 'facebook' ? 'Facebook' : 'Instagram'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      style={styles.metaSyncButton}
                      onPress={() => vendor?.id && syncMetaPosts(vendor.id, postsFilter)}
                      disabled={isSyncingPosts}
                    >
                      {isSyncingPosts ? (
                        <ActivityIndicator size="small" color="#007AFF" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={16} color="#007AFF" />
                          <Text style={{ color: '#007AFF', marginLeft: 4, fontSize: 13 }}>Sync</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {/* Posts Grid */}
                  {metaPosts.length === 0 ? (
                    <View style={styles.glassCard}>
                      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                        <Ionicons name="images-outline" size={48} color={colors.text.quaternary} />
                        <Text style={{ color: colors.text.tertiary, marginTop: spacing.md, fontSize: 16, fontWeight: '600' }}>
                          No Posts Yet
                        </Text>
                        <Text style={{ color: colors.text.quaternary, marginTop: spacing.xs, fontSize: 13, textAlign: 'center' }}>
                          Sync to pull posts from your Facebook Page & Instagram
                        </Text>
                        <Pressable
                          style={[styles.metaConnectButton, { marginTop: spacing.lg }]}
                          onPress={() => vendor?.id && syncMetaPosts(vendor.id)}
                          disabled={isSyncingPosts}
                        >
                          {isSyncingPosts ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.metaConnectButtonText}>Sync Posts</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.igGrid}>
                      {metaPosts.map((post) => {
                        const isVideo = post.post_type === 'video' || post.media_type === 'VIDEO'
                        const isCarousel = post.media_type === 'CAROUSEL_ALBUM' || post.post_type === 'album'
                        // For videos, prefer thumbnail_url; for others prefer full_picture/media_url
                        const imageUrl = isVideo
                          ? (post.thumbnail_url || post.full_picture || post.media_url)
                          : (post.full_picture || post.media_url || post.thumbnail_url)
                        const likes = post.platform === 'instagram'
                          ? (post.ig_likes_count || 0)
                          : (post.reactions_count || post.likes_count || 0)
                        const comments = post.platform === 'instagram'
                          ? (post.ig_comments_count || 0)
                          : (post.comments_count || 0)

                        return (
                          <Pressable
                            key={post.id}
                            style={styles.igPostCell}
                            onPress={() => post.permalink_url && Linking.openURL(post.permalink_url)}
                          >
                            {/* Image */}
                            {imageUrl ? (
                              <Image
                                source={{ uri: imageUrl }}
                                style={styles.igPostImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={[styles.igPostImage, styles.igPostPlaceholder]}>
                                <Ionicons
                                  name={post.platform === 'instagram' ? 'logo-instagram' : 'logo-facebook'}
                                  size={40}
                                  color={post.platform === 'instagram' ? '#E1306C' : '#1877F2'}
                                />
                                {post.message && (
                                  <Text style={styles.igPostPlaceholderText} numberOfLines={3}>
                                    {post.message}
                                  </Text>
                                )}
                              </View>
                            )}

                            {/* Type indicator (video/carousel) */}
                            {(isVideo || isCarousel) && (
                              <View style={styles.igTypeIndicator}>
                                <Ionicons
                                  name={isVideo ? 'play' : 'copy'}
                                  size={16}
                                  color="#fff"
                                />
                              </View>
                            )}

                            {/* Platform badge */}
                            <View style={[
                              styles.igPlatformBadge,
                              { backgroundColor: post.platform === 'instagram' ? '#E1306C' : '#1877F2' }
                            ]}>
                              <Ionicons
                                name={post.platform === 'instagram' ? 'logo-instagram' : 'logo-facebook'}
                                size={10}
                                color="#fff"
                              />
                            </View>

                            {/* Bottom gradient with stats */}
                            <View style={styles.igStatsBar}>
                              <View style={styles.igStatItem}>
                                <Ionicons name="heart" size={14} color="#fff" />
                                <Text style={styles.igStatText}>{formatMetaNumber(likes)}</Text>
                              </View>
                              <View style={styles.igStatItem}>
                                <Ionicons name="chatbubble" size={14} color="#fff" />
                                <Text style={styles.igStatText}>{formatMetaNumber(comments)}</Text>
                              </View>
                            </View>
                          </Pressable>
                        )
                      })}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Insights Sub-view */}
            {metaSubTab === 'insights' && (
              <>
                {/* Header with Date Range */}
                <View style={styles.insightsHeader}>
                  <View style={styles.insightsDatePills}>
                    {(['7d', '14d', '30d', '90d'] as const).map((range) => (
                      <Pressable
                        key={range}
                        style={[
                          styles.insightsDatePill,
                          insightsDateRange === range && styles.insightsDatePillActive,
                        ]}
                        onPress={() => setInsightsDateRange(range)}
                      >
                        <Text style={[
                          styles.insightsDatePillText,
                          insightsDateRange === range && styles.insightsDatePillTextActive,
                        ]}>
                          {range === '7d' ? '7D' : range === '14d' ? '14D' : range === '30d' ? '30D' : '90D'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    style={styles.insightsRefreshBtn}
                    onPress={() => {
                      if (vendor?.id) {
                        const { start, end } = getInsightsDateRange()
                        loadMetaInsights(vendor.id, start, end)
                      }
                    }}
                    disabled={isLoadingInsights}
                  >
                    {isLoadingInsights ? (
                      <ActivityIndicator size="small" color={colors.text.secondary} />
                    ) : (
                      <Ionicons name="refresh" size={18} color={colors.text.secondary} />
                    )}
                  </Pressable>
                </View>

                {/* Loading State */}
                {isLoadingInsights && (
                  <View style={styles.insightsLoading}>
                    <ActivityIndicator size="large" color="#1877F2" />
                    <Text style={styles.insightsLoadingText}>Loading insights...</Text>
                  </View>
                )}

                {/* Main Content - Always show structure */}
                {!isLoadingInsights && (
                  <>
                    {/* Platform Cards Row */}
                    <View style={styles.platformCardsRow}>
                      {/* Facebook Card */}
                      <View style={styles.platformCard}>
                        <View style={styles.platformCardHeader}>
                          <View style={[styles.platformIcon, { backgroundColor: '#1877F2' }]}>
                            <FontAwesome5 name="facebook-f" size={16} color="#fff" />
                          </View>
                          <Text style={styles.platformName}>Facebook</Text>
                        </View>
                        <View style={styles.platformStats}>
                          <View style={styles.platformStatRow}>
                            <Text style={styles.platformStatLabel}>Followers</Text>
                            <Text style={styles.platformStatValue}>
                              {metaInsights?.page?.totalFollowers != null ? formatMetaNumber(metaInsights.page.totalFollowers) : '—'}
                            </Text>
                          </View>
                          <View style={styles.platformStatRow}>
                            <Text style={styles.platformStatLabel}>Posts</Text>
                            <Text style={styles.platformStatValue}>
                              {(metaInsights?.page as any)?.postCount != null ? (metaInsights?.page as any)?.postCount : '—'}
                            </Text>
                          </View>
                          <View style={styles.platformStatRow}>
                            <Text style={styles.platformStatLabel}>Likes</Text>
                            <Text style={styles.platformStatValue}>
                              {(metaInsights?.page as any)?.totalLikes != null ? formatMetaNumber((metaInsights?.page as any)?.totalLikes) : '—'}
                            </Text>
                          </View>
                          <View style={styles.platformStatRow}>
                            <Text style={styles.platformStatLabel}>Comments</Text>
                            <Text style={styles.platformStatValue}>
                              {(metaInsights?.page as any)?.totalComments != null ? formatMetaNumber((metaInsights?.page as any)?.totalComments) : '—'}
                            </Text>
                          </View>
                          <View style={styles.platformStatRow}>
                            <Text style={styles.platformStatLabel}>Shares</Text>
                            <Text style={styles.platformStatValue}>
                              {(metaInsights?.page as any)?.totalShares != null ? formatMetaNumber((metaInsights?.page as any)?.totalShares) : '—'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Instagram Card */}
                      <View style={styles.platformCard}>
                        <View style={styles.platformCardHeader}>
                          <View style={[styles.platformIcon, { backgroundColor: '#E4405F' }]}>
                            <FontAwesome5 name="instagram" size={16} color="#fff" />
                          </View>
                          <Text style={styles.platformName}>Instagram</Text>
                        </View>
                        <View style={styles.platformStats}>
                          <View style={styles.platformStatRow}>
                            <Text style={styles.platformStatLabel}>Followers</Text>
                            <Text style={styles.platformStatValue}>
                              {metaInsights?.instagram?.followers != null ? formatMetaNumber(metaInsights.instagram.followers) : '—'}
                            </Text>
                          </View>
                          <View style={styles.platformStatRow}>
                            <Text style={styles.platformStatLabel}>Posts</Text>
                            <Text style={styles.platformStatValue}>
                              {(metaInsights?.instagram as any)?.recentPostCount != null ? (metaInsights?.instagram as any)?.recentPostCount : '—'}
                            </Text>
                          </View>
                          <View style={styles.platformStatRow}>
                            <Text style={styles.platformStatLabel}>Likes</Text>
                            <Text style={styles.platformStatValue}>
                              {(metaInsights?.instagram as any)?.totalLikes != null ? formatMetaNumber((metaInsights?.instagram as any)?.totalLikes) : '—'}
                            </Text>
                          </View>
                          <View style={styles.platformStatRow}>
                            <Text style={styles.platformStatLabel}>Comments</Text>
                            <Text style={styles.platformStatValue}>
                              {(metaInsights?.instagram as any)?.totalComments != null ? formatMetaNumber((metaInsights?.instagram as any)?.totalComments) : '—'}
                            </Text>
                          </View>
                          <View style={styles.platformStatRow}>
                            <Text style={styles.platformStatLabel}>Reach</Text>
                            <Text style={styles.platformStatValue}>
                              {metaInsights?.instagram?.reach != null ? formatMetaNumber(metaInsights.instagram.reach) : '—'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Ads Performance Section */}
                    {metaInsights?.summary && (
                      <View style={styles.adsSection}>
                        <View style={styles.adsSectionHeader}>
                          <FontAwesome5 name="bullhorn" size={14} color="#F59E0B" />
                          <Text style={styles.adsSectionTitle}>Paid Ads</Text>
                          <View style={[
                            styles.roasBadge,
                            { backgroundColor: metaInsights.summary.roas >= 1 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }
                          ]}>
                            <Text style={[
                              styles.roasBadgeText,
                              { color: metaInsights.summary.roas >= 1 ? '#10B981' : '#EF4444' }
                            ]}>
                              {metaInsights.summary.roas.toFixed(2)}x ROAS
                            </Text>
                          </View>
                        </View>
                        <View style={styles.adsGrid}>
                          <View style={styles.adsGridItem}>
                            <Text style={[styles.adsGridValue, { color: '#F59E0B' }]}>{formatMetaSpend(metaInsights.summary.spend)}</Text>
                            <Text style={styles.adsGridLabel}>Spend</Text>
                          </View>
                          <View style={styles.adsGridItem}>
                            <Text style={[styles.adsGridValue, { color: '#10B981' }]}>{metaInsights.summary.purchases}</Text>
                            <Text style={styles.adsGridLabel}>Sales</Text>
                          </View>
                          <View style={styles.adsGridItem}>
                            <Text style={styles.adsGridValue}>{formatMetaNumber(metaInsights.summary.impressions)}</Text>
                            <Text style={styles.adsGridLabel}>Impressions</Text>
                          </View>
                          <View style={styles.adsGridItem}>
                            <Text style={styles.adsGridValue}>{formatMetaNumber(metaInsights.summary.clicks)}</Text>
                            <Text style={styles.adsGridLabel}>Clicks</Text>
                          </View>
                          <View style={styles.adsGridItem}>
                            <Text style={styles.adsGridValue}>{metaInsights.summary.ctr.toFixed(2)}%</Text>
                            <Text style={styles.adsGridLabel}>CTR</Text>
                          </View>
                          <View style={styles.adsGridItem}>
                            <Text style={styles.adsGridValue}>{formatMetaSpend(metaInsights.summary.cpc)}</Text>
                            <Text style={styles.adsGridLabel}>CPC</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Campaigns List */}
                    {metaInsights?.campaigns && metaInsights.campaigns.length > 0 && (
                      <View style={styles.campaignsSection}>
                        <Text style={styles.campaignsSectionTitle}>Top Campaigns</Text>
                        {metaInsights.campaigns.slice(0, 5).map((campaign) => (
                          <View key={campaign.campaignId} style={styles.campaignRow}>
                            <View style={styles.campaignRowInfo}>
                              <Text style={styles.campaignRowName} numberOfLines={1}>{campaign.campaignName}</Text>
                              <Text style={styles.campaignRowStats}>
                                {formatMetaSpend(campaign.spend)} · {formatMetaNumber(campaign.clicks)} clicks
                              </Text>
                            </View>
                            <View style={[
                              styles.campaignRowRoas,
                              { backgroundColor: campaign.roas >= 1 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }
                            ]}>
                              <Text style={[
                                styles.campaignRowRoasText,
                                { color: campaign.roas >= 1 ? '#10B981' : '#EF4444' }
                              ]}>
                                {campaign.roas.toFixed(1)}x
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Empty State - only show if nothing loaded */}
                    {!metaInsights?.page && !metaInsights?.instagram && !metaInsights?.summary && (
                      <View style={styles.insightsEmpty}>
                        <Ionicons name="analytics-outline" size={48} color={colors.text.quaternary} />
                        <Text style={styles.insightsEmptyTitle}>No data available</Text>
                        <Text style={styles.insightsEmptyText}>
                          Connect your Facebook Page or Instagram account to see insights
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </>
            )}

            <View style={{ height: 100 }} />
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
              subtitle="Loyalty & order pass marketing"
            />

            {/* LOYALTY PASS STATS */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Loyalty Passes</Text>
              <Text style={styles.sectionSubtitle}>Customer loyalty cards added to Apple Wallet</Text>
              <View style={styles.heroSection}>
                <View style={styles.heroCard}>
                  <Ionicons name="card" size={24} color="#A855F7" style={{ marginBottom: spacing.xs }} />
                  <Text style={styles.heroNumber}>{walletStats?.loyaltyPasses?.total || 0}</Text>
                  <Text style={styles.heroLabel}>Total Created</Text>
                </View>
                <View style={styles.heroCard}>
                  <Ionicons name="phone-portrait" size={24} color="#34c759" style={{ marginBottom: spacing.xs }} />
                  <Text style={styles.heroNumber}>{walletStats?.loyaltyPasses?.active || 0}</Text>
                  <Text style={styles.heroLabel}>Active on Devices</Text>
                </View>
                <View style={styles.heroCard}>
                  <Ionicons name="notifications" size={24} color="#007AFF" style={{ marginBottom: spacing.xs }} />
                  <Text style={styles.heroNumber}>{walletStats?.loyaltyPasses?.pushEnabled || 0}</Text>
                  <Text style={styles.heroLabel}>Push Enabled</Text>
                </View>
                <View style={styles.heroCard}>
                  <Ionicons name="trending-up" size={24} color="#10B981" style={{ marginBottom: spacing.xs }} />
                  <Text style={styles.heroNumber}>
                    {walletStats?.loyaltyPasses?.total && walletStats?.loyaltyPasses?.active
                      ? `${Math.round((walletStats.loyaltyPasses.active / walletStats.loyaltyPasses.total) * 100)}%`
                      : '0%'}
                  </Text>
                  <Text style={styles.heroLabel}>Adoption Rate</Text>
                </View>
              </View>
            </View>

            {/* RECENT LOYALTY ACTIVITY */}
            {walletStats?.recentLoyaltyActivity && walletStats.recentLoyaltyActivity.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Loyalty Pass Activity</Text>
                <View style={styles.glassCard}>
                  {walletStats.recentLoyaltyActivity.map((activity, index) => (
                    <View
                      key={`loyalty-${index}`}
                      style={[
                        styles.activityRow,
                        index < walletStats.recentLoyaltyActivity.length - 1 && styles.borderBottom,
                      ]}
                    >
                      <View style={styles.activityIcon}>
                        <Ionicons name="card" size={20} color="#A855F7" />
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityOrder}>{activity.customer_name}</Text>
                        <Text style={styles.activityStatus}>Added loyalty pass</Text>
                      </View>
                      <Text style={styles.activityTime}>
                        {new Date(activity.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ORDER PASS STATS */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Passes</Text>
              <Text style={styles.sectionSubtitle}>Order tracking passes for shipments</Text>
              <View style={styles.heroSection}>
                <View style={styles.heroCard}>
                  <Ionicons name="cube" size={24} color={colors.text.secondary} style={{ marginBottom: spacing.xs }} />
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
            </View>

            {/* PASS PREVIEW - Tap to Open Actual Pass */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Wallet Passes</Text>
              <Text style={styles.sectionSubtitle}>
                Tap a pass to preview and add to Apple Wallet
              </Text>

              <View style={styles.passCardsContainer}>
                {/* Order Pass */}
                {walletStats?.sampleOrder ? (
                  <Pressable
                    style={({ pressed }) => [styles.passCard, pressed && styles.passCardPressed]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      const passUrl = `https://uaednwpxursknmwdeejn.supabase.co/functions/v1/order-pass?order_id=${walletStats.sampleOrder!.id}`
                      const { Linking } = require('react-native')
                      Linking.openURL(passUrl)
                    }}
                  >
                    {/* Mini Pass Preview - styled to match actual pass */}
                    <View style={styles.miniPassContainer}>
                      {/* Header */}
                      <View style={styles.miniPassHeader}>
                        {vendor?.logo_url ? (
                          <Image source={{ uri: vendor.logo_url }} style={styles.miniPassLogo} />
                        ) : (
                          <View style={styles.miniPassLogoPlaceholder}>
                            <Text style={styles.miniPassLogoText}>{vendor?.store_name?.charAt(0) || 'F'}</Text>
                          </View>
                        )}
                        <Text style={styles.miniPassStoreName}>{vendor?.store_name || 'Flora Distro'}</Text>
                        <View style={styles.miniPassHeaderField}>
                          <Text style={styles.miniPassLabel}>ORDER</Text>
                          <Text style={styles.miniPassValue}>{walletStats.sampleOrder.order_type === 'pickup' ? 'PICKUP' : 'SHIPPING'}</Text>
                        </View>
                      </View>
                      {/* Status */}
                      <View style={styles.miniPassStatus}>
                        <Text style={styles.miniPassLabel}>STATUS</Text>
                        <Text style={styles.miniPassStatusValue}>
                          {walletStats.sampleOrder.status === 'pending' || walletStats.sampleOrder.status === 'confirmed' ? '✓ CONFIRMED' :
                           walletStats.sampleOrder.status === 'shipped' ? '🚚 SHIPPED' :
                           walletStats.sampleOrder.status === 'delivered' ? '✅ DELIVERED' :
                           walletStats.sampleOrder.status.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </View>
                      {/* QR placeholder */}
                      <View style={styles.miniPassQR}>
                        <Ionicons name="qr-code" size={48} color="#333" />
                        <Text style={styles.miniPassQRText}>{walletStats.sampleOrder.order_number}</Text>
                      </View>
                    </View>
                    <View style={styles.passCardLabel}>
                      <Ionicons name="cube-outline" size={16} color={colors.text.secondary} />
                      <Text style={styles.passCardLabelText}>Order Pass</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.text.quaternary} />
                    </View>
                  </Pressable>
                ) : (
                  <View style={[styles.passCard, styles.passCardEmpty]}>
                    <View style={styles.passCardEmptyContent}>
                      <Ionicons name="cube-outline" size={32} color={colors.text.quaternary} />
                      <Text style={styles.passCardEmptyText}>Order Pass</Text>
                      <Text style={styles.passCardEmptySubtext}>Create an order to preview</Text>
                    </View>
                  </View>
                )}

                {/* Staff/Loyalty Pass */}
                <Pressable
                  style={({ pressed }) => [styles.passCard, pressed && styles.passCardPressed]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    const passUrl = `https://uaednwpxursknmwdeejn.supabase.co/functions/v1/wallet-pass?email=${encodeURIComponent(user?.email || '')}`
                    const { Linking } = require('react-native')
                    Linking.openURL(passUrl)
                  }}
                >
                  {/* Mini Pass Preview - Loyalty style */}
                  <View style={styles.miniPassContainer}>
                    {/* Header */}
                    <View style={styles.miniPassHeader}>
                      {vendor?.logo_url ? (
                        <Image source={{ uri: vendor.logo_url }} style={styles.miniPassLogo} />
                      ) : (
                        <View style={styles.miniPassLogoPlaceholder}>
                          <Text style={styles.miniPassLogoText}>{vendor?.store_name?.charAt(0) || 'F'}</Text>
                        </View>
                      )}
                      <Text style={styles.miniPassStoreName}>{vendor?.store_name || 'Flora Distro'}</Text>
                      <View style={styles.miniPassHeaderField}>
                        <Text style={styles.miniPassLabel}>MEMBER</Text>
                        <Text style={styles.miniPassValue}>STAFF</Text>
                      </View>
                    </View>
                    {/* Points */}
                    <View style={styles.miniPassStatus}>
                      <Text style={styles.miniPassLabel}>POINTS</Text>
                      <Text style={styles.miniPassStatusValue}>⭐ 0</Text>
                    </View>
                    {/* QR placeholder */}
                    <View style={styles.miniPassQR}>
                      <Ionicons name="qr-code" size={48} color="#333" />
                      <Text style={styles.miniPassQRText}>{user?.email?.split('@')[0] || 'staff'}</Text>
                    </View>
                  </View>
                  <View style={styles.passCardLabel}>
                    <Ionicons name="star-outline" size={16} color={colors.text.secondary} />
                    <Text style={styles.passCardLabelText}>Loyalty Pass</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.text.quaternary} />
                  </View>
                </Pressable>
              </View>

              {/* Pass Info */}
              <View style={styles.walletPassDescription}>
                <Text style={styles.walletPassDescriptionTitle}>Real-time Push Notifications</Text>
                <Text style={styles.walletPassDescriptionText}>
                  When order status changes, customers receive instant notifications on their lock screen.
                  The pass automatically updates with tracking info and delivery progress.
                </Text>
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
          onItemPress={(id) => setActiveNav(id as 'campaigns' | 'segments' | 'loyalty' | 'discounts' | 'channels' | 'meta' | 'affiliates' | 'wallet')}
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

                      {/* Segment options - ensure selected segment always appears at top */}
                      {(() => {
                        // Build segments list: selected segment first (if any), then other segments
                        const segmentsWithCustomers = segments.filter(s => s.customer_count > 0 || s.name === 'Staff')
                        const selectedSeg = selectedSegmentId ? segments.find(s => s.id === selectedSegmentId) : null

                        // If selected segment exists and isn't in the filtered list, add it
                        let displaySegments: typeof segments = []
                        if (selectedSeg && !segmentsWithCustomers.find(s => s.id === selectedSeg.id)) {
                          displaySegments = [selectedSeg, ...segmentsWithCustomers.slice(0, 4)]
                        } else if (selectedSeg) {
                          // Move selected segment to top
                          const others = segmentsWithCustomers.filter(s => s.id !== selectedSeg.id)
                          displaySegments = [selectedSeg, ...others.slice(0, 4)]
                        } else {
                          displaySegments = segmentsWithCustomers.slice(0, 5)
                        }

                        return displaySegments.map((segment) => (
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
                        ))
                      })()}
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
            <Text style={styles.modalHeaderTitle}>Add Affiliate</Text>
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

      {/* Campaign Creation Modal - Full Screen */}
      <Modal
        visible={showCampaignModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowCampaignModal(false)}
      >
        <View style={[styles.creatorContainer, { paddingTop: insets.top }]}>
          <View style={styles.creatorLayout}>
            {/* LEFT PANEL - Form */}
            <View style={styles.creatorSidebar}>
              <View style={styles.creatorHeader}>
                <Pressable onPress={() => setShowCampaignModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </Pressable>
                <Text style={styles.creatorTitle}>Create Ad Campaign</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView
                style={styles.creatorScroll}
                contentContainerStyle={styles.creatorContent}
                showsVerticalScrollIndicator={false}
              >
                {/* STEP 1: Campaign Details */}
                <View style={styles.creatorSection}>
                  <Text style={styles.stepLabel}>1. CAMPAIGN DETAILS</Text>
                  <TextInput
                    style={styles.adInput}
                    placeholder="Campaign name"
                    placeholderTextColor={colors.text.placeholder}
                    value={campaignForm.name}
                    onChangeText={(text) => setCampaignForm(f => ({ ...f, name: text }))}
                  />
                </View>

                {/* STEP 2: Objective */}
                <View style={styles.creatorSection}>
                  <Text style={styles.stepLabel}>2. OBJECTIVE</Text>
                  <Text style={styles.adHelpText}>What do you want to achieve with this campaign?</Text>
                  <View style={styles.objectiveGrid}>
                    {[
                      { value: 'OUTCOME_SALES', label: 'Sales', icon: 'cart', desc: 'Drive purchases on your website' },
                      { value: 'OUTCOME_TRAFFIC', label: 'Traffic', icon: 'arrow-forward', desc: 'Send people to your website' },
                      { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement', icon: 'heart', desc: 'Get more likes, comments, shares' },
                      { value: 'OUTCOME_LEADS', label: 'Leads', icon: 'people', desc: 'Collect contact information' },
                      { value: 'OUTCOME_AWARENESS', label: 'Awareness', icon: 'eye', desc: 'Reach new audiences' },
                    ].map((obj) => (
                      <Pressable
                        key={obj.value}
                        style={[
                          styles.objectiveCard,
                          campaignForm.objective === obj.value && styles.objectiveCardActive,
                        ]}
                        onPress={() => setCampaignForm(f => ({ ...f, objective: obj.value }))}
                      >
                        <View style={[
                          styles.objectiveIconWrap,
                          campaignForm.objective === obj.value && styles.objectiveIconWrapActive,
                        ]}>
                          <Ionicons
                            name={obj.icon as any}
                            size={20}
                            color={campaignForm.objective === obj.value ? '#10B981' : colors.text.tertiary}
                          />
                        </View>
                        <Text style={[
                          styles.objectiveCardLabel,
                          campaignForm.objective === obj.value && styles.objectiveCardLabelActive,
                        ]}>
                          {obj.label}
                        </Text>
                        <Text style={styles.objectiveCardDesc}>{obj.desc}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* STEP 3: Budget */}
                <View style={styles.creatorSection}>
                  <Text style={styles.stepLabel}>3. DAILY BUDGET</Text>

                  {/* Budget Display */}
                  <View style={styles.budgetDisplayContainer}>
                    <Text style={styles.budgetDisplayAmount}>${campaignForm.dailyBudget}</Text>
                    <Text style={styles.budgetDisplayPeriod}>per day</Text>
                  </View>

                  {/* Budget Slider */}
                  <View style={styles.budgetSliderContainer}>
                    <Slider
                      style={styles.budgetSlider}
                      minimumValue={5}
                      maximumValue={500}
                      step={5}
                      value={campaignForm.dailyBudget}
                      onValueChange={(value) => setCampaignForm(f => ({ ...f, dailyBudget: value }))}
                      minimumTrackTintColor="#1877F2"
                      maximumTrackTintColor={colors.border.regular}
                      thumbTintColor="#1877F2"
                    />
                    <View style={styles.budgetSliderLabels}>
                      <Text style={styles.budgetSliderLabel}>$5</Text>
                      <Text style={styles.budgetSliderLabel}>$500</Text>
                    </View>
                  </View>

                  {/* Quick Presets */}
                  <View style={styles.budgetPresets}>
                    {[10, 25, 50, 100, 200].map((amount) => (
                      <Pressable
                        key={amount}
                        style={[
                          styles.budgetPreset,
                          campaignForm.dailyBudget === amount && styles.budgetPresetActive,
                        ]}
                        onPress={() => setCampaignForm(f => ({ ...f, dailyBudget: amount }))}
                      >
                        <Text style={[
                          styles.budgetPresetText,
                          campaignForm.dailyBudget === amount && styles.budgetPresetTextActive,
                        ]}>
                          ${amount}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Monthly Estimate */}
                  <View style={styles.budgetEstimateContainer}>
                    <Ionicons name="calendar-outline" size={16} color={colors.text.tertiary} />
                    <Text style={styles.budgetEstimate}>
                      Estimated monthly: <Text style={styles.budgetEstimateValue}>${(campaignForm.dailyBudget * 30).toLocaleString()}</Text>
                    </Text>
                  </View>
                </View>

                {/* STEP 4: Launch Settings */}
                <View style={styles.creatorSection}>
                  <Text style={styles.stepLabel}>4. LAUNCH SETTINGS</Text>
                  <Pressable
                    style={styles.launchOption}
                    onPress={() => setCampaignForm(f => ({ ...f, status: 'PAUSED' }))}
                  >
                    <View style={[
                      styles.launchRadio,
                      campaignForm.status === 'PAUSED' && styles.launchRadioActive,
                    ]}>
                      {campaignForm.status === 'PAUSED' && <View style={styles.launchRadioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.launchOptionLabel}>Start Paused</Text>
                      <Text style={styles.launchOptionDesc}>Review and activate manually in Meta Ads Manager</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={styles.launchOption}
                    onPress={() => setCampaignForm(f => ({ ...f, status: 'ACTIVE' }))}
                  >
                    <View style={[
                      styles.launchRadio,
                      campaignForm.status === 'ACTIVE' && styles.launchRadioActive,
                    ]}>
                      {campaignForm.status === 'ACTIVE' && <View style={styles.launchRadioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.launchOptionLabel}>Launch Immediately</Text>
                      <Text style={styles.launchOptionDesc}>Campaign will go live after Meta review</Text>
                    </View>
                  </Pressable>
                </View>
              </ScrollView>

              {/* Bottom Actions */}
              <View style={styles.adCreatorActions}>
                <Pressable
                  style={styles.adCreatorCancel}
                  onPress={() => {
                    setShowCampaignModal(false)
                    setEditingDraftId(null)
                  }}
                >
                  <Text style={styles.adCreatorCancelText}>Cancel</Text>
                </Pressable>

                {/* Save Draft Button */}
                <Pressable
                  style={[
                    styles.adCreatorDraft,
                    (!campaignForm.name || isSavingDraft) && styles.adCreatorDraftDisabled,
                  ]}
                  onPress={async () => {
                    if (!campaignForm.name || !vendor?.id || isSavingDraft) return
                    setIsSavingDraft(true)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    try {
                      await saveCampaignDraft(vendor.id, {
                        id: editingDraftId || undefined,
                        name: campaignForm.name,
                        objective: campaignForm.objective,
                        daily_budget: campaignForm.dailyBudget,
                        status: 'DRAFT',
                      })
                      setShowCampaignModal(false)
                      setCampaignForm({ name: '', objective: 'OUTCOME_SALES', dailyBudget: 25, status: 'PAUSED' })
                      setEditingDraftId(null)
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                      syncMetaCampaigns(vendor.id)
                    } finally {
                      setIsSavingDraft(false)
                    }
                  }}
                  disabled={!campaignForm.name || isSavingDraft}
                >
                  {isSavingDraft ? (
                    <ActivityIndicator size="small" color={colors.text.secondary} />
                  ) : (
                    <>
                      <Ionicons name="document-outline" size={16} color={colors.text.secondary} />
                      <Text style={styles.adCreatorDraftText}>
                        {editingDraftId ? 'Update Draft' : 'Save Draft'}
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Create Campaign Button */}
                <Pressable
                  style={[
                    styles.adCreatorSubmit,
                    (!campaignForm.name || isCreatingCampaign) && styles.adCreatorSubmitDisabled,
                  ]}
                  onPress={async () => {
                    if (!campaignForm.name || !vendor?.id || isCreatingCampaign) return
                    setIsCreatingCampaign(true)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    try {
                      const result = await createMetaCampaign(vendor.id, {
                        name: campaignForm.name,
                        objective: campaignForm.objective,
                        status: campaignForm.status,
                        daily_budget: campaignForm.dailyBudget,
                      })
                      if (result) {
                        // Delete draft if we were editing one
                        if (editingDraftId) {
                          await deleteCampaignDraft(editingDraftId)
                        }
                        setShowCampaignModal(false)
                        setCampaignForm({ name: '', objective: 'OUTCOME_SALES', dailyBudget: 25, status: 'PAUSED' })
                        setEditingDraftId(null)
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                        syncMetaCampaigns(vendor.id)
                      } else {
                        // Show error if no result returned
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                        Alert.alert(
                          'Campaign Creation Failed',
                          'Could not create the campaign. Please check your Meta permissions and try again.',
                          [{ text: 'OK' }]
                        )
                      }
                    } catch (err: any) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                      Alert.alert(
                        'Campaign Creation Failed',
                        err?.message || 'An unexpected error occurred. Please try again.',
                        [{ text: 'OK' }]
                      )
                    } finally {
                      setIsCreatingCampaign(false)
                    }
                  }}
                  disabled={!campaignForm.name || isCreatingCampaign}
                >
                  {isCreatingCampaign ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <FontAwesome5 name="rocket" size={14} color="#fff" />
                      <Text style={styles.adCreatorSubmitText}>Create Campaign</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>

            {/* RIGHT PANEL - Preview */}
            <View style={styles.creatorPreview}>
              <View style={styles.adPreviewHeader}>
                <Text style={styles.adPreviewTitle}>Campaign Preview</Text>
              </View>
              <View style={styles.adPreviewContent}>
                {campaignForm.name ? (
                  <View style={styles.adPreviewCard}>
                    <View style={styles.adPreviewCardHeader}>
                      <View style={[styles.adPreviewStatus, { backgroundColor: campaignForm.status === 'ACTIVE' ? '#10B981' : '#F59E0B' }]} />
                      <Text style={styles.adPreviewCardName}>{campaignForm.name}</Text>
                    </View>
                    <View style={styles.adPreviewMeta}>
                      <View style={styles.adPreviewMetaItem}>
                        <Ionicons name="flag" size={14} color={colors.text.tertiary} />
                        <Text style={styles.adPreviewMetaText}>
                          {campaignForm.objective.replace('OUTCOME_', '')}
                        </Text>
                      </View>
                      <View style={styles.adPreviewMetaItem}>
                        <Ionicons name="wallet" size={14} color={colors.text.tertiary} />
                        <Text style={styles.adPreviewMetaText}>
                          ${campaignForm.dailyBudget || '0'}/day
                        </Text>
                      </View>
                      <View style={styles.adPreviewMetaItem}>
                        <Ionicons name="time" size={14} color={colors.text.tertiary} />
                        <Text style={styles.adPreviewMetaText}>
                          {campaignForm.status === 'ACTIVE' ? 'Starts immediately' : 'Starts paused'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.adPreviewNote}>
                      <Ionicons name="information-circle" size={16} color="#3B82F6" />
                      <Text style={styles.adPreviewNoteText}>
                        After creating, add Ad Sets and Ads in Meta Ads Manager to complete setup
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.adPreviewEmpty}>
                    <FontAwesome5 name="ad" size={48} color={colors.text.quaternary} />
                    <Text style={styles.adPreviewEmptyText}>Enter campaign details to see preview</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ad Set Creation Modal - Full Featured */}
      <Modal
        visible={showAdSetModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAdSetModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <View style={[styles.modalContainer, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: colors.border.light }]}>
            <Pressable onPress={() => setShowAdSetModal(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </Pressable>
            <Text style={styles.modalTitle}>Create Ad Set</Text>
            <Pressable
              onPress={async () => {
                if (!adSetForm.name || !vendor?.id || !selectedMetaCampaign || isCreatingAdSet) return
                setIsCreatingAdSet(true)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                try {
                  const result = await createMetaAdSet(vendor.id, {
                    campaignId: selectedMetaCampaign,
                    name: adSetForm.name,
                    status: adSetForm.status,
                    daily_budget: adSetForm.dailyBudget,
                    optimization_goal: adSetForm.optimization_goal,
                    billing_event: adSetForm.billing_event,
                    targeting: {
                      geo_locations: { countries: adSetForm.countries },
                      age_min: adSetForm.age_min,
                      age_max: adSetForm.age_max,
                      genders: adSetForm.genders.length > 0 ? adSetForm.genders : undefined,
                      interests: adSetForm.interests.length > 0 ? adSetForm.interests : undefined,
                      publisher_platforms: adSetForm.publisher_platforms,
                    },
                  })
                  if (result) {
                    setShowAdSetModal(false)
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  }
                } catch (err: any) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  Alert.alert('Error', err?.message || 'Failed to create ad set')
                } finally {
                  setIsCreatingAdSet(false)
                }
              }}
              disabled={!adSetForm.name || isCreatingAdSet}
              style={{ opacity: (!adSetForm.name || isCreatingAdSet) ? 0.5 : 1 }}
            >
              {isCreatingAdSet ? (
                <ActivityIndicator size="small" color="#1877F2" />
              ) : (
                <Text style={{ color: '#1877F2', fontWeight: '600', fontSize: 16 }}>Create</Text>
              )}
            </Pressable>
          </View>

          {/* Two Panel Layout */}
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {/* LEFT PANEL - Form */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Ad Set Name */}
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.inputLabel}>Ad Set Name</Text>
                <TextInput
                  style={styles.adInput}
                  placeholder="e.g., US Adults 25-55"
                  placeholderTextColor={colors.text.placeholder}
                  value={adSetForm.name}
                  onChangeText={(text) => setAdSetForm(f => ({ ...f, name: text }))}
                />
              </View>

              {/* Daily Budget */}
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.inputLabel}>Daily Budget</Text>
                <View style={styles.budgetDisplayContainer}>
                  <Text style={styles.budgetDisplayAmount}>${adSetForm.dailyBudget}</Text>
                  <Text style={styles.budgetDisplayPeriod}>per day</Text>
                </View>
                <Slider
                  style={styles.budgetSlider}
                  minimumValue={5}
                  maximumValue={500}
                  step={5}
                  value={adSetForm.dailyBudget}
                  onValueChange={(value) => setAdSetForm(f => ({ ...f, dailyBudget: value }))}
                  minimumTrackTintColor="#1877F2"
                  maximumTrackTintColor={colors.border.regular}
                  thumbTintColor="#1877F2"
                />
              </View>

              {/* Gender */}
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {[
                    { value: [], label: 'All' },
                    { value: [1], label: 'Men' },
                    { value: [2], label: 'Women' },
                  ].map((g) => (
                    <Pressable
                      key={g.label}
                      style={[
                        styles.budgetPreset,
                        JSON.stringify(adSetForm.genders) === JSON.stringify(g.value) && styles.budgetPresetActive,
                        { flex: 1 }
                      ]}
                      onPress={() => setAdSetForm(f => ({ ...f, genders: g.value }))}
                    >
                      <Text style={[
                        styles.budgetPresetText,
                        JSON.stringify(adSetForm.genders) === JSON.stringify(g.value) && styles.budgetPresetTextActive,
                      ]}>
                        {g.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Age Range */}
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.inputLabel}>Age Range: {adSetForm.age_min} - {adSetForm.age_max}{adSetForm.age_max >= 65 ? '+' : ''}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Slider
                      minimumValue={18}
                      maximumValue={65}
                      step={1}
                      value={adSetForm.age_min}
                      onValueChange={(value) => setAdSetForm(f => ({ ...f, age_min: Math.min(value, f.age_max - 1) }))}
                      minimumTrackTintColor="#1877F2"
                      maximumTrackTintColor={colors.border.regular}
                      thumbTintColor="#1877F2"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Slider
                      minimumValue={19}
                      maximumValue={65}
                      step={1}
                      value={adSetForm.age_max}
                      onValueChange={(value) => setAdSetForm(f => ({ ...f, age_max: Math.max(value, f.age_min + 1) }))}
                      minimumTrackTintColor="#1877F2"
                      maximumTrackTintColor={colors.border.regular}
                      thumbTintColor="#1877F2"
                    />
                  </View>
                </View>
              </View>

              {/* Interests - Smart Search */}
              <View style={{ marginBottom: spacing.lg, zIndex: 10 }}>
                <Text style={styles.inputLabel}>Detailed Targeting</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginBottom: spacing.sm }}>
                  Add interests, behaviors, or demographics
                </Text>

                {/* Search Input */}
                <View style={{ position: 'relative' }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.glass.regular,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: interestSearch ? '#1877F2' : colors.border.light,
                    paddingHorizontal: spacing.md,
                  }}>
                    <Ionicons name="search" size={18} color={colors.text.tertiary} />
                    <TextInput
                      style={{
                        flex: 1,
                        paddingVertical: spacing.md,
                        paddingHorizontal: spacing.sm,
                        fontSize: 15,
                        color: colors.text.primary,
                      }}
                      placeholder="Search interests, behaviors..."
                      placeholderTextColor={colors.text.placeholder}
                      value={interestSearch}
                      onChangeText={(text) => {
                        setInterestSearch(text)
                        // Debounced auto-search (150ms for snappy feel)
                        if (interestSearchRef.current) {
                          clearTimeout(interestSearchRef.current)
                        }
                        if (text.trim().length >= 2 && vendor?.id) {
                          setIsSearchingInterests(true) // Show loading immediately
                          interestSearchRef.current = setTimeout(async () => {
                            const results = await searchTargeting(vendor.id, 'interests', text)
                            setInterestResults(results)
                            setIsSearchingInterests(false)
                          }, 150)
                        } else {
                          setInterestResults([])
                          setIsSearchingInterests(false)
                        }
                      }}
                    />
                    {isSearchingInterests && <ActivityIndicator size="small" color="#1877F2" />}
                    {interestSearch && !isSearchingInterests && (
                      <Pressable onPress={() => { setInterestSearch(''); setInterestResults([]) }}>
                        <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                      </Pressable>
                    )}
                  </View>

                  {/* Smart Search Dropdown */}
                  {interestResults.length > 0 && (
                    <View style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: colors.background.primary,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 12,
                      elevation: 8,
                      maxHeight: 280,
                      marginTop: 4,
                      overflow: 'hidden',
                    }}>
                      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                        {interestResults.slice(0, 8).map((interest, index) => {
                          const isSelected = adSetForm.interests.find(i => i.id === interest.id)
                          return (
                            <Pressable
                              key={interest.id}
                              style={({ pressed }) => ({
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingVertical: spacing.md,
                                paddingHorizontal: spacing.md,
                                backgroundColor: pressed ? colors.glass.regular : isSelected ? 'rgba(24,119,242,0.05)' : 'transparent',
                                borderBottomWidth: index < interestResults.length - 1 ? 1 : 0,
                                borderBottomColor: colors.border.light,
                              })}
                              onPress={() => {
                                if (!isSelected) {
                                  setAdSetForm(f => ({ ...f, interests: [...f.interests, { id: interest.id, name: interest.name }] }))
                                }
                                setInterestResults([])
                                setInterestSearch('')
                              }}
                            >
                              <View style={{ flex: 1, marginRight: spacing.sm }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                                  <Ionicons name="heart-outline" size={16} color="#1877F2" />
                                  <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '500' }}>
                                    {interest.name}
                                  </Text>
                                </View>
                                {interest.audience_size && (
                                  <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2, marginLeft: 20 }}>
                                    {formatMetaNumber(interest.audience_size)} people
                                  </Text>
                                )}
                              </View>
                              {isSelected ? (
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                              ) : (
                                <Ionicons name="add-circle-outline" size={20} color="#1877F2" />
                              )}
                            </Pressable>
                          )
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Selected Interests Tags */}
                {adSetForm.interests.length > 0 && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={{ color: colors.text.tertiary, fontSize: 11, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Included ({adSetForm.interests.length})
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                      {adSetForm.interests.map((interest) => (
                        <View
                          key={interest.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#1877F2',
                            paddingLeft: 12,
                            paddingRight: 8,
                            paddingVertical: 6,
                            borderRadius: 20,
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>{interest.name}</Text>
                          <Pressable
                            onPress={() => setAdSetForm(f => ({ ...f, interests: f.interests.filter(i => i.id !== interest.id) }))}
                            style={{ marginLeft: 6, padding: 2 }}
                          >
                            <Ionicons name="close" size={14} color="rgba(255,255,255,0.8)" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Platforms */}
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.inputLabel}>Platforms</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {['facebook', 'instagram'].map((platform) => (
                    <Pressable
                      key={platform}
                      style={[
                        styles.budgetPreset,
                        adSetForm.publisher_platforms.includes(platform) && styles.budgetPresetActive,
                        { flex: 1 }
                      ]}
                      onPress={() => {
                        setAdSetForm(f => ({
                          ...f,
                          publisher_platforms: f.publisher_platforms.includes(platform)
                            ? f.publisher_platforms.filter(p => p !== platform)
                            : [...f.publisher_platforms, platform]
                        }))
                      }}
                    >
                      <Ionicons
                        name={platform === 'facebook' ? 'logo-facebook' : 'logo-instagram'}
                        size={16}
                        color={adSetForm.publisher_platforms.includes(platform) ? '#fff' : colors.text.secondary}
                      />
                      <Text style={[
                        styles.budgetPresetText,
                        adSetForm.publisher_platforms.includes(platform) && styles.budgetPresetTextActive,
                        { marginLeft: 6 }
                      ]}>
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Optimization Goal */}
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.inputLabel}>Optimization Goal</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {[
                    { value: 'LINK_CLICKS', label: 'Clicks' },
                    { value: 'IMPRESSIONS', label: 'Impressions' },
                    { value: 'REACH', label: 'Reach' },
                  ].map((goal) => (
                    <Pressable
                      key={goal.value}
                      style={[
                        styles.budgetPreset,
                        adSetForm.optimization_goal === goal.value && styles.budgetPresetActive,
                      ]}
                      onPress={() => setAdSetForm(f => ({ ...f, optimization_goal: goal.value }))}
                    >
                      <Text style={[
                        styles.budgetPresetText,
                        adSetForm.optimization_goal === goal.value && styles.budgetPresetTextActive,
                      ]}>
                        {goal.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Status */}
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable
                    style={[styles.budgetPreset, adSetForm.status === 'PAUSED' && styles.budgetPresetActive, { flex: 1 }]}
                    onPress={() => setAdSetForm(f => ({ ...f, status: 'PAUSED' }))}
                  >
                    <Ionicons name="pause" size={14} color={adSetForm.status === 'PAUSED' ? '#fff' : colors.text.secondary} />
                    <Text style={[styles.budgetPresetText, adSetForm.status === 'PAUSED' && styles.budgetPresetTextActive, { marginLeft: 4 }]}>Paused</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.budgetPreset, adSetForm.status === 'ACTIVE' && styles.budgetPresetActive, { flex: 1 }]}
                    onPress={() => setAdSetForm(f => ({ ...f, status: 'ACTIVE' }))}
                  >
                    <Ionicons name="play" size={14} color={adSetForm.status === 'ACTIVE' ? '#fff' : colors.text.secondary} />
                    <Text style={[styles.budgetPresetText, adSetForm.status === 'ACTIVE' && styles.budgetPresetTextActive, { marginLeft: 4 }]}>Active</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            {/* RIGHT PANEL - Live Reach (Meta-style) */}
            <View style={{ width: 280, borderLeftWidth: 1, borderLeftColor: colors.border.light, padding: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.tertiary }}>AUDIENCE SIZE</Text>
                {isLoadingReach && (
                  <Animated.View style={{ opacity: reachPulseAnim }}>
                    <ActivityIndicator size="small" color="#1877F2" />
                  </Animated.View>
                )}
              </View>

              {/* Animated Gauge Meter */}
              <Animated.View style={{ alignItems: 'center', paddingVertical: spacing.md, opacity: reachPulseAnim }}>
                {/* Semi-circular gauge */}
                <View style={{ width: 180, height: 100, marginBottom: spacing.sm, position: 'relative' }}>
                  {/* Background arc */}
                  <View style={{
                    position: 'absolute',
                    width: 180,
                    height: 90,
                    borderTopLeftRadius: 90,
                    borderTopRightRadius: 90,
                    borderWidth: 12,
                    borderBottomWidth: 0,
                    borderColor: colors.border.light,
                  }} />
                  {/* Colored progress arc - animated */}
                  <Animated.View style={{
                    position: 'absolute',
                    width: 180,
                    height: 90,
                    borderTopLeftRadius: 90,
                    borderTopRightRadius: 90,
                    borderWidth: 12,
                    borderBottomWidth: 0,
                    borderColor: reachGaugeAnim.interpolate({
                      inputRange: [0, 0.3, 0.6, 1],
                      outputRange: ['#EF4444', '#F59E0B', '#10B981', '#10B981'],
                    }),
                    transform: [{
                      rotate: reachGaugeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['-90deg', '0deg'],
                      }),
                    }],
                    transformOrigin: 'bottom center',
                    opacity: reachGaugeAnim.interpolate({
                      inputRange: [0, 0.01, 1],
                      outputRange: [0, 1, 1],
                    }),
                  }} />
                  {/* Center icon */}
                  <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    marginLeft: -24,
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: displayedReach.lower > 0
                      ? displayedReach.lower < 1000000 ? 'rgba(239,68,68,0.1)'
                        : displayedReach.lower < 10000000 ? 'rgba(245,158,11,0.1)'
                        : 'rgba(16,185,129,0.1)'
                      : 'rgba(24,119,242,0.1)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons
                      name="people"
                      size={22}
                      color={displayedReach.lower > 0
                        ? displayedReach.lower < 1000000 ? '#EF4444'
                          : displayedReach.lower < 10000000 ? '#F59E0B'
                          : '#10B981'
                        : '#1877F2'}
                    />
                  </View>
                </View>

                {/* Reach Numbers - Animated */}
                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 26,
                    fontWeight: '700',
                    color: colors.text.primary,
                    fontVariant: ['tabular-nums'],
                  }}>
                    {displayedReach.lower > 0
                      ? `${formatMetaNumber(displayedReach.lower)} - ${formatMetaNumber(displayedReach.upper)}`
                      : '—'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>
                    Potential Reach
                  </Text>
                </View>

                {/* Size indicator labels */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: spacing.sm, paddingHorizontal: spacing.xs }}>
                  <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: '500' }}>Narrow</Text>
                  <Text style={{ fontSize: 10, color: '#F59E0B', fontWeight: '500' }}>Specific</Text>
                  <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '500' }}>Broad</Text>
                </View>
              </Animated.View>

              {/* Daily Results Estimate */}
              {displayedReach.lower > 0 && (
                <View style={{
                  backgroundColor: 'rgba(24,119,242,0.05)',
                  borderRadius: 8,
                  padding: spacing.sm,
                  marginTop: spacing.sm,
                }}>
                  <Text style={{ fontSize: 11, color: colors.text.tertiary, marginBottom: 4 }}>Estimated daily results</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1877F2' }}>
                    {formatMetaNumber(Math.round(displayedReach.lower * 0.001))} - {formatMetaNumber(Math.round(displayedReach.upper * 0.003))} clicks
                  </Text>
                </View>
              )}

              {/* Targeting Summary */}
              <View style={{ marginTop: spacing.lg }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.tertiary, marginBottom: spacing.sm }}>TARGETING</Text>
                <View style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name="location" size={14} color={colors.text.tertiary} />
                    <Text style={{ color: colors.text.secondary, fontSize: 13 }}>{adSetForm.countries.join(', ')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name="people" size={14} color={colors.text.tertiary} />
                    <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
                      {adSetForm.genders.length === 0 ? 'All' : adSetForm.genders.includes(1) ? 'Men' : 'Women'}, {adSetForm.age_min}-{adSetForm.age_max}{adSetForm.age_max >= 65 ? '+' : ''}
                    </Text>
                  </View>
                  {adSetForm.interests.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Ionicons name="heart" size={14} color={colors.text.tertiary} />
                      <Text style={{ color: colors.text.secondary, fontSize: 13 }} numberOfLines={1}>
                        {adSetForm.interests.length} interest{adSetForm.interests.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name="apps" size={14} color={colors.text.tertiary} />
                    <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
                      {adSetForm.publisher_platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Ad Creation Modal */}
      <Modal
        visible={showAdModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAdModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowAdModal(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </Pressable>
            <Text style={styles.modalTitle}>Create Ad</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
            {/* Ad Name */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={styles.inputLabel}>Ad Name</Text>
              <TextInput
                style={styles.adInput}
                placeholder="e.g., Summer Sale - Image 1"
                placeholderTextColor={colors.text.placeholder}
                value={adForm.name}
                onChangeText={(text) => setAdForm(f => ({ ...f, name: text }))}
              />
            </View>

            {/* Primary Text */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={styles.inputLabel}>Primary Text</Text>
              <TextInput
                style={[styles.adInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="The main text that appears above your ad"
                placeholderTextColor={colors.text.placeholder}
                value={adForm.primaryText}
                onChangeText={(text) => setAdForm(f => ({ ...f, primaryText: text }))}
                multiline
              />
            </View>

            {/* Headline */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={styles.inputLabel}>Headline</Text>
              <TextInput
                style={styles.adInput}
                placeholder="Short, catchy headline"
                placeholderTextColor={colors.text.placeholder}
                value={adForm.headline}
                onChangeText={(text) => setAdForm(f => ({ ...f, headline: text }))}
              />
            </View>

            {/* Website URL */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={styles.inputLabel}>Website URL</Text>
              <TextInput
                style={styles.adInput}
                placeholder="https://example.com/landing-page"
                placeholderTextColor={colors.text.placeholder}
                value={adForm.websiteUrl}
                onChangeText={(text) => setAdForm(f => ({ ...f, websiteUrl: text }))}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            {/* Call to Action */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={styles.inputLabel}>Call to Action</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {[
                  { value: 'LEARN_MORE', label: 'Learn More' },
                  { value: 'SHOP_NOW', label: 'Shop Now' },
                  { value: 'SIGN_UP', label: 'Sign Up' },
                  { value: 'BOOK_TRAVEL', label: 'Book Now' },
                  { value: 'CONTACT_US', label: 'Contact Us' },
                  { value: 'GET_OFFER', label: 'Get Offer' },
                ].map((cta) => (
                  <Pressable
                    key={cta.value}
                    style={[
                      styles.budgetPreset,
                      adForm.callToAction === cta.value && styles.budgetPresetActive,
                    ]}
                    onPress={() => setAdForm(f => ({ ...f, callToAction: cta.value }))}
                  >
                    <Text style={[
                      styles.budgetPresetText,
                      adForm.callToAction === cta.value && styles.budgetPresetTextActive,
                    ]}>
                      {cta.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Status */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={styles.inputLabel}>Status</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Pressable
                  style={[
                    styles.budgetPreset,
                    adForm.status === 'PAUSED' && styles.budgetPresetActive,
                    { flex: 1 }
                  ]}
                  onPress={() => setAdForm(f => ({ ...f, status: 'PAUSED' }))}
                >
                  <Text style={[styles.budgetPresetText, adForm.status === 'PAUSED' && styles.budgetPresetTextActive]}>
                    Paused
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.budgetPreset,
                    adForm.status === 'ACTIVE' && styles.budgetPresetActive,
                    { flex: 1 }
                  ]}
                  onPress={() => setAdForm(f => ({ ...f, status: 'ACTIVE' }))}
                >
                  <Text style={[styles.budgetPresetText, adForm.status === 'ACTIVE' && styles.budgetPresetTextActive]}>
                    Active
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Note about images */}
            <View style={styles.adPreviewNote}>
              <Ionicons name="information-circle" size={16} color="#3B82F6" />
              <Text style={styles.adPreviewNoteText}>
                Image/video creative can be added in Meta Ads Manager after the ad is created
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border.regular }}>
            <Pressable
              style={[
                styles.metaConnectButton,
                (!adForm.name || !adForm.websiteUrl || isCreatingAd) && { opacity: 0.5 },
              ]}
              onPress={async () => {
                if (!adForm.name || !adForm.websiteUrl || !vendor?.id || !selectedMetaAdSet || isCreatingAd) return
                setIsCreatingAd(true)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                try {
                  const result = await createMetaAd(vendor.id, {
                    adSetId: selectedMetaAdSet,
                    name: adForm.name,
                    status: adForm.status,
                    creative: {
                      name: `Creative - ${adForm.name}`,
                      link_data: {
                        link: adForm.websiteUrl,
                        message: adForm.primaryText,
                        name: adForm.headline,
                        call_to_action: {
                          type: adForm.callToAction,
                        },
                      },
                    },
                  })
                  if (result) {
                    setShowAdModal(false)
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  }
                } catch (err: any) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  Alert.alert('Error', err?.message || 'Failed to create ad')
                } finally {
                  setIsCreatingAd(false)
                }
              }}
              disabled={!adForm.name || !adForm.websiteUrl || isCreatingAd}
            >
              {isCreatingAd ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.metaConnectButtonText}>Create Ad</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Meta Connect Modal */}
      <Modal
        visible={showMetaConnectModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMetaConnectModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowMetaConnectModal(false)}
        >
          <Pressable style={styles.metaModal} onPress={e => e.stopPropagation()}>
            <View style={styles.metaModalHeader}>
              <Ionicons name="logo-facebook" size={32} color="#1877F2" />
              <Text style={styles.metaModalTitle}>
                {isMetaConnected ? 'Update Meta Connection' : 'Connect Meta'}
              </Text>
              <Text style={styles.metaModalSubtitle}>
                {isMetaConnected
                  ? 'Update your access token or ad account settings'
                  : 'Manage Facebook & Instagram ads from your dashboard'}
              </Text>
            </View>

            <View style={styles.metaModalContent}>
              <Text style={styles.metaInputLabel}>Access Token</Text>
              <TextInput
                style={styles.metaInput}
                placeholder="Paste your access token"
                placeholderTextColor={colors.text.tertiary}
                value={metaAccessToken}
                onChangeText={setMetaAccessToken}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.metaInputLabel, { marginTop: spacing.md }]}>Ad Account ID (optional)</Text>
              <TextInput
                style={styles.metaInput}
                placeholder="act_123456789"
                placeholderTextColor={colors.text.tertiary}
                value={metaAdAccountId}
                onChangeText={setMetaAdAccountId}
              />

              <Text style={[styles.metaInputLabel, { marginTop: spacing.md }]}>Pixel ID (optional)</Text>
              <TextInput
                style={styles.metaInput}
                placeholder="123456789012345"
                placeholderTextColor={colors.text.tertiary}
                value={metaPixelId}
                onChangeText={setMetaPixelId}
              />

              <Text style={styles.metaHelpText}>
                {isMetaConnected
                  ? 'Enter a new access token to update your connection. Leave Ad Account ID unchanged to keep existing settings.'
                  : 'Get your access token from the Meta Business Suite or Graph API Explorer. The token needs ads_management and ads_read permissions.'}
              </Text>
            </View>

            <View style={styles.metaModalActions}>
              <Pressable
                style={styles.metaModalCancel}
                onPress={() => {
                  setShowMetaConnectModal(false)
                  setMetaAccessToken('')
                  setMetaAdAccountId('')
                  setMetaPixelId('')
                }}
              >
                <Text style={styles.metaModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.metaModalConnect, !metaAccessToken && { opacity: 0.5 }]}
                onPress={async () => {
                  if (!metaAccessToken || !vendor?.id) return
                  const success = await connectMeta(
                    vendor.id,
                    metaAccessToken,
                    metaAdAccountId || undefined,
                    metaPixelId || undefined
                  )
                  if (success) {
                    setShowMetaConnectModal(false)
                    setMetaAccessToken('')
                    setMetaAdAccountId('')
                    setMetaPixelId('')
                    // Sync campaigns after connecting/updating
                    syncMetaCampaigns(vendor.id)
                    Alert.alert(
                      'Success',
                      isMetaConnected ? 'Meta connection updated successfully!' : 'Meta connected successfully!',
                      [{ text: 'OK' }]
                    )
                  }
                }}
                disabled={!metaAccessToken || isMetaConnecting}
              >
                {isMetaConnecting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.metaModalConnectText}>
                    {isMetaConnected ? 'Update Connection' : 'Connect'}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
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

  // Expandable Segment Cards with Nested Campaigns
  expandableSegmentContainer: {
    marginBottom: spacing.xs,
  },
  segmentCardExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  segmentCardNeverEmailed: {
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  segmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  neverEmailedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  neverEmailedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  campaignCountBadge: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.quaternary,
  },
  expandedContent: {
    backgroundColor: colors.glass.thin,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  campaignHistoryList: {
    gap: spacing.xs,
  },
  campaignHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.glass.regular,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  campaignHistoryInfo: {
    flex: 1,
  },
  campaignHistoryName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
  },
  campaignHistoryDate: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  campaignHistoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  campaignHistoryOpenRate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  campaignStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  moreCampaignsText: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  noCampaignsMessage: {
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  noCampaignsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F59E0B',
  },
  noCampaignsSubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 280,
  },
  newCampaignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#6366F1',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  newCampaignButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  targetingTips: {
    marginTop: spacing.xs,
  },
  targetingTipsLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  targetingTipsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  targetingTipChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  targetingTipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#818CF8',
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
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
  emptyStateText: {
    fontSize: 14,
    color: colors.text.tertiary,
    textAlign: 'center',
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
  modalHeaderTitle: {
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

  // Shared Styles (used by Wallet and Affiliates)
  glassCard: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.regular,
    overflow: 'hidden',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.regular,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  // Wallet Pass Preview Styles
  passCardsContainer: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  passCard: {
    width: 280,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.background.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  passCardEmpty: {
    borderWidth: 2,
    borderColor: colors.border.primary,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  passCardContent: {
    width: '100%',
    height: 340,
    backgroundColor: '#000',
  },
  passCardEmptyContent: {
    flex: 1,
    height: 340,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  passCardEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  passCardEmptySubtext: {
    fontSize: 13,
    color: colors.text.quaternary,
  },
  passCardLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.background.tertiary,
  },
  passCardLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  passCardOrderNumber: {
    fontSize: 12,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
  passCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  // Mini Pass Preview Styles (matches actual Apple Wallet pass)
  miniPassContainer: {
    backgroundColor: 'rgb(18, 18, 18)',
    padding: spacing.md,
    paddingBottom: 0,
  },
  miniPassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  miniPassLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  miniPassLogoPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  miniPassLogoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  miniPassStoreName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  miniPassHeaderField: {
    alignItems: 'flex-end',
  },
  miniPassLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgb(156, 163, 175)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  miniPassValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  miniPassStatus: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  miniPassStatusValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: spacing.xs,
  },
  miniPassQR: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  miniPassQRText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#333',
    marginTop: spacing.xs,
  },
  walletPassPreview: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  actualPassContainer: {
    width: 360,
    height: 420,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  passWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  downloadPassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#007AFF',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  downloadPassButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  walletPassCard: {
    width: 320,
    backgroundColor: 'rgb(18, 18, 18)',
    borderRadius: 12,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  walletPassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  walletPassLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  walletPassLogoImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: spacing.sm,
  },
  walletPassLogoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  walletPassStoreName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  walletPassHeaderField: {
    alignItems: 'flex-end',
  },
  walletPassFieldLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  walletPassFieldValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  walletPassPrimary: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  walletPassPrimaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  walletPassPrimaryValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#34c759',
    letterSpacing: 2,
  },
  walletPassSecondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  walletPassSecondaryField: {
    flex: 1,
  },
  walletPassAuxiliary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  walletPassDescription: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    maxWidth: 320,
  },
  walletPassDescriptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  walletPassDescriptionText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },

  // Activity Row Styles
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.glass.regular,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityInfo: {
    flex: 1,
  },
  activityOrder: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  activityStatus: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
    color: colors.text.tertiary,
  },

  // Coming Soon Cards
  comingSoonCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  comingSoonCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  comingSoonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.glass.thin,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  comingSoonDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },

  // Channel Row Styles (for Channels tab)
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  channelDescription: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  channelStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  channelPercent: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  channelStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Meta (Facebook/Instagram) Styles
  metaConnectButton: {
    backgroundColor: '#1877F2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  metaConnectedButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  metaConnectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  metaSyncButton: {
    padding: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  metaEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  metaEditButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  metaDisconnectButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  metaDisconnectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  metaQuickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
    marginTop: spacing.sm,
  },
  metaStatItem: {
    alignItems: 'center',
  },
  metaStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  metaStatLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },

  // Meta Modal
  metaModal: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xl,
    width: '90%',
    maxWidth: 440,
    overflow: 'hidden',
  },
  metaModalHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  metaModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  metaModalSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  metaModalContent: {
    padding: spacing.lg,
  },
  metaInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  metaInput: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 44,
  },
  metaHelpText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  metaModalActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  metaModalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
  },
  metaModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  metaModalConnect: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: '#1877F2',
    alignItems: 'center',
  },
  metaModalConnectText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Meta Dashboard Tabs
  metaTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.lg,
  },
  metaTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    gap: 6,
  },
  metaTabActive: {
    backgroundColor: colors.background.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  metaTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  metaTabTextActive: {
    color: '#1877F2',
    fontWeight: '600',
  },

  // Meta Campaign Row
  metaStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaCampaignRow: {
    flexDirection: 'column',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  metaCampaignName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  metaCampaignObjective: {
    fontSize: 12,
    color: colors.text.tertiary,
    textTransform: 'capitalize',
  },
  metaCampaignStats: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  metaCampaignStat: {
    alignItems: 'center',
    minWidth: 60,
  },
  metaCampaignStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  metaCampaignStatLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  campaignActionButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  // Campaign Modal
  objectivePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  objectivePillActive: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderColor: '#10B981',
  },
  objectivePillText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  objectivePillTextActive: {
    color: '#10B981',
  },
  statusToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.glass.thick,
    padding: 2,
    justifyContent: 'center',
  },
  statusToggleActive: {
    backgroundColor: '#10B981',
  },
  statusToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text.secondary,
  },
  statusToggleKnobActive: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },

  // Ad Creator Styles
  adInput: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
  },
  adHelpText: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  objectiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  objectiveCard: {
    width: '48%',
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  objectiveCardActive: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: '#10B981',
  },
  objectiveIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.glass.thick,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  objectiveIconWrapActive: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  objectiveCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  objectiveCardLabelActive: {
    color: '#10B981',
  },
  objectiveCardDesc: {
    fontSize: 11,
    color: colors.text.tertiary,
    lineHeight: 14,
  },
  budgetRow: {
    marginBottom: spacing.md,
  },
  budgetInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.md,
  },
  budgetCurrency: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.tertiary,
    marginRight: spacing.xs,
  },
  budgetInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  budgetPeriod: {
    fontSize: 16,
    color: colors.text.tertiary,
  },
  budgetPresets: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  budgetPreset: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  budgetPresetActive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: '#10B981',
  },
  budgetPresetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  budgetPresetTextActive: {
    color: '#10B981',
  },
  budgetEstimate: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
  budgetEstimateValue: {
    fontWeight: '600',
    color: colors.text.secondary,
  },
  budgetEstimateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  budgetDisplayContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.md,
  },
  budgetDisplayAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text.primary,
  },
  budgetDisplayPeriod: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  budgetSliderContainer: {
    marginBottom: spacing.md,
  },
  budgetSlider: {
    width: '100%',
    height: 40,
  },
  budgetSliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  budgetSliderLabel: {
    fontSize: 12,
    color: colors.text.quaternary,
  },
  launchOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  launchRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border.emphasis,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  launchRadioActive: {
    borderColor: '#10B981',
  },
  launchRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  launchOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  launchOptionDesc: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  adCreatorActions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  adCreatorCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
  },
  adCreatorCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  adCreatorSubmit: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  adCreatorSubmitDisabled: {
    opacity: 0.5,
  },
  adCreatorSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  adCreatorDraft: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  adCreatorDraftDisabled: {
    opacity: 0.5,
  },
  adCreatorDraftText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  adPreviewHeader: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  adPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  adPreviewContent: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adPreviewCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.lg,
  },
  adPreviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  adPreviewStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  adPreviewCardName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  adPreviewMeta: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  adPreviewMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  adPreviewMetaText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  adPreviewNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: radius.md,
  },
  adPreviewNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
  },
  adPreviewEmpty: {
    alignItems: 'center',
    gap: spacing.md,
  },
  adPreviewEmptyText: {
    fontSize: 14,
    color: colors.text.quaternary,
  },

  // Meta Posts Filter
  metaFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.glass.regular,
    gap: 6,
  },
  metaFilterButtonActive: {
    backgroundColor: '#1877F2',
  },
  metaFilterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  metaFilterButtonTextActive: {
    color: '#fff',
  },

  // Meta Posts Grid
  metaPostsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaPostCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2) / 3,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  metaPostImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.glass.regular,
  },
  metaPostPlatformBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaPostContent: {
    padding: spacing.sm,
  },
  metaPostMessage: {
    fontSize: 12,
    color: colors.text.primary,
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  metaPostStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  metaPostStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaPostStatText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  metaPostDate: {
    fontSize: 10,
    color: colors.text.quaternary,
  },

  // Instagram-style Grid
  igGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  igPostCell: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - 4) / 3,
    aspectRatio: 1,
    position: 'relative',
  },
  igPostImage: {
    width: '100%',
    height: '100%',
  },
  igPostPlaceholder: {
    backgroundColor: colors.glass.heavy,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  igPostPlaceholderText: {
    fontSize: 10,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  igTypeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 4,
  },
  igPlatformBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igStatsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  igStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  igStatText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Insights styles
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  insightCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 3) / 4,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  insightValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  insightLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Insights Header
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  insightsDatePills: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  insightsDatePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    backgroundColor: colors.glass.thin,
  },
  insightsDatePillActive: {
    backgroundColor: colors.text.primary,
  },
  insightsDatePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  insightsDatePillTextActive: {
    color: colors.background.primary,
  },
  insightsRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.round,
    backgroundColor: colors.glass.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsLoading: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsLoadingText: {
    color: colors.text.tertiary,
    marginTop: spacing.md,
    fontSize: 14,
  },
  // Platform Cards
  platformCardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  platformCard: {
    flex: 1,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  platformCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  platformIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  platformStats: {
    padding: spacing.sm,
  },
  platformStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  platformStatLabel: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  platformStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  // Ads Section
  adsSection: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  adsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  adsSectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  roasBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.round,
  },
  roasBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  adsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  adsGridItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  adsGridValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  adsGridLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  // Campaigns Section
  campaignsSection: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  campaignsSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  campaignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  campaignRowInfo: {
    flex: 1,
  },
  campaignRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  campaignRowStats: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  campaignRowRoas: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  campaignRowRoasText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Empty State
  insightsEmpty: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
  insightsEmptyText: {
    fontSize: 13,
    color: colors.text.quaternary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Legacy styles kept for compatibility
  roasPositive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  roasNegative: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: 4,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarFill: {
    width: '80%',
    backgroundColor: '#1877F2',
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    color: colors.text.quaternary,
    marginTop: 4,
  },
  chartLegend: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.sm,
  },
})
