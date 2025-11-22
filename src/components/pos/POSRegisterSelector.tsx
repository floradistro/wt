/**
 * POSRegisterSelector - Grid Layout
 * Beautiful centered grid showing all registers
 */

import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

const { width } = Dimensions.get('window')
const isTablet = width > 600

interface ActiveSession {
  id: string
  session_number: string
  total_sales: number
  opened_at: string
  user_name: string
}

interface Register {
  id: string
  register_number: string
  register_name: string
  device_name: string
  status: string
  active_session?: ActiveSession
}

interface POSRegisterSelectorProps {
  locationId: string
  locationName: string
  vendorLogo?: string | null
  onRegisterSelected: (registerId: string, sessionId?: string) => void
  onBackToLocationSelector?: () => void
}

function RegisterCard({
  register,
  index,
  onPress,
}: {
  register: Register
  index: number
  onPress: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      delay: Math.min(index * 20, 100), // Max 100ms delay, faster animation
      useNativeDriver: true,
    }).start()
  }, [])

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }

  const formatDuration = (startedAt: string) => {
    const start = new Date(startedAt)
    const now = new Date()
    const diff = now.getTime() - start.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const hasActiveSession = !!register.active_session
  const activeSession = register.active_session

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.cardContainer}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${register.register_name}, ${register.register_number}`}
      accessibilityHint={
        hasActiveSession
          ? `Active session. Staff: ${activeSession!.user_name}. Sales: ${activeSession!.total_sales.toFixed(2)} dollars. Duration: ${formatDuration(activeSession!.opened_at)}. Double tap to resume this session.`
          : `Register available. Double tap to start a new session.`
      }
    >
      <Animated.View
        style={[
          styles.card,
          hasActiveSession && styles.cardActive,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.cardContent}>
          {/* Register Number Badge */}
          <View style={styles.registerBadge}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.registerNumber}>{register.register_number}</Text>
          </View>

          {/* Register Name */}
          <Text style={styles.registerName} numberOfLines={1}>
            {register.register_name}
          </Text>

          {/* Status */}
          {hasActiveSession ? (
            <View style={styles.activeInfo}>
              <View style={styles.activeBadge}>
                <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.activeDot} />
                <Text style={styles.activeLabel}>ACTIVE</Text>
              </View>
              <Text style={styles.staffName} numberOfLines={1}>
                {activeSession!.user_name}
              </Text>
              <View style={styles.sessionStats}>
                <Text style={styles.statValue}>${activeSession!.total_sales.toFixed(2)}</Text>
                <Text style={styles.statDivider}>•</Text>
                <Text style={styles.statValue}>{formatDuration(activeSession!.opened_at)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.availableInfo}>
              <View style={styles.availableBadge}>
                <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                <Text style={styles.availableLabel}>AVAILABLE</Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  )
}

function POSRegisterSelector({
  locationId,
  locationName,
  vendorLogo,
  onRegisterSelected,
  onBackToLocationSelector,
}: POSRegisterSelectorProps) {
  const [registers, setRegisters] = useState<Register[]>([])
  const [loading, setLoading] = useState(true)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
  }, [])

  useEffect(() => {
    logger.debug('[POSRegisterSelector] 🔌 Setting up Realtime subscription for location:', locationId)
    loadRegisters()

    // Apple Standard: Realtime subscription instead of polling
    const channel = supabase
      .channel(`registers-location-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pos_sessions',
        },
        (payload) => {
          logger.debug('[POSRegisterSelector] 🔄 Realtime event received:', {
            eventType: payload.eventType,
            table: payload.table,
            schema: payload.schema,
            new: payload.new,
            old: payload.old,
          })
          logger.debug('[POSRegisterSelector] 🔁 Reloading registers due to session change...')
          loadRegisters()
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[POSRegisterSelector] ✅ Realtime subscribed successfully')
        } else if (status === 'CLOSED') {
          logger.debug('[POSRegisterSelector] ⏹️ Realtime subscription closed')
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('[POSRegisterSelector] ❌ Realtime subscription error:', err)
        } else {
          logger.debug('[POSRegisterSelector] 📡 Realtime subscription status:', status)
        }
      })

    return () => {
      logger.debug('[POSRegisterSelector] 🔌 Cleaning up Realtime subscription')
      supabase.removeChannel(channel)
    }
  }, [locationId])

  const loadRegisters = async () => {
    if (!locationId) return

    const startTime = Date.now()

    try {
      // Fetch registers
      const { data: registersData, error: registersError } = await supabase
        .from('pos_registers')
        .select('id, register_number, register_name, device_name, status')
        .eq('location_id', locationId)
        .eq('status', 'active')
        .order('register_number')

      if (registersError) {
        logger.error('[POSRegisterSelector] ❌ Error loading registers:', registersError)
        throw registersError
      }

      if (!registersData || registersData.length === 0) {
        setRegisters([])
        setLoading(false)
        return
      }

      // CRITICAL FIX: Filter sessions at DB level + add 24-hour cutoff
      const registerIds = registersData.map(r => r.id)
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('pos_sessions')
        .select(`
          id,
          register_id,
          session_number,
          total_sales,
          opened_at,
          users!pos_sessions_user_id_fkey (
            first_name,
            last_name
          )
        `)
        .in('register_id', registerIds)  // ✅ Only THIS location's registers
        .eq('status', 'open')
        .gte('opened_at', twentyFourHoursAgo.toISOString())  // ✅ No stale sessions

      if (sessionsError) {
        logger.error('[POSRegisterSelector] ⚠️ Error loading sessions:', sessionsError)
      }

      logger.debug(`[POSRegisterSelector] ✅ Loaded ${registersData.length} registers, ${sessionsData?.length || 0} active sessions in ${Date.now() - startTime}ms`)

      // Detailed session logging
      if (sessionsData && sessionsData.length > 0) {
        sessionsData.forEach(session => {
          const users = session.users as Array<{ first_name: string; last_name: string }> | null
          const user = users && users.length > 0 ? users[0] : null
          const userName = user ? `${user.first_name} ${user.last_name}`.trim() : 'Unknown User'
          logger.debug(`[POSRegisterSelector] 📊 Active session on register ${session.register_id}:`, {
            sessionId: session.id,
            sessionNumber: session.session_number,
            userName,
            openedAt: session.opened_at,
          })
        })
      } else {
        logger.debug('[POSRegisterSelector] 📊 No active sessions found for this location')
      }

      const registersWithSessions = registersData.map(register => {
        const session = (sessionsData || []).find(s => s.register_id === register.id)

        if (session) {
          const users = session.users as Array<{ first_name: string; last_name: string }> | null
          const user = users && users.length > 0 ? users[0] : null
          const userName = user ? `${user.first_name} ${user.last_name}`.trim() : 'Unknown User'

          return {
            ...register,
            active_session: {
              id: session.id,
              session_number: session.session_number,
              total_sales: session.total_sales,
              opened_at: session.opened_at,
              user_name: userName,
            }
          }
        }

        return register
      })

      setRegisters(registersWithSessions)
    } catch (error) {
      logger.error('Error loading registers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onBackToLocationSelector?.()
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading registers...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (registers.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No registers found</Text>
          <Text style={styles.emptySubtext}>Contact your administrator</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Back button */}
        {onBackToLocationSelector && (
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Change location"
          >
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

        {/* Header with Logo */}
        <View style={styles.header}>
          {vendorLogo && (
            <View style={styles.headerLogoContainer}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              <Image
                source={{ uri: vendorLogo }}
                style={styles.headerLogo}
                resizeMode="contain"
                fadeDuration={0}
              />
            </View>
          )}
          <Text style={styles.headerTitle}>Select Register</Text>
          <Text style={styles.headerSubtitle}>{locationName}</Text>
        </View>

        {/* Grid */}
        <View style={styles.gridContainer}>
          <View style={styles.grid}>
            {registers.map((register, index) => (
              <RegisterCard
                key={register.id}
                register={register}
                index={index}
                onPress={() => onRegisterSelected(register.id)}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

const POSRegisterSelectorMemo = memo(POSRegisterSelector)
export { POSRegisterSelectorMemo as POSRegisterSelector }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingVertical: isTablet ? 20 : 10,
  },
  // Header
  header: {
    alignItems: 'center',
    marginBottom: isTablet ? 32 : 24,
    paddingTop: isTablet ? 60 : 50,
  },
  headerLogoContainer: {
    width: 80,
    height: 80,
    borderRadius: isTablet ? 20 : 16,
    marginBottom: isTablet ? 16 : 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: 80,
    height: 80,
  },
  headerTitle: {
    fontSize: isTablet ? 28 : 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: isTablet ? 14 : 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: -0.1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  // Back button
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 10,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: -0.2,
  },
  // Grid
  gridContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: isTablet ? 80 : 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: isTablet ? 24 : 20,
    maxWidth: isTablet ? 1000 : width - 40,
  },
  cardContainer: {
    width: isTablet ? 300 : (width - 60) / 2,
    height: isTablet ? 220 : 200,
  },
  card: {
    flex: 1,
    borderRadius: isTablet ? 32 : 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cardActive: {
    borderColor: 'rgba(16,185,129,0.4)',
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: isTablet ? 24 : 20,
  },
  // Register badge
  registerBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  registerNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
  },
  // Register name
  registerName: {
    fontSize: isTablet ? 22 : 18,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  // Active session
  activeInfo: {
    alignItems: 'center',
    gap: 10,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  activeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 0.6,
  },
  staffName: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.1,
  },
  statDivider: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  // Available
  availableInfo: {
    alignItems: 'center',
  },
  availableBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  availableLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
  },
})
