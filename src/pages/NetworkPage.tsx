import { useState } from 'react';
import { PeoplePage } from './PeoplePage';
import { CirclesPage } from './CirclesPage';
import { cn } from '@/lib/utils';

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
      <div className="sticky top-0 z-30 bg-background pt-3 pb-2 mb-1 px-5 space-y-2.5">
        <div className="flex items-center justify-center">
          <h1 className="text-[17px] font-semibold text-foreground">Network</h1>
        </div>
        <div className="flex items-center bg-surface-1 rounded-md p-1 border border-[hsl(0_0%_100%/0.08)]">
          <SegBtn active={segment === 'people'} onClick={() => setSegment('people')}>
            People
          </SegBtn>
          <SegBtn active={segment === 'circles'} onClick={() => setSegment('circles')}>
            Circles
          </SegBtn>
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

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 h-9 rounded-sm text-[13px] font-medium transition-colors',
        active ? 'bg-surface-2 text-foreground' : 'text-muted-text',
      )}
    >
      {children}
    </button>
  );
}
