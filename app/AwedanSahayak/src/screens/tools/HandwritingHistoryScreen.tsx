import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getHandwritingDocuments, deleteHandwritingDocument } from '../../database/db';
import type { HandwritingDocument } from '../../types/database';
import { HistoryList, type HistoryItem } from '../../components/common/HistoryList';
import { COLORS, SPACING } from '../../constants/theme';

export default function HandwritingHistoryScreen() {
  const navigation = useNavigation<any>();
  const [docs, setDocs] = useState<HistoryItem[]>([]);

  const load = useCallback(async () => {
    const rows = await getHandwritingDocuments();
    const items: HistoryItem[] = rows.map((d: HandwritingDocument) => ({
      id: d.id,
      title: d.title ?? 'हस्तलिखित टेक्स्ट',
      subtitle: `${d.page_style} | ${d.ink_color} | ${d.font_size}px | ${d.input_text.length} अक्षर`,
      date: new Date(d.created_at + 'Z').toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    }));
    setDocs(items);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <HistoryList
        data={docs}
        emptyText="कोई हस्तलिखित दस्तावेज़ नहीं"
        emptySubtext="हस्तलिखित टेक्स्ट जनरेटर से बनाएं"
        onPress={(item) => navigation.navigate('HandwritingPreview', { docId: item.id })}
        onDelete={async (id) => { await deleteHandwritingDocument(id); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.md } });
