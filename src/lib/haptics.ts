import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = () => Capacitor.isNativePlatform();

/**
 * Thin haptics wrapper that no-ops on web. Use this everywhere instead of
 * importing Haptics directly so the dev preview never crashes and so all
 * tactile feedback is consistent.
 */
export const haptics = {
  /** Soft tap — chip tap, toggle flip, small confirmation. */
  light: () => {
    if (isNative()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
  /** Stronger thunk — primary FAB tap, long-press recognition. */
  medium: () => {
    if (isNative()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  },
  /** Decisive thud — heavy actions, destructive confirmations. */
  heavy: () => {
    if (isNative()) Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  },
  /** Selection click — picker scrolls, chip selection. */
  selection: () => {
    if (isNative()) Haptics.selectionChanged().catch(() => {});
  },
  success: () => {
    if (isNative()) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  },
  warning: () => {
    if (isNative()) Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
  },
  error: () => {
    if (isNative()) Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  },
};
