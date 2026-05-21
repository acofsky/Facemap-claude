import { useMemo, useState } from 'react';
import { usePersons, useCreateMeeting } from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Search, ArrowLeft, Loader2, Check, CalendarDays, MapPin, NotebookPen, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/hooks/use-scroll-lock';

interface LogEncounterModalProps {
  open: boolean;
  onClose: () => void;
}

export function LogEncounterModal({ open, onClose }: LogEncounterModalProps) {
  // Lock background scroll while the modal is mounted (see useScrollLock).
  useScrollLock(open);
  const { data: people = [] } = usePersons();
  const createMeeting = useCreateMeeting();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string; photo?: string } | null>(null);
  const [meetingDate, setMeetingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [place, setPlace] = useState('');
  const [notes, setNotes] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
    return list.slice(0, 30);
  }, [query, people]);

  const reset = () => {
    setQuery('');
    setSelected(null);
    setMeetingDate(format(new Date(), 'yyyy-MM-dd'));
    setPlace('');
    setNotes('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      await createMeeting.mutateAsync({
        person_id: selected.id,
        meeting_date: meetingDate,
        place: place.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`Logged encounter with ${selected.name}`);
      handleClose();
    } catch (err: any) {
      toast.error(err.message || 'Could not save encounter');
    }
  };

  if (!open) return null;

  const inputClass =
    'glass-input w-full h-11 px-3.5 text-sm';

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 animate-fade-in"
        onClick={handleClose}
      />
      <div
        className="kb-aware-sheet fixed left-0 right-0 mx-auto w-full max-w-md glass-sheet rounded-t-2xl p-5 z-[60] safe-bottom animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {!selected ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-md tile-red flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-white" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-xl text-foreground leading-tight tracking-[-0.02em]">Log encounter</h3>
                <p className="text-[12px] text-muted-text">Pick someone you ran into</p>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close"
                className="w-9 h-9 -mr-1 rounded-md flex items-center justify-center hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" strokeWidth={1.75} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name…"
                className={cn(inputClass, 'pl-10')}
              />
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {matches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected({ id: p.id, name: p.name, photo: p.photos[0] })}
                  className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-[hsl(0_0%_100%/0.04)] transition-colors"
                >
                  <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                  <span className="text-sm text-foreground flex-1 text-left truncate font-medium">{p.name}</span>
                </button>
              ))}
              {matches.length === 0 && (
                <p className="text-[12px] text-muted-text italic text-center py-6">
                  {query.trim() ? `No one matches "${query}"` : 'No people yet'}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setSelected(null)}
                aria-label="Back to picker"
                className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-[hsl(0_0%_100%/0.04)] text-muted-text"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <PersonAvatar name={selected.name} photo={selected.photo} size="sm" />
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-xl text-foreground leading-tight truncate tracking-[-0.02em]">
                  {selected.name}
                </h3>
                <p className="text-[12px] text-muted-text">New encounter</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-1.5">
                  <CalendarDays className="w-3 h-3" strokeWidth={1.75} /> Date
                </span>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  /* min-w-0 + appearance-none lets iOS Safari shrink the
                     date input to fit the container; without them it sticks
                     at the intrinsic content width of "MM/DD/YYYY" and
                     overflows. */
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
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What did you talk about?"
                  rows={3}
                  className={cn(inputClass, 'h-auto py-2.5 resize-none')}
                />
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleClose}
                className="flex-1 h-[52px] rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-sm font-medium text-foreground hover:border-[hsl(0_0%_100%/0.18)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createMeeting.isPending}
                className="flex-1 h-[52px] rounded-md bg-primary text-primary-foreground text-[15px] font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
              >
                {createMeeting.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={1.75} />}
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
