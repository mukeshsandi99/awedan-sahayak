import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

export interface HistoryItem {
  id: number;
  title: string;
  subtitle: string;
  detail?: string;
  date: string;
}

interface HistoryListProps {
  data: HistoryItem[];
  onPress?: (item: HistoryItem) => void;
  onDelete?: (id: number) => void;
  onClearAll?: () => void;
  emptyText?: string;
  emptySubtext?: string;
}

export function HistoryList({ data, onPress, onDelete, onClearAll, emptyText, emptySubtext }: HistoryListProps) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="time-outline" size={48} color="#CCC" />
        <Text style={styles.emptyText}>{emptyText ?? 'कोई इतिहास नहीं'}</Text>
        <Text style={styles.emptySubtext}>{emptySubtext ?? 'No history yet'}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {onClearAll && data.length > 0 && (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => {
            Alert.alert(
              'साफ़ करें?', 'पूरा इतिहास हटा दिया जाएगा।',
              [{ text: 'रद्द करें', style: 'cancel' }, { text: 'हटाएं', style: 'destructive', onPress: onClearAll }],
            );
          }}
        >
          <Text style={styles.clearText}>साफ़ करें (Clear All)</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            activeOpacity={onPress ? 0.7 : 1}
            onPress={() => onPress?.(item)}
          >
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.itemSub} numberOfLines={1}>{item.subtitle}</Text>
              {item.detail ? <Text style={styles.itemDetail} numberOfLines={2}>{item.detail}</Text> : null}
              <Text style={styles.itemDate}>{item.date}</Text>
            </View>
            {onDelete && (
              <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={18} color="#CCC" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: FONT.body, fontWeight: '600', color: '#AAA', marginTop: 12 },
  emptySubtext: { fontSize: FONT.caption, color: '#CCC', marginTop: 4 },
  clearBtn: { alignItems: 'flex-end', paddingHorizontal: SPACING.pageHorizontal, paddingVertical: 8 },
  clearText: { fontSize: FONT.caption, color: COLORS.danger, fontWeight: '600' },
  list: { paddingHorizontal: SPACING.pageHorizontal, paddingBottom: 24 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: 10,
  },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: FONT.bodySmall, fontWeight: '600', color: COLORS.textPrimary },
  itemSub: { fontSize: FONT.caption, color: COLORS.textSecondary, marginTop: 2 },
  itemDetail: { fontSize: FONT.micro, color: COLORS.textTertiary, marginTop: 4 },
  itemDate: { fontSize: FONT.micro, color: '#BBB', marginTop: 4 },
});
