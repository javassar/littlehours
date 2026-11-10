import React from 'react';
import { Card, Button, Hummingbird } from '../components';

export const SettingsPage: React.FC = () => {
  return (
    <div className="page-container screen-fade-in">
      <h2 className="screen-heading">Settings</h2>

      <Card className="settings-card">
        <h3 className="section-title">Preferences</h3>
        <p className="section-desc">
          Push reminders, time zones, and export options will appear here in upcoming milestones.
        </p>
      </Card>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button variant="secondary" onClick={() => window.location.href = '/design'}>
          View Design System (/design)
        </Button>
      </div>

      <div className="settings-footer">
        <Hummingbird size={60} />
        <p className="footer-note">Little Hours · Soft storybook time logger</p>
      </div>
    </div>
  );
};
