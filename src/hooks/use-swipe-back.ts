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
 * Commit logic projects the release position ~100ms forward using the
 * recent swipe velocity (the way iOS does) — so a quick flick closes the
 * page even from a short drag, and a deliberate drag past ~40% of the
 * width closes regardless of speed. Anything less snaps back.
 *
 * Usage:
 *   const back = useSwipeBack(onBack);
 *   <div {...back.bind} style={{ transform: `translateX(${back.offsetX}px)` }}>
 */
export function useSwipeBack(onBack: () => void, opts: UseSwipeBackOptions = {}): UseSwipeBackReturn {
  const { edgeWidth = 30, disabled = false } = opts;
  const reduced = useReduceMotion();
  const startX = useRef<number | null>(null);
  // Mirror offsetX into a ref so onPointerUp reads the true latest value
  // rather than a possibly-stale render closure.
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

  const snapBack = () => {
    startX.current = null;
    offsetRef.current = 0;
    setOffsetX(0);
    setDragging(false);
  };

  return {
    bind: {
      onPointerDown: (e) => {
        if (disabled || reduced) return;
        if (e.button !== undefined && e.button !== 0) return;
        // Gesture must start near the page's left edge — measured relative
        // to the element, so it works whether the page fills the screen
        // (iPhone) or sits in a centered column (wider screens).
        const rect = e.currentTarget.getBoundingClientRect();
        if (e.clientX - rect.left > edgeWidth) return;
        startX.current = e.clientX;
        offsetRef.current = 0;
        velocity.current = 0;
        lastX.current = e.clientX;
        lastT.current = performance.now();
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
      onPointerUp: () => {
        if (startX.current === null) return;
        startX.current = null;
        const width = Math.min(window.innerWidth, 480);
        const dx = offsetRef.current;
        // Project where the page would land ~100ms after release.
        const projected = dx + velocity.current * 100;
        const triggered = projected > width * 0.4;
        setDragging(false);
        if (triggered) {
          haptics.light();
          // Leave offsetX where it is: the page is about to unmount and
          // its exit animation slides it the rest of the way off-screen.
          // Snapping offsetX back to 0 here would yank the content left
          // for a frame before the exit — that was the visible jank.
          onBack();
        } else {
          offsetRef.current = 0;
          setOffsetX(0);
        }
      },
      onPointerCancel: () => snapBack(),
    },
    offsetX,
    dragging,
  };
}
