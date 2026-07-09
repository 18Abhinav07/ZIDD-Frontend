"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import { invalidateAuthCache } from '@/services/api';
import {
  getMe,
  getMeActivity,
  invalidateMeActivityCache,
  invalidateMeCache,
  type MeActivity,
  type MeResponse,
} from '@/services/me';
import {
  getBalance,
  invalidateBalanceCache,
} from '@/services/billing';
import { invalidateProgressionCache } from '@/services/progression';
import { invalidateSchoolCache } from '@/services/school';
import type { CreditsBalance } from '@/types';

interface AppSessionContextValue {
  me: MeResponse | null;
  activity: MeActivity | null;
  balance: CreditsBalance | null;
  loadingMe: boolean;
  loadingBalance: boolean;
  loadingActivity: boolean;
  loadMe: (force?: boolean) => Promise<MeResponse>;
  loadActivity: (force?: boolean) => Promise<MeActivity>;
  loadBalance: (force?: boolean) => Promise<CreditsBalance>;
  clearAppSession: () => void;
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const { data: authSession, status } = useSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [activity, setActivity] = useState<MeActivity | null>(null);
  const [balance, setBalance] = useState<CreditsBalance | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const observedAccessTokenRef = useRef<string | null | undefined>(undefined);

  const clearAccountScopedCaches = useCallback(() => {
    invalidateAuthCache();
    invalidateMeCache();
    invalidateMeActivityCache();
    invalidateBalanceCache();
    invalidateSchoolCache();
    invalidateProgressionCache();
  }, []);

  const clearLocalState = useCallback(() => {
    setMe(null);
    setActivity(null);
    setBalance(null);
  }, []);

  const clearAppSession = useCallback(() => {
    clearAccountScopedCaches();
    clearLocalState();
  }, [clearAccountScopedCaches, clearLocalState]);

  const loadMe = useCallback(async (force = false) => {
    if (force) invalidateMeCache();
    setLoadingMe(true);
    try {
      const profile = await getMe();
      setMe(profile);
      return profile;
    } finally {
      setLoadingMe(false);
    }
  }, []);

  const loadActivity = useCallback(async (force = false) => {
    if (force) invalidateMeActivityCache();
    setLoadingActivity(true);
    try {
      const nextActivity = await getMeActivity();
      setActivity(nextActivity);
      return nextActivity;
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  const loadBalance = useCallback(async (force = false) => {
    if (force) invalidateBalanceCache();
    setLoadingBalance(true);
    try {
      const nextBalance = await getBalance({ force });
      setBalance(nextBalance);
      return nextBalance;
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  useEffect(() => {
    const accessToken = authSession?.accessToken ?? null;
    if (status === 'authenticated') {
      const accountChanged = observedAccessTokenRef.current !== accessToken;
      if (accountChanged) {
        observedAccessTokenRef.current = accessToken;
        clearAccountScopedCaches();
        clearLocalState();
      }
      void loadMe(accountChanged).catch(() => null);
      void loadBalance(accountChanged).catch(() => null);
      return;
    }
    if (status === 'unauthenticated') {
      observedAccessTokenRef.current = null;
      clearAppSession();
    }
  }, [
    authSession?.accessToken,
    clearAccountScopedCaches,
    clearAppSession,
    clearLocalState,
    loadBalance,
    loadMe,
    status,
  ]);

  const value = useMemo<AppSessionContextValue>(() => ({
    me,
    activity,
    balance,
    loadingMe,
    loadingBalance,
    loadingActivity,
    loadMe,
    loadActivity,
    loadBalance,
    clearAppSession,
  }), [
    me,
    activity,
    balance,
    loadingMe,
    loadingBalance,
    loadingActivity,
    loadMe,
    loadActivity,
    loadBalance,
    clearAppSession,
  ]);

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const value = useContext(AppSessionContext);
  if (!value) {
    throw new Error('useAppSession must be used inside AppSessionProvider');
  }
  return value;
}
