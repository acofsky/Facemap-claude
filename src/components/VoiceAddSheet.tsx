import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Mic, Square, Loader2, Sparkles, Check, RotateCcw, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { DragHandle } from '@/components/DragHandle';
import { PersonAvatar } from '@/components/PersonAvatar';
import { BulletTextarea } from '@/components/BulletTextarea';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import { useVoiceCapture } from '@/hooks/use-voice-capture';
import { haptics } from '@/lib/haptics';
import { invokeAI } from '@/lib/invoke-ai';
import { friendlyError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
  useCreatePerson, useUpdatePerson, useCreateMeeting, usePersons,
} from '@/hooks/use-data';

type Sheet = 'intro' | 'recording' | 'analyzing' | 'review';

type ProfileField = 'how_we_met' | 'where_when' | 'important_info' | 'misc_notes';

interface ParsedVoiceNote {
  mode: 'new_person' | 'encounter';
  person_match?: {
    id: string;
    confidence: 'high' | 'medium' | 'low';
    alternative_ids?: string[];
  };
  person_fields?: {
    name?: string;
    how_we_met?: string;
    where_when?: string;
    date_met?: string;
    physical_description?: string;
    important_info?: string;
    misc_notes?: string;
  };
  encounter_fields?: {
    meeting_date?: string;
    place?: string;
    notes?: string;
  };
  profile_updates?: Array<{
    field: ProfileField;
    current_value: string;
    proposed_value: string;
    reason: string;
  }>;
}

interface VoiceAddSheetProps {
  onClose: () => void;
}

export function VoiceAddSheet({ onClose }: VoiceAddSheetProps) {
  useScrollLock();
  const voice = useVoiceCapture();
  const [sheet, setSheet] = useState<Sheet>('intro');
  const [parsed, setParsed] = useState<ParsedVoiceNote | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Editable mirrors of the parsed fields — the user can adjust before accepting.
  const [mode, setMode] = useState<'new_person' | 'encounter'>('new_person');
  const [matchedPersonId, setMatchedPersonId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [whereWhen, setWhereWhen] = useState('');
  const [dateMet, setDateMet] = useState('');
  const [howWeMet, setHowWeMet] = useState('');
  const [physicalDescription, setPhysicalDescription] = useState('');
  const [importantInfo, setImportantInfo] = useState('');
  const [miscNotes, setMiscNotes] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [place, setPlace] = useState('');
  const [encounterNotes, setEncounterNotes] = useState('');
  const [acceptedUpdates, setAcceptedUpdates] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: people = [] } = usePersons();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const createMeeting = useCreateMeeting();

  const matchedPerson = useMemo(
    () => (matchedPersonId ? people.find((p) => p.id === matchedPersonId) : null),
    [matchedPersonId, people],
  );

  // Drive the sheet's UI state off the voice capture state. When recognition
  // ends (manually or via silence timeout) we either analyze the transcript,
  // or — if nothing was captured — return to intro. Errors from start() are
  // reported synchronously by startRecording(); this effect only handles
  // mid-recording transitions.
  useEffect(() => {
    if (sheet !== 'recording') return;
    if (voice.state === 'idle') {
      const text = voice.transcript.trim();
      if (text.length > 0) {
        void runAnalyze(text);
      } else {
        // Stopped with no speech captured — bounce back without a toast.
        setSheet('intro');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.state, voice.transcript, sheet]);

  const startRecording = async () => {
    if (saving) return;
    voice.reset();
    const res = await voice.start();
    if (!res.ok) {
      if (res.error) toast.error(res.error);
      return;
    }
    // Only flip the UI to recording AFTER the native session confirmed it's
    // listening, so a failed start doesn't briefly flash the recording panel.
    setSheet('recording');
  };

  const stopRecording = async () => {
    await voice.stop();
  };

  const runAnalyze = async (transcript: string) => {
    setSheet('analyzing');
    try {
      const data = await invokeAI<{ parsed: ParsedVoiceNote }>('parse-voice-input', { transcript });
      const p = data?.parsed;
      if (!p || !p.mode) throw new Error('Empty parse');
      hydrateFromParsed(p);
      setSheet('review');
      haptics.light();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      console.error('parse-voice-input failed:', raw);
      // Pick a specific message so the user knows whether to retry, redeploy,
      // or check connectivity instead of just seeing the generic fallback.
      let msg: string;
      const lower = raw.toLowerCase();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        msg = "You're offline. Connect and try again.";
      } else if (lower.includes('not found') || lower.includes('404')) {
        msg = "Voice add isn't deployed on the server yet. Run the supabase-deploy GitHub Action.";
      } else if (lower.includes('api key') || lower.includes('anthropic_api_key')) {
        msg = "Anthropic API key isn't set in Supabase. Run the supabase-deploy GitHub Action.";
      } else if (lower.includes('rate limit') || lower.includes('429')) {
        msg = 'Anthropic is rate-limiting. Wait a moment and try again.';
      } else if (lower.includes('ai gateway') || lower.includes('5')) {
        // Includes 500-class server errors from Anthropic and our own thrown
        // "AI gateway error". Show the underlying message so we can tell
        // whether it was an empty-parse or a real Anthropic failure.
        msg = `Couldn't parse: ${raw}`;
      } else {
        msg = `Couldn't parse: ${raw}`;
      }
      toast.error(msg);
      setSheet('intro');
    }
  };

  const hydrateFromParsed = (p: ParsedVoiceNote) => {
    setParsed(p);
    setMode(p.mode);
    setMatchedPersonId(p.person_match?.id ?? null);

    const today = format(new Date(), 'yyyy-MM-dd');

    setName(p.person_fields?.name ?? '');
    setWhereWhen(p.person_fields?.where_when ?? '');
    setDateMet(p.person_fields?.date_met ?? '');
    setHowWeMet(p.person_fields?.how_we_met ?? '');
    setPhysicalDescription(p.person_fields?.physical_description ?? '');
    setImportantInfo(p.person_fields?.important_info ?? '');
    setMiscNotes(p.person_fields?.misc_notes ?? '');

    setMeetingDate(p.encounter_fields?.meeting_date ?? today);
    setPlace(p.encounter_fields?.place ?? '');
    setEncounterNotes(p.encounter_fields?.notes ?? '');

    // Profile updates default to all accepted.
    const all = new Set<number>();
    (p.profile_updates ?? []).forEach((_, i) => all.add(i));
    setAcceptedUpdates(all);
  };

  const restart = () => {
    voice.reset();
    setParsed(null);
    setMatchedPersonId(null);
    setName('');
    setWhereWhen('');
    setDateMet('');
    setHowWeMet('');
    setPhysicalDescription('');
    setImportantInfo('');
    setMiscNotes('');
    setMeetingDate('');
    setPlace('');
    setEncounterNotes('');
    setAcceptedUpdates(new Set());
    setSheet('intro');
  };

  const toggleUpdate = (idx: number) => {
    haptics.selection();
    setAcceptedUpdates((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const setToday = () => setDateMet(format(new Date(), 'yyyy-MM-dd'));
  const setMeetToday = () => setMeetingDate(format(new Date(), 'yyyy-MM-dd'));

  const canAccept = mode === 'new_person'
    ? name.trim().length > 0
    : !!matchedPersonId;

  const handleAccept = async () => {
    if (!canAccept || saving) return;
    setSaving(true);
    haptics.medium();
    try {
      if (mode === 'new_person') {
        const person = await createPerson.mutateAsync({
          name: name.trim() || 'Unknown',
          photos: [],
          how_we_met: howWeMet.trim() || undefined,
          where_when: whereWhen.trim() || undefined,
          date_met: dateMet || undefined,
          physical_description: physicalDescription.trim() || undefined,
          important_info: importantInfo.trim() || undefined,
          misc_notes: miscNotes.trim() || undefined,
        });
        // Always log a first encounter so the new person starts with timeline state.
        await createMeeting.mutateAsync({
          person_id: person.id,
          meeting_date: meetingDate || dateMet || format(new Date(), 'yyyy-MM-dd'),
          place: place.trim() || whereWhen.trim() || undefined,
          notes: encounterNotes.trim() || '• First encounter',
        });
        toast.success(`${person.name} added`);
      } else {
        if (!matchedPersonId) throw new Error('No person selected');
        await createMeeting.mutateAsync({
          person_id: matchedPersonId,
          meeting_date: meetingDate || format(new Date(), 'yyyy-MM-dd'),
          place: place.trim() || undefined,
          notes: encounterNotes.trim() || undefined,
        });
        // Apply accepted profile updates as a single update.
        const updates: Partial<Record<ProfileField, string>> = {};
        (parsed?.profile_updates ?? []).forEach((u, i) => {
          if (acceptedUpdates.has(i)) updates[u.field] = u.proposed_value;
        });
        if (Object.keys(updates).length > 0) {
          await updatePerson.mutateAsync({ id: matchedPersonId, updates });
        }
        toast.success(`Logged encounter with ${matchedPerson?.name ?? 'them'}`);
      }
      onClose();
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't save. Try again."));
      setSaving(false);
    }
  };

  const liveTranscript = (voice.transcript + (voice.partial ? ` ${voice.partial}` : '')).trim();
  const inputClass =
    'w-full h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-base text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors';
  const textareaClass = cn(inputClass, 'h-auto py-2.5 resize-none');

  const headerCopy =
    sheet === 'intro' ? 'Voice add'
      : sheet === 'recording' ? 'Listening…'
      : sheet === 'analyzing' ? 'Thinking…'
      : 'Review';

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={sheet === 'analyzing' || saving ? undefined : onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 400 }}
        drag={sheet === 'review' ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (sheet !== 'review') return;
          if (info.offset.y > 100 || info.velocity.y > 500) {
            haptics.light();
            onClose();
          }
        }}
        className="kb-aware-sheet fixed left-0 right-0 mx-auto w-full max-w-md glass-sheet rounded-t-2xl z-[60] flex flex-col safe-bottom"
      >
        <DragHandle />
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className="font-display text-xl text-foreground tracking-[-0.02em]">{headerCopy}</h2>
          {sheet !== 'analyzing' && !saving && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
            </button>
          )}
        </div>

        <div className="overflow-y-auto overflow-x-hidden flex-1 px-5 pb-5">
          {sheet === 'intro' && (
            <IntroPanel onStart={startRecording} error={voice.error} />
          )}

          {sheet === 'recording' && (
            <RecordingPanel
              partial={liveTranscript || voice.partial}
              onStop={stopRecording}
            />
          )}

          {sheet === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm text-muted-text">Membr is thinking…</p>
            </div>
          )}

          {sheet === 'review' && (
            <div className="space-y-5 pt-1">
              <ModeChip
                mode={mode}
                matchedPerson={matchedPerson ?? null}
                confidence={parsed?.person_match?.confidence}
                onChangePerson={() => setPickerOpen(true)}
              />

              {mode === 'new_person' ? (
                <>
                  <Field label="Name" required>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Their name"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Where we met">
                    <input
                      value={whereWhen}
                      onChange={(e) => setWhereWhen(e.target.value)}
                      placeholder="Tribeca Rooftop, NYC"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="When we met">
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dateMet}
                        onChange={(e) => setDateMet(e.target.value)}
                        className={cn(inputClass, 'flex-1 min-w-0 appearance-none')}
                      />
                      <button
                        type="button"
                        onClick={setToday}
                        className={cn(
                          'h-11 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-colors border',
                          dateMet === format(new Date(), 'yyyy-MM-dd')
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-surface-2 text-muted-text border-[hsl(0_0%_100%/0.08)]',
                        )}
                      >
                        Today
                      </button>
                    </div>
                  </Field>
                  <Field label="How we met">
                    <input
                      value={howWeMet}
                      onChange={(e) => setHowWeMet(e.target.value)}
                      placeholder="Sat next to each other at the dinner"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Physical description">
                    <textarea
                      value={physicalDescription}
                      onChange={(e) => setPhysicalDescription(e.target.value)}
                      placeholder="Tall, dark beard, wears glasses…"
                      rows={2}
                      className={textareaClass}
                    />
                  </Field>
                  <Field label="Background">
                    <BulletTextarea
                      value={importantInfo}
                      onChange={setImportantInfo}
                      placeholder="Work, school, key context…"
                      rows={3}
                    />
                  </Field>
                  <Field label="Notes">
                    <BulletTextarea
                      value={miscNotes}
                      onChange={setMiscNotes}
                      placeholder="What should you remember?"
                      rows={3}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Date">
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={meetingDate}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        className={cn(inputClass, 'flex-1 min-w-0 appearance-none')}
                      />
                      <button
                        type="button"
                        onClick={setMeetToday}
                        className={cn(
                          'h-11 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-colors border',
                          meetingDate === format(new Date(), 'yyyy-MM-dd')
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-surface-2 text-muted-text border-[hsl(0_0%_100%/0.08)]',
                        )}
                      >
                        Today
                      </button>
                    </div>
                  </Field>
                  <Field label="Place">
                    <input
                      value={place}
                      onChange={(e) => setPlace(e.target.value)}
                      placeholder="Coffee shop, gym…"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Notes">
                    <BulletTextarea
                      value={encounterNotes}
                      onChange={setEncounterNotes}
                      placeholder="What did you talk about?"
                      rows={3}
                    />
                  </Field>

                  {(parsed?.profile_updates?.length ?? 0) > 0 && (
                    <ProfileUpdatesPanel
                      updates={parsed!.profile_updates!}
                      accepted={acceptedUpdates}
                      onToggle={toggleUpdate}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {sheet === 'review' && (
          <div className="px-5 pt-3 pb-5 border-t border-[hsl(0_0%_100%/0.08)] flex gap-2">
            <button
              onClick={restart}
              disabled={saving}
              className="h-[52px] px-4 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.12)] text-[13px] font-medium text-muted-text flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
              Start over
            </button>
            <button
              onClick={handleAccept}
              disabled={!canAccept || saving}
              className="flex-1 h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] shadow-[0_8px_24px_rgba(224,48,48,0.35)] disabled:opacity-40 active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={1.75} />}
              {saving ? 'Saving…' : (mode === 'new_person' ? 'Save person' : 'Save encounter')}
            </button>
          </div>
        )}
      </motion.div>

      {pickerOpen && (
        <PersonPickerSheet
          people={people}
          alternativeIds={parsed?.person_match?.alternative_ids ?? []}
          onCancel={() => setPickerOpen(false)}
          onSelect={(id) => {
            setMode('encounter');
            setMatchedPersonId(id);
            setPickerOpen(false);
            haptics.light();
          }}
          onTreatAsNew={() => {
            setMode('new_person');
            setMatchedPersonId(null);
            // Carry over notes that the user dictated into the new-person fields if blank.
            if (!miscNotes.trim() && encounterNotes.trim()) setMiscNotes(encounterNotes.trim());
            setPickerOpen(false);
            haptics.light();
          }}
        />
      )}
    </>
  );
}

function IntroPanel({ onStart, error }: { onStart: () => void; error: string | null }) {
  return (
    <div className="flex flex-col items-center text-center py-8 gap-5">
      <p className="text-sm text-muted-text px-2 leading-relaxed">
        Talk naturally about someone new or an encounter you had — Membr will figure out the rest.
      </p>
      <button
        onClick={onStart}
        aria-label="Start recording"
        className="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
        style={{ boxShadow: '0 8px 28px hsl(var(--primary) / 0.45)' }}
      >
        <Mic className="w-9 h-9" strokeWidth={1.75} />
      </button>
      <p className="text-[12px] text-muted-text/70">Tap the mic to start</p>
      {error && (
        <p className="text-[12px] text-primary/90 px-4">{error}</p>
      )}
    </div>
  );
}

function RecordingPanel({ partial, onStop }: { partial: string; onStop: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-6 gap-5">
      <button
        onClick={onStop}
        aria-label="Stop recording"
        className="relative w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
        style={{ boxShadow: '0 8px 28px hsl(var(--primary) / 0.55)' }}
      >
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-primary"
          animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.35, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ zIndex: -1 }}
        />
        <Square className="w-8 h-8 fill-current" strokeWidth={0} />
      </button>
      <p className="text-[12px] text-muted-text">Tap to stop</p>
      <div className="w-full min-h-[120px] rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-3.5 text-left">
        <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {partial || <span className="text-muted-text italic">Listening…</span>}
        </p>
      </div>
    </div>
  );
}

function ModeChip({
  mode,
  matchedPerson,
  confidence,
  onChangePerson,
}: {
  mode: 'new_person' | 'encounter';
  matchedPerson: { id: string; name: string; photos: string[] | null } | null;
  confidence: 'high' | 'medium' | 'low' | undefined;
  onChangePerson: () => void;
}) {
  if (mode === 'new_person') {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.08)] px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.75} />
          <span className="text-[13px] text-foreground font-medium">New person</span>
        </div>
        <button
          onClick={onChangePerson}
          className="text-[12px] text-muted-text underline-offset-2 hover:underline shrink-0"
        >
          Already in Membr?
        </button>
      </div>
    );
  }
  const lowConfidence = confidence === 'low';
  return (
    <div className={cn(
      'flex items-center justify-between gap-2 rounded-md px-3 py-2.5 border',
      lowConfidence
        ? 'bg-surface-1 border-primary/30'
        : 'bg-surface-1 border-[hsl(0_0%_100%/0.08)]',
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.75} />
        <span className="text-[13px] text-muted-text shrink-0">Encounter with</span>
        {matchedPerson && <PersonAvatar name={matchedPerson.name} photo={matchedPerson.photos?.[0]} size="sm" />}
        <span className="text-[13px] text-foreground font-medium truncate">
          {matchedPerson?.name ?? 'Unknown'}
        </span>
        {lowConfidence && (
          <span className="text-[10px] uppercase tracking-wide text-primary/90 font-semibold shrink-0">Confirm</span>
        )}
      </div>
      <button
        onClick={onChangePerson}
        aria-label="Change person"
        className="text-[12px] text-muted-text underline-offset-2 hover:underline shrink-0 flex items-center gap-0.5"
      >
        Change <ChevronDown className="w-3 h-3" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function ProfileUpdatesPanel({
  updates,
  accepted,
  onToggle,
}: {
  updates: NonNullable<ParsedVoiceNote['profile_updates']>;
  accepted: Set<number>;
  onToggle: (idx: number) => void;
}) {
  return (
    <div className="rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.12)] p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.75} />
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">
          Updates to their profile
        </span>
      </div>
      <div className="space-y-2.5">
        {updates.map((u, i) => {
          const on = accepted.has(i);
          return (
            <button
              key={i}
              onClick={() => onToggle(i)}
              className={cn(
                'w-full text-left rounded-md border p-2.5 transition-colors',
                on
                  ? 'bg-surface-2 border-primary/40'
                  : 'bg-surface-2 border-[hsl(0_0%_100%/0.08)] opacity-60',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'w-4 h-4 rounded-sm border flex items-center justify-center shrink-0',
                  on ? 'bg-primary border-primary' : 'border-[hsl(0_0%_100%/0.25)]',
                )}>
                  {on && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={2.5} />}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-text">
                  {fieldLabel(u.field)}
                </span>
              </div>
              <p className="text-[12px] text-muted-text/80 leading-snug line-through mb-0.5">
                {u.current_value}
              </p>
              <p className="text-[13px] text-foreground leading-snug">
                {u.proposed_value}
              </p>
              {u.reason && (
                <p className="text-[11px] text-muted-text/70 leading-snug mt-1.5 italic">{u.reason}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fieldLabel(field: ProfileField): string {
  switch (field) {
    case 'how_we_met': return 'How we met';
    case 'where_when': return 'Where we met';
    case 'important_info': return 'Background';
    case 'misc_notes': return 'Notes';
  }
}

function PersonPickerSheet({
  people,
  alternativeIds,
  onSelect,
  onTreatAsNew,
  onCancel,
}: {
  people: Array<{ id: string; name: string; photos: string[] | null }>;
  alternativeIds: string[];
  onSelect: (id: string) => void;
  onTreatAsNew: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const alts = useMemo(
    () => alternativeIds.map((id) => people.find((p) => p.id === id)).filter(Boolean) as typeof people,
    [alternativeIds, people],
  );
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
    return list.slice(0, 30);
  }, [query, people]);

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/70" onClick={onCancel} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 400 }}
        className="kb-aware-sheet fixed left-0 right-0 mx-auto w-full max-w-md glass-sheet rounded-t-2xl z-[70] p-5 safe-bottom"
      >
        <DragHandle />
        <h3 className="font-display text-xl text-foreground tracking-[-0.02em] mb-3">Pick a person</h3>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="w-full h-11 px-3.5 mb-3 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
        />
        {alts.length > 0 && query.trim().length === 0 && (
          <div className="mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-1.5">
              Other plausible matches
            </p>
            <div className="space-y-1">
              {alts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-[hsl(0_0%_100%/0.04)]"
                >
                  <PersonAvatar name={p.name} photo={p.photos?.[0]} size="sm" />
                  <span className="text-sm text-foreground font-medium truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="max-h-72 overflow-y-auto space-y-1">
          {matches.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-[hsl(0_0%_100%/0.04)]"
            >
              <PersonAvatar name={p.name} photo={p.photos?.[0]} size="sm" />
              <span className="text-sm text-foreground font-medium truncate">{p.name}</span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="text-[12px] text-muted-text italic text-center py-4">
              {query.trim() ? `No one matches "${query}"` : 'No people yet'}
            </p>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-[hsl(0_0%_100%/0.08)] flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-sm font-medium text-muted-text"
          >
            Cancel
          </button>
          <button
            onClick={onTreatAsNew}
            className="flex-1 h-11 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.18)] text-sm font-medium text-foreground"
          >
            Treat as new
          </button>
        </div>
      </motion.div>
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text">
          {label}
          {required && <span className="text-primary ml-1">*</span>}
        </span>
      </div>
      {children}
    </div>
  );
}
