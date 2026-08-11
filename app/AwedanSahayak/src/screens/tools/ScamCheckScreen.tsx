import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { insertSafetyCheck } from '../../database/db';
import { analyzeUrl } from '../../utils/urlSafetyCheck';
import { analyzeUpiId, analyzeMobile } from '../../utils/upiSafetyCheck';
import { isValidUrl, isValidUpiId, isValidMobile } from '../../utils/validators';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { ResultCard } from '../../components/common/ResultCard';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { ExportActionBar } from '../../components/common/ExportActionBar';

type Props = NativeStackScreenProps<ToolsStackParamList, 'ScamCheck'>;

const SAFETY_DISCLAIMER =
  'यह जांच केवल सावधानी के लिए है। यह किसी लिंक, व्यक्ति या UPI ID के सुरक्षित होने की गारंटी नहीं देती। OTP, UPI PIN, CVV या स्क्रीन शेयर कभी न करें।';

type InputType = 'url' | 'upi' | 'mobile' | 'payment_text' | 'qr_result';

const TABS: { key: InputType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'url', label: 'URL', icon: 'link' },
  { key: 'upi', label: 'UPI ID', icon: 'card' },
  { key: 'mobile', label: 'मोबाइल', icon: 'call' },
  { key: 'payment_text', label: 'पेमेंट', icon: 'receipt' },
  { key: 'qr_result', label: 'QR', icon: 'qr-code' },
];

export default function ScamCheckScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<InputType>('url');
  const [inputValue, setInputValue] = useState('');
  const [contextText, setContextText] = useState('');
  const [result, setResult] = useState<{ riskLevel: 'low' | 'caution' | 'high'; reasonsHindi: string[]; title: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const runCheck = useCallback(async () => {
    if (!inputValue.trim()) {
      Alert.alert('इनपुट खाली', 'कृपया जांच के लिए इनपुट डालें।');
      return;
    }
    setChecking(true);
    await new Promise((r) => setTimeout(r, 300)); // small delay for UX

    let title = '';
    let riskLevel: 'low' | 'caution' | 'high' = 'low';
    let reasonsHindi: string[] = [];

    switch (activeTab) {
      case 'url': {
        const r = analyzeUrl(inputValue);
        riskLevel = r.riskLevel;
        reasonsHindi = r.reasonsHindi;
        title = `URL: ${inputValue.substring(0, 50)}${inputValue.length > 50 ? '...' : ''}`;
        break;
      }
      case 'upi': {
        const r = analyzeUpiId(inputValue, contextText || undefined);
        riskLevel = r.riskLevel;
        reasonsHindi = r.reasonsHindi;
        title = `UPI: ${inputValue}`;
        break;
      }
      case 'mobile': {
        const r = analyzeMobile(inputValue);
        riskLevel = r.riskLevel;
        reasonsHindi = r.reasonsHindi;
        title = `मोबाइल: ${inputValue}`;
        break;
      }
      case 'payment_text': {
        // Payment text analysis: check for UPI/URL/OTP patterns in text
        const hasUrl = /https?:\/\/[^\s]+/.test(inputValue);
        const hasUpi = /[a-zA-Z0-9._-]+@[a-zA-Z0-9]+/.test(inputValue);
        const hasOtp = /otp|ओटीपी|pin|पिन/i.test(inputValue);
        const hasScreenShare = /screen\s*share|स्क्रीन\s*शेयर/i.test(inputValue);
        reasonsHindi = [];
        if (hasOtp) { reasonsHindi.push('🚨 OTP/PIN मांगा जा रहा है — कभी शेयर न करें!'); riskLevel = 'high'; }
        if (hasScreenShare) { reasonsHindi.push('🚨 स्क्रीन शेयर का अनुरोध — स्कैम का प्रमुख संकेत!'); riskLevel = 'high'; }
        if (hasUrl) { reasonsHindi.push('⚠️ मैसेज में URL लिंक है — क्लिक करने से पहले जांचें।'); if (riskLevel !== 'high') riskLevel = 'caution'; }
        if (hasUpi) { reasonsHindi.push('⚠️ मैसेज में UPI ID है — पैसे भेजने से पहले सुनिश्चित करें।'); if (riskLevel !== 'high') riskLevel = 'caution'; }
        if (reasonsHindi.length === 0) { reasonsHindi.push('✅ कोई स्पष्ट खतरा नहीं मिला। फिर भी सावधान रहें।'); riskLevel = 'low'; }
        title = 'पेमेंट टेक्स्ट जांच';
        break;
      }
      case 'qr_result': {
        // QR scan result — check if it's a URL or UPI
        const trimmed = inputValue.trim();
        if (/^https?:\/\//i.test(trimmed)) {
          const r = analyzeUrl(trimmed);
          riskLevel = r.riskLevel; reasonsHindi = r.reasonsHindi;
          title = `QR → URL: ${trimmed.substring(0, 40)}...`;
        } else if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(trimmed)) {
          const r = analyzeUpiId(trimmed);
          riskLevel = r.riskLevel; reasonsHindi = r.reasonsHindi;
          title = `QR → UPI: ${trimmed}`;
        } else if (/^upi:\/\//i.test(trimmed)) {
          const upiMatch = trimmed.match(/pa[%=](\w+@\w+)/i);
          if (upiMatch) {
            const r = analyzeUpiId(upiMatch[1], trimmed);
            riskLevel = r.riskLevel; reasonsHindi = r.reasonsHindi;
            title = `QR → UPI भुगतान: ${upiMatch[1]}`;
          } else {
            reasonsHindi = ['⚠️ QR कोड में UPI भुगतान लिंक है — भुगतान से पहले सत्यापित करें।'];
            riskLevel = 'caution'; title = 'QR → UPI भुगतान';
          }
        } else {
          reasonsHindi = ['⚠️ QR कोड से प्राप्त डेटा — सावधानी से जांचें।', `प्राप्त: ${trimmed.substring(0, 100)}`];
          riskLevel = 'caution'; title = 'QR स्कैन रिज़ल्ट';
        }
        break;
      }
    }

    const final = { riskLevel, reasonsHindi, title };
    setResult(final);

    // Save to DB
    await insertSafetyCheck({
      input_type: activeTab,
      input_value: inputValue,
      risk_level: riskLevel,
      reasons: JSON.stringify(reasonsHindi),
    });
    setChecking(false);
  }, [inputValue, activeTab, contextText]);

  const shareReport = async () => {
    if (!result) return;
    const text = [
      `🔒 Awedan Sahayak — सुरक्षा जांच रिपोर्ट`,
      `प्रकार: ${TABS.find(t => t.key === activeTab)?.label}`,
      `इनपुट: ${inputValue}`,
      `जोखिम: ${result.riskLevel === 'high' ? 'उच्च' : result.riskLevel === 'caution' ? 'सावधानी' : 'कम'}`,
      '',
      ...result.reasonsHindi,
      '',
      SAFETY_DISCLAIMER,
    ].join('\n');

    const { sharePlainText } = await import('../../utils/shareUtils');
    await sharePlainText(text, 'सुरक्षा रिपोर्ट शेयर करें');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {/* Tab selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => { setActiveTab(tab.key); setResult(null); setInputValue(''); setContextText(''); }}
          >
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#FFF' : COLORS.textSecondary} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input area */}
      <Text style={styles.label}>
        {activeTab === 'url' ? 'URL / लिंक डालें' :
         activeTab === 'upi' ? 'UPI ID डालें (जैसे user@okhdfcbank)' :
         activeTab === 'mobile' ? 'मोबाइल नंबर डालें' :
         activeTab === 'qr_result' ? 'QR कोड स्कैन रिज़ल्ट डालें' :
         'पेमेंट मैसेज/टेक्स्ट डालें'}
      </Text>
      <TextInput
        style={[styles.input, (activeTab === 'payment_text' || activeTab === 'qr_result') && styles.textArea]}
        value={inputValue}
        onChangeText={(t) => { setInputValue(t); setResult(null); }}
        keyboardType={activeTab === 'mobile' ? 'phone-pad' : activeTab === 'url' ? 'url' : 'default'}
        placeholder={
          activeTab === 'url' ? 'https://example.com' :
          activeTab === 'upi' ? 'username@okhdfcbank' :
          activeTab === 'mobile' ? '9876543210' :
          activeTab === 'qr_result' ? 'QR कोड स्कैन करके प्राप्त टेक्स्ट/URL/UPI यहां पेस्ट करें...' :
          'पूरा पेमेंट मैसेज यहां पेस्ट करें...'
        }
        placeholderTextColor="#CCC"
        multiline={activeTab === 'payment_text' || activeTab === 'qr_result'}
        numberOfLines={activeTab === 'payment_text' || activeTab === 'qr_result' ? 4 : 1}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* UPI context field */}
      {activeTab === 'upi' && (
        <>
          <Text style={styles.label}>पेमेंट रिक्वेस्ट / मैसेज (वैकल्पिक)</Text>
          <TextInput
            style={styles.textArea}
            value={contextText}
            onChangeText={setContextText}
            placeholder="अगर कोई UPI पेमेंट रिक्वेस्ट / कलेक्ट मैसेज आया है, तो यहां डालें..."
            placeholderTextColor="#CCC"
            multiline
            numberOfLines={3}
          />
        </>
      )}

      {/* Check button */}
      <TouchableOpacity style={styles.checkBtn} onPress={runCheck} activeOpacity={0.7}>
        <Ionicons name="shield-checkmark" size={20} color="#FFF" />
        <Text style={styles.checkBtnText}>जांच करें</Text>
      </TouchableOpacity>

      {/* Result */}
      {result && (
        <>
          <ResultCard riskLevel={result.riskLevel} reasons={result.reasonsHindi} title={result.title} />
          <ExportActionBar
            actions={[
              { key: 'copy', label: 'कॉपी', icon: 'copy-outline', onPress: () => Alert.alert('रिपोर्ट', result.reasonsHindi.join('\n')), color: COLORS.primary },
              { key: 'share', label: 'शेयर', icon: 'share-outline', onPress: shareReport, color: COLORS.info },
              { key: 'history', label: 'इतिहास', icon: 'time-outline', onPress: () => navigation.navigate('ScamHistory'), color: COLORS.aiCleanup },
            ]}
          />
        </>
      )}

      {/* Mandatory disclaimer — always visible */}
      <DisclaimerBanner text={SAFETY_DISCLAIMER} type="warning" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  tabScroll: { marginBottom: SPACING.lg },
  tabContent: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.pageHorizontal },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.borderInput,
    backgroundColor: COLORS.card,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: FONT.bodySmall, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#FFF' },
  label: {
    fontSize: FONT.bodySmall,
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.pageHorizontal,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderInput,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    fontSize: FONT.body,
    marginHorizontal: SPACING.pageHorizontal,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.borderInput,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    fontSize: FONT.bodySmall,
    marginHorizontal: SPACING.pageHorizontal,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.danger,
    marginHorizontal: SPACING.pageHorizontal,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    marginBottom: SPACING.xl,
  },
  checkBtnText: { fontSize: FONT.body, fontWeight: '700', color: '#FFF' },
});
