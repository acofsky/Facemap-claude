import type { CandidateDraft } from '../types';

/**
 * Calendar import is plumbed but not yet wired to a Capacitor plugin —
 * none of the maintained iOS calendar plugins are bundled with the build
 * yet. The picker surfaces Calendar with a "Soon" chip; if the user
 * somehow reaches this gather step, throw a friendly error.
 *
 * To enable: add `@ebarooni/capacitor-calendar` (or similar), Info.plist
 * `NSCalendarsFullAccessUsageDescription`, then implement
 * `gatherCalendarCandidates` to:
 *   1. Request full access via the plugin
 *   2. Fetch events in the last `monthsBack` months
 *   3. Flatten attendees → CandidateDraft per unique email
 *   4. Aggregate raw.event_titles[] + raw.meeting_count for the AI prompt
 */
export function isCalendarSourceAvailable(): boolean {
  return false;
}

export async function gatherCalendarCandidates(_opts?: {
  monthsBack?: number;
  onProgress?: (loaded: number) => void;
}): Promise<CandidateDraft[]> {
  throw new Error('CALENDAR_NOT_AVAILABLE');
}
