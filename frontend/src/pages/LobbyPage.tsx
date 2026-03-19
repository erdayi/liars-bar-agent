import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/http'
import { useLobbyStore } from '../stores/lobby'
import AnimalAvatar from '../components/AnimalAvatar'

interface User {
  id: string
  username: string
  email: string
  avatar: string
  points: number
}

interface Room {
  room_id: string
  mode: string
  max_players: number
  player_count: number
  owner_id: string
  name?: string
  players?: { nickname: string; avatar: string }[]
  is_owner?: boolean
}

interface LobbyPageProps {
  user: User
  onLogout: () => void
}

export default function LobbyPage({ user, onLogout }: LobbyPageProps) {
  const navigate = useNavigate()
  const { rooms, isLoading, loadRooms } = useLobbyStore()
  const [selectedMode, setSelectedMode] = useState<'deck' | 'dice'>('dice')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [error, setError] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 8

  // Calculate pagination
  const totalPages = Math.ceil(rooms.length / ITEMS_PER_PAGE)
  const paginatedRooms = rooms.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  useEffect(() => {
    loadRooms()
    const interval = setInterval(loadRooms, 3000)
    loadLeaderboard()
    return () => clearInterval(interval)
  }, [])

  // Reset to page 1 when rooms change
  useEffect(() => {
    setCurrentPage(1)
  }, [rooms.length])

  const loadLeaderboard = async () => {
    try {
      const data = await api.getLeaderboard()
      setLeaderboard(data.leaderboard || [])
    } catch (err) {
      console.error('Failed to load leaderboard:', err)
    }
  }

  const createRoom = async () => {
    try {
      setCreating(true)
      setError(null)
      setShowCreate(false)
      const token = localStorage.getItem('token')
      if (!token) return

      const { room_id } = await api.createRoom(selectedMode, token, maxPlayers)
      navigate(`/game/${room_id}`)
    } catch (err: any) {
      console.error('Failed to create room:', err)
      setError(err.message || '创建房间失败')
      setCreating(false)
    }
  }

  const joinRoom = async (roomId: string) => {
    try {
      setError(null)
      const token = localStorage.getItem('token')
      if (!token) return

      await api.joinRoom(roomId, token)
      navigate(`/game/${roomId}`)
    } catch (err: any) {
      console.error('Failed to join room:', err)
      setError(err.message || '加入房间失败')
    }
  }

  const deleteRoom = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除这个房间吗？')) return

    try {
      const token = localStorage.getItem('token')
      if (!token) return

      await api.deleteRoom(roomId, token)
      loadRooms()
    } catch (err: any) {
      console.error('Failed to delete room:', err)
      setError(err.message || '删除房间失败')
    }
  }

  const handleLogout = () => {
    onLogout()
    navigate('/')
  }

  return (
    <div className="min-h-dvh flex flex-col bg-speakeasy">
      {/* Animated ambient glow */}
      <div className="ambient-light" />

      {/* Decorative corner accents */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-32 h-32 opacity-10">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M0 0 L100 0 L100 20 L20 20 L20 0" fill="none" stroke="#D4A853" strokeWidth="1"/>
            <path d="M0 0 L0 100 L20 100 L20 20 L0 20" fill="none" stroke="#D4A853" strokeWidth="1"/>
          </svg>
        </div>
        <div className="absolute bottom-0 right-0 w-32 h-32 opacity-10 rotate-180">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M0 0 L100 0 L100 20 L20 20 L20 0" fill="none" stroke="#D4A853" strokeWidth="1"/>
            <path d="M0 0 L0 100 L20 100 L20 20 L0 20" fill="none" stroke="#D4A853" strokeWidth="1"/>
          </svg>
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-5 border-b border-border-gold/30 bg-bg-primary/80 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-gold/20 to-accent-gold/5 border border-border-gold/50 flex items-center justify-center">
                <span className="text-2xl">🍸</span>
              </div>
              <div className="absolute -inset-1 rounded-xl bg-accent-gold/10 animate-pulse" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <h1 className="text-xl font-accent text-accent-gold tracking-[0.3em] text-glow-gold">LIAR'S BAR</h1>
              <p className="text-[10px] text-accent-gold/40 tracking-[0.4em] uppercase mt-0.5">VIP Gaming Lounge</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Points display */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-gold/5 border border-accent-gold/20">
              <span className="text-accent-gold/60 text-sm">💰</span>
              <span className="text-accent-gold font-semibold tabular-nums">{user?.points?.toLocaleString()}</span>
            </div>

            {/* User info */}
            <div className="flex items-center gap-3 pl-4 border-l border-border-subtle">
              <AnimalAvatar avatar={user?.avatar || 'fox'} size={36} />
              <div className="hidden sm:block">
                <p className="text-text-primary text-sm font-medium">{user?.username}</p>
                <p className="text-[10px] text-accent-gold/50 uppercase tracking-wider">Player</p>
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={() => setShowLeaderboard(true)}
              className="p-2.5 rounded-xl hover:bg-accent-gold/10 text-text-secondary/60 hover:text-accent-gold transition-all"
              title="排行榜"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl hover:bg-accent-red/10 text-text-secondary/60 hover:text-accent-red transition-all"
              title="退出登录"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <div className="relative z-10 mx-5 mt-3 animate-slide-up">
          <div className="flex items-center gap-3 px-4 py-3 bg-accent-red/10 border border-accent-red/30 rounded-xl">
            <span className="text-accent-red text-lg">⚠️</span>
            <p className="text-accent-red text-sm flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-accent-red/60 hover:text-accent-red">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="relative z-10 flex-1 overflow-y-auto px-5 py-6">
        {/* Section header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-accent-gold to-accent-amber" />
            <h2 className="text-text-secondary/80 text-xs uppercase tracking-[0.25em] font-accent">活跃牌桌</h2>
            <span className="text-accent-gold/40 text-xs">
              {totalPages > 1
                ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, rooms.length)} / ${rooms.length}`
                : rooms.length}
            </span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-gold/10 border border-accent-gold/30 text-accent-gold text-xs font-medium hover:bg-accent-gold/20 hover:border-accent-gold/50 transition-all active:scale-[0.97]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建
          </button>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-text-secondary/40">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green/60 animate-pulse" />
          <span>在线</span>
        </div>

        {/* Loading state */}
        {isLoading && rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-accent-gold/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-gold animate-spin" />
            </div>
            <p className="text-text-secondary/60 text-sm">正在加载牌桌...</p>
          </div>
        ) : rooms.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16">
            {/* Decorative cards */}
            <div className="relative w-48 h-24 mb-6">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-1">
                <div className="w-12 h-16 rounded-lg card-back -rotate-12 -ml-4 animate-float" style={{ animationDelay: '0ms' }} />
                <div className="w-12 h-16 rounded-lg card-back rotate-0 -ml-3 z-10 animate-float" style={{ animationDelay: '200ms' }} />
                <div className="w-12 h-16 rounded-lg card-back rotate-12 -ml-3 animate-float" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
            <h3 className="text-text-primary/60 font-accent text-lg tracking-wider mb-2">暂无活跃房间</h3>
            <p className="text-text-secondary/40 text-sm text-center max-w-xs">
              创建房间开始游戏，或等待其他玩家邀请
            </p>
          </div>
        ) : (
          /* Room grid */
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedRooms.map((table: Room, index: number) => (
              <div
                key={table.room_id}
                className="group relative bg-gradient-to-br from-bg-surface/80 to-bg-elevated/40 border border-border-subtle rounded-2xl p-4 transition-all duration-300 hover:border-accent-gold/40 hover:bg-bg-surface hover:shadow-[0_0_30px_rgba(212,168,83,0.15)] cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => joinRoom(table.room_id)}
              >
                {/* Hover glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Card content */}
                <div className="relative z-10">
                  {/* Top row - Mode icon + Room name */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                        table.mode === 'dice'
                          ? 'bg-gradient-to-br from-accent-gold/20 to-accent-gold/5 border border-accent-gold/30'
                          : 'bg-gradient-to-br from-accent-red/20 to-accent-red/5 border border-accent-red/30'
                      }`}>
                        {table.mode === 'dice' ? '🎲' : '🃏'}
                      </div>
                      <div>
                        <h3 className="text-text-primary font-semibold text-sm truncate max-w-[100px]">
                          {table.name || `#${table.room_id.slice(0, 6)}`}
                        </h3>
                        <p className="text-[10px] text-text-secondary/50 uppercase tracking-wider">
                          {table.mode === 'dice' ? '骰子模式' : '纸牌模式'}
                        </p>
                      </div>
                    </div>

                    {/* Owner badge / Delete button */}
                    {table.owner_id === user?.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] bg-accent-gold/20 text-accent-gold px-2 py-0.5 rounded-full border border-accent-gold/30">
                          房主
                        </span>
                        <button
                          onClick={(e) => deleteRoom(table.room_id, e)}
                          className="p-1.5 rounded-lg hover:bg-accent-red/20 text-text-secondary/40 hover:text-accent-red transition-colors"
                          title="删除房间"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-bg-elevated/50 border border-border-subtle flex items-center justify-center">
                        <span className="text-[10px] text-text-secondary/40">{table.player_count}/{table.max_players}</span>
                      </div>
                    )}
                  </div>

                  {/* Players preview */}
                  <div className="flex items-center gap-2 mb-3 min-h-[28px]">
                    {Array.from({ length: Math.min(table.max_players, 4) }).map((_, i) => (
                      table.players && table.players[i] ? (
                        <div key={i} className="flex items-center gap-1.5 bg-bg-elevated/60 px-2 py-1 rounded-lg border border-border-subtle/50">
                          <AnimalAvatar avatar={table.players[i].avatar || 'fox'} size={16} />
                          <span className="text-[10px] text-text-secondary truncate max-w-[50px]">
                            {table.players[i].nickname}
                          </span>
                        </div>
                      ) : (
                        <div key={`empty-${i}`} className="w-6 h-6 rounded-lg border border-dashed border-border-subtle/30 flex items-center justify-center">
                          <span className="text-[8px] text-text-secondary/20">+</span>
                        </div>
                      )
                    ))}
                    {table.max_players > 4 && (
                      <span className="text-[10px] text-text-secondary/30">+{table.max_players - 4}</span>
                    )}
                  </div>

                  {/* Action button */}
                  {table.player_count >= table.max_players ? (
                    <div className="text-center py-2 bg-accent-red/5 rounded-xl border border-accent-red/20">
                      <span className="text-accent-red/60 text-xs font-medium">房间已满</span>
                    </div>
                  ) : table.player_count > 0 ? (
                    <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-accent-gold to-accent-amber text-bg-primary font-semibold text-sm active:scale-[0.97] transition-all hover:shadow-[0_0_20px_rgba(212,168,83,0.3)]">
                      加入游戏
                    </button>
                  ) : (
                    <div className="text-center py-2.5 bg-bg-elevated/50 rounded-xl border border-border-subtle/30">
                      <span className="text-text-secondary/40 text-xs">等待开始...</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-border-subtle text-text-secondary hover:border-accent-gold/50 hover:text-accent-gold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      currentPage === page
                        ? 'bg-accent-gold text-bg-primary'
                        : 'text-text-secondary hover:text-accent-gold hover:bg-accent-gold/10'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-border-subtle text-text-secondary hover:border-accent-gold/50 hover:text-accent-gold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
          </>
        )}
      </main>

      {/* Create room modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-sm bg-[#0F0F18] border border-[#2A2A3A] rounded-3xl overflow-hidden shadow-2xl">
            {/* Top decorative bar */}
            <div className="h-1 bg-gradient-to-r from-[#D4A853] via-[#F5C563] to-[#D4A853]" />

            {/* Content */}
            <div className="p-6">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1C1C2B] to-[#0F0F18] border border-[#2A2A3A] mb-3">
                  <span className="text-3xl">🎲</span>
                </div>
                <h2 className="text-2xl font-accent text-[#D4A853] tracking-[0.2em]">创建房间</h2>
                <p className="text-[#8B8B9E] text-xs mt-2">选择游戏模式与玩家人数</p>
              </div>

              {/* Mode selection */}
              <div className="mb-5">
                <p className="text-[#8B8B9E] text-[10px] uppercase tracking-[0.25em] mb-3">游戏模式</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('dice')}
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all duration-300 ${
                      selectedMode === 'dice'
                        ? 'border-[#D4A853] bg-[#D4A853]/10'
                        : 'border-[#2A2A3A] hover:border-[#D4A853]/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl filter drop-shadow-lg">🎲</span>
                      <span className={`text-sm font-bold ${selectedMode === 'dice' ? 'text-[#D4A853]' : 'text-[#8B8B9E]'}`}>
                        骰子
                      </span>
                      <span className="text-[10px] text-[#8B8B9E]/50">节奏快</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('deck')}
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all duration-300 ${
                      selectedMode === 'deck'
                        ? 'border-[#D4A853] bg-[#D4A853]/10'
                        : 'border-[#2A2A3A] hover:border-[#D4A853]/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl filter drop-shadow-lg">🃏</span>
                      <span className={`text-sm font-bold ${selectedMode === 'deck' ? 'text-[#D4A853]' : 'text-[#8B8B9E]'}`}>
                        纸牌
                      </span>
                      <span className="text-[10px] text-[#8B8B9E]/50">经典</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Player count */}
              <div className="mb-6">
                <p className="text-[#8B8B9E] text-[10px] uppercase tracking-[0.25em] mb-3">玩家人数</p>
                <div className="flex gap-2">
                  {[2, 3, 4, 6, 8].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMaxPlayers(num)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-300 ${
                        maxPlayers === num
                          ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#D4A853]'
                          : 'border-[#2A2A3A] text-[#8B8B9E] hover:border-[#D4A853]/50'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit button */}
              <button
                type="button"
                onClick={createRoom}
                disabled={creating}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#D4A853] to-[#F5C563] text-[#0A0A0F] font-bold text-base tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 hover:shadow-[0_0_30px_rgba(212,168,83,0.4)]"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    创建中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    创建房间
                  </span>
                )}
              </button>

              {/* Cancel hint */}
              <p className="text-center text-[#8B8B9E]/40 text-xs mt-4">
                点击空白处关闭
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-bg-primary/90 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowLeaderboard(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-gradient-to-br from-bg-surface to-bg-elevated border border-border-gold/30 rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 animate-slide-up">
            <div className="w-12 h-1 rounded-full bg-border-subtle mx-auto mb-6 sm:hidden" />
            <div className="text-center mb-6">
              <h2 className="text-xl font-accent text-accent-gold tracking-wider">排行榜</h2>
              <div className="ornament max-w-[120px] mx-auto mt-2">
                <span className="text-border-subtle text-xs">◆</span>
              </div>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {leaderboard.length === 0 ? (
                <p className="text-center text-text-secondary/40 py-8">暂无排行数据</p>
              ) : (
                leaderboard.map((entry: any, i: number) => (
                  <div key={entry.user_id} className={`flex items-center gap-3 p-3 rounded-xl ${
                    entry.user_id === user?.id ? 'bg-accent-gold/10 border border-accent-gold/30' : 'bg-bg-elevated/50'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-accent-gold text-bg-primary' :
                      i === 1 ? 'bg-text-secondary/30 text-text-primary' :
                      i === 2 ? 'bg-accent-amber/50 text-accent-amber' :
                      'bg-bg-elevated text-text-secondary/50'
                    }`}>
                      {i + 1}
                    </div>
                    <AnimalAvatar avatar={entry.avatar || 'fox'} size={28} />
                    <div className="flex-1">
                      <p className="text-text-primary text-sm font-medium">{entry.username}</p>
                      <p className="text-[10px] text-text-secondary/40">{entry.games_played || 0} 场游戏</p>
                    </div>
                    <div className="text-right">
                      <p className="text-accent-gold font-semibold">{entry.points?.toLocaleString()}</p>
                      <p className="text-[10px] text-accent-gold/40">积分</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-full mt-6 py-3 rounded-xl border border-border-subtle text-text-secondary hover:border-accent-gold/30 hover:text-accent-gold transition-all"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}