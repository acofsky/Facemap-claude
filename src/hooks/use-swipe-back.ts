import { useEffect, useRef, useState } from 'react';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { haptics } from '@/lib/haptics';

interface UseSwipeBackOptions {
  /** Max distance from the page's left edge where the swipe must start (px). */
  edgeWidth?: number;
  /** Disable the gesture (e.g. while a sheet covers the page). */
  disabled?: boolean;
}

interface UseSwipeBackReturn {
  /** Spread onto the page root container. */
  bind: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  /** Live horizontal offset in px during a drag. Apply as `transform: translateX(N)`. */
  offsetX: number;
  /** True while a back gesture is in progress. */
  dragging: boolean;
}

/**
 * Edge-swipe-to-go-back gesture for full-screen pages. Mirrors iOS's
 * built-in nav-controller swipe.
 *
 * Critically, the gesture is committed on BOTH `pointerup` and
 * `pointercancel`. iOS WebView routinely ends a touch-drag with
 * `pointercancel` rather than `pointerup`; treating cancel as "abort"
 * (the obvious choice) means the page follows your finger but can never
 * actually close — it always snaps back. Either event ends the gesture.
 *
 * Commit logic projects the release position ~100ms forward using recent
 * velocity, so a flick closes from a short drag and a deliberate drag
 * past ~30% of the width closes regardless of speed.
 */
export function useSwipeBack(onBack: () => void, opts: UseSwipeBackOptions = {}): UseSwipeBackReturn {
  const { edgeWidth = 32, disabled = false } = opts;
  const reduced = useReduceMotion();
  const startX = useRef<number | null>(null);
  // Refs (not state) so the end handler reads the true latest values and
  // isn't affected by render-closure staleness.
  const offsetRef = useRef(0);
  const velocity = useRef(0); // smoothed horizontal velocity, px per ms
  const lastX = useRef(0);
  const lastT = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Reset everything when disabled flips.
  useEffect(() => {
    if (disabled) {
      startX.current = null;
      offsetRef.current = 0;
      setOffsetX(0);
      setDragging(false);
    }
  }, [disabled]);

  // Runs on whichever of pointerup / pointercancel fires first; the other
  // then no-ops because startX is already cleared.
  const end = () => {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    const width = Math.min(window.innerWidth || 390, 480);
    const dx = offsetRef.current;
    const projected = dx + velocity.current * 100;
    if (projected > width * 0.3) {
      haptics.light();
      // Leave offsetX where it is — the page unmounts and its exit
      // animation slides it the rest of the way off-screen. Snapping it
      // back to 0 here would yank the content left for a frame.
      onBack();
    } else {
      offsetRef.current = 0;
      setOffsetX(0);
    }
  };

  return {
    bind: {
      onPointerDown: (e) => {
        if (disabled || reduced) return;
        if (e.button !== undefined && e.button !== 0) return;
        // Gesture must start near the page's left edge — measured relative
        // to the element so it works whether the page fills the screen
        // (iPhone) or sits in a centered column (wider screens).
        const rect = e.currentTarget.getBoundingClientRect();
        if (e.clientX - rect.left > edgeWidth) return;
        startX.current = e.clientX;
        offsetRef.current = 0;
        velocity.current = 0;
        lastX.current = e.clientX;
        lastT.current = performance.now();
        setDragging(true);
      },
      onPointerMove: (e) => {
        if (startX.current === null) return;
        const dx = Math.max(0, e.clientX - startX.current);
        const now = performance.now();
        const dt = now - lastT.current;
        if (dt > 0) {
          // Exponential smoothing so the release reading isn't dominated
          // by a single jittery final sample.
          const sample = (e.clientX - lastX.current) / dt;
          velocity.current = velocity.current * 0.6 + sample * 0.4;
        }
        lastX.current = e.clientX;
        lastT.current = now;
        offsetRef.current = dx;
        setOffsetX(dx);
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
    offsetX,
    dragging,
  };
}
