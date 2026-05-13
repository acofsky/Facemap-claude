import { useState, useMemo } from 'react';
import {
  useCircles, usePersons, usePersonCircles,
  useCreateCircle, useUpdateCircle, useDeleteCircle,
  useAddPersonToCircle, useRemovePersonFromCircle,
  useEvents, usePersonEvents, useArchiveEvent,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { ColorPicker } from '@/components/ColorPicker';
import { EventSheet } from '@/components/EventSheet';
import {
  Plus, X, Loader2, Trash2, Pencil, Check, UserPlus, UserMinus, ChevronDown, Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONES, isValidTone, type Event as MembrEvent, type Tone } from '@/lib/store';

interface CirclesPageProps {
  onSelectPerson: (id: string) => void;
}

function circleTone(c: { id: string; tone?: string | null }): Tone {
  if (isValidTone(c.tone)) return c.tone;
  // Deterministic fallback for circles created before the tone column existed.
  let hash = 0;
  for (let i = 0; i < c.id.length; i++) hash = (hash * 31 + c.id.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

const CIRCLE_SUGGESTIONS = [
  { emoji: '🎓', name: 'School' },
  { emoji: '🏫', name: 'Childhood' },
  { emoji: '💼', name: 'Work' },
  { emoji: '🏋️', name: 'Gym' },
  { emoji: '🎲', name: 'Randoms' },
];

export function CirclesPage({ onSelectPerson }: CirclesPageProps) {
  const { data: circles = [], isLoading } = useCircles();
  const { data: people = [] } = usePersons();
  const { data: personCircles = [] } = usePersonCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });
  const { data: archivedEvents = [] } = useEvents({ includeArchived: true });
  const { data: personEvents = [] } = usePersonEvents();
  const archiveEvt = useArchiveEvent();

  const createCircle = useCreateCircle();
  const updateCircle = useUpdateCircle();
  const deleteCircle = useDeleteCircle();
  const addToCircle = useAddPersonToCircle();
  const removeFromCircle = useRemovePersonFromCircle();

  // Inline "add" action — either creates a Circle or opens the Event sheet
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [creatingCircle, setCreatingCircle] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('📌');
  const [newTone, setNewTone] = useState<Tone>('red');
  const [eventSheet, setEventSheet] = useState<{ event?: MembrEvent } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Circle expansion + edit
  const [expandedCircle, setExpandedCircle] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editTone, setEditTone] = useState<Tone>('red');
  const [addingPeopleCircle, setAddingPeopleCircle] = useState<string | null>(null);

  const archivedOnly = useMemo(
    () => archivedEvents.filter((e) => e.archived_at !== null),
    [archivedEvents],
  );

  const circleMemberCount = (id: string) => personCircles.filter((pc) => pc.circle_id === id).length;
  const eventMemberCount = (id: string) => personEvents.filter((pe) => pe.event_id === id).length;

  const handleCreateCircle = async () => {
    if (!newName.trim()) return;
    await createCircle.mutateAsync({ name: newName, emoji: newEmoji, color: 'hsl(0, 75%, 53%)', tone: newTone });
    setNewName('');
    setNewEmoji('📌');
    setNewTone('red');
    setCreatingCircle(false);
  };

  const startEdit = (circle: { id: string; name: string; emoji: string; tone?: string | null }) => {
    setEditingId(circle.id);
    setEditName(circle.name);
    setEditEmoji(circle.emoji);
    setEditTone(circleTone(circle));
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateCircle.mutateAsync({
      id: editingId,
      updates: { name: editName, emoji: editEmoji, tone: editTone },
    });
    setEditingId(null);
  };

  const handleDeleteCircle = async (id: string) => {
    if (!confirm('Delete this Circle? People will not be removed from Membr.')) return;
    await deleteCircle.mutateAsync(id);
    if (expandedCircle === id) setExpandedCircle(null);
  };

  const togglePersonInCircle = async (personId: string, circleId: string, isInCircle: boolean) => {
    if (isInCircle) await removeFromCircle.mutateAsync({ personId, circleId });
    else await addToCircle.mutateAsync({ personId, circleId });
  };

  const handleUnarchive = async (id: string) => {
    await archiveEvt.mutateAsync({ id, archived: false });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const expanded = circles.find((c) => c.id === expandedCircle);

  return (
    <div className="pb-8 animate-fade-in">
      {/* Nav bar */}
      <div className="flex items-center justify-between px-5 pt-3 mb-4">
        <span className="w-9" />
        <h1 className="text-[17px] font-semibold text-foreground">Circles</h1>
        <div className="relative">
          <button
            onClick={() => setAddMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setAddMenuOpen(false), 150)}
            aria-label="Create"
            className="w-9 h-9 -mr-2 flex items-center justify-center text-foreground active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" strokeWidth={1.75} />
          </button>
          {addMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] py-1 z-20 shadow-xl">
              <button
                onClick={() => {
                  setCreatingCircle(true);
                  setAddMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-[hsl(0_0%_100%/0.04)]"
              >
                New Circle
              </button>
              <button
                onClick={() => {
                  setEventSheet({});
                  setAddMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-[hsl(0_0%_100%/0.04)]"
              >
                New Event
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline Circle creation */}
      {creatingCircle && (
        <div className="px-5 mb-5 space-y-3 animate-fade-in">
          <div className="flex gap-2">
            <input
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              className="w-12 h-11 px-2 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-center text-lg focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
              maxLength={2}
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Internship, Dorm Floor, Book Club…"
              className="flex-1 h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-base text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCircle()}
            />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-2 block">Colour</span>
            <ColorPicker value={newTone} onChange={setNewTone} />
          </div>
          <div className={cn('rounded-xl px-4 pb-4 pt-12 flex flex-col justify-end', `tile-${newTone}`)}>
            <div className="text-[15px] font-semibold text-white truncate">
              {newEmoji} {newName.trim() || 'Circle name'}
            </div>
            <div className="text-[11px] text-white/70">0 members</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCreatingCircle(false);
                setNewName('');
                setNewEmoji('📌');
                setNewTone('red');
              }}
              className="flex-1 h-11 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-muted-text text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCircle}
              disabled={!newName.trim()}
              className="flex-1 h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              Create Circle
            </button>
          </div>
        </div>
      )}

      {/* Suggestions in empty state */}
      {circles.length === 0 && !creatingCircle && (
        <div className="px-5 mb-6">
          <p className="text-[13px] text-muted-text mb-2.5">Quick start with a suggestion:</p>
          <div className="flex flex-wrap gap-2">
            {CIRCLE_SUGGESTIONS.map((s) => (
              <button
                key={s.name}
                onClick={() =>
                  createCircle.mutateAsync({ name: s.name, emoji: s.emoji, color: 'hsl(0, 75%, 53%)', tone: 'red' })
                }
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground hover:border-[hsl(0_0%_100%/0.14)] transition-colors"
              >
                <span>{s.emoji}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Circles tier */}
      <SectionLabel>Circles</SectionLabel>
      {circles.length > 0 ? (
        <div className="px-5 grid grid-cols-2 gap-3">
          {circles.map((circle) => (
            <button
              key={circle.id}
              onClick={() => setExpandedCircle(expandedCircle === circle.id ? null : circle.id)}
              className={cn(
                'aspect-[3/2] rounded-xl p-3.5 flex flex-col justify-end text-left transition-transform active:scale-[0.98]',
                `tile-${circleTone(circle)}`,
                expandedCircle === circle.id && 'ring-2 ring-foreground/30',
              )}
            >
              <div className="text-[15px] font-semibold text-white truncate flex items-center gap-1">
                {circle.emoji && <span>{circle.emoji}</span>}
                <span className="truncate">{circle.name}</span>
              </div>
              <div className="text-[12px] text-white/70">
                {circleMemberCount(circle.id)} {circleMemberCount(circle.id) === 1 ? 'member' : 'members'}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-5">
          <p className="text-[13px] text-muted-text italic">No Circles yet. Tap + above to create one.</p>
        </div>
      )}

      {/* Inline circle detail (transitional until CIRCLES-02 lands) */}
      {expanded && (
        <div className="px-5 mt-4 animate-fade-in">
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4">
            {editingId === expanded.id ? (
              <div className="space-y-3 mb-3">
                <div className="flex items-center gap-2">
                  <input
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    className="w-10 h-9 px-1 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-center"
                    maxLength={2}
                  />
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-base text-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  />
                </div>
                <ColorPicker value={editTone} onChange={setEditTone} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="inline-flex items-center gap-1 px-3 h-9 rounded-md bg-primary text-primary-foreground text-xs font-semibold">
                    <Check className="w-3 h-3" strokeWidth={1.75} /> Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 px-3 h-9 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-muted-text text-xs font-medium">
                    <X className="w-3 h-3" strokeWidth={1.75} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl">{expanded.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-foreground truncate">{expanded.name}</div>
                    <div className="text-[12px] text-muted-text">
                      {circleMemberCount(expanded.id)} {circleMemberCount(expanded.id) === 1 ? 'member' : 'members'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(expanded)} aria-label="Edit" className="p-2 rounded-md text-muted-text hover:text-foreground transition-colors">
                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                  <button onClick={() => handleDeleteCircle(expanded.id)} aria-label="Delete" className="p-2 rounded-md text-muted-text hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            )}
            <CircleMemberManager
              circleId={expanded.id}
              addingPeople={addingPeopleCircle === expanded.id}
              setAddingPeople={(open) => setAddingPeopleCircle(open ? expanded.id : null)}
              people={people}
              memberIds={personCircles.filter((pc) => pc.circle_id === expanded.id).map((pc) => pc.person_id)}
              onSelectPerson={onSelectPerson}
              onToggle={togglePersonInCircle}
            />
          </div>
        </div>
      )}

      {/* Section divider */}
      <div className="mx-5 my-6 h-px bg-[hsl(0_0%_100%/0.08)]" />

      {/* Events tier */}
      <SectionLabel>Events</SectionLabel>
      {events.length > 0 ? (
        <div className="px-5 grid grid-cols-2 gap-3">
          {events.map((evt) => (
            <button
              key={evt.id}
              onClick={() => setEventSheet({ event: evt })}
              className={cn(
                'aspect-[3/2] rounded-xl p-3.5 flex flex-col justify-end text-left transition-transform active:scale-[0.98]',
                `tile-${isValidTone(evt.tone) ? evt.tone : 'red'}`,
              )}
            >
              <div className="text-[15px] font-semibold text-white truncate">{evt.name}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[12px] text-white/70">
                  {eventMemberCount(evt.id)} {eventMemberCount(evt.id) === 1 ? 'member' : 'members'}
                </span>
                {(evt.start_date || evt.end_date) && (
                  <span className="text-[11px] text-white/60">{formatRange(evt.start_date, evt.end_date)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-5">
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-5 text-center">
            <button
              onClick={() => setEventSheet({})}
              className="text-[13px] text-primary font-semibold"
            >
              + Log a trip, dinner, or event
            </button>
          </div>
        </div>
      )}

      {/* Archived link */}
      {archivedOnly.length > 0 && (
        <div className="px-5 mt-4">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-text hover:text-foreground transition-colors"
          >
            <Archive className="w-3.5 h-3.5" strokeWidth={1.75} />
            Archived ({archivedOnly.length})
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showArchived && 'rotate-180')} strokeWidth={1.75} />
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2">
              {archivedOnly.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)]"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-foreground truncate">{evt.name}</div>
                    <div className="text-[12px] text-muted-text">
                      {eventMemberCount(evt.id)} {eventMemberCount(evt.id) === 1 ? 'member' : 'members'}
                      {(evt.start_date || evt.end_date) && ` · ${formatRange(evt.start_date, evt.end_date)}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnarchive(evt.id)}
                    className="text-[12px] font-semibold text-primary"
                  >
                    Unarchive
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {eventSheet && (
        <EventSheet event={eventSheet.event} onClose={() => setEventSheet(null)} />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 mb-3">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">{children}</h2>
    </div>
  );
}

function CircleMemberManager({
  addingPeople,
  setAddingPeople,
  people,
  memberIds,
  onSelectPerson,
  onToggle,
  circleId,
}: {
  addingPeople: boolean;
  setAddingPeople: (open: boolean) => void;
  people: ReturnType<typeof usePersons>['data'];
  memberIds: string[];
  onSelectPerson: (id: string) => void;
  onToggle: (personId: string, circleId: string, isInCircle: boolean) => Promise<void> | void;
  circleId: string;
}) {
  const list = people || [];
  const members = list.filter((p) => memberIds.includes(p.id));
  const nonMembers = list.filter((p) => !memberIds.includes(p.id));
  return (
    <>
      {members.length > 0 ? (
        <div className="space-y-1 mb-3">
          {members.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-[hsl(0_0%_100%/0.04)] transition-colors group">
              <button onClick={() => onSelectPerson(p.id)} className="flex-1 flex items-center gap-3 text-left">
                <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
              </button>
              <button
                onClick={() => onToggle(p.id, circleId, true)}
                aria-label={`Remove ${p.name}`}
                className="p-1.5 rounded-md text-muted-text hover:text-destructive opacity-60 group-hover:opacity-100 transition-all"
              >
                <UserMinus className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted-text mb-3">No members yet.</p>
      )}

      <button
        onClick={() => setAddingPeople(!addingPeople)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary"
      >
        <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
        {addingPeople ? 'Done' : 'Add people'}
      </button>

      {addingPeople && nonMembers.length > 0 && (
        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {nonMembers.map((p) => (
            <button
              key={p.id}
              onClick={() => onToggle(p.id, circleId, false)}
              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-[hsl(0_0%_100%/0.04)] transition-colors text-left"
            >
              <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
              <span className="text-sm text-foreground flex-1">{p.name}</span>
              <Plus className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
            </button>
          ))}
        </div>
      )}
      {addingPeople && nonMembers.length === 0 && (
        <p className="text-[12px] text-muted-text mt-2 italic">Everyone is already in this Circle.</p>
      )}
    </>
  );
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  const fmt = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (start && !end) return fmt(start);
  if (!start && end) return fmt(end);
  if (start === end) return fmt(start!);
  return `${fmt(start!)} – ${fmt(end!)}`;
}
