import { useQuery } from '@tanstack/react-query';
import apiClient from '../axios';

// Query keys for system config
export const systemKeys = {
  all: ['system'],
  config: () => [...systemKeys.all, 'config'],
};

// API functions
const systemApi = {
  // Get system config
  getConfig: async () => {
    const response = await apiClient.get('/api/system/config');
    return response.data;
  },
};

// React Query hooks
export const useSystemConfig = (options = {}) => {
  return useQuery({
    queryKey: systemKeys.config(),
    queryFn: () => systemApi.getConfig(),
    staleTime: 60 * 60 * 1000, // 1 hour (system config doesn't change often)
    retry: 1,
    ...options,
  });
};
