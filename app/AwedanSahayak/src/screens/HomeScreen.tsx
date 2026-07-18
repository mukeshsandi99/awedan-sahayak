import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getOffices } from '../database/db';
import type { Office, OfficeType } from '../types/database';
import type { HomeStackParamList } from '../navigation/HomeStack';

// ── Icon map per office type ────────────────────────────────────────

const OFFICE_ICONS: Record<OfficeType, keyof typeof Ionicons.glyphMap> = {
  thana: 'shield-checkmark',
  block: 'business',
  bdo: 'clipboard',
  co: 'document-text',
  sdo: 'hammer',
  sp: 'shield',
  dc: 'ribbon',
  court: 'scale',
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
  sp: '#2D3436',
  dc: '#E84393',
  court: '#D63031',
  bank: '#1B5E20',
  college: '#1565C0',
  school: '#FF8F00',
  pwd: '#4E342E',
  rcd: '#BF360C',
  bcd: '#37474F',
};

// ── Types ───────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

// ── Component ───────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: Props) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOffices = useCallback(async () => {
    try {
      setError(null);
      const rows = await getOffices();
      setOffices(rows);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const stack = err?.stack ?? '';
      console.error('[HomeScreen] Failed to load offices:', err);
      console.error('[HomeScreen] Error message:', msg);
      console.error('[HomeScreen] Stack:', stack);
      setError(msg + '\n\n' + (stack ? stack.split('\n').slice(0, 4).join('\n') : ''));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the screen gains focus (in case DB was updated elsewhere)
  useFocusEffect(
    useCallback(() => {
      loadOffices();
    }, [loadOffices]),
  );

  // ── Render helpers ──────────────────────────────────────────────

  const renderCard = ({ item }: { item: Office }) => {
    const icon = OFFICE_ICONS[item.type] ?? 'business-outline';
    const color = OFFICE_COLORS[item.type] ?? '#636E72';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('ApplicationTypeList', {
            officeType: item.type,
            officeName: item.name_hindi,
          })
        }
      >
        <View style={[styles.iconCircle, { backgroundColor: color }]}>
          <Ionicons name={icon} size={28} color="#FFFFFF" />
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.name_hindi}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {item.name_english}
        </Text>
      </TouchableOpacity>
    );
  };

  // ── Main render ─────────────────────────────────────────────────

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>कार्यालय लोड नहीं हो सके</Text>
        <Text style={styles.errorSubtitle}>Failed to load offices</Text>
        <ScrollView style={styles.errorScroll} contentContainerStyle={styles.errorScrollContent}>
          <Text style={styles.errorMessage} selectable>{error}</Text>
        </ScrollView>
        <TouchableOpacity style={styles.retryButton} onPress={loadOffices}>
          <Text style={styles.retryButtonText}>पुनः प्रयास करें (Retry)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E17055" />
        <Text style={styles.loadingText}>कार्यालय लोड हो रहे हैं...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>आवेदन सहायक</Text>
        <Text style={styles.subtitle}>कार्यालय चुनें</Text>
      </View>

      {/* Disclaimer banner */}
      <View style={styles.disclaimerBanner}>
        <Text style={styles.disclaimerText}>
          ⚠️ यह ऐप किसी सरकारी संस्था से संबद्ध नहीं है - एक स्वतंत्र सहायक उपकरण{'\n'}
          Not affiliated with any government entity - independent assistive tool
        </Text>
      </View>

      {/* Custom / Blank application card */}
      <TouchableOpacity
        style={styles.customCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('CustomApplication')}
      >
        <View style={styles.customIconCircle}>
          <Ionicons name="create-outline" size={30} color="#FFFFFF" />
        </View>
        <View style={styles.scanTextGroup}>
          <Text style={styles.scanCardTitle}>खाली आवेदन पत्र</Text>
          <Text style={styles.scanCardSubtitle}>Create Your Own Application</Text>
          <Text style={styles.scanCardHint}>
            कोई भी कार्यालय, कोई भी आवेदन — अपने शब्दों में लिखें या बोलें
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#CCC" />
      </TouchableOpacity>

      {/* Scan handwritten application card */}
      <TouchableOpacity
        style={styles.scanCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('HandwritingScan')}
      >
        <View style={styles.scanIconCircle}>
          <Ionicons name="scan-outline" size={30} color="#FFFFFF" />
        </View>
        <View style={styles.scanTextGroup}>
          <Text style={styles.scanCardTitle}>हस्तलिखित आवेदन स्कैन करें</Text>
          <Text style={styles.scanCardSubtitle}>Scan Handwritten Application</Text>
          <Text style={styles.scanCardHint}>
            पुराने आवेदन की फोटो खींचें → डिजिटल टेक्स्ट पाएं → PDF/Word में एक्सपोर्ट करें
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#CCC" />
      </TouchableOpacity>

      <FlatList
        data={offices}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCard}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },

  // Disclaimer banner
  disclaimerBanner: {
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFC107',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#856404',
    lineHeight: 16,
    textAlign: 'center',
  },

  // Scan card (full-width, above office grid)
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#E17055',
    borderStyle: 'dashed',
    shadowColor: '#E17055',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  scanIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E17055',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTextGroup: {
    flex: 1,
  },
  scanCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  scanCardSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  scanCardHint: {
    fontSize: 11,
    color: '#AAA',
    marginTop: 6,
    lineHeight: 16,
  },

  // Custom application card (full-width, above scan card)
  customCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#6C5CE7',
    borderStyle: 'dashed',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  customIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  grid: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 150,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#D63031',
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  errorScroll: {
    maxHeight: 200,
    width: '100%',
    marginBottom: 20,
  },
  errorScrollContent: {
    paddingHorizontal: 4,
  },
  errorMessage: {
    fontSize: 12,
    color: '#555',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  retryButton: {
    backgroundColor: '#E17055',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
