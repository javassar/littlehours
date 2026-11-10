import React from 'react';

export interface SparkleProps {
  size?: number;
  color?: string;
  className?: string;
  rotating?: boolean;
}

export const Sparkle: React.FC<SparkleProps> = ({
  size = 18,
  color = 'var(--gold)',
  className = '',
  rotating = false,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${rotating ? 'sparkle-rotating' : ''}`}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    >
      {/* Delicate 4-point fairy-tale star */}
      <path
        d="M12 0 C12 7, 13 11, 24 12 C13 13, 12 17, 12 24 C12 17, 11 13, 0 12 C11 11, 12 7, 12 0 Z"
        fill={color}
      />
      <circle cx="12" cy="12" r="1.5" fill="#FFF8F2" opacity="0.8" />
    </svg>
  );
};
