import React from 'react';
import { Sparkle } from './illustrations/Sparkle';
import './Sparkles.css';

export interface SparkleBurstProps {
  active: boolean;
  onAnimationEnd?: () => void;
  className?: string;
}

export const SparkleBurst: React.FC<SparkleBurstProps> = ({
  active,
  onAnimationEnd,
  className = '',
}) => {
  if (!active) return null;

  // Six sparkles with defined relative offsets and animations
  return (
    <div
      className={`sparkle-burst ${className}`}
      onAnimationEnd={onAnimationEnd}
      aria-hidden="true"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`sparkle-item sparkle-item-${i}`}>
          <Sparkle size={i % 2 === 0 ? 14 : 10} color="var(--gold)" />
        </span>
      ))}
    </div>
  );
};

export interface RotatingSparkleProps {
  size?: number;
  color?: string;
  className?: string;
}

export const RotatingSparkle: React.FC<RotatingSparkleProps> = ({
  size = 20,
  color = 'var(--gold)',
  className = '',
}) => {
  return (
    <span className={`sparkle-rotating-wrap ${className}`} aria-hidden="true">
      <Sparkle size={size} color={color} rotating={true} />
    </span>
  );
};
