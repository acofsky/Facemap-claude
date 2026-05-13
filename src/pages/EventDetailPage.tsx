import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Pencil, Plus, UserMinus, ChevronRight, X, Sparkles } from 'lucide-react';
import {
  useEvents, usePersons, usePersonEvents, useSetPersonEvents,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { EventSheet } from '@/components/EventSheet';
import { suggestEventMembers } from '@/lib/smart-circle';
import { isValidTone } from '@/lib/store';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface EventDetailPageProps {
  eventId: string;
  onBack: () => void;
  onSelectPerson: (id: string) => void;
}

const SURFACE3_DISMISSED_PREFIX = 'membr_evt_s3_dismissed:';

function isSurface3Dismissed(eventId: string): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(SURFACE3_DISMISSED_PREFIX + eventId) === '1';
}

function dismissSurface3(eventId: string) {
  window.localStorage.setItem(SURFACE3_DISMISSED_PREFIX + eventId, '1');
}

export function EventDetailPage({ eventId, onBack, onSelectPerson }: EventDetailPageProps) {
  const { data: events = [] } = useEvents({ includeArchived: true });
  const { data: people = [] } = usePersons();
  const { data: personEvents = [] } = usePersonEvents();
  const setPersonEventsMut = useSetPersonEvents();

  const [editOpen, setEditOpen] = useState(false);
  const [addingPeople, setAddingPeople] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [pendingAddIds, setPendingAddIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSuggestionsDismissed(isSurface3Dismissed(eventId));
  }, [eventId]);

  const event = events.find((e) => e.id === eventId);
  const tone = event && isValidTone(event.tone) ? event.tone : 'red';

  const memberIds = useMemo(
    () => personEvents.filter((pe) => pe.event_id === eventId).map((pe) => pe.person_id),
    [personEvents, eventId],
  );
  const members = useMemo(() => people.filter((p) => memberIds.includes(p.id)), [people, memberIds]);
  const nonMembers = useMemo(() => people.filter((p) => !memberIds.includes(p.id)), [people, memberIds]);

  const surface3People = useMemo(() => {
    if (!event || suggestionsDismissed) return [];
    return suggestEventMembers(event.name, people, memberIds);
  }, [event, people, memberIds, suggestionsDismissed]);

  const addPersonToEvent = async (personId: string) => {
    setPendingAddIds((s) => new Set(s).add(personId));
    try {
      // Read existing event memberships for this person so we don't overwrite.
      const { data } = await supabase
        .from('person_events')
        .select('event_id')
        .eq('person_id', personId);
      const current = (data ?? []).map((r) => r.event_id);
      await setPersonEventsMut.mutateAsync({
        personId,
        eventIds: Array.from(new Set([...current, eventId])),
      });
    } finally {
      setPendingAddIds((s) => {
        const n = new Set(s);
        n.delete(personId);
        return n;
      });
    }
  };

  const removePersonFromEvent = async (personId: string) => {
    const { data } = await supabase
      .from('person_events')
      .select('event_id')
      .eq('person_id', personId);
    const current = (data ?? []).map((r) => r.event_id).filter((id) => id !== eventId);
    await setPersonEventsMut.mutateAsync({ personId, eventIds: current });
  };

  const handleDismissSuggestions = () => {
    dismissSurface3(eventId);
    setSuggestionsDismissed(true);
  };

  if (!event) {
    return (
      <div className="px-5 pt-20 text-center safe-top">
        <p className="text-sm text-muted-text">Event not found.</p>
        <button onClick={onBack} className="mt-4 text-primary text-sm font-semibold">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="pb-10 animate-fade-in safe-top">
      {/* Nav bar */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <div className="flex flex-col items-center min-w-0 px-2">
          <h1 className="font-sans text-[17px] font-semibold text-foreground truncate">{event.name}</h1>
          {(event.start_date || event.end_date) && (
            <span className="text-[12px] text-muted-text">{formatRange(event.start_date, event.end_date)}</span>
          )}
        </div>
        <button onClick={() => setEditOpen(true)} aria-label="Edit Event" className="w-10 h-10 -mr-1 flex items-center justify-center text-foreground active:scale-95 transition-transform">
          <Pencil className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Hero tile */}
      <div className="px-5 mt-2 mb-6">
        <div className={cn('rounded-xl px-4 pb-4 pt-12 flex flex-col justify-end', `tile-${tone}`)}>
          <div className="text-[15px] font-semibold text-white truncate">{event.name}</div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[12px] text-white/70">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
            {(event.start_date || event.end_date) && (
              <span className="text-[11px] text-white/60">{formatRange(event.start_date, event.end_date)}</span>
            )}
          </div>
        </div>
        {event.archived_at && (
          <p className="mt-2 text-[12px] text-muted-text italic">
            Archived {new Date(event.archived_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Smart Circle Surface 3 — suggestions card at the top of the member list */}
      {surface3People.length > 0 && (
        <div className="px-5 mb-5">
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">
                <Sparkles className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                These people might belong here too —
              </div>
              <button
                onClick={handleDismissSuggestions}
                className="text-[12px] font-medium text-muted-text"
              >
                Done
              </button>
            </div>
            <div className="space-y-1">
              {surface3People.map((p) => {
                const isPending = pendingAddIds.has(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-md">
                    <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                    <span className="text-sm text-foreground flex-1 min-w-0 truncate">{p.name}</span>
                    <button
                      onClick={() => addPersonToEvent(p.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 px-2.5 h-8 rounded-sm bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Add
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">Members</h2>
        <button
          onClick={() => setAddingPeople((v) => !v)}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-primary"
        >
          {addingPeople ? <><X className="w-3.5 h-3.5" strokeWidth={1.75} /> Done</> : <><Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Add</>}
        </button>
      </div>

      {addingPeople && nonMembers.length > 0 && (
        <div className="px-5 mb-5">
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-2 space-y-1 max-h-72 overflow-y-auto">
            {nonMembers.map((p) => (
              <button
                key={p.id}
                onClick={() => addPersonToEvent(p.id)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-[hsl(0_0%_100%/0.04)] transition-colors text-left"
              >
                <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                <span className="text-sm text-foreground flex-1">{p.name}</span>
                <Plus className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </div>
      )}
      {addingPeople && nonMembers.length === 0 && (
        <p className="px-5 text-[13px] text-muted-text italic mb-5">Everyone is already in this Event.</p>
      )}

      <div className="px-5 space-y-2">
        {members.length === 0 ? (
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-5 text-center">
            <p className="text-[14px] text-muted-text">No one in this Event yet.</p>
            <p className="text-[12px] text-muted-text mt-1">
              Add people and tag this Event, or wait for a Smart suggestion.
            </p>
          </div>
        ) : (
          members.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3.5 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)]"
            >
              <button onClick={() => onSelectPerson(p.id)} className="flex-1 flex items-center gap-3 text-left">
                <PersonAvatar name={p.name} photo={p.photos[0]} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-foreground truncate">{p.name}</div>
                  {p.misc_notes && (
                    <div className="text-[12px] text-muted-text truncate">
                      {p.misc_notes.replace(/^\s*[•\-*]\s*/gm, '').slice(0, 60)}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-text shrink-0" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => removePersonFromEvent(p.id)}
                aria-label={`Remove ${p.name}`}
                className="p-2 rounded-md text-muted-text hover:text-destructive transition-colors"
              >
                <UserMinus className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {editOpen && (
          <EventSheet
            event={event}
            onClose={() => setEditOpen(false)}
          />
        )}
      </AnimatePresence>
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
