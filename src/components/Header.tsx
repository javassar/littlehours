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
      {/* Scalloped lace edge along the bottom */}
      <div className="header-lace" aria-hidden="true" />
      <div className="header-lace-dots" aria-hidden="true" />
    </header>
  );
};
