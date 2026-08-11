import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { insertHandwritingDocument, getApplicationsWithDetails } from '../../database/db';
import type { ApplicationListItem } from '../../database/db';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';

type Props = NativeStackScreenProps<ToolsStackParamList, 'HandwritingInput'>;

export default function HandwritingInputScreen({ navigation }: Props) {
  const [text, setText] = useState('');
  const [pageStyle, setPageStyle] = useState<'ruled' | 'plain' | 'notebook'>('ruled');
  const [inkColor, setInkColor] = useState<'blue' | 'black'>('blue');
  const [fontSize, setFontSize] = useState(18);
  const [lineSpacing, setLineSpacing] = useState(1.8);
  const [watermark, setWatermark] = useState(true);

  // Import modal state
  const [importVisible, setImportVisible] = useState(false);
  const [importApps, setImportApps] = useState<ApplicationListItem[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  const openImport = useCallback(async () => {
    setImportVisible(true);
    setImportLoading(true);
    try {
      const apps = await getApplicationsWithDetails();
      setImportApps(apps.filter((a) => a.generated_text && a.generated_text.length > 0));
    } catch {
      setImportApps([]);
    } finally {
      setImportLoading(false);
    }
  }, []);

  const selectImport = useCallback((app: ApplicationListItem) => {
    setText((prev) => {
      const sep = prev.trim() ? '\n\n---\n\n' : '';
      return prev + sep + (app.generated_text ?? '');
    });
    setImportVisible(false);
  }, []);

  const goPreview = async () => {
    if (!text.trim()) { Alert.alert('टेक्स्ट खाली', 'कृपया टेक्स्ट डालें।'); return; }
    try {
      const doc = await insertHandwritingDocument({
        title: `हस्तलिखित ${new Date().toLocaleDateString('hi-IN')}`,
        input_text: text.trim(),
        page_style: pageStyle,
        ink_color: inkColor,
        font_size: fontSize,
        line_spacing: lineSpacing,
        page_margin: 40,
        watermark_enabled: watermark ? 1 : 0,
        language: 'hi',
        pdf_path: null,
        image_path: null,
      });
      navigation.navigate('HandwritingPreview', { docId: doc.id });
    } catch (e: any) {
      Alert.alert('त्रुटि', e?.message ?? 'दस्तावेज़ सेव नहीं हो सका।');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <DisclaimerBanner
        text="कंप्यूटर-जनित हैंडराइटिंग — यह वास्तविक हस्तलिखित दस्तावेज़ नहीं है।"
        type="info"
      />

      {/* Page style */}
      <Text style={styles.label}>पेज स्टाइल</Text>
      <View style={styles.chipRow}>
        {(['ruled', 'plain', 'notebook'] as const).map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, pageStyle === s && styles.chipActive]} onPress={() => setPageStyle(s)}>
            <Text style={[styles.chipText, pageStyle === s && styles.chipTextActive]}>
              {s === 'ruled' ? 'लाइन' : s === 'plain' ? 'सादा' : 'कॉपी'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ink color */}
      <Text style={styles.label}>इंक कलर</Text>
      <View style={styles.chipRow}>
        {(['blue', 'black'] as const).map((c) => (
          <TouchableOpacity key={c} style={[styles.chip, inkColor === c && styles.chipActive]} onPress={() => setInkColor(c)}>
            <View style={[styles.inkDot, { backgroundColor: c === 'blue' ? '#003C8F' : '#1A1A1A' }]} />
            <Text style={[styles.chipText, inkColor === c && styles.chipTextActive]}>
              {c === 'blue' ? 'नीला' : 'काला'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Font size */}
      <Text style={styles.label}>फॉन्ट साइज: {fontSize}</Text>
      <View style={styles.chipRow}>
        {[14, 16, 18, 20, 22, 24].map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, fontSize === s && styles.chipActive]} onPress={() => setFontSize(s)}>
            <Text style={[styles.chipText, fontSize === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Line spacing */}
      <Text style={styles.label}>लाइन स्पेसिंग: {lineSpacing.toFixed(1)}x</Text>
      <View style={styles.chipRow}>
        {[1.3, 1.5, 1.8, 2.0, 2.2, 2.5].map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, lineSpacing === s && styles.chipActive]} onPress={() => setLineSpacing(s)}>
            <Text style={[styles.chipText, lineSpacing === s && styles.chipTextActive]}>{s.toFixed(1)}x</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Watermark */}
      <TouchableOpacity style={styles.watermarkToggle} onPress={() => setWatermark(!watermark)}>
        <Ionicons name={watermark ? 'checkbox' : 'square-outline'} size={20} color={COLORS.primary} />
        <Text style={styles.watermarkText}>
          "Computer-generated handwriting" वॉटरमार्क जोड़ें (अनुशंसित)
        </Text>
      </TouchableOpacity>

      {/* Import from generated application */}
      <TouchableOpacity style={styles.importBtn} onPress={openImport}>
        <Ionicons name="document-text-outline" size={18} color={COLORS.aiCleanup} />
        <Text style={styles.importText}>जनरेटेड आवेदन से इंपोर्ट करें</Text>
      </TouchableOpacity>

      {/* Import Application Modal */}
      <Modal visible={importVisible} animationType="slide" onRequestClose={() => setImportVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>आवेदन चुनें</Text>
            <TouchableOpacity onPress={() => setImportVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          {importLoading ? (
            <ActivityIndicator size="large" color={COLORS.aiCleanup} style={{ marginTop: 40 }} />
          ) : importApps.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Ionicons name="document-outline" size={48} color="#CCC" />
              <Text style={styles.modalEmptyText}>कोई जनरेटेड आवेदन नहीं</Text>
              <Text style={styles.modalEmptySub}>पहले होम स्क्रीन से आवेदन जनरेट करें</Text>
            </View>
          ) : (
            <FlatList
              data={importApps}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const preview = (item.generated_text ?? '').substring(0, 120).replace(/\n/g, ' ');
                return (
                  <TouchableOpacity style={styles.importItem} onPress={() => selectImport(item)}>
                    <View style={styles.importItemLeft}>
                      <Text style={styles.importItemTitle} numberOfLines={1}>
                        {item.type_name_hindi ?? item.custom_office_name ?? 'आवेदन'}
                      </Text>
                      <Text style={styles.importItemPreview} numberOfLines={2}>{preview}...</Text>
                      <Text style={styles.importItemDate}>
                        {new Date(item.created_at + 'Z').toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={22} color={COLORS.aiCleanup} />
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          )}
        </View>
      </Modal>

      {/* Text input */}
      <Text style={styles.label}>टेक्स्ट डालें</Text>
      <TextInput
        style={styles.textInput}
        value={text}
        onChangeText={setText}
        placeholder="अपना टेक्स्ट यहां टाइप या पेस्ट करें... हिंदी और English दोनों समर्थित हैं।"
        placeholderTextColor="#CCC"
        multiline
        textAlignVertical="top"
      />

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.previewBtn} onPress={goPreview}>
          <Ionicons name="eye-outline" size={20} color="#FFF" />
          <Text style={styles.previewText}>प्रीव्यू और एक्सपोर्ट</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.previewBtn, { backgroundColor: COLORS.textSecondary }]} onPress={() => navigation.navigate('HandwritingHistory')}>
          <Ionicons name="folder-open-outline" size={20} color="#FFF" />
          <Text style={styles.previewText}>दस्तावेज़</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  label: { fontSize: FONT.bodySmall, fontWeight: '600', color: COLORS.textPrimary, paddingHorizontal: SPACING.pageHorizontal, marginBottom: 6, marginTop: SPACING.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.round,
    borderWidth: 1, borderColor: COLORS.borderInput, backgroundColor: COLORS.card,
  },
  chipActive: { backgroundColor: COLORS.aiCleanup, borderColor: COLORS.aiCleanup },
  chipText: { fontSize: FONT.caption, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFF' },
  inkDot: { width: 14, height: 14, borderRadius: 7 },
  watermarkToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.pageHorizontal, marginVertical: SPACING.md },
  watermarkText: { fontSize: FONT.caption, color: COLORS.textTertiary, flex: 1 },
  importBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.md,
    paddingVertical: 10, backgroundColor: '#F0E8FF', borderRadius: RADIUS.sm,
    marginHorizontal: SPACING.pageHorizontal,
  },
  importText: { fontSize: FONT.caption, color: COLORS.aiCleanup, fontWeight: '600' },
  textInput: {
    borderWidth: 1, borderColor: COLORS.borderInput, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 12, fontSize: FONT.body,
    marginHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.lg,
    backgroundColor: COLORS.card, color: COLORS.textPrimary,
    minHeight: 200, fontFamily: 'NotoSansDevanagari',
  },
  // Import modal styles
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontSize: FONT.sectionTitle, fontWeight: '700', color: COLORS.textPrimary },
  modalEmpty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  modalEmptyText: { fontSize: FONT.body, fontWeight: '600', color: '#AAA', marginTop: 12 },
  modalEmptySub: { fontSize: FONT.caption, color: '#CCC', marginTop: 4 },
  importItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: RADIUS.md, padding: 14, marginBottom: 8, gap: 10,
  },
  importItemLeft: { flex: 1 },
  importItemTitle: { fontSize: FONT.bodySmall, fontWeight: '700', color: COLORS.textPrimary },
  importItemPreview: { fontSize: FONT.caption, color: COLORS.textSecondary, marginTop: 4 },
  importItemDate: { fontSize: FONT.micro, color: '#BBB', marginTop: 4 },
  // end modal styles
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.pageHorizontal },
  previewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.aiCleanup, borderRadius: RADIUS.md, paddingVertical: 14,
  },
  previewText: { fontSize: FONT.body, fontWeight: '700', color: '#FFF' },
});
