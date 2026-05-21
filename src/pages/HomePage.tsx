import { useEffect, useMemo, useRef, useState } from 'react';
import { usePersons, useCircles, usePersonCircles, useRecentMeetings } from '@/hooks/use-data';
import { TONES, isValidTone, type Tone } from '@/lib/store';
import { PersonAvatar } from '@/components/PersonAvatar';
import { SmartCircleBanner } from '@/components/SmartCircleBanner';
import { AIBadge } from '@/components/AIBadge';
import { PersonPickerSheet } from '@/components/PersonPickerSheet';
import { MeetingBriefModal } from '@/components/MeetingBriefModal';
import { UseCasesPage } from '@/pages/UseCasesPage';
import { useQuickActions } from '@/lib/quick-actions';
import { Search, Loader2, Sparkles, UserPlus, ArrowRight, X, Lightbulb } from 'lucide-react';
import { differenceInDays, differenceInHours, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { invokeAI } from '@/lib/invoke-ai';
import { friendlyError } from '@/lib/errors';
import { toast } from 'sonner';
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
  const quickActions = useQuickActions();
  const { data: people = [], isLoading } = usePersons();
  const { data: circles = [] } = useCircles();
  const { data: personCircles = [] } = usePersonCircles();

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: recentMeetings = [] } = useRecentMeetings(todayISO);

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
        const data = await invokeAI<{ results?: { id: string; reason: string }[] }>(
          'recall-search', { query: trimmed },
        );
        setRecallResults(data?.results || []);
      } catch (e) {
        toast.error(friendlyError(e, "Couldn't run that search. Try again."));
        setRecallResults([]);
      } finally {
        setRecallLoading(false);
        setRecallSearched(true);
      }
    }, 320);
    return () => window.clearTimeout(id);
  }, [query]);

  const [briefPickerOpen, setBriefPickerOpen] = useState(false);
  const [briefTarget, setBriefTarget] = useState<{ id: string; name: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const firstName = getFirstName(user);
  const tod = timeOfDayGreeting();

  const recentPeople = useMemo(() => people.slice(0, 5), [people]);
  const isFresh = (created_at: string) => differenceInHours(new Date(), new Date(created_at)) <= 48;

  const addedThisWeek = useMemo(
    () => people.filter((p) => differenceInDays(new Date(), new Date(p.created_at)) <= 7).length,
    [people],
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
    return "Everyone you've met, ready when you need them.";
  }, [people, recentMeetings]);

  const activeCircles = useMemo(() => {
    const memberCount = new Map<string, number>();
    for (const pc of personCircles) memberCount.set(pc.circle_id, (memberCount.get(pc.circle_id) || 0) + 1);
    return circles
      .map((c) => ({ ...c, members: memberCount.get(c.id) || 0 }))
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [circles, personCircles]);

  const hasQuery = query.trim().length > 0;

  if (isLoading) {
    return (
      <div className="px-5 pt-5 pb-8 animate-fade-in space-y-7">
        <header className="space-y-2">
          <Skeleton className="h-7 w-60 bg-[hsl(0_0%_100%/0.06)]" />
          <Skeleton className="h-3 w-72 bg-[hsl(0_0%_100%/0.04)]" />
        </header>
        <Skeleton className="h-11 w-full rounded-2xl bg-[hsl(0_0%_100%/0.05)]" />
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
    <div className="pb-8 animate-fade-in">
      <div className="px-5 pt-5 space-y-6">
        {addedThisWeek > 0 && (
          <span className="glass-pill">
            <span className="glass-pill-dot" />
            {addedThisWeek} added this week
          </span>
        )}

        <header>
          <h1 className="font-display text-[34px] leading-[1.05] text-foreground tracking-[-0.02em]">
            Good {tod}
            {firstName && (
              <>
                ,{' '}
                <span className="font-display-italic">{firstName}</span>
              </>
            )}
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-[13px] text-[hsl(var(--foreground)/0.55)] leading-snug">
            {subtitle}
          </p>
        </header>

        <SmartCircleBanner />

        {/* Quick Actions hero — warm-tinted raised glass containing the
            primary red-glass brief action and a neutral add-someone action.
            One red signal moment shared between the FAB and this red action,
            per LIQUID_GLASS §7. */}
        <section>
          <SectionLabel>Quick actions</SectionLabel>
          <div className="glass glass-warm glass-raised p-3 space-y-2.5">
            <button
              onClick={() => setBriefPickerOpen(true)}
              disabled={people.length === 0}
              className="glass-action-primary disabled:opacity-50"
            >
              <span className="icon-tile">
                <Sparkles className="w-5 h-5" strokeWidth={1.75} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-foreground">Pull a meeting brief</span>
                <span className="block text-[12px] text-[hsl(var(--foreground)/0.6)] leading-snug mt-0.5">
                  Pick someone you're about to see
                </span>
              </span>
              <ArrowRight className="w-4 h-4 text-[hsl(var(--foreground)/0.55)] shrink-0" strokeWidth={1.75} />
            </button>

            <button
              onClick={quickActions.openAddPerson}
              className="glass-action-secondary"
            >
              <span className="icon-tile">
                <UserPlus className="w-5 h-5" strokeWidth={1.75} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-foreground">Add someone</span>
                <span className="block text-[12px] text-[hsl(var(--foreground)/0.55)] leading-snug mt-0.5">
                  Name. Two lines. Done.
                </span>
              </span>
              <ArrowRight className="w-4 h-4 text-[hsl(var(--foreground)/0.55)] shrink-0" strokeWidth={1.75} />
            </button>
          </div>
        </section>

        {/* Glass search input — same recall-search edge function as the tab */}
        <section>
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--foreground)/0.45)] pointer-events-none"
              strokeWidth={1.75}
            />
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
              className="glass-input w-full h-11 pl-10 pr-10 text-base"
            />
            {recallLoading ? (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-[hsl(var(--foreground)/0.55)] animate-spin" />
              </div>
            ) : (
              hasQuery && (
                <button
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.blur();
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-[hsl(var(--foreground)/0.55)]"
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
                    className="glass w-full flex items-start gap-3 p-3 text-left"
                  >
                    <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-foreground truncate">{p.name}</div>
                      <div className="text-[12px] text-[hsl(var(--foreground)/0.6)] line-clamp-2 leading-snug font-display-italic">
                        {r.reason}
                      </div>
                    </div>
                  </button>
                );
              })}
              {recallSearched && !recallLoading && recallResults.length === 0 && (
                <p className="text-[13px] text-[hsl(var(--foreground)/0.55)] font-display-italic">
                  No matches. Try a different description.
                </p>
              )}
              {recallResults.length > 0 && <AIBadge feature="search" />}
            </div>
          )}
        </section>

        {/* Recent people — horizontal avatar row inside a glass card */}
        {recentPeople.length > 0 && (
          <section>
            <SectionLabel
              right={
                addedThisWeek > 0 ? (
                  <span className="text-[11px] text-[hsl(var(--foreground)/0.55)] normal-case tracking-normal font-medium">
                    {addedThisWeek} new this week
                  </span>
                ) : null
              }
            >
              Recent
            </SectionLabel>
            <div className="glass p-4">
              <div className="flex gap-5 overflow-x-scroll overflow-y-visible scrollbar-hide py-1">
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
            </div>
          </section>
        )}

        {/* Your Circles — glass card containing the emoji-on-tile grid */}
        {activeCircles.length > 0 && (
          <section>
            <SectionLabel
              right={
                activeCircles.length > 4 ? (
                  <span className="text-[11px] font-display-italic text-[hsl(var(--foreground)/0.55)] normal-case tracking-normal">
                    See all
                  </span>
                ) : null
              }
            >
              Your circles
            </SectionLabel>
            <div className="glass p-4">
              <div className="grid grid-cols-4 gap-4">
                {activeCircles.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCircle(c.id)}
                    className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
                  >
                    <span
                      aria-hidden="true"
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl tile-${circleTone(c)}`}
                      style={{
                        boxShadow:
                          'inset 0 1px 0 rgba(255,255,255,0.15), 0 6px 16px rgba(0,0,0,0.35)',
                      }}
                    >
                      {c.emoji || ''}
                    </span>
                    <span className="text-[11px] font-medium text-foreground text-center max-w-full truncate w-full">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Empty state */}
        {people.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl tile-red flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-xl text-foreground mb-1.5 tracking-[-0.02em]">
              Your Membr is empty
            </h2>
            <p className="text-[13px] text-[hsl(var(--foreground)/0.6)] max-w-xs mx-auto leading-relaxed">
              Tap the red + button to add someone you've met.
            </p>
          </div>
        )}

        <button
          onClick={() => setGuideOpen(true)}
          className="glass-action-secondary"
        >
          <span className="icon-tile">
            <Lightbulb className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-foreground">Ways to use Membr</span>
            <span className="block text-[12px] text-[hsl(var(--foreground)/0.55)] leading-snug mt-0.5">
              Real scenarios — get the most out of every feature
            </span>
          </span>
          <ArrowRight className="w-4 h-4 text-[hsl(var(--foreground)/0.55)] shrink-0" strokeWidth={1.75} />
        </button>
      </div>

      <AnimatePresence>
        {briefPickerOpen && (
          <PersonPickerSheet
            title="Pick someone for a brief"
            subtitle="AI will pull a 30-second refresher on them."
            closeOnPick
            onPick={(id, name) => {
              setBriefPickerOpen(false);
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

      <AnimatePresence>
        {guideOpen && <UseCasesPage onBack={() => setGuideOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground)/0.55)]">
        {children}
      </h2>
      {right}
    </div>
  );
}
