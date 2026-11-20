import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { RotatingSparkle } from './Sparkles';
import './TurnstileWidget.css';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (error: any) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          appearance?: 'always' | 'execute' | 'interaction-only';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
    __onTurnstileLoaded?: () => void;
  }
}

export interface TurnstileWidgetRef {
  reset: () => void;
  getToken: () => Promise<string | null>;
}

export interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: (err?: any) => void;
  onExpire?: () => void;
}

// Published Cloudflare testing site key that always passes in development / tests
const FALLBACK_TEST_SITE_KEY = '1x00000000000000000000AA';

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  ({ onToken, onError, onExpire }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const tokenRef = useRef<string | null>(null);
    const pendingResolvers = useRef<Array<(token: string | null) => void>>([]);
    const [status, setStatus] = useState<'verifying' | 'verified' | 'error'>('verifying');
    const [isWidgetVisible, setIsWidgetVisible] = useState(false);

    useEffect(() => {
      if (!containerRef.current) return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.contentRect.height;
          setIsWidgetVisible(height > 20);
        }
      });
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }, []);

    const siteKey =
      import.meta.env.VITE_TURNSTILE_SITE_KEY &&
      import.meta.env.VITE_TURNSTILE_SITE_KEY.trim() !== ''
        ? import.meta.env.VITE_TURNSTILE_SITE_KEY.trim()
        : FALLBACK_TEST_SITE_KEY;

    useImperativeHandle(ref, () => ({
      reset: () => {
        tokenRef.current = null;
        setStatus('verifying');
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (err) {
            console.warn('[turnstile] Reset error:', err);
          }
        }
      },
      getToken: () => {
        if (tokenRef.current) {
          return Promise.resolve(tokenRef.current);
        }
        return new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => {
            resolve(tokenRef.current);
          }, 6000);

          pendingResolvers.current.push((tok) => {
            clearTimeout(timeout);
            resolve(tok);
          });
        });
      },
    }));

    useEffect(() => {
      let isMounted = true;
      let checkInterval: ReturnType<typeof setInterval> | null = null;
      let checkTimeout: ReturnType<typeof setTimeout> | null = null;

      const renderWidget = () => {
        if (!isMounted || !containerRef.current || !window.turnstile?.render) return;

        // Clean up any existing widget in container
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              if (!isMounted) return;
              console.log('[turnstile] Security check passed, token ready');
              tokenRef.current = token;
              setStatus('verified');
              pendingResolvers.current.forEach((res) => res(token));
              pendingResolvers.current = [];
              onToken(token);
            },
            'error-callback': (err: any) => {
              console.warn('[turnstile] Error callback:', err);
              if (!isMounted) return;
              setStatus('error');
              pendingResolvers.current.forEach((res) => res(null));
              pendingResolvers.current = [];
              if (onError) onError(err);
            },
            'expired-callback': () => {
              console.warn('[turnstile] Token expired');
              if (!isMounted) return;
              tokenRef.current = null;
              setStatus('verifying');
              if (onExpire) onExpire();
            },
            theme: 'light',
            size: 'normal',
            appearance: 'interaction-only',
          });

          widgetIdRef.current = id;
        } catch (err) {
          console.warn('[turnstile] Render error:', err);
          if (isMounted) {
            setStatus('error');
            pendingResolvers.current.forEach((res) => res(null));
            pendingResolvers.current = [];
            if (onError) onError(err);
          }
        }
      };

      // Register callback with the global hook defined in index.html
      const onLoaded = () => {
        if (isMounted) {
          renderWidget();
        }
      };
      window.__onTurnstileLoaded = onLoaded;
      window.onloadTurnstileCallback = onLoaded;

      // If the Turnstile API is already loaded in the window
      if (window.turnstile?.render) {
        renderWidget();
      } else {
        // Fallback polling in case the script loaded just before attaching callback
        checkInterval = setInterval(() => {
          if (!isMounted) {
            if (checkInterval) clearInterval(checkInterval);
            return;
          }
          if (window.turnstile?.render) {
            if (checkInterval) clearInterval(checkInterval);
            checkInterval = null;
            renderWidget();
          }
        }, 100);

        checkTimeout = setTimeout(() => {
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = null;
        }, 10000);
      }

      return () => {
        isMounted = false;
        window.__onTurnstileLoaded = undefined;
        if (checkInterval) clearInterval(checkInterval);
        if (checkTimeout) clearTimeout(checkTimeout);
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey]);

    return (
      <div
        className="turnstile-outer-wrap"
        style={{
          margin: isWidgetVisible ? '14px 0' : 0,
          textAlign: 'center',
          transition: 'margin 0.2s ease',
        }}
      >
        <div
          ref={containerRef}
          className={`turnstile-frame-container ${isWidgetVisible ? 'visible' : 'hidden'}`}
        />
        {status === 'verifying' && isWidgetVisible && (
          <div className="turnstile-verifying-text">
            <RotatingSparkle size={14} color="var(--gold)" />
            <span>Verifying security check...</span>
          </div>
        )}
      </div>
    );
  }
);
