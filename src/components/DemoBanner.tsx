import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { ModalPortal } from './ModalPortal';
import './DemoBanner.css';

export const DemoBanner: React.FC = () => {
  const { session, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  if (!user || !user.is_anonymous) {
    return null;
  }

  const handleExitDemo = async () => {
    setIsExiting(true);
    try {
      const token = session?.access_token;
      if (token) {
        await supabase.functions.invoke('delete-demo-account', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.warn('[DemoBanner] delete-demo-account failed, signing out anyway:', err);
    } finally {
      await signOut();
      setIsExiting(false);
      setShowConfirm(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <>
      <div className="demo-banner" role="status" aria-label="Demo sandbox notification">
        <span className="demo-banner-text">
          Demo with sample data. Your changes are private and deleted after 7 days.
        </span>
        <button
          type="button"
          className="demo-banner-exit-btn"
          onClick={() => setShowConfirm(true)}
          aria-label="Exit demo mode"
        >
          Exit demo
        </button>
      </div>

      {showConfirm && (
        <ModalPortal>
          <div
            className="sheet-backdrop"
            style={{ zIndex: 1000 }}
            onClick={() => !isExiting && setShowConfirm(false)}
          >
            <div
              className="sheet-content confirmation-sheet-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 360,
                textAlign: 'center',
                borderRadius: 24,
                padding: '24px 20px',
              }}
            >
              <div className="entry-delete-confirm-box" style={{ margin: 0 }}>
                <p className="entry-delete-confirm-text" style={{ fontSize: 18, marginBottom: 8 }}>
                  Exit the demo?
                </p>
                <p className="entry-delete-confirm-sub" style={{ fontSize: 14, marginBottom: 20 }}>
                  Your sandbox will be deleted.
                </p>
                <div className="sheet-button-row">
                  <Button
                    variant="secondary"
                    disabled={isExiting}
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isExiting}
                    onClick={handleExitDemo}
                  >
                    {isExiting ? 'Exiting...' : 'Exit demo'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};
