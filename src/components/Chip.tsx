import React from 'react';
import './Chip.css';

export type CategoryTint = 'sage' | 'slate' | 'lavender' | 'rose' | 'mauve';

// Map the 14 starter categories across the 5 tints
export const CATEGORY_TINTS: Record<string, CategoryTint> = {
  'work': 'slate',
  'job search': 'slate',
  'errands': 'slate',
  'exercise': 'sage',
  'meals': 'sage',
  'rest': 'sage',
  'reading': 'lavender',
  'entertainment': 'lavender',
  'phone and social media': 'lavender',
  'chores': 'rose',
  'personal care': 'rose',
  'social time': 'mauve',
  'sleep': 'mauve',
  'travel': 'mauve',
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
