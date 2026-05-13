import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPersons, fetchPerson, createPerson, updatePerson, deletePerson,
  fetchCircles, createCircle, updateCircle, deleteCircle,
  setPersonCircles, fetchPersonCircles,
  addPersonToCircle, removePersonFromCircle,
  uploadPhoto,
  fetchConnections, createConnection, deleteConnection,
  fetchMeetingsForPerson, fetchRecentMeetings, createMeeting, updateMeeting, deleteMeeting,
} from '@/lib/store';
import type { TablesUpdate } from '@/integrations/supabase/types';

export function usePersons() {
  return useQuery({ queryKey: ['persons'], queryFn: fetchPersons });
}

export function usePerson(id: string | null) {
  return useQuery({
    queryKey: ['persons', id],
    queryFn: () => fetchPerson(id!),
    enabled: !!id,
  });
}

export function useCircles() {
  return useQuery({ queryKey: ['circles'], queryFn: fetchCircles });
}

export function usePersonCircles() {
  return useQuery({ queryKey: ['person_circles'], queryFn: fetchPersonCircles });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPerson,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TablesUpdate<'persons'> }) =>
      updatePerson(id, updates),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['persons'] });
      qc.invalidateQueries({ queryKey: ['persons', id] });
    },
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePerson,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useCreateCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCircle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['circles'] }),
  });
}

export function useUpdateCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; emoji?: string; color?: string } }) =>
      updateCircle(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['circles'] }),
  });
}

export function useDeleteCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCircle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['circles'] });
      qc.invalidateQueries({ queryKey: ['person_circles'] });
    },
  });
}

export function useAddPersonToCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, circleId }: { personId: string; circleId: string }) =>
      addPersonToCircle(personId, circleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person_circles'] });
      qc.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}

export function useRemovePersonFromCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, circleId }: { personId: string; circleId: string }) =>
      removePersonFromCircle(personId, circleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person_circles'] });
      qc.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}

export function useSetPersonCircles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, circleIds }: { personId: string; circleIds: string[] }) =>
      setPersonCircles(personId, circleIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person_circles'] });
      qc.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}

export function useUploadPhoto() {
  return useMutation({ mutationFn: uploadPhoto });
}

export function useConnections() {
  return useQuery({ queryKey: ['connections'], queryFn: fetchConnections });
}

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personAId, personBId, note }: { personAId: string; personBId: string; note?: string }) =>
      createConnection(personAId, personBId, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteConnection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
}

// ---- Meetings ----

export function useMeetings(personId: string | null) {
  return useQuery({
    queryKey: ['meetings', personId],
    queryFn: () => fetchMeetingsForPerson(personId!),
    enabled: !!personId,
  });
}

export function useRecentMeetings(sinceISODate: string) {
  return useQuery({
    queryKey: ['meetings', 'recent', sinceISODate],
    queryFn: () => fetchRecentMeetings(sinceISODate),
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMeeting,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['meetings', vars.person_id] }),
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { meeting_date?: string; place?: string | null; notes?: string | null } }) =>
      updateMeeting(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMeeting,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
}
