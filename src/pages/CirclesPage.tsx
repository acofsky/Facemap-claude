import { useState } from 'react';
import {
  useCircles, usePersons, usePersonCircles,
  useCreateCircle, useUpdateCircle, useDeleteCircle,
  useAddPersonToCircle, useRemovePersonFromCircle,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Plus, X, Loader2, Trash2, Pencil, Check, UserPlus, UserMinus } from 'lucide-react';

interface CirclesPageProps {
  onSelectPerson: (id: string) => void;
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

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  // Add people mode
  const [addingPeopleCircle, setAddingPeopleCircle] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createCircle.mutateAsync({ name: newName, emoji: newEmoji, color: 'hsl(16, 65%, 55%)' });
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
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 animate-fade-in">
      <div className="mb-6 pr-14">
        <h1 className="text-3xl font-display text-foreground">Circles</h1>
      </div>

      {showAdd && (
        <div className="flex gap-2 mb-6 animate-scale-in">
          <input
            value={newEmoji}
            onChange={e => setNewEmoji(e.target.value)}
            className="w-12 px-2 py-2.5 rounded-xl bg-muted text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            maxLength={2}
          />
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Circle name..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
            Add
          </button>
        </div>
      )}

      {circles.length === 0 && !showAdd && (
        <div className="mb-6 space-y-3">
          <p className="text-sm text-muted-foreground">Quick start with a suggestion:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { emoji: '🎓', name: 'School' },
              { emoji: '💒', name: 'Childhood' },
              { emoji: '💼', name: 'Work' },
              { emoji: '🏋️', name: 'Gym' },
              { emoji: '🎲', name: 'Randoms' },
            ].map(s => (
              <button
                key={s.name}
                onClick={() => createCircle.mutateAsync({ name: s.name, emoji: s.emoji, color: 'hsl(16, 65%, 55%)' })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-sm text-foreground hover:bg-accent/30 transition-colors"
              >
                <span>{s.emoji}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
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

          return (
            <div key={circle.id} className="rounded-xl bg-card warm-shadow overflow-hidden">
              {/* Circle header */}
              {isEditing ? (
                <div className="flex items-center gap-2 p-3">
                  <input
                    value={editEmoji}
                    onChange={e => setEditEmoji(e.target.value)}
                    className="w-10 px-1 py-1.5 rounded-lg bg-muted text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                    maxLength={2}
                  />
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-muted text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                  />
                  <button onClick={saveEdit} className="p-1.5 rounded-lg bg-primary text-primary-foreground">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedCircle(isExpanded ? null : circle.id)}
                    className="flex-1 flex items-center gap-3 p-4 hover:bg-secondary/40 transition-colors"
                  >
                    <span className="text-2xl">{circle.emoji}</span>
                    <div className="flex-1 text-left">
                      <div className="font-display text-base text-foreground">{circle.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {circlePeople.length} {circlePeople.length === 1 ? 'person' : 'people'}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 pr-3">
                    <button
                      onClick={() => startEdit(circle)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(circle.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-border">
                  {/* People in circle */}
                  <div className="px-4 pt-3 pb-2">
                    {circlePeople.length > 0 ? (
                      <div className="space-y-1">
                        {circlePeople.map(p => (
                          <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg group">
                            <button
                              onClick={() => onSelectPerson(p.id)}
                              className="flex-1 flex items-center gap-3 hover:bg-muted rounded-lg transition-colors"
                            >
                              <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                              <span className="text-sm font-medium text-foreground">{p.name}</span>
                            </button>
                            <button
                              onClick={() => togglePersonInCircle(p.id, circle.id, true)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                              title="Remove from circle"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-1">No people in this circle yet.</p>
                    )}
                  </div>

                  {/* Add people toggle */}
                  <div className="px-4 pb-3">
                    <button
                      onClick={() => setAddingPeopleCircle(isAddingPeople ? null : circle.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {isAddingPeople ? 'Done adding' : 'Add people'}
                    </button>

                    {isAddingPeople && nonCirclePeople.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {nonCirclePeople.map(p => (
                          <button
                            key={p.id}
                            onClick={() => togglePersonInCircle(p.id, circle.id, false)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                          >
                            <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                            <span className="text-sm text-foreground">{p.name}</span>
                            <Plus className="w-3.5 h-3.5 text-primary ml-auto" />
                          </button>
                        ))}
                      </div>
                    )}
                    {isAddingPeople && nonCirclePeople.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-2">Everyone is already in this circle.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-secondary/40 transition-colors w-fit"
        >
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? 'Cancel' : 'New circle'}
        </button>
      </div>
    </div>
  );
}
