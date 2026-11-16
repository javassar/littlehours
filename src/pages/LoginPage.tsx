import React, { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Swan } from '../components';
import { useAuth } from '../lib/auth';

export const LoginPage: React.FC = () => {
  const { user, signIn, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If user is already authenticated, redirect to destination or home
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';
  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both your email and password to sign in.');
      return;
    }

    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="page-container screen-fade-in login-page-container">
      <div className="login-header">
        <Swan size={100} />
        <h2 className="login-title">Welcome to Little Hours</h2>
        <p className="login-subtitle">A record of your days</p>
      </div>

      <Card ornamental={true} className="login-card">
        <form onSubmit={handleSubmit} className="login-form">
          {!isConfigured && (
            <div className="login-unconfigured-note">
              Supabase keys are not set yet. Please add your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>.
            </div>
          )}

          {error && (
            <div className="login-error-message" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="time-log-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="time-log-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={submitting}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <Button fullWidth type="submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
