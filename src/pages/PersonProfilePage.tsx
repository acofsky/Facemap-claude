import { useState, useRef, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  usePerson, usePersons, useCircles, useUpdatePerson, useDeletePerson,
  useSetPersonCircles, useSetPersonEvents, useEvents, useUploadPhoto,
  useConnections, useCreateConnection, useDeleteConnection,
} from '@/hooks/use-data';
import { isValidTone } from '@/lib/store';
import { PersonAvatar } from '@/components/PersonAvatar';
import { PhotoImg } from '@/components/PhotoImg';
import { MeetingsSection } from '@/components/MeetingsSection';
import { MeetingBriefModal } from '@/components/MeetingBriefModal';
import {
  ArrowLeft, Trash2, ImagePlus, MapPin, Loader2, Check, X,
  CalendarIcon, Link2, Plus, UserMinus, Sparkles, Wand2, Phone,
  ChevronDown, ChevronUp, CalendarPlus, MoreHorizontal,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { BulletTextarea, BulletDisplay } from '@/components/BulletTextarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ContactLinkSection } from '@/components/ContactLinkSection';
import { AIBadge } from '@/components/AIBadge';
import { openIOSContact, isNativeIOS } from '@/lib/ios-contacts';

interface PersonProfilePageProps {
  personId: string;
  onBack: () => void;
}

export function PersonProfilePage({ personId, onBack }: PersonProfilePageProps) {
  const { data: person, isLoading } = usePerson(personId);
  const { data: allPeople = [] } = usePersons();
  const { data: circles = [] } = useCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });
  const { data: connections = [] } = useConnections();
  const updatePerson = useUpdatePerson();
  const deletePersonMut = useDeletePerson();
  const setPersonCircles = useSetPersonCircles();
  const setPersonEvents = useSetPersonEvents();
  const uploadPhoto = useUploadPhoto();
  const createConnection = useCreateConnection();
  const deleteConnection = useDeleteConnection();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showConnectPicker, setShowConnectPicker] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

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

  const personConnections = useMemo(
    () => connections.filter(c => c.person_a_id === personId || c.person_b_id === personId),
    [connections, personId],
  );

  const connectedPeopleIds = useMemo(
    () => personConnections.map(c => (c.person_a_id === personId ? c.person_b_id : c.person_a_id)),
    [personConnections, personId],
  );

  const availableToConnect = useMemo(
    () => allPeople.filter(p => p.id !== personId && !connectedPeopleIds.includes(p.id)),
    [allPeople, personId, connectedPeopleIds],
  );

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
        <p className="text-muted-text">Person not found.</p>
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

  const toggleEvent = (eventId: string) => {
    const current = person.eventIds || [];
    const next = current.includes(eventId)
      ? current.filter((id: string) => id !== eventId)
      : [...current, eventId];
    setPersonEvents.mutate({ personId, eventIds: next });
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

  const iosContactId = (person as any).ios_contact_id ?? null;
  const native = isNativeIOS();

  const handleOpenContact = () => {
    if (iosContactId) openIOSContact(iosContactId);
  };

  const personCircleObjects = circles.filter(c => (person.circleIds || []).includes(c.id));
  const personEventObjects = events.filter(e => (person.eventIds || []).includes(e.id));

  const firstName = (person.name || '').split(' ')[0] || 'Person';

  return (
    <div className="pb-10 animate-fade-in safe-top">
      {/* Nav bar */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-10 h-10 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <h1 className="font-sans text-[17px] font-semibold text-foreground truncate px-2">{firstName}</h1>
        <div className="relative">
          <button
            onClick={() => setActionMenuOpen(v => !v)}
            onBlur={() => setTimeout(() => setActionMenuOpen(false), 150)}
            aria-label="Person actions"
            className="w-10 h-10 -mr-1 flex items-center justify-center text-foreground active:scale-95 transition-transform"
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={1.75} />
          </button>
          {actionMenuOpen && (
            <div className="absolute right-1 top-full mt-1 w-44 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] py-1 z-20 shadow-xl">
              <button
                onClick={handleDelete}
                className="w-full text-left px-3 py-2.5 text-sm text-destructive hover:bg-[hsl(0_0%_100%/0.04)] flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} /> Delete person
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hero block */}
      <div className="flex flex-col items-center px-5 pt-3 pb-5">
        <div className="relative mb-3">
          <div className="rounded-full ring-2 ring-primary p-1">
            <PersonAvatar name={person.name} photo={person.photos[0]} size="lg" className="!w-24 !h-24 !text-2xl" />
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Change photo"
            className="absolute -bottom-0.5 -right-0.5 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
            style={{ boxShadow: '0 4px 12px hsl(var(--primary) / 0.35)' }}
          >
            <ImagePlus className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        {editing === 'name' ? (
          <div className="flex items-center gap-2">
            <input
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              className="text-[20px] font-sans font-bold text-center bg-transparent border-b border-primary focus:outline-none text-foreground"
              autoFocus
            />
            <button onClick={saveEdit} className="p-1.5 rounded-md bg-primary text-primary-foreground"><Check className="w-4 h-4" /></button>
            <button onClick={cancelEdit} className="p-1.5 rounded-md bg-surface-2 text-muted-text"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button
            onClick={() => startEdit('name', person.name)}
            className="text-[20px] font-sans font-bold text-foreground text-center leading-tight tracking-[-0.01em]"
          >
            {person.name || 'Tap to add name'}
          </button>
        )}

        {/* Circle + Event pills */}
        {(personCircleObjects.length > 0 || personEventObjects.length > 0) && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-2.5 px-4">
            {personCircleObjects.map(c => (
              <span
                key={c.id}
                className="inline-flex items-center px-2 py-0.5 rounded-sm bg-[hsl(0_0%_100%/0.05)] border border-[hsl(0_0%_100%/0.08)] text-[11px] font-medium text-foreground/80"
              >
                {c.emoji ? `${c.emoji} ` : ''}{c.name}
              </span>
            ))}
            {personEventObjects.map(e => {
              const tone = isValidTone(e.tone) ? e.tone : 'red';
              return (
                <span
                  key={e.id}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[11px] font-medium text-white/95',
                    `tile-${tone}`,
                  )}
                  style={{ borderColor: 'hsl(0 0% 100% / 0.18)' }}
                >
                  {e.name}
                </span>
              );
            })}
          </div>
        )}

        {/* How/Where we met — compact, italic */}
        {(person.how_we_met || person.where_when) && (
          <div className="text-center mt-3 space-y-0.5 max-w-xs">
            {person.how_we_met && (
              <p className="text-[13px] text-muted-text italic leading-snug">{person.how_we_met}</p>
            )}
            {person.where_when && (
              <p className="text-[13px] text-muted-text inline-flex items-center gap-1 leading-snug">
                <MapPin className="w-3 h-3" strokeWidth={1.75} /> {person.where_when}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons row */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-2">
          <ActionTile
            icon={CalendarPlus}
            label="Log"
            onClick={() => document.getElementById('encounters-anchor')?.scrollIntoView({ behavior: 'smooth' })}
          />
          <ActionTile
            icon={Sparkles}
            label="Brief"
            onClick={() => setBriefOpen(true)}
          />
          <ActionTile
            icon={Phone}
            label="Contact"
            onClick={handleOpenContact}
            disabled={!iosContactId || !native}
          />
        </div>
      </div>

      {/* Photos strip */}
      {person.photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 px-5 scrollbar-hide">
          {person.photos.map((photo, i) => (
            <PhotoImg key={i} path={photo} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          ))}
        </div>
      )}

      {/* ABOUT */}
      <SectionLabel>About</SectionLabel>
      <div className="px-5 mb-6">
        {editing === 'misc_notes' ? (
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4">
            <BulletTextarea value={editValue} onChange={setEditValue} rows={5} autoFocus />
            <EditActions onSave={saveEdit} onCancel={cancelEdit} />
          </div>
        ) : person.misc_notes ? (
          <button
            onClick={() => startEdit('misc_notes', person.misc_notes || '')}
            className="w-full text-left rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4 hover:border-[hsl(0_0%_100%/0.14)] transition-colors"
          >
            <BulletDisplay value={person.misc_notes} />
          </button>
        ) : (
          <button
            onClick={() => startEdit('misc_notes', '')}
            className="w-full text-left rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4 text-[14px] text-muted-text italic hover:border-[hsl(0_0%_100%/0.14)] transition-colors"
          >
            No notes yet. Tap to add some.
          </button>
        )}
      </div>

      {/* More details — preserves v1 fields until PEOPLE-03 lands */}
      <div className="px-5 mb-6">
        <button
          onClick={() => setMoreOpen(o => !o)}
          className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text hover:text-foreground transition-colors"
        >
          More details
          {moreOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {moreOpen && (
          <div className="mt-3 space-y-3 animate-fade-in">
            {/* How we met */}
            <DetailCard label="How we met">
              {editing === 'how_we_met' ? (
                <>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    rows={2}
                    autoFocus
                    className="w-full rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] px-3 py-2 text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 resize-none"
                  />
                  <EditActions onSave={saveEdit} onCancel={cancelEdit} />
                </>
              ) : (
                <InlineValue value={person.how_we_met} onClick={() => startEdit('how_we_met', person.how_we_met || '')} />
              )}
            </DetailCard>

            {/* Where we met */}
            <DetailCard label="Where we met">
              {editing === 'where_when' ? (
                <>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    rows={2}
                    autoFocus
                    className="w-full rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] px-3 py-2 text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 resize-none"
                  />
                  <EditActions onSave={saveEdit} onCancel={cancelEdit} />
                </>
              ) : (
                <InlineValue value={person.where_when} onClick={() => startEdit('where_when', person.where_when || '')} />
              )}
            </DetailCard>

            {/* Physical description (with AI button) */}
            <DetailCard
              label="Physical description"
              rightSlot={
                person.photos.length > 0 && editing !== 'physical_description' ? (
                  <div className="flex items-center gap-2">
                    {person.physical_description && <AIBadge feature="description" />}
                    <button
                      onClick={handleGenerateDescription}
                      disabled={generatingDesc}
                      className="flex items-center gap-1 px-2 py-1 rounded-sm bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                    >
                      {generatingDesc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      {generatingDesc ? 'Generating…' : 'From photo'}
                    </button>
                  </div>
                ) : null
              }
            >
              {editing === 'physical_description' ? (
                <>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] px-3 py-2 text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 resize-none"
                  />
                  <EditActions onSave={saveEdit} onCancel={cancelEdit} />
                </>
              ) : (
                <InlineValue
                  value={person.physical_description}
                  onClick={() => startEdit('physical_description', person.physical_description || '')}
                />
              )}
            </DetailCard>

            {/* Important info */}
            <DetailCard label="Important info">
              {editing === 'important_info' ? (
                <>
                  <BulletTextarea value={editValue} onChange={setEditValue} rows={3} autoFocus />
                  <EditActions onSave={saveEdit} onCancel={cancelEdit} />
                </>
              ) : person.important_info ? (
                <button
                  onClick={() => startEdit('important_info', person.important_info || '')}
                  className="w-full text-left"
                >
                  <BulletDisplay value={person.important_info} />
                </button>
              ) : (
                <InlineValue value={null} onClick={() => startEdit('important_info', '')} />
              )}
            </DetailCard>

            {/* Date met */}
            <DetailCard label="Date met" icon={CalendarIcon}>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'w-full text-left text-sm px-3 py-2 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)] transition-colors',
                      !person.date_met && 'text-muted-text italic',
                    )}
                  >
                    {person.date_met ? format(new Date(person.date_met), 'MMMM d, yyyy') : 'Tap to pick a date…'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={person.date_met ? new Date(person.date_met) : undefined}
                    onSelect={handleDateMetChange}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </DetailCard>
          </div>
        )}
      </div>

      {/* Circles toggles */}
      <SectionLabel>Circles</SectionLabel>
      <div className="px-5 mb-6">
        {circles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {circles.map(c => {
              const on = (person.circleIds || []).includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCircle(c.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-sm text-[12px] font-medium transition-colors border',
                    on
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-surface-2 text-muted-text border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)]',
                  )}
                >
                  {c.emoji ? `${c.emoji} ` : ''}{c.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-muted-text italic">No Circles yet. Create one in the Circles tab.</p>
        )}
      </div>

      {/* Events toggles */}
      <SectionLabel>Events</SectionLabel>
      <div className="px-5 mb-6">
        {events.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {events.map(e => {
              const on = (person.eventIds || []).includes(e.id);
              const tone = isValidTone(e.tone) ? e.tone : 'red';
              return (
                <button
                  key={e.id}
                  onClick={() => toggleEvent(e.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-sm text-[12px] font-medium transition-all border',
                    on
                      ? `${`tile-${tone}`} text-white border-transparent`
                      : 'bg-surface-2 text-muted-text border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)]',
                  )}
                >
                  {e.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-muted-text italic">No Events yet. Create one in the Circles tab.</p>
        )}
      </div>

      {/* Connections — "Who they know" */}
      <SectionLabel
        right={
          <button
            onClick={() => setShowConnectPicker(s => !s)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-primary"
          >
            {showConnectPicker ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showConnectPicker ? 'Cancel' : 'Add'}
          </button>
        }
      >
        Who they know
      </SectionLabel>
      <div className="px-5 mb-6 space-y-2">
        {showConnectPicker && availableToConnect.length > 0 && (
          <div className="rounded-lg bg-surface-2 border border-[hsl(0_0%_100%/0.12)] p-2 max-h-48 overflow-y-auto space-y-1">
            <p className="text-[11px] text-muted-text px-2 py-1">Link to someone on Membr:</p>
            {availableToConnect.map(p => (
              <button
                key={p.id}
                onClick={() => handleConnect(p.id)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-[hsl(0_0%_100%/0.05)] transition-colors"
              >
                <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                <span className="text-sm text-foreground">{p.name}</span>
              </button>
            ))}
          </div>
        )}
        {showConnectPicker && availableToConnect.length === 0 && (
          <p className="text-[12px] text-muted-text italic">No more people to connect.</p>
        )}

        {editing === 'known_people_notes' ? (
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4">
            <textarea
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              placeholder="e.g. They know Sarah from yoga, Mike's cousin…"
              rows={3}
              autoFocus
              className="w-full rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] px-3 py-2 text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 resize-none"
            />
            <EditActions onSave={saveEdit} onCancel={cancelEdit} />
          </div>
        ) : (person as any).known_people_notes ? (
          <button
            onClick={() => startEdit('known_people_notes', (person as any).known_people_notes || '')}
            className="w-full text-left rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4 hover:border-[hsl(0_0%_100%/0.14)] transition-colors"
          >
            <p className="text-[14px] text-foreground whitespace-pre-wrap leading-relaxed">{(person as any).known_people_notes}</p>
          </button>
        ) : (
          <button
            onClick={() => startEdit('known_people_notes', '')}
            className="w-full text-left rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4 text-[13px] text-muted-text italic hover:border-[hsl(0_0%_100%/0.14)] transition-colors"
          >
            Tap to add who they know…
          </button>
        )}

        {personConnections.length > 0 && (
          <div className="space-y-2 pt-2">
            {personConnections.map(conn => {
              const otherId = conn.person_a_id === personId ? conn.person_b_id : conn.person_a_id;
              const otherPerson = allPeople.find(p => p.id === otherId);
              if (!otherPerson) return null;
              return (
                <div
                  key={conn.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)]"
                >
                  <PersonAvatar name={otherPerson.name} photo={otherPerson.photos[0]} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">{otherPerson.name}</div>
                    {conn.note && <div className="text-[12px] text-muted-text truncate">{conn.note}</div>}
                  </div>
                  <button
                    onClick={() => handleDisconnect(conn.id)}
                    aria-label="Disconnect"
                    className="p-1.5 rounded-md text-muted-text hover:text-destructive transition-colors"
                  >
                    <UserMinus className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Encounters */}
      <div id="encounters-anchor" className="px-5">
        <SectionLabel>Encounters</SectionLabel>
      </div>
      <div className="px-5 mb-6">
        <MeetingsSection personId={personId} />
      </div>

      {/* Details */}
      <SectionLabel>Details</SectionLabel>
      <div className="px-5 space-y-3">
        <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4">
          <div className="flex items-center gap-2 text-[13px]">
            <CalendarIcon className="w-3.5 h-3.5 text-muted-text" strokeWidth={1.75} />
            <span className="text-muted-text">Added</span>
            <span className="text-foreground">{formatDistanceToNow(new Date(person.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        <ContactLinkSection
          personId={personId}
          person={person as any}
          iosContactId={iosContactId}
        />
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

/* ---------------------- helpers ---------------------- */

function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 mb-3">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">{children}</h2>
      {right}
    </div>
  );
}

function DetailCard({
  label,
  icon: Icon,
  rightSlot,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text">
          {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />}
          <span>{label}</span>
        </div>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

function InlineValue({ value, onClick }: { value: string | null | undefined; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left w-full">
      {value ? (
        <span className="text-[14px] text-foreground whitespace-pre-wrap leading-relaxed">{value}</span>
      ) : (
        <span className="text-[13px] text-muted-text italic">Tap to add…</span>
      )}
    </button>
  );
}

function EditActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={onSave}
        className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-primary text-primary-foreground text-xs font-semibold"
      >
        <Check className="w-3 h-3" /> Save
      </button>
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-muted-text text-xs font-medium"
      >
        <X className="w-3 h-3" /> Cancel
      </button>
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-1 h-[64px] rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-foreground transition-colors active:scale-[0.98]',
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:border-[hsl(0_0%_100%/0.2)] active:bg-primary active:text-primary-foreground',
      )}
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
      <span className="text-[12px] font-medium">{label}</span>
    </button>
  );
}
