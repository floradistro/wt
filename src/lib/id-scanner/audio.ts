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
 * Creates a satisfying TWO-TONE "cha-ching!" effect
 * Like a cash register: Quick beep, then LONGER beep
 * More rewarding than a single beep, feels like success!
 */
export async function playSaleCompletionSound() {
  try {
    console.log('🔊 [AUDIO] Setting up audio mode for sale completion...')

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    })

    // TONE 1: Quick short beep (the "cha")
    console.log('🔊 [AUDIO] Playing first tone...')
    const { sound: beep1 } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
      { shouldPlay: true, volume: 1.0 }
    )

    // TONE 2: Second beep 50ms later (FAST "cha-ching!")
    setTimeout(async () => {
      console.log('🔊 [AUDIO] Playing second tone...')
      const { sound: beep2 } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
        { shouldPlay: true, volume: 1.0 }
      )

      // Clean up
      setTimeout(() => {
        beep2.unloadAsync()
      }, 500)
    }, 50)

    // Clean up first sound
    setTimeout(() => {
      beep1.unloadAsync()
    }, 500)

    console.log('🔊 [AUDIO] Sale completion chime playing!')

  } catch (error) {
    console.error('🔊 [AUDIO] Failed to play sale completion sound:', error)
  }
}
