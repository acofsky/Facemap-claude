import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, ImagePlus, ChevronDown, ChevronUp } from 'lucide-react';
import { useCreatePerson, useUploadPhoto, useCircles, useSetPersonCircles, useCreateMeeting } from '@/hooks/use-data';
import { format } from 'date-fns';

interface QuickAddSheetProps {
  onClose: () => void;
}

export function QuickAddSheet({ onClose }: QuickAddSheetProps) {
  const [name, setName] = useState('');
  const [whereWhen, setWhereWhen] = useState('');
  const [dateMet, setDateMet] = useState('');
  const [note, setNote] = useState('');
  // More details
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
    // Auto-create the first meeting
    await createMeeting.mutateAsync({
      person_id: person.id,
      meeting_date: dateMet || format(new Date(), 'yyyy-MM-dd'),
      place: whereWhen || undefined,
      notes: '• First encounter',
    });
    onClose();
  };

  const saving = createPerson.isPending || uploadPhoto.isPending;

  const inputClass = "w-full px-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md bg-card rounded-t-3xl z-50 warm-shadow-lg max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="font-display text-xl text-foreground">Quick Add</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6 pt-4 space-y-3">
          {/* Photo */}
          <div className="flex justify-center">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden hover:border-primary transition-colors"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          {/* 4 core fields */}
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name..." className={inputClass} autoFocus />
          <input value={whereWhen} onChange={e => setWhereWhen(e.target.value)} placeholder="Where we met..." className={inputClass} />

          {/* When — date input with Today button */}
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
              className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                dateMet === format(new Date(), 'yyyy-MM-dd')
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Today
            </button>
          </div>

          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notes..." rows={2} className={`${inputClass} resize-none`} />

          {/* Circles */}
          {circles.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Circles</span>
              <div className="flex flex-wrap gap-1.5">
                {circles.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCircle(c.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCircles.includes(c.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {c.emoji} {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Expand for more fields */}
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 text-xs text-primary font-medium mx-auto"
          >
            {showMore ? 'Less details' : 'More details'}
            {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showMore && (
            <div className="space-y-3 animate-fade-in">
              <input value={howWeMet} onChange={e => setHowWeMet(e.target.value)} placeholder="How we met..." className={inputClass} />
              <textarea value={physicalDescription} onChange={e => setPhysicalDescription(e.target.value)} placeholder="Physical description..." rows={2} className={`${inputClass} resize-none`} />
              <textarea value={importantInfo} onChange={e => setImportantInfo(e.target.value)} placeholder="Important info..." rows={2} className={`${inputClass} resize-none`} />
              <textarea value={knownPeopleNotes} onChange={e => setKnownPeopleNotes(e.target.value)} placeholder="Who they know..." rows={2} className={`${inputClass} resize-none`} />
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-1 block">Reminder date</span>
                <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className={inputClass} />
              </div>
              <input value={reminderNote} onChange={e => setReminderNote(e.target.value)} placeholder="Reminder note..." className={inputClass} />
            </div>
          )}
        </div>

        {/* Save button pinned at bottom */}
        <div className="p-6 pt-3 border-t border-border">
          <button
            onClick={handleSave}
            disabled={!hasAnything || saving}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base disabled:opacity-40 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            {saving ? 'Saving...' : 'Save Person'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
