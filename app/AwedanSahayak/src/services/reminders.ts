/**
 * Follow-up reminder service for Awedan Sahayak.
 *
 * Schedules local notifications to remind users to check the status
 * of applications they've generated after a configurable number of days.
 */

import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { cancelReminder } from '../database/db';

// ── Configure notification handler (for when app is in foreground) ──

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Types ───────────────────────────────────────────────────────────

export interface ReminderSchedule {
  /** Expo notification identifier (used to cancel later). */
  notificationId: string;
  /** ISO date string when the reminder will fire. */
  reminderDate: string;
}

// ── Permission ──────────────────────────────────────────────────────

/**
 * Requests notification permission with a clear Hindi explanation.
 * Returns true if granted, false otherwise. Graceful — app works
 * without reminders if denied.
 */
export async function requestReminderPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      '🔔 सूचनाएं बंद हैं',
      'आवेदन की स्थिति की याद दिलाने के लिए सूचनाएं आवश्यक हैं। कृपया सेटिंग्स में जाकर सूचनाएं चालू करें।\n\nNotifications help remind you to follow up on your application. Please enable them in Settings.',
    );
    return false;
  }
  return true;
}

// ── Schedule ────────────────────────────────────────────────────────

/**
 * Schedules a local notification to fire after `daysFromNow` days.
 *
 * @param applicationName  Hindi name of the application type
 * @param officeName       Hindi office name
 * @param daysFromNow      Number of days to wait before reminding (default 15)
 * @returns                The notification ID and reminder date, or null if permission denied
 */
export async function scheduleReminder(
  applicationName: string,
  officeName: string,
  daysFromNow: number = 15,
): Promise<ReminderSchedule | null> {
  const granted = await requestReminderPermission();
  if (!granted) return null;

  // Calculate the trigger date
  const triggerDate = new Date();
  if (daysFromNow === 0) {
    // Test mode: fire 1 minute from now
    triggerDate.setMinutes(triggerDate.getMinutes() + 1);
  } else {
    triggerDate.setDate(triggerDate.getDate() + daysFromNow);
    triggerDate.setHours(9, 0, 0, 0); // Fire at 9 AM local time
  }

  const reminderDate = triggerDate.toISOString();

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ आवेदन की स्थिति जांचें',
      body: `आपने ${officeName} में "${applicationName}" हेतु आवेदन बनाया था। कृपया कार्यालय जाकर स्थिति की जांच करें।`,
      data: { type: 'reminder', applicationName, officeName },
      sound: Platform.OS === 'android' ? undefined : 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  console.log(`[Reminders] Scheduled notification "${identifier}" for ${reminderDate} (${daysFromNow === 0 ? '1 minute (test)' : `${daysFromNow} days`} from now)`);
  return { notificationId: identifier, reminderDate };
}

/**
 * Cancels a previously scheduled reminder notification.
 * Also clears the notification_id from the database row.
 */
export async function cancelScheduledReminder(
  notificationId: string | null,
  applicationId: number,
): Promise<void> {
  if (notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log(`[Reminders] Cancelled notification: ${notificationId}`);
    } catch (err: any) {
      console.warn('[Reminders] Failed to cancel notification:', err?.message);
    }
  }
  // Clear the DB tracking regardless
  await cancelReminder(applicationId);
}

// ── Overdue check ───────────────────────────────────────────────────

/**
 * Returns true if the reminder_date has already passed.
 */
export function isReminderOverdue(reminderDate: string | null): boolean {
  if (!reminderDate) return false;
  const now = new Date();
  const reminder = new Date(reminderDate);
  return reminder <= now;
}

/**
 * Returns a human-readable string for how many days have passed since the reminder date.
 */
export function daysSinceReminder(reminderDate: string | null): number | null {
  if (!reminderDate) return null;
  const now = new Date();
  const reminder = new Date(reminderDate);
  const diffMs = now.getTime() - reminder.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
