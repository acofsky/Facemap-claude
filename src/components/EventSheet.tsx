import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ColorPicker } from '@/components/ColorPicker';
import { PersonAvatar } from '@/components/PersonAvatar';
import {
  useCreateEvent, useUpdateEvent, useArchiveEvent, useDeleteEvent,
  useSetPersonEvents, usePersons,
} from '@/hooks/use-data';
import { isValidTone, type Event as MembrEvent, type Tone } from '@/lib/store';
import { cn } from '@/lib/utils';

interface EventSheetProps {
  /** Existing event to edit. Omit for create. */
  event?: MembrEvent;
  /**
   * Smart Circle suggestion to pre-populate the create form with.
   * Ignored when editing. People in `personIds` are added to the new Event
   * on save and shown as suggested-members chips in the sheet body.
   */
  suggestion?: {
    name: string;
    startDate: string | null;
    endDate: string | null;
    personIds: string[];
  };
  onClose: () => void;
}

export function EventSheet({ event, suggestion, onClose }: EventSheetProps) {
  const isEdit = !!event;
  const [name, setName] = useState(event?.name ?? suggestion?.name ?? '');
  const [tone, setTone] = useState<Tone>(isValidTone(event?.tone) ? event!.tone : 'red');
  const [startDate, setStartDate] = useState(event?.start_date ?? suggestion?.startDate ?? '');
  const [endDate, setEndDate] = useState(event?.end_date ?? suggestion?.endDate ?? '');
  const [suggestedMemberIds, setSuggestedMemberIds] = useState<string[]>(
    suggestion?.personIds ?? [],
  );

  const { data: people = [] } = usePersons();
  const createEvt = useCreateEvent();
  const updateEvt = useUpdateEvent();
  const archiveEvt = useArchiveEvent();
  const deleteEvt = useDeleteEvent();
  const setPersonEventsMut = useSetPersonEvents();

  const saving = createEvt.isPending || updateEvt.isPending;
  const canSave = name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      if (isEdit && event) {
        await updateEvt.mutateAsync({
          id: event.id,
          updates: {
            name: name.trim(),
            tone,
            start_date: startDate || null,
            end_date: endDate || null,
          },
        });
      } else {
        const created = await createEvt.mutateAsync({
          name: name.trim(),
          tone,
          start_date: startDate || null,
          end_date: endDate || null,
        });
        // Auto-add any suggested members the user kept in the chip list.
        if (suggestedMemberIds.length > 0) {
          // Apply per-person so we don't overwrite a person's existing events.
          await Promise.all(
            suggestedMemberIds.map(async (personId) => {
              await setPersonEventsMut.mutateAsync({
                personId,
                // setPersonEvents replaces the set, so we need the union of
                // existing event memberships + this new one. The caller can't
                // easily know existing memberships here, so we do a focused
                // mutation: just add the new id to whatever's there.
                eventIds: [created.id, ...(await fetchExistingEventIdsForPerson(personId))],
              });
            }),
          );
        }
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Could not save event');
    }
  };

  // Lazy helper to avoid a hook restructure — re-fetch a person's current
  // event ids before unioning with the new one in the Smart-Circle add path.
  async function fetchExistingEventIdsForPerson(personId: string): Promise<string[]> {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await supabase
      .from('person_events')
      .select('event_id')
      .eq('person_id', personId);
    return (data ?? []).map((r) => r.event_id);
  }

  const handleArchive = async () => {
    if (!event) return;
    if (!confirm('Archive this Event? Members stay in your Membr; the Event hides from the Circles grid.')) return;
    await archiveEvt.mutateAsync({ id: event.id, archived: true });
    onClose();
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!confirm('Delete this Event? Members stay in your Membr.')) return;
    await deleteEvt.mutateAsync(event.id);
    onClose();
  };

  const inputClass =
    'w-full h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-base text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors';

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 400 }}
        className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md bg-surface-2 rounded-t-2xl border border-[hsl(0_0%_100%/0.12)] z-50 max-h-[88vh] flex flex-col safe-bottom"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-display text-xl text-foreground tracking-[-0.02em]">
            {isEdit ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-4">
          {/* Name */}
          <div>
            <input
              autoFocus={!isEdit}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spring trip, John's wedding, Conference…"
              className={inputClass}
              maxLength={80}
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-1.5 block">Start</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-1.5 block">End</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
                min={startDate || undefined}
              />
            </label>
          </div>

          {/* Color picker */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-2 block">Colour</span>
            <ColorPicker value={tone} onChange={setTone} />
          </div>

          {/* Live preview */}
          <div className={cn('rounded-xl px-4 pb-4 pt-12 flex flex-col justify-end', `tile-${tone}`)}>
            <div className="text-[15px] font-semibold text-white truncate">
              {name.trim() || 'Event name'}
            </div>
            <div className="text-[11px] text-white/70">
              {formatDateRange(startDate, endDate) ||
                `${suggestedMemberIds.length} ${suggestedMemberIds.length === 1 ? 'member' : 'members'}`}
            </div>
          </div>

          {/* Smart Circle suggested members */}
          {!isEdit && suggestion && suggestedMemberIds.length > 0 && (
            <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                Suggested members
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestedMemberIds.map((id) => {
                  const p = people.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => setSuggestedMemberIds((arr) => arr.filter((x) => x !== id))}
                      className="inline-flex items-center gap-1.5 pl-1 pr-2 h-7 rounded-sm bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-[12px] text-foreground"
                    >
                      <PersonAvatar name={p.name} photo={p.photos?.[0]} size="sm" className="!w-5 !h-5 !text-[10px]" />
                      <span className="truncate max-w-[120px]">{p.name}</span>
                      <X className="w-3 h-3 text-muted-text" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-text mt-2">Tap a chip to remove. They'll be added when you create the Event.</p>
            </div>
          )}

          {isEdit && (
            <div className="flex gap-2">
              <button
                onClick={handleArchive}
                className="flex-1 h-10 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-muted-text text-sm font-medium hover:border-[hsl(0_0%_100%/0.18)] transition-colors"
              >
                Archive
              </button>
              <button
                onClick={handleDelete}
                aria-label="Delete event"
                className="inline-flex items-center justify-center h-10 px-3 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-destructive hover:border-destructive/40 transition-colors"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-5 border-t border-[hsl(0_0%_100%/0.08)]">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full h-[52px] rounded-md bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-40 active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create Event'}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start && !end) return '';
  const fmt = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  if (start && !end) return fmt(start);
  if (!start && end) return fmt(end);
  if (start === end) return fmt(start!);
  return `${fmt(start!)} – ${fmt(end!)}`;
}
