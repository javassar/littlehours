import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ConfirmModal } from './ConfirmModal';
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

      <ConfirmModal
        isOpen={showConfirm}
        title="Exit the demo?"
        message="Your sandbox will be deleted."
        confirmLabel="Exit demo"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isExiting}
        loadingLabel="Exiting..."
        onConfirm={handleExitDemo}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
};
