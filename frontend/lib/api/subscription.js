import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../axios';

// Query keys for subscription
export const subscriptionKeys = {
  all: ['subscription'],
  detail: () => [...subscriptionKeys.all, 'detail'],
};

// API functions
const subscriptionApi = {
  // Get subscription
  get: async () => {
    const response = await apiClient.get('/api/subscription');
    return response.data;
  },

  // Create subscription
  create: async (subscriptionData) => {
    const response = await apiClient.post('/api/subscription', subscriptionData);
    return response.data;
  },

  // Cancel subscription (developer only)
  cancel: async () => {
    const response = await apiClient.put('/api/subscription');
    return response.data;
  },

  // Auto-expire subscription (any authenticated user)
  expire: async () => {
    const response = await apiClient.patch('/api/subscription');
    return response.data;
  },
};

// React Query hooks
export const useSubscription = (options = {}) => {
  return useQuery({
    queryKey: subscriptionKeys.detail(),
    queryFn: () => subscriptionApi.get(),
    refetchInterval: false, // Manual control - no auto-refresh (handled in _app.js)
    refetchIntervalInBackground: false,
    staleTime: 10 * 60 * 1000, // Consider data stale after 10 minutes
    retry: 2,
    retryDelay: 1000,
    ...options,
  });
};

// Mutations
export const useCreateSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionData) => subscriptionApi.create(subscriptionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.detail() });
    },
  });
};

export const useCancelSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => subscriptionApi.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.detail() });
    },
  });
};

export const useExpireSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => subscriptionApi.expire(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.detail() });
    },
  });
};
