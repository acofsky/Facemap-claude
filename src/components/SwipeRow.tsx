import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { haptics } from '@/lib/haptics';

interface SwipeAction {
  key: string;
  label: string;
  /** Tile background. Use the tile-* gradients or a literal HSL color. */
  background: string;
  /** Lucide icon element. */
  icon: ReactNode;
  onTap: () => void;
}

interface SwipeRowProps {
  actions: SwipeAction[];
  /** Width per action button in px. Default 72 — matches PEOPLE-01 spec. */
  actionWidth?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Swipe-left-to-reveal row pattern from PEOPLE-01. Drag left to expose the
 * action buttons; release past 50 % of the reveal width to snap open,
 * release short to snap back. Tapping outside or anywhere on the visible
 * row content while open also snaps it closed.
 */
export function SwipeRow({ actions, actionWidth = 72, className, children }: SwipeRowProps) {
  const revealWidth = actions.length * actionWidth;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const baseOffset = useRef(0);
  const reduced = useReduceMotion();

  const snap = (open: boolean) => {
    setOffset(open ? -revealWidth : 0);
  };

  // Close when the user taps outside the row.
  useEffect(() => {
    if (offset === 0) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-swipe-row]')) snap(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [offset]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    startX.current = e.clientX;
    baseOffset.current = offset;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    // Only allow leftward drag. Clamp to [-revealWidth, 0].
    const next = Math.min(0, Math.max(-revealWidth, baseOffset.current + dx));
    setOffset(next);
  };

  const handlePointerUp = () => {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    // Snap to whichever side we're closer to.
    snap(offset < -revealWidth / 2);
  };

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`} data-swipe-row>
      {/* Action layer */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: revealWidth }} aria-hidden={offset === 0}>
        {actions.map((a) => (
          <button
            key={a.key}
            onClick={() => {
              haptics.light();
              snap(false);
              a.onTap();
            }}
            tabIndex={offset === 0 ? -1 : 0}
            className="h-full flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold"
            style={{ width: actionWidth, background: a.background }}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>

      {/* Foreground content */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging || reduced ? 'none' : 'transform 0.18s ease-out',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
