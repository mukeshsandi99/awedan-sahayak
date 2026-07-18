/**
 * PaywallScreen
 *
 * Shown when the user has exhausted their 5 free applications and
 * has no active subscription or paid credits. Offers two options:
 *
 *   1. ₹100/माह subscription — unlimited applications
 *   2. ₹10 one-time — single application credit
 *
 * After successful purchase, auto-navigates back so the user can
 * continue generating their application.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import {
  purchaseMonthlySubscription,
  purchaseSingleApplication,
  isIAPReady,
  getProductDetails,
  getIAPErrorMessage,
} from '../services/iap';
import { getFreeUsageCount, getPaidCredits, FREE_TIER_LIMIT } from '../services/usageTracker';

// ── Types ─────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'Paywall'>;

// ── Component ─────────────────────────────────────────────────────────

export default function PaywallScreen({ navigation }: Props) {
  const [purchasing, setPurchasing] = useState<'none' | 'subscription' | 'one_time'>('none');
  const [freeUsed, setFreeUsed] = useState(0);
  const [credits, setCredits] = useState(0);
  const [monthlyPrice, setMonthlyPrice] = useState('₹100/माह');
  const [singlePrice, setSinglePrice] = useState('₹10');
  const [iapAvailable, setIapAvailable] = useState(false);

  // ── Load state on mount ───────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const [used, creds, ready] = await Promise.all([
        getFreeUsageCount(),
        getPaidCredits(),
        Promise.resolve(isIAPReady()),
      ]);
      setFreeUsed(used);
      setCredits(creds);
      setIapAvailable(ready);

      // Try to fetch actual prices from Play Store
      if (ready) {
        try {
          const products = await getProductDetails();
          for (const p of products) {
            if (p.id === 'awedan_sahayak_monthly_sub' && p.displayPrice) {
              setMonthlyPrice(`${p.displayPrice}/माह`);
            }
            if (p.id === 'awedan_sahayak_single_gen' && p.displayPrice) {
              setSinglePrice(p.displayPrice);
            }
          }
        } catch {
          // Use fallback prices — fine
        }
      }
    })();
  }, []);

  // ── Purchase handlers ─────────────────────────────────────────────

  const handleSubscribe = useCallback(async () => {
    setPurchasing('subscription');
    try {
      const success = await purchaseMonthlySubscription();
      if (success) {
        Alert.alert(
          '✅ सब्सक्रिप्शन सक्रिय!',
          'अब आप असीमित आवेदन बना सकते हैं।\n\nSubscription active! You can now generate unlimited applications.',
          [{ text: 'जारी रखें (Continue)', onPress: () => navigation.goBack() }],
        );
      }
    } catch (err: any) {
      const msg = getIAPErrorMessage(err);
      Alert.alert('❌ खरीदारी त्रुटि', msg, [{ text: 'ठीक है' }]);
    } finally {
      setPurchasing('none');
    }
  }, [navigation]);

  const handleOneTime = useCallback(async () => {
    setPurchasing('one_time');
    try {
      const success = await purchaseSingleApplication();
      if (success) {
        Alert.alert(
          '✅ क्रेडिट प्राप्त!',
          'आपको 1 आवेदन क्रेडिट मिल गया है। अब आप अपना आवेदन बना सकते हैं।\n\nCredit received! You can now generate 1 application.',
          [{ text: 'जारी रखें (Continue)', onPress: () => navigation.goBack() }],
        );
      }
    } catch (err: any) {
      const msg = getIAPErrorMessage(err);
      Alert.alert('❌ खरीदारी त्रुटि', msg, [{ text: 'ठीक है' }]);
    } finally {
      setPurchasing('none');
    }
  }, [navigation]);

  // ── Render ────────────────────────────────────────────────────────

  const isBusy = purchasing !== 'none';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={36} color="#E17055" />
        </View>
        <Text style={styles.headerTitle}>मुफ्त प्रयोग समाप्त</Text>
        <Text style={styles.headerSubtitle}>
          आपने {freeUsed}/{FREE_TIER_LIMIT} मुफ्त आवेदन बना लिए हैं
        </Text>
        <Text style={styles.headerEnglish}>
          You've used your {FREE_TIER_LIMIT} free applications
        </Text>
      </View>

      {/* IAP warning banner */}
      {!iapAvailable && (
        <View style={styles.warningBanner}>
          <Ionicons name="information-circle" size={18} color="#856404" />
          <Text style={styles.warningText}>
            Google Play बिलिंग अभी उपलब्ध नहीं है। ऐप को Play Store से इंस्टॉल करें।{'\n'}
            (Billing unavailable — install from Play Store.)
          </Text>
        </View>
      )}

      {/* Subscription card */}
      <View style={styles.card}>
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>सर्वोत्तम (Best Value)</Text>
        </View>
        <Text style={styles.cardPrice}>{monthlyPrice}</Text>
        <Text style={styles.cardTitle}>असीमित आवेदन</Text>
        <Text style={styles.cardSubtitle}>Unlimited Applications</Text>
        <Text style={styles.cardDesc}>
          हर महीने जितने चाहें आवेदन बनाएं। सभी प्रकार के सरकारी आवेदन।{'\n'}
          कोई सीमा नहीं — जब चाहें, जितना चाहें।
        </Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleSubscribe}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          {purchasing === 'subscription' ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="card" size={18} color="#FFF" />
              <Text style={styles.buttonText}>सब्सक्राइब करें (Subscribe)</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* One-time card */}
      <View style={styles.card}>
        <Text style={styles.cardPrice}>{singlePrice}</Text>
        <Text style={styles.cardTitle}>एक आवेदन</Text>
        <Text style={styles.cardSubtitle}>Single Application</Text>
        <Text style={styles.cardDesc}>
          एक बार का भुगतान — सिर्फ इस आवेदन के लिए।{'\n'}
          हर बार नए आवेदन के लिए अलग से खरीदें।
        </Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonOutline]}
          onPress={handleOneTime}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          {purchasing === 'one_time' ? (
            <ActivityIndicator size="small" color="#E17055" />
          ) : (
            <>
              <Ionicons name="wallet" size={18} color="#E17055" />
              <Text style={styles.buttonOutlineText}>अभी खरीदें (Buy Now)</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Credits info */}
      {credits > 0 && (
        <View style={styles.creditsInfo}>
          <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
          <Text style={styles.creditsText}>
            आपके पास {credits} खरीदे गए क्रेडिट शेष हैं। (You have {credits} paid credit(s).)
          </Text>
        </View>
      )}

      {/* Security note */}
      <View style={styles.securityNote}>
        <Ionicons name="shield-checkmark" size={14} color="#999" />
        <Text style={styles.securityText}>
          सुरक्षित Google Play भुगतान। आपके सभी आवेदन आपके डिवाइस पर सुरक्षित रहते हैं।
        </Text>
      </View>

      {/* Footer */}
      <TouchableOpacity
        style={styles.footerLink}
        onPress={() => navigation.goBack()}
        disabled={isBusy}
        activeOpacity={0.6}
      >
        <Text style={styles.footerText}>बाद में तय करें (Decide Later)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#E17055',
    fontWeight: '600',
    textAlign: 'center',
  },
  headerEnglish: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },

  // Warning banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 8,
    width: '100%',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#27AE60',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  cardDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 18,
  },

  // Buttons
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonPrimary: {
    backgroundColor: '#E17055',
  },
  buttonOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E17055',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonOutlineText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E17055',
  },

  // Credits
  creditsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  creditsText: {
    fontSize: 13,
    color: '#666',
  },

  // Security
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: '#999',
    lineHeight: 17,
  },

  // Footer
  footerLink: {
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
});
