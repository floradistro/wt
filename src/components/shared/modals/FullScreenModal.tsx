/**
 * FullScreenModal - New Standard Modal Component
 * Based on POSUnifiedCustomerSelector pattern
 *
 * This is our standard for ALL full-screen modals going forward
 * Features:
 * - Full screen slide-up sheet
 * - Pill-shaped inputs and buttons
 * - Clean, minimal design
 * - Consistent colors and spacing
 *
 * Usage:
 * - Create modal, use this as template
 * - Copy structure, replace content
 * - Keep header search bar pattern
 * - Keep pill shapes for all inputs
 */

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native'
import { ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface FullScreenModalProps {
  visible: boolean
  onClose: () => void
  searchValue: string
  onSearchChange: (text: string) => void
  searchPlaceholder: string
  children: ReactNode
}

/**
 * FullScreenModal - Standard Template
 *
 * @example
 * <FullScreenModal
 *   visible={showModal}
 *   onClose={handleClose}
 *   searchValue={name}
 *   onSearchChange={setName}
 *   searchPlaceholder="Category name"
 * >
 *   <View style={styles.section}>
 *     <Text style={styles.sectionLabel}>YOUR SECTION</Text>
 *     // Your content here
 *   </View>
 * </FullScreenModal>
 */
export function FullScreenModal({
  visible,
  onClose,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  children,
}: FullScreenModalProps) {
  const insets = useSafeAreaInsets()

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header - Standard Pattern */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor="rgba(235,235,245,0.3)"
            />
          </View>
          <Pressable onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>

        {/* Content - Scrollable */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  )
}

// Standard Styles - Use these in your modal
export const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 24, // PILL SHAPED
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
  },
  doneButton: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24, // PILL SHAPED
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  // Section Styles
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.08,
    marginBottom: 12,
    marginLeft: 4,
  },
  // Card/Input Styles - PILL SHAPED
  card: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20, // PILL SHAPED
    padding: 16,
  },
  input: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.2,
  },
  // Button Styles - PILL SHAPED
  button: {
    marginTop: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24, // PILL SHAPED
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
})

const styles = modalStyles
