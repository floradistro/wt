import * as Haptics from 'expo-haptics'

/**
 * Audio feedback module
 *
 * Uses haptic feedback for now since expo-av is deprecated and
 * expo-audio requires hooks-based API that doesn't work for
 * imperative calls. Haptics provide excellent tactile feedback
 * on iOS devices.
 *
 * TODO: Implement proper audio with expo-audio in a React context
 * when needed for actual sound playback.
 */

/**
 * Jobs Principle: Success beep (system sound)
 * Audible confirmation - uses haptic feedback
 */
export async function playSuccessBeep() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  } catch (_error) {
    // Silent fail - don't block on haptic errors
  }
}

/**
 * Jobs Principle: Rejection tone
 * Audible rejection signal - uses error haptic
 */
export async function playRejectionTone() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  } catch (_error) {
    // Silent fail - don't block on haptic errors
  }
}

/**
 * Steve Jobs Standard: Sale completion chime
 * "Make it sound like closing the Activity rings on Apple Watch.
 *  It should feel premium, rewarding, and make people smile."
 *
 * Uses success haptic for satisfying feedback
 */
export async function playSaleCompletionSound() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  } catch (_error) {
    // Silent fail - don't block checkout on haptic errors
  }
}
