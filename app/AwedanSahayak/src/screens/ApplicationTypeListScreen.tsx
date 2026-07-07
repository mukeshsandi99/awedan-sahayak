import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApplicationTypes, searchApplicationTypes } from '../database/db';
import type { ApplicationType } from '../types/database';
import type { HomeStackParamList } from '../navigation/HomeStack';

// ── Types ───────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'ApplicationTypeList'>;

// ── Debounce helper ─────────────────────────────────────────────────

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Component ───────────────────────────────────────────────────────

export default function ApplicationTypeListScreen({ navigation, route }: Props) {
  const { officeType, officeName } = route.params;

  const [allTypes, setAllTypes] = useState<ApplicationType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<ApplicationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Load application types for this office
  useEffect(() => {
    (async () => {
      try {
        const rows = await getApplicationTypes(officeType);
        setAllTypes(rows);
        setFilteredTypes(rows);
      } catch (err) {
        console.error('Failed to load application types:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [officeType]);

  // Search handler
  useEffect(() => {
    if (debouncedQuery.trim().length === 0) {
      setFilteredTypes(allTypes);
      return;
    }
    (async () => {
      try {
        const results = await searchApplicationTypes(debouncedQuery.trim());
        // Filter to only this office type
        setFilteredTypes(results.filter((t) => t.office_type === officeType));
      } catch (err) {
        // Fallback: client-side filter
        const q = debouncedQuery.toLowerCase();
        setFilteredTypes(
          allTypes.filter(
            (t) =>
              t.name_hindi.toLowerCase().includes(q) ||
              t.name_english.toLowerCase().includes(q) ||
              (t.keywords && t.keywords.toLowerCase().includes(q)),
          ),
        );
      }
    })();
  }, [debouncedQuery, allTypes, officeType]);

  // ── Render helpers ──────────────────────────────────────────────

  const renderItem = ({ item }: { item: ApplicationType }) => {
    const hasDisclaimer = item.requires_legal_disclaimer === 1;

    return (
      <TouchableOpacity
        style={styles.listItem}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('ApplicationForm', {
            applicationTypeId: item.id,
            applicationName: item.name_hindi,
          })
        }
      >
        <View style={styles.listItemContent}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.name_hindi}
          </Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {item.name_english}
          </Text>
        </View>
        <View style={styles.listItemRight}>
          {hasDisclaimer && (
            <View style={styles.disclaimerBadge}>
              <Ionicons name="warning-outline" size={12} color="#D63031" />
              <Text style={styles.disclaimerBadgeText}>⚠️</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={48} color="#CCC" />
        <Text style={styles.emptyTitle}>
          {searchQuery ? 'कोई परिणाम नहीं मिला' : 'कोई आवेदन प्रकार नहीं'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery ? 'कृपया दूसरे शब्द खोजें' : 'No application types found'}
        </Text>
      </View>
    );
  };

  // ── Main render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E17055" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="आवेदन प्रकार खोजें... (Search)"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#CCC" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={filteredTypes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={filteredTypes.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  centered: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A2E',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  listItemContent: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 3,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disclaimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  disclaimerBadgeText: {
    fontSize: 10,
  },
  separator: {
    height: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
});
