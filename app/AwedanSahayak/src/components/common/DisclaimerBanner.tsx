import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

interface DisclaimerBannerProps {
  text: string;
  type?: 'warning' | 'info' | 'danger';
}

export function DisclaimerBanner({ text, type = 'warning' }: DisclaimerBannerProps) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    warning: { bg: '#FFF3CD', border: '#FFC107', text: '#856404' },
    info: { bg: '#E3F2FD', border: '#2196F3', text: '#0D47A1' },
    danger: { bg: '#FFEBEE', border: '#F44336', text: '#B71C1C' },
  };
  const c = colors[type] ?? colors.warning;

  return (
    <View style={[styles.banner, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    marginHorizontal: SPACING.pageHorizontal,
    marginBottom: SPACING.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    fontSize: FONT.micro,
    lineHeight: 16,
    textAlign: 'center',
  },
});
