/**
 * CustomApplicationScreen — lets users generate an application for ANY office
 * and ANY need, without selecting a predefined application type.
 *
 * Fields:
 *   1. office_name — free text "किस कार्यालय के लिए?" (with mic)
 *   2. recipient_designation — optional "पदनाम" (with mic)
 *   3. custom_description — large text "आपको क्या लिखवाना है?" (with mic)
 *   4. Base identity fields (applicant_name, parent_spouse_name, village,
 *      post, thana, district, state, mobile, gender) — auto-filled from profile
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getUserProfile, insertGeneratedApplication } from '../database/db';
import type { UserProfile } from '../types/database';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { canGenerateApplication, incrementFreeUsage, consumePaidCredit } from '../services/usageTracker';
import { generateCustomApplication } from '../services/apiClient';
import { FetchTimeoutError } from '../utils/fetchWithTimeout';

// ── Types ─────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'CustomApplication'>;

// ── Field constants ───────────────────────────────────────────────────

/** Custom fields unique to this screen. */
const CUSTOM_FIELD_KEYS = ['office_name', 'recipient_designation', 'custom_description', 'incident_date', 'incident_time'] as const;

/** Base identity fields — same as ApplicationFormScreen's BASE_IDENTITY_FIELDS. */
const BASE_IDENTITY_FIELDS = [
  'applicant_name',
  'parent_spouse_name',
  'village',
  'post',
  'thana',
  'district',
  'state',
  'mobile',
  'gender',
];

/** All fields in render order. */
const ALL_FIELDS = [
  'office_name',
  'recipient_designation',
  'custom_description',
  'incident_date',
  'incident_time',
  ...BASE_IDENTITY_FIELDS,
];

/** Fields that get multiline + mic button. */
const LONG_TEXT_FIELDS = new Set(['custom_description']);

/** Fields that show a mic button (all custom fields + long identity fields). */
const FIELDS_WITH_MIC = new Set(['office_name', 'recipient_designation', 'custom_description', 'applicant_name', 'father_name', 'mother_name', 'village', 'post_office', 'police_station', 'district', 'state', 'address', 'mobile', 'subject']);

/** Bilingual labels for custom fields. */
const CUSTOM_FIELD_LABELS: Record<string, string> = {
  office_name: 'किस कार्यालय के लिए? (Which Office?)',
  recipient_designation: 'पदनाम — वैकल्पिक (Recipient\'s Designation — Optional)',
  custom_description: 'आपको क्या लिखवाना है? पूरी बात बताएं (Describe your issue in detail)',
  incident_date: 'घटना की तारीख / दिनांक — वैकल्पिक (Incident Date — Optional)',
  incident_time: 'घटना का समय — वैकल्पिक (Incident Time — Optional)',
};

/** Placeholder hints for custom fields. */
const FIELD_PLACEHOLDERS: Record<string, string> = {
  office_name: 'जैसे: जिला शिक्षा पदाधिकारी, मुख्यमंत्री कार्यालय...',
  recipient_designation: 'जैसे: महोदय, माननीय मंत्री जी...',
  custom_description: 'अपनी पूरी समस्या या अनुरोध अपने शब्दों में लिखें या बोलें...',
  incident_date: 'जैसे: 15/08/2026 (DD/MM/YYYY)',
  incident_time: 'जैसे: सुबह 10 बजे / 10:00 AM',
};

/** Profile prefill map (same as ApplicationFormScreen PREFILL_MAP). */
const PREFILL_MAP: Record<string, keyof UserProfile> = {
  applicant_name: 'name',
  village: 'village',
  post: 'post',
  thana: 'thana',
  district: 'district',
  state: 'state',
  mobile: 'phone',
  gender: 'gender',
  parent_spouse_name: 'parent_spouse_name',
};

/** Bilingual labels for base identity fields (subset of FIELD_LABELS). */
const BASE_FIELD_LABELS: Record<string, string> = {
  applicant_name: 'आवेदक का नाम (Applicant Name)',
  parent_spouse_name: 'पिता/पति का नाम (Father\'s/Husband\'s Name)',
  village: 'गाँव/मौज़ा (Village/Mouza)',
  post: 'डाकघर (Post Office)',
  thana: 'थाना (Police Station)',
  district: 'जिला (District)',
  state: 'राज्य (State)',
  mobile: 'मोबाइल नंबर (Mobile Number)',
  gender: 'लिंग (Gender — पुरुष/महिला/अन्य)',
};

/** Fields that should use a numeric keyboard. */
const NUMERIC_FIELDS = new Set(['mobile']);

/** Fields required before generation can proceed. */
const REQUIRED_FIELDS = new Set([
  'office_name',
  'custom_description',
  'applicant_name',
  'village',
  'thana',
  'district',
  'state',
  'mobile',
]);

// ── Component ─────────────────────────────────────────────────────────

export default function CustomApplicationScreen({ route, navigation }: Props) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Date/time picker state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [pickerDay, setPickerDay] = useState(1);
  const [pickerMonth, setPickerMonth] = useState(0);
  const [pickerYear, setPickerYear] = useState(2026);
  const [pickerHour, setPickerHour] = useState(10);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [pickerAmPm, setPickerAmPm] = useState<'AM' | 'PM'>('AM');

  // Voice recording state
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Voice input hook
  const { isListening, partialText, startListening, stopListening } = useVoiceInput({
    locale: 'hi-IN',
    onResult: (text: string) => {
      if (!activeVoiceField) return;
      setFormData((prev) => {
        const current = prev[activeVoiceField] ?? '';
        if (isLongText(activeVoiceField)) {
          // APPEND for narrative fields
          const separator = current.trim().length > 0 ? ' ' : '';
          return { ...prev, [activeVoiceField]: current + separator + text };
        }
        // REPLACE for single-line fields
        return { ...prev, [activeVoiceField]: text };
      });
      setActiveVoiceField(null);
      stopPulse();
    },
    onError: (message: string) => {
      Alert.alert('🎤 आवाज़ त्रुटि', message);
      setActiveVoiceField(null);
      stopPulse();
    },
  });

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

  // ── Load profile & prefill ────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const profile = await getUserProfile();

        const initial: Record<string, string> = {};
        for (const field of ALL_FIELDS) {
          const profileKey = PREFILL_MAP[field];
          if (profileKey && profile && profile[profileKey]) {
            initial[field] = String(profile[profileKey] ?? '');
          } else {
            initial[field] = '';
          }
        }
        setFormData(initial);
      } catch (err: any) {
        console.error('[CustomApp] Failed to load profile:', err?.message);
        // Initialize empty even on error
        const empty: Record<string, string> = {};
        for (const field of ALL_FIELDS) empty[field] = '';
        setFormData(empty);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────

  const setField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isLongText = (field: string): boolean => {
    return LONG_TEXT_FIELDS.has(field);
  };

  const getKeyboardType = (field: string) => {
    if (NUMERIC_FIELDS.has(field)) return 'phone-pad';
    return 'default';
  };

  const getLabel = (field: string): string => {
    return CUSTOM_FIELD_LABELS[field] ?? BASE_FIELD_LABELS[field] ?? field.replace(/_/g, ' ');
  };

  const getPlaceholder = (field: string): string | undefined => {
    return FIELD_PLACEHOLDERS[field];
  };

  const isRequired = (field: string): boolean => {
    return REQUIRED_FIELDS.has(field);
  };

  const allRequiredFilled = Array.from(REQUIRED_FIELDS).every(
    (f) => formData[f]?.trim().length > 0,
  );

  const handleVoiceToggle = async (fieldName: string) => {
    if (activeVoiceField === fieldName) {
      await stopListening();
      setActiveVoiceField(null);
      stopPulse();
    } else {
      if (activeVoiceField) {
        await stopListening();
      }
      setActiveVoiceField(fieldName);
      startPulse();
      await startListening();
    }
  };

  // ── Date/Time picker handlers ──────────────────────────────────────

  const showDatePicker = () => {
    // Parse existing date if any
    const existing = formData.incident_date?.trim() || '';
    const match = existing.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      setPickerDay(parseInt(match[1], 10));
      setPickerMonth(parseInt(match[2], 10) - 1);
      setPickerYear(parseInt(match[3], 10));
    } else {
      const now = new Date();
      setPickerDay(1);
      setPickerMonth(0);
      setPickerYear(now.getFullYear());
    }
    setDatePickerVisible(true);
  };

  const confirmDate = () => {
    const dd = String(pickerDay).padStart(2, '0');
    const mm = String(pickerMonth + 1).padStart(2, '0');
    const yyyy = String(pickerYear);
    setField('incident_date', `${dd}/${mm}/${yyyy}`);
    setDatePickerVisible(false);
  };

  const showTimePicker = () => {
    const existing = formData.incident_time?.trim() || '';
    const match24 = existing.match(/^(\d{1,2}):(\d{2})$/);
    const match12 = existing.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match24) {
      let h = parseInt(match24[1], 10);
      if (h >= 12) { setPickerAmPm('PM'); if (h > 12) h -= 12; }
      else { setPickerAmPm('AM'); if (h === 0) h = 12; }
      setPickerHour(h);
      setPickerMinute(parseInt(match24[2], 10));
    } else if (match12) {
      setPickerHour(parseInt(match12[1], 10));
      setPickerMinute(parseInt(match12[2], 10));
      setPickerAmPm(match12[3].toUpperCase() as 'AM' | 'PM');
    } else {
      setPickerHour(10);
      setPickerMinute(0);
      setPickerAmPm('AM');
    }
    setTimePickerVisible(true);
  };

  const confirmTime = () => {
    const hh = String(pickerHour).padStart(2, '0');
    const mm = String(pickerMinute).padStart(2, '0');
    setField('incident_time', `${hh}:${mm} ${pickerAmPm}`);
    setTimePickerVisible(false);
  };

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();

  // ── Generate ──────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!allRequiredFilled) return;

    // Monetization gate
    try {
      const check = await canGenerateApplication();
      if (!check.allowed) {
        navigation.navigate('Paywall', {
          applicationTypeId: 0,
          applicationName: 'खाली आवेदन पत्र',
        });
        return;
      }
      (handleGenerate as any)._generationReason = check.reason;
    } catch (err: any) {
      console.warn('[CustomApp] Paywall gate check error (allowing):', err?.message);
      (handleGenerate as any)._generationReason = 'free';
    }

    setSubmitting(true);

    const officeName = formData.office_name?.trim() ?? '';
    const recipientDesignation = formData.recipient_designation?.trim() ?? '';
    const customDescription = formData.custom_description?.trim() ?? '';

    // Build identity-only formData for the backend
    const identityFormData: Record<string, string> = {};
    for (const field of BASE_IDENTITY_FIELDS) {
      if (formData[field]?.trim()) {
        identityFormData[field] = formData[field].trim();
      }
    }
    // Include optional incident date/time if provided
    if (formData.incident_date?.trim()) {
      identityFormData['incident_date'] = formData.incident_date.trim();
    }
    if (formData.incident_time?.trim()) {
      identityFormData['incident_time'] = formData.incident_time.trim();
    }

    const payload = {
      officeName,
      recipientDesignation: recipientDesignation || null,
      customDescription,
      formData: identityFormData,
    };

    try {
      const apiResult = await generateCustomApplication(
        officeName,
        recipientDesignation || null,
        customDescription,
        identityFormData,
      );

      if (!apiResult.ok) {
        throw new Error(apiResult.error || 'Generation failed');
      }

      const result = apiResult.data!;
      console.log(`[CustomApp] Generated ${result.generatedText.length} chars via ${result.metadata?.provider}/${result.metadata?.model}`);

      // Save to local SQLite
      let savedAppId: number | null = null;
      try {
        const saved = await insertGeneratedApplication({
          application_type_id: null,
          office_id: null,
          raw_input_text: JSON.stringify({
            ...identityFormData,
            office_name: officeName,
            recipient_designation: recipientDesignation,
            custom_description: customDescription,
          }),
          generated_text: result.generatedText,
          pdf_path: null,
          is_escalation_of: null,
          reminder_date: null,
          notification_id: null,
          reminder_days: null,
          custom_office_name: officeName,
        } as any);
        savedAppId = (saved as any).id ?? null;
        console.log('[CustomApp] Saved to generated_applications, id:', savedAppId);
      } catch (dbErr: any) {
        console.error('[CustomApp] Failed to save to DB:', dbErr?.message);
      }

      // Increment usage counter
      const reason: string = (handleGenerate as any)._generationReason ?? 'free';
      try {
        if (reason === 'free') {
          await incrementFreeUsage();
          console.log('[CustomApp] Incremented free usage count.');
        } else if (reason === 'paid_credit') {
          await consumePaidCredit();
          console.log('[CustomApp] Consumed 1 paid credit.');
        }
      } catch (counterErr: any) {
        console.warn('[CustomApp] Failed to increment usage counter:', counterErr?.message);
      }

      setSubmitting(false);

      navigation.navigate('ApplicationPreview', {
        applicationName: officeName || 'खाली आवेदन पत्र',
        generatedText: result.generatedText,
        officeType: 'custom',
        applicationTypeId: null,
        savedApplicationId: savedAppId,
      });
    } catch (err: any) {
      setSubmitting(false);

      // Timeout — server took too long (cold start, slow network, etc.)
      if (err instanceof FetchTimeoutError) {
        const seconds = Math.round(err.timeoutMs / 1000);
        Alert.alert(
          '⏳ सर्वर से संपर्क नहीं हो पाया',
          `सर्वर ने ${seconds} सेकंड से अधिक समय ले लिया। यह आमतौर पर सर्वर के सोने (cold start) के कारण होता है।\n\n` +
            'कृपया पुनः प्रयास करें — दूसरी बार सर्वर पहले से जागा हुआ होगा और तेज़ी से जवाब देगा।\n\n' +
            `Server did not respond within ${seconds} seconds. This usually happens when the free server is waking up from sleep (cold start).\n\n` +
            'Please try again — the server will already be awake and should respond faster.',
          [
            { text: 'रद्द करें (Cancel)', style: 'cancel' },
            { text: 'पुनः प्रयास करें (Retry)', onPress: () => handleGenerate() },
          ],
        );
        return;
      }

      const isNetworkError =
        err?.message?.includes('Network') ||
        err?.message?.includes('fetch') ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('TypeError') ||
        err?.message?.includes('timeout');

      if (isNetworkError) {
        Alert.alert(
          '📡 सर्वर से कनेक्ट नहीं हो पाया',
          'कृपया अपना इंटरनेट कनेक्शन जाँचें और पुनः प्रयास करें।\n\n' +
            'Could not connect to the server. Please check your internet connection and try again.',
          [
            { text: 'रद्द करें (Cancel)', style: 'cancel' },
            { text: 'पुनः प्रयास करें (Retry)', onPress: () => handleGenerate() },
          ],
        );
      } else {
        Alert.alert(
          '❌ जनरेशन विफल',
          `आवेदन जनरेट नहीं हो सका। कृपया पुनः प्रयास करें।\n\n${err?.message || 'Unknown error'}`,
          [
            { text: 'ठीक है', style: 'cancel' },
            { text: 'पुनः प्रयास करें (Retry)', onPress: () => handleGenerate() },
          ],
        );
      }
    }
  };

  // ── Render field ──────────────────────────────────────────────────

  const renderField = (field: string) => {
    const value = formData[field] ?? '';
    const isRecording = activeVoiceField === field && isListening;
    const long = isLongText(field);
    const hasMic = FIELDS_WITH_MIC.has(field);
    const required = isRequired(field);
    const placeholder = getPlaceholder(field);

    // Date picker field
    if (field === 'incident_date') {
      return (
        <View key={field} style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>{getLabel(field)}</Text>
          </View>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={showDatePicker}
            activeOpacity={0.7}
            disabled={submitting}
          >
            <Ionicons name="calendar-outline" size={20} color="#E17055" style={{ marginRight: 8 }} />
            <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>
              {value || placeholder || 'दिनांक चुनें / Select Date'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Time picker field
    if (field === 'incident_time') {
      return (
        <View key={field} style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>{getLabel(field)}</Text>
          </View>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={showTimePicker}
            activeOpacity={0.7}
            disabled={submitting}
          >
            <Ionicons name="time-outline" size={20} color="#E17055" style={{ marginRight: 8 }} />
            <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>
              {value || placeholder || 'समय चुनें / Select Time'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View key={field} style={styles.fieldContainer}>
        <View style={styles.labelRow}>
          <Text style={styles.fieldLabel}>
            {getLabel(field)}
            {required ? <Text style={styles.requiredStar}> *</Text> : null}
          </Text>
          {hasMic && (
            <TouchableOpacity
              onPress={() => handleVoiceToggle(field)}
              activeOpacity={0.7}
              style={styles.micButton}
            >
              {isRecording ? (
                <Animated.View style={{ opacity: pulseAnim }}>
                  <View style={styles.recordingDot} />
                </Animated.View>
              ) : (
                <Ionicons name="mic-outline" size={22} color="#E17055" />
              )}
            </TouchableOpacity>
          )}
        </View>

        <TextInput
          style={[styles.input, long && styles.inputMultiline]}
          value={value}
          onChangeText={(t) => setField(field, t)}
          placeholder={placeholder}
          placeholderTextColor="#CCC"
          multiline={long}
          numberOfLines={long ? 6 : 1}
          textAlignVertical={long ? 'top' : 'center'}
          keyboardType={getKeyboardType(field)}
          autoCapitalize={field === 'gender' ? 'none' : 'sentences'}
          editable={!submitting}
        />

        {/* Show partial transcription during voice recording */}
        {isRecording && partialText.trim().length > 0 && (
          <View style={styles.partialContainer}>
            <Text style={styles.partialText} numberOfLines={3}>
              {partialText}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ── Loading state ─────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E17055" />
        <Text style={styles.loadingText}>प्रोफ़ाइल लोड हो रही है...</Text>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro card */}
        <View style={styles.introCard}>
          <Ionicons name="bulb-outline" size={24} color="#6C5CE7" />
          <View style={styles.introTextGroup}>
            <Text style={styles.introTitle}>
              किसी भी कार्यालय के लिए आवेदन बनाएं
            </Text>
            <Text style={styles.introSubtitle}>
              हमारे 77+ प्रकार के आवेदनों में आपकी ज़रूरत नहीं मिली? यहाँ किसी भी कार्यालय और किसी भी समस्या के लिए आवेदन लिखवाएं।
            </Text>
          </View>
        </View>

        {/* Render all fields */}
        {ALL_FIELDS.map(renderField)}

        {/* Generate button */}
        <TouchableOpacity
          style={[
            styles.generateButton,
            (!allRequiredFilled || submitting) && styles.generateButtonDisabled,
          ]}
          onPress={handleGenerate}
          disabled={!allRequiredFilled || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#FFF" />
              <Text style={styles.generateButtonText}>
                आवेदन बनाएं (Generate Application)
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

        {/* ── Date Picker Modal ──────────────────────────────────── */}
        <Modal visible={datePickerVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>दिनांक चुनें / Select Date</Text>

              {/* Year selector */}
              <View style={styles.pickerRow}>
                <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={styles.pickerArrow}>
                  <Ionicons name="chevron-back" size={22} color="#E17055" />
                </TouchableOpacity>
                <ScrollView style={styles.pickerScroll} horizontal showsHorizontalScrollIndicator={false}>
                  {Array.from({ length: 21 }, (_, i) => pickerYear - 10 + i).map(y => (
                    <TouchableOpacity key={y} onPress={() => setPickerYear(y)}
                      style={[styles.pickerItem, y === pickerYear && styles.pickerItemSelected]}>
                      <Text style={[styles.pickerItemText, y === pickerYear && styles.pickerItemTextSelected]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={styles.pickerArrow}>
                  <Ionicons name="chevron-forward" size={22} color="#E17055" />
                </TouchableOpacity>
              </View>

              {/* Month selector */}
              <View style={styles.pickerRow}>
                <Text style={styles.pickerLabel}>महीना:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'].map((m, i) => (
                    <TouchableOpacity key={m} onPress={() => setPickerMonth(i)}
                      style={[styles.pickerItem, i === pickerMonth && styles.pickerItemSelected]}>
                      <Text style={[styles.pickerItemText, i === pickerMonth && styles.pickerItemTextSelected]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Day selector */}
              <View style={styles.pickerRow}>
                <Text style={styles.pickerLabel}>दिन:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {Array.from({ length: daysInMonth(pickerMonth, pickerYear) }, (_, i) => i + 1).map(d => (
                    <TouchableOpacity key={d} onPress={() => setPickerDay(d)}
                      style={[styles.pickerItem, d === pickerDay && styles.pickerItemSelected]}>
                      <Text style={[styles.pickerItemText, d === pickerDay && styles.pickerItemTextSelected]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setDatePickerVisible(false)} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>रद्द करें</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmDate} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmText}>ठीक है</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Time Picker Modal ──────────────────────────────────── */}
        <Modal visible={timePickerVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>समय चुनें / Select Time</Text>

              <View style={styles.timePickerRow}>
                {/* Hour */}
                <View style={styles.timeCol}>
                  <Text style={styles.pickerLabel}>घंटा</Text>
                  <ScrollView style={{ maxHeight: 180 }}>
                    {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => (
                      <TouchableOpacity key={h} onPress={() => setPickerHour(h)}
                        style={[styles.pickerItem, h === pickerHour && styles.pickerItemSelected]}>
                        <Text style={[styles.pickerItemText, h === pickerHour && styles.pickerItemTextSelected]}>{h}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Minute */}
                <View style={styles.timeCol}>
                  <Text style={styles.pickerLabel}>मिनट</Text>
                  <ScrollView style={{ maxHeight: 180 }}>
                    {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                      <TouchableOpacity key={m} onPress={() => setPickerMinute(m)}
                        style={[styles.pickerItem, m === pickerMinute && styles.pickerItemSelected]}>
                        <Text style={[styles.pickerItemText, m === pickerMinute && styles.pickerItemTextSelected]}>{String(m).padStart(2,'0')}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* AM/PM */}
                <View style={styles.timeCol}>
                  <Text style={styles.pickerLabel}>AM/PM</Text>
                  {(['AM','PM'] as const).map(v => (
                    <TouchableOpacity key={v} onPress={() => setPickerAmPm(v)}
                      style={[styles.pickerItem, v === pickerAmPm && styles.pickerItemSelected]}>
                      <Text style={[styles.pickerItemText, v === pickerAmPm && styles.pickerItemTextSelected]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setTimePickerVisible(false)} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>रद्द करें</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmTime} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmText}>ठीक है</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  centered: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },

  // Intro card
  introCard: {
    flexDirection: 'row',
    backgroundColor: '#F0EDFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#D5CFF7',
  },
  introTextGroup: {
    flex: 1,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5B4AB8',
    marginBottom: 4,
  },
  introSubtitle: {
    fontSize: 12,
    color: '#7B6FC0',
    lineHeight: 18,
  },

  // Field container
  fieldContainer: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    flex: 1,
  },
  requiredStar: {
    color: '#D63031',
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  recordingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D63031',
  },

  // Input
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: '#1A1A2E',
    minHeight: 48,
  },
  inputMultiline: {
    minHeight: 140,
    paddingTop: 14,
  },

  // Partial transcription
  partialContainer: {
    backgroundColor: '#FFF9F0',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FFE0C0',
  },
  partialText: {
    fontSize: 13,
    color: '#B8860B',
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // Generate button
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateButtonDisabled: {
    backgroundColor: '#CCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Date/Time picker styles ────────────────────────────────────────

  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    minHeight: 48,
  },
  pickerText: {
    fontSize: 15,
    color: '#1A1A2E',
  },
  pickerPlaceholder: {
    color: '#CCC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    width: 60,
  },
  pickerScroll: {
    flex: 1,
  },
  pickerArrow: {
    padding: 8,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 4,
    backgroundColor: '#F5F5F5',
  },
  pickerItemSelected: {
    backgroundColor: '#E17055',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#555',
  },
  pickerItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  timeCol: {
    alignItems: 'center',
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  modalCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#E17055',
  },
  modalConfirmText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
