import { useState, useRef, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  usePerson, usePersons, useCircles, useUpdatePerson, useDeletePerson,
  useSetPersonCircles, useUploadPhoto,
  useConnections, useCreateConnection, useDeleteConnection,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { PhotoImg } from '@/components/PhotoImg';
import { MeetingsSection } from '@/components/MeetingsSection';
import { MeetingBriefModal } from '@/components/MeetingBriefModal';
import {
  ArrowLeft, Trash2, ImagePlus, MapPin, Users, FileText,
  AlertCircle, Briefcase, StickyNote, Loader2, Check, X,
  CalendarIcon, Link2, Plus, UserMinus, Sparkles, Wand2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { BulletTextarea, BulletDisplay } from '@/components/BulletTextarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ContactLinkSection } from '@/components/ContactLinkSection';
import { AIBadge } from '@/components/AIBadge';

interface PersonProfilePageProps {
  personId: string;
  onBack: () => void;
}

export function PersonProfilePage({ personId, onBack }: PersonProfilePageProps) {
  const { data: person, isLoading } = usePerson(personId);
  const { data: allPeople = [] } = usePersons();
  const { data: circles = [] } = useCircles();
  const { data: connections = [] } = useConnections();
  const updatePerson = useUpdatePerson();
  const deletePersonMut = useDeletePerson();
  const setPersonCircles = useSetPersonCircles();
  const uploadPhoto = useUploadPhoto();
  const createConnection = useCreateConnection();
  const deleteConnection = useDeleteConnection();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showConnectPicker, setShowConnectPicker] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  const handleGenerateDescription = async () => {
    const photo = person?.photos?.[0];
    if (!photo) {
      toast.error('Add a photo first');
      return;
    }
    setGeneratingDesc(true);
    try {
      // Resolve to a signed URL the AI can fetch
      const { getPhotoUrl } = await import('@/lib/store');
      const photoUrl = await getPhotoUrl(photo);
      const { data, error } = await supabase.functions.invoke('describe-from-photo', {
        body: { photoUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const description = data?.description || '';
      if (description) {
        updatePerson.mutate({ id: personId, updates: { physical_description: description } });
        toast.success('Description generated from photo');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate description');
    } finally {
      setGeneratingDesc(false);
    }
  };

  // Connections for this person
  const personConnections = useMemo(() => {
    return connections.filter(c => c.person_a_id === personId || c.person_b_id === personId);
  }, [connections, personId]);

  const connectedPeopleIds = useMemo(() => {
    return personConnections.map(c => c.person_a_id === personId ? c.person_b_id : c.person_a_id);
  }, [personConnections, personId]);

  const availableToConnect = useMemo(() => {
    return allPeople.filter(p => p.id !== personId && !connectedPeopleIds.includes(p.id));
  }, [allPeople, personId, connectedPeopleIds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="px-5 pt-12 text-center">
        <p className="text-muted-foreground">Person not found.</p>
        <button onClick={onBack} className="mt-4 text-primary text-sm">Go back</button>
      </div>
    );
  }

  const startEdit = (field: string, value: string) => {
    setEditing(field);
    setEditValue(value || '');
  };

  const saveEdit = () => {
    if (editing) {
      updatePerson.mutate({ id: personId, updates: { [editing]: editValue || null } });
      setEditing(null);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadPhoto.mutateAsync(file);
    const photos = [...(person.photos || []), url].slice(0, 5);
    updatePerson.mutate({ id: personId, updates: { photos } });
  };

  const toggleCircle = (circleId: string) => {
    const current = person.circleIds || [];
    const next = current.includes(circleId)
      ? current.filter((id: string) => id !== circleId)
      : [...current, circleId];
    setPersonCircles.mutate({ personId, circleIds: next });
  };

  const handleDelete = () => {
    if (confirm('Remove this person from your Membr?')) {
      deletePersonMut.mutate(personId);
      onBack();
    }
  };

  const handleDateMetChange = (date: Date | undefined) => {
    updatePerson.mutate({
      id: personId,
      updates: { date_met: date ? format(date, 'yyyy-MM-dd') : null },
    });
  };

  const handleConnect = (otherPersonId: string) => {
    createConnection.mutate({ personAId: personId, personBId: otherPersonId });
    setShowConnectPicker(false);
  };

  const handleDisconnect = (connectionId: string) => {
    deleteConnection.mutate(connectionId);
  };

  const fields = [
    { key: 'how_we_met', label: 'How we met', icon: Users },
    { key: 'where_when', label: 'Where we met', icon: MapPin },
    { key: 'physical_description', label: 'Physical description', icon: FileText },
    { key: 'important_info', label: 'Important info', icon: Briefcase },
    { key: 'misc_notes', label: 'Notes', icon: StickyNote },
    { key: 'reminder_note', label: 'Reminder', icon: AlertCircle },
  ];

  const getFieldValue = (key: string) => {
    return (person as any)[key] as string | null;
  };

  return (
    <div className="px-5 pt-8 pb-8 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative mb-4">
          <PersonAvatar name={person.name} photo={person.photos[0]} size="lg" />
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center warm-shadow"
          >
            <ImagePlus className="w-3.5 h-3.5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        {editing === 'name' ? (
          <div className="flex items-center gap-2">
            <input
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              className="text-2xl font-display text-center bg-transparent border-b-2 border-primary focus:outline-none text-foreground"
              autoFocus
            />
            <button onClick={saveEdit} className="p-1.5 rounded-lg bg-primary text-primary-foreground"><Check className="w-4 h-4" /></button>
            <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={() => startEdit('name', person.name)} className="text-2xl font-display text-foreground hover:text-primary transition-colors">
            {person.name || 'Tap to add name'}
          </button>
        )}

        <span className="text-xs text-muted-foreground mt-2">
          Added {new Date(person.created_at).toLocaleDateString()}
        </span>

        <button
          onClick={() => setBriefOpen(true)}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all warm-shadow"
        >
          <Sparkles className="w-4 h-4" /> Generate brief
        </button>
      </div>

      {/* Photos strip */}
      {person.photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-5 px-5">
          {person.photos.map((photo, i) => (
            <PhotoImg key={i} path={photo} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
          ))}
        </div>
      )}

      {/* iPhone Contact link */}
      <ContactLinkSection
        personId={personId}
        person={person as any}
        iosContactId={(person as any).ios_contact_id ?? null}
      />

      {/* Date Met — calendar picker */}
      <div className="rounded-xl bg-card p-4 warm-shadow mb-3">
        <div className="flex items-center gap-2 mb-2">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">When we met</span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors",
              !person.date_met && "text-muted-foreground italic"
            )}>
              {person.date_met ? format(new Date(person.date_met), 'MMMM d, yyyy') : 'Tap to pick a date...'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={person.date_met ? new Date(person.date_met) : undefined}
              onSelect={handleDateMetChange}
              disabled={(date) => date > new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Circles */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Circles</h3>
        <div className="flex flex-wrap gap-2">
          {circles.map(c => (
            <button
              key={c.id}
              onClick={() => toggleCircle(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                (person.circleIds || []).includes(c.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Text fields */}
      <div className="space-y-3">
        {fields.map(f => {
          const value = getFieldValue(f.key);
          const isEditing = editing === f.key;

          return (
            <div key={f.key} className="rounded-xl bg-card p-4 warm-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <f.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                </div>
                {f.key === 'physical_description' && person.photos.length > 0 && !isEditing && (
                  <div className="flex items-center gap-2">
                    {value && <AIBadge feature="description" />}
                    <button
                      onClick={handleGenerateDescription}
                      disabled={generatingDesc}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                    >
                      {generatingDesc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      {generatingDesc ? 'Generating...' : 'From photo'}
                    </button>
                  </div>
                )}
              </div>
              {(() => {
                const isBulletField = f.key === 'important_info' || f.key === 'misc_notes';
                if (isEditing) {
                  return (
                    <div>
                      {isBulletField ? (
                        <BulletTextarea value={editValue} onChange={setEditValue} rows={4} autoFocus className="mt-1" />
                      ) : (
                        <textarea
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none mt-1"
                          rows={3}
                          autoFocus
                        />
                      )}
                      <div className="flex gap-2 mt-2">
                        <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                          <Check className="w-3 h-3" /> Save
                        </button>
                        <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    onClick={() => startEdit(f.key, value || '')}
                    className="text-sm text-left w-full mt-1"
                  >
                    {value ? (
                      isBulletField ? (
                        <BulletDisplay value={value} />
                      ) : (
                        <span className="text-foreground">{value}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground italic">Tap to add...</span>
                    )}
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Reminder date */}
      <div className="rounded-xl bg-card p-4 warm-shadow mt-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Reminder date</span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors",
              !person.reminder_date && "text-muted-foreground italic"
            )}>
              {person.reminder_date ? format(new Date(person.reminder_date), 'MMMM d, yyyy') : 'Set a reminder date...'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={person.reminder_date ? new Date(person.reminder_date) : undefined}
              onSelect={(date) => {
                updatePerson.mutate({
                  id: personId,
                  updates: { reminder_date: date ? format(date, 'yyyy-MM-dd') : null },
                });
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Who they know — Connections */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Who they know</h3>
          </div>
          <button
            onClick={() => setShowConnectPicker(!showConnectPicker)}
            className="p-1.5 rounded-lg bg-primary text-primary-foreground"
          >
            {showConnectPicker ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Free-text notes about who they know */}
        <div className="rounded-xl bg-card p-4 warm-shadow mb-3">
          {editing === 'known_people_notes' ? (
            <div>
              <textarea
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                placeholder="e.g. They know Sarah from yoga, Mike's cousin..."
                className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                  <Check className="w-3 h-3" /> Save
                </button>
                <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => startEdit('known_people_notes', (person as any).known_people_notes || '')}
              className="text-sm text-left w-full"
            >
              {(person as any).known_people_notes ? (
                <span className="text-foreground whitespace-pre-wrap">{(person as any).known_people_notes}</span>
              ) : (
                <span className="text-muted-foreground italic">Tap to add who they know...</span>
              )}
            </button>
          )}
        </div>

        {showConnectPicker && availableToConnect.length > 0 && (
          <div className="rounded-xl bg-muted/50 p-2 mb-3 max-h-48 overflow-y-auto space-y-1">
            <p className="text-xs text-muted-foreground px-2 py-1">Link to someone on Membr:</p>
            {availableToConnect.map(p => (
              <button
                key={p.id}
                onClick={() => handleConnect(p.id)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-card transition-colors"
              >
                <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                <span className="text-sm text-foreground">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {showConnectPicker && availableToConnect.length === 0 && (
          <p className="text-xs text-muted-foreground italic mb-3">No more people to connect.</p>
        )}

        {personConnections.length > 0 && (
          <div className="space-y-2">
            {personConnections.map(conn => {
              const otherId = conn.person_a_id === personId ? conn.person_b_id : conn.person_a_id;
              const otherPerson = allPeople.find(p => p.id === otherId);
              if (!otherPerson) return null;
              return (
                <div key={conn.id} className="flex items-center gap-3 p-3 rounded-xl bg-card warm-shadow">
                  <PersonAvatar name={otherPerson.name} photo={otherPerson.photos[0]} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">{otherPerson.name}</div>
                    {conn.note && <div className="text-xs text-muted-foreground truncate">{conn.note}</div>}
                  </div>
                  <button
                    onClick={() => handleDisconnect(conn.id)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Meetings log */}
      <MeetingsSection personId={personId} />

      <button
        onClick={handleDelete}
        className="flex items-center gap-2 mx-auto mt-10 text-destructive text-sm hover:opacity-80"
      >
        <Trash2 className="w-4 h-4" /> Remove from Membr
      </button>

      <AnimatePresence>
        {briefOpen && (
          <MeetingBriefModal
            personId={personId}
            personName={person.name || 'Person'}
            onClose={() => setBriefOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
