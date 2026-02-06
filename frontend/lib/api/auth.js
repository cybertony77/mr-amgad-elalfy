import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../axios';

// Query keys for authentication
export const authKeys = {
  all: ['auth'],
  profile: () => [...authKeys.all, 'profile'],
};

// API functions
const authApi = {
  // Login
  login: async (credentials) => {
    const response = await apiClient.post('/api/auth/login', credentials);
    return response.data;
  },

  // Get current user profile
  getProfile: async () => {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },

  // Update current user profile
  updateProfile: async (updateData) => {
    const response = await apiClient.put('/api/auth/me', updateData);
    return response.data;
  },
};

// React Query hooks
export const useProfile = () => {
  return useQuery({
    queryKey: authKeys.profile(),
    queryFn: () => authApi.getProfile(),
  });
};

export const useProfilePicture = () => {
  return useQuery({
    queryKey: ['profile-picture'],
    queryFn: async () => {
      const response = await apiClient.get('/api/profile-picture/signed-url');
      return response.data?.url || null;
    },
    staleTime: 50 * 60 * 1000, // 50 minutes (signed URLs expire in 1 hour)
    retry: 1,
    enabled: true,
  });
};

// Mutations
export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (credentials) => authApi.login(credentials),
    onSuccess: () => {
      // Invalidate and refetch profile (token is now in HTTP-only cookie)
      queryClient.invalidateQueries({ queryKey: authKeys.profile() });
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updateData) => authApi.updateProfile(updateData),
    onMutate: async (updateData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: authKeys.profile() });
      await queryClient.cancelQueries({ queryKey: ['profile-picture'] });

      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData(authKeys.profile());

      // Optimistically update to the new value
      if (previousProfile) {
        queryClient.setQueryData(authKeys.profile(), { ...previousProfile, ...updateData });
      }

      // Return a context object with the snapshotted value
      return { previousProfile };
    },
    onError: (err, updateData, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousProfile) {
        queryClient.setQueryData(authKeys.profile(), context.previousProfile);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: authKeys.profile() });
      // Invalidate profile picture query to refresh the image in UserMenu
      queryClient.invalidateQueries({ queryKey: ['profile-picture'] });
    },
  });
};

