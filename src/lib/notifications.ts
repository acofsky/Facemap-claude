import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ScheduleOn } from '@capacitor/local-notifications';

/**
 * Lightweight wrapper around @capacitor/local-notifications that handles
 * the End-of-Day "Who'd you meet today?" reminder. All notifications are
 * scheduled locally on-device — no APNs/FCM setup required.
 */

const EOD_BASE_ID = 1000;

export type EoDFrequency = 'daily' | 'weekdays' | 'mwf' | 'weekly-fri';

export interface EoDPrefs {
  enabled: boolean;
  frequency: EoDFrequency;
  /** "HH:mm" 24-hour, e.g. "21:00". */
  time: string;
}

export const DEFAULT_EOD_PREFS: EoDPrefs = {
  enabled: false,
  frequency: 'weekdays',
  time: '21:00',
};

/** Native-only — the web build silently no-ops every method. */
function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied'> {
  if (!isNative()) return 'denied';
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted' ? 'granted' : 'denied';
}

export async function notificationPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNative()) return 'denied';
  const { display } = await LocalNotifications.checkPermissions();
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  return 'prompt';
}

function weekdaysForFrequency(freq: EoDFrequency): number[] {
  // iOS weekday: Sunday=1, Monday=2, … Saturday=7
  switch (freq) {
    case 'daily':
      return [1, 2, 3, 4, 5, 6, 7];
    case 'weekdays':
      return [2, 3, 4, 5, 6];
    case 'mwf':
      return [2, 4, 6];
    case 'weekly-fri':
      return [6];
  }
}

function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map((n) => parseInt(n, 10));
  return { hour: Number.isFinite(h) ? h : 21, minute: Number.isFinite(m) ? m : 0 };
}

/**
 * Replace any existing EoD notifications with a new fan-out based on prefs.
 * One scheduled entry per active weekday so iOS handles the recurrence
 * itself — we never need a background job.
 */
export async function scheduleEoDNotification(prefs: EoDPrefs): Promise<void> {
  if (!isNative()) return;
  // Always start by clearing the previous schedule.
  await cancelEoDNotification();
  if (!prefs.enabled) return;
  const { hour, minute } = parseTime(prefs.time);
  const weekdays = weekdaysForFrequency(prefs.frequency);

  const notifications = weekdays.map((weekday, i) => ({
    id: EOD_BASE_ID + i,
    title: 'Who’d you meet today?',
    body: 'Tap to add anyone new before the day slips away.',
    schedule: {
      on: { hour, minute, weekday } as ScheduleOn,
      allowWhileIdle: true,
      repeats: true,
    },
    extra: { kind: 'end-of-day' as const },
  }));

  await LocalNotifications.schedule({ notifications });
}

export async function cancelEoDNotification(): Promise<void> {
  if (!isNative()) return;
  const ids: number[] = [];
  for (let i = 0; i < 7; i++) ids.push(EOD_BASE_ID + i);
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* ignore — nothing scheduled yet on first run */
  }
}

/**
 * Register a tap handler. The promise resolves to an unsubscribe function.
 * `kind` lets the caller distinguish notification types (we only ship
 * 'end-of-day' today; future kinds — meeting-brief, encounter-reminder —
 * will route here too).
 */
export async function onNotificationTap(
  handler: (kind: string) => void,
): Promise<() => void> {
  if (!isNative()) return () => {};
  const listener = await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const kind = (action.notification.extra as { kind?: string } | undefined)?.kind ?? 'unknown';
    handler(kind);
  });
  return () => listener.remove();
}
