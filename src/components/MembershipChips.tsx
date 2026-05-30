import { cn } from '@/lib/utils';
import { isValidTone } from '@/lib/store';
import type { Circle, Event } from '@/lib/store';

interface MembershipChipsProps {
  circles: Circle[];
  events: Event[];
  selectedCircleIds: string[];
  selectedEventIds: string[];
  onCircleChange: (ids: string[]) => void;
  onEventChange: (ids: string[]) => void;
  /** When both lists are empty, show this hint. */
  emptyMessage?: string;
  /** Tighter spacing when used inside a dense form sheet. */
  compact?: boolean;
}

/**
 * Toggleable chip grid for Circle / Event memberships. Used in
 *   - ImportCandidateReviewSheet: assign on promote
 *   - PersonMembershipsSheet: edit existing person's memberships
 *   - BulkAddOptionsSheet: apply to all candidates in a bulk import
 *
 * Active circles use the standard red selection ring; active events
 * use their tone color so a multi-event selection is visually
 * distinguishable across the row.
 */
export function MembershipChips({
  circles,
  events,
  selectedCircleIds,
  selectedEventIds,
  onCircleChange,
  onEventChange,
  emptyMessage,
  compact,
}: MembershipChipsProps) {
  if (circles.length === 0 && events.length === 0) {
    return emptyMessage ? (
      <p className="text-[12px] font-display-italic text-[hsl(var(--foreground)/0.5)]">
        {emptyMessage}
      </p>
    ) : null;
  }
  const gap = compact ? 'gap-1.5' : 'gap-2';
  return (
    <div className="space-y-3">
      {circles.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--foreground)/0.5)] mb-1.5">
            Circles
          </div>
          <div className={cn('flex flex-wrap', gap)}>
            {circles.map((c) => {
              const on = selectedCircleIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    onCircleChange(
                      on ? selectedCircleIds.filter((id) => id !== c.id) : [...selectedCircleIds, c.id],
                    )
                  }
                  className={cn(
                    'glass-pill !h-8 !px-3 text-[12px] active:scale-[0.96] transition-transform',
                    on
                      ? '!bg-[rgba(224,48,48,0.22)] !border-[rgba(224,48,48,0.40)] text-foreground'
                      : 'text-[hsl(var(--foreground)/0.7)]',
                  )}
                >
                  {c.emoji ? `${c.emoji} ` : ''}{c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {events.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--foreground)/0.5)] mb-1.5">
            Events
          </div>
          <div className={cn('flex flex-wrap', gap)}>
            {events.map((e) => {
              const on = selectedEventIds.includes(e.id);
              const tone = isValidTone(e.tone) ? e.tone : 'red';
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() =>
                    onEventChange(
                      on ? selectedEventIds.filter((id) => id !== e.id) : [...selectedEventIds, e.id],
                    )
                  }
                  className={cn(
                    'glass-pill !h-8 !px-3 text-[12px] active:scale-[0.96] transition-transform',
                    on && tone !== 'red'
                      ? `tile-${tone} text-white !border-transparent`
                      : on
                        ? '!bg-[rgba(224,48,48,0.22)] !border-[rgba(224,48,48,0.40)] text-foreground'
                        : 'text-[hsl(var(--foreground)/0.7)]',
                  )}
                >
                  {e.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
