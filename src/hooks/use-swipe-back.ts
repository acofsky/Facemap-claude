import { useEffect, useRef, useState } from 'react';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { haptics } from '@/lib/haptics';

interface UseSwipeBackOptions {
  /** Max distance from the left edge where the swipe must start (px). */
  edgeWidth?: number;
  /** Minimum horizontal drag to count as a back gesture (px). */
  threshold?: number;
  /** Minimum velocity (px/s) that also counts even without enough distance. */
  velocityThreshold?: number;
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
 * built-in nav controller swipe.
 *
 * Usage:
 *   const back = useSwipeBack(onBack);
 *   <div {...back.bind} style={{ transform: `translateX(${back.offsetX}px)` }}>
 */
export function useSwipeBack(onBack: () => void, opts: UseSwipeBackOptions = {}): UseSwipeBackReturn {
  const { edgeWidth = 24, threshold = 100, velocityThreshold = 500, disabled = false } = opts;
  const reduced = useReduceMotion();
  const startX = useRef<number | null>(null);
  const startTime = useRef<number>(0);
  const baseTime = useRef<number>(0);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Reset everything when disabled flips.
  useEffect(() => {
    if (disabled) {
      startX.current = null;
      setOffsetX(0);
      setDragging(false);
    }
  }, [disabled]);

  const reset = () => {
    startX.current = null;
    setOffsetX(0);
    setDragging(false);
  };

  return {
    bind: {
      onPointerDown: (e) => {
        if (disabled || reduced) return;
        if (e.button !== undefined && e.button !== 0) return;
        if (e.clientX > edgeWidth) return; // gesture must start near the left edge
        startX.current = e.clientX;
        startTime.current = performance.now();
        baseTime.current = performance.now();
        setDragging(true);
        // Capture the pointer so every move/up event keeps coming to this
        // element even once the finger travels off it — without this, iOS
        // WebView can hand the gesture to its own scrolling and the swipe
        // silently dies mid-drag.
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* setPointerCapture can throw if the pointer is already gone */
        }
      },
      onPointerMove: (e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        if (dx < 0) return; // ignore leftward drags
        setOffsetX(Math.min(dx, window.innerWidth));
      },
      onPointerUp: () => {
        if (startX.current === null) return;
        const dx = offsetX;
        const dt = Math.max(1, performance.now() - startTime.current);
        const velocity = (dx / dt) * 1000;
        const triggered = dx > threshold || velocity > velocityThreshold;
        if (triggered) {
          haptics.light();
          onBack();
        }
        reset();
      },
      onPointerCancel: () => reset(),
    },
    offsetX,
    dragging,
  };
}
