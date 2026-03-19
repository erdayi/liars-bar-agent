import { create } from 'zustand'
import type { Player } from '../types/models'

export interface TableState {
  tableId: string | null
  name: string
  gameMode: 'deck' | 'dice'
  status: 'waiting' | 'in_game'
  hostSessionId: string
  players: Player[]
  maxPlayers: number
  setTable: (data: Partial<TableState>) => void
  addPlayer: (player: Player) => void
  removePlayer: (sessionId: string) => void
  clear: () => void
}

export const useTableStore = create<TableState>((set) => ({
  tableId: null,
  name: '',
  gameMode: 'dice',
  status: 'waiting',
  hostSessionId: '',
  players: [],
  maxPlayers: 8,

  setTable: (data) => set((state) => ({ ...state, ...data })),

  addPlayer: (player) =>
    set((state) => {
      if (state.players.some((p) => p.session_id === player.session_id)) return state
      return {
        ...state,
        players: [...state.players, player],
      }
    }),

  removePlayer: (sessionId) =>
    set((state) => ({
      ...state,
      players: state.players.filter((p) => p.session_id !== sessionId),
    })),

  clear: () => set({
    tableId: null,
    name: '',
    gameMode: 'dice',
    status: 'waiting',
    hostSessionId: '',
    players: [],
    maxPlayers: 8,
  }),
}))
