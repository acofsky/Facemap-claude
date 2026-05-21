import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Trash2 } from 'lucide-react';
import { DragHandle } from '@/components/DragHandle';
import { haptics } from '@/lib/haptics';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import { toast } from 'sonner';
import { ColorPicker } from '@/components/ColorPicker';
import { useCreateCircle, useUpdateCircle, useDeleteCircle } from '@/hooks/use-data';
import { isValidTone, type Circle, type Tone } from '@/lib/store';
import { cn } from '@/lib/utils';

interface CircleSheetProps {
  /** Existing circle to edit. Omit for create. */
  circle?: Circle;
  /** Called after a successful save or delete so the parent can navigate. */
  onClose: (result?: { id: string } | { deleted: true }) => void;
}

export function CircleSheet({ circle, onClose }: CircleSheetProps) {
  useScrollLock();
  const isEdit = !!circle;
  const [name, setName] = useState(circle?.name ?? '');
  const [emoji, setEmoji] = useState(circle?.emoji ?? '📌');
  const [tone, setTone] = useState<Tone>(isValidTone(circle?.tone) ? circle!.tone : 'red');

  const createCircle = useCreateCircle();
  const updateCircle = useUpdateCircle();
  const deleteCircle = useDeleteCircle();

  const saving = createCircle.isPending || updateCircle.isPending;
  const canSave = name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      if (isEdit && circle) {
        await updateCircle.mutateAsync({
          id: circle.id,
          updates: { name: name.trim(), emoji, tone },
        });
        onClose({ id: circle.id });
      } else {
        const created = await createCircle.mutateAsync({
          name: name.trim(),
          emoji,
          color: 'hsl(0, 75%, 53%)',
          tone,
        });
        onClose({ id: created.id });
      }
    } catch (e: any) {
      toast.error(e.message || 'Could not save circle');
    }
  };

  const handleDelete = async () => {
    if (!circle) return;
    if (!confirm('Delete this Circle? People will not be removed from Membr.')) return;
    await deleteCircle.mutateAsync(circle.id);
    onClose({ deleted: true });
  };

  const inputClass =
    'glass-input w-full h-11 px-3.5 text-base';

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={() => onClose()}
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
        className="kb-aware-sheet fixed left-0 right-0 mx-auto w-full max-w-md glass-sheet rounded-t-2xl z-[60] flex flex-col safe-bottom"
      >
        <DragHandle />
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className="font-display text-xl text-foreground tracking-[-0.02em]">
            {isEdit ? 'Edit Circle' : 'New Circle'}
          </h2>
          <button onClick={() => onClose()} aria-label="Close" className="p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden flex-1 px-5 pb-5 space-y-4">
          <div className="flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-12 h-11 px-2 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-center text-lg focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
              maxLength={2}
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Internship, Dorm Floor, Book Club…"
              className={cn(inputClass, 'flex-1')}
              autoFocus={!isEdit}
              maxLength={80}
            />
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-2 block">Color</span>
            <ColorPicker value={tone} onChange={setTone} />
          </div>

          {isEdit && (
            <button
              onClick={handleDelete}
              className="w-full h-10 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-destructive hover:border-destructive/40 transition-colors inline-flex items-center justify-center gap-1.5 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              Delete Circle
            </button>
          )}
        </div>

        <div className="px-5 pt-3 pb-5 border-t border-[hsl(0_0%_100%/0.08)]">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] shadow-[0_8px_24px_rgba(224,48,48,0.35)] disabled:opacity-40 active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create Circle'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
