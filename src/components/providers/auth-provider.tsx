'use client';

import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthService } from '@/src/api/services/auth.service';
import { User, LoginRequest } from '@/src/types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    authenticated: boolean;
    login: (email: string, password?: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    const fetchUser = useCallback(async () => {
        try {
            // Dans le fournisseur, on ne met loading=true que si on n'a pas déjà de données
            // ou si on veut forcer un reload.
            if (AuthService.isAuthenticated()) {
                const userData = await AuthService.me();
                setUser(userData);
                setAuthenticated(true);
            } else {
                setUser(null);
                setAuthenticated(false);
            }
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

    const login = async (email: string, password?: string) => {
        setLoading(true);
        try {
            const request: LoginRequest = { email };
            if (password !== undefined) {
                request.password = password;
            }
            const response = await AuthService.login(request);
            setUser(response.user);
            setAuthenticated(true);
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        AuthService.logout();
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
