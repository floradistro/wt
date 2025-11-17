/**
 * CategoryCard Component
 * Expandable card showing category with custom fields & pricing sections
 * Apple Engineering: <300 lines, single responsibility
 */

import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useState, useRef, useEffect } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { layout } from '@/theme/layout'
import type { Category } from '@/hooks/useCategories'

interface CategoryCardProps {
  category: Category
  isExpanded: boolean
  onToggleExpansion: () => void
  onEdit: () => void
  onDelete: () => void
  onManageFields: () => void
  onManagePricing: () => void
  fieldsCount?: number
  templatesCount?: number
}

export function CategoryCard({
  category,
  isExpanded,
  onToggleExpansion,
  onEdit,
  onDelete,
  onManageFields,
  onManagePricing,
  fieldsCount = 0,
  templatesCount = 0,
}: CategoryCardProps) {
  const [expandedSection, setExpandedSection] = useState<'fields' | 'pricing' | null>(null)
  const rotateAnim = useRef(new Animated.Value(0)).current
  const expandAnim = useRef(new Animated.Value(0)).current

  // Chevron rotation animation
  useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start()

    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: false,
      tension: 100,
      friction: 10,
    }).start()
  }, [isExpanded])

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  })

  const handleSectionPress = (section: 'fields' | 'pricing') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <View style={styles.container}>
      <LiquidGlassView
        effect="regular"
        colorScheme="dark"
        style={[styles.card, !isLiquidGlassSupported && styles.cardFallback]}
      >
        {/* Header - Always visible */}
        <Pressable onPress={onToggleExpansion} style={styles.header}>
          <Animated.Text style={[styles.chevron, { transform: [{ rotate: chevronRotation }] }]}>
            ›
          </Animated.Text>
          <View style={styles.headerContent}>
            <Text style={styles.categoryName}>{category.name}</Text>
            {category.description && (
              <Text style={styles.categoryDescription} numberOfLines={1}>
                {category.description}
              </Text>
            )}
          </View>
          {category.product_count !== undefined && category.product_count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{category.product_count}</Text>
            </View>
          )}
        </Pressable>

        {/* Expanded Content */}
        {isExpanded && (
          <>
            {/* Section Toggles */}
            <View style={styles.sections}>
              <Pressable
                style={[styles.sectionButton, expandedSection === 'fields' && styles.sectionButtonActive]}
                onPress={() => handleSectionPress('fields')}
              >
                <Text style={[styles.sectionButtonText, expandedSection === 'fields' && styles.sectionButtonTextActive]}>
                  􀏭 Fields ({fieldsCount})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.sectionButton, expandedSection === 'pricing' && styles.sectionButtonActive]}
                onPress={() => handleSectionPress('pricing')}
              >
                <Text style={[styles.sectionButtonText, expandedSection === 'pricing' && styles.sectionButtonTextActive]}>
                  􀖅 Pricing ({templatesCount})
                </Text>
              </Pressable>
            </View>

            {/* Fields Section */}
            {expandedSection === 'fields' && (
              <View style={styles.sectionContent}>
                <Text style={styles.sectionLabel}>CUSTOM FIELDS</Text>
                <Pressable style={styles.manageButton} onPress={onManageFields}>
                  <Text style={styles.manageButtonText}>Manage Fields</Text>
                  <Text style={styles.manageChevron}>􀆊</Text>
                </Pressable>
              </View>
            )}

            {/* Pricing Section */}
            {expandedSection === 'pricing' && (
              <View style={styles.sectionContent}>
                <Text style={styles.sectionLabel}>PRICING TEMPLATES</Text>
                <Pressable style={styles.manageButton} onPress={onManagePricing}>
                  <Text style={styles.manageButtonText}>Manage Templates</Text>
                  <Text style={styles.manageChevron}>􀆊</Text>
                </Pressable>
              </View>
            )}

            {/* Actions Row */}
            <View style={styles.actions}>
              <Pressable style={styles.actionButton} onPress={onEdit}>
                <Text style={styles.actionButtonText}>Edit</Text>
              </Pressable>
              <View style={styles.actionDivider} />
              <Pressable style={styles.actionButton} onPress={onDelete}>
                <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>Delete</Text>
              </Pressable>
            </View>
          </>
        )}
      </LiquidGlassView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  card: {
    borderRadius: layout.cardRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardFallback: {
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.cardPadding,
    minHeight: layout.minTouchTarget,
  },
  chevron: {
    fontSize: 20,
    color: 'rgba(235,235,245,0.6)',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  categoryDescription: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    marginTop: 2,
  },
  badge: {
    minWidth: 24,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  sections: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: layout.cardPadding,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sectionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sectionButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sectionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
  },
  sectionButtonTextActive: {
    color: '#fff',
  },
  sectionContent: {
    padding: layout.cardPadding,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  manageButtonText: {
    fontSize: 15,
    color: '#60A5FA',
    fontWeight: '500',
  },
  manageChevron: {
    fontSize: 17,
    color: 'rgba(235,235,245,0.3)',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDivider: {
    width: 0.5,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionButtonText: {
    fontSize: 15,
    color: '#60A5FA',
    fontWeight: '500',
  },
  actionButtonTextDanger: {
    color: '#ff453a',
  },
})
