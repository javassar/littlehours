import React from 'react';
import { Deer } from '../components';

export const HistoryPage: React.FC = () => {
  return (
    <div className="page-container screen-fade-in">
      <div className="empty-history-state">
        <Deer size={110} />
        <p className="empty-history-text">
          Nothing logged yet. Your first entry will appear here.
        </p>
      </div>
    </div>
  );
};
