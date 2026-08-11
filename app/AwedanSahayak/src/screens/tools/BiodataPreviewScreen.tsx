import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { getBiodataDraftById } from '../../database/db';
import { generateBiodataPdf, shareBiodataPdf } from '../../services/biodataPdf';
import type { MarriageBiodataDraft } from '../../types/database';
import type { BiodataTemplateKey } from '../../utils/biodataTemplates';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { ExportActionBar } from '../../components/common/ExportActionBar';

type Props = NativeStackScreenProps<ToolsStackParamList, 'BiodataPreview'>;

/** Simple text preview of biodata fields. */
export default function BiodataPreviewScreen({ route }: Props) {
  const { draftId } = route.params;
  const [draft, setDraft] = useState<MarriageBiodataDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  useEffect(() => {
    getBiodataDraftById(draftId).then((d) => { setDraft(d); setLoading(false); });
  }, [draftId]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!draft) return <View style={styles.centered}><Text style={{ color: COLORS.textSecondary }}>ड्राफ्ट नहीं मिला।</Text></View>;

  const fields: { label: string; value: string | number | null }[] = [
    { label: 'नाम', value: draft.full_name },
    { label: 'जन्म तिथि', value: draft.dob },
    { label: 'आयु', value: draft.age },
    { label: 'ऊंचाई', value: draft.height },
    { label: 'लिंग', value: draft.gender },
    { label: 'धर्म', value: draft.religion },
    { label: 'जाति', value: draft.caste },
    { label: 'गोत्र', value: draft.gotra },
    { label: 'शिक्षा', value: draft.education },
    { label: 'व्यवसाय', value: draft.occupation },
    { label: 'आय', value: draft.income },
    { label: 'पिता', value: draft.father_name },
    { label: 'माता', value: draft.mother_name },
    { label: 'परिवार', value: draft.family_details },
    { label: 'पता', value: draft.address },
    { label: 'संपर्क', value: draft.contact_details },
    { label: 'भाई-बहन', value: draft.siblings },
    { label: 'शौक', value: draft.hobbies },
    { label: 'अपेक्षाएं', value: draft.expectations },
    { label: 'कुंडली', value: draft.horoscope_details },
  ].filter((f) => f.value);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const biodata: any = { ...draft, age: draft.age, photo_uri: draft.photo_uri };
      const res = await generateBiodataPdf(biodata, (draft.template_style || 'simple') as BiodataTemplateKey, draft.language || 'hi');
      setPdfUri(res.uri);
      Alert.alert('PDF तैयार', `बायोडाटा PDF सेव हो गया:\n${res.filename}`);
    } catch (e: any) {
      Alert.alert('त्रुटि', e?.message ?? 'PDF नहीं बन सका।');
    } finally {
      setExporting(false);
    }
  };

  const sharePdf = async () => {
    if (!pdfUri) { Alert.alert('पहले PDF बनाएं', 'कृपया पहले PDF एक्सपोर्ट करें।'); return; }
    await shareBiodataPdf(pdfUri, `Biodata_${draft.full_name ?? 'draft'}.pdf`);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.templateBadge}>
        <Text style={styles.templateText}>
          टेम्पलेट: {draft.template_style === 'simple' ? 'सरल' : draft.template_style === 'traditional' ? 'पारंपरिक' : draft.template_style === 'modern' ? 'आधुनिक' : 'फोटो'}
        </Text>
      </View>

      {fields.map((f, i) => (
        <View key={i} style={styles.field}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <Text style={styles.fieldValue}>{String(f.value ?? '')}</Text>
        </View>
      ))}

      <ExportActionBar
        actions={[
          { key: 'pdf', label: exporting ? '...' : 'PDF', icon: 'document-outline', onPress: exportPdf, color: COLORS.danger, loading: exporting },
          { key: 'share', label: 'शेयर', icon: 'share-outline', onPress: sharePdf, color: COLORS.info },
        ]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  templateBadge: {
    alignItems: 'center', marginVertical: SPACING.md,
    paddingVertical: 8, backgroundColor: '#FFF0ED', marginHorizontal: SPACING.pageHorizontal, borderRadius: RADIUS.sm,
  },
  templateText: { fontSize: FONT.caption, fontWeight: '600', color: COLORS.primary },
  field: {
    flexDirection: 'row', paddingHorizontal: SPACING.pageHorizontal, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  fieldLabel: { fontSize: FONT.bodySmall, fontWeight: '700', color: COLORS.textPrimary, width: 100 },
  fieldValue: { fontSize: FONT.bodySmall, color: COLORS.textTertiary, flex: 1 },
});
