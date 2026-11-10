import React from 'react';
import { Card, Button, Swan } from '../components';

export const LoginPage: React.FC = () => {
  return (
    <div className="page-container screen-fade-in login-page-container">
      <div className="login-header">
        <Swan size={96} />
        <h2 className="login-title">Welcome to Little Hours</h2>
        <p className="login-subtitle">A quiet record of your days</p>
      </div>

      <Card ornamental={true} className="login-card">
        <form onSubmit={(e) => e.preventDefault()} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="time-log-input"
              placeholder="you@example.com"
              disabled
            />
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="time-log-input"
              placeholder="••••••••"
              disabled
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <Button fullWidth disabled>
              Sign In
            </Button>
          </div>
        </form>
      </Card>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--mauve)', marginTop: 24 }}>
        Login will be active in Milestone 1.2.
      </p>
    </div>
  );
};
