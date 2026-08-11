import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

interface ToolTileProps {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  size?: 'small' | 'medium';
}

export function ToolTile({ title, subtitle, icon, color, onPress, size = 'medium' }: ToolTileProps) {
  const isSmall = size === 'small';
  return (
    <TouchableOpacity
      style={[styles.tile, isSmall && styles.tileSmall]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.iconCircle, { backgroundColor: color }, isSmall && styles.iconSmall]}>
        <Ionicons name={icon} size={isSmall ? 20 : 24} color="#FFF" />
      </View>
      <Text style={[styles.title, isSmall && styles.titleSmall]} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    width: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tileSmall: { width: 80, padding: SPACING.sm },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconSmall: { width: 38, height: 38, borderRadius: 19 },
  title: {
    fontSize: FONT.bodySmall,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  titleSmall: { fontSize: FONT.caption },
  subtitle: {
    fontSize: FONT.micro,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
});
