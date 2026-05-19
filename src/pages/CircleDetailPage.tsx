import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Plus, UserMinus, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import {
  useCircles, usePersons, usePersonCircles, useAddPersonToCircle, useRemovePersonFromCircle,
  useDeleteCircle,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { CircleSheet } from '@/components/CircleSheet';
import { PersonPickerSheet } from '@/components/PersonPickerSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PersonRowSkeleton } from '@/components/skeletons';
import { isValidTone, TONES, type Tone } from '@/lib/store';
import { cn } from '@/lib/utils';
import { friendlyError } from '@/lib/errors';
import { useSwipeBack } from '@/hooks/use-swipe-back';

interface CircleDetailPageProps {
  circleId: string;
  onBack: () => void;
  onSelectPerson: (id: string) => void;
}

function fallbackTone(id: string): Tone {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

export function CircleDetailPage({ circleId, onBack, onSelectPerson }: CircleDetailPageProps) {
  const { data: circles = [], isLoading: circlesLoading } = useCircles();
  const { data: people = [] } = usePersons();
  const { data: personCircles = [] } = usePersonCircles();
  const addToCircle = useAddPersonToCircle();
  const removeFromCircle = useRemovePersonFromCircle();
  const deleteCircleMut = useDeleteCircle();

  const [editOpen, setEditOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const swipe = useSwipeBack(onBack, {
    disabled: editOpen || pickerOpen || deleteConfirmOpen,
  });

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await deleteCircleMut.mutateAsync(circleId);
      setDeleteConfirmOpen(false);
      onBack();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not delete this Circle. Try again.'));
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const circle = circles.find((c) => c.id === circleId);
  const tone = circle ? (isValidTone(circle.tone) ? circle.tone : fallbackTone(circle.id)) : 'red';

  const memberIds = useMemo(
    () => personCircles.filter((pc) => pc.circle_id === circleId).map((pc) => pc.person_id),
    [personCircles, circleId],
  );
  const members = useMemo(() => people.filter((p) => memberIds.includes(p.id)), [people, memberIds]);

  // If the circle is missing AFTER load completes, it was just deleted —
  // bounce back to Circles instead of flashing the not-found page.
  useEffect(() => {
    if (!circlesLoading && !circle) onBack();
  }, [circlesLoading, circle, onBack]);

  if (circlesLoading) {
    return <CircleDetailSkeleton />;
  }

  if (!circle) {
    return null;
  }

  return (
    <div
      className="pb-10 animate-fade-in safe-top"
      style={{
        transform: swipe.offsetX > 0 ? `translateX(${swipe.offsetX}px)` : undefined,
        transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
        touchAction: 'pan-y',
      }}
      {...swipe.bind}
    >
      {/* Nav bar — sticky just below the notch cover */}
      <div
        className="sticky z-20 bg-background flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)]"
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <h1 className="font-sans text-[17px] font-semibold text-foreground truncate px-2">
          {circle.emoji ? `${circle.emoji} ` : ''}{circle.name}
        </h1>
        <button onClick={() => setEditOpen(true)} aria-label="Edit Circle" className="w-10 h-10 -mr-1 flex items-center justify-center text-foreground active:scale-95 transition-transform">
          <Pencil className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Hero tile */}
      <div className="px-5 mt-2 mb-6">
        <div className={cn('rounded-xl px-4 pb-4 pt-12 flex flex-col justify-end', `tile-${tone}`)}>
          <div className="text-[15px] font-semibold text-white truncate">
            {circle.emoji ? `${circle.emoji} ` : ''}{circle.name}
          </div>
          <div className="text-[12px] text-white/70">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </div>
        </div>
      </div>

      {/* Members list */}
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">Members</h2>
        <button
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-primary"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Add
        </button>
      </div>

      <div className="px-5 space-y-2">
        {members.length === 0 ? (
          <p className="text-[13px] text-muted-text italic">No members yet. Tap Add to bring people in.</p>
        ) : (
          members.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3.5 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] overflow-hidden"
            >
              <button
                onClick={() => onSelectPerson(p.id)}
                className="flex-1 min-w-0 flex items-center gap-3 text-left"
              >
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
                onClick={() => removeFromCircle.mutate({ personId: p.id, circleId: circle.id })}
                aria-label={`Remove ${p.name}`}
                className="p-2 rounded-md text-muted-text hover:text-destructive transition-colors"
              >
                <UserMinus className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Delete Circle — visible without entering edit */}
      <div className="px-5 mt-8">
        <button
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={deleting}
          className="w-full h-11 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-destructive hover:border-destructive/40 transition-colors inline-flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" strokeWidth={1.75} />}
          {deleting ? 'Deleting…' : 'Delete Circle'}
        </button>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete this Circle?"
        description="People stay in Membr — only the Circle itself is removed."
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <AnimatePresence>
        {editOpen && (
          <CircleSheet
            circle={circle}
            onClose={(result) => {
              setEditOpen(false);
              if (result && 'deleted' in result) onBack();
            }}
          />
        )}
        {pickerOpen && (
          <PersonPickerSheet
            title="Add to Circle"
            subtitle={circle.name}
            excludePersonIds={memberIds}
            onPick={(personId) => addToCircle.mutate({ personId, circleId: circle.id })}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CircleDetailSkeleton() {
  return (
    <div className="pb-10 safe-top animate-fade-in">
      <div
        className="sticky z-20 bg-background flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)]"
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <div className="w-10 h-10" />
        <Skeleton className="h-4 w-32 bg-[hsl(0_0%_100%/0.06)]" />
        <div className="w-10 h-10" />
      </div>
      <div className="px-5 mt-2 mb-6">
        <Skeleton className="aspect-[3/2] rounded-xl bg-[hsl(0_0%_100%/0.06)]" />
      </div>
      <div className="flex items-center justify-between px-5 mb-3">
        <Skeleton className="h-3 w-16 bg-[hsl(0_0%_100%/0.04)]" />
      </div>
      <div className="px-5 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <PersonRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
