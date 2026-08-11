import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}

export function SectionCard({ title, subtitle, icon, color, onPress }: SectionCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.iconCircle, { backgroundColor: color }]}>
        <Ionicons name={icon} size={22} color="#FFF" />
      </View>
      <View style={styles.textGroup}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#CCC" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: { flex: 1 },
  title: {
    fontSize: FONT.cardTitle,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONT.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
