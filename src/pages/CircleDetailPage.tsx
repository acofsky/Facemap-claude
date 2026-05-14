import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Pencil, Plus, UserMinus, ChevronRight } from 'lucide-react';
import {
  useCircles, usePersons, usePersonCircles, useAddPersonToCircle, useRemovePersonFromCircle,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { CircleSheet } from '@/components/CircleSheet';
import { PersonPickerSheet } from '@/components/PersonPickerSheet';
import { isValidTone, type Tone } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useSwipeBack } from '@/hooks/use-swipe-back';

interface CircleDetailPageProps {
  circleId: string;
  onBack: () => void;
  onSelectPerson: (id: string) => void;
}

function fallbackTone(id: string): Tone {
  const TONES = ['red', 'blue', 'purple', 'green', 'amber', 'slate', 'rose', 'teal'] as const;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

export function CircleDetailPage({ circleId, onBack, onSelectPerson }: CircleDetailPageProps) {
  const { data: circles = [] } = useCircles();
  const { data: people = [] } = usePersons();
  const { data: personCircles = [] } = usePersonCircles();
  const addToCircle = useAddPersonToCircle();
  const removeFromCircle = useRemovePersonFromCircle();

  const [editOpen, setEditOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const swipe = useSwipeBack(onBack, { disabled: editOpen || pickerOpen });

  const circle = circles.find((c) => c.id === circleId);
  const tone = circle ? (isValidTone(circle.tone) ? circle.tone : fallbackTone(circle.id)) : 'red';

  const memberIds = useMemo(
    () => personCircles.filter((pc) => pc.circle_id === circleId).map((pc) => pc.person_id),
    [personCircles, circleId],
  );
  const members = useMemo(() => people.filter((p) => memberIds.includes(p.id)), [people, memberIds]);

  if (!circle) {
    return (
      <div className="px-5 pt-20 text-center safe-top">
        <p className="text-sm text-muted-text">Circle not found.</p>
        <button onClick={onBack} className="mt-4 text-primary text-sm font-semibold">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div
      className="pb-10 animate-fade-in safe-top"
      style={{
        transform: swipe.offsetX > 0 ? `translateX(${swipe.offsetX}px)` : undefined,
        transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
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
