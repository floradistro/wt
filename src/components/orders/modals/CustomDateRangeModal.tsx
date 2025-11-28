/**
 * CustomDateRangeModal Component
 * Allows users to select a custom date range for filtering orders
 * Uses native date pickers for iOS-style experience
 */

import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { FullScreenModal } from '@/components/shared/modals/FullScreenModal'
import { colors } from '@/theme/tokens'
import { useShowCustomDatePicker, useOrdersUIActions } from '@/stores/orders-ui.store'

export function CustomDateRangeModal() {
  const visible = useShowCustomDatePicker()
  const { setCustomDateRange, closeCustomDatePicker } = useOrdersUIActions()

  // Local state for temp selection (only commits on Done)
  const [startDate, setStartDate] = useState(new Date())
  const [endDate, setEndDate] = useState(new Date())

  const handleDone = () => {
    setCustomDateRange(startDate, endDate)
  }

  const handleCancel = () => {
    closeCustomDatePicker()
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={handleCancel}
      searchValue=""
      onSearchChange={() => {}}
      searchPlaceholder="Custom Date Range"
    >
      <View style={styles.container}>
        {/* Start Date */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>START DATE</Text>
          <View style={styles.card}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>From</Text>
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setStartDate(selectedDate)
                  }
                }}
                style={styles.picker}
                textColor={colors.text.primary}
              />
            </View>
          </View>
        </View>

        {/* End Date */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>END DATE</Text>
          <View style={styles.card}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>To</Text>
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setEndDate(selectedDate)
                  }
                }}
                style={styles.picker}
                textColor={colors.text.primary}
                minimumDate={startDate}
              />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={handleDone}
          >
            <Text style={styles.primaryButtonText}>Apply Filter</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={handleCancel}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </FullScreenModal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 56,
  },
  dateLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  picker: {
    flex: 1,
    marginLeft: 16,
  },
  buttonContainer: {
    marginTop: 40,
    gap: 12,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#60A5FA',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  secondaryButton: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
})
