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
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, testFirestoreConnection } from '@/lib/firebase';
import {
  checkIsAdmin,
  ensureUserProfile,
  fetchMyStaffPermission,
  isValidEmailAddress,
  normalizeEmailKey,
} from '@/lib/firestore-service';
import { StaffPermission, UserPrivateInfo, UserProfile } from '@/lib/types';
import { isAppOwnerEmail } from '@/lib/url-safety';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  staffPermission: StaffPermission | null;
  isAdmin: boolean;
  isOwner: boolean;
  canViewReserved: boolean;
  canAnnounce: boolean;
  loading: boolean;
  authReady: boolean;
  totpVerified: boolean;
  totpChecking: boolean;
  totpRequired: boolean;
  markTotpVerified: (verified: boolean) => void;
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
  const [staffPermission, setStaffPermission] = useState<StaffPermission | null>(
    null
  );
  const [hasLegacyAdminDoc, setHasLegacyAdminDoc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [verifiedTotpUid, setVerifiedTotpUid] = useState<string | null>(null);
  const [checkedTotpUid, setCheckedTotpUid] = useState<string | null>(null);

  const loadUserContext = useCallback(async (firebaseUser: User) => {
    const [{ profile: prof, privateInfo: priv }, adminStatus, staffPerm] =
      await Promise.all([
        ensureUserProfile(firebaseUser),
        checkIsAdmin(firebaseUser),
        fetchMyStaffPermission(firebaseUser),
      ]);
    setProfile(prof);
    setPrivateInfo(priv);
    setHasLegacyAdminDoc(adminStatus);
    setStaffPermission(staffPerm);
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
        setStaffPermission(null);
        setHasLegacyAdminDoc(false);
        setVerifiedTotpUid(null);
        setCheckedTotpUid(null);
      }
      setLoading(false);
      setAuthReady(true);
    });
    return () => unsub();
  }, [loadUserContext]);

  // Real-time listeners for user profile & private preferences so Dashboard, Estatísticas, and Perfil update live
  useEffect(() => {
    if (!user) return;
    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      () => {
        // Non-blocking fallback to loaded profile
      }
    );
    const unsubPrivate = onSnapshot(
      doc(db, 'users', user.uid, 'private', 'info'),
      (snap) => {
        if (snap.exists()) {
          setPrivateInfo(snap.data() as UserPrivateInfo);
        }
      },
      () => {
        // Non-blocking fallback
      }
    );

    const emailKey =
      user.email && user.emailVerified ? normalizeEmailKey(user.email) : '';
    const unsubStaff =
      emailKey && isValidEmailAddress(emailKey)
        ? onSnapshot(
            doc(db, 'staff_permissions', emailKey),
            (snap) => {
              setStaffPermission(
                snap.exists() ? (snap.data() as StaffPermission) : null
              );
            },
            () => {
              // Non-blocking fallback
            }
          )
        : () => {};

    return () => {
      unsubProfile();
      unsubPrivate();
      unsubStaff();
    };
  }, [user]);

  const totpEnabled = Boolean(
    user && privateInfo?.totpEnabled && privateInfo?.totpSealedSecret
  );

  // Check server HttpOnly 2FA session cookie when account has Google Authenticator enabled
  useEffect(() => {
    if (!user || !totpEnabled) return;
    let cancelled = false;
    const uid = user.uid;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/auth/totp/status', {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: 'no-store',
        });
        const data = (await res.json()) as { verified?: boolean };
        if (!cancelled) {
          setVerifiedTotpUid(data.verified ? uid : null);
          setCheckedTotpUid(uid);
        }
      } catch {
        if (!cancelled) {
          setVerifiedTotpUid(null);
          setCheckedTotpUid(uid);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, totpEnabled]);

  const markTotpVerified = useCallback((verified: boolean) => {
    const uid = auth.currentUser?.uid || null;
    setVerifiedTotpUid(verified ? uid : null);
    if (uid) {
      setCheckedTotpUid(uid);
    }
  }, []);

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
      setHasLegacyAdminDoc(adminStatus);
    },
    []
  );

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/totp/status', { method: 'DELETE' }).catch(() => {});
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setPrivateInfo(null);
    setStaffPermission(null);
    setHasLegacyAdminDoc(false);
    setVerifiedTotpUid(null);
    setCheckedTotpUid(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      await loadUserContext(auth.currentUser);
    }
  }, [loadUserContext]);

  const isOwner = Boolean(
    user && isAppOwnerEmail(user.email) && user.emailVerified
  );
  const staffActive = Boolean(
    user && user.emailVerified && staffPermission?.active
  );
  const isAdmin = Boolean(
    isOwner || hasLegacyAdminDoc || (staffActive && staffPermission?.canAdmin)
  );
  const canAnnounce = Boolean(
    isOwner || (staffActive && staffPermission?.canAnnounce)
  );
  const canViewReserved = Boolean(
    isOwner ||
      isAdmin ||
      canAnnounce ||
      (staffActive && staffPermission?.canViewReserved)
  );

  const totpVerified = !totpEnabled || verifiedTotpUid === user?.uid;
  const totpChecking =
    totpEnabled && checkedTotpUid !== user?.uid && verifiedTotpUid !== user?.uid;
  const totpRequired = totpEnabled && !totpVerified;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        privateInfo,
        staffPermission,
        isAdmin,
        isOwner,
        canViewReserved,
        canAnnounce,
        loading,
        authReady,
        totpVerified,
        totpChecking,
        totpRequired,
        markTotpVerified,
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
