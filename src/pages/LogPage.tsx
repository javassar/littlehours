import React from 'react';
import { Card, Button, FlowerSprig } from '../components';

export const LogPage: React.FC = () => {
  return (
    <div className="page-container screen-fade-in">
      <div className="page-header-intro">
        <span className="window-pill">Since 2:30 PM</span>
      </div>

      <Card ornamental={true} className="log-input-card">
        <div className="prompt-label">How did you spend that time?</div>
        <textarea
          className="time-log-textarea"
          placeholder="I was reading a fairy tale, then worked on the garden..."
          rows={4}
          readOnly
        />
        <div style={{ marginTop: 16 }}>
          <Button fullWidth disabled>
            Save Entry
          </Button>
        </div>
      </Card>

      <div style={{ textAlign: 'center', marginTop: 32, opacity: 0.7 }}>
        <FlowerSprig size={40} />
        <p style={{ fontSize: 13, color: 'var(--mauve)', marginTop: 8 }}>
          Milestone 1.1 App Shell active.
        </p>
      </div>
    </div>
  );
};
