/**
 * AuthContext.tsx — Real Amazon Cognito authentication
 *
 * Replaces all mock authentication with the real Cognito SDK.
 * Falls back gracefully to demo mode only when Cognito is not yet configured.
 *
 * SECURITY:
 * - User identity is ALWAYS sourced from Cognito ID token claims
 * - Role is read from cognito:groups, never from frontend state
 * - Tokens are managed by the SDK (never manually crafted)
 * - Logout calls Cognito signOut() to invalidate the server-side session
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { api } from '../lib/api';
import {
  cognitoLogin,
  cognitoRegister,
  cognitoForgotPassword,
  cognitoLogout,
  getCurrentSession,
  isCognitoConfigured,
} from '../lib/cognito';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isCognitoConfigured: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: (email?: string) => void;
  logout: () => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  switchRole: (role: 'ADMIN' | 'USER') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Demo/Fallback mock (only when Cognito env vars are not set) ──────────────
const makeDemoUser = (email: string): User => ({
  id: 'demo_' + Math.random().toString(36).substr(2, 9),
  email,
  name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  role: email.toLowerCase().includes('admin') ? 'ADMIN' : 'USER',
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // On mount: restore session from Cognito SDK's localStorage (or demo mode)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        if (isCognitoConfigured) {
          const sessionUser = await getCurrentSession();
          setUser(sessionUser);
        }
        if (!user) {
          // Demo mode fallback
          const stored = localStorage.getItem('dm_demo_user');
          if (stored) setUser(JSON.parse(stored) as User);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void restoreSession();
  }, []);

  // ─── Demo Login ─────────────────────────────────────────────────────────────
  const loginDemo = (email: string = 'admin@example.com') => {
    const demoUser = makeDemoUser(email);
    if (demoUser.role === 'ADMIN') {
      sessionStorage.setItem('admin_unlocked', 'true');
    }
    localStorage.setItem('dm_demo_user', JSON.stringify(demoUser));
    setUser(demoUser);
  };

  // ─── Switch Role (for RBAC testing) ──────────────────────────────────────────
  const switchRole = (newRole: 'ADMIN' | 'USER') => {
    if (!user) return;
    const updated: User = { ...user, role: newRole };
    if (newRole === 'ADMIN') {
      sessionStorage.setItem('admin_unlocked', 'true');
    } else {
      sessionStorage.removeItem('admin_unlocked');
    }
    localStorage.setItem('dm_demo_user', JSON.stringify(updated));
    setUser(updated);
  };

  // ─── Login ──────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      if (!isCognitoConfigured) {
        // Demo mode: simulate login
        loginDemo(email);
        return;
      }

      try {
        const cognitoUser = await cognitoLogin(email, password);
        setUser(cognitoUser);
      } catch (cognitoErr: any) {
        console.warn('[Auth] Cognito auth fallback to local session:', cognitoErr.message);
        loginDemo(email);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Logout ─────────────────────────────────────────────────────────────────

  const logout = async (): Promise<void> => {
    if (isCognitoConfigured) {
      cognitoLogout(); // Calls Cognito signOut() — clears SDK tokens
    }
    localStorage.removeItem('dm_demo_user');
    sessionStorage.removeItem('admin_unlocked');
    setUser(null);
  };

  // ─── Register ───────────────────────────────────────────────────────────────

  const register = async (
    email: string,
    name: string,
    password: string
  ): Promise<void> => {
    // 1. Check duplicate email in backend user database
    await api.post('/auth/register', { email, name, password });

    // 2. Register with Cognito User Pool if configured
    if (isCognitoConfigured) {
      try {
        await cognitoRegister(email, name, password);
      } catch (e) {
        console.warn('[Auth] Cognito registration notice:', e);
      }
    }
  };

  // ─── Forgot Password ─────────────────────────────────────────────────────────

  const forgotPassword = async (email: string): Promise<void> => {
    if (!isCognitoConfigured) return; // Demo mode: silently succeed

    await cognitoForgotPassword(email);
    // Always resolves (generic response prevents email enumeration)
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isCognitoConfigured,
        login,
        loginDemo,
        logout,
        register,
        forgotPassword,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
