import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { insertCourtPetition } from '../../database/db';
import type { CourtPetitionDraftInsert } from '../../types/database';
import {
  COURT_PETITION_TYPES,
  COMMON_COURT_FIELDS,
  PLAINT_FIELDS,
  BAIL_FIELDS,
  COURT_DISCLAIMER,
} from '../../constants/courtPetitionTypes';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';

type Props = NativeStackScreenProps<ToolsStackParamList, 'CourtPetitionForm'>;

export default function CourtPetitionFormScreen({ navigation, route }: Props) {
  const { petitionType, petitionName } = route.params;
  const typeDef = useMemo(() => COURT_PETITION_TYPES.find((t) => t.key === petitionType), [petitionType]);

  // Build initial form state from all relevant fields
  const allFields = useMemo(() => {
    const fields: string[] = [...COMMON_COURT_FIELDS.map((f) => f.key)];
    if (typeDef?.category === 'plaint') fields.push(...PLAINT_FIELDS.map((f) => f.key));
    if (typeDef?.category === 'bail') fields.push(...BAIL_FIELDS.map((f) => f.key));
    if (typeDef?.specificFields) {
      for (const sf of typeDef.specificFields) {
        if (!fields.includes(sf)) fields.push(sf);
      }
    }
    return [...new Set(fields)];
  }, [typeDef]);

  const initialState: Record<string, string> = {};
  for (const f of allFields) initialState[f] = '';

  const [form, setForm] = useState<Record<string, string>>(initialState);
  const [reviewedByAdvocate, setReviewedByAdvocate] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  // Get label for a field key
  const getLabel = useCallback((key: string): { hi: string; en: string } => {
    const common = COMMON_COURT_FIELDS.find((f) => f.key === key);
    if (common) return { hi: common.labelHindi, en: common.labelEnglish };
    const plaint = PLAINT_FIELDS.find((f) => f.key === key);
    if (plaint) return { hi: plaint.labelHindi, en: plaint.labelEnglish };
    const bail = BAIL_FIELDS.find((f) => f.key === key);
    if (bail) return { hi: bail.labelHindi, en: bail.labelEnglish };
    return { hi: key, en: key };
  }, []);

  const isRequired = (key: string): boolean => {
    return typeDef?.requiredFields?.includes(key) ?? false;
  };

  const isFieldVisible = (key: string): boolean => {
    // Show all common fields, and type-specific fields
    if (COMMON_COURT_FIELDS.some((f) => f.key === key)) return true;
    if (typeDef?.category === 'plaint' && PLAINT_FIELDS.some((f) => f.key === key)) return true;
    if (typeDef?.category === 'bail' && BAIL_FIELDS.some((f) => f.key === key)) return true;
    if (typeDef?.specificFields?.includes(key)) return true;
    // Show bail fields if any are in specificFields
    if (BAIL_FIELDS.some((f) => f.key === key) && typeDef?.specificFields?.includes(key)) return true;
    return false;
  };

  const visibleFields = allFields.filter(isFieldVisible);

  const saveAndPreview = async () => {
    // Check required fields
    const missing = (typeDef?.requiredFields ?? []).filter((k) => !form[k]?.trim());
    if (missing.length > 0) {
      const labels = missing.map((k) => getLabel(k).hi).join(', ');
      Alert.alert('आवश्यक फील्ड खाली', `कृपया ये फील्ड भरें:\n${labels}`);
      return;
    }

    setSaving(true);
    try {
      const insert: CourtPetitionDraftInsert = {
        petition_type: petitionType,
        court_name: form.court_name || null,
        district: form.district || null,
        case_type: form.case_type || null,
        case_number: form.case_number || null,
        year: form.year || null,
        petitioner_name: form.petitioner_name || null,
        respondent_name: form.respondent_name || null,
        advocate_name: form.advocate_name || null,
        police_station: form.police_station || null,
        fir_number: form.fir_number || null,
        sections_of_law: form.sections_of_law || null,
        date_of_occurrence: form.date_of_occurrence || null,
        custody_date: form.custody_date || null,
        facts_of_case: form.facts_of_case || null,
        grounds: form.grounds || null,
        prayer: form.prayer || null,
        verification_text: form.verification_text || null,
        place: form.place || null,
        date: form.date || null,
        cause_of_action: form.cause_of_action || null,
        jurisdiction: form.jurisdiction || null,
        valuation: form.valuation || null,
        court_fee: form.court_fee || null,
        property_schedule: form.property_schedule || null,
        relief_sought: form.relief_sought || null,
        limitation_statement: form.limitation_statement || null,
        document_list: form.document_list || null,
        criminal_history: form.criminal_history || null,
        cooperation_assurance: form.cooperation_assurance || null,
        flight_risk_statement: form.flight_risk_statement || null,
        evidence_tampering_assurance: form.evidence_tampering_assurance || null,
        medical_family_grounds: form.medical_family_grounds || null,
        co_accused_parity: form.co_accused_parity || null,
        reviewed_by_advocate: reviewedByAdvocate ? 1 : 0,
        is_draft: 1,
        generated_text: null,
        pdf_path: null,
      };

      const saved = await insertCourtPetition(insert);
      navigation.navigate('CourtPetitionPreview', { petitionId: saved.id });
    } catch (e: any) {
      Alert.alert('त्रुटि', e?.message ?? 'याचिका सेव नहीं हो सकी।');
    } finally {
      setSaving(false);
    }
  };

  const isLongField = (key: string): boolean => {
    return ['facts_of_case', 'grounds', 'prayer', 'verification_text',
      'property_schedule', 'relief_sought', 'document_list', 'criminal_history',
      'cooperation_assurance', 'flight_risk_statement', 'evidence_tampering_assurance',
      'medical_family_grounds', 'co_accused_parity', 'limitation_statement',
      'cause_of_action', 'jurisdiction'].includes(key);
  };

  if (!typeDef) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: COLORS.textSecondary }}>याचिका प्रकार नहीं मिला।</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <DisclaimerBanner text={COURT_DISCLAIMER} type="danger" />

      {/* Form fields */}
      {visibleFields.map((key) => {
        const label = getLabel(key);
        const req = isRequired(key);
        const long = isLongField(key);

        return (
          <View key={key} style={styles.fieldGroup}>
            <Text style={styles.label}>
              {label.hi}{req ? ' *' : ''}
              <Text style={styles.labelEn}>  ({label.en}{req ? ' *' : ''})</Text>
            </Text>
            <TextInput
              style={[styles.input, long && styles.textArea]}
              value={form[key]}
              onChangeText={(t) => update(key, t)}
              placeholder={req ? '(आवश्यक)' : '(वैकल्पिक)'}
              placeholderTextColor="#DDD"
              multiline={long}
              textAlignVertical={long ? 'top' : 'center'}
            />
          </View>
        );
      })}

      {/* Reviewed by Advocate checkbox */}
      <TouchableOpacity style={styles.checkboxRow} onPress={() => setReviewedByAdvocate(!reviewedByAdvocate)}>
        <Ionicons name={reviewedByAdvocate ? 'checkbox' : 'square-outline'} size={22} color={reviewedByAdvocate ? COLORS.success : '#CCC'} />
        <Text style={styles.checkboxText}>
          Reviewed by Advocate / अधिवक्ता द्वारा समीक्षित
        </Text>
      </TouchableOpacity>

      {/* Action */}
      <TouchableOpacity style={styles.saveBtn} onPress={saveAndPreview} disabled={saving} activeOpacity={0.7}>
        <Ionicons name="document-text-outline" size={20} color="#FFF" />
        <Text style={styles.saveBtnText}>
          {saving ? 'सेव हो रहा है...' : 'याचिका तैयार करें और प्रीव्यू देखें'}
        </Text>
      </TouchableOpacity>

      <DisclaimerBanner
        text="⚠️ कोई भी कानूनी धारा/सेक्शन, केस नंबर या मिसाल अपने आप नहीं जोड़ी जाती। सभी जानकारी आपको स्वयं भरनी है।"
        type="warning"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  fieldGroup: { paddingHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.sm },
  label: { fontSize: FONT.caption, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  labelEn: { fontWeight: '400', color: COLORS.textSecondary, fontSize: FONT.micro },
  input: {
    borderWidth: 1, borderColor: COLORS.borderInput, borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: FONT.bodySmall,
    backgroundColor: COLORS.card, color: COLORS.textPrimary,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  checkboxRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.pageHorizontal, marginVertical: SPACING.lg,
  },
  checkboxText: { fontSize: FONT.bodySmall, color: COLORS.textPrimary, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, marginHorizontal: SPACING.pageHorizontal,
    borderRadius: RADIUS.md, paddingVertical: 16, marginBottom: SPACING.lg,
  },
  saveBtnText: { fontSize: FONT.body, fontWeight: '700', color: '#FFF' },
});
