/**
 * NavSidebar Component
 * Reusable iOS Settings-style navigation sidebar
 * Apple Engineering: Single component, zero redundancy
 */

import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image } from 'react-native'
import React, { ReactNode } from 'react'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { layout } from '@/theme/layout'
import { ProductFilterSearchBar, type FilterOption, type ActiveFilter } from './shared'

// Monochrome Search Icon (like Settings)
function SearchIcon({ color }: { color: string }) {
  return (
    <View style={styles.searchIconContainer}>
      <View style={[styles.searchIconCircle, { borderColor: color }]} />
      <View style={[styles.searchIconHandle, { backgroundColor: color }]} />
    </View>
  )
}

// Monochrome Grid Icon (All Products)
function GridIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.gridSquare, { backgroundColor: color, top: 0, left: 0 }]} />
      <View style={[styles.gridSquare, { backgroundColor: color, top: 0, right: 0 }]} />
      <View style={[styles.gridSquare, { backgroundColor: color, bottom: 0, left: 0 }]} />
      <View style={[styles.gridSquare, { backgroundColor: color, bottom: 0, right: 0 }]} />
    </View>
  )
}

// Monochrome Warning Icon (Low Stock)
function WarningIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.warningTriangle, { borderBottomColor: color }]} />
      <Text style={[styles.warningExclamation, { color }]}>!</Text>
    </View>
  )
}

// Monochrome Box Icon (Out of Stock)
function BoxIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.boxOuter, { borderColor: color }]}>
        <View style={[styles.boxInner, { borderColor: color }]} />
      </View>
    </View>
  )
}

// Monochrome Folder Icon (Categories)
function FolderIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.folderTab, { backgroundColor: color }]} />
      <View style={[styles.folderBody, { borderColor: color }]} />
    </View>
  )
}

export interface NavItem {
  id: string
  icon: 'grid' | 'warning' | 'box' | 'folder' | React.ComponentType<{ color: string }> // Icon type or custom component
  label: string
  count?: number
  badge?: 'warning' | 'error' | 'info'
}

interface NavSidebarProps {
  width?: number
  searchValue?: string
  onSearchChange?: (value: string) => void
  items: NavItem[]
  activeItemId: string
  onItemPress: (itemId: string) => void
  footer?: ReactNode
  userName?: string
  vendorName?: string
  vendorLogo?: string | null
  onUserProfilePress?: () => void
  selectedLocationNames?: string[] // Names of selected locations to display

  // Filter props (optional - only for product views)
  showFilters?: boolean
  categories?: FilterOption[]
  selectedCategories?: string[]
  onCategoryToggle?: (category: string) => void
  strainTypes?: FilterOption[]
  selectedStrainTypes?: string[]
  onStrainTypeToggle?: (strainType: string) => void
  consistencies?: FilterOption[]
  selectedConsistencies?: string[]
  onConsistencyToggle?: (consistency: string) => void
  flavors?: FilterOption[]
  selectedFlavors?: string[]
  onFlavorToggle?: (flavor: string) => void
  onClearFilters?: () => void
  activeFilterCount?: number
  activeFilterPills?: ActiveFilter[]
  onRemovePill?: (pill: ActiveFilter) => void
}

export function NavSidebar({
  width = 280,
  searchValue = '',
  onSearchChange,
  items,
  activeItemId,
  onItemPress,
  footer,
  userName,
  vendorName,
  vendorLogo,
  onUserProfilePress,
  selectedLocationNames = [],
  // Filter props
  showFilters = false,
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
  activeFilterCount = 0,
  activeFilterPills = [],
  onRemovePill,
}: NavSidebarProps) {
  return (
    <View style={[styles.sidebar, { width }]}>
      <LiquidGlassView
        effect="regular"
        colorScheme="dark"
        style={[styles.sidebarContainer, !isLiquidGlassSupported && styles.sidebarContainerFallback]}
      >
        <View style={styles.contentWrapper}>
          <ScrollView
            style={styles.sidebarScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarScrollContent}
          >
            {/* Spacer for fixed search bar - taller when showing filter pills */}
            {onSearchChange && (
              <View style={[
                styles.searchSpacer,
                showFilters && activeFilterPills.length > 0 && styles.searchSpacerWithPills
              ]} />
            )}

            {/* User Profile Section */}
            {userName && (
              <View style={styles.userProfileWrapper}>
                <LiquidGlassContainerView spacing={0}>
                  <LiquidGlassView
                    effect="regular"
                    colorScheme="dark"
                    interactive
                    style={[styles.userProfileCard, !isLiquidGlassSupported && styles.userProfileCardFallback]}
                  >
                    <Pressable
                      style={styles.userProfile}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        onUserProfilePress?.()
                      }}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`${vendorName || 'Vendor'}, ${userName || 'User'}${onUserProfilePress ? ', tap to change location' : ''}`}
                      accessibilityHint={onUserProfilePress ? "Double tap to select locations" : undefined}
                    >
                      {vendorLogo && vendorLogo.trim() !== '' ? (
                        <Image
                          source={{ uri: vendorLogo }}
                          style={styles.vendorLogo}
                        />
                      ) : (
                        <View style={styles.vendorLogoPlaceholder}>
                          <Text style={styles.vendorLogoText}>
                            {vendorName?.charAt(0).toUpperCase() || 'V'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{userName}</Text>
                        <Text style={styles.vendorName}>{vendorName || 'Vendor Account'}</Text>
                        {selectedLocationNames.length > 0 && (
                          <Text style={styles.selectedLocations} numberOfLines={1}>
                            {selectedLocationNames.join(', ')}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.userProfileChevron}>›</Text>
                    </Pressable>
                  </LiquidGlassView>
                </LiquidGlassContainerView>
              </View>
            )}

            {/* Nav Items */}
            <View style={styles.navItems}>
            {items.map((item, index) => {
              const isActive = activeItemId === item.id
              const isLast = index === items.length - 1

              // Get icon component
              const iconColor = isActive ? '#fff' : 'rgba(235,235,245,0.6)'
              let IconComponent: React.ReactElement

              // Check if icon is a custom component
              if (typeof item.icon === 'function') {
                const CustomIcon = item.icon
                IconComponent = <CustomIcon color={iconColor} />
              } else {
                // Use built-in icons
                switch (item.icon) {
                  case 'grid':
                    IconComponent = <GridIcon color={iconColor} />
                    break
                  case 'warning':
                    IconComponent = <WarningIcon color={iconColor} />
                    break
                  case 'box':
                    IconComponent = <BoxIcon color={iconColor} />
                    break
                  case 'folder':
                    IconComponent = <FolderIcon color={iconColor} />
                    break
                  default:
                    IconComponent = <GridIcon color={iconColor} />
                }
              }

              const accessibilityLabel = item.count !== undefined
                ? `${item.label}, ${item.count} items${item.badge ? `, ${item.badge}` : ''}`
                : item.label

              return (
                <View key={item.id} style={styles.navItemWrapper}>
                  {isActive ? (
                    <LiquidGlassView
                      effect="regular"
                      colorScheme="dark"
                      style={[styles.navItemPill, !isLiquidGlassSupported && styles.navItemPillFallback]}
                      accessible={false}
                    >
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          onItemPress(item.id)
                        }}
                        style={styles.navItemContent}
                        accessible={true}
                        accessibilityRole="tab"
                        accessibilityLabel={accessibilityLabel}
                        accessibilityState={{ selected: true }}
                        accessibilityHint={`Currently viewing ${item.label}`}
                      >
                        <View style={styles.navIconWrapper} accessibilityElementsHidden={true} importantForAccessibility="no">{IconComponent}</View>
                        <Text style={styles.navLabel}>{item.label}</Text>
                        {item.count !== undefined && (
                          <View
                            style={[
                              styles.navBadge,
                              item.badge === 'warning' && styles.navBadgeWarning,
                              item.badge === 'error' && styles.navBadgeError,
                              item.badge === 'info' && styles.navBadgeInfo,
                            ]}
                            accessibilityElementsHidden={true}
                            importantForAccessibility="no"
                          >
                            <Text style={styles.navBadgeText}>{item.count}</Text>
                          </View>
                        )}
                        <Text style={styles.navChevron} accessibilityElementsHidden={true} importantForAccessibility="no">›</Text>
                      </Pressable>
                    </LiquidGlassView>
                  ) : (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        onItemPress(item.id)
                      }}
                      style={styles.navItemContent}
                      accessible={true}
                      accessibilityRole="tab"
                      accessibilityLabel={accessibilityLabel}
                      accessibilityState={{ selected: false }}
                      accessibilityHint={`Double tap to view ${item.label}`}
                    >
                      <View style={styles.navIconWrapper} accessibilityElementsHidden={true} importantForAccessibility="no">{IconComponent}</View>
                      <Text style={[styles.navLabel, styles.navLabelInactive]}>{item.label}</Text>
                      {item.count !== undefined && (
                        <View
                          style={[
                            styles.navBadge,
                            item.badge === 'warning' && styles.navBadgeWarning,
                            item.badge === 'error' && styles.navBadgeError,
                            item.badge === 'info' && styles.navBadgeInfo,
                          ]}
                          accessibilityElementsHidden={true}
                          importantForAccessibility="no"
                        >
                          <Text style={styles.navBadgeText}>{item.count}</Text>
                        </View>
                      )}
                      <Text style={[styles.navChevron, styles.navChevronInactive]} accessibilityElementsHidden={true} importantForAccessibility="no">›</Text>
                    </Pressable>
                  )}
                </View>
              )
            })}
          </View>

            {/* Footer */}
            {footer && <View style={styles.footer}>{footer}</View>}
          </ScrollView>

          {/* Fixed Search Bar - Floating overlay on top */}
          {onSearchChange && (
            <View style={styles.searchContainer}>
              {showFilters ? (
                <ProductFilterSearchBar
                  searchQuery={searchValue}
                  onSearchChange={onSearchChange}
                  searchPlaceholder="Search"
                  categories={categories}
                  selectedCategories={selectedCategories}
                  onCategoryToggle={onCategoryToggle}
                  strainTypes={strainTypes}
                  selectedStrainTypes={selectedStrainTypes}
                  onStrainTypeToggle={onStrainTypeToggle}
                  consistencies={consistencies}
                  selectedConsistencies={selectedConsistencies}
                  onConsistencyToggle={onConsistencyToggle}
                  flavors={flavors}
                  selectedFlavors={selectedFlavors}
                  onFlavorToggle={onFlavorToggle}
                  onClearFilters={onClearFilters}
                  activeFilterCount={activeFilterCount}
                  activeFilterPills={activeFilterPills}
                  onRemovePill={onRemovePill}
                  position="relative"
                />
              ) : (
                <LiquidGlassView
                  effect="clear"
                  colorScheme="dark"
                  style={[styles.unifiedSearchBar, !isLiquidGlassSupported && styles.unifiedSearchBarFallback]}
                >
                  <TextInput
                    style={styles.unifiedSearchInput}
                    placeholder="Search"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={searchValue}
                    onChangeText={onSearchChange}
                    accessible={true}
                    accessibilityLabel="Search navigation items"
                    accessibilityHint="Type to filter the navigation list"
                  />
                </LiquidGlassView>
              )}
            </View>
          )}
        </View>
      </LiquidGlassView>
    </View>
  )
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: '#000',
  },
  sidebarContainer: {
    flex: 1,
    marginLeft: 8, // Ultra-minimal iOS-style left padding
    marginRight: layout.containerMargin,
    marginTop: layout.containerMargin,
    marginBottom: layout.containerMargin,
    borderRadius: layout.containerRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  sidebarContainerFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarScrollContent: {
    paddingBottom: 24,
  },
  searchSpacer: {
    height: 76, // Height of fixed search bar (48px + padding)
  },
  searchSpacerWithPills: {
    height: 132, // Extra height when filter pills are shown
  },

  // User Profile Section
  userProfileWrapper: {
    paddingHorizontal: layout.cardPadding,
    marginBottom: 12,
  },
  userProfileCard: {
    borderRadius: layout.pillRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  userProfileCardFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
    minHeight: layout.minTouchTarget,
  },
  userProfileChevron: {
    fontSize: 20,
    color: 'rgba(235,235,245,0.3)',
    marginLeft: 4,
  },
  vendorLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  vendorLogoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorLogoText: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  vendorName: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  selectedLocations: {
    fontSize: 12,
    color: 'rgba(235,235,245,0.6)',
    marginTop: 2,
    fontWeight: '400',
  },

  // Fixed Search Bar - Floating overlay
  searchContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: layout.cardPadding,
    paddingTop: layout.cardPadding,
    paddingBottom: 12,
    zIndex: 999,
    elevation: 999, // Android elevation
  },
  // Unified Search Bar - matches ProductFilterSearchBar style
  unifiedSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  unifiedSearchBarFallback: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  unifiedSearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.2,
    paddingHorizontal: 20,
  },
  // Old search bar styles (deprecated, keeping for reference)
  searchBar: {
    borderRadius: layout.pillRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
    minHeight: layout.minTouchTarget,
  },
  searchBarFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#fff',
    letterSpacing: -0.4,
  },

  // Search Icon
  searchIconContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconCircle: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
  },
  searchIconHandle: {
    width: 5,
    height: 1.5,
    position: 'absolute',
    bottom: 0.5,
    right: 0.5,
    transform: [{ rotate: '45deg' }],
  },

  // Nav Items
  navItems: {
    gap: 8,
  },
  navItemWrapper: {
    paddingHorizontal: layout.cardPadding,
  },
  navItemPill: {
    borderRadius: layout.pillRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  navItemPillFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
    minHeight: layout.minTouchTarget,
  },
  navIconWrapper: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
  },
  navLabelInactive: {
    color: 'rgba(235,235,245,0.6)',
  },
  navBadge: {
    minWidth: 24,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  navBadgeWarning: {
    backgroundColor: 'rgba(255,149,0,0.25)',
  },
  navBadgeError: {
    backgroundColor: 'rgba(255,59,48,0.25)',
  },
  navBadgeInfo: {
    backgroundColor: 'rgba(10,132,255,0.25)',
  },
  navBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  navChevron: {
    fontSize: 20,
    color: 'rgba(235,235,245,0.3)',
    marginLeft: 4,
  },
  navChevronInactive: {
    opacity: 0,
  },

  // Footer
  footer: {
    paddingHorizontal: layout.cardPadding,
    paddingTop: 12,
  },

  // Icon Styles
  iconContainer: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // Grid Icon (4 squares)
  gridSquare: {
    width: 7,
    height: 7,
    borderRadius: 1.5,
    position: 'absolute',
  },

  // Warning Icon (triangle with !)
  warningTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  warningExclamation: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '900',
    top: 2,
  },

  // Box Icon (package box)
  boxOuter: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 2,
  },
  boxInner: {
    width: 6,
    height: 3,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    position: 'absolute',
    top: -3,
    left: 2,
  },

  // Folder Icon
  folderTab: {
    width: 8,
    height: 3,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    position: 'absolute',
    top: 2,
    left: 0,
  },
  folderBody: {
    width: 16,
    height: 11,
    borderWidth: 1.5,
    borderRadius: 2,
    position: 'absolute',
    bottom: 0,
  },
})
