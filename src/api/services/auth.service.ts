import apiClient from '../api-client';
import { LoginRequest, LoginResponse, User } from '@/src/types';
import { USE_MOCK, MOCK_USERS } from '@/src/mock/data.mock';

interface BackendLoginData {
    token: string;
    userId: number;
    email: string;
    role: User['role'];
}

/**
 * Service for Authentication.
 * Handles login, logout, and session management.
 */
export class AuthService {
    static async login(request: LoginRequest): Promise<LoginResponse> {
        if (USE_MOCK) {
            const user = MOCK_USERS[request.email];
            if (!user || request.password !== (user.password || 'password')) {
                throw new Error('Identifiants incorrects (Mode Mock)');
            }
            if (typeof window !== 'undefined') {
                localStorage.setItem('token', 'mock-jwt-token');
                localStorage.setItem('mock_user_email', user.email);
            }
            return {
                token: 'mock-jwt-token',
                user,
            };
        }

        const response = await apiClient.post<BackendLoginData>('/api/auth/login', request);
        const { token, userId, email, role } = response.data;

        const user: User = {
            id: userId,
            email,
            role,
            name: email.split('@')[0],
            active: true,
        };

        if (typeof window !== 'undefined') {
            localStorage.setItem('token', token);
            localStorage.setItem('auth_user', JSON.stringify(user));
        }

        return { token, user };
    }

    static async me(): Promise<User> {
        if (USE_MOCK) {
            if (typeof window !== 'undefined') {
                const email = localStorage.getItem('mock_user_email') || 'admin@example.com';
                return MOCK_USERS[email];
            }
            return MOCK_USERS['admin@example.com'];
        }

        try {
            const response = await apiClient.get<User>('/api/auth/me');
            if (typeof window !== 'undefined') {
                localStorage.setItem('auth_user', JSON.stringify(response.data));
            }
            return response.data;
        } catch {
            if (typeof window !== 'undefined') {
                const stored = localStorage.getItem('auth_user');
                if (stored) {
                    return JSON.parse(stored) as User;
                }
            }
            throw new Error('Unable to fetch current user');
        }
    }

    static logout(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('mock_user_email');
            localStorage.removeItem('auth_user');
            window.location.href = '/login';
        }
    }

    static isAuthenticated(): boolean {
        if (typeof window !== 'undefined') {
            return !!localStorage.getItem('token');
        }
        return false;
    }
}
