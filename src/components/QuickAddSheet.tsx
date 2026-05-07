import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, ImagePlus, ChevronDown, ChevronUp } from 'lucide-react';
import { useCreatePerson, useUploadPhoto, useCircles, useSetPersonCircles, useCreateMeeting } from '@/hooks/use-data';
import { format } from 'date-fns';
import { resolveCircleColor } from '@/lib/circle-colors';

interface QuickAddSheetProps {
  onClose: () => void;
}

export function QuickAddSheet({ onClose }: QuickAddSheetProps) {
  const [name, setName] = useState('');
  const [whereWhen, setWhereWhen] = useState('');
  const [dateMet, setDateMet] = useState('');
  const [note, setNote] = useState('');
  const [howWeMet, setHowWeMet] = useState('');
  const [physicalDescription, setPhysicalDescription] = useState('');
  const [importantInfo, setImportantInfo] = useState('');
  const [knownPeopleNotes, setKnownPeopleNotes] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showMore, setShowMore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createPerson = useCreatePerson();
  const uploadPhoto = useUploadPhoto();
  const setPersonCircles = useSetPersonCircles();
  const createMeeting = useCreateMeeting();
  const { data: circles = [] } = useCircles();

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleCircle = (id: string) => {
    setSelectedCircles(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const setToday = () => {
    setDateMet(format(new Date(), 'yyyy-MM-dd'));
  };

  const hasAnything = name || photoFile || note || howWeMet || whereWhen || dateMet || physicalDescription || importantInfo || knownPeopleNotes || reminderDate || reminderNote || selectedCircles.length > 0;

  const handleSave = async () => {
    if (!hasAnything) return;
    let photos: string[] = [];
    if (photoFile) {
      const url = await uploadPhoto.mutateAsync(photoFile);
      photos = [url];
    }
    const person = await createPerson.mutateAsync({
      name: name || 'Unknown',
      photos,
      how_we_met: howWeMet || undefined,
      where_when: whereWhen || undefined,
      date_met: dateMet || undefined,
      physical_description: physicalDescription || undefined,
      important_info: importantInfo || undefined,
      known_people_notes: knownPeopleNotes || undefined,
      misc_notes: note || undefined,
      reminder_date: reminderDate || undefined,
      reminder_note: reminderNote || undefined,
    });
    if (selectedCircles.length > 0) {
      await setPersonCircles.mutateAsync({ personId: person.id, circleIds: selectedCircles });
    }
    await createMeeting.mutateAsync({
      person_id: person.id,
      meeting_date: dateMet || format(new Date(), 'yyyy-MM-dd'),
      place: whereWhen || undefined,
      notes: '• First encounter',
    });
    onClose();
  };

  const saving = createPerson.isPending || uploadPhoto.isPending;

  const inputClass = "w-full px-4 py-2.5 rounded-input bg-card border border-border text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/70 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md bg-secondary rounded-t-sheet-top z-50 max-h-[88vh] flex flex-col border-t border-border shadow-[0_-4px_40px_rgba(0,0,0,0.8)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="font-display text-foreground" style={{ fontSize: '24px' }}>Add a person</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pt-3 pb-2 space-y-3">
          {/* Photo */}
          <div className="flex justify-center pb-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-full bg-card border border-dashed border-border flex items-center justify-center overflow-hidden hover:border-foreground/30 transition-colors"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-6 h-6 text-muted-foreground" strokeWidth={1.75} />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name..." className={inputClass} autoFocus />
          <input value={whereWhen} onChange={e => setWhereWhen(e.target.value)} placeholder="Where we met..." className={inputClass} />

          <div className="flex gap-2">
            <input
              type="date"
              value={dateMet}
              onChange={e => setDateMet(e.target.value)}
              className={`${inputClass} flex-1`}
              placeholder="When..."
            />
            <button
              type="button"
              onClick={setToday}
              className={`px-3 py-2.5 rounded-button text-[13px] font-medium transition-colors whitespace-nowrap border ${
                dateMet === format(new Date(), 'yyyy-MM-dd')
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              Today
            </button>
          </div>

          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notes..." rows={2} className={`${inputClass} resize-none`} />

          {circles.length > 0 && (
            <div className="pt-1">
              <span className="text-[12px] font-medium text-muted-foreground mb-2 block">Circles</span>
              <div className="flex flex-wrap gap-1.5">
                {circles.map(c => {
                  const active = selectedCircles.includes(c.id);
                  const colorKey = resolveCircleColor(c.color, c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCircle(c.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-button-sm text-[12px] font-medium transition-colors border ${
                        active
                          ? 'bg-card border-primary text-foreground'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
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
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 text-[12px] text-primary font-medium mx-auto pt-2"
          >
            {showMore ? 'Less details' : 'More details'}
            {showMore ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.75} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />}
          </button>

          {showMore && (
            <div className="space-y-3 animate-fade-in pt-1">
              <input value={howWeMet} onChange={e => setHowWeMet(e.target.value)} placeholder="How we met..." className={inputClass} />
              <textarea value={physicalDescription} onChange={e => setPhysicalDescription(e.target.value)} placeholder="Physical description..." rows={2} className={`${inputClass} resize-none`} />
              <textarea value={importantInfo} onChange={e => setImportantInfo(e.target.value)} placeholder="Important info..." rows={2} className={`${inputClass} resize-none`} />
              <textarea value={knownPeopleNotes} onChange={e => setKnownPeopleNotes(e.target.value)} placeholder="Who they know..." rows={2} className={`${inputClass} resize-none`} />
              <div>
                <span className="text-[12px] font-medium text-muted-foreground mb-1 block">Reminder date</span>
                <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className={inputClass} />
              </div>
              <input value={reminderNote} onChange={e => setReminderNote(e.target.value)} placeholder="Reminder note..." className={inputClass} />
            </div>
          )}
        </div>

        {/* Save button pinned at bottom */}
        <div className="p-5 pt-3 border-t border-border">
          <button
            onClick={handleSave}
            disabled={!hasAnything || saving}
            className="w-full py-3 rounded-button bg-primary text-primary-foreground text-[15px] font-semibold disabled:opacity-40 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
