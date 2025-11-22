/**
 * React Native Type Extensions
 * Adds missing iOS-specific properties to React Native types
 */

import 'react-native'

declare module 'react-native' {
  export interface ViewStyle {
    /**
     * iOS-only: Controls the border curve style
     * - 'circular': Smooth, continuous curve (iOS default for buttons)
     * - 'continuous': Apple's signature fluid curve
     * @platform ios
     */
    borderCurve?: 'circular' | 'continuous'
  }
}
