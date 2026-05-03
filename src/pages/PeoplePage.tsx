import { useState, useMemo } from 'react';
import { usePersons, useCircles, usePersonCircles } from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Search, LayoutGrid, List, Loader2, ArrowDownAZ, Clock } from 'lucide-react';

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
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      <div className="flex items-end justify-between mb-5 pr-14">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Your network</p>
          <h1 className="text-4xl font-display text-foreground leading-tight">People</h1>
        </div>
        <div className="text-right">
          <div className="text-2xl font-display text-foreground leading-none">{filtered.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{filtered.length === 1 ? 'shown' : 'shown'}</div>
        </div>
      </div>

      {/* Search + view toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or notes..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
          />
        </div>
        <div className="flex rounded-2xl bg-white/5 border border-white/10 p-1">
          <button
            onClick={() => setView('list')}
            className={`p-2 rounded-xl transition-colors ${view === 'list' ? 'bg-white/10 text-foreground' : 'text-muted-foreground'}`}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`p-2 rounded-xl transition-colors ${view === 'grid' ? 'bg-white/10 text-foreground' : 'text-muted-foreground'}`}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setSortBy(sortBy === 'recent' ? 'az' : 'recent')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-foreground hover:bg-white/10 transition-colors"
        >
          {sortBy === 'recent' ? <Clock className="w-3 h-3" /> : <ArrowDownAZ className="w-3 h-3" />}
          {sortBy === 'recent' ? 'Recent' : 'A–Z'}
        </button>
        <span className="text-[11px] text-muted-foreground">tap to switch</span>
      </div>

      {/* Circle filter pills */}
      {circles.length > 0 && (
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
          <button
            onClick={() => setFilterCircle(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              !filterCircle
                ? 'bg-primary text-primary-foreground shadow-glow-primary'
                : 'bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {circles.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCircle(filterCircle === c.id ? null : c.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filterCircle === c.id
                  ? 'bg-primary text-primary-foreground shadow-glow-primary'
                  : 'bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{c.emoji}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-3xl warm-shadow">
          <p className="text-muted-foreground text-sm">
            {people.length === 0 ? 'No people yet. Tap + to add someone!' : 'No results found.'}
          </p>
        </div>
      ) : view === 'list' ? (
        <div className="rounded-3xl warm-shadow overflow-hidden divide-y divide-white/5">
          {filtered.map(p => {
            const cIds = personCircleMap[p.id] || [];
            return (
              <button
                key={p.id}
                onClick={() => onSelectPerson(p.id)}
                className="w-full flex items-center gap-3 p-3.5 hover:bg-white/[0.04] transition-colors"
              >
                <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-foreground truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.misc_notes || p.important_info || 'No notes yet'}
                  </div>
                </div>
                {cIds.length > 0 && (
                  <div className="flex gap-1">
                    {cIds.slice(0, 3).map(cid => {
                      const circle = circles.find(c => c.id === cid);
                      return circle ? (
                        <span key={cid} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs">
                          {circle.emoji}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => onSelectPerson(p.id)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl warm-shadow hover:scale-[1.03] transition-transform"
            >
              <PersonAvatar name={p.name} photo={p.photos[0]} size="md" />
              <span className="text-xs font-medium text-foreground truncate w-full text-center">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
