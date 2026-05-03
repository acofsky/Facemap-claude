import { useState } from 'react';
import { Search, Loader2, X, Sparkles } from 'lucide-react';
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
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
    >
      <div className="max-w-md mx-auto min-h-screen flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onClose} className="p-2 -ml-2 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Recall Search</h2>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-4">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder='e.g. "tall guy from the gym with a beard"'
            className="w-full h-12 pl-4 pr-12 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>

        {/* Hint */}
        {!searched && (
          <p className="text-sm text-muted-foreground text-center mt-8">
            Describe anyone you've added — by appearance, where you met, notes, or anything you remember.
          </p>
        )}

        {/* Results */}
        {searched && !loading && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-8">
            No matches found. Try a different description.
          </p>
        )}

        <div className="flex flex-col gap-3 mt-2">
          {results.map((r, i) => {
            const person = getPersonById(r.id);
            if (!person) return null;
            return (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelectPerson(r.id)}
                className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors text-left"
              >
                <PersonAvatar name={person.name} photo={person.photos?.[0]} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{person.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.reason}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
