import React from 'react';
import { IllustrationProps } from './Swan';

export const Hummingbird: React.FC<IllustrationProps> = ({
  size,
  width = 80,
  height = 80,
  color = 'var(--mauve)',
  opacity = 0.6,
  className = '',
}) => {
  const w = size || width;
  const h = size || height;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ opacity, display: 'inline-block' }}
    >
      {/* Slender long beak */}
      <path
        d="M20 30 L40 37"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Head & eye */}
      <path
        d="M38 35 C41 33, 46 34, 48 37 C49 39, 48 41, 46 43"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="43" cy="36" r="1" fill={color} />

      {/* Body & plump breast */}
      <path
        d="M40 38 C39 42, 42 49, 46 54 C51 59, 58 63, 62 68"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M46 42 C49 46, 54 52, 60 56"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Tail feathers */}
      <path
        d="M62 68 L68 76 M63 67 L72 73 M61 66 L67 70"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* Upper wing extended in flight */}
      <path
        d="M45 37 C48 27, 54 18, 64 12 C62 17, 58 25, 52 35"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M51 22 C56 22, 61 25, 54 34"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Lower wing (motion blur / back wing) */}
      <path
        d="M47 43 C52 38, 59 34, 66 31 C63 36, 58 42, 51 46"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Tiny nectar drop or delicate motion sparkle */}
      <circle cx="17" cy="29" r="1.2" fill={color} opacity="0.8" />
    </svg>
  );
};
