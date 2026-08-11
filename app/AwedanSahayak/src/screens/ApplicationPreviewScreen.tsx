/**
 * ApplicationPreviewScreen — displays the AI-generated Hindi application.
 *
 * Shows the formal application text in a clean, readable, scrollable format.
 * Provides actions:
 *   - "दोबारा बनाएं" — go back to edit the form
 *   - "PDF बनाएं" — generate a styled PDF
 *   - "साझा करें" — share text or PDF via WhatsApp etc.
 */

import React, { useCallback, useState, useRef } from 'react';
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
  TextInput,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { generatePdf, sharePdf, isSaveSupported } from '../services/pdf';
import { generateRtf, shareRtf } from '../services/rtf';
import { scheduleReminder, cancelScheduledReminder } from '../services/reminders';
import { updateGeneratedApplication, getGeneratedApplicationById } from '../database/db';
import { reviseApplication } from '../services/apiClient';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { printPdf } from '../services/printService';
import MultiPagePdfViewer from '../components/pdf/MultiPagePdfViewer';

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
  /** Original form data for fact preservation during AI revision */
  formData?: Record<string, string>;
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
  formData,
}: ApplicationPreviewContentProps) {

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('');
  const [printing, setPrinting] = useState(false);

  const [rtfGenerating, setRtfGenerating] = useState(false);
  const [rtfUri, setRtfUri] = useState<string | null>(null);
  const [rtfFilename, setRtfFilename] = useState<string>('');

  // ── Reminder state ──────────────────────────────────────────────

  const [reminderSet, setReminderSet] = useState(false);
  const [reminderDays, setReminderDays] = useState<number | null>(null);
  const [reminderScheduling, setReminderScheduling] = useState(false);
  const [notifId, setNotifId] = useState<string | null>(null);

  // ── Edit mode state ───────────────────────────────────────────

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(generatedText);
  const [aiRevising, setAiRevising] = useState(false);

  const activeText = isEditing ? editedText : generatedText;

  // ── Custom correction with voice ────────────────────────────

  const [correctionText, setCorrectionText] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { isListening, partialText, startListening, stopListening } = useVoiceInput({
    locale: 'hi-IN',
    onResult: (text: string) => {
      setCorrectionText(prev => {
        const trimmed = prev.trim();
        return trimmed.length > 0 ? trimmed + ' ' + text : text;
      });
      setVoiceActive(false);
      stopPulse();
    },
    onError: (message: string) => {
      Alert.alert('🎤 आवाज़ त्रुटि', message);
      setVoiceActive(false);
      stopPulse();
    },
  });

  const startPulse = useCallback(() => {
    pulseAnim.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const handleVoiceCorrection = async () => {
    if (voiceActive) {
      await stopListening();
      setVoiceActive(false);
      stopPulse();
    } else {
      setVoiceActive(true);
      startPulse();
      await startListening();
    }
  };

  const handleCustomRevise = () => {
    const instruction = correctionText.trim();
    if (!instruction) return;
    handleAiRevise(instruction, 'सुधार लागू किया गया');
    setCorrectionText('');
  };

  // ── AI Revision actions ──────────────────────────────────────

  const handleAiRevise = useCallback(async (instruction: string, label: string) => {
    if (aiRevising) return;
    setAiRevising(true);
    try {
      const textToRevise = isEditing ? editedText : generatedText;
      // Pass real formData for fact preservation — backend uses factGuard + protected block
      const result = await reviseApplication(textToRevise, instruction, formData || {});
      if (result.ok && result.data?.generatedText) {
        setEditedText(result.data.generatedText);
        setIsEditing(true);
        Alert.alert('✅ ' + label, 'AI ने आवेदन को अपडेट कर दिया है।');
      } else {
        Alert.alert('त्रुटि', result.error || 'AI revision failed.');
      }
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.message || 'AI revision failed.');
    } finally {
      setAiRevising(false);
    }
  }, [aiRevising, isEditing, editedText, generatedText]);

  const handleGrammar = () => handleAiRevise(
    'कृपया इस आवेदन की व्याकरण (grammar) और वर्तनी (spelling) सुधारें। केवल भाषा सुधारें, तथ्य और नाम/पते न बदलें।',
    'Grammar ठीक किया गया'
  );

  const handleShorten = () => handleAiRevise(
    'कृपया इस आवेदन को संक्षिप्त (shorten) करें। मुख्य बातें रखें, अनावश्यक वाक्य हटाएं। तथ्य और नाम/पते न बदलें।',
    'आवेदन छोटा किया गया'
  );

  const handleExpand = () => handleAiRevise(
    'कृपया इस आवेदन को और विस्तृत (expand) करें। उचित कानूनी भाषा जोड़ें। तथ्य और नाम/पते न बदलें।',
    'आवेदन विस्तृत किया गया'
  );

  const handleAiReview = () => handleAiRevise(
    'कृपया इस आवेदन की समीक्षा करें जैसे कोई सरकारी अधिकारी करता। क्या सभी आवश्यक जानकारी है? क्या भाषा औपचारिक है? कोई कमी हो तो सुधारें।',
    'AI Review पूरा हुआ'
  );

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
        message: activeText,
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
        generatedText: activeText,
        applicationName,
        officeType,
        // Only pass user-visible office name for non-custom types
        officeName: officeType === 'custom' ? '' : getOfficeLabel(officeType),
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
  }, [pdfGenerating, activeText, applicationName, officeType]);

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

  // ── Print PDF ───────────────────────────────────────────────────

  const handlePrint = useCallback(async () => {
    if (printing) return;

    // If PDF not yet generated, generate it first
    let targetUri = pdfUri;
    if (!targetUri) {
      setPdfGenerating(true);
      try {
        const result = await generatePdf({
          generatedText: activeText,
          applicationName,
          officeType: officeType || 'thana',
          officeName: officeType === 'custom' ? '' : undefined,
        });
        targetUri = result.uri;
        setPdfUri(result.uri);
        setPdfFilename(result.filename);
      } catch (err: any) {
        Alert.alert(
          '❌ PDF त्रुटि',
          'PDF बनाने में समस्या आई।\n\n' + (err?.message ?? 'PDF generation failed.'),
        );
        setPdfGenerating(false);
        return;
      }
      setPdfGenerating(false);
    }

    if (!targetUri) {
      Alert.alert('प्रिंट त्रुटि', 'PDF उपलब्ध नहीं है।');
      return;
    }

    setPrinting(true);
    await printPdf(targetUri, applicationName || 'आवेदन पत्र');
    setPrinting(false);
  }, [printing, pdfUri, activeText, formData, applicationName, officeType]);

  // ── Generate RTF (Word document) ────────────────────────────────

  const handleGenerateRtf = useCallback(async () => {
    if (rtfGenerating) return;
    setRtfGenerating(true);

    try {
      const result = await generateRtf({
        generatedText: activeText,
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
  }, [rtfGenerating, activeText, applicationName]);

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

      {/* Application text or PDF preview */}
      {pdfUri ? (
        <View style={styles.pdfViewerContainer}>
          <MultiPagePdfViewer
            uri={pdfUri}
            onError={(e) => console.warn('[Preview] PDF viewer error:', e)}
          />
        </View>
      ) : isEditing ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.textCard}>
            <TextInput
              style={styles.editInput}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              textAlignVertical="top"
              autoCapitalize="sentences"
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      ) : (
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
      )}

      {/* Custom correction input with voice mic */}
      <View style={styles.correctionRow}>
        <View style={styles.correctionInputWrapper}>
          <TextInput
            style={styles.correctionInput}
            value={correctionText}
            onChangeText={setCorrectionText}
            placeholder="सुधार लिखें या बोलें..."
            placeholderTextColor="#AAA"
            multiline={false}
            editable={!aiRevising}
          />
          <TouchableOpacity
            onPress={handleVoiceCorrection}
            activeOpacity={0.7}
            style={[styles.micBtn, voiceActive && styles.micBtnActive]}
            disabled={aiRevising}
          >
            {voiceActive ? (
              <Animated.View style={{ opacity: pulseAnim }}>
                <View style={styles.recDot} />
              </Animated.View>
            ) : (
              <Ionicons name="mic-outline" size={20} color={voiceActive ? '#FFF' : '#E17055'} />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, (!correctionText.trim() || aiRevising) && styles.sendBtnDisabled]}
          onPress={handleCustomRevise}
          disabled={!correctionText.trim() || aiRevising}
          activeOpacity={0.7}
        >
          <Ionicons name="send" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Show partial transcription */}
      {voiceActive && partialText.trim().length > 0 && (
        <View style={styles.partialRow}>
          <Text style={styles.partialText} numberOfLines={2}>
            {partialText}
          </Text>
        </View>
      )}

      {/* Edit / AI revision toolbar */}
      <View style={styles.editToolbar}>
        <TouchableOpacity
          style={[styles.editToggleBtn, isEditing && styles.editToggleActive]}
          onPress={() => {
            if (!isEditing) setEditedText(generatedText);
            setIsEditing(!isEditing);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name={isEditing ? 'eye-outline' : 'create-outline'} size={16} color={isEditing ? '#FFF' : '#E17055'} />
          <Text style={[styles.editToggleText, isEditing && styles.editToggleTextActive]}>
            {isEditing ? 'व्यू मोड' : 'एडिट करें'}
          </Text>
        </TouchableOpacity>

        {isEditing && (
          <View style={styles.aiRow}>
            <TouchableOpacity style={styles.aiBtn} onPress={handleGrammar} disabled={aiRevising}>
              <Ionicons name="text-outline" size={14} color="#FFF" />
              <Text style={styles.aiBtnText}>Grammar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aiBtn, { backgroundColor: '#0984E3' }]} onPress={handleShorten} disabled={aiRevising}>
              <Ionicons name="contract-outline" size={14} color="#FFF" />
              <Text style={styles.aiBtnText}>छोटा</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aiBtn, { backgroundColor: '#00B894' }]} onPress={handleExpand} disabled={aiRevising}>
              <Ionicons name="expand-outline" size={14} color="#FFF" />
              <Text style={styles.aiBtnText}>बड़ा</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aiBtn, { backgroundColor: '#6C5CE7' }]} onPress={handleAiReview} disabled={aiRevising}>
              <Ionicons name="checkmark-done-outline" size={14} color="#FFF" />
              <Text style={styles.aiBtnText}>Review</Text>
            </TouchableOpacity>
          </View>
        )}
        {aiRevising && <ActivityIndicator size="small" color="#E17055" style={{ marginTop: 8 }} />}
      </View>

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

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionPrint,
              (printing || !pdfUri) && styles.actionButtonDisabled,
            ]}
            onPress={handlePrint}
            disabled={printing || !pdfUri}
            activeOpacity={0.7}
          >
            {printing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="print-outline" size={18} color="#FFF" />
                <Text style={styles.actionPrimaryText}>प्रिंट</Text>
              </>
            )}
          </TouchableOpacity>
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
  const { applicationName, generatedText, officeType, savedApplicationId, formData } = route.params;

  return (
    <ApplicationPreviewContent
      applicationName={applicationName}
      generatedText={generatedText}
      officeType={officeType}
      onGoBack={() => navigation.goBack()}
      savedApplicationId={savedApplicationId}
      isFromMyApps={false}
      formData={formData}
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
  pdfViewerContainer: {
    flex: 1,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
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

	  // Edit mode
	  editInput: {
	    fontSize: 16, lineHeight: 28, color: '#2D3436', minHeight: 300,
	    fontFamily: Platform.OS === 'ios' ? 'System' : 'normal',
	  },
	  // Correction input with mic
  correctionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderTopWidth: 1, borderTopColor: '#F0E8E0' },
  correctionInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E8E8E8', paddingRight: 4 },
  correctionInput: { flex: 1, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 14, color: '#1A1A2E', minHeight: 40 },
  micBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF0ED', alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: '#D63031' },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#D63031' },
  sendBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#E17055', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#CCC' },
  partialRow: { paddingHorizontal: 16, paddingBottom: 4 },
  partialText: { fontSize: 13, color: '#B8860B', fontStyle: 'italic' },
  // Edit toolbar
  editToolbar: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0E8E0' },
	  editToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: '#E17055', backgroundColor: '#FFF', marginBottom: 8 },
	  editToggleActive: { backgroundColor: '#E17055', borderColor: '#E17055' },
	  editToggleText: { fontSize: 13, fontWeight: '600', color: '#E17055' },
	  editToggleTextActive: { color: '#FFF' },
	  aiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
	  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E17055', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
	  aiBtnText: { fontSize: 11, fontWeight: '600', color: '#FFF' },

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
  actionPrint: {
    backgroundColor: '#6C5CE7',
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
