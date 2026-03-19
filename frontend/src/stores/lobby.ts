import { create } from 'zustand'
import { api } from '../api/http'
import type { Room } from '../types/models'

interface LobbyState {
  rooms: Room[]
  isLoading: boolean
  hasLoaded: boolean
  loadRooms: () => Promise<void>
  setRooms: (rooms: Room[]) => void
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  rooms: [],
  isLoading: false,
  hasLoaded: false,

  loadRooms: async () => {
    if (!get().hasLoaded) set({ isLoading: true })
    try {
      const data = await api.listRooms()
      set({ rooms: data.rooms || [], isLoading: false, hasLoaded: true })
    } catch {
      set({ isLoading: false })
    }
  },

  setRooms: (rooms: Room[]) => set({ rooms }),
}))
