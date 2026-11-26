'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, googleProvider, testFirestoreConnection } from '@/lib/firebase';
import {
  checkIsAdmin,
  ensureUserProfile,
} from '@/lib/firestore-service';
import { UserPrivateInfo, UserProfile } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  isAdmin: boolean;
  loading: boolean;
  authReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (params: {
    email: string;
    password: string;
    displayName: string;
    drivingSchool?: string;
    province?: string;
  }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const loadUserContext = useCallback(async (firebaseUser: User) => {
    const [{ profile: prof, privateInfo: priv }, adminStatus] = await Promise.all([
      ensureUserProfile(firebaseUser),
      checkIsAdmin(firebaseUser),
    ]);
    setProfile(prof);
    setPrivateInfo(priv);
    setIsAdmin(adminStatus);
  }, []);

  useEffect(() => {
    void testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          await loadUserContext(firebaseUser);
        } catch (err) {
          console.error('Erro ao carregar perfil:', err);
        }
      } else {
        setProfile(null);
        setPrivateInfo(null);
        setIsAdmin(false);
      }
      setLoading(false);
      setAuthReady(true);
    });
    return () => unsub();
  }, [loadUserContext]);

  const signInWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await loadUserContext(cred.user);
  }, [loadUserContext]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await loadUserContext(cred.user);
    },
    [loadUserContext]
  );

  const registerWithEmail = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
      drivingSchool?: string;
      province?: string;
    }) => {
      const cred = await createUserWithEmailAndPassword(
        auth,
        params.email.trim(),
        params.password
      );
      await updateProfile(cred.user, {
        displayName: params.displayName.trim(),
      });
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // Non-blocking if email quota rate limited
      }
      const { profile: prof, privateInfo: priv } = await ensureUserProfile(
        cred.user,
        {
          displayName: params.displayName,
          drivingSchool: params.drivingSchool,
          province: params.province,
        }
      );
      const adminStatus = await checkIsAdmin(cred.user);
      setProfile(prof);
      setPrivateInfo(priv);
      setIsAdmin(adminStatus);
    },
    []
  );

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setPrivateInfo(null);
    setIsAdmin(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      await loadUserContext(auth.currentUser);
    }
  }, [loadUserContext]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        privateInfo,
        isAdmin,
        loading,
        authReady,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return ctx;
}
