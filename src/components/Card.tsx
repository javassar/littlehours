import React from 'react';
import { Flourish } from './Flourish';
import './Card.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  ornamental?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  ornamental = false,
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`card ${ornamental ? 'card-ornamental' : ''} ${className}`} {...props}>
      {ornamental && (
        <div className="card-frame" aria-hidden="true">
          <div className="card-frame-inner" />
          <Flourish variant="tl" className="card-flourish card-flourish-tl" />
          <Flourish variant="tr" className="card-flourish card-flourish-tr" />
          <Flourish variant="bl" className="card-flourish card-flourish-bl" />
          <Flourish variant="br" className="card-flourish card-flourish-br" />
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
    </div>
  );
};
