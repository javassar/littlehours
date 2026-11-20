import React from 'react';

export interface BotanicalCornerProps {
  variant?: 'tl' | 'tr' | 'bl' | 'br';
  size?: number;
  className?: string;
  color?: string;
  opacity?: number;
}

export const BotanicalCorner: React.FC<BotanicalCornerProps> = ({
  variant = 'tl',
  size = 56,
  className = '',
  color = 'var(--rose-deep)',
  opacity = 0.85,
}) => {
  const transform = {
    tl: '',
    tr: 'scale(-1, 1) translate(-56, 0)',
    bl: 'scale(1, -1) translate(0, -56)',
    br: 'scale(-1, -1) translate(-56, -56)',
  }[variant];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, opacity }}
    >
      <g transform={transform} stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Main stem arching from top to left corner */}
        <path d="M52 6 C38 6, 24 10, 16 16 C10 24, 6 38, 6 52" strokeWidth="1.2" opacity="0.8" />
        <path d="M44 8 C32 10, 20 15, 15 20 C10 28, 8 38, 8 46" strokeWidth="0.75" opacity="0.45" />

        {/* Delicate Rose Bud / Rosette at corner cusp */}
        <circle cx="16" cy="16" r="1.6" fill={color} opacity="0.75" stroke="none" />
        {/* Rose petal whorls */}
        <path d="M14 13.5 C15.5 12, 18.5 12.5, 19 14.5 C19.5 16.5, 17.5 18, 15 18 C13 18, 12 16, 13.5 14.5" strokeWidth="0.9" opacity="0.8" />
        <path d="M12.5 16 C11.5 18, 12.5 20.5, 15 21 C17.5 21.5, 20 20, 20.5 17" strokeWidth="0.85" opacity="0.75" />
        <path d="M17 12 C19.5 11.5, 21.5 13.5, 21 16 C20.5 18.5, 18.5 20, 16.5 19.5" strokeWidth="0.85" opacity="0.75" />

        {/* Top Stem Leaves */}
        <path d="M26 10 C29 6.5, 34 7, 36 9 C34 11.5, 29 12, 26 10 Z" strokeWidth="0.85" fill="var(--surface)" fillOpacity="0.5" opacity="0.8" />
        <path d="M27 9.8 L34 8.5" strokeWidth="0.6" opacity="0.5" />
        <path d="M40 7 C43 4.5, 47 5, 49 6.5 C47 8.5, 43 9, 40 7 Z" strokeWidth="0.8" fill="var(--surface)" fillOpacity="0.5" opacity="0.75" />
        {/* Micro rosebud at top stem end (52, 6) */}
        <path d="M50 6 C52 4.5, 54 5.5, 54 7 C53 8.5, 51 8, 50 6 Z" strokeWidth="0.75" fill={color} fillOpacity="0.25" opacity="0.85" />
        <circle cx="53" cy="6" r="0.9" fill={color} opacity="0.85" stroke="none" />

        {/* Left Stem Leaves */}
        <path d="M10 26 C6.5 29, 7 34, 9 36 C11.5 34, 12 29, 10 26 Z" strokeWidth="0.85" fill="var(--surface)" fillOpacity="0.5" opacity="0.8" />
        <path d="M9.8 27 L8.5 34" strokeWidth="0.6" opacity="0.5" />
        <path d="M7 40 C4.5 43, 5 47, 6.5 49 C8.5 47, 9 43, 7 40 Z" strokeWidth="0.8" fill="var(--surface)" fillOpacity="0.5" opacity="0.75" />
        {/* Micro rosebud at left stem end (6, 52) */}
        <path d="M6 50 C4.5 52, 5.5 54, 7 54 C8.5 53, 8 51, 6 50 Z" strokeWidth="0.75" fill={color} fillOpacity="0.25" opacity="0.85" />
        <circle cx="6" cy="53" r="0.9" fill={color} opacity="0.85" stroke="none" />

        {/* Whimsical Spiraling Tendrils & Sparkles */}
        <path d="M16 19 C18 24, 22 26, 25 24 C28 22, 27 18, 24 18 C22 18, 21 20, 22.5 21.5" strokeWidth="0.75" opacity="0.7" />
        <circle cx="23" cy="21" r="0.75" fill={color} opacity="0.75" stroke="none" />
        <path d="M14 13 C12 9, 8 8, 7 11 C6 13, 9 14, 10 13" strokeWidth="0.7" opacity="0.6" />

        {/* Tiny fairy-tale 4-point sparkle at (28, 28) */}
        <path d="M28 25 C28 27, 29 28, 31 28 C29 28, 28 29, 28 31 C28 29, 27 28, 25 28 C27 28, 28 27, 28 25 Z" fill={color} opacity="0.6" stroke="none" />
        <circle cx="34" cy="18" r="0.7" fill={color} opacity="0.55" stroke="none" />
        <circle cx="18" cy="34" r="0.7" fill={color} opacity="0.55" stroke="none" />
      </g>
    </svg>
  );
};
