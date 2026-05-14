import { useEffect, useMemo, useRef, useState } from 'react';
import { usePersons, useCircles, usePersonCircles, useRecentMeetings } from '@/hooks/use-data';
import { TONES, isValidTone, type Tone } from '@/lib/store';
import { PersonAvatar } from '@/components/PersonAvatar';
import { SmartCircleBanner } from '@/components/SmartCircleBanner';
import { AIBadge } from '@/components/AIBadge';
import { PersonPickerSheet } from '@/components/PersonPickerSheet';
import { MeetingBriefModal } from '@/components/MeetingBriefModal';
import { Search, Loader2, Sparkles, CalendarPlus, ArrowRight, X } from 'lucide-react';
import { differenceInHours, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { PersonAvatarSkeleton, PersonRowSkeleton, CircleSmallSkeleton } from '@/components/skeletons';

interface HomePageProps {
  onSelectPerson: (id: string) => void;
  onSelectCircle: (id: string) => void;
}

function circleTone(c: { id: string; tone?: string | null }): Tone {
  if (isValidTone(c.tone)) return c.tone;
  let hash = 0;
  for (let i = 0; i < c.id.length; i++) hash = (hash * 31 + c.id.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

function getFirstName(
  user: { email?: string | null; user_metadata?: { full_name?: string; first_name?: string } } | null,
): string | null {
  if (!user) return null;
  const meta = user.user_metadata;
  if (meta?.first_name) return meta.first_name;
  if (meta?.full_name) return meta.full_name.split(' ')[0];
  if (user.email) return user.email.split('@')[0].split('.')[0].replace(/^\w/, (c) => c.toUpperCase());
  return null;
}

function timeOfDayGreeting(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export function HomePage({ onSelectPerson, onSelectCircle }: HomePageProps) {
  const { user } = useAuth();
  const { data: people = [], isLoading } = usePersons();
  const { data: circles = [] } = useCircles();
  const { data: personCircles = [] } = usePersonCircles();

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: recentMeetings = [] } = useRecentMeetings(todayISO);

  // Inline Recall search — same edge function as the dedicated tab, just
  // rendered on Home so users get to results without a tab switch.
  const [query, setQuery] = useState('');
  const [recallResults, setRecallResults] = useState<{ id: string; reason: string }[]>([]);
  const [recallLoading, setRecallLoading] = useState(false);
  const [recallSearched, setRecallSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setRecallResults([]);
      setRecallSearched(false);
      return;
    }
    setRecallLoading(true);
    const id = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('recall-search', { body: { query: trimmed } });
        if (error) throw error;
        setRecallResults(data?.results || []);
      } catch {
        setRecallResults([]);
      } finally {
        setRecallLoading(false);
        setRecallSearched(true);
      }
    }, 320); // small debounce so each keystroke doesn't fire a request
    return () => window.clearTimeout(id);
  }, [query]);

  // Brief CTA: tap → opens person picker → opens MeetingBriefModal
  const [briefPickerOpen, setBriefPickerOpen] = useState(false);
  const [briefTarget, setBriefTarget] = useState<{ id: string; name: string } | null>(null);

  const firstName = getFirstName(user);
  const tod = timeOfDayGreeting();

  const recentPeople = useMemo(() => people.slice(0, 4), [people]);
  const isFresh = (created_at: string) => differenceInHours(new Date(), new Date(created_at)) <= 48;

  const todaysMeetings = useMemo(
    () => recentMeetings.filter((m) => m.meeting_date === todayISO),
    [recentMeetings, todayISO],
  );

  const subtitle = useMemo(() => {
    const justAdded = people.find((p) => differenceInHours(new Date(), new Date(p.created_at)) <= 24);
    if (justAdded) {
      return `You added ${justAdded.name} ${formatDistanceToNow(new Date(justAdded.created_at), { addSuffix: true })}. Want to add more context?`;
    }
    const sinceLatest =
      recentMeetings[0] ? differenceInHours(new Date(), new Date(recentMeetings[0].created_at)) : Infinity;
    if (sinceLatest > 7 * 24 && people.length > 0) {
      return 'Been a while. Anyone new this week?';
    }
    return 'Everyone you’ve met, ready when you need them.';
  }, [people, recentMeetings]);

  const activeCircles = useMemo(() => {
    const memberCount = new Map<string, number>();
    for (const pc of personCircles) memberCount.set(pc.circle_id, (memberCount.get(pc.circle_id) || 0) + 1);
    return circles
      .map((c) => ({ ...c, members: memberCount.get(c.id) || 0 }))
      .sort((a, b) => b.members - a.members)
      .slice(0, 4);
  }, [circles, personCircles]);

  const countLabel = people.length === 1 ? '1 person' : `${people.length} people`;
  const hasQuery = query.trim().length > 0;

  if (isLoading) {
    return (
      <div className="px-5 pt-5 pb-8 animate-fade-in space-y-7">
        <header className="space-y-2">
          <Skeleton className="h-7 w-60 bg-[hsl(0_0%_100%/0.06)]" />
          <Skeleton className="h-3 w-72 bg-[hsl(0_0%_100%/0.04)]" />
        </header>
        <Skeleton className="h-11 w-full rounded-md bg-[hsl(0_0%_100%/0.05)]" />
        <section>
          <Skeleton className="h-3 w-16 bg-[hsl(0_0%_100%/0.04)] mb-3" />
          <div className="flex gap-4 -mx-5 px-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <PersonAvatarSkeleton key={i} />
            ))}
          </div>
        </section>
        <section>
          <Skeleton className="h-3 w-24 bg-[hsl(0_0%_100%/0.04)] mb-3" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <CircleSmallSkeleton key={i} />
            ))}
          </div>
        </section>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <PersonRowSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 pb-8 animate-fade-in space-y-7">
      {/* Greeting */}
      <header>
        <h1 className="font-display text-[26px] leading-[1.15] text-foreground tracking-[-0.02em]">
          Good {tod}{firstName ? `, ${firstName}` : ''}<span className="text-primary">.</span>
        </h1>
        <div className="mt-1.5 flex items-center flex-wrap gap-x-2 gap-y-1">
          <p className="text-[13px] text-muted-text leading-snug">{subtitle}</p>
          {people.length > 0 && (
            <span className="text-[11px] text-muted-text px-1.5 py-0.5 rounded-sm bg-[hsl(0_0%_100%/0.05)]">
              {countLabel}
            </span>
          )}
        </div>
      </header>

      <SmartCircleBanner />

      {/* Inline Recall search — same edge function as the Recall tab */}
      <section>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text pointer-events-none" strokeWidth={1.75} />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            placeholder="Recall anyone…"
            enterKeyHint="search"
            className="w-full h-11 pl-10 pr-10 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-base text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
          />
          {recallLoading ? (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text animate-spin" />
          ) : (
            hasQuery && (
              <button
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.blur();
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            )
          )}
        </div>

        {hasQuery && (
          <div className="mt-2.5 space-y-2">
            {recallResults.slice(0, 5).map((r) => {
              const p = people.find((x) => x.id === r.id);
              if (!p) return null;
              return (
                <button
                  key={r.id}
                  onClick={() => onSelectPerson(r.id)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)] transition-colors text-left"
                >
                  <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-foreground truncate">{p.name}</div>
                    <div className="text-[12px] text-muted-text line-clamp-2 leading-snug">{r.reason}</div>
                  </div>
                </button>
              );
            })}
            {recallSearched && !recallLoading && recallResults.length === 0 && (
              <p className="text-[13px] text-muted-text italic">No matches. Try a different description.</p>
            )}
            {recallResults.length > 0 && <AIBadge feature="search" />}
          </div>
        )}
      </section>

      {/* Brief CTA card */}
      {people.length > 0 && (
        <button
          onClick={() => setBriefPickerOpen(true)}
          className="w-full flex items-center gap-3 p-4 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)] active:scale-[0.99] transition text-left"
        >
          <div className="w-10 h-10 rounded-md tile-red flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-foreground">Pull a meeting brief</div>
            <p className="text-[12px] text-muted-text leading-snug mt-0.5">
              Tap to pick someone you're about to see
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-text shrink-0" strokeWidth={1.75} />
        </button>
      )}

      {/* Recent People */}
      {recentPeople.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">Recent</h2>
          </div>
          {/* overflow-x-scroll + explicit overflow-y-visible + vertical padding
              gives the red ring room to render past the avatar without being
              clipped by the scroll container (iOS Safari treats overflow-x-auto
              as both axes). */}
          <div className="flex gap-4 overflow-x-scroll overflow-y-visible scrollbar-hide -mx-5 px-5 py-1">
            {recentPeople.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPerson(p.id)}
                className="flex flex-col items-center gap-1.5 shrink-0 active:scale-[0.97] transition-transform"
              >
                <div
                  className="rounded-full"
                  style={
                    isFresh(p.created_at)
                      ? { boxShadow: '0 0 0 1.5px hsl(var(--primary))', padding: 2 }
                      : undefined
                  }
                >
                  <PersonAvatar name={p.name} photo={p.photos?.[0]} size="md" />
                </div>
                <span className="text-[11px] text-foreground/90 max-w-[60px] truncate">
                  {p.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Today section — only if there's something */}
      {todaysMeetings.length > 0 && (
        <section>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-3">Today</h2>
          <div className="space-y-2">
            {todaysMeetings.map((m) => {
              const p = people.find((x) => x.id === m.person_id);
              if (!p) return null;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectPerson(p.id)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)] transition-colors text-left overflow-hidden"
                >
                  <PersonAvatar name={p.name} photo={p.photos?.[0]} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{p.name}</div>
                    {m.place && <div className="text-[12px] text-muted-text truncate">{m.place}</div>}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning px-2 py-0.5 rounded-sm bg-warning/10 border border-warning/20 shrink-0">
                    <CalendarPlus className="w-3 h-3" strokeWidth={1.75} /> Encountered
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Your Circles — round colour discs with text below */}
      {activeCircles.length > 0 && (
        <section>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-3">Your Circles</h2>
          <div className="grid grid-cols-4 gap-3">
            {activeCircles.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectCircle(c.id)}
                className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
              >
                <span
                  aria-hidden="true"
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-xl text-white/95 tile-${circleTone(c)}`}
                >
                  {c.emoji || ''}
                </span>
                <span className="text-[11px] font-medium text-foreground text-center max-w-full truncate w-full">
                  {c.name}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {people.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl tile-red flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" strokeWidth={1.75} />
          </div>
          <h2 className="font-display text-xl text-foreground mb-1.5 tracking-[-0.02em]">Your Membr is empty</h2>
          <p className="text-[13px] text-muted-text max-w-xs mx-auto leading-relaxed">
            Tap the red + button to add someone you've met.
          </p>
        </div>
      )}

      {/* Brief picker + modal */}
      <AnimatePresence>
        {briefPickerOpen && (
          <PersonPickerSheet
            title="Pick someone for a brief"
            subtitle="AI will pull a 30-second refresher on them."
            closeOnPick
            onPick={(id, name) => {
              setBriefPickerOpen(false);
              // Wait for the picker's exit animation to finish before mounting
              // the brief modal so they don't slide past each other.
              window.setTimeout(() => setBriefTarget({ id, name }), 260);
            }}
            onClose={() => setBriefPickerOpen(false)}
          />
        )}
      </AnimatePresence>
      {briefTarget && (
        <MeetingBriefModal
          personId={briefTarget.id}
          personName={briefTarget.name}
          onClose={() => setBriefTarget(null)}
        />
      )}
    </div>
  );
}
