import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Schedule, Recommendation } from '../types/domain';

export const useOverview = (range: string) => {
  return useQuery({
    queryKey: ['overview', range],
    queryFn: () => apiClient.getOverview(range),
  });
};

export const useBuildings = () => {
  return useQuery({
    queryKey: ['buildings'],
    queryFn: apiClient.getBuildings,
  });
};

export const useRooms = () => {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: apiClient.getRooms,
  });
};

export const useSchedules = () => {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: apiClient.getSchedules,
  });
};

export const useRecommendations = () => {
  return useQuery({
    queryKey: ['recommendations'],
    queryFn: apiClient.getRecommendations,
  });
};

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: apiClient.getSettings,
  });
};

export const usePatchRecommendation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: Partial<Recommendation> }) => apiClient.patchRecommendation(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });
};

export const useUpsertSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: Schedule) => apiClient.upsertSchedule(schedule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
};

export const useCreateSimulation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.createSimulation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulations'] })
  });
};

export const useSimulation = (id: string | null) => {
  return useQuery({
    queryKey: ['simulation', id],
    queryFn: () => apiClient.getSimulation(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'done' || data.status === 'failed')) return false;
      return 700; // Poll every 700ms while running
    }
  });
};

export const useSimulationHistory = () => {
  return useQuery({
    queryKey: ['simulations'],
    queryFn: apiClient.listSimulations
  });
};