import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { ToolTile } from '../../components/common/ToolTile';
import { COLORS, FONT, SPACING } from '../../constants/theme';

type Props = NativeStackScreenProps<ToolsStackParamList, 'ToolsHome'>;

export default function ToolsHomeScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>उपकरण</Text>
        <Text style={styles.subtitle}>Tools & Utilities</Text>
      </View>

      {/* ── सुरक्षा उपकरण ─────────────────────────────── */}
      <Text style={styles.sectionTitle}>🔒 सुरक्षा उपकरण</Text>
      <View style={styles.tileRow}>
        <ToolTile title="सुरक्षा\nजांच" icon="shield-checkmark" color={COLORS.danger} onPress={() => navigation.navigate('ScamCheck')} />
        <ToolTile title="बारकोड\nस्कैनर" icon="scan-outline" color="#2D3436" onPress={() => navigation.navigate('BarcodeScanner')} />
      </View>

      {/* ── उपयोगी उपकरण ──────────────────────────────── */}
      <Text style={styles.sectionTitle}>🛠️ उपयोगी उपकरण</Text>
      <View style={styles.tileRow}>
        <ToolTile title="बायोडाटा\nमेकर" icon="people" color="#E84393" onPress={() => navigation.navigate('BiodataForm', {})} />
        <ToolTile title="CGPA\nकैलकुलेटर" icon="calculator" color="#0984E3" onPress={() => navigation.navigate('CgpaCalculator')} />
        <ToolTile title="हस्तलिखित\nटेक्स्ट" icon="create" color="#6C5CE7" onPress={() => navigation.navigate('HandwritingInput', {})} />
      </View>
      <View style={styles.tileRow}>
        <ToolTile title="बारकोड\nजनरेटर" icon="qr-code" color="#00B894" onPress={() => navigation.navigate('BarcodeGenerator')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 32 },
  header: { paddingTop: 60, paddingHorizontal: SPACING.pageHorizontal, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: FONT.bodySmall, color: COLORS.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: FONT.body,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.pageHorizontal,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: SPACING.pageHorizontal,
    marginBottom: 4,
  },
});
