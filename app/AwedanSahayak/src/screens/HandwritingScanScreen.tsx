/**
 * HandwritingScanScreen — "हस्तलिखित आवेदन स्कैन करें"
 *
 * Lets users photograph an existing handwritten application and get it
 * as editable digital text, exportable to PDF and Word.
 *
 * Flow:
 *   1. Info notice ("take a clear photo") → open camera
 *   2. Send image to backend /api/scan-document (OCR via Google Vision)
 *   3. Show extracted text in editable area with "check and correct" note
 *   4. Export as PDF, Word (RTF), or share
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
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
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { generatePdf, sharePdf, isSaveSupported } from '../services/pdf';
import { generateRtf, shareRtf } from '../services/rtf';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

// ── Types ───────────────────────────────────────────────────────────

import { API_BASE_URL } from '../config';

type Props = NativeStackScreenProps<HomeStackParamList, 'HandwritingScan'>;

// ── Component ───────────────────────────────────────────────────────

export default function HandwritingScanScreen({ navigation }: Props) {
  const [phase, setPhase] = useState<'info' | 'scanning' | 'editing'>('info');
  const [aiCleaning, setAiCleaning] = useState(false);
  const [aiCleaned, setAiCleaned] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── PDF / RTF state ──────────────────────────────────────────────

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('');
  const [rtfGenerating, setRtfGenerating] = useState(false);
  const [rtfUri, setRtfUri] = useState<string | null>(null);
  const [rtfFilename, setRtfFilename] = useState<string>('');

  // ── Voice input ──────────────────────────────────────────────────

  const [voiceActive, setVoiceActive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Track the latest partial text in a ref so handleVoiceToggle can
  // read it without recreating the callback on every interim result.
  const partialRef = useRef('');
  // Track cursor position so voice text is inserted AT the cursor
  // rather than always appended to the end of the document.
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  /**
   * Inserts transcript at the current cursor position (or replaces the
   * selected range if the user highlighted text before speaking).
   * Returns the new text AND the cursor position right after the insert.
   */
  const insertAtCursor = useCallback(
    (currentText: string, transcript: string): { text: string; cursorAfter: number } => {
      const { start, end } = selectionRef.current;
      const before = currentText.substring(0, start);
      const after = currentText.substring(end);
      const insertText = (start > 0 && before.charAt(before.length - 1) !== ' ' && before.charAt(before.length - 1) !== '\n')
        ? ' ' + transcript
        : transcript;
      const newText = before + insertText + after;
      const cursorAfter = before.length + insertText.length;
      return { text: newText, cursorAfter };
    },
    [],
  );

  // Pulsing animation for recording indicator
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

  const { isListening, partialText, startListening, stopListening } = useVoiceInput({
    locale: 'hi-IN',
    onResult: (transcript: string) => {
      // Fires when the recognizer delivers a FINAL result (isFinal=true).
      // In continuous mode this happens after a natural pause in speech.
      console.log('[HandwritingScan] onResult FIRED:', transcript.substring(0, 80));
      setEditedText((prev) => {
        const { text, cursorAfter } = insertAtCursor(prev, transcript);
        console.log('[HandwritingScan] onResult — inserted at pos', selectionRef.current.start, '→ cursor now at', cursorAfter);
        // Advance cursor past the inserted text so subsequent voice
        // input continues from where we just added, not jumping elsewhere.
        selectionRef.current = { start: cursorAfter, end: cursorAfter };
        return text;
      });
      setVoiceActive(false);
      stopPulse();
    },
    onError: (msg: string) => {
      console.log('[HandwritingScan] Voice ERROR:', msg);
      // Suppress abort/no-speech errors — they're expected during
      // start/stop transitions and don't need user-facing alerts.
      if (
        msg.includes('abort') ||
        msg.includes('Aborted') ||
        msg.includes('no-speech') ||
        msg.includes('speech-timeout')
      ) {
        // Just reset UI state silently
        setVoiceActive(false);
        stopPulse();
        return;
      }
      Alert.alert('🎤 आवाज़ त्रुटि', msg);
      setVoiceActive(false);
      stopPulse();
    },
  });

  // Keep the ref in sync with the latest partial text so
  // handleVoiceToggle can always read the most recent value.
  partialRef.current = partialText;

  // Clean up voice recognition on unmount
  useEffect(() => {
    return () => {
      try { ExpoSpeechRecognitionModule.abort(); } catch {}
    };
  }, []);

  // ── Voice toggle ────────────────────────────────────────────────

  const handleVoiceToggle = useCallback(async () => {
    if (voiceActive) {
      // ── STOPPING ────────────────────────────────────────────────
      console.log('[HandwritingScan] VoiceToggle: stopping...');

      // CRITICAL: commit any pending interim text BEFORE stopping.
      // onResult only fires on isFinal=true, which may not arrive
      // before the user taps stop. The partial text IS the recognized
      // speech — we commit it here so nothing is lost.
      const pending = partialRef.current.trim();
      if (pending.length > 0) {
        console.log('[HandwritingScan] VoiceToggle: committing pending:', pending.substring(0, 80));
        setEditedText((prev) => {
          const { text, cursorAfter } = insertAtCursor(prev, pending);
          console.log('[HandwritingScan] VoiceToggle: inserted at pos', selectionRef.current.start, '→ cursor now at', cursorAfter);
          selectionRef.current = { start: cursorAfter, end: cursorAfter };
          return text;
        });
      }

      await stopListening();
      // Small delay so the native recognizer fully tears down
      await new Promise((r) => setTimeout(r, 300));
      setVoiceActive(false);
      stopPulse();
    } else {
      // ── STARTING ────────────────────────────────────────────────
      console.log('[HandwritingScan] VoiceToggle: starting...');

      // 1. Dismiss keyboard — it competes with voice for audio focus
      Keyboard.dismiss();

      // 2. Ensure any previous session is fully stopped
      try { await stopListening(); } catch {}
      // 3. Wait for native cleanup to prevent "aborted" errors
      await new Promise((r) => setTimeout(r, 500));

      // 4. Now start fresh
      setVoiceActive(true);
      startPulse();
      await startListening();
    }
  }, [voiceActive, startListening, stopListening, startPulse, stopPulse]);

  // ── Camera → OCR pipeline ────────────────────────────────────────

  const handleOpenCamera = useCallback(async () => {
    try {
      // 1. Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'कैमरा अनुमति आवश्यक',
          'कृपया सेटिंग्स में जाकर कैमरा अनुमति दें।\n\nCamera permission is required.',
        );
        return;
      }

      // 2. Open camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1.0,       // max quality — handwriting needs more detail than ID cards
        allowsEditing: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return; // user cancelled
      }

      const imageUri = result.assets[0].uri;
      setPhase('scanning');
      setIsLoading(true);
      setError(null);

      try {
        // 3. Read image as base64
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // 4. Send to backend for OCR
        console.log('[HandwritingScan] Sending image to backend for OCR...');
        const response = await fetch(`${API_BASE_URL}/api/scan-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error((errData as any)?.error ?? `Server error (${response.status})`);
        }

        const data = await response.json();
        const text = data.rawText ?? '';

        if (!text || text.trim().length === 0) {
          setError(
            'फोटो से कोई टेक्स्ट नहीं पढ़ा जा सका। कृपया साफ और सीधी फोटो लेकर पुनः प्रयास करें।\n\n' +
            'No text could be read from the photo. Please take a clearer, straighter photo and try again.',
          );
          setPhase('info');
        } else {
          setExtractedText(text);
          setEditedText(text);
          setPhase('editing');
          console.log(`[HandwritingScan] OCR success — ${text.length} chars extracted.`);
        }
      } finally {
        // 5. Delete temp image
        try { await FileSystem.deleteAsync(imageUri, { idempotent: true }); } catch {}
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[HandwritingScan] Error:', err?.message);
      setError(err?.message ?? 'Unknown error');
      setIsLoading(false);
      setPhase('info');
    }
  }, []);

  // ── Export actions (same pattern as ApplicationPreviewScreen) ─────

  const handleGeneratePdf = useCallback(async () => {
    if (pdfGenerating) return;
    setPdfGenerating(true);
    try {
      const result = await generatePdf({
        generatedText: editedText,
        applicationName: 'हस्तलिखित आवेदन',
        officeType: 'thana',
      });
      setPdfUri(result.uri);
      setPdfFilename(result.filename);
      Alert.alert('✅ PDF तैयार', `PDF file created:\n${result.filename}`);
    } catch (err: any) {
      Alert.alert('❌ PDF त्रुटि', err?.message ?? 'PDF generation failed.');
    } finally {
      setPdfGenerating(false);
    }
  }, [pdfGenerating, editedText]);

  const handleSharePdf = useCallback(async () => {
    if (!pdfUri) {
      Alert.alert('PDF बनाएं', 'पहले PDF बनाएं, फिर शेयर करें।');
      return;
    }
    try { await sharePdf(pdfUri, pdfFilename); } catch {}
  }, [pdfUri, pdfFilename]);

  const handleGenerateRtf = useCallback(async () => {
    if (rtfGenerating) return;
    setRtfGenerating(true);
    try {
      const result = await generateRtf({
        generatedText: editedText,
        applicationName: 'हस्तलिखित आवेदन',
      });
      setRtfUri(result.uri);
      setRtfFilename(result.filename);
      Alert.alert('✅ Word डॉक्यूमेंट तैयार', `RTF file created:\n${result.filename}`);
    } catch (err: any) {
      Alert.alert('❌ Word त्रुटि', err?.message ?? 'RTF generation failed.');
    } finally {
      setRtfGenerating(false);
    }
  }, [rtfGenerating, editedText]);

  const handleShareRtf = useCallback(async () => {
    if (!rtfUri) {
      Alert.alert('Word बनाएं', 'पहले Word डॉक्यूमेंट बनाएं, फिर शेयर करें।');
      return;
    }
    try { await shareRtf(rtfUri, rtfFilename); } catch {}
  }, [rtfUri, rtfFilename]);

  const handleShareText = useCallback(async () => {
    try {
      await Share.share({ title: 'हस्तलिखित आवेदन', message: editedText });
    } catch {}
  }, [editedText]);

  // ── AI cleanup (optional LLM pass for OCR typo fixing) ──────────

  const handleAiCleanup = useCallback(async () => {
    if (aiCleaning || !editedText.trim()) return;
    setAiCleaning(true);
    try {
      console.log('[HandwritingScan] AI cleanup: sending', editedText.length, 'chars to backend...');
      const response = await fetch(`${API_BASE_URL}/api/cleanup-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: editedText }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as any)?.error ?? `Server error (${response.status})`);
      }

      const data = await response.json();
      const cleaned = data.cleanedText ?? '';
      if (cleaned.trim().length > 0) {
        setEditedText(cleaned);
        setAiCleaned(true);
        console.log('[HandwritingScan] AI cleanup done:', cleaned.length, 'chars.');
        Alert.alert(
          '✅ AI सुधार पूरा',
          `AI ने OCR टाइपो सुधार दिए हैं।\nकृपया टेक्स्ट को पुनः जाँच लें।\n\nAI has corrected OCR typos. Please review the text.`,
        );
      }
    } catch (err: any) {
      console.error('[HandwritingScan] AI cleanup failed:', err?.message);
      Alert.alert('❌ AI सुधार विफल', err?.message ?? 'AI cleanup failed.');
    } finally {
      setAiCleaning(false);
    }
  }, [aiCleaning, editedText]);

  const handleRetry = useCallback(() => {
    setError(null);
    setExtractedText('');
    setEditedText('');
    setPdfUri(null);
    setRtfUri(null);
    setAiCleaned(false);
    setPhase('info');
  }, []);

  // ── Phase: Info / Start ──────────────────────────────────────────

  if (phase === 'info') {
    return (
      <View style={styles.container}>
        <View style={styles.infoContent}>
          <View style={styles.infoIconCircle}>
            <Ionicons name="scan-outline" size={48} color="#E17055" />
          </View>
          <Text style={styles.infoTitle}>हस्तलिखित आवेदन स्कैन करें</Text>
          <Text style={styles.infoSubtitle}>Scan Handwritten Application</Text>

          <View style={styles.infoCard}>
            <Ionicons name="bulb-outline" size={22} color="#F39C12" />
            <Text style={styles.infoCardText}>
              साफ रोशनी में फोटो लें, कागज़ को सीधा और सपाट रखें, पूरा पन्ना फ्रेम में हो, छाया से बचें।{'\n'}
              Use bright even lighting, keep the paper flat and straight, frame the entire page, avoid shadows.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="camera-outline" size={22} color="#0984E3" />
            <Text style={styles.infoCardText}>
              कैमरा सीधा ऊपर से रखें, तिरछा न हो। हस्तलिखित टेक्स्ट के लिए ज़्यादा रोशनी और सपाट कागज़ ज़रूरी है।{'\n'}
              Hold the camera directly above, not at an angle. Handwriting needs more light and flatter paper than printed text.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="warning-outline" size={22} color="#E17055" />
            <Text style={styles.infoCardText}>
              हस्तलिखित टेक्स्ट की पहचान 100% सटीक नहीं होती — स्कैन के बाद टेक्स्ट को जाँच कर सुधारें।{'\n'}
              Handwriting recognition is not 100% accurate — check and correct the text after scanning.
            </Text>
          </View>

          {error && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={22} color="#D63031" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleOpenCamera}
            activeOpacity={0.7}
          >
            <Ionicons name="camera" size={24} color="#FFFFFF" />
            <Text style={styles.scanButtonText}>कैमरा खोलें / Open Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Phase: Scanning (loading) ─────────────────────────────────────

  if (phase === 'scanning') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E17055" />
        <Text style={styles.scanningText}>फोटो प्रोसेस हो रही है...</Text>
        <Text style={styles.scanningSubtext}>Processing image — please wait</Text>
        {isLoading && (
          <Text style={styles.scanningHint}>
            OCR में कुछ सेकंड लग सकते हैं{'\n'}OCR may take a few seconds
          </Text>
        )}
      </View>
    );
  }

  // ── Phase: Editing ───────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* OCR notice banner */}
      <View style={styles.ocrNotice}>
        <Ionicons name="information-circle" size={20} color="#E17055" />
        <Text style={styles.ocrNoticeText}>
          OCR से पढ़ा गया पाठ — कृपया जांच लें और सुधारें{'\n'}
          <Text style={styles.ocrNoticeSubtext}>
            Text read by OCR — please check and correct
          </Text>
        </Text>
      </View>

      {/* Voice input toolbar */}
      <View style={styles.voiceToolbar}>
        <TouchableOpacity
          style={[
            styles.micButton,
            voiceActive && styles.micButtonActive,
          ]}
          onPress={handleVoiceToggle}
          activeOpacity={0.7}
        >
          {voiceActive ? (
            <>
              <Animated.View style={[styles.pulsingDot, { opacity: pulseAnim }]} />
              <Ionicons name="stop-circle" size={22} color="#FFFFFF" />
            </>
          ) : (
            <Ionicons name="mic" size={22} color="#FFFFFF" />
          )}
        </TouchableOpacity>

        <View style={styles.voiceInfo}>
          {voiceActive ? (
            <View style={styles.listeningRow}>
              <Text style={styles.listeningText}>सुन रहे हैं... बोलें</Text>
            </View>
          ) : (
            <Text style={styles.voiceHelperText}>
              गलत शब्द को हटाकर सही शब्द बोलें, या नया वाक्य जोड़ने के लिए बोलें
            </Text>
          )}
        </View>
      </View>

      {/* Partial transcript preview (shown while listening) */}
      {voiceActive && partialText.length > 0 && (
        <View style={styles.partialPreview}>
          <Text style={styles.partialPreviewLabel}>🎤 सुनाई दिया:</Text>
          <Text style={styles.partialPreviewText} numberOfLines={3}>
            {partialText}
          </Text>
        </View>
      )}

      {/* Editable text area */}
      <ScrollView
        style={styles.editScroll}
        contentContainerStyle={styles.editScrollContent}
        showsVerticalScrollIndicator
      >
        <TextInput
          style={[
            styles.editTextInput,
            voiceActive && styles.editTextInputListening,
          ]}
          value={editedText}
          onChangeText={setEditedText}
          onSelectionChange={(e) => {
            selectionRef.current = {
              start: e.nativeEvent.selection.start,
              end: e.nativeEvent.selection.end,
            };
          }}
          multiline
          textAlignVertical="top"
          autoCorrect={false}
          spellCheck={false}
        />
      </ScrollView>

      {/* Action bar */}
      <View style={styles.actionBar}>
        {/* Row 1: Rescan + Copy + Share text */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionSecondary]}
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <Ionicons name="scan-outline" size={18} color="#E17055" />
            <Text style={styles.actionSecondaryText}>दोबारा स्कैन करें</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionSecondary]}
            onPress={handleShareText}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#E17055" />
            <Text style={styles.actionSecondaryText}>साझा करें</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: AI cleanup (optional) */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionAiCleanup,
              (aiCleaning || aiCleaned) && styles.actionDisabled,
            ]}
            onPress={handleAiCleanup}
            disabled={aiCleaning || aiCleaned}
            activeOpacity={0.7}
          >
            {aiCleaning ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons
                  name={aiCleaned ? 'checkmark-circle' : 'sparkles-outline'}
                  size={18}
                  color="#FFF"
                />
                <Text style={styles.actionPrimaryText}>
                  {aiCleaned ? '✓ AI से सुधार हो गया' : 'AI से सुधारें'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <View style={styles.aiCleanupNote}>
            <Text style={styles.aiCleanupNoteText} numberOfLines={2}>
              केवल स्पष्ट टाइपो सुधारता है, मूल अर्थ नहीं बदलता{'\n'}
              Only fixes clear typos, doesn't change meaning
            </Text>
          </View>
        </View>

        {/* Row 3: Generate PDF + Share PDF + Save PDF */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionPdf, pdfGenerating && styles.actionDisabled]}
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
            style={[styles.actionButton, styles.actionShare, !pdfUri && styles.actionDisabled]}
            onPress={handleSharePdf}
            disabled={!pdfUri}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social" size={18} color="#FFF" />
            <Text style={styles.actionPrimaryText}>PDF साझा करें</Text>
          </TouchableOpacity>

          {isSaveSupported() && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionSave, !pdfUri && styles.actionDisabled]}
              onPress={() => pdfUri && Alert.alert('✅ PDF सेव हो गया', `Saved to:\n${pdfUri}`)}
              disabled={!pdfUri}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={18} color="#FFF" />
              <Text style={styles.actionPrimaryText}>सेव करें</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Row 4: Word export */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionWord, rtfGenerating && styles.actionDisabled]}
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
            style={[styles.actionButton, styles.actionShare, !rtfUri && styles.actionDisabled]}
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

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  centered: {
    flex: 1, backgroundColor: '#FFF8F0',
    alignItems: 'center', justifyContent: 'center',
    padding: 40,
  },

  // ── Info phase ──────────────────────────────────────────────────
  infoContent: {
    flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center',
    paddingBottom: 40,
  },
  infoIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#FFF0ED', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  infoTitle: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  infoSubtitle: { fontSize: 14, color: '#999', marginTop: 4, marginBottom: 28 },
  infoCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 16, marginBottom: 12, gap: 12, alignItems: 'flex-start',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    alignSelf: 'stretch',
  },
  infoCardText: { flex: 1, fontSize: 14, color: '#555', lineHeight: 22 },
  errorCard: {
    flexDirection: 'row', backgroundColor: '#FFF5F5', borderRadius: 12,
    padding: 16, marginBottom: 12, gap: 12, alignItems: 'flex-start',
    borderWidth: 1, borderColor: '#FFE0E0', alignSelf: 'stretch',
  },
  errorText: { flex: 1, fontSize: 13, color: '#D63031', lineHeight: 20 },
  scanButton: {
    flexDirection: 'row', backgroundColor: '#E17055',
    paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14,
    alignItems: 'center', gap: 10,
    shadowColor: '#E17055', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    marginTop: 8,
  },
  scanButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

  // ── Scanning phase ──────────────────────────────────────────────
  scanningText: { fontSize: 18, fontWeight: '600', color: '#1A1A2E', marginTop: 20 },
  scanningSubtext: { fontSize: 13, color: '#999', marginTop: 6 },
  scanningHint: { fontSize: 12, color: '#BBB', marginTop: 24, textAlign: 'center', lineHeight: 18 },

  // ── Editing phase ───────────────────────────────────────────────
  ocrNotice: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFF0ED', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5E0D8', gap: 10,
  },
  ocrNoticeText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#E17055', lineHeight: 22 },
  ocrNoticeSubtext: { fontWeight: '400', fontSize: 12, color: '#C06048' },

  editScroll: { flex: 1 },
  editScrollContent: { padding: 16, paddingBottom: 24 },
  // ── Voice input toolbar ──────────────────────────────────────────
  voiceToolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF', gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0E8E0',
  },
  micButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E17055',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 3,
    shadowColor: '#E17055', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },
  micButtonActive: {
    backgroundColor: '#D63031',
    shadowColor: '#D63031',
  },
  voiceInfo: { flex: 1 },
  pulsingDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  listeningRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  listeningText: {
    fontSize: 14, fontWeight: '600', color: '#D63031',
  },
  voiceHelperText: {
    fontSize: 12, color: '#999', lineHeight: 17,
  },
  partialPreview: {
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: '#FFF9F0', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#F5E0D0',
  },
  partialPreviewLabel: {
    fontSize: 11, fontWeight: '600', color: '#E17055', marginBottom: 4,
  },
  partialPreviewText: {
    fontSize: 14, color: '#666', lineHeight: 22, fontStyle: 'italic',
  },

  editTextInput: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 20, minHeight: 400,
    fontSize: 17, lineHeight: 32, color: '#1A1A2E',
    textAlignVertical: 'top',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  editTextInputListening: {
    borderWidth: 1.5, borderColor: '#D63031',
  },

  // ── Action bar (same pattern as ApplicationPreviewScreen) ────────
  actionBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12, gap: 10,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0E8E0',
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 10, gap: 6,
  },
  actionDisabled: { opacity: 0.4 },
  actionPrimaryText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  actionSecondary: { backgroundColor: '#FFF0ED' },
  actionSecondaryText: { fontSize: 13, fontWeight: '600', color: '#E17055' },
  actionPdf: { backgroundColor: '#E17055', flex: 1.2 },
  actionShare: { backgroundColor: '#0984E3' },
  actionSave: { backgroundColor: '#27AE60' },
  actionWord: { backgroundColor: '#2B579A', flex: 1.5 },
  actionAiCleanup: { backgroundColor: '#6C5CE7', flex: 1 },
  aiCleanupNote: { flex: 1, justifyContent: 'center' },
  aiCleanupNoteText: { fontSize: 10, color: '#999', lineHeight: 14 },
});
