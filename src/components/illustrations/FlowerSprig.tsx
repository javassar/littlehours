import React from 'react';
import { IllustrationProps } from './Swan';

export const FlowerSprig: React.FC<IllustrationProps> = ({
  size,
  width = 64,
  height = 80,
  color = 'var(--rose-deep)',
  opacity = 0.6,
  className = '',
}) => {
  const w = size || width;
  const h = size || height;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 64 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ opacity, display: 'inline-block' }}
    >
      {/* Delicate gently curving main stem */}
      <path
        d="M32 75 C31 60, 33 42, 30 18"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Top central blossom */}
      <circle cx="30" cy="16" r="2" fill={color} />
      <path
        d="M30 13 C27 8, 33 8, 30 13 Z M33 16 C38 13, 38 19, 33 16 Z M30 19 C33 24, 27 24, 30 19 Z M27 16 C22 19, 22 13, 27 16 Z"
        stroke={color}
        strokeWidth="1.1"
        fill={color}
        fillOpacity="0.15"
      />

      {/* Left upper leaf */}
      <path
        d="M31 32 C23 28, 16 32, 17 38 C22 39, 28 36, 31 34"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill={color}
        fillOpacity="0.1"
      />

      {/* Right middle flower bud */}
      <path
        d="M32 40 C38 39, 44 42, 49 41"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="50" cy="41" r="2.5" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.2" />

      {/* Left lower leaf */}
      <path
        d="M31 54 C21 52, 18 59, 20 64 C25 64, 29 60, 31 56"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill={color}
        fillOpacity="0.1"
      />

      {/* Right lower leaf */}
      <path
        d="M32 50 C41 48, 47 52, 46 58 C41 59, 35 55, 32 52"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill={color}
        fillOpacity="0.1"
      />
    </svg>
  );
};
