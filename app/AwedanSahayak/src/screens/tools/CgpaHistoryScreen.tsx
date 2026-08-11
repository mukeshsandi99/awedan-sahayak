import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getCgpaHistory, clearCgpaHistory } from '../../database/db';
import type { CgpaHistory } from '../../types/database';
import { HistoryList, type HistoryItem } from '../../components/common/HistoryList';
import { COLORS, FONT, SPACING } from '../../constants/theme';

export default function CgpaHistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const load = useCallback(async () => {
    const rows = await getCgpaHistory();
    const items: HistoryItem[] = rows.map((r: CgpaHistory) => ({
      id: r.id,
      title: r.mode === 'cgpa_to_percent'
        ? `CGPA ${r.input_value} → ${r.result_value}%`
        : `${r.input_value}% → CGPA ${r.result_value}`,
      subtitle: `फॉर्मूला: ${r.formula_used}`,
      date: new Date(r.created_at + 'Z').toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    }));
    setHistory(items);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <HistoryList
        data={history}
        emptyText="कोई कैलकुलेशन नहीं"
        emptySubtext="CGPA कैलकुलेटर से गणना करें"
        onClearAll={async () => { await clearCgpaHistory(); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.md },
});
