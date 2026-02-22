"use client";

import { useContext } from 'react';
import { AuthContext } from '@/src/components/providers/auth-provider';
import { UserRole } from '@/src/types';

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    const { user, loading, authenticated, login, logout, refreshUser } = context;

    const hasRole = (roles: UserRole | UserRole[]) => {
        if (!user) return false;
        const roleArray = Array.isArray(roles) ? roles : [roles];
        return roleArray.includes(user.role);
    };

    const isComptable = () => hasRole(['COMPTABLE', 'ADMIN']);
    const isAdmin = () => hasRole('ADMIN');
    const isClient = () => hasRole('CLIENT');

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
