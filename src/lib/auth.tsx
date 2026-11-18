import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { ensureUserSettings, UserSettings } from './settings';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  settings: UserSettings | null;
  loading: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>;
  signInAnonymously: (captchaToken?: string) => Promise<{ error: string | null; user?: User | null }>;
  signOut: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // 1. Get initial session
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (initialSession?.user?.is_anonymous) {
        // Milestone 3.9 Step 4 item 6: Check if anonymous user was deleted by cleanup job
        const { error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          console.warn('[auth] Anonymous session ended or user was deleted:', userErr.message);
          await supabase.auth.signOut();
          sessionStorage.setItem('demo_session_ended', 'true');
          setSession(null);
          setUser(null);
          setSettings(null);
          setLoading(false);
          return;
        }
      }

      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        ensureUserSettings(initialSession.user.id).then((userSettings) => {
          if (userSettings) setSettings(userSettings);
        });
      }
      setLoading(false);
    });

    // 2. Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        const userSettings = await ensureUserSettings(newSession.user.id);
        if (userSettings) setSettings(userSettings);
      } else {
        setSettings(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string,
    captchaToken?: string
  ): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return {
        error: 'Supabase credentials are missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: captchaToken ? { captchaToken } : undefined,
      });

      if (error) {
        // Map Supabase error to a gentle, short sentence with no exclamation marks
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          return {
            error: "That email or password doesn't match this account. Please check your spelling and try again.",
          };
        }
        if (msg.includes('email not confirmed')) {
          return {
            error: "This email address has not been confirmed yet. Please check your email inbox to confirm it.",
          };
        }
        return {
          error: `${error.message.replace(/\.$/, '')}. Please check your details and try again.`,
        };
      }

      if (data.user) {
        const userSettings = await ensureUserSettings(data.user.id);
        if (userSettings) setSettings(userSettings);
      }

      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown connection error';
      return {
        error: `We couldn't connect right now (${message}). Please check your connection and try again.`,
      };
    }
  };

  const signInAnonymously = async (
    captchaToken?: string
  ): Promise<{ error: string | null; user?: User | null }> => {
    if (!isSupabaseConfigured) {
      return {
        error: 'Supabase credentials are missing.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInAnonymously({
        options: captchaToken ? { captchaToken } : undefined,
      });

      if (error) {
        return { error: error.message };
      }

      setSession(data.session);
      setUser(data.user);
      return { error: null, user: data.user };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown connection error';
      return { error: message };
    }
  };

  const refreshSettings = async () => {
    if (user) {
      const userSettings = await ensureUserSettings(user.id);
      if (userSettings) setSettings(userSettings);
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setSession(null);
      setUser(null);
      setSettings(null);
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSettings(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        settings,
        loading,
        signIn,
        signInAnonymously,
        signOut,
        refreshSettings,
        isConfigured: isSupabaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
