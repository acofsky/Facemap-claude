import { useState } from 'react';
import { format } from 'date-fns';
import { MapPin, Plus, Trash2, X, Check } from 'lucide-react';
import { useMeetings, useCreateMeeting, useDeleteMeeting } from '@/hooks/use-data';
import { BulletTextarea, BulletDisplay } from '@/components/BulletTextarea';
import { cn } from '@/lib/utils';

interface MeetingsSectionProps {
  personId: string;
}

export function MeetingsSection({ personId }: MeetingsSectionProps) {
  const { data: meetings = [] } = useMeetings(personId);
  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [place, setPlace] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setAdding(false);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setPlace('');
    setNotes('');
  };

  const handleSave = async () => {
    if (!date) return;
    await createMeeting.mutateAsync({
      person_id: personId,
      meeting_date: date,
      place: place || undefined,
      notes: notes || undefined,
    });
    reset();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this encounter?')) deleteMeeting.mutate(id);
  };

  const inputClass =
    'glass-input w-full h-11 px-3.5 text-sm';

  return (
    <div>
      {adding && (
        <div className="glass p-4 mb-3 space-y-2 animate-fade-in">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Place (optional)"
            className={inputClass}
          />
          <BulletTextarea
            value={notes}
            onChange={setNotes}
            placeholder="What did you talk about?"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={createMeeting.isPending}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              <Check className="w-3 h-3" strokeWidth={1.75} /> {createMeeting.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-muted-text text-xs font-medium"
            >
              <X className="w-3 h-3" strokeWidth={1.75} /> Cancel
            </button>
          </div>
        </div>
      )}

      {meetings.length === 0 && !adding && (
        <p className="text-[13px] text-muted-text italic mb-3">No encounters logged yet.</p>
      )}

      <div className="space-y-2">
        {meetings.map((m) => (
          <div key={m.id} className="glass p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[12px] text-muted-text mb-1">
                  <span className="font-medium text-foreground">{format(new Date(m.meeting_date), 'MMM d, yyyy')}</span>
                  {m.place && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3" strokeWidth={1.75} />
                        {m.place}
                      </span>
                    </>
                  )}
                </div>
                {m.notes && <BulletDisplay value={m.notes} className="mt-1" />}
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                aria-label="Delete encounter"
                className="p-1 rounded-md text-muted-text hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setAdding((v) => !v)}
        className={cn(
          'mt-3 inline-flex items-center gap-1 text-[13px] font-semibold',
          adding ? 'text-muted-text' : 'text-primary',
        )}
      >
        {adding ? (
          <>
            <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Cancel
          </>
        ) : (
          <>
            <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Log new encounter
          </>
        )}
      </button>
    </div>
  );
}
