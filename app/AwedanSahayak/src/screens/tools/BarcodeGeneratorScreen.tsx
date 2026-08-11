import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SvgQRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { insertBarcodeHistory } from '../../database/db';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

type Props = NativeStackScreenProps<ToolsStackParamList, 'BarcodeGenerator'>;

type GenType = 'text' | 'url' | 'phone' | 'email' | 'wifi' | 'upi';

const GEN_TYPES: { key: GenType; label: string; icon: keyof typeof Ionicons.glyphMap; placeholder: string }[] = [
  { key: 'text', label: 'टेक्स्ट', icon: 'text', placeholder: 'कोई भी टेक्स्ट...' },
  { key: 'url', label: 'URL', icon: 'link', placeholder: 'https://example.com' },
  { key: 'phone', label: 'फ़ोन', icon: 'call', placeholder: '9876543210' },
  { key: 'email', label: 'ईमेल', icon: 'mail', placeholder: 'user@example.com' },
  { key: 'wifi', label: 'Wi-Fi', icon: 'wifi', placeholder: 'WIFI:S:SSID;T:WPA;P:password;;' },
  { key: 'upi', label: 'UPI', icon: 'card', placeholder: 'upi://pay?pa=user@bank&pn=Name' },
];

const QR_SIZE = 250;

export default function BarcodeGeneratorScreen({ navigation }: Props) {
  const [genType, setGenType] = useState<GenType>('text');
  const [inputValue, setInputValue] = useState('');
  const [generated, setGenerated] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const svgRef = useRef<any>(null);

  const generate = async () => {
    if (!inputValue.trim()) { Alert.alert('खाली इनपुट', 'कृपया टेक्स्ट डालें।'); return; }
    const val = inputValue.trim();
    setGenerated(val);
    setShowRaw(false);
    await insertBarcodeHistory({ barcode_type: 'qr', raw_value: val });
  };

  /**
   * Capture QR SVG as a real PNG image and save to device.
   * Uses react-native-qrcode-svg's toDataURL() to get base64 PNG.
   */
  const saveImage = useCallback(async () => {
    if (!generated || !svgRef.current) return;
    setSaving(true);
    try {
      // Get PNG data URL from the QR SVG ref
      const dataUrl: string = await new Promise((resolve, reject) => {
        if (!svgRef.current) return reject(new Error('No ref'));
        svgRef.current.toDataURL((uri: string) => {
          if (uri) resolve(uri);
          else reject(new Error('Failed to get image data'));
        });
      });

      // Extract base64 from data URL
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const filename = `QR_${Date.now()}.png`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Share as image (also saves to device)
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'QR इमेज सेव / शेयर करें',
      });
      Alert.alert('✅ सेव हो गया', 'QR इमेज सेव हो गई है।');
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.message || 'QR इमेज सेव नहीं हो सकी।');
    } finally {
      setSaving(false);
    }
  }, [generated]);

  const shareImage = useCallback(async () => {
    if (!generated || !svgRef.current) return;
    setSaving(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        if (!svgRef.current) return reject(new Error('No ref'));
        svgRef.current.toDataURL((uri: string) => {
          if (uri) resolve(uri);
          else reject(new Error('Failed to get image data'));
        });
      });

      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const filename = `QR_${Date.now()}.png`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'QR इमेज शेयर करें',
      });
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.message || 'शेयर नहीं हो सका।');
    } finally {
      setSaving(false);
    }
  }, [generated]);

  const reset = () => {
    setInputValue('');
    setGenerated(null);
    setShowRaw(false);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {/* Type selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.lg }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.pageHorizontal }}>
          {GEN_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeChip, genType === t.key && styles.typeChipActive]}
              onPress={() => { setGenType(t.key); setInputValue(''); setGenerated(null); }}
            >
              <Ionicons name={t.icon} size={14} color={genType === t.key ? '#FFF' : COLORS.textSecondary} />
              <Text style={[styles.typeChipText, genType === t.key && styles.typeChipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Input */}
      <TextInput
        style={styles.input}
        value={inputValue}
        onChangeText={(t) => { setInputValue(t); setGenerated(null); }}
        placeholder={GEN_TYPES.find((t) => t.key === genType)?.placeholder ?? ''}
        placeholderTextColor="#CCC"
        multiline={genType === 'wifi'}
        autoCapitalize="none"
      />

      {/* Generate button */}
      <TouchableOpacity style={styles.genBtn} onPress={generate} activeOpacity={0.7}>
        <Ionicons name="qr-code" size={20} color="#FFF" />
        <Text style={styles.genBtnText}>QR जनरेट करें</Text>
      </TouchableOpacity>

      {/* QR Preview */}
      {generated && (
        <View style={styles.qrCard}>
          <View style={styles.qrContainer}>
            <SvgQRCode
              value={generated}
              size={QR_SIZE}
              backgroundColor="#FFF"
              color="#000"
              getRef={(ref) => { svgRef.current = ref; }}
            />
          </View>

          {/* Type badge */}
          <View style={styles.typeBadge}>
            <Ionicons name={GEN_TYPES.find(t => t.key === genType)?.icon ?? 'text'} size={14} color="#666" />
            <Text style={styles.typeBadgeText}>{GEN_TYPES.find(t => t.key === genType)?.label ?? genType}</Text>
          </View>

          {/* Optional raw data reveal */}
          {showRaw && (
            <Text style={styles.qrValue} selectable>{generated}</Text>
          )}

          {/* Action buttons */}
          <View style={styles.qrActions}>
            <TouchableOpacity style={styles.qrActionBtn} onPress={saveImage} disabled={saving}>
              <Ionicons name="save-outline" size={18} color="#FFF" />
              <Text style={styles.qrActionText}>{saving ? '...' : 'सेव'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.qrActionBtn, { backgroundColor: '#0984E3' }]} onPress={shareImage} disabled={saving}>
              <Ionicons name="share-outline" size={18} color="#FFF" />
              <Text style={styles.qrActionText}>शेयर</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.qrActionBtn, { backgroundColor: showRaw ? '#D63031' : COLORS.textSecondary }]}
              onPress={() => setShowRaw(!showRaw)}
            >
              <Ionicons name={showRaw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#FFF" />
              <Text style={styles.qrActionText}>{showRaw ? 'छुपाएं' : 'डेटा'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.qrActions}>
            <TouchableOpacity style={[styles.qrActionBtn, { backgroundColor: '#00B894' }]} onPress={reset}>
              <Ionicons name="refresh-outline" size={18} color="#FFF" />
              <Text style={styles.qrActionText}>रीसेट</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.qrActionBtn, { backgroundColor: COLORS.textSecondary }]} onPress={() => navigation.navigate('BarcodeHistory')}>
              <Ionicons name="time-outline" size={18} color="#FFF" />
              <Text style={styles.qrActionText}>इतिहास</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.round,
    borderWidth: 1, borderColor: COLORS.borderInput, backgroundColor: COLORS.card,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: FONT.caption, color: COLORS.textSecondary },
  typeChipTextActive: { color: '#FFF' },
  input: {
    borderWidth: 1, borderColor: COLORS.borderInput, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 14, fontSize: FONT.body,
    marginHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.md,
    backgroundColor: COLORS.card, color: COLORS.textPrimary,
  },
  genBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00B894', marginHorizontal: SPACING.pageHorizontal,
    borderRadius: RADIUS.md, paddingVertical: 14, marginBottom: SPACING.xl,
  },
  genBtnText: { fontSize: FONT.body, fontWeight: '700', color: '#FFF' },
  qrCard: {
    backgroundColor: COLORS.card, marginHorizontal: SPACING.pageHorizontal,
    borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  qrContainer: { padding: 16, backgroundColor: '#FFF', borderRadius: RADIUS.md, marginBottom: SPACING.md },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F5F5', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: RADIUS.round, marginBottom: SPACING.md,
  },
  typeBadgeText: { fontSize: FONT.caption, color: '#666', fontWeight: '600' },
  qrValue: {
    fontSize: FONT.bodySmall, color: COLORS.textPrimary, textAlign: 'center',
    marginBottom: SPACING.lg, fontWeight: '600',
    backgroundColor: '#FFF8E1', borderRadius: RADIUS.sm,
    padding: SPACING.md, width: '100%',
  },
  qrActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, justifyContent: 'center' },
  qrActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  qrActionText: { fontSize: FONT.bodySmall, fontWeight: '600', color: '#FFF' },
});
