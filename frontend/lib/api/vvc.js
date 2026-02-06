import { useQuery } from '@tanstack/react-query';
import apiClient from '../axios';

// Query keys for VVC
export const vvcKeys = {
  all: ['vvc'],
  lists: () => [...vvcKeys.all, 'list'],
  list: (filters) => [...vvcKeys.lists(), { filters }],
};

// API functions
const vvcApi = {
  // Get all VVCs with pagination support
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    
    // Add pagination parameters
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    // Add filter parameters
    if (params.viewed !== undefined && params.viewed !== null && params.viewed !== '') {
      queryParams.append('viewed', params.viewed.toString());
    }
    if (params.code_state) queryParams.append('code_state', params.code_state);
    if (params.payment_state) queryParams.append('payment_state', params.payment_state);
    
    const queryString = queryParams.toString();
    const url = queryString ? `/api/vvc?${queryString}` : '/api/vvc';
    
    const response = await apiClient.get(url);
    return response.data;
  },
};

// Hook for paginated VVCs
export const useVVCPaginated = (params = {}, options = {}) => {
  const defaultParams = {
    page: 1,
    limit: 100,
    sortBy: 'date',
    sortOrder: 'desc',
    ...params
  };

  return useQuery({
    queryKey: [...vvcKeys.all, 'paginated', defaultParams],
    queryFn: () => vvcApi.getAll(defaultParams),
    keepPreviousData: true, // Keep previous data while loading new page
    ...options,
  });
};

