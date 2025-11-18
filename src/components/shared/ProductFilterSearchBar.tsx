/**
 * ProductFilterSearchBar - Search + Filters using SlideUpDrawer
 * Apple Engineering: Reuses existing drawer pattern
 */

import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { SlideUpDrawer } from './SlideUpDrawer'

export interface FilterOption {
  id: string
  name: string
}

export interface ActiveFilter {
  id: string
  label: string
  type: string
}

interface ProductFilterSearchBarProps {
  // Search
  searchQuery: string
  onSearchChange: (query: string) => void
  searchPlaceholder?: string

  // Filter data
  categories?: FilterOption[]
  selectedCategories?: string[]
  onCategoryToggle?: (categoryName: string) => void

  strainTypes?: FilterOption[]
  selectedStrainTypes?: string[]
  onStrainTypeToggle?: (strainType: string) => void

  consistencies?: FilterOption[]
  selectedConsistencies?: string[]
  onConsistencyToggle?: (consistency: string) => void

  flavors?: FilterOption[]
  selectedFlavors?: string[]
  onFlavorToggle?: (flavor: string) => void

  // Actions
  onClearFilters?: () => void
  activeFilterCount: number
  activeFilterPills: ActiveFilter[]
  onRemovePill: (pill: ActiveFilter) => void

  // Layout
  position?: 'sticky' | 'relative'
}

export function ProductFilterSearchBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search',
  categories = [],
  selectedCategories = [],
  onCategoryToggle,
  strainTypes = [],
  selectedStrainTypes = [],
  onStrainTypeToggle,
  consistencies = [],
  selectedConsistencies = [],
  onConsistencyToggle,
  flavors = [],
  selectedFlavors = [],
  onFlavorToggle,
  onClearFilters,
  activeFilterCount,
  activeFilterPills,
  onRemovePill,
  position = 'sticky',
}: ProductFilterSearchBarProps) {
  const [showDrawer, setShowDrawer] = useState(false)

  const handleOpenFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowDrawer(true)
  }

  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClearFilters?.()
  }

  const containerStyle = position === 'sticky' ? styles.containerSticky : styles.containerRelative

  return (
    <>
      {/* Search Bar & Pills */}
      <View style={containerStyle}>
        {/* Unified Search Bar with Filter Button Inside */}
        <LiquidGlassView
          effect="clear"
          colorScheme="dark"
          style={[styles.searchBar, !isLiquidGlassSupported && styles.searchBarFallback]}
        >
          {/* Filter Button - Left Side */}
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            interactive
            style={[
              styles.filterButton,
              activeFilterCount > 0 && styles.filterButtonActive,
              !isLiquidGlassSupported && styles.filterButtonFallback
            ]}
          >
            <Pressable
              onPress={handleOpenFilters}
              style={styles.filterButtonInner}
            >
              {activeFilterCount > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              ) : (
                <View style={styles.filterIcon}>
                  <View style={styles.filterIconLine} />
                  <View style={styles.filterIconLine} />
                  <View style={styles.filterIconLine} />
                </View>
              )}
            </Pressable>
          </LiquidGlassView>

          {/* Clear Filters Button - Only shown when filters are active */}
          {activeFilterCount > 0 && (
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              interactive
              style={[
                styles.filterClearButton,
                !isLiquidGlassSupported && styles.filterClearButtonFallback
              ]}
            >
              <Pressable
                onPress={handleClearAll}
                style={styles.filterClearButtonInner}
              >
                <Text style={styles.filterClearText}>×</Text>
              </Pressable>
            </LiquidGlassView>
          )}

          {/* Search Input - Fills remaining space */}
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={searchQuery}
            onChangeText={onSearchChange}
          />
        </LiquidGlassView>

        {/* Active Filter Pills */}
        {activeFilterPills.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContainer}
            style={styles.pillsScroll}
          >
            {activeFilterPills.map((pill) => (
              <LiquidGlassView
                key={pill.id}
                effect="regular"
                colorScheme="dark"
                interactive
                style={[styles.pill, !isLiquidGlassSupported && styles.pillFallback]}
              >
                <Pressable onPress={() => onRemovePill(pill)} style={styles.pillInner}>
                  <Text style={styles.pillText}>{pill.label}</Text>
                  <Text style={styles.pillRemove}>×</Text>
                </Pressable>
              </LiquidGlassView>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Slide-Up Filter Drawer */}
      <SlideUpDrawer
        visible={showDrawer}
        onClose={() => setShowDrawer(false)}
        title="Filters"
      >
        {/* Categories */}
        {categories.length > 0 && onCategoryToggle && (
          <FilterSection
            title="CATEGORY"
            options={categories}
            selectedValues={selectedCategories}
            onToggle={onCategoryToggle}
          />
        )}

        {/* Strain Types */}
        {strainTypes.length > 0 && onStrainTypeToggle && (
          <FilterSection
            title="STRAIN TYPE"
            options={strainTypes}
            selectedValues={selectedStrainTypes}
            onToggle={onStrainTypeToggle}
          />
        )}

        {/* Consistencies */}
        {consistencies.length > 0 && onConsistencyToggle && (
          <FilterSection
            title="CONSISTENCY"
            options={consistencies}
            selectedValues={selectedConsistencies}
            onToggle={onConsistencyToggle}
          />
        )}

        {/* Flavors */}
        {flavors.length > 0 && onFlavorToggle && (
          <FilterSection
            title="FLAVOR"
            options={flavors}
            selectedValues={selectedFlavors}
            onToggle={onFlavorToggle}
          />
        )}

        {/* Empty state when no filters available */}
        {categories.length === 0 &&
          strainTypes.length === 0 &&
          consistencies.length === 0 &&
          flavors.length === 0 && (
            <View style={styles.emptyFilters}>
              <Text style={styles.emptyFiltersText}>No filters available</Text>
              <Text style={styles.emptyFiltersSubtext}>
                Add products with custom fields to enable filtering
              </Text>
            </View>
          )}
      </SlideUpDrawer>
    </>
  )
}

// Filter Section Component - iOS 26 Style
function FilterSection({
  title,
  options,
  selectedValues,
  onToggle,
}: {
  title: string
  options: FilterOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.group}>
        {options.map((option, index) => {
          const isSelected = selectedValues.includes(option.name)
          const isFirst = index === 0
          const isLast = index === options.length - 1
          return (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onToggle(option.name)
              }}
              style={[
                styles.item,
                isFirst && styles.itemFirst,
                isLast && styles.itemLast,
                isSelected && styles.itemSelected,
              ]}
            >
              <Text style={styles.itemText}>{option.name}</Text>
              {isSelected && <Text style={styles.itemCheck}>✓</Text>}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Container
  containerSticky: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 30,
  },
  containerRelative: {
    position: 'relative',
    zIndex: 30,
  },

  // Unified Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  searchBarFallback: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.2,
    paddingLeft: 12,
    paddingRight: 20,
  },

  // Filter Button - Inside search bar on left
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 6,
    overflow: 'hidden',
  },
  filterButtonActive: {
    // Liquid glass provides the visual effect
  },
  filterButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterButtonInner: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0,
  },
  filterIcon: {
    gap: 2,
  },
  filterIconLine: {
    width: 12,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 1,
  },
  filterClearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 4,
    marginRight: 4,
    overflow: 'hidden',
  },
  filterClearButtonFallback: {
    backgroundColor: 'rgba(255,60,60,0.15)',
  },
  filterClearButtonInner: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterClearText: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,60,60,0.95)',
    marginTop: -2,
  },

  // Pills
  pillsScroll: {
    marginTop: 10,
  },
  pillsContainer: {
    gap: 8,
    paddingRight: 16,
  },
  pill: {
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  pillFallback: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.2,
  },
  pillRemove: {
    fontSize: 18,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    marginTop: -2,
  },

  // Filter Sections (iOS 26 Grouped List)
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  group: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  item: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  itemLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 0,
  },
  itemSelected: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.2,
  },
  itemCheck: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },

  // Empty State
  emptyFilters: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyFiltersText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyFiltersSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
})
