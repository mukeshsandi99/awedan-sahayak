import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { insertCgpaHistory } from '../../database/db';
import { isValidCgpa, isValidPercentage } from '../../utils/validators';
import { CGPA_FORMULAS, CGPA_DISCLAIMER } from '../../utils/cgpaFormulas';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { ExportActionBar } from '../../components/common/ExportActionBar';

type Props = NativeStackScreenProps<ToolsStackParamList, 'CgpaCalculator'>;

export default function CgpaCalculatorScreen({ navigation }: Props) {
  const [mode, setMode] = useState<'cgpa_to_percent' | 'percent_to_cgpa'>('cgpa_to_percent');
  const [selectedFormula, setSelectedFormula] = useState(0);
  const [customMultiplier, setCustomMultiplier] = useState('9.5');
  const [inputValue, setInputValue] = useState('');
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formula = CGPA_FORMULAS[selectedFormula];
  const multiplier = selectedFormula === 2 ? parseFloat(customMultiplier) || 9.5 : 9.5;

  const calculate = useCallback(async () => {
    setError(null);
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError('कृपया मान डालें।');
      return;
    }

    const isValid = mode === 'cgpa_to_percent' ? isValidCgpa(trimmed) : isValidPercentage(trimmed);
    if (!isValid) {
      setError(mode === 'cgpa_to_percent' ? '0-10 के बीच CGPA डालें।' : '0-100 के बीच प्रतिशत डालें।');
      return;
    }

    const val = parseFloat(trimmed);
    let res: number;
    if (mode === 'cgpa_to_percent') {
      if (selectedFormula === 2) {
        res = Math.round(val * multiplier * 100) / 100;
      } else {
        res = formula.cgpaToPercent(val);
      }
    } else {
      if (selectedFormula === 2) {
        res = Math.round((val / multiplier) * 100) / 100;
      } else {
        res = formula.percentToCgpa(val);
      }
    }

    setResult(res);
    await insertCgpaHistory({
      mode,
      input_value: val,
      result_value: res,
      formula_used: selectedFormula === 2 ? `custom_${multiplier}` : formula.key,
    });
  }, [inputValue, mode, selectedFormula, multiplier]);

  const copyResult = () => {
    if (result === null) return;
    const text = mode === 'cgpa_to_percent'
      ? `CGPA ${inputValue} → ${result}% (${formula.labelHindi})`
      : `प्रतिशत ${inputValue}% → CGPA ${result} (${formula.labelHindi})`;
    Alert.alert('कॉपी करें', text);
  };

  const shareResult = async () => {
    if (result === null) return;
    const text = mode === 'cgpa_to_percent'
      ? `CGPA ${inputValue} = ${result}%\nफॉर्मूला: ${formula.labelHindi}\n\n${CGPA_DISCLAIMER}\n\nAwedan Sahayak ऐप से`
      : `प्रतिशत ${inputValue}% = CGPA ${result}\nफॉर्मूला: ${formula.labelHindi}\n\n${CGPA_DISCLAIMER}\n\nAwedan Sahayak ऐप से`;
    const { sharePlainText } = await import('../../utils/shareUtils');
    await sharePlainText(text, 'CGPA रिज़ल्ट शेयर करें');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <DisclaimerBanner text={CGPA_DISCLAIMER} type="info" />

      {/* Mode toggle */}
      <View style={styles.segRow}>
        {(['cgpa_to_percent', 'percent_to_cgpa'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.segBtn, mode === m && styles.segBtnActive]}
            onPress={() => { setMode(m); setResult(null); setInputValue(''); }}
          >
            <Text style={[styles.segText, mode === m && styles.segTextActive]}>
              {m === 'cgpa_to_percent' ? 'CGPA → %' : '% → CGPA'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Formula selector */}
      <Text style={styles.label}>फॉर्मूला चुनें</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.md, paddingHorizontal: SPACING.pageHorizontal }}>
        {CGPA_FORMULAS.map((f, i) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.formulaBtn, selectedFormula === i && styles.formulaBtnActive]}
            onPress={() => { setSelectedFormula(i); setResult(null); }}
          >
            <Text style={[styles.formulaText, selectedFormula === i && styles.formulaTextActive]} numberOfLines={2}>
              {i === 0 ? '× 9.5' : i === 1 ? '× 10' : 'कस्टम'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedFormula === 2 && (
        <View style={styles.customRow}>
          <Text style={styles.label}>कस्टम गुणक</Text>
          <TextInput
            style={styles.customInput}
            value={customMultiplier}
            onChangeText={setCustomMultiplier}
            keyboardType="decimal-pad"
            placeholder="9.5"
          />
        </View>
      )}

      {/* Input */}
      <Text style={styles.label}>
        {mode === 'cgpa_to_percent' ? 'CGPA डालें (0-10)' : 'प्रतिशत डालें (0-100)'}
      </Text>
      <TextInput
        style={styles.input}
        value={inputValue}
        onChangeText={(t) => { setInputValue(t); setResult(null); setError(null); }}
        keyboardType="decimal-pad"
        placeholder={mode === 'cgpa_to_percent' ? 'जैसे 8.5' : 'जैसे 80.75'}
        placeholderTextColor="#CCC"
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={styles.calcBtn} onPress={calculate} activeOpacity={0.7}>
        <Ionicons name="calculator" size={20} color="#FFF" />
        <Text style={styles.calcBtnText}>कैलकुलेट करें</Text>
      </TouchableOpacity>

      {/* Result */}
      {result !== null && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>
            {mode === 'cgpa_to_percent' ? 'प्रतिशत' : 'CGPA'}
          </Text>
          <Text style={styles.resultValue}>
            {mode === 'cgpa_to_percent' ? `${result}%` : `${result}`}
          </Text>
          <Text style={styles.resultDetail}>
            {mode === 'cgpa_to_percent'
              ? `CGPA ${inputValue} → ${result}%`
              : `${inputValue}% → CGPA ${result}`}
          </Text>
          <Text style={styles.resultFormula}>{formula.labelHindi}</Text>
        </View>
      )}

      {result !== null && (
        <ExportActionBar
          actions={[
            { key: 'copy', label: 'कॉपी', icon: 'copy-outline', onPress: copyResult, color: COLORS.primary },
            { key: 'share', label: 'शेयर', icon: 'share-outline', onPress: shareResult, color: COLORS.info },
            { key: 'reset', label: 'रीसेट', icon: 'refresh-outline', onPress: () => { setInputValue(''); setResult(null); setError(null); }, color: COLORS.textSecondary },
            { key: 'history', label: 'इतिहास', icon: 'time-outline', onPress: () => navigation.navigate('CgpaHistory'), color: COLORS.aiCleanup },
          ]}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  segRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.pageHorizontal,
    marginBottom: SPACING.lg,
    backgroundColor: '#F0E8E0',
    borderRadius: RADIUS.md,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  segBtnActive: { backgroundColor: COLORS.primary },
  segText: { fontSize: FONT.bodySmall, fontWeight: '600', color: COLORS.textSecondary },
  segTextActive: { color: '#FFF' },
  label: {
    fontSize: FONT.bodySmall,
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.pageHorizontal,
    marginBottom: 6,
  },
  formulaBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderInput,
    backgroundColor: COLORS.card,
  },
  formulaBtnActive: { borderColor: COLORS.primary, backgroundColor: '#FFF0ED' },
  formulaText: { fontSize: FONT.caption, fontWeight: '600', color: COLORS.textSecondary },
  formulaTextActive: { color: COLORS.primary },
  customRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.md, gap: 12 },
  customInput: {
    borderWidth: 1,
    borderColor: COLORS.borderInput,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FONT.body,
    width: 80,
    textAlign: 'center',
    backgroundColor: COLORS.card,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderInput,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: SPACING.pageHorizontal,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
  },
  errorText: {
    fontSize: FONT.caption,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.pageHorizontal,
  },
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.pageHorizontal,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    marginBottom: SPACING.xl,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  calcBtnText: { fontSize: FONT.body, fontWeight: '700', color: '#FFF' },
  resultCard: {
    backgroundColor: '#F0FFF4',
    borderWidth: 2,
    borderColor: COLORS.success,
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.pageHorizontal,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  resultLabel: { fontSize: FONT.bodySmall, color: COLORS.textSecondary },
  resultValue: { fontSize: 48, fontWeight: '700', color: COLORS.success, marginVertical: 4 },
  resultDetail: { fontSize: FONT.body, color: COLORS.textPrimary, marginTop: 4 },
  resultFormula: { fontSize: FONT.caption, color: COLORS.textSecondary, marginTop: 4 },
});
