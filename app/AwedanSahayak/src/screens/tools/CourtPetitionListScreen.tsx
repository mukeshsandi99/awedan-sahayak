import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { COURT_PETITION_TYPES, COURT_DISCLAIMER, type CourtPetitionTypeDef } from '../../constants/courtPetitionTypes';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';

type Props = NativeStackScreenProps<ToolsStackParamList, 'CourtPetitionList'>;

const CATEGORY_NAMES: Record<string, { hi: string; en: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  bail: { hi: 'जमानत याचिकाएं', en: 'Bail Petitions', icon: 'lock-open', color: '#E17055' },
  petition: { hi: 'याचिकाएं', en: 'Petitions', icon: 'document-text', color: '#6C5CE7' },
  plaint: { hi: 'वाद पत्र', en: 'Plaints', icon: 'reader', color: '#0984E3' },
  application: { hi: 'आवेदन', en: 'Applications', icon: 'clipboard', color: '#00B894' },
  undertaking: { hi: 'शपथ पत्र', en: 'Undertaking', icon: 'hand-right', color: '#F39C12' },
};

export default function CourtPetitionListScreen({ navigation }: Props) {
  const grouped = new Map<string, CourtPetitionTypeDef[]>();
  for (const pt of COURT_PETITION_TYPES) {
    const arr = grouped.get(pt.category) ?? [];
    arr.push(pt);
    grouped.set(pt.category, arr);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <DisclaimerBanner text={COURT_DISCLAIMER} type="danger" />

      {Array.from(grouped.entries()).map(([category, types]) => {
        const cat = CATEGORY_NAMES[category] ?? { hi: category, en: '', icon: 'document' as const, color: COLORS.textSecondary };
        return (
          <View key={category} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={cat.icon} size={22} color={cat.color} />
              <View>
                <Text style={styles.sectionTitle}>{cat.hi}</Text>
                <Text style={styles.sectionSub}>{cat.en}</Text>
              </View>
            </View>
            {types.map((pt) => (
              <TouchableOpacity
                key={pt.key}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('CourtPetitionForm', { petitionType: pt.key, petitionName: pt.nameHindi })}
              >
                <View style={styles.cardLeft}>
                  <Text style={styles.cardName}>{pt.nameHindi}</Text>
                  <Text style={styles.cardEng}>{pt.nameEnglish}</Text>
                  <Text style={styles.cardDesc}>{pt.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#CCC" />
              </TouchableOpacity>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  section: { marginTop: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.sm,
  },
  sectionTitle: { fontSize: FONT.body, fontWeight: '700', color: COLORS.textPrimary },
  sectionSub: { fontSize: FONT.caption, color: COLORS.textSecondary },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, marginHorizontal: SPACING.pageHorizontal,
    marginBottom: SPACING.sm, borderRadius: RADIUS.md, padding: SPACING.md,
    gap: 10,
  },
  cardLeft: { flex: 1 },
  cardName: { fontSize: FONT.bodySmall, fontWeight: '700', color: COLORS.textPrimary },
  cardEng: { fontSize: FONT.caption, color: COLORS.textSecondary, marginTop: 2 },
  cardDesc: { fontSize: FONT.micro, color: COLORS.textTertiary, marginTop: 4, lineHeight: 15 },
});
