export interface Person {
  id: string;
  name: string;
  photos: string[];
  howWeMet?: string;
  whereWhen?: string;
  dateMet?: string;
  physicalDescription?: string;
  importantInfo?: string;
  miscNotes?: string;
  reminderDate?: string;
  reminderNote?: string;
  circleIds: string[];
  connectionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Circle {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: string;
}

export interface Connection {
  id: string;
  personAId: string;
  personBId: string;
  note?: string;
  createdAt: string;
}

export const DEFAULT_CIRCLES: Omit<Circle, 'id' | 'createdAt'>[] = [
  { name: 'Work', emoji: '💼', color: 'hsl(16, 65%, 55%)' },
  { name: 'College', emoji: '🎓', color: 'hsl(35, 60%, 70%)' },
  { name: 'High School', emoji: '🏫', color: 'hsl(145, 50%, 42%)' },
  { name: 'Family', emoji: '🏠', color: 'hsl(280, 50%, 55%)' },
  { name: 'Gym', emoji: '💪', color: 'hsl(200, 60%, 50%)' },
  { name: 'Travel', emoji: '✈️', color: 'hsl(30, 80%, 65%)' },
  { name: 'Neighborhood', emoji: '🏘️', color: 'hsl(100, 40%, 50%)' },
  { name: 'Randoms', emoji: '🎲', color: 'hsl(0, 0%, 55%)' },
];
