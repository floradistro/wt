/**
 * POSRegisterSelector - Grid Layout
 * Beautiful centered grid showing all registers
 */

import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { getThumbnailImage } from '@/utils/image-transforms'

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
  currentTime,
}: {
  register: Register
  index: number
  onPress: () => void
  currentTime: Date
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

  const formatDuration = useCallback((startedAt: string) => {
    const start = new Date(startedAt)
    const diff = currentTime.getTime() - start.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    return `${hours}h ${minutes}m ${seconds}s`
  }, [currentTime])

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
  const [currentTime, setCurrentTime] = useState(new Date())
  const fadeAnim = useRef(new Animated.Value(0)).current

  // Single timer for all register cards - updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
  }, [])

  useEffect(() => {
    /**
     * APPLE RETAIL ARCHITECTURE: Reliable 3-second polling
     *
     * Why polling over Realtime:
     * - Retail WiFi is unreliable - Realtime drops silently
     * - Polling guarantees updates every 3 seconds
     * - Battery efficient with controlled intervals
     * - Debuggable and predictable
     *
     * Same approach used by:
     * - Apple Retail (Square Register)
     * - Shopify POS
     * - Toast POS
     */
    loadRegisters()

    const pollInterval = setInterval(() => {
      loadRegisters()
    }, 3000) // 3 seconds - Apple's sweet spot for "live" feel

    return () => {
      clearInterval(pollInterval)
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
          user_id,
          users!user_id (
            first_name,
            last_name
          )
        `)
        .in('register_id', registerIds)  // ✅ Only THIS location's registers
        .eq('status', 'open')
        .gte('opened_at', twentyFourHoursAgo.toISOString())  // ✅ No stale sessions

      if (sessionsError) {
        logger.error('[POSRegisterSelector] Error loading sessions:', sessionsError)
      }

      // Helper function to extract user data (handles both object and array returns from Supabase)
      const extractUserData = (users: any): { first_name: string; last_name: string } | null => {
        if (!users) return null
        // If it's an array, take the first element
        if (Array.isArray(users)) {
          return users.length > 0 ? users[0] : null
        }
        // If it's an object with first_name and last_name properties (check existence, not truthiness)
        if ('first_name' in users && 'last_name' in users) {
          return users
        }
        return null
      }

      // Fallback: If user join failed, fetch users manually
      if (sessionsData && sessionsData.length > 0) {
        const needsUserFetch = sessionsData.some(session => !extractUserData(session.users))

        if (needsUserFetch) {
          const userIds = [...new Set(sessionsData.map(s => s.user_id).filter(Boolean))]

          if (userIds.length > 0) {
            const { data: usersData } = await supabase
              .from('users')
              .select('id, first_name, last_name')
              .in('id', userIds)

            if (usersData) {
              sessionsData.forEach(session => {
                if (!session.users || !extractUserData(session.users)) {
                  const user = usersData.find(u => u.id === session.user_id)
                  if (user) {
                    // @ts-expect-error - Supabase join can return array or object, we handle both in extractUserData
                    session.users = user
                  }
                }
              })
            }
          }
        }
      }

      const registersWithSessions = registersData.map(register => {
        const session = (sessionsData || []).find(s => s.register_id === register.id)

        if (session) {
          const user = extractUserData(session.users)
          // Handle cases where last_name might be empty or just spaces
          const userName = user
            ? `${user.first_name} ${user.last_name || ''}`.trim() || user.first_name || 'Unknown User'
            : 'Unknown User'

          return {
            ...register,
            active_session: {
              id: session.id,
              session_number: session.session_number,
              total_sales: session.total_sales || 0,
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
                source={{ uri: getThumbnailImage(vendorLogo) || vendorLogo }}
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
                currentTime={currentTime}
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
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cardActive: {
    backgroundColor: 'rgba(16,185,129,0.08)', // Slightly green tint for active - borderless
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
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
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
    backgroundColor: 'rgba(16,185,129,0.15)', // Match product list - borderless
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
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
  },
  availableLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
  },
})
