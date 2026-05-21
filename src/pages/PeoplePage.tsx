import { useState, useMemo } from 'react';
import { usePersons, useCircles, usePersonCircles, useEvents, usePersonEvents } from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { SwipeRow } from '@/components/SwipeRow';
import { LogEncounterModal } from '@/components/LogEncounterModal';
import { MeetingBriefModal } from '@/components/MeetingBriefModal';
import { Skeleton } from '@/components/ui/skeleton';
import { PersonRowSkeleton } from '@/components/skeletons';
import { Search, ListFilter, ChevronRight, Check, CalendarPlus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidTone } from '@/lib/store';

interface PeoplePageProps {
  onSelectPerson: (id: string) => void;
  embedded?: boolean;
}

type SortKey = 'recent' | 'az' | 'circle';

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recently added',
  az: 'Alphabetical A–Z',
  circle: 'By circle',
};

type FilterKey = string | null;

export function PeoplePage({ onSelectPerson, embedded = false }: PeoplePageProps) {
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

  const sortMenu = (
    <div className="relative">
      <button
        onClick={() => setSortOpen((v) => !v)}
        onBlur={() => setTimeout(() => setSortOpen(false), 150)}
        aria-label="Sort"
        className="glass-pill !h-11 !w-11 !p-0 flex items-center justify-center text-foreground active:scale-95 transition-transform"
      >
        <ListFilter className="w-4 h-4" strokeWidth={1.75} />
      </button>
      {sortOpen && (
        <div className="glass absolute right-0 top-full mt-2 w-52 z-20 p-1.5">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => {
                setSortBy(key);
                setSortOpen(false);
              }}
              className={cn(
                'w-full text-left px-3 py-2.5 text-[13px] rounded-md flex items-center justify-between',
                sortBy === key ? 'text-foreground' : 'text-[hsl(var(--foreground)/0.6)]',
              )}
            >
              {SORT_LABELS[key]}
              {sortBy === key && <Check className="w-3.5 h-3.5 text-primary" strokeWidth={2} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="pb-8 animate-fade-in">
        {!embedded && (
          <div className="sticky top-0 z-20 flex items-center justify-between px-5 pt-3 pb-3 mb-1">
            <span className="w-11" />
            <h1 className="font-display text-[20px] text-foreground">People</h1>
            <span className="w-11" />
          </div>
        )}
        <div className="px-5 mb-3">
          <Skeleton className="h-11 w-full rounded-2xl bg-[hsl(0_0%_100%/0.05)]" />
        </div>
        <div className="px-5 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <PersonRowSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8 animate-fade-in">
      {!embedded && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 pt-3 pb-3 mb-1">
          <span className="w-11" />
          <h1 className="font-display text-[20px] text-foreground">People</h1>
          <div>{sortMenu}</div>
        </div>
      )}

      <div className="px-5 mb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--foreground)/0.45)]"
              strokeWidth={1.75}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search names and notes…"
              className="glass-input w-full h-11 pl-10 pr-3 text-sm"
            />
          </div>
          {embedded && sortMenu}
        </div>
      </div>

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

      {filtered.length === 0 ? (
        <div className="px-5">
          <div className="glass p-8 text-center">
            <p className="text-sm font-display-italic text-[hsl(var(--foreground)/0.6)]">
              {people.length === 0
                ? "No people yet. Tap the red + to add someone."
                : 'No results.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-5 space-y-2.5">
          {filtered.map((p) => {
            const cIds = personCircleMap[p.id] || [];
            const cs = cIds.map((id) => circles.find((c) => c.id === id)).filter(Boolean);
            const noteSnippet = p.misc_notes
              ? p.misc_notes.replace(/^\s*[•\-*]\s*/gm, '').trim().split('\n')[0]?.slice(0, 80)
              : null;
            const meta = cs.length > 0
              ? cs.map((c) => c!.name).join(' · ')
              : p.where_when || null;
            return (
              <SwipeRow
                key={p.id}
                className="rounded-2xl"
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
                  className="glass w-full flex items-center gap-3 p-3.5 text-left"
                >
                  <PersonAvatar name={p.name} photo={p.photos[0]} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[17px] text-foreground truncate leading-tight">
                      {p.name}
                    </div>
                    {noteSnippet && (
                      <div className="font-display-italic text-[12px] text-[hsl(var(--foreground)/0.65)] truncate leading-snug mt-0.5">
                        {noteSnippet}
                      </div>
                    )}
                    {meta && (
                      <div className="text-[11px] text-[hsl(var(--foreground)/0.45)] truncate mt-0.5">
                        {meta}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[hsl(var(--foreground)/0.45)] shrink-0" strokeWidth={1.75} />
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
  tone?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'glass-pill shrink-0 whitespace-nowrap transition-colors',
        active && tone && tone !== 'red'
          ? `tile-${tone} text-white !border-transparent`
          : active
            ? '!bg-[rgba(224,48,48,0.22)] !border-[rgba(224,48,48,0.40)] text-foreground'
            : 'text-[hsl(var(--foreground)/0.7)]',
      )}
    >
      {label}
    </button>
  );
}
