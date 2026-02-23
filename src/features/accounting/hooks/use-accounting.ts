'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AccountingService } from '@/src/api/services/accounting.service';
import { CreateAccountRequest, UpdateAccountRequest, CreateTierRequest, UpdateTierRequest } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { logger } from '@/src/lib/logger';
import { toast } from 'sonner';

export function useAccounting() {
    const queryClient = useQueryClient();
    const { authenticated, loading } = useAuth();
    const canRunQueries = authenticated && !loading;
    const dossierId = typeof window !== 'undefined' ? window.localStorage.getItem('currentDossierId') : null;

    // Queries
    const accountsQuery = useQuery({
        queryKey: ['accounts'],
        queryFn: () => AccountingService.getAccounts(false),
        enabled: canRunQueries,
    });

    const tiersQuery = useQuery({
        queryKey: ['tiers', dossierId],
        queryFn: () => AccountingService.getAllTiers(false),
        enabled: canRunQueries,
    });

    // Mutations
    const createAccountMutation = useMutation({
        mutationFn: (data: CreateAccountRequest) => AccountingService.createAccount(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            logger.info('Account created successfully');
        },
        onError: (error) => {
            logger.error('Failed to create account', error);
            toast.error('Failed to create account');
        },
    });

    const updateAccountMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateAccountRequest }) =>
            AccountingService.updateAccount(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            logger.info('Account updated successfully');
        },
        onError: (error) => {
            logger.error('Failed to update account', error);
            toast.error('Failed to update account');
        },
    });

    const createTierMutation = useMutation({
        mutationFn: (data: CreateTierRequest) => AccountingService.createTier(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tiers'] });
            logger.info('Tier created successfully');
        },
        onError: (error) => {
            logger.error('Failed to create tier', error);
            toast.error('Failed to create tier');
        },
    });

    const deactivateTierMutation = useMutation({
        mutationFn: (id: number) => AccountingService.deactivateTier(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tiers'] });
            logger.info('Tier deactivated successfully');
        },
        onError: (error) => {
            logger.error('Failed to deactivate tier', error);
            toast.error('Failed to deactivate tier');
        },
    });

    const updateTierMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateTierRequest }) =>
            AccountingService.updateTier(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tiers'] });
            logger.info('Tier updated successfully');
        },
        onError: (error) => {
            logger.error('Failed to update tier', error);
            toast.error('Failed to update tier');
        },
    });

    return {
        accounts: accountsQuery.data || [],
        tiers: tiersQuery.data || [],
        isLoading: accountsQuery.isLoading || tiersQuery.isLoading,
        isError: accountsQuery.isError || tiersQuery.isError,
        createAccount: createAccountMutation.mutateAsync,
        updateAccount: updateAccountMutation.mutateAsync,
        createTier: createTierMutation.mutateAsync,
        updateTier: updateTierMutation.mutateAsync,
        deactivateTier: deactivateTierMutation.mutateAsync,
    };
}
