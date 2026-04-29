import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '@/src/lib/logger';
import { ApiResponse } from '@/src/types';

/**
 * Standardized API Client using Axios.
 * Implements global error handling, interceptors, and request management.
 */

const rawApiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const API_BASE_URL = rawApiBaseUrl === '/api' ? '' : rawApiBaseUrl;
const REQUEST_TIMEOUT = 30000; // 30 seconds

export class ApiError extends Error {
    status?: number | undefined;
    code?: string | undefined;
    details?: unknown | undefined;

    constructor(message: string, status?: number, code?: string, details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            params: config.params,
        });
        return config;
    },
    (error: AxiosError) => {
        logger.error('API Request Error', error);
        return Promise.reject(error);
    }
);

// Response Interceptor
apiClient.interceptors.response.use(
    (response: AxiosResponse) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);

        const data = response.data as ApiResponse<any>;
        if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
            if (data.success) {
                return {
                    ...response,
                    data: data.data,
                };
            }
            return Promise.reject(new ApiError(data.error || data.message || 'Business Error', response.status, data.code || data.errorCode));
        }

        return response;
    },
    async (error: AxiosError) => {
        const status = error.response?.status;
        const url = error.config?.url;
        const normalizedUrl = (url || '').split('?')[0];
        const isAuthMeProbe = normalizedUrl.endsWith('/api/auth/me');

        if (!(status === 401 && isAuthMeProbe)) {
            logger.error(`API Error: ${status || 'Unknown'} ${url}`, error.response?.data);
        }

        if (status === 401 && !isAuthMeProbe) {
            logger.warn('Unauthorized access detected. Redirecting to login.');
            if (typeof window !== 'undefined') {
                localStorage.removeItem('auth_user');
                if (!window.location.pathname.startsWith('/login')) {
                    window.location.href = '/login';
                }
            }
        }

        const apiResponse = error.response?.data as any;
        const apiErrorMessage = apiResponse?.error || apiResponse?.message || error.message || 'An unexpected error occurred';
        const apiErrorCode = apiResponse?.code || apiResponse?.errorCode;

        return Promise.reject(new ApiError(apiErrorMessage, status, apiErrorCode, error.response?.data));
    }
);

export default apiClient;
