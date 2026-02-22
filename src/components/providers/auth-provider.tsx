'use client';

import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthService } from '@/src/api/services/auth.service';
import { User, LoginRequest } from '@/src/types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    authenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    const fetchUser = useCallback(async () => {
        try {
            const userData = await AuthService.me();
            setUser(userData);
            setAuthenticated(true);
        } catch (error) {
            console.error('Authentication check failed', error);
            setUser(null);
            setAuthenticated(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const login = async (username: string, password: string) => {
        setLoading(true);
        try {
            const request: LoginRequest = { username: username.trim(), password };
            const userData = await AuthService.login(request);
            setUser(userData);
            setAuthenticated(true);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        await AuthService.logout();
        setUser(null);
        setAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            authenticated,
            login,
            logout,
            refreshUser: fetchUser
        }}>
            {children}
        </AuthContext.Provider>
    );
}
