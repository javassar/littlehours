import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sparkle } from './illustrations/Sparkle';
import './TabBar.css';

// Thin-line SVG icons (1.5px stroke, --mauve by default, --rose-deep when active)
const LogIcon: React.FC<{ stroke: string }> = ({ stroke }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const WeekIcon: React.FC<{ stroke: string }> = ({ stroke }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const HistoryIcon: React.FC<{ stroke: string }> = ({ stroke }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
);

const SettingsIcon: React.FC<{ stroke: string }> = ({ stroke }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const TabBar: React.FC = () => {
  const tabs = [
    { to: '/', label: 'Log', Icon: LogIcon },
    { to: '/week', label: 'Week', Icon: WeekIcon },
    { to: '/history', label: 'History', Icon: HistoryIcon },
    { to: '/settings', label: 'Settings', Icon: SettingsIcon },
  ];

  return (
    <nav className="tab-bar-container" aria-label="Main Navigation">
      <div className="tab-bar">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `tab-item ${isActive ? 'tab-item-active' : ''}`}
          >
            {({ isActive }) => {
              const iconColor = isActive ? 'var(--rose-deep)' : 'var(--mauve)';
              return (
                <>
                  <div className="tab-icon-wrapper">
                    {isActive && (
                      <span className="tab-active-sparkle" aria-hidden="true">
                        <Sparkle size={7} color="var(--gold)" />
                      </span>
                    )}
                    <Icon stroke={iconColor} />
                  </div>
                  <span className="tab-label">{label}</span>
                </>
              );
            }}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
