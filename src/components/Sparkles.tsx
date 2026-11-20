import React from 'react';
import { Sparkle } from './illustrations/Sparkle';
import './Sparkles.css';

export interface SparkleBurstProps {
  active: boolean;
  onAnimationEnd?: () => void;
  className?: string;
}

const SPARKLE_SIZES = [18, 14, 19, 15, 14, 14, 12, 13];

export const SparkleBurst: React.FC<SparkleBurstProps> = ({
  active,
  onAnimationEnd,
  className = '',
}) => {
  if (!active) return null;

  // 8 celebratory confetti sparkles with parabolic fountain trajectories and spin
  return (
    <div
      className={`sparkle-burst ${className}`}
      onAnimationEnd={onAnimationEnd}
      aria-hidden="true"
    >
      {SPARKLE_SIZES.map((size, i) => (
        <span key={i} className={`sparkle-item sparkle-item-${i}`}>
          <Sparkle size={size} color="var(--gold)" />
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
