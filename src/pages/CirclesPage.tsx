import { useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, Archive, Pencil, Trash2 } from 'lucide-react';
import {
  useCircles, useCreateCircle, usePersonCircles, useEvents, usePersonEvents,
  useArchiveEvent, useDeleteCircle, useDeleteEvent,
} from '@/hooks/use-data';
import { CircleSheet } from '@/components/CircleSheet';
import { EventSheet } from '@/components/EventSheet';
import { Skeleton } from '@/components/ui/skeleton';
import { CircleTileSkeleton, EventTileSkeleton } from '@/components/skeletons';
import { useLongPress } from '@/hooks/use-long-press';
import { isValidTone, TONES, type Event as MembrEvent, type Tone, type Circle } from '@/lib/store';
import { cn } from '@/lib/utils';

interface CirclesPageProps {
  onSelectCircle: (id: string) => void;
  onSelectEvent: (id: string) => void;
  embedded?: boolean;
}

function circleTone(c: { id: string; tone?: string | null }): Tone {
  if (isValidTone(c.tone)) return c.tone;
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

export function CirclesPage({ onSelectCircle, onSelectEvent, embedded = false }: CirclesPageProps) {
  const { data: circles = [], isLoading } = useCircles();
  const { data: personCircles = [] } = usePersonCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });
  const { data: archivedEvents = [] } = useEvents({ includeArchived: true });
  const { data: personEvents = [] } = usePersonEvents();
  const archiveEvt = useArchiveEvent();
  const deleteCircle = useDeleteCircle();
  const deleteEvent = useDeleteEvent();
  const createCircle = useCreateCircle();

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [circleSheetOpen, setCircleSheetOpen] = useState(false);
  const [eventSheetOpen, setEventSheetOpen] = useState<{ event?: MembrEvent } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [tileMenu, setTileMenu] = useState<
    | { kind: 'circle'; id: string; x: number; y: number }
    | { kind: 'event'; id: string; x: number; y: number }
    | null
  >(null);

  const openContextMenu = (kind: 'circle' | 'event', id: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setTileMenu({ kind, id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } as typeof tileMenu);
  };

  const archivedOnly = useMemo(
    () => archivedEvents.filter((e) => e.archived_at !== null),
    [archivedEvents],
  );

  const circleMemberCount = (id: string) => personCircles.filter((pc) => pc.circle_id === id).length;
  const eventMemberCount = (id: string) => personEvents.filter((pe) => pe.event_id === id).length;

  const AddPlusButton = (
    <div className="relative">
      <button
        onClick={() => setAddMenuOpen((v) => !v)}
        onBlur={() => setTimeout(() => setAddMenuOpen(false), 150)}
        aria-label="Create"
        className="glass-pill !h-9 !w-9 !p-0 flex items-center justify-center text-foreground active:scale-95 transition-transform"
      >
        <Plus className="w-4 h-4" strokeWidth={1.75} />
      </button>
      {addMenuOpen && (
        <div className="glass absolute right-0 top-full mt-2 w-44 z-20 p-1.5">
          <button
            onClick={() => {
              setCircleSheetOpen(true);
              setAddMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 text-[13px] rounded-md text-foreground"
          >
            New Circle
          </button>
          <button
            onClick={() => {
              setEventSheetOpen({});
              setAddMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 text-[13px] rounded-md text-foreground"
          >
            New Event
          </button>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="pb-8 animate-fade-in">
        {!embedded && (
          <div className="sticky top-0 z-20 flex items-center justify-between px-5 pt-3 pb-3 mb-1">
            <span className="w-9" />
            <h1 className="font-display text-[20px] text-foreground">Circles</h1>
            <span className="w-9" />
          </div>
        )}
        <div className="px-5 mb-3">
          <Skeleton className="h-3 w-16 bg-[hsl(0_0%_100%/0.04)]" />
        </div>
        <div className="px-5 grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CircleTileSkeleton key={i} />
          ))}
        </div>
        <div className="mx-5 my-6 h-px bg-[hsl(0_0%_100%/0.08)]" />
        <div className="px-5 mb-3">
          <Skeleton className="h-3 w-16 bg-[hsl(0_0%_100%/0.04)]" />
        </div>
        <div className="px-5 grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <EventTileSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8 animate-fade-in">
      {!embedded && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 pt-3 pb-3 mb-1">
          <span className="w-9" />
          <h1 className="font-display text-[20px] text-foreground">Circles</h1>
          <div>{AddPlusButton}</div>
        </div>
      )}

      {circles.length === 0 && (
        <div className="px-5 mb-6">
          <p className="text-[13px] text-[hsl(var(--foreground)/0.6)] mb-2.5 font-display-italic">
            Quick start with a suggestion:
          </p>
          <div className="flex flex-wrap gap-2">
            {CIRCLE_SUGGESTIONS.map((s) => (
              <button
                key={s.name}
                onClick={() =>
                  createCircle.mutateAsync({ name: s.name, emoji: s.emoji, color: 'hsl(0, 75%, 53%)', tone: 'red' })
                }
                className="glass-pill"
              >
                <span>{s.emoji}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Circles tier */}
      <SectionLabel right={embedded ? AddPlusButton : null}>Circles</SectionLabel>
      {circles.length > 0 ? (
        <div className="px-5 grid grid-cols-2 gap-x-4 gap-y-5">
          {circles.map((circle) => (
            <CircleTile
              key={circle.id}
              circle={circle}
              memberCount={circleMemberCount(circle.id)}
              onTap={() => onSelectCircle(circle.id)}
              onLongPress={(target) => openContextMenu('circle', circle.id, target)}
            />
          ))}
        </div>
      ) : (
        <div className="px-5">
          <p className="text-[13px] text-[hsl(var(--foreground)/0.55)] font-display-italic">
            No Circles yet. Tap + above to create one.
          </p>
        </div>
      )}

      <div className="mx-5 my-7 h-px bg-[hsl(0_0%_100%/0.08)]" />

      {/* Events tier */}
      <SectionLabel>Events</SectionLabel>
      {events.length > 0 ? (
        <div className="px-5 space-y-3">
          {events.map((evt) => (
            <EventTile
              key={evt.id}
              event={evt}
              memberCount={eventMemberCount(evt.id)}
              onTap={() => onSelectEvent(evt.id)}
              onLongPress={(target) => openContextMenu('event', evt.id, target)}
            />
          ))}
        </div>
      ) : (
        <div className="px-5">
          <div className="glass p-5 text-center">
            <button
              onClick={() => setEventSheetOpen({})}
              className="text-[13px] text-primary font-semibold"
            >
              + Log a trip, dinner, or event
            </button>
          </div>
        </div>
      )}

      {archivedOnly.length > 0 && (
        <div className="px-5 mt-5">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[hsl(var(--foreground)/0.55)]"
          >
            <Archive className="w-3.5 h-3.5" strokeWidth={1.75} />
            Archived ({archivedOnly.length})
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showArchived && 'rotate-180')} strokeWidth={1.75} />
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2">
              {archivedOnly.map((evt) => (
                <div key={evt.id} className="glass flex items-center justify-between p-3">
                  <button onClick={() => onSelectEvent(evt.id)} className="min-w-0 flex-1 text-left">
                    <div className="text-[14px] font-medium text-foreground truncate">{evt.name}</div>
                    <div className="text-[11px] text-[hsl(var(--foreground)/0.55)]">
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

      {tileMenu && (
        <div
          className="fixed inset-0 z-[55]"
          onPointerDown={() => setTileMenu(null)}
        >
          <div
            className="glass absolute w-44 p-1.5"
            style={{
              left: Math.max(12, Math.min(window.innerWidth - 188, tileMenu.x - 88)),
              top: Math.max(12, tileMenu.y),
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {tileMenu.kind === 'circle' ? (
              <>
                <MenuItem
                  icon={Pencil}
                  label="Edit"
                  onClick={() => {
                    const c = circles.find((x) => x.id === tileMenu.id);
                    setTileMenu(null);
                    if (c) onSelectCircle(c.id);
                  }}
                />
                <MenuItem
                  icon={Trash2}
                  destructive
                  label="Delete"
                  onClick={async () => {
                    setTileMenu(null);
                    if (confirm('Delete this Circle? People will not be removed from Membr.')) {
                      await deleteCircle.mutateAsync(tileMenu.id);
                    }
                  }}
                />
              </>
            ) : (
              <>
                <MenuItem
                  icon={Pencil}
                  label="Edit"
                  onClick={() => {
                    const evt = events.find((x) => x.id === tileMenu.id) || archivedEvents.find((x) => x.id === tileMenu.id);
                    setTileMenu(null);
                    if (evt) setEventSheetOpen({ event: evt });
                  }}
                />
                <MenuItem
                  icon={Archive}
                  label="Archive"
                  onClick={async () => {
                    setTileMenu(null);
                    await archiveEvt.mutateAsync({ id: tileMenu.id, archived: true });
                  }}
                />
                <MenuItem
                  icon={Trash2}
                  destructive
                  label="Delete"
                  onClick={async () => {
                    setTileMenu(null);
                    if (confirm('Delete this Event? Members stay in your Membr.')) {
                      await deleteEvent.mutateAsync(tileMenu.id);
                    }
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CircleTile({
  circle,
  memberCount,
  onTap,
  onLongPress,
}: {
  circle: Circle;
  memberCount: number;
  onTap: () => void;
  onLongPress: (target: HTMLElement) => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const longPress = useLongPress(() => {
    if (ref.current) onLongPress(ref.current);
  });
  return (
    <button
      ref={ref}
      onClick={onTap}
      onContextMenu={(e) => {
        e.preventDefault();
        if (ref.current) onLongPress(ref.current);
      }}
      {...longPress}
      className="flex flex-col items-center gap-2 py-2 transition-transform active:scale-[0.97]"
    >
      <span
        aria-hidden="true"
        className={cn(
          'w-28 h-28 rounded-full flex items-center justify-center text-[40px]',
          `tile-${circleTone(circle)}`,
        )}
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.18), 0 12px 28px rgba(0,0,0,0.45)',
        }}
      >
        {circle.emoji || ''}
      </span>
      <span className="font-display text-[15px] text-foreground text-center max-w-full px-2 truncate leading-tight">
        {circle.name}
      </span>
      <span className="text-[11px] text-[hsl(var(--foreground)/0.55)] -mt-1.5">
        {memberCount} {memberCount === 1 ? 'member' : 'members'}
      </span>
    </button>
  );
}

function EventTile({
  event,
  memberCount,
  onTap,
  onLongPress,
}: {
  event: MembrEvent;
  memberCount: number;
  onTap: () => void;
  onLongPress: (target: HTMLElement) => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const longPress = useLongPress(() => {
    if (ref.current) onLongPress(ref.current);
  });
  const tone = isValidTone(event.tone) ? event.tone : 'red';
  return (
    <button
      ref={ref}
      onClick={onTap}
      onContextMenu={(e) => {
        e.preventDefault();
        if (ref.current) onLongPress(ref.current);
      }}
      {...longPress}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl p-4 text-left transition-transform active:scale-[0.99]',
        // The tile gradient washes in as the underlying fill; the .glass
        // layer goes on top for the frosted highlight + hairline border.
        `tile-${tone}`,
      )}
      style={{
        minHeight: 92,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <div className="font-display text-[18px] text-white truncate leading-tight">
        {event.name}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[12px] text-white/80">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </span>
        {(event.start_date || event.end_date) && (
          <span className="text-[11px] text-white/65 font-display-italic">
            {formatRange(event.start_date, event.end_date)}
          </span>
        )}
      </div>
    </button>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 text-sm rounded-md flex items-center gap-2',
        destructive ? 'text-primary font-semibold' : 'text-foreground',
      )}
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
      {label}
    </button>
  );
}

function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-5 mb-3 flex items-end justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground)/0.55)]">
        {children}
      </h2>
      {right}
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
