import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { getHandwritingDocumentById, updateHandwritingDocument } from '../../database/db';
import { generateHandwritingPdf, shareHandwritingPdf, type HandwritingOptions } from '../../services/handwritingPdf';
import type { HandwritingDocument } from '../../types/database';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { ExportActionBar } from '../../components/common/ExportActionBar';

type Props = NativeStackScreenProps<ToolsStackParamList, 'HandwritingPreview'>;

export default function HandwritingPreviewScreen({ route }: Props) {
  const { docId } = route.params;
  const [doc, setDoc] = useState<HandwritingDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  useEffect(() => {
    getHandwritingDocumentById(docId).then((d) => { setDoc(d); setLoading(false); });
  }, [docId]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.aiCleanup} /></View>;
  if (!doc) return <View style={styles.centered}><Text style={{ color: COLORS.textSecondary }}>दस्तावेज़ नहीं मिला।</Text></View>;

  const exportPdf = async () => {
    setExporting(true);
    try {
      const opts: HandwritingOptions = {
        text: doc.input_text,
        pageStyle: (doc.page_style as 'ruled' | 'plain' | 'notebook') || 'ruled',
        inkColor: (doc.ink_color as 'blue' | 'black') || 'blue',
        fontSize: doc.font_size || 18,
        lineSpacing: doc.line_spacing || 1.8,
        pageMargin: doc.page_margin || 40,
        watermarkEnabled: doc.watermark_enabled === 1,
        language: doc.language || 'hi',
      };
      const res = await generateHandwritingPdf(opts);
      setPdfUri(res.uri);
      await updateHandwritingDocument(docId, { pdf_path: res.uri });
      Alert.alert('PDF तैयार', `हस्तलिखित PDF सेव हो गया:\n${res.filename}`);
    } catch (e: any) {
      Alert.alert('त्रुटि', e?.message ?? 'PDF नहीं बन सका।');
    } finally {
      setExporting(false);
    }
  };

  const sharePdf = async () => {
    if (!pdfUri && !doc.pdf_path) { Alert.alert('पहले PDF बनाएं'); return; }
    await shareHandwritingPdf(pdfUri ?? doc.pdf_path!);
  };

  // Render a preview of the text with styles
  const inkHex = doc.ink_color === 'black' ? '#1A1A1A' : '#003C8F';
  const lineH = doc.font_size * doc.line_spacing;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {/* Style info */}
      <View style={styles.infoRow}>
        <View style={styles.infoChip}><Text style={styles.infoText}>📄 {doc.page_style === 'ruled' ? 'लाइन' : doc.page_style === 'plain' ? 'सादा' : 'कॉपी'}</Text></View>
        <View style={styles.infoChip}><Text style={styles.infoText}>🖊️ {doc.ink_color === 'blue' ? 'नीला' : 'काला'}</Text></View>
        <View style={styles.infoChip}><Text style={styles.infoText}>Aa {doc.font_size}px</Text></View>
      </View>

      {/* Text preview */}
      <View style={[styles.previewPage, { backgroundColor: doc.page_style === 'ruled' ? '#FCFCFC' : '#FFF' }]}>
        <Text style={[styles.previewText, {
          fontSize: doc.font_size,
          lineHeight: lineH,
          color: inkHex,
        }]}>
          {doc.input_text}
        </Text>
      </View>

      {doc.watermark_enabled === 1 && (
        <Text style={styles.watermarkNote}>
          ℹ️ "Computer-generated handwriting" वॉटरमार्क जोड़ा जाएगा।
        </Text>
      )}

      <ExportActionBar
        actions={[
          { key: 'pdf', label: exporting ? '...' : 'PDF', icon: 'document-outline', onPress: exportPdf, color: COLORS.aiCleanup, loading: exporting },
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
  infoRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.pageHorizontal, marginVertical: SPACING.md },
  infoChip: {
    backgroundColor: '#F0E8F8', borderRadius: RADIUS.round,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  infoText: { fontSize: FONT.caption, color: COLORS.aiCleanup, fontWeight: '600' },
  previewPage: {
    marginHorizontal: SPACING.pageHorizontal,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.borderInput,
    minHeight: 300,
  },
  previewText: { textAlign: 'justify' },
  watermarkNote: {
    fontSize: FONT.micro, color: COLORS.textSecondary, textAlign: 'center',
    marginTop: SPACING.md, fontStyle: 'italic',
  },
});
