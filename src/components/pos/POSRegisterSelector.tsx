import {  View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Image, ScrollView } from 'react-native'
import {  SafeAreaView } from 'react-native-safe-area-context'
import {  BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { memo,  useRef, useEffect, useState } from 'react'
import {  supabase } from '@/lib/supabase/client'

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

function RegisterCard({ register, index, onPress }: { register: Register; index: number; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current
  const scaleAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 10,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start()
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
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.registerCard}
    >
      <Animated.View
        style={[
          styles.registerCardInner,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.registerCardBg} pointerEvents="none">
          <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.registerCardContent}>
          {/* Top Row: Register Info + Status */}
          <View style={styles.topRow}>
            <View style={styles.registerInfo}>
              <Text style={styles.registerName}>{register.register_name}</Text>
              <Text style={styles.registerNumber}>{register.register_number}</Text>
            </View>
            {hasActiveSession ? (
              <View style={styles.statusActive}>
                <View style={styles.activeDot} />
                <Text style={styles.statusText}>ACTIVE</Text>
              </View>
            ) : (
              <View style={styles.statusAvailable}>
                <Text style={styles.statusText}>OPEN</Text>
              </View>
            )}
          </View>

          {/* Session Details or Call to Action */}
          {hasActiveSession ? (
            <View style={styles.sessionDetails}>
              <View style={styles.sessionRow}>
                <View style={styles.sessionItem}>
                  <Text style={styles.sessionLabel}>STAFF</Text>
                  <Text style={styles.sessionValue}>{activeSession!.user_name}</Text>
                </View>
                <View style={styles.sessionItem}>
                  <Text style={styles.sessionLabel}>SALES</Text>
                  <Text style={styles.sessionValue}>${activeSession!.total_sales.toFixed(2)}</Text>
                </View>
                <View style={styles.sessionItem}>
                  <Text style={styles.sessionLabel}>TIME</Text>
                  <Text style={styles.sessionValue}>{formatDuration(activeSession!.opened_at)}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptySession}>
              <Text style={styles.emptySessionText}>Ready to start</Text>
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
  const headerFade = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
  }, [])

  useEffect(() => {
    loadRegisters()

    // Poll for register updates every 3 seconds
    const interval = setInterval(loadRegisters, 3000)
    return () => clearInterval(interval)
  }, [locationId])

  const loadRegisters = async () => {
    try {
      // Get all registers for this location
      const { data: registersData, error: registersError } = await supabase
        .from('pos_registers')
        .select('id, register_number, register_name, device_name, status')
        .eq('location_id', locationId)
        .eq('status', 'active')
        .order('register_number')

      if (registersError) {
        console.error('Error loading registers:', registersError)
        throw registersError
      }

      // Get active sessions for these registers
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
        .eq('status', 'open')
        .in('register_id', (registersData || []).map(r => r.id))

      if (sessionsError) {
        console.error('Error loading sessions:', sessionsError)
      }

      // Combine registers with their active sessions
      const registersWithSessions = (registersData || []).map(register => {
        const session = sessionsData?.find(s => s.register_id === register.id)

        if (session) {
          const user = session.users as any
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
      console.error('Error loading registers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterPress = (register: Register) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onRegisterSelected(register.id)
  }

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onBackToLocationSelector?.()
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading registers...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {onBackToLocationSelector && (
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Text style={styles.backButtonText}>CHANGE LOCATION</Text>
          </TouchableOpacity>
        )}

        <Animated.View style={[styles.header, { opacity: headerFade }]}>
          {vendorLogo && (
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Image source={{ uri: vendorLogo }} style={styles.logo} resizeMode="contain" />
              </View>
            </View>
          )}
          <Text style={styles.title}>SELECT REGISTER</Text>
          <Text style={styles.subtitle}>{locationName}</Text>
        </Animated.View>

        {registers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No registers found</Text>
            <Text style={styles.emptySubtext}>Contact your administrator</Text>
          </View>
        ) : (
          <View style={styles.registersGrid}>
            {registers.map((register, index) => (
              <RegisterCard
                key={register.id}
                register={register}
                index={index}
                onPress={() => handleRegisterPress(register)}
              />
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Select any register to begin</Text>
          <Text style={styles.footerSubtext}>You can switch registers anytime</Text>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: isTablet ? 60 : 24,
    paddingVertical: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
  },
  backButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  backButtonText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 4,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
  },
  emptySubtext: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1,
  },
  registersGrid: {
    gap: 16,
  },
  registerCard: {
    marginBottom: 12,
  },
  registerCardInner: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  registerCardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  registerCardContent: {
    padding: 16,
  },

  // Top row with register name and status
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  registerInfo: {
    flex: 1,
  },
  registerName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  registerNumber: {
    fontSize: 9,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Status badges
  statusActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  statusAvailable: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: 1.5,
  },

  // Session details
  sessionDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  sessionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  sessionItem: {
    flex: 1,
  },
  sessionLabel: {
    fontSize: 8,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sessionValue: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.2,
  },

  // Empty state
  emptySession: {
    paddingTop: 8,
    paddingBottom: 2,
  },
  emptySessionText: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  footerSubtext: {
    fontSize: 9,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 1.5,
  },
})
