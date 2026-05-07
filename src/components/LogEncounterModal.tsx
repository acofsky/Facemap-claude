import { useMemo, useState } from 'react';
import { usePersons, useCreateMeeting } from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Search, ArrowLeft, Loader2, Check, CalendarDays, MapPin, NotebookPen, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface LogEncounterModalProps {
  open: boolean;
  onClose: () => void;
}

export function LogEncounterModal({ open, onClose }: LogEncounterModalProps) {
  const { data: people = [] } = usePersons();
  const createMeeting = useCreateMeeting();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string; photo?: string } | null>(null);
  const [meetingDate, setMeetingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [place, setPlace] = useState('');
  const [notes, setNotes] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? people.filter(p => p.name.toLowerCase().includes(q)) : people;
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

  const inputClass = "w-full px-3 py-2.5 rounded-input bg-card border border-border text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-20 px-4 animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md p-5 animate-scale-in bg-secondary border border-border rounded-modal"
        style={{ boxShadow: '0 4px 40px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        {!selected ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-tile icon-tile-red !w-9 !h-9 flex-shrink-0">
                  <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground leading-tight">Log encounter</p>
                  <h3 className="font-display text-foreground leading-tight" style={{ fontSize: '20px' }}>Pick someone</h3>
                </div>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-10 pr-3 py-2.5 rounded-input bg-card border border-border text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
              />
            </div>
            <div className="space-y-px max-h-80 overflow-y-auto">
              {matches.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelected({ id: p.id, name: p.name, photo: p.photos[0] })}
                  className="w-full flex items-center gap-3 py-2.5 px-2 rounded-button-sm hover:bg-foreground/[0.04] transition-colors"
                >
                  <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                  <span className="text-[15px] text-foreground flex-1 text-left truncate font-medium">{p.name}</span>
                </button>
              ))}
              {matches.length === 0 && (
                <p className="text-[13px] text-muted-foreground italic text-center py-6">
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
                aria-label="Back"
                className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              </button>
              <PersonAvatar name={selected.name} photo={selected.photo} size="sm" />
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-foreground leading-tight truncate" style={{ fontSize: '20px' }}>{selected.name}</h3>
                <p className="text-[12px] text-muted-foreground">New encounter</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground mb-1.5">
                  <CalendarDays className="w-3 h-3" strokeWidth={1.75} /> Date
                </span>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={e => setMeetingDate(e.target.value)}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground mb-1.5">
                  <MapPin className="w-3 h-3" strokeWidth={1.75} /> Place <span className="font-normal text-muted-foreground/60">(optional)</span>
                </span>
                <input
                  value={place}
                  onChange={e => setPlace(e.target.value)}
                  placeholder="Coffee shop, gym..."
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground mb-1.5">
                  <NotebookPen className="w-3 h-3" strokeWidth={1.75} /> Notes <span className="font-normal text-muted-foreground/60">(optional)</span>
                </span>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="What did you talk about?"
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-button bg-card border border-border text-[14px] font-medium text-foreground hover:border-foreground/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createMeeting.isPending}
                className="flex-1 py-2.5 rounded-button bg-primary text-primary-foreground text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createMeeting.isPending ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} /> : <Check className="w-4 h-4" strokeWidth={2} />}
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
