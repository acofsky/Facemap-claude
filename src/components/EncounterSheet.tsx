import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, CalendarDays, Check, Loader2, MapPin, NotebookPen, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import {
  usePersons,
  useCreatePerson,
  useCreateMeeting,
  useUpdateMeeting,
  useSetMeetingParticipants,
} from '@/hooks/use-data';
import type { MeetingWithParticipants } from '@/lib/store';
import { PersonAvatar } from '@/components/PersonAvatar';
import { BulletTextarea } from '@/components/BulletTextarea';

/** A tagged additional person: either a Membr person (personId) or a
 *  name-only tag (externalName). The owner of the encounter is never here. */
interface TagPart {
  key: string;
  personId?: string;
  externalName?: string;
}

interface EncounterSheetProps {
  /** The encounter's owner. For a new encounter this is the profile you're
   *  logging from; when editing it's the meeting's original owner, which may
   *  differ from the profile you're viewing (a mirrored, tagged-in encounter). */
  ownerPersonId: string;
  /** The profile currently being viewed. Hidden from the tag list / search so
   *  you never tag yourself, while staying in the saved set if you were tagged. */
  viewerPersonId: string;
  /** Present = edit an existing encounter; omit = create a new one. */
  meeting?: MeetingWithParticipants | null;
  /** Optional owner name/photo to show in the header (e.g. when opened from
   *  the global Log-encounter picker, where there's no profile context). */
  ownerName?: string;
  ownerPhoto?: string;
  /** When set, a back chevron appears in the header (returns to a picker). */
  onBack?: () => void;
  /** Set false when a parent already holds the scroll lock, to avoid two
   *  competing locks (useScrollLock isn't ref-counted). Defaults true. */
  lockScroll?: boolean;
  onClose: () => void;
}

export function EncounterSheet({
  ownerPersonId,
  viewerPersonId,
  meeting,
  ownerName,
  ownerPhoto,
  onBack,
  lockScroll = true,
  onClose,
}: EncounterSheetProps) {
  useScrollLock(lockScroll);
  const { data: people = [] } = usePersons();
  const createPerson = useCreatePerson();
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const setParticipants = useSetMeetingParticipants();

  const isEdit = !!meeting;
  const [date, setDate] = useState(meeting?.meeting_date ?? format(new Date(), 'yyyy-MM-dd'));
  const [place, setPlace] = useState(meeting?.place ?? '');
  const [notes, setNotes] = useState(meeting?.notes ?? '');
  const [tags, setTags] = useState<TagPart[]>(() =>
    (meeting?.participants ?? []).map((p) =>
      p.person_id
        ? { key: `p:${p.person_id}`, personId: p.person_id }
        : { key: `n:${(p.external_name ?? '').toLowerCase()}`, externalName: p.external_name ?? '' },
    ),
  );
  const [tagQuery, setTagQuery] = useState('');
  const [promotingKey, setPromotingKey] = useState<string | null>(null);
  // If a new-encounter save creates the meeting but then fails while
  // attaching participants, remember the id so a retry re-applies the fields
  // and re-attaches instead of creating a second, duplicate meeting.
  const createdMeetingId = useRef<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const whoSectionRef = useRef<HTMLDivElement>(null);

  const taggedPersonIds = useMemo(
    () => new Set(tags.filter((t) => t.personId).map((t) => t.personId!)),
    [tags],
  );

  // People matching the search, minus the owner, the viewer, and anyone
  // already tagged.
  const matches = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter((p) => p.id !== ownerPersonId && p.id !== viewerPersonId && !taggedPersonIds.has(p.id))
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [people, tagQuery, ownerPersonId, viewerPersonId, taggedPersonIds]);

  // Chips shown to the user — hide the viewer's own row (it stays in `tags`
  // so saving preserves their tag on a mirrored encounter).
  const visibleTags = tags.filter((t) => t.personId !== viewerPersonId);

  // When editing a mirrored encounter from a profile that ISN'T the owner,
  // the owner (stored on meetings.person_id, not in participants) is still
  // "someone else who was there" from this viewer's point of view. Show them
  // as a read-only chip so the sheet matches the card's "with X". It's not
  // part of the editable tag set, so saving never rewrites ownership.
  const ownerPerson =
    ownerPersonId !== viewerPersonId ? people.find((p) => p.id === ownerPersonId) : undefined;

  // Offer "add as a name" when the typed text isn't an exact match we already
  // show or have tagged — so people not in Membr can still be attached.
  const trimmedQuery = tagQuery.trim();
  const showAddAsName =
    trimmedQuery.length > 0 &&
    !tags.some((t) => t.externalName?.toLowerCase() === trimmedQuery.toLowerCase()) &&
    !matches.some((p) => p.name.toLowerCase() === trimmedQuery.toLowerCase());

  // Focused state drives a one-time scroll + a spacer that reserves room
  // below the tag field for results. We never auto-scroll on result changes —
  // that yanked the cursor around as the list grew/shrank while typing.
  const [tagFocused, setTagFocused] = useState(false);

  const handleTagFocus = () => {
    setTagFocused(true);
    // Once, after the keyboard + sheet resize settles: bring the "Who else
    // was there" section near the top of the visible body (~12% down),
    // leaving the rest below for results. The spacer guarantees there's
    // enough scrollable room to actually move it up that far.
    setTimeout(() => {
      const body = bodyRef.current;
      const sec = whoSectionRef.current;
      if (!body || !sec) return;
      const top =
        body.scrollTop +
        sec.getBoundingClientRect().top -
        body.getBoundingClientRect().top -
        body.clientHeight * 0.12;
      body.scrollTo({ top, behavior: 'smooth' });
    }, 300);
  };

  const nameOf = (t: TagPart) =>
    t.personId ? people.find((p) => p.id === t.personId)?.name ?? 'Someone' : t.externalName ?? '';
  const photoOf = (t: TagPart) =>
    t.personId ? people.find((p) => p.id === t.personId)?.photos?.[0] : undefined;

  const addPersonTag = (id: string) => {
    haptics.selection();
    setTags((cur) => (cur.some((t) => t.personId === id) ? cur : [...cur, { key: `p:${id}`, personId: id }]));
    setTagQuery('');
  };

  const addExternalTag = (name: string) => {
    const n = name.trim();
    if (!n) return;
    haptics.selection();
    const key = `n:${n.toLowerCase()}`;
    setTags((cur) => (cur.some((t) => t.key === key) ? cur : [...cur, { key, externalName: n }]));
    setTagQuery('');
  };

  const removeTag = (key: string) => setTags((cur) => cur.filter((t) => t.key !== key));

  // Turn a name-only tag into a real Membr person on demand.
  const promoteTag = async (tag: TagPart) => {
    if (!tag.externalName) return;
    setPromotingKey(tag.key);
    try {
      const person = await createPerson.mutateAsync({ name: tag.externalName });
      setTags((cur) =>
        cur.map((t) => (t.key === tag.key ? { key: `p:${person.id}`, personId: person.id } : t)),
      );
      toast.success(`${tag.externalName} added to Membr`);
    } catch {
      toast.error('Could not add to Membr');
    } finally {
      setPromotingKey(null);
    }
  };

  const busy = createMeeting.isPending || updateMeeting.isPending || setParticipants.isPending;

  const handleSave = async () => {
    if (!date || busy) return;
    haptics.medium();
    const participants = tags.map((t) =>
      t.personId ? { personId: t.personId } : { externalName: t.externalName },
    );
    const updates = { meeting_date: date, place: place.trim() || null, notes: notes.trim() || null };
    try {
      // Resolve the meeting id, creating it only once. Editing an existing
      // meeting, or retrying a save whose create already succeeded, both go
      // through updateMeeting; only a genuinely new encounter inserts.
      let meetingId: string;
      if (isEdit && meeting) {
        meetingId = meeting.id;
        await updateMeeting.mutateAsync({ id: meetingId, updates });
      } else if (createdMeetingId.current) {
        meetingId = createdMeetingId.current;
        await updateMeeting.mutateAsync({ id: meetingId, updates });
      } else {
        const created = await createMeeting.mutateAsync({
          person_id: ownerPersonId,
          meeting_date: date,
          place: place.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        meetingId = created.id;
        createdMeetingId.current = created.id;
      }
      await setParticipants.mutateAsync({ meetingId, participants });
      toast.success(isEdit ? 'Encounter updated' : 'Encounter logged');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save encounter');
    }
  };

  const inputClass = 'glass-input w-full h-11 px-3.5 text-sm';

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={busy ? undefined : onClose} />
      <div
        className="kb-aware-sheet fixed left-0 right-0 mx-auto w-full max-w-md glass-sheet rounded-t-2xl z-[60] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 pt-4 pb-3 shrink-0">
          {onBack && (
            <button
              onClick={onBack}
              disabled={busy}
              aria-label="Back"
              className="w-9 h-9 -ml-1 rounded-md flex items-center justify-center hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
          {ownerName && <PersonAvatar name={ownerName} photo={ownerPhoto} size="sm" />}
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl text-foreground tracking-[-0.02em] truncate">
              {isEdit ? 'Edit encounter' : 'New encounter'}
            </h3>
            {ownerName && <p className="text-[12px] text-muted-text truncate">with {ownerName}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="w-9 h-9 -mr-1 rounded-md flex items-center justify-center hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text disabled:opacity-50"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable body — keeps the footer pinned above the keyboard. */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
          <label className="block">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-1.5">
              <CalendarDays className="w-3 h-3" strokeWidth={1.75} /> Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              /* min-w-0 + appearance-none lets iOS shrink the date input to the
                 container instead of overflowing at its intrinsic width. */
              className={cn(inputClass, 'min-w-0 appearance-none')}
            />
          </label>

          <label className="block">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-1.5">
              <MapPin className="w-3 h-3" strokeWidth={1.75} /> Place
              <span className="font-normal normal-case tracking-normal text-muted-text/70">(optional)</span>
            </span>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Coffee shop, gym…"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-1.5">
              <NotebookPen className="w-3 h-3" strokeWidth={1.75} /> Notes
              <span className="font-normal normal-case tracking-normal text-muted-text/70">(optional)</span>
            </span>
            <BulletTextarea value={notes} onChange={setNotes} placeholder="What did you talk about?" rows={3} />
          </label>

          {/* Who else was there */}
          <div ref={whoSectionRef}>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-1.5">
              <UserPlus className="w-3 h-3" strokeWidth={1.75} /> Who else was there
              <span className="font-normal normal-case tracking-normal text-muted-text/70">(optional)</span>
            </span>

            {(ownerPerson || visibleTags.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ownerPerson && (
                  <span
                    className="glass-pill inline-flex items-center gap-1.5 !h-8 !px-2.5 text-[12px] text-foreground"
                    title="Logged this encounter"
                  >
                    <PersonAvatar name={ownerPerson.name} photo={ownerPerson.photos?.[0]} size="xs" />
                    <span className="max-w-[120px] truncate">{ownerPerson.name}</span>
                  </span>
                )}
                {visibleTags.map((t) => (
                  <span
                    key={t.key}
                    className="glass-pill inline-flex items-center gap-1.5 !h-8 !px-2.5 text-[12px] text-foreground"
                  >
                    <PersonAvatar name={nameOf(t)} photo={photoOf(t)} size="xs" />
                    <span className="max-w-[120px] truncate">{nameOf(t)}</span>
                    {!t.personId && (
                      <button
                        onClick={() => promoteTag(t)}
                        disabled={promotingKey === t.key}
                        title="Add to Membr"
                        className="text-primary text-[11px] font-semibold disabled:opacity-50"
                      >
                        {promotingKey === t.key ? '…' : '+Membr'}
                      </button>
                    )}
                    <button onClick={() => removeTag(t.key)} aria-label={`Remove ${nameOf(t)}`} className="text-muted-text">
                      <X className="w-3 h-3" strokeWidth={2} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" strokeWidth={1.75} />
              <input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                onFocus={handleTagFocus}
                onBlur={() => setTagFocused(false)}
                placeholder="Tag someone…"
                className={cn(inputClass, 'pl-10')}
              />
            </div>

            {trimmedQuery.length > 0 && (
              <div className="mt-1.5 glass rounded-xl max-h-56 overflow-y-auto divide-y divide-[hsl(0_0%_100%/0.06)]">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addPersonTag(p.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[hsl(0_0%_100%/0.04)] transition-colors"
                  >
                    <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                    <span className="text-sm text-foreground flex-1 text-left truncate font-medium">{p.name}</span>
                  </button>
                ))}
                {showAddAsName && (
                  <button
                    onClick={() => addExternalTag(trimmedQuery)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[hsl(0_0%_100%/0.04)] transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full glass-pill flex items-center justify-center shrink-0">
                      <UserPlus className="w-4 h-4 text-primary" strokeWidth={1.75} />
                    </span>
                    <span className="text-sm text-foreground flex-1 text-left truncate">
                      Add <span className="font-semibold">“{trimmedQuery}”</span>
                      <span className="text-muted-text"> — not in Membr yet</span>
                    </span>
                  </button>
                )}
                {matches.length === 0 && !showAddAsName && (
                  <p className="text-[12px] text-muted-text italic px-3 py-3">Already tagged.</p>
                )}
              </div>
            )}
          </div>

          {/* Reserves scroll room below the tag field so the one-time focus
              scroll can lift the section up and leave space for results.
              Sits below the results, so removing it on blur never shifts the
              tappable result rows. */}
          {tagFocused && <div aria-hidden className="shrink-0 h-72" />}
        </div>

        {/* Footer — inside the sheet so kb-aware-sheet keeps it above the keyboard. */}
        <div className="shrink-0 px-5 py-3 border-t border-[hsl(0_0%_100%/0.08)] safe-bottom flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 h-[52px] rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-sm font-medium text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !date}
            className="flex-1 h-[52px] rounded-2xl bg-primary text-primary-foreground text-[15px] font-semibold shadow-[0_8px_24px_rgba(224,48,48,0.35)] disabled:opacity-50 active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={1.75} />}
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}
