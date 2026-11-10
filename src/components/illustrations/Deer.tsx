import React from 'react';
import { IllustrationProps } from './Swan';

export const Deer: React.FC<IllustrationProps> = ({
  size,
  width = 96,
  height = 96,
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
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ opacity, display: 'inline-block' }}
    >
      {/* Delicate antlers */}
      <path
        d="M58 26 C59 20, 62 14, 68 10 M64 15 C69 16, 73 14, 76 11 M61 19 C66 21, 68 24, 72 23"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M54 26 C53 19, 50 13, 44 9 M48 15 C43 15, 39 13, 37 10 M50 20 C45 22, 42 24, 38 23"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* Head and muzzle */}
      <path
        d="M51 27 C54 26, 60 27, 63 31 C67 36, 72 38, 77 40 C74 43, 69 44, 65 43 C61 45, 57 47, 54 44"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Eye and ear */}
      <circle cx="61" cy="34" r="1.2" fill={color} />
      <path
        d="M52 28 C47 25, 45 27, 46 31 C48 32, 51 31, 52 29"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Graceful neck */}
      <path
        d="M54 44 C53 52, 55 58, 60 64"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M65 43 C69 51, 74 58, 77 65"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Resting body */}
      <path
        d="M77 65 C82 66, 88 70, 86 78 C84 83, 76 85, 62 85 C42 85, 26 84, 22 78 C18 72, 23 66, 32 65 C40 64, 52 64, 60 64"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Legs curled peacefully */}
      <path
        d="M32 77 C36 80, 44 82, 54 81"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M62 76 C68 78, 74 78, 78 77"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Little tail */}
      <path
        d="M23 72 C19 70, 18 67, 19 65 C21 66, 23 68, 25 71"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* Soft ground grass lines */}
      <path
        d="M16 88 C26 87, 40 88, 56 87 C72 87, 84 88, 92 88"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeDasharray="3 3"
      />
      <path
        d="M28 85 C29 82, 31 83, 31 87 M72 85 C73 83, 75 83, 75 87"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
};
