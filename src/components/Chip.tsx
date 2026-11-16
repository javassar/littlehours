import React from 'react';
import './Chip.css';

export type CategoryTint = 'sage' | 'slate' | 'lavender' | 'rose' | 'mauve';

// Map categories across the 5 tints (25 final categories + legacy aliases)
export const CATEGORY_TINTS: Record<string, CategoryTint> = {
  // Slate (career, planning, logistics)
  'work': 'slate',
  'job search': 'slate',
  'networking': 'slate',
  'professional development': 'slate',
  'admin': 'slate',

  // Lavender (digital, media, events)
  'doomscrolling': 'lavender',
  'social media': 'lavender',
  'entertainment': 'lavender',
  'events': 'lavender',
  'texting': 'lavender',

  // Mauve (connection, rest, music)
  'social time': 'mauve',
  'sleep': 'mauve',
  'functional meals': 'mauve',
  'social meals': 'mauve',
  'piano': 'mauve',

  // Sage (wellness, care, health, vacation)
  'exercise': 'sage',
  'hygiene': 'sage',
  'personal care': 'sage',
  'healthcare': 'sage',
  'vacation': 'sage',

  // Rose (home, crafts, books, everyday tasks)
  'chores': 'rose',
  'errands': 'rose',
  'shopping': 'rose',
  'reading': 'rose',
  'hobbies': 'rose',

  // Legacy mappings for backward compatibility
  'digital media time': 'lavender',
  'misc hobby': 'rose',
  'meals': 'mauve',
  'rest': 'sage',
  'travel': 'sage',
  'phone and social media': 'lavender',
};

export interface ChipProps {
  label: string;
  tint?: CategoryTint;
  className?: string;
  size?: 'sm' | 'md';
}

export const Chip: React.FC<ChipProps> = ({
  label,
  tint,
  className = '',
  size = 'md',
}) => {
  // If tint not explicitly passed, infer from category name or fallback to sage
  const resolvedTint = tint || CATEGORY_TINTS[label.toLowerCase()] || 'sage';

  return (
    <span className={`chip chip-${resolvedTint} chip-${size} ${className}`}>
      <span className="chip-indicator" />
      <span className="chip-label">{label}</span>
    </span>
  );
};
