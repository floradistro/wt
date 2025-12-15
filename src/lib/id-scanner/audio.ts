/**
 * Audio feedback module
 *
 * Crisp, native-feeling audio + haptic feedback for POS actions
 * - Single beep: ID scan, barcode scan (1800Hz, 40ms)
 * - Double beep: Sale completion (pre-baked for perfect timing)
 */

import { Audio } from 'expo-av'
import * as Haptics from 'expo-haptics'
import { logger } from '@/utils/logger'

// Pre-loaded sound instances for instant playback
let beepSound: Audio.Sound | null = null
let doubleBeepSound: Audio.Sound | null = null
let isInitialized = false
let isInitializing = false

/**
 * Initialize the audio system
 * Pre-loads both sounds for instant playback
 */
export async function initAudio(): Promise<void> {
  if (isInitialized || isInitializing) return
  isInitializing = true

  try {
    // Configure audio mode for immediate playback
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    })

    // Pre-load both sounds in parallel
    const [singleResult, doubleResult] = await Promise.all([
      Audio.Sound.createAsync(
        require('../../../assets/sounds/beep.wav'),
        { shouldPlay: false, volume: 0.7 }
      ),
      Audio.Sound.createAsync(
        require('../../../assets/sounds/double-beep.wav'),
        { shouldPlay: false, volume: 0.7 }
      ),
    ])

    beepSound = singleResult.sound
    doubleBeepSound = doubleResult.sound
    isInitialized = true
  } catch (error) {
    logger.warn('Failed to initialize audio:', error)
  } finally {
    isInitializing = false
  }
}

/**
 * Play a single beep
 * Used for: ID scan success, barcode scan
 */
export async function playSuccessBeep(): Promise<void> {
  // Haptic feedback always
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})

  // Initialize if needed
  if (!isInitialized && !isInitializing) {
    await initAudio()
  }

  try {
    if (beepSound) {
      await beepSound.setPositionAsync(0)
      await beepSound.playAsync()
    }
  } catch (error) {
    // Silent fail - don't block on audio errors
  }
}

/**
 * Play rejection tone
 * Used for: ID scan failure, invalid barcode
 */
export async function playRejectionTone(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  } catch (_error) {
    // Silent fail
  }
}

/**
 * Play double beep for sale completion
 * Uses pre-baked audio file for perfect snappy timing
 */
export async function playSaleCompletionSound(): Promise<void> {
  // Strong haptic feedback
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})

  // Initialize if needed
  if (!isInitialized && !isInitializing) {
    await initAudio()
  }

  try {
    if (doubleBeepSound) {
      await doubleBeepSound.setPositionAsync(0)
      await doubleBeepSound.playAsync()
    }
  } catch (error) {
    // Silent fail - don't block checkout
  }
}

/**
 * Cleanup audio when app closes
 */
export async function unloadAudio(): Promise<void> {
  try {
    if (beepSound) await beepSound.unloadAsync()
    if (doubleBeepSound) await doubleBeepSound.unloadAsync()
  } catch (e) {
    // Ignore
  }
  beepSound = null
  doubleBeepSound = null
  isInitialized = false
}
