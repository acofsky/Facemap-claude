import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { MapPin, Plus, Trash2, Users } from 'lucide-react';
import { useMeetings, useDeleteMeeting, usePersons } from '@/hooks/use-data';
import { BulletDisplay } from '@/components/BulletTextarea';
import { EncounterSheet } from '@/components/EncounterSheet';
import type { MeetingWithParticipants } from '@/lib/store';

interface MeetingsSectionProps {
  personId: string;
}

export function MeetingsSection({ personId }: MeetingsSectionProps) {
  const { data: meetings = [] } = useMeetings(personId);
  const { data: people = [] } = usePersons();
  const deleteMeeting = useDeleteMeeting();

  // null = closed; otherwise add (no meeting) or edit (a meeting).
  const [sheet, setSheet] = useState<{ meeting: MeetingWithParticipants | null } | null>(null);

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  // Everyone on an encounter except the profile we're viewing — so the card
  // reads "with X, Y" regardless of whether this person owns it or was tagged.
  const othersFor = (m: MeetingWithParticipants): string[] => {
    const names: string[] = [];
    const seen = new Set<string>();
    const pushPerson = (id: string) => {
      if (id === personId || seen.has(id)) return;
      seen.add(id);
      names.push(peopleById.get(id)?.name ?? 'Someone');
    };
    if (m.person_id) pushPerson(m.person_id);
    for (const p of m.participants ?? []) {
      if (p.person_id) pushPerson(p.person_id);
      else if (p.external_name) names.push(p.external_name);
    }
    return names;
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this encounter?')) deleteMeeting.mutate(id);
  };

  return (
    <div>
      {meetings.length === 0 && (
        <p className="text-[13px] font-display-italic text-[hsl(var(--foreground)/0.65)] mb-3">
          No encounters logged yet.
        </p>
      )}

      <div className="space-y-2">
        {meetings.map((m) => {
          const others = othersFor(m);
          return (
            <button
              key={m.id}
              onClick={() => setSheet({ meeting: m })}
              className="w-full text-left glass p-3.5 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[12px] text-muted-text mb-1">
                    <span className="font-medium text-foreground">
                      {format(new Date(m.meeting_date), 'MMM d, yyyy')}
                    </span>
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
                  {others.length > 0 && (
                    <div className="flex items-center gap-1 text-[12px] text-[hsl(var(--foreground)/0.7)] mb-1">
                      <Users className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">with {others.join(', ')}</span>
                    </div>
                  )}
                  {m.notes && <BulletDisplay value={m.notes} className="mt-1" />}
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleDelete(e, m.id)}
                  aria-label="Delete encounter"
                  className="p-1 rounded-md text-muted-text hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setSheet({ meeting: null })}
        className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Log new encounter
      </button>

      {sheet && (
        <EncounterSheet
          // New encounters are owned by this profile; when editing, keep the
          // encounter's original owner so a mirrored, tagged-in encounter
          // doesn't get its ownership rewritten.
          ownerPersonId={sheet.meeting ? sheet.meeting.person_id : personId}
          viewerPersonId={personId}
          meeting={sheet.meeting}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
