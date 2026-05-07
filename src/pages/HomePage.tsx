import { useMemo, useState } from 'react';
import { usePersons, useCircles } from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { MeetingBriefModal } from '@/components/MeetingBriefModal';
import { LogEncounterModal } from '@/components/LogEncounterModal';
import { Mark } from '@/components/Mark';
import { Sparkles, Loader2, Wand2, ArrowRight, Search, ChevronRight, CalendarPlus } from 'lucide-react';
import { differenceInDays, format, isToday, isTomorrow } from 'date-fns';

interface HomePageProps {
  onSelectPerson: (id: string) => void;
}

export function HomePage({ onSelectPerson }: HomePageProps) {
  const { data: people = [], isLoading } = usePersons();
  const { data: circles = [] } = useCircles();

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

  const totalPeople = people.length;
  const totalCircles = circles.length;
  const dueToday = reminders.filter(r => r.daysAway === 0).length;
  const overdueCount = reminders.filter(r => r.daysAway < 0).length;
  const nextReminder = reminders.find(r => r.daysAway >= 0) ?? reminders[0];

  const formatReminderDate = (d: Date, daysAway: number) => {
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (daysAway < 0) return `${Math.abs(daysAway)}d late`;
    if (daysAway <= 7) return `in ${daysAway}d`;
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
        <Loader2 className="w-6 h-6 animate-spin text-primary" strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      {/* Header — compact horizontal mark, asymmetric */}
      <div className="flex items-center gap-1.5 mb-8 pr-14 text-foreground">
        <Mark size={18} />
        <span className="text-[15px] font-medium tracking-tight">Membr</span>
      </div>

      {/* Greeting — DM Serif, off-axis, single line */}
      <div className="mb-2">
        <h1 className="font-display text-foreground leading-tight" style={{ fontSize: '36px' }}>
          {greeting}.
        </h1>
      </div>

      {/* Meta strip — demoted stats */}
      <p className="text-[13px] text-muted-foreground mb-8">
        {totalPeople} {totalPeople === 1 ? 'person' : 'people'}
        <span className="mx-1.5">·</span>
        {totalCircles} {totalCircles === 1 ? 'circle' : 'circles'}
        {(dueToday > 0 || overdueCount > 0) && (
          <>
            <span className="mx-1.5">·</span>
            <span className="text-primary">
              {overdueCount > 0 ? `${overdueCount} late` : `${dueToday} due today`}
            </span>
          </>
        )}
      </p>

      {people.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-6 icon-tile icon-tile-red">
            <Sparkles className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h2 className="font-display text-foreground mb-3" style={{ fontSize: '28px' }}>
            Add your first person.
          </h2>
          <p className="text-muted-foreground text-[15px] max-w-xs mx-auto">
            Tap the + button below. Name, two bullets, optional photo. Done.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* HERO featured card — the one red moment */}
          <button
            onClick={() => {
              if (nextReminder) {
                setBriefTarget({ id: nextReminder.id, name: nextReminder.name });
              } else {
                setBriefOpen(true);
              }
            }}
            className="w-full surface-featured p-5 text-left active:scale-[0.99] transition-transform group"
          >
            <div className="flex items-start gap-4">
              <div className="icon-tile icon-tile-red flex-shrink-0">
                <Wand2 className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                {nextReminder ? (
                  <>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">
                      {nextReminder.daysAway === 0 ? 'Seeing today' : nextReminder.daysAway < 0 ? 'Overdue' : `Coming up · ${formatReminderDate(nextReminder.reminderDateObj, nextReminder.daysAway)}`}
                    </p>
                    <h2 className="font-display text-foreground leading-tight mb-1" style={{ fontSize: '22px' }}>
                      Brief on {nextReminder.name.split(' ')[0]}
                    </h2>
                    <p className="text-[14px] text-muted-foreground line-clamp-1">
                      {nextReminder.reminder_note || 'Get a 30-second refresher before you see them.'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">
                      Pre-meeting brief
                    </p>
                    <h2 className="font-display text-foreground leading-tight mb-1" style={{ fontSize: '22px' }}>
                      Walk in already winning.
                    </h2>
                    <p className="text-[14px] text-muted-foreground line-clamp-1">
                      Pick anyone. We'll hand you a 30-second brief.
                    </p>
                  </>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-primary mt-1.5 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
            </div>
          </button>

          {/* Log encounter — secondary, muted */}
          <button
            onClick={() => setLogOpen(true)}
            className="w-full surface-card p-4 text-left active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-button bg-secondary flex items-center justify-center flex-shrink-0">
                <CalendarPlus className="w-5 h-5 text-foreground" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium text-foreground leading-tight">Log an encounter</div>
                <p className="text-[13px] text-muted-foreground mt-0.5">Tap to pick someone you just saw</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
          </button>

          {/* Reminders */}
          {reminders.length > 1 && (
            <section>
              <div className="flex items-baseline justify-between mb-3 px-1">
                <h2 className="font-display text-foreground" style={{ fontSize: '20px' }}>Reminders</h2>
                <span className="text-[12px] text-muted-foreground">{reminders.length}</span>
              </div>
              <div className="space-y-px">
                {reminders.slice(0, 4).map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPerson(p.id)}
                    className="w-full flex items-center gap-3 py-3 hover:bg-foreground/[0.03] transition-colors border-b border-border last:border-b-0"
                  >
                    <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-[15px] font-medium text-foreground truncate">{p.name}</div>
                      <div className="text-[13px] text-muted-foreground truncate">{p.reminder_note || 'Follow up'}</div>
                    </div>
                    <span className={`text-[12px] font-medium ${
                      p.daysAway < 0 ? 'text-destructive'
                      : p.daysAway === 0 ? 'text-primary'
                      : 'text-muted-foreground'
                    }`}>
                      {formatReminderDate(p.reminderDateObj, p.daysAway)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* On this day */}
          {onThisDay.length > 0 && (
            <section>
              <h2 className="font-display text-foreground mb-3 px-1" style={{ fontSize: '20px' }}>Met on this day</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                {onThisDay.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPerson(p.id)}
                    className="flex-shrink-0 w-28 text-center"
                  >
                    <div className="flex justify-center mb-2">
                      <PersonAvatar name={p.name} photo={p.photos[0]} size="md" />
                    </div>
                    <div className="text-[14px] font-medium text-foreground truncate">{p.name}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      {p.date_met ? new Date(p.date_met).getFullYear() : new Date(p.created_at).getFullYear()}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Recently added */}
          {recentPeople.length > 0 && (
            <section>
              <h2 className="font-display text-foreground mb-3 px-1" style={{ fontSize: '20px' }}>Recently added</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                {recentPeople.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPerson(p.id)}
                    className="flex-shrink-0 w-24 text-center"
                  >
                    <div className="flex justify-center mb-2">
                      <PersonAvatar name={p.name} photo={p.photos[0]} size="md" />
                    </div>
                    <div className="text-[13px] font-medium text-foreground truncate">{p.name || 'Unknown'}</div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Brief search modal — solid Surface 2, no backdrop-blur */}
      {briefOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-24 px-4 animate-fade-in"
          onClick={() => { setBriefOpen(false); setBriefQuery(''); }}
        >
          <div
            className="w-full max-w-md surface-featured p-5 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="icon-tile icon-tile-red !w-10 !h-10">
                <Wand2 className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-display text-foreground leading-tight" style={{ fontSize: '20px' }}>Pre-meeting brief</h3>
                <p className="text-[13px] text-muted-foreground">Pick someone to refresh on</p>
              </div>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              <input
                autoFocus
                value={briefQuery}
                onChange={e => setBriefQuery(e.target.value)}
                placeholder="Type a name..."
                className="w-full pl-10 pr-3 py-2.5 rounded-input bg-secondary border border-border text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
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
                  className="w-full flex items-center gap-3 p-2.5 rounded-button hover:bg-foreground/[0.04] transition-colors"
                >
                  <PersonAvatar name={p.name} photo={p.photos[0]} size="sm" />
                  <span className="text-[15px] text-foreground flex-1 text-left truncate font-medium">{p.name}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                </button>
              ))}
              {briefQuery.trim() && briefMatches.length === 0 && (
                <p className="text-[13px] text-muted-foreground italic text-center py-6">No one matches "{briefQuery}"</p>
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
