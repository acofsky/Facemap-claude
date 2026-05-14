import { useState, useMemo } from 'react';
import { usePersons, useCircles, usePersonCircles, useEvents, usePersonEvents } from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { SwipeRow } from '@/components/SwipeRow';
import { LogEncounterModal } from '@/components/LogEncounterModal';
import { MeetingBriefModal } from '@/components/MeetingBriefModal';
import { Search, Loader2, ListFilter, ChevronRight, ChevronDown, CalendarPlus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidTone } from '@/lib/store';

interface PeoplePageProps {
  onSelectPerson: (id: string) => void;
}

type SortKey = 'recent' | 'az' | 'circle';

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recently Added',
  az: 'Alphabetical A–Z',
  circle: 'By Circle',
};

// Active filter is one chip at a time: 'all' or `${'circle'|'event'}:${id}`.
type FilterKey = string | null;

export function PeoplePage({ onSelectPerson }: PeoplePageProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>(null);
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [briefFor, setBriefFor] = useState<{ id: string; name: string } | null>(null);

  const { data: people = [], isLoading } = usePersons();
  const { data: circles = [] } = useCircles();
  const { data: personCircles = [] } = usePersonCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });
  const { data: personEvents = [] } = usePersonEvents();

  const personCircleMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    personCircles.forEach((pc) => {
      if (!map[pc.person_id]) map[pc.person_id] = [];
      map[pc.person_id].push(pc.circle_id);
    });
    return map;
  }, [personCircles]);

  const personEventMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    personEvents.forEach((pe) => {
      if (!map[pe.person_id]) map[pe.person_id] = [];
      map[pe.person_id].push(pe.event_id);
    });
    return map;
  }, [personEvents]);

  const filtered = useMemo(() => {
    let result = people;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.misc_notes?.toLowerCase().includes(q) ||
          p.important_info?.toLowerCase().includes(q),
      );
    }
    if (filter) {
      const [kind, id] = filter.split(':');
      if (kind === 'circle') {
        result = result.filter((p) => (personCircleMap[p.id] || []).includes(id));
      } else if (kind === 'event') {
        result = result.filter((p) => (personEventMap[p.id] || []).includes(id));
      }
    }
    if (sortBy === 'az') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'circle') {
      result = [...result].sort((a, b) => {
        const ac = personCircleMap[a.id]?.[0] ?? '~';
        const bc = personCircleMap[b.id]?.[0] ?? '~';
        return ac.localeCompare(bc) || a.name.localeCompare(b.name);
      });
    }
    return result;
  }, [people, search, filter, sortBy, personCircleMap, personEventMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-8 animate-fade-in">
      {/* Nav bar */}
      <div className="sticky top-0 z-20 bg-background flex items-center justify-between px-5 pt-3 pb-3 mb-1">
        <span className="w-9" />
        <h1 className="text-[17px] font-semibold text-foreground">People</h1>
        <div className="relative">
          <button
            onClick={() => setSortOpen((v) => !v)}
            onBlur={() => setTimeout(() => setSortOpen(false), 150)}
            aria-label="Sort"
            className="w-9 h-9 -mr-2 flex items-center justify-center text-foreground active:scale-95 transition-transform"
          >
            <ListFilter className="w-5 h-5" strokeWidth={1.75} />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] py-1 z-20 shadow-xl">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setSortBy(key);
                    setSortOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 text-sm hover:bg-[hsl(0_0%_100%/0.04)] flex items-center justify-between',
                    sortBy === key ? 'text-foreground' : 'text-muted-text',
                  )}
                >
                  {SORT_LABELS[key]}
                  {sortBy === key && <ChevronDown className="w-3 h-3 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inline search */}
      <div className="px-5 mb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search names and notes…"
            className="w-full h-11 pl-10 pr-3 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
          />
        </div>
      </div>

      {/* Filter chips */}
      {(circles.length > 0 || events.length > 0) && (
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 px-5 scrollbar-hide">
          <FilterChip active={!filter} onClick={() => setFilter(null)} label="All" />
          {circles.map((c) => {
            const key = `circle:${c.id}`;
            return (
              <FilterChip
                key={key}
                active={filter === key}
                onClick={() => setFilter(filter === key ? null : key)}
                label={`${c.emoji ? `${c.emoji} ` : ''}${c.name}`}
              />
            );
          })}
          {events.map((e) => {
            const key = `event:${e.id}`;
            const tone = isValidTone(e.tone) ? e.tone : 'red';
            return (
              <FilterChip
                key={key}
                active={filter === key}
                onClick={() => setFilter(filter === key ? null : key)}
                label={e.name}
                tone={tone}
              />
            );
          })}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="px-5">
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-8 text-center">
            <p className="text-sm text-muted-text">
              {people.length === 0
                ? 'No people yet. Tap the red + button to add someone.'
                : 'No results.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-5 space-y-2">
          {filtered.map((p) => {
            const cIds = personCircleMap[p.id] || [];
            const cs = cIds.map((id) => circles.find((c) => c.id === id)).filter(Boolean);
            return (
              <SwipeRow
                key={p.id}
                className="rounded-lg"
                actions={[
                  {
                    key: 'log',
                    label: 'Log',
                    background: 'hsl(var(--warning))',
                    icon: <CalendarPlus className="w-4 h-4" strokeWidth={1.75} />,
                    onTap: () => setLogOpen(true),
                  },
                  {
                    key: 'brief',
                    label: 'Brief',
                    background: 'hsl(var(--primary))',
                    icon: <Sparkles className="w-4 h-4" strokeWidth={1.75} />,
                    onTap: () => setBriefFor({ id: p.id, name: p.name }),
                  },
                ]}
              >
                <button
                  onClick={() => onSelectPerson(p.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)] transition-colors text-left"
                >
                  <PersonAvatar name={p.name} photo={p.photos[0]} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-foreground truncate">{p.name}</div>
                    {cs.length > 0 ? (
                      <div className="text-[12px] text-muted-text truncate">
                        {cs.map((c) => c!.name).join(' · ')}
                      </div>
                    ) : (
                      p.misc_notes && (
                        <div className="text-[12px] text-muted-text truncate">
                          {p.misc_notes.replace(/^\s*[•\-*]\s*/gm, '').slice(0, 60)}
                        </div>
                      )
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-text shrink-0" strokeWidth={1.75} />
                </button>
              </SwipeRow>
            );
          })}
        </div>
      )}

      <LogEncounterModal open={logOpen} onClose={() => setLogOpen(false)} />
      {briefFor && (
        <MeetingBriefModal
          personId={briefFor.id}
          personName={briefFor.name}
          onClose={() => setBriefFor(null)}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  /** Event chips get a gradient when active; circle/all chips stay Primary Red. */
  tone?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 px-3 h-8 inline-flex items-center rounded-sm text-[12px] font-medium whitespace-nowrap transition-colors border',
        active
          ? tone
            ? `tile-${tone} text-white border-transparent`
            : 'bg-primary text-primary-foreground border-primary'
          : 'bg-surface-2 text-muted-text border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)]',
      )}
    >
      {label}
    </button>
  );
}
