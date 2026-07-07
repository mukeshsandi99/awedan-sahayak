/**
 * OfficeDirectoryScreen — displays government office details for the
 * user's local area based on their profile location.
 *
 * Loads office data from the SQLite database. Shows address, phone
 * (tap to call), working hours, and a "दिशा-निर्देश" button that
 * opens Google Maps with the office's coordinates or a search query.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOffices } from '../database/db';
import type { Office, OfficeType } from '../types/database';

// ── Icon & color maps ──────────────────────────────────────────────

const OFFICE_ICONS: Record<OfficeType, keyof typeof Ionicons.glyphMap> = {
  thana: 'shield-checkmark',
  block: 'business',
  bdo: 'clipboard',
  co: 'document-text',
  sdo: 'scale',
  sp: 'shield',
  dc: 'ribbon',
  court: 'hammer',
  bank: 'card',
  college: 'school',
  school: 'school',
  pwd: 'hammer',
  rcd: 'map',
  bcd: 'home',
};

const OFFICE_COLORS: Record<OfficeType, string> = {
  thana: '#E17055',
  block: '#00B894',
  bdo: '#0984E3',
  co: '#6C5CE7',
  sdo: '#FDCB6E',
  sp: '#D63031',
  dc: '#E17055',
  court: '#636E72',
  bank: '#1B5E20',
  college: '#1565C0',
  school: '#FF8F00',
  pwd: '#4E342E',
  rcd: '#BF360C',
  bcd: '#37474F',
};

const OFFICE_LABELS: Record<OfficeType, string> = {
  thana: 'थाना (Police Station)',
  block: 'प्रखंड कार्यालय (Block Office)',
  bdo: 'BDO कार्यालय (BDO Office)',
  co: 'CO/अंचल कार्यालय (CO Office)',
  sdo: 'SDO कार्यालय (SDO Office)',
  sp: 'SP कार्यालय (SP Office)',
  dc: 'DC/समाहरणालय (DC Office)',
  court: 'न्यायालय (Court)',
  bank: 'बैंक (Bank)',
  college: 'कॉलेज (College)',
  school: 'स्कूल (School)',
  pwd: 'लोक निर्माण विभाग (PWD)',
  rcd: 'ग्रामीण कार्य विभाग (RCD)',
  bcd: 'भवन निर्माण विभाग (BCD)',
};

// ── Component ───────────────────────────────────────────────────────

export default function OfficeDirectoryScreen() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadOffices = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await getOffices();
      setOffices(rows);
    } catch (err: any) {
      console.error('[OfficeDirectory] Failed to load offices:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffices();
  }, [loadOffices]);

  // ── Actions ─────────────────────────────────────────────────────

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleCall = (phone: string) => {
    const cleaned = phone?.replace(/[^0-9+]/g, '') ?? '';
    if (cleaned.length < 8) {
      Alert.alert('फ़ोन नंबर उपलब्ध नहीं', 'इस कार्यालय का फ़ोन नंबर अभी सत्यापित नहीं है।\n\nPhone number not yet verified.');
      return;
    }
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      Alert.alert('कॉल नहीं हो सका', 'इस डिवाइस पर कॉल सुविधा उपलब्ध नहीं है।');
    });
  };

  const handleDirections = (office: Office) => {
    const { latitude, longitude, name_hindi, district } = office;
    let url: string;

    if (latitude != null && longitude != null) {
      // Open Google Maps with precise coordinates
      url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    } else {
      // Search by name + district
      const query = encodeURIComponent(`${name_hindi} ${district ?? ''}`);
      url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    Linking.openURL(url).catch(() => {
      Alert.alert(
        'Maps नहीं खुल सका',
        'Google Maps खोलने में समस्या आई। कृपया Google Maps ऐप इंस्टॉल करें।\n\nCould not open Maps.',
      );
    });
  };

  // ── Render helpers ──────────────────────────────────────────────

  const renderOfficeCard = ({ item }: { item: Office }) => {
    const icon = OFFICE_ICONS[item.type] ?? 'business-outline';
    const color = OFFICE_COLORS[item.type] ?? '#636E72';
    const isExpanded = expandedId === item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => toggleExpand(item.id)}
      >
        {/* Compact header — always visible */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: color }]}>
            <Ionicons name={icon} size={22} color="#FFFFFF" />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.officeName} numberOfLines={2}>
              {item.name_hindi}
            </Text>
            <Text style={styles.officeEnglish} numberOfLines={1}>
              {item.name_english}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#CCC"
          />
        </View>

        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.cardDetails}>
            {/* Unverified badge */}
            {item.is_verified === 0 && (
              <View style={styles.unverifiedBadge}>
                <Ionicons name="warning-outline" size={14} color="#E17055" />
                <Text style={styles.unverifiedText}>
                  डेटा सत्यापित नहीं — Data Unverified
                </Text>
              </View>
            )}

            {/* Address */}
            {item.full_address ? (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={16} color="#666" />
                <Text style={styles.detailText}>{item.full_address}</Text>
              </View>
            ) : null}

            {/* Landmark */}
            {item.landmark ? (
              <View style={styles.detailRow}>
                <Ionicons name="flag-outline" size={16} color="#666" />
                <Text style={styles.detailText}>{item.landmark}</Text>
              </View>
            ) : null}

            {/* Working hours */}
            {item.working_hours ? (
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.detailText}>{item.working_hours}</Text>
              </View>
            ) : null}

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCall(item.phone_number ?? '')}
                activeOpacity={0.7}
              >
                <Ionicons name="call-outline" size={16} color="#FFF" />
                <Text style={styles.actionText}>कॉल करें</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.directionsButton]}
                onPress={() => handleDirections(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="navigate-outline" size={16} color="#FFF" />
                <Text style={styles.actionText}>दिशा-निर्देश</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
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
      <Text style={styles.title}>सरकारी कार्यालय</Text>
      <Text style={styles.subtitle}>सभी श्रेणियाँ — अपने क्षेत्र के कार्यालय खोजें</Text>

      {offices.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>कोई कार्यालय डेटा उपलब्ध नहीं</Text>
          <Text style={styles.emptySubtext}>No office data available</Text>
        </View>
      ) : (
        <FlatList
          data={offices}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={renderOfficeCard}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

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
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 32,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  officeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  officeEnglish: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  // Expanded details
  cardDetails: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
    gap: 10,
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  unverifiedText: {
    fontSize: 12,
    color: '#E17055',
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E17055',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  directionsButton: {
    backgroundColor: '#0984E3',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Empty state
  empty: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#BBB',
    marginTop: 4,
  },
});
