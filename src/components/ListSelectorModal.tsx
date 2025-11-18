/**
 * Generic List Selector Modal
 * PageSheet style for reliable modal support
 */

import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, TextInput } from 'react-native'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'

export interface ListItem {
  id: string
  name: string
  subtitle?: string
}

interface ListSelectorModalProps {
  visible: boolean
  title: string
  items: ListItem[]
  selectedId?: string
  onSelect: (item: ListItem) => void
  onClose: () => void
  searchable?: boolean
  searchPlaceholder?: string
}

export function ListSelectorModal({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  searchable = false,
  searchPlaceholder = 'Search...',
}: ListSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return items
    }

    const query = searchQuery.toLowerCase()
    return items.filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(query))
    )
  }, [items, searchQuery, searchable])

  const handleSelect = (item: ListItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSelect(item)
    onClose()
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSearchQuery('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.container}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.background, !isLiquidGlassSupported && styles.backgroundFallback]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Search Bar */}
          {searchable && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.text.quaternary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>
          )}

          {/* List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No items found</Text>
              </View>
            ) : (
              <View style={styles.section}>
                <View style={styles.cardGlass}>
                  {filteredItems.map((item, index) => (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.row,
                        index === filteredItems.length - 1 && styles.rowLast,
                        selectedId === item.id && styles.rowSelected,
                      ]}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={styles.rowContent}>
                        <Text style={styles.rowTitle}>{item.name}</Text>
                        {item.subtitle && (
                          <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                        )}
                      </View>
                      {selectedId === item.id && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </LiquidGlassView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    flex: 1,
  },
  backgroundFallback: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    minHeight: 60,
  },
  headerButton: {
    minWidth: 60,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 17,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  headerSpacer: {
    minWidth: 60,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.sm,
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  section: {
    marginTop: 8,
    marginBottom: 20,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowSelected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginLeft: 12,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    textAlign: 'center',
  },
})
