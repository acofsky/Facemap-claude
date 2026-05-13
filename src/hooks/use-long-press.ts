import { useCallback, useEffect, useRef } from 'react';
import { haptics } from '@/lib/haptics';

interface UseLongPressOptions {
  /** Milliseconds the user has to hold before the long-press fires. */
  threshold?: number;
  /**
   * Maximum pixels the pointer may move during the hold before the gesture
   * is cancelled. Keeps long-press distinct from scrolling.
   */
  moveTolerance?: number;
  /** Fire haptic feedback when the long-press triggers. Defaults to true. */
  hapticOnFire?: boolean;
}

type LongPressHandlers = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
};

/**
 * Long-press gesture detection that works for both touch + mouse. Cancels
 * itself if the pointer moves beyond `moveTolerance` (so it doesn't compete
 * with vertical scrolling on lists).
 */
export function useLongPress(callback: () => void, opts: UseLongPressOptions = {}): LongPressHandlers {
  const { threshold = 450, moveTolerance = 8, hapticOnFire = true } = opts;
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
    fired.current = false;
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown: (e) => {
      // Only main button / primary touch.
      if (e.button !== undefined && e.button !== 0) return;
      cancel();
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        if (hapticOnFire) haptics.medium();
        callback();
        timer.current = null;
      }, threshold);
    },
    onPointerMove: (e) => {
      if (!start.current) return;
      const dx = Math.abs(e.clientX - start.current.x);
      const dy = Math.abs(e.clientY - start.current.y);
      if (dx > moveTolerance || dy > moveTolerance) cancel();
    },
    onPointerUp: () => cancel(),
    onPointerCancel: () => cancel(),
  };
}
