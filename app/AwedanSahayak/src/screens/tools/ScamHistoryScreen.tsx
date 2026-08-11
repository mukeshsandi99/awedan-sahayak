import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSafetyChecks, deleteSafetyCheck, clearSafetyChecks } from '../../database/db';
import type { SafetyCheck } from '../../types/database';
import { HistoryList, type HistoryItem } from '../../components/common/HistoryList';
import { COLORS, SPACING } from '../../constants/theme';

const RISK_EMOJI: Record<string, string> = { low: '🟢', caution: '🟡', high: '🔴' };

export default function ScamHistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const load = useCallback(async () => {
    const rows = await getSafetyChecks();
    const items: HistoryItem[] = rows.map((r: SafetyCheck) => ({
      id: r.id,
      title: `${RISK_EMOJI[r.risk_level] ?? ''} ${r.input_type.toUpperCase()}: ${r.input_value.substring(0, 40)}${r.input_value.length > 40 ? '...' : ''}`,
      subtitle: `जोखिम: ${r.risk_level === 'high' ? 'उच्च' : r.risk_level === 'caution' ? 'सावधानी' : 'कम'}`,
      date: new Date(r.created_at + 'Z').toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    }));
    setHistory(items);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <HistoryList
        data={history}
        emptyText="कोई जांच इतिहास नहीं"
        emptySubtext="सुरक्षा जांच करें"
        onDelete={async (id) => { await deleteSafetyCheck(id); load(); }}
        onClearAll={async () => { await clearSafetyChecks(); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.md },
});
