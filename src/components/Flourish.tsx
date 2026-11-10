import React from 'react';

export interface FlourishProps {
  variant?: 'tl' | 'tr' | 'bl' | 'br';
  size?: number;
  className?: string;
  color?: string;
}

export const Flourish: React.FC<FlourishProps> = ({
  variant = 'tl',
  size = 28,
  className = '',
  color = 'var(--rose-deep)',
}) => {
  // Base flourish path designed for top-left (tl)
  const transform = {
    tl: '',
    tr: 'scale(-1, 1) translate(-28, 0)',
    bl: 'scale(1, -1) translate(0, -28)',
    br: 'scale(-1, -1) translate(-28, -28)',
  }[variant];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <g transform={transform}>
        {/* Elegant storybook corner scrollwork */}
        <path
          d="M3 25 C3 12, 12 3, 25 3"
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path
          d="M3 18 C3 9, 9 3, 18 3"
          stroke={color}
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.5"
        />
        {/* Curled leaf/spiral at the corner */}
        <circle cx="5" cy="5" r="1.5" fill={color} opacity="0.75" />
        <path
          d="M5 5 C8 7, 7 11, 4 12 C2.5 10, 3 7, 5 5 Z"
          fill={color}
          opacity="0.4"
        />
        <path
          d="M5 5 C7 8, 11 7, 12 4 C10 2.5, 7 3, 5 5 Z"
          fill={color}
          opacity="0.4"
        />
        {/* Tiny delicate bud accents */}
        <circle cx="18" cy="3" r="1" fill={color} opacity="0.6" />
        <circle cx="3" cy="18" r="1" fill={color} opacity="0.6" />
      </g>
    </svg>
  );
};
