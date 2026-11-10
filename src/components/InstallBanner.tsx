import React, { useState, useEffect } from 'react';
import './InstallBanner.css';

const STORAGE_KEY = 'littlehours_safari_banner_dismissed';

export const InstallBanner: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    // Check if dismissed previously
    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      return;
    }

    // Check if running in standalone display mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      return;
    }

    // Detect Safari or iOS environment, or test query param
    const ua = window.navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari =
      /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/i.test(ua);
    const isTestMode = window.location.search.includes('test_banner=1');

    if ((isSafari || isIOS) || isTestMode) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors in private browsing
    }
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="install-banner" role="status" aria-label="Add to Home Screen banner">
      <div className="install-banner-content">
        <svg
          className="install-banner-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* iOS Share symbol */}
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        <span className="install-banner-text">Tap Share, then Add to Home Screen.</span>
      </div>
      <button
        type="button"
        className="install-banner-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss banner"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};
