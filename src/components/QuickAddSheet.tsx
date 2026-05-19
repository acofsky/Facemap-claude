import { useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, ImagePlus, Sparkles, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { DragHandle } from '@/components/DragHandle';
import { AIBadge } from '@/components/AIBadge';
import { BulletTextarea } from '@/components/BulletTextarea';
import { haptics } from '@/lib/haptics';
import {
  useCreatePerson, useUploadPhoto, useCircles, useSetPersonCircles, useCreateMeeting,
  useCreateEvent, useSetPersonEvents, usePersons, useEvents,
} from '@/hooks/use-data';
import { useSmartClusters } from '@/hooks/use-smart-clusters';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import { PhotoCropModal } from '@/components/PhotoCropModal';
import { matchSheetInputToCluster } from '@/lib/smart-circle';
import { isValidTone } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { invokeAI } from '@/lib/invoke-ai';
import { friendlyError } from '@/lib/errors';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface QuickAddSheetProps {
  onClose: () => void;
  /** Variant header copy. EoD notification opens with "Who'd you meet today?" (Q9). */
  variant?: 'default' | 'end-of-day';
}

export function QuickAddSheet({ onClose, variant = 'default' }: QuickAddSheetProps) {
  // Freeze the page underneath so iOS doesn't scroll <main> to keep the
  // autofocused name input "in view" — the input is in a fixed sheet, but
  // WebView doesn't know that and bumps the underlying page.
  useScrollLock();
  const [name, setName] = useState('');
  const [whereWhen, setWhereWhen] = useState('');
  const [dateMet, setDateMet] = useState('');
  const [howWeMet, setHowWeMet] = useState('');
  const [physicalDescription, setPhysicalDescription] = useState('');
  const [background, setBackground] = useState(''); // formerly "Important info"
  const [misc, setMisc] = useState('');
  const [knownPeopleNotes, setKnownPeopleNotes] = useState('');
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createPerson = useCreatePerson();
  const uploadPhoto = useUploadPhoto();
  const setPersonCirclesMut = useSetPersonCircles();
  const setPersonEventsMut = useSetPersonEvents();
  const createMeeting = useCreateMeeting();
  const createEvtMut = useCreateEvent();
  const { data: circles = [] } = useCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });
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
    e.target.value = '';
    if (!file) return;
    // Send the user to the crop step before we keep the file.
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropped = (file: File) => {
    const src = cropSrc;
    setCropSrc(null);
    if (src) URL.revokeObjectURL(src);
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const cancelCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const toggleCircle = (id: string) => {
    haptics.light();
    setSelectedCircles((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };
  const toggleEvent = (id: string) => {
    haptics.light();
    setSelectedEvents((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const setToday = () => setDateMet(format(new Date(), 'yyyy-MM-dd'));

  // AI from photo: needs the photo to be uploaded first so the edge function
  // can fetch it via signed URL. Upload-on-demand if the user hits the wand
  // before saving.
  const handleGenerateDescription = async () => {
    if (!photoFile && !photoPreview) {
      toast.error('Add a photo first');
      return;
    }
    setGeneratingDesc(true);
    try {
      let uploadedPath: string;
      if (photoFile) {
        uploadedPath = await uploadPhoto.mutateAsync(photoFile);
        // Replace file with the already-uploaded path so save doesn't re-upload.
        setPhotoFile(null);
        setPhotoPreview(uploadedPath);
      } else {
        uploadedPath = photoPreview!;
      }
      const { getPhotoUrl } = await import('@/lib/store');
      const photoUrl = await getPhotoUrl(uploadedPath);
      const data = await invokeAI<{ description?: string }>('describe-from-photo', { photoUrl });
      const description = data?.description || '';
      if (description) setPhysicalDescription(description);
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't generate a description from this photo. Try again."));
    } finally {
      setGeneratingDesc(false);
    }
  };

  const hasAnything =
    name || photoFile || misc || howWeMet || whereWhen || dateMet || physicalDescription ||
    background || knownPeopleNotes || selectedCircles.length > 0 || selectedEvents.length > 0;

  const handleSave = async () => {
    if (!hasAnything) return;
    haptics.medium();
    let photos: string[] = [];
    if (photoFile) {
      const url = await uploadPhoto.mutateAsync(photoFile);
      photos = [url];
    } else if (photoPreview && !photoPreview.startsWith('data:')) {
      // Already-uploaded path (from photo-AI flow).
      photos = [photoPreview];
    }
    const person = await createPerson.mutateAsync({
      name: name || 'Unknown',
      photos,
      how_we_met: howWeMet || undefined,
      where_when: whereWhen || undefined,
      date_met: dateMet || undefined,
      physical_description: physicalDescription || undefined,
      important_info: background || undefined,
      known_people_notes: knownPeopleNotes || undefined,
      misc_notes: misc || undefined,
    });
    if (selectedCircles.length > 0) {
      await setPersonCirclesMut.mutateAsync({ personId: person.id, circleIds: selectedCircles });
    }
    if (selectedEvents.length > 0) {
      await setPersonEventsMut.mutateAsync({ personId: person.id, eventIds: selectedEvents });
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
      await setPersonEventsMut.mutateAsync({
        personId: person.id,
        eventIds: Array.from(new Set([...selectedEvents, eventId])),
      });
    }

    onClose();
  };

  const saving = createPerson.isPending || uploadPhoto.isPending;
  const headerCopy = variant === 'end-of-day' ? "Who'd you meet today?" : 'Add Person';
  const inputClass =
    'w-full h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-base text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors';

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 400 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 || info.velocity.y > 500) {
            haptics.light();
            onClose();
          }
        }}
        className="kb-aware-sheet fixed left-0 right-0 mx-auto w-full max-w-md bg-surface-2 rounded-t-2xl border-t border-[hsl(0_0%_100%/0.12)] z-[60] flex flex-col safe-bottom"
      >
        <DragHandle />
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className="font-display text-xl text-foreground tracking-[-0.02em]">{headerCopy}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden flex-1 px-5 pb-5 space-y-5">
          {/* Photo */}
          <div className="flex justify-center">
            <div className="relative">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-full bg-surface-1 border border-dashed border-[hsl(0_0%_100%/0.2)] flex items-center justify-center overflow-hidden hover:border-primary transition-colors"
              >
                {photoPreview ? (
                  <img src={photoPreview.startsWith('data:') ? photoPreview : photoPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-5 h-5 text-muted-text" strokeWidth={1.75} />
                )}
              </button>
              {photoPreview && (
                <button
                  onClick={handleGenerateDescription}
                  disabled={generatingDesc}
                  aria-label="Describe from photo"
                  className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                  style={{ boxShadow: '0 4px 12px hsl(var(--primary) / 0.35)' }}
                >
                  {generatingDesc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" strokeWidth={1.75} />}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </div>
          </div>

          {/* Name */}
          <Field label="Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Their name"
              className={inputClass}
              autoFocus
            />
          </Field>

          {/* Where we met */}
          <Field label="Where we met">
            <input
              value={whereWhen}
              onChange={(e) => setWhereWhen(e.target.value)}
              placeholder="Tribeca Rooftop, NYC"
              className={inputClass}
            />
          </Field>

          {/* When we met */}
          <Field label="When we met">
            <div className="flex gap-2">
              <input
                type="date"
                value={dateMet}
                onChange={(e) => setDateMet(e.target.value)}
                className={cn(inputClass, 'flex-1 min-w-0')}
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
          </Field>

          {/* How we met */}
          <Field label="How we met">
            <input
              value={howWeMet}
              onChange={(e) => setHowWeMet(e.target.value)}
              placeholder="Sat next to each other at the dinner"
              className={inputClass}
            />
          </Field>

          {/* Physical description (with optional AI hint) */}
          <Field
            label="Physical description"
            right={photoPreview && physicalDescription ? <AIBadge feature="description" /> : undefined}
          >
            <textarea
              value={physicalDescription}
              onChange={(e) => setPhysicalDescription(e.target.value)}
              placeholder="Tall, dark beard, wears glasses…"
              rows={2}
              className={cn(inputClass, 'h-auto py-2.5 resize-none')}
            />
          </Field>

          {/* Background (renamed from Important info) */}
          <Field label="Background">
            <BulletTextarea
              value={background}
              onChange={setBackground}
              placeholder="Work, school, or anything you should know about them…"
              rows={3}
            />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <BulletTextarea
              value={misc}
              onChange={setMisc}
              placeholder="What should you remember about them?"
              rows={3}
            />
          </Field>

          {/* Who they know */}
          <Field label="Who they know">
            <textarea
              value={knownPeopleNotes}
              onChange={(e) => setKnownPeopleNotes(e.target.value)}
              placeholder="They know Sarah from yoga, Mike's cousin…"
              rows={2}
              className={cn(inputClass, 'h-auto py-2.5 resize-none')}
            />
          </Field>

          {/* Circles */}
          {circles.length > 0 && (
            <Field label="Circles">
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
            </Field>
          )}

          {/* Events */}
          {events.length > 0 && (
            <Field label="Events">
              <div className="flex flex-wrap gap-1.5">
                {events.map((e) => {
                  const tone = isValidTone(e.tone) ? e.tone : 'red';
                  const on = selectedEvents.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEvent(e.id)}
                      className={cn(
                        'px-2.5 py-1 rounded-sm text-[12px] font-medium transition-all border',
                        on
                          ? `tile-${tone} text-white border-transparent`
                          : 'bg-surface-2 text-muted-text border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)]',
                      )}
                    >
                      {e.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {/* Smart Circle inline strip (engine surface 2) */}
          {matchedCluster && !stripDismissed && !pendingEventJoin && (
            <div className="rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.08)] px-3 py-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-primary shrink-0" strokeWidth={1.75} />
              <p className="flex-1 text-[13px] text-foreground leading-snug">
                Add to <span className="font-semibold">{matchedCluster.suggestedName}</span>?
              </p>
              <button onClick={() => setStripDismissed(true)} className="text-[12px] text-muted-text">
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
              <button onClick={() => setPendingEventJoin(null)} className="text-[12px] text-muted-text">
                Undo
              </button>
            </div>
          )}
        </div>

        {/* Sticky footer — Save Person always reachable above the keyboard */}
        <div className="px-5 pt-3 pb-5 border-t border-[hsl(0_0%_100%/0.08)]">
          <button
            onClick={handleSave}
            disabled={!hasAnything || saving}
            className="w-full h-[52px] rounded-md bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-40 active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Person'}
          </button>
        </div>
      </motion.div>

      {cropSrc && (
        <PhotoCropModal imageSrc={cropSrc} onCancel={cancelCrop} onCropped={handleCropped} />
      )}
    </>
  );
}

function Field({
  label,
  required,
  right,
  children,
}: {
  label: string;
  required?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text">
          {label}
          {required && <span className="text-primary ml-1">*</span>}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}
