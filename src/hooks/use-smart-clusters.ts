import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePersons, useEvents, usePersonEvents, useCircles } from '@/hooks/use-data';
import { clusterDuplicatesExisting, detectClusters, type SmartCluster } from '@/lib/smart-circle';

const DISMISSED_KEY = 'membr_smart_dismissed_v1';
const EXPIRY_HOURS = 72;

interface DismissalRecord {
  fingerprint: string;
  dismissedAt: number;
}

function loadDismissed(): DismissalRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDismissed(records: DismissalRecord[]) {
  window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(records));
}

/**
 * Active Smart Circle suggestions, filtered to those that:
 *   - haven't been dismissed,
 *   - haven't already been turned into an Event (member-set match),
 *   - aren't a fuzzy-name duplicate of an existing Event or Circle,
 *   - aren't older than 72h (dismissed entries expire then).
 *
 * The fuzzy-name dedupe (see clusterDuplicatesExisting) catches the case
 * where the engine wants to propose "Stanford alumni" but the user
 * already has a "Stanford Mixer" event or a "Stanford" circle — we don't
 * want to pitch them a circle they already have.
 */
export function useSmartClusters() {
  const { data: people = [] } = usePersons();
  const { data: events = [] } = useEvents({ includeArchived: true });
  const { data: circles = [] } = useCircles();
  const { data: personEvents = [] } = usePersonEvents();
  const [dismissed, setDismissed] = useState<DismissalRecord[]>(() => loadDismissed());

  // Periodic dismissal-expiry sweep — every 5 minutes prune old entries.
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - EXPIRY_HOURS * 60 * 60 * 1000;
      setDismissed((d) => {
        const next = d.filter((r) => r.dismissedAt > cutoff);
        if (next.length !== d.length) saveDismissed(next);
        return next;
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const clusters = useMemo<SmartCluster[]>(() => {
    const raw = detectClusters(people);
    const dismissedSet = new Set(dismissed.map((d) => d.fingerprint));

    // Filter out clusters whose member set is already represented by an Event.
    const eventMemberLookup = new Map<string, Set<string>>();
    for (const evt of events) eventMemberLookup.set(evt.id, new Set());
    for (const pe of personEvents) eventMemberLookup.get(pe.event_id)?.add(pe.person_id);
    const eventMemberSets = [...eventMemberLookup.values()].map(
      (s) => [...s].sort().join(','),
    );

    // Existing Event + Circle names — used to fuzzy-dedupe so we don't
    // suggest creating a circle the user already has under a slightly
    // different name.
    const existingNames = [
      ...events.map((e) => e.name),
      ...circles.map((c) => c.name),
    ].filter(Boolean) as string[];

    return raw.filter((c) => {
      if (dismissedSet.has(c.fingerprint)) return false;
      const key = [...c.personIds].sort().join(',');
      if (eventMemberSets.includes(key)) return false;
      if (clusterDuplicatesExisting(c, existingNames)) return false;
      return true;
    });
  }, [people, events, circles, personEvents, dismissed]);

  const dismiss = useCallback((fingerprint: string) => {
    setDismissed((d) => {
      const next = [...d, { fingerprint, dismissedAt: Date.now() }];
      saveDismissed(next);
      return next;
    });
  }, []);

  return { clusters, dismiss };
}
