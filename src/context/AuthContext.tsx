import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';
import type { TeacherProfile } from '../types';

interface AuthContextValue {
  teacher: TeacherProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    const profile = await authApi.me();
    setTeacher(profile);
  }, []);

  useEffect(() => {
    refreshProfile()
      .catch((err) => {
        console.error('Failed to load workspace teacher profile:', err);
      })
      .finally(() => setIsLoading(false));
  }, [refreshProfile]);

  return (
    <AuthContext.Provider value={{ teacher, isLoading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
