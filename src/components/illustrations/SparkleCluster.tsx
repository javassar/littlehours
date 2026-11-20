import React from 'react';

export interface SparkleClusterProps {
  variant?: 'left' | 'right';
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  opacity?: number;
}

export const SparkleCluster: React.FC<SparkleClusterProps> = ({
  variant = 'left',
  width = 38,
  height = 20,
  color = 'var(--rose-deep)',
  opacity = 0.85,
  className = '',
}) => {
  const isRight = variant === 'right';
  const transform = isRight ? 'scale(-1, 1) translate(-38, 0)' : '';

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 38 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ opacity, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <g transform={transform} stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Delicate hand-drawn wave / swirl flourish extending outward */}
        <path
          d="M34 11.5 C26 12.5, 18 9, 12 10.5 C7.5 11.5, 3.5 14.5, 5 17 C6.5 18.5, 9.5 17.5, 10 15.5 C10.5 13.5, 8 12.5, 6.5 13.5"
          strokeWidth="0.85"
          opacity="0.75"
        />

        {/* Primary 4-point fairytale star sparkle at (26, 6) */}
        <path
          d="M26 2 C26 4.8, 27.2 6, 30 6 C27.2 6, 26 7.2, 26 10 C26 7.2, 24.8 6, 22 6 C24.8 6, 26 4.8, 26 2 Z"
          fill={color}
          stroke="none"
          opacity="0.9"
        />

        {/* Secondary 4-point star at (13, 5.2) */}
        <path
          d="M13 3 C13 4.5, 13.8 5.2, 15.2 5.2 C13.8 5.2, 13 5.9, 13 7.4 C13 5.9, 12.2 5.2, 10.8 5.2 C12.2 5.2, 13 4.5, 13 3 Z"
          fill={color}
          stroke="none"
          opacity="0.8"
        />

        {/* Tiny tertiary star at (19, 14.5) */}
        <path
          d="M19 13 C19 14, 19.5 14.5, 20.6 14.5 C19.5 14.5, 19 15, 19 16 C19 15, 18.5 14.5, 17.4 14.5 C18.5 14.5, 19 14, 19 13 Z"
          fill={color}
          stroke="none"
          opacity="0.7"
        />

        {/* Microscopic stardust beads / fairy dust */}
        <circle cx="5.5" cy="8" r="0.7" fill={color} stroke="none" opacity="0.65" />
        <circle cx="16" cy="11" r="0.6" fill={color} stroke="none" opacity="0.6" />
        <circle cx="31" cy="4.5" r="0.65" fill={color} stroke="none" opacity="0.7" />
        <circle cx="30" cy="15.5" r="0.55" fill={color} stroke="none" opacity="0.55" />
      </g>
    </svg>
  );
};
