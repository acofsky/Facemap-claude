import { useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, ImagePlus, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import {
  useCreatePerson, useUploadPhoto, useCircles, useSetPersonCircles, useCreateMeeting,
  useCreateEvent, useSetPersonEvents, usePersons,
} from '@/hooks/use-data';
import { useSmartClusters } from '@/hooks/use-smart-clusters';
import { matchSheetInputToCluster } from '@/lib/smart-circle';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface QuickAddSheetProps {
  onClose: () => void;
  /** Variant header copy. EoD notification opens with "Who'd you meet today?" (Q9). */
  variant?: 'default' | 'end-of-day';
}

export function QuickAddSheet({ onClose, variant = 'default' }: QuickAddSheetProps) {
  const [name, setName] = useState('');
  const [whereWhen, setWhereWhen] = useState('');
  const [dateMet, setDateMet] = useState('');
  const [note, setNote] = useState('');
  const [howWeMet, setHowWeMet] = useState('');
  const [physicalDescription, setPhysicalDescription] = useState('');
  const [importantInfo, setImportantInfo] = useState('');
  const [knownPeopleNotes, setKnownPeopleNotes] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showMore, setShowMore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createPerson = useCreatePerson();
  const uploadPhoto = useUploadPhoto();
  const setPersonCircles = useSetPersonCircles();
  const setPersonEventsMut = useSetPersonEvents();
  const createMeeting = useCreateMeeting();
  const createEvtMut = useCreateEvent();
  const { data: circles = [] } = useCircles();
  const { data: peopleAll = [] } = usePersons();
  const { clusters } = useSmartClusters();

  // Smart Circle inline strip (engine surface 2): suggest adding the new
  // person to a pending cluster's Event if their inputs match the vocab.
  const matchedCluster = useMemo(
    () => matchSheetInputToCluster({ how_we_met: howWeMet, where_when: whereWhen }, clusters, peopleAll),
    [clusters, peopleAll, howWeMet, whereWhen],
  );
  const [pendingEventJoin, setPendingEventJoin] = useState<{ name: string; fingerprint: string } | null>(null);
  const [stripDismissed, setStripDismissed] = useState(false);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleCircle = (id: string) => {
    setSelectedCircles((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const setToday = () => setDateMet(format(new Date(), 'yyyy-MM-dd'));

  const hasAnything =
    name || photoFile || note || howWeMet || whereWhen || dateMet || physicalDescription ||
    importantInfo || knownPeopleNotes || reminderDate || reminderNote || selectedCircles.length > 0;

  const handleSave = async () => {
    if (!hasAnything) return;
    let photos: string[] = [];
    if (photoFile) {
      const url = await uploadPhoto.mutateAsync(photoFile);
      photos = [url];
    }
    const person = await createPerson.mutateAsync({
      name: name || 'Unknown',
      photos,
      how_we_met: howWeMet || undefined,
      where_when: whereWhen || undefined,
      date_met: dateMet || undefined,
      physical_description: physicalDescription || undefined,
      important_info: importantInfo || undefined,
      known_people_notes: knownPeopleNotes || undefined,
      misc_notes: note || undefined,
      reminder_date: reminderDate || undefined,
      reminder_note: reminderNote || undefined,
    });
    if (selectedCircles.length > 0) {
      await setPersonCircles.mutateAsync({ personId: person.id, circleIds: selectedCircles });
    }
    await createMeeting.mutateAsync({
      person_id: person.id,
      meeting_date: dateMet || format(new Date(), 'yyyy-MM-dd'),
      place: whereWhen || undefined,
      notes: '• First encounter',
    });

    // Smart Circle surface-2 join: if the user accepted, attach this person to
    // the suggested Event. Create the Event lazily if it doesn't exist yet.
    if (pendingEventJoin) {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('name', pendingEventJoin.name)
        .is('archived_at', null)
        .limit(1);
      let eventId = existing?.[0]?.id;
      if (!eventId) {
        const evt = await createEvtMut.mutateAsync({
          name: pendingEventJoin.name,
          tone: 'red',
          start_date: format(new Date(), 'yyyy-MM-dd'),
          end_date: null,
        });
        eventId = evt.id;
      }
      await setPersonEventsMut.mutateAsync({ personId: person.id, eventIds: [eventId] });
    }

    onClose();
  };

  const saving = createPerson.isPending || uploadPhoto.isPending;
  const headerCopy = variant === 'end-of-day' ? "Who'd you meet today?" : 'Add Person';
  const inputClass =
    'w-full h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors';

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
          <h2 className="font-display text-xl text-foreground tracking-[-0.02em]">{headerCopy}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-3">
          {/* Photo */}
          <div className="flex justify-center">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-full bg-surface-1 border border-dashed border-[hsl(0_0%_100%/0.12)] flex items-center justify-center overflow-hidden hover:border-primary transition-colors"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-5 h-5 text-muted-text" strokeWidth={1.75} />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name…" className={inputClass} autoFocus />
          <input value={whereWhen} onChange={(e) => setWhereWhen(e.target.value)} placeholder="Where we met…" className={inputClass} />

          <div className="flex gap-2">
            <input
              type="date"
              value={dateMet}
              onChange={(e) => setDateMet(e.target.value)}
              className={cn(inputClass, 'flex-1')}
            />
            <button
              type="button"
              onClick={setToday}
              className={cn(
                'h-11 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-colors border',
                dateMet === format(new Date(), 'yyyy-MM-dd')
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-surface-2 text-muted-text border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)]',
              )}
            >
              Today
            </button>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notes…"
            rows={2}
            className={cn(inputClass, 'resize-none py-2.5 h-auto')}
          />

          {circles.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-2 block">Circles</span>
              <div className="flex flex-wrap gap-1.5">
                {circles.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCircle(c.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-sm text-[12px] font-medium transition-colors border',
                      selectedCircles.includes(c.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-surface-2 text-muted-text border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)]',
                    )}
                  >
                    {c.emoji ? `${c.emoji} ` : ''}{c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1 text-[12px] font-medium text-primary mx-auto"
          >
            {showMore ? 'Less details' : 'More details'}
            {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showMore && (
            <div className="space-y-3 animate-fade-in">
              <input value={howWeMet} onChange={(e) => setHowWeMet(e.target.value)} placeholder="How we met…" className={inputClass} />
              <textarea
                value={physicalDescription}
                onChange={(e) => setPhysicalDescription(e.target.value)}
                placeholder="Physical description…"
                rows={2}
                className={cn(inputClass, 'resize-none py-2.5 h-auto')}
              />
              <textarea
                value={importantInfo}
                onChange={(e) => setImportantInfo(e.target.value)}
                placeholder="Important info…"
                rows={2}
                className={cn(inputClass, 'resize-none py-2.5 h-auto')}
              />
              <textarea
                value={knownPeopleNotes}
                onChange={(e) => setKnownPeopleNotes(e.target.value)}
                placeholder="Who they know…"
                rows={2}
                className={cn(inputClass, 'resize-none py-2.5 h-auto')}
              />
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-1 block">Reminder date</span>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <input
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Reminder note…"
                className={inputClass}
              />
            </div>
          )}

          {/* Smart Circle inline strip (engine surface 2) */}
          {matchedCluster && !stripDismissed && !pendingEventJoin && (
            <div className="rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.08)] px-3 py-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-primary shrink-0" strokeWidth={1.75} />
              <p className="flex-1 text-[13px] text-foreground leading-snug">
                Add to <span className="font-semibold">{matchedCluster.suggestedName}</span>?
              </p>
              <button
                onClick={() => setStripDismissed(true)}
                className="text-[12px] text-muted-text"
              >
                No thanks
              </button>
              <button
                onClick={() =>
                  setPendingEventJoin({ name: matchedCluster.suggestedName, fingerprint: matchedCluster.fingerprint })
                }
                className="text-[12px] font-semibold text-primary"
              >
                Yes
              </button>
            </div>
          )}
          {pendingEventJoin && (
            <div className="rounded-md bg-surface-1 border border-primary/30 px-3 py-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-primary shrink-0" strokeWidth={1.75} />
              <p className="flex-1 text-[13px] text-foreground leading-snug">
                Joining <span className="font-semibold">{pendingEventJoin.name}</span> on save.
              </p>
              <button
                onClick={() => setPendingEventJoin(null)}
                className="text-[12px] text-muted-text"
              >
                Undo
              </button>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-5 border-t border-[hsl(0_0%_100%/0.08)]">
          <button
            onClick={handleSave}
            disabled={!hasAnything || saving}
            className="w-full h-[52px] rounded-md bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {saving ? 'Saving…' : 'Save Person'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
