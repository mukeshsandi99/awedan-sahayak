/**
 * AdManager — Central AdMob Orchestrator
 *
 * ALL ad operations MUST go through this module. No screen should
 * call AdMob SDK directly. This ensures:
 *   - Premium users NEVER see ads
 *   - Frequency limits are enforced globally
 *   - Ad lifecycle is properly managed
 *   - Analytics/impressions are tracked centrally
 *
 * Usage:
 *   import { AdManager } from '../services/ads/AdManager';
 *   await AdManager.init();
 *   await AdManager.showInterstitialIfEligible();
 */

import mobileAds, {
  BannerAd,
  InterstitialAd,
  RewardedAd,
  AppOpenAd,
  MaxAdContentRating,
  type AdEventType,
} from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, AD_FREQUENCY, BANNER_ALLOWED_SCREENS, AD_FORBIDDEN_SCREENS } from './AdConfig';
import { AdLogger } from './AdLogger';
import {
  canShowInterstitial,
  recordInterstitialShown,
  shouldTriggerInterstitial,
  incrementGenerationCount,
  canShowRewarded,
  recordRewardedShown,
  canShowAppOpen,
  recordAppOpenShown,
} from './FrequencyManager';
import { getSubscriptionStatus } from '../usageTracker';

// ── Types ────────────────────────────────────────────────────────────────

export type AdType = 'banner' | 'interstitial' | 'rewarded' | 'appOpen';

export interface RewardedAdResult {
  earned: boolean;
  type: string;
  amount: number;
}

// ── State ────────────────────────────────────────────────────────────────

let _initialized = false;
let _interstitialAd: InterstitialAd | null = null;
let _rewardedAd: RewardedAd | null = null;
let _appOpenAd: AppOpenAd | null = null;
let _currentScreen: string = '';

// ── Premium check ────────────────────────────────────────────────────────

/** Returns true if the user has an active premium subscription. */
async function isPremium(): Promise<boolean> {
  try {
    const status = await getSubscriptionStatus();
    return status === 'active';
  } catch {
    return false;
  }
}

// ── Initialization ───────────────────────────────────────────────────────

export const AdManager = {
  /** Initialize AdMob SDK. Safe to call multiple times. Call once on app launch. */
  async init(): Promise<void> {
    if (_initialized) return;
    try {
      await mobileAds().initialize();
      _initialized = true;
      AdLogger.info('✅ AdMob SDK initialized.');
    } catch (err: any) {
      AdLogger.warn(`AdMob init failed (non-fatal): ${err?.message}`);
    }
  },

  /** Call when the active screen changes (from navigation). */
  setCurrentScreen(screenName: string): void {
    _currentScreen = screenName;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Interstitial
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Show an interstitial ad if the user is eligible:
   *   - Not premium
   *   - Frequency limits allow
   *   - Triggered by generation count
   * Returns true if an ad was shown.
   */
  async showInterstitialIfEligible(): Promise<boolean> {
    if (await isPremium()) return false;
    if (AD_FORBIDDEN_SCREENS.has(_currentScreen)) return false;
    if (!(await canShowInterstitial())) return false;
    if (!(await shouldTriggerInterstitial())) return false;

    try {
      _interstitialAd = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial);
      _interstitialAd.addAdEventsListener(({ type, payload }: { type: AdEventType; payload?: any }) => {
        if (type === 'loaded') _interstitialAd?.show();
        if (type === 'opened') AdLogger.impression('interstitial', AD_UNIT_IDS.interstitial);
        if (type === 'closed') { recordInterstitialShown(); _interstitialAd = null; }
        if (type === 'error') AdLogger.loadFail('interstitial', payload?.error ?? '');
      });
      _interstitialAd.load();
      return true;
    } catch (err: any) {
      AdLogger.error(`Interstitial error: ${err?.message}`);
      return false;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Rewarded
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Show a rewarded ad. The user earns +1 credit on completion.
   * Returns the reward result or null if not eligible.
   */
  async showRewardedAd(): Promise<RewardedAdResult | null> {
    if (await isPremium()) return null;
    if (!(await canShowRewarded())) return null;

    return new Promise((resolve) => {
      try {
        _rewardedAd = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded);
        _rewardedAd.addAdEventsListener(({ type, payload }: { type: AdEventType; payload?: any }) => {
          if (type === 'loaded') _rewardedAd?.show();
          if (type === 'opened') AdLogger.impression('rewarded', AD_UNIT_IDS.rewarded);
          if (type === 'closed') { _rewardedAd = null; resolve(null); }
          if (type === 'error') { AdLogger.loadFail('rewarded', payload?.error ?? ''); _rewardedAd = null; resolve(null); }
          if ((type as string) === 'rewarded' && payload) {
            recordRewardedShown();
            _rewardedAd = null;
            resolve({
              earned: true,
              type: payload.type ?? 'credit',
              amount: payload.amount ?? 1,
            });
          }
        });
        _rewardedAd.load();
      } catch (err: any) {
        AdLogger.error(`Rewarded error: ${err?.message}`);
        resolve(null);
      }
    });
  },

  // ═══════════════════════════════════════════════════════════════════════
  // App Open
  // ═══════════════════════════════════════════════════════════════════════

  /** Show app-open ad on cold start only. Call from App.tsx. */
  async showAppOpenIfEligible(): Promise<boolean> {
    if (await isPremium()) return false;
    if (!(await canShowAppOpen())) return false;

    try {
      _appOpenAd = AppOpenAd.createForAdRequest(AD_UNIT_IDS.appOpen);
      _appOpenAd.addAdEventsListener(({ type }: { type: AdEventType }) => {
        if (type === 'loaded') _appOpenAd?.show();
        if (type === 'opened') AdLogger.impression('appOpen', AD_UNIT_IDS.appOpen);
        if (type === 'closed') { recordAppOpenShown(); _appOpenAd = null; }
      });
      _appOpenAd.load();
      return true;
    } catch {
      return false;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Generation tracking (call after successful AI generation)
  // ═══════════════════════════════════════════════════════════════════════

  async onApplicationGenerated(): Promise<void> {
    await incrementGenerationCount();
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Banner eligibility
  // ═══════════════════════════════════════════════════════════════════════

  /** Whether banner ads can show on the current screen. */
  async canShowBanner(): Promise<boolean> {
    if (await isPremium()) return false;
    if (AD_FORBIDDEN_SCREENS.has(_currentScreen)) return false;
    return BANNER_ALLOWED_SCREENS.has(_currentScreen);
  },

  /** Current banner ad unit ID (for BannerAd component). */
  getBannerUnitId(): string {
    return AD_UNIT_IDS.banner;
  },
};

export default AdManager;
