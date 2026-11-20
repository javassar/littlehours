import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  Button,
  DoubleSwans,
  RotatingSparkle,
  TurnstileWidget,
  TurnstileWidgetRef,
  BotanicalCorner,
} from '../components';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const { user, signIn, signInAnonymously, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [settingUpDemo, setSettingUpDemo] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  // Check if session ended flag was set by auth provider or cleanup job
  useEffect(() => {
    const ended = sessionStorage.getItem('demo_session_ended');
    if (ended) {
      sessionStorage.removeItem('demo_session_ended');
      setError('Your demo session ended.');
    }
  }, []);

  // If user is already authenticated, redirect to destination or home
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';
  if (user) {
    return <Navigate to={from} replace />;
  }

  // Full-screen loading state with rotating sparkle while setting up demo sandbox
  if (settingUpDemo) {
    return (
      <div
        className="page-container screen-fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          gap: 16,
        }}
        role="status"
        aria-live="polite"
      >
        <RotatingSparkle size={36} color="var(--gold)" />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 20,
            color: 'var(--mauve)',
          }}
        >
          Setting up your sandbox
        </span>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both your email and password to sign in.');
      return;
    }

    setSubmitting(true);

    // Ensure we have a valid captcha token (awaits background verification if still running)
    const token = await turnstileRef.current?.getToken();
    if (!token) {
      setSubmitting(false);
      setError('Security verification is still running. Please wait a moment and try again.');
      return;
    }

    const result = await signIn(email, password, token);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      turnstileRef.current?.reset();
    } else {
      navigate(from, { replace: true });
    }
  };

  const handleTryDemo = async () => {
    setError(null);
    setSettingUpDemo(true);

    try {
      // Ensure we have a valid captcha token (awaits background verification if still running)
      const token = await turnstileRef.current?.getToken();
      if (!token) {
        setSettingUpDemo(false);
        setError('Security verification is still running. Please wait a moment and try again.');
        return;
      }

      // 1. Sign in anonymously with captchaToken
      const { error: anonErr } = await signInAnonymously(token);
      if (anonErr) {
        console.warn('[demo] signInAnonymously failed:', anonErr);
        turnstileRef.current?.reset();

        const low = anonErr.toLowerCase();
        if (low.includes('rate') || low.includes('limit')) {
          setError('The demo is busy right now. Please try again in a few minutes.');
        } else if (low.includes('captcha')) {
          setError('Verification failed. Please check the verification box above and try again.');
        } else {
          setError("I couldn't set up the demo. Please try again.");
        }
        setSettingUpDemo(false);
        return;
      }

      // 2. Call seed-demo Edge Function with the visitor's browser timezone
      const browserTz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Phoenix';
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionToken = session?.access_token;

      const { error: seedErr } = await supabase.functions.invoke('seed-demo', {
        body: { timezone: browserTz, reset: false },
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
      });

      if (seedErr) {
        let details = seedErr.message;
        if ('context' in seedErr && seedErr.context && typeof (seedErr.context as any).json === 'function') {
          try {
            const errJson = await (seedErr.context as any).clone().json();
            if (errJson?.error) details = errJson.error;
          } catch {
            // ignore
          }
        }
        console.warn('[demo] seed-demo failed:', details);
        setError("I couldn't set up the demo. Please try again.");
        setSettingUpDemo(false);
        return;
      }

      // 3. Open Log screen
      navigate('/', { replace: true });
    } catch (err) {
      console.warn('[demo] Exception during demo setup:', err);
      setError("I couldn't set up the demo. Please try again.");
      setSettingUpDemo(false);
    }
  };

  return (
    <div className="login-storybook-wrapper screen-fade-in">
      {/* Tactile layered background: Parchment paper grain + faint damask watermark */}
      <div className="login-storybook-bg" aria-hidden="true">
      </div>

      {/* Full-Page Storybook Outer Double-Line Border & Botanical Corner Vignettes */}
      <div className="login-storybook-frame" aria-hidden="true">
        <div className="login-storybook-frame-inner" />
        <BotanicalCorner variant="tl" className="login-corner-flourish corner-flourish-tl" />
        <BotanicalCorner variant="tr" className="login-corner-flourish corner-flourish-tr" />
        <BotanicalCorner variant="bl" className="login-corner-flourish corner-flourish-bl" />
        <BotanicalCorner variant="br" className="login-corner-flourish corner-flourish-br" />
      </div>

      {/* Bottom Antique Scrollwork */}
      <div className="login-bottom-scrollwork" aria-hidden="true" />

      {/* Centered Page Content Container */}
      <div className="page-container login-page-container">
        <div className="login-header">
          {/* Pair of graceful, hand-drawn sketch swans based on image_22 and image_23 */}
          <div className="login-swan-container">
            <DoubleSwans width={125} height={78} />
          </div>
          <h2 className="login-title">Welcome to Little Hours</h2>
          <p className="login-subtitle">
            <RotatingSparkle size={16} color="var(--rose-deep)" />
            <span>~ A record of your days ~</span>
            <RotatingSparkle size={16} color="var(--rose-deep)" />
          </p>
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

            {/* Email field with cream fill, hairline dusty-rose border, and corner scrollwork */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email</label>
              <div className="login-input-frame">
                <input
                  id="login-email"
                  type="email"
                  className="time-log-input login-input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  disabled={submitting}
                />
                <svg className="login-input-scroll input-scroll-tl" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 10 C2 5.5, 5.5 2, 10 2" stroke="var(--rose-deep)" strokeWidth="0.8" />
                  <circle cx="3" cy="3" r="0.8" fill="var(--rose-deep)" />
                </svg>
                <svg className="login-input-scroll input-scroll-tr" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 10 C2 5.5, 5.5 2, 10 2" stroke="var(--rose-deep)" strokeWidth="0.8" />
                  <circle cx="3" cy="3" r="0.8" fill="var(--rose-deep)" />
                </svg>
                <svg className="login-input-scroll input-scroll-bl" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 10 C2 5.5, 5.5 2, 10 2" stroke="var(--rose-deep)" strokeWidth="0.8" />
                  <circle cx="3" cy="3" r="0.8" fill="var(--rose-deep)" />
                </svg>
                <svg className="login-input-scroll input-scroll-br" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 10 C2 5.5, 5.5 2, 10 2" stroke="var(--rose-deep)" strokeWidth="0.8" />
                  <circle cx="3" cy="3" r="0.8" fill="var(--rose-deep)" />
                </svg>
              </div>
            </div>

            {/* Password field with cream fill, hairline dusty-rose border, and corner scrollwork */}
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="login-input-frame">
                <input
                  id="login-password"
                  type="password"
                  className="time-log-input login-input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                />
                <svg className="login-input-scroll input-scroll-tl" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 10 C2 5.5, 5.5 2, 10 2" stroke="var(--rose-deep)" strokeWidth="0.8" />
                  <circle cx="3" cy="3" r="0.8" fill="var(--rose-deep)" />
                </svg>
                <svg className="login-input-scroll input-scroll-tr" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 10 C2 5.5, 5.5 2, 10 2" stroke="var(--rose-deep)" strokeWidth="0.8" />
                  <circle cx="3" cy="3" r="0.8" fill="var(--rose-deep)" />
                </svg>
                <svg className="login-input-scroll input-scroll-bl" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 10 C2 5.5, 5.5 2, 10 2" stroke="var(--rose-deep)" strokeWidth="0.8" />
                  <circle cx="3" cy="3" r="0.8" fill="var(--rose-deep)" />
                </svg>
                <svg className="login-input-scroll input-scroll-br" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 10 C2 5.5, 5.5 2, 10 2" stroke="var(--rose-deep)" strokeWidth="0.8" />
                  <circle cx="3" cy="3" r="0.8" fill="var(--rose-deep)" />
                </svg>
              </div>
            </div>

            <TurnstileWidget
              ref={turnstileRef}
              onToken={() => {
                setError(null);
              }}
              onError={() => {
                setError("Verification couldn't load. If you use an ad blocker or privacy extension, please pause it and refresh.");
              }}
            />

            <div style={{ marginTop: 16 }}>
              <Button fullWidth type="submit" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>

            {/* Botanical fleuron / diamond divider */}
            <div className="login-fleuron-divider" aria-hidden="true">
              <span className="login-divider-line" />
              <span className="login-divider-fleuron">
                <svg width="38" height="16" viewBox="0 0 38 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 8 H11" stroke="var(--rose-deep)" strokeWidth="0.75" opacity="0.6" strokeLinecap="round" />
                  <path d="M27 8 H36" stroke="var(--rose-deep)" strokeWidth="0.75" opacity="0.6" strokeLinecap="round" />
                  {/* Central diamond fleuron */}
                  <path d="M19 2.5 L22.5 8 L19 13.5 L15.5 8 Z" stroke="var(--rose-deep)" strokeWidth="0.85" fill="var(--surface)" />
                  <circle cx="19" cy="8" r="1.2" fill="var(--rose-deep)" opacity="0.8" />
                  {/* Petal foliate curls */}
                  <path d="M13.5 8 C12.5 5.5, 10 5, 8.5 6.5 C7.5 7.8, 8.5 10, 11 9" stroke="var(--rose-deep)" strokeWidth="0.75" opacity="0.7" />
                  <path d="M24.5 8 C25.5 5.5, 28 5, 29.5 6.5 C30.5 7.8, 29.5 10, 27 9" stroke="var(--rose-deep)" strokeWidth="0.75" opacity="0.7" />
                  <circle cx="8.5" cy="6.5" r="0.6" fill="var(--rose-deep)" opacity="0.6" />
                  <circle cx="29.5" cy="6.5" r="0.6" fill="var(--rose-deep)" opacity="0.6" />
                </svg>
              </span>
              <span className="login-divider-line" />
            </div>

            <div style={{ textAlign: 'center' }}>
              <Button
                variant="secondary"
                fullWidth
                type="button"
                onClick={handleTryDemo}
                disabled={submitting}
              >
                Try the demo
              </Button>
              <p
                style={{
                  margin: '10px 0 0 0',
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: 'var(--mauve)',
                }}
              >
                Entries you type are processed by an LLM, so enter personal information according to your comfort.
              </p>
              <p
                style={{
                  margin: '18px 0 0 0',
                  fontSize: 12,
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  color: 'var(--mauve)',
                  opacity: 0.8,
                  letterSpacing: '0.02em',
                }}
              >
                Protected by Cloudflare           
              </p>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
