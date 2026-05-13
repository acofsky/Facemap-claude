import { useMemo, useState } from 'react';
import { usePersons, useCircles, usePersonCircles } from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { MeetingBriefModal } from '@/components/MeetingBriefModal';
import { LogEncounterModal } from '@/components/LogEncounterModal';
import { Sparkles, AlertCircle, CalendarDays, Loader2, Wand2, Users, ArrowRight, Search, ChevronRight, CalendarPlus } from 'lucide-react';
import { differenceInDays, format, isToday, isTomorrow } from 'date-fns';

interface HomePageProps {
  onSelectPerson: (id: string) => void;
}

export function HomePage({ onSelectPerson }: HomePageProps) {
  const { data: people = [], isLoading } = usePersons();
  const { data: circles = [] } = useCircles();
  const { data: personCircles = [] } = usePersonCircles();

  const [briefQuery, setBriefQuery] = useState('');
  const [briefTarget, setBriefTarget] = useState<{ id: string; name: string } | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const briefMatches = useMemo(() => {
    const q = briefQuery.trim().toLowerCase();
    if (!q) return [];
    return people.filter(p => p.name.toLowerCase().includes(q)).slice(0, 5);
  }, [briefQuery, people]);

  const today = new Date();
  const recentPeople = people.slice(0, 8);

  const reminders = useMemo(() => {
    return people
      .filter(p => p.reminder_date)
      .map(p => {
        const d = new Date(p.reminder_date!);
        const daysAway = differenceInDays(d, today);
        return { ...p, reminderDateObj: d, daysAway };
      })
      .filter(p => p.daysAway >= -30 && p.daysAway <= 30)
      .sort((a, b) => a.daysAway - b.daysAway);
  }, [people, today]);

  const onThisDay = useMemo(() => {
    return people.filter(p => {
      if (p.date_met) {
        const d = new Date(p.date_met);
        return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear();
      }
      const d = new Date(p.created_at);
      return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear();
    });
  }, [people, today]);

  const sparsePeople = useMemo(() => {
    return people
      .filter(p => !p.how_we_met && !p.important_info && p.photos.length === 0)
      .slice(0, 8);
  }, [people]);

  const totalPeople = people.length;
  const totalCircles = circles.length;
  const upcomingCount = reminders.filter(r => r.daysAway >= 0).length;
  const overdueCount = reminders.filter(r => r.daysAway < 0).length;

  const formatReminderDate = (d: Date, daysAway: number) => {
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (daysAway < 0) return `${Math.abs(daysAway)}d late`;
    if (daysAway <= 7) return `${daysAway}d`;
    return format(d, 'MMM d');
  };

  const greeting = (() => {
    const h = today.getHours();
    if (h < 5) return 'Late night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6 pr-14">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{greeting}</p>
        <h1 className="text-4xl font-display text-foreground leading-tight">membr<span className="text-primary">.</span></h1>
      </div>

      {people.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-5 icon-tile icon-tile-red !w-20 !h-20 !rounded-3xl">
            <Sparkles className="w-9 h-9" />
          </div>
          <h2 className="font-display text-xl text-foreground mb-2">Your Membr is empty</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Tap the + button below to add someone you've met.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Hero stat card with ambient glow */}
          <div className="relative rounded-3xl overflow-hidden warm-shadow p-5">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/30 blur-3xl pointer-events-none" />
            <div className="relative">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Your network</p>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-5xl font-display text-foreground leading-none">{totalPeople}</span>
                <span className="text-sm text-muted-foreground mb-1">{totalPeople === 1 ? 'person' : 'people'}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                  <Users className="w-3 h-3 text-primary" />
                  <span className="text-xs text-foreground/80">{totalCircles} circles</span>
                </div>
                {upcomingCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <AlertCircle className="w-3 h-3 text-primary" />
                    <span className="text-xs text-foreground/80">{upcomingCount} upcoming</span>
                  </div>
                )}
                {overdueCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/30">
                    <span className="text-xs text-destructive">{overdueCount} late</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick action: log encounter */}
          <button
            onClick={() => setLogOpen(true)}
            className="w-full rounded-3xl p-4 text-left warm-shadow relative overflow-hidden group active:scale-[0.99] transition-transform"
          >
            <div className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full bg-primary/25 blur-2xl group-hover:bg-primary/35 transition-colors pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <div className="icon-tile icon-tile-red !w-12 !h-12 !rounded-2xl">
                <CalendarPlus className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg text-foreground leading-tight">Log an encounter</div>
                <p className="text-xs text-muted-foreground mt-0.5">Tap to pick someone you just saw</p>
              </div>
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
          </button>

          {/* Action grid: brief CTA + on-this-day */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setBriefOpen(true)}
              className="rounded-3xl p-4 text-left warm-shadow relative overflow-hidden group"
            >
              <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-primary/20 blur-2xl group-hover:bg-primary/30 transition-colors pointer-events-none" />
              <div className="relative">
                <div className="icon-tile icon-tile-red mb-3">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div className="font-display text-base text-foreground leading-tight">Pre-meeting<br />brief</div>
                <p className="text-xs text-muted-foreground mt-1">AI refresher</p>
              </div>
            </button>

            <div className="rounded-3xl p-4 warm-shadow relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-[hsl(265_75%_60%/0.15)] blur-2xl pointer-events-none" />
              <div className="relative">
                <div className="icon-tile icon-tile-purple mb-3">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="font-display text-base text-foreground leading-tight">On this day</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {onThisDay.length > 0 ? `${onThisDay.length} ${onThisDay.length === 1 ? 'person' : 'people'}` : 'Nothing today'}
                </p>
              </div>
            </div>
          </div>

          {/* Reminders */}
          {reminders.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-gradient-primary" />
                  <h2 className="font-display text-lg text-foreground">Reminders</h2>
                </div>
                <span className="text-xs text-muted-foreground">{reminders.length}</span>
              </div>
              <div className="rounded-3xl warm-shadow overflow-hidden divide-y divide-white/5">
                {reminders.slice(0, 4).map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPerson(p.id)}
                    className="w-full flex items-center gap-3 p-3.5 hover:bg-white/[0.03] transition-colors"
                  >
                    <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-foreground truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.reminder_note || 'Follow up'}</div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      p.daysAway < 0 ? 'bg-destructive/15 text-destructive border border-destructive/30'
                      : p.daysAway === 0 ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-white/5 text-muted-foreground border border-white/10'
                    }`}>
                      {formatReminderDate(p.reminderDateObj, p.daysAway)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* On this day inline list (only if there are matches) */}
          {onThisDay.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-1 h-4 rounded-full bg-[hsl(265_75%_60%)]" />
                <h2 className="font-display text-lg text-foreground">Met on this day</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                {onThisDay.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPerson(p.id)}
                    className="flex-shrink-0 w-32 rounded-2xl warm-shadow p-3 text-center hover:scale-[1.02] transition-transform"
                  >
                    <div className="flex justify-center mb-2">
                      <PersonAvatar name={p.name} photo={p.photos[0]} size="md" />
                    </div>
                    <div className="font-medium text-foreground text-sm truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {p.date_met ? new Date(p.date_met).getFullYear() : new Date(p.created_at).getFullYear()}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Recently added — horizontal scroller */}
          {recentPeople.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-[hsl(210_90%_58%)]" />
                  <h2 className="font-display text-lg text-foreground">Recently added</h2>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                {recentPeople.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPerson(p.id)}
                    className="flex-shrink-0 w-28 rounded-2xl warm-shadow p-3 text-center hover:scale-[1.02] transition-transform"
                  >
                    <div className="flex justify-center mb-2">
                      <PersonAvatar name={p.name} photo={p.photos[0]} size="md" />
                    </div>
                    <div className="font-medium text-foreground text-xs truncate">{p.name || 'Unknown'}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Sparse profiles */}
          {sparsePeople.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-[hsl(35_95%_58%)]" />
                  <h2 className="font-display text-lg text-foreground">Add details</h2>
                </div>
                <span className="text-xs text-muted-foreground">{sparsePeople.length} sparse</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                {sparsePeople.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPerson(p.id)}
                    className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full warm-shadow hover:bg-white/[0.04] transition-colors"
                  >
                    <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                    <span className="text-xs font-medium text-foreground pr-1">{p.name}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Brief search modal */}
      {briefOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-24 px-4 animate-fade-in"
          onClick={() => { setBriefOpen(false); setBriefQuery(''); }}
        >
          <div
            className="w-full max-w-md rounded-3xl warm-shadow p-5 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="icon-tile icon-tile-red !w-10 !h-10">
                <Wand2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display text-lg text-foreground leading-tight">Pre-meeting brief</h3>
                <p className="text-xs text-muted-foreground">Pick someone to refresh on</p>
              </div>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={briefQuery}
                onChange={e => setBriefQuery(e.target.value)}
                placeholder="Type a name..."
                className="w-full pl-10 pr-3 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {(briefQuery.trim() ? briefMatches : people.slice(0, 6)).map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setBriefTarget({ id: p.id, name: p.name });
                    setBriefQuery('');
                    setBriefOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/[0.04] transition-colors"
                >
                  <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                  <span className="text-sm text-foreground flex-1 text-left truncate font-medium">{p.name}</span>
                  <ArrowRight className="w-4 h-4 text-primary" />
                </button>
              ))}
              {briefQuery.trim() && briefMatches.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-6">No one matches "{briefQuery}"</p>
              )}
            </div>
          </div>
        </div>
      )}

      {briefTarget && (
        <MeetingBriefModal
          personId={briefTarget.id}
          personName={briefTarget.name}
          onClose={() => setBriefTarget(null)}
        />
      )}

      <LogEncounterModal open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
