import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Loader2, ChevronDown, Archive } from 'lucide-react';
import {
  useCircles, useCreateCircle, usePersonCircles, useEvents, usePersonEvents, useArchiveEvent,
} from '@/hooks/use-data';
import { CircleSheet } from '@/components/CircleSheet';
import { EventSheet } from '@/components/EventSheet';
import { isValidTone, type Event as MembrEvent, type Tone } from '@/lib/store';
import { cn } from '@/lib/utils';

interface CirclesPageProps {
  onSelectCircle: (id: string) => void;
  onSelectEvent: (id: string) => void;
}

function circleTone(c: { id: string; tone?: string | null }): Tone {
  if (isValidTone(c.tone)) return c.tone;
  const TONES = ['red', 'blue', 'purple', 'green', 'amber', 'slate', 'rose', 'teal'] as const;
  let hash = 0;
  for (let i = 0; i < c.id.length; i++) hash = (hash * 31 + c.id.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

const CIRCLE_SUGGESTIONS = [
  { emoji: '🎓', name: 'School' },
  { emoji: '🏫', name: 'Childhood' },
  { emoji: '💼', name: 'Work' },
  { emoji: '🏋️', name: 'Gym' },
  { emoji: '🎲', name: 'Randoms' },
];

export function CirclesPage({ onSelectCircle, onSelectEvent }: CirclesPageProps) {
  const { data: circles = [], isLoading } = useCircles();
  const { data: personCircles = [] } = usePersonCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });
  const { data: archivedEvents = [] } = useEvents({ includeArchived: true });
  const { data: personEvents = [] } = usePersonEvents();
  const archiveEvt = useArchiveEvent();
  const createCircle = useCreateCircle();

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [circleSheetOpen, setCircleSheetOpen] = useState(false);
  const [eventSheetOpen, setEventSheetOpen] = useState<{ event?: MembrEvent } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const archivedOnly = useMemo(
    () => archivedEvents.filter((e) => e.archived_at !== null),
    [archivedEvents],
  );

  const circleMemberCount = (id: string) => personCircles.filter((pc) => pc.circle_id === id).length;
  const eventMemberCount = (id: string) => personEvents.filter((pe) => pe.event_id === id).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-8 animate-fade-in">
      {/* Nav bar */}
      <div className="flex items-center justify-between px-5 pt-3 mb-4">
        <span className="w-9" />
        <h1 className="text-[17px] font-semibold text-foreground">Circles</h1>
        <div className="relative">
          <button
            onClick={() => setAddMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setAddMenuOpen(false), 150)}
            aria-label="Create"
            className="w-9 h-9 -mr-2 flex items-center justify-center text-foreground active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" strokeWidth={1.75} />
          </button>
          {addMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] py-1 z-20 shadow-xl">
              <button
                onClick={() => {
                  setCircleSheetOpen(true);
                  setAddMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-[hsl(0_0%_100%/0.04)]"
              >
                New Circle
              </button>
              <button
                onClick={() => {
                  setEventSheetOpen({});
                  setAddMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-[hsl(0_0%_100%/0.04)]"
              >
                New Event
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Suggestions in empty state */}
      {circles.length === 0 && (
        <div className="px-5 mb-6">
          <p className="text-[13px] text-muted-text mb-2.5">Quick start with a suggestion:</p>
          <div className="flex flex-wrap gap-2">
            {CIRCLE_SUGGESTIONS.map((s) => (
              <button
                key={s.name}
                onClick={() =>
                  createCircle.mutateAsync({ name: s.name, emoji: s.emoji, color: 'hsl(0, 75%, 53%)', tone: 'red' })
                }
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground hover:border-[hsl(0_0%_100%/0.14)] transition-colors"
              >
                <span>{s.emoji}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Circles tier */}
      <SectionLabel>Circles</SectionLabel>
      {circles.length > 0 ? (
        <div className="px-5 grid grid-cols-2 gap-3">
          {circles.map((circle) => (
            <button
              key={circle.id}
              onClick={() => onSelectCircle(circle.id)}
              className={cn(
                'aspect-[3/2] rounded-xl p-3.5 flex flex-col justify-end text-left transition-transform active:scale-[0.98]',
                `tile-${circleTone(circle)}`,
              )}
            >
              <div className="text-[15px] font-semibold text-white truncate flex items-center gap-1">
                {circle.emoji && <span>{circle.emoji}</span>}
                <span className="truncate">{circle.name}</span>
              </div>
              <div className="text-[12px] text-white/70">
                {circleMemberCount(circle.id)} {circleMemberCount(circle.id) === 1 ? 'member' : 'members'}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-5">
          <p className="text-[13px] text-muted-text italic">No Circles yet. Tap + above to create one.</p>
        </div>
      )}

      {/* Section divider */}
      <div className="mx-5 my-6 h-px bg-[hsl(0_0%_100%/0.08)]" />

      {/* Events tier */}
      <SectionLabel>Events</SectionLabel>
      {events.length > 0 ? (
        <div className="px-5 grid grid-cols-2 gap-3">
          {events.map((evt) => (
            <button
              key={evt.id}
              onClick={() => onSelectEvent(evt.id)}
              className={cn(
                'aspect-[3/2] rounded-xl p-3.5 flex flex-col justify-end text-left transition-transform active:scale-[0.98]',
                `tile-${isValidTone(evt.tone) ? evt.tone : 'red'}`,
              )}
            >
              <div className="text-[15px] font-semibold text-white truncate">{evt.name}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[12px] text-white/70">
                  {eventMemberCount(evt.id)} {eventMemberCount(evt.id) === 1 ? 'member' : 'members'}
                </span>
                {(evt.start_date || evt.end_date) && (
                  <span className="text-[11px] text-white/60">{formatRange(evt.start_date, evt.end_date)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-5">
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-5 text-center">
            <button
              onClick={() => setEventSheetOpen({})}
              className="text-[13px] text-primary font-semibold"
            >
              + Log a trip, dinner, or event
            </button>
          </div>
        </div>
      )}

      {/* Archived link */}
      {archivedOnly.length > 0 && (
        <div className="px-5 mt-4">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-text hover:text-foreground transition-colors"
          >
            <Archive className="w-3.5 h-3.5" strokeWidth={1.75} />
            Archived ({archivedOnly.length})
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showArchived && 'rotate-180')} strokeWidth={1.75} />
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2">
              {archivedOnly.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)]"
                >
                  <button onClick={() => onSelectEvent(evt.id)} className="min-w-0 flex-1 text-left">
                    <div className="text-[14px] font-medium text-foreground truncate">{evt.name}</div>
                    <div className="text-[12px] text-muted-text">
                      {eventMemberCount(evt.id)} {eventMemberCount(evt.id) === 1 ? 'member' : 'members'}
                      {(evt.start_date || evt.end_date) && ` · ${formatRange(evt.start_date, evt.end_date)}`}
                    </div>
                  </button>
                  <button
                    onClick={() => archiveEvt.mutate({ id: evt.id, archived: false })}
                    className="text-[12px] font-semibold text-primary"
                  >
                    Unarchive
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {circleSheetOpen && (
          <CircleSheet
            onClose={(result) => {
              setCircleSheetOpen(false);
              if (result && 'id' in result) onSelectCircle(result.id);
            }}
          />
        )}
        {eventSheetOpen && (
          <EventSheet event={eventSheetOpen.event} onClose={() => setEventSheetOpen(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 mb-3">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">{children}</h2>
    </div>
  );
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  const fmt = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (start && !end) return fmt(start);
  if (!start && end) return fmt(end);
  if (start === end) return fmt(start!);
  return `${fmt(start!)} – ${fmt(end!)}`;
}
