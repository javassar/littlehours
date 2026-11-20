import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

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
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      ready?: (callback: () => void) => void;
    };
  }
}

export interface TurnstileWidgetRef {
  reset: () => void;
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

    const siteKey =
      import.meta.env.VITE_TURNSTILE_SITE_KEY &&
      import.meta.env.VITE_TURNSTILE_SITE_KEY.trim() !== ''
        ? import.meta.env.VITE_TURNSTILE_SITE_KEY.trim()
        : FALLBACK_TEST_SITE_KEY;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (err) {
            console.warn('[turnstile] Reset error:', err);
          }
        }
      },
    }));

    useEffect(() => {
      let isMounted = true;
      let checkInterval: ReturnType<typeof setInterval> | null = null;
      let checkTimeout: ReturnType<typeof setTimeout> | null = null;

      const renderWidget = () => {
        if (!isMounted || !containerRef.current || !window.turnstile) return;

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
              if (isMounted) onToken(token);
            },
            'error-callback': (err: any) => {
              console.warn('[turnstile] Error callback:', err);
              if (isMounted && onError) onError(err);
            },
            'expired-callback': () => {
              console.warn('[turnstile] Token expired');
              if (isMounted && onExpire) onExpire();
            },
            theme: 'light',
            size: 'normal',
          });

          widgetIdRef.current = id;
        } catch (err) {
          console.warn('[turnstile] Render error:', err);
          if (isMounted && onError) onError(err);
        }
      };

      const startRender = () => {
        if (!isMounted) return;

        if (window.turnstile) {
          if (typeof window.turnstile.ready === 'function') {
            window.turnstile.ready(renderWidget);
          } else {
            renderWidget();
          }
          return;
        }

        // Script might still be loading, poll until window.turnstile is ready
        checkInterval = setInterval(() => {
          if (!isMounted) {
            if (checkInterval) clearInterval(checkInterval);
            return;
          }
          if (window.turnstile) {
            if (checkInterval) clearInterval(checkInterval);
            checkInterval = null;
            if (typeof window.turnstile.ready === 'function') {
              window.turnstile.ready(renderWidget);
            } else {
              renderWidget();
            }
          }
        }, 100);

        checkTimeout = setTimeout(() => {
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = null;
        }, 10000);
      };

      startRender();

      return () => {
        isMounted = false;
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
        ref={containerRef}
        style={{
          minHeight: 65,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '12px 0',
        }}
      />
    );
  }
);
