import { useState } from 'react';
import { PeoplePage } from './PeoplePage';
import { CirclesPage } from './CirclesPage';

interface NetworkPageProps {
  onSelectPerson: (id: string) => void;
  onSelectCircle: (id: string) => void;
  onSelectEvent: (id: string) => void;
}

type Segment = 'people' | 'circles';

/**
 * Network — unified People + Circles tab. People and Circles started as
 * separate tabs but cover the same conceptual space ("who's in my world
 * and how are they grouped"). Merging frees up a tab slot for the new
 * central Add button while keeping every existing feature reachable.
 *
 * The page owns the title + segmented control at the top; PeoplePage
 * and CirclesPage render in embedded mode below, which drops their own
 * nav bars and surfaces their action buttons inline.
 */
export function NetworkPage({ onSelectPerson, onSelectCircle, onSelectEvent }: NetworkPageProps) {
  const [segment, setSegment] = useState<Segment>('people');

  return (
    <div className="pb-8 animate-fade-in">
      {/* z-20 sits below the AppLayout notch cover (z-30) so the cover
          always paints over the sliver of header that scrolls into the
          safe-top region. */}
      <div className="sticky top-0 z-20 pt-2 pb-3 mb-1 px-5 space-y-3">
        <h1 className="font-display text-[26px] leading-tight tracking-[-0.02em] text-center text-foreground">
          Network
        </h1>
        <div
          className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[hsl(0_0%_100%/0.08)] backdrop-blur-xl"
          role="tablist"
          aria-label="Network section"
        >
          <button
            role="tab"
            aria-selected={segment === 'people'}
            onClick={() => setSegment('people')}
            className={`h-9 rounded-xl text-[14px] font-medium transition-colors ${
              segment === 'people'
                ? 'bg-[hsl(0_0%_100%/0.10)] text-foreground font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_3px_rgba(0,0,0,0.3)]'
                : 'text-[hsl(var(--foreground)/0.55)]'
            }`}
          >
            People
          </button>
          <button
            role="tab"
            aria-selected={segment === 'circles'}
            onClick={() => setSegment('circles')}
            className={`h-9 rounded-xl text-[14px] font-medium transition-colors ${
              segment === 'circles'
                ? 'bg-[hsl(0_0%_100%/0.10)] text-foreground font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_3px_rgba(0,0,0,0.3)]'
                : 'text-[hsl(var(--foreground)/0.55)]'
            }`}
          >
            Circles
          </button>
        </div>
      </div>

      {segment === 'people' ? (
        <PeoplePage onSelectPerson={onSelectPerson} embedded />
      ) : (
        <CirclesPage
          onSelectCircle={onSelectCircle}
          onSelectEvent={onSelectEvent}
          embedded
        />
      )}
    </div>
  );
}
