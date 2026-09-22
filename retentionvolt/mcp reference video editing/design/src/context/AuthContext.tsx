'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  hearSource?: string;
  useCase?: 'Work' | 'Personal' | 'Education' | string;
  plan: 'free' | 'pro';
  avatarUrl?: string;
  createdAt: string;
  onboardingCompleted?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  onboardingCompleted: boolean;
  sendOtpCode: (email: string) => Promise<{ success: boolean; error?: string; devCode?: string }>;
  verifyOtpCode: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string; redirecting?: boolean }>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  /** Re-reads the live session from Supabase and syncs local plan (used after Stripe redirect). */
  refreshSession: () => Promise<'free' | 'pro' | null>;
  completeOnboarding: (data: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  loginAsDemo: (customName?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'retentionvolt_user_profile_v1';
const ONBOARDING_KEY = 'retentionvolt_onboarding_completed_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Initialize from LocalStorage and Supabase Session
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedProfile = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedProfile) {
          try {
            const parsed = JSON.parse(storedProfile);
            setUser(parsed);
            const isCompleted = Boolean(
              parsed?.onboardingCompleted ||
              (parsed?.id && localStorage.getItem(`retentionvolt_onboarding_${parsed.id}`) === 'true')
            );
            setOnboardingCompleted(isCompleted);
          } catch (e) {
            console.error('Failed to parse stored user profile', e);
          }
        }

        // If Supabase is available, sync live session
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const meta = session.user.user_metadata || {};
            const isCompleted = Boolean(
              meta.onboarding_completed ||
              meta.onboardingCompleted ||
              localStorage.getItem(`retentionvolt_onboarding_${session.user.id}`) === 'true'
            );
            const liveUser: UserProfile = {
              id: session.user.id,
              email: session.user.email || '',
              name: meta.name || meta.full_name || session.user.email?.split('@')[0] || 'Creator',
              role: meta.role || (isCompleted ? 'Video Editor' : ''),
              hearSource: meta.hearSource || '',
              useCase: meta.useCase || '',
              plan: meta.plan || 'free',
              avatarUrl: meta.avatar_url || meta.picture || '',
              createdAt: session.user.created_at,
              onboardingCompleted: isCompleted,
            };
            setUser(liveUser);
            setOnboardingCompleted(isCompleted);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(liveUser));
            if (isCompleted) {
              localStorage.setItem(ONBOARDING_KEY, 'true');
              localStorage.setItem(`retentionvolt_onboarding_${session.user.id}`, 'true');
            } else {
              localStorage.removeItem(ONBOARDING_KEY);
              localStorage.removeItem(`retentionvolt_onboarding_${session.user.id}`);
            }
          }

          // Listen to auth state changes (e.g. OAuth redirect return)
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
              const meta = session.user.user_metadata || {};
              const appMeta = session.user.app_metadata || {};
              const isCompleted = Boolean(
                meta.onboarding_completed ||
                meta.onboardingCompleted ||
                localStorage.getItem(`retentionvolt_onboarding_${session.user.id}`) === 'true'
              );
              const livePlan = appMeta.plan === 'pro' || meta.plan === 'pro' ? 'pro' : 'free';
              const liveUser: UserProfile = {
                id: session.user.id,
                email: session.user.email || '',
                name: meta.name || meta.full_name || session.user.email?.split('@')[0] || 'Creator',
                role: meta.role || (isCompleted ? 'Video Editor' : ''),
                hearSource: meta.hearSource || '',
                useCase: meta.useCase || '',
                plan: livePlan,
                avatarUrl: meta.avatar_url || meta.picture || '',
                createdAt: session.user.created_at,
                onboardingCompleted: isCompleted,
              };
              setUser(liveUser);
              setOnboardingCompleted(isCompleted);
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(liveUser));
              if (isCompleted) {
                localStorage.setItem(ONBOARDING_KEY, 'true');
                localStorage.setItem(`retentionvolt_onboarding_${session.user.id}`, 'true');
              } else {
                localStorage.removeItem(ONBOARDING_KEY);
                localStorage.removeItem(`retentionvolt_onboarding_${session.user.id}`);
              }
            } else if (event === 'SIGNED_OUT') {
              setUser(null);
              setOnboardingCompleted(false);
              localStorage.removeItem(LOCAL_STORAGE_KEY);
              localStorage.removeItem(ONBOARDING_KEY);
            }
          });

          cleanupListener = () => {
            subscription.unsubscribe();
          };
        }
      } catch (err) {
        console.warn('Auth initialization fallback:', err);
      } finally {
        setIsLoading(false);
      }
    };

    let cleanupListener: (() => void) | undefined;
    initAuth();

    return () => {
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, []);

  // Send temporary login OTP code to email
  const sendOtpCode = async (email: string) => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
          },
        });
        if (error) {
          console.warn('Supabase signInWithOtp error:', error.message);
          if (process.env.NODE_ENV !== 'production') {
            return { success: true, devCode: '123456' };
          }
          return { success: false, error: error.message };
        }
        return { success: true };
      } else {
        if (process.env.NODE_ENV !== 'production') {
          return { success: true, devCode: '123456' };
        }
        return { success: false, error: 'Auth service not configured' };
      }
    } catch (err: any) {
      console.error('Error sending OTP:', err);
      if (process.env.NODE_ENV !== 'production') {
        return { success: true, devCode: '123456' };
      }
      return { success: false, error: (err as any)?.message || 'Failed to send code' };
    }
  };

  // Verify OTP code
  const verifyOtpCode = async (email: string, token: string) => {
    try {
      // Dev-only bypass — disabled in production
      const isDevBypass = process.env.NODE_ENV !== 'production';
      if (isDevBypass && (token === '123456' || token === '263752')) {
        const newUser: UserProfile = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          name: email.split('@')[0].replace(/[._+]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          role: 'Video Editor',
          plan: 'free',
          createdAt: new Date().toISOString(),
        };
        setUser(newUser);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
        return { success: true };
      }

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'email',
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data?.user) {
          const meta = data.user.user_metadata || {};
          const newUser: UserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            name: meta.name || email.split('@')[0],
            role: meta.role || 'Video Editor',
            plan: meta.plan || 'free',
            createdAt: data.user.created_at,
          };
          setUser(newUser);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
          return { success: true };
        }
      }

      return { success: false, error: 'Invalid verification code' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Verification failed' };
    }
  };

  // Sign in with Email & Password
  const signInWithPassword = async (email: string, password: string) => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data?.user) {
          const meta = data.user.user_metadata || {};
          const loggedUser: UserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            name: meta.name || email.split('@')[0],
            role: meta.role || 'Video Editor',
            plan: meta.plan || 'free',
            createdAt: data.user.created_at,
          };
          setUser(loggedUser);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loggedUser));
          return { success: true };
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        const fallbackUser: UserProfile = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          name: email.split('@')[0],
          role: 'Video Editor',
          plan: 'free',
          createdAt: new Date().toISOString(),
        };
        setUser(fallbackUser);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fallbackUser));
        return { success: true };
      }
      return { success: false, error: 'Auth service not configured' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Sign in failed' };
    }
  };

  // Sign up with Email & Password
  const signUpWithPassword = async (email: string, password: string) => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: 'Video Editor',
              plan: 'free',
            },
          },
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data?.user) {
          const newUser: UserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            name: email.split('@')[0],
            role: 'Video Editor',
            plan: 'free',
            createdAt: data.user.created_at,
          };
          setUser(newUser);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
          return { success: true };
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        const fallbackUser: UserProfile = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          name: email.split('@')[0],
          role: 'Video Editor',
          plan: 'free',
          createdAt: new Date().toISOString(),
        };
        setUser(fallbackUser);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fallbackUser));
        return { success: true };
      }
      return { success: false, error: 'Auth service not configured' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Sign up failed' };
    }
  };

  // Sign in with Google OAuth
  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string; redirecting?: boolean }> => {
    try {
      if (isSupabaseConfigured && supabase) {
        const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true, redirecting: true };
      } else {
        if (process.env.NODE_ENV !== 'production') {
          const demoUser: UserProfile = {
          id: 'usr_google_demo_' + Math.random().toString(36).substring(2, 7),
          email: 'alexsmith.mobbin@gmail.com',
          name: 'Alex Smith',
          role: '',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
          plan: 'free',
          createdAt: new Date().toISOString(),
          onboardingCompleted: false,
        };
        setUser(demoUser);
        setOnboardingCompleted(false);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(demoUser));
          localStorage.removeItem(ONBOARDING_KEY);
          return { success: true, redirecting: false };
        }
        return { success: false, error: 'Auth service not configured' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Google OAuth failed' };
    }
  };

  // Update profile details.
  // SECURITY: `plan` is NEVER writable from the client — it is set exclusively
  // by the Stripe webhook (service_role). Passing plan here is ignored so a
  // console one-liner can never self-grant Pro. Call refreshSession() instead
  // to pick up a plan change after checkout.
  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const { plan: _ignoredPlan, ...safeData } = data;
    const updated = { ...user, ...safeData };
    setUser(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.updateUser({
          data: {
            name: updated.name,
            full_name: updated.name,
            role: updated.role,
            hearSource: updated.hearSource,
            useCase: updated.useCase,
            onboarding_completed: updated.onboardingCompleted ?? true,
            onboardingCompleted: updated.onboardingCompleted ?? true,
          },
        });
      } catch (err) {
        console.warn('Could not sync user_metadata to Supabase:', err);
      }
    }
  };

  // Re-read live session (plan included) from Supabase — source of truth after
  // Stripe redirect. Returns the live plan, or null when no session exists.
  const refreshSession = async (): Promise<'free' | 'pro' | null> => {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) return null;
      const appMeta = (session.user.app_metadata || {}) as Record<string, unknown>;
      const userMeta = (session.user.user_metadata || {}) as Record<string, unknown>;
      const livePlan: 'free' | 'pro' =
        appMeta.plan === 'pro' || userMeta.plan === 'pro' ? 'pro' : 'free';
      setUser(prev => {
        if (!prev) return prev;
        const updated = { ...prev, plan: livePlan };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      return livePlan;
    } catch (err) {
      console.warn('Could not refresh session:', err);
      return null;
    }
  };

  // Complete Onboarding
  const completeOnboarding = async (data: Partial<UserProfile>) => {
    // SECURITY: Strip client-supplied 'plan' so users cannot self-assign Pro without paying
    const { plan: _ignoredPlan, ...safeData } = data;
    const currentPlan = user?.plan === 'pro' ? 'pro' : 'free';

    const updated: UserProfile = {
      ...(user || {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        email: '',
        name: '',
        role: 'Video Editor',
        plan: currentPlan,
        createdAt: new Date().toISOString(),
      }),
      ...safeData,
      plan: currentPlan,
      onboardingCompleted: true,
    };

    setUser(updated);
    setOnboardingCompleted(true);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(ONBOARDING_KEY, 'true');
    if (updated.id) {
      localStorage.setItem(`retentionvolt_onboarding_${updated.id}`, 'true');
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.updateUser({
          data: {
            name: updated.name,
            full_name: updated.name,
            role: updated.role,
            hearSource: updated.hearSource,
            useCase: updated.useCase,
            onboarding_completed: true,
            onboardingCompleted: true,
          },
        });
        if (error) {
          console.error('Supabase updateUser error in completeOnboarding:', error);
        }
      } catch (err) {
        console.warn('Could not sync onboarding metadata to Supabase:', err);
      }
    }
  };

  // Logout
  const logout = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Error during Supabase signout:', err);
    } finally {
      if (user?.id) {
        localStorage.removeItem(`retentionvolt_onboarding_${user.id}`);
      }
      setUser(null);
      setOnboardingCompleted(false);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(ONBOARDING_KEY);
    }
  };

  // Demo shortcut login — strictly disabled in production
  const loginAsDemo = (customName: string = 'Alex Smith') => {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Demo login is disabled in production environment');
      return;
    }
    const demoUser: UserProfile = {
      id: 'usr_demo_1',
      email: 'alexsmith.mobbin+1@gmail.com',
      name: customName,
      role: 'Video Editor',
      hearSource: 'YouTube',
      useCase: 'Work',
      plan: 'free',
      createdAt: new Date().toISOString(),
    };
    setUser(demoUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(demoUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: Boolean(user),
        isLoading,
        onboardingCompleted,
        sendOtpCode,
        verifyOtpCode,
        signInWithPassword,
        signUpWithPassword,
        signInWithGoogle,
        updateProfile,
        refreshSession,
        completeOnboarding,
        logout,
        loginAsDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
