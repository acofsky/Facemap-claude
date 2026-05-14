import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { DragHandle } from '@/components/DragHandle';
import { PersonAvatar } from '@/components/PersonAvatar';
import { usePersons } from '@/hooks/use-data';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface PersonPickerSheetProps {
  /** Sheet header text. */
  title: string;
  /** Sub-line below the header. */
  subtitle?: string;
  /** People IDs to hide from the list (e.g. existing Circle members). */
  excludePersonIds?: string[];
  /** Closes the sheet after the first pick. Default false — stays open for multi-add. */
  closeOnPick?: boolean;
  /** Called when the user taps a row. */
  onPick: (personId: string, name: string) => void;
  /** Called on X tap, backdrop tap, or drag-down dismiss. */
  onClose: () => void;
}

/**
 * Reusable bottom-sheet picker for selecting an existing person — used by
 * Circle Detail "Add", Event Detail "Add", and the Home page Brief CTA.
 * Local string search across name + misc_notes. Stays open for multi-add
 * by default so users can rapidly stack members.
 */
export function PersonPickerSheet({
  title,
  subtitle,
  excludePersonIds = [],
  closeOnPick = false,
  onPick,
  onClose,
}: PersonPickerSheetProps) {
  const { data: people = [] } = usePersons();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const ex = new Set(excludePersonIds);
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !ex.has(p.id))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.misc_notes?.toLowerCase().includes(q) ||
          p.important_info?.toLowerCase().includes(q)
        );
      })
      .slice(0, 100);
  }, [people, excludePersonIds, query]);

  const handlePick = (personId: string, name: string) => {
    haptics.light();
    onPick(personId, name);
    if (closeOnPick) onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 400 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 || info.velocity.y > 500) {
            haptics.light();
            onClose();
          }
        }}
        className="kb-aware-sheet fixed left-0 right-0 mx-auto w-full max-w-md bg-surface-2 rounded-t-2xl border border-[hsl(0_0%_100%/0.12)] z-50 max-h-[88dvh] flex flex-col safe-bottom"
      >
        <DragHandle />
        <div className="flex items-start justify-between px-5 pt-2 pb-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-foreground tracking-[-0.02em] truncate">{title}</h2>
            {subtitle && <p className="text-[12px] text-muted-text mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text"
              strokeWidth={1.75}
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
              className={cn(
                'w-full h-11 pl-10 pr-3.5 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.08)]',
                'text-base text-foreground placeholder:text-muted-text focus:outline-none',
                'focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors',
              )}
            />
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 px-5 pb-5">
          {filtered.length === 0 ? (
            <p className="text-[13px] text-muted-text italic text-center py-8">
              {query ? `No one matches "${query}"` : 'No people available'}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePick(p.id, p.name)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-[hsl(0_0%_100%/0.04)] transition-colors text-left"
                >
                  <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                  <span className="text-sm text-foreground flex-1 min-w-0 truncate font-medium">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
