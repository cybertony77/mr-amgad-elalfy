import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../axios';

// Query keys
export const deviceKeys = {
  all: ['students-devices'],
  list: (params) => ['students-devices', 'list', params],
};

// API functions
const deviceApi = {
  getStudentsDevices: async (params = {}) => {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = queryString ? `/api/students/devices?${queryString}` : '/api/students/devices';

    const response = await apiClient.get(url);
    return response.data;
  },

  updateAllowedDevices: async ({ id, allowed_devices }) => {
    const response = await apiClient.patch('/api/students/devices', {
      id,
      allowed_devices,
    });
    return response.data;
  },

  deleteDevice: async ({ id, device_id }) => {
    const response = await apiClient.delete('/api/students/devices', {
      params: { id, device_id },
    });
    return response.data;
  },
};

// Hooks
export const useStudentsDevicesPaginated = (params = {}, options = {}) => {
  const defaultParams = {
    page: 1,
    limit: 50,
    ...params,
  };

  return useQuery({
    queryKey: deviceKeys.list(defaultParams),
    queryFn: () => deviceApi.getStudentsDevices(defaultParams),
    keepPreviousData: true,
    ...options,
  });
};

export const useUpdateAllowedDevices = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, allowed_devices }) =>
      deviceApi.updateAllowedDevices({ id, allowed_devices }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceKeys.all });
    },
  });
};

export const useDeleteStudentDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, device_id }) => deviceApi.deleteDevice({ id, device_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceKeys.all });
    },
  });
};

// Assistants Devices API
export const assistantsDeviceKeys = {
  all: ['assistants-devices'],
  list: (params) => ['assistants-devices', 'list', params],
};

const assistantsDeviceApi = {
  getAssistantsDevices: async (params = {}) => {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = queryString ? `/api/assistants/devices?${queryString}` : '/api/assistants/devices';

    const response = await apiClient.get(url);
    return response.data;
  },

  updateAllowedDevices: async ({ id, allowed_devices }) => {
    const response = await apiClient.patch('/api/assistants/devices', {
      id,
      allowed_devices,
    });
    return response.data;
  },

  deleteDevice: async ({ id, device_id }) => {
    const response = await apiClient.delete('/api/assistants/devices', {
      params: { id, device_id },
    });
    return response.data;
  },
};

export const useAssistantsDevicesPaginated = (params = {}, options = {}) => {
  const defaultParams = {
    page: 1,
    limit: 50,
    ...params,
  };

  return useQuery({
    queryKey: assistantsDeviceKeys.list(defaultParams),
    queryFn: () => assistantsDeviceApi.getAssistantsDevices(defaultParams),
    keepPreviousData: true,
    ...options,
  });
};

export const useUpdateAssistantAllowedDevices = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, allowed_devices }) =>
      assistantsDeviceApi.updateAllowedDevices({ id, allowed_devices }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assistantsDeviceKeys.all });
    },
  });
};

export const useDeleteAssistantDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, device_id }) => assistantsDeviceApi.deleteDevice({ id, device_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assistantsDeviceKeys.all });
    },
  });
};

