import { useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Camera, Check, ChevronDown, ChevronUp, Loader2, MapPin, Plus, Sparkles, Trash2, Wand2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  usePerson, usePersons, useCircles, useUpdatePerson, useUploadPhoto,
  useSetPersonCircles, useSetPersonEvents, useEvents, useDeletePerson,
} from '@/hooks/use-data';
import { BulletTextarea } from '@/components/BulletTextarea';
import { ContactLinkSection } from '@/components/ContactLinkSection';
import { PersonAvatar } from '@/components/PersonAvatar';
import { AIBadge } from '@/components/AIBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PhotoCropModal } from '@/components/PhotoCropModal';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { isValidTone } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useSwipeBack } from '@/hooks/use-swipe-back';

interface PersonEditPageProps {
  personId: string;
  /**
   * Called on cancel (with discard if needed), save, or delete. When the
   * person was just deleted, `result.deleted` is true so the caller can
   * route past the now-stale Person Profile screen.
   */
  onClose: (result?: { deleted?: boolean }) => void;
}

/**
 * PEOPLE-03 — Edit Person. Native push from PEOPLE-02. Full-screen.
 * Cancel guards unsaved changes; Save is pinned to the footer.
 */
export function PersonEditPage({ personId, onClose }: PersonEditPageProps) {
  const { data: person, isLoading } = usePerson(personId);
  const { data: circles = [] } = useCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });
  const updatePerson = useUpdatePerson();
  const uploadPhoto = useUploadPhoto();
  const setPersonCircles = useSetPersonCircles();
  const setPersonEvents = useSetPersonEvents();
  const deletePersonMut = useDeletePerson();
  const fileRef = useRef<HTMLInputElement>(null);

  // Loading guard
  const initial = useMemo(
    () => ({
      name: person?.name ?? '',
      photos: person?.photos ?? [],
      how_we_met: person?.how_we_met ?? '',
      where_when: person?.where_when ?? '',
      misc_notes: person?.misc_notes ?? '',
      physical_description: person?.physical_description ?? '',
      physical_ai: person?.physical_description_ai_generated ?? false,
      important_info: person?.important_info ?? '',
      known_people_notes: person?.known_people_notes ?? '',
      circleIds: person?.circleIds ?? [],
      eventIds: person?.eventIds ?? [],
    }),
    [person],
  );

  const [name, setName] = useState(initial.name);
  const [photos, setPhotos] = useState<string[]>(initial.photos);
  const [howWeMet, setHowWeMet] = useState(initial.how_we_met);
  const [whereWhen, setWhereWhen] = useState(initial.where_when);
  const [miscNotes, setMiscNotes] = useState(initial.misc_notes);
  const [physical, setPhysical] = useState(initial.physical_description);
  // Track whether the current physical_description was AI-generated. Set
  // true when describe-from-photo writes the field; cleared whenever the
  // user edits the textarea so manual edits don't keep the AI badge.
  const [physicalAi, setPhysicalAi] = useState(initial.physical_ai);
  const [important, setImportant] = useState(initial.important_info);
  const [known, setKnown] = useState(initial.known_people_notes);
  const [circleIds, setCircleIds] = useState<string[]>(initial.circleIds);
  const [eventIds, setEventIds] = useState<string[]>(initial.eventIds);

  const [showMore, setShowMore] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = useMemo(() => {
    return (
      name !== initial.name ||
      JSON.stringify(photos) !== JSON.stringify(initial.photos) ||
      howWeMet !== initial.how_we_met ||
      whereWhen !== initial.where_when ||
      miscNotes !== initial.misc_notes ||
      physical !== initial.physical_description ||
      important !== initial.important_info ||
      known !== initial.known_people_notes ||
      JSON.stringify(circleIds.slice().sort()) !== JSON.stringify(initial.circleIds.slice().sort()) ||
      JSON.stringify(eventIds.slice().sort()) !== JSON.stringify(initial.eventIds.slice().sort())
    );
  }, [name, photos, howWeMet, whereWhen, miscNotes, physical, important, known, circleIds, eventIds, initial]);

  const handleCancel = () => {
    if (dirty) {
      if (!confirm('Discard changes?')) return;
    }
    onClose();
  };

  // Swipe-from-edge to cancel (with the same discard guard).
  const swipe = useSwipeBack(handleCancel);

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    setSaving(true);
    try {
      await updatePerson.mutateAsync({
        id: personId,
        updates: {
          name: name.trim(),
          photos,
          how_we_met: howWeMet || null,
          where_when: whereWhen || null,
          misc_notes: miscNotes || null,
          physical_description: physical || null,
          // A cleared description can't be AI-generated. Persist the flag
          // alongside the text so the profile page knows whether to show
          // the AI badge next to it.
          physical_description_ai_generated: physical ? physicalAi : false,
          important_info: important || null,
          known_people_notes: known || null,
        },
      });
      // Memberships only fire if they changed (saves a round trip).
      if (JSON.stringify(circleIds.slice().sort()) !== JSON.stringify(initial.circleIds.slice().sort())) {
        await setPersonCircles.mutateAsync({ personId, circleIds });
      }
      if (JSON.stringify(eventIds.slice().sort()) !== JSON.stringify(initial.eventIds.slice().sort())) {
        await setPersonEvents.mutateAsync({ personId, eventIds });
      }
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;
    // Hand off to the crop step instead of uploading the raw file.
    setCropSrc(URL.createObjectURL(file));
    setPhotoMenuOpen(false);
  };

  const handleCropped = async (file: File) => {
    const src = cropSrc;
    setCropSrc(null);
    if (src) URL.revokeObjectURL(src);
    try {
      const url = await uploadPhoto.mutateAsync(file);
      setPhotos((cur) => [...cur, url].slice(0, 5));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not upload photo');
    }
  };

  const cancelCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleRemovePhoto = () => {
    setPhotos([]);
    setPhotoMenuOpen(false);
  };

  const handleGenerateDescription = async () => {
    const photo = photos[0];
    if (!photo) {
      toast.error('Add a photo first');
      return;
    }
    setGeneratingDesc(true);
    try {
      const { getPhotoUrl } = await import('@/lib/store');
      const photoUrl = await getPhotoUrl(photo);
      const { data, error } = await supabase.functions.invoke('describe-from-photo', { body: { photoUrl } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const description = data?.description || '';
      if (description) {
        setPhysical(description);
        setPhysicalAi(true);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate description';
      toast.error(msg);
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await deletePersonMut.mutateAsync(personId);
      setDeleteConfirmOpen(false);
      onClose({ deleted: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not remove this person';
      toast.error(msg);
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading || !person) {
    return <PersonEditSkeleton />;
  }

  return (
    <div
      className="flex flex-col min-h-screen safe-top"
      style={{
        transform: swipe.offsetX > 0 ? `translateX(${swipe.offsetX}px)` : undefined,
        transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
      }}
      {...swipe.bind}
    >
      {/* Nav bar */}
      <div
        className="sticky z-20 bg-background flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)]"
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <button onClick={handleCancel} className="h-10 px-2 -ml-1 text-[15px] text-muted-text">
          Cancel
        </button>
        <h1 className="font-sans text-[17px] font-semibold text-foreground">Edit</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-2 -mr-1 text-[15px] font-semibold text-primary disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </button>
      </div>

      {/* Scroll form */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="flex justify-center pt-4 pb-2">
          <div className="relative">
            <PersonAvatar name={name || 'New'} photo={photos[0]} size="lg" className="!w-24 !h-24 !text-2xl" />
            <button
              onClick={() => {
                // With no photo there's nothing to remove, so the menu
                // would just be a pointless one-item list — go straight
                // to the native picker (Photo Library / Take Photo /
                // Choose File). Only show the menu when there's an
                // existing photo to offer a Remove option.
                if (photos.length === 0) {
                  fileRef.current?.click();
                } else {
                  setPhotoMenuOpen((v) => !v);
                }
              }}
              aria-label="Change photo"
              className="absolute -bottom-0.5 -right-0.5 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
              style={{ boxShadow: '0 4px 12px hsl(var(--primary) / 0.35)' }}
            >
              <Camera className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
            {photoMenuOpen && photos.length > 0 && (
              <div className="absolute z-10 right-0 top-full mt-1 w-44 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] py-1 shadow-xl">
                <button
                  onClick={() => {
                    setPhotoMenuOpen(false);
                    fileRef.current?.click();
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-[hsl(0_0%_100%/0.04)]"
                >
                  Change photo
                </button>
                <button
                  onClick={handleRemovePhoto}
                  className="w-full text-left px-3 py-2.5 text-sm text-destructive hover:bg-[hsl(0_0%_100%/0.04)]"
                >
                  Remove Photo
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 mt-5 space-y-6">
          <Field label="Name" required error={nameError}>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
              placeholder="Their name"
              className={fieldInputClass}
              autoFocus
            />
          </Field>

          <Field label="How we met">
            <textarea
              value={howWeMet}
              onChange={(e) => setHowWeMet(e.target.value)}
              placeholder="How did you meet? The more detail, the better your briefs…"
              rows={2}
              className={cn(fieldInputClass, 'h-auto py-2.5 resize-none')}
            />
          </Field>

          <Field label="Where we met">
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-text" strokeWidth={1.75} />
              <input
                value={whereWhen}
                onChange={(e) => setWhereWhen(e.target.value)}
                placeholder="Tribeca Rooftop, NYC"
                className={cn(fieldInputClass, 'pl-9')}
              />
            </div>
          </Field>

          <Field label="About">
            <BulletTextarea
              value={miscNotes}
              onChange={setMiscNotes}
              placeholder="What should you remember about them?"
              rows={4}
            />
          </Field>

          <Field label="Circles">
            {circles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {circles.map((c) => {
                  const on = circleIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() =>
                        setCircleIds((cur) => (on ? cur.filter((id) => id !== c.id) : [...cur, c.id]))
                      }
                      className={cn(
                        'inline-flex items-center px-2.5 py-1 rounded-sm text-[12px] font-medium border transition-colors',
                        on
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-surface-2 text-muted-text border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)]',
                      )}
                    >
                      {c.emoji ? `${c.emoji} ` : ''}{c.name}
                      {on && <X className="w-3 h-3 ml-1" strokeWidth={1.75} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-muted-text italic">No Circles yet. Create one in the Circles tab.</p>
            )}
          </Field>

          <Field label="Events">
            {events.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {events.map((e) => {
                  const on = eventIds.includes(e.id);
                  const tone = isValidTone(e.tone) ? e.tone : 'red';
                  return (
                    <button
                      key={e.id}
                      onClick={() =>
                        setEventIds((cur) => (on ? cur.filter((id) => id !== e.id) : [...cur, e.id]))
                      }
                      className={cn(
                        'inline-flex items-center px-2.5 py-1 rounded-sm text-[12px] font-medium border transition-all',
                        on
                          ? `tile-${tone} text-white border-transparent`
                          : 'bg-surface-2 text-muted-text border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)]',
                      )}
                    >
                      {e.name}
                      {on && <X className="w-3 h-3 ml-1" strokeWidth={1.75} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-muted-text italic">No Events yet. Create one in the Circles tab.</p>
            )}
          </Field>

          {/* More details collapsible — preserved fields outside the spec's PEOPLE-02 minimal set */}
          <div>
            <button
              onClick={() => setShowMore((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text"
            >
              More details
              {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showMore && (
              <div className="mt-3 space-y-6 animate-fade-in">
                <Field
                  label="Physical description"
                  right={
                    photos[0] && (
                      <div className="flex items-center gap-2">
                        {physicalAi && <AIBadge feature="description" />}
                        <button
                          onClick={handleGenerateDescription}
                          disabled={generatingDesc}
                          className="flex items-center gap-1 px-2 py-1 rounded-sm bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                        >
                          {generatingDesc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          {generatingDesc ? 'Generating…' : 'From photo'}
                        </button>
                      </div>
                    )
                  }
                >
                  <textarea
                    value={physical}
                    onChange={(e) => {
                      setPhysical(e.target.value);
                      // Manual edit overrides AI authorship — drop the flag
                      // so the profile page won't claim Membr wrote this.
                      if (physicalAi) setPhysicalAi(false);
                    }}
                    placeholder="Tall, dark beard, wears glasses…"
                    rows={3}
                    className={cn(fieldInputClass, 'h-auto py-2.5 resize-none')}
                  />
                </Field>

                <Field label="Background">
                  <BulletTextarea
                    value={important}
                    onChange={setImportant}
                    placeholder="Work, school, or anything you should know about them…"
                    rows={3}
                  />
                </Field>

                <Field label="Who they know">
                  <textarea
                    value={known}
                    onChange={(e) => setKnown(e.target.value)}
                    placeholder="They know Sarah from yoga, Mike's cousin…"
                    rows={3}
                    className={cn(fieldInputClass, 'h-auto py-2.5 resize-none')}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* iPhone Contact link */}
          <Field label="iPhone Contact">
            <ContactLinkSection
              personId={personId}
              person={person}
              iosContactId={person.ios_contact_id ?? null}
            />
          </Field>

          {/* Delete person */}
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className="w-full h-11 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-destructive hover:border-destructive/40 transition-colors inline-flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" strokeWidth={1.75} />}
            {deleting ? 'Removing…' : 'Remove from Membr'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Remove from Membr?"
        description={`This deletes ${person.name || 'this person'} along with their encounters, circle memberships, and connections. This cannot be undone.`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        destructive
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      {cropSrc && (
        <PhotoCropModal imageSrc={cropSrc} onCancel={cancelCrop} onCropped={handleCropped} />
      )}

      {/* Save bar pinned at bottom */}
      <div className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md px-5 pt-3 pb-5 bg-background border-t border-[hsl(0_0%_100%/0.08)] safe-bottom">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="w-full h-[52px] rounded-md bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-40 active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {dirty ? 'Save changes' : 'No changes'}
        </button>
      </div>
    </div>
  );
}

function PersonEditSkeleton() {
  return (
    <div className="flex flex-col min-h-screen safe-top animate-fade-in">
      <div
        className="sticky z-20 bg-background flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)]"
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <Skeleton className="h-4 w-14 bg-[hsl(0_0%_100%/0.04)]" />
        <Skeleton className="h-4 w-10 bg-[hsl(0_0%_100%/0.06)]" />
        <Skeleton className="h-4 w-10 bg-[hsl(0_0%_100%/0.04)]" />
      </div>
      <div className="flex justify-center pt-4 pb-2">
        <Skeleton className="w-24 h-24 rounded-full bg-[hsl(0_0%_100%/0.06)]" />
      </div>
      <div className="px-5 mt-5 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20 bg-[hsl(0_0%_100%/0.04)]" />
            <Skeleton className="h-11 w-full rounded-md bg-[hsl(0_0%_100%/0.05)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

const fieldInputClass =
  'w-full h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-base text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors';

function Field({
  label,
  required,
  error,
  right,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">
          {label}
          {required && <span className="text-primary ml-1">*</span>}
        </span>
        {right}
      </div>
      {children}
      {error && <p className="mt-1 text-[12px] text-primary">{error}</p>}
    </div>
  );
}
