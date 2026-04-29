"use client";

import { useCallback, useContext } from 'react';
import { AuthContext } from '@/src/features/auth/viewmodel/auth-context';
import { UserRole } from '@/src/types';

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const { user, loading, authenticated, login, logout, refreshUser } = context;

  const hasRole = useCallback((roles: UserRole | UserRole[]) => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  }, [user]);

  const isComptable = useCallback(() => hasRole(['COMPTABLE', 'ADMIN']), [hasRole]);
  const isAdmin = useCallback(() => hasRole('ADMIN'), [hasRole]);
  const isClient = useCallback(() => hasRole('CLIENT'), [hasRole]);

  return {
    user,
    loading,
    authenticated,
    login,
    logout,
    hasRole,
    isComptable,
    isAdmin,
    isClient,
    refreshUser,
  };
};
