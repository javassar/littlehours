import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { ensureUserSettings, UserSettings } from './settings';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  settings: UserSettings | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
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
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
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

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return {
        error: 'Supabase credentials are missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
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
        signOut,
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
