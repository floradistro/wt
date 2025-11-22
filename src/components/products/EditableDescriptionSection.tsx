/**
 * Editable Description Section
 * Inline editing for product description following iOS patterns
 */

import { View, Text, StyleSheet, TextInput } from 'react-native'
import { radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'

interface EditableDescriptionSectionProps {
  description: string | null
  editedDescription: string
  isEditing: boolean
  onChangeText: (text: string) => void
}

export function EditableDescriptionSection({
  description,
  editedDescription,
  isEditing,
  onChangeText,
}: EditableDescriptionSectionProps) {
  // Don't render section if no description and not editing
  if (!description && !isEditing) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>DESCRIPTION</Text>
      <View style={styles.cardGlass}>
        {isEditing ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.descriptionInput}
                value={editedDescription}
                onChangeText={onChangeText}
                placeholder="Add a description..."
                placeholderTextColor="rgba(235,235,245,0.3)"
                multiline
                textAlignVertical="top"
              />
            </View>
          ) : (
            <View style={styles.viewRow}>
              <Text style={styles.descriptionText}>
                {description?.replace(/<[^>]*>/g, '') || ''}
              </Text>
            </View>
          )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: layout.containerMargin, // Handles own horizontal spacing
    marginBottom: layout.sectionSpacing,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 0, // No padding - inherits parent margin
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardGlassFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  editRow: {
    paddingVertical: 14,
    paddingHorizontal: layout.rowPaddingHorizontal,
  },
  viewRow: {
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
    letterSpacing: -0.2,
  },
  descriptionInput: {
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
    letterSpacing: -0.2,
    minHeight: 120,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
  },
})
