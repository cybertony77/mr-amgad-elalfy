import { useQuery } from '@tanstack/react-query';
import apiClient from '../axios';

// Query keys for VAC
export const vacKeys = {
  all: ['vac'],
  lists: () => [...vacKeys.all, 'list'],
  list: (filters) => [...vacKeys.lists(), { filters }],
};

// API functions
const vacApi = {
  // Get all VACs with pagination support
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    
    // Add pagination parameters
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const queryString = queryParams.toString();
    const url = queryString ? `/api/vac?${queryString}` : '/api/vac';
    
    const response = await apiClient.get(url);
    return response.data;
  },
};

// Hook for paginated VACs
export const useVACPaginated = (params = {}, options = {}) => {
  const defaultParams = {
    page: 1,
    limit: 100,
    sortBy: 'account_id',
    sortOrder: 'asc',
    ...params
  };

  return useQuery({
    queryKey: [...vacKeys.all, 'paginated', defaultParams],
    queryFn: () => vacApi.getAll(defaultParams),
    keepPreviousData: true, // Keep previous data while loading new page
    ...options,
  });
};

