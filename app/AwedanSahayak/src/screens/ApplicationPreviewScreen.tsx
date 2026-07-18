/**
 * ApplicationPreviewScreen — displays the AI-generated Hindi application.
 *
 * Shows the formal application text in a clean, readable, scrollable format.
 * Provides actions:
 *   - "दोबारा बनाएं" — go back to edit the form
 *   - "PDF बनाएं" — generate a styled PDF
 *   - "साझा करें" — share text or PDF via WhatsApp etc.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { generatePdf, sharePdf, isSaveSupported } from '../services/pdf';
import { generateRtf, shareRtf } from '../services/rtf';
import { scheduleReminder, cancelScheduledReminder } from '../services/reminders';
import { updateGeneratedApplication, getGeneratedApplicationById } from '../database/db';

// ── Types ───────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'ApplicationPreview'>;

export interface ApplicationPreviewContentProps {
  applicationName: string;
  generatedText: string;
  officeType: string;
  onGoBack: () => void;
  /** The saved application ID, used for reminder scheduling. */
  savedApplicationId?: number | null;
  /** Whether this is viewed from MyApplications (shows cancel option). */
  isFromMyApps?: boolean;
}

// ── Reminder options ──────────────────────────────────────────────────

const REMINDER_OPTIONS = [
  { days: 7, label: '7 दिन बाद' },
  { days: 15, label: '15 दिन बाद (अनुशंसित)' },
  { days: 30, label: '30 दिन बाद' },
];

// ── Shared content component ──────────────────────────────────────────

export function ApplicationPreviewContent({
  applicationName,
  generatedText,
  officeType,
  onGoBack,
  savedApplicationId,
  isFromMyApps,
}: ApplicationPreviewContentProps) {

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('');

  const [rtfGenerating, setRtfGenerating] = useState(false);
  const [rtfUri, setRtfUri] = useState<string | null>(null);
  const [rtfFilename, setRtfFilename] = useState<string>('');

  // ── Reminder state ──────────────────────────────────────────────

  const [reminderSet, setReminderSet] = useState(false);
  const [reminderDays, setReminderDays] = useState<number | null>(null);
  const [reminderScheduling, setReminderScheduling] = useState(false);
  const [notifId, setNotifId] = useState<string | null>(null);

  // ── Copy text to clipboard ──────────────────────────────────────

  const handleCopy = useCallback(() => {
    Alert.alert(
      '✅ कॉपी किया गया',
      'आवेदन पाठ क्लिपबोर्ड पर कॉपी कर दिया गया है।\n\nThe application text has been copied.',
    );
  }, []);

  // ── Reminder scheduling ──────────────────────────────────────────

  const officeName = getOfficeLabel(officeType);

  const handleScheduleReminder = useCallback(async (days: number) => {
    if (reminderScheduling) return;
    setReminderScheduling(true);
    try {
      const result = await scheduleReminder(applicationName, officeName, days);
      if (result) {
        setReminderSet(true);
        setReminderDays(days);
        setNotifId(result.notificationId);
        // Update the DB row with reminder info
        if (savedApplicationId) {
          await updateGeneratedApplication(savedApplicationId, {
            reminder_date: result.reminderDate,
            notification_id: result.notificationId,
            reminder_days: days,
          } as any);
        }
        Alert.alert('✅ याद दिलाना सेट हो गया', `${days} दिन बाद आपको सूचना मिलेगी।\n\nReminder set for ${days} days from now.`);
      }
    } catch (err: any) {
      console.error('[Reminder] Schedule failed:', err?.message);
    } finally {
      setReminderScheduling(false);
    }
  }, [reminderScheduling, applicationName, officeName, savedApplicationId]);

  const handleCancelReminder = useCallback(async () => {
    await cancelScheduledReminder(notifId, savedApplicationId ?? 0);
    setReminderSet(false);
    setReminderDays(null);
    setNotifId(null);
    Alert.alert('🔕 याद दिलाना रद्द हुआ', 'अब आपको इस आवेदन के लिए सूचना नहीं मिलेगी।\n\nReminder cancelled.');
  }, [notifId, savedApplicationId]);

  // ── Share as plain text ─────────────────────────────────────────

  const handleShareText = useCallback(async () => {
    try {
      await Share.share({
        title: applicationName,
        message: generatedText,
      });
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('शेयर त्रुटि', 'शेयर करने में समस्या आई।\n\nSharing failed.');
      }
    }
  }, [applicationName, generatedText]);

  // ── Generate PDF ────────────────────────────────────────────────

  const handleGeneratePdf = useCallback(async () => {
    if (pdfGenerating) return;
    setPdfGenerating(true);

    try {
      const result = await generatePdf({
        generatedText,
        applicationName,
        officeType,
      });
      setPdfUri(result.uri);
      setPdfFilename(result.filename);
      Alert.alert(
        '✅ PDF तैयार',
        `PDF file created:\n${result.filename}\n\nअब आप इसे शेयर या सेव कर सकते हैं।`,
      );
    } catch (err: any) {
      console.error('[ApplicationPreview] PDF generation failed:', err?.message);
      Alert.alert(
        '❌ PDF त्रुटि',
        'PDF बनाने में समस्या आई। कृपया पुनः प्रयास करें।\n\n' +
          (err?.message ?? 'PDF generation failed.'),
      );
    } finally {
      setPdfGenerating(false);
    }
  }, [pdfGenerating, generatedText, applicationName, officeType]);

  // ── Share PDF ───────────────────────────────────────────────────

  const handleSharePdf = useCallback(async () => {
    if (!pdfUri) {
      // PDF not generated yet — generate first, then share
      Alert.alert(
        'PDF बनाएं',
        'पहले PDF बनाएं, फिर शेयर करें।\n\nGenerate the PDF first, then share.',
      );
      return;
    }
    try {
      await sharePdf(pdfUri, pdfFilename);
    } catch (err: any) {
      console.error('[ApplicationPreview] PDF share failed:', err?.message);
    }
  }, [pdfUri, pdfFilename]);

  // ── Save PDF locally ────────────────────────────────────────────

  const handleSavePdf = useCallback(() => {
    if (!pdfUri) {
      Alert.alert(
        'PDF बनाएं',
        'पहले PDF बनाएं, फिर सेव करें।\n\nGenerate the PDF first, then save.',
      );
      return;
    }
    Alert.alert(
      '✅ PDF सेव हो गया',
      `PDF file saved to:\n${pdfUri}\n\nआप इसे फ़ाइल मैनेजर में देख सकते हैं।\n\nYou can find it in your file manager.`,
    );
  }, [pdfUri]);

  // ── Generate RTF (Word document) ────────────────────────────────

  const handleGenerateRtf = useCallback(async () => {
    if (rtfGenerating) return;
    setRtfGenerating(true);

    try {
      const result = await generateRtf({
        generatedText,
        applicationName,
      });
      setRtfUri(result.uri);
      setRtfFilename(result.filename);
      Alert.alert(
        '✅ Word डॉक्यूमेंट तैयार',
        `RTF file created:\n${result.filename}\n\nअब आप इसे शेयर या सेव कर सकते हैं।\nOpens in Word, Google Docs & WPS Office.`,
      );
    } catch (err: any) {
      console.error('[ApplicationPreview] RTF generation failed:', err?.message);
      Alert.alert(
        '❌ Word त्रुटि',
        'डॉक्यूमेंट बनाने में समस्या आई।\n\n' + (err?.message ?? 'RTF generation failed.'),
      );
    } finally {
      setRtfGenerating(false);
    }
  }, [rtfGenerating, generatedText, applicationName]);

  // ── Share RTF ───────────────────────────────────────────────────

  const handleShareRtf = useCallback(async () => {
    if (!rtfUri) {
      Alert.alert('Word बनाएं', 'पहले Word डॉक्यूमेंट बनाएं, फिर शेयर करें।');
      return;
    }
    try {
      await shareRtf(rtfUri, rtfFilename);
    } catch (err: any) {
      console.error('[ApplicationPreview] RTF share failed:', err?.message);
    }
  }, [rtfUri, rtfFilename]);

  // ── Render ──────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerInfo}>
          <Ionicons name="document-text" size={22} color="#E17055" />
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {applicationName}
            </Text>
            <Text style={styles.headerSubtitle}>
              {getOfficeLabel(officeType)}
            </Text>
          </View>
        </View>
        {pdfUri && (
          <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
        )}
      </View>

      {/* Application text */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.textCard}>
          <Text style={styles.applicationText} selectable>
            {generatedText}
          </Text>
        </View>
      </ScrollView>

      {/* Action bar */}
      <View style={styles.actionBar}>
        {/* Row 0: Reminder selector (only for new applications, not from MyApps) */}
        {savedApplicationId && !isFromMyApps && !reminderSet && (
          <View style={styles.reminderRow}>
            <Ionicons name="notifications-outline" size={18} color="#E17055" />
            <Text style={styles.reminderLabel}>कब याद दिलाएं?</Text>
            <View style={styles.reminderOptions}>
              {REMINDER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.days}
                  style={[styles.reminderChip, reminderScheduling && styles.reminderChipDisabled]}
                  onPress={() => handleScheduleReminder(opt.days)}
                  disabled={reminderScheduling}
                  activeOpacity={0.7}
                >
                  {reminderScheduling ? (
                    <ActivityIndicator size="small" color="#E17055" />
                  ) : (
                    <Text style={styles.reminderChipText}>{opt.label}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Row 0b: Reminder active indicator + cancel */}
        {reminderSet && (
          <View style={styles.reminderActiveRow}>
            <Ionicons name="notifications" size={16} color="#27AE60" />
            <Text style={styles.reminderActiveText}>
              {reminderDays} दिन बाद याद दिलाया जाएगा
            </Text>
            <TouchableOpacity onPress={handleCancelReminder} activeOpacity={0.7}>
              <Text style={styles.reminderCancelText}>रद्द करें</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* For MyApps view: cancel reminder if one exists */}
        {isFromMyApps && savedApplicationId && (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionSecondary]}
            onPress={handleCancelReminder}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-off-outline" size={18} color="#E17055" />
            <Text style={styles.actionSecondaryText}>याद दिलाना बंद करें</Text>
          </TouchableOpacity>
        )}

        {/* Row 1: Edit + Copy + Share text */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionSecondary]}
            onPress={onGoBack}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={18} color="#E17055" />
            <Text style={styles.actionSecondaryText}>दोबारा बनाएं</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionSecondary]}
            onPress={handleCopy}
            activeOpacity={0.7}
          >
            <Ionicons name="copy-outline" size={18} color="#E17055" />
            <Text style={styles.actionSecondaryText}>कॉपी करें</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionSecondary]}
            onPress={handleShareText}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#E17055" />
            <Text style={styles.actionSecondaryText}>शेयर करें</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: Generate PDF + Share PDF + Save PDF */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionPdf,
              pdfGenerating && styles.actionButtonDisabled,
            ]}
            onPress={handleGeneratePdf}
            disabled={pdfGenerating}
            activeOpacity={0.7}
          >
            {pdfGenerating ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="document-outline" size={18} color="#FFF" />
                <Text style={styles.actionPrimaryText}>
                  {pdfUri ? '✓ PDF बन गया' : 'PDF बनाएं'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionShare,
              !pdfUri && styles.actionButtonDisabled,
            ]}
            onPress={handleSharePdf}
            disabled={!pdfUri}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social" size={18} color="#FFF" />
            <Text style={styles.actionPrimaryText}>साझा करें</Text>
          </TouchableOpacity>

          {isSaveSupported() && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionSave,
                !pdfUri && styles.actionButtonDisabled,
              ]}
              onPress={handleSavePdf}
              disabled={!pdfUri}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={18} color="#FFF" />
              <Text style={styles.actionPrimaryText}>सेव करें</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Row 3: Generate RTF (Word) + Share RTF */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionWord,
              rtfGenerating && styles.actionButtonDisabled,
            ]}
            onPress={handleGenerateRtf}
            disabled={rtfGenerating}
            activeOpacity={0.7}
          >
            {rtfGenerating ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={18} color="#FFF" />
                <Text style={styles.actionPrimaryText}>
                  {rtfUri ? '✓ Word बन गया' : 'Word में एक्सपोर्ट करें'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionShare,
              !rtfUri && styles.actionButtonDisabled,
            ]}
            onPress={handleShareRtf}
            disabled={!rtfUri}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={18} color="#FFF" />
            <Text style={styles.actionPrimaryText}>Word शेयर करें</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── HomeStack screen wrapper ──────────────────────────────────────────

function ApplicationPreviewScreen({ route, navigation }: Props) {
  const { applicationName, generatedText, officeType, savedApplicationId } = route.params;

  return (
    <ApplicationPreviewContent
      applicationName={applicationName}
      generatedText={generatedText}
      officeType={officeType}
      onGoBack={() => navigation.goBack()}
      savedApplicationId={savedApplicationId}
      isFromMyApps={false}
    />
  );
}

export default ApplicationPreviewScreen;

// ── Helpers ─────────────────────────────────────────────────────────

function getOfficeLabel(officeType: string): string {
  const labels: Record<string, string> = {
    thana: 'थाना (Police Station)',
    block: 'तहसील / ब्लॉक (Tehsil / Block)',
    bdo: 'खंड विकास कार्यालय (BDO)',
    co: 'सर्किल कार्यालय (CO Office)',
    sdo: 'अनुविभागीय कार्यालय (SDO Office)',
    sp: 'पुलिस अधीक्षक कार्यालय (SP Office)',
    dc: 'जिला समाहरणालय (DC Office)',
    court: 'न्यायालय (Court)',
    bank: 'बैंक (Bank)',
    college: 'कॉलेज (College)',
    school: 'स्कूल (School)',
    pwd: 'लोक निर्माण विभाग (PWD)',
    rcd: 'ग्रामीण कार्य विभाग (RCD)',
    bcd: 'भवन निर्माण विभाग (BCD)',
    custom: 'खाली आवेदन (Custom Application)',
  };
  return labels[officeType] ?? officeType;
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8E0',
    gap: 12,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  // Text body
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  textCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 300,
  },
  applicationText: {
    fontSize: 17,
    lineHeight: 32,
    color: '#1A1A2E',
    textAlign: 'left',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'normal',
  },

  // Action bar
  actionBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0E8E0',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionPrimary: {
    backgroundColor: '#E17055',
  },
  actionPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionSecondary: {
    backgroundColor: '#FFF0ED',
  },
  actionSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E17055',
  },
  actionPdf: {
    backgroundColor: '#E17055',
    flex: 1.2,
  },
  actionShare: {
    backgroundColor: '#0984E3',
  },
  actionSave: {
    backgroundColor: '#27AE60',
  },
  actionWord: {
    backgroundColor: '#2B579A',
    flex: 1.5,
  },

  // Reminders
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  reminderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  reminderOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  reminderChip: {
    backgroundColor: '#FFF0ED',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E17055',
  },
  reminderChipDisabled: {
    opacity: 0.5,
  },
  reminderChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E17055',
  },
  reminderActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBFBEE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  reminderActiveText: {
    flex: 1,
    fontSize: 13,
    color: '#27AE60',
    fontWeight: '500',
  },
  reminderCancelText: {
    fontSize: 13,
    color: '#D63031',
    fontWeight: '600',
  },
});
