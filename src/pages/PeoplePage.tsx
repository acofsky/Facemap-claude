import { useState, useMemo } from 'react';
import { usePersons, useCircles, usePersonCircles } from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Search, LayoutGrid, List, Loader2, ArrowDownAZ, Clock } from 'lucide-react';
import { resolveCircleColor } from '@/lib/circle-colors';

interface PeoplePageProps {
  onSelectPerson: (id: string) => void;
}

export function PeoplePage({ onSelectPerson }: PeoplePageProps) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filterCircle, setFilterCircle] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'az'>('recent');

  const { data: people = [], isLoading } = usePersons();
  const { data: circles = [] } = useCircles();
  const { data: personCircles = [] } = usePersonCircles();

  const personCircleMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    personCircles.forEach(pc => {
      if (!map[pc.person_id]) map[pc.person_id] = [];
      map[pc.person_id].push(pc.circle_id);
    });
    return map;
  }, [personCircles]);

  const filtered = useMemo(() => {
    let result = people;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.misc_notes?.toLowerCase().includes(q) ||
        p.important_info?.toLowerCase().includes(q)
      );
    }
    if (filterCircle) {
      result = result.filter(p => (personCircleMap[p.id] || []).includes(filterCircle));
    }
    if (sortBy === 'az') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [people, search, filterCircle, sortBy, personCircleMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      {/* Header — asymmetric */}
      <div className="flex items-baseline justify-between mb-6 pr-14">
        <h1 className="font-display text-foreground leading-none" style={{ fontSize: '36px' }}>
          People
        </h1>
        <span className="text-[13px] text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'shown' : 'shown'}
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or notes..."
          className="w-full pl-10 pr-4 py-2.5 rounded-input bg-secondary border border-border text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
        />
      </div>

      {/* Sort + view toggle row */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setSortBy(sortBy === 'recent' ? 'az' : 'recent')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-button-sm bg-secondary border border-border text-[12px] font-medium text-foreground hover:border-foreground/20 transition-colors"
        >
          {sortBy === 'recent' ? <Clock className="w-3 h-3" strokeWidth={1.75} /> : <ArrowDownAZ className="w-3 h-3" strokeWidth={1.75} />}
          {sortBy === 'recent' ? 'Recent' : 'A–Z'}
        </button>
        <div className="flex rounded-button-sm bg-secondary border border-border p-0.5">
          <button
            onClick={() => setView('list')}
            className={`p-1.5 rounded-button-sm transition-colors ${view === 'list' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground'}`}
            aria-label="List view"
          >
            <List className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`p-1.5 rounded-button-sm transition-colors ${view === 'grid' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground'}`}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Circle filter pills */}
      {circles.length > 0 && (
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
          <button
            onClick={() => setFilterCircle(null)}
            className={`px-3 py-1.5 rounded-button-sm text-[12px] font-medium whitespace-nowrap transition-colors ${
              !filterCircle
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {circles.map(c => {
            const isActive = filterCircle === c.id;
            const colorKey = resolveCircleColor(c.color, c.id);
            return (
              <button
                key={c.id}
                onClick={() => setFilterCircle(isActive ? null : c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-button-sm text-[12px] font-medium whitespace-nowrap transition-colors border ${
                  isActive
                    ? 'bg-secondary border-primary text-foreground'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-button-sm flex-shrink-0"
                  style={{ background: `var(--gradient-tile-${colorKey})` }}
                />
                <span>{c.emoji}</span>
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-[14px]">
            {people.length === 0 ? 'No people yet. Tap + to add someone.' : 'No results found.'}
          </p>
        </div>
      ) : view === 'list' ? (
        <div>
          {filtered.map(p => {
            const cIds = personCircleMap[p.id] || [];
            return (
              <button
                key={p.id}
                onClick={() => onSelectPerson(p.id)}
                className="w-full flex items-center gap-3 py-3 hover:bg-foreground/[0.03] transition-colors border-b border-border last:border-b-0"
              >
                <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                <div className="flex-1 text-left min-w-0">
                  <div className="text-[15px] font-medium text-foreground truncate">{p.name}</div>
                  <div className="text-[13px] text-muted-foreground truncate">
                    {p.misc_notes || p.important_info || 'No notes yet'}
                  </div>
                </div>
                {cIds.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0">
                    {cIds.slice(0, 3).map(cid => {
                      const circle = circles.find(c => c.id === cid);
                      if (!circle) return null;
                      const colorKey = resolveCircleColor(circle.color, circle.id);
                      return (
                        <span
                          key={cid}
                          className="w-2 h-2 rounded-full"
                          style={{ background: `var(--gradient-tile-${colorKey})` }}
                          title={circle.name}
                        />
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => onSelectPerson(p.id)}
              className="flex flex-col items-center gap-2"
            >
              <PersonAvatar name={p.name} photo={p.photos[0]} size="md" />
              <span className="text-[13px] font-medium text-foreground truncate w-full text-center">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
