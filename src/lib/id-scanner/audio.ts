import { Audio } from 'expo-av'

/**
 * Jobs Principle: Success beep (system sound)
 * Audible confirmation
 */
export async function playSuccessBeep() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    })

    // Single beep for ID capture
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
      { shouldPlay: true, volume: 0.8 }
    )

    setTimeout(() => sound.unloadAsync(), 500)
  } catch (_error) {
  }
}

/**
 * Jobs Principle: Rejection tone
 * Audible rejection signal
 */
export async function playRejectionTone() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    })

    // Use error/buzzer sound
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
      { shouldPlay: true, volume: 0.5 }
    )

    setTimeout(() => sound.unloadAsync(), 1000)
  } catch (_error) {
  }
}

/**
 * Steve Jobs Standard: Sale completion chime
 * "Make it sound like closing the Activity rings on Apple Watch.
 *  It should feel premium, rewarding, and make people smile."
 *
 * Single satisfying beep for sale completion
 */
export async function playSaleCompletionSound() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    })

    // Single satisfying beep
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
      { shouldPlay: true, volume: 1.0 }
    )

    // Clean up
    setTimeout(() => {
      sound.unloadAsync()
    }, 500)

  } catch (error) {
    // Silent fail - don't block checkout on audio errors
  }
}
