import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePersons, useEvents, usePersonEvents } from '@/hooks/use-data';
import { detectClusters, type SmartCluster } from '@/lib/smart-circle';

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
 *   - haven't already been turned into an Event (cluster members all share
 *     an event the cluster fingerprint matches),
 *   - aren't older than 72h.
 */
export function useSmartClusters() {
  const { data: people = [] } = usePersons();
  const { data: events = [] } = useEvents({ includeArchived: true });
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

    return raw.filter((c) => {
      if (dismissedSet.has(c.fingerprint)) return false;
      const key = [...c.personIds].sort().join(',');
      if (eventMemberSets.includes(key)) return false;
      return true;
    });
  }, [people, events, personEvents, dismissed]);

  const dismiss = useCallback((fingerprint: string) => {
    setDismissed((d) => {
      const next = [...d, { fingerprint, dismissedAt: Date.now() }];
      saveDismissed(next);
      return next;
    });
  }, []);

  return { clusters, dismiss };
}
