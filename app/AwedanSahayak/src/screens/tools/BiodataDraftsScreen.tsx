import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getBiodataDrafts, deleteBiodataDraft } from '../../database/db';
import type { MarriageBiodataDraft } from '../../types/database';
import { HistoryList, type HistoryItem } from '../../components/common/HistoryList';
import { COLORS, SPACING } from '../../constants/theme';

export default function BiodataDraftsScreen() {
  const navigation = useNavigation<any>();
  const [drafts, setDrafts] = useState<HistoryItem[]>([]);

  const load = useCallback(async () => {
    const rows = await getBiodataDrafts();
    const items: HistoryItem[] = rows.map((d: MarriageBiodataDraft) => ({
      id: d.id,
      title: d.full_name ?? 'बिना नाम',
      subtitle: `टेम्पलेट: ${d.template_style} | ${d.is_draft ? 'ड्राफ्ट' : 'पूर्ण'}`,
      date: new Date(d.updated_at + 'Z').toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    }));
    setDrafts(items);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <HistoryList
        data={drafts}
        emptyText="कोई बायोडाटा ड्राफ्ट नहीं"
        emptySubtext="बायोडाटा मेकर से नया बनाएं"
        onPress={(item) => navigation.navigate('BiodataPreview', { draftId: item.id })}
        onDelete={async (id) => { await deleteBiodataDraft(id); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.md } });
