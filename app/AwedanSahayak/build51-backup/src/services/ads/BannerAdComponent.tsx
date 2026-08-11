/**
 * Reusable Banner Ad Component
 *
 * Automatically hides for premium users and on forbidden screens.
 * Simply add <AdBanner /> to any screen — eligibility is automatic.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS } from './AdConfig';
import { getSubscriptionStatus } from '../usageTracker';

const unitId = __DEV__ ? TestIds.BANNER : AD_UNIT_IDS.banner;

export default function AdBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const status = await getSubscriptionStatus();
        setVisible(status !== 'active');
      } catch {
        setVisible(false);
      }
    })();
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});
