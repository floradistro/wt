/**
 * DetailRow - Shared detail row component for Settings details
 * Apple-inspired simple information display row
 */

import { View, Text, StyleSheet } from 'react-native'
import { colors, typography } from '@/theme/tokens'

interface DetailRowProps {
  label: string
  value?: string
  subtitle?: string
  showChevron?: boolean
}

export function DetailRow({ label, value, subtitle, showChevron }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowLeft}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        {subtitle && <Text style={styles.detailRowSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.detailRowRight}>
        {value && <Text style={styles.detailRowValue}>{value}</Text>}
        {showChevron && <Text style={styles.chevronSmall}>›</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(235,235,245,0.1)',
  },
  detailRowLeft: {
    flex: 1,
  },
  detailRowLabel: {
    ...typography.body,
    color: colors.text.primary,
  },
  detailRowSubtitle: {
    ...typography.caption1,
    color: colors.text.secondary,
    marginTop: 2,
  },
  detailRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailRowValue: {
    ...typography.body,
    color: colors.text.secondary,
  },
  chevronSmall: {
    fontSize: 20,
    color: 'rgba(235,235,245,0.3)',
  },
})
