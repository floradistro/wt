/**
 * TitleSection Component
 *
 * STANDARDIZED APP-WIDE TITLE SECTION ✅
 * Beautiful glass card container with logo, title, subtitle, and action button
 *
 * Pattern: Semi-transparent glass card with pill-shaped button
 * Use this for ALL view titles across the entire app
 *
 * Example:
 * ```tsx
 * <TitleSection
 *   title="Categories"
 *   logo={vendor?.logo_url}
 *   subtitle="7 categories"
 *   buttonText="+ New Category"
 *   onButtonPress={handleAddCategory}
 * />
 * ```
 */

import React from 'react'
import { View, Text, StyleSheet, Image, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { pillButtonStyles } from './styles/common-styles'
import { getIconImage } from '@/utils/image-transforms'

export interface FilterPill {
  id: string
  label: string
}

export interface TitleSectionProps {
  /** Main title text (e.g., "Categories", "Products", "Audits") */
  title: string

  /** Optional vendor/app logo URL */
  logo?: string | null

  /** Optional subtitle text (e.g., "7 categories", "0 records") */
  subtitle?: string | null

  /** Button text (e.g., "+ New Category", "+ Create Audit") */
  buttonText?: string

  /** Button press handler */
  onButtonPress?: () => void

  /** Hide button completely */
  hideButton?: boolean

  /** Disable button */
  buttonDisabled?: boolean

  /** Custom button accessibility label */
  buttonAccessibilityLabel?: string

  /** Optional filter pills to display below title */
  filterPills?: FilterPill[]

  /** Active filter pill ID */
  activeFilterId?: string

  /** Filter pill selection handler */
  onFilterSelect?: (id: string) => void

  /** Show back button */
  showBackButton?: boolean

  /** Back button press handler */
  onBackPress?: () => void

  /** Secondary action button (e.g., Compliance) */
  secondaryButtonText?: string

  /** Secondary button icon name (Ionicons) */
  secondaryButtonIcon?: keyof typeof Ionicons.glyphMap

  /** Secondary button color */
  secondaryButtonColor?: string

  /** Secondary button press handler */
  onSecondaryButtonPress?: () => void
}

/**
 * TitleSection - Standardized glass card title
 * Used across all views for consistent branding
 */
export function TitleSection({
  title,
  logo,
  subtitle,
  buttonText,
  onButtonPress,
  hideButton = false,
  buttonDisabled = false,
  buttonAccessibilityLabel,
  filterPills,
  activeFilterId,
  onFilterSelect,
  showBackButton = false,
  onBackPress,
  secondaryButtonText,
  secondaryButtonIcon,
  secondaryButtonColor,
  onSecondaryButtonPress,
}: TitleSectionProps) {
  const handleButtonPress = () => {
    if (onButtonPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onButtonPress()
    }
  }

  const handleFilterPress = (id: string) => {
    if (onFilterSelect) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onFilterSelect(id)
    }
  }

  const handleBackPress = () => {
    if (onBackPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onBackPress()
    }
  }

  const handleSecondaryButtonPress = () => {
    if (onSecondaryButtonPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onSecondaryButtonPress()
    }
  }

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.titleSectionContainer}>
        <View style={styles.largeTitleContainer}>
          {showBackButton && (
            <Pressable
              style={styles.backButton}
              onPress={handleBackPress}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
            </Pressable>
          )}
          <View style={styles.titleContent}>
            <View style={styles.titleWithLogo}>
              {logo && (
                <Image
                  source={{ uri: getIconImage(logo) || logo }}
                  style={styles.vendorLogoInline}
                  resizeMode="contain"
                  fadeDuration={0}
                />
              )}
              <Text style={styles.largeTitleHeader}>{title}</Text>
            </View>
            {subtitle && (
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            )}
          </View>

          {/* Filter Pills and Button in same row */}
          <View style={styles.actionsContainer}>
            {filterPills && filterPills.length > 0 && (
              <View style={styles.filterPillsContainer}>
                {filterPills.map((pill) => (
                  <Pressable
                    key={pill.id}
                    style={[
                      pillButtonStyles.button,
                      activeFilterId === pill.id && styles.filterPillActive,
                    ]}
                    onPress={() => handleFilterPress(pill.id)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={pill.label}
                  >
                    <Text
                      style={[
                        pillButtonStyles.buttonText,
                        activeFilterId === pill.id && styles.filterPillTextActive,
                      ]}
                    >
                      {pill.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {secondaryButtonText && (
              <Pressable
                style={[
                  styles.secondaryButton,
                  secondaryButtonColor && { backgroundColor: `${secondaryButtonColor}20` },
                ]}
                onPress={handleSecondaryButtonPress}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={secondaryButtonText}
              >
                {secondaryButtonIcon && (
                  <Ionicons
                    name={secondaryButtonIcon}
                    size={16}
                    color={secondaryButtonColor || colors.text.primary}
                  />
                )}
                <Text
                  style={[
                    styles.secondaryButtonText,
                    secondaryButtonColor && { color: secondaryButtonColor },
                  ]}
                >
                  {secondaryButtonText}
                </Text>
              </Pressable>
            )}

            {!hideButton && buttonText && (
              <Pressable
                style={[
                  pillButtonStyles.button,
                  buttonDisabled && styles.buttonDisabled,
                ]}
                onPress={handleButtonPress}
                disabled={buttonDisabled}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={buttonAccessibilityLabel || buttonText}
              >
                <Text style={pillButtonStyles.buttonText}>{buttonText}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cardWrapper: {
    paddingHorizontal: layout.contentHorizontal,
  },
  titleSectionContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  largeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
  },
  titleContent: {
    flex: 1,
  },
  titleWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vendorLogoInline: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  largeTitleHeader: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterPillsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterPillActive: {
    backgroundColor: 'rgba(255,255,255,0.15)', // Match product list - borderless
  },
  filterPillTextActive: {
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
})
