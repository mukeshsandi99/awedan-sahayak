import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { getCourtPetitionById, updateCourtPetition } from '../../database/db';
import type { CourtPetitionDraft } from '../../types/database';
import { generateCourtPdf, shareCourtPdf, buildCourtPetitionText } from '../../services/courtPdf';
import { generateRtf, shareRtf } from '../../services/rtf';
import { COURT_PETITION_TYPES, COMMON_COURT_FIELDS, PLAINT_FIELDS, BAIL_FIELDS, COURT_DISCLAIMER } from '../../constants/courtPetitionTypes';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { ExportActionBar } from '../../components/common/ExportActionBar';
import * as Print from 'expo-print';

type Props = NativeStackScreenProps<ToolsStackParamList, 'CourtPetitionPreview'>;

export default function CourtPetitionPreviewScreen({ route }: Props) {
  const { petitionId } = route.params;
  const [petition, setPetition] = useState<CourtPetitionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    getCourtPetitionById(petitionId).then((p) => { setPetition(p); setLoading(false); });
  }, [petitionId]);

  const typeDef = useMemo(() => COURT_PETITION_TYPES.find((t) => t.key === petition?.petition_type), [petition]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!petition) return <View style={styles.centered}><Text style={{ color: COLORS.textSecondary }}>याचिका नहीं मिली।</Text></View>;

  // Build field map
  const fields: Record<string, string> = {};
  for (const f of COMMON_COURT_FIELDS) fields[f.key] = (petition as any)[f.key] ?? '';
  for (const f of PLAINT_FIELDS) fields[f.key] = (petition as any)[f.key] ?? '';
  for (const f of BAIL_FIELDS) fields[f.key] = (petition as any)[f.key] ?? '';

  const generatedText = petition.generated_text || buildCourtPetitionText(typeDef?.nameHindi ?? petition.petition_type, fields);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const textToExport = editing ? editText : generatedText;
      // Build HTML directly with the final text
      const { uri } = await Print.printToFileAsync({
        html: `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><style>
          body{font-family:serif;font-size:13px;line-height:2.0;color:#1a1a1a;padding:60px 56px 90px 56px;text-align:justify;}
          .watermark{text-align:center;font-size:10px;color:#bbb;margin-top:48px;padding-top:12px;border-top:1px solid #f0f0f0;}
        </style></head><body>${textToExport.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}<div class="watermark">Awedan Sahayak | M.M. Enterprises</div></body></html>`,
        width: 595, height: 842, base64: false,
      });
      const { uri: destUri, filename } = await generateCourtPdf(typeDef?.nameHindi ?? 'Court Petition', fields);
      await updateCourtPetition(petitionId, { generated_text: textToExport, pdf_path: destUri });
      setPetition({ ...petition, generated_text: textToExport, pdf_path: destUri });
      Alert.alert('PDF तैयार', `याचिका PDF सेव हो गई:\n${filename}`);
    } catch (e: any) {
      Alert.alert('त्रुटि', e?.message ?? 'PDF नहीं बन सका।');
    } finally {
      setExporting(false);
    }
  };

  const sharePdf = async () => {
    if (!petition.pdf_path) { Alert.alert('पहले PDF बनाएं'); return; }
    await shareCourtPdf(petition.pdf_path);
  };

  const [rtfUri, setRtfUri] = useState<string | null>(null);

  const exportRtf = async () => {
    try {
      const textToExport = editing ? editText : generatedText;
      const rtf = await generateRtf({
        generatedText: textToExport,
        applicationName: typeDef?.nameHindi ?? 'Court Petition',
        applicantName: petition.petitioner_name ?? undefined,
      });
      setRtfUri(rtf.uri);
      await updateCourtPetition(petitionId, { generated_text: textToExport });
      Alert.alert('Word/RTF तैयार', `याचिका RTF सेव हो गई:\n${rtf.filename}`);
    } catch (e: any) {
      Alert.alert('त्रुटि', e?.message ?? 'RTF नहीं बन सका।');
    }
  };

  const shareRtfDoc = async () => {
    if (!rtfUri) { Alert.alert('पहले RTF बनाएं'); return; }
    await shareRtf(rtfUri, `Court_${typeDef?.nameHindi ?? 'Petition'}.rtf`);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <DisclaimerBanner text={COURT_DISCLAIMER} type="danger" />

      {/* Petition info */}
      <View style={styles.infoRow}>
        <View style={styles.infoChip}>
          <Text style={styles.infoText}>{typeDef?.nameHindi ?? petition.petition_type}</Text>
        </View>
        {petition.reviewed_by_advocate === 1 && (
          <View style={[styles.infoChip, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
            <Text style={[styles.infoText, { color: COLORS.success }]}>Reviewed by Advocate</Text>
          </View>
        )}
      </View>

      {/* Editable text area */}
      <View style={styles.editorHeader}>
        <Text style={styles.editorTitle}>
          {editing ? 'टेक्स्ट एडिट करें' : 'याचिका टेक्स्ट'}
        </Text>
        <Ionicons
          name={editing ? 'close-circle' : 'create-outline'}
          size={24}
          color={COLORS.primary}
          onPress={() => {
            if (!editing) setEditText(generatedText);
            setEditing(!editing);
          }}
        />
      </View>

      {editing ? (
        <TextInput
          style={styles.editor}
          value={editText}
          onChangeText={setEditText}
          multiline
          textAlignVertical="top"
        />
      ) : (
        <View style={styles.previewBox}>
          <Text style={styles.previewText} selectable>{generatedText}</Text>
        </View>
      )}

      <ExportActionBar
        actions={[
          { key: 'pdf', label: exporting ? '...' : 'PDF', icon: 'document-outline', onPress: exportPdf, color: COLORS.primary, loading: exporting },
          { key: 'rtf', label: 'Word', icon: 'document-text-outline', onPress: exportRtf, color: COLORS.word },
          { key: 'share', label: 'शेयर', icon: 'share-outline', onPress: sharePdf, color: COLORS.info },
          { key: 'shareRtf', label: 'RTF शेयर', icon: 'share-outline', onPress: shareRtfDoc, color: COLORS.word },
        ]}
      />

      {/* Reviewed checkbox note */}
      {petition.reviewed_by_advocate === 0 && (
        <DisclaimerBanner
          text="⚠️ 'Reviewed by Advocate' चेकबॉक्स चेक नहीं है। दाखिल करने से पहले अधिवक्ता से जांच अवश्य कराएं।"
          type="warning"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  infoRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.pageHorizontal, marginVertical: SPACING.md, flexWrap: 'wrap' },
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF0ED', borderRadius: RADIUS.round,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  infoText: { fontSize: FONT.caption, fontWeight: '600', color: COLORS.primary },
  editorHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.sm,
  },
  editorTitle: { fontSize: FONT.body, fontWeight: '700', color: COLORS.textPrimary },
  editor: {
    borderWidth: 1, borderColor: COLORS.borderInput, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, fontSize: FONT.bodySmall,
    marginHorizontal: SPACING.pageHorizontal, backgroundColor: COLORS.card,
    color: COLORS.textPrimary, minHeight: 400, textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  previewBox: {
    backgroundColor: '#FFF', marginHorizontal: SPACING.pageHorizontal,
    borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.borderInput,
    minHeight: 300,
  },
  previewText: { fontSize: 12, color: COLORS.textPrimary, lineHeight: 22, textAlign: 'justify' },
});
