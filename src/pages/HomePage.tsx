import { useMemo } from 'react';
import { usePersons, useCircles, usePersonCircles, useRecentMeetings } from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Search, Loader2, Sparkles, CalendarPlus } from 'lucide-react';
import { differenceInHours, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

interface HomePageProps {
  onSelectPerson: (id: string) => void;
  onNavigateToRecall: () => void;
}

// Deterministic tile gradient per circle until CIRCLES-03 adds a real
// `color` column (M2 Phase C). Keys match `.tile-*` utilities in index.css.
const TILE_PALETTE = ['red', 'blue', 'purple', 'green', 'amber', 'slate', 'rose', 'teal'] as const;
function circleTone(id: string): typeof TILE_PALETTE[number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TILE_PALETTE[hash % TILE_PALETTE.length];
}

function getFirstName(user: { email?: string | null; user_metadata?: { full_name?: string; first_name?: string } } | null): string | null {
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

export function HomePage({ onSelectPerson, onNavigateToRecall }: HomePageProps) {
  const { user } = useAuth();
  const { data: people = [], isLoading } = usePersons();
  const { data: circles = [] } = useCircles();
  const { data: personCircles = [] } = usePersonCircles();

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: recentMeetings = [] } = useRecentMeetings(todayISO);

  const firstName = getFirstName(user);
  const tod = timeOfDayGreeting();

  // Recent people: most recently created, up to 4
  const recentPeople = useMemo(() => people.slice(0, 4), [people]);

  // People added in the last 48h get the Primary Red ring per spec
  const isFresh = (created_at: string) => differenceInHours(new Date(), new Date(created_at)) <= 48;

  // Today's encounters — meetings logged with today's date
  const todaysMeetings = useMemo(
    () => recentMeetings.filter((m) => m.meeting_date === todayISO),
    [recentMeetings, todayISO],
  );

  // Subtitle (spec greeting subtitle logic, client-side only)
  const subtitle = useMemo(() => {
    const justAdded = people.find((p) => differenceInHours(new Date(), new Date(p.created_at)) <= 24);
    if (justAdded) {
      return `You added ${justAdded.name} ${formatDistanceToNow(new Date(justAdded.created_at), { addSuffix: true })}. Want to add more context?`;
    }
    // No encounters logged in 7+ days
    const sinceLatest =
      recentMeetings[0] ? differenceInHours(new Date(), new Date(recentMeetings[0].created_at)) : Infinity;
    if (sinceLatest > 7 * 24 && people.length > 0) {
      return 'Been a while. Anyone new this week?';
    }
    return 'Everyone you’ve met, ready when you need them.';
  }, [people, recentMeetings]);

  // Your Circles — 4 most recently active by member count or recency
  const activeCircles = useMemo(() => {
    const memberCount = new Map<string, number>();
    for (const pc of personCircles) memberCount.set(pc.circle_id, (memberCount.get(pc.circle_id) || 0) + 1);
    return circles
      .map((c) => ({ ...c, members: memberCount.get(c.id) || 0 }))
      .sort((a, b) => b.members - a.members)
      .slice(0, 4);
  }, [circles, personCircles]);

  // Person count chip text (Q11)
  const countLabel = people.length === 1 ? '1 person' : `${people.length} people`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in space-y-7">
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

      {/* Tappable search bar */}
      <button
        onClick={onNavigateToRecall}
        className="w-full h-11 flex items-center gap-2.5 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)] transition-colors text-left"
        aria-label="Open Recall search"
      >
        <Search className="w-4 h-4 text-muted-text" strokeWidth={1.75} />
        <span className="text-sm text-muted-text">Recall anyone…</span>
      </button>

      {/* Recent People */}
      {recentPeople.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">Recent</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-5 px-5">
            {recentPeople.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPerson(p.id)}
                className="flex flex-col items-center gap-1.5 shrink-0 active:scale-[0.97] transition-transform"
              >
                <div
                  className={`rounded-full ${isFresh(p.created_at) ? 'ring-[1.5px] ring-primary p-0.5' : ''}`}
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
                  className="w-full flex items-center gap-3 p-3.5 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)] transition-colors text-left"
                >
                  <PersonAvatar name={p.name} photo={p.photos?.[0]} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{p.name}</div>
                    {m.place && <div className="text-[12px] text-muted-text truncate">{m.place}</div>}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning px-2 py-0.5 rounded-sm bg-warning/10 border border-warning/20">
                    <CalendarPlus className="w-3 h-3" strokeWidth={1.75} /> Encountered
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Your Circles 2x2 grid */}
      {activeCircles.length > 0 && (
        <section>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-3">Your Circles</h2>
          <div className="grid grid-cols-2 gap-3">
            {activeCircles.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl p-4 aspect-[3/2] flex flex-col justify-end tile-${circleTone(c.id)}`}
              >
                <div className="text-[15px] font-semibold text-white truncate">{c.emoji ? `${c.emoji} ` : ''}{c.name}</div>
                <div className="text-[12px] text-white/70">
                  {c.members} {c.members === 1 ? 'member' : 'members'}
                </div>
              </div>
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
    </div>
  );
}
