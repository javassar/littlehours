import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Hummingbird, Chip } from '../components';
import { useAuth } from '../lib/auth';

export const SettingsPage: React.FC = () => {
  const { user, settings, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="page-container screen-fade-in">
      <h2 className="screen-heading">Settings</h2>

      {/* Account Info */}
      <Card className="settings-card mb-4">
        <h3 className="section-title">Account</h3>
        <p className="section-desc" style={{ marginBottom: 12 }}>
          Signed in as <strong>{user?.email || 'Guest'}</strong>
        </p>
        <Button variant="secondary" onClick={handleSignOut}>
          Log out
        </Button>
      </Card>

      {/* Preferences & Default Timezone */}
      <Card className="settings-card mb-4">
        <h3 className="section-title">Preferences</h3>
        <p className="section-desc" style={{ marginBottom: 8 }}>
          Timezone: <strong>{settings?.timezone || 'America/Phoenix'}</strong>
        </p>
        <p className="section-desc">
          Push reminders and export options will appear here in upcoming milestones.
        </p>
      </Card>

      {/* Starter Categories Preview */}
      {settings?.categories && settings.categories.length > 0 && (
        <Card className="settings-card mb-4">
          <h3 className="section-title">Categories ({settings.categories.length})</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {settings.categories.map((cat) => (
              <Chip key={cat} label={cat} size="sm" />
            ))}
          </div>
        </Card>
      )}

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button variant="secondary" onClick={() => navigate('/design')}>
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
