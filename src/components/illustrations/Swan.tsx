import React from 'react';

export interface IllustrationProps {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  opacity?: number;
}

export const Swan: React.FC<IllustrationProps> = ({
  size,
  width = 96,
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
      viewBox="0 0 100 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ opacity, display: 'inline-block' }}
    >
      {/* Graceful fairy-tale swan */}
      {/* Head, beak, crown */}
      <path
        d="M26 18 C28 14, 33 13, 36 15 C38 16, 40 16, 43 14 C39 18, 36 18, 34 20"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33" cy="15.5" r="1" fill={color} />
      {/* Elegant S-curved neck */}
      <path
        d="M34 20 C32 26, 36 34, 40 38 C44 42, 45 46, 43 52"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M28 20 C26 26, 31 36, 35 41 C38 45, 38 49, 36 53"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Swan body & folded wings */}
      <path
        d="M36 53 C25 53, 16 57, 18 64 C20 67, 28 68, 48 68 C72 68, 86 63, 88 56 C90 50, 84 46, 75 46 C66 46, 61 49, 54 48 C48 47, 43 51, 41 53"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Feathers / wings detail */}
      <path
        d="M50 49 C58 45, 72 44, 82 50 C76 53, 68 55, 56 55"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M58 55 C66 52, 77 54, 84 57 C78 60, 68 61, 58 61"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Water ripple lines */}
      <path
        d="M12 71 C22 69, 34 72, 48 70 C60 68, 76 72, 88 70"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="2 3"
      />
      <path
        d="M26 75 C38 74, 52 76, 66 74 C74 73, 80 75, 84 75"
        stroke={color}
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
};
