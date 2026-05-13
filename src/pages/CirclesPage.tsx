import { useState } from 'react';
import {
  useCircles, usePersons, usePersonCircles,
  useCreateCircle, useUpdateCircle, useDeleteCircle,
  useAddPersonToCircle, useRemovePersonFromCircle,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Plus, X, Loader2, Trash2, Pencil, Check, UserPlus, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CirclesPageProps {
  onSelectPerson: (id: string) => void;
}

const TILE_PALETTE = ['red', 'blue', 'purple', 'green', 'amber', 'slate', 'rose', 'teal'] as const;
function circleTone(id: string): typeof TILE_PALETTE[number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TILE_PALETTE[hash % TILE_PALETTE.length];
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
  const createCircle = useCreateCircle();
  const updateCircle = useUpdateCircle();
  const deleteCircle = useDeleteCircle();
  const addToCircle = useAddPersonToCircle();
  const removeFromCircle = useRemovePersonFromCircle();

  const [expandedCircle, setExpandedCircle] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('📌');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  const [addingPeopleCircle, setAddingPeopleCircle] = useState<string | null>(null);

  const memberCount = (id: string) => personCircles.filter(pc => pc.circle_id === id).length;

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createCircle.mutateAsync({ name: newName, emoji: newEmoji, color: 'hsl(0, 75%, 53%)' });
    setNewName('');
    setNewEmoji('📌');
    setShowAdd(false);
  };

  const startEdit = (circle: { id: string; name: string; emoji: string }) => {
    setEditingId(circle.id);
    setEditName(circle.name);
    setEditEmoji(circle.emoji);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateCircle.mutateAsync({ id: editingId, updates: { name: editName, emoji: editEmoji } });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this Circle? People will not be removed from Membr.')) return;
    await deleteCircle.mutateAsync(id);
    if (expandedCircle === id) setExpandedCircle(null);
  };

  const togglePersonInCircle = async (personId: string, circleId: string, isInCircle: boolean) => {
    if (isInCircle) {
      await removeFromCircle.mutateAsync({ personId, circleId });
    } else {
      await addToCircle.mutateAsync({ personId, circleId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const expanded = circles.find(c => c.id === expandedCircle);

  return (
    <div className="pb-8 animate-fade-in">
      {/* Nav bar */}
      <div className="flex items-center justify-between px-5 pt-12 mb-4">
        <span className="w-9" />
        <h1 className="text-[17px] font-semibold text-foreground">Circles</h1>
        <button
          onClick={() => setShowAdd(v => !v)}
          aria-label="New Circle"
          className="w-9 h-9 -mr-2 flex items-center justify-center text-foreground active:scale-95 transition-transform"
        >
          {showAdd ? <X className="w-5 h-5" strokeWidth={1.75} /> : <Plus className="w-5 h-5" strokeWidth={1.75} />}
        </button>
      </div>

      {/* Inline create */}
      {showAdd && (
        <div className="px-5 mb-5 animate-fade-in">
          <div className="flex gap-2">
            <input
              value={newEmoji}
              onChange={e => setNewEmoji(e.target.value)}
              className="w-12 h-11 px-2 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-center text-lg focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
              maxLength={2}
            />
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Internship, Dorm Floor, Book Club…"
              className="flex-1 h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="px-4 h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Suggestions for empty state */}
      {circles.length === 0 && !showAdd && (
        <div className="px-5 mb-6">
          <p className="text-[13px] text-muted-text mb-2.5">Quick start with a suggestion:</p>
          <div className="flex flex-wrap gap-2">
            {CIRCLE_SUGGESTIONS.map(s => (
              <button
                key={s.name}
                onClick={() => createCircle.mutateAsync({ name: s.name, emoji: s.emoji, color: 'hsl(0, 75%, 53%)' })}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground hover:border-[hsl(0_0%_100%/0.14)] transition-colors"
              >
                <span>{s.emoji}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Circles section */}
      <SectionLabel>Circles</SectionLabel>
      {circles.length > 0 ? (
        <div className="px-5 grid grid-cols-2 gap-3">
          {circles.map(circle => (
            <button
              key={circle.id}
              onClick={() => setExpandedCircle(expandedCircle === circle.id ? null : circle.id)}
              className={cn(
                'aspect-[3/2] rounded-xl p-3.5 flex flex-col justify-end text-left transition-transform active:scale-[0.98]',
                `tile-${circleTone(circle.id)}`,
                expandedCircle === circle.id && 'ring-2 ring-foreground/30',
              )}
            >
              <div className="text-[15px] font-semibold text-white truncate flex items-center gap-1">
                {circle.emoji && <span>{circle.emoji}</span>}
                <span className="truncate">{circle.name}</span>
              </div>
              <div className="text-[12px] text-white/70">
                {memberCount(circle.id)} {memberCount(circle.id) === 1 ? 'member' : 'members'}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-5">
          <p className="text-[13px] text-muted-text italic">
            No Circles yet. Tap + above to create one.
          </p>
        </div>
      )}

      {/* Inline detail for the expanded circle (transitional until CIRCLES-02 lands) */}
      {expanded && (
        <div className="px-5 mt-4 animate-fade-in">
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4">
            {editingId === expanded.id ? (
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={editEmoji}
                  onChange={e => setEditEmoji(e.target.value)}
                  className="w-10 h-9 px-1 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-center"
                  maxLength={2}
                />
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                />
                <button onClick={saveEdit} className="p-1.5 rounded-md bg-primary text-primary-foreground">
                  <Check className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-muted-text">
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{expanded.emoji}</span>
                  <div>
                    <div className="text-[15px] font-semibold text-foreground">{expanded.name}</div>
                    <div className="text-[12px] text-muted-text">
                      {memberCount(expanded.id)} {memberCount(expanded.id) === 1 ? 'member' : 'members'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(expanded)}
                    aria-label="Edit"
                    className="p-2 rounded-md text-muted-text hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => handleDelete(expanded.id)}
                    aria-label="Delete"
                    className="p-2 rounded-md text-muted-text hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            )}

            {/* Members list */}
            {(() => {
              const circleMemberIds = personCircles.filter(pc => pc.circle_id === expanded.id).map(pc => pc.person_id);
              const members = people.filter(p => circleMemberIds.includes(p.id));
              const nonMembers = people.filter(p => !circleMemberIds.includes(p.id));
              const adding = addingPeopleCircle === expanded.id;
              return (
                <>
                  {members.length > 0 ? (
                    <div className="space-y-1 mb-3">
                      {members.map(p => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-[hsl(0_0%_100%/0.04)] transition-colors group">
                          <button
                            onClick={() => onSelectPerson(p.id)}
                            className="flex-1 flex items-center gap-3 text-left"
                          >
                            <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                            <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                          </button>
                          <button
                            onClick={() => togglePersonInCircle(p.id, expanded.id, true)}
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
                    onClick={() => setAddingPeopleCircle(adding ? null : expanded.id)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary"
                  >
                    <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {adding ? 'Done' : 'Add people'}
                  </button>

                  {adding && nonMembers.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {nonMembers.map(p => (
                        <button
                          key={p.id}
                          onClick={() => togglePersonInCircle(p.id, expanded.id, false)}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-[hsl(0_0%_100%/0.04)] transition-colors text-left"
                        >
                          <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                          <span className="text-sm text-foreground flex-1">{p.name}</span>
                          <Plus className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                        </button>
                      ))}
                    </div>
                  )}
                  {adding && nonMembers.length === 0 && (
                    <p className="text-[12px] text-muted-text mt-2 italic">Everyone is already in this Circle.</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Events tier — stub until Phase C lands the Events object */}
      <div className="mx-5 my-6 h-px bg-[hsl(0_0%_100%/0.08)]" />
      <SectionLabel>Events</SectionLabel>
      <div className="px-5">
        <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-5 text-center">
          <p className="text-[13px] text-muted-text italic">
            + Log a trip, dinner, or event — coming soon.
          </p>
        </div>
      </div>
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
