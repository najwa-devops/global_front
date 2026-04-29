import apiClient from '../api-client';
import { ApiError } from '../api-client';
import { LoginRequest, User } from '@/src/types';

const AUTH_USER_KEY = 'auth_user';
const CURRENT_DOSSIER_ID_KEY = 'currentDossierId';
const CURRENT_DOSSIER_NAME_KEY = 'currentDossierName';

interface BackendUserPayload {
    id: number;
    username: string;
    role: User['role'];
    displayName?: string;
    active?: boolean;
}

interface BackendLoginResponse {
    message?: string;
    user: BackendUserPayload;
}

interface BackendMeResponse extends BackendUserPayload {}

function mapBackendUser(payload: BackendUserPayload): User {
    const username = payload.username || '';
    const displayName = payload.displayName || username || 'Utilisateur';
    const name = displayName || (username.includes('@') ? username.split('@')[0] : username);

    return {
        id: Number(payload.id),
        username,
        displayName,
        name,
        email: username,
        role: payload.role,
        active: payload.active ?? true,
    };
}

function storeUser(user: User) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearStoredUser() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_USER_KEY);
}

function clearStoredDossierSelection() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CURRENT_DOSSIER_ID_KEY);
    localStorage.removeItem(CURRENT_DOSSIER_NAME_KEY);
}

/**
 * Service for Authentication.
 * Handles login, logout, and session management.
 */
export class AuthService {
    static async login(request: LoginRequest): Promise<User> {
        clearStoredDossierSelection();
        const response = await apiClient.post<BackendLoginResponse>('/api/auth/login', request);
        const userPayload = response.data.user;
        const mapped = mapBackendUser(userPayload);
        storeUser(mapped);
        return mapped;
    }

    static async me(): Promise<User> {
        try {
            const response = await apiClient.get<BackendMeResponse>('/api/auth/me');
            const mapped = mapBackendUser(response.data);
            storeUser(mapped);
            return mapped;
        } catch (error) {
            clearStoredUser();
            if (error instanceof ApiError) {
                throw error;
            }
            throw new Error('Unable to fetch current user');
        }
    }

    static async logout(): Promise<void> {
        clearStoredUser();
        clearStoredDossierSelection();
        try {
            await apiClient.post('/api/auth/logout');
        } catch {
            // ignore logout errors
        }
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }

    static isAuthenticated(): boolean {
        if (typeof window === 'undefined') return false;
        return !!localStorage.getItem(AUTH_USER_KEY);
    }
}
