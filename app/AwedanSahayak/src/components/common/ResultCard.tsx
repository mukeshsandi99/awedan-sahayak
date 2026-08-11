import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

interface ResultCardProps {
  riskLevel: 'low' | 'caution' | 'high';
  reasons: string[];
  title?: string;
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  low: { label: 'कम जोखिम / Low Risk', color: '#27AE60', bg: '#E8F8F0', icon: 'checkmark-circle' },
  caution: { label: 'सावधानी / Caution', color: '#F39C12', bg: '#FEF9E7', icon: 'warning' },
  high: { label: 'उच्च जोखिम / High Risk', color: '#D63031', bg: '#FFEBEE', icon: 'close-circle' },
};

export function ResultCard({ riskLevel, reasons, title }: ResultCardProps) {
  const config = RISK_CONFIG[riskLevel] ?? RISK_CONFIG.caution;

  return (
    <View style={[styles.card, { borderColor: config.color, backgroundColor: config.bg }]}>
      <View style={styles.header}>
        <Ionicons name={config.icon} size={28} color={config.color} />
        <View style={styles.headerText}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <Text style={[styles.riskLabel, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>
      {reasons.length > 0 && (
        <View style={styles.reasons}>
          {reasons.map((r, i) => (
            <Text key={i} style={styles.reason}>
              • {r}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: FONT.body,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  riskLabel: {
    fontSize: FONT.cardTitle,
    fontWeight: '700',
  },
  reasons: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  reason: {
    fontSize: FONT.bodySmall,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
});
