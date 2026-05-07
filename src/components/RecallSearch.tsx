import { useState } from 'react';
import { Search, Loader2, X, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { usePersons } from '@/hooks/use-data';
import { PersonAvatar } from './PersonAvatar';

interface RecallSearchProps {
  onSelectPerson: (id: string) => void;
  onClose: () => void;
}

export function RecallSearch({ onSelectPerson, onClose }: RecallSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { data: persons = [] } = usePersons();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('recall-search', {
        body: { query: query.trim() },
      });
      if (error) throw error;
      setResults(data.results || []);
    } catch (e) {
      console.error('Recall search error:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getPersonById = (id: string) => persons.find(p => p.id === id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-background"
    >
      <div className="max-w-md mx-auto min-h-screen flex flex-col px-5 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:border-foreground/20 transition-colors"
          >
            <X className="w-4 h-4 text-foreground" strokeWidth={1.75} />
          </button>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Recall</span>
          <span className="w-9 h-9" />
        </div>

        {/* Hero */}
        <h1 className="font-display text-foreground leading-tight mb-1" style={{ fontSize: '32px' }}>
          Who are you looking for?
        </h1>
        <p className="text-[14px] text-muted-foreground mb-6 max-w-xs">
          Describe them the way you'd think it. Appearance, scene, what you talked about.
        </p>

        {/* Search input */}
        <div className="relative mb-5">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder='e.g. "tall guy from the gym with a beard"'
            className="w-full h-12 pl-4 pr-12 rounded-input border border-border bg-secondary text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
            autoFocus
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            aria-label="Search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-button bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} /> : <Search className="w-4 h-4" strokeWidth={1.75} />}
          </button>
        </div>

        {/* Empty hint */}
        {!searched && (
          <p className="text-[13px] text-muted-foreground italic">
            Tap search to find anyone in your Membr.
          </p>
        )}

        {/* No results */}
        {searched && !loading && results.length === 0 && (
          <p className="text-[14px] text-muted-foreground mt-2">
            No one matches that. Try a different description.
          </p>
        )}

        {/* Results */}
        <div className="flex flex-col gap-2 mt-1 pb-8">
          {results.map((r, i) => {
            const person = getPersonById(r.id);
            if (!person) return null;
            return (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, scale: i === 0 ? [0.97, 1.04, 1] : 1 }}
                transition={{ delay: i * 0.04, duration: i === 0 ? 0.4 : 0.25 }}
                onClick={() => onSelectPerson(r.id)}
                className={`flex items-start gap-3 p-3 surface-card text-left ${
                  i === 0 ? 'border-primary/40' : ''
                }`}
              >
                <PersonAvatar name={person.name} photo={person.photos?.[0]} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-foreground leading-tight" style={{ fontSize: '18px' }}>
                    {person.name}
                  </p>
                  <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{r.reason}</p>
                </div>
                <ArrowRight className={`w-4 h-4 mt-1 flex-shrink-0 ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={i === 0 ? 2 : 1.75} />
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
