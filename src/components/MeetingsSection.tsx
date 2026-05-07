import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, MapPin, Plus, Trash2, X, Check } from 'lucide-react';
import { useMeetings, useCreateMeeting, useDeleteMeeting } from '@/hooks/use-data';
import { BulletTextarea, BulletDisplay } from '@/components/BulletTextarea';

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
    if (confirm('Delete this meeting?')) deleteMeeting.mutate(id);
  };

  const inputClass = "w-full px-3 py-2 rounded-input bg-secondary border border-border text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
          <h3 className="text-[13px] font-medium text-muted-foreground">Meetings {meetings.length > 0 && `· ${meetings.length}`}</h3>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          aria-label={adding ? 'Cancel' : 'Add meeting'}
          className="p-1.5 rounded-button-sm bg-secondary border border-border text-foreground hover:border-foreground/20"
        >
          {adding ? <X className="w-3.5 h-3.5" strokeWidth={1.75} /> : <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />}
        </button>
      </div>

      {adding && (
        <div className="surface-card p-4 mb-3 space-y-2 animate-fade-in">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
          <input value={place} onChange={e => setPlace(e.target.value)} placeholder="Place (optional)" className={inputClass} />
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
              className="flex items-center gap-1 px-3 py-1.5 rounded-button-sm bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50"
            >
              <Check className="w-3 h-3" strokeWidth={2} /> {createMeeting.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-1 px-3 py-1.5 rounded-button-sm bg-secondary border border-border text-muted-foreground text-[12px] font-medium"
            >
              <X className="w-3 h-3" strokeWidth={1.75} /> Cancel
            </button>
          </div>
        </div>
      )}

      {meetings.length === 0 && !adding && (
        <p className="text-[12px] text-muted-foreground italic">No meetings logged yet. Tap + to add one.</p>
      )}

      <div className="space-y-2">
        {meetings.map(m => (
          <div key={m.id} className="surface-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{format(new Date(m.meeting_date), 'MMM d, yyyy')}</span>
                  {m.place && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" strokeWidth={1.75} />{m.place}</span>
                    </>
                  )}
                </div>
                {m.notes && <BulletDisplay value={m.notes} className="mt-1" />}
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                aria-label="Delete meeting"
                className="p-1 rounded-button-sm text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
