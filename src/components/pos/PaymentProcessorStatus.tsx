import {  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native'
import * as Haptics from 'expo-haptics'
import {  usePaymentProcessor, type ActivityLog } from '@/stores/payment-processor.store'
import { memo,  useEffect, useRef, useState } from 'react'

interface PaymentProcessorStatusProps {
  compact?: boolean
}

// JOBS PRINCIPLE: Mission-critical status indicator - always visible, crystal clear
function PaymentProcessorStatus({ compact = false }: PaymentProcessorStatusProps) {
  const {
    status,
    lastCheck,
    errorMessage,
    checkStatus,
    isEnabled,
    currentProcessor,
    activityLog,
    sendTestTransaction
  } = usePaymentProcessor()

  // Heartbeat animation for connected status
  const pulseAnim = useRef(new Animated.Value(1)).current
  // Force re-render every 5 seconds to update "Xs ago" timestamps
  const [, setTick] = useState(0)
  // Animated values for each activity log item (streaming effect)
  const [activityAnims, setActivityAnims] = useState<Map<string, Animated.Value>>(new Map())
  // Test transaction in progress
  const [testingTerminal, setTestingTerminal] = useState(false)

  useEffect(() => {
    if (status === 'connected') {
      // Pulse animation - subtle heartbeat
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      )
      pulse.start()
      return () => pulse.stop()
    } else {
      pulseAnim.setValue(1)
    }
  }, [status])

  // JOBS: Animate new activity log entries streaming in
  useEffect(() => {
    const newAnims = new Map(activityAnims)
    activityLog.slice(0, 5).forEach((activity, index) => {
      const key = `${activity.timestamp}-${index}`
      if (!newAnims.has(key)) {
        const anim = new Animated.Value(0)
        newAnims.set(key, anim)
        // Stagger animations for smooth streaming effect
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          delay: index * 50,
          useNativeDriver: true,
        }).start()
      }
    })
    setActivityAnims(newAnims)
  }, [activityLog])

  // JOBS: Update activity timestamps every 5 seconds for live feel
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return {
          bg: 'rgba(255,255,255,0.03)',
          border: 'rgba(255,255,255,0.1)',
          text: 'rgba(255,255,255,0.7)',
          dot: 'rgba(34,197,94,1)',
        }
      case 'disconnected':
        return {
          bg: 'rgba(255,255,255,0.02)',
          border: 'rgba(255,255,255,0.08)',
          text: 'rgba(255,255,255,0.5)',
          dot: 'rgba(107,114,128,1)',
        }
      case 'error':
        return {
          bg: 'rgba(239,68,68,0.08)',
          border: 'rgba(239,68,68,0.3)',
          text: 'rgba(239,68,68,0.95)',
          dot: 'rgba(239,68,68,1)',
        }
      case 'checking':
        return {
          bg: 'rgba(255,255,255,0.03)',
          border: 'rgba(255,255,255,0.1)',
          text: 'rgba(255,255,255,0.6)',
          dot: 'rgba(59,130,246,1)',
        }
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        // JOBS: Show processor name if available, otherwise generic
        if (currentProcessor?.processor_name) {
          return currentProcessor.processor_name.toUpperCase()
        }
        return 'TERMINAL ONLINE'
      case 'disconnected':
        return isEnabled ? 'PROCESSOR OFFLINE' : 'PROCESSOR DISABLED'
      case 'error':
        if (currentProcessor?.processor_name) {
          return `${currentProcessor.processor_name.toUpperCase()} ERROR`
        }
        return 'PROCESSOR ERROR'
      case 'checking':
        return 'CHECKING STATUS...'
    }
  }

  // JOBS: Format activity timestamps as "Xs ago"
  const formatActivityTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  // JOBS: Activity type icon
  const getActivityIcon = (type: ActivityLog['type'], isLive?: boolean) => {
    switch (type) {
      case 'health_check':
        return isLive ? '●' : '○'
      case 'success':
        return '✓'
      case 'error':
        return '✕'
      default:
        return '·'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return '●'
      case 'disconnected':
        return '○'
      case 'error':
        return '✕'
      case 'checking':
        return null // Will show spinner
    }
  }

  const colors = getStatusColor()

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    checkStatus()
  }

  // JOBS PRINCIPLE: Test terminal to verify it can process transactions
  const handleTestTerminal = async () => {
    if (testingTerminal || !currentProcessor) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setTestingTerminal(true)

    try {
      const result = await sendTestTransaction()

      // Provide haptic feedback based on result
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } finally {
      setTestingTerminal(false)
    }
  }

  const lastCheckText = lastCheck
    ? `${Math.floor((Date.now() - lastCheck) / 1000)}s ago`
    : 'Never'

  if (compact) {
    return (
      <TouchableOpacity
        onPress={handleRefresh}
        activeOpacity={0.7}
        style={[styles.compactContainer, { borderColor: colors.border, backgroundColor: colors.bg }]}
      >
        <View style={styles.compactContent}>
          {status === 'checking' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={[styles.compactIcon, { color: colors.dot }]}>{getStatusIcon()}</Text>
          )}
          <Text style={[styles.compactText, { color: colors.text }]}>{getStatusText()}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      onPress={handleRefresh}
      activeOpacity={0.7}
      style={[styles.container, { borderColor: colors.border, backgroundColor: colors.bg }]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            {status === 'checking' ? (
              <ActivityIndicator size="small" color={colors.text} style={styles.spinner} />
            ) : (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={[styles.statusDot, { backgroundColor: colors.dot }]} />
              </Animated.View>
            )}
            <Text style={[styles.statusText, { color: colors.text }]}>{getStatusText()}</Text>
          </View>
          <View style={styles.headerActions}>
            {/* JOBS PRINCIPLE: Subtle test button - only show when processor is online */}
            {status === 'connected' && currentProcessor && (
              <TouchableOpacity
                onPress={handleTestTerminal}
                disabled={testingTerminal}
                style={styles.testButton}
              >
                {testingTerminal ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                ) : (
                  <Text style={styles.testButtonText}>Test</Text>
                )}
              </TouchableOpacity>
            )}
            <Text style={styles.lastCheckText}>{lastCheckText}</Text>
          </View>
        </View>

        {errorMessage && status === 'error' && (
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        )}

        {!isEnabled && (
          <Text style={styles.infoMessage}>
            Configure payment processor in settings to enable card payments
          </Text>
        )}

        {/* JOBS PRINCIPLE: Subtle live activity stream - shows user it's not stale data */}
        {isEnabled && activityLog.length > 0 && (
          <View style={styles.activityFeed}>
            {activityLog.slice(0, 5).map((activity, index) => {
              const key = `${activity.timestamp}-${index}`
              const animValue = activityAnims.get(key) || new Animated.Value(1)

              // JOBS: Color logic - green for success OR successful health_check (is_live=true)
              const getActivityColor = () => {
                if (activity.type === 'success') return 'rgba(34,197,94,0.8)'
                if (activity.type === 'error') return 'rgba(239,68,68,0.8)'
                if (activity.type === 'health_check' && activity.is_live) return 'rgba(34,197,94,0.8)'
                return 'rgba(255,255,255,0.5)'
              }

              return (
                <Animated.View
                  key={key}
                  style={[
                    styles.activityItem,
                    {
                      opacity: animValue,
                      transform: [
                        {
                          translateY: animValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-10, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.activityIcon,
                      { color: getActivityColor() },
                    ]}
                  >
                    {getActivityIcon(activity.type, activity.is_live)}
                  </Text>
                  <Text style={styles.activityMessage} numberOfLines={1}>
                    {activity.message}
                  </Text>
                  <View style={styles.activityMetadata}>
                    {activity.duration_ms && (
                      <Text style={styles.activityDuration}>{activity.duration_ms}ms</Text>
                    )}
                    <Text style={styles.activityTime}>{formatActivityTime(activity.timestamp)}</Text>
                  </View>
                </Animated.View>
              )
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const PaymentProcessorStatusMemo = memo(PaymentProcessorStatus)
export { PaymentProcessorStatusMemo as PaymentProcessorStatus }

const styles = StyleSheet.create({
  // Full Status
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 60,
  },
  content: {
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  spinner: {
    width: 10,
    height: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  lastCheckText: {
    fontSize: 10,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
  },
  // JOBS PRINCIPLE: Subtle test button
  testButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 44, // Minimum touch target
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  errorMessage: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.3,
  },
  infoMessage: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
    fontStyle: 'italic',
  },

  // JOBS PRINCIPLE: Subtle activity feed - minimal, informative
  activityFeed: {
    marginTop: 12,
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityIcon: {
    fontSize: 8,
    fontWeight: '600',
    width: 12,
  },
  activityMessage: {
    flex: 1,
    fontSize: 10,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.2,
  },
  activityMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityDuration: {
    fontSize: 9,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0,
  },
  activityTime: {
    fontSize: 9,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0,
  },

  // Compact Status
  compactContainer: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactIcon: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
})
