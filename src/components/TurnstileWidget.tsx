import React, { useEffect, useRef } from 'react';

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
    };
  }
}

export interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: (err?: any) => void;
  onExpire?: () => void;
}

// Published Cloudflare testing site key that always passes in development / tests
const FALLBACK_TEST_SITE_KEY = '1x00000000000000000000AA';

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onToken,
  onError,
  onExpire,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const siteKey =
    import.meta.env.VITE_TURNSTILE_SITE_KEY &&
    import.meta.env.VITE_TURNSTILE_SITE_KEY.trim() !== ''
      ? import.meta.env.VITE_TURNSTILE_SITE_KEY.trim()
      : FALLBACK_TEST_SITE_KEY;

  useEffect(() => {
    let isMounted = true;

    const loadAndRender = () => {
      if (!isMounted || !containerRef.current) return;

      if (window.turnstile) {
        try {
          if (widgetIdRef.current) {
            window.turnstile.remove(widgetIdRef.current);
            widgetIdRef.current = null;
          }

          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              if (isMounted) onToken(token);
            },
            'error-callback': (err: any) => {
              if (isMounted && onError) onError(err);
            },
            'expired-callback': () => {
              if (isMounted && onExpire) onExpire();
            },
            theme: 'light',
            size: 'flexible',
          });

          widgetIdRef.current = id;
        } catch (err) {
          console.warn('[turnstile] Render error:', err);
          if (isMounted && onError) onError(err);
        }
        return;
      }

      // Check if script already exists in document
      let script = document.querySelector('script[src*="turnstile"]') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      const checkInterval = setInterval(() => {
        if (!isMounted) {
          clearInterval(checkInterval);
          return;
        }
        if (window.turnstile) {
          clearInterval(checkInterval);
          loadAndRender();
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
      }, 10000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    };

    loadAndRender();

    return () => {
      isMounted = false;
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
        minHeight: 45,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '8px 0',
      }}
    />
  );
};
