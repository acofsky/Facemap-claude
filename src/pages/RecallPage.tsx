import { useRef, useState } from "react";
import { Search, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { usePersons } from "@/hooks/use-data";
import { PersonAvatar } from "@/components/PersonAvatar";
import { AIBadge } from "@/components/AIBadge";

interface RecallPageProps {
  onSelectPerson: (id: string) => void;
}

/**
 * Recall — the dedicated semantic-search tab introduced in M2.
 * Ranking is best semantic match first, recency only as tiebreaker (Q4).
 */
export function RecallPage({ onSelectPerson }: RecallPageProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { data: persons = [] } = usePersons();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("recall-search", {
        body: { query: trimmed },
      });
      if (error) throw error;
      setResults(data?.results || []);
    } catch (e) {
      console.error("Recall search error:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getPersonById = (id: string) => persons.find((p) => p.id === id);
  const hasInput = query.trim().length > 0;

  return (
    <div className="px-5 pt-5 pb-8 animate-fade-in">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-widest text-muted-text mb-1">Recall</p>
        <h1 className="font-display text-3xl text-foreground tracking-[-0.02em] leading-tight">
          Find anyone you've met
        </h1>
      </header>

      <div className="relative mb-2">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" strokeWidth={1.75} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder='e.g. "tall guy from the gym with a beard"'
          className="w-full h-11 pl-10 pr-24 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-foreground placeholder:text-muted-text text-sm focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !hasInput}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 active:scale-[0.97] transition-transform inline-flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />}
          Recall
        </button>
      </div>

      <AIBadge feature="search" />

      {!searched && (
        <p className="text-sm text-muted-text leading-relaxed mt-8">
          Describe anyone you've added — by appearance, where you met, notes, or anything you remember.
        </p>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="text-sm text-muted-text text-center mt-12">
          No matches found. Try a different description.
        </p>
      )}

      <div className="flex flex-col gap-2 mt-5">
        {results.map((r, i) => {
          const person = getPersonById(r.id);
          if (!person) return null;
          return (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelectPerson(r.id)}
              className="flex items-start gap-3 p-3.5 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)] transition-colors text-left"
            >
              <PersonAvatar name={person.name} photo={person.photos?.[0]} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{person.name}</p>
                <p className="text-xs text-muted-text mt-0.5 line-clamp-2 leading-relaxed">{r.reason}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
