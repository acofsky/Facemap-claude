import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_EOD_PREFS, scheduleEoDNotification, scheduleWeeklySummary, type EoDPrefs } from '@/lib/notifications';

const STORAGE_KEY = 'membr_notification_prefs_v1';

export interface NotificationPrefs {
  eod: EoDPrefs;
  /** Smart Circle in-app banners on/off. Default: on (per Q11 / spec §7). */
  smartCircleSuggestions: boolean;
  /** Weekly Friday digest. */
  weeklySummary: boolean;
}

const DEFAULTS: NotificationPrefs = {
  eod: DEFAULT_EOD_PREFS,
  smartCircleSuggestions: true,
  weeklySummary: false,
};

function load(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed, eod: { ...DEFAULTS.eod, ...(parsed.eod ?? {}) } };
  } catch {
    return DEFAULTS;
  }
}

function save(p: NotificationPrefs) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => load());

  // Re-schedule the native notifications whenever the prefs they depend on
  // change. Each effect is independent so toggling one doesn't ripple.
  useEffect(() => {
    scheduleEoDNotification(prefs.eod).catch(() => { /* web no-op */ });
  }, [prefs.eod]);
  useEffect(() => {
    scheduleWeeklySummary(prefs.weeklySummary).catch(() => { /* web no-op */ });
  }, [prefs.weeklySummary]);

  const update = useCallback((patch: Partial<NotificationPrefs>) => {
    setPrefs((cur) => {
      const next = {
        ...cur,
        ...patch,
        eod: patch.eod ? { ...cur.eod, ...patch.eod } : cur.eod,
      };
      save(next);
      return next;
    });
  }, []);

  return { prefs, update };
}
