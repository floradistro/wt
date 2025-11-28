import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

export interface BreadcrumbItem {
  label: string;
  onPress?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Standardized Breadcrumb component with pill-shaped buttons
 * Used across the app for hierarchical navigation
 *
 * @example
 * <Breadcrumb items={[
 *   { label: 'Products', onPress: () => navigate('products') },
 *   { label: 'Shirts', onPress: () => navigate('category', { id: 123 }) },
 *   { label: 'Blue Shirt' } // Current page - no onPress
 * ]} />
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isClickable = !!item.onPress;

        return (
          <View key={`${item.label}-${index}`} style={styles.itemWrapper}>
            {isClickable ? (
              <Pressable
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.pill,
                  pressed && styles.pillPressed,
                ]}
              >
                <Text style={styles.pillText}>{item.label}</Text>
              </Pressable>
            ) : (
              <View style={styles.currentPill}>
                <Text style={styles.currentPillText}>{item.label}</Text>
              </View>
            )}

            {!isLast && (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.text.tertiary}
                style={styles.separator}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  itemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  pillPressed: {
    backgroundColor: colors.background.tertiary,
    opacity: 0.7,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  currentPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.glass.thick,
    borderWidth: 1,
    borderColor: colors.border.emphasis,
  },
  currentPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  separator: {
    marginHorizontal: spacing.xs,
  },
});
