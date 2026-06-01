import { useMemo, useState } from 'react';
import { usePersons } from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { EncounterSheet } from '@/components/EncounterSheet';
import { Search, CalendarDays, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/hooks/use-scroll-lock';

interface LogEncounterModalProps {
  open: boolean;
  onClose: () => void;
}

export function LogEncounterModal({ open, onClose }: LogEncounterModalProps) {
  // This modal holds the scroll lock for the whole flow (picker + the
  // EncounterSheet it hands off to), so the sheet runs with lockScroll=false.
  useScrollLock(open);
  const { data: people = [] } = usePersons();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string; photo?: string } | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
    return list.slice(0, 30);
  }, [query, people]);

  const reset = () => {
    setQuery('');
    setSelected(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!open) return null;

  // Stage 2: a person is picked — hand off to the shared encounter sheet,
  // which owns the date/place/notes fields plus people tagging. Back returns
  // to the picker; close dismisses the whole modal.
  if (selected) {
    return (
      <EncounterSheet
        ownerPersonId={selected.id}
        viewerPersonId={selected.id}
        ownerName={selected.name}
        ownerPhoto={selected.photo}
        onBack={() => setSelected(null)}
        lockScroll={false}
        onClose={handleClose}
      />
    );
  }

  const inputClass = 'glass-input w-full h-11 px-3.5 text-sm';

  // Stage 1: pick who you ran into.
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={handleClose} />
      <div
        className="kb-aware-sheet fixed left-0 right-0 mx-auto w-full max-w-md glass-sheet rounded-t-2xl p-5 z-[60] safe-bottom animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md tile-red flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-white" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl text-foreground leading-tight tracking-[-0.02em]">Log encounter</h3>
            <p className="text-[12px] text-muted-text">Pick someone you ran into</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="w-9 h-9 -mr-1 rounded-md flex items-center justify-center hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" strokeWidth={1.75} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className={cn(inputClass, 'pl-10')}
          />
        </div>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {matches.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected({ id: p.id, name: p.name, photo: p.photos[0] })}
              className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-[hsl(0_0%_100%/0.04)] transition-colors"
            >
              <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
              <span className="text-sm text-foreground flex-1 text-left truncate font-medium">{p.name}</span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="text-[12px] text-muted-text italic text-center py-6">
              {query.trim() ? `No one matches "${query}"` : 'No people yet'}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
