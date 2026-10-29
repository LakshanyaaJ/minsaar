import { create } from 'zustand';

type DateRange = 'today' | 'week' | 'month' | 'custom';

interface FiltersState {
  selectedBuildingId: string | null;
  selectedRoomId: string | null;
  dateRange: DateRange;
  setBuilding: (id: string | null) => void;
  setRoom: (id: string | null) => void;
  setDateRange: (range: DateRange) => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  selectedBuildingId: null,
  selectedRoomId: null,
  dateRange: 'today',
  setBuilding: (id) => set({ selectedBuildingId: id, selectedRoomId: null }),
  setRoom: (id) => set({ selectedRoomId: id }),
  setDateRange: (range) => set({ dateRange: range }),
}));