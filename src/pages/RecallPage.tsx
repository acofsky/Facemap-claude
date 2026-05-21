import { useMemo, useRef, useState } from "react";
import { Search, Loader2, Sparkles, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { invokeAI } from "@/lib/invoke-ai";
import { friendlyError } from "@/lib/errors";
import { usePersons } from "@/hooks/use-data";
import { PersonAvatar } from "@/components/PersonAvatar";
import { AIBadge } from "@/components/AIBadge";
import { PersonRowSkeleton } from "@/components/skeletons";

interface RecallPageProps {
  onSelectPerson: (id: string) => void;
}

const RECENT_RECALLS_KEY = 'membr.recent-recalls';
const MAX_RECENT = 6;

function loadRecents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_RECALLS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecents(list: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_RECALLS_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* quota / disabled storage — fine to swallow */
  }
}

/**
 * Recall — semantic-search tab. Ranks by best semantic match first;
 * recency is just a tiebreaker (Q4). Recent queries persist locally so
 * the user can re-run a previous recall with one tap.
 */
export function RecallPage({ onSelectPerson }: RecallPageProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recents, setRecents] = useState<string[]>(() => loadRecents());
  const { data: persons = [], isLoading: personsLoading } = usePersons();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (override?: string) => {
    const trimmed = (override ?? query).trim();
    if (!trimmed) return;
    if (override) setQuery(trimmed);
    setLoading(true);
    setSearched(true);
    try {
      const data = await invokeAI<{ results?: { id: string; reason: string }[] }>(
        "recall-search", { query: trimmed },
      );
      setResults(data?.results || []);
      // Record the query in recents (most-recent-first, deduplicated).
      const next = [trimmed, ...recents.filter((r) => r.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
      setRecents(next);
      saveRecents(next);
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't run that search. Try again."));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getPersonById = (id: string) => persons.find((p) => p.id === id);
  const hasInput = query.trim().length > 0;

  const headlineWords = useMemo(() => ['Find anyone', "you've met"], []);

  return (
    <div className="px-5 pt-2 pb-8 animate-fade-in">
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground)/0.55)] mb-2">
          Recall
        </p>
        <h1 className="font-display text-[34px] leading-[1.05] text-foreground tracking-[-0.02em]">
          {headlineWords[0]}{' '}
          <span className="font-display-italic">{headlineWords[1]}</span>
          <span className="text-primary">.</span>
        </h1>
      </header>

      <div className="relative mb-2.5">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--foreground)/0.45)]"
          strokeWidth={1.75}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder='e.g. "tall guy from the gym with a beard"'
          className="glass-input w-full h-12 pl-10 pr-[6.75rem] text-sm text-ellipsis overflow-hidden"
        />
        <button
          onClick={() => handleSearch()}
          disabled={loading || !hasInput}
          className="glass-pill !bg-[rgba(224,48,48,0.22)] !border-[rgba(224,48,48,0.40)] absolute right-1.5 top-1/2 -translate-y-1/2 !h-9 px-3 text-xs font-semibold text-foreground disabled:opacity-40 active:scale-[0.97] transition-transform"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />}
          Recall
        </button>
      </div>

      <AIBadge feature="search" />

      {!searched && personsLoading && (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <PersonRowSkeleton key={i} />
          ))}
        </div>
      )}

      {!searched && !personsLoading && (
        <p className="font-display-italic text-[16px] text-[hsl(var(--foreground)/0.65)] leading-relaxed mt-7">
          Describe anyone you've added — by appearance, where you met, notes, or anything you remember.
        </p>
      )}

      {/* Recent recalls — persisted query history. Quiet rows, hairline-divided. */}
      {!searched && !personsLoading && recents.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground)/0.55)] mb-2">
            Recent recalls
          </h2>
          <div>
            {recents.map((q, i) => (
              <button
                key={`${q}-${i}`}
                onClick={() => handleSearch(q)}
                className="w-full flex items-center gap-3 py-3 text-left border-b border-[hsl(0_0%_100%/0.06)] last:border-b-0"
              >
                <Clock className="w-3.5 h-3.5 text-[hsl(var(--foreground)/0.45)] shrink-0" strokeWidth={1.75} />
                <span className="font-display-italic text-[15px] text-foreground/85 leading-snug truncate">
                  {q}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="font-display-italic text-sm text-[hsl(var(--foreground)/0.6)] text-center mt-12">
          No matches found. Try a different description.
        </p>
      )}

      <div className="flex flex-col gap-2.5 mt-5">
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
              className="glass flex items-start gap-3 p-3.5 text-left"
            >
              <PersonAvatar name={person.name} photo={person.photos?.[0]} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-display text-[17px] text-foreground truncate leading-tight">
                  {person.name}
                </p>
                <p className="font-display-italic text-[13px] text-[hsl(var(--foreground)/0.65)] mt-0.5 line-clamp-2 leading-snug">
                  {r.reason}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
