import React from 'react';
import './Header.css';

export interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = 'Little Hours' }) => {
  return (
    <header className="app-header">
      <div className="header-inner">
        <h1 className="header-title">{title}</h1>
      </div>
      {/* Intricate vintage lace trim hanging below header */}
      <div className="header-lace-trim" aria-hidden="true" />
    </header>
  );
};
