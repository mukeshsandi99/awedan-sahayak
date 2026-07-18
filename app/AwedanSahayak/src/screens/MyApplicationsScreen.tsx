/**
 * MyApplicationsScreen — lists all generated applications with search,
 * tap-to-preview, and delete support.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MyApplicationsStackParamList } from '../navigation/MyApplicationsStack';
import {
  getApplicationsWithDetails,
  deleteGeneratedApplication,
  type ApplicationListItem,
} from '../database/db';
import { isReminderOverdue, daysSinceReminder } from '../services/reminders';

// ── Navigation type ────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<MyApplicationsStackParamList, 'MyApplicationsList'>;

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'Z'); // SQLite stores UTC without TZ
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function getPreviewSnippet(text: string | null, maxLen = 120): string {
  if (!text) return '';
  const cleaned = text.replace(/\n/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '…' : cleaned;
}

// ── Component ───────────────────────────────────────────────────────────

export default function MyApplicationsScreen() {
  const navigation = useNavigation<Nav>();

  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ── Load data on focus ──────────────────────────────────────────

  const loadApps = useCallback(async () => {
    try {
      const rows = await getApplicationsWithDetails();
      setApps(rows);
    } catch (err: any) {
      console.error('[MyApps] Load failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadApps();
    }, [loadApps]),
  );

  // ── Delete ──────────────────────────────────────────────────────

  const handleDelete = useCallback((item: ApplicationListItem) => {
    Alert.alert(
      'आवेदन हटाएं?',
      `क्या आप "${item.type_name_hindi || item.type_name_english || 'यह आवेदन'}" को हटाना चाहते हैं?\n\nDelete this application?`,
      [
        { text: 'रद्द करें (Cancel)', style: 'cancel' },
        {
          text: 'हटाएं (Delete)',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGeneratedApplication(item.id);
              setApps((prev) => prev.filter((a) => a.id !== item.id));
            } catch (err: any) {
              console.error('[MyApps] Delete failed:', err?.message);
            }
          },
        },
      ],
    );
  }, []);

  // ── Filter ──────────────────────────────────────────────────────

  const filtered = search.trim()
    ? apps.filter((a) => {
        const q = search.toLowerCase();
        const fields = [
          a.type_name_hindi, a.type_name_english,
          a.office_name_hindi, a.office_name_english,
          a.generated_text,
        ];
        return fields.some((f) => f?.toLowerCase().includes(q));
      })
    : apps;

  // ── Render helpers ──────────────────────────────────────────────

  const renderItem = ({ item }: { item: ApplicationListItem }) => {
    const typeName = item.type_name_hindi || item.type_name_english || 'अज्ञात आवेदन';
    const officeName = item.office_name_hindi || item.office_name_english || '';
    const snippet = getPreviewSnippet(item.generated_text);
    const overdue = isReminderOverdue(item.reminder_date);
    const overdueDays = daysSinceReminder(item.reminder_date);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => {
          if (!item.generated_text) {
            Alert.alert('❌', 'इस आवेदन में कोई टेक्स्ट नहीं है।\n\nNo text available.');
            return;
          }
          navigation.navigate('MyApplicationPreview', {
            applicationName: typeName,
            generatedText: item.generated_text,
            officeType: item.office_type || 'thana',
            applicationId: item.id,
          });
        }}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons name="document-text" size={22} color="#E17055" />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {typeName}
            </Text>
            {officeName ? (
              <Text style={styles.cardOffice} numberOfLines={1}>
                📍 {officeName}
              </Text>
            ) : null}
          </View>
          <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
        </View>
        {overdue && (
          <View style={styles.overdueBadge}>
            <Ionicons name="alert-circle" size={14} color="#D63031" />
            <Text style={styles.overdueText}>
              {overdueDays !== null && overdueDays >= 1
                ? `${overdueDays}+ दिन हो गए — स्थिति जांचें`
                : 'स्थिति जांचें'}
            </Text>
          </View>
        )}
        {snippet ? (
          <Text style={styles.cardSnippet} numberOfLines={2}>
            {snippet}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>अभी तक कोई आवेदन नहीं बनाया गया</Text>
        <Text style={styles.emptySubtitle}>No applications created yet</Text>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => {
            // Navigate to Home tab (index 0)
            const parent = navigation.getParent();
            if (parent) parent.navigate('Home' as any);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={18} color="#FFF" />
          <Text style={styles.startButtonText}>आवेदन बनाएं (Create Application)</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E17055" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>मेरे आवेदन</Text>
      <Text style={styles.subtitle}>My Applications ({apps.length})</Text>

      {/* Search bar */}
      {apps.length > 0 && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="आवेदन खोजें (Search by type, office…)"
            placeholderTextColor="#999"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#CCC" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={filtered.length === 0 ? styles.listEmpty : styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A2E',
    marginLeft: 8,
  },

  // List
  listContent: {
    paddingBottom: 40,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF0EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  cardOffice: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  cardDate: {
    fontSize: 12,
    color: '#AAA',
  },
  cardSnippet: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginLeft: 50,
  },

  // Overdue badge
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    marginLeft: 50,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
  overdueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D63031',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E17055',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
