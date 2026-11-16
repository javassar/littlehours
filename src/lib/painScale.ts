/**
 * Milestone 3.7: Hourly pain rating (1 to 5) scale anchors
 * Single source of truth for the scale anchors.
 */

export interface PainAnchor {
  rating: number;
  word: string;
  meaning: string;
}

export const PAIN_SCALE: PainAnchor[] = [
  {
    rating: 1,
    word: 'none or very mild',
    meaning: 'Barely there, easy to ignore.',
  },
  {
    rating: 2,
    word: 'mild',
    meaning: 'Noticeable, does not limit what I do.',
  },
  {
    rating: 3,
    word: 'moderate',
    meaning: 'Hard to ignore, limits some activities.',
  },
  {
    rating: 4,
    word: 'severe',
    meaning: 'Limits most activities and my concentration.',
  },
  {
    rating: 5,
    word: 'very severe',
    meaning: 'I cannot do my normal activities.',
  },
];

export function getPainAnchor(rating: number | null | undefined): PainAnchor | undefined {
  if (rating === null || rating === undefined) return undefined;
  return PAIN_SCALE.find((p) => p.rating === rating);
}

export function getPainWord(rating: number | null | undefined): string {
  const anchor = getPainAnchor(rating);
  return anchor ? anchor.word : '';
}
