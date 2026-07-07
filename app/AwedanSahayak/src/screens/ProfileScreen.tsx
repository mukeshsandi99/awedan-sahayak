/**
 * ProfileScreen — user profile management with Aadhar OCR.
 *
 * Features:
 *   - "आधार से भरें" button to auto-fill from Aadhar card scan
 *   - Two-side scan flow: front (name/DOB/gender) → back (address/phone)
 *   - Privacy notice before scanning
 *   - Review/edit screen for extracted data before saving
 *   - All processing on-device, Aadhar number always redacted
 *   - Profile data stored locally in SQLite
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfile, createUserProfile, updateUserProfile, parseAddressComponents } from '../database/db';
import type { UserProfile } from '../types/database';
import { scanAadharCard, type AadharExtractedData } from '../services/aadhar';

// ── Component ───────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ── OCR flow state ──────────────────────────────────────────────
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningSide, setScanningSide] = useState<'front' | 'back'>('front');
  const [showBackPrompt, setShowBackPrompt] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [extractedData, setExtractedData] = useState<AadharExtractedData | null>(null);
  const [saving, setSaving] = useState(false);

  // Accumulated data across both sides
  const [frontData, setFrontData] = useState<{ name: string | null; dob: string | null; gender: string | null } | null>(null);
  const [backData, setBackData] = useState<{ address: string | null; phone: string | null } | null>(null);

  // Editable review fields
  const [reviewName, setReviewName] = useState('');
  const [reviewDob, setReviewDob] = useState('');
  const [reviewGender, setReviewGender] = useState('');
  const [reviewAddress, setReviewAddress] = useState('');
  const [reviewPhone, setReviewPhone] = useState('');

  // ── Load profile ────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    try {
      const p = await getUserProfile();
      setProfile(p);
    } catch (err: any) {
      console.error('[Profile] Load failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ── OCR flow ────────────────────────────────────────────────────

  /** Scan the FRONT side of the Aadhar card (name, DOB, gender). */
  const handleScanFront = async () => {
    setShowPrivacyNotice(false);
    setScanningSide('front');
    setScanning(true);

    try {
      const data = await scanAadharCard();

      if (!data.name && !data.dob) {
        Alert.alert(
          '❌ कुछ नहीं मिला',
          'आधार के सामने वाले हिस्से से कोई जानकारी नहीं पढ़ी जा सकी। कृपया साफ़ फोटो लें और पुनः प्रयास करें।\n\nNo data could be extracted from the front side. Please take a clearer photo.',
        );
        return;
      }

      // Store front-side results
      setFrontData({ name: data.name, dob: data.dob, gender: data.gender });

      // Pre-populate what we have so far
      setReviewName(data.name ?? '');
      setReviewDob(data.dob ?? '');
      setReviewGender(data.gender ?? '');

      // Ask user to scan back side
      setShowBackPrompt(true);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg === 'CAMERA_PERMISSION_DENIED') {
        Alert.alert(
          '📷 कैमरा अनुमति',
          'कैमरा की अनुमति नहीं दी गई। कृपया सेटिंग्स में जाकर कैमरा अनुमति दें।',
        );
      } else if (msg === 'CAMERA_CANCELLED') {
        // User cancelled — no action needed
      } else {
        console.error('[Profile] Front OCR error:', msg);
        Alert.alert('❌ OCR त्रुटि', 'आधार स्कैन करने में त्रुटि आई।\n\n' + msg);
      }
    } finally {
      setScanning(false);
    }
  };

  /** Scan the BACK side of the Aadhar card (address, phone). */
  const handleScanBack = async () => {
    setShowBackPrompt(false);
    setScanningSide('back');
    setScanning(true);

    try {
      const data = await scanAadharCard();

      // Store back-side results
      setBackData({ address: data.address, phone: data.phone_number });

      // Merge with front data
      setReviewAddress(data.address ?? reviewAddress);
      setReviewPhone(data.phone_number ?? reviewPhone);

      // Proceed to review
      showReviewScreen();
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg === 'CAMERA_PERMISSION_DENIED') {
        Alert.alert('📷 कैमरा अनुमति', 'कैमरा की अनुमति नहीं दी गई।');
      } else if (msg === 'CAMERA_CANCELLED') {
        // User cancelled back scan — go to review with what we have
        showReviewScreen();
      } else {
        console.error('[Profile] Back OCR error:', msg);
        // Still allow proceeding
        Alert.alert(
          '⚠️ पिछला हिस्सा नहीं पढ़ा जा सका',
          'पते की जानकारी नहीं पढ़ी जा सकी। आप रिव्यु स्क्रीन पर जाकर खुद भर सकते हैं।\n\nBack side could not be read. You can fill address manually on the review screen.',
        );
        showReviewScreen();
      }
    } finally {
      setScanning(false);
    }
  };

  /** Skip back-side scan and go straight to review. */
  const handleSkipBack = () => {
    setShowBackPrompt(false);
    showReviewScreen();
  };

  /** Show the review screen with merged data. */
  const showReviewScreen = () => {
    const merged: AadharExtractedData = {
      name: reviewName || null,
      dob: reviewDob || null,
      gender: reviewGender || null,
      address: reviewAddress || null,
      phone_number: reviewPhone || null,
      rawText: '', // merged from two scans, raw text not meaningful
    };
    setExtractedData(merged);
    setShowReview(true);
  };

  // ── Save extracted data ─────────────────────────────────────────

  const handleSaveExtracted = async () => {
    setSaving(true);
    try {
      // Parse combined address into location components
      const parsed = parseAddressComponents(reviewAddress.trim() || '');

      if (__DEV__) { console.log('[Profile Save] Raw address:', reviewAddress); }
      if (__DEV__) { console.log('[Profile Save] Parsed components:', JSON.stringify(parsed)); }

      const updateData = {
        name: reviewName.trim() || null,
        dob: reviewDob || null,
        gender: reviewGender.trim() || (profile?.gender ?? null),
        address: parsed.cleanedAddress || (profile?.address ?? null),
        phone: reviewPhone.trim() || (profile?.phone ?? null),
        village: parsed.village || (profile?.village ?? null),
        post: parsed.post || (profile?.post ?? null),
        thana: parsed.thana || (profile?.thana ?? null),
        district: parsed.district || (profile?.district ?? null),
        state: parsed.state || (profile?.state ?? null),
        parent_spouse_name: parsed.parent_spouse_name || (profile?.parent_spouse_name ?? null),
        aadhar_last4: profile?.aadhar_last4 ?? null,
      };

      if (__DEV__) { console.log('[Profile Save] Writing to DB:', JSON.stringify(updateData)); }

      if (profile) {
        await updateUserProfile(updateData);
        if (__DEV__) { console.log('[Profile Save] updateUserProfile succeeded'); }
      } else {
        await createUserProfile({
          name: reviewName.trim() || 'नाम',
          dob: reviewDob || null,
          gender: reviewGender.trim() || null,
          address: parsed.cleanedAddress || null,
          phone: reviewPhone.trim() || null,
          village: parsed.village,
          post: parsed.post,
          thana: parsed.thana,
          district: parsed.district,
          state: parsed.state,
          parent_spouse_name: parsed.parent_spouse_name,
          aadhar_last4: null,
        });
      }

      setShowReview(false);
      setExtractedData(null);
      await loadProfile();
      Alert.alert('✅ प्रोफ़ाइल सेव हो गया', 'आपकी जानकारी सुरक्षित कर ली गई है।\n\nProfile saved successfully.');
    } catch (err: any) {
      console.error('[Profile] Save failed:', err?.message);
      Alert.alert('❌ सेव नहीं हो सका', err?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E17055" />
      </View>
    );
  }

  const hasProfile = profile != null && (profile.name || profile.address || profile.village || profile.phone);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>प्रोफ़ाइल</Text>
        <Text style={styles.subtitle}>Profile</Text>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{hasProfile ? '🙂' : '👤'}</Text>
          </View>
          {hasProfile ? (
            <>
              <Text style={styles.profileName}>{profile!.name}</Text>
              {profile!.address && (
                <Text style={styles.profileAddress}>{profile!.address}</Text>
              )}
              {profile!.phone && (
                <Text style={styles.profilePhone}>📞 {profile!.phone}</Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.profileName}>प्रोफ़ाइल नहीं बनी</Text>
              <Text style={styles.profileHint}>आधार कार्ड स्कैन करें या नीचे भरें</Text>
            </>
          )}

          {/* Aadhar scan button */}
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setShowPrivacyNotice(true)}
            activeOpacity={0.7}
            disabled={scanning}
          >
            {scanning ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.scanButtonText}>
                  {scanningSide === 'front'
                    ? 'सामने का हिस्सा स्कैन हो रहा है...'
                    : 'पिछला हिस्सा स्कैन हो रहा है...'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="scan-outline" size={20} color="#FFF" />
                <Text style={styles.scanButtonText}>आधार से भरें (Fill from Aadhar)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Manual edit fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>व्यक्तिगत जानकारी (Personal Info)</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>नाम</Text>
            <Text style={styles.fieldValue}>{profile?.name ?? '—'}</Text>
          </View>
          {profile?.parent_spouse_name && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>पिता/पति</Text>
              <Text style={styles.fieldValue}>{profile.parent_spouse_name}</Text>
            </View>
          )}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>लिंग</Text>
            <Text style={styles.fieldValue}>{profile?.gender ?? '—'}</Text>
          </View>
          {profile?.village && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>गाँव</Text>
              <Text style={styles.fieldValue}>{profile.village}</Text>
            </View>
          )}
          {profile?.post && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>पोस्ट</Text>
              <Text style={styles.fieldValue}>{profile.post}</Text>
            </View>
          )}
          {profile?.thana && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>थाना</Text>
              <Text style={styles.fieldValue}>{profile.thana}</Text>
            </View>
          )}
          {profile?.district && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>जिला</Text>
              <Text style={styles.fieldValue}>{profile.district}</Text>
            </View>
          )}
          {profile?.state && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>राज्य</Text>
              <Text style={styles.fieldValue}>{profile.state}</Text>
            </View>
          )}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>पता</Text>
            <Text style={styles.fieldValue}>{profile?.address ?? '—'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>फ़ोन</Text>
            <Text style={styles.fieldValue}>{profile?.phone ?? '—'}</Text>
          </View>
        </View>

        {/* ── About App ─────────────────────────────────────────── */}
        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>ऐप के बारे में / About App</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>आवेदन सहायक</Text>
            <Text style={styles.aboutValue}>Awedan Sahayak v1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutCredit}>
              एम.एम. एंटरप्राइजेज द्वारा निर्मित{'\n'}
              Created by M.M. Enterprises
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Privacy notice modal ─────────────────────────────────── */}
      <Modal visible={showPrivacyNotice} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="shield-checkmark" size={48} color="#E17055" />
            <Text style={styles.modalTitle}>आपकी जानकारी सुरक्षित है</Text>
            <Text style={styles.modalBody}>
              {'आपका आधार नंबर कभी सेव नहीं किया जाता।\n' +
                'केवल आपका नाम और पता निकाला जाता है।\n' +
                'आपकी फोटो OCR के लिए Google की सेवा में भेजी जाती है,\n' +
                'आधार नंबर हटा दिया जाता है और फोटो तुरंत बाद हटा दी जाती है।\n' +
                'हमारा सर्वर कोई फोटो स्टोर नहीं करता।\n\n' +
                'Your Aadhaar number is never stored.\n' +
                'Your photo is sent to Google for OCR only.\n' +
                'The Aadhaar number is removed and the photo\n' +
                'is deleted immediately after. Our server\n' +
                'never stores any photo.'}
            </Text>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleScanFront}
              activeOpacity={0.7}
            >
              <Text style={styles.continueText}>जारी रखें (Continue)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPrivacyNotice(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>रद्द करें</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Back-side prompt modal ─────────────────────────────── */}
      <Modal visible={showBackPrompt} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="copy-outline" size={48} color="#E17055" />
            <Text style={styles.modalTitle}>पिछला हिस्सा स्कैन करें</Text>
            <Text style={styles.modalBody}>
              {'आधार कार्ड के पिछले हिस्से पर आपका पता और\n' +
                'मोबाइल नंबर होता है। क्या आप इसे भी\n' +
                'स्कैन करना चाहेंगे?\n\n' +
                'The back side of your Aadhar card contains\n' +
                'your address and phone number. Would you\n' +
                'like to scan it as well?'}
            </Text>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleScanBack}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.continueText}>पिछला हिस्सा स्कैन करें (Scan Back)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipBack}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>छोड़ें (Skip)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Review/Edit modal ────────────────────────────────────── */}
      <Modal visible={showReview} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>जानकारी की पुष्टि करें</Text>
            <Text style={styles.reviewSubtitle}>OCR से पढ़ी गई जानकारी — गलतियाँ सुधारें</Text>

            <Text style={styles.reviewLabel}>नाम (Name)</Text>
            <TextInput
              style={styles.reviewInput}
              value={reviewName}
              onChangeText={setReviewName}
              placeholder="नाम"
            />

            <Text style={styles.reviewLabel}>जन्म तिथि (DOB)</Text>
            <TextInput
              style={styles.reviewInput}
              value={reviewDob}
              onChangeText={setReviewDob}
              placeholder="DD/MM/YYYY"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.reviewLabel}>लिंग (Gender)</Text>
            <TextInput
              style={styles.reviewInput}
              value={reviewGender}
              onChangeText={setReviewGender}
              placeholder="पुरुष / महिला"
            />

            <Text style={styles.reviewLabel}>पता (Address)</Text>
            <TextInput
              style={[styles.reviewInput, styles.reviewInputMultiline]}
              value={reviewAddress}
              onChangeText={setReviewAddress}
              placeholder="पूरा पता"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.reviewLabel}>मोबाइल नंबर (Mobile)</Text>
            <TextInput
              style={styles.reviewInput}
              value={reviewPhone}
              onChangeText={setReviewPhone}
              placeholder="10-अंकीय मोबाइल नंबर"
              keyboardType="phone-pad"
              maxLength={10}
            />

            <View style={styles.reviewButtonRow}>
              <TouchableOpacity
                style={styles.reviewCancelBtn}
                onPress={() => {
                  setShowReview(false);
                  setExtractedData(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewCancelText}>रद्द करें</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reviewSaveBtn}
                onPress={handleSaveExtracted}
                disabled={saving}
                activeOpacity={0.7}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.reviewSaveText}>सेव करें</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

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
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },

  // Profile card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 36,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
    textAlign: 'center',
  },
  profileAddress: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 18,
  },
  profilePhone: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  profileHint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E17055',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    marginTop: 8,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Section
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
    width: 80,
  },
  fieldValue: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A2E',
  },

  // About App
  aboutSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  aboutTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    marginBottom: 12,
  },
  aboutRow: {
    paddingVertical: 4,
  },
  aboutLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  aboutValue: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  aboutCredit: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  continueButton: {
    backgroundColor: '#E17055',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    color: '#999',
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 15,
    color: '#999',
    fontWeight: '500',
  },

  // Review modal
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  reviewSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 18,
  },
  reviewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginTop: 10,
  },
  reviewInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  reviewInputMultiline: {
    minHeight: 80,
    paddingTop: 10,
  },
  reviewButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  reviewCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  reviewCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  reviewSaveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#E17055',
    alignItems: 'center',
  },
  reviewSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
