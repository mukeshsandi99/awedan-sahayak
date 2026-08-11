import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

interface Action {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => Promise<void> | void;
  color?: string;
  loading?: boolean;
}

interface ExportActionBarProps {
  actions: Action[];
  style?: any;
}

export function ExportActionBar({ actions, style }: ExportActionBarProps) {
  return (
    <View style={[styles.bar, style]}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={[styles.btn, { borderColor: action.color ?? COLORS.primary }]}
          activeOpacity={0.7}
          onPress={action.onPress}
          disabled={action.loading}
        >
          {action.loading ? (
            <ActivityIndicator size="small" color={action.color ?? COLORS.primary} />
          ) : (
            <Ionicons name={action.icon} size={18} color={action.color ?? COLORS.primary} />
          )}
          <Text style={[styles.label, { color: action.color ?? COLORS.primary }]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.md,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
  },
  label: {
    fontSize: FONT.bodySmall,
    fontWeight: '600',
  },
});
