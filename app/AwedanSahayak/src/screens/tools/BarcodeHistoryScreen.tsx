import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBarcodeHistory, deleteBarcodeHistory, clearBarcodeHistory } from '../../database/db';
import type { BarcodeHistory } from '../../types/database';
import { HistoryList, type HistoryItem } from '../../components/common/HistoryList';
import { barcodeTypeLabel } from '../../utils/barcodeUtils';
import { COLORS, SPACING } from '../../constants/theme';

export default function BarcodeHistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const load = useCallback(async () => {
    const rows = await getBarcodeHistory();
    const items: HistoryItem[] = rows.map((r: BarcodeHistory) => ({
      id: r.id,
      title: `${barcodeTypeLabel(r.barcode_type)}: ${r.raw_value.substring(0, 45)}${r.raw_value.length > 45 ? '...' : ''}`,
      subtitle: barcodeTypeLabel(r.barcode_type),
      date: new Date(r.scanned_at + 'Z').toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    }));
    setHistory(items);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <HistoryList
        data={history}
        emptyText="कोई स्कैन इतिहास नहीं"
        emptySubtext="बारकोड स्कैनर से स्कैन करें"
        onDelete={async (id) => { await deleteBarcodeHistory(id); load(); }}
        onClearAll={async () => { await clearBarcodeHistory(); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.md } });
