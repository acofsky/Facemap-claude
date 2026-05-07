import { useState, useRef, useMemo, useEffect } from 'react';
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
  CalendarIcon, Link2, Plus, UserMinus, Wand2, MoreVertical,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { BulletTextarea, BulletDisplay } from '@/components/BulletTextarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ContactLinkSection } from '@/components/ContactLinkSection';
import { resolveCircleColor } from '@/lib/circle-colors';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConnections, setShowConnections] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  const handleGenerateDescription = async () => {
    const photo = person?.photos?.[0];
    if (!photo) {
      toast.error('Add a photo first');
      return;
    }
    setGeneratingDesc(true);
    try {
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
        <Loader2 className="w-6 h-6 animate-spin text-primary" strokeWidth={1.75} />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="px-5 pt-12 text-center">
        <p className="text-muted-foreground">Person not found.</p>
        <button onClick={onBack} className="mt-4 text-primary text-[14px]">Go back</button>
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

  const fields: Array<{ key: string; label: string; icon: typeof Users }> = [
    { key: 'how_we_met', label: 'How we met', icon: Users },
    { key: 'where_when', label: 'Where we met', icon: MapPin },
    { key: 'physical_description', label: 'Physical description', icon: FileText },
    { key: 'important_info', label: 'Important info', icon: Briefcase },
    { key: 'misc_notes', label: 'Notes', icon: StickyNote },
    { key: 'reminder_note', label: 'Reminder note', icon: AlertCircle },
  ];

  const getFieldValue = (key: string) => (person as any)[key] as string | null;

  const personCircles = circles.filter(c => (person.circleIds || []).includes(c.id));
  const firstCircle = personCircles[0];
  const metaParts: string[] = [];
  if (person.date_met) metaParts.push(`Met ${format(new Date(person.date_met), 'MMM d, yyyy')}`);
  else metaParts.push(`Added ${format(new Date(person.created_at), 'MMM d, yyyy')}`);
  if (firstCircle) metaParts.push(`${firstCircle.emoji} ${firstCircle.name}`);

  return (
    <div className="px-5 pt-4 pb-8 animate-fade-in">
      {/* Header — back chevron + kebab */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:border-foreground/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" strokeWidth={1.75} />
        </button>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            aria-label="More"
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:border-foreground/20 transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-foreground" strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-11 z-20 w-44 surface-card overflow-hidden animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setMenuOpen(false); handleDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[14px] text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Remove from Membr
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hero — person first, asymmetric */}
      <div className="mb-6 pl-1">
        <div className="relative w-fit mb-4">
          <PersonAvatar name={person.name} photo={person.photos[0]} size="lg" />
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Add photo"
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          >
            <ImagePlus className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        {editing === 'name' ? (
          <div className="flex items-center gap-2 mb-1">
            <input
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              className="font-display text-foreground bg-transparent border-b-2 border-primary focus:outline-none flex-1"
              style={{ fontSize: '36px' }}
              autoFocus
            />
            <button onClick={saveEdit} aria-label="Save" className="p-1.5 rounded-button bg-primary text-primary-foreground"><Check className="w-4 h-4" strokeWidth={2} /></button>
            <button onClick={cancelEdit} aria-label="Cancel" className="p-1.5 rounded-button bg-secondary border border-border text-muted-foreground"><X className="w-4 h-4" strokeWidth={1.75} /></button>
          </div>
        ) : (
          <button
            onClick={() => startEdit('name', person.name)}
            className="font-display text-foreground hover:text-primary transition-colors text-left leading-none mb-1"
            style={{ fontSize: '36px' }}
          >
            {person.name || 'Tap to add name'}
          </button>
        )}

        <p className="text-[13px] text-muted-foreground mt-2">{metaParts.join(' · ')}</p>
      </div>

      {/* HERO featured card — Meeting Brief, the one red moment */}
      <button
        onClick={() => setBriefOpen(true)}
        className="w-full surface-featured p-4 mb-6 text-left active:scale-[0.99] transition-transform group"
      >
        <div className="flex items-center gap-3">
          <div className="icon-tile icon-tile-red flex-shrink-0">
            <Wand2 className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-foreground leading-tight" style={{ fontSize: '20px' }}>
              Brief on {person.name?.split(' ')[0] || 'them'}
            </h2>
            <p className="text-[13px] text-muted-foreground">A 30-second AI refresher.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
        </div>
      </button>

      {/* Photo strip */}
      {person.photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-5 px-5 scrollbar-hide">
          {person.photos.map((photo, i) => (
            <PhotoImg key={i} path={photo} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0 border border-border" />
          ))}
        </div>
      )}

      {/* iPhone Contact link */}
      <ContactLinkSection
        personId={personId}
        person={person as any}
        iosContactId={(person as any).ios_contact_id ?? null}
      />

      {/* Date met */}
      <div className="surface-card p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
          <span className="text-[12px] font-medium text-muted-foreground">When we met</span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "w-full text-left text-[15px] px-3 py-2 rounded-input border border-border bg-secondary hover:border-foreground/20 transition-colors",
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
      <div className="surface-card p-4 mb-3">
        <p className="text-[12px] font-medium text-muted-foreground mb-2.5">Circles</p>
        {circles.length === 0 ? (
          <p className="text-[13px] text-muted-foreground italic">No circles yet — create some on the Circles tab.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {circles.map(c => {
              const active = (person.circleIds || []).includes(c.id);
              const colorKey = resolveCircleColor(c.color, c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCircle(c.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-button-sm text-[12px] font-medium transition-colors border ${
                    active
                      ? 'bg-secondary border-primary text-foreground'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: `var(--gradient-tile-${colorKey})` }}
                  />
                  <span>{c.emoji}</span>
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Text fields */}
      <div className="space-y-3">
        {fields.map(f => {
          const value = getFieldValue(f.key);
          const isEditing = editing === f.key;
          const isBulletField = f.key === 'important_info' || f.key === 'misc_notes';

          return (
            <div key={f.key} className="surface-card p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <f.icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
                  <span className="text-[12px] font-medium text-muted-foreground">{f.label}</span>
                </div>
                {f.key === 'physical_description' && person.photos.length > 0 && !isEditing && (
                  <button
                    onClick={handleGenerateDescription}
                    disabled={generatingDesc}
                    className="flex items-center gap-1 px-2 py-1 rounded-button-sm bg-secondary border border-border text-foreground text-[11px] font-medium hover:border-foreground/20 disabled:opacity-50 transition-colors"
                  >
                    {generatingDesc ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} /> : <Wand2 className="w-3 h-3" strokeWidth={1.75} />}
                    {generatingDesc ? 'Generating…' : 'From photo'}
                  </button>
                )}
              </div>
              {isEditing ? (
                <div>
                  {isBulletField ? (
                    <BulletTextarea value={editValue} onChange={setEditValue} rows={4} autoFocus className="mt-1" />
                  ) : (
                    <textarea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-input px-3 py-2 text-[15px] text-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 resize-none mt-1 transition-colors"
                      rows={3}
                      autoFocus
                    />
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-button-sm bg-primary text-primary-foreground text-[12px] font-semibold">
                      <Check className="w-3 h-3" strokeWidth={2} /> Save
                    </button>
                    <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-button-sm bg-secondary border border-border text-muted-foreground text-[12px] font-medium">
                      <X className="w-3 h-3" strokeWidth={1.75} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(f.key, value || '')}
                  className="text-[15px] text-left w-full mt-1"
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
              )}
            </div>
          );
        })}
      </div>

      {/* Reminder date */}
      <div className="surface-card p-4 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
          <span className="text-[12px] font-medium text-muted-foreground">Reminder date</span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "w-full text-left text-[15px] px-3 py-2 rounded-input border border-border bg-secondary hover:border-foreground/20 transition-colors",
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

      {/* Connections — collapsible */}
      <div className="mt-6">
        <button
          onClick={() => setShowConnections(!showConnections)}
          className="w-full flex items-center justify-between mb-3 group"
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
            <h3 className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Who they know {personConnections.length > 0 && `· ${personConnections.length}`}
            </h3>
          </div>
          <span className="text-[12px] text-muted-foreground">{showConnections ? 'Hide' : 'Show'}</span>
        </button>

        {showConnections && (
          <div className="space-y-3">
            <div className="surface-card p-4">
              {editing === 'known_people_notes' ? (
                <div>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder="e.g. They know Sarah from yoga, Mike's cousin..."
                    className="w-full bg-secondary border border-border rounded-input px-3 py-2 text-[15px] text-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 resize-none transition-colors"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-button-sm bg-primary text-primary-foreground text-[12px] font-semibold">
                      <Check className="w-3 h-3" strokeWidth={2} /> Save
                    </button>
                    <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-button-sm bg-secondary border border-border text-muted-foreground text-[12px] font-medium">
                      <X className="w-3 h-3" strokeWidth={1.75} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => startEdit('known_people_notes', (person as any).known_people_notes || '')}
                  className="text-[15px] text-left w-full"
                >
                  {(person as any).known_people_notes ? (
                    <span className="text-foreground whitespace-pre-wrap">{(person as any).known_people_notes}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Tap to add who they know...</span>
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-muted-foreground px-1">Linked people</span>
              <button
                onClick={() => setShowConnectPicker(!showConnectPicker)}
                aria-label={showConnectPicker ? 'Cancel' : 'Add link'}
                className="p-1.5 rounded-button-sm bg-secondary border border-border text-foreground hover:border-foreground/20"
              >
                {showConnectPicker ? <X className="w-3.5 h-3.5" strokeWidth={1.75} /> : <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />}
              </button>
            </div>

            {showConnectPicker && availableToConnect.length > 0 && (
              <div className="surface-card p-2 max-h-48 overflow-y-auto">
                <p className="text-[12px] text-muted-foreground px-2 py-1">Link to someone on Membr:</p>
                {availableToConnect.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleConnect(p.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-button-sm hover:bg-foreground/[0.04] transition-colors"
                  >
                    <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                    <span className="text-[14px] text-foreground">{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            {showConnectPicker && availableToConnect.length === 0 && (
              <p className="text-[12px] text-muted-foreground italic">No more people to connect.</p>
            )}

            {personConnections.length > 0 && (
              <div className="space-y-2">
                {personConnections.map(conn => {
                  const otherId = conn.person_a_id === personId ? conn.person_b_id : conn.person_a_id;
                  const otherPerson = allPeople.find(p => p.id === otherId);
                  if (!otherPerson) return null;
                  return (
                    <div key={conn.id} className="flex items-center gap-3 p-3 surface-card">
                      <PersonAvatar name={otherPerson.name} photo={otherPerson.photos[0]} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium text-foreground truncate">{otherPerson.name}</div>
                        {conn.note && <div className="text-[13px] text-muted-foreground truncate">{conn.note}</div>}
                      </div>
                      <button
                        onClick={() => handleDisconnect(conn.id)}
                        aria-label="Unlink"
                        className="p-1.5 rounded-button-sm hover:bg-foreground/[0.04] text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <UserMinus className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meetings log */}
      <div className="mt-6">
        <MeetingsSection personId={personId} />
      </div>

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
