import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Linking,
  ActivityIndicator, AppState, type AppStateStatus,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { insertBarcodeHistory } from '../../database/db';
import { detectBarcodeType, isDangerousUri, barcodeTypeLabel, mapExpoBarcodeType } from '../../utils/barcodeUtils';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

type Props = NativeStackScreenProps<ToolsStackParamList, 'BarcodeScanner'>;

export default function BarcodeScannerScreen({ navigation }: Props) {
  const [flash, setFlash] = useState(false);
  const [scanned, setScanned] = useState<{ type: string; value: string } | null>(null);
  const [scanning, setScanning] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const lastScanRef = useRef<string>('');
  const appStateRef = useRef<AppStateStatus>('active');

  // Track app state to re-enable camera when coming to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        // App came to foreground — reset scanner
        if (!scanned) {
          setScanning(true);
          lastScanRef.current = '';
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [scanned]);

  // Reset when screen gains focus
  useEffect(() => {
    if (isFocused && !scanned) {
      setScanning(true);
      lastScanRef.current = '';
    }
  }, [isFocused]);

  const handleScan = useCallback(async (result: BarcodeScanningResult) => {
    if (!scanning) return;
    const val = result.data;
    if (!val || val === lastScanRef.current) return;
    lastScanRef.current = val;

    const barcodeType = mapExpoBarcodeType(result.type);
    setScanning(false);
    setScanned({ type: barcodeType, value: val });

    await insertBarcodeHistory({ barcode_type: barcodeType, raw_value: val });
  }, [scanning]);

  const copyValue = () => {
    if (!scanned) return;
    // Use Clipboard-like approach
    Alert.alert(
      'स्कैन रिज़ल्ट',
      scanned.value,
      [
        { text: 'कॉपी', onPress: () => {
          // Fallback — show for manual copy
          Alert.alert('कॉपी करें', 'स्क्रीन से टेक्स्ट सेलेक्ट करें।\n\n' + scanned.value);
        }},
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  const openUrl = () => {
    if (!scanned) return;
    const val = scanned.value;
    if (isDangerousUri(val)) {
      Alert.alert('⚠️ खतरनाक लिंक', 'यह लिंक सुरक्षित नहीं है — खोला नहीं जाएगा।');
      return;
    }
    if (/^https?:\/\//i.test(val)) {
      Alert.alert('लिंक खोलें?', `${val.substring(0, 80)}...\n\nक्या आप यह लिंक खोलना चाहते हैं?`, [
        { text: 'नहीं', style: 'cancel' },
        { text: 'खोलें', onPress: () => Linking.openURL(val).catch(() => Alert.alert('त्रुटि', 'लिंक नहीं खुल सका।')) },
      ]);
    }
  };

  const scanAgain = () => {
    setScanned(null);
    setScanning(true);
    lastScanRef.current = '';
  };

  // ── Permission handling ──────────────────────────────────────

  if (!permission) {
    // Still loading permission state
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>कैमरा जांच हो रही है...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="camera" size={64} color="#CCC" />
        <Text style={styles.permTitle}>कैमरा अनुमति आवश्यक</Text>
        <Text style={styles.permSubtitle}>
          QR कोड स्कैन करने के लिए कैमरा एक्सेस देना होगा।{'\n'}
          आपकी प्राइवेसी सुरक्षित है — कोई फोटो सेव नहीं होती।
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Ionicons name="camera" size={20} color="#FFF" />
          <Text style={styles.permBtnText}>कैमरा अनुमति दें</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.settingsText}>Settings में जाकर Permission दें</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Scanned result screen ────────────────────────────────────

  if (scanned) {
    const contentType = detectBarcodeType(scanned.value);
    const isUrl = contentType === 'url';
    const isUpi = contentType === 'upi';

    return (
      <View style={styles.container}>
        <View style={styles.resultCard}>
          <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
          <Text style={styles.resultTitle}>स्कैन सफल!</Text>
          <Text style={styles.resultType}>{barcodeTypeLabel(scanned.type)} • {barcodeTypeLabel(contentType)}</Text>
          <Text style={styles.resultValue} selectable>{scanned.value}</Text>
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={copyValue}>
              <Ionicons name="copy-outline" size={18} color="#FFF" />
              <Text style={styles.actionText}>कॉपी</Text>
            </TouchableOpacity>
            {isUrl && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.info }]} onPress={openUrl}>
                <Ionicons name="open-outline" size={18} color="#FFF" />
                <Text style={styles.actionText}>खोलें</Text>
              </TouchableOpacity>
            )}
            {isUpi && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.aiCleanup }]} onPress={openUrl}>
                <Ionicons name="card-outline" size={18} color="#FFF" />
                <Text style={styles.actionText}>UPI खोलें</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.textSecondary }]} onPress={scanAgain}>
              <Ionicons name="scan-outline" size={18} color="#FFF" />
              <Text style={styles.actionText}>फिर स्कैन</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.historyLink} onPress={() => navigation.navigate('BarcodeHistory')}>
          <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.historyText}>स्कैन इतिहास देखें</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Live camera view ─────────────────────────────────────────

  // Only render CameraView when screen is focused to avoid black screen
  if (!isFocused) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={flash}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'pdf417', 'aztec'] }}
        onBarcodeScanned={scanning ? handleScan : undefined}
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
          </View>
          <Text style={styles.overlayText}>बारकोड को फ्रेम में लाएं</Text>
          <TouchableOpacity style={styles.flashBtn} onPress={() => setFlash(!flash)}>
            <Ionicons name={flash ? 'flash' : 'flash-off'} size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F0' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#999' },
  camera: { flex: 1 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 250, height: 250, position: 'relative',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 20,
  },
  cornerTL: { position: 'absolute', top: -2, left: -2, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: COLORS.primary, borderTopLeftRadius: 8 },
  cornerTR: { position: 'absolute', top: -2, right: -2, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: COLORS.primary, borderTopRightRadius: 8 },
  cornerBL: { position: 'absolute', bottom: -2, left: -2, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: COLORS.primary, borderBottomLeftRadius: 8 },
  cornerBR: { position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: COLORS.primary, borderBottomRightRadius: 8 },
  overlayText: { color: '#FFF', fontSize: FONT.body, fontWeight: '600', marginTop: 24, opacity: 0.8 },
  flashBtn: {
    position: 'absolute', bottom: 60, backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: RADIUS.round, padding: 16,
  },
  // Permission screen
  permTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginTop: 20 },
  permSubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 40, lineHeight: 20 },
  permBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: 24, paddingVertical: 14, marginTop: 24,
  },
  permBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  settingsBtn: { marginTop: 14 },
  settingsText: { fontSize: 13, color: COLORS.info, textDecorationLine: 'underline' },
  // Result screen
  resultCard: {
    flex: 1, backgroundColor: COLORS.background, alignItems: 'center',
    justifyContent: 'center', padding: SPACING.xl,
  },
  resultTitle: { fontSize: FONT.sectionTitle, fontWeight: '700', color: COLORS.success, marginTop: 12 },
  resultType: { fontSize: FONT.caption, color: COLORS.textSecondary, marginTop: 4 },
  resultValue: {
    fontSize: FONT.body, color: COLORS.textPrimary, fontWeight: '600',
    textAlign: 'center', marginTop: SPACING.lg,
    backgroundColor: '#F5F5F5', borderRadius: RADIUS.sm,
    padding: SPACING.lg, width: '100%',
  },
  resultActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: SPACING.xl, justifyContent: 'center' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  actionText: { fontSize: FONT.bodySmall, fontWeight: '600', color: '#FFF' },
  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 16 },
  historyText: { fontSize: FONT.bodySmall, color: COLORS.textSecondary },
});
