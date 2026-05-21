import { Skeleton } from '@/components/ui/skeleton';

/**
 * Layout-mirroring skeletons. Each shape mimics the real component below
 * it (avatar circle, two text lines, etc.) so the swap to real content
 * doesn't visibly reflow. Colors are whitish at low opacity to read on
 * the pure-black canvas — bg-muted (#0F0F0F) is too dark to register.
 */

const SHIMMER_STRONG = 'bg-[hsl(0_0%_100%/0.06)]';
const SHIMMER_WEAK = 'bg-[hsl(0_0%_100%/0.04)]';

/** Row used in PeoplePage, CircleDetailPage, EventDetailPage. */
export function PersonRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 glass">
      <Skeleton className={`w-14 h-14 rounded-full ${SHIMMER_STRONG}`} />
      <div className="flex-1 space-y-2">
        <Skeleton className={`h-3.5 w-32 ${SHIMMER_STRONG}`} />
        <Skeleton className={`h-3 w-44 ${SHIMMER_WEAK}`} />
      </div>
      <Skeleton className={`w-4 h-4 ${SHIMMER_WEAK}`} />
    </div>
  );
}

/** Horizontal-scroll avatar in HomePage > Recent. */
export function PersonAvatarSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <Skeleton className={`w-12 h-12 rounded-full ${SHIMMER_STRONG}`} />
      <Skeleton className={`h-2.5 w-12 ${SHIMMER_WEAK}`} />
    </div>
  );
}

/** 96px disc + name + count below — matches CirclesPage > Circles grid. */
export function CircleTileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <Skeleton className={`w-24 h-24 rounded-full ${SHIMMER_STRONG}`} />
      <Skeleton className={`h-3.5 w-20 ${SHIMMER_STRONG}`} />
      <Skeleton className={`h-2.5 w-14 ${SHIMMER_WEAK} -mt-1`} />
    </div>
  );
}

/** 3:2 rectangle matching CirclesPage > Events grid. */
export function EventTileSkeleton() {
  return <Skeleton className={`aspect-[3/2] rounded-xl ${SHIMMER_STRONG}`} />;
}

/** 56-px (w-14) disc used as a HomePage circle. */
export function CircleSmallSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Skeleton className={`w-14 h-14 rounded-full ${SHIMMER_STRONG}`} />
      <Skeleton className={`h-2.5 w-12 ${SHIMMER_WEAK}`} />
    </div>
  );
}

/** Profile hero — large avatar, name line, subline. */
export function PersonHeaderSkeleton() {
  return (
    <div className="flex flex-col items-center px-5 pt-3 pb-5">
      <Skeleton className={`w-24 h-24 rounded-full ${SHIMMER_STRONG} mb-3`} />
      <Skeleton className={`h-5 w-40 ${SHIMMER_STRONG} mb-2`} />
      <Skeleton className={`h-3 w-56 ${SHIMMER_WEAK}`} />
    </div>
  );
}
