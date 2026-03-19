const API_BASE = '/api'

function getAuthHeader(): HeadersInit {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeader = getAuthHeader()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...options.headers,
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }

  return response.json()
}

export const api = {
  // Auth
  getLoginUrl: () => fetchApi<{ authorization_url: string; state: string }>('/auth/login'),

  getCurrentUser: (token: string) =>
    fetchApi<{
      id: string
      username: string
      email: string
      avatar: string
      points: number
      games_played: number
      games_won: number
    }>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  // Lobby
  listRooms: () => fetchApi<{ rooms: any[] }>('/lobby/rooms'),

  createRoom: (mode: string, token: string, maxPlayers: number = 4) =>
    fetchApi<{
      room_id: string
      mode: string
      max_players: number
    }>('/lobby/rooms', {
      method: 'POST',
      body: JSON.stringify({ mode, max_players: maxPlayers }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  joinRoom: (roomId: string, token: string) =>
    fetchApi<{
      room_id: string
      mode: string
      max_players: number
      player_count: number
      ws_url: string
    }>('/lobby/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ room_id: roomId }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  leaveRoom: (roomId: string, token: string) =>
    fetchApi<{ success: boolean }>(`/lobby/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),

  addBots: (roomId: string, token: string, count: number = 1) =>
    fetchApi<{
      success: boolean
      added: number
      player_count: number
      players: any[]
    }>(`/lobby/rooms/${roomId}/bots`, {
      method: 'POST',
      body: JSON.stringify({ count }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  getLeaderboard: () => fetchApi<{ leaderboard: any[] }>('/lobby/leaderboard'),

  deleteRoom: (roomId: string, token: string) =>
    fetchApi<{ success: boolean }>(`/lobby/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  // TTS - returns audio blob
  speak: async (text: string): Promise<Blob> => {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('No token')

    const response = await fetch(`${API_BASE}/tts/speak?text=${encodeURIComponent(text)}&token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error('TTS request failed')
    }

    return response.blob()
  },

  getVoices: () => fetchApi<{ voices: any[] }>('/tts/voices'),
}
