import { useState } from 'react';
import {
  useCircles, usePersons, usePersonCircles,
  useCreateCircle, useUpdateCircle, useDeleteCircle,
  useAddPersonToCircle, useRemovePersonFromCircle,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Plus, X, Loader2, Trash2, Pencil, Check, UserPlus, UserMinus } from 'lucide-react';
import { CIRCLE_COLOR_KEYS, CircleColorKey, resolveCircleColor } from '@/lib/circle-colors';

interface CirclesPageProps {
  onSelectPerson: (id: string) => void;
}

function ColorSwatchRow({ value, onChange }: { value: CircleColorKey; onChange: (v: CircleColorKey) => void }) {
  return (
    <div className="flex items-center gap-2">
      {CIRCLE_COLOR_KEYS.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-label={`${key} tile`}
          className={`w-8 h-8 rounded-button transition-all ${
            value === key ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'
          }`}
          style={{ background: `var(--gradient-tile-${key})` }}
        />
      ))}
    </div>
  );
}

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
  const [newColor, setNewColor] = useState<CircleColorKey>('red');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editColor, setEditColor] = useState<CircleColorKey>('red');

  const [addingPeopleCircle, setAddingPeopleCircle] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createCircle.mutateAsync({ name: newName, emoji: newEmoji, color: newColor });
    setNewName('');
    setNewEmoji('📌');
    setNewColor('red');
    setShowAdd(false);
  };

  const startEdit = (circle: { id: string; name: string; emoji: string; color: string | null }) => {
    setEditingId(circle.id);
    setEditName(circle.name);
    setEditEmoji(circle.emoji);
    setEditColor(resolveCircleColor(circle.color, circle.id));
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateCircle.mutateAsync({ id: editingId, updates: { name: editName, emoji: editEmoji, color: editColor } });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this circle? People will not be removed.')) return;
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
        <Loader2 className="w-6 h-6 animate-spin text-primary" strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      <div className="mb-6 pr-14">
        <h1 className="font-display text-foreground leading-none" style={{ fontSize: '36px' }}>Circles</h1>
      </div>

      {showAdd && (
        <div className="surface-card p-4 mb-5 animate-scale-in space-y-3">
          <div className="flex gap-2">
            <input
              value={newEmoji}
              onChange={e => setNewEmoji(e.target.value)}
              className="w-12 px-2 py-2.5 rounded-input bg-secondary border border-border text-center text-lg focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
              maxLength={2}
            />
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Circle name..."
              className="flex-1 px-4 py-2.5 rounded-input bg-secondary border border-border text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex items-center justify-between">
            <ColorSwatchRow value={newColor} onChange={setNewColor} />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="px-4 py-2 rounded-button bg-primary text-primary-foreground text-[14px] font-semibold disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {circles.length === 0 && !showAdd && (
        <div className="surface-featured p-6 mb-6 text-center">
          <h2 className="font-display text-foreground mb-2" style={{ fontSize: '24px' }}>
            Group people by where you met.
          </h2>
          <p className="text-[14px] text-muted-foreground mb-4">
            Internship cohort, dorm floor, conference, family. A person can live in many circles.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary text-primary-foreground text-[14px] font-semibold"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Create your first Circle
          </button>
        </div>
      )}

      <div className="space-y-3">
        {circles.map(circle => {
          const circlePeopleIds = personCircles
            .filter(pc => pc.circle_id === circle.id)
            .map(pc => pc.person_id);
          const circlePeople = people.filter(p => circlePeopleIds.includes(p.id));
          const nonCirclePeople = people.filter(p => !circlePeopleIds.includes(p.id));
          const isExpanded = expandedCircle === circle.id;
          const isEditing = editingId === circle.id;
          const isAddingPeople = addingPeopleCircle === circle.id;
          const colorKey = resolveCircleColor(circle.color, circle.id);

          return (
            <div key={circle.id} className="surface-card overflow-hidden">
              {isEditing ? (
                <div className="p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={editEmoji}
                      onChange={e => setEditEmoji(e.target.value)}
                      className="w-10 px-1 py-1.5 rounded-input bg-secondary border border-border text-center text-lg focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
                      maxLength={2}
                    />
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-input bg-secondary border border-border text-[14px] text-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    />
                    <button onClick={saveEdit} aria-label="Save" className="p-1.5 rounded-button bg-primary text-primary-foreground">
                      <Check className="w-4 h-4" strokeWidth={2} />
                    </button>
                    <button onClick={() => setEditingId(null)} aria-label="Cancel" className="p-1.5 rounded-button bg-secondary border border-border text-muted-foreground">
                      <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                  <ColorSwatchRow value={editColor} onChange={setEditColor} />
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedCircle(isExpanded ? null : circle.id)}
                    className="flex-1 flex items-center gap-3 p-3 hover:bg-foreground/[0.03] transition-colors"
                  >
                    <div
                      className="w-11 h-11 rounded-modal flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `var(--gradient-tile-${colorKey})` }}
                    >
                      {circle.emoji}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-[16px] font-semibold text-foreground truncate">{circle.name}</div>
                      <div className="text-[13px] text-muted-foreground">
                        {circlePeople.length} {circlePeople.length === 1 ? 'person' : 'people'}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 pr-2">
                    <button
                      onClick={() => startEdit(circle)}
                      aria-label="Edit"
                      className="p-2 rounded-button-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => handleDelete(circle.id)}
                      aria-label="Delete"
                      className="p-2 rounded-button-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              )}

              {isExpanded && !isEditing && (
                <div className="border-t border-border">
                  <div className="px-3 pt-2 pb-1">
                    {circlePeople.length > 0 ? (
                      <div>
                        {circlePeople.map(p => (
                          <div key={p.id} className="flex items-center gap-3 group">
                            <button
                              onClick={() => onSelectPerson(p.id)}
                              className="flex-1 flex items-center gap-3 py-2.5 hover:bg-foreground/[0.03] rounded-button-sm transition-colors px-1"
                            >
                              <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                              <span className="text-[15px] font-medium text-foreground">{p.name}</span>
                            </button>
                            <button
                              onClick={() => togglePersonInCircle(p.id, circle.id, true)}
                              aria-label="Remove from circle"
                              className="p-1.5 rounded-button-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <UserMinus className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-muted-foreground py-2 px-1">No people in this circle yet.</p>
                    )}
                  </div>

                  <div className="px-3 pb-3">
                    <button
                      onClick={() => setAddingPeopleCircle(isAddingPeople ? null : circle.id)}
                      className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:opacity-80 transition-opacity px-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
                      {isAddingPeople ? 'Done adding' : 'Add people'}
                    </button>

                    {isAddingPeople && nonCirclePeople.length > 0 && (
                      <div className="mt-2 max-h-48 overflow-y-auto">
                        {nonCirclePeople.map(p => (
                          <button
                            key={p.id}
                            onClick={() => togglePersonInCircle(p.id, circle.id, false)}
                            className="w-full flex items-center gap-3 py-2 px-1 rounded-button-sm hover:bg-foreground/[0.03] transition-colors"
                          >
                            <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                            <span className="text-[14px] text-foreground">{p.name}</span>
                            <Plus className="w-3.5 h-3.5 text-primary ml-auto" strokeWidth={2} />
                          </button>
                        ))}
                      </div>
                    )}
                    {isAddingPeople && nonCirclePeople.length === 0 && (
                      <p className="text-[12px] text-muted-foreground mt-2 px-1">Everyone is already in this circle.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {circles.length > 0 && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-3 rounded-card bg-transparent border border-dashed border-border text-[14px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors w-fit"
          >
            {showAdd ? <X className="w-4 h-4" strokeWidth={1.75} /> : <Plus className="w-4 h-4" strokeWidth={1.75} />}
            {showAdd ? 'Cancel' : 'New circle'}
          </button>
        )}
      </div>
    </div>
  );
}
